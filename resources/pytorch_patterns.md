# Idiomatic PyTorch Patterns for Research

Production-tested patterns for deep learning research in PyTorch. This guide assumes familiarity with Python and basic PyTorch operations.

---

## Table of Contents

1. [Custom Datasets and DataLoaders](#custom-datasets-and-dataloaders)
2. [nn.Module Best Practices](#nnmodule-best-practices)
3. [Custom Autograd Functions](#custom-autograd-functions)
4. [Mixed Precision Training](#mixed-precision-training)
5. [Gradient Accumulation](#gradient-accumulation)
6. [Distributed Training](#distributed-training)
7. [Debugging Tips](#debugging-tips)
8. [Memory Optimization](#memory-optimization)
9. [Common Pitfalls](#common-pitfalls)
10. [Reproducibility](#reproducibility)
11. [Experiment Management](#experiment-management)

---

## Custom Datasets and DataLoaders

### Map-Style Dataset

```python
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path
from typing import Tuple, Optional, Callable

class TextClassificationDataset(Dataset):
    """Example map-style dataset for text classification.

    Key principles:
    - __getitem__ should return a single example (tensor or dict of tensors)
    - Keep heavy I/O in __getitem__, not __init__ (for large datasets)
    - __init__ should only load metadata / file paths
    - Return raw data; let collate_fn handle batching logic
    """

    def __init__(
        self,
        data_path: Path,
        tokenizer: Callable,
        max_length: int = 512,
        split: str = "train",
    ):
        self.tokenizer = tokenizer
        self.max_length = max_length

        # Only load metadata in __init__
        self.samples = self._load_manifest(data_path / f"{split}.jsonl")

    def _load_manifest(self, path: Path) -> list:
        """Load file paths or lightweight metadata, not full data."""
        import json
        with open(path) as f:
            return [json.loads(line) for line in f]

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> dict:
        sample = self.samples[idx]
        tokens = self.tokenizer(
            sample["text"],
            max_length=self.max_length,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        )
        # Squeeze out the batch dimension that the tokenizer adds
        return {
            "input_ids": tokens["input_ids"].squeeze(0),
            "attention_mask": tokens["attention_mask"].squeeze(0),
            "label": torch.tensor(sample["label"], dtype=torch.long),
        }
```

### Iterable-Style Dataset (for streaming large data)

```python
from torch.utils.data import IterableDataset, get_worker_info

class StreamingDataset(IterableDataset):
    """For datasets too large to fit in memory or index.

    Key principles:
    - Must handle worker splitting manually
    - Cannot use random access; shuffle upstream or use a buffer
    - len() is not supported (or only approximate)
    """

    def __init__(self, file_paths: list, transform: Optional[Callable] = None):
        self.file_paths = file_paths
        self.transform = transform

    def __iter__(self):
        worker_info = get_worker_info()
        if worker_info is None:
            # Single-process loading
            file_iter = iter(self.file_paths)
        else:
            # Split files across workers to avoid duplicates
            per_worker = len(self.file_paths) // worker_info.num_workers
            start = worker_info.id * per_worker
            end = start + per_worker
            if worker_info.id == worker_info.num_workers - 1:
                end = len(self.file_paths)  # last worker takes remainder
            file_iter = iter(self.file_paths[start:end])

        for path in file_iter:
            yield from self._read_file(path)

    def _read_file(self, path):
        # Generator that yields individual samples
        import json
        with open(path) as f:
            for line in f:
                sample = json.loads(line)
                if self.transform:
                    sample = self.transform(sample)
                yield sample
```

### Custom Collate Functions

```python
def variable_length_collate(batch: list) -> dict:
    """Collate function for variable-length sequences.

    Pads to the max length in the batch (not the global max),
    which is more efficient than fixed-length padding.
    """
    max_len = max(len(item["input_ids"]) for item in batch)

    input_ids = torch.zeros(len(batch), max_len, dtype=torch.long)
    attention_mask = torch.zeros(len(batch), max_len, dtype=torch.long)
    labels = torch.tensor([item["label"] for item in batch])

    for i, item in enumerate(batch):
        length = len(item["input_ids"])
        input_ids[i, :length] = item["input_ids"]
        attention_mask[i, :length] = 1

    return {
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "labels": labels,
    }

# Usage
loader = DataLoader(
    dataset,
    batch_size=32,
    shuffle=True,          # Only for map-style datasets
    num_workers=4,         # Parallel data loading
    pin_memory=True,       # Faster CPU->GPU transfer
    drop_last=True,        # Avoid small last batch (important for BatchNorm)
    collate_fn=variable_length_collate,
    persistent_workers=True,  # Avoid re-spawning workers each epoch
    prefetch_factor=2,     # Number of batches to prefetch per worker
)
```

### DataLoader Performance Tips

- **num_workers:** Start with 4, increase until CPU becomes bottleneck. On machines with many cores, 8-16 is common. Set to 0 for debugging.
- **pin_memory=True:** Always use when training on GPU. Enables async CPU-to-GPU transfer.
- **persistent_workers=True:** Avoids worker process restart between epochs. Significant speedup for small datasets.
- **prefetch_factor:** Default is 2. Increase if GPU is idle waiting for data.

---

## nn.Module Best Practices

### Clean Module Structure

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Optional

class TransformerBlock(nn.Module):
    """A single transformer block with pre-norm architecture.

    Best practices demonstrated:
    - Type-annotated __init__ parameters
    - All hyperparameters as __init__ args (no magic numbers in forward)
    - Register non-parameter state with register_buffer
    - Use nn.ModuleList/ModuleDict for dynamic submodules
    - Keep forward() clean; factor complex logic into helper methods
    """

    def __init__(
        self,
        d_model: int,
        n_heads: int,
        d_ff: int,
        dropout: float = 0.1,
        max_seq_len: int = 2048,
        bias: bool = False,
    ):
        super().__init__()
        assert d_model % n_heads == 0, "d_model must be divisible by n_heads"

        self.n_heads = n_heads
        self.d_head = d_model // n_heads

        # Attention projections
        self.qkv = nn.Linear(d_model, 3 * d_model, bias=bias)
        self.out_proj = nn.Linear(d_model, d_model, bias=bias)

        # FFN
        self.ffn = nn.Sequential(
            nn.Linear(d_model, d_ff, bias=bias),
            nn.GELU(),
            nn.Linear(d_ff, d_model, bias=bias),
        )

        # Norms (pre-norm architecture)
        self.norm1 = nn.RMSNorm(d_model)
        self.norm2 = nn.RMSNorm(d_model)

        self.dropout = nn.Dropout(dropout)

        # Causal mask: register as buffer (not a parameter, but moves with .to(device))
        causal_mask = torch.triu(
            torch.ones(max_seq_len, max_seq_len, dtype=torch.bool), diagonal=1
        )
        self.register_buffer("causal_mask", causal_mask, persistent=False)

    def forward(
        self,
        x: torch.Tensor,
        attn_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Args:
            x: (batch, seq_len, d_model)
            attn_mask: optional additional mask
        Returns:
            (batch, seq_len, d_model)
        """
        # Pre-norm attention with residual
        x = x + self._attention(self.norm1(x), attn_mask)
        # Pre-norm FFN with residual
        x = x + self.dropout(self.ffn(self.norm2(x)))
        return x

    def _attention(
        self, x: torch.Tensor, attn_mask: Optional[torch.Tensor]
    ) -> torch.Tensor:
        B, T, C = x.shape

        qkv = self.qkv(x).reshape(B, T, 3, self.n_heads, self.d_head)
        q, k, v = qkv.unbind(dim=2)  # Each: (B, T, n_heads, d_head)
        q, k, v = [t.transpose(1, 2) for t in (q, k, v)]  # (B, n_heads, T, d_head)

        # Use PyTorch's scaled_dot_product_attention (uses FlashAttention when available)
        mask = self.causal_mask[:T, :T]
        if attn_mask is not None:
            mask = mask | attn_mask

        out = F.scaled_dot_product_attention(
            q, k, v,
            attn_mask=~mask.unsqueeze(0).unsqueeze(0) if mask is not None else None,
            dropout_p=self.dropout.p if self.training else 0.0,
        )

        out = out.transpose(1, 2).reshape(B, T, C)
        return self.dropout(self.out_proj(out))
```

### Module Initialization

```python
def _init_weights(module: nn.Module, std: float = 0.02):
    """Weight initialization following GPT-2 / common transformer practice.

    Apply with: model.apply(lambda m: _init_weights(m, std=0.02))
    """
    if isinstance(module, nn.Linear):
        nn.init.normal_(module.weight, mean=0.0, std=std)
        if module.bias is not None:
            nn.init.zeros_(module.bias)
    elif isinstance(module, nn.Embedding):
        nn.init.normal_(module.weight, mean=0.0, std=std)


class MyModel(nn.Module):
    def __init__(self, config):
        super().__init__()
        # ... build layers ...

        # Apply initialization after building
        self.apply(lambda m: _init_weights(m, std=config.init_std))

        # Special initialization for residual projections (scale by 1/sqrt(n_layers))
        for name, p in self.named_parameters():
            if name.endswith("out_proj.weight"):
                nn.init.normal_(p, mean=0.0, std=config.init_std / (2 * config.n_layers) ** 0.5)
```

### Using register_buffer vs. nn.Parameter

```python
class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 5000):
        super().__init__()
        pe = self._compute_pe(d_model, max_len)

        # register_buffer: moves with .to(device), saved in state_dict,
        # but NOT included in parameters() or optimized
        self.register_buffer("pe", pe)

        # persistent=False: moves with .to(device), NOT saved in state_dict
        # Use for derived/computed values that can be recomputed
        self.register_buffer("_scale", torch.tensor(d_model ** 0.5), persistent=False)

    # nn.Parameter: moves with .to(device), saved in state_dict,
    # AND included in parameters() for optimization
    # Use: self.learnable_pe = nn.Parameter(torch.randn(max_len, d_model))
```

### Freezing and Unfreezing Parameters

```python
# Freeze entire model
for param in model.parameters():
    param.requires_grad = False

# Unfreeze specific layers
for param in model.classifier.parameters():
    param.requires_grad = True

# More surgical: freeze by name
for name, param in model.named_parameters():
    if "encoder.layer.11" in name or "classifier" in name:
        param.requires_grad = True
    else:
        param.requires_grad = False

# Verify what will be optimized
trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
total = sum(p.numel() for p in model.parameters())
print(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.1f}%)")

# IMPORTANT: only pass trainable params to optimizer
optimizer = torch.optim.AdamW(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=1e-4,
)
```

---

## Custom Autograd Functions

### When to Write Custom Autograd Functions

- Implementing a non-standard mathematical operation not in PyTorch
- Numerical stability (e.g., custom log-sum-exp with different truncation)
- Memory optimization (e.g., checkpointing within a function)
- Straight-through estimators for non-differentiable operations

### Basic Pattern

```python
class StableSoftmaxCrossEntropy(torch.autograd.Function):
    """Numerically stable softmax cross-entropy.

    Rules for autograd.Function:
    1. forward() and backward() are @staticmethod
    2. Save tensors needed for backward with ctx.save_for_backward()
    3. Only save tensors, not arbitrary Python objects (use ctx.xxx for those)
    4. backward() must return one gradient per forward() input (or None)
    """

    @staticmethod
    def forward(ctx, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        # Compute stable softmax
        log_probs = logits - logits.logsumexp(dim=-1, keepdim=True)
        probs = log_probs.exp()

        # Save for backward (only tensors via save_for_backward)
        ctx.save_for_backward(probs, targets)

        # Compute loss
        loss = -log_probs.gather(-1, targets.unsqueeze(-1)).squeeze(-1)
        return loss.mean()

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        probs, targets = ctx.saved_tensors

        grad_logits = probs.clone()
        grad_logits.scatter_(-1, targets.unsqueeze(-1), -1.0, reduce="add")
        grad_logits = grad_logits * grad_output / targets.shape[0]

        # Return one gradient per forward input: (logits, targets)
        # targets is discrete, so no gradient
        return grad_logits, None


# Usage
loss = StableSoftmaxCrossEntropy.apply(logits, targets)
```

### Straight-Through Estimator

```python
class StraightThroughEstimator(torch.autograd.Function):
    """Binarize in forward, pass gradients through in backward.

    Used in: BinaryConnect, quantization-aware training.
    """

    @staticmethod
    def forward(ctx, x: torch.Tensor) -> torch.Tensor:
        return (x > 0).float()

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor) -> torch.Tensor:
        # Pass gradient through unchanged
        return grad_output


def binarize(x: torch.Tensor) -> torch.Tensor:
    return StraightThroughEstimator.apply(x)
```

### Gradient Checking

```python
# Always verify custom autograd functions with gradcheck
from torch.autograd import gradcheck

logits = torch.randn(4, 10, dtype=torch.float64, requires_grad=True)
targets = torch.randint(0, 10, (4,))

# gradcheck requires float64 for numerical precision
assert gradcheck(
    StableSoftmaxCrossEntropy.apply,
    (logits, targets),
    eps=1e-6,
    atol=1e-4,
    rtol=1e-3,
)
```

---

## Mixed Precision Training

Mixed precision uses float16 (or bfloat16) for most operations and float32 for numerically sensitive ones. This roughly halves memory usage and can double throughput on modern GPUs.

### Standard Pattern with torch.amp

```python
from torch.amp import autocast, GradScaler

# Use bfloat16 on Ampere+ GPUs (A100, H100), float16 on older (V100)
dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

# GradScaler is needed for float16 to handle underflow; not needed for bfloat16
use_scaler = (dtype == torch.float16)
scaler = GradScaler("cuda", enabled=use_scaler)

model = model.cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

for batch in dataloader:
    optimizer.zero_grad(set_to_none=True)  # More memory efficient than zero_grad()

    with autocast("cuda", dtype=dtype):
        output = model(batch["input_ids"].cuda())
        loss = F.cross_entropy(output, batch["labels"].cuda())

    # Scale loss, backward, unscale, clip, step
    scaler.scale(loss).backward()
    scaler.unscale_(optimizer)  # Unscale before clipping
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)
    scaler.update()
```

### What Stays in float32

The autocast context manager automatically handles dtype casting. Operations that remain in float32 by default:
- Loss functions (cross_entropy, mse_loss)
- Softmax, log_softmax
- Layer normalization, batch normalization
- Small reductions that are prone to overflow

### Common Issues

- **Loss scaling overflow:** If you see NaN losses with float16, the GradScaler should handle this automatically by skipping the step and reducing the scale. If it happens frequently, reduce learning rate or check for genuine numerical issues.
- **bfloat16 vs float16:** bfloat16 has the same exponent range as float32, so it does not need loss scaling. Prefer bfloat16 when available.
- **Optimizer states:** Adam stores first and second moments in float32 regardless of model precision. This is correct and important.

---

## Gradient Accumulation

Simulate larger batch sizes when GPU memory is limited.

```python
accumulation_steps = 8  # Effective batch = batch_size * accumulation_steps
optimizer.zero_grad(set_to_none=True)

for step, batch in enumerate(dataloader):
    with autocast("cuda", dtype=dtype):
        output = model(batch["input_ids"].cuda())
        loss = F.cross_entropy(output, batch["labels"].cuda())
        loss = loss / accumulation_steps  # Normalize by accumulation steps

    scaler.scale(loss).backward()

    if (step + 1) % accumulation_steps == 0:
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        scaler.step(optimizer)
        scaler.update()
        optimizer.zero_grad(set_to_none=True)

# Handle final incomplete accumulation
if (step + 1) % accumulation_steps != 0:
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)
    scaler.update()
```

**Important:** When using gradient accumulation with distributed training, disable gradient synchronization on non-accumulation steps for efficiency:

```python
from contextlib import nullcontext

context = model.no_sync if (step + 1) % accumulation_steps != 0 else nullcontext
with context():
    loss.backward()
```

---

## Distributed Training

### DistributedDataParallel (DDP) -- Multi-GPU, Single-Node or Multi-Node

```python
import os
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler

def setup(rank: int, world_size: int):
    os.environ["MASTER_ADDR"] = "localhost"
    os.environ["MASTER_PORT"] = "12355"
    dist.init_process_group("nccl", rank=rank, world_size=world_size)
    torch.cuda.set_device(rank)

def cleanup():
    dist.destroy_process_group()

def train(rank: int, world_size: int, config: dict):
    setup(rank, world_size)

    model = MyModel(config).to(rank)
    model = DDP(model, device_ids=[rank])

    # DistributedSampler ensures each GPU sees different data
    dataset = MyDataset(config)
    sampler = DistributedSampler(dataset, num_replicas=world_size, rank=rank, shuffle=True)
    loader = DataLoader(dataset, batch_size=config["batch_size"], sampler=sampler,
                        num_workers=4, pin_memory=True)

    optimizer = torch.optim.AdamW(model.parameters(), lr=config["lr"])

    for epoch in range(config["epochs"]):
        sampler.set_epoch(epoch)  # CRITICAL: ensures different shuffling each epoch
        model.train()

        for batch in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = model(batch.to(rank))
            loss.backward()  # DDP automatically averages gradients
            optimizer.step()

        # Save checkpoint only on rank 0
        if rank == 0:
            torch.save(model.module.state_dict(), f"checkpoint_epoch{epoch}.pt")

        dist.barrier()  # Sync before next epoch

    cleanup()

# Launch
if __name__ == "__main__":
    world_size = torch.cuda.device_count()
    torch.multiprocessing.spawn(train, args=(world_size, config), nprocs=world_size)
```

### Using torchrun (preferred launch method)

```bash
# Single node, 4 GPUs
torchrun --nproc_per_node=4 train.py

# Multi-node (run on each node)
torchrun --nproc_per_node=4 --nnodes=2 --node_rank=0 \
    --master_addr=node0 --master_port=12355 train.py
```

With torchrun, use environment variables instead of manual setup:

```python
def setup_from_env():
    dist.init_process_group("nccl")
    rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(rank)
    return rank
```

### Fully Sharded Data Parallel (FSDP) -- for very large models

```python
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import MixedPrecision, ShardingStrategy

mp_policy = MixedPrecision(
    param_dtype=torch.bfloat16,
    reduce_dtype=torch.bfloat16,
    buffer_dtype=torch.bfloat16,
)

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,  # Shard params, grads, and optimizer
    mixed_precision=mp_policy,
    device_id=rank,
    # Wrap each transformer block as its own FSDP unit
    auto_wrap_policy=functools.partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={TransformerBlock},
    ),
)
```

---

## Debugging Tips

### Dimension Mismatch Debugging

```python
# Use named dimensions for clarity (PyTorch named tensors are experimental but useful for debugging)
# Alternatively, add shape assertions:
def forward(self, x: torch.Tensor) -> torch.Tensor:
    B, T, C = x.shape
    assert C == self.d_model, f"Expected d_model={self.d_model}, got {C}"
    # ... rest of forward
```

### Gradient Debugging

```python
# Check for vanishing/exploding gradients
def log_gradient_stats(model: nn.Module, writer=None, step: int = 0):
    for name, param in model.named_parameters():
        if param.grad is not None:
            grad = param.grad
            print(f"{name}: mean={grad.mean():.6f}, std={grad.std():.6f}, "
                  f"max={grad.abs().max():.6f}, has_nan={grad.isnan().any()}")

# Hook-based gradient inspection
def hook_fn(name):
    def hook(grad):
        if grad.isnan().any():
            print(f"NaN gradient in {name}!")
            import pdb; pdb.set_trace()
        return grad
    return hook

for name, param in model.named_parameters():
    param.register_hook(hook_fn(name))
```

### NaN/Inf Detection

```python
# Global anomaly detection (slow, use only for debugging)
torch.autograd.set_detect_anomaly(True)

# Targeted NaN checking
def check_nan(tensor: torch.Tensor, name: str):
    if tensor.isnan().any():
        raise ValueError(f"NaN detected in {name}")
    if tensor.isinf().any():
        raise ValueError(f"Inf detected in {name}")
```

### Profiling

```python
# PyTorch Profiler
from torch.profiler import profile, record_function, ProfilerActivity

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    with record_function("training_step"):
        output = model(input_data)
        loss = criterion(output, target)
        loss.backward()

# Print summary sorted by CUDA time
print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))

# Export for Chrome trace viewer
prof.export_chrome_trace("trace.json")

# Export for TensorBoard
prof.export_stacks("profiler_stacks.txt", "self_cuda_time_total")
```

### Quick Sanity Checks

```python
# 1. Overfit a single batch (should reach ~0 loss quickly)
batch = next(iter(dataloader))
for i in range(100):
    loss = train_step(model, batch)
    if i % 10 == 0:
        print(f"Step {i}: loss={loss:.6f}")
# If loss does not decrease: bug in model, loss, or optimizer setup

# 2. Verify loss at initialization
# For K-class classification with random init, expect loss ~ -log(1/K) = log(K)
# For K=1000 (ImageNet): expect ~6.9
# For K=10 (CIFAR): expect ~2.3

# 3. Check that all parameters are being updated
initial_params = {n: p.clone() for n, p in model.named_parameters()}
# ... run a few training steps ...
for name, param in model.named_parameters():
    if torch.equal(param, initial_params[name]):
        print(f"WARNING: {name} did not change during training!")
```

---

## Memory Optimization

### Activation Checkpointing (Gradient Checkpointing)

Trades compute for memory: recomputes activations during backward instead of storing them.

```python
from torch.utils.checkpoint import checkpoint

class CheckpointedTransformer(nn.Module):
    def __init__(self, n_layers: int, config):
        super().__init__()
        self.layers = nn.ModuleList([TransformerBlock(config) for _ in range(n_layers)])
        self.use_checkpoint = True  # Toggle for training vs inference

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            if self.use_checkpoint and self.training:
                # use_reentrant=False is the modern, recommended approach
                x = checkpoint(layer, x, use_reentrant=False)
            else:
                x = layer(x)
        return x
```

### Memory-Efficient Attention

```python
# PyTorch 2.0+ has memory-efficient attention built in
# F.scaled_dot_product_attention automatically uses:
# - FlashAttention-2 (if available)
# - Memory-efficient attention (xformers backend)
# - Standard attention (fallback)

# To force a specific backend:
from torch.nn.attention import SDPBackend, sdpa_kernel
with sdpa_kernel(SDPBackend.FLASH_ATTENTION):
    out = F.scaled_dot_product_attention(q, k, v)
```

### Reducing Memory Usage

```python
# 1. Use set_to_none=True in zero_grad (avoids allocation for zero tensor)
optimizer.zero_grad(set_to_none=True)

# 2. Delete intermediate tensors
del logits, hidden_states
torch.cuda.empty_cache()  # Only if you need the memory for something else immediately

# 3. Use inplace operations where safe (saves memory but can break autograd)
x = F.relu(x, inplace=True)  # Safe in forward if x is not used later

# 4. Reduce stored activations
# Use F.cross_entropy(logits, targets) instead of:
#   probs = F.softmax(logits, dim=-1)
#   loss = F.nll_loss(probs.log(), targets)
# The fused version does not store the full softmax output

# 5. Monitor memory
print(f"Allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
print(f"Reserved:  {torch.cuda.memory_reserved() / 1e9:.2f} GB")
print(f"Max allocated: {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")
torch.cuda.reset_peak_memory_stats()  # Reset max tracking
```

### torch.compile

```python
# PyTorch 2.0+ compilation: fuses operations, reduces memory, improves speed
model = torch.compile(model, mode="reduce-overhead")  # Best for training
# mode="max-autotune": slower compilation, potentially faster runtime
# mode="default": balanced

# Tip: compile individual modules for finer control
model.encoder = torch.compile(model.encoder)
```

---

## Common Pitfalls

### 1. Forgetting model.train() / model.eval()

```python
# WRONG: evaluating in train mode (dropout and batchnorm behave differently)
accuracy = evaluate(model, val_loader)

# RIGHT:
model.eval()
with torch.no_grad():
    accuracy = evaluate(model, val_loader)
model.train()  # Switch back for training
```

### 2. Not Detaching Hidden States in RNNs

```python
# WRONG: backpropagation through entire history (memory explosion)
hidden = model.init_hidden()
for batch in dataloader:
    output, hidden = model(batch, hidden)  # hidden retains full graph
    loss.backward()

# RIGHT: detach between TBPTT segments
hidden = model.init_hidden()
for batch in dataloader:
    hidden = hidden.detach()  # Break the computational graph
    output, hidden = model(batch, hidden)
    loss.backward()
```

### 3. In-Place Operations Breaking Autograd

```python
# WRONG: modifying a tensor that autograd needs for backward
x = x + residual
x[:, 0] = special_token  # In-place modification after autograd tracking

# RIGHT:
x = x + residual
x = torch.cat([special_token.expand(B, 1, C), x[:, 1:]], dim=1)
```

### 4. Incorrect Loss Reduction with Gradient Accumulation

```python
# WRONG: using mean reduction without compensating for accumulation
loss = F.cross_entropy(output, target, reduction="mean")
loss.backward()  # Gradient is 1/batch_size, not 1/effective_batch_size

# RIGHT:
loss = F.cross_entropy(output, target, reduction="mean")
loss = loss / accumulation_steps  # Normalize
loss.backward()
```

### 5. Data Leakage Through BatchNorm

```python
# WRONG in some contexts: BatchNorm uses running stats from training data
# during eval, but this leaks batch statistics during training.
# For very small batches or batch size 1, use LayerNorm or GroupNorm instead.
```

### 6. Moving Tensors to GPU Inside DataLoader Workers

```python
# WRONG: tensors created on GPU in worker processes cause issues
class BadDataset(Dataset):
    def __getitem__(self, idx):
        return self.data[idx].cuda()  # Do not do this!

# RIGHT: keep data on CPU, move in training loop
class GoodDataset(Dataset):
    def __getitem__(self, idx):
        return self.data[idx]  # CPU tensor

# In training loop:
for batch in loader:
    batch = batch.cuda(non_blocking=True)  # non_blocking with pin_memory
```

### 7. Learning Rate Scheduler Step Timing

```python
# Per-epoch schedulers (StepLR, CosineAnnealingLR, etc.)
for epoch in range(num_epochs):
    train_one_epoch(model, loader, optimizer)
    scheduler.step()  # After epoch, not after each batch

# Per-step schedulers (OneCycleLR, linear warmup, etc.)
for batch in loader:
    loss = train_step(model, batch, optimizer)
    scheduler.step()  # After each optimizer step
```

### 8. State Dict Key Mismatches with DDP

```python
# DDP wraps the model, adding "module." prefix to all keys
# WRONG:
model = DDP(MyModel().cuda(), device_ids=[rank])
torch.save(model.state_dict(), "model.pt")  # Keys have "module." prefix
# Loading into non-DDP model will fail

# RIGHT: save the underlying module
torch.save(model.module.state_dict(), "model.pt")

# Or strip prefix when loading:
state_dict = torch.load("model.pt")
state_dict = {k.removeprefix("module."): v for k, v in state_dict.items()}
model.load_state_dict(state_dict)
```

---

## Reproducibility

```python
import random
import numpy as np

def set_seed(seed: int = 42):
    """Set all random seeds for reproducibility.

    Note: Full reproducibility with CUDA requires additional settings
    that may reduce performance.
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)

# For full CUDA reproducibility (may reduce performance):
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False
torch.use_deterministic_algorithms(True)
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"  # Required for CUDA >= 10.2

# DataLoader reproducibility
def seed_worker(worker_id):
    worker_seed = torch.initial_seed() % 2**32
    np.random.seed(worker_seed)
    random.seed(worker_seed)

g = torch.Generator()
g.manual_seed(42)
loader = DataLoader(dataset, worker_init_fn=seed_worker, generator=g, ...)
```

---

## Experiment Management

### Clean Training Loop Template

```python
from dataclasses import dataclass, asdict
from pathlib import Path
import json
import time

@dataclass
class TrainConfig:
    """All hyperparameters in one place. Serializable for logging."""
    model_name: str = "transformer"
    d_model: int = 512
    n_layers: int = 6
    n_heads: int = 8
    batch_size: int = 32
    lr: float = 3e-4
    weight_decay: float = 0.1
    warmup_steps: int = 1000
    max_steps: int = 100_000
    grad_clip: float = 1.0
    seed: int = 42

    def save(self, path: Path):
        with open(path / "config.json", "w") as f:
            json.dump(asdict(self), f, indent=2)


def train(config: TrainConfig):
    set_seed(config.seed)

    # Setup
    run_dir = Path(f"runs/{config.model_name}_{int(time.time())}")
    run_dir.mkdir(parents=True, exist_ok=True)
    config.save(run_dir)

    model = build_model(config).cuda()
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.lr,
        weight_decay=config.weight_decay,
        betas=(0.9, 0.95),  # Common for transformers
    )
    scheduler = get_cosine_schedule_with_warmup(
        optimizer, config.warmup_steps, config.max_steps
    )

    # Training loop
    model.train()
    step = 0
    best_val_loss = float("inf")

    while step < config.max_steps:
        for batch in train_loader:
            # Forward
            with autocast("cuda", dtype=torch.bfloat16):
                loss = model(batch.cuda())

            # Backward
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            grad_norm = torch.nn.utils.clip_grad_norm_(
                model.parameters(), config.grad_clip
            )
            optimizer.step()
            scheduler.step()
            step += 1

            # Logging
            if step % 100 == 0:
                print(f"Step {step}: loss={loss.item():.4f}, "
                      f"grad_norm={grad_norm:.4f}, "
                      f"lr={scheduler.get_last_lr()[0]:.2e}")

            # Evaluation
            if step % 1000 == 0:
                val_loss = evaluate(model, val_loader)
                print(f"Step {step}: val_loss={val_loss:.4f}")

                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    torch.save({
                        "step": step,
                        "model_state_dict": model.state_dict(),
                        "optimizer_state_dict": optimizer.state_dict(),
                        "scheduler_state_dict": scheduler.state_dict(),
                        "val_loss": val_loss,
                        "config": asdict(config),
                    }, run_dir / "best.pt")

                model.train()

            if step >= config.max_steps:
                break
```
