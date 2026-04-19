# Lecture 07c: Speculative Decoding & Draft-Verify Paradigms

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Explain** why autoregressive decoding is inherently latency-bound and why naive parallelism across tokens is impossible due to the sequential dependency.
2. **Derive** the speculative decoding acceptance/rejection scheme, proving that it produces samples from exactly the target model distribution.
3. **Analyze** the expected speedup of speculative decoding as a function of the acceptance rate, draft length, and the relative cost of draft versus target model forward passes.
4. **Compare** draft model architectures --- smaller LMs, n-gram models, Medusa heads, and EAGLE --- evaluating the tradeoff between draft quality and draft overhead.
5. **Design** tree-structured speculation strategies and analyze their expected token yield under varying acceptance rates.

---

## 2. Motivation and Context

### 2.1 The Sequential Bottleneck

Autoregressive language models generate tokens one at a time:

$$x_t \sim p_{\text{target}}(\cdot \mid x_1, \ldots, x_{t-1})$$

Each token requires a full forward pass through the model. For a model with $L$ layers, each forward pass involves loading all $N$ parameters from HBM. As shown in Lecture 07a, the decode phase is memory-bandwidth-bound, so latency per token is approximately:

$$t_{\text{decode}} \approx \frac{2N \times \text{sizeof(dtype)}}{\text{HBM bandwidth}}$$

For LLaMA-2 70B in FP16 on an A100 (2 TB/s bandwidth):

$$t_{\text{decode}} \approx \frac{2 \times 70 \times 10^9 \times 2}{2 \times 10^{12}} = 140 \text{ ms per token}$$

Generating 200 tokens takes $\sim 28$ seconds. This latency is **independent of batch size** (up to the point where the batch becomes compute-bound), and **cannot be reduced by adding more compute** --- it is fundamentally limited by memory bandwidth.

### 2.2 The Key Insight: Verification is Parallel

While generating tokens is sequential, **verifying** a sequence of candidate tokens is parallelizable. Given candidates $\tilde{x}_1, \ldots, \tilde{x}_K$, the target model can compute all of $p_{\text{target}}(x_t \mid x_1, \ldots, x_{t-1})$ for $t = 1, \ldots, K$ in a single forward pass (like prefill).

This asymmetry --- sequential generation but parallel verification --- is the foundation of speculative decoding.

### 2.3 An Analogy: Speculative Execution in CPUs

The name "speculative decoding" draws from **speculative execution** in CPU microarchitectures. A CPU predicts which branch an if-statement will take, speculatively executes instructions along the predicted path, and commits the results if the prediction was correct (or rolls back if wrong). Similarly, speculative decoding predicts future tokens, speculatively verifies them, and accepts correct predictions while rejecting incorrect ones.

---

## 3. Speculative Decoding: Core Algorithm

### 3.1 Setup

We have two models:

- **Target model** $M_{\text{target}}$: The large, high-quality model we want to sample from. Forward pass cost: $C_{\text{target}}$.
- **Draft model** $M_{\text{draft}}$: A smaller, faster model that approximates the target. Forward pass cost: $C_{\text{draft}} \ll C_{\text{target}}$.

Goal: Generate tokens from exactly the distribution $p_{\text{target}}$, but with lower wall-clock latency than standard autoregressive decoding.

### 3.2 The Algorithm (Leviathan et al., 2023; Chen et al., 2023)

**Algorithm: Speculative Decoding**

```
Input: Target model p, draft model q, draft length K, prefix x_{1:n}
Output: One or more new tokens sampled from p

1. DRAFT PHASE:
   For i = 1, ..., K:
     Sample x̃_{n+i} ~ q(· | x_{1:n}, x̃_{n+1:n+i-1})
     Store q_i = q(x̃_{n+i} | x_{1:n}, x̃_{n+1:n+i-1})

2. VERIFY PHASE:
   Run target model on [x_{1:n}, x̃_{n+1}, ..., x̃_{n+K}] in one forward pass
   Obtain p_i = p(x̃_{n+i} | x_{1:n}, x̃_{n+1:n+i-1}) for all i = 1, ..., K
   Also obtain p_{K+1}(·) = p(· | x_{1:n}, x̃_{n+1:n+K})

3. ACCEPTANCE/REJECTION:
   For i = 1, ..., K:
     Sample u ~ Uniform(0, 1)
     If u < min(1, p_i / q_i):
       ACCEPT x̃_{n+i}
     Else:
       REJECT x̃_{n+i}
       Sample x_{n+i} from the adjusted distribution:
         p'(x) = normalize(max(0, p(x) - q(x)))
       Discard x̃_{n+i+1}, ..., x̃_{n+K}
       Return accepted tokens + x_{n+i}

4. If all K tokens accepted:
   Sample x_{n+K+1} ~ p_{K+1}(·)
   Return all K+1 tokens
```

### 3.3 Proof of Correctness

**Theorem 3.1 (Speculative Decoding Exactness).** The speculative decoding algorithm samples each token from exactly the target distribution $p_{\text{target}}$.

*Proof.* We need to show that for each position, the marginal distribution of the accepted token is $p_{\text{target}}$.

Consider position $n + i$ (assuming all previous tokens were accepted). The draft proposes $\tilde{x} \sim q(\cdot)$. The token is accepted with probability $\min(1, p(\tilde{x})/q(\tilde{x}))$.

**Case 1: Token accepted.** The probability that draft value $x$ is proposed and accepted is:

$$\Pr[\text{output} = x, \text{accepted}] = q(x) \cdot \min\!\left(1, \frac{p(x)}{q(x)}\right) = \min(q(x), p(x))$$

**Case 2: Token rejected.** The total rejection probability is:

$$\beta = 1 - \sum_x \min(q(x), p(x)) = 1 - \sum_x \min(q(x), p(x))$$

Note that $\sum_x \min(q(x), p(x)) = 1 - \frac{1}{2}\sum_x |p(x) - q(x)| = 1 - D_{\text{TV}}(p, q)$, where $D_{\text{TV}}$ is the total variation distance. So $\beta = D_{\text{TV}}(p, q)$.

Upon rejection, we sample from the adjusted distribution:

$$p'(x) = \frac{\max(0, p(x) - q(x))}{\sum_{x'} \max(0, p(x') - q(x'))}$$

The denominator equals $\beta$ because:

$$\sum_x \max(0, p(x) - q(x)) = \sum_{x: p(x) > q(x)} (p(x) - q(x))$$

and by the identity $\sum_x p(x) - \sum_x \min(p(x), q(x)) = \sum_{x: p(x) > q(x)} (p(x) - q(x)) = 1 - (1 - \beta) = \beta$.

**Combining both cases:**

$$\Pr[\text{output} = x] = \min(q(x), p(x)) + \beta \cdot \frac{\max(0, p(x) - q(x))}{\beta}$$

$$= \min(q(x), p(x)) + \max(0, p(x) - q(x))$$

$$= p(x) \qquad \blacksquare$$

The last step uses the identity: for any $a, b \geq 0$, $\min(a, b) + \max(0, a - b) = a$.

### 3.4 Key Properties

**Property 1: Exactness.** The output distribution is exactly $p_{\text{target}}$, not an approximation. This is a remarkable property --- we get a speedup with zero quality degradation.

**Property 2: At least one token per iteration.** Even if all $K$ draft tokens are rejected, we still produce one token (either from the rejection resampling at position 1, or from direct sampling if the first token is rejected). This guarantees progress.

**Property 3: At most $K + 1$ tokens per iteration.** If all $K$ draft tokens are accepted, we also get a "bonus" token from the target model's distribution at position $K + 1$.

---

## 4. Throughput Analysis

### 4.1 Expected Tokens per Iteration

Let $\alpha$ be the **average acceptance rate** --- the probability that a single draft token is accepted. Assuming independence across positions (an approximation), the number of accepted tokens $A$ follows a geometric-like distribution.

Let $\tau$ be the expected number of tokens produced per speculation round. The first token that gets rejected (or position $K + 1$ if all are accepted) produces one token via resampling or bonus sampling. Thus:

$$\tau = \sum_{k=0}^{K-1} (k + 1)(1 - \alpha)\alpha^k + (K + 1)\alpha^K$$

This simplifies to:

$$\tau = \frac{1 - \alpha^{K+1}}{1 - \alpha}$$

*Derivation:*

$$\tau = \sum_{k=0}^{K-1} (k+1)(1-\alpha)\alpha^k + (K+1)\alpha^K$$

Let $S = \sum_{k=0}^{K-1} \alpha^k = \frac{1 - \alpha^K}{1 - \alpha}$. Then:

$$\sum_{k=0}^{K-1} (k+1)(1-\alpha)\alpha^k = (1-\alpha)\sum_{k=0}^{K-1}(k+1)\alpha^k$$

Using the identity $\sum_{k=0}^{n-1}(k+1)x^k = \frac{1 - (n+1)x^n + nx^{n+1}}{(1-x)^2}$:

$$\tau = \frac{1 - (K+1)\alpha^K + K\alpha^{K+1}}{1 - \alpha} + (K+1)\alpha^K = \frac{1 - \alpha^{K+1}}{1 - \alpha}$$

**Example values:**

| $\alpha$ | $K = 3$ | $K = 5$ | $K = 7$ |
|---|---|---|---|
| 0.5 | 1.875 | 1.969 | 1.992 |
| 0.7 | 2.760 | 3.304 | 3.572 |
| 0.9 | 3.439 | 4.686 | 5.695 |
| 0.95 | 3.726 | 5.338 | 6.834 |

### 4.2 Speedup Factor

The wall-clock time per iteration of speculative decoding is:

$$T_{\text{spec}} = K \cdot C_{\text{draft}} + C_{\text{verify}}$$

where $C_{\text{verify}}$ is the cost of running the target model on $K + 1$ tokens (the draft tokens plus one position for the bonus token). For memory-bound decode, $C_{\text{verify}} \approx C_{\text{target}}$ (the cost is dominated by loading weights, not by the number of tokens, up to the point where the concatenated draft sequence makes attention compute-bound).

The standard autoregressive cost for $\tau$ tokens is $\tau \cdot C_{\text{target}}$.

$$\text{Speedup} = \frac{\tau \cdot C_{\text{target}}}{K \cdot C_{\text{draft}} + C_{\text{target}}}$$

Let $c = C_{\text{draft}} / C_{\text{target}}$ be the relative cost of the draft model. Then:

$$\text{Speedup} = \frac{\tau}{Kc + 1} = \frac{1 - \alpha^{K+1}}{(1 - \alpha)(Kc + 1)}$$

**Optimal draft length.** Taking the derivative with respect to $K$ and setting it to zero:

$$\frac{d}{dK}\left[\frac{1 - \alpha^{K+1}}{(1-\alpha)(Kc + 1)}\right] = 0$$

$$\implies -\alpha^{K+1} \ln \alpha \cdot (Kc + 1) - c(1 - \alpha^{K+1}) = 0$$

This does not have a closed-form solution but can be solved numerically. For $\alpha = 0.8, c = 0.1$: $K^* \approx 5$. For $\alpha = 0.9, c = 0.05$: $K^* \approx 8$.

**Rule of thumb:** Higher acceptance rates and lower draft costs favor longer draft sequences.

### 4.3 When Speculative Decoding Helps (and When It Does Not)

**Helps:**

- High acceptance rate ($\alpha > 0.7$): draft model is well-aligned with target.
- Low draft cost ($c < 0.2$): draft model is much cheaper than target.
- Latency-sensitive workloads: speculative decoding reduces per-request latency.

**Does not help:**

- High-throughput batch processing: if the batch is large enough that decode is already compute-bound, speculative decoding adds overhead without benefit.
- Very low acceptance rate ($\alpha < 0.5$): the draft tokens are mostly rejected, wasting the drafting cost.
- Domains where draft and target disagree frequently (e.g., code generation with many viable continuations).

---

## 5. Draft Model Architectures

### 5.1 Smaller Language Models

The simplest approach: use a smaller model from the same family as the draft.

| Target | Draft | $c$ (relative cost) | Typical $\alpha$ |
|---|---|---|---|
| LLaMA-2 70B | LLaMA-2 7B | ~0.1 | 0.6--0.8 |
| LLaMA-2 70B | LLaMA-2 13B | ~0.19 | 0.7--0.85 |
| GPT-4 | GPT-3.5 | ~0.05 | 0.7--0.9 |

**Advantage:** Off-the-shelf models, no additional training.

**Disadvantage:** The draft model has a different tokenizer or vocabulary only if it is from a different family; otherwise, sharing is straightforward. The main issue is that smaller models may have systematically different distributions, especially for rare or technical tokens.

### 5.2 N-gram Models

For highly repetitive or predictable text, extremely simple draft models suffice:

```python
class NGramDraft:
    """Draft model based on n-gram suffix matching in the context."""

    def __init__(self, n=3, num_candidates=5):
        self.n = n
        self.num_candidates = num_candidates

    def draft(self, token_ids, K):
        """Generate K draft tokens by finding n-gram matches in context."""
        candidates = []
        context = token_ids[-self.n:]

        # Search for n-gram match in earlier context
        for i in range(len(token_ids) - self.n - 1):
            if token_ids[i:i+self.n] == context:
                # Found match; predict the next tokens
                start = i + self.n
                end = min(start + K, len(token_ids))
                candidates.append(token_ids[start:end])

        if candidates:
            return candidates[0]  # Return first match
        else:
            return None  # Fall back to target model
```

**Advantage:** Zero GPU cost ($c \approx 0$).

**Disadvantage:** Very low acceptance rate except for repetitive text. Useful as a component in hybrid strategies.

### 5.3 Medusa: Parallel Decoding Heads

**Medusa** (Cai et al., 2024) adds multiple prediction heads to the target model itself, each predicting a different future token:

$$\hat{x}_{t+k} = \text{MedusaHead}_k(h_t) \qquad k = 1, \ldots, K$$

where $h_t$ is the last hidden state from the target model at position $t$.

Each Medusa head is a small MLP (typically 1--2 layers) trained on top of the frozen base model:

```python
class MedusaHead(nn.Module):
    def __init__(self, hidden_size, vocab_size):
        super().__init__()
        self.linear1 = nn.Linear(hidden_size, hidden_size)
        self.act = nn.SiLU()
        self.linear2 = nn.Linear(hidden_size, vocab_size)
        # Residual connection from the base model's lm_head
        self.base_lm_head = None  # shared reference

    def forward(self, hidden_states):
        x = self.linear1(hidden_states)
        x = self.act(x) + hidden_states  # residual
        return self.linear2(x)
```

**Advantage:** No separate draft model; heads are cheap ($< 1\%$ of target model parameters each). Draft cost is amortized with the target forward pass.

**Disadvantage:** Requires training the Medusa heads (fine-tuning on representative data). Head predictions degrade for positions far from $t$.

### 5.4 EAGLE: Extrapolation-Based Draft

**EAGLE** (Li et al., 2024) uses the target model's own hidden states to predict future hidden states, then uses those predicted states to generate draft tokens:

$$\hat{h}_{t+1} = \text{EAGLE\_Net}(h_t, \text{emb}(x_t))$$

$$\hat{x}_{t+1} = \text{LM\_Head}(\hat{h}_{t+1})$$

The EAGLE network is a lightweight Transformer (typically 1--2 layers with the same hidden dimension as the target) that autoregressively predicts future hidden states. Because hidden states change more smoothly than token distributions, this extrapolation is more accurate than directly predicting tokens.

**Reported results:** EAGLE-2 achieves 3--4x speedup on coding and chat benchmarks with LLaMA-2 70B, outperforming Medusa and standard speculative decoding.

---

## 6. Tree-Structured Speculation

### 6.1 Motivation

Standard speculative decoding proposes a single chain of $K$ tokens. If the $i$-th token is rejected, tokens $i+1, \ldots, K$ are discarded regardless of their quality. This is wasteful when the draft model is uncertain: it might propose the wrong token at position $i$ but the right token at position $i+1$ given a different predecessor.

### 6.2 Tree Drafting

Instead of a single chain, the draft model generates a **tree** of candidates:

```
Position t:   [token A]
              /        \
Position t+1: [token B]  [token C]
              /    \        \
Position t+2: [D]  [E]     [F]
```

Each path from root to leaf is a candidate continuation. The target model verifies all paths in a single forward pass using a carefully constructed attention mask.

### 6.3 Tree Attention Mask

To verify a tree of candidates in one forward pass, we construct a causal attention mask that reflects the tree structure:

```python
def build_tree_attention_mask(tree):
    """Build attention mask for tree-structured verification.

    Each node can attend to its ancestors (path from root to itself)
    but not to nodes on other branches.
    """
    n = len(tree.nodes)
    mask = torch.zeros(n, n, dtype=torch.bool)

    for i, node in enumerate(tree.nodes):
        # Node can attend to itself and all ancestors
        ancestor = node
        while ancestor is not None:
            j = tree.node_to_idx[ancestor]
            mask[i, j] = True
            ancestor = ancestor.parent

    return mask
```

**Example.** For the tree above (root A, children B and C, grandchildren D, E under B and F under C), the attention mask is:

$$M = \begin{pmatrix} 1 & 0 & 0 & 0 & 0 & 0 \\ 1 & 1 & 0 & 0 & 0 & 0 \\ 1 & 0 & 1 & 0 & 0 & 0 \\ 1 & 1 & 0 & 1 & 0 & 0 \\ 1 & 1 & 0 & 0 & 1 & 0 \\ 1 & 0 & 1 & 0 & 0 & 1 \end{pmatrix} \quad \begin{matrix} A \\ B \\ C \\ D \\ E \\ F \end{matrix}$$

Node D attends to A, B, D (its ancestors + itself), not to C, E, or F.

### 6.4 Tree Verification and Acceptance

After running the target model with the tree attention mask, we obtain $p_{\text{target}}(\cdot \mid \text{ancestors})$ for each node. The acceptance/rejection proceeds path by path, from root to leaves:

1. Start at the root. Accept or reject using the standard speculative decoding criterion.
2. If accepted, proceed to each child and repeat.
3. If rejected, prune the entire subtree.
4. Select the longest accepted path.

**Theorem 6.1 (Tree Speculation Yield).** For a $b$-ary tree of depth $K$, the expected number of accepted tokens along the best root-to-leaf path satisfies:

$$\tau_{\text{tree}}(K, b, \alpha) \geq \tau_{\text{chain}}(K, \alpha) = \frac{1 - \alpha^{K+1}}{1 - \alpha}$$

with equality when $b = 1$ (the tree degenerates to a chain). For $b > 1$, at each depth multiple candidates increase the probability that at least one token is accepted, so $\tau_{\text{tree}} > \tau_{\text{chain}}$.

The exact formula for $\tau_{\text{tree}}$ depends on the tree topology (balanced vs. skewed, how candidates are distributed across branches) and on the correlation structure of acceptance across siblings. Miao et al. (SpecInfer, 2024) provide analysis for specific tree structures. As an approximation for a complete $b$-ary tree with independent per-token acceptance probability $\alpha$, the probability of at least one acceptance at depth $k$ (given acceptance at depth $k-1$) is $1 - (1-\alpha)^b$, which exceeds the single-chain probability $\alpha$ when $b > 1$.

### 6.5 Cost Analysis

The tree with $b^0 + b^1 + \cdots + b^K = \frac{b^{K+1} - 1}{b - 1}$ total nodes requires the target model to process that many tokens in the verification pass. The cost increases with the tree size, creating a tradeoff:

$$\text{Speedup}_{\text{tree}} = \frac{\tau_{\text{tree}} \cdot C_{\text{target}}}{\text{Draft cost} + C_{\text{verify}}(|\text{tree}|)}$$

In the memory-bound regime, $C_{\text{verify}}$ is approximately constant (dominated by weight loading) as long as the tree fits in a single forward pass. This makes tree speculation particularly attractive.

**SpecInfer** (Miao et al., 2024) uses multiple draft models to generate different branches of the tree, further improving coverage.

---

## 7. Implementation Considerations

### 7.1 KV Cache Management for Speculation

Speculative decoding complicates KV cache management:

- **Draft phase:** The draft model builds its own KV cache.
- **Verification phase:** The target model processes the draft sequence. Upon rejection at position $i$, the target model's KV cache for positions $> i$ must be discarded.
- **Rollback:** The KV cache must support efficient prefix truncation.

With PagedAttention, rollback is cheap: simply update the block table to remove blocks beyond the rejection point (or update the sequence length counter within the last valid block).

### 7.2 Batch Speculation

When serving multiple requests, speculative decoding interacts with continuous batching:

- Different requests may accept different numbers of draft tokens, leading to variable advancement per step.
- The scheduler must handle the case where some requests advance by $K$ tokens while others advance by only 1.
- Draft and verification steps can be pipelined across different request groups.

### 7.3 Sampling Temperature and Acceptance Rate

The acceptance rate depends on the sampling temperature. At temperature $T$:

$$p_T(x) = \frac{\exp(\text{logit}(x) / T)}{\sum_{x'} \exp(\text{logit}(x') / T)}$$

At $T \to 0$ (greedy decoding), both draft and target converge to argmax, giving $\alpha \to 1$ when they agree on the top token. At $T \to \infty$ (uniform sampling), $\alpha \to 0$ because the distributions become independent.

**Practical implication:** Speculative decoding provides the largest speedups for low-temperature (high-confidence) generation tasks like code completion and factual Q&A, and the smallest speedups for high-temperature creative writing.

---

## Key Takeaways

1. **Speculative decoding exploits the asymmetry between sequential generation and parallel verification** to reduce latency without changing the output distribution.
2. **The algorithm is provably exact:** through the acceptance/rejection scheme with adjusted resampling, each token is sampled from exactly the target model's distribution.
3. **Expected speedup** is $\frac{1 - \alpha^{K+1}}{(1 - \alpha)(Kc + 1)}$ where $\alpha$ is the acceptance rate, $K$ is the draft length, and $c$ is the relative draft cost. High acceptance rates and cheap draft models yield the best speedups.
4. **Draft model choice** ranges from independent smaller LMs (simplest) to parameter-efficient extensions of the target model (Medusa, EAGLE), each with different tradeoffs in acceptance rate, draft cost, and implementation complexity.
5. **Tree-structured speculation** generalizes linear drafting by exploring multiple continuations, increasing the probability of acceptance at each depth. The cost grows with tree size but is often amortized in the memory-bound regime.

---

## Further Reading

1. **Leviathan, Kalman, and Matias.** "Fast Inference from Transformers via Speculative Decoding." ICML 2023.
2. **Chen, Borgeaud, et al.** "Accelerating Large Language Model Decoding with Speculative Sampling." arXiv 2023.
3. **Cai et al.** "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads." ICML 2024.
4. **Li et al.** "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty." ICML 2024.
5. **Li et al.** "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees." arXiv 2024.
6. **Miao et al.** "SpecInfer: Accelerating Large Language Model Serving with Tree-based Speculative Inference and Verification." ASPLOS 2024.
7. **Sun et al.** "SpecTr: Fast Speculative Decoding via Optimal Transport." NeurIPS 2023.
8. **Stern, Shazeer, and Uszkoreit.** "Blockwise Parallel Decoding for Deep Autoregressive Models." NeurIPS 2018. --- Early work on parallel draft-verify.
