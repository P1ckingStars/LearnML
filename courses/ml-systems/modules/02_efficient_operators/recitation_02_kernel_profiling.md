# Recitation 02: Kernel Profiling with Nsight and PyTorch Profiler

## Overview

This recitation is a hands-on walkthrough of GPU kernel profiling tools. You will learn to measure kernel execution time, memory bandwidth utilization, occupancy, and identify bottlenecks in ML workloads. We cover three tools: (1) PyTorch Profiler with TensorBoard, (2) NVIDIA Nsight Systems for system-level tracing, and (3) NVIDIA Nsight Compute for kernel-level analysis. Each section includes runnable code and guided interpretation of results.

---

## 1. PyTorch Profiler

### 1.1 Basic Usage

```python
import torch
import torch.nn as nn
from torch.profiler import profile, record_function, ProfilerActivity

# Define a simple model
model = nn.Sequential(
    nn.Linear(4096, 4096),
    nn.ReLU(),
    nn.Linear(4096, 4096),
    nn.ReLU(),
    nn.Linear(4096, 10),
).cuda()

x = torch.randn(256, 4096, device='cuda')

# Basic profiling
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    with record_function("forward_pass"):
        y = model(x)
    with record_function("backward_pass"):
        y.sum().backward()

# Print a table of the most time-consuming operations
print(prof.key_averages().table(sort_by="cuda_time_total", row_limit=20))
```

### 1.2 Reading the Output

The profiler table shows columns:

| Column | Meaning |
|--------|---------|
| `Name` | Operation name (e.g., `aten::mm`, `aten::relu`) |
| `Self CPU %` | Time spent in this op on CPU (excluding children) |
| `Self CUDA %` | Time spent in this op on GPU (excluding children) |
| `CUDA total` | Total GPU time including children |
| `# Calls` | Number of invocations |
| `Input Shapes` | Tensor dimensions |

**What to look for**:
- Which operations dominate CUDA time? (Usually `aten::mm` or `aten::addmm`)
- Are there many small kernels? (Indicates fusion opportunities)
- Is CPU time significant? (Indicates Python overhead or data loading bottleneck)

### 1.3 Profiling with TensorBoard

```python
from torch.profiler import schedule, tensorboard_trace_handler

# Profile with TensorBoard export
with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=schedule(
        wait=1,     # Skip first batch (warmup)
        warmup=1,   # Warmup profiler
        active=3,   # Profile 3 batches
        repeat=1,
    ),
    on_trace_ready=tensorboard_trace_handler('./log/profiler'),
    record_shapes=True,
    profile_memory=True,
    with_stack=True,
) as prof:
    for step in range(6):
        x = torch.randn(256, 4096, device='cuda')
        y = model(x)
        loss = y.sum()
        loss.backward()
        prof.step()  # Signal the profiler that a step is complete
```

Launch TensorBoard:
```bash
tensorboard --logdir=./log/profiler
```

Navigate to the "PyTorch Profiler" tab. Key views:
- **Overview**: High-level time breakdown (GPU utilization, step time)
- **Operator View**: Table of operators sorted by time
- **Trace View**: Timeline showing CPU and GPU activity, kernel launches, memory copies
- **Memory View**: GPU memory allocation over time

### 1.4 Identifying Bottlenecks: A Worked Example

```python
# Intentionally inefficient code: element-wise operations without fusion
def inefficient_gelu(x):
    """PyTorch computes this as 6 separate kernels."""
    return 0.5 * x * (1.0 + torch.tanh(
        (2.0 / torch.pi) ** 0.5 * (x + 0.044715 * x ** 3)
    ))

# Efficient: use the fused version
def efficient_gelu(x):
    """Single fused kernel."""
    return torch.nn.functional.gelu(x)

# Profile both
x = torch.randn(4096, 4096, device='cuda')

with profile(activities=[ProfilerActivity.CUDA]) as prof:
    with record_function("inefficient_gelu"):
        y1 = inefficient_gelu(x)
    torch.cuda.synchronize()
    with record_function("efficient_gelu"):
        y2 = efficient_gelu(x)
    torch.cuda.synchronize()

print(prof.key_averages(group_by_input_shape=True).table(
    sort_by="cuda_time_total", row_limit=20))
```

You will observe that `inefficient_gelu` launches ~6 kernels (pow, mul, add, tanh, add, mul) while `efficient_gelu` launches 1 kernel. The unfused version is 3--5x slower due to repeated HBM reads/writes.

---

## 2. NVIDIA Nsight Systems

### 2.1 What It Does

Nsight Systems provides a system-level view of GPU activity: kernel launches, memory copies, CPU-GPU synchronization, NCCL collectives, and more. It is the tool for understanding *what* your GPU is doing over time.

### 2.2 Collecting a Trace

```bash
# Profile a Python script
nsys profile \
    --trace=cuda,nvtx,osrt \
    --output=report \
    --force-overwrite=true \
    python train.py

# For more detail (including CUDA API calls)
nsys profile \
    --trace=cuda,nvtx,cudnn,cublas \
    --cuda-memory-usage=true \
    --output=report_detailed \
    python train.py
```

### 2.3 Adding NVTX Annotations

NVTX (NVIDIA Tools Extension) markers let you annotate your code with named ranges that appear in the Nsight timeline:

```python
import torch.cuda.nvtx as nvtx

def training_step(model, x, y_true, optimizer):
    nvtx.range_push("forward")
    y_pred = model(x)
    nvtx.range_pop()

    nvtx.range_push("loss")
    loss = nn.functional.cross_entropy(y_pred, y_true)
    nvtx.range_pop()

    nvtx.range_push("backward")
    loss.backward()
    nvtx.range_pop()

    nvtx.range_push("optimizer_step")
    optimizer.step()
    optimizer.zero_grad()
    nvtx.range_pop()

    return loss.item()
```

### 2.4 Reading the Nsight Systems Timeline

Open the `.nsys-rep` file in Nsight Systems GUI. Key rows:

- **CUDA HW**: Shows actual GPU kernel execution
- **CUDA API**: Shows CUDA API calls from the CPU (kernel launches, memcpy, synchronize)
- **NVTX**: Your custom annotations
- **cuBLAS / cuDNN**: Library-specific kernel names

**What to look for**:
1. **GPU idle gaps**: Periods where no kernel is running. Common causes: CPU bottleneck, synchronization, data loading.
2. **Kernel launch overhead**: Many small kernels with gaps between them. Solution: kernel fusion or CUDA graphs.
3. **Synchronization stalls**: `cudaDeviceSynchronize` or `cudaStreamSynchronize` calls that block the CPU.
4. **Memory copy bottlenecks**: Large `cudaMemcpy` calls between CPU and GPU.

### 2.5 Practical Exercise: Diagnosing a Slow Training Loop

```python
import torch
import torch.nn as nn
import time

model = nn.TransformerEncoderLayer(d_model=512, nhead=8, dim_feedforward=2048).cuda()
optimizer = torch.optim.Adam(model.parameters())

# Deliberately slow training loop
for step in range(100):
    nvtx.range_push(f"step_{step}")

    # Bug 1: Creating new tensors each iteration (CPU overhead)
    x = torch.randn(32, 128, 512, device='cuda')

    # Bug 2: Unnecessary synchronization
    torch.cuda.synchronize()

    y = model(x)
    loss = y.sum()
    loss.backward()

    # Bug 3: Printing loss every step (implicit sync)
    print(f"Step {step}, Loss: {loss.item():.4f}")

    optimizer.step()
    optimizer.zero_grad()

    nvtx.range_pop()
```

Profile with `nsys` and identify the three performance bugs in the timeline.

---

## 3. NVIDIA Nsight Compute

### 3.1 What It Does

Nsight Compute (`ncu`) is a kernel-level profiler. It runs a single kernel multiple times to collect detailed hardware performance counters: achieved occupancy, memory throughput, compute throughput, warp stall reasons, instruction mix, etc.

### 3.2 Collecting Metrics

```bash
# Profile the 5th GEMM kernel launched by the program
ncu --target-processes all \
    --set full \
    --kernel-name regex:gemm \
    --launch-skip 4 \
    --launch-count 1 \
    --output gemm_profile \
    python matmul_script.py

# Quick summary (no GUI needed)
ncu --set roofline \
    --kernel-name regex:gemm \
    --launch-count 1 \
    python matmul_script.py
```

### 3.3 Key Metrics to Examine

| Metric | What It Tells You | Target |
|--------|-------------------|--------|
| `sm__throughput.avg.pct_of_peak_sustained` | Compute utilization | >70% for compute-bound |
| `dram__throughput.avg.pct_of_peak_sustained` | HBM bandwidth utilization | >70% for memory-bound |
| `l1tex__throughput.avg.pct_of_peak_sustained` | L1/shared memory throughput | High for tiled kernels |
| `sm__warps_active.avg.pct_of_peak_sustained` | Achieved occupancy | >50% |
| `smsp__sass_average_data_bytes_per_sector_mem_global_op_ld` | Memory coalescing | 32 bytes (perfect) |
| `sm__inst_executed_pipe_tensor.avg.pct_of_peak_sustained` | Tensor Core utilization | >60% for GEMM |

### 3.4 The Roofline Chart

Nsight Compute generates a roofline chart showing where your kernel falls:

```
Throughput (FLOPS)
    ^
    |        . . . . . . . . Peak Compute ....
    |       /
    |      / <- Roofline
    |     /
    |    /
    |   /  X <- Your kernel
    |  /
    | / Peak BW slope
    |/
    +---------------------------------------------> Arithmetic Intensity
```

If your kernel is below the roofline:
- **Below the sloped part**: Memory-bound, not achieving peak bandwidth. Check coalescing, bank conflicts.
- **Below the flat part**: Compute-bound, not achieving peak FLOPS. Check occupancy, instruction mix, Tensor Core usage.

### 3.5 Worked Example: Profiling a Triton Matmul

```python
# matmul_profile.py
import torch
import triton
import triton.language as tl

@triton.jit
def matmul_kernel(a_ptr, b_ptr, c_ptr, M, N, K,
                  stride_am, stride_ak, stride_bk, stride_bn,
                  stride_cm, stride_cn,
                  BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr,
                  BLOCK_K: tl.constexpr):
    pid = tl.program_id(0)
    num_n = tl.cdiv(N, BLOCK_N)
    pid_m = pid // num_n
    pid_n = pid % num_n

    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)

    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak
    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn

    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
    for k in range(0, K, BLOCK_K):
        a = tl.load(a_ptrs, mask=(offs_m[:, None] < M) & (offs_k[None, :] < K))
        b = tl.load(b_ptrs, mask=(offs_k[:, None] < K) & (offs_n[None, :] < N))
        acc += tl.dot(a, b)
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk
        offs_k += BLOCK_K

    c = acc.to(tl.float16)
    offs_cm = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_cn = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    c_ptrs = c_ptr + offs_cm[:, None] * stride_cm + offs_cn[None, :] * stride_cn
    tl.store(c_ptrs, c, mask=(offs_cm[:, None] < M) & (offs_cn[None, :] < N))

M = N = K = 4096
a = torch.randn(M, K, device='cuda', dtype=torch.float16)
b = torch.randn(K, N, device='cuda', dtype=torch.float16)
c = torch.empty(M, N, device='cuda', dtype=torch.float16)

grid = (triton.cdiv(M, 128) * triton.cdiv(N, 128),)
matmul_kernel[grid](a, b, c, M, N, K,
                    a.stride(0), a.stride(1),
                    b.stride(0), b.stride(1),
                    c.stride(0), c.stride(1),
                    BLOCK_M=128, BLOCK_N=128, BLOCK_K=32)
torch.cuda.synchronize()
```

Profile with:
```bash
ncu --set full --kernel-name regex:matmul --launch-count 1 python matmul_profile.py
```

**Expected findings**:
- Tensor Core pipe throughput should be high (>50%)
- DRAM throughput should be moderate (we are compute-bound)
- Achieved occupancy may be limited by register usage

---

## 4. Comparing Implementations

### 4.1 Benchmark Framework

```python
import torch
import time
from contextlib import contextmanager

@contextmanager
def cuda_timer(label, n_iters=100, warmup=10):
    """Context manager for accurate CUDA timing."""
    # Warmup
    yield  # Run the code once for warmup setup
    torch.cuda.synchronize()

    start_events = [torch.cuda.Event(enable_timing=True) for _ in range(n_iters)]
    end_events = [torch.cuda.Event(enable_timing=True) for _ in range(n_iters)]

    for i in range(n_iters):
        start_events[i].record()
        yield  # This doesn't work as a simple context manager; see below
        end_events[i].record()

# Better approach: explicit benchmark function
def benchmark_fn(fn, *args, n_iters=100, warmup=10, **kwargs):
    """Benchmark a function with CUDA events."""
    # Warmup
    for _ in range(warmup):
        fn(*args, **kwargs)
    torch.cuda.synchronize()

    # Timed iterations
    start = torch.cuda.Event(enable_timing=True)
    end = torch.cuda.Event(enable_timing=True)

    start.record()
    for _ in range(n_iters):
        fn(*args, **kwargs)
    end.record()
    torch.cuda.synchronize()

    elapsed_ms = start.elapsed_time(end) / n_iters
    return elapsed_ms

# Usage
M = N = K = 4096
a = torch.randn(M, K, device='cuda', dtype=torch.float16)
b = torch.randn(K, N, device='cuda', dtype=torch.float16)

# Benchmark cuBLAS
cublas_ms = benchmark_fn(torch.mm, a, b)
cublas_tflops = 2 * M * N * K / (cublas_ms * 1e-3) / 1e12
print(f"cuBLAS: {cublas_ms:.3f} ms, {cublas_tflops:.1f} TFLOPS")

# Benchmark Triton matmul
triton_ms = benchmark_fn(matmul, a, b)  # Your Triton wrapper
triton_tflops = 2 * M * N * K / (triton_ms * 1e-3) / 1e12
print(f"Triton: {triton_ms:.3f} ms, {triton_tflops:.1f} TFLOPS")

print(f"Triton / cuBLAS: {cublas_ms / triton_ms:.1%}")
```

### 4.2 Memory Bandwidth Measurement

```python
def measure_bandwidth(size_mb=256, dtype=torch.float16):
    """Measure effective HBM bandwidth with a copy kernel."""
    n_elements = size_mb * 1024 * 1024 // (2 if dtype == torch.float16 else 4)
    src = torch.randn(n_elements, device='cuda', dtype=dtype)
    dst = torch.empty_like(src)

    ms = benchmark_fn(torch.copy_, dst, src, n_iters=200)
    bytes_transferred = 2 * n_elements * (2 if dtype == torch.float16 else 4)
    bandwidth_tb_s = bytes_transferred / (ms * 1e-3) / 1e12
    print(f"Effective HBM bandwidth: {bandwidth_tb_s:.2f} TB/s")
    return bandwidth_tb_s
```

---

## 5. Profiling Checklist

When profiling a new workload, follow this systematic approach:

### Step 1: High-Level Profiling (PyTorch Profiler)
- [ ] Identify which operators consume the most GPU time
- [ ] Check for unexpected CPU time (data loading, Python overhead)
- [ ] Count the number of kernel launches per training step

### Step 2: Timeline Analysis (Nsight Systems)
- [ ] Look for GPU idle gaps between kernels
- [ ] Check for unnecessary synchronization points
- [ ] Verify data loading overlaps with computation
- [ ] Identify opportunities for kernel fusion

### Step 3: Kernel-Level Analysis (Nsight Compute)
- [ ] For the top 3--5 kernels by time:
  - [ ] Is it compute-bound or memory-bound? (Check roofline)
  - [ ] If memory-bound: what is the achieved bandwidth? Are loads coalesced?
  - [ ] If compute-bound: what is Tensor Core utilization? What is occupancy?
  - [ ] Are there warp stalls? What is the dominant stall reason?

### Step 4: Optimization
- [ ] Fuse memory-bound kernels (Triton or torch.compile)
- [ ] Increase tile sizes for compute-bound kernels
- [ ] Use CUDA graphs to reduce launch overhead
- [ ] Eliminate unnecessary synchronization

---

## 6. Common Pitfalls

### 6.1 Accidental Synchronization

```python
# These operations implicitly synchronize CPU and GPU:
loss.item()          # Copies scalar from GPU to CPU
print(tensor)        # Copies tensor to CPU for printing
tensor.cpu()         # Explicit copy to CPU
if tensor > 0:       # Boolean evaluation requires sync
```

Move these outside the critical path or reduce their frequency (e.g., log every 100 steps).

### 6.2 Misleading `time.time()` Measurements

```python
# WRONG: CPU timer doesn't wait for GPU
start = time.time()
y = model(x)
elapsed = time.time() - start  # Only measures kernel LAUNCH time

# RIGHT: Synchronize before measuring
torch.cuda.synchronize()
start = time.time()
y = model(x)
torch.cuda.synchronize()
elapsed = time.time() - start  # Measures actual GPU execution time

# BEST: Use CUDA events (no CPU synchronization overhead)
start_event = torch.cuda.Event(enable_timing=True)
end_event = torch.cuda.Event(enable_timing=True)
start_event.record()
y = model(x)
end_event.record()
torch.cuda.synchronize()
elapsed_ms = start_event.elapsed_time(end_event)
```

### 6.3 Profiler Overhead

Both Nsight Systems and Nsight Compute add overhead:
- Nsight Systems: 2--10% overhead (acceptable for most profiling)
- Nsight Compute: 10--100x slowdown (replays kernels to collect counters). Only profile one kernel at a time.

---

## 7. Exercises

### Exercise 1: Profile a Transformer Layer

Profile a single `nn.TransformerEncoderLayer` with `d_model=1024`, `nhead=16`, `batch_size=32`, `seq_len=512`. Using PyTorch Profiler:

1. What percentage of GPU time is spent in GEMM (`aten::mm`, `aten::addmm`, `aten::bmm`)?
2. What percentage is spent in element-wise operations (softmax, GELU, layer norm)?
3. What is the ratio of memory-bound to compute-bound kernel time?

### Exercise 2: Compare Attention Implementations

Benchmark three attention implementations for `batch=8, heads=32, seq_len=4096, d=128`:

```python
from torch.nn.functional import scaled_dot_product_attention

# 1. Manual (unfused) attention
def manual_attention(q, k, v):
    s = q @ k.transpose(-2, -1) / (q.size(-1) ** 0.5)
    p = torch.softmax(s, dim=-1)
    return p @ v

# 2. PyTorch SDPA (dispatches to Flash Attention or memory-efficient)
def sdpa_attention(q, k, v):
    return scaled_dot_product_attention(q, k, v)

# 3. PyTorch SDPA with Flash Attention backend forced
def flash_attention(q, k, v):
    with torch.backends.cuda.sdp_kernel(
        enable_flash=True, enable_math=False, enable_mem_efficient=False
    ):
        return scaled_dot_product_attention(q, k, v)
```

Report: (a) wall-clock time, (b) peak memory, (c) achieved TFLOPS for each.

### Exercise 3: Nsight Compute Deep Dive

Using `ncu`, profile the GEMM kernel from a `Linear(4096, 4096)` forward pass:

1. What is the achieved compute throughput as a percentage of peak?
2. What is the achieved memory bandwidth as a percentage of peak?
3. Based on the roofline chart, is the kernel compute-bound or memory-bound?
4. What is the Tensor Core utilization?
