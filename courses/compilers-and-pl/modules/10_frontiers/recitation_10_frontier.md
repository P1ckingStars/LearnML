# Recitation 10: Exploring Frontiers

## Overview

This recitation exposes students to cutting-edge topics in compilers and programming languages through hands-on exercises. Each exercise can be completed independently; the instructor may assign a subset based on time constraints and student interests.

---

## Exercise 1: Experimenting with Effect Handlers (Koka or Eff)

### 1.1 Setup

Install one of the following:
- **Koka**: https://koka-lang.github.io (recommended; install via `curl` or package manager).
- **Eff**: https://www.eff-lang.org

### 1.2 Task A: State via Effect Handlers

Implement a stateful computation using algebraic effects. Do **not** use mutable variables; define state as an effect and handle it purely.

In Koka:

```koka
effect state<s>
  fun get() : s
  fun put(x : s) : ()

fun counter() : state<int> int
  val n = get()
  if n >= 5 then n
  else
    put(n + 1)
    counter()

fun run-state(init : s, action : () -> state<s> a) : (a, s)
  var st := init
  with handler
    fun get()  st
    fun put(x) st := x
  (action(), st)
```

**Questions:**
1. Trace the execution of `run-state(0, counter)`. What is the result?
2. Modify the handler to log every `put` operation (accumulate a list of all values passed to `put`).
3. What happens if you handle `get` but not `put`? How does the type system prevent this?

### 1.3 Task B: Nondeterminism via Effects

Define a nondeterminism effect with operation `choose : list<a> -> a` and implement two handlers:
1. **All solutions**: Collect all possible results into a list.
2. **First solution**: Return only the first result (short-circuit).

```
effect nondet
  fun choose(xs : list<a>) : a

fun pythagorean-triples(n : int) : nondet (int, int, int)
  val a = choose(list(1, n))
  val b = choose(list(a, n))
  val c = choose(list(b, n))
  if a*a + b*b == c*c then (a, b, c)
  else choose([])  // fail
```

**Questions:**
1. How does the "all solutions" handler use the continuation to explore all branches?
2. What is the time complexity of the nondeterminism handler? How does it compare to Prolog's backtracking?
3. Can you implement a "fair" handler that interleaves exploration (breadth-first instead of depth-first)?

### 1.4 Task C: Exception Handling as an Effect

Implement exceptions as an algebraic effect. Show that the standard `try/catch` pattern emerges naturally from effect handling.

**Discussion:** Compare the effect-based exception handling with monadic error handling (`Either`/`ExceptT`). What are the ergonomic differences?

---

## Exercise 2: Writing a Verified Optimization in a Proof Assistant

### 2.1 Setup

Use one of:
- **Lean 4**: https://leanprover.github.io (recommended for beginners).
- **Coq**: https://coq.inria.fr
- **Agda**: https://wiki.portal.chalmers.se/agda

### 2.2 Task A: Verified Constant Folding

Define a simple expression language and prove that constant folding preserves semantics.

**In Lean 4 (sketch):**

```lean
inductive Expr where
  | num : Int -> Expr
  | var : String -> Expr
  | add : Expr -> Expr -> Expr
  | mul : Expr -> Expr -> Expr

def eval (env : String -> Int) : Expr -> Int
  | .num n     => n
  | .var x     => env x
  | .add e1 e2 => eval env e1 + eval env e2
  | .mul e1 e2 => eval env e1 * eval env e2

def constFold : Expr -> Expr
  | .add (.num a) (.num b) => .num (a + b)
  | .mul (.num a) (.num b) => .num (a * b)
  | .add e1 e2             => .add (constFold e1) (constFold e2)
  | .mul e1 e2             => .mul (constFold e1) (constFold e2)
  | e                      => e

theorem constFold_correct (env : String -> Int) (e : Expr) :
    eval env (constFold e) = eval env e := by
  induction e with
  | num n => simp [constFold, eval]
  | var x => simp [constFold, eval]
  | add e1 e2 ih1 ih2 => sorry  -- complete this proof
  | mul e1 e2 ih1 ih2 => sorry  -- complete this proof
```

**Task:** Complete the proof. The `add` and `mul` cases require case analysis on whether the subexpressions are both `num` constructors.

### 2.3 Task B: Verified Dead Code Elimination

Extend the expression language with `let` bindings:

```
| let : String -> Expr -> Expr -> Expr   -- let x = e1 in e2
```

Define a function `freeVars : Expr -> Set String` and an optimization `dce` that removes `let` bindings for variables not in the free variables of the body. Prove:

```
theorem dce_correct (env : String -> Int) (e : Expr) :
    eval env (dce e) = eval env e
```

### 2.4 Discussion

1. What was the hardest part of the proof? Was it the optimization logic or the proof engineering?
2. How does the proof effort scale with optimization complexity?
3. Compare this experience to CompCert's approach (Section 3 of Lecture 10b).

---

## Exercise 3: Using ML-Guided Optimization in LLVM

### 3.1 Setup

- Install LLVM (version 15+) with ML-guided optimization support.
- Alternatively, use the MLGO training infrastructure: https://github.com/google/ml-compiler-opt

### 3.2 Task A: Profiling the Inlining Decision

Compile a non-trivial C/C++ program (e.g., a sorting benchmark, a small interpreter, or a compression library) with different inlining thresholds:

```bash
# Minimal inlining
clang -O2 -mllvm -inline-threshold=50 program.c -o prog_low

# Default inlining
clang -O2 program.c -o prog_default

# Aggressive inlining
clang -O2 -mllvm -inline-threshold=1000 program.c -o prog_high
```

Measure:
- Binary size.
- Execution time (use `hyperfine` or similar for reliable benchmarking).
- Number of inlined call sites (use `-mllvm -print-after=inline -mllvm -filter-print-funcs=main`).

**Questions:**
1. Plot binary size vs. execution time for different thresholds. Is there a clear optimum?
2. Which functions benefit most from inlining? Why?

### 3.3 Task B: Training an ML Inlining Model (Optional, Advanced)

Follow the MLGO tutorial to:
1. Generate training data by compiling with different inlining decisions.
2. Train a simple policy (even a linear model) to predict inlining decisions.
3. Evaluate the trained model's decisions against the default heuristic.

### 3.4 Task C: Analysis

Write a brief report (1 page) addressing:
1. What features of a call site are most predictive of whether inlining improves performance?
2. What are the risks of deploying an ML-trained inlining heuristic in a production compiler?
3. How would you validate that the ML model does not introduce performance regressions?

---

## Exercise 4: Surveying Recent PL Research

### 4.1 Task

Select **two papers** from the proceedings of a recent top venue:
- **PLDI** (Programming Language Design and Implementation)
- **POPL** (Principles of Programming Languages)
- **OOPSLA** (Object-Oriented Programming, Systems, Languages, and Applications)
- **ICFP** (International Conference on Functional Programming)
- **CGO** (Code Generation and Optimization)
- **ASPLOS** (Architectural Support for PLs and OSs)

The papers should be from 2022 or later.

### 4.2 For Each Paper, Write

A structured summary (1--2 pages per paper) covering:

1. **Problem**: What problem does the paper address? Why is it important?
2. **Key idea**: What is the main contribution or insight?
3. **Technical approach**: Briefly describe the method (algorithm, proof technique, system design).
4. **Evaluation**: How do the authors evaluate their work? What benchmarks or case studies do they use?
5. **Strengths**: What are the paper's strongest points?
6. **Weaknesses/limitations**: What assumptions does the paper make? What is not addressed?
7. **Connections**: How does the paper relate to topics covered in this course?
8. **Future work**: What open questions does the paper suggest?

### 4.3 Suggested Paper Topics (choose any two)

- Algebraic effects in a systems language
- Verified compilation of a concurrent language
- ML-guided optimization in a production compiler
- Gradual typing with sound runtime semantics
- Session types for real-world protocols
- Quantum programming language design
- Differentiable programming for scientific computing
- New garbage collection techniques
- JIT compilation for WebAssembly
- Formal verification of an optimization pass

---

## Discussion Topics

1. **Effect handlers vs. monads**: Now that you have programmed with effect handlers (Exercise 1), compare the experience to using monad transformers (HW09). When would you prefer one over the other?

2. **The cost of verification**: After Exercise 2, estimate how much effort it would take to verify a full compiler pass (e.g., SSA construction or register allocation). Is formal verification practical for production compilers?

3. **ML in compilers -- hype or reality?** After Exercise 3, discuss: will ML-guided optimization replace hand-tuned heuristics in the next decade? What would need to change for this to happen?

4. **Research frontiers**: Based on Exercise 4, identify the most promising direction in PL/compiler research. Defend your choice.

---

## Deliverables

- Source code for Exercises 1--3 (or the assigned subset).
- Written reports for Exercise 3C and Exercise 4.
- Be prepared to present your paper summaries (Exercise 4) in a class discussion.
