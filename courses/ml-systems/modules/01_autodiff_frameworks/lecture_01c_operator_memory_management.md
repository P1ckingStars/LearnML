# Lecture 01c: Operator Implementation and Memory Management

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Implement** custom forward and backward functions for tensor operators, correctly handling shape, dtype, and gradient accumulation.
2. **Analyze** the interaction between in-place operations and autograd, identifying when in-place modifications corrupt gradient computation.
3. **Describe** the architecture of PyTorch's CUDA caching allocator, including block splitting, coalescing, and stream-ordered allocation.
4. **Evaluate** memory fragmentation patterns in training workloads and apply strategies (memory pools, defragmentation, gradient checkpointing) to mitigate them.
5. **Trace** the lifecycle of a tensor from allocation through computation to garbage collection, identifying reference counting and deallocation paths.

---

## 2. Motivation and Context

### 2.1 Historical Background

Early neural network libraries (Theano, Caffe) had fixed sets of operators. Adding a new layer required modifying the framework source code. Modern frameworks introduced extensible operator interfaces:

- **Theano (2010)** introduced the `Op` class with `make_node`, `perform`, and `grad` methods. This was the first widely-used system where users could define custom differentiable operations.
- **TensorFlow (2015)** formalized operator registration through protobuf-based `OpDef` and C++ `OpKernel` classes.
- **PyTorch (2017)** simplified this dramatically with `torch.autograd.Function`, where users write `forward` and `backward` as Python methods. The C++ operator registration system (`TORCH_LIBRARY`) came later.
- **JAX (2018)** took a different approach: operators are defined as pure functions with explicit JVP and VJP rules registered via `jax.custom_jvp` and `jax.custom_vjp`.

Memory management has similarly evolved from simple `malloc`/`free` to sophisticated caching allocators that amortize the cost of GPU memory allocation (which can take milliseconds) across millions of short-lived tensor allocations during training.

### 2.2 Why This Matters

- **Correctness**: Incorrect backward implementations cause silent training failures. The gradient may be wrong in magnitude or direction, leading to models that fail to converge or converge to poor solutions.
- **Performance**: Memory allocation is often the bottleneck in training. A single `cudaMalloc` call can take 1-10 ms; a caching allocator reduces this to microseconds.
- **Scalability**: GPU memory is scarce (40-80 GB per device). Understanding memory management is essential for training large models.

---

## 3. Implementing Forward and Backward Functions

### 3.1 PyTorch's `autograd.Function`

The canonical way to define a custom differentiable operation in PyTorch:

```python
import torch
from torch.autograd import Function

class MyReLU(Function):
    @staticmethod
    def forward(ctx, input):
        """Compute ReLU and save data needed for backward."""
        ctx.save_for_backward(input)
        return input.clamp(min=0)

    @staticmethod
    def backward(ctx, grad_output):
        """Compute gradient of loss w.r.t. input."""
        input, = ctx.saved_tensors
        grad_input = grad_output.clone()
        grad_input[input < 0] = 0
        return grad_input

# Usage
x = torch.randn(3, requires_grad=True)
y = MyReLU.apply(x)
y.sum().backward()
print(x.grad)  # gradient of sum(relu(x)) w.r.t. x
```

### 3.2 The `ctx` Object and Saved Tensors

The `ctx` (context) object serves two purposes:

1. **`ctx.save_for_backward(*tensors)`**: Saves tensors needed for the backward pass. PyTorch tracks these specially: if an in-place operation modifies a saved tensor after the forward pass, PyTorch raises an error (version counter check).
2. **`ctx.needs_input_grad`**: A tuple of booleans indicating which inputs require gradients. This enables skipping unnecessary gradient computations.

**Critical rule:** Only use `save_for_backward` for tensors. For non-tensor data (integers, booleans, shapes), use `ctx.my_attr = value`.

### 3.3 Multi-Input, Multi-Output Operators

For operations with multiple inputs and outputs, `backward` must return one gradient per input:

```python
class LinearFunction(Function):
    @staticmethod
    def forward(ctx, input, weight, bias=None):
        ctx.save_for_backward(input, weight, bias)
        output = input.mm(weight.t())
        if bias is not None:
            output += bias.unsqueeze(0).expand_as(output)
        return output

    @staticmethod
    def backward(ctx, grad_output):
        input, weight, bias = ctx.saved_tensors
        grad_input = grad_weight = grad_bias = None

        if ctx.needs_input_grad[0]:
            grad_input = grad_output.mm(weight)
        if ctx.needs_input_grad[1]:
            grad_weight = grad_output.t().mm(input)
        if bias is not None and ctx.needs_input_grad[2]:
            grad_bias = grad_output.sum(0)

        return grad_input, grad_weight, grad_bias
```

### 3.4 Correctness: Gradient Checking

Always verify custom operators with numerical gradient checking:

```python
from torch.autograd import gradcheck

input = torch.randn(3, 4, dtype=torch.double, requires_grad=True)
weight = torch.randn(5, 4, dtype=torch.double, requires_grad=True)
bias = torch.randn(5, dtype=torch.double, requires_grad=True)

# gradcheck uses finite differences to verify backward
test = gradcheck(LinearFunction.apply, (input, weight, bias), eps=1e-6, atol=1e-4)
print(test)  # True if gradients match
```

**Important details:**
- Use `float64` for gradient checking. `float32` has insufficient precision for finite difference approximations.
- The finite difference approximation is: $\frac{\partial f}{\partial x_i} \approx \frac{f(x + \epsilon e_i) - f(x - \epsilon e_i)}{2\epsilon}$ with typical $\epsilon = 10^{-6}$.
- This costs $O(n)$ forward passes (one per input element), so test on small inputs.

### 3.5 Common Backward Implementation Pitfalls

**Pitfall 1: Forgetting to handle broadcasting.**

If the forward pass broadcasts, the backward pass must sum over broadcast dimensions:

```python
class BroadcastAdd(Function):
    @staticmethod
    def forward(ctx, a, b):
        ctx.a_shape = a.shape
        ctx.b_shape = b.shape
        return a + b  # may broadcast

    @staticmethod
    def backward(ctx, grad_output):
        # Reduce grad to match original shapes
        grad_a = _unbroadcast(grad_output, ctx.a_shape)
        grad_b = _unbroadcast(grad_output, ctx.b_shape)
        return grad_a, grad_b

def _unbroadcast(grad, shape):
    """Sum out dimensions that were broadcast."""
    while grad.dim() > len(shape):
        grad = grad.sum(0)
    for i, (gs, s) in enumerate(zip(grad.shape, shape)):
        if s == 1 and gs != 1:
            grad = grad.sum(i, keepdim=True)
    return grad
```

**Pitfall 2: Non-differentiable operations in backward.**

The backward function itself may need to be differentiable if you want higher-order gradients. Use `grad_output` directly without detaching it:

```python
# BAD: breaks higher-order gradients
def backward(ctx, grad_output):
    return grad_output.detach() * ctx.saved_tensors[0]

# GOOD: preserves computational graph for higher-order gradients
def backward(ctx, grad_output):
    return grad_output * ctx.saved_tensors[0]
```

**Pitfall 3: In-place modification of grad_output.**

Never modify `grad_output` in-place. It may be shared with other backward functions:

```python
# BAD: corrupts gradients of sibling nodes
def backward(ctx, grad_output):
    grad_output[ctx.saved_tensors[0] < 0] = 0  # in-place!
    return grad_output

# GOOD: clone first
def backward(ctx, grad_output):
    grad_input = grad_output.clone()
    grad_input[ctx.saved_tensors[0] < 0] = 0
    return grad_input
```

---

## 4. In-Place Operations and Autograd

### 4.1 The Problem

In-place operations modify a tensor's data without creating a new tensor. This is problematic for autograd because the backward pass needs the original values.

```python
x = torch.tensor([1.0, 2.0, 3.0], requires_grad=True)
y = x * 2      # y depends on x
y.add_(1)      # in-place modification of y

# Backward pass needs the OLD value of y (before add_)
# but it has been overwritten!
```

### 4.2 Version Counters

PyTorch tracks in-place modifications using **version counters**. Every tensor has an integer version that is incremented by every in-place operation:

```python
x = torch.randn(3, requires_grad=True)
print(x._version)  # 0

y = x * 2
print(y._version)  # 0

y.add_(1)
print(y._version)  # 1

# Now if we try to backward through y:
z = y.sum()
z.backward()  # RuntimeError: one of the variables needed for gradient
              # computation has been modified by an inplace operation
```

The `save_for_backward` mechanism records the version at save time. During `backward`, if the version has changed, PyTorch raises an error rather than silently computing wrong gradients.

### 4.3 When In-Place Is Safe

In-place operations are safe when:
1. The tensor is a **leaf** (no `grad_fn`) and no saved reference depends on it.
2. The tensor is used **after** the in-place modification and nothing needs the pre-modification value.
3. Gradient computation is not needed (`torch.no_grad()` context).

In practice, optimizers commonly use in-place operations inside `torch.no_grad()`:

```python
with torch.no_grad():
    param.add_(lr * param.grad)  # safe: no autograd tracking
```

### 4.4 Views and In-Place: A Dangerous Combination

Since views share storage, an in-place operation on a view modifies the base tensor:

```python
x = torch.randn(4, requires_grad=True)
y = x[:2]       # view of x
z = y ** 2
y.mul_(0)        # in-place on view — modifies x's storage!
z.sum().backward()  # Error: x was modified through view y
```

PyTorch's autograd tracks view relationships and detects this. The error message will reference the in-place operation on the view.

---

## 5. Memory Pools and Caching Allocators

### 5.1 The GPU Allocation Problem

GPU memory allocation via `cudaMalloc` is expensive:
- A single `cudaMalloc` call can take **1-10 milliseconds** (it involves a driver call and may trigger a page table update).
- During training, a single iteration may allocate and free **thousands** of temporary tensors.
- Naive `cudaMalloc`/`cudaFree` per tensor would make allocation the dominant cost.

### 5.2 PyTorch's CUDA Caching Allocator

PyTorch solves this with a **caching allocator** (`c10::cuda::CUDACachingAllocator`) that maintains a pool of pre-allocated GPU memory blocks.

**Architecture:**

```
┌─────────────────────────────────────────────────┐
│                  cudaMalloc pool                 │
│  ┌──────┐  ┌────────────┐  ┌──────┐  ┌───────┐ │
│  │Block │  │  Block     │  │Block │  │ Block  │ │
│  │512B  │  │  2MB       │  │ 1MB  │  │ 256KB │ │
│  │(free)│  │  (in use)  │  │(free)│  │(in use)│ │
│  └──────┘  └────────────┘  └──────┘  └───────┘ │
│                                                  │
│  Free list (organized by size):                  │
│    small_blocks: [512B, ...]                     │
│    large_blocks: [1MB, ...]                      │
└─────────────────────────────────────────────────┘
```

**Key operations:**

1. **Allocate**: Find the smallest free block that is >= requested size. If no suitable block exists, call `cudaMalloc` to get a new large segment (typically 2 MB or 20 MB, configurable via `PYTORCH_CUDA_ALLOC_CONF`).
2. **Split**: If the found block is much larger than needed, split it into two blocks: one for the allocation, one returned to the free list.
3. **Free**: Return the block to the free list (do NOT call `cudaFree`).
4. **Coalesce**: When a block is freed, check if adjacent blocks in the same segment are also free. If so, merge them into one larger block to reduce fragmentation.

### 5.3 Block Size Classes

The allocator uses two pools:

- **Small pool**: For allocations <= 1 MB. Segments are 2 MB.
- **Large pool**: For allocations > 1 MB. Segments are 20 MB.

Within each pool, blocks are organized by size for efficient best-fit lookup. The two-pool design prevents small allocations from fragmenting large contiguous regions.

### 5.4 Stream-Ordered Allocation

CUDA operations are asynchronous and organized in streams. The caching allocator respects stream ordering:

```python
s1 = torch.cuda.Stream()
s2 = torch.cuda.Stream()

with torch.cuda.stream(s1):
    a = torch.randn(1000, device='cuda')  # allocated on s1

with torch.cuda.stream(s2):
    b = torch.randn(1000, device='cuda')  # allocated on s2
    # b's memory cannot reuse a's block even if a is "freed"
    # because s2 has not synchronized with s1
```

When a tensor allocated on stream $s_1$ is freed, its block is only available for reuse by allocations on $s_1$ (or after explicit synchronization). This prevents use-after-free race conditions.

### 5.5 Inspecting Allocator State

```python
# Memory statistics
print(torch.cuda.memory_allocated())     # bytes currently in use
print(torch.cuda.memory_reserved())      # bytes held by caching allocator
print(torch.cuda.max_memory_allocated()) # peak usage

# Detailed snapshot
snapshot = torch.cuda.memory_snapshot()
# Returns list of segments with block-level details

# Force release all cached memory back to CUDA
torch.cuda.empty_cache()
# NOTE: This does NOT free memory used by live tensors.
# It only releases cached (free) blocks.
```

---

## 6. Garbage Collection and Tensor Lifecycle

### 6.1 Reference Counting

PyTorch tensors use a dual reference counting scheme:

1. **Python reference count** (via `sys.getrefcount`): Managed by Python's GC. When a Python tensor variable goes out of scope, its refcount drops.
2. **C++ intrusive reference count** (on `TensorImpl`): Managed by `c10::intrusive_ptr`. The C++ refcount is decremented when the Python wrapper is destroyed.

The tensor's storage is freed only when both:
- The C++ refcount reaches zero (no C++ references).
- This triggers the allocator's `free` method.

### 6.2 Autograd Graph and Memory

The autograd graph holds references to tensors saved for backward:

```python
x = torch.randn(1000, 1000, device='cuda', requires_grad=True)
y = x ** 2      # saves x for backward
z = y.sum()

# At this point, even if we delete y, x's storage is kept alive
# because the grad_fn for y (PowBackward) saved a reference to x.
del y  # y's storage is freed, but x is still referenced by grad_fn

z.backward()  # After backward, the autograd graph is released
              # Now x's saved reference in grad_fn is freed
```

This is why `torch.no_grad()` and `.detach()` are important for inference: they prevent the autograd graph from holding references to intermediate tensors.

### 6.3 Memory Leaks from Retained Graphs

A common memory leak pattern:

```python
# BAD: accumulating autograd graphs
losses = []
for batch in dataloader:
    loss = model(batch)
    losses.append(loss)  # loss has a grad_fn referencing the entire graph!

# GOOD: detach or convert to Python float
losses = []
for batch in dataloader:
    loss = model(batch)
    losses.append(loss.item())  # .item() returns a Python float, no graph ref
```

Each `loss` in the bad example holds a reference to the entire computation graph of that iteration, preventing any intermediate tensor from being freed.

---

## 7. Memory Fragmentation in Training

### 7.1 The Fragmentation Problem

Training workloads have a characteristic allocation pattern:

```
Forward pass:  alloc(a1), alloc(a2), alloc(a3), ..., alloc(aN)
Backward pass: free(aN), alloc(g_N), free(a_{N-1}), alloc(g_{N-1}), ...
Optimizer:     alloc(temp), free(temp), update in-place
```

The interleaved alloc/free pattern during the backward pass creates fragmentation: small free blocks scattered among allocated blocks, unable to satisfy large allocation requests even though the total free memory is sufficient.

### 7.2 Fragmentation Example

```
Memory: |AAAA|free|BBBB|free|CCCC|free|DDDD|

Total free: 3 blocks * 4 bytes = 12 bytes
Request: 10 contiguous bytes → FAILS (largest free block is 4 bytes)
```

### 7.3 Mitigation Strategies

**Strategy 1: Block coalescing.** The caching allocator merges adjacent free blocks:

```
Before: |AAAA|free|free|free|DDDD|
After:  |AAAA|   free (12B)  |DDDD|
```

This only helps when freed blocks are adjacent in physical memory.

**Strategy 2: Expandable segments (PyTorch 2.0+).** Instead of allocating one large segment upfront, the allocator can request additional segments from CUDA:

```bash
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

This reduces fragmentation by avoiding the need for one contiguous large allocation.

**Strategy 3: Memory-efficient operations.** Activation checkpointing trades compute for memory by not storing intermediate activations:

```python
from torch.utils.checkpoint import checkpoint

class MyModel(torch.nn.Module):
    def forward(self, x):
        # Checkpointed: activations of heavy_layer are recomputed
        # during backward instead of stored
        x = checkpoint(self.heavy_layer, x, use_reentrant=False)
        x = self.light_layer(x)
        return x
```

**Strategy 4: Careful allocation ordering.** Allocate long-lived tensors (parameters, optimizer states) first, before short-lived tensors (activations, gradients). This reduces interleaving in the memory pool.

---

## 8. Advanced: Memory Management for Large Models

### 8.1 Memory Budget Analysis

For a model with $P$ parameters in `float32`:

| Component | Memory |
|-----------|--------|
| Parameters | $4P$ bytes |
| Gradients | $4P$ bytes |
| Optimizer states (Adam) | $8P$ bytes (momentum + variance) |
| Activations | Depends on batch size, model architecture |
| **Total (excl. activations)** | **$16P$ bytes** |

For a 7B parameter model: $16 \times 7 \times 10^9 = 112$ GB just for parameters, gradients, and optimizer states. This exceeds the memory of a single A100 (80 GB), motivating distributed training and memory optimization techniques.

### 8.2 Mixed Precision and Memory

Mixed precision training (Micikevicius et al., 2018) stores:
- Parameters in `float32` (master copy) and `float16`/`bfloat16` (for computation).
- Gradients in `float16`/`bfloat16`.
- Optimizer states in `float32`.

Memory savings for a model with $P$ parameters:

| Component | FP32 | Mixed Precision |
|-----------|------|-----------------|
| Parameters | $4P$ | $4P + 2P = 6P$ |
| Gradients | $4P$ | $2P$ |
| Optimizer (Adam) | $8P$ | $8P$ |
| **Total** | **$16P$** | **$16P$** |

The total parameter-related memory is similar, but **activation memory** is halved (stored in `float16`), which is often the dominant cost for large batch sizes.

### 8.3 CPU Offloading

When GPU memory is insufficient, tensors can be offloaded to CPU memory:

```python
# ZeRO-Offload style: keep optimizer states on CPU
optimizer_state = {
    'momentum': torch.zeros(param.shape, device='cpu', pin_memory=True),
    'variance': torch.zeros(param.shape, device='cpu', pin_memory=True),
}

# During optimizer step:
# 1. Copy gradient to CPU (async)
# 2. Update on CPU
# 3. Copy updated parameter back to GPU
```

The key performance consideration is PCIe bandwidth (~32 GB/s for PCIe 4.0 x16). For this to be viable, the optimizer step must overlap with the next forward pass.

---

## 9. Operator Fusion and Memory Reduction

### 9.1 Why Fusion Helps Memory

Consider computing `y = relu(layernorm(x + bias))`:

Without fusion (3 separate kernels):
```
temp1 = x + bias          # allocate temp1
temp2 = layernorm(temp1)  # allocate temp2, free temp1
y = relu(temp2)           # allocate y, free temp2
Peak memory: 2 * sizeof(x) extra (temp1 and temp2 coexist briefly)
```

With fusion (1 kernel):
```
y = fused_relu_ln_add(x, bias)  # single allocation for y
Peak memory: 1 * sizeof(x) extra
```

Fusion eliminates intermediate allocations and also reduces memory bandwidth by keeping intermediate values in GPU registers or shared memory.

### 9.2 Torch.compile and Memory

`torch.compile` (PyTorch 2.0+) can automatically fuse operations:

```python
@torch.compile
def f(x, bias):
    return torch.relu(torch.layer_norm(x + bias, [x.shape[-1]]))

# The compiler (Inductor) may generate a single Triton kernel
# that computes the entire operation without intermediate tensors
```

The memory savings from fusion can be substantial for transformer models, where sequences of elementwise operations (layer norm, GELU, dropout) create many short-lived intermediate tensors.

---

## Key Takeaways

1. Custom operators require implementing both **forward and backward** functions. The backward must correctly handle broadcasting (unbroadcast gradients), avoid in-place modification of grad_output, and support higher-order gradients when needed.
2. **In-place operations** conflict with autograd because the backward pass needs original values. PyTorch's version counter mechanism detects this at runtime.
3. PyTorch's **CUDA caching allocator** avoids expensive `cudaMalloc` calls by maintaining a pool of reusable memory blocks, with block splitting, coalescing, and stream-ordered allocation.
4. **Memory fragmentation** from interleaved alloc/free during backward passes is a key challenge. Mitigation strategies include expandable segments, activation checkpointing, and careful allocation ordering.
5. For large models, the memory budget is dominated by **16P bytes** (parameters + gradients + optimizer states in float32), and activation memory scales with batch size. Mixed precision halves activation memory.
6. **Operator fusion** reduces both memory (eliminating intermediates) and bandwidth (keeping data in registers), making it a key optimization in modern ML compilers.

---

## Further Reading

1. **Paszke, A. et al. (2019).** "PyTorch: An Imperative Style, High-Performance Deep Learning Library." *NeurIPS*. The original PyTorch paper.
2. **Micikevicius, P. et al. (2018).** "Mixed Precision Training." *ICLR*. Foundation for memory-efficient training.
3. **Chen, T. et al. (2016).** "Training Deep Nets with Sublinear Memory Cost." arXiv:1604.06174. Gradient checkpointing theory.
4. **Rajbhandari, S. et al. (2020).** "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models." *SC20*. Memory partitioning across devices.
5. **PyTorch CUDA Caching Allocator internals** (`c10/cuda/CUDACachingAllocator.cpp`). The source code is well-commented and instructive.
6. **Steuwer, M. et al. (2017).** "Lift: A Functional Data-Parallel IR for High-Performance GPU Code Generation." *CGO*. Relates operator fusion to memory hierarchy.
