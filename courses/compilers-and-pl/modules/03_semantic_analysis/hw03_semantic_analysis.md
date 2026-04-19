# Homework 03: Semantic Analysis

**Due:** End of Week 6
**Total Points:** 100 (Part A: 45, Part B: 55)

---

## Part A: Theory (45 points)

### Problem 1: Type Derivation Proofs (15 points)

For each expression below, construct a complete typing derivation tree using the typing rules from Lecture 03b. Show every rule application.

**(a)** (5 points) Derive the type of:

$$\emptyset \vdash \lambda f:\texttt{int} \to \texttt{bool}.\; \lambda x:\texttt{int}.\; \texttt{if}\; (f\; x)\; \texttt{then}\; x\; \texttt{else}\; x + 1 \;:\; ?$$

**(b)** (5 points) In the Hindley-Milner system (without type annotations), show the Algorithm W trace for:

```
let apply = fun f -> fun x -> f x in
apply (fun n -> n + 1) 42
```

Show each step: fresh variable introduction, unification constraints generated, substitutions computed, generalization, and instantiation.

**(c)** (5 points) Show that the following expression is untypable in the simply-typed lambda calculus (no let-polymorphism):

```
(fun f -> (f 42, f true))
```

Then show that with let-polymorphism, this variant IS typable:

```
let f = fun x -> x in (f 42, f true)
```

Explain the key difference.

---

### Problem 2: Unification (15 points)

**(a)** (5 points) Apply Robinson's unification algorithm to find the MGU of:

$$\tau_1 = (\alpha \to \beta) \to \gamma$$
$$\tau_2 = (\texttt{int} \to (\delta \to \delta)) \to (\texttt{int} \to \beta)$$

Show each step of the algorithm.

**(b)** (5 points) Prove that the following pair of types has no unifier:

$$\tau_1 = \alpha \to \texttt{int}$$
$$\tau_2 = \texttt{bool} \to \alpha$$

where $\alpha$ is the *same* type variable in both.

**(c)** (5 points) Consider the equation $\alpha = \alpha \to \texttt{int}$.

1. Explain why Robinson's algorithm rejects this (cite the specific check).
2. If we remove the occurs check, what "type" would result? Is this a valid finite type?
3. Some languages (e.g., OCaml with `-rectypes`) allow this. What are the trade-offs?

---

### Problem 3: Subtyping (15 points)

**(a)** (5 points) Prove or disprove: $(\texttt{int} \to \texttt{bool}) <: (\texttt{int} \to \texttt{int})$ under the standard subtyping rules, given that $\texttt{bool} <: \texttt{int}$.

**(b)** (5 points) Prove the following subtyping relationship using the record subtyping rules:

$$\{x:\texttt{int}, y:\texttt{int}, color:\texttt{string}\} <: \{x:\texttt{int}, y:\texttt{int}\}$$

**(c)** (5 points) Consider a generic mutable container type $\texttt{Cell}[T]$ with operations `get : \texttt{Cell}[T] \to T` and `set : T \to \texttt{Cell}[T] \to \texttt{unit}$.

1. Show by constructing a counterexample that making $\texttt{Cell}$ covariant in $T$ is unsound.
2. Show by constructing a counterexample that making $\texttt{Cell}$ contravariant in $T$ is unsound.
3. Conclude that $\texttt{Cell}$ must be invariant and prove this formally using the subtyping rules for functions.

---

## Part B: Implementation (55 points)

### Overview

Implement a type checker with Hindley-Milner type inference for **Mini-ML**, a small functional language. Your implementation should:

1. Parse a textual representation into an AST (a parser is provided).
2. Perform type inference using Algorithm W with unification.
3. Support let-polymorphism.
4. Report meaningful error messages with source locations.

You may implement in OCaml, Haskell, Rust, Python, or Java. OCaml and Haskell starter code is provided.

### Language Specification

```
expr ::= integer                    (* integer literal *)
       | true | false               (* boolean literals *)
       | identifier                 (* variable reference *)
       | expr op expr               (* binary operation *)
       | if expr then expr else expr
       | fun identifier -> expr     (* lambda abstraction *)
       | expr expr                  (* function application *)
       | let identifier = expr in expr
       | let rec identifier = expr in expr
       | (expr, expr)               (* pair construction *)
       | fst expr                   (* first projection *)
       | snd expr                   (* second projection *)

op ::= + | - | * | < | = | && | ||
```

### Task 1: Unification (15 points)

Implement the unification algorithm with:
- Proper occurs check
- Path compression (for efficiency)
- Informative error messages on failure

```
(* Required interface *)
val unify : ty -> ty -> unit    (* raises TypeError on failure *)
```

**Test cases:**

```
unify (TVar a) TInt                     (* a := int *)
unify (TFun(TVar a, TVar b)) (TFun(TInt, TBool))  (* a := int, b := bool *)
unify (TVar a) (TFun(TVar a, TInt))    (* occurs check failure *)
unify TInt TBool                        (* type mismatch *)
```

### Task 2: Type Inference (25 points)

Implement Algorithm W:

```
(* Required interface *)
val infer : env -> expr -> ty
```

Your implementation must correctly handle:

1. **(5 pts)** Basic expressions: literals, arithmetic, comparisons, conditionals.
2. **(5 pts)** Lambda abstractions and function application with unification.
3. **(5 pts)** Let-bindings with generalization (let-polymorphism).
4. **(5 pts)** Recursive bindings (`let rec`).
5. **(5 pts)** Pairs with `fst` and `snd`.

**Test suite (selected):**

```
(* 1. Identity function *)
fun x -> x
(* Expected: 'a -> 'a *)

(* 2. Polymorphic let *)
let id = fun x -> x in
let a = id 42 in
id true
(* Expected: bool *)

(* 3. Compose *)
let compose = fun f -> fun g -> fun x -> f (g x) in
compose
(* Expected: ('a -> 'b) -> ('c -> 'a) -> 'c -> 'b *)

(* 4. Recursive factorial *)
let rec fact = fun n ->
    if n < 1 then 1 else n * fact (n - 1)
in fact
(* Expected: int -> int *)

(* 5. Higher-order *)
let apply_twice = fun f -> fun x -> f (f x) in
apply_twice (fun n -> n + 1) 0
(* Expected: int *)

(* 6. Pairs *)
let swap = fun p -> (snd p, fst p) in
swap (1, true)
(* Expected: (bool, int) *)

(* 7. Should fail: infinite type *)
fun x -> x x
(* Expected: type error (occurs check) *)

(* 8. Should fail: type mismatch *)
1 + true
(* Expected: type error *)
```

### Task 3: Error Reporting (15 points)

Implement informative error messages that include:

1. **(5 pts)** Source location (line and column numbers).
2. **(5 pts)** Expected vs. actual type, with types pretty-printed using Greek letters or named variables.
3. **(5 pts)** Contextual information (e.g., "in the condition of an if-expression", "in argument to function").

**Example output:**

```
test.ml:3:12: type error
  In the condition of if-expression:
    expected: bool
    actual:   int

test.ml:7:5: type error
  In application of function:
    function type: int -> int
    argument type: bool
    The argument type 'bool' is not compatible with the expected type 'int'.

test.ml:10:14: type error
  Cannot construct infinite type: 'a ~ 'a -> 'b
  In the expression: x x
```

---

## Submission Guidelines

1. Submit all source files as a single archive.
2. Include a `Makefile` or build script.
3. Include a `README` describing your design decisions and any extra features.
4. For Part A, submit a PDF with neatly formatted derivation trees (LaTeX recommended).

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Derivations | 15 | Correct and complete derivation trees |
| A2: Unification | 15 | Correct algorithm traces; sound reasoning |
| A3: Subtyping | 15 | Rigorous proofs; correct counterexamples |
| B1: Unification impl | 15 | Correctness, occurs check, path compression |
| B2: Type inference | 25 | Passes test suite, handles edge cases |
| B3: Error reporting | 15 | Informative messages with locations |

---

## Bonus (up to 10 extra points)

1. **(5 pts)** Implement the level-based generalization optimization (Remy's algorithm) instead of computing free variables.
2. **(3 pts)** Implement a constraint-based variant that separates constraint generation from solving.
3. **(2 pts)** Add recursive types (remove occurs check) and test with `fun x -> x x`.
