---
title: "Homework 06: System F"
tags:
  - type-theory
  - system-f
  - homework
---
# Homework 06: System F

> **Module 06 --- Polymorphism & System F**
> **Due:** Two weeks after assignment
> **Estimated time:** ~20 hours
> **Total points:** 200

---

## Instructions

- Show all work for theory problems. A correct answer without justification receives no credit.
- For proofs, state clearly what you are assuming and what you are proving. Name every inference rule and lemma you invoke.
- For coding problems, submit clean, commented OCaml code and include test outputs.
- You may use the OCaml standard library. For problems that say "from scratch," do **not** use any existing type-checking libraries.
- Notation follows the course [NOTATION.md](../../NOTATION.md).
- Collaboration policy: you may discuss ideas with classmates, but write up all solutions independently. Cite any sources you consult beyond the lecture notes.

---

## Part A: Theory (100 points)

### Problem A1: Typing Derivations (15 pts)

**(a)** (5 pts) Give a complete typing derivation for the polymorphic composition function:

$$\text{compose} = \Lambda X.\, \Lambda Y.\, \Lambda Z.\, \lambda g : Y \to Z.\, \lambda f : X \to Y.\, \lambda x : X.\, g\;(f\;x)$$

Show every rule application, building the derivation tree from the leaves (T-Var) to the root. Your derivation should conclude with:

$$\vdash \text{compose} : \forall X.\, \forall Y.\, \forall Z.\, (Y \to Z) \to (X \to Y) \to X \to Z$$

Label each step with the typing rule used (T-Var, T-Abs, T-App, T-TAbs, T-TApp).

**(b)** (5 pts) Give a typing derivation showing that the following term is well-typed in System F:

$$\text{selfApp} = \lambda x : (\forall X.\, X \to X).\, x\;[\forall X.\, X \to X]\; x$$

State its type. Then explain in detail (at least three sentences) why this term cannot be typed in the STLC. Your explanation should identify the specific equation on types that would arise and show it has no finite solution.

**(c)** (5 pts) Show that the Church-encoded natural number $\bar{2} = \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, s\;(s\;z)$ has type $\text{CNat} = \forall X.\, (X \to X) \to X \to X$. Then define:

$$\text{succ} = \lambda n : \text{CNat}.\, \Lambda X.\, \lambda s : X \to X.\, \lambda z : X.\, s\;(n\;[X]\; s\; z)$$

Derive the type of $\text{succ}$ (it should be $\text{CNat} \to \text{CNat}$). Show the complete evaluation of $\text{succ}\;\bar{2}$, verifying that the result is $\beta\eta$-equivalent to $\bar{3}$.

### Problem A2: Church Encodings (20 pts)

**(a)** (5 pts) Define the Church encoding of the sum type $A + B$ in System F.

- State the type: $\text{Either}\;A\;B = \forall R.\, (A \to R) \to (B \to R) \to R$.
- Define the two injection functions $\text{inl}$ and $\text{inr}$ with full type annotations.
- Define the case analysis function $\text{case}$.
- Verify by showing the full reduction sequence that:

$$\text{case}\;[A]\;[B]\;[C]\; (\text{inl}\;[A]\;[B]\; a)\; f\; g \to^* f\; a$$

**(b)** (5 pts) Define the Church encoding of $\text{Maybe}\;A = \forall R.\, R \to (A \to R) \to R$.

- Define $\text{nothing} : \forall A.\, \text{Maybe}\;A$ and $\text{just} : \forall A.\, A \to \text{Maybe}\;A$ with full type annotations.
- Define $\text{fromMaybe} : \forall A.\, A \to \text{Maybe}\;A \to A$ that extracts the value from a $\text{just}$ or returns a default for $\text{nothing}$.
- Show the complete reduction of $\text{fromMaybe}\;[A]\; d\; (\text{just}\;[A]\; v)$ to $v$.
- Show the complete reduction of $\text{fromMaybe}\;[A]\; d\; (\text{nothing}\;[A])$ to $d$.

**(c)** (5 pts) Prove that every closed normal-form term of type $\text{CBool} = \forall X.\, X \to X \to X$ is either $\text{tru} = \Lambda X.\, \lambda a : X.\, \lambda b : X.\, a$ or $\text{fls} = \Lambda X.\, \lambda a : X.\, \lambda b : X.\, b$.

Your proof should:

1. Argue that a closed normal form of type $\forall X.\, X \to X \to X$ must have the shape $\Lambda X.\, \lambda a : X.\, \lambda b : X.\, u$ where $u : X$.
2. Show that $u$ can only be $a$ or $b$ by analyzing what terms of type $X$ are available in the context $X, a : X, b : X$.
3. Explain why $u$ cannot be an application (since there are no functions of type $\cdots \to X$ available in the context, other than combinations that would not be in normal form).

**(d)** (5 pts) Encode the type $\text{List}\;A$ in System F as:

$$\text{List}\;A = \forall R.\, R \to (A \to R \to R) \to R$$

Define the following with full type annotations:

- $\text{nil} : \forall A.\, \text{List}\;A$
- $\text{cons} : \forall A.\, A \to \text{List}\;A \to \text{List}\;A$
- $\text{append} : \forall A.\, \text{List}\;A \to \text{List}\;A \to \text{List}\;A$
- $\text{length} : \forall A.\, \text{List}\;A \to \text{CNat}$

For $\text{append}$, show the reduction of $\text{append}\;[A]\; (\text{cons}\;[A]\; a_1\; (\text{nil}\;[A]))\; (\text{cons}\;[A]\; a_2\; (\text{nil}\;[A]))$ to verify it produces the list $[a_1, a_2]$.

### Problem A3: Existential Types and Data Abstraction (20 pts)

**(a)** (5 pts) Consider the existential type for a set abstract data type:

$$\text{SetADT}(A) = \exists X.\, \{empty : X,\; insert : A \to X \to X,\; member : A \to X \to \text{Bool}\}$$

(We use record notation as syntactic sugar; you may encode records as nested pairs if you prefer.)

Give two distinct implementations of $\text{SetADT}(\text{Nat})$:

1. **List-based representation** ($X = \text{List}\;\text{Nat}$): $empty$ is the empty list, $insert$ prepends, $member$ scans linearly.
2. **Characteristic function representation** ($X = \text{Nat} \to \text{Bool}$): $empty$ is the constant-false function, $insert\;n\;f$ returns a function that is true at $n$ and delegates to $f$ otherwise, $member\;n\;f = f\;n$.

For each, write the complete pack expression $\{*\text{Rep}, \text{ops}\}$ as $\text{SetADT}(\text{Nat})$.

**(b)** (5 pts) Write a client function:

$$\text{testSet} = \lambda s : \text{SetADT}(\text{Nat}).\, \text{let } \{X, c\} = s \text{ in } c.member\; 3\; (c.insert\; 5\; (c.insert\; 3\; c.empty))$$

Show the complete typing derivation for the body of the unpack (the part inside "let $\{X, c\} = \ldots$ in $\ldots$"). Verify:

1. The context inside the unpack is $X, c : \{empty : X, insert : \text{Nat} \to X \to X, member : \text{Nat} \to X \to \text{Bool}\}$.
2. The result type is $\text{Bool}$.
3. The condition $X \notin \text{FTV}(\text{Bool})$ is satisfied.

Then evaluate $\text{testSet}$ applied to each of your two implementations from part (a). Both should return $\text{true}$.

**(c)** (5 pts) Prove that the encoding of existential types via universal types correctly simulates pack and unpack:

$$\exists X.\, T \;\triangleq\; \forall Y.\, (\forall X.\, T \to Y) \to Y$$

Specifically, translate:

$$\text{let } \{X, x\} = (\{*S, v\} \text{ as } \exists X.\, T) \text{ in } t_2$$

into pure System F using the encoding, and show the complete reduction sequence. The result should be $[X \mapsto S]\,[x \mapsto v]\,t_2$, matching the E-UnpackPack rule.

**(d)** (5 pts) State and prove the following:

**Canonical Forms Lemma for Existentials.** If $\vdash v : \exists X.\, T$ and $v$ is a value, then $v = \{*S, v'\} \text{ as } \exists X.\, T$ for some type $S$ and value $v'$ with $\vdash v' : [X \mapsto S]\,T$.

Your proof should consider all possible value forms in System F extended with existentials and show that only packages can have existential types. Then use this lemma to prove the progress case for T-Unpack.

### Problem A4: Parametricity and Free Theorems (25 pts)

**(a)** (7 pts) Using the relational parametricity framework (Lecture 06d), prove that the only closed inhabitant of $\forall X.\, X \to X$ is the identity function $\Lambda X.\, \lambda x : X.\, x$.

Your proof should follow these steps precisely:

1. Let $f : \forall X.\, X \to X$ be a closed term. State the parametricity condition: for all types $A_1, A_2$ and relation $R \subseteq A_1 \times A_2$, for all $(a_1, a_2) \in R$, $(f\;[A_1]\; a_1, f\;[A_2]\; a_2) \in R$.
2. Fix an arbitrary type $A$ and value $a : A$. Choose $A_1 = A_2 = A$ and $R = \{(a, a)\}$.
3. Observe $(a, a) \in R$, hence $(f\;[A]\; a, f\;[A]\; a) \in R = \{(a, a)\}$.
4. Conclude $f\;[A]\; a = a$ for all $A$ and $a$.

**(b)** (6 pts) Derive the free theorem for the type:

$$\forall X.\, (X \to \text{Bool}) \to [X] \to [X]$$

This is the type of a "filter-like" function. The free theorem should relate $f\;[A]$ and $f\;[B]$ for any $g : A \to B$. State the theorem as a commutation equation. Then explain intuitively: why does parametricity allow the function to "drop" elements from the list (based on the predicate) but not "create" or "modify" elements?

**(c)** (6 pts) Prove that there is no closed term of type $\forall X.\, X$ in System F. Give two distinct proofs:

1. **Syntactic proof.** Analyze the structure of a hypothetical closed normal form of type $\forall X.\, X$. It must begin $\Lambda X.\, u$ where $u : X$. Show that no closed term $u$ of type $X$ can be constructed in the context $X$ (no term variables are available, and there are no constructors for an abstract type $X$).

2. **Semantic proof via parametricity.** Suppose $f : \forall X.\, X$ is closed. By parametricity, for all $A_1, A_2, R \subseteq A_1 \times A_2$: $(f\;[A_1], f\;[A_2]) \in R$. Choose $R = \emptyset$ (the empty relation). Then $(f\;[A_1], f\;[A_2]) \in \emptyset$, which is a contradiction. Conclude no such $f$ exists.

**(d)** (6 pts) Derive the free theorem for $\forall X.\, X \to X \to X$ and use it to prove that any closed term of this type is either $\Lambda X.\, \lambda a : X.\, \lambda b : X.\, a$ (first projection) or $\Lambda X.\, \lambda a : X.\, \lambda b : X.\, b$ (second projection).

*Hint:* Use the parametricity condition with $A_1 = A_2 = \{0, 1\}$ and the identity relation to determine the value of $f\;[\{0,1\}]\; 0\; 1$. Then use graph relations to show that the behavior at $\{0, 1\}$ determines the behavior at all types.

### Problem A5: Strong Normalization (20 pts)

**(a)** (5 pts) Explain why naive structural induction on the typing derivation fails for proving strong normalization of System F.

- State what measure you would try to use (e.g., size of types, depth of the derivation tree).
- Give a concrete example of a System F term $t$ and a reduction step $t \to t'$ where the proposed measure strictly increases. Include the types of relevant subterms before and after the reduction.
- Explain in at least three sentences why this failure is fundamental (not just a matter of choosing a better measure) and is related to impredicativity.

**(b)** (5 pts) State the three conditions (CR1, CR2, CR3) that define a reducibility candidate. Then prove:

**Proposition.** The set $\text{SN}$ of all strongly normalizing terms is a reducibility candidate.

Your proof should verify each of the three conditions explicitly. For CR3, argue carefully: if $t$ is neutral and every one-step reduct of $t$ is in $\text{SN}$, then every reduction sequence from $t$ has the form $t \to t_1 \to \cdots$ where each $t_i \in \text{SN}$, and therefore the sequence is finite.

**(c)** (5 pts) Recall the reducibility interpretation of arrow types:

$$\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho = \{ t \mid \forall s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho.\; t\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho \}$$

Prove that $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$ satisfies CR1 (every element is strongly normalizing), assuming by the induction hypothesis that $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$ and $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ are both reducibility candidates.

*Hint:* Use the fact that variables are in every RC (Proposition 4.4 of Lecture 06b). Choose a fresh variable $x \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$, apply $t$ to it, use CR1 for $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ to conclude $t\; x \in \text{SN}$, and then argue $t \in \text{SN}$.

**(d)** (5 pts) Prove the T-App case of the fundamental theorem (Theorem 4.9 of Lecture 06b):

**Claim.** If $\sigma(t_1) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$ and $\sigma(t_2) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$, then $\sigma(t_1)\; \sigma(t_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

State clearly which definition is being used and why the conclusion follows directly (in one or two lines). Then prove the T-Abs case of the fundamental theorem:

**Claim.** If for all $s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$, $\sigma[x \mapsto s](t_1) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$, then $\sigma(\lambda x : T_1.\, t_1) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$.

This case requires using CR2 (head expansion). Explain where CR2 is used and why it is needed.

---

## Part B: Implementation (100 points)

### Problem B1: System F Type Checker (40 pts)

Implement a type checker for System F in OCaml. Your implementation must handle:

**(a)** (10 pts) **Core System F.** Define the AST for types and terms:

```ocaml
type ty = TVar of string | TArrow of ty * ty
        | TForall of string * ty | TNat | TBool

type term = Var of string | Abs of string * ty * term
          | App of term * term | TAbs of string * term
          | TApp of term * ty | IntLit of int | BoolLit of bool
          | Succ of term | IsZero of term
          | If of term * term * term
```

Implement the function `typeof : context -> term -> ty` that type-checks a fully annotated System F term and returns its type (or raises an exception for ill-typed terms). Handle all five typing rules: T-Var, T-Abs, T-App, T-TAbs, T-TApp.

**(b)** (10 pts) **Capture-avoiding type substitution.** Implement:

```ocaml
val type_subst : string -> ty -> ty -> ty
(* type_subst x s t computes [X |-> S] T *)
```

Include correct handling of variable capture: if substituting $S$ for $X$ in $\forall Y.\, T$ would capture a free variable of $S$, alpha-rename $Y$ first. Provide at least three test cases that demonstrate capture avoidance:

1. A case where no renaming is needed.
2. A case where renaming is needed (the bound variable appears free in the substitute).
3. A case with nested quantifiers requiring multiple renamings.

**(c)** (10 pts) **Existential types.** Extend the AST and type checker with:

```ocaml
type ty = ... | TExists of string * ty
type term = ... | Pack of ty * term * ty
               | Unpack of string * string * term * term
```

Implement T-Pack and T-Unpack. Your T-Unpack implementation must check that the result type does not mention the abstract type variable (the "escape" check). Provide test cases showing:

1. A well-typed pack and unpack (counter ADT or similar).
2. A program rejected because the abstract type escapes.
3. A program rejected because the packed term has the wrong type.

**(d)** (10 pts) **Comprehensive test suite.** Provide tests for:

- Polymorphic identity: $\Lambda X.\, \lambda x : X.\, x$ has type $\forall X.\, X \to X$.
- Polymorphic identity instantiated: $(\Lambda X.\, \lambda x : X.\, x)\;[\text{Nat}]\; 42$ evaluates to $42$.
- Self-application: $\lambda x : (\forall X.\, X \to X).\, x\;[\forall X.\, X \to X]\; x$ is well-typed.
- Church booleans: $\text{tru}$ and $\text{fls}$ both have type $\text{CBool}$.
- Church numerals: $\bar{0}$ and $\bar{2}$ have type $\text{CNat}$.
- At least one existential type example.
- At least three negative tests (terms that should be rejected), each testing a different kind of type error:
  - Application of a non-function.
  - Type application of a non-polymorphic term.
  - Existential type variable escaping its scope.

### Problem B2: System F Interpreter (30 pts)

Extend the type checker from B1 with an evaluator.

**(a)** (10 pts) **Call-by-value evaluation.** Implement:

```ocaml
val eval : env -> term -> value
```

Support all evaluation rules, including E-TAppTAbs (type-level beta reduction). You may use either substitution-based or environment-based (closure) evaluation. If using closures, explain how type abstraction values are represented and how type application is handled at runtime (type erasure).

**(b)** (10 pts) **Type erasure.** Implement:

```ocaml
val erase : term -> uterm
```

where `uterm` is the AST for the untyped lambda calculus:

```ocaml
type uterm = UVar of string | UAbs of string * uterm
           | UApp of uterm * uterm | UIntLit of int
           | UBoolLit of bool | ...
```

Type abstractions $\Lambda X.\, t$ erase to $\text{erase}(t)$, and type applications $t\;[T]$ erase to $\text{erase}(t)$. Type annotations on lambda binders are dropped.

Implement an evaluator for `uterm` and verify on at least three examples that `eval_untyped (erase t)` produces the same observable result as `eval_typed t` (for terms that produce integers or booleans).

**(c)** (10 pts) **Church encoding evaluation.** Define the following System F terms in your AST and evaluate them:

1. $\text{plus}\;\bar{2}\;\bar{3}$: Church numeral addition. Show the evaluation trace (sequence of reduction steps) and verify the result is $\bar{5}$. To observe the result, apply it to $\text{succ}$ and $0$: $(\text{plus}\;\bar{2}\;\bar{3})\;[\text{Nat}]\;\text{succ}\;0 = 5$.

2. $\text{not}\;\text{tru}$: Church boolean negation. Verify the result behaves as $\text{fls}$ by applying it: $(\text{not}\;\text{tru})\;[\text{Nat}]\;1\;0 = 0$.

3. $\text{fst}\;[\text{Nat}]\;[\text{Bool}]\;(\text{Pair}\;[\text{Nat}]\;[\text{Bool}]\;42\;\text{true})$: Pair projection. Verify the result is $42$.

For each, show the OCaml code constructing the term and the output of evaluation.

### Problem B3: Parametricity Tester (30 pts)

**(a)** (15 pts) **Free theorem generator.** Write a function:

```ocaml
val free_theorem : ty -> string
```

that takes a closed System F type (of the form $\forall X_1 \cdots X_n.\, T$) and produces a human-readable statement of the corresponding free theorem.

Your function should handle at least the following cases:

- $\forall X.\, X \to X$: output should state that $f$ is the identity (e.g., `"For all A, a: f [A] a = a"`).
- $\forall X.\, X \to X \to X$: output should state that $f$ is a projection.
- $\forall X.\, [X] \to [X]$: output should state commutation with map (e.g., `"For all g: A -> B: map g . f [A] = f [B] . map g"`).
- $\forall X\,Y.\, (X \to Y) \to [X] \to [Y]$: output should state preservation of composition.

You may use a simplified, template-based approach. Include the algorithm description (how you analyze the type structure to determine which template to use) and test output for each case.

**(b)** (15 pts) **Representation independence checker.** Implement a function that verifies representation independence for existential types:

```ocaml
val check_bisimulation :
  value ->  (* implementation 1: existential package *)
  value ->  (* implementation 2: existential package *)
  (value * value) list ->  (* relation R as list of pairs *)
  bool
```

The function should check that the relation $R$ is a **bisimulation** between the two implementations. Specifically, for a counter ADT with operations $\{new, inc, get\}$:

1. $(v_1.new, v_2.new) \in R$ (the initial states are related).
2. If $(s_1, s_2) \in R$, then $(v_1.inc\;s_1, v_2.inc\;s_2) \in R$ (incrementing preserves the relation).
3. If $(s_1, s_2) \in R$, then $v_1.get\;s_1 = v_2.get\;s_2$ (related states have the same observable behavior).

Implement two counter ADTs:

- Counter 1: $X = \text{Nat}$, $new = 0$, $inc = \text{succ}$, $get = \text{id}$.
- Counter 2: $X = \text{Nat} \times \text{Nat}$, $new = (0, 0)$, $inc\;(a, b) = (a + 1, b)$, $get\;(a, b) = a$.

Define the bisimulation relation $R = \{(n, (n, 0)) \mid n \in \{0, 1, 2, 3, 4\}\}$ and verify that `check_bisimulation` returns `true`.

---

## Submission Checklist

- [ ] Part A written solutions (PDF or Markdown):
  - [ ] A1: three typing derivations with all rules labeled.
  - [ ] A2: four Church encoding problems with definitions, type annotations, and reductions.
  - [ ] A3: two ADT implementations, client code, encoding proof, canonical forms lemma.
  - [ ] A4: four parametricity proofs with relational interpretation.
  - [ ] A5: failure of structural induction, SN is an RC, arrow-type CR1, fundamental theorem cases.
- [ ] Part B source code (OCaml):
  - [ ] B1: `type_checker.ml` with System F + existentials, capture-avoiding substitution, and test suite.
  - [ ] B2: `evaluator.ml` with call-by-value evaluation, type erasure function, and Church encoding tests.
  - [ ] B3: `parametricity.ml` with free theorem generator and bisimulation checker.
- [ ] All test outputs included (copy-pasted from terminal or as separate files).
- [ ] Code compiles with `ocamlfind ocamlopt` (or `dune build`) without errors or warnings.
