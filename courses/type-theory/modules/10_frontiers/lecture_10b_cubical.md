---
title: "Lecture 10b: Cubical Type Theory"
tags:
  - type-theory
  - frontiers
  - lecture
---
# Lecture 10b: Cubical Type Theory

> **Module 10 --- Frontiers (Weeks 19--20)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain why the univalence axiom, as an axiom, blocks computation, and articulate the motivation for cubical type theory as a solution.
2. Describe the abstract interval $\mathbb{I}$ and its algebraic structure (de Morgan algebra), and explain how path types are reformulated as functions from the interval.
3. Define path types in cubical type theory using the interval and boundary conditions, and compare them with identity types in MLTT.
4. State and explain the Kan operations (transport and composition) in cubical type theory and how they restore the computational content of type theory.
5. Define glue types and explain their role in making the univalence axiom compute.
6. Describe the cubical set model and explain how it validates the rules of cubical type theory.
7. Formulate higher inductive types in the cubical setting and explain how their computation rules become judgmental.
8. Write basic proofs in Cubical Agda using interval variables, path types, and transport.

---

## 1. Motivation

### 1.1 The Computational Problem with Axiomatic Univalence

Lecture 10a introduced the univalence axiom, which asserts that $(A =_\mathcal{U} B) \simeq (A \simeq B)$. This axiom is enormously powerful: it identifies equivalent types, implies function extensionality, and enables the structure identity principle. But as presented in HoTT based on Martin-L\"of type theory, univalence suffers from a critical computational deficiency.

In MLTT, terms in canonical form are evaluated by the computation rules of the type formers. The computation rule for the J eliminator reduces $J(C, c, a, a, \text{refl}_a)$ to $c(a)$. But univalence introduces a new term former $\text{ua}(e)$ that produces a path $A =_\mathcal{U} B$ from an equivalence $e : A \simeq B$, and the axiom gives no reduction rule for $J$ applied to $\text{ua}(e)$ when $e$ is not the identity equivalence. If we try to evaluate

$$\text{transport}^P(\text{ua}(e), x)$$

the type checker encounters the axiom and gets stuck: it knows the result should be $e(x)$ (by the computation principle of univalence), but the J eliminator does not reduce because $\text{ua}(e)$ is not $\text{refl}$.

This is not merely an aesthetic problem. In a proof assistant based on dependent type theory, type checking involves evaluating terms to normal form. An axiom that blocks computation means that certain well-typed terms cannot be normalized, which undermines the computational character of the system. Terms involving $\text{ua}$ become opaque blobs that the type checker cannot inspect.

**Cubical type theory** solves this problem by redesigning the type theory from the ground up. Instead of treating paths as elements of an inductive identity type (eliminated by J), cubical type theory treats paths as *functions from an abstract interval*. The interval provides enough structure to define transport, composition, and univalence as computable operations, not axioms.

### 1.2 A Concrete Example of the Problem

Consider the following situation. We have two equivalent representations of booleans:

$$\text{Bool}_1 :\equiv \mathbf{1} + \mathbf{1} \qquad \text{Bool}_2 :\equiv \{0, 1\} \subset \mathbb{N}$$

with an equivalence $e : \text{Bool}_1 \simeq \text{Bool}_2$. Suppose we have a function $f : \text{Bool}_1 \to \mathbb{N}$ and we want to transport it along $\text{ua}(e)$ to get a function $g : \text{Bool}_2 \to \mathbb{N}$. In axiomatic HoTT:

$$g :\equiv \text{transport}^{X \mapsto X \to \mathbb{N}}(\text{ua}(e), f)$$

The type checker knows $g : \text{Bool}_2 \to \mathbb{N}$, and it knows that $g$ should satisfy $g(e(b)) = f(b)$ for all $b$. But it cannot *compute* $g(0)$ or $g(1)$, because the transport through $\text{ua}(e)$ does not reduce. The term $g$ is well-typed but computationally stuck.

In cubical type theory, the same transport reduces step by step:

$$g(x) \equiv \text{transp}\;(\lambda i.\, \text{ua}(e)(i) \to \mathbb{N})\;f\;x \equiv f(\text{transp}\;(\lambda i.\, \text{ua}(e)(\neg i))\;x) \equiv f(e^{-1}(x))$$

This is a concrete, computable function. We can evaluate $g(0) = f(e^{-1}(0))$, which reduces to a specific natural number.

### 1.3 Historical Development

The quest for computational univalence has a rich history:

- **Licata and Harper (2012)** explored "canonicity for 2-dimensional type theory," a precursor to cubical approaches.
- **Bezem, Coquand, and Huber (2013)** constructed the first cubical set model, showing that cubical sets can interpret type theory with a form of univalence. However, their initial model had technical issues (universe did not model all type formers).
- **Cohen, Coquand, Huber, and M\"ortberg (2015/2018)** resolved these issues by introducing glue types and formulated the CCHM cubical type theory, which is the primary system studied in this lecture.
- **Angiuli, Favonia, and Harper (2018)** developed Cartesian cubical type theory, an alternative that uses a simpler interval (without de Morgan negation) but requires additional machinery.
- **Vezzosi, M\"ortberg, and Abel (2019)** implemented CCHM cubical type theory in Agda, creating **Cubical Agda**, the most widely used cubical proof assistant.
- **Sterling and Angiuli (2021)** proved normalization for a fragment of cubical type theory.

The key developments are:

- **Cohen, Coquand, Huber, and M\"ortberg (2018):** Cubical Type Theory (CTT), implemented in the proof assistant **cubicaltt**.
- **Vezzosi, M\"ortberg, and Abel (2019):** Cubical Agda, an extension of the Agda proof assistant with cubical primitives.
- **Angiuli, Brunerie, Coquand, Favonia, Harper, and Licata (2021):** Cartesian cubical type theory, an alternative cubical system.

---

## 2. Core Theory

### 2.1 The Abstract Interval

The central innovation of cubical type theory is the introduction of an abstract *interval* into the type theory. This interval is not a type in the usual sense --- it is a *dimension* that parameterizes paths.

**Definition 2.1 (The interval $\mathbb{I}$).** The interval $\mathbb{I}$ is a formal object with:

- Two endpoints: $0 : \mathbb{I}$ and $1 : \mathbb{I}$.
- Dimension variables: $i, j, k, \ldots$ ranging over $\mathbb{I}$.

In the De Morgan variant of cubical type theory (CCHM), the interval carries the structure of a *de Morgan algebra*:

- Meet: $i \wedge j : \mathbb{I}$
- Join: $i \vee j : \mathbb{I}$
- Negation: $\neg i : \mathbb{I}$ (also written $1 - i$)

satisfying the laws:

$$i \wedge 0 = 0, \quad i \wedge 1 = i, \quad i \vee 0 = i, \quad i \vee 1 = 1$$

$$i \wedge j = j \wedge i, \quad i \vee j = j \vee i$$

$$\neg 0 = 1, \quad \neg 1 = 0, \quad \neg(\neg i) = i$$

$$\neg(i \wedge j) = \neg i \vee \neg j, \quad \neg(i \vee j) = \neg i \wedge \neg j$$

**Remark 2.2 (Interval is not a type).** The interval $\mathbb{I}$ is *not* a type in the universe $\mathcal{U}$. One cannot form $\Sigma$-types or $\Pi$-types over $\mathbb{I}$ in the usual sense. Instead, $\mathbb{I}$ exists at a separate "dimension level." A context in cubical type theory has two parts: a *dimension context* $\Phi$ listing dimension variables, and a *type context* $\Gamma$ listing typed variables. A typical judgment looks like:

$$\Phi \mid \Gamma \vdash t : A$$

where $\Phi = i_1, \ldots, i_n$ and $\Gamma = x_1 : A_1, \ldots, x_m : A_m$.

**Remark 2.3 (Cartesian vs. De Morgan).** There are two main variants:

- **De Morgan cubical type theory (CCHM):** The interval has the full de Morgan algebra structure above. This is implemented in Cubical Agda and cubicaltt.
- **Cartesian cubical type theory:** The interval has only the meet and join operations, not the negation. This variant has different properties (e.g., path types are not always Kan) and requires additional adjustments.

We focus primarily on the CCHM variant.

**Remark 2.4 (Geometric intuition).** Think of the interval $\mathbb{I}$ as the unit interval $[0,1]$, but abstracted so that we only have access to its algebraic structure, not its topological properties. A dimension variable $i : \mathbb{I}$ represents a "position along a path." The expression $i \wedge j$ represents "the minimum of $i$ and $j$" (a connection), $i \vee j$ represents "the maximum," and $\neg i$ represents "reflection" ($1 - i$). These operations generate all the face maps and degeneracies needed for cubical geometry.

**Definition 2.5 (Cubes).** An $n$-dimensional cube is parameterized by $n$ dimension variables $i_1, \ldots, i_n : \mathbb{I}$. For example:
- A 0-cube (point) has no dimension variables.
- A 1-cube (line/path) has one dimension variable $i$.
- A 2-cube (square) has two dimension variables $i, j$.
- A 3-cube (cube) has three dimension variables $i, j, k$.

The *boundary* of an $n$-cube consists of its $2n$ faces, obtained by setting each dimension variable to $0$ or $1$.

**Definition 2.6 (Substitution).** Given a term $t$ in context $\Phi, i \mid \Gamma$ and a dimension expression $r$, the substitution $t[i := r]$ replaces $i$ by $r$ throughout $t$. This is the fundamental operation for restricting to faces: $t[i := 0]$ gives the face at $i = 0$, and $t[i := 1]$ gives the face at $i = 1$.

### 2.2 Path Types

In MLTT, the identity type $a =_A b$ is an inductively defined type with constructor $\text{refl}$. In cubical type theory, paths are reformulated as functions from the interval with specified boundary behavior.

**Definition 2.4 (Path type).** For a type $A : \mathcal{U}$ and elements $a, b : A$, the *path type* is

$$\text{Path}\;A\;a\;b :\equiv \{f : \mathbb{I} \to A \mid f(0) \equiv a,\; f(1) \equiv b\}$$

More precisely, a term $p : \text{Path}\;A\;a\;b$ in context $\Phi \mid \Gamma$ is a term $t : A$ in context $\Phi, i \mid \Gamma$ (where $i$ is a fresh dimension variable) such that $t[i := 0] \equiv a$ and $t[i := 1] \equiv b$.

We write $\lambda i.\, t$ for the path abstraction and $p\;r$ (or $p(r)$) for applying a path to a dimension expression $r : \mathbb{I}$. The computation rules are:

$$(\lambda i.\, t)\;r \equiv t[i := r]$$

$$p\;0 \equiv a, \quad p\;1 \equiv b$$

**Definition 2.5 (Reflexivity).** For $a : A$, the reflexivity path is

$$\text{refl}_a :\equiv \lambda i.\, a : \text{Path}\;A\;a\;a$$

This is the constant function on the interval. Its endpoints are both $a$, as required.

**Definition 2.6 (Symmetry / path reversal).** For $p : \text{Path}\;A\;a\;b$, define

$$p^{-1} :\equiv \lambda i.\, p(\neg i) : \text{Path}\;A\;b\;a$$

Check: $p^{-1}(0) = p(\neg 0) = p(1) = b$ and $p^{-1}(1) = p(\neg 1) = p(0) = a$. This definition uses the negation operation on $\mathbb{I}$, which is available in the De Morgan variant.

**Remark 2.7.** In Cartesian cubical type theory, where negation is not available, path reversal is defined differently, using the Kan composition operation.

**Definition 2.8 (Function extensionality --- for free).** In cubical type theory, function extensionality is a theorem, not an axiom. Given $h : \prod_{(x:A)} \text{Path}\;B\;(f(x))\;(g(x))$, define

$$\text{funExt}(h) :\equiv \lambda i.\, \lambda x.\, h(x)(i) : \text{Path}\;(A \to B)\;f\;g$$

Check: $\text{funExt}(h)(0) = \lambda x.\, h(x)(0) = \lambda x.\, f(x) = f$ and similarly at $1$.

This is a striking difference from MLTT, where function extensionality must be postulated. In cubical type theory, it follows from the ability to abstract over dimension variables inside $\lambda$-expressions.

**Definition 2.9 (Connections).** In CCHM cubical type theory, the meet and join operations on the interval provide *connections*, which are special 2-cubes:

$$\lambda i.\, \lambda j.\, p(i \wedge j) : \text{Square}\;A\;(\text{refl}\;a)\;p\;p\;(\text{refl}\;b)$$

Geometrically, this is a square whose bottom-left corner is "pinched" to the point $a$:

```
    a ---------- b
    |            |
    |            |
    |            |
    a ---- a --- a
```

Wait, more precisely: at $j = 0$, we get $p(i \wedge 0) = p(0) = a$ (constant at $a$); at $j = 1$, we get $p(i \wedge 1) = p(i)$ (the path $p$); at $i = 0$, we get $p(0 \wedge j) = p(0) = a$ (constant at $a$); at $i = 1$, we get $p(1 \wedge j) = p(j)$ (the path $p$).

So the square has:
- Left face: constant at $a$
- Right face: $p$
- Bottom face: constant at $a$
- Top face: $p$

Connections are useful for constructing fillers and proving coherence properties. They are unique to cubical type theory with connections (CCHM) and are not available in Cartesian cubical type theory.

**Definition 2.10 (The J eliminator, derived).** In cubical type theory, the J eliminator of MLTT can be *derived* from the cubical primitives. Given $C : \prod_{(b:A)} \text{Path}\;A\;a\;b \to \mathcal{U}$ and $c : C(a, \text{refl}_a)$, define:

$$J'(C, c, b, p) :\equiv \text{transp}\;(\lambda i.\, C(\text{fill}_p(i), \text{fill-path}_p(i)))\;c$$

where $\text{fill}_p$ is the filling of the path $p$ (connecting $a$ to $b$ over the interval) and $\text{fill-path}_p$ is the path connecting $\text{refl}_a$ to $p$ in the path space. The precise construction uses $\text{hcomp}$ and $\text{transp}$.

The computation rule $J'(C, c, a, \text{refl}_a) \equiv c$ holds *judgmentally* (in CCHM), because when $p = \text{refl}_a$, the filling degenerates and transport in a constant family is the identity.

This derivation shows that cubical type theory is at least as expressive as MLTT: anything provable with J is also provable with the cubical primitives. The converse is not true: function extensionality and univalence are provable in cubical type theory but not in MLTT.

### 2.3 Dependent Path Types

For dependent types, we need a notion of path that lies over a path in the base.

**Definition 2.9 (PathP --- path over a path).** Let $A : \mathbb{I} \to \mathcal{U}$ be a line of types (a type depending on a dimension variable), and let $a : A(0)$, $b : A(1)$. The dependent path type is

$$\text{PathP}\;A\;a\;b :\equiv \{f : (i : \mathbb{I}) \to A(i) \mid f(0) \equiv a,\; f(1) \equiv b\}$$

The non-dependent path type $\text{Path}\;A\;a\;b$ is the special case where $A$ is constant: $\text{PathP}\;(\lambda i.\, A)\;a\;b$.

**Remark 2.10.** $\text{PathP}$ is the cubical analogue of $\text{transport}$ composed with equality. In MLTT, a "path over a path" would be a term of type $\text{transport}^P(p, a) =_{P(b)} b'$. In cubical type theory, this is directly expressible as $\text{PathP}\;(\lambda i.\, P(p\;i))\;a\;b'$.

### 2.4 The Face Lattice and Partial Elements

Cubical type theory introduces a system of *faces* and *partial elements* that specify the boundary conditions for Kan operations.

**Definition 2.11 (Face formulas).** A *face formula* $\varphi$ is a formula built from:

- Atomic constraints: $i = 0$ and $i = 1$ for dimension variables $i$
- Conjunction: $\varphi_1 \wedge \varphi_2$
- Disjunction: $\varphi_1 \vee \varphi_2$
- Truth: $1_\mathbb{F}$ (always satisfied)
- Falsity: $0_\mathbb{F}$ (never satisfied)

A face formula $\varphi$ determines a *cofibration* --- a subset of the cube $\mathbb{I}^n$ (where $n$ is the number of dimension variables in context).

**Definition 2.12 (Partial types and elements).** Given a face formula $\varphi$ and a type $A$, the *partial type* $A[\varphi]$ represents elements of $A$ that are only defined when $\varphi$ holds. A *partial element* $u : A[\varphi]$ is a term of type $A$ that exists only on the face $\varphi$.

**Example 2.13.** In context $i : \mathbb{I}$, a partial element $u : A[i = 0 \vee i = 1]$ consists of two elements: $u_0 : A$ (when $i = 0$) and $u_1 : A$ (when $i = 1$), with no requirement that they be related when $i$ is in the interior of the interval.

**Definition 2.14 (Extension types).** Given a partial element $u : A[\varphi]$, the *extension type* $A[\varphi \mapsto u]$ is the type of elements $a : A$ that agree with $u$ on $\varphi$:

$$A[\varphi \mapsto u] :\equiv \{a : A \mid \varphi \Rightarrow a \equiv u\}$$

### 2.5 Kan Operations: Transport and Composition

The Kan operations are the computational heart of cubical type theory. They provide the mechanism by which paths can be composed and terms can be transported along paths.

**Definition 2.15 (Transport --- $\text{transp}$).** Given a line of types $A : \mathbb{I} \to \mathcal{U}$ and a term $a : A(0)$, transport produces a term

$$\text{transp}\;(\lambda i.\, A(i))\;a : A(1)$$

The transport operation is primitive: it is not defined in terms of other operations but is given by the type theory itself, with specific reduction rules for each type former.

The reduction rules for transport are defined by cases on the structure of $A(i)$:

**Case: $A(i) \equiv B$ (constant line).** $\text{transp}\;(\lambda i.\, B)\;a \equiv a$.

**Case: $A(i) \equiv \Pi(x : B(i)).\, C(i, x)$ (dependent function type).**

$$\text{transp}\;(\lambda i.\, \Pi(x : B(i)).\, C(i,x))\;f \equiv \lambda x.\, \text{transp}\;(\lambda i.\, C(i, \overline{x}(i)))\;(f\;(\text{transp}\;(\lambda i.\, B(\neg i))\;x))$$

where $\overline{x}(i) :\equiv \text{transp}\;(\lambda j.\, B(\neg i \vee \neg j))\;x$ is the "backwards fill."

**Case: $A(i) \equiv \Sigma(x : B(i)).\, C(i, x)$ (dependent pair type).**

$$\text{transp}\;(\lambda i.\, \Sigma(x : B(i)).\, C(i,x))\;(a, b) \equiv (\text{transp}\;(\lambda i.\, B(i))\;a,\; \text{transp}\;(\lambda i.\, C(i, \overline{a}(i)))\;b)$$

where $\overline{a}(i) :\equiv \text{transp}\;(\lambda j.\, B(j \wedge i))\;a$ is the partial transport of $a$.

**Case: $A(i) \equiv \text{Path}\;(C(i))\;(c_0(i))\;(c_1(i))$ (path type).**

Transport in a path type involves composing with the boundary paths. The precise formula uses the $\text{hcomp}$ operation (see below).

**Definition 2.16 (Homogeneous composition --- $\text{hcomp}$).** Given a type $A : \mathcal{U}$, a face formula $\varphi$, a *system of partial paths* $u : (i : \mathbb{I}) \to A[\varphi]$ (a partial element of $A$ varying along $i$), and a base $a : A$ such that $a$ agrees with $u(0)$ on $\varphi$, the composition operation produces:

$$\text{hcomp}^A\;\varphi\;u\;a : A$$

satisfying:
- $\text{hcomp}^A\;\varphi\;u\;a$ agrees with $u(1)$ on the face $\varphi$.
- When $\varphi \equiv 1_\mathbb{F}$, we have $\text{hcomp}^A\;1_\mathbb{F}\;u\;a \equiv u(1)$.

**Definition 2.17 (Heterogeneous composition --- $\text{comp}$).** The general composition operation combines transport and homogeneous composition. Given a line $A : \mathbb{I} \to \mathcal{U}$, a face formula $\varphi$, partial paths $u : (i : \mathbb{I}) \to A(i)[\varphi]$, and a base $a : A(0)[\varphi \mapsto u(0)]$:

$$\text{comp}^A\;\varphi\;u\;a : A(1)[\varphi \mapsto u(1)]$$

The heterogeneous composition can be decomposed as $\text{comp} = \text{hcomp} \circ \text{transp}$, but it is often more convenient to work with $\text{comp}$ directly.

### 2.6 Path Composition via Kan Operations

We can now define path composition using the Kan operations, making it computable.

**Definition 2.18 (Path composition).** Given $p : \text{Path}\;A\;a\;b$ and $q : \text{Path}\;A\;b\;c$, define

$$p \cdot q :\equiv \lambda i.\, \text{hcomp}^A\;(\partial i)\;\left[\begin{array}{ll} (i = 0) & \mapsto a \\ (i = 1) & \mapsto q(j) \end{array}\right]\;(p\;i)$$

where $j$ is a dimension variable parameterizing the system and $\partial i :\equiv (i = 0) \vee (i = 1)$. More precisely, this is:

$$p \cdot q :\equiv \lambda i.\, \text{hcomp}^A\;((i = 0) \vee (i = 1))\;(\lambda j.\, [(i = 0) \mapsto a,\; (i = 1) \mapsto q(j)])\;(p\;i)$$

The idea is that we have a square:

```
      a ---refl--- a
      |            |
  p   |            | q
      |            |
      b ----?----- c
```

The top edge is constant at $a$, the left edge is $p$, the right edge is $q$, and we are asking for the bottom edge $p \cdot q$. The $\text{hcomp}$ operation fills the square.

Check at boundaries: when $i = 0$, the partial element forces the result to be $a$; when $i = 1$, the partial element forces the result to be $q(j)$ at dimension $j$, and at $j = 1$ this gives $c$. So $p \cdot q : \text{Path}\;A\;a\;c$.

**Remark 2.19.** This composition is *definitionally* well-typed: the dimension expressions and boundary conditions are checked by the type system. There are no axioms involved; everything computes.

**Definition 2.20 (Filling).** The *filling* operation produces the interior of the square used in composition. Given the same data as for $\text{hcomp}$, the fill is:

$$\text{hfill}^A\;\varphi\;u\;a : (i : \mathbb{I}) \to A$$

with $\text{hfill}^A\;\varphi\;u\;a\;0 \equiv a$ and $\text{hfill}^A\;\varphi\;u\;a\;1 \equiv \text{hcomp}^A\;\varphi\;u\;a$.

Filling is definable from $\text{hcomp}$:

$$\text{hfill}^A\;\varphi\;u\;a\;i :\equiv \text{hcomp}^A\;(\varphi \vee (i = 0))\;(\lambda j.\, [\varphi \mapsto u(i \wedge j),\; (i = 0) \mapsto a])\;a$$

This produces a path from the base $a$ to the result of composition, which is exactly the "interior" of the square.

**Remark 2.21 (Connection to the Kan condition).** The name "Kan operations" comes from the theory of Kan complexes in simplicial/cubical homotopy theory. A Kan complex is a cubical set (or simplicial set) in which every "open box" (a cube with one face missing) can be filled. The $\text{hcomp}$ operation provides exactly this filling: given the sides of a box (the partial element $u$ on the face $\varphi$) and the bottom (the base $a$), it produces the top (the result of composition). The filling operation produces the interior.

In categorical terms, every type in cubical type theory is a Kan fibration over the point (i.e., a Kan complex), and every type family is a Kan fibration over the base. This is the content of the Kan condition in the cubical set model.

**Definition 2.22 (Path composition, alternative).** There are several equivalent ways to define path composition in cubical type theory, corresponding to different choices of which faces to fill. The one above fills the "lid" of a box. An alternative fills the "bottom":

$$p \cdot' q :\equiv \lambda i.\, \text{hcomp}^A\;((i = 0) \vee (i = 1))\;(\lambda j.\, [(i = 0) \mapsto p(\neg j),\; (i = 1) \mapsto q(j)])\;b$$

Here the base is $b$ (the meeting point of $p$ and $q$), the left face goes backwards along $p$, and the right face goes forward along $q$. This definition is propositionally (but not judgmentally) equal to the previous one.

### 2.7 Glue Types and Computing Univalence

The key technical innovation that makes univalence compute is the *glue type*.

**Definition 2.20 (Glue types).** Let $A : \mathcal{U}$ be a type, $\varphi$ a face formula, and $T : \mathcal{U}[\varphi]$ a partial type (defined on the face $\varphi$), together with a partial equivalence $e : (T \simeq A)[\varphi]$. The *glue type* is

$$\text{Glue}\;A\;\varphi\;T\;e : \mathcal{U}$$

It satisfies:
- On the face $\varphi$: $\text{Glue}\;A\;\varphi\;T\;e \equiv T$.
- Off the face $\varphi$: $\text{Glue}\;A\;\varphi\;T\;e$ behaves like $A$.

There is a canonical map $\text{unglue} : \text{Glue}\;A\;\varphi\;T\;e \to A$ that applies $e$ on the face $\varphi$ and is the identity elsewhere.

The introduction form is $\text{glue}\;\varphi\;(t, a) : \text{Glue}\;A\;\varphi\;T\;e$, where $t : T[\varphi]$ and $a : A$ satisfy $e(t) \equiv a$ on $\varphi$.

**Theorem 2.21 (Univalence computes).** Using glue types, the univalence map $\text{ua} : (A \simeq B) \to \text{Path}\;\mathcal{U}\;A\;B$ is defined as:

$$\text{ua}(e) :\equiv \lambda i.\, \text{Glue}\;B\;(\partial i)\;[(i = 0) \mapsto (A, e),\; (i = 1) \mapsto (B, \text{id}_B)]$$

where $\partial i = (i = 0) \vee (i = 1)$.

Check: at $i = 0$, the glue type reduces to $A$ (the partial type on the face $i = 0$); at $i = 1$, it reduces to $B$. So $\text{ua}(e) : \text{Path}\;\mathcal{U}\;A\;B$.

The computation rule for transport along $\text{ua}(e)$ is:

$$\text{transp}\;(\lambda i.\, \text{ua}(e)(i))\;a \equiv e(a)$$

This reduces *judgmentally*, not merely propositionally. Transport along $\text{ua}(e)$ actually computes to the application of the equivalence $e$.

**Remark 2.25.** This is the central achievement of cubical type theory: the univalence axiom is no longer an axiom but a *theorem* with computational content. When a proof assistant based on cubical type theory encounters $\text{transport}^P(\text{ua}(e), x)$, it reduces the term to a concrete value, enabling further type checking and computation.

**Theorem 2.26 (Full univalence).** In CCHM cubical type theory, the map $\text{idtoeqv} : \text{Path}\;\mathcal{U}\;A\;B \to A \simeq B$ is an equivalence. Moreover, the computation rules are:

1. $\text{ua}(\text{idtoeqv}(p)) = p$ for all $p : \text{Path}\;\mathcal{U}\;A\;B$ (uniqueness principle).
2. $\text{idtoeqv}(\text{ua}(e)) = e$ for all $e : A \simeq B$ (computation principle).
3. $\text{ua}(\text{id}_A) = \text{refl}_A$ (identity path).

*Proof sketch.* The key is the computation rule for $\text{transp}$ through glue types. When we transport through $\text{ua}(e)(i) = \text{Glue}\;B\;(\partial i)\;[\ldots]$, the $\text{transp}$ operation "peels off" the glue, applies the equivalence $e$, and produces the result. The details involve careful manipulation of the glue type reduction rules. See Cohen et al. (2018), Section 6.

For the uniqueness principle, one shows that any path $p : \text{Path}\;\mathcal{U}\;A\;B$ can be "glued" to produce $\text{ua}(\text{idtoeqv}(p))$, and that these two paths are equal by a higher-dimensional filling argument. $\square$

**Remark 2.27 (Transport computation in glue types --- detailed).** The transport reduction for glue types proceeds as follows. Given $\text{transp}\;(\lambda i.\, \text{Glue}\;B\;(\partial i)\;T\;e)\;a$ where $a : \text{Glue}\;B\;(0 = 0 \vee 0 = 1)\;T_0\;e_0$:

1. First, extract the underlying $B$-value: $b :\equiv \text{unglue}\;a : B$.
2. Transport $b$ in $B$ (if $B$ depends on $i$): in the case of $\text{ua}(e)$, $B$ is constant, so $b$ is unchanged.
3. Re-glue the result at the endpoint $i = 1$: the glue at $i = 1$ is $\text{Glue}\;B\;(1 = 0 \vee 1 = 1)\;T_1\;e_1$. Since $1 = 1$ holds, this reduces to $T_1$.
4. The result is $e_1^{-1}(b)$, where $e_1$ is the equivalence at $i = 1$.

For $\text{ua}(e)$ specifically: $T_0 = A$, $e_0 = e$, $T_1 = B$, $e_1 = \text{id}_B$. So:
- $b = \text{unglue}\;a = e(a)$ (since $a : A$ and $\text{unglue}$ applies $e$ on the face $i = 0$).
- Transport in constant $B$: $b$ unchanged.
- Re-glue: $e_1^{-1}(b) = \text{id}_B^{-1}(e(a)) = e(a)$.

Hence $\text{transp}\;(\lambda i.\, \text{ua}(e)(i))\;a \equiv e(a)$. QED.

### 2.8 Higher Inductive Types in Cubical Type Theory

HITs also benefit from the cubical framework. In MLTT-based HoTT, path constructors of HITs have only propositional computation rules (e.g., $\text{apd}_f(\text{loop}) = l$, not $\equiv$). In cubical type theory, the computation rules become judgmental.

**Definition 2.23 (The circle in cubical type theory).** The circle $S^1$ is defined with:

- A point constructor: $\text{base} : S^1$
- A path constructor: $\text{loop} : \text{Path}\;S^1\;\text{base}\;\text{base}$

Concretely, $\text{loop}$ is a function $\mathbb{I} \to S^1$ with $\text{loop}(0) \equiv \text{base}$ and $\text{loop}(1) \equiv \text{base}$.

The elimination principle: to define $f : S^1 \to A$, give $b : A$ and $l : \text{Path}\;A\;b\;b$. Then:

$$f(\text{base}) \equiv b$$

$$f(\text{loop}\;i) \equiv l\;i$$

The second equation holds *judgmentally*, which is a significant improvement over the MLTT formulation.

**Example 2.24 (Torus as a HIT in cubical type theory).** The torus $T^2$ can be defined with:

- A point: $\text{base} : T^2$
- Two loops: $p, q : \text{Path}\;T^2\;\text{base}\;\text{base}$
- A square: $s : \text{PathP}\;(\lambda i.\, \text{Path}\;T^2\;(p\;i)\;(p\;i))\;(\lambda j.\, q\;j)\;(\lambda j.\, q\;j)$

The square $s$ asserts that the square with $p$ on the left and right, and $q$ on the top and bottom, can be filled. This encodes the standard relation $pqp^{-1}q^{-1} = \text{refl}$ in the fundamental group.

**Example 2.25 (Set quotients).** The set quotient $A / R$ is defined as a HIT with:

- $q : A \to A/R$
- $\text{eq} : (a\;b : A) \to R(a,b) \to \text{Path}\;(A/R)\;(q\;a)\;(q\;b)$
- $\text{trunc} : (x\;y : A/R) \to (p\;q : \text{Path}\;(A/R)\;x\;y) \to \text{Path}\;(\text{Path}\;(A/R)\;x\;y)\;p\;q$

In cubical Agda, the truncation constructor is written using the $\text{isSet}$ predicate, and the elimination principle automatically enforces that the target type is a set.

### 2.9 The Cubical Set Model

We now briefly describe the semantic foundation that validates cubical type theory.

**Definition 2.26 (The category of cubes).** The *cube category* $\square$ has:

- **Objects:** finite sets $\{i_1, \ldots, i_n\}$ of dimension names (or equivalently, natural numbers $n \in \mathbb{N}$, representing the $n$-dimensional cube $\mathbb{I}^n$).
- **Morphisms:** In the De Morgan variant, morphisms $\{i_1, \ldots, i_n\} \to \{j_1, \ldots, j_m\}$ are maps that send each $j_k$ to a de Morgan expression over $i_1, \ldots, i_n$ (i.e., an element of the free de Morgan algebra on $\{i_1, \ldots, i_n\}$).

**Definition 2.27 (Cubical sets).** A *cubical set* is a presheaf on the cube category: a contravariant functor $X : \square^{\text{op}} \to \text{Set}$. The set $X(\{i_1, \ldots, i_n\})$ represents the $n$-dimensional cubes of $X$, and the functorial action gives restriction to faces and degeneracies.

**Definition 2.28 (Kan fibrations).** A morphism of cubical sets $f : X \to Y$ is a *Kan fibration* if it has the right lifting property with respect to open box inclusions $\sqcap^n_k \hookrightarrow \mathbb{I}^n$, where $\sqcap^n_k$ is the $n$-cube with one face removed. Kan fibrations are the cubical analogue of Serre fibrations in topology.

Types in cubical type theory are interpreted as Kan fibrations over the context cubical set. The Kan condition ensures that the transport and composition operations exist, which is why they are also called "Kan operations."

**Theorem 2.29 (Soundness of cubical type theory).** The rules of cubical type theory (CCHM) are sound in the cubical set model. In particular:

1. Every type is interpreted as a Kan fibrant cubical set.
2. The path type $\text{Path}\;A\;a\;b$ is interpreted as the set of 1-cubes in $A$ with specified boundary.
3. The transport and composition operations are interpreted by the Kan filling conditions.
4. The glue type is interpreted using an explicit construction on cubical sets.
5. The univalence axiom holds in the model, with computational content.

**Remark 2.30.** The cubical set model is *constructive*: it is built in constructive set theory (CZF) or in an ambient constructive type theory. This means that cubical type theory is consistent with constructive principles and does not require classical logic.

### 2.10 Cubical Agda in Practice

Cubical Agda is the most mature implementation of cubical type theory. We illustrate its use with several examples.

**Example 2.31 (Path type and reflexivity in Cubical Agda).**

```agda
{-# OPTIONS --cubical #-}

open import Cubical.Foundations.Prelude

-- A path from a to a is just the constant function
myRefl : {A : Type} {a : A} -> a ≡ a
myRefl {a = a} = \i -> a

-- Symmetry using interval negation
mySym : {A : Type} {a b : A} -> a ≡ b -> b ≡ a
mySym p = \i -> p (~ i)
```

**Example 2.32 (Function extensionality in Cubical Agda).**

```agda
myFunExt : {A B : Type} {f g : A -> B}
         -> ((x : A) -> f x ≡ g x)
         -> f ≡ g
myFunExt h = \i x -> h x i
```

This is a one-liner: swap the order of arguments. The dimension variable $i$ and the function argument $x$ can be freely interchanged because $\mathbb{I}$ is not a type --- it lives at a different level.

**Example 2.33 (Transport in Cubical Agda).**

```agda
-- Transport a value along a path of types
myTransport : {A B : Type} -> A ≡ B -> A -> B
myTransport p a = transp (\i -> p i) i0 a

-- The transport computation rule for ua
uaCompute : {A B : Type} (e : A ≃ B) (a : A)
          -> transport (ua e) a ≡ equivFun e a
uaCompute e a = transportRefl (equivFun e a)
```

**Example 2.34 (Univalence in Cubical Agda).**

```agda
-- Constructing a path from Bool to Bool via negation
notEquiv : Bool ≃ Bool
notEquiv = isoToEquiv (iso not not notInvolutive notInvolutive)
  where
    notInvolutive : (b : Bool) -> not (not b) ≡ b
    notInvolutive true  = refl
    notInvolutive false = refl

notPath : Bool ≡ Bool
notPath = ua notEquiv

-- Transport along notPath flips booleans
test : transport notPath true ≡ false
test = refl  -- This holds definitionally!
```

The final line is the key: `transport notPath true` reduces to `false` by the computation rules. No axiom is invoked; the term normalizes.

**Example 2.35 (The circle in Cubical Agda).**

```agda
data S1 : Type where
  base : S1
  loop : base ≡ base

-- Double cover of the circle
doubleCover : S1 -> Type
doubleCover base     = Bool
doubleCover (loop i) = ua notEquiv i

-- The loop space of S1 is Z (statement)
-- ΩS1≃Z : (base ≡ base) ≃ Int
-- (proof omitted; see Cubical.HITs.S1.Properties)
```

**Example 2.36 (Constructing isomorphisms to equivalences in Cubical Agda).**

A common pattern in Cubical Agda is converting between isomorphisms and equivalences. The library provides `isoToEquiv`:

```agda
-- An isomorphism between A and B
record Iso (A B : Type) : Type where
  field
    fun : A -> B
    inv : B -> A
    rightInv : (b : B) -> fun (inv b) ≡ b
    leftInv  : (a : A) -> inv (fun a) ≡ a

-- Convert to an equivalence
isoToEquiv : Iso A B -> A ≃ B

-- Convert to a path (via ua)
isoToPath : Iso A B -> A ≡ B
isoToPath i = ua (isoToEquiv i)
```

**Example 2.37 (Heterogeneous paths and dependent pairs in Cubical Agda).**

```agda
-- A dependent path: a path in B that lies over a path in A
-- PathP : (A : I -> Type) -> A i0 -> A i1 -> Type

-- Example: if p : a ≡ a' in A, and we have b : B a and b' : B a',
-- then PathP (\i -> B (p i)) b b' is a path from b to b'
-- "lying over" the path p.

-- This replaces transport-based formulations:
-- In MLTT: transport B p b ≡ b'
-- In cubical: PathP (\i -> B (p i)) b b'

-- They are equivalent:
pathP≡transport : {A : Type} {B : A -> Type} {a a' : A}
  (p : a ≡ a') (b : B a) (b' : B a')
  -> PathP (\i -> B (p i)) b b' ≡ (transport (\i -> B (p i)) b ≡ b')
pathP≡transport p b b' = ... -- provided by the library
```

**Example 2.38 (Proving associativity of path composition in Cubical Agda).**

```agda
-- Associativity: (p . q) . r ≡ p . (q . r)
-- This requires constructing a 3-dimensional cube (a cube filling)
assoc : {A : Type} {a b c d : A}
  (p : a ≡ b) (q : b ≡ c) (r : c ≡ d)
  -> (p ∙ q) ∙ r ≡ p ∙ (q ∙ r)
assoc p q r j i = hcomp (\k -> \{
    (i = i0) -> a ;
    (i = i1) -> r (j ∨ k) ;
    (j = i0) -> (p ∙ q) i -- when j=0, use (p.q).r
    })
  (hcomp (\k -> \{
    (i = i0) -> a ;
    (i = i1) -> q (j ∨ k) -- fill in q at the boundary
    })
  (p i))
```

This example illustrates the cubical proof methodology: to prove an equality between paths, we construct a square (2-cube), and to prove an equality between squares, we construct a cube (3-cube). The `hcomp` calls specify the boundary conditions of each face, and the type checker verifies that all boundaries match.

### 2.11 Connection to Homotopy Theory

Cubical type theory is not just a convenient reformulation of HoTT; it has deep connections to homotopy theory and higher category theory.

**The homotopy hypothesis.** Grothendieck's homotopy hypothesis asserts that $\infty$-groupoids are the same as homotopy types (spaces up to weak homotopy equivalence). Cubical sets provide a model of $\infty$-groupoids, and cubical type theory provides a synthetic language for reasoning about them.

**Comparison with simplicial sets.** The classical model of HoTT uses simplicial sets. Cubical sets have the advantage that they support a constructive model theory (the necessary fillings can be computed, not just asserted to exist). However, there are subtleties: not every cubical set is fibrant, and the relationship between the cubical and simplicial models is the subject of ongoing research.

**Synthetic homotopy theory.** In cubical type theory, homotopy-theoretic constructions (fiber sequences, Mayer--Vietoris sequences, Blakers--Massey connectivity) can be carried out synthetically. The computation rules ensure that these constructions produce concrete results, not just existence statements.

### 2.12 Recovering Classical Constructions

We show how several classical type-theoretic constructions arise naturally in the cubical setting.

**Proposition 2.39 (Contractibility of singletons).** The singleton type $\sum_{(y:A)} \text{Path}\;A\;a\;y$ is contractible. In cubical type theory, the proof is:

$$\text{center} :\equiv (a, \text{refl}_a)$$

$$\text{contraction} :\equiv \lambda (y, p).\, \lambda i.\, (p\;i, \lambda j.\, p(i \wedge j))$$

The contraction uses a connection $i \wedge j$: at $i = 0$, we get $(a, \text{refl}_a) = \text{center}$; at $i = 1$, we get $(y, p)$. The dependent path $\lambda j.\, p(i \wedge j)$ goes from $\text{refl}_a$ (at $i = 0$) to $p$ (at $i = 1$) in the path space.

**Proposition 2.40 (Sigma types preserve equivalences).** If $e : A \simeq B$ and $f : \prod_{(a:A)} C(a) \simeq D(e(a))$, then $\sum_{(a:A)} C(a) \simeq \sum_{(b:B)} D(b)$. In cubical type theory, this follows from transport along $\text{ua}(e)$:

$$\text{ua}(\Sigma\text{-equiv}) : (\sum_{(a:A)} C(a)) =_\mathcal{U} (\sum_{(b:B)} D(b))$$

computed by transport in the type family $X \mapsto \sum_{(x:X)} E(x)$ along $\text{ua}(e)$, where $E$ is appropriately defined using $D$ and $f$.

**Proposition 2.41 (Univalence for propositions).** For propositions $P$ and $Q$ (types with at most one element), $\text{Path}\;\mathcal{U}\;P\;Q \simeq (P \leftrightarrow Q)$. This is because any logical equivalence between propositions is an equivalence, and by univalence, equivalences are paths.

*Proof in cubical type theory.* Given $f : P \to Q$ and $g : Q \to P$, since $P$ and $Q$ are propositions, $f \circ g \sim \text{id}_Q$ and $g \circ f \sim \text{id}_P$ hold automatically (any two elements of a proposition are equal). So $(f, g)$ is an equivalence, and $\text{ua}(f, g) : P =_\mathcal{U} Q$.

### 2.13 Open Problems and Active Research

**Problem 2.36 (Canonicity and normalization).** Huber (2019) proved canonicity for CCHM cubical type theory: every closed term of type $\mathbb{N}$ reduces to a numeral. Full normalization (every term reduces to a normal form) is still open for the full system, though partial results exist.

**Problem 2.37 (Higher inductive types).** The general theory of HITs in cubical type theory is not fully settled. Specific HITs (circle, torus, suspensions, pushouts) are well-understood, but a general schema for HITs with all desired properties (strict computation rules, well-behaved elimination) is an active area of research. The work of Cavallo and Harper (2019) on higher inductive types in Cartesian cubical type theory is a significant step.

**Problem 2.38 (Comparison of cubical models).** There are several variants of cubical type theory (CCHM, Cartesian, with or without connections, with or without reversal), and the relationships between them are not fully understood. Recent work by Awodey (2023) and others aims to unify these approaches.

**Problem 2.39 (Directed type theory).** Cubical type theory treats paths as symmetric (invertible). A natural generalization is *directed type theory*, where paths have a direction and are not necessarily reversible. This would correspond to $(\infty,1)$-categories rather than $\infty$-groupoids. Riehl and Shulman (2017) initiated this program, but a fully satisfactory directed cubical type theory remains elusive.

**Problem 2.40 (Efficiency).** Type checking in cubical type theory is computationally expensive. The Kan operations, especially for glue types, can generate large normal forms. Improving the efficiency of cubical type checkers is a practical concern for proof assistant development. The work of Sterling and Angiuli on "XTT" and other optimized cubical systems addresses this.

**Problem 2.41 (Two-level type theory).** Voevodsky proposed *two-level type theory* (2LTT), which combines a "strict" level (where equality is decidable) with a "homotopy" level (with path types and univalence). This provides a framework for meta-theoretic reasoning about HoTT within HoTT. Implementing 2LTT efficiently and extending it with cubical features is an open problem.

---

## 3. Worked Examples

### Example 3.1: Composing Paths in Cubical Style

Let $p : \text{Path}\;A\;a\;b$ and $q : \text{Path}\;A\;b\;c$. We construct $p \cdot q$ step by step.

The composition is defined as:

$$p \cdot q :\equiv \lambda i.\, \text{hcomp}^A\;(\partial i)\;\left(\lambda j.\, \left[\begin{array}{ll} (i = 0) & \mapsto a \\ (i = 1) & \mapsto q\;j \end{array}\right]\right)\;(p\;i)$$

Verification of boundaries:

- At $i = 0$: the face condition forces the result to be $a$. (The base is $p\;0 = a$, and the system specifies $a$ on $i = 0$.)
- At $i = 1$: the face condition forces the result to agree with $q\;j$ at $j = 1$, which is $q\;1 = c$. (The base is $p\;1 = b = q\;0$, and the system specifies $q\;j$.)

So we get $p \cdot q : \text{Path}\;A\;a\;c$, as desired.

### Example 3.2: Transport in Sigma Types

Let $A : \mathbb{I} \to \mathcal{U}$, $B : (i : \mathbb{I}) \to A(i) \to \mathcal{U}$, and $(a_0, b_0) : \Sigma(x : A(0)).\, B(0, x)$. Transport gives:

$$\text{transp}\;(\lambda i.\, \Sigma(x : A(i)).\, B(i,x))\;(a_0, b_0)$$

This reduces to $(a_1, b_1)$ where:

$$a_1 :\equiv \text{transp}\;(\lambda i.\, A(i))\;a_0$$

$$b_1 :\equiv \text{transp}\;(\lambda i.\, B(i, \text{fill}\;(\lambda j.\, A(j))\;a_0\;i))\;b_0$$

Here $\text{fill}\;(\lambda j.\, A(j))\;a_0 : (i : \mathbb{I}) \to A(i)$ is the *filling* operation, which produces the path that transport traces out: $\text{fill}\;(\lambda j.\, A(j))\;a_0\;0 \equiv a_0$ and $\text{fill}\;(\lambda j.\, A(j))\;a_0\;1 \equiv a_1$.

### Example 3.3: Univalence Computation

Let $e : \mathbb{N} \simeq \mathbb{N}$ be the equivalence defined by $e(n) = n + 1$ (with inverse $e^{-1}(n) = n - 1$, where $0 - 1 = 0$). Then:

$$\text{ua}(e) : \text{Path}\;\mathcal{U}\;\mathbb{N}\;\mathbb{N}$$

And:

$$\text{transp}\;(\lambda i.\, \text{ua}(e)\;i)\;5 \equiv e(5) \equiv 6$$

This computation is performed by the type checker, reducing the transport through the glue type step by step until a numeral is obtained.

### Example 3.4: Function Extensionality for Dependent Functions

Given $f, g : \prod_{(x:A)} B(x)$ and $h : \prod_{(x:A)} \text{Path}\;(B(x))\;(f(x))\;(g(x))$, the dependent function extensionality proof is:

$$\text{funExtDep}(h) :\equiv \lambda i.\, \lambda x.\, h(x)(i) : \text{Path}\;(\prod_{(x:A)} B(x))\;f\;g$$

Check: at $i = 0$, $(\lambda x.\, h(x)(0)) = (\lambda x.\, f(x)) = f$. At $i = 1$, $(\lambda x.\, h(x)(1)) = (\lambda x.\, g(x)) = g$.

The key insight: in cubical type theory, a path in a $\Pi$-type is the same as a dependent function that returns paths. The dimension variable $i$ and the function variable $x$ can be freely reordered.

### Example 3.5: Isomorphism is Not Always an Equivalence (Subtlety)

Consider the type $A :\equiv \sum_{(n:\mathbb{N})} (n = 0)$ and $B :\equiv \mathbf{1}$. There is an obvious isomorphism $f : A \to B$ given by $f(n, p) :\equiv \star$ and $g : B \to A$ given by $g(\star) :\equiv (0, \text{refl})$.

In cubical type theory, converting this isomorphism to an equivalence requires checking that the fibers are contractible. The function $\text{isoToEquiv}$ from the cubical library performs this conversion, but the resulting equivalence may have a non-trivial coherence component (the half-adjoint condition). The library handles this automatically, but it illustrates that "equivalence" is a more structured notion than "isomorphism."

### Example 3.6: A Square in Cubical Type Theory

A square in type $A$ with boundaries $p_\text{top} : a_{00} = a_{01}$, $p_\text{bot} : a_{10} = a_{11}$, $p_\text{left} : a_{00} = a_{10}$, $p_\text{right} : a_{01} = a_{11}$ is a term:

$$s : (i\; j : \mathbb{I}) \to A$$

with:
- $s(i, 0) = p_\text{left}(i)$ and $s(i, 1) = p_\text{right}(i)$
- $s(0, j) = p_\text{top}(j)$ and $s(1, j) = p_\text{bot}(j)$
- Corner conditions: $s(0,0) = a_{00}$, $s(0,1) = a_{01}$, $s(1,0) = a_{10}$, $s(1,1) = a_{11}$.

In Cubical Agda notation, this is a term of type:

```agda
Square : {A : Type} {a00 a01 a10 a11 : A}
  -> a00 ≡ a01 -> a10 ≡ a11 -> a00 ≡ a10 -> a01 ≡ a11
  -> Type
Square p-top p-bot p-left p-right =
  PathP (\i -> p-left i ≡ p-right i) p-top p-bot
```

Squares are 2-dimensional paths --- they are the cubical analogue of homotopies between paths. Constructing squares is a key technique in cubical type theory proofs.

---

## 4. Exercises

**Exercise 10b.1.** In cubical type theory, prove that $\text{refl} \cdot p = p$ for any $p : \text{Path}\;A\;a\;b$, by writing out the $\text{hcomp}$ explicitly and checking that it reduces correctly.

**Exercise 10b.2.** Define the $\text{ap}$ (action on paths) operation in cubical type theory: given $f : A \to B$ and $p : \text{Path}\;A\;a\;b$, construct $\text{ap}_f(p) : \text{Path}\;B\;(f\;a)\;(f\;b)$. (Hint: it is even simpler than in MLTT.)

**Exercise 10b.3.** Show that in cubical type theory, $(p^{-1})^{-1} \equiv p$ holds *judgmentally* (using the De Morgan negation). Compare this with the MLTT situation where this is only a propositional equality.

**Exercise 10b.4.** Define the suspesion $\Sigma A$ as a HIT in cubical type theory and write out its elimination principle. Construct a function $\Sigma \mathbf{2} \to S^1$ and show it is an equivalence (or state precisely what is needed for the proof).

**Exercise 10b.5.** In Cubical Agda (or on paper using cubical notation), prove that $\text{Bool} \simeq \text{Bool}$ has exactly two elements (the identity and negation equivalences), using the encode-decode method.

**Exercise 10b.6.** Explain why function extensionality does not require any Kan operations in cubical type theory (unlike composition and transport). What structural feature of cubical type theory makes this possible?

**Exercise 10b.7.** Write out the full reduction of $\text{transp}\;(\lambda i.\, \text{ua}(\text{succ}_\mathbb{Z})(i))\;3$ step by step, where $\text{succ}_\mathbb{Z} : \mathbb{Z} \simeq \mathbb{Z}$ is the successor equivalence. At each step, indicate which reduction rule applies (glue reduction, function type transport, constant transport, etc.).

**Exercise 10b.8.** In Cubical Agda (or on paper), construct a proof that $\text{Path}\;(\text{Path}\;\text{Bool}\;\text{true}\;\text{true})\;\text{refl}\;\text{refl}$ is contractible. This shows that $\text{Bool}$ has trivial higher homotopy at its identity proofs (it is a set).

**Exercise 10b.9 (Challenging).** State and prove the "3x3 lemma" for pushouts: given a 3x3 grid of types and maps, the iterated pushout along rows followed by columns is equivalent to the iterated pushout along columns followed by rows. Work in cubical notation, specifying all boundary conditions.

**Exercise 10b.10 (Open-ended).** Compare the cubical proof of $\pi_1(S^1) \cong \mathbb{Z}$ (available in the Cubical Agda library at `Cubical.HITs.S1.Properties`) with the MLTT-based proof sketched in Lecture 10a. Which steps are simpler in cubical type theory? Which steps require essentially the same work? What role do judgmental computation rules play?

---

## Summary

- Cubical type theory replaces the identity type and J eliminator with path types defined as functions from an abstract interval $\mathbb{I}$, together with Kan operations (transport and composition) that give these paths computational content.
- The interval $\mathbb{I}$ carries a de Morgan algebra structure (in the CCHM variant) that enables direct definitions of path reversal and other operations.
- Function extensionality is a theorem in cubical type theory, following from the ability to swap dimension variables and ordinary variables.
- Glue types are the key technical device that makes univalence compute: $\text{transport}(\text{ua}(e), a)$ reduces judgmentally to $e(a)$.
- Higher inductive types in cubical type theory have judgmental computation rules for both point and path constructors.
- The cubical set model provides a constructive semantics validating all the rules of cubical type theory.
- Cubical Agda is the leading implementation, enabling practical formalization of HoTT with full computational content.
- Open problems include full normalization, a general theory of HITs, directed type theory, and efficiency of cubical type checking.

---

## Further Reading

1. **Cohen, C., Coquand, T., Huber, S., and M\"ortberg, A.** "Cubical Type Theory: A Constructive Interpretation of the Univalence Axiom." *TYPES*, 2015. Journal version in *JFLA*, 2018. The foundational paper for CCHM cubical type theory.

2. **Vezzosi, A., M\"ortberg, A., and Abel, A.** "Cubical Agda: A Dependently Typed Programming Language with Univalence and Higher Inductive Types." *ICFP*, 2019. The paper describing the Cubical Agda implementation.

3. **Angiuli, C., Brunerie, G., Coquand, T., Favonia, K.-B., Harper, R., and Licata, D.R.** "Syntax and Models of Cartesian Cubical Type Theory." *Mathematical Structures in Computer Science* 31(4), 2021.

4. **Huber, S.** "Canonicity for Cubical Type Theory." *Journal of Automated Reasoning* 63, 2019.

5. **Coquand, T.** "Cubical type theory." Lecture notes, 2018. Available online. A concise introduction to the CCHM system.

6. **Riehl, E. and Shulman, M.** "A type theory for synthetic $\infty$-categories." *Higher Structures* 1(1), 2017. The foundational paper on directed type theory.

7. **Cavallo, E. and Harper, R.** "Higher Inductive Types in Cubical Computational Type Theory." *POPL*, 2019.

8. **Bezem, M., Coquand, T., and Huber, S.** "A Model of Type Theory in Cubical Sets." *TYPES*, 2013. The original cubical set model (using a different cube category than CCHM).

9. **Sterling, J. and Angiuli, C.** "Normalization for Cubical Type Theory." *LICS*, 2021.

10. **The 1Lab.** [1lab.dev](https://1lab.dev). A formalized, literate library of mathematics in Cubical Agda, with extensive documentation. An excellent resource for seeing cubical type theory in practice.
