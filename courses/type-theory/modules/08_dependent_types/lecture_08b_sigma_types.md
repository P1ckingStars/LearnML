---
title: "Lecture 08b: Dependent Pair Types (Sigma Types)"
tags:
  - type-theory
  - dependent-types
  - lecture
---
# Lecture 08b: Dependent Pair Types (Sigma Types)

> **Module 08 --- Dependent Types (Weeks 15--16)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the Sigma type $\Sigma(x : A).\, B(x)$ precisely, stating its formation, introduction, elimination, and computation rules.
2. **Prove** that the ordinary product type $A \times B$ is a degenerate case of $\Sigma(x : A).\, B(x)$ when $B$ does not depend on $x$.
3. **Explain** the connection between Sigma types and existential quantification under the Curry-Howard correspondence.
4. **Construct** Sigma types that encode specifications, refinement types, and subset types.
5. **Derive** the typing of dependent projections and explain why the second projection of a Sigma type has a dependent type.
6. **Encode** records and structures as iterated Sigma types.
7. **Implement** safe array access using Sigma types with dependent index bounds.
8. **Contrast** Sigma types with existential types in System F and explain the additional power that dependency provides.

---

## 1. Motivation

### 1.1 Beyond Simple Pairs

In the simply typed lambda calculus, the product type $A \times B$ represents pairs $(a, b)$ where $a : A$ and $b : B$. The types of the two components are independent. But many natural data structures involve pairs where the type of the second component depends on the value of the first.

**Example 1.1 (Dependent records).** Consider a record type for matrices:

```
{ rows : Nat, cols : Nat, data : Vec(Vec(Float, cols), rows) }
```

The type of the `data` field depends on the *values* of the `rows` and `cols` fields. This cannot be expressed as a simple product type.

**Example 1.2 (Existential witness).** The statement "there exists a natural number that is prime" should be formalized as a pair: a natural number $n$ together with a proof that $n$ is prime. The type of the proof depends on which number $n$ is chosen:

$$\text{(witness, proof)} \quad \text{where} \quad \text{proof} : \text{isPrime}(\text{witness})$$

The type of the second component ($\text{isPrime}(\text{witness})$) depends on the *value* of the first component.

### 1.2 The Fundamental Asymmetry

In a simple product $A \times B$, both projections are straightforward:

$$\pi_1 : A \times B \to A \qquad \pi_2 : A \times B \to B$$

In a dependent pair $\Sigma(x : A).\, B(x)$, the first projection is still simple:

$$\pi_1 : \Sigma(x : A).\, B(x) \to A$$

But the second projection cannot have the simple type $\Sigma(x : A).\, B(x) \to B(?)$, because $B$ is a family --- we need to know *which* $B(x)$ we are projecting into. The second projection must be:

$$\pi_2 : \Pi(p : \Sigma(x : A).\, B(x)).\, B(\pi_1(p))$$

The type of $\pi_2(p)$ depends on the *value* $\pi_1(p)$. This asymmetry between the two projections is the hallmark of dependent pairs.

---

## 2. Core Theory

### 2.1 Definition and Notation

**Definition 2.1 (Sigma Type).** Given a type $A$ and a type family $B : A \to \mathcal{U}$, the **Sigma type** (dependent sum type, dependent pair type) $\Sigma(x : A).\, B(x)$ is the type of pairs $(a, b)$ where $a : A$ and $b : B(a)$.

**Notation.** Various notations appear in the literature:

| Notation | Tradition |
|---|---|
| $\Sigma(x : A).\, B(x)$ | Martin-Lof type theory |
| $(x : A) \times B(x)$ | Some Agda conventions |
| $\exists (x : A),\, B(x)$ | Logical reading |
| $\sum_{x : A} B(x)$ | Categorical / HoTT |

We will primarily use $\Sigma(x : A).\, B(x)$.

**Terminology.** The type $A$ is called the **base type** or **index type**. The family $B$ is called the **fiber** over $A$. For a pair $(a, b) : \Sigma(x : A).\, B(x)$, we call $a$ the **first component** (or **witness**) and $b$ the **second component** (or **evidence**).

### 2.2 Formation Rule

$$\frac{\Gamma \vdash A \; \text{type} \qquad \Gamma, x : A \vdash B(x) \; \text{type}}{\Gamma \vdash \Sigma(x : A).\, B(x) \; \text{type}} \; (\Sigma\text{-Form})$$

**Reading:** If $A$ is a type and $B(x)$ is a type family over $A$ (i.e., $B(x)$ is a type in the context extended with $x : A$), then $\Sigma(x : A).\, B(x)$ is a type.

Note that the formation rule for Sigma types is identical to that for Pi types --- both require a type $A$ and a family $B$ over $A$. They differ in what they construct from this data.

### 2.3 Introduction Rule (Pairing)

$$\frac{\Gamma \vdash a : A \qquad \Gamma \vdash b : B(a)}{\Gamma \vdash (a, b) : \Sigma(x : A).\, B(x)} \; (\Sigma\text{-Intro})$$

**Reading:** Given $a : A$ and $b : B(a)$ (note: $b$'s type depends on $a$'s *value*), the pair $(a, b)$ is an element of $\Sigma(x : A).\, B(x)$.

**Critical observation.** The second component $b$ must have type $B(a)$ --- that is, $B$ applied to the *specific* first component $a$. This is the dependency: we cannot choose $b$ independently of $a$.

**Example 2.2.** Let $A = \text{Nat}$ and $B(n) = \text{Vec}(\text{Float}, n)$. Then:

$$(\,3,\; \text{cons}(1.0, \text{cons}(2.0, \text{cons}(3.0, \text{nil})))\,) \;:\; \Sigma(n : \text{Nat}).\, \text{Vec}(\text{Float}, n)$$

The first component is $3$, and the second component is a vector of length $3$ --- exactly $B(3) = \text{Vec}(\text{Float}, 3)$.

### 2.4 Elimination Rules

There are two approaches to eliminating Sigma types: **projections** and the **dependent eliminator** (induction principle).

#### 2.4.1 Projections

The first projection extracts the first component:

$$\frac{\Gamma \vdash p : \Sigma(x : A).\, B(x)}{\Gamma \vdash \pi_1(p) : A} \; (\Sigma\text{-}\pi_1)$$

The second projection extracts the second component, with a dependent type:

$$\frac{\Gamma \vdash p : \Sigma(x : A).\, B(x)}{\Gamma \vdash \pi_2(p) : B(\pi_1(p))} \; (\Sigma\text{-}\pi_2)$$

**Note the dependency:** The type of $\pi_2(p)$ is $B(\pi_1(p))$, not simply $B(x)$ for some unspecified $x$. The type mentions the *term* $\pi_1(p)$.

#### 2.4.2 Dependent Eliminator (Induction Principle)

The more general elimination form is the dependent eliminator, which subsumes projections:

$$\frac{\begin{array}{c} \Gamma \vdash p : \Sigma(x : A).\, B(x) \\ \Gamma, z : \Sigma(x : A).\, B(x) \vdash C(z) \; \text{type} \\ \Gamma, x : A, y : B(x) \vdash c(x, y) : C((x, y)) \end{array}}{\Gamma \vdash \text{split}(p, c) : C(p)} \; (\Sigma\text{-Elim})$$

**Reading:** To produce a result of type $C(p)$ from a Sigma-typed pair $p$, it suffices to give a function $c$ that handles the case where $p$ is a pair $(x, y)$ with $x : A$ and $y : B(x)$, producing a result of type $C((x, y))$.

This is sometimes written with pattern-matching syntax:

$$\text{let } (x, y) = p \text{ in } c(x, y)$$

### 2.5 Computation Rules

**Beta rules (for projections):**

$$\pi_1(a, b) \equiv a \qquad (\Sigma\text{-}\beta_1)$$

$$\pi_2(a, b) \equiv b \qquad (\Sigma\text{-}\beta_2)$$

**Beta rule (for the eliminator):**

$$\text{split}((a, b), c) \equiv c(a, b) \qquad (\Sigma\text{-}\beta)$$

**Eta rule (uniqueness principle):**

$$p \equiv (\pi_1(p), \pi_2(p)) \quad \text{for } p : \Sigma(x : A).\, B(x) \qquad (\Sigma\text{-}\eta)$$

The eta rule states that every element of a Sigma type is a pair. Together with the beta rules, this characterizes Sigma types up to definitional equality.

**Proposition 2.3.** *The projections are derivable from the dependent eliminator, and conversely, the dependent eliminator is derivable from the projections (assuming the eta rule).*

*Proof.* Forward direction: Define $\pi_1(p) \stackrel{\text{def}}{=} \text{split}(p, \lambda x.\, \lambda y.\, x)$ and $\pi_2(p) \stackrel{\text{def}}{=} \text{split}(p, \lambda x.\, \lambda y.\, y)$. Then:

$$\pi_1(a, b) = \text{split}((a, b), \lambda x.\, \lambda y.\, x) \equiv (\lambda x.\, \lambda y.\, x)(a)(b) \equiv a$$

Similarly for $\pi_2$.

Reverse direction: Given $p : \Sigma(x : A).\, B(x)$ and $c : \Pi(x : A).\, \Pi(y : B(x)).\, C((x, y))$, define:

$$\text{split}(p, c) \stackrel{\text{def}}{=} c(\pi_1(p))(\pi_2(p))$$

By the eta rule, $p \equiv (\pi_1(p), \pi_2(p))$, so $C(p) \equiv C((\pi_1(p), \pi_2(p)))$, and $c(\pi_1(p))(\pi_2(p)) : C((\pi_1(p), \pi_2(p))) \equiv C(p)$. $\square$

### 2.6 The Non-Dependent Case

When the family $B(x)$ does not depend on $x$ --- that is, $B(x) = C$ for all $x : A$ --- the Sigma type degenerates to the ordinary product type:

$$\Sigma(x : A).\, C \;\cong\; A \times C$$

**Proposition 2.4.** *If $x \notin \text{FV}(C)$, then $\Sigma(x : A).\, C$ is definitionally equal to $A \times C$, and the dependent projections specialize to the ordinary projections.*

*Proof.* The introduction rule gives $(a, c)$ where $a : A$ and $c : C$ (since $C$ does not depend on $a$). The first projection gives $\pi_1(a, c) = a : A$. The second projection gives $\pi_2(a, c) = c : C(\pi_1(a, c)) = C$ (since $C$ does not depend on the first component). These are exactly the rules for the ordinary product type. $\square$

---

## 3. Sigma Types and Existential Quantification

### 3.1 The Curry-Howard Correspondence

Under the propositions-as-types interpretation, Sigma types correspond to existential quantification:

$$\Sigma(x : A).\, B(x) \quad \longleftrightarrow \quad \exists x \in A.\; B(x)$$

A proof of "there exists an $x$ in $A$ such that $B(x)$" consists of:

1. A **witness** $a : A$ (the specific $x$ that satisfies $B$).
2. **Evidence** $b : B(a)$ (a proof that $B$ holds for this specific $a$).

This is precisely a dependent pair $(a, b) : \Sigma(x : A).\, B(x)$.

| Logic | Type Theory |
|---|---|
| $\exists x \in A.\; B(x)$ | $\Sigma(x : A).\, B(x)$ |
| Existential witness | First component $\pi_1(p)$ |
| Proof of the property | Second component $\pi_2(p)$ |
| Existential introduction | Pair construction |
| Existential elimination | Dependent elimination / split |

**Example 3.1.** "There exists an even natural number" translates to:

$$\Sigma(n : \text{Nat}).\, \text{isEven}(n)$$

A proof is a pair, e.g., $(4, \text{proof\_that\_4\_is\_even})$.

**Example 3.2.** "There exists a natural number greater than 100 that is prime" translates to:

$$\Sigma(n : \text{Nat}).\, (n > 100) \times \text{isPrime}(n)$$

A proof is a triple (encoded as nested pairs): $(101, (\text{proof\_101\_gt\_100}, \text{proof\_101\_prime}))$.

### 3.2 Constructive Existentials

The Sigma type interpretation of existential quantification is **constructive**: to prove $\exists x.\, B(x)$, one must exhibit a *specific* witness $a$ and a proof of $B(a)$. There is no way to prove an existential statement "by contradiction" without additional axioms.

This has profound implications:

- From a proof $p : \Sigma(x : A).\, B(x)$, we can always extract the witness: $\pi_1(p) : A$.
- Every existential proof carries computational content: the witness is a computable value.
- The principle of "proof-irrelevance" (that any two proofs of the same proposition are equal) fails in general for Sigma types, because different witnesses are different proofs.

### 3.3 Contrast with System F Existentials

In System F (Lecture 06), we encoded existential types as:

$$\exists \alpha.\, T(\alpha) \;\stackrel{\text{def}}{=}\; \forall \beta.\, (\forall \alpha.\, T(\alpha) \to \beta) \to \beta$$

This encoding provides **information hiding**: the client of an existential package cannot inspect the witness type. Sigma types, by contrast, are **transparent**: the witness is directly accessible via $\pi_1$.

| Feature | System F existentials | Sigma types |
|---|---|---|
| Witness accessible? | No (hidden behind $\forall$) | Yes (via $\pi_1$) |
| Witness is a... | Type | Term (value) |
| Dependency | Type depends on type | Type depends on value |
| Use case | Abstract data types | Specifications, proofs |
| Elimination | CPS-style / open | Projection / split |

Sigma types are strictly more expressive: they can encode System F existentials (by quantifying over a universe), but System F existentials cannot encode Sigma types.

---

## 4. Sigma Types as Specifications

### 4.1 Subset Types

A Sigma type $\Sigma(x : A).\, P(x)$ can be read as "the type of elements of $A$ satisfying property $P$." This is the **subset type** or **comprehension type**:

$$\{x : A \mid P(x)\} \;\stackrel{\text{def}}{=}\; \Sigma(x : A).\, P(x)$$

**Example 4.1.** The type of prime numbers:

$$\text{Prime} \;\stackrel{\text{def}}{=}\; \Sigma(n : \text{Nat}).\, \text{isPrime}(n)$$

An element of $\text{Prime}$ is a pair $(n, p)$ where $n$ is a natural number and $p$ is a proof that $n$ is prime.

**Example 4.2.** The type of sorted lists:

$$\text{SortedList}(A) \;\stackrel{\text{def}}{=}\; \Sigma(\ell : \text{List}(A)).\, \text{isSorted}(\ell)$$

### 4.2 Pre/Post-Condition Specifications

We can use Sigma types to express function specifications with preconditions and postconditions. A function satisfying specification $\text{Pre}(x) \Rightarrow \text{Post}(x, y)$ has the type:

$$f : \Pi(x : A).\, \text{Pre}(x) \to \Sigma(y : B).\, \text{Post}(x, y)$$

This reads: "given an input $x : A$ and a proof that the precondition holds, $f$ returns an output $y : B$ together with a proof that the postcondition holds."

**Example 4.3 (Division with remainder).** The specification "given $a : \text{Nat}$ and $b : \text{Nat}$ with $b > 0$, compute quotient $q$ and remainder $r$ such that $a = b \cdot q + r$ and $r < b$":

$$\text{divmod} : \Pi(a : \text{Nat}).\, \Pi(b : \text{Nat}).\, (b > 0) \to \Sigma(q : \text{Nat}).\, \Sigma(r : \text{Nat}).\, (a = b \cdot q + r) \times (r < b)$$

The return type bundles the quotient, the remainder, and proofs of both correctness conditions.

**Example 4.4 (Sorting).** A verified sorting function:

$$\text{sort} : \Pi(\ell : \text{List}(\text{Nat})).\, \Sigma(\ell' : \text{List}(\text{Nat})).\, \text{isSorted}(\ell') \times \text{isPermutation}(\ell, \ell')$$

The output is a list $\ell'$ together with proofs that it is sorted and is a permutation of the input.

### 4.3 Sigma Types for Program Correctness

Sigma types provide a principled way to attach correctness guarantees to programs. The general pattern is:

**Partial correctness:** A function $f$ satisfying a partial correctness specification with precondition $\text{Pre}$ and postcondition $\text{Post}$ has type:

$$f : \Pi(x : A).\, \text{Pre}(x) \to \Sigma(y : B).\, \text{Post}(x, y)$$

**Total correctness:** If we additionally require termination, and the function is defined by structural recursion on a well-founded relation, then the type guarantees total correctness.

**Example 4.5 (Square root).** A specification for integer square root:

$$\text{isqrt} : \Pi(n : \text{Nat}).\, \Sigma(r : \text{Nat}).\, (r \cdot r \leq n) \times (n < (r + 1) \cdot (r + 1))$$

The return type guarantees that $r^2 \leq n < (r+1)^2$, which uniquely characterizes $r$ as $\lfloor \sqrt{n} \rfloor$.

**Example 4.6 (Binary search).** A binary search function with a full correctness specification:

$$\text{bsearch} : \Pi(A : \mathcal{U}).\, \Pi(n : \text{Nat}).\, \Pi(v : \text{Vec}(A, n)).\, \text{Sorted}(v) \to \Pi(x : A).\, \text{Found}(x, v) + \text{NotFound}(x, v)$$

where $\text{Found}(x, v) = \Sigma(i : \text{Fin}(n)).\, \text{Id}_A(\text{index}(v, i), x)$ and $\text{NotFound}(x, v) = \Pi(i : \text{Fin}(n)).\, \neg\,\text{Id}_A(\text{index}(v, i), x)$.

### 4.4 Refinement Types

**Refinement types** are a practical restriction of Sigma types found in languages like Liquid Haskell and F*. A refinement type has the form:

$$\{x : A \mid \phi(x)\}$$

where $\phi$ is a predicate drawn from a decidable logical fragment (typically quantifier-free linear arithmetic, or a theory decidable by an SMT solver). The key difference from full Sigma types:

1. **Predicates are restricted** to a decidable fragment, enabling automatic verification.
2. **Proofs are erased** at runtime --- the refinement exists only for type checking.
3. **No first-class proof terms** --- the programmer does not construct proof objects.

Refinement types offer a practical middle ground: more expressive than simple types, but with better automation than full dependent types.

**Example 4.5.** In Liquid Haskell:

```haskell
{-@ type Pos = {v:Int | v > 0} @-}
{-@ type NonEmpty a = {v:[a] | len v > 0} @-}

{-@ head :: NonEmpty a -> a @-}
head (x:_) = x
```

The refinement type `{v:Int | v > 0}` corresponds to $\Sigma(v : \text{Int}).\, (v > 0)$, but the proof of $v > 0$ is automatically discharged by the SMT solver and erased at runtime.

---

## 5. Records as Iterated Sigma Types

### 5.1 Sigma Types and Dependent Records

In programming languages, records (or structs) are fundamental data structures. Sigma types provide the type-theoretic foundation for records, with the crucial addition that later fields can depend on the values of earlier fields.

### 5.2 Binary to N-ary

A Sigma type is a dependent pair --- a record with two fields where the second field's type depends on the first. We can build records with more fields by iterating:

**Two fields** (basic Sigma type):

$$\Sigma(x_1 : A_1).\, A_2(x_1)$$

**Three fields:**

$$\Sigma(x_1 : A_1).\, \Sigma(x_2 : A_2(x_1)).\, A_3(x_1, x_2)$$

**N fields:**

$$\Sigma(x_1 : A_1).\, \Sigma(x_2 : A_2(x_1)).\, \cdots\, \Sigma(x_{n-1} : A_{n-1}(x_1, \ldots, x_{n-2})).\, A_n(x_1, \ldots, x_{n-1})$$

Each subsequent field's type can depend on *all* previous fields' values.

### 5.3 Example: Non-Dependent Records as Iterated Products

When no field type depends on previous fields, the iterated Sigma type reduces to an iterated product. For example, a 2D point:

$$\text{Point2D} \;\stackrel{\text{def}}{=}\; \Sigma(x : \text{Float}).\, \text{Float} \;\cong\; \text{Float} \times \text{Float}$$

A 3D point:

$$\text{Point3D} \;\stackrel{\text{def}}{=}\; \Sigma(x : \text{Float}).\, \Sigma(y : \text{Float}).\, \text{Float} \;\cong\; \text{Float} \times \text{Float} \times \text{Float}$$

These are ordinary (non-dependent) records.

### 5.4 Example: Dependent Record for Matrices

The type of matrices with their dimensions:

$$\text{Matrix}(A) \;\stackrel{\text{def}}{=}\; \Sigma(m : \text{Nat}).\, \Sigma(n : \text{Nat}).\, \text{Vec}(\text{Vec}(A, n), m)$$

An element is a triple $(m, n, \text{data})$ where $\text{data}$ is an $m \times n$ array. The type of $\text{data}$ depends on both $m$ and $n$.

**Projections:**

$$\text{rows}(M) \stackrel{\text{def}}{=} \pi_1(M) : \text{Nat}$$

$$\text{cols}(M) \stackrel{\text{def}}{=} \pi_1(\pi_2(M)) : \text{Nat}$$

$$\text{data}(M) \stackrel{\text{def}}{=} \pi_2(\pi_2(M)) : \text{Vec}(\text{Vec}(A, \text{cols}(M)), \text{rows}(M))$$

### 5.5 Telescopes

The pattern of iterated Sigma types is formalized as a **telescope** (de Bruijn 1991).

**Definition 5.1 (Telescope).** A telescope is a sequence of typed variable bindings where each type may depend on previous variables:

$$(x_1 : A_1, \; x_2 : A_2(x_1), \; x_3 : A_3(x_1, x_2), \; \ldots, \; x_n : A_n(x_1, \ldots, x_{n-1}))$$

A telescope can be collapsed into a single Sigma type (as above) or used as a context for dependent type theory.

Telescopes arise naturally in:

- **Module signatures** in dependently typed languages.
- **Contexts** in type theory ($\Gamma = x_1 : A_1, x_2 : A_2(x_1), \ldots$).
- **Generalized algebraic data types** (GADTs), where constructor arguments form telescopes.

---

## 6. Worked Examples

### 6.1 Safe Array Access

We use Sigma types to ensure array accesses are always within bounds.

**Definition 6.1 (Bounded natural number).** The type of natural numbers less than $n$:

$$\text{Fin}(n) \;\stackrel{\text{def}}{=}\; \Sigma(k : \text{Nat}).\, (k < n)$$

An element of $\text{Fin}(n)$ is a natural number $k$ together with a proof that $k < n$.

**Safe indexing.** Given a vector of length $n$, indexing by $\text{Fin}(n)$ is always safe:

$$\text{index} : \Pi(A : \mathcal{U}).\, \Pi(n : \text{Nat}).\, \text{Vec}(A, n) \to \text{Fin}(n) \to A$$

The function $\text{index}$ takes a vector and a bounded index and returns an element. There is no possibility of an out-of-bounds access --- the type system prevents it.

**Implementation sketch (by induction):**

$$\text{index}(A, \text{succ}(n), \text{cons}(a, v), (0, p)) \stackrel{\text{def}}{=} a$$

$$\text{index}(A, \text{succ}(n), \text{cons}(a, v), (\text{succ}(k), p)) \stackrel{\text{def}}{=} \text{index}(A, n, v, (k, p'))$$

where $p' : k < n$ is derived from $p : \text{succ}(k) < \text{succ}(n)$.

The case $\text{index}(A, 0, \text{nil}, i)$ is vacuously handled: there is no element of $\text{Fin}(0)$, so this case never arises.

### 6.2 Existential Type for Abstract Data Types

We can use Sigma types to model abstract data types (ADTs) with hidden representation:

$$\text{Stack}(A) \;\stackrel{\text{def}}{=}\; \Sigma(S : \mathcal{U}).\, S \times (S \to A \to S) \times (S \to \text{Maybe}(A \times S))$$

An element of $\text{Stack}(A)$ is a tuple $(S, \text{empty}, \text{push}, \text{pop})$ where:

- $S$ is the (existentially hidden) representation type.
- $\text{empty} : S$ is the empty stack.
- $\text{push} : S \to A \to S$ pushes an element.
- $\text{pop} : S \to \text{Maybe}(A \times S)$ pops an element if the stack is non-empty.

**Example implementation using lists:**

$$(\ \text{List}(A),\; [],\; \lambda s.\, \lambda a.\, a :: s,\; \lambda s.\, \text{match } s \text{ with } [] \Rightarrow \text{Nothing} \mid a :: s' \Rightarrow \text{Just}(a, s')\ )$$

This is an element of $\text{Stack}(A)$ with representation type $S = \text{List}(A)$.

### 6.3 The Type of Proofs of Equality

The **identity type** $\text{Id}_A(a, b)$ (studied in detail in Lecture 08c) can be used with Sigma types to express "the type of elements of $A$ equal to a given $a$":

$$\text{Singleton}(A, a) \;\stackrel{\text{def}}{=}\; \Sigma(x : A).\, \text{Id}_A(a, x)$$

**Proposition 6.1.** *The type $\text{Singleton}(A, a)$ is contractible --- it has exactly one element (up to propositional equality), namely $(a, \text{refl}_a)$.*

*Proof sketch.* Any element of $\text{Singleton}(A, a)$ is of the form $(x, p)$ where $p : \text{Id}_A(a, x)$. By the J-elimination rule for identity types, we can transport along $p$ to show $(x, p) = (a, \text{refl}_a)$. $\square$

This is the **eta rule for identity types** and plays a fundamental role in homotopy type theory.

### 6.4 Image of a Function

The **image** (or fiber) of a function $f : A \to B$ over a point $b : B$ is:

$$\text{fib}(f, b) \;\stackrel{\text{def}}{=}\; \Sigma(a : A).\, \text{Id}_B(f(a), b)$$

An element of $\text{fib}(f, b)$ is a pair $(a, p)$ where $a : A$ and $p$ is a proof that $f(a) = b$. This is "an element of $A$ that maps to $b$ under $f$."

The total image of $f$ is:

$$\text{Im}(f) \;\stackrel{\text{def}}{=}\; \Sigma(b : B).\, \text{fib}(f, b) \;\cong\; \Sigma(b : B).\, \Sigma(a : A).\, \text{Id}_B(f(a), b)$$

---

## 7. Formal Properties

### 7.1 Substitution and Subject Reduction

The substitution lemma and subject reduction theorem for Sigma types follow the same pattern as for Pi types.

**Lemma 7.1 (Substitution).** *If $\Gamma, x : A, \Delta \vdash (a, b) : \Sigma(y : B).\, C(y)$ and $\Gamma \vdash s : A$, then $\Gamma, \Delta[s/x] \vdash (a[s/x], b[s/x]) : \Sigma(y : B[s/x]).\, C[s/x](y)$.*

*Proof.* By induction on the typing derivation, applying the substitution lemma for the constituent types. $\square$

### 7.2 Inversion Lemma

**Lemma 7.2 (Inversion for Sigma).** *If $\Gamma \vdash (a, b) : \Sigma(x : A).\, B(x)$, then $\Gamma \vdash a : A$ and $\Gamma \vdash b : B(a)$.*

*Proof.* By inspection of the typing rules: the only rule that gives a pair a Sigma type is $\Sigma$-Intro, which requires exactly these premises. $\square$

### 7.3 Relationship Between Pi and Sigma

Pi and Sigma types are dual in a precise sense, analogous to the duality between universal and existential quantification, or between function types and product types.

**Proposition 7.3 (Distributivity).** *Pi distributes over Sigma: there is a canonical isomorphism*

$$\Pi(x : A).\, \Sigma(y : B(x)).\, C(x, y) \;\cong\; \Sigma(f : \Pi(x : A).\, B(x)).\, \Pi(x : A).\, C(x, f(x))$$

*Proof.* We construct maps in both directions:

Forward: Given $g : \Pi(x : A).\, \Sigma(y : B(x)).\, C(x, y)$, define $f(x) \stackrel{\text{def}}{=} \pi_1(g(x))$ and $h(x) \stackrel{\text{def}}{=} \pi_2(g(x))$. Then $f : \Pi(x : A).\, B(x)$ and $h : \Pi(x : A).\, C(x, f(x))$, giving $(f, h)$ on the right.

Backward: Given $(f, h)$ on the right, define $g(x) \stackrel{\text{def}}{=} (f(x), h(x))$. Then $g(x) : \Sigma(y : B(x)).\, C(x, y)$ since $f(x) : B(x)$ and $h(x) : C(x, f(x))$.

The two maps are inverse by the beta and eta rules. $\square$

This is the type-theoretic version of the axiom of choice. In constructive mathematics, this equivalence is provable --- it is the **type-theoretic axiom of choice** (Martin-Lof 1984). This is sometimes surprising: the axiom of choice, which is independent of ZFC, is a *theorem* in Martin-Lof type theory. The resolution is that the type-theoretic version requires *functions* (which are constructive) rather than *arbitrary selections* (which may be non-constructive).

### 7.4 Coproducts and Sigma Types

Sigma types over a finite type yield coproducts. If $A = \text{Bool}$ and $B(\text{true}) = C_1$, $B(\text{false}) = C_2$, then:

$$\Sigma(x : \text{Bool}).\, B(x) \;\cong\; C_1 + C_2$$

More generally, if $A$ is a finite type with $n$ elements $a_1, \ldots, a_n$, then:

$$\Sigma(x : A).\, B(x) \;\cong\; B(a_1) + B(a_2) + \cdots + B(a_n)$$

This justifies the name "dependent *sum*" --- the Sigma type is a sum indexed by the elements of $A$. Dually, the Pi type is a "dependent *product*":

$$\Pi(x : A).\, B(x) \;\cong\; B(a_1) \times B(a_2) \times \cdots \times B(a_n)$$

**Proposition 7.4.** *If $A = \text{Fin}(n)$, then $\Sigma(x : A).\, B(x) \cong B(0) + B(1) + \cdots + B(n-1)$ and $\Pi(x : A).\, B(x) \cong B(0) \times B(1) \times \cdots \times B(n-1)$.*

This is the origin of the notation $\sum$ and $\prod$ for Sigma and Pi types.

---

## 8. Advanced Topics

### 8.1 Dependent Pairs in Practice: Proof-Carrying Code

The idea of **proof-carrying code** (Necula 1997) is intimately connected to Sigma types. A function that returns a Sigma type is returning not just a result but also a proof of its correctness. When the proof is erased at runtime, we are left with an efficient program that has been verified at compile time.

**Example 8.0 (Certified compiler).** A certified compiler pass has the type:

$$\text{optimize} : \Pi(\text{prog} : \text{Program}).\, \Sigma(\text{prog}' : \text{Program}).\, \text{Equiv}(\text{prog}, \text{prog}')$$

The output is an optimized program $\text{prog}'$ together with a proof that it is equivalent to the input. After extraction, the proof is erased, and we are left with an optimized program --- but we know it is correct because the type checker verified the proof.

This pattern is used in the CompCert project (Leroy 2009), which is a fully verified optimizing C compiler written in Coq. Each compiler pass is a function of this form, and the composition of all passes yields a fully verified end-to-end compiler.

### 8.2 Positive vs. Negative Sigma Types

Like other type formers, Sigma types can be given either a **positive** (introduction-focused) or **negative** (elimination-focused) presentation.

**Positive presentation:** The canonical form is the pair $(a, b)$. Elimination is by pattern matching (the `split` eliminator). This is the standard in Martin-Lof type theory.

**Negative presentation:** The canonical observations are the projections $\pi_1$ and $\pi_2$. Introduction is by specifying both projections (copatterns). This is dual to the positive presentation.

In the positive presentation, the eta rule ($p \equiv (\pi_1(p), \pi_2(p))$) is an *admissible* property. In the negative presentation, it is built into the definition.

The choice between positive and negative affects:

- **Confluence:** The positive presentation has better confluence properties.
- **Commuting conversions:** The positive presentation requires commuting conversions when the eliminator appears in the context of another eliminator.
- **Evaluation strategy:** The positive presentation aligns with call-by-value; the negative with call-by-name.

### 8.3 Strong Sigma Types vs. Weak Sigma Types

A **strong** Sigma type satisfies the eta rule: $p \equiv (\pi_1(p), \pi_2(p))$. A **weak** Sigma type does not --- pairs can be inspected only through the eliminator, and there may be elements of Sigma types that are not definitionally equal to any pair.

The distinction matters for:

- **Definitional equality:** With strong Sigma, the type checker can exploit $p \equiv (\pi_1(p), \pi_2(p))$ silently. Without it, the user may need to prove this propositionally.
- **Proof irrelevance:** Weak Sigma types are compatible with certain forms of proof irrelevance; strong ones are not.
- **Normalization:** Strong Sigma types require the eta rule in the normalization algorithm, which complicates the implementation.

### 8.4 Sigma Types in Practice

In modern proof assistants and dependently typed languages:

**Coq/Rocq:** The Sigma type is defined as an inductive type:

```coq
Inductive sig (A : Type) (B : A -> Prop) : Type :=
  | exist : forall (x : A), B x -> sig A B.
```

Notation: `{x : A | B x}` for `sig A B`. There are also `sigT` (for `Type`-valued families) and `sig2` (for two predicates).

**Agda:** Uses a record type:

```agda
record Sigma (A : Set) (B : A -> Set) : Set where
  constructor _,_
  field
    fst : A
    snd : B fst
```

**Lean 4:** Uses a structure:

```lean
structure Sigma (α : Type u) (β : α → Type v) where
  fst : α
  snd : β fst
```

Lean also has the subtype notation `{x : A // P x}` for Sigma types used as subset types.

---

## 9. The Relationship Between Pi and Sigma: A Categorical Perspective

### 9.1 The Total Space and the Projection

Before diving into the categorical perspective, let us establish the fundamental picture. Given a type $A$ and a family $B : A \to \mathcal{U}$, the Sigma type $\Sigma(x : A).\, B(x)$ is the **total space** of the family. The first projection $\pi_1 : \Sigma(x : A).\, B(x) \to A$ is the **projection map**.

**The fiber.** For each $a : A$, the **fiber** of $\pi_1$ over $a$ is:

$$\pi_1^{-1}(a) \;\stackrel{\text{def}}{=}\; \Sigma(p : \Sigma(x : A).\, B(x)).\, \text{Id}_A(\pi_1(p), a) \;\simeq\; B(a)$$

This equivalence is fundamental: the fibers of the projection from the total space recover the original family.

**The section.** A **section** of $\pi_1$ is a function $s : A \to \Sigma(x : A).\, B(x)$ such that $\pi_1 \circ s = \text{id}_A$. Equivalently, $s$ picks one element from each fiber. A section of $\pi_1$ is the same data as a dependent function $f : \Pi(x : A).\, B(x)$ --- given $f$, define $s(a) = (a, f(a))$.

This establishes the fundamental relationship: $\Sigma$ constructs total spaces, and $\Pi$ constructs sections.

### 9.2 Fibrations and Sections (Categorical View)

In categorical semantics, a type family $B : A \to \mathcal{U}$ corresponds to a fibration $p : E \to A$ (a map with fiber $B(a)$ over each point $a : A$).

- A term of $\Pi(x : A).\, B(x)$ is a **section** of the fibration: a map $s : A \to E$ such that $p \circ s = \text{id}_A$. Informally, it chooses one element from each fiber.
- A term of $\Sigma(x : A).\, B(x)$ is a point of the **total space** $E$: a point in the base together with a point in its fiber.

This gives us the picture:

$$E = \Sigma(x : A).\, B(x) \xrightarrow{\;\pi_1\;} A$$

and sections of this projection correspond to elements of $\Pi(x : A).\, B(x)$.

### 9.3 Adjointness

In the categorical semantics of dependent type theory, the operations $\Sigma$ and $\Pi$ arise as left and right adjoints, respectively, to the substitution (pullback) functor:

$$\Sigma_f \dashv f^* \dashv \Pi_f$$

Given a morphism $f : A \to B$ in the base category:

- $f^*$ is reindexing (substitution): it pulls back a family over $B$ to a family over $A$.
- $\Sigma_f$ is the left adjoint: it composes a family over $A$ with $f$ (dependent sum).
- $\Pi_f$ is the right adjoint: it takes a family over $A$ and produces a family over $B$ by "fiberwise product" (dependent product).

This adjoint triple is the categorical essence of dependent type theory. The Beck-Chevalley condition ensures that substitution commutes with Sigma and Pi in the expected way.

### 9.4 Sigma Types and Dependent Sums in Category Theory

The name "dependent sum" comes from the following observation. In the category of sets, if $B : A \to \text{Set}$ is a family of sets indexed by $A$, then:

$$\Sigma(x : A).\, B(x) = \coprod_{a \in A} B(a) = \{(a, b) \mid a \in A, b \in B(a)\}$$

This is the **disjoint union** (coproduct) of the family $B$. The cardinality is:

$$|\Sigma(x : A).\, B(x)| = \sum_{a \in A} |B(a)|$$

Hence the notation $\sum$ (Sigma = sum). Dually:

$$|\Pi(x : A).\, B(x)| = \prod_{a \in A} |B(a)|$$

Hence the notation $\prod$ (Pi = product). When $A$ is a finite set with $n$ elements and $B(a)$ is a finite set with $m$ elements for all $a$:

$$|\Sigma(x : A).\, B(x)| = n \cdot m \qquad |\Pi(x : A).\, B(x)| = m^n$$

These are the familiar formulas for the cardinality of a disjoint union and a function set.

---

## 10. Interaction Between Pi and Sigma

### 10.1 The Interplay in Dependent Type Checking

When type checking involves both Pi and Sigma types, the type checker must handle substitutions that propagate through both type formers. Consider type-checking the expression:

$$\text{let}\; p = (3, \text{cons}(1, \text{cons}(2, \text{cons}(3, \text{nil})))) \;\text{in}\; \text{append}(\pi_1(p), \pi_2(p), v)$$

where $p : \Sigma(n : \text{Nat}).\, \text{Vec}(\text{Nat}, n)$. The type checker must:

1. Infer the type of $\pi_1(p) = 3 : \text{Nat}$.
2. Infer the type of $\pi_2(p) : \text{Vec}(\text{Nat}, \pi_1(p))$ --- note the dependent type.
3. Check that $\text{append}$ receives arguments of compatible types.
4. Normalize $\pi_1(p)$ to $3$ to verify dimension compatibility.

This requires the type checker to evaluate projections during type checking --- another instance of the blurred phase distinction.

### 10.2 Function Types with Sigma Domains and Codomains

Combining Pi and Sigma types yields rich type structures. Some important patterns:

**Dependent function returning a dependent pair (specification):**

$$\Pi(x : A).\, \Sigma(y : B).\, P(x, y)$$

"For every input $x$, there exists an output $y$ satisfying $P(x, y)$." This is the type of functions that meet a relational specification.

**Dependent pair containing a dependent function (module / signature):**

$$\Sigma(A : \mathcal{U}).\, \Sigma(\text{op} : A \to A \to A).\, \Pi(x\, y\, z : A).\, \text{Id}_A(\text{op}(x, \text{op}(y, z)), \text{op}(\text{op}(x, y), z))$$

"A type $A$ together with a binary operation $\text{op}$ that is associative." This is the type of semigroups.

**Currying and uncurrying with dependency:**

$$\Pi(p : \Sigma(x : A).\, B(x)).\, C(p) \;\cong\; \Pi(x : A).\, \Pi(y : B(x)).\, C((x, y))$$

This is the dependent version of currying: a function from a dependent pair is equivalent to a curried function.

*Proof.* Forward: Given $f : \Pi(p : \Sigma(x : A).\, B(x)).\, C(p)$, define $g(x)(y) \stackrel{\text{def}}{=} f((x, y))$. Then $g : \Pi(x : A).\, \Pi(y : B(x)).\, C((x, y))$.

Backward: Given $g : \Pi(x : A).\, \Pi(y : B(x)).\, C((x, y))$, define $f(p) \stackrel{\text{def}}{=} g(\pi_1(p))(\pi_2(p))$. We need $f(p) : C(p)$. By the eta rule, $p \equiv (\pi_1(p), \pi_2(p))$, so $C(p) \equiv C((\pi_1(p), \pi_2(p)))$, and $g(\pi_1(p))(\pi_2(p)) : C((\pi_1(p), \pi_2(p))) \equiv C(p)$.

The two maps are inverse by beta-eta. $\square$

### 10.3 The Axiom of Choice, Revisited

The type-theoretic axiom of choice is precisely the distributivity of Pi over Sigma (Proposition 7.3):

$$\left(\Pi(x : A).\, \Sigma(y : B(x)).\, C(x, y)\right) \;\to\; \Sigma(f : \Pi(x : A).\, B(x)).\, \Pi(x : A).\, C(x, f(x))$$

In logical notation:

$$\left(\forall x \in A.\, \exists y \in B(x).\, C(x, y)\right) \;\Rightarrow\; \exists f : (A \to B).\, \forall x \in A.\, C(x, f(x))$$

"If for every $x$ there exists a $y$ with property $C$, then there is a choice function $f$ such that $C(x, f(x))$ holds for all $x$."

The proof is trivial in type theory: given $g : \Pi(x : A).\, \Sigma(y : B(x)).\, C(x, y)$, define $f(x) \stackrel{\text{def}}{=} \pi_1(g(x))$. Then $f : \Pi(x : A).\, B(x)$ and $\pi_2(g(x)) : C(x, f(x))$ for each $x$.

The constructive content is clear: $g$ already *computes* a $y$ for each $x$; we simply extract it.

---

## 11. Sigma Types and Equality

### 11.0 Equality of Dependent Pairs

A natural question is: when are two dependent pairs equal? The answer involves both the equality of first components and a *transported* equality of second components.

**Theorem 11.0 (Characterization of Path Space of Sigma Types).** *For $(a_1, b_1), (a_2, b_2) : \Sigma(x : A).\, B(x)$:*

$$\text{Id}((a_1, b_1), (a_2, b_2)) \;\simeq\; \Sigma(p : \text{Id}_A(a_1, a_2)).\, \text{Id}_{B(a_2)}(\text{transport}(B, p, b_1), b_2)$$

*Informally:* two dependent pairs are equal if and only if:

1. Their first components are equal: $p : a_1 =_A a_2$.
2. Their second components are equal *after transport*: $\text{transport}(B, p, b_1) =_{B(a_2)} b_2$.

The transport is necessary because $b_1 : B(a_1)$ and $b_2 : B(a_2)$ live in *different* types when $a_1 \neq a_2$. We must first move $b_1$ from $B(a_1)$ to $B(a_2)$ using transport along $p$, then compare.

*Proof sketch.* Define:

$$\text{encode} : \text{Id}((a_1, b_1), (a_2, b_2)) \to \Sigma(p : \text{Id}_A(a_1, a_2)).\, \text{Id}_{B(a_2)}(\text{transport}(B, p, b_1), b_2)$$

by path induction (J): when the path is $\text{refl}_{(a,b)}$, produce $(\text{refl}_a, \text{refl}_b)$.

$$\text{decode} : \Sigma(p : \text{Id}_A(a_1, a_2)).\, \text{Id}_{B(a_2)}(\text{transport}(B, p, b_1), b_2) \to \text{Id}((a_1, b_1), (a_2, b_2))$$

by path induction on $p$: when $p = \text{refl}_a$, transport is the identity, and $q : b_1 =_{B(a)} b_2$ gives $(a, b_1) = (a, b_2)$ by $\text{ap}(\lambda y.\, (a, y), q)$.

Show encode and decode are inverse. $\square$

**Corollary.** For non-dependent pairs ($B$ constant), this simplifies to:

$$\text{Id}((a_1, b_1), (a_2, b_2)) \;\simeq\; \text{Id}(a_1, a_2) \times \text{Id}(b_1, b_2)$$

since transport along any path in a constant family is the identity.

---

## 12. Formal Metatheory of Sigma Types

### 12.1 Canonicity for Sigma Types

**Theorem 11.1 (Canonicity for Sigma Types).** *Every closed term $p$ of type $\Sigma(x : A).\, B(x)$ in MLTT (without additional axioms) reduces to a canonical form $(a, b)$ where $a : A$ and $b : B(a)$.*

*Proof sketch.* By the strong normalization theorem, $p$ has a normal form $p'$. Since $p$ is closed (no free variables) and well-typed at a Sigma type, $p'$ cannot be a neutral term (stuck on a free variable). By the inversion lemma, $p'$ must be constructed by the introduction rule, hence $p' = (a', b')$ for some $a'$ and $b'$ in normal form. $\square$

This theorem ensures that dependent pairs always decompose into their components --- there are no "exotic" elements of Sigma types that are not pairs.

### 12.2 Injectivity of Pairing

**Proposition 11.2.** *If $(a_1, b_1) \equiv (a_2, b_2) : \Sigma(x : A).\, B(x)$, then $a_1 \equiv a_2 : A$ and $b_1 \equiv b_2 : B(a_1)$.*

*Proof.* By the beta rules, $\pi_1(a_1, b_1) \equiv a_1$ and $\pi_1(a_2, b_2) \equiv a_2$. By congruence of $\pi_1$ and the assumption, $\pi_1(a_1, b_1) \equiv \pi_1(a_2, b_2)$, hence $a_1 \equiv a_2$. Similarly for $b_1$ and $b_2$ using $\pi_2$. $\square$

### 12.3 Sigma Types and Function Extensionality

An interesting interaction between Sigma types and function extensionality arises when we consider the type of equivalences between types. In homotopy type theory, an equivalence $A \simeq B$ is defined using Sigma types:

$$\text{IsEquiv}(f) \;\stackrel{\text{def}}{=}\; \Sigma(g : B \to A).\, (\Pi(a : A).\, \text{Id}_A(g(f(a)), a)) \times (\Pi(b : B).\, \text{Id}_B(f(g(b)), b))$$

$$A \simeq B \;\stackrel{\text{def}}{=}\; \Sigma(f : A \to B).\, \text{IsEquiv}(f)$$

This definition packages a function with its inverse and proofs of the round-trip properties. Function extensionality is needed to show that the type $\text{IsEquiv}(f)$ is a proposition (has at most one element up to propositional equality).

### 12.4 Sigma Types and Pullbacks

In categorical semantics, the Sigma type construction corresponds to composition of fibrations. Given:

- $p_1 : B \to A$ (a fibration, representing the family $B$ over $A$)
- $p_2 : C \to B$ (a fibration, representing the family $C$ over $B$)

The composite fibration $p_1 \circ p_2 : C \to A$ corresponds to the iterated Sigma type $\Sigma(a : A).\, \Sigma(b : B(a)).\, C(a, b)$.

The **pullback** of a fibration along a morphism $f : X \to A$ corresponds to **substitution**: the family $B \circ f$ over $X$ has fiber $B(f(x))$ over $x : X$. The Sigma type $\Sigma(x : X).\, B(f(x))$ is the total space of this pullback.

---

## 13. Extended Worked Examples

### 12.1 Dependent Pairs for Database Schemas

Consider a type-theoretic model of relational databases. A **schema** specifies column names and their types:

$$\text{Schema} \;\stackrel{\text{def}}{=}\; \text{List}(\text{String} \times \mathcal{U})$$

A **row** conforming to a schema is a dependent tuple that provides a value of the correct type for each column:

$$\text{Row} : \text{Schema} \to \mathcal{U}$$

$$\text{Row}(\text{nil}) = \mathbf{1}$$

$$\text{Row}(\text{cons}((\text{name}, T), \text{rest})) = T \times \text{Row}(\text{rest})$$

A **table** is a list of rows:

$$\text{Table}(s) \stackrel{\text{def}}{=} \text{List}(\text{Row}(s))$$

This is a large elimination: `Row` is defined by recursion on the schema (a value) and returns a type. The Sigma type enters when we want to talk about tables with an unspecified schema:

$$\text{SomeTable} \;\stackrel{\text{def}}{=}\; \Sigma(s : \text{Schema}).\, \text{Table}(s)$$

### 12.2 Monoid Structures as Sigma Types

A **monoid** is a type with an associative binary operation and a unit element. Using Sigma types, we can define the type of all monoid structures on a given type $A$:

$$\text{MonoidStr}(A) \;\stackrel{\text{def}}{=}\; \Sigma(e : A).\, \Sigma(op : A \to A \to A).\, \text{MonoidLaws}(A, e, op)$$

where $\text{MonoidLaws}$ packages the proofs of the three laws:

$$\text{MonoidLaws}(A, e, op) \;\stackrel{\text{def}}{=}$$

$$\quad (\Pi(a : A).\, \text{Id}_A(op(e, a), a)) \quad \times$$

$$\quad (\Pi(a : A).\, \text{Id}_A(op(a, e), a)) \quad \times$$

$$\quad (\Pi(a\, b\, c : A).\, \text{Id}_A(op(a, op(b, c)), op(op(a, b), c)))$$

The type of *all monoids* is then:

$$\text{Monoid} \;\stackrel{\text{def}}{=}\; \Sigma(A : \mathcal{U}).\, \text{MonoidStr}(A)$$

An element of $\text{Monoid}$ is a carrier type together with operations and proofs of the laws. This is a Sigma type whose second component is itself an iterated Sigma type.

### 12.3 Decidable Predicates and Sigma Types

A predicate $P : A \to \mathcal{U}$ is **decidable** if $\Pi(a : A).\, P(a) + \neg P(a)$. When $P$ is decidable, the Sigma type $\Sigma(a : A).\, P(a)$ behaves particularly well:

- We can compute whether a given $a$ satisfies $P$ (by the decision procedure).
- We can implement a filter function $\text{filter} : \Pi(P : A \to \mathcal{U}).\, \text{Dec}(P) \to \text{List}(A) \to \text{List}(\Sigma(a : A).\, P(a))$ that extracts the elements satisfying $P$ together with proofs.

This pattern is fundamental in verified programming: decidable predicates yield computable subset types.

### 12.4 The Fiber as a Sigma Type

**Definition 12.1.** The **fiber** (or **preimage**) of a function $f : A \to B$ over a point $b : B$ is:

$$\text{fib}(f, b) \;\stackrel{\text{def}}{=}\; \Sigma(a : A).\, \text{Id}_B(f(a), b)$$

**Proposition 12.2.** *A function $f : A \to B$ is an equivalence if and only if every fiber $\text{fib}(f, b)$ is contractible (has exactly one element up to propositional equality).*

This is the **fibrational characterization of equivalences** in homotopy type theory. The proof uses the Sigma type structure to decompose the equivalence data.

**Proposition 12.3.** *The fiber of the first projection $\pi_1 : \Sigma(x : A).\, B(x) \to A$ over $a : A$ is equivalent to $B(a)$:*

$$\text{fib}(\pi_1, a) \;\simeq\; B(a)$$

*Proof.* An element of $\text{fib}(\pi_1, a)$ is a pair $((x, b), p)$ where $(x, b) : \Sigma(x : A).\, B(x)$ and $p : \text{Id}_A(x, a)$. Transporting $b : B(x)$ along $p$ gives an element of $B(a)$. Conversely, given $b : B(a)$, the pair $((a, b), \text{refl}_a)$ is in $\text{fib}(\pi_1, a)$. These constructions are inverse, giving the equivalence. $\square$

---

## 14. Exercises

### Exercise 13.1

Prove that the Sigma type is associative up to isomorphism:

$$\Sigma(x : A).\, \Sigma(y : B(x)).\, C(x, y) \;\cong\; \Sigma(p : \Sigma(x : A).\, B(x)).\, C(\pi_1(p), \pi_2(p))$$

Construct the isomorphism maps and verify they are inverse.

### Exercise 13.2

Define the type of **binary relations** on $A$ as $A \to A \to \mathcal{U}$. Using Sigma types, define:

1. The type of reflexive relations on $A$.
2. The type of symmetric relations on $A$.
3. The type of equivalence relations on $A$.

### Exercise 13.3

Show that the type $\mathbf{1}$ (unit type) is equivalent to $\Sigma(x : \mathbf{1}).\, \mathbf{1}$ by constructing maps in both directions and proving they compose to the identity.

### Exercise 13.4

Given $f : A \to B$ and $g : A \to C$, define the **graph** of the pair $(f, g)$ as a Sigma type. Specifically, define:

$$\text{Graph}(f, g) \;\stackrel{\text{def}}{=}\; \Sigma(a : A).\, \Sigma(b : B).\, \Sigma(c : C).\, \text{Id}_B(f(a), b) \times \text{Id}_C(g(a), c)$$

Show that $\text{Graph}(f, g) \simeq A$.

### Exercise 13.5

The **dependent sum** $\Sigma(x : A).\, B(x)$ can be seen as a "total space" of the family $B$. If $A = \text{Bool}$ and $B(\text{true}) = \text{Nat}$, $B(\text{false}) = \text{String}$, describe the elements of $\Sigma(x : \text{Bool}).\, B(x)$ concretely. How does this relate to the coproduct $\text{Nat} + \text{String}$?

### Exercise 13.6

Prove that if $A$ is contractible (i.e., $\Sigma(a_0 : A).\, \Pi(a : A).\, \text{Id}_A(a_0, a)$), then $\Sigma(x : A).\, B(x) \simeq B(a_0)$ for the center of contraction $a_0$.

### Exercise 13.7

Define the type of **partial functions** from $A$ to $B$ as:

$$A \rightharpoonup B \;\stackrel{\text{def}}{=}\; A \to \text{Maybe}(B)$$

where $\text{Maybe}(B) = \mathbf{1} + B$. Using Sigma types, define the **domain** of a partial function:

$$\text{dom}(f) \;\stackrel{\text{def}}{=}\; \Sigma(a : A).\, \Sigma(b : B).\, \text{Id}(f(a), \text{inr}(b))$$

Explain how this relates to the notion of a partial function's domain in classical mathematics.

### Exercise 13.8

Given a type family $B : A \to \mathcal{U}$ and a function $f : \Pi(a : A).\, B(a)$, define the **graph** of $f$:

$$\text{Graph}(f) \;\stackrel{\text{def}}{=}\; \Sigma(a : A).\, \Sigma(b : B(a)).\, \text{Id}_{B(a)}(f(a), b)$$

Prove that $\text{Graph}(f) \simeq A$ by constructing an equivalence.

### Exercise 13.9

The **join** of two type families $B : A \to \mathcal{U}$ and $C : A \to \mathcal{U}$ over the same base is:

$$(B +_A C)(a) \;\stackrel{\text{def}}{=}\; B(a) + C(a)$$

Show that:

$$\Sigma(a : A).\, (B +_A C)(a) \;\cong\; (\Sigma(a : A).\, B(a)) + (\Sigma(a : A).\, C(a))$$

That is, Sigma distributes over coproducts in the fiber.

### Exercise 13.10

Prove that $\Sigma(x : A).\, \mathbf{1} \;\cong\; A$ and $\Sigma(x : \mathbf{1}).\, B(x) \;\cong\; B(\star)$ by constructing explicit isomorphisms (pairs of functions that are inverse to each other).

### Exercise 13.11

Using Sigma types, define the type of **well-founded orders** on a type $A$. A well-founded order is a transitive, irreflexive relation $R : A \to A \to \mathcal{U}$ such that every element is accessible:

$$\text{Acc}(R, a) \;\stackrel{\text{def}}{=}\; (\Pi(b : A).\, R(b, a) \to \text{Acc}(R, b)) \to \text{Acc}(R, a)$$

$$\text{WF}(A, R) \;\stackrel{\text{def}}{=}\; \Pi(a : A).\, \text{Acc}(R, a)$$

Explain how this inductive definition of accessibility corresponds to the classical notion of well-foundedness (no infinite descending chains).

### Exercise 13.12

Consider the type of **pointed types**: $\text{Pointed} \;\stackrel{\text{def}}{=}\; \Sigma(A : \mathcal{U}).\, A$. An element of $\text{Pointed}$ is a type together with a distinguished element (the "base point"). Define:

1. A function $\text{forget} : \text{Pointed} \to \mathcal{U}$ that extracts the underlying type.
2. A function $\text{basepoint} : \Pi(P : \text{Pointed}).\, \text{forget}(P)$ that extracts the base point.
3. The type of **pointed maps** between two pointed types: a function that preserves the base point.

---

## Summary

- **Sigma types** $\Sigma(x : A).\, B(x)$ generalize product types to allow the type of the second component to depend on the value of the first component. They are the dependent pair types.
- When $B$ does not depend on $x$, the Sigma type degenerates to the ordinary product type $A \times B$.
- The **introduction rule** constructs a pair $(a, b)$ where $b : B(a)$. The **elimination rules** are the dependent projections $\pi_1$ and $\pi_2$ (or equivalently, the `split` eliminator).
- The **second projection** has a dependent type: $\pi_2(p) : B(\pi_1(p))$.
- Under the **Curry-Howard correspondence**, Sigma types correspond to **existential quantification**: a proof of $\exists x.\, P(x)$ is a witness $a$ together with evidence $P(a)$.
- Sigma types encode **specifications** (subset types, pre/post-conditions), **records** (iterated Sigma types / telescopes), and **abstract data types** (existentially hidden representations).
- **Refinement types** are a practical restriction of Sigma types where predicates come from a decidable fragment and proofs are automatically discharged.
- Pi and Sigma types are **dual** in the categorical sense: Sigma is a left adjoint and Pi is a right adjoint to substitution.
- The **type-theoretic axiom of choice** --- that Pi distributes over Sigma --- is a theorem, not an axiom, in constructive type theory.

---

## Further Reading

1. **Martin-Lof, P.** (1984). *Intuitionistic Type Theory*. Bibliopolis. The foundational treatment of Sigma types in dependent type theory.

2. **Nordstrom, B., Petersson, K., and Smith, J.** (1990). *Programming in Martin-Lof's Type Theory*. Oxford University Press. A practical introduction including detailed treatment of Sigma types.

3. **The Univalent Foundations Program.** (2013). *Homotopy Type Theory: Univalent Foundations of Mathematics*. Chapter 1, Sections 1.6--1.8, for the modern treatment of Sigma types.

4. **Jacobs, B.** (1999). *Categorical Logic and Type Theory*. Elsevier. The definitive reference for the categorical semantics ($\Sigma \dashv \Delta \dashv \Pi$ adjunction).

5. **Vazou, N.** (2016). "Liquid Haskell: Haskell as a Theorem Prover." PhD thesis. For the practical application of refinement types.

6. **de Bruijn, N. G.** (1991). "Telescopic Mappings in Typed Lambda Calculus." *Information and Computation*, 91(2):189--204.

7. **Constable, R. L., et al.** (1986). *Implementing Mathematics with the Nuprl Proof Development System*. Prentice-Hall. Early use of Sigma types for program specification and verification.

8. **Swamy, N., et al.** (2016). "Dependent Types and Multi-Monadic Effects in F*." In *POPL 2016*. Sigma types in a practical verification-oriented language.

9. **Coquand, T. and Paulin, C.** (1990). "Inductively Defined Types." In *COLOG-88*, LNCS 417. The extension of Sigma types with inductive definitions.

10. **Awodey, S. and Warren, M.** (2009). "Homotopy Theoretic Models of Identity Types." *Mathematical Proceedings of the Cambridge Philosophical Society*, 146(1):45--55. Sigma types in the homotopical setting.
