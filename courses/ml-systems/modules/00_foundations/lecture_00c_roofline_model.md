# Lecture 00c: The Roofline Model & Performance Analysis

> **Module 00 — Hardware & Compute Foundations (Pre-Work)**
> Estimated study time: 6--8 hours

---

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** arithmetic intensity for a given computation and calculate it from first principles by counting FLOPs and bytes transferred.
2. **Construct** a roofline plot for specific hardware, identifying the ridge point and the memory-bound vs. compute-bound regimes.
3. **Classify** common ML operators (GEMM, convolution, elementwise, softmax, layer norm, attention) as memory-bound or compute-bound using the roofline model.
4. **Apply** the roofline model to diagnose performance gaps and guide optimization decisions (fusion, tiling, precision reduction).
5. **Implement** a practical profiling methodology using hardware performance counters and profiling tools to validate roofline predictions against measured performance.

---

## 2. Motivation and Context

Every performance optimization begins with a question: **what is the bottleneck?** Without answering this, we optimize blindly -- spending weeks rewriting a kernel to reduce FLOPs when the real bottleneck is memory bandwidth, or vice versa.

The **roofline model**, introduced by Williams, Waterman, and Patterson in 2009, provides a visual and analytical framework for answering this question. It plots achievable performance as a function of a computation's **arithmetic intensity** (the ratio of compute work to data movement), overlaid on the hardware's peak compute and memory bandwidth capabilities. The result is a simple but powerful tool that immediately tells you whether a workload is **compute-bound** or **memory-bound**, and by how much.

The model originated in the high-performance computing (HPC) community for analyzing scientific codes on multicore CPUs, but it has become indispensable in ML systems engineering. Modern ML workloads span a vast range of arithmetic intensities -- from elementwise operations ($\text{AI} < 1$) that are purely bandwidth-bound, to large matrix multiplications ($\text{AI} > 100$) that can saturate Tensor Cores. Understanding where each operator falls on the roofline determines the right optimization strategy and sets realistic performance targets.

---

## 3. Arithmetic Intensity

### 3.1 Definition

The **arithmetic intensity** (also called operational intensity) of a computation is:

$$\text{AI} = \frac{W}{Q} \quad \text{[FLOP/byte]}$$

where:
- $W$ = total number of floating-point operations (FLOPs) performed
- $Q$ = total number of bytes transferred between the compute unit and the relevant memory level

The choice of memory level matters. For a GPU kernel, $Q$ typically refers to bytes transferred between HBM (global memory) and the SMs. For a CPU computation, $Q$ refers to bytes transferred between DRAM and the CPU cores.

### 3.2 Counting FLOPs

**Convention**: One fused multiply-add (FMA) counts as 2 FLOPs (one multiply + one add). This is the standard in ML systems and matches how hardware reports FLOPS.

Common operations:

| Operation | FLOPs |
|-----------|-------|
| Dot product of two vectors of length $N$ | $2N$ (N multiplies + N adds, or N FMAs) |
| Matrix-vector $A\mathbf{x}$, $A \in \mathbb{R}^{M \times N}$ | $2MN$ |
| Matrix multiply $C = AB$, $A \in \mathbb{R}^{M \times K}$, $B \in \mathbb{R}^{K \times N}$ | $2MKN$ |
| Elementwise add of two vectors of length $N$ | $N$ |
| ReLU on a vector of length $N$ | $N$ (one comparison per element) |
| Softmax on a vector of length $N$ | $\sim 5N$ (exp, sum, divide, plus max for stability) |

### 3.3 Counting Bytes Transferred

This requires understanding what data moves between memory and compute. For a kernel operating on data in HBM:

| Operation | Bytes Transferred (FP16) |
|-----------|------------------------|
| Elementwise add: $C = A + B$, length $N$ | $3 \times 2N = 6N$ (read A, read B, write C) |
| GEMM $C = AB$, $A \in \mathbb{R}^{M \times K}$, $B \in \mathbb{R}^{K \times N}$ | $2(MK + KN + MN)$ (read A, read B, write C) |
| Softmax on $N$ elements | $2 \times 2N = 4N$ (read input, write output) |

**Important**: When data is reused from cache (L2, shared memory), those accesses do not count toward $Q$. This is why tiling a GEMM does not change its arithmetic intensity relative to HBM -- the total HBM traffic is the same, but the data is reused from on-chip memory.

### 3.4 Worked Examples

**Example 1: Elementwise ReLU on a vector of $N$ FP32 values.**

$$W = N, \quad Q = 2 \times 4N = 8N \text{ bytes (read + write)}$$

$$\text{AI} = \frac{N}{8N} = \frac{1}{8} = 0.125 \text{ FLOP/byte}$$

This is extremely low -- any hardware will be bandwidth-bound for this operation.

**Example 2: GEMM $C = AB$ where $A \in \mathbb{R}^{4096 \times 4096}$, $B \in \mathbb{R}^{4096 \times 4096}$, FP16.**

$$W = 2 \times 4096^3 = 137.4 \times 10^9 \text{ FLOPs}$$

$$Q = 2 \times (4096^2 + 4096^2 + 4096^2) = 2 \times 3 \times 4096^2 = 100.7 \times 10^6 \text{ bytes}$$

$$\text{AI} = \frac{137.4 \times 10^9}{100.7 \times 10^6} = 1364 \text{ FLOP/byte}$$

This is very high -- GEMM at this size is solidly compute-bound.

**Example 3: GEMM with a small batch -- matrix-vector multiply $\mathbf{y} = A\mathbf{x}$, $A \in \mathbb{R}^{4096 \times 4096}$, $\mathbf{x} \in \mathbb{R}^{4096}$, FP16.**

$$W = 2 \times 4096^2 = 33.6 \times 10^6 \text{ FLOPs}$$

$$Q = 2 \times (4096^2 + 4096 + 4096) = 2 \times 4096^2 + 2 \times 8192 \approx 33.6 \times 10^6 \text{ bytes}$$

$$\text{AI} = \frac{33.6 \times 10^6}{33.6 \times 10^6} \approx 1.0 \text{ FLOP/byte}$$

Despite being a "matrix multiply," this is bandwidth-bound. The matrix $A$ dominates the data transfer and is used only once. This is why **batching** is critical for GPU utilization -- increasing the batch size increases the arithmetic intensity of GEMM.

**Example 4: Batched GEMM -- $C = AB$ where $A \in \mathbb{R}^{4096 \times 4096}$, $B \in \mathbb{R}^{4096 \times B_s}$, FP16.**

$$W = 2 \times 4096^2 \times B_s$$

$$Q = 2(4096^2 + 4096 \times B_s + 4096 \times B_s)$$

$$\text{AI} = \frac{2 \times 4096^2 \times B_s}{2(4096^2 + 2 \times 4096 \times B_s)} = \frac{4096 \times B_s}{4096 + 2B_s}$$

| $B_s$ | AI (FLOP/byte) | Regime on H100 |
|--------|----------------|----------------|
| 1 | 1.0 | Memory-bound |
| 8 | 7.9 | Memory-bound |
| 64 | 62.5 | Near ridge point |
| 256 | 244 | Compute-bound |
| 4096 | 1365 | Deeply compute-bound |

This table illustrates the transition from memory-bound to compute-bound as batch size increases -- a fundamental relationship in ML inference optimization.

---

## 4. The Roofline Model

### 4.1 Construction

The roofline model plots **attainable performance** (FLOPS) as a function of **arithmetic intensity** (FLOP/byte) on a log-log scale. The model is defined by two hardware parameters:

- $\pi$: peak compute throughput (FLOPS)
- $\beta$: peak memory bandwidth (bytes/second)

The attainable performance is:

$$P(\text{AI}) = \min(\pi, \; \text{AI} \times \beta)$$

On a log-log plot, this produces two lines:

1. **Memory bandwidth ceiling** (slope-1 line): $P = \text{AI} \times \beta$. Performance scales linearly with arithmetic intensity because the bottleneck is feeding data to the compute units.

2. **Compute ceiling** (horizontal line): $P = \pi$. Performance is capped by peak compute regardless of how much data reuse exists.

The **ridge point** is the arithmetic intensity where these lines intersect:

$$\text{AI}_{\text{ridge}} = \frac{\pi}{\beta}$$

Workloads with $\text{AI} < \text{AI}_{\text{ridge}}$ are **memory-bound**; workloads with $\text{AI} > \text{AI}_{\text{ridge}}$ are **compute-bound**.

### 4.2 Roofline Parameters for Modern Hardware

| Hardware | Peak FLOPS ($\pi$) | BW ($\beta$) | Ridge Point | Unit |
|----------|-------------------|-------------|-------------|------|
| H100 SXM (FP32 CUDA) | 66.9 TFLOPS | 3.35 TB/s | 20.0 | FLOP/byte |
| H100 SXM (TF32 TC) | 989 TFLOPS | 3.35 TB/s | 295 | FLOP/byte |
| H100 SXM (FP16 TC) | 1,979 TFLOPS | 3.35 TB/s | 591 | FLOP/byte |
| H100 SXM (FP8 TC) | 3,958 TFLOPS | 3.35 TB/s | 1,181 | FLOP/byte |
| A100 SXM (FP16 TC) | 312 TFLOPS | 2.0 TB/s | 156 | FLOP/byte |
| B200 (FP16 TC) | 2,250 TFLOPS | 8.0 TB/s | 281 | FLOP/byte |
| EPYC 9654 (FP64 AVX-512) | 3.5 TFLOPS | 460 GB/s | 7.6 | FLOP/byte |

Notice that the ridge point for FP16 Tensor Core operations on H100 is $\sim 591$ FLOP/byte. This means **most ML operators are memory-bound on modern GPUs**, with the notable exception of large GEMMs and convolutions. The ridge point has been increasing with each generation (as compute grows faster than bandwidth), making memory bandwidth an ever-tighter bottleneck.

### 4.3 Reading the Roofline Plot

```
Performance         Compute ceiling: π = 1,979 TFLOPS (H100 FP16 TC)
(TFLOPS)            ________________________________________________
    |              /
    |             /
    |            /   <-- Memory bandwidth roof: slope = β = 3.35 TB/s
    |           /
    |          /
    |         /
    |        /  ridge point (AI = 591 FLOP/byte)
    |       /
    |      /
    |     /     * Large GEMM (AI~1000): compute-bound, near ceiling
    |    /
    |   /   * Attention w/ FlashAttn (AI~100): memory-bound but improved
    |  /
    | /  * Softmax (AI~2): deeply memory-bound
    |/
    +---------------------------------------------------->
                   Arithmetic Intensity (FLOP/byte)    [log scale]
```

A workload plotted on the roofline reveals:

1. **Where it falls relative to the ridge**: Memory-bound (left) or compute-bound (right).
2. **How far below the roof it is**: The gap between achieved performance and the roofline represents optimization potential. Sources of the gap include:
   - Uncoalesced memory access (reduces effective bandwidth)
   - Low occupancy (underutilizes compute)
   - Instruction overhead (non-FLOP instructions)
   - Memory access pattern inefficiencies

### 4.4 Extended Roofline: Multiple Ceilings

The basic roofline can be extended with additional ceilings that represent sub-peak performance due to specific hardware or software limitations:

**Compute sub-ceilings:**
- Peak FLOPS with Tensor Cores (highest)
- Peak FLOPS with CUDA Cores only
- Peak FLOPS without FMA (half the peak)
- Peak FLOPS with warp divergence

**Bandwidth sub-ceilings:**
- L2 cache bandwidth (~12 TB/s on H100)
- Shared memory bandwidth (~20 TB/s aggregate)
- HBM bandwidth (3.35 TB/s on H100)
- PCIe bandwidth (~64 GB/s for Gen5 x16)

These sub-ceilings create a "staircase" effect, showing which specific hardware limit is constraining each workload.

---

## 5. Roofline Analysis of ML Operators

### 5.1 GEMM (General Matrix Multiply)

For $C = AB + C$ where $A \in \mathbb{R}^{M \times K}$, $B \in \mathbb{R}^{K \times N}$, in FP16:

$$W = 2MKN, \quad Q = 2(MK + KN + MN), \quad \text{AI} = \frac{MKN}{MK + KN + MN}$$

For square matrices ($M = K = N$):

$$\text{AI} = \frac{N}{3}$$

| $N$ | AI (FLOP/byte) | Regime on H100 (FP16 TC) | Achievable TFLOPS |
|-----|----------------|--------------------------|-------------------|
| 128 | 42.7 | Memory-bound | $42.7 \times 3350 = 143$ |
| 512 | 170.7 | Memory-bound | $170.7 \times 3350 = 572$ |
| 1024 | 341.3 | Memory-bound | $341.3 \times 3350 = 1{,}143$ |
| 4096 | 1365.3 | Deeply compute-bound | $\sim 1{,}979$ (peak) |

In practice, cuBLAS achieves 80--95% of peak Tensor Core TFLOPS for large square GEMMs ($N \geq 2048$). For small or non-square GEMMs (common in inference with small batch sizes), performance drops significantly.

### 5.2 Convolution

Convolution is typically implemented via **im2col + GEMM** or specialized algorithms (Winograd, FFT). The GEMM formulation has:

$$M = \text{batch} \times H_{\text{out}} \times W_{\text{out}}, \quad K = C_{\text{in}} \times k_h \times k_w, \quad N = C_{\text{out}}$$

For a typical ResNet layer: batch=32, $H_{\text{out}} = W_{\text{out}} = 56$, $C_{\text{in}} = 64$, $k = 3$, $C_{\text{out}} = 64$:

$$M = 32 \times 56^2 = 100{,}352, \quad K = 64 \times 9 = 576, \quad N = 64$$

$$\text{AI} = \frac{100352 \times 576 \times 64}{2 \times (100352 \times 576 + 576 \times 64 + 100352 \times 64)} \approx \frac{3.7 \times 10^9}{2 \times 6.44 \times 10^7} \approx 28.7 \text{ FLOP/byte}$$

This convolution layer is **memory-bound** on an H100 with FP16 Tensor Cores (ridge point 591). Many early-layer convolutions with small channel counts are memory-bound; later layers with large channel counts tend to be compute-bound.

### 5.3 Elementwise Operations

ReLU, GELU, residual addition, scaling -- all elementwise operations read and write each element exactly once with minimal computation:

| Operation | FLOPs/element | Bytes/element (FP16) | AI |
|-----------|--------------|---------------------|-----|
| ReLU | 1 | 4 (read + write) | 0.25 |
| GELU | ~8 | 4 | 2.0 |
| Residual add | 1 | 6 (read 2 + write 1) | 0.17 |
| Scale + bias | 2 | 4 | 0.5 |

All elementwise operations are **deeply memory-bound**. On an H100:

$$P_{\text{ReLU}} = 0.25 \times 3350 = 837.5 \text{ GFLOPS} = 0.84 \text{ TFLOPS}$$

Compare to the 1,979 TFLOPS peak -- elementwise operations utilize less than 0.05% of Tensor Core compute. This is why **operator fusion** (combining elementwise ops with preceding GEMM or convolution) is so critical: it eliminates the round-trip to HBM.

### 5.4 Softmax

Standard softmax on a vector of length $N$ in FP16:

```
Pass 1: max_val = max(x)              -- N reads, N comparisons
Pass 2: sum = Σ exp(x[i] - max_val)   -- N reads, N exp + N adds
Pass 3: out[i] = exp(x[i] - max_val) / sum  -- N reads, N exp + N divs, N writes
```

Total: $\sim 5N$ FLOPs, $Q = 2(3N \text{ reads} + N \text{ write}) = 8N$ bytes.

$$\text{AI}_{\text{softmax}} = \frac{5N}{8N} = 0.625 \text{ FLOP/byte}$$

The three-pass nature of softmax is particularly painful: it reads the input three times from memory (unless fused). **Online softmax** (Milakov & Gimelshein, 2018) reduces this to two passes, and FlashAttention fuses softmax into the attention computation entirely, eliminating the standalone HBM traffic.

### 5.5 Layer Normalization

LayerNorm over a vector of length $d$ in FP16:

$$\hat{x}_i = \frac{x_i - \mu}{\sqrt{\sigma^2 + \epsilon}} \cdot \gamma_i + \beta_i$$

- Pass 1: compute mean $\mu$ -- $d$ reads, $d$ adds.
- Pass 2: compute variance $\sigma^2$ -- $d$ reads, $d$ multiply-adds.
- Pass 3: normalize and affine -- $d$ reads of $x$, $d$ reads of $\gamma, \beta$, $d$ writes, $\sim 4d$ FLOPs.

Total: $\sim 7d$ FLOPs, $Q \approx 2(3d + d + d + d) = 12d$ bytes (with $\gamma, \beta$ cached).

$$\text{AI}_{\text{layernorm}} \approx \frac{7d}{12d} \approx 0.58 \text{ FLOP/byte}$$

Again, deeply memory-bound. Fused LayerNorm kernels (e.g., Apex `FusedLayerNorm`) combine all three passes into a single kernel, reading the input once.

### 5.6 Self-Attention (Standard vs. FlashAttention)

**Standard attention** for sequence length $S$, head dimension $d_k$, one head, FP16:

1. $QK^T$: GEMM of $(S \times d_k) \times (d_k \times S)$ -- $2S^2 d_k$ FLOPs, writes $S^2$ attention scores to HBM.
2. Softmax: $S \times S$ elements -- reads/writes $S^2$ values from/to HBM.
3. $\text{scores} \times V$: GEMM of $(S \times S) \times (S \times d_k)$ -- $2S^2 d_k$ FLOPs.

Total FLOPs: $\approx 4S^2 d_k + 5S^2$ (softmax). Total HBM bytes: $2(S \times d_k) \times 3 + 2S^2 \times 3$ (Q, K, V, output, plus intermediate attention matrix written/read twice).

For $S = 2048$, $d_k = 128$:

$$W = 4 \times 2048^2 \times 128 + 5 \times 2048^2 \approx 2.17 \times 10^9$$

$$Q_{\text{standard}} = 2 \times 3 \times 2048 \times 128 + 2 \times 3 \times 2048^2 \approx 1.57 + 25.2 = 26.7 \text{ MB}$$

The $S^2$ attention matrix dominates HBM traffic. AI $\approx 81$ FLOP/byte -- memory-bound on H100.

**FlashAttention** (Dao et al., 2022) never materializes the $S \times S$ attention matrix in HBM. Instead, it tiles the computation in blocks and keeps the softmax statistics in SRAM (shared memory). HBM traffic is reduced to:

$$Q_{\text{flash}} = 2 \times (3 \times S \times d_k + S \times d_k) = 2 \times 4 \times 2048 \times 128 = 2.1 \text{ MB}$$

$$\text{AI}_{\text{flash}} = \frac{2.17 \times 10^9}{2.1 \times 10^6} \approx 1033 \text{ FLOP/byte}$$

FlashAttention transforms attention from a memory-bound to a **compute-bound** operation by increasing AI by roughly $12\times$ for these dimensions. This is one of the most impactful optimizations in modern ML systems, and it is fundamentally a roofline-driven insight.

---

## 6. Constructing a Roofline Plot

### 6.1 Step-by-Step Procedure

1. **Determine hardware parameters:**
   - Peak compute $\pi$: Look up the GPU spec sheet. Choose the appropriate precision (FP32, FP16, FP8) and compute unit (CUDA Cores vs. Tensor Cores) for your workload.
   - Peak memory bandwidth $\beta$: Use the HBM bandwidth from spec. Achievable bandwidth is typically 80--90% of theoretical peak; measure with a bandwidth benchmark.

2. **Measure achievable peaks** (recommended for accuracy):
   - Compute: Run a large GEMM (e.g., $4096 \times 4096$) with cuBLAS and measure TFLOPS.
   - Bandwidth: Run a large vector copy (e.g., `cudaMemcpy` of 1 GiB) and measure GB/s.

3. **Compute $\text{AI}_{\text{ridge}} = \pi / \beta$.**

4. **For each kernel of interest:**
   - Count FLOPs $W$ (analytically or via profiler).
   - Count HBM bytes $Q$ (analytically or via profiler).
   - Compute $\text{AI} = W/Q$.
   - Measure achieved GFLOPS $P_{\text{achieved}}$.
   - Plot $(\text{AI}, P_{\text{achieved}})$ on the roofline.

5. **Analyze gaps:**
   - If the point is on the bandwidth roof: the kernel is bandwidth-efficient but bandwidth-bound. To improve, increase AI (fusion, tiling) or move to hardware with more bandwidth.
   - If the point is on the compute roof: the kernel is compute-efficient. To improve, use Tensor Cores, lower precision, or more hardware.
   - If the point is below both roofs: there are implementation inefficiencies to address (uncoalesced access, low occupancy, warp divergence, etc.).

### 6.2 Measuring with Nsight Compute

NVIDIA Nsight Compute (`ncu`) provides the metrics needed for roofline analysis:

```bash
# Profile a specific kernel
ncu --set full -o profile_output ./my_cuda_program

# Key metrics for roofline:
# sm__sass_thread_inst_executed_op_fadd_pred_on.sum   (FP add instructions)
# sm__sass_thread_inst_executed_op_fmul_pred_on.sum   (FP mul instructions)
# sm__sass_thread_inst_executed_op_ffma_pred_on.sum   (FMA instructions)
# dram__bytes.sum                                      (HBM bytes transferred)
# sm__cycles_elapsed.avg * sm__warps_active.avg        (for time normalization)
```

The achieved FLOPs:
$$W = (\text{fadd} + \text{fmul} + 2 \times \text{ffma}) \quad \text{[total across all SMs]}$$

The achieved FLOPS:
$$P = W / t_{\text{kernel}}$$

Nsight Compute also has a built-in **Speed of Light** analysis that directly shows a roofline chart and identifies whether the kernel is compute-bound or memory-bound.

### 6.3 Measuring with PyTorch Profiler

For higher-level profiling without writing CUDA:

```python
import torch
from torch.profiler import profile, ProfilerActivity

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    with_flops=True,  # estimate FLOPs for supported ops
    record_shapes=True,
) as prof:
    output = model(input_batch)
    loss = criterion(output, target)
    loss.backward()

# Print sorted by CUDA time
print(prof.key_averages().table(
    sort_by="cuda_time_total", row_limit=20
))

# Export Chrome trace for visualization
prof.export_chrome_trace("trace.json")
```

PyTorch profiler estimates FLOPs for common operations (linear, conv, matmul) and reports CUDA kernel execution time, enabling approximate roofline placement.

---

## 7. Using Roofline to Guide Optimization

### 7.1 Decision Framework

The roofline model directly prescribes the optimization strategy:

**If memory-bound (AI < ridge point):**

| Strategy | Effect on AI | Example |
|----------|-------------|---------|
| **Operator fusion** | Increases AI by eliminating intermediate reads/writes | Fusing ReLU into GEMM |
| **Tiling / blocking** | Does not change AI, but improves bandwidth utilization | FlashAttention's tiled softmax |
| **Reduce precision** | Halves bytes ($Q$), roughly doubles AI | FP32 -> FP16 |
| **Increase batch size** | Increases reuse of weight matrices, increases AI | Inference batching |
| **Kernel fusion with recomputation** | Trades compute for reduced memory traffic | Fused dropout + softmax in FlashAttention |

**If compute-bound (AI > ridge point):**

| Strategy | Effect | Example |
|----------|--------|---------|
| **Use Tensor Cores** | Increases $\pi$ by 8--16x | cuBLAS with FP16/BF16 inputs |
| **Lower precision** | Doubles $\pi$ for each halving | FP16 -> FP8 |
| **Algorithmic optimization** | Reduces $W$ | Winograd convolution ($2.25\times$ fewer FLOPs) |
| **Add more hardware** | Increases total $\pi$ | Multi-GPU, tensor parallelism |

### 7.2 Case Study: Optimizing a Transformer Block

A single Transformer block consists of:

1. LayerNorm (AI ~ 0.6, memory-bound)
2. QKV projection -- GEMM (AI depends on batch size)
3. Attention -- QK^T, softmax, score*V (mixed)
4. Output projection -- GEMM
5. Residual addition (AI ~ 0.17, memory-bound)
6. LayerNorm (memory-bound)
7. MLP -- two GEMMs with GELU activation (AI depends on batch size)
8. Residual addition (memory-bound)

**Optimization opportunities identified by roofline analysis:**

1. **Fuse LayerNorm + QKV projection**: Eliminates the HBM write/read of the LayerNorm output. The LayerNorm is so bandwidth-bound that making it "free" by fusing it with the subsequent GEMM (which must read that data anyway) is a significant win.

2. **FlashAttention**: As analyzed in Section 5.6, this transforms attention from memory-bound to compute-bound by increasing AI from ~80 to ~1000 FLOP/byte.

3. **Fuse bias + residual + LayerNorm**: After the output projection GEMM, the bias add, residual add, and following LayerNorm can be fused into a single kernel, reducing 3 HBM round-trips to 1.

4. **Fuse GELU into MLP GEMM**: The GELU activation between the two MLP GEMMs can be fused with the first GEMM's epilogue, eliminating one HBM round-trip.

5. **Use FP8 for GEMMs**: On H100, this doubles the compute roof from 1,979 to 3,958 TFLOPS, making larger GEMMs faster and pushing the ridge point higher (which paradoxically makes more things memory-bound, but the ones that are compute-bound get faster).

The compound effect of these fusions can yield 2--4x end-to-end speedup for the Transformer block, with the roofline model predicting the improvement at each step.

### 7.3 The Fusion Imperative

A key insight from roofline analysis: in a modern Transformer, the majority of operators by count are memory-bound (elementwise, normalization, softmax). If each runs as a separate CUDA kernel, each one pays a full HBM round-trip. The GEMMs, while compute-bound, are a minority of the total kernel launches.

**Without fusion** (simplified Transformer forward pass):

| Operation | AI | Time @ H100 | Bottleneck |
|-----------|-----|-------------|------------|
| LayerNorm | 0.6 | 100% BW-limited | Memory |
| QKV GEMM (batch=32, d=4096) | ~500 | 100% compute-limited | Compute |
| Attention (naive, S=2048) | ~80 | Memory | Memory |
| Out GEMM | ~500 | Compute | Compute |
| Residual + LayerNorm | ~0.4 | Memory | Memory |
| MLP GEMM 1 | ~500 | Compute | Compute |
| GELU | ~2 | Memory | Memory |
| MLP GEMM 2 | ~500 | Compute | Compute |
| Residual | ~0.17 | Memory | Memory |

The memory-bound kernels, while individually cheap, collectively add significant time. Fusion eliminates them by "hiding" them inside the compute-bound kernels.

---

## 8. Limitations of the Roofline Model

The roofline model is a first-order approximation. It does not capture:

1. **Kernel launch overhead**: Each CUDA kernel launch has ~5--10 microsecond overhead. For very short kernels, this dominates.

2. **L2 cache effects**: If data fits in L2 cache (50 MiB on H100), the effective bandwidth is much higher (~12 TB/s), shifting the roofline upward.

3. **Memory access patterns**: The model assumes data is accessed at peak bandwidth. Uncoalesced or random access patterns achieve far less.

4. **Instruction mix**: Non-FLOP instructions (integer arithmetic, address calculation, branches) consume execution slots but are not reflected in the FLOP count.

5. **Occupancy effects**: Low occupancy reduces both effective compute and effective memory bandwidth.

6. **Multi-kernel interactions**: PCIe transfers, CPU-GPU synchronization, and inter-kernel dependencies create bubbles not captured by single-kernel roofline analysis.

7. **Tail effects**: For small problem sizes, the GPU may not have enough parallelism to saturate either compute or bandwidth.

Despite these limitations, the roofline model remains the most useful first tool for performance analysis. It correctly identifies the bottleneck type (compute vs. memory) in the vast majority of cases and gives an upper bound on achievable performance.

---

## 9. Practical Profiling Methodology

### 9.1 A Profiling Workflow

A systematic approach to performance analysis:

1. **Macro profiling**: Run the full training step with PyTorch Profiler or Nsight Systems. Identify which kernels dominate total GPU time.

2. **Kernel identification**: Rank kernels by time. Typically, GEMM kernels (from linear layers and attention) dominate, followed by elementwise and normalization kernels.

3. **Micro profiling**: For the top-$k$ kernels, run Nsight Compute to get detailed metrics: FLOPs, memory bytes, occupancy, warp stall reasons.

4. **Roofline placement**: Plot each kernel on the roofline. Identify whether it is memory-bound or compute-bound, and how far below the roof it falls.

5. **Root cause analysis**: For kernels below the roof:
   - Check memory coalescing efficiency.
   - Check occupancy and its limiter (registers, shared memory, block size).
   - Check warp divergence.
   - Check for register spills.

6. **Optimize and iterate**: Apply the appropriate optimization (fusion, coalescing fix, occupancy tuning), re-profile, and verify improvement.

### 9.2 Tool Summary

| Tool | Scope | Key Capability |
|------|-------|---------------|
| PyTorch Profiler | Framework-level | Operator-level timing, FLOP estimates, trace visualization |
| Nsight Systems (`nsys`) | System-level | Timeline of all CPU/GPU activity, kernel launches, memory transfers |
| Nsight Compute (`ncu`) | Kernel-level | Detailed metrics per kernel: FLOPs, bytes, occupancy, stalls, roofline |
| `nvidia-smi` | Device-level | Utilization, memory usage, temperature, power |
| `torch.cuda.Event` | In-code | Precise timing of specific code regions |

### 9.3 Common Pitfalls in Profiling

- **Warmup**: The first kernel launch is slower due to CUDA context initialization, JIT compilation, and cuBLAS autotuning. Always discard the first few iterations.
- **Synchronization**: CUDA kernel launches are asynchronous. Measuring wall-clock time without `torch.cuda.synchronize()` measures launch time, not execution time.
- **Profiler overhead**: Profilers add overhead. Profile in targeted runs, not production training.
- **Small kernels**: Very small kernels may be dominated by launch overhead rather than compute or bandwidth. The roofline model does not apply well to these.

---

## 10. Key Takeaways

1. **Arithmetic intensity** ($\text{AI} = W/Q$) is the single most important metric for characterizing a workload's performance behavior. It determines whether a kernel is memory-bound or compute-bound.

2. The **roofline model** provides an upper bound on achievable performance: $P = \min(\pi, \text{AI} \times \beta)$. The **ridge point** $\pi/\beta$ separates the two regimes.

3. On modern GPUs with Tensor Cores, the ridge point is extremely high (591 FLOP/byte for H100 FP16). **Most ML operators are memory-bound**, including elementwise ops, normalization, softmax, and small GEMMs. Only large GEMMs and convolutions are compute-bound.

4. **Operator fusion** is the primary technique for improving memory-bound workloads. It eliminates HBM round-trips, effectively increasing the arithmetic intensity of the fused kernel.

5. **FlashAttention** is a textbook example of roofline-driven optimization: it increases attention's AI by $\sim 12\times$ by keeping intermediate results in SRAM, transforming it from memory-bound to compute-bound.

6. **Batch size** directly controls the arithmetic intensity of GEMM operations. Small-batch inference is memory-bound; large-batch training is compute-bound. This explains why inference optimization and training optimization require fundamentally different strategies.

7. The roofline model is a **first-order tool** -- it tells you the bottleneck type and sets performance expectations, but it does not capture all microarchitectural effects. Detailed profiling with Nsight Compute is necessary for kernel-level optimization.

---

## 11. Further Reading

1. **Williams, S., Waterman, A., & Patterson, D.** "Roofline: An Insightful Visual Performance Model for Multicore Architectures." *Communications of the ACM*, 52(4), 2009. The original roofline paper.

2. **Dao, T., Fu, D. Y., Ermon, S., Rudra, A., & Re, C.** "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." *NeurIPS*, 2022. The definitive example of roofline-driven algorithm design.

3. **Dao, T.** "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." *ICLR*, 2024. Improved version with better GPU occupancy and partitioning.

4. **Yang, C. T., Gayatri, R., Kurth, T., et al.** "Hierarchical Roofline Analysis for GPUs: Accelerating Performance Optimization for the NERSC-9 Perlmutter System." *Concurrency and Computation*, 2020. Extends roofline to multi-level memory hierarchies on GPUs.

5. **Milakov, M. & Gimelshein, N.** "Online Normalizer Calculation for Softmax." arXiv:1805.02867, 2018. Reduces softmax passes from 3 to 2.

6. **Ivanov, A., Dryden, N., Ben-Nun, T., Li, S., & Hoefler, T.** "Data Movement Is All You Need: A Case Study on Optimizing Transformers." *MLSys*, 2021. Applies roofline analysis systematically to Transformer operators.

7. **NVIDIA.** "Kernel Profiling Guide." *Nsight Compute Documentation*. Practical guide to using Nsight Compute for roofline analysis. https://docs.nvidia.com/nsight-compute/ProfilingGuide/

8. **Ofenbeck, G., Steinmann, R., Caparros, V., Spampinato, D., & Puschel, M.** "Applying the Roofline Model." *ISPASS*, 2014. Practical methodology for applying roofline analysis, including pitfalls and best practices.
