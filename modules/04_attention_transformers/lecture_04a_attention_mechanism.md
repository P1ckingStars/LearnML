# Lecture 04a: The Attention Mechanism

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** attention as a soft dictionary lookup and write the general form $\text{Attn}(Q,K,V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$, specifying the shapes of all matrices involved.
2. **Derive** the $1/\sqrt{d_k}$ scaling factor from a variance analysis of dot products, proving that without scaling, the softmax saturates and gradients vanish.
3. **Distinguish** additive (Bahdanau), multiplicative (Luong), and scaled dot-product attention, stating the computational complexity of each and when each is preferred.
4. **Derive** multi-head attention from a subspace decomposition argument and prove that independent heads learn orthogonal attention patterns when properly regularized.
5. **Compute** the full gradient $\frac{\partial \mathcal{L}}{\partial Q}$, $\frac{\partial \mathcal{L}}{\partial K}$, $\frac{\partial \mathcal{L}}{\partial V}$ through the attention mechanism.
6. **Interpret** attention as kernel smoothing / Nadaraya-Watson regression and connect it to the nonparametric statistics literature.

---

## 2. Motivation and Context

### 2.1 The Bottleneck of Seq2Seq

In Lecture 03d, we saw that encoder-decoder models compress the entire source sequence into a single fixed-length context vector $c = h_T^{\text{enc}}$. This forces the encoder to pack all information about an arbitrarily long sequence into a vector of fixed dimension $n$. Empirically, **Cho et al. (2014)** showed that seq2seq performance degrades sharply on sentences longer than about 30 tokens.

The fundamental issue is information-theoretic: a vector $c \in \mathbb{R}^n$ can carry at most $O(n)$ bits of information, but the source sequence may contain $O(T)$ independently relevant pieces of information where $T \gg n$.

### 2.2 The Birth of Attention

**Bahdanau, Cho, and Bengio (2015)** proposed a simple but revolutionary solution: instead of compressing the entire source into one vector, allow the decoder to *look back* at all encoder hidden states at each decoding step, selecting the most relevant ones. This mechanism was called **attention**.

At decoder step $t$, the model computes a context vector as a weighted sum of encoder hidden states:

$$c_t = \sum_{s=1}^{S} \alpha_{t,s} \, h_s^{\text{enc}}$$

where the weights $\alpha_{t,s}$ are learned functions of the decoder state and the encoder states. This single idea unlocked dramatic improvements in machine translation and quickly became the dominant mechanism in all sequence-to-sequence architectures.

**Luong, Pham, and Manning (2015)** proposed simpler alternatives (multiplicative attention), and **Vaswani et al. (2017)** showed that attention alone, without any recurrence, suffices to build state-of-the-art models --- the Transformer.

### 2.3 Attention as a General Principle

The attention mechanism transcends NLP. It is now used in computer vision (Vision Transformers), graph neural networks, protein structure prediction (AlphaFold), reinforcement learning (Decision Transformer), and essentially every domain of deep learning. Understanding attention at a mathematical level is indispensable for modern ML research.

---

## 3. Core Theory

### 3.1 Attention as Soft Dictionary Lookup

**Definition 3.1 (Hard Dictionary Lookup).** Given a set of key-value pairs $\{(k_i, v_i)\}_{i=1}^{n}$ and a query $q$, a hard dictionary lookup returns:

$$\text{HardLookup}(q, \{(k_i, v_i)\}) = v_{i^*} \quad \text{where } i^* = \arg\max_i \, \text{sim}(q, k_i)$$

This is non-differentiable (the $\arg\max$ has zero gradient almost everywhere).

**Definition 3.2 (Soft Dictionary Lookup / Attention).** We replace the hard selection with a soft weighted average:

$$\text{Attn}(q, \{(k_i, v_i)\}) = \sum_{i=1}^{n} \alpha_i \, v_i$$

where the attention weights are:

$$\alpha_i = \frac{\exp(e_i)}{\sum_{j=1}^{n} \exp(e_j)}, \qquad e_i = \text{score}(q, k_i)$$

The score function $\text{score}(q, k)$ measures the compatibility between query and key. Different choices of score function give different attention mechanisms.

**Remark.** In matrix form, given queries $Q \in \mathbb{R}^{T_q \times d_k}$, keys $K \in \mathbb{R}^{T_k \times d_k}$, and values $V \in \mathbb{R}^{T_k \times d_v}$:

$$\text{Attn}(Q, K, V) = \underbrace{\text{softmax}\!\left(\text{score}(Q, K)\right)}_{\in \mathbb{R}^{T_q \times T_k}} \underbrace{V}_{\in \mathbb{R}^{T_k \times d_v}} \in \mathbb{R}^{T_q \times d_v}$$

where softmax is applied row-wise.

### 3.2 Score Functions

**Definition 3.3 (Additive / Bahdanau Attention).** (Bahdanau et al., 2015)

$$\text{score}_{\text{add}}(q, k) = w^\top \tanh(W_q q + W_k k)$$

where $W_q \in \mathbb{R}^{d_a \times d_q}$, $W_k \in \mathbb{R}^{d_a \times d_k}$, $w \in \mathbb{R}^{d_a}$. The intermediate dimension $d_a$ is a hyperparameter.

- **Complexity per query-key pair**: $O(d_a (d_q + d_k))$ for the linear maps plus $O(d_a)$ for the tanh and dot product.
- **Advantage**: Can handle $d_q \neq d_k$ naturally.
- **Disadvantage**: Requires additional parameters; harder to parallelize.

**Definition 3.4 (Multiplicative / Luong Attention).** (Luong et al., 2015)

$$\text{score}_{\text{mult}}(q, k) = q^\top W k$$

where $W \in \mathbb{R}^{d_q \times d_k}$. When $d_q = d_k$ and $W = I$, this reduces to:

$$\text{score}_{\text{dot}}(q, k) = q^\top k$$

- **Complexity per query-key pair**: $O(d_q d_k)$ for the general form; $O(d_k)$ for dot product.
- **Advantage**: Simple, fast, and highly parallelizable via matrix multiplication.

**Definition 3.5 (Scaled Dot-Product Attention).** (Vaswani et al., 2017)

$$\text{score}_{\text{scaled}}(q, k) = \frac{q^\top k}{\sqrt{d_k}}$$

$$\text{Attn}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

The scaling factor $1/\sqrt{d_k}$ is crucial. We now derive why.

### 3.3 Why $1/\sqrt{d_k}$: Variance Analysis

**Theorem 3.1 (Variance of Dot Products).** Let $q, k \in \mathbb{R}^{d_k}$ where each component $q_i, k_j$ is drawn independently with $\mathbb{E}[q_i] = \mathbb{E}[k_j] = 0$ and $\text{Var}(q_i) = \text{Var}(k_j) = 1$. Then:

$$\mathbb{E}[q^\top k] = 0, \qquad \text{Var}(q^\top k) = d_k$$

*Proof.* We have $q^\top k = \sum_{i=1}^{d_k} q_i k_i$. Since $q_i$ and $k_i$ are independent with zero mean:

$$\mathbb{E}[q_i k_i] = \mathbb{E}[q_i]\mathbb{E}[k_i] = 0$$

so $\mathbb{E}[q^\top k] = \sum_{i=1}^{d_k} \mathbb{E}[q_i k_i] = 0$.

For the variance, since the $q_i k_i$ terms are independent (the indices are distinct):

$$\text{Var}(q^\top k) = \sum_{i=1}^{d_k} \text{Var}(q_i k_i)$$

Now $\text{Var}(q_i k_i) = \mathbb{E}[q_i^2 k_i^2] - (\mathbb{E}[q_i k_i])^2 = \mathbb{E}[q_i^2]\mathbb{E}[k_i^2] - 0 = 1 \cdot 1 = 1$. Therefore:

$$\text{Var}(q^\top k) = d_k \qquad \blacksquare$$

**Corollary 3.1.** The standard deviation of $q^\top k$ is $\sqrt{d_k}$. As $d_k$ grows, the dot products grow in magnitude, pushing the softmax into saturated regions where:

$$\text{softmax}(z)_i \approx \begin{cases} 1 & \text{if } z_i = \max_j z_j \\ 0 & \text{otherwise} \end{cases}$$

In these saturated regions, the Jacobian of softmax has near-zero entries:

$$\frac{\partial \text{softmax}(z)_i}{\partial z_j} = \text{softmax}(z)_i (\delta_{ij} - \text{softmax}(z)_j) \approx 0$$

which means gradients vanish. Scaling by $1/\sqrt{d_k}$ normalizes the dot products to have unit variance, keeping the softmax in a regime where gradients flow.

**Proposition 3.1.** After scaling, $\text{Var}\!\left(\frac{q^\top k}{\sqrt{d_k}}\right) = 1$, independent of $d_k$.

*Proof.* $\text{Var}\!\left(\frac{q^\top k}{\sqrt{d_k}}\right) = \frac{1}{d_k} \text{Var}(q^\top k) = \frac{d_k}{d_k} = 1$. $\blacksquare$

### 3.4 Multi-Head Attention

**Definition 3.6 (Multi-Head Attention).** Instead of performing a single attention function with $d_{\text{model}}$-dimensional queries, keys, and values, multi-head attention projects them into $h$ different subspaces and performs attention in parallel:

$$\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) W^O$$

where each head is:

$$\text{head}_i = \text{Attn}(Q W_i^Q, K W_i^K, V W_i^V)$$

with projection matrices $W_i^Q \in \mathbb{R}^{d_{\text{model}} \times d_k}$, $W_i^K \in \mathbb{R}^{d_{\text{model}} \times d_k}$, $W_i^V \in \mathbb{R}^{d_{\text{model}} \times d_v}$, $W^O \in \mathbb{R}^{hd_v \times d_{\text{model}}}$.

Typically $d_k = d_v = d_{\text{model}} / h$, so the total computational cost is similar to single-head attention with full dimensionality.

**Theorem 3.2 (Subspace Decomposition).** Multi-head attention decomposes the attention computation into $h$ independent subspace computations. Each head $i$ operates on a $d_k$-dimensional projection of the input, allowing different heads to attend to different aspects of the input.

*Proof sketch.* Let $X \in \mathbb{R}^{T \times d_{\text{model}}}$ be the input. Head $i$ computes attention on $X W_i^Q$, $X W_i^K$, $X W_i^V$. The column spaces of $W_i^Q$ and $W_i^K$ define the subspace in which similarity is measured for head $i$. If the projection matrices are initialized to be approximately orthogonal across heads (which happens naturally with standard random initialization when $d_k \ll d_{\text{model}}$), the heads operate on nearly orthogonal subspaces.

Formally, let $P_i = W_i^Q (W_i^K)^\top \in \mathbb{R}^{d_{\text{model}} \times d_{\text{model}}}$. The attention logits for head $i$ are $X P_i X^\top / \sqrt{d_k}$. The matrix $P_i$ defines the bilinear form used for scoring in head $i$. Multi-head attention uses $h$ such bilinear forms, each of rank at most $d_k$. The output projection $W^O$ then combines these $h$ low-rank views into a single $d_{\text{model}}$-dimensional representation.

In contrast, single-head attention uses one bilinear form $P = W^Q (W^K)^\top$ of rank at most $d_{\text{model}}$. Multi-head attention provides a more expressive parameterization because $\text{rank}\!\left(\sum_i P_i\right) \leq \sum_i \text{rank}(P_i) = h \cdot d_k = d_{\text{model}}$, but the attention *patterns* (the softmax outputs) can differ across heads, whereas single-head attention produces a single attention pattern. $\blacksquare$

**Remark.** This is the key insight: multi-head attention does not increase expressiveness in terms of which linear functions of $V$ can be represented (since $W^O$ can absorb any mixing), but it allows *different attention patterns* to be applied to different value subspaces simultaneously.

### 3.5 Gradient Derivation Through Attention

We now derive the full gradients through scaled dot-product attention. Let:

$$A = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) \in \mathbb{R}^{T_q \times T_k}$$

$$O = AV \in \mathbb{R}^{T_q \times d_v}$$

Suppose we are given $\frac{\partial \mathcal{L}}{\partial O} \in \mathbb{R}^{T_q \times d_v}$ from upstream.

**Step 1: Gradient w.r.t. $V$.**

Since $O = AV$ and $A$ does not depend on $V$:

$$\frac{\partial \mathcal{L}}{\partial V} = A^\top \frac{\partial \mathcal{L}}{\partial O} \in \mathbb{R}^{T_k \times d_v}$$

**Step 2: Gradient w.r.t. $A$.**

$$\frac{\partial \mathcal{L}}{\partial A} = \frac{\partial \mathcal{L}}{\partial O} V^\top \in \mathbb{R}^{T_q \times T_k}$$

**Step 3: Gradient through softmax.**

Let $S = \frac{QK^\top}{\sqrt{d_k}} \in \mathbb{R}^{T_q \times T_k}$ be the pre-softmax logits. For row $i$ of $A$:

$$A_{i,:} = \text{softmax}(S_{i,:})$$

The Jacobian of softmax for row $i$ is:

$$\frac{\partial A_{i,j}}{\partial S_{i,l}} = A_{i,j}(\delta_{jl} - A_{i,l})$$

Using the chain rule for each row:

$$\frac{\partial \mathcal{L}}{\partial S_{i,j}} = \sum_l \frac{\partial \mathcal{L}}{\partial A_{i,l}} \cdot A_{i,l}(\delta_{lj} - A_{i,j})$$

$$= A_{i,j} \frac{\partial \mathcal{L}}{\partial A_{i,j}} - A_{i,j} \sum_l A_{i,l} \frac{\partial \mathcal{L}}{\partial A_{i,l}}$$

$$= A_{i,j} \left(\frac{\partial \mathcal{L}}{\partial A_{i,j}} - \sum_l A_{i,l} \frac{\partial \mathcal{L}}{\partial A_{i,l}}\right)$$

In matrix notation, letting $G = \frac{\partial \mathcal{L}}{\partial A}$:

$$\frac{\partial \mathcal{L}}{\partial S} = A \odot \left(G - \text{rowsum}(A \odot G) \cdot \mathbf{1}^\top\right)$$

where $\text{rowsum}(M)_i = \sum_j M_{ij}$ produces a column vector, and $\mathbf{1}^\top$ broadcasts it.

**Step 4: Gradient w.r.t. $Q$ and $K$.**

Since $S = \frac{QK^\top}{\sqrt{d_k}}$:

$$\frac{\partial \mathcal{L}}{\partial Q} = \frac{1}{\sqrt{d_k}} \frac{\partial \mathcal{L}}{\partial S} K \in \mathbb{R}^{T_q \times d_k}$$

$$\frac{\partial \mathcal{L}}{\partial K} = \frac{1}{\sqrt{d_k}} \left(\frac{\partial \mathcal{L}}{\partial S}\right)^\top Q \in \mathbb{R}^{T_k \times d_k}$$

### 3.6 Attention as Kernel Smoothing

**Definition 3.7 (Nadaraya-Watson Estimator).** Given data points $\{(x_i, y_i)\}_{i=1}^{n}$ and a query point $x$, the Nadaraya-Watson kernel regression estimator is:

$$\hat{f}(x) = \frac{\sum_{i=1}^{n} K_h(x, x_i) \, y_i}{\sum_{j=1}^{n} K_h(x, x_j)}$$

where $K_h$ is a kernel function with bandwidth $h$.

**Proposition 3.2.** Scaled dot-product attention is a Nadaraya-Watson estimator with the softmax kernel.

*Proof.* Define the kernel $K(q, k) = \exp\!\left(\frac{q^\top k}{\sqrt{d_k}}\right)$. Then:

$$\text{Attn}(q, \{(k_i, v_i)\}) = \frac{\sum_i K(q, k_i) \, v_i}{\sum_j K(q, k_j)} = \frac{\sum_i \exp\!\left(\frac{q^\top k_i}{\sqrt{d_k}}\right) v_i}{\sum_j \exp\!\left(\frac{q^\top k_j}{\sqrt{d_k}}\right)}$$

which is exactly the Nadaraya-Watson form with $K_h(x, x_i) = K(q, k_i)$, $x = q$, $x_i = k_i$, $y_i = v_i$. $\blacksquare$

**Implications:**
- The "bandwidth" is controlled by $\sqrt{d_k}$ and the norms of $q, k$.
- Like kernel regression, attention is a weighted average of the values, where weights depend on query-key similarity.
- Unlike classical kernel regression, the keys and values are *learned*, not fixed data points. The model simultaneously learns the similarity function and the dictionary.
- Attention can be seen as an *adaptive* nonparametric method: the kernel shape adapts through learning of $W^Q$ and $W^K$.

**Proposition 3.3 (Attention as Normalized Kernel).** The softmax kernel is a *positive-definite* kernel on $\mathbb{R}^{d_k}$, since $\exp(q^\top k / \sqrt{d_k})$ is a positive-definite kernel (by the Schur product theorem applied to $\exp$ of the linear kernel). The normalization (dividing by the sum) makes it a *Markov kernel* (rows sum to 1).

### 3.7 Self-Attention vs Cross-Attention

**Definition 3.8 (Self-Attention).** When $Q$, $K$, $V$ are all derived from the same input $X$:

$$Q = XW^Q, \quad K = XW^K, \quad V = XW^V$$

Each position attends to every other position (including itself) in the same sequence. This allows the model to learn contextual representations where each token's representation depends on all other tokens.

**Definition 3.9 (Cross-Attention).** When queries come from one source and keys/values from another:

$$Q = X_{\text{dec}} W^Q, \quad K = X_{\text{enc}} W^K, \quad V = X_{\text{enc}} W^V$$

This allows the decoder to attend to encoder representations, implementing the classic "look back at the source" mechanism.

---

## 4. Algorithmic Derivation

### 4.1 Scaled Dot-Product Attention

```
Algorithm: ScaledDotProductAttention(Q, K, V, mask=None)
────────────────────────────────────────────────────────
Input:  Q ∈ ℝ^{T_q × d_k}    (queries)
        K ∈ ℝ^{T_k × d_k}    (keys)
        V ∈ ℝ^{T_k × d_v}    (values)
        mask ∈ {0,1}^{T_q × T_k}  (optional)
Output: O ∈ ℝ^{T_q × d_v}    (attention output)
        A ∈ ℝ^{T_q × T_k}    (attention weights)

1. S ← Q K^⊤ / √d_k                     // O(T_q · T_k · d_k)
2. if mask ≠ None:
3.     S ← S + (1 - mask) · (-∞)         // masked positions get -∞
4. A ← softmax(S, dim=-1)                // O(T_q · T_k), row-wise
5. O ← A V                               // O(T_q · T_k · d_v)
6. return O, A

Total complexity:  O(T_q · T_k · d_k + T_q · T_k · d_v)
                 = O(T_q · T_k · d)      where d = max(d_k, d_v)
Memory:            O(T_q · T_k)           for the attention matrix
```

For self-attention with $T_q = T_k = T$: **Time $O(T^2 d)$, Memory $O(T^2)$**.

### 4.2 Multi-Head Attention

```
Algorithm: MultiHeadAttention(Q, K, V, h)
──────────────────────────────────────────
Input:  Q ∈ ℝ^{T_q × d_model}
        K ∈ ℝ^{T_k × d_model}
        V ∈ ℝ^{T_k × d_model}
        h: number of heads
Output: O ∈ ℝ^{T_q × d_model}

1. d_k ← d_model / h;  d_v ← d_model / h
2. for i = 1 to h:                                      // parallelizable
3.     Q_i ← Q W_i^Q          // ℝ^{T_q × d_k}        O(T_q · d_model · d_k)
4.     K_i ← K W_i^K          // ℝ^{T_k × d_k}        O(T_k · d_model · d_k)
5.     V_i ← V W_i^V          // ℝ^{T_k × d_v}        O(T_k · d_model · d_v)
6.     head_i ← Attn(Q_i, K_i, V_i)                    O(T_q · T_k · d_k)
7. O ← Concat(head_1, ..., head_h) W^O                  O(T_q · h·d_v · d_model)
8. return O

Total complexity: O(T_q · d_model · d_k · h + T_q · T_k · d_k · h + ...)
                = O(T_q · d_model² + T_q · T_k · d_model)
```

The $O(T_q T_k d_{\text{model}})$ term from the attention computation dominates when $T_k > d_{\text{model}}$; the $O(T_q d_{\text{model}}^2)$ term from projections dominates when $T_k < d_{\text{model}}$.

---

## 5. PyTorch Implementation

### 5.1 Scaled Dot-Product Attention

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

def scaled_dot_product_attention(
    Q: torch.Tensor,   # (B, T_q, d_k)
    K: torch.Tensor,   # (B, T_k, d_k)
    V: torch.Tensor,   # (B, T_k, d_v)
    mask: torch.Tensor = None,  # (B, T_q, T_k) or (1, T_q, T_k)
    dropout_p: float = 0.0,
    training: bool = True,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Scaled dot-product attention.

    Returns:
        output: (B, T_q, d_v)
        attn_weights: (B, T_q, T_k)
    """
    d_k = Q.size(-1)

    # Compute attention scores: (B, T_q, d_k) @ (B, d_k, T_k) -> (B, T_q, T_k)
    scores = torch.bmm(Q, K.transpose(-2, -1)) / math.sqrt(d_k)

    # Apply mask (e.g., causal mask or padding mask)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float('-inf'))

    # Softmax over keys: (B, T_q, T_k)
    attn_weights = F.softmax(scores, dim=-1)

    # Optional dropout on attention weights
    if dropout_p > 0.0 and training:
        attn_weights = F.dropout(attn_weights, p=dropout_p, training=training)

    # Weighted sum of values: (B, T_q, T_k) @ (B, T_k, d_v) -> (B, T_q, d_v)
    output = torch.bmm(attn_weights, V)

    return output, attn_weights
```

### 5.2 Multi-Head Attention

```python
class MultiHeadAttention(nn.Module):
    """
    Multi-Head Attention as described in Vaswani et al. (2017).

    Parameters:
        d_model: total model dimension
        n_heads: number of attention heads
        dropout: dropout rate on attention weights
    """
    def __init__(self, d_model: int, n_heads: int, dropout: float = 0.0):
        super().__init__()
        assert d_model % n_heads == 0, "d_model must be divisible by n_heads"

        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads  # dimension per head

        # Projection matrices: we fuse all heads into single matrices for efficiency
        self.W_Q = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)
        self.W_K = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)
        self.W_V = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)
        self.W_O = nn.Linear(d_model, d_model, bias=False)  # (d_model, d_model)

        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        Q: torch.Tensor,    # (B, T_q, d_model)
        K: torch.Tensor,    # (B, T_k, d_model)
        V: torch.Tensor,    # (B, T_k, d_model)
        mask: torch.Tensor = None,  # (B, 1, T_q, T_k) or broadcastable
    ) -> torch.Tensor:      # (B, T_q, d_model)
        B, T_q, _ = Q.shape
        T_k = K.size(1)

        # 1. Linear projections: (B, T, d_model) -> (B, T, d_model)
        Q = self.W_Q(Q)  # (B, T_q, d_model)
        K = self.W_K(K)  # (B, T_k, d_model)
        V = self.W_V(V)  # (B, T_k, d_model)

        # 2. Reshape to (B, n_heads, T, d_k) for parallel head computation
        Q = Q.view(B, T_q, self.n_heads, self.d_k).transpose(1, 2)  # (B, h, T_q, d_k)
        K = K.view(B, T_k, self.n_heads, self.d_k).transpose(1, 2)  # (B, h, T_k, d_k)
        V = V.view(B, T_k, self.n_heads, self.d_k).transpose(1, 2)  # (B, h, T_k, d_k)

        # 3. Scaled dot-product attention for all heads in parallel
        # scores: (B, h, T_q, d_k) @ (B, h, d_k, T_k) -> (B, h, T_q, T_k)
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(self.d_k)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn_weights = F.softmax(scores, dim=-1)  # (B, h, T_q, T_k)
        attn_weights = self.dropout(attn_weights)

        # (B, h, T_q, T_k) @ (B, h, T_k, d_k) -> (B, h, T_q, d_k)
        context = torch.matmul(attn_weights, V)

        # 4. Concatenate heads: (B, h, T_q, d_k) -> (B, T_q, h * d_k) = (B, T_q, d_model)
        context = context.transpose(1, 2).contiguous().view(B, T_q, self.d_model)

        # 5. Final linear projection: (B, T_q, d_model) -> (B, T_q, d_model)
        output = self.W_O(context)

        return output
```

### 5.3 Bahdanau (Additive) Attention

```python
class BahdanauAttention(nn.Module):
    """
    Additive attention mechanism (Bahdanau et al., 2015).
    """
    def __init__(self, query_dim: int, key_dim: int, hidden_dim: int):
        super().__init__()
        self.W_q = nn.Linear(query_dim, hidden_dim, bias=False)
        self.W_k = nn.Linear(key_dim, hidden_dim, bias=False)
        self.w = nn.Linear(hidden_dim, 1, bias=False)

    def forward(
        self,
        query: torch.Tensor,   # (B, 1, query_dim) -- single decoder step
        keys: torch.Tensor,    # (B, T_k, key_dim)
        values: torch.Tensor,  # (B, T_k, value_dim)
    ) -> tuple[torch.Tensor, torch.Tensor]:
        # (B, 1, hidden) + (B, T_k, hidden) -> (B, T_k, hidden) via broadcasting
        energy = torch.tanh(self.W_q(query) + self.W_k(keys))

        # (B, T_k, hidden) -> (B, T_k, 1) -> (B, T_k)
        scores = self.w(energy).squeeze(-1)

        # (B, T_k)
        attn_weights = F.softmax(scores, dim=-1)

        # (B, 1, T_k) @ (B, T_k, value_dim) -> (B, 1, value_dim)
        context = torch.bmm(attn_weights.unsqueeze(1), values)

        return context, attn_weights
```

### 5.4 Verification

```python
def verify_attention():
    """Verify shapes and basic properties of attention implementations."""
    torch.manual_seed(42)
    B, T_q, T_k, d_model, n_heads = 2, 5, 8, 64, 4

    # --- Scaled dot-product attention ---
    Q = torch.randn(B, T_q, d_model // n_heads)
    K = torch.randn(B, T_k, d_model // n_heads)
    V = torch.randn(B, T_k, d_model // n_heads)

    out, weights = scaled_dot_product_attention(Q, K, V)
    assert out.shape == (B, T_q, d_model // n_heads), f"Got {out.shape}"
    assert weights.shape == (B, T_q, T_k), f"Got {weights.shape}"
    assert torch.allclose(weights.sum(-1), torch.ones(B, T_q), atol=1e-5), \
        "Attention weights must sum to 1"

    # --- Multi-head attention ---
    mha = MultiHeadAttention(d_model, n_heads)
    Q_full = torch.randn(B, T_q, d_model)
    K_full = torch.randn(B, T_k, d_model)
    V_full = torch.randn(B, T_k, d_model)

    out_mha = mha(Q_full, K_full, V_full)
    assert out_mha.shape == (B, T_q, d_model), f"Got {out_mha.shape}"

    # --- Causal mask ---
    causal_mask = torch.tril(torch.ones(T_q, T_q)).unsqueeze(0).unsqueeze(0)
    out_causal = mha(Q_full[:, :T_q], K_full[:, :T_q], V_full[:, :T_q], mask=causal_mask)
    assert out_causal.shape == (B, T_q, d_model)

    print("All attention tests passed!")

verify_attention()
```

---

## 6. Experimental Intuition

### 6.1 What Attention Heads Learn

Empirical studies (Clark et al., 2019; Voita et al., 2019) have shown that different heads in trained Transformers specialize:

- **Positional heads**: Attend to the previous or next token (local context).
- **Syntactic heads**: Attend to syntactically related tokens (e.g., subject-verb agreement).
- **Rare token heads**: Attend to specific rare or informative tokens.
- **Delimiter heads**: Attend to separator tokens like [SEP] or period.

Many heads are *redundant* --- pruning 30-50% of heads often causes negligible performance loss (Voita et al., 2019; Michel et al., 2019).

### 6.2 Attention Entropy and Temperature

The entropy of the attention distribution for query $i$:

$$H(\alpha_i) = -\sum_j \alpha_{i,j} \log \alpha_{i,j}$$

- **Low entropy** (peaked distribution): The query attends to few keys. The attention acts like a hard lookup.
- **High entropy** (uniform distribution): The query attends broadly. The attention acts like a bag-of-words average.

The scaling factor $1/\sqrt{d_k}$ implicitly controls this entropy. Empirically, one can add a learnable temperature $\tau$:

$$A = \text{softmax}\!\left(\frac{QK^\top}{\tau}\right)$$

Lower $\tau$ sharpens attention; higher $\tau$ smooths it.

### 6.3 Failure Modes

1. **Attention collapse**: All queries attend to the same key (often a special token like [CLS] or [BOS]). Mitigation: attention dropout, auxiliary losses encouraging diversity.
2. **Rank collapse**: Attention output converges to rank-1 matrix (all positions produce similar representations). Related to over-smoothing in deep networks. Mitigation: residual connections, proper initialization.
3. **Length generalization failure**: Models trained on sequences of length $T$ fail on $T' \gg T$. The attention distribution spreads across more keys, reducing the signal per key. Mitigation: length-aware positional encodings (RoPE, ALiBi).

### 6.4 Ablation: Number of Heads

Vaswani et al. (2017) found that $h = 8$ heads worked well for $d_{\text{model}} = 512$. Key observations:

| Heads $h$ | $d_k = d_{\text{model}}/h$ | BLEU (WMT En-De) | Notes |
|:---------:|:-----------:|:--------:|:------|
| 1         | 512         | 24.9     | Single head, full dimension |
| 4         | 128         | 25.5     | |
| 8         | 64          | 25.8     | Original Transformer |
| 16        | 32          | 25.6     | Slight degradation |
| 32        | 16          | 25.0     | Each head too low-dimensional |

There is a sweet spot: too few heads limits the diversity of attention patterns; too many heads reduces each head's dimensionality below the minimum needed to compute meaningful similarity.

---

## 7. Connections and Extensions

### 7.1 Connection to Memory Networks

Attention can be viewed as a form of *soft content-based addressing* in memory networks (Weston et al., 2015; Sukhbaatar et al., 2015). The keys form an address space, the values form a memory, and the query retrieves from memory via soft addressing.

### 7.2 Connection to Hopfield Networks

**Ramsauer et al. (2021)** showed that the attention mechanism corresponds to the update rule of a *modern continuous Hopfield network*. The stored patterns are the keys, and the query is the state being updated. The softmax attention computes the Hopfield update with an exponential energy function, providing exponential storage capacity ($\sim d_k^{d_k}$ patterns).

### 7.3 Attention and Equivariance

**Proposition 3.4.** Self-attention is *permutation equivariant*: for any permutation matrix $\Pi$,

$$\text{Attn}(\Pi X) = \Pi \, \text{Attn}(X)$$

*Proof.* Let $Q = \Pi X W^Q$, $K = \Pi X W^K$, $V = \Pi X W^V$. Then:

$$QK^\top = \Pi X W^Q (W^K)^\top X^\top \Pi^\top = \Pi (X W^Q (W^K)^\top X^\top) \Pi^\top$$

Since softmax is applied row-wise and $\Pi$ just permutes rows and columns:

$$\text{softmax}(\Pi M \Pi^\top) = \Pi \, \text{softmax}(M) \, \Pi^\top$$

Therefore $AV = \Pi \, \text{softmax}(M) \, \Pi^\top \, \Pi X W^V = \Pi \, \text{softmax}(M) \, X W^V$, which is $\Pi$ times the original output. $\blacksquare$

This means self-attention treats its input as a *set*, not a sequence. Positional information must be injected externally (see Lecture 04c).

### 7.4 Linear Attention and Kernel Feature Maps

Replace the softmax kernel $K(q,k) = \exp(q^\top k / \sqrt{d_k})$ with a factored kernel $K(q,k) = \phi(q)^\top \phi(k)$ for some feature map $\phi$. Then:

$$\text{Attn}(q) = \frac{\sum_i \phi(q)^\top \phi(k_i) v_i^\top}{\sum_i \phi(q)^\top \phi(k_i)} = \frac{\phi(q)^\top \sum_i \phi(k_i) v_i^\top}{\phi(q)^\top \sum_i \phi(k_i)}$$

The sums $\sum_i \phi(k_i) v_i^\top$ and $\sum_i \phi(k_i)$ can be precomputed once, giving $O(T)$ attention instead of $O(T^2)$. This is the basis of linear attention (see Lecture 04d).

---

## 8. Seminal Paper Reading List

1. **Bahdanau, D., Cho, K., & Bengio, Y.** (2015). *Neural Machine Translation by Jointly Learning to Align and Translate.* ICLR 2015.
   - Introduced additive attention for seq2seq models. The paper that started it all.

2. **Luong, M.-T., Pham, H., & Manning, C. D.** (2015). *Effective Approaches to Attention-based Neural Machine Translation.* EMNLP 2015.
   - Simpler multiplicative attention variants; local vs global attention.

3. **Vaswani, A., et al.** (2017). *Attention Is All You Need.* NeurIPS 2017.
   - The Transformer: scaled dot-product attention, multi-head attention, no recurrence.

4. **Clark, K., Khandelwal, U., Levy, O., & Manning, C. D.** (2019). *What Does BERT Look At? An Analysis of BERT's Attention.* BlackboxNLP 2019.
   - Empirical analysis of what attention heads learn.

5. **Ramsauer, H., et al.** (2021). *Hopfield Networks is All You Need.* ICLR 2021.
   - Connection between attention and modern Hopfield networks.

6. **Tsai, Y.-H. H., et al.** (2019). *Transformer Dissection: An Unified Understanding for Transformer's Attention via the Lens of Kernel.* EMNLP 2019.
   - Kernel interpretation of attention.

---

## 9. Exercises

### Theory Exercises

**Exercise 4a.1.** Let $q, k \in \mathbb{R}^{d_k}$ with i.i.d. components from $\mathcal{N}(0, \sigma^2)$. Show that $\text{Var}(q^\top k) = d_k \sigma^4$. What scaling factor would you use instead of $1/\sqrt{d_k}$ if $\sigma \neq 1$?

**Exercise 4a.2.** Prove that for any attention mechanism where weights $\alpha_i \geq 0$ and $\sum_i \alpha_i = 1$, the output lies in the convex hull of the values: $\text{Attn}(q) \in \text{conv}(\{v_1, \ldots, v_n\})$.

**Exercise 4a.3.** Derive the full Jacobian $\frac{\partial \text{Attn}(Q,K,V)}{\partial Q}$ (as a 4th-order tensor) for the single-head case with $T_q = T_k = T$. Show that its Frobenius norm is bounded by $\|V\| / \sqrt{d_k}$.

**Exercise 4a.4.** Show that multi-head attention with $h$ heads and head dimension $d_k = d_{\text{model}}/h$ has the same number of parameters as single-head attention with dimension $d_{\text{model}}$, but can represent a strictly larger set of attention patterns.

**Exercise 4a.5.** Prove that attention is *not* permutation invariant (it is equivariant). Give a concrete counterexample showing $\text{Attn}(\Pi X) \neq \text{Attn}(X)$ for some permutation $\Pi$ and input $X$.

### Implementation Exercises

**Exercise 4a.6.** Implement additive, multiplicative, and scaled dot-product attention. On a synthetic sequence copying task, compare convergence speed and final accuracy.

**Exercise 4a.7.** Visualize attention patterns for a 4-head attention module after training on a simple sequence task. Show that different heads learn different patterns.

**Exercise 4a.8.** Implement the gradient of attention from scratch (without autograd). Verify against `torch.autograd.grad` on random inputs. Measure the wall-clock time difference between your implementation and the autograd version.

**Exercise 4a.9.** Empirically verify Theorem 3.1: generate random $q, k$ for $d_k \in \{16, 64, 256, 1024\}$, compute $q^\top k$ many times, and plot the variance versus $d_k$. Repeat with and without $1/\sqrt{d_k}$ scaling and show the effect on softmax entropy.
