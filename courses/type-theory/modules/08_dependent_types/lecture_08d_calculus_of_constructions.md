---
title: "Lecture 08d: The Calculus of Constructions"
tags:
  - type-theory
  - dependent-types
  - lecture
---
# Lecture 08d: The Calculus of Constructions

> **Module 08 --- Dependent Types (Weeks 15--16)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Locate** the Calculus of Constructions (CoC) within the lambda cube as the system combining all three axes of dependency.
2. **State** the syntax, typing rules, and reduction rules of the CoC formally.
3. **Explain** the role of the sorts $\text{Prop}$ and $\text{Type}$ and their interaction.
4. **Define** impredicativity in the CoC and explain why $\forall (X : \text{Prop}).\, X$ is itself a $\text{Prop}$.
5. **State** the strong normalization theorem for the CoC and explain its significance for decidability.
6. **Describe** the Calculus of Inductive Constructions (CIC) and how it extends the CoC with inductive types.
7. **Explain** how Coq/Rocq is based on CIC and how Lean is based on a variant thereof.
8. **Implement** bidirectional type checking for dependent types and describe normalization by evaluation (NbE) as an efficient normalization strategy.

---

## 1. Motivation

### 1.1 The Lambda Cube, Completed

In Module 07, we studied the lambda cube, which organizes type systems along three axes:

| Axis | Dependency | System |
|---|---|---|
| 1 | Terms depending on types (polymorphism) | System F ($\lambda 2$) |
| 2 | Types depending on types (type operators) | $\lambda\underline{\omega}$ |
| 3 | Types depending on terms (dependent types) | $\lambda P$ |

Each axis can be combined with the others, giving $2^3 = 8$ systems at the vertices of the cube. The **Calculus of Constructions** (CoC), introduced by Coquand and Huet (1988), sits at the apex: it combines all three axes.

$$\lambda C = \lambda 2 + \lambda\underline{\omega} + \lambda P$$

The CoC is the most expressive system in the lambda cube. It subsumes System F, $F_\omega$, LF ($\lambda P$), and all intermediate systems.

### 1.2 Unification

The remarkable feature of the CoC is that all three forms of dependency are expressed using a *single* mechanism: the Pi type. In the CoC:

- **Polymorphism** ($\forall \alpha : *.\, T$) is a Pi type where the domain is a sort.
- **Type operators** ($\lambda \alpha : *.\, T$) are lambda abstractions with type domains.
- **Dependent types** ($\Pi(x : A).\, B(x)$) are Pi types with term domains.

All three are instances of $\Pi(x : A).\, B(x)$ for different choices of what $A$ and $B$ classify.

### 1.3 A Proof-Theoretic Motivation

From the proof-theoretic perspective, the CoC corresponds to a very strong logical system: higher-order intuitionistic predicate logic with impredicative quantification over propositions. This makes it powerful enough to serve as the basis for a proof assistant, while retaining decidable type checking (thanks to strong normalization).

---

## 2. Syntax

### 2.1 Terms

The CoC has a unified syntax where terms, types, and kinds are all expressions:

$$e ::= x \mid s \mid \Pi(x : e).\, e \mid \lambda(x : e).\, e \mid e\; e$$

where $x$ ranges over variables and $s$ ranges over **sorts**. The sorts are:

$$s ::= \text{Prop} \mid \text{Type}$$

In the minimal CoC, there are exactly two sorts. In the extended system (the Extended Calculus of Constructions, ECC), there is a hierarchy $\text{Type}_0, \text{Type}_1, \ldots$

**Conventions:**

- $A \to B$ abbreviates $\Pi(x : A).\, B$ when $x \notin \text{FV}(B)$.
- $\forall (x : A).\, B$ is sometimes used instead of $\Pi(x : A).\, B$ when $B$ is intended as a proposition.
- Parentheses and binders associate to the right: $\Pi(x : A).\, \Pi(y : B).\, C$ means $\Pi(x : A).\, (\Pi(y : B).\, C)$.

### 2.2 Reduction

The CoC has a single reduction rule:

$$(\lambda(x : A).\, b)\; a \longrightarrow_\beta b[a/x]$$

Reduction is allowed under all contexts (under binders, in function position, in argument position, in type annotations). The reflexive-symmetric-transitive-congruence closure of $\longrightarrow_\beta$ is definitional equality $\equiv$.

---

## 3. Typing Rules

### 3.1 The Axiom

$$\frac{}{\vdash \text{Prop} : \text{Type}} \; (\text{Axiom})$$

This is the only axiom: $\text{Prop}$ is an element of $\text{Type}$. Informally, $\text{Prop}$ is a "universe of propositions" and $\text{Type}$ is a "universe of types."

### 3.2 The Sort Rule (PTS Specification)

The typing of Pi types is governed by a set of **rules** $(s_1, s_2, s_3)$ specifying: if the domain has sort $s_1$ and the codomain has sort $s_2$, then the Pi type has sort $s_3$.

The CoC has the following rules:

$$(\text{Prop}, \text{Prop}, \text{Prop}) \qquad (\text{Prop}, \text{Type}, \text{Type})$$

$$(\text{Type}, \text{Prop}, \text{Prop}) \qquad (\text{Type}, \text{Type}, \text{Type})$$

In short: for all $s_1, s_2 \in \{\text{Prop}, \text{Type}\}$, we have the rule $(s_1, s_2, s_2)$.

### 3.3 Full Typing Rules

**Variables:**

$$\frac{\Gamma, x : A, \Delta \; \text{ctx}}{\Gamma, x : A, \Delta \vdash x : A} \; (\text{Var})$$

**Pi formation:**

$$\frac{\Gamma \vdash A : s_1 \qquad \Gamma, x : A \vdash B : s_2 \qquad (s_1, s_2, s_3) \in \mathcal{R}}{\Gamma \vdash \Pi(x : A).\, B : s_3} \; (\text{Pi})$$

**Lambda introduction:**

$$\frac{\Gamma, x : A \vdash b : B \qquad \Gamma \vdash \Pi(x : A).\, B : s}{\Gamma \vdash \lambda(x : A).\, b : \Pi(x : A).\, B} \; (\text{Lam})$$

**Application:**

$$\frac{\Gamma \vdash f : \Pi(x : A).\, B \qquad \Gamma \vdash a : A}{\Gamma \vdash f\; a : B[a/x]} \; (\text{App})$$

**Conversion:**

$$\frac{\Gamma \vdash a : A \qquad \Gamma \vdash B : s \qquad A \equiv B}{\Gamma \vdash a : B} \; (\text{Conv})$$

### 3.4 What the Rules Allow

Let us analyze each rule $(s_1, s_2, s_3)$ to understand what kind of dependency it enables:

**$(\text{Prop}, \text{Prop}, \text{Prop})$:** Propositions depending on propositions. This gives implication: if $P : \text{Prop}$ and $Q : \text{Prop}$, then $P \to Q : \text{Prop}$. More generally, $\Pi(x : P).\, Q(x) : \text{Prop}$ for $P, Q(x) : \text{Prop}$.

**$(\text{Type}, \text{Prop}, \text{Prop})$:** Propositions depending on types (and their elements). This gives dependent types / predicate logic: if $A : \text{Type}$ and $P(x) : \text{Prop}$ for $x : A$, then $\Pi(x : A).\, P(x) : \text{Prop}$. This is universal quantification.

**$(\text{Prop}, \text{Type}, \text{Type})$:** Types depending on propositions. If $P : \text{Prop}$ and $B(p) : \text{Type}$ for $p : P$, then $\Pi(p : P).\, B(p) : \text{Type}$. This allows types to depend on proofs.

**$(\text{Type}, \text{Type}, \text{Type})$:** Types depending on types. This gives polymorphism and type operators: if $A : \text{Type}$ and $B : \text{Type}$, then $A \to B : \text{Type}$. If $F : \text{Type} \to \text{Type}$, then $\Pi(\alpha : \text{Type}).\, F(\alpha) : \text{Type}$.

### 3.5 Comparison with the Lambda Cube

| Rule | Dependency | Lambda Cube Axis |
|---|---|---|
| $(\text{Prop}, \text{Prop}, \text{Prop})$ | Prop $\to$ Prop | (basic) |
| $(\text{Type}, \text{Type}, \text{Type})$ | Type $\to$ Type | Type operators ($\lambda\underline{\omega}$) |
| $(\text{Type}, \text{Prop}, \text{Prop})$ | Term $\to$ Prop | Dependent types ($\lambda P$) |
| $(\text{Prop}, \text{Type}, \text{Type})$ | Proof $\to$ Type | (needed for full CoC) |

The rule $(\text{Type}, \text{Prop}, \text{Prop})$ enables the rule $(*, *, *)$ (with $* = \text{Prop}$, $\Box = \text{Type}$) that characterizes dependent types. The rule $(\text{Prop}, \text{Type}, \text{Type})$ allows types to depend on proofs, which is needed for the full expressive power.

---

## 4. Impredicativity

### 4.1 The Impredicative Rule

The key feature that distinguishes the CoC from predicative type theories is the rule $(\text{Type}, \text{Prop}, \text{Prop})$:

$$\frac{\Gamma \vdash A : \text{Type} \qquad \Gamma, x : A \vdash P : \text{Prop}}{\Gamma \vdash \Pi(x : A).\, P : \text{Prop}}$$

In particular, taking $A = \text{Prop}$:

$$\frac{\Gamma \vdash \text{Prop} : \text{Type} \qquad \Gamma, X : \text{Prop} \vdash P(X) : \text{Prop}}{\Gamma \vdash \Pi(X : \text{Prop}).\, P(X) : \text{Prop}}$$

The quantification $\forall (X : \text{Prop}).\, P(X)$ ranges over *all* propositions, including itself, yet the result is still a $\text{Prop}$. This is **impredicativity**: the domain of quantification includes the entity being defined.

### 4.2 Why Impredicativity Is Useful

Impredicativity enables powerful encodings:

**Encoding of logical connectives.** In the CoC, the logical connectives can be defined impredicatively, without needing them as primitive type formers:

$$\bot \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, X$$

"Falsity is the proposition that everything is provable." Since there is no proof of every proposition, $\bot$ is uninhabited (in a consistent system).

$$\top \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, X \to X$$

"Truth is the proposition that everything implies itself." The identity function $\lambda X.\, \lambda x.\, x$ is a proof.

$$P \land Q \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, (P \to Q \to X) \to X$$

"$P \land Q$ is the proposition that any consequence of both $P$ and $Q$ holds." A proof is $\lambda X.\, \lambda f.\, f(p)(q)$ where $p : P$ and $q : Q$.

$$P \lor Q \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, (P \to X) \to (Q \to X) \to X$$

"$P \lor Q$ holds if every consequence of $P$ and every consequence of $Q$ holds."

$$\exists (x : A).\, P(x) \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, (\forall (x : A).\, P(x) \to X) \to X$$

These are the Church encodings of logical connectives, generalized to the dependent setting.

**Encoding of inductive types.** Natural numbers can be encoded impredicatively:

$$\text{Nat} \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, X \to (X \to X) \to X$$

with $0 \stackrel{\text{def}}{=} \lambda X.\, \lambda z.\, \lambda s.\, z$ and $\text{succ}(n) \stackrel{\text{def}}{=} \lambda X.\, \lambda z.\, \lambda s.\, s(n\; X\; z\; s)$.

However, these encodings have limitations: the induction principle (dependent elimination) is not derivable for impredicatively encoded types. This is a major motivation for adding inductive types as primitives (see Section 7).

### 4.3 Predicativity vs. Impredicativity

In Martin-Lof type theory, the universes are **predicative**: $\Pi(X : \mathcal{U}_i).\, B(X) : \mathcal{U}_i$ only when $B(X) : \mathcal{U}_i$ (and the whole Pi type lives at the same level). There is no universe $\mathcal{U}$ with $\Pi(X : \mathcal{U}).\, B(X) : \mathcal{U}$.

In the CoC, $\text{Prop}$ is impredicative: $\Pi(X : \text{Prop}).\, P(X) : \text{Prop}$ even though the quantification ranges over all of $\text{Prop}$, including $\Pi(X : \text{Prop}).\, P(X)$ itself.

| Property | Predicative (MLTT) | Impredicative (CoC) |
|---|---|---|
| $\Pi(X : \mathcal{U}).\, B : \mathcal{U}$? | Only if $B : \mathcal{U}$ and $\mathcal{U}$ is the right level | Yes (for $\text{Prop}$) |
| Church encodings | Not sufficient (need primitives) | Definable (for simple types) |
| Induction principle | Built in | Not derivable for encodings |
| Set-theoretic model | Standard sets | Requires large cardinals / PER models |
| Proof-theoretic strength | Weaker | Stronger |

### 4.4 Proof-Theoretic Strength

The CoC has proof-theoretic strength comparable to higher-order arithmetic. Specifically, it can encode all of second-order Peano arithmetic (PA2), which is considerably stronger than first-order PA.

The impredicative quantification $\forall (X : \text{Prop}).\, \ldots$ corresponds to second-order quantification over predicates. This is what gives the CoC its proof-theoretic power.

---

## 5. Strong Normalization

### 5.1 Statement

**Theorem 5.1 (Strong Normalization of the CoC).** *Every well-typed term in the Calculus of Constructions is strongly normalizing: every reduction sequence terminates.*

This is the fundamental metatheoretic property of the CoC. It implies:

1. **Decidability of type checking:** Since normalization always terminates, definitional equality ($A \equiv B$, decided by normalizing and comparing) is decidable.
2. **Consistency as a logic:** Since every term normalizes, there is no closed term of type $\bot = \forall (X : \text{Prop}).\, X$. (If there were, it would normalize to a canonical form, but $\bot$ has no introduction rule.)
3. **No general recursion:** The CoC cannot express non-terminating computations. Every definable function is total.

### 5.2 Proof Technique

The proof of strong normalization for the CoC extends the reducibility candidates method (Girard's method) used for System F.

**Definition 5.2 (Reducibility Candidate).** A set $\mathcal{C}$ of terms is a **reducibility candidate** (CR) if:

1. (CR1) Every term in $\mathcal{C}$ is strongly normalizing.
2. (CR2) $\mathcal{C}$ is closed under backward reduction: if $t \in \mathcal{C}$ and $t' \longrightarrow t$, then $t' \in \mathcal{C}$.
3. (CR3) If $t$ is neutral (not a redex) and all one-step reducts of $t$ are in $\mathcal{C}$, then $t \in \mathcal{C}$.

**Theorem 5.3 (Reducibility Theorem, sketch).** *For every well-typed term $\Gamma \vdash t : A$ in the CoC, $t$ belongs to the reducibility candidate $\lbrack\!\lbrack A \rbrack\!\rbrack_\rho$ for an appropriate valuation $\rho$.*

The proof proceeds by induction on typing derivations, with the critical case being the application rule, where one must show that applying a reducible function to a reducible argument yields a reducible result.

The main technical difficulty compared to System F is that types contain terms, so the reducibility interpretation must be defined by induction on the *structure of normal forms of types* rather than on the syntactic structure of types. This requires a simultaneous induction that interleaves the normalization argument with the reducibility argument.

The definitive proof is due to Coquand and Gallier (1990) and Werner (1994).

### 5.3 Why Strong Normalization Matters

Strong normalization is not merely a technical nicety --- it has profound practical consequences:

1. **Type checking terminates.** Since conversion checking requires normalization, and normalization always terminates, the type checker always terminates. A user can never encounter an infinite loop during type checking (barring bugs in the implementation).

2. **Consistency.** Strong normalization implies that the empty type $\bot = \forall (X : \text{Prop}).\, X$ is not inhabited: if there were a closed term $t : \bot$, it would normalize to a canonical form, but $\bot$ has no introduction rule (no canonical forms). Hence every type is not inhabited, and the system is consistent as a logic.

3. **Canonicity.** Every closed term of a base type (e.g., $\text{Nat}$) normalizes to a canonical value ($0$, $\text{succ}(0)$, $\text{succ}(\text{succ}(0))$, etc.). This ensures that programs actually compute.

4. **Decidability of definitional equality.** Since every term has a unique normal form (by confluence + strong normalization), checking $a \equiv b$ reduces to normalizing both sides and comparing syntactically.

### 5.4 Consequences for Programming

Strong normalization means the CoC (and by extension, the kernel languages of Coq and Lean) cannot express all computable functions. Specifically:

- The CoC can express exactly the functions provably total in higher-order arithmetic.
- Functions like the Ackermann function are expressible.
- But functions whose totality is equivalent to the consistency of higher-order arithmetic are not.

In practice, this is not a serious limitation: virtually all functions encountered in practice are expressible. The termination requirement is a feature, not a bug, since it ensures that type checking terminates.

---

## 6. The Calculus of Constructions as a Pure Type System

### 6.1 Pure Type Systems

The CoC is an instance of the general framework of **Pure Type Systems** (PTS), introduced by Berardi (1988) and Terlouw (1989) and systematized by Barendregt (1991).

**Definition 6.1 (Pure Type System).** A PTS is specified by a triple $(\mathcal{S}, \mathcal{A}, \mathcal{R})$ where:

- $\mathcal{S}$ is a set of **sorts**.
- $\mathcal{A} \subseteq \mathcal{S} \times \mathcal{S}$ is a set of **axioms** $(s_1, s_2)$, meaning $s_1 : s_2$.
- $\mathcal{R} \subseteq \mathcal{S} \times \mathcal{S} \times \mathcal{S}$ is a set of **rules** $(s_1, s_2, s_3)$, governing Pi type formation.

The syntax and typing rules are uniform across all PTSs; only the specification $(\mathcal{S}, \mathcal{A}, \mathcal{R})$ changes.

### 6.2 The CoC as a PTS

$$\mathcal{S} = \{\text{Prop}, \text{Type}\}$$

$$\mathcal{A} = \{(\text{Prop}, \text{Type})\}$$

$$\mathcal{R} = \{(\text{Prop}, \text{Prop}, \text{Prop}),\; (\text{Prop}, \text{Type}, \text{Type}),\; (\text{Type}, \text{Prop}, \text{Prop}),\; (\text{Type}, \text{Type}, \text{Type})\}$$

### 6.3 Other Systems as PTSs

| System | $\mathcal{S}$ | $\mathcal{A}$ | $\mathcal{R}$ |
|---|---|---|---|
| $\lambda{\to}$ (STLC) | $\{*, \Box\}$ | $\{(*, \Box)\}$ | $\{(*, *, *)\}$ |
| $\lambda 2$ (System F) | $\{*, \Box\}$ | $\{(*, \Box)\}$ | $\{(*, *, *), (\Box, *, *)\}$ |
| $\lambda P$ (LF) | $\{*, \Box\}$ | $\{(*, \Box)\}$ | $\{(*, *, *), (*, \Box, \Box)\}$ |
| $\lambda\underline{\omega}$ | $\{*, \Box\}$ | $\{(*, \Box)\}$ | $\{(*, *, *), (\Box, \Box, \Box)\}$ |
| $\lambda C$ (CoC) | $\{*, \Box\}$ | $\{(*, \Box)\}$ | $\{(s_1, s_2, s_2) \mid s_1, s_2 \in \{*, \Box\}\}$ |

(Here $* = \text{Prop}$ and $\Box = \text{Type}$.)

### 6.4 Properties of PTSs

**Theorem 6.2 (Subject Reduction for PTSs).** *If $\Gamma \vdash t : A$ and $t \longrightarrow_\beta t'$, then $\Gamma \vdash t' : A$.*

**Theorem 6.3 (Church-Rosser for PTSs).** *The beta-reduction relation on PTS terms is confluent.*

**Theorem 6.4 (Barendregt-Geuvers-Klop Conjecture).** *For any PTS, if every well-typed term is weakly normalizing, then every well-typed term is strongly normalizing.*

This conjecture has been proved for many important PTSs, including all systems in the lambda cube (Barthe and Sorensen 2000).

---

## 7. The Calculus of Inductive Constructions (CIC)

### 7.1 Motivation

The pure CoC is expressively powerful but lacks:

1. **Inductive types** with their elimination principles (pattern matching, recursion, induction).
2. **Primitive natural numbers, lists, trees**, etc.

While these can be encoded impredicatively (Section 4.2), the encodings do not support **dependent elimination** (induction). For instance, the Church-encoded natural number $\text{Nat}_{\text{Church}}$ supports recursion (non-dependent fold) but not induction (dependent fold).

**Example 7.1.** With Church-encoded $\text{Nat}$, we can define $\text{add} : \text{Nat} \to \text{Nat} \to \text{Nat}$ (recursion), but we cannot prove $\forall n.\, n + 0 = n$ (induction), because the type of the result depends on $n$, and the Church encoding's fold is non-dependent.

This limitation motivates adding inductive types as primitives.

### 7.2 Inductive Type Declarations

In CIC, inductive types are declared by specifying:

1. The **type former** (with its parameters and indices).
2. The **constructors** (with their types).

**Example 7.2 (Natural numbers).**

$$\text{Inductive Nat} : \text{Type} := \; 0 : \text{Nat} \mid \text{succ} : \text{Nat} \to \text{Nat}$$

**Example 7.3 (Vectors).**

$$\text{Inductive Vec} (A : \text{Type}) : \text{Nat} \to \text{Type} :=$$

$$\quad \text{nil} : \text{Vec}(A, 0)$$

$$\quad \mid\; \text{cons} : \forall (n : \text{Nat}).\, A \to \text{Vec}(A, n) \to \text{Vec}(A, \text{succ}(n))$$

Here $A$ is a **parameter** (uniform across all constructors) and $n : \text{Nat}$ is an **index** (varying between constructors).

### 7.3 Elimination Principles

For each inductive type, CIC generates a dependent elimination principle (induction principle / recursor). For $\text{Nat}$:

$$\text{Nat\_rect} : \forall (P : \text{Nat} \to \text{Type}).\, P(0) \to (\forall n.\, P(n) \to P(\text{succ}(n))) \to \forall n.\, P(n)$$

with computation rules:

$$\text{Nat\_rect}(P, p_0, p_s, 0) \equiv p_0$$

$$\text{Nat\_rect}(P, p_0, p_s, \text{succ}(n)) \equiv p_s(n, \text{Nat\_rect}(P, p_0, p_s, n))$$

### 7.4 The Strict Positivity Condition

Not every inductive type declaration is consistent. For instance, the type:

$$\text{Inductive Bad} : \text{Type} := \; \text{mkBad} : (\text{Bad} \to \text{Bad}) \to \text{Bad}$$

allows encoding of the non-terminating term $\omega = \text{mkBad}(\lambda x.\, \text{match}\; x\; \text{with}\; \text{mkBad}\; f \Rightarrow f(x))$, and then $\omega\; \omega$ loops. This breaks consistency and strong normalization.

The **strict positivity condition** prevents such types: the type being defined may appear in constructor arguments only in *strictly positive* positions (not to the left of an arrow). Formally, in a constructor type $\ldots \to T$, the type $T$ being defined must not appear in any argument position where it would be to the left of a $\to$.

**Strictly positive (allowed):**

$$\text{succ} : \text{Nat} \to \text{Nat} \qquad \text{(Nat appears to the right)}$$

$$\text{node} : \text{Tree} \to \text{Tree} \to \text{Tree} \qquad \text{(Tree appears to the right)}$$

$$\text{node} : \text{List}(\text{Tree}) \to \text{Tree} \qquad \text{(Tree appears positively in List)}$$

**Not strictly positive (rejected):**

$$\text{mkBad} : (\text{Bad} \to \text{Bad}) \to \text{Bad} \qquad \text{(Bad appears to the left of } \to \text{)}$$

### 7.5 Computation Rules for Pattern Matching

In CIC, pattern matching on inductive types introduces **iota-reduction** ($\iota$-reduction). When a pattern match is applied to a constructor, the appropriate branch is selected:

$$\text{match}\; C_i(\vec{a}) \;\text{with}\; C_1(\vec{x_1}) \Rightarrow t_1 \mid \cdots \mid C_n(\vec{x_n}) \Rightarrow t_n \;\text{end} \;\longrightarrow_\iota\; t_i[\vec{a}/\vec{x_i}]$$

For recursive types, the recursive calls in fixpoint definitions also reduce by iota when applied to a constructor argument:

$$\text{fix}\; f(x : T) := t \;\text{applied to}\; C_i(\vec{a}) \;\longrightarrow_\iota\; t[C_i(\vec{a})/x, (\text{fix}\; f(x : T) := t)/f]$$

The **guard condition** ensures that the recursive call in $t$ is on a structurally smaller argument than $x$, guaranteeing termination.

### 7.6 CIC Summary

The Calculus of Inductive Constructions = CoC + inductive types (satisfying strict positivity) + dependent elimination + computation rules (iota-reduction for pattern matching).

CIC is the kernel language of **Coq/Rocq** (with additional features like co-inductive types, module system, universe polymorphism, and definitional proof irrelevance in recent versions).

### 7.7 The Reduction Relations in CIC

CIC has several reduction relations:

| Reduction | Notation | Rule |
|---|---|---|
| Beta | $\beta$ | $(\lambda x.\, t)\; a \longrightarrow t[a/x]$ |
| Delta | $\delta$ | Unfolding definitions: $c \longrightarrow t$ where $c \stackrel{\text{def}}{=} t$ |
| Iota | $\iota$ | Pattern matching on constructors |
| Zeta | $\zeta$ | Let-reduction: $\text{let}\; x = a \;\text{in}\; t \longrightarrow t[a/x]$ |
| Eta | $\eta$ | $f \equiv \lambda x.\, f\;x$ for functions |

The combined reduction $\beta\delta\iota\zeta$ is confluent and (for well-typed terms) strongly normalizing. Conversion checking in Coq's kernel uses this combined reduction.

In practice, Coq's conversion checker uses a **lazy** strategy: it reduces to weak head normal form (WHNF) and compares top-level structure, reducing subterms only when needed. This is more efficient than full normalization because it avoids reducing subterms that are never compared.

The kernel also implements **universe constraint checking**: universe polymorphic definitions generate constraints like $i \leq j$ on universe levels, and the kernel checks that these constraints are satisfiable. An unsatisfiable constraint indicates a universe inconsistency.

---

## 8. Connection to Proof Assistants

### 8.1 Coq/Rocq

Coq (now being renamed Rocq) is based on the Calculus of Inductive Constructions with:

- **Predicative hierarchy** for $\text{Type}$: $\text{Type}_0 : \text{Type}_1 : \text{Type}_2 : \ldots$
- **Impredicative** $\text{Prop}$: $\forall (X : \text{Prop}).\, P(X) : \text{Prop}$.
- **Universe polymorphism:** Definitions can be parameterized by universe levels.
- **Inductive types** with strict positivity, pattern matching, and fixpoint definitions with a structural recursion guard.
- **Co-inductive types** for infinite data structures (streams, etc.).
- **The `Set` sort:** In some configurations, $\text{Set}$ is a predicative sort at the bottom of the $\text{Type}$ hierarchy.

**Example (Coq):**

```coq
Inductive Vec (A : Type) : nat -> Type :=
  | vnil : Vec A 0
  | vcons : forall n, A -> Vec A n -> Vec A (S n).

Fixpoint append {A : Type} {m n : nat}
    (v : Vec A m) (w : Vec A n) : Vec A (m + n) :=
  match v with
  | vnil _ => w
  | vcons _ k a v' => vcons A (k + n) a (append v' w)
  end.
```

### 8.2 Lean 4

Lean 4 is based on a variant of CIC with several differences:

- **Quotient types** as primitives (not derivable from CIC alone).
- **Definitional proof irrelevance:** All proofs of propositions ($p : P$ where $P : \text{Prop}$) are definitionally equal.
- **Non-cumulative universes** in the kernel (cumulativity is elaboration-level).
- **Structural and well-founded recursion** via the equation compiler.
- **Type classes** for ad-hoc polymorphism.

**Example (Lean 4):**

```lean
inductive Vec (A : Type) : Nat -> Type where
  | nil : Vec A 0
  | cons : {n : Nat} -> A -> Vec A n -> Vec A (n + 1)

def append : Vec A m -> Vec A n -> Vec A (m + n)
  | .nil, w => w
  | .cons a v, w => .cons a (append v w)
```

### 8.3 Agda

Agda is based on Martin-Lof type theory (intensional, predicative) rather than the CoC. Key differences:

- **No impredicative $\text{Prop}$** (unless using `--prop` or `--type-in-type`).
- **Pattern matching** as primitive (not reduced to eliminators).
- **Universe polymorphism** with explicit level variables.
- **Sized types** for termination checking.
- **Homotopy type theory** support (cubical Agda).

---

## 9. Practical Type Checking

### 9.1 Bidirectional Type Checking for Dependent Types

Bidirectional type checking (introduced in Module 05 and revisited in Lecture 08a) is the standard approach for implementing type checkers for dependently typed languages.

**Key rules:**

**Checking a lambda against a Pi type:**

$$\frac{\Gamma, x : A \vdash b \Leftarrow B}{\Gamma \vdash \lambda x.\, b \Leftarrow \Pi(x : A).\, B}$$

The lambda does not need a type annotation --- the expected Pi type provides $A$ and $B$.

**Synthesizing the type of an application:**

$$\frac{\Gamma \vdash f \Rightarrow \Pi(x : A).\, B \qquad \Gamma \vdash a \Leftarrow A}{\Gamma \vdash f\; a \Rightarrow B[a/x]}$$

The function synthesizes a Pi type; the argument is checked against the domain; the result type is $B[a/x]$.

**Synthesizing the type of an annotated term:**

$$\frac{\Gamma \vdash A \Leftarrow s \qquad \Gamma \vdash t \Leftarrow A}{\Gamma \vdash (t : A) \Rightarrow A}$$

Type annotations switch from checking to synthesis.

**Change of direction (subsumption):**

$$\frac{\Gamma \vdash t \Rightarrow A \qquad \text{whnf}(A) \equiv \text{whnf}(B)}{\Gamma \vdash t \Leftarrow B}$$

### 9.2 Implementation Sketch

A type checker for a CoC-like language has the following structure:

```
type term =
  | Var of name
  | Sort of sort            (* Prop | Type i *)
  | Pi of name * term * term
  | Lam of name * term * term
  | App of term * term

type value =
  | VNeutral of neutral
  | VSort of sort
  | VPi of name * value * closure
  | VLam of name * value * closure
and neutral =
  | NVar of level
  | NApp of neutral * normal
and normal = { ty : value; tm : value }
and closure = { env : env; body : term }

(* Evaluation: term -> value *)
let rec eval (env : env) (t : term) : value = ...

(* Read back: value -> term (at a given depth) *)
let rec quote (depth : int) (v : value) : term = ...

(* Conversion check: value -> value -> bool *)
let rec conv (depth : int) (v1 : value) (v2 : value) : bool = ...

(* Type checking *)
let rec check (ctx : ctx) (t : term) (ty : value) : unit = ...
let rec infer (ctx : ctx) (t : term) : value = ...
```

The key insight is that **evaluation to values** is separate from **quoting values back to terms**. This separation is the foundation of normalization by evaluation.

### 9.3 Normalization by Evaluation (NbE)

**Normalization by evaluation** (NbE) is an efficient technique for computing normal forms of terms in typed lambda calculi. Instead of performing syntactic beta-reduction steps, NbE:

1. **Evaluates** the term into a semantic domain (values) using the host language's evaluation mechanism.
2. **Quotes** the value back into a syntactic term in normal form.

**Why NbE is efficient:**

- Substitution is implemented by closures (environment-based evaluation), avoiding the expensive operation of renaming and substituting in syntax trees.
- The host language's runtime handles the mechanics of function application.
- Sharing is free (through the host language's memory management).

**Step 1: Evaluation.** Terms are evaluated to values in an environment:

- Variables are looked up in the environment.
- Lambdas become closures: $\text{VLam}(x, A, \{env, body\})$.
- Applications evaluate the function and argument; if the function is a lambda closure, apply it (extending the closure's environment). If the function is a neutral term (stuck variable), construct a neutral application $\text{NApp}(f, a)$.
- Pi types become value Pi types with closures for the codomain.
- Sorts evaluate to themselves.

**Step 2: Quotation.** Values are read back into normal-form terms:

- $\text{VLam}(x, A, cl)$ is quoted by applying the closure to a fresh variable, quoting the result, and wrapping in a syntactic lambda. This implements eta-expansion: even a neutral function (a stuck variable $f$) is quoted as $\lambda x.\, f(x)$.
- $\text{VPi}(x, A, cl)$ is quoted similarly.
- Neutral terms are quoted by reading back the spine of applications.

**Step 3: Conversion checking.** Two values are convertible if they quote to alpha-equivalent terms. In practice, conversion is checked directly on values without quoting, comparing structurally and applying closures to fresh variables as needed.

**Theorem 9.1 (Correctness of NbE).** *For a strongly normalizing typed lambda calculus, $\text{quote}(\text{eval}(\text{env}, t))$ is the beta-normal form of $t$ (under the substitution induced by $\text{env}$). Moreover, $\text{conv}(\text{eval}(\text{env}, t_1), \text{eval}(\text{env}, t_2))$ holds if and only if $t_1$ and $t_2$ are definitionally equal.*

The original NbE technique is due to Berger and Schwichtenberg (1991) for the simply typed lambda calculus. It was extended to dependent types by Abel (2008), Gratzer, Sterling, and Birkedal (2019), and others.

---

## 10. Extensions and Variants

### 10.0 The Design Space

The CoC and its variants represent specific points in a large design space of dependent type theories. The key design dimensions are:

| Dimension | Options |
|---|---|
| Universes | Single / Hierarchy / Polymorphic |
| Prop | Impredicative / Predicative / None |
| Inductive types | Encodings only / Primitive / With indices |
| Recursion | Structural / Well-founded / General |
| Identity | Intensional / Extensional / Cubical |
| Proof irrelevance | None / Propositional / Definitional |
| Eta rules | None / Function eta / Pair eta / Record eta |

Each proof assistant makes specific choices along these dimensions:

| Feature | Coq/Rocq | Lean 4 | Agda |
|---|---|---|---|
| Universes | Cumulative hierarchy | Non-cumulative hierarchy | Explicit levels |
| Prop | Impredicative | Impredicative, proof-irrel. | Predicative (by default) |
| Inductive types | Primitive (CIC) | Primitive (CIC variant) | Pattern matching |
| Recursion | Guard condition | Equation compiler | Termination checker |
| Identity | Intensional | Intensional | Intensional (or cubical) |

Understanding these choices helps in choosing the right tool for a given formalization task.

### 10.1 The Extended Calculus of Constructions (ECC)

Luo (1989) introduced the ECC, which extends the CoC with:

- A predicative hierarchy of universes $\text{Type}_0 : \text{Type}_1 : \text{Type}_2 : \ldots$
- Strong Sigma types (dependent pairs).
- Cumulativity: $\text{Type}_i \leq \text{Type}_{i+1}$.

The ECC is the basis for the LEGO proof assistant.

### 10.2 The Predicative Calculus of Inductive Constructions (pCIC)

Some researchers argue that impredicativity is philosophically problematic and removes it from $\text{Prop}$, working entirely predicatively. Agda takes this approach.

### 10.3 Observational Type Theory (OTT)

Altenkirch, McBride, and Swierstra (2007) introduced OTT, which adds extensional features to an intensional core:

- Function extensionality is built in.
- Proof irrelevance for propositions is built in.
- But type checking remains decidable.

### 10.4 Setoid Type Theory

Setoid type theory (Altenkirch 1999, Palmgren 2005) addresses function extensionality by working with types equipped with an equivalence relation (setoids) rather than bare types. In setoid type theory:

- Every type $A$ comes with an equivalence relation $\sim_A$.
- Functions must respect the equivalence relation: $f : A \to B$ must satisfy $a \sim_A a' \Rightarrow f(a) \sim_B f(a')$.
- Function extensionality is automatic: two functions are equivalent if they produce equivalent outputs.

The disadvantage is the "setoid hell" problem: every construction must carry proof obligations that the equivalence relation is respected, leading to verbose and bureaucratic formalizations.

### 10.5 Cubical Type Theory

Cohen, Coquand, Huber, and Mortberg (2018) introduced cubical type theory, which gives a computational interpretation of the univalence axiom. Cubical type theory extends MLTT with:

- An interval type $\mathbb{I}$ with endpoints $0$ and $1$.
- Path types $\text{Path}_A(a, b)$, defined as functions $\mathbb{I} \to A$ with specified endpoints.
- A composition operation that makes the type theory satisfy the univalence axiom.
- Canonicity: every closed term of type $\text{Nat}$ computes to a numeral.

Cubical Agda implements this theory.

---

## 11. Worked Examples in the CoC

### 11.1 Encoding Natural Numbers

We demonstrate the impredicative encoding of natural numbers in the CoC and explore its properties.

**Definition.**

$$\text{Nat} \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, X \to (X \to X) \to X$$

$$\text{zero} \;\stackrel{\text{def}}{=}\; \lambda X.\, \lambda z.\, \lambda s.\, z \;:\; \text{Nat}$$

$$\text{succ} \;\stackrel{\text{def}}{=}\; \lambda n.\, \lambda X.\, \lambda z.\, \lambda s.\, s\;(n\;X\;z\;s) \;:\; \text{Nat} \to \text{Nat}$$

**Church numerals:**

$$\underline{0} = \lambda X.\, \lambda z.\, \lambda s.\, z$$

$$\underline{1} = \lambda X.\, \lambda z.\, \lambda s.\, s\; z$$

$$\underline{2} = \lambda X.\, \lambda z.\, \lambda s.\, s\;(s\; z)$$

$$\underline{n} = \lambda X.\, \lambda z.\, \lambda s.\, \underbrace{s\;(s\;\cdots(s}_{n}\; z)\cdots)$$

**Addition:**

$$\text{add} \;\stackrel{\text{def}}{=}\; \lambda m.\, \lambda n.\, \lambda X.\, \lambda z.\, \lambda s.\, m\;X\;(n\;X\;z\;s)\;s$$

*Proof that $\text{add}$ is well-typed.* We have $m : \text{Nat}$, so $m\;X\;(n\;X\;z\;s)\;s$ applies $m$ at type $X$ with base case $n\;X\;z\;s : X$ and step $s : X \to X$, yielding a term of type $X$. The whole expression has type $\forall X.\, X \to (X \to X) \to X = \text{Nat}$. $\square$

**Multiplication:**

$$\text{mul} \;\stackrel{\text{def}}{=}\; \lambda m.\, \lambda n.\, \lambda X.\, \lambda z.\, \lambda s.\, m\;X\;z\;(n\;X\;(\lambda x.\, x)\;(\lambda f.\, \lambda x.\, s\;(f\;x)))$$

Actually, a simpler encoding:

$$\text{mul} \;\stackrel{\text{def}}{=}\; \lambda m.\, \lambda n.\, \lambda X.\, m\;X\;\circ\;(\lambda f.\, n\;X\;(\text{id}_X)\;f)$$

or equivalently:

$$\text{mul} \;\stackrel{\text{def}}{=}\; \lambda m.\, \lambda n.\, \lambda X.\, \lambda z.\, \lambda s.\, m\;X\;z\;(\lambda y.\, n\;X\;y\;s)$$

**Limitation: no induction.** While we can define recursion (the non-dependent eliminator) for Church-encoded Nat:

$$\text{Nat-rec}(X, z, s, n) = n\;X\;z\;s$$

we *cannot* derive the dependent eliminator (induction):

$$\text{Nat-ind} : \forall (P : \text{Nat} \to \text{Prop}).\, P(\text{zero}) \to (\forall n.\, P(n) \to P(\text{succ}(n))) \to \forall n.\, P(n)$$

This is because Church-encoded types support only non-dependent folds. To attempt the derivation, we would need to instantiate $n : \text{Nat}$ at the type $\Sigma(x : X).\, P(x)$, but this requires $\text{Nat}$ to be in $\text{Type}$, not $\text{Prop}$ (due to the large elimination). This fundamental limitation motivates the addition of primitive inductive types in CIC.

### 11.2 Encoding Propositional Logic in the CoC

The impredicative encodings of logical connectives are fully usable:

**Conjunction:**

$$P \land Q \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, (P \to Q \to X) \to X$$

*Introduction:*

$$\text{pair} \;\stackrel{\text{def}}{=}\; \lambda p.\, \lambda q.\, \lambda X.\, \lambda f.\, f\;p\;q \;:\; P \to Q \to P \land Q$$

*Eliminations:*

$$\text{fst} \;\stackrel{\text{def}}{=}\; \lambda c.\, c\;P\;(\lambda p.\, \lambda q.\, p) \;:\; P \land Q \to P$$

$$\text{snd} \;\stackrel{\text{def}}{=}\; \lambda c.\, c\;Q\;(\lambda p.\, \lambda q.\, q) \;:\; P \land Q \to Q$$

**Disjunction:**

$$P \lor Q \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, (P \to X) \to (Q \to X) \to X$$

*Introductions:*

$$\text{inl} \;\stackrel{\text{def}}{=}\; \lambda p.\, \lambda X.\, \lambda f.\, \lambda g.\, f\;p \;:\; P \to P \lor Q$$

$$\text{inr} \;\stackrel{\text{def}}{=}\; \lambda q.\, \lambda X.\, \lambda f.\, \lambda g.\, g\;q \;:\; Q \to P \lor Q$$

*Elimination:*

$$\text{case} \;\stackrel{\text{def}}{=}\; \lambda d.\, \lambda X.\, \lambda f.\, \lambda g.\, d\;X\;f\;g \;:\; P \lor Q \to \forall X.\, (P \to X) \to (Q \to X) \to X$$

**Existential quantification:**

$$\exists (x : A).\, P(x) \;\stackrel{\text{def}}{=}\; \forall (X : \text{Prop}).\, (\forall (x : A).\, P(x) \to X) \to X$$

*Introduction:*

$$\text{ex-intro} \;\stackrel{\text{def}}{=}\; \lambda a.\, \lambda p.\, \lambda X.\, \lambda f.\, f\;a\;p \;:\; \forall (a : A).\, P(a) \to \exists (x : A).\, P(x)$$

**Negation:**

$$\neg P \;\stackrel{\text{def}}{=}\; P \to \bot = P \to \forall (X : \text{Prop}).\, X$$

All the standard rules of intuitionistic propositional and predicate logic are derivable from these encodings.

### 11.3 Leibniz Equality in the CoC

In the pure CoC (without identity types), we can define propositional equality using Leibniz's principle:

$$\text{Eq}(A, a, b) \;\stackrel{\text{def}}{=}\; \forall (P : A \to \text{Prop}).\, P(a) \to P(b)$$

"$a$ equals $b$ if and only if every property of $a$ is also a property of $b$."

*Reflexivity:*

$$\text{refl} \;\stackrel{\text{def}}{=}\; \lambda P.\, \lambda p.\, p \;:\; \text{Eq}(A, a, a)$$

*Symmetry:*

$$\text{sym} \;\stackrel{\text{def}}{=}\; \lambda e.\, e\;(\lambda x.\, \text{Eq}(A, x, a))\;\text{refl} \;:\; \text{Eq}(A, a, b) \to \text{Eq}(A, b, a)$$

*Transitivity:*

$$\text{trans} \;\stackrel{\text{def}}{=}\; \lambda e_1.\, \lambda e_2.\, \lambda P.\, \lambda p.\, e_2\;P\;(e_1\;P\;p) \;:\; \text{Eq}(A, a, b) \to \text{Eq}(A, b, c) \to \text{Eq}(A, a, c)$$

*Congruence:*

$$\text{cong} \;\stackrel{\text{def}}{=}\; \lambda f.\, \lambda e.\, e\;(\lambda x.\, \text{Eq}(B, f(a), f(x)))\;\text{refl} \;:\; (f : A \to B) \to \text{Eq}(A, a, b) \to \text{Eq}(B, f(a), f(b))$$

Leibniz equality in the CoC is well-behaved for simple types but has subtleties for dependent types and universes.

---

## 12. The Role of the CoC in Modern Proof Assistants

### 12.1 Coq's Architecture

Coq/Rocq is structured in layers, with the CoC (extended to CIC) at the core:

1. **Kernel.** The trusted computing base. Implements CIC with:
   - Universe polymorphism and cumulativity.
   - Inductive type checking (strict positivity, guard condition).
   - Reduction (beta, delta, iota, zeta, eta).
   - Conversion checking.
   Size: approximately 10,000 lines of OCaml.

2. **Elaboration.** Transforms user-facing syntax into kernel terms:
   - Implicit argument inference (unification).
   - Coercion insertion.
   - Canonical structures / type classes.
   - Notation desugaring.

3. **Tactic engine.** Constructs proof terms interactively:
   - Basic tactics: `intro`, `apply`, `exact`, `rewrite`.
   - Automation: `auto`, `omega`, `ring`, `lia`.
   - Custom tactics via Ltac / Ltac2.
   The tactic engine generates CIC terms that are verified by the kernel.

4. **Module system.** Organizes definitions into modules with interfaces.

5. **Extraction.** Translates CIC proofs into OCaml, Haskell, or Scheme programs, erasing propositional content.

### 12.2 Lean's Architecture

Lean 4 has a different architecture:

1. **Kernel.** CIC variant with:
   - Quotient types (not in Coq's kernel).
   - Definitional proof irrelevance: if $P : \text{Prop}$ and $p, q : P$, then $p \equiv q$.
   - No guard condition; instead, structural recursion + well-founded recursion via the equation compiler.

2. **Elaboration.** Lean 4 has a particularly sophisticated elaborator:
   - First-class metavariable management.
   - Expected-type propagation (bidirectional).
   - Instance search for type classes.
   - Auto-bound implicit arguments.

3. **Tactic framework.** Tactics are ordinary Lean functions that manipulate proof states. The `Lean.Elab.Tactic` monad provides the API.

4. **Macro system.** Lean's syntax is user-extensible via macros and custom elaborators, allowing domain-specific notations and proof languages.

### 12.3 Proof Irrelevance and Prop

In both Coq and Lean, the sort $\text{Prop}$ plays a special role:

- **Proof irrelevance** (Lean, definitional): all proofs of the same proposition are definitionally equal.
- **Proof irrelevance** (Coq, propositional): provable via `Proof_Irrelevance` axiom, or derivable for specific types via `SProp` (strict propositions, added in Coq 8.10).

The practical consequence: when extracting programs, all propositional content is erased. A function $f : \Pi(n : \text{Nat}).\, \Pi(p : n > 0).\, \text{Nat}$ becomes, after extraction, a function $f : \text{int} \to \text{int}$ --- the proof argument $p$ is erased.

This is possible because $\text{Prop}$ is impredicative: $\forall (X : \text{Prop}).\, P(X) : \text{Prop}$, and all the proof content lives in $\text{Prop}$. Computational content lives in $\text{Type}$.

---

## 13. Exercises

### Exercise 13.1

Verify that the impredicative encoding of conjunction satisfies the expected beta-reductions: $\text{fst}(\text{pair}(p, q)) \equiv p$ and $\text{snd}(\text{pair}(p, q)) \equiv q$.

### Exercise 13.2

In the CoC, derive the following tautologies of intuitionistic propositional logic:

1. $(P \Rightarrow Q \Rightarrow R) \Rightarrow (P \land Q \Rightarrow R)$ (uncurrying)
2. $(P \land Q \Rightarrow R) \Rightarrow (P \Rightarrow Q \Rightarrow R)$ (currying)
3. $P \lor Q \Rightarrow Q \lor P$ (commutativity of disjunction)
4. $\neg(P \lor Q) \Leftrightarrow \neg P \land \neg Q$ (De Morgan, constructive direction)

Use the impredicative encodings of $\land$, $\lor$, $\neg$, $\bot$.

### Exercise 13.3

Show that $\text{Prop}$ in the CoC is **closed under implication**: if $P : \text{Prop}$ and $Q : \text{Prop}$, then $P \to Q : \text{Prop}$. Which rule of the PTS specification is used?

### Exercise 13.4

Explain why the Church encoding of Nat in $\text{Prop}$ does not support the induction principle, but the same encoding in $\text{Type}$ (with the rule $(\text{Type}, \text{Type}, \text{Type})$) supports recursion but still not dependent induction. What additional structure would be needed?

### Exercise 13.5

Given the PTS specification of the CoC, describe what terms are typeable that are *not* typeable in:

(a) System F (which has rules $\{(*, *, *), (\Box, *, *)\}$)

(b) $\lambda P$ (which has rules $\{(*, *, *), (*, \Box, \Box)\}$)

For each, give a concrete term that is typeable in the CoC but not in the restricted system.

### Exercise 13.6

Implement the NbE algorithm described in Section 9.3 for a fragment of the CoC with $\text{Prop}$, $\text{Type}$, Pi types, lambda, and application. Write a conversion checker and verify that $(\lambda x.\, x)\;(\lambda y.\, y) \equiv \lambda y.\, y$.

### Exercise 13.7

The **predicative** Calculus of Constructions (pCoC) replaces the rule $(\text{Type}, \text{Prop}, \text{Prop})$ with $(\text{Type}, \text{Prop}, \text{Type})$. Which of the following are still typeable in pCoC?

1. $\forall (X : \text{Prop}).\, X \to X$ (with type $\text{Prop}$)
2. $\forall (A : \text{Type}).\, A \to A$ (with type $\text{Type}$)
3. The Church encoding of $\bot$ as $\forall (X : \text{Prop}).\, X$
4. The Church encoding of Nat as $\forall (X : \text{Type}).\, X \to (X \to X) \to X$

### Exercise 13.8

Prove that in the CoC, the following types are logically equivalent (construct terms witnessing the equivalence in both directions):

1. $\forall (X : \text{Prop}).\, (P \to Q \to X) \to X$ and $P \times Q$ (where $\times$ uses the impredicative encoding).
2. $\forall (X : \text{Prop}).\, (P \to X) \to (Q \to X) \to X$ and $P + Q$ (where $+$ uses the impredicative encoding).

### Exercise 13.9

In the CIC, the **strict positivity condition** rejects the type:

$$\text{data Bad} = \text{mk} : (\text{Bad} \to \text{Bad}) \to \text{Bad}$$

Show that if this type were allowed, one could construct a non-terminating term, contradicting strong normalization. Specifically, define $\omega : \text{Bad}$ and show that $\omega$ reduces to itself.

### Exercise 13.10

Consider the problem of implementing a type checker for a fragment of the CoC in OCaml. The fragment has $\text{Prop}$, $\text{Type}$, Pi types, lambda, and application. Describe the key data structures (for syntax, values, and neutrals) and outline the main functions (eval, quote, conv, check, infer). How would you handle the two-sort system ($\text{Prop}$ and $\text{Type}$) in the sort rule?

### Exercise 13.11

Derive the following theorem of intuitionistic logic in the CoC:

$$\forall P\, Q\, R : \text{Prop}.\, (P \to Q) \to (Q \to R) \to (P \to R)$$

Write out the complete term and verify it type-checks by tracing through the typing rules.

### Exercise 13.12

In the CoC with $\text{Prop}$ and $\text{Type}$, show that the type $\forall (P : \text{Prop}).\, P \to P$ has exactly one inhabitant (up to definitional equality). Then show that $\forall (A : \text{Type}).\, A \to A$ also has exactly one inhabitant. (Hint: parametricity, applied to the CoC.)

### Exercise 13.13

Explain why the following is *not* a valid inductive type in CIC:

$$\text{data U} = \text{mkU} : (\text{U} \to \text{Prop}) \to \text{U}$$

Even though $\text{U}$ appears only once on the left of $\to$ (which might seem "positive"), this is not *strictly* positive because $\text{U}$ appears in a negative position within the argument type. Relate this to Girard's paradox and explain how it would allow encoding a type-in-type universe.

### Exercise 13.14

The **Calculus of Constructions with universes** (CC$\omega$) has the PTS specification:

$$\mathcal{S} = \{\text{Prop}, \text{Type}_0, \text{Type}_1, \text{Type}_2, \ldots\}$$

$$\mathcal{A} = \{(\text{Prop}, \text{Type}_0), (\text{Type}_i, \text{Type}_{i+1}) \mid i \geq 0\}$$

$$\mathcal{R} = \{(s_1, s_2, s_2) \mid s_1, s_2 \in \mathcal{S}\} \cup \{(\text{Type}_i, \text{Prop}, \text{Prop}) \mid i \geq 0\}$$

Verify that:

(a) $\text{Prop}$ is impredicative: $\forall (X : \text{Prop}).\, P(X) : \text{Prop}$.

(b) The $\text{Type}_i$ hierarchy is predicative: $\forall (A : \text{Type}_i).\, B(A) : \text{Type}_i$ only when $B(A) : \text{Type}_i$.

(c) Quantifying over types at level $i$ in a $\text{Prop}$-valued family stays in $\text{Prop}$.

---

## Summary

- The **Calculus of Constructions** (CoC) sits at the apex of the lambda cube, combining polymorphism, type operators, and dependent types using a single Pi type constructor.
- The CoC has two sorts, $\text{Prop}$ and $\text{Type}$, with four rules governing Pi type formation. The rule $(\text{Type}, \text{Prop}, \text{Prop})$ makes $\text{Prop}$ **impredicative**.
- Impredicativity enables Church-style encodings of logical connectives and data types within the CoC, but these encodings lack dependent elimination (induction).
- The CoC is **strongly normalizing**: every well-typed term has a normal form. This ensures decidable type checking and consistency.
- The **Calculus of Inductive Constructions** (CIC) extends the CoC with primitive inductive types (satisfying strict positivity), providing dependent elimination. CIC is the foundation of Coq/Rocq.
- **Lean 4** is based on a CIC variant with quotient types and definitional proof irrelevance.
- Practical type checking uses **bidirectional type checking** with **normalization by evaluation (NbE)** for efficient conversion checking.
- The CoC is an instance of the **Pure Type System** framework, which unifies the presentation of all lambda cube systems.

---

## Further Reading

1. **Coquand, T. and Huet, G.** (1988). "The Calculus of Constructions." *Information and Computation*, 76(2-3):95--120. The original paper.

2. **Coquand, T. and Paulin, C.** (1990). "Inductively Defined Types." In *COLOG-88*, LNCS 417. Introduces the Calculus of Inductive Constructions.

3. **Werner, B.** (1994). *Une Theorie des Constructions Inductives*. PhD thesis, Universite Paris 7. The definitive metatheory of CIC.

4. **Barendregt, H.** (1991). "Introduction to Generalized Type Systems." *Journal of Functional Programming*, 1(2):125--154. The PTS framework.

5. **Coquand, T. and Gallier, J.** (1990). "A Proof of Strong Normalization for the Theory of Constructions Using a Kripke-Like Interpretation." Unpublished manuscript, later included in various collections.

6. **Luo, Z.** (1989). "ECC, an Extended Calculus of Constructions." In *LICS 1989*.

7. **The Coq Development Team.** (2024). *The Coq Reference Manual*. Available at https://coq.inria.fr/refman/. The definitive documentation for Coq's type theory.

8. **de Moura, L. and Ullrich, S.** (2021). "The Lean 4 Theorem Prover and Programming Language." In *CADE-28*. Introduction to Lean 4's foundations.

9. **Berger, U. and Schwichtenberg, H.** (1991). "An Inverse of the Evaluation Functional for Typed Lambda-Calculus." In *LICS 1991*. The original NbE paper.

10. **Abel, A.** (2013). "Normalization by Evaluation: Dependent Types and Impredicativity." Habilitation thesis, LMU Munich. The comprehensive treatment of NbE for dependent types.

11. **Cohen, C., Coquand, T., Huber, S., and Mortberg, A.** (2018). "Cubical Type Theory: A Constructive Interpretation of the Univalence Axiom." *Journal of Automated Reasoning*, 60(2):155--184.

12. **Altenkirch, T., McBride, C., and Swierstra, W.** (2007). "Observational Equality, Now!" In *PLPV 2007*.
