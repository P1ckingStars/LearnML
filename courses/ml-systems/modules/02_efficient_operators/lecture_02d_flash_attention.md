# Lecture 02d: Flash Attention: Algorithm, Memory Analysis, and Implementation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the IO complexity of standard attention and prove that it requires $\Theta(N^2)$ HBM reads/writes, making it memory-bound for typical sequence lengths.
2. **Explain** the Flash Attention algorithm, including the tiled computation strategy and the online softmax trick for numerically stable incremental normalization.
3. **Prove** that Flash Attention reduces HBM access to $O(N^2 d^2 / M)$ where $M$ is SRAM size, and compute the crossover point where this dominates compute.
4. **Compare** Flash Attention 1, 2, and 3, identifying the key innovations in each version (parallelism strategy, warp specialization, Hopper features).
5. **Implement** a simplified Flash Attention forward pass in pseudocode and trace the data flow through the tiling loop.

---

## 2. Motivation and Context

### 2.1 Attention Is All You Need... But It Is Slow

The scaled dot-product attention mechanism computes:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d}}\right) V$$

where $Q, K, V \in \mathbb{R}^{N \times d}$, $N$ is the sequence length, and $d$ is the head dimension.

The intermediate matrix $S = QK^T / \sqrt{d}$ has shape $N \times N$. For $N = 8192$ and $d = 128$:
- $S$ requires $N^2 \times 2 = 128$ MB in FP16
- The attention output is $N \times d \times 2 = 2$ MB
- The input $Q, K, V$ total $3 \times N \times d \times 2 = 6$ MB

The $N^2$ intermediate is 20x larger than all inputs and outputs combined. This is the memory bottleneck.

### 2.2 The Two Problems

**Problem 1: Memory.** The $N \times N$ attention matrix must be materialized for the backward pass (to compute gradients through softmax). For long sequences, this is prohibitive. At $N = 32768$ and 32 heads: $32 \times 32768^2 \times 2 \approx 64$ GB.

**Problem 2: Speed.** Even in the forward pass, writing $S$ to HBM and reading it back for softmax, then writing $P = \text{softmax}(S)$ to HBM and reading it back for the final matmul $PV$, incurs enormous memory traffic. The compute (two matmuls and a softmax) has high arithmetic intensity, but the naive implementation is dominated by HBM I/O.

---

## 3. Standard Attention: IO Complexity Analysis

### 3.1 The Computation DAG

Standard attention proceeds in four steps:

```python
# Standard attention (naive)
S = Q @ K.T / sqrt(d)       # Step 1: N x N matmul, write S to HBM
P = softmax(S, dim=-1)      # Step 2: read S, write P to HBM
O = P @ V                   # Step 3: read P, write O to HBM
```

### 3.2 HBM Access Count

| Step | Operation | HBM Reads | HBM Writes |
|------|-----------|:---------:|:----------:|
| 1 | $S = QK^T/\sqrt{d}$ | $Q: Nd$, $K: Nd$ | $S: N^2$ |
| 2 | $P = \text{softmax}(S)$ | $S: N^2$ | $P: N^2$ |
| 3 | $O = PV$ | $P: N^2$, $V: Nd$ | $O: Nd$ |
| **Total** | | $3Nd + 2N^2$ | $2N^2 + Nd$ |

Total HBM access: $\Theta(Nd + N^2)$ elements. Since $N \gg d$ (e.g., $N = 4096$, $d = 128$), this is $\Theta(N^2)$.

### 3.3 Roofline Analysis

For $N = 4096$, $d = 128$, FP16:

- **FLOPs**: $2N^2d$ (for $QK^T$) + $5N^2$ (softmax) + $2N^2d$ (for $PV$) $\approx 4N^2d = 4 \times 4096^2 \times 128 \approx 8.6$ GFLOP
- **HBM bytes**: $\approx 4N^2 \times 2 = 128$ MB (dominated by reading/writing $S$ and $P$)
- **AI**: $8.6 \times 10^9 / (128 \times 10^6) \approx 67$ FLOPs/byte

On H100 ($\beta \approx 295$), this is **memory-bound**. The compute units are sitting idle while waiting for data.

---

## 4. The Flash Attention Algorithm

### 4.1 Key Insight: Tiling + Online Softmax

Flash Attention (Dao et al., 2022) avoids materializing the $N \times N$ matrix by:

1. **Tiling**: Process $Q$, $K$, $V$ in blocks along the sequence dimension
2. **Online softmax**: Compute softmax incrementally using the "online" algorithm, without needing to see all elements of a row before normalizing

The result is that only $O(N)$ memory is needed (for the output), not $O(N^2)$.

### 4.2 Online Softmax (Milakov & Gimelshein, 2018)

Standard softmax requires two passes:
1. Compute $m = \max_j s_j$ (for numerical stability)
2. Compute $\text{softmax}(s)_j = e^{s_j - m} / \sum_k e^{s_k - m}$

**Online softmax** processes elements in a single streaming pass, maintaining running statistics:

```
Initialize: m = -inf, l = 0 (running max and running sum of exponentials)

For each new block of scores s_new[1..B]:
    m_new = max(m, max(s_new))
    l_new = l * exp(m - m_new) + sum(exp(s_new - m_new))
    m = m_new
    l = l_new
```

The correction factor $\exp(m_{\text{old}} - m_{\text{new}})$ rescales the previously accumulated sum to account for the new maximum. This is exact, not an approximation.

### 4.3 Online Softmax + Weighted Sum

Flash Attention extends online softmax to also maintain a running weighted sum (the attention output):

```
Initialize: m = -inf, l = 0, O = 0  (running max, sum, output)

For each block j of K, V (block size B_c):
    Load K_j, V_j from HBM to SRAM
    Compute S_j = Q_i @ K_j^T / sqrt(d)     [in SRAM]
    m_new = max(m, rowmax(S_j))
    P_j = exp(S_j - m_new)                   [in SRAM]
    l_new = exp(m - m_new) * l + rowsum(P_j)
    O = (l / l_new) * exp(m - m_new) * O + (1 / l_new) * P_j @ V_j
    m = m_new
    l = l_new
```

The key: $O$ is rescaled at each step to account for the changing normalization constant. After processing all blocks, $O$ contains the exact attention output.

### 4.4 The Full Algorithm (Forward Pass)

**Inputs**: $Q, K, V \in \mathbb{R}^{N \times d}$ in HBM, SRAM of size $M$.

**Block sizes**: $B_r = \lceil M / (4d) \rceil$ (query block), $B_c = \min(\lceil M / (4d) \rceil, d)$ (key/value block).

```
Algorithm: FlashAttention Forward

1. Initialize O = (0)_{N x d}, l = (0)_N, m = (-inf)_N in HBM

2. Divide Q into T_r = ceil(N / B_r) blocks: Q_1, ..., Q_{T_r}
   Divide K, V into T_c = ceil(N / B_c) blocks: K_1, ..., K_{T_c}, V_1, ..., V_{T_c}

3. for j = 1, ..., T_c:                          // Outer loop: over K/V blocks
       Load K_j, V_j from HBM to SRAM

       for i = 1, ..., T_r:                      // Inner loop: over Q blocks
           Load Q_i, O_i, l_i, m_i from HBM to SRAM

           // Compute attention scores for this block pair
           S_ij = Q_i @ K_j^T / sqrt(d)          // B_r x B_c, in SRAM

           // Update running statistics
           m_ij = rowmax(S_ij)                    // B_r x 1
           m_i_new = max(m_i, m_ij)               // B_r x 1
           P_ij = exp(S_ij - m_i_new)             // B_r x B_c, in SRAM
           l_i_new = exp(m_i - m_i_new) * l_i + rowsum(P_ij)

           // Update output with rescaling
           O_i = diag(exp(m_i - m_i_new)) * diag(l_i / l_i_new) * O_i
                 + diag(1 / l_i_new) * P_ij @ V_j

           // Write updated statistics back to HBM
           m_i = m_i_new
           l_i = l_i_new
           Write O_i, l_i, m_i to HBM

4. Return O
```

### 4.5 Correctness Argument

**Claim**: After processing all $T_c$ key/value blocks, row $i$ of $O$ equals:

$$O_i = \frac{\sum_{j=1}^{N} e^{s_{ij} - m_i} V_j}{\sum_{j=1}^{N} e^{s_{ij} - m_i}}$$

where $s_{ij} = Q_i K_j^T / \sqrt{d}$ and $m_i = \max_j s_{ij}$.

**Proof sketch**: By induction on the number of blocks processed. After processing blocks $1, \ldots, t$:
- $m_i^{(t)} = \max_{j \in \text{blocks } 1..t} s_{ij}$ (the running max is updated correctly)
- $l_i^{(t)} = \sum_{j \in \text{blocks } 1..t} e^{s_{ij} - m_i^{(t)}}$ (the running sum is rescaled correctly)
- $O_i^{(t)} = \frac{1}{l_i^{(t)}} \sum_{j \in \text{blocks } 1..t} e^{s_{ij} - m_i^{(t)}} V_j$ (the output is rescaled correctly)

The rescaling factor $\exp(m_i^{(t-1)} - m_i^{(t)})$ applied to $l_i^{(t-1)}$ and $O_i^{(t-1)}$ ensures consistency when the maximum changes. After processing all blocks, $t = T_c$, and we have the standard softmax-weighted sum.

---

## 5. IO Complexity Analysis

### 5.1 HBM Accesses in Flash Attention

**Reads**:
- $K, V$: Each read once (outer loop). Total: $2Nd$ elements.
- $Q, O, l, m$: Each read $T_c = \lceil N / B_c \rceil$ times (inner loop). Total: $(Nd + Nd + N + N) \times N/B_c \approx 2N^2d / B_c$ elements.

**Writes**:
- $O, l, m$: Updated $T_c$ times per $Q$-block. Total: $(Nd + N + N) \times N/B_c \approx N^2d / B_c$ elements.

With $B_c = \Theta(M/d)$:

$$\text{Total HBM access} = O\left(Nd + \frac{N^2 d^2}{M}\right)$$

### 5.2 Comparison with Standard Attention

| Algorithm | HBM Access | Memory |
|-----------|:-:|:-:|
| Standard | $\Theta(Nd + N^2)$ | $\Theta(N^2)$ |
| Flash Attention | $O(Nd + N^2 d^2 / M)$ | $\Theta(N)$ |

For $N = 4096$, $d = 128$, $M = 192$ KB (H100 shared memory):

- Standard: $\sim N^2 = 16.8$ M elements $= 33.6$ MB
- Flash Attention: $\sim N^2 d^2 / M = 4096^2 \times 128^2 / 98304 \approx 2.8$ M elements $= 5.6$ MB

**6x fewer HBM accesses**, leading to a proportional speedup on memory-bound configurations.

### 5.3 Optimality

**Theorem (Dao et al., 2022)**: For all $M \in [d, Nd]$, there is no attention algorithm that uses $o(N^2 d^2 / M)$ HBM accesses and computes exact attention.

The proof uses a reduction from matrix multiplication: if attention could be computed with fewer HBM accesses, it would imply a faster-than-known algorithm for matrix multiplication in the I/O model, contradicting lower bounds from Hong & Kung (1981).

---

## 6. The Backward Pass

### 6.1 Challenge: No Stored Attention Matrix

Standard backpropagation through attention requires $P = \text{softmax}(S)$, which is $N \times N$. Flash Attention does not store $P$. Instead, the backward pass **recomputes** $S$ and $P$ from $Q$, $K$, $V$ on the fly, using the stored $O$, $l$, and $m$ from the forward pass.

### 6.2 Backward Algorithm (Sketch)

For the backward pass, given $dO$:

1. Compute $D = \text{rowsum}(dO \odot O)$ (a vector of length $N$, stored in HBM)
2. For each block pair $(i, j)$:
   - Recompute $S_{ij} = Q_i K_j^T / \sqrt{d}$ in SRAM
   - Recompute $P_{ij} = \text{softmax}(S_{ij})$ using stored $m_i, l_i$
   - Compute $dV_j \mathrel{+}= P_{ij}^T \cdot dO_i$
   - Compute $dP_{ij} = dO_i \cdot V_j^T$
   - Compute $dS_{ij} = P_{ij} \odot (dP_{ij} - D_i)$ (softmax backward)
   - Compute $dQ_i \mathrel{+}= dS_{ij} \cdot K_j / \sqrt{d}$
   - Compute $dK_j \mathrel{+}= dS_{ij}^T \cdot Q_i / \sqrt{d}$

The recomputation adds $O(N^2 d)$ FLOPs (one extra GEMM per block pair), but since attention is memory-bound, this extra compute is hidden behind the memory access latency. The wall-clock time for the backward pass is similar to standard attention, while using $O(N)$ memory instead of $O(N^2)$.

---

## 7. Flash Attention 2

### 7.1 Key Improvements

Flash Attention 2 (Dao, 2023) improves upon Flash Attention 1 with:

**1. Swapped loop order**: The outer loop iterates over $Q$-blocks and the inner loop over $K/V$-blocks. This means each $Q$-block is loaded once from HBM, and $K/V$ blocks are streamed through. The output $O_i$ for query block $i$ is accumulated entirely in SRAM and written to HBM only once.

```
FlashAttention-1:  outer over K/V, inner over Q  →  Q loaded T_c times
FlashAttention-2:  outer over Q, inner over K/V  →  Q loaded once
```

This reduces HBM writes for $O$ from $T_c$ writes per block to 1 write per block.

**2. Better parallelism across sequence length**: Flash Attention 1 parallelizes over batch size and number of heads. Flash Attention 2 also parallelizes over the sequence dimension (query blocks), increasing GPU occupancy for long sequences.

**3. Reduced non-matmul FLOPs**: The rescaling operations (multiply by $\exp(m_{\text{old}} - m_{\text{new}})$) are restructured to minimize element-wise operations, which do not use Tensor Cores.

### 7.2 Performance

On A100 (80 GB):

| Implementation | Forward (ms) | Backward (ms) | % Peak FLOPS |
|----------------|:------------:|:--------------:|:------------:|
| PyTorch standard | 18.4 | 42.1 | 26% |
| Flash Attention 1 | 5.8 | 12.4 | 62% |
| Flash Attention 2 | 3.4 | 8.1 | 73% |

Flash Attention 2 achieves 50--73% of theoretical peak FLOPS, compared to 25--40% for standard attention. The gap to peak is primarily due to non-matmul operations (softmax, rescaling) that cannot use Tensor Cores.

---

## 8. Flash Attention 3

### 8.1 Hopper Architecture Features

Flash Attention 3 (Shah et al., 2024) exploits three features specific to the NVIDIA H100 (Hopper architecture):

**1. Warp specialization**: Separate warps are assigned to different roles:
- **Producer warps**: Issue TMA loads (global memory to shared memory)
- **Consumer warps**: Execute WGMMA (warp-group matrix multiply-accumulate)

This decouples memory loading from computation, enabling true overlap.

**2. Asynchronous TMA**: The Tensor Memory Accelerator loads tiles from HBM to shared memory without consuming any thread/warp resources. The producer warps simply issue TMA descriptors and proceed.

**3. FP8 support**: Hopper's FP8 Tensor Cores (E4M3 and E5M2 formats) provide 2x the throughput of FP16. Flash Attention 3 includes an FP8 path with mixed-precision accumulation.

### 8.2 Pingpong Scheduling

A key innovation in Flash Attention 3 is **pingpong scheduling** between two warp groups:

```
Time →
Warp Group 0:  [Load tile 0] [Compute tile 0] [Load tile 2] [Compute tile 2] ...
Warp Group 1:               [Load tile 1] [Compute tile 1] [Load tile 3] ...
```

While warp group 0 computes on tile 0, warp group 1 loads tile 1 (and vice versa). This maximizes both compute and memory bandwidth utilization simultaneously.

### 8.3 Performance

On H100 SXM (FP16, head dim 128):

| Sequence Length | Flash Attention 2 (TFLOPS) | Flash Attention 3 (TFLOPS) | % Peak |
|:---:|:---:|:---:|:---:|
| 1024 | 310 | 520 | 53% |
| 4096 | 340 | 620 | 63% |
| 16384 | 350 | 660 | 67% |

Flash Attention 3 in FP8 achieves up to 1.2 PFLOPS (75% of FP8 peak).

---

## 9. Implementation Walkthrough

### 9.1 Simplified Forward Pass (Pseudocode)

> **Note on loop order.** The pseudocode below uses the FlashAttention-2 (FA2) loop order: the outer loop iterates over Q-blocks and the inner loop over K/V-blocks. This differs from the original FlashAttention (FA1) algorithm presented in Section 4.4, which uses the opposite order (outer over K/V, inner over Q). The FA2 ordering reduces HBM writes for the output matrix and improves parallelism across thread blocks.

```python
def flash_attention_forward(Q, K, V, B_r, B_c):
    """
    Q, K, V: [N, d] matrices in HBM
    B_r: query block size
    B_c: key/value block size
    Returns: O [N, d], l [N], m [N]
    """
    N, d = Q.shape
    O = zeros(N, d)        # Output in HBM
    l = zeros(N)           # Log-sum-exp denominator in HBM
    m = full(N, -inf)      # Running max in HBM

    T_r = ceil(N / B_r)    # Number of query blocks
    T_c = ceil(N / B_c)    # Number of KV blocks

    for i in range(T_r):   # Outer loop: query blocks
        # Load query block and running statistics to SRAM
        Q_i = Q[i*B_r : (i+1)*B_r]        # [B_r, d] -> SRAM
        O_i = O[i*B_r : (i+1)*B_r]        # [B_r, d] -> SRAM
        l_i = l[i*B_r : (i+1)*B_r]        # [B_r]    -> SRAM
        m_i = m[i*B_r : (i+1)*B_r]        # [B_r]    -> SRAM

        for j in range(T_c):   # Inner loop: KV blocks
            # Load KV block to SRAM
            K_j = K[j*B_c : (j+1)*B_c]    # [B_c, d] -> SRAM
            V_j = V[j*B_c : (j+1)*B_c]    # [B_c, d] -> SRAM

            # Compute attention scores in SRAM
            S_ij = Q_i @ K_j.T / sqrt(d)  # [B_r, B_c] in SRAM

            # Update running max
            m_ij = S_ij.max(dim=-1)        # [B_r]
            m_i_new = maximum(m_i, m_ij)   # [B_r]

            # Compute exponentials with new max
            P_ij = exp(S_ij - m_i_new[:, None])  # [B_r, B_c]

            # Update running sum
            l_i_new = exp(m_i - m_i_new) * l_i + P_ij.sum(dim=-1)

            # Rescale previous output and add new contribution
            scale = exp(m_i - m_i_new) * l_i / l_i_new
            O_i = scale[:, None] * O_i + (1.0 / l_i_new[:, None]) * (P_ij @ V_j)

            # Update statistics
            m_i = m_i_new
            l_i = l_i_new

        # Write final output for this query block back to HBM
        O[i*B_r : (i+1)*B_r] = O_i
        l[i*B_r : (i+1)*B_r] = l_i
        m[i*B_r : (i+1)*B_r] = m_i

    return O, l, m
```

### 9.2 SRAM Budget Verification

At any point in the inner loop, SRAM holds:
- $Q_i$: $B_r \times d$ elements
- $K_j$: $B_c \times d$ elements
- $V_j$: $B_c \times d$ elements
- $O_i$: $B_r \times d$ elements
- $S_{ij}$: $B_r \times B_c$ elements
- $P_{ij}$: $B_r \times B_c$ elements (can overwrite $S_{ij}$)
- $l_i, m_i$: $2 B_r$ elements (negligible)

Total: $(2B_r + 2B_c) \cdot d + B_r \cdot B_c$ elements.

For $d = 128$, $B_r = B_c = 128$, FP16:
$$(2 \times 128 + 2 \times 128) \times 128 + 128 \times 128 = 65536 + 16384 = 81920 \text{ elements}$$
$$81920 \times 2 = 160 \text{ KB}$$

This fits within the 192--228 KB shared memory of modern GPUs.

---

## 10. Causal Masking and Extensions

### 10.1 Causal (Autoregressive) Masking

For decoder-only models (GPT, LLaMA), attention is causal: position $i$ can only attend to positions $j \le i$. In standard attention, this is implemented with a mask:

$$S_{ij} = \begin{cases} Q_i K_j^T / \sqrt{d} & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}$$

In Flash Attention, causal masking is handled at the block level:
- If block $j$ is entirely to the right of block $i$ (all $j > i$), skip it entirely (no GEMM needed)
- If block $j$ partially overlaps, apply the mask after computing $S_{ij}$
- If block $j$ is entirely to the left of block $i$, compute normally

For causal attention, this skips roughly half the block pairs, yielding a ~2x speedup over full attention.

### 10.2 Multi-Query and Grouped-Query Attention

In multi-query attention (MQA) and grouped-query attention (GQA), multiple query heads share a single key/value head. Flash Attention handles this by broadcasting $K, V$ across query heads within the same group, without duplicating them in HBM.

### 10.3 Variable-Length Sequences (Batching)

For batches with variable-length sequences, Flash Attention supports a "varlen" mode where sequences are packed into a single tensor with a cumulative sequence length array. This avoids padding and the associated wasted computation.

---

## Key Takeaways

1. Standard attention is memory-bound due to the $O(N^2)$ intermediate attention matrix that must be written to and read from HBM, despite the operation having sufficient FLOPs to be compute-bound.
2. Flash Attention eliminates the $N \times N$ materialization by tiling the computation and using the online softmax algorithm to maintain running statistics, reducing memory from $O(N^2)$ to $O(N)$.
3. The IO complexity of Flash Attention is $O(N^2 d^2 / M)$, provably optimal for exact attention in the I/O model. For typical parameters, this is 5--10x fewer HBM accesses than standard attention.
4. Flash Attention 2 swaps the loop order (outer over Q, inner over K/V) and improves work partitioning across warps, achieving 50--73% of peak FLOPS on A100.
5. Flash Attention 3 leverages Hopper-specific features (TMA, warp specialization, pingpong scheduling) to achieve 67% of peak FLOPS on H100, with an FP8 path reaching 75% of FP8 peak.

---

## Further Reading

1. **Dao, T., Fu, D.Y., Ermon, S., Rudra, A., & Re, C.** (2022). "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." *NeurIPS*.
2. **Dao, T.** (2023). "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." *arXiv:2307.08691*.
3. **Shah, J., Bikshandi, G., Zhang, Y., Thakkar, V., Ramani, P., & Dao, T.** (2024). "FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision." *arXiv:2407.08691*.
4. **Milakov, M. & Gimelshein, N.** (2018). "Online Normalizer Calculation for Softmax." *arXiv:1805.02867*.
5. **Rabe, M.N. & Staats, C.** (2022). "Self-Attention Does Not Need $O(n^2)$ Memory." *arXiv:2112.05682*.
6. **Hong, J.W. & Kung, H.T.** (1981). "I/O Complexity: The Red-Blue Pebble Game." *STOC*.
