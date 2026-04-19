# Lecture 03b: XLA, TVM, and the ML Compiler Stack

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Trace** the compilation pipeline of XLA from a JAX/TensorFlow program through HLO IR, optimization passes, and code generation to GPU/TPU executables.
2. **Contrast** the design philosophies of XLA (whole-program, closed-world) and TVM (modular, search-based) and articulate the trade-offs each entails.
3. **Explain** the MLIR framework's multi-level IR approach and how it addresses the $N \times M$ problem of connecting $N$ frontends to $M$ backends.
4. **Evaluate** the Relay IR's type system and TVM's auto-scheduling (Ansor) as mechanisms for achieving both generality and high performance.
5. **Compare** the major ML compiler stacks along dimensions of generality, peak performance, compilation time, and hardware coverage.

---

## 2. Motivation and Context

### 2.1 The ML Compiler Landscape

The proliferation of ML hardware (NVIDIA GPUs, Google TPUs, AMD GPUs, Intel Gaudi, custom ASICs) and ML frameworks (PyTorch, JAX, TensorFlow) creates a combinatorial problem: each framework-hardware pair requires optimized operator implementations and graph-level optimizations. Without compilers, this is an $O(N \times M)$ engineering effort.

ML compilers decouple the frontend (framework) from the backend (hardware) through intermediate representations. The key insight: most ML workloads share the same high-level structure (dense tensor operations, element-wise nonlinearities, reductions), so a well-designed IR can capture this structure and optimize it once for many targets.

### 2.2 Historical Arc

| Year | System | Contribution |
|---|---|---|
| 2017 | XLA | First production ML compiler (Google, for TPU) |
| 2018 | TVM | Open-source, hardware-agnostic ML compiler |
| 2018 | Glow | Facebook's ML compiler for inference |
| 2019 | MLIR | Multi-level IR framework (Google, open-sourced to LLVM) |
| 2020 | Ansor | Auto-scheduling for TVM, surpassing hand-tuned kernels |
| 2022 | torch.compile | PyTorch's entry into compilation (covered in Lecture 03d) |
| 2023 | StableHLO | Portable, versioned HLO for cross-compiler compatibility |
| 2024 | Triton compiler | NVIDIA's high-level GPU programming language as compiler target |

---

## 3. XLA: Accelerated Linear Algebra

### 3.1 Architecture Overview

XLA is Google's compiler for linear algebra operations. It was originally built to target TPUs but now supports GPUs, CPUs, and custom hardware. XLA operates as a **whole-program compiler**: it takes an entire computation graph, optimizes it globally, and emits a single executable.

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (JAX, TensorFlow, PyTorch/XLA)                │
│  Python program with tensor operations                  │
└───────────────────────┬─────────────────────────────────┘
                        │  Tracing / Lowering
                        v
┌─────────────────────────────────────────────────────────┐
│  StableHLO / HLO IR                                     │
│  High-level tensor operations with static shapes         │
└───────────────────────┬─────────────────────────────────┘
                        │  Graph-level optimization passes
                        v
┌─────────────────────────────────────────────────────────┐
│  Optimized HLO                                           │
│  Fused operations, optimized layouts, scheduled           │
└───────────────────────┬─────────────────────────────────┘
                        │  Backend-specific lowering
                        v
┌─────────────────────────────────────────────────────────┐
│  Target Code Generation                                  │
│  GPU: PTX/CUDA kernels    TPU: TPU instructions          │
│  CPU: LLVM IR -> native   Custom: backend-specific       │
└─────────────────────────────────────────────────────────┘
```

### 3.2 HLO: The High-Level Operations IR

HLO is a functional, statically-typed IR where every operation takes and produces immutable tensors with known shapes and dtypes.

**Core HLO operations:**

| Category | Operations |
|---|---|
| Element-wise | `add`, `multiply`, `maximum`, `exp`, `log`, `tanh`, `compare` |
| Reduction | `reduce` (with combiner function), `reduce-window` |
| Data movement | `broadcast`, `transpose`, `reshape`, `slice`, `concatenate` |
| Linear algebra | `dot` (generalized matmul), `convolution` |
| Control flow | `conditional`, `while` (structured, not arbitrary branches) |
| Custom | `custom-call` (escape hatch to hand-written kernels) |

**Example HLO for a linear layer:**

```
HloModule linear_layer

ENTRY main {
  x = f32[32,784] parameter(0)
  W = f32[784,256] parameter(1)
  b = f32[256] parameter(2)

  // Matrix multiply: dot(x, W) -> f32[32,256]
  dot = f32[32,256] dot(x, W),
        lhs_contracting_dims={1}, rhs_contracting_dims={0}

  // Broadcast bias: f32[256] -> f32[32,256]
  bias_broadcast = f32[32,256] broadcast(b), dimensions={1}

  // Add bias
  add = f32[32,256] add(dot, bias_broadcast)

  // ReLU: max(0, add)
  zero = f32[] constant(0)
  zero_broadcast = f32[32,256] broadcast(zero), dimensions={}
  relu = f32[32,256] maximum(add, zero_broadcast)

  ROOT relu
}
```

### 3.3 Key Properties of HLO

**Static shapes.** Every tensor has a fully specified shape at compile time. Dynamic shapes require padding to a known upper bound or re-compilation.

**Explicit broadcasting.** Unlike Python/NumPy, HLO requires explicit `broadcast` instructions. This makes the data movement visible to the optimizer.

**Generalized dot.** The `dot` operation generalizes matrix multiplication to arbitrary contraction of tensor dimensions, specified by `lhs_contracting_dims` and `rhs_contracting_dims`. A batch matmul is expressed with `lhs_batch_dims` and `rhs_batch_dims`.

**No in-place mutation.** HLO is purely functional -- every operation produces a new tensor. The compiler determines buffer reuse during memory planning (called "buffer assignment" in XLA).

### 3.4 XLA Optimization Passes

XLA applies approximately 100 optimization passes. The most important are:

**Algebraic simplification.** Standard simplifications plus ML-specific ones:

$$\text{broadcast}(\text{reshape}(x)) \to \text{broadcast}(x) \quad \text{(when shapes are compatible)}$$

**Operator fusion.** XLA's fusion pass is the most impactful. It classifies operations as:

- **kLoop**: Element-wise operations (can be fused freely).
- **kInput**: Reductions (can fuse element-wise producers).
- **kOutput**: Element-wise consumers that can be fused as epilogues to producer operations.

The fusion algorithm greedily merges kLoop operations into chains, then attaches them as epilogues to kInput operations (e.g., fusing ReLU after matmul).

**Layout assignment.** XLA chooses optimal memory layouts for each tensor, inserting layout-change operations where necessary. For GPUs with Tensor Cores, XLA typically selects NHWC for convolutions and appropriate tiling for matmuls.

**Buffer assignment.** XLA performs global memory planning, assigning buffers to tensors and enabling buffer reuse for non-overlapping lifetimes. This is a more sophisticated version of the memory planning algorithm from Lecture 03a.

**While-loop optimization.** XLA hoists loop-invariant computations and can partially unroll loops for better performance.

### 3.5 XLA Code Generation

For GPU targets, XLA generates LLVM IR, which is then compiled to PTX (NVIDIA's virtual ISA) and finally to SASS (the actual GPU machine code) by the NVIDIA driver.

For fused element-wise operations, XLA generates a single CUDA kernel where each thread computes one output element, evaluating the entire fused expression in registers:

```c
// Generated kernel for fused: relu(matmul_output + bias)
// (simplified -- actual XLA output is more complex)
__global__ void fused_add_relu(
    float* output,         // [32, 256]
    const float* matmul,   // [32, 256]
    const float* bias,     // [256]
    int N, int D) {
  int idx = blockIdx.x * blockDim.x + threadIdx.x;
  if (idx < N * D) {
    int d = idx % D;
    float val = matmul[idx] + bias[d];  // fused add
    output[idx] = val > 0 ? val : 0;    // fused relu
  }
}
```

For TPU targets, XLA generates code for the TPU's systolic array (MXU) and vector/scalar units, scheduling operations to maximize MXU utilization.

### 3.6 XLA with JAX

JAX is the most natural frontend for XLA. The `jax.jit` decorator traces a Python function into HLO:

```python
import jax
import jax.numpy as jnp

@jax.jit
def linear_relu(x, W, b):
    """
    Args:
        x: [B, D_in], input activations
        W: [D_in, D_out], weight matrix
        b: [D_out], bias vector
    Returns:
        [B, D_out], output after linear + ReLU
    """
    return jnp.maximum(x @ W + b, 0)

# First call: traces, compiles via XLA, caches the compiled code
x = jnp.ones((32, 784))
W = jnp.ones((784, 256))
b = jnp.zeros(256)
y = linear_relu(x, W, b)   # triggers compilation

# Subsequent calls with same shapes: uses cached compiled code
y2 = linear_relu(x, W, b)  # no recompilation

# To inspect the HLO:
print(jax.make_jaxpr(linear_relu)(x, W, b))
# Outputs the JAXpr (JAX's internal trace), which is lowered to HLO
```

**Shape specialization.** XLA compiles a separate executable for each distinct input shape. Changing the batch size triggers recompilation. This is why JAX programs should pad inputs to fixed sizes for best performance.

---

## 4. TVM: Tensor Virtual Machine

### 4.1 Architecture Overview

TVM takes a fundamentally different approach from XLA. Where XLA is a monolithic compiler tightly coupled to Google's ecosystem, TVM is a modular, open-source compiler stack designed for portability across diverse hardware.

```
┌─────────────────────────────────────────────────────────┐
│  Frontend Import (ONNX, PyTorch, TensorFlow, etc.)      │
└───────────────────────┬─────────────────────────────────┘
                        v
┌─────────────────────────────────────────────────────────┐
│  Relay IR                                                │
│  High-level, functional, with type system                │
│  Graph-level optimizations (fusion, layout, quantization)│
└───────────────────────┬─────────────────────────────────┘
                        │  Lowering to operator level
                        v
┌─────────────────────────────────────────────────────────┐
│  Tensor Expressions (TE) / TIR                           │
│  Loop-level representation of individual operators       │
│  Schedule transformations (tile, vectorize, unroll)      │
└───────────────────────┬─────────────────────────────────┘
                        │  Auto-scheduling (Ansor) or manual schedule
                        v
┌─────────────────────────────────────────────────────────┐
│  Target Code Generation                                  │
│  CUDA, OpenCL, Metal, LLVM, Vulkan, ...                 │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Relay IR

Relay is TVM's graph-level IR. Unlike HLO's imperative-functional style, Relay is based on a **functional programming** paradigm with let-bindings, pattern matching, and an expressive type system.

**Relay program for a convolutional block:**

```python
# Relay IR (Python constructor syntax)
import tvm
from tvm import relay

# Define input variable with type
data = relay.var("data", shape=(1, 3, 224, 224), dtype="float32")
weight = relay.var("weight", shape=(64, 3, 7, 7), dtype="float32")
bias = relay.var("bias", shape=(64,), dtype="float32")

# Build computation
conv = relay.nn.conv2d(data, weight, strides=(2, 2), padding=(3, 3),
                       channels=64, kernel_size=(7, 7))
biased = relay.nn.bias_add(conv, bias)
out = relay.nn.relu(biased)

# Create a Relay function (the compilation unit)
func = relay.Function([data, weight, bias], out)
mod = tvm.IRModule.from_expr(func)
```

**Relay's type system.** Relay uses a Hindley-Milner-style type system extended with tensor types:

$$\tau ::= \texttt{Tensor}[\text{shape}, \text{dtype}] \mid \tau_1 \to \tau_2 \mid \texttt{Tuple}(\tau_1, \ldots, \tau_n)$$

Type inference propagates shape information through the graph, catching shape mismatches at compile time rather than runtime.

**Relay optimization passes.** Relay provides a pass infrastructure similar to LLVM's:

```python
# Apply optimization passes
with tvm.transform.PassContext(opt_level=3):
    mod = relay.transform.FoldConstant()(mod)
    mod = relay.transform.FuseOps(fuse_opt_level=2)(mod)
    mod = relay.transform.AlterOpLayout()(mod)
    mod = relay.transform.EliminateCommonSubexpr()(mod)
```

The `opt_level` controls the aggressiveness of optimizations, analogous to GCC's `-O` flags.

### 4.3 Tensor Expressions and Scheduling

Below the graph level, TVM represents individual operators as **tensor expressions (TE)**: mathematical descriptions of the computation without specifying the execution order.

**Example: Matrix multiplication in TE.**

```python
import tvm
from tvm import te

# Declare computation (what to compute)
M, K, N = 1024, 1024, 1024
A = te.placeholder((M, K), name="A", dtype="float32")
B = te.placeholder((K, N), name="B", dtype="float32")

# Reduction axis
k = te.reduce_axis((0, K), name="k")

# C[i, j] = sum_k A[i, k] * B[k, j]
C = te.compute(
    (M, N),
    lambda i, j: te.sum(A[i, k] * B[k, j], axis=k),
    name="C"
)
```

This is purely declarative -- it says *what* to compute, not *how*. The schedule specifies the execution strategy:

```python
# Create a default schedule
s = te.create_schedule(C.op)

# Tile the loops for cache efficiency
# Before: for i in [0, M): for j in [0, N): for k in [0, K):
xo, xi = s[C].split(C.op.axis[0], factor=32)    # tile i by 32
yo, yi = s[C].split(C.op.axis[1], factor=32)    # tile j by 32
ko, ki = s[C].split(k, factor=4)                 # tile k by 4

# Reorder loops: tile-level loops outside, inner loops inside
s[C].reorder(xo, yo, ko, xi, yi, ki)

# For GPU: bind outer loops to thread blocks, inner to threads
s[C].bind(xo, te.thread_axis("blockIdx.x"))
s[C].bind(yo, te.thread_axis("blockIdx.y"))
s[C].bind(xi, te.thread_axis("threadIdx.x"))
s[C].bind(yi, te.thread_axis("threadIdx.y"))

# Vectorize the innermost loop
s[C].vectorize(ki)

# Build the kernel
func = tvm.build(s, [A, B, C], target="cuda", name="matmul")
```

### 4.4 Auto-Scheduling with Ansor

Manually writing schedules is expert-level work. TVM's Ansor auto-scheduler automatically searches for high-performance schedules.

**The search problem.** Given a tensor expression, find the schedule $s^*$ that minimizes execution time:

$$s^* = \arg\min_{s \in \mathcal{S}} T(s)$$

where $\mathcal{S}$ is the space of valid schedules and $T(s)$ is the measured execution time of schedule $s$ on the target hardware.

**Ansor's approach:**

1. **Sketch generation.** Enumerate high-level schedule templates (sketches) that define the loop structure: tiling dimensions, fusion decisions, and parallelism strategy.

2. **Random annotation.** For each sketch, randomly sample concrete parameters: tile sizes, unrolling factors, vectorization widths.

3. **Evolutionary search.** Use a genetic algorithm to evolve the parameter choices, guided by a learned cost model.

4. **Cost model.** A gradient-boosted tree predicts execution time from schedule features (tile sizes, memory access patterns, parallelism levels), trained on previously measured schedules.

5. **Measurement.** The top candidates from the cost model are compiled and measured on the actual hardware. These measurements update the cost model.

```python
import tvm.auto_scheduler as auto_scheduler

# Define the task
target = tvm.target.Target("nvidia/nvidia-a100")
task = auto_scheduler.SearchTask(
    func=matmul,       # the TE computation
    args=(M, K, N),
    target=target,
)

# Configure the search
tune_option = auto_scheduler.TuningOptions(
    num_measure_trials=1000,
    measure_callbacks=[auto_scheduler.RecordToFile("matmul_log.json")],
    verbose=2,
)

# Run auto-tuning
task.tune(tune_option)

# Apply the best schedule
sch, args = task.apply_best("matmul_log.json")
```

**Ansor's performance.** On standard benchmarks, Ansor-tuned operators match or exceed hand-tuned cuDNN/cuBLAS implementations for most operations, and significantly outperform them for non-standard operations (e.g., custom fusion patterns) that lack vendor library support.

### 4.5 TVM's Target Coverage

A key advantage of TVM is its broad hardware support:

| Target | Backend | Maturity |
|---|---|---|
| NVIDIA GPU | CUDA | Production |
| AMD GPU | ROCm/Vulkan | Production |
| Intel CPU | LLVM (AVX-512) | Production |
| ARM CPU | LLVM (NEON) | Production |
| Apple GPU | Metal | Experimental |
| FPGA | VTA (Versatile Tensor Accelerator) | Research |
| WebGPU | Vulkan/WebGPU | Experimental |
| Microcontrollers | C codegen | Research (microTVM) |

---

## 5. MLIR: Multi-Level Intermediate Representation

### 5.1 The N x M Problem

Before MLIR, the compiler landscape suffered from fragmentation: each compiler had its own IR, and converting between them required writing $N \times M$ translators for $N$ sources and $M$ targets. MLIR addresses this by providing a **common infrastructure** for defining and composing IRs at multiple levels of abstraction.

### 5.2 Dialects: The Core Abstraction

MLIR organizes operations into **dialects** -- namespaced collections of operations, types, and attributes. Each dialect represents a level of abstraction:

```
┌─────────────────────────────────────────────────────────┐
│  High-level dialects                                     │
│  stablehlo, mhlo, tosa      (tensor operations)         │
├─────────────────────────────────────────────────────────┤
│  Mid-level dialects                                      │
│  linalg, tensor, memref      (structured computation)   │
├─────────────────────────────────────────────────────────┤
│  Low-level dialects                                      │
│  scf, affine, arith          (loops, index math)        │
├─────────────────────────────────────────────────────────┤
│  Target dialects                                         │
│  gpu, llvm, spirv            (hardware-specific)        │
└─────────────────────────────────────────────────────────┘
```

**Progressive lowering.** A program starts in a high-level dialect and is progressively lowered through intermediate dialects to a target dialect:

$$\texttt{stablehlo} \to \texttt{linalg-on-tensors} \to \texttt{linalg-on-buffers} \to \texttt{scf + affine} \to \texttt{llvm}$$

At each level, dialect-specific optimizations apply.

### 5.3 MLIR for ML Compilers

**Example: Lowering a matmul through MLIR dialects.**

```mlir
// Level 1: StableHLO dialect (high-level)
func.func @matmul(%A: tensor<32x784xf32>, %B: tensor<784x256xf32>)
    -> tensor<32x256xf32> {
  %C = "stablehlo.dot_general"(%A, %B) {
    dot_dimension_numbers = #stablehlo.dot<
      lhs_contracting_dimensions = [1],
      rhs_contracting_dimensions = [0]>
  } : (tensor<32x784xf32>, tensor<784x256xf32>) -> tensor<32x256xf32>
  return %C : tensor<32x256xf32>
}

// Level 2: Linalg dialect (structured computation)
func.func @matmul(%A: tensor<32x784xf32>, %B: tensor<784x256xf32>)
    -> tensor<32x256xf32> {
  %init = linalg.init_tensor [32, 256] : tensor<32x256xf32>
  %C = linalg.matmul ins(%A, %B : tensor<32x784xf32>, tensor<784x256xf32>)
                      outs(%init : tensor<32x256xf32>) -> tensor<32x256xf32>
  return %C : tensor<32x256xf32>
}

// Level 3: SCF + Arith (loops and arithmetic)
func.func @matmul(%A: memref<32x784xf32>, %B: memref<784x256xf32>,
                  %C: memref<32x256xf32>) {
  scf.for %i = 0 to 32 step 1 {
    scf.for %j = 0 to 256 step 1 {
      scf.for %k = 0 to 784 step 1 {
        %a = memref.load %A[%i, %k] : memref<32x784xf32>
        %b = memref.load %B[%k, %j] : memref<784x256xf32>
        %c = memref.load %C[%i, %j] : memref<32x256xf32>
        %prod = arith.mulf %a, %b : f32
        %sum = arith.addf %c, %prod : f32
        memref.store %sum, %C[%i, %j] : memref<32x256xf32>
      }
    }
  }
  return
}
```

**Key benefit:** Loop transformations (tiling, interchange, fusion) are applied at the `linalg`/`scf` level using well-understood algorithms, then the result is lowered to the target. This separates concerns cleanly.

### 5.4 MLIR Architecture in C++

MLIR's in-memory representation is built on a small set of core C++ data structures. Understanding these is essential for anyone writing passes or defining new dialects.

**Core data structures:**

| Class | Role |
|---|---|
| `Operation` | A single unit of computation (an "op"). Owns its operands, results, attributes, and nested regions. |
| `Value` | An SSA value -- either a `BlockArgument` or an `OpResult`. Every value has a `Type`. |
| `Block` | A linear sequence of operations, terminated by a single terminator op. Owns a list of `BlockArgument`s. |
| `Region` | An ordered list of `Block`s. Regions give ops hierarchical structure (e.g., the body of a loop or function). |
| `Type` | Describes the static type of a `Value` (e.g., `f32`, `tensor<4x8xf32>`, `memref<16xf64>`). |
| `Attribute` | Compile-time metadata attached to an op (e.g., an integer constant, a string, a dense array of floats). |

**How ops are represented in memory:**

```cpp
// An Operation is a variadic-length object laid out as:
//   [Operation header]
//   [OpResult 0 .. OpResult N-1]      -- results stored inline
//   [OpOperand 0 .. OpOperand M-1]    -- operands (pointers to Values)
//   [BlockOperand 0 .. BlockOperand K-1] -- successor blocks
//
// Navigating the IR:
Operation *op = ...;
unsigned numOperands = op->getNumOperands();
Value    firstInput  = op->getOperand(0);
Value    firstOutput = op->getResult(0);
Type     resultType  = firstOutput.getType();
Region  &body        = op->getRegion(0);     // first nested region
Block   &entry       = body.front();          // entry block
```

Every `Operation` belongs to exactly one `Block`, and every `Block` belongs to exactly one `Region`. This ownership hierarchy makes memory management straightforward: destroying a `Region` recursively destroys all of its blocks and their operations.

### 5.5 Defining Operations in TableGen

MLIR uses LLVM's TableGen DSL to declaratively define operations. The TableGen backend auto-generates C++ classes, verifiers, parsers, and printers from the `.td` description.

**Example: defining an `add` op in a custom dialect.**

```tablegen
// In MyDialect.td
include "mlir/IR/OpBase.td"
include "mlir/Interfaces/SideEffectInterfaces.td"
include "mlir/Interfaces/InferTypeOpInterface.td"

def MyDialect : Dialect {
  let name = "my";
  let cppNamespace = "::my";
}

def MyDialect_AddOp : Op<MyDialect, "add",
    [Pure, SameOperandsAndResultType]> {
  let summary = "element-wise addition";
  let description = [{
    Computes the element-wise sum of two tensors with identical type.
  }];

  let arguments = (ins AnyTensor:$lhs, AnyTensor:$rhs);
  let results = (outs AnyTensor:$result);

  let assemblyFormat = "$lhs `,` $rhs attr-dict `:` type($result)";
}
```

The traits `Pure` (no side effects) and `SameOperandsAndResultType` (all operands and the result share the same type) are checked automatically by the generated verifier. The `assemblyFormat` string controls how the op is printed and parsed in textual MLIR:

```mlir
%out = my.add %x, %y : tensor<4x8xf32>
```

### 5.6 Writing a Pass in C++

Compiler transformations in MLIR are organized as **passes**. A pass is a C++ class that traverses and rewrites the IR.

```cpp
#include "mlir/Pass/Pass.h"
#include "mlir/Dialect/Func/IR/FuncOps.h"
#include "mlir/IR/PatternMatch.h"

namespace {

struct MyFusionPass
    : public PassWrapper<MyFusionPass, OperationPass<func::FuncOp>> {

  // Metadata used by the pass manager for scheduling and diagnostics.
  StringRef getArgument() const override { return "my-fusion"; }
  StringRef getDescription() const override {
    return "Fuse element-wise operations into producer kernels";
  }

  void runOnOperation() override {
    func::FuncOp func = getOperation();

    // Walk all operations inside the function.
    func.walk([&](Operation *op) {
      // Check if this op is an element-wise consumer that
      // can be fused into its producer.
      if (!isElementWise(op))
        return;

      Operation *producer = op->getOperand(0).getDefiningOp();
      if (!producer || !isFusionCandidate(producer, op))
        return;

      // Perform the fusion (details depend on the dialect).
      fuseIntoProducer(producer, op);
    });
  }

private:
  bool isElementWise(Operation *op);
  bool isFusionCandidate(Operation *producer, Operation *consumer);
  void fuseIntoProducer(Operation *producer, Operation *consumer);
};

} // namespace

// Register the pass so it can be invoked from the command line:
//   mlir-opt --my-fusion input.mlir
static mlir::PassRegistration<MyFusionPass> pass;
```

Passes declare what granularity they operate on via the template parameter (here `OperationPass<func::FuncOp>` means the pass runs once per function). The pass manager can then schedule passes in parallel across independent functions.

### 5.7 PatternRewriter: Declarative Rewrites

For local, pattern-based optimizations, MLIR provides the `PatternRewriter` framework. A pattern matches an op and replaces it with new IR.

```cpp
#include "mlir/IR/PatternMatch.h"
#include "mlir/Transforms/GreedyPatternRewriteDriver.h"

/// Fuse an add followed by a relu into a single fused_add_relu op.
struct FuseAddRelu : public OpRewritePattern<my::AddOp> {
  using OpRewritePattern<my::AddOp>::OpRewritePattern;

  LogicalResult matchAndRewrite(my::AddOp addOp,
                                PatternRewriter &rewriter) const override {
    // Check that the add result has exactly one user, and it is a relu.
    if (!addOp.getResult().hasOneUse())
      return failure();

    Operation *user = *addOp.getResult().getUsers().begin();
    auto reluOp = dyn_cast<my::ReluOp>(user);
    if (!reluOp)
      return failure();

    // Replace relu(add(lhs, rhs)) -> fused_add_relu(lhs, rhs).
    rewriter.setInsertionPointAfter(addOp);
    auto fusedOp = rewriter.create<my::FusedAddReluOp>(
        addOp.getLoc(), addOp.getResult().getType(),
        addOp.getLhs(), addOp.getRhs());

    rewriter.replaceOp(reluOp, fusedOp.getResult());
    rewriter.eraseOp(addOp);
    return success();
  }
};

// Populate and apply patterns inside a pass:
void MyFusionPass::runOnOperation() {
  RewritePatternSet patterns(&getContext());
  patterns.add<FuseAddRelu>(&getContext());

  if (failed(applyPatternsAndFoldGreedily(getOperation(),
                                           std::move(patterns))))
    signalPassFailure();
}
```

The `GreedyPatternRewriteDriver` applies all registered patterns to a fixpoint, automatically handling the worklist of modified ops. This is the same infrastructure MLIR uses for canonicalization (`-canonicalize`).

### 5.8 Progressive Lowering in C++

The textual IR examples in Section 5.3 showed the conceptual lowering chain. In practice, each lowering step is implemented as a `ConversionPattern` with a `TypeConverter` and a `ConversionTarget`.

```cpp
#include "mlir/Transforms/DialectConversion.h"

/// Lower my::AddOp to linalg::GenericOp.
struct AddOpToLinalgLowering
    : public OpConversionPattern<my::AddOp> {
  using OpConversionPattern<my::AddOp>::OpConversionPattern;

  LogicalResult matchAndRewrite(
      my::AddOp op, OpAdaptor adaptor,
      ConversionPatternRewriter &rewriter) const override {

    Location loc = op.getLoc();
    Value lhs = adaptor.getLhs();
    Value rhs = adaptor.getRhs();

    // Create an output tensor for the result.
    auto resultType = cast<RankedTensorType>(op.getResult().getType());
    Value init = rewriter.create<tensor::EmptyOp>(
        loc, resultType.getShape(), resultType.getElementType());

    // Build the linalg.generic that computes element-wise add.
    SmallVector<AffineMap> indexingMaps(
        3, rewriter.getMultiDimIdentityMap(resultType.getRank()));
    SmallVector<utils::IteratorType> iteratorTypes(
        resultType.getRank(), utils::IteratorType::parallel);

    auto genericOp = rewriter.create<linalg::GenericOp>(
        loc, resultType, /*inputs=*/ValueRange{lhs, rhs},
        /*outputs=*/ValueRange{init}, indexingMaps, iteratorTypes,
        [](OpBuilder &b, Location loc, ValueRange args) {
          Value sum = b.create<arith::AddFOp>(loc, args[0], args[1]);
          b.create<linalg::YieldOp>(loc, sum);
        });

    rewriter.replaceOp(op, genericOp.getResults());
    return success();
  }
};
```

A pass then assembles the conversion target and applies the patterns:

```cpp
struct LowerToLinalgPass
    : public PassWrapper<LowerToLinalgPass, OperationPass<ModuleOp>> {
  void runOnOperation() override {
    ConversionTarget target(getContext());

    // The target IR is legal if it contains only linalg, tensor,
    // arith, and func ops -- our source dialect (my) is illegal.
    target.addIllegalDialect<my::MyDialect>();
    target.addLegalDialect<linalg::LinalgDialect>();
    target.addLegalDialect<tensor::TensorDialect>();
    target.addLegalDialect<arith::ArithDialect>();
    target.addLegalDialect<func::FuncDialect>();

    RewritePatternSet patterns(&getContext());
    patterns.add<AddOpToLinalgLowering>(&getContext());
    // ... add lowering patterns for other ops ...

    if (failed(applyPartialConversion(
            getOperation(), target, std::move(patterns))))
      signalPassFailure();
  }
};
```

The full lowering chain for an ML compiler built on MLIR typically involves three or four such passes chained together:

```
my-dialect  --lower-to-linalg-->  linalg-on-tensors
            --one-shot-bufferize-->  linalg-on-memrefs
            --convert-linalg-to-loops-->  scf + arith
            --convert-scf-to-cf-->  cf + arith
            --convert-to-llvm-->  llvm dialect
            --translate-to-llvmir-->  LLVM IR
```

Each arrow is a separate pass that is independently testable with `mlir-opt`, which makes debugging and development significantly easier than monolithic lowering.

### 5.9 MLIR-Based ML Compilers

Several ML compilers build on MLIR:

- **IREE** (Intermediate Representation Execution Environment): Google's MLIR-based compiler for deploying ML models on diverse targets.
- **Torch-MLIR**: Lowers PyTorch programs to MLIR dialects.
- **TensorFlow MLIR bridge**: Uses MLIR as the path from TF to XLA.
- **Triton**: NVIDIA's high-level GPU programming language uses MLIR internally (Triton IR is an MLIR dialect).

---

## 6. Comparison of ML Compiler Stacks

### 6.1 Design Trade-offs

| Dimension | XLA | TVM | MLIR-based |
|---|---|---|---|
| **Philosophy** | Whole-program, closed-world | Modular, search-based | Multi-level, composable |
| **Strength** | Peak perf on TPU/GPU | Hardware portability | Extensibility |
| **Weakness** | Dynamic shapes, control flow | Compilation time (tuning) | Maturity for end users |
| **Fusion** | Greedy, fast heuristic | Search-based via scheduling | Dialect-dependent |
| **Compilation time** | Seconds | Minutes-hours (first tune) | Seconds (after lowering) |
| **Frontend** | JAX, TF, PyTorch/XLA | Any (via import) | Any (via dialect) |
| **Primary users** | Google internal + JAX users | Edge/diverse hardware | Compiler developers |

### 6.2 Performance Analysis

For a ResNet-50 inference benchmark at batch size 1 on an NVIDIA A100:

| Compiler | Latency (ms) | vs Eager PyTorch |
|---|---|---|
| Eager PyTorch | 4.2 | 1.0x |
| TorchScript | 3.6 | 1.17x |
| TensorRT (FP32) | 2.1 | 2.0x |
| XLA (via JAX) | 2.4 | 1.75x |
| TVM (auto-tuned) | 2.3 | 1.83x |
| torch.compile (Inductor) | 2.6 | 1.62x |

**Key observations:**

1. All compilers significantly outperform eager execution (1.6--2.0x speedup).
2. TensorRT achieves the best single-model latency because it is narrowly specialized for NVIDIA GPUs.
3. XLA and TVM are competitive, with XLA faster out-of-the-box and TVM faster after tuning.
4. torch.compile is the newest entrant and closing the gap rapidly.

### 6.3 Compilation Time vs Runtime Performance

There is a fundamental trade-off between compilation time and runtime performance:

$$\text{Total cost} = T_{\text{compile}} + N_{\text{runs}} \times T_{\text{run}}$$

Compilation is amortized over $N_{\text{runs}}$ executions:

- **Training** (millions of iterations): Even minutes of compilation time is worthwhile if it saves microseconds per iteration.
- **Inference** (single model deployed for weeks): Compilation cost is negligible; maximize runtime performance.
- **Interactive development** (tens of iterations): Compilation overhead is painful; prefer fast compilation (or no compilation).

| Scenario | Preferred Compiler |
|---|---|
| JAX training on TPU | XLA |
| PyTorch research iteration | torch.compile (fast compile) |
| Edge deployment on ARM | TVM (best portability) |
| NVIDIA inference serving | TensorRT |
| Custom hardware bring-up | MLIR (write your own backend) |

---

## 7. Deep Dive: XLA Fusion Semantics

### 7.1 Fusion Rules

XLA's fusion pass is governed by a set of rules that determine which operations can be fused:

**Rule 1: Element-wise chains.** Any sequence of element-wise operations can be fused into a single kernel.

**Rule 2: Broadcast-then-element-wise.** A broadcast followed by an element-wise operation is fused: the broadcast is computed implicitly via index arithmetic.

**Rule 3: Reduce-then-element-wise.** A reduction followed by element-wise operations on the result is fused into the reduction kernel's epilogue.

**Rule 4: Element-wise-then-reduce.** Element-wise operations feeding into a reduction are fused as the reduction's prologue.

**Rule 5: Transpose fusion.** Layout changes are fused with adjacent operations when the access pattern can be absorbed into the kernel's index computation.

**Anti-rule: No GEMM-GEMM fusion.** Two matrix multiplications are never fused into a single kernel (this would require a fundamentally different algorithm, not just loop fusion).

### 7.2 Fusion Cost Model

For each candidate fusion, XLA estimates the benefit:

$$\Delta T = T_{\text{unfused}} - T_{\text{fused}} = \frac{\text{eliminated memory traffic}}{\text{bandwidth}} - \Delta T_{\text{overhead}}$$

where $\Delta T_{\text{overhead}}$ accounts for increased register pressure that might reduce occupancy.

The key insight: for memory-bound operations, the arithmetic is essentially free -- the bottleneck is reading and writing data. Fusion eliminates intermediate writes and reads, directly reducing execution time proportional to the eliminated bytes.

---

## 8. Deep Dive: TVM Auto-Scheduling Cost Model

### 8.1 Feature Extraction

Ansor extracts features from each schedule candidate:

**Loop features** (per loop level):
- Length (number of iterations)
- Annotations (parallel, vectorize, unroll, bind-to-thread)
- Tiling factor
- Memory access stride

**Access features** (per buffer access):
- Reuse type (temporal or spatial)
- Reuse factor (how many times each loaded element is used)
- Stride pattern

**Arithmetic features:**
- Total FLOPs
- Ratio of compute to memory ops

### 8.2 The Cost Model

The cost model is a gradient-boosted decision tree (XGBoost) that predicts execution time from schedule features:

$$\hat{T}(s) = f_\theta(\text{features}(s))$$

The model is trained on $(s, T(s))$ pairs from actual hardware measurements. Key design decisions:

1. **Per-task model.** A separate model is trained for each tensor expression (e.g., one for $1024 \times 1024$ matmul, another for $3 \times 3$ convolution). This is feasible because the search for each task involves thousands of measurements.

2. **Transfer learning.** A base model pre-trained on common operations provides a warm start for new tasks, reducing the number of measurements needed.

3. **Uncertainty estimation.** The cost model's predictions have uncertainty; Ansor uses this to balance exploration (trying uncertain candidates) vs exploitation (refining promising candidates).

### 8.3 Search Efficiency

The search space for a single operator can exceed $10^{15}$ possible schedules. Ansor navigates this efficiently:

1. Generate ~64 sketches (high-level templates).
2. For each sketch, randomly sample ~2048 concrete schedules.
3. Filter by the cost model, keeping the top 64.
4. Measure these 64 on hardware.
5. Update the cost model.
6. Repeat for ~20 rounds.

Total measurements: ~1280 per operator, taking ~10--30 minutes depending on hardware speed. The entire model (e.g., ResNet-50 with ~20 unique operators) can be tuned in ~4--8 hours.

---

## 9. Practical Considerations

### 9.1 When to Use Which Compiler

**Use XLA (via JAX)** when:
- Targeting TPUs.
- Your model has static shapes and no dynamic control flow.
- You want the best out-of-the-box performance without manual tuning.

**Use TVM** when:
- Targeting non-NVIDIA hardware (AMD, ARM, edge devices).
- You need to deploy a single model to multiple hardware targets.
- You are willing to invest tuning time for peak performance.

**Use torch.compile** when:
- Your codebase is in PyTorch and rewriting in JAX is not feasible.
- You need fast iteration with compilation benefits.
- Covered in detail in Lecture 03d.

### 9.2 Common Pitfalls

1. **Dynamic shapes cause recompilation.** Both XLA and torch.compile recompile when input shapes change. Pad inputs to fixed sizes or use `dynamic=True` (PyTorch) / `jax.jit` with abstract shapes.

2. **Python control flow breaks tracing.** `if x.sum() > 0:` in Python is evaluated at trace time, not at execution time. Use framework-provided control flow (`jax.lax.cond`, `torch.cond`).

3. **Compilation time can dominate.** For small models or short training runs, compilation overhead may exceed the runtime savings. Profile before committing to compilation.

4. **Compiler bugs are hard to diagnose.** When a compiled model produces different results from eager execution, bisect by compiling subgraphs to identify the problematic pass.

---

## Key Takeaways

1. **XLA is a whole-program compiler** that excels at static, regular computations. Its tight integration with JAX and TPUs makes it the default choice for large-scale training at Google and in the JAX ecosystem.

2. **TVM decouples the schedule from the computation**, enabling auto-scheduling (Ansor) to search for high-performance implementations across diverse hardware targets without manual kernel engineering.

3. **MLIR provides the infrastructure** for building ML compilers through composable dialects and progressive lowering. It is not a compiler itself but a framework for building compilers, and is increasingly the substrate underneath XLA, Triton, and other production systems.

4. **No single compiler dominates all scenarios.** The choice depends on the framework (PyTorch vs JAX), the target hardware (GPU vs TPU vs edge), the workload characteristics (static vs dynamic shapes), and the tolerance for compilation time.

5. **The trend is convergence.** StableHLO provides a portable entry point into multiple backends. MLIR provides a common lowering infrastructure. The future likely involves a shared high-level IR with specialized backends.

---

## Further Reading

1. **XLA Team.** "XLA: Optimizing Compiler for Machine Learning." [openxla.org](https://openxla.org).
   - Official documentation and design documents for XLA.

2. **Chen, T., Moreau, T., Jiang, Z., et al.** (2018). "TVM: An Automated End-to-End Optimizing Compiler for Deep Learning." *OSDI 2018*.
   - The foundational TVM paper.

3. **Zheng, L., Jia, C., Sun, M., Zhao, Z., Yu, C., Haj-Ali, A., Wang, Y., Yang, J., Zhuo, D., Sen, K., Gonzalez, J. E., & Stoica, I.** (2020). "Ansor: Generating High-Performance Tensor Programs for Deep Learning." *OSDI 2020*.
   - Ansor auto-scheduling, achieving state-of-the-art performance across hardware targets.

4. **Lattner, C., Amini, M., Bondhugula, U., Cohen, A., Davis, A., Pienaar, J., Riddle, R., Shpeisman, T., Vasilache, N., & Zinenko, O.** (2021). "MLIR: Scaling Compiler Infrastructure for Domain Specific Computation." *CGO 2021*.
   - The MLIR design paper.

5. **Sabne, A.** (2020). "XLA: Compiling Machine Learning for Peak Performance." Google AI Blog.
   - Accessible overview of XLA's optimization techniques.

6. **Roesch, J., Lyubomirsky, S., Weber, L., et al.** (2019). "Relay: A New IR for Machine Learning Frameworks." *MAPL 2019*.
   - Relay's type system and functional IR design.

7. **StableHLO Specification.** [github.com/openxla/stablehlo](https://github.com/openxla/stablehlo).
   - The portable, versioned specification for the HLO operation set.

---

*Next: Lecture 03c -- Polyhedral Compilation & Loop Optimization*
