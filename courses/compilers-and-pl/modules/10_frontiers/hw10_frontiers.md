# HW10: Frontier Topics

**Due:** End of Week 20
**Total Points:** 100

---

## Part A: Paper Review (40 points)

### Instructions

Read and critically analyze **two recent papers** from top PL/compiler venues (PLDI, POPL, OOPSLA, ICFP, CGO, ASPLOS, CC). The papers must be from **2022 or later**. Choose papers related to different topics covered in Module 10 (e.g., one on JIT compilation and one on verified compilers, or one on ML for compilers and one on language design).

You may select from the suggested list below or find your own papers (subject to instructor approval).

### Suggested Papers

**JIT Compilation:**
- Izawa, Y., Masuhara, H., et al. "Amalgamating Different JIT Compilations in a Meta-Tracing JIT Compiler Framework." (2022)
- Huisinga, S., et al. "Copy-and-Patch Compilation." OOPSLA 2024.

**Verified Compilers:**
- Song, Y., et al. "AliveInLean: A Verified LLVM Peephole Optimization Verifier." CAV 2023.
- Sammler, M., et al. "RefinedC: Automating the Foundational Verification of C Code with Refined Ownership Types." PLDI 2021.

**ML for Compilers:**
- Cummins, C., et al. "ProGraML: A Graph-based Program Representation for Data Flow Analysis and Compiler Optimizations." ICML 2021.
- VenkataKeerthy, S., et al. "IR2Vec: LLVM IR Based Scalable Program Embeddings." TACO 2020.

**Language Design:**
- Hillerstrom, D., et al. "Continuing WebAssembly with Effect Handlers." OOPSLA 2023.
- Greenman, B. & Felleisen, M. "How to Evaluate the Performance of Gradual Type Systems." JFP 2022.

### Deliverable (20 points per paper)

For each paper, write a **structured review** (2--3 pages) covering:

**(a) Summary (5 points)**
- What is the problem? Why does it matter?
- What is the paper's main contribution?
- Summarize the technical approach in your own words.

**(b) Technical Analysis (8 points)**
- Identify the key theorem, algorithm, or system design choice.
- Explain one technical detail in depth (e.g., reproduce a key proof step, explain a data structure, trace through an algorithm).
- What formal guarantees does the paper provide (if any)?
- How does the evaluation support the claims?

**(c) Critical Assessment (5 points)**
- What are the paper's strengths?
- What are its weaknesses or limitations?
- What assumptions does the paper make, and how realistic are they?
- How does the paper compare to prior work?

**(d) Connections and Future Work (2 points)**
- How does this paper connect to material from Modules 01--10?
- What open problems does the paper suggest? Propose one concrete follow-up research direction.

---

## Part B: Implementation (60 points)

**Choose ONE of the following three projects.**

---

### Option 1: Mini Tracing JIT (60 points)

Build a simple tracing JIT compiler for a small bytecode language.

#### Language Definition

Define a stack-based bytecode with the following instructions:

```
PUSH n        -- push integer n
POP           -- pop top of stack
ADD           -- pop two, push sum
SUB           -- pop two, push difference
MUL           -- pop two, push product
DIV           -- pop two, push quotient (integer division)
DUP           -- duplicate top of stack
LOAD i        -- push local variable i
STORE i       -- pop and store to local variable i
JUMP target   -- unconditional jump
JUMP_IF target -- pop; jump if nonzero
PRINT         -- pop and print
HALT          -- stop execution
CALL f        -- call function f
RET           -- return from function
LT            -- pop two, push 1 if second < first, else 0
EQ            -- pop two, push 1 if equal, else 0
```

#### Requirements

**(a) Interpreter (10 points)**

Implement a bytecode interpreter for the language above. Include:
- A stack, local variable storage, and a program counter.
- Support for at least two functions (CALL/RET with a call stack).
- Execution counting at each bytecode offset (for hotness detection).

**(b) Trace Recorder (15 points)**

Implement trace recording:
- Detect **hot loops** (back-edges executed more than a configurable threshold, e.g., 10 times).
- When a hot loop is detected, record a **trace** (sequence of operations along the taken path).
- Insert **guards** at conditional branches (recording which branch was taken).
- The trace ends when execution returns to the loop header.

**(c) Trace Optimizer (15 points)**

Implement at least three of the following optimizations on the recorded trace:
- **Constant folding**: If operands are known constants, compute at compile time.
- **Redundant guard elimination**: If a guard is implied by a previous guard, remove it.
- **Constant propagation**: Track known values through the trace.
- **Dead store elimination**: Remove stores that are overwritten before being read.
- **Strength reduction**: Replace multiplication by a power of 2 with a shift.

**(d) Trace Compiler (15 points)**

Compile the optimized trace to a directly executable form. You have two options:
1. **Compile to a "threaded" representation**: Each trace instruction is a function pointer; execution jumps from one to the next (faster than the switch-based interpreter).
2. **Compile to native code** (ambitious): Use a simple code emitter to generate x86-64 or ARM machine code for the trace.

The compiled trace must:
- Execute correctly for the recorded path.
- Fall back to the interpreter (side exit) when a guard fails.

**(e) Evaluation (5 points)**

Benchmark your JIT on at least two programs:
1. A loop computing the sum $1 + 2 + \ldots + N$ for large $N$.
2. A loop computing Fibonacci numbers iteratively.

Report:
- Execution time: interpreter-only vs. JIT-enabled.
- Number of traces compiled.
- Number of guard failures / side exits.

#### Deliverables
- Source code with build instructions.
- A test suite demonstrating correct execution.
- A performance report (1 page) with the benchmark results.

---

### Option 2: Translation Validation Tool (60 points)

Build a translation validator that checks whether a compiler transformation preserves semantics for a simple IR.

#### IR Definition

Define a simple three-address code IR:

```
x = y op z      -- binary operation (add, sub, mul, div, and, or, xor, shl, shr)
x = op y        -- unary operation (neg, not)
x = c           -- constant assignment
x = y           -- copy
if x cmp y goto L  -- conditional branch (cmp: eq, ne, lt, le, gt, ge)
goto L          -- unconditional branch
return x        -- return value
```

#### Requirements

**(a) IR Parser and Representation (10 points)**

Parse the IR from text files. Represent programs as control flow graphs (CFGs) with basic blocks.

**(b) Simulation Relation Checker (20 points)**

Given a "before" and "after" IR program (representing a transformation), verify that they compute the same result:

1. **Structural matching**: Identify corresponding basic blocks in the two programs (by label, or via a heuristic matching algorithm).
2. **Symbolic execution**: For each pair of corresponding blocks, symbolically execute both versions and check that they produce the same values.
3. **SMT encoding**: Encode the equivalence check as an SMT query. Use an SMT solver (Z3, CVC5, or Boolector) to verify.

The validation should handle at least these transformations:
- Constant folding: `x = 3 + 4` $\to$ `x = 7`.
- Dead code elimination: Removing assignments to unused variables.
- Common subexpression elimination: `y = a + b; z = a + b` $\to$ `y = a + b; z = y`.
- Copy propagation: `x = y; z = x + 1` $\to$ `z = y + 1`.
- Strength reduction: `x = y * 4` $\to$ `x = y << 2`.

**(c) Counterexample Generation (10 points)**

When validation fails, extract a **counterexample** from the SMT solver: concrete input values for which the before and after programs produce different outputs. Display the counterexample in a human-readable format.

**(d) Test Suite (10 points)**

Provide a test suite with:
- At least 5 correct transformations (validator should accept).
- At least 5 incorrect transformations (validator should reject and produce counterexamples).
- At least 2 transformations involving loops (validator should handle via loop unrolling or invariants).

**(e) Report (10 points)**

Write a brief report (2 pages) discussing:
1. What transformations are easy/hard to validate?
2. How does your tool handle loops? What are the limitations?
3. Compare your approach to Alive2 (what does Alive2 handle that you do not?).
4. How would you extend your tool to handle memory operations (loads/stores)?

#### Deliverables
- Source code with build instructions.
- Test suite with expected results.
- The report.

---

### Option 3: DSL with Effect Handlers (60 points)

Design and implement a domain-specific language that uses algebraic effects for modularity.

#### Requirements

**(a) Language Design (10 points)**

Choose a domain (one of the following, or propose your own):
- A reactive programming DSL (effects: emit events, subscribe, timer).
- A web scraping DSL (effects: HTTP requests, HTML parsing, rate limiting).
- A database query DSL (effects: read table, filter, aggregate, transact).
- A testing DSL (effects: assertions, property generation, mocking).

Define:
- The abstract syntax of your DSL.
- The effect signatures (operations and their types).
- At least 3 distinct effects that can be composed.

**(b) Effect Handler Implementation (20 points)**

Implement an effect handler mechanism in your host language. You have two options:

1. **Shallow embedding**: Use continuations (if your language supports them) or CPS to implement effect handlers.
2. **Deep embedding**: Represent computations as free monads / free effect trees and interpret them.

Your implementation must support:
- Multiple effects in the same computation.
- Handler composition (handling one effect while leaving others unhandled).
- Resumable continuations (the handler can choose to resume, not resume, or resume multiple times).

**(c) Multiple Interpretations (15 points)**

Implement at least **three different handlers** for the same DSL program:
1. A "real" handler (actually performs I/O, database queries, etc.).
2. A "mock" handler (returns canned data, for testing).
3. A "logging" handler (wraps another handler, logging all effect operations).

Demonstrate that the **same DSL program** runs under all three handlers without modification.

**(d) Type Safety (5 points)**

Ensure that:
- Unhandled effects are detected (ideally at compile time via the type system; at minimum, at runtime with a clear error message).
- Effect operations are only available within the scope of their handler.

If your host language supports it, use row types or type-level effect sets.

**(e) Example Programs and Tests (10 points)**

Provide:
- At least 3 non-trivial example programs written in your DSL.
- A test suite demonstrating all three handlers on each example.
- A demonstration of handler composition (e.g., combining state + exceptions + logging).

#### Deliverables
- Source code with build instructions.
- A design document (2 pages) explaining your DSL, the effects, and the handler mechanism.
- Test output demonstrating all features.

---

## Submission Guidelines

- Submit via the course submission system by the due date.
- Late submissions incur a 10% penalty per day, up to 3 days.
- For Part A, submit the reviews as PDF files.
- For Part B, submit a tarball/zip of the source code, build instructions, and any reports.
- Collaboration policy: You may discuss approaches with classmates, but all code, proofs, and writing must be your own. Cite any external references.
- Academic integrity: You may use AI tools for understanding concepts and debugging, but the core implementation and analysis must be your own work. Clearly disclose any AI tool usage in your submission.
