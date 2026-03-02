# Lecture 05b: GPT, BERT, and LLaMA — Architectures for Language Model Pretraining

> **Module 05 — LLMs & Pretraining**
> Estimated study time: 7–9 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe the GPT (decoder-only), BERT (encoder-only), and T5 (encoder-decoder) architectures and their mathematical specifications.
2. Derive the causal language modeling (CLM), masked language modeling (MLM), and prefix language modeling objectives from first principles.
3. Prove that maximum-likelihood training with teacher forcing is equivalent to minimizing the forward KL divergence from the data distribution.
4. Explain the design choices in LLaMA (RMSNorm, SwiGLU, RoPE, no bias) and derive their mathematical formulations.
5. Compare pre-training objectives in terms of likelihood decomposition, bidirectionality, and downstream performance.
6. Implement GPT-2, BERT, and LLaMA architectures in PyTorch from scratch with full shape annotations.

---

## 1. Motivation and Context

The Transformer architecture (Module 04) is a general-purpose sequence-to-sequence model. But **how** we use it for language modeling varies dramatically depending on the pre-training objective. The three dominant paradigms are:

| Paradigm | Architecture | Objective | Directionality | Examples |
|----------|-------------|-----------|----------------|----------|
| Autoregressive LM | Decoder-only | Causal LM | Left-to-right | GPT, LLaMA, PaLM |
| Masked LM | Encoder-only | Masked LM | Bidirectional | BERT, RoBERTa |
| Seq2Seq LM | Encoder-Decoder | Span corruption / Text-to-text | Mixed | T5, BART, UL2 |

The choice of pre-training objective determines what the model learns, how it can be used, and what tasks it excels at. This lecture develops each paradigm from mathematical foundations through implementation.

---

## 2. Core Theory

### 2.1 Autoregressive Language Modeling (GPT)

**The Probabilistic Framework.** A language model defines a probability distribution over sequences of tokens $\mathbf{x} = (x_1, x_2, \ldots, x_T)$ where each $x_t \in \mathcal{V}$ and $\mathcal{V}$ is the vocabulary. By the chain rule of probability:

$$p(\mathbf{x}) = \prod_{t=1}^{T} p(x_t \mid x_1, \ldots, x_{t-1}) = \prod_{t=1}^{T} p(x_t \mid \mathbf{x}_{<t})$$

This decomposition is exact and holds for any distribution. The autoregressive approach models each conditional $p(x_t \mid \mathbf{x}_{<t})$ with a neural network.

**Definition (Causal Language Model).** A causal language model parameterized by $\theta$ is:

$$p_\theta(x_t \mid \mathbf{x}_{<t}) = \text{softmax}\!\big(W_e \cdot h_t^{(L)}\big)_{x_t}$$

where $h_t^{(L)} \in \mathbb{R}^{d_{\text{model}}}$ is the output of the final Transformer layer at position $t$, and $W_e \in \mathbb{R}^{|\mathcal{V}| \times d_{\text{model}}}$ is the (potentially tied) embedding/unembedding matrix.

**The Training Objective.** Given a corpus $\mathcal{D} = \{\mathbf{x}^{(1)}, \ldots, \mathbf{x}^{(M)}\}$, we maximize the log-likelihood:

$$\mathcal{L}_{\text{CLM}}(\theta) = \sum_{i=1}^{M} \sum_{t=1}^{T_i} \log p_\theta(x_t^{(i)} \mid \mathbf{x}_{<t}^{(i)})$$

**Theorem (CLM as KL Minimization).** Maximizing $\mathcal{L}_{\text{CLM}}(\theta)$ is equivalent to minimizing the forward KL divergence $D_{\text{KL}}(p_{\text{data}} \| p_\theta)$.

*Proof.* The KL divergence is:

$$D_{\text{KL}}(p_{\text{data}} \| p_\theta) = \mathbb{E}_{\mathbf{x} \sim p_{\text{data}}}\left[\log \frac{p_{\text{data}}(\mathbf{x})}{p_\theta(\mathbf{x})}\right] = \underbrace{-H(p_{\text{data}})}_{\text{constant}} - \mathbb{E}_{\mathbf{x} \sim p_{\text{data}}}[\log p_\theta(\mathbf{x})]$$

Since $H(p_{\text{data}})$ is independent of $\theta$:

$$\arg\min_\theta D_{\text{KL}}(p_{\text{data}} \| p_\theta) = \arg\max_\theta \mathbb{E}_{\mathbf{x} \sim p_{\text{data}}}[\log p_\theta(\mathbf{x})]$$

The empirical version (replacing expectation with sample average) is exactly $\frac{1}{M}\mathcal{L}_{\text{CLM}}(\theta)$. $\square$

**Theorem (Teacher Forcing Maximizes Likelihood).** Training with teacher forcing (conditioning on ground-truth prefixes $\mathbf{x}_{<t}$ rather than model samples) maximizes $\mathcal{L}_{\text{CLM}}(\theta)$.

*Proof.* At training time, we need to compute $\log p_\theta(x_t \mid \mathbf{x}_{<t})$ for each position $t$. There are two choices:
1. **Teacher forcing**: condition on the true prefix $\mathbf{x}_{<t}$.
2. **Free running**: condition on model-generated prefix $\hat{\mathbf{x}}_{<t}$.

The likelihood $\mathcal{L}_{\text{CLM}}$ is defined with the true prefix. Computing it requires exactly teacher forcing. Free running computes a different quantity: $\sum_t \log p_\theta(x_t \mid \hat{\mathbf{x}}_{<t})$, which does not correspond to $\log p_\theta(\mathbf{x})$.

More formally, by the chain rule:

$$\log p_\theta(\mathbf{x}) = \sum_{t=1}^T \log p_\theta(x_t \mid x_1, \ldots, x_{t-1})$$

Each term conditions on the *true* previous tokens. Substituting model-generated tokens would compute a cross-sequence quantity that is not the log-probability of $\mathbf{x}$. Therefore, teacher forcing is the correct (and unique) way to evaluate and optimize $\mathcal{L}_{\text{CLM}}$. $\square$

**Causal Masking.** To prevent position $t$ from attending to future positions $t' > t$, GPT applies a causal mask $M \in \{0, -\infty\}^{T \times T}$:

$$M_{ij} = \begin{cases} 0 & \text{if } i \geq j \\ -\infty & \text{if } i < j \end{cases}$$

The attention computation becomes:

$$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}} + M\right) V$$

Since $\text{softmax}(-\infty) = 0$, position $i$ cannot attend to position $j > i$.

### 2.2 GPT Architecture Specification

The GPT family (GPT-1, GPT-2, GPT-3) uses a decoder-only Transformer with the following structure:

**GPT-2 (124M) Specification:**

| Hyperparameter | Value |
|---------------|-------|
| Layers $L$ | 12 |
| Model dimension $d_{\text{model}}$ | 768 |
| Attention heads $H$ | 12 |
| Head dimension $d_k = d_{\text{model}} / H$ | 64 |
| FFN inner dimension $d_{\text{ff}}$ | 3072 ($= 4 \times d_{\text{model}}$) |
| Vocabulary size $|\mathcal{V}|$ | 50257 |
| Max sequence length $T$ | 1024 |
| Activation | GELU |
| Normalization | Pre-LayerNorm |
| Bias | Yes (in all linear layers) |

**Layer computation (Pre-LayerNorm variant):**

$$\mathbf{a}^{(l)} = \mathbf{h}^{(l-1)} + \text{MHA}\!\big(\text{LN}(\mathbf{h}^{(l-1)})\big) \quad \in \mathbb{R}^{T \times d_{\text{model}}}$$
$$\mathbf{h}^{(l)} = \mathbf{a}^{(l)} + \text{FFN}\!\big(\text{LN}(\mathbf{a}^{(l)})\big) \quad \in \mathbb{R}^{T \times d_{\text{model}}}$$

where $\text{LN}(\mathbf{x}) = \frac{\mathbf{x} - \mu}{\sqrt{\sigma^2 + \epsilon}} \odot \gamma + \beta$ with learnable $\gamma, \beta \in \mathbb{R}^{d_{\text{model}}}$.

**Parameter Count (GPT-2 124M):**

$$N = \underbrace{|\mathcal{V}| \cdot d + T \cdot d}_{\text{embeddings}} + L \cdot \left[\underbrace{4d^2 + 4d}_{\text{attention}} + \underbrace{2d}_{\text{LN}_1} + \underbrace{d \cdot 4d + 4d + 4d \cdot d + d}_{\text{FFN}} + \underbrace{2d}_{\text{LN}_2}\right] + \underbrace{2d}_{\text{final LN}}$$

With $d = 768$, $L = 12$, $|\mathcal{V}| = 50257$, $T = 1024$:

- Embeddings: $50257 \times 768 + 1024 \times 768 = 39{,}421{,}440$
- Per-layer: $4 \times 768^2 + 4 \times 768 + 2 \times 768 + 768 \times 3072 + 3072 + 3072 \times 768 + 768 + 2 \times 768 = 7{,}087{,}872$
- All layers: $12 \times 7{,}087{,}872 = 85{,}054{,}464$
- Final LN: $2 \times 768 = 1{,}536$
- **Total**: $\approx 124{,}477{,}440 \approx 124\text{M}$

### 2.3 Masked Language Modeling (BERT)

**The Objective.** Instead of predicting the next token, BERT randomly masks 15% of input tokens and predicts them from bidirectional context:

$$\mathcal{L}_{\text{MLM}}(\theta) = \mathbb{E}_{\mathbf{x} \sim \mathcal{D}} \left[\sum_{t \in \mathcal{M}} \log p_\theta(x_t \mid \mathbf{x}_{\backslash \mathcal{M}})\right]$$

where $\mathcal{M} \subset \{1, \ldots, T\}$ is the set of masked positions (chosen uniformly at random with $|\mathcal{M}| \approx 0.15T$), and $\mathbf{x}_{\backslash \mathcal{M}}$ denotes the sequence with masked positions replaced.

**Masking Strategy (80/10/10 rule):** For each selected position $t \in \mathcal{M}$:
- With probability 0.8: replace $x_t$ with `[MASK]`
- With probability 0.1: replace $x_t$ with a random token from $\mathcal{V}$
- With probability 0.1: keep $x_t$ unchanged

**Justification.** The 80/10/10 split addresses a train-test mismatch: `[MASK]` tokens never appear at fine-tuning time. The 10% random replacement prevents the model from learning an identity shortcut, and the 10% unchanged prevents the model from assuming masked positions are always corrupted.

**Next Sentence Prediction (NSP).** BERT also trains with a binary classification objective: given two segments $A$ and $B$, predict whether $B$ follows $A$ in the original text.

$$\mathcal{L}_{\text{NSP}}(\theta) = \mathbb{E}_{(A, B, y)}[\log p_\theta(y \mid [CLS], A, [SEP], B)]$$

where $y \in \{\text{IsNext}, \text{NotNext}\}$. The `[CLS]` token representation is passed through a linear classifier. Later work (RoBERTa) showed NSP is unnecessary and may hurt performance.

**Theorem (MLM does not define a valid joint distribution).** Unlike CLM, the MLM objective does not correspond to a proper joint distribution over sequences.

*Proof.* The MLM objective models $p(x_t \mid \mathbf{x}_{\backslash \mathcal{M}})$ for various mask sets $\mathcal{M}$. For a valid joint distribution, these conditionals must be consistent (Hammersley-Clifford theorem): there must exist a $p(\mathbf{x})$ such that marginalizing yields each conditional.

However, the BERT model uses independent softmax heads at each position, with no mechanism to enforce consistency. In particular, consider positions $i, j \in \mathcal{M}$. The model predicts $p(x_i \mid \mathbf{x}_{\backslash \mathcal{M}})$ and $p(x_j \mid \mathbf{x}_{\backslash \mathcal{M}})$ independently, but a valid joint would require $p(x_i, x_j \mid \mathbf{x}_{\backslash \mathcal{M}})$, which generally $\neq p(x_i \mid \mathbf{x}_{\backslash \mathcal{M}}) \cdot p(x_j \mid \mathbf{x}_{\backslash \mathcal{M}})$.

Thus, BERT defines a set of pseudo-conditionals that do not arise from any single joint distribution. $\square$

**Remark.** This is why BERT cannot be used for generation without iterative refinement schemes. CLM models like GPT naturally generate by ancestral sampling from $p(x_t \mid \mathbf{x}_{<t})$.

### 2.4 BERT Architecture Specification

**BERT-Base:**

| Hyperparameter | Value |
|---------------|-------|
| Layers $L$ | 12 |
| Model dimension $d_{\text{model}}$ | 768 |
| Attention heads $H$ | 12 |
| FFN inner dimension $d_{\text{ff}}$ | 3072 |
| Vocabulary size $|\mathcal{V}|$ | 30522 (WordPiece) |
| Max sequence length $T$ | 512 |
| Activation | GELU |
| Normalization | Post-LayerNorm |
| Special tokens | `[CLS]`, `[SEP]`, `[MASK]`, `[PAD]` |

**Key Difference from GPT:** No causal mask. All positions attend to all other positions (full bidirectional attention). Additionally, BERT uses **segment embeddings** $E_{\text{seg}} \in \mathbb{R}^{2 \times d_{\text{model}}}$ to distinguish between segment A and segment B.

**Input representation:**

$$\mathbf{h}^{(0)}_t = E_{\text{tok}}[x_t] + E_{\text{pos}}[t] + E_{\text{seg}}[s_t]$$

where $s_t \in \{0, 1\}$ indicates the segment.

### 2.5 T5: Encoder-Decoder and Text-to-Text

T5 (Text-to-Text Transfer Transformer, Raffel et al. 2020) adopts the original encoder-decoder Transformer architecture and frames every NLP task as a text-to-text problem.

**Span Corruption Objective.** Instead of masking individual tokens, T5 corrupts contiguous spans:

1. Select 15% of tokens to mask.
2. Group consecutive masked tokens into spans.
3. Replace each span with a single sentinel token `<extra_id_k>`.
4. The target is the concatenation of sentinel tokens and their corresponding spans.

**Example:**
- Input: `The <extra_id_0> walks in the <extra_id_1>`
- Target: `<extra_id_0> cute dog <extra_id_1> park <extra_id_2>`

**Mathematical Formulation.** Let $\mathbf{x}_{\text{corrupt}}$ be the corrupted input and $\mathbf{y}$ be the target (corrupted spans). The objective is:

$$\mathcal{L}_{\text{T5}}(\theta) = \mathbb{E}_{\mathbf{x} \sim \mathcal{D}} \left[\sum_{t=1}^{|\mathbf{y}|} \log p_\theta(y_t \mid \mathbf{x}_{\text{corrupt}}, \mathbf{y}_{<t})\right]$$

This combines bidirectional encoding (encoder sees all of $\mathbf{x}_{\text{corrupt}}$) with autoregressive decoding (decoder generates $\mathbf{y}$ left-to-right).

**Prefix LM Variant.** An alternative is the prefix language model, where the first $P$ tokens are encoded bidirectionally and the remaining $T - P$ are decoded autoregressively. This is a middle ground between CLM and MLM.

### 2.6 LLaMA: Modern Efficient Design

LLaMA (Touvron et al. 2023) demonstrated that a well-trained open-weight model can match proprietary models. It introduced several architectural refinements.

**RMSNorm (Root Mean Square Normalization).**

Standard LayerNorm:
$$\text{LN}(\mathbf{x}) = \frac{\mathbf{x} - \mu}{\sqrt{\sigma^2 + \epsilon}} \odot \gamma + \beta, \quad \mu = \frac{1}{d}\sum_i x_i, \quad \sigma^2 = \frac{1}{d}\sum_i (x_i - \mu)^2$$

RMSNorm removes the mean-centering and bias:
$$\text{RMSNorm}(\mathbf{x}) = \frac{\mathbf{x}}{\text{RMS}(\mathbf{x})} \odot \gamma, \quad \text{RMS}(\mathbf{x}) = \sqrt{\frac{1}{d}\sum_{i=1}^d x_i^2 + \epsilon}$$

**Proposition.** RMSNorm is computationally cheaper than LayerNorm by a constant factor (one fewer reduction and no bias term), while achieving comparable training stability.

*Justification.* Zhang & Sennrich (2019) showed empirically that the re-centering ($\mathbf{x} - \mu$) in LayerNorm is not essential for the regularization effect; the re-scaling ($\mathbf{x}/\text{RMS}(\mathbf{x})$) is sufficient to control activation magnitudes.

**SwiGLU Activation.**

Standard FFN: $\text{FFN}(\mathbf{x}) = W_2 \cdot \text{ReLU}(W_1 \mathbf{x} + \mathbf{b}_1) + \mathbf{b}_2$

SwiGLU FFN (Shazeer, 2020):

$$\text{SwiGLU}(\mathbf{x}) = W_2 \cdot \big[\text{SiLU}(W_1 \mathbf{x}) \odot (W_3 \mathbf{x})\big]$$

where $\text{SiLU}(z) = z \cdot \sigma(z) = z / (1 + e^{-z})$ (also called Swish), $W_1, W_3 \in \mathbb{R}^{d_{\text{ff}} \times d_{\text{model}}}$, and $W_2 \in \mathbb{R}^{d_{\text{model}} \times d_{\text{ff}}}$.

The "gate" $\text{SiLU}(W_1 \mathbf{x})$ controls information flow: it is a smooth, learnable gate that can suppress or amplify each hidden dimension.

**Note on parameter count.** SwiGLU has three weight matrices ($W_1, W_3, W_2$) instead of two. To keep the parameter count comparable, LLaMA uses $d_{\text{ff}} = \lfloor \frac{2}{3} \cdot 4d_{\text{model}} \rceil$ rounded to the nearest multiple of 256. For example, with $d_{\text{model}} = 4096$: $d_{\text{ff}} = \frac{2}{3} \cdot 16384 \approx 11008$.

**Rotary Position Embeddings (RoPE).**

Instead of additive position embeddings, RoPE encodes position through rotation of the query and key vectors. Given a query or key vector $\mathbf{x} \in \mathbb{R}^d$ at position $m$:

$$f(\mathbf{x}, m) = R_m \mathbf{x}$$

where $R_m \in \mathbb{R}^{d \times d}$ is a block-diagonal rotation matrix:

$$R_m = \begin{pmatrix} \cos m\theta_1 & -\sin m\theta_1 & & \\ \sin m\theta_1 & \cos m\theta_1 & & \\ & & \ddots & \\ & & & \cos m\theta_{d/2} & -\sin m\theta_{d/2} \\ & & & \sin m\theta_{d/2} & \cos m\theta_{d/2} \end{pmatrix}$$

with frequencies $\theta_i = 10000^{-2i/d}$ for $i = 0, 1, \ldots, d/2 - 1$.

**Key Property.** The dot product between rotated queries and keys depends only on the relative position:

$$\langle R_m \mathbf{q}, R_n \mathbf{k} \rangle = \langle R_{m-n} \mathbf{q}, \mathbf{k} \rangle = \mathbf{q}^\top R_{m-n}^\top \mathbf{k}$$

*Proof.* Since $R_m$ is an orthogonal matrix ($R_m^\top R_m = I$), we have $R_m^\top = R_{-m}$ and:

$$\langle R_m \mathbf{q}, R_n \mathbf{k} \rangle = \mathbf{q}^\top R_m^\top R_n \mathbf{k} = \mathbf{q}^\top R_{-m} R_n \mathbf{k} = \mathbf{q}^\top R_{n-m} \mathbf{k}$$

This uses $R_a R_b = R_{a+b}$ (rotation composition). Thus the attention score $q_m^\top k_n$ encodes relative position $n - m$ without explicit relative position embeddings. $\square$

**Efficient Implementation.** Rather than materializing the rotation matrix, RoPE is applied by:

$$\begin{pmatrix} x_{2i} \\ x_{2i+1} \end{pmatrix} \mapsto \begin{pmatrix} x_{2i} \cos m\theta_i - x_{2i+1} \sin m\theta_i \\ x_{2i} \sin m\theta_i + x_{2i+1} \cos m\theta_i \end{pmatrix}$$

This is $O(d)$ per token, same as additive embeddings.

**No Bias.** LLaMA removes bias terms from all linear layers. This is purely an efficiency choice: biases add negligible parameters but complicate tensor parallelism (biases need not be split across GPUs but add synchronization complexity).

### 2.7 Architecture Comparison

| Feature | GPT-2 | BERT | T5 | LLaMA |
|---------|-------|------|----|-------|
| Architecture | Decoder-only | Encoder-only | Encoder-Decoder | Decoder-only |
| Attention | Causal | Bidirectional | Enc: Bidir; Dec: Causal + Cross | Causal |
| Normalization | Pre-LN | Post-LN | Pre-LN | Pre-RMSNorm |
| Position encoding | Learned absolute | Learned absolute | Learned relative (bias) | RoPE |
| Activation | GELU | GELU | ReLU | SwiGLU |
| Bias | Yes | Yes | No (in LN) | No |
| FFN ratio | $4\times$ | $4\times$ | $4\times$ | $\frac{8}{3}\times$ (3 matrices) |
| Pre-training objective | CLM | MLM + NSP | Span corruption | CLM |
| Weight tying | Embed = Unembed | Embed = Unembed | Embed = Unembed (enc+dec) | No |

---

## 3. Algorithmic Derivation

### 3.1 GPT Forward Pass

```
Algorithm: GPT Forward Pass
────────────────────────────
Input: Token sequence x = (x_1, ..., x_T), x_t ∈ {0,...,|V|-1}
Output: Logits ℓ ∈ ℝ^{T×|V|}

1. Token embedding:     e_t = W_tok[x_t]           ∀t     ∈ ℝ^d
   Position embedding:  p_t = W_pos[t]              ∀t     ∈ ℝ^d
   h^(0)_t = e_t + p_t                              ∀t     ∈ ℝ^d

2. For l = 1 to L:
   a. Pre-norm:          ĥ = LayerNorm(h^(l-1))            ∈ ℝ^{T×d}
   b. Multi-Head Attention (causal):
      For head i = 1 to H:
        Q_i = ĥ W^Q_i                                      ∈ ℝ^{T×d_k}
        K_i = ĥ W^K_i                                      ∈ ℝ^{T×d_k}
        V_i = ĥ W^V_i                                      ∈ ℝ^{T×d_k}
        A_i = softmax(Q_i K_i^T / √d_k + M)                ∈ ℝ^{T×T}
        head_i = A_i V_i                                    ∈ ℝ^{T×d_k}
      MHA = Concat(head_1,...,head_H) W^O                   ∈ ℝ^{T×d}
   c. Residual:          a^(l) = h^(l-1) + MHA              ∈ ℝ^{T×d}
   d. Pre-norm:          â = LayerNorm(a^(l))                ∈ ℝ^{T×d}
   e. FFN:               f = GELU(â W_1 + b_1) W_2 + b_2   ∈ ℝ^{T×d}
   f. Residual:          h^(l) = a^(l) + f                  ∈ ℝ^{T×d}

3. Final norm:           ĥ = LayerNorm(h^(L))               ∈ ℝ^{T×d}
4. Logits:               ℓ = ĥ W_tok^T                      ∈ ℝ^{T×|V|}

Complexity: O(T²d + Td²) per layer, O(L(T²d + Td²)) total
Memory: O(LTd + T²H) for activations
```

### 3.2 BERT MLM Forward Pass

```
Algorithm: BERT Forward Pass (MLM)
───────────────────────────────────
Input: Token sequence x = (x_1, ..., x_T) with masked positions M
Output: Predictions for masked positions

1. Input representation:
   h^(0)_t = W_tok[x_t] + W_pos[t] + W_seg[s_t]          ∈ ℝ^d
   (No causal mask — full bidirectional attention)

2. For l = 1 to L:
   a. Attention:  a^(l) = h^(l-1) + MHA(h^(l-1))          ∈ ℝ^{T×d}
      Post-norm:  a^(l) = LayerNorm(a^(l))                 ∈ ℝ^{T×d}
   b. FFN:        h^(l) = a^(l) + FFN(a^(l))               ∈ ℝ^{T×d}
      Post-norm:  h^(l) = LayerNorm(h^(l))                 ∈ ℝ^{T×d}

3. For each t ∈ M:
   MLM prediction:  ℓ_t = LayerNorm(GELU(h^(L)_t W_mlm)) W_tok^T   ∈ ℝ^{|V|}

4. [CLS] classification (NSP):
   ℓ_cls = tanh(h^(L)_0 W_cls) W_nsp                      ∈ ℝ^2
```

### 3.3 KV Cache for Efficient Generation

```
Algorithm: Autoregressive Generation with KV Cache
────────────────────────────────────────────────────
Input: Prompt x = (x_1, ..., x_P), max_len T
Output: Generated sequence (x_1, ..., x_T)

1. Prefill phase:
   Run full forward pass on (x_1, ..., x_P)
   For each layer l, cache:
     K_cache^(l) = K^(l) ∈ ℝ^{P×d_k×H}
     V_cache^(l) = V^(l) ∈ ℝ^{P×d_k×H}

2. Decode phase: for t = P+1 to T:
   a. Embed new token:  h^(0)_t = W_tok[x_t] + W_pos[t]   ∈ ℝ^d

   b. For each layer l:
      Compute single-token Q, K, V:
        q_t = h^(l-1)_t W^Q   ∈ ℝ^{1×d_k×H}  (one token)
        k_t = h^(l-1)_t W^K   ∈ ℝ^{1×d_k×H}
        v_t = h^(l-1)_t W^V   ∈ ℝ^{1×d_k×H}

      Append to cache:
        K_cache^(l) ← concat(K_cache^(l), k_t)   ∈ ℝ^{t×d_k×H}
        V_cache^(l) ← concat(V_cache^(l), v_t)   ∈ ℝ^{t×d_k×H}

      Attention (only one query row):
        a_t = softmax(q_t K_cache^(l)T / √d_k)    ∈ ℝ^{1×t}
        o_t = a_t V_cache^(l)                      ∈ ℝ^{1×d_k×H}

   c. Compute logits for position t only
   d. Sample x_{t+1} ~ p(· | x_1,...,x_t)

Prefill: O(P²d) per layer
Decode per step: O(td) per layer (matrix-vector, not matrix-matrix)
Total decode: O(T²d) per layer across all steps
KV cache memory: O(L·T·d) total
```

---

## 4. PyTorch Implementation

### 4.1 GPT-2 from Scratch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class GPT2Config:
    vocab_size: int = 50257
    max_seq_len: int = 1024
    d_model: int = 768
    n_layers: int = 12
    n_heads: int = 12
    d_ff: int = 3072        # 4 * d_model
    dropout: float = 0.1
    bias: bool = True


class CausalSelfAttention(nn.Module):
    """Multi-head causal self-attention for GPT-2."""

    def __init__(self, config: GPT2Config):
        super().__init__()
        assert config.d_model % config.n_heads == 0
        self.n_heads = config.n_heads
        self.d_k = config.d_model // config.n_heads  # head dimension

        # Combined QKV projection for efficiency
        self.qkv_proj = nn.Linear(config.d_model, 3 * config.d_model, bias=config.bias)
        # Output projection
        self.out_proj = nn.Linear(config.d_model, config.d_model, bias=config.bias)
        self.attn_dropout = nn.Dropout(config.dropout)
        self.resid_dropout = nn.Dropout(config.dropout)

        # Causal mask: registered as buffer (not a parameter)
        mask = torch.tril(torch.ones(config.max_seq_len, config.max_seq_len))
        self.register_buffer("mask", mask.view(1, 1, config.max_seq_len, config.max_seq_len))

    def forward(
        self,
        x: torch.Tensor,                    # (B, T, d_model)
        kv_cache: Optional[Tuple] = None,    # cached (K, V) for generation
    ) -> Tuple[torch.Tensor, Optional[Tuple]]:
        B, T, d = x.shape  # batch, seq_len, d_model

        # Compute Q, K, V
        qkv = self.qkv_proj(x)                        # (B, T, 3*d_model)
        q, k, v = qkv.chunk(3, dim=-1)                # each (B, T, d_model)

        # Reshape for multi-head attention
        q = q.view(B, T, self.n_heads, self.d_k).transpose(1, 2)  # (B, H, T, d_k)
        k = k.view(B, T, self.n_heads, self.d_k).transpose(1, 2)  # (B, H, T, d_k)
        v = v.view(B, T, self.n_heads, self.d_k).transpose(1, 2)  # (B, H, T, d_k)

        # KV cache for generation
        if kv_cache is not None:
            k_cache, v_cache = kv_cache                    # each (B, H, T_prev, d_k)
            k = torch.cat([k_cache, k], dim=2)             # (B, H, T_prev+T, d_k)
            v = torch.cat([v_cache, v], dim=2)             # (B, H, T_prev+T, d_k)

        new_kv_cache = (k, v)
        T_full = k.shape[2]  # T_prev + T or T

        # Scaled dot-product attention with causal mask
        attn = (q @ k.transpose(-2, -1)) / math.sqrt(self.d_k)  # (B, H, T, T_full)
        # Apply causal mask: position i can attend to positions [0, ..., i]
        causal = self.mask[:, :, T_full - T:T_full, :T_full]      # (1, 1, T, T_full)
        attn = attn.masked_fill(causal == 0, float("-inf"))       # (B, H, T, T_full)
        attn = F.softmax(attn, dim=-1)                             # (B, H, T, T_full)
        attn = self.attn_dropout(attn)

        out = attn @ v                                     # (B, H, T, d_k)
        out = out.transpose(1, 2).contiguous().view(B, T, d)  # (B, T, d_model)
        out = self.resid_dropout(self.out_proj(out))       # (B, T, d_model)

        return out, new_kv_cache


class GPT2FFN(nn.Module):
    """Feed-forward network with GELU activation."""

    def __init__(self, config: GPT2Config):
        super().__init__()
        self.fc1 = nn.Linear(config.d_model, config.d_ff, bias=config.bias)   # (d, 4d)
        self.fc2 = nn.Linear(config.d_ff, config.d_model, bias=config.bias)   # (4d, d)
        self.dropout = nn.Dropout(config.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:   # (B, T, d_model)
        x = F.gelu(self.fc1(x))                           # (B, T, d_ff)
        x = self.dropout(self.fc2(x))                     # (B, T, d_model)
        return x


class GPT2Block(nn.Module):
    """Single GPT-2 Transformer block (Pre-LN)."""

    def __init__(self, config: GPT2Config):
        super().__init__()
        self.ln1 = nn.LayerNorm(config.d_model)
        self.attn = CausalSelfAttention(config)
        self.ln2 = nn.LayerNorm(config.d_model)
        self.ffn = GPT2FFN(config)

    def forward(
        self,
        x: torch.Tensor,                    # (B, T, d_model)
        kv_cache: Optional[Tuple] = None,
    ) -> Tuple[torch.Tensor, Optional[Tuple]]:
        # Pre-norm attention + residual
        attn_out, new_kv = self.attn(self.ln1(x), kv_cache)  # (B, T, d_model)
        x = x + attn_out                                      # (B, T, d_model)

        # Pre-norm FFN + residual
        x = x + self.ffn(self.ln2(x))                         # (B, T, d_model)

        return x, new_kv


class GPT2(nn.Module):
    """Full GPT-2 model."""

    def __init__(self, config: GPT2Config):
        super().__init__()
        self.config = config

        self.tok_emb = nn.Embedding(config.vocab_size, config.d_model)     # (|V|, d)
        self.pos_emb = nn.Embedding(config.max_seq_len, config.d_model)    # (T, d)
        self.drop = nn.Dropout(config.dropout)

        self.blocks = nn.ModuleList([GPT2Block(config) for _ in range(config.n_layers)])
        self.ln_f = nn.LayerNorm(config.d_model)

        # Weight tying: share token embedding with output projection
        self.lm_head = nn.Linear(config.d_model, config.vocab_size, bias=False)
        self.lm_head.weight = self.tok_emb.weight  # tie weights

        # Initialize weights
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(
        self,
        input_ids: torch.Tensor,        # (B, T) — token indices
        targets: Optional[torch.Tensor] = None,  # (B, T) — target token indices
        kv_caches: Optional[list] = None,
    ) -> Tuple[torch.Tensor, Optional[torch.Tensor], Optional[list]]:
        B, T = input_ids.shape

        # Compute position indices
        if kv_caches is not None and kv_caches[0] is not None:
            pos_offset = kv_caches[0][0].shape[2]  # T_prev
        else:
            pos_offset = 0

        pos_ids = torch.arange(pos_offset, pos_offset + T, device=input_ids.device)  # (T,)

        # Embeddings
        tok = self.tok_emb(input_ids)     # (B, T, d_model)
        pos = self.pos_emb(pos_ids)       # (T, d_model) — broadcast over B
        x = self.drop(tok + pos)          # (B, T, d_model)

        # Transformer blocks
        new_kv_caches = []
        for i, block in enumerate(self.blocks):
            kv = kv_caches[i] if kv_caches is not None else None
            x, new_kv = block(x, kv)      # (B, T, d_model)
            new_kv_caches.append(new_kv)

        x = self.ln_f(x)                  # (B, T, d_model)
        logits = self.lm_head(x)          # (B, T, |V|)

        # Compute loss if targets provided
        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)),  # (B*T, |V|)
                targets.view(-1),                   # (B*T,)
            )

        return logits, loss, new_kv_caches

    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,     # (B, T_prompt)
        max_new_tokens: int = 100,
        temperature: float = 1.0,
        top_k: int = 50,
    ) -> torch.Tensor:               # (B, T_prompt + max_new_tokens)
        """Autoregressive generation with KV cache."""
        self.eval()
        kv_caches = [None] * self.config.n_layers

        # Prefill: process prompt
        logits, _, kv_caches = self.forward(input_ids, kv_caches=kv_caches)
        # logits: (B, T_prompt, |V|)

        for _ in range(max_new_tokens):
            # Get logits for last position
            next_logits = logits[:, -1, :] / temperature   # (B, |V|)

            # Top-k filtering
            if top_k > 0:
                values, _ = torch.topk(next_logits, top_k)       # (B, top_k)
                threshold = values[:, -1].unsqueeze(-1)           # (B, 1)
                next_logits[next_logits < threshold] = float("-inf")

            probs = F.softmax(next_logits, dim=-1)          # (B, |V|)
            next_token = torch.multinomial(probs, 1)        # (B, 1)

            input_ids = torch.cat([input_ids, next_token], dim=1)  # (B, T+1)

            # Decode step: process only the new token
            logits, _, kv_caches = self.forward(
                next_token, kv_caches=kv_caches
            )  # logits: (B, 1, |V|)

        return input_ids
```

### 4.2 LLaMA Components

```python
class RMSNorm(nn.Module):
    """Root Mean Square Layer Normalization."""

    def __init__(self, d_model: int, eps: float = 1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d_model))  # (d,) — learnable scale
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # (B, T, d)
        # RMS(x) = sqrt(mean(x^2) + eps)
        rms = torch.sqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps)  # (B, T, 1)
        return (x / rms) * self.weight  # (B, T, d)


class RotaryPositionEmbedding(nn.Module):
    """Rotary Position Embeddings (RoPE) for relative position encoding."""

    def __init__(self, d_k: int, max_seq_len: int = 8192, base: float = 10000.0):
        super().__init__()
        # Precompute rotation frequencies: theta_i = base^(-2i/d) for i=0,...,d/2-1
        inv_freq = 1.0 / (base ** (torch.arange(0, d_k, 2).float() / d_k))  # (d_k/2,)
        self.register_buffer("inv_freq", inv_freq)

        # Precompute cos and sin for all positions
        t = torch.arange(max_seq_len).float()           # (T,)
        freqs = torch.outer(t, inv_freq)                 # (T, d_k/2)
        self.register_buffer("cos_cached", freqs.cos())  # (T, d_k/2)
        self.register_buffer("sin_cached", freqs.sin())  # (T, d_k/2)

    def forward(
        self,
        q: torch.Tensor,  # (B, H, T, d_k)
        k: torch.Tensor,  # (B, H, T, d_k)
        offset: int = 0,
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        T = q.shape[2]
        cos = self.cos_cached[offset:offset + T].unsqueeze(0).unsqueeze(0)  # (1, 1, T, d_k/2)
        sin = self.sin_cached[offset:offset + T].unsqueeze(0).unsqueeze(0)  # (1, 1, T, d_k/2)

        q_rot = self._rotate(q, cos, sin)  # (B, H, T, d_k)
        k_rot = self._rotate(k, cos, sin)  # (B, H, T, d_k)
        return q_rot, k_rot

    @staticmethod
    def _rotate(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
        """Apply rotation to pairs of dimensions."""
        # x: (B, H, T, d_k) — split into even and odd
        x1 = x[..., ::2]   # (B, H, T, d_k/2) — even indices
        x2 = x[..., 1::2]  # (B, H, T, d_k/2) — odd indices

        # Rotation: [x1, x2] -> [x1*cos - x2*sin, x1*sin + x2*cos]
        out1 = x1 * cos - x2 * sin  # (B, H, T, d_k/2)
        out2 = x1 * sin + x2 * cos  # (B, H, T, d_k/2)

        # Interleave back
        return torch.stack([out1, out2], dim=-1).flatten(-2)  # (B, H, T, d_k)


class SwiGLU(nn.Module):
    """SwiGLU feed-forward network (3 linear layers, no bias)."""

    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.w1 = nn.Linear(d_model, d_ff, bias=False)  # gate projection
        self.w3 = nn.Linear(d_model, d_ff, bias=False)  # up projection
        self.w2 = nn.Linear(d_ff, d_model, bias=False)  # down projection

    def forward(self, x: torch.Tensor) -> torch.Tensor:  # (B, T, d_model)
        # SwiGLU(x) = W2 * (SiLU(W1 x) ⊙ W3 x)
        gate = F.silu(self.w1(x))   # (B, T, d_ff)
        up = self.w3(x)             # (B, T, d_ff)
        return self.w2(gate * up)   # (B, T, d_model)


@dataclass
class LLaMAConfig:
    vocab_size: int = 32000
    max_seq_len: int = 4096
    d_model: int = 4096
    n_layers: int = 32
    n_heads: int = 32
    n_kv_heads: int = 32       # for Grouped Query Attention (GQA)
    d_ff: int = 11008          # ≈ 2/3 * 4 * d_model
    dropout: float = 0.0
    rope_base: float = 10000.0


class LLaMABlock(nn.Module):
    """Single LLaMA Transformer block."""

    def __init__(self, config: LLaMAConfig):
        super().__init__()
        self.n_heads = config.n_heads
        self.d_k = config.d_model // config.n_heads

        self.rms_norm1 = RMSNorm(config.d_model)
        self.rms_norm2 = RMSNorm(config.d_model)

        # Attention projections (no bias)
        self.wq = nn.Linear(config.d_model, config.d_model, bias=False)
        self.wk = nn.Linear(config.d_model, config.d_model, bias=False)
        self.wv = nn.Linear(config.d_model, config.d_model, bias=False)
        self.wo = nn.Linear(config.d_model, config.d_model, bias=False)

        self.rope = RotaryPositionEmbedding(self.d_k, config.max_seq_len, config.rope_base)
        self.ffn = SwiGLU(config.d_model, config.d_ff)

    def forward(
        self,
        x: torch.Tensor,                    # (B, T, d_model)
        kv_cache: Optional[Tuple] = None,
    ) -> Tuple[torch.Tensor, Tuple]:
        B, T, d = x.shape

        # Pre-RMSNorm + Attention
        h = self.rms_norm1(x)               # (B, T, d_model)

        q = self.wq(h).view(B, T, self.n_heads, self.d_k).transpose(1, 2)  # (B, H, T, d_k)
        k = self.wk(h).view(B, T, self.n_heads, self.d_k).transpose(1, 2)  # (B, H, T, d_k)
        v = self.wv(h).view(B, T, self.n_heads, self.d_k).transpose(1, 2)  # (B, H, T, d_k)

        # Apply RoPE
        offset = kv_cache[0].shape[2] if kv_cache is not None else 0
        q, k = self.rope(q, k, offset=offset)  # (B, H, T, d_k) each

        # KV cache
        if kv_cache is not None:
            k = torch.cat([kv_cache[0], k], dim=2)  # (B, H, T_prev+T, d_k)
            v = torch.cat([kv_cache[1], v], dim=2)  # (B, H, T_prev+T, d_k)
        new_kv = (k, v)

        # Causal attention
        T_full = k.shape[2]
        attn = (q @ k.transpose(-2, -1)) / math.sqrt(self.d_k)  # (B, H, T, T_full)

        # Causal mask
        causal_mask = torch.triu(
            torch.full((T, T_full), float("-inf"), device=x.device), diagonal=T_full - T + 1
        )  # (T, T_full)
        attn = attn + causal_mask.unsqueeze(0).unsqueeze(0)  # broadcast
        attn = F.softmax(attn, dim=-1)                        # (B, H, T, T_full)

        out = attn @ v                                         # (B, H, T, d_k)
        out = out.transpose(1, 2).contiguous().view(B, T, d)  # (B, T, d_model)
        out = self.wo(out)                                     # (B, T, d_model)

        # Residual
        x = x + out                                            # (B, T, d_model)

        # Pre-RMSNorm + SwiGLU FFN + Residual
        x = x + self.ffn(self.rms_norm2(x))                   # (B, T, d_model)

        return x, new_kv


class LLaMA(nn.Module):
    """Full LLaMA model."""

    def __init__(self, config: LLaMAConfig):
        super().__init__()
        self.config = config
        self.tok_emb = nn.Embedding(config.vocab_size, config.d_model)
        self.blocks = nn.ModuleList([LLaMABlock(config) for _ in range(config.n_layers)])
        self.rms_norm_f = RMSNorm(config.d_model)
        self.lm_head = nn.Linear(config.d_model, config.vocab_size, bias=False)

        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def forward(
        self,
        input_ids: torch.Tensor,
        targets: Optional[torch.Tensor] = None,
        kv_caches: Optional[list] = None,
    ) -> Tuple[torch.Tensor, Optional[torch.Tensor], list]:
        B, T = input_ids.shape

        x = self.tok_emb(input_ids)    # (B, T, d_model) — no position embedding (RoPE handles it)

        new_kv_caches = []
        for i, block in enumerate(self.blocks):
            kv = kv_caches[i] if kv_caches is not None else None
            x, new_kv = block(x, kv)   # (B, T, d_model)
            new_kv_caches.append(new_kv)

        x = self.rms_norm_f(x)          # (B, T, d_model)
        logits = self.lm_head(x)        # (B, T, |V|)

        loss = None
        if targets is not None:
            loss = F.cross_entropy(logits.view(-1, logits.size(-1)), targets.view(-1))

        return logits, loss, new_kv_caches


# ─── Verification ───────────────────────────────────────────────────────
def count_params(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters())


def verify_gpt2():
    """Verify GPT-2 124M parameter count and forward pass shapes."""
    config = GPT2Config()
    model = GPT2(config)
    n_params = count_params(model)
    print(f"GPT-2 parameter count: {n_params:,} ({n_params/1e6:.1f}M)")

    # Test forward pass
    x = torch.randint(0, config.vocab_size, (2, 128))  # (B=2, T=128)
    logits, loss, _ = model(x, targets=x)
    print(f"Logits shape: {logits.shape}")  # (2, 128, 50257)
    print(f"Loss: {loss.item():.4f}")

    # Test generation
    prompt = torch.randint(0, config.vocab_size, (1, 10))  # (1, 10)
    generated = model.generate(prompt, max_new_tokens=20)
    print(f"Generated shape: {generated.shape}")  # (1, 30)


def verify_llama():
    """Verify LLaMA with reduced dimensions for testing."""
    config = LLaMAConfig(
        vocab_size=1000, d_model=256, n_layers=4,
        n_heads=4, d_ff=688, max_seq_len=512
    )
    model = LLaMA(config)
    n_params = count_params(model)
    print(f"\nLLaMA (small) parameter count: {n_params:,} ({n_params/1e6:.1f}M)")

    x = torch.randint(0, config.vocab_size, (2, 64))
    logits, loss, _ = model(x, targets=x)
    print(f"Logits shape: {logits.shape}")  # (2, 64, 1000)
    print(f"Loss: {loss.item():.4f}")


if __name__ == "__main__":
    verify_gpt2()
    verify_llama()
```

---

## 5. Experimental Intuition

### 5.1 Why Decoder-Only Won

Despite BERT's bidirectional advantage for understanding tasks, decoder-only models dominate modern LLMs. The reasons:

1. **Simplicity of objective**: CLM requires no masking strategy, no special tokens, and no task-specific heads.
2. **Natural generation**: CLM models generate text autoregressively without modification. BERT requires iterative decoding.
3. **Scaling behavior**: empirically, decoder-only models scale more predictably (smoother loss curves).
4. **In-context learning**: causal attention naturally supports few-shot prompting. BERT cannot condition on arbitrary prefixes.

### 5.2 Pre-LN vs. Post-LN

Post-LN (original Transformer, BERT): $h = \text{LN}(x + \text{Attn}(x))$

Pre-LN (GPT-2, LLaMA): $h = x + \text{Attn}(\text{LN}(x))$

Pre-LN has better gradient flow at initialization because the residual path is unobstructed. With Post-LN, the LayerNorm normalizes the residual connection, which can dampen gradient signal in deep networks. Pre-LN enables training without learning rate warmup in many cases.

### 5.3 Weight Tying

Sharing the token embedding matrix $W_{\text{tok}} \in \mathbb{R}^{|V| \times d}$ with the output projection saves $|V| \times d$ parameters ($\sim$38M for GPT-2). The intuition: the input and output representations should live in the same space, since predicting token $t$ means producing a vector close to the embedding of $t$.

LLaMA does not tie weights. At the scale of LLaMA-65B, the embedding matrix is a small fraction of total parameters, and separate matrices give more capacity.

### 5.4 The Role of Dropout

GPT-2 uses dropout; LLaMA does not. At sufficient scale with enough data, dropout is unnecessary: the model never overfits because the data is not repeated. Dropout can even hurt performance by reducing effective model capacity during training.

---

## 6. Connections

- **Module 04 (Attention/Transformers)**: This lecture assumes familiarity with the Transformer block. GPT/BERT/LLaMA are all instantiations of the same Transformer building blocks.
- **Module 05a (Scaling Laws)**: Architecture choices (SwiGLU, RMSNorm) affect the constants in scaling laws but not the power-law exponents.
- **Module 05c (Tokenization)**: GPT-2 uses byte-level BPE (50257 tokens); BERT uses WordPiece (30522 tokens); LLaMA uses SentencePiece BPE (32000 tokens). Vocabulary size affects the embedding parameter count and sequence length.
- **Module 05d (Data/Training)**: Training LLaMA requires sophisticated distributed training strategies covered in the next lecture.
- **Module 06 (Alignment)**: GPT-based models are the starting point for RLHF alignment. The autoregressive structure enables reward modeling.

---

## 7. Paper Reading List

### Required

1. **Radford et al. (2018)**. *Improving Language Understanding by Generative Pre-Training* (GPT-1).
   - The original GPT paper. Read Sections 2–3 for the unsupervised pre-training and supervised fine-tuning framework.

2. **Radford et al. (2019)**. *Language Models are Unsupervised Multitask Learners* (GPT-2).
   - Introduces zero-shot task transfer. Read Section 2 for the architecture and Section 3 for the zero-shot results.

3. **Devlin et al. (2019)**. *BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding*. arXiv:1810.04805.
   - Read Sections 2–4 for MLM, NSP, and the fine-tuning framework.

4. **Touvron et al. (2023)**. *LLaMA: Open and Efficient Foundation Language Models*. arXiv:2302.13971.
   - Read Sections 2 (architecture) and 3 (training) for design choices and scaling.

### Recommended

5. **Raffel et al. (2020)**. *Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer* (T5). arXiv:1910.10683.
   - Comprehensive exploration of pre-training objectives. Read the ablation studies.

6. **Liu et al. (2019)**. *RoBERTa: A Robustly Optimized BERT Pretraining Approach*. arXiv:1907.11692.
   - Shows that BERT was significantly undertrained. Removes NSP, uses dynamic masking.

7. **Brown et al. (2020)**. *Language Models are Few-Shot Learners* (GPT-3). arXiv:2005.14165.
   - Read Sections 1–3 for the in-context learning paradigm.

8. **Shazeer (2020)**. *GLU Variants Improve Transformer*. arXiv:2002.05202.
   - Derives and compares GELU, SwiGLU, and other gated linear unit variants.

9. **Su et al. (2021)**. *RoFormer: Enhanced Transformer with Rotary Position Embedding*. arXiv:2104.09864.
   - Full derivation of RoPE.

### Advanced

10. **Wang & Komatsuzaki (2021)**. *GPT-J-6B: A 6 Billion Parameter Autoregressive Language Model*.
    - Parallel attention + FFN computation for efficiency.

11. **Chowdhery et al. (2022)**. *PaLM: Scaling Language Modeling with Pathways*. arXiv:2204.02311.
    - Scaling to 540B parameters with parallel FFN and multi-query attention.

---

## 8. Exercises

### Conceptual

**Exercise 5b.1.** Prove that the causal language modeling objective $\mathcal{L}_{\text{CLM}} = \sum_t \log p_\theta(x_t \mid \mathbf{x}_{<t})$ is a consistent estimator of $-D_{\text{KL}}(p_{\text{data}} \| p_\theta) - H(p_{\text{data}})$ as the number of training examples $M \to \infty$. State and verify the conditions required.

**Exercise 5b.2.** The MLM objective masks 15% of tokens. Compute the expected number of gradient updates per token position over $E$ training epochs. Compare this to CLM, where every token provides a gradient signal. How many epochs of MLM training are equivalent (in terms of per-token updates) to one epoch of CLM?

**Exercise 5b.3.** Derive the parameter count formula for a LLaMA model with Grouped Query Attention (GQA), where the number of KV heads $n_{\text{kv}} < n_{\text{heads}}$. Compute the parameter savings and KV cache memory savings for LLaMA-70B ($n_{\text{heads}} = 64$, $n_{\text{kv}} = 8$).

**Exercise 5b.4.** Prove that the RoPE attention score $\langle R_m q, R_n k \rangle$ depends only on $m - n$. Then show that RoPE can represent any relative-position-dependent attention pattern that a learned relative position bias (like ALiBi) can represent, but not vice versa.

### Computational

**Exercise 5b.5.** Implement the full GPT-2 model above and verify the parameter count matches 124,477,440. Load the pretrained GPT-2 weights from HuggingFace and verify that your implementation produces the same output (logits should match to within numerical precision).

**Exercise 5b.6.** Implement a BERT-Base model from scratch. Train it on masked language modeling on a small corpus (e.g., WikiText-103). Compare training curves with and without the NSP objective.

**Exercise 5b.7.** Implement RoPE and verify the relative-position property empirically: for random $q, k \in \mathbb{R}^{d_k}$, check that $\langle R_m q, R_n k \rangle = \langle R_{m-n} q, k \rangle$ holds to numerical precision.

**Exercise 5b.8.** Benchmark the inference speed (tokens/second) of GPT-2 with and without KV cache for prompt lengths $P \in \{128, 512, 1024\}$ and generation lengths $G \in \{64, 256\}$. Report the speedup factor and KV cache memory usage.

**Exercise 5b.9 (Research-Level).** Implement Grouped Query Attention (GQA) as used in LLaMA-2. Benchmark the KV cache memory savings vs. standard MHA and compare generation quality on a small language modeling task.
