---
title: "Homework 03: Recursive Types"
tags:
  - type-theory
  - extensions
  - homework
---
# Homework 03: Recursive Types

**Estimated time:** 20 hours
**Due date:** End of Week 6
**Submission:** PDF of proofs (Part A) + OCaml source files (Part B)

---

## Overview

This homework has two parts of equal weight. Part A tests your ability to formally prove properties of type systems extended with references and recursive types. Part B requires you to extend the STLC type checker and interpreter from Recitation 03 with complete implementations of references, exceptions, recursive types, and the fixed-point operator.

**Academic integrity:** You may discuss approaches with classmates, but all proofs and code must be your own. Cite any references you consult beyond the assigned readings (TAPL Chapters 13, 14, 20-21).

**Language:** OCaml (version 4.14 or later). Your code must compile with `ocamlfind ocamlopt` without warnings (use `-w +a` flag).

---

## Part A: Proofs and Theory (50%)

**Instructions for proofs.** All proofs must be rigorous. For inductive proofs, clearly state the induction principle (structural induction on terms, induction on typing derivations, induction on evaluation derivations, etc.). For each case in a case analysis, identify the rule being applied and state all hypotheses. Use the notation from the course [NOTATION.md](../../NOTATION.md).

### Problem A1: Type Safety for STLC + References (20 points)

Consider STLC extended with references, as presented in Lecture 03a: types include $\text{Ref}\;T$, terms include $\text{ref}\;t$, $!\,t$, $t_1 := t_2$, and locations $l$. Typing judgments have the form $\Gamma \mid \Sigma \vdash t : T$ where $\Sigma$ is a store typing.

**(a)** [8 points] Prove the **Preservation Theorem** for STLC + references:

If $\Gamma \mid \Sigma \vdash t : T$ and $\Gamma \mid \Sigma \vdash \mu$ (the store $\mu$ is well typed under $\Sigma$) and $t \mid \mu \to t' \mid \mu'$, then there exists $\Sigma' \supseteq \Sigma$ such that $\Gamma \mid \Sigma' \vdash t' : T$ and $\Gamma \mid \Sigma' \vdash \mu'$.

You must handle at least the following cases explicitly:
- E-RefV (allocation of a new reference)
- E-DerefLoc (reading from a location)
- E-Assign (writing to a location)
- One congruence case (your choice)

For each case, clearly identify the $\Sigma'$ you choose and verify both conclusions.

**(b)** [7 points] Prove the **Progress Theorem** for STLC + references:

If $\emptyset \mid \Sigma \vdash t : T$ and $\emptyset \mid \Sigma \vdash \mu$, then either $t$ is a value, or there exist $t'$ and $\mu'$ such that $t \mid \mu \to t' \mid \mu'$.

Handle the cases T-Ref, T-Deref, and T-Assign explicitly. For T-Deref and T-Assign, you will need to use the canonical forms lemma for $\text{Ref}\;T$ and the well-typedness of the store.

**(c)** [5 points] State and prove the **Canonical Forms Lemma** for reference types:

If $\emptyset \mid \Sigma \vdash v : \text{Ref}\;T$ and $v$ is a value, then $v = l$ for some location $l$ with $\Sigma(l) = T$.

Proceed by analyzing all possible value forms (lambda abstraction, location, boolean, numeric value, pair, injection, unit) and showing that only locations can have $\text{Ref}\;T$ type.

---

### Problem A2: Recursive Type Encodings (15 points)

**(a)** [5 points] Define a recursive type for **binary trees with natural number leaves**:

$$\text{NatTree} = \mu X.\, \text{Nat} + (X \times X)$$

Give the definitions (as $\lambda$-terms with fold/unfold) of:

1. $\text{leaf} : \text{Nat} \to \text{NatTree}$
2. $\text{node} : \text{NatTree} \to \text{NatTree} \to \text{NatTree}$

Then construct the tree:

```
      node
     /    \
  leaf 1  node
         /    \
      leaf 2  leaf 3
```

Write out the full term using fold, inl, inr, and pairs.

**(b)** [5 points] Using the $\text{fix}$ operator, define a function $\text{sum\_tree} : \text{NatTree} \to \text{Nat}$ that computes the sum of all leaves. Write out the complete typing derivation for the body of the function template (the argument to $\text{fix}$), showing how unfold exposes the sum structure and how each branch is typed.

**(c)** [5 points] Define the type of **streams of natural numbers**:

$$\text{NatStream} = \mu X.\, \text{Nat} \times (\text{Unit} \to X)$$

Note the $\text{Unit} \to X$ component, which ensures laziness under call-by-value evaluation.

Define:

1. $\text{hd} : \text{NatStream} \to \text{Nat}$ (extracts the head)
2. $\text{tl} : \text{NatStream} \to \text{NatStream}$ (extracts the tail, forcing the thunk)
3. $\text{nats\_from} : \text{Nat} \to \text{NatStream}$ (the stream $n, n+1, n+2, \ldots$ using $\text{fix}$)

Verify that $\text{hd}\;(\text{tl}\;(\text{nats\_from}\;0)) = 1$ by tracing the evaluation steps. Show each fold/unfold operation and each application of the fix evaluation rule explicitly.

---

### Problem A3: Equi-Recursive Type Equivalence (15 points)

These problems test your understanding of the coinductive approach to recursive type equivalence and subtyping.

**(a)** [5 points] Using the Amber rules (Definition 5.4 in Lecture 03c), prove that the following types are equivalent:

$$\mu X.\, \text{Nat} \to (X \times \text{Bool}) \quad \equiv \quad \mu Y.\, \text{Nat} \to ((\mu Z.\, \text{Nat} \to (Z \times \text{Bool})) \times \text{Bool})$$

Show the full derivation tree, including which Amber rule is applied at each step and the contents of the assumption set $A$ at each point.

**(b)** [5 points] Prove that the following two types are **not** equivalent:

$$\mu X.\, X \to \text{Nat} \quad \not\equiv \quad \mu Y.\, \text{Nat} \to Y$$

To prove non-equivalence, unfold each type to sufficient depth, show that the infinite tree representations differ, and argue why no assumption set $A$ can make the Amber derivation succeed.

**(c)** [5 points] Consider the following recursive subtyping question (assuming function types are contravariant in the domain and covariant in the codomain, as usual):

$$\mu X.\, \text{Nat} \to X \quad <: \quad \mu Y.\, \text{Int} \to Y$$

where $\text{Nat} <: \text{Int}$.

Is this subtyping relation valid? Prove or disprove using the Amber rules for recursive subtyping (Section 7.2 of Lecture 03c). Carefully attend to the contravariance of function domains.

Recall the Amber subtyping rules:

$$\frac{(X, Y) \in A}{A \vdash X <: Y} \quad \text{(S-Var)} \qquad \frac{A \vdash T_1 <: S_1 \quad A \vdash S_2 <: T_2}{A \vdash S_1 \to S_2 <: T_1 \to T_2} \quad \text{(S-Arrow)}$$

$$\frac{A \cup \{(X, Y)\} \vdash S <: T}{A \vdash \mu X.\, S <: \mu Y.\, T} \quad \text{(S-Rec)}$$

Show every step of the derivation, including the assumption set $A$ at each point, and explain the role of contravariance in the function domain.

---

## Part B: Implementation (50%)

Starting from the interpreter skeleton in Recitation 03 (or your own implementation from HW2), extend the type checker and interpreter with the following features. Your implementation must pass all provided test cases and at least five additional test cases of your own design for each feature.

### Problem B1: References (12 points)

Implement the following:

1. **Type checker:** Add rules T-Ref, T-Deref, T-Assign, and T-Loc. Maintain a store typing that grows as new reference allocations are type-checked.

2. **Evaluator:** Implement a store as a mutable data structure. Implement $\text{ref}\;v$ (allocation), $!\,l$ (dereference), and $l := v$ (assignment) according to the evaluation rules from Lecture 03a.

3. **Tests (required):**
   - Basic allocation, dereference, and assignment.
   - Aliasing: create two variables pointing to the same ref cell, mutate through one, and read through the other.
   - Nested references: a reference to a reference ($\text{Ref}\;(\text{Ref}\;\text{Nat})$).
   - Store growth: allocate multiple references and verify they have distinct locations.
   - Type error detection: verify that assigning a value of the wrong type is rejected by the type checker (e.g., storing a boolean in a $\text{Ref}\;\text{Nat}$).

### Problem B2: Exceptions (12 points)

Implement the following:

1. **Simple exceptions:** $\text{error}$ and $\text{try}\;t_1\;\text{with}\;t_2$ (the simple version from Lecture 03b Section 2.3).

2. **Exceptions with values:** $\text{raise}\;t$ and $\text{try}\;t_1\;\text{with}\;t_2$ where $t_2$ receives the exception value (Lecture 03b Section 2.5). You may use a fixed exception type (e.g., $T_{\text{exn}} = \text{Nat}$) or make it configurable.

3. **Tests (required):**
   - Basic error propagation: verify that $\text{error}$ propagates through application, conditionals, and arithmetic.
   - Exception catching: verify that $\text{try}\;\text{error}\;\text{with}\;v$ yields $v$.
   - No exception: verify that $\text{try}\;v\;\text{with}\;t_2$ yields $v$.
   - Nested exception handling: verify that inner handlers catch before outer handlers, and that re-raising propagates to the next handler.
   - Exception with values: verify that $\text{raise}\;v$ carries the value $v$ to the handler.
   - Exception propagation through function application: verify that exceptions in arguments propagate outward.
   - Interaction with references: verify that side effects performed before an exception persist after the exception is caught.

### Problem B3: Recursive Types with Fold/Unfold (14 points)

Implement the following:

1. **Type-level operations:** Type substitution $[X \mapsto S]\,T$ and recursive type unfolding.

2. **Type checker:** Add rules T-Fold and T-Unfold. Verify that fold's argument has the unfolded type and unfold's argument has the recursive type.

3. **Evaluator:** Implement fold (wrapping) and unfold (unwrapping) as value constructors/destructors.

4. **Data structures:** Using your implementation, define and test:
   - Natural number lists: $\text{List}\;\text{Nat} = \mu X.\, \text{Unit} + (\text{Nat} \times X)$ with nil, cons, and a length function using $\text{fix}$.
   - Binary trees: $\text{Tree}\;\text{Nat} = \mu X.\, \text{Nat} + (X \times X)$ with leaf, node, and a depth function using $\text{fix}$.
   - Streams (optional, for bonus credit): $\text{Stream}\;\text{Nat} = \mu X.\, \text{Nat} \times (\text{Unit} \to X)$ with head, tail, and a take function.

5. **Tests (required):**
   - Type checking: verify that fold with the wrong type annotation is rejected.
   - Type checking: verify that unfold applied to a non-recursive type is rejected.
   - List operations: construct a list, compute its length, and verify the result.
   - Tree operations: construct a tree, compute its depth or size, and verify the result.
   - Nested fold/unfold: verify that $\text{unfold}\;(\text{fold}\;v) = v$ in the evaluator.

### Problem B4: The Fix Operator (12 points)

Implement the following:

1. **Type checker:** Add rule T-Fix. Verify that the argument has type $T \to T$ for some $T$.

2. **Evaluator:** Implement $\text{fix}$ using one of the following strategies:
   - **Substitution-based:** Implement E-FixBeta directly, substituting the $\text{fix}$ expression for the bound variable.
   - **Environment-based:** Create a recursive closure by tying the knot in the environment (as in Recitation 03).

   Document which strategy you chose and why.

3. **Tests:**
   - Factorial (encode multiplication as repeated addition if needed).
   - List reversal using an accumulator.
   - A diverging term: verify that $\text{fix}\;(\lambda x : \text{Unit}.\, x)$ does not terminate (test with a step limit or timeout).
   - List append using fix and recursive types.
   - Type error: verify that $\text{fix}\;(\lambda x : \text{Nat}.\, \text{true})$ is rejected by the type checker (since $\text{Nat} \neq \text{Bool}$, the function does not have type $T \to T$).

---

## Design Notes

### On Type Annotations

The $\text{fold}$ and $\text{unfold}$ operations require type annotations (the recursive type $\mu X.\, T$). This is because, in general, the type checker cannot infer which recursive type is intended. For example, if we have:

$$\text{fold}\;(\text{inl}\;\text{unit})$$

this could be folding into $\mu X.\, \text{Unit} + X$ (natural numbers), $\mu X.\, \text{Unit} + (\text{Nat} \times X)$ (nat lists), or any other recursive type with $\text{Unit}$ as the left branch. The annotation disambiguates.

### On Store Implementation

For the store, you have several implementation choices:

1. **List with index.** Simple but $O(n)$ for lookup and update. Good for testing.
2. **Hash table.** $O(1)$ amortized. Good for performance.
3. **Functional map (e.g., `Map.Make(Int)`).** $O(\log n)$ with immutable snapshots. Useful if you want to support transactional semantics.

We recommend starting with option (1) and optimizing later if needed.

### On Error Reporting

Your type checker should produce informative error messages. At minimum, error messages should include:

- The term that failed to type-check.
- The expected type vs. the actual type (for type mismatches).
- The rule that was being applied when the error occurred.

---

## Submission Checklist

- [ ] **Part A:** PDF with complete, rigorous proofs for problems A1-A3. All proof steps must be justified by specific typing rules, evaluation rules, or lemmas.
- [ ] **Part B:** OCaml source files that compile and run. Include:
  - `syntax.ml` -- type and term definitions
  - `store.ml` -- store implementation
  - `typecheck.ml` -- type checker
  - `eval.ml` -- evaluator
  - `tests.ml` -- all test cases (provided + your own)
  - `README` -- brief description of design decisions and any known limitations
- [ ] All test cases pass (provided + your own).
- [ ] At least five custom test cases per feature (references, exceptions, recursive types, fix).

---

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Preservation proof | 8 | Correct handling of store typing extension; all required cases |
| A1: Progress proof | 7 | Correct use of canonical forms and store well-typedness |
| A1: Canonical forms | 5 | Complete and rigorous |
| A2: Tree encoding | 5 | Correct fold/unfold usage; complete term |
| A2: sum\_tree derivation | 5 | Correct typing derivation with unfold and fix |
| A2: Stream encoding | 5 | Correct thunked stream; evaluation trace |
| A3: Amber equivalence proof | 5 | Correct derivation tree with assumptions |
| A3: Non-equivalence proof | 5 | Sound argument via infinite tree analysis |
| A3: Recursive subtyping | 5 | Correct variance analysis |
| B1: References | 12 | Correct type checking and evaluation; aliasing test |
| B2: Exceptions | 12 | Both simple and valued exceptions; propagation and nesting |
| B3: Recursive types | 14 | Type substitution, fold/unfold, list and tree tests |
| B4: Fix operator | 12 | Correct implementation; factorial, list reversal, divergence test |
| **Total** | **100** | |

---

## Hints

### Hint for A1(a)

The most important case is E-RefV. The key insight is that the store typing must be *extended* (not just reused) because a new location is added to the store. Carefully construct $\Sigma' = \Sigma[l \mapsto T]$ and verify that:

1. $\Sigma \subseteq \Sigma'$ (by Definition 2.2, since $l \notin \text{dom}(\Sigma)$).
2. The new term $l$ has type $\text{Ref}\;T$ under $\Sigma'$ (by T-Loc).
3. The new store $\mu[l \mapsto v]$ is well typed under $\Sigma'$ (requires Lemma 2.3 for existing locations, plus direct typing for the new location).

### Hint for A2(b)

The typing derivation should proceed bottom-up from the leaves. The key step is showing how $\text{unfold}[\text{NatTree}]\;t$ produces a type $\text{Nat} + (\text{NatTree} \times \text{NatTree})$, which can then be case-analyzed. The $\text{fix}$ template function has type $(\text{NatTree} \to \text{Nat}) \to (\text{NatTree} \to \text{Nat})$.

### Hint for A3(a)

Start by applying S-Rec (or EQ-Rec) to both $\mu$-types, adding $(X, Y)$ to the assumption set $A$. Then compare the bodies. The right-hand side has a nested $\mu Z.\, \ldots$ which should be compared with the variable $X$ from the left-hand side. Use EQ-Rec again for the nested $\mu$, adding $(X, Z)$ to $A$. Then use EQ-Var to close the derivation.

### Hint for B3

The type substitution function is the most delicate part. Be sure to handle:

- Variable capture: if $\mu X.\, T$ contains a free occurrence of $Y$, and you substitute $[Y \mapsto \mu X.\, S]$, make sure $X$ does not capture free occurrences of $X$ in $\mu X.\, S$. (In practice, use alpha-renaming or de Bruijn indices.)
- Nested recursive types: $\mu X.\, \mu Y.\, T$ requires substituting for $X$ only in the body of the outer $\mu$, not in the inner $\mu$ (unless the inner $\mu$ does not shadow $X$).

### Hint for B4

The recursive closure approach (used in Recitation 03) is simpler to implement than explicit substitution. The key is OCaml's `let rec`:

```ocaml
let rec fix_env = (x, VClosure(x, body, fix_env)) :: closure_env
```

This creates a circular environment where the variable $x$ maps to a closure whose own environment contains the binding for $x$. When the closure is applied, it can look up $x$ in its environment to get itself back, implementing the fixed-point semantics.

### Hint for B2

For implementing exceptions with values, use OCaml's own exception mechanism:

```ocaml
exception RaisedException of value

(* In eval: *)
| TmRaise t1 ->
    let v = eval env s t1 in
    raise (RaisedException v)

| TmTryWith (t1, t2) ->
    (try eval env s t1
     with RaisedException v -> eval_app (eval env s t2) v s)
```

This elegantly uses the meta-language's exception mechanism to implement the object language's exceptions. Exception propagation through all intermediate contexts is handled automatically by OCaml's runtime.

---

## Bonus Problems (Optional, up to 10 extra points)

### Bonus 1: Equi-Recursive Type Checker (5 points)

Implement an equi-recursive type checker that uses the Amber rules (Section 5.4 of Lecture 03c) instead of requiring explicit fold/unfold. Your type checker should:

1. Maintain an assumption set $A$ of type variable pairs.
2. Automatically unfold $\mu$-types when needed for type comparison.
3. Detect and report non-equivalent types.

Test your implementation on the examples from Problem A3.

### Bonus 2: Step-Limited Evaluation (5 points)

Add a step counter to your evaluator that limits the number of evaluation steps. This is useful for detecting diverging programs. Implement a function:

```ocaml
val eval_bounded : int -> env -> store -> term -> value option
```

that returns `None` if the step limit is exceeded and `Some v` if evaluation terminates within the limit.

Test that `eval_bounded 100 [] (empty_store ()) (TmFix (TmAbs ("x", TUnit, TmVar "x")))` returns `None`.
