---
title: "Homework 07: Higher-Order Types"
tags:
  - type-theory
  - lambda-cube
  - homework
---
# Homework 07: Higher-Order Types

**Due:** End of Week 14
**Total Points:** 100 (Part A: 50, Part B: 50)

---

## Overview

This homework covers kinds and type operators, System $F_\omega$, bounded quantification ($F_{<:}$), and the lambda cube / Pure Type Systems. Part A focuses on formal proofs and theoretical analysis. Part B requires implementing a type checker for a language with higher-kinded types and bounded quantification.

**Submission:** A single PDF (for Part A) and a code repository with a README (for Part B). Include all proofs, derivations, and test output in your writeup.

**Collaboration policy:** You may discuss high-level proof strategies with classmates, but all written proofs and code must be your own. Cite any sources you consult beyond the assigned readings.

**Recommended readings:**

- Pierce, TAPL Chapters 25--26, 28--32
- Barendregt (1992), "Lambda Calculi with Types" (Sections 5.1--5.4)
- Cardelli and Wegner (1985), "On Understanding Types, Data Abstraction, and Polymorphism"
- Pierce (1994), "Bounded Quantification is Undecidable"

---

## Part A: Theory (50%)

### Problem 1: Type Safety for a Fragment of $F_\omega$ (12%)

Consider the following fragment of $F_\omega$ with kinds $K ::= * \mid K_1 \Rightarrow K_2$, type expressions $T ::= X \mid T_1 \to T_2 \mid \lambda X :: K.\; T \mid T_1\; T_2$, and terms $e ::= x \mid \lambda x : T.\; e \mid e_1\; e_2$.

(Note: this fragment omits $\forall X :: K.\; T$ and $\Lambda X :: K.\; e$ --- it has type-level lambdas but no term-level type abstraction. This is the system $\lambda\underline{\omega}$ from the lambda cube.)

**(a)** (4 points) State the kinding rules and typing rules for this fragment precisely. Then state the Preservation theorem.

**(b)** (4 points) Prove the Substitution Lemma for this fragment:

$$\text{If } \Delta; \Gamma, x : S \vdash e : T \text{ and } \Delta; \Gamma \vdash v : S, \text{ then } \Delta; \Gamma \vdash [x \mapsto v]e : T.$$

Proceed by induction on the typing derivation $\Delta; \Gamma, x : S \vdash e : T$.

**(c)** (4 points) Prove the Preservation theorem:

$$\text{If } \Delta; \Gamma \vdash e : T \text{ and } e \longrightarrow e', \text{ then } \Delta; \Gamma \vdash e' : T.$$

You will need the Substitution Lemma from part (b) and the Kinding Substitution Lemma (you may use the latter without proof). Carefully handle the case where $T$ contains type-level redexes and explain why the type equivalence rule (T-Eq) is needed.

**(d)** (bonus, 2 points) State and prove the Progress theorem for this fragment:

$$\text{If } \emptyset; \emptyset \vdash e : T, \text{ then either } e \text{ is a value or } \exists e'.\; e \longrightarrow e'.$$

State the Canonical Forms Lemma you need and prove it.

---

### Problem 2: Lambda Cube Classification (10%)

**(a)** (5 points) For each of the following expressions, determine the *least expressive* lambda cube system in which it is well-typed. Justify your answer by identifying which dependencies (terms on types, types on types, types on terms) are required.

1. $\lambda f : \text{Nat} \to \text{Nat}.\; \lambda x : \text{Nat}.\; f\;(f\;x)$
2. $\Lambda X.\; \lambda f : X \to X.\; \lambda x : X.\; f\;(f\;x)$
3. $\lambda X :: *.\; X \to X$ (as a type-level expression)
4. $\Lambda X :: (* \Rightarrow *).\; \Lambda Y :: *.\; \lambda z : X\;Y.\; z$
5. $\lambda n : \text{Nat}.\; \text{Vec}\;\text{Bool}\;n$ (as a type-level expression, where $\text{Vec} : * \to \text{Nat} \to *$)

**(b)** (5 points) Write out the PTS specification $(\mathcal{S}, \mathcal{A}, \mathcal{R})$ for each system you identified in part (a). Then, for expression (2) above, give the complete PTS typing derivation, showing every application of the Axiom, Var, Weak, Prod, Abs, and App rules.

*Hint for the PTS derivation:* Start by deriving $\vdash * : \Box$ using the Axiom rule. Then build up the context step by step, introducing $X : *$, then $f : X \to X$ (which requires deriving $X \to X : *$ using the Prod rule), then $x : X$. Finally, derive the type of the body and close with Abs rules.

---

### Problem 3: Decidability of Kinding for $F_\omega$ (8%)

**(a)** (4 points) Prove the Uniqueness of Kinds theorem: if $\Delta \vdash T :: K_1$ and $\Delta \vdash T :: K_2$, then $K_1 = K_2$.

Proceed by induction on the structure of $T$. For the case $T = T_1\; T_2$ (type application), explain carefully how the induction hypothesis on $T_1$ yields the conclusion.

**(b)** (4 points) Prove that kinding is decidable: given a context $\Delta$ and a type expression $T$, there is an algorithm that either computes the unique kind $K$ such that $\Delta \vdash T :: K$, or reports that $T$ is ill-kinded.

State the algorithm explicitly (as pseudocode or as a recursive function), and prove that it terminates and is correct (sound and complete with respect to the kinding rules).

*Hint:* The algorithm should be a recursive function $\texttt{kindof}(\Delta, T)$ that pattern-matches on $T$. For each case, show:

- **Soundness:** if $\texttt{kindof}(\Delta, T) = K$, then $\Delta \vdash T :: K$.
- **Completeness:** if $\Delta \vdash T :: K$, then $\texttt{kindof}(\Delta, T) = K$.
- **Termination:** define a suitable measure on $(\Delta, T)$ that decreases with each recursive call.

---

### Problem 4: Subtyping in $F_{<:}$ (10%)

**(a)** (3 points) Prove the Narrowing Lemma for kernel $F_{<:}$:

$$\text{If } \Gamma, X <: U, \Delta \vdash S <: T \text{ and } \Gamma \vdash U' <: U, \text{ then } \Gamma, X <: U', \Delta \vdash S <: T.$$

Proceed by induction on the subtyping derivation. Identify the critical case (which rule?) and explain how transitivity is used.

**(b)** (3 points) The following subtyping is provable in *full* $F_{<:}$ but not in *kernel* $F_{<:}$:

$$\emptyset \vdash (\forall X <: \text{Top}.\; X \to X) <: (\forall X <: \text{Nat}.\; X \to X)$$

Explain precisely why this fails in kernel $F_{<:}$ (which premise of the kernel SA-All rule is not satisfied?) and show a complete derivation in full $F_{<:}$.

**(c)** (4 points) Pierce (1994) proved that subtyping in full $F_{<:}$ is undecidable by reduction from the halting problem for two-counter machines.

Explain the key insight: why does the full S-All rule (as opposed to the kernel version) create enough computational power to simulate a counter machine? Your explanation should identify:
- What plays the role of the counter values.
- What plays the role of the state transitions.
- How the "feedback loop" between the left and right sides of a subtyping judgment arises.

You do not need to reproduce the full proof; a clear high-level explanation with sufficient technical detail is expected.

**(d)** (bonus, 2 points) Consider a variant of $F_{<:}$ where the subtyping rule for bounded quantification is:

$$
\frac{S_1 = T_1 \qquad \Gamma, X <: S_1 \vdash S_2 <: T_2}{\Gamma \vdash (\forall X <: S_1.\; S_2) <: (\forall X <: T_1.\; T_2)} \quad (\text{S-All-Equal})
$$

That is, the bounds must be *identical* (not merely in a subtyping relation). Is this variant strictly less expressive than kernel $F_{<:}$? Give an example of a subtyping judgment that holds in kernel $F_{<:}$ but not in this variant, or prove that the two are equivalent.

---

### Problem 5: Pure Type Systems (10%)

**(a)** (3 points) Consider the PTS with specification:

$$\mathcal{S} = \{*, \Box\}, \quad \mathcal{A} = \{(*, \Box)\}, \quad \mathcal{R} = \{(*, *, *),\; (\Box, *, *),\; (*, \Box, *)\}$$

Note the rule $(*, \Box, *)$: if $A : *$ and $B : \Box$, then $\Pi x : A.\; B : *$.

Explain why this rule is problematic. Specifically, show that it allows a term of type $\Pi x : T.\; *$ (a function that takes a term and returns a *type*) to be *itself* classified as a term-level type (an element of $*$ rather than $\Box$). Explain how this collapses the distinction between types and kinds and leads toward Girard's paradox.

**(b)** (3 points) Prove that in any lambda cube system (i.e., any PTS with $\mathcal{S} = \{*, \Box\}$, $\mathcal{A} = \{(*, \Box)\}$, and $\mathcal{R} \subseteq \{(*, *, *), (\Box, *, *), (\Box, \Box, \Box), (*, \Box, \Box)\}$), the following holds:

If $\Gamma \vdash e : \Box$, then $e$ is a sort or a $\Pi$-type (i.e., $e$ has the form $\Pi x : A.\; B$ after normalization).

*Hint:* Consider which rules can produce a judgment $\Gamma \vdash e : \Box$ and trace the possibilities.

**(c)** (4 points) Encode the following natural deduction rules in LF ($\lambda P$):

1. Disjunction introduction left: from a proof of $A$, conclude $A \vee B$.
2. Disjunction elimination: from a proof of $A \vee B$, a proof that $A$ implies $C$, and a proof that $B$ implies $C$, conclude $C$.

Declare all necessary LF constants with their types. Verify your encoding by writing the LF term corresponding to a proof of $A \vee B \Rightarrow B \vee A$.

*Hint:* You will need:

- A type $o : *$ of propositions.
- A type family $\text{pf} : o \to *$ of proofs.
- A constant $\text{or} : o \to o \to o$ for disjunction.
- Constants for the introduction and elimination rules.

For the proof of $A \vee B \Rightarrow B \vee A$, use disjunction elimination on the hypothesis $A \vee B$, with two cases: in the $A$ case, apply right introduction; in the $B$ case, apply left introduction.

---

## Part B: Implementation (50%)

### Overview

Implement a type checker for a language with higher-kinded types and bounded quantification. Your implementation should handle:

1. A kind system with $*$ and arrow kinds $K_1 \Rightarrow K_2$.
2. Type-level abstraction ($\lambda X :: K.\; T$) and application ($T_1\; T_2$).
3. Type-level beta-reduction and normalization.
4. Type equivalence via normalization.
5. Bounded universal quantification ($\forall X <: T_1.\; T_2$).
6. Algorithmic subtyping for kernel $F_{<:}$.

Use OCaml (recommended) or Haskell. Provide a test suite demonstrating correctness.

### Language Specification

Your language should support the following syntax (you may choose your own concrete syntax, but the abstract syntax must support all of these forms):

**Kinds:**

$$K ::= * \mid K_1 \Rightarrow K_2$$

**Type expressions:**

$$T ::= X \mid \text{Top} \mid T_1 \to T_2 \mid \forall X :: K.\; T \mid \forall X <: T_1.\; T_2 \mid \lambda X :: K.\; T \mid T_1\; T_2 \mid \{l_i : T_i\}_{i \in I} \mid \text{base}$$

where $\text{base}$ ranges over built-in types ($\text{Int}$, $\text{Bool}$, $\text{Nat}$, $\text{String}$).

**Terms:**

$$e ::= x \mid \lambda x : T.\; e \mid e_1\; e_2 \mid \Lambda X :: K.\; e \mid \Lambda X <: T.\; e \mid e\;[T] \mid \{l_i = e_i\}_{i \in I} \mid e.l \mid n \mid b \mid \text{succ} \mid \text{pred}$$

where $n$ ranges over integer literals, $b$ over boolean literals, and $\text{succ}, \text{pred}$ are built-in operations.

### Task 1: Kind Checker (10%)

Implement a kind checker that, given a kinding context $\Delta$ and a type expression $T$, computes the kind $K$ such that $\Delta \vdash T :: K$, or raises an error if $T$ is ill-kinded.

Your implementation must correctly handle:

- Kind $*$ and arrow kinds.
- Type variables with kind annotations.
- Type-level lambda ($\lambda X :: K.\; T$), producing kind $K \Rightarrow K'$.
- Type-level application ($T_1\; T_2$), checking kind compatibility.
- $\forall X :: K.\; T$ with kind $*$ (universal quantification).
- Base types ($\text{Int}$, $\text{Bool}$) with kind $*$.

**Test cases:** Your kind checker should correctly handle:

```
\X::*. X                       :: * => *
\X::*. X -> X                  :: * => *
\F::(* => *). \X::*. F X       :: (* => *) => * => *
(\X::*. X) Int                 :: *
forall X::*. X -> X            :: *
\X::*. \Y::*. X -> Y -> X     :: * => * => *
```

And reject with informative error messages:

```
List List       (where List :: * => *)
    Error: Kind mismatch in type application: expected *, got * => *
X               (unbound variable)
    Error: Unbound type variable X
(\X::*. X) (\Y::*. Y)
    Error: Kind mismatch in type application: expected *, got * => *
forall X::*. \Y::*. Y
    Error: Body of forall has kind * => *, expected *
```

### Task 2: Type-Level Normalization (10%)

Implement:

1. Capture-avoiding substitution at the type level.
2. Beta-reduction at the type level.
3. A normalization function that reduces a type expression to beta-normal form.
4. A type equivalence checker that normalizes both sides and compares structurally.

**Test cases:**

```
(\X::*. X -> X) Int                          ~~>  Int -> Int
(\F::(* => *). \X::*. F (F X)) List Int      ~~>  List (List Int)
(\X::*. \Y::*. X) Bool Nat                   ~~>  Bool
(\X::*. (\Y::*. Y) X) Int                    ~~>  Int
```

Equivalence:

```
(\X::*. X -> X) Int  ===  Int -> Int           true
\X::*. List X        ===  List                 true (eta)
(\X::*. X) (\Y::*. Y)  ===  \Y::*. Y          true
Int -> Int  ===  Bool -> Bool                   false
```

**Implementation notes:**

- Your substitution must be capture-avoiding. Test with cases where naive substitution would cause variable capture, e.g., $[X \mapsto Y](\lambda Y :: *.\; X)$ should alpha-rename $Y$ in the lambda before substituting.
- Your normalization should reduce under all binders (lambda bodies, forall bodies, both sides of arrows).
- For eta-equivalence, you may implement eta-expansion or eta-reduction; either approach is acceptable as long as the equivalence checker correctly identifies eta-equivalent types.

### Task 3: Bounded Quantification and Subtyping (15%)

Extend your type checker with:

1. A top type `Top`.
2. Record types $\{l_1 : T_1, \ldots, l_n : T_n\}$.
3. Bounded quantification $\forall X <: T_1.\; T_2$.
4. Bounded type abstraction $\Lambda X <: T.\; e$ and type application $e\;[T]$.
5. Algorithmic subtyping for kernel $F_{<:}$ (SA-Top, SA-Refl-TVar, SA-TVar, SA-Arrow, SA-All, SA-Rcd).

**Test cases for subtyping:**

```
{a:Int, b:Bool} <: {a:Int}                            true  (width)
{a:Int} <: {a:Int, b:Bool}                            false
(Top -> Int) <: (Int -> Top)                           true  (variance)
(Int -> Top) <: (Top -> Int)                           false
(forall X<:{a:Int,b:Bool}. X->X) <: (forall X<:{a:Int}. X->X)   false (kernel)
```

**Test cases for type checking:**

```
(/\X<:Top. \x:X. x) : forall X<:Top. X -> X
(/\X<:{m:Nat}. \x:X. x.m) : forall X<:{m:Nat}. X -> Nat
(/\X<:Top. \x:X. x) [Int] : Int -> Int
```

**Negative test cases for type checking:**

```
(/\X<:{m:Nat}. \x:X. x.m) [Int]
    Error: Int is not a subtype of {m:Nat}
(/\X<:Top. \x:X. x.m)
    Error: Projection from non-record type X (X <: Top, Top has no fields)
(\x:Int. x) true
    Error: Argument type Bool is not a subtype of Int
```

**Additional subtyping tests involving bounded quantification:**

```
(forall X<:Top. X -> X) <: (forall X<:Nat. X -> X)
    Kernel F-sub: false (Nat is not <: Top in the contra direction --
    actually Top is not <: Nat is the issue; in kernel SA-All, we need
    the RHS bound <: LHS bound, i.e., Nat <: Top, which holds)
```

Carefully check whether each of the following holds in kernel $F_{<:}$ and explain why:

```
(forall X<:Nat. X -> X) <: (forall X<:Top. X -> X)         -- ?
(forall X<:{a:Int}. X -> {a:Int}) <: (forall X<:Top. X -> Top)  -- ?
```

### Task 4: Integration and Testing (15%)

Write a comprehensive test suite that exercises all components together. Your tests should include:

1. **At least 15 positive test cases** (well-typed programs that should be accepted).
2. **At least 10 negative test cases** (ill-typed or ill-kinded programs that should be rejected with informative error messages).
3. **At least 5 tests involving the interaction** between type-level computation and bounded quantification (e.g., applying a bounded polymorphic function at a type constructed by a type operator).

Example integration test:

```
(* A type operator that constructs a record type *)
let RecordOf = \X::*. {val : X, show : X -> String}

(* A bounded polymorphic function using the constructed type *)
let getValue = /\X <: RecordOf Int. \x : X. x.val

(* getValue should have type: forall X <: {val:Int, show:Int->String}. X -> Int *)
(* After type-level reduction of RecordOf Int *)
```

**Suggested integration test: type-level computation with bounded polymorphism.**

The following program should type-check successfully. The type operator `RecordOf` constructs a record type from a base type, and the bounded polymorphic function `getValue` operates on any subtype of the constructed record:

```
(* Define a type operator *)
RecordOf :: * => *
RecordOf = \X::*. {val : X, display : X -> String}

(* RecordOf Int normalizes to {val : Int, display : Int -> String} *)

(* A bounded polymorphic function *)
getValue : forall Y <: RecordOf Int. Y -> Int
getValue = /\Y <: RecordOf Int. \y : Y. y.val

(* Application: the type argument must be a subtype of RecordOf Int *)
(* which after normalization is {val:Int, display:Int->String} *)
getValue [{val:Int, display:Int->String, extra:Bool}]
    {val=42, display=(\n:Int. "hello"), extra=true}
(* Should type-check and return type: Int *)
```

**Another integration test: higher-kinded bounded quantification.**

```
(* Compose type operator *)
Compose :: (* => *) => (* => *) => * => *
Compose = \F::(* => *). \G::(* => *). \X::*. F (G X)

(* Polymorphic function using a composed type *)
wrap : forall F :: (* => *). forall X :: *. X -> F X
(* This requires kind-annotated universal quantification *)

(* Apply with Compose List Maybe Int to get List (Maybe Int) *)
```

**Deliverables for Part B:**

1. Source code with clear module structure. Recommended modules:
   - `syntax.ml`: AST definitions for kinds, types, and terms.
   - `kind_check.ml`: The kind checker.
   - `type_norm.ml`: Type-level substitution, reduction, normalization, and equivalence.
   - `subtype.ml`: The algorithmic subtyping checker for kernel $F_{<:}$.
   - `type_check.ml`: The type checker, combining all components.
   - `test.ml`: The test suite.
2. A `README` explaining how to build and run the tests.
3. Test output showing all tests passing.
4. A brief design document (1--2 pages) explaining:
   - Your representation choices (e.g., named variables vs. de Bruijn indices).
   - The structure of the type checker and how the components interact.
   - Any interesting implementation decisions (e.g., how you handle alpha-equivalence, the normalization strategy, error reporting).
   - Known limitations or extensions you considered.

### Grading Criteria for Part B

| Criterion | Points |
|-----------|--------|
| Kind checker: correct kinding for all type forms | 10 |
| Normalization: correct substitution, beta-reduction, normalization, and equivalence | 10 |
| Subtyping: correct algorithmic subtyping for kernel $F_{<:}$ | 7 |
| Type checking: correct typing for all term forms including bounded quantification | 8 |
| Test suite: comprehensive positive and negative tests | 8 |
| Integration tests: type-level computation interacting with subtyping | 4 |
| Code quality: clear structure, good error messages, documentation | 3 |
