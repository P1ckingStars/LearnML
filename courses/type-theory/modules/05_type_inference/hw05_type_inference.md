---
title: "Homework 05: Type Inference Engine"
tags:
  - type-theory
  - type-inference
  - homework
  - module-index
---
# Homework 05: Type Inference Engine

> **Module 05 --- Type Inference & Reconstruction (Weeks 9--10)**
> Estimated time: ~20 hours
> Due: Two weeks from assignment date

---

## Overview

In this homework, you will develop both the theoretical foundations and a working implementation of type inference. Part A focuses on formal proofs and manual algorithm traces; Part B requires you to build a complete type inference engine for a mini-ML language with let-polymorphism.

**What you will prove:**

1. Soundness of the unification algorithm (the MGU is indeed a unifier)
2. The principal type property for the STLC
3. Manual traces of Algorithm W on non-trivial terms

**What you will build:**

1. A unification engine with occurs check and proper error messages
2. Algorithm W for a mini-ML language with let-polymorphism, recursive definitions, and the value restriction

---

## Part A: Theory (50%)

### Problem A.1: Soundness of Unification (15%)

Consider Robinson's unification algorithm as defined in Lecture 05b. Let $\mathcal{T}$ be the set of type expressions over type variables $\mathcal{V} = \{\alpha_1, \alpha_2, \ldots\}$ and the binary constructor $\to$.

**(a)** Prove that if $\text{unify}(S, T) = \sigma$, then $\sigma$ is a unifier: $\sigma(S) = \sigma(T)$.

Proceed by structural induction on the recursion depth of the algorithm. Your proof must handle all cases:

- Case 1: $S$ and $T$ are the same variable ($S = T = \alpha$).
- Case 2: $S$ is a variable $\alpha$, $\alpha \in \text{FV}(T)$, $S \neq T$ (occurs check failure---show no output is produced).
- Case 3: $S$ is a variable $\alpha$, $\alpha \notin \text{FV}(T)$ (variable elimination).
- Case 4: $T$ is a variable (symmetry reduction to Case 2/3).
- Case 5: $S = f(S_1, \ldots, S_n)$ and $T = g(T_1, \ldots, T_m)$ with $f \neq g$ or $n \neq m$ (symbol clash---show failure).
- Case 6: $S = f(S_1, \ldots, S_n)$ and $T = f(T_1, \ldots, T_n)$ (decomposition---show soundness of $\text{unify\_list}$).

For Case 6, you must also prove soundness of the auxiliary function $\text{unify\_list}$ by induction on the list length, showing that the threaded substitution correctly accounts for earlier unification results.

**(b)** Prove that the unifier produced is most general: if $\sigma'$ is any other unifier of $S$ and $T$, then there exists $\delta$ such that $\sigma' = \delta \circ \sigma$.

Again, proceed by induction on the recursion structure of the algorithm. The key step is Case 3: show that if $\sigma = [\alpha \mapsto T]$ and $\sigma'$ is any unifier, then $\delta$ can be defined as $\delta(\beta) = \sigma'(\beta)$ for all $\beta$, and verify that $\delta \circ \sigma = \sigma'$. For Case 6, use the fact that the composition of most general unifiers (applied sequentially with substitution threading) yields a most general unifier for the entire system.

**(c)** Prove that Robinson's algorithm terminates on all inputs. Define a well-founded measure $\mu$ on the input $(S, T)$ (or on the state of $\text{unify\_list}$) and show that $\mu$ strictly decreases at each recursive call. You may use the lexicographic product of natural numbers.

*Hint:* For $\text{unify\_list}$, consider the measure $(V, M)$ where $V$ is the number of distinct variables in the remaining equations and $M$ is the total term size. Show that variable elimination (Case 3) decreases $V$, while decomposition (Case 6) decreases $M$ without increasing $V$.

### Problem A.2: Principal Type Property (15%)

**(a)** State the principal type theorem for the STLC formally. Your statement should involve:

- The constraint generation function $\mathcal{CG}(\Gamma, t) = (T, C)$ from Lecture 05a.
- The most general unifier $\sigma = \text{mgu}(C)$ from Lecture 05b.
- The notion of a principal solution $(\sigma, \sigma(T))$.

Be precise about what "principal" means: for every other solution $(\sigma', T')$, there exists $\delta$ such that $T' = \delta(\sigma(T))$ and $\sigma'$ agrees with $\delta \circ \sigma$ on the free type variables of $\Gamma$.

**(b)** Prove this theorem using the following results (which you may cite without re-proving):

- Soundness of constraint generation (Theorem 2.43 of Lecture 05a): if $\sigma \models C$ then $\sigma(\Gamma) \vdash t : \sigma(T)$.
- Completeness of constraint generation (Theorem 2.44 of Lecture 05a): if $\sigma'(\Gamma) \vdash t : T'$ then there exists $\sigma \models C$ with $\sigma(T) = T'$.
- MGU property (Theorem 2.25 of Lecture 05b): if $\sigma = \text{mgu}(C)$ and $\tau \models C$, then $\tau = \delta \circ \sigma$ for some $\delta$.

Show explicitly how these three results combine to establish principality. The proof should proceed as follows:

1. Use soundness to show that $(\sigma, \sigma(T))$ is a valid solution.
2. Take an arbitrary solution $(\sigma', T')$.
3. Use completeness to obtain a unifier $\tau$ of $C$.
4. Use the MGU property to factor $\tau$ through $\sigma$.
5. Conclude that $T' = \delta(\sigma(T))$.

**(c)** Show that the principal type is unique up to renaming of type variables. That is, if $(\sigma_1, T_1)$ and $(\sigma_2, T_2)$ are both principal solutions, then there exists a variable renaming $\rho$ (a bijection on type variables, extended to type expressions) such that $T_2 = \rho(T_1)$.

*Hint:* Use the fact that if $T_1$ and $T_2$ are both principal, then $T_1$ is an instance of $T_2$ and vice versa. Show that mutual instance-hood implies equality up to renaming.

### Problem A.3: Manual Traces (20%)

For each of the following terms, manually trace Algorithm W (as defined in Lecture 05c, Algorithm 2.14). Show every step:

- Fresh variable introduction (state which variable is introduced and why).
- Each recursive call to $\mathcal{W}$ with its arguments and results.
- Each unification step (show the two terms being unified and the resulting substitution).
- Each substitution composition (show the composed result explicitly).
- Each generalization step (show which variables are generalized and the resulting type scheme).

State the final principal type.

**(a)** $t = \lambda f.\; \lambda g.\; \lambda x.\; f\;(g\;x)$ (function composition)

Expected type: $(\beta \to \gamma) \to (\alpha \to \beta) \to \alpha \to \gamma$ (up to variable renaming).

Show all three applications and their unification steps. Verify by applying the final substitution to the initial type.

**(b)** $t = \text{let}\; \text{id} = \lambda x.\; x\; \text{in}\; \text{id}\;\text{id}$

Show the following steps in detail:
1. Inference of $\lambda x.\; x$ to get type $\beta_1 \to \beta_1$.
2. Generalization to $\forall \beta_1.\; \beta_1 \to \beta_1$.
3. Inference of $\text{id}\;\text{id}$: two independent instantiations of the scheme.
4. Unification at the application site.

Explain why let-polymorphism is necessary: show that replacing `let id = ...` with a lambda $(\lambda \text{id}.\; \text{id}\;\text{id})\;(\lambda x.\; x)$ produces a different (and less informative) result.

**(c)** $t = \text{let}\; k = \lambda x.\; \lambda y.\; x\; \text{in}\; \text{let}\; s = \lambda f.\; \lambda g.\; \lambda x.\; f\;x\;(g\;x)\; \text{in}\; s\;k\;k$

This is a challenging trace. Proceed as follows:

1. Infer the type of $k = \lambda x.\; \lambda y.\; x$. Generalize.
2. Infer the type of $s = \lambda f.\; \lambda g.\; \lambda x.\; f\;x\;(g\;x)$. This involves:
   - Introducing fresh variables for $f$, $g$, $x$.
   - Inferring $f\;x$: unification.
   - Inferring $g\;x$: unification.
   - Inferring $(f\;x)\;(g\;x)$: unification.
3. Generalize the type of $s$.
4. Infer $s\;k$: instantiate both $s$ and $k$, unify.
5. Infer $(s\;k)\;k$: instantiate $k$ again, unify.

State the final type and explain why $s\;k\;k$ receives the type it does.

**(d)** $t = \lambda x.\; \text{let}\; y = x\; \text{in}\; y\;y$

Determine whether this term is typable. Your analysis should:
1. Introduce a fresh variable $\beta_1$ for $x$.
2. In the let-binding, $y = x$ has type $\beta_1$.
3. Determine what variables are generalized in $\text{Gen}(\Gamma, \beta_1)$ where $\Gamma = \{x : \beta_1\}$.
4. Determine whether $y\;y$ is typable given $y$'s type scheme.

If the term is typable, give the principal type. If not, identify the exact point where Algorithm W fails and explain why.

*Hint:* The generalization step is the key. Consider whether $\beta_1$ can be generalized when $x : \beta_1$ is in the context.

---

## Part B: Implementation (50%)

Implement Algorithm W for a mini-ML language in OCaml (or Haskell, if you prefer; adjust the data types accordingly). Your implementation must handle the following features.

### Problem B.1: Core Language and Unification (15%)

**(a)** Define OCaml types for:

- Type expressions: type variables (represented as integers), arrow types ($T_1 \to T_2$), and at least two base types ($\text{Int}$ and $\text{Bool}$).
- Type schemes: $\forall \alpha_1 \ldots \alpha_n.\; \tau$ (a list of quantified variable indices and a body type).
- Term expressions: variables, lambda abstractions, applications, let-bindings, let-rec bindings, integer and boolean literals, if-then-else, and at least one binary operator (e.g., $+$ or $=$).

Provide a pretty-printer for types that produces readable output (e.g., `'a -> 'b -> 'a`).

**(b)** Implement substitutions as an abstract data type with the following operations:

- `empty : subst` --- the identity substitution.
- `singleton : int -> ty -> subst` --- a single binding.
- `apply : subst -> ty -> ty` --- apply a substitution to a type.
- `apply_scheme : subst -> scheme -> scheme` --- apply to a type scheme (respecting bound variables: do not substitute for quantified variables).
- `compose : subst -> subst -> subst` --- composition $(\sigma_2 \circ \sigma_1)$.

Include unit tests verifying:
- `apply (singleton 0 TInt) (TVar 0) = TInt`
- `apply (singleton 0 TInt) (TVar 1) = TVar 1`
- `compose (singleton 1 TInt) (singleton 0 (TVar 1))` applied to `TVar 0` yields `TInt`
- `apply_scheme s (Forall ([0], TArrow (TVar 0, TVar 1)))` does not substitute for `TVar 0`

**(c)** Implement unification following Robinson's algorithm:

- `unify : ty -> ty -> subst` --- returns the MGU or raises an exception.
- Implement the occurs check with an informative error message that names the offending variable and the type it occurs in.
- Handle decomposition of arrow types.
- Handle clash detection with an informative error message naming both types.

Your unification must pass the following test cases:

| Input | Expected Output |
|-------|-----------------|
| `unify (TVar 0) TInt` | `[0 -> Int]` |
| `unify (TArrow(TVar 0, TVar 1)) (TArrow(TInt, TBool))` | `[0 -> Int, 1 -> Bool]` |
| `unify (TVar 0) (TArrow(TVar 0, TVar 1))` | Occurs check failure |
| `unify TInt TBool` | Clash failure |
| `unify (TArrow(TVar 0, TVar 0)) (TArrow(TVar 1, TArrow(TVar 1, TVar 2)))` | Occurs check failure |
| `unify (TArrow(TVar 0, TVar 1)) (TArrow(TVar 1, TVar 0))` | `[0 -> 1]` (or equivalent) |

### Problem B.2: Algorithm W (20%)

Implement the full Algorithm W.

**(a)** Implement inference for the core term forms:

- **Variables:** look up the type scheme in the context, instantiate with fresh variables.
- **Lambda abstractions:** introduce a fresh type variable for the parameter, infer the body, return the function type.
- **Applications:** infer the function and argument types, unify the function type with $\text{arg\_type} \to \text{fresh}$, compose all substitutions.

Verify that substitutions are correctly threaded: after inferring $t_1$ in an application $t_1\;t_2$, the substitution $\sigma_1$ must be applied to $\Gamma$ before inferring $t_2$.

**(b)** Implement let-bindings with generalization:

- Implement `generalize : context -> ty -> scheme` that computes $\text{FTV}(\tau) \setminus \text{FTV}(\Gamma)$ and quantifies over the result.
- Implement `instantiate : scheme -> ty` that replaces all quantified variables with fresh type variables.
- In the `Let` case, infer the type of the definition, apply the substitution to the context, generalize, and infer the body.

**(c)** Implement recursive let-bindings (`let rec f = e1 in e2`):

1. Introduce a fresh type variable $\beta$ for $f$.
2. Add $f : \beta$ (as a monotype, not a scheme) to the context.
3. Infer the type of $e_1$ in this extended context.
4. Unify $\beta$ (after substitution) with the inferred type of $e_1$.
5. Generalize and proceed to $e_2$.

**(d)** Implement if-then-else:

- The condition must have type $\text{Bool}$.
- Both branches must have the same type.
- Thread substitutions correctly through all three sub-expressions.

Your implementation must correctly infer the principal types for all of the following:

| Expression | Expected Principal Type |
|---|---|
| `\x. x` | $\alpha \to \alpha$ |
| `\x. \y. x` | $\alpha \to \beta \to \alpha$ |
| `\f. \g. \x. g (f x)` | $(\alpha \to \beta) \to (\beta \to \gamma) \to \alpha \to \gamma$ |
| `let id = \x. x in id id` | $\alpha \to \alpha$ |
| `let id = \x. x in id 42` | $\text{Int}$ |
| `\f. \x. f (f x)` | $(\alpha \to \alpha) \to \alpha \to \alpha$ |
| `let rec fact = \n. if n = 0 then 1 else n * fact (n - 1) in fact` | $\text{Int} \to \text{Int}$ |
| `\x. \y. \z. x z (y z)` | $(\alpha \to \beta \to \gamma) \to (\alpha \to \beta) \to \alpha \to \gamma$ |

And must correctly reject (with an informative error message):

| Expression | Expected Error |
|---|---|
| `\x. x x` | Occurs check failure |
| `1 + true` | Type clash: Int vs. Bool |
| `if 42 then 1 else 2` | Type clash: Int vs. Bool (condition) |

### Problem B.3: The Value Restriction and Testing (15%)

**(a)** Implement the value restriction: only generalize let-bindings where the right-hand side is a syntactic value.

Define a function `is_value : expr -> bool` that returns `true` for:
- Variables
- Lambda abstractions
- Integer and boolean literals

And `false` for:
- Applications (including function calls)
- If-then-else expressions
- Let expressions (the let itself is not a value, though its body might be)

Modify the `Let` case of Algorithm W: if `is_value e1` is `true`, generalize as before. If `false`, bind $x$ to the monomorphic type $\tau_1$ (i.e., `Forall ([], tau1)`), without generalization.

**(b)** Demonstrate the value restriction with a test case. Consider the expression:

```
let f = (\x. x) (\y. y) in (f 1, f true)
```

Without the value restriction, `(\x. x) (\y. y)` would have type $\alpha \to \alpha$, which would be generalized to $\forall \alpha.\; \alpha \to \alpha$, allowing `f` to be used at both `Int -> Int` and `Bool -> Bool`. With the value restriction, `(\x. x) (\y. y)` is not a syntactic value (it is an application), so `f` receives the monomorphic type $\alpha \to \alpha$. Show that:
- Without the value restriction, the expression type-checks.
- With the value restriction, the expression fails (or succeeds with a less general type, depending on which branch is checked first).

Explain in a comment why the value restriction is necessary for soundness in the presence of mutable references.

**(c)** Write a comprehensive test suite with at least 20 test cases. Organize them into categories:

**Category 1: Basic inference (5 tests)**
- Identity function
- Constant function
- Apply function
- Function composition
- Self-application (expected failure)

**Category 2: Let-polymorphism (5 tests)**
- Polymorphic identity used at two different types
- `let id = \x. x in id id`
- Nested let-bindings with generalization
- Lambda-bound variable used at two types (expected failure)
- `let f = \x. x in let g = \y. f y in g`

**Category 3: Recursive functions (4 tests)**
- Factorial
- Fibonacci
- A recursive function with a polymorphic result (e.g., `length`)
- Mutual recursion (if supported) or a note explaining why it is not

**Category 4: Error cases (4 tests)**
- Occurs check failure
- Type clash
- Unbound variable
- Condition of if-then-else is not Bool

**Category 5: Value restriction (2 tests)**
- Expression where value restriction prevents generalization
- Same expression eta-expanded to recover polymorphism

For each test case, print:
- The input expression (as a string).
- The expected type (or expected error).
- The actual inferred type (or actual error).
- PASS/FAIL status.

---

## Submission Instructions

Submit the following:

1. **Part A:** A PDF with all proofs and traces, typeset in LaTeX. Requirements:
   - State the induction hypothesis explicitly for each inductive proof.
   - Cover all cases (do not skip "trivial" cases; state them briefly but cover them).
   - Cite lemmas and theorems from the lectures by number (e.g., "by Theorem 2.25 of Lecture 05b").
   - For the manual traces in A.3, show all intermediate substitutions explicitly.

2. **Part B:** Source code files:
   - `types.ml` --- type definitions for types, schemes, terms, and contexts.
   - `subst.ml` --- substitution operations.
   - `unify.ml` --- the unification algorithm with occurs check.
   - `infer.ml` --- Algorithm W implementation.
   - `test.ml` --- the comprehensive test suite.
   - A `Makefile` or `dune` file that builds the project and runs the test suite.

3. A brief writeup (1--2 pages) discussing:
   - Design decisions: representation of substitutions (association list vs. functional map), handling of fresh variables (global counter vs. threading a state), representation of contexts.
   - The most challenging aspect of the implementation and how you resolved it.
   - One extension you would add if you had more time. Choose from: (i) type classes with dictionary-passing elaboration, (ii) improved error messages with source locations, (iii) support for algebraic data types and pattern matching, (iv) row polymorphism for records. Provide a brief (half-page) sketch of how the extension would modify the constraint generation and solving phases.

---

## Grading Rubric

| Component | Points |
|---|---|
| **Part A** | **50** |
| A.1(a): Soundness proof (all cases) | 5 |
| A.1(b): MGU property proof | 5 |
| A.1(c): Termination proof with well-founded measure | 5 |
| A.2(a): Formal statement of principal type theorem | 3 |
| A.2(b): Proof combining soundness, completeness, and MGU | 7 |
| A.2(c): Uniqueness up to renaming | 5 |
| A.3(a): Trace of function composition | 4 |
| A.3(b): Trace of `let id = \x. x in id id` | 5 |
| A.3(c): Trace of SKK combinator | 6 |
| A.3(d): Analysis of `\x. let y = x in y y` | 5 |
| **Part B** | **50** |
| B.1(a): Type definitions and pretty-printing | 3 |
| B.1(b): Substitution operations with tests | 5 |
| B.1(c): Unification with occurs check and error messages | 7 |
| B.2(a): Inference for variables, lambda, application | 5 |
| B.2(b): Let-polymorphism with generalization | 5 |
| B.2(c): Recursive let-bindings | 3 |
| B.2(d): If-then-else and binary operators | 2 |
| B.3(a): Value restriction implementation | 5 |
| B.3(b): Value restriction demonstration | 3 |
| B.3(c): Comprehensive test suite (20+ tests) | 7 |
| Writeup: Design decisions and extension sketch | 5 |
| **Total** | **100** |

Partial credit is available for incomplete but well-structured work. For Part A, a proof with correct structure but minor gaps receives more credit than a handwavy argument that arrives at the right conclusion. For Part B, code that compiles and passes some tests receives more credit than code that does not compile. Clean, well-documented code with clear variable names receives more credit than functionally equivalent but unreadable code.
