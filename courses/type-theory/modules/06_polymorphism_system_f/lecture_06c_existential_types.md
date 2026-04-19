---
title: "Lecture 06c: Existential Types and Data Abstraction"
tags:
  - type-theory
  - system-f
  - lecture
---
# Lecture 06c: Existential Types and Data Abstraction

> **Module 06 --- Polymorphism & System F (Weeks 11--12)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** existential types syntactically and semantically, and state their introduction and elimination rules.
2. **Construct** existential packages using the pack operation and eliminate them using unpack.
3. **Prove** that existential types enforce data abstraction by hiding representation types.
4. **Model** abstract data types as existential packages, with concrete examples (counters, stacks, sets).
5. **Encode** existential types using universal types in System F, demonstrating that existentials do not add expressive power.
6. **Explain** the connection between existential types and module systems in programming languages.
7. **Relate** existential types to objects in object-oriented programming through the Curry-Howard lens.
8. **State and prove** type safety for System F extended with existential types.

---

## 1. Motivation

### 1.1 The Need for Data Abstraction

Universal types ($\forall X.\, T$) allow a term to work with any type chosen by the **caller**. But there is a dual situation: sometimes a module or library wants to **hide** its internal representation type from the client. The module promises that a type exists and provides operations on it, but the client cannot inspect or depend on the concrete representation.

Consider a counter module. The implementer might represent the counter as a natural number, a list, a pair, or a binary tree --- the client should not care. What matters is the interface:

- A way to create a new counter.
- A way to increment a counter.
- A way to read the counter's value.

This is precisely what existential types express: "there exists a type $X$ such that the following operations are available."

### 1.2 Universals vs. Existentials

The two quantifiers are dual:

| Aspect | Universal ($\forall X.\, T$) | Existential ($\exists X.\, T$) |
|--------|------------------------------|--------------------------------|
| Who chooses $X$? | The user (caller) | The implementer (provider) |
| Introduction | $\Lambda X.\, t$ (abstraction) | $\{*S, t\}$ as $\exists X.\, T$ (packing) |
| Elimination | $t\;[S]$ (instantiation) | let $\{X, x\} = t_1$ in $t_2$ (unpacking) |
| Analogy | "works for all types" | "uses some hidden type" |
| Logic | $\forall$-introduction / elimination | $\exists$-introduction / elimination |

Under the Curry-Howard correspondence:

- $\forall X.\, T$ corresponds to the proposition "for all $X$, $T$ holds" --- a universally quantified formula.
- $\exists X.\, T$ corresponds to "there exists an $X$ such that $T$ holds" --- an existentially quantified formula.

### 1.3 Preview: ADTs as Existential Packages

An abstract data type (ADT) consists of:

1. A **hidden representation type** $X$.
2. A collection of **operations** on $X$ (creation, manipulation, observation).

This is exactly an existential package $\{*\text{Rep}, \text{operations}\}$ as $\exists X.\, T_{\text{ops}}$:

- The representation type $\text{Rep}$ is hidden.
- The operations are typed in terms of the abstract type variable $X$.
- Clients can use the operations but cannot access $\text{Rep}$ directly.

---

## 2. Core Theory

### 2.1 Syntax

We extend System F with existential types and the associated term forms.

**Definition 2.1 (Extended syntax).**

*Types (additional):*

$$T \;::=\; \cdots \;\mid\; \exists X.\, T$$

*Terms (additional):*

$$t \;::=\; \cdots \;\mid\; \{*S, t\} \text{ as } \exists X.\, T \;\mid\; \text{let } \{X, x\} = t_1 \text{ in } t_2$$

*Values (additional):*

$$v \;::=\; \cdots \;\mid\; \{*S, v\} \text{ as } \exists X.\, T$$

The new constructs are:

- **Existential type** $\exists X.\, T$: the type of packages that hide a type $X$ and provide a value of type $T$.
- **Pack** $\{*S, t\}$ as $\exists X.\, T$: creates an existential package by providing a witness type $S$ and a term $t$ of type $[X \mapsto S]\,T$. The type annotation $\exists X.\, T$ is necessary because the same pair $(S, t)$ could be packed at different existential types.
- **Unpack** $\text{let } \{X, x\} = t_1 \text{ in } t_2$: opens an existential package, binding the hidden type to $X$ and the value to $x$, then evaluates $t_2$.

### 2.2 Typing Rules

**Definition 2.2 (Typing rules for existential types).**

$$\frac{\Gamma \vdash t : [X \mapsto S]\,T}{\Gamma \vdash \{*S, t\} \text{ as } \exists X.\, T : \exists X.\, T} \quad\text{(T-Pack)}$$

$$\frac{\Gamma \vdash t_1 : \exists X.\, T_1 \quad \Gamma, X, x : T_1 \vdash t_2 : T_2 \quad X \notin \text{FTV}(T_2)}{\Gamma \vdash \text{let } \{X, x\} = t_1 \text{ in } t_2 : T_2} \quad\text{(T-Unpack)}$$

**T-Pack (Introduction).** To pack a value $t$ into an existential $\exists X.\, T$, we must provide a witness type $S$ and verify that $t$ has type $[X \mapsto S]\,T$ --- the type $T$ with $X$ replaced by the concrete witness $S$. The result has type $\exists X.\, T$, which hides $S$.

**T-Unpack (Elimination).** To use an existential package $t_1 : \exists X.\, T_1$, we open it in the body $t_2$. Inside $t_2$, the type variable $X$ is in scope (but abstract --- we know nothing about what type it stands for), and $x$ has type $T_1$ (which may mention $X$). The critical constraint is $X \notin \text{FTV}(T_2)$: the result type $T_2$ must not mention the abstract type $X$, because $X$ is not in scope outside the unpack.

**Remark.** The condition $X \notin \text{FTV}(T_2)$ is the formal mechanism of data abstraction. It ensures that the hidden type cannot "escape" its scope. This is analogous to the restriction in logic that a variable bound by $\exists$ cannot appear in the conclusion:

$$\frac{P(c) \quad [P(c) \implies Q]}{Q} \quad\text{where } c \text{ does not appear in } Q$$

### 2.3 Evaluation Rules

**Definition 2.3 (Evaluation rules for existential types).**

$$\frac{}{\text{let } \{X, x\} = (\{*S, v\} \text{ as } \exists X.\, T) \text{ in } t_2 \to [X \mapsto S]\,[x \mapsto v]\,t_2} \quad\text{(E-UnpackPack)}$$

$$\frac{t_1 \to t_1'}{\text{let } \{X, x\} = t_1 \text{ in } t_2 \to \text{let } \{X, x\} = t_1' \text{ in } t_2} \quad\text{(E-Unpack)}$$

$$\frac{t \to t'}{\{*S, t\} \text{ as } \exists X.\, T \to \{*S, t'\} \text{ as } \exists X.\, T} \quad\text{(E-Pack)}$$

E-UnpackPack is the key reduction: when we unpack a fully evaluated package $\{*S, v\}$, we substitute both the witness type $S$ for $X$ and the value $v$ for $x$ in the body $t_2$.

**Important.** At runtime, the hidden type $S$ is revealed during unpacking. The abstraction barrier is a **static** (compile-time) property enforced by the type system, not a runtime mechanism. After type checking, the types can be erased (as with universal types).

### 2.4 Type Safety for Existential Types

**Theorem 2.4 (Progress for existentials).** If $\vdash t : T$ and $T$ involves existential types, then either $t$ is a value or $t \to t'$.

*Proof.* We extend the progress proof from Lecture 06b. The new cases:

**Case T-Pack:** $t = \{*S, t_1\} \text{ as } \exists X.\, T$. If $t_1$ is a value, then $t$ is a value. If $t_1 \to t_1'$, then $t \to \{*S, t_1'\} \text{ as } \exists X.\, T$ by E-Pack.

**Case T-Unpack:** $t = \text{let } \{X, x\} = t_1 \text{ in } t_2$. If $t_1$ is not a value, by IH $t_1 \to t_1'$, so $t \to \text{let } \{X, x\} = t_1' \text{ in } t_2$ by E-Unpack. If $t_1$ is a value, since $t_1 : \exists X.\, T_1$, the canonical forms lemma gives $t_1 = \{*S, v\} \text{ as } \exists X.\, T_1$, so $t \to [X \mapsto S]\,[x \mapsto v]\,t_2$ by E-UnpackPack.

$\square$

**Lemma 2.5 (Canonical forms for existentials).** If $\vdash v : \exists X.\, T$ and $v$ is a value, then $v = \{*S, v'\} \text{ as } \exists X.\, T$ for some type $S$ and value $v'$ with $\vdash v' : [X \mapsto S]\,T$.

*Proof.* By inspection of the value forms: the only value form with an existential type is a package. $\square$

**Theorem 2.6 (Preservation for existentials).** If $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$.

*Proof.* We extend the preservation proof. The key new case:

**Case T-Unpack, E-UnpackPack:** $t = \text{let } \{X, x\} = (\{*S, v\} \text{ as } \exists X.\, T_1) \text{ in } t_2$, with $t' = [X \mapsto S]\,[x \mapsto v]\,t_2$.

From the typing derivation:
- $\Gamma \vdash \{*S, v\} \text{ as } \exists X.\, T_1 : \exists X.\, T_1$, which requires $\Gamma \vdash v : [X \mapsto S]\,T_1$ (by T-Pack).
- $\Gamma, X, x : T_1 \vdash t_2 : T_2$ and $X \notin \text{FTV}(T_2)$ (by T-Unpack).

By the type substitution lemma (Lemma 2.4 of Lecture 06b):

$$[X \mapsto S]\,\Gamma, x : [X \mapsto S]\,T_1 \vdash [X \mapsto S]\,t_2 : [X \mapsto S]\,T_2$$

Since $X \notin \text{FTV}(\Gamma)$ (it was freshly bound) and $X \notin \text{FTV}(T_2)$ (by T-Unpack), we have $[X \mapsto S]\,\Gamma = \Gamma$ and $[X \mapsto S]\,T_2 = T_2$. So:

$$\Gamma, x : [X \mapsto S]\,T_1 \vdash [X \mapsto S]\,t_2 : T_2$$

By the term substitution lemma (Lemma 2.5 of Lecture 06b), using $\Gamma \vdash v : [X \mapsto S]\,T_1$:

$$\Gamma \vdash [x \mapsto v]\,([X \mapsto S]\,t_2) : T_2$$

Since $[x \mapsto v]\,([X \mapsto S]\,t_2) = [X \mapsto S]\,[x \mapsto v]\,t_2$ (the substitutions commute because $x$ is a term variable and $X$ is a type variable):

$$\Gamma \vdash t' : T_2 = T$$

$\square$

### 2.5 Well-Formedness of Existential Types

**Definition 2.7 (Well-formedness for existentials).**

$$\frac{\Gamma, X \vdash T}{\Gamma \vdash \exists X.\, T} \quad\text{(WF-Exists)}$$

An existential type $\exists X.\, T$ is well-formed in context $\Gamma$ if $T$ is well-formed when $X$ is added to the context. This mirrors the rule for universal types.

### 2.6 Strong Normalization with Existentials

The strong normalization proof for System F extends to existential types. We extend the reducibility interpretation:

**Definition 2.8 (Reducibility interpretation of existential types).**

$$\lbrack\!\lbrack \exists X.\, T \rbrack\!\rbrack_\rho = \{ t \mid \exists \text{RC } \mathcal{R},\; \exists \text{closed type } S,\; t \to^* \{*S, v\} \text{ as } \exists X.\, T \text{ and } v \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]} \}$$

The definition says: a term is reducible at $\exists X.\, T$ if it reduces to a package whose content is reducible at $T$ for some choice of RC $\mathcal{R}$. The proof that this yields an RC follows the same pattern as for universal types.

**Theorem 2.9.** System F extended with existential types is strongly normalizing.

*Proof sketch.* Extend the fundamental theorem (Theorem 4.9 of Lecture 06b) with two new cases:

- **T-Pack:** We need $\sigma(\{*S, t\} \text{ as } \exists X.\, T) \in \lbrack\!\lbrack \exists X.\, T \rbrack\!\rbrack_\rho$. By IH, $\sigma(t) \in \lbrack\!\lbrack [X \mapsto S]\,T \rbrack\!\rbrack_\rho = \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack S \rbrack\!\rbrack_\rho]}$. The package reduces to itself (it is a value), and the content is reducible, so the package is in $\lbrack\!\lbrack \exists X.\, T \rbrack\!\rbrack_\rho$.

- **T-Unpack:** We need $\sigma(\text{let } \{X, x\} = t_1 \text{ in } t_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. By IH, $\sigma(t_1) \in \lbrack\!\lbrack \exists X.\, T_1 \rbrack\!\rbrack_\rho$, so $\sigma(t_1) \to^* \{*S, v\}$ with $v \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho'}$ for some $\rho'$. Then the unpack reduces to $[X \mapsto S][x \mapsto v]\,t_2$, and by IH applied with the extended substitution, the result is in $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ (using $X \notin \text{FTV}(T_2)$).

$\square$

### 2.7 Worked Example: Counter Evaluation

Let us trace the complete evaluation of a counter program:

$$\text{let } \{X, c\} = \text{counter}_1 \text{ in } c.get\;(c.inc\;(c.inc\;c.new))$$

where $\text{counter}_1 = \{*\text{Nat},\; \{new = 0,\; inc = \lambda x.\, \text{succ}\;x,\; get = \lambda x.\, x\}\}$ as $\text{CounterADT}$.

**Step 1 (E-UnpackPack):** $\text{counter}_1$ is already a value (a package with a value inside). Unpack:

$$[X \mapsto \text{Nat}]\,[c \mapsto \{new = 0, inc = \lambda x.\, \text{succ}\;x, get = \lambda x.\, x\}]\,(c.get\;(c.inc\;(c.inc\;c.new)))$$

After substitution, all occurrences of $X$ become $\text{Nat}$ and all occurrences of $c$ become the record. We abbreviate the record as $r$:

$$r.get\;(r.inc\;(r.inc\;r.new))$$

**Step 2:** $r.new = 0$.

$$r.get\;(r.inc\;(r.inc\;0))$$

**Step 3:** $r.inc\;0 = (\lambda x : \text{Nat}.\, \text{succ}\;x)\;0 \to \text{succ}\;0 = 1$.

$$r.get\;(r.inc\;1)$$

**Step 4:** $r.inc\;1 = (\lambda x : \text{Nat}.\, \text{succ}\;x)\;1 \to \text{succ}\;1 = 2$.

$$r.get\;2$$

**Step 5:** $r.get\;2 = (\lambda x : \text{Nat}.\, x)\;2 \to 2$.

Result: $2$.

The key observation is that the abstract type $X$ was replaced by $\text{Nat}$ during unpacking, but the **type checker** did not know this --- it treated $X$ as opaque. The evaluation is free to use the concrete representation.

---

## 3. Abstract Data Types as Existential Packages

### 3.1 The Counter ADT

The canonical example of an ADT is a counter with three operations: create, increment, and read.

**Interface.** The counter ADT has type:

$$\text{CounterADT} = \exists X.\, \{new : X,\; inc : X \to X,\; get : X \to \text{Nat}\}$$

This says: "there exists a representation type $X$ such that we can create a counter ($new : X$), increment it ($inc : X \to X$), and read its value ($get : X \to \text{Nat}$)."

**Implementation 1: Natural number representation.**

$$\text{counter}_1 = \{*\text{Nat},\; \{new = 0,\; inc = \lambda x : \text{Nat}.\, \text{succ}\;x,\; get = \lambda x : \text{Nat}.\, x\}\}$$

$$\text{as } \exists X.\, \{new : X,\; inc : X \to X,\; get : X \to \text{Nat}\}$$

Here the witness type is $\text{Nat}$. The counter is represented directly as a natural number.

**Implementation 2: Pair representation.**

$$\text{counter}_2 = \{*\text{Nat} \times \text{Nat},\; \{new = (0, 0),\; inc = \lambda p : \text{Nat} \times \text{Nat}.\, (\text{succ}\;(\text{fst}\;p), \text{snd}\;p),$$

$$\quad get = \lambda p : \text{Nat} \times \text{Nat}.\, \text{fst}\;p\}\}$$

$$\text{as } \exists X.\, \{new : X,\; inc : X \to X,\; get : X \to \text{Nat}\}$$

Here the witness type is $\text{Nat} \times \text{Nat}$ (a pair storing the count and some auxiliary data). The representation is different, but the interface is the same.

**Client code.** A client uses the counter through the abstract interface:

$$\text{let } \{X, c\} = \text{counter}_1 \text{ in } c.get\;(c.inc\;(c.inc\;c.new))$$

This evaluates as follows:

1. Unpack $\text{counter}_1$: $X \mapsto \text{Nat}$, $c \mapsto \{new = 0, inc = \lambda x.\, \text{succ}\;x, get = \lambda x.\, x\}$.
2. $c.new = 0$.
3. $c.inc\;0 = \text{succ}\;0 = 1$.
4. $c.inc\;1 = \text{succ}\;1 = 2$.
5. $c.get\;2 = 2$.

The same client code works with $\text{counter}_2$ and produces the same observable result, even though the internal representation is different.

**Key property.** Inside the body of the unpack, the type $X$ is abstract. The client cannot write code that depends on $X$ being $\text{Nat}$ (e.g., adding 5 to a counter value directly). The type checker enforces this: any attempt to use $x : X$ as a $\text{Nat}$ would be a type error, because $X$ is an opaque type variable.

### 3.2 The Stack ADT

A more interesting example:

$$\text{StackADT}(A) = \exists X.\, \{empty : X,\; push : A \to X \to X,\; pop : X \to X,\; top : X \to A,\; isEmpty : X \to \text{Bool}\}$$

**Implementation using lists:**

$$\text{stack}_{\text{list}} = \{*\text{List}\;A,\; \{empty = \text{nil},\; push = \text{cons},\; pop = \text{tail},\; top = \text{head},\; isEmpty = \text{null}\}\}$$

$$\text{as } \text{StackADT}(A)$$

**Implementation using pairs (snoc lists):**

$$\text{stack}_{\text{snoc}} = \{*\text{SnocList}\;A,\; \{empty = \text{snil},\; push = \text{snoc},\; \ldots\}\}$$

$$\text{as } \text{StackADT}(A)$$

Both implementations have the same type $\text{StackADT}(A)$ and are interchangeable from the client's perspective.

### 3.3 Representation Independence

**Definition 3.1 (Representation independence).** Two implementations of an ADT are **representation independent** if no client can distinguish between them. Formally, for any client $t_2$ with:

$$X, x : T_{\text{ops}} \vdash t_2 : R \quad\text{where } X \notin \text{FTV}(R)$$

the results of $\text{let } \{X, x\} = \text{impl}_1 \text{ in } t_2$ and $\text{let } \{X, x\} = \text{impl}_2 \text{ in } t_2$ are equal (when both are defined).

**Theorem 3.2 (Existential types enforce representation independence).** If $\text{impl}_1$ and $\text{impl}_2$ have type $\exists X.\, T$ and are **bisimilar** (i.e., there is a relation $R$ between their representation types such that corresponding operations preserve $R$), then they are representation independent.

*Proof sketch.* This follows from the parametricity theorem (Lecture 06d). The condition $X \notin \text{FTV}(R)$ ensures that the client treats $X$ parametrically. Any client that respects the abstraction barrier must commute with the bisimulation relation. $\square$

The formal proof requires the relational parametricity framework of Reynolds (1983), which we develop in Lecture 06d.

### 3.4 The Set ADT

A more complex example illustrating multiple operations and invariants:

$$\text{SetADT}(A) = \exists X.\, \{empty : X,\; insert : A \to X \to X,\; member : A \to X \to \text{Bool},\; union : X \to X \to X,\; size : X \to \text{Nat}\}$$

**Implementation 1: Sorted lists.**

$$\text{set}_{\text{sorted}} = \{*\text{SortedList}\;A,\; \{$$

$$\quad empty = [],$$

$$\quad insert = \lambda a : A.\, \lambda s : \text{SortedList}\;A.\, \text{sortedInsert}\;a\;s,$$

$$\quad member = \lambda a : A.\, \lambda s : \text{SortedList}\;A.\, \text{binarySearch}\;a\;s,$$

$$\quad union = \lambda s_1.\, \lambda s_2.\, \text{merge}\;s_1\;s_2,$$

$$\quad size = \text{length}$$

$$\}\} \text{ as } \text{SetADT}(A)$$

**Implementation 2: Hash tables (conceptually).**

$$\text{set}_{\text{hash}} = \{*\text{HashMap}\;A\;\text{Unit},\; \{$$

$$\quad empty = \text{emptyMap},$$

$$\quad insert = \lambda a : A.\, \lambda s.\, \text{put}\;a\;\text{unit}\;s,$$

$$\quad member = \lambda a : A.\, \lambda s.\, \text{containsKey}\;a\;s,$$

$$\quad union = \lambda s_1.\, \lambda s_2.\, \text{mergeMap}\;s_1\;s_2,$$

$$\quad size = \text{mapSize}$$

$$\}\} \text{ as } \text{SetADT}(A)$$

Both implementations have the same type $\text{SetADT}(A)$. A client written against the interface:

$$\text{let } \{X, s\} = \text{setImpl} \text{ in } s.size\;(s.insert\;3\;(s.insert\;5\;s.empty))$$

works identically with either implementation (assuming both correctly implement the set abstraction).

### 3.5 Existential Packages with Invariants

A subtlety of the existential types formulation is that it does **not** directly enforce **representation invariants**. For instance, the sorted list implementation of sets relies on the invariant that the list is always sorted, but nothing in the existential type prevents a buggy implementation from violating this.

**Refinement.** In richer type systems (e.g., those with refinement types or dependent types), we can encode invariants. For example, a sorted list might have type $\text{List}\;A\;| \;\text{sorted}$. In System F, we rely on the module implementer to maintain invariants, and the type system only enforces the interface contract.

**Sealing.** The existential package acts as a "seal" on the representation. Once packed, the concrete type is hidden, and the only way to interact with values of the abstract type is through the provided operations. If those operations maintain the invariant, the invariant is preserved --- the client cannot violate it because the client cannot access the representation directly.

### 3.6 Composing ADTs

Existential packages compose. Given two ADTs:

$$\text{ADT}_1 = \exists X.\, T_1(X) \qquad \text{ADT}_2 = \exists Y.\, T_2(Y)$$

We can build a composite ADT that uses both:

$$\text{let } \{X, m_1\} = \text{adt}_1 \text{ in } \text{let } \{Y, m_2\} = \text{adt}_2 \text{ in } \cdots$$

Within the body, both $X$ and $Y$ are abstract, and we can build new operations that combine the two interfaces. We can also re-package the result:

$$\{*(X, Y),\; \{op_1 = \ldots,\; op_2 = \ldots\}\} \text{ as } \exists Z.\, T_3(Z)$$

This corresponds to the practice of building larger modules from smaller ones.

### 3.7 Formal Properties of ADTs

**Proposition 3.3 (Information hiding).** Let $\text{impl} = \{*S, v\}$ as $\exists X.\, T$ and let $\text{client} = \text{let } \{X, x\} = \text{impl} \text{ in } t_2$ with $X \notin \text{FTV}(R)$ where $\vdash \text{client} : R$. Then $\text{client}$ does not depend on the choice of $S$ in the following sense: if $\text{impl}' = \{*S', v'\}$ as $\exists X.\, T$ is another implementation such that there exists a relation $\mathcal{R} \subseteq S \times S'$ with $(v, v') \in \lbrack\!\lbrack T \rbrack\!\rbrack_{[X \mapsto \mathcal{R}]}$, then $\text{let } \{X, x\} = \text{impl} \text{ in } t_2 = \text{let } \{X, x\} = \text{impl}' \text{ in } t_2$.

This is a formal statement of representation independence, proved using parametricity (Lecture 06d).

**Proposition 3.4 (Existential types prevent type leakage).** If $\Gamma \vdash \text{let } \{X, x\} = t_1 \text{ in } t_2 : T$ and $X \notin \text{FTV}(T)$, then no subexpression of $T$ mentions $X$. The abstract type is completely invisible outside the scope of the unpack.

*Proof.* This is immediate from the well-formedness conditions of the type system: $T$ is well-formed in $\Gamma$ (which does not contain $X$), so $T$ cannot reference $X$. $\square$

---

## 4. Encoding Existentials via Universals

### 4.1 The Encoding

A remarkable fact about System F is that existential types can be **encoded** using universal types. Existentials do not add expressive power; they are definable in terms of universals.

**Definition 4.1 (Encoding of existential types).**

$$\exists X.\, T \;\triangleq\; \forall Y.\, (\forall X.\, T \to Y) \to Y$$

where $Y$ is fresh (not free in $T$).

**Intuition.** An existential package $\exists X.\, T$ is a "data" that, given any continuation $f : \forall X.\, T \to Y$, can produce a result of type $Y$ by applying $f$ to its hidden type and value. The package "knows" what $X$ is, but the continuation $f$ does not --- $f$ must work for all $X$. This is a continuation-passing encoding.

### 4.2 Encoding Pack

The introduction form is encoded as:

$$\{*S, t\} \text{ as } \exists X.\, T \;\triangleq\; \Lambda Y.\, \lambda f : (\forall X.\, T \to Y).\, f\;[S]\; t$$

**Type checking.** We verify:

$$\frac{\frac{}{\Gamma, Y, f : \forall X.\, T \to Y \vdash f : \forall X.\, T \to Y}\;\text{T-Var}}{\Gamma, Y, f : \forall X.\, T \to Y \vdash f\;[S] : [X \mapsto S]\,T \to Y}\;\text{T-TApp}$$

Given $\Gamma \vdash t : [X \mapsto S]\,T$:

$$\frac{\Gamma, Y, f : \forall X.\, T \to Y \vdash f\;[S] : [X \mapsto S]\,T \to Y \quad \Gamma \vdash t : [X \mapsto S]\,T}{\Gamma, Y, f : \forall X.\, T \to Y \vdash f\;[S]\; t : Y}\;\text{T-App}$$

Abstracting:

$$\frac{\cdots}{\Gamma, Y \vdash \lambda f : (\forall X.\, T \to Y).\, f\;[S]\; t : (\forall X.\, T \to Y) \to Y}\;\text{T-Abs}$$

$$\frac{\cdots}{\Gamma \vdash \Lambda Y.\, \lambda f : (\forall X.\, T \to Y).\, f\;[S]\; t : \forall Y.\, (\forall X.\, T \to Y) \to Y}\;\text{T-TAbs}$$

This is exactly the encoded type $\exists X.\, T$.

### 4.3 Encoding Unpack

The elimination form is encoded as:

$$\text{let } \{X, x\} = t_1 \text{ in } t_2 \;\triangleq\; t_1\;[T_2]\; (\Lambda X.\, \lambda x : T_1.\, t_2)$$

where $t_1 : \exists X.\, T_1 \triangleq \forall Y.\, (\forall X.\, T_1 \to Y) \to Y$ and $t_2 : T_2$ with $X \notin \text{FTV}(T_2)$.

**Type checking.** We have:

$$t_1 : \forall Y.\, (\forall X.\, T_1 \to Y) \to Y$$

$$t_1\;[T_2] : (\forall X.\, T_1 \to T_2) \to T_2$$

We need $\Lambda X.\, \lambda x : T_1.\, t_2 : \forall X.\, T_1 \to T_2$. This holds if $X, x : T_1 \vdash t_2 : T_2$ with $X \notin \text{FTV}(T_2)$, which is exactly the premise of T-Unpack.

So $t_1\;[T_2]\; (\Lambda X.\, \lambda x : T_1.\, t_2) : T_2$, as required.

### 4.4 Verification of the Encoding

Let us verify that pack followed by unpack reduces correctly.

$$\text{let } \{X, x\} = (\{*S, v\} \text{ as } \exists X.\, T) \text{ in } t_2$$

Encoding:

$$(\Lambda Y.\, \lambda f : (\forall X.\, T \to Y).\, f\;[S]\; v)\;[T_2]\; (\Lambda X.\, \lambda x : T.\, t_2)$$

Reduces:

$$\to (\lambda f : (\forall X.\, T \to T_2).\, f\;[S]\; v)\; (\Lambda X.\, \lambda x : T.\, t_2) \quad\text{(E-TAppTAbs)}$$

$$\to (\Lambda X.\, \lambda x : T.\, t_2)\;[S]\; v \quad\text{(E-AppAbs)}$$

$$\to (\lambda x : [X \mapsto S]\,T.\, [X \mapsto S]\,t_2)\; v \quad\text{(E-TAppTAbs)}$$

$$\to [x \mapsto v]\,([X \mapsto S]\,t_2) \quad\text{(E-AppAbs)}$$

$$= [X \mapsto S]\,[x \mapsto v]\,t_2$$

This is exactly the result of the E-UnpackPack rule. The encoding is operationally faithful.

### 4.5 Significance of the Encoding

**Theorem 4.2.** Existential types do not add expressive power to System F. Every System F term with existential types can be translated to pure System F (with only universal types) in a type-preserving and reduction-preserving way.

*Proof.* The encoding defined above provides the translation. We have shown that:
1. Packed types translate to encoded types (Definition 4.1).
2. Pack translates to a well-typed universal term (Section 4.2).
3. Unpack translates to a well-typed universal term (Section 4.3).
4. The key reduction (E-UnpackPack) is preserved (Section 4.4).

$\square$

**Remark.** Despite this encoding, existential types remain important as a conceptual and notational device. The encoding is a CPS (continuation-passing style) transform that obscures the programmer's intent. In practice, languages provide existential types as primitives or syntactic sugar.

---

## 5. Existential Types and Modules

### 5.1 The Module Analogy

Existential types provide a type-theoretic account of module systems. The correspondence is:

| Module concept | Existential type concept |
|----------------|--------------------------|
| Module signature | $\exists X.\, T$ (the existential type) |
| Module implementation | $\{*S, v\}$ as $\exists X.\, T$ (the package) |
| Abstract type | Type variable $X$ |
| Concrete type | Witness type $S$ |
| Module operations | Value $v$ of type $[X \mapsto S]\,T$ |
| Linking / opening | $\text{let } \{X, x\} = \cdots \text{ in } \cdots$ |

### 5.2 Example: ML-Style Modules as Existentials

In OCaml, a module signature:

```ocaml
module type COUNTER = sig
  type t
  val new_counter : t
  val increment : t -> t
  val get : t -> int
end
```

corresponds to:

$$\exists X.\, \{new\_counter : X,\; increment : X \to X,\; get : X \to \text{Int}\}$$

An implementation:

```ocaml
module Counter : COUNTER = struct
  type t = int
  let new_counter = 0
  let increment x = x + 1
  let get x = x
end
```

corresponds to:

$$\{*\text{Int},\; \{new\_counter = 0,\; increment = \lambda x.\, x + 1,\; get = \lambda x.\, x\}\}$$

$$\text{as } \exists X.\, \{new\_counter : X,\; increment : X \to X,\; get : X \to \text{Int}\}$$

The type $t$ is abstract outside the module --- clients cannot assume $t = \text{int}$. This is exactly the scope restriction of the unpack rule.

### 5.3 Multiple Representations and Abstraction Boundaries

With existential types, we can define multiple implementations of the same interface and swap them without affecting clients:

$$\text{counterNat} : \text{CounterADT} = \{*\text{Nat},\; \ldots\} \text{ as } \text{CounterADT}$$

$$\text{counterList} : \text{CounterADT} = \{*\text{List Unit},\; \ldots\} \text{ as } \text{CounterADT}$$

Both have the same type. A client written against the abstract interface works with either:

$$\text{let } \{X, c\} = \text{counterImpl} \text{ in } c.get\;(c.inc\;(c.inc\;c.new))$$

The type system guarantees that this client cannot contain code that distinguishes the two implementations.

### 5.4 Sharing Constraints and Multiple Abstract Types

Real module systems often need **multiple abstract types** and **sharing constraints** between them. Existential types can model these:

**Multiple abstract types:**

$$\exists X.\, \exists Y.\, \{f : X \to Y,\; g : Y \to X,\; x_0 : X\}$$

This hides two types simultaneously. A module can define multiple interrelated abstract types.

**Sharing constraints.** When two modules share a type, we need to express that their abstract types are the same. This is modeled by opening both modules and unifying their type variables:

$$\text{let } \{X_1, m_1\} = \text{mod}_1 \text{ in } \text{let } \{X_2, m_2\} = \text{mod}_2 \text{ in } t$$

If $X_1$ and $X_2$ must be the same, we need a **sharing constraint** $X_1 = X_2$. In System F's existential types, this is not directly expressible --- it requires extending the system with type equality constraints or dependent types. This is one of the limitations of modeling modules purely as existentials and motivates the richer module systems of ML (with functors and sharing specifications).

### 5.5 Limitations of the Existential-Types-as-Modules Analogy

While existential types capture the essence of data abstraction, real module systems have features that go beyond simple existentials:

1. **Functors** (parameterized modules): a functor takes a module as input and produces a module as output. This corresponds to a function from existential packages to existential packages, but the type theory needs dependent types to express the type dependencies precisely.

2. **Signatures and signature matching**: ML's signature matching is more flexible than the simple type-checking rule T-Pack, allowing coercion (dropping operations, making types abstract that were concrete).

3. **Opaque vs. transparent ascription**: OCaml distinguishes `M : S` (opaque: the abstract types in `S` are hidden) from `M :> S` (transparent: a deprecated notation, but the concept persists). The opaque case corresponds to existential packing.

4. **Recursive modules**: some module systems support recursive definitions between modules, which existential types do not directly model.

---

## 6. Existential Types and Object-Oriented Programming

### 6.1 Objects as Existential Packages

There is a deep connection between existential types and objects in OOP. An object bundles together:

1. **Hidden state** (instance variables) --- the representation type.
2. **Methods** that operate on the state.

This is precisely an existential package.

**Definition 6.1 (Object type as existential).**

$$\text{Object} = \exists X.\, \{state : X,\; method_1 : X \to T_1,\; \ldots,\; method_n : X \to T_n\}$$

An object is a package where:
- $X$ is the type of the internal state.
- $state : X$ is the current state.
- $method_i : X \to T_i$ is a method that reads the state.

For methods that modify state, we use:

$$method_i : X \to X$$

or more generally:

$$method_i : X \to T_i \times X \quad\text{(returning a result and a new state)}$$

### 6.2 Example: A Point Object

$$\text{PointType} = \exists X.\, \{state : X,\; getX : X \to \text{Nat},\; getY : X \to \text{Nat},\; move : X \to \text{Nat} \to \text{Nat} \to X\}$$

**Cartesian implementation:**

$$\text{cartesianPoint} = \{*\text{Nat} \times \text{Nat},\; \{$$

$$\quad state = (3, 4),$$

$$\quad getX = \lambda p : \text{Nat} \times \text{Nat}.\, \text{fst}\;p,$$

$$\quad getY = \lambda p : \text{Nat} \times \text{Nat}.\, \text{snd}\;p,$$

$$\quad move = \lambda p : \text{Nat} \times \text{Nat}.\, \lambda dx : \text{Nat}.\, \lambda dy : \text{Nat}.\, (\text{fst}\;p + dx, \text{snd}\;p + dy)$$

$$\}\} \text{ as } \text{PointType}$$

**Polar implementation:**

$$\text{polarPoint} = \{*\text{Nat} \times \text{Nat},\; \{$$

$$\quad state = (5, \theta),$$

$$\quad getX = \lambda p.\, \text{fst}\;p \cdot \cos(\text{snd}\;p),$$

$$\quad getY = \lambda p.\, \text{fst}\;p \cdot \sin(\text{snd}\;p),$$

$$\quad \ldots$$

$$\}\} \text{ as } \text{PointType}$$

Both have type $\text{PointType}$ and are interchangeable.

### 6.3 Method Dispatch and Late Binding

In OOP, **late binding** (or dynamic dispatch) means that the method called depends on the runtime type of the object, not the static type. With existential types, this is naturally modeled: each object carries its own methods, and calling a method simply invokes the function stored in the package.

Consider two point objects with different internal representations:

$$p_1 = \{*\text{Nat} \times \text{Nat},\; \{state = (3, 4),\; getX = \text{fst},\; \ldots\}\} \text{ as PointType}$$

$$p_2 = \{*\text{Float} \times \text{Float},\; \{state = (3.0, 4.0),\; getX = \text{fst},\; \ldots\}\} \text{ as PointType}$$

Both have type $\text{PointType}$. When we call $getX$ on either, the correct function is invoked --- the one from $p_1$'s record for $p_1$, and the one from $p_2$'s record for $p_2$. This is late binding: the behavior depends on which package was created, not on any static dispatch mechanism.

### 6.4 Subtyping and Existential Types

The interaction between existential types and subtyping leads to **bounded existential types**, which model objects with subtype constraints:

$$\exists X <: \text{PointInterface}.\, \{state : X,\; \ldots\}$$

This says: the hidden type $X$ is not arbitrary but is a subtype of $\text{PointInterface}$. This allows the client to use operations available on $\text{PointInterface}$ even though $X$ is abstract. Bounded existentials are studied in System F$_{<:}$ (TAPL Chapter 26).

### 6.5 The Universals/Existentials Duality in OOP

The duality between universal and existential types reflects a fundamental duality in software design:

- **Universal types (polymorphism)** correspond to **generic programming**: code that works with any type the user supplies. This is the perspective of **clients** or **consumers**.
- **Existential types (data abstraction)** correspond to **encapsulation**: modules that hide their representation. This is the perspective of **implementers** or **producers**.

Cook (2009) formalized this as:

| | ADTs (existentials) | Objects (universals + existentials) |
|---|---|---|
| Type abstraction | Single hidden type | Per-object hidden type |
| Operations | Functions on abstract type | Methods bundled with state |
| Extension | Closed (fixed set of operations) | Open (subclassing) |

---

## 7. Existential Types in Logic

### 7.1 Curry-Howard for Existentials

Under the Curry-Howard correspondence:

| Type theory | Logic |
|-------------|-------|
| $\exists X.\, T$ | $\exists X.\, P(X)$ |
| $\{*S, t\}$ as $\exists X.\, T$ | Proof of $\exists X.\, P(X)$ via witness $S$ |
| $\text{let } \{X, x\} = t_1 \text{ in } t_2$ | $\exists$-elimination |

**Existential introduction** in logic: to prove $\exists X.\, P(X)$, provide a witness $S$ and a proof of $P(S)$.

**Existential elimination** in logic: if $\exists X.\, P(X)$ holds and for all $X$, $P(X)$ implies $Q$ (where $X \notin \text{FV}(Q)$), then $Q$ holds.

The condition $X \notin \text{FTV}(T_2)$ in T-Unpack corresponds exactly to the restriction in $\exists$-elimination that the conclusion must not mention the bound variable.

### 7.2 Constructive Content

In constructive logic (which corresponds to type theory via Curry-Howard), an existential proof $\exists X.\, P(X)$ is a **pair** $(S, p)$ where $S$ is a witness and $p$ is a proof of $P(S)$. This is precisely what an existential package is.

In classical logic, one can prove $\exists X.\, P(X)$ without exhibiting a witness (e.g., by contradiction). This has no direct counterpart in type theory --- existential packages always require a concrete witness type.

---

## 8. Advanced Topics

### 8.1 Weak vs. Strong Existentials

The existential types we have defined are sometimes called **weak existentials** because the hidden type is truly abstract --- the unpack rule does not let the type escape. **Strong existentials** (or **strong sums**) would allow the type to be projected out:

$$\frac{\Gamma \vdash t : \exists X.\, T}{\Gamma \vdash \text{witness}(t) : \text{Type}} \quad\text{(strong projection)}$$

Strong existentials are essentially **dependent pairs** ($\Sigma$-types in dependent type theory), which we study in Module 08. The distinction is:

- **Weak existentials** ($\exists X.\, T$): scope restriction on $X$, data abstraction.
- **Strong existentials** ($\Sigma(X : \text{Type}).\, T$): no scope restriction, dependent pairs.

### 8.2 Existential Types and Skolemization

In logic, **Skolemization** replaces existential quantifiers with Skolem functions. The type-theoretic analogue is: an existential package $\exists X.\, T$ can be "Skolemized" by introducing a fresh abstract type constant $c$ and working with $[X \mapsto c]\,T$. This is essentially what unpack does --- it introduces $X$ as a fresh abstract type.

### 8.3 Binary Methods and Existentials

A well-known challenge for existential types in OOP is the **binary method problem**: methods that take another object of the same type as an argument.

Consider an equality interface:

$$\text{EqType} = \exists X.\, \{val : X,\; eq : X \to X \to \text{Bool}\}$$

An object of this type carries a value and an equality predicate on the hidden type. But two objects $o_1, o_2 : \text{EqType}$ may hide **different** types. We cannot compare $o_1.val$ with $o_2.val$ because their types ($X_1$ and $X_2$) are distinct abstract types.

This is a fundamental limitation: existential types give each object its own hidden type, but binary operations require both arguments to share the same type. Solutions include:

1. **Bounded existentials**: $\exists X <: \text{Eq}.\, \{val : X\}$ where $\text{Eq}$ provides the comparison method at a common supertype.
2. **GADTs**: generalized algebraic data types that can express type equalities.
3. **Type classes**: Haskell's approach avoids the problem by making the type a parameter of the class rather than hiding it existentially.

### 8.4 Existential Types in Haskell

In Haskell, existential types are expressed using the `ExistentialQuantification` or `GADTs` extension:

```haskell
data Showable = forall a. Show a => MkShowable a
```

This is an existential: `Showable` hides the type `a` but retains the `Show` constraint. A list `[Showable]` is a heterogeneous list where each element can be shown but may have a different type.

The encoding matches our theory: `MkShowable` is pack, pattern matching on `MkShowable` is unpack, and the abstract type cannot escape the pattern match scope.

### 8.5 First-Class Existentials vs. Module-Level Existentials

In System F, existential types are **first-class**: they can appear anywhere a type can appear --- as function arguments, return types, inside data structures, etc. This is more flexible than module systems like ML's, where abstract types are tied to module boundaries.

First-class existentials enable patterns like:

$$\text{List}\;(\exists X.\, \{val : X,\; show : X \to \text{String}\})$$

--- a **heterogeneous list** where each element hides its own type but provides a $\text{show}$ method. This is a type-theoretic formulation of the "existential antipattern" (or feature, depending on perspective) known from Haskell.

---

## Summary

Existential types ($\exists X.\, T$) are the formal counterpart of data abstraction. Key results:

1. **Pack** ($\{*S, t\}$ as $\exists X.\, T$) hides a representation type $S$ behind an abstract interface.
2. **Unpack** ($\text{let } \{X, x\} = t_1 \text{ in } t_2$) opens a package, with the constraint $X \notin \text{FTV}(T_2)$ enforcing abstraction.
3. **ADTs as existentials**: abstract data types are precisely existential packages.
4. **Encoding via universals**: $\exists X.\, T \triangleq \forall Y.\, (\forall X.\, T \to Y) \to Y$. Existentials are definable in pure System F.
5. **Modules**: existential types provide a type-theoretic foundation for module systems with abstract types.
6. **Objects**: objects in OOP can be modeled as existential packages bundling hidden state with methods.
7. **Type safety**: progress and preservation extend to System F with existentials.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapter 24: Existential Types. The primary reference for this lecture.
2. **Mitchell, J. C. and Plotkin, G. D.** (1988). Abstract types have existential type. *ACM Transactions on Programming Languages and Systems*, 10(3), 470--502. The seminal paper connecting ADTs to existential types.
3. **Cardelli, L. and Wegner, P.** (1985). On understanding types, data abstraction, and polymorphism. *Computing Surveys*, 17(4), 471--523.
4. **Reynolds, J. C.** (1983). Types, abstraction and parametric polymorphism. In *Information Processing 83*, ed. R. E. A. Mason, North-Holland. Connects data abstraction to parametricity.
5. **Cook, W. R.** (2009). On understanding data abstraction, revisited. In *Proc. OOPSLA 2009*. Clarifies the distinction between ADTs (existentials) and objects.
6. **Harper, R.** (2016). *Practical Foundations for Programming Languages*, 2nd ed. Chapter 17: Abstract Types.
7. **Crary, K., Weirich, S., and Morrisett, G.** (2002). Intensional polymorphism in type-erasure semantics. *Journal of Functional Programming*, 12(6), 567--600.
