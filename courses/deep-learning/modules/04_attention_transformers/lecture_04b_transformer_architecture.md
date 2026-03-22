# Lecture 04b: The Transformer Architecture

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Specify** the complete Transformer architecture mathematically, writing out every operation in the encoder and decoder stacks with exact shapes.
2. **Derive** the gradient flow through pre-norm vs post-norm Transformer blocks and prove that pre-norm yields better-conditioned gradients at initialization.
3. **Explain** why the feed-forward network (FFN) is necessary by proving that self-attention alone computes a weighted average in value space (a linear operation) and the FFN provides per-position nonlinearity.
4. **Analyze** residual connections in Transformers and show how they create a direct gradient path through depth.
5. **Derive** the forward and backward passes of Layer Normalization and contrast with Batch Normalization.
6. **Describe** masked self-attention in the decoder and prove that it preserves the autoregressive property.
7. **Compare** encoder-only (BERT), decoder-only (GPT), and encoder-decoder (T5) architectures, stating the inductive biases of each.

---

## 2. Motivation and Context

### 2.1 Beyond Recurrence

In Lecture 03, we saw that RNNs process sequences step by step, creating a sequential bottleneck that prevents parallelization. Even with attention (Lecture 04a), the Bahdanau-style seq2seq model still uses an RNN encoder and decoder. The self-attention mechanism, combined with position encoding, offers an alternative: process all positions in parallel, with attention providing the inter-position communication.

### 2.2 The Transformer Paper

**Vaswani et al. (2017)** proposed the Transformer in "Attention Is All You Need," removing recurrence entirely. The architecture is built from two primitives: multi-head self-attention and position-wise feed-forward networks, composed with residual connections and layer normalization. The result was faster training (full parallelism over sequence length) and superior performance on machine translation.

### 2.3 Impact

The Transformer has become the *de facto* standard architecture for:

- NLP: BERT (Devlin et al., 2019), GPT series (Radford et al., 2018, 2019; Brown et al., 2020), T5 (Raffel et al., 2020)
- Vision: ViT (Dosovitskiy et al., 2021), Swin Transformer (Liu et al., 2021)
- Multimodal: CLIP, Flamingo, GPT-4
- Science: AlphaFold 2 (Jumper et al., 2021)

Understanding every component at a mathematical level is essential.

---

## 3. Core Theory

### 3.1 High-Level Architecture

The original Transformer consists of:

1. **Encoder**: A stack of $N$ identical layers. Each layer has two sub-layers:
   - Multi-head self-attention
   - Position-wise feed-forward network

2. **Decoder**: A stack of $N$ identical layers. Each layer has three sub-layers:
   - Masked multi-head self-attention
   - Multi-head cross-attention (attending to encoder output)
   - Position-wise feed-forward network

Both stacks use residual connections and layer normalization around each sub-layer.

### 3.2 Layer Normalization

**Definition 3.1 (Layer Normalization).** Given a vector $x \in \mathbb{R}^d$, layer normalization computes:

$$\text{LayerNorm}(x) = \gamma \odot \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta$$

where:

- $\mu = \frac{1}{d} \sum_{i=1}^{d} x_i$ is the mean over features
- $\sigma^2 = \frac{1}{d} \sum_{i=1}^{d} (x_i - \mu)^2$ is the variance over features
- $\gamma, \beta \in \mathbb{R}^d$ are learnable scale and shift parameters
- $\epsilon > 0$ is a small constant for numerical stability (typically $10^{-5}$)

Applied to a matrix $X \in \mathbb{R}^{T \times d}$: normalization is performed independently for each row (each position).

**Contrast with Batch Normalization:**

- BatchNorm normalizes over the batch dimension (and spatial dimensions) for each feature.
- LayerNorm normalizes over the feature dimension for each sample (and position).
- LayerNorm has no dependence on batch statistics, making it suitable for variable-length sequences and inference without running statistics.

**Theorem 3.1 (LayerNorm Backward Pass).** Let $\hat{x} = \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}}$ and $y = \gamma \odot \hat{x} + \beta$. Given $\frac{\partial \mathcal{L}}{\partial y}$, the gradient w.r.t. $x$ is:

$$\frac{\partial \mathcal{L}}{\partial x_i} = \frac{\gamma_i}{\sqrt{\sigma^2 + \epsilon}} \left(\frac{\partial \mathcal{L}}{\partial y_i} - \frac{1}{d}\sum_{j=1}^{d} \frac{\partial \mathcal{L}}{\partial y_j} \gamma_j \cdot \frac{1}{\sqrt{\sigma^2 + \epsilon}} \cdot \frac{\partial (\sigma^2 + \epsilon)^{-1/2}}{\partial \sigma^2} \cdots \right)$$

We derive this carefully. Let $s = \sqrt{\sigma^2 + \epsilon}$, $g = \frac{\partial \mathcal{L}}{\partial y}$.

*Proof.* We need $\frac{\partial \mathcal{L}}{\partial x}$ via the chain rule through three paths: direct, through $\mu$, and through $\sigma^2$.

**Path 1: Direct.** $\frac{\partial y_i}{\partial x_i}\big|_{\mu,\sigma^2 \text{ fixed}} = \frac{\gamma_i}{s}$

**Path 2: Through $\mu$.** $\frac{\partial \mu}{\partial x_i} = \frac{1}{d}$. And $\frac{\partial y_j}{\partial \mu} = \frac{-\gamma_j}{s}$. So:

$$\frac{\partial \mathcal{L}}{\partial \mu} = \sum_j g_j \cdot \frac{-\gamma_j}{s} = -\frac{1}{s} \sum_j g_j \gamma_j$$

**Path 3: Through $\sigma^2$.** $\frac{\partial \sigma^2}{\partial x_i} = \frac{2(x_i - \mu)}{d}$. And:

$$\frac{\partial y_j}{\partial \sigma^2} = \gamma_j (x_j - \mu) \cdot \left(-\frac{1}{2}\right)(\sigma^2 + \epsilon)^{-3/2} = -\frac{\gamma_j \hat{x}_j}{2s^2}$$

So:

$$\frac{\partial \mathcal{L}}{\partial \sigma^2} = -\frac{1}{2s^2} \sum_j g_j \gamma_j \hat{x}_j$$

Combining all three paths:

$$\frac{\partial \mathcal{L}}{\partial x_i} = \frac{g_i \gamma_i}{s} + \frac{\partial \mathcal{L}}{\partial \mu} \cdot \frac{1}{d} + \frac{\partial \mathcal{L}}{\partial \sigma^2} \cdot \frac{2(x_i - \mu)}{d}$$

$$= \frac{g_i \gamma_i}{s} - \frac{1}{ds} \sum_j g_j \gamma_j - \frac{\hat{x}_i}{ds^2} \cdot s \sum_j g_j \gamma_j \hat{x}_j \cdot \frac{1}{s}$$

Simplifying with $\tilde{g}_i = g_i \gamma_i$:

$$\frac{\partial \mathcal{L}}{\partial x_i} = \frac{1}{s}\left(\tilde{g}_i - \frac{1}{d}\sum_j \tilde{g}_j - \frac{\hat{x}_i}{d} \sum_j \tilde{g}_j \hat{x}_j\right)$$

This is the standard LayerNorm backward formula. Note that it involves projecting out the mean and the correlation with $\hat{x}$, then scaling. $\blacksquare$

**Gradients w.r.t. parameters:**

$$\frac{\partial \mathcal{L}}{\partial \gamma_i} = \sum_t g_{t,i} \hat{x}_{t,i}, \qquad \frac{\partial \mathcal{L}}{\partial \beta_i} = \sum_t g_{t,i}$$

where the sum is over positions (or batch elements).

### 3.3 Post-Norm vs Pre-Norm

**Definition 3.2 (Post-Norm Transformer Block).** The original Transformer (Vaswani et al., 2017):

$$x' = \text{LayerNorm}(x + \text{SubLayer}(x))$$

**Definition 3.3 (Pre-Norm Transformer Block).** (Xiong et al., 2020; Baevski & Auli, 2019):

$$x' = x + \text{SubLayer}(\text{LayerNorm}(x))$$

**Theorem 3.2 (Gradient Flow in Pre-Norm vs Post-Norm).** Consider a stack of $N$ pre-norm blocks. The output of block $l$ is:

$$x^{(l)} = x^{(l-1)} + f_l(\text{LayerNorm}(x^{(l-1)}))$$

The gradient of the loss $\mathcal{L}$ w.r.t. the input to block $k$ satisfies:

$$\frac{\partial \mathcal{L}}{\partial x^{(k)}} = \frac{\partial \mathcal{L}}{\partial x^{(N)}} + \sum_{l=k+1}^{N} \frac{\partial \mathcal{L}}{\partial x^{(N)}} \prod_{m=l}^{N} \frac{\partial}{\partial x^{(m-1)}}\left[f_m(\text{LayerNorm}(x^{(m-1)}))\right]$$

*Proof.* By the residual connection structure:

$$\frac{\partial x^{(l)}}{\partial x^{(l-1)}} = I + \frac{\partial f_l(\text{LayerNorm}(x^{(l-1)}))}{\partial x^{(l-1)}}$$

Applying the chain rule across $N - k$ blocks:

$$\frac{\partial x^{(N)}}{\partial x^{(k)}} = \prod_{l=k+1}^{N} \left(I + J_l\right)$$

where $J_l = \frac{\partial f_l(\text{LN}(x^{(l-1)}))}{\partial x^{(l-1)}}$.

Expanding the product:

$$\prod_{l=k+1}^{N} (I + J_l) = I + \sum_{l} J_l + \sum_{l<m} J_l J_m + \cdots$$

The identity term $I$ provides a **direct gradient path** from $x^{(N)}$ to $x^{(k)}$, unattenuated by depth. This is the same mechanism that makes ResNets trainable.

For **post-norm**, the recurrence is $x^{(l)} = \text{LN}(x^{(l-1)} + f_l(x^{(l-1)}))$, so:

$$\frac{\partial x^{(l)}}{\partial x^{(l-1)}} = \frac{\partial \text{LN}}{\partial \cdot} \cdot (I + J_l)$$

The LayerNorm Jacobian $\frac{\partial \text{LN}}{\partial \cdot}$ is a contraction (it projects out the mean and normalizes), so the gradient magnitude decreases through each layer. With $N$ layers, this compounding contraction can cause vanishing gradients. $\blacksquare$

**Practical consequence**: Pre-norm Transformers train more stably and require less warmup. Post-norm Transformers can achieve slightly better final performance but are harder to train without careful learning rate scheduling.

### 3.4 Position-Wise Feed-Forward Network

**Definition 3.4 (FFN).** The position-wise feed-forward network applies the same two-layer MLP independently to each position:

$$\text{FFN}(x) = W_2 \, \sigma(W_1 x + b_1) + b_2$$

where $W_1 \in \mathbb{R}^{d_{\text{ff}} \times d_{\text{model}}}$, $W_2 \in \mathbb{R}^{d_{\text{model}} \times d_{\text{ff}}}$, and typically $d_{\text{ff}} = 4 \cdot d_{\text{model}}$.

The activation $\sigma$ is ReLU in the original Transformer; modern variants use GELU or SwiGLU.

**Theorem 3.3 (Necessity of FFN).** Self-attention without the FFN is a *linear* operation in the value space. Specifically, the output of self-attention for position $i$ is:

$$\text{Attn}(X)_i = \sum_j \alpha_{ij} v_j = \sum_j \alpha_{ij} X_j W^V$$

which is a convex combination (weighted average) of linear projections of the input. Without the FFN, stacking attention layers produces:

$$\text{Layer}_{l+1}(X)_i = \sum_j \alpha_{ij}^{(l+1)} \text{Layer}_l(X)_j W^V_{l+1}$$

Each layer applies a different weighted average followed by a linear map. The composition is still linear in $X$ (the weights $\alpha$ depend on $X$ nonlinearly, but the output is linear in $V = XW^V$). The FFN introduces per-position nonlinearity that allows each position to transform its representation independently.

*Proof.* Fix the attention weights $A = [\alpha_{ij}]$ (which depend on $Q, K$ but not $V$). The output is $O = AV = A X W^V$. This is a linear function of $X$ (for fixed $A$). Without nonlinearity, stacking such layers gives $O^{(L)} = A^{(L)} \cdots A^{(1)} X W^{V_1} \cdots W^{V_L}$, which is still in the span of the original token embeddings (up to linear transformation). The FFN breaks this linearity. $\blacksquare$

**Remark on SwiGLU.** The SwiGLU activation (Shazeer, 2020), now standard in modern LLMs, replaces the FFN with:

$$\text{SwiGLU}(x) = (\text{Swish}(xW_1) \odot xW_3) W_2$$

where $\text{Swish}(z) = z \cdot \sigma(z)$ ($\sigma$ is the sigmoid). This uses three weight matrices but empirically outperforms ReLU and GELU.

### 3.5 Residual Connections

**Definition 3.5 (Residual Sub-Layer).** Each sub-layer (attention or FFN) is wrapped with a residual connection:

$$x' = x + \text{SubLayer}(x)$$

**Proposition 3.1.** Residual connections in Transformers create an ensemble of shallow paths. A Transformer with $N$ blocks has $2^N$ paths from input to output (each sub-layer can be either "used" or "skipped" via the residual). Empirically, most gradient signal flows through shorter paths (Veit et al., 2016).

### 3.6 Complete Encoder Block

One encoder block (pre-norm) computes:

$$\begin{aligned}
x_1 &= x + \text{MultiHeadAttn}(\text{LN}(x), \text{LN}(x), \text{LN}(x)) \\
x_2 &= x_1 + \text{FFN}(\text{LN}(x_1))
\end{aligned}$$

In more detail, with shapes ($B$ = batch, $T$ = sequence length, $d$ = $d_{\text{model}}$):

```
Input:  x ∈ ℝ^{B × T × d}

Sub-layer 1 (Self-Attention):
  x_norm = LayerNorm(x)                           # (B, T, d)
  Q = x_norm W^Q                                  # (B, T, d)
  K = x_norm W^K                                  # (B, T, d)
  V = x_norm W^V                                  # (B, T, d)
  attn_out = MultiHeadAttn(Q, K, V)               # (B, T, d)
  x₁ = x + Dropout(attn_out)                      # (B, T, d)

Sub-layer 2 (FFN):
  x₁_norm = LayerNorm(x₁)                         # (B, T, d)
  ffn_out = W₂ · ReLU(W₁ · x₁_norm + b₁) + b₂    # (B, T, d)
  x₂ = x₁ + Dropout(ffn_out)                      # (B, T, d)

Output: x₂ ∈ ℝ^{B × T × d}
```

### 3.7 Complete Decoder Block

One decoder block (pre-norm) has three sub-layers:

```
Input:  y ∈ ℝ^{B × T_dec × d}     (decoder input)
        enc_out ∈ ℝ^{B × T_enc × d}  (encoder output)

Sub-layer 1 (Masked Self-Attention):
  y_norm = LayerNorm(y)                                    # (B, T_dec, d)
  Q = y_norm W^Q₁, K = y_norm W^K₁, V = y_norm W^V₁
  mask = causal_mask(T_dec)                                # lower triangular
  self_attn_out = MultiHeadAttn(Q, K, V, mask=mask)        # (B, T_dec, d)
  y₁ = y + Dropout(self_attn_out)                          # (B, T_dec, d)

Sub-layer 2 (Cross-Attention):
  y₁_norm = LayerNorm(y₁)                                 # (B, T_dec, d)
  enc_norm = LayerNorm(enc_out)                            # (B, T_enc, d)
  Q = y₁_norm W^Q₂                                        # (B, T_dec, d)
  K = enc_norm W^K₂, V = enc_norm W^V₂                    # (B, T_enc, d)
  cross_attn_out = MultiHeadAttn(Q, K, V)                  # (B, T_dec, d)
  y₂ = y₁ + Dropout(cross_attn_out)                       # (B, T_dec, d)

Sub-layer 3 (FFN):
  y₂_norm = LayerNorm(y₂)                                 # (B, T_dec, d)
  ffn_out = W₂ · ReLU(W₁ · y₂_norm + b₁) + b₂            # (B, T_dec, d)
  y₃ = y₂ + Dropout(ffn_out)                              # (B, T_dec, d)

Output: y₃ ∈ ℝ^{B × T_dec × d}
```

### 3.8 Masked Self-Attention and the Autoregressive Property

**Definition 3.6 (Causal Mask).** The causal mask $M \in \{0, 1\}^{T \times T}$ is:

$$M_{ij} = \begin{cases} 1 & \text{if } j \leq i \\ 0 & \text{if } j > i \end{cases} = \mathbb{1}[j \leq i]$$

This is the lower-triangular matrix. Before softmax, we set $S_{ij} = -\infty$ wherever $M_{ij} = 0$.

**Theorem 3.4 (Autoregressive Property).** Masked self-attention preserves the autoregressive property: the output at position $i$ depends only on inputs at positions $\{1, \ldots, i\}$.

*Proof.* The attention scores after masking are:

$$\tilde{S}_{ij} = \begin{cases} S_{ij} & \text{if } j \leq i \\ -\infty & \text{if } j > i \end{cases}$$

After softmax: $\alpha_{ij} = \frac{\exp(\tilde{S}_{ij})}{\sum_l \exp(\tilde{S}_{il})}$. Since $\tilde{S}_{ij} = -\infty$ for $j > i$, we get $\exp(\tilde{S}_{ij}) = 0$ for $j > i$. Therefore $\alpha_{ij} = 0$ for $j > i$ and the output is:

$$o_i = \sum_{j=1}^{T} \alpha_{ij} v_j = \sum_{j=1}^{i} \alpha_{ij} v_j$$

which depends only on $v_1, \ldots, v_i$ (and $k_1, \ldots, k_i$ through the attention weights). Since $v_j$ and $k_j$ are computed from $x_j$ only, the output at position $i$ is a function of $x_1, \ldots, x_i$ only. $\blacksquare$

### 3.9 Architectural Variants

**Definition 3.7 (Encoder-Only: BERT).** (Devlin et al., 2019)

- Stack of $N$ encoder blocks with bidirectional (unmasked) self-attention.
- Input: token sequence with special tokens [CLS] and [SEP].
- Pre-training: Masked Language Modeling (MLM) --- predict randomly masked tokens using full bidirectional context. Next Sentence Prediction (NSP) as auxiliary task.
- Inductive bias: Each token sees the *entire* input. Best for classification and understanding tasks.

**Definition 3.8 (Decoder-Only: GPT).** (Radford et al., 2018)

- Stack of $N$ decoder blocks with causal (masked) self-attention. No cross-attention (no encoder).
- Pre-training: Autoregressive language modeling --- predict the next token given all previous tokens.
- At inference, generation proceeds left to right, one token at a time.
- Inductive bias: Strictly causal. Natural for generation tasks. Can be adapted for all tasks via prompting.

**Definition 3.9 (Encoder-Decoder: T5).** (Raffel et al., 2020)

- Full encoder-decoder Transformer.
- Pre-training: Span corruption --- replace random spans with sentinel tokens, decoder generates the missing spans.
- Inductive bias: Encoder sees full input bidirectionally; decoder generates output autoregressively conditioned on encoder output. Natural for sequence-to-sequence tasks (translation, summarization).

**Comparison:**

| Aspect | Encoder-Only | Decoder-Only | Encoder-Decoder |
|--------|:-------------|:-------------|:----------------|
| Attention | Bidirectional | Causal | Enc: bidirectional, Dec: causal + cross |
| Pre-training | MLM | LM | Span corruption |
| Strengths | Classification, NLU | Generation, in-context learning | Seq-to-seq tasks |
| Examples | BERT, RoBERTa | GPT-2/3/4, LLaMA | T5, BART, mT5 |
| Parameters used at inference | All | All | All |
| KV cache benefit | N/A (no generation) | Yes | Encoder: no; Decoder: yes |

---

## 4. Algorithmic Derivation

### 4.1 Full Transformer Encoder

```
Algorithm: TransformerEncoder(X, N)
───────────────────────────────────
Input:  X ∈ ℝ^{B × T × d}       (embedded input + positional encoding)
        N: number of layers
Output: H ∈ ℝ^{B × T × d}       (contextual representations)

1. H ← X
2. for l = 1 to N:
3.     H ← EncoderBlock_l(H)     // as defined in §3.6
4. H ← LayerNorm(H)              // final layer norm (pre-norm style)
5. return H

Per-layer complexity: O(T² d + T d²)
Total complexity:     O(N(T² d + T d²))
Memory:               O(N T² + N T d)    // attention matrices + activations
```

### 4.2 Full Transformer Decoder (Autoregressive)

```
Algorithm: TransformerDecoder(Y, enc_out, N)
────────────────────────────────────────────
Input:  Y ∈ ℝ^{B × T_dec × d}          (embedded decoder input + pos enc)
        enc_out ∈ ℝ^{B × T_enc × d}    (encoder output)
        N: number of layers
Output: Z ∈ ℝ^{B × T_dec × d}

1. Z ← Y
2. causal_mask ← lower_triangular(T_dec)
3. for l = 1 to N:
4.     Z ← DecoderBlock_l(Z, enc_out, causal_mask)   // as defined in §3.7
5. Z ← LayerNorm(Z)
6. return Z

Per-layer complexity: O(T_dec² d + T_dec T_enc d + T_dec d²)
```

### 4.3 Full Transformer (Encoder-Decoder)

```
Algorithm: Transformer(src, tgt)
────────────────────────────────
Input:  src ∈ ℝ^{B × T_src}    (source token IDs)
        tgt ∈ ℝ^{B × T_tgt}    (target token IDs, shifted right)
Output: logits ∈ ℝ^{B × T_tgt × V}   (V = vocabulary size)

1. X ← Embedding(src) + PosEnc(T_src)         # (B, T_src, d)
2. enc_out ← TransformerEncoder(X, N)          # (B, T_src, d)
3. Y ← Embedding(tgt) + PosEnc(T_tgt)         # (B, T_tgt, d)
4. dec_out ← TransformerDecoder(Y, enc_out, N) # (B, T_tgt, d)
5. logits ← dec_out @ Embedding.weight^⊤       # weight tying, (B, T_tgt, V)
6. return logits
```

---

## 5. PyTorch Implementation

### 5.1 Layer Normalization (From Scratch)

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class LayerNorm(nn.Module):
    """Layer Normalization (Ba et al., 2016) implemented from scratch."""

    def __init__(self, d_model: int, eps: float = 1e-5):
        super().__init__()
        self.gamma = nn.Parameter(torch.ones(d_model))    # (d,)
        self.beta = nn.Parameter(torch.zeros(d_model))     # (d,)
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, d) or (B, d)
        mu = x.mean(dim=-1, keepdim=True)        # (B, T, 1)
        var = x.var(dim=-1, keepdim=True, unbiased=False)  # (B, T, 1)
        x_hat = (x - mu) / torch.sqrt(var + self.eps)      # (B, T, d)
        return self.gamma * x_hat + self.beta              # (B, T, d)
```

### 5.2 Position-Wise Feed-Forward Network

```python
class FeedForward(nn.Module):
    """Position-wise FFN with optional SwiGLU activation."""

    def __init__(
        self,
        d_model: int,
        d_ff: int = None,
        dropout: float = 0.1,
        activation: str = "relu",  # "relu", "gelu", or "swiglu"
    ):
        super().__init__()
        d_ff = d_ff or 4 * d_model
        self.activation = activation

        if activation == "swiglu":
            # SwiGLU uses 3 matrices but adjusts d_ff to keep param count similar
            # Standard: 2 * d_model * d_ff params
            # SwiGLU:   3 * d_model * (2/3 * d_ff) params ≈ 2 * d_model * d_ff
            d_ff_adjusted = int(2 * d_ff / 3)
            self.w1 = nn.Linear(d_model, d_ff_adjusted, bias=False)  # gate
            self.w3 = nn.Linear(d_model, d_ff_adjusted, bias=False)  # value
            self.w2 = nn.Linear(d_ff_adjusted, d_model, bias=False)
        else:
            self.w1 = nn.Linear(d_model, d_ff)
            self.w2 = nn.Linear(d_ff, d_model)
            self.w3 = None  # unused

        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, d_model)
        if self.activation == "swiglu":
            # SwiGLU: (Swish(xW1) ⊙ xW3) W2
            gate = F.silu(self.w1(x))       # (B, T, d_ff_adj)
            value = self.w3(x)              # (B, T, d_ff_adj)
            x = gate * value                # (B, T, d_ff_adj)
            x = self.w2(x)                  # (B, T, d_model)
        elif self.activation == "gelu":
            x = self.w2(F.gelu(self.w1(x)))
        else:
            x = self.w2(F.relu(self.w1(x)))

        return self.dropout(x)              # (B, T, d_model)
```

### 5.3 Multi-Head Attention (from Lecture 04a, repeated for completeness)

```python
class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.0):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads

        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        self.W_K = nn.Linear(d_model, d_model, bias=False)
        self.W_V = nn.Linear(d_model, d_model, bias=False)
        self.W_O = nn.Linear(d_model, d_model, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        Q: torch.Tensor,    # (B, T_q, d_model)
        K: torch.Tensor,    # (B, T_k, d_model)
        V: torch.Tensor,    # (B, T_k, d_model)
        mask: torch.Tensor = None,
    ) -> torch.Tensor:
        B, T_q, _ = Q.shape
        T_k = K.size(1)
        h, d_k = self.n_heads, self.d_k

        Q = self.W_Q(Q).view(B, T_q, h, d_k).transpose(1, 2)  # (B, h, T_q, d_k)
        K = self.W_K(K).view(B, T_k, h, d_k).transpose(1, 2)  # (B, h, T_k, d_k)
        V = self.W_V(V).view(B, T_k, h, d_k).transpose(1, 2)  # (B, h, T_k, d_k)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn = self.dropout(F.softmax(scores, dim=-1))
        context = torch.matmul(attn, V)  # (B, h, T_q, d_k)

        context = context.transpose(1, 2).contiguous().view(B, T_q, self.d_model)
        return self.W_O(context)  # (B, T_q, d_model)
```

### 5.4 Transformer Encoder Block

```python
class TransformerEncoderBlock(nn.Module):
    """Pre-norm Transformer encoder block."""

    def __init__(
        self,
        d_model: int,
        n_heads: int,
        d_ff: int = None,
        dropout: float = 0.1,
        activation: str = "relu",
    ):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = FeedForward(d_model, d_ff, dropout, activation)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,           # (B, T, d_model)
        mask: torch.Tensor = None,  # (B, 1, T, T)
    ) -> torch.Tensor:
        # Sub-layer 1: Self-attention with residual
        x_norm = self.ln1(x)                                  # (B, T, d)
        x = x + self.dropout(self.attn(x_norm, x_norm, x_norm, mask))  # (B, T, d)

        # Sub-layer 2: FFN with residual
        x_norm = self.ln2(x)                                  # (B, T, d)
        x = x + self.ffn(x_norm)                              # (B, T, d)

        return x
```

### 5.5 Transformer Decoder Block

```python
class TransformerDecoderBlock(nn.Module):
    """Pre-norm Transformer decoder block with masked self-attention + cross-attention."""

    def __init__(
        self,
        d_model: int,
        n_heads: int,
        d_ff: int = None,
        dropout: float = 0.1,
        activation: str = "relu",
    ):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.self_attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln2 = nn.LayerNorm(d_model)
        self.cross_attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln3 = nn.LayerNorm(d_model)
        self.ffn = FeedForward(d_model, d_ff, dropout, activation)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        y: torch.Tensor,               # (B, T_dec, d_model)
        enc_out: torch.Tensor,          # (B, T_enc, d_model)
        causal_mask: torch.Tensor,      # (1, 1, T_dec, T_dec)
        cross_mask: torch.Tensor = None,  # (B, 1, T_dec, T_enc)
    ) -> torch.Tensor:
        # Sub-layer 1: Masked self-attention
        y_norm = self.ln1(y)
        y = y + self.dropout(self.self_attn(y_norm, y_norm, y_norm, causal_mask))

        # Sub-layer 2: Cross-attention
        y_norm = self.ln2(y)
        y = y + self.dropout(self.cross_attn(y_norm, enc_out, enc_out, cross_mask))

        # Sub-layer 3: FFN
        y_norm = self.ln3(y)
        y = y + self.ffn(y_norm)

        return y
```

### 5.6 Full Transformer

```python
class Transformer(nn.Module):
    """
    Full encoder-decoder Transformer.

    Args:
        vocab_size: size of the vocabulary
        d_model: model dimension
        n_heads: number of attention heads
        n_layers: number of encoder/decoder layers
        d_ff: FFN inner dimension
        max_seq_len: maximum sequence length
        dropout: dropout rate
    """
    def __init__(
        self,
        vocab_size: int,
        d_model: int = 512,
        n_heads: int = 8,
        n_layers: int = 6,
        d_ff: int = 2048,
        max_seq_len: int = 512,
        dropout: float = 0.1,
        activation: str = "relu",
    ):
        super().__init__()
        self.d_model = d_model

        # Shared embedding (can be separate for src/tgt in practice)
        self.embedding = nn.Embedding(vocab_size, d_model)

        # Positional encoding (sinusoidal, see Lecture 04c)
        self.register_buffer(
            "pos_enc", self._sinusoidal_encoding(max_seq_len, d_model)
        )

        # Encoder
        self.encoder_layers = nn.ModuleList([
            TransformerEncoderBlock(d_model, n_heads, d_ff, dropout, activation)
            for _ in range(n_layers)
        ])
        self.encoder_norm = nn.LayerNorm(d_model)

        # Decoder
        self.decoder_layers = nn.ModuleList([
            TransformerDecoderBlock(d_model, n_heads, d_ff, dropout, activation)
            for _ in range(n_layers)
        ])
        self.decoder_norm = nn.LayerNorm(d_model)

        # Output projection (weight-tied with embedding)
        self.output_proj = nn.Linear(d_model, vocab_size, bias=False)
        self.output_proj.weight = self.embedding.weight  # weight tying

        self.dropout = nn.Dropout(dropout)
        self._init_parameters()

    def _sinusoidal_encoding(self, max_len: int, d_model: int) -> torch.Tensor:
        pe = torch.zeros(max_len, d_model)         # (max_len, d)
        position = torch.arange(0, max_len).unsqueeze(1).float()  # (max_len, 1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )  # (d/2,)
        pe[:, 0::2] = torch.sin(position * div_term)  # even indices
        pe[:, 1::2] = torch.cos(position * div_term)  # odd indices
        return pe.unsqueeze(0)  # (1, max_len, d)

    def _init_parameters(self):
        """Xavier uniform initialization, following original Transformer."""
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def encode(
        self,
        src: torch.Tensor,             # (B, T_src) token IDs
        src_mask: torch.Tensor = None,  # (B, 1, 1, T_src)
    ) -> torch.Tensor:
        T_src = src.size(1)
        # Embed + scale + positional encoding
        x = self.embedding(src) * math.sqrt(self.d_model)  # (B, T_src, d)
        x = x + self.pos_enc[:, :T_src, :]                 # (B, T_src, d)
        x = self.dropout(x)

        for layer in self.encoder_layers:
            x = layer(x, src_mask)

        return self.encoder_norm(x)  # (B, T_src, d)

    def decode(
        self,
        tgt: torch.Tensor,              # (B, T_tgt) token IDs
        enc_out: torch.Tensor,           # (B, T_src, d)
        causal_mask: torch.Tensor,       # (1, 1, T_tgt, T_tgt)
        cross_mask: torch.Tensor = None, # (B, 1, T_tgt, T_src)
    ) -> torch.Tensor:
        T_tgt = tgt.size(1)
        y = self.embedding(tgt) * math.sqrt(self.d_model)  # (B, T_tgt, d)
        y = y + self.pos_enc[:, :T_tgt, :]
        y = self.dropout(y)

        for layer in self.decoder_layers:
            y = layer(y, enc_out, causal_mask, cross_mask)

        return self.decoder_norm(y)  # (B, T_tgt, d)

    def forward(
        self,
        src: torch.Tensor,   # (B, T_src)
        tgt: torch.Tensor,   # (B, T_tgt)
    ) -> torch.Tensor:
        T_tgt = tgt.size(1)

        # Create causal mask for decoder
        causal_mask = torch.tril(torch.ones(T_tgt, T_tgt, device=tgt.device))
        causal_mask = causal_mask.unsqueeze(0).unsqueeze(0)  # (1, 1, T_tgt, T_tgt)

        enc_out = self.encode(src)                           # (B, T_src, d)
        dec_out = self.decode(tgt, enc_out, causal_mask)     # (B, T_tgt, d)
        logits = self.output_proj(dec_out)                   # (B, T_tgt, V)

        return logits
```

### 5.7 Decoder-Only Transformer (GPT-style)

```python
class GPTBlock(nn.Module):
    """Pre-norm decoder-only Transformer block (no cross-attention)."""

    def __init__(self, d_model: int, n_heads: int, d_ff: int, dropout: float = 0.1):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = MultiHeadAttention(d_model, n_heads, dropout)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = FeedForward(d_model, d_ff, dropout, activation="gelu")
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
        x_norm = self.ln1(x)
        x = x + self.dropout(self.attn(x_norm, x_norm, x_norm, mask))
        x_norm = self.ln2(x)
        x = x + self.ffn(x_norm)
        return x

class GPT(nn.Module):
    """Minimal GPT-style decoder-only Transformer."""

    def __init__(
        self,
        vocab_size: int,
        d_model: int = 768,
        n_heads: int = 12,
        n_layers: int = 12,
        d_ff: int = 3072,
        max_seq_len: int = 1024,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.d_model = d_model
        self.token_emb = nn.Embedding(vocab_size, d_model)
        self.pos_emb = nn.Embedding(max_seq_len, d_model)  # learned positions

        self.blocks = nn.ModuleList([
            GPTBlock(d_model, n_heads, d_ff, dropout) for _ in range(n_layers)
        ])
        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, vocab_size, bias=False)
        self.head.weight = self.token_emb.weight  # weight tying
        self.dropout = nn.Dropout(dropout)

    def forward(self, idx: torch.Tensor) -> torch.Tensor:
        # idx: (B, T) token IDs
        B, T = idx.shape
        pos = torch.arange(0, T, device=idx.device).unsqueeze(0)  # (1, T)

        x = self.token_emb(idx) + self.pos_emb(pos)  # (B, T, d)
        x = self.dropout(x)

        causal_mask = torch.tril(torch.ones(T, T, device=idx.device))
        causal_mask = causal_mask.unsqueeze(0).unsqueeze(0)  # (1, 1, T, T)

        for block in self.blocks:
            x = block(x, causal_mask)

        x = self.ln_f(x)           # (B, T, d)
        logits = self.head(x)      # (B, T, V)
        return logits
```

### 5.8 Verification

```python
def verify_transformer():
    """Verify shape correctness of all components."""
    torch.manual_seed(42)
    B, T_src, T_tgt, V = 2, 10, 8, 1000

    # Encoder-Decoder Transformer
    model = Transformer(vocab_size=V, d_model=64, n_heads=4, n_layers=2, d_ff=128)
    src = torch.randint(0, V, (B, T_src))
    tgt = torch.randint(0, V, (B, T_tgt))
    logits = model(src, tgt)
    assert logits.shape == (B, T_tgt, V), f"Expected {(B, T_tgt, V)}, got {logits.shape}"

    # GPT
    gpt = GPT(vocab_size=V, d_model=64, n_heads=4, n_layers=2, d_ff=128, max_seq_len=64)
    idx = torch.randint(0, V, (B, T_tgt))
    gpt_logits = gpt(idx)
    assert gpt_logits.shape == (B, T_tgt, V), f"Got {gpt_logits.shape}"

    # Parameter counts
    enc_dec_params = sum(p.numel() for p in model.parameters())
    gpt_params = sum(p.numel() for p in gpt.parameters())
    print(f"Encoder-Decoder params: {enc_dec_params:,}")
    print(f"GPT params: {gpt_params:,}")
    print("All Transformer tests passed!")

verify_transformer()
```

---

## 6. Experimental Intuition

### 6.1 Training Dynamics

**Learning rate warmup**: The original Transformer uses a warmup schedule:

$$\text{lr}(t) = d_{\text{model}}^{-0.5} \cdot \min(t^{-0.5}, t \cdot t_{\text{warmup}}^{-1.5})$$

This linearly increases the LR for $t_{\text{warmup}}$ steps, then decays as $t^{-0.5}$. Warmup is critical for post-norm Transformers (without it, early updates can destabilize LayerNorm). Pre-norm Transformers are more robust to the warmup schedule.

### 6.2 Depth vs Width

| Config | Layers $N$ | $d_{\text{model}}$ | Params | BLEU (WMT En-De) |
|:-------|:--------:|:---------:|:------:|:--------:|
| Shallow-Wide | 2 | 1024 | ~60M | 26.1 |
| Base | 6 | 512 | ~65M | 27.3 |
| Deep-Narrow | 12 | 256 | ~30M | 25.8 |
| Large | 6 | 1024 | ~213M | 28.4 |

Depth is generally more important than width for the same parameter budget, up to the point where training becomes unstable.

### 6.3 Dropout Locations

Dropout is applied at three points in the Transformer:

1. After embedding + positional encoding
2. On attention weights (after softmax)
3. After each sub-layer (before the residual addition)

Typical rate: 0.1 for base models, 0.3 for small models, 0.0 for very large models (which are undertrained relative to their capacity).

### 6.4 Post-Norm Instability

Without learning rate warmup, post-norm Transformers often diverge in the first few hundred steps. The mechanism:

1. At initialization, the residual branch output has similar magnitude to the residual.
2. LayerNorm normalizes the sum, but the gradient through LayerNorm depends on the ratio of residual to sub-layer output.
3. If this ratio fluctuates wildly early in training, the effective learning rate for each layer varies enormously, causing instability.

Pre-norm avoids this because LayerNorm is applied *before* the sub-layer, ensuring the sub-layer input is well-conditioned regardless of the accumulated residual.

---

## 7. Connections and Extensions

### 7.1 Universal Approximation

**Yun et al. (2020)** proved that Transformers are universal approximators of sequence-to-sequence functions: for any continuous function $f: \mathbb{R}^{T \times d} \to \mathbb{R}^{T \times d}$ and any $\epsilon > 0$, there exists a Transformer that approximates $f$ within $\epsilon$. The proof requires both attention (for inter-position interaction) and FFN (for per-position nonlinearity), confirming that neither can be removed.

### 7.2 Mixture of Experts

The FFN can be replaced with a Mixture of Experts (MoE) layer: instead of one FFN, use $E$ expert FFNs and a gating network that selects the top-$k$ experts per token. This allows scaling model capacity (parameters) without proportionally scaling compute (FLOPs). Used in GShard, Switch Transformer, Mixtral.

### 7.3 Normalization Variants

- **RMSNorm** (Zhang & Sennrich, 2019): Removes the mean centering from LayerNorm: $\text{RMSNorm}(x) = \gamma \odot \frac{x}{\sqrt{\frac{1}{d}\sum_i x_i^2 + \epsilon}}$. Simpler and marginally faster; used in LLaMA, Gemma.
- **DeepNorm** (Wang et al., 2022): Modifies post-norm with a scaling factor on the residual, enabling stable training of very deep (1000+ layer) Transformers.

### 7.4 Parallel Attention + FFN

Some modern architectures (PaLM, GPT-J) compute attention and FFN in parallel rather than sequentially:

$$x' = x + \text{Attn}(\text{LN}(x)) + \text{FFN}(\text{LN}(x))$$

This reduces communication overhead on hardware and is approximately equivalent at large scale (the two sub-layers interact weakly through the residual).

---

## 8. Seminal Paper Reading List

1. **Vaswani, A., et al.** (2017). *Attention Is All You Need.* NeurIPS 2017.
   - The Transformer. Required reading.

2. **Devlin, J., Chang, M.-W., Lee, K., & Toutanova, K.** (2019). *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding.* NAACL 2019.
   - Encoder-only Transformer with masked language modeling.

3. **Radford, A., Narasimhan, K., Salimans, T., & Sutskever, I.** (2018). *Improving Language Understanding by Generative Pre-Training.* OpenAI Technical Report.
   - GPT-1: decoder-only Transformer for language modeling and transfer learning.

4. **Raffel, C., et al.** (2020). *Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer.* JMLR 2020.
   - T5: encoder-decoder Transformer; systematic study of pre-training objectives.

5. **Xiong, R., et al.** (2020). *On Layer Normalization in the Transformer Architecture.* ICML 2020.
   - Analysis of pre-norm vs post-norm; proves pre-norm has better gradient properties.

6. **Ba, J. L., Kiros, J. R., & Hinton, G. E.** (2016). *Layer Normalization.* arXiv.
   - Original Layer Normalization paper.

7. **Shazeer, N.** (2020). *GLU Variants Improve Transformer.* arXiv.
   - SwiGLU and other gated linear unit variants for the FFN.

---

## 9. Exercises

### Theory Exercises

**Exercise 4b.1.** Consider a 2-layer pre-norm Transformer with residual connections. Write out the full computation graph from input $x$ to output $x_{\text{out}}$, showing every LayerNorm, attention, FFN, and addition. Compute $\frac{\partial x_{\text{out}}}{\partial x}$ symbolically and identify the "skip path" (the identity term).

**Exercise 4b.2.** Prove that in a post-norm Transformer, the gradient norm through $N$ layers decays as $O(c^N)$ for some $c < 1$ at initialization, while in a pre-norm Transformer, the gradient includes a term that is $O(1)$ regardless of $N$.

**Exercise 4b.3.** Show that without the FFN, a stack of self-attention layers cannot approximate the function $f(x_1, \ldots, x_T) = (x_1^2, \ldots, x_T^2)$ even for scalar inputs.

**Exercise 4b.4.** Derive the gradient of RMSNorm with respect to its input. Compare the number of floating-point operations with LayerNorm backward.

**Exercise 4b.5.** A Transformer with $N$ layers, $d_{\text{model}}$, and $d_{\text{ff}} = 4d_{\text{model}}$ has how many parameters? Express as a function of $N$, $d_{\text{model}}$, $V$ (vocab size). For the "base" config ($N=6$, $d=512$, $V=32000$), compute the exact count.

### Implementation Exercises

**Exercise 4b.6.** Implement both pre-norm and post-norm Transformer encoders. Train both on a small classification task and plot the training loss curve. Show that post-norm requires warmup while pre-norm does not.

**Exercise 4b.7.** Implement LayerNorm from scratch (forward and backward). Verify your backward pass against `torch.autograd.grad`. Benchmark against `nn.LayerNorm`.

**Exercise 4b.8.** Build a decoder-only Transformer (GPT-style) and train it on a small text corpus. Plot the attention patterns at each layer for a given input sentence. Discuss what you observe.

**Exercise 4b.9.** Implement weight tying between the embedding and output projection. Show empirically that it improves perplexity on a small language modeling task.
