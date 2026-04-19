# Lecture 02c: CUDA C++ Kernel Optimization

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Write** CUDA C++ GEMM kernels at five optimization levels: naive, shared memory tiling, register blocking, double buffering, and Tensor Core (WMMA).
2. **Explain** how each optimization reduces memory traffic or increases compute throughput, using arithmetic intensity as the guiding metric.
3. **Diagnose** bank conflicts in shared memory layouts and apply the padding trick to eliminate them.
4. **Use** the CUDA occupancy API to choose block dimensions that maximize SM utilization.
5. **Compare** CUDA C++ and Triton, identifying when each is the appropriate tool.

---

## 2. Motivation: Why CUDA C++

### 2.1 When Triton Abstracts Too Much

Triton (Lecture 02c-alt / HW02 Flash Attention) is excellent for rapid prototyping of fused, memory-bound kernels. Its block-level programming model hides thread management, shared memory allocation, and synchronization. However, this abstraction becomes a limitation when you need:

- **Fine-grained warp-level control**: custom MMA instruction selection, warp shuffle reductions, warp-specialized pipelines (e.g., Hopper TMA + warp-group MMA).
- **Exact shared memory layout**: controlling bank-conflict-free access patterns, swizzled layouts for Tensor Core fragments.
- **Integration with CUDA libraries**: interleaving custom kernels with cuBLAS, cuDNN, or NCCL calls in the same stream.
- **Maximum performance**: production GEMM libraries (CUTLASS, cuBLAS) are written in CUDA C++ and squeeze the last 5--15% of peak throughput that Triton leaves on the table.

### 2.2 The HW02 Progression

HW02 asks you to implement a GEMM kernel at five optimization levels:

| Version | Technique | Expected % of cuBLAS (M=N=K=4096, FP32) |
|---------|-----------|:----------------------------------------:|
| V0 | Naive (one element per thread) | ~1--3% |
| V1 | Shared memory tiling | ~10--15% |
| V2 | Register blocking (thread tiling) | ~40--60% |
| V3 | Double buffering | ~55--70% |
| V4 | WMMA Tensor Cores (FP16) | ~70--85% |

This lecture teaches the C++ patterns for each level.

---

## 3. CUDA Memory Hierarchy Review

See Lecture 00b for a full treatment. Here we summarize the numbers relevant to kernel optimization on an A100:

| Memory | Capacity | Bandwidth | Latency |
|--------|:--------:|:---------:|:-------:|
| HBM (global) | 80 GB | ~2.0 TB/s | ~400 cycles |
| L2 cache | 40 MB | ~5 TB/s | ~200 cycles |
| L1 / shared (per SM) | 192 KB configurable | ~19 TB/s | ~30 cycles |
| Registers (per SM) | 256 KB | -- | 0 cycles |

The optimization strategy is simple: move data from slow memory to fast memory, reuse it as many times as possible, and keep the arithmetic units busy while memory transactions are in flight.

---

## 4. Shared Memory Tiling (V1)

### 4.1 The Naive Baseline (V0)

Each thread computes one element of $C$:

```cpp
// V0: Naive GEMM -- one element per thread
__global__ void gemm_naive(const float* A, const float* B, float* C,
                           int M, int N, int K) {
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    int col = blockIdx.x * blockDim.x + threadIdx.x;

    if (row < M && col < N) {
        float acc = 0.0f;
        for (int k = 0; k < K; ++k) {
            acc += A[row * K + k] * B[k * N + col];
        }
        C[row * N + col] = acc;
    }
}

// Launch: dim3 block(32, 32); dim3 grid(ceil(N,32), ceil(M,32));
```

**Problem**: Each element of $A$ and $B$ is loaded from global memory $N$ and $M$ times, respectively. Total global memory traffic: $2MNK \times 4$ bytes. Arithmetic intensity:

$$\text{AI}_{\text{naive}} = \frac{2MNK}{(2MNK) \times 4} = 0.25 \;\text{FLOPs/byte}$$

This is far below the machine balance of ~100 FLOPs/byte (A100), so the kernel is heavily memory-bound.

### 4.2 Tiled GEMM with Shared Memory

The idea: load a $T \times T$ tile of $A$ and a $T \times T$ tile of $B$ into shared memory, then compute a partial $T \times T$ block of $C$. Each element loaded from global memory is reused $T$ times.

```cpp
// V1: Shared memory tiled GEMM
#define TILE 32

__global__ void gemm_tiled(const float* A, const float* B, float* C,
                           int M, int N, int K) {
    __shared__ float As[TILE][TILE];
    __shared__ float Bs[TILE][TILE];

    int row = blockIdx.y * TILE + threadIdx.y;
    int col = blockIdx.x * TILE + threadIdx.x;

    float acc = 0.0f;

    for (int t = 0; t < (K + TILE - 1) / TILE; ++t) {
        // --- Load tiles from global to shared memory ---
        int a_col = t * TILE + threadIdx.x;
        int b_row = t * TILE + threadIdx.y;

        // Boundary masking: load 0 if out of bounds
        As[threadIdx.y][threadIdx.x] =
            (row < M && a_col < K) ? A[row * K + a_col] : 0.0f;
        Bs[threadIdx.y][threadIdx.x] =
            (b_row < K && col < N) ? B[b_row * N + col] : 0.0f;

        __syncthreads();

        // --- Compute partial dot product from shared memory ---
        for (int k = 0; k < TILE; ++k) {
            acc += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        }

        __syncthreads();
    }

    if (row < M && col < N) {
        C[row * N + col] = acc;
    }
}

// Launch: dim3 block(TILE, TILE); dim3 grid(ceil(N,TILE), ceil(M,TILE));
```

### 4.3 Why This Helps

**Coalesced global loads**: Thread $(ty, tx)$ loads `A[row][t*TILE + tx]`. Adjacent threads in a warp (consecutive `tx` values) access consecutive memory addresses -- this is a coalesced 128-byte transaction. Similarly for `B`.

**Reuse factor**: Each float loaded into shared memory is read $T = 32$ times during the inner `k` loop. Arithmetic intensity improves to:

$$\text{AI}_{\text{tiled}} = \frac{2T^3}{2 \times T^2 \times 4} = \frac{T}{4} = 8 \;\text{FLOPs/byte}$$

This is 32x better than naive but still below the A100 machine balance. We need register blocking to go further.

---

## 5. Register Blocking / Thread Tiling (V2)

### 5.1 Concept

Instead of each thread computing one element of $C$, each thread computes a $TM \times TN$ sub-tile. The thread loads $TM$ values from one column of the shared-memory $A$ tile and $TN$ values from one row of the shared-memory $B$ tile into registers, then performs $TM \times TN$ FMAs.

**Arithmetic intensity of the inner loop**: $TM \times TN$ FMAs from $TM + TN$ shared memory reads:

$$\text{AI}_{\text{register}} = \frac{2 \cdot TM \cdot TN}{(TM + TN) \times 4} \;\text{FLOPs/byte}$$

For $TM = TN = 8$: AI = $128 / 64 = 2$ FLOPs/byte from shared memory, which is easily served by L1/shared bandwidth. The bottleneck shifts to global memory, where the block-level reuse is now $BM$ or $BN$ (the block tile dimensions), giving AI $\approx BM/4$ from HBM.

### 5.2 Full Implementation

```cpp
// V2: Register-blocked GEMM
// Block tile: BM x BN output, iterated over BK slices of K
// Thread tile: TM x TN output per thread
// Block has (BM/TM) x (BN/TN) threads

#define BM 128
#define BN 128
#define BK 8
#define TM 8
#define TN 8

__global__ void gemm_register_blocked(
    const float* A, const float* B, float* C,
    int M, int N, int K)
{
    __shared__ float As[BK][BM];  // transposed for bank-conflict-free access
    __shared__ float Bs[BK][BN];

    // Thread position within the block
    const int tx = threadIdx.x;  // 0..BN/TN-1
    const int ty = threadIdx.y;  // 0..BM/TM-1

    // Starting row/col of this block's output tile
    const int brow = blockIdx.y * BM;
    const int bcol = blockIdx.x * BN;

    // Register accumulator
    float acc[TM][TN] = {};   // zero-initialized

    // Registers for the current A-column and B-row slice
    float a_reg[TM];
    float b_reg[TN];

    // Total threads in block
    const int num_threads = (BM / TM) * (BN / TN);
    const int tid = ty * (BN / TN) + tx;

    for (int bk = 0; bk < K; bk += BK) {
        // --- Cooperative load of A tile (BM x BK) into As[BK][BM] ---
        // Each thread loads multiple elements to cover BM*BK with num_threads
        for (int i = tid; i < BM * BK; i += num_threads) {
            int smem_k = i / BM;
            int smem_m = i % BM;
            int gm_row = brow + smem_m;
            int gm_col = bk + smem_k;
            As[smem_k][smem_m] =
                (gm_row < M && gm_col < K) ? A[gm_row * K + gm_col] : 0.0f;
        }

        // --- Cooperative load of B tile (BK x BN) into Bs[BK][BN] ---
        for (int i = tid; i < BK * BN; i += num_threads) {
            int smem_k = i / BN;
            int smem_n = i % BN;
            int gm_row = bk + smem_k;
            int gm_col = bcol + smem_n;
            Bs[smem_k][smem_n] =
                (gm_row < K && gm_col < N) ? B[gm_row * N + gm_col] : 0.0f;
        }

        __syncthreads();

        // --- Compute: outer product accumulation ---
        for (int k = 0; k < BK; ++k) {
            // Load TM elements of A from shared memory into registers
            for (int m = 0; m < TM; ++m) {
                a_reg[m] = As[k][ty * TM + m];
            }
            // Load TN elements of B from shared memory into registers
            for (int n = 0; n < TN; ++n) {
                b_reg[n] = Bs[k][tx * TN + n];
            }
            // Rank-1 update: TM x TN outer product
            for (int m = 0; m < TM; ++m) {
                for (int n = 0; n < TN; ++n) {
                    acc[m][n] += a_reg[m] * b_reg[n];
                }
            }
        }

        __syncthreads();
    }

    // --- Store results to global memory ---
    for (int m = 0; m < TM; ++m) {
        for (int n = 0; n < TN; ++n) {
            int grow = brow + ty * TM + m;
            int gcol = bcol + tx * TN + n;
            if (grow < M && gcol < N) {
                C[grow * N + gcol] = acc[m][n];
            }
        }
    }
}

// Launch: dim3 block(BN/TN, BM/TM); dim3 grid(ceil(N,BN), ceil(M,BM));
// block = (16, 16) = 256 threads; each computes 8x8 = 64 outputs
```

### 5.3 Why This is Fast

Each thread performs $TM \times TN \times BK = 8 \times 8 \times 8 = 512$ FMAs per iteration of the outer `bk` loop. The shared memory reads per thread are $BK \times (TM + TN) = 8 \times 16 = 128$ floats = 512 bytes. Thus:

$$\text{AI}_{\text{smem}} = \frac{1024}{512} = 2.0 \;\text{FLOPs/byte (shared)}$$

From global memory, the block loads $BM \times BK + BK \times BN = 2 \times 128 \times 8 = 2048$ floats (8192 bytes) and computes $2 \times BM \times BN \times BK = 2 \times 128 \times 128 \times 8 = 262144$ FLOPs:

$$\text{AI}_{\text{global}} = \frac{262144}{8192} = 32.0 \;\text{FLOPs/byte}$$

This is approaching the A100 machine balance, so the kernel becomes compute-bound for large matrices.

---

## 6. Double Buffering / Software Pipelining (V3)

### 6.1 The Problem

In V2, threads must wait for `__syncthreads()` after loading shared memory before computing, and again after computing before loading the next tile. The compute units sit idle during memory loads, and vice versa. The timeline looks like:

```
Load tile 0 | sync | Compute tile 0 | sync | Load tile 1 | sync | Compute tile 1 | ...
```

### 6.2 The Ping-Pong Buffer Pattern

Allocate two shared memory buffers. While computing on buffer 0, load the next tile into buffer 1. Then swap.

```cpp
// V3: Double-buffered GEMM (key structure -- same tile/thread params as V2)
__global__ void gemm_double_buffered(
    const float* A, const float* B, float* C,
    int M, int N, int K)
{
    __shared__ float As[2][BK][BM];   // two sets of buffers
    __shared__ float Bs[2][BK][BN];

    // ... (thread/block indexing same as V2) ...
    float acc[TM][TN] = {};
    float a_reg[TM], b_reg[TN];
    int buf = 0;

    // --- Prefetch first tile into buffer 0 ---
    load_tile(As[0], Bs[0], A, B, /*bk=*/0, ...);
    __syncthreads();

    for (int t = 0; t < num_tiles; ++t) {
        int next = 1 - buf;

        // Load NEXT tile into alternate buffer (concurrent with compute)
        if (t + 1 < num_tiles)
            load_tile(As[next], Bs[next], A, B, (t+1)*BK, ...);

        // Compute on CURRENT buffer
        for (int k = 0; k < BK; ++k) {
            for (int m = 0; m < TM; ++m) a_reg[m] = As[buf][k][ty*TM+m];
            for (int n = 0; n < TN; ++n) b_reg[n] = Bs[buf][k][tx*TN+n];
            for (int m = 0; m < TM; ++m)
                for (int n = 0; n < TN; ++n)
                    acc[m][n] += a_reg[m] * b_reg[n];
        }

        __syncthreads();
        buf = next;   // swap buffers
    }

    // Store results (same as V2)
    store_tile(C, acc, ...);
}
```

### 6.3 How This Hides Latency

The key insight is that global memory loads and shared memory arithmetic can happen concurrently on different hardware units (load/store units vs. FP32 cores). With double buffering, the timeline becomes:

```
[Load tile 1 into buf_next]   overlapped with   [Compute tile 0 from buf_curr]
sync
[Load tile 2 into buf_curr]   overlapped with   [Compute tile 1 from buf_next]
sync
...
```

The `__syncthreads()` now only waits for both the load and compute of the current iteration to finish before swapping. If compute time >= load time (i.e., the kernel is compute-bound), the load latency is fully hidden.

On Ampere+ GPUs (sm_80+), replace the cooperative loads with `cp.async` (`__pipeline_memcpy_async`), which bypasses registers entirely and transfers data directly from global to shared memory via the async copy engine. This frees registers and further decouples load from compute.

---

## 7. Tensor Cores via WMMA (V4)

### 7.1 What Are Tensor Cores?

Tensor Cores are specialized matrix multiply-accumulate units that compute $D = A \times B + C$ on small matrix fragments (e.g., $16 \times 16 \times 16$) in a single instruction. On an A100, each Tensor Core performs 256 FP16 FMAs per cycle, giving 312 TFLOPS FP16 vs. 19.5 TFLOPS FP32 on the CUDA cores -- a 16x throughput advantage.

### 7.2 The WMMA API

CUDA provides the `nvcuda::wmma` namespace for portable Tensor Core programming:

```cpp
#include <mma.h>
using namespace nvcuda;

// Fragment types (warp-wide; all 32 threads in a warp cooperate)
wmma::fragment<wmma::matrix_a, 16, 16, 16, half, wmma::row_major> a_frag;
wmma::fragment<wmma::matrix_b, 16, 16, 16, half, wmma::row_major> b_frag;
wmma::fragment<wmma::accumulator, 16, 16, 16, float> c_frag;

// Initialize accumulator to zero
wmma::fill_fragment(c_frag, 0.0f);

// Load fragments from shared or global memory (pointer + leading dimension)
wmma::load_matrix_sync(a_frag, shared_A_ptr, lda);
wmma::load_matrix_sync(b_frag, shared_B_ptr, ldb);

// Matrix multiply-accumulate: c_frag += a_frag * b_frag
wmma::mma_sync(c_frag, a_frag, b_frag, c_frag);

// Store result back to memory
wmma::store_matrix_sync(output_ptr, c_frag, ldc, wmma::mem_row_major);
```

### 7.3 Complete WMMA GEMM Kernel

```cpp
// V4: WMMA Tensor Core GEMM
// Each warp computes a WMMA_M x WMMA_N tile using 16x16x16 fragments
// Block tile: BM x BN, with warps tiled across it

#include <mma.h>
using namespace nvcuda;

#define BM_TC   128
#define BN_TC   128
#define BK_TC   16
#define WMMA_M  16
#define WMMA_N  16
#define WMMA_K  16
#define WARP_SIZE 32

__global__ void gemm_wmma(
    const half* A, const half* B, float* C,
    int M, int N, int K)
{
    // Shared memory for tiles
    __shared__ half As[BK_TC][BM_TC];   // K-major for A
    __shared__ half Bs[BK_TC][BN_TC];   // K-major for B

    // Warp and lane identification
    const int warpId = threadIdx.x / WARP_SIZE;
    const int laneId = threadIdx.x % WARP_SIZE;
    const int nWarps = blockDim.x / WARP_SIZE;

    // Map warps to WMMA tiles within the block
    const int warps_per_row = BN_TC / WMMA_N;   // e.g., 128/16 = 8
    const int warp_row = warpId / warps_per_row;
    const int warp_col = warpId % warps_per_row;

    // Block starting position
    const int brow = blockIdx.y * BM_TC;
    const int bcol = blockIdx.x * BN_TC;

    // Declare WMMA fragments
    wmma::fragment<wmma::matrix_a, WMMA_M, WMMA_N, WMMA_K,
                   half, wmma::col_major> a_frag;
    wmma::fragment<wmma::matrix_b, WMMA_M, WMMA_N, WMMA_K,
                   half, wmma::row_major> b_frag;
    wmma::fragment<wmma::accumulator, WMMA_M, WMMA_N, WMMA_K, float> c_frag;

    wmma::fill_fragment(c_frag, 0.0f);

    // Iterate over K dimension
    for (int bk = 0; bk < K; bk += BK_TC) {
        // --- Cooperative load into shared memory ---
        // All threads participate; each loads multiple elements
        for (int i = threadIdx.x; i < BM_TC * BK_TC; i += blockDim.x) {
            int sm = i % BM_TC, sk = i / BM_TC;
            int gr = brow + sm, gc = bk + sk;
            As[sk][sm] = (gr < M && gc < K) ? A[gr * K + gc] : __float2half(0.0f);
        }
        for (int i = threadIdx.x; i < BK_TC * BN_TC; i += blockDim.x) {
            int sn = i % BN_TC, sk = i / BN_TC;
            int gr = bk + sk, gc = bcol + sn;
            Bs[sk][sn] = (gr < K && gc < N) ? B[gr * N + gc] : __float2half(0.0f);
        }
        __syncthreads();

        // --- WMMA multiply-accumulate ---
        // Load fragments from shared memory and compute
        // A fragment: 16x16 from As, starting at (k=0, m=warp_row*16)
        // B fragment: 16x16 from Bs, starting at (k=0, n=warp_col*16)
        for (int k = 0; k < BK_TC; k += WMMA_K) {
            // As is stored as [BK_TC][BM_TC], col-major fragment reads column
            wmma::load_matrix_sync(a_frag,
                &As[k][warp_row * WMMA_M], BM_TC);  // ld = BM_TC
            wmma::load_matrix_sync(b_frag,
                &Bs[k][warp_col * WMMA_N], BN_TC);  // ld = BN_TC
            wmma::mma_sync(c_frag, a_frag, b_frag, c_frag);
        }

        __syncthreads();
    }

    // --- Store accumulator to global memory ---
    int c_row = brow + warp_row * WMMA_M;
    int c_col = bcol + warp_col * WMMA_N;
    if (c_row < M && c_col < N) {
        wmma::store_matrix_sync(&C[c_row * N + c_col], c_frag, N,
                                wmma::mem_row_major);
    }
}

// Launch: each block needs enough warps to cover (BM_TC/16) * (BN_TC/16) tiles
// = 8 * 8 = 64 warps = 2048 threads (maximum per block on most GPUs is 1024)
// So in practice, reduce BM_TC/BN_TC or have each warp compute multiple tiles.
// For BM=64, BN=64: 4*4=16 warps = 512 threads per block.
```

**Note on practical sizing**: The example above with BM=BN=128 requires 64 warps (2048 threads), which exceeds the 1024-thread block limit. In practice, either reduce tile sizes (e.g., BM=BN=64 giving 16 warps = 512 threads) or have each warp compute multiple WMMA tiles in a loop. HW02 asks you to handle this.

### 7.4 Performance

On an A100, a well-optimized WMMA GEMM for $M = N = K = 4096$ in FP16 accumulating to FP32 achieves 200--250 TFLOPS (65--80% of 312 TFLOPS peak). The remaining gap is closed by CUTLASS using the lower-level `mma.sync` PTX instruction, warp-specialized pipelines, and software-managed TMA on Hopper.

---

## 8. Bank Conflicts and Shared Memory Layout

### 8.1 What Are Bank Conflicts?

Shared memory is divided into 32 banks, each 4 bytes wide. Bank index for address `addr` is `(addr / 4) % 32`. When two threads in the same warp access different addresses in the same bank, the accesses are serialized -- a **bank conflict**.

Consider loading a column of a $32 \times 32$ matrix stored row-major in shared memory:

```cpp
__shared__ float smem[32][32];

// Thread i reads smem[i][col] for fixed col
// Address of smem[i][col] = base + (i * 32 + col) * 4
// Bank = (i * 32 + col) % 32 = col  (since 32 % 32 = 0)
// ALL threads hit bank 'col' -> 32-way bank conflict!
```

### 8.2 The Padding Trick

Adding one extra column eliminates the conflict:

```cpp
__shared__ float smem[32][32 + 1];  // 33 columns

// Bank of smem[i][col] = (i * 33 + col) % 32
// For col=0: banks are 0, 1, 2, ..., 31 (all different!)
// No bank conflict.
```

This wastes 32 floats (128 bytes) of shared memory per tile -- a negligible cost for a 32x improvement in column-access throughput.

### 8.3 Diagnosing Bank Conflicts

Use NVIDIA Nsight Compute to measure bank conflicts:

```bash
ncu --metrics l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum \
    ./gemm_benchmark
```

A well-optimized kernel should show 0 or near-0 bank conflicts. If you see a number close to `32 * num_shared_accesses`, you likely have a systematic conflict pattern.

In the V2 kernel above, we stored `As` as `As[BK][BM]` rather than `As[BM][BK]`. This layout means the inner loop reads `As[k][ty*TM + m]` -- adjacent threads read adjacent addresses along the `BM` dimension, avoiding bank conflicts. This layout choice is intentional.

---

## 9. Kernel Launch and Occupancy

### 9.1 Choosing Block Dimensions

The block size affects:

- **Occupancy**: ratio of active warps to maximum warps per SM. Higher occupancy helps hide latency.
- **Shared memory per block**: limits how many blocks can co-reside on an SM.
- **Registers per thread**: more registers per thread -> fewer concurrent blocks.

Rules of thumb:

- Use at least 128 threads (4 warps) per block for reasonable occupancy.
- Use at most 256--512 threads for compute-bound kernels to leave room for register allocation.
- Shared memory per block should not exceed 48 KB (default) or 96--160 KB (if using `cudaFuncSetAttribute` to increase the limit).

### 9.2 Occupancy Calculator API

```cpp
#include <cuda_runtime.h>

// Let CUDA suggest the optimal block size for a kernel
int min_grid_size, optimal_block_size;
cudaOccupancyMaxPotentialBlockSize(
    &min_grid_size, &optimal_block_size,
    gemm_tiled,  // kernel function pointer
    0,           // dynamic shared memory per block
    0            // block size limit (0 = no limit)
);

// Query occupancy for a specific block size
int num_blocks;
cudaOccupancyMaxActiveBlocksPerMultiprocessor(
    &num_blocks, gemm_tiled, /*blockSize=*/256, /*dynamicSMemSize=*/0);

cudaDeviceProp prop;
cudaGetDeviceProperties(&prop, 0);
float occupancy = (float)(num_blocks * 256 / 32)
                / (prop.maxThreadsPerMultiProcessor / 32);
printf("256 threads: %d blocks/SM, occupancy = %.1f%%\n",
       num_blocks, occupancy * 100.0f);
```

### 9.3 Increasing Shared Memory Limits

For kernels needing more than 48 KB of shared memory (common with large tiles), opt in at launch time:

```cpp
cudaFuncSetAttribute(gemm_register_blocked,
    cudaFuncAttributeMaxDynamicSharedMemorySize, 98304);  // 96 KB
gemm_register_blocked<<<grid, block, 98304>>>(A, B, C, M, N, K);
```

On A100, each SM has 192 KB of combined L1/shared memory. Configuring up to 164 KB as shared memory is possible but reduces L1 cache, which may hurt kernels with irregular global memory access patterns.

---

## 10. Brief Comparison with Triton

Triton (Tillet et al., 2019; OpenAI, 2021) is a Python-based DSL that compiles to GPU code through an MLIR-based pipeline. It provides a block-level programming model where the programmer thinks in tiles rather than individual threads. Shared memory management, thread mapping, memory coalescing, and software pipelining are handled by the compiler, reducing kernel development time by 10--50x compared to CUDA C++.

For the GEMM optimizations covered in this lecture, Triton's `tl.dot()` compiles to Tensor Core instructions automatically, and the `num_stages` autotuning parameter controls double/triple buffering. A well-autotuned Triton GEMM achieves 70--90% of cuBLAS performance, compared to the 70--85% we target in HW02 V4. The development effort is a single 50-line Python function versus hundreds of lines of CUDA C++.

When should you use which? Use **Triton** for rapid prototyping, fused memory-bound kernels (softmax, layer norm, attention), and research experimentation. Use **CUDA C++** when you need warp-level control, must integrate with existing CUDA libraries, or need to squeeze the last 10--15% of peak performance for production deployment. HW02 uses both: the GEMM progression (V0--V4) is in CUDA C++ to build low-level understanding, while the Flash Attention implementation uses Triton because its block-level model maps naturally to the tiled, fused attention pattern.

---

## Key Takeaways

1. **Shared memory tiling** (V1) increases arithmetic intensity by a factor of the tile size $T$, converting a memory-bound naive kernel into one that begins to utilize compute capacity.
2. **Register blocking** (V2) is the single most impactful optimization: each thread computing a $TM \times TN$ tile amortizes shared memory reads across $TM \times TN$ FMAs, pushing arithmetic intensity above the machine balance.
3. **Double buffering** (V3) overlaps global memory loads with shared memory computation, hiding latency and improving throughput by 10--30% on top of register blocking.
4. **WMMA Tensor Cores** (V4) provide 16x the FP16 throughput of FP32 CUDA cores, but require careful fragment layout and shared memory staging.
5. **Bank conflicts** are a silent performance killer: a 32-way conflict serializes an entire warp's shared memory access. The padding trick (`[TILE+1][TILE]`) is simple and effective.
6. **Occupancy is necessary but not sufficient**: high occupancy helps hide latency, but register blocking (which reduces occupancy) often wins by increasing per-thread compute efficiency.

---

## Further Reading

1. **Huang, J. et al.** (2018). "Dissecting the NVIDIA Volta GPU Architecture via Microbenchmarking." *Technical Report, Citadel*.
2. **Kerr, A. et al.** (2017). "CUTLASS: Fast Linear Algebra in CUDA C++." NVIDIA Developer Blog. [developer.nvidia.com/blog/cutlass-linear-algebra-cuda](https://developer.nvidia.com/blog/cutlass-linear-algebra-cuda/).
3. **NVIDIA CUDA C++ Programming Guide**, Ch. 5: Memory Hierarchy, Ch. 9: Cooperative Groups. [docs.nvidia.com/cuda/cuda-c-programming-guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/).
4. **NVIDIA WMMA Documentation**. [docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#wmma](https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#wmma).
5. **Tillet, P., Kung, H.T., & Cox, D.** (2019). "Triton: An Intermediate Language and Compiler for Tiled Neural Network Computations." *MAPL Workshop, PLDI*.
6. **Lei, S.** (2022). "How to Optimize a CUDA Matmul Kernel for cuBLAS-like Performance." [siboehm.com/articles/22/CUDA-MMM](https://siboehm.com/articles/22/CUDA-MMM).
