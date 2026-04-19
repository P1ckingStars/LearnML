# Lecture 04c: ZeRO, FSDP, and Memory-Efficient Training

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Decompose** the memory footprint of mixed-precision training into its constituents (parameters, gradients, optimizer states, activations) and compute precise byte counts for a given model architecture.
2. **Derive** the memory savings and communication costs of ZeRO Stages 1, 2, and 3, proving that Stage 3 achieves $O(1/N)$ memory scaling at the cost of increased communication.
3. **Analyze** PyTorch FSDP's implementation -- flat parameters, all-gather/reduce-scatter communication patterns, and the interaction with mixed precision and gradient accumulation.
4. **Compare** DDP, FSDP, and DeepSpeed ZeRO along the axes of memory efficiency, communication volume, implementation complexity, and performance, identifying the optimal choice for different model sizes and cluster configurations.
5. **Design** an activation checkpointing strategy that minimizes peak memory by trading recomputation for memory, deriving the optimal checkpoint placement for a given memory budget.

---

## 2. Motivation and Context

### 2.1 The Memory Wall

Consider training a 7B parameter model with Adam in mixed precision:

| Component | Formula | 7B Model |
|---|---|---|
| BF16 parameters | $2P$ | 14 GB |
| BF16 gradients | $2P$ | 14 GB |
| FP32 master weights | $4P$ | 28 GB |
| FP32 Adam $m$ | $4P$ | 28 GB |
| FP32 Adam $v$ | $4P$ | 28 GB |
| **Subtotal (model states)** | **$16P$** | **112 GB** |
| Activations (estimate) | varies | 20-80 GB |
| **Total** | | **132-192 GB** |

A single A100 (80 GB) cannot hold even the model states. Yet this is a "small" model by 2024 standards. We need strategies to reduce per-device memory while maintaining training throughput.

### 2.2 Key Observation: Redundancy in Data Parallelism

In standard data parallelism (DDP), every worker holds a complete copy of:
- All parameters
- All gradients
- All optimizer states (master weights + Adam moments)

With $N$ workers, we store $N$ complete copies of everything -- $N \times 16P$ bytes total across the cluster. But at any given moment, each worker only *needs* a fraction of this data. ZeRO and FSDP exploit this observation.

---

## 3. Detailed Memory Analysis

### 3.1 Parameter Memory

For mixed-precision training, each parameter exists in two copies:
- **BF16 (or FP16) copy**: Used in forward and backward passes. Size: $2P$ bytes.
- **FP32 master copy**: Maintained by the optimizer for numerical stability. Size: $4P$ bytes.

Total parameter memory: $6P$ bytes.

### 3.2 Gradient Memory

Gradients are computed in BF16 during the backward pass. Size: $2P$ bytes.

Some frameworks also maintain FP32 gradient buffers for accumulation, adding another $4P$ bytes, but this is not universal.

### 3.3 Optimizer State Memory

For Adam, each parameter has two additional states:
- First moment $m_t = \beta_1 m_{t-1} + (1-\beta_1) g_t$: FP32, $4P$ bytes.
- Second moment $v_t = \beta_2 v_{t-1} + (1-\beta_2) g_t^2$: FP32, $4P$ bytes.

For SGD with momentum, only one state: $4P$ bytes. For AdaFactor, states can be further compressed using row/column factorization.

### 3.4 Activation Memory

Activations are the intermediate tensors stored during the forward pass for use in the backward pass. For a Transformer layer with batch size $b$, sequence length $s$, hidden dimension $d$, and intermediate FFN dimension $4d$ (in BF16):

| Tensor | Shape | Bytes |
|---|---|---|
| Input to LayerNorm 1 | $(b, s, d)$ | $2bsd$ |
| Attention input ($Q, K, V$) | $3 \times (b, s, d)$ | $6bsd$ |
| Attention scores | $(b, h, s, s)$ | $2bs^2h$ |
| Attention output (pre-projection) | $(b, s, d)$ | $2bsd$ |
| Input to LayerNorm 2 | $(b, s, d)$ | $2bsd$ |
| FFN intermediate | $(b, s, 4d)$ | $8bsd$ |
| GeLU input (for gradient) | $(b, s, 4d)$ | $8bsd$ |
| Dropout masks | multiple | $\sim 2bsd$ |
| **Total per layer** | | $\approx 30bsd + 2bs^2h$ |

For $L$ layers, total activation memory: $L \cdot (30bsd + 2bs^2h)$ bytes.

**Example.** Llama 2 7B ($d=4096$, $h=32$, $L=32$, $s=4096$, $b=1$):
- Per layer: $30 \times 1 \times 4096 \times 4096 + 2 \times 1 \times 4096^2 \times 32 \approx 503\text{M} + 1074\text{M} = 1577\text{M}$ bytes $\approx 1.5$ GB
- Total: $32 \times 1.5 \approx 48$ GB

This shows that activation memory is a major concern, especially as sequence length grows (quadratic in $s$ from attention scores).

---

## 4. ZeRO: Zero Redundancy Optimizer

### 4.1 Overview (Rajbhandari et al., 2020)

ZeRO (Zero Redundancy Optimizer) partitions model states across data-parallel workers instead of replicating them. It has three stages, each partitioning an additional component:

| Stage | What is partitioned | Per-device memory | Communication vs DDP |
|---|---|---|---|
| **DDP** (baseline) | Nothing | $16P + 2P$ | $2M$ (AllReduce) |
| **ZeRO-1** | Optimizer states | $4P + 12P/N$ | 1.5x DDP |
| **ZeRO-2** | + Gradients | $2P + 14P/N$ | Same as DDP |
| **ZeRO-3** | + Parameters | $16P/N$ | 1.5x DDP |

### 4.2 ZeRO Stage 1: Optimizer State Partitioning

**Idea.** Partition the optimizer states (FP32 master weights + Adam $m$ and $v$) across $N$ workers. Each worker is responsible for updating only $P/N$ parameters.

**Forward and Backward.** Identical to DDP: each worker holds full BF16 parameters and gradients. AllReduce synchronizes gradients.

**Optimizer step.** Each worker $k$:
1. Has the full synchronized gradient $\bar{g}$.
2. Updates only its partition of parameters: $\theta^{(k)}_{t+1} = \text{AdamUpdate}(\theta^{(k)}_t, \bar{g}^{(k)}, m^{(k)}_t, v^{(k)}_t)$.
3. After the update, an **AllGather** distributes the updated BF16 parameters to all workers.

**Memory per worker:**
- BF16 parameters: $2P$ (full copy)
- BF16 gradients: $2P$ (full copy)
- FP32 master weights: $4P/N$ (partitioned)
- Adam $m$: $4P/N$ (partitioned)
- Adam $v$: $4P/N$ (partitioned)
- **Total**: $4P + 12P/N$

**Communication.** The AllReduce for gradients is unchanged. The additional AllGather for updated parameters costs $\frac{N-1}{N} \cdot 2P$ bytes per worker. Total communication per step:

$$V_{\text{ZeRO-1}} = \underbrace{2 \cdot \frac{N-1}{N} \cdot 2P}_{\text{gradient AllReduce}} + \underbrace{\frac{N-1}{N} \cdot 2P}_{\text{parameter AllGather}} = \frac{N-1}{N} \cdot 6P$$

Compared to DDP's $\frac{N-1}{N} \cdot 4P$, ZeRO-1 adds 50% more communication. In practice, the AllGather can be overlapped with computation.

### 4.3 ZeRO Stage 2: Gradient Partitioning

**Idea.** In addition to optimizer state partitioning, partition gradients. Each worker only needs gradients for its assigned parameters.

**Backward pass.** Replace the gradient AllReduce with a **ReduceScatter**: each worker receives the fully reduced gradient for only its $P/N$ parameters. Gradients for non-owned parameters are discarded after the ReduceScatter.

**Memory per worker:**
- BF16 parameters: $2P$ (full copy)
- BF16 gradients: $2P/N$ (partitioned -- only own partition retained)
- Optimizer states: $12P/N$ (partitioned)
- **Total**: $2P + 14P/N$

**Communication.** The ReduceScatter communicates the same volume as an AllReduce's reduce-scatter phase:

$$V_{\text{ReduceScatter}} = \frac{N-1}{N} \cdot 2P$$

Plus the AllGather for parameters (same as ZeRO-1):

$$V_{\text{ZeRO-2}} = \frac{N-1}{N} \cdot 2P + \frac{N-1}{N} \cdot 2P = \frac{N-1}{N} \cdot 4P$$

This is the same as DDP. ZeRO-2 achieves better memory efficiency with *no additional communication*.

**Theorem 4.1 (ZeRO-2 Communication Equivalence).** ZeRO Stage 2 communicates the same volume per worker as vanilla DDP with AllReduce.

*Proof.* DDP AllReduce = ReduceScatter + AllGather, costing $2 \cdot \frac{N-1}{N} \cdot 2P$ total. ZeRO-2 performs ReduceScatter on gradients ($\frac{N-1}{N} \cdot 2P$) and AllGather on updated parameters ($\frac{N-1}{N} \cdot 2P$). These sums are equal. The difference is *when* the communication happens: DDP does both in the backward pass; ZeRO-2 does ReduceScatter in backward and AllGather after the optimizer step. $\blacksquare$

### 4.4 ZeRO Stage 3: Parameter Partitioning

**Idea.** Partition everything: parameters, gradients, and optimizer states. Each worker holds only $P/N$ parameters.

**Forward pass.** Before each layer's forward computation, **AllGather** the layer's parameters from all workers. After the computation, discard the non-owned parameters.

**Backward pass.** Similarly, AllGather parameters for each layer before computing gradients. After the backward pass through a layer, **ReduceScatter** the gradients and discard non-owned gradients.

**Memory per worker:**
- BF16 parameters: $2P/N$ (partitioned)
- BF16 gradients: $2P/N$ (partitioned -- only briefly full during each layer's backward)
- Optimizer states: $12P/N$ (partitioned)
- **Total**: $16P/N$

This scales inversely with $N$ -- with 64 GPUs, memory per GPU drops by $64\times$.

**Communication.** In the forward pass, we AllGather full BF16 parameters for each layer: $\frac{N-1}{N} \cdot 2P$ bytes total. In the backward pass, we AllGather parameters again (for gradient computation) and ReduceScatter gradients: $\frac{N-1}{N} \cdot 2P + \frac{N-1}{N} \cdot 2P$ bytes.

$$V_{\text{ZeRO-3}} = \underbrace{\frac{N-1}{N} \cdot 2P}_{\text{forward AllGathers}} + \underbrace{\frac{N-1}{N} \cdot 2P}_{\text{backward AllGathers}} + \underbrace{\frac{N-1}{N} \cdot 2P}_{\text{backward ReduceScatters}} = 3 \cdot \frac{N-1}{N} \cdot 2P = \frac{N-1}{N} \cdot 6P$$

This is $1.5\times$ the communication of DDP (which is $\frac{N-1}{N} \cdot 4P$).

### 4.5 ZeRO Summary

**Theorem 4.2 (ZeRO Memory-Communication Trade-off).** The three ZeRO stages provide the following trade-offs:

| | Per-device memory | Communication (relative to DDP) |
|---|---|---|
| DDP | $16P + 2P = 18P$ | $1\times$ |
| ZeRO-1 | $4P + 12P/N$ | $1.5\times$ |
| ZeRO-2 | $2P + 14P/N$ | $1\times$ |
| ZeRO-3 | $16P/N$ | $1.5\times$ |

For large $N$, ZeRO-3 memory approaches $0$, enabling arbitrarily large models to be trained with enough GPUs. The communication overhead of $1.5\times$ is modest and can be partially hidden by overlapping with computation.

---

## 5. PyTorch FSDP

### 5.1 Overview

Fully Sharded Data Parallelism (FSDP) is PyTorch's implementation of ZeRO Stage 3. It shards parameters, gradients, and optimizer states across all data-parallel workers.

### 5.2 Flat Parameters

FSDP flattens all parameters in a module into a single 1D tensor (the "flat parameter"), then shards this flat tensor across workers. This has several benefits:

1. **Coalesced communication**: A single AllGather/ReduceScatter operates on the flat tensor, avoiding per-parameter communication overhead.
2. **Contiguous memory**: The flat tensor is stored contiguously, enabling efficient memory allocation.
3. **Padding**: The flat tensor is padded to be divisible by the world size $N$.

```python
# Simplified FSDP flat parameter construction
def flatten_params(module):
    """Flatten all parameters into a single contiguous tensor."""
    params = list(module.parameters())
    flat = torch.cat([p.detach().reshape(-1) for p in params])
    # Pad to be divisible by world_size
    padded_size = math.ceil(flat.numel() / world_size) * world_size
    flat_padded = torch.zeros(padded_size, dtype=flat.dtype, device=flat.device)
    flat_padded[:flat.numel()] = flat
    return flat_padded

def get_shard(flat_param, rank, world_size):
    """Get this rank's shard of the flat parameter."""
    shard_size = flat_param.numel() // world_size
    return flat_param[rank * shard_size : (rank + 1) * shard_size]
```

### 5.3 FSDP Communication Pattern

**Forward Pass:**

```python
def fsdp_forward(module, input, rank, world_size):
    # 1. AllGather: reconstruct full parameters
    full_params = all_gather(module.flat_shard, world_size)  # (shard_size * N,)

    # 2. Unflatten into original parameter shapes
    set_module_params(module, unflatten(full_params))

    # 3. Compute forward pass
    output = module.original_forward(input)

    # 4. Free full parameters (keep only shard)
    free_full_params(module)

    return output
```

**Backward Pass:**

```python
def fsdp_backward(module, grad_output, rank, world_size):
    # 1. AllGather: reconstruct full parameters (needed for gradient computation)
    full_params = all_gather(module.flat_shard, world_size)
    set_module_params(module, unflatten(full_params))

    # 2. Compute gradients (standard backward)
    grad_input, grad_params = compute_grads(module, grad_output)

    # 3. Free full parameters
    free_full_params(module)

    # 4. Flatten gradients
    flat_grad = flatten(grad_params)

    # 5. ReduceScatter: each rank gets its shard of the averaged gradient
    grad_shard = reduce_scatter(flat_grad, world_size)

    # 6. Store gradient shard for optimizer
    module.grad_shard = grad_shard / world_size

    return grad_input
```

### 5.4 FSDP Sharding Strategies

PyTorch FSDP supports multiple sharding strategies:

```python
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,  # ZeRO-3
    # Other options:
    # ShardingStrategy.SHARD_GRAD_OP  -> ZeRO-2
    # ShardingStrategy.NO_SHARD       -> DDP
    # ShardingStrategy.HYBRID_SHARD   -> ZeRO-3 within node, DDP across nodes
    auto_wrap_policy=size_based_auto_wrap_policy,
    mixed_precision=MixedPrecision(
        param_dtype=torch.bfloat16,
        reduce_dtype=torch.float32,
        buffer_dtype=torch.bfloat16,
    ),
)
```

### 5.5 FSDP Unit Wrapping

FSDP wraps the model at configurable granularity. Each "FSDP unit" is the unit of sharding and communication:

- **Coarse wrapping** (e.g., entire model as one unit): one large AllGather/ReduceScatter, less overlap opportunity.
- **Fine wrapping** (e.g., each Transformer layer): smaller, more frequent AllGathers, better overlap with computation.

The standard practice is to wrap each Transformer layer (or each TransformerBlock) as one FSDP unit:

```python
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
from transformers.models.llama.modeling_llama import LlamaDecoderLayer

auto_wrap_policy = functools.partial(
    transformer_auto_wrap_policy,
    transformer_layer_cls={LlamaDecoderLayer},
)

model = FSDP(model, auto_wrap_policy=auto_wrap_policy)
```

### 5.6 Communication-Computation Overlap in FSDP

FSDP prefetches the next layer's parameters while the current layer is computing:

**Forward:**
```
Layer i compute:     [========]
Layer i+1 AllGather:     [====]        <- prefetch overlaps with compute
Layer i+1 compute:           [========]
Layer i+2 AllGather:             [====]
```

**Backward:**
```
Layer i grad compute:    [========]
Layer i ReduceScatter:       [====]    <- overlap with next layer's AllGather
Layer i-1 AllGather:         [====]    <- prefetch
Layer i-1 grad compute:         [========]
```

This overlap is critical for hiding the $1.5\times$ communication overhead of ZeRO-3/FSDP.

---

## 6. Activation Checkpointing (Gradient Checkpointing)

### 6.1 The Memory-Compute Trade-off

**Observation.** During the backward pass, we need the activations from the forward pass. Standard approach: store all activations (high memory). Alternative: discard activations and recompute them during backward (low memory, more compute).

### 6.2 Checkpoint Placement

**Chen et al. (2016).** For a network with $L$ layers, checkpoint every $\sqrt{L}$ layers. During backward, recompute the activations between checkpoints from the nearest checkpoint.

**Theorem 6.1 (Optimal Checkpointing for Sequential Networks).** For a sequential network of $L$ layers, each requiring $a$ bytes of activation memory and $c$ FLOPs to compute:

- **No checkpointing**: Memory $= La$, Compute $= Lc$ (forward only).
- **Full checkpointing** (checkpoint every layer): Memory $= a$, Compute $= 2Lc$ (recompute everything).
- **$\sqrt{L}$ checkpointing**: Memory $= \sqrt{L} \cdot a + \sqrt{L} \cdot a = 2\sqrt{L} \cdot a$, Compute $= Lc + Lc = 2Lc$.

Wait -- let us derive this properly. With $k$ checkpoints at layers $c_1, c_2, \ldots, c_k$ (equally spaced, so the gap is $L/k$ layers):

- **Checkpoint memory**: $k \cdot a$ (storing checkpoint activations).
- **Segment recomputation memory**: $L/k \cdot a$ (the longest segment between checkpoints).
- **Total memory**: $k \cdot a + (L/k) \cdot a = a(k + L/k)$.
- **Recomputation cost**: Each of the $L$ layers' activations is recomputed at most once, from its nearest checkpoint. Total recomputation FLOPs $\leq Lc$.

Minimizing $k + L/k$ subject to $k \geq 1$: take derivative $\frac{d}{dk}(k + L/k) = 1 - L/k^2 = 0$, giving $k^* = \sqrt{L}$.

$$\text{Memory}^* = 2a\sqrt{L}, \quad \text{Recomputation FLOPs} \leq Lc$$

**Corollary 6.1.** $\sqrt{L}$ checkpointing reduces activation memory from $O(L)$ to $O(\sqrt{L})$ at the cost of ~33% additional total training step time (since one extra forward pass $\approx F$ is added to the base $F_{\text{fwd}} + F_{\text{bwd}} \approx 3F$, giving $4F$ total).

### 6.3 Selective Checkpointing

Not all activations are equal in memory cost. For Transformers, the attention scores $(b, h, s, s)$ dominate when $s$ is large. Selective checkpointing discards only the most memory-intensive activations:

```python
from torch.utils.checkpoint import checkpoint

class TransformerBlock(nn.Module):
    def forward(self, x):
        # Checkpoint the attention (which stores large (b,h,s,s) scores)
        attn_out = checkpoint(self.attention, x, use_reentrant=False)
        x = x + attn_out
        # Don't checkpoint FFN (smaller activations, faster to keep)
        ffn_out = self.ffn(self.norm2(x))
        x = x + ffn_out
        return x
```

### 6.4 Activation Checkpointing with FSDP

When combining FSDP with activation checkpointing, the interaction must be carefully managed:

1. FSDP frees parameters after forward -- but if we recompute activations in backward, we need to AllGather parameters again.
2. This means activation checkpointing with FSDP increases communication: each checkpointed layer requires an extra AllGather in the backward pass.

**Memory saved:** activation memory for checkpointed layers.
**Extra cost:** one additional AllGather per checkpointed layer in backward.

This trade-off is almost always worthwhile for large models, since activation memory is typically the binding constraint.

---

## 7. Comparison: DDP vs FSDP vs DeepSpeed ZeRO

### 7.1 Feature Comparison

| Feature | DDP | FSDP | DeepSpeed ZeRO |
|---|---|---|---|
| Parameter sharding | No | Yes (Stage 3) | Yes (Stage 1/2/3) |
| Gradient sharding | No | Yes | Yes (Stage 2/3) |
| Optimizer sharding | No | Yes | Yes (Stage 1/2/3) |
| CPU offloading | No | Planned/Limited | Yes (ZeRO-Offload) |
| NVMe offloading | No | No | Yes (ZeRO-Infinity) |
| Mixed precision | Manual | Built-in | Built-in |
| Activation checkpointing | Manual | Composable | Built-in |
| Framework | PyTorch native | PyTorch native | DeepSpeed library |

### 7.2 When to Use What

**DDP**: Model fits in one GPU with all training state. Simplest, fastest (no parameter gathering overhead).

**FSDP / ZeRO-2**: Model fits in one GPU for forward/backward, but optimizer states do not. Minimal communication overhead.

**FSDP / ZeRO-3**: Model does not fit in one GPU at all. Accept the $1.5\times$ communication overhead for $N\times$ memory reduction.

### 7.3 Concrete Memory Comparison

**Example: 13B parameter model, 8 GPUs, BF16+FP32 Adam.**

| Component | DDP (per GPU) | FSDP (per GPU) |
|---|---|---|
| BF16 params | 26 GB | 3.25 GB |
| BF16 grads | 26 GB | 3.25 GB |
| FP32 master | 52 GB | 6.5 GB |
| FP32 Adam $m$ | 52 GB | 6.5 GB |
| FP32 Adam $v$ | 52 GB | 6.5 GB |
| **Total model states** | **208 GB** | **26 GB** |

DDP is completely infeasible (208 GB > 80 GB per A100). FSDP reduces to 26 GB, leaving 54 GB for activations and other buffers.

---

## 8. Advanced Topics

### 8.1 ZeRO-Offload and ZeRO-Infinity

**ZeRO-Offload (Ren et al., 2021).** Offload optimizer states and optionally parameters to CPU memory, using CPU compute for the optimizer step. This leverages the much larger CPU memory (hundreds of GB to TB) at the cost of CPU-GPU transfer bandwidth.

**Communication pattern:**
1. Forward and backward on GPU (with parameters in GPU memory or streamed from CPU).
2. After backward: transfer gradients to CPU.
3. CPU performs optimizer step (Adam update).
4. Transfer updated parameters back to GPU.

**Bandwidth requirement:** For a model with $P$ parameters in BF16, each step transfers $\sim 4P$ bytes GPU $\to$ CPU (gradients) and $\sim 2P$ bytes CPU $\to$ GPU (updated parameters). For a 13B model: $\sim 78$ GB per step over PCIe Gen4 ($\sim 32$ GB/s) = $\sim 2.4$ seconds. This is only viable when computation time exceeds transfer time.

**ZeRO-Infinity (Rajbhandari et al., 2021).** Extends offloading to NVMe SSDs, enabling training of models with trillions of parameters on a single node by using the SSD as an extension of memory.

### 8.2 FSDP2 and DTensor

PyTorch FSDP2 (released with PyTorch 2.3+) is built on top of DTensor, a distributed tensor abstraction. Key improvements:

1. **Per-parameter sharding**: Instead of flat parameters, each parameter is individually sharded, enabling more flexible wrapping policies and better composability with tensor parallelism.
2. **DTensor integration**: Sharded parameters are represented as DTensors with a `Shard` placement, enabling seamless interaction with other parallelism dimensions.
3. **Compile compatibility**: Better integration with `torch.compile` for graph-level optimization of distributed communication.

```python
from torch.distributed._composable.fsdp import fully_shard

# FSDP2: per-parameter sharding, composable API
for layer in model.layers:
    fully_shard(layer)
fully_shard(model)
```

---

## Key Takeaways

1. Training memory is dominated by optimizer states ($12P$ bytes for Adam), not parameters ($2P$) or gradients ($2P$). This asymmetry is what makes optimizer state partitioning (ZeRO-1) so effective.

2. ZeRO Stage 2 achieves strictly better memory efficiency than DDP with *identical* communication volume. It should be the default choice when optimizer states exceed single-GPU memory.

3. ZeRO Stage 3 / FSDP achieves $O(P/N)$ per-device memory at $1.5\times$ the communication cost of DDP. Communication-computation overlap makes this overhead negligible in practice for large models.

4. Activation checkpointing reduces activation memory from $O(L)$ to $O(\sqrt{L})$ at the cost of ~33% additional total training step time (one extra forward pass added to the base forward + backward). Selective checkpointing (e.g., only attention scores) offers a more favorable trade-off.

5. The choice between DDP, FSDP, and ZeRO depends on whether the model's training state fits in a single GPU. When it does not, FSDP/ZeRO-3 is necessary; when only optimizer states overflow, ZeRO-2 is optimal.

---

## Further Reading

1. **Rajbhandari, S., Rasley, J., Ruwase, O., & He, Y.** (2020). *ZeRO: Memory Optimizations Toward Training Trillion Parameter Models.* SC 2020.
   - The foundational ZeRO paper with the three-stage partitioning framework.

2. **Zhao, Y., Gu, A., Varma, R., Luo, L., Huang, C.-C., Xu, M., Wright, L., Shojanazeri, H., Ott, M., Shleifer, S., Desmaison, A., Bousquet, C., Kaesz, N., Bao, H., Tang, H., & Li, S.** (2023). *PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel.* VLDB 2023.
   - PyTorch FSDP implementation details, design decisions, and performance.

3. **Chen, T., Xu, B., Zhang, C., & Guestrin, C.** (2016). *Training Deep Nets with Sublinear Memory Cost.* arXiv:1604.06174.
   - The $\sqrt{L}$ activation checkpointing strategy.

4. **Ren, J., Rajbhandari, S., Aminabadi, R. Y., Ruwase, O., Yang, S., Zhang, M., Li, D., & He, Y.** (2021). *ZeRO-Offload: Democratizing Billion-Scale Model Training.* USENIX ATC 2021.
   - Offloading optimizer computation and states to CPU.

5. **Rajbhandari, S., Ruwase, O., Rasley, J., Smith, S., & He, Y.** (2021). *ZeRO-Infinity: Breaking the GPU Memory Wall for Extreme Scale Deep Learning.* SC 2021.
   - NVMe offloading for training models beyond GPU+CPU memory capacity.

6. **Korthikanti, V., Casper, J., Lym, S., McAfee, L., Andersch, M., Shoeybi, M., & Catanzaro, B.** (2023). *Reducing Activation Recomputation in Large Transformer Models.* MLSys 2023.
   - Selective activation recomputation and interaction with parallelism strategies.
