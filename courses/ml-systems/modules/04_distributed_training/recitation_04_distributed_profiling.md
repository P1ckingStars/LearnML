# Recitation 04: Profiling Distributed Training with NCCL Traces

## Overview

This recitation provides hands-on experience profiling distributed training workloads. The goals are:

1. Use PyTorch's profiler and NCCL debug logging to capture and analyze distributed communication traces.
2. Identify communication bottlenecks and measure actual vs. theoretical bandwidth utilization.
3. Diagnose common performance issues: insufficient overlap, suboptimal bucket sizes, and topology-unaware placement.
4. Build intuition for the relative costs of different collective operations at scale.

**Prerequisites:** Access to a multi-GPU machine (2+ GPUs minimum, 8 GPUs ideal). NCCL installed. PyTorch with distributed support.

---

## Section 1: Setting Up NCCL Profiling

### 1.1 NCCL Debug Logging

NCCL provides built-in logging controlled by environment variables. Set these before launching your training script:

```bash
# Basic NCCL topology and initialization info
export NCCL_DEBUG=INFO

# Detailed per-operation logging (very verbose, use selectively)
export NCCL_DEBUG=TRACE
export NCCL_DEBUG_SUBSYS=INIT,COLL,NET

# Log to file instead of stdout
export NCCL_DEBUG_FILE=/tmp/nccl_log_%h_%p.txt
```

**Exercise 1.1.** Launch a simple 2-GPU DDP training run with `NCCL_DEBUG=INFO`. From the output, identify:
- The detected topology (NVLink, PCIe, etc.)
- The number of channels NCCL selected
- The algorithm (Ring/Tree) chosen for each collective

### 1.2 Reading NCCL Init Output

Sample NCCL init output and what each line means:

```
# Topology detection
NCCL INFO Trees [0] 1/-1/-1->0->-1|-1->0->1/-1/-1 [1] -1/-1/-1->0->1|1->0->-1/-1/-1

# Channel configuration
NCCL INFO Channel 00 : 0 1       <- Ring: GPU 0 -> GPU 1
NCCL INFO Channel 01 : 1 0       <- Ring: GPU 1 -> GPU 0

# Transport selection
NCCL INFO Connected all rings    <- Using ring AllReduce
NCCL INFO Connected all trees    <- Tree AllReduce also available

# Protocol and algorithm
NCCL INFO Using 256 threads, Min Coverage 2, Channels 2, Tree threshold 262144
```

**Key information to extract:**
- **Ring topology:** Which GPUs are adjacent in the ring? On multi-rail systems, are different channels on different NVLink paths?
- **Channel count:** More channels = more bandwidth utilization, but also more synchronization overhead.
- **Tree threshold:** Messages below this size use tree AllReduce; above use ring.

---

## Section 2: PyTorch Profiler for Distributed Training

### 2.1 Basic Profiling Setup

```python
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.profiler import profile, record_function, ProfilerActivity

def profile_training(model, dataloader, optimizer, rank, num_steps=10):
    """Profile a distributed training run."""
    model = DDP(model.cuda(rank), device_ids=[rank])

    with profile(
        activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
        schedule=torch.profiler.schedule(
            wait=2,      # skip first 2 steps (warmup)
            warmup=2,    # warmup profiler for 2 steps
            active=6,    # profile 6 steps
            repeat=1,
        ),
        on_trace_ready=torch.profiler.tensorboard_trace_handler(
            f'./traces/rank{rank}'
        ),
        record_shapes=True,
        profile_memory=True,
        with_stack=True,
    ) as prof:
        for step, (data, target) in enumerate(dataloader):
            if step >= num_steps:
                break
            data, target = data.cuda(rank), target.cuda(rank)

            with record_function("zero_grad"):
                optimizer.zero_grad()

            with record_function("forward"):
                output = model(data)
                loss = torch.nn.functional.cross_entropy(output, target)

            with record_function("backward"):
                loss.backward()

            with record_function("optimizer"):
                optimizer.step()

            prof.step()

    return prof
```

### 2.2 Interpreting the Trace

Load the trace in TensorBoard:
```bash
tensorboard --logdir=./traces
```

In the trace view, look for:

1. **NCCL kernels**: Named `ncclKernel_AllReduce_*`, `ncclKernel_ReduceScatter_*`, etc. These show the actual GPU time spent on communication.

2. **Overlap analysis**: Check if NCCL kernels overlap with backward computation kernels. Good overlap means the NCCL kernels run on a separate CUDA stream concurrently with compute kernels.

3. **Gaps**: Idle periods between compute and communication indicate synchronization stalls.

### 2.3 Extracting Key Metrics

```python
def analyze_profile(prof):
    """Extract communication vs computation breakdown."""
    events = prof.key_averages()

    comm_time = 0
    compute_time = 0
    for evt in events:
        if 'nccl' in evt.key.lower():
            comm_time += evt.cuda_time_total
        elif evt.key in ['forward', 'backward', 'optimizer']:
            compute_time += evt.cuda_time_total

    print(f"Communication time: {comm_time / 1e6:.2f} s")
    print(f"Computation time:   {compute_time / 1e6:.2f} s")
    print(f"Comm/Compute ratio: {comm_time / compute_time:.3f}")
    print(f"Scaling efficiency: {compute_time / (compute_time + comm_time):.3f}")

    # Per-collective breakdown
    for evt in events:
        if 'nccl' in evt.key.lower():
            print(f"  {evt.key}: count={evt.count}, "
                  f"avg={evt.cuda_time / 1e3:.2f} ms, "
                  f"total={evt.cuda_time_total / 1e3:.2f} ms")
```

---

## Section 3: Measuring Collective Performance

### 3.1 NCCL Bandwidth Benchmark

Write a standalone benchmark to measure actual AllReduce bandwidth on your hardware:

```python
import torch
import torch.distributed as dist
import time
import os

def benchmark_allreduce(sizes_mb, num_iters=100, warmup=10):
    """Benchmark AllReduce for various message sizes."""
    rank = int(os.environ['RANK'])
    world_size = int(os.environ['WORLD_SIZE'])

    dist.init_process_group('nccl')
    torch.cuda.set_device(rank)

    results = []
    for size_mb in sizes_mb:
        num_elements = int(size_mb * 1024 * 1024 / 4)  # float32
        tensor = torch.randn(num_elements, device='cuda')

        # Warmup
        for _ in range(warmup):
            dist.all_reduce(tensor)
        torch.cuda.synchronize()

        # Benchmark
        start = time.perf_counter()
        for _ in range(num_iters):
            dist.all_reduce(tensor)
        torch.cuda.synchronize()
        elapsed = time.perf_counter() - start

        avg_time_ms = elapsed / num_iters * 1000
        # Algorithm bandwidth = data_size / time
        algbw_gbps = (size_mb / 1024) / (avg_time_ms / 1000)
        # Bus bandwidth = algbw * 2*(N-1)/N
        busbw_gbps = algbw_gbps * 2 * (world_size - 1) / world_size

        results.append({
            'size_mb': size_mb,
            'time_ms': avg_time_ms,
            'algbw_gbps': algbw_gbps,
            'busbw_gbps': busbw_gbps,
        })

        if rank == 0:
            print(f"Size: {size_mb:8.1f} MB | "
                  f"Time: {avg_time_ms:8.3f} ms | "
                  f"AlgBW: {algbw_gbps:8.2f} GB/s | "
                  f"BusBW: {busbw_gbps:8.2f} GB/s")

    return results

if __name__ == '__main__':
    sizes = [0.001, 0.01, 0.1, 1, 10, 100, 500, 1000, 2000]
    benchmark_allreduce(sizes)
```

Launch with:
```bash
torchrun --nproc_per_node=8 benchmark_allreduce.py
```

**Expected output (8x A100 with NVLink):**

```
Size:    0.0 MB | Time:    0.012 ms | AlgBW:    0.08 GB/s | BusBW:    0.14 GB/s
Size:    0.0 MB | Time:    0.014 ms | AlgBW:    0.73 GB/s | BusBW:    1.28 GB/s
Size:    0.1 MB | Time:    0.018 ms | AlgBW:    5.71 GB/s | BusBW:    9.99 GB/s
Size:    1.0 MB | Time:    0.030 ms | AlgBW:   33.4  GB/s | BusBW:   58.4  GB/s
Size:   10.0 MB | Time:    0.057 ms | AlgBW:  175.4  GB/s | BusBW:  306.9  GB/s
Size:  100.0 MB | Time:    0.375 ms | AlgBW:  266.7  GB/s | BusBW:  466.7  GB/s
Size:  500.0 MB | Time:    1.750 ms | AlgBW:  285.7  GB/s | BusBW:  500.0  GB/s
Size: 1000.0 MB | Time:    3.450 ms | AlgBW:  289.9  GB/s | BusBW:  507.3  GB/s
Size: 2000.0 MB | Time:    6.850 ms | AlgBW:  291.9  GB/s | BusBW:  510.9  GB/s
```

**Exercise 3.1.** Run this benchmark on your hardware. Plot busBW vs. message size on a log-log plot. Identify:
- The latency-dominated regime (small messages, flat time)
- The bandwidth-dominated regime (large messages, bandwidth saturates)
- The crossover point

**Exercise 3.2.** Compare AllReduce, AllGather, and ReduceScatter performance. Verify that AllReduce takes approximately $2\times$ the time of either AllGather or ReduceScatter for the same data size.

### 3.2 Bandwidth vs. Theoretical Peak

```python
def compute_efficiency(busbw_gbps, peak_gbps):
    """Compute bandwidth utilization efficiency."""
    return busbw_gbps / peak_gbps * 100

# Example for 8x A100 with NVLink 3.0 (600 GB/s bidirectional per GPU)
peak_nvlink = 600  # GB/s per GPU
measured_busbw = 510  # GB/s from benchmark
print(f"NVLink efficiency: {compute_efficiency(measured_busbw, peak_nvlink):.1f}%")
# Expected: ~85% (NCCL overhead, protocol overhead)
```

---

## Section 4: Profiling DDP Overlap

### 4.1 Measuring Overlap Efficiency

```python
def profile_ddp_overlap(model, dataloader, rank, world_size):
    """Profile DDP to measure communication-computation overlap."""
    model = DDP(
        model.cuda(rank),
        device_ids=[rank],
        bucket_cap_mb=25,
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

    # Use CUDA events for precise timing
    fwd_start = torch.cuda.Event(enable_timing=True)
    fwd_end = torch.cuda.Event(enable_timing=True)
    bwd_start = torch.cuda.Event(enable_timing=True)
    bwd_end = torch.cuda.Event(enable_timing=True)
    step_end = torch.cuda.Event(enable_timing=True)

    timings = []
    for step, (data, target) in enumerate(dataloader):
        if step >= 20:
            break
        data, target = data.cuda(rank), target.cuda(rank)

        fwd_start.record()
        output = model(data)
        loss = torch.nn.functional.cross_entropy(output, target)
        fwd_end.record()

        bwd_start.record()
        optimizer.zero_grad()
        loss.backward()
        bwd_end.record()

        optimizer.step()
        step_end.record()

        torch.cuda.synchronize()

        if step >= 5:  # skip warmup
            timings.append({
                'forward': fwd_start.elapsed_time(fwd_end),
                'backward': bwd_start.elapsed_time(bwd_end),
                'step_total': fwd_start.elapsed_time(step_end),
            })

    if rank == 0:
        avg_fwd = sum(t['forward'] for t in timings) / len(timings)
        avg_bwd = sum(t['backward'] for t in timings) / len(timings)
        avg_total = sum(t['step_total'] for t in timings) / len(timings)
        # backward includes overlapped communication
        # If backward time ~= compute-only backward time, overlap is good
        print(f"Forward:  {avg_fwd:.2f} ms")
        print(f"Backward: {avg_bwd:.2f} ms (includes overlapped AllReduce)")
        print(f"Total:    {avg_total:.2f} ms")
```

### 4.2 Effect of Bucket Size

**Exercise 4.1.** Vary `bucket_cap_mb` across {1, 5, 10, 25, 50, 100, 500} and measure:
- Per-step training time
- Number of AllReduce calls (from profiler trace)
- Overlap efficiency (fraction of communication hidden behind compute)

```python
bucket_sizes = [1, 5, 10, 25, 50, 100, 500]
for bucket_mb in bucket_sizes:
    model = DDP(base_model.cuda(rank), device_ids=[rank],
                bucket_cap_mb=bucket_mb)
    # ... run benchmark and record timing
```

**Expected behavior:**
- Very small buckets (1 MB): too many AllReduce calls, high latency overhead
- Very large buckets (500 MB): too few AllReduce calls, poor overlap
- Optimal: typically 10-50 MB, depends on model architecture and compute speed

### 4.3 Visualizing the Communication Timeline

**Exercise 4.2.** Use the Chrome trace format to visualize forward, backward, and communication events:

```python
import json

def create_timeline(events, output_file='timeline.json'):
    """Create Chrome trace format visualization."""
    trace_events = []
    for evt in events:
        trace_events.append({
            'name': evt['name'],
            'cat': evt['category'],
            'ph': 'X',  # complete event
            'ts': evt['start_us'],
            'dur': evt['duration_us'],
            'pid': evt['rank'],
            'tid': evt['stream'],
        })
    with open(output_file, 'w') as f:
        json.dump({'traceEvents': trace_events}, f)
    print(f"Open chrome://tracing and load {output_file}")
```

---

## Section 5: Profiling FSDP Communication

### 5.1 FSDP vs DDP Comparison

```python
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy

def compare_ddp_fsdp(model_fn, dataloader, rank, world_size):
    """Compare DDP and FSDP performance on the same model."""
    results = {}

    # DDP
    model_ddp = DDP(model_fn().cuda(rank), device_ids=[rank])
    results['ddp'] = benchmark_training(model_ddp, dataloader, rank)
    del model_ddp

    # FSDP (full shard = ZeRO-3)
    model_fsdp = FSDP(
        model_fn().cuda(rank),
        sharding_strategy=ShardingStrategy.FULL_SHARD,
    )
    results['fsdp_full'] = benchmark_training(model_fsdp, dataloader, rank)
    del model_fsdp

    # FSDP (shard grad op = ZeRO-2)
    model_fsdp2 = FSDP(
        model_fn().cuda(rank),
        sharding_strategy=ShardingStrategy.SHARD_GRAD_OP,
    )
    results['fsdp_grad'] = benchmark_training(model_fsdp2, dataloader, rank)

    if rank == 0:
        for name, r in results.items():
            print(f"{name:15s}: time={r['time_ms']:.1f} ms, "
                  f"peak_mem={r['peak_mem_mb']:.0f} MB")
```

**Exercise 5.1.** Run the comparison above for a GPT-2-small (124M params) and GPT-2-large (774M params) model. Answer:
- At what model size does FSDP become necessary (DDP OOM)?
- What is the throughput overhead of FSDP Full Shard vs DDP?
- How much memory does FSDP save?

### 5.2 Tracing FSDP AllGather/ReduceScatter

With `NCCL_DEBUG=INFO` and PyTorch profiler, FSDP traces show:
- `ncclAllGather` calls before each FSDP unit's forward pass
- `ncclReduceScatter` calls after each FSDP unit's backward pass
- Prefetch overlap: the AllGather for the next unit starting while the current unit computes

**Exercise 5.2.** Count the number of AllGather and ReduceScatter operations per training step for an FSDP-wrapped model. Verify this matches $3L$ (where $L$ is the number of FSDP units) -- $L$ AllGathers in forward, $L$ AllGathers + $L$ ReduceScatters in backward.

---

## Section 6: Diagnosing Common Issues

### 6.1 Problem: No Overlap Between Communication and Computation

**Symptom:** In the trace, AllReduce kernels appear sequentially after all backward computation, never overlapping.

**Causes:**
1. `find_unused_parameters=True` in DDP (forces sequential reduction)
2. Bucket size too large (single AllReduce at the end)
3. Model has no backward computation after last layer gradients (e.g., very shallow model)

**Fix:** Check bucket sizes, set `find_unused_parameters=False` if possible, ensure model is deep enough for overlap.

### 6.2 Problem: Stragglers Causing Slow AllReduce

**Symptom:** AllReduce takes much longer than expected from bandwidth calculations.

**Diagnostic:**
```python
# Time the AllReduce barrier
torch.cuda.synchronize()
t0 = time.perf_counter()
dist.barrier()
t1 = time.perf_counter()
print(f"Rank {rank}: barrier wait = {(t1-t0)*1000:.2f} ms")
```

If some ranks consistently take longer, they are stragglers. Common causes: thermal throttling, memory contention, unbalanced data loading.

### 6.3 Problem: Low NCCL Bandwidth

**Symptom:** Measured bus bandwidth is much lower than theoretical peak.

**Diagnostic checklist:**
1. Is CUDA_VISIBLE_DEVICES set correctly? (wrong GPU assignment can force PCIe instead of NVLink)
2. Is GPUDirect RDMA enabled? (`NCCL_NET_GDR_LEVEL`)
3. Are there enough NCCL channels? (`NCCL_MIN_NCHANNELS`)
4. Is the network congested? (check switch counters)

```bash
# Check GPU topology
nvidia-smi topo -m

# Expected output for 8x A100 DGX:
#       GPU0 GPU1 GPU2 GPU3 GPU4 GPU5 GPU6 GPU7
# GPU0   X   NV12 NV12 NV12 NV12 NV12 NV12 NV12
# GPU1  NV12  X   NV12 NV12 NV12 NV12 NV12 NV12
# ...
# NV12 = NVLink with 12 lanes -> full bandwidth
```

### 6.4 Worked Example: End-to-End Diagnosis

**Scenario:** 8-GPU DDP training of a 1.3B model achieves only 60% scaling efficiency instead of expected 95%+.

**Step 1:** Profile with PyTorch profiler. Find that backward pass takes 450ms but total step is 750ms.

**Step 2:** Check NCCL trace. AllReduce starts only after backward completes -- no overlap.

**Step 3:** Check DDP configuration: `find_unused_parameters=True` was set (a leftover from debugging). This forces sequential gradient reduction.

**Step 4:** Set `find_unused_parameters=False`. Now backward + overlapped AllReduce takes 480ms. Total step: 510ms. Scaling efficiency: 88%.

**Step 5:** Benchmark AllReduce separately. Bus bandwidth is 350 GB/s (expected 500+ for NVLink). Check `nvidia-smi topo -m`: GPUs 0-3 and 4-7 are on different NUMA nodes. Set `NCCL_MIN_NCHANNELS=8`. Bus bandwidth improves to 490 GB/s. Scaling efficiency: 94%.

---

## Section 7: Take-Home Exercises

**Exercise 7.1 (Bandwidth Roofline).** Create a "communication roofline" plot for your system: x-axis is message size (log scale), y-axis is achieved bandwidth (GB/s). Plot AllReduce, AllGather, and ReduceScatter. Overlay the theoretical peak bandwidth as a horizontal line. Identify the message size at which you achieve 80% of peak.

**Exercise 7.2 (DDP Bucket Sweep).** For a ResNet-50 and a GPT-2-small model, sweep DDP bucket sizes from 1 MB to 500 MB. Plot training throughput (samples/sec) vs bucket size. Explain why the optimal bucket size differs between the two models.

**Exercise 7.3 (FSDP Memory-Throughput Trade-off).** For a GPT-2-medium (345M) model, compare DDP vs FSDP (FULL_SHARD) vs FSDP (SHARD_GRAD_OP). Report peak memory and throughput. Then increase the model to GPT-2-large (774M) and repeat. At what point does DDP fail and FSDP become necessary?

**Exercise 7.4 (Hierarchical AllReduce).** If your system has 2+ nodes, benchmark flat AllReduce vs hierarchical AllReduce (NCCL does this automatically, but measure the effect by comparing 8 GPUs intra-node vs 8 GPUs across 2 nodes). Report the bandwidth difference and relate it to the NVLink/InfiniBand bandwidth ratio.
