# Mini-Project 1: Custom Kernel Optimization

**Course:** Machine Learning Systems (PhD Track)
**Due:** Week 8
**Weight:** 10% of final grade
**Format:** Individual

---

## Overview

In this project, you will write, optimize, and rigorously benchmark a GPU kernel for a core ML operator. You will start with a naive implementation, apply a sequence of hardware-aware optimizations, and measure the impact of each optimization level. The final kernel will be benchmarked against production-quality libraries (cuBLAS, cuDNN, or FlashAttention) to understand the gap between hand-written and library-tuned kernels.

The goal is not to beat cuBLAS -- that would require years of engineering. The goal is to develop a deep understanding of GPU execution, memory hierarchy, and the optimization techniques that production kernels use, by implementing them yourself.

---

## Objectives

1. Implement a GPU kernel for a core ML operator (GEMM or fused attention) in CUDA or Triton.
2. Apply a sequence of optimizations, measuring the impact of each.
3. Benchmark against production baselines (cuBLAS, cuDNN, FlashAttention).
4. Produce a clear, well-structured report analyzing performance at each optimization level.

---

## Technical Requirements

### Choose One Track

You must complete **one** of the following two tracks:

#### Track A: Tiled GEMM

Implement a matrix multiplication kernel C = A * B with the following optimization levels:

| Level | Description | Target |
|---|---|---|
| **V0: Naive** | One thread per output element. Global memory only. | Establish baseline. |
| **V1: Shared memory tiling** | Load tiles of A and B into shared memory. Compute tile of C in registers. | Reduce global memory traffic. |
| **V2: Register tiling (micro-kernels)** | Each thread computes a small block (e.g., 4x4 or 8x8) of output. Maximize register reuse. | Improve compute-to-memory ratio. |
| **V3: Double buffering** | Overlap global memory loads with shared memory computation using software pipelining. | Hide memory latency. |
| **V4: Vectorized loads** | Use 128-bit (float4) loads from global to shared memory. Ensure coalesced access patterns. | Maximize memory bandwidth utilization. |
| **V5: Warp-level optimization** (Triton) or **Tensor Core** (CUDA) | Use Triton's block-level primitives with autotuning, or use CUDA's wmma/mma.sync instructions for Tensor Core GEMM. | Approach hardware peak throughput. |

Matrix sizes for benchmarking:

| Label | M | N | K | Notes |
|---|---|---|---|---|
| Small | 256 | 256 | 256 | Launch overhead dominated |
| Medium | 1024 | 1024 | 1024 | Shared memory pressure |
| Large | 4096 | 4096 | 4096 | Compute bound |
| Tall-skinny | 4096 | 128 | 4096 | Common in MLP layers |
| LLM-shaped | 4096 | 4096 | 11008 | LLaMA FFN dimensions |

Compare against: `torch.matmul` (which calls cuBLAS), and optionally cuBLAS directly via ctypes or pybind.

#### Track B: Fused Attention

Implement a fused attention kernel following the FlashAttention algorithm:

| Level | Description | Target |
|---|---|---|
| **V0: Naive** | Materialize the full N x N attention matrix. Standard softmax. | Establish baseline (memory-bound). |
| **V1: Online softmax** | Compute softmax in a single pass using the online algorithm (Milakov & Gimelshein). Avoid materializing the full attention matrix. | Reduce memory from O(N^2) to O(N). |
| **V2: Tiled forward** | Tile over key/value blocks. Accumulate attention output incrementally. Implement in Triton or CUDA. | Achieve FlashAttention-style memory efficiency. |
| **V3: Fused causal mask** | Integrate causal masking into the tiled kernel without additional memory or branches per element. | Avoid wasted computation on masked positions. |
| **V4: Autotuning** (Triton) or **warp specialization** (CUDA) | Tune tile sizes, number of warps, and pipeline stages. Or implement producer-consumer warp specialization for Q/K/V loading. | Maximize occupancy and throughput. |

Configurations for benchmarking:

| Label | Batch | Heads | Seq Len | Head Dim | Notes |
|---|---|---|---|---|---|
| Short | 8 | 32 | 512 | 128 | Compute-light |
| Medium | 4 | 32 | 2048 | 128 | Typical LLM |
| Long | 2 | 32 | 8192 | 128 | Long-context |
| GQA | 4 | 32 (Q) / 8 (KV) | 2048 | 128 | Grouped-query attention |

Compare against: `torch.nn.functional.scaled_dot_product_attention` (which uses FlashAttention-2 when available), and the naive PyTorch implementation.

### Benchmarking Requirements

For every kernel version and configuration:

- **Throughput:** TFLOPS (for GEMM) or effective TFLOPS (for attention, accounting for masking).
- **Memory bandwidth utilization:** GB/s achieved vs. hardware peak.
- **Wall-clock latency:** Median and p99 over 100 runs after 10 warmup runs.
- **Peak memory usage:** GPU memory allocated (use `torch.cuda.max_memory_allocated`).
- **Roofline position:** Plot each kernel version on a roofline diagram. Is it compute-bound or memory-bound? How far from the roofline?

Use `torch.cuda.Event` for GPU timing. Do not use CPU-side timing for GPU kernels.

### Correctness Validation

- Compare output against a reference implementation (PyTorch or cuBLAS) for every kernel version.
- Report maximum absolute error and maximum relative error.
- Test with random inputs, including edge cases (very small values, very large values, zeros).
- For attention: verify that the causal mask is applied correctly by comparing against the naive masked implementation.

---

## Deliverables

### 1. Report (NeurIPS Format, 6 pages max)

Your report must follow the NeurIPS 2024 LaTeX template and include:

1. **Abstract** (150 words max): Summarize the kernel being optimized, the optimization strategy, and key results.
2. **Introduction**: Motivation for kernel optimization. Why does this operator matter for ML workloads? What is the gap between naive and optimized implementations?
3. **Background**: Relevant GPU architecture concepts (memory hierarchy, warp execution, occupancy, Tensor Cores). Keep this concise -- focus on concepts directly relevant to your optimizations.
4. **Optimization Strategy**: Description of each optimization level with:
   - What the optimization does at the hardware level
   - Why it helps (which bottleneck it addresses)
   - A code snippet or diagram illustrating the key change
5. **Evaluation**:
   - Performance table for all versions and configurations
   - Roofline diagram showing the trajectory of optimization
   - Throughput comparison against production baselines
   - Memory usage comparison
   - Profiling data from Nsight Compute or Nsight Systems for at least two kernel versions (one early, one final) showing the key metrics (SM occupancy, memory throughput, compute throughput, stall reasons)
6. **Analysis**:
   - Which optimization gave the largest speedup and why?
   - What is the remaining gap to the production baseline? What would be needed to close it?
   - What was the most surprising finding?
7. **Conclusion**: Summary and lessons learned.
8. **References**

The 6-page limit excludes references and an optional appendix (2 pages max for additional profiling data or code listings).

### 2. Code Submission

- Clean, well-documented kernel code with each optimization level in a separate file or clearly marked section
- Benchmark script that reproduces all numbers in the report
- Correctness validation script
- `README.md` with instructions to build and run
- `requirements.txt` or `environment.yml`

### 3. Profiling Traces

- Nsight Compute or Nsight Systems profile for at least your V0 (naive) and final optimized kernel
- Include the `.ncu-rep` or `.nsys-rep` files or screenshots of key metrics

---

## Milestones

### Week 6: Checkpoint (5% of project grade)

Submit a 1-page progress report including:

- Track choice (GEMM or attention) with justification
- V0 and V1 implementations working with correctness validation
- Initial benchmark numbers for V0 and V1
- Roofline analysis for V0 identifying the bottleneck
- Plan for remaining optimizations

### Week 8: Final Report + Code (95% of project grade)

Submit the full report, code, and profiling traces as described above.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Implementation Correctness** | 25% | All kernel versions produce correct output. Correctness validation is thorough. Code compiles and runs without errors. |
| **Optimization Depth** | 25% | Multiple optimization levels are implemented. Each level targets a specific bottleneck. The final kernel achieves meaningful speedup over the naive implementation. |
| **Benchmarking Quality** | 25% | Benchmarks are properly conducted (warmup, multiple runs, variance reported). Roofline analysis is included. Profiling data is presented and interpreted. Comparison against production baselines is fair and well-documented. |
| **Analysis and Writing** | 25% | Report clearly explains each optimization at the hardware level. Performance improvements are analyzed, not merely reported. The remaining gap to production is discussed. Writing is clear and well-organized. |

### Grade Descriptors

- **A (90-100%):** All optimization levels implemented correctly. Final kernel achieves significant fraction of production baseline performance. Analysis reveals deep understanding of GPU execution. Roofline analysis is insightful.
- **B (80-89%):** Most optimization levels work. Performance improves meaningfully. Analysis is solid but may lack depth in explaining hardware behavior.
- **C (70-79%):** Basic optimizations work. Some levels may have bugs or limited speedup. Analysis is present but shallow.
- **D/F (<70%):** Naive kernel only. Missing optimizations. Benchmarking is incomplete. Analysis is absent or superficial.

---

## Helpful Guidance

### Getting Started

1. Start with V0 (naive) and verify correctness against PyTorch/cuBLAS.
2. Add benchmarking infrastructure early (timing, memory measurement, roofline computation).
3. Profile V0 with Nsight Compute to identify the bottleneck before optimizing.
4. Implement one optimization at a time. Verify correctness and measure speedup after each.
5. Do not skip straight to Tensor Cores or advanced Triton features -- the intermediate levels are where the learning happens.

### Common Pitfalls

- **Incorrect shared memory indexing:** Bank conflicts can silently reduce performance by 32x. Check for bank conflicts in your shared memory access patterns.
- **Not accounting for launch overhead:** For small matrices, kernel launch overhead dominates. Report this separately from compute time.
- **Using CPU timing for GPU kernels:** Always use `torch.cuda.Event` or `torch.cuda.synchronize()` before CPU timing. GPU execution is asynchronous.
- **Comparing unfairly against cuBLAS:** cuBLAS selects different algorithms for different matrix sizes and has been tuned for years. Report the gap honestly.
- **Forgetting warmup runs:** The first kernel launch includes JIT compilation and caching overhead. Always warm up with at least 10 runs.

### Suggested Reading

- Dao et al., "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness" (2022)
- Tillet et al., "Triton: An Intermediate Language and Compiler for Tiled Neural Network Computations" (2019)
- Goto, van de Geijn, "Anatomy of High-Performance Matrix Multiplication" (2008)
- Milakov, Gimelshein, "Online normalizer calculation for softmax" (2018)
- NVIDIA, "CUDA C++ Best Practices Guide"
- NVIDIA, "Kernel Profiling Guide" (Nsight Compute documentation)

### Compute Expectations

On a single modern GPU (A100 or equivalent):

- V0 implementation and benchmarking: 2-4 hours of development
- Each subsequent optimization level: 4-8 hours of development
- Full benchmark suite: 30-60 minutes of GPU time
- Profiling: 1-2 hours of GPU time

Plan for approximately 30-50 hours of total development time and 5-10 GPU-hours of benchmarking.

---

## Academic Integrity

- You must write the kernel code yourself. Using pre-built kernel libraries (cuBLAS, FlashAttention source) as your submission is not permitted.
- You may study open-source kernel implementations for reference, but must write your own code. Cite any code you reference.
- You may use Triton's standard library utilities (tl.load, tl.store, tl.dot, etc.) but must compose the kernel yourself.
- Your report must be your own writing. LLM-assisted editing is permitted for polishing but not for generating analytical content.

---

## Submission

Submit via the course portal by **Week 8, Friday 11:59 PM**:

1. Report as PDF (NeurIPS format)
2. Code as a zip archive or link to a private repository
3. Profiling traces (.ncu-rep or .nsys-rep files, or screenshots)
4. A `README.md` with reproduction instructions
