# Lecture 04c: Positional Encodings

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Prove** that self-attention is permutation equivariant and therefore requires explicit positional information to distinguish sequence order.
2. **Derive** sinusoidal positional encodings and prove the relative position property: $PE_{pos+k}$ can be expressed as a linear function of $PE_{pos}$ for any fixed offset $k$.
3. **Analyze** learned positional embeddings, stating their advantages and limitations (especially for length generalization).
4. **Derive** Rotary Position Embeddings (RoPE) from first principles using rotation matrices in 2D subspaces, proving that the dot product $\langle f(q, m), f(k, n) \rangle$ depends only on $q$, $k$, and the relative position $m - n$.
5. **Describe** ALiBi (Attention with Linear Biases) and explain why it enables better length extrapolation than sinusoidal or learned encodings.
6. **Compare** absolute, relative, and rotary positional encodings in terms of computational cost, length generalization, and empirical performance.

---

## 2. Motivation and Context

### 2.1 Why Attention Needs Position Information

In Lecture 04a, we proved that self-attention is permutation equivariant:

$$\text{SelfAttn}(\Pi X) = \Pi \, \text{SelfAttn}(X)$$

for any permutation matrix $\Pi$. This means a Transformer without positional encoding treats its input as a **set**, not a sequence. It cannot distinguish "the cat sat on the mat" from "mat the on sat cat the." Every NLP task requires knowledge of token order, so we must inject positional information.

### 2.2 Historical Context

Positional encoding is not new to deep learning --- convolutional networks implicitly encode position through their receptive fields, and RNNs encode position through sequential processing. The Transformer's explicit positional encoding was initially seen as a minor design choice, but it has since become a major research area:

- **Vaswani et al. (2017)**: Sinusoidal positional encodings.
- **Devlin et al. (2019)**: Learned absolute positional embeddings (BERT).
- **Shaw et al. (2018)**: Relative position encodings.
- **Dai et al. (2019)**: Relative position in Transformer-XL.
- **Su et al. (2021)**: Rotary Position Embeddings (RoPE), now used in most modern LLMs.
- **Press et al. (2022)**: ALiBi (Attention with Linear Biases).

### 2.3 The Length Generalization Problem

A model trained on sequences of length $T_{\text{train}}$ is often evaluated on length $T_{\text{test}} > T_{\text{train}}$. Positional encodings that do not generalize to unseen lengths cause catastrophic failure. This is the **length extrapolation** problem, and different positional encoding schemes handle it very differently.

---

## 3. Core Theory

### 3.1 Formal Statement of Permutation Equivariance

**Theorem 3.1 (Self-Attention is Permutation Equivariant).** Let $\text{SA}(X) = \text{softmax}\!\left(\frac{XW^Q(XW^K)^\top}{\sqrt{d_k}}\right) XW^V$, where $X \in \mathbb{R}^{T \times d}$. For any permutation matrix $\Pi \in \{0,1\}^{T \times T}$ (where $\Pi^\top \Pi = I$):

$$\text{SA}(\Pi X) = \Pi \, \text{SA}(X)$$

*Proof.* Let $Q' = \Pi X W^Q = \Pi Q$, $K' = \Pi X W^K = \Pi K$, $V' = \Pi X W^V = \Pi V$.

The score matrix: $Q'(K')^\top = \Pi Q K^\top \Pi^\top = \Pi S \Pi^\top$

where $S = QK^\top / \sqrt{d_k}$. The softmax is applied row-wise. Since $\Pi S \Pi^\top$ permutes both rows and columns by $\Pi$:

$$[\text{softmax}(\Pi S \Pi^\top)]_{ij} = \text{softmax}(S_{\pi^{-1}(i), :})_{\pi^{-1}(j)}$$

That is, $\text{softmax}(\Pi S \Pi^\top) = \Pi \, \text{softmax}(S) \, \Pi^\top = \Pi A \Pi^\top$.

Finally: $\Pi A \Pi^\top \cdot \Pi V = \Pi A (\Pi^\top \Pi) V = \Pi A V = \Pi \, \text{SA}(X)$. $\blacksquare$

**Corollary.** The FFN is applied position-wise, so $\text{FFN}(\Pi X) = \Pi \, \text{FFN}(X)$. By induction, a full Transformer (without positional encoding) is permutation equivariant. It cannot distinguish permutations of its input.

### 3.2 Sinusoidal Positional Encodings

**Definition 3.1 (Sinusoidal PE).** (Vaswani et al., 2017) For position $\text{pos} \in \{0, 1, \ldots, T-1\}$ and dimension $i \in \{0, 1, \ldots, d-1\}$:

$$PE(\text{pos}, 2i) = \sin\!\left(\frac{\text{pos}}{10000^{2i/d}}\right), \qquad PE(\text{pos}, 2i+1) = \cos\!\left(\frac{\text{pos}}{10000^{2i/d}}\right)$$

The frequency for dimension pair $(2i, 2i+1)$ is $\omega_i = 1 / 10000^{2i/d}$. This creates a spectrum of frequencies from $\omega_0 = 1$ (fast oscillation) to $\omega_{d/2-1} = 1/10000$ (slow oscillation).

**Theorem 3.2 (Relative Position Property).** For any fixed offset $k$, there exists a matrix $R_k \in \mathbb{R}^{d \times d}$ (independent of $\text{pos}$) such that:

$$PE(\text{pos} + k) = R_k \, PE(\text{pos})$$

*Proof.* Consider the pair of dimensions $(2i, 2i+1)$ with frequency $\omega_i$:

$$\begin{pmatrix} PE(\text{pos}+k, 2i) \\ PE(\text{pos}+k, 2i+1) \end{pmatrix} = \begin{pmatrix} \sin(\omega_i(\text{pos}+k)) \\ \cos(\omega_i(\text{pos}+k)) \end{pmatrix}$$

Using the angle addition formulas:

$$\sin(\omega_i(\text{pos}+k)) = \sin(\omega_i \cdot \text{pos})\cos(\omega_i k) + \cos(\omega_i \cdot \text{pos})\sin(\omega_i k)$$
$$\cos(\omega_i(\text{pos}+k)) = \cos(\omega_i \cdot \text{pos})\cos(\omega_i k) - \sin(\omega_i \cdot \text{pos})\sin(\omega_i k)$$

In matrix form:

$$\begin{pmatrix} PE(\text{pos}+k, 2i) \\ PE(\text{pos}+k, 2i+1) \end{pmatrix} = \underbrace{\begin{pmatrix} \cos(\omega_i k) & \sin(\omega_i k) \\ -\sin(\omega_i k) & \cos(\omega_i k) \end{pmatrix}}_{R_k^{(i)}} \begin{pmatrix} PE(\text{pos}, 2i) \\ PE(\text{pos}, 2i+1) \end{pmatrix}$$

The matrix $R_k^{(i)}$ is a 2D rotation matrix by angle $\omega_i k$, which depends only on $k$ and $i$, not on $\text{pos}$.

The full rotation matrix $R_k \in \mathbb{R}^{d \times d}$ is block-diagonal:

$$R_k = \text{diag}(R_k^{(0)}, R_k^{(1)}, \ldots, R_k^{(d/2-1)})$$

Since $R_k$ is independent of $\text{pos}$, $PE(\text{pos}+k) = R_k \, PE(\text{pos})$ for all positions. $\blacksquare$

**Implication.** The dot product $PE(\text{pos}+k)^\top PE(\text{pos}) = PE(\text{pos})^\top R_k^\top PE(\text{pos})$. While $R_k$ is fixed for a given $k$, the dot product still depends on $\text{pos}$ (not just $k$), so sinusoidal encodings do not achieve pure relative position encoding in the dot-product sense. However, the linear transformation structure allows the model to potentially learn to extract relative position information through its $W^Q$ and $W^K$ projections.

### 3.3 Learned Positional Embeddings

**Definition 3.2 (Learned PE).** Maintain a learnable embedding table $E_{\text{pos}} \in \mathbb{R}^{T_{\max} \times d}$, where row $t$ is the positional embedding for position $t$:

$$x_t' = x_t + E_{\text{pos}}[t]$$

Used in BERT (Devlin et al., 2019) and GPT-2 (Radford et al., 2019).

**Advantages:**

- Maximum flexibility: can learn arbitrary position-dependent patterns.
- Simple to implement.

**Disadvantages:**

- Cannot extrapolate beyond $T_{\max}$: positions $t > T_{\max}$ have no embedding.
- Requires learning $T_{\max} \cdot d$ additional parameters.
- Empirically, learned embeddings do not generalize to longer sequences at test time.

**Empirical finding** (Vaswani et al., 2017): Sinusoidal and learned encodings achieve nearly identical performance on machine translation. The choice matters more for length generalization.

### 3.4 Rotary Position Embeddings (RoPE)

RoPE (Su et al., 2021) is the dominant positional encoding in modern LLMs (LLaMA, Mistral, Qwen, etc.). It encodes position information directly into the query and key vectors using rotations.

**Key Insight.** We want a function $f(x, m)$ that encodes both the token embedding $x$ and its position $m$, such that the dot product between two encoded vectors depends only on the tokens and their *relative* position:

$$\langle f(q, m), f(k, n) \rangle = g(q, k, m - n)$$

for some function $g$.

**Derivation in 2D.** Consider the simplest case: $d = 2$, so $q = (q_1, q_2)$, $k = (k_1, k_2)$.

We seek $f: \mathbb{R}^2 \times \mathbb{Z} \to \mathbb{R}^2$ such that:

$$f(q, m)^\top f(k, n) = g(q, k, m - n)$$

A natural choice is to *rotate* the vector by an angle proportional to position:

$$f(q, m) = R_m q = \begin{pmatrix} \cos(m\theta) & -\sin(m\theta) \\ \sin(m\theta) & \cos(m\theta) \end{pmatrix} \begin{pmatrix} q_1 \\ q_2 \end{pmatrix}$$

where $\theta$ is a fixed frequency.

**Theorem 3.3 (RoPE Relative Position Property).** If $f(q, m) = R_{m\theta} q$ (2D rotation by angle $m\theta$), then:

$$f(q, m)^\top f(k, n) = q^\top R_{(n-m)\theta} k = g(q, k, m-n)$$

*Proof.* Rotation matrices satisfy $R_\alpha^\top = R_{-\alpha}$ and $R_\alpha R_\beta = R_{\alpha+\beta}$. Therefore:

$$f(q, m)^\top f(k, n) = (R_{m\theta} q)^\top (R_{n\theta} k) = q^\top R_{m\theta}^\top R_{n\theta} k = q^\top R_{-m\theta} R_{n\theta} k = q^\top R_{(n-m)\theta} k$$

This depends on $q$, $k$, and $n - m$ only, as desired. $\blacksquare$

**Extension to $d$ dimensions.** For $d$-dimensional vectors, we pair up dimensions and apply a different rotation frequency to each pair. Let $\theta_i = 10000^{-2i/d}$ for $i = 0, 1, \ldots, d/2 - 1$. The RoPE transformation is:

$$f(x, m) = \underbrace{\begin{pmatrix} R_{m\theta_0} & & \\ & R_{m\theta_1} & \\ & & \ddots \\ & & & R_{m\theta_{d/2-1}} \end{pmatrix}}_{\mathcal{R}_m \in \mathbb{R}^{d \times d}} x$$

where each $R_{m\theta_i}$ is a $2 \times 2$ rotation matrix:

$$R_{m\theta_i} = \begin{pmatrix} \cos(m\theta_i) & -\sin(m\theta_i) \\ \sin(m\theta_i) & \cos(m\theta_i) \end{pmatrix}$$

**Theorem 3.4 (General RoPE Property).** For the block-diagonal rotation $\mathcal{R}_m$:

$$f(q, m)^\top f(k, n) = q^\top \mathcal{R}_{n-m} k = \sum_{i=0}^{d/2-1} \left[(q_{2i} k_{2i} + q_{2i+1} k_{2i+1})\cos((m-n)\theta_i) + (q_{2i} k_{2i+1} - q_{2i+1} k_{2i})\sin((m-n)\theta_i)\right]$$

*Proof.* Since $\mathcal{R}_m$ is block-diagonal with blocks $R_{m\theta_i}$:

$$q^\top \mathcal{R}_m^\top \mathcal{R}_n k = q^\top \mathcal{R}_{n-m} k = \sum_{i=0}^{d/2-1} (q_{2i}, q_{2i+1}) R_{(n-m)\theta_i} \begin{pmatrix} k_{2i} \\ k_{2i+1} \end{pmatrix}$$

Expanding each $2 \times 2$ block:

$$(q_{2i}, q_{2i+1}) \begin{pmatrix} \cos\alpha_i & -\sin\alpha_i \\ \sin\alpha_i & \cos\alpha_i \end{pmatrix} \begin{pmatrix} k_{2i} \\ k_{2i+1} \end{pmatrix}$$

where $\alpha_i = (n-m)\theta_i$. Multiplying out:

$$= q_{2i}(k_{2i}\cos\alpha_i - k_{2i+1}\sin\alpha_i) + q_{2i+1}(k_{2i}\sin\alpha_i + k_{2i+1}\cos\alpha_i)$$

$$= (q_{2i}k_{2i} + q_{2i+1}k_{2i+1})\cos\alpha_i + (q_{2i+1}k_{2i} - q_{2i}k_{2i+1})\sin\alpha_i$$

which matches the stated formula (with sign convention $m - n$ vs $n - m$). $\blacksquare$

**Efficient Implementation.** The rotation can be applied without constructing the full $d \times d$ matrix:

$$f(x, m)_{2i} = x_{2i} \cos(m\theta_i) - x_{2i+1} \sin(m\theta_i)$$
$$f(x, m)_{2i+1} = x_{2i} \sin(m\theta_i) + x_{2i+1} \cos(m\theta_i)$$

This requires $O(d)$ operations per position, with no additional parameters.

**RoPE in Attention.** RoPE is applied to queries and keys *after* the linear projections:

$$\tilde{Q}_m = \mathcal{R}_m (X_m W^Q), \qquad \tilde{K}_n = \mathcal{R}_n (X_n W^K)$$

$$\text{Attn}_{mn} = \frac{\tilde{Q}_m^\top \tilde{K}_n}{\sqrt{d_k}} = \frac{(X_m W^Q)^\top \mathcal{R}_{n-m} (X_n W^K)}{\sqrt{d_k}}$$

Values $V$ are *not* rotated --- position information enters only through the attention weights.

### 3.5 ALiBi: Attention with Linear Biases

**Definition 3.3 (ALiBi).** (Press et al., 2022) Instead of adding positional encodings to embeddings, ALiBi adds a static, non-learned bias to the attention scores:

$$\text{Attn}_{mn} = \frac{q_m^\top k_n}{\sqrt{d_k}} - \lambda_h |m - n|$$

where $\lambda_h > 0$ is a head-specific slope. The slopes are set geometrically:

$$\lambda_h = 2^{-8/H \cdot h}, \quad h = 1, 2, \ldots, H$$

for $H$ attention heads. This means different heads penalize distance at different rates: some heads can attend far (small $\lambda$) while others are restricted to local context (large $\lambda$).

**Properties:**

- No additional parameters (the slopes are fixed).
- No positional information in the embeddings.
- Naturally decays attention for distant tokens, providing an inductive bias for locality.
- **Length extrapolation**: Since the bias $-\lambda|m-n|$ is defined for any $m, n$, ALiBi naturally handles sequences longer than those seen during training. Empirically, ALiBi models trained on length $T$ can be evaluated on $2T$ or more with minimal degradation.

**Theoretical Interpretation.** ALiBi implements a position-dependent prior on attention that favors nearby tokens. The attention weight is:

$$\alpha_{mn} \propto \exp\!\left(\frac{q_m^\top k_n}{\sqrt{d_k}} - \lambda |m-n|\right)$$

This is equivalent to multiplying the softmax kernel by an exponential decay: $K(q_m, k_n) \cdot \exp(-\lambda|m-n|)$. In the kernel smoothing interpretation (Lecture 04a), this adds a distance-dependent kernel on top of the content-based kernel.

### 3.6 Relative Position Encodings (Shaw et al., 2018)

**Definition 3.4 (Relative Position Representations).** Add learned relative position embeddings directly to the attention computation:

$$e_{mn} = \frac{(x_m W^Q)(x_n W^K + a_{m-n}^K)^\top}{\sqrt{d_k}}$$

$$o_m = \sum_n \alpha_{mn} (x_n W^V + a_{m-n}^V)$$

where $a_r^K, a_r^V \in \mathbb{R}^{d_k}$ are learned embeddings for relative position $r$, clipped to $[-k, k]$ for some maximum relative distance $k$.

**T5-Style Relative Position Bias.** (Raffel et al., 2020) Simplifies Shaw et al. by adding a scalar bias:

$$e_{mn} = \frac{q_m^\top k_n}{\sqrt{d_k}} + b(m-n)$$

where $b(r)$ is a learned scalar function of the relative position, bucketed logarithmically for large distances.

### 3.7 Comparison of Positional Encodings

| Method | Parameters | Length Extrapolation | Relative Position | Compute Overhead |
|--------|:-----------|:---------------------|:-------------------|:-----------------|
| Sinusoidal | 0 | Moderate (unseen freqs) | Indirect (via $R_k$) | $O(Td)$ |
| Learned | $T_{\max} \cdot d$ | None (hard cutoff) | No | $O(Td)$ |
| RoPE | 0 | Good (with NTK scaling) | Yes (by construction) | $O(Td)$ |
| ALiBi | 0 | Excellent | Yes (distance penalty) | $O(T^2 H)$ |
| T5 Relative | $O(\text{buckets} \times H)$ | Good (log bucketing) | Yes | $O(T^2 H)$ |

### 3.8 NTK-Aware RoPE Scaling

For extending RoPE to longer sequences, several scaling strategies exist:

**Position interpolation** (Chen et al., 2023): Scale positions by $T_{\text{train}} / T_{\text{test}}$:

$$f(x, m) = \mathcal{R}_{m \cdot T_{\text{train}}/T_{\text{test}}} x$$

This interpolates rather than extrapolates, keeping positions within the trained range.

**NTK-aware scaling** (Reddit, 2023; Peng et al., 2023): Modify the base frequency:

$$\theta_i' = (10000 \cdot \alpha)^{-2i/d}$$

where $\alpha > 1$ stretches the frequencies. This allows high-frequency dimensions to maintain resolution (important for nearby tokens) while extending the range of low-frequency dimensions.

**YaRN** (Peng et al., 2023): Combines NTK scaling with a temperature adjustment and a ramp function that blends between no scaling (high-frequency dimensions) and full scaling (low-frequency dimensions).

---

## 4. Algorithmic Derivation

### 4.1 Sinusoidal Encoding Construction

```
Algorithm: SinusoidalPE(T, d)
─────────────────────────────
Input:  T: sequence length, d: model dimension (must be even)
Output: PE ∈ ℝ^{T × d}

1. for pos = 0 to T-1:
2.     for i = 0 to d/2 - 1:
3.         ω_i ← 1 / 10000^(2i/d)
4.         PE[pos, 2i]   ← sin(pos · ω_i)
5.         PE[pos, 2i+1] ← cos(pos · ω_i)
6. return PE

Complexity: O(T · d)
Memory: O(T · d), precomputed once
```

### 4.2 RoPE Application

```
Algorithm: ApplyRoPE(x, positions)
──────────────────────────────────
Input:  x ∈ ℝ^{T × d}          (query or key vectors after linear projection)
        positions ∈ ℤ^T         (position indices)
Output: x_rot ∈ ℝ^{T × d}     (rotated vectors)

1. for i = 0 to d/2 - 1:
2.     θ_i ← 10000^(-2i/d)
3. for t = 0 to T-1:
4.     m ← positions[t]
5.     for i = 0 to d/2 - 1:
6.         c ← cos(m · θ_i)
7.         s ← sin(m · θ_i)
8.         x_rot[t, 2i]   ← x[t, 2i] · c - x[t, 2i+1] · s
9.         x_rot[t, 2i+1] ← x[t, 2i] · s + x[t, 2i+1] · c
10. return x_rot

Complexity: O(T · d), same as adding sinusoidal PE
No additional parameters
```

### 4.3 ALiBi Bias Computation

```
Algorithm: ALiBiBias(T_q, T_k, n_heads)
────────────────────────────────────────
Input:  T_q, T_k: query and key lengths
        n_heads: number of attention heads
Output: bias ∈ ℝ^{n_heads × T_q × T_k}

1. slopes ← geometric_sequence(2^(-8/n_heads), ..., 2^(-8), length=n_heads)
2. for h = 0 to n_heads-1:
3.     for m = 0 to T_q-1:
4.         for n = 0 to T_k-1:
5.             bias[h, m, n] ← -slopes[h] · |m - n|
6. return bias

Complexity: O(H · T_q · T_k) for construction; added to attention scores
```

---

## 5. PyTorch Implementation

### 5.1 Sinusoidal Positional Encoding

```python
import torch
import torch.nn as nn
import math

class SinusoidalPositionalEncoding(nn.Module):
    """
    Sinusoidal positional encoding (Vaswani et al., 2017).
    Precomputed and registered as a buffer (not a parameter).
    """
    def __init__(self, d_model: int, max_len: int = 5000, dropout: float = 0.1):
        super().__init__()
        self.dropout = nn.Dropout(dropout)

        pe = torch.zeros(max_len, d_model)                    # (max_len, d)
        position = torch.arange(0, max_len).unsqueeze(1).float()  # (max_len, 1)

        # Compute frequencies: ω_i = 1 / 10000^(2i/d)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )  # (d/2,)

        pe[:, 0::2] = torch.sin(position * div_term)  # even dimensions
        pe[:, 1::2] = torch.cos(position * div_term)  # odd dimensions

        self.register_buffer('pe', pe.unsqueeze(0))  # (1, max_len, d)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, d)
        T = x.size(1)
        x = x + self.pe[:, :T, :]   # (B, T, d) + (1, T, d) via broadcasting
        return self.dropout(x)
```

### 5.2 Learned Positional Embedding

```python
class LearnedPositionalEmbedding(nn.Module):
    """Learned positional embeddings (BERT/GPT-2 style)."""

    def __init__(self, d_model: int, max_len: int = 512, dropout: float = 0.1):
        super().__init__()
        self.embedding = nn.Embedding(max_len, d_model)  # (max_len, d)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, d)
        T = x.size(1)
        positions = torch.arange(0, T, device=x.device)  # (T,)
        x = x + self.embedding(positions)  # (B, T, d) + (T, d) via broadcasting
        return self.dropout(x)
```

### 5.3 Rotary Position Embeddings (RoPE)

```python
class RotaryPositionalEmbedding(nn.Module):
    """
    Rotary Position Embeddings (Su et al., 2021).

    Applied to Q and K after linear projection, BEFORE computing attention scores.
    Does NOT modify the input embeddings.
    """
    def __init__(self, d_model: int, base: float = 10000.0):
        super().__init__()
        self.d_model = d_model
        # Precompute inverse frequencies: θ_i = base^(-2i/d) for i = 0,...,d/2-1
        inv_freq = 1.0 / (base ** (torch.arange(0, d_model, 2).float() / d_model))
        self.register_buffer('inv_freq', inv_freq)  # (d/2,)

    def _compute_rotary_emb(
        self, seq_len: int, device: torch.device
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Compute cos and sin tables for positions 0..seq_len-1."""
        positions = torch.arange(seq_len, device=device).float()  # (T,)
        # Outer product: (T,) × (d/2,) -> (T, d/2)
        freqs = torch.outer(positions, self.inv_freq)  # (T, d/2)
        # Duplicate for pairing: (T, d)
        emb = torch.cat([freqs, freqs], dim=-1)  # (T, d)
        return emb.cos(), emb.sin()  # each (T, d)

    @staticmethod
    def _rotate_half(x: torch.Tensor) -> torch.Tensor:
        """Rearrange x so that rotation can be applied via element-wise ops.

        Given x = [x0, x1, x2, x3, ...], returns [-x_{d/2}, ..., -x_{d-1}, x_0, ..., x_{d/2-1}]
        This implements the -x_{2i+1}, x_{2i} pattern needed for rotation.
        """
        d_half = x.shape[-1] // 2
        x1 = x[..., :d_half]
        x2 = x[..., d_half:]
        return torch.cat([-x2, x1], dim=-1)

    def forward(
        self, q: torch.Tensor, k: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Apply RoPE to query and key tensors.

        Args:
            q: (B, n_heads, T, d_k)
            k: (B, n_heads, T, d_k)

        Returns:
            q_rot: (B, n_heads, T, d_k) with position-encoded queries
            k_rot: (B, n_heads, T, d_k) with position-encoded keys
        """
        T = q.size(2)
        cos, sin = self._compute_rotary_emb(T, q.device)  # each (T, d_k)

        # Reshape for broadcasting: (1, 1, T, d_k)
        cos = cos[:T].unsqueeze(0).unsqueeze(0)
        sin = sin[:T].unsqueeze(0).unsqueeze(0)

        # Apply rotation: x * cos + rotate_half(x) * sin
        # This implements: x_{2i} cos(mθ) - x_{2i+1} sin(mθ), x_{2i} sin(mθ) + x_{2i+1} cos(mθ)
        q_rot = q * cos + self._rotate_half(q) * sin  # (B, h, T, d_k)
        k_rot = k * cos + self._rotate_half(k) * sin  # (B, h, T, d_k)

        return q_rot, k_rot
```

### 5.4 ALiBi

```python
class ALiBi(nn.Module):
    """
    Attention with Linear Biases (Press et al., 2022).

    Adds a non-learned linear distance penalty to attention scores.
    """
    def __init__(self, n_heads: int):
        super().__init__()
        # Geometric slopes: 2^(-8/n_heads), 2^(-16/n_heads), ..., 2^(-8)
        slopes = torch.tensor([
            2 ** (-8.0 * i / n_heads) for i in range(1, n_heads + 1)
        ])  # (n_heads,)
        self.register_buffer('slopes', slopes)

    def forward(self, T_q: int, T_k: int) -> torch.Tensor:
        """
        Compute ALiBi bias matrix.

        Returns:
            bias: (1, n_heads, T_q, T_k) to be added to attention scores
        """
        # Distance matrix: |i - j| for i in [0, T_q), j in [0, T_k)
        q_pos = torch.arange(T_q, device=self.slopes.device).unsqueeze(1)  # (T_q, 1)
        k_pos = torch.arange(T_k, device=self.slopes.device).unsqueeze(0)  # (1, T_k)
        distance = (q_pos - k_pos).abs().float()  # (T_q, T_k)

        # Multiply each head's slope by the distance matrix
        # slopes: (H,) -> (H, 1, 1); distance: (T_q, T_k) -> (1, T_q, T_k)
        bias = -self.slopes.unsqueeze(1).unsqueeze(1) * distance.unsqueeze(0)

        return bias.unsqueeze(0)  # (1, H, T_q, T_k)
```

### 5.5 Multi-Head Attention with RoPE

```python
class MultiHeadAttentionRoPE(nn.Module):
    """Multi-head attention with Rotary Position Embeddings."""

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
        self.rope = RotaryPositionalEmbedding(self.d_k)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,               # (B, T, d_model)
        mask: torch.Tensor = None,      # (1, 1, T, T)
    ) -> torch.Tensor:
        B, T, _ = x.shape
        h, d_k = self.n_heads, self.d_k

        Q = self.W_Q(x).view(B, T, h, d_k).transpose(1, 2)  # (B, h, T, d_k)
        K = self.W_K(x).view(B, T, h, d_k).transpose(1, 2)
        V = self.W_V(x).view(B, T, h, d_k).transpose(1, 2)

        # Apply RoPE to Q and K (NOT to V!)
        Q, K = self.rope(Q, K)  # (B, h, T, d_k)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn = self.dropout(torch.softmax(scores, dim=-1))
        out = torch.matmul(attn, V)  # (B, h, T, d_k)

        out = out.transpose(1, 2).contiguous().view(B, T, self.d_model)
        return self.W_O(out)
```

### 5.6 Verification

```python
def verify_positional_encodings():
    """Verify correctness and properties of positional encodings."""
    torch.manual_seed(42)
    B, T, d = 2, 16, 64

    # --- Sinusoidal: verify relative position property ---
    sin_pe = SinusoidalPositionalEncoding(d, max_len=100, dropout=0.0)
    x_zeros = torch.zeros(1, T, d)
    pe_vals = sin_pe(x_zeros)[0]  # (T, d) - just the PE values

    # Check that PE(pos+k) = R_k @ PE(pos) for k=3
    k = 3
    for pos in range(T - k):
        pe_pos = pe_vals[pos]      # (d,)
        pe_pos_k = pe_vals[pos + k]  # (d,)
        # Reconstruct via rotation for each 2D pair
        reconstructed = torch.zeros(d)
        for i in range(d // 2):
            omega = 1.0 / (10000.0 ** (2 * i / d))
            c, s = math.cos(k * omega), math.sin(k * omega)
            reconstructed[2*i] = c * pe_pos[2*i] + s * pe_pos[2*i+1]
            reconstructed[2*i+1] = -s * pe_pos[2*i] + c * pe_pos[2*i+1]
        assert torch.allclose(pe_pos_k, reconstructed, atol=1e-5), \
            f"Relative position property failed at pos={pos}"

    # --- RoPE: verify relative position property ---
    rope = RotaryPositionalEmbedding(d)
    q = torch.randn(1, 1, T, d)  # (B, h, T, d)
    k_tensor = torch.randn(1, 1, T, d)

    q_rot, k_rot = rope(q, k_tensor)

    # Check dot product depends on relative position
    # <f(q_m, m), f(k_n, n)> should equal <f(q_m, m+delta), f(k_n, n+delta)>
    # (if we shift both by delta, relative position is unchanged)
    # We verify: <q_rot[3], k_rot[5]> depends on 3-5 = -2
    # By constructing q and k at shifted positions
    dot_orig = (q_rot[0, 0, 3] * k_rot[0, 0, 5]).sum()

    # Shift: put q at position 7, k at position 9 (same relative offset -2)
    q2 = torch.zeros_like(q)
    k2 = torch.zeros_like(k_tensor)
    q2[0, 0, 7] = q[0, 0, 3]  # same q vector at position 7
    k2[0, 0, 9] = k_tensor[0, 0, 5]  # same k vector at position 9
    q2_rot, k2_rot = rope(q2, k2)
    dot_shifted = (q2_rot[0, 0, 7] * k2_rot[0, 0, 9]).sum()
    assert torch.allclose(dot_orig, dot_shifted, atol=1e-4), \
        f"RoPE relative position failed: {dot_orig:.4f} vs {dot_shifted:.4f}"

    # --- ALiBi: verify shape and properties ---
    alibi = ALiBi(n_heads=8)
    bias = alibi(T, T)
    assert bias.shape == (1, 8, T, T), f"Got {bias.shape}"
    assert (bias <= 0).all(), "ALiBi bias should be non-positive"
    # Diagonal should be zero (distance = 0)
    for h in range(8):
        diag = torch.diagonal(bias[0, h])
        assert torch.allclose(diag, torch.zeros_like(diag)), "Diagonal should be 0"

    print("All positional encoding tests passed!")

verify_positional_encodings()
```

---

## 6. Experimental Intuition

### 6.1 Frequency Spectrum of Sinusoidal Encodings

The frequencies $\omega_i = 10000^{-2i/d}$ span several orders of magnitude:

- $\omega_0 = 1$: The first pair of dimensions oscillates every $2\pi \approx 6.3$ positions.
- $\omega_{d/4} \approx 0.01$: Mid-range dimensions oscillate every ~628 positions.
- $\omega_{d/2-1} \approx 10^{-4}$: The last dimensions oscillate every ~62,832 positions.

This logarithmic spacing is analogous to the frequency channels in a Fourier transform. Different pairs encode information at different spatial scales.

### 6.2 Length Extrapolation Results

Press et al. (2022) trained models on length 1024 and evaluated on lengths up to 8192:

| Method | Train 1024 | Eval 2048 | Eval 4096 | Eval 8192 |
|:-------|:-----------|:----------|:----------|:----------|
| Sinusoidal | 25.1 ppl | 1e8 ppl | 1e8 ppl | 1e8 ppl |
| Learned | 25.0 ppl | 1e8 ppl | 1e8 ppl | 1e8 ppl |
| RoPE | 25.2 ppl | 110 ppl | 1e5 ppl | 1e8 ppl |
| ALiBi | 25.3 ppl | 25.8 ppl | 26.5 ppl | 27.4 ppl |
| RoPE + NTK | 25.2 ppl | 26.0 ppl | 27.1 ppl | 29.5 ppl |

ALiBi shows the best raw extrapolation. RoPE with NTK-aware scaling bridges much of the gap. Modern practice (2024+) predominantly uses RoPE with some form of scaling.

### 6.3 Visualizing Positional Similarity

The dot product $PE(i)^\top PE(j)$ as a function of $|i - j|$:

- **Sinusoidal**: Oscillates, with decreasing amplitude as $|i-j|$ grows. Not monotonically decreasing.
- **Learned**: Typically shows a peaked pattern at $|i-j| = 0$ with rapid decay, but the shape is entirely learned and can be irregular.
- **RoPE**: The dot product $q^\top \mathcal{R}_{n-m} k$ decays for large $|n-m|$ because the high-frequency rotations destructively interfere.

### 6.4 Failure Modes

1. **Sinusoidal at extrapolated lengths**: The PE vectors at positions $> T_{\text{train}}$ are valid sine/cosine values but the model has never seen them during training, leading to unpredictable behavior.
2. **Learned embeddings at extrapolated lengths**: Undefined --- there is simply no embedding for positions beyond $T_{\max}$.
3. **RoPE at very long sequences**: High-frequency dimensions rotate so fast that the dot product becomes noise. NTK scaling addresses this by reducing the effective frequency.
4. **ALiBi with very long-range dependencies**: The linear penalty can overly suppress long-range attention when the dependency is truly long-range.

---

## 7. Connections and Extensions

### 7.1 Connection to Fourier Features

Sinusoidal positional encodings are a special case of Random Fourier Features (Rahimi & Recht, 2007) with deterministic (non-random) frequencies. The idea of encoding position via sinusoids goes back to the "position encoding" used in digital signal processing and even to ancient Babylonian astronomy.

### 7.2 RoPE and Complex Numbers

RoPE can be elegantly expressed using complex arithmetic. Viewing consecutive dimension pairs as complex numbers $z = x_{2i} + i \cdot x_{2i+1}$, the rotation becomes:

$$f(z, m) = z \cdot e^{im\theta}$$

The dot product between $f(z_q, m)$ and $f(z_k, n)$ is:

$$\text{Re}[\overline{f(z_q, m)} \cdot f(z_k, n)] = \text{Re}[\bar{z}_q \cdot e^{-im\theta} \cdot z_k \cdot e^{in\theta}] = \text{Re}[\bar{z}_q z_k e^{i(n-m)\theta}]$$

which depends on $n - m$ only, as expected. Some implementations (e.g., LLaMA) use this complex-number formulation directly.

### 7.3 Continuous Positions and NeRF

The idea of encoding continuous coordinates with sinusoidal features is also central to Neural Radiance Fields (NeRF, Mildenhall et al., 2020). There, 3D spatial coordinates are encoded with:

$$\gamma(p) = (\sin(2^0 \pi p), \cos(2^0 \pi p), \ldots, \sin(2^{L-1} \pi p), \cos(2^{L-1} \pi p))$$

This is the same principle as sinusoidal PE: mapping low-dimensional input to a high-dimensional space where the MLP can more easily learn high-frequency functions.

### 7.4 Contextual Position Encodings

CoPE (Golovneva et al., 2024) proposes computing positions based on the context rather than using fixed indices. The idea: not all tokens are equally "far" in terms of information content. Punctuation might be "closer" to the next sentence than the words within the current sentence. CoPE uses attention weights to compute effective positions dynamically.

---

## 8. Seminal Paper Reading List

1. **Vaswani, A., et al.** (2017). *Attention Is All You Need.* NeurIPS 2017.
   - Sinusoidal positional encodings (Section 3.5).

2. **Shaw, P., Uszkoreit, J., & Vaswani, A.** (2018). *Self-Attention with Relative Position Representations.* NAACL 2018.
   - Learned relative position embeddings added to keys/values.

3. **Su, J., Lu, Y., Pan, S., Murtadha, A., Wen, B., & Liu, Y.** (2021). *RoFormer: Enhanced Transformer with Rotary Position Embedding.* arXiv.
   - Rotary Position Embeddings (RoPE). Now used in LLaMA, Mistral, Qwen.

4. **Press, O., Smith, N., & Lewis, M.** (2022). *Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation.* ICLR 2022.
   - ALiBi: non-learned linear distance penalty.

5. **Dai, Z., et al.** (2019). *Transformer-XL: Attentive Language Models Beyond a Fixed-Length Context.* ACL 2019.
   - Relative positional encodings in the context of segment-level recurrence.

6. **Chen, S., et al.** (2023). *Extending Context Window of Large Language Models via Positional Interpolation.* arXiv.
   - Position interpolation for RoPE.

---

## 9. Exercises

### Theory Exercises

**Exercise 4c.1.** Prove that the sinusoidal positional encoding vectors have constant norm: $\|PE(\text{pos})\|^2 = d/2$ for all $\text{pos}$.

**Exercise 4c.2.** Derive the dot product $PE(\text{pos})^\top PE(\text{pos}+k)$ in closed form (as a sum of cosines). Show that it depends on $k$ but also on $\text{pos}$, confirming that sinusoidal encodings do not perfectly encode relative position.

**Exercise 4c.3.** Starting from the requirement $\langle f(q, m), f(k, n) \rangle = g(q, k, m-n)$, derive RoPE. Specifically: (a) Show that the 2D rotation solution is unique up to the choice of $\theta$. (b) Prove that the general $d$-dimensional solution is the block-diagonal rotation matrix.

**Exercise 4c.4.** For ALiBi with slope $\lambda$, compute the effective "attention radius" (the distance beyond which the bias reduces the softmax probability by a factor of $e$). Express this as a function of $\lambda$ and the typical score magnitude.

**Exercise 4c.5.** Prove that RoPE preserves the norm of the query and key vectors: $\|\mathcal{R}_m q\| = \|q\|$ for all $m, q$. Why is this a desirable property?

### Implementation Exercises

**Exercise 4c.6.** Implement sinusoidal, learned, and RoPE positional encodings. Train a small Transformer on a sequence sorting task (sort a random permutation of integers). Compare which encoding achieves the best length generalization when trained on length 20 and tested on lengths 20, 40, 80.

**Exercise 4c.7.** Implement ALiBi and integrate it into a decoder-only Transformer. Verify that it achieves better length extrapolation than sinusoidal encodings on a language modeling task.

**Exercise 4c.8.** Implement NTK-aware RoPE scaling. Start with a model trained on length 512 with standard RoPE, then evaluate on length 2048 with and without NTK scaling. Plot perplexity vs sequence length for both.

**Exercise 4c.9.** Visualize the dot product $PE(i)^\top PE(j)$ for sinusoidal encodings as a $T \times T$ heatmap. Repeat for RoPE (using random $q = k$). Contrast the patterns and discuss their implications.
