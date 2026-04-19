# Lecture 05a: Intermediate Representations

## 1. Introduction

An **intermediate representation** (IR) is the data structure used internally by a compiler to represent the program being compiled. The IR serves as the common language between the frontend (parsing, semantic analysis) and the backend (optimization, code generation).

**Design goals:**
- Easy to produce from the source AST.
- Easy to translate to target machine code.
- Amenable to analysis and transformation (optimization).
- Expressive enough to represent all source language features.

Most production compilers use multiple IRs at different levels of abstraction.

---

## 2. AST-Based Representations

### 2.1 Abstract Syntax Trees

The AST is the most direct IR: a tree representation of the parsed program with syntactic sugar removed.

```
// Source: x = a * b + c * d
// AST:
       Assign
      /      \
     x       Add
            /   \
         Mul     Mul
        / \     / \
       a   b   c   d
```

**Advantages:**
- Directly mirrors the source structure.
- Natural for source-level analyses (type checking, name resolution).
- Easy to pretty-print back to source code.

**Disadvantages:**
- Tree structure does not expose control flow.
- Common subexpressions are not shared (in a pure tree).
- Far from machine code: no notion of registers, instructions, or addresses.

### 2.2 Directed Acyclic Graphs (DAGs)

A DAG extends the AST by sharing common subexpressions:

```
// x = a * b + a * b
// DAG:
       Assign
      /      \
     x       Add
            /   \
         Mul  ---+   (shared node)
        / \
       a   b
```

DAGs enable immediate detection of redundant computation.

---

## 3. Three-Address Code

### 3.1 Definition

**Three-address code** (TAC) is a linear IR where each instruction has at most one operator and up to three operands. Every intermediate result is given a name (temporary variable).

General form: `x = y op z` or `x = op y` or `x = y`

### 3.2 Instruction Types

```
// Arithmetic
t1 = a + b
t2 = c * d
t3 = t1 - t2

// Assignment
x = t3

// Conditional branch
if t1 < t2 goto L1

// Unconditional branch
goto L2

// Label
L1:

// Function call
t4 = call f(a1, a2, ..., an)

// Return
return t4

// Memory operations
t5 = load [addr]
store [addr], t5

// Pointer arithmetic
t6 = &x
t7 = *t6
```

### 3.3 Representations in Memory

**Quadruples:** $(op, arg_1, arg_2, result)$

| Index | Op | Arg1 | Arg2 | Result |
|-------|----|------|------|--------|
| 0 | mul | a | b | t1 |
| 1 | mul | c | d | t2 |
| 2 | add | t1 | t2 | t3 |
| 3 | assign | t3 | -- | x |

**Triples:** $(op, arg_1, arg_2)$ where the result is implicit (referenced by instruction index).

| Index | Op | Arg1 | Arg2 |
|-------|----|------|------|
| 0 | mul | a | b |
| 1 | mul | c | d |
| 2 | add | (0) | (1) |
| 3 | assign | x | (2) |

**Triples** are more compact but harder to reorder (instructions reference each other by position). **Indirect triples** use a separate list of pointers into the triple array, allowing reordering.

### 3.4 Generating Three-Address Code from ASTs

```
function gen_tac(node):
    match node with
    | IntLit(n):
        return n    // literal is its own operand

    | Var(x):
        return x

    | BinOp(op, left, right):
        t1 := gen_tac(left)
        t2 := gen_tac(right)
        t := fresh_temp()
        emit(t = t1 op t2)
        return t

    | Assign(x, expr):
        t := gen_tac(expr)
        emit(x = t)
        return x

    | If(cond, then_block, else_block):
        t := gen_tac(cond)
        L_else := fresh_label()
        L_end := fresh_label()
        emit(if_false t goto L_else)
        gen_tac(then_block)
        emit(goto L_end)
        emit(L_else:)
        gen_tac(else_block)
        emit(L_end:)

    | While(cond, body):
        L_start := fresh_label()
        L_end := fresh_label()
        emit(L_start:)
        t := gen_tac(cond)
        emit(if_false t goto L_end)
        gen_tac(body)
        emit(goto L_start)
        emit(L_end:)
```

---

## 4. Stack-Based IRs

### 4.1 Concept

A **stack-based IR** uses an implicit operand stack instead of named temporaries. Operations pop operands from the stack and push results.

### 4.2 JVM Bytecode

The Java Virtual Machine uses a stack-based IR:

```
// Source: x = a + b * c
// JVM bytecode:
iload a       // push a
iload b       // push b
iload c       // push c
imul          // pop b, c; push b*c
iadd          // pop a, b*c; push a+b*c
istore x     // pop result; store to x
```

**Advantages:**
- Compact encoding (no explicit operand names).
- Simple to generate from ASTs (post-order traversal).
- Portable (stack is an abstraction).

**Disadvantages:**
- Implicit data flow makes analysis harder.
- Must convert to register form for efficient execution (stack-to-register mapping).
- Does not directly model register machines.

### 4.3 WebAssembly

WebAssembly (Wasm) uses a structured stack-based IR with explicit types:

```wasm
(func $add (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.add)
```

Wasm's structured control flow (blocks, loops, if-then-else) makes it more analyzable than flat bytecode while remaining compact.

---

## 5. Graph-Based IRs

### 5.1 Sea of Nodes

The **sea of nodes** representation (Click & Paleczny, 1995) is a graph IR used in HotSpot's C2 compiler and Graal/Truffle:

- **Data flow** is explicit: every value is a node with edges to its inputs.
- **Control flow** is represented by special control-flow edges.
- Data and control are in the same graph but distinguished by edge type.
- No fixed instruction ordering within a basic block---scheduling is deferred.

```
// x = a + b; y = a + b; z = x * y
// Sea of nodes:
   [a] [b]
    \ /
   [Add]         (single node, shared)
    |  \
   [x]  [y]
    \   /
    [Mul]
      |
     [z]
```

**Advantages:**
- Common subexpressions are automatically shared.
- Dead code nodes have no consumers and are trivially identified.
- Instruction scheduling is decoupled from optimization.
- Enables powerful optimizations (GVN is "free" by construction).

**Disadvantages:**
- Complex implementation.
- Harder to debug and visualize.
- Some analyses require reconstructing a linear order.

### 5.2 Program Dependence Graph (PDG)

The **PDG** (Ferrante, Ottenstein & Warren, 1987) represents both data and control dependencies:

- **Data dependence edges:** $u \to_d v$ if $v$ uses a value defined by $u$.
- **Control dependence edges:** $u \to_c v$ if $v$'s execution depends on the outcome of $u$.

PDGs are used for program slicing, parallelization, and some forms of optimization.

---

## 6. LLVM IR

### 6.1 Overview

LLVM IR is a typed, SSA-based, low-level IR that serves as the common representation for the LLVM compiler infrastructure. It is arguably the most widely studied and used compiler IR in practice.

### 6.2 Key Design Features

1. **SSA form:** Every register is defined exactly once (phi nodes at join points).
2. **Typed:** Every value has a type; type mismatches are illegal.
3. **Explicit memory model:** `alloca`, `load`, `store` for memory operations.
4. **Three representations:** In-memory (C++ objects), bitcode (binary), textual (`.ll` files).
5. **Target-independent:** Same IR for x86, ARM, RISC-V, etc.

### 6.3 Example

```llvm
; int add(int a, int b) { return a + b; }
define i32 @add(i32 %a, i32 %b) {
entry:
    %sum = add i32 %a, %b
    ret i32 %sum
}

; int factorial(int n) { ... }
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

### 6.4 LLVM Type System

```llvm
; Integer types
i1, i8, i16, i32, i64, i128

; Floating-point types
float, double

; Pointer types
ptr                      ; opaque pointer (LLVM 15+)

; Array types
[10 x i32]              ; array of 10 i32s

; Structure types
{ i32, float, ptr }     ; anonymous struct
%Point = type { i32, i32 }  ; named struct

; Function types
i32 (i32, i32)          ; takes two i32s, returns i32

; Vector types (SIMD)
<4 x float>             ; 4-element float vector
```

### 6.5 Memory Model

LLVM IR distinguishes between:
- **SSA registers** (virtual, unlimited, single-assignment)
- **Memory** (accessed via `alloca`, `load`, `store`)

```llvm
define void @swap(ptr %px, ptr %py) {
    %tmp_x = load i32, ptr %px
    %tmp_y = load i32, ptr %py
    store i32 %tmp_y, ptr %px
    store i32 %tmp_x, ptr %py
    ret void
}
```

The `mem2reg` pass promotes stack allocations to SSA registers where possible, converting from a memory-based representation to a register-based SSA representation.

---

## 7. IR Design Trade-offs

### 7.1 Level of Abstraction

| Level | Examples | Pros | Cons |
|-------|----------|------|------|
| High (source-level) | AST, Roslyn IR | Easy frontend; source fidelity | Hard to optimize; machine-distant |
| Medium | LLVM IR, GCC GIMPLE | Good for general optimization | Loses some source info |
| Low (near-machine) | GCC RTL, LLVM MIR | Easy code generation | Hard to do high-level optimization |

### 7.2 Linear vs. Graph

| Aspect | Linear (TAC) | Graph (Sea of Nodes) |
|--------|--------------|---------------------|
| Implementation | Simple | Complex |
| CSE | Must be computed | Implicit (sharing) |
| Dead code | Must be computed | Implicit (no consumers) |
| Scheduling | Fixed | Flexible |
| Debugging | Easy (print instruction list) | Hard (need graph visualizer) |

### 7.3 Typed vs. Untyped

- **Typed IRs** (LLVM IR, WebAssembly): Catch bugs early, enable type-based alias analysis, facilitate verification.
- **Untyped IRs** (some assembly-level IRs): Simpler, fewer constraints, but more opportunities for bugs.

---

## 8. Multi-Level IR: MLIR

### 8.1 Motivation

**MLIR** (Multi-Level IR, Lattner et al., 2020) is a compiler infrastructure that supports user-defined IRs (called **dialects**) at multiple levels of abstraction within a single framework.

### 8.2 Key Concepts

- **Dialects:** Define custom operations, types, and attributes. Examples:
  - `affine` dialect: Polyhedral loop nests.
  - `linalg` dialect: Linear algebra operations.
  - `scf` dialect: Structured control flow.
  - `llvm` dialect: LLVM-compatible operations.
  - `gpu` dialect: GPU kernel operations.

- **Progressive lowering:** Gradually transform high-level dialects into lower-level ones:

$$\text{TensorFlow} \xrightarrow{\text{lower}} \text{HLO} \xrightarrow{\text{lower}} \text{Linalg} \xrightarrow{\text{lower}} \text{Affine} \xrightarrow{\text{lower}} \text{LLVM}$$

- **Operations are first-class:** Every IR construct is an "operation" with well-defined semantics.
- **Regions and blocks:** Structured nesting of control flow, enabling both structured and unstructured representations.

### 8.3 Example

```mlir
// High-level: matrix multiply
func.func @matmul(%A: tensor<4x8xf32>, %B: tensor<8x4xf32>)
    -> tensor<4x4xf32> {
  %C = linalg.matmul ins(%A, %B : tensor<4x8xf32>, tensor<8x4xf32>)
                     outs(%init : tensor<4x4xf32>) -> tensor<4x4xf32>
  return %C : tensor<4x4xf32>
}

// After lowering to loops:
func.func @matmul_lowered(...) {
  affine.for %i = 0 to 4 {
    affine.for %j = 0 to 4 {
      affine.for %k = 0 to 8 {
        // load, multiply, accumulate, store
      }
    }
  }
}
```

---

## 9. Lowering from AST to IR

### 9.1 General Strategy

```
function lower(ast_node):
    match ast_node with
    | Function(name, params, body):
        entry_block := create_block("entry")
        for p in params:
            alloca := emit(alloca type_of(p))
            emit(store p, alloca)
            env[p.name] := alloca
        lower_stmt(body, entry_block)

    | VarDecl(name, init):
        alloca := emit(alloca type_of(name))
        val := lower_expr(init)
        emit(store val, alloca)
        env[name] := alloca

    | Return(expr):
        val := lower_expr(expr)
        emit(ret val)
```

### 9.2 Handling Control Flow

The key challenge is translating structured control flow (if/else, while, for) into the unstructured control flow of basic blocks and branches:

```
function lower_if(cond, then_body, else_body, current_block):
    cond_val := lower_expr(cond)
    then_block := create_block("then")
    else_block := create_block("else")
    merge_block := create_block("merge")

    emit(br cond_val, then_block, else_block)

    set_insert_point(then_block)
    lower_stmt(then_body)
    emit(br merge_block)

    set_insert_point(else_block)
    lower_stmt(else_body)
    emit(br merge_block)

    set_insert_point(merge_block)
    // If the if-expression produces a value, insert a phi node:
    // phi [then_val, then_block], [else_val, else_block]
```

---

## 10. Summary

| IR Style | Key Representative | Best For |
|----------|--------------------|----------|
| AST / Tree | Roslyn, rustc HIR | Source-level analysis |
| Three-address code | GIMPLE, TAC | Traditional optimization |
| Stack-based | JVM bytecode, Wasm | Compact, portable |
| Graph-based | Sea of Nodes (Graal) | Advanced optimization |
| SSA linear | LLVM IR | General-purpose compilation |
| Multi-level | MLIR | Domain-specific compilation |

---

## References

1. Lattner, C. & Adve, V. (2004). "LLVM: A Compilation Framework for Lifelong Program Analysis & Transformation." *CGO*, 75--86.
2. Click, C. & Paleczny, M. (1995). "A Simple Graph-Based Intermediate Representation." *ACM SIGPLAN Workshop on Intermediate Representations*, 35--49.
3. Ferrante, J., Ottenstein, K.J., & Warren, J.D. (1987). "The Program Dependence Graph and Its Use in Optimization." *ACM TOPLAS*, 9(3), 319--349.
4. Aho, A.V., Lam, M.S., Sethi, R., & Ullman, J.D. (2006). *Compilers: Principles, Techniques, and Tools* (2nd ed.), Chapter 6.
5. Lattner, C. et al. (2020). "MLIR: A Compiler Infrastructure for the End of Moore's Law." arXiv:2002.11054.
6. Cooper, K.D. & Torczon, L. (2011). *Engineering a Compiler* (2nd ed.), Chapter 5.
7. Muchnick, S.S. (1997). *Advanced Compiler Design and Implementation*, Chapters 4--6.
