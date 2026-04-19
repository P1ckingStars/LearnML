# Lecture 01d: Framework Internals -- PyTorch Dispatcher, JAX Tracing, Eager vs. Lazy Execution

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Describe** the PyTorch dispatcher architecture, including dispatch keys, the dispatch table, and the `__torch_function__` protocol for extensibility.
2. **Explain** JAX's functional transformation model (`jit`, `grad`, `vmap`) and how tracing converts Python functions into XLA HLO graphs.
3. **Compare** eager execution (PyTorch), static graph construction (TensorFlow 1.x), and tracing-based compilation (JAX, `torch.compile`) along the axes of debuggability, performance, and flexibility.
4. **Analyze** how autograd tapes are constructed and consumed under the hood, including the relationship between `grad_fn` nodes, the backward graph, and the Python/C++ boundary.
5. **Evaluate** the design trade-offs that led different frameworks to make different architectural choices.

---

## 2. Motivation and Context

### 2.1 Historical Background

The design of ML frameworks has gone through three distinct eras:

**Era 1: Define-and-run (2010-2016).** Theano and TensorFlow 1.x required users to first build a static computation graph, then execute it in a separate step. This enabled aggressive whole-graph optimization but made debugging painful -- Python stack traces did not correspond to graph operations.

```python
# TensorFlow 1.x style (define-and-run)
x = tf.placeholder(tf.float32, shape=[None, 784])
y = tf.matmul(x, W) + b
sess = tf.Session()
result = sess.run(y, feed_dict={x: data})  # execution happens here
```

**Era 2: Define-by-run / Eager (2015-present).** Chainer (2015), PyTorch (2016), and TensorFlow Eager (2017) let users write standard Python code that executes immediately. The computation graph is built on-the-fly as operations execute.

```python
# PyTorch style (define-by-run)
x = torch.randn(32, 784)
y = torch.matmul(x, W) + b  # executes immediately, builds graph dynamically
```

**Era 3: Tracing and compilation (2018-present).** JAX and `torch.compile` combine eager-like programming with compiler-based optimization. The user writes standard Python, which is traced into an intermediate representation and compiled.

```python
# JAX style (trace + compile)
@jax.jit
def f(x, W, b):
    return jax.numpy.dot(x, W) + b
# First call traces the function; subsequent calls execute compiled code
```

### 2.2 Why This Matters

The framework's execution model determines:
- **Developer productivity**: How easy is it to debug, prototype, and iterate?
- **Performance**: How much optimization can the system apply?
- **Extensibility**: How easily can users add new operators, dtypes, or devices?
- **Composability**: Can transformations (grad, vmap, jit) be nested arbitrarily?

Understanding these internals is essential for PhD-level work because you will inevitably need to extend or debug the framework itself.

---

## 3. PyTorch Dispatcher Architecture

### 3.1 The Central Problem

PyTorch supports a combinatorial explosion of tensor variants:
- Devices: CPU, CUDA, MPS, XPU, ...
- Dtypes: float32, float64, bfloat16, int8, ...
- Layouts: strided, sparse, MKL-DNN, ...
- Features: autograd, batching (vmap), tracing (torch.compile), ...

A single operator like `torch.add` must handle all valid combinations. The **dispatcher** is the mechanism that routes each call to the correct kernel.

### 3.2 Dispatch Keys

Each tensor carries a set of **dispatch keys** encoded as a bitset. Key categories include:

```
Backend keys (mutually exclusive):
  CPU, CUDA, MPS, XPU, Meta, ...

Feature keys (stackable):
  AutogradCPU, AutogradCUDA, ...  (autograd wrappers)
  FuncTorchBatched                 (vmap)
  FuncTorchGradWrapper             (functorch.grad)
  ProxyTorchDispatchMode           (torch.compile tracing)
  PythonDispatcher                 (__torch_function__)
  ...
```

### 3.3 Dispatch Table and Resolution

Each operator has a **dispatch table** mapping dispatch keys to kernel implementations:

```
torch.add dispatch table:
  CPU         → at::native::add_cpu(...)
  CUDA        → at::native::add_cuda(...)
  AutogradCPU → ADInplaceOrView::add(...)   [wraps CPU kernel with autograd]
  Meta        → at::native::add_meta(...)    [shape-only, no data]
  ...
```

When `torch.add(x, y)` is called, the dispatcher:

1. Computes the **combined dispatch key set** from all input tensors.
2. Selects the **highest priority** active dispatch key.
3. Looks up the corresponding kernel in the dispatch table.
4. Calls the kernel.

The priority ordering ensures that feature keys (autograd, vmap) wrap backend keys (CPU, CUDA). For example, if a tensor has both `CUDA` and `AutogradCUDA` keys, the autograd wrapper runs first, which internally re-dispatches to the CUDA kernel.

### 3.4 Dispatch Key Ordering Example

For `torch.add(x, y)` where `x` is a CUDA tensor with `requires_grad=True`:

```
Active keys: {CUDA, AutogradCUDA}
Priority: AutogradCUDA > CUDA

Step 1: Dispatch to AutogradCUDA kernel
  → Records add operation on autograd tape
  → Creates grad_fn node
  → Re-dispatches to CUDA kernel (with AutogradCUDA excluded)

Step 2: Dispatch to CUDA kernel
  → Launches CUDA kernel for elementwise addition
  → Returns result tensor
```

This layered dispatch is how PyTorch composes features orthogonally: each dispatch key handles one concern (autograd, batching, tracing) and delegates to the next layer.

### 3.5 The `__torch_function__` Protocol

Users can intercept any PyTorch operation at the Python level:

```python
class LoggingTensor:
    """A tensor wrapper that logs all operations."""

    def __init__(self, data):
        self._data = data

    @classmethod
    def __torch_function__(cls, func, types, args=(), kwargs=None):
        kwargs = kwargs or {}
        print(f"Called: {func.__name__}")

        # Unwrap LoggingTensor args
        def unwrap(x):
            return x._data if isinstance(x, LoggingTensor) else x
        args = tuple(unwrap(a) for a in args)
        kwargs = {k: unwrap(v) for k, v in kwargs.items()}

        result = func(*args, **kwargs)
        return LoggingTensor(result) if isinstance(result, torch.Tensor) else result

x = LoggingTensor(torch.randn(3))
y = LoggingTensor(torch.randn(3))
z = torch.add(x, y)  # prints "Called: add"
```

This protocol enables libraries like `torch.fx` (symbolic tracing) and `torch.distributions` (custom tensor subclasses) to hook into the dispatch mechanism.

### 3.6 `torch.library`: Registering Custom Operators

```python
import torch
from torch.library import Library, impl

# Define a new operator
my_lib = Library("myops", "DEF")
my_lib.define("my_add(Tensor x, Tensor y) -> Tensor")

# Register CPU implementation
@impl(my_lib, "my_add", "CPU")
def my_add_cpu(x, y):
    return x + y

# Register CUDA implementation
@impl(my_lib, "my_add", "CUDA")
def my_add_cuda(x, y):
    return x + y  # would use a custom CUDA kernel in practice

# Register autograd formula
@impl(my_lib, "my_add", "Autograd")
def my_add_autograd(x, y):
    # Use autograd.Function or decompose into existing differentiable ops
    return x + y

# Usage
x = torch.randn(3, device='cuda', requires_grad=True)
y = torch.randn(3, device='cuda', requires_grad=True)
z = torch.ops.myops.my_add(x, y)
```

---

## 4. JAX's Functional Transformation Model

### 4.1 Design Philosophy

JAX takes a radically different approach from PyTorch. Its core principles:

1. **Functions, not objects**: Transformations operate on pure functions, not on mutable tensor objects.
2. **Composable transformations**: `jit`, `grad`, `vmap`, and `pmap` can be nested in any order.
3. **Tracing, not taping**: JAX traces functions by running them with abstract (shape-only) inputs, producing a static graph (a jaxpr) that is then compiled.

### 4.2 Tracing Mechanism

When a JAX function is first called (or when `jax.make_jaxpr` is used explicitly), JAX:

1. Replaces concrete inputs with **abstract tracers** that carry only shape and dtype information.
2. Executes the Python function with these tracers. Each JAX operation records itself in a growing **jaxpr** (JAX expression) rather than computing numerical results.
3. The resulting jaxpr is a functional IR (intermediate representation) that captures the computation as a sequence of primitive operations.

```python
import jax
import jax.numpy as jnp

def f(x, y):
    return jnp.sin(x) + y * 2

# Inspect the traced representation
jaxpr = jax.make_jaxpr(f)(jnp.ones(3), jnp.ones(3))
print(jaxpr)
# { lambda ; a:f32[3] b:f32[3]. let
#     c:f32[3] = sin a
#     d:f32[3] = mul b 2.0
#     e:f32[3] = add c d
#   in (e,) }
```

### 4.3 The Jaxpr IR

A **jaxpr** (JAX expression) is a functional intermediate representation:

```
{ lambda ; <input_binders>. let
    <var> = <primitive> <args>
    ...
  in (<output_vars>,) }
```

Key properties:
- **Purely functional**: No mutation, no side effects. Every variable is bound exactly once (SSA form).
- **Typed**: Every variable has a known shape and dtype.
- **Closures**: A jaxpr can close over constants (captured at trace time).

### 4.4 Transformations as Jaxpr Interpreters

Each JAX transformation is implemented as a **jaxpr interpreter** -- a function that walks the jaxpr and produces a new jaxpr (or a result):

**`jax.grad`**: Transforms a jaxpr into a new jaxpr that computes the gradient. This is reverse-mode AD applied to the IR:
1. Run the forward jaxpr, saving intermediate values.
2. Generate a backward jaxpr that propagates adjoints.
3. Return a new function whose jaxpr is the composition.

**`jax.jit`**: Takes a jaxpr, lowers it to XLA HLO (High-Level Optimizer), and compiles it to optimized machine code for the target device (CPU/GPU/TPU).

**`jax.vmap`**: Transforms a jaxpr operating on single examples into one operating on batches. Each primitive's batching rule defines how to add a batch dimension.

### 4.5 Composability

Because transformations operate on jaxprs (not Python code), they compose cleanly:

```python
# Compose grad and jit
fast_grad = jax.jit(jax.grad(f))

# Compose vmap and grad (per-example gradients)
per_example_grad = jax.vmap(jax.grad(f))

# Second derivative
hessian_diag = jax.jit(jax.vmap(jax.grad(jax.grad(f))))
```

This composability is JAX's primary advantage over PyTorch's approach, where each feature (autograd, vmap via `torch.vmap`, compilation via `torch.compile`) was added as a separate system and their interactions required careful engineering (the dispatcher's layered design is how PyTorch achieves this).

### 4.6 Tracing Limitations

JAX's tracing model has sharp edges:

**Problem 1: Data-dependent control flow.**
```python
@jax.jit
def f(x):
    if x > 0:    # ERROR: x is a tracer, not a concrete value
        return x
    else:
        return -x
```

The tracer has no concrete value, so Python `if` cannot branch on it. Solutions:
- `jax.lax.cond(pred, true_fn, false_fn, operand)`: Traces both branches.
- `jax.lax.while_loop(cond_fn, body_fn, init_val)`: Traces a fixed loop body.

**Problem 2: Side effects.**
```python
@jax.jit
def f(x):
    print(x)      # Only prints the tracer repr, not the value
    log.append(x)  # Mutates external state -- only happens during tracing
    return x * 2
```

Side effects execute during tracing, not during each call. This is a fundamental consequence of the trace-then-compile model.

**Problem 3: Dynamic shapes.**
```python
@jax.jit
def f(x):
    return x[:x.shape[0]//2]  # shape depends on input -- triggers retrace
```

Each unique input shape causes a retrace and recompilation. JAX's `jax.jit` caches compiled functions keyed on input shapes.

---

## 5. Eager vs. Graph-Based vs. Tracing Execution

### 5.1 Taxonomy

| Property | Eager (PyTorch) | Static Graph (TF 1.x) | Tracing (JAX / torch.compile) |
|----------|----------------|----------------------|-------------------------------|
| Execution | Immediate | Deferred | Traced then compiled |
| Control flow | Python native | Graph primitives | Must use framework ops (JAX) or traced (torch.compile) |
| Debugging | `pdb`, print, etc. | Separate graph debugger | Print only at trace time |
| Optimization | Per-operator | Whole-graph | Whole-graph (on traced subgraph) |
| Dynamic shapes | Native | Explicit placeholders | Retrace or symbolic shapes |
| Startup cost | None | Graph build + optimize | First-call trace + compile |
| Steady-state perf | Lower (dispatch overhead) | Higher (optimized graph) | Highest (compiled + fused) |

### 5.2 Per-Operator Dispatch Overhead

In eager mode, every operation goes through the Python interpreter and the dispatcher:

```
Python: torch.add(x, y)
  → Python/C++ boundary (pybind11)
    → Dispatcher: resolve dispatch key
      → Autograd wrapper: record on tape
        → Re-dispatch to backend kernel
          → CUDA kernel launch
```

This overhead is typically 5-20 microseconds per operation. For large tensors (where the kernel runs for milliseconds), this is negligible. For small tensors or many operations, it becomes the bottleneck.

`torch.compile` eliminates this by fusing multiple operations into a single compiled kernel:

```python
@torch.compile
def f(x):
    return torch.relu(x + 1) * 2  # 3 ops fused into 1 kernel
```

### 5.3 torch.compile Architecture

`torch.compile` (PyTorch 2.0+) uses a three-stage pipeline:

```
Python code
    │
    ▼
TorchDynamo (graph capture)
    │  Bytecode analysis + tracing
    │  Handles control flow via "graph breaks"
    ▼
FX Graph (torch.fx IR)
    │
    ▼
Backend compiler (default: TorchInductor)
    │  Lowers to Triton (GPU) or C++ (CPU)
    │  Applies fusion, scheduling, tiling
    ▼
Compiled kernel
```

**TorchDynamo** is a Python bytecode analyzer that captures computation graphs by intercepting Python bytecode execution. Unlike JAX's tracing (which requires pure functions), TorchDynamo handles:
- Python control flow (by inserting "graph breaks" where control flow occurs).
- Mutations (by tracking which tensors are modified).
- Python objects (by partially evaluating Python code during tracing).

**TorchInductor** is the default compiler backend. It:
1. Receives an FX graph (a Python-level IR similar to jaxpr).
2. Lowers to a loop-level IR (Triton for GPU, C++/OpenMP for CPU).
3. Applies operator fusion, tiling, and memory planning.
4. Generates and caches compiled kernels.

### 5.4 Graph Breaks

When TorchDynamo encounters code it cannot trace (e.g., unsupported Python constructs, calls to non-PyTorch libraries), it inserts a **graph break**:

```python
@torch.compile
def f(x):
    y = torch.sin(x)      # ─┐ Graph 1
    z = y + 1              # ─┘
    print(z.shape)         # Graph break (side effect)
    w = z * 2              # ─┐ Graph 2
    return w               # ─┘
```

The function is split into two compiled subgraphs with Python execution in between. Each graph break reduces optimization opportunities (no fusion across the break) and adds dispatch overhead.

---

## 6. Autograd Tapes Under the Hood

### 6.1 The Backward Graph

When PyTorch executes a forward computation with `requires_grad=True`, it constructs a **backward graph** -- a DAG of `Node` objects (formerly called `Function` objects) that implement the backward pass.

```python
x = torch.randn(3, requires_grad=True)
y = x * 2
z = y + 3
loss = z.sum()

# Inspect the backward graph
print(loss.grad_fn)                    # SumBackward0
print(loss.grad_fn.next_functions)     # ((AddBackward0, 0),)
print(loss.grad_fn.next_functions[0][0].next_functions)  # ((MulBackward0, 0),)
```

The backward graph is the reverse of the forward graph: each `grad_fn` node knows its parents in the backward direction (i.e., the downstream nodes in the forward direction).

### 6.2 Node Structure

Each backward node (`torch::autograd::Node` in C++) contains:

```cpp
class Node {
  edge_list next_edges_;           // outgoing edges (to upstream grad_fns)
  uint64_t sequence_nr_;           // topological order (for scheduling)
  // Subclasses store saved tensors and metadata
  virtual variable_list apply(variable_list&& grads) = 0;  // backward computation
};
```

The `apply` method implements the backward computation: given incoming gradients, it returns outgoing gradients for each input.

### 6.3 Backward Execution Engine

`torch.autograd.backward` (or equivalently `loss.backward()`) runs the backward graph using a topological-sort-based engine:

```
Algorithm: Backward execution
1. Initialize priority queue Q with the root node (loss.grad_fn), grad = 1.0
2. While Q is not empty:
   a. Pop node with highest sequence_nr (ensures correct ordering)
   b. Call node.apply(accumulated_grads[node])
   c. For each output grad and corresponding next_edge:
      - Accumulate grad into accumulated_grads[next_node]
      - If all inputs to next_node have been processed, add to Q
3. For each leaf variable x with requires_grad=True:
   - x.grad += accumulated_grads[x.grad_fn]
```

The engine supports multi-threaded execution: independent branches of the backward graph can be processed in parallel by a thread pool.

### 6.4 Gradient Accumulation

For leaf tensors, gradients are **accumulated** (summed) across multiple backward passes:

```python
x = torch.randn(3, requires_grad=True)

# First backward
(x ** 2).sum().backward()
print(x.grad)  # 2 * x

# Second backward (accumulates!)
(x ** 3).sum().backward()
print(x.grad)  # 2 * x + 3 * x^2  (sum of both)

# Reset gradients
x.grad.zero_()
```

This accumulation behavior enables gradient accumulation over multiple mini-batches (for effective large batch training) but is also a common source of bugs when users forget to zero gradients.

### 6.5 `retain_graph` and Memory

By default, the backward graph is freed after `.backward()`:

```python
x = torch.randn(3, requires_grad=True)
y = x ** 2
loss = y.sum()

loss.backward()          # backward graph freed
loss.backward()          # ERROR: graph already freed

# To run backward twice:
loss.backward(retain_graph=True)  # graph preserved
loss.backward()                    # works, graph freed after this call
```

Retaining the graph keeps all intermediate tensors alive, which can cause memory issues. It is primarily needed for:
- Computing higher-order gradients (the backward graph itself needs gradients).
- Multiple backward passes with different upstream gradients.

---

## 7. Comparison: Autograd Approaches Across Frameworks

### 7.1 PyTorch: Tape-Based (Define-by-Run)

- **Mechanism**: Each forward operation appends a `grad_fn` node to the backward graph.
- **Control flow**: Handled natively -- the tape records whatever Python control flow was executed.
- **Pros**: Easy debugging, natural Python, dynamic shapes.
- **Cons**: Per-operator dispatch overhead, limited whole-graph optimization (without `torch.compile`).

### 7.2 JAX: Source-to-Source (Trace-Based)

- **Mechanism**: `jax.grad` transforms a jaxpr (traced function representation) into a new jaxpr that computes gradients.
- **Control flow**: Must use `jax.lax.cond`/`while_loop` for data-dependent flow.
- **Pros**: Clean composition with `jit`/`vmap`, whole-graph optimization, TPU support.
- **Cons**: Tracing limitations (no side effects, retracing for new shapes), steeper learning curve.

### 7.3 TensorFlow 2.x: Hybrid

- **Mechanism**: `tf.GradientTape` records operations eagerly (like PyTorch). `tf.function` traces into a graph (like JAX).
- **Control flow**: Python control flow in eager mode; `tf.cond`/`tf.while_loop` in `tf.function`.
- **Pros**: Flexibility to mix eager and graph modes.
- **Cons**: Two mental models, subtle behavioral differences between eager and `tf.function`.

### 7.4 Summary Table

| Feature | PyTorch | JAX | TF 2.x |
|---------|---------|-----|--------|
| AD mode | Reverse (tape) | Forward + Reverse (jaxpr) | Reverse (tape) |
| JVP support | Limited (`torch.autograd.forward_ad`) | Native (`jax.jvp`) | `tf.autodiff.ForwardAccumulator` |
| Higher-order grad | `create_graph=True` | `jax.grad(jax.grad(f))` | Nested `GradientTape` |
| `vmap` | `torch.vmap` (functorch) | `jax.vmap` (native) | `tf.vectorized_map` |
| Compilation | `torch.compile` (opt-in) | `jax.jit` (idiomatic) | `tf.function` (idiomatic) |

---

## 8. Design Trade-off Analysis

### 8.1 Debuggability vs. Performance

Eager mode maximizes debuggability at the cost of performance:
- You can set breakpoints, print intermediate values, and inspect shapes at any point.
- But every operation incurs Python overhead and cannot be fused with neighbors.

Tracing/compilation maximizes performance at the cost of debuggability:
- The compiled kernel has no Python-level breakpoints.
- Errors in traced code produce stack traces pointing to the tracer, not the user's code.

`torch.compile` attempts to bridge this gap: you write eager code and opt into compilation. When debugging, you remove the `@torch.compile` decorator and debug normally.

### 8.2 Flexibility vs. Optimization Potential

| Approach | Flexibility | Optimization |
|----------|-------------|--------------|
| Eager | Maximum (arbitrary Python) | Minimal (per-op) |
| Tracing (JAX) | Restricted (pure functions) | Maximum (whole-graph) |
| TorchDynamo | High (graph breaks at unsupported code) | Good (per-subgraph) |

JAX's restrictions enable powerful optimizations but require users to write code in a specific style. PyTorch's approach is more permissive but may produce suboptimal compiled code.

### 8.3 The Convergence Trend

Modern frameworks are converging:
- PyTorch added `torch.compile` (tracing) and `functorch` (functional transformations).
- JAX added `jax.debug.print` and `jax.debug.breakpoint` (debugging aids).
- TensorFlow added eager mode by default.
- All major frameworks now support both eager debugging and compiled execution.

The emerging consensus is: **write eagerly, execute compiled.** The framework should handle the translation automatically.

---

## Key Takeaways

1. The **PyTorch dispatcher** routes operations through a layered dispatch table keyed by dispatch keys (backend, autograd, vmap, tracing). This enables orthogonal composition of features.
2. **JAX's tracing model** converts Python functions into jaxprs (a functional IR) that can be transformed by composable interpreters (`grad`, `jit`, `vmap`). The trade-off is restrictions on side effects and data-dependent control flow.
3. **Eager execution** maximizes debuggability; **graph-based/compiled execution** maximizes performance. `torch.compile` bridges the gap with automatic graph capture via bytecode analysis.
4. Autograd tapes record **backward graph nodes** (`grad_fn`) during the forward pass. The backward engine traverses this graph in topological order, accumulating gradients.
5. The field is converging on a **"write eager, execute compiled"** paradigm, where the programmer writes natural Python and the framework handles optimization.

---

## Further Reading

1. **Paszke, A. et al. (2019).** "PyTorch: An Imperative Style, High-Performance Deep Learning Library." *NeurIPS*. Architecture overview.
2. **Frostig, R. et al. (2018).** "Compiling Machine Learning Programs via High-Level Tracing." *SysML*. The JAX design paper.
3. **Ansel, J. et al. (2024).** "PyTorch 2: Faster Machine Learning Through Dynamic Python Bytecode Transformation and Graph Compilation." *ASPLOS*. The `torch.compile` paper.
4. **Edward Z. Yang, "PyTorch Dispatcher"** (blog post, 2020). Detailed walkthrough of the dispatch mechanism.
5. **Bradbury, J. et al. (2018).** "JAX: Composable Transformations of Python+NumPy Programs." Software release and documentation.
6. **Abadi, M. et al. (2016).** "TensorFlow: A System for Large-Scale Machine Learning." *OSDI*. The original TensorFlow paper, for historical comparison.
7. **Sabne, A. (2020).** "XLA: Optimizing Compiler for Machine Learning." Google technical report. Describes the compilation backend shared by JAX and TensorFlow.
