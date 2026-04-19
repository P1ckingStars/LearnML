# Lecture 02a: Matrix Multiplication: Tiling, GEMM, and Tensor Cores

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Analyze** the arithmetic intensity and memory access patterns of naive matrix multiplication and explain why it is memory-bound on modern hardware.
2. **Derive** the data reuse factor of tiled/blocked GEMM and compute the optimal tile size given SRAM capacity constraints.
3. **Classify** BLAS operations by level (1/2/3) and explain why Level-3 BLAS achieves the highest fraction of peak FLOPS.
4. **Describe** the Goto & van de Geijn algorithm, including the micro-kernel abstraction and packing strategy for cache optimization.
5. **Explain** Tensor Core execution semantics (warp-level MMA operations, mixed-precision accumulation) and quantify the speedup over FP32 CUDA cores.

---

## 2. Motivation and Context

### 2.1 Why Matrix Multiplication Matters

Matrix multiplication is the single most important computational primitive in deep learning. A transformer forward pass is dominated by four GEMM calls per layer (Q/K/V projection, attention output projection, and two feed-forward layers). For a model with parameters $P$ and batch of $B$ tokens, the forward pass requires roughly $2BP$ FLOPs, nearly all of which are GEMMs.

On an NVIDIA H100 SXM, the peak FP16 throughput is 989 TFLOPS with Tensor Cores. A naive matmul implementation on the same hardware might achieve under 1% of this peak. The gap between naive and optimized GEMM is not a constant factor -- it is two orders of magnitude. Understanding *why* this gap exists and *how* it is closed is the core of this lecture.

### 2.2 The Arithmetic Intensity Argument

Recall from Module 00 the roofline model. An operation is:

- **Compute-bound** if its arithmetic intensity (AI) exceeds the machine balance point $\beta = \text{Peak FLOPS} / \text{Peak BW}$.
- **Memory-bound** if AI < $\beta$.

For an H100 with 989 TFLOPS (FP16) and 3.35 TB/s HBM bandwidth:

$$\beta = \frac{989 \times 10^{12}}{3.35 \times 10^{12}} \approx 295 \text{ FLOPs/byte}$$

Matrix multiplication of two $N \times N$ matrices requires $2N^3$ FLOPs and transfers $3N^2$ elements. In FP16, that is $6N^2$ bytes, giving:

$$\text{AI} = \frac{2N^3}{6N^2} = \frac{N}{3}$$

For $N = 4096$, $\text{AI} \approx 1365 \gg 295$. GEMM is compute-bound for any reasonably sized matrix. This means we *can* achieve near-peak FLOPS -- if we implement it correctly.

---

## 3. Naive Matrix Multiplication

### 3.1 The Algorithm

Given $A \in \mathbb{R}^{M \times K}$, $B \in \mathbb{R}^{K \times N}$, compute $C = AB$ where $C \in \mathbb{R}^{M \times N}$:

```c
// Naive matmul: C = A * B
for (int i = 0; i < M; i++) {
    for (int j = 0; j < N; j++) {
        float sum = 0.0f;
        for (int k = 0; k < K; k++) {
            sum += A[i * K + k] * B[k * N + j];
        }
        C[i * N + j] = sum;
    }
}
```

**Complexity**: $2MNK$ FLOPs (one multiply and one add per inner iteration).

### 3.2 Memory Access Analysis

Consider the innermost loop. For a fixed $(i, j)$:

- **A**: We access `A[i][0], A[i][1], ..., A[i][K-1]` -- a contiguous row. Good spatial locality.
- **B**: We access `B[0][j], B[1][j], ..., B[K-1][j]` -- stride-$N$ access down a column. Terrible spatial locality in row-major layout.

For the full computation, each element of $A$ is read $N$ times (once per column of $C$), and each element of $B$ is read $M$ times (once per row of $C$). Total memory traffic:

$$\text{Bytes}_{\text{naive}} = MKN \cdot \text{sizeof}(A_{ij}) + KNM \cdot \text{sizeof}(B_{kj}) + MN \cdot \text{sizeof}(C_{ij})$$

Wait -- that assumes no caching. With an infinitely large cache, we would load $A$ once ($MK$ elements), $B$ once ($KN$ elements), and write $C$ once ($MN$ elements). The ratio of achieved AI depends entirely on caching.

### 3.3 Cache Miss Analysis (Simplified)

Assume a fully-associative cache with $Z$ words capacity and cache line size $L$ words. For the naive 3-loop nest (ijk order):

- The inner loop streams through a row of $A$ (good) and a column of $B$ (bad).
- If $N > Z$, every access to $B$ is a cache miss because successive rows of $B$ evict each other.
- Total cache misses: $\Theta(MNK / L)$ -- essentially no reuse.

This is why naive matmul on large matrices achieves far below peak FLOPS. The data is re-fetched from DRAM on nearly every access.

---

## 4. Tiled (Blocked) GEMM

### 4.1 The Key Insight: Data Reuse

The fix is to reorganize computation so that a block of data, once loaded into fast memory (cache, shared memory, registers), is reused as many times as possible before being evicted.

Partition $A$, $B$, $C$ into blocks of size $T_M \times T_K$, $T_K \times T_N$, and $T_M \times T_N$ respectively:

$$C_{ij} = \sum_{p=0}^{K/T_K - 1} A_{ip} \cdot B_{pj}$$

where $A_{ip}$ is the $(i,p)$-th block of $A$, etc.

```c
// Tiled matmul
for (int i = 0; i < M; i += TM) {
    for (int j = 0; j < N; j += TN) {
        float C_tile[TM][TN] = {0};  // Stays in registers/L1
        for (int p = 0; p < K; p += TK) {
            float A_tile[TM][TK];  // Load into fast memory
            float B_tile[TK][TN];
            // Load A_tile from A[i:i+TM, p:p+TK]
            // Load B_tile from B[p:p+TK, j:j+TN]
            // Multiply-accumulate: C_tile += A_tile * B_tile
            for (int ii = 0; ii < TM; ii++)
                for (int jj = 0; jj < TN; jj++)
                    for (int kk = 0; kk < TK; kk++)
                        C_tile[ii][jj] += A_tile[ii][kk] * B_tile[kk][jj];
        }
        // Store C_tile to C[i:i+TM, j:j+TN]
    }
}
```

### 4.2 Data Reuse Analysis

For one iteration of the inner loop (one $(i, j, p)$ tile):

- **Loaded**: $T_M \cdot T_K + T_K \cdot T_N$ elements
- **Computed**: $2 \cdot T_M \cdot T_N \cdot T_K$ FLOPs

**Arithmetic intensity of the tile**:

$$\text{AI}_{\text{tile}} = \frac{2 \cdot T_M \cdot T_N \cdot T_K}{(T_M \cdot T_K + T_K \cdot T_N) \cdot \text{bytes/element}} = \frac{2 \cdot T_M \cdot T_N}{(T_M + T_N) \cdot \text{bytes/element}}$$

Note: the $T_K$ cancels. If $T_M = T_N = T$ and we use FP16 (2 bytes):

$$\text{AI}_{\text{tile}} = \frac{2T^2}{2T \cdot 2} = \frac{T}{2}$$

For $T = 128$: $\text{AI} = 64$ FLOPs/byte. For $T = 256$: $\text{AI} = 128$ FLOPs/byte. We need the tiles to fit in SRAM (shared memory on GPU, typically 48--228 KB per SM on modern GPUs).

### 4.3 Optimal Tile Size

The constraint is that both tiles must fit in SRAM of size $S_{\text{SRAM}}$ bytes:

$$(T_M \cdot T_K + T_K \cdot T_N) \cdot \text{bytes/element} \le S_{\text{SRAM}}$$

For the symmetric case $T_M = T_N = T$ with FP16:

$$2 T_K (T + T) = 4 T \cdot T_K \le S_{\text{SRAM}}$$

If $T_K = T$: $4T^2 \le S_{\text{SRAM}}$, so $T \le \sqrt{S_{\text{SRAM}} / 4}$. For $S_{\text{SRAM}} = 192$ KB = 196608 bytes:

$$T \le \sqrt{49152} \approx 221$$

In practice, we use powers of 2: $T = 128$ is common, giving tile memory usage of $4 \times 128^2 = 65536$ bytes = 64 KB, well within budget and leaving room for the output tile accumulator.

### 4.4 Total HBM Traffic with Tiling

Over all tiles, each block of $A$ (size $T_M \times T_K$) is loaded $N / T_N$ times (once for each column-block of $B$). Each block of $B$ (size $T_K \times T_N$) is loaded $M / T_M$ times. Total HBM reads:

$$\text{Bytes}_{\text{tiled}} = MK \cdot \frac{N}{T_N} + KN \cdot \frac{M}{T_M} = MKN \left(\frac{1}{T_N} + \frac{1}{T_M}\right)$$

in units of elements. Compare with naive ($MKN + MKN = 2MKN$ element-reads for each of $A$ and $B$, i.e., each element read $O(N)$ times). Tiling reduces total traffic by a factor of $\min(T_M, T_N)$.

---

## 5. The BLAS Hierarchy

### 5.1 Levels

The Basic Linear Algebra Subprograms (BLAS) are organized by the dimensionality of data they touch:

| Level | Operations | FLOPs | Data | AI |
|-------|-----------|-------|------|------|
| 1 | $\alpha x + y$ (axpy), dot product | $O(n)$ | $O(n)$ | $O(1)$ |
| 2 | $Ax + y$ (gemv), triangular solve | $O(n^2)$ | $O(n^2)$ | $O(1)$ |
| 3 | $AB + C$ (gemm), triangular matmul | $O(n^3)$ | $O(n^2)$ | $O(n)$ |

The key insight: only Level-3 BLAS has arithmetic intensity that grows with problem size. This is why deep learning frameworks and compilers aggressively fuse operations into GEMMs -- it is the only way to keep the hardware busy.

### 5.2 cuBLAS GEMM

NVIDIA's cuBLAS provides `cublasGemmEx`, the workhorse GEMM routine:

$$C = \alpha \cdot \text{op}(A) \cdot \text{op}(B) + \beta \cdot C$$

where $\text{op}$ is identity or transpose. Key parameters:

- **Compute type**: FP16, BF16, FP32, TF32, FP8
- **Algorithm selection**: cuBLAS maintains a heuristic table mapping $(M, N, K, \text{datatype})$ to the best kernel
- **Batched/strided variants** for attention and grouped operations

```python
import torch

# cuBLAS is called implicitly
A = torch.randn(4096, 4096, device='cuda', dtype=torch.float16)
B = torch.randn(4096, 4096, device='cuda', dtype=torch.float16)

# This dispatches to cublasGemmEx under the hood
C = A @ B

# For batched GEMM (e.g., multi-head attention)
# batch=32, heads=128, seq_len=512, head_dim=64
A_batched = torch.randn(32 * 128, 512, 64, device='cuda', dtype=torch.float16)
B_batched = torch.randn(32 * 128, 64, 512, device='cuda', dtype=torch.float16)
C_batched = torch.bmm(A_batched, B_batched)
```

---

## 6. The Goto & van de Geijn Algorithm

### 6.1 Overview

The seminal paper by Goto & van de Geijn (2008) describes how high-performance BLAS libraries (OpenBLAS, BLIS) achieve near-peak FLOPS on CPUs. The ideas directly inform GPU GEMM design.

The algorithm decomposes GEMM into a hierarchy of loops, each targeting a specific level of the memory hierarchy:

```
Loop 5 (jc): Partition B into column panels     → fits in L3
  Loop 4 (ic): Partition A into row panels       → fits in L2
    Loop 3 (kc): Partition into blocks           → fits in L1
      Pack A block into contiguous buffer (A_pack)
      Pack B panel into contiguous buffer (B_pack)
      Loop 2 (jr): Partition B_pack into slivers → fits in registers
        Loop 1 (ir): Partition A_pack into slivers
          MICRO-KERNEL: multiply A_sliver x B_sliver
```

### 6.2 The Micro-Kernel

The innermost computation is the **micro-kernel**: a fixed-size matrix multiply-accumulate, typically $m_r \times n_r$ (e.g., $6 \times 16$ on AVX-512, $16 \times 16$ on GPU Tensor Cores).

The micro-kernel:
- Keeps the $m_r \times n_r$ output tile permanently in registers
- Streams $m_r \times 1$ column of $A$ and $1 \times n_r$ row of $B$ from L1 cache
- Performs $m_r \times n_r$ FMA (fused multiply-add) operations per step

The register tile must satisfy:

$$m_r \cdot n_r + m_r + n_r \le R$$

where $R$ is the number of available vector registers. On AVX-512 with 32 registers of 16 floats each, $m_r = 6, n_r = 16$ uses $96 + 6 + 16 = 118$ register slots (with packing).

### 6.3 Packing for Contiguous Access

A critical step: before the micro-kernel runs, blocks of $A$ and $B$ are **packed** into contiguous buffers in an order that matches the micro-kernel's access pattern. This eliminates TLB misses and ensures every cache line is fully utilized.

Without packing, accessing a $T_M \times T_K$ submatrix of $A$ (which has leading dimension $K$, potentially very large) causes stride-$K$ accesses that thrash the TLB. Packing converts this into a sequential scan.

### 6.4 Mapping to GPU

On GPUs, the same hierarchy maps to the hardware:

| CPU Level | GPU Level | Memory |
|-----------|-----------|--------|
| L3 partition | Thread block tile | Shared memory (SMEM) |
| L2/L1 partition | Warp tile | Register file |
| Micro-kernel | Tensor Core MMA | Registers |
| Packing | Shared memory bank-conflict-free layout | SMEM |

A modern GPU GEMM kernel (e.g., CUTLASS):

1. Each **thread block** computes a $T_M \times T_N$ tile of $C$
2. Tiles of $A$ and $B$ are loaded from HBM to shared memory (global $\to$ SMEM)
3. Each **warp** computes a $W_M \times W_N$ sub-tile using Tensor Core instructions
4. Warps load from shared memory to registers (SMEM $\to$ registers)
5. **Double buffering**: while computing on one tile, the next tile is loaded asynchronously

---

## 7. Tensor Cores

### 7.1 What They Are

Tensor Cores are specialized hardware units on NVIDIA GPUs (Volta and later) that perform matrix multiply-accumulate (MMA) on small fixed-size matrices in a single clock cycle. They operate at the warp level (32 threads cooperating).

**Volta/Turing (SM70/SM75)**:
$$D = A \cdot B + C, \quad A \in \text{FP16}^{16 \times 16},\; B \in \text{FP16}^{16 \times 16},\; C, D \in \text{FP16 or FP32}^{16 \times 16}$$

At the hardware level, individual Tensor Core units process $4 \times 4$ sub-tiles, but the programmer-visible PTX instruction is `mma.sync.m8n8k4`, which operates on $8 \times 8 \times 4$ tiles. The higher-level `wmma` API exposes $16 \times 16 \times 16$ tiles distributed across a warp by composing multiple `mma.sync` instructions.

**Ampere (SM80)**: Adds TF32, BF16, INT8, binary
**Hopper (SM90)**: Adds FP8 (E4M3, E5M2), warp-group MMA (128 threads)

### 7.2 Performance Numbers

| GPU | FP32 CUDA Cores | FP16 Tensor Cores | Speedup |
|-----|:----:|:----:|:----:|
| V100 | 15.7 TFLOPS | 125 TFLOPS | 8x |
| A100 | 19.5 TFLOPS | 312 TFLOPS | 16x |
| H100 | 67 TFLOPS | 989 TFLOPS | 15x |

Tensor Cores are not optional -- they are the only way to achieve peak throughput.

### 7.3 WMMA API

The warp-level matrix multiply-accumulate (WMMA) API in CUDA:

```cuda
#include <mma.h>
using namespace nvcuda;

// Declare fragments (distributed across 32 threads in a warp)
wmma::fragment<wmma::matrix_a, 16, 16, 16, half, wmma::row_major> a_frag;
wmma::fragment<wmma::matrix_b, 16, 16, 16, half, wmma::col_major> b_frag;
wmma::fragment<wmma::accumulator, 16, 16, 16, float> c_frag;

// Initialize accumulator
wmma::fill_fragment(c_frag, 0.0f);

// Load tiles from shared memory
wmma::load_matrix_sync(a_frag, A_smem + warp_row * 16, K_tile);
wmma::load_matrix_sync(b_frag, B_smem + warp_col * 16, K_tile);

// Matrix multiply-accumulate: c_frag += a_frag * b_frag
wmma::mma_sync(c_frag, a_frag, b_frag, c_frag);

// Store result back to shared memory or global memory
wmma::store_matrix_sync(C_smem + warp_row * 16 * N + warp_col * 16,
                        c_frag, N, wmma::mem_row_major);
```

Key points:
- Fragments are **opaque** -- you don't control which thread holds which element.
- The `mma_sync` call is a **warp-synchronous** operation: all 32 threads must participate.
- Mixed precision: inputs in FP16, accumulation in FP32. This is critical for training stability.

### 7.4 Hopper: Warp Group MMA and TMA

On the H100 (SM90), NVIDIA introduced two major improvements:

1. **Warp Group MMA (wgmma)**: Four warps (128 threads) cooperate on a single large MMA, e.g., $64 \times 256 \times 16$. This amortizes instruction overhead and improves occupancy.

2. **Tensor Memory Accelerator (TMA)**: A dedicated hardware unit that loads multi-dimensional tiles from global memory to shared memory without consuming thread resources. The TMA handles address computation, bounds checking, and data layout transformation.

```
// Pseudocode for Hopper GEMM pattern
// 1. TMA issues async global->smem loads (no thread involvement)
// 2. Warp group MMA operates on smem tiles
// 3. Pipeline: load tile[i+1] while computing on tile[i]
```

The combination of TMA + wgmma allows Hopper to achieve >80% of peak TFLOPS on large GEMMs, compared to ~70% on Ampere.

---

## 8. Achieving Peak FLOPS: A Performance Analysis

### 8.1 The Performance Model

For a GEMM of dimensions $(M, N, K)$ with tile sizes $(T_M, T_N, T_K)$, the execution time is:

$$t = \max\left(\frac{2MNK}{\text{Peak FLOPS}},\; \frac{\text{HBM bytes}}{\text{BW}_{\text{HBM}}},\; \frac{\text{SMEM bytes}}{\text{BW}_{\text{SMEM}}}\right) + t_{\text{overhead}}$$

The three terms represent the compute, HBM bandwidth, and shared memory bandwidth limits.

### 8.2 Worked Example: H100 GEMM

**Problem**: $M = N = K = 4096$, FP16, H100 SXM.

**Compute time**:
$$t_{\text{compute}} = \frac{2 \times 4096^3}{989 \times 10^{12}} = \frac{137.4 \times 10^{9}}{989 \times 10^{12}} \approx 0.139 \text{ ms}$$

**HBM traffic** (with tiling, $T_M = T_N = 128$):
$$\text{Bytes} = 2 \times (MK + KN + MN) = 2 \times 3 \times 4096^2 \approx 100.7 \text{ MB}$$

(The minimum: read $A$ and $B$ once, write $C$ once.)

$$t_{\text{HBM}} = \frac{100.7 \times 10^6}{3.35 \times 10^{12}} \approx 0.030 \text{ ms}$$

Since $t_{\text{compute}} \gg t_{\text{HBM}}$, this GEMM is firmly compute-bound. The theoretical time is 0.139 ms. A well-optimized kernel (cuBLAS, CUTLASS) achieves 0.15--0.17 ms, or roughly 80--90% of peak.

### 8.3 When GEMM Becomes Memory-Bound

GEMM is not always compute-bound. Consider:
- **Tall-skinny**: $M = 4096, K = 4096, N = 1$ (matrix-vector product). AI $= O(1)$. This is Level-2 BLAS.
- **Small batch inference**: $M = 1, K = 4096, N = 4096$. Same issue.
- **Very small tiles**: If SRAM is too small to hold useful tiles, AI drops.

The transition point for FP16 on H100: $\text{AI} = N/3 > 295 \implies N > 885$. For $N < 885$, GEMM is memory-bound.

### 8.4 Software Pipelining

To hide latency, modern GPU GEMM kernels use **multi-stage pipelining** (also called "software pipelining" or "double/triple buffering"):

```
Stage 0: Load tile[0] from HBM -> SMEM buffer A
Stage 1: Load tile[1] from HBM -> SMEM buffer B  |  Compute on tile[0] from buffer A
Stage 2: Load tile[2] from HBM -> SMEM buffer A  |  Compute on tile[1] from buffer B
Stage 3: Load tile[3] from HBM -> SMEM buffer B  |  Compute on tile[2] from buffer A
...
```

CUTLASS 3.x supports up to 7-stage pipelines on Hopper, using the asynchronous copy (`cp.async`) and TMA features to overlap computation and memory access almost perfectly.

---

## 9. CUTLASS: Template-Based GEMM Library

### 9.1 Architecture

CUTLASS (CUDA Templates for Linear Algebra Subroutines) is NVIDIA's open-source library for writing high-performance GEMM kernels. It exposes the tiling hierarchy as C++ template parameters:

```cpp
// CUTLASS GEMM configuration (simplified)
using GemmKernel = cutlass::gemm::device::Gemm<
    cutlass::half_t,                    // Element type A
    cutlass::layout::RowMajor,          // Layout A
    cutlass::half_t,                    // Element type B
    cutlass::layout::ColumnMajor,       // Layout B
    cutlass::half_t,                    // Element type C
    cutlass::layout::RowMajor,          // Layout C
    float,                              // Accumulator type
    cutlass::arch::OpClassTensorOp,     // Use Tensor Cores
    cutlass::arch::Sm80,                // Target SM80 (Ampere)
    cutlass::gemm::GemmShape<128, 128, 32>,  // Thread block tile (TM, TN, TK)
    cutlass::gemm::GemmShape<64, 64, 32>,    // Warp tile (WM, WN, WK)
    cutlass::gemm::GemmShape<16, 8, 16>      // MMA instruction shape
>;
```

### 9.2 Tile Size Selection

The thread block tile $(128, 128, 32)$ means:
- Each thread block computes a $128 \times 128$ tile of $C$
- It iterates over the $K$ dimension in chunks of 32
- Shared memory per block: $(128 \times 32 + 32 \times 128) \times 2 = 16$ KB (FP16)
- With double buffering: 32 KB
- Arithmetic per tile step: $2 \times 128 \times 128 \times 32 = 1.05$ M FLOPs

The warp tile $(64, 64, 32)$ means each of the 4 warps in the block handles a $64 \times 64$ sub-tile.

---

## 10. Practical Considerations

### 10.1 Matrix Dimensions and Padding

Tensor Cores require dimensions to be multiples of 8 (FP16) or 16 (INT8). cuBLAS automatically handles padding, but at a performance cost. When possible, design your model dimensions to be multiples of 64 or 128:

```python
# Bad: d_model = 768 (not a multiple of 128)
# Better: d_model = 768 works but wastes some Tensor Core cycles
# Best: d_model = 1024 or 2048 (power-of-2, multiple of 128)
```

### 10.2 Memory Layout Matters

Row-major vs. column-major layout affects which GEMM variant cuBLAS selects. PyTorch tensors are row-major (C-contiguous) by default. The operation `C = A @ B` with row-major tensors is equivalent to computing `C^T = B^T @ A^T` with column-major tensors, which is what cuBLAS actually executes (cuBLAS assumes column-major by default).

### 10.3 TF32: The Free Lunch

TF32 (TensorFloat-32) uses the range of FP32 (8 exponent bits) with the precision of FP16 (10 mantissa bits), stored in 19 bits internally. On Ampere and later:

- `torch.backends.cuda.matmul.allow_tf32 = True` (default since PyTorch 2.0)
- FP32 inputs are implicitly rounded to TF32 before Tensor Core execution
- 8x faster than FP32 CUDA cores, negligible accuracy loss for training

---

## Key Takeaways

1. GEMM has arithmetic intensity $O(N)$, making it compute-bound for large matrices. This is uniquely favorable among linear algebra operations.
2. Tiling transforms memory access from $O(MKN)$ per element to $O(MKN/T)$, where $T$ is the tile size limited by SRAM capacity.
3. The Goto-van de Geijn algorithm provides the blueprint for all modern GEMM implementations: a hierarchy of loops mapping to the memory hierarchy, with a register-resident micro-kernel at the core.
4. Tensor Cores provide 8--16x speedup over CUDA cores by executing fixed-size MMA operations at the warp level with mixed-precision accumulation.
5. Achieving >80% of peak FLOPS requires careful orchestration: tile size selection, memory pipelining, bank-conflict-free shared memory layout, and dimension alignment.

---

## Further Reading

1. **Goto, K. & van de Geijn, R.A.** (2008). "Anatomy of High-Performance Matrix Multiplication." *ACM Transactions on Mathematical Software*, 34(3).
2. **NVIDIA CUTLASS**. [github.com/NVIDIA/cutlass](https://github.com/NVIDIA/cutlass). Template-based GEMM library with extensive documentation.
3. **Jia, Z. et al.** (2018). "Dissecting the NVIDIA Volta GPU Architecture via Microbenchmarking." *arXiv:1804.06826*.
4. **Huang, J. et al.** (2024). "CUTLASS 3.x: Warp-Specialized GEMM for Hopper." NVIDIA GTC.
5. **Kerr, A. et al.** (2017). "CUTLASS: Fast Linear Algebra in CUDA C++." NVIDIA Developer Blog.
6. **Dongarra, J. et al.** (1990). "A Set of Level 3 Basic Linear Algebra Subprograms." *ACM TOMS*, 16(1).
