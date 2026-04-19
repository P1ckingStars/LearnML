# Lecture 05d: Training Infrastructure: Cluster Management, Fault Tolerance, Checkpointing

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Describe** the hardware architecture of a modern GPU training cluster, from individual GPUs through nodes, racks, and network topology (fat-tree, rail-optimized).
2. **Configure** a SLURM-based job scheduler for multi-node distributed training, including resource allocation, environment setup, and job arrays.
3. **Design** a fault tolerance strategy for large-scale training, incorporating failure detection, elastic training, and automatic restart mechanisms.
4. **Evaluate** checkpointing strategies (synchronous, asynchronous, distributed) in terms of overhead, recovery time, and storage requirements.
5. **Instrument** a training run with comprehensive monitoring: GPU utilization, MFU tracking, communication profiling, and hang detection.

---

## 2. Motivation and Context

### 2.1 Failure Is Not the Exception

A training run on 16,384 H100 GPUs for 54 days (Llama 3 405B) involves approximately:

- $16,384 \times 54 \times 24 = 21.2$ million GPU-hours
- At a failure rate of ~1 failure per 1,000 GPU-hours (industry average for large clusters): **~21,000 expected failures** during one training run

If each failure required restarting from scratch, training would never complete. Meta reported that during Llama 3 training, they experienced **466 job interruptions** over 54 days, of which 78% were attributed to hardware failures. The infrastructure's ability to detect failures, checkpoint state, and resume training is not a convenience — it is a fundamental requirement.

### 2.2 The Training Infrastructure Stack

```
┌─────────────────────────────────────────────┐
│            Training Application              │
│  (Megatron-LM, DeepSpeed, your code)        │
├─────────────────────────────────────────────┤
│         Cluster Orchestration                │
│  (SLURM, Kubernetes, custom schedulers)      │
├─────────────────────────────────────────────┤
│         Monitoring & Observability           │
│  (Prometheus, Grafana, DCGM, custom)        │
├─────────────────────────────────────────────┤
│         Network Fabric                       │
│  (InfiniBand, RoCE, NVLink, NVSwitch)       │
├─────────────────────────────────────────────┤
│         Compute Nodes                        │
│  (DGX H100, custom GPU servers)             │
├─────────────────────────────────────────────┤
│         Storage                              │
│  (Lustre, GPFS, NFS, cloud object storage)  │
└─────────────────────────────────────────────┘
```

---

## 3. GPU Cluster Architecture

### 3.1 The GPU Node

A modern GPU training node (e.g., NVIDIA DGX H100) contains:

| Component | Specification |
|-----------|--------------|
| GPUs | 8x NVIDIA H100 SXM5 (80 GB HBM3 each) |
| GPU interconnect | NVSwitch: 900 GB/s bidirectional per GPU |
| CPU | 2x Intel Xeon or AMD EPYC |
| System memory | 2 TB DDR5 |
| Network | 8x ConnectX-7 (400 Gb/s InfiniBand each) |
| Local storage | NVMe SSDs, ~30 TB |
| Power | ~10 kW per node |

**Intra-node bandwidth:** Each GPU connects to every other GPU via NVSwitch at 900 GB/s. Total bisection bandwidth within one node: $\frac{8 \times 900}{2} = 3600$ GB/s.

**NVSwitch topology:** The 8 GPUs are fully connected through NVSwitch. Any GPU can communicate with any other GPU at full bandwidth simultaneously. This is critical for tensor parallelism, which requires all-reduce across 8 GPUs every layer.

### 3.2 Network Topology

**Fat-tree (Clos) topology:** The most common data center network design for training clusters. A 3-tier fat tree:

```
            ┌─────────┐ ┌─────────┐
            │ Core SW  │ │ Core SW  │    Tier 3
            └────┬─────┘ └────┬─────┘
         ┌───────┴──┐   ┌────┴───────┐
    ┌────┴────┐ ┌───┴───┐ ┌──┴────┐ ┌┴──────┐
    │Aggr SW 0│ │Aggr 1 │ │Aggr 2 │ │Aggr 3 │  Tier 2
    └───┬─────┘ └──┬────┘ └──┬────┘ └──┬────┘
    ┌───┴──┐ ┌──┴──┐  ┌──┴──┐  ┌──┴──┐
    │ToR 0 │ │ToR 1│  │ToR 2│  │ToR 3│         Tier 1
    └──┬───┘ └──┬──┘  └──┬──┘  └──┬──┘
    Nodes 0-7  Nodes 8-15  ...     ...
```

Each node has multiple InfiniBand connections (typically 8x400 Gb/s = 3200 Gb/s = 400 GB/s per node). The fat-tree provides full bisection bandwidth: any node can communicate with any other node at the node's full link speed.

**Rail-optimized topology:** A cost-effective alternative used by some hyperscalers. Each GPU in a node connects to a different "rail" (independent network plane). GPU $i$ in all nodes shares rail $i$:

```
Rail 0: GPU0_node0 ── GPU0_node1 ── GPU0_node2 ── ...
Rail 1: GPU1_node0 ── GPU1_node1 ── GPU1_node2 ── ...
...
Rail 7: GPU7_node0 ── GPU7_node1 ── GPU7_node2 ── ...
```

This reduces switch count by ~2x but limits cross-rail communication. The training framework must be **rail-aware**, placing data-parallel groups on the same rail and tensor-parallel groups within the same node.

### 3.3 Storage Architecture

Training clusters require high-throughput parallel file systems:

| Storage Tier | Technology | Bandwidth | Capacity | Use Case |
|-------------|-----------|-----------|----------|----------|
| Local NVMe | PCIe Gen5 | ~7 GB/s per drive | 30 TB/node | Checkpoints, temp data |
| Parallel FS | Lustre, GPFS | 1-10 TB/s aggregate | 10-100 PB | Training data, shared checkpoints |
| Object store | S3, GCS | 100s GB/s aggregate | Unlimited | Long-term checkpoint storage, datasets |

**Checkpoint storage bottleneck:** A 405B parameter model in FP32 (master weights + optimizer states) is approximately:

$$405 \times 10^9 \times (4 + 4 + 4) = 4.86 \text{ TB}$$

Writing 4.86 TB to Lustre at 2 TB/s takes ~2.4 seconds (from parallel writes). On local NVMe at 7 GB/s per node with 2048 nodes, the aggregate write bandwidth is ~14 TB/s, making local NVMe the preferred target for frequent checkpoints.

---

## 4. Job Scheduling with SLURM

### 4.1 SLURM Basics for Multi-Node Training

SLURM (Simple Linux Utility for Resource Management) is the dominant scheduler for HPC and ML training clusters.

```bash
#!/bin/bash
#SBATCH --job-name=llama-70b-training
#SBATCH --partition=gpu
#SBATCH --nodes=256
#SBATCH --ntasks-per-node=8          # 8 GPUs per node
#SBATCH --gpus-per-node=8
#SBATCH --cpus-per-task=12           # CPU cores per GPU for data loading
#SBATCH --mem=0                      # Use all available memory
#SBATCH --time=168:00:00             # 7 days wall time
#SBATCH --exclusive                  # No job sharing
#SBATCH --output=logs/%j_%t.out
#SBATCH --error=logs/%j_%t.err

# ── Environment Setup ──────────────────────────────────
module load cuda/12.4 nccl/2.20 python/3.11

export MASTER_ADDR=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n 1)
export MASTER_PORT=29500
export WORLD_SIZE=$((SLURM_NNODES * SLURM_NTASKS_PER_NODE))
export NCCL_SOCKET_IFNAME=ib0        # Use InfiniBand interface
export NCCL_IB_DISABLE=0             # Enable InfiniBand
export NCCL_DEBUG=INFO               # NCCL debugging output

# ── Launch Training ────────────────────────────────────
srun --kill-on-bad-exit=1 \
     python -u train.py \
       --tensor-model-parallel-size 8 \
       --pipeline-model-parallel-size 4 \
       --num-layers 80 \
       --hidden-size 8192 \
       --num-attention-heads 64 \
       --seq-length 4096 \
       --global-batch-size 1024 \
       --micro-batch-size 1 \
       --bf16 \
       --use-flash-attn \
       --checkpoint-activations \
       --save-interval 500 \
       --save /checkpoints/llama-70b
```

### 4.2 Key SLURM Configuration for ML Training

**Exclusive node allocation:** Always use `--exclusive` to avoid interference from other jobs. GPU training is sensitive to memory bandwidth contention and network congestion.

**Task-to-GPU mapping:** `srun` with `--ntasks-per-node=8` launches 8 processes per node. Each process must bind to its assigned GPU:

```python
import os
import torch

def setup_distributed():
    """Initialize distributed training from SLURM environment."""
    # SLURM sets these automatically with srun
    rank = int(os.environ['SLURM_PROCID'])
    local_rank = int(os.environ['SLURM_LOCALID'])
    world_size = int(os.environ['WORLD_SIZE'])

    torch.cuda.set_device(local_rank)

    torch.distributed.init_process_group(
        backend='nccl',
        init_method='env://',
        world_size=world_size,
        rank=rank,
    )
    return rank, local_rank, world_size
```

**NCCL configuration for large clusters:**

```bash
# Enable InfiniBand for inter-node communication
export NCCL_IB_DISABLE=0
export NCCL_IB_HCA=mlx5_0,mlx5_1,mlx5_2,mlx5_3,mlx5_4,mlx5_5,mlx5_6,mlx5_7

# Use SHARP for in-network aggregation (if available)
export NCCL_COLLNET_ENABLE=1

# Tune buffer sizes for large messages
export NCCL_BUFFSIZE=8388608  # 8 MB

# For rail-optimized networks
export NCCL_NET_GDR_LEVEL=5    # GPUDirect RDMA level
export NCCL_P2P_LEVEL=NVL      # Use NVLink for intra-node P2P
```

### 4.3 Job Preemption and Priorities

Large training jobs compete for resources. SLURM supports priority-based scheduling:

```bash
# High-priority production training
#SBATCH --partition=gpu-priority
#SBATCH --qos=high
#SBATCH --signal=SIGUSR1@300  # Send signal 300s before preemption

# In your training script:
import signal
import sys

def preemption_handler(signum, frame):
    """Save checkpoint when preemption signal is received."""
    print(f"Received signal {signum}, saving emergency checkpoint...")
    save_checkpoint(model, optimizer, step, path="/checkpoints/emergency")
    sys.exit(0)

signal.signal(signal.SIGUSR1, preemption_handler)
```

---

## 5. Fault Tolerance

### 5.1 Taxonomy of Failures

| Failure Type | Frequency | Detection Time | Example |
|-------------|-----------|---------------|---------|
| GPU hardware (ECC errors, HBM failure) | 1 per 1000 GPU-hours | Seconds | CUDA error, Xid error |
| Network (link down, congestion) | 1 per 10,000 GPU-hours | Seconds-minutes | NCCL timeout |
| Software (OOM, NaN, driver crash) | Variable | Immediate-minutes | CUDA OOM, NaN in loss |
| Node (kernel panic, power failure) | 1 per 50,000 node-hours | Immediate | Node unreachable |
| Silent data corruption (SDC) | Rare but catastrophic | Hours-days | Wrong results, slow convergence |

### 5.2 Failure Detection

**NCCL timeouts:** The most common failure signal. When one GPU fails, other GPUs waiting for a collective operation (AllReduce, etc.) will time out:

```python
# Set NCCL timeout (default is 30 minutes — too long!)
import datetime
torch.distributed.init_process_group(
    backend='nccl',
    timeout=datetime.timedelta(minutes=10),
)

# Or per-operation:
import torch.distributed as dist
try:
    dist.all_reduce(tensor, async_op=False)
except dist.DistBackendError as e:
    print(f"Communication failure: {e}")
    trigger_checkpoint_and_restart()
```

**NVIDIA DCGM (Data Center GPU Manager):** Monitors GPU health metrics:

```bash
# Query GPU health
dcgmi health -c -g 1

# Set up persistent monitoring
dcgmi policy --set 1,1 -g 1  # Watch for ECC errors and thermal throttling

# Key metrics to monitor:
# - DCGM_FI_DEV_ECC_DBE_VOL_TOTAL: Double-bit ECC errors (critical)
# - DCGM_FI_DEV_GPU_TEMP: GPU temperature
# - DCGM_FI_DEV_POWER_USAGE: Power consumption
# - DCGM_FI_DEV_XID_ERRORS: Xid error codes
```

**Heartbeat-based detection:** Each rank periodically sends a heartbeat to a coordinator. If a heartbeat is missed, the coordinator initiates recovery:

```python
import threading
import time

class HeartbeatMonitor:
    """Monitor training process health via periodic heartbeats."""

    def __init__(self, rank: int, coordinator_url: str,
                 interval: float = 30.0, timeout: float = 120.0):
        self.rank = rank
        self.coordinator_url = coordinator_url
        self.interval = interval
        self.timeout = timeout
        self._stop_event = threading.Event()

    def start(self):
        self._thread = threading.Thread(target=self._heartbeat_loop,
                                         daemon=True)
        self._thread.start()

    def _heartbeat_loop(self):
        import requests
        while not self._stop_event.is_set():
            try:
                requests.post(
                    f"{self.coordinator_url}/heartbeat",
                    json={
                        "rank": self.rank,
                        "timestamp": time.time(),
                        "gpu_util": get_gpu_utilization(),
                        "memory_used": torch.cuda.memory_allocated(),
                    },
                    timeout=5,
                )
            except Exception as e:
                print(f"Heartbeat failed: {e}")
            time.sleep(self.interval)

    def stop(self):
        self._stop_event.set()
```

### 5.3 Elastic Training with TorchElastic

PyTorch's TorchElastic (via `torchrun`) supports automatic recovery from worker failures:

```bash
# Launch with torchrun for elastic training
torchrun \
    --nnodes=64:256 \               # Min 64, max 256 nodes
    --nproc-per-node=8 \
    --max-restarts=100 \             # Allow up to 100 restarts
    --rdzv-backend=c10d \            # Rendezvous backend
    --rdzv-endpoint=head-node:29400 \
    --rdzv-id=training-job-42 \
    train.py --args...
```

When a worker fails:
1. All surviving workers detect the failure (via NCCL timeout or rendezvous).
2. Surviving workers re-rendezvous to form a new group.
3. Each worker loads the latest checkpoint.
4. Training resumes with the new world size.

**Handling world size changes:** If the number of GPUs changes after restart, the data-parallel degree changes. The checkpoint must be re-sharded:

```python
def load_checkpoint_elastic(checkpoint_path, model, optimizer,
                             old_world_size, new_world_size):
    """Load a checkpoint with potentially different world size."""
    state = torch.load(checkpoint_path, map_location='cpu')

    # Model parameters: typically replicated or TP-sharded
    # TP sharding doesn't change with world size (it's per-node)
    model.load_state_dict(state['model'])

    # Optimizer states: sharded by DP degree (ZeRO)
    if old_world_size != new_world_size:
        # Need to re-shard optimizer states
        full_optimizer_state = gather_optimizer_state(
            state['optimizer'], old_dp_degree
        )
        new_optimizer_state = shard_optimizer_state(
            full_optimizer_state, new_dp_degree
        )
        optimizer.load_state_dict(new_optimizer_state)
    else:
        optimizer.load_state_dict(state['optimizer'])

    return state['step']
```

### 5.4 Automatic Restart Workflows

Production training runs use automated restart scripts:

```python
#!/usr/bin/env python3
"""
Training job controller: monitors, restarts, and maintains training.
"""
import subprocess
import time
import logging

logger = logging.getLogger(__name__)

class TrainingJobController:
    def __init__(self, config):
        self.config = config
        self.max_restarts = config.get('max_restarts', 100)
        self.restart_count = 0
        self.cooldown_seconds = 60  # Wait before restart

    def run(self):
        while self.restart_count < self.max_restarts:
            logger.info(f"Starting training (attempt {self.restart_count + 1})")

            # Find latest checkpoint
            latest_ckpt = self.find_latest_checkpoint()
            if latest_ckpt:
                logger.info(f"Resuming from checkpoint: {latest_ckpt}")

            # Launch SLURM job
            exit_code = self.launch_training(resume_from=latest_ckpt)

            if exit_code == 0:
                logger.info("Training completed successfully!")
                return

            self.restart_count += 1
            logger.warning(
                f"Training failed with exit code {exit_code}. "
                f"Restart {self.restart_count}/{self.max_restarts}."
            )

            # Check if the failure is recoverable
            if not self.is_recoverable(exit_code):
                logger.error("Non-recoverable failure. Stopping.")
                return

            # Validate cluster health before restart
            self.wait_for_healthy_nodes()

            # Cooldown to avoid rapid restart loops
            time.sleep(self.cooldown_seconds)

    def find_latest_checkpoint(self):
        """Find the most recent valid checkpoint."""
        import glob
        checkpoints = sorted(glob.glob(
            f"{self.config['checkpoint_dir']}/step_*/model.pt"
        ))
        for ckpt in reversed(checkpoints):
            if self.validate_checkpoint(ckpt):
                return ckpt
        return None

    def validate_checkpoint(self, path):
        """Verify checkpoint integrity (checksum, completeness)."""
        import hashlib
        try:
            meta_path = path.replace('model.pt', 'metadata.json')
            with open(meta_path) as f:
                meta = json.load(f)
            # Verify all shard files exist and have correct checksums
            for shard_info in meta['shards']:
                shard_path = os.path.join(os.path.dirname(path),
                                           shard_info['filename'])
                if not os.path.exists(shard_path):
                    return False
                # Optional: verify checksum
            return True
        except Exception:
            return False

    def wait_for_healthy_nodes(self):
        """Wait until enough healthy nodes are available."""
        required_nodes = self.config['min_nodes']
        while True:
            healthy = self.count_healthy_nodes()
            if healthy >= required_nodes:
                return
            logger.info(f"Waiting for nodes: {healthy}/{required_nodes} healthy")
            time.sleep(30)
```

---

## 6. Checkpointing Strategies

### 6.1 Synchronous Checkpointing

The simplest approach: all ranks synchronize, save their state to storage, and resume.

```python
def save_checkpoint_sync(model, optimizer, scheduler, step, path):
    """Synchronous distributed checkpoint."""
    rank = torch.distributed.get_rank()

    # Ensure all ranks are at the same step
    torch.distributed.barrier()

    # Each rank saves its shard
    state = {
        'step': step,
        'model': model.state_dict(),
        'optimizer': optimizer.state_dict(),
        'scheduler': scheduler.state_dict(),
        'rng_state': torch.cuda.get_rng_state(),
    }

    shard_path = os.path.join(path, f'step_{step}', f'rank_{rank}.pt')
    os.makedirs(os.path.dirname(shard_path), exist_ok=True)
    torch.save(state, shard_path)

    # Write metadata on rank 0
    if rank == 0:
        meta = {
            'step': step,
            'world_size': torch.distributed.get_world_size(),
            'timestamp': time.time(),
        }
        with open(os.path.join(path, f'step_{step}', 'metadata.json'), 'w') as f:
            json.dump(meta, f)

    torch.distributed.barrier()
```

**Cost:** For a 70B model with 2048 GPUs using ZeRO-1:
- Each rank saves: optimizer shard (~42 GB / 64 DP ranks = 0.66 GB) + full model (~14 GB) + ...
- With distributed checkpoint (each rank saves only its shard): ~1 GB per rank.
- Total write: ~2 TB. At 10 GB/s parallel write throughput: ~200 seconds.

### 6.2 Asynchronous Checkpointing

To avoid blocking training, copy the checkpoint state to a separate buffer and write it in the background:

```python
import threading
import copy

class AsyncCheckpointer:
    """Write checkpoints asynchronously without blocking training."""

    def __init__(self, num_writers: int = 2):
        self.executor = threading.Thread
        self._pending_writes = []

    def save(self, state_dict, path):
        """Snapshot state and write asynchronously."""
        # 1. Copy state to CPU (pinned memory for fast D2H transfer)
        snapshot = {}
        for key, tensor in state_dict.items():
            if isinstance(tensor, torch.Tensor):
                # Pin memory for async copy
                cpu_tensor = torch.empty_like(tensor, device='cpu',
                                               pin_memory=True)
                cpu_tensor.copy_(tensor, non_blocking=True)
                snapshot[key] = cpu_tensor
            else:
                snapshot[key] = copy.deepcopy(tensor)

        # 2. Synchronize the D2H copy
        torch.cuda.synchronize()

        # 3. Write to disk in background thread
        def _write():
            torch.save(snapshot, path)
            del snapshot  # Free memory

        thread = threading.Thread(target=_write)
        thread.start()
        self._pending_writes.append(thread)

    def wait(self):
        """Wait for all pending writes to complete."""
        for thread in self._pending_writes:
            thread.join()
        self._pending_writes.clear()
```

**PyTorch Distributed Checkpoint (DCP):** PyTorch provides `torch.distributed.checkpoint` for efficient distributed saving:

```python
import torch.distributed.checkpoint as dcp
from torch.distributed.checkpoint import FileSystemWriter

def save_distributed_checkpoint(model, optimizer, step, path):
    """Use PyTorch DCP for efficient distributed checkpointing."""
    state_dict = {
        'model': model.state_dict(),
        'optimizer': optimizer.state_dict(),
    }

    dcp.save(
        state_dict,
        storage_writer=FileSystemWriter(
            os.path.join(path, f'step_{step}')
        ),
    )
```

DCP advantages:
- Each rank writes only its local shard (no gathering to rank 0).
- Supports resharding: load a checkpoint saved with $N$ GPUs onto $M$ GPUs.
- Efficient serialization: avoids Python pickling overhead for large tensors.

### 6.3 Checkpointing Frequency

**How often to checkpoint?** This is a cost-benefit analysis:

- **Cost of checkpointing:** $T_{\text{ckpt}}$ seconds per checkpoint (blocking time).
- **Cost of lost work on failure:** Expected training time since last checkpoint.
- **Failure rate:** $\lambda$ failures per second.

The expected wasted work per failure is $T_{\text{interval}} / 2$ (on average, a failure occurs halfway through the interval). The expected total wasted time over the entire training run of duration $T_{\text{total}}$:

$$\text{Wasted} = \underbrace{\lambda T_{\text{total}} \cdot \frac{T_{\text{interval}}}{2}}_{\text{lost training}} + \underbrace{\frac{T_{\text{total}}}{T_{\text{interval}}} \cdot T_{\text{ckpt}}}_{\text{checkpoint overhead}}$$

Minimizing with respect to $T_{\text{interval}}$:

$$\frac{d(\text{Wasted})}{dT_{\text{interval}}} = \frac{\lambda T_{\text{total}}}{2} - \frac{T_{\text{total}} \cdot T_{\text{ckpt}}}{T_{\text{interval}}^2} = 0$$

$$T_{\text{interval}}^* = \sqrt{\frac{2 T_{\text{ckpt}}}{\lambda}}$$

**Example:** $T_{\text{ckpt}} = 120$ seconds (async, so blocking time is ~30s), $\lambda = 1 / (3600 \times 24)$ (one failure per day on a 2048-GPU cluster):

$$T_{\text{interval}}^* = \sqrt{\frac{2 \times 120}{1/86400}} = \sqrt{2 \times 120 \times 86400} \approx 4550 \text{ seconds} \approx 76 \text{ minutes}$$

In practice, teams checkpoint every 10-30 minutes for large runs, accepting higher overhead in exchange for less lost work.

### 6.4 Checkpoint Management

Long training runs generate many checkpoints. Storage management is critical:

```python
class CheckpointManager:
    """Manage checkpoint lifecycle: save, prune, validate."""

    def __init__(self, base_dir: str, keep_last: int = 5,
                 keep_every_n: int = 1000):
        self.base_dir = base_dir
        self.keep_last = keep_last      # Keep N most recent
        self.keep_every_n = keep_every_n  # Keep every Nth step permanently

    def should_keep(self, step: int, all_steps: list) -> bool:
        """Determine if a checkpoint should be kept or pruned."""
        # Always keep the latest N
        if step in sorted(all_steps)[-self.keep_last:]:
            return True
        # Keep milestones
        if step % self.keep_every_n == 0:
            return True
        return False

    def prune(self):
        """Delete old checkpoints that are no longer needed."""
        import shutil
        all_steps = self._list_checkpoint_steps()
        for step in all_steps:
            if not self.should_keep(step, all_steps):
                path = os.path.join(self.base_dir, f'step_{step}')
                shutil.rmtree(path)
                logger.info(f"Pruned checkpoint at step {step}")

    def _list_checkpoint_steps(self) -> list:
        import re
        steps = []
        for entry in os.listdir(self.base_dir):
            match = re.match(r'step_(\d+)', entry)
            if match:
                steps.append(int(match.group(1)))
        return sorted(steps)
```

---

## 7. Monitoring and Observability

### 7.1 GPU Utilization Monitoring

```python
import subprocess
import json

def get_gpu_metrics():
    """Query GPU metrics via nvidia-smi."""
    result = subprocess.run(
        ['nvidia-smi', '--query-gpu=index,utilization.gpu,'
         'utilization.memory,memory.used,memory.total,temperature.gpu,'
         'power.draw',
         '--format=csv,noheader,nounits'],
        capture_output=True, text=True,
    )
    metrics = []
    for line in result.stdout.strip().split('\n'):
        parts = [x.strip() for x in line.split(',')]
        metrics.append({
            'gpu_index': int(parts[0]),
            'gpu_util_pct': float(parts[1]),
            'mem_util_pct': float(parts[2]),
            'mem_used_mb': float(parts[3]),
            'mem_total_mb': float(parts[4]),
            'temp_c': float(parts[5]),
            'power_w': float(parts[6]),
        })
    return metrics
```

### 7.2 MFU Tracking

```python
import time

class MFUTracker:
    """Track Model FLOPS Utilization during training."""

    def __init__(self, model_params: int, hardware_flops: float,
                 world_size: int):
        """
        Args:
            model_params: Total model parameters.
            hardware_flops: Peak FLOPS per GPU (e.g., 989e12 for H100 BF16).
            world_size: Total number of GPUs.
        """
        self.model_params = model_params
        self.peak_flops = hardware_flops * world_size
        self._step_start = None

    def step_start(self):
        torch.cuda.synchronize()
        self._step_start = time.perf_counter()

    def step_end(self, tokens_in_batch: int) -> dict:
        torch.cuda.synchronize()
        elapsed = time.perf_counter() - self._step_start

        # Model FLOPS ≈ 6 * P * T (forward + backward matmuls)
        model_flops = 6 * self.model_params * tokens_in_batch
        achieved_flops = model_flops / elapsed
        mfu = achieved_flops / self.peak_flops

        return {
            'step_time_s': elapsed,
            'tokens_per_second': tokens_in_batch / elapsed,
            'achieved_tflops': achieved_flops / 1e12,
            'mfu': mfu,
        }
```

### 7.3 Detecting and Debugging Hangs

Training hangs — where GPUs are idle waiting for a communication that will never complete — are one of the most difficult failures to debug at scale.

**NCCL flight recorder:** NVIDIA NCCL includes a flight recorder that logs recent collective operations:

```bash
# Enable NCCL flight recorder
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=COLL
export TORCH_NCCL_TRACE_BUFFER_SIZE=1000  # Last 1000 operations
export TORCH_NCCL_DUMP_ON_TIMEOUT=1       # Dump on timeout
export TORCH_NCCL_TRACE_CPP_STACK=1       # Include C++ stack traces
```

**Watchdog timer:** Detect hangs by monitoring step progress:

```python
import threading

class TrainingWatchdog:
    """Detect training hangs and trigger recovery."""

    def __init__(self, timeout_seconds: float = 600):
        self.timeout = timeout_seconds
        self._last_step_time = time.time()
        self._lock = threading.Lock()
        self._stop = threading.Event()

    def step_completed(self):
        """Call at the end of each training step."""
        with self._lock:
            self._last_step_time = time.time()

    def start(self):
        self._thread = threading.Thread(target=self._monitor, daemon=True)
        self._thread.start()

    def _monitor(self):
        while not self._stop.is_set():
            with self._lock:
                elapsed = time.time() - self._last_step_time

            if elapsed > self.timeout:
                logger.error(
                    f"HANG DETECTED: No step completed in "
                    f"{elapsed:.0f}s (timeout: {self.timeout}s)"
                )
                self._dump_debug_info()
                # Trigger checkpoint and restart
                os.kill(os.getpid(), signal.SIGUSR1)
                return

            time.sleep(30)

    def _dump_debug_info(self):
        """Collect diagnostic information for hang debugging."""
        # GPU state
        for i in range(torch.cuda.device_count()):
            logger.error(f"GPU {i}: {torch.cuda.memory_summary(i)}")

        # NCCL state
        if hasattr(torch.distributed, '_get_nccl_watchdog_timeout'):
            logger.error(f"NCCL timeout: "
                        f"{torch.distributed._get_nccl_watchdog_timeout()}")

        # Python stack traces of all threads
        import traceback
        for thread_id, stack in sys._current_frames().items():
            logger.error(f"\nThread {thread_id}:")
            traceback.print_stack(stack)
```

### 7.4 Monitoring Dashboard

A production training dashboard should track:

| Metric | Normal Range | Alert Threshold |
|--------|-------------|-----------------|
| MFU | 40-60% | < 30% |
| GPU utilization | 85-99% | < 70% |
| GPU temperature | 60-80C | > 85C |
| Training loss | Decreasing | NaN or sudden spike |
| Gradient norm | Stable or decreasing | > 10x normal |
| Step time | Consistent | > 2x median |
| Network throughput | Near line rate | < 50% of expected |
| Memory usage | Stable | > 95% of GPU memory |

---

## 8. Silent Data Corruption

### 8.1 The Threat

Silent data corruption (SDC) occurs when hardware produces incorrect results without raising an error. In GPUs, SDC can manifest as:

- Incorrect arithmetic results from a faulty ALU
- Bit flips in HBM not caught by ECC
- Incorrect data from a faulty NVLink

SDC is rare (estimated at $10^{-6}$ to $10^{-8}$ per GPU-hour) but catastrophic: the model quietly trains on corrupted gradients, producing a subtly degraded model that may not be detected until evaluation.

### 8.2 Detection Strategies

**Loss spike detection:** A sudden, unexplained spike in training loss can indicate SDC. However, loss spikes also occur naturally (bad batches, learning rate changes).

**Gradient fingerprinting:** Periodically compute a deterministic forward-backward pass on a fixed "canary" batch and compare the gradient checksums across runs or against a known-good reference:

```python
def sdc_canary_check(model, canary_batch, expected_checksum):
    """Detect silent data corruption via deterministic canary check."""
    # Use deterministic mode
    with torch.random.fork_rng(devices=[torch.cuda.current_device()]):
        torch.manual_seed(42)
        torch.cuda.manual_seed(42)

        model.eval()
        output = model(canary_batch)
        loss = output.sum()
        loss.backward()

        # Compute gradient checksum
        checksum = 0.0
        for param in model.parameters():
            if param.grad is not None:
                checksum += param.grad.sum().item()

        model.train()

    if abs(checksum - expected_checksum) > 1e-2:
        logger.error(
            f"SDC DETECTED: gradient checksum {checksum} != "
            f"expected {expected_checksum}"
        )
        return False
    return True
```

**Redundant computation:** Run a small fraction of batches on two different GPU groups and compare results. Expensive but high confidence.

---

## 9. End-to-End Training Infrastructure Example

```python
"""
Complete training loop with all infrastructure components.
"""
import os
import signal
import torch
import torch.distributed as dist
from pathlib import Path

def main():
    # --- Setup ---
    rank, local_rank, world_size = setup_distributed()
    config = load_config()

    # --- Build model with parallelism ---
    model, optimizer, scheduler = build_model_and_optimizer(config)

    # --- Infrastructure components ---
    ckpt_manager = CheckpointManager(
        base_dir=config.checkpoint_dir,
        keep_last=5,
        keep_every_n=1000,
    )
    async_ckpt = AsyncCheckpointer()
    watchdog = TrainingWatchdog(timeout_seconds=600)
    mfu_tracker = MFUTracker(
        model_params=config.model_params,
        hardware_flops=989e12,  # H100 BF16
        world_size=world_size,
    )
    heartbeat = HeartbeatMonitor(rank, config.coordinator_url)

    # --- Resume from checkpoint ---
    start_step = 0
    latest_ckpt = ckpt_manager.find_latest_checkpoint()
    if latest_ckpt:
        start_step = load_checkpoint(latest_ckpt, model, optimizer, scheduler)
        if rank == 0:
            print(f"Resumed from step {start_step}")

    # --- Signal handlers ---
    def handle_preemption(signum, frame):
        save_checkpoint_sync(model, optimizer, scheduler,
                              current_step, config.checkpoint_dir)
        dist.destroy_process_group()
        exit(0)

    signal.signal(signal.SIGUSR1, handle_preemption)

    # --- Start monitoring ---
    watchdog.start()
    heartbeat.start()

    # --- Training loop ---
    model.train()
    dataloader = build_dataloader(config, start_step)

    for current_step, batch in enumerate(dataloader, start=start_step):
        mfu_tracker.step_start()

        # Forward + backward + optimizer step
        loss = training_step(model, optimizer, scheduler, batch, config)

        # Track metrics
        metrics = mfu_tracker.step_end(tokens_in_batch=config.global_batch_size
                                        * config.seq_length)
        watchdog.step_completed()

        # Log
        if rank == 0 and current_step % config.log_interval == 0:
            print(f"Step {current_step} | Loss {loss:.4f} | "
                  f"MFU {metrics['mfu']:.1%} | "
                  f"Tokens/s {metrics['tokens_per_second']:.0f}")

        # Checkpoint
        if current_step % config.save_interval == 0 and current_step > 0:
            save_checkpoint_sync(model, optimizer, scheduler,
                                  current_step, config.checkpoint_dir)
            if rank == 0:
                ckpt_manager.prune()

        # Check for NaN
        if torch.isnan(torch.tensor(loss)):
            print(f"NaN detected at step {current_step}! "
                  f"Rolling back to last checkpoint.")
            latest_ckpt = ckpt_manager.find_latest_checkpoint()
            if latest_ckpt:
                load_checkpoint(latest_ckpt, model, optimizer, scheduler)
            else:
                raise RuntimeError("NaN with no checkpoint to recover from")

    # --- Cleanup ---
    heartbeat.stop()
    async_ckpt.wait()
    dist.destroy_process_group()

if __name__ == '__main__':
    main()
```

---

## Key Takeaways

1. **Failure is the norm, not the exception.** Large-scale training runs experience hundreds of failures. Infrastructure must handle this automatically.

2. **Checkpoint frequently, asynchronously.** The optimal checkpoint interval balances lost work against checkpoint overhead. Asynchronous checkpointing minimizes training disruption.

3. **Map parallelism to network topology.** Tensor parallelism on NVLink (intra-node), pipeline parallelism on InfiniBand (inter-node), data parallelism across the cluster. Misalignment destroys throughput.

4. **Monitor everything.** MFU, GPU utilization, gradient norms, loss curves, step times. Anomalies in any metric can indicate hardware failure, configuration error, or training instability.

5. **Detect hangs proactively.** NCCL timeouts are the last resort. Watchdog timers, heartbeat monitors, and NCCL flight recorders enable faster detection and more informative debugging.

6. **Silent data corruption is real.** Canary checks and gradient fingerprinting provide early detection of hardware faults that would otherwise corrupt the model silently.

---

## Further Reading

### Required

1. **Dubey, A., et al.** (2024). "The Llama 3 Herd of Models." arXiv:2407.21783.
   - Section 3.4 describes Meta's training infrastructure, failure analysis, and recovery mechanisms for 16K H100 GPUs.

2. **Maeng, K., et al.** (2024). "Understanding Silent Data Corruption in GPU Training." arXiv (Meta Technical Report).
   - Analysis of SDC in production GPU clusters with detection and mitigation strategies.

### Recommended

3. **Yoo, A. B., et al.** (2003). "SLURM: Simple Linux Utility for Resource Management." *JSSPP 2003*.
   - The original SLURM paper, covering the scheduler's architecture and algorithms.

4. **Peng, Y., et al.** (2023). "Optimus: Optimal Resource Management for Large-Scale ML Training." *EuroSys 2023*.
   - Automated parallelism configuration and cluster resource allocation for ML training.

5. **Thorpe, J., et al.** (2023). "Bamboo: Making Preemptible Instances Resilient for Affordable Training of Large Language Models." *NSDI 2023*.
   - Techniques for training on preemptible cloud instances with frequent interruptions.

### Practical References

6. **PyTorch Distributed Checkpoint (DCP) Documentation.**
   - https://pytorch.org/docs/stable/distributed.checkpoint.html

7. **NVIDIA DCGM Documentation.**
   - https://developer.nvidia.com/dcgm

8. **TorchElastic Documentation.**
   - https://pytorch.org/docs/stable/elastic/run.html
