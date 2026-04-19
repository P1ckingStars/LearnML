# Lecture 05c: Megatron-LM, DeepSpeed, and Large-Scale Frameworks

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** the 3D parallelism strategy (tensor, pipeline, data) used by Megatron-LM and how the parallelism dimensions map to GPU cluster topology.
2. **Compare** DeepSpeed ZeRO stages (0, 1, 2, 3) in terms of memory savings, communication volume, and implementation complexity.
3. **Configure** a combined parallelism strategy (TP + PP + DP + ZeRO) for a target model size and cluster, reasoning about the memory and throughput tradeoffs.
4. **Analyze** real-world training configurations from published model training reports (GPT-3, LLaMA, Bloom, DeepSeek) and justify the design choices.
5. **Identify** the key implementation details that differentiate production training systems from naive parallelism: sequence parallelism, interleaved pipeline schedules, and communication-computation overlap.

---

## 2. Motivation and Context

### 2.1 The Scale of Modern Training

Training frontier language models requires parallelism across thousands of GPUs:

| Model | Parameters | GPUs | Training Time | Parallelism Strategy |
|-------|-----------|------|---------------|---------------------|
| GPT-3 (2020) | 175B | 10,000 V100 | 3,640 petaflop/s-days | Model + data parallelism |
| PaLM (2022) | 540B | 6,144 TPU v4 | ~50 days | Data + model parallelism |
| LLaMA-2 70B (2023) | 70B | 2,048 A100 | ~29 days | TP=8, PP=4, DP=64 |
| Llama 3 405B (2024) | 405B | 16,384 H100 | ~54 days | TP=8, PP=16, DP=128 |

No single parallelism dimension suffices. Data parallelism alone requires each GPU to hold the full model. Tensor parallelism alone is limited by inter-GPU bandwidth within a node. Pipeline parallelism alone suffers from bubble overhead. The solution is **3D parallelism**: combining all three.

### 2.2 Framework Landscape

Two frameworks dominate large-scale training:

- **Megatron-LM** (NVIDIA): Highly optimized for NVIDIA hardware. Implements tensor, pipeline, and sequence parallelism with custom CUDA kernels. The performance reference for LLM training.
- **DeepSpeed** (Microsoft): Focuses on memory efficiency through ZeRO optimizer partitioning. More general-purpose, supports diverse model architectures.

In practice, many organizations use **Megatron-DeepSpeed**, a hybrid combining Megatron-LM's parallelism and kernels with DeepSpeed's ZeRO optimizer and infrastructure.

### 2.3 Prerequisites

This lecture builds directly on Module 04:
- Lecture 04a: Data parallelism and AllReduce
- Lecture 04b: Tensor and pipeline parallelism fundamentals
- Lecture 04c: ZeRO and FSDP
- Lecture 05a: Mixed precision (BF16/FP16 compute)
- Lecture 05b: Gradient checkpointing

---

## 3. Megatron-LM: 3D Parallelism

### 3.1 Parallelism Dimensions

Megatron-LM organizes GPUs into a 3D grid: $(t, p, d)$ where:
- $t$: tensor parallelism degree (GPUs sharing one layer)
- $p$: pipeline parallelism degree (GPUs in a pipeline stage chain)
- $d$: data parallelism degree (GPUs processing different data)

Total GPU count: $N = t \times p \times d$.

**Key design principle:** Map parallelism dimensions to the hardware topology:

```
  ┌───────────────────────────────────────────────┐
  │  Node 0 (8 GPUs connected by NVLink/NVSwitch) │
  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
  │  │GPU 0│─│GPU 1│─│GPU 2│─│GPU 3│  ← TP group  │
  │  └─────┘ └─────┘ └─────┘ └─────┘              │
  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
  │  │GPU 4│─│GPU 5│─│GPU 6│─│GPU 7│  ← TP group  │
  │  └─────┘ └─────┘ └─────┘ └─────┘              │
  └──────────────────────┬────────────────────────┘
                         │ InfiniBand / RoCE
  ┌──────────────────────┴────────────────────────┐
  │  Node 1                                        │
  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
  │  │GPU 8│─│GPU 9│─│GPU10│─│GPU11│  ← TP group  │
  │  └─────┘ └─────┘ └─────┘ └─────┘              │
  │  ...                                           │
  └────────────────────────────────────────────────┘
```

- **Tensor parallelism** ($t$): Within a node (NVLink, ~900 GB/s on H100). TP requires all-reduce after every layer, so it needs the highest bandwidth.
- **Pipeline parallelism** ($p$): Across adjacent nodes. PP sends activations between stages (point-to-point), moderate bandwidth requirement.
- **Data parallelism** ($d$): Across the remaining GPUs. DP synchronizes gradients via AllReduce, which can be overlapped with backward computation.

### 3.2 Tensor Parallelism in Megatron-LM

Megatron-LM partitions transformer layers across $t$ GPUs using two complementary strategies:

**Column-parallel linear (MLP first layer, QKV projection):**

Partition the weight matrix $W \in \mathbb{R}^{d \times d}$ column-wise:

$$W = [W_1 | W_2 | \ldots | W_t], \quad W_i \in \mathbb{R}^{d \times (d/t)}$$

Each GPU $i$ computes $Y_i = XW_i$, producing a partial output. No communication is needed after the column-parallel layer because the next layer uses the partitioned output directly.

**Row-parallel linear (MLP second layer, output projection):**

Partition $W$ row-wise:

$$W = \begin{bmatrix} W_1 \\ W_2 \\ \vdots \\ W_t \end{bmatrix}, \quad W_i \in \mathbb{R}^{(d/t) \times d}$$

Each GPU $i$ computes $Y_i = X_i W_i$ (where $X_i$ is GPU $i$'s partition from the previous column-parallel layer). The outputs are summed via **AllReduce**: $Y = \sum_i Y_i$.

**Communication pattern for one transformer layer:**

```
  Column-parallel QKV      Row-parallel Output Proj
  ┌─────────────────┐      ┌─────────────────┐
  │ GPU 0: X W_Q0   │      │ GPU 0: A_0 W_O0 │──┐
  │ GPU 1: X W_Q1   │      │ GPU 1: A_1 W_O1 │──┤ AllReduce
  │ GPU 2: X W_Q2   │      │ GPU 2: A_2 W_O2 │──┤ (sync)
  │ GPU 3: X W_Q3   │      │ GPU 3: A_3 W_O3 │──┘
  └─────────────────┘      └─────────────────┘
      No comm needed         1 AllReduce per layer

  Column-parallel MLP Up    Row-parallel MLP Down
  ┌─────────────────┐      ┌─────────────────┐
  │ GPU 0: X W_up0  │      │ GPU 0: H_0 W_dn0│──┐
  │ GPU 1: X W_up1  │      │ GPU 1: H_1 W_dn1│──┤ AllReduce
  │ GPU 2: X W_up2  │      │ GPU 2: H_2 W_dn2│──┤ (sync)
  │ GPU 3: X W_up3  │      │ GPU 3: H_3 W_dn3│──┘
  └─────────────────┘      └─────────────────┘
      No comm needed         1 AllReduce per layer

  Total: 2 AllReduce per transformer block (forward)
       + 2 AllReduce per transformer block (backward)
       = 4 AllReduce per block per training step
```

**Communication volume per AllReduce:** $2 \times \frac{t-1}{t} \times B \times s \times d$ bytes (ring AllReduce).

### 3.3 Sequence Parallelism

Megatron-LM extends tensor parallelism with **sequence parallelism** (Korthikanti et al., 2023). Operations that are **not** parallelized by TP (LayerNorm, dropout, residual connections) have their activations replicated on all $t$ GPUs — wasting memory.

Sequence parallelism partitions the sequence dimension across the TP group for these operations:

```
Without sequence parallelism:
  Each of t GPUs stores full activations (B, s, d) for non-TP ops.
  Activation memory: B * s * d per GPU (replicated).

With sequence parallelism:
  Each GPU stores (B, s/t, d) for non-TP ops.
  Activation memory: B * s * d / t per GPU.

  The AllReduce in TP is replaced by:
  - ReduceScatter before LayerNorm (each GPU gets 1/t of sequence)
  - AllGather before the next TP region (each GPU gets full sequence)
```

The communication volume is identical to AllReduce (ReduceScatter + AllGather = AllReduce), but activation memory is reduced by a factor of $t$ for non-TP operations.

### 3.4 Pipeline Parallelism in Megatron-LM

Megatron-LM implements two pipeline schedules:

**GPipe schedule (non-interleaved):**
Each stage processes all micro-batches in the forward pass, then all micro-batches in the backward pass.

```
Time →
GPU 0: [F1][F2][F3][F4][  ][  ][  ][  ][B4][B3][B2][B1]
GPU 1: [  ][F1][F2][F3][F4][  ][  ][B4][B3][B2][B1][  ]
GPU 2: [  ][  ][F1][F2][F3][F4][B4][B3][B2][B1][  ][  ]
GPU 3: [  ][  ][  ][F1][F2][F3][B3][B2][B1][  ][  ][  ]

Bubble fraction = (p - 1) / (m + p - 1)
```

**1F1B schedule (interleaved):**
Each stage alternates between forward and backward micro-batches, reducing the pipeline bubble:

```
Time →
GPU 0: [F1][F2][F3][F4][B1][F5][B2][F6][B3][  ][B4][  ][B5][B6]
GPU 1: [  ][F1][F2][F3][B1][F4][B2][F5][B3][F6][B4][  ][B5][B6]
GPU 2: [  ][  ][F1][F2][B1][F3][B2][F4][B3][F5][B4][F6][B5][B6]
GPU 3: [  ][  ][  ][F1][B1][F2][B2][F3][B3][F4][B4][F5][B5][B6]

Bubble fraction ≈ (p - 1) / (m + p - 1) (same asymptotic)
But in-flight micro-batches are limited to p, reducing peak memory.
```

**Interleaved pipeline schedule (Megatron-LM v2):**
Assign $v$ virtual stages to each physical GPU (non-contiguous layers). This reduces the bubble by a factor of $v$:

$$\text{Bubble fraction} = \frac{p - 1}{v \cdot m + p - 1}$$

For $v = 2$, the bubble is approximately halved. The cost is $v\times$ more point-to-point communication, but this is typically cheap relative to the compute.

### 3.5 Putting It Together: 3D Parallelism Configuration

**Example: Training a 175B model on 512 A100-80GB GPUs.**

Model: 96 layers, $d = 12288$, $h = 96$, $d_{\text{ff}} = 49152$, BF16.

Step 1: **Memory budget.** Per-GPU memory: 80 GB. Optimizer states + gradients for the full model: ~3.3 TB. Each GPU can hold at most $\sim$3 GB of parameter-related state.

Step 2: **Tensor parallelism.** Set $t = 8$ (one node). Each GPU holds $1/8$ of each layer. Parameter memory per GPU: ~$175B \times 2 / 8 = 43.75$ GB in BF16 (but optimizer is sharded by DP).

Step 3: **Pipeline parallelism.** Set $p = 8$ (8 stages, 12 layers each). Each GPU holds only 12 layers' worth of parameters: $\sim 175B \times 2 / (8 \times 8) \approx 5.5$ GB.

Step 4: **Data parallelism.** $d = 512 / (8 \times 8) = 8$. Use ZeRO-1 to shard optimizer states across the DP group.

Step 5: **Micro-batching.** With $p = 8$ pipeline stages and $m = 64$ micro-batches, bubble fraction $\approx 7/71 \approx 10\%$.

Step 6: **Verify memory.** Per-GPU:
- Parameters (BF16, 12 layers, TP=8): $\sim 5.5$ GB
- Optimizer states (ZeRO-1, sharded across DP=8): $\sim 5.5$ GB
- Gradients (BF16): $\sim 5.5$ GB
- Activations (with gradient checkpointing): $\sim 20$ GB
- CUDA context, buffers: $\sim 5$ GB
- **Total: $\sim 41.5$ GB** (fits in 80 GB with margin)

---

## 4. DeepSpeed ZeRO

### 4.1 ZeRO Stages Recap

ZeRO (Zero Redundancy Optimizer) eliminates memory redundancy across data-parallel ranks by partitioning (not replicating) optimizer states, gradients, and parameters.

Let $P$ = total parameters, $D$ = data-parallel degree, and assume Adam optimizer (12 bytes per parameter in FP32: 4B weight + 4B $m$ + 4B $v$; plus 2B gradient in BF16; plus 2B weight in BF16):

| Stage | What is Partitioned | Per-GPU Memory | Communication |
|-------|--------------------|-----------------------|---------------|
| ZeRO-0 | Nothing (standard DP) | $2P + 2P + 12P = 16P$ | AllReduce gradients |
| ZeRO-1 | Optimizer states | $2P + 2P + 12P/D$ | AllReduce gradients |
| ZeRO-2 | + Gradients | $2P + 2P/D + 12P/D$ | ReduceScatter grad, AllGather grad |
| ZeRO-3 | + Parameters | $2P/D + 2P/D + 12P/D = 16P/D$ | AllGather params (fwd+bwd) |

### 4.2 ZeRO-3: All-Gather on Demand

ZeRO-3 is the most aggressive stage: parameters themselves are partitioned. Each GPU stores only $1/D$ of the parameters. During the forward pass, parameters are gathered on demand:

```
Algorithm: ZeRO-3 Forward Pass
─────────────────────────────────────
For each layer l = 1, ..., L:
  1. AllGather: Collect full parameters θ_l from all D ranks
  2. Compute: h_l = f_l(h_{l-1}; θ_l)
  3. Discard: Free the gathered parameters (keep only local shard)
```

The backward pass similarly gathers parameters, computes gradients, and then ReduceScatters the gradients:

```
Algorithm: ZeRO-3 Backward Pass
─────────────────────────────────────
For each layer l = L, ..., 1:
  1. AllGather: Collect full parameters θ_l
  2. Compute: ∂L/∂h_{l-1} and ∂L/∂θ_l
  3. ReduceScatter: Each rank gets 1/D of the gradient
  4. Discard: Free gathered parameters
```

### 4.3 Communication Analysis

**ZeRO-1 and ZeRO-2** have the same total communication volume as standard AllReduce: $2P$ bytes per step (with the ring algorithm). The operations are just decomposed differently.

**ZeRO-3** adds parameter gathering. Total communication per step:

$$\text{AllGather (fwd)} + \text{AllGather (bwd)} + \text{ReduceScatter (grad)} = P + P + P = 3P$$

Each AllGather transfers $P$ bytes (each rank contributes its $P/D$ shard to reconstruct the full parameter tensor). This is $1.5\times$ the communication of standard DP (which uses a single AllReduce costing $2P$). However, ZeRO-3 enables training models that would not fit on a single GPU at all, making the comparison somewhat moot.

**Overlap with compute:** DeepSpeed overlaps parameter AllGather with the forward computation of the preceding layer. Similarly, gradient ReduceScatter overlaps with the backward computation. This hides most of the communication latency.

```python
# Conceptual overlap in ZeRO-3
for layer in model.layers:
    # Start AllGather for next layer (async)
    next_layer.params.allgather_async()

    # Compute current layer (overlaps with allgather)
    output = layer(input)

    # Wait for allgather to complete
    next_layer.params.allgather_wait()
```

### 4.4 DeepSpeed Configuration

DeepSpeed is configured via a JSON file:

```json
{
  "train_batch_size": 2048,
  "train_micro_batch_size_per_gpu": 4,
  "gradient_accumulation_steps": 64,

  "bf16": {
    "enabled": true
  },

  "zero_optimization": {
    "stage": 2,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8,
    "allgather_bucket_size": 5e8
  },

  "gradient_clipping": 1.0,

  "activation_checkpointing": {
    "partition_activations": true,
    "contiguous_memory_optimization": true,
    "cpu_checkpointing": false,
    "number_checkpoints": null
  },

  "wall_clock_breakdown": true
}
```

Key parameters:
- `reduce_bucket_size`: Gradients are bucketed for communication efficiency. Larger buckets improve bandwidth utilization but increase latency.
- `overlap_comm`: Overlap gradient communication with backward computation.
- `contiguous_gradients`: Allocate gradients in a contiguous buffer (reduces fragmentation, enables more efficient AllReduce).
- `partition_activations`: In ZeRO-3, partition checkpointed activations across DP ranks (further memory savings).

### 4.5 DeepSpeed ZeRO-Infinity

ZeRO-Infinity (Rajbhandari et al., 2021) extends ZeRO-3 to **offload** parameters, gradients, and optimizer states to CPU memory or NVMe storage:

| Offload Target | Capacity | Bandwidth | Latency |
|---------------|----------|-----------|---------|
| GPU HBM | 80 GB | ~3 TB/s | ~ns |
| CPU DRAM | 512 GB - 2 TB | ~50 GB/s (PCIe) | ~100 ns |
| NVMe SSD | 2-8 TB | ~7 GB/s | ~10 us |

This enables training models with trillions of parameters on clusters with limited GPU memory, at the cost of lower throughput. The key is **prefetching**: overlap NVMe/CPU reads with GPU computation.

---

## 5. Combined Parallelism Strategies

### 5.1 Strategy Selection Framework

Given a model with $P$ parameters and a cluster with $N$ GPUs, each with $M$ bytes of GPU memory:

**Step 1: Determine tensor parallelism degree $t$.**
- $t$ = number of GPUs per node (typically 8 for A100/H100 nodes).
- Constraint: $t$ must divide the attention head count $h$ and the MLP hidden dimension $d_{\text{ff}}$.

**Step 2: Determine pipeline parallelism degree $p$.**
- Start with $p = 1$. Increase $p$ if the model's per-stage memory (after TP) exceeds the GPU budget.
- Rule of thumb: $p$ should be the minimum value such that $\text{layers\_per\_stage} \times \text{memory\_per\_layer}(t) \le M - \text{overhead}$.
- The number of micro-batches $m$ should satisfy $m \gg p$ to minimize bubble overhead.

**Step 3: Determine data parallelism degree $d$.**
- $d = N / (t \times p)$.
- Choose ZeRO stage based on remaining memory pressure:
  - Memory comfortable: ZeRO-1 (minimal communication overhead).
  - Memory tight: ZeRO-2 (partition gradients too).
  - Memory critical: ZeRO-3 (partition everything).

**Step 4: Verify throughput.**
- Compute MFU (Model FLOPS Utilization).
- If MFU is low, the parallelism strategy may have too much communication overhead. Reduce $t$ or $p$ if possible.

### 5.2 Configuration Guidelines by Model Size

| Model Size | GPUs | Recommended Configuration |
|------------|------|--------------------------|
| 1-7B | 8-64 | TP=1-8, PP=1, DP=rest, ZeRO-2 or FSDP |
| 7-30B | 64-256 | TP=8, PP=1-4, DP=rest, ZeRO-1 |
| 30-100B | 256-2048 | TP=8, PP=4-8, DP=rest, ZeRO-1 |
| 100-500B | 2048-16384 | TP=8, PP=8-16, DP=rest, ZeRO-1 |
| 500B+ | 16384+ | TP=8, PP=16-64, DP=rest, ZeRO-1-2 |

### 5.3 Process Group Setup

Megatron-LM creates three process groups from the global set of GPUs:

```python
import torch.distributed as dist

def initialize_parallel_groups(
    tensor_parallel_size: int,
    pipeline_parallel_size: int,
    world_size: int,
):
    """Create the three parallelism process groups.

    GPU layout (example: TP=2, PP=2, DP=2, 8 GPUs total):

    DP Group 0: [GPU0, GPU4]   DP Group 1: [GPU1, GPU5]
    DP Group 2: [GPU2, GPU6]   DP Group 3: [GPU3, GPU7]

    TP Group 0: [GPU0, GPU1]   TP Group 1: [GPU2, GPU3]
    TP Group 2: [GPU4, GPU5]   TP Group 3: [GPU6, GPU7]

    PP Group 0: [GPU0, GPU2]   PP Group 1: [GPU1, GPU3]
    PP Group 2: [GPU4, GPU6]   PP Group 3: [GPU5, GPU7]
    """
    rank = dist.get_rank()
    data_parallel_size = world_size // (tensor_parallel_size *
                                         pipeline_parallel_size)

    # -- Tensor Parallel Groups --
    # GPUs within the same TP group are on the same node
    num_tp_groups = world_size // tensor_parallel_size
    for i in range(num_tp_groups):
        ranks = list(range(i * tensor_parallel_size,
                           (i + 1) * tensor_parallel_size))
        group = dist.new_group(ranks)
        if rank in ranks:
            tp_group = group

    # -- Pipeline Parallel Groups --
    # GPUs in the same PP group handle consecutive stages
    num_pp_groups = world_size // pipeline_parallel_size
    for i in range(num_pp_groups):
        ranks = list(range(i, world_size,
                           world_size // pipeline_parallel_size))
        # Adjust indexing based on TP layout
        group = dist.new_group(ranks)
        if rank in ranks:
            pp_group = group

    # -- Data Parallel Groups --
    # GPUs in the same DP group process different data for the same stage
    num_dp_groups = world_size // data_parallel_size
    for i in range(num_dp_groups):
        ranks = [i + j * num_dp_groups for j in range(data_parallel_size)]
        group = dist.new_group(ranks)
        if rank in ranks:
            dp_group = group

    return tp_group, pp_group, dp_group
```

---

## 6. Case Studies

### 6.1 GPT-3 (175B) — Brown et al., 2020

**Configuration:**
- 175B parameters: 96 layers, $d = 12288$, $h = 96$
- 10,000 V100-32GB GPUs (pre-NVSwitch era)
- Tensor parallelism: $t = 8$ (within DGX-1 nodes)
- Model parallelism across 8 GPUs per model replica
- Data parallelism: $d = 1250$ replicas
- Mixed precision: FP16 with loss scaling
- Global batch size: 3.2M tokens

**Key decisions:**
- V100 lacks native BF16, so FP16 + loss scaling was necessary.
- The cluster's InfiniBand network limited DP gradient sync bandwidth, so large gradient accumulation steps ($m = 32$) were used to amortize communication.

### 6.2 LLaMA-2 70B — Touvron et al., 2023

**Configuration:**
- 70B parameters: 80 layers, $d = 8192$, $h = 64$, GQA with 8 KV heads
- 2,048 A100-80GB GPUs
- TP=8, PP=4 (virtual stages: 2), DP=64
- BF16 training (no loss scaling needed)
- Gradient checkpointing: selective (attention scores only)
- Sequence length: 4096
- Global batch size: 4M tokens

**Training throughput:** ~380 TFLOPS per GPU (MFU ~43%).

**Key decisions:**
- GQA (Grouped-Query Attention) reduces KV cache size and the tensor parallelism communication for KV projections.
- Selective checkpointing (not full) because FlashAttention already eliminates the dominant activation memory term.
- PP=4 with interleaved schedule (virtual stages=2), giving bubble fraction $\approx 3/(2 \times 128 + 3) \approx 1.2\%$.

### 6.3 BLOOM 176B — BigScience, 2022

**Configuration:**
- 176B parameters: 70 layers, $d = 14336$, $h = 112$
- 384 A100-80GB GPUs (Jean Zay supercomputer)
- TP=4, PP=12, DP=8
- Megatron-DeepSpeed (ZeRO-1 for optimizer state sharding)
- BF16 training
- Gradient checkpointing: every layer

**Key decisions:**
- Only 384 GPUs available (much less than GPT-3's 10,000). Required aggressive memory optimization.
- PP=12 is unusually high, reflecting the memory pressure: each stage holds only ~6 layers.
- TP=4 (not 8) because the 112 attention heads are evenly divisible by 4 but not 8 would have wasted head slots. (In practice, 112/8 = 14, which works, but BLOOM's configuration chose TP=4 for other performance reasons.)

### 6.4 DeepSeek-V2 (236B MoE) — DeepSeek, 2024

**Configuration:**
- 236B total parameters (21B active per token, MoE architecture)
- 160 experts per layer, top-2 routing
- TP=8, EP (expert parallelism)=4-8, PP=4, DP=variable
- FP8 training with per-tensor delayed scaling
- Custom communication overlap for expert routing

**Key insight:** MoE models have a different parallelism profile. The expert layers are embarrassingly parallel (each expert is independent), but the routing layer creates an all-to-all communication pattern. Expert parallelism (EP) distributes experts across GPUs, with tokens routed via AllToAll.

---

## 7. Implementation Details That Matter

### 7.1 Communication-Computation Overlap

The single most important optimization for scaling efficiency is **overlapping communication with computation**. Without overlap, GPUs are idle during communication; with overlap, the communication is hidden behind useful work.

**Gradient AllReduce overlap with backward:**

```python
# Conceptual: overlap gradient AllReduce with backward computation
# DeepSpeed and Megatron-LM both implement this

hooks = []
for param in model.parameters():
    def allreduce_hook(grad, param=param):
        # Launch async allreduce as soon as gradient is computed
        handle = dist.all_reduce(grad, group=dp_group, async_op=True)
        # Store handle to synchronize later
        param._allreduce_handle = handle
        return grad

    hooks.append(param.register_post_accumulate_grad_hook(allreduce_hook))

# During backward, gradients for later layers are allreduced
# while earlier layers are still computing their gradients.
```

**Bucketed AllReduce:** Small tensors are grouped into buckets (typically 25 MB) before communication, improving bandwidth utilization. The bucket size is a tunable parameter.

### 7.2 Fused Kernels

Megatron-LM includes custom CUDA kernels that fuse multiple operations to reduce memory bandwidth pressure:

- **Fused softmax:** Combines the three-pass softmax (max, sum, divide) into a single kernel with shared memory.
- **Fused bias + GeLU:** Eliminates an intermediate activation tensor by fusing the bias add and GeLU activation.
- **Fused bias + dropout + residual + LayerNorm:** A single kernel that avoids writing and reading four intermediate tensors.

Memory savings from fused kernels: ~20-30% reduction in peak activation memory for a transformer block.

### 7.3 Deterministic Training

At scale, non-determinism is a debugging nightmare. Sources of non-determinism:

1. **Floating-point non-associativity:** $(a + b) + c \neq a + (b + c)$ in floating point. AllReduce order across ranks may vary.
2. **cuDNN autotuning:** Different algorithms selected on different runs.
3. **CUDA atomics:** Concurrent atomic operations have non-deterministic order.

Megatron-LM addresses this with:
- Fixed AllReduce order (ring topology).
- `torch.backends.cudnn.deterministic = True`.
- Seeded dropout with per-tensor-parallel-rank RNG states.

### 7.4 Memory Fragmentation Management

Long training runs on large models can suffer from GPU memory fragmentation, where total free memory is sufficient but no contiguous block is large enough for the next allocation.

Strategies:
- **Pre-allocate activation buffers:** Allocate the maximum-size activation buffer once at startup and reuse it.
- **Memory pool management:** Use PyTorch's CUDA caching allocator with a fixed memory pool.
- **Periodic garbage collection:** `torch.cuda.empty_cache()` at checkpoint boundaries.

```python
# Pre-allocate activation memory to avoid fragmentation
def preallocate_activation_memory(model, max_seq_len, batch_size):
    """Run a dummy forward/backward to warm up memory allocator."""
    dummy_input = torch.randn(
        batch_size, max_seq_len, model.config.hidden_size,
        device='cuda', dtype=torch.bfloat16,
    )
    output = model(dummy_input)
    output.sum().backward()
    del output, dummy_input
    torch.cuda.empty_cache()
```

---

## 8. FSDP vs. Megatron-LM vs. DeepSpeed: When to Use What

| Criterion | FSDP (PyTorch) | Megatron-LM | DeepSpeed ZeRO |
|-----------|---------------|-------------|----------------|
| Ease of use | High (wraps any model) | Low (Megatron-specific) | Medium (config-based) |
| Performance at scale | Good | Best (NVIDIA-tuned) | Good to very good |
| Tensor parallelism | Manual or via DTensor | Built-in, optimized | Via Megatron-DeepSpeed |
| Pipeline parallelism | Not built-in | Built-in, interleaved | Built-in |
| Memory efficiency | Good (ZeRO-3 equivalent) | Good (TP + checkpointing) | Best (ZeRO-Infinity) |
| FP8 support | Via Transformer Engine | Native TE integration | Via Transformer Engine |
| Custom architectures | Any PyTorch model | Transformers only | Any PyTorch model |
| Debugging | Easier (standard PyTorch) | Harder (custom code) | Medium |

**Recommendation:**
- **Research / small teams / non-transformer models:** FSDP or DeepSpeed ZeRO.
- **Production LLM training at > 100B scale:** Megatron-LM or Megatron-DeepSpeed.
- **Memory-constrained training (limited GPUs, huge models):** DeepSpeed ZeRO-3 or ZeRO-Infinity.

---

## 9. Throughput Metrics

### 9.1 Model FLOPS Utilization (MFU)

MFU measures what fraction of the hardware's peak FLOPS is utilized by useful model computation:

$$\text{MFU} = \frac{\text{Model FLOPS per step} / \text{Step time}}{\text{Hardware peak FLOPS}}$$

The "model FLOPS" counts only the forward + backward computation of the model itself, excluding communication, checkpointing overhead, and optimizer steps.

For a transformer with $P$ parameters, $B$ tokens per step:

$$\text{Model FLOPS per step} \approx 6PB$$

(Factor of 6 = 2 for forward matmuls $\times$ 3 for forward + backward.)

**Example:** Llama-2 70B on 2048 A100s:
- $6 \times 70 \times 10^9 \times 4 \times 10^6 \approx 1.68 \times 10^{18}$ FLOPS per step
- Step time: ~4.4 seconds
- Throughput: $1.68 \times 10^{18} / 4.4 \approx 3.82 \times 10^{17}$ FLOPS/s
- Per GPU: $3.82 \times 10^{17} / 2048 \approx 1.86 \times 10^{14}$ FLOPS/s
- A100 BF16 peak: $3.12 \times 10^{14}$ FLOPS/s
- MFU $\approx 60\%$

### 9.2 Hardware FLOPS Utilization (HFU)

HFU includes all FLOPS (including recomputation from gradient checkpointing):

$$\text{HFU} = \frac{\text{Total FLOPS (including recomputation)} / \text{Step time}}{\text{Hardware peak FLOPS}}$$

HFU > MFU when gradient checkpointing is used. A high HFU with low MFU indicates excessive recomputation.

---

## 10. Scaling Laws and Compute-Optimal Training

Understanding scaling laws is essential for planning large-scale training runs. Before choosing a parallelism strategy or sizing a cluster, you need to answer a more fundamental question: given a compute budget, how large should the model be and how much data should it train on?

### 10.1 Neural Scaling Laws (Kaplan et al., 2020)

Kaplan et al. discovered that language model loss follows **power-law relationships** with model size $N$, dataset size $D$, and compute budget $C$:

$$L(N) \sim N^{-\alpha_N}, \quad L(D) \sim D^{-\alpha_D}, \quad L(C) \sim C^{-\alpha_C}$$

Empirical exponents measured across several orders of magnitude:
- $\alpha_N \approx 0.076$ (loss improves slowly with model size)
- $\alpha_D \approx 0.095$ (loss improves slightly faster with data)

Key findings:
- Loss curves are **smooth and predictable** across 6+ orders of magnitude of compute. A small-scale experiment reliably predicts large-scale performance.
- Performance depends more strongly on scale (parameters and data) than on architectural details like depth-to-width ratio.
- These are **diminishing returns**: each 10x increase in compute yields a roughly fixed reduction in loss.

### 10.2 Chinchilla Scaling (Hoffmann et al., 2022)

Hoffmann et al. revisited scaling laws and found that Kaplan et al. had significantly underestimated the importance of training data. The **compute-optimal** allocation scales model size and data equally:

$$N_{\text{opt}} \propto C^{0.5}, \quad D_{\text{opt}} \propto C^{0.5}$$

For a given compute budget $C$, optimal model size $N$ and dataset size $D$ should grow at the same rate. This yields the **Chinchilla ratio**: approximately **20 tokens per parameter** for compute-optimal training.

The FLOP budget for a transformer relates to $N$ and $D$ via:

$$C \approx 6ND$$

(factor of 6 = 2 multiply-accumulate ops per parameter in forward $\times$ 3 for forward + backward.)

**Implication: many models were undertrained.** GPT-3 175B trained on 300B tokens, but Chinchilla-optimal training would call for $\sim$3.5T tokens. The table below compares actual training configurations against Chinchilla-optimal predictions:

| Model | Params ($N$) | Tokens ($D$) | Tokens/Param | Chinchilla-Optimal $D$ | Status |
|-------|-------------|-------------|-------------|----------------------|--------|
| GPT-3 | 175B | 300B | 1.7 | ~3.5T | Undertrained ~12x |
| Chinchilla | 70B | 1.4T | 20.0 | 1.4T | Compute-optimal |
| LLaMA-1 65B | 65B | 1.4T | 21.5 | ~1.3T | Slightly overtrained |
| LLaMA-2 70B | 70B | 2.0T | 28.6 | ~1.4T | Intentionally overtrained |
| Llama 3 405B | 405B | 15.6T | 38.5 | ~8.1T | Heavily overtrained |

### 10.3 Systems Implications of Scaling Laws

Scaling laws transform training from an empirical guess into an engineering planning problem.

**Compute budget planning.** Given a target loss and the scaling law exponents, determine the required FLOP budget $C$. Then:

$$C \approx 6ND$$

Choose $N$ and $D$ according to the desired scaling regime (Chinchilla-optimal or inference-aware).

**Cluster sizing.** Given $C$ FLOPs and a target training time $T$:

$$\text{GPUs} = \frac{C}{\text{per\_GPU\_FLOPS} \times \text{MFU} \times T}$$

**Example: Llama 3 405B training budget.**
- $N = 405 \times 10^9$, $D = 15.6 \times 10^{12}$ tokens
- $C \approx 6 \times 405 \times 10^9 \times 15.6 \times 10^{12} \approx 3.8 \times 10^{25}$ FLOPs
- H100 peak BF16: $9.9 \times 10^{14}$ FLOPS/s, assume MFU $\approx 0.40$
- Effective per-GPU throughput: $\sim 3.96 \times 10^{14}$ FLOPS/s
- For 16,384 GPUs: $3.96 \times 10^{14} \times 16384 \approx 6.49 \times 10^{18}$ FLOPS/s cluster-wide
- Training time: $3.8 \times 10^{25} / 6.49 \times 10^{18} \approx 5.85 \times 10^6$ s $\approx$ 68 days

**Memory planning.** Model size $N$ determines the parallelism strategy. The parameter memory footprint dictates the minimum TP and PP degrees (see Section 5.1), and the data size $D$ determines the total training steps and thus the wall-clock time.

**Cost estimation.** Cloud GPU costs translate directly:

$$\text{Training cost} = \text{GPUs} \times \text{hours} \times \text{\$/GPU-hour}$$

At ~\$2/H100-hour, the Llama 3 405B run costs approximately $16384 \times 68 \times 24 \times 2 \approx$ \$53.5M in raw compute.

### 10.4 Beyond Chinchilla

**Inference-aware scaling.** Chinchilla optimizes for training compute alone, but inference cost scales with $N$ (not $D$). If a model will serve billions of queries, a smaller model trained on more data (beyond Chinchilla-optimal) amortizes inference cost. This is the LLaMA philosophy: train a 70B model on 2T+ tokens rather than a Chinchilla-optimal 120B model on 1.2T tokens. The 70B model is cheaper to serve despite costing more to train.

**Data-constrained regimes.** When high-quality data is exhausted, scaling laws break down. Strategies include repeating data (with diminishing returns after ~4 epochs), using synthetic data, and filtering aggressively for quality. Muennighoff et al. (2023) study how scaling laws change under data constraints, finding that repeating data is worth up to ~4 epochs before the loss reduction from additional compute plateaus.

**Scaling laws for fine-tuning.** Scaling laws also apply to downstream fine-tuning and transfer learning, though with different exponents. Hernandez et al. (2021) show that transfer can provide an effective 10-100x data efficiency gain, and the benefit scales predictably with pre-training compute.

---

## Key Takeaways

1. **3D parallelism is essential at scale.** Tensor parallelism exploits intra-node NVLink bandwidth, pipeline parallelism distributes layers across nodes, and data parallelism scales to thousands of GPUs with gradient synchronization.

2. **Map parallelism to topology.** TP within a node (highest bandwidth), PP across adjacent nodes, DP across the cluster. Violating this mapping dramatically reduces throughput.

3. **ZeRO stages trade communication for memory.** ZeRO-1 is nearly free and should always be used. ZeRO-2 adds minimal overhead. ZeRO-3 is more expensive ($1.5\times$ the communication of standard DP) but enables models that otherwise would not fit.

4. **Communication-computation overlap is the key to scaling efficiency.** Without overlap, communication is pure overhead. With overlap, it is mostly hidden.

5. **Sequence parallelism** extends tensor parallelism to non-TP operations, reducing activation memory without additional communication cost.

6. **MFU is the primary throughput metric.** Aim for 40-60% on A100/H100. Below 30% indicates a parallelism configuration problem.

---

## Further Reading

### Required

1. **Shoeybi, M., et al.** (2019). "Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism." arXiv:1909.08053.
   - The foundational Megatron-LM paper. Introduces column/row-parallel linear layers for tensor parallelism.

2. **Rajbhandari, S., et al.** (2020). "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models." *SC 2020*.
   - Defines ZeRO stages 1-3 with detailed communication analysis.

### Recommended

3. **Narayanan, D., et al.** (2021). "Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM." *SC 2021*.
   - Describes 3D parallelism, interleaved pipeline schedules, and sequence parallelism.

4. **Korthikanti, V., et al.** (2023). "Reducing Activation Recomputation in Large Transformer Models." *MLSys 2023*.
   - Selective recomputation and sequence parallelism details.

5. **Rajbhandari, S., et al.** (2021). "ZeRO-Infinity: Breaking the GPU Memory Wall for Extreme Scale Deep Learning." *SC 2021*.
   - NVMe offloading for training models with trillions of parameters.

6. **Dubey, A., et al.** (2024). "The Llama 3 Herd of Models." arXiv:2407.21783.
   - Sections 3.3-3.4 describe the training infrastructure and parallelism configuration for 405B.

7. **Kaplan, J., et al.** (2020). "Scaling Laws for Neural Language Models." arXiv:2001.08361.
   - The original neural scaling laws paper. Establishes power-law relationships between loss and model size, data, and compute.

8. **Hoffmann, J., et al.** (2022). "Training Compute-Optimal Large Language Models." arXiv:2203.15556.
   - The Chinchilla paper. Shows that model size and training data should scale equally with compute budget.

9. **Touvron, H., et al.** (2023). "LLaMA: Open and Efficient Foundation Language Models." arXiv:2302.13971.
   - Demonstrates inference-aware scaling: training smaller models well beyond Chinchilla-optimal on more data.

### Practical References

10. **NVIDIA Megatron-LM GitHub Repository.**
   - https://github.com/NVIDIA/Megatron-LM

11. **Microsoft DeepSpeed Documentation.**
   - https://www.deepspeed.ai/

12. **PyTorch FSDP Tutorial.**
   - https://pytorch.org/tutorials/intermediate/FSDP_tutorial.html
