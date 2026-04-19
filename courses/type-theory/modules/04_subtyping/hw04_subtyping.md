---
title: "Homework 04: Subtyping"
tags:
  - type-theory
  - subtyping
  - homework
  - module-index
---
# Homework 04: Subtyping

**Estimated time:** 20 hours
**Due date:** Two weeks from assignment
**Submission:** LaTeX writeup (PDF) + OCaml code

---

## Overview

This homework has two parts of equal weight. Part A tests your understanding of the metatheory of subtyping through formal proofs and derivations. Part B requires you to implement a full type checker with subtyping, records, and variants.

**Academic integrity:** You may discuss approaches with classmates, but all proofs and code must be your own. Cite any references you consult beyond the course materials.

---

## Part A: Proofs and Derivations (50%)

### Problem A1: Subtyping Derivations (10 points)

For each of the following, either construct a complete subtyping derivation tree (citing each rule used) or prove that no derivation exists.

**(a)** [2 points] $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat} <: \{x : \text{Nat}\} \to \top$

**(b)** [2 points] $(\top \to \text{Bool}) \to \text{Nat} <: (\text{Nat} \to \top) \to \top$

**(c)** [3 points] $\{f : \text{Nat} \to \{a : \text{Nat}, b : \text{Bool}\}, g : \top\} <: \{f : \text{Bool} \to \{a : \text{Nat}\}\}$

**(d)** [3 points] $(\{x : \text{Nat}\} \to \{x : \text{Nat}, y : \text{Bool}\}) \to \text{Nat} <: (\{x : \text{Nat}, y : \text{Bool}\} \to \{x : \text{Nat}\}) \to \top$

---

### Problem A2: Variance Analysis (10 points)

**(a)** [4 points] Consider the type constructor $F(X) = (X \to \text{Nat}) \to X$. Determine the variance of $X$ in $F$. Specifically, if $S <: T$, does $F(S) <: F(T)$, $F(T) <: F(S)$, both, or neither? Justify your answer by attempting to construct the subtyping derivation and identifying where it succeeds or fails.

**(b)** [3 points] For the type constructor $G(X) = X \to X$, prove that $G$ is neither covariant nor contravariant. Give concrete types $S <: T$ such that $G(S) \not<: G(T)$ and $G(T) \not<: G(S)$.

**(c)** [3 points] Define a type constructor $H(X)$ that is covariant in $X$ and uses $X$ at least twice. Prove that for all $S <: T$, $H(S) <: H(T)$.

---

### Problem A3: Progress and Preservation (15 points)

Consider the STLC extended with subtyping, records, and a $\top$ type, as defined in Lectures 04a-04c.

**(a)** [5 points] **Canonical Forms.** State and prove the canonical forms lemma for record types: if $v$ is a value and $\vdash v : \{l_i : T_i\}_{i \in 1..n}$, then $v = \{k_j = v_j\}_{j \in 1..m}$ where for each $i \in 1..n$, there exists $j \in 1..m$ with $k_j = l_i$ and $\vdash v_j : S_j$ with $S_j <: T_i$. Be explicit about how subsumption (T-Sub) is handled.

**(b)** [5 points] **Preservation for Projection.** Prove the preservation theorem for the specific case of the record projection evaluation rule E-ProjRcd:

$$\{l_i = v_i\}_{i \in 1..n}.l_j \to v_j \qquad (j \in 1..n)$$

That is, show: if $\Gamma \vdash \{l_i = v_i\}_{i \in 1..n}.l_j : T$ and $\{l_i = v_i\}_{i \in 1..n}.l_j \to v_j$, then $\Gamma \vdash v_j : T$. Use the inversion lemma for records and the subtype inversion lemma for record types.

**(c)** [5 points] **Preservation for Beta-Reduction.** Prove the preservation theorem for the specific case of the beta-reduction evaluation rule E-AppAbs:

$$(\lambda x : S_1.\, t_{12})\; v_2 \to [x \mapsto v_2]\,t_{12}$$

That is, show: if $\Gamma \vdash (\lambda x : S_1.\, t_{12})\; v_2 : T$ and $(\lambda x : S_1.\, t_{12})\; v_2 \to [x \mapsto v_2]\,t_{12}$, then $\Gamma \vdash [x \mapsto v_2]\,t_{12} : T$. Clearly state where you use the inversion lemma, the subtype inversion for arrows, the substitution lemma, and T-Sub.

---

### Problem A4: Algorithmic Subtyping (15 points)

**(a)** [5 points] **Admissibility of Transitivity.** Prove the following special case of transitivity admissibility for algorithmic subtyping: if $S_1 \times S_2 <:_a U_1 \times U_2$ and $U_1 \times U_2 <:_a T_1 \times T_2$, then $S_1 \times S_2 <:_a T_1 \times T_2$. Write out every step.

**(b)** [5 points] **Completeness for Records.** Prove the completeness theorem for the specific case of record subtyping: if $\{k_j : S_j\}_{j \in 1..m} <: \{l_i : T_i\}_{i \in 1..n}$ (in the declarative system), then $\{k_j : S_j\}_{j \in 1..m} <:_a \{l_i : T_i\}_{i \in 1..n}$ (in the algorithmic system). You may assume the completeness theorem holds for all smaller types (as an induction hypothesis).

**(c)** [5 points] **Coercion Coherence.** Consider the subtyping judgment $\text{Bool} <: \top$. There are two derivations:

- **Derivation 1:** Directly by S-Top.
- **Derivation 2:** By S-Trans with $\text{Bool} <: \text{Nat}$ (via S-BoolNat) and $\text{Nat} <: \top$ (via S-Top).

Write out the coercion term $\lbrack\!\lbrack \mathcal{D} \rbrack\!\rbrack$ for each derivation and show that they are $\beta\eta$-equivalent.

---

### Problem A5: Joins and Meets (10 points)

**(a)** [3 points] Compute the join and meet of the following type pairs. Show your work by applying the recursive definitions from Lecture 04b.

- $(\text{Nat} \to \{x : \text{Nat}, y : \text{Bool}\}) \sqcup (\text{Bool} \to \{x : \text{Nat}, z : \top\})$
- $(\text{Nat} \times \text{Bool}) \sqcap (\top \times \text{Nat})$
- $(\{a : \text{Nat} \to \text{Bool}, b : \text{Nat}\}) \sqcup (\{a : \text{Bool} \to \text{Nat}, c : \text{Bool}\})$

**(b)** [4 points] Prove that $S <: S \sqcup T$ for all types $S$ and $T$ in our system. Proceed by structural induction on $S$ and $T$, covering the cases where:
- $S$ and $T$ are both arrow types.
- $S$ and $T$ are both record types.
- $S$ and $T$ have different outermost constructors.

**(c)** [3 points] Give an example of types $A$, $B$, $C$ such that:

$$A \sqcup (B \sqcap C) \neq (A \sqcup B) \sqcap (A \sqcup C)$$

or prove that the distributive law always holds in our system. (Hint: consider arrow types with different domain/codomain structures.)

---

## Part B: Implementation (50%)

Implement a type checker for the STLC extended with subtyping, records, and variants in OCaml. Your implementation must include the following components.

### B1: Core Language (15 points)

Implement the following:

1. **Type definitions** for the syntax of types and terms, including:
   - Base types: `Bool`, `Nat`
   - Arrow types: `T1 -> T2`
   - Product types: `T1 * T2`
   - Record types: `{l1: T1, ..., ln: Tn}`
   - Variant types: `<l1: T1, ..., ln: Tn>`
   - `Top` and `Bot`

2. **Algorithmic subtype check:** `is_subtype : ty -> ty -> bool`
   - All rules from Lecture 04b (SA-Top, SA-Bot, SA-Arrow, SA-Prod, SA-Rcd, etc.)
   - Include `Bool <: Nat`
   - Record subtyping (width, depth, permutation via the combined rule)
   - Variant subtyping (dual to records)

3. **Type checker:** `typeof : context -> term -> ty`
   - Computes the minimal type of a term
   - Uses `is_subtype` for checking argument types in applications
   - Uses `join` for conditional and case expression result types

### B2: Joins and Meets (10 points)

Implement:

1. `join : ty -> ty -> ty` -- computes the least upper bound
2. `meet : ty -> ty -> ty` -- computes the greatest lower bound

Ensure that:
- `is_subtype s (join s t) = true` for all `s`, `t`
- `is_subtype t (join s t) = true` for all `s`, `t`
- `is_subtype (meet s t) s = true` for all `s`, `t`
- `is_subtype (meet s t) t = true` for all `s`, `t`

### B3: Test Suite (15 points)

Write a comprehensive test suite that covers:

1. **Subtype check tests** (at least 20 tests):
   - Reflexivity for each type constructor (Bool, Nat, Top, Bot, arrow, product, sum, record)
   - Transitivity chains (e.g., Bot <: Bool <: Nat <: Top)
   - Arrow contravariance/covariance (at least 4 arrow subtyping tests)
   - Record width subtyping (adding extra fields)
   - Record depth subtyping (refining field types)
   - Record permutation subtyping (reordering fields)
   - Combined record subtyping (width + depth + permutation simultaneously)
   - Variant subtyping (dual to records: fewer alternatives = subtype)
   - Non-subtype pairs (at least 5 negative tests, e.g., Nat </: Bool, arrow </: product)
   - Nested types (e.g., arrow of records, record of arrows)

2. **Type checker tests** (at least 15 tests):
   - Function application where argument type exactly matches
   - Function application with subtyping on the argument
   - Record projection after width subtyping
   - Nested records with depth subtyping
   - Higher-order function with arrow subtyping
   - Conditionals with different branch types (join)
   - Conditionals where both branches have the same type
   - Case analysis on variants with different branch types
   - Term using Top type (lambda accepting Top)
   - Numeric operations (succ, pred, iszero) with Bool <: Nat
   - At least 5 tests that should fail (ill-typed terms), including:
     - Missing record field
     - Wrong direction of arrow subtyping
     - Applying a non-function
     - Projecting a non-existent field
     - Incompatible types in application

3. **Join/meet tests** (at least 10 tests):
   - Joins and meets of arrow types (verify domain contravariance)
   - Joins and meets of record types (verify label intersection/union)
   - Joins and meets of product types
   - Joins and meets of sum types
   - Joins of incompatible types (should be `Top`)
   - Meets of incompatible types (should be `Bot`)
   - Joins/meets involving `Top` and `Bot`
   - Verification of the upper/lower bound properties: for each pair `(s, t)`, check that `is_subtype s (join s t)` and `is_subtype t (join s t)` and `is_subtype (meet s t) s` and `is_subtype (meet s t) t`

### B4: Pretty Printer and Runner (10 points)

Implement:

1. `pp_ty : ty -> string` -- prints types in readable form:
   - Arrow types should use `->` with appropriate parenthesization (right-associative).
   - Product types should use `*`.
   - Record types should use `{l1: T1, l2: T2}` format.
   - Variant types should use `<l1: T1, l2: T2>` format.

2. `pp_term : term -> string` -- prints terms in readable form:
   - Abstractions: `(\x:T. body)`
   - Applications: `(t1 t2)`
   - Records: `{l1 = t1, l2 = t2}`
   - Projections: `t.l`
   - Variants: `<l = t> as T`

3. `run : term -> unit` -- type-checks and (optionally) evaluates a term, printing:
   - The term
   - Its type (or an error message)
   - Its value (if you implement an evaluator)

Use your pretty printers throughout your test suite to produce readable output.

**Example output format:**

```
(\f:{x:Nat} -> Nat. (f {x = 0, y = true})) : ({x : Nat} -> Nat) -> Nat
{x : Nat, y : Bool} <: {x : Nat}? true
join({x:Nat, y:Bool}, {x:Nat, z:Top}) = {x : Nat}
```

---

### B5: Example Programs (Bonus, up to 5 extra points)

Write at least 3 non-trivial example programs (as OCaml values of type `term`) that demonstrate interesting subtyping behavior. Each program should:

1. Be well-typed (your type checker should accept it).
2. Use at least 2 different subtyping features (e.g., width + depth, arrow contravariance + record width).
3. Include a comment explaining what subtyping features it exercises and why it is type-safe.

Example ideas:
- A function that takes a "serializable" record (with a `to_string` field) and applies it to a record with additional fields.
- A higher-order function that composes two functions with compatible but non-identical types.
- A conditional expression whose branches have different record types, demonstrating join computation.

---

## Submission Checklist

- [ ] Part A: LaTeX writeup with all proofs (Problems A1-A4)
- [ ] Part B: OCaml source files:
  - `syntax.ml` -- type and term definitions
  - `subtype.ml` -- `is_subtype`, `join`, `meet`
  - `typecheck.ml` -- `typeof`
  - `pretty.ml` -- `pp_ty`, `pp_term`
  - `test_subtyping.ml` -- test suite
  - `dune` and `dune-project` files
- [ ] All tests pass
- [ ] Code compiles with `dune build` without warnings

---

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Derivations | 10 | Correct derivation trees with rule citations |
| A2: Variance | 10 | Correct variance analysis with proofs/counterexamples |
| A3: Progress/Preservation | 15 | Complete proofs with correct use of inversion and substitution lemmas |
| A4: Algorithmic Subtyping | 15 | Correct admissibility and completeness proofs; coherence argument |
| B1: Core Language | 15 | Correct subtype check and type checker |
| B2: Joins/Meets | 10 | Correct implementation satisfying lattice properties |
| B3: Test Suite | 15 | Comprehensive coverage including positive and negative tests |
| B4: Pretty Printer | 10 | Readable output for types and terms |
| **Total** | **100** | |

---

---

## Part A Supplementary: Derivation Reference

For your convenience, here are the inference rules you will need for the proofs:

### Subtyping Rules

$$\frac{}{S <: S} \text{(S-Refl)} \qquad \frac{S <: U \quad U <: T}{S <: T} \text{(S-Trans)} \qquad \frac{}{S <: \top} \text{(S-Top)} \qquad \frac{}{\bot <: T} \text{(S-Bot)}$$

$$\frac{T_1 <: S_1 \quad S_2 <: T_2}{S_1 \to S_2 <: T_1 \to T_2} \text{(S-Arrow)} \qquad \frac{S_1 <: T_1 \quad S_2 <: T_2}{S_1 \times S_2 <: T_1 \times T_2} \text{(S-Prod)}$$

$$\frac{\forall i \in 1..n.\; \exists j \in 1..m.\; k_j = l_i \wedge S_j <: T_i}{\{k_j : S_j\}_{j \in 1..m} <: \{l_i : T_i\}_{i \in 1..n}} \text{(S-Rcd)}$$

### Typing Rules (Selected)

$$\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \text{(T-Var)} \qquad \frac{\Gamma, x : T_1 \vdash t_2 : T_2}{\Gamma \vdash \lambda x : T_1.\, t_2 : T_1 \to T_2} \text{(T-Abs)}$$

$$\frac{\Gamma \vdash t_1 : T_{11} \to T_{12} \quad \Gamma \vdash t_2 : T_{11}}{\Gamma \vdash t_1\; t_2 : T_{12}} \text{(T-App)} \qquad \frac{\Gamma \vdash t : S \quad S <: T}{\Gamma \vdash t : T} \text{(T-Sub)}$$

$$\frac{\Gamma \vdash t_i : T_i \;\text{for each}\; i}{\Gamma \vdash \{l_i = t_i\} : \{l_i : T_i\}} \text{(T-Rcd)} \qquad \frac{\Gamma \vdash t : \{l_i : T_i\} \quad j \in 1..n}{\Gamma \vdash t.l_j : T_j} \text{(T-Proj)}$$

### Key Lemmas

**Inversion for Abstraction (Lemma 2.1).** If $\Gamma \vdash \lambda x : S_1.\, t_2 : T$, then there exists $S_2$ such that $\Gamma, x : S_1 \vdash t_2 : S_2$ and $S_1 \to S_2 <: T$.

**Inversion for Records (Lemma 2.4).** If $\Gamma \vdash \{l_i = t_i\}_{i \in 1..n} : T$, then there exist $S_i$ with $\Gamma \vdash t_i : S_i$ for each $i$ and $\{l_i : S_i\}_{i \in 1..n} <: T$.

**Subtype Inversion for Arrows (Lemma 2.6).** If $S_1 \to S_2 <: T$ and $T \neq \top$, then $T = T_1 \to T_2$ with $T_1 <: S_1$ and $S_2 <: T_2$.

**Subtype Inversion for Records (Lemma 2.7).** If $\{l_i : S_i\}_{i \in 1..n} <: T$ and $T \neq \top$, then $T = \{k_j : T_j\}_{j \in 1..m}$ where for each $j$, there exists $i$ with $k_j = l_i$ and $S_i <: T_j$.

**Substitution (Lemma 2.12).** If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\,t : T$.

### Algorithmic Subtyping Rules (Selected)

$$\frac{}{S <:_a \top} \text{(SA-Top)} \qquad \frac{}{\bot <:_a T} \text{(SA-Bot)} \qquad \frac{T_1 <:_a S_1 \quad S_2 <:_a T_2}{S_1 \to S_2 <:_a T_1 \to T_2} \text{(SA-Arrow)}$$

$$\frac{S_1 <:_a T_1 \quad S_2 <:_a T_2}{S_1 \times S_2 <:_a T_1 \times T_2} \text{(SA-Prod)}$$

$$\frac{\forall i \in 1..n.\; \exists j \in 1..m.\; k_j = l_i \wedge S_j <:_a T_i}{\{k_j : S_j\}_{j \in 1..m} <:_a \{l_i : T_i\}_{i \in 1..n}} \text{(SA-Rcd)}$$

### Coercion Translation (Selected)

$$\lbrack\!\lbrack S <: S \rbrack\!\rbrack = \lambda x : S.\, x$$

$$\lbrack\!\lbrack S <: \top \rbrack\!\rbrack = \lambda x : S.\, \text{unit}$$

$$\lbrack\!\lbrack S_1 \to S_2 <: T_1 \to T_2 \rbrack\!\rbrack = \lambda f : S_1 \to S_2.\, \lambda x : T_1.\, \lbrack\!\lbrack S_2 <: T_2 \rbrack\!\rbrack\;(f\;(\lbrack\!\lbrack T_1 <: S_1 \rbrack\!\rbrack\;x))$$

---

## Hints

- For A1(c) and A1(d), carefully unpack the arrow subtyping rule, noting which premise is contravariant and which is covariant. Draw the full derivation tree. For the record subtype premises, apply S-Rcd and check each field individually.
- For A2(a), note that $X$ appears in both covariant and contravariant positions. Work through $S <: T$ and try to derive $F(S) <: F(T)$ and $F(T) <: F(S)$ separately.
- For A3, the key technical challenge is handling the interaction between inversion lemmas and the subsumption rule. Make sure to use the inversion lemma for typing (which accounts for T-Sub) rather than naive pattern matching on the last rule. Explicitly state when you use T-Sub to bridge type gaps.
- For A4(c), write out the coercion terms as lambda calculus expressions and show they compute the same function by beta-reducing both to a common normal form.
- For B1, implement `is_subtype` first and test it thoroughly before starting the type checker. Most type-checker bugs come from incorrect subtyping. Test both positive and negative cases.
- For B2, remember that the join of arrow types uses the meet for the domain (contravariance) and the join for the codomain. For records, the join intersects label sets and joins common field types.
- For B3, test corner cases: empty records $\{\ \}$, $\bot$ and $\top$ in various positions (as domains, codomains, field types), nested arrows with mixed variance, and records with overlapping and non-overlapping field sets.
- For B4, parenthesize arrow types to show right-associativity, and format records with commas between fields.

---

---

## Recommended Development Order

We recommend implementing the homework in this order:

1. **Types and terms** (`syntax.ml`): Define the AST types first.
2. **Pretty printer** (`pretty.ml`): Implement `pp_ty` and `pp_term` so you can debug.
3. **Subtype check** (`subtype.ml`): Implement `is_subtype` and test it extensively.
4. **Joins and meets** (`subtype.ml`): Implement `join` and `meet` and verify their properties.
5. **Type checker** (`typecheck.ml`): Implement `typeof` using `is_subtype` and `join`.
6. **Test suite** (`test_subtyping.ml`): Write comprehensive tests.

Start each component with the simplest cases (base types, no records) and gradually add complexity (arrows, records, variants).

---

## Bonus Challenge (Optional, no extra credit)

Implement the coercion translation: write a function `coerce : ty -> ty -> term -> term` that, given a source type $S$, a target type $T$ with $S <: T$, and a term of type $S$, produces a term in the STLC without subtyping that has type $T$. Use this to "compile away" all subtyping in a well-typed program, producing an equivalent program in the STLC with records but without subtyping.

This is a significant undertaking but provides deep insight into the operational meaning of subtyping.
You may find it helpful to consult the coercion semantics discussion in Lecture 04c, Section 8.
