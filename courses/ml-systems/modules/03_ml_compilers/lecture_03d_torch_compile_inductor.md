# Lecture 03d: torch.compile, Inductor, and JIT Compilation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** how TorchDynamo captures computation graphs from arbitrary Python code via bytecode analysis, and contrast this approach with tracing-based alternatives (torch.jit.trace, torch.fx.symbolic_trace).
2. **Construct** and transform FX graphs using the `torch.fx` IR, implementing custom optimization passes that operate on the symbolic graph.
3. **Analyze** how TorchInductor generates Triton GPU kernels and C++/OpenMP CPU kernels from FX graphs, including its fusion heuristics and memory planning.
4. **Select** appropriate `torch.compile` modes (`default`, `reduce-overhead`, `max-autotune`) based on workload characteristics and deployment constraints.
5. **Debug** compilation failures using `torch._dynamo` utilities, graph break analysis, and the `TORCH_LOGS` environment variable.

---

## 2. Motivation and Context

### 2.1 The Eager-Compiled Gap in PyTorch

PyTorch's success is built on eager execution: `y = model(x)` runs immediately, line by line, with full Python semantics. This makes debugging trivial -- set a breakpoint anywhere, inspect any tensor, change any control flow at runtime.

But eager execution leaves 30--60% of potential GPU performance on the table:

| Overhead Source | Cost |
|---|---|
| Python interpreter loop | ~10 us per op dispatch |
| Kernel launch overhead | ~5 us per CUDA kernel |
| No cross-op fusion | 2--3x extra memory traffic |
| No layout optimization | Up to 2x slower on Tensor Cores |
| No memory planning | Higher peak memory, more allocator calls |

For a transformer layer with ~50 operators, the Python overhead alone is ~750 us -- comparable to the actual GPU computation time at small batch sizes.

### 2.2 Prior Attempts at PyTorch Compilation

| System | Approach | Limitation |
|---|---|---|
| `torch.jit.trace` | Record tensor operations during one forward pass | Misses data-dependent control flow |
| `torch.jit.script` | Parse Python AST into TorchScript IR | Requires restricted Python subset |
| `torch.fx.symbolic_trace` | Proxy-based operator interception (wraps inputs in `Proxy` objects that record operations) | Cannot handle non-torch operations |
| LazyTensor (PyTorch/XLA) | Record-and-replay via lazy evaluation | Requires different programming model |

Each approach fails on real-world PyTorch code because Python is too dynamic: models use data-dependent control flow, third-party libraries, custom autograd functions, and Python-level abstractions (dataclasses, generators) that no prior system could handle comprehensively.

### 2.3 The torch.compile Solution

`torch.compile` (Ansel et al., 2024) takes a radically different approach: rather than requiring users to write in a restricted subset of Python, it intercepts the Python bytecode interpreter itself using **TorchDynamo**, captures the tensor operations it observes, compiles them, and falls back to Python for everything else.

```python
import torch

model = MyModel()
compiled_model = torch.compile(model)  # that's it

# Use exactly as before -- same API, same behavior
output = compiled_model(input_tensor)
```

---

## 3. TorchDynamo: Python Bytecode Capture

### 3.1 How TorchDynamo Works

TorchDynamo operates at the CPython bytecode level. When a compiled function is called, Dynamo:

1. **Intercepts** the function's frame using `PEP 523` frame evaluation hooks (CPython C API).
2. **Symbolically executes** the bytecodes, tracking which values are tensors.
3. **Records** tensor operations into an FX graph.
4. **Generates guard conditions** -- checks that must hold for the compiled code to be valid (e.g., input shapes have not changed).
5. **Emits** a compiled function that first checks guards, then runs the compiled graph.

```
┌──────────────────────────────────────────────────────┐
│  Python function f(x)                                │
│  (arbitrary Python code)                             │
└────────────────────┬─────────────────────────────────┘
                     │  PEP 523 frame hook
                     v
┌──────────────────────────────────────────────────────┐
│  TorchDynamo                                         │
│  - Symbolic execution of bytecodes                   │
│  - Track tensor variables                            │
│  - Record torch ops into FX graph                    │
│  - Generate guards (shape checks, type checks)       │
└──────┬──────────────────────────────────┬────────────┘
       │  Tensor ops                      │  Non-tensor ops
       v                                  v
┌─────────────────┐            ┌──────────────────────┐
│  FX Graph        │            │  Graph Break         │
│  (compilable)    │            │  (fall back to       │
│                  │            │   Python interpreter) │
└───────┬─────────┘            └──────────────────────┘
        │  Backend compiler
        v
┌─────────────────┐
│  Compiled code   │
│  (Triton/C++)    │
└─────────────────┘
```

### 3.2 Graph Breaks

When Dynamo encounters an operation it cannot capture (e.g., a call to `print()`, `pdb.set_trace()`, or an unsupported Python built-in), it inserts a **graph break**: it compiles everything captured so far, falls back to the Python interpreter for the uncapturable operation, and then resumes capturing.

```python
def f(x):
    y = x * 2           # captured in graph 1
    print(y.shape)       # graph break! (print is side-effecting)
    z = y + 1            # captured in graph 2
    return z

# Dynamo produces two compiled graphs with a Python call in between
```

**Impact of graph breaks.** Each graph break:
- Prevents fusion across the break point.
- Adds Python interpreter overhead.
- Prevents the compiler from seeing the full computation.

**Common causes of graph breaks and fixes:**

| Cause | Example | Fix |
|---|---|---|
| Python print/logging | `print(x.shape)` | Remove or guard with `if not torch.compiler.is_compiling()` |
| Data-dependent control flow | `if x.sum() > 0:` | Use `torch.cond()` |
| Unsupported Python built-in | `sorted(list_of_tensors)` | Use `torch.stack()` + `torch.sort()` |
| Tensor-to-Python conversion | `x.item()` | Restructure to keep tensors on device |
| Custom C extensions | `my_cuda_op(x)` | Wrap with `torch.library.custom_op` |

### 3.3 Guards

Dynamo generates **guard conditions** that must be satisfied for the compiled code to be reused. If any guard fails, Dynamo recompiles.

Typical guards:
- `type(x) == torch.Tensor`
- `x.dtype == torch.float32`
- `x.shape[0] == 32` (static) or `x.shape[0] >= 1` (dynamic)
- `x.device == cuda:0`
- `x.requires_grad == True`

**Static vs dynamic shapes.** By default, Dynamo treats shapes as static, recompiling for each new shape. With `torch.compile(dynamic=True)`, Dynamo generates symbolic shape guards and compiles once for a range of shapes:

```python
# Static (default): recompiles for every batch size
model_static = torch.compile(model)

# Dynamic: compiles once, works for any batch size
model_dynamic = torch.compile(model, dynamic=True)
```

Dynamic shapes introduce symbolic shape variables into the FX graph, which the backend must handle. Inductor supports this but with some performance cost (it cannot specialize tile sizes for a specific shape).

---

## 4. FX Graphs: The torch.fx IR

### 4.1 FX Graph Structure

The `torch.fx.Graph` is a Python-native IR that represents a computation as a list of `Node` objects, each representing an operation:

```python
import torch
import torch.fx

# Trace a simple function
def f(x, W, b):
    h = torch.matmul(x, W)
    h = h + b
    return torch.relu(h)

# Create an FX graph via symbolic tracing
graph_module = torch.fx.symbolic_trace(f)
print(graph_module.graph)
```

Output:
```
graph():
    %x : [num_users=1] = placeholder[target=x]
    %W : [num_users=1] = placeholder[target=W]
    %b : [num_users=1] = placeholder[target=b]
    %matmul : [num_users=1] = call_function[target=torch.matmul](args = (%x, %W))
    %add : [num_users=1] = call_function[target=operator.add](args = (%matmul, %b))
    %relu : [num_users=1] = call_function[target=torch.relu](args = (%add,))
    return relu
```

### 4.2 Node Types

| Node Type | Description | Example |
|---|---|---|
| `placeholder` | Function input | `%x = placeholder[target=x]` |
| `call_function` | Call to a free function | `torch.matmul(%x, %W)` |
| `call_method` | Call to a tensor method | `%x.view(...)` |
| `call_module` | Call to an `nn.Module` | `self.linear(%x)` |
| `get_attr` | Access a module attribute | `self.weight` |
| `output` | Function return value | `return %relu` |

### 4.3 FX Graph Manipulation

FX graphs are mutable Python objects -- you can add, remove, and replace nodes:

```python
import torch
import torch.fx
from torch.fx import Graph, Node

def fuse_add_relu(graph_module: torch.fx.GraphModule) -> torch.fx.GraphModule:
    """
    Custom optimization pass: replace add + relu patterns
    with a fused add_relu operation.
    """
    graph = graph_module.graph

    for node in list(graph.nodes):
        # Pattern: relu(add(x, y))
        if (node.op == 'call_function' and
            node.target == torch.relu and
            len(node.args) == 1):

            add_node = node.args[0]
            if (isinstance(add_node, Node) and
                add_node.op == 'call_function' and
                add_node.target == torch.add):

                # Replace with fused op
                with graph.inserting_before(node):
                    fused = graph.call_function(
                        torch.ops.aten.add_relu,    # fused ATen op
                        args=add_node.args,
                    )
                # Replace all uses of relu output with fused output
                node.replace_all_uses_with(fused)
                # Remove the old nodes (relu first, then add)
                graph.erase_node(node)
                if len(add_node.users) == 0:
                    graph.erase_node(add_node)

    graph.lint()  # verify graph integrity
    graph_module.recompile()
    return graph_module
```

### 4.4 The ATen Operator Set

After Dynamo captures the graph, it is **decomposed** into the ATen operator set -- PyTorch's core C++ operator library. This decomposition:

1. Replaces high-level ops with their ATen equivalents (e.g., `nn.functional.softmax` becomes a sequence of `aten.exp`, `aten.sum`, `aten.div`).
2. Handles autograd by decomposing backward-mode ops.
3. Normalizes the graph so the backend sees a uniform operator set.

The decomposition is controlled by **decomposition tables** that map composite ops to their primitive expansions. The core ATen operator set has ~2000 operators, but Inductor only needs to handle ~250 "core" operators.

---

## 5. TorchInductor: Code Generation

### 5.1 Architecture

TorchInductor is the default backend compiler for `torch.compile`. It takes an FX graph (in the ATen operator set) and generates:

- **Triton kernels** for GPU execution (element-wise, reductions, matmul epilogues).
- **C++/OpenMP code** for CPU execution.
- **Calls to cuBLAS/cuDNN** for compute-intensive ops (matmul, convolution).

```
┌───────────────────────────────────────────────────────┐
│  FX Graph (ATen operators)                            │
└────────────────────┬──────────────────────────────────┘
                     │  Inductor IR lowering
                     v
┌───────────────────────────────────────────────────────┐
│  Inductor IR                                          │
│  - Loops, loads, stores, reductions                   │
│  - Buffer management metadata                         │
└──────┬──────────────────────────────────┬─────────────┘
       │  GPU path                        │  CPU path
       v                                  v
┌──────────────┐                 ┌──────────────────┐
│ Fusion +     │                 │ Fusion +         │
│ Triton codegen│                │ C++ codegen      │
└──────┬───────┘                 └──────┬───────────┘
       v                                v
┌──────────────┐                 ┌──────────────────┐
│ Triton kernel │                │ C++ with OpenMP  │
│ (.py -> .ptx) │                │ (compiled with   │
│               │                │  gcc/clang)      │
└──────────────┘                 └──────────────────┘
```

### 5.2 Inductor IR

Inductor lowers the FX graph into its own IR, which is a loop-level representation:

```python
# Inductor IR for: y = relu(x + bias)
# (simplified pseudo-representation)

buf0 = Buffer(name="buf0", layout=FixedLayout(
    device=cuda:0, dtype=float32, size=[32, 256], stride=[256, 1]))

def inner_fn(index):
    i, j = index
    x_val = load("x", [i, j])          # load from input
    bias_val = load("bias", [j])        # load bias (broadcast over i)
    add_val = x_val + bias_val          # fused add
    relu_val = maximum(add_val, 0.0)    # fused relu
    return relu_val

store("buf0", inner_fn)                 # store result
```

This representation is similar to Halide's algorithm specification: it describes *what* to compute at each index, leaving the *how* (tiling, parallelism, vectorization) to the code generator.

### 5.3 Fusion in Inductor

Inductor's fusion algorithm is simpler than XLA's but highly effective for typical PyTorch workloads:

**Pointwise fusion.** Any chain of element-wise operations is fused into a single kernel. The inner functions are composed:

```python
# Before fusion: two separate kernels
# Kernel 1: buf0[i,j] = x[i,j] + bias[j]
# Kernel 2: buf1[i,j] = max(buf0[i,j], 0)

# After fusion: one kernel
# Kernel: buf1[i,j] = max(x[i,j] + bias[j], 0)
```

**Reduction fusion.** Element-wise operations before or after a reduction are fused into the reduction kernel.

**Matmul epilogue fusion.** Element-wise operations following a matmul are generated as Triton epilogue code, avoiding a separate kernel launch.

**Inductor's fusion heuristic** is conservative by design: it favors correctness and compilation speed over maximally aggressive fusion. This makes it faster to compile than TVM or XLA at the cost of sometimes missing fusion opportunities.

### 5.4 Triton Code Generation

For fused element-wise and reduction operations, Inductor generates Triton kernels. Triton (Tillet et al., 2019) is a language for writing GPU kernels at a higher level than CUDA, using block-level programming:

```python
# Generated Triton kernel for: y = relu(x @ W + b)
# (Inductor generates this automatically)

@triton.jit
def fused_add_relu_kernel(
    in_ptr0,    # x @ W result, shape [B, D]
    in_ptr1,    # bias, shape [D]
    out_ptr0,   # output, shape [B, D]
    xnumel,     # total number of elements
    XBLOCK: tl.constexpr,  # block size (tunable)
):
    xoffset = tl.program_id(0) * XBLOCK
    xindex = xoffset + tl.arange(0, XBLOCK)    # [XBLOCK]
    xmask = xindex < xnumel

    # Compute the bias index (column index)
    x1 = xindex % D   # broadcast dimension

    # Load and compute
    tmp0 = tl.load(in_ptr0 + xindex, xmask)      # load matmul result
    tmp1 = tl.load(in_ptr1 + x1, xmask)           # load bias (broadcast)
    tmp2 = tmp0 + tmp1                              # fused add
    tmp3 = tl.maximum(tmp2, 0.0)                    # fused relu

    tl.store(out_ptr0 + xindex, tmp3, xmask)       # store output
```

**Block size selection.** Inductor chooses the `XBLOCK` parameter via a simple heuristic: for element-wise kernels, it uses a 1D grid with `XBLOCK=1024` (the number of elements each Triton program instance processes, not the CUDA threads-per-block limit). Inductor may autotune this to other values (e.g., 512, 2048) depending on the workload. For 2D patterns (reductions over one axis), it uses a 2D grid with the reduction axis tiled to 256 elements.

### 5.5 C++ Code Generation (CPU Path)

For CPU execution, Inductor generates C++ code with OpenMP parallelism and vectorization hints:

```cpp
// Generated C++ for: y = relu(x + bias)
extern "C" void kernel(
    const float* __restrict__ in_ptr0,   // x, [B, D]
    const float* __restrict__ in_ptr1,   // bias, [D]
    float* __restrict__ out_ptr0,        // output, [B, D]
    long xnumel
) {
    #pragma omp parallel for schedule(static)
    for (long xindex = 0; xindex < xnumel; xindex++) {
        long x1 = xindex % D;
        float tmp0 = in_ptr0[xindex];
        float tmp1 = in_ptr1[x1];
        float tmp2 = tmp0 + tmp1;
        float tmp3 = std::max(tmp2, 0.0f);
        out_ptr0[xindex] = tmp3;
    }
}
```

This C++ code is compiled at runtime using `gcc` or `clang` and dynamically loaded.

---

## 6. Compilation Modes

### 6.1 Mode Comparison

`torch.compile` offers three compilation modes:

```python
# Mode 1: default -- balanced compilation time and performance
model_default = torch.compile(model, mode="default")

# Mode 2: reduce-overhead -- minimize CPU overhead (CUDA graphs)
model_fast = torch.compile(model, mode="reduce-overhead")

# Mode 3: max-autotune -- search for best kernel configurations
model_best = torch.compile(model, mode="max-autotune")
```

| Mode | Compilation Time | Runtime Perf | Memory | Best For |
|---|---|---|---|---|
| `default` | Fast (~seconds) | Good (1.3--1.6x) | Normal | Development, quick wins |
| `reduce-overhead` | Medium (~10s) | Better (1.5--1.8x) | Higher (CUDA graphs) | Inference, small batches |
| `max-autotune` | Slow (~minutes) | Best (1.6--2.0x) | Normal | Production deployment |

### 6.2 reduce-overhead Mode

This mode wraps the compiled graph in **CUDA graphs** -- a CUDA feature that records a sequence of kernel launches and replays them with minimal CPU involvement:

```
Normal execution:
  CPU: [launch kernel 1] [wait] [launch kernel 2] [wait] [launch kernel 3]
       ←─── 5us ──────→        ←─── 5us ──────→        ←─── 5us ──────→

CUDA graph replay:
  CPU: [replay entire graph]
       ←──── 5us ──────→   (all 3 kernels launched as one unit)
```

For models with many small kernels (e.g., transformer attention), this reduces CPU overhead from ~750 us to ~50 us.

**Constraints of CUDA graphs:**
- All tensor sizes must be static (no dynamic shapes).
- No CPU-GPU synchronization within the graph.
- Increased GPU memory usage (input/output buffers are pinned).

### 6.3 max-autotune Mode

This mode enables:
- **Triton autotuning**: For each generated Triton kernel, benchmark multiple block size configurations and select the fastest.
- **cuBLAS/cuDNN algorithm selection**: For matmul and convolution, benchmark all available algorithms (e.g., `CUBLAS_GEMM_ALGO0` through `CUBLAS_GEMM_ALGO23`) and select the fastest.
- **Coordinate descent tuning**: For some kernels, search over a space of implementation choices (e.g., number of warps, stages of software pipelining).

The autotuning results are cached in `~/.cache/torch/inductor/` and reused across runs (keyed by operation signature and GPU model).

---

## 7. Practical Usage Patterns

### 7.1 Basic Compilation

```python
import torch

# Compile an entire model
model = MyTransformer()
model = torch.compile(model)

# Compile a specific function
@torch.compile
def train_step(model, x, y, optimizer):
    loss = model(x, y)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
    return loss

# Compile with options
model = torch.compile(
    model,
    mode="max-autotune",
    dynamic=True,             # support variable batch sizes
    fullgraph=True,           # error if graph break occurs
)
```

### 7.2 Identifying and Fixing Graph Breaks

```python
import torch._dynamo as dynamo

# Explain mode: show what Dynamo captured and where breaks occur
explanation = dynamo.explain(model)(sample_input)
print(explanation)
# Output:
# Graph 1: 47 ops, 0 graph breaks
# or:
# Graph 1: 23 ops
#   Break reason: unsupported operation: print
# Graph 2: 24 ops

# Strict mode: raise an error on any graph break
model = torch.compile(model, fullgraph=True)
# RuntimeError if any graph break is encountered
```

### 7.3 Inspecting Generated Code

```python
import torch._inductor.config as inductor_config

# Save generated Triton/C++ code to disk for inspection
inductor_config.debug = True
# Code is saved to /tmp/torchinductor_{user}/

# Or use environment variables
# TORCH_LOGS="+output_code" python train.py

# View the FX graph
import torch._dynamo as dynamo
from torch.fx import GraphModule

@torch.compile(backend="eager")  # "eager" backend just captures the graph
def f(x):
    return torch.relu(x * 2 + 1)

# Access the captured graph
torch._dynamo.config.log_level = logging.DEBUG
f(torch.randn(10))
```

### 7.4 Common Integration Patterns

```python
# Pattern 1: Compile only the forward pass (useful during development)
model.forward = torch.compile(model.forward)

# Pattern 2: Compile the full training step
@torch.compile
def train_step(model, batch, optimizer):
    x, y = batch
    logits = model(x)                        # compiled forward
    loss = torch.nn.functional.cross_entropy(logits, y)
    loss.backward()                           # compiled backward
    optimizer.step()
    optimizer.zero_grad()
    return loss

# Pattern 3: Selective compilation (compile expensive parts only)
class HybridModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.backbone = torch.compile(ResNet50())    # compiled
        self.head = ClassificationHead()              # eager

    def forward(self, x):
        features = self.backbone(x)      # runs compiled
        return self.head(features)        # runs eager

# Pattern 4: Disable compilation for debugging
torch._dynamo.config.suppress_errors = True  # fall back silently on errors
# or
torch._dynamo.reset()  # clear all compiled code
```

### 7.5 Debugging Compilation Issues

```bash
# Environment variables for debugging
TORCH_LOGS="+dynamo"                  # Dynamo tracing logs
TORCH_LOGS="+inductor"               # Inductor compilation logs
TORCH_LOGS="+output_code"            # Generated Triton/C++ code
TORCH_LOGS="+graph_breaks"           # Graph break reasons
TORCH_LOGS="all"                     # Everything (very verbose)

# Minifier: automatically reduce a failing model to a minimal repro
TORCHDYNAMO_REPRO_AFTER="dynamo"     # minimize at Dynamo level
TORCHDYNAMO_REPRO_AFTER="aot"       # minimize at AOTAutograd level
```

```python
# Numerical accuracy debugging
torch._dynamo.config.cache_size_limit = 1  # disable caching to catch recompilation
torch._inductor.config.fallback_random = True  # match eager random behavior

# Performance debugging
import torch.utils.benchmark as benchmark

# Compare eager vs compiled
eager_time = benchmark.Timer(
    stmt="model(x)",
    globals={"model": model_eager, "x": x}
).blocked_autorange()

compiled_time = benchmark.Timer(
    stmt="model(x)",
    globals={"model": model_compiled, "x": x}
).blocked_autorange()

print(f"Eager: {eager_time.median * 1000:.2f} ms")
print(f"Compiled: {compiled_time.median * 1000:.2f} ms")
print(f"Speedup: {eager_time.median / compiled_time.median:.2f}x")
```

---

## 8. Under the Hood: AOTAutograd

### 8.1 The Compilation Pipeline in Detail

Between Dynamo and Inductor sits **AOTAutograd** (Ahead-of-Time Autograd), which captures both the forward and backward computation graphs:

```
Dynamo → FX Graph (forward only, high-level ops)
       → AOTAutograd decomposes into ATen ops
       → AOTAutograd traces the backward pass (using autograd)
       → Separate FX graphs for forward and backward
       → Inductor compiles both graphs
```

**Why AOTAutograd matters.** In eager PyTorch, the backward pass is constructed dynamically during the forward pass. AOTAutograd traces both passes ahead of time, enabling:

1. Fusion across forward and backward ops.
2. Memory planning that spans both passes.
3. Activation checkpointing integration.

### 8.2 Partitioning: What the Compiler Handles

AOTAutograd partitions the graph into:

- **Compiled subgraphs**: Element-wise ops, reductions, and fused patterns that Inductor generates Triton kernels for.
- **External calls**: Operations handled by optimized libraries (cuBLAS for matmul, cuDNN for convolution). These are not compiled by Inductor but are scheduled alongside compiled kernels.

The partitioning ensures that Inductor only generates code for operations where it can add value (fusion, memory optimization), while deferring to highly-optimized vendor libraries for compute-heavy operations.

### 8.3 Joint Graph Optimization

With both forward and backward graphs available, Inductor can optimize across the training step:

**Activation memory optimization.** Instead of saving all activations from the forward pass (for use in the backward pass), Inductor can:
- Recompute cheap activations (e.g., ReLU) instead of saving them.
- Fuse the recomputation into the backward kernel, eliminating memory overhead entirely.

**Buffer reuse across forward/backward.** Tensors that are consumed in the forward pass and not needed in the backward pass can have their buffers reused for backward-pass intermediates.

---

## 9. Performance Analysis: Where Does the Speedup Come From?

### 9.1 Breakdown for a Transformer Layer

Consider a single transformer self-attention + FFN block with $B=32, S=1024, d=1024, h=16$:

| Component | Eager (ms) | Compiled (ms) | Speedup | Source |
|---|---|---|---|---|
| QKV projection | 0.42 | 0.38 | 1.11x | cuBLAS algo selection |
| Attention scores | 0.35 | 0.28 | 1.25x | Triton kernel fusion |
| Softmax | 0.18 | 0.08 | 2.25x | Online softmax fusion |
| Attention output | 0.30 | 0.28 | 1.07x | cuBLAS (no change) |
| Output projection | 0.25 | 0.23 | 1.09x | cuBLAS algo selection |
| LayerNorm + residual | 0.15 | 0.05 | 3.00x | Full fusion (6 ops to 1 kernel) |
| FFN (2 linear + GELU) | 0.65 | 0.55 | 1.18x | GELU fusion, cuBLAS algo |
| Python overhead | 0.50 | 0.02 | 25.0x | Eliminated by compilation |
| **Total** | **2.80** | **1.87** | **1.50x** | |

**Key observations:**
- The largest relative speedups come from fusing element-wise chains (LayerNorm + residual: 3x) and eliminating Python overhead (25x).
- GEMM-dominated operations (projections) see modest improvement (~1.1x) since they are already handled by cuBLAS.
- Softmax benefits significantly from the online algorithm (2.25x).

### 9.2 When torch.compile Does Not Help

1. **GEMM-dominated models.** If >90% of runtime is in matmul/conv, compilation adds little because cuBLAS/cuDNN are already near-optimal.

2. **Highly dynamic models.** Models with data-dependent control flow (e.g., tree-structured networks, early exit) cause frequent graph breaks and recompilations.

3. **Very short-running models.** If total eager execution time is <1 ms, compilation overhead (~1-10 seconds) may never amortize.

4. **Models with many unique shapes.** Each unique shape triggers recompilation. Models that process variable-length sequences without padding incur high compilation overhead.

---

## 10. torch.compile in the Broader Ecosystem

### 10.1 Comparison with Other Compilation Approaches

| Feature | torch.compile | `jax.jit` (XLA) | TVM |
|---|---|---|---|
| Graph capture | Bytecode analysis | Tracing | External import |
| Dynamic shapes | Supported (opt-in) | Limited | Limited |
| Python compat | High (graph breaks) | Low (must be JAX-compatible) | N/A (no Python) |
| Compilation speed | Fast (seconds) | Medium (seconds) | Slow (minutes) |
| Peak GPU perf | Good (1.3--2.0x) | Good (1.5--2.0x) | Best after tuning (1.5--2.5x) |
| Hardware support | NVIDIA GPU, CPU | GPU, TPU, CPU | Many targets |
| Debugging | Rich tools | Moderate | Limited |

### 10.2 Future Directions

**Regional compilation.** Instead of compiling entire functions, compile only hot regions (identified via profiling). This reduces graph break impact and compilation time.

**Better dynamic shape support.** Symbolic shapes with range constraints, enabling compilation that is specialized to shape ranges rather than exact shapes.

**Custom backend integration.** The `torch.compile` backend API allows third parties to plug in custom compilers:

```python
# Custom backend example
def my_custom_backend(gm: torch.fx.GraphModule, example_inputs):
    """
    gm: the captured FX graph
    example_inputs: representative inputs for shape information
    returns: a callable that runs the compiled graph
    """
    # Your custom optimization / codegen here
    optimized_fn = my_compiler(gm, example_inputs)
    return optimized_fn

model = torch.compile(model, backend=my_custom_backend)
```

This extensibility means `torch.compile` is not just a compiler but a **compilation framework** -- the entry point for any PyTorch compilation effort.

---

## Key Takeaways

1. **TorchDynamo's bytecode-level capture** solves the graph capture problem for Python: it handles arbitrary Python code by inserting graph breaks where necessary, rather than requiring users to write in a restricted subset.

2. **FX graphs are Python-native and mutable**, making it easy to write custom optimization passes. This is a significant advantage over opaque IRs like HLO or Relay.

3. **TorchInductor generates Triton kernels** for fused operations and delegates compute-heavy operations (GEMM, convolution) to optimized vendor libraries. This division is pragmatic: generate code where you can add value, call libraries where you cannot.

4. **The choice of compilation mode** matters: `default` for development, `reduce-overhead` for inference with small batches, `max-autotune` for production deployment where compilation time is amortized.

5. **Graph breaks are the primary performance hazard.** Use `torch.compile(fullgraph=True)` during development to catch them early, and use `torch._dynamo.explain()` to diagnose them.

6. **torch.compile is not a black box.** The entire pipeline -- Dynamo, AOTAutograd, Inductor, generated Triton code -- is inspectable via logging, debug flags, and the FX graph API. Understanding the pipeline is essential for getting the most out of compilation.

---

## Further Reading

1. **Ansel, J., Yang, E., He, H., Gimelshein, N., Jain, A., Voznesensky, M., Bao, B., Bell, P., Berber, D., Burber, M., et al.** (2024). "PyTorch 2: Faster Machine Learning Through Dynamic Python Bytecode Transformation and Graph Compilation." *ASPLOS 2024*.
   - The definitive paper on torch.compile, TorchDynamo, and TorchInductor.

2. **Reed, J.** (2022). "TorchDynamo: An Experiment in Dynamic Python Bytecode Transformation." PyTorch Blog.
   - Accessible introduction to the Dynamo approach.

3. **Tillet, P., Kung, H. T., & Cox, D.** (2019). "Triton: An Intermediate Language and Compiler for Tiled Neural Network Computations." *MAPL 2019*.
   - The Triton programming model that Inductor targets for GPU code generation.

4. **PyTorch Documentation.** "torch.compile Tutorial." [pytorch.org/tutorials](https://pytorch.org/tutorials/intermediate/torch_compile_tutorial.html).
   - Official tutorial with practical examples and troubleshooting guidance.

5. **Sarofeen, C., Jain, P., Fang, A., et al.** (2022). "TorchInductor: A PyTorch Native Compiler." PyTorch Dev Discussions.
   - Technical deep dive into Inductor's architecture and design decisions.

6. **He, H., Ansel, J., & Renda, A.** (2023). "AOTAutograd: Ahead-of-Time Autograd for PyTorch 2.0." PyTorch Conference Talk.
   - How AOTAutograd captures the backward pass for joint optimization.

---

*Next: Recitation 03 -- Writing a Custom Compiler Pass*
