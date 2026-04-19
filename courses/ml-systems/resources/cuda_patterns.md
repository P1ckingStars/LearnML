# Idiomatic CUDA and Triton Patterns for ML Systems Research

Production-tested patterns for GPU kernel development in ML systems research. This guide covers both CUDA C++ and Triton (Python), with emphasis on the patterns most relevant to ML workloads.

---

## Table of Contents

1. [Triton Kernel Fundamentals](#triton-kernel-fundamentals)
2. [Tiled GEMM in Triton](#tiled-gemm-in-triton)
3. [Fused Operations in Triton](#fused-operations-in-triton)
4. [CUDA Kernel Fundamentals](#cuda-kernel-fundamentals)
5. [Shared Memory Patterns](#shared-memory-patterns)
6. [Memory Access Optimization](#memory-access-optimization)
7. [Reduction Patterns](#reduction-patterns)
8. [Autotuning](#autotuning)
9. [Correctness Validation](#correctness-validation)
10. [Integration with PyTorch](#integration-with-pytorch)
11. [Common Pitfalls](#common-pitfalls)

---

## Triton Kernel Fundamentals

Triton operates at the **block level**: each "program" (kernel instance) processes a tile of data. The compiler handles thread-level scheduling, shared memory management, and memory coalescing.

### Basic Element-Wise Kernel

```python
import torch
import triton
import triton.language as tl

@triton.jit
def add_kernel(
    x_ptr, y_ptr, output_ptr,
    n_elements,
    BLOCK_SIZE: tl.constexpr,
):
    """Element-wise addition.

    Key concepts:
    - tl.program_id(0): which block this program instance is processing
    - tl.arange: generate a range of offsets within the block
    - tl.load / tl.store: read/write from global memory with masking
    - mask: prevent out-of-bounds access for the last block
    """
    pid = tl.program_id(axis=0)
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)
    mask = offsets < n_elements

    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    output = x + y
    tl.store(output_ptr + offsets, output, mask=mask)

def add(x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    output = torch.empty_like(x)
    n_elements = output.numel()
    BLOCK_SIZE = 1024

    grid = (triton.cdiv(n_elements, BLOCK_SIZE),)
    add_kernel[grid](x, y, output, n_elements, BLOCK_SIZE=BLOCK_SIZE)
    return output
```

### 2D Block Processing

```python
@triton.jit
def softmax_kernel(
    input_ptr, output_ptr,
    n_rows, n_cols,
    input_row_stride,
    BLOCK_SIZE: tl.constexpr,
):
    """Row-wise softmax using online algorithm.

    Each program processes one row. The online algorithm computes
    softmax in a single pass without materializing the full row in memory.
    """
    row_idx = tl.program_id(0)
    row_start = row_idx * input_row_stride

    # Phase 1: Compute max for numerical stability
    col_offsets = tl.arange(0, BLOCK_SIZE)
    mask = col_offsets < n_cols
    row = tl.load(input_ptr + row_start + col_offsets, mask=mask, other=-float("inf"))
    row_max = tl.max(row, axis=0)

    # Phase 2: Compute exp and sum
    numerator = tl.exp(row - row_max)
    denominator = tl.sum(numerator, axis=0)

    # Phase 3: Normalize
    softmax_output = numerator / denominator
    tl.store(output_ptr + row_start + col_offsets, softmax_output, mask=mask)
```

---

## Tiled GEMM in Triton

### Basic Tiled Matrix Multiplication

```python
@triton.jit
def matmul_kernel(
    a_ptr, b_ptr, c_ptr,
    M, N, K,
    stride_am, stride_ak,
    stride_bk, stride_bn,
    stride_cm, stride_cn,
    BLOCK_M: tl.constexpr,
    BLOCK_N: tl.constexpr,
    BLOCK_K: tl.constexpr,
):
    """Tiled GEMM: C = A @ B.

    Tiling strategy:
    - Each program computes a BLOCK_M x BLOCK_N tile of C
    - The K dimension is processed in BLOCK_K chunks
    - Accumulation in FP32 for numerical stability
    """
    pid_m = tl.program_id(0)
    pid_n = tl.program_id(1)

    # Compute offsets for the output tile
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)

    # Pointers to first tiles of A and B
    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak
    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn

    # Accumulate in FP32
    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)

    for k in range(0, K, BLOCK_K):
        # Load tiles with boundary masking
        a_mask = (offs_m[:, None] < M) & ((k + offs_k[None, :]) < K)
        b_mask = ((k + offs_k[:, None]) < K) & (offs_n[None, :] < N)

        a = tl.load(a_ptrs, mask=a_mask, other=0.0)
        b = tl.load(b_ptrs, mask=b_mask, other=0.0)

        # Block-level matrix multiply (uses Tensor Cores if FP16)
        acc += tl.dot(a, b)

        # Advance pointers to next K tile
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk

    # Store result
    c_ptrs = c_ptr + offs_m[:, None] * stride_cm + offs_n[None, :] * stride_cn
    c_mask = (offs_m[:, None] < M) & (offs_n[None, :] < N)
    tl.store(c_ptrs, acc.to(tl.float16), mask=c_mask)

def matmul(a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
    assert a.shape[1] == b.shape[0]
    M, K = a.shape
    _, N = b.shape
    c = torch.empty((M, N), device=a.device, dtype=a.dtype)

    BLOCK_M, BLOCK_N, BLOCK_K = 128, 128, 32
    grid = (triton.cdiv(M, BLOCK_M), triton.cdiv(N, BLOCK_N))
    matmul_kernel[grid](
        a, b, c,
        M, N, K,
        a.stride(0), a.stride(1),
        b.stride(0), b.stride(1),
        c.stride(0), c.stride(1),
        BLOCK_M=BLOCK_M, BLOCK_N=BLOCK_N, BLOCK_K=BLOCK_K,
    )
    return c
```

### Swizzled Program ID for L2 Cache Locality

```python
@triton.jit
def matmul_kernel_swizzled(
    a_ptr, b_ptr, c_ptr,
    M, N, K,
    stride_am, stride_ak,
    stride_bk, stride_bn,
    stride_cm, stride_cn,
    BLOCK_M: tl.constexpr,
    BLOCK_N: tl.constexpr,
    BLOCK_K: tl.constexpr,
    GROUP_M: tl.constexpr,
):
    """GEMM with grouped program IDs for better L2 cache reuse.

    Instead of processing output tiles in row-major order, group
    tiles into super-tiles. Programs within a group access nearby
    rows of A and columns of B, increasing L2 cache hits.
    """
    pid = tl.program_id(0)
    num_pid_m = tl.cdiv(M, BLOCK_M)
    num_pid_n = tl.cdiv(N, BLOCK_N)

    # Swizzle: group programs to improve L2 locality
    num_pid_in_group = GROUP_M * num_pid_n
    group_id = pid // num_pid_in_group
    first_pid_m = group_id * GROUP_M
    group_size_m = min(num_pid_m - first_pid_m, GROUP_M)
    pid_m = first_pid_m + (pid % group_size_m)
    pid_n = (pid % num_pid_in_group) // group_size_m

    # Rest of kernel is identical to basic GEMM...
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = pid_n * BLOCK_N + tl.arange(0, BLOCK_N)
    offs_k = tl.arange(0, BLOCK_K)

    a_ptrs = a_ptr + offs_m[:, None] * stride_am + offs_k[None, :] * stride_ak
    b_ptrs = b_ptr + offs_k[:, None] * stride_bk + offs_n[None, :] * stride_bn

    acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
    for k in range(0, K, BLOCK_K):
        a = tl.load(a_ptrs, mask=(offs_m[:, None] < M) & ((k + offs_k[None, :]) < K), other=0.0)
        b = tl.load(b_ptrs, mask=((k + offs_k[:, None]) < K) & (offs_n[None, :] < N), other=0.0)
        acc += tl.dot(a, b)
        a_ptrs += BLOCK_K * stride_ak
        b_ptrs += BLOCK_K * stride_bk

    c_ptrs = c_ptr + offs_m[:, None] * stride_cm + offs_n[None, :] * stride_cn
    tl.store(c_ptrs, acc.to(tl.float16), mask=(offs_m[:, None] < M) & (offs_n[None, :] < N))
```

---

## Fused Operations in Triton

### Fused LayerNorm + Residual + Dropout

```python
@triton.jit
def fused_layernorm_residual_dropout_kernel(
    x_ptr, residual_ptr, weight_ptr, bias_ptr, output_ptr,
    n_rows, n_cols,
    stride,
    eps: tl.constexpr,
    dropout_p: tl.constexpr,
    seed,
    BLOCK_SIZE: tl.constexpr,
):
    """Fused LayerNorm(x + residual) with dropout.

    Fusing eliminates 3 intermediate tensor writes to HBM:
    1. residual add result
    2. normalized result
    3. dropout mask

    For a hidden_dim=4096 tensor, this saves ~32KB of HBM traffic per row.
    """
    row_idx = tl.program_id(0)
    row_start = row_idx * stride
    col_offsets = tl.arange(0, BLOCK_SIZE)
    mask = col_offsets < n_cols

    # Load x and residual, compute sum (fused residual add)
    x = tl.load(x_ptr + row_start + col_offsets, mask=mask, other=0.0)
    residual = tl.load(residual_ptr + row_start + col_offsets, mask=mask, other=0.0)
    x = x + residual

    # LayerNorm: compute mean and variance
    mean = tl.sum(x, axis=0) / n_cols
    x_centered = x - mean
    var = tl.sum(x_centered * x_centered, axis=0) / n_cols
    inv_std = 1.0 / tl.sqrt(var + eps)

    # Normalize and apply affine transform
    weight = tl.load(weight_ptr + col_offsets, mask=mask)
    bias = tl.load(bias_ptr + col_offsets, mask=mask)
    normed = x_centered * inv_std * weight + bias

    # Dropout (training only)
    if dropout_p > 0.0:
        random = tl.rand(seed, row_idx * BLOCK_SIZE + col_offsets)
        dropout_mask = random > dropout_p
        normed = tl.where(dropout_mask, normed / (1.0 - dropout_p), 0.0)

    tl.store(output_ptr + row_start + col_offsets, normed, mask=mask)
```

### Fused Attention Score Computation

```python
@triton.jit
def fused_attention_fwd_kernel(
    Q, K, V, Out,
    stride_qb, stride_qh, stride_qm, stride_qk,
    stride_kb, stride_kh, stride_kn, stride_kk,
    stride_vb, stride_vh, stride_vn, stride_vk,
    stride_ob, stride_oh, stride_om, stride_ok,
    N_CTX,
    BLOCK_M: tl.constexpr,
    BLOCK_N: tl.constexpr,
    BLOCK_K: tl.constexpr,
    IS_CAUSAL: tl.constexpr,
):
    """Simplified FlashAttention-style forward pass.

    Processes Q in tiles of BLOCK_M rows. For each Q tile,
    iterates over K/V in tiles of BLOCK_N, accumulating the
    attention output using the online softmax algorithm.

    This avoids materializing the N_CTX x N_CTX attention matrix.
    """
    pid_m = tl.program_id(0)
    off_b = tl.program_id(1) // tl.num_programs(1)  # batch index
    off_h = tl.program_id(1) % tl.num_programs(1)   # head index

    # Initialize pointers for this batch and head
    q_offset = off_b * stride_qb + off_h * stride_qh
    k_offset = off_b * stride_kb + off_h * stride_kh
    v_offset = off_b * stride_vb + off_h * stride_vh
    o_offset = off_b * stride_ob + off_h * stride_oh

    # Offsets for Q tile rows
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_k = tl.arange(0, BLOCK_K)

    # Initialize accumulators for online softmax
    m_i = tl.full([BLOCK_M], float("-inf"), dtype=tl.float32)  # running max
    l_i = tl.zeros([BLOCK_M], dtype=tl.float32)                # running sum of exp
    acc = tl.zeros([BLOCK_M, BLOCK_K], dtype=tl.float32)       # running output

    # Load Q tile (stays in SRAM for entire K/V iteration)
    q_ptrs = Q + q_offset + offs_m[:, None] * stride_qm + offs_k[None, :] * stride_qk
    q = tl.load(q_ptrs, mask=offs_m[:, None] < N_CTX)

    # Determine K/V iteration range
    if IS_CAUSAL:
        hi = min((pid_m + 1) * BLOCK_M, N_CTX)
    else:
        hi = N_CTX

    # Iterate over K/V tiles
    for start_n in range(0, hi, BLOCK_N):
        offs_n = start_n + tl.arange(0, BLOCK_N)

        # Load K tile and compute QK^T
        k_ptrs = K + k_offset + offs_n[None, :] * stride_kn + offs_k[:, None] * stride_kk
        k = tl.load(k_ptrs, mask=offs_n[None, :] < N_CTX)
        qk = tl.dot(q, k) * (BLOCK_K ** -0.5)  # Scale by 1/sqrt(d_k)

        # Apply causal mask
        if IS_CAUSAL:
            causal_mask = offs_m[:, None] >= offs_n[None, :]
            qk = tl.where(causal_mask, qk, float("-inf"))

        # Online softmax update
        m_ij = tl.max(qk, axis=1)
        m_new = tl.maximum(m_i, m_ij)
        alpha = tl.exp(m_i - m_new)
        p = tl.exp(qk - m_new[:, None])

        # Update running sum and rescale accumulator
        l_i = l_i * alpha + tl.sum(p, axis=1)
        acc = acc * alpha[:, None]

        # Load V tile and accumulate
        v_ptrs = V + v_offset + offs_n[:, None] * stride_vn + offs_k[None, :] * stride_vk
        v = tl.load(v_ptrs, mask=offs_n[:, None] < N_CTX)
        acc += tl.dot(p.to(v.dtype), v)

        m_i = m_new

    # Final normalization
    acc = acc / l_i[:, None]

    # Store output
    o_ptrs = Out + o_offset + offs_m[:, None] * stride_om + offs_k[None, :] * stride_ok
    tl.store(o_ptrs, acc.to(Out.dtype.element_ty), mask=offs_m[:, None] < N_CTX)
```

---

## CUDA Kernel Fundamentals

### Basic CUDA Kernel Pattern

```cpp
#include <cuda_runtime.h>
#include <cuda_fp16.h>

// Element-wise kernel: one thread per element
__global__ void vector_add_kernel(
    const float* __restrict__ a,
    const float* __restrict__ b,
    float* __restrict__ c,
    int n
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        c[idx] = a[idx] + b[idx];
    }
}

// Launch configuration
void vector_add(const float* a, const float* b, float* c, int n) {
    int block_size = 256;
    int grid_size = (n + block_size - 1) / block_size;
    vector_add_kernel<<<grid_size, block_size>>>(a, b, c, n);
}
```

### Vectorized Loads for Higher Bandwidth

```cpp
// float4 load: 128 bits per thread, 4x fewer transactions
__global__ void vector_add_vec4(
    const float4* __restrict__ a,
    const float4* __restrict__ b,
    float4* __restrict__ c,
    int n  // n is number of float4 elements
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        float4 va = a[idx];
        float4 vb = b[idx];
        c[idx] = make_float4(
            va.x + vb.x, va.y + vb.y,
            va.z + vb.z, va.w + vb.w
        );
    }
}
```

---

## Shared Memory Patterns

### Tiled Matrix Multiplication with Shared Memory

```cpp
#define TILE_SIZE 32

__global__ void matmul_tiled(
    const float* __restrict__ A,
    const float* __restrict__ B,
    float* __restrict__ C,
    int M, int N, int K
) {
    __shared__ float As[TILE_SIZE][TILE_SIZE];
    __shared__ float Bs[TILE_SIZE][TILE_SIZE];

    int row = blockIdx.y * TILE_SIZE + threadIdx.y;
    int col = blockIdx.x * TILE_SIZE + threadIdx.x;
    float acc = 0.0f;

    for (int tile = 0; tile < (K + TILE_SIZE - 1) / TILE_SIZE; tile++) {
        // Collaborative load: each thread loads one element of each tile
        int a_col = tile * TILE_SIZE + threadIdx.x;
        int b_row = tile * TILE_SIZE + threadIdx.y;

        As[threadIdx.y][threadIdx.x] = (row < M && a_col < K) ?
            A[row * K + a_col] : 0.0f;
        Bs[threadIdx.y][threadIdx.x] = (b_row < K && col < N) ?
            B[b_row * N + col] : 0.0f;

        __syncthreads();  // Ensure tile is fully loaded

        // Compute partial dot product from shared memory
        #pragma unroll
        for (int k = 0; k < TILE_SIZE; k++) {
            acc += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        }

        __syncthreads();  // Ensure computation is done before loading next tile
    }

    if (row < M && col < N) {
        C[row * N + col] = acc;
    }
}
```

### Avoiding Bank Conflicts

```cpp
// BAD: Column-major access to shared memory causes 32-way bank conflicts
__shared__ float smem[32][32];
float val = smem[threadIdx.x][threadIdx.y];  // All threads in a warp hit same bank

// GOOD: Add padding to avoid bank conflicts
__shared__ float smem[32][33];  // Extra column breaks the conflict pattern
float val = smem[threadIdx.x][threadIdx.y];  // Threads now access different banks

// GOOD: Swizzle access pattern
// XOR-based swizzle: row ^ col distributes accesses across banks
float val = smem[threadIdx.y][threadIdx.x ^ threadIdx.y];
```

---

## Reduction Patterns

### Warp-Level Reduction

```cpp
// Warp shuffle reduction (no shared memory needed within a warp)
__device__ float warp_reduce_sum(float val) {
    #pragma unroll
    for (int offset = 16; offset > 0; offset >>= 1) {
        val += __shfl_xor_sync(0xffffffff, val, offset);
    }
    return val;  // All threads in warp have the sum
}

// Block-level reduction using warp shuffles + shared memory
__device__ float block_reduce_sum(float val) {
    __shared__ float shared[32];  // One slot per warp

    int lane = threadIdx.x % 32;
    int warp_id = threadIdx.x / 32;

    // First reduce within each warp
    val = warp_reduce_sum(val);

    // Write warp results to shared memory
    if (lane == 0) shared[warp_id] = val;
    __syncthreads();

    // First warp reduces the warp results
    val = (threadIdx.x < blockDim.x / 32) ? shared[lane] : 0.0f;
    if (warp_id == 0) val = warp_reduce_sum(val);

    return val;  // Only thread 0 has the final result
}
```

### Online Softmax (Milakov-Gimelshein)

```cpp
// Numerically stable softmax in a single pass
// Avoids the need for a separate max-finding pass
__device__ void online_softmax(
    const float* input,
    float* output,
    int n
) {
    float m = -INFINITY;  // Running max
    float d = 0.0f;       // Running sum of exp(x - m)

    // Single pass: compute max and sum simultaneously
    for (int i = threadIdx.x; i < n; i += blockDim.x) {
        float x = input[i];
        float m_new = fmaxf(m, x);
        d = d * expf(m - m_new) + expf(x - m_new);
        m = m_new;
    }

    // Reduce across threads (warp/block level)
    // ... (reduction of (m, d) pairs using the same online algorithm)

    // Second pass: compute softmax values
    for (int i = threadIdx.x; i < n; i += blockDim.x) {
        output[i] = expf(input[i] - m) / d;
    }
}
```

---

## Autotuning

### Triton Autotuning

```python
@triton.autotune(
    configs=[
        triton.Config({"BLOCK_M": 128, "BLOCK_N": 128, "BLOCK_K": 32}, num_warps=4, num_stages=3),
        triton.Config({"BLOCK_M": 128, "BLOCK_N": 64, "BLOCK_K": 32}, num_warps=4, num_stages=4),
        triton.Config({"BLOCK_M": 64, "BLOCK_N": 128, "BLOCK_K": 32}, num_warps=4, num_stages=4),
        triton.Config({"BLOCK_M": 128, "BLOCK_N": 128, "BLOCK_K": 64}, num_warps=8, num_stages=3),
        triton.Config({"BLOCK_M": 64, "BLOCK_N": 64, "BLOCK_K": 32}, num_warps=4, num_stages=5),
        triton.Config({"BLOCK_M": 256, "BLOCK_N": 64, "BLOCK_K": 32}, num_warps=8, num_stages=3),
    ],
    key=["M", "N", "K"],  # Re-tune when these change
)
@triton.jit
def matmul_autotuned(
    a_ptr, b_ptr, c_ptr,
    M, N, K,
    stride_am, stride_ak,
    stride_bk, stride_bn,
    stride_cm, stride_cn,
    BLOCK_M: tl.constexpr,
    BLOCK_N: tl.constexpr,
    BLOCK_K: tl.constexpr,
):
    # Kernel body identical to basic GEMM above
    ...
```

### Key Autotuning Parameters

| Parameter | Effect | Guidance |
|---|---|---|
| **BLOCK_M, BLOCK_N** | Output tile size per program | Larger = more data reuse, fewer programs. Try 64-256. |
| **BLOCK_K** | Inner loop tile size | Larger = fewer loop iterations, more register pressure. Try 32-128. |
| **num_warps** | Warps per program (thread block size / 32) | More warps = higher occupancy but more register pressure. Try 4-8. |
| **num_stages** | Software pipeline stages | More stages = better latency hiding but more shared memory. Try 2-5. |

---

## Correctness Validation

### Numerical Comparison

```python
def validate_kernel(custom_fn, reference_fn, *args, atol=1e-2, rtol=1e-2):
    """Validate a custom kernel against a PyTorch reference.

    FP16 kernels: use atol=1e-2, rtol=1e-2
    FP32 kernels: use atol=1e-5, rtol=1e-5
    Attention kernels: compare softmax output, not just final output
    """
    custom_out = custom_fn(*args)
    ref_out = reference_fn(*args)

    # Check shapes match
    assert custom_out.shape == ref_out.shape, \
        f"Shape mismatch: {custom_out.shape} vs {ref_out.shape}"

    # Check for NaN/Inf
    assert not custom_out.isnan().any(), "NaN in custom kernel output"
    assert not custom_out.isinf().any(), "Inf in custom kernel output"

    # Numerical comparison
    max_abs_err = (custom_out - ref_out).abs().max().item()
    max_rel_err = ((custom_out - ref_out).abs() / (ref_out.abs() + 1e-8)).max().item()
    allclose = torch.allclose(custom_out, ref_out, atol=atol, rtol=rtol)

    print(f"Max absolute error: {max_abs_err:.2e}")
    print(f"Max relative error: {max_rel_err:.2e}")
    print(f"All close (atol={atol}, rtol={rtol}): {allclose}")

    if not allclose:
        # Find where the errors are largest
        diff = (custom_out - ref_out).abs()
        worst_idx = diff.argmax()
        print(f"Worst error at index {worst_idx}: "
              f"custom={custom_out.flatten()[worst_idx]:.6f}, "
              f"ref={ref_out.flatten()[worst_idx]:.6f}")

    return allclose
```

### Testing Edge Cases

```python
def test_edge_cases(kernel_fn, reference_fn):
    """Test kernel on edge cases that commonly expose bugs."""
    test_cases = [
        # Non-power-of-2 dimensions (tests masking)
        (torch.randn(17, 31, device="cuda", dtype=torch.float16), "non-power-of-2"),
        # Very small inputs (tests launch overhead, not correctness)
        (torch.randn(1, 1, device="cuda", dtype=torch.float16), "minimal"),
        # Large values (tests overflow in FP16)
        (torch.randn(256, 256, device="cuda", dtype=torch.float16) * 100, "large values"),
        # Zeros (tests division by zero in normalization)
        (torch.zeros(256, 256, device="cuda", dtype=torch.float16), "zeros"),
        # Negative values (tests correctness of exp, softmax, etc.)
        (torch.randn(256, 256, device="cuda", dtype=torch.float16) - 5, "negative"),
    ]

    for tensor, name in test_cases:
        try:
            passed = validate_kernel(kernel_fn, reference_fn, tensor)
            print(f"  {name}: {'PASS' if passed else 'FAIL'}")
        except Exception as e:
            print(f"  {name}: ERROR - {e}")
```

---

## Integration with PyTorch

### Custom Autograd Function with Triton Kernel

```python
class TritonLayerNorm(torch.autograd.Function):
    """Custom LayerNorm using Triton kernels for forward and backward.

    Wrap Triton kernels in autograd.Function to integrate with
    PyTorch's automatic differentiation system.
    """

    @staticmethod
    def forward(ctx, x, weight, bias, eps=1e-5):
        # Allocate output
        output = torch.empty_like(x)
        n_rows, n_cols = x.shape

        # Save for backward
        ctx.save_for_backward(x, weight, bias)
        ctx.eps = eps

        # Launch Triton kernel
        BLOCK_SIZE = triton.next_power_of_2(n_cols)
        layernorm_fwd_kernel[(n_rows,)](
            x, output, weight, bias,
            n_rows, n_cols,
            x.stride(0),
            eps,
            BLOCK_SIZE=BLOCK_SIZE,
        )
        return output

    @staticmethod
    def backward(ctx, grad_output):
        x, weight, bias = ctx.saved_tensors
        n_rows, n_cols = x.shape

        grad_x = torch.empty_like(x)
        grad_weight = torch.empty_like(weight)
        grad_bias = torch.empty_like(bias)

        BLOCK_SIZE = triton.next_power_of_2(n_cols)
        layernorm_bwd_kernel[(n_rows,)](
            grad_output, x, weight,
            grad_x, grad_weight, grad_bias,
            n_rows, n_cols,
            x.stride(0),
            ctx.eps,
            BLOCK_SIZE=BLOCK_SIZE,
        )
        return grad_x, grad_weight, grad_bias, None

# Usage: drop-in replacement for nn.LayerNorm in a model
def triton_layer_norm(x, weight, bias, eps=1e-5):
    return TritonLayerNorm.apply(x, weight, bias, eps)
```

### Registering as a torch.compile Custom Op

```python
# For torch.compile compatibility, register as a custom op
@torch.library.custom_op("mylib::triton_layernorm", mutates_args=())
def triton_layernorm(x: torch.Tensor, weight: torch.Tensor, bias: torch.Tensor) -> torch.Tensor:
    output = torch.empty_like(x)
    n_rows, n_cols = x.shape
    BLOCK_SIZE = triton.next_power_of_2(n_cols)
    layernorm_fwd_kernel[(n_rows,)](
        x, output, weight, bias, n_rows, n_cols, x.stride(0), 1e-5, BLOCK_SIZE=BLOCK_SIZE
    )
    return output

@triton_layernorm.register_fake
def _(x, weight, bias):
    return torch.empty_like(x)
```

---

## Common Pitfalls

### 1. Forgetting to Synchronize Before Timing

```python
# WRONG: CPU timer starts before GPU finishes previous work
start = time.time()
kernel_fn(x)
elapsed = time.time() - start  # Measures launch time, not kernel time

# RIGHT: Synchronize, then use CUDA events
torch.cuda.synchronize()
start = torch.cuda.Event(enable_timing=True)
end = torch.cuda.Event(enable_timing=True)
start.record()
kernel_fn(x)
end.record()
torch.cuda.synchronize()
elapsed_ms = start.elapsed_time(end)
```

### 2. Shared Memory Bank Conflicts in CUDA

```cpp
// BAD: stride-1 access along rows causes bank conflicts for column access
__shared__ float smem[32][32];
// When threads access smem[i][threadIdx.x], column access is fine
// When threads access smem[threadIdx.x][j], row access causes conflicts

// FIX: Pad shared memory
__shared__ float smem[32][33];  // 33 instead of 32
```

### 3. Incorrect Masking in Triton

```python
# BAD: Missing mask causes out-of-bounds reads (undefined behavior)
x = tl.load(x_ptr + offsets)  # No mask!

# GOOD: Always mask when offsets might exceed bounds
x = tl.load(x_ptr + offsets, mask=offsets < n_elements, other=0.0)
```

### 4. FP16 Accumulation Overflow

```python
# BAD: Accumulating dot products in FP16 causes overflow
acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float16)
acc += tl.dot(a, b)  # Each dot product can overflow FP16

# GOOD: Accumulate in FP32, convert at the end
acc = tl.zeros((BLOCK_M, BLOCK_N), dtype=tl.float32)
acc += tl.dot(a, b)  # tl.dot with FP16 inputs accumulates in FP32 by default
tl.store(output_ptr, acc.to(tl.float16))
```

### 5. Not Accounting for Triton JIT Compilation

```python
# First call to a Triton kernel triggers JIT compilation (~seconds)
# This must be excluded from benchmarks

# WRONG: Timing includes compilation
start = time.time()
result = my_triton_kernel(x)  # First call: compiles + runs
torch.cuda.synchronize()
print(f"Time: {time.time() - start}")  # Includes compilation time

# RIGHT: Warm up, then time
for _ in range(10):
    my_triton_kernel(x)  # Warmup: compilation happens on first call
torch.cuda.synchronize()
# Now benchmark properly...
```

### 6. Grid Dimension Mismatch

```python
# BAD: Grid does not cover all elements
grid = (N // BLOCK_SIZE,)  # Misses remainder elements when N % BLOCK_SIZE != 0

# GOOD: Ceiling division
grid = (triton.cdiv(N, BLOCK_SIZE),)  # Covers all elements; kernel uses mask for bounds
```
