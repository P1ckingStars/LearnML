# Homework 05: MiniGPT — Building a Language Model from Scratch

> **Module 05 — LLMs & Pretraining**
> Estimated time: ~20 hours
> Due: Two weeks from assignment date

---

## Overview

In this homework, you will build a complete language model pipeline from tokenization through training and generation. Part A focuses on the mathematical foundations; Part B is a full implementation project.

**What you will build:**
1. A BPE tokenizer from scratch
2. GPT-2 Small (124M parameters) from scratch in PyTorch
3. A training pipeline with modern best practices
4. KV cache for efficient inference
5. Text generation with sampling strategies

---

## Part A: Theory (50%)

### Problem A.1: Autoregressive Loss Derivation (10%)

**(a)** Let $\mathbf{x} = (x_1, x_2, \ldots, x_T)$ be a sequence of tokens from vocabulary $\mathcal{V}$. Starting from the chain rule of probability, derive the autoregressive loss:

$$\mathcal{L}_{\text{CLM}}(\theta) = -\frac{1}{T}\sum_{t=1}^{T} \log p_\theta(x_t \mid x_1, \ldots, x_{t-1})$$

**(b)** Prove that minimizing $\mathcal{L}_{\text{CLM}}$ over a dataset $\mathcal{D} = \{\mathbf{x}^{(1)}, \ldots, \mathbf{x}^{(M)}\}$ is equivalent to minimizing the forward KL divergence $D_{\text{KL}}(p_{\text{data}} \| p_\theta)$.

**(c)** Why is this the forward KL and not the reverse KL? Discuss what happens when $p_\theta$ assigns zero probability to a sequence that has nonzero probability under $p_{\text{data}}$. How does this relate to the "mode-covering" behavior of maximum likelihood estimation?

### Problem A.2: Teacher Forcing (10%)

**(a)** Formally define teacher forcing. Let $\hat{x}_t \sim p_\theta(\cdot \mid x_1, \ldots, x_{t-1})$ be a sample from the model at time $t$. Write down the two possible training objectives:

$$\mathcal{L}_{\text{TF}}(\theta) = -\sum_t \log p_\theta(x_t \mid \underbrace{x_1, \ldots, x_{t-1}}_{\text{ground truth}})$$

$$\mathcal{L}_{\text{FR}}(\theta) = -\sum_t \log p_\theta(x_t \mid \underbrace{\hat{x}_1, \ldots, \hat{x}_{t-1}}_{\text{model samples}})$$

Prove that $\mathcal{L}_{\text{TF}}$ corresponds to exact maximum likelihood estimation of $p_\theta(\mathbf{x})$, while $\mathcal{L}_{\text{FR}}$ does not.

**(b)** The discrepancy between teacher forcing (training) and free-running (inference) is called *exposure bias*. Formally, let $p_{\text{prefix}}^{\text{train}}(x_{<t}) = \delta(\mathbf{x}_{<t}^*)$ (Dirac on the ground truth) and $p_{\text{prefix}}^{\text{test}}(x_{<t}) = \prod_{s<t} p_\theta(x_s \mid \hat{x}_{<s})$ (autoregressive). Show that the expected loss under these two prefix distributions can differ by:

$$|\mathbb{E}_{p_{\text{train}}}[\ell_t] - \mathbb{E}_{p_{\text{test}}}[\ell_t]| \leq \sqrt{2 \cdot D_{\text{KL}}(p_{\text{train}} \| p_{\text{test}})} \cdot \sqrt{\text{Var}[\ell_t]}$$

using Pinsker's inequality. Interpret this bound: when is exposure bias small?

**(c)** Scheduled sampling (Bengio et al., 2015) mixes teacher forcing and free-running during training with probability $\epsilon_t$ of using model samples, where $\epsilon_t$ increases over training. Discuss why this does NOT correspond to a valid likelihood objective and why it can still help in practice.

### Problem A.3: Scaling Law Analysis (15%)

**(a)** Starting from the scaling law $L(N, D) = A/N^\alpha + B/D^\beta + L_\infty$ with the constraint $C = 6ND$, derive the Chinchilla-optimal allocation:

$$N^* = \left(\frac{A\alpha}{B\beta \cdot 6^\beta}\right)^{\frac{1}{\alpha+\beta}} C^{\frac{\beta}{\alpha+\beta}}, \quad D^* = \frac{C}{6N^*}$$

Show all steps of the Lagrange multiplier derivation.

**(b)** Using the Hoffmann et al. values $A = 406.4$, $B = 410.7$, $\alpha = 0.34$, $\beta = 0.28$, $L_\infty = 1.69$:

Compute the optimal $N^*$ and $D^*$ for the following compute budgets and fill in the table:

| Compute $C$ (FLOPs) | $N^*$ (params) | $D^*$ (tokens) | $L^*$ (nats) |
|---------------------|----------------|----------------|---------------|
| $10^{18}$ | | | |
| $10^{20}$ | | | |
| $10^{22}$ | | | |
| $10^{24}$ | | | |

**(c)** You have a budget of $C = 10^{21}$ FLOPs. Your colleague suggests training a 13B parameter model on 13B tokens. You suggest following Chinchilla. Compute the expected loss for both approaches and the percentage improvement from following the scaling law.

**(d)** The LLaMA-3-8B model was trained on 15T tokens (well beyond Chinchilla-optimal). Using the scaling law, compute what the Chinchilla-optimal data would be for an 8B model. Why might Meta have chosen to "over-train" beyond the Chinchilla point? (Hint: consider inference cost.)

### Problem A.4: BPE Algorithm Analysis (15%)

**(a)** Formally state the BPE merge algorithm. At each step, we merge the most frequent adjacent pair. Prove that this greedy strategy maximizes the single-step reduction in total encoded corpus length (in tokens).

**(b)** Consider the following toy corpus with word frequencies:

| Word | Frequency |
|------|-----------|
| `low` | 5 |
| `lower` | 2 |
| `newest` | 6 |
| `widest` | 3 |

Represent each word as a character sequence with an end-of-word marker `_`. Manually execute 10 BPE merge operations. For each step, show:
- The pair counts
- The selected pair
- The updated corpus representation

**(c)** After your 10 merges, what is the final vocabulary? Tokenize the word `"lowest"` using the learned merge rules. Is the tokenization unique? Prove that BPE tokenization (applying merge rules in the learned order) always produces a unique tokenization for any input string.

**(d)** Compare the time complexity of BPE training ($O(K \cdot N)$ naive, where $K$ = number of merges and $N$ = corpus size in tokens) with BPE inference ($O(K \cdot |s|)$ for string $s$). Describe how to reduce inference complexity to $O(|s| \cdot \log |s|)$ using a priority queue. What is the space complexity of the vocabulary plus merge rules?

---

## Part B: Implementation (50%)

### Setup

```bash
# Create environment
conda create -n minigpt python=3.11
conda activate minigpt
pip install torch numpy matplotlib tiktoken datasets tqdm wandb
```

### Problem B.1: BPE Tokenizer from Scratch (10%)

Implement a Byte Pair Encoding tokenizer without using any tokenization libraries.

**Requirements:**
1. Implement `train(text: str, vocab_size: int)` following the BPE algorithm.
2. Implement `encode(text: str) -> list[int]` that tokenizes text using learned merge rules.
3. Implement `decode(token_ids: list[int]) -> str` that converts tokens back to text.
4. Implement `save(path: str)` and `load(path: str)` for persistence.

**Tests:**
- Roundtrip: `decode(encode(text)) == text` for any input.
- Vocabulary size: after training, `len(vocab) == target_vocab_size`.
- Train on the first 1MB of OpenWebText. Report vocabulary contents and fertility.

```python
class BPETokenizer:
    def __init__(self):
        self.merges = []           # list of (str, str) merge rules
        self.vocab = {}            # str -> int
        self.inverse_vocab = {}    # int -> str

    def train(self, text: str, vocab_size: int = 10000) -> None:
        """Train the tokenizer on a text corpus."""
        # YOUR CODE HERE
        pass

    def encode(self, text: str) -> list[int]:
        """Encode text to token ids."""
        # YOUR CODE HERE
        pass

    def decode(self, ids: list[int]) -> str:
        """Decode token ids back to text."""
        # YOUR CODE HERE
        pass
```

**Deliverables:**
- Source code for the tokenizer.
- A plot of corpus token count vs. number of merges.
- The 20 most common tokens in the trained vocabulary.
- Fertility comparison: your tokenizer vs. GPT-2's tiktoken tokenizer on 100 sentences.

### Problem B.2: GPT-2 Small from Scratch (15%)

Implement the full GPT-2 124M architecture. You must implement every component from scratch (no `nn.TransformerDecoderLayer` or similar).

**Architecture specification:**

| Component | Specification |
|-----------|--------------|
| Layers | 12 |
| $d_{\text{model}}$ | 768 |
| Heads | 12 |
| $d_{\text{ff}}$ | 3072 |
| Vocab size | Your BPE vocab size (or 50257 for GPT-2 compat) |
| Max seq len | 1024 |
| Activation | GELU |
| Normalization | Pre-LayerNorm |
| Weight tying | Embedding = Unembedding |

**Components to implement:**

```python
class MultiHeadCausalAttention(nn.Module):
    """Multi-head attention with causal mask and optional KV cache."""
    # Shape annotations required for every tensor operation

class FeedForward(nn.Module):
    """Position-wise FFN: Linear(d, 4d) -> GELU -> Linear(4d, d)."""

class TransformerBlock(nn.Module):
    """Pre-LN: x + Attn(LN(x)), then x + FFN(LN(x))."""

class GPT2(nn.Module):
    """Full GPT-2 model with generate() method."""
```

**Deliverables:**
- Source code with shape annotations on every tensor.
- Verify parameter count is approximately 124M (within 1%).
- **(Bonus, +5%)**: Load pretrained GPT-2 weights from HuggingFace and verify your model produces identical logits (to within fp32 numerical precision).

### Problem B.3: Training Pipeline (10%)

Train your GPT-2 on a subset of OpenWebText (or Tiny Shakespeare for a lighter version).

**Requirements:**

1. **Data loading**: Implement a data loader that:
   - Tokenizes text with your BPE tokenizer (or tiktoken for speed)
   - Creates fixed-length sequences of 1024 tokens
   - Returns `(input_ids, targets)` where targets are input_ids shifted by one position

2. **Optimizer**: AdamW with:
   - $\beta_1 = 0.9$, $\beta_2 = 0.95$
   - Weight decay $= 0.1$ (applied to weights only, not biases or LayerNorm parameters)
   - Learning rate: $6 \times 10^{-4}$ peak

3. **Learning rate schedule**: Implement from scratch (no `lr_scheduler`):
   - Linear warmup for 2000 steps
   - Cosine decay to $6 \times 10^{-5}$

4. **Gradient clipping**: Clip gradient norm to 1.0.

5. **Gradient accumulation**: Support effective batch sizes larger than GPU memory allows. Implement accumulation over $A$ microbatches:

$$g_{\text{eff}} = \frac{1}{A} \sum_{a=1}^{A} g_a$$

6. **Logging**: Track and plot:
   - Training loss per step
   - Validation loss every 500 steps
   - Learning rate per step
   - Gradient norm per step
   - Tokens per second

**Deliverables:**
- Training script with all components above.
- Training curves (loss, LR, grad norm, throughput) plotted over training.
- Final validation perplexity.
- If training on OpenWebText: train for at least 10,000 steps with effective batch size 32 (32 sequences of 1024 tokens = ~32K tokens per step).
- If training on Tiny Shakespeare: train for at least 5,000 steps.

### Problem B.4: KV Cache and Generation (10%)

Implement efficient autoregressive generation with a KV cache.

**Requirements:**

1. **KV cache**: Modify your attention module to support caching keys and values:
   - `forward(x, kv_cache=None) -> (output, new_kv_cache)`
   - During generation, only the new token's Q, K, V are computed
   - K and V are appended to the cache; attention is computed against the full cache

2. **Sampling strategies**: Implement all of:
   - Greedy (argmax)
   - Temperature sampling with temperature $\tau$
   - Top-$k$ sampling
   - Top-$p$ (nucleus) sampling
   - Combining temperature + top-$k$ + top-$p$

3. **Benchmarking**: Measure tokens/second for generation:
   - Without KV cache (recompute from scratch at each step)
   - With KV cache
   - Report speedup for prompt lengths $P \in \{64, 256, 512\}$ and generation lengths $G \in \{64, 256\}$.

**Deliverables:**
- KV cache implementation with shape annotations.
- Generated text samples (10 samples, 200 tokens each) with different sampling strategies:
  - Greedy
  - Temperature $\tau = 0.8$, top-$k = 50$
  - Temperature $\tau = 1.0$, top-$p = 0.95$
- Benchmark table showing tokens/second with and without KV cache.
- Analysis: which sampling strategy produces the most coherent text? Why?

### Problem B.5: Perplexity Evaluation (5%)

Implement perplexity computation and evaluate your model.

**Requirements:**

1. Implement perplexity computation:

$$\text{PPL} = \exp\left(-\frac{1}{T}\sum_{t=1}^{T} \log p_\theta(x_t \mid x_{<t})\right)$$

   Handle long sequences by sliding a window of length 1024 with stride 512 (to avoid edge effects).

2. Compute perplexity on:
   - Your validation set
   - 100 randomly selected Wikipedia articles (different domain)
   - 100 code snippets from GitHub (very different domain)

3. Compare your model's perplexity to:
   - A random baseline: $\text{PPL}_{\text{random}} = |\mathcal{V}|$
   - A unigram baseline: $\text{PPL}_{\text{unigram}} = \exp(H_{\text{unigram}})$

**Deliverables:**
- Perplexity computation code.
- Table of perplexities across domains.
- Discussion: why is perplexity higher on out-of-domain text? How does this relate to the data distribution seen during training?

---

## Grading Rubric

### Part A (50%)

| Problem | Points | Criteria |
|---------|--------|----------|
| A.1 | 10 | Correct derivation (5), KL equivalence proof (3), forward vs reverse KL discussion (2) |
| A.2 | 10 | Teacher forcing proof (4), exposure bias bound (4), scheduled sampling discussion (2) |
| A.3 | 15 | Lagrange derivation (5), numerical table (4), comparison (3), over-training discussion (3) |
| A.4 | 15 | BPE formalization (3), manual execution (5), uniqueness proof (4), complexity analysis (3) |

### Part B (50%)

| Problem | Points | Criteria |
|---------|--------|----------|
| B.1 | 10 | Correct BPE implementation (5), roundtrip test (2), fertility analysis (3) |
| B.2 | 15 | Correct architecture (8), shape annotations (3), parameter count (2), bonus: weight loading (+5) |
| B.3 | 10 | Training pipeline (5), training curves (3), validation perplexity (2) |
| B.4 | 10 | KV cache (5), sampling strategies (3), benchmark (2) |
| B.5 | 5 | Perplexity computation (2), cross-domain evaluation (2), analysis (1) |

---

## Submission

Submit a `.zip` or a git repository containing:

```
hw05/
├── part_a/
│   └── solutions.pdf           # LaTeX or handwritten, scanned
├── part_b/
│   ├── tokenizer.py            # BPE tokenizer (B.1)
│   ├── model.py                # GPT-2 model (B.2)
│   ├── train.py                # Training pipeline (B.3)
│   ├── generate.py             # KV cache + generation (B.4)
│   ├── evaluate.py             # Perplexity evaluation (B.5)
│   ├── figures/                # All plots
│   └── README.md               # Setup instructions, how to run
└── wandb_link.txt              # (Optional) Link to W&B training run
```

---

## Tips

1. **Start with Part A.** The theory builds intuition for the implementation.
2. **Test incrementally.** For B.2, verify each component (attention, FFN, block) separately before assembling the full model.
3. **Use Tiny Shakespeare first.** It is small enough to iterate quickly. Switch to OpenWebText once your pipeline works.
4. **Shape annotations are mandatory.** Every tensor operation should have a comment showing the shapes. This prevents 90% of bugs.
5. **Compare to a reference.** Load GPT-2 weights from HuggingFace and check that your forward pass produces the same output. This is the single best debugging strategy.
6. **Monitor NaN/Inf.** Add assertions to check for numerical issues during training. Common culprits: softmax overflow, log(0), and uninitialized weights.
7. **Use `torch.compile` and `torch.cuda.amp.autocast`** for speed, but only after your unoptimized code is correct.
