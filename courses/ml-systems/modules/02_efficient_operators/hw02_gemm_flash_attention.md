# Homework 02: Tiled GEMM & Flash Attention Kernel

**Estimated time:** 25 hours
**Due date:** End of Week 4
**Submission:** CUDA C++ source files + Triton kernel file + benchmark notebook + PDF of derivations

---

## Overview

This homework has two parts of equal weight. Part A tests your analytical understanding of GEMM optimization, convolution algorithms, and the Flash Attention IO complexity model. Part B requires you to implement a tiled GEMM kernel **in CUDA C++** (with shared memory, register blocking, and optional Tensor Core support) and a Flash Attention forward pass in Triton.

The GEMM kernel is written in CUDA C++ because this is what production BLAS libraries (cuBLAS, CUTLASS) actually use — you need thread-level and warp-level control that higher-level abstractions hide. Flash Attention uses Triton as a pragmatic choice (the CUDA implementation is ~2000 lines; the algorithm is what matters for a homework).

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. Cite any references you consult. You may reference the CUTLASS documentation for Tensor Core APIs, but do not copy kernel implementations.

---

## Part A: Analytical Problems (50%)

### Problem A1: Tiled GEMM Data Reuse (15 points)

Consider a matrix multiplication $C = AB$ where $A \in \mathbb{R}^{M \times K}$, $B \in \mathbb{R}^{K \times N}$, using tiles of size $T_M \times T_K$ for $A$ and $T_K \times T_N$ for $B$. All matrices are stored in FP16 (2 bytes per element). The GPU has SRAM capacity $S$ bytes per SM.

**(a)** [3 points] Derive the total number of HBM element-reads as a function of $M$, $N$, $K$, $T_M$, $T_N$, and $T_K$. Count reads for $A$ and $B$ separately, and assume that $C$ tiles are fully accumulated in SRAM before writing back (so $C$ is written once).

**(b)** [4 points] Given the constraint that both input tiles must fit in SRAM simultaneously (with double buffering for pipelining), write the SRAM constraint inequality. Assuming $T_M = T_N = T$ and $T_K$ is free, derive the optimal $T_K$ that minimizes total HBM reads subject to the SRAM constraint. What is the resulting arithmetic intensity?

**(c)** [4 points] An H100 GPU has per-SM shared memory of 228 KB (usable), HBM bandwidth of 3.35 TB/s, and Tensor Core peak throughput of 989 TFLOPS (FP16). Compute:
1. The maximum tile size $T$ (with $T_M = T_N = T_K = T$, double-buffered) that fits in shared memory.
2. The arithmetic intensity of the tiled GEMM at this tile size.
3. The machine balance point $\beta$. Is the tiled GEMM compute-bound or memory-bound at this tile size?

**(d)** [4 points] For the batched GEMM used in multi-head attention ($B \times H$ independent GEMMs of size $(S, d) \times (d, S)$ where $B = 8$, $H = 32$, $S = 2048$, $d = 128$), compute the total FLOPs across all heads. Compare with a single large GEMM of equivalent total FLOPs. Which achieves higher GPU utilization and why?

---

### Problem A2: Convolution Algorithm Analysis (15 points)

**(a)** [5 points] For a 2D convolution with input $X \in \mathbb{R}^{256 \times 56 \times 56}$, kernel $K \in \mathbb{R}^{512 \times 256 \times 3 \times 3}$, stride 1, padding 1, batch size 32:

1. Compute the im2col matrix dimensions $\hat{K}$ and $\hat{X}$ (per sample and for the full batch).
2. Compute the memory overhead ratio (im2col matrix size / input size).
3. Compute the total FLOPs for the GEMM.
4. Compare with the Winograd $F(4 \times 4, 3 \times 3)$ algorithm: how many multiplications does Winograd require (counting the transform-domain GEMM and the pre/post transforms)?

**(b)** [5 points] Derive the Winograd $F(2, 3)$ algorithm from scratch. Starting with a $1D$ convolution of filter $g = [g_0, g_1, g_2]$ with input $d = [d_0, d_1, d_2, d_3]$ to produce outputs $y_0, y_1$:

1. Show that $4$ multiplications suffice by finding intermediate products $m_1, m_2, m_3, m_4$ that are each a product of a linear combination of $d_i$'s with a linear combination of $g_j$'s.
2. Express $y_0$ and $y_1$ as sums of the $m_i$'s.
3. Verify your algorithm produces the correct results for $g = [1, 2, 3]$ and $d = [1, 0, 1, 0]$.

**(c)** [5 points] An engineer proposes using FFT-based convolution for all layers of a ResNet-50. Analyze this proposal:

1. For the first convolutional layer ($7 \times 7$ kernel, $224 \times 224$ input), compute the FLOPs for direct, im2col-GEMM, and FFT-based convolution. Which is most efficient?
2. For a typical bottleneck layer ($3 \times 3$ kernel, $56 \times 56$ input), repeat the comparison.
3. Identify two additional practical reasons why FFT-based convolution is not used in modern DNN training, beyond the FLOP count comparison.

---

### Problem A3: Flash Attention IO Complexity (20 points)

**(a)** [5 points] For standard attention with $Q, K, V \in \mathbb{R}^{N \times d}$ in FP16, compute the exact number of bytes read from and written to HBM, counting each matrix access separately. Express the total as a function of $N$ and $d$. For $N = 8192$ and $d = 128$, compute the total HBM traffic in MB.

**(b)** [5 points] In Flash Attention (with the loop order from Flash Attention 2: outer over Q-blocks, inner over K/V-blocks), with block sizes $B_r$ (query block rows) and $B_c$ (KV block rows):

1. How many times is each block of $K$ loaded from HBM? Each block of $V$?
2. How many times is each block of $Q$ loaded?
3. Derive the total HBM reads as a function of $N$, $d$, $B_r$, $B_c$.
4. What is the total HBM writes?

**(c)** [5 points] Setting $B_r = B_c = B$, find the value of $B$ that minimizes total HBM access, subject to the SRAM constraint:

$$(2B_r + 2B_c) \cdot d + B_r \cdot B_c \le M / 2$$

where $M$ is the SRAM size in elements (factor of 2 for FP16 bytes). For $d = 128$ and $M = 192$ KB, compute the optimal $B$ and the resulting HBM traffic for $N = 8192$.

**(d)** [5 points] The online softmax algorithm maintains running statistics $(m, l)$ to compute the exact softmax without materializing the full $N \times N$ matrix. Consider a row of attention scores being processed in two blocks: $s^{(1)} \in \mathbb{R}^{B_c}$ and $s^{(2)} \in \mathbb{R}^{B_c}$.

1. After processing block 1: write the expressions for $m^{(1)}$, $l^{(1)}$, and $o^{(1)}$ (the partial output vector).
2. After processing block 2: write the update rules for $m^{(2)}$, $l^{(2)}$, and $o^{(2)}$ that incorporate the rescaling correction.
3. Prove that $o^{(2)}$ equals the output of standard attention applied to the full row $[s^{(1)}; s^{(2)}]$.

---

## Part B: Implementation (50%)

### Problem B1: Tiled GEMM in CUDA C++ (25 points)

Implement a tiled matrix multiplication kernel in CUDA C++ through a progression of increasingly optimized versions. Each version builds on the previous.

**Build setup**: Provide a `CMakeLists.txt` or `Makefile` that compiles all versions with `nvcc`. All kernels operate on FP16 inputs and FP32 accumulators.

#### B1.1: Naive GEMM (3 points)

```cuda
// gemm_v0_naive.cu
__global__ void gemm_naive(
    const half* A, const half* B, half* C,
    int M, int N, int K
) {
    // One thread computes one element of C.
    // No shared memory, no tiling.
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    if (row < M && col < N) {
        float acc = 0.0f;
        for (int k = 0; k < K; ++k) {
            acc += __half2float(A[row * K + k]) * __half2float(B[k * N + col]);
        }
        C[row * N + col] = __float2half(acc);
    }
}
```

Report achieved GFLOPS for $M = N = K = 4096$. This is your baseline.

#### B1.2: Shared Memory Tiling (5 points)

```cuda
// gemm_v1_smem.cu
// TODO: Implement a tiled GEMM with shared memory.
//
// Each thread block computes a TILE_M x TILE_N tile of C.
// The K dimension is iterated in chunks of TILE_K.
// Per iteration:
//   1. Cooperatively load a TILE_M x TILE_K tile of A into shared memory
//   2. Cooperatively load a TILE_K x TILE_N tile of B into shared memory
//   3. __syncthreads()
//   4. Each thread accumulates its partial dot product from shared memory
//   5. __syncthreads()
//
// Handle boundary conditions (M, N, K not multiples of tile size).
```

Requirements:
- Use `__shared__` memory for both A and B tiles.
- Use `__syncthreads()` correctly (two barriers per K-iteration: one after load, one after compute).
- Handle non-aligned dimensions with masking.
- Try at least two tile sizes (e.g., 32x32, 64x64) and report which is faster.

#### B1.3: Register Blocking (7 points)

```cuda
// gemm_v2_register.cu
// TODO: Each thread computes a TM x TN sub-tile of C (not just one element).
//
// With TILE_M=128, TILE_N=128, TILE_K=8, TM=8, TN=8:
// - Thread block: (TILE_N/TN) x (TILE_M/TM) = 16x16 = 256 threads
// - Each thread loads TM elements from A-smem and TN elements from B-smem
//   into registers, then does TM*TN FMAs per K-step.
// - Arithmetic intensity per thread: TM*TN*TILE_K FMAs using
//   (TM+TN)*TILE_K smem reads -> ratio = TM*TN/(TM+TN)
```

Requirements:
- Each thread accumulates a `float acc[TM][TN]` register tile.
- Shared memory loads must be coalesced (consecutive threads read consecutive addresses).
- Report achieved TFLOPS and compare with V1. The register-blocked version should be 3-5x faster.
- Profile with `ncu` and report: achieved compute throughput (%), memory throughput (%), and occupancy.

#### B1.4: Double Buffering (5 points)

```cuda
// gemm_v3_doublebuf.cu
// TODO: Overlap shared memory loads with computation.
//
// Use double-buffered shared memory:
// - While computing on smem buffer 0, load the next K-tile into buffer 1
// - Swap buffers each iteration
// - This hides memory latency behind computation
//
// Implementation: allocate 2x the shared memory, use a buffer index
// that alternates between 0 and 1.
```

Requirements:
- Two shared memory buffers for A and B (4 buffers total).
- The first K-tile is loaded into buffer 0 before the loop.
- Each loop iteration: compute on current buffer, load next tile into alternate buffer.
- Report the speedup over V2.

#### B1.5: Tensor Core WMMA (bonus, 5 points)

```cuda
// gemm_v4_wmma.cu (bonus)
#include <mma.h>
using namespace nvcuda::wmma;
// TODO: Use WMMA (Warp Matrix Multiply-Accumulate) intrinsics.
//
// Each warp computes a 16x16x16 matrix multiply using Tensor Cores:
//   wmma::fragment<matrix_a, 16, 16, 16, half, row_major> a_frag;
//   wmma::fragment<matrix_b, 16, 16, 16, half, col_major> b_frag;
//   wmma::fragment<accumulator, 16, 16, 16, float> c_frag;
//   wmma::load_matrix_sync(a_frag, smem_a, ldA);
//   wmma::load_matrix_sync(b_frag, smem_b, ldB);
//   wmma::mma_sync(c_frag, a_frag, b_frag, c_frag);
```

#### B1.6: Performance Analysis (5 points)

For $M = N = K = 4096$ (FP16), create a performance summary table:

| Version | TFLOPS | % of cuBLAS | % of Peak | Bottleneck |
|---------|--------|-------------|-----------|------------|
| V0: Naive | -- | -- | -- | -- |
| V1: SMEM tiling | -- | -- | -- | -- |
| V2: Register blocking | -- | -- | -- | -- |
| V3: Double buffering | -- | -- | -- | -- |
| V4: WMMA (bonus) | -- | -- | -- | -- |
| cuBLAS (reference) | -- | -- | 100% | -- |

For V2 or V3, provide `ncu` output showing:
- Achieved compute throughput vs. peak
- Achieved memory bandwidth vs. peak
- Warp occupancy
- Stall reasons breakdown

Also test with non-square sizes: $(1, 4096, 4096)$ (matrix-vector), $(4096, 4096, 128)$ (tall-skinny). Explain why your kernel's relative performance vs. cuBLAS changes across shapes.

**Host-side code**: Write a `benchmark.cu` that:
- Allocates FP16 device arrays, fills with random data
- Runs each kernel version with warm-up + 100 iterations
- Compares against `cublasSgemm` / `cublasHgemm`
- Verifies correctness (max absolute error < $10^{-2}$)

---

### Problem B2: Flash Attention Forward Pass in Triton (25 points)

Implement the Flash Attention forward pass in Triton. (We use Triton here because the CUDA C++ implementation of FlashAttention is ~2000 lines and beyond homework scope. The algorithm and IO analysis are what matter.) Your implementation must:

1. **[8 points] Core algorithm**: Implement the forward pass of Flash Attention with the online softmax algorithm. The kernel should:
   - Take $Q, K, V \in \mathbb{R}^{N \times d}$ as input (single head, no batch dimension for simplicity)
   - Process $Q$ in blocks of $B_r$ rows and $K, V$ in blocks of $B_c$ rows
   - Use the online softmax trick to avoid materializing the $N \times N$ attention matrix
   - Return the output $O \in \mathbb{R}^{N \times d}$ and the log-sum-exp $L \in \mathbb{R}^{N}$ (for use in the backward pass)

2. **[4 points] Causal masking**: Add support for causal (autoregressive) attention. When enabled, the kernel should:
   - Skip K/V blocks that are entirely to the right of the current Q block
   - Apply the causal mask (set future positions to $-\infty$) for partially overlapping blocks

3. **[4 points] Correctness verification**: Verify against PyTorch's reference implementation:

```python
def reference_attention(Q, K, V, causal=False):
    """Reference attention for correctness testing."""
    d = Q.shape[-1]
    S = Q @ K.T / (d ** 0.5)
    if causal:
        N = Q.shape[0]
        mask = torch.triu(torch.ones(N, N, device=Q.device, dtype=torch.bool), diagonal=1)
        S.masked_fill_(mask, float('-inf'))
    P = torch.softmax(S, dim=-1)
    O = P @ V
    return O
```

   Test with:
   - $N = 1024, d = 64$, non-causal
   - $N = 2048, d = 128$, non-causal
   - $N = 4096, d = 128$, causal
   - $N = 8192, d = 64$, causal
   - Tolerance: `atol=1e-2` (FP16 accumulation introduces some error)

4. **[4 points] Performance benchmarking**: Benchmark your implementation against:
   - PyTorch manual attention (the reference implementation above)
   - `torch.nn.functional.scaled_dot_product_attention` (which uses Flash Attention internally)

   Report wall-clock time and peak memory for $N \in \{1024, 2048, 4096, 8192, 16384\}$ with $d = 128$. Plot:
   - Execution time vs. $N$ (log-log scale)
   - Peak memory vs. $N$ (log-log scale)

5. **[5 points] Analysis**: In your notebook, answer:
   - At what sequence length does your Flash Attention implementation become faster than the naive PyTorch implementation? Why?
   - What fraction of peak TFLOPS does your implementation achieve for $N = 4096$, $d = 128$? How does this compare to cuBLAS GEMM efficiency?
   - What are the main sources of inefficiency in your Triton implementation compared to the official Flash Attention CUDA kernel?

**Starter code**:

```python
@triton.jit
def flash_attention_forward_kernel(
    Q_ptr, K_ptr, V_ptr, O_ptr, L_ptr,
    stride_qn, stride_qd,
    stride_kn, stride_kd,
    stride_vn, stride_vd,
    stride_on, stride_od,
    N, D: tl.constexpr,
    BLOCK_R: tl.constexpr,   # Query block size
    BLOCK_C: tl.constexpr,   # KV block size
    IS_CAUSAL: tl.constexpr,
):
    """
    Flash Attention forward pass.

    Each program instance computes one BLOCK_R x D tile of the output O.

    Algorithm:
    1. Load Q_i (BLOCK_R x D) from HBM to SRAM
    2. Initialize O_i = 0, l_i = 0, m_i = -inf
    3. For each KV block j:
       a. Load K_j, V_j (BLOCK_C x D) from HBM to SRAM
       b. Compute S_ij = Q_i @ K_j^T (BLOCK_R x BLOCK_C)
       c. Apply causal mask if needed
       d. Update m_i, l_i, O_i using online softmax
    4. Write O_i, L_i (= m_i + log(l_i)) to HBM
    """
    # TODO: Implement
    pass

def flash_attention(Q, K, V, causal=False):
    """Wrapper for Flash Attention forward pass."""
    N, D = Q.shape
    O = torch.empty_like(Q)
    L = torch.empty(N, device=Q.device, dtype=torch.float32)

    BLOCK_R = 128
    BLOCK_C = 128

    grid = (triton.cdiv(N, BLOCK_R),)

    flash_attention_forward_kernel[grid](
        Q, K, V, O, L,
        Q.stride(0), Q.stride(1),
        K.stride(0), K.stride(1),
        V.stride(0), V.stride(1),
        O.stride(0), O.stride(1),
        N, D,
        BLOCK_R=BLOCK_R,
        BLOCK_C=BLOCK_C,
        IS_CAUSAL=causal,
    )
    return O, L
```

---

## Submission Checklist

- [ ] PDF with all Part A derivations (clearly labeled A1--A3, with sub-parts)
- [ ] CUDA C++ GEMM source files:
  - [ ] `gemm_v0_naive.cu`
  - [ ] `gemm_v1_smem.cu`
  - [ ] `gemm_v2_register.cu`
  - [ ] `gemm_v3_doublebuf.cu`
  - [ ] `gemm_v4_wmma.cu` (bonus)
  - [ ] `benchmark.cu` (host-side benchmarking + correctness)
  - [ ] `CMakeLists.txt` or `Makefile`
- [ ] `flash_attention_kernel.py`: Triton Flash Attention implementation
- [ ] `hw02.ipynb` or PDF report containing:
  - [ ] GEMM performance table (all versions vs. cuBLAS)
  - [ ] `ncu` profiling output for V2 or V3
  - [ ] Flash Attention correctness tests (all test cases passing)
  - [ ] Flash Attention performance comparison tables and plots
  - [ ] Written analysis (Problem B2.5)

---

## Grading Rubric

| Component | Points |
|-----------|:------:|
| A1: Tiled GEMM analysis | 15 |
| A2: Convolution algorithms | 15 |
| A3: Flash Attention IO complexity | 20 |
| B1: CUDA C++ GEMM (V0--V3 + analysis) | 25 |
| B1 bonus: V4 Tensor Core WMMA | +5 |
| B2: Triton Flash Attention | 25 |
| **Total** | **100** (+5 bonus) |

**Deductions**:
- Kernels that do not compile: 0 points for that problem
- Kernels that compile but fail correctness: partial credit (up to 50% of implementation points)
- Missing `ncu` profiling data: -5 points
- Missing analysis/plots: -5 points per missing item
- Code that is copied from external sources without citation: academic integrity violation
