---
title: "Lecture 03a: References & Mutable State"
tags:
  - type-theory
  - extensions
  - lecture
---
# Lecture 03a: References & Mutable State

> **Module 03 -- Extensions & Recursive Types (Weeks 5-6)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** why mutable state requires extending both the type system and the operational semantics of the simply typed lambda calculus.
2. **Define** the $\text{Ref}\;T$ type and give the syntax, typing rules, and evaluation rules for $\text{ref}$, $!$ (dereference), and $:=$ (assignment).
3. **Formalize** a store $\mu$ as a mapping from locations to values, and a store typing $\Sigma$ as a mapping from locations to types.
4. **State and prove** the progress theorem for STLC with references, using the store typing.
5. **State and prove** the preservation theorem for STLC with references, demonstrating the monotonic extension of store typings.
6. **Articulate** why aliasing complicates equational reasoning and relate this to the distinction between reference equality and structural equality.
7. **Distinguish** between the semantics of references in ML-family languages and the semantics of mutable variables in imperative languages.
8. **Connect** the formalization of mutable state to practical language design decisions and compiler optimizations.

---

## 1. Motivation

The simply typed lambda calculus, as developed in Module 02, is a purely functional language: every expression denotes a value, and evaluation proceeds by substitution. There is no notion of "memory" that persists across computation steps, no way for one part of a program to communicate with another except by passing values as arguments.

Yet virtually every practical programming language provides some mechanism for mutable state. ML has `ref` cells, Java has mutable fields, C has pointers. Even Haskell, the most prominent purely functional language, provides `IORef` and `STRef` for controlled mutation within monadic computations.

From a type-theoretic perspective, mutable state introduces several fundamental challenges:

1. **Evaluation order matters.** In a pure language, the order of evaluation of subexpressions is irrelevant (up to termination behavior). With mutable state, the order in which side effects occur determines the result.

2. **Types must account for the store.** A reference cell holding a natural number has a different type than a reference cell holding a boolean. The type system must track what each cell contains.

3. **The store grows during evaluation.** Allocating a new reference cell creates a new location in the store. The type safety proof must account for stores that change shape during evaluation.

4. **Aliasing breaks substitution-based reasoning.** Two variables may refer to the same mutable cell. Modifying through one alias affects reads through the other. This is fundamentally at odds with the substitution model of the lambda calculus.

We follow the treatment of Pierce (TAPL, Chapter 13), extending STLC with a type $\text{Ref}\;T$ of mutable references and proving that the resulting system remains type-safe.

---

## 2. Core Theory

### 2.1 Syntax

We extend the syntax of STLC with three new term forms and one new type form. We also introduce **locations** $l$, which are runtime values representing addresses in the store. Locations do not appear in source programs; they arise only during evaluation.

**Types:**

$$T ::= \text{Bool} \mid \text{Nat} \mid \text{Unit} \mid T_1 \to T_2 \mid T_1 \times T_2 \mid T_1 + T_2 \mid \text{Ref}\;T$$

**Terms:**

$$t ::= x \mid \lambda x : T.\, t \mid t_1\;t_2 \mid \text{ref}\;t \mid \;!\,t \mid t_1 := t_2 \mid l \mid \ldots$$

where $l$ ranges over a countably infinite set of **locations** $\mathcal{L} = \{l_0, l_1, l_2, \ldots\}$.

**Values:**

$$v ::= \lambda x : T.\, t \mid l \mid \text{unit} \mid \ldots$$

Locations are values: they are fully evaluated. A reference cell is allocated by $\text{ref}\;v$, which evaluates to a fresh location $l$. The location itself is the "pointer" -- it can be stored, passed around, compared (in extensions with location equality), and used to read or write the cell it names.

**Remark on source terms vs. runtime terms.** There is an important distinction between the terms that a programmer writes (the *source language*) and the terms that arise during evaluation (the *runtime language*). Locations $l$ are runtime terms only -- they do not appear in source programs. The programmer writes $\text{ref}\;t$, which during evaluation produces a location. This means the typing rules for locations (T-Loc, below) are needed only for the type safety proof, not for type-checking source programs.

**Formal grammar summary.** For reference, the complete grammar of our extended language is:

$$T ::= \text{Bool} \mid \text{Nat} \mid \text{Unit} \mid T \to T \mid T \times T \mid T + T \mid \text{Ref}\;T$$

$$t ::= x \mid \lambda x : T.\, t \mid t\;t \mid \text{true} \mid \text{false} \mid \text{if}\;t\;\text{then}\;t\;\text{else}\;t$$

$$\quad \mid\; 0 \mid \text{succ}\;t \mid \text{pred}\;t \mid \text{iszero}\;t \mid \text{unit}$$

$$\quad \mid\; (t, t) \mid \pi_1\;t \mid \pi_2\;t$$

$$\quad \mid\; \text{inl}\;t \mid \text{inr}\;t \mid \text{case}\;t\;\text{of}\;\text{inl}\;x \Rightarrow t \mid \text{inr}\;x \Rightarrow t$$

$$\quad \mid\; \text{ref}\;t \mid \;!\,t \mid t := t \mid l$$

$$v ::= \lambda x : T.\, t \mid \text{true} \mid \text{false} \mid \text{nv} \mid \text{unit} \mid (v, v) \mid \text{inl}\;v \mid \text{inr}\;v \mid l$$

where $\text{nv}$ ranges over numeric values ($0, \text{succ}\;0, \text{succ}\;(\text{succ}\;0), \ldots$).

### 2.2 The Store

A **store** (also called a **heap** or **memory**) is a finite partial function from locations to values:

$$\mu : \mathcal{L} \rightharpoonup \text{Value}$$

We write $\text{dom}(\mu)$ for the set of locations on which $\mu$ is defined. The store is extended during evaluation when new reference cells are allocated, and updated when existing cells are assigned to.

**Notation.** We write:

- $\mu(l)$ for the value stored at location $l$ in store $\mu$ (defined only when $l \in \text{dom}(\mu)$).
- $\mu[l \mapsto v]$ for the store that agrees with $\mu$ everywhere except at $l$, where it maps to $v$. If $l \notin \text{dom}(\mu)$, this extends the domain of the store.

### 2.3 Evaluation Rules

Evaluation judgments now take the form $t \mid \mu \to t' \mid \mu'$, reading "term $t$ with store $\mu$ steps to term $t'$ with store $\mu'$." The store may change at each step.

**Allocation:**

$$\frac{l \notin \text{dom}(\mu)}{\text{ref}\;v \mid \mu \to l \mid \mu[l \mapsto v]} \quad \text{(E-RefV)}$$

When $\text{ref}\;v$ is evaluated, a fresh location $l$ (not already in the domain of $\mu$) is chosen, and the store is extended to map $l$ to $v$. The result is the location $l$ itself.

**Dereference:**

$$\frac{\mu(l) = v}{\;!\,l \mid \mu \to v \mid \mu} \quad \text{(E-DerefLoc)}$$

Dereferencing a location $l$ looks up the value stored at $l$ in the store. The store is unchanged.

**Assignment:**

$$\frac{}{l := v \mid \mu \to \text{unit} \mid \mu[l \mapsto v]} \quad \text{(E-Assign)}$$

Assigning a value $v$ to location $l$ updates the store to map $l$ to $v$, and the result of the assignment expression is $\text{unit}$.

**Congruence rules** ensure that subexpressions are evaluated in a deterministic left-to-right order:

$$\frac{t \mid \mu \to t' \mid \mu'}{\text{ref}\;t \mid \mu \to \text{ref}\;t' \mid \mu'} \quad \text{(E-Ref)}$$

$$\frac{t \mid \mu \to t' \mid \mu'}{\;!\,t \mid \mu \to \;!\,t' \mid \mu'} \quad \text{(E-Deref)}$$

$$\frac{t_1 \mid \mu \to t_1' \mid \mu'}{t_1 := t_2 \mid \mu \to t_1' := t_2 \mid \mu'} \quad \text{(E-Assign1)}$$

$$\frac{t_2 \mid \mu \to t_2' \mid \mu'}{v := t_2 \mid \mu \to v := t_2' \mid \mu'} \quad \text{(E-Assign2)}$$

**Remark.** The choice of left-to-right evaluation order is conventional. Some languages (e.g., OCaml) evaluate arguments right-to-left. The type safety proof works for any fixed evaluation order; what matters is that the order is deterministic.

**Congruence rules for application (updated with store).** The standard STLC application rules must also be updated to thread the store:

$$\frac{t_1 \mid \mu \to t_1' \mid \mu'}{t_1\;t_2 \mid \mu \to t_1'\;t_2 \mid \mu'} \quad \text{(E-App1)}$$

$$\frac{t_2 \mid \mu \to t_2' \mid \mu'}{v_1\;t_2 \mid \mu \to v_1\;t_2' \mid \mu'} \quad \text{(E-App2)}$$

$$\frac{}{(\lambda x : T.\, t)\;v \mid \mu \to [x \mapsto v]\,t \mid \mu} \quad \text{(E-AppAbs)}$$

Note that E-AppAbs does not change the store: $\beta$-reduction is a pure operation. Similarly, the rules for conditionals, projections, and case analysis must be updated to thread the store, but we omit them here for brevity -- the pattern is the same in every case.

**Example of evaluation with store.** Consider the term:

$$\text{let } r = \text{ref}\;0 \text{ in } (r := 1;\; !\,r)$$

which desugars to $(\lambda r : \text{Ref}\;\text{Nat}.\, r := 1;\; !\,r)\;(\text{ref}\;0)$. Evaluation proceeds:

$$(\lambda r.\, r := 1;\; !\,r)\;(\text{ref}\;0) \mid \emptyset$$

$$\to (\lambda r.\, r := 1;\; !\,r)\;l_0 \mid [l_0 \mapsto 0] \quad \text{(E-App2, E-RefV)}$$

$$\to (l_0 := 1;\; !\,l_0) \mid [l_0 \mapsto 0] \quad \text{(E-AppAbs)}$$

$$\to (\text{unit};\; !\,l_0) \mid [l_0 \mapsto 1] \quad \text{(E-Seq/E-Assign)}$$

$$\to !\,l_0 \mid [l_0 \mapsto 1] \quad \text{(E-SeqNext)}$$

$$\to 1 \mid [l_0 \mapsto 1] \quad \text{(E-DerefLoc)}$$

### 2.4 The Store Typing

To type terms that involve references, we need to know the types of the values stored at each location. This information is captured by a **store typing**:

$$\Sigma : \mathcal{L} \rightharpoonup \text{Type}$$

The store typing is a finite partial function from locations to types. If $\Sigma(l) = T$, then location $l$ is expected to hold a value of type $T$.

The typing judgment is extended to include the store typing:

$$\Gamma \mid \Sigma \vdash t : T$$

reading "under context $\Gamma$ and store typing $\Sigma$, term $t$ has type $T$."

**Remark.** The store typing $\Sigma$ is a static artifact -- it appears in typing judgments but not in evaluation rules. The store $\mu$ is a dynamic artifact -- it appears in evaluation rules but not directly in typing judgments. The two are connected by the notion of a well-typed store (Definition 2.1 below).

### 2.5 Typing Rules for References

**Location typing:**

$$\frac{\Sigma(l) = T}{\Gamma \mid \Sigma \vdash l : \text{Ref}\;T} \quad \text{(T-Loc)}$$

A location $l$ has type $\text{Ref}\;T$ if the store typing says $l$ holds a value of type $T$.

**Allocation:**

$$\frac{\Gamma \mid \Sigma \vdash t : T}{\Gamma \mid \Sigma \vdash \text{ref}\;t : \text{Ref}\;T} \quad \text{(T-Ref)}$$

If $t$ has type $T$, then $\text{ref}\;t$ has type $\text{Ref}\;T$.

**Dereference:**

$$\frac{\Gamma \mid \Sigma \vdash t : \text{Ref}\;T}{\Gamma \mid \Sigma \vdash \;!\,t : T} \quad \text{(T-Deref)}$$

If $t$ has type $\text{Ref}\;T$, then $!\,t$ has type $T$.

**Assignment:**

$$\frac{\Gamma \mid \Sigma \vdash t_1 : \text{Ref}\;T \quad \Gamma \mid \Sigma \vdash t_2 : T}{\Gamma \mid \Sigma \vdash t_1 := t_2 : \text{Unit}} \quad \text{(T-Assign)}$$

If $t_1$ has type $\text{Ref}\;T$ and $t_2$ has type $T$, then $t_1 := t_2$ has type $\text{Unit}$.

**Remark on invariance.** The type argument $T$ in $\text{Ref}\;T$ appears in both covariant position (in T-Deref, where we read from the cell) and contravariant position (in T-Assign, where we write to the cell). This means that $\text{Ref}$ is **invariant** in its type argument: $\text{Ref}\;S$ is not a subtype of $\text{Ref}\;T$ even when $S$ is a subtype of $T$. We will revisit this important point when we study subtyping in Module 04.

### 2.6 Well-Typed Stores

The connection between the static store typing $\Sigma$ and the dynamic store $\mu$ is captured by the following definition.

**Definition 2.1 (Well-typed store).** A store $\mu$ is **well typed** with respect to a store typing $\Sigma$ and a context $\Gamma$, written $\Gamma \mid \Sigma \vdash \mu$, if:

1. $\text{dom}(\mu) = \text{dom}(\Sigma)$, and
2. for every $l \in \text{dom}(\mu)$, we have $\Gamma \mid \Sigma \vdash \mu(l) : \Sigma(l)$.

Condition (1) says that the store and the store typing agree on which locations exist. Condition (2) says that each location in the store holds a value whose type matches the store typing.

**Remark.** Note that condition (2) uses $\Sigma$ itself in the typing judgment for the values in the store. This is essential because values in the store may themselves contain locations. For example, a store might contain a location $l_1$ holding a value $l_2$ where $l_2$ is itself a location. We need $\Sigma$ to type $l_2$.

### 2.7 Store Typing Extension

During evaluation, new reference cells may be allocated. The store grows, and correspondingly the store typing must grow. We formalize this with the notion of store typing extension.

**Definition 2.2 (Store typing extension).** A store typing $\Sigma'$ **extends** $\Sigma$, written $\Sigma \subseteq \Sigma'$, if:

1. $\text{dom}(\Sigma) \subseteq \text{dom}(\Sigma')$, and
2. for every $l \in \text{dom}(\Sigma)$, we have $\Sigma'(l) = \Sigma(l)$.

That is, $\Sigma'$ agrees with $\Sigma$ on all locations in $\Sigma$'s domain, and may additionally define types for new locations. Crucially, $\Sigma'$ may **not** change the type assigned to an existing location. This monotonicity property is essential for the preservation proof.

**Lemma 2.3 (Weakening for store typings).** If $\Gamma \mid \Sigma \vdash t : T$ and $\Sigma \subseteq \Sigma'$, then $\Gamma \mid \Sigma' \vdash t : T$.

*Proof.* By induction on the derivation of $\Gamma \mid \Sigma \vdash t : T$.

The only rule that mentions $\Sigma$ directly is T-Loc: $\Sigma(l) = T$ implies $\Sigma'(l) = T$ since $\Sigma \subseteq \Sigma'$. All other rules follow immediately from the induction hypothesis. $\square$

This lemma says that typing is preserved when we learn about new locations. Once a term is well typed under $\Sigma$, it remains well typed under any extension of $\Sigma$.

**Detailed proof of Lemma 2.3.** We expand the proof for instructive purposes.

*Proof.* By induction on the derivation of $\Gamma \mid \Sigma \vdash t : T$.

**Case T-Var:** $t = x$ and $\Gamma(x) = T$. The typing does not involve $\Sigma$, so $\Gamma \mid \Sigma' \vdash x : T$ by the same rule.

**Case T-Abs:** $t = \lambda x : T_1.\, t_1$ and $\Gamma, x : T_1 \mid \Sigma \vdash t_1 : T_2$ with $T = T_1 \to T_2$. By IH, $\Gamma, x : T_1 \mid \Sigma' \vdash t_1 : T_2$. By T-Abs, $\Gamma \mid \Sigma' \vdash \lambda x : T_1.\, t_1 : T_1 \to T_2$.

**Case T-App:** $t = t_1\;t_2$ with $\Gamma \mid \Sigma \vdash t_1 : T_{11} \to T$ and $\Gamma \mid \Sigma \vdash t_2 : T_{11}$. By IH on both subderivations, $\Gamma \mid \Sigma' \vdash t_1 : T_{11} \to T$ and $\Gamma \mid \Sigma' \vdash t_2 : T_{11}$. By T-App, $\Gamma \mid \Sigma' \vdash t_1\;t_2 : T$.

**Case T-Loc:** $t = l$ with $\Sigma(l) = S$ and $T = \text{Ref}\;S$. Since $\Sigma \subseteq \Sigma'$, we have $l \in \text{dom}(\Sigma) \subseteq \text{dom}(\Sigma')$ and $\Sigma'(l) = \Sigma(l) = S$. By T-Loc, $\Gamma \mid \Sigma' \vdash l : \text{Ref}\;S$.

**Case T-Ref:** $t = \text{ref}\;t_1$ with $\Gamma \mid \Sigma \vdash t_1 : S$ and $T = \text{Ref}\;S$. By IH, $\Gamma \mid \Sigma' \vdash t_1 : S$. By T-Ref, $\Gamma \mid \Sigma' \vdash \text{ref}\;t_1 : \text{Ref}\;S$.

**Case T-Deref:** $t = \;!\,t_1$ with $\Gamma \mid \Sigma \vdash t_1 : \text{Ref}\;T$. By IH, $\Gamma \mid \Sigma' \vdash t_1 : \text{Ref}\;T$. By T-Deref, $\Gamma \mid \Sigma' \vdash \;!\,t_1 : T$.

**Case T-Assign:** $t = t_1 := t_2$ with $\Gamma \mid \Sigma \vdash t_1 : \text{Ref}\;S$ and $\Gamma \mid \Sigma \vdash t_2 : S$ and $T = \text{Unit}$. By IH on both, $\Gamma \mid \Sigma' \vdash t_1 : \text{Ref}\;S$ and $\Gamma \mid \Sigma' \vdash t_2 : S$. By T-Assign, $\Gamma \mid \Sigma' \vdash t_1 := t_2 : \text{Unit}$.

All other cases (T-True, T-False, T-If, T-Zero, T-Succ, T-Pred, T-IsZero, T-Unit, T-Pair, T-Fst, T-Snd, T-Inl, T-Inr, T-Case) follow the same pattern: $\Sigma$ is simply threaded through, and the IH applies to all subderivations. $\square$

**Lemma 2.4 (Store typing extension is transitive).** If $\Sigma_1 \subseteq \Sigma_2$ and $\Sigma_2 \subseteq \Sigma_3$, then $\Sigma_1 \subseteq \Sigma_3$.

*Proof.* We verify both conditions of Definition 2.2:
1. $\text{dom}(\Sigma_1) \subseteq \text{dom}(\Sigma_2) \subseteq \text{dom}(\Sigma_3)$.
2. For $l \in \text{dom}(\Sigma_1)$: $\Sigma_3(l) = \Sigma_2(l) = \Sigma_1(l)$. $\square$

**Lemma 2.5 (Store typing extension is reflexive).** $\Sigma \subseteq \Sigma$ for any $\Sigma$.

*Proof.* Immediate from Definition 2.2. $\square$

---

## 3. Type Safety

### 3.0 Canonical Forms

Before proving progress and preservation, we state the canonical forms lemma, which characterizes the shape of values at each type.

**Lemma 3.0 (Canonical Forms).** Suppose $\emptyset \mid \Sigma \vdash v : T$ and $v$ is a value. Then:

1. If $T = \text{Bool}$, then $v = \text{true}$ or $v = \text{false}$.
2. If $T = \text{Nat}$, then $v$ is a numeric value ($0$, $\text{succ}\;0$, etc.).
3. If $T = T_1 \to T_2$, then $v = \lambda x : T_1.\, t$ for some $x$ and $t$.
4. If $T = T_1 \times T_2$, then $v = (v_1, v_2)$ for some values $v_1, v_2$.
5. If $T = T_1 + T_2$, then $v = \text{inl}\;v_1$ or $v = \text{inr}\;v_2$ for some value $v_1$ or $v_2$.
6. If $T = \text{Unit}$, then $v = \text{unit}$.
7. If $T = \text{Ref}\;S$, then $v = l$ for some location $l$ with $\Sigma(l) = S$.

*Proof.* By inspection of the typing rules and the definition of values. For case (7): the only value form that can have type $\text{Ref}\;S$ is a location $l$, via rule T-Loc, which requires $\Sigma(l) = S$. No other value form (lambda, boolean, numeric value, pair, injection, unit) can be assigned a $\text{Ref}\;S$ type. $\square$

### 3.1 Progress

**Theorem 3.1 (Progress).** If $\emptyset \mid \Sigma \vdash t : T$ and $\emptyset \mid \Sigma \vdash \mu$, then either:

1. $t$ is a value, or
2. there exist $t'$ and $\mu'$ such that $t \mid \mu \to t' \mid \mu'$.

*Proof.* By induction on the derivation of $\emptyset \mid \Sigma \vdash t : T$.

**Case T-Var:** Impossible, since $\Gamma = \emptyset$.

**Case T-Abs:** $t = \lambda x : T_1.\, t_1$, which is a value.

**Case T-App:** $t = t_1\;t_2$ with $\emptyset \mid \Sigma \vdash t_1 : T_{11} \to T_{12}$ and $\emptyset \mid \Sigma \vdash t_2 : T_{11}$.

By the induction hypothesis on $t_1$: either $t_1$ is a value or $t_1$ can step.

- If $t_1$ can step to $t_1' \mid \mu'$, then $t_1\;t_2 \mid \mu \to t_1'\;t_2 \mid \mu'$ by E-App1.
- If $t_1$ is a value, by the induction hypothesis on $t_2$: either $t_2$ is a value or $t_2$ can step.
  - If $t_2$ can step to $t_2' \mid \mu'$, then $v_1\;t_2 \mid \mu \to v_1\;t_2' \mid \mu'$ by E-App2.
  - If $t_2$ is a value, then $t_1 = \lambda x : T_{11}.\, t_{12}$ (by the canonical forms lemma for function types) and $(\lambda x : T_{11}.\, t_{12})\;v_2 \mid \mu \to [x \mapsto v_2]\,t_{12} \mid \mu$ by E-AppAbs.

**Case T-Ref:** $t = \text{ref}\;t_1$ with $\emptyset \mid \Sigma \vdash t_1 : T_1$.

By the induction hypothesis on $t_1$: either $t_1$ is a value or $t_1$ can step.

- If $t_1$ can step, apply E-Ref.
- If $t_1$ is a value $v_1$, choose a fresh location $l \notin \text{dom}(\mu)$ (possible since $\text{dom}(\mu)$ is finite but $\mathcal{L}$ is infinite) and apply E-RefV.

**Case T-Deref:** $t = \;!\,t_1$ with $\emptyset \mid \Sigma \vdash t_1 : \text{Ref}\;T_1$.

By the induction hypothesis on $t_1$: either $t_1$ is a value or $t_1$ can step.

- If $t_1$ can step, apply E-Deref.
- If $t_1$ is a value, then by the canonical forms lemma for $\text{Ref}\;T_1$, we have $t_1 = l$ for some location $l$ with $\Sigma(l) = T_1$. Since $\emptyset \mid \Sigma \vdash \mu$ and $l \in \text{dom}(\Sigma) = \text{dom}(\mu)$, we have $\mu(l) = v$ for some value $v$. Apply E-DerefLoc.

**Case T-Assign:** $t = t_1 := t_2$ with $\emptyset \mid \Sigma \vdash t_1 : \text{Ref}\;T_1$ and $\emptyset \mid \Sigma \vdash t_2 : T_1$.

By the induction hypothesis on $t_1$ and $t_2$:

- If $t_1$ can step, apply E-Assign1.
- If $t_1$ is a value and $t_2$ can step, apply E-Assign2.
- If both are values, then $t_1 = l$ for some $l$ with $\Sigma(l) = T_1$ (canonical forms). Apply E-Assign.

**Case T-Loc:** $t = l$, which is a value.

All remaining cases (booleans, naturals, pairs, etc.) follow the same pattern as in the standard STLC progress proof. $\square$

### 3.2 Substitution Lemma

**Lemma 3.2 (Substitution).** If $\Gamma, x : S \mid \Sigma \vdash t : T$ and $\Gamma \mid \Sigma \vdash s : S$, then $\Gamma \mid \Sigma \vdash [x \mapsto s]\,t : T$.

*Proof.* By induction on the derivation of $\Gamma, x : S \mid \Sigma \vdash t : T$. The proof is identical to the standard STLC substitution lemma, since the store typing $\Sigma$ is simply carried along unchanged in every rule. $\square$

### 3.3 Preservation

The preservation theorem for references is more delicate than for pure STLC because the store (and therefore the store typing) may change during evaluation.

**Theorem 3.3 (Preservation).** If $\Gamma \mid \Sigma \vdash t : T$ and $\Gamma \mid \Sigma \vdash \mu$ and $t \mid \mu \to t' \mid \mu'$, then there exists a store typing $\Sigma'$ extending $\Sigma$ such that $\Gamma \mid \Sigma' \vdash t' : T$ and $\Gamma \mid \Sigma' \vdash \mu'$.

*Proof.* By induction on the derivation of $t \mid \mu \to t' \mid \mu'$.

**Case E-RefV:** $\text{ref}\;v \mid \mu \to l \mid \mu[l \mapsto v]$ where $l \notin \text{dom}(\mu)$.

From the typing derivation, $\Gamma \mid \Sigma \vdash \text{ref}\;v : \text{Ref}\;T$, so by inversion of T-Ref, $\Gamma \mid \Sigma \vdash v : T$.

Define $\Sigma' = \Sigma[l \mapsto T]$. Since $l \notin \text{dom}(\mu) = \text{dom}(\Sigma)$, we have $\Sigma \subseteq \Sigma'$.

We must show:

1. $\Gamma \mid \Sigma' \vdash l : \text{Ref}\;T$: By T-Loc, since $\Sigma'(l) = T$.
2. $\Gamma \mid \Sigma' \vdash \mu[l \mapsto v]$: The domain is $\text{dom}(\mu) \cup \{l\} = \text{dom}(\Sigma) \cup \{l\} = \text{dom}(\Sigma')$. For every $l' \in \text{dom}(\mu)$, we have $\Gamma \mid \Sigma \vdash \mu(l') : \Sigma(l')$, so by Lemma 2.3 (weakening), $\Gamma \mid \Sigma' \vdash \mu(l') : \Sigma'(l')$. For $l$ itself, $\Gamma \mid \Sigma \vdash v : T$, so by Lemma 2.3, $\Gamma \mid \Sigma' \vdash v : T = \Sigma'(l)$.

**Case E-DerefLoc:** $!\,l \mid \mu \to v \mid \mu$ where $\mu(l) = v$.

Take $\Sigma' = \Sigma$. From typing, $\Gamma \mid \Sigma \vdash \;!\,l : T$, so by inversion of T-Deref, $\Gamma \mid \Sigma \vdash l : \text{Ref}\;T$, so by inversion of T-Loc, $\Sigma(l) = T$. Since $\Gamma \mid \Sigma \vdash \mu$, we have $\Gamma \mid \Sigma \vdash \mu(l) : \Sigma(l) = T$, i.e., $\Gamma \mid \Sigma \vdash v : T$.

**Case E-Assign:** $l := v \mid \mu \to \text{unit} \mid \mu[l \mapsto v]$.

Take $\Sigma' = \Sigma$. From typing, $\Gamma \mid \Sigma \vdash l := v : \text{Unit}$, so by inversion of T-Assign, $\Gamma \mid \Sigma \vdash l : \text{Ref}\;T$ and $\Gamma \mid \Sigma \vdash v : T$ for some $T$. By inversion of T-Loc, $\Sigma(l) = T$.

We must show $\Gamma \mid \Sigma \vdash \mu[l \mapsto v]$. The domain is the same: $\text{dom}(\mu[l \mapsto v]) = \text{dom}(\mu) = \text{dom}(\Sigma)$. For $l' \neq l$, $\mu[l \mapsto v](l') = \mu(l')$ and the typing is unchanged. For $l$ itself, $\mu[l \mapsto v](l) = v$ and $\Gamma \mid \Sigma \vdash v : T = \Sigma(l)$.

Also, $\text{unit}$ has type $\text{Unit}$ by T-Unit.

**Congruence cases (E-Ref, E-Deref, E-Assign1, E-Assign2):** These follow by the induction hypothesis and Lemma 2.3 (weakening). For example, in case E-Ref: $\text{ref}\;t_1 \mid \mu \to \text{ref}\;t_1' \mid \mu'$ where $t_1 \mid \mu \to t_1' \mid \mu'$. From typing, $\Gamma \mid \Sigma \vdash t_1 : T$. By IH, there exists $\Sigma' \supseteq \Sigma$ with $\Gamma \mid \Sigma' \vdash t_1' : T$ and $\Gamma \mid \Sigma' \vdash \mu'$. By T-Ref, $\Gamma \mid \Sigma' \vdash \text{ref}\;t_1' : \text{Ref}\;T$. $\square$

### 3.4 Type Safety

**Corollary 3.4 (Type Safety).** If $\emptyset \mid \Sigma \vdash t : T$ and $\emptyset \mid \Sigma \vdash \mu$, then evaluation of $t$ with store $\mu$ does not get stuck. That is, either evaluation terminates with a value (and a well-typed store), or evaluation diverges, but it never reaches a state where the term is not a value yet no evaluation rule applies.

*Proof.* By iterating Progress and Preservation. At each step, Progress guarantees that the term is either a value or can step. If it steps, Preservation guarantees that the new term is well typed (under a possibly extended store typing) and the new store is well typed.

More precisely, define a configuration $(t, \mu)$ to be **well typed** under $\Sigma$ if $\emptyset \mid \Sigma \vdash t : T$ for some $T$ and $\emptyset \mid \Sigma \vdash \mu$. We prove by induction on the number of evaluation steps $n$ that if $(t_0, \mu_0)$ is well typed and $t_0 \mid \mu_0 \to^n t_n \mid \mu_n$, then either $t_n$ is a value or $(t_n, \mu_n)$ can step (and the resulting configuration is well typed).

- **Base case** ($n = 0$): $(t_0, \mu_0)$ is well typed. By Progress, $t_0$ is a value or can step.
- **Inductive step**: If $(t_n, \mu_n)$ is well typed under some $\Sigma_n$ (guaranteed by repeated application of Preservation), then by Progress it is either a value or can step to $(t_{n+1}, \mu_{n+1})$. By Preservation, there exists $\Sigma_{n+1} \supseteq \Sigma_n$ such that $(t_{n+1}, \mu_{n+1})$ is well typed under $\Sigma_{n+1}$. $\square$

### 3.5 Inversion Lemmas

The proofs above rely on **inversion** of typing derivations. We state the key inversion lemmas explicitly.

**Lemma 3.5 (Inversion of T-Ref).** If $\Gamma \mid \Sigma \vdash \text{ref}\;t : T$, then $T = \text{Ref}\;S$ for some $S$ and $\Gamma \mid \Sigma \vdash t : S$.

*Proof.* The only typing rule with conclusion $\Gamma \mid \Sigma \vdash \text{ref}\;t : T$ is T-Ref, which requires $\Gamma \mid \Sigma \vdash t : S$ and sets $T = \text{Ref}\;S$. $\square$

**Lemma 3.6 (Inversion of T-Deref).** If $\Gamma \mid \Sigma \vdash \;!\,t : T$, then $\Gamma \mid \Sigma \vdash t : \text{Ref}\;T$.

*Proof.* The only applicable rule is T-Deref. $\square$

**Lemma 3.7 (Inversion of T-Assign).** If $\Gamma \mid \Sigma \vdash t_1 := t_2 : T$, then $T = \text{Unit}$ and there exists $S$ such that $\Gamma \mid \Sigma \vdash t_1 : \text{Ref}\;S$ and $\Gamma \mid \Sigma \vdash t_2 : S$.

*Proof.* The only applicable rule is T-Assign. $\square$

**Lemma 3.8 (Inversion of T-Loc).** If $\Gamma \mid \Sigma \vdash l : T$, then $T = \text{Ref}\;S$ for some $S$ with $\Sigma(l) = S$.

*Proof.* The only applicable rule is T-Loc. $\square$

---

## 4. Aliasing and Equational Reasoning

### 4.1 The Problem of Aliasing

Aliasing occurs when two or more program variables refer to the same mutable location. Consider the following program:

$$
\text{let } r = \text{ref}\;0 \text{ in let } s = r \text{ in } (r := 1;\; !\,s)
$$

After executing $r := 1$, the dereference $!\,s$ returns $1$, not $0$, because $r$ and $s$ are aliases for the same location. This is a direct consequence of the semantics: $\text{let } s = r$ does not copy the cell, it copies the location.

### 4.2 Failure of Referential Transparency

In a purely functional language, if $t_1$ and $t_2$ have the same value, then replacing $t_1$ with $t_2$ in any context produces the same result. This property is called **referential transparency**.

References break referential transparency. Consider:

$$t_1 = \text{ref}\;0 \quad\quad t_2 = \text{ref}\;0$$

Both $t_1$ and $t_2$ evaluate to fresh locations, but different fresh locations. So the following two programs have different behaviors:

$$
\text{let } r = \text{ref}\;0 \text{ in } (r, r)
$$

versus

$$
(\text{ref}\;0,\; \text{ref}\;0)
$$

In the first program, both components of the pair are aliases for the same cell. In the second, they are distinct cells. Mutating through one affects the other in the first program but not in the second.

### 4.3 Implications for Compiler Optimizations

The failure of referential transparency means that many standard compiler optimizations become unsound in the presence of references:

1. **Common subexpression elimination.** Replacing two occurrences of $\text{ref}\;0$ with a single shared variable changes program behavior, as shown above.

2. **Code motion.** Moving a read $!\,r$ past a write $s := v$ is unsound if $r$ and $s$ might alias.

3. **Dead code elimination.** An expression $r := v$ cannot be eliminated even if its result ($\text{unit}$) is unused, because it has the side effect of modifying the store.

These issues are central to the study of alias analysis and effect systems, which we will touch on again in Module 09.

### 4.4 The Value Restriction

In languages that combine references with parametric polymorphism (such as Standard ML), an additional subtlety arises. Consider:

$$
\text{let } r : \text{Ref}\;(\forall X.\, X) = \text{ref}\;(\Lambda X.\, \ldots) \text{ in } \ldots
$$

Without care, polymorphic references can be used to break type safety. The classic example is:

$$
\text{let } r = \text{ref}\;(\lambda x.\, x) \text{ in } (r := (\lambda x.\, x + 1);\; (!\,r)\;\text{true})
$$

If $r$ is given the type $\text{Ref}\;(\forall X.\, X \to X)$, then the assignment stores a function $\text{Nat} \to \text{Nat}$ in a cell typed as polymorphic, and the subsequent read applies it to a boolean -- a type error at runtime.

The **value restriction** of Wright (1995) addresses this by allowing polymorphic generalization only for expressions that are syntactic values, not for arbitrary expressions like $\text{ref}\;(\lambda x.\, x)$. This ensures that no side effects occur during the evaluation of the bound expression, preventing the scenario above. We will study this in detail in Module 06 when we treat polymorphism.

---

## 5. Examples

### 5.1 A Simple Counter

$$
\text{let } \textit{counter} = \text{ref}\;0 \text{ in}
$$

$$
\text{let } \textit{incr} = \lambda \_ : \text{Unit}.\, (\textit{counter} := \;!\,\textit{counter} + 1;\; !\,\textit{counter}) \text{ in}
$$

$$
(\textit{incr}\;\text{unit},\; \textit{incr}\;\text{unit})
$$

**Typing derivation.** Let $\Sigma_0 = \emptyset$ initially. After evaluating $\text{ref}\;0$:

- The store becomes $\mu_1 = [l_0 \mapsto 0]$.
- The store typing becomes $\Sigma_1 = [l_0 \mapsto \text{Nat}]$.
- The variable $\textit{counter}$ is bound to $l_0 : \text{Ref}\;\text{Nat}$.

The function $\textit{incr}$ has type $\text{Unit} \to \text{Nat}$.

**Evaluation trace:**

| Step | Term (simplified) | Store |
|------|-------------------|-------|
| 0 | $\textit{incr}\;\text{unit}$ | $[l_0 \mapsto 0]$ |
| 1 | $l_0 := \;!\,l_0 + 1;\; !\,l_0$ | $[l_0 \mapsto 0]$ |
| 2 | $l_0 := 0 + 1;\; !\,l_0$ | $[l_0 \mapsto 0]$ |
| 3 | $l_0 := 1;\; !\,l_0$ | $[l_0 \mapsto 0]$ |
| 4 | $\text{unit};\; !\,l_0$ | $[l_0 \mapsto 1]$ |
| 5 | $!\,l_0$ | $[l_0 \mapsto 1]$ |
| 6 | $1$ | $[l_0 \mapsto 1]$ |

The second call to $\textit{incr}$ produces $2$ since the store now has $l_0 \mapsto 1$. The final result is $(1, 2)$.

### 5.2 Swap Function

A polymorphic swap function (anticipating System F notation) exchanges the contents of two reference cells:

$$
\textit{swap} = \Lambda X.\, \lambda r_1 : \text{Ref}\;X.\, \lambda r_2 : \text{Ref}\;X.\,
$$

$$
\text{let } \textit{tmp} = \;!\,r_1 \text{ in } (r_1 := \;!\,r_2;\; r_2 := \textit{tmp})
$$

This function has type $\forall X.\, \text{Ref}\;X \to \text{Ref}\;X \to \text{Unit}$.

### 5.3 Mutable Linked List (Preview)

With recursive types (Lecture 03c), we can define mutable linked lists:

$$
\text{MutList}\;T = \mu X.\, \text{Ref}\;(\text{Unit} + (T \times X))
$$

Each node is a reference cell containing either $\text{inl}\;\text{unit}$ (nil) or $\text{inr}\;(v, \textit{rest})$ (cons). Because each node is a reference, we can mutate the list in place -- inserting, deleting, and reordering elements by updating pointers.

### 5.4 Detailed Typing Derivation: Counter

We give a complete typing derivation for the counter example (Section 5.1). Let $\Gamma_1 = \textit{counter} : \text{Ref}\;\text{Nat}$ and $\Sigma_1 = [l_0 \mapsto \text{Nat}]$.

**Step 1: Type the dereference $!\,\textit{counter}$.**

$$\frac{\Gamma_1(\textit{counter}) = \text{Ref}\;\text{Nat}}{\Gamma_1 \mid \Sigma_1 \vdash \textit{counter} : \text{Ref}\;\text{Nat}} \quad \text{(T-Var)}$$

$$\frac{\Gamma_1 \mid \Sigma_1 \vdash \textit{counter} : \text{Ref}\;\text{Nat}}{\Gamma_1 \mid \Sigma_1 \vdash \;!\,\textit{counter} : \text{Nat}} \quad \text{(T-Deref)}$$

**Step 2: Type the addition $!\,\textit{counter} + 1$.**

Assuming addition is a derived form with type $\text{Nat} \to \text{Nat} \to \text{Nat}$:

$$\frac{\Gamma_1 \mid \Sigma_1 \vdash \;!\,\textit{counter} : \text{Nat} \quad \Gamma_1 \mid \Sigma_1 \vdash 1 : \text{Nat}}{\Gamma_1 \mid \Sigma_1 \vdash \;!\,\textit{counter} + 1 : \text{Nat}} \quad \text{(T-Add)}$$

**Step 3: Type the assignment $\textit{counter} := \;!\,\textit{counter} + 1$.**

$$\frac{\Gamma_1 \mid \Sigma_1 \vdash \textit{counter} : \text{Ref}\;\text{Nat} \quad \Gamma_1 \mid \Sigma_1 \vdash \;!\,\textit{counter} + 1 : \text{Nat}}{\Gamma_1 \mid \Sigma_1 \vdash \textit{counter} := \;!\,\textit{counter} + 1 : \text{Unit}} \quad \text{(T-Assign)}$$

**Step 4: Type the sequence and the function.**

$$\frac{\Gamma_1 \mid \Sigma_1 \vdash \textit{counter} := \;!\,\textit{counter} + 1 : \text{Unit} \quad \Gamma_1 \mid \Sigma_1 \vdash \;!\,\textit{counter} : \text{Nat}}{\Gamma_1 \mid \Sigma_1 \vdash (\textit{counter} := \;!\,\textit{counter} + 1;\; !\,\textit{counter}) : \text{Nat}} \quad \text{(T-Seq)}$$

$$\frac{\Gamma_1, \_ : \text{Unit} \mid \Sigma_1 \vdash \ldots : \text{Nat}}{\Gamma_1 \mid \Sigma_1 \vdash \lambda \_ : \text{Unit}.\, (\textit{counter} := \ldots;\; !\,\textit{counter}) : \text{Unit} \to \text{Nat}} \quad \text{(T-Abs)}$$

### 5.5 Reference to a Function

References can store functions, enabling higher-order mutable state:

$$\text{let } \textit{callback} = \text{ref}\;(\lambda x : \text{Nat}.\, x) \text{ in}$$

$$\text{let } \_ = \textit{callback} := (\lambda x : \text{Nat}.\, x + 1) \text{ in}$$

$$(!\,\textit{callback})\;5$$

**Typing:** $\textit{callback} : \text{Ref}\;(\text{Nat} \to \text{Nat})$. The initial value $\lambda x.\, x$ has type $\text{Nat} \to \text{Nat}$, and the replacement $\lambda x.\, x + 1$ also has type $\text{Nat} \to \text{Nat}$. The assignment is well typed because both values match the reference's type. The final result is $6$.

### 5.6 Circular Doubly-Linked List (Preview)

With recursive types and references combined, we can encode a circular doubly-linked list:

$$\text{DLNode}\;T = \mu X.\, \text{Ref}\;(T \times X \times X)$$

Each node is a reference to a triple containing the data, a pointer to the next node, and a pointer to the previous node. Circularity arises because the "next" and "prev" pointers of the last and first nodes respectively point back to each other. The combination of $\mu$ (for the recursive structure) and $\text{Ref}$ (for mutation) is essential.

---

## 6. Formal Properties

### 6.1 Determinism

**Theorem 6.1 (Determinism, up to location choice).** If $t \mid \mu \to t_1 \mid \mu_1$ and $t \mid \mu \to t_2 \mid \mu_2$, then either $t_1 = t_2$ and $\mu_1 = \mu_2$, or the two derivations differ only in the choice of fresh location in rule E-RefV.

*Proof sketch.* By induction on the derivation. The only source of nondeterminism is E-RefV, which requires choosing a fresh location $l \notin \text{dom}(\mu)$. All other rules are syntax-directed and deterministic. $\square$

In practice, we can make the semantics fully deterministic by fixing a convention for fresh location generation, such as always choosing the smallest index $n$ such that $l_n \notin \text{dom}(\mu)$.

### 6.2 Store Typing Does Not Shrink

**Lemma 6.2.** If $\Gamma \mid \Sigma \vdash t : T$ and $\Gamma \mid \Sigma \vdash \mu$ and $t \mid \mu \to t' \mid \mu'$, then $\text{dom}(\mu) \subseteq \text{dom}(\mu')$.

*Proof.* By inspection of the evaluation rules. Only E-RefV adds a new location to the store; no rule removes locations. In E-Assign and E-DerefLoc, the domain is unchanged. In congruence rules, the property follows by induction. $\square$

This reflects an important design choice: our language has **no deallocation**. In a real implementation, garbage collection would reclaim unreachable locations, but from the perspective of the operational semantics, the store only grows. This simplifies the type safety proof considerably.

### 6.3 Cyclic Stores

References allow the creation of cyclic data structures. For example:

$$
\text{let } r = \text{ref}\;(\lambda x : \text{Nat}.\, x) \text{ in } r := (\lambda x : \text{Nat}.\, (!\,r)\;x)
$$

After this assignment, the store contains a location $l_0$ that maps to a closure that itself dereferences $l_0$. This is a form of "tying the knot" -- creating recursion through the store rather than through a fixed-point operator.

The well-typed store condition handles this correctly: $\Sigma(l_0) = \text{Nat} \to \text{Nat}$, and the value stored at $l_0$ does indeed have type $\text{Nat} \to \text{Nat}$ under $\Sigma$ (since $!\,r$ dereferences $l_0$, which has type $\text{Ref}\;(\text{Nat} \to \text{Nat})$ under $\Sigma$, yielding $\text{Nat} \to \text{Nat}$).

---

## 7. Variations and Extensions

### 7.1 Mutable Variables vs. Reference Cells

Some languages (e.g., C, Java) provide mutable variables rather than explicit reference cells. In such languages, every variable binding is implicitly a mutable cell. This is a simpler surface syntax but makes the semantics more complex: the environment must map variables to locations, and the store maps locations to values. This two-level indirection is sometimes called the "environment-store" model.

The ML approach -- where variables are immutable and mutation is explicit via `ref` cells -- is cleaner from a type-theoretic perspective. It separates two concerns: naming (handled by variable binding) and mutation (handled by references).

### 7.2 Strong and Weak References

In our formalization, the type of a reference cell is fixed at allocation time and never changes. This is called a **strong** reference. Some systems allow **weak** references, where the type of the stored value may change over time. Weak references require more complex type systems (e.g., flow-sensitive types) and are harder to reason about.

### 7.3 Sequencing

We have been using the semicolon $t_1;\, t_2$ as syntactic sugar for $(\lambda \_ : \text{Unit}.\, t_2)\;t_1$. This evaluates $t_1$ for its side effects, discards the result (which must be $\text{unit}$), and then evaluates $t_2$. This encoding works perfectly well with our existing rules, but some presentations add explicit sequencing rules:

$$\frac{t_1 \mid \mu \to t_1' \mid \mu'}{t_1;\, t_2 \mid \mu \to t_1';\, t_2 \mid \mu'} \quad \text{(E-Seq)}$$

$$\frac{}{\text{unit};\, t_2 \mid \mu \to t_2 \mid \mu} \quad \text{(E-SeqNext)}$$

$$\frac{\Gamma \mid \Sigma \vdash t_1 : \text{Unit} \quad \Gamma \mid \Sigma \vdash t_2 : T}{\Gamma \mid \Sigma \vdash t_1;\, t_2 : T} \quad \text{(T-Seq)}$$

### 7.4 References and Nontermination

References, combined with the ability to store functions, provide a mechanism for encoding general recursion without an explicit fixed-point operator. The "Landin's knot" construction works as follows:

$$
\text{let } r = \text{ref}\;(\lambda x : T.\, x) \text{ in}
$$

$$
r := (\lambda x : T.\, f\;(!\,r)\;x);\; !\,r
$$

This stores a self-referential function in $r$, effectively creating a fixed point of $f$. This is related to the $\text{fix}$ operator we will study in Lecture 03d.

**Important consequence:** STLC with references is Turing-complete. The strong normalization property of pure STLC is lost. There exist well-typed programs that diverge.

### 7.5 Garbage Collection and Reachability

In our formal semantics, the store only grows: locations are never deallocated. In practice, a language runtime uses **garbage collection** to reclaim locations that are no longer reachable from the current term.

**Definition 7.1 (Reachability).** A location $l$ is **reachable** from a term $t$ and store $\mu$ if:

1. $l$ appears syntactically in $t$, or
2. $l$ appears in $\mu(l')$ for some location $l'$ that is reachable from $t$ and $\mu$.

A location that is not reachable can be safely removed from the store without affecting the evaluation of $t$.

**Theorem 7.2 (Garbage collection preserves semantics).** Let $\mu$ be a store and $t$ a term. Let $\mu'$ be the restriction of $\mu$ to the locations reachable from $t$ and $\mu$. Then for any evaluation sequence starting from $(t, \mu)$, the same evaluation sequence is valid starting from $(t, \mu')$ (up to renaming of freshly allocated locations).

We omit the proof, which requires a notion of store bisimulation. The key insight is that unreachable locations are never dereferenced or assigned, so their presence or absence does not affect evaluation.

### 7.6 Region-Based Memory Management

An alternative to garbage collection is **region-based memory management** (Tofte and Talpin, 1997). In this approach, the type system tracks the region in which each reference is allocated, and entire regions are deallocated when they go out of scope. This provides deterministic memory management without runtime overhead.

The typing judgment is extended with region annotations:

$$\Gamma \vdash t : T \text{ at } \rho$$

where $\rho$ is a region variable. Reference allocation creates cells in a specified region, and the region is deallocated when execution leaves the scope that created it.

This approach is used in MLKit (a region-based ML implementation) and has influenced the design of Rust's ownership and borrowing system, which can be understood as a form of region-based management using affine types (Module 09).

### 7.7 Arrays as References

Arrays can be understood as a generalization of references: an array of type $T$ with $n$ elements is essentially a function from indices $\{0, \ldots, n-1\}$ to mutable cells of type $T$. We can formalize arrays in our system as follows:

$$\text{Array}\;T = \text{Ref}\;(\text{Nat} \to T)$$

However, this encoding does not capture bounds checking. A more faithful encoding uses dependent types (Module 08) to track array length:

$$\text{Array}\;(n : \text{Nat})\;T = \text{Ref}\;(\text{Fin}\;n \to T)$$

where $\text{Fin}\;n$ is the type of natural numbers less than $n$.

---

## 8. Connection to Programming Languages

### 8.1 OCaml

In OCaml, references are first-class values:

```
let r = ref 0 in      (* r : int ref *)
r := !r + 1;           (* assignment, dereference *)
!r                     (* yields 1 *)
```

OCaml's `ref` corresponds exactly to our $\text{Ref}$ type. The `!` operator is dereference, and `:=` is assignment. The `ref` keyword serves double duty: as a type constructor (`int ref`) and as a value constructor (`ref 0`).

### 8.2 Standard ML

Standard ML uses the same `ref` mechanism but with slightly different syntax for type annotations: `int ref` rather than `ref int`. The value restriction (Section 4.4) was introduced in SML to resolve the interaction between references and polymorphism.

### 8.3 Haskell

Haskell encapsulates mutation within the `IO` monad (`IORef`) or the `ST` monad (`STRef`). The `ST` monad is particularly elegant: it uses rank-2 polymorphism to ensure that references cannot escape the scope of the stateful computation, providing a safe, pure interface to mutation:

```
runST :: (forall s. ST s a) -> a
```

The type variable `s` acts as a "region" tag. Because it is universally quantified, no `STRef s a` can appear in the result type `a`, guaranteeing that all mutation is encapsulated.

### 8.4 Rust

Rust takes a fundamentally different approach to mutable state. Instead of garbage-collected references, Rust uses an **ownership** system based on affine types:

- Each value has exactly one owner at any time.
- When the owner goes out of scope, the value is dropped (deallocated).
- Mutable access requires a unique (`&mut`) borrow, enforced at compile time.

This prevents aliasing of mutable references entirely, avoiding the issues discussed in Section 4. The trade-off is that some programming patterns (e.g., doubly-linked lists, graph structures) become difficult to express without `unsafe` blocks.

From a type-theoretic perspective, Rust's borrow checker can be understood as a form of **linear** or **affine type system** with regions, which we will study in Module 09.

### 8.5 Java and C#

In Java and C#, all object variables are implicitly references (except primitive types). The language does not distinguish between `int` (a value) and `Integer` (a reference to a boxed integer) at the type level in the same way that ML does. Assignment of object variables copies the reference, not the object -- creating aliases.

Java's `final` keyword and C#'s `readonly` keyword provide a limited form of immutability (the reference cannot be reassigned, but the referenced object can still be mutated). This is weaker than ML's approach, where `ref` is explicit and the variable binding is always immutable.

---

## 9. Exercises

### Exercise 9.1

Give a complete typing derivation for the following term under an appropriate store typing:

$$\text{let } r_1 = \text{ref}\;\text{true} \text{ in let } r_2 = \text{ref}\;r_1 \text{ in } !\,(!\,r_2)$$

What is the type of this term? What are the types of $r_1$ and $r_2$?

### Exercise 9.2

Consider the term:

$$\text{let } r = \text{ref}\;(\lambda x : \text{Nat}.\, x) \text{ in } r := (\lambda x : \text{Bool}.\, x);\; (!\,r)\;5$$

Is this term well typed? If not, identify which typing rule is violated and explain why the type system correctly rejects it.

### Exercise 9.3

Prove that the following program evaluates to $(1, 0)$:

$$\text{let } r_1 = \text{ref}\;0 \text{ in let } r_2 = \text{ref}\;0 \text{ in } (r_1 := 1;\; (!\,r_1, !\,r_2))$$

Give the complete evaluation trace, showing the store at each step.

### Exercise 9.4

The evaluation rule E-Assign returns $\text{unit}$ as the result of an assignment. Some languages (e.g., C) return the assigned value instead. Modify the typing and evaluation rules for assignment to return the assigned value. What type would $t_1 := t_2$ have under this modified rule? Does type safety still hold?

### Exercise 9.5 (Challenging)

Prove that in STLC with references, if $\emptyset \mid \Sigma \vdash t : T$ and $t$ is a closed value (i.e., $\text{FV}(t) = \emptyset$), then all locations appearing in $t$ are in $\text{dom}(\Sigma)$. (Hint: by induction on the typing derivation.)

---

## Summary

- **References** extend STLC with mutable state via the type $\text{Ref}\;T$ and operations $\text{ref}$, $!$, and $:=$.
- **The store** $\mu$ maps locations to values; the **store typing** $\Sigma$ maps locations to types.
- **Typing rules** T-Ref, T-Deref, T-Assign, and T-Loc formalize the static semantics.
- **Evaluation** is defined as $t \mid \mu \to t' \mid \mu'$, threading the store through each step.
- **Type safety** (Progress + Preservation) holds, with the key insight that the store typing extends monotonically -- it grows with new locations but never changes existing type assignments.
- **Aliasing** breaks referential transparency and complicates equational reasoning and compiler optimizations.
- **References + higher-order functions** yield Turing-completeness, even without an explicit $\text{fix}$ operator.

---

## 10. Denotational Semantics of References

### 10.1 Domain-Theoretic Model

The denotational semantics of references requires a **store-passing** interpretation. A computation that may allocate, read, or write references is modeled as a function from stores to pairs of values and stores:

$$\lbrack\!\lbrack T \rbrack\!\rbrack_{\text{comp}} = \text{Store} \to (\lbrack\!\lbrack T \rbrack\!\rbrack_{\text{val}} \times \text{Store})_\bot$$

where $\text{Store} = \text{Loc} \rightharpoonup \bigcup_T \lbrack\!\lbrack T \rbrack\!\rbrack_{\text{val}}$ and the $\bot$ subscript indicates a lifted domain (adding a bottom element for nontermination).

This is precisely the **state monad**:

$$\text{State}\;S\;A = S \to (A \times S)$$

with:

$$\text{return}\;a = \lambda s.\, (a, s)$$

$$\text{bind}\;m\;f = \lambda s.\, \text{let}\;(a, s') = m\;s\;\text{in}\;f\;a\;s'$$

The reference operations have the following denotations:

$$\lbrack\!\lbrack \text{ref}\;v \rbrack\!\rbrack = \lambda s.\, \text{let}\;l = \text{fresh}(s)\;\text{in}\;(l, s[l \mapsto v])$$

$$\lbrack\!\lbrack !\,l \rbrack\!\rbrack = \lambda s.\, (s(l), s)$$

$$\lbrack\!\lbrack l := v \rbrack\!\rbrack = \lambda s.\, (\text{unit}, s[l \mapsto v])$$

### 10.2 Adequacy

A key property of the denotational semantics is **adequacy**: the denotational semantics agrees with the operational semantics.

**Theorem 10.1 (Adequacy).** For any closed term $t$ of type $T$:

1. If $t \mid \mu \to^* v \mid \mu'$ (operational), then $\lbrack\!\lbrack t \rbrack\!\rbrack(\mu) = (v, \mu')$ (denotational).
2. If $t \mid \mu$ diverges, then $\lbrack\!\lbrack t \rbrack\!\rbrack(\mu) = \bot$.

The proof uses logical relations and is beyond the scope of this lecture. See Pitts (1996) for details.

### 10.3 The Monad Laws

The state monad satisfies the three monad laws:

1. **Left identity:** $\text{bind}\;(\text{return}\;a)\;f = f\;a$
2. **Right identity:** $\text{bind}\;m\;\text{return} = m$
3. **Associativity:** $\text{bind}\;(\text{bind}\;m\;f)\;g = \text{bind}\;m\;(\lambda a.\, \text{bind}\;(f\;a)\;g)$

These laws ensure that the monadic composition is well-behaved and that the store-passing style introduces no spurious effects.

---

## 11. Advanced: Logical Relations for References

### 11.1 The Challenge

Proving properties of programs with references using logical relations is significantly more complex than for pure programs. The standard approach (Lecture 02) defines a logical relation $\mathcal{V}\lbrack\!\lbrack T \rbrack\!\rbrack$ on closed values by induction on $T$. For references, we need the logical relation to also quantify over stores and store typings.

### 11.2 Kripke Logical Relations

The standard technique is to use **Kripke logical relations** (named by analogy with Kripke semantics for modal logic). A Kripke logical relation is parameterized by a "world" that can grow over time -- in our case, the world is the store typing $\Sigma$.

**Definition 11.1 (Kripke value relation).** The relation $\mathcal{V}_\Sigma\lbrack\!\lbrack T \rbrack\!\rbrack$ on closed values is defined by induction on $T$:

- $\mathcal{V}_\Sigma\lbrack\!\lbrack \text{Nat} \rbrack\!\rbrack = \{v \mid v \text{ is a numeric value}\}$
- $\mathcal{V}_\Sigma\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack = \{v \mid v = \lambda x.\, t \text{ and for all } \Sigma' \supseteq \Sigma \text{ and } v' \in \mathcal{V}_{\Sigma'}\lbrack\!\lbrack T_1 \rbrack\!\rbrack, [x \mapsto v']\,t \in \mathcal{E}_{\Sigma'}\lbrack\!\lbrack T_2 \rbrack\!\rbrack\}$
- $\mathcal{V}_\Sigma\lbrack\!\lbrack \text{Ref}\;T \rbrack\!\rbrack = \{l \mid l \in \text{dom}(\Sigma) \text{ and } \Sigma(l) = T\}$

The key feature is the universal quantification over future worlds $\Sigma' \supseteq \Sigma$ in the function case. This ensures that the relation is monotone with respect to store typing extension -- once two values are related, they remain related as the store grows.

### 11.3 Applications

Kripke logical relations for references are used to prove:

1. **Representation independence:** Two implementations of an abstract data type (using references internally) are interchangeable if they are related by the logical relation.
2. **Parametricity with state:** Free theorems for polymorphic functions in the presence of mutable state.
3. **Compiler correctness:** Optimizations that transform stateful code preserve the observational behavior.

Ahmed (2004) developed a step-indexed Kripke logical relation for a language with references and recursive types, providing a powerful framework for reasoning about such programs.

---

## 12. Historical Notes

The formalization of references in type theory has a rich history:

1. **Landin (1966)** introduced the SECD machine, which uses an explicit store for mutable variables. This is one of the earliest formal treatments of state in programming language semantics.

2. **Reynolds (1981)** developed the "Idealized Algol" language, which combines a typed lambda calculus with block-structured mutable variables. Reynolds used a functor-category semantics to model the interaction between local state and higher-order functions.

3. **Tofte (1990)** and **Wright (1995)** resolved the interaction between ML-style references and Hindley-Milner type inference, leading to the value restriction.

4. **Pierce and Turner (1994)** studied the interaction of references and subtyping, showing that $\text{Ref}$ is invariant.

5. **Ahmed, Fluet, and Morrisett (2007)** developed L3, a linear language with locations that uses linear types to control aliasing, providing a type-theoretic foundation for region-based memory management.

---

## Further Reading

- Pierce, B. C. (2002). *Types and Programming Languages*, Chapter 13: References.
- Harper, R. (2016). *Practical Foundations for Programming Languages*, Chapter 35: Assignable References.
- Wright, A. K. (1995). Simple imperative polymorphism. *Lisp and Symbolic Computation*, 8(4), 343-355.
- Tofte, M. (1990). Type inference for polymorphic references. *Information and Computation*, 89(1), 1-34.
- Launchbury, J., & Peyton Jones, S. L. (1995). State in Haskell. *Lisp and Symbolic Computation*, 8(4), 293-341.
- Ahmed, A., Fluet, M., & Morrisett, G. (2007). L3: A linear language with locations. *Fundamenta Informaticae*, 77(4), 397-449.
- Ahmed, A. (2004). Semantics of types for mutable state. Ph.D. thesis, Princeton University.
- Pitts, A. M. (1996). Relational properties of domains. *Information and Computation*, 127(2), 66-90.
- Reynolds, J. C. (1981). The essence of Algol. In *Algorithmic Languages*, pp. 345-372.
- Tofte, M., & Talpin, J.-P. (1997). Region-based memory management. *Information and Computation*, 132(2), 109-176.
- Pierce, B. C., & Turner, D. N. (1994). Simple type-theoretic foundations for object-oriented programming. *Journal of Functional Programming*, 4(2), 207-247.
- O'Hearn, P. W. (2007). Resources, concurrency, and local reasoning. *Theoretical Computer Science*, 375(1-3), 271-307.

---

## Appendix A: Complete Inference Rules

For reference, we collect all typing rules for STLC extended with references in one place. The typing judgment has the form $\Gamma \mid \Sigma \vdash t : T$.

**Variables and abstraction:**

$$\frac{x : T \in \Gamma}{\Gamma \mid \Sigma \vdash x : T} \quad \text{(T-Var)}$$

$$\frac{\Gamma, x : T_1 \mid \Sigma \vdash t : T_2}{\Gamma \mid \Sigma \vdash \lambda x : T_1.\, t : T_1 \to T_2} \quad \text{(T-Abs)}$$

$$\frac{\Gamma \mid \Sigma \vdash t_1 : T_1 \to T_2 \quad \Gamma \mid \Sigma \vdash t_2 : T_1}{\Gamma \mid \Sigma \vdash t_1\;t_2 : T_2} \quad \text{(T-App)}$$

**Unit:**

$$\frac{}{\Gamma \mid \Sigma \vdash \text{unit} : \text{Unit}} \quad \text{(T-Unit)}$$

**References:**

$$\frac{\Sigma(l) = T}{\Gamma \mid \Sigma \vdash l : \text{Ref}\;T} \quad \text{(T-Loc)}$$

$$\frac{\Gamma \mid \Sigma \vdash t : T}{\Gamma \mid \Sigma \vdash \text{ref}\;t : \text{Ref}\;T} \quad \text{(T-Ref)}$$

$$\frac{\Gamma \mid \Sigma \vdash t : \text{Ref}\;T}{\Gamma \mid \Sigma \vdash \;!\,t : T} \quad \text{(T-Deref)}$$

$$\frac{\Gamma \mid \Sigma \vdash t_1 : \text{Ref}\;T \quad \Gamma \mid \Sigma \vdash t_2 : T}{\Gamma \mid \Sigma \vdash t_1 := t_2 : \text{Unit}} \quad \text{(T-Assign)}$$

**Sequencing:**

$$\frac{\Gamma \mid \Sigma \vdash t_1 : \text{Unit} \quad \Gamma \mid \Sigma \vdash t_2 : T}{\Gamma \mid \Sigma \vdash t_1;\, t_2 : T} \quad \text{(T-Seq)}$$

**Evaluation rules (computation):**

$$\frac{l \notin \text{dom}(\mu)}{\text{ref}\;v \mid \mu \to l \mid \mu[l \mapsto v]} \quad \text{(E-RefV)}$$

$$\frac{\mu(l) = v}{\;!\,l \mid \mu \to v \mid \mu} \quad \text{(E-DerefLoc)}$$

$$\frac{}{l := v \mid \mu \to \text{unit} \mid \mu[l \mapsto v]} \quad \text{(E-Assign)}$$

$$\frac{}{(\lambda x : T.\, t)\;v \mid \mu \to [x \mapsto v]\,t \mid \mu} \quad \text{(E-AppAbs)}$$

$$\frac{}{\text{unit};\, t_2 \mid \mu \to t_2 \mid \mu} \quad \text{(E-SeqNext)}$$

**Evaluation rules (congruence):**

$$\frac{t_1 \mid \mu \to t_1' \mid \mu'}{t_1\;t_2 \mid \mu \to t_1'\;t_2 \mid \mu'} \quad \text{(E-App1)}$$

$$\frac{t_2 \mid \mu \to t_2' \mid \mu'}{v\;t_2 \mid \mu \to v\;t_2' \mid \mu'} \quad \text{(E-App2)}$$

$$\frac{t \mid \mu \to t' \mid \mu'}{\text{ref}\;t \mid \mu \to \text{ref}\;t' \mid \mu'} \quad \text{(E-Ref)}$$

$$\frac{t \mid \mu \to t' \mid \mu'}{\;!\,t \mid \mu \to \;!\,t' \mid \mu'} \quad \text{(E-Deref)}$$

$$\frac{t_1 \mid \mu \to t_1' \mid \mu'}{t_1 := t_2 \mid \mu \to t_1' := t_2 \mid \mu'} \quad \text{(E-Assign1)}$$

$$\frac{t_2 \mid \mu \to t_2' \mid \mu'}{v := t_2 \mid \mu \to v := t_2' \mid \mu'} \quad \text{(E-Assign2)}$$

$$\frac{t_1 \mid \mu \to t_1' \mid \mu'}{t_1;\, t_2 \mid \mu \to t_1';\, t_2 \mid \mu'} \quad \text{(E-Seq)}$$

---

## Appendix B: Worked Example -- Proof of Preservation for E-RefV

We give a fully detailed proof of the preservation case for E-RefV, as a model for the level of detail expected in the homework.

**Goal:** Show that if $\Gamma \mid \Sigma \vdash \text{ref}\;v : T$ and $\Gamma \mid \Sigma \vdash \mu$ and $\text{ref}\;v \mid \mu \to l \mid \mu[l \mapsto v]$ (by E-RefV, with $l \notin \text{dom}(\mu)$), then there exists $\Sigma' \supseteq \Sigma$ such that $\Gamma \mid \Sigma' \vdash l : T$ and $\Gamma \mid \Sigma' \vdash \mu[l \mapsto v]$.

**Step 1: Invert the typing derivation.**

From $\Gamma \mid \Sigma \vdash \text{ref}\;v : T$, by Lemma 3.5 (inversion of T-Ref), we obtain:

- $T = \text{Ref}\;S$ for some type $S$.
- $\Gamma \mid \Sigma \vdash v : S$.

**Step 2: Construct the extended store typing.**

Define $\Sigma' = \Sigma \cup \{l \mapsto S\}$ (equivalently, $\Sigma[l \mapsto S]$).

**Step 3: Verify $\Sigma \subseteq \Sigma'$.**

Since $l \notin \text{dom}(\mu) = \text{dom}(\Sigma)$ (by the premise of E-RefV and condition (1) of $\Gamma \mid \Sigma \vdash \mu$):

- $\text{dom}(\Sigma) \subseteq \text{dom}(\Sigma') = \text{dom}(\Sigma) \cup \{l\}$. Check.
- For all $l' \in \text{dom}(\Sigma)$: $l' \neq l$ (since $l \notin \text{dom}(\Sigma)$), so $\Sigma'(l') = \Sigma(l')$. Check.

Therefore $\Sigma \subseteq \Sigma'$ by Definition 2.2.

**Step 4: Show $\Gamma \mid \Sigma' \vdash l : \text{Ref}\;S$.**

We need $\Sigma'(l) = S$. By construction, $\Sigma'(l) = S$. By T-Loc, $\Gamma \mid \Sigma' \vdash l : \text{Ref}\;S$. Since $T = \text{Ref}\;S$, we have $\Gamma \mid \Sigma' \vdash l : T$.

**Step 5: Show $\Gamma \mid \Sigma' \vdash \mu[l \mapsto v]$.**

We verify both conditions of Definition 2.1:

*Condition (1):* $\text{dom}(\mu[l \mapsto v]) = \text{dom}(\mu) \cup \{l\} = \text{dom}(\Sigma) \cup \{l\} = \text{dom}(\Sigma')$. Check.

*Condition (2):* For each $l' \in \text{dom}(\mu[l \mapsto v])$:

- **Sub-case $l' = l$:** We need $\Gamma \mid \Sigma' \vdash \mu[l \mapsto v](l) : \Sigma'(l)$, i.e., $\Gamma \mid \Sigma' \vdash v : S$. We know $\Gamma \mid \Sigma \vdash v : S$ (from Step 1). By Lemma 2.3 (weakening, since $\Sigma \subseteq \Sigma'$), $\Gamma \mid \Sigma' \vdash v : S$.

- **Sub-case $l' \neq l$:** Then $l' \in \text{dom}(\mu)$ and $\mu[l \mapsto v](l') = \mu(l')$ and $\Sigma'(l') = \Sigma(l')$. From $\Gamma \mid \Sigma \vdash \mu$, we have $\Gamma \mid \Sigma \vdash \mu(l') : \Sigma(l')$. By Lemma 2.3, $\Gamma \mid \Sigma' \vdash \mu(l') : \Sigma'(l')$.

Both conditions hold. Therefore $\Gamma \mid \Sigma' \vdash \mu[l \mapsto v]$. $\square$

## Appendix C: Substitution and Store Typing

A subtlety in the preservation proof is that substitution interacts with store typing. We state the key substitution lemma used throughout.

**Lemma (Substitution).** If $\Gamma, x : S \mid \Sigma \vdash t : T$ and $\Gamma \mid \Sigma \vdash v : S$, then $\Gamma \mid \Sigma \vdash [x \mapsto v]\,t : T$.

*Proof.* By induction on the derivation of $\Gamma, x : S \mid \Sigma \vdash t : T$. The key observation is that substitution does not affect the store typing $\Sigma$, since substitution only replaces term variables, not locations. All cases proceed as in the pure STLC substitution lemma, with the store typing $\Sigma$ passing through unchanged. The new cases for $\text{ref}$, $!$, and $:=$ are straightforward since these are first-order operations on their arguments. $\square$

**Lemma (Store Update).** If $\Gamma \mid \Sigma \vdash \mu$ and $\Sigma(l) = T$ and $\Gamma \mid \Sigma \vdash v : T$, then $\Gamma \mid \Sigma \vdash \mu[l \mapsto v]$.

*Proof.* For any $l' \in \text{dom}(\mu)$: if $l' = l$, then $\mu[l \mapsto v](l) = v$ and $\Gamma \mid \Sigma \vdash v : T = \Sigma(l)$; if $l' \neq l$, then $\mu[l \mapsto v](l') = \mu(l')$ and $\Gamma \mid \Sigma \vdash \mu(l') : \Sigma(l')$ by hypothesis. $\square$
