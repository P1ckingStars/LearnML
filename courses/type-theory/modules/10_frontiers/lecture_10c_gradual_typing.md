---
title: "Lecture 10c: Gradual Typing"
tags:
  - type-theory
  - frontiers
  - lecture
---
# Lecture 10c: Gradual Typing

> **Module 10 --- Frontiers (Weeks 19--20)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Articulate the motivation for gradual typing as a principled bridge between static and dynamic typing, and contrast it with optional typing and soft typing.
2. Define the gradually typed lambda calculus (GTLC), including the dynamic type $\star$, the consistency relation, and the typing rules.
3. State and prove the soundness of the gradually typed lambda calculus through its elaboration into a cast calculus.
4. Explain the semantics of casts, including the role of blame labels, and trace the evaluation of programs with runtime cast failures.
5. State the gradual guarantee and explain its two components (static and dynamic), and discuss its significance as a design criterion.
6. Describe the Abstracting Gradual Typing (AGT) methodology and explain how it systematically derives gradual type systems from static ones.
7. Analyze practical gradually typed systems (TypeScript, Python/mypy, Typed Racket) and evaluate the degree to which they satisfy the gradual guarantee.
8. Discuss the relationship between gradual typing and contracts, parametricity, and dependent types.

---

## 1. Motivation

The history of programming languages presents a persistent tension between two philosophies of typing. **Statically typed** languages (ML, Haskell, Java, Rust) check types at compile time, catching errors before execution and enabling compiler optimizations. **Dynamically typed** languages (Python, JavaScript, Ruby, Lisp) defer type checking to runtime, offering flexibility, rapid prototyping, and simpler metaprogramming at the cost of potential runtime type errors.

Neither approach is universally superior. Static typing excels in large codebases where interfaces must be stable and errors are costly. Dynamic typing excels in exploratory programming, scripting, and domains where the shape of data evolves rapidly. In practice, most large software projects written in dynamic languages eventually develop an informal static type discipline (through documentation, naming conventions, and tests), while statically typed languages often include escape hatches (casts, `Object` types, `unsafe` blocks) that circumvent the type system.

**Gradual typing**, introduced by Siek and Taha (2006), offers a principled resolution. A gradually typed language allows programmers to write code with *partial type annotations*: some variables and expressions carry precise static types, others are annotated with the *dynamic type* $\star$ (or left unannotated, which is treated the same). The type system checks static annotations at compile time and inserts *casts* for interactions between statically and dynamically typed code. At runtime, casts monitor values flowing across the boundary, raising *blame* errors when a dynamically typed value turns out to be incompatible with the static type expected of it.

The key insight is that gradual typing is not merely "optional type annotations." It is a coherent type-theoretic framework with precise metatheoretic properties, culminating in the **gradual guarantee**: a well-typed program remains well-typed (and behaves the same) when type annotations are removed, and adding correct annotations to a well-typed program does not change its behavior.

### 1.1 The Typing Spectrum

To understand gradual typing, it helps to see it as a point on a spectrum of approaches to combining static and dynamic typing:

| Approach | Annotations | Runtime checks | Guarantees |
|----------|-------------|---------------|------------|
| Dynamic typing | None | All checks at runtime | None static |
| Optional typing | Optional, unchecked | No additional checks | None (annotations are comments) |
| Type erasure | Checked at compile time | No runtime enforcement | Static only; unsound at boundaries |
| Sound gradual typing | Optional, checked | Casts at boundaries | Static + dynamic (gradual guarantee) |
| Static typing | All required | None needed | Full static guarantees |

Gradual typing occupies the middle ground: it provides some static guarantees (for annotated code) and some dynamic guarantees (via casts), with a principled relationship between the two (the gradual guarantee).

### 1.2 Historical Context

- **Soft typing** (Cartwright and Fagan, 1991): infer types for dynamically typed programs and insert checks where needed. Unlike gradual typing, soft typing does not allow programmer-written annotations to influence the analysis.
- **Quasi-static typing** (Thatte, 1990): an early attempt to combine static and dynamic typing, predating Siek and Taha's more systematic treatment.
- **Contracts** (Findler and Felleisen, 2002): higher-order runtime checks that enforce behavioral specifications. Gradual typing is closely related to contracts but works at the type level.
- **TypeScript** (Microsoft, 2012): a practically successful gradually typed superset of JavaScript, though it sacrifices some theoretical properties for pragmatic usability.
- **Dart** (Google, 2011): initially optionally typed, later moved to sound typing with runtime checks in Dart 2.0.
- **Hack** (Meta, 2014): a gradually typed version of PHP with full type inference and runtime enforcement.

---

## 2. Core Theory

### 2.1 The Dynamic Type

The central addition to the type system is the *unknown type*, also called the *dynamic type*, written $\star$.

**Definition 2.1 (Types of the GTLC).** The types of the gradually typed lambda calculus are:

$$\tau ::= \text{Int} \mid \text{Bool} \mid \tau_1 \to \tau_2 \mid \star$$

The type $\star$ represents the absence of static type information. A variable $x : \star$ may hold any value at runtime --- an integer, a boolean, a function, etc. The type system treats $\star$ as compatible with any type, subject to runtime verification.

**Remark 2.2.** The type $\star$ is emphatically *not* a top type or a universal type. In a system with a top type $\top$, we have $\tau <: \top$ for all $\tau$ --- every value of any type *is* a value of type $\top$. The dynamic type is different: a value of type $\star$ is *not known* to be of any specific type. The distinction manifests at runtime: accessing a value of type $\top$ is always safe, but accessing a value of type $\star$ may fail if the actual runtime type is incompatible with the expected type.

### 2.2 The Consistency Relation

In a standard type system, the typing rule for function application requires that the argument type match the parameter type exactly (or be a subtype, in systems with subtyping). In gradual typing, we relax this requirement using a *consistency* relation.

**Definition 2.3 (Consistency).** The consistency relation $\sim$ on types is the smallest relation satisfying:

$$\frac{}{\tau \sim \tau} \quad (\text{C-Refl})$$

$$\frac{}{\star \sim \tau} \quad (\text{C-UnkL}) \qquad \frac{}{\tau \sim \star} \quad (\text{C-UnkR})$$

$$\frac{\tau_1 \sim \tau_3 \quad \tau_2 \sim \tau_4}{\tau_1 \to \tau_2 \sim \tau_3 \to \tau_4} \quad (\text{C-Fun})$$

**Example 2.4.**

- $\text{Int} \sim \text{Int}$ (by C-Refl)
- $\text{Int} \sim \star$ (by C-UnkR)
- $\star \sim \text{Int} \to \text{Bool}$ (by C-UnkL)
- $\text{Int} \to \star \sim \text{Int} \to \text{Bool}$ (by C-Fun, using C-Refl and C-UnkL)
- $\text{Int} \not\sim \text{Bool}$ (no rule applies)
- $\text{Int} \not\sim \text{Int} \to \text{Bool}$ (no rule applies)

**Proposition 2.5 (Properties of consistency).**

1. Consistency is *reflexive*: $\tau \sim \tau$ for all $\tau$.
2. Consistency is *symmetric*: $\tau_1 \sim \tau_2$ implies $\tau_2 \sim \tau_1$.
3. Consistency is **not** *transitive*: $\text{Int} \sim \star$ and $\star \sim \text{Bool}$, but $\text{Int} \not\sim \text{Bool}$.

*Proof of (3).* Immediate from the examples above. $\square$

The non-transitivity of consistency is essential. If consistency were transitive, it would collapse to the universal relation (everything is consistent with everything), and the type system would lose all static checking power.

**Proposition 2.6 (Characterization of consistency).** Two types $\tau_1$ and $\tau_2$ are consistent if and only if they are equal after removing all occurrences of $\star$ and the subtrees they root. More precisely, $\tau_1 \sim \tau_2$ if and only if $\tau_1$ and $\tau_2$ have the same "skeleton" up to the positions where either type is $\star$.

*Proof.* By induction on the derivation. If either type is $\star$, consistency holds trivially (by C-UnkL or C-UnkR). If neither is $\star$, then both must be the same base type or both must be function types with consistent domains and codomains (by C-Refl or C-Fun). $\square$

**Remark 2.7 (Consistency as a congruence).** Consistency is *not* a congruence in the usual sense, because it is not transitive. However, it is a *partial equivalence relation modulo $\star$*: it is reflexive and symmetric, and it becomes transitive when restricted to types without $\star$.

**Remark 2.8 (Consistency vs. subtyping).** In a language with both subtyping and gradual typing, one replaces consistency with *consistent subtyping*, written $\lesssim$:

$$\tau_1 \lesssim \tau_2 \iff \exists \tau_1', \tau_2'.\; \tau_1 \sim \tau_1' \wedge \tau_1' <: \tau_2' \wedge \tau_2' \sim \tau_2$$

This is the approach taken by Siek and Taha (2007) and refined by Garcia, Clark, and Tanter (2016).

**Proposition 2.9 (Equivalent characterization of consistent subtyping).** $\tau_1 \lesssim \tau_2$ if and only if the "mask" operation (replacing $\star$ with a fresh type variable) makes $\tau_1$ a subtype of $\tau_2$ under the standard subtyping relation.

This equivalence shows that consistent subtyping is not an ad hoc combination of consistency and subtyping but has a clean semantic characterization.

### 2.3 The Gradually Typed Lambda Calculus (GTLC)

**Definition 2.7 (Syntax of the GTLC).** Terms of the GTLC are:

$$e ::= x \mid n \mid b \mid \lambda x{:}\tau.\, e \mid e_1\;e_2 \mid e_1 + e_2 \mid \text{if}\;e_1\;\text{then}\;e_2\;\text{else}\;e_3$$

where $n$ ranges over integer literals, $b$ over boolean literals, and $\tau$ over types (including $\star$). Variables $x$ have optional type annotations; an unannotated variable is implicitly typed $\star$.

**Definition 2.8 (Typing rules of the GTLC).** Typing judgments have the form $\Gamma \vdash e : \tau$. The rules are:

$$\frac{x : \tau \in \Gamma}{\Gamma \vdash x : \tau} \quad (\text{T-Var}) \qquad \frac{}{\Gamma \vdash n : \text{Int}} \quad (\text{T-Int}) \qquad \frac{}{\Gamma \vdash b : \text{Bool}} \quad (\text{T-Bool})$$

$$\frac{\Gamma, x : \tau_1 \vdash e : \tau_2}{\Gamma \vdash \lambda x{:}\tau_1.\, e : \tau_1 \to \tau_2} \quad (\text{T-Abs})$$

$$\frac{\Gamma \vdash e_1 : \tau_1 \quad \tau_1 \triangleright \tau_{11} \to \tau_{12} \quad \Gamma \vdash e_2 : \tau_2 \quad \tau_2 \sim \tau_{11}}{\Gamma \vdash e_1\;e_2 : \tau_{12}} \quad (\text{T-App})$$

$$\frac{\Gamma \vdash e_1 : \tau_1 \quad \tau_1 \triangleright \text{Int} \quad \Gamma \vdash e_2 : \tau_2 \quad \tau_2 \triangleright \text{Int}}{\Gamma \vdash e_1 + e_2 : \text{Int}} \quad (\text{T-Add})$$

$$\frac{\Gamma \vdash e_1 : \tau_1 \quad \tau_1 \triangleright \text{Bool} \quad \Gamma \vdash e_2 : \tau_2 \quad \Gamma \vdash e_3 : \tau_3 \quad \tau_2 \sim \tau_3}{\Gamma \vdash \text{if}\;e_1\;\text{then}\;e_2\;\text{else}\;e_3 : \tau_2 \sqcup \tau_3} \quad (\text{T-If})$$

Here $\triangleright$ is the *matching* relation and $\sqcup$ is the *join* (least upper bound) with respect to the precision ordering.

**Definition 2.9 (Type matching).** The matching relation $\tau \triangleright \sigma$ extracts structure from a type, treating $\star$ as having any structure:

$$\frac{}{\tau_1 \to \tau_2 \triangleright \tau_1 \to \tau_2} \quad (\text{M-Fun}) \qquad \frac{}{\star \triangleright \star \to \star} \quad (\text{M-Unk-Fun})$$

$$\frac{}{\text{Int} \triangleright \text{Int}} \quad (\text{M-Int}) \qquad \frac{}{\star \triangleright \text{Int}} \quad (\text{M-Unk-Int})$$

$$\frac{}{\text{Bool} \triangleright \text{Bool}} \quad (\text{M-Bool}) \qquad \frac{}{\star \triangleright \text{Bool}} \quad (\text{M-Unk-Bool})$$

When a term of type $\star$ is used as a function ($e_1\;e_2$ where $e_1 : \star$), matching produces $\star \to \star$, meaning both the domain and range are unknown.

**Definition 2.10 (Type precision / naive subtyping).** The *precision* ordering $\sqsubseteq$ on types is defined by:

$$\frac{}{\star \sqsubseteq \tau} \quad (\text{P-Unk}) \qquad \frac{}{\tau \sqsubseteq \tau} \quad (\text{P-Refl}) \qquad \frac{\tau_1 \sqsubseteq \tau_3 \quad \tau_2 \sqsubseteq \tau_4}{\tau_1 \to \tau_2 \sqsubseteq \tau_3 \to \tau_4} \quad (\text{P-Fun})$$

Note: $\star$ is the *least* precise type --- it carries the least information. Precision is a partial order (unlike consistency, which is not transitive).

**Definition 2.11 (Join).** The join $\tau_1 \sqcup \tau_2$ is the least upper bound in the precision ordering, when it exists. If $\tau_1 \sim \tau_2$, the join always exists:

- $\star \sqcup \tau = \tau$
- $\tau \sqcup \star = \tau$
- $(\tau_1 \to \tau_2) \sqcup (\tau_3 \to \tau_4) = (\tau_1 \sqcup \tau_3) \to (\tau_2 \sqcup \tau_4)$
- $\text{Int} \sqcup \text{Int} = \text{Int}$, etc.

### 2.4 Elaboration into a Cast Calculus

The GTLC is a *surface language*. Its semantics is given by *elaboration* (translation) into an *internal language* called the **cast calculus**, where type mismatches are made explicit by cast expressions.

**Definition 2.12 (Syntax of the cast calculus).** The cast calculus extends the simply typed lambda calculus with cast expressions:

$$e ::= \ldots \mid \langle \tau_2 \Leftarrow \tau_1 \rangle^l\;e$$

The expression $\langle \tau_2 \Leftarrow \tau_1 \rangle^l\;e$ casts the value of $e$ from type $\tau_1$ to type $\tau_2$, with blame label $l$. The blame label identifies the source of the cast in the original program, enabling useful error messages when a cast fails at runtime.

**Definition 2.13 (Typing rule for casts).**

$$\frac{\Gamma \vdash e : \tau_1 \quad \tau_1 \sim \tau_2}{\Gamma \vdash \langle \tau_2 \Leftarrow \tau_1 \rangle^l\;e : \tau_2} \quad (\text{T-Cast})$$

A cast is well-typed when the source and target types are consistent.

**Definition 2.14 (Elaboration).** The elaboration judgment $\Gamma \vdash e \leadsto e' : \tau$ translates a GTLC term $e$ into a cast calculus term $e'$ of type $\tau$. The key rule is for function application:

$$\frac{\Gamma \vdash e_1 \leadsto e_1' : \tau_1 \quad \tau_1 \triangleright \tau_{11} \to \tau_{12} \quad \Gamma \vdash e_2 \leadsto e_2' : \tau_2 \quad \tau_2 \sim \tau_{11}}{\Gamma \vdash e_1\;e_2 \leadsto (\langle \tau_{11} \to \tau_{12} \Leftarrow \tau_1 \rangle^{l_1}\;e_1')\;(\langle \tau_{11} \Leftarrow \tau_2 \rangle^{l_2}\;e_2') : \tau_{12}}$$

Casts are inserted to coerce $e_1'$ to a function type (if $\tau_1 = \star$) and to coerce the argument $e_2'$ to the expected domain type.

**Example 2.15.** Consider:

$$\vdash (\lambda x{:}\star.\, x + 1)\;42 \leadsto (\lambda x{:}\star.\, (\langle \text{Int} \Leftarrow \star \rangle^{l_1}\;x) + 1)\;42 : \text{Int}$$

The elaboration inserts a cast $\langle \text{Int} \Leftarrow \star \rangle$ to coerce the dynamically typed $x$ to $\text{Int}$ before using it in addition.

**Example 2.16.** Consider:

$$\vdash (\lambda f{:}\text{Int} \to \text{Int}.\, f\;0)\;(\lambda x{:}\star.\, x) \leadsto (\lambda f{:}\text{Int} \to \text{Int}.\, f\;0)\;(\langle \text{Int} \to \text{Int} \Leftarrow \star \to \star \rangle^l\;(\lambda x{:}\star.\, x))$$

The identity function $\lambda x{:}\star.\, x$ has type $\star \to \star$, which is cast to $\text{Int} \to \text{Int}$.

**Example 2.17.** A more complex elaboration:

$$(\lambda f{:}\star.\, f\;(\lambda x{:}\text{Int}.\, x))\;(\lambda g{:}\star.\, g\;42)$$

Step 1: Type $f : \star$. The application $f\;(\lambda x{:}\text{Int}.\, x)$ uses matching: $\star \triangleright \star \to \star$. The argument $\lambda x{:}\text{Int}.\, x : \text{Int} \to \text{Int}$ is consistent with $\star$. Result type: $\star$.

Step 2: The outer application passes $\lambda g{:}\star.\, g\;42$ (type $\star \to \star$) to a context expecting $\star$. A cast $\langle \star \Leftarrow \star \to \star \rangle$ is inserted.

Step 3: Inside $\lambda g{:}\star.\, g\;42$: $g : \star$ applied to $42 : \text{Int}$. Matching gives $\star \triangleright \star \to \star$, and $\text{Int} \sim \star$. A cast $\langle \star \Leftarrow \text{Int} \rangle$ is inserted on $42$.

The fully elaborated term has several layers of casts, each tracking a specific boundary in the original program.

### 2.5 Cast Semantics

We now define the runtime behavior of casts.

**Definition 2.17 (Values in the cast calculus).**

$$v ::= n \mid b \mid \lambda x{:}\tau.\, e \mid \langle \tau_1 \to \tau_2 \Leftarrow \tau_3 \to \tau_4 \rangle^l\;v$$

The last form is a *function proxy*: a function wrapped in a cast. Function casts cannot be immediately checked (unlike base type casts) because we do not know the argument until the function is called. Instead, the cast wraps the function, deferring the check.

**Definition 2.18 (Ground types).** A type $\tau$ is *ground* if it is of the form $\text{Int}$, $\text{Bool}$, or $\star \to \star$. Ground types are the "tags" associated with runtime values: an integer has ground type $\text{Int}$, a boolean has ground type $\text{Bool}$, and a function has ground type $\star \to \star$.

**Definition 2.19 (Cast reduction rules).**

$$\langle \tau \Leftarrow \tau \rangle^l\;v \longrightarrow v \quad (\text{identity cast})$$

$$\langle \star \Leftarrow G \rangle^l\;v \longrightarrow \langle \star \Leftarrow G \rangle^l\;v \quad (\text{injection --- value form})$$

More precisely, an injection $\langle \star \Leftarrow G \rangle^l\;v$ where $G$ is a ground type is already a value --- it "boxes" $v$ with its ground type tag.

$$\langle G \Leftarrow \star \rangle^l\;(\langle \star \Leftarrow G \rangle^{l'}\;v) \longrightarrow v \quad (\text{projection --- success})$$

$$\langle G_1 \Leftarrow \star \rangle^l\;(\langle \star \Leftarrow G_2 \rangle^{l'}\;v) \longrightarrow \text{blame}\;l \quad \text{when } G_1 \neq G_2 \quad (\text{projection --- failure})$$

$$\langle \tau \Leftarrow \star \rangle^l\;v \longrightarrow \langle \tau \Leftarrow G \rangle^l\;(\langle G \Leftarrow \star \rangle^l\;v) \quad \text{when } \tau \neq \star,\; G = \text{ground}(\tau)$$

$$\langle \star \Leftarrow \tau \rangle^l\;v \longrightarrow \langle \star \Leftarrow G \rangle^l\;(\langle G \Leftarrow \tau \rangle^l\;v) \quad \text{when } \tau \neq \star,\; G = \text{ground}(\tau)$$

$$\langle \tau_3 \to \tau_4 \Leftarrow \tau_1 \to \tau_2 \rangle^l\;v = w \quad \text{where } w\;v' = \langle \tau_4 \Leftarrow \tau_2 \rangle^l\;(v\;(\langle \tau_1 \Leftarrow \tau_3 \rangle^{\overline{l}}\;v'))$$

In the last rule, the function cast wraps $v$: when applied to $v'$, it casts the argument from $\tau_3$ to $\tau_1$ (note the *contravariant* direction, with the *negated* blame label $\overline{l}$), applies $v$, and casts the result from $\tau_2$ to $\tau_4$.

**Definition 2.20 (Blame).** The term $\text{blame}\;l$ is a stuck state representing a cast failure. The label $l$ identifies which cast in the source program is responsible for the failure.

**Remark 2.20.1 (Blame labels and polarity).** Blame labels come in positive and negative polarities. A blame label $l$ is *positive* when it appears in a covariant position (the "provider" of the value is blamed) and *negative* $\overline{l}$ when it appears in a contravariant position (the "consumer" is blamed). In the function cast rule, the argument cast uses the negated label $\overline{l}$ because the function's *caller* is providing the argument --- if the argument has the wrong type, it is the caller's fault, not the function's.

This polarity discipline ensures that blame is always assigned to the correct party in a multi-party interaction. Wadler and Findler (2009) proved that positive blame is always assigned to the less-typed side of a boundary (the "blame theorem").

**Remark 2.20.2 (Coercions vs. casts).** An alternative formulation replaces casts with *coercions* (Herman, Tomb, and Flanagan, 2010). A coercion is a function $c : \tau_1 \to \tau_2$ that can be composed and simplified:

$$\text{id} : \tau \to \tau \qquad c_1; c_2 : \tau_1 \to \tau_3 \quad (\text{if } c_1 : \tau_1 \to \tau_2, c_2 : \tau_2 \to \tau_3)$$

$$\text{Fun}(c_1, c_2) : (\tau_3 \to \tau_4) \to (\tau_1 \to \tau_2) \quad (\text{if } c_1 : \tau_1 \to \tau_3, c_2 : \tau_4 \to \tau_2)$$

$$G! : G \to \star \qquad G? : \star \to G \cup \{\text{blame}\}$$

Coercions are *normalizable*: any sequence of casts can be reduced to a canonical coercion of bounded size, preventing the unbounded growth of cast wrappers. This is the key to space-efficient gradual typing.

**Example 2.21 (Successful evaluation).** Consider the elaborated term from Example 2.15:

$$(\lambda x{:}\star.\, (\langle \text{Int} \Leftarrow \star \rangle^{l}\;x) + 1)\;42$$

Evaluation:
1. $\beta$-reduce: $(\langle \text{Int} \Leftarrow \star \rangle^{l}\;42) + 1$
2. But $42$ needs to be injected first. In practice, integer literals in the cast calculus are already values of ground type, so the cast $\langle \text{Int} \Leftarrow \star \rangle^l$ applied to $42$ extracts the integer from the dynamic value: $42 + 1 = 43$.

**Example 2.22 (Cast failure).** Consider:

$$(\lambda x{:}\star.\, (\langle \text{Int} \Leftarrow \star \rangle^{l}\;x) + 1)\;\text{true}$$

Evaluation:
1. $\beta$-reduce: $(\langle \text{Int} \Leftarrow \star \rangle^{l}\;\text{true}) + 1$
2. The projection cast encounters $\text{true}$, which has ground type $\text{Bool} \neq \text{Int}$.
3. Result: $\text{blame}\;l$.

### 2.6 Type Safety for the Cast Calculus

**Theorem 2.23 (Type safety --- cast calculus).** If $\vdash e : \tau$ in the cast calculus, then either:

1. $e$ is a value, or
2. $e \longrightarrow e'$ for some $e'$ with $\vdash e' : \tau$, or
3. $e \longrightarrow \text{blame}\;l$ for some blame label $l$.

*Proof.* By the standard progress-and-preservation argument.

**Preservation:** By induction on the typing derivation, with a case analysis on the reduction rule used. The key case is the cast reduction: when $\langle G \Leftarrow \star \rangle^l\;(\langle \star \Leftarrow G \rangle^{l'}\;v) \longrightarrow v$, the type of the left side is $G$ and $v : G$ (since it was injected from $G$), so preservation holds.

**Progress:** Every well-typed closed term is either a value, can step, or is blame. The proof proceeds by induction on the typing derivation, using the canonical forms lemma (extended to handle wrapped functions). $\square$

**Remark 2.24 (Blame safety).** Wadler and Findler (2009) proved a stronger result: *blame safety*, which states that if a cast $\langle \tau_2 \Leftarrow \tau_1 \rangle^l$ fails with $\text{blame}\;l$, then $\tau_1$ is "less precise" than $\tau_2$ at the point of failure. Informally, blame is always assigned to the less-typed side of the boundary.

### 2.7 The Type Safety Theorem in Detail

We now give a more detailed account of type safety for the cast calculus.

**Lemma 2.24.1 (Canonical forms).** If $\vdash v : \tau$ and $v$ is a value, then:

1. If $\tau = \text{Int}$, then $v = n$ for some integer $n$.
2. If $\tau = \text{Bool}$, then $v = \text{true}$ or $v = \text{false}$.
3. If $\tau = \tau_1 \to \tau_2$, then either $v = \lambda x{:}\tau_1.\, e$ for some $e$, or $v = \langle \tau_1 \to \tau_2 \Leftarrow \tau_3 \to \tau_4 \rangle^l\;w$ for some $w, \tau_3, \tau_4, l$.
4. If $\tau = \star$, then $v = \langle \star \Leftarrow G \rangle^l\;w$ for some ground type $G$, value $w$, and label $l$.

*Proof.* By induction on the typing derivation, examining which typing rules can derive a value type. Case (4) uses the fact that values at type $\star$ must be injections from ground types (this is ensured by the evaluation strategy: every term of type $\star$ is eventually evaluated to an injection). $\square$

**Lemma 2.24.2 (Substitution).** If $\Gamma, x : \tau' \vdash e : \tau$ and $\vdash v : \tau'$, then $\Gamma \vdash e[x := v] : \tau$.

*Proof.* Standard, by induction on the typing derivation. The key cases are T-Var (where $x$ is the variable being substituted) and T-Abs (where we must avoid variable capture, using alpha-renaming if necessary). $\square$

**Theorem 2.24.3 (Preservation).** If $\vdash e : \tau$ and $e \longrightarrow e'$, then $\vdash e' : \tau$.

*Proof.* By induction on the evaluation step, with a case analysis on the reduction rule. We show the most interesting case:

*Case (function cast reduction):* Suppose $e = (\langle \tau_3 \to \tau_4 \Leftarrow \tau_1 \to \tau_2 \rangle^l\;v)\;w$ and $e' = \langle \tau_4 \Leftarrow \tau_2 \rangle^l\;(v\;(\langle \tau_1 \Leftarrow \tau_3 \rangle^{\overline{l}}\;w))$.

From the typing of $e$: $\langle \tau_3 \to \tau_4 \Leftarrow \tau_1 \to \tau_2 \rangle^l\;v : \tau_3 \to \tau_4$, so the application has type $\tau_4$ (assuming $w : \tau_3$).

For $e'$: $\langle \tau_1 \Leftarrow \tau_3 \rangle^{\overline{l}}\;w : \tau_1$ (by T-Cast, since $\tau_3 \sim \tau_1$). Then $v\;(\langle \tau_1 \Leftarrow \tau_3 \rangle^{\overline{l}}\;w) : \tau_2$ (since $v : \tau_1 \to \tau_2$). Finally, $\langle \tau_4 \Leftarrow \tau_2 \rangle^l\;(v\;\ldots) : \tau_4$ (by T-Cast, since $\tau_2 \sim \tau_4$). So $e' : \tau_4 = \tau$. $\square$

### 2.8 The Gradual Guarantee

The gradual guarantee, formalized by Siek, Vitousek, Cimini, and Boyland (2015), is the central metatheoretic property that distinguishes gradual typing from ad hoc combinations of static and dynamic typing.

**Definition 2.25 (Term precision).** We extend the precision ordering $\sqsubseteq$ to terms: $e_1 \sqsubseteq e_2$ if $e_2$ is obtained from $e_1$ by replacing some type annotations with more precise types (or equivalently, $e_1$ is obtained from $e_2$ by replacing some annotations with $\star$).

**Theorem 2.26 (The gradual guarantee).** The GTLC satisfies:

**(Static gradual guarantee):** If $\Gamma \vdash e : \tau$ and $e \sqsubseteq e'$ (i.e., $e'$ has more precise annotations), then $\Gamma' \vdash e' : \tau'$ for some $\Gamma' \sqsupseteq \Gamma$ and $\tau' \sqsupseteq \tau$.

**(Dynamic gradual guarantee):** If $\Gamma \vdash e : \tau$ and $e \sqsubseteq e'$, then:
- If the elaboration of $e$ evaluates to a value $v$, then the elaboration of $e'$ either evaluates to a value $v' \sqsupseteq v$ or raises blame.
- If the elaboration of $e$ diverges, then the elaboration of $e'$ either diverges or raises blame.
- If the elaboration of $e$ raises blame, then the elaboration of $e'$ raises blame.

**Interpretation.** The static guarantee says: removing type annotations (making types less precise) never causes a type error. You can always go from fully typed to fully untyped by replacing annotations with $\star$, and the program remains well-typed. The dynamic guarantee says: adding correct type annotations never changes the behavior of a program (except possibly by catching errors earlier, via blame).

Together, these guarantees ensure a smooth migration path: a programmer can start with an untyped program, gradually add type annotations, and be confident that each annotation either confirms existing behavior or catches a bug (via blame).

**Remark 2.28 (The gradual guarantee as a design criterion).** The gradual guarantee is not just a theorem to be proved after the fact; it is a *design criterion* that constrains the design of the type system. Siek et al. (2015) showed that many seemingly natural gradual type systems *fail* the gradual guarantee. For example:

- A gradual type system that uses *type equality* (rather than consistency) for function application fails the static guarantee: removing an annotation from a well-typed program can cause a type error.
- A gradual type system that uses *eager cast checking* (checking all casts at cast creation time, rather than lazily) can fail the dynamic guarantee: adding a correct annotation can change the behavior of a program.

The gradual guarantee thus serves as a litmus test for the quality of a gradual type system design.

**Remark 2.29 (Gradual guarantee and refactoring).** The practical significance of the gradual guarantee is that it enables *safe refactoring*. Consider a large Python codebase to which type annotations are being added (a common scenario at companies like Dropbox, which adopted mypy for gradual typing). The gradual guarantee assures the developers that:

1. Any file can have its annotations removed without breaking the type checker (static guarantee).
2. Adding correct annotations to a file does not change the runtime behavior of the program (dynamic guarantee) --- it only adds new checks that may catch bugs earlier.

This is why the gradual guarantee matters for industrial adoption.

### 2.8 Abstracting Gradual Typing (AGT)

Garcia, Clark, and Tanter (2016) introduced the **Abstracting Gradual Typing** (AGT) methodology, which provides a systematic way to derive a gradual type system from a static type system.

**Key idea.** A gradual type $\widetilde{\tau}$ represents a *set of static types* --- the set of types that are "consistent" with $\widetilde{\tau}$. The concretization function $\gamma$ maps a gradual type to the set of static types it represents:

$$\gamma(\text{Int}) = \{\text{Int}\}$$

$$\gamma(\text{Bool}) = \{\text{Bool}\}$$

$$\gamma(\star) = \{\text{all types}\}$$

$$\gamma(\widetilde{\tau}_1 \to \widetilde{\tau}_2) = \{\tau_1 \to \tau_2 \mid \tau_1 \in \gamma(\widetilde{\tau}_1),\; \tau_2 \in \gamma(\widetilde{\tau}_2)\}$$

**Definition 2.27 (Consistent lifting).** A predicate $P$ on static types is *consistently lifted* to gradual types by:

$$\widetilde{P}(\widetilde{\tau}) \iff \exists \tau \in \gamma(\widetilde{\tau}).\; P(\tau)$$

A relation $R$ on static types is consistently lifted to gradual types by:

$$\widetilde{R}(\widetilde{\tau}_1, \widetilde{\tau}_2) \iff \exists \tau_1 \in \gamma(\widetilde{\tau}_1).\; \exists \tau_2 \in \gamma(\widetilde{\tau}_2).\; R(\tau_1, \tau_2)$$

**Theorem 2.28 (AGT for subtyping).** Starting from a standard subtyping relation $<:$, the consistent lifting $\widetilde{<:}$ coincides with the consistent subtyping relation $\lesssim$ of Siek and Taha (2007).

**The AGT recipe.** Given a static type system:

1. **Define gradual types:** Extend the syntax of types with $\star$ (and possibly partially unknown types like $\star \to \text{Int}$).
2. **Define concretization:** Map each gradual type to the set of static types it represents.
3. **Lift predicates and relations:** Use consistent lifting to obtain gradual versions of all typing predicates.
4. **Derive typing rules:** The gradual typing rules are obtained by replacing static predicates with their consistent lifts.
5. **Derive the cast calculus:** Casts are inserted wherever the gradual system allows something the static system would not.
6. **Prove the gradual guarantee:** This follows (under suitable conditions) from the construction.

**Remark 2.29.** AGT has been applied to derive gradual versions of type systems with subtyping, polymorphism (Garcia et al., 2016), refinement types (Lehmann and Tanter, 2017), and effects (Banasieczuk et al., 2021).

### 2.9 Practical Gradually Typed Systems

We survey several practical systems and evaluate them against the theoretical ideal.

**TypeScript.**

TypeScript adds static types to JavaScript. Its type system includes union types, intersection types, generics, and structural subtyping. Key features:

- The `any` type plays the role of $\star$: a value of type `any` can be used as any type without casts.
- TypeScript performs *type erasure* at compile time: all type annotations are removed, and the generated JavaScript has no runtime type checks.
- **Consequence:** TypeScript does *not* satisfy the dynamic gradual guarantee. A program that type-checks may still exhibit type errors at runtime because there are no casts to enforce the type boundaries.
- TypeScript is best described as an *optional type system* (Bracha, 2004) rather than a gradually typed system in the formal sense.

**Python type hints (mypy, pyright).**

Python 3.5+ supports type annotations as syntactic metadata, checked by external tools (mypy, pyright). Key features:

- `Any` serves as the dynamic type.
- Type checking is purely static; no runtime casts are inserted by the type checker.
- The `typing` module provides generic types, protocols, and type aliases.
- Some runtime checking is available via third-party libraries (typeguard, beartype).
- Like TypeScript, Python's type hints do not enforce runtime type safety and do not satisfy the gradual guarantee in the formal sense.

**Typed Racket.**

Typed Racket (Tobin-Hochstadt and Felleisen, 2006) is a sister language of Racket that interoperates with untyped Racket modules. Key features:

- Uses *higher-order contracts* to enforce type boundaries at runtime.
- When a typed module imports a value from an untyped module, a contract is attached that checks the value's type at runtime.
- Typed Racket satisfies a form of the gradual guarantee (modulo some subtle issues with mutable state and variable-arity functions).
- The runtime overhead of contracts can be significant, leading to research on optimizing contract checking (e.g., Feltey et al., 2018).

**Reticulated Python.**

Vitousek, Kent, Siek, and Baker (2014) developed Reticulated Python, a research implementation of gradual typing for Python that inserts runtime casts and satisfies the gradual guarantee. It demonstrated the feasibility of the approach but at a significant performance cost.

### 2.10 The Semantics of the Dynamic Type

Before discussing practical systems, it is worth examining the semantics of the dynamic type $\star$ more carefully.

**Definition 2.30.** The *dynamic type* $\star$ can be given denotational semantics in several ways:

1. **Tagged unions.** $\star$ is interpreted as a discriminated union of all ground types: $\star \cong \text{Int} + \text{Bool} + (\star \to \star)$. A value of type $\star$ is a tagged value: an integer with tag "Int," a boolean with tag "Bool," or a function with tag "Fun." Injection tags the value; projection checks the tag.

2. **Universal domain.** In domain theory, $\star$ can be interpreted as a universal domain $D$ satisfying $D \cong D \to D$ (a reflexive domain). This is the Scott/Plotkin approach to modeling the untyped lambda calculus.

3. **Abstracting Gradual Typing.** Under AGT, $\star$ is interpreted as the set of *all* types: $\gamma(\star) = \{\text{all types}\}$.

**Remark 2.31.** The tagged union interpretation is the most directly implementable. At runtime, a value of type $\star$ is stored as a pair $(\text{tag}, \text{value})$, where the tag indicates the ground type. Injection produces such a pair; projection checks the tag and either extracts the value or raises blame.

For function types, the situation is more subtle: a function $f : \tau_1 \to \tau_2$ cast to $\star$ is stored with tag "Fun" but retains its original behavior. When the dynamic function is applied, a proxy monitors the interaction, casting the argument and result as needed.

### 2.11 Performance and the "Gradual Typing Is Dead" Debate

Takikawa, Feltey, Greenman, New, Vitek, and Felleisen (2016) conducted a systematic performance evaluation of Typed Racket's gradual typing and found that programs with many typed-untyped boundaries suffered severe performance degradation (up to 100x slowdown). This led to their provocatively titled paper "Is Sound Gradual Typing Dead?"

The performance overhead arises from higher-order contracts: every time a function crosses a type boundary, a proxy is allocated. In deeply nested higher-order code, the number of proxies grows rapidly.

Subsequent work has addressed this through:

- **Space-efficient casts** (Herman, Tomb, and Flanagan, 2010): coalesce adjacent casts to prevent unbounded proxy growth.
- **Monotonic references** (Siek et al., 2015): mutable references that only become more precisely typed, avoiding repeated checking.
- **Transient semantics** (Vitousek et al., 2017): check only the top-level type constructor at each boundary, sacrificing full behavioral checking for performance.
- **Concrete types** (Greenman and Felleisen, 2018): restrict the kinds of values that can cross boundaries.

The performance question remains an active area of research. The tradeoff between the strength of runtime guarantees and performance overhead is a central challenge in practical gradual typing.

Greenman and Felleisen (2018) proposed a *spectrum* of gradual typing enforcement strategies:

| Strategy | Checks | Performance | Guarantees |
|----------|--------|-------------|------------|
| Erasure | None | Best | None |
| Transient | Type tag only | Good | Shallow type safety |
| Behavioral (Natural) | Full contract | Worst | Deep type safety |
| Concrete | Full, no proxies | Moderate | Deep, restricted |

Each point on the spectrum represents a different tradeoff. The "right" choice depends on the application: exploratory scripting may prefer erasure or transient semantics, while safety-critical code may require full behavioral enforcement.

### 2.12 Gradual Typing and Parametricity

A particularly subtle challenge arises when combining gradual typing with parametric polymorphism.

**The problem.** In System F, the type $\forall \alpha.\, \alpha \to \alpha$ is inhabited only by the identity function (and divergence), by the parametricity theorem (Reynolds, 1983). But in a gradually typed version of System F, can a term of type $\forall \alpha.\, \alpha \to \alpha$ inspect its argument (e.g., check if it is an integer)?

**Definition 2.30 (Gradual parametricity).** A gradually typed polymorphic system satisfies *gradual parametricity* if:

1. Fully statically typed terms satisfy the standard parametricity theorem.
2. Dynamically typed terms may violate parametricity (since they can inspect values at runtime).
3. The boundary between static and dynamic code is enforced by "parametric" casts that preserve the abstraction.

**Remark 2.31.** Achieving gradual parametricity requires sealing: dynamically typed code must not be able to inspect values that cross a polymorphic boundary. The *sealing* approach of Matthews and Ahmed (2008) and the *polymorphic blame calculus* of Ahmed et al. (2011, 2017) address this. New and Ahmed (2018) proved a gradual free theorem, establishing that parametricity degrades gracefully in the presence of dynamic typing.

### 2.12 Gradual Typing and Dependent Types

Extending gradual typing to dependent types raises deep questions.

**The challenge.** In a dependently typed language, types depend on terms. If a term has type $\star$ (unknown), then types that depend on it are also unknown. How should the type checker handle expressions like $\text{Vec}(A, x)$ when $x : \star$?

**Approaches:**

1. **Gradual Certified Programming** (Eremondi, Dias, and Tanter, 2019): combine dependent types with gradual typing, using "unknown proofs" for propositions that cannot be statically verified.
2. **Dependent contracts** (Greenberg, Pierce, and Weirich, 2012): use contracts to enforce dependent type specifications at runtime.
3. **Gradual dependent types** (Lennon-Bertrand et al., 2022): a gradually typed version of the Calculus of Inductive Constructions, using "casts between sorts" to handle the interaction between types and terms.

This is an active research frontier with many open questions.

### 2.14 Gradual Typing for Other Type Features

The gradual typing methodology has been extended to many other type system features:

**Gradual effects.** Banasieczuk, Castagna, and Tanter (2021) developed gradual typing for effect systems. The dynamic effect $\star_\text{eff}$ represents unknown computational effects. A function typed as $\text{Int} \xrightarrow{\star_\text{eff}} \text{Int}$ may have any effect (I/O, exceptions, state), and the runtime monitors whether the actual effects are compatible with the context's expectations.

**Gradual security typing.** Disney and Flanagan (2011) combined gradual typing with information-flow type systems. The dynamic security label $\star_\text{sec}$ represents unknown confidentiality. Programs with mixed security annotations are checked where possible and monitored at runtime.

**Gradual ownership.** Sergey and Clarke (2012) explored gradual typing for ownership type systems, where the dynamic owner $\star_\text{own}$ represents unknown ownership, and runtime checks enforce the ownership discipline at boundaries.

**Gradual session types.** Igarashi et al. (2017) developed gradual typing for session types, where the dynamic protocol $\star_\text{sess}$ represents unknown communication behavior, and runtime monitoring checks protocol compliance.

Each of these extensions follows the same general pattern: (1) introduce a dynamic element for the unknown case; (2) define consistency for the extended type language; (3) elaborate into a cast calculus with appropriate runtime checks; (4) verify the gradual guarantee.

### 2.15 Formalization and Mechanization

Several gradual typing systems have been mechanized in proof assistants:

- **The Agda formalization** of the gradual guarantee by New, Licata, and Ahmed (2019) provides a machine-checked proof that the GTLC satisfies both components of the guarantee.
- **The Coq formalization** of the polymorphic blame calculus by Ahmed et al. (2017) formalizes parametric gradual typing.
- **Abstracting Gradual Typing** has been partially mechanized in Coq by Bader et al. (2018).

These mechanizations have uncovered subtle errors in published proofs and confirmed the correctness of the key metatheoretic results.

---

## 3. Worked Examples

### Example 3.1: Full Elaboration and Evaluation

Consider the GTLC program:

$$\text{let}\;f = \lambda x{:}\star.\, x\;\text{in}\;(f\;(\lambda y{:}\text{Int}.\, y + 1))\;42$$

**Typing.**

- $f : \star \to \star$ (since the body $x$ has type $\star$, and the result is $\star$).
- $f\;(\lambda y{:}\text{Int}.\, y + 1)$: the argument has type $\text{Int} \to \text{Int}$, which is consistent with $\star$. The result has type $\star$.
- $(f\;(\lambda y{:}\text{Int}.\, y + 1))\;42$: the function part has type $\star$, which matches $\star \to \star$. The argument $42 : \text{Int}$ is consistent with $\star$. The result has type $\star$.

**Elaboration.** (Inserting casts)

$$((\lambda x{:}\star.\, x)\;(\langle \star \Leftarrow \text{Int} \to \text{Int} \rangle^{l_1}\;(\lambda y{:}\text{Int}.\, y + 1)))$$

Apply $f$ to get $\langle \star \Leftarrow \text{Int} \to \text{Int} \rangle^{l_1}\;(\lambda y{:}\text{Int}.\, y + 1)$, a dynamically typed function. Then apply this to $42$:

$$(\langle \star \to \star \Leftarrow \star \rangle^{l_2}\;(\langle \star \Leftarrow \text{Int} \to \text{Int} \rangle^{l_1}\;(\lambda y{:}\text{Int}.\, y + 1)))\;(\langle \star \Leftarrow \text{Int} \rangle^{l_3}\;42)$$

**Evaluation.**

1. The projection cast $\langle \star \to \star \Leftarrow \star \rangle^{l_2}$ checks that the dynamic value is a function. It is (ground type $\star \to \star$), so it succeeds.
2. The function proxy receives the argument $\langle \star \Leftarrow \text{Int} \rangle^{l_3}\;42$.
3. The proxy casts the argument from $\star$ to $\text{Int}$, recovering $42$.
4. It applies $(\lambda y{:}\text{Int}.\, y + 1)$ to $42$, obtaining $43$.
5. It casts the result from $\text{Int}$ to $\star$, obtaining $\langle \star \Leftarrow \text{Int} \rangle\;43$.
6. Final result: $\langle \star \Leftarrow \text{Int} \rangle\;43$ (a dynamically typed integer value).

### Example 3.2: Blame Tracking

Consider:

$$(\lambda f{:}\text{Int} \to \text{Int}.\, f\;42)\;(\lambda x{:}\star.\, \text{true})$$

**Elaboration.** The argument $\lambda x{:}\star.\, \text{true}$ has type $\star \to \text{Bool}$. It must be cast to $\text{Int} \to \text{Int}$:

$$(\lambda f{:}\text{Int} \to \text{Int}.\, f\;42)\;(\langle \text{Int} \to \text{Int} \Leftarrow \star \to \text{Bool} \rangle^l\;(\lambda x{:}\star.\, \text{true}))$$

**Evaluation.**

1. $\beta$-reduce: $(\langle \text{Int} \to \text{Int} \Leftarrow \star \to \text{Bool} \rangle^l\;(\lambda x{:}\star.\, \text{true}))\;42$
2. The function proxy casts $42$ from $\text{Int}$ to $\star$ (contravariant, succeeds), applies $\lambda x{:}\star.\, \text{true}$ to get $\text{true}$, then casts $\text{true}$ from $\text{Bool}$ to $\text{Int}$ (covariant).
3. The covariant cast $\langle \text{Int} \Leftarrow \text{Bool} \rangle^l\;\text{true}$ fails: ground type $\text{Bool} \neq \text{Int}$.
4. Result: $\text{blame}\;l$.

The blame label $l$ points to the cast site, which in the source program is the boundary where $\lambda x{:}\star.\, \text{true}$ was passed to a context expecting $\text{Int} \to \text{Int}$.

### Example 3.3: The Gradual Guarantee in Action

Consider three versions of a program with increasing type precision:

$$e_1 \equiv (\lambda x{:}\star.\, x + 1)\;42 \qquad (\text{least precise})$$

$$e_2 \equiv (\lambda x{:}\text{Int}.\, x + 1)\;42 \qquad (\text{fully precise})$$

$$e_3 \equiv (\lambda x{:}\star.\, x + 1)\;\text{true} \qquad (\text{least precise, but buggy})$$

- $e_1$ is well-typed (with type $\text{Int}$) and evaluates to $43$.
- $e_2$ is well-typed (with type $\text{Int}$) and evaluates to $43$. (Static guarantee: more precise annotations preserve typability. Dynamic guarantee: same result.)
- $e_3$ is well-typed (with type $\text{Int}$) but evaluates to $\text{blame}\;l$ at runtime. Adding precision to get $(\lambda x{:}\text{Int}.\, x + 1)\;\text{true}$ would be a *static* type error --- the gradual guarantee is consistent, since the more precise version rejects the program statically rather than at runtime.

---

## 4. Exercises

**Exercise 10c.1.** Prove that the consistency relation is not transitive, by giving a concrete counterexample with types $\tau_1, \tau_2, \tau_3$ such that $\tau_1 \sim \tau_2$ and $\tau_2 \sim \tau_3$ but $\tau_1 \not\sim \tau_3$.

**Exercise 10c.2.** Define the consistency relation for a language with product types $\tau_1 \times \tau_2$ in addition to function types. State and prove the analogue of Proposition 2.5 (reflexivity, symmetry, non-transitivity).

**Exercise 10c.3.** Elaborate the following GTLC term into the cast calculus:

$$(\lambda f{:}\star.\, f\;1 + f\;2)\;(\lambda x{:}\text{Int}.\, x \times x)$$

Trace the evaluation of the elaborated term to its final value.

**Exercise 10c.4.** Give an example of a gradually typed program that evaluates successfully but would be rejected by the static type system (i.e., it is not typable without $\star$). Conversely, give an example of a statically well-typed program that, when type annotations are replaced by $\star$, evaluates to blame.

**Exercise 10c.5.** Prove the preservation lemma for the cast calculus: if $\vdash e : \tau$ and $e \longrightarrow e'$, then $\vdash e' : \tau$. Handle the identity cast, injection, successful projection, and function cast cases.

**Exercise 10c.6.** Apply the AGT methodology to derive a gradual version of a simple type system with subtyping (e.g., $\text{Int} <: \text{Real}$). Define the concretization function, consistently lift the subtyping relation, and state the resulting typing rules.

**Exercise 10c.7.** Define the type precision ordering $\sqsubseteq$ for a language with reference types $\text{Ref}\;\tau$ in addition to function types. Is the precision ordering covariant or invariant in the reference type? Justify your answer by considering what would go wrong with the gradual guarantee if the wrong variance were chosen.

**Exercise 10c.8.** Consider a gradually typed program that uses the dynamic type in a higher-order context:

$$(\lambda f{:}\star.\, \lambda g{:}\star.\, \lambda x{:}\text{Int}.\, f\;(g\;x))\;(\lambda y{:}\text{Int}.\, y + 1)\;(\lambda z{:}\text{Int}.\, z \times 2)\;5$$

Elaborate this into the cast calculus, showing all inserted casts. Trace the evaluation to the final result. How many casts are executed during evaluation? How would the space-efficient coercion calculus reduce the number of active casts?

**Exercise 10c.9 (Challenging).** Formalize the space-efficient cast calculus of Herman, Tomb, and Flanagan (2010), where casts are represented as "coercions" that can be composed and simplified. Show that the space-efficient semantics is equivalent to the standard semantics (produces the same results and blame) but uses bounded space per cast chain.

**Exercise 10c.10 (Open-ended).** TypeScript's `any` type is often described as providing "gradual typing" for JavaScript. Analyze how TypeScript's `any` differs from the theoretical dynamic type $\star$ studied in this lecture. Consider: (a) Does TypeScript insert runtime casts? (b) Can a program that type-checks with `any` annotations cause a runtime type error that would not occur in a sound gradually typed system? (c) Does TypeScript satisfy either component of the gradual guarantee? Give specific code examples to support your analysis.

---

## Summary

- Gradual typing bridges static and dynamic typing by introducing the dynamic type $\star$ and a consistency relation that governs interactions between precisely typed and dynamically typed code.
- The GTLC elaborates into a cast calculus where type mismatches are made explicit by casts annotated with blame labels. Casts check type compatibility at runtime, raising blame when a violation is detected.
- The gradual guarantee ensures that removing type annotations preserves well-typedness (static guarantee) and that adding correct annotations does not change program behavior (dynamic guarantee).
- The AGT methodology systematically derives gradual type systems from static ones by interpreting gradual types as sets of static types and consistently lifting typing predicates.
- Practical systems (TypeScript, Python/mypy) typically implement optional typing (compile-time only) rather than full gradual typing with runtime checks. Typed Racket is closer to the theoretical ideal.
- Combining gradual typing with parametric polymorphism requires careful treatment to preserve free theorems, and combining it with dependent types is an active research frontier.
- The performance overhead of sound gradual typing is a significant practical challenge, motivating research into space-efficient casts, transient semantics, and other optimizations.

---

## Further Reading

1. **Siek, J.G. and Taha, W.** "Gradual Typing for Functional Languages." *Scheme and Functional Programming Workshop*, 2006. The foundational paper introducing gradual typing.

2. **Siek, J.G., Vitousek, M.M., Cimini, M., and Boyland, J.T.** "Refined Criteria for Gradual Typing." *SNAPL*, 2015. Formulation of the gradual guarantee.

3. **Garcia, R., Clark, A.M., and Tanter, E.** "Abstracting Gradual Typing." *POPL*, 2016. The AGT methodology.

4. **Wadler, P. and Findler, R.B.** "Well-Typed Programs Can't Be Blamed." *ESOP*, 2009. Blame safety theorem.

5. **Tobin-Hochstadt, S. and Felleisen, M.** "Interlanguage Migration: From Scripts to Programs." *OOPSLA*, 2006. Typed Racket.

6. **Takikawa, A., Feltey, D., Greenman, B., New, M.S., Vitek, J., and Felleisen, M.** "Is Sound Gradual Typing Dead?" *POPL*, 2016. Performance evaluation of gradual typing.

7. **New, M.S. and Ahmed, A.** "Graduality from Embedding-Projection Pairs." *ICFP*, 2018. Gradual free theorems and the connection between gradual typing and parametricity.

8. **Herman, D., Tomb, A., and Flanagan, C.** "Space-Efficient Gradual Typing." *Higher-Order and Symbolic Computation* 23(2), 2010.

9. **Findler, R.B. and Felleisen, M.** "Contracts for Higher-Order Functions." *ICFP*, 2002. The foundation for higher-order runtime checking.

10. **Lennon-Bertrand, M., Maillard, K., Tabareau, N., and Tanter, E.** "Gradualizing the Calculus of Inductive Constructions." *TOPLAS* 44(2), 2022. Gradual dependent types.

11. **Greenman, B. and Felleisen, M.** "A Spectrum of Type Soundness and Performance." *ICFP*, 2018. A taxonomy of gradual typing enforcement strategies.

12. **Vitousek, M.M., Siek, J.G., and Chaudhuri, A.** "Big Types in Little Runtime." *POPL*, 2017. Transient gradual typing semantics.
