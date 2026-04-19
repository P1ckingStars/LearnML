---
title: "Lecture 10a: Identity Types and the Univalence Axiom"
tags:
  - type-theory
  - frontiers
  - lecture
---
# Lecture 10a: Identity Types and the Univalence Axiom

> **Module 10 --- Frontiers (Weeks 19--20)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define identity types $\text{Id}_A(a,b)$ in Martin-L\"of type theory and state the formation, introduction, and elimination rules precisely.
2. Apply path induction (the J eliminator) to prove basic properties of identity, including symmetry, transitivity, and congruence.
3. Formulate transport as a derived operation and explain its role as a coercion between fibers of a type family.
4. Describe the groupoid structure of types, including composition, inversion, and the coherence laws they satisfy up to higher paths.
5. State the principle of function extensionality and explain why it is independent of the basic rules of intensional type theory.
6. State the univalence axiom, explain the canonical map $\text{idtoeqv}$, and articulate the sense in which univalence asserts that equivalence of types is identity of types.
7. Define higher inductive types (HITs), construct the circle $S^1$ and quotient types as examples, and use their elimination principles.
8. Classify types by truncation level (contractible types, propositions, sets, groupoids) and explain the n-type hierarchy.

---

## 1. Motivation

In the previous modules, we developed dependent type theory with $\Pi$-types, $\Sigma$-types, and inductive families. We have seen that types can serve simultaneously as propositions, sets, and spaces. In this lecture, we confront a fundamental question that has shaped the last two decades of type theory research: **what does it mean for two elements of a type to be equal?**

In classical mathematics, equality is a simple binary relation: two things either are or are not the same. In type theory, the situation is far richer. The identity type $\text{Id}_A(a,b)$ is itself a type, and it may have interesting internal structure. An element $p : \text{Id}_A(a,b)$ is a *witness* or *proof* of the identity of $a$ and $b$ --- but there may be multiple, genuinely distinct such witnesses. This observation, taken seriously, leads to a revolution: types are not merely sets but *spaces*, identity proofs are *paths*, and paths between paths are *homotopies*. This is the conceptual foundation of **Homotopy Type Theory** (HoTT).

### 1.1 Historical Context

The identity type was introduced by Martin-L\"of in the 1970s as part of his intuitionistic type theory. For decades, the prevailing view was that identity types should be "boring" --- that any two proofs of $a =_A b$ should themselves be equal (a principle called *uniqueness of identity proofs*, or UIP). This was validated by the standard set-theoretic models, where identity proofs carry no interesting structure.

The revolution began in the mid-2000s with three independent observations:

1. **Hofmann and Streicher (1998)** constructed the *groupoid model*, showing that UIP is not provable in MLTT. In this model, types are interpreted as groupoids (categories where every morphism is invertible), and identity proofs correspond to morphisms. Two distinct morphisms between the same objects provide two distinct identity proofs.

2. **Awodey and Warren (2009)** and independently **Voevodsky** observed that the identity types of MLTT satisfy the axioms of an $\infty$-groupoid, suggesting that types should be interpreted as spaces in the sense of homotopy theory.

3. **Voevodsky (2006)** formulated the **univalence axiom** and constructed the simplicial set model of type theory, providing the first model where univalence holds.

These developments culminated in the *Univalent Foundations Program* and the HoTT Book (2013), which laid out a comprehensive foundation for mathematics based on homotopy type theory.

### 1.2 The Big Picture

The central result of this lecture is the **univalence axiom**, introduced by Vladimir Voevodsky. In classical set-theoretic foundations, isomorphic structures are not literally equal --- one must constantly distinguish between "the same up to isomorphism" and "literally identical." Univalence dissolves this distinction: in a universe $\mathcal{U}$, two types $A, B : \mathcal{U}$ are equal precisely when they are equivalent. This is not merely a philosophical convenience; it has profound proof-theoretic consequences, enabling new principles of abstraction and modularity in formalized mathematics.

We also introduce **higher inductive types** (HITs), which extend ordinary inductive types by allowing constructors that produce not only points but also paths (and higher paths). HITs provide a way to define quotient types, spheres, and other topological spaces directly within type theory, without recourse to set-theoretic constructions.

### 1.3 The Homotopical Interpretation

The key conceptual shift is the *homotopical interpretation* of type theory:

| Type theory | Homotopy theory |
|-------------|----------------|
| Type $A$ | Space |
| Element $a : A$ | Point of the space |
| $p : a =_A b$ | Path from $a$ to $b$ |
| $\alpha : p =_{a=b} q$ | Homotopy between paths |
| Higher identity | Higher homotopy |
| $\Pi$-type $\prod_{(x:A)} B(x)$ | Space of sections of a fibration |
| $\Sigma$-type $\sum_{(x:A)} B(x)$ | Total space of a fibration |
| Inductive type | CW complex |
| Identity type | Path space |

This interpretation is not merely an analogy: it is made precise by the simplicial set model (Voevodsky) and the cubical set model (Cohen, Coquand, Huber, M\"ortberg), where the rules of type theory are *sound* with respect to homotopy-theoretic semantics.

---

## 2. Core Theory

### 2.1 Identity Types: Formation, Introduction, and Elimination

We work in Martin-L\"of's intensional type theory (MLTT). The identity type is the central piece of structure that distinguishes MLTT from simpler type theories.

**Definition 2.1 (Identity type --- formation).** For any type $A : \mathcal{U}$ and elements $a, b : A$, there is a type

$$\text{Id}_A(a, b) : \mathcal{U}$$

We write $a =_A b$ as a synonym for $\text{Id}_A(a,b)$, dropping the subscript $A$ when it can be inferred. Elements of $a =_A b$ are called *identity proofs*, *identifications*, or (in homotopical language) *paths from $a$ to $b$*.

As an inference rule:

$$\frac{\Gamma \vdash A : \mathcal{U}_i \quad \Gamma \vdash a : A \quad \Gamma \vdash b : A}{\Gamma \vdash \text{Id}_A(a,b) : \mathcal{U}_i} \quad (\text{Id-Form})$$

**Definition 2.2 (Reflexivity --- introduction).** For any $a : A$, there is a canonical element

$$\text{refl}_a : a =_A a$$

witnessing that every element is equal to itself. This is the sole constructor of the identity type.

$$\frac{\Gamma \vdash a : A}{\Gamma \vdash \text{refl}_a : \text{Id}_A(a,a)} \quad (\text{Id-Intro})$$

**Remark.** The identity type has only one constructor, unlike, say, the natural numbers which have two ($\text{zero}$ and $\text{succ}$). The richness of the identity type arises entirely from its elimination principle. Compare with the unit type $\mathbf{1}$, which also has one constructor ($\star : \mathbf{1}$) and whose elimination principle says that every element of $\mathbf{1}$ is $\star$. The identity type's elimination principle is analogous but operates over a richer domain.

**Definition 2.3 (Path induction --- the J eliminator).** Let $A : \mathcal{U}$ and let

$$C : \prod_{(a,b:A)} (a =_A b) \to \mathcal{U}$$

be a type family indexed by $a$, $b$, and a path $p : a =_A b$. Suppose we have

$$c : \prod_{(a:A)} C(a, a, \text{refl}_a)$$

Then there is a function

$$J(C, c) : \prod_{(a,b:A)} \prod_{(p : a =_A b)} C(a, b, p)$$

satisfying the computation rule

$$J(C, c, a, a, \text{refl}_a) \equiv c(a)$$

where $\equiv$ denotes judgmental (definitional) equality.

As an inference rule:

$$\frac{\Gamma, a : A, b : A, p : \text{Id}_A(a,b) \vdash C(a,b,p) : \mathcal{U}_i \quad \Gamma, a : A \vdash c(a) : C(a,a,\text{refl}_a)}{\Gamma, a : A, b : A, p : \text{Id}_A(a,b) \vdash J(C, c, a, b, p) : C(a, b, p)} \quad (\text{J-Elim})$$

$$\frac{}{\Gamma, a : A \vdash J(C, c, a, a, \text{refl}_a) \equiv c(a) : C(a, a, \text{refl}_a)} \quad (\text{J-Comp})$$

The J rule is the induction principle for the identity type. Its power comes from the fact that to prove a property of *all* paths $p : a =_A b$, it suffices to prove the property when $b$ is $a$ and $p$ is $\text{refl}_a$. In homotopical terms, we can "contract the path to a point."

**Remark 2.4 (Why J is valid).** The J eliminator can seem mysterious at first. Why should it be valid to assume that every path is $\text{refl}$? The answer is that J does *not* say every path is $\text{refl}$; it says that for any property $C$ of paths, if $C$ holds for $\text{refl}$, then $C$ holds for all paths. This is analogous to natural number induction: the induction principle does not say every natural number is zero; it says that properties true of zero and closed under successor hold for all natural numbers.

The key is that the motive $C$ depends on *both endpoints* of the path, not just the path itself. When we specialize to $b \equiv a$ and $p \equiv \text{refl}_a$, we are simultaneously specializing the entire triple $(a, b, p)$ to $(a, a, \text{refl}_a)$. This is what makes the principle non-trivial.

**Definition 2.5 (Based path induction).** There is a useful variant of J, often called *based path induction*, that fixes one endpoint:

Given $a : A$ and a type family $C : \prod_{(b:A)} (a =_A b) \to \mathcal{U}$, if we have $c : C(a, \text{refl}_a)$, then

$$J'(C, c) : \prod_{(b:A)} \prod_{(p : a =_A b)} C(b, p)$$

with $J'(C, c, a, \text{refl}_a) \equiv c$.

**Proposition 2.6.** Based path induction and (free) path induction are interderivable.

*Proof.* ($J' \Rightarrow J$): Given $C : \prod_{(a,b:A)} (a =_A b) \to \mathcal{U}$ and $c : \prod_{(a:A)} C(a,a,\text{refl}_a)$, fix $a : A$ and define $C'(b, p) :\equiv C(a, b, p)$. Apply $J'$ with $C'$ and $c(a)$ to get $\prod_{(b:A)} \prod_{(p : a =_A b)} C(a, b, p)$. Since $a$ was arbitrary, we can abstract over $a$.

($J \Rightarrow J'$): Given $a : A$, $C : \prod_{(b:A)} (a =_A b) \to \mathcal{U}$, and $c : C(a, \text{refl}_a)$, define $C'(a', b, p) :\equiv \prod_{(q : a =_A a')} C(b, q \cdot p)$. We need $c' : \prod_{(a':A)} C'(a', a', \text{refl}_{a'})$, i.e., $c'(a') : \prod_{(q : a =_A a')} C(a', q \cdot \text{refl}_{a'})$. This requires a further application of transport (to deal with $q \cdot \text{refl}$), making this direction more involved. A cleaner proof uses the contractibility of the singleton type $\sum_{(b:A)} a =_A b$, which we establish below. $\square$

Based path induction is often more convenient in practice because it reduces the number of variables that need to be generalized.

### 2.2 Basic Properties of Identity

We now derive the fundamental properties of identity using the J eliminator. Each construction is carried out in complete detail to illustrate the methodology.

**Proposition 2.7 (Symmetry / path inversion).** For any $p : a =_A b$, there exists $p^{-1} : b =_A a$.

*Proof.* We use based path induction with base point $a$. Define $C(b, p) :\equiv (b =_A a)$. We need $c : C(a, \text{refl}_a)$, i.e., $c : a =_A a$. Take $c :\equiv \text{refl}_a$. Then $J'(C, c, b, p) : b =_A a$. We write this as $p^{-1}$.

Verification of the computation rule: $(\text{refl}_a)^{-1} \equiv J'(C, c, a, \text{refl}_a) \equiv c \equiv \text{refl}_a$. So the inverse of $\text{refl}$ is $\text{refl}$, as expected. $\square$

**Proposition 2.8 (Transitivity / path composition).** For any $p : a =_A b$ and $q : b =_A c$, there exists $p \cdot q : a =_A c$.

*Proof.* We use based path induction on $p$ (with base point $a$). Define $C(b, p) :\equiv \prod_{(c:A)} (b =_A c) \to (a =_A c)$. We need $c : C(a, \text{refl}_a)$, i.e., $c : \prod_{(c:A)} (a =_A c) \to (a =_A c)$. Take $c(c', q) :\equiv q$. Then $J'(C, c, b, p) : \prod_{(c:A)} (b =_A c) \to (a =_A c)$, and we define $p \cdot q :\equiv J'(C, c, b, p)(c, q)$.

Verification: $\text{refl}_a \cdot q \equiv J'(C, c, a, \text{refl}_a)(c, q) \equiv c(c, q) \equiv q$. So composing $\text{refl}$ on the left is the identity, which makes sense: the trivial path followed by $q$ is just $q$. $\square$

**Remark 2.9.** There are multiple equivalent definitions of path composition, depending on which path we induct on:

- Inducting on $p$: $\text{refl}_a \cdot q \equiv q$ (left unit holds judgmentally).
- Inducting on $q$: $p \cdot \text{refl}_b \equiv p$ (right unit holds judgmentally).
- Inducting on both: $\text{refl}_a \cdot \text{refl}_a \equiv \text{refl}_a$ (both units hold only at $\text{refl}$).

The choice matters for the computation rules but not for the propositional equalities. We adopt the first convention (induction on $p$) throughout.

**Proposition 2.10 (Congruence / action on paths).** For any function $f : A \to B$ and path $p : a =_A a'$, there exists $\text{ap}_f(p) : f(a) =_B f(a')$.

*Proof.* Define $C(a, a', p) :\equiv f(a) =_B f(a')$. We need $c(a) : f(a) =_B f(a)$, which is $\text{refl}_{f(a)}$. Apply J to get $\text{ap}_f(p) :\equiv J(C, c, a, a', p) : f(a) =_B f(a')$.

Verification: $\text{ap}_f(\text{refl}_a) \equiv \text{refl}_{f(a)}$. $\square$

**Proposition 2.11 (Action on paths respects composition).** For $f : A \to B$, $p : a =_A b$, and $q : b =_A c$:

$$\text{ap}_f(p \cdot q) = \text{ap}_f(p) \cdot \text{ap}_f(q)$$

*Proof.* By path induction on $p$. When $p \equiv \text{refl}_a$, we need:

$$\text{ap}_f(\text{refl}_a \cdot q) = \text{ap}_f(\text{refl}_a) \cdot \text{ap}_f(q)$$

The left side is $\text{ap}_f(q)$ (since $\text{refl} \cdot q \equiv q$). The right side is $\text{refl}_{f(a)} \cdot \text{ap}_f(q) = \text{ap}_f(q)$ (by the propositional left unit law). So both sides are propositionally equal. $\square$

**Proposition 2.12 (Action on paths respects identity and composition of functions).**

1. $\text{ap}_{\text{id}_A}(p) = p$ for any $p : a =_A b$.
2. $\text{ap}_{g \circ f}(p) = \text{ap}_g(\text{ap}_f(p))$ for $f : A \to B$, $g : B \to C$, and $p : a =_A a'$.
3. $\text{ap}_f(p^{-1}) = (\text{ap}_f(p))^{-1}$.

*Proof.* Each follows by path induction on $p$, reducing to reflexivity. For (1): $\text{ap}_{\text{id}}(\text{refl}_a) \equiv \text{refl}_a \equiv \text{refl}_a$. For (2): $\text{ap}_{g \circ f}(\text{refl}_a) \equiv \text{refl}_{g(f(a))} \equiv \text{ap}_g(\text{refl}_{f(a)}) \equiv \text{ap}_g(\text{ap}_f(\text{refl}_a))$. For (3): $\text{ap}_f(\text{refl}_a^{-1}) \equiv \text{ap}_f(\text{refl}_a) \equiv \text{refl}_{f(a)} \equiv (\text{refl}_{f(a)})^{-1} \equiv (\text{ap}_f(\text{refl}_a))^{-1}$. $\square$

**Proposition 2.13 (Dependent congruence).** For a dependent function $f : \prod_{(a:A)} B(a)$ and $p : a =_A a'$, there exists

$$\text{apd}_f(p) : \text{transport}^B(p, f(a)) =_{B(a')} f(a')$$

where $\text{transport}$ is defined in the next section.

*Proof.* By path induction on $p$. When $p \equiv \text{refl}_a$, we need $\text{transport}^B(\text{refl}_a, f(a)) =_{B(a)} f(a)$. Since $\text{transport}^B(\text{refl}_a, f(a)) \equiv f(a)$, this is $\text{refl}_{f(a)}$. $\square$

### 2.3 Transport

Transport is one of the most important operations in HoTT. It arises from the observation that a path $p : a =_A b$ in the base type should induce a map between the fibers of any type family over $A$.

**Definition 2.14 (Transport).** Let $P : A \to \mathcal{U}$ be a type family and $p : a =_A b$ a path. Then there is a function

$$\text{transport}^P(p, -) : P(a) \to P(b)$$

defined by path induction: $\text{transport}^P(\text{refl}_a, u) :\equiv u$ for $u : P(a)$.

*Construction via J.* Define $C(a, b, p) :\equiv P(a) \to P(b)$. We need $c(a) : P(a) \to P(a)$. Take $c(a) :\equiv \text{id}_{P(a)}$. Then $\text{transport}^P(p, -) :\equiv J(C, c, a, b, p)$.

**Notation.** We write $p_*(u)$ for $\text{transport}^P(p, u)$ when $P$ is clear from context. We also write $p_! : P(a) \to P(b)$ for the transport function itself.

**Remark 2.15 (Transport as a derived concept).** Transport is not a primitive of the type theory; it is derived from J. However, it is so ubiquitous that it deserves special notation and dedicated lemmas. In cubical type theory (Lecture 10b), transport becomes a primitive operation with its own computation rules, which is one of the advantages of the cubical approach.

**Lemma 2.16 (Transport properties).**

1. $\text{refl}_*(u) \equiv u$ (judgmental).
2. $(p \cdot q)_*(u) = q_*(p_*(u))$ (propositional).
3. $p^{-1}_*(p_*(u)) = u$ (propositional).
4. $p_*(p^{-1}_*(v)) = v$ for $v : P(b)$ (propositional).

*Proof.* (1) holds by the computation rule of J.

(2) By path induction on $p$. When $p \equiv \text{refl}_a$, the goal is $(\text{refl}_a \cdot q)_*(u) = q_*(\text{refl}_{a*}(u))$. The left side is $q_*(u)$ (since $\text{refl} \cdot q \equiv q$ and $\text{refl}_*(u) \equiv u$). The right side is $q_*(u)$. So the witness is $\text{refl}_{q_*(u)}$.

(3) By path induction on $p$. When $p \equiv \text{refl}_a$, the goal is $\text{refl}_a^{-1}{}_*(\text{refl}_{a*}(u)) = u$. Since $\text{refl}^{-1} \equiv \text{refl}$ and $\text{refl}_*(u) \equiv u$, this reduces to $u = u$, witnessed by $\text{refl}_u$.

(4) Similar to (3). $\square$

**Lemma 2.17 (Transport is an equivalence).** For any $p : a =_A b$, the transport map $p_! : P(a) \to P(b)$ is an equivalence, with inverse $(p^{-1})_! : P(b) \to P(a)$.

*Proof.* We need to show that $(p^{-1})_! \circ p_! \sim \text{id}_{P(a)}$ and $p_! \circ (p^{-1})_! \sim \text{id}_{P(b)}$. The first follows from Lemma 2.16(3): for any $u : P(a)$, $(p^{-1})_*(p_*(u)) = u$. The second follows from Lemma 2.16(4). $\square$

**Example 2.18 (Transport in specific type families).** We compute transport in several common type families. Let $p : a =_A b$.

1. **Constant family**: If $P(x) :\equiv B$ for all $x$, then $\text{transport}^P(p, u) = u$. Transport in a constant family is the identity.

2. **Identity family**: If $P(x) :\equiv (a =_A x)$ for a fixed $a$, then $\text{transport}^P(p, q) = q \cdot p$ for $q : a =_A a'$ and $p : a' =_A b$. Transport in the identity type family is path composition.

3. **Function family**: If $P(x) :\equiv B(x) \to C(x)$, then $\text{transport}^P(p, f) = \lambda b.\, \text{transport}^C(p, f(\text{transport}^B(p^{-1}, b)))$. Transport in a function family composes with transport in the domain (contravariantly) and codomain (covariantly).

4. **Pair family**: If $P(x) :\equiv B(x) \times C(x)$, then $\text{transport}^P(p, (b,c)) = (\text{transport}^B(p, b), \text{transport}^C(p, c))$. Transport in a product distributes over the components.

5. **Vector family**: If $P(n) :\equiv \text{Vec}(A, n)$, then $\text{transport}^P(p, v)$ coerces a vector of length $n$ into a vector of length $m$ along $p : n =_\mathbb{N} m$.

*Proof of (2).* By path induction on $p$. When $p \equiv \text{refl}_{a'}$, the goal is $\text{transport}^{(x \mapsto a =_A x)}(\text{refl}_{a'}, q) = q \cdot \text{refl}_{a'}$. The left side is $q$ (by computation). The right side is propositionally equal to $q$ (by the right unit law). $\square$

**Definition 2.19 (Path-over).** Given a type family $P : A \to \mathcal{U}$, a path $p : a =_A b$, and elements $u : P(a)$ and $v : P(b)$, a *path over $p$* from $u$ to $v$ is a term of type

$$u =^P_p v :\equiv \text{transport}^P(p, u) =_{P(b)} v$$

Path-overs are the fundamental notion of "dependent equality" in HoTT. They generalize ordinary paths: when $P$ is constant, a path-over is just an ordinary path.

### 2.4 The Groupoid Structure of Types

The operations of symmetry, transitivity, and reflexivity on paths, together with their coherence laws, endow each type with the structure of an $\infty$-groupoid. We now make this precise at the first level.

**Theorem 2.20 (1-groupoid laws).** For all $p : a =_A b$, $q : b =_A c$, $r : c =_A d$:

1. **Left unit**: $\text{refl}_a \cdot p = p$
2. **Right unit**: $p \cdot \text{refl}_b = p$
3. **Associativity**: $(p \cdot q) \cdot r = p \cdot (q \cdot r)$
4. **Left inverse**: $p^{-1} \cdot p = \text{refl}_b$
5. **Right inverse**: $p \cdot p^{-1} = \text{refl}_a$
6. **Involution**: $(p^{-1})^{-1} = p$

Each of these equalities is itself a path in the appropriate identity type; i.e., each is a 2-path (a path between paths).

*Proof of (1).* By our convention (induction on the first path in the definition of composition), we have $\text{refl}_a \cdot p \equiv p$ judgmentally. So the witness is $\text{refl}_p : (\text{refl}_a \cdot p) = p$. $\square$

*Proof of (2).* By path induction on $p$. When $p \equiv \text{refl}_a$, we need $\text{refl}_a \cdot \text{refl}_a = \text{refl}_a$. By the computation rule, $\text{refl}_a \cdot \text{refl}_a \equiv \text{refl}_a$, so the witness is $\text{refl}_{\text{refl}_a}$. $\square$

*Proof of (3).* By path induction on $p$. When $p \equiv \text{refl}_a$, the goal reduces to $(\text{refl}_a \cdot q) \cdot r = \text{refl}_a \cdot (q \cdot r)$, which by computation rules reduces to $q \cdot r = q \cdot r$, witnessed by $\text{refl}_{q \cdot r}$. $\square$

*Proof of (4).* By path induction on $p$. When $p \equiv \text{refl}_a$, we need $\text{refl}_a^{-1} \cdot \text{refl}_a = \text{refl}_a$. Since $\text{refl}_a^{-1} \equiv \text{refl}_a$, this is $\text{refl}_a \cdot \text{refl}_a = \text{refl}_a$, which holds by computation. $\square$

*Proof of (5).* By path induction on $p$. When $p \equiv \text{refl}_a$, we need $\text{refl}_a \cdot \text{refl}_a^{-1} = \text{refl}_a$. This is $\text{refl}_a \cdot \text{refl}_a = \text{refl}_a$, which holds by computation. $\square$

*Proof of (6).* By path induction on $p$. When $p \equiv \text{refl}_a$, we need $(\text{refl}_a^{-1})^{-1} = \text{refl}_a$. Since $\text{refl}_a^{-1} \equiv \text{refl}_a$, this is $\text{refl}_a^{-1} = \text{refl}_a$, which is $\text{refl}_a = \text{refl}_a$, witnessed by $\text{refl}_{\text{refl}_a}$. $\square$

**Remark 2.21.** Note the pattern: every 1-groupoid law is proved by path induction on $p$, reducing to a trivial statement about $\text{refl}$. This is the standard methodology for working with identity types.

**Remark 2.22 (Higher coherences).** These laws hold *up to higher paths*, not judgmentally. The associativity path $(p \cdot q) \cdot r = p \cdot (q \cdot r)$ is itself a piece of data, and we can ask whether the various associativity paths for a four-fold composition are coherent. Specifically, for $p, q, r, s$, there are two ways to reassociate $((p \cdot q) \cdot r) \cdot s$ to $p \cdot (q \cdot (r \cdot s))$, and the question is whether these two 2-paths are equal (connected by a 3-path). They are, but the coherence is witnessed by yet higher paths. This infinite tower of coherence data is precisely the structure of an $\infty$-groupoid, also known as a *Kan complex* in the language of homotopy theory.

The precise statement is: the type-theoretic operations on paths satisfy the axioms of a *weak $\infty$-groupoid* (Lumsdaine, 2010; van den Berg and Garner, 2011). "Weak" means that the laws hold up to coherent homotopies rather than on the nose.

**Definition 2.23 (Whiskering).** Given $p : a =_A b$, $q : b =_A c$, and a 2-path $\alpha : q = q'$ (i.e., $\alpha : q =_{b =_A c} q'$), we define:

- **Right whiskering**: $p \cdot_r \alpha : p \cdot q = p \cdot q'$, defined by $\text{ap}_{(p \cdot -)}(\alpha)$.
- **Left whiskering**: $\alpha \cdot_l r : q \cdot r = q' \cdot r$, defined by $\text{ap}_{(- \cdot r)}(\alpha)$.

**Definition 2.24 (Horizontal composition).** Given $\alpha : p = p'$ (where $p, p' : a =_A b$) and $\beta : q = q'$ (where $q, q' : b =_A c$), the *horizontal composition* is

$$\alpha \star \beta : p \cdot q = p' \cdot q'$$

defined as $\alpha \star \beta :\equiv (p \cdot_r \beta) \cdot (\alpha \cdot_l q')$ or equivalently $(\alpha \cdot_l q) \cdot (p' \cdot_r \beta)$. These two definitions are propositionally equal (by path induction).

**Definition 2.25 (Loop space).** For $a : A$, the *loop space* of $A$ at $a$ is

$$\Omega(A, a) :\equiv (a =_A a)$$

The *iterated loop space* is $\Omega^{n+1}(A,a) :\equiv \Omega(\Omega^n(A,a), \text{refl}^n_a)$, where $\text{refl}^0_a :\equiv a$ and $\text{refl}^{n+1}_a :\equiv \text{refl}_{\text{refl}^n_a}$.

The loop space $\Omega(A,a)$ is a group-like structure: it has composition (path concatenation), an identity element ($\text{refl}_a$), and inverses (path inversion), satisfying the group laws up to higher paths.

**Theorem 2.26 (Eckmann--Hilton).** For any $\alpha, \beta : \Omega^2(A,a)$, we have $\alpha \cdot \beta = \beta \cdot \alpha$. That is, the second loop space is abelian.

*Proof.* We work in $\Omega^2(A,a)$, where elements are 2-paths $\alpha : \text{refl}_a =_{a =_A a} \text{refl}_a$.

Step 1: Define *vertical composition* $\alpha \cdot_v \beta :\equiv \alpha \cdot \beta$ (ordinary path composition in $\Omega(A,a)$).

Step 2: Define *horizontal composition* $\alpha \star_h \beta$ using whiskering and composition, as in Definition 2.24. The key property is that $\alpha \star_h \beta$ is obtained by "placing $\alpha$ to the left of $\beta$."

Step 3: Show that both operations have $\text{refl}_{\text{refl}_a}$ as a two-sided unit. For vertical composition, this is the unit laws of path composition. For horizontal composition, this follows from the fact that whiskering by $\text{refl}$ is (propositionally) the identity.

Step 4: Prove the interchange law: $(\alpha \star_h \beta) \cdot_v (\gamma \star_h \delta) = (\alpha \cdot_v \gamma) \star_h (\beta \cdot_v \delta)$. This is proved by path induction on the constituent 2-paths.

Step 5: Apply the Eckmann--Hilton argument. Given two binary operations on a set, both with the same unit and satisfying the interchange law, the operations coincide and are commutative. Proof: $\alpha \cdot_v \beta = (\alpha \star_h \text{refl}) \cdot_v (\text{refl} \star_h \beta) = (\alpha \cdot_v \text{refl}) \star_h (\text{refl} \cdot_v \beta) = \alpha \star_h \beta$. Similarly, $\alpha \star_h \beta = (\text{refl} \cdot_v \alpha) \star_h (\beta \cdot_v \text{refl}) = (\text{refl} \star_h \beta) \cdot_v (\alpha \star_h \text{refl}) = \beta \cdot_v \alpha$. $\square$

### 2.5 Equivalences

Before stating univalence, we need a precise notion of when two types are "the same" in a structural sense.

**Definition 2.27 (Homotopy).** For functions $f, g : A \to B$, a *homotopy* from $f$ to $g$ is a term

$$f \sim g :\equiv \prod_{(x:A)} f(x) =_B g(x)$$

Homotopy is an equivalence relation (reflexive, symmetric, transitive), but it is weaker than identity of functions (unless function extensionality holds).

**Definition 2.28 (Fiber).** For $f : A \to B$ and $b : B$, the *fiber* (or *homotopy fiber*) of $f$ over $b$ is

$$\text{fib}_f(b) :\equiv \sum_{(a:A)} f(a) =_B b$$

An element of $\text{fib}_f(b)$ is a pair $(a, p)$ where $a : A$ and $p$ is a proof that $f(a) = b$.

**Definition 2.29 (Contractibility).** A type $A$ is *contractible* if there exists a center of contraction:

$$\text{isContr}(A) :\equiv \sum_{(a:A)} \prod_{(x:A)} a =_A x$$

Equivalently, $A$ is contractible if it is inhabited and all its elements are equal (to the center).

**Example 2.30.** The unit type $\mathbf{1}$ is contractible, with center $\star$ and contraction $\lambda x.\, \text{refl}_\star$ (since every element of $\mathbf{1}$ is judgmentally equal to $\star$).

**Lemma 2.31 (Singleton types are contractible).** For any $a : A$, the type $\sum_{(x:A)} a =_A x$ is contractible.

*Proof.* The center is $(a, \text{refl}_a)$. We need to show that for any $(x, p)$ with $p : a =_A x$, we have $(a, \text{refl}_a) = (x, p)$. By path induction on $p$: when $p \equiv \text{refl}_a$ and $x \equiv a$, the goal is $(a, \text{refl}_a) = (a, \text{refl}_a)$, witnessed by $\text{refl}$. $\square$

This lemma is fundamental. It says that the "space of all elements equal to $a$" is contractible --- it has exactly one element up to paths, namely $a$ itself.

**Definition 2.32 (Equivalence).** A function $f : A \to B$ is an *equivalence* if all its fibers are contractible:

$$\text{isEquiv}(f) :\equiv \prod_{(b:B)} \text{isContr}(\text{fib}_f(b))$$

The type of equivalences from $A$ to $B$ is

$$A \simeq B :\equiv \sum_{(f : A \to B)} \text{isEquiv}(f)$$

**Remark 2.33 (Alternative definitions).** There are several equivalent definitions of equivalence in HoTT:

1. **Contractible fibers** (Definition 2.32 above): $\prod_{b:B} \text{isContr}(\text{fib}_f(b))$.
2. **Bi-invertible maps**: $f$ has both a left inverse $g$ (with $g \circ f \sim \text{id}_A$) and a right inverse $h$ (with $f \circ h \sim \text{id}_B$). The inverses $g$ and $h$ need not coincide.
3. **Half-adjoint equivalences**: $f$ has an inverse $g$ with homotopies $\eta : g \circ f \sim \text{id}_A$ and $\varepsilon : f \circ g \sim \text{id}_B$ satisfying the *triangle identity*: $\text{ap}_f(\eta(a)) = \varepsilon(f(a))$ for all $a : A$.

All three definitions are logically equivalent (provably in MLTT), but they differ in their proof-theoretic properties. The half-adjoint formulation is often preferred because $\text{isEquiv}(f)$ is a proposition (has at most one element up to identity) in that formulation. This matters because it means that being an equivalence is a *property* of $f$, not additional *structure*.

**Proposition 2.34.** The identity function $\text{id}_A : A \to A$ is an equivalence. If $f : A \simeq B$ and $g : B \simeq C$, then $g \circ f : A \simeq C$ is an equivalence. If $f : A \simeq B$, then $f$ has an inverse $f^{-1} : B \simeq A$.

*Proof.* For the identity, $\text{fib}_{\text{id}}(a) = \sum_{(x:A)} x =_A a$, which is contractible by Lemma 2.31. Composition and inversion follow from routine calculations with fibers. For composition: $\text{fib}_{g \circ f}(c) \simeq \sum_{(a:A)} g(f(a)) =_C c \simeq \sum_{(b:B)} \text{fib}_f(b) \times \text{fib}_g(c)$, and one shows this is contractible when both $\text{fib}_f$ and $\text{fib}_g$ are. $\square$

### 2.6 Function Extensionality

In intensional type theory, two functions $f, g : A \to B$ may be *pointwise equal* --- meaning $\prod_{(x:A)} f(x) =_B g(x)$ is inhabited --- without being *identical* --- meaning $f =_{A \to B} g$ is inhabited. This is because the identity type on function types is not specified by the basic rules of MLTT.

**Axiom 2.35 (Function extensionality, naive form).** For $f, g : A \to B$:

$$\left(\prod_{(x:A)} f(x) =_B g(x)\right) \to (f =_{A \to B} g)$$

There is a canonical map in the reverse direction:

**Definition 2.36 (happly).** Given $p : f =_{A \to B} g$, define

$$\text{happly}(p) : \prod_{(x:A)} f(x) =_B g(x)$$

by $\text{happly}(p)(x) :\equiv \text{ap}_{(\lambda h.\, h(x))}(p)$, or equivalently by path induction: $\text{happly}(\text{refl}_f)(x) :\equiv \text{refl}_{f(x)}$.

**Axiom 2.37 (Function extensionality, strong form).** The map $\text{happly}$ is an equivalence:

$$\text{happly} : (f =_{A \to B} g) \simeq \prod_{(x:A)} f(x) =_B g(x)$$

The inverse of $\text{happly}$ is the function extensionality principle itself. The strong form is strictly stronger than the naive form because it specifies that the canonical map (not just some map) is an equivalence.

**Remark 2.38.** Function extensionality is independent of MLTT: it can be neither proved nor refuted from the basic rules. It follows from univalence (Theorem 2.48 below), and it also holds in cubical type theory (Lecture 10b). In practice, virtually all developments in HoTT assume function extensionality.

**Remark 2.39 (Dependent function extensionality).** There is an analogous principle for dependent functions: for $f, g : \prod_{(x:A)} B(x)$, the canonical map

$$\text{happly} : (f =_{\Pi} g) \to \prod_{(x:A)} f(x) =_{B(x)} g(x)$$

is an equivalence. This follows from the non-dependent version by standard techniques.

### 2.7 The Univalence Axiom

We now arrive at the central axiom of Homotopy Type Theory. The key insight is that there is a canonical map from identities between types to equivalences between types, and univalence asserts that this map is itself an equivalence.

**Construction 2.40 (The canonical map).** Let $\mathcal{U}$ be a universe and $A, B : \mathcal{U}$. Transport along a path $p : A =_\mathcal{U} B$ gives a function $\text{transport}^{\text{id}_\mathcal{U}}(p, -) : A \to B$. One can show (using path induction) that this transport map is an equivalence.

*Proof that transport is an equivalence.* By path induction on $p$: when $p \equiv \text{refl}_A$, the transport map is $\text{id}_A$, which is an equivalence by Proposition 2.34. $\square$

We therefore have a canonical function

$$\text{idtoeqv} : (A =_\mathcal{U} B) \to (A \simeq B)$$

defined by $\text{idtoeqv}(p) :\equiv (\text{transport}^{\text{id}_\mathcal{U}}(p, -),\; \pi)$ where $\pi$ is the proof that transport along $p$ is an equivalence.

Note that $\text{idtoeqv}(\text{refl}_A) = (\text{id}_A, \ldots)$, the identity equivalence.

**Axiom 2.41 (Univalence --- Voevodsky).** For all $A, B : \mathcal{U}$, the map $\text{idtoeqv}$ is an equivalence:

$$\text{idtoeqv} : (A =_\mathcal{U} B) \simeq (A \simeq B)$$

Equivalently, we may write

$$(A =_\mathcal{U} B) \simeq (A \simeq B)$$

The inverse map $\text{ua} : (A \simeq B) \to (A =_\mathcal{U} B)$ takes an equivalence and produces a path in the universe. The computation rule states:

$$\text{transport}^{\text{id}_\mathcal{U}}(\text{ua}(e), x) = e(x)$$

for $e : A \simeq B$ and $x : A$. The uniqueness principle states:

$$\text{ua}(\text{idtoeqv}(p)) = p$$

for $p : A =_\mathcal{U} B$.

**Remark 2.42 (What univalence says).** Univalence makes precise the idea that "equivalent types are identical." In set-theoretic foundations, the integers $\mathbb{Z}$ can be constructed in many ways (as equivalence classes of pairs of naturals, as a disjoint union of naturals with a sign, as a quotient, etc.), and these constructions produce literally different sets that are merely isomorphic. With univalence, there is a path in the universe between any two equivalent constructions of $\mathbb{Z}$, so any property or construction that depends on $\mathbb{Z}$ can be transported along this path. This eliminates the need to constantly verify that definitions and theorems are "invariant under isomorphism" --- univalence guarantees this automatically.

**Remark 2.43 (Consistency and models).** Univalence is consistent with MLTT. The key models are:

1. **Simplicial set model** (Kapulkin and Lumsdaine, 2012, building on Voevodsky): Types are interpreted as Kan fibrations (fibrant objects) in simplicial sets. The universe $\mathcal{U}$ is a Tarski-style universe of small Kan fibrations. Identity types are path spaces. Univalence holds because weak equivalences between Kan complexes can be "straightened" into paths in the universe.

2. **Cubical set model** (Bezem, Coquand, Huber, 2013; Cohen, Coquand, Huber, M\"ortberg, 2018): Types are Kan-fibrant cubical sets. This model additionally provides *computational* univalence (see Lecture 10b).

3. **$(\infty,1)$-topos models** (Shulman, 2019): Univalent universes exist in any $(\infty,1)$-topos, providing a vast class of models.

**Remark 2.44 (Univalence and classical logic).** Univalence is compatible with constructive logic. It is also compatible with the *propositional* axiom of excluded middle ($\prod_{(P : \text{Prop}_\mathcal{U})} P + \neg P$), but it is *incompatible* with the *type-theoretic* axiom of excluded middle ($\prod_{(A : \mathcal{U})} A + \neg A$), because the latter would imply that every type is a set, contradicting the non-triviality of $\text{Bool} =_\mathcal{U} \text{Bool}$.

### 2.8 Consequences of Univalence

**Theorem 2.45 (Type is not a set).** Assuming univalence, the universe $\mathcal{U}$ is not a set (i.e., it has non-trivial identity types). Specifically, $\text{Bool} =_\mathcal{U} \text{Bool}$ has (at least) two distinct elements.

*Proof.* The type $\text{Bool} \simeq \text{Bool}$ has at least two elements: the identity equivalence $\text{id}_\text{Bool}$ and the negation equivalence $\text{not}$. These are not equal as equivalences because their underlying functions differ: $\text{id}(\text{true}) = \text{true} \neq \text{false} = \text{not}(\text{true})$. By univalence, $\text{ua}(\text{id}) \neq \text{ua}(\text{not})$ (since $\text{ua}$ is injective, being part of an equivalence). So $\text{Bool} =_\mathcal{U} \text{Bool}$ has at least two distinct elements. Hence $\mathcal{U}$ is not a set. $\square$

**Remark 2.46.** In fact, one can show that $(\text{Bool} =_\mathcal{U} \text{Bool}) \simeq \text{Bool}$ (the automorphism group of $\text{Bool}$ is $\mathbb{Z}/2\mathbb{Z}$). More generally, for finite types with $n$ elements, the loop space at that type in the universe is the symmetric group $S_n$.

**Theorem 2.47 (Structure Identity Principle).** Let $\text{Str}$ be a "standard notion of structure" on types (formalized as a type family $S : \mathcal{U} \to \mathcal{U}$ with an appropriate notion of structure-preserving equivalence). Under suitable conditions (spelled out in HoTT Book Chapter 9), univalence implies that for structured types $(A, s_A)$ and $(B, s_B)$:

$$((A, s_A) =_{\sum_{X:\mathcal{U}} S(X)} (B, s_B)) \simeq \sum_{(e : A \simeq B)} S_e(s_A) =_{S(B)} s_B$$

where $S_e$ is the action of the equivalence $e$ on the structure, obtained by transport.

Informally: "isomorphic structures are identical." Two groups $(G, \cdot_G, e_G, \text{inv}_G)$ and $(H, \cdot_H, e_H, \text{inv}_H)$ are equal as elements of the type of groups if and only if there is a group isomorphism between them.

**Theorem 2.48 (Univalence implies function extensionality).** The univalence axiom implies function extensionality (Axiom 2.37).

*Proof sketch (following the HoTT Book, Theorem 4.9.5).* The proof proceeds in several steps:

1. **Univalence implies "weak function extensionality"**: for any type family $P : A \to \mathcal{U}$, if each $P(x)$ is contractible, then $\prod_{(x:A)} P(x)$ is contractible. This is proved using univalence to show that the projection $\text{pr}_1 : (\sum_{(x:A)} P(x)) \to A$ is an equivalence when each fiber $P(x)$ is contractible, and then using properties of equivalences.

2. **Weak function extensionality implies function extensionality**: Given $f, g : A \to B$ and $h : f \sim g$, consider the type family $P(x) :\equiv \sum_{(y:B)} f(x) =_B y$. Each $P(x)$ is contractible (singleton type). By weak function extensionality, $\prod_{(x:A)} P(x)$ is contractible. But $\prod_{(x:A)} P(x) \simeq \sum_{(g':A \to B)} f \sim g'$. Since this type is contractible, its identity type is trivial, and in particular $(g, h) = (\text{some other section})$, which gives a path $f = g$.

The full proof is somewhat involved but entirely constructive (given univalence). $\square$

**Corollary 2.49.** Univalence implies that for any $f : A \to B$, the type $\text{isEquiv}(f)$ is a proposition (i.e., any two proofs of $\text{isEquiv}(f)$ are equal).

*Proof.* Using the half-adjoint equivalence formulation, one shows that $\text{isEquiv}(f)$ is a proposition by showing that each component is a proposition (using function extensionality to compare homotopies). $\square$

### 2.9 Higher Inductive Types

Ordinary inductive types (natural numbers, lists, trees) are specified by *point constructors*: each constructor produces an element of the type being defined. Higher inductive types (HITs) extend this by allowing *path constructors*: constructors that produce elements of the identity type. In the most general case, there can also be 2-path constructors, 3-path constructors, etc.

**Definition 2.50 (The circle $S^1$).** The circle is the HIT generated by:

- A point constructor: $\text{base} : S^1$
- A path constructor: $\text{loop} : \text{base} =_{S^1} \text{base}$

There are no other constructors: $S^1$ is "freely generated" by one point and one loop. Homotopically, this is the classifying space $K(\mathbb{Z}, 1)$.

**Definition 2.51 (Elimination principle for $S^1$).** The non-dependent elimination principle states: to define a function $f : S^1 \to B$, it suffices to give:

- A point $b : B$ (the image of $\text{base}$)
- A loop $l : b =_B b$ (the image of $\text{loop}$)

The computation rules are:
- $f(\text{base}) \equiv b$ (judgmental)
- $\text{ap}_f(\text{loop}) = l$ (propositional in MLTT-based HoTT; judgmental in cubical type theory)

The dependent elimination principle states: to define $f : \prod_{(x:S^1)} P(x)$, give:
- $b : P(\text{base})$
- $l : \text{transport}^P(\text{loop}, b) =_{P(\text{base})} b$

Then $f(\text{base}) \equiv b$ and $\text{apd}_f(\text{loop}) = l$.

**Example 2.52 (Fundamental group of $S^1$).** The central theorem of Chapter 8 of the HoTT Book is:

$$\Omega(S^1, \text{base}) \simeq \mathbb{Z}$$

The proof uses the *encode-decode method*:

*Step 1 (Define the cover).* Define a type family $\text{Cover} : S^1 \to \mathcal{U}$ by the elimination principle for $S^1$ applied to the universe:
- $\text{Cover}(\text{base}) :\equiv \mathbb{Z}$
- $\text{ap}_\text{Cover}(\text{loop}) :\equiv \text{ua}(\text{succ})$

where $\text{succ} : \mathbb{Z} \simeq \mathbb{Z}$ is the successor equivalence ($n \mapsto n + 1$). This uses univalence to produce a path $\mathbb{Z} =_\mathcal{U} \mathbb{Z}$ from the equivalence.

The effect is: transporting around the loop increments the integer. $\text{transport}^\text{Cover}(\text{loop}, n) = n + 1$.

*Step 2 (Define encode and decode).* Define:
- $\text{encode} : \prod_{(x:S^1)} (\text{base} =_{S^1} x) \to \text{Cover}(x)$ by $\text{encode}(x, p) :\equiv \text{transport}^\text{Cover}(p, 0)$.
- $\text{decode} : \prod_{(x:S^1)} \text{Cover}(x) \to (\text{base} =_{S^1} x)$ by the dependent elimination principle: $\text{decode}(\text{base}, n) :\equiv \text{loop}^n$ (the $n$-fold concatenation of $\text{loop}$).

*Step 3 (Show encode and decode are inverse).* This requires showing $\text{decode}(\text{base}, \text{encode}(\text{base}, p)) = p$ for all $p : \text{base} =_{S^1} \text{base}$, and $\text{encode}(\text{base}, \text{decode}(\text{base}, n)) = n$ for all $n : \mathbb{Z}$. Both are proved by induction (on $p$ and $n$ respectively), using the computation rules for $\text{Cover}$ and the properties of $\text{loop}$.

This result is remarkable: it is a purely type-theoretic proof of a theorem from algebraic topology ($\pi_1(S^1) \cong \mathbb{Z}$), carried out entirely within the formal system.

**Definition 2.53 (Quotient types as HITs).** Given a type $A$ and a relation $R : A \to A \to \mathcal{U}$, the set quotient $A / R$ is the HIT with:

- A point constructor: $q : A \to A/R$
- A path constructor: for $a, b : A$ and $r : R(a,b)$, a path $\text{eq}(a, b, r) : q(a) =_{A/R} q(b)$
- A truncation constructor: for $x, y : A/R$ and $p, s : x =_{A/R} y$, a path $\text{trunc}(x,y,p,s) : p =_{x = y} s$

The last constructor ensures that $A/R$ is a set (0-type). Without it, we would get a *groupoid quotient* that retains higher path structure.

The elimination principle: to define $f : A/R \to B$ where $B$ is a set, give:
- $f_0 : A \to B$
- For each $a, b : A$ and $r : R(a,b)$: a proof $f_0(a) =_B f_0(b)$

No further data is needed because $B$ is a set (the truncation constructor is automatically respected).

**Example 2.54.** The integers $\mathbb{Z}$ can be defined as $(\mathbb{N} \times \mathbb{N}) / R$ where $R((a,b),(c,d)) :\equiv (a + d =_\mathbb{N} c + b)$. The pair $(a,b)$ represents the integer $a - b$.

**Definition 2.55 (Suspension).** The *suspension* $\Sigma A$ of a type $A$ is the HIT with:

- Point constructors: $\text{N}, \text{S} : \Sigma A$ (north and south poles)
- Path constructors: $\text{merid} : A \to (\text{N} =_{\Sigma A} \text{S})$ (a meridian for each point of $A$)

One can show that $\Sigma \mathbf{2} \simeq S^1$ (the suspension of the two-element type is the circle), $\Sigma S^n \simeq S^{n+1}$ in general, and $\Sigma \mathbf{0} \simeq \mathbf{2}$ (the suspension of the empty type has two disconnected points).

**Definition 2.56 (Pushouts).** Given $f : C \to A$ and $g : C \to B$, the *pushout* $A \sqcup_C B$ is the HIT with:

- Point constructors: $\text{inl} : A \to A \sqcup_C B$ and $\text{inr} : B \to A \sqcup_C B$
- Path constructors: $\text{glue} : \prod_{(c:C)} \text{inl}(f(c)) =_{A \sqcup_C B} \text{inr}(g(c))$

Many topological constructions (coequalizers, mapping cones, joins, wedge sums) can be expressed as pushouts. The suspension is a special case: $\Sigma A \simeq \mathbf{1} \sqcup_A \mathbf{1}$.

**Definition 2.57 (Truncation as a HIT).** The propositional truncation $\|A\|_{-1}$ is the HIT with:

- A point constructor: $|{-}| : A \to \|A\|_{-1}$
- A path constructor: $\text{trunc} : \prod_{(x,y : \|A\|_{-1})} x =_{\|A\|_{-1}} y$

This ensures that $\|A\|_{-1}$ is a proposition: any two elements are equal.

### 2.10 The n-Type Hierarchy

Types in HoTT are classified by the complexity of their identity types. This gives rise to a hierarchy of *truncation levels*.

**Definition 2.58 (n-types).** We define the notion of being an $n$-type by induction on $n \geq -2$:

- $A$ is a $(-2)$-type (contractible) if $\text{isContr}(A) :\equiv \sum_{(a:A)} \prod_{(x:A)} a = x$.
- $A$ is an $(n+1)$-type if for all $a, b : A$, the identity type $a =_A b$ is an $n$-type.

We use the following terminology:

| Level | Name | Intuition | Example |
|-------|------|-----------|---------|
| $-2$ | Contractible | Unique element up to unique path | $\mathbf{1}$, $\sum_{(x:A)} a =_A x$ |
| $-1$ | Proposition (mere proposition) | At most one element up to paths | $\mathbf{0}$, $\text{isProp}(A)$, $n \leq_\mathbb{N} m$ |
| $0$ | Set | Discrete; no non-trivial paths between elements | $\mathbb{N}$, $\text{Bool}$, $\mathbb{Z}$ |
| $1$ | Groupoid | Paths between elements, but no non-trivial 2-paths | $\text{Set}_\mathcal{U}$ (the type of sets) |
| $n$ | $n$-groupoid | Non-trivial path structure up to dimension $n$ | $\mathcal{U}$ is not an $n$-type for any $n$ |

**Proposition 2.59.** Every $n$-type is an $(n+1)$-type. That is, the hierarchy is cumulative.

*Proof.* By induction on $n$. If $A$ is a $(-2)$-type (contractible), then for all $a,b : A$, the type $a =_A b$ is contractible (since $A$ has a center of contraction $c$ and we can compose $c = a$ with $c = b$ inverted). Hence each $a =_A b$ is a $(-2)$-type, making $A$ a $(-1)$-type. For the inductive step, if $A$ is an $(n+1)$-type, then each $a =_A b$ is an $n$-type, hence an $(n+1)$-type by the inductive hypothesis, making $A$ an $(n+2)$-type. $\square$

**Proposition 2.60.** The following hold:

1. $\text{Bool}$ is a set.
2. $\mathbb{N}$ is a set.
3. $\mathbf{1}$ is contractible.
4. $\mathbf{0}$ is a proposition.
5. $A \times B$ is an $n$-type if $A$ and $B$ are $n$-types.
6. $A \to B$ is an $n$-type if $B$ is an $n$-type (for any $A$).
7. $\sum_{(x:A)} B(x)$ is an $n$-type if $A$ is an $n$-type and each $B(x)$ is an $n$-type.

*Proof of (1).* We use the encode-decode method. Define a type family $\text{code} : \text{Bool} \to \text{Bool} \to \mathcal{U}$ by:

$$\text{code}(\text{true}, \text{true}) :\equiv \mathbf{1}, \quad \text{code}(\text{true}, \text{false}) :\equiv \mathbf{0}, \quad \text{code}(\text{false}, \text{true}) :\equiv \mathbf{0}, \quad \text{code}(\text{false}, \text{false}) :\equiv \mathbf{1}$$

One shows that $(a =_\text{Bool} b) \simeq \text{code}(a, b)$ for all $a, b : \text{Bool}$. Since each $\text{code}(a,b)$ is a proposition (either $\mathbf{1}$ or $\mathbf{0}$), the identity types are propositions, so $\text{Bool}$ is a set. $\square$

**Theorem 2.61 (Hedberg's theorem).** Any type with decidable equality is a set.

*Proof.* Let $A$ have decidable equality, i.e., $d : \prod_{(a,b:A)} (a =_A b) + \neg(a =_A b)$.

Step 1: Define a function $f : \prod_{(a,b:A)} (a =_A b) \to (a =_A b)$ by:

$$f(a, b, p) :\equiv \begin{cases} q & \text{if } d(a,b) = \text{inl}(q) \\ \text{absurd}(d(a,b).\text{inr}\;p) & \text{if } d(a,b) = \text{inr}(n) \end{cases}

$$
The key observation: $f(a,b,-)$ is a *constant* function --- its output depends only on $d(a,b)$, not on the input path $p$.

Step 2: Since $f$ is a retraction ($f(a,b,p) = p$ is not quite right, but one can adjust: define $g(a,b,p) :\equiv f(a,a,\text{refl}_a)^{-1} \cdot f(a,b,p)$, then $g$ is also constant and $g(a,a,\text{refl}_a) = \text{refl}_a$).

Step 3: A type for which every endofunction on identity types factors through a constant function is a set. This is because if $p, q : a =_A b$, then $g(a,b,p) = g(a,b,q)$ (by constancy of $g$), and $g(a,b,p) = p$ and $g(a,b,q) = q$ (by the retraction property), so $p = q$. $\square$

**Definition 2.62 (Truncation).** For $n \geq -2$, the *$n$-truncation* of a type $A$ is a HIT $\|A\|_n$ satisfying:

- There is a map $|{-}|_n : A \to \|A\|_n$.
- $\|A\|_n$ is an $n$-type.
- $\|A\|_n$ is universal: for any $n$-type $B$ and $f : A \to B$, there exists a unique (up to homotopy) extension $\bar{f} : \|A\|_n \to B$ with $\bar{f} \circ |{-}|_n = f$.

The most commonly used cases:

- **Propositional truncation** $\|A\|_{-1}$: the mere proposition "there exists an element of $A$." It forgets all computational content, retaining only the fact of inhabitation.
- **Set truncation** $\|A\|_0$: forces all identity types to be propositions, collapsing the higher homotopical structure.

**Remark 2.63 (Propositional truncation and logic).** In HoTT, we distinguish between:

- $A$ itself: the full type, which may contain computational content.
- $\|A\|_{-1}$: the mere proposition that $A$ is inhabited, which forgets all computational content.

This distinction is crucial for the correct formulation of logic within type theory:

$$\exists_{(x:A)} P(x) :\equiv \left\|\sum_{(x:A)} P(x)\right\|_{-1}$$

$$P \lor Q :\equiv \|P + Q\|_{-1}$$

Without truncation, $\sum_{(x:A)} P(x)$ would serve as the existential, but this carries the *witness* $x$. In particular, the "axiom of choice" $(\prod_{(x:A)} \|B(x)\|_{-1}) \to \|\prod_{(x:A)} B(x)\|_{-1}$ is not trivially true (unlike $(\prod_{(x:A)} B(x)) \to \prod_{(x:A)} B(x)$), because we cannot extract witnesses from truncated types.

### 2.11 Why HoTT Matters

We conclude with a discussion of the significance of HoTT for the foundations of mathematics and computer science.

**New foundations for mathematics.** HoTT provides an alternative foundation for mathematics in which the basic objects are not sets but *homotopy types* (spaces). This is arguably closer to mathematical practice, where mathematicians routinely identify isomorphic structures and work with objects "up to equivalence." Univalence makes this practice formally justified.

**Computer-verified proofs.** HoTT has been extensively formalized in proof assistants, most notably in the HoTT library for Coq, in Cubical Agda, and in the 1Lab. The formalization of the Blakers--Massey theorem in HoTT by Lumsdaine, Finster, and Licata was a landmark achievement, demonstrating that non-trivial results in algebraic topology can be machine-checked.

**Synthetic homotopy theory.** HoTT enables *synthetic* reasoning about homotopy types: instead of building spaces out of point-set topology and then studying their homotopy theory, one works directly with the type-theoretic axioms. This has led to new proofs and even new results.

**Constructive mathematics.** HoTT is compatible with constructive logic (no axiom of excluded middle or choice is assumed, though they can be consistently added). This makes it suitable for extracting algorithms from proofs.

**Computational content.** The original univalence axiom blocks computation: $\text{ua}(e)$ does not reduce to a canonical form. This motivates cubical type theory (Lecture 10b), which gives univalence computational content.

**Practical impact.** The ideas of HoTT have influenced the design of proof assistants (Cubical Agda, cooltt, Arend) and have connections to programming language theory through the lens of directed type theory and higher-dimensional rewriting.

---

## 3. Worked Examples

### Example 3.1: Transport in a Family of Propositions

Let $P : \mathbb{N} \to \mathcal{U}$ be defined by $P(n) :\equiv (n =_\mathbb{N} 0) + (n \geq 1)$. Suppose we have $p : 0 =_\mathbb{N} 0$ (which is $\text{refl}_0$) and $h : P(0)$ (specifically $h :\equiv \text{inl}(\text{refl}_0)$). Then:

$$\text{transport}^P(\text{refl}_0, h) \equiv h$$

Now suppose we have a proof that $0 = 0$ in a more roundabout way. The key point is that in a set (like $\mathbb{N}$), all such proofs are equal to $\text{refl}$, so transport along any proof of $0 = 0$ gives the same result. More precisely, by Hedberg's theorem, $\mathbb{N}$ is a set, so any $p : 0 =_\mathbb{N} 0$ satisfies $p = \text{refl}_0$. Therefore $\text{transport}^P(p, h) = \text{transport}^P(\text{refl}_0, h) = h$.

### Example 3.2: Univalence for $\text{Bool} \simeq \text{Bool}$

There are exactly two automorphisms of $\text{Bool}$: the identity and negation. By univalence, these correspond to exactly two paths $\text{Bool} =_\mathcal{U} \text{Bool}$. Let $e : \text{Bool} \simeq \text{Bool}$ be the negation equivalence. Then:

$$\text{ua}(e) : \text{Bool} =_\mathcal{U} \text{Bool}$$

and for any type family $P : \mathcal{U} \to \mathcal{U}$:

$$\text{transport}^P(\text{ua}(e), x) = P_{\text{transport}}(e)(x)$$

For example, if $P(X) :\equiv X \to X$, then the transport of a function $f : \text{Bool} \to \text{Bool}$ along $\text{ua}(e)$ is $e \circ f \circ e^{-1}$, which conjugates $f$ by the negation map.

Concretely, $\text{transport}^{X \mapsto X \to X}(\text{ua}(\text{not}), \text{id}) = \text{not} \circ \text{id} \circ \text{not} = \text{not} \circ \text{not} = \text{id}$, and $\text{transport}^{X \mapsto X \to X}(\text{ua}(\text{not}), \text{not}) = \text{not} \circ \text{not} \circ \text{not} = \text{not}$. So the two automorphisms of $\text{Bool} \to \text{Bool}$ (as a type family evaluated at $\text{Bool}$) are permuted, but in this case each is fixed.

### Example 3.3: The Circle Elimination Principle

Define $f : S^1 \to S^1$ by the elimination principle with:
- $f(\text{base}) :\equiv \text{base}$
- $\text{ap}_f(\text{loop}) :\equiv \text{loop} \cdot \text{loop}$

This function "winds twice around the circle" --- it is the degree-2 map. The computation rule guarantees that $\text{ap}_f(\text{loop})$ is the path $\text{loop} \cdot \text{loop}$ in $\Omega(S^1, \text{base})$.

Under the identification $\Omega(S^1, \text{base}) \simeq \mathbb{Z}$, $\text{loop}$ corresponds to $1 \in \mathbb{Z}$ and $\text{loop} \cdot \text{loop}$ corresponds to $2 \in \mathbb{Z}$. So the map $f$ acts on the fundamental group as multiplication by 2.

### Example 3.4: Quotient by a Symmetric Relation

Consider $A :\equiv \{0, 1, 2\}$ (formally, a type with three elements) and $R$ such that $R(0,1)$ and $R(1,0)$ hold (and $R$ is reflexive). The HIT $A/R$ has:

- Points: $q(0), q(1), q(2)$
- Paths: $\text{eq}(0,1,r_{01}) : q(0) = q(1)$, $\text{eq}(1,0,r_{10}) : q(1) = q(0)$, and reflexivity paths
- Truncation: all paths between the same endpoints are equal

The result is a set with two elements: the equivalence class $\{0,1\}$ (represented by $q(0) = q(1)$) and the singleton $\{2\}$ (represented by $q(2)$, disconnected from the others).

### Example 3.5: Using Transport to Transfer Structure

Suppose we have proved that $(\mathbb{N}, +, 0)$ is a commutative monoid: $\text{comm-monoid}(\mathbb{N}) : \text{CommMonoid}(\mathbb{N})$. Let $\text{Fin}$ be a type of finite natural numbers that is equivalent to $\mathbb{N}$ via $e : \mathbb{N} \simeq \text{Fin}$. By univalence, $\text{ua}(e) : \mathbb{N} =_\mathcal{U} \text{Fin}$, and by the structure identity principle:

$$\text{transport}^{\text{CommMonoid}}(\text{ua}(e), \text{comm-monoid}(\mathbb{N})) : \text{CommMonoid}(\text{Fin})$$

This automatically transfers the commutative monoid structure from $\mathbb{N}$ to $\text{Fin}$, including all the algebraic laws (associativity, commutativity, identity element), without any manual verification that the laws hold for the transferred operations.

### Example 3.6: Propositional Truncation and the Axiom of Choice

Consider the "axiom of choice" statement: $\prod_{(x:A)} \|B(x)\|_{-1} \to \|\prod_{(x:A)} B(x)\|_{-1}$.

This is *not* provable in HoTT in general. The hypothesis gives us, for each $x$, the *mere existence* of some $b : B(x)$, but we cannot extract a specific $b$ from the truncation. The conclusion asks for the mere existence of a *global choice function*, which requires simultaneously choosing elements for all $x$.

However, the *type-theoretic axiom of choice* $\prod_{(x:A)} B(x) \to \prod_{(x:A)} B(x)$ is trivially true (it is the identity function). The distinction arises precisely because propositional truncation forgets the computational content (the specific witnesses).

---

## 4. Exercises

**Exercise 10a.1.** Use path induction to prove that for any $p : a =_A b$, we have $\text{ap}_{\text{id}_A}(p) = p$, where $\text{id}_A$ is the identity function. Write out the motive $C$ and base case $c$ explicitly.

**Exercise 10a.2.** Prove that $\text{ap}_{g \circ f}(p) = \text{ap}_g(\text{ap}_f(p))$ for $f : A \to B$, $g : B \to C$, and $p : a =_A a'$.

**Exercise 10a.3.** Show that transport in a constant type family is trivial: if $P(x) :\equiv B$ for all $x : A$, then $\text{transport}^P(p, b) = b$ for any $p : a =_A a'$ and $b : B$.

**Exercise 10a.4.** Prove that the unit type $\mathbf{1}$ is contractible and that the empty type $\mathbf{0}$ is a proposition.

**Exercise 10a.5.** Show that the type of propositions $\text{Prop}_\mathcal{U} :\equiv \sum_{(A:\mathcal{U})} \text{isProp}(A)$ is a set, assuming univalence. (Hint: a path in $\text{Prop}_\mathcal{U}$ is determined by a path in $\mathcal{U}$; by univalence, this is an equivalence between propositions; any map between propositions is an equivalence; so there is at most one path between any two propositions.)

**Exercise 10a.6.** Let $f : A \to B$ be a function with $\text{isEquiv}(f)$ and $g : B \to C$ with $\text{isEquiv}(g)$. Show that $\text{isEquiv}(g \circ f)$, directly from the contractible-fibers definition.

**Exercise 10a.7.** Prove that $\text{transport}^{(x \mapsto a =_A x)}(p, q) = q \cdot p$ for $q : a =_A b$ and $p : b =_A c$, using the J eliminator. (This was stated without full proof in Example 2.18.)

**Exercise 10a.8.** Show that for a type family $P : A \to \mathcal{U}$, a path $p : a =_A b$, and a function $f : \prod_{(x:A)} P(x)$, we have $\text{apd}_f(p) : \text{transport}^P(p, f(a)) =_{P(b)} f(b)$. Verify the computation rule: $\text{apd}_f(\text{refl}_a) \equiv \text{refl}_{f(a)}$.

**Exercise 10a.9.** Construct the integers $\mathbb{Z}$ as a HIT with constructors $\text{zero} : \mathbb{Z}$, $\text{succ} : \mathbb{Z} \to \mathbb{Z}$, and $\text{succ-is-equiv} : \text{isEquiv}(\text{succ})$. Define addition $+ : \mathbb{Z} \to \mathbb{Z} \to \mathbb{Z}$ using the elimination principle.

**Exercise 10a.10 (Challenging).** Prove the Eckmann--Hilton theorem (Theorem 2.26) in full detail, constructing all the necessary 2-paths explicitly using path induction and whiskering. In particular, construct the interchange law and the identification of vertical and horizontal composition.

**Exercise 10a.11 (Challenging).** Using univalence, show that the type $(\mathbf{2} =_\mathcal{U} \mathbf{2})$ is equivalent to $\mathbf{2}$ (where $\mathbf{2}$ is the two-element type). Conclude that $\mathcal{U}$ is a 1-type at $\mathbf{2}$ (i.e., the loop space is a set).

**Exercise 10a.12 (Open-ended).** The *Seifert--van Kampen theorem* in HoTT states that the fundamental group of a pushout can be computed from the fundamental groups of the pieces. Look up the statement in the HoTT Book (Chapter 8.7) and explain the role of HITs and univalence in the proof.

---

## Summary

- Identity types $\text{Id}_A(a,b)$ are the fundamental notion of equality in Martin-L\"of type theory. They are themselves types, potentially with rich internal structure.
- Path induction (the J eliminator) is the induction principle for identity types: to prove a property of all paths, it suffices to prove it for $\text{refl}$.
- Transport moves data between fibers of a type family along a path in the base, and is the mechanism by which equalities become computationally useful. Transport is an equivalence.
- Types carry the structure of $\infty$-groupoids, with path composition, inversion, and higher coherences. The groupoid laws hold up to higher paths, and the Eckmann--Hilton argument shows the second loop space is abelian.
- Equivalences are defined via contractible fibers (or equivalently, bi-invertible maps or half-adjoint equivalences). Being an equivalence is a proposition.
- The univalence axiom identifies the identity type of a universe with the type of equivalences: $(A =_\mathcal{U} B) \simeq (A \simeq B)$. This is a powerful principle of abstraction that ensures all type-theoretic constructions respect equivalence.
- Univalence implies function extensionality and the structure identity principle, and proves that the universe is not a set.
- Higher inductive types extend ordinary inductive types with path constructors, enabling the construction of quotients, spheres, and other topological spaces within type theory. The fundamental group of $S^1$ is $\mathbb{Z}$.
- The n-type hierarchy classifies types by the complexity of their identity structure: contractible types, propositions, sets, groupoids, and so on. Hedberg's theorem shows types with decidable equality are sets.
- Propositional truncation separates "computational existence" (via $\Sigma$) from "mere existence" (via $\|-\|_{-1}$), resolving the naive triviality of the axiom of choice.
- HoTT provides new foundations for mathematics, with deep connections to homotopy theory, and has been extensively formalized in proof assistants.

---

## Further Reading

1. **The Univalent Foundations Program.** *Homotopy Type Theory: Univalent Foundations of Mathematics* (the "HoTT Book"), 2013. Freely available at [homotopytypetheory.org/book](https://homotopytypetheory.org/book). Chapters 1--2 cover identity types; Chapters 3--4 cover sets, logic, and equivalences; Chapter 6 covers HITs; Chapter 8 covers the fundamental group of $S^1$.

2. **Rijke, E.** *Introduction to Homotopy Type Theory.* Cambridge University Press, 2024. A modern, comprehensive textbook with complete proofs.

3. **Voevodsky, V.** "An experimental library of formalized mathematics based on the univalent foundations." *Mathematical Structures in Computer Science* 25(5), 2015.

4. **Licata, D.R. and Shulman, M.** "Calculating the fundamental group of the circle in homotopy type theory." *LICS*, 2013.

5. **Awodey, S.** "Type theory and homotopy." In *Epistemology versus Ontology*, 2012. An early philosophical and mathematical perspective on the homotopical interpretation.

6. **Martin-L\"of, P.** *Intuitionistic Type Theory.* Bibliopolis, 1984. The original source for identity types and path induction.

7. **Hofmann, M. and Streicher, T.** "The groupoid interpretation of type theory." *Twenty-five Years of Constructive Type Theory*, Oxford University Press, 1998. The paper that first showed UIP is not provable in MLTT.

8. **Kraus, N., Escardo, M., Coquand, T., and Altenkirch, T.** "Notions of anonymous existence in Martin-L\"of type theory." *Logical Methods in Computer Science* 13(1), 2017. Detailed study of propositional truncation and Hedberg's theorem.

9. **Lumsdaine, P.L.** "Weak $\omega$-categories from intensional type theory." *Logical Methods in Computer Science* 6(3), 2010. Shows that the identity types of MLTT form a weak $\omega$-groupoid.

10. **Shulman, M.** "All $(\infty,1)$-toposes have strict univalent universes." Preprint, arXiv:1904.07004, 2019. Proves univalence holds in a wide class of models.

11. **van den Berg, B. and Garner, R.** "Types are weak $\omega$-groupoids." *Proceedings of the LMS* 102(2), 2011.

12. **Kapulkin, C. and Lumsdaine, P.L.** "The simplicial model of univalent foundations (after Voevodsky)." *Journal of the European Mathematical Society* 23(6), 2021.
