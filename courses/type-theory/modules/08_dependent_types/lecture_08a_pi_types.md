---
title: "Lecture 08a: Dependent Function Types (Pi Types)"
tags:
  - type-theory
  - dependent-types
  - lecture
---
# Lecture 08a: Dependent Function Types (Pi Types)

> **Module 08 --- Dependent Types (Weeks 15--16)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** why ordinary function types $A \to B$ are insufficient for expressing many important invariants, and motivate the need for types that mention values.
2. **Define** the Pi type $\Pi(x : A).\, B(x)$ precisely, stating its formation, introduction, elimination, and computation rules.
3. **Prove** that the ordinary function type $A \to B$ is a degenerate case of $\Pi(x : A).\, B(x)$ when $B$ does not depend on $x$.
4. **Construct** well-typed terms involving Pi types, including length-indexed vectors, $n$-ary function types, and dimension-checked matrix multiplication.
5. **State** and apply the conversion rule, explaining why type-checking with dependent types requires deciding type equality.
6. **Distinguish** definitional equality from propositional equality and explain the role of computation rules in type checking.
7. **Analyze** the consequences of blurring the phase distinction between types and terms for compilation and type checking.
8. **Explain** why type checking for dependently typed languages requires normalization and under what conditions it becomes undecidable.

---

## 1. Motivation

### 1.1 The Limits of Simple Types

In the simply typed lambda calculus and its polymorphic extensions (System F, $F_\omega$), types classify terms but remain strictly separated from them. A function type $A \to B$ tells us that given an input of type $A$, we obtain an output of type $B$ --- but the output *type* cannot vary depending on the input *value*. This separation is the **phase distinction**: types are erased at runtime and play no computational role.

Consider a function that creates a zero-initialized vector of length $n$:

$$\text{zeros} : \text{Nat} \to \text{Vec}(\text{Float})$$

The type tells us we get back a vector of floats, but says nothing about its length. We cannot express, within the type system, that calling $\text{zeros}(5)$ produces a vector of length 5. Consequently, the type system cannot prevent us from adding vectors of different lengths:

$$\text{add} : \text{Vec}(\text{Float}) \to \text{Vec}(\text{Float}) \to \text{Vec}(\text{Float})$$

This type happily accepts $\text{add}(\text{zeros}(3), \text{zeros}(5))$ without complaint, even though vector addition on vectors of differing lengths is undefined.

### 1.2 Types That Mention Values

The fundamental idea behind dependent types is to allow the *return type* of a function to depend on the *value* of its argument. Instead of $\text{Vec}(\text{Float})$, we write $\text{Vec}(\text{Float}, n)$ --- a type parameterized not just by a type ($\text{Float}$) but by a value ($n : \text{Nat}$). The zeros function then receives a precise type:

$$\text{zeros} : \Pi(n : \text{Nat}).\, \text{Vec}(\text{Float}, n)$$

Read this as: "for every natural number $n$, $\text{zeros}$ produces a vector of floats of length $n$." Now vector addition can be typed as:

$$\text{add} : \Pi(n : \text{Nat}).\, \text{Vec}(\text{Float}, n) \to \text{Vec}(\text{Float}, n) \to \text{Vec}(\text{Float}, n)$$

The type system enforces that both input vectors have the same length $n$, and the output has the same length. The term $\text{add}(3, \text{zeros}(3), \text{zeros}(5))$ is ill-typed because $\text{zeros}(5) : \text{Vec}(\text{Float}, 5)$ does not match the expected $\text{Vec}(\text{Float}, 3)$.

### 1.3 The Price of Expressiveness

This power comes at a cost. Since types can now contain arbitrary terms, the type checker must evaluate terms during type checking --- it must decide whether two types are "the same" even when they are expressed differently. For instance, are $\text{Vec}(\text{Float}, 2 + 3)$ and $\text{Vec}(\text{Float}, 5)$ the same type? Intuitively yes, but the type checker must compute $2 + 3 = 5$ to verify this. Type checking thus requires a **normalization** procedure, and the complexity of type checking depends on the complexity of the term language. In the most general setting, type checking can become undecidable.

### 1.4 Historical Context

Dependent types were introduced by de Bruijn in the Automath system (1968) and systematically developed by Per Martin-Lof beginning in the early 1970s. Martin-Lof's intuitionistic type theory (1971, 1984) provided the foundational framework. The Calculus of Constructions (Coquand and Huet, 1988) unified dependent types with polymorphism. Modern dependently typed languages and proof assistants --- Coq/Rocq, Agda, Lean, Idris --- all trace their lineage to these systems.

---

## 2. Core Theory

### 2.1 Informal Idea

The ordinary function type $A \to B$ is a special case of a more general construction. In $A \to B$, the codomain $B$ is fixed regardless of which element of $A$ we apply the function to. A **dependent function type** allows the codomain to vary:

$$\Pi(x : A).\, B(x)$$

Here $B$ is a *family of types* indexed by elements of $A$. That is, $B$ is a function from elements of $A$ to types: for each $a : A$, $B(a)$ is a type. A function $f$ of type $\Pi(x : A).\, B(x)$ takes an argument $a : A$ and returns a result of type $B(a)$ --- the return type depends on the particular argument.

**Notation.** Various notations are used in the literature:

| Notation | Tradition |
|---|---|
| $\Pi(x : A).\, B(x)$ | Martin-Lof type theory |
| $(x : A) \to B(x)$ | Agda, Lean |
| $\forall (x : A),\, B(x)$ | Coq/Rocq |
| $\prod_{x : A} B(x)$ | Categorical / HoTT |

We will primarily use $\Pi(x : A).\, B(x)$.

### 2.2 Type Families

Before defining Pi types formally, we must make precise the notion of a type family.

**Definition 2.1 (Type Family).** Given a type $A$, a **type family over $A$** (also called a **dependent type** or **indexed family**) is a function $B : A \to \mathcal{U}$ that assigns to each element $a : A$ a type $B(a) : \mathcal{U}$, where $\mathcal{U}$ is a universe of types.

In a formal system with judgments, we express this as: given $\Gamma \vdash A \; \text{type}$, a type family over $A$ in context $\Gamma$ is a derivation of $\Gamma, x : A \vdash B(x) \; \text{type}$.

**Example 2.2.** Let $A = \text{Nat}$. Define $B(n) = \text{Vec}(\text{Float}, n)$. Then $B$ is a type family over $\text{Nat}$: for each natural number $n$, $B(n)$ is the type of floating-point vectors of length $n$.

**Example 2.3.** Let $A = \text{Bool}$. Define:

$$B(\text{true}) = \text{Nat}, \qquad B(\text{false}) = \text{String}$$

Then $B$ is a type family over $\text{Bool}$. A function $f : \Pi(b : \text{Bool}).\, B(b)$ returns a natural number when given $\text{true}$ and a string when given $\text{false}$.

**Example 2.4.** The constant family $B(x) = C$ for all $x : A$ gives us the non-dependent function type $A \to C$.

### 2.3 Formation Rule

The formation rule for Pi types states the conditions under which $\Pi(x : A).\, B(x)$ is a well-formed type.

$$\frac{\Gamma \vdash A \; \text{type} \qquad \Gamma, x : A \vdash B(x) \; \text{type}}{\Gamma \vdash \Pi(x : A).\, B(x) \; \text{type}} \; (\Pi\text{-Form})$$

**Reading:** If $A$ is a type in context $\Gamma$, and $B(x)$ is a type in the extended context $\Gamma, x : A$, then $\Pi(x : A).\, B(x)$ is a type in context $\Gamma$.

Note the crucial asymmetry: the variable $x$ appears free in $B(x)$ but is bound in $\Pi(x : A).\, B(x)$. The formation rule requires that $B$ be well-formed in the context extended with $x : A$.

### 2.4 Introduction Rule (Lambda Abstraction)

The introduction rule for Pi types is lambda abstraction, just as for simple function types --- but now the body's type may depend on the bound variable.

$$\frac{\Gamma, x : A \vdash b(x) : B(x)}{\Gamma \vdash \lambda(x : A).\, b(x) : \Pi(x : A).\, B(x)} \; (\Pi\text{-Intro})$$

**Reading:** If in the extended context $\Gamma, x : A$, the term $b(x)$ has type $B(x)$, then the lambda abstraction $\lambda(x : A).\, b(x)$ has the Pi type $\Pi(x : A).\, B(x)$ in context $\Gamma$.

**Example 2.5.** The identity function on a given type:

$$\lambda(A : \mathcal{U}).\, \lambda(a : A).\, a \;:\; \Pi(A : \mathcal{U}).\, \Pi(a : A).\, A$$

Here the outer Pi quantifies over types (this requires a universe $\mathcal{U}$), and the inner Pi is an ordinary function type $A \to A$ (since $A$ does not depend on $a$). The return type of the inner function is $A$, which depends on the value of the outer argument.

### 2.5 Elimination Rule (Application)

The elimination rule for Pi types is function application, again generalizing the simple case.

$$\frac{\Gamma \vdash f : \Pi(x : A).\, B(x) \qquad \Gamma \vdash a : A}{\Gamma \vdash f(a) : B(a)} \; (\Pi\text{-Elim})$$

**Reading:** If $f$ has type $\Pi(x : A).\, B(x)$ and $a$ has type $A$, then the application $f(a)$ has type $B(a)$ --- that is, $B$ with $x$ replaced by the specific argument $a$.

This is where the dependency becomes visible: the type of $f(a)$ is $B(a)$, which depends on the *value* $a$. Different arguments yield results of different types.

**Example 2.6.** If $\text{zeros} : \Pi(n : \text{Nat}).\, \text{Vec}(\text{Float}, n)$, then:

- $\text{zeros}(3) : \text{Vec}(\text{Float}, 3)$
- $\text{zeros}(7) : \text{Vec}(\text{Float}, 7)$

The applications have genuinely different types.

### 2.6 Computation Rule (Beta Reduction)

The computation rule states that a lambda abstraction applied to an argument reduces by substitution:

$$\frac{\Gamma, x : A \vdash b(x) : B(x) \qquad \Gamma \vdash a : A}{\Gamma \vdash (\lambda(x : A).\, b(x))(a) \equiv b[a/x] : B(a)} \; (\Pi\text{-}\beta)$$

Here $\equiv$ denotes **definitional equality** (also called judgmental equality or computational equality). This is the same beta reduction as in the simply typed lambda calculus, but now it also triggers a change in type: the result $b[a/x]$ has type $B[a/x] = B(a)$.

**Example 2.7.** Let $f = \lambda(n : \text{Nat}).\, \text{replicate}(n, 0.0)$ where $\text{replicate} : \Pi(n : \text{Nat}).\, \text{Float} \to \text{Vec}(\text{Float}, n)$. Then:

$$f(3) \equiv \text{replicate}(3, 0.0) : \text{Vec}(\text{Float}, 3)$$

**Remark 2.8.** The beta rule for Pi types is the same as for the simply typed lambda calculus, but its consequences are more far-reaching: beta reduction not only simplifies the term but also *determines the type* of the result. In $(\lambda(x : A).\, b(x))(a) \equiv b[a/x] : B(a)$, the substitution $[a/x]$ must be applied to *both* the term ($b$) and the type ($B$). This is the fundamental mechanism by which computation drives type checking in dependently typed languages.

**Example 2.9 (Nested beta reduction).** Consider the function:

$$g \;\stackrel{\text{def}}{=}\; \lambda(A : \mathcal{U}).\, \lambda(n : \text{Nat}).\, \lambda(f : A \to A).\, \lambda(x : A).\, \text{iterate}(n, f, x)$$

where $\text{iterate} : \Pi(n : \text{Nat}).\, \Pi(A : \mathcal{U}).\, (A \to A) \to A \to A$ applies $f$ exactly $n$ times. Then:

$$g(\text{Nat})(3)(\text{succ})(0) \equiv \text{iterate}(3, \text{succ}, 0) \equiv \text{succ}(\text{succ}(\text{succ}(0))) = 3$$

Each application triggers a beta reduction, and the type of the result changes at each step:

- $g(\text{Nat}) : \Pi(n : \text{Nat}).\, (\text{Nat} \to \text{Nat}) \to \text{Nat} \to \text{Nat}$
- $g(\text{Nat})(3) : (\text{Nat} \to \text{Nat}) \to \text{Nat} \to \text{Nat}$
- $g(\text{Nat})(3)(\text{succ}) : \text{Nat} \to \text{Nat}$
- $g(\text{Nat})(3)(\text{succ})(0) : \text{Nat}$

### 2.7 Uniqueness Principle (Eta Expansion)

The uniqueness principle (eta rule) for Pi types states that every element of a Pi type is a function:

$$\frac{\Gamma \vdash f : \Pi(x : A).\, B(x)}{\Gamma \vdash f \equiv \lambda(x : A).\, f(x) : \Pi(x : A).\, B(x)} \; (\Pi\text{-}\eta)$$

This rule is often included in intensional type theories. It says that two functions are definitionally equal if and only if they agree on all arguments. Whether to include the eta rule is a design choice with consequences for decidability of type checking.

### 2.8 The Non-Dependent Case

When the family $B(x)$ does not actually depend on $x$ --- that is, $B(x) = C$ for some fixed type $C$ --- the Pi type degenerates to the ordinary function type:

$$\Pi(x : A).\, C \;\cong\; A \to C$$

**Proposition 2.8.** *If $\Gamma \vdash C \; \text{type}$ and $x \notin \text{FV}(C)$, then $\Pi(x : A).\, C$ and $A \to C$ are definitionally equal types.*

*Proof.* Every term $f : \Pi(x : A).\, C$ takes an argument $a : A$ and returns a term of type $C$ (which does not depend on $a$). This is exactly the data of a function $A \to C$. The formation, introduction, elimination, and computation rules specialize to those of the simple function type. $\square$

This is not merely an isomorphism but a genuine equality: the simple function type $A \to B$ is *defined* as $\Pi(x : A).\, B$ when $x \notin \text{FV}(B)$. In most dependently typed systems, the arrow notation $A \to B$ is syntactic sugar for this special case.

### 2.9 Dependent Function Types vs. Polymorphism

In System F, we have the polymorphic type $\forall \alpha.\, T(\alpha)$, where the quantification ranges over types. In a dependently typed system, this is subsumed by Pi types with a universe:

$$\forall \alpha.\, T(\alpha) \quad \leadsto \quad \Pi(\alpha : \mathcal{U}).\, T(\alpha)$$

Here $\mathcal{U}$ is a universe of types, and $\alpha$ ranges over *elements of $\mathcal{U}$* --- that is, types viewed as terms. This illustrates the unification of type-level and term-level quantification that dependent types achieve.

**Example 2.9.** The polymorphic identity function $\Lambda \alpha.\, \lambda(x : \alpha).\, x : \forall \alpha.\, \alpha \to \alpha$ becomes:

$$\lambda(\alpha : \mathcal{U}).\, \lambda(x : \alpha).\, x \;:\; \Pi(\alpha : \mathcal{U}).\, \alpha \to \alpha$$

There is no longer a need for a separate $\Lambda$ binder; ordinary lambda abstraction suffices because types are terms.

---

## 3. The Conversion Rule and Definitional Equality

### 3.1 The Need for Conversion

In a simply typed system, type checking never needs to compare types for equality --- syntactic identity suffices. With dependent types, this changes fundamentally. Consider:

$$f : \Pi(n : \text{Nat}).\, \text{Vec}(\text{Float}, n + 0) \to \text{Vec}(\text{Float}, n)$$

If we apply $f$ to $5$ and then pass a vector $v : \text{Vec}(\text{Float}, 5)$, we need the type checker to recognize that $\text{Vec}(\text{Float}, 5 + 0) = \text{Vec}(\text{Float}, 5)$, since $5 + 0$ computes to $5$. This requires a **conversion rule**.

### 3.2 The Conversion Rule

$$\frac{\Gamma \vdash a : A \qquad \Gamma \vdash A \equiv B \; \text{type}}{\Gamma \vdash a : B} \; (\text{Conv})$$

**Reading:** If $a$ has type $A$ and $A$ is definitionally equal to $B$, then $a$ also has type $B$.

This rule allows the type checker to silently convert between definitionally equal types. It is what makes dependent types usable in practice --- without it, we would need to insert explicit coercions everywhere.

### 3.3 Definitional Equality

**Definition 3.1 (Definitional Equality).** Definitional equality $\equiv$ is the smallest equivalence relation on well-typed terms and types that is closed under:

1. **Alpha-equivalence:** Renaming bound variables: $\lambda(x : A).\, b(x) \equiv \lambda(y : A).\, b(y)$.
2. **Beta-reduction:** $(\lambda(x : A).\, b(x))(a) \equiv b[a/x]$.
3. **Eta-expansion** (if included): $f \equiv \lambda(x : A).\, f(x)$ for $f : \Pi(x : A).\, B(x)$.
4. **Congruence:** If $a \equiv a'$ and $b \equiv b'$, then $f(a) \equiv f(a')$ and $\lambda(x : A).\, b \equiv \lambda(x : A).\, b'$, etc.
5. **Delta-reduction:** Unfolding definitions: if $c \stackrel{\text{def}}{=} t$, then $c \equiv t$.

Definitional equality is a *judgment* of the type theory, decided by the type checker without user input. It is distinct from **propositional equality**, which is an internal type (the identity type $\text{Id}_A(a, b)$) whose inhabitants are proofs that must be constructed explicitly.

### 3.4 Deciding Definitional Equality via Normalization

The standard approach to deciding definitional equality is:

1. **Normalize** both terms to their normal forms (terms with no remaining beta-redexes).
2. **Compare** the normal forms for alpha-equivalence.

Two terms are definitionally equal if and only if they have the same normal form (up to alpha-equivalence).

**Definition 3.2 (Normal Form).** A term is in **normal form** if no beta-reduction rule applies to it or any of its subterms. A term is in **weak head normal form (WHNF)** if no reduction applies at the outermost level.

For type checking, it typically suffices to reduce to WHNF and compare structurally, reducing subterms lazily as needed.

**Theorem 3.3 (Decidability via Normalization).** *If every well-typed term has a unique normal form (i.e., the reduction relation is confluent and strongly normalizing), then definitional equality is decidable.*

*Proof sketch.* Given two terms $a$ and $b$, compute their normal forms $\text{nf}(a)$ and $\text{nf}(b)$. By strong normalization, this process terminates. By confluence, normal forms are unique. Then $a \equiv b$ if and only if $\text{nf}(a) =_\alpha \text{nf}(b)$, which is decidable. $\square$

### 3.5 Propositional vs. Definitional Equality: A Detailed Comparison

The distinction between definitional and propositional equality is one of the most important (and initially confusing) aspects of dependent type theory.

**Definitional equality** ($a \equiv b$):

- Decided by the type checker automatically.
- Corresponds to "computational equality" --- two terms that compute to the same value.
- Is a *judgment*, not a type.
- Cannot be assumed, hypothesized, or abstracted over.
- Examples: $2 + 3 \equiv 5$, $(\lambda x.\, x)(y) \equiv y$, $\text{add}(0, n) \equiv n$.

**Propositional equality** ($\text{Id}_A(a, b)$):

- Is a type. Its elements are proofs of equality.
- Must be explicitly constructed by the programmer/prover.
- Can be assumed, hypothesized, and abstracted over.
- Is more general: $a \equiv b$ implies $\text{Id}_A(a, b)$ (via $\text{refl}$), but not conversely.
- Examples: $\text{add}(n, 0) = n$ (requires proof by induction), $\text{add}(m, n) = \text{add}(n, m)$ (requires proof by induction).

**The gap.** There are many equalities that are propositionally true but not definitionally true. For example, $n + 0 = n$ is not definitional because addition is defined by recursion on its *first* argument:

$$\text{add}(0, n) \equiv n \qquad \text{(definitional, by computation rule)}$$

$$\text{add}(n, 0) \stackrel{?}{=} n \qquad \text{(propositional, requires induction)}$$

Narrowing this gap is a major goal of type theory research. Cubical type theory and observational type theory both aim to make more equalities definitional.

### 3.6 The Tension: Expressiveness vs. Decidability

Adding general recursion to the term language destroys strong normalization, making definitional equality --- and hence type checking --- undecidable. Dependently typed languages resolve this tension in different ways:

- **Coq/Rocq, Agda, Lean:** Require all functions to be total (terminating). The termination checker enforces this. Type checking is decidable (modulo the termination checker's conservatism).
- **Idris 2:** Allows partial functions but marks them, keeping type checking decidable for the total fragment.
- **Dependent Haskell (proposed):** Would allow general recursion, accepting undecidable type checking.

The design space involves a fundamental tradeoff:

$$\text{General recursion} + \text{Dependent types} \implies \text{Undecidable type checking}$$

**Proof of undecidability.** Suppose the term language can express arbitrary Turing machines. Given a Turing machine $M$, encode it as a term $t_M : \text{Nat}$ that normalizes to $0$ if $M$ halts and diverges otherwise. Then to check whether $\text{Vec}(A, t_M) \equiv \text{Vec}(A, 0)$, the type checker must determine whether $t_M$ normalizes to $0$, which requires solving the halting problem.

More precisely, type checking for such a system is $\Pi^0_1$-complete: it is co-recursively enumerable but not recursive.

---

## 4. Computation in Types

### 4.1 Type-Level Computation

In dependently typed systems, types can contain arbitrary computations. This is both a feature and a challenge.

**Example 4.1 (Type-level arithmetic).** Consider the type of a function that concatenates two vectors:

$$\text{append} : \Pi(m\, n : \text{Nat}).\, \text{Vec}(A, m) \to \text{Vec}(A, n) \to \text{Vec}(A, m + n)$$

After calling $\text{append}(3, 4, u, v)$, the result has type $\text{Vec}(A, 3 + 4)$. The type checker must compute $3 + 4 = 7$ to determine that this matches $\text{Vec}(A, 7)$.

More subtly, if we reverse a vector:

$$\text{reverse} : \Pi(n : \text{Nat}).\, \text{Vec}(A, n) \to \text{Vec}(A, n)$$

and then append:

$$\text{append}(n, m, \text{reverse}(n, u), v) : \text{Vec}(A, n + m)$$

No type-level computation is needed beyond what the types already state. But if we tried to state that reverse-then-append equals append-then-reverse, we would need to show $n + m = m + n$, which is a *propositional* equality requiring a proof by induction --- not something definitional equality can handle.

### 4.2 The Blurred Phase Distinction

In traditional compiled languages, there is a sharp **phase distinction**:

| Phase | Entities | When |
|---|---|---|
| Compile time | Types, kinds | Before execution |
| Run time | Values, terms | During execution |

In a dependently typed language, this distinction blurs:

- Types contain terms, so type checking requires evaluating terms.
- Terms may contain types (e.g., type-passing polymorphism).
- The "compile time" phase must perform "run time" computations.

This has practical consequences:

1. **Type erasure becomes non-trivial.** Some term-level arguments exist only to make types check and carry no computational content (e.g., the length index $n$ in $\text{Vec}(A, n)$ when the vector already stores its length at runtime). Identifying and erasing such arguments is the subject of **quantitative type theory** and **erasure analysis**.

2. **The type checker is an interpreter.** It must evaluate terms to compare types, so it must contain a full evaluator for the term language.

3. **Error messages involve computation.** A type error might report that $\text{Vec}(\text{Float}, (n + 1) + m)$ does not match $\text{Vec}(\text{Float}, n + (1 + m))$, requiring the user to understand type-level arithmetic.

---

## 5. Worked Examples

### 5.1 Length-Indexed Vectors

We formalize the type of vectors indexed by their length. This is the canonical example of dependent types.

**Type Formation.**

$$\frac{\Gamma \vdash A \; \text{type} \qquad \Gamma \vdash n : \text{Nat}}{\Gamma \vdash \text{Vec}(A, n) \; \text{type}} \; (\text{Vec-Form})$$

**Constructors (Introduction Rules).**

$$\frac{\Gamma \vdash A \; \text{type}}{\Gamma \vdash \text{nil} : \text{Vec}(A, 0)} \; (\text{Vec-Nil})$$

$$\frac{\Gamma \vdash a : A \qquad \Gamma \vdash v : \text{Vec}(A, n)}{\Gamma \vdash \text{cons}(a, v) : \text{Vec}(A, \text{succ}(n))} \; (\text{Vec-Cons})$$

**Example terms:**

- $\text{nil} : \text{Vec}(\text{Nat}, 0)$
- $\text{cons}(3, \text{nil}) : \text{Vec}(\text{Nat}, 1)$
- $\text{cons}(1, \text{cons}(2, \text{cons}(3, \text{nil}))) : \text{Vec}(\text{Nat}, 3)$

**Eliminator (Dependent Fold / Induction Principle).**

$$\frac{\begin{array}{c} \Gamma \vdash v : \text{Vec}(A, n) \qquad \Gamma, k : \text{Nat}, w : \text{Vec}(A, k) \vdash P(k, w) \; \text{type} \\ \Gamma \vdash p_{\text{nil}} : P(0, \text{nil}) \\ \Gamma, k : \text{Nat}, a : A, w : \text{Vec}(A, k), p : P(k, w) \vdash p_{\text{cons}}(k, a, w, p) : P(\text{succ}(k), \text{cons}(a, w)) \end{array}}{\Gamma \vdash \text{Vec-elim}(v, P, p_{\text{nil}}, p_{\text{cons}}) : P(n, v)}$$

**Computation rules:**

$$\text{Vec-elim}(\text{nil}, P, p_{\text{nil}}, p_{\text{cons}}) \equiv p_{\text{nil}}$$

$$\text{Vec-elim}(\text{cons}(a, w), P, p_{\text{nil}}, p_{\text{cons}}) \equiv p_{\text{cons}}(k, a, w, \text{Vec-elim}(w, P, p_{\text{nil}}, p_{\text{cons}}))$$

**Head function (total, no partiality).** Using dependent types, we can define a head function that is total --- it only accepts non-empty vectors:

$$\text{head} : \Pi(A : \mathcal{U}).\, \Pi(n : \text{Nat}).\, \text{Vec}(A, \text{succ}(n)) \to A$$

$$\text{head}(A, n, \text{cons}(a, v)) \stackrel{\text{def}}{=} a$$

There is no case for $\text{nil}$ because $\text{nil} : \text{Vec}(A, 0)$ does not match $\text{Vec}(A, \text{succ}(n))$ --- the types are disjoint. Pattern matching is exhaustive.

**Append function.**

$$\text{append} : \Pi(A : \mathcal{U}).\, \Pi(m\, n : \text{Nat}).\, \text{Vec}(A, m) \to \text{Vec}(A, n) \to \text{Vec}(A, m + n)$$

$$\text{append}(A, 0, n, \text{nil}, w) \stackrel{\text{def}}{=} w$$

$$\text{append}(A, \text{succ}(k), n, \text{cons}(a, v), w) \stackrel{\text{def}}{=} \text{cons}(a, \text{append}(A, k, n, v, w))$$

The return type of the second clause is $\text{Vec}(A, \text{succ}(k) + n)$. By the computation rule for addition, $\text{succ}(k) + n \equiv \text{succ}(k + n)$. The recursive call $\text{append}(A, k, n, v, w) : \text{Vec}(A, k + n)$, so $\text{cons}(a, \text{append}(\ldots)) : \text{Vec}(A, \text{succ}(k + n))$, which matches. Type checking goes through by definitional equality.

### 5.2 N-ary Function Types

We can use Pi types to define the type of $n$-ary functions from a type $A$ to a type $B$:

$$\text{NaryFun} : \text{Nat} \to \mathcal{U} \to \mathcal{U} \to \mathcal{U}$$

$$\text{NaryFun}(0, A, B) \stackrel{\text{def}}{=} B$$

$$\text{NaryFun}(\text{succ}(n), A, B) \stackrel{\text{def}}{=} A \to \text{NaryFun}(n, A, B)$$

So $\text{NaryFun}(3, \text{Nat}, \text{Bool})$ computes to $\text{Nat} \to \text{Nat} \to \text{Nat} \to \text{Bool}$.

We can then write a generic $n$-ary currying function:

$$\text{curryN} : \Pi(n : \text{Nat}).\, (\text{Vec}(A, n) \to B) \to \text{NaryFun}(n, A, B)$$

This is a function whose type depends on a natural number $n$, and whose *return type* is itself computed by recursion on $n$. Such definitions are impossible in System F or $F_\omega$.

### 5.3 Matrix Multiplication with Checked Dimensions

Define $\text{Mat}(A, m, n)$ as the type of $m \times n$ matrices with entries in $A$. Then matrix multiplication receives the type:

$$\text{matmul} : \Pi(l\, m\, n : \text{Nat}).\, \text{Mat}(A, l, m) \to \text{Mat}(A, m, n) \to \text{Mat}(A, l, n)$$

The shared dimension $m$ must agree between the two input matrices. If we attempt $\text{matmul}(2, 3, 4, M, N)$ where $M : \text{Mat}(A, 2, 3)$ and $N : \text{Mat}(A, 5, 4)$, the type checker rejects this because $N : \text{Mat}(A, 5, 4)$ does not match the expected $\text{Mat}(A, 3, 4)$.

We can also express the chain of matrix multiplications with compatible dimensions:

$$\text{chain} : \Pi(n : \text{Nat}).\, \text{Vec}(\text{Nat}, \text{succ}(n)) \to \mathcal{U}$$

where $\text{chain}(n, \text{dims})$ computes to the type of a sequence of $n$ matrices whose dimensions are compatible for sequential multiplication, with the dimension vector $\text{dims}$ specifying all $n + 1$ dimension values.

### 5.4 Printf and Dependent Types

A classic example of dependent types in practice is a type-safe printf function. The format string determines the types of the remaining arguments:

$$\text{PrintfType} : \text{FormatString} \to \mathcal{U}$$

$$\text{PrintfType}(\text{""}) \stackrel{\text{def}}{=} \text{String}$$

$$\text{PrintfType}(\text{"\%d"} \mathbin{+\!\!+} s) \stackrel{\text{def}}{=} \text{Int} \to \text{PrintfType}(s)$$

$$\text{PrintfType}(\text{"\%s"} \mathbin{+\!\!+} s) \stackrel{\text{def}}{=} \text{String} \to \text{PrintfType}(s)$$

$$\text{PrintfType}(c \mathbin{::} s) \stackrel{\text{def}}{=} \text{PrintfType}(s) \quad \text{(for literal characters } c \text{)}$$

Then:

$$\text{printf} : \Pi(fmt : \text{FormatString}).\, \text{PrintfType}(fmt)$$

So $\text{printf}(\text{"\%d + \%d = \%d"})$ has type $\text{Int} \to \text{Int} \to \text{Int} \to \text{String}$.

---

## 6. Formal Properties

### 6.1 Substitution Lemma

**Lemma 6.1 (Substitution for Pi Types).** *If $\Gamma, x : A, \Delta \vdash t : C$ and $\Gamma \vdash a : A$, then $\Gamma, \Delta[a/x] \vdash t[a/x] : C[a/x]$.*

*Proof.* By induction on the typing derivation of $t$. The key cases are:

- **Variable:** If $t = x$, then $C = A$ and $t[a/x] = a : A = C[a/x]$.
- **Lambda:** If $t = \lambda(y : B).\, b$ and $C = \Pi(y : B).\, D$, then by induction hypothesis on $b$, we get $b[a/x] : D[a/x]$ in the appropriately substituted context. Thus $\lambda(y : B[a/x]).\, b[a/x] : \Pi(y : B[a/x]).\, D[a/x]$.
- **Application:** If $t = f(s)$ where $f : \Pi(y : B).\, D$ and $s : B$, then $C = D[s/y]$. By induction, $f[a/x] : (\Pi(y : B).\, D)[a/x]$ and $s[a/x] : B[a/x]$. So $f[a/x](s[a/x]) : D[a/x][s[a/x]/y] = D[s/y][a/x] = C[a/x]$. (The last equality uses the substitution lemma for terms.) $\square$

### 6.2 Subject Reduction

**Theorem 6.2 (Subject Reduction / Type Preservation).** *If $\Gamma \vdash t : A$ and $t \longrightarrow t'$, then $\Gamma \vdash t' : A$.*

*Proof.* By induction on the derivation $t \longrightarrow t'$. The critical case is beta-reduction:

If $t = (\lambda(x : B).\, b)(a)$ and $t' = b[a/x]$, then from the typing derivation we have $\Gamma, x : B \vdash b : C(x)$ and $\Gamma \vdash a : B$. By the substitution lemma, $\Gamma \vdash b[a/x] : C[a/x]$. From $\Pi$-Elim, the original type is $C[a/x]$, so $t' : C[a/x] = A$. $\square$

### 6.3 Strong Normalization (Sketch)

**Theorem 6.3.** *In the pure calculus with Pi types (no general recursion, no fix-point combinator), every well-typed term has a normal form, and every reduction sequence terminates.*

This is proved by constructing a logical relations argument (also called a reducibility candidates argument) analogous to the proof for System F, but adapted to handle the dependency between types and terms. The proof is significantly more involved because the logical relation must be defined simultaneously with the typing judgment --- types can contain terms, so the interpretation of types depends on the interpretation of terms.

The standard reference is the proof by Werner (1994) for the Calculus of Constructions and by Abel (2008) for Martin-Lof type theory using normalization by evaluation.

---

## 7. Type Checking Algorithm

### 7.1 Bidirectional Type Checking

Bidirectional type checking, introduced in Lecture 05, becomes essential for dependent types. We distinguish two modes:

- **Checking mode** ($\Gamma \vdash t \Leftarrow A$): We know the expected type $A$ and check that $t$ has that type.
- **Synthesis mode** ($\Gamma \vdash t \Rightarrow A$): We infer the type $A$ from the term $t$.

The key rules for Pi types in bidirectional style:

**Lambda (checking mode only):**

$$\frac{\Gamma, x : A \vdash b \Leftarrow B(x)}{\Gamma \vdash \lambda x.\, b \Leftarrow \Pi(x : A).\, B(x)} \; (\Pi\text{-Intro-Check})$$

Lambda abstractions are checked, not synthesized. The expected Pi type provides the domain $A$ and the codomain family $B$.

**Application (synthesis mode):**

$$\frac{\Gamma \vdash f \Rightarrow \Pi(x : A).\, B(x) \qquad \Gamma \vdash a \Leftarrow A}{\Gamma \vdash f(a) \Rightarrow B(a)} \; (\Pi\text{-Elim-Synth})$$

The function must synthesize a Pi type; the argument is checked against the domain; the result type is obtained by substitution.

**Conversion (switch from synthesis to checking):**

$$\frac{\Gamma \vdash t \Rightarrow A \qquad A \equiv B}{\Gamma \vdash t \Leftarrow B} \; (\text{Sub})$$

### 7.2 Normalization During Type Checking

The type checker must normalize types before comparing them. A typical implementation strategy:

```
check(ctx, Lam(x, body), Pi(x, A, B)):
    check(extend(ctx, x, A), body, B)

infer(ctx, App(f, a)):
    let Pi(x, A, B) = whnf(infer(ctx, f))
    check(ctx, a, A)
    return subst(x, a, B)

equal(ctx, ty1, ty2):
    let nf1 = whnf(ty1)
    let nf2 = whnf(ty2)
    -- compare nf1 and nf2 structurally, recursing as needed
```

The `whnf` function computes the weak head normal form. This is typically more efficient than full normalization because it avoids reducing under binders until necessary.

### 7.3 Complexity of Type Checking

**Theorem 7.1 (Undecidability in General).** *Type checking for a dependently typed language with unrestricted recursion is undecidable.*

*Proof sketch.* If we can write arbitrary recursive functions in the term language, then type equality involves checking equality of arbitrary computable functions, which reduces to the halting problem. Specifically, given a Turing machine $M$, we can encode it as a term $t_M$ such that $t_M$ normalizes if and only if $M$ halts. Then checking whether $\text{Vec}(A, t_M)$ is a valid type requires determining whether $t_M$ normalizes. $\square$

For languages with a termination guarantee (all well-typed terms normalize), type checking is decidable but can be very expensive. In the Calculus of Constructions, type checking is decidable but the complexity is not elementary recursive in general.

---

## 8. Pi Types in the Lambda Cube

### 8.1 Position in the Lambda Cube

Recall from Module 07 that the lambda cube classifies type systems along three axes:

1. **Terms depending on types** (polymorphism): $\lambda 2$ / System F
2. **Types depending on types** (type operators): $\lambda\underline{\omega}$
3. **Types depending on terms** (dependent types): $\lambda P$

Pi types correspond to axis 3. The system $\lambda P$ (also called LF, the Logical Framework) has:

- Term-level variables: $x : A$
- Type-level families indexed by terms: $B : A \to \mathcal{U}$
- Pi types: $\Pi(x : A).\, B(x)$

But $\lambda P$ alone does not have polymorphism or type operators. The full dependent type system, combining all three axes, is the Calculus of Constructions ($\lambda C$ or $\lambda P \omega$), which we study in Lecture 08d.

### 8.2 Comparison of Quantifiers

| System | Quantifier | Abstraction | Domain | Codomain |
|---|---|---|---|---|
| $\lambda{\to}$ (STLC) | $A \to B$ | $\lambda(x:A).b$ | Type | Fixed type |
| $\lambda 2$ (System F) | $\forall \alpha. B(\alpha)$ | $\Lambda \alpha. b$ | Kind $*$ | Type family |
| $\lambda\underline{\omega}$ | $F(A)$ | $\lambda(\alpha : K). B$ | Kind | Kind |
| $\lambda P$ | $\Pi(x:A). B(x)$ | $\lambda(x:A). b$ | Type | Type family |
| $\lambda C$ (CoC) | All of the above, unified | $\lambda(x:A). b$ | Any sort | Any sort |

### 8.3 The Power of Pi

The Pi type is the most general form of function type. By choosing the domain and codomain appropriately, we can recover all the quantifiers:

- $\Pi(x : A).\, B$ where $x \notin \text{FV}(B)$: ordinary function type $A \to B$.
- $\Pi(\alpha : \mathcal{U}).\, B(\alpha)$: polymorphic type $\forall \alpha.\, B(\alpha)$.
- $\Pi(\alpha : \mathcal{U}).\, \Pi(x : \alpha).\, \alpha$: polymorphic identity type.
- $\Pi(n : \text{Nat}).\, \text{Vec}(A, n) \to B$: genuine dependent function type.

---

## 9. Advanced Topics

### 9.1 Implicit Arguments

In practice, many arguments to dependently typed functions can be inferred from context. Writing them all out is tedious:

$$\text{append}(\text{Nat}, 3, 2, \text{cons}(1, \text{cons}(2, \text{cons}(3, \text{nil}))), \text{cons}(4, \text{cons}(5, \text{nil})))$$

Modern dependently typed languages support **implicit arguments**, where the type checker infers arguments by unification:

$$\text{append}(\text{cons}(1, \text{cons}(2, \text{cons}(3, \text{nil}))), \text{cons}(4, \text{cons}(5, \text{nil})))$$

The type parameters $A$, $m$, and $n$ are inferred. Formally, implicit arguments are Pi-bound variables that the elaborator fills in:

$$\text{append} : \{A : \mathcal{U}\} \to \{m\, n : \text{Nat}\} \to \text{Vec}(A, m) \to \text{Vec}(A, n) \to \text{Vec}(A, m + n)$$

The braces $\{-\}$ denote implicit arguments.

### 9.2 Irrelevance and Erasure

Some arguments to dependently typed functions are computationally irrelevant --- they exist only to make the types work out. The length index $n$ in $\text{Vec}(A, n)$ carries no information beyond what is already determined by the structure of the vector.

**Quantitative type theory** (Atkey 2018, McBride 2016) tracks how many times each variable is used, allowing the compiler to erase arguments that are used zero times at runtime:

$$\text{head} : \Pi(A : \mathcal{U}).\, \Pi(0\; n : \text{Nat}).\, \text{Vec}(A, \text{succ}(n)) \to A$$

Here the annotation $0$ on $n$ indicates that $n$ is used zero times computationally (it appears only in types).

### 9.3 Large Eliminations

A **large elimination** is a dependent pattern match whose return type is a type (an element of a universe). Large eliminations are what make dependent types truly powerful --- they allow case analysis on values to determine types.

**Example 9.1.** The function $\text{NaryFun}$ from Section 5.2 is a large elimination: it pattern-matches on a natural number and returns a type.

**Example 9.2.** The universe interpretation function in a generic programming library:

$$\text{El} : \text{Code} \to \mathcal{U}$$

$$\text{El}(\text{nat\_code}) = \text{Nat}$$

$$\text{El}(\text{pair\_code}(c_1, c_2)) = \text{El}(c_1) \times \text{El}(c_2)$$

$$\text{El}(\text{fun\_code}(c_1, c_2)) = \text{El}(c_1) \to \text{El}(c_2)$$

Large eliminations are the source of much of the complexity in dependent type theory. They are also the feature that separates full dependent types from the weaker notion of **indexed types** found in GADTs.

### 9.4 Universe Levels and Pi Types

When Pi types involve universes, we must be careful about universe levels. If $A : \mathcal{U}_i$ and $\Gamma, x : A \vdash B(x) : \mathcal{U}_j$, then what is the universe level of $\Pi(x : A).\, B(x)$?

In predicative type theories (Martin-Lof style), the Pi type lives at $\mathcal{U}_{\max(i,j)}$:

$$\frac{\Gamma \vdash A : \mathcal{U}_i \qquad \Gamma, x : A \vdash B(x) : \mathcal{U}_j}{\Gamma \vdash \Pi(x : A).\, B(x) : \mathcal{U}_{\max(i,j)}}$$

In the Calculus of Constructions with its impredicative $\text{Prop}$, if the codomain is in $\text{Prop}$, then the Pi type is in $\text{Prop}$ regardless of the domain's level:

$$\frac{\Gamma \vdash A : \mathcal{U}_i \qquad \Gamma, x : A \vdash B(x) : \text{Prop}}{\Gamma \vdash \Pi(x : A).\, B(x) : \text{Prop}}$$

This impredicativity is what allows universal quantification over all types to yield a proposition.

### 9.5 Dependent Types and GADTs

Generalized Algebraic Data Types (GADTs), found in Haskell and OCaml, provide a limited form of dependent types. A GADT constructor can refine the type index:

```haskell
data Expr (a :: *) where
  LitInt  :: Int -> Expr Int
  LitBool :: Bool -> Expr Bool
  Add     :: Expr Int -> Expr Int -> Expr Int
  If      :: Expr Bool -> Expr a -> Expr a -> Expr a
```

The key limitation: GADT indices are types, not values. We cannot write `Vec n` where `n` is a runtime integer. The indices must be compile-time type-level entities. This restricts what invariants can be expressed compared to full dependent types.

**What GADTs can express:**

- Type-safe expression evaluation (as above).
- Length-indexed vectors (using type-level naturals: `Z`, `S Z`, `S (S Z)`, ...).
- Red-black tree invariants at the type level.

**What GADTs cannot express (but dependent types can):**

- Types indexed by *runtime* values (e.g., a vector whose length is read from input).
- Arbitrary computation in type indices (e.g., $\text{Vec}(A, \text{fib}(n))$ where $\text{fib}$ is the Fibonacci function).
- Proofs of properties about runtime values.

### 9.6 Dependent Types in Practice: Idris

Idris (Brady, 2013) is designed as a practical programming language with full dependent types. It demonstrates that dependent types can be used for everyday programming, not just theorem proving.

**Example 9.3 (Idris).** A type-safe `printf` in Idris:

```idris
data Format = FInt Format | FString Format | FLit Char Format | FEnd

PrintfType : Format -> Type
PrintfType (FInt rest)    = Int -> PrintfType rest
PrintfType (FString rest) = String -> PrintfType rest
PrintfType (FLit _ rest)  = PrintfType rest
PrintfType FEnd           = String

printf : (fmt : Format) -> PrintfType fmt
```

The function `PrintfType` is a large elimination: it case-splits on a format descriptor (a value) and returns a type. The resulting function `printf` has a type that varies with the format string. This is a Pi type in action: $\text{printf} : \Pi(\text{fmt} : \text{Format}).\, \text{PrintfType}(\text{fmt})$.

### 9.7 Dependent Interleaving: Pattern Matching and Case Trees

In full dependently typed languages, pattern matching must account for the way matching on one argument refines the types of other arguments. This is called **dependent pattern matching**.

**Example 9.4.** Consider the `zip` function on vectors:

$$\text{zip} : \Pi(A\, B : \mathcal{U}).\, \Pi(n : \text{Nat}).\, \text{Vec}(A, n) \to \text{Vec}(B, n) \to \text{Vec}(A \times B, n)$$

When we match on the first vector and find `nil`, we know $n = 0$, which forces the second vector to also be `nil`. When we find `cons(a, v)`, we know $n = \text{succ}(k)$, forcing the second vector to be `cons(b, w)`. The type system tracks these refinements.

The compilation of dependent pattern matching into case trees, and the verification that all cases are covered and well-typed, is a significant engineering challenge. The algorithms of Coquand (1992), McBride (2000), and Goguen, McBride, and McKinna (2006) address this problem.

**The "with" abstraction.** In Agda and Idris, the `with` construct allows pattern matching on intermediate results:

```agda
filter : {A : Set} -> (A -> Bool) -> Vec A n -> (m : Nat ** Vec A m)
filter p [] = (0 ** [])
filter p (x :: xs) with p x
  ... | true  = let (m ** ys) = filter p xs in (S m ** x :: ys)
  ... | false = filter p xs
```

Here the `with` clause introduces a new pattern match whose result type depends on the matched value. This is a form of dependent elimination that goes beyond simple case analysis.

---

## 10. Semantics of Pi Types

### 10.1 Set-Theoretic Semantics

In the simplest model, a type $A$ is interpreted as a set $\lbrack\!\lbrack A \rbrack\!\rbrack$, and a type family $B : A \to \mathcal{U}$ is interpreted as a function $\lbrack\!\lbrack B \rbrack\!\rbrack : \lbrack\!\lbrack A \rbrack\!\rbrack \to \text{Set}$. The Pi type is then:

$$\lbrack\!\lbrack \Pi(x : A).\, B(x) \rbrack\!\rbrack = \prod_{a \in \lbrack\!\lbrack A \rbrack\!\rbrack} \lbrack\!\lbrack B(a) \rbrack\!\rbrack$$

That is, the set of *dependent functions*: functions $f$ that assign to each $a \in \lbrack\!\lbrack A \rbrack\!\rbrack$ an element $f(a) \in \lbrack\!\lbrack B(a) \rbrack\!\rbrack$. When $\lbrack\!\lbrack B(a) \rbrack\!\rbrack$ is the same set for all $a$, this reduces to the ordinary function set $\lbrack\!\lbrack A \rbrack\!\rbrack \to \lbrack\!\lbrack B \rbrack\!\rbrack$.

### 10.2 Category-Theoretic Semantics

In the categorical semantics (locally cartesian closed categories), a type family $B$ over $A$ is a morphism $p : B \to A$ in the ambient category. The Pi type is then the **right adjoint to pullback** along $p$:

$$\Pi_p \dashv p^*$$

Concretely, for a morphism $f : A \to C$, the dependent product $\Pi_f(B)$ is the object of sections of the pullback $f^*(B)$. This generalizes the exponential object $B^A$ (which is $\Pi$ for the trivial fibration $A \times B \to A$).

The categorical semantics provides:

- **Soundness:** Every theorem of dependent type theory holds in every locally cartesian closed category.
- **Completeness:** The category of contexts and substitutions of a dependent type theory forms a locally cartesian closed category (the "classifying category" or "syntactic category").
- **Models:** Presheaf categories, sheaf categories, and the category of sets all provide models.

### 10.3 Domain-Theoretic Semantics

For dependently typed languages with general recursion (or partial functions), we need a domain-theoretic semantics. Types are interpreted as domains (dcpos with bottom), and dependent function types are interpreted as continuous function spaces:

$$\lbrack\!\lbrack \Pi(x : A).\, B(x) \rbrack\!\rbrack = \prod^{\text{cont}}_{a \in \lbrack\!\lbrack A \rbrack\!\rbrack} \lbrack\!\lbrack B(a) \rbrack\!\rbrack$$

where the product is taken in the category of domains. The main technical difficulty is that the fibration $\lbrack\!\lbrack B \rbrack\!\rbrack$ must be continuous in $a$, which requires the family $B$ to vary "continuously" (in the domain-theoretic sense) with its index.

---

## 11. Relationship to Logic

### 11.1 Pi Types and Universal Quantification

Under the Curry-Howard correspondence, the Pi type corresponds to the universal quantifier of predicate logic:

$$\Pi(x : A).\, B(x) \quad \longleftrightarrow \quad \forall x \in A.\; B(x)$$

A proof of $\forall x \in A.\; B(x)$ is a function that, given any $a \in A$, produces a proof of $B(a)$. This is exactly a term of type $\Pi(x : A).\, B(x)$.

| Logic | Type Theory |
|---|---|
| $\forall x \in A.\; B(x)$ | $\Pi(x : A).\, B(x)$ |
| Proof of $\forall x.\; B(x)$ | Term $f : \Pi(x : A).\, B(x)$ |
| Specializing to $a$ | Application $f(a) : B(a)$ |
| Universal introduction | Lambda abstraction |
| Universal elimination | Function application |

**Example 10.1.** The logical statement "for every natural number $n$, $n + 0 = n$" translates to:

$$\Pi(n : \text{Nat}).\, \text{Id}_{\text{Nat}}(n + 0, n)$$

A proof of this is a function that takes $n : \text{Nat}$ and returns a proof (a term of the identity type) that $n + 0 = n$. In Agda:

```
+-right-identity : (n : Nat) -> n + 0 == n
+-right-identity zero    = refl
+-right-identity (suc n) = cong suc (+-right-identity n)
```

### 11.2 Constructive Mathematics

The Curry-Howard interpretation of Pi types as universal quantification is inherently **constructive**: a proof of $\forall x.\; B(x)$ must provide an explicit witness $f(a)$ for every $a$. There is no way to prove a universally quantified statement "by contradiction" without additional axioms.

This constructive character is a feature for program extraction: from a proof of $\forall x.\; \exists y.\; P(x, y)$ (formalized as $\Pi(x : A).\, \Sigma(y : B).\, P(x, y)$), we can extract a computable function $f : A \to B$ such that $P(x, f(x))$ holds for all $x$.

### 11.3 Dependent Elimination as Induction

The connection between Pi types and logic goes deeper when we consider eliminators for inductive types. The eliminator for $\text{Nat}$ has the type:

$$\text{Nat-elim} : \Pi(C : \text{Nat} \to \mathcal{U}).\, C(0) \to (\Pi(k : \text{Nat}).\, C(k) \to C(\text{succ}(k))) \to \Pi(n : \text{Nat}).\, C(n)$$

Under the propositions-as-types reading, this is exactly the **principle of mathematical induction**:

$$\frac{P(0) \qquad \forall k.\, (P(k) \Rightarrow P(\text{succ}(k)))}{\forall n.\, P(n)}$$

The motive $C : \text{Nat} \to \mathcal{U}$ is the property to be proved. The base case is $C(0)$. The inductive step is $\Pi(k : \text{Nat}).\, C(k) \to C(\text{succ}(k))$. The conclusion is $\Pi(n : \text{Nat}).\, C(n)$.

This is a profound observation: the same Pi type that serves as a dependent function type in programming serves as the universal quantifier (and the induction principle) in logic. The duality between programs and proofs is mediated entirely by the Pi type.

### 11.4 The BHK Interpretation

The **Brouwer-Heyting-Kolmogorov (BHK) interpretation** of constructive logic gives meaning to logical connectives in terms of constructions:

- A proof of $P \Rightarrow Q$ is a **construction** (function) that transforms any proof of $P$ into a proof of $Q$.
- A proof of $\forall x \in A.\, P(x)$ is a **construction** (dependent function) that, given any $a \in A$, produces a proof of $P(a)$.

Pi types formalize this interpretation precisely. A term $f : \Pi(x : A).\, P(x)$ is a construction that, given any $a : A$, produces a term $f(a) : P(a)$. The BHK interpretation is not an analogy --- it is literally the typing rule for Pi types.

### 11.5 Dependent Types and Predicate Logic: Formal Encoding

Let us demonstrate how first-order predicate logic is encoded using Pi types (and Sigma types, covered in Lecture 08b).

**Universal quantification:**

$$\forall x \in A.\, P(x) \quad \stackrel{\text{def}}{=} \quad \Pi(x : A).\, P(x)$$

**Implication:**

$$P \Rightarrow Q \quad \stackrel{\text{def}}{=} \quad P \to Q \quad = \quad \Pi(\_ : P).\, Q$$

**Modus ponens** (application):

$$\frac{f : P \to Q \qquad p : P}{f(p) : Q}$$

This is just the Pi-Elim rule.

**Universal introduction** (lambda abstraction):

$$\frac{\Gamma, x : A \vdash p(x) : P(x)}{\Gamma \vdash \lambda(x : A).\, p(x) : \Pi(x : A).\, P(x)}$$

This is just Pi-Intro.

**Universal elimination** (specialization):

$$\frac{f : \Pi(x : A).\, P(x) \qquad a : A}{f(a) : P(a)}$$

This is just Pi-Elim again.

The encoding is not a translation or an embedding --- it is an *identity*. The rules of predicate logic *are* the typing rules for Pi types.

---

## 12. Extended Formal Development

### 12.1 The Strengthening Lemma

**Lemma 12.1 (Strengthening).** *If $\Gamma, x : A, \Delta \vdash t : C$ and $x \notin \text{FV}(t) \cup \text{FV}(C) \cup \text{FV}(\Delta)$, then $\Gamma, \Delta \vdash t : C$.*

*Proof.* By induction on the derivation of $\Gamma, x : A, \Delta \vdash t : C$.

- **Variable:** If $t = y$ for some $y \neq x$, then $(y : C) \in \Gamma, \Delta$ (since $x \notin \text{FV}(\Delta)$ and $y \neq x$), so $\Gamma, \Delta \vdash y : C$.
- **Lambda:** If $t = \lambda(y : B).\, b$ and $C = \Pi(y : B).\, D$, then by induction on $b$ (noting $x \notin \text{FV}(B)$ since $x \notin \text{FV}(C)$ and $B$ appears in $C$), we get $\Gamma, \Delta, y : B \vdash b : D$, hence $\Gamma, \Delta \vdash \lambda(y : B).\, b : \Pi(y : B).\, D$.
- **Application:** Similar, applying induction to both subterms. $\square$

Strengthening is crucial for the metatheory: it ensures that unused hypotheses can be dropped from the context.

### 12.2 Context Morphisms and Substitution

A **context morphism** $\sigma : \Delta \to \Gamma$ is a substitution that maps each variable in $\Gamma$ to a term well-typed in $\Delta$:

$$\sigma = [x_1 \mapsto t_1, \ldots, x_n \mapsto t_n]$$

where $\Delta \vdash t_i : A_i[\sigma]$ for each $(x_i : A_i) \in \Gamma$.

The composition of context morphisms corresponds to the composition of substitutions, and the identity context morphism maps each variable to itself.

**Proposition 12.2 (Functoriality of Substitution).** *Substitution is functorial:*

1. *$t[\text{id}] = t$ for all $t$.*
2. *$t[\sigma][\tau] = t[\sigma \circ \tau]$ for all $t, \sigma, \tau$.*

*Proof.* By induction on the structure of $t$, using the definition of substitution on each syntactic form. The Pi and lambda cases require care with variable binding (using the standard Barendregt convention or de Bruijn indices). $\square$

### 12.3 Confluence

**Theorem 12.3 (Confluence / Church-Rosser).** *The beta-reduction relation $\longrightarrow_\beta$ on dependently typed terms is confluent: if $t \longrightarrow^* u$ and $t \longrightarrow^* v$, then there exists $w$ such that $u \longrightarrow^* w$ and $v \longrightarrow^* w$.*

*Proof sketch.* The proof follows the same structure as for the simply typed or untyped lambda calculus, using Tait and Martin-Lof's parallel reduction technique.

1. Define **parallel reduction** $\Longrightarrow$: reduce all redexes simultaneously.
2. Show $\Longrightarrow$ satisfies the diamond property: if $t \Longrightarrow u$ and $t \Longrightarrow v$, then there exists $w$ with $u \Longrightarrow w$ and $v \Longrightarrow w$.
3. Show $\longrightarrow_\beta \;\subseteq\; \Longrightarrow \;\subseteq\; \longrightarrow_\beta^*$.
4. Conclude confluence of $\longrightarrow_\beta^*$ from the diamond property of $\Longrightarrow$.

The only additional complication for dependent types is that reduction can occur in type annotations (e.g., in $\lambda(x : A).\, b$, the type $A$ can also be reduced). The parallel reduction must therefore reduce subterms in all positions simultaneously. $\square$

**Corollary 12.4.** *If a well-typed term has a normal form, it is unique (up to alpha-equivalence).*

### 12.4 Decidability of Conversion (Detailed)

We now give a more detailed account of why conversion is decidable for strongly normalizing systems.

**Algorithm.** Given two terms $a$ and $b$ in context $\Gamma$:

1. Compute $\text{whnf}(a) = a'$ and $\text{whnf}(b) = b'$.
2. Compare $a'$ and $b'$ at the top level:
   - If both are the same variable $x$: return true.
   - If both are $\Pi(x : A_1).\, B_1$ and $\Pi(x : A_2).\, B_2$: recursively check $A_1 \equiv A_2$ and $B_1 \equiv B_2$.
   - If both are $\lambda(x : A_1).\, b_1$ and $\lambda(x : A_2).\, b_2$: recursively check $A_1 \equiv A_2$ and $b_1 \equiv b_2$.
   - If one is $\lambda(x : A).\, b$ and the other is a neutral term $f$: compare $b$ with $f(x)$ (eta expansion).
   - If both are applications $f_1(a_1)$ and $f_2(a_2)$: recursively check $f_1 \equiv f_2$ and $a_1 \equiv a_2$.
   - Otherwise: return false.

**Termination argument.** Each recursive call is on strictly smaller terms (smaller in the well-founded ordering given by the normalization relation). Since all well-typed terms are strongly normalizing, `whnf` always terminates. The structural recursion on the WHNF terms also terminates because WHNF terms have a finite structure.

**Completeness argument.** If $a \equiv b$ (i.e., $a$ and $b$ have the same normal form), then the algorithm will find this by reducing both to WHNF and comparing structurally, potentially forcing further reduction as needed. This relies on confluence: since normal forms are unique, any two reduction strategies will converge.

---

## 13. Exercises

### Exercise 13.1

Define a type $\text{Fin}(n)$ of natural numbers less than $n$, and write a safe lookup function:

$$\text{lookup} : \Pi(A : \mathcal{U}).\, \Pi(n : \text{Nat}).\, \text{Vec}(A, n) \to \text{Fin}(n) \to A$$

### Exercise 13.2

Prove that $\text{append}$ is associative: for all $l, m, n : \text{Nat}$ and appropriate vectors $u, v, w$:

$$\text{Id}(\text{append}(\text{append}(u, v), w),\; \text{append}(u, \text{append}(v, w)))$$

Identify where you need the associativity of addition $l + (m + n) = (l + m) + n$ and the `transport` function.

### Exercise 13.3

Define the type of $n$-tuples $\text{Tuple}(n)$ where the $i$-th component has type $A_i$, given a type family $A : \text{Fin}(n) \to \mathcal{U}$:

$$\text{Tuple}(A) \;\stackrel{\text{def}}{=}\; \Pi(i : \text{Fin}(n)).\, A(i)$$

Show that this is equivalent to the iterated product $A(0) \times A(1) \times \cdots \times A(n-1)$.

### Exercise 13.4

Show that if $A : \mathcal{U}$ and $B : A \to \mathcal{U}$ with $B(a)$ inhabited for all $a : A$, then there is a section of the projection $\pi_1 : \Sigma(x : A).\, B(x) \to A$. State this formally and construct the proof term.

### Exercise 13.5

Explain why the following definition is not well-typed in a system with only Pi types (no universes):

$$f : \Pi(A : ?).\, A \to A$$

What role does the universe $\mathcal{U}$ play in making this well-typed? What is the relationship between $\mathcal{U}$ and the System F quantifier $\forall \alpha.\, \alpha \to \alpha$?

### Exercise 13.6

Consider the function:

$$\text{applyN} : \Pi(n : \text{Nat}).\, \Pi(A : \mathcal{U}).\, (A \to A) \to A \to A$$

$$\text{applyN}(0, A, f, x) = x$$

$$\text{applyN}(\text{succ}(n), A, f, x) = f(\text{applyN}(n, A, f, x))$$

Write this using $\text{Nat-elim}$ and verify that $\text{applyN}(3, \text{Nat}, \text{succ}, 0) \equiv 3$.

### Exercise 13.7

Show that the swap function on non-dependent pairs:

$$\text{swap} : \Pi(A\, B : \mathcal{U}).\, A \times B \to B \times A$$

is an involution: $\text{swap}(\text{swap}(p)) \equiv p$ for all $p : A \times B$ (assuming eta for pairs). Then state and prove the analogous result for dependent pairs, explaining what additional complications arise.

### Exercise 13.8

Define the type of decidable propositions:

$$\text{Dec}(P) \;\stackrel{\text{def}}{=}\; P + \neg P$$

Prove that $\text{Dec}$ is closed under conjunction:

$$\text{Dec}(P) \to \text{Dec}(Q) \to \text{Dec}(P \times Q)$$

Write out the proof term (case analysis on both decision procedures) and identify all four cases.

### Exercise 13.9

In a dependently typed language with Pi types and a universe $\mathcal{U}$, define a type of **heterogeneous lists** where each element can have a different type. The type signature should be:

$$\text{HList} : \text{List}(\mathcal{U}) \to \mathcal{U}$$

$$\text{HList}([]) = \mathbf{1}$$

$$\text{HList}(A :: \text{ts}) = A \times \text{HList}(\text{ts})$$

Give the types of $\text{hnil}$ and $\text{hcons}$ and construct example terms.

---

## Summary

- **Pi types** $\Pi(x : A).\, B(x)$ generalize function types to allow the return type to depend on the argument value. They are the dependent function types.
- When $B$ does not depend on $x$, the Pi type degenerates to the ordinary arrow type $A \to B$.
- The **formation**, **introduction** (lambda), **elimination** (application), and **computation** (beta) rules extend those of the STLC in a natural way, with the crucial addition that types may mention term variables.
- The **conversion rule** allows terms to be used at definitionally equal types, making type checking depend on deciding type equality.
- **Definitional equality** is decided by normalization: reduce both types to normal form and compare syntactically.
- Type checking becomes **undecidable** if the term language allows non-terminating computation, because normalization may not terminate.
- Pi types enable powerful invariants: **length-indexed vectors**, **dimension-checked matrices**, **type-safe printf**, and **$n$-ary function types** computed by recursion.
- Under the **Curry-Howard correspondence**, Pi types correspond to **universal quantification** in constructive predicate logic.
- The **phase distinction** between types and terms blurs: the type checker must evaluate terms, and types are first-class entities.

---

## Further Reading

1. **Martin-Lof, P.** (1984). *Intuitionistic Type Theory*. Bibliopolis. The original monograph introducing dependent types in full generality.

2. **Coquand, T. and Huet, G.** (1988). "The Calculus of Constructions." *Information and Computation*, 76(2-3):95--120. Introduces the Calculus of Constructions, combining dependent types with polymorphism.

3. **Bove, A. and Dybjer, P.** (2009). "Dependent Types at Work." In *Language Engineering and Rigorous Software Development*, LNCS 5520. An accessible introduction to programming with dependent types.

4. **Norell, U.** (2009). "Dependently Typed Programming in Agda." In *Advanced Functional Programming*, LNCS 5832. A practical introduction to Agda, a prominent dependently typed language.

5. **Brady, E.** (2013). "Idris, a General-Purpose Dependently Typed Programming Language: Design and Implementation." *Journal of Functional Programming*, 23(5):552--593.

6. **Abel, A.** (2008). "Normalization by Evaluation for Martin-Lof Type Theory with One Universe." In *Proceedings of MFPS XXIV*.

7. **Atkey, R.** (2018). "Syntax and Semantics of Quantitative Type Theory." In *LICS 2018*. Formalizes the notion of computational irrelevance in dependent types.

8. **Pierce, B. C.** (2002). *Types and Programming Languages*. MIT Press. Chapter 30 covers the basics of dependent types.

9. **The Univalent Foundations Program.** (2013). *Homotopy Type Theory: Univalent Foundations of Mathematics*. Chapter 1 provides a modern treatment of Pi types.

10. **de Bruijn, N. G.** (1970). "The Mathematical Language AUTOMATH, Its Usage, and Some of Its Extensions." In *Symposium on Automatic Demonstration*, LNCS 125. The earliest system with dependent types.
