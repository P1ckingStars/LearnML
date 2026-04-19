# Homework 0: Systems Bootcamp

> **Module 00 — Hardware & Compute Foundations (Pre-Work)**
> **Due:** First day of class
> **Estimated time:** 20 hours
> **Total points:** 200

---

## Instructions

- Show all work for analytical problems. A correct answer without justification receives no credit.
- For numerical calculations, state your assumptions clearly (hardware model, clock speed, memory configuration).
- For coding problems, submit clean, commented code and include all output/plots as described.
- You may use C, C++, Python (with NumPy), or CUDA. For GPU problems, you may use CUDA C++ or Triton (Python).
- Do **not** use high-level library functions that trivialize the problem (e.g., do not call `numpy.transpose` for Problem B1; do not use `cuBLAS` for Problem B3).
- Notation follows the course [NOTATION.md](../../NOTATION.md).
- Collaboration policy: you may discuss ideas with classmates, but write up all solutions independently. Cite any sources you consult beyond the lecture notes.
- Submit via the course portal: a single PDF for Part A, plus a tarball of your code and results for Part B.

---

## Part A: Analytical Problems (100 points)

### Problem A1: Cache Behavior Analysis (30 pts)

Consider a system with the following cache parameters:
- L1 data cache: 32 KiB, 8-way set-associative, 64-byte cache lines, LRU replacement
- L2 cache: 256 KiB, 8-way set-associative, 64-byte cache lines, LRU replacement
- L1 hit latency: 4 cycles, L2 hit latency: 12 cycles, memory latency: 200 cycles
- All arrays are aligned to cache-line boundaries

**Setup.** Consider the following C code operating on a row-major matrix `A` of `float` (4 bytes each) with dimensions $N \times N$:

```c
// Code Fragment 1: Row-major traversal
float sum = 0.0f;
for (int i = 0; i < N; i++)
    for (int j = 0; j < N; j++)
        sum += A[i][j];

// Code Fragment 2: Column-major traversal
float sum = 0.0f;
for (int j = 0; j < N; j++)
    for (int i = 0; i < N; i++)
        sum += A[i][j];
```

**(a)** (6 pts) For $N = 64$ (matrix size = 16 KiB), compute the L1 cache miss rate for both code fragments. Assume the cache is initially empty (cold start). Explain your reasoning, accounting for spatial locality and cache capacity.

**(b)** (6 pts) For $N = 256$ (matrix size = 256 KiB), compute the L1 cache miss rate for both code fragments. For Code Fragment 2, carefully analyze whether conflict misses occur and how many, given the set-associative structure. (Hint: compute how many rows of the matrix map to the same L1 cache set.)

**(c)** (6 pts) For $N = 256$ and Code Fragment 2, compute the average memory access time (AMAT) in cycles, assuming the L2 cache can hold the entire matrix. Use the formula:

$$\text{AMAT} = t_{L1} + r_{L1} \times (t_{L2} + r_{L2} \times t_{\text{mem}})$$

where $r_{L1}$ and $r_{L2}$ are the miss rates at each level.

**(d)** (6 pts) Now consider $N = 1024$ (matrix size = 4 MiB, exceeding both L1 and L2). Estimate the L1 and L2 miss rates for Code Fragment 2. What is the AMAT? How many times slower is Fragment 2 compared to Fragment 1?

**(e)** (6 pts) A student proposes "tiled column summation" with tile size $T$:

```c
float sum = 0.0f;
for (int ii = 0; ii < N; ii += T)
    for (int jj = 0; jj < N; jj += T)
        for (int j = jj; j < jj + T; j++)
            for (int i = ii; i < ii + T; i++)
                sum += A[i][j];
```

For $N = 1024$, what is the optimal tile size $T$ to minimize L1 misses? What L1 miss rate does this achieve? Show your work.

---

### Problem A2: Memory Bandwidth and Transfer Time (25 pts)

Consider an NVIDIA H100 SXM GPU with the following specifications:
- HBM3 bandwidth: 3.35 TB/s
- L2 cache: 50 MiB, bandwidth ~12 TB/s
- Shared memory bandwidth (aggregate across all SMs): ~20 TB/s
- PCIe Gen5 x16 bandwidth: 64 GB/s (each direction)
- NVLink 4.0 bandwidth: 900 GB/s (bidirectional total)

**Setup.** You are training a model with 7 billion parameters (FP16, 2 bytes per parameter). The training batch requires the following operations per iteration.

**(a)** (5 pts) How long does it take to load all 7B parameters from HBM into the SMs (assuming they do not fit in L2 cache)? How does this compare to the time to load them over PCIe from host memory? Over NVLink from another GPU?

**(b)** (5 pts) During the forward pass of a single linear layer $Y = XW$ where $X \in \mathbb{R}^{B \times d_{\text{in}}}$, $W \in \mathbb{R}^{d_{\text{in}} \times d_{\text{out}}}$, with $B = 2048$, $d_{\text{in}} = 4096$, $d_{\text{out}} = 4096$, FP16:

1. How many FLOPs does this operation require?
2. What is the arithmetic intensity (FLOP/byte)?
3. Is this operation compute-bound or memory-bound on the H100 (using FP16 Tensor Cores at 989 TFLOPS)?
4. What is the maximum achievable TFLOPS for this operation?

**(c)** (5 pts) Now consider the same linear layer in inference with batch size $B = 1$:

1. What is the arithmetic intensity?
2. What is the maximum achievable TFLOPS?
3. What is the GPU compute utilization (achieved TFLOPS / peak TFLOPS)?

This illustrates why LLM inference at small batch sizes is fundamentally different from training.

**(d)** (5 pts) During an AllReduce operation in data-parallel training across 8 GPUs connected via NVLink in a ring topology, 14 GB of gradients (7B params x 2 bytes) must be synchronized. Using the ring AllReduce algorithm (which requires $2 \times (N-1)/N$ data transfers, where $N$ is the number of GPUs), calculate:

1. The total data transferred per GPU.
2. The minimum time for the AllReduce, assuming the full bisection bandwidth of NVLink is usable.
3. What fraction of the iteration time is spent on communication if the compute portion (forward + backward) takes 50 ms?

**(e)** (5 pts) A data loading pipeline must deliver 2048 images per batch, each a $224 \times 224 \times 3$ JPEG image decoded to FP32 tensors, at a rate that keeps up with GPU training (one batch every 50 ms). Calculate:

1. The raw data size per batch (FP32 decoded images).
2. The minimum sustained memory bandwidth required to copy this batch to GPU-pinned memory.
3. If JPEG decoding takes ~0.5 ms per image on a single CPU core, how many worker threads are needed to keep up? Assume each worker can decode independently.

---

### Problem A3: Arithmetic Intensity and Roofline Classification (25 pts)

For each of the following operations, compute the arithmetic intensity analytically and classify it as **memory-bound** or **compute-bound** on an H100 SXM using FP16 Tensor Cores (peak 989 TFLOPS, HBM bandwidth 3.35 TB/s, ridge point $\approx 295$ FLOP/byte).

Assume all tensors are in FP16 (2 bytes per element) and are read from / written to HBM. Assume no caching effects (worst case: all data comes from HBM).

**(a)** (5 pts) **Residual connection**: $Y = X + F(X)$, where $X, F(X), Y \in \mathbb{R}^{B \times S \times d}$ with $B = 32$, $S = 2048$, $d = 4096$.

**(b)** (5 pts) **GELU activation**: $Y_i = x_i \cdot \Phi(x_i)$ where $\Phi$ is the Gaussian CDF (approximate as $\sim 8$ FLOPs per element), applied to a tensor of shape $(B, S, d)$ with the same dimensions.

**(c)** (5 pts) **Batched matrix multiply (BMM)**: Computing $QK^T$ for multi-head attention. $Q, K \in \mathbb{R}^{B \times h \times S \times d_k}$ with $B = 32$, $h = 32$, $S = 2048$, $d_k = 128$. The output is $\mathbb{R}^{B \times h \times S \times S}$.

Hint: This is a batched GEMM with batch dimension $B \times h = 1024$, and each matrix multiply is $(S \times d_k) \times (d_k \times S)$.

**(d)** (5 pts) **Embedding table lookup**: Looking up $B \times S = 32 \times 2048 = 65{,}536$ embedding vectors from a table of size $V \times d$ with $V = 32{,}000$ and $d = 4096$. Assume each lookup is a random access (no spatial locality).

Hint: The "compute" here is essentially zero (just a copy). What is the effective AI? What limits performance?

**(e)** (5 pts) **Fused attention block** (FlashAttention-style): Consider the entire attention computation $\text{softmax}(QK^T / \sqrt{d_k})V$ fused into a single kernel, where $Q, K, V, O \in \mathbb{R}^{B \times h \times S \times d_k}$ with the same dimensions as (c). The fused kernel reads Q, K, V from HBM and writes O to HBM, with no intermediate HBM traffic. Compute total FLOPs (include both $QK^T$ and $\text{score} \times V$ GEMMs, plus softmax at $\sim 5S$ per row), total HBM bytes, and the resulting AI.

---

### Problem A4: Occupancy Calculation (20 pts)

Consider the following CUDA kernel configuration on an NVIDIA H100 SM. The H100 SM has:
- 65,536 32-bit registers
- Maximum 2,048 threads per SM (64 warps)
- Maximum 32 thread blocks per SM
- Configurable shared memory up to 228 KiB per SM

For each kernel configuration below, compute the occupancy (as a percentage) and identify the **binding constraint** (registers, shared memory, threads, or blocks).

**(a)** (5 pts) Block size = 128 threads, 32 registers/thread, 0 bytes shared memory per block.

**(b)** (5 pts) Block size = 256 threads, 64 registers/thread, 32 KiB shared memory per block.

**(c)** (5 pts) Block size = 512 threads, 96 registers/thread, 48 KiB shared memory per block.

**(d)** (5 pts) A kernel for tiled GEMM uses block size 256, 128 registers/thread, and 96 KiB shared memory per block. Compute the occupancy. The programmer considers two changes:

1. Reduce register usage to 80 per thread by spilling some values to local memory.
2. Reduce shared memory to 48 KiB by using a smaller tile.

For each change independently, compute the new occupancy. Which change is more beneficial, and what trade-offs should be considered?

---

## Part B: Implementation (100 points)

### Problem B1: Cache-Friendly Matrix Transpose (35 pts)

Implement and benchmark three matrix transpose algorithms for an $N \times N$ matrix of `float` values in C or C++:

1. **Naive transpose**: Directly write `B[j][i] = A[i][j]`.
2. **Tiled transpose**: Use cache blocking with a tile size chosen for your machine's L1 cache.
3. **Tiled transpose with software prefetching**: Add explicit prefetch hints (e.g., `__builtin_prefetch`) for the next tile.

**(a)** (10 pts) Implement all three versions. Your code should be correct (verify by checking $B^T = A$) and well-documented.

**(b)** (10 pts) Benchmark all three versions for $N \in \{256, 512, 1024, 2048, 4096, 8192\}$. Report:
- Achieved bandwidth (GB/s) calculated as $2N^2 \times 4 / t$ (read + write of $N^2$ floats).
- Execution time in milliseconds.

Plot achieved bandwidth vs. $N$ for all three implementations on a single graph.

**(c)** (5 pts) Use `perf stat` or `cachegrind` to measure L1 cache miss rates for the naive and tiled versions at $N = 4096$. Report the miss counts and discuss whether they match your analytical predictions from Problem A1.

**(d)** (5 pts) Experiment with tile sizes $T \in \{8, 16, 32, 64, 128\}$ at $N = 4096$. Plot bandwidth vs. tile size. Explain the results in terms of your machine's cache parameters.

**(e)** (5 pts) Briefly compare your achieved bandwidth to the theoretical STREAM bandwidth of your machine. What fraction of peak memory bandwidth does your best transpose achieve? Why is it less than 100%?

**Deliverables**: Source code (`transpose.c` or `transpose.cpp`), a `Makefile` or build instructions, benchmark results as a CSV file, and plots as PDF or PNG.

---

### Problem B2: Memory Access Pattern Profiling (30 pts)

Write a benchmark program that measures the effective memory bandwidth for different access patterns, demonstrating the concepts from Lecture 00a and 00b.

**(a)** (10 pts) Implement the following memory access patterns operating on a large array ($\geq 100$ MiB) of `float`:
1. **Sequential read**: Iterate through the array in order, summing elements.
2. **Sequential write**: Write a constant to each element in order.
3. **Strided read**: Read every $k$-th element for $k \in \{1, 2, 4, 8, 16, 32, 64, 128\}$.
4. **Random read**: Read elements at uniformly random indices (pre-generate the index array to avoid measuring the RNG).

For each pattern, report the effective bandwidth (useful bytes transferred / time).

**(b)** (10 pts) Plot the results:
- Plot 1: Effective bandwidth vs. stride for strided reads. Explain the shape of the curve in terms of cache-line utilization.
- Plot 2: Compare sequential read, sequential write, and random read bandwidths. Discuss the ratio between sequential and random access in terms of cache architecture.

**(c)** (10 pts) **Linked-list pointer chasing** (latency measurement): Create a linked list of $N$ nodes laid out in memory in:
1. Sequential order (node $i$ at offset $i \times \text{sizeof(node)}$).
2. Random order (nodes shuffled randomly in memory).

Traverse each list and measure the average time per node access (in nanoseconds). For the sequential list, vary the node spacing (by padding) to sizes $\{64, 128, 256, 512, 1024, 4096\}$ bytes. Plot access latency vs. node spacing. Explain the "steps" in the latency curve in terms of L1, L2, L3 cache line and capacity boundaries. (Hint: when the working set exceeds a cache level's capacity, latency will jump to the next level.)

**Deliverables**: Source code, benchmark results as CSV, and all plots as PDF or PNG.

---

### Problem B3: Roofline Plot Construction (35 pts)

Construct a roofline plot for a GPU you have access to (any NVIDIA GPU with CUDA support; if you do not have GPU access, use Google Colab with a T4 or A100).

**(a)** (10 pts) **Measure the hardware ceilings:**

1. **Peak HBM bandwidth**: Implement a simple CUDA kernel (or use a large `cudaMemcpy`) that moves data between HBM and the SMs as fast as possible. Report the measured bandwidth in GB/s. Compare to the GPU's spec-sheet bandwidth and compute the efficiency (measured / theoretical).

2. **Peak FLOPS**: Implement a CUDA kernel (or use `cuBLAS` GEMM with a large matrix, e.g., $8192 \times 8192$) that achieves peak compute. Report the measured TFLOPS for FP32 and FP16 (or BF16 if available). Compare to spec-sheet values.

3. **Compute the ridge point** for FP32 and FP16.

**(b)** (10 pts) **Profile ML kernels.** Using PyTorch, measure the execution time and compute the arithmetic intensity for each of the following operations on your GPU. Use tensor sizes representative of a typical Transformer: $B = 16$, $S = 1024$, $d = 2048$, $h = 16$, $d_k = 128$.

1. Elementwise ReLU on a $(B, S, d)$ tensor.
2. LayerNorm on a $(B, S, d)$ tensor.
3. Linear layer (no bias): $(B \times S, d) \times (d, d)$.
4. Batched matrix multiply: $(B \times h, S, d_k) \times (B \times h, d_k, S)$ (the $QK^T$ computation).
5. `torch.nn.functional.scaled_dot_product_attention` (which uses FlashAttention on supported GPUs).

For each, report:
- Input/output tensor sizes and bytes.
- Analytically computed FLOPs.
- Measured execution time (use `torch.cuda.Event` for accurate timing; average over 100 iterations after 10 warmup iterations).
- Achieved GFLOPS/TFLOPS.
- Arithmetic intensity.

**(c)** (10 pts) **Construct the roofline plot.** Create a log-log plot with:
- X-axis: Arithmetic intensity (FLOP/byte).
- Y-axis: Performance (GFLOPS or TFLOPS).
- The FP32 and FP16 (or BF16) roofline curves using your measured ceilings from (a).
- All five kernels from (b) plotted as labeled points.
- Clear labels, title, and legend.

**(d)** (5 pts) **Analysis.** Based on your roofline plot, answer:
1. Which operations are memory-bound? Which are compute-bound?
2. For the memory-bound operations, how far below the bandwidth roof are they? What might explain the gap?
3. How does FlashAttention (operation 5) compare to the explicit $QK^T$ BMM (operation 4) in terms of achieved performance and arithmetic intensity? Does this match the theoretical analysis from Lecture 00c?

**Deliverables**: Source code (Python scripts for profiling, CUDA code for peak measurements), a PDF containing the roofline plot and analysis, and raw measurement data as CSV.

---

## Grading Rubric Summary

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Cache Behavior | 30 | Correct miss rate calculations, clear reasoning about associativity and conflict misses |
| A2: Bandwidth & Transfer | 25 | Correct arithmetic, proper unit handling, insightful comparisons |
| A3: Roofline Classification | 25 | Correct AI calculations, proper FLOP/byte counting, correct classification |
| A4: Occupancy | 20 | Correct application of all three resource limits, correct identification of binding constraint |
| B1: Matrix Transpose | 35 | Correct implementations, comprehensive benchmarks, clear analysis |
| B2: Access Patterns | 30 | Working benchmarks, correct bandwidth calculations, insightful analysis of cache effects |
| B3: Roofline Plot | 35 | Accurate measurements, correct AI calculations, publication-quality plot, thoughtful analysis |
| **Total** | **200** | |
