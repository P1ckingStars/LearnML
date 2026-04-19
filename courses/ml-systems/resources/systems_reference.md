# ML Systems Quick Reference

A concise reference for profiling tools, benchmarking methodology, GPU specifications, and common commands used in ML systems research.

---

## Table of Contents

1. [GPU Profiling Tools](#gpu-profiling-tools)
2. [Benchmarking Methodology](#benchmarking-methodology)
3. [GPU Hardware Specifications](#gpu-hardware-specifications)
4. [Common Commands](#common-commands)
5. [Performance Debugging Checklist](#performance-debugging-checklist)
6. [Memory Estimation Formulas](#memory-estimation-formulas)
7. [Communication Cost Estimation](#communication-cost-estimation)

---

## GPU Profiling Tools

### nvidia-smi: Quick GPU Status

```bash
# Current GPU utilization, memory, temperature, power
nvidia-smi

# Continuous monitoring at 1-second intervals
nvidia-smi --loop=1

# Query specific fields (scriptable)
nvidia-smi --query-gpu=gpu_name,memory.used,memory.total,utilization.gpu,power.draw \
    --format=csv

# Monitor per-process GPU memory
nvidia-smi --query-compute-apps=pid,process_name,used_gpu_memory --format=csv
```

### Nsight Systems: Timeline Profiling

```bash
# Basic profile of a Python training script
nsys profile -o my_profile python train.py

# With CUDA and NVTX annotations, delayed start
nsys profile -o my_profile \
    --trace=cuda,nvtx,osrt \
    --delay=30 \             # Skip first 30 seconds (warmup)
    --duration=10 \          # Capture 10 seconds
    --cuda-memory-usage=true \
    python train.py

# Profile with specific GPU metrics
nsys profile -o my_profile \
    --gpu-metrics-device=all \
    --gpu-metrics-frequency=10000 \
    python train.py
```

Open the `.nsys-rep` file in Nsight Systems GUI for timeline analysis. Look for:
- GPU idle gaps (data loading stalls, CPU bottlenecks)
- Kernel launch overhead (many tiny kernels)
- Communication bubbles (AllReduce blocking compute)
- Memory copy overhead (host-to-device transfers)

### Nsight Compute: Kernel-Level Profiling

```bash
# Profile all kernels in a short run
ncu -o my_kernel_profile python benchmark.py

# Profile specific kernel by name pattern
ncu --kernel-name "regex:.*gemm.*" \
    --launch-count 5 \
    -o gemm_profile \
    python benchmark.py

# Collect all sections (detailed, slow)
ncu --set full \
    --launch-count 3 \
    -o detailed_profile \
    python benchmark.py

# Key metrics to examine
ncu --metrics \
    sm__throughput.avg.pct_of_peak_sustained_elapsed,\
    dram__throughput.avg.pct_of_peak_sustained_elapsed,\
    sm__warps_active.avg.pct_of_peak_sustained_active \
    python benchmark.py
```

Key Nsight Compute sections:
- **Speed of Light**: How close to peak compute and memory throughput
- **Memory Workload Analysis**: L1/L2/HBM hit rates and bandwidth utilization
- **Compute Workload Analysis**: Pipe utilization (FMA, Tensor Core, etc.)
- **Occupancy**: Active warps vs. theoretical maximum
- **Warp State Statistics**: Stall reasons (memory, synchronization, etc.)

### PyTorch Profiler

```python
import torch
from torch.profiler import profile, record_function, ProfilerActivity, schedule

# Basic profiling
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step in range(5):
        with record_function("forward"):
            output = model(input_data)
        with record_function("loss"):
            loss = criterion(output, target)
        with record_function("backward"):
            loss.backward()
        with record_function("optimizer"):
            optimizer.step()
            optimizer.zero_grad()

# Print summary
print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))

# Export for visualization
prof.export_chrome_trace("trace.json")  # Open in chrome://tracing
```

```python
# Scheduled profiling (skip warmup, profile specific steps)
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=schedule(
        wait=5,          # Skip first 5 steps
        warmup=2,        # Warmup for 2 steps
        active=3,        # Profile 3 steps
        repeat=1,        # Repeat once
    ),
    on_trace_ready=torch.profiler.tensorboard_trace_handler("./tb_logs"),
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step in range(10):
        train_step(model, batch)
        prof.step()  # Signal the profiler at each step boundary
```

### torch.cuda Memory Tracking

```python
# Current memory usage
print(f"Allocated: {torch.cuda.memory_allocated() / 1e9:.2f} GB")
print(f"Reserved:  {torch.cuda.memory_reserved() / 1e9:.2f} GB")
print(f"Peak:      {torch.cuda.max_memory_allocated() / 1e9:.2f} GB")

# Reset peak tracking
torch.cuda.reset_peak_memory_stats()

# Memory snapshot for detailed analysis
torch.cuda.memory._record_memory_history()
# ... run your code ...
torch.cuda.memory._dump_snapshot("memory_snapshot.pickle")
# Visualize at: https://pytorch.org/memory_viz
```

---

## Benchmarking Methodology

### Standard Benchmarking Protocol

```python
import torch
import time

def benchmark_kernel(fn, *args, warmup=50, rep=200):
    """Benchmark a GPU kernel with proper methodology.

    1. Warmup runs: exclude JIT compilation and caching effects
    2. Synchronize: ensure GPU has finished before timing
    3. Multiple repetitions: measure variance
    4. Use CUDA events: accurate GPU-side timing
    """
    # Warmup
    for _ in range(warmup):
        fn(*args)
    torch.cuda.synchronize()

    # Timed runs using CUDA events
    timings = []
    for _ in range(rep):
        start = torch.cuda.Event(enable_timing=True)
        end = torch.cuda.Event(enable_timing=True)

        start.record()
        fn(*args)
        end.record()

        torch.cuda.synchronize()
        timings.append(start.elapsed_time(end))  # milliseconds

    timings = torch.tensor(timings)
    return {
        "median_ms": timings.median().item(),
        "mean_ms": timings.mean().item(),
        "std_ms": timings.std().item(),
        "min_ms": timings.min().item(),
        "max_ms": timings.max().item(),
        "p99_ms": timings.quantile(0.99).item(),
    }
```

```python
# Triton benchmarking utility
import triton

@triton.testing.perf_report(
    triton.testing.Benchmark(
        x_names=["M", "N", "K"],
        x_vals=[(256, 256, 256), (512, 512, 512),
                (1024, 1024, 1024), (4096, 4096, 4096)],
        line_arg="provider",
        line_vals=["triton", "cublas"],
        line_names=["Triton", "cuBLAS"],
        styles=[("blue", "-"), ("red", "-")],
        ylabel="TFLOPS",
        plot_name="matmul-performance",
    )
)
def benchmark(M, N, K, provider):
    a = torch.randn(M, K, device="cuda", dtype=torch.float16)
    b = torch.randn(K, N, device="cuda", dtype=torch.float16)
    quantiles = [0.5, 0.1, 0.9]
    if provider == "cublas":
        ms, min_ms, max_ms = triton.testing.do_bench(
            lambda: torch.matmul(a, b), quantiles=quantiles
        )
    elif provider == "triton":
        ms, min_ms, max_ms = triton.testing.do_bench(
            lambda: my_matmul(a, b), quantiles=quantiles
        )
    tflops = 2 * M * N * K / ms * 1e-9  # ms to TFLOPS
    return tflops

benchmark.run(print_data=True, save_path="./results/")
```

### Benchmarking Rules

1. **Always warm up.** At least 10-50 iterations to exclude JIT, caching, and frequency scaling.
2. **Use GPU-side timing.** `torch.cuda.Event` or `torch.cuda.synchronize()` + CPU timer. Never time asynchronous GPU calls with CPU-only timing.
3. **Report multiple runs.** Minimum 100 repetitions. Report median, mean, std, min, max, and p99.
4. **Control the environment.** Set `CUDA_VISIBLE_DEVICES`, disable GPU boost (`nvidia-smi -pl <power_limit>`), and run on a dedicated machine if possible.
5. **Document everything.** GPU model, driver version, CUDA version, PyTorch version, Triton version, precision, batch size, sequence length, random seed.
6. **Compare fairly.** Same precision, same batch size, same hardware, same data layout. If anything differs, disclose it explicitly.
7. **Report absolute numbers.** Relative speedups are meaningless without absolute timing.

### Roofline Analysis

```python
def roofline_analysis(flops, bytes_accessed, time_ms, gpu_peak_tflops, gpu_peak_bw_tb_s):
    """Compute roofline metrics for a kernel.

    Args:
        flops: Total floating-point operations
        bytes_accessed: Total bytes read + written from HBM
        time_ms: Kernel execution time in milliseconds
        gpu_peak_tflops: Peak compute throughput (TFLOPS)
        gpu_peak_bw_tb_s: Peak memory bandwidth (TB/s)
    """
    time_s = time_ms / 1000

    arithmetic_intensity = flops / bytes_accessed  # FLOPs/byte
    achieved_tflops = flops / time_s / 1e12
    achieved_bw_tb_s = bytes_accessed / time_s / 1e12

    # Roofline bound
    roofline_tflops = min(gpu_peak_tflops,
                          gpu_peak_bw_tb_s * 1e12 * arithmetic_intensity / 1e12)

    compute_utilization = achieved_tflops / gpu_peak_tflops * 100
    bandwidth_utilization = achieved_bw_tb_s / gpu_peak_bw_tb_s * 100
    roofline_utilization = achieved_tflops / roofline_tflops * 100

    is_compute_bound = arithmetic_intensity > (gpu_peak_tflops / gpu_peak_bw_tb_s * 1e12)

    return {
        "arithmetic_intensity": arithmetic_intensity,
        "achieved_tflops": achieved_tflops,
        "achieved_bw_tb_s": achieved_bw_tb_s,
        "compute_utilization_pct": compute_utilization,
        "bandwidth_utilization_pct": bandwidth_utilization,
        "roofline_utilization_pct": roofline_utilization,
        "bound": "compute" if is_compute_bound else "memory",
    }
```

---

## GPU Hardware Specifications

### Compute and Memory

| GPU | FP16 Tensor (TFLOPS) | FP32 (TFLOPS) | HBM Capacity | HBM Bandwidth | L2 Cache |
|---|---|---|---|---|---|
| V100 (SXM2) | 125 | 15.7 | 32 GB | 900 GB/s | 6 MB |
| A100 (SXM) | 312 | 19.5 | 80 GB | 2.0 TB/s | 40 MB |
| H100 (SXM) | 989 | 67 | 80 GB | 3.35 TB/s | 50 MB |
| H200 (SXM) | 989 | 67 | 141 GB | 4.8 TB/s | 50 MB |

### Interconnect

| Interconnect | Bandwidth (bidirectional) | Latency | Use Case |
|---|---|---|---|
| NVLink 3.0 (A100) | 600 GB/s total | ~1 us | Intra-node tensor parallelism |
| NVLink 4.0 (H100) | 900 GB/s total | ~1 us | Intra-node tensor parallelism |
| PCIe Gen4 x16 | 32 GB/s | ~1-5 us | GPU-to-CPU, cross-socket |
| PCIe Gen5 x16 | 64 GB/s | ~1-5 us | GPU-to-CPU, cross-socket |
| InfiniBand HDR | 200 Gb/s (25 GB/s) | ~1-5 us | Inter-node |
| InfiniBand NDR | 400 Gb/s (50 GB/s) | ~1-5 us | Inter-node |

### GPU Memory Hierarchy

| Level | Capacity (A100) | Bandwidth (A100) | Latency | Scope |
|---|---|---|---|---|
| Registers | 256 KB/SM | ~19 TB/s | 0 cycles | Per-thread |
| Shared Memory / L1 | 164 KB/SM (configurable) | ~19 TB/s | ~20-30 cycles | Per-block |
| L2 Cache | 40 MB | ~5 TB/s | ~200 cycles | Chip-wide |
| HBM | 80 GB | 2.0 TB/s | ~400-600 cycles | Global |

---

## Common Commands

### Environment Setup

```bash
# Check CUDA version
nvcc --version
nvidia-smi  # Shows driver and max supported CUDA version

# Check PyTorch CUDA support
python -c "import torch; print(f'PyTorch: {torch.__version__}'); \
    print(f'CUDA: {torch.version.cuda}'); \
    print(f'cuDNN: {torch.backends.cudnn.version()}'); \
    print(f'GPU: {torch.cuda.get_device_name(0)}'); \
    print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB')"

# Check NCCL version
python -c "import torch; print(torch.cuda.nccl.version())"
```

### Distributed Training Launch

```bash
# Single-node, multi-GPU with torchrun
torchrun --nproc_per_node=4 train.py --config config.yaml

# Multi-node (run on each node)
torchrun --nproc_per_node=4 --nnodes=2 --node_rank=0 \
    --master_addr=node0 --master_port=29500 \
    train.py --config config.yaml

# With NCCL debugging (useful for debugging hangs)
NCCL_DEBUG=INFO NCCL_DEBUG_SUBSYS=ALL \
    torchrun --nproc_per_node=4 train.py

# Specify GPU visibility
CUDA_VISIBLE_DEVICES=0,1,2,3 torchrun --nproc_per_node=4 train.py
```

### GPU Management

```bash
# Set GPU power limit (reduces thermal throttling variance for benchmarking)
sudo nvidia-smi -pl 300  # 300W power limit

# Set persistence mode (avoids driver unload between runs)
sudo nvidia-smi -pm 1

# Reset GPU (clear errors, reset clocks)
sudo nvidia-smi --gpu-reset

# Set GPU clocks for consistent benchmarking
sudo nvidia-smi -lgc 1410  # Lock graphics clock to 1410 MHz (A100)

# Check NVLink topology
nvidia-smi topo -m
```

### Memory Debugging

```bash
# Monitor GPU memory in real time
watch -n 1 nvidia-smi

# Find processes using GPU memory
nvidia-smi --query-compute-apps=pid,process_name,used_gpu_memory --format=csv

# Profile peak memory with PyTorch
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True python train.py
```

---

## Performance Debugging Checklist

When your system is slower than expected, work through this checklist:

### 1. Is the GPU Actually Running?

```bash
nvidia-smi  # Check GPU utilization %
```

- If GPU utilization is low (<50%): likely a data loading, CPU preprocessing, or synchronization bottleneck
- If GPU utilization is high (>90%): the bottleneck is on the GPU

### 2. Are You Using Tensor Cores?

- Ensure matrix dimensions are multiples of 8 (FP16) or 16 (INT8)
- Ensure inputs are in FP16/BF16 (not FP32)
- Check Nsight Compute for Tensor Core pipe utilization

### 3. Is It Compute-Bound or Memory-Bound?

Compute the arithmetic intensity and check the roofline:
- **Memory-bound:** Optimize data reuse (tiling, fusion, caching)
- **Compute-bound:** Optimize compute utilization (occupancy, Tensor Cores, vectorization)

### 4. Check for Common Bottlenecks

| Symptom | Likely Cause | Fix |
|---|---|---|
| GPU util fluctuates rapidly | Data loading stalls | Increase num_workers, use pin_memory, prefetch |
| GPU util < 50% steady | CPU bottleneck | Profile CPU, offload preprocessing, use compiled transforms |
| Many tiny kernels in timeline | Kernel launch overhead | Use torch.compile, CUDA Graphs, or fuse operations |
| Large gaps between kernels | Synchronization or Python overhead | Reduce Python-side logic, use non-blocking operations |
| AllReduce dominates timeline | Communication bottleneck | Overlap communication, reduce gradients, use compression |
| High memory, low compute | Poor memory reuse | Add tiling, increase register usage, fuse operators |

### 5. Profile Before Optimizing

Never guess. Always profile:

1. **Nsight Systems** for the overall timeline (CPU/GPU interaction, communication)
2. **Nsight Compute** for specific slow kernels (utilization, stalls, memory patterns)
3. **PyTorch Profiler** for framework-level bottlenecks (operator breakdown, memory)

---

## Memory Estimation Formulas

### Model Memory

```
Parameters: P parameters * bytes_per_param
    FP32: 4 bytes/param
    FP16/BF16: 2 bytes/param
    INT8: 1 byte/param
    INT4: 0.5 bytes/param

Gradients: P parameters * bytes_per_grad (typically same as param precision)

Optimizer state (AdamW, FP32):
    First moment: P * 4 bytes
    Second moment: P * 4 bytes
    Master weights (if mixed precision): P * 4 bytes
    Total optimizer: P * 12 bytes (with mixed precision)
```

### Activation Memory (Transformer)

```
Per-layer activation memory (approximate, without activation checkpointing):
    = batch_size * seq_len * hidden_dim * (34 + 5 * num_heads * seq_len / hidden_dim) bytes
    Simplified: ~34 * b * s * h bytes per layer (for typical configs)

Total: num_layers * per_layer_activation

With activation checkpointing: ~sqrt(num_layers) * per_layer_activation
```

### KV Cache Memory (Inference)

```
Per-token KV cache:
    = 2 * num_layers * num_kv_heads * head_dim * bytes_per_element

Total KV cache:
    = batch_size * seq_len * 2 * num_layers * num_kv_heads * head_dim * bytes_per_element

Example (LLaMA-70B, FP16, batch=1, seq=4096):
    = 1 * 4096 * 2 * 80 * 8 * 128 * 2 bytes = ~13.4 GB
```

### Total Training Memory

```
Total = model_params + gradients + optimizer_state + activations + temporary_buffers

With ZeRO Stage 3 and N GPUs:
    Total per GPU = (model_params + gradients + optimizer_state) / N + activations + buffers
```

---

## Communication Cost Estimation

### Collective Operations (Ring Algorithm)

```
All-Reduce:    2 * (N-1)/N * data_size / bandwidth
All-Gather:    (N-1)/N * data_size / bandwidth
Reduce-Scatter: (N-1)/N * data_size / bandwidth
Broadcast:     data_size / bandwidth * log2(N)  (tree algorithm)
All-to-All:    (N-1)/N * data_size / bandwidth  (per-GPU data)
```

Where N = number of GPUs and bandwidth = interconnect bandwidth.

### Data Parallelism Communication

```
Per-step communication = All-Reduce of gradients = 2 * (N-1)/N * gradient_size

Gradient size = num_parameters * bytes_per_gradient

Example: 7B model, FP16 gradients, 8 GPUs, NVLink 900 GB/s:
    = 2 * (7/8) * 7e9 * 2 bytes / 900e9 bytes/sec = ~27 ms
```

### Tensor Parallelism Communication

```
Per-layer communication = 2 * All-Reduce (forward + backward)
    = 2 * 2 * (N-1)/N * activation_size

Activation size per layer = batch_size * seq_len * hidden_dim * bytes_per_element
```
