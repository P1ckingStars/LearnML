# Homework 04: Transformer from Scratch

**Estimated time**: ~20 hours
**Due date**: See course calendar
**Submission**: A single `.zip` archive containing your Jupyter notebook(s), Python source files, and a brief PDF report.

---

## Overview

In this assignment, you will derive key theoretical properties of attention and Transformers (Part A), then build a complete GPT-style decoder-only Transformer from scratch and train it on real data (Part B).

**Rules:**
- You may NOT use `nn.TransformerDecoder`, `nn.TransformerDecoderLayer`, `nn.MultiheadAttention`, or any pre-built Transformer modules from PyTorch, HuggingFace, or other libraries.
- You MAY use basic PyTorch primitives: `nn.Linear`, `nn.LayerNorm`, `nn.Embedding`, `nn.Dropout`, `nn.Module`, and all tensor operations.
- You MAY use `torch.nn.functional.scaled_dot_product_attention` ONLY in the bonus section for benchmarking against your implementation.
- All code must be your own and well-documented.

---

## Part A: Theory (50 points)

### Problem A.1: Attention Gradient Derivation (10 points)

Let $O = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$ where $Q \in \mathbb{R}^{T_q \times d_k}$, $K \in \mathbb{R}^{T_k \times d_k}$, $V \in \mathbb{R}^{T_k \times d_v}$.

**(a)** (4 points) Derive $\frac{\partial \mathcal{L}}{\partial V}$, $\frac{\partial \mathcal{L}}{\partial Q}$, and $\frac{\partial \mathcal{L}}{\partial K}$ given $\frac{\partial \mathcal{L}}{\partial O} \in \mathbb{R}^{T_q \times d_v}$.

Show every step, including the softmax Jacobian. State the shapes of all intermediate quantities.

**(b)** (3 points) For the special case of self-attention where $Q = XW^Q$, $K = XW^K$, $V = XW^V$, derive $\frac{\partial \mathcal{L}}{\partial X}$ in terms of your results from (a) and the projection matrices.

**(c)** (3 points) Show that the gradient $\frac{\partial \mathcal{L}}{\partial Q_{i,:}}$ (the gradient for query $i$) is bounded:

$$\left\|\frac{\partial \mathcal{L}}{\partial Q_{i,:}}\right\| \leq \frac{2}{\sqrt{d_k}} \left\|\frac{\partial \mathcal{L}}{\partial O_{i,:}}\right\| \cdot \max_j \|V_{j,:}\| \cdot \max_j \|K_{j,:}\|$$

*Hint*: Use the fact that softmax Jacobian entries satisfy $|\frac{\partial \alpha_j}{\partial z_l}| \leq \alpha_j$.

### Problem A.2: Permutation Equivariance (10 points)

**(a)** (5 points) Prove that self-attention (without positional encodings) is permutation equivariant:

$$\text{SelfAttn}(\Pi X) = \Pi \, \text{SelfAttn}(X)$$

for any permutation matrix $\Pi \in \mathbb{R}^{T \times T}$. Your proof must explicitly handle the softmax step.

**(b)** (3 points) Prove that a full Transformer block (self-attention + FFN + residual connections + LayerNorm) is also permutation equivariant, assuming no positional encodings.

**(c)** (2 points) Give a concrete example showing that self-attention is NOT permutation *invariant*. That is, find $X \in \mathbb{R}^{2 \times 2}$ and a permutation $\Pi$ such that $\text{SelfAttn}(\Pi X) \neq \text{SelfAttn}(X)$ (without identity projections, i.e., $W^Q = W^K = W^V = I$).

### Problem A.3: RoPE Derivation (10 points)

**(a)** (4 points) Starting from the requirement that $\langle f(q, m), f(k, n) \rangle = g(q, k, m - n)$ for some function $g$, derive the 2D RoPE solution. Specifically:

1. Let $f: \mathbb{R}^2 \times \mathbb{Z} \to \mathbb{R}^2$. Assume $f$ is a linear transformation of its first argument: $f(x, m) = R_m x$ for some matrix $R_m$.
2. Show that the relative position property requires $R_m^\top R_n = R_{n-m}$ for all $m, n$.
3. Prove that the only $2 \times 2$ orthogonal matrices satisfying this are rotation matrices $R_m = R(m\theta)$ for some $\theta$.

**(b)** (3 points) Extend to $d$ dimensions. Show that the block-diagonal structure $\mathcal{R}_m = \text{diag}(R(m\theta_0), R(m\theta_1), \ldots)$ satisfies the relative position property, and that the dot product decomposes into a sum over 2D pairs.

**(c)** (3 points) Prove that the RoPE rotation preserves vector norms: $\|\mathcal{R}_m x\| = \|x\|$ for all $m$ and $x$. Explain why this is important for the stability of the attention computation (hint: relate to the $1/\sqrt{d_k}$ scaling argument).

### Problem A.4: Multi-Head Attention Complexity (10 points)

**(a)** (4 points) Derive the exact FLOP count for multi-head attention (including all four linear projections $W^Q, W^K, W^V, W^O$) as a function of $B$ (batch size), $T$ (sequence length), $d$ ($d_{\text{model}}$), and $h$ (number of heads). Count multiply-add operations.

**(b)** (3 points) Derive the peak memory usage (number of floats stored simultaneously) during the forward pass of multi-head attention. Consider both the activations and the parameters. Identify which tensor dominates as $T$ grows.

**(c)** (3 points) A Transformer layer consists of multi-head attention (MHA) + FFN (with hidden dimension $4d$). Derive the total FLOPs for one layer. At what sequence length $T^*$ does the attention FLOPs equal the FFN FLOPs? Compute $T^*$ for $d = 4096$.

### Problem A.5: Linear Attention Limitations (10 points)

**(a)** (4 points) Prove that the attention matrix in linear attention with feature dimension $m$ has rank at most $m$. Specifically, if $\alpha_{ij} = \frac{\phi(q_i)^\top \phi(k_j)}{\sum_l \phi(q_i)^\top \phi(k_l)}$, show that the unnormalized matrix $\tilde{A}_{ij} = \phi(q_i)^\top \phi(k_j)$ has rank $\leq m$.

**(b)** (3 points) A "hard attention" pattern corresponds to a permutation matrix $P$ (each query selects exactly one key). Show that a permutation matrix on $T$ positions has rank $T$. Conclude that linear attention with $m < T$ cannot compute hard attention.

**(c)** (3 points) Let $\kappa(q, k) = \exp(q^\top k / \sqrt{d})$ be the softmax kernel and $\phi: \mathbb{R}^d \to \mathbb{R}^m$ be a random feature map that approximates it: $\phi(q)^\top \phi(k) \approx \kappa(q, k)$. By the Johnson-Lindenstrauss lemma, what $m$ is needed to approximate $\kappa$ within multiplicative $(1 \pm \epsilon)$ factor for all $T^2$ pairs with probability $\geq 1 - \delta$? Express $m$ in terms of $T$, $\epsilon$, $\delta$.

---

## Part B: Implementation (50 points)

### Problem B.1: Multi-Head Attention with KV Cache (12 points)

Implement a `MultiHeadAttention` module from scratch with the following requirements:

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.0):
        ...

    def forward(
        self,
        x: torch.Tensor,           # (B, T, d_model)
        mask: torch.Tensor = None,  # (B, 1, T, T) or broadcastable
        kv_cache: dict = None,      # {"k": Tensor, "v": Tensor} or None
    ) -> tuple[torch.Tensor, dict]:
        """
        Returns:
            output: (B, T, d_model)
            new_kv_cache: {"k": (B, h, T_total, d_k), "v": ...}
        """
        ...
```

Requirements:
1. Must support both training (no cache) and inference (with cache).
2. Must correctly handle the causal mask.
3. Include shape annotations (comments) for every intermediate tensor.
4. Write unit tests verifying:
   - Output shape correctness.
   - Causal mask correctness (output at position $i$ does not depend on positions $> i$).
   - Cache correctness: running with cache produces the same output as running without cache on the full sequence.

### Problem B.2: Rotary Position Embeddings (8 points)

Implement RoPE and integrate it into your attention module.

```python
class RotaryPositionalEmbedding(nn.Module):
    def __init__(self, d_model: int, base: float = 10000.0):
        ...

    def forward(self, q: torch.Tensor, k: torch.Tensor, offset: int = 0):
        """
        Apply RoPE to queries and keys.
        offset: starting position (for KV cache compatibility)
        """
        ...
```

Requirements:
1. Support an `offset` parameter for KV cache compatibility (during generation, new tokens start at position `T_past`).
2. Write a test verifying the relative position property: the dot product of rotated $q$ at position $m$ and rotated $k$ at position $n$ equals the dot product at positions $m + \delta$ and $n + \delta$ for any $\delta$.

### Problem B.3: Complete Transformer Decoder (10 points)

Build a complete GPT-style Transformer:

```python
class GPTModel(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        d_model: int,
        n_heads: int,
        n_layers: int,
        d_ff: int,
        max_seq_len: int,
        dropout: float = 0.1,
    ):
        ...

    def forward(
        self,
        input_ids: torch.Tensor,   # (B, T)
        targets: torch.Tensor = None,  # (B, T) for training
    ) -> dict:
        """
        Returns dict with:
            'logits': (B, T, vocab_size)
            'loss': scalar (if targets provided)
        """
        ...

    @torch.no_grad()
    def generate(
        self,
        prompt_ids: torch.Tensor,   # (1, T_prompt)
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_k: int = 50,
    ) -> torch.Tensor:
        """Autoregressive generation with KV cache and top-k sampling."""
        ...
```

Architecture:
- Token embedding + RoPE (no separate positional embedding table since RoPE is used)
- $N$ decoder blocks, each with: LayerNorm -> MultiHeadAttention -> residual -> LayerNorm -> FFN -> residual (pre-norm)
- Final LayerNorm -> Linear output head (weight-tied with token embedding)
- FFN: $W_1$ (d_model -> d_ff) -> GELU -> $W_2$ (d_ff -> d_model)

Requirements:
1. Training forward pass: compute cross-entropy loss.
2. Generation: implement `generate()` with KV caching, temperature scaling, and top-k sampling.
3. Write a test generating text from a random model (just to verify the generation loop works).

### Problem B.4: Training on WikiText-2 (10 points)

Train your Transformer on WikiText-2:

```python
# Suggested hyperparameters (adjust based on your GPU):
config = {
    "vocab_size": ...,        # determined by tokenizer
    "d_model": 256,
    "n_heads": 4,
    "n_layers": 4,
    "d_ff": 1024,
    "max_seq_len": 256,
    "dropout": 0.1,
    "batch_size": 32,
    "learning_rate": 3e-4,
    "weight_decay": 0.01,
    "n_epochs": 10,
    "warmup_steps": 500,
}
```

Requirements:
1. Use a standard tokenizer (e.g., `tiktoken` with GPT-2 encoding or HuggingFace's `GPT2Tokenizer`).
2. Implement a proper data pipeline: tokenize the corpus, create fixed-length chunks, and batch them.
3. Use AdamW optimizer with learning rate warmup (linear warmup, then cosine decay).
4. Report:
   - Training loss curve (steps vs loss).
   - Validation perplexity at each epoch.
   - Final validation perplexity.
   - Example generated text (5-10 samples from different prompts).
5. Your model should achieve validation perplexity < 100 (baseline) or < 50 (strong).

### Problem B.5: Ablation Study (10 points)

Run the following ablation experiments and report results:

**(a) Positional Encoding Comparison (5 points)**

Train three models with identical hyperparameters but different positional encodings:
1. **Sinusoidal** (add to embeddings, no RoPE)
2. **Learned** (add to embeddings, no RoPE)
3. **RoPE** (applied to Q, K in attention)

For each, report:
- Final validation perplexity.
- Training curve.
- A length generalization test: train on sequences of length 256, then evaluate perplexity on sequences of length 512 (by feeding longer chunks from the validation set). Which encoding generalizes best?

Present results in a table and discuss.

**(b) Architecture Ablation (5 points)**

Using RoPE, compare the following configurations (keep total parameter count approximately constant by adjusting $d_{\text{model}}$ and $d_{\text{ff}}$):

| Config | Layers | Heads | $d_{\text{model}}$ | $d_{\text{ff}}$ | Approx Params |
|:-------|:------:|:-----:|:---:|:---:|:---:|
| A (shallow-wide) | 2 | 4 | 384 | 1536 | ~5M |
| B (baseline) | 4 | 4 | 256 | 1024 | ~5M |
| C (deep-narrow) | 8 | 4 | 192 | 768 | ~5M |
| D (many heads) | 4 | 8 | 256 | 1024 | ~5M |
| E (few heads) | 4 | 2 | 256 | 1024 | ~5M |

Report:
- Validation perplexity for each configuration.
- Training speed (steps/second) for each.
- Discussion: Which is best? Why? How does the number of heads affect quality?

---

## Bonus Problems (up to 15 extra points)

### Bonus 1: FlashAttention Benchmarking (5 points)

Compare your attention implementation against `torch.nn.functional.scaled_dot_product_attention` (which uses FlashAttention on CUDA):
- Measure wall-clock time for forward pass at $T \in \{128, 256, 512, 1024, 2048\}$.
- Measure peak GPU memory at each length.
- Verify that the outputs match (within floating-point tolerance).
- Plot time and memory vs $T$ for both implementations.

### Bonus 2: Multi-Query Attention (5 points)

Implement multi-query attention (MQA) and grouped-query attention (GQA). Compare KV cache memory usage during generation against standard MHA. Specifically:
- MHA ($h = 4$ KV heads), GQA ($g = 2$ KV heads), MQA ($g = 1$ KV head).
- Report generation speed (tokens/second) for each.
- Report quality (validation perplexity) for each.

### Bonus 3: Implement Simple Linear Attention (5 points)

Implement causal linear attention with the ELU+1 feature map. Compare:
- Perplexity against standard softmax attention.
- Training speed at $T \in \{256, 512, 1024\}$.
- Discuss the quality gap and relate it to Theory Problem A.5.

---

## Grading Rubric

| Component | Points | Criteria |
|:----------|:------:|:---------|
| A.1 Gradient derivation | 10 | Correct derivation with shapes, clear presentation |
| A.2 Permutation equivariance | 10 | Rigorous proof, correct counterexample |
| A.3 RoPE derivation | 10 | Complete derivation from first principles |
| A.4 Complexity analysis | 10 | Exact FLOP counts, correct crossover analysis |
| A.5 Linear attention limits | 10 | Rank argument, JL bound |
| B.1 MHA with KV cache | 12 | Correct implementation, thorough tests |
| B.2 RoPE implementation | 8 | Correct rotation, offset support, relative position test |
| B.3 Full Transformer | 10 | Complete architecture, generation loop |
| B.4 WikiText-2 training | 10 | Training pipeline, results, perplexity < 100 |
| B.5 Ablation study | 10 | All experiments, analysis |
| **Total** | **100** | |
| Bonus | up to 15 | |

## Tips

1. **Start early.** The implementation is substantial. Budget at least 3-4 days for coding and debugging.
2. **Test incrementally.** Write unit tests for each component (attention, RoPE, block, full model) before assembling the full system.
3. **Use small models for debugging.** Start with $d = 32$, $h = 2$, $N = 1$ to catch bugs quickly.
4. **Check gradient flow.** If training loss plateaus early, check that gradients are nonzero at every layer. Pre-norm should help with this.
5. **Monitor for NaN.** If you see NaN in the loss, check your attention mask (is it properly excluding future positions?) and softmax (are there all-$-\infty$ rows?).
6. **GPU memory.** If you run out of memory, reduce batch size or sequence length first. Use `torch.cuda.empty_cache()` and gradient checkpointing if needed.
7. **Reproducibility.** Set random seeds. Report your hardware (GPU model, CUDA version).
