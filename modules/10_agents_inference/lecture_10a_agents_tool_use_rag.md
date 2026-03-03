# Lecture 10a: LLM Agents, Tool Use, and Retrieval-Augmented Generation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formalize** the LLM agent loop as a partially observable Markov decision process (POMDP) with the observe-think-act cycle.
2. **Derive** the ReAct framework and explain why interleaving reasoning and acting outperforms pure reasoning or pure acting.
3. **Implement** tool use via function calling with structured output schemas.
4. **Construct** a complete Retrieval-Augmented Generation (RAG) pipeline from first principles.
5. **Analyze** dense retrieval using dual-encoder architectures and contrastive training objectives.
6. **Evaluate** approximate nearest neighbor algorithms (HNSW, IVF) in terms of recall-latency tradeoffs.
7. **Design** chunking and re-ranking strategies for production RAG systems.

---

## 2. Motivation and Context

### 2.1 Why Agents?

Large language models, despite their remarkable capabilities, suffer from fundamental limitations when used as stateless text-in-text-out systems:

- **Knowledge cutoff**: parametric knowledge is frozen at training time.
- **No grounding**: no access to real-time data, APIs, or computation tools.
- **Hallucination**: tendency to generate plausible but factually incorrect statements.
- **No persistent state**: each prompt is processed independently (in the simplest deployment).

The **agent paradigm** addresses these limitations by embedding the LLM in a loop where it can observe the environment, reason about what to do, act (e.g., call tools, retrieve documents), and incorporate the results back into its reasoning.

### 2.2 Historical Arc

The idea of language-model-based agents draws from classical AI planning (STRIPS, PDDL), cognitive architectures (SOAR, ACT-R), and reinforcement learning. The modern incarnation was catalyzed by:

- **Toolformer** (Schick et al., 2023): LLMs can learn to use tools via self-supervised training.
- **ReAct** (Yao et al., 2023): interleaving reasoning traces and actions.
- **RAG** (Lewis et al., 2020): augmenting generation with retrieved knowledge.

### 2.3 The Bigger Picture

Agents represent a shift from "LLM as oracle" to "LLM as controller." The LLM becomes the reasoning engine in a larger system that includes memory, tools, and environment interaction. This is arguably the most important practical paradigm for deploying LLMs in real-world applications.

---

## 3. Core Theory

### 3.1 The Agent Loop as a POMDP

We formalize an LLM agent as operating in a Partially Observable Markov Decision Process (POMDP):

**Definition 3.1 (Agent POMDP).** An LLM agent is a tuple $(\mathcal{S}, \mathcal{A}, \mathcal{O}, T, O, R, \gamma)$ where:

- $\mathcal{S}$: state space (full environment state, e.g., database contents, web pages, file system)
- $\mathcal{A}$: action space (tool calls, text generation, retrieval queries)
- $\mathcal{O}$: observation space (tool outputs, retrieved documents, user messages)
- $T: \mathcal{S} \times \mathcal{A} \to \Delta(\mathcal{S})$: transition function
- $O: \mathcal{S} \times \mathcal{A} \to \Delta(\mathcal{O})$: observation function
- $R: \mathcal{S} \times \mathcal{A} \to \mathbb{R}$: reward function
- $\gamma \in [0, 1)$: discount factor

The agent maintains a **belief state** $b_t \in \Delta(\mathcal{S})$, which in the LLM case is implicitly represented by the context window (the sequence of all prior observations and actions).

**The Observe-Think-Act Loop:**

At each step $t$:

1. **Observe**: receive observation $o_t \sim O(s_t, a_{t-1})$
2. **Think**: update belief $b_t = \text{Update}(b_{t-1}, a_{t-1}, o_t)$ and select action $a_t \sim \pi(a | b_t)$
3. **Act**: execute $a_t$ in the environment, transition $s_{t+1} \sim T(s_t, a_t)$

For an LLM agent, the belief update is performed implicitly by appending the new observation to the context, and the policy $\pi$ is the LLM's next-token generation conditioned on the full context.

**Proposition 3.2 (Context Window as Sufficient Statistic).** If the context window $c_t = (o_1, a_1, o_2, a_2, \ldots, o_t)$ contains all past observations and actions, then $c_t$ is a sufficient statistic for the belief state $b_t$ in the sense that:

$$\pi^*(a | b_t) = \pi^*(a | c_t)$$

for any optimal policy $\pi^*$.

*Proof.* By the definition of the POMDP belief update, $b_t$ is a deterministic function of $b_0$ and the history $(a_1, o_1, \ldots, a_{t-1}, o_t)$. Since $b_0$ is common knowledge (the prior), $c_t$ determines $b_t$ uniquely. Therefore any function of $b_t$ is also a function of $c_t$, and in particular $\pi^*(a | b_t) = \pi^*(a | c_t)$. $\square$

**Remark.** In practice, the finite context window means information is lost for very long trajectories. This motivates external memory mechanisms.

### 3.2 The ReAct Framework

ReAct (Yao et al., 2023) formalizes the interleaving of reasoning and acting. The key insight is that pure chain-of-thought reasoning (without actions) cannot access external information, while pure acting (without explicit reasoning) makes the agent's decisions opaque and harder to correct.

**Definition 3.3 (ReAct Trajectory).** A ReAct trajectory is a sequence:

$$\tau = (q, t_1, a_1, o_1, t_2, a_2, o_2, \ldots, t_n, a_n, o_n)$$

where:

- $q$ is the initial query
- $t_i$ is a **thought** (free-form reasoning text)
- $a_i$ is an **action** (a tool call or final answer)
- $o_i$ is an **observation** (the result of the action)

The LLM generates each $(t_i, a_i)$ pair conditioned on the full history:

$$p(t_i, a_i | q, t_1, a_1, o_1, \ldots, o_{i-1})$$

**Theorem 3.4 (ReAct Dominance, informal).** Let $\mathcal{P}_{\text{reason}}$ be the set of problems solvable by pure chain-of-thought (CoT) and $\mathcal{P}_{\text{act}}$ be the set solvable by pure acting (no intermediate reasoning). Then the set of problems solvable by ReAct satisfies:

$$\mathcal{P}_{\text{reason}} \cup \mathcal{P}_{\text{act}} \subseteq \mathcal{P}_{\text{ReAct}}$$

*Argument.* ReAct subsumes both: if no actions are needed, the agent can reason without acting (reducing to CoT). If no reasoning is needed, the agent can act without thinking (reducing to pure acting). The strict inclusion follows from problems that require both reasoning and external information access. $\square$

### 3.3 Tool Use: Function Calling

Tool use extends the agent's action space with structured function calls.

**Definition 3.5 (Tool Schema).** A tool is defined by a tuple $\mathcal{T} = (\text{name}, \text{desc}, \sigma_{\text{in}}, \sigma_{\text{out}}, f)$ where:

- $\text{name}$: string identifier
- $\text{desc}$: natural language description
- $\sigma_{\text{in}}$: input schema (e.g., JSON Schema)
- $\sigma_{\text{out}}$: output schema
- $f: \text{Dom}(\sigma_{\text{in}}) \to \text{Dom}(\sigma_{\text{out}})$: the actual function

The LLM must generate a structured output conforming to $\sigma_{\text{in}}$:

$$a_t = \{\texttt{"tool"}: \text{name}, \texttt{"args"}: \text{args}\} \quad \text{where args} \in \text{Dom}(\sigma_{\text{in}})$$

**Constrained Decoding for Structured Outputs.** To guarantee the output conforms to a schema, we can use constrained decoding. Given a context-free grammar $G$ derived from the JSON schema, at each decoding step we mask the logits of tokens that would lead to an invalid parse:

$$p'(x_t | x_{<t}) = \frac{p(x_t | x_{<t}) \cdot \mathbb{1}[x_{<t} \cdot x_t \in \text{Prefix}(G)]}{\sum_{x'} p(x' | x_{<t}) \cdot \mathbb{1}[x_{<t} \cdot x' \in \text{Prefix}(G)]}$$

where $\text{Prefix}(G)$ is the set of valid prefixes of strings in $L(G)$.

### 3.4 Retrieval-Augmented Generation (RAG)

RAG (Lewis et al., 2020) addresses the knowledge limitation of LLMs by retrieving relevant documents before generation.

**Definition 3.6 (RAG Pipeline).** Given a query $q$, a document corpus $\mathcal{D} = \{d_1, \ldots, d_N\}$, a retriever $R$, and a generator $G$:

1. **Retrieve**: $\mathcal{D}_q = R(q, \mathcal{D}) = \text{top-}k_{d \in \mathcal{D}} \; \text{sim}(q, d)$
2. **Generate**: $y = G(q, \mathcal{D}_q) \sim p_G(y | q, d_1, \ldots, d_k)$

**Theorem 3.7 (RAG as Marginalization).** The RAG generation probability can be written as a marginalization over retrieved documents:

$$p_{\text{RAG}}(y | q) = \sum_{d \in \mathcal{D}} p_R(d | q) \cdot p_G(y | q, d)$$

In practice, we approximate this by restricting to the top-$k$ documents:

$$p_{\text{RAG}}(y | q) \approx \sum_{d \in \text{top-}k} \frac{\exp(\text{sim}(q, d))}{\sum_{d' \in \text{top-}k} \exp(\text{sim}(q, d'))} \cdot p_G(y | q, d)$$

*Proof.* This follows from the law of total probability. We treat the document $d$ as a latent variable:

$$p(y | q) = \sum_{d \in \mathcal{D}} p(y, d | q) = \sum_{d \in \mathcal{D}} p(d | q) p(y | q, d)$$

Identifying $p(d|q)$ with the retriever distribution $p_R(d|q)$ and $p(y|q,d)$ with the generator $p_G(y|q,d)$ gives the result. The top-$k$ approximation replaces the sum over $\mathcal{D}$ with a sum over the $k$ highest-scoring documents under $p_R$. $\square$

### 3.5 Dense Retrieval: Dual-Encoder Architecture

**Definition 3.8 (Dual Encoder).** A dual encoder consists of two encoders:

- Query encoder: $E_q: \mathcal{Q} \to \mathbb{R}^d$
- Document encoder: $E_d: \mathcal{D} \to \mathbb{R}^d$

The similarity is computed as the inner product (or cosine similarity):

$$\text{sim}(q, d) = E_q(q)^\top E_d(d)$$

**Contrastive Training Objective.** Given a batch of $B$ query-document pairs $\{(q_i, d_i^+)\}_{i=1}^B$ where $d_i^+$ is the positive (relevant) document for query $q_i$, the InfoNCE loss is:

$$\mathcal{L}_{\text{InfoNCE}} = -\frac{1}{B} \sum_{i=1}^{B} \log \frac{\exp(\text{sim}(q_i, d_i^+) / \tau)}{\sum_{j=1}^{B} \exp(\text{sim}(q_i, d_j^+) / \tau)}$$

where $\tau > 0$ is a temperature parameter and the negatives are the other documents in the batch (in-batch negatives).

**Proposition 3.9 (InfoNCE and Mutual Information).** The InfoNCE loss provides a lower bound on the mutual information $I(Q; D)$ between queries and relevant documents:

$$I(Q; D) \geq \log B - \mathcal{L}_{\text{InfoNCE}}$$

*Proof.* Following Oord et al. (2018), let $f(q, d) = \exp(\text{sim}(q, d)/\tau)$. The InfoNCE loss estimates:

$$\mathcal{L} = -\mathbb{E}\left[\log \frac{f(q, d^+)}{f(q, d^+) + \sum_{j \neq i} f(q, d_j^-)}\right]$$

By Jensen's inequality and properties of the KL divergence, this satisfies $\mathcal{L} \geq \log B - I(Q; D)$, giving us $I(Q; D) \geq \log B - \mathcal{L}$. $\square$

**Hard Negative Mining.** Performance improves significantly when negatives are not just random documents but are "hard" negatives that are similar but not relevant. Common strategies:

- BM25 negatives: documents that match lexically but are not semantically relevant
- In-batch negatives with cross-GPU sharing (Qu et al., 2021)
- Iterative mining: use the current model to find hard negatives, retrain

### 3.6 Approximate Nearest Neighbor Search

After encoding all documents, we need to find the $k$ most similar document vectors efficiently. Exact search is $O(Nd)$ per query, which is prohibitive for large $N$.

**Definition 3.10 ($(c, r)$-Approximate Nearest Neighbor).** Given a dataset $\mathcal{X} \subset \mathbb{R}^d$, a query $q \in \mathbb{R}^d$, distance function $\text{dist}$, approximation factor $c > 1$, and distance threshold $r > 0$, the $(c,r)$-ANN problem is: if there exists $x^* \in \mathcal{X}$ with $\text{dist}(q, x^*) \leq r$, return $x \in \mathcal{X}$ with $\text{dist}(q, x) \leq cr$.

**HNSW (Hierarchical Navigable Small World Graphs).** HNSW (Malkov & Yashunin, 2020) builds a multi-layer graph where:

- Layer 0 contains all $N$ points
- Layer $\ell$ contains each point with probability $e^{-\ell / m_L}$ where $m_L$ is a normalization factor
- Each layer is a navigable small-world graph with edges connecting nearby points

Search proceeds by greedy traversal starting from the top layer:

$$\textbf{Algorithm: HNSW Search}$$
$$\text{Input: query } q, \text{ entry point } e, \text{ number of layers } L$$
$$\text{For } \ell = L \text{ down to } 1:$$
$$\quad \text{Greedily traverse layer } \ell \text{ from } e \text{ toward } q$$
$$\quad e \leftarrow \text{nearest neighbor found in layer } \ell$$
$$\text{At layer 0, do beam search with beam width } ef$$
$$\text{Return top-}k \text{ from beam}$$

**Complexity:**

- Build: $O(N \log N)$ time, $O(Nd + NM)$ space where $M$ is the max edges per node
- Query: $O(\log N)$ expected time with high probability

**IVF (Inverted File Index).** IVF partitions the vector space into $C$ Voronoi cells using $k$-means:

1. **Build**: Run $k$-means on the dataset to get $C$ centroids $\{\mu_1, \ldots, \mu_C\}$. Assign each vector to its nearest centroid.
2. **Query**: Find the $n_{\text{probe}}$ nearest centroids to $q$. Search only vectors assigned to those cells.

**Complexity:**

- Build: $O(NdC \cdot \text{iters})$ for $k$-means
- Query: $O(Cd + n_{\text{probe}} \cdot N/C \cdot d)$

**Product Quantization (PQ).** For memory efficiency, split each $d$-dimensional vector into $M$ sub-vectors of dimension $d/M$, and quantize each sub-vector independently with a codebook of size $K$:

$$\hat{x} = [q_1(x_1), q_2(x_2), \ldots, q_M(x_M)]$$

Storage per vector: $M \lceil \log_2 K \rceil$ bits instead of $32d$ bits.

### 3.7 Chunking Strategies

Documents must be split into chunks before embedding. This is a critical design decision.

**Fixed-size chunking.** Split every $L$ tokens with overlap $O$:

- Chunk $i$: tokens $[i(L-O), i(L-O) + L)$
- Simple but may split semantic units

**Recursive/semantic chunking.** Split at natural boundaries (paragraphs, sections) then recursively split large chunks:

- Preserves semantic coherence
- Variable chunk sizes require careful handling

**Proposition 3.11 (Retrieval Precision-Recall Tradeoff with Chunk Size).** Let $L$ be the chunk length. As $L$ increases:

- **Recall** tends to increase: larger chunks are more likely to contain the answer.
- **Precision** tends to decrease: larger chunks contain more irrelevant context.
- **Embedding quality** tends to decrease: embedding models have finite capacity and longer texts dilute the representation.

The optimal $L$ depends on the embedding model's effective context length and the downstream generator's ability to extract relevant information from noisy context.

### 3.8 Re-ranking

Two-stage retrieval uses a lightweight first-stage retriever followed by a more powerful re-ranker.

**Cross-Encoder Re-ranker.** Unlike the dual encoder which encodes $q$ and $d$ independently, a cross-encoder processes the concatenation:

$$\text{score}(q, d) = \text{MLP}(\text{CLS}(\text{Encoder}([q; \text{SEP}; d])))$$

This allows full cross-attention between $q$ and $d$, yielding much higher accuracy but $O(N)$ cost per query (hence the two-stage approach: retrieve $k$ candidates with dual encoder in $O(\log N)$, re-rank $k$ candidates with cross-encoder in $O(k)$).

**Proposition 3.12 (Re-ranking Improves Recall@k).** If the cross-encoder has strictly higher ranking quality than the dual encoder (in terms of NDCG), then for any $k' < k$, selecting the top $k'$ from a re-ranked set of $k$ candidates achieves higher recall than selecting top $k'$ from the dual encoder's ranking.

*Proof.* Let $\sigma$ be the dual-encoder ranking and $\sigma'$ the cross-encoder ranking of the $k$ candidates. If the cross-encoder has higher NDCG, then the relevant documents are ranked higher under $\sigma'$. Therefore $|\text{Rel} \cap \text{top}_{k'}(\sigma')| \geq |\text{Rel} \cap \text{top}_{k'}(\sigma)|$ in expectation. $\square$

---

## 4. Algorithmic Derivation

### 4.1 ReAct Agent Algorithm

```
Algorithm: ReAct Agent
Input: query q, tools T = {T_1, ..., T_m}, max_steps K
Output: answer a

context ← [system_prompt, tool_descriptions(T), q]
for step = 1 to K:
    // Generate thought + action
    (thought, action) ← LLM(context)          // O(|context| * d_model)
    context.append(thought, action)

    if action.type == "final_answer":
        return action.content

    // Execute tool
    tool ← lookup(action.tool_name, T)
    observation ← tool.execute(action.args)     // O(tool-dependent)
    context.append(observation)

return "Max steps reached, no answer found"
```

**Complexity per step:** $O(n \cdot d)$ where $n$ is context length and $d$ is model dimension. Total: $O(K \cdot n_{\max} \cdot d)$.

### 4.2 RAG Pipeline Algorithm

```
Algorithm: RAG Pipeline
Input: query q, corpus D = {d_1, ..., d_N}, embedding model E, generator G
Hyperparameters: chunk_size L, overlap O, top_k k, top_k_rerank k'

// Offline: Indexing (done once)
chunks ← []
for each document d in D:
    chunks.extend(chunk(d, L, O))              // O(|D| * avg_doc_len / L)
embeddings ← E(chunks)                         // O(|chunks| * d * seq_len)
index ← BuildHNSW(embeddings)                  // O(|chunks| * log(|chunks|))

// Online: Query
q_embed ← E_q(q)                               // O(d * seq_len)
candidates ← index.search(q_embed, k)          // O(log(|chunks|) * d)

// Re-rank
scores ← CrossEncoder(q, candidates)           // O(k * seq_len^2 * d)
top_chunks ← top_k'(candidates, scores)

// Generate
prompt ← format(q, top_chunks)
answer ← G(prompt)                             // O(|prompt| * d_model)

return answer
```

### 4.3 Dense Retrieval Training Algorithm

```
Algorithm: Contrastive Training for Dense Retrieval
Input: training pairs {(q_i, d_i^+)}, negative mining strategy, epochs E
Hyperparameters: batch_size B, temperature τ, learning rate η

Initialize query encoder E_q, document encoder E_d

for epoch = 1 to E:
    for each batch {(q_i, d_i^+)}_{i=1}^B:
        // Encode
        Q ← E_q([q_1, ..., q_B])           // Shape: [B, d]
        D ← E_d([d_1^+, ..., d_B^+])       // Shape: [B, d]

        // Compute similarity matrix
        S ← (Q @ D^T) / τ                   // Shape: [B, B]

        // InfoNCE loss (labels are diagonal)
        labels ← [0, 1, ..., B-1]
        loss ← CrossEntropy(S, labels)

        // Update
        loss.backward()
        optimizer.step()
```

---

## 5. PyTorch Implementation

### 5.1 ReAct Agent

```python
import json
import re
from dataclasses import dataclass, field
from typing import Callable, Optional

@dataclass
class Tool:
    name: str
    description: str
    parameters: dict           # JSON Schema for parameters
    function: Callable         # Actual implementation

@dataclass
class AgentStep:
    thought: str
    action_type: str           # "tool_call" or "final_answer"
    action_name: Optional[str] = None
    action_args: Optional[dict] = None
    observation: Optional[str] = None

class ReActAgent:
    """
    ReAct agent implementing the observe-think-act loop.

    The agent maintains a conversation context and iteratively:
    1. Generates a thought (reasoning trace)
    2. Decides on an action (tool call or final answer)
    3. Observes the result
    """
    def __init__(
        self,
        llm: Callable,            # Function: str -> str
        tools: list[Tool],
        max_steps: int = 10,
        system_prompt: str = "",
    ):
        self.llm = llm
        self.tools = {t.name: t for t in tools}
        self.max_steps = max_steps
        self.system_prompt = system_prompt
        self.history: list[AgentStep] = []

    def _build_tool_description(self) -> str:
        """Format tool descriptions for the system prompt."""
        descs = []
        for name, tool in self.tools.items():
            params_str = json.dumps(tool.parameters, indent=2)
            descs.append(
                f"Tool: {name}\n"
                f"Description: {tool.description}\n"
                f"Parameters: {params_str}"
            )
        return "\n\n".join(descs)

    def _build_prompt(self, query: str) -> str:
        """Build the full prompt including history."""
        prompt = (
            f"{self.system_prompt}\n\n"
            f"Available Tools:\n{self._build_tool_description()}\n\n"
            f"Format your response as:\n"
            f"Thought: <your reasoning>\n"
            f"Action: <tool_name>({{\"param\": \"value\"}})\n"
            f"  OR\n"
            f"Action: FINISH({{\"answer\": \"your answer\"}})\n\n"
            f"Query: {query}\n\n"
        )

        for step in self.history:
            prompt += f"Thought: {step.thought}\n"
            if step.action_type == "tool_call":
                prompt += (
                    f"Action: {step.action_name}"
                    f"({json.dumps(step.action_args)})\n"
                    f"Observation: {step.observation}\n\n"
                )
            else:
                prompt += f"Action: FINISH({json.dumps(step.action_args)})\n"

        return prompt

    def _parse_response(self, response: str) -> AgentStep:
        """Parse LLM response into thought + action."""
        # Extract thought
        thought_match = re.search(r"Thought:\s*(.+?)(?=\nAction:)", response, re.DOTALL)
        thought = thought_match.group(1).strip() if thought_match else ""

        # Extract action
        action_match = re.search(r"Action:\s*(\w+)\((.+)\)", response, re.DOTALL)
        if not action_match:
            raise ValueError(f"Could not parse action from: {response}")

        action_name = action_match.group(1)
        action_args_str = action_match.group(2).strip()
        action_args = json.loads(action_args_str)

        if action_name == "FINISH":
            return AgentStep(
                thought=thought,
                action_type="final_answer",
                action_args=action_args,
            )
        else:
            return AgentStep(
                thought=thought,
                action_type="tool_call",
                action_name=action_name,
                action_args=action_args,
            )

    def _execute_tool(self, step: AgentStep) -> str:
        """Execute a tool call and return the observation."""
        tool = self.tools.get(step.action_name)
        if tool is None:
            return f"Error: Unknown tool '{step.action_name}'"
        try:
            result = tool.function(**step.action_args)
            return str(result)
        except Exception as e:
            return f"Error executing {step.action_name}: {e}"

    def run(self, query: str) -> str:
        """
        Run the agent loop.

        Args:
            query: User's question or task

        Returns:
            The agent's final answer
        """
        self.history = []

        for step_num in range(self.max_steps):
            # Build prompt with full history
            prompt = self._build_prompt(query)             # O(history_len)

            # Generate thought + action
            response = self.llm(prompt)                    # O(context_len * d)

            # Parse
            step = self._parse_response(response)

            if step.action_type == "final_answer":
                self.history.append(step)
                return step.action_args.get("answer", "")

            # Execute tool
            observation = self._execute_tool(step)         # O(tool-dependent)
            step.observation = observation
            self.history.append(step)

        return "Max steps reached without finding an answer."

# --- Example tools ---

def calculator(expression: str) -> float:
    """Evaluate a mathematical expression."""
    # In production, use a proper math parser
    allowed_names = {"__builtins__": {}}
    import math
    allowed_names.update({k: getattr(math, k) for k in dir(math) if not k.startswith("_")})
    return eval(expression, allowed_names)

def search(query: str) -> str:
    """Simulate a web search (placeholder)."""
    return f"Search results for '{query}': [simulated results]"

tools = [
    Tool(
        name="calculator",
        description="Evaluate a mathematical expression",
        parameters={"expression": {"type": "string", "description": "Math expression"}},
        function=calculator,
    ),
    Tool(
        name="search",
        description="Search the web for information",
        parameters={"query": {"type": "string", "description": "Search query"}},
        function=search,
    ),
]
```

### 5.2 RAG Pipeline

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from dataclasses import dataclass
from typing import Optional

# ============================================================
# Dense Retriever: Dual Encoder with Contrastive Training
# ============================================================

class DualEncoder(nn.Module):
    """
    Dual encoder for dense retrieval.
    Uses a shared or separate transformer backbone for queries and documents.

    Architecture:
        query  -> Encoder_q -> mean pool -> project -> normalize -> q_embed  [B, d]
        doc    -> Encoder_d -> mean pool -> project -> normalize -> d_embed  [B, d]
        score  = q_embed @ d_embed^T / tau                                   [B, B]
    """
    def __init__(
        self,
        vocab_size: int = 30522,
        d_model: int = 768,
        n_heads: int = 12,
        n_layers: int = 6,
        d_proj: int = 128,
        max_len: int = 512,
        shared_encoder: bool = False,
    ):
        super().__init__()

        self.d_proj = d_proj

        # Token + position embeddings
        self.token_embed = nn.Embedding(vocab_size, d_model)   # [V, d_model]
        self.pos_embed = nn.Embedding(max_len, d_model)        # [L, d_model]

        # Transformer encoder(s)
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=4 * d_model,
            batch_first=True,
        )
        self.query_encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)

        if shared_encoder:
            self.doc_encoder = self.query_encoder
        else:
            doc_layer = nn.TransformerEncoderLayer(
                d_model=d_model,
                nhead=n_heads,
                dim_feedforward=4 * d_model,
                batch_first=True,
            )
            self.doc_encoder = nn.TransformerEncoder(doc_layer, num_layers=n_layers)

        # Projection heads
        self.query_proj = nn.Linear(d_model, d_proj)           # [d_model, d_proj]
        self.doc_proj = nn.Linear(d_model, d_proj)             # [d_model, d_proj]

    def _encode(
        self,
        input_ids: torch.Tensor,          # [B, L]
        attention_mask: torch.Tensor,      # [B, L]
        encoder: nn.TransformerEncoder,
        projector: nn.Linear,
    ) -> torch.Tensor:                     # [B, d_proj]
        B, L = input_ids.shape

        positions = torch.arange(L, device=input_ids.device)  # [L]
        x = self.token_embed(input_ids) + self.pos_embed(positions)  # [B, L, d_model]

        # Transformer expects src_key_padding_mask: True = ignore
        padding_mask = ~attention_mask.bool()                  # [B, L]
        x = encoder(x, src_key_padding_mask=padding_mask)     # [B, L, d_model]

        # Mean pooling over non-padding tokens
        mask_expanded = attention_mask.unsqueeze(-1).float()   # [B, L, 1]
        pooled = (x * mask_expanded).sum(dim=1) / mask_expanded.sum(dim=1).clamp(min=1e-9)  # [B, d_model]

        # Project and normalize
        projected = projector(pooled)                          # [B, d_proj]
        normalized = F.normalize(projected, p=2, dim=-1)       # [B, d_proj]

        return normalized

    def encode_queries(
        self,
        input_ids: torch.Tensor,          # [B, L_q]
        attention_mask: torch.Tensor,      # [B, L_q]
    ) -> torch.Tensor:                     # [B, d_proj]
        return self._encode(input_ids, attention_mask, self.query_encoder, self.query_proj)

    def encode_documents(
        self,
        input_ids: torch.Tensor,          # [B, L_d]
        attention_mask: torch.Tensor,      # [B, L_d]
    ) -> torch.Tensor:                     # [B, d_proj]
        return self._encode(input_ids, attention_mask, self.doc_encoder, self.doc_proj)

    def forward(
        self,
        query_ids: torch.Tensor,          # [B, L_q]
        query_mask: torch.Tensor,         # [B, L_q]
        doc_ids: torch.Tensor,            # [B, L_d]
        doc_mask: torch.Tensor,           # [B, L_d]
        temperature: float = 0.05,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Compute InfoNCE loss with in-batch negatives.

        Returns:
            loss: scalar InfoNCE loss
            similarity: [B, B] similarity matrix
        """
        q_embed = self.encode_queries(query_ids, query_mask)    # [B, d_proj]
        d_embed = self.encode_documents(doc_ids, doc_mask)      # [B, d_proj]

        # Similarity matrix
        similarity = q_embed @ d_embed.T / temperature          # [B, B]

        # Labels: diagonal (each query matches its own document)
        labels = torch.arange(q_embed.size(0), device=q_embed.device)  # [B]

        # Symmetric InfoNCE
        loss_qd = F.cross_entropy(similarity, labels)           # scalar
        loss_dq = F.cross_entropy(similarity.T, labels)         # scalar
        loss = (loss_qd + loss_dq) / 2

        return loss, similarity

# ============================================================
# Chunking
# ============================================================

@dataclass
class Chunk:
    text: str
    doc_id: str
    chunk_id: int
    start_char: int
    end_char: int

def chunk_document(
    text: str,
    doc_id: str,
    chunk_size: int = 256,       # tokens (approximated by words here)
    chunk_overlap: int = 64,
) -> list[Chunk]:
    """
    Split document into overlapping chunks.

    Complexity: O(|text| / (chunk_size - chunk_overlap))
    """
    words = text.split()
    chunks = []
    stride = chunk_size - chunk_overlap

    for i, start in enumerate(range(0, len(words), stride)):
        end = min(start + chunk_size, len(words))
        chunk_text = " ".join(words[start:end])

        # Approximate character positions
        start_char = len(" ".join(words[:start])) + (1 if start > 0 else 0)
        end_char = start_char + len(chunk_text)

        chunks.append(Chunk(
            text=chunk_text,
            doc_id=doc_id,
            chunk_id=i,
            start_char=start_char,
            end_char=end_char,
        ))

        if end >= len(words):
            break

    return chunks

# ============================================================
# Vector Index (simplified HNSW-like structure)
# ============================================================

class FlatIndex:
    """
    Flat (exact) vector index for demonstration.
    In production, use FAISS, Annoy, or a vector database.

    Build: O(N * d) to store
    Query: O(N * d) per query (brute force)
    """
    def __init__(self, dim: int):
        self.dim = dim
        self.vectors: Optional[torch.Tensor] = None   # [N, d]
        self.metadata: list[Chunk] = []

    def add(self, vectors: torch.Tensor, chunks: list[Chunk]):
        """Add vectors to the index. vectors: [M, d]"""
        if self.vectors is None:
            self.vectors = vectors
        else:
            self.vectors = torch.cat([self.vectors, vectors], dim=0)
        self.metadata.extend(chunks)

    def search(
        self,
        query: torch.Tensor,       # [1, d] or [Q, d]
        k: int = 5,
    ) -> tuple[torch.Tensor, list[list[Chunk]]]:
        """
        Find top-k nearest neighbors.

        Returns:
            scores: [Q, k] similarity scores
            chunks: list of Q lists of k Chunk objects
        """
        if query.dim() == 1:
            query = query.unsqueeze(0)              # [1, d]

        # Cosine similarity (vectors are already normalized)
        scores = query @ self.vectors.T             # [Q, N]

        topk_scores, topk_indices = scores.topk(k, dim=-1)  # [Q, k]

        results = []
        for q_idx in range(query.size(0)):
            q_chunks = [self.metadata[i] for i in topk_indices[q_idx].tolist()]
            results.append(q_chunks)

        return topk_scores, results

# ============================================================
# Cross-Encoder Re-ranker
# ============================================================

class CrossEncoderReranker(nn.Module):
    """
    Cross-encoder that processes query-document pairs jointly.

    Input: [CLS] query [SEP] document [SEP]
    Output: relevance score (scalar)

    Complexity: O(k * (L_q + L_d)^2 * d) for re-ranking k candidates
    """
    def __init__(
        self,
        vocab_size: int = 30522,
        d_model: int = 768,
        n_heads: int = 12,
        n_layers: int = 6,
        max_len: int = 512,
    ):
        super().__init__()
        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed = nn.Embedding(max_len, d_model)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads,
            dim_feedforward=4 * d_model, batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)
        self.classifier = nn.Linear(d_model, 1)

    def forward(
        self,
        input_ids: torch.Tensor,       # [B, L] (query [SEP] doc)
        attention_mask: torch.Tensor,   # [B, L]
    ) -> torch.Tensor:                  # [B]
        B, L = input_ids.shape
        positions = torch.arange(L, device=input_ids.device)
        x = self.token_embed(input_ids) + self.pos_embed(positions)   # [B, L, d]

        padding_mask = ~attention_mask.bool()
        x = self.encoder(x, src_key_padding_mask=padding_mask)        # [B, L, d]

        # Use CLS token (position 0)
        cls_output = x[:, 0, :]                                       # [B, d]
        score = self.classifier(cls_output).squeeze(-1)               # [B]
        return score

# ============================================================
# Full RAG Pipeline
# ============================================================

class RAGPipeline:
    """
    Complete RAG pipeline: chunk -> embed -> index -> retrieve -> rerank -> generate.
    """
    def __init__(
        self,
        encoder: DualEncoder,
        generator: Callable,        # Function: (query, contexts) -> answer
        reranker: Optional[CrossEncoderReranker] = None,
        chunk_size: int = 256,
        chunk_overlap: int = 64,
        top_k_retrieve: int = 20,
        top_k_rerank: int = 5,
    ):
        self.encoder = encoder
        self.generator = generator
        self.reranker = reranker
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.top_k_retrieve = top_k_retrieve
        self.top_k_rerank = top_k_rerank
        self.index = FlatIndex(dim=encoder.d_proj)

    @torch.no_grad()
    def index_documents(
        self,
        documents: list[tuple[str, str]],  # List of (doc_id, text)
        tokenizer: Callable,                # Function: str -> (ids, mask)
        batch_size: int = 32,
    ):
        """
        Chunk, embed, and index all documents.

        Complexity: O(N_chunks * d * L) for embedding
        """
        all_chunks = []
        for doc_id, text in documents:
            chunks = chunk_document(text, doc_id, self.chunk_size, self.chunk_overlap)
            all_chunks.extend(chunks)

        # Embed in batches
        for i in range(0, len(all_chunks), batch_size):
            batch_chunks = all_chunks[i:i + batch_size]
            texts = [c.text for c in batch_chunks]

            # Tokenize
            input_ids, attention_mask = tokenizer(texts)        # [B, L]

            # Encode
            embeddings = self.encoder.encode_documents(input_ids, attention_mask)  # [B, d]

            # Add to index
            self.index.add(embeddings.cpu(), batch_chunks)

        print(f"Indexed {len(all_chunks)} chunks from {len(documents)} documents")

    @torch.no_grad()
    def retrieve(
        self,
        query: str,
        tokenizer: Callable,
    ) -> list[Chunk]:
        """
        Retrieve relevant chunks for a query.

        Returns top_k_rerank chunks after optional re-ranking.
        """
        # Encode query
        input_ids, attention_mask = tokenizer([query])
        q_embed = self.encoder.encode_queries(input_ids, attention_mask)  # [1, d]

        # First-stage retrieval
        scores, chunk_lists = self.index.search(q_embed, self.top_k_retrieve)
        candidates = chunk_lists[0]

        # Optional re-ranking
        if self.reranker is not None and len(candidates) > self.top_k_rerank:
            # Score each (query, chunk) pair with cross-encoder
            pair_texts = [f"{query} [SEP] {c.text}" for c in candidates]
            pair_ids, pair_masks = tokenizer(pair_texts)
            rerank_scores = self.reranker(pair_ids, pair_masks)          # [k]

            # Select top after re-ranking
            top_indices = rerank_scores.topk(self.top_k_rerank).indices
            candidates = [candidates[i] for i in top_indices.tolist()]
        else:
            candidates = candidates[:self.top_k_rerank]

        return candidates

    def query(self, question: str, tokenizer: Callable) -> str:
        """
        Full RAG query: retrieve + generate.
        """
        # Retrieve
        chunks = self.retrieve(question, tokenizer)

        # Format context
        contexts = [c.text for c in chunks]

        # Generate
        answer = self.generator(question, contexts)

        return answer
```

### 5.3 Training Loop for Dense Retriever

```python
def train_dual_encoder(
    model: DualEncoder,
    train_loader: torch.utils.data.DataLoader,
    val_loader: torch.utils.data.DataLoader,
    epochs: int = 10,
    lr: float = 2e-5,
    temperature: float = 0.05,
    device: str = "cuda",
) -> dict:
    """
    Train dual encoder with InfoNCE loss.

    Args:
        train_loader yields: (query_ids, query_mask, doc_ids, doc_mask)
            each of shape [B, L]

    Returns:
        Training metrics dict
    """
    model = model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    metrics = {"train_loss": [], "val_recall@10": []}

    for epoch in range(epochs):
        # --- Training ---
        model.train()
        epoch_loss = 0.0
        n_batches = 0

        for query_ids, query_mask, doc_ids, doc_mask in train_loader:
            query_ids = query_ids.to(device)      # [B, L_q]
            query_mask = query_mask.to(device)     # [B, L_q]
            doc_ids = doc_ids.to(device)           # [B, L_d]
            doc_mask = doc_mask.to(device)         # [B, L_d]

            loss, sim = model(query_ids, query_mask, doc_ids, doc_mask, temperature)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        scheduler.step()
        avg_loss = epoch_loss / max(n_batches, 1)
        metrics["train_loss"].append(avg_loss)

        # --- Validation: Recall@10 ---
        model.eval()
        correct = 0
        total = 0

        with torch.no_grad():
            for query_ids, query_mask, doc_ids, doc_mask in val_loader:
                query_ids = query_ids.to(device)
                query_mask = query_mask.to(device)
                doc_ids = doc_ids.to(device)
                doc_mask = doc_mask.to(device)

                q_embed = model.encode_queries(query_ids, query_mask)    # [B, d]
                d_embed = model.encode_documents(doc_ids, doc_mask)      # [B, d]
                sim = q_embed @ d_embed.T                                # [B, B]

                # Check if true positive is in top 10
                top10 = sim.topk(min(10, sim.size(1)), dim=-1).indices   # [B, 10]
                targets = torch.arange(sim.size(0), device=device)       # [B]
                correct += (top10 == targets.unsqueeze(1)).any(dim=1).sum().item()
                total += sim.size(0)

        recall_at_10 = correct / max(total, 1)
        metrics["val_recall@10"].append(recall_at_10)

        print(f"Epoch {epoch+1}/{epochs} | Loss: {avg_loss:.4f} | Recall@10: {recall_at_10:.4f}")

    return metrics
```

---

## 6. Experimental Intuition

### 6.1 ReAct vs. Pure Reasoning vs. Pure Acting

| Method | HotpotQA (EM) | FEVER (Acc) | ALFWorld (SR) |
|--------|---------------|-------------|---------------|
| Standard prompting | 25.7 | 57.1 | 3.0 |
| Chain-of-Thought | 29.4 | 56.3 | 0.0 |
| Act only | 25.7 | 58.9 | 45.0 |
| **ReAct** | **35.1** | **64.6** | **71.0** |

Key observations:

- ReAct outperforms both pure reasoning and pure acting across diverse tasks.
- CoT alone fails on tasks requiring external knowledge (FEVER fact verification).
- Acting alone fails on tasks requiring multi-step reasoning (HotpotQA).
- The synergy between reasoning and acting is especially pronounced in interactive environments (ALFWorld).

### 6.2 RAG Retrieval Quality

**Chunk size experiment** (on Natural Questions):

| Chunk Size (tokens) | Retrieval Recall@5 | Answer EM |
|---------------------|-------------------|-----------|
| 64 | 0.72 | 0.31 |
| 128 | 0.78 | 0.38 |
| 256 | 0.81 | 0.42 |
| 512 | 0.76 | 0.39 |
| 1024 | 0.68 | 0.33 |

The inverted-U shape confirms the precision-recall tradeoff from Proposition 3.11.

### 6.3 Dense vs. Sparse Retrieval

| Retriever | NQ Recall@20 | TriviaQA Recall@20 | Latency (ms) |
|-----------|-------------|-------------------|---------------|
| BM25 | 59.1 | 66.9 | 2 |
| DPR (dual encoder) | 78.4 | 79.4 | 5 |
| ColBERT (late interaction) | 82.0 | 83.1 | 15 |
| BM25 + DPR (hybrid) | 83.1 | 84.2 | 8 |

Dense retrieval substantially outperforms sparse (BM25) on tasks requiring semantic understanding, but hybrid approaches that combine both signals perform best.

### 6.4 Impact of Re-ranking

Re-ranking with a cross-encoder on top of dense retrieval:

| Method | NQ Top-5 Recall | NQ Top-5 MRR |
|--------|-----------------|--------------|
| DPR top-5 | 0.78 | 0.65 |
| DPR top-100 -> rerank top-5 | 0.86 | 0.78 |

Retrieve more, then re-rank, is a dominant strategy.

---

## 7. Connections

### 7.1 Connections to Prior Modules

- **Module 4 (Attention/Transformers)**: The dual encoder and cross-encoder architectures are built on transformers. Cross-attention in the cross-encoder is what makes it more powerful than dual encoders.
- **Module 5 (LLM Pretraining)**: The generator in RAG is a pretrained LLM. Agent capabilities emerge from large-scale pretraining.
- **Module 6 (Alignment)**: RLHF and instruction tuning enable the tool-use and structured-output capabilities that agents rely on.

### 7.2 Connections to Subsequent Topics

- **Lecture 10b (Chain-of-Thought)**: The "think" step in ReAct is formalized as chain-of-thought reasoning.
- **Lecture 10c (Test-Time Compute)**: RAG and tool use are forms of test-time compute scaling.
- **Lecture 10d (Multimodal Agents)**: Extends agent frameworks to vision-language and multi-agent settings.

### 7.3 Broader Connections

- **Information retrieval**: RAG connects to decades of IR research (BM25, learning to rank, neural IR).
- **Classical AI planning**: The agent loop is a modernized version of sense-plan-act from robotics.
- **Program synthesis**: Tool use can be viewed as a form of program synthesis where the LLM writes function calls.

---

## 8. Paper Reading List

### Required Reading

1. **Yao, S., Zhao, J., Yu, D., Du, N., Shafran, I., Narasimhan, K., & Cao, Y. (2023).** ReAct: Synergizing Reasoning and Acting in Language Models. *ICLR 2023*. The foundational paper on interleaving reasoning traces with actions.

2. **Lewis, P., Perez, E., Piktus, A., Petroni, F., Karpukhin, V., Goyal, N., ... & Kiela, D. (2020).** Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. *NeurIPS 2020*. Introduces RAG as probabilistic marginalization over retrieved documents.

3. **Schick, T., Dwivedi-Yu, J., Dessi, R., Raileanu, R., Lomeli, M., Zettlemoyer, L., ... & Scialom, T. (2023).** Toolformer: Language Models Can Teach Themselves to Use Tools. *NeurIPS 2023*. Self-supervised approach to teaching LLMs tool use.

### Recommended Reading

4. **Karpukhin, V., Oguz, B., Min, S., Lewis, P., Wu, L., Edunov, S., ... & Yih, W. (2020).** Dense Passage Retrieval for Open-Domain Question Answering. *EMNLP 2020*. The DPR paper establishing dual-encoder retrieval.

5. **Khattab, O. & Zaharia, M. (2020).** ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT. *SIGIR 2020*. Late interaction as a middle ground between dual encoders and cross-encoders.

6. **Malkov, Y. & Yashunin, D. (2020).** Efficient and Robust Approximate Nearest Neighbor Using Hierarchical Navigable Small World Graphs. *IEEE TPAMI*. The HNSW algorithm.

7. **Borgeaud, S., Mensch, A., Hoffmann, J., Cai, T., Rutherford, E., Millican, K., ... & Sifre, L. (2022).** Improving Language Models by Retrieving from Trillions of Tokens. *ICML 2022*. RETRO: retrieval integrated into pretraining.

### Optional / Historical

8. **Robertson, S. & Zaragoza, H. (2009).** The Probabilistic Relevance Framework: BM25 and Beyond. *Foundations and Trends in IR*. Classical sparse retrieval.

9. **Oord, A., Li, Y., & Vinyals, O. (2018).** Representation Learning with Contrastive Predictive Coding. *arXiv*. The InfoNCE objective underlying contrastive retrieval training.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9.1 (POMDP Formalization).** Consider an agent that answers questions by searching the web and performing calculations.

(a) Formally define the state space $\mathcal{S}$, action space $\mathcal{A}$, and observation space $\mathcal{O}$ for this agent.

(b) Why is this a POMDP rather than an MDP? What information is hidden from the agent?

(c) How does the finite context window affect the agent's ability to maintain an accurate belief state? Propose a mitigation strategy.

**Exercise 9.2 (InfoNCE Analysis).**

(a) Show that as $B \to \infty$, the InfoNCE loss converges to $-I(Q; D) + \text{const}$ where $I(Q; D)$ is the mutual information.

(b) In practice, why does increasing batch size $B$ improve contrastive learning? Relate this to the tightness of the MI lower bound.

(c) What happens when the temperature $\tau \to 0$? When $\tau \to \infty$? Characterize the learned representations in each limit.

**Exercise 9.3 (Chunking Analysis).**

(a) Derive the total number of chunks as a function of document length $D$, chunk size $L$, and overlap $O$. What is the storage overhead factor compared to no overlap?

(b) Prove that for a fixed embedding dimension $d$ and a uniformly random query, the probability of retrieving a relevant chunk increases monotonically with $L$ (assuming the relevant information is a contiguous span of length $r < L$).

(c) Why does this analysis break down for real (non-random) queries and non-contiguous information needs?

### Implementation Exercises

**Exercise 9.4 (Agent Implementation).** Implement a ReAct agent that can:

- Search Wikipedia (use the Wikipedia API)
- Perform calculations
- Look up weather data (use a mock API)

Test it on 10 multi-hop questions from HotpotQA and report the exact match accuracy.

**Exercise 9.5 (RAG Pipeline).** Build a complete RAG system:

(a) Download and chunk the SQuAD dataset passages.

(b) Train a dual encoder from scratch (or fine-tune a pretrained encoder) and index all chunks.

(c) Implement BM25 as a baseline retriever.

(d) Compare retrieval Recall@{1, 5, 10, 20} between your dual encoder and BM25.

(e) Add a cross-encoder re-ranker and show it improves Recall@5 when re-ranking the top 50 candidates.

**Exercise 9.6 (ANN Comparison).** Using the FAISS library:

(a) Build a Flat, IVF, and HNSW index for 1 million random 128-dimensional vectors.

(b) Measure query latency and Recall@10 for each index type as a function of the search hyperparameters (nprobe for IVF, efSearch for HNSW).

(c) Plot the Pareto frontier of recall vs. latency and discuss which index is optimal for different operating points.
