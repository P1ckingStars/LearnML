---
title: "Lecture 07d: The Lambda Cube and Pure Type Systems"
tags:
  - type-theory
  - lambda-cube
  - lecture
---
# Lecture 07d: The Lambda Cube and Pure Type Systems

> **Module 07 --- Higher-Order Types & the Lambda Cube (Weeks 13--14)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe the three axes of the lambda cube (terms depending on types, types depending on types, types depending on terms) and identify the eight systems at its vertices.
2. Define the syntax and rules of each lambda cube system and explain what each axis contributes.
3. Formulate Pure Type Systems (PTS) as a uniform framework parameterized by sorts, axioms, and rules.
4. Specify each lambda cube system as a PTS by giving its specification triple $(\mathcal{S}, \mathcal{A}, \mathcal{R})$.
5. State the key metatheoretic properties (strong normalization, subject reduction, decidability of type checking) for PTS instances on the lambda cube.
6. Describe Automath and the Edinburgh Logical Framework (LF) as historically significant dependent type systems.
7. Explain how the Calculus of Constructions unifies all three axes.
8. Relate the lambda cube to modern proof assistants and programming languages.

---

## 1. Motivation

### 1.1 A Map of Type Systems

Over the past six lectures, we have studied a progression of increasingly expressive type systems:

| System | Key feature | Reference |
|--------|------------|-----------|
| STLC ($\lambda{\to}$) | Simply-typed functions | Module 02 |
| System F ($\lambda 2$) | Parametric polymorphism | Module 06 |
| $F_\omega$ ($\lambda\omega$) | Type operators | Lectures 07a--07b |
| $F_{<:}$ | Bounded quantification | Lecture 07c |

Each system extends the previous with a new capability. But these extensions are not arbitrary: they follow a systematic pattern that Henk Barendregt identified in 1991.

### 1.2 The Key Question

The fundamental observation is that a typed lambda calculus involves two kinds of entities --- *terms* and *types* --- and functions between them. There are exactly four possible dependency directions:

| Dependency | Meaning | Example |
|-----------|---------|---------|
| Terms depending on terms | Ordinary functions | $\lambda x : A.\; e$ |
| Terms depending on types | Polymorphism | $\Lambda X.\; e$ |
| Types depending on types | Type operators | $\lambda X :: K.\; T$ |
| Types depending on terms | Dependent types | $\Pi x : A.\; B(x)$ |

The first dependency (terms on terms) is present in every lambda calculus. The remaining three can be independently enabled or disabled, giving $2^3 = 8$ possible combinations. These eight systems form the vertices of a cube: the *lambda cube*.

### 1.3 Historical Context

| Year | Contributor | System |
|------|-----------|--------|
| 1967 | de Bruijn | Automath: first dependent types for mathematics |
| 1971 | Martin-L\"{o}f | Intuitionistic type theory |
| 1972 | Girard | System F (polymorphic lambda calculus) |
| 1985 | Coquand & Huet | Calculus of Constructions |
| 1986 | Harper, Honsell & Plotkin | Edinburgh Logical Framework (LF) |
| 1991 | Barendregt | Lambda cube; Pure Type Systems |

---

## 2. The Lambda Cube

### 2.1 The Three Axes

We label the three axes as follows:

1. **Axis 1: Terms depending on types** ($\lambda 2$ direction). Enables polymorphism: terms can abstract over type parameters via $\Lambda X.\; e$, and types include $\forall X.\; T$.

2. **Axis 2: Types depending on types** ($\lambda\underline{\omega}$ direction). Enables type operators: types can abstract over type parameters via $\lambda X :: K.\; T$, and kinds include $K_1 \Rightarrow K_2$.

3. **Axis 3: Types depending on terms** ($\lambda P$ direction). Enables dependent types: types can contain terms, so the type of the output can depend on the *value* of the input. The function type generalizes to $\Pi x : A.\; B(x)$.

### 2.2 The Eight Systems

The eight vertices of the cube are:

$$
\begin{array}{|c|c|c|c|c|}
\hline
\text{System} & \text{Terms} \to \text{Types} & \text{Types} \to \text{Types} & \text{Types} \to \text{Terms} & \text{Name} \\
\hline
\lambda{\to} & \text{No} & \text{No} & \text{No} & \text{Simply-typed } \lambda \text{-calculus} \\
\lambda 2 & \text{Yes} & \text{No} & \text{No} & \text{System F} \\
\lambda\underline{\omega} & \text{No} & \text{Yes} & \text{No} & \text{Type operators only} \\
\lambda\omega & \text{Yes} & \text{Yes} & \text{No} & \text{System } F_\omega \\
\lambda P & \text{No} & \text{No} & \text{Yes} & \text{LF (dependent types only)} \\
\lambda P2 & \text{Yes} & \text{No} & \text{Yes} & \text{System } F \text{ + dependent types} \\
\lambda P\underline{\omega} & \text{No} & \text{Yes} & \text{Yes} & \text{Dependent type operators} \\
\lambda C & \text{Yes} & \text{Yes} & \text{Yes} & \text{Calculus of Constructions} \\
\hline
\end{array}
$$

**Note on terminology:** The column header "Terms $\to$ Types" means "terms depending on types" (polymorphism), not "functions from terms to types." Similarly for the other headers.

### 2.3 The Cube Diagram

The lambda cube is conventionally drawn as:

```
          lambda P_omega --------- lambda C
         /|                       /|
        / |                      / |
       /  |                     /  |
  lambda P ------------ lambda P2  |
      |   |                 |   |
      |   lambda_omega ---- | -- lambda omega
      |  /                  |  /
      | /                   | /
      |/                    |/
  lambda_arrow ------- lambda 2
```

The bottom-left vertex is $\lambda{\to}$ (STLC). Moving right adds polymorphism. Moving up adds dependent types. Moving into the page (depth) adds type operators.

Each edge represents adding one axis:
- Horizontal edges: add polymorphism (terms $\to$ types).
- Vertical edges: add dependent types (types $\to$ terms).
- Depth edges: add type operators (types $\to$ types).

---

## 3. The Systems in Detail

### 3.1 $\lambda{\to}$: The Simply-Typed Lambda Calculus

**Types:** $T ::= A \mid T_1 \to T_2$ (base types and function types).

**Terms:** $e ::= x \mid \lambda x : T.\; e \mid e_1\; e_2$.

**Typing rules:**

$$
\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \qquad
\frac{\Gamma, x : A \vdash e : B}{\Gamma \vdash \lambda x : A.\; e : A \to B} \qquad
\frac{\Gamma \vdash e_1 : A \to B \quad \Gamma \vdash e_2 : A}{\Gamma \vdash e_1\; e_2 : B}
$$

**Properties:** Strong normalization, decidable type checking and type inference, no type-level computation.

**Curry--Howard:** Corresponds to intuitionistic propositional logic with implication only.

### 3.2 $\lambda 2$: System F

**Extension:** Add type variables, universal quantification, and type abstraction/application.

**Types:** $T ::= X \mid T_1 \to T_2 \mid \forall X.\; T$

**Terms:** $e ::= \ldots \mid \Lambda X.\; e \mid e\;[T]$

**New typing rules:**

$$
\frac{\Gamma, X\;\text{type} \vdash e : T}{\Gamma \vdash \Lambda X.\; e : \forall X.\; T} \qquad
\frac{\Gamma \vdash e : \forall X.\; T}{\Gamma \vdash e\;[S] : [X \mapsto S]T}
$$

**Properties:** Strong normalization, decidable type checking, undecidable type inference (Wells, 1999).

**Curry--Howard:** Corresponds to second-order intuitionistic propositional logic (quantification over propositions).

### 3.3 $\lambda\underline{\omega}$: Type Operators Without Polymorphism

**Extension over $\lambda{\to}$:** Add type-level abstraction and application, and a kind system.

**Kinds:** $K ::= * \mid K_1 \Rightarrow K_2$

**Types:** $T ::= X \mid T_1 \to T_2 \mid \lambda X :: K.\; T \mid T_1\; T_2$

Note: there is *no* $\forall X.\; T$ or $\Lambda X.\; e$. Terms cannot abstract over types. Only types can abstract over types.

**Kinding rules:** Exactly as in Lecture 07a.

**Properties:** The term-level language is essentially STLC (with more complex types). Strong normalization at both levels.

This system is rarely used in isolation. Its significance is primarily as a vertex of the lambda cube that clarifies the independence of the type-operators axis from the polymorphism axis.

### 3.4 $\lambda\omega$: System $F_\omega$

**Extension:** Combine $\lambda 2$ and $\lambda\underline{\omega}$. This is the system of Lecture 07b.

**Types:** $T ::= X \mid T_1 \to T_2 \mid \forall X :: K.\; T \mid \lambda X :: K.\; T \mid T_1\; T_2$

**Terms:** $e ::= x \mid \lambda x : T.\; e \mid e_1\; e_2 \mid \Lambda X :: K.\; e \mid e\;[T]$

**Properties:** Strong normalization at both term and type levels, decidable type checking, undecidable type inference.

### 3.5 $\lambda P$: The Logical Framework (LF)

**Extension over $\lambda{\to}$:** Types can depend on terms. The function type $A \to B$ generalizes to the *dependent function type* $\Pi x : A.\; B$, where the return type $B$ may mention the input variable $x$.

**Sorts:** $\mathcal{S} = \{*, \Box\}$ where $* :: \Box$.

**Expressions (unified):**

$$
e ::= x \mid s \mid \Pi x : e_1.\; e_2 \mid \lambda x : e_1.\; e_2 \mid e_1\; e_2
$$

where $s \in \{*, \Box\}$.

Note: in $\lambda P$, there is no separate syntax for types and terms. The expression language is *unified*; the sort system determines which expressions are types, which are kinds, and which are terms.

**Key rule (Dependent Product):**

$$
\frac{\Gamma \vdash A : * \qquad \Gamma, x : A \vdash B : *}{\Gamma \vdash \Pi x : A.\; B : *}
$$

This says: if $A$ is a type and $B$ is a type (possibly mentioning $x : A$), then $\Pi x : A.\; B$ is a type.

When $x \notin \text{FV}(B)$, we recover the ordinary function type: $\Pi x : A.\; B = A \to B$.

**Example.** The type of a function that returns a vector of length $n$:

$$
\Pi n : \text{Nat}.\; \text{Vec}\; A\; n
$$

The return type $\text{Vec}\; A\; n$ depends on the input value $n$.

**Historical note.** The name "LF" comes from the Edinburgh Logical Framework of Harper, Honsell, and Plotkin (1993). The system $\lambda P$ is the type-theoretic core of LF, designed for encoding logics and proof systems.

**Curry--Howard:** Corresponds to first-order intuitionistic predicate logic (quantification over individuals, not propositions).

### 3.6 $\lambda P2$: Polymorphism + Dependent Types

**Extension:** Combine $\lambda 2$ and $\lambda P$. Terms can depend on types (polymorphism), and types can depend on terms (dependent types).

This system is rarely discussed in isolation. It allows both $\forall X.\; T$ (quantifying over types in a type) and $\Pi x : A.\; B$ (types depending on terms).

**Curry--Howard:** Corresponds to second-order predicate logic.

### 3.7 $\lambda P\underline{\omega}$: Dependent Type Operators

**Extension:** Combine $\lambda\underline{\omega}$ and $\lambda P$. Types can depend on types (type operators), and types can depend on terms (dependent types). But terms cannot depend on types (no polymorphism).

**Curry--Howard:** Corresponds to a higher-order predicate logic without quantification over propositions (but with quantification over predicates and over individuals).

### 3.8 $\lambda C$: The Calculus of Constructions

**Extension:** All three axes enabled simultaneously. This is the most expressive system in the lambda cube.

- Terms depend on terms (ordinary functions).
- Terms depend on types (polymorphism).
- Types depend on types (type operators).
- Types depend on terms (dependent types).

The Calculus of Constructions (CoC) was introduced by Coquand and Huet (1985, 1988). It is the foundational calculus of the Coq (now Rocq) proof assistant.

**Key features:**

1. **Unified syntax.** There is no separate syntax for terms, types, and kinds. Everything is an *expression*, classified by sorts.

2. **Two sorts.** $* : \Box$. The sort $*$ classifies types of terms (propositions). The sort $\Box$ classifies types of types (the universe of types).

3. **Impredicativity.** $\forall X : *.\; T : *$ --- quantifying over all types produces a type. This is *impredicative* because the quantification ranges over a domain that includes the type being defined.

**Curry--Howard:** Corresponds to the Calculus of Constructions --- a higher-order intuitionistic predicate logic with quantification over both propositions and individuals, and predicates of all orders.

---

## 4. Pure Type Systems

### 4.1 Motivation

The eight lambda cube systems share a common structure: they all involve expressions that can be classified by other expressions, with $\Pi$-types (dependent function types) as the central abstraction mechanism. Pure Type Systems (PTS) capture this common structure in a single parameterized framework.

### 4.2 Definition

**Definition 4.1 (Pure Type System).** A Pure Type System is specified by a triple $(\mathcal{S}, \mathcal{A}, \mathcal{R})$ where:

- $\mathcal{S}$ is a set of *sorts* (the top-level classifiers).
- $\mathcal{A} \subseteq \mathcal{S} \times \mathcal{S}$ is a set of *axioms* (which sorts are classified by which sorts).
- $\mathcal{R} \subseteq \mathcal{S} \times \mathcal{S} \times \mathcal{S}$ is a set of *rules* (which product types are allowed).

**Definition 4.2 (Syntax of a PTS).** The unified expression language is:

$$
e ::= x \mid s \mid \Pi x : e_1.\; e_2 \mid \lambda x : e_1.\; e_2 \mid e_1\; e_2
$$

where $s \in \mathcal{S}$ is a sort and $x$ is a variable.

**Definition 4.3 (Contexts).**

$$
\Gamma ::= \emptyset \mid \Gamma, x : e
$$

A context is well-formed if each type annotation is itself well-sorted.

### 4.3 Typing Rules of a PTS

**Rule (Axiom).**

$$
\frac{(s_1, s_2) \in \mathcal{A}}{\emptyset \vdash s_1 : s_2} \quad (\text{Axiom})
$$

**Rule (Variable).**

$$
\frac{\Gamma \vdash A : s \qquad x \notin \text{dom}(\Gamma)}{\Gamma, x : A \vdash x : A} \quad (\text{Var})
$$

**Rule (Weakening).**

$$
\frac{\Gamma \vdash e : B \qquad \Gamma \vdash A : s \qquad x \notin \text{dom}(\Gamma)}{\Gamma, x : A \vdash e : B} \quad (\text{Weak})
$$

**Rule (Product).**

$$
\frac{\Gamma \vdash A : s_1 \qquad \Gamma, x : A \vdash B : s_2 \qquad (s_1, s_2, s_3) \in \mathcal{R}}{\Gamma \vdash (\Pi x : A.\; B) : s_3} \quad (\text{Prod})
$$

This is the central rule. It says: if $A$ is classified by sort $s_1$ and $B$ (possibly depending on $x : A$) is classified by sort $s_2$, and the rule $(s_1, s_2, s_3)$ is allowed, then $\Pi x : A.\; B$ is classified by sort $s_3$.

The triple $(s_1, s_2, s_3)$ controls which kinds of dependencies are allowed:
- $(*, *, *)$: terms depending on terms (ordinary functions).
- $(*, \Box, \Box)$: types depending on terms (dependent types).
- $(\Box, *, *)$: terms depending on types (polymorphism).
- $(\Box, \Box, \Box)$: types depending on types (type operators).

**Rule (Abstraction).**

$$
\frac{\Gamma, x : A \vdash e : B \qquad \Gamma \vdash (\Pi x : A.\; B) : s}{\Gamma \vdash (\lambda x : A.\; e) : \Pi x : A.\; B} \quad (\text{Abs})
$$

**Rule (Application).**

$$
\frac{\Gamma \vdash e_1 : \Pi x : A.\; B \qquad \Gamma \vdash e_2 : A}{\Gamma \vdash e_1\; e_2 : [x \mapsto e_2]B} \quad (\text{App})
$$

**Rule (Conversion).**

$$
\frac{\Gamma \vdash e : A \qquad \Gamma \vdash B : s \qquad A =_\beta B}{\Gamma \vdash e : B} \quad (\text{Conv})
$$

Two types are interchangeable if they are beta-equivalent.

### 4.4 The Lambda Cube as PTS Specifications

For all lambda cube systems: $\mathcal{S} = \{*, \Box\}$, $\mathcal{A} = \{(*, \Box)\}$.

The eight systems differ only in $\mathcal{R}$:

$$
\begin{array}{|l|l|}
\hline
\text{System} & \mathcal{R} \\
\hline
\lambda{\to} & \{(*, *, *)\} \\
\lambda 2 & \{(*, *, *),\; (\Box, *, *)\} \\
\lambda\underline{\omega} & \{(*, *, *),\; (\Box, \Box, \Box)\} \\
\lambda\omega & \{(*, *, *),\; (\Box, *, *),\; (\Box, \Box, \Box)\} \\
\lambda P & \{(*, *, *),\; (*, \Box, \Box)\} \\
\lambda P2 & \{(*, *, *),\; (\Box, *, *),\; (*, \Box, \Box)\} \\
\lambda P\underline{\omega} & \{(*, *, *),\; (\Box, \Box, \Box),\; (*, \Box, \Box)\} \\
\lambda C & \{(*, *, *),\; (\Box, *, *),\; (\Box, \Box, \Box),\; (*, \Box, \Box)\} \\
\hline
\end{array}
$$

**Reading the rules:**

- $(*, *, *)$: If $A : *$ and $B : *$, then $\Pi x : A.\; B : *$. This is the ordinary function type: terms to terms.

- $(\Box, *, *)$: If $A : \Box$ (i.e., $A$ is a type of types, i.e., $A$ is a kind) and $B : *$, then $\Pi X : A.\; B : *$. This is polymorphism: $\forall X : *.\; B$ is a type.

- $(\Box, \Box, \Box)$: If $A : \Box$ and $B : \Box$, then $\Pi X : A.\; B : \Box$. This is type operators: $\lambda X : *.\; T$ where the result is a kind-level entity.

- $(*, \Box, \Box)$: If $A : *$ and $B : \Box$, then $\Pi x : A.\; B : \Box$. This is dependent types at the kind level: a kind that depends on a term.

### 4.5 Verifying the Correspondence

**Example: $\lambda 2$ (System F).**

$\mathcal{R} = \{(*, *, *), (\Box, *, *)\}$.

The rule $(*, *, *)$ gives ordinary function types:

$$
\frac{\Gamma \vdash A : * \qquad \Gamma, x : A \vdash B : *}{\Gamma \vdash \Pi x : A.\; B : *}
$$

When $x \notin \text{FV}(B)$, this is $A \to B : *$.

The rule $(\Box, *, *)$ gives universal types:

$$
\frac{\Gamma \vdash * : \Box \qquad \Gamma, X : * \vdash B : *}{\Gamma \vdash \Pi X : *.\; B : *}
$$

This is $\forall X : *.\; B : *$. The type $\forall X : *.\; X \to X$ classifies the polymorphic identity.

**Example: $\lambda P$ (LF).**

$\mathcal{R} = \{(*, *, *), (*, \Box, \Box)\}$.

The rule $(*, *, *)$ gives ordinary function types (as above).

The rule $(*, \Box, \Box)$ gives *dependent kinds*:

$$
\frac{\Gamma \vdash A : * \qquad \Gamma, x : A \vdash B : \Box}{\Gamma \vdash \Pi x : A.\; B : \Box}
$$

Example: $\Pi n : \text{Nat}.\; *$ is a kind (an element of $\Box$) that maps each natural number to a type. This is how we classify "type families indexed by terms."

Note that $\lambda P$ does *not* have polymorphism: $(\Box, *, *)$ is absent from $\mathcal{R}$.

**Example: $\lambda C$ (Calculus of Constructions).**

$\mathcal{R} = \{(*, *, *), (\Box, *, *), (\Box, \Box, \Box), (*, \Box, \Box)\}$.

All four rules are present, so all four dependencies are enabled.

---

## 5. Metatheory of Pure Type Systems

### 5.1 General Properties

Not all PTS specifications yield well-behaved systems. The following properties hold for all lambda cube systems (and more generally for a wide class of PTS called "functional" PTS):

**Theorem 5.1 (Subject Reduction).** For all lambda cube systems: if $\Gamma \vdash e : A$ and $e \longrightarrow_\beta e'$, then $\Gamma \vdash e' : A$.

*Proof.* By induction on the typing derivation, using the Substitution Lemma and the fact that beta-equivalent types are interchangeable (the Conv rule). $\square$

**Theorem 5.2 (Uniqueness of Types, up to $\beta$-equivalence).** For all lambda cube systems: if $\Gamma \vdash e : A$ and $\Gamma \vdash e : B$, then $A =_\beta B$.

*Proof.* By induction on the structure of $e$, using the Church--Rosser property. This holds for all *functional* PTS --- those where each axiom and each rule specification uniquely determines the output sort. $\square$

**Theorem 5.3 (Strong Normalization).** For all eight lambda cube systems, every well-typed expression is strongly normalizing.

*Proof.* This is a deep result. For individual systems:
- $\lambda{\to}$: Tait (1967), logical relations.
- $\lambda 2$: Girard (1972), reducibility candidates.
- $\lambda\omega$: Girard (1972), extended reducibility candidates.
- $\lambda C$: Coquand (1986), Geuvers and Nederhof (1991).

For the general case, Berardi (1990) and Geuvers (1993) gave proofs for broad classes of PTS. $\square$

**Corollary 5.4.** Type checking is decidable for all eight lambda cube systems.

*Proof.* Type checking involves:
1. Constructing a typing derivation (syntax-directed once the Conv rule strategy is fixed).
2. Checking beta-equivalence (which is decidable because strong normalization gives a finite normalization procedure). $\square$

### 5.2 Consistency

**Theorem 5.5 (Logical Consistency).** The lambda cube systems (without added axioms for general recursion) are logically consistent: there is no closed term of type $\forall X : *.\; X$ (the empty type / falsity).

*Proof.* Follows from strong normalization. If there were a closed proof of falsity, it would be a normal form of type $\forall X : *.\; X$, but inspection of the normal forms shows no such term exists. $\square$

**Remark.** Adding a fixpoint combinator ($\text{fix} : (A \to A) \to A$) destroys both strong normalization and consistency. This is why proof assistants based on dependent types (Coq, Agda, Lean) use *structural recursion* instead of general recursion.

### 5.3 Beyond the Lambda Cube

The PTS framework accommodates systems beyond the lambda cube:

**Example 5.6 (System $U^-$).** Take $\mathcal{S} = \{*, \Box, \triangle\}$, $\mathcal{A} = \{(*, \Box), (\Box, \triangle)\}$, and include the rule $(\Box, \Box, \Box)$ along with others. This introduces a hierarchy of universes.

**Example 5.7 (Girard's Paradox).** The system $U$ with $\mathcal{S} = \{*, \Box\}$, $\mathcal{A} = \{(*, \Box)\}$, $\mathcal{R} = \{(*, *, *), (\Box, *, *), (\Box, \Box, \Box), (*, \Box, *)\}$ is *inconsistent*. The rule $(*, \Box, *)$ says: if $A : *$ and $B : \Box$ (depending on $x : A$), then $\Pi x : A.\; B : *$ --- a type-level function that maps terms to types is itself a type (not a kind). This is "type-in-type" ($* : *$ effectively), and Girard showed it leads to a paradox analogous to Russell's paradox.

**Lesson:** The rule set $\mathcal{R}$ must be chosen carefully. The lambda cube systems are precisely the well-behaved combinations.

---

## 6. Automath

### 6.1 de Bruijn's Vision

In 1967, Nicolaas Govert de Bruijn began the Automath project at Eindhoven with the goal of formalizing all of mathematics in a single formal system. Automath was the first system to use *dependent types* for this purpose.

### 6.2 Key Ideas

1. **Books and lines.** An Automath text is a sequence of *lines*, each introducing a new constant with its type. A *book* is a complete formalization.

2. **Contexts as telescopes.** A context is a sequence of variable declarations, each of which may depend on previous variables:

$$
(x_1 : A_1,\; x_2 : A_2(x_1),\; x_3 : A_3(x_1, x_2),\; \ldots)
$$

3. **Propositions as types.** Automath pioneered the use of the Curry--Howard correspondence at scale: a proposition is a type, and a proof is a term of that type.

4. **De Bruijn indices.** To avoid the complications of alpha-equivalence, de Bruijn introduced *nameless representations* of bound variables: instead of names, each variable is represented by a natural number indicating how many binders are crossed to reach its binding site. This innovation is now standard in implementations of type theory.

### 6.3 Automath as a PTS

Automath can be approximated as a PTS with:

- $\mathcal{S} = \{*, \Box\}$
- $\mathcal{A} = \{(*, \Box)\}$
- $\mathcal{R} = \{(*, *, *), (*, \Box, \Box)\}$

This is exactly $\lambda P$. In practice, Automath had additional features (definitions, reduction strategies) but its type-theoretic core is $\lambda P$.

---

## 7. The Edinburgh Logical Framework (LF)

### 7.1 Overview

The Edinburgh Logical Framework (Harper, Honsell, and Plotkin, 1993) is a *meta-logical framework*: a type theory designed to encode other logics and type systems. Its core calculus is $\lambda P$ (the dependent function type system).

### 7.2 The Adequacy Methodology

LF uses a methodology called *adequacy*: a logic or type system is encoded in LF in such a way that there is a bijection between:

- Valid derivations in the object logic.
- Well-typed LF terms (in canonical form) of a specific type.

### 7.3 Encoding Natural Deduction

As an example, consider encoding natural deduction for propositional logic in LF.

**Step 1: Declare the object-level types.**

$$
o : * \qquad \text{(the type of propositions)}
$$

$$
\text{pf} : o \to * \qquad \text{(the type family of proofs)}
$$

**Step 2: Declare the connectives.**

$$
\text{imp} : o \to o \to o \qquad \text{(implication)}
$$

$$
\text{and} : o \to o \to o \qquad \text{(conjunction)}
$$

**Step 3: Declare the inference rules.**

Implication introduction:

$$
\text{imp\_intro} : \Pi A : o.\; \Pi B : o.\; (\text{pf}\; A \to \text{pf}\; B) \to \text{pf}\;(\text{imp}\; A\; B)
$$

Implication elimination (modus ponens):

$$
\text{imp\_elim} : \Pi A : o.\; \Pi B : o.\; \text{pf}\;(\text{imp}\; A\; B) \to \text{pf}\; A \to \text{pf}\; B
$$

**Step 4: Construct proofs.**

A proof of $A \Rightarrow A$:

$$
\text{imp\_intro}\; A\; A\; (\lambda p : \text{pf}\; A.\; p) \quad : \quad \text{pf}\;(\text{imp}\; A\; A)
$$

The type of this term is $\text{pf}\;(\text{imp}\; A\; A)$, which represents the proposition $A \Rightarrow A$. The term itself is the proof: assume $A$ (bind a proof $p$), then return $p$.

### 7.4 Higher-Order Abstract Syntax (HOAS)

A key technique in LF is *higher-order abstract syntax*: object-level binding is represented by meta-level (LF-level) binding.

In the implication introduction rule above, the premise $\text{pf}\; A \to \text{pf}\; B$ uses LF's function type to represent the *hypothetical judgment* "assuming a proof of $A$, we can construct a proof of $B$." The bound variable (the assumption) is represented by an LF-level lambda abstraction.

This avoids the need to define substitution and alpha-equivalence at the object level: they are inherited from LF's own substitution and alpha-equivalence.

### 7.5 Implementations

LF is implemented in several systems:

- **Twelf** (Pfenning and Schurmann, 1999): a logic programming language based on LF.
- **Beluga** (Pientka, 2008): extends LF with contextual types.
- **Delphin** (Poswolsky and Schurmann, 2009): extends Twelf with functional programming.

---

## 8. The Calculus of Constructions

### 8.1 Full Specification

As a PTS:

$$
\mathcal{S} = \{*, \Box\} \qquad \mathcal{A} = \{(*, \Box)\} \qquad \mathcal{R} = \{(*, *, *),\; (\Box, *, *),\; (\Box, \Box, \Box),\; (*, \Box, \Box)\}
$$

### 8.2 Impredicativity

The rule $(\Box, *, *)$ says: $\Pi X : *.\; B : *$ when $B : *$. This means that a type like $\forall X : *.\; X \to X$ is itself of sort $*$ --- it is a "small" type, even though it quantifies over *all* types including itself. This is *impredicativity*.

Impredicativity is powerful (it allows Church encodings of inductive types) but problematic for set-theoretic semantics. The Calculus of Inductive Constructions (CIC), used in Coq/Rocq, restricts impredicativity to the sort $\text{Prop}$ while keeping the sort $\text{Set}$ predicative.

### 8.3 Universes

The CoC has only two sorts. In practice, proof assistants use a hierarchy of universes:

$$
\text{Prop} : \text{Type}_0 : \text{Type}_1 : \text{Type}_2 : \cdots
$$

This avoids Girard's paradox while providing enough expressiveness. The hierarchy is *cumulative*: $\text{Type}_i <: \text{Type}_{i+1}$.

Agda and Lean use a predicative hierarchy of universes throughout. Coq/Rocq uses impredicative $\text{Prop}$ and predicative $\text{Type}_i$.

### 8.4 From CoC to CIC

The Calculus of Inductive Constructions extends CoC with:

1. **Inductive types** (Paulin-Mohring, 1993): datatypes defined by constructors and eliminated by pattern matching / recursion. This replaces the need for Church encodings.

2. **A universe hierarchy**: $\text{Prop}, \text{Set}, \text{Type}_1, \text{Type}_2, \ldots$

3. **Definitional equality** extended with $\iota$-reduction (computation rules for inductive types) and $\delta$-reduction (unfolding definitions).

CIC is the foundation of the Coq/Rocq proof assistant.

### 8.5 The Correspondence with Logic

| Lambda Cube System | Logic |
|-------------------|-------|
| $\lambda{\to}$ | Propositional logic (implication only) |
| $\lambda 2$ | Second-order propositional logic |
| $\lambda P$ | First-order predicate logic |
| $\lambda P2$ | Second-order predicate logic |
| $\lambda\omega$ | Higher-order propositional logic (weak) |
| $\lambda P\underline{\omega}$ | Higher-order predicate logic (weak) |
| $\lambda C$ | Higher-order predicate logic (full) |

"Higher-order" here means quantification over predicates and functions of all types. "Full" means quantification over both individuals and propositions.

---

## 9. Modern Realizations

### 9.1 Proof Assistants

| Proof Assistant | Core Calculus | Key Features |
|----------------|--------------|--------------|
| Coq/Rocq | CIC ($\lambda C$ + inductive types + universes) | Impredicative Prop, universe polymorphism |
| Agda | Martin-L\"{o}f type theory (predicative) | Universe polymorphism, no tactics |
| Lean 4 | CIC variant (predicative, quotient types) | Efficient kernel, metaprogramming |
| Idris 2 | Quantitative type theory | Linear types + dependent types |
| $\text{F}^*$ | Dependent + effect types | Proof-producing programming |

### 9.2 Programming Languages

| Language | Lambda Cube Position | Notes |
|---------|---------------------|-------|
| Haskell | $\lambda\omega$ (approximately) | Higher-kinded types; no dependent types (without extensions) |
| OCaml | $\lambda{\to}$ + let-polymorphism | Hindley--Milner; modules approximate type operators |
| Scala 3 | Between $\lambda\omega$ and $\lambda C$ | Match types, opaque types |
| Rust | $\lambda{\to}$ (approximately) | Trait system; no higher-kinded types |
| TypeScript | $\lambda\omega$ (approximately) | Conditional types approximate type operators |

### 9.3 The Trend Toward Dependent Types

There is a clear historical trend of programming languages moving "up and to the left" in the lambda cube:

1. **1970s--1980s**: STLC with let-polymorphism (ML, Haskell 1.0).
2. **1990s--2000s**: Higher-kinded types, GADTs (Haskell with extensions).
3. **2010s--2020s**: Dependent types in programming (Idris, Agda, Lean, dependent Haskell proposals).

The challenge is that full dependent types ($\lambda C$) make type checking more complex and require the programmer to provide more annotations (or the system to perform more inference).

---

## 10. Preview: Dependent Types (Module 08)

The lambda cube reveals that dependent types ($\lambda P$ and its extensions) are the "missing dimension" in most mainstream programming languages. Module 08 will develop this dimension in detail:

- **Lecture 08a**: Dependent function types ($\Pi$-types) and their role in specifying precise contracts.
- **Lecture 08b**: Dependent pair types ($\Sigma$-types) and their use for existential types, refinement types, and subset types.
- **Lecture 08c**: Martin-L\"{o}f type theory: identity types, universes, induction principles.
- **Lecture 08d**: The Calculus of Constructions and its extensions (CIC).

The key insight is that moving along the dependent-types axis allows types to express *properties of values*, turning the type checker into a theorem prover.

---

## 11. Worked PTS Derivation

### 11.1 The Identity Function in $\lambda 2$

We derive $\vdash \lambda X : *.\; \lambda x : X.\; x : \Pi X : *.\; X \to X$ in the PTS for $\lambda 2$.

Recall: $\mathcal{S} = \{*, \Box\}$, $\mathcal{A} = \{(*, \Box)\}$, $\mathcal{R} = \{(*, *, *), (\Box, *, *)\}$.

**Step 1.** Derive $\vdash * : \Box$ by the Axiom rule:

$$
\frac{(*, \Box) \in \mathcal{A}}{\vdash * : \Box} \quad (\text{Axiom})
$$

**Step 2.** Introduce $X : *$ into the context using the Var rule:

$$
\frac{\vdash * : \Box \qquad X \notin \text{dom}(\emptyset)}{X : * \vdash X : *} \quad (\text{Var})
$$

**Step 3.** Form the product type $\Pi x : X.\; X$ (which is $X \to X$ since $x$ does not appear in the codomain). We need $(*, *, *) \in \mathcal{R}$:

$$
\frac{X : * \vdash X : * \qquad X : *, x : X \vdash X : * \qquad (*, *, *) \in \mathcal{R}}{X : * \vdash \Pi x : X.\; X : *} \quad (\text{Prod})
$$

where $X : *, x : X \vdash X : *$ is obtained by Weakening:

$$
\frac{X : * \vdash X : * \qquad X : * \vdash X : * \qquad x \notin \text{dom}(X : *)}{X : *, x : X \vdash X : *} \quad (\text{Weak})
$$

**Step 4.** Derive the inner lambda:

$$
\frac{X : *, x : X \vdash x : X \qquad X : * \vdash \Pi x : X.\; X : *}{X : * \vdash \lambda x : X.\; x : \Pi x : X.\; X} \quad (\text{Abs})
$$

where $X : *, x : X \vdash x : X$ is by the Var rule.

**Step 5.** Form the outer product type $\Pi X : *.\; (X \to X)$. We need $(\Box, *, *) \in \mathcal{R}$:

$$
\frac{\vdash * : \Box \qquad X : * \vdash X \to X : * \qquad (\Box, *, *) \in \mathcal{R}}{\vdash \Pi X : *.\; (X \to X) : *} \quad (\text{Prod})
$$

**Step 6.** Derive the outer lambda:

$$
\frac{X : * \vdash \lambda x : X.\; x : X \to X \qquad \vdash \Pi X : *.\; (X \to X) : *}{\vdash \lambda X : *.\; \lambda x : X.\; x : \Pi X : *.\; X \to X} \quad (\text{Abs})
$$

This completes the derivation. $\square$

### 11.2 A Dependent Type in $\lambda P$

In $\lambda P$, we can derive types for terms that produce types. Consider the constant $\text{Vec} : * \to \text{Nat} \to *$ (a type family of vectors indexed by length).

The type $\Pi n : \text{Nat}.\; \text{Vec}\;\text{Bool}\;n$ is well-formed:

$$
\frac{
  \vdash \text{Nat} : * \qquad n : \text{Nat} \vdash \text{Vec}\;\text{Bool}\;n : * \qquad (*, *, *) \in \mathcal{R}
}{
  \vdash \Pi n : \text{Nat}.\; \text{Vec}\;\text{Bool}\;n : *
} \quad (\text{Prod})
$$

This is a proper type ($: *$) that classifies functions from natural numbers to vectors. Note how the rule $(*, *, *)$ is used: $\text{Nat} : *$ and $\text{Vec}\;\text{Bool}\;n : *$, so the product type has sort $*$.

The key point is that the *body type* $\text{Vec}\;\text{Bool}\;n$ mentions the *term variable* $n$. This is what makes it a dependent type.

### 11.3 A Type Operator in $\lambda\underline{\omega}$

In $\lambda\underline{\omega}$, we can form the type operator $\lambda X : *.\; X \to X$. Its classification:

$$
\frac{
  X : * \vdash X \to X : * \qquad (derived)
}{
  \vdash \lambda X : *.\; X \to X : \Pi X : *.\; *
} \quad (\text{Abs})
$$

Now, $\Pi X : *.\; *$ is a *kind* (has sort $\Box$). We need $(\Box, \Box, \Box) \in \mathcal{R}$ to form this product:

$$
\frac{
  \vdash * : \Box \qquad X : * \vdash * : \Box \qquad (\Box, \Box, \Box) \in \mathcal{R}
}{
  \vdash \Pi X : *.\; * : \Box
} \quad (\text{Prod})
$$

where $X : * \vdash * : \Box$ is by Weakening from $\vdash * : \Box$.

In the lambda cube notation, $\Pi X : *.\; *$ is the kind $* \Rightarrow *$. The PTS framework represents it as a product type at the $\Box$ level.

---

## 12. Exercises

**Exercise 11.1.** For each of the following, identify which lambda cube system is the *least expressive* system that can express it:

(a) The identity function $\lambda x : A.\; x : A \to A$.

(b) The polymorphic identity $\Lambda X.\; \lambda x : X.\; x : \forall X.\; X \to X$.

(c) The type operator $\lambda X :: *.\; X \to X :: * \Rightarrow *$.

(d) The type of vectors $\text{Vec} : * \to \text{Nat} \to *$.

(e) The polymorphic type operator $\Lambda X :: *.\; \lambda x : X.\; x$ (a term whose type depends on a type, and which uses a type operator).

(f) A type family $\lambda n : \text{Nat}.\; \text{Matrix}\; n\; n :: \text{Nat} \to *$.

**Exercise 11.2.** Write the PTS specification $(\mathcal{S}, \mathcal{A}, \mathcal{R})$ for:

(a) A system that has dependent types and polymorphism but not type operators.

(b) A system that has type operators and dependent types but not polymorphism.

(c) The Calculus of Constructions.

**Exercise 11.3.** In the PTS framework, derive the type of the polymorphic identity function in $\lambda 2$:

$$
\emptyset \vdash \lambda X : *.\; \lambda x : X.\; x \;:\; \Pi X : *.\; X \to X
$$

Show every application of the PTS typing rules (Axiom, Var, Weak, Prod, Abs, App).

**Exercise 11.4.** Explain why the rule $(*, \Box, *)$ (instead of $(*, \Box, \Box)$) leads to inconsistency (Girard's paradox). What goes wrong with the stratification?

**Exercise 11.5.** Encode the following natural deduction rules in LF ($\lambda P$):

(a) Conjunction introduction: from $A$ and $B$, conclude $A \wedge B$.

(b) Conjunction elimination: from $A \wedge B$, conclude $A$ (and separately, $B$).

(c) Disjunction introduction: from $A$, conclude $A \vee B$.

(d) Disjunction elimination: from $A \vee B$, $A \Rightarrow C$, and $B \Rightarrow C$, conclude $C$.

**Exercise 11.6.** Consider a PTS with $\mathcal{S} = \{*, \Box, \triangle\}$, $\mathcal{A} = \{(*, \Box), (\Box, \triangle)\}$, and $\mathcal{R} = \{(*, *, *), (\Box, *, *), (\Box, \Box, \Box), (\triangle, \Box, \Box)\}$.

(a) What does the rule $(\triangle, \Box, \Box)$ allow?

(b) Give an example of an expression that is typable in this system but not in $\lambda C$.

(c) Is this system strongly normalizing? (You may conjecture and justify informally.)

**Exercise 11.7.** Prove that in any PTS with $\mathcal{S} = \{*, \Box\}$, $\mathcal{A} = \{(*, \Box)\}$, and $\mathcal{R} \subseteq \{(*, *, *), (\Box, *, *), (\Box, \Box, \Box), (*, \Box, \Box)\}$, the sort $\Box$ is not the type of any term (i.e., there is no $e$ such that $\Gamma \vdash e : \Box$ where $e$ is not a sort).

(Hint: What are the possible forms of an expression whose type is $\Box$?)

**Exercise 11.8.** Compare and contrast the following approaches to "types depending on terms":

(a) Dependent types in the lambda cube ($\lambda P$).

(b) GADTs (Generalized Algebraic Data Types) in Haskell.

(c) Refinement types (as in Liquid Haskell or F\*).

Which features of each approach are shared, and which are unique?

---

## 13. Comparison of Lambda Cube Systems

### 13.1 Expressiveness Hierarchy

The lambda cube systems form a partial order by expressiveness (each system on a higher face includes the systems on the face below):

$$
\lambda{\to} \subset \lambda 2 \subset \lambda\omega \subset \lambda C
$$

$$
\lambda{\to} \subset \lambda\underline{\omega} \subset \lambda\omega \subset \lambda C
$$

$$
\lambda{\to} \subset \lambda P \subset \lambda P2 \subset \lambda C
$$

$$
\lambda{\to} \subset \lambda P \subset \lambda P\underline{\omega} \subset \lambda C
$$

Every system includes $\lambda{\to}$, and $\lambda C$ includes all others.

### 13.2 What Each Axis Buys

| Axis | Gained Expressiveness | Lost Property | Example |
|------|---------------------|---------------|---------|
| Polymorphism ($\lambda 2$) | Can write once, use at many types | Type inference becomes undecidable | $\forall X.\; X \to X$ |
| Type operators ($\lambda\underline{\omega}$) | Can parameterize types by types | More complex kind system | $\lambda X :: *.\; X \to X$ |
| Dependent types ($\lambda P$) | Types can express properties of values | Phase distinction broken | $\Pi n : \text{Nat}.\; \text{Vec}\;n$ |

### 13.3 Practical Trade-offs

| System | Type checking | Type inference | Phase separation | Programs terminate |
|--------|:---:|:---:|:---:|:---:|
| $\lambda{\to}$ | Decidable | Decidable | Yes | Yes |
| $\lambda 2$ | Decidable | Undecidable | Yes | Yes |
| $\lambda\omega$ | Decidable | Undecidable | Yes | Yes |
| $\lambda P$ | Decidable | Undecidable | No | Yes |
| $\lambda C$ | Decidable | Undecidable | No | Yes |

All lambda cube systems have decidable type *checking* (given annotations) but undecidable type *inference* (except $\lambda{\to}$). All are strongly normalizing (programs terminate), but this precludes general recursion.

### 13.4 The Curry--Howard Correspondence Across the Cube

The correspondence between type systems and logics extends systematically:

| System | Logic | Quantification |
|--------|-------|---------------|
| $\lambda{\to}$ | Propositional (implication) | None |
| $\lambda 2$ | Second-order propositional | Over propositions |
| $\lambda\underline{\omega}$ | (Higher-order propositional, weak) | Over predicates |
| $\lambda\omega$ | Higher-order propositional | Over propositions and predicates |
| $\lambda P$ | First-order predicate | Over individuals |
| $\lambda P2$ | Second-order predicate | Over individuals and propositions |
| $\lambda P\underline{\omega}$ | (Higher-order predicate, weak) | Over individuals and predicates |
| $\lambda C$ | Higher-order predicate | Over individuals, propositions, and predicates |

"Higher-order" means quantification over predicates of arbitrary type. "Second-order" means quantification over propositions (but not over predicates of predicates). "First-order" means quantification over individuals only.

---

## 14. Beyond the Lambda Cube: Extensions

### 14.1 Subtyping

The lambda cube does not model subtyping. Systems like $F_{<:}$ (Lecture 07c) and $F_{<:}^\omega$ add an orthogonal dimension. Incorporating subtyping into the PTS framework requires extending the Prod rule with coercions or subsumption.

### 14.2 Inductive Types

Pure lambda cube systems can encode some datatypes via Church or Scott encodings, but practical systems (Coq, Agda, Lean) add *inductive types* as primitive constructs. The Calculus of Inductive Constructions (CIC) extends $\lambda C$ with:

- Inductive type declarations (like `data` in Haskell or `Inductive` in Coq).
- Pattern matching and structural recursion principles.
- The *positivity condition* to ensure consistency.

### 14.3 Universe Polymorphism

The two-sort PTS ($*, \Box$) is limited. Modern proof assistants use a *hierarchy* of universes:

$$
\text{Type}_0 : \text{Type}_1 : \text{Type}_2 : \cdots
$$

This can be captured in a PTS with infinitely many sorts:

$$
\mathcal{S} = \{\text{Type}_i \mid i \in \mathbb{N}\}
$$

$$
\mathcal{A} = \{(\text{Type}_i, \text{Type}_{i+1}) \mid i \in \mathbb{N}\}
$$

*Universe polymorphism* allows definitions to be parameterized over the universe level, avoiding code duplication.

### 14.4 Linear and Substructural Types

Lecture 09 will discuss *linear types* and *substructural type systems*. These add another orthogonal axis: controlling how many times a variable can be used. Quantitative type theory (QTT), as used in Idris 2, combines dependent types with linearity in a single framework.

---

## Summary

- The **lambda cube** (Barendregt, 1991) organizes type systems along three axes: terms depending on types (polymorphism), types depending on types (type operators), and types depending on terms (dependent types). The eight vertices are $\lambda{\to}$, $\lambda 2$, $\lambda\underline{\omega}$, $\lambda\omega$, $\lambda P$, $\lambda P2$, $\lambda P\underline{\omega}$, and $\lambda C$.

- **Pure Type Systems** (PTS) provide a uniform framework: a PTS is specified by a triple $(\mathcal{S}, \mathcal{A}, \mathcal{R})$ of sorts, axioms, and rules. All eight lambda cube systems are PTS with $\mathcal{S} = \{*, \Box\}$ and $\mathcal{A} = \{(*, \Box)\}$, differing only in $\mathcal{R}$.

- The **rule set** $\mathcal{R}$ controls which dependencies are allowed: $(*, *, *)$ for functions, $(\Box, *, *)$ for polymorphism, $(\Box, \Box, \Box)$ for type operators, $(*, \Box, \Box)$ for dependent types. Each rule specifies which sort of product type is formed from which sorts of domain and codomain.

- **All eight lambda cube systems are strongly normalizing**, which implies decidability of type checking and logical consistency.

- **Automath** (de Bruijn, 1967) was the first dependent type system, designed for formalizing mathematics. The **Edinburgh Logical Framework** (Harper, Honsell, Plotkin, 1993) uses $\lambda P$ for encoding logics via the adequacy methodology.

- The **Calculus of Constructions** ($\lambda C$, Coquand and Huet, 1985) sits at the top-left vertex, combining all three axes. It is the theoretical foundation of Coq/Rocq, extended with inductive types and a universe hierarchy (CIC).

- The PTS framework also reveals *pathological* systems: the rule $(*, \Box, *)$ leads to Girard's paradox (inconsistency), motivating the careful design of the lambda cube's rule sets.

---

## Further Reading

1. **Barendregt, H. P.** (1992). "Lambda Calculi with Types." In *Handbook of Logic in Computer Science*, Vol. 2. Oxford University Press. The definitive reference for the lambda cube and Pure Type Systems.

2. **Coquand, T. and Huet, G.** (1988). "The Calculus of Constructions." *Information and Computation*, 76(2--3):95--120. The original paper on the CoC.

3. **Harper, R., Honsell, F., and Plotkin, G.** (1993). "A Framework for Defining Logics." *Journal of the ACM*, 40(1):143--184. The Edinburgh Logical Framework.

4. **de Bruijn, N. G.** (1970). "The Mathematical Language AUTOMATH, Its Usage, and Some of Its Extensions." *Lecture Notes in Mathematics*, 125. Springer.

5. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapters 29--32. Textbook coverage of type operators, bounded quantification, and higher-order systems.

6. **Berardi, S.** (1990). *Type Dependence and Constructive Mathematics*. PhD thesis, University of Turin. Strong normalization for a broad class of PTS.

7. **Geuvers, H.** (1993). *Logics and Type Systems*. PhD thesis, Katholieke Universiteit Nijmegen. Comprehensive study of PTS metatheory.

8. **S\o{}rensen, M. H. and Urzyczyn, P.** (2006). *Lectures on the Curry-Howard Isomorphism*. Elsevier. Chapters 12--14 cover the lambda cube and PTS in pedagogical detail.

9. **Nederpelt, R. P. and Geuvers, H.** (2014). *Type Theory and Formal Proof: An Introduction*. Cambridge University Press. A modern introduction to dependent type theory and the lambda cube.
