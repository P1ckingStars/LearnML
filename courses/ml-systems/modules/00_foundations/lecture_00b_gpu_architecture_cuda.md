# Lecture 00b: GPU Architecture & CUDA Programming Model

> **Module 00 — Hardware & Compute Foundations (Pre-Work)**
> Estimated study time: 8--10 hours

---

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** the fundamental design trade-off between CPUs (latency-oriented) and GPUs (throughput-oriented), and justify why GPUs dominate ML workloads.
2. **Describe** the NVIDIA GPU architecture hierarchy -- SMs, warps, thread blocks, grids -- and trace how a CUDA kernel maps to hardware execution units.
3. **Analyze** GPU memory hierarchy (registers, shared memory, L1/L2 cache, global memory/HBM) and calculate the bandwidth and capacity at each level for specific GPU models.
4. **Identify** performance pitfalls including uncoalesced memory accesses, shared memory bank conflicts, and warp divergence, and describe how to avoid them.
5. **Estimate** theoretical occupancy for a given CUDA kernel configuration and explain its relationship to achieved performance.

---

## 2. Motivation and Context

The modern deep learning revolution is, in large part, a hardware story. AlexNet's 2012 ImageNet breakthrough was enabled not by a novel algorithm alone, but by the realization that GPU hardware -- originally designed for rendering triangles in video games -- could accelerate the massively parallel matrix operations at the heart of neural networks.

The GPU's origin as a graphics processor shaped its architecture in ways that turned out to be serendipitous for ML. Rendering a frame requires applying the same shading computation independently to millions of pixels -- an embarrassingly parallel workload. GPU architects responded by building chips with thousands of simple cores optimized for throughput rather than single-thread latency. This design choice -- sacrifice per-thread speed for aggregate throughput -- maps almost perfectly onto the data parallelism in matrix multiplication, convolution, and attention.

NVIDIA's release of CUDA (Compute Unified Device Architecture) in 2006 opened GPU hardware to general-purpose computing. The subsequent co-evolution of CUDA, cuDNN, and deep learning frameworks like Theano, TensorFlow, and PyTorch created the software ecosystem that made GPU-accelerated ML practical. Today, a single NVIDIA B200 GPU delivers over 2.2 PFLOPS of FP8 compute and 8 TB/s of HBM bandwidth -- numbers that would have ranked among the world's top supercomputers just 15 years ago.

Understanding GPU architecture is not optional for an ML systems engineer. Every decision -- how to tile a GEMM, whether to fuse operators, how to partition a model across devices, when to use mixed precision -- ultimately traces back to the hardware.

---

## 3. CPU vs. GPU: Design Philosophy

### 3.1 Latency-Oriented vs. Throughput-Oriented Design

A CPU core is optimized to execute a **single thread** as fast as possible:

- Large caches (multi-MiB L1+L2 per core) to reduce memory latency.
- Deep out-of-order execution engines (hundreds of in-flight instructions).
- Branch predictors with >95% accuracy.
- Few cores (8--128), each individually powerful.

A GPU is optimized to execute **thousands of threads** simultaneously:

- Small per-thread resources (registers, cache) but massive aggregate throughput.
- No branch prediction, no out-of-order execution (within a warp).
- Latency is hidden by switching between thousands of threads rather than by caching.
- Many cores (thousands of ALUs), each individually simple.

### 3.2 Quantitative Comparison

| Metric | CPU (EPYC 9654) | GPU (H100 SXM) | Ratio |
|--------|-----------------|-----------------|-------|
| Cores / ALUs | 96 cores | 16,896 CUDA cores | 176x |
| Clock speed | 2.4 GHz (base) | 1.83 GHz (boost) | 0.76x |
| FP32 peak TFLOPS | ~3.5 (w/ AVX-512) | 66.9 | ~19x |
| FP16 peak TFLOPS | ~7 | 133.8 (1,979 w/ Tensor Cores) | ~283x |
| Memory bandwidth | ~460 GB/s (DDR5) | 3,350 GB/s (HBM3) | ~7.3x |
| Memory capacity | 768 GiB (12ch DDR5) | 80 GiB (HBM3) | 0.1x |
| L1 cache per core | 32 KiB + 48 KiB (I+D) | 256 KiB (configurable w/ shared mem) | -- |
| Power | 360 W | 700 W | 1.9x |

The GPU wins overwhelmingly on throughput per watt for parallel workloads, but has far less memory capacity and higher memory access latency for single threads.

### 3.3 Why GPUs for ML?

The key ML operations -- matrix multiplication, convolution, attention -- are:

1. **Massively parallel**: Operations across batch elements, spatial locations, and channels are independent.
2. **Arithmetically regular**: The same operation (multiply-accumulate) is applied to every element.
3. **High arithmetic intensity** (for the right formulation): GEMM has $O(N^3)$ FLOPs on $O(N^2)$ data, making it compute-bound on GPUs.

This is the GPU's sweet spot. The mismatch occurs for irregular, branchy, sequential workloads (beam search, tree traversals, dynamic control flow) -- these remain better on CPUs.

---

## 4. NVIDIA GPU Architecture

### 4.1 Architecture Hierarchy

An NVIDIA GPU is organized hierarchically:

```
GPU (Device)
 |
 +-- GPC (Graphics Processing Cluster) x 8  [H100]
      |
      +-- TPC (Texture Processing Cluster) x 9 per GPC
           |
           +-- SM (Streaming Multiprocessor) x 2 per TPC
                |
                +-- Warp Schedulers x 4
                +-- CUDA Cores (FP32) x 128
                +-- Tensor Cores x 4
                +-- LD/ST units x 32
                +-- SFU (Special Function Units) x 16
                +-- Register File: 256 KiB
                +-- Shared Memory / L1: 256 KiB (configurable split)
```

**Note:** The diagram above shows the full **GH100 die** layout with 8 GPCs and 9 TPCs per GPC, giving $8 \times 9 \times 2 = 144$ SMs total. However, the production **H100 SXM5** ships with 132 SMs enabled; 12 SMs are disabled for manufacturing yield improvement.

The **SM** is the fundamental compute unit. Each SM can execute multiple warps concurrently.

### 4.2 Thread Hierarchy: Threads, Warps, Blocks, Grids

CUDA organizes parallel execution in a hierarchy:

| Level | Size | Scheduled by | Shared resources |
|-------|------|-------------|------------------|
| **Thread** | 1 | -- | Registers |
| **Warp** | 32 threads | Warp scheduler (HW) | Program counter, execution |
| **Thread Block** | Up to 1024 threads | SM (HW) | Shared memory, synchronization |
| **Grid** | Up to $2^{31} - 1$ blocks | GPU runtime | Global memory |

The programmer specifies the grid and block dimensions at kernel launch:

```cpp
// Launch: gridDim blocks, each with blockDim threads
kernel<<<gridDim, blockDim>>>(args...);

// 2D example for matrix operations:
dim3 gridDim(M / TILE_M, N / TILE_N);
dim3 blockDim(TILE_M, TILE_N);   // must be <= 1024 total
```

### 4.3 Warp Execution Model

The **warp** is the fundamental unit of execution on an SM. All 32 threads in a warp execute the **same instruction** at the **same time** (SIMT -- Single Instruction, Multiple Threads). This is conceptually similar to SIMD on CPUs, but with a key difference: each thread has its own registers and can follow its own control flow (at a performance cost; see Section 6.3).

Each SM has 4 warp schedulers, each capable of issuing one or two instructions per cycle. So an SM can have 4 warps actively executing simultaneously, but many more warps can be **resident** (their register state is live on the SM), ready to be scheduled when others stall on memory accesses.

**Latency hiding through occupancy.** When a warp issues a memory load and stalls waiting for data (~hundreds of cycles for global memory), the warp scheduler switches to another ready warp at zero cost (no context switch overhead -- all warp state lives in registers on the SM). This is the GPU's primary mechanism for hiding memory latency, replacing the CPU's strategy of large caches and OoO execution.

### 4.4 SM Resource Limits

Each SM has finite resources that constrain how many thread blocks can be resident simultaneously:

| Resource | H100 SM Limit |
|----------|--------------|
| Max threads per SM | 2048 |
| Max warps per SM | 64 |
| Max thread blocks per SM | 32 |
| Register file | 65,536 32-bit registers |
| Shared memory | Up to 228 KiB (configurable) |
| Max threads per block | 1024 |
| Max shared memory per block | 228 KiB (max config) |

If a kernel uses 64 registers per thread and block size 256 (8 warps), then each block requires $64 \times 256 = 16{,}384$ registers. The SM has 65,536 registers, so at most $\lfloor 65536 / 16384 \rfloor = 4$ blocks can be resident, giving $4 \times 256 = 1024$ threads, or 50% occupancy (1024/2048).

---

## 5. GPU Memory Hierarchy

### 5.1 Overview

The GPU memory hierarchy, from fastest/smallest to slowest/largest:

| Level | Scope | Capacity (H100) | Bandwidth | Latency |
|-------|-------|-----------------|-----------|---------|
| Registers | Per thread | 255 x 32-bit max | ~20 TB/s aggregate | 0 cycles |
| Shared Memory | Per SM (per block) | Up to 228 KiB | ~20 TB/s aggregate | ~20--30 cycles |
| L1 Cache | Per SM | Shared with above | ~20 TB/s aggregate | ~30 cycles |
| L2 Cache | Per GPU | 50 MiB | ~12 TB/s | ~200 cycles |
| Global Memory (HBM3) | Per GPU | 80 GiB | 3.35 TB/s | ~400--600 cycles |

### 5.2 Registers

Each thread has access to up to 255 32-bit registers. Registers are the fastest storage -- zero additional latency for ALU operands. The total register file per SM is 256 KiB (65,536 x 32-bit registers), partitioned among all resident threads.

**Register pressure** is a critical concern. If a kernel uses many registers per thread, fewer threads can be resident, reducing occupancy and the SM's ability to hide latency. The compiler reports register usage with `--ptxas-options=-v`.

When register demand exceeds the per-thread limit or the SM's capacity, the compiler **spills** registers to local memory (which physically resides in global memory, cached through L1/L2). Register spills are a performance disaster -- they turn register-speed accesses into memory-speed accesses.

### 5.3 Shared Memory

**Shared memory** is an on-chip SRAM scratchpad explicitly managed by the programmer. It is shared among all threads in a block and persists for the block's lifetime.

Key characteristics:
- **Capacity**: Configurable between 0 and 228 KiB per SM on H100 (shared with L1 cache in a configurable split).
- **Bandwidth**: Organized into 32 **banks**, each 4 bytes wide. If all 32 threads in a warp access different banks, all accesses are served simultaneously (one cycle). This gives an aggregate bandwidth of $32 \times 4 \times f_{\text{clock}} \approx 20$ TB/s.
- **Bank conflicts**: If multiple threads access different addresses in the same bank, accesses are serialized. An $n$-way bank conflict means $n$ cycles for that access.

**Bank conflict example.** Suppose shared memory has 32 banks, and bank assignment is:

$$\text{bank}(\text{address}) = \left\lfloor \frac{\text{address}}{4} \right\rfloor \bmod 32$$

If 32 threads access a float array with stride 1 (consecutive elements), each thread hits a different bank: no conflict. If stride is 32, all threads hit bank 0: a 32-way conflict, reducing effective bandwidth by $32\times$.

Common workaround: **padding**. For a 2D shared memory array used for matrix transpose:

```cpp
// Without padding: column access has 32-way bank conflict
__shared__ float tile[32][32];

// With padding: column access has no bank conflict
__shared__ float tile[32][33];  // +1 padding per row
```

### 5.4 Global Memory (HBM)

**Global memory** is the GPU's main memory, implemented as High Bandwidth Memory (HBM) -- a 3D-stacked DRAM technology:

| GPU | HBM Gen | Capacity | Bandwidth | Bus Width |
|-----|---------|----------|-----------|-----------|
| A100 | HBM2e | 80 GiB | 2.0 TB/s | 5120 bit |
| H100 SXM | HBM3 | 80 GiB | 3.35 TB/s | 5120 bit |
| H200 | HBM3e | 141 GiB | 4.8 TB/s | 6144 bit |
| B200 | HBM3e | 192 GiB | 8.0 TB/s | 8192 bit |

HBM achieves high bandwidth through massive parallelism: thousands of I/O pins arranged in a wide bus, with multiple stacked DRAM dies connected via through-silicon vias (TSVs).

### 5.5 Memory Coalescing

Global memory is accessed in **transactions** of 32 or 128 bytes (depending on cache configuration). When a warp of 32 threads issues a load, the hardware examines the addresses and groups them into the minimum number of transactions.

**Coalesced access**: All 32 threads access consecutive 4-byte elements (128 bytes total). This requires a single 128-byte transaction. 100% efficiency.

**Strided access**: Threads access elements with stride $s$. If $s = 2$, each 128-byte transaction serves only 16 useful elements, giving 50% efficiency. Stride 32 gives 4 bytes useful per 128-byte transaction: 3.125% efficiency.

**Random access**: Each thread accesses a random location. In the worst case, 32 separate 32-byte transactions are needed, wasting most of the fetched data.

**Quantitative impact.** For an H100 with 3.35 TB/s HBM bandwidth:

| Access Pattern | Efficiency | Effective Bandwidth |
|----------------|-----------|-------------------|
| Coalesced (stride 1) | ~85--90% | ~2.9 TB/s |
| Stride 2 | ~45% | ~1.5 TB/s |
| Stride 32 | ~3% | ~100 GB/s |
| Random | ~3--5% | ~100--170 GB/s |

The coalesced-to-random ratio is roughly $20$--$30\times$. This single architectural fact drives much of GPU kernel optimization.

---

## 6. Performance Pitfalls

### 6.1 Uncoalesced Memory Access

The most common performance bug in CUDA code. Consider transposing a matrix:

```cpp
// Naive transpose: reads are coalesced, writes are strided
__global__ void transpose_naive(float *out, const float *in, int N) {
    int x = blockIdx.x * blockDim.x + threadIdx.x;
    int y = blockIdx.y * blockDim.y + threadIdx.y;
    if (x < N && y < N)
        out[x * N + y] = in[y * N + x];  // write stride = N (uncoalesced)
}
```

Threads in a warp have consecutive `threadIdx.x` values. For the read `in[y * N + x]`, consecutive threads access consecutive memory addresses (coalesced). For the write `out[x * N + y]`, consecutive threads access addresses separated by stride $N$ (uncoalesced).

**Fix: Use shared memory as a staging buffer.**

```cpp
__global__ void transpose_shared(float *out, const float *in, int N) {
    __shared__ float tile[TILE][TILE + 1];  // +1 to avoid bank conflicts

    int x = blockIdx.x * TILE + threadIdx.x;
    int y = blockIdx.y * TILE + threadIdx.y;

    // Coalesced read from global -> shared (row-major)
    if (x < N && y < N)
        tile[threadIdx.y][threadIdx.x] = in[y * N + x];

    __syncthreads();

    // Swap block indices for transposed output
    x = blockIdx.y * TILE + threadIdx.x;
    y = blockIdx.x * TILE + threadIdx.y;

    // Coalesced write from shared -> global (row-major in transposed layout)
    if (x < N && y < N)
        out[y * N + x] = tile[threadIdx.x][threadIdx.y];
}
```

Both global memory accesses are now coalesced, and shared memory handles the transpose. This is a canonical pattern in GPU programming.

### 6.2 Shared Memory Bank Conflicts

As described in Section 5.3, bank conflicts serialize shared memory accesses within a warp. The padding trick (`TILE + 1` in the transpose above) eliminates conflicts for common access patterns.

To diagnose bank conflicts, use NVIDIA Nsight Compute, which reports the metric `l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum`.

### 6.3 Warp Divergence

When threads within a warp take different branches, the warp executes **both paths sequentially**, masking off inactive threads:

```cpp
if (threadIdx.x < 16) {
    // Path A: executed by threads 0-15 (threads 16-31 masked)
    ...
} else {
    // Path B: executed by threads 16-31 (threads 0-15 masked)
    ...
}
// Both paths execute, total time = time(A) + time(B)
```

This effectively halves performance for a 50/50 branch. Nested or highly variable branching can be catastrophic.

**Mitigation strategies:**

1. **Restructure to branch at warp boundaries.** If possible, ensure all threads in a warp take the same path.
2. **Replace branches with predication.** Use arithmetic to compute both values and select:
   ```cpp
   float result = (threadIdx.x < 16) ? valueA : valueB;
   ```
   This avoids divergence when the compiler uses predicated instructions.
3. **Sort data** so that similar elements are processed by the same warp.

**Note on Volta+ architectures.** Starting with Volta (SM 7.0), NVIDIA introduced **independent thread scheduling**, which allows threads within a warp to diverge and reconverge at finer granularity. However, divergence still incurs a throughput penalty because the hardware execution units are shared.

---

## 7. Tensor Cores

### 7.1 What Are Tensor Cores?

Starting with Volta (2017), NVIDIA introduced **Tensor Cores** -- specialized hardware units that perform small matrix multiply-accumulate (MMA) operations in a single cycle. Each Tensor Core computes:

$$D = A \times B + C$$

where $A$, $B$, $C$, $D$ are small matrices (e.g., $16 \times 16$, $8 \times 8$, depending on data type).

### 7.2 Supported Data Types and Throughput

| GPU | Tensor Core Gen | FP16 TFLOPS | BF16 TFLOPS | FP8 TFLOPS | INT8 TOPS |
|-----|----------------|-------------|-------------|------------|-----------|
| V100 | 1st gen | 120 | -- | -- | -- |
| A100 | 3rd gen | 312 | 312 | -- | 624 |
| H100 SXM | 4th gen | 1,979 | 1,979 | 3,958 | 3,958 |
| B200 | 5th gen | 2,250 | 2,250 | 4,500 | 4,500 |

The jump from CUDA Core FP32 performance to Tensor Core FP16 performance is dramatic: on the H100, Tensor Cores deliver $\sim 30\times$ the throughput of standard CUDA Cores for FP32. This is why mixed-precision training (Lecture 05a) is essential for utilizing modern GPUs.

### 7.3 Programming Tensor Cores

Tensor Cores are accessed through:

1. **cuBLAS/cuDNN**: Automatically use Tensor Cores when data types and dimensions are appropriate. Dimensions should be multiples of 8 (FP16) or 16 (INT8) for best performance.
2. **WMMA (Warp Matrix Multiply-Accumulate) API**: CUDA intrinsics for direct Tensor Core access:
   ```cpp
   #include <mma.h>
   using namespace nvcuda::wmma;

   fragment<matrix_a, 16, 16, 16, half, row_major> a_frag;
   fragment<matrix_b, 16, 16, 16, half, col_major> b_frag;
   fragment<accumulator, 16, 16, 16, float> c_frag;

   load_matrix_sync(a_frag, A_ptr, lda);
   load_matrix_sync(b_frag, B_ptr, ldb);
   fill_fragment(c_frag, 0.0f);
   mma_sync(c_frag, a_frag, b_frag, c_frag);
   store_matrix_sync(C_ptr, c_frag, ldc, mem_row_major);
   ```
3. **Triton**: The `tl.dot` operation automatically maps to Tensor Cores.

---

## 8. CUDA Kernel Structure

### 8.1 Hello World: Vector Addition

```cpp
#include <cuda_runtime.h>

// Kernel: each thread computes one element
__global__ void vecAdd(float *C, const float *A, const float *B, int N) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < N) {
        C[i] = A[i] + B[i];
    }
}

int main() {
    int N = 1 << 20;  // 1M elements
    size_t bytes = N * sizeof(float);

    // Allocate host memory
    float *h_A = (float*)malloc(bytes);
    float *h_B = (float*)malloc(bytes);
    float *h_C = (float*)malloc(bytes);

    // Initialize...

    // Allocate device memory
    float *d_A, *d_B, *d_C;
    cudaMalloc(&d_A, bytes);
    cudaMalloc(&d_B, bytes);
    cudaMalloc(&d_C, bytes);

    // Copy host -> device
    cudaMemcpy(d_A, h_A, bytes, cudaMemcpyHostToDevice);
    cudaMemcpy(d_B, h_B, bytes, cudaMemcpyHostToDevice);

    // Launch kernel
    int blockSize = 256;
    int gridSize = (N + blockSize - 1) / blockSize;
    vecAdd<<<gridSize, blockSize>>>(d_C, d_A, d_B, N);

    // Copy device -> host
    cudaMemcpy(h_C, d_C, bytes, cudaMemcpyDeviceToHost);

    // Free...
    cudaFree(d_A); cudaFree(d_B); cudaFree(d_C);
    free(h_A); free(h_B); free(h_C);
    return 0;
}
```

### 8.2 Thread Indexing

For 1D, 2D, and 3D grids and blocks, the global thread index is:

```cpp
// 1D grid, 1D block
int i = blockIdx.x * blockDim.x + threadIdx.x;

// 2D grid, 2D block
int x = blockIdx.x * blockDim.x + threadIdx.x;
int y = blockIdx.y * blockDim.y + threadIdx.y;
int idx = y * width + x;  // linear index for row-major 2D array

// 3D (e.g., for volumetric data or batch dimension)
int x = blockIdx.x * blockDim.x + threadIdx.x;
int y = blockIdx.y * blockDim.y + threadIdx.y;
int z = blockIdx.z * blockDim.z + threadIdx.z;
```

### 8.3 Synchronization

- `__syncthreads()`: Barrier for all threads in a block. Essential when threads share data through shared memory.
- `__syncwarp(mask)`: Barrier for threads within a warp (Volta+).
- **Atomic operations**: `atomicAdd`, `atomicCAS`, etc., for global/shared memory. Expensive but sometimes necessary (e.g., histogram computation, gradient accumulation).
- **Cooperative groups** (CUDA 9+): Flexible synchronization primitives beyond block-level.

### 8.4 Memory Management Patterns

```cpp
// Explicit allocation (traditional)
cudaMalloc(&d_ptr, bytes);
cudaMemcpy(d_ptr, h_ptr, bytes, cudaMemcpyHostToDevice);

// Pinned (page-locked) host memory -- enables async transfers
cudaMallocHost(&h_pinned, bytes);
cudaMemcpyAsync(d_ptr, h_pinned, bytes, cudaMemcpyHostToDevice, stream);

// Unified Memory -- single pointer, automatic migration
cudaMallocManaged(&u_ptr, bytes);
// Access from CPU or GPU; driver migrates pages as needed

// Streams for overlapping compute and transfer
cudaStream_t stream1, stream2;
cudaStreamCreate(&stream1);
cudaStreamCreate(&stream2);
cudaMemcpyAsync(d_A, h_A, bytes/2, cudaMemcpyHostToDevice, stream1);
cudaMemcpyAsync(d_A + N/2, h_A + N/2, bytes/2, cudaMemcpyHostToDevice, stream2);
kernel<<<grid, block, 0, stream1>>>(d_A, N/2);
kernel<<<grid, block, 0, stream2>>>(d_A + N/2, N/2);
```

---

## 9. Occupancy

### 9.1 Definition

**Occupancy** is the ratio of active warps on an SM to the maximum number of warps the SM can support:

$$\text{Occupancy} = \frac{\text{Active Warps per SM}}{\text{Max Warps per SM}}$$

On the H100, max warps per SM = 64 (2048 threads / 32 threads per warp). So 100% occupancy means 64 active warps per SM.

### 9.2 Occupancy Limiters

Three resources limit occupancy:

1. **Threads per block** / **Blocks per SM**: If your block size is 64 threads (2 warps), and the SM allows 32 blocks, you get $\min(32, \ldots) \times 2 = 64$ warps. But if block size is 512 (16 warps), at most $\lfloor 2048/512 \rfloor = 4$ blocks, giving 64 warps -- same occupancy.

2. **Registers per thread**: If a kernel uses 128 registers per thread, then each warp needs $128 \times 32 = 4096$ registers. The SM has 65,536 registers, allowing $\lfloor 65536/4096 \rfloor = 16$ warps = 25% occupancy.

3. **Shared memory per block**: If a block uses 96 KiB of shared memory and the SM has 228 KiB available, at most $\lfloor 228/96 \rfloor = 2$ blocks can be resident.

The actual occupancy is the minimum imposed by all three constraints.

### 9.3 Worked Example

Consider a kernel with:
- Block size: 256 threads (8 warps per block)
- Registers per thread: 48
- Shared memory per block: 16 KiB

On an H100 SM (max 2048 threads, 65,536 registers, 228 KiB shared memory, 32 max blocks):

**Thread limit**: $\lfloor 2048/256 \rfloor = 8$ blocks $\rightarrow$ $8 \times 8 = 64$ warps.

**Register limit**: Registers per block = $48 \times 256 = 12{,}288$. Blocks from registers: $\lfloor 65536/12288 \rfloor = 5$ blocks $\rightarrow$ $5 \times 8 = 40$ warps.

**Shared memory limit**: $\lfloor 228/16 \rfloor = 14$ blocks $\rightarrow$ $14 \times 8 = 112$ warps (capped at 64).

**Result**: The binding constraint is registers, giving 40 warps = $40/64 = 62.5\%$ occupancy.

### 9.4 Occupancy vs. Performance

A common misconception is that higher occupancy always means better performance. In reality:

- **High occupancy helps** when the kernel is **memory-latency-bound**: more warps allow the scheduler to hide memory access latency.
- **High occupancy may not help** when the kernel is **compute-bound**: if the ALUs are already saturated, adding more warps just increases contention for execution resources.
- **Lower occupancy can be better** when it allows each thread to use more registers (avoiding spills) or more shared memory (enabling more data reuse).

The rule of thumb: aim for at least 50% occupancy, then focus on other optimizations (coalescing, shared memory reuse, instruction mix). Use NVIDIA's occupancy calculator or `cudaOccupancyMaxActiveBlocksPerMultiprocessor()` to analyze trade-offs.

---

## 10. GPU Generations: A100, H100, B200

### 10.1 Architecture Comparison

| Feature | A100 (Ampere) | H100 (Hopper) | B200 (Blackwell) |
|---------|---------------|---------------|------------------|
| Process node | 7 nm (TSMC) | 4 nm (TSMC) | 4 nm (TSMC) |
| Transistors | 54.2 B | 80 B | 208 B |
| SMs | 108 | 132 | ~148 (2 dies) |
| CUDA cores | 6,912 | 16,896 | ~18,944 |
| Tensor Cores | 432 (3rd gen) | 528 (4th gen) | 768 (5th gen) |
| HBM | 80 GiB HBM2e | 80 GiB HBM3 | 192 GiB HBM3e |
| HBM bandwidth | 2.0 TB/s | 3.35 TB/s | 8.0 TB/s |
| FP16 Tensor TFLOPS | 312 | 1,979 | 2,250 |
| FP8 Tensor TFLOPS | -- | 3,958 | 4,500 |
| TDP | 400 W | 700 W | 1,000 W |
| NVLink bandwidth | 600 GB/s | 900 GB/s | 1,800 GB/s |

### 10.2 Key Architectural Innovations

**A100 (2020)**:
- Introduced **multi-instance GPU (MIG)**: partition a single GPU into up to 7 isolated instances for multi-tenant serving.
- Sparsity support: 2:4 structured sparsity in Tensor Cores for $2\times$ throughput on supported operations.
- Third-generation NVLink and NVSwitch.

**H100 (2022)**:
- **Transformer Engine**: Hardware-accelerated dynamic scaling for FP8 training, automatically managing per-tensor scaling factors.
- **Thread Block Clusters**: New programming abstraction grouping multiple thread blocks for inter-block cooperation and distributed shared memory.
- **Asynchronous copy** improvements: `TMA (Tensor Memory Accelerator)` unit offloads complex address calculations and bulk data movement from shared memory to global memory.
- Fourth-generation NVLink: 900 GB/s bidirectional, enabling efficient all-to-all communication for MoE models.

**B200 (2024)**:
- **Dual-die design**: Two GPU dies connected by a 10 TB/s chip-to-chip link, appearing as a single GPU to software.
- FP4 support in Tensor Cores: up to 9 PFLOPS for inference workloads.
- 192 GiB HBM3e: sufficient to hold a 70B parameter model in FP16 on a single GPU.
- Fifth-generation NVLink: 1.8 TB/s bidirectional.

### 10.3 Implications for ML Systems Design

The trend across generations is clear:

1. **Compute is growing faster than memory bandwidth.** The ratio of FLOPS to bandwidth (the machine balance point) is increasing, meaning more operators become memory-bandwidth-bound. This drives the need for operator fusion, FlashAttention, and other techniques that increase arithmetic intensity.

2. **Memory capacity is growing but slowly.** Model sizes grow faster than single-GPU memory. Multi-GPU parallelism is mandatory for large models.

3. **Interconnect bandwidth is growing to match.** NVLink bandwidth has tripled from A100 to B200, enabling more aggressive tensor parallelism.

4. **Lower precision is the free lunch.** Each generation adds support for lower-precision formats (FP16 -> BF16 -> FP8 -> FP4), each doubling throughput. The challenge shifts to maintaining model quality at reduced precision.

---

## 11. Key Takeaways

1. GPUs achieve high throughput by running **thousands of threads** simultaneously. Latency is hidden by thread-level parallelism, not caches. This is fundamentally different from CPU design.

2. The **warp** (32 threads) is the atomic unit of execution. Performance pitfalls -- divergence, uncoalesced access, bank conflicts -- all occur at the warp level. Think in warps, not in individual threads.

3. **Memory coalescing** is the single most important optimization for bandwidth-bound kernels. A coalesced access pattern can be $20$--$30\times$ faster than random access.

4. **Shared memory** is a software-managed cache enabling data reuse and access pattern restructuring (e.g., for transposes). Bank conflicts must be avoided through careful layout or padding.

5. **Occupancy** determines how effectively memory latency is hidden. It is limited by registers, shared memory, and block size. Higher occupancy helps memory-bound kernels but is not always necessary for compute-bound kernels.

6. **Tensor Cores** deliver an order of magnitude more throughput than standard CUDA Cores for matrix operations. Using them (via cuBLAS, Triton, or WMMA) and supporting data types (FP16, BF16, FP8) is essential for achieving peak performance on modern GPUs.

7. The **compute-to-bandwidth ratio** is increasing with each GPU generation, making operator fusion and algorithmic optimization (increasing arithmetic intensity) ever more important.

---

## 12. Further Reading

1. **NVIDIA.** *CUDA C++ Programming Guide*, v12.x. The definitive reference for the CUDA programming model. https://docs.nvidia.com/cuda/cuda-c-programming-guide/

2. **NVIDIA.** *CUDA C++ Best Practices Guide*. Practical optimization advice. https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/

3. **Kirk, D. B. & Hwu, W. W.** *Programming Massively Parallel Processors: A Hands-on Approach*, 4th Edition (2022). The best textbook for GPU architecture and CUDA programming.

4. **Jia, Z., Maggioni, M., Staiger, B., & Scarpazza, D. P.** "Dissecting the NVIDIA Volta GPU Architecture via Microbenchmarking." arXiv:1804.06826, 2018. Detailed empirical characterization of GPU microarchitecture.

5. **NVIDIA.** *H100 Tensor Core GPU Architecture Whitepaper*, 2022. Architectural deep dive into the Hopper GPU.

6. **NVIDIA.** *NVIDIA Blackwell Architecture Technical Brief*, 2024. Overview of B100/B200 innovations.

7. **Choquette, J.** "NVIDIA Hopper H100 GPU: Scaling Performance." *IEEE Micro*, 43(3), 2023. The chief GPU architect's perspective on the H100 design.

8. **Harris, M.** "An Even Easier Introduction to CUDA." NVIDIA Developer Blog, 2017. Gentle introduction for those new to CUDA.

9. **Volkov, V.** "Better Performance at Lower Occupancy." *GPU Technology Conference*, 2010. The seminal talk challenging the "maximize occupancy" dogma.
