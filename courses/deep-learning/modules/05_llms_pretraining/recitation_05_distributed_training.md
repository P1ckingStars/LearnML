# Recitation 05: Distributed Training for Large Language Models

> **Module 05 — LLMs & Pretraining**
> Estimated study time: 3–4 hours

---

## Overview

This recitation covers the practical mechanics of distributed training. We will work through the four major parallelism strategies, implement FSDP in PyTorch, and solve memory calculation exercises. By the end, you should be able to determine the right parallelism strategy for a given model size and GPU budget.

---

## 1. Data Parallelism

### 1.1 Concept

Data parallelism replicates the full model on every GPU. Each GPU processes a different mini-batch shard. Gradients are synchronized across GPUs via AllReduce.

**Setup.** $P$ GPUs, model parameters $\theta \in \mathbb{R}^N$, global batch size $B$, local batch size $B_{\text{local}} = B / P$.

**Forward pass (each GPU $i$ independently):**

$$\ell_i = \frac{1}{B_{\text{local}}} \sum_{j=1}^{B_{\text{local}}} \ell(f_\theta(\mathbf{x}_{ij}), y_{ij})$$

**Backward pass (each GPU $i$):**

$$g_i = \nabla_\theta \ell_i \quad \in \mathbb{R}^N$$

**Gradient synchronization (AllReduce):**

$$\bar{g} = \frac{1}{P} \sum_{i=1}^{P} g_i$$

After AllReduce, every GPU has the same $\bar{g}$ and applies the same optimizer update, keeping parameters in sync.

### 1.2 Ring AllReduce

Ring AllReduce is the standard algorithm for gradient synchronization. With $P$ GPUs arranged in a ring:

**Phase 1: Reduce-Scatter** ($P-1$ steps)

- Split gradient $g_i$ into $P$ chunks of size $N/P$.
- In step $s$, GPU $i$ sends chunk $(i-s) \bmod P$ to GPU $(i+1) \bmod P$ and receives from GPU $(i-1) \bmod P$.
- After $P-1$ steps, GPU $i$ holds the sum of chunk $i$ from all GPUs.

**Phase 2: AllGather** ($P-1$ steps)

- In step $s$, GPU $i$ sends its summed chunk to the next GPU.
- After $P-1$ steps, every GPU has all summed chunks.

**Communication volume per GPU:**

$$\text{Send} = \text{Recv} = 2 \cdot \frac{N}{P} \cdot (P-1) \approx 2N \quad \text{for } P \gg 1$$

This is bandwidth-optimal: the total volume does not increase with $P$. Only the number of steps ($2(P-1)$) increases, adding latency.

**Latency:** $2(P-1) \cdot \alpha$ where $\alpha$ is per-message latency.

**Bandwidth:** $2N \cdot \frac{P-1}{P} / \beta$ where $\beta$ is bandwidth (bytes/sec).

### 1.3 PyTorch DDP

```python
import torch
import torch.nn as nn
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler

def setup_ddp(rank: int, world_size: int):
    """Initialize distributed process group.

    Args:
        rank: GPU/process rank (0 to world_size-1)
        world_size: total number of GPUs
    """
    dist.init_process_group(
        backend="nccl",          # NVIDIA Collective Communication Library
        init_method="env://",    # uses MASTER_ADDR and MASTER_PORT env vars
        rank=rank,
        world_size=world_size,
    )
    torch.cuda.set_device(rank)

def train_ddp(rank: int, world_size: int):
    """Train a model with DistributedDataParallel.

    Args:
        rank: GPU rank
        world_size: number of GPUs
    """
    setup_ddp(rank, world_size)

    # Create model and wrap with DDP
    model = nn.Linear(768, 768).cuda(rank)
    model = DDP(model, device_ids=[rank])   # DDP wrapper handles gradient sync

    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

    # DistributedSampler ensures each GPU gets different data
    dataset = torch.randn(10000, 768)  # dummy dataset
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank)
    loader = DataLoader(dataset, batch_size=32, sampler=sampler)

    for epoch in range(10):
        sampler.set_epoch(epoch)  # shuffle differently each epoch
        for batch in loader:
            batch = batch.cuda(rank)                        # (32, 768)
            output = model(batch)                           # (32, 768)
            loss = output.pow(2).mean()                     # scalar
            loss.backward()                                 # gradients synced by DDP
            optimizer.step()
            optimizer.zero_grad()

    dist.destroy_process_group()

# Launch: torchrun --nproc_per_node=4 script.py
```

---

## 2. Tensor Parallelism

### 2.1 Concept

Tensor parallelism splits individual weight matrices across GPUs. This is necessary when a single layer does not fit in GPU memory, or to reduce per-GPU computation.

### 2.2 Column-Parallel Linear Layer

Split $W \in \mathbb{R}^{d_{\text{in}} \times d_{\text{out}}}$ along columns:

$$W = [W_1 | W_2 | \cdots | W_P], \quad W_i \in \mathbb{R}^{d_{\text{in}} \times d_{\text{out}}/P}$$

Each GPU $i$ computes:

$$Y_i = X W_i \quad \in \mathbb{R}^{B \times d_{\text{out}}/P}$$

The input $X$ is replicated on all GPUs (or available from a previous AllGather).

**No communication needed at this point** — each GPU has a valid partial output.

### 2.3 Row-Parallel Linear Layer

Split $W \in \mathbb{R}^{d_{\text{in}} \times d_{\text{out}}}$ along rows:

$$W = \begin{bmatrix} W_1 \\ W_2 \\ \vdots \\ W_P \end{bmatrix}, \quad W_i \in \mathbb{R}^{d_{\text{in}}/P \times d_{\text{out}}}$$

Each GPU $i$ has input $X_i \in \mathbb{R}^{B \times d_{\text{in}}/P}$ (from a preceding column-parallel layer). It computes:

$$Y_i = X_i W_i \quad \in \mathbb{R}^{B \times d_{\text{out}}}$$

The full output requires an **AllReduce** (sum):

$$Y = \sum_{i=1}^{P} Y_i$$

### 2.4 Tensor Parallelism for Multi-Head Attention

The key insight: attention heads are naturally parallel. With $H$ heads and $P$ GPUs, assign $H/P$ heads per GPU.

```
GPU layout for MHA with TP=4, H=32:
  GPU 0: heads  1-8   (Q_0, K_0, V_0 ∈ ℝ^{B×T×(8·d_k)})
  GPU 1: heads  9-16  (Q_1, K_1, V_1)
  GPU 2: heads 17-24  (Q_2, K_2, V_2)
  GPU 3: heads 25-32  (Q_3, K_3, V_3)
```

**QKV Projection (Column-Parallel):**

- $W^Q, W^K, W^V \in \mathbb{R}^{d \times d}$ are split column-wise.
- Each GPU computes Q, K, V for its assigned heads.
- **No communication**: input $X$ is replicated (from previous layer's AllReduce).

**Attention Computation (Local):**

- Each GPU computes attention for its local heads.
- **No communication**: attention is independent per head.

**Output Projection (Row-Parallel):**

- $W^O \in \mathbb{R}^{d \times d}$ is split row-wise.
- Each GPU computes a partial output $O_i = \text{heads}_i \cdot W^O_i$.
- **AllReduce** to sum partial outputs: $O = \sum_i O_i$.

### 2.5 Tensor Parallelism for FFN

For FFN: $Y = \text{GELU}(X W_1) W_2$ where $W_1 \in \mathbb{R}^{d \times 4d}$, $W_2 \in \mathbb{R}^{4d \times d}$.

1. **$W_1$ Column-Parallel**: Split $W_1$ into $P$ column slices. Each GPU computes $\text{GELU}(X W_1^{(i)}) \in \mathbb{R}^{B \times 4d/P}$. **No communication** (GELU is element-wise, so it can be applied before the split is resolved).

2. **$W_2$ Row-Parallel**: Split $W_2$ into $P$ row slices. Each GPU computes $H_i W_2^{(i)} \in \mathbb{R}^{B \times d}$. **AllReduce** to sum.

**Communication per Transformer block with TP:** 2 AllReduces (one for attention output, one for FFN output). Each AllReduce transfers $\sim 2 \cdot B \cdot T \cdot d$ bytes.

### 2.6 Implementation (Conceptual)

```python
import torch
import torch.nn as nn
import torch.distributed as dist

class ColumnParallelLinear(nn.Module):
    """Linear layer with column-parallel weight split.

    Weight W ∈ ℝ^{d_in × d_out} is split into P column chunks.
    GPU i stores W_i ∈ ℝ^{d_in × d_out/P}.
    """

    def __init__(self, d_in: int, d_out: int, tp_size: int, tp_rank: int, bias: bool = False):
        super().__init__()
        assert d_out % tp_size == 0
        self.d_out_local = d_out // tp_size
        self.weight = nn.Parameter(torch.randn(d_in, self.d_out_local) * 0.02)
        # (d_in, d_out/P) — this GPU's column slice
        self.bias = nn.Parameter(torch.zeros(self.d_out_local)) if bias else None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, d_in) — replicated on all GPUs
        y = x @ self.weight  # (B, T, d_out/P) — local output
        if self.bias is not None:
            y = y + self.bias
        return y  # no communication needed

class RowParallelLinear(nn.Module):
    """Linear layer with row-parallel weight split.

    Weight W ∈ ℝ^{d_in × d_out} is split into P row chunks.
    GPU i stores W_i ∈ ℝ^{d_in/P × d_out}.
    Input is split: GPU i has x_i ∈ ℝ^{B × T × d_in/P}.
    """

    def __init__(self, d_in: int, d_out: int, tp_size: int, tp_rank: int, bias: bool = False):
        super().__init__()
        assert d_in % tp_size == 0
        self.d_in_local = d_in // tp_size
        self.weight = nn.Parameter(torch.randn(self.d_in_local, d_out) * 0.02)
        # (d_in/P, d_out)
        self.bias = nn.Parameter(torch.zeros(d_out)) if bias else None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, T, d_in/P) — local input from column-parallel layer
        y = x @ self.weight  # (B, T, d_out) — partial output
        # AllReduce to sum across TP group
        dist.all_reduce(y, op=dist.ReduceOp.SUM)  # (B, T, d_out) — full output
        if self.bias is not None:
            y = y + self.bias
        return y
```

---

## 3. Pipeline Parallelism

### 3.1 Concept

Pipeline parallelism assigns different layers to different GPUs. With $L$ layers and $P$ GPUs:

$$\text{GPU}_k \text{ runs layers } \left[\frac{kL}{P} + 1, \frac{(k+1)L}{P}\right]$$

### 3.2 The Pipeline Bubble

With naive pipeline execution (process one batch fully through the pipeline before starting the next), GPU utilization is poor.

**Bubble fraction (naive):**

$$\text{bubble} = \frac{P - 1}{P} = 1 - \frac{1}{P}$$

With $P = 8$ GPUs, only 12.5% utilization.

### 3.3 GPipe: Microbatch Pipelining

Split each mini-batch into $M$ microbatches. Process all microbatches through the forward pass, then all through the backward pass.

```
GPipe schedule with P=4 GPUs, M=8 microbatches:

         Time →
GPU 0: F1 F2 F3 F4 F5 F6 F7 F8 __ __ __ B8 B7 B6 B5 B4 B3 B2 B1
GPU 1: __ F1 F2 F3 F4 F5 F6 F7 F8 __ B8 B7 B6 B5 B4 B3 B2 B1 __
GPU 2: __ __ F1 F2 F3 F4 F5 F6 F7 F8 B8 B7 B6 B5 B4 B3 B2 B1 __ __
GPU 3: __ __ __ F1 F2 F3 F4 F5 F6 F7 F8 B8 B7 B6 B5 B4 B3 B2 B1 __

F = forward, B = backward, __ = idle (bubble)
```

**Bubble fraction (GPipe):**

$$\text{bubble} = \frac{P - 1}{M + P - 1}$$

With $M = 8$, $P = 4$: $\text{bubble} = 3/11 \approx 27\%$.

With $M = 32$, $P = 4$: $\text{bubble} = 3/35 \approx 8.6\%$.

**Memory issue:** GPipe must store activations for all $M$ microbatches during the forward pass (needed for backward). Memory $\propto M \cdot \text{activations\_per\_microbatch}$.

### 3.4 1F1B (One Forward, One Backward)

PipeDream's 1F1B schedule alternates forward and backward passes, limiting the number of in-flight microbatches.

```
1F1B schedule with P=4 GPUs:

         Time →
GPU 0: F1 F2 F3 F4 B1 F5 B2 F6 B3 F7 B4 F8 B5 B6 B7 B8
GPU 1: __ F1 F2 F3 F4 B1 F5 B2 F6 B3 F7 B4 F8 B5 B6 B7 B8
GPU 2: __ __ F1 F2 F3 F4 B1 F5 B2 F6 B3 F7 B4 F8 B5 B6 B7 B8
GPU 3: __ __ __ F1 F2 F3 B1 F4 B2 F5 B3 F6 B4 F7 B5 F8 B6 B7 B8
```

**Advantage:** Each GPU stores at most $P$ microbatch activations (not $M$), dramatically reducing memory.

**Bubble fraction:** Same as GPipe: $(P-1)/(M+P-1)$. But memory is $O(P)$ instead of $O(M)$.

---

## 4. ZeRO: Zero Redundancy Optimizer

### 4.1 The Redundancy Problem

In standard data parallelism, every GPU stores:

- Parameters $\theta$: $2N$ bytes (fp16)
- Gradients $g$: $2N$ bytes (fp16)
- Optimizer states (Adam): $12N$ bytes (fp32 copy of params: $4N$, momentum: $4N$, variance: $4N$)

**Total per GPU: $16N$ bytes** — identical on every GPU. This is $P$-fold redundancy.

### 4.2 ZeRO Stage 1: Shard Optimizer States

Each GPU stores only $1/P$ of the optimizer states.

- Parameters: $2N$ (full, replicated)
- Gradients: $2N$ (full, replicated)
- Optimizer: $12N/P$ (sharded)

**Memory per GPU:** $4N + 12N/P$

After the optimizer step, each GPU has updated only its shard of parameters. An AllGather reconstructs the full parameters.

**Communication:** AllGather of size $N$ per step (same as AllReduce in DDP).

### 4.3 ZeRO Stage 2: + Shard Gradients

Each GPU stores only $1/P$ of the gradients. Reduce-Scatter replaces AllReduce: each GPU receives only the gradient shard it needs.

- Parameters: $2N$ (full)
- Gradients: $2N/P$ (sharded)
- Optimizer: $12N/P$ (sharded)

**Memory per GPU:** $2N + 14N/P$

**Communication:** Reduce-Scatter for gradients ($N$) + AllGather for parameters ($N$). Same volume as AllReduce.

### 4.4 ZeRO Stage 3: + Shard Parameters

All three components are sharded. Parameters are gathered on-demand for each forward/backward layer.

- Parameters: $2N/P$
- Gradients: $2N/P$
- Optimizer: $12N/P$

**Memory per GPU:** $16N/P$

**Communication:** AllGather before each layer (forward + backward = 2 AllGathers), Reduce-Scatter for gradients. Total: $\sim 3N$ per step (1.5x DDP).

### 4.5 Summary Table

| | DDP | ZeRO-1 | ZeRO-2 | ZeRO-3 |
|-|-----|--------|--------|--------|
| Params per GPU | $2N$ | $2N$ | $2N$ | $2N/P$ |
| Grads per GPU | $2N$ | $2N$ | $2N/P$ | $2N/P$ |
| Optim per GPU | $12N$ | $12N/P$ | $12N/P$ | $12N/P$ |
| **Total per GPU** | $16N$ | $4N + 12N/P$ | $2N + 14N/P$ | $16N/P$ |
| Comm volume | $2N$ | $2N$ | $2N$ | $3N$ |

### 4.6 FSDP (Fully Sharded Data Parallel) in PyTorch

PyTorch FSDP implements ZeRO-3. Here is a complete example:

```python
import os
import torch
import torch.nn as nn
import torch.distributed as dist
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import MixedPrecision, ShardingStrategy
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
from functools import partial

# ─── Model Definition ────────────────────────────────────────────────────

class TransformerBlock(nn.Module):
    """A single Transformer block for FSDP wrapping demo."""

    def __init__(self, d_model: int = 768, n_heads: int = 12, d_ff: int = 3072):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_model)                            # (d,)
        self.attn = nn.MultiheadAttention(d_model, n_heads, batch_first=True)
        self.ln2 = nn.LayerNorm(d_model)                            # (d,)
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff),                               # (d, 4d)
            nn.GELU(),
            nn.Linear(d_ff, d_model),                               # (4d, d)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:             # (B, T, d)
        h = self.ln1(x)                                              # (B, T, d)
        attn_out, _ = self.attn(h, h, h, need_weights=False)        # (B, T, d)
        x = x + attn_out                                             # (B, T, d)
        x = x + self.ffn(self.ln2(x))                               # (B, T, d)
        return x

class SimpleGPT(nn.Module):
    """A simplified GPT for FSDP demonstration."""

    def __init__(
        self,
        vocab_size: int = 50257,
        d_model: int = 768,
        n_layers: int = 12,
        n_heads: int = 12,
        d_ff: int = 3072,
        max_seq_len: int = 1024,
    ):
        super().__init__()
        self.tok_emb = nn.Embedding(vocab_size, d_model)             # (V, d)
        self.pos_emb = nn.Embedding(max_seq_len, d_model)            # (T, d)
        self.blocks = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff)
            for _ in range(n_layers)
        ])
        self.ln_f = nn.LayerNorm(d_model)                            # (d,)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)    # (d, V)

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        B, T = input_ids.shape
        pos = torch.arange(T, device=input_ids.device)               # (T,)
        x = self.tok_emb(input_ids) + self.pos_emb(pos)              # (B, T, d)

        for block in self.blocks:
            x = block(x)                                              # (B, T, d)

        x = self.ln_f(x)                                              # (B, T, d)
        logits = self.lm_head(x)                                      # (B, T, V)
        return logits

# ─── FSDP Training ───────────────────────────────────────────────────────

def train_fsdp(rank: int, world_size: int):
    """Train with FSDP (ZeRO-3).

    Args:
        rank: GPU rank (0 to world_size-1)
        world_size: total number of GPUs
    """
    # 1. Setup distributed
    os.environ["MASTER_ADDR"] = "localhost"
    os.environ["MASTER_PORT"] = "29500"
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

    # 2. Create model
    model = SimpleGPT(
        vocab_size=50257, d_model=768, n_layers=12,
        n_heads=12, d_ff=3072, max_seq_len=1024,
    ).cuda(rank)

    if rank == 0:
        n_params = sum(p.numel() for p in model.parameters())
        print(f"Model parameters: {n_params:,} ({n_params/1e6:.1f}M)")

    # 3. Define FSDP wrapping policy
    # Wrap each TransformerBlock as a separate FSDP unit
    auto_wrap_policy = partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={TransformerBlock},
    )

    # 4. Mixed precision config
    mixed_precision = MixedPrecision(
        param_dtype=torch.bfloat16,      # parameters in bf16
        reduce_dtype=torch.bfloat16,     # gradient reductions in bf16
        buffer_dtype=torch.bfloat16,     # buffers in bf16
    )

    # 5. Wrap model with FSDP
    model = FSDP(
        model,
        auto_wrap_policy=auto_wrap_policy,
        mixed_precision=mixed_precision,
        sharding_strategy=ShardingStrategy.FULL_SHARD,  # ZeRO-3
        device_id=rank,
    )

    # 6. Optimizer (applied to FSDP-wrapped model)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=3e-4,
        betas=(0.9, 0.95),
        weight_decay=0.1,
    )

    # 7. Training loop
    model.train()
    for step in range(100):
        # Dummy data — replace with real data loader
        input_ids = torch.randint(0, 50257, (4, 512), device=f"cuda:{rank}")  # (B, T)
        targets = torch.randint(0, 50257, (4, 512), device=f"cuda:{rank}")    # (B, T)

        # Forward
        logits = model(input_ids)                    # (B, T, V) — FSDP handles AllGather
        loss = nn.functional.cross_entropy(
            logits.view(-1, logits.size(-1)),         # (B*T, V)
            targets.view(-1),                         # (B*T,)
        )

        # Backward
        loss.backward()                              # FSDP handles Reduce-Scatter

        # Gradient clipping
        model.clip_grad_norm_(1.0)

        # Optimizer step
        optimizer.step()
        optimizer.zero_grad()

        if rank == 0 and step % 10 == 0:
            print(f"Step {step}: loss = {loss.item():.4f}")

    dist.destroy_process_group()

# ─── Launch ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    world_size = torch.cuda.device_count()
    if world_size > 1:
        torch.multiprocessing.spawn(train_fsdp, args=(world_size,), nprocs=world_size)
    else:
        print("FSDP requires multiple GPUs. Running single-GPU demo instead.")
        model = SimpleGPT()
        n_params = sum(p.numel() for p in model.parameters())
        print(f"Model parameters: {n_params:,} ({n_params/1e6:.1f}M)")

        x = torch.randint(0, 50257, (2, 128))
        logits = model(x)
        print(f"Output shape: {logits.shape}")  # (2, 128, 50257)
```

---

## 5. Memory Calculation Exercises

### Exercise R5.1: Memory Budget for LLaMA-7B

**Given:** LLaMA-7B has $N = 6.74 \times 10^9$ parameters. Training uses AdamW in bf16/fp32 mixed precision.

**(a)** Compute the memory for model states (parameters, gradients, optimizer) under:

- Standard DDP (no ZeRO)
- ZeRO-1 on 8 GPUs
- ZeRO-2 on 8 GPUs
- ZeRO-3 on 8 GPUs

| Component | Bytes per param | DDP | ZeRO-1 (8 GPU) | ZeRO-2 (8 GPU) | ZeRO-3 (8 GPU) |
|-----------|----------------|-----|----------------|----------------|----------------|
| bf16 params | 2 | $2N$ | $2N$ | $2N$ | $2N/8$ |
| bf16 gradients | 2 | $2N$ | $2N$ | $2N/8$ | $2N/8$ |
| fp32 params (optimizer) | 4 | $4N$ | $4N/8$ | $4N/8$ | $4N/8$ |
| fp32 momentum | 4 | $4N$ | $4N/8$ | $4N/8$ | $4N/8$ |
| fp32 variance | 4 | $4N$ | $4N/8$ | $4N/8$ | $4N/8$ |
| **Total** | | $16N$ | $4N + 12N/8$ | $2N + 14N/8$ | $16N/8$ |

**Numerical values** ($N = 6.74 \times 10^9$):

| Strategy | Per-GPU memory (GB) |
|----------|-------------------|
| DDP | $16 \times 6.74 \times 10^9 / 10^9 = 107.8$ GB |
| ZeRO-1 | $(4 + 12/8) \times 6.74 = 37.1$ GB |
| ZeRO-2 | $(2 + 14/8) \times 6.74 = 25.3$ GB |
| ZeRO-3 | $16/8 \times 6.74 = 13.5$ GB |

**Conclusion:** DDP does not fit on A100-80GB. ZeRO-1 fits. ZeRO-3 leaves ample room for activations.

**(b)** Estimate activation memory for a single layer with sequence length $T = 4096$ and batch size $B = 1$:

Per Transformer layer, the major activations are:

- Attention input: $B \times T \times d = 1 \times 4096 \times 4096 = 16.8M$ (bf16: 33.6 MB)
- QKV: $3 \times B \times H \times T \times d_k = 3 \times 1 \times 32 \times 4096 \times 128 = 50.3M$ (bf16: 100.7 MB)
- Attention weights: $B \times H \times T \times T = 1 \times 32 \times 4096 \times 4096 = 536.9M$ (bf16: 1073.7 MB $\approx$ 1.07 GB)
- FFN intermediate: $B \times T \times d_{\text{ff}} = 1 \times 4096 \times 11008 = 45.1M$ (bf16: 90.2 MB)

Per-layer activation memory: $\approx$ 1.3 GB (dominated by attention weights).

With 32 layers: $\approx 41.6$ GB for activations.

With **gradient checkpointing** (recompute activations during backward): store only layer inputs, reducing activation memory to $32 \times 33.6$ MB $\approx 1.1$ GB.

### Exercise R5.2: Choosing a Parallelism Strategy

**Given:** You want to train a 30B parameter model. You have 64 A100-80GB GPUs connected in 8 nodes of 8 GPUs each. Intra-node bandwidth: 600 GB/s (NVLink). Inter-node bandwidth: 50 GB/s (InfiniBand).

**(a)** Can you use pure data parallelism (DDP)? Why or why not?

Memory needed (DDP): $16 \times 30 \times 10^9 = 480$ GB per GPU. This far exceeds 80 GB. **No.**

**(b)** Can you use ZeRO-3 with all 64 GPUs?

Memory: $16 \times 30 \times 10^9 / 64 = 7.5$ GB per GPU. **Yes, this fits.** But communication is high: AllGather of the full model ($60$ GB in bf16) for each forward and backward layer. With 64 GPUs and inter-node bandwidth of 50 GB/s, this takes $\sim 60/50 \approx 1.2$ seconds per AllGather. With many layers, this becomes the bottleneck.

**(c)** Recommended strategy: **3D Parallelism**

- **Tensor Parallelism (TP=8)** within each node (uses fast NVLink).
  - Each GPU stores $1/8$ of each layer. AllReduce per layer: $2Bd \times 2 / 8 \approx$ small, over 600 GB/s NVLink.

- **Pipeline Parallelism (PP=2)** across 2 groups of 4 nodes.
  - Split the 60 layers into 2 stages of 30 layers each.
  - Only activation tensors are communicated between stages: $B \times T \times d$ per microbatch.

- **Data Parallelism (DP=4)** across the remaining dimension.
  - $64 / (8 \times 2) = 4$ data-parallel replicas.
  - AllReduce gradients across 4 replicas, over InfiniBand.

Total: $\text{TP} \times \text{PP} \times \text{DP} = 8 \times 2 \times 4 = 64$ GPUs.

### Exercise R5.3: Communication Volume Analysis

**(a)** For Ring AllReduce with $P$ GPUs and gradient size $N$, prove that each GPU sends exactly $2N(P-1)/P$ bytes total (summing send volume in Reduce-Scatter and AllGather phases).

**Phase 1 (Reduce-Scatter):** In each of $P-1$ steps, each GPU sends $N/P$ bytes. Total send: $(P-1) \cdot N/P$.

**Phase 2 (AllGather):** In each of $P-1$ steps, each GPU sends $N/P$ bytes. Total send: $(P-1) \cdot N/P$.

**Total send per GPU:** $2(P-1) \cdot N/P = 2N(P-1)/P$.

For $P \gg 1$: $\approx 2N$. The communication volume per GPU is approximately constant in $P$.

**(b)** Compare communication times for DDP vs. ZeRO-3 on $P = 8$ GPUs with $N = 7 \times 10^9$ (7B) parameters in bf16 (2 bytes/param), bandwidth $\beta = 600$ GB/s (NVLink).

**DDP:** AllReduce of size $2N = 14$ GB.

- Time: $2N(P-1)/P / \beta = 14 \times 7/8 / 600 = 0.020$ seconds.

**ZeRO-3:** AllGather ($N$ bytes) for forward + AllGather ($N$) for backward + Reduce-Scatter ($N$) for gradients = $3N = 21$ GB total.

- Time: $3N(P-1)/P / \beta = 21 \times 7/8 / 600 = 0.031$ seconds.

**Overhead:** ZeRO-3 is $\sim$1.5x more communication than DDP, but uses $1/P$ of the memory.

### Exercise R5.4: Gradient Accumulation Math

**(a)** With gradient accumulation over $A = 8$ microbatches, each of batch size $B_{\mu} = 4$, and a sequence length of $T = 1024$:

- Effective batch size: $B_{\text{eff}} = A \times B_{\mu} = 32$
- Tokens per step: $B_{\text{eff}} \times T = 32 \times 1024 = 32{,}768$
- Gradients are accumulated in fp32 (to avoid precision loss from summing many small bf16 values).

**(b)** Memory impact: gradient accumulation does NOT reduce peak memory for activations (each microbatch's activations are still needed for its backward pass). However, it does reduce peak memory for gradients: only one microbatch's activations need to be in memory at a time.

With gradient checkpointing + gradient accumulation:

- Activation memory: $O(L \cdot B_\mu \cdot T \cdot d)$ (one microbatch at a time)
- Gradient memory: $O(N)$ (accumulated across microbatches)

### Exercise R5.5: Scaling Efficiency

**(a)** You measure 150 TFLOPS per GPU on 8 GPUs and 130 TFLOPS per GPU on 64 GPUs. Compute:

- **Weak scaling efficiency:** $\eta_{\text{weak}} = \text{TFLOPS}(64) / \text{TFLOPS}(8) = 130/150 = 86.7\%$

- **Communication overhead:** $20/150 = 13.3\%$ of time spent on communication at 64 GPUs.

**(b)** If each H100 GPU achieves 990 TFLOPS peak (bf16), and your training achieves 400 TFLOPS per GPU (Model FLOPs Utilization, MFU), what is the MFU?

$$\text{MFU} = 400 / 990 = 40.4\%$$

This is typical for large-scale LLM training. The gap is due to:

- Communication overhead (~15%)
- Memory bandwidth bottleneck (~20%)
- Pipeline bubbles (~5%)
- Kernel launch overhead (~5%)
- Other (~15%)

---

## 6. Key Takeaways

1. **Data parallelism** is the simplest strategy and should be the first choice if the model fits in GPU memory.

2. **ZeRO-3 / FSDP** is the standard for models that do not fit in a single GPU's memory. It has 1.5x the communication of DDP but uses $1/P$ of the memory.

3. **Tensor parallelism** should only be used within a node (high-bandwidth NVLink). It requires 2 AllReduces per layer, which is expensive over slow interconnects.

4. **Pipeline parallelism** is used for very large models across nodes. The bubble overhead decreases with more microbatches but increases with more pipeline stages.

5. **3D parallelism** (TP within node, PP across nodes, DP across replicas) is the standard for training models >100B parameters.

6. **Gradient checkpointing** trades $2\times$ compute for $O(\sqrt{L})$ activation memory. Almost always worth it for large models.

7. **The memory formula** to memorize: $16N/P$ bytes for model states with ZeRO-3, plus activation memory which depends on batch size, sequence length, and checkpointing.

---

## 7. Additional Exercises

**Exercise R5.6.** You are training a 70B parameter model on 512 H100 GPUs (64 nodes, 8 GPUs/node). Design a parallelism strategy. Specify TP, PP, DP values, compute per-GPU memory, and estimate the pipeline bubble fraction with 32 microbatches.

**Exercise R5.7.** Implement a simplified Ring AllReduce in PyTorch using `dist.send` and `dist.recv`. Verify that the result matches `dist.all_reduce` for random tensors on 4 GPUs.

**Exercise R5.8.** FSDP with `ShardingStrategy.HYBRID_SHARD` uses ZeRO-3 within a node and DDP across nodes. Derive the per-GPU memory and communication volume for this strategy with $P_{\text{intra}} = 8$ and $P_{\text{inter}} = 8$ (64 GPUs total).

**Exercise R5.9.** The "critical batch size" $B_{\text{crit}}$ is the batch size at which doubling $B$ no longer halves training time (communication overhead dominates). Given that compute per step scales as $O(B)$ and communication is $O(N)$ (independent of $B$), derive $B_{\text{crit}}$ as a function of model FLOPs $F$, communication volume $V$, compute throughput $C$ (FLOPS), and bandwidth $\beta$ (bytes/sec).

$$B_{\text{crit}} = \frac{V \cdot C}{\beta \cdot F_{\text{per\_sample}}}$$

Compute $B_{\text{crit}}$ for a 7B model with $V = 28$ GB, $C = 400$ TFLOPS, $\beta = 600$ GB/s, $F_{\text{per\_sample}} = 6 \times 7 \times 10^9 \times 1024 \approx 4.3 \times 10^{13}$ FLOPs (one 1024-token sequence).
