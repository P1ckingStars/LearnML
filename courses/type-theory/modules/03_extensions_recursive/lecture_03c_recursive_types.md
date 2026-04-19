---
title: "Lecture 03c: Recursive Types -- Iso-Recursive & Equi-Recursive"
tags:
  - type-theory
  - extensions
  - lecture
---
# Lecture 03c: Recursive Types -- Iso-Recursive & Equi-Recursive

> **Module 03 -- Extensions & Recursive Types (Weeks 5-6)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** why recursive types are necessary for encoding common data structures (lists, trees, streams) and why naive type-level recursion is problematic.
2. **Define** the $\mu X.\, T$ notation for recursive types and perform substitution of the recursive type for the bound variable.
3. **Distinguish** between iso-recursive and equi-recursive approaches, stating the key definitions and trade-offs of each.
4. **State** the typing rules for $\text{fold}$ and $\text{unfold}$ in the iso-recursive approach and construct typing derivations for recursive data structures.
5. **Define** the coinductive type equivalence relation used in the equi-recursive approach and explain the Amber rules for recursive subtyping.
6. **Encode** standard data structures (natural numbers, lists, binary trees, streams) as recursive types and derive their constructors and destructors.
7. **Demonstrate** how recursive types enable self-application and thereby general recursion in a typed setting.
8. **Prove** type safety for STLC extended with iso-recursive types.

---

## 1. Motivation

### 1.1 The Problem

Consider the type of lists of natural numbers. Informally, a list is either empty or a pair of a natural number and another list:

$$\text{NatList} = \text{Unit} + (\text{Nat} \times \text{NatList})$$

This is a **recursive type equation**: the type $\text{NatList}$ appears in its own definition. In the type systems we have studied so far, this equation has no solution -- there is no finite type expression that satisfies it.

The same issue arises for:

- **Binary trees:** $\text{Tree} = \text{Leaf} + (\text{Tree} \times \text{Tree})$
- **Streams:** $\text{Stream}\;T = T \times (\text{Unit} \to \text{Stream}\;T)$
- **Process types:** $\text{Proc} = \text{Msg} \to (\text{Response} \times \text{Proc})$

Without recursive types, we cannot assign types to programs that manipulate such structures.

### 1.2 Two Approaches

There are two fundamentally different ways to handle the equation $\text{NatList} = \text{Unit} + (\text{Nat} \times \text{NatList})$:

1. **Iso-recursive types:** The type $\mu X.\, \text{Unit} + (\text{Nat} \times X)$ is defined as a new type that is *isomorphic* to its one-step unfolding, but not *equal* to it. Explicit $\text{fold}$ and $\text{unfold}$ operations witness the isomorphism.

2. **Equi-recursive types:** The type $\mu X.\, \text{Unit} + (\text{Nat} \times X)$ is *equal* to its unfolding $\text{Unit} + (\text{Nat} \times \mu X.\, \text{Unit} + (\text{Nat} \times X))$. Types are identified up to unfolding, forming infinite regular trees.

Both approaches are sound and have been used in practice. Iso-recursive types correspond to algebraic data types in ML and Haskell. Equi-recursive types appear in some object-oriented type systems and in certain theoretical developments.

---

## 2. Core Theory: Iso-Recursive Types

### 2.1 Syntax

We extend the type and term syntax:

**Types:**

$$T ::= \ldots \mid X \mid \mu X.\, T$$

where $X$ ranges over type variables. The type $\mu X.\, T$ binds $X$ in $T$.

**Terms:**

$$t ::= \ldots \mid \text{fold}[\mu X.\,T]\;t \mid \text{unfold}[\mu X.\,T]\;t$$

The $\text{fold}$ operation wraps a value into the recursive type. The $\text{unfold}$ operation unwraps it. We sometimes abbreviate the type annotation when it is clear from context, writing simply $\text{fold}\;t$ and $\text{unfold}\;t$.

**Values:**

$$v ::= \ldots \mid \text{fold}[\mu X.\,T]\;v$$

A folded value is itself a value. This is important: we can pattern-match on recursive data only after unfolding.

### 2.2 Unfolding

The key operation on recursive types is **unfolding**: substituting the recursive type itself for the bound variable.

**Definition 2.1 (Unfolding).** Let $U = \mu X.\, T$. The **one-step unfolding** of $U$ is:

$$\text{unfold}(U) = [X \mapsto \mu X.\, T]\,T$$

For example, if $U = \mu X.\, \text{Unit} + (\text{Nat} \times X)$, then:

$$\text{unfold}(U) = \text{Unit} + (\text{Nat} \times \mu X.\, \text{Unit} + (\text{Nat} \times X)) = \text{Unit} + (\text{Nat} \times U)$$

### 2.3 Typing Rules

The iso-recursive approach uses two typing rules that establish an isomorphism between $\mu X.\, T$ and its unfolding $[X \mapsto \mu X.\, T]\,T$:

$$\frac{\Gamma \vdash t : [X \mapsto \mu X.\,T]\,T}{\Gamma \vdash \text{fold}[\mu X.\,T]\;t : \mu X.\,T} \quad \text{(T-Fold)}$$

$$\frac{\Gamma \vdash t : \mu X.\,T}{\Gamma \vdash \text{unfold}[\mu X.\,T]\;t : [X \mapsto \mu X.\,T]\,T} \quad \text{(T-Unfold)}$$

**Reading T-Fold:** If $t$ has the unfolded type, then $\text{fold}\;t$ has the recursive type.

**Reading T-Unfold:** If $t$ has the recursive type, then $\text{unfold}\;t$ has the unfolded type.

These rules establish that $\mu X.\, T$ is isomorphic to $[X \mapsto \mu X.\, T]\,T$ via the pair $(\text{fold}, \text{unfold})$:

$$\text{fold} : [X \mapsto \mu X.\,T]\,T \to \mu X.\,T$$

$$\text{unfold} : \mu X.\,T \to [X \mapsto \mu X.\,T]\,T$$

### 2.4 Evaluation Rules

$$\frac{t \to t'}{\text{fold}[\mu X.\,T]\;t \to \text{fold}[\mu X.\,T]\;t'} \quad \text{(E-Fold)}$$

$$\frac{t \to t'}{\text{unfold}[\mu X.\,T]\;t \to \text{unfold}[\mu X.\,T]\;t'} \quad \text{(E-Unfold)}$$

$$\frac{}{\text{unfold}[\mu X.\,T]\;(\text{fold}[\mu X.\,T]\;v) \to v} \quad \text{(E-UnfoldFold)}$$

The key computation rule is E-UnfoldFold: unfolding a folded value yields the original value. Together with the fact that $\text{fold}\;v$ is a value, this means that fold/unfold pairs cancel out during evaluation.

### 2.5 Type Safety

**Canonical Forms Lemma (Recursive Types).** If $\vdash v : \mu X.\, T$, then $v = \text{fold}[\mu X.\, T]\;v'$ for some value $v'$ with $\vdash v' : [X \mapsto \mu X.\, T]\,T$.

*Proof.* By inspection of the typing rules, the only way to derive $\vdash v : \mu X.\, T$ for a value $v$ is via T-Fold (since values must be syntactic values, and $\text{fold}\;v'$ is the only value form of recursive type). $\square$

**Theorem 2.2 (Progress for STLC + $\mu$).** If $\vdash t : T$, then either $t$ is a value or there exists $t'$ such that $t \to t'$.

*Proof.* By induction on the typing derivation. The new cases are:

**Case T-Fold:** $t = \text{fold}\;t_1$ with $\vdash t_1 : [X \mapsto \mu X.\, S]\,S$.

By IH, either $t_1$ is a value (so $\text{fold}\;t_1$ is a value) or $t_1 \to t_1'$ (so $\text{fold}\;t_1 \to \text{fold}\;t_1'$ by E-Fold).

**Case T-Unfold:** $t = \text{unfold}\;t_1$ with $\vdash t_1 : \mu X.\, S$.

By IH, either $t_1$ is a value or $t_1 \to t_1'$.

- If $t_1 \to t_1'$, apply E-Unfold.
- If $t_1$ is a value, by the canonical forms lemma, $t_1 = \text{fold}\;v$ for some $v$. Apply E-UnfoldFold. $\square$

**Theorem 2.3 (Preservation for STLC + $\mu$).** If $\vdash t : T$ and $t \to t'$, then $\vdash t' : T$.

*Proof.* By induction on $t \to t'$.

**Case E-Fold:** $\text{fold}\;t_1 \to \text{fold}\;t_1'$ where $t_1 \to t_1'$. By inversion of T-Fold, $\vdash t_1 : [X \mapsto \mu X.\,S]\,S$. By IH, $\vdash t_1' : [X \mapsto \mu X.\, S]\,S$. By T-Fold, $\vdash \text{fold}\;t_1' : \mu X.\, S$.

**Case E-Unfold:** $\text{unfold}\;t_1 \to \text{unfold}\;t_1'$ where $t_1 \to t_1'$. By inversion of T-Unfold, $\vdash t_1 : \mu X.\, S$. By IH, $\vdash t_1' : \mu X.\, S$. By T-Unfold, $\vdash \text{unfold}\;t_1' : [X \mapsto \mu X.\, S]\,S$.

**Case E-UnfoldFold:** $\text{unfold}\;(\text{fold}\;v) \to v$.

The term $\text{unfold}\;(\text{fold}\;v)$ has type $[X \mapsto \mu X.\, S]\,S$ (by T-Unfold). By inversion, $\text{fold}\;v$ has type $\mu X.\, S$ (from the premise of T-Unfold). By inversion of T-Fold, $v$ has type $[X \mapsto \mu X.\, S]\,S$. This is exactly the required type. $\square$

---

## 3. Encoding Data Structures

### 3.1 Natural Numbers

$$\text{Nat} = \mu X.\, \text{Unit} + X$$

The unfolding is $\text{Unit} + \text{Nat}$, representing either zero ($\text{inl}\;\text{unit}$) or the successor of a natural number ($\text{inr}\;n$).

**Constructors:**

$$\text{zero} = \text{fold}[\text{Nat}]\;(\text{inl}\;\text{unit}) : \text{Nat}$$

$$\text{succ} = \lambda n : \text{Nat}.\, \text{fold}[\text{Nat}]\;(\text{inr}\;n) : \text{Nat} \to \text{Nat}$$

**Destructor (predecessor):**

$$\text{pred} = \lambda n : \text{Nat}.\, \text{case}\;(\text{unfold}[\text{Nat}]\;n)\;\text{of}$$

$$\quad \text{inl}\;\_ \Rightarrow \text{zero}$$

$$\quad \mid\; \text{inr}\;m \Rightarrow m$$

**Checking zero:**

$$\text{iszero} = \lambda n : \text{Nat}.\, \text{case}\;(\text{unfold}[\text{Nat}]\;n)\;\text{of}$$

$$\quad \text{inl}\;\_ \Rightarrow \text{true}$$

$$\quad \mid\; \text{inr}\;\_ \Rightarrow \text{false}$$

### 3.2 Lists

$$\text{List}\;T = \mu X.\, \text{Unit} + (T \times X)$$

The unfolding is $\text{Unit} + (T \times \text{List}\;T)$: either empty or a head-tail pair.

**Constructors:**

$$\text{nil} = \text{fold}\;(\text{inl}\;\text{unit}) : \text{List}\;T$$

$$\text{cons} = \lambda h : T.\, \lambda t : \text{List}\;T.\, \text{fold}\;(\text{inr}\;(h, t)) : T \to \text{List}\;T \to \text{List}\;T$$

**Pattern matching on a list:**

To examine a list, we unfold it and case-analyze:

$$\text{match\_list} = \lambda l : \text{List}\;T.\, \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad \text{inl}\;\_ \Rightarrow \ldots \text{(nil case)}$$

$$\quad \mid\; \text{inr}\;p \Rightarrow \text{let } h = \pi_1\;p \text{ in let } t = \pi_2\;p \text{ in } \ldots \text{(cons case)}$$

**Example: length function.**

$$\text{length} = \text{fix}\;(\lambda f : \text{List}\;\text{Nat} \to \text{Nat}.\, \lambda l : \text{List}\;\text{Nat}.$$

$$\quad \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow 0$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow 1 + f\;(\pi_2\;p))$$

This uses the $\text{fix}$ operator (Lecture 03d) for recursion. The $\text{unfold}$ exposes the sum structure, and $\text{case}$ dispatches on nil vs. cons.

**Example: map function.**

$$\text{map} = \Lambda A.\, \Lambda B.\, \lambda g : A \to B.\, \text{fix}\;(\lambda f : \text{List}\;A \to \text{List}\;B.\, \lambda l : \text{List}\;A.$$

$$\quad \text{case}\;(\text{unfold}\;l)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow \text{nil}$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow \text{cons}\;(g\;(\pi_1\;p))\;(f\;(\pi_2\;p)))$$

### 3.3 Binary Trees

$$\text{Tree}\;T = \mu X.\, T + (X \times X)$$

A tree is either a leaf containing a value of type $T$, or an internal node with left and right subtrees.

**Constructors:**

$$\text{leaf} = \lambda v : T.\, \text{fold}\;(\text{inl}\;v) : T \to \text{Tree}\;T$$

$$\text{node} = \lambda l : \text{Tree}\;T.\, \lambda r : \text{Tree}\;T.\, \text{fold}\;(\text{inr}\;(l, r)) : \text{Tree}\;T \to \text{Tree}\;T \to \text{Tree}\;T$$

**Example: tree size.**

$$\text{size} = \text{fix}\;(\lambda f : \text{Tree}\;\text{Nat} \to \text{Nat}.\, \lambda t : \text{Tree}\;\text{Nat}.$$

$$\quad \text{case}\;(\text{unfold}\;t)\;\text{of}$$

$$\quad\quad \text{inl}\;\_ \Rightarrow 1$$

$$\quad\quad \mid\; \text{inr}\;p \Rightarrow f\;(\pi_1\;p) + f\;(\pi_2\;p))$$

### 3.4 Streams (Infinite Data)

$$\text{Stream}\;T = \mu X.\, T \times X$$

A stream is a pair of a head element and a tail stream. Note that there is no $\text{Unit}$ alternative: streams are necessarily infinite.

**Destructors:**

$$\text{head} = \lambda s : \text{Stream}\;T.\, \pi_1\;(\text{unfold}\;s) : \text{Stream}\;T \to T$$

$$\text{tail} = \lambda s : \text{Stream}\;T.\, \pi_2\;(\text{unfold}\;s) : \text{Stream}\;T \to \text{Stream}\;T$$

**Example: stream of ones.**

$$\text{ones} = \text{fix}\;(\lambda s : \text{Stream}\;\text{Nat}.\, \text{fold}\;(1, s)) : \text{Stream}\;\text{Nat}$$

This is a productive corecursive definition: it generates an infinite stream $1, 1, 1, \ldots$ The $\text{fold}$ delays the recursive reference to $s$ inside the product, ensuring that $\text{unfold}$ is needed to access the tail.

**Remark on productivity.** Not all recursive definitions of streams are productive. The definition $\text{fix}\;(\lambda s.\, s)$ would diverge without producing any elements. Ensuring productivity of corecursive definitions is a nontrivial problem related to guardedness conditions in proof assistants like Coq and Agda.

### 3.5 Rose Trees (Multi-Way Trees)

A rose tree is a tree where each node has an arbitrary number of children, stored as a list:

$$\text{Rose}\;T = \mu X.\, T \times \text{List}\;X$$

where $\text{List}\;X = \mu Y.\, \text{Unit} + (X \times Y)$.

This requires **nested recursive types**: the body of the outer $\mu$ contains another recursive type. The fold/unfold operations work at each level independently.

**Constructors:**

$$\text{rnode} = \lambda v : T.\, \lambda \textit{children} : \text{List}\;(\text{Rose}\;T).\, \text{fold}[\text{Rose}\;T]\;(v, \textit{children})$$

### 3.6 Optional/Maybe Type

The optional type can be encoded as a simple (non-recursive) sum:

$$\text{Option}\;T = \text{Unit} + T$$

with $\text{none} = \text{inl}\;\text{unit}$ and $\text{some} = \lambda v : T.\, \text{inr}\;v$.

But we mention it here because it often appears as the "base case" of recursive types. For instance, a list can be seen as:

$$\text{List}\;T = \mu X.\, \text{Option}\;(T \times X) = \mu X.\, \text{Unit} + (T \times X)$$

### 3.7 Detailed Typing Derivation: List Cons

We give a complete typing derivation for $\text{cons}\;3\;\text{nil}$ where:

$$L = \text{List}\;\text{Nat} = \mu X.\, \text{Unit} + (\text{Nat} \times X)$$

**Step 1:** Type $\text{nil}$.

$$\frac{\vdash \text{unit} : \text{Unit}}{\vdash \text{inl}\;\text{unit} : \text{Unit} + (\text{Nat} \times L)} \quad \text{(T-Inl)}$$

$$\frac{\vdash \text{inl}\;\text{unit} : [X \mapsto L]\,(\text{Unit} + (\text{Nat} \times X))}{\vdash \text{fold}[L]\;(\text{inl}\;\text{unit}) : L} \quad \text{(T-Fold)}$$

Note that $[X \mapsto L]\,(\text{Unit} + (\text{Nat} \times X)) = \text{Unit} + (\text{Nat} \times L)$, which matches.

**Step 2:** Type $\text{cons}\;3\;\text{nil}$.

We need $(3, \text{nil}) : \text{Nat} \times L$:

$$\frac{\vdash 3 : \text{Nat} \quad \vdash \text{nil} : L}{\vdash (3, \text{nil}) : \text{Nat} \times L} \quad \text{(T-Pair)}$$

Then:

$$\frac{\vdash (3, \text{nil}) : \text{Nat} \times L}{\vdash \text{inr}\;(3, \text{nil}) : \text{Unit} + (\text{Nat} \times L)} \quad \text{(T-Inr)}$$

$$\frac{\vdash \text{inr}\;(3, \text{nil}) : [X \mapsto L]\,(\text{Unit} + (\text{Nat} \times X))}{\vdash \text{fold}[L]\;(\text{inr}\;(3, \text{nil})) : L} \quad \text{(T-Fold)}$$

### 3.8 Detailed Evaluation: List Pattern Matching

Consider evaluating $\text{head}\;(\text{cons}\;3\;\text{nil})$ where:

$$\text{head} = \lambda l : L.\, \text{case}\;(\text{unfold}[L]\;l)\;\text{of}\;\text{inl}\;\_ \Rightarrow 0 \mid \text{inr}\;p \Rightarrow \pi_1\;p$$

Substituting $l = \text{cons}\;3\;\text{nil} = \text{fold}[L]\;(\text{inr}\;(3, \text{nil}))$:

$$\text{case}\;(\text{unfold}[L]\;(\text{fold}[L]\;(\text{inr}\;(3, \text{nil}))))\;\text{of}\;\ldots$$

$$\to \text{case}\;(\text{inr}\;(3, \text{nil}))\;\text{of}\;\text{inl}\;\_ \Rightarrow 0 \mid \text{inr}\;p \Rightarrow \pi_1\;p \quad \text{(E-UnfoldFold)}$$

$$\to \pi_1\;(3, \text{nil}) \quad \text{(E-CaseInr, with } p \mapsto (3, \text{nil}))$$

$$\to 3 \quad \text{(E-ProjPair)}$$

---

## 4. Self-Application and Recursive Types

### 4.1 The Problem of Self-Application

In the untyped lambda calculus, the term $\lambda x.\, x\;x$ is perfectly well-formed. But in STLC, it is untypable. To type $x\;x$, we would need $x$ to have both a function type $A \to B$ and to be an argument of type $A$ -- that is, $A = A \to B$. This equation has no finite solution.

### 4.2 The Solution via Recursive Types

With recursive types, we can solve $A = A \to B$:

$$D = \mu X.\, X \to B$$

The unfolding of $D$ is $D \to B$. A term of type $D$ can be unfolded to obtain a function from $D$ to $B$, and then applied to another term of type $D$.

**Self-application:**

$$\text{selfapp} = \lambda x : D.\, (\text{unfold}\;x)\;x : D \to B$$

**Typing derivation:**

1. $x : D \vdash x : D$ (by T-Var).
2. $x : D \vdash \text{unfold}\;x : [X \mapsto D]\,(X \to B) = D \to B$ (by T-Unfold).
3. $x : D \vdash (\text{unfold}\;x)\;x : B$ (by T-App, since $\text{unfold}\;x : D \to B$ and $x : D$).
4. $\vdash \lambda x : D.\, (\text{unfold}\;x)\;x : D \to B$ (by T-Abs).

### 4.3 Self-Application of Self-Application

We can apply $\text{selfapp}$ to itself (after folding):

$$\text{fold}\;(\text{selfapp}) : D$$

$$\text{selfapp}\;(\text{fold}\;(\text{selfapp}))$$

$$= (\lambda x : D.\, (\text{unfold}\;x)\;x)\;(\text{fold}\;(\text{selfapp}))$$

$$\to (\text{unfold}\;(\text{fold}\;(\text{selfapp})))\;(\text{fold}\;(\text{selfapp}))$$

$$\to \text{selfapp}\;(\text{fold}\;(\text{selfapp}))$$

$$\to \ldots$$

This diverges. We have constructed a well-typed nonterminating program, demonstrating that STLC + recursive types is not strongly normalizing.

### 4.4 Consequences for Normalization

**Theorem 4.1.** STLC extended with iso-recursive types does not have the strong normalization property.

*Proof.* The term $(\lambda x : D.\, (\text{unfold}\;x)\;x)\;(\text{fold}\;(\lambda x : D.\, (\text{unfold}\;x)\;x))$ is well typed (as shown above) but reduces to itself in two steps, hence diverges. $\square$

This is a fundamental trade-off: recursive types add the expressiveness needed for recursive data structures and general recursion, but at the cost of losing the guarantee that all well-typed programs terminate.

### 4.5 The Omega Combinator, Typed

The simplest diverging term in the untyped lambda calculus is $\Omega = (\lambda x.\, x\;x)\;(\lambda x.\, x\;x)$. With recursive types, we can type it:

Let $D = \mu X.\, X \to \text{Unit}$ (or indeed $\mu X.\, X \to T$ for any $T$).

$$\omega = \lambda x : D.\, (\text{unfold}\;x)\;x : D \to T$$

$$\Omega_T = \omega\;(\text{fold}\;\omega) : T$$

Evaluation:

$$\omega\;(\text{fold}\;\omega)$$

$$= (\lambda x : D.\, (\text{unfold}\;x)\;x)\;(\text{fold}\;\omega)$$

$$\to (\text{unfold}\;(\text{fold}\;\omega))\;(\text{fold}\;\omega)$$

$$\to \omega\;(\text{fold}\;\omega)$$

$$\to \ldots$$

This is a well-typed term of any type $T$ that diverges. Observe the parallel with Curry's paradox (Lecture 03d).

### 4.6 Encoding Church Numerals as a Recursive Type

An alternative encoding of natural numbers uses function iteration (Church numerals). With recursive types, we can give Church numerals a precise type:

$$\text{ChurchNat} = \forall X.\, (X \to X) \to X \to X$$

This does not require recursive types (it uses polymorphism). However, we can relate it to the recursive encoding. The recursive type $\text{Nat} = \mu X.\, \text{Unit} + X$ and the Church encoding $\text{ChurchNat}$ are isomorphic in the sense that there exist functions:

$$\text{toChurch} : \text{Nat} \to \text{ChurchNat}$$

$$\text{fromChurch} : \text{ChurchNat} \to \text{Nat}$$

that are mutually inverse. The $\mu$-type encoding is more direct for pattern matching; the Church encoding is more direct for iteration.

---

## 5. Equi-Recursive Types

### 5.1 The Equi-Recursive Approach

In the equi-recursive approach, we treat the recursive type $\mu X.\, T$ as **definitionally equal** to its unfolding $[X \mapsto \mu X.\, T]\,T$:

$$\mu X.\, T = [X \mapsto \mu X.\, T]\,T$$

There are no explicit fold/unfold operations. Instead, the type checker automatically recognizes that a recursive type and its unfolding are the same type.

### 5.2 Types as Infinite Trees

The equi-recursive view identifies types with their infinite unfoldings. Consider $\text{Nat} = \mu X.\, \text{Unit} + X$:

$$\text{Nat} = \text{Unit} + \text{Nat}$$

$$= \text{Unit} + (\text{Unit} + \text{Nat})$$

$$= \text{Unit} + (\text{Unit} + (\text{Unit} + \text{Nat}))$$

$$= \ldots$$

The infinite unfolding is the infinite tree:

```
        +
       / \
    Unit    +
           / \
        Unit    +
               / \
            Unit   ...
```

A recursive type $\mu X.\, T$ is identified with this infinite tree, and two recursive types are equal if and only if they have the same infinite tree unfolding.

**Definition 5.1 (Regular tree).** A (possibly infinite) tree is **regular** if it has only finitely many distinct subtrees. Every recursive type $\mu X.\, T$ (with finitely many type constructors) unfolds to a regular tree.

### 5.3 Coinductive Type Equivalence

We define type equivalence for equi-recursive types coinductively. Two types $S$ and $T$ are equivalent, written $S \equiv T$, if they are related by the largest relation (greatest fixed point) satisfying certain conditions.

**Definition 5.2 (Coinductive type equivalence).** A relation $R$ on types is a **type equivalence relation** if whenever $(S, T) \in R$:

1. If the outermost constructor of (the unfolding of) $S$ and $T$ are both $\to$, with $S = S_1 \to S_2$ and $T = T_1 \to T_2$, then $(S_1, T_1) \in R$ and $(S_2, T_2) \in R$.
2. If both are $\times$, with $S = S_1 \times S_2$ and $T = T_1 \times T_2$, then $(S_1, T_1) \in R$ and $(S_2, T_2) \in R$.
3. If both are $+$, with $S = S_1 + S_2$ and $T = T_1 + T_2$, then $(S_1, T_1) \in R$ and $(S_2, T_2) \in R$.
4. If both are base types, they must be the same base type.
5. Before comparing, any $\mu$-bound type is unfolded: $\mu X.\, T$ is treated as $[X \mapsto \mu X.\, T]\,T$.

Type equivalence $S \equiv T$ holds iff $(S, T)$ is in the greatest such relation.

**Intuition.** The coinductive approach says: two types are equivalent if, at every finite depth of observation, they look the same. This is a "top-down" definition -- we never need to reach a base case, which is essential since the types may be infinite.

### 5.4 The Amber Rules

For practical type checking, we need an algorithmic characterization of equi-recursive type equivalence. The **Amber rules** (named after Cardone and Coppo's Amber system) provide such a characterization using an explicit set of assumptions.

The judgment $A \vdash S \equiv T$ means "under assumptions $A$, types $S$ and $T$ are equivalent," where $A$ is a set of pairs of type variables.

$$\frac{(X, Y) \in A}{A \vdash X \equiv Y} \quad \text{(EQ-Var)}$$

$$\frac{}{A \vdash \text{Bool} \equiv \text{Bool}} \quad \text{(EQ-Bool)}$$

$$\frac{}{A \vdash \text{Nat} \equiv \text{Nat}} \quad \text{(EQ-Nat)}$$

$$\frac{}{A \vdash \text{Unit} \equiv \text{Unit}} \quad \text{(EQ-Unit)}$$

$$\frac{A \vdash S_1 \equiv T_1 \quad A \vdash S_2 \equiv T_2}{A \vdash S_1 \to S_2 \equiv T_1 \to T_2} \quad \text{(EQ-Arrow)}$$

$$\frac{A \vdash S_1 \equiv T_1 \quad A \vdash S_2 \equiv T_2}{A \vdash S_1 \times S_2 \equiv T_1 \times T_2} \quad \text{(EQ-Prod)}$$

$$\frac{A \vdash S_1 \equiv T_1 \quad A \vdash S_2 \equiv T_2}{A \vdash S_1 + S_2 \equiv T_1 + T_2} \quad \text{(EQ-Sum)}$$

$$\frac{A \cup \{(X, Y)\} \vdash S \equiv T}{A \vdash \mu X.\, S \equiv \mu Y.\, T} \quad \text{(EQ-Rec)}$$

The key rule is EQ-Rec: to check that $\mu X.\, S \equiv \mu Y.\, T$, we add the assumption $(X, Y)$ to the context and check that the bodies $S$ and $T$ are equivalent. The assumption records that $X$ and $Y$ are "co-bound" and should be treated as equivalent when encountered.

**Example.** To check $\mu X.\, \text{Nat} \times X \equiv \mu Y.\, \text{Nat} \times Y$:

By EQ-Rec, we add $(X, Y)$ to $A$ and check $\{(X, Y)\} \vdash \text{Nat} \times X \equiv \text{Nat} \times Y$.

By EQ-Prod, we need $\{(X, Y)\} \vdash \text{Nat} \equiv \text{Nat}$ (by EQ-Nat) and $\{(X, Y)\} \vdash X \equiv Y$ (by EQ-Var). Both hold.

**Example.** To check $\mu X.\, X \to \text{Nat} \equiv \mu Y.\, (\mu Z.\, Z \to \text{Nat}) \to \text{Nat}$:

By EQ-Rec, add $(X, Y)$ and check $\{(X, Y)\} \vdash X \to \text{Nat} \equiv (\mu Z.\, Z \to \text{Nat}) \to \text{Nat}$.

By EQ-Arrow, we need $\{(X, Y)\} \vdash X \equiv \mu Z.\, Z \to \text{Nat}$ and $\{(X, Y)\} \vdash \text{Nat} \equiv \text{Nat}$.

The second holds by EQ-Nat. The first requires checking $X \equiv \mu Z.\, Z \to \text{Nat}$. But $X$ is a type variable and $\mu Z.\, Z \to \text{Nat}$ is a $\mu$-type. We cannot apply EQ-Var (the pair $(X, \mu Z.\, Z \to \text{Nat})$ is not in $A$). This fails -- the two types are not equivalent under the Amber rules.

In fact, they *are* equivalent as infinite trees (both unfold to $(\ldots \to \text{Nat}) \to \text{Nat}$). The Amber rules are incomplete for arbitrary equi-recursive type equivalence, but they are complete for a restricted class of "contractive" recursive types.

### 5.5 Contractiveness

**Definition 5.3 (Contractive).** A type $\mu X.\, T$ is **contractive** if $X$ does not occur free at the "top level" of $T$ -- that is, $T$ is not of the form $X$, and unfolding $T$ always passes through at least one type constructor ($\to$, $\times$, $+$, $\text{Ref}$, etc.) before reaching $X$.

Examples:
- $\mu X.\, \text{Nat} \to X$ is contractive (the $\to$ separates $X$ from the top level).
- $\mu X.\, X$ is **not** contractive (but this type is degenerate anyway -- it has no values).
- $\mu X.\, \mu Y.\, X \to Y$ is contractive.

For contractive recursive types, the Amber rules are both sound and complete for equi-recursive type equivalence.

**Example of a non-contractive type.** The type $\mu X.\, X$ is non-contractive because $X$ occurs at the "top level" of the body. This type has no values (or rather, all of its values diverge when you try to use them). Unfolding gives $\mu X.\, X$ again -- the type is "empty" in a strong sense.

Another non-contractive type is $\mu X.\, \mu Y.\, X$. Here the outer $\mu$ binds $X$, and $X$ occurs at the top level of $\mu Y.\, X$ (after noting that $Y$ is vacuous).

**Why contractiveness matters.** The Amber rules work by adding assumptions $(X, Y)$ when comparing $\mu X.\, S$ with $\mu Y.\, T$, then checking the bodies. If the bodies immediately use $X$ and $Y$ at the top level (non-contractive), the algorithm may not make progress -- it relies on the bodies "moving past" at least one type constructor before hitting the recursive variable, which gives the algorithm a structural argument for termination.

### 5.6 Decidability

**Theorem 5.4.** Equi-recursive type equivalence for contractive regular recursive types is decidable.

*Proof sketch.* The Amber rules provide a decision procedure. The assumption set $A$ grows by one pair at each EQ-Rec application. Since there are finitely many type variables and each variable is bound by at most one $\mu$, the assumption set is bounded. If a pair $(X, Y)$ is encountered that is already in $A$, EQ-Var succeeds immediately. If the algorithm reaches a point where no rule applies, the types are not equivalent. The algorithm terminates because the depth of the proof tree is bounded by the number of $\mu$-binders. $\square$

---

## 6. Comparison: Iso-Recursive vs. Equi-Recursive

| Property | Iso-Recursive | Equi-Recursive |
|----------|---------------|----------------|
| Type equality | $\mu X.\, T \neq [X \mapsto \mu X.\, T]\,T$ | $\mu X.\, T = [X \mapsto \mu X.\, T]\,T$ |
| Fold/Unfold | Explicit (syntactic) | Implicit (type-level) |
| Type checking | Straightforward (syntax-directed) | Requires coinductive reasoning |
| Implementation | ML, Haskell, Rust | Some OO type systems, $\mu$-calculus |
| Overhead | Programmer writes fold/unfold | No overhead; more complex type checker |
| Metatheory | Standard induction | Coinductive techniques |

**In practice.** The iso-recursive approach is dominant in functional languages. In OCaml, for instance, defining an algebraic data type like:

```
type nat = Zero | Succ of nat
```

introduces constructors (`Zero`, `Succ`) that play the role of `fold`, and pattern matching plays the role of `unfold`. The programmer never writes explicit fold/unfold -- the data type declaration generates them.

The equi-recursive approach is more natural for object-oriented type systems where recursive object types (a class that references itself) should be transparent. For example, a `List` class with a `next` field of type `List` naturally requires equi-recursive types.

---

## 7. Recursive Subtyping

### 7.1 Subtyping for Recursive Types

When recursive types are combined with subtyping (Module 04), we need subtyping rules for $\mu$-types. In the equi-recursive setting, this is defined coinductively.

**Definition 7.1 (Recursive subtyping).** A relation $R$ on types is a **subtype simulation** if whenever $(S, T) \in R$:

1. If $T$ unfolds to $T_1 \to T_2$ and $S$ unfolds to $S_1 \to S_2$, then $(T_1, S_1) \in R$ (contravariant in domain) and $(S_2, T_2) \in R$ (covariant in codomain).
2. If $T$ unfolds to $T_1 \times T_2$ and $S$ unfolds to $S_1 \times S_2$, then $(S_1, T_1) \in R$ and $(S_2, T_2) \in R$.
3. Similarly for other type constructors.

$S <: T$ holds iff $(S, T)$ is in the greatest subtype simulation.

### 7.2 Amber Rules for Subtyping

The Amber rules extend to subtyping:

$$\frac{(X, Y) \in A}{A \vdash X <: Y} \quad \text{(S-Var)}$$

$$\frac{A \vdash T_1 <: S_1 \quad A \vdash S_2 <: T_2}{A \vdash S_1 \to S_2 <: T_1 \to T_2} \quad \text{(S-Arrow)}$$

$$\frac{A \cup \{(X, Y)\} \vdash S <: T}{A \vdash \mu X.\, S <: \mu Y.\, T} \quad \text{(S-Rec)}$$

Note the contravariance in S-Arrow: the domain is reversed, matching the standard subtyping rule for function types.

---

## 8. Positive and Negative Occurrences

### 8.1 Variance in Recursive Types

The position of the type variable $X$ in the body $T$ of a recursive type $\mu X.\, T$ determines the "polarity" of the recursion.

**Definition 8.1.** An occurrence of $X$ in $T$ is:
- **Positive** if it appears under an even number of left-of-arrow positions.
- **Negative** if it appears under an odd number of left-of-arrow positions.

Examples:
- In $\mu X.\, \text{Unit} + X$, the occurrence of $X$ is positive (it appears on the right of $+$, which is covariant).
- In $\mu X.\, X \to \text{Nat}$, the occurrence of $X$ is negative (it appears on the left of $\to$).
- In $\mu X.\, (X \to \text{Nat}) \to \text{Nat}$, $X$ appears in a double-negation, which is positive.

### 8.2 Inductive vs. Coinductive Types

The polarity of the recursion determines whether the type is best understood as inductive or coinductive:

- **Positive recursive types** (all occurrences of $X$ are positive) correspond to inductive types (algebraic data types): natural numbers, lists, trees. These types have well-defined constructors and are eliminated by pattern matching (recursion).

- **Negative recursive types** (occurrences of $X$ in negative position) correspond to coinductive types or "objects": streams, processes. These types are characterized by their destructors (observations) and are introduced by copattern matching (corecursion).

The type $\mu X.\, X \to T$ is negative and enables self-application (Section 4). The type $\mu X.\, T \times X$ (streams) is positive in the product but the $X$ in the second component acts coinductively because the product delays evaluation.

---

## 9. Recursive Types in Practice

### 9.1 OCaml

In OCaml, algebraic data types provide iso-recursive types with auto-generated fold/unfold:

```ocaml
type 'a list =
  | Nil
  | Cons of 'a * 'a list
```

The constructors `Nil` and `Cons` correspond to `fold` composed with `inl`/`inr`. Pattern matching corresponds to `unfold` followed by `case`.

OCaml also supports equi-recursive types via the `-rectypes` flag, which allows cyclic type definitions without explicit data type declarations:

```ocaml
(* With -rectypes: *)
let f x = x x   (* has type ('a -> 'b as 'a) -> 'b *)
```

### 9.2 Haskell

In Haskell, `data` declarations provide iso-recursive types. The `newtype` declaration can be used for zero-cost recursive type wrapping:

```haskell
newtype Fix f = Fix { unFix :: f (Fix f) }
```

This is a generic fixed-point type operator. For a specific functor `f`, `Fix f` is the recursive type $\mu X.\, f(X)$, with `Fix` as fold and `unFix` as unfold.

### 9.3 Rust

Rust requires explicit boxing for recursive types to ensure finite size:

```rust
enum List<T> {
    Nil,
    Cons(T, Box<List<T>>),
}
```

The `Box` provides indirection (a heap-allocated pointer), making the type representable in memory. Without `Box`, the compiler rejects the definition because `List<T>` would have infinite size.

---

## 10. Formal Properties

### 10.1 Existence of Solutions

**Theorem 10.1.** For any type expression $T$ with a free variable $X$, the type $\mu X.\, T$ exists and satisfies $\mu X.\, T \cong [X \mapsto \mu X.\, T]\,T$ (isomorphism in the iso-recursive setting, equality in the equi-recursive setting).

*Proof.* In the iso-recursive setting, the isomorphism is witnessed by $\text{fold}$ and $\text{unfold}$, which are inverses by E-UnfoldFold (one direction) and the fact that $\text{fold}\;(\text{unfold}\;v) = v$ for values $v$ of recursive type (the other direction, which follows from the definition of values). In the equi-recursive setting, equality is by definition. $\square$

### 10.2 Uniqueness (Up to Isomorphism)

**Theorem 10.2.** In the equi-recursive setting, the solution to $X = F(X)$ (where $F$ is a type operator) is unique up to type equivalence, provided $F$ is contractive.

*Proof sketch.* By the Banach fixed-point theorem on the complete metric space of infinite regular trees (under the standard metric where two trees agree to depth $n$ have distance $\leq 2^{-n}$), a contractive operator has a unique fixed point. $\square$

---

## 11. Exercises

### Exercise 11.1

Define a recursive type for **labelled binary trees** where internal nodes carry labels of type $A$ and leaves are unlabelled:

$$\text{LTree}\;A = \mu X.\, \text{Unit} + (A \times X \times X)$$

Give the constructors $\text{leaf} : \text{LTree}\;A$ and $\text{node} : A \to \text{LTree}\;A \to \text{LTree}\;A \to \text{LTree}\;A$. Then define a function $\text{preorder} : \text{LTree}\;\text{Nat} \to \text{List}\;\text{Nat}$ that collects node labels in pre-order.

### Exercise 11.2

Using the Amber rules, determine whether the following types are equivalent:

$$\mu X.\, (\text{Nat} \times X) \to \text{Bool} \quad \stackrel{?}{\equiv} \quad \mu Y.\, (\text{Nat} \times (\mu Z.\, (\text{Nat} \times Z) \to \text{Bool})) \to \text{Bool}$$

Show the full derivation or explain where the derivation fails.

### Exercise 11.3

Define a type for **finite automata states** using recursive types. A state receives an input symbol and produces a pair of an output and the next state:

$$\text{State} = \mu X.\, \text{Symbol} \to \text{Output} \times X$$

Write a function $\text{run} : \text{State} \to \text{List}\;\text{Symbol} \to \text{List}\;\text{Output}$ that processes a list of input symbols and collects the outputs.

### Exercise 11.4

Prove that the iso-recursive and equi-recursive approaches agree on typability for a specific class of programs. That is, show that for terms built from fold, unfold, and the standard STLC constructs, a term is typable in the iso-recursive system if and only if it is typable in the equi-recursive system (after erasing fold/unfold).

(Hint: the forward direction is straightforward. For the reverse direction, show how to insert fold/unfold annotations.)

### Exercise 11.5 (Challenging)

Define the type of **lazy lists** (potentially infinite lists):

$$\text{LazyList}\;T = \mu X.\, \text{Unit} + (T \times (\text{Unit} \to X))$$

Note the thunk $\text{Unit} \to X$ for the tail, ensuring laziness under call-by-value.

**(a)** Define $\text{take} : \text{Nat} \to \text{LazyList}\;T \to \text{List}\;T$ that extracts the first $n$ elements.

**(b)** Define $\text{iterate} : (T \to T) \to T \to \text{LazyList}\;T$ that produces the stream $x, f(x), f(f(x)), \ldots$

**(c)** Verify that $\text{take}\;3\;(\text{iterate}\;(\lambda n.\, n + 1)\;0) = [0, 1, 2]$ by tracing the evaluation.

### Exercise 11.6 (Challenging)

In the equi-recursive setting, prove that the subtyping relation $\mu X.\, X \to X <: \mu Y.\, Y \to Y$ holds. Use the Amber rules for recursive subtyping.

Then prove that $\mu X.\, \text{Nat} \to X <: \mu Y.\, \text{Int} \to Y$ holds when $\text{Nat} <: \text{Int}$, using the Amber rules and carefully handling the contravariance of function arguments.

---

## 12. Denotational Semantics of Recursive Types

### 12.1 Solving Domain Equations

In denotational semantics, a recursive type $\mu X.\, F(X)$ corresponds to a **domain equation** $D = F(D)$. Finding solutions to such equations is the central problem of domain theory.

**Theorem 12.1 (Smyth and Plotkin, 1982).** For any locally continuous functor $F$ on the category of domains and continuous functions, there exists a domain $D_\infty$ such that $D_\infty \cong F(D_\infty)$, and this solution is initial in the category of $F$-algebras.

The proof constructs $D_\infty$ as a limit of a chain:

$$D_0 = \{\bot\} \quad D_1 = F(D_0) \quad D_2 = F(D_1) \quad \ldots \quad D_n = F(D_{n-1}) \quad \ldots$$

$$D_\infty = \varprojlim_{n} D_n$$

### 12.2 Covariant and Contravariant Functors

The construction depends on the variance of $F$:

- If $F$ is **covariant** (the type variable occurs only in positive positions), the chain consists of injections $D_0 \hookrightarrow D_1 \hookrightarrow \ldots$ and $D_\infty$ is the colimit.

- If $F$ is **mixed** (the type variable occurs in both positive and negative positions), the construction uses a **bilimit** -- a simultaneous limit and colimit. This is more complex and requires the domain to be a **bifinite domain** (a domain that is both a directed colimit of finite domains and a codirected limit of finite domains).

### 12.3 Connection to Iso-Recursive vs. Equi-Recursive

In the domain-theoretic model:

- **Iso-recursive types** correspond to solutions $D \cong F(D)$ (isomorphism).
- **Equi-recursive types** correspond to solutions $D = F(D)$ (identity).

Both exist in the domain-theoretic setting, but the equi-recursive solution requires working with infinite regular trees as type denotations.

---

## 13. Recursive Types and Category Theory

### 13.1 Initial Algebras

A recursive type $\mu X.\, F(X)$ where $F$ is a (covariant) functor can be understood as the **initial algebra** of $F$.

**Definition 13.1.** An **$F$-algebra** is a pair $(A, \alpha)$ where $A$ is a type and $\alpha : F(A) \to A$. An $F$-algebra morphism from $(A, \alpha)$ to $(B, \beta)$ is a function $h : A \to B$ such that $h \circ \alpha = \beta \circ F(h)$.

**Definition 13.2.** The **initial $F$-algebra** is an $F$-algebra $(\mu F, \text{in})$ such that for every $F$-algebra $(A, \alpha)$, there exists a unique morphism $\text{fold}_\alpha : \mu F \to A$ satisfying $\text{fold}_\alpha \circ \text{in} = \alpha \circ F(\text{fold}_\alpha)$.

The operation $\text{in} : F(\mu F) \to \mu F$ corresponds to our $\text{fold}$ operation. The unique morphism $\text{fold}_\alpha$ is the **catamorphism** (or "fold") determined by $\alpha$.

**Lambek's Lemma.** If $(\mu F, \text{in})$ is the initial $F$-algebra, then $\text{in}$ is an isomorphism. Its inverse $\text{in}^{-1} : \mu F \to F(\mu F)$ is our $\text{unfold}$ operation.

### 13.2 Final Coalgebras (Coinductive Types)

Dually, a coinductive type is the **final coalgebra** of a functor.

**Definition 13.3.** An **$F$-coalgebra** is a pair $(A, \alpha)$ where $\alpha : A \to F(A)$. The **final $F$-coalgebra** is an $F$-coalgebra $(\nu F, \text{out})$ such that for every $F$-coalgebra $(A, \alpha)$, there exists a unique morphism $\text{unfold}_\alpha : A \to \nu F$ satisfying $\text{out} \circ \text{unfold}_\alpha = F(\text{unfold}_\alpha) \circ \alpha$.

The unique morphism $\text{unfold}_\alpha$ is the **anamorphism** (or "unfold") determined by $\alpha$.

**Example.** Streams of type $T$ are the final coalgebra of the functor $F(X) = T \times X$:

$$\nu F = \text{Stream}\;T$$

$$\text{out} = (\text{head}, \text{tail}) : \text{Stream}\;T \to T \times \text{Stream}\;T$$

The anamorphism for a coalgebra $(A, \alpha : A \to T \times A)$ is the function that generates a stream from a seed:

$$\text{unfold}_\alpha : A \to \text{Stream}\;T$$

$$\text{unfold}_\alpha\;a = \text{let}\;(t, a') = \alpha\;a\;\text{in}\;\text{fold}\;(t, \lambda \_.\, \text{unfold}_\alpha\;a')$$

### 13.3 Hylomorphisms

A **hylomorphism** combines an anamorphism (unfold) with a catamorphism (fold):

$$\text{hylo}_{\alpha, \beta} = \text{fold}_\beta \circ \text{unfold}_\alpha : A \to B$$

where $\alpha : A \to F(A)$ (unfold step) and $\beta : F(B) \to B$ (fold step). The intermediate recursive data structure is never materialized -- it is "fused away" by the composition.

This is the basis of the **deforestation** optimization (Wadler, 1988): eliminating intermediate data structures in compositions of recursive functions.

---

## 14. Inductive Types in Proof Assistants

### 14.1 Coq's Inductive Types

In Coq, inductive types are defined using the `Inductive` keyword:

```
Inductive nat : Type :=
  | O : nat
  | S : nat -> nat.
```

This is an iso-recursive type with auto-generated $\text{fold}$ (constructors `O` and `S`) and $\text{unfold}$ (pattern matching via `match`). Coq additionally generates:

- An **induction principle** (`nat_ind`): for any predicate $P$, if $P(0)$ and $\forall n.\, P(n) \implies P(S(n))$, then $\forall n.\, P(n)$.
- A **recursion principle** (`nat_rec`): for any type $C$, given $c_0 : C$ and $c_S : \text{nat} \to C \to C$, there exists a function $f : \text{nat} \to C$ with $f(0) = c_0$ and $f(S(n)) = c_S(n, f(n))$.

### 14.2 Strict Positivity

Coq and Agda require that recursive type variables appear only in **strictly positive** positions. This means:

- $\mu X.\, \text{Nat} + X$ is allowed (positive).
- $\mu X.\, X \to \text{Nat}$ is **rejected** (negative occurrence).
- $\mu X.\, (X \to \text{Nat}) \to \text{Nat}$ is **rejected** (non-strictly positive, even though it is positive by double negation).

The strict positivity requirement ensures that the type has a well-defined interpretation as an inductive type and that the associated induction/recursion principles are sound. Allowing negative occurrences would enable encoding the liar paradox, destroying logical consistency.

### 14.3 The Connection to Our Development

Our treatment of recursive types in this lecture does *not* impose a positivity restriction. This is intentional: we want to study the full generality of recursive types, including negative recursive types that enable self-application and general recursion. The price we pay is the loss of strong normalization and logical consistency (Section 4).

Proof assistants choose the opposite trade-off: they restrict recursive types to maintain consistency, at the cost of not being able to express general recursion directly.

---

## Summary

- **Recursive types** $\mu X.\, T$ allow types to refer to themselves, enabling the encoding of lists, trees, streams, and other recursive data structures.
- The **iso-recursive** approach treats $\mu X.\, T$ and its unfolding as isomorphic but distinct, with explicit $\text{fold}$/$\text{unfold}$ operations. Typing rules T-Fold and T-Unfold witness the isomorphism.
- The **equi-recursive** approach treats $\mu X.\, T$ and its unfolding as identical, using coinductive definitions of type equivalence. The Amber rules provide a decidable algorithm for contractive types.
- **Standard encodings:** $\text{Nat} = \mu X.\, \text{Unit} + X$; $\text{List}\;T = \mu X.\, \text{Unit} + (T \times X)$; $\text{Stream}\;T = \mu X.\, T \times X$.
- **Self-application** becomes typable via $D = \mu X.\, X \to T$, enabling general recursion and destroying strong normalization.
- **Type safety** (progress and preservation) holds for STLC with iso-recursive types.
- **Positive** recursive types correspond to inductive data; **negative** recursive types enable self-reference and coinductive data.

---

## Further Reading

- Pierce, B. C. (2002). *Types and Programming Languages*, Chapters 20-21: Recursive Types.
- Harper, R. (2016). *Practical Foundations for Programming Languages*, Chapters 19-21: Inductive and Coinductive Types.
- Brandt, M., & Henglein, F. (1998). Coinductive axiomatization of recursive type equality and subtyping. *Fundamenta Informaticae*, 33(4), 309-338.
- Amadio, R. M., & Cardelli, L. (1993). Subtyping recursive types. *ACM Transactions on Programming Languages and Systems*, 15(4), 575-631.
- Crary, K., Harper, R., & Puri, S. (1999). What is a recursive module? *PLDI 1999*, pp. 50-63.
- Cardone, F., & Coppo, M. (1991). Type inference with recursive types: Syntax and semantics. *Information and Computation*, 92(1), 48-80.
- Abadi, M., & Fiore, M. P. (1996). Syntactic considerations on recursive types. *LICS 1996*, pp. 242-252.
- Smyth, M. B., & Plotkin, G. D. (1982). The category-theoretic solution of recursive domain equations. *SIAM Journal on Computing*, 11(4), 761-783.
- Wadler, P. (1988). Deforestation: Transforming programs to eliminate trees. *Theoretical Computer Science*, 73(2), 231-248.
- Gapeyev, V., Levin, M. Y., & Pierce, B. C. (2003). Recursive subtyping revealed. *Journal of Functional Programming*, 12(6), 511-548.

---

## Appendix A: Complete Inference Rules for Recursive Types

**Typing rules for fold and unfold:**

$$\frac{\Gamma \vdash t : [X \mapsto \mu X.\,T]\,T}{\Gamma \vdash \text{fold}[\mu X.\,T]\;t : \mu X.\,T} \quad \text{(T-Fold)}$$

$$\frac{\Gamma \vdash t : \mu X.\,T}{\Gamma \vdash \text{unfold}[\mu X.\,T]\;t : [X \mapsto \mu X.\,T]\,T} \quad \text{(T-Unfold)}$$

**Evaluation rules:**

$$\frac{t \to t'}{\text{fold}[\mu X.\,T]\;t \to \text{fold}[\mu X.\,T]\;t'} \quad \text{(E-Fold)}$$

$$\frac{t \to t'}{\text{unfold}[\mu X.\,T]\;t \to \text{unfold}[\mu X.\,T]\;t'} \quad \text{(E-Unfold)}$$

$$\frac{}{\text{unfold}[\mu X.\,T]\;(\text{fold}[\mu X.\,T]\;v) \to v} \quad \text{(E-UnfoldFold)}$$

**Value forms:**

$$v ::= \ldots \mid \text{fold}[\mu X.\,T]\;v$$

**Type substitution:**

$$[X \mapsto S]\,\text{Bool} = \text{Bool}$$

$$[X \mapsto S]\,\text{Nat} = \text{Nat}$$

$$[X \mapsto S]\,\text{Unit} = \text{Unit}$$

$$[X \mapsto S]\,(T_1 \to T_2) = ([X \mapsto S]\,T_1) \to ([X \mapsto S]\,T_2)$$

$$[X \mapsto S]\,(T_1 \times T_2) = ([X \mapsto S]\,T_1) \times ([X \mapsto S]\,T_2)$$

$$[X \mapsto S]\,(T_1 + T_2) = ([X \mapsto S]\,T_1) + ([X \mapsto S]\,T_2)$$

$$[X \mapsto S]\,(\text{Ref}\;T) = \text{Ref}\;([X \mapsto S]\,T)$$

$$[X \mapsto S]\,X = S$$

$$[X \mapsto S]\,Y = Y \quad (Y \neq X)$$

$$[X \mapsto S]\,(\mu Y.\, T) = \mu Y.\, [X \mapsto S]\,T \quad (Y \neq X, Y \notin \text{FTV}(S))$$

$$[X \mapsto S]\,(\mu X.\, T) = \mu X.\, T \quad \text{(shadowed)}$$

where $\text{FTV}(S)$ denotes the set of free type variables in $S$. The side condition $Y \notin \text{FTV}(S)$ prevents variable capture; alpha-renaming the bound variable $Y$ if necessary.

## Appendix B: Equi-Recursive Amber Rules (Complete)

**Type equivalence:**

$$\frac{(X, Y) \in A}{A \vdash X \equiv Y} \quad \text{(EQ-Var)} \qquad \frac{}{A \vdash \text{Bool} \equiv \text{Bool}} \quad \text{(EQ-Bool)}$$

$$\frac{}{A \vdash \text{Nat} \equiv \text{Nat}} \quad \text{(EQ-Nat)} \qquad \frac{}{A \vdash \text{Unit} \equiv \text{Unit}} \quad \text{(EQ-Unit)}$$

$$\frac{A \vdash S_1 \equiv T_1 \quad A \vdash S_2 \equiv T_2}{A \vdash S_1 \to S_2 \equiv T_1 \to T_2} \quad \text{(EQ-Arrow)}$$

$$\frac{A \vdash S_1 \equiv T_1 \quad A \vdash S_2 \equiv T_2}{A \vdash S_1 \times S_2 \equiv T_1 \times T_2} \quad \text{(EQ-Prod)}$$

$$\frac{A \vdash S_1 \equiv T_1 \quad A \vdash S_2 \equiv T_2}{A \vdash S_1 + S_2 \equiv T_1 + T_2} \quad \text{(EQ-Sum)}$$

$$\frac{A \vdash S \equiv T}{A \vdash \text{Ref}\;S \equiv \text{Ref}\;T} \quad \text{(EQ-Ref)}$$

$$\frac{A \cup \{(X, Y)\} \vdash S \equiv T}{A \vdash \mu X.\, S \equiv \mu Y.\, T} \quad \text{(EQ-Rec)}$$

**Recursive subtyping:**

$$\frac{(X, Y) \in A}{A \vdash X <: Y} \quad \text{(S-Var)}$$

$$\frac{A \vdash T_1 <: S_1 \quad A \vdash S_2 <: T_2}{A \vdash S_1 \to S_2 <: T_1 \to T_2} \quad \text{(S-Arrow)}$$

$$\frac{A \vdash S_1 <: T_1 \quad A \vdash S_2 <: T_2}{A \vdash S_1 \times S_2 <: T_1 \times T_2} \quad \text{(S-Prod)}$$

$$\frac{A \cup \{(X, Y)\} \vdash S <: T}{A \vdash \mu X.\, S <: \mu Y.\, T} \quad \text{(S-Rec)}$$

## Appendix C: Worked Example -- Amber Equivalence Derivation

We show that $\mu X.\, \text{Unit} + (\text{Nat} \times X) \equiv \mu Y.\, \text{Unit} + (\text{Nat} \times Y)$.

This is just alpha-equivalence, but the Amber rules handle it elegantly.

**Step 1:** Apply EQ-Rec. Set $A_1 = \{(X, Y)\}$ and check $A_1 \vdash \text{Unit} + (\text{Nat} \times X) \equiv \text{Unit} + (\text{Nat} \times Y)$.

**Step 2:** Apply EQ-Sum. Check:

- $A_1 \vdash \text{Unit} \equiv \text{Unit}$: By EQ-Unit. Check.
- $A_1 \vdash \text{Nat} \times X \equiv \text{Nat} \times Y$: Apply EQ-Prod.

**Step 3:** For EQ-Prod, check:

- $A_1 \vdash \text{Nat} \equiv \text{Nat}$: By EQ-Nat. Check.
- $A_1 \vdash X \equiv Y$: By EQ-Var, since $(X, Y) \in A_1$. Check.

All leaves of the derivation tree succeed. Therefore $\emptyset \vdash \mu X.\, \text{Unit} + (\text{Nat} \times X) \equiv \mu Y.\, \text{Unit} + (\text{Nat} \times Y)$.

**Full derivation tree:**

$$\frac{\frac{}{\{(X,Y)\} \vdash \text{Unit} \equiv \text{Unit}} \quad \frac{\frac{}{\{(X,Y)\} \vdash \text{Nat} \equiv \text{Nat}} \quad \frac{(X,Y) \in \{(X,Y)\}}{\{(X,Y)\} \vdash X \equiv Y}}{\{(X,Y)\} \vdash \text{Nat} \times X \equiv \text{Nat} \times Y}}{\frac{\{(X,Y)\} \vdash \text{Unit} + (\text{Nat} \times X) \equiv \text{Unit} + (\text{Nat} \times Y)}{\emptyset \vdash \mu X.\, \text{Unit} + (\text{Nat} \times X) \equiv \mu Y.\, \text{Unit} + (\text{Nat} \times Y)}}$$

Now consider a more interesting example: show that $\mu X.\, \text{Nat} \to X \equiv \mu Y.\, \text{Nat} \to (\mu Z.\, \text{Nat} \to Z)$.

**Step 1:** Apply EQ-Rec with $A_1 = \{(X, Y)\}$. Check $A_1 \vdash \text{Nat} \to X \equiv \text{Nat} \to (\mu Z.\, \text{Nat} \to Z)$.

**Step 2:** Apply EQ-Arrow. Check:

- $A_1 \vdash \text{Nat} \equiv \text{Nat}$: By EQ-Nat. Check.
- $A_1 \vdash X \equiv \mu Z.\, \text{Nat} \to Z$: We need to compare a variable $X$ with a $\mu$-type.

**Step 3:** $X$ is a variable and $\mu Z.\, \text{Nat} \to Z$ is a recursive type. We cannot apply EQ-Var (the pair $(X, \mu Z.\, \text{Nat} \to Z)$ is not in $A_1$; $A_1$ only contains $(X, Y)$, not pairs involving $\mu$-types). We cannot apply EQ-Rec (because $X$ is not a $\mu$-type).

The derivation fails. **However**, the two types *are* equivalent as infinite trees: both unfold to $\text{Nat} \to \text{Nat} \to \text{Nat} \to \ldots$. This demonstrates the **incompleteness** of the Amber rules for non-contractive comparisons -- the variable $Y$ in the first type needs to be unfolded to match the $\mu Z$ in the second.

To handle this, some formulations add an **unfolding rule**:

$$\frac{A \vdash [X \mapsto \mu X.\, S]\,S \equiv T}{A \vdash \mu X.\, S \equiv T} \quad \text{(EQ-UnfoldL)}$$

$$\frac{A \vdash S \equiv [Y \mapsto \mu Y.\, T]\,T}{A \vdash S \equiv \mu Y.\, T} \quad \text{(EQ-UnfoldR)}$$

With these rules, the derivation can proceed by unfolding $\mu Z.\, \text{Nat} \to Z$ to $\text{Nat} \to (\mu Z.\, \text{Nat} \to Z)$ and then comparing with the unfolding of $\mu X.\, \text{Nat} \to X$.

## Appendix D: Recursive Types and Parametricity

An important question is how recursive types interact with parametric polymorphism (System F, Module 05).

**Observation.** In System F without recursive types, every well-typed term of type $\forall X.\, X$ is semantically equivalent to a divergent computation (if we have general recursion) or there are no closed values of this type (if the system is strongly normalizing). Recursive types can change this picture.

**Encoding universal type.** With recursive types, we can define:

$$U = \mu X.\, X$$

In an equi-recursive system, $U = \mu X.\, X \equiv [\mu X.\, X / X]\,X = U$, so $U \equiv U$ trivially. A value of type $U$ is a value that equals its own unfolding -- this is a degenerate type.

**Negative self-reference and non-termination.** More usefully, consider:

$$D = \mu X.\, X \to T$$

A value of type $D$ is a function that takes a $D$ and returns a $T$. This is precisely the type needed for self-application: if $f : D$, then $\text{unfold}\;f : D \to T$, so $(\text{unfold}\;f)\;f : T$. The omega combinator is:

$$\omega = \text{fold}\;(\lambda x : D.\, (\text{unfold}\;x)\;x) : D$$

$$\Omega = (\text{unfold}\;\omega)\;\omega : T$$

This diverges, demonstrating that recursive types destroy strong normalization.

**Free theorems and recursive types.** Wadler's *free theorems* (derived from parametricity) guarantee that polymorphic functions satisfy certain properties. For example, any $f : \forall X.\, \text{List}\;X \to \text{List}\;X$ must map each element independently of its value. However, if we add recursive types and $\text{fix}$, some free theorems fail because we can write terms that "inspect" their arguments via divergence behavior. Specifically, parametricity holds for *terminating* computations but not for partial ones.

**Theorem (Pitts, 2000).** For a language with recursive types and $\text{fix}$, a *step-indexed logical relation* can recover a restricted form of parametricity that accounts for divergence. Specifically, two terms are related at a polymorphic type if they behave identically for any $k$ steps of computation, for all $k$.

This step-indexed approach, pioneered by Appel and McAllester (2001) and refined by Ahmed (2006), has become the standard technique for establishing parametricity-like results in languages with recursive types and mutable state.

## Appendix E: Size Comparison of Recursive Type Implementations

The following table summarizes the trade-offs in implementing recursive types in real compilers.

| Aspect | Iso-recursive | Equi-recursive |
|---|---|---|
| Type checker complexity | $O(n)$ per fold/unfold | $O(n^2)$ for equivalence (coinductive) |
| Type inference | Standard unification | Requires infinite type unification |
| Error messages | Precise (explicit coercions) | Can be confusing (deep unfoldings) |
| Runtime overhead | Zero (fold/unfold erased) | Zero (no coercions to erase) |
| Programmer burden | Must write fold/unfold | Transparent |
| Subtyping | Standard (extend with Amber rules) | Coinductive subtyping (decidable) |
| Metatheory | Straightforward | Requires coinduction |
| Used by | OCaml, Haskell, Rust | TypeScript, some flow analyses |

In practice, most statically-typed functional languages use iso-recursive types because they integrate cleanly with algebraic data types (where constructors serve as the fold operation and pattern matching serves as unfold), and the metatheory is significantly simpler.
