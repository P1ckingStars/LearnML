# Lecture 07a: Inference Optimization --- Batching, Operator Fusion, Graph Optimization

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Contrast** the computational profile of inference versus training, quantifying the memory savings from eliminating gradients, optimizer state, and activation checkpoints.
2. **Analyze** static, dynamic, and continuous batching strategies for autoregressive generation, deriving throughput and latency bounds for each under heterogeneous request lengths.
3. **Design** operator fusion strategies (vertical, horizontal, and attention fusion) for inference graphs and compute the resulting reduction in memory bandwidth consumption.
4. **Apply** graph-level optimizations --- constant folding, dead node elimination, shape inference, and layout optimization --- to a computation graph, proving correctness of each transformation.
5. **Distinguish** the prefill and decode phases of autoregressive inference, characterizing prefill as compute-bound and decode as memory-bandwidth-bound via the roofline model.

---

## 2. Motivation and Context

### 2.1 Why Inference is Different

During training, the dominant costs are:

1. **Forward pass** through the model to compute the loss.
2. **Backward pass** to compute gradients (roughly 2x the forward FLOPs).
3. **Optimizer step** to update parameters (additional state: momentum, variance in Adam).

At inference time, items 2 and 3 disappear entirely. For a model with $N$ parameters stored in FP16, the memory footprint changes dramatically:

| Component | Training (Adam, FP16/FP32 mixed) | Inference (FP16) |
|---|---|---|
| Parameters | $2N$ bytes (FP16) | $2N$ bytes |
| Gradients | $2N$ bytes (FP16) | 0 |
| Optimizer state | $8N$ bytes (FP32 momentum + variance) | 0 |
| Activations | $O(BLd)$ per layer (for backprop) | $O(Bd)$ per layer (current only) |
| **Total** | $\approx 12N + \text{activations}$ | $\approx 2N + \text{KV cache}$ |

For a 70B parameter model: training requires ~840 GB for parameters + optimizer state alone, while inference needs ~140 GB for parameters plus KV cache (analyzed in Lecture 07b).

### 2.2 The Latency-Throughput Tradeoff

Inference workloads face a fundamental tension:

- **Latency-sensitive** applications (chatbots, code completion) need low time-to-first-token (TTFT) and low inter-token latency (ITL).
- **Throughput-sensitive** applications (batch translation, offline summarization) want to maximize tokens per second per GPU dollar.

Batching increases throughput but can increase per-request latency. The optimization problem is:

$$\max_{B, \text{schedule}} \; \text{Throughput}(B) \quad \text{subject to} \quad \text{Latency}_{\text{p99}}(B) \leq L_{\max}$$

where $B$ is the batch size and the schedule governs how requests are admitted and completed.

### 2.3 The Memory Bandwidth Wall

Modern GPUs have vastly more compute than memory bandwidth. For an A100-80GB:

- Peak FP16 compute: 312 TFLOPS
- Memory bandwidth: 2.0 TB/s
- **Arithmetic intensity crossover**: $312 \times 10^{12} / (2.0 \times 10^{12}) = 156$ FLOPs/byte

Any operation that performs fewer than 156 FLOPs per byte loaded from HBM is **memory-bandwidth-bound**. As we will show, autoregressive decoding typically achieves 1--2 FLOPs/byte, making it overwhelmingly memory-bound. This is the central challenge of inference optimization.

---

## 3. Inference vs. Training: A Systems Perspective

### 3.1 Computational Graph Simplifications

At inference time, the computation graph can be simplified:

**No backward graph.** Training frameworks build a tape (PyTorch autograd) or dual graph (JAX) for automatic differentiation. At inference, we set `torch.no_grad()` or use `torch.inference_mode()`, which:

- Disables gradient tracking, eliminating the autograd graph.
- Allows in-place operations that would be illegal during training (because they would corrupt the backward pass).
- Reduces memory by not storing intermediate activations needed solely for backpropagation.

**Deterministic execution.** Without stochastic elements like dropout (disabled at inference), the graph becomes deterministic, enabling aggressive optimization.

**Static shapes (often).** Many inference scenarios have fixed or bounded input shapes, enabling ahead-of-time compilation and kernel selection.

### 3.2 The Roofline Model for Inference Operators

The roofline model relates an operator's **arithmetic intensity** $I$ (FLOPs per byte of memory traffic) to its achievable performance:

$$\text{Performance} = \min\left(\text{Peak FLOPS}, \; I \times \text{Memory Bandwidth}\right)$$

**Definition 3.1 (Arithmetic Intensity).** For an operator that performs $F$ floating-point operations and transfers $M$ bytes to/from memory:

$$I = \frac{F}{M} \quad [\text{FLOPs/byte}]$$

**Example: Matrix-vector product.** $y = Wx$ where $W \in \mathbb{R}^{m \times n}$, $x \in \mathbb{R}^n$:

- FLOPs: $2mn$ (multiply-add)
- Memory traffic: $2(mn + n + m)$ bytes (FP16), dominated by $2mn$ for the weight matrix
- Arithmetic intensity: $I \approx \frac{2mn}{2mn} = 1$ FLOP/byte

This is far below the A100 crossover point of 156, confirming that matrix-vector products (the core of single-token decoding) are extremely memory-bound.

**Example: Matrix-matrix product.** $C = AB$ where $A \in \mathbb{R}^{m \times k}$, $B \in \mathbb{R}^{k \times n}$:

- FLOPs: $2mkn$
- Memory traffic: $2(mk + kn + mn)$ bytes (FP16)
- Arithmetic intensity: $I = \frac{2mkn}{2(mk + kn + mn)}$

For square matrices of size $n$: $I = \frac{2n^3}{6n^2} = n/3$. At $n = 468$, we reach the crossover, and GEMMs become compute-bound. This is why **batching** is critical: it converts memory-bound matrix-vector products into compute-bound matrix-matrix products.

---

## 4. Batching Strategies

### 4.1 Static Batching

**Definition 4.1 (Static Batching).** A batch of $B$ requests is grouped before inference begins. All requests in the batch proceed in lockstep through each generation step. The batch completes when the longest sequence finishes.

```
Batch formation:
  Request 1: "Translate: Hello"     → generates 8 tokens
  Request 2: "Summarize: <long>"    → generates 200 tokens
  Request 3: "Answer: What is 2+2?" → generates 3 tokens

Static batching:
  Step 1:    [R1, R2, R3]  ← all active
  Step 3:    [R1, R2, R3]  ← R3 done, but slot occupied (padded)
  Step 8:    [R1, R2, R3]  ← R1 done, but slot occupied
  Step 200:  [R1, R2, R3]  ← R2 finally done; batch released
```

**Throughput analysis.** Let $T_i$ be the output length of request $i$. The total time is proportional to $\max_i T_i$. The GPU utilization is:

$$\eta_{\text{static}} = \frac{\sum_{i=1}^{B} T_i}{B \cdot \max_{i} T_i}$$

For requests with highly variable output lengths, $\eta_{\text{static}}$ can be very low. If $T_i \sim \text{Geometric}(p)$, then $\mathbb{E}[\max_i T_i] = \Theta(\log B / p)$ while $\mathbb{E}[T_i] = 1/p$, giving:

$$\eta_{\text{static}} \approx \frac{B / p}{B \cdot \log(B) / p} = \frac{1}{\log B}$$

which degrades logarithmically with batch size.

### 4.2 Dynamic Batching

**Definition 4.2 (Dynamic Batching).** Requests are batched opportunistically. A batch is formed when either (a) the batch reaches a size threshold $B_{\max}$, or (b) a timeout $\Delta t$ expires since the first waiting request arrived.

Dynamic batching helps with bursty arrival patterns but does not solve the padding waste problem within a batch.

### 4.3 Continuous Batching (In-flight Batching)

**Definition 4.3 (Continuous Batching).** At each generation step, the scheduler can:

1. **Evict** completed sequences from the batch.
2. **Admit** new sequences into the freed slots.

This was introduced by Orca (Yu et al., OSDI 2022) and is now the standard in vLLM, TGI, and other serving frameworks.

```python
# Pseudocode: Continuous batching scheduler
class ContinuousBatchScheduler:
    def __init__(self, max_batch_size, max_seq_len):
        self.max_batch = max_batch_size
        self.active = []       # currently generating
        self.waiting = []      # queued requests

    def step(self):
        # Remove completed sequences
        self.active = [r for r in self.active if not r.is_finished()]

        # Admit new sequences into freed slots
        available = self.max_batch - len(self.active)
        while available > 0 and self.waiting:
            req = self.waiting.pop(0)
            self.active.append(req)
            available -= 1

        # Run one forward pass on all active sequences
        if self.active:
            self.forward_step(self.active)
```

**Throughput analysis.** Under continuous batching with Poisson arrivals at rate $\lambda$ and geometric output lengths with mean $\mu$:

$$\text{Throughput} \approx \min\left(\lambda, \frac{B_{\max}}{\mu \cdot t_{\text{step}}}\right)$$

where $t_{\text{step}}$ is the per-step latency. The GPU utilization is:

$$\eta_{\text{continuous}} \approx \frac{\lambda \cdot \mu \cdot t_{\text{step}}}{B_{\max}} \quad \text{when } \lambda < \frac{B_{\max}}{\mu \cdot t_{\text{step}}}$$

In the fully loaded regime, $\eta_{\text{continuous}} \to 1$, a dramatic improvement over static batching.

### 4.4 Prefill-Decode Disaggregation

A subtlety in continuous batching is the tension between **prefill** (processing the input prompt) and **decode** (generating tokens one at a time):

- **Prefill** processes all prompt tokens in parallel. For a prompt of length $P$, the attention computation is $O(P^2 d)$ and the FFN computation is $O(Pd^2)$. This is a compute-bound GEMM.
- **Decode** generates one token at a time per sequence. The attention is $O(Sd)$ per sequence (where $S$ is the current sequence length) and the FFN is $O(d^2)$. This is a memory-bandwidth-bound operation.

Mixing prefill and decode in the same batch creates interference: the prefill GEMM wants large tiles on the tensor cores, while decode wants to minimize memory loads. Some systems (e.g., Splitwise, DistServe) **disaggregate** prefill and decode onto separate GPUs.

---

## 5. Operator Fusion

### 5.1 The Memory Bandwidth Tax

Consider a sequence of element-wise operations:

$$y = \text{GELU}(x W_1 + b_1) \cdot W_2 + b_2$$

Without fusion, each intermediate result is written to HBM and read back:

1. Compute $z_1 = xW_1$ (GEMM, write $z_1$ to HBM)
2. Read $z_1$, compute $z_2 = z_1 + b_1$ (write $z_2$ to HBM)
3. Read $z_2$, compute $z_3 = \text{GELU}(z_2)$ (write $z_3$ to HBM)
4. Compute $z_4 = z_3 W_2$ (GEMM, write $z_4$ to HBM)
5. Read $z_4$, compute $y = z_4 + b_2$ (write $y$ to HBM)

Steps 2, 3, and 5 are element-wise operations with arithmetic intensity $\approx 1$ FLOP/byte --- heavily memory-bound. Each round-trip to HBM costs $\approx 2 \times \text{tensor\_size} / \text{bandwidth}$.

### 5.2 Vertical Fusion (Operator Chaining)

**Definition 5.1 (Vertical Fusion).** Consecutive operations where the output of one feeds directly into the next are fused into a single kernel. The intermediate results remain in registers or shared memory (SRAM), avoiding HBM round-trips.

After vertical fusion of the bias add and GELU:

1. Compute $z_1 = xW_1$ (GEMM)
2. **Fused**: Read $z_1$, compute $z_3 = \text{GELU}(z_1 + b_1)$ (write $z_3$)
3. Compute $z_4 = z_3 W_2$ (GEMM)
4. **Fused into GEMM epilogue**: $y = z_4 + b_2$ (no extra write)

The bias-add after a GEMM can often be absorbed into the GEMM kernel itself as an **epilogue fusion**, which is trivially supported by cuBLAS and CUTLASS.

**Bandwidth savings.** If each tensor has $n$ elements in FP16 (2 bytes each), the unfused version transfers $2n \times 5 \times 2 = 20n$ bytes (5 read-write pairs). The fused version transfers $2n \times 2 \times 2 = 8n$ bytes (2 GEMM outputs). Savings: $60\%$.

### 5.3 Horizontal Fusion

**Definition 5.2 (Horizontal Fusion).** Independent operations that share the same input are fused into a single kernel that computes all outputs in one pass over the input.

**Example: QKV Projection.**

```python
# Unfused: 3 separate GEMMs, each reading X from HBM
Q = X @ W_Q   # Read X, W_Q; write Q
K = X @ W_K   # Read X, W_K; write K  (X read again!)
V = X @ W_V   # Read X, W_V; write V  (X read a third time!)

# Fused: Single GEMM with concatenated weight matrix
W_QKV = torch.cat([W_Q, W_K, W_V], dim=1)  # [d, 3d]
QKV = X @ W_QKV  # Read X once, write QKV
Q, K, V = QKV.chunk(3, dim=-1)
```

The fused version reads $X$ once instead of three times, saving $2 \times |X|$ bytes of memory traffic per redundant read.

### 5.4 Attention Fusion (FlashAttention)

The most impactful fusion for Transformer inference is fusing the entire attention computation:

$$\text{Attn}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

Without fusion, the $T \times T$ attention matrix must be materialized in HBM, costing $O(T^2)$ memory. **FlashAttention** (Dao et al., 2022) fuses the entire computation using a tiled algorithm:

1. Load tiles of $Q$, $K$, $V$ into SRAM.
2. Compute partial attention scores in SRAM.
3. Use online softmax (Milakov & Gimelshein, 2018) to accumulate the output without materializing the full attention matrix.
4. Write only the final output $O$ to HBM.

Memory complexity drops from $O(T^2)$ to $O(T)$. At inference time, FlashAttention is particularly important during the **prefill phase**, where $T$ (prompt length) can be large.

**FlashDecoding** (Dao et al., 2023) extends this to the decode phase, parallelizing across the KV cache length dimension.

---

## 6. Graph-Level Optimizations

### 6.1 Constant Folding

**Definition 6.1 (Constant Folding).** Any sub-graph whose inputs are all constants (known at compile time) is evaluated once at compilation and replaced with the resulting constant tensor.

**Example.** In a Transformer, layer normalization includes learned parameters $\gamma$ and $\beta$:

$$\text{LayerNorm}(x) = \gamma \odot \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta$$

If the subsequent operation is a linear layer $y = Wx + b$, these can be algebraically combined:

$$y = W\left(\gamma \odot \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta\right) + b = W' \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + b'$$

where $W' = W \cdot \text{diag}(\gamma)$ and $b' = W\beta + b$ can be precomputed. This is a form of **constant folding combined with algebraic simplification**.

### 6.2 Dead Node Elimination

**Definition 6.2 (Dead Node Elimination).** Nodes in the computation graph whose outputs are never consumed by any subsequent node are removed.

At inference time, this commonly eliminates:

- **Loss computation nodes** (cross-entropy, etc.) that exist for training.
- **Metric logging nodes** that are not needed for serving.
- **Auxiliary outputs** (e.g., intermediate layer representations) not required by the serving endpoint.

### 6.3 Shape Inference and Static Planning

When input shapes are known at compile time, the system can:

1. **Pre-allocate all intermediate buffers** with exact sizes, eliminating dynamic memory allocation overhead.
2. **Select optimal kernel configurations** (tile sizes, block dimensions) for each operator.
3. **Plan memory reuse**: if tensor $A$'s lifetime ends before tensor $B$'s lifetime begins, they can share the same memory.

**Theorem 6.1 (Optimal Memory Planning is NP-hard).** Given a DAG of operators with known intermediate tensor sizes and lifetimes, finding the minimum total memory allocation is equivalent to graph coloring, which is NP-hard in general. However, for the tree-structured graphs common in neural networks, efficient polynomial-time algorithms exist (e.g., using topological ordering with a greedy allocator).

In practice, frameworks like TensorRT and ONNX Runtime use heuristic memory planners that achieve near-optimal results for typical model architectures.

### 6.4 Layout Optimization

Different operators prefer different memory layouts:

- **Convolutions** on NVIDIA GPUs prefer NHWC (channels-last) for tensor core utilization.
- **Batch normalization** prefers NCHW (channels-first) for efficient reduction.
- **GEMMs** prefer row-major or column-major depending on the BLAS library.

**Definition 6.3 (Layout Optimization).** Insert minimal layout transformation (transpose) nodes into the graph to satisfy each operator's preferred layout, while minimizing the total number of transposes.

This is formulated as a shortest-path problem on a layout-assignment graph and solved efficiently by frameworks like TensorRT during the optimization phase.

---

## 7. The Prefill-Decode Dichotomy

### 7.1 Prefill Phase

Given an input prompt of $P$ tokens, prefill processes them all simultaneously:

**Attention computation during prefill:**

$$Q, K, V = XW_Q, \; XW_K, \; XW_V \qquad X \in \mathbb{R}^{P \times d}$$

$$O = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$$

FLOPs for the QKV projection: $3 \times 2Pd^2 = 6Pd^2$ (three GEMMs).

FLOPs for attention: $2P^2 d_k \cdot h + 2P^2 d_v \cdot h = 4P^2 d$ (score computation + value aggregation).

FLOPs for the output projection: $2Pd^2$.

FLOPs for the FFN (with hidden dimension $4d$): $2 \times 2P \times d \times 4d = 16Pd^2$.

**Total per layer:** $24Pd^2 + 4P^2d$.

For $P \ll 6d$, the $Pd^2$ terms dominate and prefill is compute-bound (large GEMM). For $P \gg 6d$, the quadratic attention term dominates.

### 7.2 Decode Phase

Each decode step generates **one token per sequence**. For a batch of $B$ sequences:

**FLOPs per layer per step:**

- QKV projection: $3 \times 2Bd^2 = 6Bd^2$ (but these are matrix-vector products for each sequence)
- Attention against cached $K, V$ of length $S$: $4BSd$ (per head: query-key dot product + value aggregation)
- Output projection: $2Bd^2$
- FFN: $16Bd^2$

**Total per layer per step:** $24Bd^2 + 4BSd$.

**Memory traffic per layer per step:** We must load all weights ($\approx 24d^2 \times 2$ bytes for FP16) plus the KV cache ($\approx 4BSd$ bytes). With $L$ layers:

$$\text{Memory traffic} = L \times (48d^2 + 4BSd) \; \text{bytes}$$

**Arithmetic intensity of decode:**

$$I_{\text{decode}} = \frac{L(24Bd^2 + 4BSd)}{L(48d^2 + 4BSd)} = \frac{24Bd^2 + 4BSd}{48d^2 + 4BSd}$$

For small $B$ and $S \ll d$: $I_{\text{decode}} \approx \frac{24Bd^2}{48d^2} = B/2$. On an A100 with crossover at 156, we need $B \geq 312$ to be compute-bound during decode. In practice, memory constraints on KV cache limit $B$ well below this.

### 7.3 Implications for System Design

| Property | Prefill | Decode |
|---|---|---|
| FLOPs per token | $O(Pd + d^2)$ | $O(Sd + d^2)$ |
| Bottleneck | Compute (tensor cores) | Memory bandwidth (HBM) |
| Batching benefit | Moderate (already GEMM) | Critical (increases arithmetic intensity) |
| Latency metric | TTFT | ITL |
| Parallelism | Across tokens in prompt | Across sequences in batch |

---

## 8. ONNX Runtime and TensorRT Optimization Pipelines

### 8.1 ONNX Runtime (ORT) Optimization Levels

ONNX Runtime applies optimizations in configurable levels:

- **Level 0 (Basic):** Constant folding, dead node elimination, redundant node removal.
- **Level 1 (Extended):** Operator fusion (e.g., Conv + BatchNorm, MatMul + Add), layout optimization.
- **Level 2 (All):** Complex fusions (multi-head attention fusion, embedding layer fusion), hardware-specific transformations.

```python
import onnxruntime as ort

sess_options = ort.SessionOptions()
sess_options.graph_optimization_level = (
    ort.GraphOptimizationLevel.ORT_ENABLE_ALL
)
sess_options.optimized_model_filepath = "model_optimized.onnx"

# Specify execution provider (CUDA, TensorRT, etc.)
session = ort.InferenceSession(
    "model.onnx",
    sess_options,
    providers=["CUDAExecutionProvider"]
)
```

### 8.2 TensorRT Optimization Pipeline

TensorRT applies a multi-phase optimization pipeline:

1. **Graph optimization:** Layer fusion, constant folding, dead node elimination.
2. **Precision calibration:** Mixed-precision (FP32/FP16/INT8) with calibration datasets.
3. **Kernel auto-tuning:** For each fused layer, TensorRT times multiple kernel implementations and selects the fastest for the target GPU.
4. **Memory optimization:** Workspace sizing, tensor reuse planning.
5. **Serialization:** The optimized engine is serialized as a binary plan file, specific to the target GPU architecture.

```python
import tensorrt as trt

logger = trt.Logger(trt.Logger.WARNING)
builder = trt.Builder(logger)
network = builder.create_network(
    1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
)
parser = trt.OnnxParser(network, logger)

# Parse ONNX model
with open("model.onnx", "rb") as f:
    parser.parse(f.read())

# Configure builder
config = builder.create_builder_config()
config.set_flag(trt.BuilderFlag.FP16)       # Enable FP16
config.set_memory_pool_limit(
    trt.MemoryPoolType.WORKSPACE, 1 << 30   # 1 GB workspace
)

# Build optimized engine
engine = builder.build_serialized_network(network, config)
```

The kernel auto-tuning step is what makes TensorRT particularly effective: it benchmarks hundreds of kernel variants (tile sizes, unrolling factors, shared memory usage) for each fused operator on the target hardware.

---

## Key Takeaways

1. **Inference eliminates the backward pass and optimizer state**, reducing memory from $\approx 12N$ bytes to $\approx 2N$ bytes (plus KV cache), and enabling different optimization strategies than training.
2. **Autoregressive decoding is memory-bandwidth-bound** with arithmetic intensity $\approx B/2$, far below the compute-memory crossover on modern GPUs. Batching is the primary remedy.
3. **Continuous batching** (Orca) eliminates the padding waste of static batching by allowing per-step eviction and admission of requests, achieving near-100% GPU utilization under load.
4. **Operator fusion** reduces memory bandwidth consumption by keeping intermediates in SRAM rather than writing to HBM. The three main patterns are vertical fusion (chaining), horizontal fusion (shared inputs), and attention fusion (FlashAttention).
5. **The prefill-decode dichotomy** is fundamental: prefill is compute-bound (large GEMMs over prompt tokens), decode is memory-bound (matrix-vector products for single tokens). Optimal serving must handle both efficiently, potentially on separate hardware.

---

## Exercises

### Theory

**Exercise 7a.1.** Compute the arithmetic intensity for the prefill and decode phases of LLaMA-2 7B ($L = 32$ layers, $d = 4096$, $h = 32$ heads, $d_k = 128$, FFN hidden dim $= 11008$) running on an A100-80GB (312 TFLOPS FP16, 2.0 TB/s bandwidth, crossover at 156 FLOPs/byte). Assume FP16 weights, prompt length $P = 2048$ for prefill, batch size $B = 1$ with sequence length $S = 512$ for decode. For each phase: (a) compute total FLOPs per layer (attention projections, attention scores, FFN), (b) compute total HBM traffic in bytes, (c) compute arithmetic intensity, and (d) classify as compute-bound or memory-bandwidth-bound. Explain why increasing batch size during decode shifts the regime toward compute-bound.

**Exercise 7a.2.** Consider a continuous batching system with maximum batch size $B_{\max}$, per-step latency $t_{\text{step}}$, and Poisson request arrivals at rate $\lambda$. Each request generates a geometrically distributed number of tokens with mean $\mu$. (a) Model the system as an M/G/$B_{\max}$ queue and derive the steady-state expected number of active slots as a function of $\lambda$, $\mu$, and $t_{\text{step}}$. (b) Express the throughput (tokens/second) and GPU utilization in terms of these quantities. (c) Derive the critical arrival rate $\lambda^*$ beyond which the system saturates. (d) Compare with static batching: if requests arrive in groups of $B_{\max}$ and output lengths follow the same geometric distribution, derive the expected utilization and show it degrades as $O(1/\log B_{\max})$.

**Exercise 7a.3.** Consider a sequence of three unfused operators applied to an activation tensor $X \in \mathbb{R}^{B \times T \times d}$ in FP16: LayerNorm (read $X$, $\gamma$, $\beta$; write $Y_1$), followed by a Linear projection $Y_2 = Y_1 W + b$ with $W \in \mathbb{R}^{d \times d}$ (read $Y_1$, $W$, $b$; write $Y_2$), followed by GELU (read $Y_2$; write $Y_3$). (a) For $B = 32$, $T = 1024$, $d = 4096$, compute the total HBM traffic in bytes for the unfused execution, counting every read and write of every tensor. (b) Now consider fusing LayerNorm + Linear into one kernel (intermediate $Y_1$ stays in SRAM) and fusing the GELU into the Linear's epilogue (intermediate $Y_2$ stays in registers). Compute the HBM traffic for the fused execution. (c) Compute the percentage reduction in HBM traffic and the expected wall-clock speedup, assuming these operators are entirely memory-bandwidth-bound.

### Implementation

**Exercise 7a.4.** Using PyTorch's built-in profiler (`torch.profiler`), profile the prefill and decode phases of a real Transformer model (e.g., GPT-2 or a small LLaMA). For prefill, pass a prompt of 1024 tokens; for decode, generate 128 tokens one at a time with batch size 1. Collect kernel-level traces and report: (a) the top-5 kernels by time for each phase, (b) the achieved TFLOPS and memory bandwidth utilization for the dominant GEMM kernels in each phase, (c) the arithmetic intensity of the dominant operations. Explain why prefill achieves higher FLOPS utilization than decode, connecting your measurements to the roofline analysis in Section 3.2.

**Exercise 7a.5.** Implement two batching strategies for a mock autoregressive serving system. Represent each request as a random generation length drawn from a geometric distribution with mean 100 tokens, and simulate the forward pass as a fixed per-step delay (e.g., `time.sleep`). (a) Implement a **static batcher** that collects $B$ requests, runs them in lockstep, and pads shorter sequences until the longest finishes. (b) Implement a **continuous batcher** (as in Section 4.3) that evicts completed sequences and admits waiting requests at each step. (c) Under Poisson arrivals at varying rates, measure and plot throughput (requests/second) and p50/p99 latency for both strategies. Explain the throughput gap by computing the effective GPU utilization $\eta$ for each strategy.

**Exercise 7a.6.** Using Triton, implement a fused kernel for the softmax + scale + mask pattern commonly used in causal attention score computation: $S' = \text{mask}(S / \sqrt{d_k})$ followed by $P = \text{softmax}(S')$ where the mask sets upper-triangular entries to $-\infty$. (a) Write a single Triton kernel that loads a row of $S$, applies scaling, applies the causal mask, and computes the softmax (using the two-pass max-subtract-exp-sum algorithm) without writing any intermediate result to HBM. (b) Write an equivalent unfused PyTorch implementation that materializes each intermediate. (c) Benchmark both implementations for $N \in \{512, 1024, 2048, 4096\}$ with $d_k = 128$ and report wall-clock time and effective memory bandwidth. Explain the performance difference in terms of HBM round-trips saved.

---

## Further Reading

1. **Yu et al.** "Orca: A Distributed Serving System for Transformer-Based Generative Models." OSDI 2022. --- Introduces continuous batching.
2. **Dao et al.** "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." NeurIPS 2022. --- Tiled, fused attention algorithm.
3. **Dao.** "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." ICLR 2024.
4. **Williams, Waterman, and Patterson.** "Roofline: An Insightful Visual Performance Model for Multicore Architectures." CACM 2009. --- The roofline model.
5. **NVIDIA TensorRT Documentation.** developer.nvidia.com/tensorrt --- Optimization pipeline details.
6. **ONNX Runtime Documentation.** onnxruntime.ai --- Graph optimization levels and execution providers.
7. **Zhong et al.** "DistServe: Disaggregating Prefill and Decoding for Goodput-optimized Large Language Model Serving." OSDI 2024.
8. **Agrawal et al.** "Sarathi: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills." arXiv 2023.
