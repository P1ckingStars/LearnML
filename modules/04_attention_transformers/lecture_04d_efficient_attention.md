# Lecture 04d: Efficient Attention Mechanisms

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Analyze** the $O(T^2 d)$ time and $O(T^2)$ memory complexity of standard self-attention and identify which applications hit this bottleneck.
2. **Describe** sparse attention patterns (local, strided, combined) and prove that they reduce complexity to $O(T\sqrt{T})$ or $O(T \log T)$ while maintaining theoretical expressiveness.
3. **Derive** linear attention via kernel feature maps, proving that the attention computation can be reformulated from $O(T^2 d)$ to $O(T d^2)$, and explain the limitations.
4. **Explain** FlashAttention's IO-aware tiling algorithm, the online softmax trick, and derive its memory reduction from $O(T^2)$ to $O(T)$.
5. **Define** multi-query attention (MQA) and grouped-query attention (GQA), derive their parameter and FLOPs savings, and explain the tradeoff with quality.
6. **Derive** KV cache memory requirements for autoregressive generation and explain paged attention.

---

## 2. Motivation and Context

### 2.1 The Quadratic Bottleneck

Standard self-attention computes a $T \times T$ attention matrix, requiring $O(T^2 d)$ FLOPs and $O(T^2)$ memory. For a Transformer with $d_{\text{model}} = 4096$ and sequence length $T$:

| $T$ | Attention matrix size | Memory (FP16) | FLOPs (per layer) |
|:---:|:---------------------:|:-------------:|:------------------:|
| 512 | $512^2 = 262$K | 0.5 MB | $\sim 10^9$ |
| 2048 | $2048^2 = 4.2$M | 8 MB | $\sim 10^{10}$ |
| 8192 | $8192^2 = 67$M | 128 MB | $\sim 10^{11}$ |
| 32768 | $32768^2 = 1.1$B | 2 GB | $\sim 10^{12}$ |
| 131072 | $131072^2 = 17$B | 32 GB | $\sim 10^{13}$ |

For long documents, code repositories, multi-turn conversations, or genomics sequences ($T > 100$K), the quadratic cost is prohibitive. This has driven extensive research into efficient attention.

### 2.2 Two Approaches: Algorithmic vs Hardware-Aware

1. **Algorithmic**: Reduce the asymptotic complexity by modifying the attention pattern (sparse attention) or the computation (linear attention). Trades off expressiveness for speed.
2. **Hardware-aware**: Keep the same computation but optimize the implementation to exploit GPU memory hierarchy (FlashAttention). No approximation, exact attention.

Modern practice often combines both: FlashAttention for exact computation at moderate lengths, plus architectural changes (GQA, KV cache optimization) for inference efficiency.

### 2.3 Historical Arc

- **2019**: Sparse Transformer (Child et al.) --- first systematic approach to sparse attention.
- **2020**: Longformer (Beltagy et al.), BigBird (Zaheer et al.) --- combining local and global attention.
- **2020**: Performers (Choromanski et al.), Linear Transformers (Katharopoulos et al.) --- kernel-based linear attention.
- **2022**: FlashAttention (Dao et al.) --- IO-aware exact attention.
- **2023**: FlashAttention-2 (Dao, 2023) --- improved parallelism.
- **2023**: Multi-query and grouped-query attention (Ainslie et al.) --- KV cache efficiency.
- **2024**: FlashAttention-3 (Shah et al.) --- Hopper GPU optimizations.

---

## 3. Core Theory

### 3.1 Complexity Analysis of Standard Attention

**Proposition 3.1.** For self-attention with $Q, K, V \in \mathbb{R}^{T \times d}$:

- **Step 1**: $S = QK^\top/\sqrt{d}$: matrix multiply $\mathbb{R}^{T \times d} \times \mathbb{R}^{d \times T} \to \mathbb{R}^{T \times T}$. FLOPs: $2T^2 d$.
- **Step 2**: $A = \text{softmax}(S)$: element-wise exp + row sum + division. FLOPs: $O(T^2)$.
- **Step 3**: $O = AV$: matrix multiply $\mathbb{R}^{T \times T} \times \mathbb{R}^{T \times d} \to \mathbb{R}^{T \times d}$. FLOPs: $2T^2 d$.
- **Total FLOPs**: $4T^2 d + O(T^2) = O(T^2 d)$.
- **Memory for $S$ and $A$**: $2T^2$ floats $= O(T^2)$.

For multi-head attention with $h$ heads and $d_k = d/h$: total FLOPs $= h \cdot 4T^2 d_k = 4T^2 d = O(T^2 d)$ (same).

**For comparison, the FFN**: $W_1 \in \mathbb{R}^{d \times 4d}$, $W_2 \in \mathbb{R}^{4d \times d}$. FLOPs: $2 \times T \times d \times 4d = 8Td^2 = O(Td^2)$.

The attention dominates when $T > 2d$ (i.e., $T > 2 \times d_{\text{model}}$). For a typical LLM with $d = 4096$, this threshold is $T \approx 8192$.

### 3.2 Sparse Attention

The key observation: in many tasks, attention weights are sparse --- most entries are near zero. We can impose sparsity *a priori* by defining a connectivity pattern $\mathcal{P} \subseteq [T] \times [T]$ and only computing attention for pairs $(i, j) \in \mathcal{P}$:

$$\alpha_{ij} = \begin{cases} \frac{\exp(q_i^\top k_j / \sqrt{d})}{\sum_{l:(i,l) \in \mathcal{P}} \exp(q_i^\top k_l / \sqrt{d})} & \text{if } (i,j) \in \mathcal{P} \\ 0 & \text{otherwise} \end{cases}$$

**Definition 3.1 (Local/Sliding Window Attention).** Each position attends to the $w$ nearest positions:

$$\mathcal{P}_{\text{local}} = \{(i, j) : |i - j| \leq w/2\}$$

Complexity: $O(Tw)$ per layer. If $w = O(\sqrt{T})$, this is $O(T\sqrt{T})$.

**Definition 3.2 (Strided/Dilated Attention).** (Child et al., 2019) Each position attends to every $s$-th position:

$$\mathcal{P}_{\text{strided}} = \{(i, j) : (i - j) \equiv 0 \pmod{s}\}$$

Complexity: $O(T \cdot T/s)$. With $s = \sqrt{T}$: $O(T\sqrt{T})$.

**Definition 3.3 (Combined Sparse Attention).** (Sparse Transformer, Child et al., 2019) Alternate between local and strided attention across layers. With local window $w = \sqrt{T}$ and stride $s = \sqrt{T}$:

**Theorem 3.1 (Sparse Transformer Reachability).** With alternating local ($w = \sqrt{T}$) and strided ($s = \sqrt{T}$) attention, any position can attend to any other position in at most 2 layers.

*Proof.* Position $i$ wants to attend to position $j$, with $|i - j|$ possibly $\Theta(T)$.

Layer 1 (strided, stride $s$): Position $i$ can attend to positions $\{i, i \pm s, i \pm 2s, \ldots\}$. Among these, the closest to $j$ is some position $j'$ with $|j' - j| \leq s/2 = \sqrt{T}/2$.

Layer 2 (local, window $w$): Position $j'$ can attend to all positions within $w/2 = \sqrt{T}/2$ of itself, which includes $j$.

Therefore, information flows from $j$ to $j'$ (layer 2) and from $j'$ to $i$ (layer 1) in 2 layers. $\blacksquare$

**Definition 3.4 (Longformer Attention).** (Beltagy et al., 2020) Combines:
1. **Local attention**: Sliding window of size $w$ for all tokens.
2. **Global attention**: Selected tokens (e.g., [CLS], task-specific tokens) attend to and are attended by all other tokens.

Complexity: $O(Tw + T \cdot g)$ where $g$ is the number of global tokens.

**Definition 3.5 (BigBird Attention).** (Zaheer et al., 2020) Combines:
1. Local attention (window $w$).
2. Global attention ($g$ random or designated tokens).
3. Random attention ($r$ random connections per token).

**Theorem 3.2 (BigBird Universal Approximation).** BigBird with $g \geq 1$ global token, local window $w$, and $r$ random connections per position is a universal approximator of sequence-to-sequence functions.

### 3.3 Linear Attention

**Motivation.** Standard attention computes:

$$\text{Attn}(q_i) = \frac{\sum_{j=1}^{T} \exp(q_i^\top k_j / \sqrt{d}) \, v_j}{\sum_{j=1}^{T} \exp(q_i^\top k_j / \sqrt{d})}$$

The bottleneck is the pairwise $q_i^\top k_j$ computation across all $T^2$ pairs. Can we factorize this?

**Definition 3.6 (Linear Attention).** (Katharopoulos et al., 2020) Replace the softmax kernel $\kappa(q, k) = \exp(q^\top k / \sqrt{d})$ with a factored kernel:

$$\kappa(q, k) = \phi(q)^\top \phi(k)$$

where $\phi: \mathbb{R}^d \to \mathbb{R}^m$ is a feature map. Then:

$$\text{Attn}(q_i) = \frac{\phi(q_i)^\top \sum_{j=1}^{T} \phi(k_j) v_j^\top}{\phi(q_i)^\top \sum_{j=1}^{T} \phi(k_j)} = \frac{\phi(q_i)^\top \mathbf{S}}{\phi(q_i)^\top \mathbf{z}}$$

where $\mathbf{S} = \sum_{j=1}^{T} \phi(k_j) v_j^\top \in \mathbb{R}^{m \times d}$ and $\mathbf{z} = \sum_{j=1}^{T} \phi(k_j) \in \mathbb{R}^m$.

**Theorem 3.3 (Linear Attention Complexity).** Computing $\mathbf{S}$ and $\mathbf{z}$ takes $O(Tmd)$ and $O(Tm)$ respectively. Computing $\text{Attn}(q_i)$ for all $i$ then takes $O(Tmd)$.

Total: $O(Tmd)$. If $m = O(d)$, this is $O(Td^2)$, which is linear in $T$.

*Proof.* Step 1: Compute $\phi(k_j)$ for all $j$: $O(Tm)$ (assuming $\phi$ is $O(m)$ per call). Step 2: Compute $\mathbf{S} = \sum_j \phi(k_j) v_j^\top$: each outer product is $O(md)$, summed over $T$ positions: $O(Tmd)$. Step 3: For each query $i$: $\phi(q_i)^\top \mathbf{S}$ is $O(md)$ (vector-matrix product). Over all $T$ queries: $O(Tmd)$. Total: $O(Tmd)$. $\blacksquare$

**Common feature maps:**
- $\phi(x) = \text{elu}(x) + 1$ (Katharopoulos et al., 2020): simple, no additional dimension.
- Random Fourier Features (Performers, Choromanski et al., 2021): $\phi(x) = \frac{1}{\sqrt{m}} [\sin(\omega_1^\top x), \cos(\omega_1^\top x), \ldots]$ where $\omega_i$ are random.

**Theorem 3.4 (Limitations of Linear Attention).** Linear attention cannot compute hard attention (i.e., concentrate all weight on a single key).

*Proof.* In linear attention, $\alpha_{ij} = \frac{\phi(q_i)^\top \phi(k_j)}{\sum_l \phi(q_i)^\top \phi(k_l)}$. For hard attention at position $j^*$, we need $\alpha_{ij^*} = 1$ and $\alpha_{ij} = 0$ for $j \neq j^*$.

This requires $\phi(q_i)^\top \phi(k_j) = 0$ for all $j \neq j^*$, meaning $\phi(q_i) \perp \phi(k_j)$ for all $j \neq j^*$. If $\phi: \mathbb{R}^d \to \mathbb{R}^m$, this can be satisfied for at most $m - 1$ non-target keys. When $T > m$ (common since $T \gg d$), it is impossible to concentrate attention on a single key for all queries simultaneously.

More formally, the attention matrix of linear attention has rank at most $m$ (since $A_{ij} \propto \phi(q_i)^\top \phi(k_j)$, and the matrix $\Phi_Q \Phi_K^\top$ has rank $\leq m$). Hard attention requires a rank-$T$ attention matrix (a permutation matrix), which requires $m \geq T$, negating the efficiency gain. $\blacksquare$

### 3.4 FlashAttention

FlashAttention (Dao et al., 2022) computes **exact** standard attention but with an IO-aware algorithm that minimizes reads/writes to GPU high-bandwidth memory (HBM).

**Background: GPU Memory Hierarchy.**

```
┌─────────────────────────────────┐
│           HBM (DRAM)            │  Capacity: 40-80 GB
│         Bandwidth: ~2 TB/s      │  (e.g., A100: 80GB, 2 TB/s)
└───────────────┬─────────────────┘
                │  slow
┌───────────────▼─────────────────┐
│           SRAM (on-chip)        │  Capacity: ~20 MB
│         Bandwidth: ~19 TB/s     │  (shared across SMs)
└─────────────────────────────────┘
```

Standard attention materializes the $T \times T$ attention matrix in HBM, requiring $O(T^2)$ memory reads and writes. FlashAttention avoids materializing this matrix by using **tiling** and the **online softmax** trick.

**Theorem 3.5 (Online Softmax).** (Milakov & Gimelshein, 2018) The softmax $\text{softmax}(x) = \frac{\exp(x)}{\sum_j \exp(x_j)}$ can be computed in a single pass with running statistics.

Given a sequence $x_1, x_2, \ldots, x_n$ arriving in blocks:

*Proof / Algorithm.* We maintain running max $m$ and running denominator $d$:

Initialize: $m^{(0)} = -\infty$, $d^{(0)} = 0$, $\ell^{(0)} = 0$.

For each new block $B_k = \{x_{j} : j \in \text{block } k\}$:

$$m^{(k)} = \max(m^{(k-1)}, \max_{j \in B_k} x_j)$$

$$d^{(k)} = d^{(k-1)} \cdot \exp(m^{(k-1)} - m^{(k)}) + \sum_{j \in B_k} \exp(x_j - m^{(k)})$$

The rescaling factor $\exp(m^{(k-1)} - m^{(k)})$ corrects the previously accumulated denominator for the new maximum.

For the output $o = \text{softmax}(S) \cdot V$, we similarly maintain a running weighted sum:

$$o^{(k)} = o^{(k-1)} \cdot \frac{d^{(k-1)}}{d^{(k)}} \cdot \exp(m^{(k-1)} - m^{(k)}) + \frac{1}{d^{(k)}} \sum_{j \in B_k} \exp(x_j - m^{(k)}) v_j$$

This allows computing $\text{softmax}(S) V$ without ever materializing the full $T \times T$ matrix. $\blacksquare$

**FlashAttention Algorithm (Simplified):**

```
Algorithm: FlashAttention(Q, K, V)
──────────────────────────────────
Input:  Q ∈ ℝ^{T × d}, K ∈ ℝ^{T × d}, V ∈ ℝ^{T × d}
        Block sizes B_q, B_k (chosen to fit in SRAM)
Output: O ∈ ℝ^{T × d}

1. Initialize O ← 0^{T × d}, m ← -∞^T, ℓ ← 0^T
2. Divide Q into T/B_q blocks: Q_1, ..., Q_{T/B_q}     (each B_q × d)
3. Divide K, V into T/B_k blocks: K_1, ..., K_{T/B_k}   (each B_k × d)

4. for i = 1 to T/B_q:                    // outer loop over query blocks
5.     Load Q_i from HBM to SRAM           // B_q × d
6.     for j = 1 to T/B_k:                // inner loop over KV blocks
7.         Load K_j, V_j from HBM to SRAM  // 2 × B_k × d
8.
9.         // Compute local attention: B_q × B_k block
10.        S_ij ← Q_i K_j^⊤ / √d          // B_q × B_k, in SRAM
11.
12.        // Online softmax update
13.        m_new ← max(m_i, rowmax(S_ij))
14.        P_ij ← exp(S_ij - m_new)        // B_q × B_k
15.        ℓ_new ← ℓ_i · exp(m_i - m_new) + rowsum(P_ij)
16.
17.        // Update output with rescaling
18.        O_i ← O_i · (ℓ_i · exp(m_i - m_new) / ℓ_new) + P_ij V_j / ℓ_new
19.
20.        m_i ← m_new; ℓ_i ← ℓ_new
21.
22.    Write O_i to HBM                    // B_q × d

23. return O
```

**Theorem 3.6 (FlashAttention Memory and IO Complexity).**

- **Memory**: $O(T)$ --- only the output $O$, running statistics $m, \ell$ (both $\in \mathbb{R}^T$), and the SRAM buffers (constant w.r.t. $T$).
- **HBM reads**: $O(T^2 d^2 / M)$ where $M$ is SRAM size. Each query block reads all KV blocks from HBM once.
- **FLOPs**: Same as standard attention: $O(T^2 d)$ (exact computation).

*Proof (Memory).* The algorithm stores $Q, K, V, O$ (each $T \times d$) in HBM. The attention matrix $S$ is never fully materialized; only $B_q \times B_k$ blocks are computed in SRAM and immediately consumed. The running statistics $m, \ell$ are $O(T)$. Total extra memory beyond $Q, K, V$: $O(T d + T) = O(Td)$.

Standard attention requires $O(T^2)$ for the attention matrix. FlashAttention saves $O(T^2 - Td) = O(T^2)$ memory when $T \gg d$. $\blacksquare$

### 3.5 Multi-Query and Grouped-Query Attention

**Definition 3.7 (Multi-Query Attention, MQA).** (Shazeer, 2019) Use $h$ separate query heads but only **one** shared key head and one shared value head:

$$Q_i = X W_i^Q \quad (i = 1, \ldots, h), \qquad K = X W^K, \qquad V = X W^V$$

Each query head $i$ attends using the same $K, V$.

**Parameter savings**: Standard MHA has $h(d_k + d_k + d_v)d$ parameters for $Q, K, V$ projections. MQA has $hd_k \cdot d + d_k \cdot d + d_v \cdot d = (hd_k + d_k + d_v)d$. Savings: $(h-1)(d_k + d_v)d$.

**KV cache savings**: During inference, the KV cache stores $K, V$ for all past tokens. With MHA, this is $2 \times h \times T \times d_k$ per layer. With MQA, it is $2 \times 1 \times T \times d_k$ per layer --- a factor of $h$ reduction.

**Definition 3.8 (Grouped-Query Attention, GQA).** (Ainslie et al., 2023) A middle ground: use $g$ groups, each sharing one key and one value head, with $h/g$ query heads per group.

| Method | Key-Value heads | KV cache size per layer | Quality |
|:-------|:---------:|:---:|:---:|
| MHA | $h$ | $2hTd_k$ | Best |
| GQA ($g$ groups) | $g$ | $2gTd_k$ | Near-MHA |
| MQA ($g=1$) | $1$ | $2Td_k$ | Slight degradation |

LLaMA 2 (70B) uses GQA with $g = 8$ and $h = 64$ (8 KV heads, 64 query heads). This provides a $8\times$ KV cache reduction vs MHA.

### 3.6 KV Cache Analysis

**Definition 3.9 (KV Cache).** During autoregressive generation, each new token's attention at layer $l$ computes:

$$\text{Attn}(q_t, [k_1, \ldots, k_t], [v_1, \ldots, v_t])$$

Rather than recomputing all past keys and values, we cache them. At step $t$, the cache contains:

$$\text{KV}_l = \{(k_s^{(l)}, v_s^{(l)})\}_{s=1}^{t-1} \quad \text{for each layer } l$$

**Theorem 3.7 (KV Cache Memory).** For a Transformer with $N$ layers, $h$ attention heads, head dimension $d_k$, sequence length $T$, and batch size $B$, the KV cache requires:

$$\text{Memory}_{\text{KV}} = 2 \times N \times h \times T \times d_k \times B \times \text{bytes\_per\_element}$$

*Example*: LLaMA-2 70B ($N = 80$, $h = 64$, $d_k = 128$, with GQA $g = 8$ so effective $h_{\text{kv}} = 8$):

$$\text{Memory}_{\text{KV}} = 2 \times 80 \times 8 \times T \times 128 \times B \times 2 \text{ bytes (FP16)}$$

$$= 2 \times 80 \times 8 \times 128 \times 2 \times B \times T \text{ bytes} = 327,680 \times B \times T \text{ bytes}$$

For $B = 1$, $T = 4096$: $\approx 1.3$ GB. For $B = 32$, $T = 4096$: $\approx 42$ GB.

**Proposition 3.2 (Inference FLOPs with KV Cache).** Generating one token at step $t$ requires:
- Projecting the new token to $Q, K, V$: $O(d^2)$ per layer.
- Attention: $O(t \cdot d)$ per layer (dot product of new query with $t$ cached keys).
- FFN: $O(d \cdot d_{\text{ff}})$ per layer.

Total per-token: $O(N(d^2 + td))$. The attention term grows linearly with $t$.

Without KV cache, each step would recompute all $t$ tokens: $O(Nt^2d)$ per step, $O(NT^3d)$ total for $T$ tokens. With KV cache: $O(N \sum_{t=1}^{T} (d^2 + td)) = O(N(Td^2 + T^2 d))$ total --- a factor of $T$ savings.

### 3.7 Paged Attention

**Definition 3.10 (Paged Attention).** (Kwon et al., 2023, vLLM) Inspired by virtual memory in operating systems, paged attention divides the KV cache into fixed-size "pages" (blocks of $B_{\text{page}}$ tokens). A page table maps logical positions to physical memory blocks.

**Problem solved**: In naive KV cache, we must pre-allocate memory for the maximum possible sequence length for each request. This wastes memory when sequences are shorter than the max, and prevents dynamic batching.

**Solution**: Allocate pages on demand. Different sequences can have their KV cache pages scattered in memory, connected by a page table. Pages can be shared across sequences (e.g., for beam search or shared prefixes).

**Memory savings**: Reduces internal fragmentation from ~60-80% (worst case, pre-allocation) to <4% (paged).

---

## 4. Algorithmic Derivation

### 4.1 Sparse Attention (Longformer-style)

```
Algorithm: LongformerAttention(Q, K, V, w, global_indices)
──────────────────────────────────────────────────────────
Input:  Q, K, V ∈ ℝ^{T × d}
        w: local window size
        global_indices: set of positions with global attention
Output: O ∈ ℝ^{T × d}

1. // Local attention (sliding window)
2. for i = 0 to T-1:
3.     lo ← max(0, i - w//2)
4.     hi ← min(T, i + w//2 + 1)
5.     local_scores_i ← Q[i] @ K[lo:hi]^⊤ / √d    // O(w·d)
6.
7. // Global attention for designated tokens
8. for i in global_indices:
9.     global_scores_i ← Q[i] @ K^⊤ / √d            // O(T·d)
10.    // All tokens also attend to global tokens
11.
12. // Combine and softmax
13. for i = 0 to T-1:
14.    Combine local_scores and global_scores for position i
15.    α_i ← softmax(combined_scores)
16.    O[i] ← α_i @ corresponding V rows
17. return O

Complexity: O(T·w·d + |global_indices|·T·d)
          = O(T·w·d) when |global_indices| = O(1)
```

### 4.2 Linear Attention

```
Algorithm: LinearAttention(Q, K, V, φ)
──────────────────────────────────────
Input:  Q, K, V ∈ ℝ^{T × d}
        φ: feature map ℝ^d → ℝ^m
Output: O ∈ ℝ^{T × d}

1. // Compute feature maps
2. Q̃ ← φ(Q)    // (T, m)  -- apply φ to each row
3. K̃ ← φ(K)    // (T, m)

4. // Precompute cumulative statistics
5. S ← K̃^⊤ V   // (m, d)  -- O(T·m·d)
6. z ← K̃^⊤ 1   // (m,)    -- O(T·m)  (column sums of K̃)

7. // Compute output for all queries
8. numerator ← Q̃ @ S      // (T, d) -- O(T·m·d)
9. denominator ← Q̃ @ z    // (T,)   -- O(T·m)
10. O ← numerator / denominator  // (T, d) -- element-wise

11. return O

Total complexity: O(T·m·d) -- linear in T!
```

**Causal Linear Attention** (for autoregressive models):

```
Algorithm: CausalLinearAttention(Q, K, V, φ)
────────────────────────────────────────────
1. Q̃ ← φ(Q), K̃ ← φ(K)   // (T, m) each
2. S ← 0^{m × d}           // running KV state
3. z ← 0^m                  // running normalizer

4. for t = 1 to T:
5.     S ← S + K̃[t] ⊗ V[t]    // rank-1 update, O(m·d)
6.     z ← z + K̃[t]            // O(m)
7.     O[t] ← (Q̃[t]^⊤ S) / (Q̃[t]^⊤ z)   // O(m·d)

8. return O

Complexity: O(T·m·d) -- same as non-causal, but sequential
```

### 4.3 FlashAttention (Detailed)

```
Algorithm: FlashAttention_Forward(Q, K, V, B_r, B_c)
─────────────────────────────────────────────────────
Input:  Q ∈ ℝ^{N × d}, K ∈ ℝ^{N × d}, V ∈ ℝ^{N × d}  (in HBM)
        B_r: row block size, B_c: column block size
        (chosen so B_r × d + 2 × B_c × d + B_r × B_c fits in SRAM)
Output: O ∈ ℝ^{N × d}  (in HBM)

1.  T_r ← ⌈N/B_r⌉, T_c ← ⌈N/B_c⌉

    // Initialize in HBM
2.  O ← 0^{N × d}
3.  ℓ ← 0^N          // log-sum-exp denominator
4.  m ← -∞^N         // row-wise max

    // Outer loop: iterate over key-value blocks
5.  for j = 1 to T_c:
6.      Load K_j = K[(j-1)B_c : jB_c] from HBM to SRAM    // B_c × d
7.      Load V_j = V[(j-1)B_c : jB_c] from HBM to SRAM    // B_c × d

        // Inner loop: iterate over query blocks
8.      for i = 1 to T_r:
9.          Load Q_i = Q[(i-1)B_r : iB_r] from HBM to SRAM  // B_r × d
10.         Load O_i, ℓ_i, m_i from HBM to SRAM

            // Compute block attention in SRAM
11.         S_ij ← Q_i K_j^⊤ ∈ ℝ^{B_r × B_c}               // in SRAM
12.         m̃_ij ← rowmax(S_ij) ∈ ℝ^{B_r}
13.         P̃_ij ← exp(S_ij - m̃_ij) ∈ ℝ^{B_r × B_c}
14.         ℓ̃_ij ← rowsum(P̃_ij) ∈ ℝ^{B_r}

            // Online softmax update
15.         m_i^{new} ← max(m_i, m̃_ij)
16.         ℓ_i^{new} ← exp(m_i - m_i^{new}) · ℓ_i + exp(m̃_ij - m_i^{new}) · ℓ̃_ij

            // Rescale and update output
17.         O_i ← diag(exp(m_i - m_i^{new}) · ℓ_i / ℓ_i^{new}) · O_i
                   + diag(exp(m̃_ij - m_i^{new}) / ℓ_i^{new}) · P̃_ij V_j

18.         m_i ← m_i^{new}; ℓ_i ← ℓ_i^{new}

            // Write updated O_i, ℓ_i, m_i back to HBM
19.         Store O_i, ℓ_i, m_i to HBM

20. return O
```

**Note on backward pass:** FlashAttention recomputes $S$ and $P$ from $Q, K, V$ in the backward pass (rather than storing them), trading compute for memory. This is possible because the forward pass stores only $O$, $m$, and $\ell$ (not the $T \times T$ matrices).

---

## 5. PyTorch Implementation

### 5.1 Sparse Attention (Sliding Window)

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

def sliding_window_attention(
    Q: torch.Tensor,   # (B, T, d)
    K: torch.Tensor,   # (B, T, d)
    V: torch.Tensor,   # (B, T, d)
    window_size: int,
) -> torch.Tensor:     # (B, T, d)
    """
    Sliding window (local) attention.

    Each position attends only to positions within a window of size `window_size`.
    Complexity: O(T * window_size * d) instead of O(T^2 * d).
    """
    B, T, d = Q.shape
    w = window_size

    # Create the local attention mask: (T, T)
    # mask[i,j] = 1 if |i - j| <= w // 2
    positions = torch.arange(T, device=Q.device)
    mask = (positions.unsqueeze(0) - positions.unsqueeze(1)).abs() <= w // 2
    mask = mask.float().unsqueeze(0)  # (1, T, T)

    # Standard attention with mask
    scores = torch.bmm(Q, K.transpose(-2, -1)) / math.sqrt(d)  # (B, T, T)
    scores = scores.masked_fill(mask == 0, float('-inf'))
    attn = F.softmax(scores, dim=-1)  # (B, T, T)
    output = torch.bmm(attn, V)       # (B, T, d)

    return output
```

**Note:** The above is a *correct but naive* implementation. A truly efficient sparse implementation would avoid computing the full $T \times T$ score matrix and only compute the $T \times w$ non-zero entries. Libraries like `xformers` and `triton` provide such implementations.

### 5.2 Linear Attention

```python
class LinearAttention(nn.Module):
    """
    Linear attention with ELU+1 feature map (Katharopoulos et al., 2020).

    Complexity: O(T * d^2) instead of O(T^2 * d).
    """
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_model = d_model
        self.n_heads = n_heads
        self.d_k = d_model // n_heads

        self.W_Q = nn.Linear(d_model, d_model, bias=False)
        self.W_K = nn.Linear(d_model, d_model, bias=False)
        self.W_V = nn.Linear(d_model, d_model, bias=False)
        self.W_O = nn.Linear(d_model, d_model, bias=False)

    @staticmethod
    def feature_map(x: torch.Tensor) -> torch.Tensor:
        """ELU + 1 feature map: ensures non-negative features."""
        return F.elu(x) + 1  # (B, h, T, d_k)

    def forward(
        self,
        x: torch.Tensor,          # (B, T, d_model)
        causal: bool = False,
    ) -> torch.Tensor:             # (B, T, d_model)
        B, T, _ = x.shape
        h, d_k = self.n_heads, self.d_k

        Q = self.W_Q(x).view(B, T, h, d_k).transpose(1, 2)  # (B, h, T, d_k)
        K = self.W_K(x).view(B, T, h, d_k).transpose(1, 2)
        V = self.W_V(x).view(B, T, h, d_k).transpose(1, 2)

        # Apply feature map
        Q = self.feature_map(Q)  # (B, h, T, d_k)
        K = self.feature_map(K)  # (B, h, T, d_k)

        if causal:
            # Causal linear attention: sequential computation
            # S_t = sum_{s<=t} phi(k_s) v_s^T, incrementally updated
            output = torch.zeros_like(V)  # (B, h, T, d_k)
            S = torch.zeros(B, h, d_k, d_k, device=x.device)  # running KV state
            z = torch.zeros(B, h, d_k, device=x.device)        # running normalizer

            for t in range(T):
                k_t = K[:, :, t, :]  # (B, h, d_k)
                v_t = V[:, :, t, :]  # (B, h, d_k)
                q_t = Q[:, :, t, :]  # (B, h, d_k)

                # Update running statistics
                S = S + torch.einsum('bhm,bhn->bhmn', k_t, v_t)  # (B, h, d_k, d_k)
                z = z + k_t  # (B, h, d_k)

                # Compute output
                num = torch.einsum('bhm,bhmn->bhn', q_t, S)  # (B, h, d_k)
                den = torch.einsum('bhm,bhm->bh', q_t, z).unsqueeze(-1)  # (B, h, 1)
                output[:, :, t, :] = num / (den + 1e-6)
        else:
            # Non-causal: compute S = K^T V once
            # S: (B, h, d_k, d_k) = (B, h, d_k, T) @ (B, h, T, d_k)
            S = torch.matmul(K.transpose(-2, -1), V)  # (B, h, d_k, d_k)
            z = K.sum(dim=2)  # (B, h, d_k)

            # Output: (B, h, T, d_k)
            num = torch.matmul(Q, S)  # (B, h, T, d_k)
            den = torch.matmul(Q, z.unsqueeze(-1))  # (B, h, T, 1)
            output = num / (den + 1e-6)

        output = output.transpose(1, 2).contiguous().view(B, T, self.d_model)
        return self.W_O(output)
```

### 5.3 Grouped-Query Attention

```python
class GroupedQueryAttention(nn.Module):
    """
    Grouped-Query Attention (Ainslie et al., 2023).

    n_heads query heads, n_kv_heads key-value heads.
    n_heads must be divisible by n_kv_heads.

    When n_kv_heads = n_heads: standard MHA
    When n_kv_heads = 1: Multi-Query Attention (MQA)
    """
    def __init__(
        self,
        d_model: int,
        n_heads: int,
        n_kv_heads: int,
        dropout: float = 0.0,
    ):
        super().__init__()
        assert d_model % n_heads == 0
        assert n_heads % n_kv_heads == 0

        self.d_model = d_model
        self.n_heads = n_heads
        self.n_kv_heads = n_kv_heads
        self.n_groups = n_heads // n_kv_heads  # queries per KV head
        self.d_k = d_model // n_heads

        self.W_Q = nn.Linear(d_model, n_heads * self.d_k, bias=False)
        self.W_K = nn.Linear(d_model, n_kv_heads * self.d_k, bias=False)
        self.W_V = nn.Linear(d_model, n_kv_heads * self.d_k, bias=False)
        self.W_O = nn.Linear(n_heads * self.d_k, d_model, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(
        self,
        x: torch.Tensor,              # (B, T, d_model)
        mask: torch.Tensor = None,     # (B, 1, T, T) or broadcastable
        kv_cache: dict = None,         # {"k": (B, n_kv, T_past, d_k), "v": similar}
    ) -> tuple[torch.Tensor, dict]:
        B, T, _ = x.shape
        d_k = self.d_k

        # Project
        Q = self.W_Q(x).view(B, T, self.n_heads, d_k).transpose(1, 2)
        # (B, n_heads, T, d_k)

        K = self.W_K(x).view(B, T, self.n_kv_heads, d_k).transpose(1, 2)
        V = self.W_V(x).view(B, T, self.n_kv_heads, d_k).transpose(1, 2)
        # (B, n_kv_heads, T, d_k)

        # Update KV cache if provided
        if kv_cache is not None:
            K = torch.cat([kv_cache["k"], K], dim=2)  # (B, n_kv, T_past+T, d_k)
            V = torch.cat([kv_cache["v"], V], dim=2)
        new_cache = {"k": K, "v": V}

        # Expand KV heads to match query heads
        # (B, n_kv, T_k, d_k) -> (B, n_kv, n_groups, T_k, d_k) -> (B, n_heads, T_k, d_k)
        T_k = K.size(2)
        K = K.unsqueeze(2).expand(B, self.n_kv_heads, self.n_groups, T_k, d_k)
        K = K.reshape(B, self.n_heads, T_k, d_k)
        V = V.unsqueeze(2).expand(B, self.n_kv_heads, self.n_groups, T_k, d_k)
        V = V.reshape(B, self.n_heads, T_k, d_k)

        # Standard scaled dot-product attention
        scores = torch.matmul(Q, K.transpose(-2, -1)) / math.sqrt(d_k)
        # (B, n_heads, T, T_k)

        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn = self.dropout(F.softmax(scores, dim=-1))
        out = torch.matmul(attn, V)  # (B, n_heads, T, d_k)

        out = out.transpose(1, 2).contiguous().view(B, T, self.d_model)
        return self.W_O(out), new_cache
```

### 5.4 KV Cache for Autoregressive Generation

```python
class CachedTransformerBlock(nn.Module):
    """Transformer decoder block with KV cache support."""

    def __init__(self, d_model: int, n_heads: int, n_kv_heads: int, d_ff: int):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)
        self.attn = GroupedQueryAttention(d_model, n_heads, n_kv_heads)
        self.ln2 = nn.LayerNorm(d_model)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Linear(d_ff, d_model),
        )

    def forward(
        self, x: torch.Tensor, mask: torch.Tensor = None, kv_cache: dict = None
    ) -> tuple[torch.Tensor, dict]:
        x_norm = self.ln1(x)
        attn_out, new_cache = self.attn(x_norm, mask, kv_cache)
        x = x + attn_out
        x = x + self.ffn(self.ln2(x))
        return x, new_cache


@torch.no_grad()
def generate_with_kv_cache(
    model_blocks: nn.ModuleList,    # list of CachedTransformerBlock
    embedding: nn.Embedding,        # token embedding
    lm_head: nn.Linear,             # output projection
    prompt_ids: torch.Tensor,       # (1, T_prompt)
    max_new_tokens: int = 50,
    temperature: float = 1.0,
) -> torch.Tensor:
    """
    Autoregressive generation with KV cache.

    At each step, only the NEW token is processed through the model.
    Past keys and values are retrieved from cache.
    """
    device = prompt_ids.device
    N = len(model_blocks)  # number of layers

    # --- Prefill phase: process entire prompt ---
    x = embedding(prompt_ids)  # (1, T_prompt, d)
    T_prompt = prompt_ids.size(1)

    causal_mask = torch.tril(torch.ones(T_prompt, T_prompt, device=device))
    causal_mask = causal_mask.unsqueeze(0).unsqueeze(0)  # (1, 1, T_prompt, T_prompt)

    caches = [None] * N
    for i, block in enumerate(model_blocks):
        x, caches[i] = block(x, mask=causal_mask, kv_cache=None)

    # Get logits for last position
    logits = lm_head(x[:, -1:, :])  # (1, 1, V)
    next_token = torch.multinomial(
        F.softmax(logits[:, -1] / temperature, dim=-1), 1
    )  # (1, 1)

    generated = [next_token]

    # --- Decode phase: one token at a time ---
    for step in range(max_new_tokens - 1):
        x = embedding(next_token)  # (1, 1, d)

        T_past = caches[0]["k"].size(2)  # length of cached sequence

        # Mask: new token can attend to all past + itself
        # Shape: (1, 1, 1, T_past + 1)
        mask = torch.ones(1, 1, 1, T_past + 1, device=device)

        for i, block in enumerate(model_blocks):
            x, caches[i] = block(x, mask=mask, kv_cache=caches[i])

        logits = lm_head(x)  # (1, 1, V)
        next_token = torch.multinomial(
            F.softmax(logits[:, -1] / temperature, dim=-1), 1
        )
        generated.append(next_token)

    return torch.cat(generated, dim=1)  # (1, max_new_tokens)
```

### 5.5 FlashAttention Usage (via PyTorch)

```python
# PyTorch 2.0+ includes a built-in FlashAttention implementation
# accessed via torch.nn.functional.scaled_dot_product_attention

def flash_attention_example():
    """Demonstrate PyTorch's built-in FlashAttention."""
    B, H, T, d_k = 2, 8, 1024, 64

    Q = torch.randn(B, H, T, d_k, device='cuda', dtype=torch.float16)
    K = torch.randn(B, H, T, d_k, device='cuda', dtype=torch.float16)
    V = torch.randn(B, H, T, d_k, device='cuda', dtype=torch.float16)

    # This automatically dispatches to FlashAttention when:
    # - inputs are on CUDA
    # - dtype is float16 or bfloat16
    # - head dimension <= 128
    with torch.backends.cuda.sdp_kernel(
        enable_flash=True, enable_math=False, enable_mem_efficient=False
    ):
        output = F.scaled_dot_product_attention(Q, K, V, is_causal=True)
        # output: (B, H, T, d_k) -- exact attention, O(T) memory

    print(f"Output shape: {output.shape}")  # (2, 8, 1024, 64)
    print(f"Output dtype: {output.dtype}")  # float16
```

### 5.6 Verification

```python
def verify_efficient_attention():
    """Verify correctness of efficient attention implementations."""
    torch.manual_seed(42)
    B, T, d = 2, 32, 64
    n_heads = 4

    Q = torch.randn(B, T, d)
    K = torch.randn(B, T, d)
    V = torch.randn(B, T, d)

    # --- Sliding window vs full attention ---
    # Full attention should equal sliding window when window = T
    scores_full = torch.bmm(Q, K.transpose(-2, -1)) / math.sqrt(d)
    attn_full = F.softmax(scores_full, dim=-1)
    out_full = torch.bmm(attn_full, V)

    out_window = sliding_window_attention(Q, K, V, window_size=2 * T + 1)
    assert torch.allclose(out_full, out_window, atol=1e-5), \
        "Window attention should equal full attention when window covers all positions"

    # --- Linear attention shape check ---
    lin_attn = LinearAttention(d, n_heads)
    out_lin = lin_attn(Q)
    assert out_lin.shape == (B, T, d), f"Got {out_lin.shape}"

    # Causal linear attention
    out_causal = lin_attn(Q, causal=True)
    assert out_causal.shape == (B, T, d), f"Got {out_causal.shape}"

    # --- GQA shape check ---
    gqa = GroupedQueryAttention(d, n_heads=4, n_kv_heads=2)
    out_gqa, cache = gqa(Q, kv_cache=None)
    assert out_gqa.shape == (B, T, d), f"Got {out_gqa.shape}"
    assert cache["k"].shape == (B, 2, T, d // 4), f"Got {cache['k'].shape}"

    # Incremental decoding: process one more token
    Q_new = torch.randn(B, 1, d)
    out_new, cache_new = gqa(Q_new, kv_cache=cache)
    assert out_new.shape == (B, 1, d)
    assert cache_new["k"].shape == (B, 2, T + 1, d // 4)

    print("All efficient attention tests passed!")

verify_efficient_attention()
```

---

## 6. Experimental Intuition

### 6.1 When Does the Quadratic Cost Actually Matter?

For typical LLM inference at moderate context lengths ($T \leq 4096$), the FFN computation ($O(Td^2)$) often dominates attention ($O(T^2d)$) because $d > T$. The attention quadratic cost becomes dominant when:

$$T^2 d > Td^2 \implies T > d$$

For $d_{\text{model}} = 4096$: attention dominates for $T > 4096$.

For training with long contexts, the memory cost ($O(T^2)$ for the attention matrix) is often the binding constraint before FLOPs.

### 6.2 FlashAttention Speedup

Empirical speedups of FlashAttention over standard PyTorch attention (A100 GPU, FP16):

| Sequence Length | Standard | FlashAttention | Speedup |
|:---------------:|:--------:|:--------------:|:-------:|
| 512 | 0.5 ms | 0.3 ms | 1.7x |
| 1024 | 1.8 ms | 0.8 ms | 2.3x |
| 2048 | 6.9 ms | 2.4 ms | 2.9x |
| 4096 | 27.1 ms | 7.6 ms | 3.6x |
| 8192 | OOM | 27.4 ms | -- |
| 16384 | OOM | 105 ms | -- |

The speedup increases with sequence length because FlashAttention's IO savings grow. At short sequences, the overhead of tiling may negate savings.

### 6.3 MQA / GQA Quality vs Efficiency

From Ainslie et al. (2023), on a 7B model:

| Method | KV heads | KV cache (4K ctx) | Quality (avg benchmark) |
|:-------|:--------:|:------------------:|:-----------------------:|
| MHA | 32 | 1 GB | 100% (baseline) |
| GQA-8 | 8 | 250 MB | 99.5% |
| GQA-4 | 4 | 125 MB | 99.0% |
| MQA | 1 | 31 MB | 97.5% |

GQA-8 provides $4\times$ KV cache reduction with negligible quality loss.

### 6.4 Failure Modes

1. **Sparse attention missing long-range dependencies**: If important context lies outside the local window and no global token covers it, the model cannot attend to it. Mitigation: global tokens, hierarchical structures.
2. **Linear attention quality gap**: Linear attention consistently underperforms softmax attention on language modeling by 1-3 perplexity points. The inability to compute sharp attention patterns is a fundamental limitation.
3. **KV cache OOM**: For long-context batch serving, the KV cache alone can exceed GPU memory. Mitigation: paged attention, KV cache quantization, speculative decoding.

---

## 7. Connections and Extensions

### 7.1 State Space Models

State space models (SSMs) like Mamba (Gu & Dao, 2023) achieve $O(T)$ complexity for sequence modeling without any attention. They use a structured state transition:

$$h_t = Ah_{t-1} + Bx_t, \qquad y_t = Ch_t + Dx_t$$

with structured matrices $A, B, C, D$ that can be computed efficiently via convolutions. SSMs can be seen as a form of linear attention with a specific (learned, diagonal) feature map.

### 7.2 Ring Attention

Ring attention (Liu et al., 2023) distributes the FlashAttention computation across multiple devices. Each device holds a block of Q and circulates blocks of K, V around a ring of devices. This enables context lengths of millions of tokens by distributing the KV data across device memory.

### 7.3 Mixture of Attention Heads

Some architectures mix different attention types across heads:
- Some heads use local attention (efficient, good for syntax).
- Some heads use global/strided attention (for long-range dependencies).
- Some heads use linear attention (cheapest, for broad aggregation).

This heterogeneous design can provide a better efficiency-quality tradeoff than using a single attention type.

### 7.4 Speculative Decoding

Speculative decoding (Leviathan et al., 2023) addresses inference latency by using a small "draft" model to generate $k$ candidate tokens, which are then verified in parallel by the large model. This reduces the number of large-model forward passes from $T$ to roughly $T/k$, amortizing the KV cache cost.

### 7.5 Quantized KV Cache

Storing the KV cache in lower precision (INT8 or INT4 instead of FP16) reduces memory by $2$-$4\times$ with minimal quality loss. Combined with GQA, this can reduce KV cache memory by $8$-$16\times$.

---

## 8. Seminal Paper Reading List

1. **Dao, T., Fu, D. Y., Ermon, S., Rudra, A., & Re, C.** (2022). *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness.* NeurIPS 2022.
   - The FlashAttention algorithm. Essential reading.

2. **Dao, T.** (2023). *FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning.* arXiv.
   - Improved version with better GPU utilization.

3. **Child, R., Gray, S., Radford, A., & Sutskever, I.** (2019). *Generating Long Sequences with Sparse Transformers.* arXiv.
   - Sparse attention with factored patterns.

4. **Beltagy, I., Peters, M. E., & Cohan, A.** (2020). *Longformer: The Long-Document Transformer.* arXiv.
   - Sliding window + global attention for long documents.

5. **Katharopoulos, A., Vyas, A., Pappas, N., & Fleuret, F.** (2020). *Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention.* ICML 2020.
   - Linear attention via kernel feature maps.

6. **Ainslie, J., et al.** (2023). *GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints.* EMNLP 2023.
   - Grouped-query attention.

7. **Shazeer, N.** (2019). *Fast Transformer Decoding: One Write-Head is All You Need.* arXiv.
   - Original multi-query attention.

8. **Kwon, W., et al.** (2023). *Efficient Memory Management for Large Language Model Serving with PagedAttention.* SOSP 2023.
   - Paged attention / vLLM.

---

## 9. Exercises

### Theory Exercises

**Exercise 4d.1.** Derive the exact FLOP count for multi-head self-attention (including all linear projections) as a function of $B$, $T$, $d_{\text{model}}$, and $h$. At what $T$ does attention cost exceed FFN cost (assuming $d_{\text{ff}} = 4d_{\text{model}}$)?

**Exercise 4d.2.** Prove that the rank of the attention matrix produced by linear attention with feature dimension $m$ is at most $m$. Conclude that when $m < T$, linear attention cannot represent a permutation matrix (hard attention).

**Exercise 4d.3.** In FlashAttention, derive the optimal block sizes $B_r$ and $B_c$ as a function of SRAM size $M$ and head dimension $d$. Show that the number of HBM accesses is $O(T^2 d^2 / M)$.

**Exercise 4d.4.** For GQA with $h$ query heads and $g$ KV heads, derive the total parameter count for the QKV projections as a function of $d_{\text{model}}$, $h$, and $g$. Express the KV cache memory as a function of $g$, $T$, $d_k$, and $N$ (layers).

**Exercise 4d.5.** A serving system has 80 GB of GPU memory. The model weights occupy 14 GB (7B parameters in FP16). The model has $N = 32$ layers, $h = 32$ heads, $d_k = 128$, $n_{\text{kv}} = 8$ (GQA). What is the maximum total sequence length (summed across all requests in a batch) that can be served? Account for activations and overhead.

### Implementation Exercises

**Exercise 4d.6.** Implement sliding window attention efficiently (without materializing the full $T \times T$ matrix). Benchmark against standard attention for $T \in \{256, 1024, 4096, 16384\}$ and plot wall-clock time.

**Exercise 4d.7.** Implement causal linear attention with the ELU+1 feature map. Compare its perplexity against standard softmax attention on a language modeling task. Quantify the quality gap.

**Exercise 4d.8.** Implement a simple autoregressive generation loop with KV caching. Measure tokens-per-second with and without caching for a small Transformer model. The speedup should be roughly proportional to the sequence length.

**Exercise 4d.9.** Using `torch.nn.functional.scaled_dot_product_attention` with `is_causal=True`, benchmark FlashAttention vs a manual attention implementation for various sequence lengths. Plot memory usage (via `torch.cuda.max_memory_allocated`) and wall-clock time.
