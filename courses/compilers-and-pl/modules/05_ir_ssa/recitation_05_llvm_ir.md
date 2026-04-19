# Recitation 05: Working with LLVM IR

## Overview

This recitation provides hands-on experience with LLVM IR: reading and writing it by hand, using LLVM command-line tools, writing a simple optimization pass, and visualizing CFGs and dominator trees.

---

## 1. Reading and Writing LLVM IR

### 1.1 A Complete Example

```llvm
; factorial.ll
; int factorial(int n) {
;     if (n <= 1) return 1;
;     return n * factorial(n - 1);
; }

define i32 @factorial(i32 %n) {
entry:
    %cmp = icmp sle i32 %n, 1
    br i1 %cmp, label %base, label %recurse

base:
    ret i32 1

recurse:
    %n_minus_1 = sub i32 %n, 1
    %result = call i32 @factorial(i32 %n_minus_1)
    %product = mul i32 %n, %result
    ret i32 %product
}
```

### 1.2 Key Syntax Elements

**Types:**

```llvm
i1              ; 1-bit integer (boolean)
i8, i16, i32, i64  ; sized integers
float, double   ; IEEE floating point
ptr             ; opaque pointer (LLVM 15+)
void            ; no return value
[N x T]         ; array of N elements of type T
{T1, T2, ...}   ; struct
<N x T>         ; vector (SIMD)
```

**Instructions:**

```llvm
; Arithmetic
%r = add i32 %a, %b        ; addition
%r = sub i32 %a, %b        ; subtraction
%r = mul i32 %a, %b        ; multiplication
%r = sdiv i32 %a, %b       ; signed division
%r = srem i32 %a, %b       ; signed remainder

; Comparison
%c = icmp eq i32 %a, %b    ; integer compare (eq, ne, slt, sgt, sle, sge, ult, ...)
%c = fcmp olt float %a, %b ; float compare (oeq, ogt, olt, ...)

; Control flow
br i1 %cond, label %T, label %F   ; conditional branch
br label %target                    ; unconditional branch
ret i32 %val                        ; return
switch i32 %val, label %default [i32 0, label %case0  i32 1, label %case1]

; Memory
%p = alloca i32                     ; stack allocation
%v = load i32, ptr %p              ; load from memory
store i32 %val, ptr %p             ; store to memory
%q = getelementptr i32, ptr %p, i32 %idx  ; pointer arithmetic

; Phi
%x = phi i32 [%a, %block1], [%b, %block2]

; Function call
%r = call i32 @func(i32 %arg1, i32 %arg2)
```

### 1.3 Exercise: Hand-Write LLVM IR

Translate the following C function to LLVM IR by hand:

```c
int gcd(int a, int b) {
    while (b != 0) {
        int t = b;
        b = a % b;
        a = t;
    }
    return a;
}
```

**Solution:**

```llvm
define i32 @gcd(i32 %a0, i32 %b0) {
entry:
    br label %loop

loop:
    %a = phi i32 [%a0, %entry], [%b_val, %body]
    %b = phi i32 [%b0, %entry], [%rem, %body]
    %cond = icmp ne i32 %b, 0
    br i1 %cond, label %body, label %exit

body:
    %b_val = add i32 %b, 0       ; copy of b (or just use %b)
    %rem = srem i32 %a, %b
    br label %loop

exit:
    ret i32 %a
}
```

---

## 2. LLVM Command-Line Tools

### 2.1 Compilation Pipeline

```bash
# C source -> LLVM IR (textual)
clang -S -emit-llvm -O0 input.c -o input.ll

# C source -> LLVM IR (bitcode)
clang -c -emit-llvm -O0 input.c -o input.bc

# LLVM bitcode -> textual IR
llvm-dis input.bc -o input.ll

# Textual IR -> bitcode
llvm-as input.ll -o input.bc

# Run optimizer
opt -passes='mem2reg,instcombine,simplifycfg' input.ll -S -o optimized.ll

# Compile to assembly
llc input.ll -o output.s

# Compile to object file
llc -filetype=obj input.ll -o output.o
```

### 2.2 Useful opt Passes

```bash
# Promote allocas to SSA registers
opt -passes='mem2reg' input.ll -S

# Combine instructions (algebraic simplifications)
opt -passes='instcombine' input.ll -S

# Simplify CFG (merge blocks, remove unreachable code)
opt -passes='simplifycfg' input.ll -S

# Inline functions
opt -passes='inline' input.ll -S

# Global value numbering
opt -passes='gvn' input.ll -S

# Sparse conditional constant propagation
opt -passes='sccp' input.ll -S

# Loop-invariant code motion
opt -passes='licm' input.ll -S

# Dead code elimination
opt -passes='dce' input.ll -S

# Full O2 pipeline
opt -O2 input.ll -S -o optimized.ll

# Print analysis results
opt -passes='print<domtree>' input.ll -disable-output
opt -passes='print<loops>' input.ll -disable-output
```

### 2.3 Exercise: Observe Optimizations

Start with:

```llvm
define i32 @example(i32 %n) {
entry:
    %a = alloca i32
    %b = alloca i32
    store i32 %n, ptr %a
    %x = load i32, ptr %a
    %y = add i32 %x, 0          ; add zero (identity)
    %z = mul i32 %y, 1          ; multiply by one (identity)
    store i32 %z, ptr %b
    %w = load i32, ptr %b
    ret i32 %w
}
```

Run each pass individually and observe the transformations:

```bash
# Step 1: mem2reg (promote alloca to SSA)
opt -passes='mem2reg' example.ll -S
# Expected: alloca/load/store eliminated, replaced with SSA values

# Step 2: instcombine (simplify arithmetic)
opt -passes='mem2reg,instcombine' example.ll -S
# Expected: add 0 and mul 1 eliminated

# Step 3: Full pipeline
opt -O2 example.ll -S
# Expected: function simplified to just "ret i32 %n"
```

---

## 3. Writing a Simple LLVM Pass

### 3.1 Pass Framework (New Pass Manager)

A minimal LLVM pass that counts instructions:

```cpp
// InstructionCount.cpp
#include "llvm/IR/Function.h"
#include "llvm/IR/PassManager.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Passes/PassPlugin.h"
#include "llvm/Support/raw_ostream.h"

using namespace llvm;

struct InstructionCountPass : public PassInfoMixin<InstructionCountPass> {
    PreservedAnalyses run(Function &F, FunctionAnalysisManager &FAM) {
        int count = 0;
        for (BasicBlock &BB : F) {
            count += BB.size();
        }
        errs() << "Function " << F.getName()
               << " has " << count << " instructions\n";
        return PreservedAnalyses::all();
    }
};

// Plugin registration
extern "C" LLVM_ATTRIBUTE_WEAK PassPluginLibraryInfo llvmGetPassPluginInfo() {
    return {
        LLVM_PLUGIN_API_VERSION, "InstructionCount", "v0.1",
        [](PassBuilder &PB) {
            PB.registerPipelineParsingCallback(
                [](StringRef Name, FunctionPassManager &FPM,
                   ArrayRef<PassBuilder::PipelineElement>) {
                    if (Name == "instruction-count") {
                        FPM.addPass(InstructionCountPass());
                        return true;
                    }
                    return false;
                });
        }
    };
}
```

Build and run:

```bash
# Build (assuming LLVM is installed)
clang++ -shared -fPIC -o InstructionCount.so InstructionCount.cpp \
    $(llvm-config --cxxflags --ldflags --libs)

# Run
opt -load-pass-plugin=./InstructionCount.so \
    -passes='instruction-count' input.ll -disable-output
```

### 3.2 Exercise: Write a Constant Folder Pass

Write a pass that replaces `add i32 C1, C2` (where both operands are constants) with the computed result.

```cpp
struct ConstFoldPass : public PassInfoMixin<ConstFoldPass> {
    PreservedAnalyses run(Function &F, FunctionAnalysisManager &FAM) {
        bool changed = false;
        for (BasicBlock &BB : F) {
            for (auto I = BB.begin(); I != BB.end(); ) {
                Instruction &Inst = *I++;
                if (auto *BO = dyn_cast<BinaryOperator>(&Inst)) {
                    if (auto *C1 = dyn_cast<ConstantInt>(BO->getOperand(0))) {
                        if (auto *C2 = dyn_cast<ConstantInt>(BO->getOperand(1))) {
                            Constant *Result = ConstantFoldBinaryOpOperands(
                                BO->getOpcode(), C1, C2, F.getDataLayout());
                            if (Result) {
                                Inst.replaceAllUsesWith(Result);
                                Inst.eraseFromParent();
                                changed = true;
                            }
                        }
                    }
                }
            }
        }
        return changed ? PreservedAnalyses::none()
                       : PreservedAnalyses::all();
    }
};
```

---

## 4. Visualizing CFGs and Dominator Trees

### 4.1 Generating DOT Files

```bash
# Generate CFG DOT file
opt -passes='dot-cfg' input.ll -disable-output
# Creates .funcname.dot for each function

# Generate dominator tree DOT file
opt -passes='dot-dom' input.ll -disable-output
# Creates .funcname.dom.dot

# Generate post-dominator tree
opt -passes='dot-postdom' input.ll -disable-output

# Render to PNG
dot -Tpng .factorial.dot -o factorial_cfg.png
dot -Tpng .factorial.dom.dot -o factorial_dom.png
```

### 4.2 Reading CFG Visualizations

In the DOT output:
- Each box is a basic block with its label and instructions.
- Solid edges are control flow.
- For conditional branches, edges are labeled with the branch condition.
- The entry block is typically at the top.

### 4.3 Exercise: Analyze a Loop

Write this function in LLVM IR:

```c
int sum(int n) {
    int s = 0;
    for (int i = 0; i < n; i++) {
        s += i;
    }
    return s;
}
```

1. Generate the CFG and identify basic blocks, loop header, latch, and exit.
2. Generate the dominator tree and verify that the loop header dominates the loop body and latch.
3. Run `mem2reg` and observe how the IR changes to SSA form with phi functions.
4. Run SCCP and observe if any constants are propagated.

---

## 5. Exploring SSA Properties

### 5.1 Exercise: Manual SSA Construction

Given this non-SSA IR:

```
B0: x = 1
    y = 2
    if (x > 0) goto B1 else B2

B1: x = y + 1
    goto B3

B2: y = x + 3
    goto B3

B3: z = x + y
    return z
```

1. Compute the dominator tree.
2. Compute dominance frontiers for each block.
3. Determine which variables need phi functions and at which blocks.
4. Insert phi functions and rename variables.
5. Verify: Does `opt -passes='mem2reg'` produce the same result when you encode this in LLVM IR with alloca/load/store?

### 5.2 Exercise: Observe GVN

```llvm
define i32 @redundant(i32 %a, i32 %b) {
entry:
    %x = add i32 %a, %b
    %y = add i32 %a, %b     ; redundant
    %z = add i32 %x, %y
    ret i32 %z
}
```

Run `opt -passes='gvn' -S` and verify that `%y` is eliminated and `%z = add i32 %x, %x`.

---

## 6. Putting It All Together

### 6.1 Full Pipeline Exploration

Take a non-trivial C function (e.g., matrix multiply, binary search, linked list traversal):

1. Compile to unoptimized LLVM IR: `clang -S -emit-llvm -O0`
2. Run `mem2reg` to get SSA form.
3. Apply optimizations one at a time and observe changes.
4. Compare with `-O2` output.
5. Compile to assembly and observe the final machine code.

### 6.2 Useful Commands Summary

| Command | Purpose |
|---------|---------|
| `clang -S -emit-llvm -O0 f.c` | C to LLVM IR |
| `opt -passes='mem2reg' -S` | Promote to SSA |
| `opt -passes='dot-cfg'` | CFG visualization |
| `opt -passes='print<domtree>'` | Print dominator tree |
| `opt -passes='print<loops>'` | Print loop info |
| `opt -O2 -S` | Full optimization |
| `llc -O0` | IR to assembly |
| `llvm-dis` | Bitcode to text |

---

## References

1. LLVM Language Reference Manual: https://llvm.org/docs/LangRef.html
2. LLVM Programmer's Manual: https://llvm.org/docs/ProgrammersManual.html
3. Writing an LLVM Pass: https://llvm.org/docs/WritingAnLLVMNewPMPass.html
4. Lattner, C. & Adve, V. (2004). "LLVM: A Compilation Framework for Lifelong Program Analysis & Transformation." *CGO*.
