---
title: "Lecture 04a: The Subtyping Relation"
tags:
  - type-theory
  - subtyping
  - lecture
---
# Lecture 04a: The Subtyping Relation

> **Module 04 -- Subtyping (Weeks 7-8)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Articulate** the principle of safe substitution and its connection to the Liskov Substitution Principle.
2. **State** the subsumption rule and explain how it integrates subtyping into the typing relation.
3. **Define** the subtype relation $S <: T$ axiomatically and derive subtyping judgments.
4. **Prove** that the arrow subtyping rule is contravariant in the domain and covariant in the codomain, and explain why this must be so.
5. **Formalize** the $\top$ and $\bot$ types and their role in the subtype lattice.
6. **Derive** subtyping rules for product types, sum types, and record types.
7. **Distinguish** width subtyping, depth subtyping, and permutation subtyping for records.
8. **Construct** subtype derivation trees for compound types involving arrows, products, and records.

---

## 1. Motivation

### 1.1 The Problem of Rigid Type Equality

In the simply typed lambda calculus as developed in Module 02, function application $t_1\; t_2$ requires an exact match between the type of the argument and the domain of the function. If $\Gamma \vdash t_1 : T_{11} \to T_{12}$ and $\Gamma \vdash t_2 : T_{11}$, then $\Gamma \vdash t_1\; t_2 : T_{12}$. The argument type must be literally $T_{11}$ -- no exceptions.

This rigidity is both a strength and a weakness. It is a strength because the type system is simple and its metatheory (progress, preservation) is straightforward to establish. It is a weakness because it rejects programs that are clearly safe.

Consider a function that expects a record with a single field:

$$f : \{x : \text{Nat}\} \to \text{Nat}$$

Should we be permitted to pass a record $\{x = 3, y = \text{true}\}$ of type $\{x : \text{Nat}, y : \text{Bool}\}$ to $f$? Intuitively, yes: $f$ only uses the $x$ field, and the presence of an extra $y$ field cannot cause harm. The function $f$ will still find the $x$ field it needs, and will never access $y$.

Yet in the STLC without subtyping, this application is ill-typed because $\{x : \text{Nat}, y : \text{Bool}\} \neq \{x : \text{Nat}\}$.

### 1.2 Safe Substitution

The core insight behind subtyping is the **principle of safe substitution**: if $S$ is a subtype of $T$, then any term of type $S$ can safely be used wherever a term of type $T$ is expected. The program will still behave correctly -- it will not get stuck.

This principle has deep roots in software engineering. Barbara Liskov articulated a behavioral version in her 1987 keynote (published as Liskov 1988):

> If for each object $o_1$ of type $S$ there is an object $o_2$ of type $T$ such that for all programs $P$ defined in terms of $T$, the behavior of $P$ is unchanged when $o_1$ is substituted for $o_2$, then $S$ is a subtype of $T$.

This is the **Liskov Substitution Principle** (LSP). Our type-theoretic formulation will be a structural analogue: we define the subtype relation $S <: T$ by examining the structure of types, ensuring that any context expecting a $T$ will operate correctly when given an $S$.

### 1.3 Subtyping in Practice

Subtyping appears throughout programming language design:

- **Object-oriented languages** (Java, C#, Scala): class inheritance induces a subtype hierarchy. If `Dog extends Animal`, then `Dog` is a subtype of `Animal`.
- **Structural type systems** (TypeScript, OCaml's object types, Go interfaces): subtyping is determined by structure rather than declared inheritance.
- **Record types**: a record with more fields is a subtype of one with fewer fields (width subtyping).
- **Numeric hierarchies**: `Int <: Float` in many languages, reflecting the mathematical $\mathbb{Z} \subseteq \mathbb{R}$.

We will develop subtyping as a purely structural, type-theoretic concept, divorced from any particular language's object system.

### 1.4 Roadmap

This lecture introduces:
1. The subsumption rule that bridges subtyping and typing.
2. The subtype relation $S <: T$, defined by inference rules.
3. Subtyping for function types (the most subtle case).
4. The $\top$ and $\bot$ types.
5. Subtyping for base types, products, sums, and records.

---

## 2. Core Theory

### 2.1 The Language

We work with the simply typed lambda calculus extended with base types, products, sums, and records. The syntax is:

**Types:**

$$T ::= \text{Bool} \mid \text{Nat} \mid T_1 \to T_2 \mid T_1 \times T_2 \mid T_1 + T_2 \mid \{l_i : T_i\}_{i \in 1..n} \mid \top \mid \bot$$

**Terms:**

$$t ::= x \mid \lambda x : T.\, t \mid t_1\; t_2 \mid \text{true} \mid \text{false} \mid \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$$

$$\quad\mid\; 0 \mid \text{succ}\; t \mid \text{pred}\; t \mid \text{iszero}\; t$$

$$\quad\mid\; \{t_1, t_2\} \mid t.1 \mid t.2$$

$$\quad\mid\; \text{inl}\; t \mid \text{inr}\; t \mid \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2$$

$$\quad\mid\; \{l_i = t_i\}_{i \in 1..n} \mid t.l$$

**Values:**

$$v ::= \lambda x : T.\, t \mid \text{true} \mid \text{false} \mid nv \mid \{v_1, v_2\} \mid \text{inl}\; v \mid \text{inr}\; v \mid \{l_i = v_i\}_{i \in 1..n}$$

where $nv$ denotes numeric values ($0$, $\text{succ}\; nv$).

### 2.2 The Subsumption Rule

The bridge between the subtype relation and the typing relation is a single rule called **subsumption** (or sometimes **upcast**):

$$\frac{\Gamma \vdash t : S \qquad S <: T}{\Gamma \vdash t : T} \quad \text{(T-Sub)}$$

This rule says: if a term $t$ has type $S$, and $S$ is a subtype of $T$, then $t$ also has type $T$. The term $t$ itself does not change -- we are merely "forgetting" information about its type, viewing it at a less precise (super-)type.

**Remark 2.1.** Subsumption makes the typing relation fundamentally different from that of the STLC. In the STLC, each well-typed term has a unique type (up to alpha-equivalence of type variables, which we do not yet have). With subsumption, a term may have many types. For example, if $S <: T$, then any term of type $S$ also has type $T$, and if $T <: U$, it also has type $U$, and so on up the subtype hierarchy.

**Remark 2.2.** Subsumption is not syntax-directed: nothing in the syntax of $t$ tells us when or whether to apply it. This is a significant complication for type checking, which we address in Lecture 04b.

**Example 2.3.** Suppose we have:
- $\Gamma \vdash t : \{x : \text{Nat}, y : \text{Bool}\}$
- $\{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$

Then by T-Sub:
- $\Gamma \vdash t : \{x : \text{Nat}\}$

We can now pass $t$ to any function expecting a $\{x : \text{Nat}\}$ argument.

### 2.3 The Subtype Relation: Definition

The subtype relation $S <: T$ is defined by a collection of inference rules. We introduce them in stages, beginning with the structural rules.

#### 2.3.1 Reflexivity and Transitivity

The subtype relation is a preorder: it is reflexive and transitive.

$$\frac{}{S <: S} \quad \text{(S-Refl)}$$

Every type is a subtype of itself. This ensures that any term of type $T$ can be used where a $T$ is expected (which was already true without subtyping).

$$\frac{S <: U \qquad U <: T}{S <: T} \quad \text{(S-Trans)}$$

Subtyping is transitive: if $S$ is a subtype of $U$ and $U$ is a subtype of $T$, then $S$ is a subtype of $T$. This allows us to chain subtyping steps.

**Remark 2.4.** In some formulations, the subtype relation is also antisymmetric (making it a partial order), but we do not require this in general. For many type systems, $S <: T$ and $T <: S$ does not necessarily imply $S = T$ syntactically, though it implies that $S$ and $T$ are interchangeable from the perspective of typing.

#### 2.3.2 The Top Type

The type $\top$ is the **supertype of all types**:

$$\frac{}{S <: \top} \quad \text{(S-Top)}$$

Every type $S$ is a subtype of $\top$. A term of type $\top$ carries essentially no information -- we know only that it is some well-typed value. The $\top$ type corresponds to `Object` in Java, `any` in TypeScript, or `object` in Python's type annotations.

**Remark 2.5.** The $\top$ type has limited computational utility on its own: given a term $t : \top$, there is almost nothing we can do with it since we do not know its structure. Its primary role is as a universal supertype in the subtype lattice, useful in positions where we wish to accept any type.

#### 2.3.3 The Bottom Type

The type $\bot$ is the **subtype of all types**:

$$\frac{}{\bot <: T} \quad \text{(S-Bot)}$$

$\bot$ is a subtype of every type $T$. There are no (closed, terminating) values of type $\bot$. The $\bot$ type is inhabited only by diverging computations or error-raising expressions.

**Remark 2.6.** The $\bot$ type is the return type of functions that never return normally:

$$\text{error} : \text{String} \to \bot$$

Since $\bot <: T$ for all $T$, a call to $\text{error}$ can appear in any context. In TypeScript, the `never` type plays this role. In Haskell, the type of `undefined` and `error` is polymorphic ($\forall a.\, a$), which achieves a similar effect through parametric polymorphism rather than subtyping.

**Remark 2.7.** By the Curry-Howard correspondence, $\top$ corresponds to the proposition that is trivially true (verum), while $\bot$ corresponds to the proposition that is false (falsum). Under this reading, $S <: T$ corresponds to logical entailment: $S$ implies $T$.

### 2.4 Subtyping for Function Types

The arrow subtyping rule is the most important and most counterintuitive rule in the system:

$$\frac{T_1 <: S_1 \qquad S_2 <: T_2}{S_1 \to S_2 <: T_1 \to T_2} \quad \text{(S-Arrow)}$$

Read this carefully. The function type $S_1 \to S_2$ is a subtype of $T_1 \to T_2$ when:
- The **domain** is **contravariant**: $T_1 <: S_1$ (note the reversal -- the subtype's domain is a supertype).
- The **codomain** is **covariant**: $S_2 <: T_2$ (same direction as the overall subtyping).

#### 2.4.1 Why Contravariance in the Domain?

This is the single most important thing to understand about subtyping. Let us reason through it carefully.

Suppose we have a function $f : S_1 \to S_2$ and we wish to use it in a context expecting a function of type $T_1 \to T_2$. The context will:

1. **Supply an argument of type $T_1$** to $f$. For $f$ to handle this argument correctly, $f$ must be able to accept anything of type $T_1$. Since $f$ accepts arguments of type $S_1$, we need $T_1 <: S_1$: every $T_1$-value is also an $S_1$-value. That is, $f$'s domain must be at least as general as what the context promises to supply.

2. **Expect a result of type $T_2$** from $f$. Since $f$ returns results of type $S_2$, we need $S_2 <: T_2$: every $S_2$-value is also a $T_2$-value. That is, $f$'s codomain must be at least as specific as what the context demands.

**Example 2.8.** Let `Animal` and `Dog` be types with `Dog <: Animal`. Consider:

$$f : \text{Animal} \to \text{Dog}$$

Is $f$ usable where a function of type $\text{Dog} \to \text{Animal}$ is expected?

- Domain: the context will supply a `Dog`. Can $f$ handle it? Yes, because $f$ accepts any `Animal`, and `Dog <: Animal`.
- Codomain: the context expects an `Animal`. Does $f$ deliver? Yes, because $f$ returns a `Dog`, and `Dog <: Animal`.

Therefore $\text{Animal} \to \text{Dog} <: \text{Dog} \to \text{Animal}$, as the rule predicts.

**Example 2.9.** Now consider the wrong direction: suppose we naively tried covariance in the domain:

$$g : \text{Dog} \to \text{Dog}$$

Is $g$ usable where a function of type $\text{Animal} \to \text{Dog}$ is expected? The context will supply an `Animal`. Can $g$ handle it? Not necessarily: $g$ expects a `Dog`, and a generic `Animal` might be a `Cat`. The program would go wrong.

This is why covariance in the domain is unsound.

#### 2.4.2 Worked Example: Arrow Subtyping Derivation

**Claim:** $(\top \to \text{Nat}) <: (\text{Nat} \to \top)$.

**Derivation:**

$$\frac{\displaystyle\frac{}{\text{Nat} <: \top} \; \text{(S-Top)} \qquad \displaystyle\frac{}{\text{Nat} <: \top} \; \text{(S-Top)}}{\top \to \text{Nat} <: \text{Nat} \to \top} \quad \text{(S-Arrow)}$$

Wait -- we need $\text{Nat} <: \top$ for the domain (contravariance: the sub-arrow's domain $\top$ must be a supertype of $\text{Nat}$, i.e., $\text{Nat} <: \top$, which holds by S-Top). And we need $\text{Nat} <: \top$ for the codomain (covariance), which also holds by S-Top.

Let us redo this more carefully. We want to show $\top \to \text{Nat} <: \text{Nat} \to \top$.

Here $S_1 = \top$, $S_2 = \text{Nat}$, $T_1 = \text{Nat}$, $T_2 = \top$.

The rule S-Arrow requires:
- $T_1 <: S_1$, i.e., $\text{Nat} <: \top$. Holds by S-Top.
- $S_2 <: T_2$, i.e., $\text{Nat} <: \top$. Holds by S-Top.

Therefore the derivation is:

$$\frac{\displaystyle\frac{}{\text{Nat} <: \top} \; \text{(S-Top)} \qquad \displaystyle\frac{}{\text{Nat} <: \top} \; \text{(S-Top)}}{\top \to \text{Nat} <: \text{Nat} \to \top} \quad \text{(S-Arrow)}$$

**Example 2.10.** Let us verify a non-example. Is $\text{Nat} \to \text{Nat} <: \text{Bool} \to \text{Nat}$?

The rule requires $\text{Bool} <: \text{Nat}$ (contravariance in domain). Unless we have a subtyping rule relating $\text{Bool}$ and $\text{Nat}$, this does not hold. The claim fails.

#### 2.4.3 Higher-Order Arrow Subtyping

Arrow subtyping composes through higher-order types. Consider:

$$(S_1 \to S_2) \to S_3 <: (T_1 \to T_2) \to T_3$$

By S-Arrow, this requires:
- $(T_1 \to T_2) <: (S_1 \to S_2)$ (contravariance in domain)
- $S_3 <: T_3$ (covariance in codomain)

The first premise, $(T_1 \to T_2) <: (S_1 \to S_2)$, by S-Arrow again requires:
- $S_1 <: T_1$ (contravariance flips again!)
- $T_2 <: S_2$ (covariance flips too)

So at the outermost level, $S_1$ appears in a doubly contravariant position (contra-contra = covariant), while $S_2$ appears in a contra-covariant position (contravariant overall).

**Key principle**: each $\to$ on the left side of another $\to$ flips the variance. The variance of a type parameter is determined by counting the number of times it appears to the left of an arrow:
- Even number of left-of-arrows: **covariant**
- Odd number of left-of-arrows: **contravariant**

#### 2.4.4 Variance Table for Nested Arrows

| Type | Position of $X$ | Variance |
|------|----------------|----------|
| $X \to T$ | Left of 1 arrow | Contravariant |
| $T \to X$ | Right of 1 arrow | Covariant |
| $(X \to T) \to U$ | Left of 2 arrows | Covariant (contra-contra) |
| $(T \to X) \to U$ | Left of 1 arrow (inner right, outer left) | Contravariant |
| $T \to (X \to U)$ | Left of 1 arrow (inner left) | Contravariant |
| $T \to (U \to X)$ | Right of all arrows | Covariant |
| $((X \to T) \to U) \to V$ | Left of 3 arrows | Contravariant |

This table can be computed mechanically by counting left-of-arrow occurrences, or by applying the S-Arrow rule recursively and tracking sign flips.

#### 2.4.5 The Invariant Case

A type parameter $X$ is **invariant** if it appears in both covariant and contravariant positions. For example, in $X \to X$, the first $X$ is contravariant and the second is covariant, making the overall variance invariant (neither covariant nor contravariant).

Formally, if $S <: T$, then in general neither $(S \to S) <: (T \to T)$ nor $(T \to T) <: (S \to S)$ holds. To see this:
- $(S \to S) <: (T \to T)$ requires $T <: S$ (domain) and $S <: T$ (codomain). Both cannot hold unless $S = T$ (up to mutual subtyping).

Invariance arises naturally in mutable data structures (see Section 10).

### 2.5 Subtyping for Base Types

We can add subtyping relationships between base types as desired. A common choice is:

$$\frac{}{\text{Bool} <: \text{Nat}} \quad \text{(S-BoolNat)}$$

This reflects the convention that $\text{false} = 0$ and $\text{true} = 1$ (or $\text{true} = \text{succ}\; 0$). Whether this rule is included is a design choice; many systems keep base types incomparable.

**Remark 2.11.** In a system with numeric subtyping, one might have $\text{Int} <: \text{Float}$, reflecting the mathematical inclusion $\mathbb{Z} \subseteq \mathbb{R}$. The operational semantics must then include coercions: an integer is implicitly converted to a floating-point representation when used as a float.

### 2.6 Subtyping for Product Types

Product types are **covariant in both components**:

$$\frac{S_1 <: T_1 \qquad S_2 <: T_2}{S_1 \times S_2 <: T_1 \times T_2} \quad \text{(S-Prod)}$$

**Justification.** A pair $(v_1, v_2) : S_1 \times S_2$ can safely be used where a $T_1 \times T_2$ is expected. If the context projects the first component, it gets $v_1 : S_1$, which by $S_1 <: T_1$ is also usable as a $T_1$. Similarly for the second component.

**Example 2.12.** If $\text{Dog} <: \text{Animal}$ and $\text{Nat} <: \top$, then:

$$\text{Dog} \times \text{Nat} <: \text{Animal} \times \top$$

**Remark 2.13.** Product types are covariant because projections only observe the components; they do not "write to" them. If we had mutable pairs where components could be updated, we would need invariance (see Lecture 04d for a discussion in the context of mutable references).

### 2.7 Subtyping for Sum Types

Sum types are also **covariant in both components**:

$$\frac{S_1 <: T_1 \qquad S_2 <: T_2}{S_1 + S_2 <: T_1 + T_2} \quad \text{(S-Sum)}$$

**Justification.** A value of type $S_1 + S_2$ is either $\text{inl}\; v_1$ with $v_1 : S_1$ or $\text{inr}\; v_2$ with $v_2 : S_2$. When used where $T_1 + T_2$ is expected, the context will case-analyze:
- If $\text{inl}\; v_1$: the left branch expects a $T_1$, and $v_1 : S_1$ with $S_1 <: T_1$, so this is safe.
- If $\text{inr}\; v_2$: similarly, $v_2 : S_2$ with $S_2 <: T_2$.

### 2.8 Subtyping for Record Types

Records are the richest source of subtyping structure. We have three independent subtyping dimensions.

#### 2.8.1 Width Subtyping

A record type with **more fields** is a subtype of one with fewer fields:

$$\frac{}{\{l_i : T_i\}_{i \in 1..n+k} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-RcdWidth)}$$

where $k \geq 0$.

**Intuition.** A record with extra fields can safely be used where fewer fields are expected: the extra fields are simply ignored. This is the record-level analogue of the motivating example from Section 1.1.

**Example 2.14.**

$$\{x : \text{Nat}, y : \text{Bool}, z : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$$

More fields means more information, which means a more specific (sub-)type.

#### 2.8.2 Depth Subtyping

Individual field types can be refined:

$$\frac{S_1 <: T_1 \quad \cdots \quad S_n <: T_n}{\{l_i : S_i\}_{i \in 1..n} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-RcdDepth)}$$

**Intuition.** If each field type $S_i$ is a subtype of the corresponding $T_i$, then the whole record is a subtype. Accessing the $l_i$ field gives a value of type $S_i$, which by $S_i <: T_i$ is usable as a $T_i$.

**Example 2.15.** If $\text{Dog} <: \text{Animal}$:

$$\{pet : \text{Dog}, age : \text{Nat}\} <: \{pet : \text{Animal}, age : \text{Nat}\}$$

#### 2.8.3 Permutation Subtyping

The order of fields does not matter:

$$\frac{\{k_j : S_j\}_{j \in 1..n} \text{ is a permutation of } \{l_i : T_i\}_{i \in 1..n}}{\{k_j : S_j\}_{j \in 1..n} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-RcdPerm)}$$

**Intuition.** Records are accessed by label, not by position. The order of fields in the type should not matter.

**Example 2.16.**

$$\{y : \text{Bool}, x : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Bool}\}$$

and vice versa (they are mutual subtypes).

**Remark 2.17.** In practice, we often combine all three record subtyping dimensions into a single rule. The combined rule states that $\{k_j : S_j\}_{j \in 1..m}$ is a subtype of $\{l_i : T_i\}_{i \in 1..n}$ if for every $i \in 1..n$, there exists $j \in 1..m$ such that $k_j = l_i$ and $S_j <: T_i$:

$$\frac{\forall i \in 1..n.\; \exists j \in 1..m.\; k_j = l_i \wedge S_j <: T_i}{\{k_j : S_j\}_{j \in 1..m} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-Rcd)}$$

This single rule subsumes width, depth, and permutation subtyping.

---

## 3. The Complete Subtyping Rules

We now collect all the subtyping rules into a single system. This is the **declarative** subtype relation for our language.

### 3.1 Structural Rules

$$\frac{}{S <: S} \quad \text{(S-Refl)}$$

$$\frac{S <: U \qquad U <: T}{S <: T} \quad \text{(S-Trans)}$$

### 3.2 Top and Bottom

$$\frac{}{S <: \top} \quad \text{(S-Top)}$$

$$\frac{}{\bot <: T} \quad \text{(S-Bot)}$$

### 3.3 Base Types

$$\frac{}{\text{Bool} <: \text{Nat}} \quad \text{(S-BoolNat)} \qquad \text{(optional)}$$

### 3.4 Function Types

$$\frac{T_1 <: S_1 \qquad S_2 <: T_2}{S_1 \to S_2 <: T_1 \to T_2} \quad \text{(S-Arrow)}$$

### 3.5 Product Types

$$\frac{S_1 <: T_1 \qquad S_2 <: T_2}{S_1 \times S_2 <: T_1 \times T_2} \quad \text{(S-Prod)}$$

### 3.6 Sum Types

$$\frac{S_1 <: T_1 \qquad S_2 <: T_2}{S_1 + S_2 <: T_1 + T_2} \quad \text{(S-Sum)}$$

### 3.7 Record Types

$$\frac{\forall i \in 1..n.\; \exists j \in 1..m.\; k_j = l_i \wedge S_j <: T_i}{\{k_j : S_j\}_{j \in 1..m} <: \{l_i : T_i\}_{i \in 1..n}} \quad \text{(S-Rcd)}$$

---

## 4. The Typing Rules with Subtyping

The typing rules for our language are those of the STLC with extensions (from Module 02-03), plus the subsumption rule. We list the key rules for reference.

### 4.1 Variables and Abstraction

$$\frac{x : T \in \Gamma}{\Gamma \vdash x : T} \quad \text{(T-Var)}$$

$$\frac{\Gamma, x : T_1 \vdash t_2 : T_2}{\Gamma \vdash \lambda x : T_1.\, t_2 : T_1 \to T_2} \quad \text{(T-Abs)}$$

$$\frac{\Gamma \vdash t_1 : T_{11} \to T_{12} \qquad \Gamma \vdash t_2 : T_{11}}{\Gamma \vdash t_1\; t_2 : T_{12}} \quad \text{(T-App)}$$

### 4.2 Subsumption

$$\frac{\Gamma \vdash t : S \qquad S <: T}{\Gamma \vdash t : T} \quad \text{(T-Sub)}$$

### 4.3 Records

$$\frac{\Gamma \vdash t_i : T_i \quad \text{for each } i \in 1..n}{\Gamma \vdash \{l_i = t_i\}_{i \in 1..n} : \{l_i : T_i\}_{i \in 1..n}} \quad \text{(T-Rcd)}$$

$$\frac{\Gamma \vdash t : \{l_i : T_i\}_{i \in 1..n} \qquad j \in 1..n}{\Gamma \vdash t.l_j : T_j} \quad \text{(T-Proj)}$$

### 4.4 Products

$$\frac{\Gamma \vdash t_1 : T_1 \qquad \Gamma \vdash t_2 : T_2}{\Gamma \vdash \{t_1, t_2\} : T_1 \times T_2} \quad \text{(T-Pair)}$$

$$\frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash t.1 : T_1} \quad \text{(T-Fst)} \qquad \frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash t.2 : T_2} \quad \text{(T-Snd)}$$

### 4.5 Sums

$$\frac{\Gamma \vdash t : T_1}{\Gamma \vdash \text{inl}\; t : T_1 + T_2} \quad \text{(T-Inl)} \qquad \frac{\Gamma \vdash t : T_2}{\Gamma \vdash \text{inr}\; t : T_1 + T_2} \quad \text{(T-Inr)}$$

$$\frac{\Gamma \vdash t : T_1 + T_2 \qquad \Gamma, x : T_1 \vdash t_1 : T \qquad \Gamma, y : T_2 \vdash t_2 : T}{\Gamma \vdash \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 : T} \quad \text{(T-Case)}$$

---

## 5. Properties of the Subtype Relation

### 5.1 Preorder Structure

**Proposition 5.1.** The relation $<:$ is a preorder on types: it is reflexive (S-Refl) and transitive (S-Trans).

This is immediate from the rules.

### 5.2 The Subtype Lattice

With $\top$ and $\bot$, the subtype relation forms a bounded preorder:
- $\bot$ is the bottom element: $\bot <: T$ for all $T$.
- $\top$ is the top element: $T <: \top$ for all $T$.

For certain type systems (particularly those with record types), the subtype relation forms a lattice, where every pair of types has a **join** (least upper bound) and a **meet** (greatest lower bound). We explore joins and meets in Lecture 04b.

### 5.3 Derived Subtyping Facts

**Proposition 5.2.** $\bot \to \top <: T_1 \to T_2$ for all types $T_1, T_2$.

*Proof.* By S-Arrow, we need $T_1 <: \bot$ and $\top <: T_2$. Wait -- that is wrong. We need $T_1 <: \bot$? No, let us recheck. S-Arrow says: to show $S_1 \to S_2 <: T_1 \to T_2$, we need $T_1 <: S_1$ and $S_2 <: T_2$. With $S_1 = \bot$ and $S_2 = \top$, we need $T_1 <: \bot$ and $\top <: T_2$. But $T_1 <: \bot$ does not hold in general (only $\bot <: T_1$). So the claim is false in general.

**Corrected Proposition 5.3.** $\top \to \bot <: T_1 \to T_2$ for all types $T_1, T_2$.

*Proof.* By S-Arrow with $S_1 = \top, S_2 = \bot$: we need $T_1 <: \top$ (by S-Top) and $\bot <: T_2$ (by S-Bot). $\square$

This is the "most specific" function type in the subtype ordering.

**Proposition 5.4.** $\bot \to \top$ is the "least specific" function type: $T_1 \to T_2 <: \bot \to \top$ for all types $T_1, T_2$.

*Proof.* By S-Arrow, we need $\bot <: T_1$ (by S-Bot) and $T_2 <: \top$ (by S-Top). $\square$

**Proposition 5.5.** $\bot <: S \to T$ for all $S, T$.

*Proof.* Immediate from S-Bot. $\square$

**Proposition 5.6.** $S \to T <: \top$ for all $S, T$.

*Proof.* Immediate from S-Top. $\square$

### 5.4 Non-Examples

It is equally important to understand what is **not** a subtype.

**Non-example 5.7.** $\text{Nat} \to \text{Nat} \not<: \text{Bool} \to \text{Nat}$ (without S-BoolNat).

For S-Arrow, we would need $\text{Bool} <: \text{Nat}$, which does not hold unless S-BoolNat is included.

**Non-example 5.8.** $\text{Nat} <: \text{Nat} \to \text{Nat}$ does not hold.

There is no rule that relates a base type to an arrow type.

**Non-example 5.9.** $\{x : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Bool}\}$ does not hold.

Subtyping for records goes in the direction of more fields being a subtype of fewer fields, not the reverse. A record with only $x$ cannot be used where both $x$ and $y$ are needed.

---

## 6. Extended Examples

### 6.1 Subtyping Derivation for Nested Records

**Claim:** $\{name : \top, data : \{x : \text{Nat}, y : \text{Nat}, z : \text{Nat}\}\} <: \{data : \{x : \text{Nat}, y : \text{Nat}\}\}$.

**Derivation:** By S-Rcd, we need for each field $l_i$ in the supertype, a corresponding field in the subtype with a compatible type.

The supertype has one field: $data : \{x : \text{Nat}, y : \text{Nat}\}$. The subtype has a $data$ field of type $\{x : \text{Nat}, y : \text{Nat}, z : \text{Nat}\}$. We need:

$$\{x : \text{Nat}, y : \text{Nat}, z : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Nat}\}$$

This holds by S-RcdWidth (or S-Rcd with the extra $z$ field). Combined with width subtyping at the outer level (the $name$ field is extra), the full derivation is:

$$\frac{\displaystyle\frac{\text{Nat} <: \text{Nat} \quad \text{Nat} <: \text{Nat}}{\{x : \text{Nat}, y : \text{Nat}, z : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Nat}\}} \; \text{(S-Rcd)}}{\{name : \top, data : \{x : \text{Nat}, y : \text{Nat}, z : \text{Nat}\}\} <: \{data : \{x : \text{Nat}, y : \text{Nat}\}\}} \quad \text{(S-Rcd)}$$

### 6.2 Subtyping and Functions on Records

Suppose we define:

$$\text{distance} : \{x : \text{Nat}, y : \text{Nat}\} \to \text{Nat}$$

We can apply this function to any record that has at least $x$ and $y$ fields of type $\text{Nat}$ (or subtypes thereof):

$$\text{distance}\; \{x = 3, y = 4, color = \text{true}\} : \text{Nat}$$

The argument has type $\{x : \text{Nat}, y : \text{Nat}, color : \text{Bool}\}$. By S-Rcd, this is a subtype of $\{x : \text{Nat}, y : \text{Nat}\}$. By T-Sub, the argument can be typed at $\{x : \text{Nat}, y : \text{Nat}\}$. By T-App, the application is well-typed.

### 6.3 Higher-Order Subtyping Example

**Claim:** $(\text{Nat} \to \text{Bool}) \to \text{Nat} <: (\top \to \text{Bool}) \to \top$.

**Step 1.** By S-Arrow at the outer level, we need:
- $(\top \to \text{Bool}) <: (\text{Nat} \to \text{Bool})$ (contravariance in domain)
- $\text{Nat} <: \top$ (covariance in codomain, by S-Top)

**Step 2.** For $(\top \to \text{Bool}) <: (\text{Nat} \to \text{Bool})$, by S-Arrow:
- $\text{Nat} <: \top$ (contravariance, by S-Top)
- $\text{Bool} <: \text{Bool}$ (covariance, by S-Refl)

All premises hold, so the claim is valid.

### 6.4 Typing Derivation with Subsumption

Consider the term:

$$(\lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; f\; \{x = 5\})\; (\lambda r : \{x : \text{Nat}, y : \text{Nat}\}.\; r.x)$$

The argument $\lambda r : \{x : \text{Nat}, y : \text{Nat}\}.\; r.x$ has type $\{x : \text{Nat}, y : \text{Nat}\} \to \text{Nat}$.

Is this a subtype of $\{x : \text{Nat}\} \to \text{Nat}$?

By S-Arrow:
- Domain (contravariant): $\{x : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Nat}\}$?

This asks whether a record with fewer fields is a subtype of a record with more fields. It is not -- subtyping goes the other way. So $\{x : \text{Nat}, y : \text{Nat}\} \to \text{Nat} \not<: \{x : \text{Nat}\} \to \text{Nat}$.

The issue is that the lambda's parameter type $\{x : \text{Nat}, y : \text{Nat}\}$ is too specific: the function demands two fields, but the context will only supply one. This is correctly rejected.

However, the reverse works: $\{x : \text{Nat}\} \to \text{Nat} <: \{x : \text{Nat}, y : \text{Nat}\} \to \text{Nat}$, because the domain is contravariant and $\{x : \text{Nat}, y : \text{Nat}\} <: \{x : \text{Nat}\}$.

---

## 7. Subtyping and the Semantics

### 7.1 Operational Semantics

The operational semantics (evaluation rules) are **unchanged** by the addition of subtyping. We add no new evaluation rules. The small-step relation $t \to t'$ remains exactly as in the STLC with extensions.

This is a crucial point: subtyping is a purely static (compile-time) concept in our formulation. At runtime, values do not carry type information, and no runtime checks or coercions are performed (in our direct semantics; see coercion semantics in Lecture 04c for an alternative).

### 7.2 Why Operational Semantics Need Not Change

Consider record field access. The rule for projection is:

$$\frac{}{(\{l_i = v_i\}_{i \in 1..n}).l_j \to v_j} \quad \text{(E-ProjRcd)} \qquad (j \in 1..n)$$

If we have a value $\{x = 3, y = \text{true}\}$ of type $\{x : \text{Nat}, y : \text{Bool}\}$, and it has been subsumed to type $\{x : \text{Nat}\}$, the runtime value still has the $y$ field. If we project $.x$, we get $3$ as expected. The $y$ field is simply never accessed.

This "forgetting" happens at the type level, not the term level. The runtime representation carries all the data; the type system simply prevents us from accessing the "forgotten" parts.

### 7.3 Values and the Subtype Relation

**Observation.** If $v$ is a value of type $S$ and $S <: T$, then $v$ is also a value of type $T$ (by T-Sub). The value itself does not change -- only our type-level perspective of it.

This observation is essential for the canonical forms lemma and the proofs of progress and preservation, which we develop in Lecture 04c.

---

## 8. Variance Summary

We summarize the variance of each type constructor:

| Type Constructor | Position 1 | Position 2 |
|------------------|-----------|-----------|
| $T_1 \to T_2$ | Contravariant ($T_1$) | Covariant ($T_2$) |
| $T_1 \times T_2$ | Covariant ($T_1$) | Covariant ($T_2$) |
| $T_1 + T_2$ | Covariant ($T_1$) | Covariant ($T_2$) |
| $\{l_i : T_i\}$ | Covariant (each $T_i$) | -- |
| $\text{Ref}\; T$ | **Invariant** ($T$) | -- |

The last row anticipates a result from Module 03 (references): mutable references must be invariant because they support both reading (covariant) and writing (contravariant). The combination of covariance and contravariance forces invariance: we need both $S <: T$ and $T <: S$, which in a system with antisymmetry means $S = T$.

This is a critical design consideration in object-oriented languages. Java's arrays are covariant (a `Dog[]` is a subtype of `Animal[]`), which is unsound and requires runtime checks (`ArrayStoreException`). Generics in Java are invariant by default, with explicit `? extends T` (covariant) and `? super T` (contravariant) wildcards.

### 8.1 Why Variance Matters in Practice

Understanding variance is essential for designing type-safe APIs. Consider a generic container type $\text{Container}(T)$:

- If $\text{Container}$ is a read-only list, it should be covariant: $\text{List}(\text{Dog}) <: \text{List}(\text{Animal})$ because reading from a list of dogs gives animals.
- If $\text{Container}$ is a write-only sink, it should be contravariant: $\text{Sink}(\text{Animal}) <: \text{Sink}(\text{Dog})$ because a sink accepting any animal can certainly accept dogs.
- If $\text{Container}$ supports both reading and writing, it must be invariant: $\text{MutableList}(\text{Dog}) \not<: \text{MutableList}(\text{Animal})$.

Languages handle this differently:
- **Java**: use-site variance with wildcards (`? extends T`, `? super T`).
- **Kotlin/Scala**: declaration-site variance with `out` (covariant) and `in` (contravariant).
- **C#**: both use-site (with `IEnumerable<out T>`) and declaration-site.
- **TypeScript**: structural variance inference (with `strictFunctionTypes`).

---

## 9. Subtyping as a Relation on Denotations

### 9.1 Semantic Subtyping

An alternative perspective views types as sets of values (their denotations) and defines subtyping as set inclusion:

$$S <: T \iff \lbrack\!\lbrack S \rbrack\!\rbrack \subseteq \lbrack\!\lbrack T \rbrack\!\rbrack$$

where $\lbrack\!\lbrack T \rbrack\!\rbrack$ denotes the set of all values of type $T$.

Under this view:
- Width subtyping: $\lbrack\!\lbrack \{x : \text{Nat}, y : \text{Bool}\} \rbrack\!\rbrack \subseteq \lbrack\!\lbrack \{x : \text{Nat}\} \rbrack\!\rbrack$ because every value with both fields is also a value with at least the $x$ field.
- Arrow contravariance: $\lbrack\!\lbrack S_1 \to S_2 \rbrack\!\rbrack \subseteq \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack$ when $\lbrack\!\lbrack T_1 \rbrack\!\rbrack \subseteq \lbrack\!\lbrack S_1 \rbrack\!\rbrack$ (larger domain) and $\lbrack\!\lbrack S_2 \rbrack\!\rbrack \subseteq \lbrack\!\lbrack T_2 \rbrack\!\rbrack$ (smaller codomain).

### 9.2 Syntactic vs. Semantic Subtyping

Our formulation is **syntactic**: we define $S <: T$ by inference rules on the structure of types. The **semantic** approach (Frisch, Castagna, and Hosoya 2008) defines subtyping by set inclusion of denotations and derives the inference rules as consequences.

The semantic approach has advantages:
- Subtyping is decidable by construction (reduce to set operations).
- Negation types and boolean combinations of types become natural.
- The arrow subtyping rule is derived rather than postulated.

The disadvantage is that the semantic approach requires a model (a domain of values) to be defined first, making the theory more complex.

---

---

## 10. Subtyping for References and Mutability

### 10.1 The Invariance Requirement

When we extend the language with mutable references (from Module 03), subtyping introduces a critical constraint. Consider a reference type $\text{Ref}\; T$. A reference cell supports two operations:

- **Read** (dereference): $!r : T$ -- produces a value of type $T$.
- **Write** (assignment): $r := v$ -- accepts a value of type $T$.

Reading is covariant: if $S <: T$, reading a $\text{Ref}\; S$ produces a value usable as a $T$, so we might expect $\text{Ref}\; S <: \text{Ref}\; T$.

Writing is contravariant: if $S <: T$, writing to a $\text{Ref}\; T$ with a $T$-value is safe, but writing to a $\text{Ref}\; S$ requires an $S$-value. To write a $T$-value to a $\text{Ref}\; S$ cell, we would need $T <: S$.

Combining both requirements: $S <: T$ and $T <: S$, which (in an antisymmetric system) means $S = T$. References must be **invariant**.

### 10.2 The Formal Rule

$$\frac{S <: T \qquad T <: S}{\text{Ref}\; S <: \text{Ref}\; T} \quad \text{(S-Ref)}$$

This is equivalent to requiring $S = T$ (up to mutual subtyping).

### 10.3 Read-Only and Write-Only References

We can decompose a reference into its read and write capabilities:

- **Source** (read-only): $\text{Source}\; T$ -- supports only $!r$. Covariant:

$$\frac{S <: T}{\text{Source}\; S <: \text{Source}\; T} \quad \text{(S-Source)}$$

- **Sink** (write-only): $\text{Sink}\; T$ -- supports only $r := v$. Contravariant:

$$\frac{T <: S}{\text{Sink}\; S <: \text{Sink}\; T} \quad \text{(S-Sink)}$$

Then $\text{Ref}\; T <: \text{Source}\; T$ and $\text{Ref}\; T <: \text{Sink}\; T$, but not all sources or sinks are full references. This decomposition allows more precise variance control and is related to Kotlin's `out` (covariant) and `in` (contravariant) variance annotations.

### 10.4 Unsound Covariant References

To see why covariant references are unsound, consider:

1. Let $r : \text{Ref}\; \text{Nat}$ be a reference containing $42$.
2. If $\text{Ref}\; \text{Nat} <: \text{Ref}\; \top$ (covariant), then $r : \text{Ref}\; \top$.
3. Write $\text{true}$ to $r$: $r := \text{true}$ is well-typed because $\text{true} : \text{Bool} <: \top$.
4. Read from $r$ at its original type: $!r : \text{Nat}$. But $r$ now contains $\text{true}$!

The program is stuck: we have a boolean where a natural number was expected. This shows that covariant references violate type safety.

---

## 11. Subtyping and Intersection Types

### 10.1 Intersection Types

An **intersection type** $S \wedge T$ represents values that have both type $S$ and type $T$ simultaneously. Intersection types arise naturally as meets in the subtype lattice, but they are more general because they apply even when $S$ and $T$ have incompatible outermost constructors.

The subtyping rules for intersection types are:

$$\frac{}{S \wedge T <: S} \quad \text{(S-Inter1)} \qquad \frac{}{S \wedge T <: T} \quad \text{(S-Inter2)}$$

$$\frac{U <: S \qquad U <: T}{U <: S \wedge T} \quad \text{(S-Inter3)}$$

With intersection types, the meet is always expressible: $S \sqcap T = S \wedge T$.

**Example.** A function of type $(\text{Nat} \to \text{Nat}) \wedge (\text{Bool} \to \text{Bool})$ accepts both natural numbers and booleans, and returns the corresponding type. This is more precise than $(\text{Nat} \wedge \text{Bool}) \to (\text{Nat} \wedge \text{Bool})$ or $(\text{Nat} \sqcap \text{Bool}) \to (\text{Nat} \sqcap \text{Bool})$.

### 10.2 Union Types

Dually, a **union type** $S \vee T$ represents values that have either type $S$ or type $T$ (but the observer does not know which):

$$\frac{}{S <: S \vee T} \quad \text{(S-Union1)} \qquad \frac{}{T <: S \vee T} \quad \text{(S-Union2)}$$

$$\frac{S <: U \qquad T <: U}{S \vee T <: U} \quad \text{(S-Union3)}$$

Union types appear in TypeScript (`A | B`), Python type hints (`Union[A, B]`), and CDuce.

### 10.3 Distributivity Laws

With intersection and union types, additional distributive laws hold:

$$S \to (T_1 \wedge T_2) = (S \to T_1) \wedge (S \to T_2)$$

$$(S_1 \vee S_2) \to T = (S_1 \to T) \wedge (S_2 \to T)$$

These laws reflect the logical identities:
- A function returning "both $T_1$ and $T_2$" is the same as a function that returns $T_1$ and a function that returns $T_2$.
- A function accepting "either $S_1$ or $S_2$" must handle both cases, hence it must be both a function from $S_1$ and a function from $S_2$.

---

## 12. Historical Notes and Design Space

### 12.1 Origins

Subtyping in type theory traces back to:
- **Cardelli (1984)**: Introduced subtyping for record types in the context of the language Fun.
- **Cardelli and Wegner (1985)**: "On Understanding Types, Data Abstraction, and Polymorphism" -- a landmark paper connecting subtyping with data abstraction.
- **Reynolds (1980)**: The "Forsythe" language combined intersection types with subtyping.
- **Liskov and Wing (1994)**: Formalized the behavioral substitution principle.

### 12.2 Structural vs. Nominal Subtyping

Our system uses **structural subtyping**: $S <: T$ is determined by the structure of $S$ and $T$. In contrast, many object-oriented languages use **nominal subtyping**: $S <: T$ only if $S$ explicitly declares that it extends or implements $T$.

- **Structural** (TypeScript, OCaml objects, Go interfaces): $\{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$ automatically.
- **Nominal** (Java, C#, Scala): `class Point { int x; int y; }` is not a subtype of `interface HasX { int x; }` unless `Point implements HasX`.

Each approach has trade-offs:
- Structural subtyping is more flexible and requires less boilerplate.
- Nominal subtyping provides stronger abstraction boundaries and clearer documentation of intent.

### 12.3 Subtyping and Parametric Polymorphism

Subtyping and parametric polymorphism ($\forall$-types) are largely orthogonal features, but their combination -- **bounded quantification** ($F_{<:}$) -- is remarkably expressive and remarkably complex. The system $F_{<:}$ (System F with subtyping) is the subject of Lecture 07c. A key result is that subtype checking in $F_{<:}$ is undecidable (Pierce 1994), though decidable fragments exist.

---

## Summary

This lecture introduced the subtyping relation $S <: T$ and the subsumption rule T-Sub that integrates it into the typing relation. The key points are:

1. **Safe substitution**: $S <: T$ means any value of type $S$ can safely be used where a value of type $T$ is expected.

2. **Subsumption**: The rule T-Sub allows "forgetting" type information, viewing a term at a less precise supertype.

3. **Arrow contravariance**: The function type $S_1 \to S_2 <: T_1 \to T_2$ requires $T_1 <: S_1$ (contravariant domain) and $S_2 <: T_2$ (covariant codomain). This is because a function that accepts more general arguments and returns more specific results is safely substitutable.

4. **$\top$ and $\bot$**: $\top$ is the universal supertype; $\bot$ is the universal subtype (uninhabited by terminating values).

5. **Products and sums**: Covariant in both components.

6. **Records**: Width (more fields = subtype), depth (refine field types), permutation (field order irrelevant).

7. **Operational semantics unchanged**: Subtyping is a purely static concept; runtime behavior is not affected.

The main technical complication introduced by subtyping is that typing is no longer syntax-directed: the subsumption rule can be applied anywhere, to any term. We address this in Lecture 04b.

---

## Further Reading

### Primary Sources

- **Pierce, B. C. (2002)**. *Types and Programming Languages*, Chapters 15-17. The definitive textbook treatment of subtyping. Chapter 15 introduces the subtype relation; Chapter 16 covers metatheory; Chapter 17 treats record subtyping in depth.

- **Cardelli, L. (1988)**. "A Semantics of Multiple Inheritance." *Information and Computation*, 76(2-3), 138-164. Foundational work on structural subtyping for record and object types.

- **Cardelli, L. and Wegner, P. (1985)**. "On Understanding Types, Data Abstraction, and Polymorphism." *Computing Surveys*, 17(4), 471-522. A broad survey that places subtyping in the context of type systems for programming languages.

### Supplementary

- **Liskov, B. and Wing, J. (1994)**. "A Behavioral Notion of Subtyping." *ACM Transactions on Programming Languages and Systems*, 16(6), 1811-1841. The definitive formulation of the Liskov Substitution Principle.

- **Harper, R. (2016)**. *Practical Foundations for Programming Languages*, 2nd ed., Chapters 24-25. An alternative presentation emphasizing the judgment-based approach to subtyping.

- **Frisch, A., Castagna, G., and Hosoya, A. (2008)**. "Semantic Subtyping: Dealing Set-Theoretically with Function, Union, Intersection, and Negation Types." *Journal of the ACM*, 55(4). The semantic subtyping approach.

- **Reynolds, J. C. (1980)**. "Using Category Theory to Design Implicit Conversions and Generic Operators." *Semantics-Directed Compiler Generation*, LNCS 94, 211-258. Early work connecting coercions and subtyping.

### Exercises for Self-Study

1. Prove that $S_1 \to (S_2 \to S_3) <: (S_1 \to S_2) \to (S_1 \to S_3)$ does not hold in general. Under what additional assumptions would it hold?

2. Show that with both $\top$ and $\bot$, the type $\top \to \bot$ is the bottom element among all arrow types (i.e., $\top \to \bot <: S \to T$ for all $S, T$).

3. Construct a type $T$ such that $T <: T \to T$. Is this possible without recursive types?

4. Prove or disprove: if $S_1 \times S_2 <: T_1 \times T_2$, then $S_1 <: T_1$ and $S_2 <: T_2$. (Hint: consider the role of S-Trans.)

5. Verify that the combined record subtyping rule S-Rcd subsumes width, depth, and permutation subtyping as special cases.

6. Consider the type $F(X) = (X \to \text{Bool}) \to \text{Nat}$. Determine whether $F$ is covariant, contravariant, or invariant in $X$. Justify with a derivation or counterexample.

7. Construct a subtyping chain of length 4 using only arrow types, $\top$, $\bot$, and base types. That is, find types $A, B, C, D, E$ with $A <: B <: C <: D <: E$ where each type is an arrow type (except possibly the endpoints).

8. Explain informally why width subtyping for records and width subtyping for variants go in opposite directions. Give a concrete example of each.

---

## Appendix A: Subtyping Derivation Practice

This appendix provides additional worked examples and exercises for building fluency with subtyping derivations. Working through these by hand is essential preparation for Lecture 04b (algorithmic subtyping) and Lecture 04c (metatheory proofs).

### A.1 Derivation Conventions

We write derivation trees vertically, with premises above the horizontal line and the conclusion below. Each rule application is labeled on the right. For readability, we sometimes abbreviate type names:

- $\mathbb{N}$ for $\text{Nat}$
- $\mathbb{B}$ for $\text{Bool}$
- $\to$ is right-associative: $A \to B \to C$ means $A \to (B \to C)$

### A.2 Worked Example: Three-Level Arrow

**Claim:** $(\text{Nat} \to \top) \to \bot <: (\top \to \text{Nat}) \to \bot$.

**Analysis.** By S-Arrow at the outer level:
- Domain (contravariant): need $(\top \to \text{Nat}) <: (\text{Nat} \to \top)$.
- Codomain (covariant): need $\bot <: \bot$.

For the domain, by S-Arrow:
- Domain (contravariant, flipped again): need $\text{Nat} <: \top$. Holds by S-Top.
- Codomain (covariant, flipped again): need $\text{Nat} <: \top$. Holds by S-Top.

For $\bot <: \bot$: by S-Refl (or S-Bot).

**Full derivation:**

$$\frac{\displaystyle\frac{\displaystyle\frac{}{\text{Nat} <: \top} \;\text{(S-Top)} \qquad \displaystyle\frac{}{\text{Nat} <: \top} \;\text{(S-Top)}}{(\top \to \text{Nat}) <: (\text{Nat} \to \top)} \;\text{(S-Arrow)} \qquad \displaystyle\frac{}{\bot <: \bot} \;\text{(S-Refl)}}{(\text{Nat} \to \top) \to \bot <: (\top \to \text{Nat}) \to \bot} \;\text{(S-Arrow)}$$

### A.3 Worked Example: Record with Arrow Fields

**Claim:** $\{f : \top \to \text{Nat}, g : \text{Bool}\} <: \{f : \text{Nat} \to \top\}$.

**Analysis.** By S-Rcd: for the field $f : \text{Nat} \to \top$ in the supertype, we need a field $f$ in the subtype with $(\top \to \text{Nat}) <: (\text{Nat} \to \top)$.

By S-Arrow:
- Domain: $\text{Nat} <: \top$ (S-Top).
- Codomain: $\text{Nat} <: \top$ (S-Top).

Width subtyping drops the $g$ field. Both width and depth subtyping are used simultaneously.

### A.4 Worked Example: Product of Arrow Types

**Claim:** $(\top \to \text{Nat}) \times (\text{Bool} \to \top) <: (\text{Nat} \to \top) \times (\bot \to \top)$.

By S-Prod:
- Left component: $(\top \to \text{Nat}) <: (\text{Nat} \to \top)$.
  - S-Arrow: $\text{Nat} <: \top$ (S-Top) and $\text{Nat} <: \top$ (S-Top).
- Right component: $(\text{Bool} \to \top) <: (\bot \to \top)$.
  - S-Arrow: $\bot <: \text{Bool}$ (S-Bot) and $\top <: \top$ (S-Refl).

Both components hold, so the claim is valid.

### A.5 Non-Derivable Judgments

It is equally important to identify when subtyping does not hold and articulate exactly where the derivation fails.

**Non-example A.5.1.** $\text{Nat} \to \text{Bool} <: \text{Bool} \to \text{Nat}$.

By S-Arrow, we would need:
- $\text{Bool} <: \text{Nat}$ (domain, contravariant) -- holds by S-BoolNat.
- $\text{Bool} <: \text{Nat}$ (codomain, covariant) -- holds by S-BoolNat.

So this actually does hold (given S-BoolNat). Let us construct a genuine non-example.

**Non-example A.5.2.** $\text{Nat} \to \text{Nat} <: \top \to \text{Nat}$.

By S-Arrow, we need:
- $\top <: \text{Nat}$ (domain, contravariant). This fails: $\top$ is not a subtype of $\text{Nat}$ (only the reverse holds).

The derivation is stuck at the first premise.

**Non-example A.5.3.** $\{x : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Bool}\}$.

By S-Rcd, for the field $y : \text{Bool}$ in the supertype, we need a field $y$ in the subtype. But $\{x : \text{Nat}\}$ has no $y$ field. The derivation fails.

**Non-example A.5.4.** $\text{Nat} \times \text{Bool} <: \text{Nat} \to \text{Bool}$.

No subtyping rule relates products to arrows. The outermost constructors are incompatible, and neither S-Top nor S-Bot applies (since neither type is $\top$ or $\bot$). The derivation fails.

### A.6 Practice Problems

Determine whether each judgment holds. If it holds, give the derivation. If not, identify the failing premise.

1. $\text{Nat} \to \bot <: \text{Bool} \to \bot$

2. $\{a : \text{Nat}, b : \text{Nat} \to \top\} <: \{b : \text{Bool} \to \top, a : \top\}$

3. $(\{x : \text{Nat}\} \to \text{Nat}) \times \text{Bool} <: (\{x : \text{Nat}, y : \text{Bool}\} \to \top) \times \text{Nat}$

4. $\top \to \bot <: \bot \to \top$

5. $\{f : \top \to \bot\} <: \{f : \text{Nat} \to \text{Nat}, g : \text{Bool}\}$

6. $(\text{Nat} \to \text{Nat}) \to (\text{Bool} \to \text{Bool}) <: (\text{Bool} \to \top) \to (\bot \to \text{Bool})$

---

## Appendix B: Subtyping in Category Theory

For readers with a background in category theory, we sketch how subtyping can be understood categorically.

### B.1 Types as Objects, Subtyping as Morphisms

Consider a category $\mathbf{Sub}$ whose:
- **Objects** are types.
- **Morphisms** $S \to T$ exist if and only if $S <: T$.
- There is at most one morphism between any two objects (i.e., $\mathbf{Sub}$ is a **preorder category** or **thin category**).

Then:
- S-Refl corresponds to **identity morphisms**.
- S-Trans corresponds to **composition of morphisms**.
- $\top$ is a **terminal object** (every object has a unique morphism to it).
- $\bot$ is an **initial object** (it has a unique morphism to every object).

### B.2 Functors and Variance

A type constructor $F$ can be viewed as a functor (or contravariant functor) on $\mathbf{Sub}$:

- **Covariant** $F$: If $S <: T$ implies $F(S) <: F(T)$, then $F$ is a (covariant) functor $\mathbf{Sub} \to \mathbf{Sub}$.
- **Contravariant** $F$: If $S <: T$ implies $F(T) <: F(S)$, then $F$ is a contravariant functor (equivalently, a functor $\mathbf{Sub}^{op} \to \mathbf{Sub}$).

The arrow type constructor $(\cdot) \to (\cdot)$ is a bifunctor:
- Contravariant in the first argument: a functor $\mathbf{Sub}^{op} \times \mathbf{Sub} \to \mathbf{Sub}$.
- Covariant in the second argument.

This categorical perspective explains why the arrow rule has the form it does: it is simply the statement that $\text{Hom}$ is contravariant in the first argument and covariant in the second, which is a fundamental property of any category.

### B.3 Joins and Meets as Categorical Constructs

- The **join** $S \sqcup T$ is the **coproduct** (categorical sum) in $\mathbf{Sub}$.
- The **meet** $S \sqcap T$ is the **product** in $\mathbf{Sub}$.

When $\mathbf{Sub}$ is a lattice, every pair of objects has a product and coproduct. This is the categorical statement that every pair of types has a meet and a join.

### B.4 The Coercion Functor

The coercion semantics (Lecture 04c) defines a functor from $\mathbf{Sub}$ to the category of STLC types and terms:

$$\lbrack\!\lbrack \cdot \rbrack\!\rbrack : \mathbf{Sub} \to \mathbf{STLC}$$

On objects, $\lbrack\!\lbrack S \rbrack\!\rbrack$ maps a type to itself (or to its target-language counterpart). On morphisms, $\lbrack\!\lbrack S <: T \rbrack\!\rbrack$ maps the unique subtyping morphism $S \to T$ to a coercion term $c : S \to T$ in the STLC.

Coherence (Theorem 8.1 in Lecture 04c) states that this functor is well-defined: since $\mathbf{Sub}$ is a thin category, functoriality requires that the coercion for $S <: T$ is unique up to equivalence, regardless of how the subtyping is derived.

---

## Appendix C: Subtyping and the Curry-Howard Correspondence

### C.1 Subtyping as Entailment

Under the Curry-Howard correspondence, types correspond to propositions and terms correspond to proofs. What does subtyping correspond to?

The judgment $S <: T$ can be read as "the proposition $S$ logically entails the proposition $T$." In this reading:
- $\top$ corresponds to the trivially true proposition (verum).
- $\bot$ corresponds to the false proposition (falsum, or the empty type).
- $S <: \top$ says that every proposition entails truth.
- $\bot <: T$ says that falsehood entails everything (ex falso quodlibet).

### C.2 Arrow Subtyping as Entailment

The arrow subtyping rule $S_1 \to S_2 <: T_1 \to T_2$ (with $T_1 <: S_1$ and $S_2 <: T_2$) corresponds to:

If "$S_1$ implies $S_2$" entails "$T_1$ implies $T_2$," then given a proof of $T_1$, we can strengthen it to a proof of $S_1$ (by $T_1 <: S_1$), apply the implication $S_1 \to S_2$ to get a proof of $S_2$, and weaken it to a proof of $T_2$ (by $S_2 <: T_2$).

This is a standard fact in logic: if the hypothesis of an implication can be weakened and the conclusion can be strengthened, the implication is still valid.

### C.3 The Subsumption Rule as Weakening

The subsumption rule T-Sub corresponds to **weakening** in the logical reading: if we have a proof of $S$ (a more specific proposition), we can weaken it to a proof of $T$ (a more general proposition). This is sound because $S$ entails $T$.

### C.4 Product and Sum Types under Curry-Howard

Product types correspond to **conjunction** in logic:
- $S_1 \times S_2 <: T_1 \times T_2$ (with $S_1 <: T_1$ and $S_2 <: T_2$) corresponds to: if $S_1 \wedge S_2$ holds and $S_1$ entails $T_1$ and $S_2$ entails $T_2$, then $T_1 \wedge T_2$ holds.

Sum types correspond to **disjunction**:
- $S_1 + S_2 <: T_1 + T_2$ (with $S_1 <: T_1$ and $S_2 <: T_2$) corresponds to: if $S_1 \vee S_2$ holds and each disjunct entails the corresponding disjunct in $T_1 \vee T_2$, then $T_1 \vee T_2$ holds.

Record types correspond to **labeled conjunctions**: a record $\{l_1 : T_1, \ldots, l_n : T_n\}$ is a conjunction of $n$ labeled propositions. Width subtyping corresponds to the logical fact that a conjunction with more conjuncts is a stronger statement (entails the conjunction with fewer conjuncts). Depth subtyping corresponds to strengthening individual conjuncts.

### C.5 The Subtyping Preorder and Proof Relevance

A subtle point arises with the Curry-Howard reading. In our system, the subtyping relation is a **preorder** (reflexive and transitive), and the proofs of $S <: T$ are not unique in general -- there may be multiple derivations. However, the subsumption rule treats the coercion as implicit: the term does not record which derivation of $S <: T$ was used. This corresponds to proof irrelevance for the entailment relation, which is appropriate because the subtyping proof has no computational content at runtime (it is erased).

This connects to the coherence property studied in Lecture 04c: different derivations of $S <: T$ yield semantically equivalent coercions, so the choice of derivation does not matter.
