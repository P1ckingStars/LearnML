---
title: "Lecture 08c: Martin-Lof Type Theory"
tags:
  - type-theory
  - dependent-types
  - lecture
---
# Lecture 08c: Martin-Lof Type Theory

> **Module 08 --- Dependent Types (Weeks 15--16)**
> Estimated study time: 7--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **State** the four forms of judgment in Martin-Lof type theory and explain their roles.
2. **Derive** the formation, introduction, elimination, and computation rules for each basic type former (Pi, Sigma, Nat, Id, Bool, Empty, Unit).
3. **Explain** the natural number type $\text{Nat}$ and its eliminator (the induction/recursion principle), and use it to define arithmetic functions.
4. **Define** identity types $\text{Id}_A(a, b)$, the constructor $\text{refl}$, and the J eliminator, and prove basic properties of equality using J.
5. **Distinguish** intensional and extensional Martin-Lof type theory and explain the consequences of each choice for decidability.
6. **Describe** W-types as a general schema for well-founded inductive types and show how Nat and binary trees arise as special cases.
7. **Explain** the universe hierarchy $\mathcal{U}_0 : \mathcal{U}_1 : \mathcal{U}_2 : \ldots$ and the need for universe polymorphism.
8. **Formalize** propositions as types in the dependent setting, recovering full first-order constructive logic.

---

## 1. Motivation

### 1.1 The Need for a Foundation

In Lectures 08a and 08b, we introduced Pi and Sigma types as extensions to existing type systems. But dependent types are powerful enough to serve as a **foundation for mathematics** --- a formal system in which we can express arbitrary mathematical statements and construct their proofs.

Per Martin-Lof developed his **intuitionistic type theory** (MLTT) over several decades (1971, 1973, 1979, 1984) with precisely this aim: to provide a constructive foundation for mathematics that is simultaneously a programming language. The key insight is that the Curry-Howard correspondence, elevated to the dependent setting, yields a system where:

- **Types** are propositions.
- **Terms** are proofs.
- **Programs** are proofs, and proofs are programs.

Every proof carries computational content, and every program has a logical interpretation.

### 1.2 Design Principles

Martin-Lof type theory is built on several principles:

1. **Meaning explanations.** Each type former is justified by explaining what its elements are and what it means to be an element. This is prior to formal rules.
2. **Introduction and elimination harmony.** The elimination rule for a type should be the "inverse" of the introduction rule: it allows us to use an element of the type in exactly the ways warranted by how it was constructed. This is Gentzen's principle of harmony.
3. **No axioms, only rules.** Everything is derivable from the inference rules. There are no unproved assumptions (though axioms can be added if desired).
4. **Constructivity.** Every proof of an existential statement provides a witness. Every proof of a disjunction tells us which disjunct holds.

### 1.3 Versions

Martin-Lof type theory exists in several versions:

- **MLTT 1971:** Had a universe $\mathcal{U}$ with $\mathcal{U} : \mathcal{U}$ (type-in-type). Girard showed this is inconsistent.
- **MLTT 1973:** Introduced the predicative universe hierarchy $\mathcal{U}_0 : \mathcal{U}_1 : \ldots$
- **MLTT 1979 ("Constructive Mathematics and Computer Programming"):** The mature system with W-types.
- **MLTT 1984 ("Intuitionistic Type Theory," the Bibliopolis notes):** The most widely cited formulation, intensional.

We present the 1984 version with some modern refinements.

---

## 2. Judgments and Contexts

### 2.1 The Four Forms of Judgment

Martin-Lof type theory has four forms of judgment:

| Judgment | Reading |
|---|---|
| $\Gamma \vdash A \; \text{type}$ | $A$ is a well-formed type in context $\Gamma$ |
| $\Gamma \vdash a : A$ | $a$ is a term of type $A$ in context $\Gamma$ |
| $\Gamma \vdash A \equiv B \; \text{type}$ | $A$ and $B$ are definitionally equal types |
| $\Gamma \vdash a \equiv b : A$ | $a$ and $b$ are definitionally equal terms of type $A$ |

The first two are **categorical judgments** (they assert that something exists). The last two are **hypothetical judgments** (they assert an equality). All four are relative to a context $\Gamma$.

### 2.2 Contexts

A **context** $\Gamma$ is a finite sequence of typed variable declarations:

$$\Gamma \;=\; x_1 : A_1, \; x_2 : A_2(x_1), \; x_3 : A_3(x_1, x_2), \; \ldots, \; x_n : A_n(x_1, \ldots, x_{n-1})$$

Each type $A_i$ may depend on the preceding variables $x_1, \ldots, x_{i-1}$. This is a telescope (cf. Lecture 08b, Section 5.3).

**Context formation rules:**

$$\frac{}{\diamond \; \text{ctx}} \; (\text{Ctx-Empty})$$

$$\frac{\Gamma \; \text{ctx} \qquad \Gamma \vdash A \; \text{type} \qquad x \notin \text{dom}(\Gamma)}{\Gamma, x : A \; \text{ctx}} \; (\text{Ctx-Ext})$$

**Variable rule:**

$$\frac{\Gamma, x : A, \Delta \; \text{ctx}}{\Gamma, x : A, \Delta \vdash x : A} \; (\text{Var})$$

### 2.3 Structural Rules

The structural rules govern how contexts and judgments interact:

**Weakening:** If $\Gamma, \Delta \vdash \mathcal{J}$ and $\Gamma \vdash A \; \text{type}$ with $x$ fresh, then $\Gamma, x : A, \Delta \vdash \mathcal{J}$.

**Substitution:** If $\Gamma, x : A, \Delta \vdash \mathcal{J}$ and $\Gamma \vdash a : A$, then $\Gamma, \Delta[a/x] \vdash \mathcal{J}[a/x]$.

**Conversion:** If $\Gamma \vdash a : A$ and $\Gamma \vdash A \equiv B \; \text{type}$, then $\Gamma \vdash a : B$.

---

## 3. Type Formers: The General Pattern

### 3.1 The Four-Rule Schema

Each type former in MLTT follows a uniform pattern of four (sometimes five) rules:

| Rule | Purpose | Analogy |
|---|---|---|
| **Formation** | When is $T$ a type? | Defining the set |
| **Introduction** | How to construct elements of $T$? | Constructors |
| **Elimination** | How to use elements of $T$? | Pattern matching / recursion |
| **Computation** ($\beta$) | What happens when elimination meets introduction? | Reduction |
| **Uniqueness** ($\eta$, optional) | Is every element of $T$ constructed by introduction? | Completeness |

This schema is sometimes called the **Gentzen-style** presentation, by analogy with natural deduction.

### 3.2 The Harmony Principle

The introduction and elimination rules must be in **harmony** (a concept due to Dummett, formalized by Prawitz): the elimination rule should be strong enough to extract all information put in by the introduction rule, and no more. If the elimination is too weak, we have information that cannot be accessed (incompleteness). If it is too strong, we can derive contradictions (unsoundness).

Formally, harmony is captured by:

- **Local soundness:** The $\beta$-rule shows that an introduction immediately followed by an elimination reduces away --- nothing extra is gained. This certifies that the elimination is not too strong.
- **Local completeness:** The $\eta$-rule shows that any element of the type can be reconstructed from the results of eliminations --- all elements are accounted for. This certifies that the elimination is not too weak.

---

## 4. The Natural Number Type

### 4.1 Formation

$$\frac{\Gamma \; \text{ctx}}{\Gamma \vdash \text{Nat} \; \text{type}} \; (\text{Nat-Form})$$

### 4.2 Introduction

$$\frac{\Gamma \; \text{ctx}}{\Gamma \vdash 0 : \text{Nat}} \; (\text{Nat-Intro}_1)$$

$$\frac{\Gamma \vdash n : \text{Nat}}{\Gamma \vdash \text{succ}(n) : \text{Nat}} \; (\text{Nat-Intro}_2)$$

### 4.3 Elimination (The Induction Principle)

The elimination rule for $\text{Nat}$ is the **principle of mathematical induction**, expressed as a typing rule:

$$\frac{\begin{array}{c} \Gamma \vdash n : \text{Nat} \qquad \Gamma, k : \text{Nat} \vdash C(k) \; \text{type} \\ \Gamma \vdash c_0 : C(0) \\ \Gamma, k : \text{Nat}, h : C(k) \vdash c_s(k, h) : C(\text{succ}(k)) \end{array}}{\Gamma \vdash \text{Nat-elim}(C, c_0, c_s, n) : C(n)} \; (\text{Nat-Elim})$$

**Reading:** To prove $C(n)$ for an arbitrary $n : \text{Nat}$, it suffices to:

1. Prove the base case $c_0 : C(0)$.
2. Prove the inductive step: assuming $C(k)$ holds (with witness $h$), prove $C(\text{succ}(k))$.

The eliminator $\text{Nat-elim}$ then produces a proof of $C(n)$ for any $n$.

When the motive $C(k)$ does not depend on $k$, this specializes to the **recursion principle** (non-dependent elimination):

$$\frac{\Gamma \vdash n : \text{Nat} \qquad \Gamma \vdash c_0 : C \qquad \Gamma, k : \text{Nat}, h : C \vdash c_s(k, h) : C}{\Gamma \vdash \text{Nat-rec}(C, c_0, c_s, n) : C}$$

### 4.4 Computation Rules

$$\text{Nat-elim}(C, c_0, c_s, 0) \equiv c_0 \qquad (\text{Nat-}\beta_1)$$

$$\text{Nat-elim}(C, c_0, c_s, \text{succ}(n)) \equiv c_s(n, \text{Nat-elim}(C, c_0, c_s, n)) \qquad (\text{Nat-}\beta_2)$$

### 4.5 Derived Operations

**Addition.**

$$\text{add}(m, n) \;\stackrel{\text{def}}{=}\; \text{Nat-elim}(\lambda k.\, \text{Nat},\; n,\; \lambda k.\, \lambda h.\, \text{succ}(h),\; m)$$

Unfolding:

$$\text{add}(0, n) \equiv n$$

$$\text{add}(\text{succ}(m), n) \equiv \text{succ}(\text{add}(m, n))$$

**Multiplication.**

$$\text{mul}(m, n) \;\stackrel{\text{def}}{=}\; \text{Nat-elim}(\lambda k.\, \text{Nat},\; 0,\; \lambda k.\, \lambda h.\, \text{add}(n, h),\; m)$$

Unfolding:

$$\text{mul}(0, n) \equiv 0$$

$$\text{mul}(\text{succ}(m), n) \equiv \text{add}(n, \text{mul}(m, n))$$

**The predecessor function.** A subtle example:

$$\text{pred}(n) \;\stackrel{\text{def}}{=}\; \text{Nat-elim}(\lambda k.\, \text{Nat},\; 0,\; \lambda k.\, \lambda h.\, k,\; n)$$

Note that the inductive step discards the recursive result $h$ and returns $k$ directly. This gives:

$$\text{pred}(0) \equiv 0 \qquad \text{pred}(\text{succ}(n)) \equiv n$$

### 4.6 The Double Function

Another instructive example:

$$\text{double}(n) \;\stackrel{\text{def}}{=}\; \text{Nat-elim}(\lambda k.\, \text{Nat},\; 0,\; \lambda k.\, \lambda h.\, \text{succ}(\text{succ}(h)),\; n)$$

Unfolding:

$$\text{double}(0) \equiv 0$$

$$\text{double}(\text{succ}(n)) \equiv \text{succ}(\text{succ}(\text{double}(n)))$$

**Proposition 4.0.** $\text{double}(n) = \text{add}(n, n)$ for all $n : \text{Nat}$. This requires a proof by induction and uses the commutativity of addition (proved in Section 12.1).

### 4.7 Example: Proof by Induction

**Proposition 4.1.** *For all $n : \text{Nat}$, $\text{add}(n, 0) \equiv_{\text{prop}} n$.*

Note that $\text{add}(0, n) \equiv n$ holds *definitionally* (by the first computation rule). But $\text{add}(n, 0) \equiv_{\text{prop}} n$ requires a proof by induction, because addition is defined by recursion on its first argument.

*Proof.* We construct a term of type $\Pi(n : \text{Nat}).\, \text{Id}_{\text{Nat}}(\text{add}(n, 0), n)$.

**Base case** ($n = 0$): We need $\text{Id}_{\text{Nat}}(\text{add}(0, 0), 0)$. Since $\text{add}(0, 0) \equiv 0$, we use $\text{refl}_0 : \text{Id}_{\text{Nat}}(0, 0)$.

**Inductive step:** Assume $p : \text{Id}_{\text{Nat}}(\text{add}(n, 0), n)$. We need $\text{Id}_{\text{Nat}}(\text{add}(\text{succ}(n), 0), \text{succ}(n))$. Since $\text{add}(\text{succ}(n), 0) \equiv \text{succ}(\text{add}(n, 0))$, we need $\text{Id}_{\text{Nat}}(\text{succ}(\text{add}(n, 0)), \text{succ}(n))$. Applying $\text{succ}$ to both sides of $p$ (using the congruence $\text{ap}$ derived from J):

$$\text{ap}(\text{succ}, p) : \text{Id}_{\text{Nat}}(\text{succ}(\text{add}(n, 0)), \text{succ}(n))$$

The complete proof term:

$$\text{Nat-elim}(\lambda n.\, \text{Id}_{\text{Nat}}(\text{add}(n, 0), n),\; \text{refl}_0,\; \lambda n.\, \lambda p.\, \text{ap}(\text{succ}, p)) \;:\; \Pi(n : \text{Nat}).\, \text{Id}_{\text{Nat}}(\text{add}(n, 0), n) \quad \square$$

---

## 5. Identity Types

### 5.1 Formation

$$\frac{\Gamma \vdash A \; \text{type} \qquad \Gamma \vdash a : A \qquad \Gamma \vdash b : A}{\Gamma \vdash \text{Id}_A(a, b) \; \text{type}} \; (\text{Id-Form})$$

**Reading:** Given a type $A$ and two terms $a, b : A$, the identity type $\text{Id}_A(a, b)$ is a type. Its elements are proofs that $a$ and $b$ are equal.

**Notation.** We write $a =_A b$ as shorthand for $\text{Id}_A(a, b)$. In many modern treatments, the subscript $A$ is omitted when clear from context.

### 5.2 Introduction

$$\frac{\Gamma \vdash a : A}{\Gamma \vdash \text{refl}_a : \text{Id}_A(a, a)} \; (\text{Id-Intro})$$

The only constructor is **reflexivity**: every element is equal to itself. There is no constructor for $\text{Id}_A(a, b)$ when $a$ and $b$ are distinct --- to prove $a = b$ when $a \not\equiv b$, one must use the eliminators and the computation rules of the ambient type theory.

### 5.3 Elimination: The J Rule

The elimination rule for identity types is Martin-Lof's **J rule** (also called **path induction** in the HoTT literature):

$$\frac{\begin{array}{c} \Gamma \vdash p : \text{Id}_A(a, b) \\ \Gamma, x : A, y : A, q : \text{Id}_A(x, y) \vdash C(x, y, q) \; \text{type} \\ \Gamma, z : A \vdash c(z) : C(z, z, \text{refl}_z) \end{array}}{\Gamma \vdash \text{J}(C, c, a, b, p) : C(a, b, p)} \; (\text{J})$$

**Reading:** To prove $C(a, b, p)$ for arbitrary $a, b : A$ and $p : \text{Id}_A(a, b)$, it suffices to prove $C(z, z, \text{refl}_z)$ for an arbitrary $z : A$. Informally: "to prove something about an arbitrary equality proof, it suffices to consider the case where the proof is reflexivity."

**Computation rule:**

$$\text{J}(C, c, a, a, \text{refl}_a) \equiv c(a) \qquad (\text{J-}\beta)$$

### 5.4 Derived Operations from J

**Symmetry.** If $a =_A b$, then $b =_A a$.

$$\text{sym} : \Pi(A : \mathcal{U}).\, \Pi(a\, b : A).\, \text{Id}_A(a, b) \to \text{Id}_A(b, a)$$

*Proof.* Define the motive $C(x, y, q) \stackrel{\text{def}}{=} \text{Id}_A(y, x)$. In the reflexivity case, we need $C(z, z, \text{refl}_z) = \text{Id}_A(z, z)$, which is inhabited by $\text{refl}_z$. So:

$$\text{sym}(A, a, b, p) \;\stackrel{\text{def}}{=}\; \text{J}(\lambda x\, y\, q.\, \text{Id}_A(y, x),\; \lambda z.\, \text{refl}_z,\; a, b, p) \quad \square$$

**Transitivity.** If $a =_A b$ and $b =_A c$, then $a =_A c$.

$$\text{trans} : \Pi(A : \mathcal{U}).\, \Pi(a\, b\, c : A).\, \text{Id}_A(a, b) \to \text{Id}_A(b, c) \to \text{Id}_A(a, c)$$

*Proof.* We use J on the first equality proof. Define $C(x, y, q) \stackrel{\text{def}}{=} \Pi(c : A).\, \text{Id}_A(y, c) \to \text{Id}_A(x, c)$. In the reflexivity case: $C(z, z, \text{refl}_z) = \Pi(c : A).\, \text{Id}_A(z, c) \to \text{Id}_A(z, c)$, which is inhabited by the identity function. So:

$$\text{trans}(A, a, b, c, p, q) \;\stackrel{\text{def}}{=}\; \text{J}(\lambda x\, y\, r.\, \Pi(c : A).\, \text{Id}_A(y, c) \to \text{Id}_A(x, c),\; \lambda z.\, \lambda c.\, \lambda s.\, s,\; a, b, p)(c)(q) \quad \square$$

**Congruence (ap).** If $a =_A b$ and $f : A \to B$, then $f(a) =_B f(b)$.

$$\text{ap} : \Pi(A\, B : \mathcal{U}).\, \Pi(f : A \to B).\, \Pi(a\, b : A).\, \text{Id}_A(a, b) \to \text{Id}_B(f(a), f(b))$$

*Proof.* Motive: $C(x, y, q) = \text{Id}_B(f(x), f(y))$. Reflexivity case: $\text{refl}_{f(z)} : \text{Id}_B(f(z), f(z))$.

$$\text{ap}(A, B, f, a, b, p) \;\stackrel{\text{def}}{=}\; \text{J}(\lambda x\, y\, q.\, \text{Id}_B(f(x), f(y)),\; \lambda z.\, \text{refl}_{f(z)},\; a, b, p) \quad \square$$

**Transport.** If $P : A \to \mathcal{U}$ is a type family and $a =_A b$, then $P(a) \to P(b)$.

$$\text{transport} : \Pi(A : \mathcal{U}).\, \Pi(P : A \to \mathcal{U}).\, \Pi(a\, b : A).\, \text{Id}_A(a, b) \to P(a) \to P(b)$$

*Proof.* Motive: $C(x, y, q) = P(x) \to P(y)$. Reflexivity case: $\text{id}_{P(z)} : P(z) \to P(z)$.

$$\text{transport}(A, P, a, b, p) \;\stackrel{\text{def}}{=}\; \text{J}(\lambda x\, y\, q.\, P(x) \to P(y),\; \lambda z.\, \lambda u.\, u,\; a, b, p) \quad \square$$

Transport is arguably the most important operation derivable from J. It says: equal inputs give equal outputs, for any type family.

### 5.5 Understanding J: Worked Examples

The J rule is the most subtle aspect of MLTT. Let us work through several examples in detail to build intuition.

**Example 5.1 (Substitutivity of equality).** We want to prove: if $a =_A b$ and $P(a)$ holds, then $P(b)$ holds. This is the transport function.

We need: $\text{transport} : \Pi(P : A \to \mathcal{U}).\, \Pi(a\, b : A).\, \text{Id}_A(a, b) \to P(a) \to P(b)$.

*Setup for J:*

- The equality proof is $p : \text{Id}_A(a, b)$.
- The motive is $C(x, y, q) \stackrel{\text{def}}{=} P(x) \to P(y)$.
- The reflexivity case: $C(z, z, \text{refl}_z) = P(z) \to P(z)$, inhabited by $\lambda u.\, u$ (the identity function).

*Result:* $\text{transport}(P, a, b, p) \stackrel{\text{def}}{=} \text{J}(\lambda x\, y\, q.\, P(x) \to P(y),\; \lambda z.\, \lambda u.\, u,\; a, b, p)$.

*Verification:* $\text{transport}(P, a, a, \text{refl}_a) \equiv (\lambda z.\, \lambda u.\, u)(a) \equiv \lambda u.\, u = \text{id}_{P(a)}$.

**Example 5.2 (Equality implies backward equality).** Symmetry: $\text{Id}_A(a, b) \to \text{Id}_A(b, a)$.

- Motive: $C(x, y, q) = \text{Id}_A(y, x)$.
- Reflexivity case: $C(z, z, \text{refl}_z) = \text{Id}_A(z, z)$, inhabited by $\text{refl}_z$.
- Result: $\text{sym}(p) = \text{J}(\lambda x\, y\, q.\, \text{Id}_A(y, x),\; \lambda z.\, \text{refl}_z,\; a, b, p)$.

**Example 5.3 (Decidable equality implies UIP for Nat).** If $A$ has decidable equality ($\Pi(a\, b : A).\, \text{Id}(a, b) + \neg\text{Id}(a, b)$), then $A$ satisfies UIP. The proof uses the fact that every identity proof on $A$ can be "normalized" by factoring through the decision procedure. This is Hedberg's theorem (1998).

### 5.6 Based Path Induction

An alternative to J is **based path induction** (also called **Paulin-Mohring J**), which fixes one endpoint:

$$\frac{\begin{array}{c} \Gamma \vdash a : A \qquad \Gamma \vdash p : \text{Id}_A(a, b) \\ \Gamma, y : A, q : \text{Id}_A(a, y) \vdash C(y, q) \; \text{type} \\ \Gamma \vdash c : C(a, \text{refl}_a) \end{array}}{\Gamma \vdash \text{J}'(C, c, b, p) : C(b, p)} \; (\text{J}')$$

**Proposition 5.1.** *J and J' are interderivable.*

*Proof.* J' from J: Given the premises of J', define $\widetilde{C}(x, y, q) \stackrel{\text{def}}{=} \Pi(D : \Pi(z : A).\, \text{Id}_A(x, z) \to \mathcal{U}).\, D(x, \text{refl}_x) \to D(y, q)$. Apply J with motive $\widetilde{C}$, then instantiate with $D \stackrel{\text{def}}{=} C$.

J from J': Use J' with the motive $C'(y, q) \stackrel{\text{def}}{=} \Pi(\text{endpoints in the right positions}).\, C(a, y, q)$. The details involve showing that fixing one endpoint does not lose generality, which is possible because the type $\Sigma(y : A).\, \text{Id}_A(a, y)$ is contractible. $\square$

---

## 6. Intensional vs. Extensional Identity

### 6.1 The Extensional Identity Type

In **extensional** Martin-Lof type theory (ETT), we add a rule called **equality reflection**:

$$\frac{\Gamma \vdash p : \text{Id}_A(a, b)}{\Gamma \vdash a \equiv b : A} \; (\text{Id-Reflect})$$

This says: if there is a proof that $a = b$, then $a$ and $b$ are *definitionally* equal. Propositional and definitional equality collapse.

**Consequences of equality reflection:**

1. All elements of $\text{Id}_A(a, b)$ are equal: $\text{Id}_A(a, b)$ is a proposition (at most one element up to equality). This is **uniqueness of identity proofs (UIP)** or **proof irrelevance for identity**.
2. Type checking becomes **undecidable**: to check $a \equiv b$, the type checker might need to find a proof of $\text{Id}_A(a, b)$, which is a theorem-proving problem.

### 6.2 The Intensional Identity Type

In **intensional** Martin-Lof type theory (ITT), we do *not* have equality reflection. Propositional equality ($\text{Id}_A(a, b)$) is strictly weaker than definitional equality ($a \equiv b$):

$$a \equiv b : A \implies \text{refl}_a : \text{Id}_A(a, b)$$

but not conversely. There may exist a proof $p : \text{Id}_A(a, b)$ even though $a$ and $b$ are not definitionally equal.

**Consequences:**

1. Type checking is **decidable** (given a termination oracle for the normalizer).
2. The identity type $\text{Id}_A(a, b)$ may have interesting higher structure --- it is not necessarily a mere proposition.
3. Functions that are extensionally equal (agree on all inputs) may not be propositionally equal without the **function extensionality** axiom.

### 6.3 The Intensional/Extensional Divide

| Feature | Intensional (ITT) | Extensional (ETT) |
|---|---|---|
| Type checking | Decidable | Undecidable |
| Definitional = Propositional? | No | Yes |
| UIP | Not provable (in general) | Provable |
| Function extensionality | Not provable | Provable |
| Proof-relevant equality | Yes | No |
| HoTT-compatible | Yes | No |
| Practical systems | Agda, Coq, Lean | NuPRL |

The intensional theory is the standard in modern proof assistants. Homotopy type theory (HoTT) is based on intensional type theory and exploits the higher structure of identity types.

### 6.4 Uniqueness of Identity Proofs

**Definition 6.1 (UIP).** The principle of **uniqueness of identity proofs** states that for all $a, b : A$ and $p, q : \text{Id}_A(a, b)$, we have $\text{Id}_{\text{Id}_A(a,b)}(p, q)$.

In intensional type theory, UIP is **not provable** in general. This was established by Hofmann and Streicher (1998), who constructed a model (the groupoid model) in which UIP fails.

**Theorem 6.2 (Hofmann-Streicher).** *There exists a model of intensional Martin-Lof type theory in which UIP does not hold.*

This result opened the door to homotopy type theory, where identity types are interpreted as path spaces and higher identity types as higher homotopies.

---

## 7. W-Types (Well-Founded Trees)

### 7.1 Motivation

The natural number type $\text{Nat}$ is an inductive type with a specific structure. W-types provide a **general schema** for well-founded inductive types, parameterized by:

- A type $A$ of **constructors** (or **labels**).
- A family $B : A \to \mathcal{U}$ giving the **arity** (number of recursive children) of each constructor.

### 7.2 Formation

$$\frac{\Gamma \vdash A \; \text{type} \qquad \Gamma, a : A \vdash B(a) \; \text{type}}{\Gamma \vdash \text{W}(a : A).\, B(a) \; \text{type}} \; (\text{W-Form})$$

### 7.3 Introduction

$$\frac{\Gamma \vdash a : A \qquad \Gamma \vdash f : B(a) \to \text{W}(x : A).\, B(x)}{\Gamma \vdash \text{sup}(a, f) : \text{W}(x : A).\, B(x)} \; (\text{W-Intro})$$

**Reading:** An element of $\text{W}(a : A).\, B(a)$ is a tree node labeled with $a : A$ that has $|B(a)|$ children, each of which is itself a W-tree. The function $f : B(a) \to \text{W}(x : A).\, B(x)$ maps each "slot" (element of $B(a)$) to a subtree.

### 7.4 Elimination

$$\frac{\begin{array}{c} \Gamma \vdash w : \text{W}(x : A).\, B(x) \qquad \Gamma, z : \text{W}(x : A).\, B(x) \vdash C(z) \; \text{type} \\ \Gamma, a : A, f : B(a) \to \text{W}(x : A).\, B(x), g : \Pi(b : B(a)).\, C(f(b)) \vdash c(a, f, g) : C(\text{sup}(a, f)) \end{array}}{\Gamma \vdash \text{W-elim}(C, c, w) : C(w)} \; (\text{W-Elim})$$

**Computation rule:**

$$\text{W-elim}(C, c, \text{sup}(a, f)) \equiv c(a, f, \lambda b.\, \text{W-elim}(C, c, f(b))) \qquad (\text{W-}\beta)$$

### 7.5 Examples

**Natural numbers.** $\text{Nat} \cong \text{W}(a : \text{Bool}).\, B(a)$ where:

$$B(\text{true}) = \mathbf{0} \quad \text{(empty type --- no children: the zero constructor)}$$

$$B(\text{false}) = \mathbf{1} \quad \text{(unit type --- one child: the successor constructor)}$$

Then $\text{sup}(\text{true}, !) : \text{Nat}$ represents $0$ (where $! : \mathbf{0} \to \text{Nat}$ is the unique function from the empty type), and $\text{sup}(\text{false}, \lambda\star.\, n) : \text{Nat}$ represents $\text{succ}(n)$.

**Binary trees.** $\text{BinTree} \cong \text{W}(a : \text{Bool}).\, B(a)$ where:

$$B(\text{true}) = \mathbf{0} \quad \text{(leaf: no children)}$$

$$B(\text{false}) = \text{Bool} \quad \text{(internal node: two children, indexed by Bool)}$$

**Lists.** $\text{List}(X) \cong \text{W}(a : \mathbf{1} + X).\, B(a)$ where:

$$B(\text{inl}(\star)) = \mathbf{0} \quad \text{(nil: no children)}$$

$$B(\text{inr}(x)) = \mathbf{1} \quad \text{(cons: one child, the tail)}$$

### 7.6 Limitations of W-Types

W-types capture well-founded tree-shaped data, but they do not directly handle:

- **Mutual recursion** (e.g., mutually defined types for expressions and statements).
- **Nested recursion** (e.g., $\text{data } T = \text{Node}\; (\text{List}\; T)$).
- **Indexed inductive types** (e.g., $\text{Vec}(A, n)$, which is indexed by $\text{Nat}$).

The **Calculus of Inductive Constructions** (CIC) generalizes W-types to handle all of these cases, as we will see in Lecture 08d.

---

## 8. Universes

### 8.1 The Need for Universes

A **universe** is a type whose elements are (codes for) types. We need universes to:

1. Quantify over types: $\Pi(\alpha : \mathcal{U}).\, \alpha \to \alpha$ (polymorphism).
2. Define type families by computation (large eliminations).
3. State meta-level properties internally.

### 8.2 Universes and Large Eliminations

A **large elimination** is an eliminator whose return type lives in a universe (i.e., it computes a type from a value). For example, the function:

$$f : \text{Bool} \to \mathcal{U}$$

$$f(\text{true}) = \text{Nat} \qquad f(\text{false}) = \text{Bool}$$

is a large elimination of $\text{Bool}$. Not all type theories support large eliminations --- some restrict the motive of eliminators to avoid returning types. The distinction matters for:

- **Proof irrelevance:** If the eliminator of $\text{Bool}$ cannot return types, then a proof of $\text{Bool}$ (viewed as a proposition) cannot affect the type of a term. This is desirable when $\text{Bool}$ is used as a proposition.
- **Universe consistency:** Large eliminations interact subtly with impredicativity. In Coq, $\text{Prop}$-valued types cannot be large-eliminated into $\text{Type}$ (the "singleton elimination restriction").

### 8.3 The Russell-Style Universe Hierarchy

In the Russell-style formulation, types *are* elements of universes:

$$\mathcal{U}_0 : \mathcal{U}_1 : \mathcal{U}_2 : \ldots$$

Each universe is an element of the next:

$$\frac{}{\Gamma \vdash \mathcal{U}_i : \mathcal{U}_{i+1}} \; (\text{Univ})$$

Types formed from types in $\mathcal{U}_i$ remain in $\mathcal{U}_i$ (or a higher universe):

$$\frac{\Gamma \vdash A : \mathcal{U}_i \qquad \Gamma, x : A \vdash B(x) : \mathcal{U}_i}{\Gamma \vdash \Pi(x : A).\, B(x) : \mathcal{U}_i} \; (\Pi\text{-Univ})$$

$$\frac{\Gamma \vdash A : \mathcal{U}_i \qquad \Gamma, x : A \vdash B(x) : \mathcal{U}_i}{\Gamma \vdash \Sigma(x : A).\, B(x) : \mathcal{U}_i} \; (\Sigma\text{-Univ})$$

**Cumulative universes:** If $A : \mathcal{U}_i$, then $A : \mathcal{U}_{i+1}$ (subtyping between universe levels):

$$\frac{\Gamma \vdash A : \mathcal{U}_i \qquad i \leq j}{\Gamma \vdash A : \mathcal{U}_j} \; (\text{Cumul})$$

### 8.4 Why Not $\mathcal{U} : \mathcal{U}$?

The rule $\mathcal{U} : \mathcal{U}$ (type-in-type) is inconsistent. Girard (1972) showed that it leads to a paradox analogous to Russell's paradox, now known as **Girard's paradox**.

**Theorem 8.1 (Girard's Paradox).** *A type theory with $\mathcal{U} : \mathcal{U}$ is inconsistent: every type is inhabited.*

*Proof sketch.* The proof constructs a well-ordering on $\mathcal{U}$ using a Burali-Forti-style argument. Since $\mathcal{U} : \mathcal{U}$, we can form the type of all well-orderings on $\mathcal{U}$. The order type of this collection is itself a well-ordering greater than all its elements --- a contradiction. $\square$

The universe hierarchy $\mathcal{U}_0 : \mathcal{U}_1 : \ldots$ avoids this by ensuring no universe contains itself.

### 8.5 Universe Polymorphism

Writing universe levels explicitly is tedious. **Universe polymorphism** allows definitions to be parameterized by universe levels:

$$\text{id} : \Pi(i : \text{Level}).\, \Pi(\alpha : \mathcal{U}_i).\, \alpha \to \alpha$$

$$\text{id}(i, \alpha, x) \stackrel{\text{def}}{=} x$$

In practice, proof assistants implement universe polymorphism with constraints:

- **Agda:** Universe levels are explicit terms. The programmer writes `Set l` for $\mathcal{U}_l$.
- **Coq/Rocq:** Universe levels are inferred and constrained. The programmer rarely sees them.
- **Lean 4:** Universe levels are explicit in the kernel but often inferred. `Sort u` represents the universe at level `u`.

### 8.6 Tarski-Style Universes

An alternative formulation uses **codes** and a **decoding function**:

- $\mathcal{U}$ is a type of **codes** for types.
- $\text{El} : \mathcal{U} \to \text{type}$ is the **decoding function** (or **El**ement interpretation) that maps codes to actual types.

$$\frac{\Gamma \vdash c : \mathcal{U}}{\Gamma \vdash \text{El}(c) \; \text{type}} \; (\text{El})$$

**Codes for type formers:**

$$\frac{\Gamma \vdash a : \mathcal{U} \qquad \Gamma, x : \text{El}(a) \vdash b(x) : \mathcal{U}}{\Gamma \vdash \hat{\Pi}(a, b) : \mathcal{U}} \quad \text{with } \text{El}(\hat{\Pi}(a, b)) = \Pi(x : \text{El}(a)).\, \text{El}(b(x))$$

This is more explicit and avoids the confusion between "type" and "element of a universe," but it is also more verbose.

---

## 9. Propositions as Types (Full First-Order Logic)

### 9.1 The Full Correspondence

With dependent types, the Curry-Howard correspondence extends to full first-order constructive logic:

| Logical Connective | Type Former | Introduction | Elimination |
|---|---|---|---|
| $P \Rightarrow Q$ | $P \to Q$ | $\lambda x.\, \ldots$ | Application |
| $P \land Q$ | $P \times Q$ | $(p, q)$ | Projections |
| $P \lor Q$ | $P + Q$ | $\text{inl}(p)$ / $\text{inr}(q)$ | Case analysis |
| $\top$ (truth) | $\mathbf{1}$ | $\star$ | (trivial) |
| $\bot$ (falsity) | $\mathbf{0}$ | (impossible) | $\text{abort}$ |
| $\neg P$ | $P \to \mathbf{0}$ | $\lambda x.\, \ldots$ | Application |
| $\forall x \in A.\, P(x)$ | $\Pi(x : A).\, P(x)$ | $\lambda x.\, \ldots$ | Application |
| $\exists x \in A.\, P(x)$ | $\Sigma(x : A).\, P(x)$ | $(a, p)$ | Projections |
| $a = b$ | $\text{Id}_A(a, b)$ | $\text{refl}$ | J |

### 9.2 Encoding Logical Connectives

**Negation.** $\neg P \stackrel{\text{def}}{=} P \to \mathbf{0}$. A proof of $\neg P$ is a function that, given any proof of $P$, derives a contradiction (an element of the empty type).

**Decidability.** $\text{Dec}(P) \stackrel{\text{def}}{=} P + \neg P$. A proof of $\text{Dec}(P)$ is either a proof of $P$ or a proof of $\neg P$. The law of excluded middle ($\forall P.\, P \lor \neg P$) is *not* provable in MLTT --- it is a constructive system. But it can be consistently added as an axiom.

**Double negation.** We can prove $P \to \neg\neg P$ but not $\neg\neg P \to P$ in general:

$$\lambda p.\, \lambda f.\, f(p) \;:\; P \to (P \to \mathbf{0}) \to \mathbf{0}$$

The reverse direction ($\neg\neg P \to P$) is equivalent to the law of excluded middle.

### 9.3 Predicates and Relations

A **predicate** on $A$ is a function $P : A \to \mathcal{U}$ assigning a type (proposition) to each element of $A$. A **binary relation** on $A$ is $R : A \to A \to \mathcal{U}$.

**Example 9.1.** The "less than" relation on natural numbers:

$$\text{lt} : \text{Nat} \to \text{Nat} \to \mathcal{U}$$

$$\text{lt}(m, n) \;\stackrel{\text{def}}{=}\; \Sigma(k : \text{Nat}).\, \text{Id}_{\text{Nat}}(m + \text{succ}(k), n)$$

"$m < n$ means there exists a positive $k$ such that $m + k + 1 = n$."

### 9.4 The Propositions-as-Types Principle vs. h-Propositions

A subtlety: under naive propositions-as-types, every type is a "proposition," including $\text{Nat}$, which has many elements. This conflates "data" and "proof."

In homotopy type theory and modern proof assistants, one distinguishes:

- **h-Propositions** (mere propositions): types $P$ such that any two elements are equal: $\Pi(p\, q : P).\, \text{Id}_P(p, q)$. These are the types that behave like propositions.
- **h-Sets:** Types where the identity type is an h-proposition.
- Higher h-levels: types with increasingly complex identity structure.

The truncation operator $\| A \|$ turns any type $A$ into an h-proposition by identifying all elements. Under this refinement:

$$\exists x \in A.\, P(x) \quad \longleftrightarrow \quad \| \Sigma(x : A).\, P(x) \|$$

The truncation forgets the witness, retaining only the information that *some* witness exists.

---

## 10. Function Extensionality

### 10.0 The Problem

In intensional MLTT, two functions $f, g : A \to B$ are definitionally equal only if they reduce to syntactically identical normal forms. But we often want to say that $f$ and $g$ are equal if they agree on all inputs:

$$\text{FunExt} \;\stackrel{\text{def}}{=}\; \Pi(A\, B : \mathcal{U}).\, \Pi(f\, g : A \to B).\, (\Pi(x : A).\, \text{Id}_B(f(x), g(x))) \to \text{Id}_{A \to B}(f, g)$$

This is the **function extensionality** principle. It is *not* provable in intensional MLTT. It can be added as an axiom (and is consistent), but doing so breaks canonicity: there would be closed terms of type $\text{Nat}$ that do not reduce to a numeral (because they contain uses of the function extensionality axiom that cannot be computed away).

**Solutions:**

- **Extensional type theory:** Function extensionality is derivable (from equality reflection), but type checking is undecidable.
- **Cubical type theory:** Function extensionality is derivable *and* has computational content, preserving canonicity.
- **Observational type theory:** Function extensionality is built in, with decidable type checking.
- **Axiomatic approach:** Add function extensionality as an axiom in intensional MLTT. This is consistent but breaks canonicity.

---

## 10.5 Additional Type Formers

### 10.1 The Empty Type ($\mathbf{0}$)

**Formation:** $\mathbf{0} \; \text{type}$

**Introduction:** None. The empty type has no constructors.

**Elimination (ex falso quodlibet):**

$$\frac{\Gamma \vdash e : \mathbf{0} \qquad \Gamma, x : \mathbf{0} \vdash C(x) \; \text{type}}{\Gamma \vdash \text{abort}(C, e) : C(e)} \; (\mathbf{0}\text{-Elim})$$

From a proof of falsehood, we can prove anything.

### 10.2 The Unit Type ($\mathbf{1}$)

**Formation:** $\mathbf{1} \; \text{type}$

**Introduction:** $\star : \mathbf{1}$

**Elimination:**

$$\frac{\Gamma \vdash u : \mathbf{1} \qquad \Gamma, x : \mathbf{1} \vdash C(x) \; \text{type} \qquad \Gamma \vdash c : C(\star)}{\Gamma \vdash \mathbf{1}\text{-elim}(C, c, u) : C(u)} \; (\mathbf{1}\text{-Elim})$$

**Computation:** $\mathbf{1}\text{-elim}(C, c, \star) \equiv c$

**Eta:** $u \equiv \star$ for all $u : \mathbf{1}$

### 10.3 The Boolean Type ($\text{Bool}$)

**Formation:** $\text{Bool} \; \text{type}$

**Introduction:** $\text{true} : \text{Bool}$ and $\text{false} : \text{Bool}$

**Elimination:**

$$\frac{\Gamma \vdash b : \text{Bool} \qquad \Gamma, x : \text{Bool} \vdash C(x) \; \text{type} \qquad \Gamma \vdash c_t : C(\text{true}) \qquad \Gamma \vdash c_f : C(\text{false})}{\Gamma \vdash \text{if}(C, b, c_t, c_f) : C(b)} \; (\text{Bool-Elim})$$

**Computation rules:**

$$\text{if}(C, \text{true}, c_t, c_f) \equiv c_t \qquad \text{if}(C, \text{false}, c_t, c_f) \equiv c_f$$

### 10.4 Coproduct Type ($A + B$)

**Formation:**

$$\frac{\Gamma \vdash A \; \text{type} \qquad \Gamma \vdash B \; \text{type}}{\Gamma \vdash A + B \; \text{type}}$$

**Introduction:**

$$\frac{\Gamma \vdash a : A}{\Gamma \vdash \text{inl}(a) : A + B} \qquad \frac{\Gamma \vdash b : B}{\Gamma \vdash \text{inr}(b) : A + B}$$

**Elimination:**

$$\frac{\begin{array}{c} \Gamma \vdash s : A + B \qquad \Gamma, z : A + B \vdash C(z) \; \text{type} \\ \Gamma, a : A \vdash c_l(a) : C(\text{inl}(a)) \qquad \Gamma, b : B \vdash c_r(b) : C(\text{inr}(b)) \end{array}}{\Gamma \vdash \text{case}(C, c_l, c_r, s) : C(s)}$$

**Computation:**

$$\text{case}(C, c_l, c_r, \text{inl}(a)) \equiv c_l(a) \qquad \text{case}(C, c_l, c_r, \text{inr}(b)) \equiv c_r(b)$$

---

## 11. Metatheory

### 11.1 Consistency

**Theorem 11.1.** *Martin-Lof type theory (with the predicative universe hierarchy) is consistent: the empty type $\mathbf{0}$ is not inhabited in the empty context.*

*Proof sketch.* By constructing a set-theoretic model: interpret types as sets, Pi types as dependent function sets, Sigma types as dependent pair sets, $\text{Nat}$ as $\mathbb{N}$, identity types as singletons (when the two sides are equal) or the empty set (otherwise), and $\mathcal{U}_i$ as a sufficiently large Grothendieck universe. Since $\emptyset$ has no elements in the model, $\mathbf{0}$ is not inhabited. $\square$

### 11.2 Canonicity

**Theorem 11.2 (Canonicity).** *Every closed term of type $\text{Nat}$ in MLTT reduces to a numeral $\text{succ}^n(0)$.*

This is a fundamental property: closed programs of ground type always compute to canonical values. It ensures that MLTT is a genuine programming language, not just a logical system. Canonicity fails if non-constructive axioms (like excluded middle or univalence, without a computational interpretation) are added.

*Proof sketch.* By the strong normalization theorem, the closed term $t : \text{Nat}$ has a normal form $t'$. Since $t$ is closed (no free variables), $t'$ cannot contain any free variables. By inspection of the normal forms of the Nat type: the only closed normal forms of type Nat are $0$ and $\text{succ}(t'')$ where $t''$ is a closed normal form of type Nat. By induction on the size of $t'$, we conclude $t' = \text{succ}^n(0)$ for some $n \geq 0$. $\square$

**Remark.** Canonicity extends to other types:

- Every closed term of type $\text{Bool}$ reduces to $\text{true}$ or $\text{false}$.
- Every closed term of type $A + B$ reduces to $\text{inl}(a)$ or $\text{inr}(b)$.
- Every closed term of type $\Sigma(x : A).\, B(x)$ reduces to a pair $(a, b)$.
- Every closed term of type $\Pi(x : A).\, B(x)$ reduces to a lambda $\lambda(x : A).\, b(x)$.

The last point uses the eta rule: every element of a Pi type is a function.

### 11.3 Normalization

**Theorem 11.3 (Strong Normalization).** *Every well-typed term in MLTT (without general recursion) is strongly normalizing: every reduction sequence terminates.*

The proof is by a logical relations / reducibility candidates argument. The key idea:

1. Define a family of "reducibility" predicates $\mathcal{R}_A$ for each type $A$, where $t \in \mathcal{R}_A$ means "$t$ is a well-behaved term of type $A$."
2. For base types (Nat, Bool), $\mathcal{R}_A$ contains the strongly normalizing terms.
3. For function types, $\mathcal{R}_{\Pi(x:A).B(x)}$ contains terms $f$ such that for all $a \in \mathcal{R}_A$, $f(a) \in \mathcal{R}_{B(a)}$.
4. For Sigma types, $\mathcal{R}_{\Sigma(x:A).B(x)}$ contains pairs $(a, b)$ with $a \in \mathcal{R}_A$ and $b \in \mathcal{R}_{B(a)}$.
5. Show that every well-typed term is in the appropriate reducibility set.
6. Since all reducibility sets contain only strongly normalizing terms, conclude.

The main technical difficulty for dependent types (compared to simple types) is that the definition of $\mathcal{R}_{B(a)}$ depends on the *value* of $a$, so the logical relation must be defined by induction on types *and* simultaneously on terms. This mutual dependency requires a sophisticated induction argument.

### 11.4 Decidability of Type Checking

**Theorem 11.4.** *Type checking for intensional MLTT (without equality reflection) is decidable, assuming the termination of all well-typed terms.*

The proof relies on the decidability of definitional equality (via normalization) and the decidability of all other judgments given decidable definitional equality. The bidirectional type-checking algorithm described in Lecture 08a provides an effective procedure.

The decision procedure works as follows:

1. **Checking $\Gamma \vdash A \; \text{type}$:** Infer the type of $A$; it should be a universe $\mathcal{U}_i$.
2. **Checking $\Gamma \vdash a : A$:** Use bidirectional type checking (switching between inference and checking modes).
3. **Checking $\Gamma \vdash A \equiv B$:** Normalize both $A$ and $B$ to WHNF and compare structurally, reducing subterms lazily as needed.
4. **Checking $\Gamma \vdash a \equiv b : A$:** Normalize both $a$ and $b$ and compare structurally.

Each step is effective because normalization terminates (by strong normalization) and structural comparison is decidable.

---

## 12. Extended Examples and Proof Techniques

### 12.1 Proof of Commutativity of Addition

**Proposition 12.1.** *For all $m, n : \text{Nat}$, $\text{add}(m, n) =_{\text{Nat}} \text{add}(n, m)$.*

This is a non-trivial proof requiring two auxiliary lemmas.

**Lemma 12.2 (Right zero).** $\Pi(n : \text{Nat}).\, \text{Id}_{\text{Nat}}(\text{add}(n, 0), n)$.

*Proof.* By induction on $n$. Base case: $\text{add}(0, 0) \equiv 0$, so $\text{refl}_0$. Inductive step: given $p : \text{add}(n, 0) =_{\text{Nat}} n$, we need $\text{add}(\text{succ}(n), 0) =_{\text{Nat}} \text{succ}(n)$. Since $\text{add}(\text{succ}(n), 0) \equiv \text{succ}(\text{add}(n, 0))$, we use $\text{ap}(\text{succ}, p)$. $\square$

**Lemma 12.3 (Right successor).** $\Pi(m\, n : \text{Nat}).\, \text{Id}_{\text{Nat}}(\text{add}(m, \text{succ}(n)), \text{succ}(\text{add}(m, n)))$.

*Proof.* By induction on $m$. Base case: $\text{add}(0, \text{succ}(n)) \equiv \text{succ}(n) \equiv \text{succ}(\text{add}(0, n))$, so $\text{refl}$. Inductive step: given the inductive hypothesis $\text{IH}(n) : \text{add}(m, \text{succ}(n)) =_{\text{Nat}} \text{succ}(\text{add}(m, n))$, we need:

$$\text{add}(\text{succ}(m), \text{succ}(n)) =_{\text{Nat}} \text{succ}(\text{add}(\text{succ}(m), n))$$

The left side computes: $\text{add}(\text{succ}(m), \text{succ}(n)) \equiv \text{succ}(\text{add}(m, \text{succ}(n)))$.

The right side computes: $\text{succ}(\text{add}(\text{succ}(m), n)) \equiv \text{succ}(\text{succ}(\text{add}(m, n)))$.

By $\text{IH}(n)$, $\text{add}(m, \text{succ}(n)) =_{\text{Nat}} \text{succ}(\text{add}(m, n))$. Applying $\text{ap}(\text{succ}, -)$:

$$\text{succ}(\text{add}(m, \text{succ}(n))) =_{\text{Nat}} \text{succ}(\text{succ}(\text{add}(m, n)))$$

This is exactly what we need. $\square$

**Proof of commutativity.** By induction on $m$.

Base case ($m = 0$): We need $\text{add}(0, n) =_{\text{Nat}} \text{add}(n, 0)$. The left side is $n$. The right side equals $n$ by Lemma 12.2.

Inductive step: Given $\text{IH}(n) : \text{add}(m, n) =_{\text{Nat}} \text{add}(n, m)$, we need:

$$\text{add}(\text{succ}(m), n) =_{\text{Nat}} \text{add}(n, \text{succ}(m))$$

Left: $\text{add}(\text{succ}(m), n) \equiv \text{succ}(\text{add}(m, n))$.

By $\text{IH}$: $\text{succ}(\text{add}(m, n)) =_{\text{Nat}} \text{succ}(\text{add}(n, m))$ (via $\text{ap}(\text{succ}, \text{IH}(n))$).

By Lemma 12.3: $\text{add}(n, \text{succ}(m)) =_{\text{Nat}} \text{succ}(\text{add}(n, m))$.

Composing by symmetry and transitivity:

$$\text{succ}(\text{add}(m, n)) =_{\text{Nat}} \text{succ}(\text{add}(n, m)) =_{\text{Nat}} \text{add}(n, \text{succ}(m)) \quad \square$$

### 12.2 The Encode-Decode Method

The **encode-decode method** is a powerful technique for characterizing identity types of specific types. The idea: for a type $A$ with a specific structure, define a type family $\text{Code}(a, b)$ that describes what it *means* for $a$ and $b$ to be equal (without using the identity type), then prove $\text{Id}_A(a, b) \simeq \text{Code}(a, b)$.

**Example: Characterizing $\text{Id}_{\text{Nat}}(m, n)$.**

Define $\text{Code} : \text{Nat} \to \text{Nat} \to \mathcal{U}$ by double recursion:

$$\text{Code}(0, 0) \stackrel{\text{def}}{=} \mathbf{1}$$

$$\text{Code}(0, \text{succ}(n)) \stackrel{\text{def}}{=} \mathbf{0}$$

$$\text{Code}(\text{succ}(m), 0) \stackrel{\text{def}}{=} \mathbf{0}$$

$$\text{Code}(\text{succ}(m), \text{succ}(n)) \stackrel{\text{def}}{=} \text{Code}(m, n)$$

**Encoding:** $\text{encode} : \Pi(m\, n : \text{Nat}).\, \text{Id}_{\text{Nat}}(m, n) \to \text{Code}(m, n)$

This is defined using transport: $\text{encode}(m, n, p) \stackrel{\text{def}}{=} \text{transport}(\lambda k.\, \text{Code}(m, k),\; p,\; r(m))$ where $r : \Pi(m : \text{Nat}).\, \text{Code}(m, m)$ is the reflexivity code ($\star$ at each level).

**Decoding:** $\text{decode} : \Pi(m\, n : \text{Nat}).\, \text{Code}(m, n) \to \text{Id}_{\text{Nat}}(m, n)$

Defined by induction on $m$ and $n$: at $(0, 0)$, return $\text{refl}_0$; at $(\text{succ}(m), \text{succ}(n))$, apply $\text{ap}(\text{succ})$ to the recursive result.

**Theorem 12.4.** $\text{Id}_{\text{Nat}}(m, n) \simeq \text{Code}(m, n)$ for all $m, n$.

*Proof.* Show encode and decode are inverse. This is the encode-decode method. The key consequence:

**Corollary 12.5 (Peano axioms in MLTT).**

1. $\text{succ}$ is injective: $\text{succ}(m) = \text{succ}(n) \to m = n$.
2. $\text{succ}(n) \neq 0$: $\neg\,\text{Id}_{\text{Nat}}(\text{succ}(n), 0)$.
3. $\text{Nat}$ is an h-set (has decidable equality and satisfies UIP).

### 12.3 Finite Types via Nat Recursion

We can define the type $\text{Fin}(n)$ of natural numbers less than $n$ inductively:

**$\text{Fin}$ as an inductive family:**

$$\text{Fin} : \text{Nat} \to \mathcal{U}$$

with constructors:

$$\text{fzero} : \Pi(n : \text{Nat}).\, \text{Fin}(\text{succ}(n))$$

$$\text{fsucc} : \Pi(n : \text{Nat}).\, \text{Fin}(n) \to \text{Fin}(\text{succ}(n))$$

**Observation:** $\text{Fin}(0)$ is empty (there are no constructors that produce $\text{Fin}(0)$). $\text{Fin}(1)$ has one element ($\text{fzero}(0)$). $\text{Fin}(n)$ has exactly $n$ elements.

**Proposition 12.6.** *$\text{Fin}(n) \simeq \Sigma(k : \text{Nat}).\, (k < n)$ where $k < n$ is defined as $\Sigma(d : \text{Nat}).\, \text{Id}_{\text{Nat}}(\text{succ}(k + d), n)$.*

This equivalence connects the inductive definition of $\text{Fin}$ with the subset-type definition using Sigma types.

---

## 13. Identity Types: Advanced Topics

### 13.1 The Fundamental Theorem of Identity Types

**Theorem 13.1 (Fundamental Theorem).** *For a type $A$, a point $a : A$, and a type family $R : A \to \mathcal{U}$ equipped with:*

- *$r : R(a)$ (a "reflexivity" element)*
- *$\text{based-elim} : \Pi(x : A).\, R(x) \to \text{Id}_A(a, x)$ (a map from $R$ to identity)*

*the following are equivalent:*

1. *$R$ is a fiberwise equivalence: for all $x : A$, the map $R(x) \to \text{Id}_A(a, x)$ is an equivalence.*
2. *The total space $\Sigma(x : A).\, R(x)$ is contractible.*

This theorem provides the key tool for characterizing identity types: to show $\text{Id}_A(a, x) \simeq R(x)$, it suffices to show that $\Sigma(x : A).\, R(x)$ is contractible.

### 13.2 The Path Space Fibration

The **path space** or **based path space** of a type $A$ at a point $a$ is:

$$\text{PathSpace}(A, a) \;\stackrel{\text{def}}{=}\; \Sigma(x : A).\, \text{Id}_A(a, x)$$

**Theorem 13.2 (Contractibility of Path Spaces).** *For any type $A$ and $a : A$, the based path space $\Sigma(x : A).\, \text{Id}_A(a, x)$ is contractible with center $(a, \text{refl}_a)$.*

*Proof.* We must show $\Pi(p : \Sigma(x : A).\, \text{Id}_A(a, x)).\, \text{Id}((a, \text{refl}_a), p)$.

Let $p = (x, q)$ where $q : \text{Id}_A(a, x)$. By J on $q$ with motive $D(x, q) = \text{Id}((a, \text{refl}_a), (x, q))$, it suffices to handle the case $x = a$, $q = \text{refl}_a$. Then $D(a, \text{refl}_a) = \text{Id}((a, \text{refl}_a), (a, \text{refl}_a))$, which is inhabited by $\text{refl}$. $\square$

This is one of the most fundamental results in homotopy type theory. It says that the space of all paths starting at $a$ is contractible --- a type-theoretic version of the fact that the space of paths in a topological space starting at a fixed point is contractible.

### 13.3 Equality of Sigma Types (Dependent Pair Equality)

**Theorem 13.3.** *Given $(a_1, b_1), (a_2, b_2) : \Sigma(x : A).\, B(x)$, there is an equivalence:*

$$\text{Id}_{\Sigma(x : A).\, B(x)}((a_1, b_1), (a_2, b_2)) \;\simeq\; \Sigma(p : \text{Id}_A(a_1, a_2)).\, \text{Id}_{B(a_2)}(\text{transport}(B, p, b_1), b_2)$$

*Informally:* two dependent pairs are equal if and only if their first components are equal and their second components are equal after transporting along the equality of first components.

*Proof sketch.* Forward: Given $r : (a_1, b_1) =_\Sigma (a_2, b_2)$, apply $\text{ap}(\pi_1)$ to get $p : a_1 =_A a_2$, then use the dependent version of $\text{ap}$ to get the second component equality.

Backward: Given $(p, q)$, use J on $p$ to reduce to the case $a_1 = a_2$ and $p = \text{refl}$, where transport is the identity and $q : b_1 =_{B(a_1)} b_2$ gives $(a_1, b_1) = (a_1, b_2)$ by $\text{ap}(\lambda b.\, (a_1, b), q)$. $\square$

---

## 14. Exercises

### Exercise 14.1

Define the **less-than-or-equal** relation on natural numbers as an inductive family:

$$\text{leq} : \text{Nat} \to \text{Nat} \to \mathcal{U}$$

with constructors $\text{leq-refl} : \Pi(n : \text{Nat}).\, \text{leq}(n, n)$ and $\text{leq-step} : \Pi(m\, n : \text{Nat}).\, \text{leq}(m, n) \to \text{leq}(m, \text{succ}(n))$. Prove that $\text{leq}$ is transitive.

### Exercise 14.2

Using the J eliminator, prove that identity is an equivalence relation: construct terms for reflexivity, symmetry, and transitivity, and verify the computation rules on $\text{refl}$.

### Exercise 14.3

Define the **dependent ap** (also called $\text{apd}$): given $f : \Pi(x : A).\, B(x)$ and $p : \text{Id}_A(a, b)$, construct:

$$\text{apd}(f, p) : \text{Id}_{B(b)}(\text{transport}(B, p, f(a)), f(b))$$

### Exercise 14.4

Prove that the natural numbers are an h-set: $\Pi(m\, n : \text{Nat}).\, \Pi(p\, q : \text{Id}_{\text{Nat}}(m, n)).\, \text{Id}(p, q)$. (Hint: use the encode-decode method from Section 12.2.)

### Exercise 14.5

Using W-types, define the type of **rose trees** (trees where each node has a list of children). Specify the type $A$ of constructors and the arity family $B$.

### Exercise 14.6

Prove that in any Martin-Lof type theory with $\mathbf{0}$ (empty type) and identity types, we have $\neg\,\text{Id}_{\text{Bool}}(\text{true}, \text{false})$. That is, construct a term of type $\text{Id}_{\text{Bool}}(\text{true}, \text{false}) \to \mathbf{0}$. (Hint: define a type family $P : \text{Bool} \to \mathcal{U}$ with $P(\text{true}) = \mathbf{1}$ and $P(\text{false}) = \mathbf{0}$, then use transport.)

### Exercise 14.7

Define the type of **well-typed simply typed lambda calculus terms** as an inductive family indexed by a context and a type. The type should have the structure:

$$\text{Term} : \text{Ctx} \to \text{Ty} \to \mathcal{U}$$

with constructors corresponding to the typing rules. Explain how this is an example of **intrinsic typing** (terms carry their typing derivations) as opposed to **extrinsic typing** (terms are untyped syntax annotated with a separate typing judgment).

### Exercise 14.8

In the Tarski-style universe formulation, define codes for Pi and Sigma types and give their decoding:

$$\hat{\Pi}(a, b) : \mathcal{U} \qquad \text{El}(\hat{\Pi}(a, b)) = \Pi(x : \text{El}(a)).\, \text{El}(b(x))$$

$$\hat{\Sigma}(a, b) : \mathcal{U} \qquad \text{El}(\hat{\Sigma}(a, b)) = \Sigma(x : \text{El}(a)).\, \text{El}(b(x))$$

What is the type of $b$ in each case? (It should be a *code-valued* function, not a type-valued function.)

### Exercise 14.9

State and prove Hedberg's theorem: if $A$ has decidable equality ($\Pi(a\, b : A).\, \text{Id}(a, b) + \neg\text{Id}(a, b)$), then $A$ is an h-set ($\Pi(a\, b : A).\, \Pi(p\, q : \text{Id}(a, b)).\, \text{Id}(p, q)$).

*Hint:* The key step is to show that if $A$ has decidable equality, then every identity proof $p : \text{Id}(a, b)$ can be factored as $\text{trans}(\text{sym}(k(a)), k(b))$ where $k : \Pi(x : A).\, \text{Id}(a, x)$ is a "constant" function derived from the decision procedure. Since $k$ is determined by the decision procedure (not by $p$), different proofs $p$ and $q$ yield the same factorization.

### Exercise 14.10

The **interval type** $\mathbb{I}$ has two constructors $0_{\mathbb{I}}$ and $1_{\mathbb{I}}$ and a path $\text{seg} : \text{Id}_{\mathbb{I}}(0_{\mathbb{I}}, 1_{\mathbb{I}})$. Show that if $\mathbb{I}$ exists in MLTT with its eliminator, then function extensionality is derivable. (Hint: given $f, g : A \to B$ with $h : \Pi(x : A).\, \text{Id}_B(f(x), g(x))$, define $k : \mathbb{I} \to (A \to B)$ with $k(0_{\mathbb{I}}) = f$ and $k(1_{\mathbb{I}}) = g$, then apply $\text{ap}(k, \text{seg})$.)

### Exercise 14.11

Define a type of **well-typed lambda terms** in the simply typed lambda calculus, using dependent types to ensure well-typedness by construction. Your definition should use:

- A type $\text{Ty}$ of simple types (base type and arrow type).
- A type family $\text{Ctx} = \text{List}(\text{Ty})$ for typing contexts.
- A type family $\text{Term} : \text{Ctx} \to \text{Ty} \to \mathcal{U}$ of well-typed terms.

with constructors for variables (using de Bruijn indices with a proof of in-bounds), lambda abstraction, and application.

### Exercise 14.12

Prove that the type $\Sigma(A : \mathcal{U}).\, A$ is not contractible. (Hint: find two distinct elements.) Then prove that $\Sigma(A : \mathcal{U}).\, (A \simeq \text{Bool})$ is contractible (assuming univalence).

### Exercise 14.13

Define the **free monoid** on a type $A$ (i.e., $\text{List}(A)$) as a W-type. Specify the constructor type $C$ and the arity family $B$, and show how the list constructors $\text{nil}$ and $\text{cons}$ arise from the $\text{sup}$ constructor of the W-type.

### Exercise 14.14 (Challenge)

Consider adding a **recursion principle** (non-dependent eliminator) for the identity type:

$$\text{Id-rec} : \Pi(A : \mathcal{U}).\, \Pi(C : A \to A \to \mathcal{U}).\, (\Pi(a : A).\, C(a, a)) \to \Pi(a\, b : A).\, \text{Id}_A(a, b) \to C(a, b)$$

Show that $\text{Id-rec}$ is derivable from J (the dependent eliminator). Then show that J is *not* derivable from $\text{Id-rec}$ alone --- what additional data would be needed?

(Hint: consider what information is lost when the motive $C(x, y, q)$ does not depend on the proof $q$.)

---

## Summary

- Martin-Lof type theory has **four forms of judgment**: type formation, term typing, type equality, and term equality.
- Each type former follows a **four-rule schema**: formation, introduction, elimination, computation (plus optional eta).
- The **natural number type** is introduced by $0$ and $\text{succ}$, with elimination by the induction principle.
- **Identity types** $\text{Id}_A(a, b)$ are introduced by $\text{refl}$ and eliminated by the **J rule**. From J, one derives symmetry, transitivity, congruence, and transport.
- **Intensional** type theory keeps propositional and definitional equality separate; **extensional** type theory collapses them (at the cost of undecidable type checking).
- **W-types** provide a general schema for well-founded inductive types.
- The **universe hierarchy** $\mathcal{U}_0 : \mathcal{U}_1 : \ldots$ avoids Girard's paradox. Universe polymorphism makes it practical.
- Under propositions-as-types, MLTT encodes **full first-order constructive logic**.

---

## Further Reading

1. **Martin-Lof, P.** (1984). *Intuitionistic Type Theory*. Bibliopolis. The canonical reference.

2. **Martin-Lof, P.** (1979). "Constructive Mathematics and Computer Programming." In *Proceedings of the 6th International Congress of Logic, Methodology and Philosophy of Science*. The mature formulation with W-types.

3. **Nordstrom, B., Petersson, K., and Smith, J.** (1990). *Programming in Martin-Lof's Type Theory*. Oxford University Press. A comprehensive textbook treatment.

4. **Hofmann, M. and Streicher, T.** (1998). "The Groupoid Interpretation of Type Theory." In *Twenty-Five Years of Constructive Type Theory*. The seminal paper showing UIP is independent of ITT.

5. **The Univalent Foundations Program.** (2013). *Homotopy Type Theory: Univalent Foundations of Mathematics*. The modern take on MLTT with homotopical identity types.

6. **Coquand, T.** (2019). "Canonicity and Normalization for Dependent Type Theory." *Theoretical Computer Science*, 777:184--191.

7. **Girard, J.-Y.** (1972). *Interpretation fonctionnelle et elimination des coupures de l'arithmetique d'ordre superieur*. PhD thesis. Contains the paradox ruling out $\mathcal{U} : \mathcal{U}$.

8. **Abel, A., Oury, N., and Vezzosi, A.** (2017). "Normalization by Evaluation for Sized Dependent Types." *ICFP 2017*.

9. **Dybjer, P.** (1997). "Representing Inductively Defined Sets by Wellorderings in Martin-Lof's Type Theory." *Theoretical Computer Science*, 176(1-2):329--335. The definitive treatment of W-types.

10. **Streicher, T.** (1993). *Investigations into Intensional Type Theory*. Habilitation thesis, LMU Munich. A deep study of the intensional identity type.
