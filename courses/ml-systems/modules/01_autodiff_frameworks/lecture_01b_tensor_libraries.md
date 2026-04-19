# Lecture 01b: Tensor Libraries -- Storage, Strides, Views, and Memory Layout

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** how multidimensional tensors are stored in a flat, contiguous memory buffer using strides, offsets, and shape metadata.
2. **Distinguish** between row-major (C-order) and column-major (Fortran-order) memory layouts and their implications for cache performance.
3. **Determine** when a tensor operation returns a view (shared memory) vs. a copy, and predict the stride pattern of the resulting tensor.
4. **Derive** the memory access patterns for broadcasting and analyze their performance implications.
5. **Relate** memory alignment and SIMD vectorization constraints to tensor storage decisions in NumPy and PyTorch internals.

---

## 2. Motivation and Context

### 2.1 Historical Background

The design of tensor storage is rooted in the Fortran and C array conventions of the 1950s-1970s:

- **Fortran (1957)** used column-major order, optimized for the mathematical convention of iterating over rows within a column -- natural for matrix algebra where BLAS routines access columns contiguously.
- **C (1972)** used row-major order, where the last index varies fastest. This became the default in most systems programming.
- **NumPy (2005)** adopted C-order as the default but supports both layouts. Its stride-based storage model was inherited from its predecessor, Numeric (1995).
- **PyTorch (2017)** built its tensor library (ATen) on top of a similar abstraction, adding GPU memory management and autograd integration.
- **JAX (2018)** wraps XLA's `DeviceArray`, which uses a different internal representation optimized for compiler transformations.

### 2.2 Why This Matters for ML Systems

Tensor storage is not an abstraction you can ignore at the PhD level:

- **Performance**: A transposed matrix multiply can be 10x slower than a contiguous one if the memory access pattern causes cache thrashing. Understanding strides tells you when this will happen.
- **Correctness**: In-place operations on views can silently corrupt other tensors that share the same storage. This is a common source of autograd bugs.
- **Memory efficiency**: Views enable zero-copy reshaping, slicing, and transposing. Understanding when copies are unavoidable is essential for memory-constrained training.
- **Kernel design**: Writing efficient CUDA kernels or Triton programs requires knowing the physical memory layout of input tensors.

---

## 3. Tensor Storage Model

### 3.1 The Storage-View Separation

A tensor in PyTorch (and similarly in NumPy) consists of two parts:

1. **Storage**: A flat, one-dimensional, contiguous buffer of typed data in memory. For example, a `float32` storage of size 12 occupies 48 bytes.
2. **Tensor (view)**: Metadata that defines how to interpret the storage as a multidimensional array. This consists of:
   - `shape` (or `size`): a tuple of integers $(d_0, d_1, \ldots, d_{k-1})$
   - `strides`: a tuple of integers $(s_0, s_1, \ldots, s_{k-1})$
   - `storage_offset`: an integer (index into the storage where this tensor starts)
   - `dtype`: the data type of each element

**Definition 3.1 (Stride-based indexing).** The element at multi-dimensional index $(i_0, i_1, \ldots, i_{k-1})$ is located at flat storage offset:

$$\text{offset} = \text{storage\_offset} + \sum_{j=0}^{k-1} i_j \cdot s_j$$

This single formula governs all tensor indexing in PyTorch and NumPy.

### 3.2 Concrete Example

```python
import torch

x = torch.tensor([[1, 2, 3],
                   [4, 5, 6]], dtype=torch.float32)

print(x.shape)           # torch.Size([2, 3])
print(x.stride())        # (3, 1)
print(x.storage_offset()) # 0
print(x.is_contiguous())  # True
```

The storage contains `[1, 2, 3, 4, 5, 6]` in memory. To access `x[1, 2]`:

$$\text{offset} = 0 + 1 \times 3 + 2 \times 1 = 5 \implies \text{storage}[5] = 6 \quad \checkmark$$

### 3.3 Multiple Tensors Sharing Storage

```python
x = torch.arange(12).reshape(3, 4)
y = x[1:3, 1:3]  # a 2x2 slice

print(y.storage_offset())  # 5 (starts at x[1,1])
print(y.stride())           # (4, 1) — same strides as x
print(y.shape)              # torch.Size([2, 2])

# y and x share the same storage
print(y.storage().data_ptr() == x.storage().data_ptr())  # True
```

The slice `y` is a **view** of `x`. Modifying `y` modifies `x`:

```python
y[0, 0] = 99
print(x[1, 1])  # tensor(99)
```

---

## 4. Row-Major vs. Column-Major Layout

### 4.1 Definitions

For a matrix $A \in \mathbb{R}^{m \times n}$:

**Row-major (C-order):** Elements in the same row are contiguous in memory.

$$\text{strides} = (n, 1)$$

Memory layout: $A_{00}, A_{01}, \ldots, A_{0,n-1}, A_{10}, A_{11}, \ldots, A_{m-1,n-1}$

**Column-major (Fortran-order):** Elements in the same column are contiguous in memory.

$$\text{strides} = (1, m)$$

Memory layout: $A_{00}, A_{10}, \ldots, A_{m-1,0}, A_{01}, A_{11}, \ldots, A_{m-1,n-1}$

### 4.2 General Case: $k$-Dimensional Tensors

For a tensor with shape $(d_0, d_1, \ldots, d_{k-1})$:

**C-order strides:**

$$s_j = \prod_{\ell=j+1}^{k-1} d_\ell, \quad s_{k-1} = 1$$

The last index varies fastest. For shape $(2, 3, 4)$: strides = $(12, 4, 1)$.

**Fortran-order strides:**

$$s_0 = 1, \quad s_j = \prod_{\ell=0}^{j-1} d_\ell$$

The first index varies fastest. For shape $(2, 3, 4)$: strides = $(1, 2, 6)$.

### 4.3 Performance Implications

Modern CPUs access memory through a cache hierarchy (L1: ~4 cycles, L2: ~12 cycles, L3: ~40 cycles, DRAM: ~200 cycles). Cache lines are typically 64 bytes (16 floats). Sequential access patterns that traverse contiguous memory will enjoy:

1. **Spatial locality**: Accessing one element brings its neighbors into cache.
2. **Hardware prefetching**: The CPU detects sequential access patterns and prefetches the next cache line.

**Example: Matrix row sum vs. column sum:**

```python
import numpy as np
import time

A = np.random.randn(10000, 10000).astype(np.float32)  # C-order by default

# Row-wise sum: contiguous access (fast)
t0 = time.time()
row_sums = A.sum(axis=1)  # iterates along columns within each row
t_row = time.time() - t0

# Column-wise sum: strided access (slower)
t0 = time.time()
col_sums = A.sum(axis=0)  # iterates along rows within each column
t_col = time.time() - t0

# t_col is typically 2-5x slower than t_row for large matrices
```

For a C-order matrix, `A.sum(axis=1)` accesses elements sequentially in memory. `A.sum(axis=0)` jumps by `n` elements between accesses, causing cache misses.

### 4.4 BLAS and Layout Conventions

BLAS (Basic Linear Algebra Subprograms) was originally written for Fortran column-major arrays. When calling BLAS from C/Python with row-major data, there are two approaches:

1. **Transpose the problem**: $AB$ in row-major is equivalent to $B^\top A^\top$ in column-major (the result, read in column-major order, gives $(AB)^\top$ in column-major, which is $AB$ in row-major).
2. **Pass the layout flag**: Modern BLAS implementations (MKL, OpenBLAS, cuBLAS) accept a `CBLAS_ORDER` parameter.

NumPy and PyTorch handle this transparently, but understanding it is essential when writing custom CUDA kernels or interfacing with low-level libraries.

---

## 5. Views vs. Copies

### 5.1 View Operations (Zero-Copy)

A **view** is a tensor that shares the same underlying storage as another tensor, differing only in shape, strides, or offset. Views are free -- they allocate no new memory for data.

Common view operations in PyTorch:

| Operation | Example | Resulting strides |
|-----------|---------|-------------------|
| `reshape` (when possible) | `x.reshape(3, 4)` | Computed from new shape |
| `view` | `x.view(3, 4)` | Must be contiguous |
| `transpose` | `x.transpose(0, 1)` | Swaps stride entries |
| `permute` | `x.permute(2, 0, 1)` | Reorders strides |
| `expand` | `x.expand(3, 4)` | Sets stride to 0 for broadcast dims |
| `narrow` / slicing | `x[:, 1:3]` | Adjusts offset, keeps strides |
| `as_strided` | Custom stride manipulation | Arbitrary |

### 5.2 Transpose as a View

Transposing a matrix does not move any data. It simply swaps the strides:

```python
x = torch.arange(6).reshape(2, 3)
# x.stride() = (3, 1), contiguous

y = x.t()
# y.stride() = (1, 3), NOT contiguous
# y.is_contiguous() = False

# Same storage, same data pointer
assert x.data_ptr() == y.data_ptr()
```

The transposed tensor `y` is not contiguous: adjacent elements in a row of `y` are 3 apart in memory. If a kernel requires contiguous input, calling `y.contiguous()` forces a copy:

```python
z = y.contiguous()
# z.stride() = (3, 1), contiguous
# z.data_ptr() != x.data_ptr()  # new storage allocated
```

### 5.3 When reshape Requires a Copy

`reshape` tries to return a view but falls back to a copy when the desired shape is incompatible with the current strides. The rule is:

**Theorem 5.1 (Contiguity condition for views).** A tensor with shape $(d_0, \ldots, d_{k-1})$ and strides $(s_0, \ldots, s_{k-1})$ can be viewed as shape $(d'_0, \ldots, d'_{k'-1})$ without a copy if and only if the tensor is contiguous (or contiguous within merged dimensions). Formally, there exists a partition of the new dimensions into groups, each corresponding to a contiguous sub-block of the original dimensions.

```python
x = torch.arange(24).reshape(2, 3, 4)  # strides (12, 4, 1), contiguous
y = x.transpose(1, 2)                   # strides (12, 1, 4), NOT contiguous

# This works (view):
a = x.reshape(6, 4)   # merging dims 0 and 1, both contiguous

# This forces a copy:
b = y.reshape(6, 4)   # y is not contiguous, reshape copies
# Equivalently: b = y.contiguous().view(6, 4)
```

### 5.4 The `as_strided` Escape Hatch

PyTorch's `torch.as_strided` allows creating a tensor with arbitrary strides, enabling advanced patterns:

```python
# Sliding window view (1D convolution input)
x = torch.arange(10, dtype=torch.float32)
# Create overlapping windows of size 3
windows = x.as_strided(size=(8, 3), stride=(1, 1))
# windows[i] = [x[i], x[i+1], x[i+2]]
```

This is powerful but dangerous: invalid strides can read out-of-bounds memory. NumPy's `np.lib.stride_tricks.as_strided` has the same capability and the same risks.

---

## 6. Broadcasting

### 6.1 Broadcasting Rules

Broadcasting allows operations on tensors of different shapes by virtually expanding dimensions. The rules (shared by NumPy, PyTorch, JAX):

1. If tensors have different numbers of dimensions, prepend 1s to the shape of the smaller tensor.
2. Dimensions are compatible if they are equal, or one of them is 1.
3. The output shape takes the maximum along each dimension.

Example: adding shapes $(3, 1)$ and $(1, 4)$:
- Shapes are already aligned: $(3, 1)$ and $(1, 4)$.
- Dimension 0: $\max(3, 1) = 3$. Dimension 1: $\max(1, 4) = 4$.
- Result shape: $(3, 4)$.

### 6.2 Broadcasting as Zero-Stride Views

Broadcasting is implemented using **stride tricks**, not by copying data:

```python
x = torch.tensor([[1], [2], [3]])  # shape (3, 1)
print(x.stride())                   # (1, 1)

y = x.expand(3, 4)                  # shape (3, 4)
print(y.stride())                   # (1, 0)  <-- stride 0 along broadcast dim!
```

A stride of 0 means "reuse the same element regardless of the index along this dimension." The element at position $(i, j)$ maps to storage offset $i \times 1 + j \times 0 = i$. No new memory is allocated.

### 6.3 Performance Implications of Broadcasting

While broadcasting avoids allocating memory for the expanded tensor, the actual computation may still need to touch every element of the logically expanded tensor. Consider:

```python
A = torch.randn(1000, 1)     # shape (1000, 1)
B = torch.randn(1, 1000)     # shape (1, 1000)
C = A + B                    # shape (1000, 1000) — 10^6 elements
```

The inputs together have $2 \times 1000 = 2000$ elements, but the output has $10^6$ elements. Broadcasting can cause unexpected memory blowups in the output tensor. Furthermore, the kernel must handle non-contiguous access patterns (stride-0 dimensions), which can reduce vectorization efficiency.

### 6.4 Broadcasting and Gradient Computation

In autograd, broadcasting introduces implicit `sum` operations in the backward pass. If $C = A + B$ where $A$ has shape $(m, 1)$ and $B$ has shape $(1, n)$:

$$\frac{\partial \mathcal{L}}{\partial A} = \sum_{j=0}^{n-1} \frac{\partial \mathcal{L}}{\partial C_{:,j}} \in \mathbb{R}^{m \times 1}$$

$$\frac{\partial \mathcal{L}}{\partial B} = \sum_{i=0}^{m-1} \frac{\partial \mathcal{L}}{\partial C_{i,:}} \in \mathbb{R}^{1 \times n}$$

The backward pass must reduce (sum) the gradient along the dimensions that were broadcast. This is a common source of shape mismatches in custom autograd functions.

---

## 7. Memory Alignment and SIMD

### 7.1 Alignment Requirements

Modern processors use SIMD (Single Instruction, Multiple Data) instructions that operate on aligned vectors:

- **SSE**: 128-bit (4 floats), requires 16-byte alignment.
- **AVX2**: 256-bit (8 floats), requires 32-byte alignment.
- **AVX-512**: 512-bit (16 floats), requires 64-byte alignment.

Misaligned memory access either traps (on older architectures) or silently degrades performance (on modern x86, misaligned loads are ~2x slower than aligned loads for some instructions).

### 7.2 Allocator Alignment in Practice

- **NumPy**: Uses `posix_memalign` or equivalent, guaranteeing 64-byte alignment (since NumPy 1.20). This ensures AVX-512 compatibility.
- **PyTorch CPU**: The default allocator (`c10::alloc_cpu`) uses 64-byte alignment.
- **PyTorch CUDA**: `cudaMalloc` returns 256-byte aligned pointers. The caching allocator preserves this alignment for sub-allocations.

### 7.3 Padding for Alignment

When tensor dimensions are not multiples of the SIMD width, operations may need to handle "tail" elements with scalar instructions or masked vector instructions. Some libraries pad allocations:

```
Logical shape: (1000, 127)  — 127 is not a multiple of 16
Padded row:     128 floats   — pad to nearest AVX-512 width
Physical storage: 1000 * 128 = 128,000 floats
Wasted: 1000 floats (0.8%)
```

This is a minor overhead but can matter for large batch processing. PyTorch does not pad by default, but CUDA libraries like cuDNN may internally pad tensors for kernel efficiency.

---

## 8. PyTorch Tensor Internals

### 8.1 The C++ Object Model

A PyTorch tensor in C++ is represented by:

```
torch::Tensor (Python-visible object)
  └── c10::TensorImpl
        ├── c10::Storage
        │     ├── c10::StorageImpl
        │     │     ├── data_ptr (void*)         ← raw pointer to data
        │     │     ├── byte_size                 ← total bytes allocated
        │     │     └── allocator (c10::Allocator) ← CPU/CUDA/etc.
        │     └── ...
        ├── sizes_ (SmallVector<int64_t>)         ← shape
        ├── strides_ (SmallVector<int64_t>)       ← strides
        ├── storage_offset_ (int64_t)
        ├── dtype_ (c10::TypeMeta)
        ├── device_ (c10::Device)
        └── autograd_meta_ (AutogradMeta*)        ← grad_fn, etc.
```

`TensorImpl` is reference-counted. Multiple `Tensor` objects can point to the same `TensorImpl` (views), and multiple `TensorImpl` objects can share the same `Storage`.

### 8.2 Reference Counting

PyTorch uses intrusive reference counting (not Python's garbage collector) for tensor storage:

```cpp
// Simplified from c10/core/StorageImpl.h
class StorageImpl : public c10::intrusive_ptr_target {
  DataPtr data_ptr_;
  SymInt numel_;
  // Ref count inherited from intrusive_ptr_target
};
```

When the last reference to a storage is released, the allocator's `free` method is called. For CUDA tensors, this returns the memory to the caching allocator (not to CUDA), enabling fast reuse.

### 8.3 Contiguity Flags

PyTorch caches contiguity flags in `TensorImpl` to avoid recomputing them:

```cpp
// Simplified
bool is_contiguous_{false};        // C-order contiguity
bool is_channels_last_contiguous_{false};  // NHWC layout
```

These flags are invalidated when strides change. The `is_contiguous()` check is $O(1)$ -- not $O(k)$ -- due to caching, which matters when called millions of times during training.

---

## 9. Advanced: Channels-Last Memory Format

### 9.1 NCHW vs. NHWC

For 4D tensors (batch, channels, height, width), there are two common layouts:

- **NCHW** (PyTorch default): All spatial locations of one channel are contiguous.
  - Strides: $(C \cdot H \cdot W, \; H \cdot W, \; W, \; 1)$
- **NHWC** (channels-last): All channels at one spatial location are contiguous.
  - Strides: $(C \cdot H \cdot W, \; 1, \; W \cdot C, \; C)$

### 9.2 Why NHWC Matters

cuDNN and many GPU kernels prefer NHWC because:

1. **Vectorized channel access**: Convolution kernels often iterate over channels at a fixed spatial position. With NHWC, these channels are contiguous, enabling vectorized loads.
2. **Tensor Core utilization**: NVIDIA Tensor Cores operate on small matrix tiles. NHWC layout maps naturally to the tile dimensions.
3. **Intel oneDNN**: Similarly prefers channels-last for AVX-512 kernels.

```python
# Converting to channels-last in PyTorch
x = torch.randn(32, 64, 224, 224)  # NCHW
x = x.to(memory_format=torch.channels_last)  # NHWC
print(x.stride())  # (64*224*224, 1, 224*64, 64)
print(x.is_contiguous(memory_format=torch.channels_last))  # True
```

The performance difference can be 20-50% for convolution-heavy models on modern NVIDIA GPUs.

---

## Key Takeaways

1. Tensors are **views into flat storage buffers**, parameterized by shape, strides, and offset. The formula $\text{offset} = \text{storage\_offset} + \sum_j i_j s_j$ governs all indexing.
2. **Row-major vs. column-major** layout determines cache access patterns. Accessing elements contiguously in memory (along the fastest-varying index) exploits spatial locality and hardware prefetching.
3. **Views are free** (no data copy): transpose, reshape (when contiguous), slicing, and expand all return views. Understanding when copies are forced is essential for memory efficiency.
4. **Broadcasting** is implemented via zero-stride tricks but can cause unexpected memory blowups in output tensors and introduces implicit reductions in the backward pass.
5. **Memory alignment** (64 bytes for AVX-512) enables SIMD vectorization; misalignment silently degrades performance.
6. **Channels-last (NHWC)** layout can give 20-50% speedups for CNN training on GPUs by enabling vectorized channel access and Tensor Core utilization.

---

## Further Reading

1. **Harris, C.R. et al. (2020).** "Array programming with NumPy." *Nature* 585:357-362. Describes the design principles of NumPy's array model.
2. **PyTorch Internals Blog** (Edward Z. Yang). "PyTorch internals" (blog series). Deep dive into TensorImpl, Storage, and dispatch.
3. **Drepper, U. (2007).** "What Every Programmer Should Know About Memory." A foundational reference on cache hierarchies and memory access patterns.
4. **cuDNN Developer Guide, NVIDIA.** Sections on tensor format and layout preferences for convolution kernels.
5. **van der Walt, S. et al. (2011).** "The NumPy Array: A Structure for Efficient Numerical Computation." *Computing in Science & Engineering* 13(2):22-30.
6. **Lam, S.K. et al. (2015).** "Numba: A LLVM-based Python JIT Compiler." Discusses how stride information enables optimized code generation.
