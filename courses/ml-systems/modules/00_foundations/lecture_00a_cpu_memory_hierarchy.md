# Lecture 00a: CPU Architecture & Memory Hierarchy

> **Module 00 — Hardware & Compute Foundations (Pre-Work)**
> Estimated study time: 6--8 hours

---

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Describe** the Von Neumann architecture and explain how pipelining, superscalar execution, and out-of-order execution exploit instruction-level parallelism.
2. **Analyze** cache behavior for a given memory access pattern, computing hit rates, miss rates, and the effect of associativity and replacement policies.
3. **Calculate** effective memory bandwidth and latency for multi-level cache hierarchies using concrete hardware numbers.
4. **Distinguish** between cache-oblivious and cache-aware algorithm design and explain their trade-offs for ML workloads.
5. **Evaluate** how NUMA topology and memory placement affect the performance of data loading and preprocessing pipelines in ML training.

---

## 2. Motivation and Context

Before a single gradient is computed, before a GPU kernel launches, data must be fetched, decoded, preprocessed, and batched -- all on CPUs. In large-scale ML training, CPU-side bottlenecks in data loading routinely leave expensive GPUs idle. Understanding CPU architecture is not an academic exercise; it is the foundation upon which every systems optimization rests.

The story begins with John von Neumann's 1945 draft report on the EDVAC, which established the stored-program architecture that underpins virtually all modern CPUs. The key insight -- that instructions and data share the same memory -- enabled general-purpose computation but introduced the fundamental tension between processor speed and memory speed that defines systems performance to this day.

Over the past five decades, processor clock speeds have improved by roughly $10^4\times$ while DRAM latency has improved by only $\sim 10\times$. This "memory wall" (Wulf & McKee, 1995) means that a modern CPU core can execute hundreds of instructions in the time it takes to service a single main memory access. The entire edifice of caches, prefetchers, out-of-order execution engines, and NUMA architectures exists to hide this latency gap. As ML systems engineers, we must understand these mechanisms to write code that works with the hardware rather than against it.

---

## 3. The Von Neumann Architecture

### 3.1 Core Components

The Von Neumann architecture consists of five components:

1. **Central Processing Unit (CPU)**: Contains the Arithmetic Logic Unit (ALU) and the Control Unit.
2. **Memory**: A single address space holding both instructions and data.
3. **Input/Output**: Interfaces to external devices.
4. **Bus**: The communication channel connecting CPU to memory.

The defining characteristic is the **Von Neumann bottleneck**: the bus between CPU and memory is a shared, finite-bandwidth channel. Every instruction fetch and every data access competes for this channel.

### 3.2 The Fetch-Decode-Execute Cycle

At its simplest, a CPU executes instructions in a loop:

```
1. FETCH:   Read instruction from memory at address PC (program counter)
2. DECODE:  Determine the operation and operands
3. EXECUTE: Perform the operation (arithmetic, memory load/store, branch)
4. WRITEBACK: Store result to register or memory
5. PC <- PC + 1 (or branch target)
```

On a single-cycle processor, each instruction takes one (long) clock cycle. This is extremely wasteful because each functional unit is active for only a fraction of the cycle.

---

## 4. Instruction-Level Parallelism

### 4.1 Pipelining

**Pipelining** overlaps the execution of multiple instructions by breaking the fetch-decode-execute cycle into discrete stages, each handled by dedicated hardware. A classic 5-stage pipeline uses:

| Stage | Abbreviation | Function |
|-------|-------------|----------|
| 1 | IF | Instruction Fetch |
| 2 | ID | Instruction Decode / Register Read |
| 3 | EX | Execute / ALU |
| 4 | MEM | Memory Access |
| 5 | WB | Write Back |

With a $k$-stage pipeline, the ideal throughput is one instruction per cycle (IPC = 1), and the latency of each instruction is $k$ cycles. The speedup over a single-cycle design approaches $k$ in the ideal case.

**Pipeline hazards** limit this ideal:

- **Data hazards**: An instruction depends on the result of a preceding instruction still in the pipeline. Mitigation: forwarding/bypassing, pipeline stalls.
- **Control hazards**: Branch instructions change the PC, but the branch outcome is not known until the EX stage. Mitigation: branch prediction, speculative execution.
- **Structural hazards**: Two instructions need the same hardware resource simultaneously. Mitigation: duplicating functional units.

**Example.** Consider three instructions:
```
ADD R1, R2, R3    ; R1 = R2 + R3
SUB R4, R1, R5    ; R4 = R1 - R5  (data hazard: depends on R1)
MUL R6, R4, R7    ; R6 = R4 * R7  (data hazard: depends on R4)
```
Without forwarding, the SUB must stall 2 cycles waiting for ADD to reach WB. With forwarding, the ALU result from ADD's EX stage is forwarded directly to SUB's EX stage, eliminating the stall.

### 4.2 Superscalar Execution

A **superscalar** processor issues multiple instructions per cycle by replicating functional units. A 4-wide superscalar core can potentially execute 4 instructions per cycle, achieving IPC > 1.

Modern server-class CPUs are aggressively superscalar:

| CPU | Year | Pipeline Width | Issue Width |
|-----|------|---------------|-------------|
| Intel Skylake | 2015 | 14--19 stages | 4 uops/cycle |
| AMD Zen 4 | 2022 | ~19 stages | 6 uops/cycle |
| Apple M2 (P-core) | 2022 | ~16 stages | 8 uops/cycle |
| Intel Sapphire Rapids | 2023 | ~20 stages | 6 uops/cycle |

The practical IPC achieved is typically 2--4 due to dependencies and resource conflicts.

### 4.3 Out-of-Order Execution

**Out-of-order (OoO) execution** allows the CPU to execute instructions in a different order than they appear in the program, as long as data dependencies are respected. This is critical for hiding memory latency: while one instruction stalls waiting for a cache miss, independent instructions can proceed.

The OoO engine maintains:

- **Reorder Buffer (ROB)**: Tracks instructions in program order for correct retirement.
- **Reservation Stations**: Hold instructions waiting for operands, dispatching them to functional units when ready.
- **Register Renaming**: Maps architectural registers to a larger set of physical registers, eliminating false (WAR, WAW) dependencies.

**Why this matters for ML.** Consider a data preprocessing pipeline that interleaves memory-intensive image decoding with compute-intensive augmentation. An OoO core can overlap the latency of memory loads from decoding with the ALU work of augmentations, significantly improving throughput. Understanding this interaction is essential for writing efficient CPU-side data pipelines.

---

## 5. The Memory Hierarchy

### 5.1 Latency and Bandwidth at Each Level

The memory hierarchy trades off capacity, latency, and bandwidth:

| Level | Typical Size | Latency (cycles) | Latency (ns) | Bandwidth |
|-------|-------------|-------------------|---------------|-----------|
| Registers | ~1 KiB | 0 | ~0.3 | N/A (in-core) |
| L1 Cache | 32--80 KiB | 4--5 | ~1.5 | ~1--3 TB/s |
| L2 Cache | 256 KiB -- 2 MiB | 12--15 | ~4--5 | ~500 GB/s -- 1 TB/s |
| L3 Cache | 8--128 MiB (shared) | 30--50 | ~10--15 | ~200--500 GB/s |
| Main Memory (DDR5) | 32--512 GiB | 150--300 | ~50--100 | 50--100 GB/s |
| NVMe SSD | 1--8 TB | -- | ~10,000 | ~7 GB/s |

These numbers are approximate for a 2024-era server-class CPU (e.g., Intel Sapphire Rapids, AMD Genoa) at ~3--4 GHz. The key observation is the roughly $100\times$ gap between L1 and main memory latency and the roughly $10$--$50\times$ gap in bandwidth.

### 5.2 Cache Lines and Spatial Locality

Caches do not transfer individual bytes; they transfer **cache lines**, typically 64 bytes on x86 (some ARM designs use 128 bytes). When a byte at address $a$ is requested and is not in cache (a miss), the entire cache line containing addresses $\lfloor a/64 \rfloor \times 64$ through $\lfloor a/64 \rfloor \times 64 + 63$ is fetched.

This design exploits **spatial locality**: programs that access memory sequentially (e.g., iterating over an array) pay the miss penalty once per cache line, then get $(64/\text{element\_size} - 1)$ subsequent hits for free.

**Numerical example.** Consider iterating over a contiguous array of FP32 values (4 bytes each). Each cache line holds $64/4 = 16$ elements. The cold miss rate is $1/16 = 6.25\%$. In contrast, a random access pattern over a large array achieves close to a 100% miss rate (assuming the array exceeds cache capacity), yielding a $\sim 16\times$ slowdown for this data type.

### 5.3 Associativity and Set-Associative Caches

A cache with $S$ sets and $E$ lines per set (called $E$-way set-associative) maps memory address $a$ to set index:

$$\text{set\_index} = \left\lfloor \frac{a}{B} \right\rfloor \bmod S$$

where $B$ is the cache line size in bytes. The total cache size is $C = S \times E \times B$.

Common associativity values:

| Cache Level | Typical Associativity |
|-------------|----------------------|
| L1 | 8-way or 12-way |
| L2 | 8-way or 16-way |
| L3 | 12-way to 16-way |

**Conflict misses** occur when more than $E$ frequently-accessed addresses map to the same set. This is particularly pernicious for power-of-two strides:

**Example.** Suppose L1 is 32 KiB, 8-way set-associative, 64 B lines. Then $S = 32768 / (8 \times 64) = 64$ sets. A stride of $64 \times 64 = 4096$ bytes means every access maps to the same set. Accessing 9 or more elements at this stride will cause conflict misses on every access, despite the cache being mostly empty. This is precisely the pathological pattern encountered when traversing columns of a large row-major matrix whose row size is a multiple of 4 KiB.

### 5.4 Replacement Policies

When a cache set is full and a new line must be brought in, a **replacement policy** selects which line to evict:

- **LRU (Least Recently Used)**: Evict the line unused for the longest time. Optimal for simple temporal locality patterns but expensive to implement exactly for high associativity.
- **Pseudo-LRU**: Approximations used in practice (e.g., tree-based PLRU). Most modern Intel CPUs use adaptive replacement policies.
- **Random**: Simpler to implement; sometimes competitive with LRU for certain access patterns.

For ML workloads with streaming access patterns (e.g., scanning a dataset), LRU performs poorly because each element is used once and evicts potentially useful data. This motivates **cache bypassing** hints and **non-temporal stores** (e.g., `_mm_stream_ps` on x86), which write directly to memory without polluting caches.

### 5.5 Hardware Prefetching

Modern CPUs include hardware **prefetchers** that detect sequential and strided access patterns and speculatively fetch cache lines before they are requested. Common prefetcher types:

- **Next-line prefetcher**: Fetches line $N+1$ when line $N$ is accessed.
- **Stride prefetcher**: Detects constant-stride patterns and prefetches accordingly.
- **Spatial prefetcher**: Fetches the other half of a 128-byte aligned pair when one half is accessed.

Prefetching is effective for predictable access patterns (array scans, matrix row traversals) but fails for irregular patterns (pointer chasing, hash table lookups, sparse matrix operations).

**Software prefetch** instructions (`__builtin_prefetch` in GCC/Clang, `_mm_prefetch` with SSE) allow the programmer to insert prefetch hints. These can be useful when the hardware prefetcher cannot detect the pattern, but they add instruction overhead and can pollute caches if misused.

---

## 6. Memory Bandwidth Analysis

### 6.1 Bandwidth-Bound Computations

A computation is **memory-bandwidth-bound** when the rate at which it can consume data from memory exceeds the rate at which it performs arithmetic. Formally, if a kernel performs $W$ FLOPs on $Q$ bytes of data transferred from memory, then:

$$\text{Arithmetic Intensity (AI)} = \frac{W}{Q} \quad \text{[FLOP/byte]}$$

The kernel is bandwidth-bound when $\text{AI} < \text{Peak FLOPS} / \text{Peak BW}$ (the machine's ridge point; see Lecture 00c).

### 6.2 Stream Benchmark and Achievable Bandwidth

The STREAM benchmark (McCalpin, 1995) measures sustainable memory bandwidth for four simple vector kernels:

| Kernel | Operation | Bytes/element | FLOPs/element |
|--------|-----------|--------------|---------------|
| Copy | $a[i] = b[i]$ | $2 \times 8 = 16$ | 0 |
| Scale | $a[i] = \alpha \cdot b[i]$ | 16 | 1 |
| Add | $a[i] = b[i] + c[i]$ | 24 | 1 |
| Triad | $a[i] = b[i] + \alpha \cdot c[i]$ | 24 | 2 |

**Concrete numbers.** A dual-socket AMD EPYC 9654 (Genoa) system with 12-channel DDR5-4800:

- Theoretical peak bandwidth: $2 \times 12 \times 4800 \times 8 = 921.6$ GB/s
- STREAM Triad measured: ~700--760 GB/s (~80% efficiency)
- Single-socket: ~380 GB/s

A single Intel Sapphire Rapids socket with 8-channel DDR5-4800:

- Theoretical peak: $8 \times 4800 \times 8 = 307.2$ GB/s
- STREAM Triad: ~240--260 GB/s

### 6.3 Worked Example: Matrix-Vector Multiply

Consider $\mathbf{y} = A\mathbf{x}$ where $A \in \mathbb{R}^{M \times N}$, $\mathbf{x} \in \mathbb{R}^N$, $\mathbf{y} \in \mathbb{R}^M$, all in FP64 (8 bytes).

**FLOPs**: Each element of $\mathbf{y}$ requires $N$ multiplications and $N - 1$ additions, so total FLOPs $\approx 2MN$.

**Bytes transferred** (assuming $A$ does not fit in cache): $A$ contributes $8MN$ bytes, $\mathbf{x}$ contributes $8N$ bytes (reused across rows if cached), $\mathbf{y}$ contributes $8M$ bytes for writes.

$$\text{AI} = \frac{2MN}{8MN + 8N + 8M} \approx \frac{2MN}{8MN} = \frac{1}{4} \text{ FLOP/byte}$$

for large $M$. On a machine with peak BW = 300 GB/s and peak FLOPS = 2 TFLOPS (FP64):

$$\text{Ridge point} = \frac{2000}{300} \approx 6.7 \text{ FLOP/byte}$$

Since $0.25 \ll 6.7$, matrix-vector multiply is **severely bandwidth-bound**. The maximum achievable performance is:

$$\text{Perf} = \text{AI} \times \text{BW} = 0.25 \times 300 = 75 \text{ GFLOPS}$$

which is only 3.75% of peak FLOPS. This is why BLAS Level 2 operations (matrix-vector) are fundamentally less efficient than Level 3 (matrix-matrix) operations.

---

## 7. Cache-Aware vs. Cache-Oblivious Algorithms

### 7.1 Cache-Aware Design: Tiled Matrix Multiply

A cache-aware algorithm explicitly parameterizes its access patterns by cache size. The canonical example is **tiled (blocked) matrix multiplication**.

Naive matrix multiply $C = AB$ where $A, B, C \in \mathbb{R}^{N \times N}$:

```c
for (int i = 0; i < N; i++)
    for (int j = 0; j < N; j++)
        for (int k = 0; k < N; k++)
            C[i][j] += A[i][k] * B[k][j];
```

The inner loop traverses column $j$ of $B$ (stride $N$ in row-major layout), causing a cache miss nearly every access for large $N$. Total cache misses: $\Theta(N^3/B)$ where $B$ is the cache line size (in elements), assuming the matrices do not fit in cache.

**Tiled version** with block size $T$ chosen so that three $T \times T$ tiles fit in cache (i.e., $3T^2 \times \text{element\_size} \leq C_{\text{cache}}$):

```c
for (int ii = 0; ii < N; ii += T)
    for (int jj = 0; jj < N; jj += T)
        for (int kk = 0; kk < N; kk += T)
            for (int i = ii; i < min(ii+T, N); i++)
                for (int j = jj; j < min(jj+T, N); j++)
                    for (int k = kk; k < min(kk+T, N); k++)
                        C[i][j] += A[i][k] * B[k][j];
```

Cache misses: $\Theta(N^3/(B\sqrt{M}))$ where $M$ is the cache size (in elements). This is a $\sqrt{M}$ improvement. For $M = 256\text{ KiB} / 8 = 32768$ doubles, $\sqrt{M} \approx 181$, a substantial reduction.

### 7.2 Cache-Oblivious Design

A **cache-oblivious** algorithm achieves asymptotically optimal cache performance without knowing cache parameters ($B$, $M$). The key technique is **recursive decomposition**: divide the problem into sub-problems until they fit in cache at whatever level of the hierarchy.

**Cache-oblivious matrix multiply** (Frigo et al., 1999):

```
function matmul(C, A, B, n):
    if n <= BASE:
        // naive multiply
        return
    // split along largest dimension
    matmul(C11, A11, B11, n/2)
    matmul(C11, A12, B21, n/2)  // accumulate
    matmul(C12, A11, B12, n/2)
    matmul(C12, A12, B22, n/2)
    matmul(C21, A21, B11, n/2)
    matmul(C21, A22, B21, n/2)
    matmul(C22, A21, B12, n/2)
    matmul(C22, A22, B22, n/2)
```

This achieves cache complexity $\Theta(N^3/(B\sqrt{M}))$ -- the same as the optimal cache-aware version -- for every level of the cache hierarchy simultaneously, without tuning block sizes.

### 7.3 Trade-offs for ML Workloads

| Criterion | Cache-Aware | Cache-Oblivious |
|-----------|-------------|-----------------|
| Performance | Higher (tuned) | Slightly lower (recursion overhead) |
| Portability | Must retune per machine | Portable across hardware |
| Multi-level caches | Optimizes one level | Optimizes all levels |
| Implementation | Simpler loops | Recursive, complex indexing |

In practice, high-performance BLAS libraries (OpenBLAS, MKL, BLIS) use cache-aware tiling with auto-tuning. Cache-oblivious ideas appear in frameworks that must run across diverse hardware without per-machine tuning (e.g., some data pipeline implementations).

For ML specifically:

- **GEMM**: Always use tuned BLAS. The library handles tiling.
- **Data preprocessing**: Often involves irregular access patterns (image crops, random augmentations). Cache-oblivious recursive approaches can help, but the dominant factor is usually I/O bandwidth.
- **Sparse operations**: Irregular access patterns make caching difficult; explicit data structure design (CSR, CSC, block-sparse) is more impactful than cache-level tuning.

---

## 8. NUMA Architectures

### 8.1 What Is NUMA?

In a **Non-Uniform Memory Access (NUMA)** system, memory is physically distributed across multiple memory controllers (typically one per CPU socket). Every core can access all memory, but accessing **local** memory (attached to the core's own socket) is faster than accessing **remote** memory (attached to another socket, reached via an interconnect).

```
[Diagram: Two-socket NUMA system]

+------------------+        Interconnect        +------------------+
|   Socket 0       |<=========================>|   Socket 1       |
|  Cores 0-63      |   (UPI / Infinity Fabric)  |  Cores 64-127    |
|  L3 Cache        |                            |  L3 Cache        |
|  Memory Ctrl 0   |                            |  Memory Ctrl 1   |
+--------|---------+                            +--------|---------+
         |                                               |
   DDR5 Channels                                   DDR5 Channels
   (Local Memory 0)                                (Local Memory 1)
```

### 8.2 NUMA Latency and Bandwidth Impact

Typical NUMA ratios for modern dual-socket servers:

| Access Type | Latency | Bandwidth |
|-------------|---------|-----------|
| Local DRAM | ~80 ns | ~380 GB/s per socket |
| Remote DRAM (1 hop) | ~140 ns (1.7x) | ~190 GB/s (0.5x) |

The **NUMA ratio** (remote/local latency) is typically 1.5--2.0x. For bandwidth, the penalty is even more severe because the interconnect bandwidth is shared and limited.

### 8.3 NUMA and ML Data Loading

In a typical training setup, the CPU data loading pipeline runs across multiple cores and feeds data to GPUs:

1. **Problem**: If a DataLoader worker on Socket 0 allocates memory on Socket 1 (due to the OS default "first-touch" policy or interleaving), every access pays the remote latency penalty.

2. **Solution**: Pin workers to specific NUMA nodes and ensure memory allocation is local.

```python
# Example: NUMA-aware data loading with numactl
# Launch training with pinned NUMA allocation:
# numactl --cpunodebind=0 --membind=0 python train.py

# Or within Python using os.sched_setaffinity:
import os
os.sched_setaffinity(0, set(range(0, 64)))  # pin to cores on NUMA node 0
```

3. **GPU affinity**: In multi-GPU systems, each GPU is physically closer to one CPU socket (connected via PCIe to that socket's root complex). Mismatched NUMA placement causes CPU-to-GPU transfers to traverse the inter-socket link, adding latency.

You can inspect NUMA topology with:
```bash
numactl --hardware
lscpu | grep NUMA
nvidia-smi topo -m   # shows GPU-to-CPU affinity
```

### 8.4 NUMA-Aware Memory Allocation Policies

Linux provides several NUMA allocation policies:

| Policy | Behavior |
|--------|----------|
| `local` (default) | Allocate on the node where the thread runs |
| `bind` | Restrict allocation to specified nodes |
| `interleave` | Round-robin pages across specified nodes |
| `preferred` | Try specified node, fall back to others |

For ML workloads:
- **Training data buffers**: Use `bind` to the node closest to the GPU.
- **Large shared datasets**: Use `interleave` to spread bandwidth load.
- **Small, frequently-accessed structures**: Use `local` to minimize latency.

---

## 9. Implications for ML Workloads

### 9.1 CPU-Bound Operations in ML

Despite the focus on GPUs, several critical ML operations are CPU-bound:

1. **Data decoding and augmentation**: JPEG/PNG decoding, random crops, color jitter, tokenization.
2. **Feature engineering**: Tabular data preprocessing, embedding table lookups (in recommendation systems).
3. **Graph construction**: Building adjacency structures for GNNs.
4. **Sparse operations**: Some sparse tensor operations fall back to CPU.
5. **Communication orchestration**: Collective communication setup, gradient synchronization control flow.

### 9.2 Data Loading: A Microcosm of CPU Systems

PyTorch's `DataLoader` with `num_workers > 0` spawns worker processes that:

1. Read raw data from storage (I/O bound -- SSD bandwidth).
2. Decode compressed formats (CPU bound -- instruction throughput).
3. Apply transforms (CPU bound -- mix of compute and memory).
4. Copy tensors to pinned memory (memory bandwidth bound).
5. Transfer to GPU via DMA (PCIe bandwidth bound).

Each stage has a different bottleneck. Optimizing the pipeline requires understanding all the architectural concepts in this lecture:

- **Pipelining**: Each worker is a "pipeline stage." More workers increase throughput up to the hardware parallelism limit.
- **Cache effects**: Augmentations that access pixels in random order (e.g., elastic deformation) are cache-unfriendly. Operating on contiguous tiles is faster.
- **Prefetching**: The `prefetch_factor` parameter controls how many batches each worker prepares ahead, hiding I/O latency.
- **NUMA**: Workers should be pinned to the NUMA node closest to the target GPU.

### 9.3 Vectorization (SIMD)

Modern CPUs include **SIMD (Single Instruction, Multiple Data)** units that process multiple data elements per instruction:

| ISA Extension | Width | FP32 elements/instruction |
|---------------|-------|--------------------------|
| SSE (x86) | 128 bit | 4 |
| AVX2 (x86) | 256 bit | 8 |
| AVX-512 (x86) | 512 bit | 16 |
| ARM NEON | 128 bit | 4 |
| ARM SVE | 128--2048 bit | 4--64 |

For an ML preprocessing kernel processing FP32 pixels, AVX-512 provides a theoretical $16\times$ speedup over scalar code. Achieving this requires:

- **Aligned memory**: Data should be aligned to the SIMD width (64 bytes for AVX-512).
- **Contiguous access**: Gather/scatter instructions exist but are much slower than contiguous loads.
- **No branches**: SIMD processes all lanes uniformly; branches require masking.

Libraries like Intel MKL, OpenCV (with IPP backend), and DALI leverage SIMD extensively for image preprocessing.

---

## 10. Key Takeaways

1. The **Von Neumann bottleneck** -- the gap between processor speed and memory speed -- is the central constraint in CPU performance. Caches, prefetchers, and OoO execution are all mechanisms to mitigate it.

2. **Cache behavior** is determined by three types of misses: compulsory (cold), capacity, and conflict. Understanding associativity and access stride lets you predict and avoid conflict misses.

3. **Memory bandwidth** is a hard limit for data-intensive operations. Matrix-vector multiply achieves only a few percent of peak FLOPS because its arithmetic intensity ($\sim 0.25$ FLOP/byte) is far below the machine's ridge point.

4. **Cache-aware algorithms** (tiling) can reduce cache misses by $\sqrt{M}\times$ for matrix operations. Cache-oblivious algorithms achieve this automatically across all cache levels.

5. **NUMA effects** can cause 1.5--2x performance degradation if memory placement is not considered. For multi-GPU training, NUMA-aware worker placement and memory binding are essential.

6. For ML systems, the CPU is not "just the host" -- it is a complex memory system where data loading, preprocessing, and communication orchestration bottleneck. Understanding CPU architecture is prerequisite to diagnosing and optimizing end-to-end training throughput.

---

## 11. Further Reading

1. **Hennessy, J. L. & Patterson, D. A.** *Computer Architecture: A Quantitative Approach*, 6th Edition (2017). Chapters 2 (memory hierarchy) and 3 (ILP) provide the definitive treatment.

2. **Wulf, W. A. & McKee, S. A.** "Hitting the Memory Wall: Implications of the Obvious." *ACM SIGARCH Computer Architecture News*, 23(1), 1995. The seminal paper on the processor-memory speed gap.

3. **Frigo, M., Leiserson, C. E., Prokop, H., & Ramachandran, S.** "Cache-Oblivious Algorithms." *FOCS*, 1999. Introduces the cache-oblivious model and key algorithms.

4. **Drepper, U.** "What Every Programmer Should Know About Memory." 2007. Comprehensive treatment of memory hierarchy, NUMA, and practical implications. Available at: https://people.freebsd.org/~lstewart/articles/cpumemory.pdf

5. **McCalpin, J. D.** "Memory Bandwidth and Machine Balance in Current High Performance Computers." *IEEE TCCA Newsletter*, 1995. Introduces the STREAM benchmark.

6. **Lameter, C.** "NUMA (Non-Uniform Memory Access): An Overview." *ACM Queue*, 11(7), 2013. Practical guide to NUMA systems and Linux NUMA policies.

7. **Goto, K. & van de Geijn, R. A.** "Anatomy of High-Performance Matrix Multiplication." *ACM TOMS*, 34(3), 2008. Details how BLAS Level 3 is implemented with cache tiling.

8. **Murray, D. G., Simsa, J., Klimovic, A., & Indyk, I.** "tf.data: A Machine Learning Data Processing Framework." *VLDB*, 2021. Shows how data pipeline design interacts with CPU systems for ML training.
