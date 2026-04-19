# Lecture 10d: Agentic Systems -- Tool Use, Orchestration, and Inference Scaling

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Design** the systems infrastructure for an LLM agent, including tool dispatch, sandboxed code execution, and multi-turn state management, with explicit attention to latency, reliability, and cost.
2. **Analyze** KV cache management strategies for multi-turn agentic conversations, deriving memory costs and identifying opportunities for prefix sharing, prompt caching, and cache eviction.
3. **Evaluate** test-time compute scaling strategies (beam search, best-of-N, tree search) in terms of their compute-quality Pareto frontier and implement scheduling policies that maximize quality under a compute budget.
4. **Implement** a batching strategy for heterogeneous agentic workloads where requests have varying tool call patterns, context lengths, and generation requirements.
5. **Construct** a reliability and guardrails infrastructure for agentic systems, including retry logic, output validation, rate limiting, and cost controls.

---

## 2. Motivation and Context

### 2.1 The Rise of Agentic Systems

LLM agents extend language models from text generation to action execution. An agent observes an environment, reasons about it, and takes actions through tools:

```
User Request -> [LLM Reasoning] -> [Tool Call] -> [Observation] -> [LLM Reasoning] -> ... -> [Final Answer]
```

This creates a fundamentally different systems workload from standard chat or completion:

| Property | Chat/Completion | Agentic Workload |
|----------|----------------|------------------|
| Turns per request | 1 | 5-50+ |
| Latency budget | 1-10s | 30s-30min |
| Token generation | 100-2000 | 1000-100,000+ |
| External calls | 0 | 1-100+ |
| Context growth | Fixed | Monotonically growing |
| Failure modes | Wrong text | Wrong actions, infinite loops, cost explosions |
| Cost per request | $0.001-0.10 | $0.10-50.00 |

### 2.2 Systems Challenges

Agentic systems introduce unique infrastructure requirements:

1. **Multi-turn KV cache management**: The conversation grows over many turns, and the KV cache must persist between turns.
2. **Heterogeneous latency**: Tool calls (web search, code execution, API calls) have vastly different latencies (10 ms to 10 s).
3. **Reliability**: A single failed tool call can derail an entire multi-step plan.
4. **Cost control**: Without limits, an agent can generate thousands of dollars in API costs in minutes.
5. **Concurrency**: An agent may need to call multiple tools in parallel.
6. **Sandboxing**: Code execution tools require isolation to prevent security breaches.

### 2.3 Connection to Prior Lectures

- **Lecture 07b (KV Cache)**: KV cache management is the foundation; agentic systems extend it to multi-turn scenarios with cache sharing.
- **Lecture 07c (Speculative Decoding)**: Test-time compute scaling generalizes the idea of spending more compute per token.
- **Lecture 07d (Serving Frameworks)**: Agentic serving requires extensions to vLLM-style systems for long-running requests.

---

## 3. Agent Architecture

### 3.1 Core Components

An agentic system consists of:

```
+---------------------------------------------------------------+
|                        ORCHESTRATOR                            |
|  +--------+    +----------+    +----------+    +----------+   |
|  |  LLM   |    |  Tool    |    |  State   |    | Guardrails|  |
|  | Engine |<-->| Dispatch |<-->| Manager  |<-->|  Engine   |  |
|  +--------+    +----------+    +----------+    +----------+   |
|       ^              |              ^                          |
|       |         +----+----+         |                          |
|       |         |    |    |         |                          |
|       v         v    v    v         v                          |
|  [KV Cache]  [Web] [Code] [API]  [Memory]                    |
+---------------------------------------------------------------+
```

**LLM Engine**: Generates text and structured tool calls. Manages the KV cache across turns.

**Tool Dispatch**: Routes tool calls to appropriate executors, handles timeouts, retries, and result formatting.

**State Manager**: Maintains conversation history, tool results, and any persistent state (files created, variables defined, etc.).

**Guardrails Engine**: Validates outputs, enforces rate limits, applies content filters, and manages cost budgets.

### 3.2 Tool Call Protocol

Modern LLMs use structured tool calling, where the model generates a structured representation (typically JSON) of the tool to call:

```json
{
  "tool": "web_search",
  "arguments": {
    "query": "latest NVIDIA H200 GPU specifications",
    "num_results": 5
  }
}
```

**Systems design of the tool dispatch pipeline:**

```python
import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional
from enum import Enum

class ToolStatus(Enum):
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"

@dataclass
class ToolResult:
    tool_name: str
    status: ToolStatus
    result: Any = None
    error: str = ""
    latency_ms: float = 0.0
    tokens_used: int = 0

@dataclass
class ToolConfig:
    """Configuration for a registered tool."""
    name: str
    function: Callable
    timeout_seconds: float = 30.0
    max_retries: int = 2
    retry_delay_seconds: float = 1.0
    rate_limit_per_minute: int = 60
    max_output_tokens: int = 4096
    requires_sandbox: bool = False

class ToolDispatcher:
    """
    Dispatches tool calls with timeout, retry, and rate limiting.

    Handles both synchronous and asynchronous tool execution.
    """
    def __init__(self):
        self.tools: dict[str, ToolConfig] = {}
        self.call_counts: dict[str, list[float]] = {}
        self.total_cost: float = 0.0

    def register(self, config: ToolConfig):
        self.tools[config.name] = config
        self.call_counts[config.name] = []

    def _check_rate_limit(self, tool_name: str) -> bool:
        """Check if the tool is within its rate limit."""
        config = self.tools[tool_name]
        now = time.time()
        # Remove calls older than 60 seconds
        self.call_counts[tool_name] = [
            t for t in self.call_counts[tool_name] if now - t < 60
        ]
        return len(self.call_counts[tool_name]) < config.rate_limit_per_minute

    async def execute(self, tool_name: str, arguments: dict) -> ToolResult:
        """
        Execute a tool call with full error handling.

        Args:
            tool_name: name of the registered tool
            arguments: keyword arguments for the tool
        Returns:
            ToolResult with status and result/error
        """
        if tool_name not in self.tools:
            return ToolResult(
                tool_name=tool_name,
                status=ToolStatus.ERROR,
                error=f"Unknown tool: {tool_name}"
            )

        config = self.tools[tool_name]

        # Rate limit check
        if not self._check_rate_limit(tool_name):
            return ToolResult(
                tool_name=tool_name,
                status=ToolStatus.RATE_LIMITED,
                error=f"Rate limit exceeded for {tool_name}"
            )

        # Retry loop
        last_error = ""
        for attempt in range(config.max_retries + 1):
            try:
                start = time.time()

                # Execute with timeout
                if asyncio.iscoroutinefunction(config.function):
                    result = await asyncio.wait_for(
                        config.function(**arguments),
                        timeout=config.timeout_seconds
                    )
                else:
                    result = await asyncio.wait_for(
                        asyncio.to_thread(config.function, **arguments),
                        timeout=config.timeout_seconds
                    )

                latency = (time.time() - start) * 1000
                self.call_counts[tool_name].append(time.time())

                # Truncate output if needed
                result_str = str(result)
                if len(result_str) > config.max_output_tokens * 4:
                    result_str = result_str[:config.max_output_tokens * 4]
                    result_str += "\n... [truncated]"

                return ToolResult(
                    tool_name=tool_name,
                    status=ToolStatus.SUCCESS,
                    result=result_str,
                    latency_ms=latency,
                )

            except asyncio.TimeoutError:
                last_error = f"Timeout after {config.timeout_seconds}s"
                if attempt < config.max_retries:
                    await asyncio.sleep(config.retry_delay_seconds)

            except Exception as e:
                last_error = f"{type(e).__name__}: {str(e)}"
                if attempt < config.max_retries:
                    await asyncio.sleep(config.retry_delay_seconds)

        return ToolResult(
            tool_name=tool_name,
            status=ToolStatus.TIMEOUT if "Timeout" in last_error else ToolStatus.ERROR,
            error=last_error,
        )

    async def execute_parallel(self, calls: list[tuple[str, dict]]) -> list[ToolResult]:
        """Execute multiple tool calls in parallel."""
        tasks = [self.execute(name, args) for name, args in calls]
        return await asyncio.gather(*tasks)
```

---

## 4. KV Cache Management for Agents

### 4.1 Multi-Turn Cache Growth

In an agentic conversation, the context grows monotonically:

```
Turn 1: [System Prompt | User Query]                    -> 500 tokens
Turn 2: [... | Tool Call | Tool Result | Reasoning]     -> 1500 tokens
Turn 3: [... | Tool Call | Tool Result | Reasoning]     -> 3000 tokens
...
Turn 10: [... | Final Answer]                           -> 15000 tokens
```

The KV cache for a 70B model at turn 10: $15000 \times 2 \times 80 \times 8192 \times 2 \approx 39$ GB.

For a serving system handling many concurrent agents, memory management is critical.

### 4.2 Prefix Sharing

Many agent sessions share a common system prompt and tool definitions. **Prefix caching** deduplicates the KV cache for shared prefixes:

```
Agent Session 1:  [System Prompt + Tools | User Query 1 | ...]
Agent Session 2:  [System Prompt + Tools | User Query 2 | ...]
Agent Session 3:  [System Prompt + Tools | User Query 3 | ...]
                   ^^^^^^^^^^^^^^^^^^^^^^^^^
                   Shared prefix (cached once)
```

**Memory savings.** If the shared prefix is $P$ tokens and we have $N$ concurrent sessions:

$$\text{Savings} = (N - 1) \times P \times 2Ld \cdot \text{sizeof(dtype)}$$

For $P = 2000$ tokens, $N = 100$ sessions, 70B model: $(99) \times 2000 \times 2.62 \times 10^6 \approx 519$ GB saved.

**Implementation.** Use a trie (prefix tree) to identify shared prefixes:

```python
class PrefixTrie:
    """
    Trie for KV cache prefix sharing.

    Each node stores a reference to the cached KV block.
    Multiple sessions can share the same prefix path.
    """
    def __init__(self):
        self.children: dict[int, "PrefixTrie"] = {}
        self.kv_block_id: Optional[int] = None
        self.ref_count: int = 0

    def insert(self, token_ids: list[int], kv_block_ids: list[int]):
        """Insert a token sequence and associate KV block IDs."""
        node = self
        for token, block_id in zip(token_ids, kv_block_ids):
            if token not in node.children:
                node.children[token] = PrefixTrie()
            node = node.children[token]
            node.kv_block_id = block_id
            node.ref_count += 1

    def find_prefix(self, token_ids: list[int]) -> tuple[int, list[int]]:
        """
        Find the longest matching prefix.

        Returns:
            prefix_length: number of matched tokens
            kv_block_ids: cached KV blocks for the prefix
        """
        node = self
        matched = 0
        block_ids = []

        for token in token_ids:
            if token in node.children:
                node = node.children[token]
                matched += 1
                block_ids.append(node.kv_block_id)
            else:
                break

        return matched, block_ids
```

### 4.3 Prompt Caching Across Turns

Between turns of an agentic conversation, the context only grows -- the existing tokens do not change. This means the KV cache from the previous turn can be reused entirely:

```
Turn N:     [Context_1..N]          -> KV cache for all tokens
Turn N+1:   [Context_1..N | New]    -> Reuse KV cache, only compute for New tokens
```

**Prefill savings.** The prefill cost for turn $N+1$ is:

$$\text{FLOPs}_{\text{prefill}} = 4 \cdot |\text{New}| \cdot S_{\text{total}} \cdot d$$

instead of $4 \cdot S_{\text{total}}^2 \cdot d$ for a full prefill. For 100 new tokens added to a 10,000-token context, this is a 100x reduction.

**Implementation requirement.** The serving system must retain the KV cache between turns. This conflicts with serving systems like vLLM that aggressively evict KV cache for completed requests. Solutions:

1. **Session affinity**: Pin agent sessions to specific GPU workers.
2. **KV cache checkpointing**: Write KV cache to CPU memory between turns; reload on the next turn.
3. **Persistent sessions**: Keep long-running agent sessions as "paused" requests that retain their GPU memory allocation.

### 4.4 Cache Eviction Under Memory Pressure

When memory is scarce, the system must decide which KV caches to evict. Policies:

| Policy | Description | Best For |
|--------|-------------|----------|
| LRU | Evict least recently used session | Mixed workloads |
| Size-weighted LRU | Evict largest idle cache first | Memory-sensitive workloads |
| Priority-based | High-priority agents keep cache | SLO-differentiated workloads |
| Predictive | Evict sessions unlikely to continue | Long-tail session distributions |

**Cost model for eviction:**

$$\text{Cost}_{\text{evict}}(s) = T_{\text{reprefill}}(s) \times P_{\text{return}}(s)$$

where $T_{\text{reprefill}}(s)$ is the time to re-prefill session $s$'s context and $P_{\text{return}}(s)$ is the probability the session will have another turn. Evict the session with the lowest expected cost.

---

## 5. Test-Time Compute Scaling

### 5.1 Motivation

Standard autoregressive decoding generates one token at a time, greedily or with sampling. Test-time compute scaling spends additional compute to improve output quality.

**The compute-quality tradeoff.** For a given model, we can improve outputs by:

1. **Generating more candidates** and selecting the best (best-of-N).
2. **Searching over the generation space** (beam search, tree search).
3. **Iterating on outputs** (self-critique, revision loops).

Each strategy has different compute costs and quality ceilings.

### 5.2 Best-of-N Sampling

Generate $N$ independent completions and select the best according to a reward model or verifier.

**Compute cost:** $N$ times the single-generation cost.

**Quality scaling.** If the per-sample pass rate is $p$ (probability of a correct/good output), the best-of-N pass rate is:

$$P_{\text{best-of-N}} = 1 - (1 - p)^N$$

For $p = 0.3$:

| N | $P_{\text{best-of-N}}$ | Compute Multiplier |
|---|----------------------|-------------------|
| 1 | 0.30 | 1x |
| 4 | 0.76 | 4x |
| 16 | 0.99 | 16x |
| 64 | 0.9999 | 64x |

**Diminishing returns.** The marginal value of each additional sample decreases. The optimal $N$ depends on the per-sample pass rate and the cost of compute.

**Systems implementation.** Best-of-N is embarrassingly parallel and maps well to batch inference:

```python
async def best_of_n(
    llm_engine,
    prompt: str,
    n: int,
    reward_fn: Callable[[str], float],
    temperature: float = 0.7,
    max_tokens: int = 1024,
) -> tuple[str, float]:
    """
    Generate N completions and return the best one.

    Args:
        llm_engine: inference engine with batch generation
        prompt: input prompt
        n: number of samples
        reward_fn: callable that scores completions (higher = better)
        temperature: sampling temperature
        max_tokens: max tokens per completion
    Returns:
        best_completion: str
        best_score: float
    """
    # Generate all N completions in a single batch
    completions = await llm_engine.generate_batch(
        prompts=[prompt] * n,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # Score all completions
    scores = [reward_fn(c) for c in completions]

    best_idx = max(range(n), key=lambda i: scores[i])
    return completions[best_idx], scores[best_idx]
```

### 5.3 Tree Search

Tree search explores the generation space more efficiently than independent sampling by sharing computation across branches.

**MCTS-style approach for LLM generation:**

```
Root: [Prompt]
        |
    +---+---+---+
    |   |   |   |
   [A] [B] [C] [D]     <- Step 1: generate K continuations
    |       |
   [A1]   [C1]         <- Step 2: expand promising branches
   [A2]   [C2]
    |
   [A1a]                <- Step 3: continue best path
   [A1b]
```

**Key components:**

1. **Expansion**: Generate $K$ candidate continuations from a node (using sampling or beam search).
2. **Evaluation**: Score each candidate using a reward model, process reward model (PRM), or verifier.
3. **Selection**: Choose which branches to expand (UCB1 or similar policy).
4. **Backpropagation**: Update ancestor node scores based on descendant evaluations.

```python
from dataclasses import dataclass, field

@dataclass
class TreeNode:
    """Node in the search tree for LLM generation."""
    text: str                                    # Generated text so far
    token_ids: list[int] = field(default_factory=list)
    score: float = 0.0                          # Reward model score
    visits: int = 0                             # Number of times expanded
    children: list["TreeNode"] = field(default_factory=list)
    parent: Optional["TreeNode"] = None
    kv_cache_ref: Optional[int] = None          # Reference to cached KV state
    depth: int = 0
    is_terminal: bool = False

    @property
    def ucb_score(self) -> float:
        """Upper Confidence Bound for exploration-exploitation."""
        if self.visits == 0:
            return float("inf")
        exploit = self.score / self.visits
        explore = 1.414 * (
            (2 * (self.parent.visits if self.parent else 1)) / self.visits
        ) ** 0.5
        return exploit + explore


class TreeSearchEngine:
    """
    Tree search for test-time compute scaling.

    Maintains a tree of partial generations and uses a reward model
    to guide expansion.
    """
    def __init__(self, llm_engine, reward_model, max_depth: int = 10,
                 branch_factor: int = 4, max_iterations: int = 50):
        self.llm = llm_engine
        self.reward = reward_model
        self.max_depth = max_depth
        self.branch_factor = branch_factor
        self.max_iterations = max_iterations

    async def search(self, prompt: str, max_tokens: int = 512) -> str:
        """
        Run tree search to find the best generation.

        Returns the highest-scoring complete generation.
        """
        root = TreeNode(text=prompt, depth=0)
        best_terminal = None
        best_score = float("-inf")

        for iteration in range(self.max_iterations):
            # 1. Select: traverse tree using UCB to find leaf to expand
            leaf = self._select(root)

            if leaf.is_terminal or leaf.depth >= self.max_depth:
                continue

            # 2. Expand: generate K continuations from this leaf
            children = await self._expand(leaf)

            # 3. Evaluate: score each child with the reward model
            for child in children:
                child.score = await self._evaluate(child)
                child.visits = 1

                # Track best terminal node
                if child.is_terminal and child.score > best_score:
                    best_score = child.score
                    best_terminal = child

            # 4. Backpropagate: update ancestor scores
            for child in children:
                self._backpropagate(child)

        if best_terminal:
            return best_terminal.text
        else:
            # Return the best non-terminal path
            return self._best_path(root)

    def _select(self, node: TreeNode) -> TreeNode:
        """Select a leaf node using UCB1 policy."""
        while node.children:
            node = max(node.children, key=lambda c: c.ucb_score)
        return node

    async def _expand(self, node: TreeNode) -> list[TreeNode]:
        """Generate K child nodes by sampling continuations."""
        continuations = await self.llm.generate_batch(
            prompts=[node.text] * self.branch_factor,
            max_tokens=64,  # Generate a chunk at a time
            temperature=0.8,
            stop=["\n\n"],  # Natural stopping points
        )

        children = []
        for cont in continuations:
            child = TreeNode(
                text=node.text + cont,
                parent=node,
                depth=node.depth + 1,
                is_terminal=(len(cont.strip()) == 0 or node.depth + 1 >= self.max_depth),
            )
            children.append(child)
            node.children.append(child)

        return children

    async def _evaluate(self, node: TreeNode) -> float:
        """Score a node using the reward model."""
        return await self.reward.score(node.text)

    def _backpropagate(self, node: TreeNode):
        """Update ancestor scores."""
        current = node.parent
        while current is not None:
            current.visits += 1
            current.score += node.score
            current = current.parent

    def _best_path(self, root: TreeNode) -> str:
        """Extract the best path from root to a leaf."""
        node = root
        while node.children:
            node = max(node.children, key=lambda c: c.score / max(c.visits, 1))
        return node.text
```

### 5.4 KV Cache Management for Tree Search

Tree search creates a branching KV cache structure. Naive implementation would duplicate the entire KV cache for each branch.

**Copy-on-write KV cache.** Use reference-counted KV cache blocks (similar to paged attention in vLLM). When a node branches:

1. Children share the parent's KV cache blocks (read-only).
2. Only new tokens get new KV cache blocks.
3. When a branch is pruned, its unique blocks are freed.

**Memory cost.** If the search tree has $B$ active branches, each with $S_{\text{unique}}$ new tokens beyond the shared prefix:

$$M_{\text{tree}} = M_{\text{shared}} + B \times S_{\text{unique}} \times 2Ld \cdot \text{sizeof(dtype)}$$

vs. naive duplication: $B \times S_{\text{total}} \times 2Ld \cdot \text{sizeof(dtype)}$.

---

## 6. Batching Heterogeneous Agent Requests

### 6.1 The Batching Challenge

In a standard LLM serving system, requests are relatively homogeneous: each needs a prefill followed by decoding. Agentic requests are fundamentally heterogeneous:

```
Request A: [Prefill] -> [Generate 50 tokens] -> [Wait for tool: 2s] ->
           [Prefill new context] -> [Generate 100 tokens] -> Done

Request B: [Prefill] -> [Generate 200 tokens] -> Done

Request C: [Prefill] -> [Generate 20 tokens] -> [Wait for tool: 50ms] ->
           [Generate 20 tokens] -> [Wait for tool: 500ms] ->
           [Generate 20 tokens] -> [Wait for tool: 100ms] ->
           [Generate 50 tokens] -> Done
```

Request A and C are idle during tool execution but still hold KV cache memory. Request B is a standard completion.

### 6.2 Yield-on-Tool Strategy

When an agent request calls a tool, it should yield its GPU resources:

```python
class AgentScheduler:
    """
    Scheduler for heterogeneous agent requests.

    Manages the lifecycle of agent requests that alternate between
    LLM generation and tool execution.
    """
    def __init__(self, llm_engine, tool_dispatcher, max_concurrent: int = 64):
        self.llm = llm_engine
        self.tools = tool_dispatcher
        self.max_concurrent = max_concurrent

        # Request queues
        self.pending_prefill: list = []      # Waiting for prefill
        self.active_decoding: list = []       # Currently generating tokens
        self.waiting_tool: list = []          # Waiting for tool results
        self.completed: list = []             # Done

    async def process_request(self, request):
        """
        Process an agent request through its full lifecycle.

        The request alternates between generation and tool execution
        until the agent produces a final answer or hits limits.
        """
        context = request.initial_context
        total_tokens = 0
        total_cost = 0.0

        for turn in range(request.max_turns):
            # 1. Generate (may produce a tool call or final answer)
            generation = await self.llm.generate(
                context,
                max_tokens=request.max_tokens_per_turn,
                stop=["</tool_call>", "</final_answer>"],
            )
            total_tokens += generation.num_tokens

            # 2. Parse output
            if generation.contains_tool_call:
                tool_name, tool_args = parse_tool_call(generation.text)

                # 3. Yield GPU resources while waiting for tool
                cache_handle = self.llm.pause_and_offload(request.session_id)

                # 4. Execute tool
                tool_result = await self.tools.execute(tool_name, tool_args)

                # 5. Resume GPU resources
                self.llm.restore_cache(request.session_id, cache_handle)

                # 6. Append tool result to context
                context = context + generation.text + format_tool_result(tool_result)

            elif generation.contains_final_answer:
                return {
                    "answer": extract_answer(generation.text),
                    "total_tokens": total_tokens,
                    "total_turns": turn + 1,
                    "total_cost": total_cost,
                }

            else:
                # Model did not produce a structured output; append and continue
                context = context + generation.text

        # Max turns exceeded
        return {"error": "max_turns_exceeded", "total_tokens": total_tokens}
```

### 6.3 Priority-Based Scheduling

Not all agent requests are equal. A scheduling policy should consider:

1. **SLO deadline**: Requests nearing their latency deadline get priority.
2. **Expected remaining cost**: Requests close to completion should be prioritized (avoid wasting work already done).
3. **Request value**: Some requests may have higher business value.

**Multi-level feedback queue:**

```
Priority 0 (highest): Requests in final generation step (close to done)
Priority 1:           Requests just returned from a tool call (need prefill)
Priority 2:           New requests (initial prefill)
Priority 3 (lowest):  Requests that have used >80% of their budget
```

---

## 7. Reliability and Guardrails

### 7.1 Failure Modes

Agentic systems have failure modes absent in standard LLM serving:

| Failure Mode | Description | Mitigation |
|-------------|-------------|------------|
| Infinite loop | Agent repeatedly calls the same tool | Max turns limit, loop detection |
| Cost explosion | Agent makes expensive API calls | Per-request cost budget |
| Hallucinated tool | Agent invents a tool that does not exist | Strict tool name validation |
| Argument injection | Malicious arguments in tool calls | Schema validation, sandboxing |
| Context overflow | Context exceeds model's max length | Summarization, truncation |
| Cascading failure | Tool failure causes agent to spiral | Graceful degradation, retry limits |

### 7.2 Guardrails Implementation

```python
@dataclass
class GuardrailConfig:
    max_turns: int = 50
    max_tokens_total: int = 100_000
    max_cost_dollars: float = 10.0
    max_tool_calls: int = 100
    max_tool_calls_per_type: dict = field(default_factory=lambda: {})
    max_context_tokens: int = 128_000
    timeout_seconds: float = 300.0
    blocked_tools: list[str] = field(default_factory=list)
    require_approval_tools: list[str] = field(default_factory=list)

class GuardrailsEngine:
    """
    Enforces safety and resource limits on agent execution.
    """
    def __init__(self, config: GuardrailConfig):
        self.config = config
        self.turn_count = 0
        self.total_tokens = 0
        self.total_cost = 0.0
        self.tool_call_counts: dict[str, int] = {}
        self.recent_tool_calls: list[tuple[str, dict]] = []

    def check_pre_generation(self, context_tokens: int) -> Optional[str]:
        """Check guardrails before LLM generation. Returns error or None."""
        if self.turn_count >= self.config.max_turns:
            return f"Max turns exceeded ({self.config.max_turns})"

        if self.total_tokens >= self.config.max_tokens_total:
            return f"Max tokens exceeded ({self.config.max_tokens_total})"

        if self.total_cost >= self.config.max_cost_dollars:
            return f"Cost budget exceeded (${self.config.max_cost_dollars})"

        if context_tokens > self.config.max_context_tokens:
            return f"Context too long ({context_tokens} > {self.config.max_context_tokens})"

        return None

    def check_tool_call(self, tool_name: str, arguments: dict) -> Optional[str]:
        """Validate a tool call before execution. Returns error or None."""
        # Blocked tools
        if tool_name in self.config.blocked_tools:
            return f"Tool '{tool_name}' is blocked"

        # Per-type rate limit
        count = self.tool_call_counts.get(tool_name, 0)
        max_count = self.config.max_tool_calls_per_type.get(tool_name, float("inf"))
        if count >= max_count:
            return f"Too many calls to '{tool_name}' ({count})"

        # Total tool call limit
        total_calls = sum(self.tool_call_counts.values())
        if total_calls >= self.config.max_tool_calls:
            return f"Total tool call limit exceeded ({self.config.max_tool_calls})"

        # Loop detection: same tool with same args
        current_call = (tool_name, str(sorted(arguments.items())))
        recent = [(n, a) for n, a in self.recent_tool_calls[-5:]]
        if recent.count(current_call) >= 3:
            return f"Loop detected: '{tool_name}' called 3+ times with same args"

        return None

    def record_generation(self, tokens: int, cost: float):
        """Record a generation step."""
        self.turn_count += 1
        self.total_tokens += tokens
        self.total_cost += cost

    def record_tool_call(self, tool_name: str, arguments: dict):
        """Record a tool call."""
        self.tool_call_counts[tool_name] = self.tool_call_counts.get(tool_name, 0) + 1
        self.recent_tool_calls.append((tool_name, str(sorted(arguments.items()))))
```

---

## 8. Cost and Latency Modeling

### 8.1 Cost Model

The cost of an agentic request is:

$$C_{\text{total}} = C_{\text{LLM}} + C_{\text{tools}} + C_{\text{infra}}$$

**LLM cost:**

$$C_{\text{LLM}} = \sum_{t=1}^{T} \left(n_{\text{input},t} \cdot c_{\text{input}} + n_{\text{output},t} \cdot c_{\text{output}}\right)$$

where $c_{\text{input}}$ and $c_{\text{output}}$ are per-token costs and $T$ is the number of LLM calls (turns).

For a typical agent with 10 turns, growing context, and a model priced at \$3/M input, \$15/M output tokens:

| Turn | Input Tokens | Output Tokens | Turn Cost | Cumulative |
|------|-------------|---------------|-----------|------------|
| 1 | 500 | 200 | $0.0045 | $0.0045 |
| 2 | 1200 | 150 | $0.0059 | $0.0104 |
| 3 | 2000 | 300 | $0.0105 | $0.0209 |
| ... | ... | ... | ... | ... |
| 10 | 8000 | 500 | $0.0315 | $0.1200 |

The cost grows super-linearly because each turn re-reads the full context.

**Prompt caching savings.** With prompt caching (cached input tokens at 10% of full price), the cost of turn $t$ drops to:

$$C_t = n_{\text{cached},t} \cdot 0.1 c_{\text{input}} + n_{\text{new},t} \cdot c_{\text{input}} + n_{\text{output},t} \cdot c_{\text{output}}$$

This reduces the total cost by 40-60% for typical agentic workloads.

### 8.2 Latency Model

End-to-end latency for an agent request:

$$T_{\text{total}} = \sum_{t=1}^{T_{\text{turns}}} \left(T_{\text{prefill},t} + T_{\text{decode},t} + T_{\text{tool},t}\right)$$

where:

- $T_{\text{prefill},t} = n_{\text{new},t} / \text{prefill\_throughput}$ (with cache: only new tokens)
- $T_{\text{decode},t} = n_{\text{output},t} \times \text{TPOT}$
- $T_{\text{tool},t}$ is the wall-clock time for any tool execution in turn $t$

For I/O-intensive tools (web search, database queries), $T_{\text{tool},t}$ often dominates, making LLM optimization less impactful than tool latency optimization.

### 8.3 Optimization Strategies

1. **Parallel tool execution**: When the agent requests multiple tools, execute them concurrently.
2. **Speculative tool prefetch**: If the system can predict likely tool calls, start them before the LLM finishes generating.
3. **Streaming generation**: Begin processing the LLM output (tool call parsing) as tokens stream, rather than waiting for full generation.
4. **Context compression**: Summarize old tool results to prevent context growth.

```python
def compress_agent_context(
    messages: list[dict],
    max_context_tokens: int,
    summarizer_fn: Callable[[str], str],
    tokenizer,
) -> list[dict]:
    """
    Compress agent conversation context to fit within a budget.

    Strategy:
    1. Keep system prompt and last 2 turns intact.
    2. Summarize tool results from older turns.
    3. If still over budget, summarize older reasoning.
    """
    # Count tokens
    total_tokens = sum(len(tokenizer.encode(m["content"])) for m in messages)

    if total_tokens <= max_context_tokens:
        return messages

    # Phase 1: Compress old tool results
    compressed = []
    for i, msg in enumerate(messages):
        is_recent = i >= len(messages) - 4  # Keep last 2 turns (user + assistant)
        is_system = msg.get("role") == "system"

        if is_system or is_recent:
            compressed.append(msg)
        elif msg.get("role") == "tool":
            # Summarize tool result
            summary = summarizer_fn(msg["content"])
            compressed.append({**msg, "content": f"[Summarized] {summary}"})
        else:
            compressed.append(msg)

    # Phase 2: Check if we're within budget
    total_tokens = sum(len(tokenizer.encode(m["content"])) for m in compressed)
    if total_tokens <= max_context_tokens:
        return compressed

    # Phase 3: Drop old turns entirely, keeping summary
    # (Implementation depends on application requirements)
    return compressed
```

---

## 9. Post-Training Systems: RLHF and Alignment Infrastructure

The models powering agentic systems do not emerge from pre-training alone. A multi-stage **post-training pipeline** transforms a base language model into a useful, aligned assistant. Each stage introduces distinct systems challenges.

### 9.1 Post-Training Pipeline Overview

```
Pre-Training  -->  Supervised Fine-Tuning (SFT)  -->  RLHF / DPO  -->  Deployment
  (weeks)              (hours-days)                  (days)           (serving)
```

| Stage | Data | Compute Profile | Systems Novelty |
|-------|------|----------------|-----------------|
| Pre-Training | Trillions of tokens, web crawl | Massive data-parallel + tensor-parallel | Well-studied (Lectures 04-06) |
| SFT | 10K-100K instruction-response pairs | Standard fine-tuning, small data | Minimal -- same as any fine-tune |
| RLHF (PPO) | Human preference comparisons | 3 models + generation loop | High -- described below |
| DPO | Preference pairs (chosen vs. rejected) | 2 models, SFT-like loop | Moderate -- simpler than RLHF |

SFT uses standard fine-tuning infrastructure with no architectural novelty. The systems challenges arise in RLHF and DPO, which require managing multiple large models simultaneously under tight memory budgets.

### 9.2 RLHF Systems Architecture

RLHF with Proximal Policy Optimization (PPO), as described by Ouyang et al. (2022) for InstructGPT, keeps three models in GPU memory simultaneously:

1. **Policy model** (the LLM being trained) -- parameters are updated each step.
2. **Reference model** (a frozen copy of the initial policy) -- used to compute a KL divergence penalty that prevents the policy from drifting too far.
3. **Reward model** (a separate model trained on human preferences) -- scores each generated completion.

**The PPO training loop:**

```
For each batch of prompts:
  1. GENERATE: Policy model autoregressively generates completions  [slow]
  2. SCORE:    Reward model scores each completion                  [fast, batched]
  3. REFERENCE: Reference model computes log-probs for KL penalty  [fast, batched]
  4. ADVANTAGE: Compute per-token advantages from rewards + KL     [CPU/GPU, fast]
  5. UPDATE:   PPO gradient step on the policy model               [standard backward pass]
```

**Memory analysis.** For a 70B-parameter model in FP16 (2 bytes per parameter):

- Policy model: 140 GB
- Reference model: 140 GB (frozen, but must remain in memory for KL computation)
- Reward model: ~140 GB (often the same architecture; sometimes smaller)
- Rollout buffers (generated tokens, log-probs, rewards, advantages): 10-50 GB
- Optimizer states (Adam): 2x policy parameters = 280 GB

Total: **~750 GB** -- requiring 8-10 A100-80GB GPUs at minimum, just for a single training run of a 70B model. Multi-node setups with tensor and pipeline parallelism are standard.

**Compute bottleneck.** The generation phase (step 1) dominates wall-clock time because autoregressive decoding is memory-bandwidth-bound and inherently sequential per token. Scoring and training are batched forward/backward passes, which saturate compute. In practice, generation consumes 60-80% of each RLHF iteration's wall time.

### 9.3 DPO as a Systems Simplification

Direct Preference Optimization (Rafailov et al., 2023) eliminates the reward model and the generation loop entirely. Instead of learning a reward and optimizing against it with RL, DPO directly optimizes the policy using a closed-form loss over preference pairs:

$$\mathcal{L}_{\text{DPO}} = -\log \sigma\!\Big(\beta \big[\log \pi_\theta(y_w|x) - \log \pi_{\text{ref}}(y_w|x)\big] - \beta \big[\log \pi_\theta(y_l|x) - \log \pi_{\text{ref}}(y_l|x)\big]\Big)$$

where $y_w$ is the preferred completion, $y_l$ is the dispreferred completion, and $\beta$ controls the strength of the KL constraint.

**Systems advantages of DPO over RLHF:**

| Property | RLHF (PPO) | DPO |
|----------|-----------|-----|
| Models in memory | 3 (policy + reference + reward) | 2 (policy + reference) |
| Memory for 70B | ~750 GB | ~560 GB |
| Training loop | Generate -> Score -> Advantage -> Update | Forward on pairs -> Backward (standard) |
| Generation during training | Yes (autoregressive, slow) | No |
| Infrastructure | Inference cluster + training cluster | Training cluster only |
| Parallelism | Complex coordination | Standard data parallelism works |

DPO reduces the problem to supervised learning on paired data, which existing distributed training frameworks (DeepSpeed ZeRO, FSDP) handle without modification. The reference model can share weights with the policy using stop-gradient, or it can be offloaded to CPU between forward passes to reduce peak GPU memory.

### 9.4 Online vs. Offline RLHF

Both RLHF and DPO can operate in **offline** or **online** modes, with significant systems implications:

**Offline:** Completions are pre-generated once and stored. Training proceeds over a fixed dataset. This is simpler -- a standard training job -- but the data becomes stale as the policy improves.

**Online:** Each training iteration generates fresh completions from the current policy, scores them, and trains on the result. This yields higher-quality alignment but requires simultaneous inference and training infrastructure.

```
Online RLHF Infrastructure:

+---------------------+        +---------------------+
|  Inference Cluster  |  --->  |  Training Cluster   |
|  (vLLM / TGI)       |        |  (DeepSpeed / FSDP) |
|  Generate rollouts  |        |  PPO / DPO update   |
+---------------------+        +---------------------+
        ^                              |
        |    Updated policy weights    |
        +------------------------------+
        Coordinated via shared storage / NCCL
```

Online training requires that the inference cluster reload updated policy weights after each training step. In practice this coordination uses shared NFS/object storage or direct GPU-to-GPU transfer, and it adds significant engineering complexity compared to offline pipelines.

### 9.5 Systems Challenges Summary

The key systems challenges unique to post-training alignment are:

1. **Multi-model memory management**: Fitting 2-3 copies of a large model on a fixed GPU budget. Techniques include weight sharing, CPU offloading, quantization of the reference/reward models (e.g., INT8 for frozen models), and careful stage-wise scheduling.
2. **Generation-training pipeline coordination**: Online RLHF interleaves slow autoregressive generation with fast gradient updates. Pipelining these stages to overlap generation of batch $N+1$ with training on batch $N$ is critical for throughput.
3. **Reward model serving at scale**: The reward model must score thousands of completions per training step. Batched inference with continuous batching (the same systems from Lecture 07d) applies here.
4. **Data pipeline**: Human preference collection, quality filtering, deduplication, and format conversion into preference pairs. This human-in-the-loop data pipeline is often the true bottleneck in iteration speed.
5. **Iteration speed**: Each RLHF iteration requires a full generate-score-train cycle. For a 70B model generating 256-token completions on a batch of 512 prompts, a single iteration can take 30-60 minutes, making hyperparameter search expensive.

---

## Key Takeaways

1. Agentic systems create workloads fundamentally different from standard LLM serving: multi-turn, heterogeneous latency, growing context, and failure-prone tool interactions.
2. KV cache management for agents benefits from prefix sharing (across sessions with the same system prompt) and inter-turn cache reuse (avoiding re-prefill of unchanged context). Copy-on-write strategies enable efficient tree search.
3. Test-time compute scaling (best-of-N, tree search) offers a systematic tradeoff between compute and output quality. Best-of-N is simple and parallelizable; tree search is more compute-efficient but harder to implement with efficient KV cache sharing.
4. Heterogeneous agent requests require schedulers that yield GPU resources during tool execution and prioritize requests based on SLO deadlines, completion proximity, and cost budgets.
5. Reliability infrastructure (guardrails, retry logic, cost limits, loop detection) is not optional -- it is a critical systems component that prevents runaway costs and cascading failures in production agentic deployments.
6. Post-training alignment (RLHF, DPO) introduces multi-model memory management as a first-order systems problem. RLHF requires three simultaneous models and an autoregressive generation loop that dominates wall-clock time; DPO simplifies this to two models and a standard supervised training loop, at the cost of requiring offline preference data.

---

## Further Reading

1. **Yao, S., et al.** (2023). "ReAct: Synergizing Reasoning and Acting in Language Models." *ICLR 2023.*
2. **Schick, T., et al.** (2023). "Toolformer: Language Models Can Teach Themselves to Use Tools." *NeurIPS 2023.*
3. **Snell, C., Lee, J., Xu, K., and Kumar, A.** (2024). "Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters." *arXiv:2408.03314.*
4. **Brown, B., et al.** (2024). "Large Language Monkeys: Scaling Inference Compute with Repeated Sampling." *arXiv:2407.21787.*
5. **Zheng, L., et al.** (2024). "SGLang: Efficient Execution of Structured Language Model Programs." *arXiv:2312.07104.*
6. **Kwon, W., et al.** (2023). "Efficient Memory Management for Large Language Model Serving with PagedAttention." *SOSP 2023.*
7. **Wang, X., et al.** (2024). "Executable Code Actions Elicit Better LLM Agents." *ICML 2024.*
8. **Ouyang, L., et al.** (2022). "Training language models to follow instructions with human feedback." *NeurIPS 2022.*
9. **Rafailov, R., Sharma, A., Mitchell, E., Ermon, S., Manning, C.D., and Finn, C.** (2023). "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." *NeurIPS 2023.*
10. **Touvron, H., et al.** (2023). "Llama 2: Open Foundation and Fine-Tuned Chat Models." *arXiv:2307.09288.*
