---
title: "Lecture 04c: Metatheory of Subtyping"
tags:
  - type-theory
  - subtyping
  - lecture
---
# Lecture 04c: Metatheory of Subtyping

> **Module 04 -- Subtyping (Weeks 7-8)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **State** and **prove** the progress theorem for the STLC with subtyping.
2. **State** and **prove** the preservation theorem for the STLC with subtyping.
3. **Formulate** the updated canonical forms lemma accounting for subsumption.
4. **Prove** the inversion lemma for the typing relation with subtyping.
5. **Distinguish** minimal typing from arbitrary typing and explain principal types in the presence of subtyping.
6. **Describe** coercion semantics and prove that it preserves the behavior of the source language.
7. **Analyze** the interaction between subtyping and type inference at a conceptual level.

---

## 1. Motivation

### 1.1 Why Metatheory Matters

The subtyping and typing rules from Lectures 04a and 04b extend the STLC in a way that preserves the essential safety guarantee: **well-typed programs do not get stuck**. But this guarantee is not obvious from the rules alone. Subsumption fundamentally changes the typing relation, and we must verify that the proofs of progress and preservation still go through.

### 1.2 What Changes?

In the STLC without subtyping (Module 02), the metatheory relied on two key properties:

1. **Unique typing**: each well-typed term has exactly one type. With subtyping, a term may have many types.

2. **Inversion**: if $\Gamma \vdash \lambda x : T_1.\, t_2 : T_1 \to T_2$, then $\Gamma, x : T_1 \vdash t_2 : T_2$. With subtyping, the last rule used to derive $\Gamma \vdash t : T$ might be T-Sub rather than the "natural" rule for $t$'s syntactic form. The inversion lemma must be strengthened.

3. **Canonical forms**: if $v$ is a value of type $\text{Bool}$, then $v$ is either $\text{true}$ or $\text{false}$. With subtyping, $v$ might have been typed at a subtype of $\text{Bool}$ and then subsumed. We must account for this.

This lecture works through these issues carefully.

### 1.3 Roadmap

1. The inversion lemma for typing with subtyping.
2. The canonical forms lemma (updated).
3. The substitution lemma (straightforward extension).
4. Progress.
5. Preservation.
6. Minimal typing and principal types.
7. Coercion semantics.

---

## 2. Core Theory

### 2.1 The Inversion Lemma

In the STLC without subtyping, if $\Gamma \vdash \lambda x : T_1.\, t_2 : T$, then $T = T_1 \to T_2$ for some $T_2$ and $\Gamma, x : T_1 \vdash t_2 : T_2$. This is immediate because the only typing rule with $\lambda$ in the conclusion is T-Abs.

With subtyping, the derivation $\Gamma \vdash \lambda x : T_1.\, t_2 : T$ might end with T-Sub:

$$\frac{\displaystyle\frac{\Gamma, x : T_1 \vdash t_2 : S_2}{\Gamma \vdash \lambda x : T_1.\, t_2 : T_1 \to S_2} \; \text{(T-Abs)} \qquad T_1 \to S_2 <: T}{\Gamma \vdash \lambda x : T_1.\, t_2 : T} \quad \text{(T-Sub)}$$

And there might be multiple applications of T-Sub, chained together. We need to "see through" all the subsumption steps to reach the underlying T-Abs.

**Lemma 2.1 (Inversion for Abstraction).** If $\Gamma \vdash \lambda x : S_1.\, t_2 : T$, then there exists a type $S_2$ such that:
1. $\Gamma, x : S_1 \vdash t_2 : S_2$
2. $S_1 \to S_2 <: T$

*Proof.* By induction on the derivation of $\Gamma \vdash \lambda x : S_1.\, t_2 : T$.

**Case T-Abs:** The derivation concludes with

$$\frac{\Gamma, x : S_1 \vdash t_2 : S_2}{\Gamma \vdash \lambda x : S_1.\, t_2 : S_1 \to S_2}$$

Take $S_2$ as given. Then $\Gamma, x : S_1 \vdash t_2 : S_2$ and $S_1 \to S_2 <: S_1 \to S_2$ by S-Refl.

**Case T-Sub:** The derivation concludes with

$$\frac{\Gamma \vdash \lambda x : S_1.\, t_2 : U \qquad U <: T}{\Gamma \vdash \lambda x : S_1.\, t_2 : T}$$

By the induction hypothesis on $\Gamma \vdash \lambda x : S_1.\, t_2 : U$, there exists $S_2$ such that $\Gamma, x : S_1 \vdash t_2 : S_2$ and $S_1 \to S_2 <: U$. By S-Trans with $U <: T$, we get $S_1 \to S_2 <: T$.

No other typing rules apply to $\lambda x : S_1.\, t_2$, so these are the only cases. $\square$

**Lemma 2.2 (Inversion for Application).** If $\Gamma \vdash t_1\; t_2 : T$, then there exist types $T_{11}$ and $T_{12}$ such that:
1. $\Gamma \vdash t_1 : T_{11} \to T_{12}$
2. $\Gamma \vdash t_2 : T_{11}$
3. $T_{12} <: T$

*Proof.* By induction on the derivation.

**Case T-App:** Immediate with $T_{12} = T$ and $T <: T$ by S-Refl.

**Case T-Sub:** $\Gamma \vdash t_1\; t_2 : U$ and $U <: T$. By IH, there exist $T_{11}, T_{12}$ with $\Gamma \vdash t_1 : T_{11} \to T_{12}$, $\Gamma \vdash t_2 : T_{11}$, and $T_{12} <: U$. By S-Trans, $T_{12} <: T$. $\square$

**Lemma 2.3 (Inversion for Variables).** If $\Gamma \vdash x : T$, then there exists a type $S$ such that $x : S \in \Gamma$ and $S <: T$.

*Proof.* By induction on the derivation.

**Case T-Var:** $x : T \in \Gamma$. Take $S = T$ and $T <: T$ by S-Refl.

**Case T-Sub:** $\Gamma \vdash x : U$ with $U <: T$. By IH, $x : S \in \Gamma$ with $S <: U$. By S-Trans, $S <: T$. $\square$

**Lemma 2.4 (Inversion for Records).** If $\Gamma \vdash \{l_i = t_i\}_{i \in 1..n} : T$, then there exist types $S_i$ such that:
1. $\Gamma \vdash t_i : S_i$ for each $i \in 1..n$
2. $\{l_i : S_i\}_{i \in 1..n} <: T$

*Proof.* By induction on the derivation, analogous to the abstraction case. $\square$

**Lemma 2.5 (Inversion for Projection).** If $\Gamma \vdash t.l_j : T$, then there exist types $T_i$ and $n \geq j$ such that:
1. $\Gamma \vdash t : \{l_i : T_i\}_{i \in 1..n}$
2. $T_j <: T$

*Proof.* By induction on the derivation. $\square$

We will need one more inversion lemma -- this time on the subtype relation rather than the typing relation.

**Lemma 2.6 (Subtype Inversion for Arrows).** If $S_1 \to S_2 <: T$ and $T \neq \top$, then $T = T_1 \to T_2$ for some $T_1, T_2$ with $T_1 <: S_1$ and $S_2 <: T_2$.

*Proof.* We use the equivalence of declarative and algorithmic subtyping (Lecture 04b). If $S_1 \to S_2 <:_a T$ and $T \neq \top$, then the only applicable rule is SA-Arrow, which gives $T = T_1 \to T_2$ with $T_1 <:_a S_1$ and $S_2 <:_a T_2$. By soundness, $T_1 <: S_1$ and $S_2 <: T_2$. $\square$

**Lemma 2.7 (Subtype Inversion for Records).** If $\{l_i : S_i\}_{i \in 1..n} <: T$ and $T \neq \top$, then $T = \{k_j : T_j\}_{j \in 1..m}$ where for each $j \in 1..m$, there exists $i \in 1..n$ with $k_j = l_i$ and $S_i <: T_j$.

*Proof.* Analogous, using SA-Rcd. $\square$

### 2.2 Canonical Forms Lemma

The canonical forms lemma tells us the shape of values at specific types. With subtyping, a value might have been typed at a subtype and then subsumed. We must account for this.

**Lemma 2.8 (Canonical Forms for Booleans).** If $v$ is a value and $\Gamma \vdash v : \text{Bool}$, then $v = \text{true}$ or $v = \text{false}$.

*Proof.* We consider what forms $v$ can take and whether they can have type $\text{Bool}$.

- $v = \text{true}$: typed as $\text{Bool}$ by T-True, so $\text{Bool} <: \text{Bool}$ by S-Refl. Valid.
- $v = \text{false}$: similarly. Valid.
- $v = \lambda x : T.\, t$: by Lemma 2.1, $S_1 \to S_2 <: \text{Bool}$. But arrow types are not subtypes of $\text{Bool}$ (the only supertype of $\text{Bool}$ that an arrow type can be a subtype of is $\top$, and $\text{Bool} \neq \top$). Invalid.
- $v = nv$ (numeric value): has type $\text{Nat}$. Is $\text{Nat} <: \text{Bool}$? No -- $\text{Bool} <: \text{Nat}$ (if S-BoolNat), but not the reverse. Invalid.
- $v = \{v_1, v_2\}$: has product type. No product type is a subtype of $\text{Bool}$. Invalid.
- $v = \text{inl}\; v'$ or $v = \text{inr}\; v'$: has sum type. No sum type is a subtype of $\text{Bool}$. Invalid.
- $v = \{l_i = v_i\}$: has record type. No record type is a subtype of $\text{Bool}$. Invalid.

So $v$ must be $\text{true}$ or $\text{false}$. $\square$

**Lemma 2.9 (Canonical Forms for Arrows).** If $v$ is a value and $\Gamma \vdash v : T_1 \to T_2$, then $v = \lambda x : S_1.\, t_2$ for some $S_1$ and $t_2$ with $T_1 <: S_1$.

*Proof.* We consider the possible forms of $v$.

- $v = \lambda x : S_1.\, t_2$: by Lemma 2.1, there exists $S_2$ with $S_1 \to S_2 <: T_1 \to T_2$. By Lemma 2.6, $T_1 <: S_1$ and $S_2 <: T_2$. Valid.
- $v = \text{true}$ or $v = \text{false}$: has type $\text{Bool}$. Is $\text{Bool} <: T_1 \to T_2$? Only if $T_1 \to T_2 = \top$, but $\top$ is not an arrow type. Invalid.
- $v = nv$: has type $\text{Nat}$. Similarly invalid.
- $v = \{v_1, v_2\}$: product type, not a subtype of an arrow. Invalid.
- $v = \text{inl}\; v'$ or $v = \text{inr}\; v'$: sum type, not a subtype of an arrow. Invalid.
- $v = \{l_i = v_i\}$: record type, not a subtype of an arrow. Invalid.

So $v$ must be a lambda abstraction $\lambda x : S_1.\, t_2$ with $T_1 <: S_1$. $\square$

**Lemma 2.10 (Canonical Forms for Products).** If $v$ is a value and $\Gamma \vdash v : T_1 \times T_2$, then $v = \{v_1, v_2\}$ where $\Gamma \vdash v_1 : S_1$ and $\Gamma \vdash v_2 : S_2$ with $S_1 <: T_1$ and $S_2 <: T_2$.

*Proof.* Similar case analysis. Only pairs can have product types (up to subsumption). $\square$

**Lemma 2.11 (Canonical Forms for Records).** If $v$ is a value and $\Gamma \vdash v : \{l_i : T_i\}_{i \in 1..n}$, then $v = \{k_j = v_j\}_{j \in 1..m}$ where for each $i \in 1..n$, there exists $j$ with $k_j = l_i$ and $\Gamma \vdash v_j : S_j$ with $S_j <: T_i$.

*Proof.* Only record values can have record types (up to subsumption). By Lemma 2.4 and Lemma 2.7, the record value has at least the fields required by the supertype, with compatible field types. $\square$

### 2.3 The Substitution Lemma

**Lemma 2.12 (Substitution).** If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\,t : T$.

*Proof.* By induction on the derivation of $\Gamma, x : S \vdash t : T$. The proof is essentially the same as in the STLC (Module 02), with one additional case.

**Case T-Sub:** $\Gamma, x : S \vdash t : T$ is derived from $\Gamma, x : S \vdash t : U$ and $U <: T$. By IH, $\Gamma \vdash [x \mapsto s]\,t : U$. By T-Sub with $U <: T$, $\Gamma \vdash [x \mapsto s]\,t : T$.

All other cases proceed exactly as before. $\square$

---

## 3. Progress

**Theorem 3.1 (Progress).** If $\vdash t : T$ (i.e., $t$ is a closed, well-typed term), then either:
1. $t$ is a value, or
2. There exists $t'$ such that $t \to t'$.

*Proof.* By induction on the derivation of $\vdash t : T$.

**Case T-Var:** $t = x$ with $x : T \in \emptyset$. Impossible -- the empty context contains no bindings.

**Case T-Abs:** $t = \lambda x : T_1.\, t_2$. This is a value.

**Case T-App:** $t = t_1\; t_2$ with $\vdash t_1 : T_{11} \to T_{12}$ and $\vdash t_2 : T_{11}$.

By IH on $t_1$:
- If $t_1 \to t_1'$, then $t_1\; t_2 \to t_1'\; t_2$ by E-App1.
- If $t_1$ is a value, then by IH on $t_2$:
  - If $t_2 \to t_2'$, then $t_1\; t_2 \to t_1\; t_2'$ by E-App2.
  - If $t_2$ is a value, then $t_1$ is a value of arrow type. By Lemma 2.9, $t_1 = \lambda x : S_1.\, t_{12}$ with $T_{11} <: S_1$. (We have $\vdash t_2 : T_{11}$ and $T_{11} <: S_1$, so by T-Sub, $\vdash t_2 : S_1$, but this is not needed for the step -- the step is purely syntactic.) Then $(\lambda x : S_1.\, t_{12})\; t_2 \to [x \mapsto t_2]\,t_{12}$ by E-AppAbs.

**Case T-True, T-False:** $t = \text{true}$ or $t = \text{false}$. These are values.

**Case T-If:** $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$ with $\vdash t_1 : \text{Bool}$.

By IH on $t_1$:
- If $t_1 \to t_1'$, then the if-expression steps by E-If.
- If $t_1$ is a value, then by Lemma 2.8, $t_1 = \text{true}$ or $t_1 = \text{false}$. In either case, the if-expression steps by E-IfTrue or E-IfFalse.

**Case T-Rcd:** $t = \{l_i = t_i\}_{i \in 1..n}$. If all $t_i$ are values, then $t$ is a value. Otherwise, the leftmost non-value $t_i$ steps, and the whole record steps.

**Case T-Proj:** $t = t_0.l_j$ with $\vdash t_0 : \{l_i : T_i\}_{i \in 1..n}$.

By IH on $t_0$:
- If $t_0 \to t_0'$, then $t_0.l_j \to t_0'.l_j$ by E-Proj.
- If $t_0$ is a value, then by Lemma 2.11, $t_0 = \{k_p = v_p\}_{p \in 1..m}$ where for each $i$, there exists $p$ with $k_p = l_i$. In particular, there exists $p$ with $k_p = l_j$. Then $\{k_p = v_p\}_{p \in 1..m}.l_j \to v_p$ by E-ProjRcd.

**Case T-Pair:** $t = \{t_1, t_2\}$. If both $t_1$ and $t_2$ are values, then $t$ is a value. Otherwise, the leftmost non-value steps.

**Case T-Fst:** $t = t_0.1$ with $\vdash t_0 : T_1 \times T_2$. By IH, either $t_0$ steps or $t_0$ is a value. If a value, by Lemma 2.10, $t_0 = \{v_1, v_2\}$, so $\{v_1, v_2\}.1 \to v_1$.

**Case T-Snd:** Analogous.

**Case T-Inl, T-Inr:** $t = \text{inl}\; t_0$ or $t = \text{inr}\; t_0$. If $t_0$ is a value, $t$ is a value. Otherwise, $t_0$ steps and so does $t$.

**Case T-Case:** $t = \text{case}\; t_0\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2$ with $\vdash t_0 : T_1 + T_2$. By IH, either $t_0$ steps or is a value. If a value, by canonical forms for sums, $t_0 = \text{inl}\; v$ or $t_0 = \text{inr}\; v$. In either case, the case-expression steps.

**Case T-Sub:** $\vdash t : T$ from $\vdash t : S$ and $S <: T$. By IH on $\vdash t : S$, either $t$ is a value or $t$ steps. Either way, the conclusion holds (the same value or step works at type $T$). $\square$

**Remark 3.2.** The T-Sub case is straightforward: progress is a property of the term, not the type, so the ability to view $t$ at a different type does not affect whether $t$ can make progress.

---

## 4. Preservation

**Theorem 4.1 (Preservation).** If $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$.

**Case T-Var:** $t = x$. Variables do not step, so this case is vacuous.

**Case T-Abs:** $t = \lambda x : T_1.\, t_2$. Abstractions do not step, so this case is vacuous.

**Case T-App:** $t = t_1\; t_2$ with $\Gamma \vdash t_1 : T_{11} \to T_{12}$, $\Gamma \vdash t_2 : T_{11}$, and $T = T_{12}$.

Sub-case E-App1: $t_1 \to t_1'$. By IH, $\Gamma \vdash t_1' : T_{11} \to T_{12}$. By T-App, $\Gamma \vdash t_1'\; t_2 : T_{12}$.

Sub-case E-App2: $t_1$ is a value, $t_2 \to t_2'$. By IH, $\Gamma \vdash t_2' : T_{11}$. By T-App, $\Gamma \vdash t_1\; t_2' : T_{12}$.

Sub-case E-AppAbs: $t_1 = \lambda x : S_1.\, t_{12}$ and $t_2$ is a value $v_2$. Then $t' = [x \mapsto v_2]\,t_{12}$.

We know $\Gamma \vdash \lambda x : S_1.\, t_{12} : T_{11} \to T_{12}$. By Lemma 2.1, there exists $S_2$ such that $\Gamma, x : S_1 \vdash t_{12} : S_2$ and $S_1 \to S_2 <: T_{11} \to T_{12}$.

By Lemma 2.6, $T_{11} <: S_1$ and $S_2 <: T_{12}$.

We have $\Gamma \vdash v_2 : T_{11}$ and $T_{11} <: S_1$. By T-Sub, $\Gamma \vdash v_2 : S_1$.

By Lemma 2.12 (substitution), $\Gamma \vdash [x \mapsto v_2]\,t_{12} : S_2$.

Since $S_2 <: T_{12} = T$, by T-Sub, $\Gamma \vdash [x \mapsto v_2]\,t_{12} : T$.

**Case T-If:** $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$ with $\Gamma \vdash t_1 : \text{Bool}$, $\Gamma \vdash t_2 : T$, $\Gamma \vdash t_3 : T$.

Sub-case E-IfTrue: $t_1 = \text{true}$, $t' = t_2$. We have $\Gamma \vdash t_2 : T$.
Sub-case E-IfFalse: $t_1 = \text{false}$, $t' = t_3$. We have $\Gamma \vdash t_3 : T$.
Sub-case E-If: $t_1 \to t_1'$. By IH, $\Gamma \vdash t_1' : \text{Bool}$. By T-If, $\Gamma \vdash \text{if}\; t_1'\; \text{then}\; t_2\; \text{else}\; t_3 : T$.

**Case T-Rcd:** $t = \{l_i = t_i\}_{i \in 1..n}$ with $\Gamma \vdash t_i : T_i$ for each $i$, and $T = \{l_i : T_i\}_{i \in 1..n}$.

If $t_j \to t_j'$ for some $j$ (the leftmost non-value), then by IH, $\Gamma \vdash t_j' : T_j$. By T-Rcd, $\Gamma \vdash \{l_1 = v_1, \ldots, l_j = t_j', \ldots, l_n = t_n\} : \{l_i : T_i\}_{i \in 1..n}$.

**Case T-Proj:** $t = t_0.l_j$ with $\Gamma \vdash t_0 : \{l_i : T_i\}_{i \in 1..n}$ and $T = T_j$.

Sub-case E-Proj: $t_0 \to t_0'$. By IH, $\Gamma \vdash t_0' : \{l_i : T_i\}_{i \in 1..n}$. By T-Proj, $\Gamma \vdash t_0'.l_j : T_j$.

Sub-case E-ProjRcd: $t_0 = \{k_p = v_p\}_{p \in 1..m}$ and $t' = v_p$ where $k_p = l_j$.

We have $\Gamma \vdash \{k_p = v_p\}_{p \in 1..m} : \{l_i : T_i\}_{i \in 1..n}$. By Lemma 2.4, there exist $S_p$ such that $\Gamma \vdash v_p : S_p$ and $\{k_p : S_p\}_{p \in 1..m} <: \{l_i : T_i\}_{i \in 1..n}$.

By Lemma 2.7, for $l_j$ (which is in the supertype's fields), there exists $p$ with $k_p = l_j$ and $S_p <: T_j$. So $\Gamma \vdash v_p : S_p$ and $S_p <: T_j$. By T-Sub, $\Gamma \vdash v_p : T_j = T$.

**Case T-Pair, T-Fst, T-Snd:** Similar to the record and projection cases.

**Case T-Inl, T-Inr, T-Case:** Similar to the boolean and if-expression cases, using canonical forms for sums.

**Case T-Sub:** $\Gamma \vdash t : T$ from $\Gamma \vdash t : S$ and $S <: T$. If $t \to t'$, then by IH on $\Gamma \vdash t : S$, we get $\Gamma \vdash t' : S$. By T-Sub with $S <: T$, $\Gamma \vdash t' : T$. $\square$

**Remark 4.2.** The T-Sub case in preservation is again straightforward. The hard work is in the T-App/E-AppAbs case, where we need the inversion lemma for abstractions (Lemma 2.1), the subtype inversion for arrows (Lemma 2.6), and the substitution lemma (Lemma 2.12). The interaction of subsumption with beta-reduction is the central technical challenge.

**Remark 4.3.** Note how the preservation proof for T-App/E-AppAbs uses T-Sub to bridge the gap between the parameter type $S_1$ (from the lambda) and the argument type $T_{11}$ (from the application rule). This is the subtyping equivalent of what was a trivial type-equality step in the STLC.

---

## 5. Type Safety

**Corollary 5.1 (Type Safety).** If $\vdash t : T$ and $t \to^* t'$ (where $t'$ is in normal form), then $t'$ is a value.

*Proof.* By induction on the number of steps $t \to^* t'$, using preservation (to maintain well-typedness at each step) and progress (to show that a stuck term is not well-typed). $\square$

**Corollary 5.2.** Well-typed programs in the STLC with subtyping never get stuck.

---

## 6. Minimal Typing and Principal Types

### 6.1 Unique Types vs. Multiple Types

In the STLC (without subtyping), each well-typed term has a unique type. With subtyping, a term can have many types: if $\Gamma \vdash t : S$ and $S <: T$, then $\Gamma \vdash t : T$. But among all these types, there is always a "best" one.

### 6.2 Minimal Types

**Definition 6.1.** A type $S$ is a **minimal type** of $t$ under $\Gamma$ if:
1. $\Gamma \vdash t : S$.
2. For all $T$ with $\Gamma \vdash t : T$, we have $S <: T$.

**Theorem 6.2 (Existence of Minimal Types).** In the STLC with subtyping (with explicit type annotations on abstractions), every well-typed term has a minimal type.

*Proof.* By induction on the structure of $t$.

**Case $t = x$:** The minimal type is $\Gamma(x)$.

If $\Gamma \vdash x : T$, then by Lemma 2.3, $x : S \in \Gamma$ with $S <: T$. Since contexts assign unique types to variables, $S = \Gamma(x)$. So $\Gamma(x) <: T$ for all $T$ with $\Gamma \vdash x : T$.

**Case $t = \lambda x : T_1.\, t_2$:** By IH, $t_2$ has a minimal type $S_2$ under $\Gamma, x : T_1$. The minimal type of $t$ is $T_1 \to S_2$.

If $\Gamma \vdash \lambda x : T_1.\, t_2 : T$, then by Lemma 2.1, there exists $S_2'$ with $\Gamma, x : T_1 \vdash t_2 : S_2'$ and $T_1 \to S_2' <: T$. Since $S_2$ is minimal for $t_2$, $S_2 <: S_2'$. By S-Arrow (with S-Refl for the domain), $T_1 \to S_2 <: T_1 \to S_2' <: T$ by S-Trans.

**Case $t = t_1\; t_2$:** By IH, $t_1$ has minimal type $M_1$ and $t_2$ has minimal type $M_2$. The minimal type $M_1$ must be an arrow type $S_{11} \to S_{12}$ (for $t_1\; t_2$ to be well-typed). The minimal type of $t_1\; t_2$ is $S_{12}$.

If $\Gamma \vdash t_1\; t_2 : T$, then by Lemma 2.2, there exist $T_{11}, T_{12}$ with $\Gamma \vdash t_1 : T_{11} \to T_{12}$, $\Gamma \vdash t_2 : T_{11}$, and $T_{12} <: T$. Since $S_{11} \to S_{12}$ is minimal for $t_1$, $S_{11} \to S_{12} <: T_{11} \to T_{12}$, which by Lemma 2.6 gives $T_{11} <: S_{11}$ and $S_{12} <: T_{12}$. So $S_{12} <: T_{12} <: T$.

**Case $t = \{l_i = t_i\}_{i \in 1..n}$:** The minimal type is $\{l_i : S_i\}$ where each $S_i$ is the minimal type of $t_i$.

**Case $t = t_0.l_j$:** If $t_0$ has minimal type $\{l_i : S_i\}_{i \in 1..n}$ with $j \in 1..n$, then the minimal type of $t_0.l_j$ is $S_j$.

The remaining cases (pairs, projections, if-expressions, etc.) are similar. $\square$

### 6.3 Minimal Types and the Algorithmic System

**Proposition 6.3.** The algorithmic typing relation $\Gamma \vdash_a t : T$ computes the minimal type: if $\Gamma \vdash_a t : T$, then $T$ is the minimal type of $t$ under $\Gamma$.

This justifies viewing the algorithmic type checker as computing the "best" type for each term.

### 6.4 Principal Types

In type systems with type inference (Module 05), we speak of **principal types**: the most general type scheme from which all other types can be obtained by instantiation. With subtyping, the notion becomes:

**Definition 6.4.** A type $S$ is a **principal type** of $t$ under $\Gamma$ if:
1. $\Gamma \vdash t : S$.
2. For all $T$ with $\Gamma \vdash t : T$, we have $S <: T$.

In our system (with explicit annotations), the principal type coincides with the minimal type. In systems with type inference and subtyping, finding principal types is significantly more complex (see Remark 7.1).

---

## 7. Subtyping and Type Inference

### 7.1 The Interaction Problem

**Remark 7.1.** Combining subtyping with type inference is notoriously difficult. In the Hindley-Milner system (Module 05), type inference reduces to solving equality constraints via unification. With subtyping, equality constraints become **inequality constraints** ($S <: T$), and the constraint-solving problem becomes much harder:

1. **Subtype constraints** $\alpha <: T$ or $S <: \alpha$ (where $\alpha$ is a type variable) do not uniquely determine $\alpha$. There may be many solutions.

2. **Principal solutions** may not exist in the usual sense. Instead, one works with **constraint sets** or **type schemes with constraints**.

3. **Decidability** depends on the specific type system. For simple subtyping (without bounded quantification), the problem is decidable (Pottier 1998). For $F_{<:}$ (bounded quantification, Module 07), subtype checking is undecidable (Pierce 1994).

### 7.2 Approaches

Several approaches have been developed:

- **Constraint-based inference** (Aiken and Wimmers 1993, Pottier 1998): Generate subtyping constraints and solve them. Works for simple subtyping but does not scale well to bounded quantification.

- **Local type inference** (Pierce and Turner 2000): Propagate type information bidirectionally, inferring types locally without solving global constraint systems.

- **Colored local type inference** (Odersky, Zenger, and Zenger 2001): Extends local type inference with "colors" to track the direction of type propagation. Used in Scala.

- **MLsub** (Dolan and Mycroft 2017): A novel system that integrates subtyping into ML-style type inference by using a different representation of types (allowing type intersections and unions), achieving principal type inference.

---

## 8. Detailed Example: End-to-End Proof

We work through a complete example of using progress and preservation to show that a specific program evaluates safely.

### 8.1 The Program

Consider the following term:

$$t = (\lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; f\; \{x = 0, y = \text{true}\})\;(\lambda r : \{x : \text{Nat}, y : \text{Bool}\}.\; r.x)$$

Wait -- does this even type check? Let us verify.

The argument $\lambda r : \{x : \text{Nat}, y : \text{Bool}\}.\; r.x$ has type $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$.

The function expects type $\{x : \text{Nat}\} \to \text{Nat}$.

Is $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat} <: \{x : \text{Nat}\} \to \text{Nat}$?

By S-Arrow: need $\{x : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Bool}\}$ (contravariant domain). But this fails: the record with fewer fields is not a subtype of the one with more fields.

So this term is **ill-typed**! Let us fix it:

$$t = (\lambda f : \{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}.\; f\; \{x = 0, y = \text{true}\})\;(\lambda r : \{x : \text{Nat}\}.\; r.x)$$

Now the argument $\lambda r : \{x : \text{Nat}\}.\; r.x$ has type $\{x : \text{Nat}\} \to \text{Nat}$.

The function expects $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$.

Is $\{x : \text{Nat}\} \to \text{Nat} <: \{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$?

By S-Arrow: need $\{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$ (contravariant domain, and this holds by width subtyping) and $\text{Nat} <: \text{Nat}$ (covariant codomain, by S-Refl). Yes!

### 8.2 Typing Derivation

Let $g = \lambda r : \{x : \text{Nat}\}.\; r.x$ and $f = \lambda f' : \{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}.\; f'\; \{x = 0, y = \text{true}\}$.

1. $\vdash g : \{x : \text{Nat}\} \to \text{Nat}$ (by T-Abs and T-Proj).
2. $\{x : \text{Nat}\} \to \text{Nat} <: \{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$ (by S-Arrow, as above).
3. $\vdash g : \{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$ (by T-Sub from 1 and 2).
4. $\vdash f : (\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}) \to \text{Nat}$ (by T-Abs, T-App, T-Rcd).
5. $\vdash f\; g : \text{Nat}$ (by T-App from 4 and 3).

### 8.3 Evaluation Trace

$$t = (\lambda f' : \ldots.\; f'\; \{x = 0, y = \text{true}\})\;(\lambda r : \{x : \text{Nat}\}.\; r.x)$$

Step 1: Beta-reduce (E-AppAbs):

$$t \to (\lambda r : \{x : \text{Nat}\}.\; r.x)\;\{x = 0, y = \text{true}\}$$

Step 2: Beta-reduce (E-AppAbs):

$$\to [r \mapsto \{x = 0, y = \text{true}\}]\;(r.x) = \{x = 0, y = \text{true}\}.x$$

Step 3: Project (E-ProjRcd):

$$\to 0$$

The final result is $0$, a value of type $\text{Nat}$.

### 8.4 Preservation at Each Step

**Step 1:** $\vdash t : \text{Nat}$ and $t \to t_1 = g\;\{x = 0, y = \text{true}\}$. By preservation (T-App/E-AppAbs case), $\vdash t_1 : \text{Nat}$.

The key subtlety: the function $g = \lambda r : \{x : \text{Nat}\}.\; r.x$ has parameter type $\{x : \text{Nat}\}$, and the argument $\{x = 0, y = \text{true}\}$ has type $\{x : \text{Nat}, y : \text{Bool}\}$. By width subtyping, $\{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$, so by T-Sub the argument can be viewed at type $\{x : \text{Nat}\}$. Substitution gives $r.x$ with $r = \{x = 0, y = \text{true}\}$, and under the context where $r : \{x : \text{Nat}\}$, $r.x : \text{Nat}$.

**Step 2:** $\vdash t_1 : \text{Nat}$ and $t_1 \to t_2 = \{x = 0, y = \text{true}\}.x$. By preservation, $\vdash t_2 : \text{Nat}$.

**Step 3:** $\vdash t_2 : \text{Nat}$ and $t_2 \to 0$. By preservation, $\vdash 0 : \text{Nat}$.

The value $0$ has type $\text{Nat}$, confirming type safety.

---

## 9. Coercion Semantics

### 9.1 Motivation

An alternative to the "subsumption as forgetting" view is to make subtyping operationally explicit through **coercions**. In coercion semantics, the type checker produces a target term that includes explicit coercion functions wherever subsumption was applied.

### 9.2 The Idea

For each subtyping derivation $S <: T$, we generate a coercion function $c_{S <: T} : S \to T$ that transforms a value of type $S$ into a value of type $T$.

For example:
- $c_{\text{Refl}} = \lambda x : S.\, x$ (identity coercion)
- $c_{S <: \top} = \lambda x : S.\, \text{unit}$ (erase to unit, or box as $\top$-value)
- $c_{S_1 \to S_2 <: T_1 \to T_2} = \lambda f : S_1 \to S_2.\, \lambda x : T_1.\, c_{S_2 <: T_2}\;(f\;(c_{T_1 <: S_1}\;x))$

### 9.3 Formal Definition

We define a coercion translation $\lbrack\!\lbrack \cdot \rbrack\!\rbrack$ that maps each subtyping derivation to a coercion term in a target language (the STLC without subtyping).

**Subtyping coercions:**

$$\lbrack\!\lbrack S <: S \rbrack\!\rbrack_{\text{S-Refl}} = \lambda x : S.\, x$$

$$\lbrack\!\lbrack S <: T \rbrack\!\rbrack_{\text{S-Trans}} = \lambda x : S.\, \lbrack\!\lbrack U <: T \rbrack\!\rbrack\;(\lbrack\!\lbrack S <: U \rbrack\!\rbrack\;x) \quad \text{(where } S <: U \text{ and } U <: T\text{)}$$

$$\lbrack\!\lbrack S <: \top \rbrack\!\rbrack_{\text{S-Top}} = \lambda x : S.\, \text{unit}$$

$$\lbrack\!\lbrack S_1 \to S_2 <: T_1 \to T_2 \rbrack\!\rbrack_{\text{S-Arrow}} = \lambda f : S_1 \to S_2.\, \lambda x : T_1.\, \lbrack\!\lbrack S_2 <: T_2 \rbrack\!\rbrack\;(f\;(\lbrack\!\lbrack T_1 <: S_1 \rbrack\!\rbrack\;x))$$

$$\lbrack\!\lbrack S_1 \times S_2 <: T_1 \times T_2 \rbrack\!\rbrack_{\text{S-Prod}} = \lambda p : S_1 \times S_2.\, \{\lbrack\!\lbrack S_1 <: T_1 \rbrack\!\rbrack\;(p.1),\; \lbrack\!\lbrack S_2 <: T_2 \rbrack\!\rbrack\;(p.2)\}$$

$$\lbrack\!\lbrack \{k_j : S_j\} <: \{l_i : T_i\} \rbrack\!\rbrack_{\text{S-Rcd}} = \lambda r : \{k_j : S_j\}.\, \{l_i = \lbrack\!\lbrack S_{j_i} <: T_i \rbrack\!\rbrack\;(r.k_{j_i})\}_{i \in 1..n}$$

where $k_{j_i}$ is the label in the subtype matching $l_i$.

### 9.4 Typing Translation

The typing translation inserts coercions wherever T-Sub is used:

$$\lbrack\!\lbrack \Gamma \vdash t : T \rbrack\!\rbrack_{\text{T-Sub}} = \lbrack\!\lbrack S <: T \rbrack\!\rbrack\;(\lbrack\!\lbrack \Gamma \vdash t : S \rbrack\!\rbrack)$$

For all other typing rules, the translation is structural (homomorphic).

### 9.5 Coherence

A critical property of coercion semantics is **coherence**: different derivations of the same typing judgment $\Gamma \vdash t : T$ should produce coercion terms that are semantically equivalent (i.e., compute the same result).

**Theorem 9.1 (Coherence).** If $\mathcal{D}_1$ and $\mathcal{D}_2$ are two derivations of $\Gamma \vdash t : T$, then $\lbrack\!\lbrack \mathcal{D}_1 \rbrack\!\rbrack =_{\beta\eta} \lbrack\!\lbrack \mathcal{D}_2 \rbrack\!\rbrack$.

*Proof sketch.* The proof relies on the fact that different coercions for the same subtyping judgment $S <: T$ are extensionally equal. The key insight is that every coercion $c : S \to T$ arising from a subtyping derivation $S <: T$ is uniquely determined (up to $\beta\eta$-equivalence) by $S$ and $T$ alone, not by the particular derivation.

For example, both $\lbrack\!\lbrack S <: T \rbrack\!\rbrack$ via one derivation and $\lbrack\!\lbrack S <: T \rbrack\!\rbrack$ via another derivation will produce functions that agree on all inputs. This is because the structural rules (reflexivity, transitivity) only introduce identity coercions or compositions that reduce to the same final function.

The formal proof is by induction on derivations, showing that the critical case (two different uses of S-Trans with different intermediate types) produces extensionally equal coercion functions. $\square$

### 9.6 Why Coercion Semantics?

Coercion semantics is useful for:

1. **Compilation**: It provides a way to "compile away" subtyping by translating to a simpler target language. Java's class hierarchy, for example, does not use explicit coercion at the JVM level (it uses pointer casting, which is a runtime no-op for reference types), but numeric coercions (int to double) are explicit in the bytecode.

2. **Understanding runtime costs**: In the direct semantics, subsumption is "free" (no runtime cost). In coercion semantics, each subsumption step has a cost (executing the coercion function). This makes the performance implications of subtyping explicit.

3. **Semantic foundations**: Coercion semantics provides a denotational model for subtyping: the meaning of $S <: T$ is the coercion function $c : S \to T$.

### 9.7 Worked Example: Arrow Coercion

Let us work through the coercion for $\text{Top} \to \text{Nat} <: \text{Nat} \to \top$.

By S-Arrow, the derivation uses:
- $\text{Nat} <: \top$ (domain, contravariant)
- $\text{Nat} <: \top$ (codomain, covariant)

The coercion is:

$$\lbrack\!\lbrack \top \to \text{Nat} <: \text{Nat} \to \top \rbrack\!\rbrack = \lambda f : \top \to \text{Nat}.\, \lambda x : \text{Nat}.\, \lbrack\!\lbrack \text{Nat} <: \top \rbrack\!\rbrack\;(f\;(\lbrack\!\lbrack \text{Nat} <: \top \rbrack\!\rbrack\;x))$$

Now $\lbrack\!\lbrack \text{Nat} <: \top \rbrack\!\rbrack = \lambda y : \text{Nat}.\, \text{unit}$ (the coercion to $\top$ discards the value).

Substituting:

$$= \lambda f : \top \to \text{Nat}.\, \lambda x : \text{Nat}.\, (\lambda y : \text{Nat}.\, \text{unit})\;(f\;((\lambda y : \text{Nat}.\, \text{unit})\;x))$$

Beta-reducing:

$$\to_\beta \lambda f : \top \to \text{Nat}.\, \lambda x : \text{Nat}.\, (\lambda y : \text{Nat}.\, \text{unit})\;(f\;\text{unit})$$

$$\to_\beta \lambda f : \top \to \text{Nat}.\, \lambda x : \text{Nat}.\, \text{unit}$$

The coercion takes a function $f : \top \to \text{Nat}$, applies it (to unit, since the argument is erased to $\top$), and then discards the result (coercing $\text{Nat}$ to $\top$). The result is always $\text{unit}$, regardless of $x$. This reveals the information loss inherent in this particular subtyping step.

### 9.8 Coercions for Records

Record coercions are particularly illuminating:

$$\lbrack\!\lbrack \{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\} \rbrack\!\rbrack = \lambda r : \{x : \text{Nat}, y : \text{Bool}\}.\, \{x = r.x\}$$

The coercion explicitly drops the $y$ field. At runtime, this requires allocating a new record with only the $x$ field. This reveals a hidden cost of record subtyping in languages that implement it via coercions.

An alternative implementation strategy (used in practice) is to keep the runtime representation unchanged and simply ignore extra fields. This is the approach taken in TypeScript, OCaml's object system, and most OOP runtimes.

### 9.9 Coercion Composition and Optimization

In practice, coercion-based compilation generates many identity coercions and compositions that can be optimized away.

**Identity elimination:** $\lbrack\!\lbrack S <: S \rbrack\!\rbrack = \lambda x : S.\, x$ is the identity function. Any composition with the identity can be eliminated:

$$\lbrack\!\lbrack S <: S \rbrack\!\rbrack \circ c = c \qquad c \circ \lbrack\!\lbrack S <: S \rbrack\!\rbrack = c$$

**Composition fusion:** Two consecutive coercions $\lbrack\!\lbrack S <: U \rbrack\!\rbrack$ followed by $\lbrack\!\lbrack U <: T \rbrack\!\rbrack$ can sometimes be fused into a single coercion $\lbrack\!\lbrack S <: T \rbrack\!\rbrack$ without passing through the intermediate type $U$. For record coercions, this means dropping fields once rather than twice:

Instead of:

$$\lambda r.\, \{x = (\lambda r'.\, \{x = r'.x\})\;r'.x\}$$

We produce:

$$\lambda r.\, \{x = r.x\}$$

These optimizations are important for practical compilers that use coercion-based compilation.

### 9.10 Comparison: Direct vs. Coercion Semantics

| Aspect | Direct Semantics | Coercion Semantics |
|--------|-----------------|-------------------|
| Runtime cost of subtyping | None (implicit) | Explicit (coercion functions) |
| Runtime representation | Unchanged by subsumption | May change (e.g., record projection) |
| Compilation target | Language with subtyping | Language without subtyping |
| Coherence requirement | Not applicable | Critical (Theorem 9.1) |
| Type erasure | Natural | Requires coercion insertion |
| Performance analysis | Subtyping is invisible | Costs are explicit |

Most real-world systems use direct semantics (the runtime representation is unchanged), but coercion semantics is theoretically valuable and appears in some contexts:
- **Numeric coercions** (int to float) in C, Java bytecode.
- **Boxing/unboxing** in Java (Integer vs. int).
- **Implicit conversions** in Scala.

---

## 10. Subtyping and Erasure

### 10.1 Type Erasure Semantics

An important observation is that subtyping is compatible with type erasure: if we erase all type annotations from a well-typed program, the resulting untyped program behaves the same way.

Formally, define the **erasure** function $\text{erase}(t)$ that strips type annotations:

$$\text{erase}(\lambda x : T.\, t) = \lambda x.\, \text{erase}(t)$$

$$\text{erase}(t_1\; t_2) = \text{erase}(t_1)\;\text{erase}(t_2)$$

$$\text{erase}(\{l_i = t_i\}) = \{l_i = \text{erase}(t_i)\}$$

$$\text{erase}(t.l) = \text{erase}(t).l$$

**Theorem 10.1 (Erasure Correctness).** If $\Gamma \vdash t : T$ and $t \to t'$ in the typed semantics, then $\text{erase}(t) \to^* \text{erase}(t')$ in the untyped semantics. Conversely, if $\text{erase}(t) \to u'$ in the untyped semantics, then there exists $t'$ with $t \to t'$ and $\text{erase}(t') = u'$.

This theorem confirms that subtyping does not affect the runtime behavior: the same computation occurs whether or not we track types (and subtypes).

### 10.2 Implications for Implementation

Type erasure semantics means that a compiler for a language with subtyping can:
1. Type-check the program (using the algorithmic subtyping and typing relations).
2. Erase all types.
3. Compile the untyped program using standard compilation techniques.

Subtyping affects only the static analysis, not the generated code (in the direct semantics). This is the approach taken by OCaml and Haskell (where type classes provide a form of ad-hoc polymorphism that is compiled away).

### 10.3 When Erasure Fails

Type erasure does **not** work for coercion semantics, because coercions are runtime computations. If the coercion semantics creates a new record (dropping fields during width subtyping), the erased program would miss this record creation.

It also does not work for languages with runtime type dispatch (Java's `instanceof`, Python's `isinstance`), because the runtime type information is needed for dispatch decisions.

The choice between erasure and retention of type information is a fundamental design decision:
- **Erasure** (OCaml, Haskell, our system): simpler compilation, no runtime overhead for types.
- **Retention** (Java, C#): enables reflection, runtime type checks, and serialization, at the cost of runtime overhead.

---

## 11. Common Proof Mistakes

### 11.1 Forgetting to Handle T-Sub

The most common mistake in preservation proofs with subtyping is forgetting that the last rule in a typing derivation might be T-Sub rather than the "expected" rule. For example, when proving preservation for the E-AppAbs case, one might assume that $\Gamma \vdash t_1\; t_2 : T$ was derived by T-App. But it might have been derived by T-Sub applied to a T-App derivation.

The inversion lemma (Lemma 2.2) handles this by "looking through" all T-Sub steps to find the underlying T-App. Always use the inversion lemma rather than pattern-matching directly on the last rule.

### 11.2 Confusing Covariance and Contravariance

When proving that $S_1 \to S_2 <: T_1 \to T_2$, the premises are $T_1 <: S_1$ (not $S_1 <: T_1$!) and $S_2 <: T_2$. The reversal in the domain is easy to get wrong, especially in nested cases.

A useful mnemonic: the domain is "input" (what the function receives), so the subtype must accept **more** inputs (larger domain = supertype of what's supplied). The codomain is "output" (what the function produces), so the subtype must produce **more specific** outputs (smaller codomain = subtype of what's expected).

### 11.3 Incorrect Record Subtyping Direction

Students frequently confuse which direction record subtyping goes:
- **Correct**: $\{x : \text{Nat}, y : \text{Bool}\} <: \{x : \text{Nat}\}$ (more fields = subtype)
- **Incorrect**: $\{x : \text{Nat}\} <: \{x : \text{Nat}, y : \text{Bool}\}$ (fewer fields is NOT a subtype)

The mnemonic: a record with more fields has more obligations (it must satisfy more requirements), making it more specific, hence a subtype.

---

## 12. Advanced Topics

### 12.1 Subtyping with Recursive Types

When recursive types $\mu X.\, T$ interact with subtyping, the subtype relation must be defined coinductively. Two recursive types are in the subtype relation if they can be shown to be subtypes by coinduction -- that is, by assuming they are subtypes and verifying that the assumption is consistent.

**Example 11.1.** Consider:

$$S = \mu X.\, \{val : \text{Nat}, next : X\}$$

$$T = \mu Y.\, \{val : \top, next : Y\}$$

Intuitively, $S <: T$ because $S$ is a stream of natural numbers and $T$ is a stream of arbitrary values. Each unfolding of $S$ gives a record with $val : \text{Nat}$ and $next : S$, while each unfolding of $T$ gives $val : \top$ and $next : T$. Since $\text{Nat} <: \top$ and (coinductively) $S <: T$, the depth subtyping rule gives $S <: T$.

The formal treatment (Amadio and Cardelli 1993) defines the subtype relation as the greatest fixed point of a monotone function on type pairs, making it inherently coinductive.

### 12.2 Intersection and Union Types

**Intersection types** $S \wedge T$ represent values that have both type $S$ and type $T$. They are related to meets: $S \wedge T$ behaves like $S \sqcap T$ but is more general because it applies even when $S$ and $T$ have incompatible outermost constructors.

**Union types** $S \vee T$ represent values that have either type $S$ or type $T$ (but the programmer does not know which). They are related to joins: $S \vee T$ behaves like $S \sqcup T$.

With intersection and union types:
- $S \wedge T <: S$ and $S \wedge T <: T$ (an intersection is a subtype of each component)
- $S <: S \vee T$ and $T <: S \vee T$ (each component is a subtype of the union)

This enriches the subtype lattice and enables more precise typing. Languages with intersection types include TypeScript (`A & B`), Scala (`A with B`), and CDuce.

### 12.3 The Subtyping Lattice

With $\top$, $\bot$, and the type constructors we have defined, the collection of types forms a lattice under the subtype relation:

- $\top$ is the top element.
- $\bot$ is the bottom element.
- The join $S \sqcup T$ is the least upper bound.
- The meet $S \sqcap T$ is the greatest lower bound.

If we add intersection and union types, the lattice structure becomes even richer, forming a **distributive lattice** in some formulations.

---

## Summary

This lecture established the metatheory of the STLC with subtyping:

1. **Inversion lemmas** allow us to "see through" subsumption and determine the actual typing rule used for each syntactic form.

2. **Canonical forms** are updated to account for the fact that a value may have been typed at a subtype and then subsumed. The key change is that canonical forms for arrows yield $T_1 <: S_1$ (the lambda's parameter type is a supertype of the expected domain).

3. **Progress** and **preservation** hold for the STLC with subtyping. The proofs are modular extensions of the STLC proofs, with the T-Sub case being straightforward in both theorems. The hard work is in the interaction between subsumption and beta-reduction (the E-AppAbs case of preservation).

4. **Minimal types** exist and are computed by the algorithmic type checker, providing the most precise type for each term.

5. **Coercion semantics** offers an alternative view where subtyping is compiled into explicit coercion functions. Coherence ensures that the choice of derivation does not affect the runtime behavior.

6. **Type safety** ($=$ progress $+$ preservation) guarantees that well-typed programs with subtyping do not get stuck.

7. **Type erasure** is compatible with subtyping: the runtime behavior of a well-typed program is independent of the types (and subtypes) assigned to its terms.

8. The **narrowing lemma** states that replacing a variable's type with a subtype preserves well-typedness, which is essential for systems with bounded quantification.

---

## Further Reading

### Primary Sources

- **Pierce, B. C. (2002)**. *Types and Programming Languages*, Chapter 16. Contains the full proofs of progress, preservation, and the inversion lemmas. Our presentation closely follows Pierce's.

- **Wright, A. K. and Felleisen, M. (1994)**. "A Syntactic Approach to Type Soundness." *Information and Computation*, 115(1), 38-94. The seminal paper establishing the progress-and-preservation approach to type soundness. Our proof methodology follows this approach.

### Supplementary

- **Amadio, R. M. and Cardelli, L. (1993)**. "Subtyping Recursive Types." *ACM TOPLAS*, 15(4), 575-631. The coinductive treatment of recursive subtyping.

- **Breazu-Tannen, V., Coquand, T., Gunter, C. A., and Scedrov, A. (1991)**. "Inheritance as Implicit Coercion." *Information and Computation*, 93(1), 172-221. The foundational treatment of coercion semantics and coherence.

- **Harper, R. (2016)**. *Practical Foundations for Programming Languages*, 2nd ed., Chapter 24. An alternative presentation of subtyping metatheory using Harper's judgment-based methodology.

- **Dolan, S. and Mycroft, A. (2017)**. "Polymorphism, Subtyping, and Type Inference in MLsub." *POPL 2017*. Shows how to achieve principal type inference with subtyping by restructuring the type algebra.

### Exercises for Self-Study

1. Prove Lemma 2.10 (canonical forms for products) in full detail.

2. Extend the progress proof to handle the $\text{pred}$ and $\text{iszero}$ operations for natural numbers with subtyping.

3. Write out the full coercion translation for the term $(\lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; f\; \{x = 1, y = 2\})$ and verify that the resulting target term is well-typed in the STLC without subtyping.

4. Prove the coherence theorem (Theorem 8.1) for the special case where the two derivations differ only in their use of S-Trans (i.e., they factor through different intermediate types).

5. Give an example of a type system where minimal types do not exist (hint: consider a system with subtyping but without explicit type annotations on abstractions).

6. Prove the narrowing lemma for the specific case where the term is a variable: if $\Gamma, x : T \vdash y : U$ and $S <: T$, then $\Gamma, x : S \vdash y : U$.

7. Write out the coercion for $\{x : \text{Nat}, y : \text{Bool}, z : \top\} <: \{x : \top\}$ and show that applying it to the record $\{x = 0, y = \text{true}, z = \text{unit}\}$ produces $\{x = \text{unit}\}$ (the $\text{Nat}$ value $0$ is coerced to $\top$, represented as $\text{unit}$).

8. Consider a modified system where the subsumption rule T-Sub is removed and instead each typing rule directly incorporates subtyping (e.g., T-App checks $T_2 <: T_{11}$ instead of requiring exact equality). Prove that this modified system is equivalent to the original system with T-Sub.

9. Show that the canonical forms lemma for the $\top$ type is trivial: if $v$ is a value and $\vdash v : \top$, then $v$ can be any value. Explain why this does not cause problems for progress.

---

## Appendix A: Detailed Proof of the Substitution Lemma

The substitution lemma (Lemma 2.12) is used in the preservation proof. While its proof is essentially the same as in the STLC, the T-Sub case is new and worth examining carefully. We provide the full proof here.

### A.1 Statement

**Lemma (Substitution).** If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\,t : T$.

### A.2 Proof

By induction on the derivation of $\Gamma, x : S \vdash t : T$.

**Case T-Var:** $t = y$ and $y : T \in (\Gamma, x : S)$.

Sub-case $y = x$: Then $T = S$ and $[x \mapsto s]\,t = s$. We need $\Gamma \vdash s : S$, which is given.

Sub-case $y \neq x$: Then $y : T \in \Gamma$ and $[x \mapsto s]\,t = y$. We need $\Gamma \vdash y : T$, which holds by T-Var.

**Case T-Abs:** $t = \lambda y : T_1.\, t_2$ with $\Gamma, x : S, y : T_1 \vdash t_2 : T_2$ and $T = T_1 \to T_2$.

If $y = x$, then $x$ is shadowed and $[x \mapsto s]\,t = \lambda y : T_1.\, t_2$. We need $\Gamma \vdash \lambda y : T_1.\, t_2 : T_1 \to T_2$. But $\Gamma, y : T_1 \vdash t_2 : T_2$ holds because $x$ is not free in $t_2$ (it is shadowed by $y$). Actually, we need to be careful: $\Gamma, x : S, y : T_1 \vdash t_2 : T_2$ and $y = x$ means $x$ is shadowed. The binding $y : T_1$ in the context overrides $x : S$, so $x$ is effectively not used. Since $y : T_1$ is in $\Gamma, y : T_1$ (dropping $x : S$), we have $\Gamma, y : T_1 \vdash t_2 : T_2$ by a permutation/weakening argument. By T-Abs, $\Gamma \vdash \lambda y : T_1.\, t_2 : T_1 \to T_2$.

If $y \neq x$, then $[x \mapsto s]\,t = \lambda y : T_1.\, [x \mapsto s]\,t_2$. By IH (with context $\Gamma, y : T_1$ extended with $x : S$), $\Gamma, y : T_1 \vdash [x \mapsto s]\,t_2 : T_2$. By T-Abs, $\Gamma \vdash \lambda y : T_1.\, [x \mapsto s]\,t_2 : T_1 \to T_2$. (We assume $y \notin FV(s)$ or use alpha-conversion to ensure this.)

**Case T-App:** $t = t_1\; t_2$ with $\Gamma, x : S \vdash t_1 : T_{11} \to T_{12}$ and $\Gamma, x : S \vdash t_2 : T_{11}$ and $T = T_{12}$.

By IH, $\Gamma \vdash [x \mapsto s]\,t_1 : T_{11} \to T_{12}$ and $\Gamma \vdash [x \mapsto s]\,t_2 : T_{11}$. By T-App, $\Gamma \vdash ([x \mapsto s]\,t_1)\;([x \mapsto s]\,t_2) : T_{12}$. Since $[x \mapsto s]\,(t_1\; t_2) = ([x \mapsto s]\,t_1)\;([x \mapsto s]\,t_2)$, the result follows.

**Case T-Sub (new case):** $\Gamma, x : S \vdash t : T$ from $\Gamma, x : S \vdash t : U$ and $U <: T$.

By IH on $\Gamma, x : S \vdash t : U$, we get $\Gamma \vdash [x \mapsto s]\,t : U$. By T-Sub with $U <: T$, $\Gamma \vdash [x \mapsto s]\,t : T$.

**Case T-Rcd:** $t = \{l_i = t_i\}_{i \in 1..n}$ with $\Gamma, x : S \vdash t_i : T_i$ for each $i$, and $T = \{l_i : T_i\}_{i \in 1..n}$.

By IH, $\Gamma \vdash [x \mapsto s]\,t_i : T_i$ for each $i$. Since $[x \mapsto s]\,\{l_i = t_i\} = \{l_i = [x \mapsto s]\,t_i\}$, by T-Rcd, $\Gamma \vdash \{l_i = [x \mapsto s]\,t_i\}_{i \in 1..n} : \{l_i : T_i\}_{i \in 1..n}$.

**Case T-Proj:** $t = t_0.l_j$ with $\Gamma, x : S \vdash t_0 : \{l_i : T_i\}_{i \in 1..n}$ and $T = T_j$.

By IH, $\Gamma \vdash [x \mapsto s]\,t_0 : \{l_i : T_i\}_{i \in 1..n}$. By T-Proj, $\Gamma \vdash ([x \mapsto s]\,t_0).l_j : T_j$.

The remaining cases (T-True, T-False, T-If, T-Zero, T-Succ, T-Pred, T-IsZero, T-Pair, T-Fst, T-Snd, T-Inl, T-Inr, T-Case) follow the same pattern as in the STLC, using the IH on subterms. $\square$

### A.3 Key Observations

1. The T-Sub case is trivially handled: we apply the IH and then re-apply T-Sub. No interaction between substitution and subtyping is needed.

2. The proof does not depend on any properties of the subtype relation beyond what T-Sub gives us. This means the substitution lemma holds for any extension of the subtype relation, as long as the typing rules maintain the same structure.

3. The proof assumes capture-avoiding substitution (or alpha-equivalence), as in the STLC. The details of alpha-conversion are unchanged by subtyping.

---

## Appendix B: The Full Inversion Lemma

We collect all cases of the inversion lemma into a single comprehensive statement for reference.

### B.1 Statement

**Lemma (Inversion of the Typing Relation).** Let $\Gamma \vdash t : T$. Then:

1. If $t = x$, then there exists $S$ with $x : S \in \Gamma$ and $S <: T$.

2. If $t = \lambda x : S_1.\, t_2$, then there exists $S_2$ with $\Gamma, x : S_1 \vdash t_2 : S_2$ and $S_1 \to S_2 <: T$.

3. If $t = t_1\; t_2$, then there exist $T_{11}, T_{12}$ with $\Gamma \vdash t_1 : T_{11} \to T_{12}$, $\Gamma \vdash t_2 : T_{11}$, and $T_{12} <: T$.

4. If $t = \text{true}$, then $\text{Bool} <: T$.

5. If $t = \text{false}$, then $\text{Bool} <: T$.

6. If $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$, then there exists $U$ with $\Gamma \vdash t_1 : \text{Bool}$, $\Gamma \vdash t_2 : U$, $\Gamma \vdash t_3 : U$, and $U <: T$.

7. If $t = 0$, then $\text{Nat} <: T$.

8. If $t = \text{succ}\; t_1$, then $\Gamma \vdash t_1 : \text{Nat}$ and $\text{Nat} <: T$.

9. If $t = \{l_i = t_i\}_{i \in 1..n}$, then there exist $S_i$ with $\Gamma \vdash t_i : S_i$ for each $i$ and $\{l_i : S_i\}_{i \in 1..n} <: T$.

10. If $t = t_0.l_j$, then there exist $T_i$ and $n \geq j$ with $\Gamma \vdash t_0 : \{l_i : T_i\}_{i \in 1..n}$ and $T_j <: T$.

11. If $t = \{t_1, t_2\}$, then there exist $S_1, S_2$ with $\Gamma \vdash t_1 : S_1$, $\Gamma \vdash t_2 : S_2$, and $S_1 \times S_2 <: T$.

12. If $t = t_0.1$, then there exist $T_1, T_2$ with $\Gamma \vdash t_0 : T_1 \times T_2$ and $T_1 <: T$.

13. If $t = t_0.2$, then there exist $T_1, T_2$ with $\Gamma \vdash t_0 : T_1 \times T_2$ and $T_2 <: T$.

14. If $t = \text{inl}\; t_0$, then there exist $S_1, S_2$ with $\Gamma \vdash t_0 : S_1$ and $S_1 + S_2 <: T$.

15. If $t = \text{inr}\; t_0$, then there exist $S_1, S_2$ with $\Gamma \vdash t_0 : S_2$ and $S_1 + S_2 <: T$.

### B.2 Proof Method

Each case is proved by induction on the derivation $\Gamma \vdash t : T$, with the T-Sub case always handled by appealing to the IH and composing with S-Trans. The structure is uniform across all cases.

---

## Appendix C: The Preservation Proof in Full

For reference, we provide the complete preservation proof with every case spelled out. The cases for T-True, T-False, T-Zero are vacuous (these terms are values and cannot step). The cases for T-Abs are also vacuous. We focus on the non-trivial cases.

### C.1 Case T-If / E-IfTrue

$t = \text{if}\; \text{true}\; \text{then}\; t_2\; \text{else}\; t_3$, $t' = t_2$.

By inversion (case 6), $\Gamma \vdash \text{true} : \text{Bool}$, $\Gamma \vdash t_2 : U$, $\Gamma \vdash t_3 : U$, and $U <: T$. So $\Gamma \vdash t_2 : U$. By T-Sub with $U <: T$, $\Gamma \vdash t_2 : T$.

### C.2 Case T-If / E-IfFalse

Symmetric to E-IfTrue.

### C.3 Case T-Succ

$t = \text{succ}\; t_1$, $t' = \text{succ}\; t_1'$ where $t_1 \to t_1'$.

By inversion (case 8), $\Gamma \vdash t_1 : \text{Nat}$ and $\text{Nat} <: T$. By IH, $\Gamma \vdash t_1' : \text{Nat}$. By T-Succ, $\Gamma \vdash \text{succ}\; t_1' : \text{Nat}$. By T-Sub with $\text{Nat} <: T$, $\Gamma \vdash \text{succ}\; t_1' : T$.

### C.4 Case T-Pred / E-PredSucc

$t = \text{pred}\;(\text{succ}\; nv)$, $t' = nv$ where $nv$ is a numeric value.

By inversion, $\Gamma \vdash \text{succ}\; nv : \text{Nat}$ and $\text{Nat} <: T$. By a further inversion, $\Gamma \vdash nv : \text{Nat}$. By T-Sub with $\text{Nat} <: T$, $\Gamma \vdash nv : T$.

### C.5 Case T-IsZero / E-IsZeroZero

$t = \text{iszero}\; 0$, $t' = \text{true}$.

By inversion, $\text{Bool} <: T$. By T-True, $\Gamma \vdash \text{true} : \text{Bool}$. By T-Sub, $\Gamma \vdash \text{true} : T$.

### C.6 Case T-Case / E-CaseInl

$t = \text{case}\;(\text{inl}\; v)\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2$, $t' = [x \mapsto v]\,t_1$.

By inversion, $\Gamma \vdash \text{inl}\; v : T_1 + T_2$, $\Gamma, x : T_1 \vdash t_1 : U$, $\Gamma, y : T_2 \vdash t_2 : U$, and $U <: T$.

By inversion on the inl, $\Gamma \vdash v : S_1$ and $S_1 + S_2 <: T_1 + T_2$ for some $S_1, S_2$. By subtype inversion for sums, $S_1 <: T_1$. By T-Sub, $\Gamma \vdash v : T_1$.

By the substitution lemma with $\Gamma, x : T_1 \vdash t_1 : U$ and $\Gamma \vdash v : T_1$, we get $\Gamma \vdash [x \mapsto v]\,t_1 : U$. By T-Sub with $U <: T$, $\Gamma \vdash [x \mapsto v]\,t_1 : T$. $\square$

---

## Appendix D: Strengthening and Weakening

Two additional structural lemmas are useful in the metatheory of subtyping, though we did not need them explicitly in the main proofs.

### D.1 Weakening

**Lemma (Weakening).** If $\Gamma \vdash t : T$ and $x \notin \text{dom}(\Gamma)$, then $\Gamma, x : S \vdash t : T$ for any type $S$.

*Proof.* By induction on the derivation.

**Case T-Var:** $t = y$ with $y : T \in \Gamma$. Since $x \neq y$ (because $x \notin \text{dom}(\Gamma)$ and $y \in \text{dom}(\Gamma)$), $y : T \in (\Gamma, x : S)$. By T-Var, $\Gamma, x : S \vdash y : T$.

**Case T-Abs:** $t = \lambda y : T_1.\, t_2$ with $\Gamma, y : T_1 \vdash t_2 : T_2$. By IH (with $x \notin \text{dom}(\Gamma, y : T_1)$, assuming $x \neq y$; if $x = y$, the conclusion is trivial by alpha-renaming), $\Gamma, x : S, y : T_1 \vdash t_2 : T_2$. By T-Abs, $\Gamma, x : S \vdash \lambda y : T_1.\, t_2 : T_1 \to T_2$.

**Case T-Sub:** By IH and T-Sub (subtyping does not depend on the context).

All other cases are straightforward. $\square$

### D.2 Context Subtyping (Narrowing)

A more subtle property is **narrowing**: if a variable's type in the context is replaced by a subtype, the term remains well-typed.

**Lemma (Narrowing).** If $\Gamma, x : T \vdash t : U$ and $S <: T$, then $\Gamma, x : S \vdash t : U$.

*Proof.* By induction on the derivation of $\Gamma, x : T \vdash t : U$.

**Case T-Var:** $t = y$ with $y : U \in (\Gamma, x : T)$.

Sub-case $y = x$: Then $U = T$. We have $x : S \in (\Gamma, x : S)$, and $S <: T = U$. By T-Var, $\Gamma, x : S \vdash x : S$. By T-Sub with $S <: U$, $\Gamma, x : S \vdash x : U$.

Sub-case $y \neq x$: Then $y : U \in \Gamma$. By T-Var, $\Gamma, x : S \vdash y : U$.

**Case T-Abs:** Standard, using IH.

**Case T-App:** Standard, using IH on both subterms.

**Case T-Sub:** $\Gamma, x : T \vdash t : U$ from $\Gamma, x : T \vdash t : V$ and $V <: U$. By IH, $\Gamma, x : S \vdash t : V$. By T-Sub, $\Gamma, x : S \vdash t : U$.

All other cases follow the same pattern. $\square$

**Remark.** The narrowing lemma is particularly important when we extend the system with bounded quantification ($F_{<:}$, Module 07). In that setting, the context contains type variable bounds ($X <: T$), and narrowing states that replacing a bound by a subtype preserves well-typedness. The proof in $F_{<:}$ is significantly more complex due to the interaction between type variables and subtyping.

---

## Appendix E: Uniqueness of Types and Principal Typing

### E.1 Loss of Unique Types

In the simply typed lambda calculus without subtyping, each well-typed term has a unique type (given the context). With subtyping, this property is lost: a term can have many types. For example, if $v = \lambda x : \top.\; x$, then:

- $\vdash v : \top \to \top$ (directly, by T-Abs)
- $\vdash v : \top$ (by T-Sub with $\top \to \top <: \top$)

More interestingly, if $\text{Nat} <: \text{Int}$:
- $\vdash 0 : \text{Nat}$ (directly)
- $\vdash 0 : \text{Int}$ (by T-Sub)
- $\vdash 0 : \top$ (by T-Sub)

### E.2 Principal Types

Although types are not unique, there is a **most informative** type for each term, called the **principal type** or **minimal type**.

**Definition (Principal Type).** A type $T_0$ is a principal type for $t$ in context $\Gamma$ if:
1. $\Gamma \vdash t : T_0$ (the term has this type), and
2. For all $T$ with $\Gamma \vdash t : T$, we have $T_0 <: T$ (every other type is a supertype).

**Theorem (Existence of Principal Types).** In our system, every well-typed term has a principal type. The algorithmic typing relation computes this principal type.

*Proof sketch.* This follows from the soundness and completeness of algorithmic typing (Lecture 04b). The algorithmic system is syntax-directed and deterministic, so it computes a unique type $T_0$. By soundness, $\Gamma \vdash t : T_0$. By completeness, for any other type $T$ with $\Gamma \vdash t : T$ derivable in the declarative system, the algorithmic system's output $T_0$ satisfies $T_0 <: T$. $\square$

### E.3 Principal Types and Type Inference

The existence of principal types is crucial for type inference with subtyping. If principal types did not exist, a type inference algorithm would need to return a set of types rather than a single type, and the user would need to choose among them.

In more expressive systems (e.g., $F_{<:}$ with bounded quantification), principal types may not exist. This is one source of undecidability in the type inference problem for $F_{<:}$.

### E.4 Connection to Algorithmic Typing

The principal type computed by the algorithmic typing relation is exactly the **minimal type** discussed in Section 5 of the main lecture. The algorithmic system achieves this by:

1. Assigning the most precise type at each introduction form (e.g., $\lambda x : T_1.\, t_2$ gets type $T_1 \to T_2$ where $T_2$ is the minimal type of $t_2$).
2. Using the subtype check at elimination forms (e.g., application checks $T_{\text{arg}} <: T_{\text{domain}}$) rather than joins, which would lose precision.
3. Using joins only where genuinely needed (e.g., conditional expressions, case expressions) to compute the least common supertype of the branches.

---

## Appendix F: Relationship to Semantic Subtyping

### F.1 Syntactic vs. Semantic Approaches

The approach in this lecture is **syntactic**: subtyping is defined by inference rules, and soundness is proved by showing that the rules preserve type safety (progress and preservation). An alternative approach is **semantic subtyping**, where:

$$S <: T \iff \lbrack\!\lbrack S \rbrack\!\rbrack \subseteq \lbrack\!\lbrack T \rbrack\!\rbrack$$

Here $\lbrack\!\lbrack T \rbrack\!\rbrack$ denotes the **semantic interpretation** of $T$ -- the set of values that "behave like" type $T$ (formally, the set of closed values that are observationally equivalent to some well-typed value of type $T$).

### F.2 Advantages of the Semantic Approach

The semantic approach has several advantages:

1. **Completeness by construction**: if $\lbrack\!\lbrack S \rbrack\!\rbrack \subseteq \lbrack\!\lbrack T \rbrack\!\rbrack$, then it is safe to use $S$ where $T$ is expected. No separate soundness proof is needed.

2. **Natural treatment of union and intersection types**: $\lbrack\!\lbrack S \vee T \rbrack\!\rbrack = \lbrack\!\lbrack S \rbrack\!\rbrack \cup \lbrack\!\lbrack T \rbrack\!\rbrack$ and $\lbrack\!\lbrack S \wedge T \rbrack\!\rbrack = \lbrack\!\lbrack S \rbrack\!\rbrack \cap \lbrack\!\lbrack T \rbrack\!\rbrack$. Subtyping for these types follows immediately from set theory.

3. **Negation types**: $\lbrack\!\lbrack \neg T \rbrack\!\rbrack = \lbrack\!\lbrack \top \rbrack\!\rbrack \setminus \lbrack\!\lbrack T \rbrack\!\rbrack$. The semantic approach handles negation naturally, which is difficult in the syntactic approach.

### F.3 The Challenge of Functions

The main difficulty with semantic subtyping is the interpretation of function types. Naively, $\lbrack\!\lbrack S \to T \rbrack\!\rbrack$ should be the set of functions mapping $\lbrack\!\lbrack S \rbrack\!\rbrack$ to $\lbrack\!\lbrack T \rbrack\!\rbrack$, but this is circular when types can appear negated or in contravariant positions.

Frisch, Castagna, and Hosoya (2008) resolved this using a **coinductive** interpretation of types as sets of values. Their system, implemented in the language CDuce, provides decidable subtyping with full boolean connectives (union, intersection, negation) on types.

The syntactic approach we follow in this course is more elementary and sufficient for most purposes, but the semantic approach provides deeper insight into what subtyping "really means."

See Frisch, Castagna, and Hosoya (2008) in the Further Reading section for details.
