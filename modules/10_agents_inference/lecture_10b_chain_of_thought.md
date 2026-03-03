# Lecture 10b: Chain-of-Thought Reasoning

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** chain-of-thought (CoT) prompting and distinguish few-shot from zero-shot variants.
2. **Prove** that bounded-depth transformers cannot solve certain problems (e.g., graph connectivity) without CoT, and that CoT extends their effective computational class.
3. **Derive** the self-consistency algorithm and prove that majority voting over independent chains converges to the correct answer under mild assumptions.
4. **Formalize** Tree of Thought as a search problem and analyze its computational overhead.
5. **Implement** CoT prompting, self-consistency, and Tree of Thought in PyTorch.
6. **Analyze** when and why CoT fails, including faithfulness concerns.

---

## 2. Motivation and Context

### 2.1 The Reasoning Gap

Standard LLM prompting asks for a direct answer: "What is 127 * 43?" $\to$ "5461." This works for simple questions but fails on multi-step reasoning:

- Arithmetic with many digits
- Multi-hop logical deduction
- Planning and constraint satisfaction
- Mathematical proofs

Humans solve such problems by writing intermediate steps. **Chain-of-thought prompting** elicits this same behavior from LLMs: instead of jumping to the answer, the model generates a reasoning trace that decomposes the problem into steps.

### 2.2 Why This Is Theoretically Interesting

From a complexity-theoretic perspective, a transformer without CoT is a **bounded-depth** circuit: the number of sequential processing steps is fixed at the number of layers $L$. This fundamentally limits what functions it can compute. CoT effectively adds serial depth by using the autoregressive generation loop as additional computation steps.

This connects to deep questions in computational complexity: what is the power of depth in computation?

### 2.3 Timeline

- **Wei et al. (2022)**: Chain-of-thought prompting with few-shot examples.
- **Kojima et al. (2022)**: Zero-shot CoT ("Let's think step by step").
- **Wang et al. (2023)**: Self-consistency (majority vote over multiple chains).
- **Yao et al. (2023)**: Tree of Thought (branching reasoning).
- **Feng et al. (2024)**: Formal complexity analysis of CoT.

---

## 3. Core Theory

### 3.1 Chain-of-Thought Prompting

**Definition 3.1 (Chain of Thought).** Given a question $q$, a chain-of-thought response is a sequence $(r_1, r_2, \ldots, r_m, a)$ where:

- Each $r_i$ is an intermediate reasoning step (natural language)
- $a$ is the final answer
- Each $r_i$ depends on $q$ and $(r_1, \ldots, r_{i-1})$

Formally, the CoT probability factorizes as:

$$p_{\text{CoT}}(a | q) = \sum_{r_1, \ldots, r_m} \prod_{i=1}^{m} p(r_i | q, r_1, \ldots, r_{i-1}) \cdot p(a | q, r_1, \ldots, r_m)$$

**Few-Shot CoT.** Provide $k$ exemplars in the prompt, each showing the reasoning process:

$$\text{Prompt} = [(q_1, r_1^{(1)}, \ldots, r_1^{(m_1)}, a_1), \ldots, (q_k, r_k^{(1)}, \ldots, r_k^{(m_k)}, a_k), q]$$

**Zero-Shot CoT.** Simply append "Let's think step by step" to the query:

$$\text{Prompt} = [q, \text{"Let's think step by step."}]$$

### 3.2 Transformers as Bounded-Depth Circuits

To understand why CoT helps, we must formalize the computational limitations of transformers.

**Definition 3.2 (Transformer Computation Graph).** A transformer with $L$ layers, $H$ heads, and embedding dimension $d$ processes an input sequence $(x_1, \ldots, x_n)$ through a computation graph of depth $O(L)$. Each layer applies:

$$h_i^{(\ell)} = h_i^{(\ell-1)} + \text{MHA}^{(\ell)}(h_1^{(\ell-1)}, \ldots, h_n^{(\ell-1)})_i + \text{FFN}^{(\ell)}(\cdot)$$

The key constraint: the depth of the computation is **fixed at** $L$ regardless of the input.

**Theorem 3.3 (Transformers are in $\mathsf{TC}^0$, Merrill & Sabharwal, 2023).** A fixed-precision transformer with $L$ layers, $H$ attention heads, and polynomial embedding dimension $d = \text{poly}(n)$ can be simulated by a $\mathsf{TC}^0$ circuit (constant-depth threshold circuits with polynomial size).

*Proof sketch.* Each transformer layer consists of:

1. **Attention**: Matrix multiplication of $Q$, $K$, $V$ matrices, softmax, and weighted sum. Matrix multiplication is in $\mathsf{TC}^0$ (iterated addition of products). Softmax requires division, which is also in $\mathsf{TC}^0$ under fixed precision.
2. **FFN**: Matrix multiply + nonlinearity, also in $\mathsf{TC}^0$.

Since we have $L = O(1)$ layers (constant depth), the entire computation is the composition of a constant number of $\mathsf{TC}^0$ operations, which remains in $\mathsf{TC}^0$. $\square$

**Corollary 3.4.** Problems outside $\mathsf{TC}^0$ cannot be solved by bounded-depth transformers (without chain of thought). This includes:

- **Graph connectivity**: determining if two nodes are connected in a graph (this is in $\mathsf{L} = \mathsf{DLOGSPACE}$, which is believed to be strictly harder than $\mathsf{TC}^0$).
- **Formula evaluation**: evaluating Boolean formulas of unbounded depth.

### 3.3 CoT Extends Computational Power

**Theorem 3.5 (CoT Adds Serial Depth, Feng et al. 2024).** A transformer with $L$ layers generating $T$ chain-of-thought tokens can simulate any computation requiring $O(T \cdot L)$ sequential steps on the intermediate tokens.

*Proof.* Each generated token involves a full forward pass through all $L$ layers, with access to all previously generated tokens via the attention mechanism. After generating $T$ tokens, the model has performed $T$ forward passes, each of depth $L$.

At generation step $t$, the model computes:
$$h_{n+t}^{(L)} = f_{\text{transformer}}(x_1, \ldots, x_n, y_1, \ldots, y_{t-1})$$

where $(y_1, \ldots, y_{t-1})$ are previously generated CoT tokens. Each $y_t$ can encode information computed from all prior steps, so the effective computational depth is $T \cdot L$. $\square$

**Corollary 3.6.** With $T = \text{poly}(n)$ CoT tokens, a transformer can simulate $\mathsf{P}$-time computations (polynomial-time Turing machines), dramatically expanding beyond $\mathsf{TC}^0$.

**Theorem 3.7 (CoT Solves Graph Connectivity).** There exists a transformer with CoT that can determine $s$-$t$ connectivity in a graph $G = (V, E)$ with $|V| = n$ nodes.

*Proof.* The transformer can simulate BFS using CoT:

- Initialize: generate token encoding "visited = {$s$}, frontier = {$s$}"
- For each CoT step: expand the frontier by one hop, updating the visited set
- After at most $n-1$ steps: check if $t \in$ visited

Each step requires reading the previous frontier and edges (available via attention over the input and prior CoT tokens), which is within a single transformer forward pass's capability. The total number of CoT tokens is $O(n^2)$ (at most $n$ steps, each encoding $O(n)$ nodes). $\square$

### 3.4 Self-Consistency

**Definition 3.8 (Self-Consistency).** Sample $K$ independent chain-of-thought reasoning paths and take a majority vote on the final answer:

$$\hat{a} = \arg\max_{a \in \mathcal{A}} \sum_{k=1}^{K} \mathbb{1}[a_k = a]$$

where $a_k$ is the answer from the $k$-th reasoning chain sampled with temperature $T > 0$.

**Theorem 3.9 (Self-Consistency Convergence).** Suppose the probability that a single CoT chain produces the correct answer $a^*$ is $p > 1/|\mathcal{A}|$ (better than random among $|\mathcal{A}|$ possible answers). Then the probability that the majority vote yields $a^*$ converges to 1 exponentially in $K$.

*Proof.* Let $X_k = \mathbb{1}[a_k = a^*]$, so $X_k \sim \text{Bernoulli}(p)$ independently. The majority vote succeeds if $\sum_k X_k > K/2$ (for binary classification; the argument generalizes).

By Hoeffding's inequality:

$$P\left(\frac{1}{K}\sum_{k=1}^K X_k \leq \frac{1}{2}\right) \leq \exp\left(-2K\left(p - \frac{1}{2}\right)^2\right)$$

For $p > 1/2$, this probability decays exponentially in $K$.

For the general case with $|\mathcal{A}|$ answer choices, the correct answer $a^*$ has probability $p$ and each incorrect answer has probability at most $(1-p)/(|\mathcal{A}|-1)$. The majority vote fails only if some incorrect answer gets more votes. By a union bound over incorrect answers and multiplicative Chernoff bounds:

$$P(\text{error}) \leq (|\mathcal{A}| - 1) \cdot \exp\left(-\frac{K \cdot D_{\text{KL}}(1/|\mathcal{A}| \| p)}{3}\right)$$

where $D_{\text{KL}}$ is the KL divergence. This converges to 0 exponentially in $K$ whenever $p > 1/|\mathcal{A}|$. $\square$

**Corollary 3.10 (Sample Complexity for Self-Consistency).** To achieve error probability $\leq \delta$ with binary answer choices and single-chain accuracy $p > 1/2$:

$$K \geq \frac{\ln(1/\delta)}{2(p - 1/2)^2}$$

For example, with $p = 0.7$ and $\delta = 0.01$: $K \geq \frac{\ln 100}{2(0.2)^2} \approx 58$ samples suffice.

**Remark.** Self-consistency works because diverse reasoning paths that arrive at the correct answer reinforce each other, while errors tend to be uncorrelated across different paths (they fail in different ways). The key assumption is that errors are approximately independent; if the model systematically produces the same wrong answer, self-consistency does not help.

### 3.5 Tree of Thought

**Definition 3.11 (Tree of Thought).** Tree of Thought (ToT) generalizes CoT from a single chain to a tree-structured search:

- Each node represents a partial reasoning state $s$
- Each edge represents a thought step $r$ transforming $s$ to $s'$
- A value function $V(s)$ estimates the quality of each state
- Search proceeds via BFS, DFS, or best-first search

Formally, let $\mathcal{T} = (\mathcal{V}, \mathcal{E})$ be the reasoning tree where:

- Root: initial problem state $s_0$
- $\text{children}(s)$: states reachable by one thought step from $s$
- $V(s) \in [0, 1]$: LLM-estimated value of state $s$ (probability of reaching correct answer)

**Algorithm: ToT with Best-First Search**

$$\text{Given: root } s_0, \text{ branching factor } b, \text{ depth limit } D, \text{ beam width } w$$

$$\text{frontier} \leftarrow \{s_0\}$$

$$\text{For depth } d = 1, \ldots, D:$$

$$\quad \text{candidates} \leftarrow \emptyset$$

$$\quad \text{For each } s \in \text{frontier}:$$

$$\quad\quad \text{Generate } b \text{ child states } \{s'_1, \ldots, s'_b\} \text{ by prompting LLM}$$

$$\quad\quad \text{candidates} \leftarrow \text{candidates} \cup \{s'_1, \ldots, s'_b\}$$

$$\quad \text{Evaluate: } V(s') \text{ for each } s' \in \text{candidates}$$

$$\quad \text{frontier} \leftarrow \text{top-}w(\text{candidates}, V)$$

$$\text{Return best terminal state in frontier}$$

**Proposition 3.12 (ToT Complexity).** ToT with branching factor $b$, depth $D$, and beam width $w$ requires:

- **LLM calls for generation**: $O(w \cdot b \cdot D)$
- **LLM calls for evaluation**: $O(w \cdot b \cdot D)$
- **Total**: $O(w \cdot b \cdot D)$ LLM forward passes

Compared to self-consistency with $K$ samples (each of depth $D$): $K \cdot D$ tokens generated, but no intermediate evaluation. ToT has higher overhead per step but can prune bad paths early.

### 3.6 Faithfulness of Chain-of-Thought

A critical question: does the CoT reasoning trace actually reflect the model's computation, or is it a post-hoc rationalization?

**Definition 3.13 (Faithful CoT).** A CoT trace $(r_1, \ldots, r_m)$ is **faithful** if:

1. The final answer $a$ causally depends on the reasoning steps (not just on the original query).
2. Each step $r_i$ accurately describes the computation being performed.

**Observation (Turpin et al., 2024).** CoT is not always faithful. Models can:

- Arrive at the correct answer via different internal reasoning than what the CoT describes.
- Be influenced by biased few-shot examples in the CoT while the trace appears to follow correct logic.
- Generate plausible-sounding but logically flawed reasoning chains.

**Formal test of faithfulness:** Intervene on the CoT (modify an intermediate step) and check if the final answer changes accordingly. If the model ignores the modification, the CoT is not causally efficacious.

### 3.7 Computational Complexity of CoT Verification

**Proposition 3.14 (Verifying CoT is Easier than Generating).** For many problem classes, verifying a chain of reasoning is computationally easier than producing one. This is the $\mathsf{P}$ vs. $\mathsf{NP}$ intuition applied to reasoning:

- **Generating** a correct CoT for a math problem may require search over exponentially many reasoning paths.
- **Verifying** a given CoT requires checking each step locally, which is polynomial.

This asymmetry motivates **process reward models** (Lecture 10c): train a verifier to check reasoning steps, then use it to guide search.

---

## 4. Algorithmic Derivation

### 4.1 Self-Consistency Algorithm

```
Algorithm: Self-Consistency
Input: question q, LLM model M, num_samples K, temperature T
Output: answer a

answers ← {}  // dictionary: answer -> count

for k = 1 to K:
    // Sample reasoning chain with temperature
    chain_k ← M.generate(q, temperature=T)          // O(n * d * L_chain)
    a_k ← extract_answer(chain_k)

    answers[a_k] ← answers[a_k] + 1

// Majority vote
a ← argmax_{a} answers[a]

return a

// Total complexity: O(K * n * d * L_chain) where L_chain is avg chain length
// Parallelizable: all K chains are independent
```

### 4.2 Tree of Thought Algorithm

```
Algorithm: Tree of Thought (Best-First Search)
Input: problem q, LLM M, value_prompt V_prompt
Hyperparameters: branching factor b, depth D, beam width w

Initialize: frontier ← [(s_0 = q, value = 1.0)]

for depth = 1 to D:
    candidates ← []

    for each (state s, _) in frontier:
        // Generate b candidate next steps
        for j = 1 to b:
            thought_j ← M.generate(                 // O(n * d)
                prompt = "Given state: {s}\nPropose the next reasoning step:"
            )
            s'_j ← concatenate(s, thought_j)

            // Evaluate state quality
            v_j ← M.generate(                       // O(n * d)
                prompt = V_prompt.format(state=s'_j)
            )
            // Parse value (e.g., "sure/likely/impossible" -> score)
            score_j ← parse_value(v_j)

            candidates.append((s'_j, score_j))

    // Beam selection: keep top-w candidates
    candidates.sort(by=score, descending=True)
    frontier ← candidates[:w]

    // Check for terminal states
    for (s, v) in frontier:
        if is_terminal(s):
            return extract_answer(s)

return extract_answer(frontier[0].state)

// Complexity: O(w * b * D) LLM calls
// Each call: O(context_len * d_model)
```

### 4.3 Weighted Self-Consistency

```
Algorithm: Weighted Self-Consistency
Input: question q, LLM M, num_samples K, temperature T
Output: answer a with confidence

answers ← {}  // dictionary: answer -> list of log-probabilities

for k = 1 to K:
    chain_k, logprob_k ← M.generate_with_logprob(q, temperature=T)
    a_k ← extract_answer(chain_k)

    answers[a_k].append(logprob_k)

// Weighted vote (using chain log-probability as weight)
for each answer a in answers:
    answers[a].score ← logsumexp(answers[a].logprobs)

a ← argmax_{a} answers[a].score
confidence ← softmax({answers[a].score for all a})[a]

return a, confidence
```

---

## 5. PyTorch Implementation

### 5.1 Self-Consistency

```python
import torch
import torch.nn.functional as F
from collections import Counter
from typing import Callable, Optional
import re

class SelfConsistency:
    """
    Self-consistency decoding: sample multiple CoT chains and majority vote.

    Given a question q, generates K reasoning chains at temperature T,
    extracts the final answer from each, and returns the majority vote.
    """
    def __init__(
        self,
        model: Callable,               # Function: (prompt, temperature) -> str
        num_samples: int = 10,
        temperature: float = 0.7,
        answer_extractor: Optional[Callable] = None,
    ):
        self.model = model
        self.num_samples = num_samples
        self.temperature = temperature
        self.answer_extractor = answer_extractor or self._default_extractor

    @staticmethod
    def _default_extractor(chain: str) -> str:
        """Extract the final answer from a CoT chain."""
        # Look for "the answer is X" pattern
        patterns = [
            r"[Tt]he answer is[:\s]*(.+?)[\.\n]",
            r"[Aa]nswer[:\s]*(.+?)[\.\n]",
            r"= (.+?)$",
        ]
        for pattern in patterns:
            match = re.search(pattern, chain)
            if match:
                return match.group(1).strip()
        # Fallback: last line
        lines = chain.strip().split("\n")
        return lines[-1].strip()

    def __call__(self, question: str) -> dict:
        """
        Run self-consistency on a question.

        Returns:
            dict with keys:
                - 'answer': majority vote answer
                - 'confidence': fraction of chains agreeing
                - 'chains': list of (chain, answer) tuples
                - 'vote_distribution': Counter of answers

        Complexity: O(K * generation_cost)
        """
        chains = []
        answers = []

        for k in range(self.num_samples):
            # Generate reasoning chain
            prompt = (
                f"Question: {question}\n"
                f"Let's think step by step.\n"
            )
            chain = self.model(prompt, temperature=self.temperature)
            answer = self.answer_extractor(chain)

            chains.append(chain)
            answers.append(answer)

        # Majority vote
        vote_counts = Counter(answers)
        majority_answer, majority_count = vote_counts.most_common(1)[0]

        return {
            "answer": majority_answer,
            "confidence": majority_count / self.num_samples,
            "chains": list(zip(chains, answers)),
            "vote_distribution": vote_counts,
        }

class WeightedSelfConsistency:
    """
    Weighted self-consistency using chain log-probabilities.

    Instead of uniform voting, weights each chain by its generation probability.
    """
    def __init__(
        self,
        model: Callable,    # (prompt, temp) -> (text, log_prob)
        num_samples: int = 10,
        temperature: float = 0.7,
        answer_extractor: Optional[Callable] = None,
    ):
        self.model = model
        self.num_samples = num_samples
        self.temperature = temperature
        self.answer_extractor = answer_extractor or SelfConsistency._default_extractor

    def __call__(self, question: str) -> dict:
        """
        Weighted majority vote.

        Each answer's score = logsumexp of its chains' log-probabilities.
        """
        answer_logprobs: dict[str, list[float]] = {}

        prompt = f"Question: {question}\nLet's think step by step.\n"

        for k in range(self.num_samples):
            chain, log_prob = self.model(prompt, temperature=self.temperature)
            answer = self.answer_extractor(chain)

            if answer not in answer_logprobs:
                answer_logprobs[answer] = []
            answer_logprobs[answer].append(log_prob)

        # Weighted scores via logsumexp
        scores = {}
        for answer, logprobs in answer_logprobs.items():
            logprobs_tensor = torch.tensor(logprobs)
            scores[answer] = torch.logsumexp(logprobs_tensor, dim=0).item()

        # Softmax over scores for confidence
        all_answers = list(scores.keys())
        all_scores = torch.tensor([scores[a] for a in all_answers])
        probs = F.softmax(all_scores, dim=0)

        best_idx = probs.argmax().item()
        return {
            "answer": all_answers[best_idx],
            "confidence": probs[best_idx].item(),
            "answer_probs": dict(zip(all_answers, probs.tolist())),
        }
```

### 5.2 Tree of Thought

```python
import heapq
from dataclasses import dataclass, field
from typing import Callable, Optional

@dataclass(order=True)
class ThoughtNode:
    """
    Node in the Tree of Thought.

    Attributes:
        value: estimated quality of this state (higher = better)
        state: the full reasoning state (text)
        depth: depth in the tree
        parent: parent node (for path reconstruction)
    """
    value: float
    state: str = field(compare=False)
    depth: int = field(compare=False, default=0)
    parent: Optional['ThoughtNode'] = field(compare=False, default=None, repr=False)

    def get_path(self) -> list[str]:
        """Reconstruct the reasoning path from root to this node."""
        path = []
        node = self
        while node is not None:
            path.append(node.state)
            node = node.parent
        return list(reversed(path))

class TreeOfThought:
    """
    Tree of Thought search for complex reasoning problems.

    Supports BFS, DFS, and best-first search strategies.

    The LLM is used for two purposes:
    1. Generating candidate next steps (thought proposals)
    2. Evaluating the quality of reasoning states (value function)
    """
    def __init__(
        self,
        propose_fn: Callable,       # (state: str) -> list[str]
        evaluate_fn: Callable,       # (state: str) -> float in [0, 1]
        is_terminal_fn: Callable,    # (state: str) -> bool
        branching_factor: int = 3,
        max_depth: int = 5,
        beam_width: int = 5,
    ):
        self.propose = propose_fn
        self.evaluate = evaluate_fn
        self.is_terminal = is_terminal_fn
        self.branching_factor = branching_factor
        self.max_depth = max_depth
        self.beam_width = beam_width
        self.stats = {"nodes_explored": 0, "llm_calls": 0}

    def best_first_search(self, problem: str) -> dict:
        """
        Best-first search over the thought tree.

        Uses a priority queue (max-heap via negative values)
        to always expand the most promising node.

        Complexity: O(beam_width * branching_factor * max_depth) LLM calls
        """
        self.stats = {"nodes_explored": 0, "llm_calls": 0}

        root = ThoughtNode(value=1.0, state=problem, depth=0)
        # Python heapq is min-heap; negate values for max behavior
        frontier = [(-root.value, id(root), root)]
        best_terminal = None

        while frontier:
            neg_val, _, node = heapq.heappop(frontier)
            self.stats["nodes_explored"] += 1

            if node.depth >= self.max_depth or self.is_terminal(node.state):
                if best_terminal is None or node.value > best_terminal.value:
                    best_terminal = node
                continue

            # Generate children
            proposals = self.propose(node.state)           # list of str
            self.stats["llm_calls"] += 1

            proposals = proposals[:self.branching_factor]

            for proposal in proposals:
                child_state = f"{node.state}\n{proposal}"
                child_value = self.evaluate(child_state)   # float in [0,1]
                self.stats["llm_calls"] += 1

                child = ThoughtNode(
                    value=child_value,
                    state=child_state,
                    depth=node.depth + 1,
                    parent=node,
                )
                heapq.heappush(frontier, (-child.value, id(child), child))

            # Beam pruning: keep only top beam_width nodes
            if len(frontier) > self.beam_width * 2:
                frontier = heapq.nsmallest(self.beam_width, frontier)
                heapq.heapify(frontier)

        if best_terminal is None:
            return {"answer": None, "path": [], "stats": self.stats}

        return {
            "answer": best_terminal.state,
            "value": best_terminal.value,
            "path": best_terminal.get_path(),
            "stats": self.stats,
        }

    def beam_search(self, problem: str) -> dict:
        """
        Beam search variant of ToT.

        At each depth, expand all beam nodes and keep top beam_width.

        Complexity: O(beam_width * branching_factor * max_depth) LLM calls
        """
        self.stats = {"nodes_explored": 0, "llm_calls": 0}

        root = ThoughtNode(value=1.0, state=problem, depth=0)
        beam = [root]

        for depth in range(self.max_depth):
            candidates = []

            for node in beam:
                self.stats["nodes_explored"] += 1

                if self.is_terminal(node.state):
                    candidates.append(node)
                    continue

                # Generate children
                proposals = self.propose(node.state)
                self.stats["llm_calls"] += 1
                proposals = proposals[:self.branching_factor]

                for proposal in proposals:
                    child_state = f"{node.state}\n{proposal}"
                    child_value = self.evaluate(child_state)
                    self.stats["llm_calls"] += 1

                    child = ThoughtNode(
                        value=child_value,
                        state=child_state,
                        depth=depth + 1,
                        parent=node,
                    )
                    candidates.append(child)

            # Select top beam_width candidates
            candidates.sort(key=lambda n: n.value, reverse=True)
            beam = candidates[:self.beam_width]

            if not beam:
                break

        best = max(beam, key=lambda n: n.value)
        return {
            "answer": best.state,
            "value": best.value,
            "path": best.get_path(),
            "stats": self.stats,
        }

# ============================================================
# Example: Game of 24 with Tree of Thought
# ============================================================

def make_game_of_24_tot(llm: Callable) -> TreeOfThought:
    """
    Create a ToT solver for the Game of 24.

    Game: Given 4 numbers, use +, -, *, / to make 24.
    Example: 4, 7, 8, 8 -> (7 - (8/8)) * 4 = 24
    """

    def propose(state: str) -> list[str]:
        """Generate candidate next operations."""
        prompt = (
            f"I'm playing the Game of 24. Current state:\n{state}\n\n"
            f"Propose 3 possible next steps. Each step should combine "
            f"two of the remaining numbers using +, -, *, or /.\n"
            f"Format each step as: 'a op b = c (remaining: ...)'"
        )
        response = llm(prompt, temperature=0.7)
        # Parse individual proposals
        steps = [line.strip() for line in response.strip().split("\n") if line.strip()]
        return steps[:3]

    def evaluate(state: str) -> float:
        """Evaluate how promising a state is."""
        prompt = (
            f"Evaluate this Game of 24 reasoning state:\n{state}\n\n"
            f"Rate the likelihood of reaching 24 from here.\n"
            f"Respond with exactly one of: sure (1.0), likely (0.7), "
            f"possible (0.4), impossible (0.0)"
        )
        response = llm(prompt, temperature=0.1)
        response_lower = response.strip().lower()

        if "sure" in response_lower:
            return 1.0
        elif "likely" in response_lower:
            return 0.7
        elif "possible" in response_lower:
            return 0.4
        else:
            return 0.0

    def is_terminal(state: str) -> bool:
        """Check if the state contains a final answer."""
        return "= 24" in state or "impossible" in state.lower()

    return TreeOfThought(
        propose_fn=propose,
        evaluate_fn=evaluate,
        is_terminal_fn=is_terminal,
        branching_factor=3,
        max_depth=4,
        beam_width=5,
    )
```

### 5.3 CoT Prompting Utilities

```python
from dataclasses import dataclass

@dataclass
class CoTExample:
    """A chain-of-thought exemplar for few-shot prompting."""
    question: str
    reasoning: str
    answer: str

class CoTPromptBuilder:
    """
    Builds chain-of-thought prompts in few-shot or zero-shot mode.

    Few-shot: includes exemplars demonstrating the reasoning format.
    Zero-shot: appends "Let's think step by step."
    """
    def __init__(
        self,
        exemplars: list[CoTExample] = None,
        system_prompt: str = "",
        zero_shot_trigger: str = "Let's think step by step.",
    ):
        self.exemplars = exemplars or []
        self.system_prompt = system_prompt
        self.zero_shot_trigger = zero_shot_trigger

    def build_few_shot(self, question: str) -> str:
        """
        Build a few-shot CoT prompt.

        Structure:
            [System prompt]
            Q: exemplar_1.question
            A: exemplar_1.reasoning ... exemplar_1.answer
            ...
            Q: question
            A:
        """
        parts = []
        if self.system_prompt:
            parts.append(self.system_prompt)

        for ex in self.exemplars:
            parts.append(f"Q: {ex.question}")
            parts.append(f"A: {ex.reasoning}\nThe answer is {ex.answer}.")

        parts.append(f"Q: {question}")
        parts.append("A:")

        return "\n\n".join(parts)

    def build_zero_shot(self, question: str) -> str:
        """
        Build a zero-shot CoT prompt.

        Structure:
            [System prompt]
            Q: question
            A: Let's think step by step.
        """
        parts = []
        if self.system_prompt:
            parts.append(self.system_prompt)

        parts.append(f"Q: {question}")
        parts.append(f"A: {self.zero_shot_trigger}")

        return "\n\n".join(parts)

# --- Example exemplars for arithmetic ---

ARITHMETIC_EXEMPLARS = [
    CoTExample(
        question="What is 23 * 17?",
        reasoning=(
            "I need to multiply 23 by 17.\n"
            "23 * 17 = 23 * 10 + 23 * 7\n"
            "23 * 10 = 230\n"
            "23 * 7 = 161\n"
            "230 + 161 = 391"
        ),
        answer="391",
    ),
    CoTExample(
        question="If a train travels at 60 mph for 2.5 hours, how far does it go?",
        reasoning=(
            "Distance = speed * time.\n"
            "Speed = 60 mph, Time = 2.5 hours.\n"
            "Distance = 60 * 2.5 = 150 miles."
        ),
        answer="150 miles",
    ),
]

# Usage example:
# builder = CoTPromptBuilder(exemplars=ARITHMETIC_EXEMPLARS)
# prompt = builder.build_few_shot("What is 45 * 32?")
# response = llm(prompt)
```

### 5.4 Experimental Evaluation Framework

```python
import time
from typing import Callable

class CoTEvaluator:
    """
    Evaluate different CoT strategies on a benchmark.

    Compares: direct prompting, zero-shot CoT, few-shot CoT,
    self-consistency, and Tree of Thought.
    """
    def __init__(
        self,
        model: Callable,
        benchmark: list[dict],     # List of {"question": str, "answer": str}
    ):
        self.model = model
        self.benchmark = benchmark

    def evaluate_direct(self) -> dict:
        """Baseline: direct prompting without CoT."""
        correct = 0
        total = len(self.benchmark)
        total_time = 0.0

        for item in self.benchmark:
            start = time.time()
            prompt = f"Q: {item['question']}\nA:"
            response = self.model(prompt, temperature=0.0)
            elapsed = time.time() - start

            predicted = response.strip().split("\n")[0]
            if item["answer"].lower() in predicted.lower():
                correct += 1
            total_time += elapsed

        return {
            "method": "direct",
            "accuracy": correct / total,
            "avg_time": total_time / total,
            "total_calls": total,
        }

    def evaluate_zero_shot_cot(self) -> dict:
        """Zero-shot CoT: 'Let's think step by step.'"""
        correct = 0
        total = len(self.benchmark)
        total_time = 0.0

        for item in self.benchmark:
            start = time.time()
            prompt = (
                f"Q: {item['question']}\n"
                f"A: Let's think step by step.\n"
            )
            response = self.model(prompt, temperature=0.0)
            elapsed = time.time() - start

            # Extract answer from last line
            lines = response.strip().split("\n")
            predicted = lines[-1] if lines else ""
            if item["answer"].lower() in predicted.lower():
                correct += 1
            total_time += elapsed

        return {
            "method": "zero_shot_cot",
            "accuracy": correct / total,
            "avg_time": total_time / total,
            "total_calls": total,
        }

    def evaluate_self_consistency(
        self,
        num_samples: int = 10,
        temperature: float = 0.7,
    ) -> dict:
        """Self-consistency with majority voting."""
        sc = SelfConsistency(
            model=self.model,
            num_samples=num_samples,
            temperature=temperature,
        )
        correct = 0
        total = len(self.benchmark)
        total_time = 0.0

        for item in self.benchmark:
            start = time.time()
            result = sc(item["question"])
            elapsed = time.time() - start

            if item["answer"].lower() in result["answer"].lower():
                correct += 1
            total_time += elapsed

        return {
            "method": f"self_consistency_k{num_samples}",
            "accuracy": correct / total,
            "avg_time": total_time / total,
            "total_calls": total * num_samples,
        }

    def run_all(self, num_sc_samples: int = 10) -> list[dict]:
        """Run all evaluation methods and return comparative results."""
        results = [
            self.evaluate_direct(),
            self.evaluate_zero_shot_cot(),
            self.evaluate_self_consistency(num_samples=num_sc_samples),
        ]

        print(f"\n{'Method':<30} {'Accuracy':>10} {'Avg Time (s)':>15} {'LLM Calls':>12}")
        print("-" * 70)
        for r in results:
            print(
                f"{r['method']:<30} {r['accuracy']:>10.3f} "
                f"{r['avg_time']:>15.3f} {r['total_calls']:>12}"
            )

        return results
```

---

## 6. Experimental Intuition

### 6.1 CoT Scaling with Model Size

CoT benefits emerge primarily in large models (a phenomenon called "emergence"):

| Model Size | Direct (GSM8K) | CoT (GSM8K) | Improvement |
|-----------|----------------|-------------|-------------|
| 1B | 2.1% | 2.5% | +0.4% |
| 7B | 10.8% | 15.4% | +4.6% |
| 70B | 33.0% | 56.8% | +23.8% |
| 540B (PaLM) | 43.0% | 74.4% | +31.4% |

Key insight: small models cannot meaningfully execute multi-step reasoning even when prompted to do so. CoT is an **emergent ability** that requires sufficient model capacity.

### 6.2 Self-Consistency Results

Self-consistency with varying numbers of samples on GSM8K (using PaLM 540B):

| K (samples) | Accuracy | Relative Improvement |
|-------------|----------|---------------------|
| 1 (greedy CoT) | 56.5% | baseline |
| 5 | 68.2% | +11.7% |
| 10 | 72.1% | +15.6% |
| 20 | 74.4% | +17.9% |
| 40 | 76.1% | +19.6% |

Diminishing returns as $K$ increases, consistent with the exponential convergence in Theorem 3.9 (once accuracy exceeds ~75%, very few additional samples are needed).

### 6.3 Tree of Thought vs. CoT

On the Game of 24 (Yao et al., 2023):

| Method | Success Rate | Avg LLM Calls |
|--------|-------------|---------------|
| Standard prompting | 7.3% | 1 |
| Chain-of-Thought | 4.0% | 1 |
| CoT + self-consistency (k=100) | 9.0% | 100 |
| **Tree of Thought (b=3, w=5)** | **74.0%** | ~40 |

ToT massively outperforms CoT on problems requiring exploration and backtracking. Note that CoT actually performs *worse* than direct prompting here because incorrect intermediate steps compound errors.

### 6.4 When CoT Hurts

CoT does not always help:

| Task Type | Direct | CoT | Observation |
|-----------|--------|-----|-------------|
| Simple factual QA | 78% | 75% | CoT adds unnecessary computation |
| Sentiment analysis | 91% | 89% | Task is simple enough for direct |
| Multi-digit arithmetic | 18% | 67% | Strong improvement |
| Multi-hop reasoning | 42% | 63% | Strong improvement |
| Spatial reasoning | 35% | 33% | CoT in text struggles with spatial |

**Rule of thumb**: CoT helps when (1) the task requires multiple reasoning steps, (2) the model is large enough to execute reasoning, and (3) the reasoning can be expressed in natural language.

---

## 7. Connections

### 7.1 Connections to Prior Modules

- **Module 4 (Transformers)**: The bounded-depth circuit analysis directly relates to transformer architecture. The attention mechanism is what allows CoT tokens to communicate information across steps.
- **Module 5 (LLM Pretraining)**: CoT ability emerges from pretraining on data that contains reasoning traces (mathematical derivations, code with comments, step-by-step explanations).
- **Module 6 (Alignment)**: RLHF can be used to train models to produce higher-quality CoT reasoning.

### 7.2 Connections to Subsequent Topics

- **Lecture 10a (Agents)**: CoT is the "think" step in the ReAct observe-think-act loop.
- **Lecture 10c (Test-Time Compute)**: Self-consistency and ToT are forms of test-time compute scaling. Process reward models (10c) can evaluate individual CoT steps.
- **Lecture 10d (Multimodal Agents)**: Code generation agents use CoT-like reasoning (plan -> code -> test -> debug).

### 7.3 Connections to Complexity Theory

- **$\mathsf{TC}^0$ vs. $\mathsf{NC}^1$**: The gap between fixed-depth transformers and transformers with CoT mirrors the gap between constant-depth and logarithmic-depth circuits.
- **Interactive proofs**: CoT can be viewed as the LLM providing a proof (reasoning trace) that a verifier (reward model or human) checks. This connects to $\mathsf{IP} = \mathsf{PSPACE}$.
- **$\mathsf{P}$ vs. $\mathsf{NP}$**: Generating a correct CoT is analogous to finding a solution (potentially hard), while verifying it is analogous to checking a proof (easy). This motivates process reward models.

---

## 8. Paper Reading List

### Required Reading

1. **Wei, J., Wang, X., Schuurmans, D., Bosma, M., Ichter, B., Xia, F., ... & Zhou, D. (2022).** Chain-of-Thought Prompting Elicits Reasoning in Large Language Models. *NeurIPS 2022*. The original CoT paper demonstrating that prompting with reasoning examples elicits multi-step reasoning.

2. **Wang, X., Wei, J., Schuurmans, D., Le, Q., Chi, E., Narang, S., ... & Zhou, D. (2023).** Self-Consistency Improves Chain of Thought Reasoning in Language Models. *ICLR 2023*. Introduces majority voting over sampled chains.

3. **Yao, S., Yu, D., Zhao, J., Shafran, I., Griffiths, T. L., Cao, Y., & Narasimhan, K. (2023).** Tree of Thoughts: Deliberate Problem Solving with Large Language Models. *NeurIPS 2023*. Extends CoT to tree-structured search.

4. **Feng, G., Zhang, B., Gu, Y., Ye, H., He, D., & Wang, L. (2024).** Towards Revealing the Mystery behind Chain of Thought: A Theoretical Perspective. *NeurIPS 2024*. Formal complexity-theoretic analysis of why CoT works.

### Recommended Reading

5. **Kojima, T., Gu, S. S., Reid, M., Matsuo, Y., & Iwasawa, Y. (2022).** Large Language Models are Zero-Shot Reasoners. *NeurIPS 2022*. Shows that "Let's think step by step" alone elicits CoT.

6. **Merrill, W. & Sabharwal, A. (2023).** The Expressive Power of Transformers with Chain of Thought. *ICLR 2024*. Formal analysis showing CoT extends transformers beyond $\mathsf{TC}^0$.

7. **Turpin, M., Michael, J., Perez, E., & Bowman, S. R. (2024).** Language Models Don't Always Say What They Think: Unfaithful Explanations in Chain-of-Thought Prompting. *NeurIPS 2024*. Evidence that CoT may not be faithful.

### Optional / Related

8. **Nye, M., Andreassen, A., Gur-Ari, G., Michalewski, H., Austin, J., Biber, D., ... & Odena, A. (2022).** Show Your Work: Scratchpads for Intermediate Computation with Language Models. *arXiv*. Precursor to CoT using "scratchpad" training.

9. **Zelikman, E., Wu, Y., Mu, J., & Goodman, N. (2022).** STaR: Bootstrapping Reasoning With Reasoning. *NeurIPS 2022*. Self-improving reasoning through bootstrapping.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9.1 (Computational Depth Analysis).**

(a) Prove that a transformer with $L$ layers and no CoT cannot compute the parity of $n$ bits for arbitrary $n$. (Hint: parity is not in $\mathsf{AC}^0$, and $\mathsf{AC}^0 \subset \mathsf{TC}^0$, but carefully argue why the fixed-precision constraint matters.)

(b) Show that a transformer with CoT can compute parity using $O(n)$ intermediate tokens. Write out the explicit reasoning trace.

(c) What is the minimum number of CoT tokens needed to compute parity? Prove a lower bound.

**Exercise 9.2 (Self-Consistency Theory).**

(a) Suppose a model produces the correct answer with probability $p = 0.6$ and there are $|\mathcal{A}| = 4$ possible answers. How many samples $K$ do you need for the majority vote to succeed with probability $\geq 0.95$? Derive the exact bound using Hoeffding's inequality.

(b) Now suppose errors are correlated: with probability $\rho$, all chains produce the same wrong answer. Rederive the success probability. For what value of $\rho$ does self-consistency become useless?

(c) Propose and analyze an alternative to majority voting: **weighted voting** where each chain's vote is weighted by its normalized log-probability. Under what conditions does this outperform unweighted voting?

**Exercise 9.3 (Tree of Thought Analysis).**

(a) Compute the maximum number of nodes explored by ToT with branching factor $b$, depth $D$, and beam width $w$ for both BFS and best-first search.

(b) Compare the computational cost of self-consistency with $K$ samples vs. ToT with equivalent total LLM calls. Under what conditions does each strategy dominate?

(c) Prove that if the value function $V$ is perfect (always ranks the correct path highest), then ToT with beam width $w = 1$ finds the correct answer in $O(D)$ LLM calls regardless of branching factor.

### Implementation Exercises

**Exercise 9.4 (CoT for Arithmetic).** Implement and evaluate:

(a) Zero-shot CoT, few-shot CoT (with 5 exemplars), and self-consistency ($K \in \{1, 5, 10, 20, 40\}$) on the GSM8K dataset (or a subset of 100 problems).

(b) Plot accuracy vs. number of samples for self-consistency. Fit the convergence rate and compare to the theoretical bound from Theorem 3.9.

(c) Implement a simple "verifier" that checks if each arithmetic step in the CoT is correct. What fraction of CoT errors are due to reasoning errors vs. calculation errors?

**Exercise 9.5 (Tree of Thought).** Implement ToT for the Game of 24:

(a) Implement the propose and evaluate functions using an LLM.

(b) Compare BFS (beam search) and best-first search. Measure success rate and number of LLM calls.

(c) Implement a "perfect" value function using symbolic computation (actually check if 24 is reachable from remaining numbers). How much does a perfect value function improve over the LLM-based one?

**Exercise 9.6 (Faithfulness Analysis).** Design and run an experiment to test CoT faithfulness:

(a) Create a dataset of problems where the few-shot examples contain a subtle bias (e.g., the answer is always "C" in multiple choice). Test if the model follows the biased pattern even when its CoT appears to reason correctly.

(b) Implement the "early answering" test: truncate the CoT at various points and check if the model already "knows" the answer before completing the reasoning. Report the fraction of problems where the model's answer is determined before the CoT reasoning.
