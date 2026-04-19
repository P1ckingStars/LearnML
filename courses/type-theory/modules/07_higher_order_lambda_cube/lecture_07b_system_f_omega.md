---
title: "Lecture 07b: System F-omega"
tags:
  - type-theory
  - lambda-cube
  - lecture
---
# Lecture 07b: System F-omega

> **Module 07 --- Higher-Order Types & the Lambda Cube (Weeks 13--14)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define System $F_\omega$ as the combination of System F (parametric polymorphism) with type operators and kinds.
2. State the complete syntax, kinding rules, and typing rules of System $F_\omega$.
3. Explain how type-level abstraction and application interact with term-level type abstraction and application.
4. Formalize type equivalence in $F_\omega$ and explain why it requires normalization.
5. Prove that type-level computation in $F_\omega$ is strongly normalizing.
6. Encode a variety of type constructors (pairs, sums, existentials, Church-encoded data) as type-level functions in $F_\omega$.
7. Connect System $F_\omega$ to ML module systems, explaining functors as type-level functions.
8. Locate $F_\omega$ within the lambda cube as the system with both "terms depending on types" and "types depending on types."

---

## 1. Motivation

### 1.1 From System F to System $F_\omega$

System F (Module 06) gave us *parametric polymorphism*: the ability to write functions that abstract over types. Lecture 07a introduced *type operators*: functions at the type level that transform types into types. System $F_\omega$ is the natural combination of these two features.

**System F:**
- Terms can depend on terms (ordinary functions).
- Terms can depend on types (polymorphism: $\Lambda X.\; e$).
- Types cannot depend on other types in any computational way.

**System $F_\omega$:**
- Terms can depend on terms (ordinary functions).
- Terms can depend on types (polymorphism: $\Lambda X :: K.\; e$).
- Types can depend on types (type operators: $\lambda X :: K.\; T$).

The "omega" in $F_\omega$ refers to the fact that the type-level language is itself a (simply-typed) lambda calculus, and the hierarchy of kinds mirrors the structure of simple types.

### 1.2 Why System $F_\omega$ Matters

System $F_\omega$ is the most expressive system in the lambda cube that does not involve dependent types. It serves as:

1. **A foundation for ML modules.** The key insight of Harper, Mitchell, and Moggi (1990) is that ML functors are essentially type-level functions --- exactly what $F_\omega$ provides.

2. **An intermediate language for compilers.** GHC's core language, System FC, is an extension of $F_\omega$ with type equality coercions.

3. **A theoretical benchmark.** Many properties (decidability of type checking, strong normalization, parametricity) that hold for System F extend to $F_\omega$ with suitable modifications.

4. **The gateway to dependent types.** Understanding $F_\omega$ is prerequisite to understanding the Calculus of Constructions, which adds one more axis: types depending on terms.

---

## 2. Core Theory

### 2.1 Syntax

**Definition 2.1 (Kinds).**

$$
K ::= * \mid K_1 \Rightarrow K_2
$$

**Definition 2.2 (Type Expressions).**

$$
T ::= X \mid T_1 \to T_2 \mid \forall X :: K.\; T \mid \lambda X :: K.\; T \mid T_1\; T_2
$$

**Definition 2.3 (Terms).**

$$
e ::= x \mid \lambda x : T.\; e \mid e_1\; e_2 \mid \Lambda X :: K.\; e \mid e\;[T]
$$

where:

- $\lambda x : T.\; e$ is term-level abstraction.
- $e_1\; e_2$ is term-level application.
- $\Lambda X :: K.\; e$ is type abstraction (introducing a type variable of specified kind).
- $e\;[T]$ is type application (instantiating a polymorphic term with a type).

**Definition 2.4 (Values).**

$$
v ::= \lambda x : T.\; e \mid \Lambda X :: K.\; e
$$

Both term-level and type-level abstractions are values.

**Definition 2.5 (Contexts).**

- Kinding context: $\Delta ::= \emptyset \mid \Delta, X :: K$
- Typing context: $\Gamma ::= \emptyset \mid \Gamma, x : T$

### 2.2 Kinding Rules

The kinding rules are exactly those from Lecture 07a:

$$
\frac{X :: K \in \Delta}{\Delta \vdash X :: K} \quad (\text{K-Var})
$$

$$
\frac{\Delta \vdash T_1 :: * \qquad \Delta \vdash T_2 :: *}{\Delta \vdash T_1 \to T_2 :: *} \quad (\text{K-Arrow})
$$

$$
\frac{\Delta, X :: K_1 \vdash T :: *}{\Delta \vdash (\forall X :: K_1.\; T) :: *} \quad (\text{K-All})
$$

$$
\frac{\Delta, X :: K_1 \vdash T :: K_2}{\Delta \vdash (\lambda X :: K_1.\; T) :: K_1 \Rightarrow K_2} \quad (\text{K-Abs})
$$

$$
\frac{\Delta \vdash T_1 :: K_1 \Rightarrow K_2 \qquad \Delta \vdash T_2 :: K_1}{\Delta \vdash T_1\; T_2 :: K_2} \quad (\text{K-App})
$$

### 2.3 Type Equivalence

**Definition 2.6 (Type Equivalence).** The relation $\Delta \vdash T_1 \equiv T_2 :: K$ holds when $T_1$ and $T_2$ reduce to the same beta-normal form under the kinding context $\Delta$.

The key rules:

$$
\frac{\Delta \vdash T :: K}{\Delta \vdash T \equiv T :: K} \quad (\text{Q-Refl})
$$

$$
\frac{\Delta \vdash T_1 \equiv T_2 :: K}{\Delta \vdash T_2 \equiv T_1 :: K} \quad (\text{Q-Symm})
$$

$$
\frac{\Delta \vdash T_1 \equiv T_2 :: K \qquad \Delta \vdash T_2 \equiv T_3 :: K}{\Delta \vdash T_1 \equiv T_3 :: K} \quad (\text{Q-Trans})
$$

$$
\frac{\Delta \vdash T_1 :: K_1 \Rightarrow K_2 \qquad \Delta \vdash T_2 :: K_1}{\Delta \vdash (\lambda X :: K_1.\; S)\; T_2 \equiv [X \mapsto T_2]S :: K_2} \quad (\text{Q-Beta})
$$

$$
\frac{\Delta \vdash T :: K_1 \Rightarrow K_2 \qquad X \notin \text{FV}(T)}{\Delta \vdash (\lambda X :: K_1.\; T\; X) \equiv T :: K_1 \Rightarrow K_2} \quad (\text{Q-Eta})
$$

Plus congruence rules for all type constructors (arrow, forall, abstraction, application).

### 2.4 Typing Rules

$$
\frac{x : T \in \Gamma}{\Delta; \Gamma \vdash x : T} \quad (\text{T-Var})
$$

$$
\frac{\Delta \vdash T_1 :: * \qquad \Delta; \Gamma, x : T_1 \vdash e : T_2}{\Delta; \Gamma \vdash (\lambda x : T_1.\; e) : T_1 \to T_2} \quad (\text{T-Abs})
$$

$$
\frac{\Delta; \Gamma \vdash e_1 : T_1 \to T_2 \qquad \Delta; \Gamma \vdash e_2 : T_1}{\Delta; \Gamma \vdash e_1\; e_2 : T_2} \quad (\text{T-App})
$$

$$
\frac{\Delta, X :: K; \Gamma \vdash e : T}{\Delta; \Gamma \vdash (\Lambda X :: K.\; e) : \forall X :: K.\; T} \quad (\text{T-TAbs})
$$

$$
\frac{\Delta; \Gamma \vdash e : \forall X :: K.\; T \qquad \Delta \vdash S :: K}{\Delta; \Gamma \vdash e\;[S] : [X \mapsto S]T} \quad (\text{T-TApp})
$$

$$
\frac{\Delta; \Gamma \vdash e : T_1 \qquad \Delta \vdash T_1 \equiv T_2 :: *}{\Delta; \Gamma \vdash e : T_2} \quad (\text{T-Eq})
$$

**Remark on T-Eq.** This *conversion rule* is what makes type-level computation relevant to type checking. When the type checker encounters a term of type $(\lambda X :: *.\; X \to X)\;\text{Int}$, it can convert this to $\text{Int} \to \text{Int}$ using Q-Beta and then apply T-Eq.

### 2.5 Operational Semantics

**Definition 2.7 (Evaluation Rules).**

$$
\frac{e_1 \longrightarrow e_1'}{e_1\; e_2 \longrightarrow e_1'\; e_2} \quad (\text{E-App1})
$$

$$
\frac{e_2 \longrightarrow e_2'}{v\; e_2 \longrightarrow v\; e_2'} \quad (\text{E-App2})
$$

$$
(\lambda x : T.\; e)\; v \longrightarrow [x \mapsto v]e \quad (\text{E-Beta})
$$

$$
\frac{e \longrightarrow e'}{e\;[T] \longrightarrow e'\;[T]} \quad (\text{E-TApp})
$$

$$
(\Lambda X :: K.\; e)\;[T] \longrightarrow [X \mapsto T]e \quad (\text{E-TBeta})
$$

Note that type-level reduction (beta-reduction of type operators) happens during type checking, not at runtime. The runtime operational semantics only performs term-level reductions. The rule E-TBeta substitutes the type into the term body.

---

## 3. Metatheory

### 3.1 Strong Normalization at the Type Level

**Theorem 3.1 (Strong Normalization of Type-Level Reduction).** Every well-kinded type expression in $F_\omega$ has a unique beta-normal form, and every beta-reduction sequence at the type level terminates.

*Proof.* The type-level language of $F_\omega$ (type expressions with kinding) is isomorphic to the simply-typed lambda calculus (with kinds playing the role of types). Specifically:

- Kind $*$ corresponds to a base type.
- Kind $K_1 \Rightarrow K_2$ corresponds to a function type.
- Type-level lambda $\lambda X :: K.\; T$ corresponds to a simply-typed lambda.
- Type-level application $T_1\; T_2$ corresponds to application.
- Kinding judgment $\Delta \vdash T :: K$ corresponds to a typing judgment.

Strong normalization of the simply-typed lambda calculus (established by Tait's method of reducibility candidates, or by a logical relations argument) therefore implies strong normalization at the type level. $\square$

**Corollary 3.2.** Type checking in $F_\omega$ is decidable.

*Proof.* Type checking involves:
1. Kinding: decidable by syntax-directed rules (Theorem 2.11 of Lecture 07a).
2. Type equivalence: decidable by normalizing both sides and comparing normal forms (possible because normalization always terminates).
3. Typing: the rules are syntax-directed once we fix the strategy for applying T-Eq (namely, always normalize types before comparison). $\square$

### 3.2 Strong Normalization at the Term Level

**Theorem 3.3 (Strong Normalization of $F_\omega$).** Every well-typed closed term in $F_\omega$ (without fix or general recursion) evaluates to a value in a finite number of steps.

*Proof sketch.* The proof extends Girard's reducibility candidates technique from System F. The key complication is that types now contain computation (type-level beta-redexes), so the logical relation must be defined by induction on *kinds* (for type operators) as well as on types. Specifically:

1. Define a family of reducibility candidates $\mathcal{R}_{K}$ for each kind $K$:
   - $\mathcal{R}_* = \{\text{sets of strongly normalizing terms}\}$ (the usual)
   - $\mathcal{R}_{K_1 \Rightarrow K_2} = \{\text{functions from } \mathcal{R}_{K_1} \text{ to } \mathcal{R}_{K_2}\}$

2. Interpret each well-kinded type expression $T :: K$ as an element of $\mathcal{R}_K$:
   - Type variables $X :: K$ are interpreted by the variable assignment.
   - $\lambda X :: K.\; T$ is interpreted as a function in $\mathcal{R}_{K_1 \Rightarrow K_2}$.
   - Application $T_1\; T_2$ is interpreted by function application in the semantic domain.

3. The fundamental lemma states: if $\Delta; \Gamma \vdash e : T$, then $e$ belongs to the reducibility candidate interpreting $T$.

4. Since all reducibility candidates consist of strongly normalizing terms, the result follows.

The full proof is given in Girard, Lafont, and Taylor (1989). $\square$

### 3.3 Type Safety

**Theorem 3.4 (Preservation).** If $\Delta; \Gamma \vdash e : T$ and $e \longrightarrow e'$, then $\Delta; \Gamma \vdash e' : T$.

*Proof.* By induction on the derivation $\Delta; \Gamma \vdash e : T$, with a case analysis on the reduction step $e \longrightarrow e'$.

**Case E-Beta:** $e = (\lambda x : T_1.\; e_0)\; v$ and $e' = [x \mapsto v]e_0$.

By inversion on the typing:
- $\Delta; \Gamma \vdash (\lambda x : T_1.\; e_0) : T_1 \to T_2$, which by T-Abs gives $\Delta; \Gamma, x : T_1 \vdash e_0 : T_2$.
- $\Delta; \Gamma \vdash v : T_1$.

By the Substitution Lemma: $\Delta; \Gamma \vdash [x \mapsto v]e_0 : T_2$.

**Case E-TBeta:** $e = (\Lambda X :: K.\; e_0)\;[S]$ and $e' = [X \mapsto S]e_0$.

By inversion:
- $\Delta; \Gamma \vdash (\Lambda X :: K.\; e_0) : \forall X :: K.\; T_0$, which by T-TAbs gives $\Delta, X :: K; \Gamma \vdash e_0 : T_0$.
- $\Delta \vdash S :: K$.

By the Type Substitution Lemma (substituting $S$ for $X$ in both terms and types): $\Delta; \Gamma \vdash [X \mapsto S]e_0 : [X \mapsto S]T_0$.

The remaining cases (congruence rules) follow by straightforward induction. $\square$

**Theorem 3.5 (Progress).** If $\emptyset; \emptyset \vdash e : T$, then either $e$ is a value or there exists $e'$ such that $e \longrightarrow e'$.

*Proof.* By induction on the derivation. The key cases are:

- $e = e_1\; e_2$: By induction, $e_1$ is either a value or can step. If it is a value, the canonical forms lemma ensures it is of the form $\lambda x : T'.\; e'$ (since its type is a function type), so E-Beta applies.

- $e = e_0\;[S]$: By induction, $e_0$ is either a value or can step. If it is a value, canonical forms ensures it is $\Lambda X :: K.\; e'$, so E-TBeta applies. $\square$

### 3.4 The Type Substitution Lemma

**Lemma 3.6 (Type Substitution).** If $\Delta, X :: K; \Gamma \vdash e : T$ and $\Delta \vdash S :: K$, then $\Delta; [X \mapsto S]\Gamma \vdash [X \mapsto S]e : [X \mapsto S]T$.

*Proof.* By induction on the derivation. The substitution $[X \mapsto S]$ operates simultaneously on terms (replacing type annotations) and types (replacing type variables). Kinding substitution (Lemma 2.13 of Lecture 07a) is used for the type-level components. $\square$

---

## 4. Expressiveness of System $F_\omega$

### 4.1 Encoding Data Types

System $F_\omega$ can encode a remarkable variety of type constructors using type-level functions and polymorphism.

**Encoding 4.1 (Pairs).** Define the type operator:

$$
\text{Pair} = \lambda A :: *.\; \lambda B :: *.\; \forall R :: *.\; (A \to B \to R) \to R
$$

with constructors:

$$
\text{pair} = \Lambda A :: *.\; \Lambda B :: *.\; \lambda a : A.\; \lambda b : B.\; \Lambda R :: *.\; \lambda f : A \to B \to R.\; f\; a\; b
$$

$$
\text{fst} = \Lambda A :: *.\; \Lambda B :: *.\; \lambda p : \text{Pair}\;A\;B.\; p\;[A]\;(\lambda a : A.\; \lambda b : B.\; a)
$$

$$
\text{snd} = \Lambda A :: *.\; \Lambda B :: *.\; \lambda p : \text{Pair}\;A\;B.\; p\;[B]\;(\lambda a : A.\; \lambda b : B.\; b)
$$

**Verification.** $\text{fst}\;[A]\;[B]\;(\text{pair}\;[A]\;[B]\;a_0\;b_0)$ reduces to $a_0$:

$$
\text{fst}\;[A]\;[B]\;(\text{pair}\;[A]\;[B]\;a_0\;b_0)
$$

$$
= (\Lambda R :: *.\; \lambda f : A \to B \to R.\; f\; a_0\; b_0)\;[A]\;(\lambda a : A.\; \lambda b : B.\; a)
$$

$$
\longrightarrow (\lambda f : A \to B \to A.\; f\; a_0\; b_0)\;(\lambda a : A.\; \lambda b : B.\; a)
$$

$$
\longrightarrow (\lambda a : A.\; \lambda b : B.\; a)\; a_0\; b_0
$$

$$
\longrightarrow (\lambda b : B.\; a_0)\; b_0
$$

$$
\longrightarrow a_0 \qquad \checkmark
$$

**Encoding 4.2 (Sums / Coproducts).** Define:

$$
\text{Sum} = \lambda A :: *.\; \lambda B :: *.\; \forall R :: *.\; (A \to R) \to (B \to R) \to R
$$

with injections:

$$
\text{inl} = \Lambda A :: *.\; \Lambda B :: *.\; \lambda a : A.\; \Lambda R :: *.\; \lambda f : A \to R.\; \lambda g : B \to R.\; f\; a
$$

$$
\text{inr} = \Lambda A :: *.\; \Lambda B :: *.\; \lambda b : B.\; \Lambda R :: *.\; \lambda f : A \to R.\; \lambda g : B \to R.\; g\; b
$$

**Encoding 4.3 (Church Naturals at Higher Kind).** The Church numeral type at the type level:

$$
\text{Nat} = \forall X :: *.\; (X \to X) \to X \to X
$$

But we can also define a *type-level natural number* as a higher-kinded type operator:

$$
\text{Zero} = \lambda F :: (* \Rightarrow *).\; \lambda X :: *.\; X
$$

$$
\text{Succ} = \lambda N :: ((* \Rightarrow *) \Rightarrow * \Rightarrow *).\; \lambda F :: (* \Rightarrow *).\; \lambda X :: *.\; F\;(N\;F\;X)
$$

Then $\text{Succ}\;\text{Zero}$ reduces to $\lambda F :: (* \Rightarrow *).\; \lambda X :: *.\; F\;X$, which applies $F$ once. $\text{Succ}\;(\text{Succ}\;\text{Zero})$ applies $F$ twice: $\lambda F.\; \lambda X.\; F\;(F\;X)$.

This gives us *type-level computation* that mirrors the structure of Church numerals but operates entirely in the kind system.

**Encoding 4.3b (Unit and Void).**

Unit type (exactly one value):

$$
\text{Unit} = \forall R :: *.\; R \to R
$$

$$
\text{unit} = \Lambda R :: *.\; \lambda r : R.\; r \quad : \quad \text{Unit}
$$

Void type (no values):

$$
\text{Void} = \forall R :: *.\; R
$$

There is no closed term of type $\text{Void}$ (this follows from parametricity or from the Curry--Howard correspondence: $\text{Void}$ corresponds to falsity). However, given a term of type $\text{Void}$, we can produce a term of any type:

$$
\text{absurd} = \Lambda R :: *.\; \lambda x : \text{Void}.\; x\;[R] \quad : \quad \forall R :: *.\; \text{Void} \to R
$$

**Encoding 4.4 (Booleans).**

$$
\text{Bool} = \forall R :: *.\; R \to R \to R
$$

$$
\text{true} = \Lambda R :: *.\; \lambda t : R.\; \lambda f : R.\; t
$$

$$
\text{false} = \Lambda R :: *.\; \lambda t : R.\; \lambda f : R.\; f
$$

$$
\text{if} = \Lambda R :: *.\; \lambda b : \text{Bool}.\; \lambda t : R.\; \lambda f : R.\; b\;[R]\;t\;f
$$

**Verification.** $\text{if}\;[A]\;\text{true}\;v_1\;v_2 \longrightarrow^* v_1$:

$$
\text{if}\;[A]\;\text{true}\;v_1\;v_2 = (\Lambda R.\; \lambda b.\; \lambda t.\; \lambda f.\; b\;[R]\;t\;f)\;[A]\;\text{true}\;v_1\;v_2
$$

$$
\longrightarrow (\lambda b.\; \lambda t.\; \lambda f.\; b\;[A]\;t\;f)\;\text{true}\;v_1\;v_2
$$

$$
\longrightarrow (\lambda t.\; \lambda f.\; \text{true}\;[A]\;t\;f)\;v_1\;v_2
$$

$$
\longrightarrow (\lambda f.\; \text{true}\;[A]\;v_1\;f)\;v_2
$$

$$
\longrightarrow \text{true}\;[A]\;v_1\;v_2
$$

$$
= (\Lambda R.\; \lambda t.\; \lambda f.\; t)\;[A]\;v_1\;v_2
$$

$$
\longrightarrow (\lambda t.\; \lambda f.\; t)\;v_1\;v_2
$$

$$
\longrightarrow (\lambda f.\; v_1)\;v_2
$$

$$
\longrightarrow v_1 \qquad \checkmark
$$

**Encoding 4.5 (Existential Types).** Existential types $\exists X :: K.\; T$ can be encoded:

$$
\exists X :: K.\; T \;\triangleq\; \forall R :: *.\; (\forall X :: K.\; T \to R) \to R
$$

Pack and unpack:

$$
\text{pack} = \Lambda S :: K.\; \lambda v : [X \mapsto S]T.\; \Lambda R :: *.\; \lambda f : (\forall X :: K.\; T \to R).\; f\;[S]\; v
$$

$$
\text{unpack} = \Lambda R :: *.\; \lambda e : (\exists X :: K.\; T).\; \lambda f : (\forall X :: K.\; T \to R).\; e\;[R]\; f
$$

### 4.2 Encoding Recursive Type Constructors

A particularly powerful use of $F_\omega$ is encoding recursive type constructors. Consider the type of lists. Rather than adding a built-in `List` type, we can define:

$$
\text{List} = \lambda A :: *.\; \forall R :: *.\; (A \to R \to R) \to R \to R
$$

This is the Church encoding: a list of $A$'s is a function that, given a way to combine an element with an accumulator and an initial accumulator, produces a result.

Operations:

$$
\text{nil} = \Lambda A :: *.\; \Lambda R :: *.\; \lambda c : A \to R \to R.\; \lambda n : R.\; n
$$

$$
\text{cons} = \Lambda A :: *.\; \lambda h : A.\; \lambda t : \text{List}\;A.\; \Lambda R :: *.\; \lambda c : A \to R \to R.\; \lambda n : R.\; c\; h\; (t\;[R]\;c\;n)
$$

$$
\text{foldr} = \Lambda A :: *.\; \Lambda R :: *.\; \lambda f : A \to R \to R.\; \lambda z : R.\; \lambda l : \text{List}\;A.\; l\;[R]\;f\;z
$$

**Remark.** The Church encoding is limited: some operations (e.g., `tail`, `zip`) are awkward or require extra machinery. Scott encodings and Parigot encodings provide alternatives with different trade-offs, but they require recursive types for full generality.

### 4.3 Higher-Order Abstract Syntax

Type operators in $F_\omega$ can represent *higher-order abstract syntax* (HOAS), where binding in the object language is represented by binding in the meta-language:

$$
\text{Exp} = \lambda R :: *.\; R
$$

Suppose we have type operators for expression constructors:

$$
\text{Lam} :: (* \Rightarrow *) \Rightarrow * \qquad \text{App} :: * \Rightarrow * \Rightarrow *
$$

A lambda expression $\lambda x.\; e$ is represented as $\text{Lam}\;(\lambda X :: *.\; \ldots)$, where the body is a type-level function.

This technique is widely used in logical frameworks (Lecture 07d) and proof assistants.

---

## 5. Connection to ML Module Systems

### 5.1 Functors as Type-Level Functions

The ML module system (in Standard ML and OCaml) provides *functors*: parameterized modules that take modules as arguments and produce modules as results.

Consider the OCaml signature and functor:

```ocaml
module type ORDERED = sig
  type t
  val compare : t -> t -> int
end

module type SET = sig
  type elt
  type t
  val empty : t
  val insert : elt -> t -> t
  val member : elt -> t -> bool
end

module MakeSet (Ord : ORDERED) : SET with type elt = Ord.t = struct
  type elt = Ord.t
  type t = elt list
  let empty = []
  let insert x s = x :: s
  let member x s = List.exists (fun y -> Ord.compare x y = 0) s
end
```

From the perspective of $F_\omega$:

- The signature `ORDERED` is an existential type $\exists t :: *.\; (t \to t \to \text{Int})$ (abstracting the type $t$ along with its operations).
- The functor `MakeSet` is a type-level function that maps the abstract type $\text{Ord}.t$ to the types in `SET`.

### 5.2 The Harper--Mitchell--Moggi Analysis

Harper, Mitchell, and Moggi (1990) showed that the ML module system can be understood as a fragment of $F_\omega$ with existential types and translucent signatures:

| ML concept | $F_\omega$ counterpart |
|-----------|----------------------|
| Structure | Record of values + types (existential package) |
| Signature | Existential type (with kind annotations) |
| Functor | Type-level function + term-level function |
| Functor application | Type-level application + term-level application |
| Sharing constraint | Type equality in the existential |

This analysis clarified several design questions in the ML module system and led to improvements in module systems for subsequent languages.

### 5.3 Applicative vs. Generative Functors

An important distinction:

- **Applicative functors** (OCaml's default): applying the same functor to the same argument twice produces type-compatible results. The functor is a pure function at the type level.

- **Generative functors** (Standard ML, OCaml with `()`): each application generates fresh abstract types. The functor produces a new existential witness each time.

In $F_\omega$ terms, applicative functors correspond to type-level beta-reduction (which is deterministic), while generative functors require a notion of fresh name generation that goes beyond $F_\omega$.

### 5.4 The Phase Distinction Revisited

Harper, Mitchell, and Moggi introduced the *phase distinction* to explain the relationship between $F_\omega$ and ML modules:

- **Static phase (compile time).** Type-level computation (beta-reduction of type operators) happens during type checking. This corresponds to functor application at the type level: determining what types a module provides.

- **Dynamic phase (runtime).** Term-level computation (ordinary evaluation) happens at runtime. This corresponds to executing the value-level code of modules.

The phase distinction is clean in $F_\omega$: type-level computation is entirely static, and term-level computation is entirely dynamic. No type computation depends on runtime values, and no runtime values depend on type computation (types are erased).

This contrasts with dependent types (Module 08), where the phases are entangled.

---

## 6. Full $F_\omega$: Refinements and Variants

### 6.1 Higher-Order Kinds

In "full" $F_\omega$, kinds can be arbitrarily complex:

$$
(* \Rightarrow *) \Rightarrow (* \Rightarrow *) \Rightarrow * \Rightarrow *
$$

This allows type operators to take other type operators as arguments, enabling abstractions like:

$$
\text{Compose} :: (* \Rightarrow *) \Rightarrow (* \Rightarrow *) \Rightarrow * \Rightarrow *
$$

$$
\text{Compose} = \lambda F :: (* \Rightarrow *).\; \lambda G :: (* \Rightarrow *).\; \lambda X :: *.\; F\;(G\;X)
$$

There is no restriction on the nesting depth of kinds.

### 6.2 Kind Abbreviations

For readability, one often introduces kind abbreviations:

$$
\text{Endo} \triangleq * \Rightarrow *
$$

$$
\text{HKT} \triangleq \text{Endo} \Rightarrow \text{Endo}
$$

So a natural transformation $\forall X :: *.\; F\;X \to G\;X$ can be typed as a term of type $\forall F :: \text{Endo}.\; \forall G :: \text{Endo}.\; \forall X :: *.\; F\;X \to G\;X$.

### 6.3 Adding Products and Sums at the Kind Level

One can extend the kind language with product kinds:

$$
K ::= * \mid K_1 \Rightarrow K_2 \mid K_1 \times K_2
$$

A type operator of kind $K_1 \times K_2$ is a pair of type operators. This is occasionally useful but rarely appears in practice; one can always use curried form instead.

### 6.4 Type Definitions and Let-Bindings at the Type Level

For practical programming, one often adds type-level let-bindings:

$$
T ::= \ldots \mid \text{let}\; X :: K = T_1\; \text{in}\; T_2
$$

This is syntactic sugar for $(\lambda X :: K.\; T_2)\; T_1$ and reduces by beta:

$$
\text{let}\; X = T_1\;\text{in}\; T_2 \longrightarrow [X \mapsto T_1]T_2
$$

---

## 7. Algorithmic Type Checking

### 7.1 The Challenge

The declarative typing rules (Section 2.4) include the conversion rule T-Eq, which is not syntax-directed: it can be applied at any point in a derivation. For an algorithm, we need a strategy.

### 7.2 Normalization-Based Approach

**Algorithm:** Given $\Delta; \Gamma \vdash e : T$, proceed as follows:

1. Use the syntax-directed rules (T-Var, T-Abs, T-App, T-TAbs, T-TApp) to synthesize a type $T$ for $e$.

2. Whenever a type comparison is needed (e.g., in T-App, the domain of the function type must match the argument type), normalize both types to beta-normal form and compare structurally.

3. Whenever a type is substituted (e.g., in T-TApp, $[X \mapsto S]T$), normalize the result.

**Correctness.** This algorithm is sound and complete with respect to the declarative system because:
- Strong normalization guarantees that normalization terminates.
- Confluence guarantees that the normal form is unique.
- Two types are equivalent (by Q-Beta, Q-Eta, congruence, transitivity, symmetry) if and only if they have the same normal form.

### 7.3 Complexity

The type-checking algorithm for $F_\omega$ is decidable, but the complexity depends on the kind structure. In the worst case, a type-level beta-reduction step can increase the size of the type expression (the type-level simply-typed lambda calculus does not have a polynomial bound on normalization). However, in practice, type-level computations are small.

**Theorem 7.1.** Type checking for System $F_\omega$ is decidable.

This should be contrasted with System F, where type *checking* is also decidable but type *inference* (reconstruction) is undecidable (Wells, 1999).

---

## 8. System $F_\omega$ in the Lambda Cube

### 8.1 Position in the Cube

The lambda cube (Lecture 07d) organizes type systems along three axes:

1. **Terms depending on types** (polymorphism): System F, $\lambda 2$
2. **Types depending on types** (type operators): $\lambda \underline{\omega}$
3. **Types depending on terms** (dependent types): $\lambda P$

System $F_\omega$ combines axes 1 and 2: it has both polymorphism and type operators. Its position in the cube is $\lambda \omega$ (without the underline, which denotes the type-operators-only system without polymorphism).

$$
\begin{array}{ccc}
\lambda C & --- & \lambda \omega \\
| & & | \\
\lambda P2 & --- & \lambda 2 \\
& & \\
\lambda P\underline{\omega} & --- & \lambda \underline{\omega} \\
| & & | \\
\lambda P & --- & \lambda{\to} \\
\end{array}
$$

In this diagram, $\lambda \omega = F_\omega$ sits at the top-right, combining polymorphism (right face) with type operators (top face), but not dependent types (left face). The top-left corner, $\lambda C$ (Calculus of Constructions), adds dependent types as well.

### 8.2 Relationship to Other Systems

| System | Polymorphism | Type operators | Dependent types |
|--------|:---:|:---:|:---:|
| STLC ($\lambda{\to}$) | No | No | No |
| System F ($\lambda 2$) | Yes | No | No |
| $\lambda\underline{\omega}$ | No | Yes | No |
| $F_\omega$ ($\lambda\omega$) | Yes | Yes | No |
| $\lambda P$ (LF) | No | No | Yes |
| $\lambda C$ (CoC) | Yes | Yes | Yes |

$F_\omega$ is "just one step below" the Calculus of Constructions. The missing ingredient is allowing types to depend on *terms* (dependent function types $\Pi x : A.\; B(x)$ where $B$ varies with $x$).

---

## 9. Worked Examples

### 9.1 A Higher-Kinded Polymorphic Function

Define a function that maps over any container:

$$
\text{hmap} : \forall F :: (* \Rightarrow *).\; \forall G :: (* \Rightarrow *).\; (\forall X :: *.\; F\;X \to G\;X) \to \forall A :: *.\; F\;A \to G\;A
$$

$$
\text{hmap} = \Lambda F :: (* \Rightarrow *).\; \Lambda G :: (* \Rightarrow *).\; \lambda \eta : (\forall X :: *.\; F\;X \to G\;X).\; \Lambda A :: *.\; \lambda fa : F\;A.\; \eta\;[A]\;fa
$$

This is a *natural transformation* applicator: given a natural transformation $\eta : F \Rightarrow G$, it applies $\eta$ at a specific type $A$.

**Kinding check:**
- $F :: * \Rightarrow *$ and $A :: *$, so $F\;A :: *$. Similarly $G\;A :: *$.
- $\eta : \forall X :: *.\; F\;X \to G\;X$, so $\eta\;[A] : F\;A \to G\;A$.
- $\eta\;[A]\;fa : G\;A$.

### 9.2 Encoding a Type-Level Fixpoint (Failed Attempt)

Can we define a type-level fixpoint combinator in $F_\omega$?

$$
\text{Fix} = \lambda F :: (* \Rightarrow *).\; F\;(\text{Fix}\;F) \qquad \text{(?)}
$$

This would require $\text{Fix} :: (* \Rightarrow *) \Rightarrow *$. But note: the "definition" is recursive --- $\text{Fix}$ appears in its own body. In $F_\omega$, type-level computation is strongly normalizing (Theorem 3.1), so there is no fixpoint combinator at the type level. This is a feature, not a bug: it ensures decidability of type checking.

To add recursive types to $F_\omega$, one must extend the system with an explicit $\mu$ operator:

$$
\mu X :: *.\; T \qquad \text{with the unfolding rule: } \mu X.\; T \equiv [X \mapsto \mu X.\; T]T
$$

This gives rise to System $F_\omega^\mu$, which is used in practice (e.g., GHC's System FC includes recursive newtypes).

### 9.3 Defunctionalization at the Type Level

In some type systems without higher-kinded polymorphism, one can *defunctionalize* type-level functions. For example, instead of parameterizing over $F :: * \Rightarrow *$, one creates an explicit representation:

$$
\text{data TyCon} = \text{ListTC} \mid \text{OptionTC} \mid \text{TreeTC}
$$

$$
\text{type family Apply (f :: TyCon) (a :: *) :: * where}
$$

$$
\text{Apply ListTC a = List a}
$$

$$
\text{Apply OptionTC a = Option a}
$$

This is what languages without full higher-kinded types (e.g., Rust, early Scala) must resort to. $F_\omega$'s type-level lambdas make this unnecessary.

---

## 10. Parametricity in $F_\omega$

### 10.1 Free Theorems at Higher Kinds

Reynolds' abstraction theorem and Wadler's "theorems for free" (Module 06) extend to $F_\omega$. A term of type $\forall F :: (* \Rightarrow *).\; \forall X :: *.\; F\;X \to F\;X$ must be a natural transformation from $F$ to itself --- i.e., it must be the identity on $F\;X$ (up to permutation of structure).

More precisely, the *relational interpretation* of a type operator $F :: * \Rightarrow *$ maps a relation $R \subseteq A \times B$ to a relation $F(R) \subseteq F\;A \times F\;B$. A term of type $\forall F :: (* \Rightarrow *).\; \forall X :: *.\; F\;X \to F\;X$ must map $F(R)$-related inputs to $F(R)$-related outputs for all $R$, all $F$, and all $X$.

### 10.2 Naturality

The parametricity result for higher-kinded polymorphism implies *naturality*: if $g : \forall X :: *.\; F\;X \to G\;X$ is a polymorphic function (a natural transformation from $F$ to $G$), then for any function $h : A \to B$:

$$
G\;h \circ g_A = g_B \circ F\;h
$$

This is the naturality square:

$$
\begin{array}{ccc}
F\;A & \xrightarrow{g_A} & G\;A \\
\downarrow{F\;h} & & \downarrow{G\;h} \\
F\;B & \xrightarrow{g_B} & G\;B
\end{array}
$$

In Haskell, this is the "free theorem" for any function of type `forall a. f a -> g a`.

### 10.3 Dinaturality

Some polymorphic functions in $F_\omega$ satisfy *dinaturality* conditions rather than strict naturality. For example, a term of type $\forall X :: *.\; (X \to A) \to (X \to B)$ (where $X$ appears in both covariant and contravariant positions) satisfies a dinatural transformation condition.

The theory of dinatural transformations in the context of polymorphism was developed by Bainbridge, Freyd, Scedrov, and Scott (1990) and further by Girard (1992).

---

## 11. The Phase Distinction

### 11.1 Static vs. Dynamic

An important design principle in programming languages is the *phase distinction* (Harper, Mitchell, and Moggi, 1990): computations that happen at compile time (static) should be separated from computations that happen at run time (dynamic).

In $F_\omega$:

- **Static phase.** Type-level computation (beta-reduction of type operators) happens during type checking. The kind system ensures this computation terminates.
- **Dynamic phase.** Term-level computation (beta-reduction of terms, type application) happens at runtime. Strong normalization (in the pure system) ensures termination, but in practical languages, general recursion is added.

The phase distinction explains why type-level and term-level computations use separate mechanisms:

| Aspect | Type level | Term level |
|--------|-----------|------------|
| Language | Simply-typed lambda calculus (kinds = types) | Polymorphic lambda calculus ($F_\omega$) |
| Normal form | Always exists (strong normalization) | May not exist (with general recursion) |
| Compilation | Erased after type checking | Compiled to machine code |
| Runtime cost | Zero | Nonzero |

### 11.2 Erasure

Because type-level computation is purely static, all type information can be *erased* before execution. The erasure function $|-|$ removes all type annotations, type abstractions, and type applications:

$$
|\lambda x : T.\; e| = \lambda x.\; |e|
$$

$$
|\Lambda X :: K.\; e| = |e|
$$

$$
|e\;[T]| = |e|
$$

This is the formal basis for Java's type erasure and Haskell's representation-independent compilation.

**Theorem 11.1 (Erasure Correspondence).** If $e \longrightarrow e'$ in $F_\omega$, then $|e| \longrightarrow^* |e'|$ in the untyped lambda calculus (the erased term takes at most as many steps).

*Proof sketch.* By case analysis on the reduction step:
- E-Beta: $|(\lambda x : T.\; e)\;v| = (\lambda x.\; |e|)\;|v| \to [x \mapsto |v|]|e| = |[x \mapsto v]e|$. The erased term takes exactly one step.
- E-TBeta: $|(\Lambda X :: K.\; e)\;[T]| = |e| = |[X \mapsto T]e|$ (since type substitution does not affect the erased term). The erased term takes zero steps.
- Congruence rules: follow by induction. $\square$

### 11.3 Breaking the Phase Distinction

Dependent types (Module 08) break the phase distinction: types can depend on runtime values, so type-level computation may need information that is only available at runtime. This is one reason dependent types are more complex to compile and implement efficiently.

---

## 12. Exercises

**Exercise 12.1.** Give a complete typing derivation for:

$$
\emptyset;\; \emptyset \vdash (\Lambda F :: (* \Rightarrow *).\; \Lambda X :: *.\; \lambda x : F\;X.\; x) : \forall F :: (* \Rightarrow *).\; \forall X :: *.\; F\;X \to F\;X
$$

**Exercise 12.2.** In the Church encoding of pairs (Encoding 4.1), verify that:

$$
\text{snd}\;[A]\;[B]\;(\text{pair}\;[A]\;[B]\;a_0\;b_0) \longrightarrow^* b_0
$$

Show each reduction step.

**Exercise 12.3.** Define a type operator $\text{Flip} :: (* \Rightarrow * \Rightarrow *) \Rightarrow * \Rightarrow * \Rightarrow *$ such that $\text{Flip}\;F\;A\;B \equiv F\;B\;A$.

**Exercise 12.4.** Prove that System $F_\omega$ without the $\forall$ quantifier (i.e., the system with only type-level lambdas and application, plus the simply-typed lambda calculus at the term level) has decidable type inference. Hint: this system is essentially the simply-typed lambda calculus at both the term and type levels.

**Exercise 12.5.** Explain why the following term is ill-typed in $F_\omega$:

$$
\Lambda X :: *.\; \Lambda Y :: *.\; \lambda f : X.\; f\;[Y]
$$

What kind constraint is violated?

**Exercise 12.6.** Consider extending $F_\omega$ with a type-level fixpoint operator $\mu :: (K \Rightarrow K) \Rightarrow K$. Does strong normalization still hold? Does type checking remain decidable? Justify your answers.

**Exercise 12.7.** Define the Church encoding of $\text{Maybe}\;A = \forall R :: *.\; R \to (A \to R) \to R$ as a type operator in $F_\omega$. Implement $\text{nothing}$, $\text{just}$, and a $\text{maybe}$ eliminator. Verify the beta-reduction laws.

**Exercise 12.8.** The ML functor `MakeSet` (Section 5.1) can be seen as a function at two levels: it maps the type `Ord.t` to the types in `SET`, and it maps the values (the `compare` function) to the values (set operations). Write the $F_\omega$ type of such a functor. You may use existential types.

---

## 13. Common Pitfalls

### 13.1 "Type-Level Lambdas Are the Same as $\forall$"

**Wrong.** These are fundamentally different:

- $\lambda X :: *.\; T$ is a *type operator*: it takes a type argument and returns a type. It lives at the type level and has an arrow kind.
- $\forall X :: *.\; T$ is a *universal type*: it classifies polymorphic terms. It has kind $*$ (it is a proper type).

The confusion arises because both "abstract over types." But $\lambda$ abstracts at the type level (producing a type operator), while $\forall$ abstracts at the term level (producing a polymorphic type).

### 13.2 "System $F_\omega$ Has Dependent Types"

**Wrong.** In $F_\omega$, types depend on *types* (via type operators), and terms depend on *types* (via polymorphism). But types never depend on *terms*. The value of a term variable cannot influence which type an expression has. This is the key difference between $F_\omega$ and the Calculus of Constructions.

### 13.3 "Strong Normalization Means Programs Always Terminate"

**Correct for pure $F_\omega$, but misleading in practice.** Pure $F_\omega$ (without $\text{fix}$ or general recursion) is strongly normalizing: every well-typed program terminates. However, practical languages based on $F_\omega$ (like Haskell, which uses System FC) add general recursion, so programs can diverge. The strong normalization result applies to the *type-level* language, where it guarantees decidable type checking, regardless of whether the term-level language has recursion.

### 13.4 "Church Encodings Are Efficient"

**Wrong.** Church encodings (pairs, sums, lists) in $F_\omega$ are elegant but computationally inefficient. The Church-encoded predecessor function on natural numbers is $O(n)$, not $O(1)$. Pattern matching on Church-encoded data requires passing continuation functions, which introduces overhead. Practical languages add built-in algebraic datatypes for efficiency, using Church encodings only as a theoretical tool.

---

## 14. Connecting to the Rest of the Course

### 14.1 Backward: From System F

System F (Module 06) is recovered from $F_\omega$ by restricting all kind annotations to $*$. In System F, $\forall X.\; T$ is shorthand for $\forall X :: *.\; T$, and there are no type-level lambdas. Every type expression in System F has kind $*$ (it is a proper type). The expressiveness gain of $F_\omega$ comes entirely from the ability to abstract at the type level.

### 14.2 Backward: From Type Operators (Lecture 07a)

Lecture 07a introduced type operators and the kind system without polymorphism. System $F_\omega$ combines these with System F's polymorphism, yielding a system where both term-level and type-level abstraction coexist. The kind system ensures that the two levels interact well.

### 14.3 Forward: Bounded Quantification (Lecture 07c)

System $F_{<:}$ (Lecture 07c) adds subtyping to System F. Combining $F_{<:}$ with $F_\omega$ gives $F_{<:}^\omega$, which has type operators, polymorphism, and subtyping. This is close to the core of languages like Scala. The combination introduces subtle interactions (e.g., subtyping under type-level computation) that require careful design.

### 14.4 Forward: The Lambda Cube (Lecture 07d)

$F_\omega$ occupies a specific vertex of the lambda cube: the system with terms-on-types and types-on-types but not types-on-terms. Lecture 07d will place $F_\omega$ in this broader context and show how adding the dependent-types axis leads to the Calculus of Constructions.

---

## Summary

- **System $F_\omega$** combines System F's parametric polymorphism with type-level abstraction and application (type operators). It is the "sweet spot" in the lambda cube: maximally expressive without dependent types.
- **Syntax** extends System F with type-level lambdas $\lambda X :: K.\; T$, type-level application $T_1\; T_2$, and kind-annotated quantification $\forall X :: K.\; T$.
- **Kinding and typing** work together: the kinding judgment $\Delta \vdash T :: K$ ensures type expressions are well-formed, while the typing judgment $\Delta; \Gamma \vdash e : T$ ensures terms are well-typed. The conversion rule T-Eq bridges the gap between syntactically different but semantically equivalent types.
- **Strong normalization** holds at both the type level (types always normalize to a unique beta-normal form) and the term level (well-typed programs always terminate). This makes type checking decidable.
- **Expressiveness**: pairs, sums, existentials, Church-encoded data, and many other type constructors can be encoded within $F_\omega$ using type-level functions and polymorphism.
- **ML modules** can be understood through the lens of $F_\omega$: functors are type-level functions, structures are existential packages, and sharing constraints are type equalities.
- In the lambda cube, $F_\omega$ occupies the position combining polymorphism and type operators, one step below the Calculus of Constructions.

---

## Further Reading

1. **Girard, J.-Y.** (1972). *Interpretation fonctionnelle et elimination des coupures de l'arithmetique d'ordre superieur*. PhD thesis. The original definition of System F and its higher-order extensions.

2. **Girard, J.-Y., Lafont, Y., and Taylor, P.** (1989). *Proofs and Types*. Cambridge University Press. Chapter 11 covers System $F_\omega$ and strong normalization.

3. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapters 29--30. The primary textbook reference for type operators and $F_\omega$.

4. **Harper, R., Mitchell, J. C., and Moggi, E.** (1990). "Higher-Order Modules and the Phase Distinction." Connects $F_\omega$ to ML module systems.

5. **Cardelli, L. and Wegner, P.** (1985). "On Understanding Types, Data Abstraction, and Polymorphism." An influential survey placing $F_\omega$ in context.

6. **Sulzmann, M., Chakravarty, M. M. T., Peyton Jones, S., and Donnelly, K.** (2007). "System F with Type Equality Coercions." Describes System FC, GHC's core language extending $F_\omega$.

7. **Harper, R.** (2016). *Practical Foundations for Programming Languages*, 2nd ed., Chapter 43. An alternative development of type operators and higher-order polymorphism.

8. **Rossberg, A., Russo, C. V., and Dreyer, D.** (2014). "F-ing Modules." A modern reconstruction of ML modules in terms of System $F_\omega$.
