# Recitation 05: Setting Up Multi-Node Training

## Overview

This recitation is a hands-on walkthrough of configuring and launching a distributed training job across multiple GPU nodes. You will set up a complete multi-node training pipeline, diagnose common issues, and measure scaling efficiency. Every command and code block is meant to be run on a SLURM-managed cluster with at least 2 nodes, each with 4+ GPUs.

**Prerequisites:** Module 04 (distributed training fundamentals), Lectures 05a-05b (mixed precision, gradient checkpointing), SSH access to a multi-node GPU cluster.

---

## 1. Environment Setup

### 1.1 Verify Cluster Configuration

Before running any training, verify that the cluster is correctly configured:

```bash
# Check available nodes and GPUs
sinfo -N -l | head -20

# Check GPU availability on a specific node
srun --nodes=1 --gpus=1 --partition=gpu --pty nvidia-smi

# Verify NCCL can see InfiniBand
srun --nodes=1 --gpus=1 --partition=gpu --pty \
    python -c "import torch; print(torch.cuda.device_count()); \
               print(torch.cuda.get_device_name(0))"

# Check InfiniBand status
srun --nodes=1 --partition=gpu --pty ibstat | grep -E "State|Rate"
```

### 1.2 Create the Project Structure

```bash
mkdir -p multi_node_training/{configs,logs,checkpoints,scripts}
cd multi_node_training
```

### 1.3 Dependencies

```bash
# Create a conda environment (or use the cluster's module system)
conda create -n multi_node python=3.11 -y
conda activate multi_node

pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
pip install deepspeed
pip install wandb  # optional, for experiment tracking
```

---

## 2. Single-Node Multi-GPU Baseline

Start with a single node to verify the training code works before scaling.

### 2.1 Model and Training Code

```python
# train.py
"""
Multi-node distributed training script.
Supports DDP, FSDP, and DeepSpeed backends.
"""
import os
import time
import argparse
import datetime
import json
import torch
import torch.nn as nn
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader, DistributedSampler
from torch.amp import autocast, GradScaler

# ── Simple Transformer Model ──────────────────────────────────────

class TransformerBlock(nn.Module):
    def __init__(self, d_model: int, n_heads: int, d_ff: int,
                 dropout: float = 0.1):
        super().__init__()
        self.attn = nn.MultiheadAttention(d_model, n_heads,
                                           dropout=dropout,
                                           batch_first=True)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_model),
            nn.Dropout(dropout),
        )
        self.norm1 = nn.LayerNorm(d_model)
        self.norm2 = nn.LayerNorm(d_model)

    def forward(self, x):
        # Pre-norm architecture
        normed = self.norm1(x)
        x = x + self.attn(normed, normed, normed, need_weights=False)[0]
        x = x + self.ff(self.norm2(x))
        return x


class SimpleTransformer(nn.Module):
    def __init__(self, vocab_size: int, d_model: int, n_heads: int,
                 d_ff: int, n_layers: int, max_seq_len: int,
                 dropout: float = 0.1):
        super().__init__()
        self.token_emb = nn.Embedding(vocab_size, d_model)
        self.pos_emb = nn.Embedding(max_seq_len, d_model)
        self.layers = nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff, dropout)
            for _ in range(n_layers)
        ])
        self.norm = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, vocab_size, bias=False)
        # Weight tying
        self.head.weight = self.token_emb.weight

    def forward(self, input_ids):
        B, S = input_ids.shape
        positions = torch.arange(S, device=input_ids.device).unsqueeze(0)
        x = self.token_emb(input_ids) + self.pos_emb(positions)

        for layer in self.layers:
            x = layer(x)

        x = self.norm(x)
        logits = self.head(x)
        return logits


# ── Synthetic Dataset ──────────────────────────────────────────────

class SyntheticLMDataset(torch.utils.data.Dataset):
    """Synthetic language modeling dataset for benchmarking."""
    def __init__(self, vocab_size: int, seq_len: int, num_samples: int):
        self.vocab_size = vocab_size
        self.seq_len = seq_len
        self.num_samples = num_samples
        # Pre-generate data for reproducibility
        self.data = torch.randint(0, vocab_size, (num_samples, seq_len + 1))

    def __len__(self):
        return self.num_samples

    def __getitem__(self, idx):
        tokens = self.data[idx]
        return tokens[:-1], tokens[1:]  # input, target


# ── Distributed Setup ──────────────────────────────────────────────

def setup_distributed():
    """Initialize distributed training."""
    if 'RANK' in os.environ:
        # Launched by torchrun or SLURM
        rank = int(os.environ['RANK'])
        local_rank = int(os.environ['LOCAL_RANK'])
        world_size = int(os.environ['WORLD_SIZE'])
    elif 'SLURM_PROCID' in os.environ:
        # Launched by srun
        rank = int(os.environ['SLURM_PROCID'])
        local_rank = int(os.environ['SLURM_LOCALID'])
        world_size = int(os.environ['SLURM_NTASKS'])
    else:
        rank, local_rank, world_size = 0, 0, 1

    if world_size > 1:
        torch.cuda.set_device(local_rank)
        dist.init_process_group(
            backend='nccl',
            timeout=datetime.timedelta(minutes=10),
        )
    else:
        torch.cuda.set_device(0)

    return rank, local_rank, world_size


def cleanup():
    if dist.is_initialized():
        dist.destroy_process_group()


# ── Checkpointing ─────────────────────────────────────────────────

def save_checkpoint(model, optimizer, scheduler, step, loss, path):
    """Save training checkpoint."""
    rank = dist.get_rank() if dist.is_initialized() else 0
    if rank == 0:
        state = {
            'step': step,
            'loss': loss,
            'model_state_dict': (model.module.state_dict()
                                 if hasattr(model, 'module')
                                 else model.state_dict()),
            'optimizer_state_dict': optimizer.state_dict(),
            'scheduler_state_dict': (scheduler.state_dict()
                                     if scheduler else None),
        }
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save(state, path)
        print(f"  Checkpoint saved: {path}")


def load_checkpoint(path, model, optimizer, scheduler=None):
    """Load training checkpoint."""
    state = torch.load(path, map_location='cpu', weights_only=False)
    if hasattr(model, 'module'):
        model.module.load_state_dict(state['model_state_dict'])
    else:
        model.load_state_dict(state['model_state_dict'])
    optimizer.load_state_dict(state['optimizer_state_dict'])
    if scheduler and state.get('scheduler_state_dict'):
        scheduler.load_state_dict(state['scheduler_state_dict'])
    return state['step']


# ── Training Loop ──────────────────────────────────────────────────

def train(args):
    rank, local_rank, world_size = setup_distributed()
    device = torch.device(f'cuda:{local_rank}')

    if rank == 0:
        print(f"Training with {world_size} GPUs")
        print(f"Config: {json.dumps(vars(args), indent=2)}")

    # Build model
    model = SimpleTransformer(
        vocab_size=args.vocab_size,
        d_model=args.d_model,
        n_heads=args.n_heads,
        d_ff=args.d_ff,
        n_layers=args.n_layers,
        max_seq_len=args.seq_len,
    ).to(device)

    param_count = sum(p.numel() for p in model.parameters())
    if rank == 0:
        print(f"Model parameters: {param_count:,}")

    # Wrap with DDP
    if world_size > 1:
        model = DDP(model, device_ids=[local_rank])

    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        betas=(0.9, 0.95),
        weight_decay=0.1,
    )

    # Dataset and dataloader
    dataset = SyntheticLMDataset(args.vocab_size, args.seq_len,
                                  args.num_samples)
    sampler = (DistributedSampler(dataset, num_replicas=world_size,
                                   rank=rank, shuffle=True)
               if world_size > 1 else None)
    dataloader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        sampler=sampler,
        shuffle=(sampler is None),
        num_workers=4,
        pin_memory=True,
        drop_last=True,
    )

    # Loss function
    criterion = nn.CrossEntropyLoss()

    # Mixed precision
    use_amp = args.dtype in ('fp16', 'bf16')
    amp_dtype = torch.float16 if args.dtype == 'fp16' else torch.bfloat16
    scaler = GradScaler(enabled=(args.dtype == 'fp16'))

    # Resume from checkpoint
    start_step = 0
    if args.resume:
        start_step = load_checkpoint(args.resume, model, optimizer)
        if rank == 0:
            print(f"Resumed from step {start_step}")

    # ── Training ───────────────────────────────────────────────
    model.train()
    step = start_step
    step_times = []

    for epoch in range(args.epochs):
        if sampler:
            sampler.set_epoch(epoch)

        for batch_idx, (input_ids, targets) in enumerate(dataloader):
            step_start = time.perf_counter()

            input_ids = input_ids.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)

            with autocast(device_type='cuda', dtype=amp_dtype,
                         enabled=use_amp):
                logits = model(input_ids)
                loss = criterion(
                    logits.view(-1, args.vocab_size),
                    targets.view(-1),
                )

            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            grad_norm = torch.nn.utils.clip_grad_norm_(
                model.parameters(), args.max_grad_norm,
            )
            scaler.step(optimizer)
            scaler.update()

            step += 1

            # Timing
            torch.cuda.synchronize()
            step_time = time.perf_counter() - step_start
            step_times.append(step_time)

            # Logging
            if rank == 0 and step % args.log_interval == 0:
                tokens_per_sec = (args.batch_size * args.seq_len
                                  * world_size / step_time)
                avg_step_time = sum(step_times[-50:]) / len(step_times[-50:])

                # Compute MFU
                model_flops = 6 * param_count * (args.batch_size
                                                  * args.seq_len
                                                  * world_size)
                achieved_flops = model_flops / step_time
                # H100 BF16 peak: 989 TFLOPS per GPU
                peak_flops = 989e12 * world_size
                mfu = achieved_flops / peak_flops

                print(
                    f"Step {step:6d} | "
                    f"Loss {loss.item():.4f} | "
                    f"Grad norm {grad_norm:.4f} | "
                    f"Step time {step_time*1000:.1f} ms | "
                    f"Tokens/s {tokens_per_sec:,.0f} | "
                    f"MFU {mfu:.1%}"
                )

            # Checkpointing
            if step % args.save_interval == 0:
                save_checkpoint(
                    model, optimizer, None, step, loss.item(),
                    os.path.join(args.checkpoint_dir,
                                 f'step_{step}.pt'),
                )

            if step >= args.max_steps:
                break
        if step >= args.max_steps:
            break

    # Final stats
    if rank == 0 and step_times:
        avg_time = sum(step_times[10:]) / len(step_times[10:])  # skip warmup
        tokens_per_sec = (args.batch_size * args.seq_len
                          * world_size / avg_time)
        print(f"\n{'='*60}")
        print(f"Training complete: {step} steps")
        print(f"Average step time: {avg_time*1000:.1f} ms")
        print(f"Throughput: {tokens_per_sec:,.0f} tokens/sec")
        print(f"{'='*60}")

    cleanup()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    # Model
    parser.add_argument('--vocab-size', type=int, default=32000)
    parser.add_argument('--d-model', type=int, default=1024)
    parser.add_argument('--n-heads', type=int, default=16)
    parser.add_argument('--d-ff', type=int, default=4096)
    parser.add_argument('--n-layers', type=int, default=24)
    parser.add_argument('--seq-len', type=int, default=512)
    # Training
    parser.add_argument('--batch-size', type=int, default=8)
    parser.add_argument('--lr', type=float, default=3e-4)
    parser.add_argument('--max-grad-norm', type=float, default=1.0)
    parser.add_argument('--epochs', type=int, default=100)
    parser.add_argument('--max-steps', type=int, default=1000)
    parser.add_argument('--dtype', choices=['fp32', 'fp16', 'bf16'],
                        default='bf16')
    # Data
    parser.add_argument('--num-samples', type=int, default=10000)
    # Infrastructure
    parser.add_argument('--log-interval', type=int, default=10)
    parser.add_argument('--save-interval', type=int, default=500)
    parser.add_argument('--checkpoint-dir', type=str,
                        default='./checkpoints')
    parser.add_argument('--resume', type=str, default=None)
    args = parser.parse_args()
    train(args)
```

### 2.2 Single-Node Launch

```bash
# Launch on 1 node with 4 GPUs using torchrun
torchrun --standalone --nproc-per-node=4 \
    train.py \
    --d-model 1024 \
    --n-layers 24 \
    --batch-size 8 \
    --max-steps 100 \
    --dtype bf16

# Expected output:
# Training with 4 GPUs
# Model parameters: 354,983,936
# Step  10 | Loss 10.3742 | Grad norm 2.1345 | Step time 85.2 ms | ...
# Step  20 | Loss 9.8521 | ...
```

Verify that:
- All 4 GPUs show ~95%+ utilization in `nvidia-smi`.
- Loss is decreasing.
- No NCCL errors in the output.

---

## 3. Scaling to Multiple Nodes

### 3.1 SLURM Submission Script

```bash
#!/bin/bash
# scripts/launch_multi_node.sh
#SBATCH --job-name=multi-node-train
#SBATCH --partition=gpu
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=4          # 4 GPUs per node for this example
#SBATCH --gpus-per-node=4
#SBATCH --cpus-per-task=8
#SBATCH --mem=0
#SBATCH --time=01:00:00
#SBATCH --exclusive
#SBATCH --output=logs/slurm_%j.out
#SBATCH --error=logs/slurm_%j.err

# ── Environment ────────────────────────────────────────
# module load cuda/12.4    # Uncomment if using modules

# Set master address to first node
export MASTER_ADDR=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n 1)
export MASTER_PORT=29500

# NCCL configuration
export NCCL_SOCKET_IFNAME=eth0       # Adjust to your network interface
export NCCL_IB_DISABLE=0             # Set to 1 if no InfiniBand
export NCCL_DEBUG=WARN               # Use INFO for debugging

# Each task gets its rank from SLURM
export WORLD_SIZE=$((SLURM_NNODES * SLURM_NTASKS_PER_NODE))

echo "Master: $MASTER_ADDR:$MASTER_PORT"
echo "World size: $WORLD_SIZE"
echo "Nodes: $(scontrol show hostnames $SLURM_JOB_NODELIST)"

# ── Launch ─────────────────────────────────────────────
srun --kill-on-bad-exit=1 \
     python -u train.py \
       --d-model 1024 \
       --n-layers 24 \
       --batch-size 8 \
       --max-steps 200 \
       --dtype bf16 \
       --log-interval 10 \
       --save-interval 100 \
       --checkpoint-dir ./checkpoints/$SLURM_JOB_ID
```

### 3.2 Submit and Monitor

```bash
# Submit the job
sbatch scripts/launch_multi_node.sh

# Monitor job status
squeue -u $USER

# Watch the output in real time
tail -f logs/slurm_*.out

# Check GPU utilization on all nodes
srun --jobid=<JOB_ID> --overlap nvidia-smi --query-gpu=index,utilization.gpu,memory.used --format=csv
```

### 3.3 Alternative: torchrun with SLURM

Instead of `srun`, you can use `torchrun` which handles rank assignment:

```bash
#!/bin/bash
#SBATCH --job-name=multi-node-torchrun
#SBATCH --partition=gpu
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=1          # NOTE: 1 task per node
#SBATCH --gpus-per-node=4
#SBATCH --cpus-per-task=32
#SBATCH --mem=0
#SBATCH --time=01:00:00
#SBATCH --exclusive
#SBATCH --output=logs/slurm_%j.out
#SBATCH --error=logs/slurm_%j.err

export MASTER_ADDR=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n 1)
export MASTER_PORT=29500

# torchrun handles spawning processes on each node
srun --ntasks-per-node=1 \
     torchrun \
       --nnodes=$SLURM_NNODES \
       --nproc-per-node=4 \
       --rdzv-id=$SLURM_JOB_ID \
       --rdzv-backend=c10d \
       --rdzv-endpoint=$MASTER_ADDR:$MASTER_PORT \
       train.py \
         --d-model 1024 \
         --n-layers 24 \
         --batch-size 8 \
         --max-steps 200 \
         --dtype bf16
```

---

## 4. Debugging Common Issues

### 4.1 NCCL Connection Failures

**Symptom:** `RuntimeError: NCCL error: unhandled system error` or hanging at `init_process_group`.

**Diagnosis:**

```bash
# 1. Check that all nodes can reach the master
srun --nodes=2 --ntasks-per-node=1 \
    bash -c 'echo "$(hostname): pinging $MASTER_ADDR" && ping -c 1 $MASTER_ADDR'

# 2. Check that the port is accessible
srun --nodes=1 --ntasks-per-node=1 \
    bash -c 'python -c "import socket; s=socket.socket(); s.bind((\"0.0.0.0\", 29500)); print(\"Port OK\"); s.close()"'

# 3. Check network interface names
srun --nodes=2 --ntasks-per-node=1 \
    bash -c 'hostname && ip addr show | grep -E "inet .*(ib|eth)" | head -4'

# 4. Run NCCL connectivity test
srun --nodes=2 --ntasks-per-node=4 --gpus-per-node=4 \
    python -c "
import torch, torch.distributed as dist, os, datetime
rank = int(os.environ['SLURM_PROCID'])
world_size = int(os.environ['SLURM_NTASKS'])
local_rank = int(os.environ['SLURM_LOCALID'])
torch.cuda.set_device(local_rank)
dist.init_process_group('nccl', timeout=datetime.timedelta(seconds=60))
tensor = torch.ones(1024, device=f'cuda:{local_rank}') * rank
dist.all_reduce(tensor)
expected = sum(range(world_size)) * 1024
actual = tensor.sum().item()
print(f'Rank {rank}: AllReduce test {\"PASSED\" if abs(actual - expected) < 1 else \"FAILED\"}')
dist.destroy_process_group()
"
```

**Common fixes:**
- Set `NCCL_SOCKET_IFNAME` to the correct network interface (check with `ip addr`).
- Set `NCCL_IB_DISABLE=1` if InfiniBand is not available.
- Ensure firewall rules allow the `MASTER_PORT`.
- Check that all nodes have the same NCCL version.

### 4.2 OOM Errors

**Symptom:** `RuntimeError: CUDA out of memory`.

```bash
# Check memory usage during training
watch -n 1 'nvidia-smi --query-gpu=index,memory.used,memory.total --format=csv'
```

**Fixes (in order of preference):**
1. Reduce `--batch-size`.
2. Enable gradient checkpointing (add to the model).
3. Use FSDP instead of DDP to shard parameters.
4. Reduce `--seq-len`.
5. Reduce `--d-model` or `--n-layers`.

### 4.3 Measuring Scaling Efficiency

```bash
# Run on 1 node (4 GPUs)
sbatch --nodes=1 scripts/launch_multi_node.sh

# Run on 2 nodes (8 GPUs)
sbatch --nodes=2 scripts/launch_multi_node.sh

# Run on 4 nodes (16 GPUs)
sbatch --nodes=4 scripts/launch_multi_node.sh
```

Collect the "Tokens/s" metric from each run and compute scaling efficiency:

```python
# scaling_analysis.py
"""Analyze multi-node scaling efficiency."""

results = {
    4:  {'tokens_per_sec': 45000},   # 1 node, 4 GPUs
    8:  {'tokens_per_sec': 86000},   # 2 nodes, 8 GPUs
    16: {'tokens_per_sec': 165000},  # 4 nodes, 16 GPUs
}

baseline_gpus = 4
baseline_throughput = results[baseline_gpus]['tokens_per_sec']

print(f"{'GPUs':>6} {'Tokens/s':>12} {'Speedup':>10} {'Efficiency':>12}")
print("-" * 44)
for gpus in sorted(results.keys()):
    throughput = results[gpus]['tokens_per_sec']
    ideal_speedup = gpus / baseline_gpus
    actual_speedup = throughput / baseline_throughput
    efficiency = actual_speedup / ideal_speedup

    print(f"{gpus:6d} {throughput:12,.0f} {actual_speedup:10.2f}x "
          f"{efficiency:11.1%}")
```

Expected output (communication overhead reduces efficiency):

```
  GPUs   Tokens/s    Speedup   Efficiency
--------------------------------------------
     4       45,000      1.00x      100.0%
     8       86,000      1.91x       95.6%
    16      165,000      3.67x       91.7%
```

---

## 5. Adding FSDP for Larger Models

When the model is too large for DDP, switch to FSDP:

```python
# Modify the training script to support FSDP
from torch.distributed.fsdp import (
    FullyShardedDataParallel as FSDP,
    MixedPrecision,
    ShardingStrategy,
)
from torch.distributed.fsdp.wrap import transformer_auto_wrap_policy
import functools

def build_fsdp_model(model, args):
    """Wrap model with FSDP for memory-efficient distributed training."""
    # Define wrapping policy: shard at the TransformerBlock level
    auto_wrap_policy = functools.partial(
        transformer_auto_wrap_policy,
        transformer_layer_cls={TransformerBlock},
    )

    # Mixed precision policy
    mp_policy = MixedPrecision(
        param_dtype=torch.bfloat16,
        reduce_dtype=torch.float32,
        buffer_dtype=torch.bfloat16,
    )

    model = FSDP(
        model,
        auto_wrap_policy=auto_wrap_policy,
        mixed_precision=mp_policy,
        sharding_strategy=ShardingStrategy.FULL_SHARD,
        device_id=torch.cuda.current_device(),
        limit_all_gathers=True,    # Limit concurrent AllGathers
        use_orig_params=True,      # Required for torch.compile
    )

    return model
```

To use FSDP, replace the DDP wrapping in `train()`:

```python
# Instead of:
#   model = DDP(model, device_ids=[local_rank])
# Use:
if args.strategy == 'fsdp':
    model = build_fsdp_model(model, args)
elif world_size > 1:
    model = DDP(model, device_ids=[local_rank])
```

---

## 6. Adding DeepSpeed

### 6.1 DeepSpeed Configuration

```json
// configs/ds_config.json
{
  "train_micro_batch_size_per_gpu": 8,
  "gradient_accumulation_steps": 4,
  "gradient_clipping": 1.0,

  "bf16": {
    "enabled": true
  },

  "zero_optimization": {
    "stage": 2,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8
  },

  "activation_checkpointing": {
    "partition_activations": false,
    "contiguous_memory_optimization": false
  },

  "wall_clock_breakdown": true
}
```

### 6.2 DeepSpeed Launch

```bash
#!/bin/bash
# scripts/launch_deepspeed.sh
#SBATCH --job-name=deepspeed-train
#SBATCH --partition=gpu
#SBATCH --nodes=2
#SBATCH --ntasks-per-node=1
#SBATCH --gpus-per-node=4
#SBATCH --cpus-per-task=32
#SBATCH --mem=0
#SBATCH --time=01:00:00
#SBATCH --exclusive
#SBATCH --output=logs/ds_%j.out
#SBATCH --error=logs/ds_%j.err

export MASTER_ADDR=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n 1)
export MASTER_PORT=29500

# Create hostfile for DeepSpeed
scontrol show hostnames $SLURM_JOB_NODELIST | \
    while read host; do echo "$host slots=4"; done > hostfile.txt

# Launch with DeepSpeed
deepspeed --hostfile=hostfile.txt \
    --master_addr=$MASTER_ADDR \
    --master_port=$MASTER_PORT \
    train_deepspeed.py \
      --deepspeed_config configs/ds_config.json \
      --d-model 2048 \
      --n-layers 48 \
      --batch-size 8 \
      --max-steps 200
```

---

## 7. Profiling Multi-Node Training

### 7.1 PyTorch Profiler

```python
from torch.profiler import profile, ProfilerActivity, schedule, tensorboard_trace_handler

def profiled_training_step(model, optimizer, batch, args, step):
    """Run one training step under the profiler."""
    # Only profile a few steps (profiling has overhead)
    if step < 5 or step > 15:
        return normal_training_step(model, optimizer, batch, args)

    with profile(
        activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
        schedule=schedule(wait=0, warmup=2, active=3, repeat=1),
        on_trace_ready=tensorboard_trace_handler('./logs/profiler'),
        record_shapes=True,
        profile_memory=True,
        with_stack=True,
    ) as prof:
        # Training step
        loss = normal_training_step(model, optimizer, batch, args)
        prof.step()

    return loss
```

View the profile:

```bash
# Install TensorBoard
pip install tensorboard torch-tb-profiler

# Launch TensorBoard
tensorboard --logdir=./logs/profiler --port=6006
```

### 7.2 NCCL Communication Profiling

```bash
# Enable NCCL timing
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=COLL

# Run a short training job and analyze the output
sbatch scripts/launch_multi_node.sh
grep "NCCL INFO" logs/slurm_*.out | grep -E "AllReduce|Broadcast|ReduceScatter"
```

---

## 8. Exercises

### Exercise 5R.1: Scaling Curve

Run the training script on 1, 2, and 4 nodes. Plot the tokens/second throughput vs. number of GPUs. Compute the scaling efficiency and identify the bottleneck (compute or communication).

### Exercise 5R.2: Communication vs. Computation

Use the PyTorch profiler to measure the fraction of time spent in NCCL communication vs. GPU computation. How does this ratio change as you increase the number of nodes?

### Exercise 5R.3: FSDP vs. DDP Memory

Compare peak GPU memory usage between DDP and FSDP for the same model. At what model size does DDP run out of memory while FSDP still fits?

### Exercise 5R.4: Checkpoint and Resume

1. Start a training run for 200 steps with checkpointing every 100 steps.
2. Kill the job after ~150 steps.
3. Resume from the latest checkpoint and verify that the loss continues from where it left off.

### Exercise 5R.5: Debugging a Hang

Intentionally introduce a hang by having rank 0 skip a collective operation. Use NCCL debug output and the NCCL timeout to diagnose the issue:

```python
# Bug: rank 0 skips the allreduce
if dist.get_rank() != 0:
    dist.all_reduce(tensor)
# What happens? How do you diagnose this?
```
