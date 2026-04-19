# Homework 03: Graph Fusion Passes

**Estimated time:** 25 hours
**Due date:** End of Week 6
**Submission:** C++ MLIR pass code + Python torch.fx code + PDF of derivations (Part A)

---

## Overview

This homework has two parts of equal weight. Part A tests your analytical understanding of computation graph optimization, fusion legality, and the polyhedral model. Part B has two components: **(B1)** writing MLIR optimization passes in C++, and **(B2)** using torch.fx in Python for graph capture and high-level transformations.

This split reflects how real ML compilers work: Python-level graph capture (torch.fx, JAX tracing) feeds into a C++ compiler backend (MLIR, XLA HLO, TVM) where the serious optimization happens.

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. Cite any references you consult. You may use the MLIR documentation, MLIR tutorials, and the `mlir-opt` tool. You may use PyTorch and torch.fx. You may not copy pass implementations from existing compiler projects.

---

## Part A: Analytical Problems (50%)

### Problem A1: Fusion Legality Analysis (15 points)

Consider the following computation graph (each node is labeled, edges represent data flow):

```
%x  = parameter([B, D])
%W1 = parameter([D, H])
%W2 = parameter([H, D])
%b1 = parameter([H])
%b2 = parameter([D])

%h1    = matmul(%x, %W1)          # [B, H]
%h2    = add(%h1, %b1)            # [B, H]  (broadcast b1)
%h3    = relu(%h2)                # [B, H]
%h4    = matmul(%h3, %W2)         # [B, D]
%h5    = add(%h4, %b2)            # [B, D]  (broadcast b2)
%h6    = add(%h5, %x)             # [B, D]  (residual connection)
%out   = layer_norm(%h6)          # [B, D]
```

**(a)** [5 points] Identify all legal vertical fusion groups. For each group, explain why the fusion is legal (no cycle constraint, compatible access patterns). List at least three distinct fusion groups.

**(b)** [5 points] Can `%h1 = matmul(%x, %W1)` and `%h4 = matmul(%h3, %W2)` be fused into a single kernel? Explain why or why not, considering both the data dependence and the computational requirements. Under what (if any) transformation could these two matmuls be combined?

**(c)** [5 points] Suppose we want to fuse `%h5 = add(%h4, %b2)` with `%h6 = add(%h5, %x)` and `%out = layer_norm(%h6)`. Layer normalization involves a reduction (computing mean and variance over the $D$ dimension). Describe the memory access pattern of the fused kernel. How many passes over the data does the fused kernel require, and what is the total memory traffic in bytes (in terms of $B$, $D$, and element size $\beta$)?

---

### Problem A2: Memory Traffic Analysis of Fusion (15 points)

Consider a sequence of $n$ element-wise unary operations $f_1, f_2, \ldots, f_n$ applied to a tensor $x$ of size $N$ elements, each of $\beta$ bytes:

$$y = f_n(f_{n-1}(\cdots f_2(f_1(x))\cdots))$$

**(a)** [3 points] Without fusion, compute the total memory traffic (reads + writes) in bytes, assuming each operation reads its input from HBM and writes its output to HBM.

**(b)** [3 points] With full fusion (all operations in a single kernel), compute the total memory traffic. What is the speedup ratio (unfused / fused traffic) as a function of $n$?

**(c)** [4 points] Now consider a more realistic scenario where each element-wise operation also has a constant parameter vector $\theta_i$ of size $D$ (e.g., a per-channel scale or bias). The input tensor has shape $[B, D]$ with $N = BD$. Without fusion, each kernel reads $x$ ($BD\beta$ bytes), the parameter $\theta_i$ ($D\beta$ bytes), and writes the output ($BD\beta$ bytes). Compute the total memory traffic without and with fusion. How does the speedup depend on $B$?

**(d)** [5 points] Consider a fusion group that includes a matmul followed by $n$ element-wise operations:

$$y = f_n(\cdots f_1(\text{matmul}(x, W) + b)\cdots)$$

where $x \in \mathbb{R}^{B \times D_{in}}$ and $W \in \mathbb{R}^{D_{in} \times D_{out}}$.

Compute the arithmetic intensity (FLOPs / bytes) of:
1. The unfused version (separate matmul kernel + $n$ element-wise kernels).
2. The fused version (matmul with element-wise epilogue).

Express the crossover point where the computation transitions from memory-bound to compute-bound, in terms of $B$, $D_{in}$, $D_{out}$, $n$, and hardware bandwidth $\text{BW}$ and peak FLOPS $F_{\text{peak}}$.

---

### Problem A3: Polyhedral Analysis of Convolution (10 points)

Consider a 1D convolution (no batching, single channel, stride 1):

```
for i in [0, N):
  for k in [0, K):
    y[i] += x[i + k] * w[k]
```

**(a)** [3 points] Write out the iteration domain $\mathcal{D}$, the access functions $f_x$, $f_w$, and $f_y$, and all data dependences (type and distance vector) for this computation.

**(b)** [4 points] Determine which loops can be tiled. Apply tiling with tile size $T$ to the tileable loop(s) and write out the transformed loop nest. Verify the legality of your tiling by checking it against the dependence vectors.

**(c)** [3 points] Suppose we want to fuse this convolution with a subsequent element-wise ReLU:

```
for i in [0, N):
  z[i] = max(y[i], 0)
```

Write out the fused loop nest. Is the fusion legal? What is the benefit in terms of memory traffic (express in bytes as a function of $N$, $K$, and element size $\beta$)?

---

### Problem A4: Data Layout Trade-offs (10 points)

Consider a 2D convolution with batch size $B$, input channels $C_{in}$, output channels $C_{out}$, spatial dimensions $H \times W$, and kernel size $K \times K$.

**(a)** [4 points] For NCHW layout, compute the number of cache lines accessed (assuming cache line size $L = 64$ bytes, FP32 data) when reading a single $K \times K$ spatial patch across all input channels. Do the same for NHWC layout. Which layout has better spatial locality for convolution?

For NCHW, the spatial patch at position $(h, w)$ for channel $c$ accesses addresses at offsets:

$$\text{addr}(n, c, h', w') = n \cdot (C_{in} \cdot H \cdot W) + c \cdot (H \cdot W) + h' \cdot W + w'$$

for $h' \in [h, h+K)$, $w' \in [w, w+K)$, $c \in [0, C_{in})$.

**(b)** [3 points] NVIDIA Tensor Cores require NHWC layout with the channel dimension a multiple of 8 (for FP16) or 16 (for INT8). Explain why this alignment requirement exists in terms of the MMA (matrix-multiply-accumulate) instruction's operand layout.

**(c)** [3 points] A graph has a convolution (prefers NHWC) followed by a batch normalization (no preference) followed by a channel-wise attention mechanism that reads channel-first (prefers NCHW). Where should the layout conversion be inserted to minimize total conversion cost? Formulate this as a min-cost assignment problem on the three nodes.

---

## Part B: Implementation (50%)

Part B has two components: **B1** writes MLIR compiler passes in C++, and **B2** uses torch.fx in Python for graph capture and high-level optimization. Together they represent the two layers of a real ML compiler stack.

### Problem B1: MLIR Optimization Passes in C++ (30 points)

You will work within the MLIR framework to define a small ML operation set, write optimization passes, and lower to executable code. All code is C++, built with CMake against your MLIR/LLVM installation.

#### B1.1: Define a Mini-ML MLIR Dialect (8 points)

Define a custom MLIR dialect called `miniml` with the following operations:

```
// miniml.matmul: Matrix multiply
%c = miniml.matmul(%a, %b) : (tensor<?x?xf32>, tensor<?x?xf32>) -> tensor<?x?xf32>

// miniml.add: Element-wise add (with broadcasting)
%c = miniml.add(%a, %b) : (tensor<?x?xf32>, tensor<?x?xf32>) -> tensor<?x?xf32>

// miniml.relu: Element-wise ReLU
%b = miniml.relu(%a) : (tensor<?x?xf32>) -> tensor<?x?xf32>

// miniml.bias_add: Add bias vector to matrix (broadcast over batch dim)
%c = miniml.bias_add(%a, %bias) : (tensor<?x?xf32>, tensor<?xf32>) -> tensor<?x?xf32>

// miniml.layer_norm: Layer normalization over last dimension
%b = miniml.layer_norm(%a, %gamma, %beta) {eps = 1e-5}
    : (tensor<?x?xf32>, tensor<?xf32>, tensor<?xf32>) -> tensor<?x?xf32>
```

Implement using MLIR's ODS (Operation Definition Specification) in TableGen:

```tablegen
// include/miniml/MiniMLOps.td
def MiniML_Dialect : Dialect {
  let name = "miniml";
  let cppNamespace = "::miniml";
}

def MiniML_MatmulOp : MiniML_Op<"matmul", [Pure]> {
  let arguments = (ins AnyTensor:$lhs, AnyTensor:$rhs);
  let results = (outs AnyTensor:$result);
  let assemblyFormat = "`(` $lhs `,` $rhs `)` attr-dict `:` functional-type(operands, results)";
  // TODO: Add shape inference via InferTypeOpInterface
}

// TODO: Define AddOp, ReluOp, BiasAddOp, LayerNormOp similarly
```

Requirements:
- All ops defined in TableGen with proper traits (`Pure`, `SameOperandsAndResultType` where appropriate).
- Shape inference: matmul infers output shape from input shapes; element-wise ops propagate shapes.
- The dialect registers and loads correctly. `mlir-opt --load-dialect=miniml` should work.
- Write a `.mlir` test file that parses and round-trips correctly.

#### B1.2: Operator Fusion Pass (10 points)

Write an MLIR pass in C++ that fuses eligible operation sequences:

```cpp
// lib/Transforms/FusionPass.cpp
#include "mlir/Pass/Pass.h"
#include "mlir/IR/PatternMatch.h"
#include "mlir/Transforms/GreedyPatternRewriteDriver.h"

namespace {

// Pattern 1: matmul + bias_add -> fused_linear
struct FuseMatmulBiasAdd : public OpRewritePattern<miniml::BiasAddOp> {
    using OpRewritePattern::OpRewritePattern;

    LogicalResult matchAndRewrite(miniml::BiasAddOp op,
                                  PatternRewriter &rewriter) const override {
        // Check: input to bias_add is a matmul with a single use
        auto matmulOp = op.getInput().getDefiningOp<miniml::MatmulOp>();
        if (!matmulOp || !matmulOp->hasOneUse())
            return failure();

        // Replace with fused op
        rewriter.replaceOpWithNewOp<miniml::LinearOp>(
            op, op.getType(), matmulOp.getLhs(), matmulOp.getRhs(),
            op.getBias());
        return success();
    }
};

// Pattern 2: add + relu -> fused_add_relu
// TODO: Implement

// Pattern 3: Chain of element-wise ops -> fused_elementwise region
// TODO: Implement (use MLIR regions to represent the fused body)

struct FusionPass : public PassWrapper<FusionPass,
                                       OperationPass<func::FuncOp>> {
    void runOnOperation() override {
        RewritePatternSet patterns(&getContext());
        patterns.add<FuseMatmulBiasAdd, FuseAddRelu>(
            &getContext());
        if (failed(applyPatternsGreedily(getOperation(),
                                          std::move(patterns))))
            signalPassFailure();
    }
    StringRef getArgument() const override { return "miniml-fusion"; }
    StringRef getDescription() const override {
        return "Fuse eligible miniml operations";
    }
};

}  // namespace
```

Requirements:
- At least 3 fusion patterns: (1) matmul+bias_add, (2) add+relu, (3) element-wise chain (3+ ops into a fused region).
- Each pattern must check fusion legality (single-use intermediate, compatible shapes).
- Register the pass so it can be invoked as `mlir-opt --miniml-fusion`.
- Write `.mlir` FileCheck tests for each pattern:

```mlir
// test/fusion_matmul_bias.mlir
// RUN: mlir-opt %s --miniml-fusion | FileCheck %s

func.func @test(%A: tensor<64x128xf32>, %B: tensor<128x256xf32>,
                %bias: tensor<256xf32>) -> tensor<64x256xf32> {
  %mm = miniml.matmul(%A, %B) : (tensor<64x128xf32>, tensor<128x256xf32>)
      -> tensor<64x256xf32>
  %out = miniml.bias_add(%mm, %bias) : (tensor<64x256xf32>, tensor<256xf32>)
      -> tensor<64x256xf32>
  return %out : tensor<64x256xf32>
}

// CHECK-LABEL: func.func @test
// CHECK-NOT: miniml.matmul
// CHECK-NOT: miniml.bias_add
// CHECK: miniml.linear
```

#### B1.3: Lowering to Linalg/Loops (7 points)

Write a lowering pass that converts `miniml` operations to MLIR's built-in `linalg` dialect (which represents loop nests over tensors):

```cpp
// lib/Transforms/LowerToLinalg.cpp

// miniml.matmul -> linalg.matmul
// miniml.add -> linalg.add (or linalg.generic with add body)
// miniml.relu -> linalg.generic with max(x, 0) body
// miniml.linear (fused) -> linalg.matmul + linalg.generic (bias + optional activation)

struct LowerMatmulToLinalg : public OpConversionPattern<miniml::MatmulOp> {
    using OpConversionPattern::OpConversionPattern;

    LogicalResult matchAndRewrite(miniml::MatmulOp op, OpAdaptor adaptor,
                                  ConversionPatternRewriter &rewriter)
                                  const override {
        auto loc = op.getLoc();
        auto resultType = cast<RankedTensorType>(op.getType());

        // Create empty output tensor
        Value init = rewriter.create<tensor::EmptyOp>(
            loc, resultType.getShape(), resultType.getElementType());
        Value zero = rewriter.create<arith::ConstantOp>(
            loc, rewriter.getZeroAttr(resultType.getElementType()));
        Value filled = rewriter.create<linalg::FillOp>(
            loc, zero, init).getResult(0);

        // Replace with linalg.matmul
        rewriter.replaceOpWithNewOp<linalg::MatmulOp>(
            op, TypeRange{resultType},
            ValueRange{adaptor.getLhs(), adaptor.getRhs()},
            ValueRange{filled});
        return success();
    }
};
```

Requirements:
- Lower all `miniml` ops (including fused ops from B1.2) to `linalg`.
- The lowered IR must be runnable: pipe through `--convert-linalg-to-loops --convert-scf-to-cf --convert-func-to-llvm` and execute with `mlir-cpu-runner`.
- Demonstrate a full pipeline: `miniml` IR -> fusion -> lowering -> execution on a small example (e.g., a 2-layer MLP forward pass).

#### B1.4: CSE and Dead Code Elimination (5 points)

MLIR provides built-in CSE and DCE passes. Write a test that demonstrates:

1. A `miniml` program with redundant computations (e.g., the same matmul computed twice).
2. Apply `--cse` and show the duplicate is eliminated.
3. A program with a dead computation (result unused). Apply `--canonicalize` and show it is removed.
4. Write a custom canonicalization pattern for your dialect: simplify `miniml.add(%x, 0)` -> `%x` and `miniml.relu(miniml.relu(%x))` -> `miniml.relu(%x)`.

Register the canonicalization patterns via `getCanonicalizationPatterns()` on your ops.

---

### Problem B2: torch.fx Graph Capture and Analysis (20 points)

This component works at the Python level — capturing PyTorch models into graphs and analyzing them. This is the "frontend" that would feed into the MLIR "backend" from B1.

#### B2.1: Graph Capture and Pattern Fusion (8 points)

Implement pattern-based fusion on `torch.fx` graphs:

```python
class FusionPass:
    """
    Identifies and fuses the following patterns in an FX graph:
    1. add + relu -> fused_add_relu
    2. matmul + add (bias) -> fused_linear
    3. mul + add (FMA: a * b + c) -> fused_fma
    """
    def __call__(self, gm: torch.fx.GraphModule) -> torch.fx.GraphModule:
        ...
```

For each pattern: implement detection, rewriting, and a unit test.

#### B2.2: Memory Traffic Estimator (4 points)

```python
def estimate_memory_traffic(
    gm: torch.fx.GraphModule,
    example_inputs: tuple[torch.Tensor, ...],
    fused: bool = False,
) -> dict:
    """
    Estimate total HBM traffic for the graph, with and without fusion.
    Returns: total_bytes, num_kernels, peak_memory, fusion_groups.
    """
    ...
```

#### B2.3: MLIR Export (Bonus, 5 points)

Write a Python function that converts a `torch.fx.GraphModule` into `miniml` MLIR text:

```python
def fx_to_miniml(gm: torch.fx.GraphModule,
                 example_input: torch.Tensor) -> str:
    """
    Convert an FX graph to miniml MLIR text format.

    Maps:
    - call_function(torch.mm) -> miniml.matmul
    - call_function(torch.add) -> miniml.add
    - call_function(torch.relu) -> miniml.relu
    - call_module(nn.Linear) -> miniml.matmul + miniml.bias_add

    Returns a string that can be passed to mlir-opt.
    """
    ...
```

Test: trace a simple MLP, export to MLIR, run through your fusion pass (`mlir-opt --miniml-fusion`), and verify the fused IR.

#### B2.4: Full Pipeline + Benchmarking (8 points)

Assemble the FX passes into a pipeline and test on real models:

```python
def optimize(model: torch.nn.Module,
             example_input: torch.Tensor) -> torch.fx.GraphModule:
    """
    1. Symbolic trace
    2. CSE
    3. Pattern-based fusion
    4. DCE
    5. Repeat until fixed point
    """
    ...
```

Test on:
1. A simple MLP: Linear -> ReLU -> Linear -> ReLU -> Linear
2. A transformer block: Attention + FFN + LayerNorm + Residual

Report: node count before/after, estimated memory traffic before/after, actual runtime speedup.

---

## Deliverables

1. **PDF** (Part A): Clearly written derivations with all intermediate steps.

2. **C++ code** (Part B1 — MLIR):
   - `CMakeLists.txt` that builds against your MLIR installation
   - `include/miniml/`: TableGen definitions, generated headers
   - `lib/Dialect/`: Dialect registration, op implementations
   - `lib/Transforms/`: Fusion pass, lowering pass, canonicalization patterns
   - `test/`: `.mlir` FileCheck tests for each pass
   - `tools/miniml-opt.cpp`: A custom `mlir-opt` driver that loads your dialect

3. **Python code** (Part B2 — torch.fx):
   - `fx_passes.py`: FX fusion passes and memory estimator
   - `fx_to_miniml.py`: MLIR export (bonus)
   - `benchmark.py`: Performance measurements
   - `test_fx_passes.py`: Unit tests

4. **Summary report** (1--2 pages) at the end of the PDF:

| Experiment | Metric | Before | After | Improvement |
|---|---|---|---|---|
| B1: MLIR fusion (MLP) | Op count | -- | -- | --% |
| B1: MLIR lowering + execution | Correctness | -- | PASS | -- |
| B2: FX MLP optimization | Node count | -- | -- | --% |
| B2: FX MLP optimization | Est. memory traffic | -- GB | -- GB | --% |
| B2: FX Transformer block | Node count | -- | -- | --% |

---

## Grading Rubric

| Component | Points |
|---|---|
| **Part A** | **50** |
| A1: Fusion legality analysis | 15 |
| A2: Memory traffic analysis | 15 |
| A3: Polyhedral analysis of convolution | 10 |
| A4: Data layout trade-offs | 10 |
| **Part B** | **50** |
| B1.1: MLIR dialect definition (TableGen + registration) | 8 |
| B1.2: MLIR fusion pass (3+ patterns, FileCheck tests) | 10 |
| B1.3: Lowering to linalg (runnable output) | 7 |
| B1.4: CSE/DCE + canonicalization patterns | 5 |
| B2.1: torch.fx pattern fusion | 8 |
| B2.2: Memory traffic estimator | 4 |
| B2.4: Full pipeline + benchmarking | 8 |

**Bonus points:**

- B2.3: FX-to-MLIR export with end-to-end test (+5)
- Custom canonicalization that folds constants through matmul (e.g., `matmul(A, scale * B)` -> `scale * matmul(A, B)`) (+3)
- Extend lowering to generate GPU code via `--convert-linalg-to-gpu` (+5)

---

## Hints and Tips

1. **Start with Part A** and with the MLIR dialect definition. Getting your dialect to build and register is the first milestone.

2. **MLIR build tip.** A minimal `CMakeLists.txt`:
   ```cmake
   cmake_minimum_required(VERSION 3.20)
   project(miniml-dialect)

   find_package(MLIR REQUIRED CONFIG)
   list(APPEND CMAKE_MODULE_PATH "${MLIR_CMAKE_DIR}")
   include(AddLLVM)
   include(AddMLIR)

   add_mlir_dialect(MiniML miniml)
   add_mlir_library(MiniMLDialect ...)
   add_mlir_library(MiniMLTransforms ...)
   ```

3. **Use the MLIR tutorials.** The official "Creating a Dialect" and "Toy Language" tutorials walk through exactly this workflow. Your dialect is simpler than Toy.

4. **FileCheck tests** are the standard MLIR testing methodology. Each pass should have at least 2 FileCheck tests: one positive (pattern matches and transforms) and one negative (pattern does not match, IR unchanged).

5. **For lowering**, the path is: `miniml` -> `linalg` -> `scf` (loops) -> `cf` (control flow) -> `llvm`. Each step uses an existing MLIR conversion pass except the first (which you write). Test with: `mlir-opt input.mlir --miniml-lower-to-linalg --convert-linalg-to-loops --lower-affine --convert-scf-to-cf --convert-func-to-llvm | mlir-cpu-runner`.

6. **For torch.fx (B2)**, the API is the same as before. Use `torch.fx.passes.shape_prop.ShapeProp` for shape inference. Test each pass in isolation before composing.

---

*This homework accompanies Module 03 of the PhD ML Systems course.*
