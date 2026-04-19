# Recitation 03: Writing a Custom Compiler Pass

## Overview

This recitation is a hands-on walkthrough split into two halves. The first half covers building a custom MLIR dialect in C++, writing rewrite patterns, and lowering to standard dialects. The second half gives a condensed tour of `torch.fx` graph capture and passes in Python. Together, these two halves prepare you for HW03, which requires defining a `miniml` dialect, writing fusion passes, lowering to `linalg`, and writing FileCheck tests.

**Prerequisites:** Lectures 03a (Graph IR & Optimization Passes), 03d (torch.compile & Inductor). Familiarity with C++ and CMake.

---

## Part I: MLIR C++ Walkthrough

---

## 1. Setting Up an MLIR Project

### 1.1 Directory Layout

A minimal out-of-tree MLIR project has this structure:

```
toy-dialect/
  CMakeLists.txt
  include/
    Toy/
      ToyDialect.td        # TableGen dialect definition
      ToyOps.td             # TableGen op definitions
      ToyDialect.h          # Generated + hand-written dialect header
      ToyOps.h              # Generated + hand-written ops header
  lib/
    Toy/
      ToyDialect.cpp        # Dialect registration
      ToyOps.cpp            # Op verification, canonicalization
  tools/
    toy-opt/
      toy-opt.cpp           # Custom mlir-opt driver
  test/
    lit.cfg.py
    toy-canonicalize.mlir   # FileCheck tests
```

### 1.2 CMakeLists.txt

The root `CMakeLists.txt` links against an installed MLIR build:

```cmake
cmake_minimum_required(VERSION 3.20)
project(ToyDialect LANGUAGES CXX C)

set(CMAKE_CXX_STANDARD 17)

find_package(MLIR REQUIRED CONFIG)

list(APPEND CMAKE_MODULE_PATH "${MLIR_CMAKE_DIR}")
list(APPEND CMAKE_MODULE_PATH "${LLVM_CMAKE_DIR}")

include(TableGen)
include(AddLLVM)
include(AddMLIR)

include_directories(${LLVM_INCLUDE_DIRS})
include_directories(${MLIR_INCLUDE_DIRS})
include_directories(${PROJECT_SOURCE_DIR}/include)
include_directories(${PROJECT_BINARY_DIR}/include)

add_subdirectory(include/Toy)
add_subdirectory(lib/Toy)
add_subdirectory(tools/toy-opt)
```

### 1.3 Building and Running

```bash
# Configure (point to your MLIR install)
cmake -B build -G Ninja \
  -DMLIR_DIR=/path/to/llvm-install/lib/cmake/mlir \
  -DLLVM_DIR=/path/to/llvm-install/lib/cmake/llvm

# Build
cmake --build build

# Run the custom opt tool
./build/tools/toy-opt/toy-opt input.mlir --toy-canonicalize
```

The `toy-opt` binary is a thin wrapper around MLIR's `MlirOptMain`. It registers our dialect and passes, then delegates to the standard `mlir-opt` infrastructure for parsing, running passes, and printing IR.

---

## 2. Defining a Dialect in TableGen

### 2.1 The Dialect Definition

TableGen is MLIR's domain-specific language for declaring dialects, operations, types, and attributes. Here is a minimal dialect definition.

`include/Toy/ToyDialect.td`:

```tablegen
#ifndef TOY_DIALECT
#define TOY_DIALECT

include "mlir/IR/OpBase.td"

def Toy_Dialect : Dialect {
  let name = "toy";
  let summary = "A minimal toy dialect for teaching MLIR.";
  let cppNamespace = "::toy";
}

#endif // TOY_DIALECT
```

### 2.2 Defining Operations

`include/Toy/ToyOps.td`:

```tablegen
#ifndef TOY_OPS
#define TOY_OPS

include "Toy/ToyDialect.td"
include "mlir/IR/OpBase.td"
include "mlir/Interfaces/SideEffectInterfaces.td"

class Toy_Op<string mnemonic, list<Trait> traits = []>
    : Op<Toy_Dialect, mnemonic, traits>;

def Toy_ConstantOp : Toy_Op<"constant", [Pure]> {
  let summary = "constant tensor value";
  let arguments = (ins F64ElementsAttr:$value);
  let results = (outs F64Tensor:$result);

  let assemblyFormat = "attr-dict `:` type($result)";
}

def Toy_AddOp : Toy_Op<"add", [Pure]> {
  let summary = "element-wise addition";
  let arguments = (ins F64Tensor:$lhs, F64Tensor:$rhs);
  let results = (outs F64Tensor:$result);

  let assemblyFormat = "$lhs `,` $rhs attr-dict `:` type($result)";
  let hasCanonicalizer = 1;  // we will attach canonicalization patterns
}

#endif // TOY_OPS
```

Key points:
- `Pure` means the op has no side effects, which lets DCE remove it if the result is unused.
- `hasCanonicalizer = 1` tells MLIR's tablegen backend to generate hooks that we will fill in with rewrite patterns.
- The `assemblyFormat` string defines how the op is printed and parsed. For `toy.add`, the textual form is: `%r = toy.add %a, %b : tensor<4xf64>`.

### 2.3 Generated Headers and Registration

The TableGen CMake rules generate `ToyDialect.h.inc`, `ToyDialect.cpp.inc`, `ToyOps.h.inc`, and `ToyOps.cpp.inc`. You include these in your hand-written files.

`lib/Toy/ToyDialect.cpp`:

```cpp
#include "Toy/ToyDialect.h"
#include "Toy/ToyOps.h"

// Include the auto-generated dialect definition
#include "Toy/ToyDialect.cpp.inc"

using namespace toy;

void ToyDialect::initialize() {
  addOperations<
#define GET_OP_LIST
#include "Toy/ToyOps.cpp.inc"
      >();
}
```

`tools/toy-opt/toy-opt.cpp`:

```cpp
#include "mlir/Tools/mlir-opt/MlirOptMain.h"
#include "mlir/IR/DialectRegistry.h"
#include "Toy/ToyDialect.h"
#include "Toy/ToyOps.h"

int main(int argc, char **argv) {
  mlir::DialectRegistry registry;
  registry.insert<toy::ToyDialect>();

  return mlir::asMainReturnCode(
      mlir::MlirOptMain(argc, argv, "Toy optimizer driver\n", registry));
}
```

### 2.4 Parsing and Printing

Once the project builds, you can parse and round-trip toy IR:

```mlir
// input.mlir
func.func @add_example(%arg0: tensor<4xf64>, %arg1: tensor<4xf64>)
    -> tensor<4xf64> {
  %0 = toy.add %arg0, %arg1 : tensor<4xf64>
  return %0 : tensor<4xf64>
}
```

```bash
$ toy-opt input.mlir
# Prints the IR back, confirming parsing works.
```

---

## 3. Writing a RewritePattern

### 3.1 The Pattern: Fold `toy.add(x, 0)` to `x`

A `RewritePattern` (or `OpRewritePattern`) is the fundamental unit of transformation in MLIR. We implement one that folds addition with a zero constant.

```cpp
#include "Toy/ToyOps.h"
#include "mlir/IR/PatternMatch.h"
#include "mlir/IR/Matchers.h"

namespace toy {

/// Fold toy.add(x, 0) -> x and toy.add(0, x) -> x.
struct FoldAddZero : public mlir::OpRewritePattern<AddOp> {
  using OpRewritePattern::OpRewritePattern;

  mlir::LogicalResult
  matchAndRewrite(AddOp op, mlir::PatternRewriter &rewriter) const override {
    // Check if the RHS is a constant zero
    if (mlir::matchPattern(op.getRhs(), mlir::m_AnyZeroFloat())) {
      rewriter.replaceOp(op, op.getLhs());
      return mlir::success();
    }
    // Check if the LHS is a constant zero
    if (mlir::matchPattern(op.getLhs(), mlir::m_AnyZeroFloat())) {
      rewriter.replaceOp(op, op.getRhs());
      return mlir::success();
    }
    return mlir::failure();
  }
};

} // namespace toy
```

### 3.2 Registering as a Canonicalization Pattern

Because we declared `let hasCanonicalizer = 1` on `Toy_AddOp`, we implement `getCanonicalizationPatterns`:

```cpp
void AddOp::getCanonicalizationPatterns(mlir::RewritePatternSet &results,
                                        mlir::MLIRContext *context) {
  results.add<FoldAddZero>(context);
}
```

Now `--canonicalize` will automatically run our pattern.

### 3.3 Testing with FileCheck

`test/toy-canonicalize.mlir`:

```mlir
// RUN: toy-opt %s --canonicalize | FileCheck %s

func.func @add_zero(%arg0: tensor<4xf64>) -> tensor<4xf64> {
  %zero = toy.constant dense<0.0> : tensor<4xf64>
  %0 = toy.add %arg0, %zero : tensor<4xf64>
  return %0 : tensor<4xf64>
}

// The add and the constant should be removed (DCE after canonicalize):
// CHECK-LABEL: func.func @add_zero
// CHECK-NEXT:    return %arg0 : tensor<4xf64>
// CHECK-NOT:     toy.add
```

Run:

```bash
$ llvm-lit test/toy-canonicalize.mlir -v
```

FileCheck reads the `CHECK` directives and verifies that the output of `toy-opt` matches. `CHECK-NOT` asserts that the pattern does not appear, confirming the add was eliminated.

---

## 4. Writing a Conversion/Lowering Pass

### 4.1 Goal

Lower `toy.add` to `arith.addf`. This demonstrates MLIR's dialect conversion framework: `ConversionTarget`, `TypeConverter`, and `ConversionPattern`.

### 4.2 The Conversion Pattern

```cpp
#include "Toy/ToyOps.h"
#include "mlir/Dialect/Arith/IR/Arith.h"
#include "mlir/Transforms/DialectConversion.h"

namespace {

struct LowerToyAdd : public mlir::OpConversionPattern<toy::AddOp> {
  using OpConversionPattern::OpConversionPattern;

  mlir::LogicalResult matchAndRewrite(
      toy::AddOp op, OpAdaptor adaptor,
      mlir::ConversionPatternRewriter &rewriter) const override {
    // Replace toy.add with arith.addf on the converted operands
    rewriter.replaceOpWithNewOp<mlir::arith::AddFOp>(
        op, adaptor.getLhs(), adaptor.getRhs());
    return mlir::success();
  }
};

} // namespace
```

### 4.3 The Lowering Pass

```cpp
#include "mlir/Pass/Pass.h"
#include "mlir/Dialect/Arith/IR/Arith.h"

namespace {

struct ToyLowerToArithPass
    : public mlir::PassWrapper<ToyLowerToArithPass,
                                mlir::OperationPass<mlir::ModuleOp>> {
  void getDependentDialects(mlir::DialectRegistry &registry) const override {
    registry.insert<mlir::arith::ArithDialect>();
  }

  void runOnOperation() override {
    mlir::ConversionTarget target(getContext());

    // The arith dialect is legal (lowering target)
    target.addLegalDialect<mlir::arith::ArithDialect>();
    // func dialect ops are legal (we are not lowering them)
    target.addLegalOp<mlir::func::FuncOp, mlir::func::ReturnOp>();
    // toy.add is illegal (must be converted)
    target.addIllegalOp<toy::AddOp>();

    mlir::RewritePatternSet patterns(&getContext());
    patterns.add<LowerToyAdd>(&getContext());

    if (mlir::failed(mlir::applyPartialConversion(
            getOperation(), target, std::move(patterns))))
      signalPassFailure();
  }
};

} // namespace

// Register the pass so it can be invoked from the command line.
std::unique_ptr<mlir::Pass> createToyLowerToArithPass() {
  return std::make_unique<ToyLowerToArithPass>();
}
```

### 4.4 Testing the Lowering

```mlir
// RUN: toy-opt %s --toy-lower-to-arith | FileCheck %s

func.func @lower_add(%arg0: tensor<4xf64>, %arg1: tensor<4xf64>)
    -> tensor<4xf64> {
  %0 = toy.add %arg0, %arg1 : tensor<4xf64>
  return %0 : tensor<4xf64>
}

// CHECK-LABEL: func.func @lower_add
// CHECK:         arith.addf
// CHECK-NOT:     toy.add
```

The `ConversionTarget` marks `toy.add` as illegal and `arith.addf` as legal. If any `toy.add` survives, the pass fails with an error. This is how MLIR guarantees complete lowering.

### 4.5 TypeConverter (When Needed)

In our simple case, types are unchanged (both sides use `tensor<4xf64>`). When the source and target dialects use different type systems, you provide a `TypeConverter`:

```cpp
mlir::TypeConverter typeConverter;
typeConverter.addConversion([](mlir::Float64Type type) {
  return type;  // f64 maps to f64
});
typeConverter.addConversion([](mlir::RankedTensorType type) {
  return type;  // tensors pass through unchanged
});
```

You pass the converter to `patterns.add<LowerToyAdd>(typeConverter, &getContext())` and to `applyPartialConversion`. For HW03, you will need a `TypeConverter` when lowering `miniml` tensors to `linalg` memref types.

---

## 5. Running the Pipeline End-to-End

Chain passes on the command line just like `opt` in LLVM:

```bash
$ toy-opt input.mlir \
    --canonicalize \
    --toy-lower-to-arith \
    --convert-arith-to-llvm \
  | mlir-cpu-runner \
    --shared-libs=/path/to/libmlir_runner_utils.so \
    --entry-point-result=void
```

Pass ordering matters. Canonicalize first to simplify the IR (e.g., fold add-zero) before lowering. After lowering to `arith`, use the upstream `--convert-arith-to-llvm` pass to get LLVM dialect IR, and `mlir-cpu-runner` to JIT-execute.

In practice, you compose passes into a pipeline inside C++ instead of chaining on the command line:

```cpp
mlir::PassManager pm(&context);
pm.addPass(mlir::createCanonicalizerPass());
pm.addPass(createToyLowerToArithPass());
pm.addPass(mlir::createConvertArithToLLVMPass());
if (mlir::failed(pm.run(module)))
  return 1;
```

---

## Part II: torch.fx Graph Capture

---

## 6. torch.fx Overview

`torch.fx` is PyTorch's Python-level tracing and transformation framework. `torch.fx.symbolic_trace` executes your model with proxy tensors to record a graph of operations without running real computation.

The resulting `Graph` is a DAG of `Node` objects. Each node has an `op` field (one of `placeholder`, `call_function`, `call_method`, `call_module`, `get_attr`, `output`) and a `target` (the function or method being called). Edges are implicit: a node's `args` and `kwargs` refer to other nodes by identity.

```python
import torch
import torch.fx

def example_fn(x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    t = x + y
    a = torch.relu(t)
    t2 = x + y           # duplicate computation
    b = torch.relu(t2)   # duplicate computation
    return a * b

traced = torch.fx.symbolic_trace(example_fn)
traced.graph.print_tabular()
```

This prints a table showing each node, its op, target, and arguments. The duplicate `x + y` and `relu` nodes are visible in the graph and are candidates for CSE.

---

## 7. Writing an FX Pass: CSE

Common subexpression elimination on an FX graph works the same way as in any compiler: hash each node by (op, target, args), and if a duplicate is found, redirect all users to the first occurrence.

```python
from torch.fx import GraphModule, Node
from typing import Dict

def fx_cse(gm: GraphModule) -> GraphModule:
    graph = gm.graph
    seen: Dict[tuple, Node] = {}
    eliminated = 0

    def make_key(node: Node) -> tuple:
        def val_key(v):
            if isinstance(v, Node):
                return ("node", v.name)
            return ("lit", v)
        args_key = tuple(val_key(a) for a in node.args)
        kwargs_key = tuple(
            (k, val_key(v)) for k, v in sorted(node.kwargs.items())
        )
        return (node.op, node.target, args_key, kwargs_key)

    for node in list(graph.nodes):
        if node.op in ("placeholder", "output", "get_attr"):
            continue
        key = make_key(node)
        if key in seen:
            node.replace_all_uses_with(seen[key])
            graph.erase_node(node)
            eliminated += 1
        else:
            seen[key] = node

    gm.recompile()
    print(f"CSE eliminated {eliminated} nodes")
    return gm
```

Apply it to the traced graph and verify correctness:

```python
traced = fx_cse(traced)
x, y = torch.randn(4, 4), torch.randn(4, 4)
assert torch.allclose(example_fn(x, y), traced(x, y))
```

---

## 8. Connecting FX to MLIR

In a production compiler like `torch-mlir`, the `torch.fx` graph is exported to MLIR's textual format and then processed by MLIR passes. The conceptual flow is:

1. `torch.fx.symbolic_trace` (or `torch.export`) captures a Python-level graph.
2. A Python exporter walks the FX nodes and emits MLIR text (e.g., `torch.aten.add` ops in the `torch` dialect).
3. MLIR passes lower `torch` -> `linalg` -> `llvm`.
4. `mlir-cpu-runner` or a GPU backend executes the result.

For HW03 (bonus), you will write a simple exporter that converts a small FX graph to your `miniml` dialect text format. The key mapping is straightforward:

| FX node | MLIR op |
|---|---|
| `call_function(operator.add, (a, b))` | `miniml.add %a, %b` |
| `call_function(torch.relu, (x,))` | `miniml.relu %x` |
| `placeholder` | block argument (`%arg0`, etc.) |
| `output` | `return` |

The exporter walks nodes in topological order (which FX guarantees) and emits one MLIR op per node.

---

## 9. Exercises

### Exercise 3R.1: Extend the Toy Dialect with `toy.relu`

Add a `toy.relu` operation to `ToyOps.td`:
- It takes one `F64Tensor` input and produces one `F64Tensor` output.
- Mark it `Pure`.
- Give it `hasCanonicalizer = 1` so you can attach patterns later.
- Write a FileCheck test that round-trips `toy.relu` through `toy-opt`.

### Exercise 3R.2: Fusion Pattern (`toy.add` + `toy.relu` -> `toy.fused_add_relu`)

First, define a `Toy_FusedAddReluOp` in TableGen that takes two `F64Tensor` inputs and produces one `F64Tensor` output.

Then write a `RewritePattern` that matches the sequence:

```mlir
%add = toy.add %x, %y : tensor<4xf64>
%out = toy.relu %add : tensor<4xf64>
```

and replaces it with:

```mlir
%out = toy.fused_add_relu %x, %y : tensor<4xf64>
```

The pattern should only fire when `%add` has no other users (otherwise the add result is still needed).

```cpp
struct FuseAddRelu : public mlir::OpRewritePattern<toy::ReluOp> {
  using OpRewritePattern::OpRewritePattern;

  mlir::LogicalResult
  matchAndRewrite(toy::ReluOp relu,
                  mlir::PatternRewriter &rewriter) const override {
    // Check if the input to relu is a toy.add
    auto addOp = relu.getInput().getDefiningOp<toy::AddOp>();
    if (!addOp)
      return mlir::failure();

    // Only fuse if the add result is used solely by this relu
    if (!addOp.getResult().hasOneUse())
      return mlir::failure();

    rewriter.replaceOpWithNewOp<toy::FusedAddReluOp>(
        relu, relu.getType(), addOp.getLhs(), addOp.getRhs());
    rewriter.eraseOp(addOp);
    return mlir::success();
  }
};
```

### Exercise 3R.3: FileCheck Test for the Fusion

Write a test that verifies the fusion fires and that unfusible cases are left alone:

```mlir
// RUN: toy-opt %s --canonicalize | FileCheck %s

// Case 1: Should fuse (add result used only by relu).
func.func @should_fuse(%arg0: tensor<4xf64>, %arg1: tensor<4xf64>)
    -> tensor<4xf64> {
  %0 = toy.add %arg0, %arg1 : tensor<4xf64>
  %1 = toy.relu %0 : tensor<4xf64>
  return %1 : tensor<4xf64>
}
// CHECK-LABEL: func.func @should_fuse
// CHECK:         toy.fused_add_relu
// CHECK-NOT:     toy.add
// CHECK-NOT:     toy.relu

// Case 2: Should NOT fuse (add result used by relu AND returned).
func.func @should_not_fuse(%arg0: tensor<4xf64>, %arg1: tensor<4xf64>)
    -> (tensor<4xf64>, tensor<4xf64>) {
  %0 = toy.add %arg0, %arg1 : tensor<4xf64>
  %1 = toy.relu %0 : tensor<4xf64>
  return %0, %1 : tensor<4xf64>, tensor<4xf64>
}
// CHECK-LABEL: func.func @should_not_fuse
// CHECK:         toy.add
// CHECK:         toy.relu
// CHECK-NOT:     toy.fused_add_relu
```

### Exercise 3R.4 (Bonus): Lower `toy.relu` to `arith.maxf`

Write a `ConversionPattern` that lowers `toy.relu %x` to `arith.maxf(%x, 0.0)`:

```cpp
struct LowerToyRelu : public mlir::OpConversionPattern<toy::ReluOp> {
  using OpConversionPattern::OpConversionPattern;

  mlir::LogicalResult matchAndRewrite(
      toy::ReluOp op, OpAdaptor adaptor,
      mlir::ConversionPatternRewriter &rewriter) const override {
    auto loc = op.getLoc();
    auto type = op.getType();

    // Create a splat constant of 0.0 with the same tensor type
    auto zeroAttr = rewriter.getFloatAttr(
        rewriter.getF64Type(), 0.0);
    auto splatAttr = mlir::DenseElementsAttr::get(
        type.cast<mlir::ShapedType>(), zeroAttr);
    auto zero = rewriter.create<mlir::arith::ConstantOp>(loc, splatAttr);

    rewriter.replaceOpWithNewOp<mlir::arith::MaxFOp>(
        op, adaptor.getInput(), zero);
    return mlir::success();
  }
};
```

Add this pattern to your `ToyLowerToArithPass` alongside `LowerToyAdd`, and mark `toy::ReluOp` as illegal in the `ConversionTarget`. Write a FileCheck test that verifies `toy.relu` is replaced by `arith.maxf`.

---

## 10. Quick Reference

### MLIR Key Types

```
mlir::MLIRContext        - owns all IR objects
mlir::ModuleOp           - top-level container (like a translation unit)
mlir::Operation          - generic operation (base of all ops)
mlir::Value              - SSA value (result of an op or block argument)
mlir::Block              - sequence of operations
mlir::Region             - set of blocks (e.g., function body)
```

### Pattern API

```
mlir::OpRewritePattern<OpTy>
  matchAndRewrite(OpTy op, PatternRewriter &rewriter) -> LogicalResult
  rewriter.replaceOp(op, newValues)
  rewriter.replaceOpWithNewOp<NewOpTy>(op, ...)
  rewriter.eraseOp(op)

mlir::OpConversionPattern<OpTy>
  matchAndRewrite(OpTy op, OpAdaptor adaptor, ConversionPatternRewriter &)
```

### Conversion Framework

```
mlir::ConversionTarget target(ctx);
  target.addLegalDialect<TargetDialect>();
  target.addIllegalOp<SourceOp>();

mlir::RewritePatternSet patterns(&ctx);
  patterns.add<MyPattern>(&ctx);

mlir::applyPartialConversion(module, target, std::move(patterns));
mlir::applyFullConversion(module, target, std::move(patterns));
```

### FileCheck Essentials

```
// RUN: tool %s [flags] | FileCheck %s     <- how to invoke
// CHECK:       <pattern>                   <- line must appear
// CHECK-NEXT:  <pattern>                   <- must be the very next line
// CHECK-NOT:   <pattern>                   <- must NOT appear
// CHECK-LABEL: func.func @name            <- anchors subsequent checks
// CHECK-DAG:   <pattern>                   <- order-independent check
```

### torch.fx API

```python
torch.fx.symbolic_trace(fn)        # -> GraphModule
gm.graph.nodes                     # -> Iterator[Node]
gm.graph.print_tabular()           # pretty-print the graph
node.op                            # "placeholder", "call_function", ...
node.target                        # the function/method being called
node.args / node.kwargs             # arguments
node.replace_all_uses_with(new)    # redirect users
graph.erase_node(node)             # remove node (must have no users)
gm.recompile()                     # regenerate forward() from graph
```

---

*This recitation accompanies Module 03 of the PhD ML Systems course.*
