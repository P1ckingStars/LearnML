---
title: "Lecture 06b: System F Metatheory"
tags:
  - type-theory
  - system-f
  - lecture
---
# Lecture 06b: System F Metatheory

> **Module 06 --- Polymorphism & System F (Weeks 11--12)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Prove** the type substitution lemma for System F and explain its role in the preservation proof.
2. **State and prove** progress and preservation (type safety) for System F.
3. **Explain** why naive structural induction fails for proving strong normalization of System F.
4. **Define** Girard's reducibility candidates (logical relations) and articulate their key closure properties.
5. **Sketch** the proof of strong normalization for System F using reducibility candidates.
6. **State** Wells' undecidability result for type inference in System F and explain its significance.
7. **Distinguish** predicative from impredicative polymorphism and rank-restricted fragments.
8. **Relate** the metatheoretic properties of System F to practical language design decisions.

---

## 1. Motivation

In Lecture 06a, we introduced System F and stated several key properties without proof. This lecture provides the proofs. The metatheory of System F is significantly more involved than that of the STLC, primarily because the strong normalization proof requires a fundamentally new technique: **logical relations** (also called reducibility candidates). Understanding why the simpler techniques fail, and how logical relations overcome the difficulties, is one of the central lessons of this module.

We organize the material as follows. Section 2 develops the structural lemmas needed for type safety, culminating in the type substitution lemma. Section 3 proves progress and preservation (type safety). Section 4 presents the strong normalization proof via Girard's reducibility candidates --- the technical heart of the lecture. Section 5 addresses the undecidability of type inference. Section 6 discusses the impredicativity/predicativity distinction and its consequences.

---

## 2. Core Theory: Structural Lemmas

### 2.1 Permutation and Weakening

Before proving type safety, we establish the standard structural lemmas, extended to handle type variables. These lemmas are "administrative" but essential for the soundness of the proofs that follow.

**Lemma 2.1 (Permutation).** If $\Gamma \vdash t : T$ and $\Gamma'$ is a permutation of $\Gamma$ (containing the same bindings in a different order), then $\Gamma' \vdash t : T$.

*Proof.* By induction on the typing derivation. Each typing rule inspects the context only via membership queries ($x : T \in \Gamma$ or $X \in \Gamma$), which are invariant under permutation. The inductive cases (T-Abs, T-TAbs) extend the context; since both $\Gamma$ and $\Gamma'$ contain the same bindings, the extended contexts are also permutations of each other. $\square$

**Lemma 2.2 (Weakening).** If $\Gamma \vdash t : T$ and $x \notin \text{dom}(\Gamma)$, then $\Gamma, x : S \vdash t : T$. Similarly, if $X$ does not appear in $\Gamma$, then $\Gamma, X \vdash t : T$.

*Proof.* By induction on the typing derivation $\Gamma \vdash t : T$.

**Case T-Var:** $t = y$ and $y : T \in \Gamma$. Since $x \neq y$ (because $x \notin \text{dom}(\Gamma)$ and $y \in \text{dom}(\Gamma)$), we have $y : T \in (\Gamma, x : S)$, so $\Gamma, x : S \vdash y : T$ by T-Var.

**Case T-Abs:** $t = \lambda y : T_1.\, t_1$ with $\Gamma, y : T_1 \vdash t_1 : T_2$ and $T = T_1 \to T_2$. Since $x \notin \text{dom}(\Gamma)$ and $x \neq y$ (we may assume this by alpha-renaming), we have $x \notin \text{dom}(\Gamma, y : T_1)$. By IH, $\Gamma, y : T_1, x : S \vdash t_1 : T_2$. By permutation, $\Gamma, x : S, y : T_1 \vdash t_1 : T_2$. By T-Abs, $\Gamma, x : S \vdash \lambda y : T_1.\, t_1 : T_1 \to T_2$.

**Case T-App:** $t = t_1\; t_2$. By IH on both subterms, then T-App.

**Case T-TAbs:** $t = \Lambda Y.\, t_1$ with $\Gamma, Y \vdash t_1 : T_1$. By IH (for term-variable weakening), $\Gamma, Y, x : S \vdash t_1 : T_1$ (since $x \notin \text{dom}(\Gamma, Y)$). By permutation and T-TAbs, $\Gamma, x : S \vdash \Lambda Y.\, t_1 : \forall Y.\, T_1$.

**Case T-TApp:** $t = t_1\;[U]$. By IH on $t_1$, then T-TApp.

The proof for type-variable weakening ($\Gamma, X \vdash t : T$) is analogous. $\square$

**Lemma 2.3 (Strengthening for type variables).** If $\Gamma, X \vdash t : T$ and $X \notin \text{FTV}(t) \cup \text{FTV}(T) \cup \text{FTV}(\Gamma)$, then $\Gamma \vdash t : T$.

*Proof.* By induction on the typing derivation. Since $X$ does not appear free in $t$, $T$, or any type in $\Gamma$, the derivation never uses $X$. Specifically:

- In T-Var, the lookup $y : T \in (\Gamma, X)$ succeeds because the binding must be in $\Gamma$ (it is a term-variable binding, and $X$ is a type-variable binding).
- In T-TAbs, if $t = \Lambda Y.\, t_1$, then $Y \neq X$ (since $X \notin \text{FTV}(t)$ implies $X$ is not the bound variable). The premise $\Gamma, X, Y \vdash t_1 : T_1$ can be strengthened by IH (since $X \notin \text{FTV}(t_1) \cup \text{FTV}(T_1)$) to $\Gamma, Y \vdash t_1 : T_1$.
- In T-TApp, the type argument $U$ has $X \notin \text{FTV}(U)$ (since $X \notin \text{FTV}(t)$ and $t = t_1\;[U]$). The substitution $[Y \mapsto U]\,T_1$ does not introduce $X$ because $X \notin \text{FTV}(U) \cup \text{FTV}(T_1)$.

All other cases are straightforward by IH. $\square$

### 2.2 Substitution Commutation

A technical but important property: type substitution and term substitution commute when their variables are distinct.

**Lemma 2.4 (Substitution commutation).** If $X \neq x$, $X \notin \text{FTV}(s)$, and $x \notin \text{FV}(S)$, then:

$$[X \mapsto S]\,([x \mapsto s]\,t) = [x \mapsto [X \mapsto S]\,s]\,([X \mapsto S]\,t)$$

*Proof.* By induction on the structure of $t$. The key observation is that type substitution $[X \mapsto S]$ acts on types and passes through term-level structure, while term substitution $[x \mapsto s]$ acts on term variables and passes through type-level structure. Since $X$ does not appear in $s$ and $x$ does not appear in $S$, the two substitutions do not interfere. $\square$

### 2.3 The Type Substitution Lemma

The type substitution lemma is the analogue of the standard substitution lemma, but at the type level. It is the key lemma for the preservation proof, specifically for the T-TApp/E-TAppTAbs case.

**Lemma 2.5 (Type substitution preserves typing).** If $\Gamma, X \vdash t : T$, then $[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t : [X \mapsto S]\,T$, where $[X \mapsto S]\,\Gamma$ denotes applying $[X \mapsto S]$ to all types in $\Gamma$ and removing the binding for $X$.

*Proof.* By induction on the derivation of $\Gamma, X \vdash t : T$.

**Case T-Var:** $t = x$ and $x : T \in (\Gamma, X)$. Since $x$ is a term variable and $X$ is a type variable, $x : T \in \Gamma$. Then $x : [X \mapsto S]\,T \in [X \mapsto S]\,\Gamma$, so $[X \mapsto S]\,\Gamma \vdash x : [X \mapsto S]\,T$ by T-Var. Note that $[X \mapsto S]\,x = x$ since $x$ is a term variable.

**Case T-Abs:** $t = \lambda x : T_1.\, t_1$ and $T = T_1 \to T_2$ with $\Gamma, X, x : T_1 \vdash t_1 : T_2$.

By IH applied to $\Gamma, X, x : T_1 \vdash t_1 : T_2$ (noting that $[X \mapsto S]$ applied to the context $(\Gamma, x : T_1)$ gives $([X \mapsto S]\,\Gamma, x : [X \mapsto S]\,T_1)$):

$$[X \mapsto S]\,\Gamma, x : [X \mapsto S]\,T_1 \vdash [X \mapsto S]\,t_1 : [X \mapsto S]\,T_2$$

By T-Abs:

$$[X \mapsto S]\,\Gamma \vdash \lambda x : [X \mapsto S]\,T_1.\, [X \mapsto S]\,t_1 : [X \mapsto S]\,T_1 \to [X \mapsto S]\,T_2$$

The left side is $[X \mapsto S]\,(\lambda x : T_1.\, t_1)$ and the right side is $[X \mapsto S]\,(T_1 \to T_2)$, as required.

**Case T-App:** $t = t_1\; t_2$ with $\Gamma, X \vdash t_1 : T_1 \to T_2$ and $\Gamma, X \vdash t_2 : T_1$. By IH on both subderivations:

$$[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t_1 : [X \mapsto S]\,(T_1 \to T_2) = [X \mapsto S]\,T_1 \to [X \mapsto S]\,T_2$$

$$[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t_2 : [X \mapsto S]\,T_1$$

By T-App:

$$[X \mapsto S]\,\Gamma \vdash ([X \mapsto S]\,t_1)\; ([X \mapsto S]\,t_2) : [X \mapsto S]\,T_2$$

Since $[X \mapsto S]\,(t_1\; t_2) = ([X \mapsto S]\,t_1)\; ([X \mapsto S]\,t_2)$ and $T = T_2$, we are done.

**Case T-TAbs:** $t = \Lambda Y.\, t_1$ and $T = \forall Y.\, T_1$ with $\Gamma, X, Y \vdash t_1 : T_1$. By the Barendregt convention, $Y \neq X$ and $Y \notin \text{FTV}(S)$. By IH:

$$[X \mapsto S]\,(\Gamma, Y) \vdash [X \mapsto S]\,t_1 : [X \mapsto S]\,T_1$$

Now $[X \mapsto S]\,(\Gamma, Y) = ([X \mapsto S]\,\Gamma, Y)$ since $Y$ is a type-variable binding unaffected by the substitution (it does not carry a type). So:

$$[X \mapsto S]\,\Gamma, Y \vdash [X \mapsto S]\,t_1 : [X \mapsto S]\,T_1$$

By T-TAbs:

$$[X \mapsto S]\,\Gamma \vdash \Lambda Y.\, [X \mapsto S]\,t_1 : \forall Y.\, [X \mapsto S]\,T_1$$

which is $[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t : [X \mapsto S]\,T$ since $[X \mapsto S]\,(\Lambda Y.\, t_1) = \Lambda Y.\, [X \mapsto S]\,t_1$ (because $Y \neq X$) and $[X \mapsto S]\,(\forall Y.\, T_1) = \forall Y.\, [X \mapsto S]\,T_1$ (because $Y \neq X$ and $Y \notin \text{FTV}(S)$).

**Case T-TApp:** $t = t_1\;[U]$ with $\Gamma, X \vdash t_1 : \forall Y.\, T_1$ and $T = [Y \mapsto U]\,T_1$. By IH:

$$[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t_1 : [X \mapsto S]\,(\forall Y.\, T_1) = \forall Y.\, [X \mapsto S]\,T_1$$

(where $Y \neq X$ and $Y \notin \text{FTV}(S)$ by the Barendregt convention). By T-TApp:

$$[X \mapsto S]\,\Gamma \vdash ([X \mapsto S]\,t_1)\;[[X \mapsto S]\,U] : [Y \mapsto [X \mapsto S]\,U]\,([X \mapsto S]\,T_1)$$

We must show $[Y \mapsto [X \mapsto S]\,U]\,([X \mapsto S]\,T_1) = [X \mapsto S]\,([Y \mapsto U]\,T_1)$. This is the substitution commutation property: since $Y \neq X$ and $Y \notin \text{FTV}(S)$, the substitutions $[X \mapsto S]$ and $[Y \mapsto U]$ commute:

$$[Y \mapsto [X \mapsto S]\,U]\,([X \mapsto S]\,T_1) = [X \mapsto S]\,([Y \mapsto U]\,T_1)$$

This can be verified by induction on $T_1$. The crucial cases are:
- $T_1 = X$: LHS $= [Y \mapsto [X \mapsto S]\,U]\,S = S$ (since $Y \notin \text{FTV}(S)$). RHS $= [X \mapsto S]\,([Y \mapsto U]\,X) = [X \mapsto S]\,X = S$. Equal.
- $T_1 = Y$: LHS $= [Y \mapsto [X \mapsto S]\,U]\,([X \mapsto S]\,Y) = [Y \mapsto [X \mapsto S]\,U]\,Y = [X \mapsto S]\,U$. RHS $= [X \mapsto S]\,([Y \mapsto U]\,Y) = [X \mapsto S]\,U$. Equal.

Therefore $[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t : [X \mapsto S]\,T$. $\square$

### 2.4 Term Substitution Lemma

**Lemma 2.6 (Term substitution preserves typing).** If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\,t : T$.

*Proof.* By induction on the derivation of $\Gamma, x : S \vdash t : T$. We detail every case.

**Case T-Var, $t = x$:** Then $T = S$ (since $x : S \in (\Gamma, x : S)$). We need $\Gamma \vdash [x \mapsto s]\,x : S$, i.e., $\Gamma \vdash s : S$, which holds by hypothesis.

**Case T-Var, $t = y \neq x$:** Then $y : T \in \Gamma$ (the binding is in $\Gamma$, not the $x : S$ part). We need $\Gamma \vdash [x \mapsto s]\,y : T$, i.e., $\Gamma \vdash y : T$, which holds by T-Var.

**Case T-Abs:** $t = \lambda y : T_1.\, t_1$ with $\Gamma, x : S, y : T_1 \vdash t_1 : T_2$ and $T = T_1 \to T_2$. We may assume $y \neq x$ and $y \notin \text{FV}(s)$ (by alpha-renaming). By permutation, $\Gamma, y : T_1, x : S \vdash t_1 : T_2$. By weakening, $\Gamma, y : T_1 \vdash s : S$. By IH, $\Gamma, y : T_1 \vdash [x \mapsto s]\,t_1 : T_2$. By T-Abs, $\Gamma \vdash \lambda y : T_1.\, [x \mapsto s]\,t_1 : T_1 \to T_2$. Since $[x \mapsto s]\,(\lambda y : T_1.\, t_1) = \lambda y : T_1.\, [x \mapsto s]\,t_1$ (because $y \neq x$ and $y \notin \text{FV}(s)$), we are done.

**Case T-App:** $t = t_1\; t_2$ with $\Gamma, x : S \vdash t_1 : T_1 \to T_2$ and $\Gamma, x : S \vdash t_2 : T_1$. By IH, $\Gamma \vdash [x \mapsto s]\,t_1 : T_1 \to T_2$ and $\Gamma \vdash [x \mapsto s]\,t_2 : T_1$. By T-App, $\Gamma \vdash ([x \mapsto s]\,t_1)\; ([x \mapsto s]\,t_2) : T_2$.

**Case T-TAbs:** $t = \Lambda Y.\, t_1$ and $T = \forall Y.\, T_1$ with $\Gamma, x : S, Y \vdash t_1 : T_1$. By the Barendregt convention, $Y \notin \text{FTV}(S) \cup \text{FTV}(s)$. By permutation, $\Gamma, Y, x : S \vdash t_1 : T_1$. By weakening (adding $Y$ to the context for $s$), $\Gamma, Y \vdash s : S$. By IH, $\Gamma, Y \vdash [x \mapsto s]\,t_1 : T_1$. By T-TAbs, $\Gamma \vdash \Lambda Y.\, [x \mapsto s]\,t_1 : \forall Y.\, T_1$. Since $[x \mapsto s]\,(\Lambda Y.\, t_1) = \Lambda Y.\, [x \mapsto s]\,t_1$, we are done.

**Case T-TApp:** $t = t_1\;[U]$ with $\Gamma, x : S \vdash t_1 : \forall Y.\, T_1$ and $T = [Y \mapsto U]\,T_1$. By IH, $\Gamma \vdash [x \mapsto s]\,t_1 : \forall Y.\, T_1$. By T-TApp, $\Gamma \vdash ([x \mapsto s]\,t_1)\;[U] : [Y \mapsto U]\,T_1$. Since $[x \mapsto s]\,(t_1\;[U]) = ([x \mapsto s]\,t_1)\;[U]$ (term substitution does not affect type arguments), we are done. $\square$

---

## 3. Type Safety

### 3.1 Canonical Forms

**Lemma 3.1 (Canonical forms for System F).**

1. If $\vdash v : T_1 \to T_2$ and $v$ is a value, then $v = \lambda x : T_1.\, t$ for some $x, t$.
2. If $\vdash v : \forall X.\, T$ and $v$ is a value, then $v = \Lambda X.\, t$ for some $t$.

*Proof.* Values in System F are either $\lambda x : T.\, t$ (which has type $T_1 \to T_2$ for some $T_1, T_2$) or $\Lambda X.\, t$ (which has type $\forall X.\, T$ for some $T$). The type forms $T_1 \to T_2$ and $\forall X.\, T$ are syntactically distinct --- they have different head constructors. Therefore:

- A value of type $T_1 \to T_2$ cannot be $\Lambda X.\, t$ (which would have type $\forall X.\, T$), so it must be $\lambda x : T_1.\, t$. Moreover, the T-Abs rule requires the parameter type to be exactly $T_1$.
- A value of type $\forall X.\, T$ cannot be $\lambda x : T'.\, t$ (which would have type $T' \to T''$), so it must be $\Lambda X.\, t$.

$\square$

**Remark.** In a system with subtyping (System F$_{<:}$), canonical forms require more care because subsumption can change the type of a value. In pure System F, there is no subsumption, so canonical forms are straightforward.

### 3.2 Progress

**Theorem 3.2 (Progress).** If $\vdash t : T$ (i.e., $t$ is a closed, well-typed term), then either $t$ is a value or there exists $t'$ such that $t \to t'$.

*Proof.* By induction on the derivation of $\vdash t : T$.

**Case T-Var:** $t = x$. This case is impossible, since $x : T \in \emptyset$ is false (the empty context has no bindings).

**Case T-Abs:** $t = \lambda x : T_1.\, t_1$. This is a value by definition.

**Case T-App:** $t = t_1\; t_2$ with $\vdash t_1 : T_1 \to T_2$ and $\vdash t_2 : T_1$.

By IH on $t_1$: either $t_1$ is a value or $t_1 \to t_1'$ for some $t_1'$.

*Sub-case: $t_1 \to t_1'$.* Then $t_1\; t_2 \to t_1'\; t_2$ by E-App1. We are done.

*Sub-case: $t_1$ is a value.* By IH on $t_2$: either $t_2$ is a value or $t_2 \to t_2'$.

  *Sub-sub-case: $t_2 \to t_2'$.* Then $t_1\; t_2 \to t_1\; t_2'$ by E-App2.

  *Sub-sub-case: $t_2$ is a value.* Both $t_1$ and $t_2$ are values. By the canonical forms lemma (part 1), since $\vdash t_1 : T_1 \to T_2$ and $t_1$ is a value, $t_1 = \lambda x : T_1.\, t_{11}$ for some $x, t_{11}$. Then $(\lambda x : T_1.\, t_{11})\; t_2 \to [x \mapsto t_2]\,t_{11}$ by E-AppAbs.

**Case T-TAbs:** $t = \Lambda X.\, t_1$. This is a value by definition.

**Case T-TApp:** $t = t_1\;[S]$ with $\vdash t_1 : \forall X.\, T_1$.

By IH on $t_1$: either $t_1$ is a value or $t_1 \to t_1'$.

*Sub-case: $t_1 \to t_1'$.* Then $t_1\;[S] \to t_1'\;[S]$ by E-TApp.

*Sub-case: $t_1$ is a value.* By the canonical forms lemma (part 2), since $\vdash t_1 : \forall X.\, T_1$ and $t_1$ is a value, $t_1 = \Lambda X.\, t_{11}$. Then $(\Lambda X.\, t_{11})\;[S] \to [X \mapsto S]\,t_{11}$ by E-TAppTAbs.

In every case, either $t$ is a value or $t$ steps. $\square$

### 3.3 Preservation

**Theorem 3.3 (Preservation / Subject reduction).** If $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$, with a case analysis on the evaluation rule used to derive $t \to t'$. We check every combination of typing rule and evaluation rule.

**Case T-App:** $t = t_1\; t_2$ with $\Gamma \vdash t_1 : T_1 \to T_2$ and $\Gamma \vdash t_2 : T_1$ and $T = T_2$.

There are three possible evaluation rules for $t_1\; t_2$:

*Sub-case E-AppAbs:* $t_1 = \lambda x : T_1.\, t_{12}$ (a value) and $t_2 = v_2$ (a value), and $t' = [x \mapsto v_2]\,t_{12}$.

From $\Gamma \vdash \lambda x : T_1.\, t_{12} : T_1 \to T_2$, by inversion of T-Abs, $\Gamma, x : T_1 \vdash t_{12} : T_2$. We also have $\Gamma \vdash v_2 : T_1$. By the term substitution lemma (Lemma 2.6), $\Gamma \vdash [x \mapsto v_2]\,t_{12} : T_2 = T$.

*Sub-case E-App1:* $t_1 \to t_1'$ and $t' = t_1'\; t_2$. By IH on the derivation of $\Gamma \vdash t_1 : T_1 \to T_2$, we get $\Gamma \vdash t_1' : T_1 \to T_2$. By T-App with $\Gamma \vdash t_2 : T_1$, $\Gamma \vdash t_1'\; t_2 : T_2$.

*Sub-case E-App2:* $t_1 = v_1$ (a value) and $t_2 \to t_2'$ and $t' = v_1\; t_2'$. By IH on $\Gamma \vdash t_2 : T_1$, we get $\Gamma \vdash t_2' : T_1$. By T-App, $\Gamma \vdash v_1\; t_2' : T_2$.

**Case T-TAbs:** $t = \Lambda X.\, t_1$. This is a value; no evaluation rule applies. (There is no $t'$ with $\Lambda X.\, t_1 \to t'$, since type abstractions are values.) This case is vacuously true.

**Case T-TApp:** $t = t_1\;[S]$ with $\Gamma \vdash t_1 : \forall X.\, T_1$ and $T = [X \mapsto S]\,T_1$.

There are two possible evaluation rules:

*Sub-case E-TAppTAbs:* $t_1 = \Lambda X.\, t_{11}$ and $t' = [X \mapsto S]\,t_{11}$.

From $\Gamma \vdash \Lambda X.\, t_{11} : \forall X.\, T_1$, by inversion of T-TAbs, $\Gamma, X \vdash t_{11} : T_1$ (with $X$ fresh for $\Gamma$). By the type substitution lemma (Lemma 2.5):

$$[X \mapsto S]\,\Gamma \vdash [X \mapsto S]\,t_{11} : [X \mapsto S]\,T_1$$

Since $X \notin \text{FTV}(\Gamma)$ (it was introduced fresh by T-TAbs), $[X \mapsto S]\,\Gamma = \Gamma$. Therefore $\Gamma \vdash [X \mapsto S]\,t_{11} : [X \mapsto S]\,T_1 = T$.

*Sub-case E-TApp:* $t_1 \to t_1'$ and $t' = t_1'\;[S]$. By IH, $\Gamma \vdash t_1' : \forall X.\, T_1$. By T-TApp, $\Gamma \vdash t_1'\;[S] : [X \mapsto S]\,T_1 = T$.

**Case T-Abs:** $t = \lambda x : T_1.\, t_1$. This is a value; no evaluation rule applies. Vacuously true.

**Case T-Var:** $t = x$. Variables are not values and cannot step (they are stuck). But we only need preservation for well-typed terms, and if $t$ can step, we must show $t'$ is well-typed. Since a bare variable cannot step, this case is vacuously true.

$\square$

### 3.4 Type Safety

**Corollary 3.4 (Type safety).** If $\vdash t : T$ and $t \to^* t'$ with $t'$ in normal form (i.e., $t'$ cannot step further), then $t'$ is a value.

*Proof.* By induction on the length of the reduction sequence $t \to^* t'$.

*Base case:* $t = t'$ (zero steps). Then $t$ is in normal form. By progress, since $\vdash t : T$, either $t$ is a value or $t$ can step. Since $t$ is in normal form, it cannot step. Therefore $t$ is a value.

*Inductive step:* $t \to t'' \to^* t'$. By preservation, $\vdash t'' : T$. By IH (the reduction from $t''$ to $t'$ is shorter), $t'$ is a value.

$\square$

**Corollary 3.5 (No stuck states).** Well-typed closed System F terms never reach a stuck state. They either reduce to a value or reduce forever (the latter is impossible by strong normalization, proved in Section 4).

---

## 4. Strong Normalization

### 4.1 Why Structural Induction Fails

For the STLC, strong normalization can be proved by defining a measure on typing derivations that decreases at each reduction step. For instance, one can define a "type complexity" measure $\mu(T)$ and show that $\mu$ decreases at each beta-reduction step. The key property is that in $(\lambda x : T_1.\, t)\; s \to [x \mapsto s]\,t$, the type of the redex is $T_1 \to T_2$, and the subterms of the result have types that are "substructures" of $T_1$ and $T_2$.

This approach fails for System F because of the following:

**The problem.** Consider a type application reduction:

$$(\Lambda X.\, t)\;[S] \to [X \mapsto S]\,t$$

The type substitution $[X \mapsto S]$ can **increase** the size of types within $t$. For instance, if $S$ is large and $X$ occurs many times in $t$, the result $[X \mapsto S]\,t$ can be much larger than the original term. Moreover, the types of subterms of $[X \mapsto S]\,t$ can be more complex than those of $t$.

**Concrete example.** Let $\text{Id} = \forall X.\, X \to X$ and consider the term:

$$\text{double} = \Lambda X.\, \lambda f : X \to X.\, \lambda x : X.\, f\;(f\;x)$$

$$\text{double} : \forall X.\, (X \to X) \to X \to X$$

Now consider $\text{double}\;[\text{Id}]$:

$$\text{double}\;[\text{Id}] \to [X \mapsto \text{Id}]\,(\lambda f : X \to X.\, \lambda x : X.\, f\;(f\;x))$$

$$= \lambda f : \text{Id} \to \text{Id}.\, \lambda x : \text{Id}.\, f\;(f\;x)$$

The type of $f$ changed from $X \to X$ (size 3) to $\text{Id} \to \text{Id} = (\forall X.\, X \to X) \to (\forall X.\, X \to X)$ (size 11). If we used type size as an induction measure, the measure increased.

**The deeper issue.** Impredicativity is the root cause. In System F, $\forall X.\, T$ ranges over all types, including types that contain $\forall$. When $X$ is instantiated with $\forall Y.\, S$, the resulting type can be more complex than the original. There is no well-founded ordering on System F types that is preserved by type substitution.

This is in contrast to the STLC, where types have no variables and no quantifiers. In the STLC, the types of subterms of a reduct are always substructures of the types of the original term.

### 4.2 The Logical Relations Method

The technique Girard invented to overcome this difficulty is variously called **reducibility candidates** (candidats de reductibilite), **saturated sets**, or, in its modern generalization, **logical relations**.

**The key idea.** Instead of proving "term $t$ normalizes" by induction on $t$ or its type, we:

1. Define, for each type $T$, a set $\lbrack\!\lbrack T \rbrack\!\rbrack$ of "good" terms (terms that normalize and have additional desirable properties).
2. Show that these sets are well-defined and have useful closure properties.
3. Show that every well-typed term belongs to the "good" set of its type.
4. Conclude normalization from the fact that every "good" term normalizes.

The crucial step is (1): the definition must handle the impredicativity of $\forall$ by quantifying not over types but over **sets of terms** with appropriate properties.

### 4.3 Girard's Reducibility Candidates

**Definition 4.1 (Strongly normalizing terms).** Let $\text{SN}$ denote the set of all strongly normalizing terms --- that is, terms for which every reduction sequence is finite. Formally, $t \in \text{SN}$ iff there is no infinite sequence $t = t_0 \to t_1 \to t_2 \to \cdots$.

**Definition 4.2 (Neutral terms).** A term $t$ is **neutral** if it is not a value (not a lambda abstraction and not a type abstraction). Neutral terms include:

- Variables: $x$.
- Applications: $t_1\; t_2$.
- Type applications: $t\;[T]$.

Neutral terms are important because they are the terms whose reduction behavior is determined by their "context" (what they are applied to, or what happens at their head).

**Definition 4.3 (Reducibility candidate).** A set $\mathcal{R}$ of terms is a **reducibility candidate** (RC) if it satisfies three conditions:

**(CR1) Normalization.** Every term in $\mathcal{R}$ is strongly normalizing:

$$t \in \mathcal{R} \implies t \in \text{SN}$$

**(CR2) Closure under head expansion.** If $t$ reduces to $t'$ in one step and $t' \in \mathcal{R}$, then $t \in \mathcal{R}$:

$$t \to t' \text{ and } t' \in \mathcal{R} \implies t \in \mathcal{R}$$

This says we can "work backwards" from a reducible term through one reduction step.

**(CR3) Closure under neutral normal forms.** If $t$ is neutral and every one-step reduct of $t$ is in $\mathcal{R}$, then $t \in \mathcal{R}$:

$$t \text{ is neutral and } (\forall t'.\, t \to t' \implies t' \in \mathcal{R}) \implies t \in \mathcal{R}$$

**Proposition 4.4 (Variables are in every RC).** For every reducibility candidate $\mathcal{R}$ and every variable $x$, $x \in \mathcal{R}$.

*Proof.* A variable $x$ is neutral. It has no one-step reducts (it is in normal form). Therefore, the condition in CR3 is vacuously satisfied: for all $t'$, $x \to t'$ is false, so "$x \to t' \implies t' \in \mathcal{R}$" is vacuously true. By CR3, $x \in \mathcal{R}$. $\square$

**Proposition 4.5.** $\text{SN}$ is a reducibility candidate.

*Proof.*
- CR1: $t \in \text{SN} \implies t \in \text{SN}$. Trivially true.
- CR2: If $t \to t'$ and $t' \in \text{SN}$, then every reduction sequence from $t$ either is length 0 (and $t$ is in normal form, hence in $\text{SN}$) or starts with $t \to t_1$ for some $t_1$. If $t_1 = t'$, then the sequence continues from $t' \in \text{SN}$ and is finite. If $t_1 \neq t'$... but actually, this requires a more careful argument using the well-foundedness of $\text{SN}$ and the fact that $t' \in \text{SN}$. The full proof uses the property that if all one-step reducts of $t$ are in $\text{SN}$, then $t \in \text{SN}$. Since $t' \in \text{SN}$ and $t \to t'$, the reduction from $t$ through $t'$ is finite; but other reduction paths from $t$ might differ. In fact, for general $t$, we need confluence (or a more refined argument). We use CR3 instead.
- CR3: If $t$ is neutral and every $t'$ with $t \to t'$ is in $\text{SN}$, then every reduction sequence from $t$ starts $t \to t'$ for some $t' \in \text{SN}$, so it is finite. Therefore $t \in \text{SN}$.

A cleaner proof of CR2 for $\text{SN}$: suppose $t \to t'$ and $t' \in \text{SN}$. We prove $t \in \text{SN}$ by strong induction on the longest reduction from $t'$. Every reduction from $t$ begins with a step $t \to t_1$. If the first step is the same as $t \to t'$ (i.e., $t_1 = t'$), the remaining reduction is from $t' \in \text{SN}$, hence finite. If $t_1 \neq t'$, then by confluence (which holds for the lambda calculus), both $t'$ and $t_1$ reduce to a common term, and a carful analysis using the induction hypothesis shows $t_1 \in \text{SN}$. Alternatively, for a simpler proof, note that in a deterministic reduction strategy (e.g., leftmost-outermost), there is only one possible $t_1 = t'$. For general reduction, the proof requires the Church-Rosser property. $\square$

### 4.4 The Reducibility Interpretation

**Definition 4.6 (Reducibility interpretation of types).** Given a substitution $\rho$ mapping type variables to reducibility candidates, the **reducibility interpretation** $\lbrack\!\lbrack T \rbrack\!\rbrack_\rho$ of a type $T$ is a set of terms defined by structural induction on $T$:

$$\lbrack\!\lbrack X \rbrack\!\rbrack_\rho = \rho(X)$$

$$\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho = \{ t \mid \forall s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho.\; t\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho \}$$

$$\lbrack\!\lbrack \forall X.\, T \rbrack\!\rbrack_\rho = \{ t \mid \forall \text{RC } \mathcal{R}.\; \forall \text{closed type } S.\; t\;[S] \in \lbrack\!\lbrack T \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]} \}$$

**Explanation of each clause:**

- **Type variable:** The interpretation of $X$ is whatever $\rho$ says --- it is a "parameter" of the construction.

- **Arrow type:** A term $t$ is "reducible at $T_1 \to T_2$" if, whenever $t$ is applied to a term $s$ that is reducible at $T_1$, the result $t\; s$ is reducible at $T_2$. This is a **relational** definition: the function type is interpreted in terms of input-output behavior.

- **Universal type:** A term $t$ is "reducible at $\forall X.\, T$" if, for every choice of a reducibility candidate $\mathcal{R}$ (interpreting $X$) and every closed type $S$, the type application $t\;[S]$ is reducible at $T$ (with $X$ mapped to $\mathcal{R}$). The quantification is over RCs, not over types; this avoids the circularity that plagues structural induction.

**Key point.** The interpretation of $\forall X.\, T$ quantifies over all reducibility candidates, not over all types. This is what makes the definition well-founded: the set of RCs is a fixed external collection, and we use it to interpret the internal quantifier $\forall X$. The closure properties of RCs (CR1--CR3) ensure that the resulting interpretation is itself an RC.

### 4.5 The Interpretation Produces Reducibility Candidates

**Lemma 4.7.** For every type $T$ and every substitution $\rho$ mapping type variables to reducibility candidates, $\lbrack\!\lbrack T \rbrack\!\rbrack_\rho$ is itself a reducibility candidate.

*Proof.* By induction on the structure of $T$.

**Case $T = X$:** $\lbrack\!\lbrack X \rbrack\!\rbrack_\rho = \rho(X)$, which is an RC by assumption.

**Case $T = T_1 \to T_2$:** We must verify CR1, CR2, CR3 for $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$.

*CR1 (normalization):* Suppose $t \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$. We must show $t \in \text{SN}$. By IH, $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$ is an RC. By Proposition 4.4, every variable $x$ is in $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$. Choose such an $x$ (fresh). Then $t\; x \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. By CR1 for $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ (IH), $t\; x \in \text{SN}$. Since $x \in \text{SN}$ (trivially) and $t\; x \in \text{SN}$, we conclude $t \in \text{SN}$. (Justification: if $t$ had an infinite reduction sequence $t = t_0 \to t_1 \to \cdots$, then $t\; x = t_0\; x \to t_1\; x \to \cdots$ would also be infinite, contradicting $t\; x \in \text{SN}$.)

*CR2 (head expansion):* Suppose $t \to t'$ and $t' \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$. For any $s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$, we have $t\; s \to t'\; s$ (by E-App1 or context rule) and $t'\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. By CR2 for $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ (IH), $t\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. Since $s$ was arbitrary, $t \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$.

*CR3 (neutral normal forms):* Suppose $t$ is neutral and every one-step reduct of $t$ is in $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$. For any $s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$ (which is in $\text{SN}$ by CR1 for $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$), we need $t\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

We prove this by strong induction on $(\text{red}(t) + \text{red}(s))$, where $\text{red}(u)$ denotes the length of the longest reduction sequence from $u$ (which is finite since $t \in \text{SN}$ by an argument below, and $s \in \text{SN}$).

First, $t \in \text{SN}$: since $t$ is neutral and all its reducts are in $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho \subseteq \text{SN}$ (by CR1), $t \in \text{SN}$.

The term $t\; s$ is neutral (since $t$ is neutral, $t\; s$ is not a value). Its one-step reducts are:
- $t'\; s$ where $t \to t'$: by hypothesis, $t' \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$, so $t'\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.
- $t\; s'$ where $s \to s'$: by the induction hypothesis (the sum of longest reduction lengths decreases), $t\; s' \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

Since all one-step reducts of $t\; s$ are in $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ and $t\; s$ is neutral, by CR3 for $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$, $t\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

**Case $T = \forall X.\, T_1$:** We verify CR1, CR2, CR3 for $\lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$.

*CR1:* Suppose $t \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$. Choose $\mathcal{R} = \text{SN}$ (which is an RC by Proposition 4.5) and any closed type $S$. Then $t\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \text{SN}]}$. By CR1 for $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \text{SN}]}$ (IH), $t\;[S] \in \text{SN}$. Therefore $t \in \text{SN}$ (if $t$ had an infinite reduction, $t\;[S]$ would too).

*CR2:* Suppose $t \to t'$ and $t' \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$. For any RC $\mathcal{R}$ and closed type $S$, $t\;[S] \to t'\;[S]$ and $t'\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$. By CR2 for $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$ (IH), $t\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$. Since $\mathcal{R}$ and $S$ were arbitrary, $t \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$.

*CR3:* Suppose $t$ is neutral and every one-step reduct of $t$ is in $\lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$. For any RC $\mathcal{R}$ and closed type $S$, $t\;[S]$ is neutral (since $t$ is not a type abstraction). Its one-step reducts are $t'\;[S]$ where $t \to t'$. By hypothesis, $t' \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$, so $t'\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$. By CR3 for $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$ (IH), $t\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$. Since $\mathcal{R}$ and $S$ were arbitrary, $t \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$.

$\square$

### 4.6 The Fundamental Theorem (Adequacy)

**Definition 4.8 (Reducibility substitution).** A **reducibility substitution** for a context $\Gamma$ is a pair $(\sigma, \rho)$ where:

- $\rho$ assigns to each type variable $X$ declared in $\Gamma$ a reducibility candidate $\rho(X)$.
- $\sigma$ assigns to each term variable $x : T$ in $\Gamma$ a closed term $\sigma(x) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$.

We write $\sigma(t)$ for the result of simultaneously substituting $\sigma(x)$ for each free term variable $x$ in $t$, and applying the type substitution induced by $\rho$ (mapping each type variable $X$ to some closed type; the exact choice does not matter for the normalization argument, as long as it is consistent).

**Theorem 4.9 (Fundamental theorem / Adequacy).** If $\Gamma \vdash t : T$, then for every reducibility substitution $(\sigma, \rho)$ for $\Gamma$:

$$\sigma(t) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$$

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$.

**Case T-Var:** $t = x$ with $x : T \in \Gamma$. By definition of reducibility substitution, $\sigma(x) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$. Since $\sigma(t) = \sigma(x)$, we are done.

**Case T-Abs:** $t = \lambda x : T_1.\, t_1$ with $\Gamma, x : T_1 \vdash t_1 : T_2$ and $T = T_1 \to T_2$.

We must show $\sigma(\lambda x : T_1.\, t_1) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$. By definition, this means: for all $s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$, $\sigma(\lambda x : T_1.\, t_1)\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

Let $s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$. Define $\sigma' = \sigma[x \mapsto s]$. Then $(\sigma', \rho)$ is a reducibility substitution for $\Gamma, x : T_1$ (since $s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$). By IH, $\sigma'(t_1) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

Now $\sigma(\lambda x : T_1.\, t_1)\; s = (\lambda x : \sigma(T_1).\, \sigma(t_1))\; s \to [x \mapsto s]\,\sigma(t_1) = \sigma'(t_1)$.

Since $\sigma'(t_1) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ and $\lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$ is an RC (Lemma 4.7), by CR2 (head expansion), $(\lambda x : \sigma(T_1).\, \sigma(t_1))\; s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$.

Since $s$ was arbitrary, $\sigma(\lambda x : T_1.\, t_1) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$.

**Case T-App:** $t = t_1\; t_2$ with $\Gamma \vdash t_1 : T_1 \to T_2$ and $\Gamma \vdash t_2 : T_1$, $T = T_2$.

By IH, $\sigma(t_1) \in \lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$ and $\sigma(t_2) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho$. By definition of $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho$, $\sigma(t_1)\; \sigma(t_2) \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho$. Since $\sigma(t_1\; t_2) = \sigma(t_1)\; \sigma(t_2)$, we are done.

**Case T-TAbs:** $t = \Lambda X.\, t_1$ with $\Gamma, X \vdash t_1 : T_1$ and $T = \forall X.\, T_1$.

We must show: for all RC $\mathcal{R}$ and closed type $S$, $\sigma(\Lambda X.\, t_1)\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$.

Let $\mathcal{R}$ be any RC and $S$ any closed type. Let $\rho' = \rho[X \mapsto \mathcal{R}]$. Then $(\sigma, \rho')$ is a reducibility substitution for $\Gamma, X$ (the additional type variable $X$ is mapped to $\mathcal{R}$). By IH:

$$\sigma(t_1) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho'} \quad (*)$$

(Here we are slightly abusing notation: $\sigma$ should also incorporate the type substitution $[X \mapsto S]$. The precise statement involves showing that $[X \mapsto S]\,\sigma(t_1) \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho'}$, which follows from $(*)$ and the fact that the interpretation depends on $\rho'(X) = \mathcal{R}$, not on the syntactic type $S$.)

Now $\sigma(\Lambda X.\, t_1)\;[S] = (\Lambda X.\, \sigma(t_1))\;[S] \to [X \mapsto S]\,\sigma(t_1)$. By CR2, $\sigma(\Lambda X.\, t_1)\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho'}$.

**Case T-TApp:** $t = t_1\;[U]$ with $\Gamma \vdash t_1 : \forall X.\, T_1$ and $T = [X \mapsto U]\,T_1$.

By IH, $\sigma(t_1) \in \lbrack\!\lbrack \forall X.\, T_1 \rbrack\!\rbrack_\rho$. By definition, for any RC $\mathcal{R}$ and closed type $S$, $\sigma(t_1)\;[S] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \mathcal{R}]}$.

Choosing $\mathcal{R} = \lbrack\!\lbrack U \rbrack\!\rbrack_\rho$ (which is an RC by Lemma 4.7) and $S = \sigma(U)$:

$$\sigma(t_1)\;[\sigma(U)] \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack U \rbrack\!\rbrack_\rho]}$$

One can show that $\lbrack\!\lbrack T_1 \rbrack\!\rbrack_{\rho[X \mapsto \lbrack\!\lbrack U \rbrack\!\rbrack_\rho]} = \lbrack\!\lbrack [X \mapsto U]\,T_1 \rbrack\!\rbrack_\rho$ (this is the "semantic substitution" lemma, proved by induction on $T_1$). Therefore:

$$\sigma(t_1\;[U]) = \sigma(t_1)\;[\sigma(U)] \in \lbrack\!\lbrack [X \mapsto U]\,T_1 \rbrack\!\rbrack_\rho = \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$$

$\square$

### 4.7 Strong Normalization

**Theorem 4.10 (Strong normalization for System F).** If $\Gamma \vdash t : T$, then $t$ is strongly normalizing.

*Proof.* We consider two cases.

**Closed terms ($\Gamma = \emptyset$):** Take $\sigma = \text{id}$ (the identity substitution) and $\rho = \emptyset$. The pair $(\sigma, \rho)$ is trivially a reducibility substitution for $\emptyset$. By the fundamental theorem (Theorem 4.9), $t = \sigma(t) \in \lbrack\!\lbrack T \rbrack\!\rbrack_\emptyset$. By CR1, $t \in \text{SN}$.

**Open terms ($\Gamma = x_1 : T_1, \ldots, x_n : T_n, X_1, \ldots, X_m$):** Let $\rho$ map each $X_i$ to $\text{SN}$ (which is an RC by Proposition 4.5). Let $\sigma$ map each $x_j$ to itself (the variable $x_j$). By Proposition 4.4, each variable $x_j \in \lbrack\!\lbrack T_j \rbrack\!\rbrack_\rho$. Therefore $(\sigma, \rho)$ is a reducibility substitution for $\Gamma$. By the fundamental theorem, $\sigma(t) = t \in \lbrack\!\lbrack T \rbrack\!\rbrack_\rho$. By CR1, $t \in \text{SN}$.

$\square$

### 4.8 Consequences of Strong Normalization

**Corollary 4.11 (Unique normal forms).** Every well-typed System F term has a unique normal form.

*Proof.* By strong normalization, every reduction sequence terminates. By confluence (which System F inherits from the untyped lambda calculus; System F reduction is a sub-relation of untyped beta-eta reduction, which is confluent), the normal form is unique. $\square$

**Corollary 4.12 (Decidability of beta-eta equality).** For well-typed System F terms $t$ and $s$ of the same type, it is decidable whether $t =_{\beta\eta} s$.

*Proof.* Reduce both $t$ and $s$ to their unique normal forms (which exist by strong normalization). Check whether the normal forms are alpha-equivalent (which is decidable). $\square$

**Corollary 4.13.** System F is not Turing-complete. There is no well-typed System F term that diverges. The halting problem for well-typed System F terms is trivially decidable (the answer is always "halts").

### 4.9 Expressive Power

Despite not being Turing-complete, System F is remarkably expressive.

**Theorem 4.14 (Girard).** The functions $\mathbb{N} \to \mathbb{N}$ representable in System F (using Church numerals as the representation of natural numbers) are exactly the functions provably total in second-order Peano arithmetic (PA$_2$).

This class includes:

- All primitive recursive functions (addition, multiplication, exponentiation, etc.).
- The Ackermann function $A(m, n)$.
- All functions whose totality can be proved using the comprehension axiom scheme of PA$_2$.
- The normalization function for first-order Peano arithmetic (PA$_1$).

Functions **not** representable in System F include:

- The normalization function for System F itself (by a diagonalization argument: if it were representable, we could encode the self-evaluator, contradicting the halting result).
- Any function whose totality requires axioms beyond PA$_2$ (e.g., functions requiring transfinite induction up to large ordinals).

**Remark.** The expressive power of System F is measured by its **proof-theoretic ordinal**, which is $\Gamma_0$ (the Feferman-Schutte ordinal). This is vastly larger than the ordinal of primitive recursive arithmetic ($\omega^\omega$) or first-order PA ($\epsilon_0$), but smaller than that of full second-order arithmetic or Zermelo-Fraenkel set theory.

### 4.10 Worked Example: Strong Normalization of a Polymorphic Term

Let us trace through the logical relations argument for a concrete term to build intuition for the proof technique.

**Example.** Consider the term:

$$t = (\Lambda X.\, \lambda x : X.\, x)\;[\text{Nat} \to \text{Nat}]\; (\lambda y : \text{Nat}.\, y)$$

This has type $\text{Nat} \to \text{Nat}$ in the empty context. Let us verify that $t \in \lbrack\!\lbrack \text{Nat} \to \text{Nat} \rbrack\!\rbrack_\emptyset$ using the fundamental theorem.

**Step 1.** The outer structure is a double application. We decompose the typing derivation:

$$\vdash \Lambda X.\, \lambda x : X.\, x : \forall X.\, X \to X \quad\text{(by T-TAbs + T-Abs + T-Var)}$$

$$\vdash (\Lambda X.\, \lambda x : X.\, x)\;[\text{Nat} \to \text{Nat}] : (\text{Nat} \to \text{Nat}) \to (\text{Nat} \to \text{Nat}) \quad\text{(by T-TApp)}$$

$$\vdash \lambda y : \text{Nat}.\, y : \text{Nat} \to \text{Nat} \quad\text{(by T-Abs + T-Var)}$$

$$\vdash t : \text{Nat} \to \text{Nat} \quad\text{(by T-App)}$$

**Step 2.** We apply the fundamental theorem. Since the context is empty, we use the trivial reducibility substitution $(\sigma, \rho) = (\text{id}, \emptyset)$.

For the sub-term $\Lambda X.\, \lambda x : X.\, x$: by the T-TAbs case of the fundamental theorem, for any RC $\mathcal{R}$ and closed type $S$:

$$(\Lambda X.\, \lambda x : X.\, x)\;[S] \in \lbrack\!\lbrack X \to X \rbrack\!\rbrack_{[X \mapsto \mathcal{R}]}$$

That is, $\lambda x : S.\, x \in \lbrack\!\lbrack X \to X \rbrack\!\rbrack_{[X \mapsto \mathcal{R}]}$. By definition of the arrow interpretation: for all $s \in \mathcal{R}$, $(\lambda x : S.\, x)\; s \in \mathcal{R}$. Since $(\lambda x : S.\, x)\; s \to s$ and $s \in \mathcal{R}$, this follows from CR2 (head expansion).

**Step 3.** Choose $\mathcal{R} = \lbrack\!\lbrack \text{Nat} \to \text{Nat} \rbrack\!\rbrack_\emptyset$. Then:

$$(\Lambda X.\, \lambda x : X.\, x)\;[\text{Nat} \to \text{Nat}] \in \lbrack\!\lbrack (\text{Nat} \to \text{Nat}) \to (\text{Nat} \to \text{Nat}) \rbrack\!\rbrack_\emptyset$$

**Step 4.** For the sub-term $\lambda y : \text{Nat}.\, y$: by the T-Abs case, for all $s \in \lbrack\!\lbrack \text{Nat} \rbrack\!\rbrack_\emptyset$, $(\lambda y : \text{Nat}.\, y)\; s = s \in \lbrack\!\lbrack \text{Nat} \rbrack\!\rbrack_\emptyset$. Since $\lbrack\!\lbrack \text{Nat} \rbrack\!\rbrack_\emptyset = \text{SN} \cap \{t \mid t : \text{Nat}\}$ (for base types), $\lambda y : \text{Nat}.\, y \in \lbrack\!\lbrack \text{Nat} \to \text{Nat} \rbrack\!\rbrack_\emptyset$.

**Step 5.** By the T-App case:

$$t = (\Lambda X.\, \lambda x : X.\, x)\;[\text{Nat} \to \text{Nat}]\; (\lambda y : \text{Nat}.\, y) \in \lbrack\!\lbrack \text{Nat} \to \text{Nat} \rbrack\!\rbrack_\emptyset$$

By CR1, $t \in \text{SN}$. Indeed, $t$ reduces in two steps to $\lambda y : \text{Nat}.\, y$, a normal form.

### 4.11 Why Reducibility Candidates Are Not Just SN

One might ask: why not define $\lbrack\!\lbrack T \rbrack\!\rbrack_\rho = \text{SN}$ for all $T$? This would trivially satisfy CR1, and the fundamental theorem would reduce to "every well-typed term is strongly normalizing," which is what we want to prove. The problem is that the fundamental theorem would fail at the T-Abs case.

**The failure.** Suppose $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho = \text{SN}$. In the T-Abs case, we need to show $\sigma(\lambda x : T_1.\, t_1) \in \text{SN}$. By the IH, for any $s \in \text{SN}$, $[x \mapsto s]\,\sigma(t_1) \in \text{SN}$. But this does **not** imply $\lambda x : T_1.\, \sigma(t_1) \in \text{SN}$ directly --- we need the fact that the function produces normalizing results **for all normalizing arguments**, and we need to use this functional property to conclude that the abstraction itself normalizes.

The logical relations definition of $\lbrack\!\lbrack T_1 \to T_2 \rbrack\!\rbrack_\rho = \{t \mid \forall s \in \lbrack\!\lbrack T_1 \rbrack\!\rbrack_\rho.\; t\;s \in \lbrack\!\lbrack T_2 \rbrack\!\rbrack_\rho\}$ provides exactly the right structure: the interpretation of an arrow type is **functionally defined** in terms of the interpretations of its components. This allows the inductive argument to go through.

**The lesson.** The interpretation must match the structure of typing rules. Arrow types are introduced by T-Abs (which creates functions) and eliminated by T-App (which applies them). The interpretation of arrow types must reflect this introduction/elimination pattern --- functions must produce "good" outputs from "good" inputs.

### 4.12 Historical Remarks on Logical Relations

The logical relations technique has a rich history:

1. **Tait (1967)** introduced the method for proving strong normalization of the simply typed lambda calculus. His "computability" predicate is the ancestor of reducibility candidates.

2. **Girard (1971--1972)** extended the method to System F in his thesis, introducing the name "candidats de reductibilite." The key innovation was quantifying over sets (candidates) rather than types in the interpretation of $\forall$.

3. **Statman (1982)** used logical relations to prove that the extensional equality of simply typed lambda terms is not recursively axiomatizable.

4. **Mitchell and Meyer (1985)** used logical relations to prove representation independence results for abstract data types.

5. **Plotkin (1993)** and **Pitts (1993, 2000)** developed operational logical relations, working directly with the operational semantics rather than denotational models.

6. **Ahmed (2006)** introduced step-indexed logical relations to handle general recursion, mutable state, and existential types --- features that break the simple set-theoretic formulation.

7. **Dreyer, Neis, and Birkedal (2012)** developed Kripke logical relations for reasoning about stateful programs with abstract types.

The progression from Tait's original technique to modern step-indexed and Kripke logical relations illustrates the versatility and enduring importance of the method.

---

## 5. Undecidability of Type Inference

### 5.1 Type Checking vs. Type Inference

There are two distinct computational problems associated with a type system:

**Type checking:** Given a context $\Gamma$, a fully annotated term $t$, and a type $T$, decide whether $\Gamma \vdash t : T$.

**Type inference (typability):** Given an unannotated term $e$ (a "bare" lambda term without type annotations), decide whether there exist a context $\Gamma$, annotations on $e$ producing a term $t$, and a type $T$ such that $\Gamma \vdash t : T$.

**Type reconstruction:** Given an unannotated term $e$, find the most general type $T$ and annotations.

For the STLC, all three problems are decidable. Type inference is solved by Hindley's algorithm (1969) using Robinson's unification. For System F, the situation is dramatically different.

### 5.2 Decidability of Type Checking

**Theorem 5.1.** Type checking for System F is decidable. That is, there is an algorithm that, given $\Gamma$, a fully annotated System F term $t$, and a type $T$, decides whether $\Gamma \vdash t : T$.

*Proof.* The algorithm proceeds by structural recursion on $t$:

- $t = x$: check whether $x : T \in \Gamma$.
- $t = \lambda x : T_1.\, t_1$ with $T = T_1 \to T_2$: recursively check $\Gamma, x : T_1 \vdash t_1 : T_2$.
- $t = t_1\; t_2$: infer the type of $t_1$ by recursion (the term is fully annotated, so this is possible); verify it has the form $T_1 \to T_2$; recursively check $\Gamma \vdash t_2 : T_1$; verify $T_2 = T$.
- $t = \Lambda X.\, t_1$ with $T = \forall X.\, T_1$: recursively check $\Gamma, X \vdash t_1 : T_1$.
- $t = t_1\;[S]$: infer the type of $t_1$; verify it has the form $\forall X.\, T_1$; compute $[X \mapsto S]\,T_1$; verify it equals $T$.

All steps are computable (type substitution is computable, type equality is decidable). The recursion terminates because $t$ is finite and each step reduces the size of the term. $\square$

### 5.3 Undecidability of Type Inference

**Theorem 5.2 (Wells, 1994/1999).** Type inference (typability) for System F is undecidable. There is no algorithm that, given an unannotated lambda term $e$, decides whether there exist type annotations making $e$ well-typed in System F.

*Proof sketch.* Wells' proof proceeds by reduction from a known undecidable problem. The original proof reduces from semi-unification (a variant of unification known to be undecidable, Kfoury, Tiuryn, Urzyczyn 1993). The reduction encodes a semi-unification instance as a typability question: the term is typable in System F if and only if the semi-unification instance has a solution.

The key technical ingredients are:

1. **Encoding of substitutions as type instantiations.** The impredicativity of System F allows encoding arbitrary substitutions as type instantiations of $\forall$.

2. **Encoding of equations as typing constraints.** Type equality constraints (arising from the need to apply a function to its argument) encode the equations of the semi-unification problem.

3. **Encoding of the semi-unifier existence as typability.** The term is typable if and only if there is a consistent assignment of types to all subexpressions, which corresponds to the existence of a semi-unifier.

The full proof is technically demanding (the paper is 46 pages) and involves a careful encoding of Turing machine computations. $\square$

**Remark.** The result was first announced by Wells in 1994 and published in 1999 in *Annals of Pure and Applied Logic*. Wells also proved the surprising result that type checking and typability are equivalent for System F: if we could decide typability, we could decide type checking, and vice versa. This equivalence is non-trivial because type checking seems easier (more information is given).

### 5.4 Consequences for Language Design

The undecidability of type inference for full System F has profound consequences for the design of practical programming languages:

1. **Restricted polymorphism (ML/OCaml/SML).** The Hindley-Milner type system restricts polymorphism to **rank 1** (prenex): universal quantifiers only at the outermost level of type schemes, and only introduced at `let` bindings. This restriction enables complete type inference via Algorithm W.

2. **Annotation-guided inference (Haskell/Scala).** GHC Haskell supports rank-n polymorphism via the `RankNTypes` extension but requires explicit type annotations wherever rank exceeds 1. The type checker verifies annotations rather than inferring them.

3. **Bidirectional type checking.** Modern systems use bidirectional type checking: in "checking" mode, the expected type is given (like type checking); in "synthesis" mode, the type is inferred (like type inference). Polymorphic abstractions use checking mode (annotations required); applications use synthesis mode (types inferred).

4. **Local type inference (Pierce & Turner, 2000).** Infers types for some annotations using local constraints, without requiring global unification. Used in Scala.

### 5.5 Decidable Fragments: The Rank Hierarchy

**Definition 5.3 (Rank of a type).** The rank of a type measures the depth of $\forall$ to the left of $\to$:

$$\text{rank}(X) = 0$$

$$\text{rank}(\text{Nat}) = \text{rank}(\text{Bool}) = 0$$

$$\text{rank}(T_1 \to T_2) = \max(\text{rank}(T_1) + 1, \text{rank}(T_2)) \quad\text{if } T_1 \text{ is polymorphic}$$

$$\text{rank}(T_1 \to T_2) = \max(\text{rank}(T_1), \text{rank}(T_2)) \quad\text{if } T_1 \text{ is not polymorphic}$$

$$\text{rank}(\forall X.\, T) = \max(1, \text{rank}(T))$$

More precisely:
- **Rank 0:** Monomorphic types (no $\forall$).
- **Rank 1 (prenex):** $\forall X_1 \cdots X_k.\, T$ where $T$ is rank 0.
- **Rank 2:** $\forall$ may appear at the outermost level or to the left of one $\to$. Example: $(\forall X.\, X \to X) \to \text{Nat}$.
- **Rank $k$:** $\forall$ may appear to the left of at most $k - 1$ nested $\to$'s.
- **Rank $\omega$:** Unrestricted (full System F).

**Theorem 5.4 (Decidability hierarchy).**

1. Type inference for rank-1 polymorphism is decidable. (Hindley, 1969; Milner, 1978; Damas & Milner, 1982.)
2. Type inference for rank-2 polymorphism is decidable. (Kfoury & Wells, 1999.)
3. Type inference for rank $k \geq 3$ polymorphism is undecidable. (Wells, 1999.)
4. Type checking (with full annotations) is decidable at all ranks.

This hierarchy precisely delineates the boundary of decidability for polymorphic type inference.

---

## 6. Impredicativity and Predicativity

### 6.1 Impredicative Polymorphism

**Definition 6.1.** A polymorphic type system is **impredicative** if a universally quantified type $\forall X.\, T$ can be instantiated at $X = \forall Y.\, S$ --- that is, the quantified variable ranges over the full universe of types, including types built using $\forall$.

System F is impredicative. This is what allows:
- Self-application: $\lambda x : (\forall X.\, X \to X).\, x\;[\forall X.\, X \to X]\; x$.
- Church encodings: $\text{CNat} = \forall X.\, (X \to X) \to X \to X$ requires instantiating $X$ with $\text{CNat}$ itself to define operations like addition.

The word "impredicative" comes from Russell's analysis of paradoxes: a definition is impredicative if it refers to the totality being defined. Here, the type $\forall X.\, T$ quantifies over all types, including types that contain $\forall$, and hence over types that include $\forall X.\, T$ itself.

### 6.2 Predicative Polymorphism

**Definition 6.2.** A polymorphic type system is **predicative** if a universally quantified type $\forall X.\, T$ can only be instantiated with types that are "simpler" than $\forall X.\, T$ in a well-founded sense. The simplest form: $X$ can only range over monomorphic types (types not containing $\forall$).

More generally, predicative systems use a **stratification** (levels or universes):

- Level 0: monomorphic types.
- Level $n + 1$: types that may contain $\forall$-quantifiers ranging over level $\leq n$.

**Definition 6.3 (Predicative System F).** In predicative System F, the typing rule T-TApp is restricted:

$$\frac{\Gamma \vdash t : \forall X.\, T \quad \text{level}(S) < \text{level}(\forall X.\, T)}{\Gamma \vdash t\;[S] : [X \mapsto S]\,T} \quad\text{(T-TApp-Pred)}$$

This prevents circular instantiation.

**Theorem 6.4.** Type inference for predicative System F is decidable.

**Remark.** ML's let-polymorphism (Hindley-Milner) can be understood as a two-level predicative system:
- Level 0: monomorphic types (the types of expressions).
- Level 1: polymorphic type schemes $\forall X_1 \cdots X_k.\, T$ (the types of let-bound variables).

Polymorphic type schemes cannot appear as function arguments --- only in let-bindings. This prevents impredicative instantiation and ensures decidable inference.

### 6.3 Trade-offs

| Property | Impredicative (System F) | Predicative (ML/rank-1) |
|----------|------------------------|------------------------|
| Type inference | Undecidable | Decidable (Algorithm W) |
| Church encodings | Yes | No |
| Self-application | Typable | Not typable |
| First-class polymorphism | Yes | No |
| Implementation complexity | Higher | Lower |

### 6.4 GHC Haskell's Approach

GHC Haskell takes a pragmatic middle ground:

- The core type system (System FC) is impredicative.
- Surface-level Haskell uses predicative type inference by default.
- The `RankNTypes` extension allows rank-n types with explicit annotations.
- Various experimental extensions (`ImpredicativeTypes`) attempt to support impredicative instantiation, with varying degrees of success and completeness.

---

## 7. Extensions and Variations

### 7.1 System F with Subtyping (System F$_{<:}$)

System F can be combined with subtyping (TAPL Chapter 26). The resulting system, System F$_{<:}$, includes:

- **Bounded quantification:** $\forall X <: T.\, S$ where $X$ ranges over subtypes of $T$.
- **Subsumption:** if $\Gamma \vdash t : S$ and $S <: T$, then $\Gamma \vdash t : T$.

System F$_{<:}$ is the theoretical foundation for Java and C# generics with bounds (e.g., `<T extends Comparable<T>>`). Its metatheory is significantly more complex:

**Theorem 7.1 (Pierce, 1992).** Type checking for full System F$_{<:}$ is undecidable.

The undecidability arises from the interaction of bounded quantification with impredicativity. Decidable fragments (e.g., "kernel" System F$_{<:}$) restrict the subtyping rule for bounded quantification.

### 7.2 System F-omega

System F$_\omega$ extends System F with **type operators** --- functions from types to types, governed by a **kind system**. This adds another level to the abstraction hierarchy:

| Level | System F | System F$_\omega$ |
|-------|----------|-------------------|
| Terms | $\lambda x : T.\, t$, $t_1\; t_2$ | Same |
| Polymorphism | $\Lambda X.\, t$, $t\;[T]$ | Same |
| Type operators | --- | $\lambda X :: K.\, T$, $T_1\; T_2$ |
| Kinds | --- | $*$, $K_1 \Rightarrow K_2$ |

System F$_\omega$ is the subject of Module 07 (the Lambda Cube). It can express type-level computations such as parameterized types (functors), type-level recursion (with appropriate extensions), and higher-kinded polymorphism.

### 7.3 The Lambda Cube

The Lambda Cube (Barendregt, 1991) organizes eight type systems along three axes:

1. **Terms depending on types** (polymorphism): System F, System F$_\omega$.
2. **Types depending on types** (type operators): System F$_\omega$.
3. **Types depending on terms** (dependent types): LF, Martin-Lof type theory.

System F occupies one vertex of the cube. The Calculus of Constructions (CoC) occupies the opposite vertex, combining all three forms of dependency.

The eight systems of the Lambda Cube are:

| System | Terms $\to$ Terms | Terms $\to$ Types | Types $\to$ Terms | Types $\to$ Types |
|--------|:-:|:-:|:-:|:-:|
| $\lambda_\to$ (STLC) | $\checkmark$ | | | |
| $\lambda_2$ (System F) | $\checkmark$ | | $\checkmark$ | |
| $\lambda_{\underline{\omega}}$ | $\checkmark$ | | | $\checkmark$ |
| $\lambda_\omega$ (System F$_\omega$) | $\checkmark$ | | $\checkmark$ | $\checkmark$ |
| $\lambda P$ (LF) | $\checkmark$ | $\checkmark$ | | |
| $\lambda P_2$ | $\checkmark$ | $\checkmark$ | $\checkmark$ | |
| $\lambda P_{\underline{\omega}}$ | $\checkmark$ | $\checkmark$ | | $\checkmark$ |
| $\lambda C$ (CoC) | $\checkmark$ | $\checkmark$ | $\checkmark$ | $\checkmark$ |

Each system includes $\lambda_\to$ (all have term-level functions). The three axes add polymorphism (types $\to$ terms), dependent types (terms $\to$ types), and type operators (types $\to$ types), respectively. All eight systems are strongly normalizing.

### 7.4 System F and Intersection Types

An alternative approach to polymorphism is provided by **intersection types**. The intersection type $T_1 \wedge T_2$ is assigned to a term that simultaneously has type $T_1$ and type $T_2$:

$$\frac{\Gamma \vdash t : T_1 \quad \Gamma \vdash t : T_2}{\Gamma \vdash t : T_1 \wedge T_2} \quad\text{($\wedge$-Intro)}$$

Intersection types provide a form of ad hoc polymorphism: the identity function $\lambda x.\, x$ can have type $(\text{Nat} \to \text{Nat}) \wedge (\text{Bool} \to \text{Bool})$ without the $\forall$ quantifier. However, intersection types have fundamentally different metatheoretic properties:

1. **Decidability.** Type inference for finite-rank intersection types is decidable (Kfoury & Wells, 1999). Full intersection types (unrestricted rank) make typability undecidable in general.

2. **Characterization of normalization.** A lambda term is strongly normalizing if and only if it is typable in the intersection type discipline (Coppo & Dezani-Ciancaglini, 1980). This is a striking difference from System F, where many normalizing terms are not typable.

3. **No type erasure.** Intersection types do not support uniform type erasure in the same way as System F --- the choice of which "branch" of the intersection to use may depend on context.

The relationship between System F and intersection types is:

$$\text{System F typable} \subsetneq \text{Intersection typable} = \text{SN terms}$$

Every System F typable term is strongly normalizing, but not every strongly normalizing term is System F typable. Intersection types capture exactly the strongly normalizing terms.

### 7.5 Girard's System F and Proof Theory

The proof-theoretic significance of System F deserves emphasis. System F corresponds to second-order propositional logic under the Curry-Howard correspondence. This correspondence extends to the metatheory:

| Type theory | Proof theory |
|-------------|-------------|
| Strong normalization | Cut elimination for second-order logic |
| Reducibility candidates | Tait-Girard's reducibility method |
| Church encodings | Impredicative definitions in logic |
| Type safety | Consistency of the logic |

**Cut elimination.** The strong normalization of System F corresponds, under Curry-Howard, to the cut elimination theorem for second-order propositional logic. Each reduction step in System F corresponds to eliminating a "cut" (use of the cut rule) in the corresponding proof. The fact that all reduction sequences terminate means all cuts can be eliminated, yielding a cut-free (normal-form) proof.

**Consistency.** Strong normalization implies that the type $\forall X.\, X$ (corresponding to the proposition "for all $P$, $P$ holds," i.e., falsity) is uninhabited. This yields a proof of the consistency of second-order propositional logic: there is no proof of a contradiction.

**Proof-theoretic ordinal.** The proof-theoretic ordinal of System F (equivalently, of PA$_2$) is the Feferman-Schutte ordinal $\Gamma_0$. This means that transfinite induction up to any ordinal less than $\Gamma_0$ is provable in PA$_2$, but induction up to $\Gamma_0$ itself is not. The corresponding fact for System F is that any function whose termination can be proved using such transfinite induction is representable in System F.

### 7.6 Normalization by Evaluation

An alternative approach to proving normalization for System F is **normalization by evaluation (NbE)**. Rather than defining a set-theoretic interpretation (reducibility candidates), NbE defines:

1. A **semantic domain** $D$ (often a presheaf category or a suitable algebraic structure).
2. An **evaluation function** $\text{eval} : \text{Term} \to D$ mapping terms to semantic values.
3. A **reification function** $\text{reify} : D \to \text{Term}$ mapping semantic values back to terms in normal form.

The composition $\text{reify} \circ \text{eval}$ produces the normal form of any well-typed term, thereby proving normalization constructively.

For System F, NbE is technically involved because the semantic domain must handle impredicative polymorphism. Altenkirch and Kaposi (2016) give a NbE proof for System F using a presheaf model. The advantage of NbE over logical relations is that it is more computational --- it provides an actual normalization algorithm, not just an existence proof.

---

## Summary

The metatheory of System F reveals both the power and the limitations of polymorphism:

1. **Structural lemmas**: permutation, weakening, strengthening, and the type substitution lemma provide the foundation for type safety proofs.
2. **Type safety** (progress + preservation) holds, with the type substitution lemma playing a crucial role in the preservation proof for E-TAppTAbs.
3. **Strong normalization** holds but requires the technique of **reducibility candidates** (logical relations). The proof proceeds by defining a semantic interpretation of types as sets of "good" terms, showing these sets satisfy closure properties (CR1--CR3), and proving the fundamental theorem (every well-typed term is "good").
4. **Naive structural induction fails** for strong normalization because type substitution can increase term/type size. Reducibility candidates overcome this by quantifying over sets of terms rather than over types.
5. **Type checking** (with full annotations) is decidable; **type inference** (without annotations) is undecidable (Wells, 1999).
6. **Impredicativity** is the source of both expressive power (Church encodings, self-application) and algorithmic difficulty (undecidable inference). Restricting to predicative polymorphism (rank-1/ML) recovers decidability.
7. The **rank hierarchy** precisely characterizes the decidability boundary: inference is decidable for rank $\leq 2$ and undecidable for rank $\geq 3$.

The logical relations technique introduced here for strong normalization is one of the most important proof techniques in type theory, reappearing in proofs of parametricity (Lecture 06d), normalization for dependent types (Module 08), and program equivalence.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*, Chapter 23 (Universal Types) and the metatheory sections.
2. **Girard, J.-Y., Lafont, Y., and Taylor, P.** (1989). *Proofs and Types*, Chapters 11--14. The original presentation of reducibility candidates and the normalization proof for System F.
3. **Harper, R.** (2016). *Practical Foundations for Programming Languages*, 2nd ed. Chapter 16 (System F) and Chapter 47 (Parametricity via logical relations).
4. **Wells, J. B.** (1999). Typability and type checking in System F are equivalent and undecidable. *Annals of Pure and Applied Logic*, 98(1--3), 111--156.
5. **Kfoury, A. J. and Wells, J. B.** (1999). Principality and decidable type inference for finite-rank intersection types. In *Proc. POPL 1999*.
6. **Damas, L. and Milner, R.** (1982). Principal type-schemes for functional programs. In *Proc. POPL 1982*. The decidability of type inference for rank-1 polymorphism.
7. **Tait, W. W.** (1967). Intensional interpretations of functionals of finite type I. *Journal of Symbolic Logic*, 32(2), 198--212. The precursor to logical relations.
8. **Gallier, J.** (1990). On Girard's "Candidats de Reductibilite." In *Logic and Computer Science*, ed. P. Odifreddi. A clear exposition of the normalization proof.
9. **Barendregt, H.** (1991). Introduction to generalized type systems. *Journal of Functional Programming*, 1(2), 125--154. The Lambda Cube.
10. **Pierce, B. C.** (1992). Bounded quantification is undecidable. In *Proc. POPL 1992*. Undecidability of type checking for System F$_{<:}$.
