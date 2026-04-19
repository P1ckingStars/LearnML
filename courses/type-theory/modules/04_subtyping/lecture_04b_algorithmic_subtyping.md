---
title: "Lecture 04b: Algorithmic Subtyping"
tags:
  - type-theory
  - subtyping
  - lecture
---
# Lecture 04b: Algorithmic Subtyping

> **Module 04 -- Subtyping (Weeks 7-8)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Identify** why the declarative subtyping and typing rules are not syntax-directed and therefore not directly implementable as a type-checking algorithm.
2. **Formulate** the algorithmic subtyping relation by eliminating S-Refl and S-Trans.
3. **Prove** soundness and completeness of algorithmic subtyping with respect to declarative subtyping.
4. **Construct** the algorithmic typing relation by inlining subsumption into specific typing rules.
5. **Define** joins and meets of types and prove their key properties.
6. **Establish** decidability of the algorithmic subtyping and typing relations.
7. **Analyze** the computational complexity of the subtype-checking algorithm.

---

## 1. Motivation

### 1.1 The Problem with Declarative Rules

The subtyping and typing rules from Lecture 04a are **declarative**: they specify *what* judgments are derivable, but not *how* to derive them. Two rules in particular prevent direct implementation as a recursive algorithm.

**Problem 1: Transitivity (S-Trans).** The rule

$$\frac{S <: U \qquad U <: T}{S <: T} \quad \text{(S-Trans)}$$

requires us to guess an intermediate type $U$. Given $S$ and $T$, there are infinitely many possible choices of $U$, and no syntactic guidance for which to choose. An algorithm cannot enumerate all possibilities.

**Problem 2: Reflexivity (S-Refl).** The rule

$$\frac{}{S <: S} \quad \text{(S-Refl)}$$

is harmless on its own, but in combination with transitivity it means that the last rule applied in any derivation might be S-Refl or S-Trans, with no syntactic clue from $S$ and $T$.

**Problem 3: Subsumption (T-Sub).** The typing rule

$$\frac{\Gamma \vdash t : S \qquad S <: T}{\Gamma \vdash t : T} \quad \text{(T-Sub)}$$

is not syntax-directed: it can be applied to any term, and requires guessing both $S$ (the more precise type) and when to apply the rule. A type-checking algorithm needs to know, for each syntactic form, exactly which rule to apply.

### 1.2 Declarative vs. Algorithmic Systems

We address these problems by defining two separate but equivalent systems:

- **Declarative system** ($S <: T$ and $\Gamma \vdash t : T$): Defines the intended meaning. Human-friendly. Not directly implementable.
- **Algorithmic system** ($S <:_a T$ and $\Gamma \vdash_a t : T$): Syntax-directed. Directly implementable as a recursive function. Must be proven sound and complete with respect to the declarative system.

The relationship is:

$$S <:_a T \iff S <: T$$

$$\Gamma \vdash_a t : T \implies \Gamma \vdash t : T \quad \text{(soundness)}$$

For completeness of algorithmic typing, we need a more nuanced statement involving minimal types, which we develop in Section 5.

---

## 2. Core Theory: Algorithmic Subtyping

### 2.1 The Key Insight

The algorithmic subtyping relation $S <:_a T$ is defined by structural recursion on $S$ and $T$, eliminating S-Refl and S-Trans entirely. The correctness of this elimination depends on showing that reflexivity and transitivity are **admissible**: any derivation that uses them can be transformed into one that does not.

### 2.2 Algorithmic Subtyping Rules

We define $S <:_a T$ by the following rules:

**Top and Bottom:**

$$\frac{}{S <:_a \top} \quad \text{(SA-Top)}$$

$$\frac{}{\bot <:_a T} \quad \text{(SA-Bot)}$$

**Base Types:**

$$\frac{}{\text{Bool} <:_a \text{Bool}} \quad \text{(SA-Bool)}$$

$$\frac{}{\text{Nat} <:_a \text{Nat}} \quad \text{(SA-Nat)}$$

$$\frac{}{\text{Bool} <:_a \text{Nat}} \quad \text{(SA-BoolNat)} \qquad \text{(if included)}$$

**Arrow Types:**

$$\frac{T_1 <:_a S_1 \qquad S_2 <:_a T_2}{S_1 \to S_2 <:_a T_1 \to T_2} \quad \text{(SA-Arrow)}$$

**Product Types:**

$$\frac{S_1 <:_a T_1 \qquad S_2 <:_a T_2}{S_1 \times S_2 <:_a T_1 \times T_2} \quad \text{(SA-Prod)}$$

**Sum Types:**

$$\frac{S_1 <:_a T_1 \qquad S_2 <:_a T_2}{S_1 + S_2 <:_a T_1 + T_2} \quad \text{(SA-Sum)}$$

**Record Types:**

$$\frac{\forall i \in 1..n.\; \exists j \in 1..m.\; k_j = l_i \wedge S_j <:_a T_i}{\{k_j : S_j\}_{j \in 1..m} <:_a \{l_i : T_i\}_{i \in 1..n}} \quad \text{(SA-Rcd)}$$

### 2.3 Syntax-Directedness

These rules are syntax-directed: the conclusion uniquely determines which rule to apply based on the outermost type constructors of $S$ and $T$. Given types $S$ and $T$:

1. If $T = \top$: apply SA-Top.
2. If $S = \bot$: apply SA-Bot.
3. If $S = S_1 \to S_2$ and $T = T_1 \to T_2$: apply SA-Arrow.
4. If $S = S_1 \times S_2$ and $T = T_1 \times T_2$: apply SA-Prod.
5. If $S = S_1 + S_2$ and $T = T_1 + T_2$: apply SA-Sum.
6. If $S = \{k_j : S_j\}$ and $T = \{l_i : T_i\}$: apply SA-Rcd.
7. If $S$ and $T$ are both base types: apply the appropriate base type rule.
8. Otherwise: $S \not<:_a T$ (no rule applies).

There is no need to guess intermediate types or decide when to apply reflexivity.

### 2.4 The Algorithm as a Function

The algorithmic rules translate directly into a recursive function:

```
subtype(S, T) =
  match (S, T) with
  | (_, Top)         -> true
  | (Bot, _)         -> true
  | (Bool, Bool)     -> true
  | (Nat, Nat)       -> true
  | (Bool, Nat)      -> true    (* if S-BoolNat is included *)
  | (S1 -> S2, T1 -> T2) -> subtype(T1, S1) && subtype(S2, T2)
  | (S1 * S2, T1 * T2)   -> subtype(S1, T1) && subtype(S2, T2)
  | (S1 + S2, T1 + T2)   -> subtype(S1, T1) && subtype(S2, T2)
  | ({kj:Sj}, {li:Ti})   -> for all i, exists j with kj=li and subtype(Sj, Ti)
  | _                     -> false
```

This function terminates because the total size of $S$ and $T$ strictly decreases in each recursive call.

### 2.5 Handling Ambiguous Cases

The SA rules are deterministic for most type pairs, but some pairs could potentially match multiple rules. We must verify that there is no overlap.

**Potential overlap: SA-Top and SA-Bot.** If $S = \bot$ and $T = \top$, both SA-Top (any $S <:_a \top$) and SA-Bot ($\bot <:_a$ any $T$) apply. Both give the answer `true`, so there is no conflict.

**Potential overlap: SA-Top and SA-Arrow.** If $T = \top$, SA-Top applies regardless of $S$. If $S$ is also an arrow, SA-Arrow would require checking the components. But SA-Top short-circuits to `true`, so we should check SA-Top first. This is a matter of rule ordering in the implementation; mathematically, both would give `true` (since $S_1 \to S_2 <:_a \top$ is derivable from SA-Top).

**No overlaps for structural rules.** SA-Arrow, SA-Prod, SA-Sum, SA-Rcd only apply when both $S$ and $T$ have the same outermost constructor (arrow, product, sum, or record respectively). No type has two different outermost constructors, so these rules cannot overlap with each other.

**Conclusion:** The rules are unambiguous. The algorithm is deterministic.

---

## 3. Soundness and Completeness

### 3.1 Soundness of Algorithmic Subtyping

**Theorem 3.1 (Soundness).** If $S <:_a T$, then $S <: T$.

*Proof.* By induction on the derivation of $S <:_a T$.

**Case SA-Top:** $S <:_a \top$. We need $S <: \top$, which holds by S-Top.

**Case SA-Bot:** $\bot <:_a T$. We need $\bot <: T$, which holds by S-Bot.

**Case SA-Bool:** $\text{Bool} <:_a \text{Bool}$. We need $\text{Bool} <: \text{Bool}$, which holds by S-Refl.

**Case SA-Nat:** Analogous to SA-Bool.

**Case SA-BoolNat:** $\text{Bool} <:_a \text{Nat}$. We need $\text{Bool} <: \text{Nat}$, which holds by S-BoolNat.

**Case SA-Arrow:** $S_1 \to S_2 <:_a T_1 \to T_2$ with $T_1 <:_a S_1$ and $S_2 <:_a T_2$. By the induction hypothesis, $T_1 <: S_1$ and $S_2 <: T_2$. By S-Arrow, $S_1 \to S_2 <: T_1 \to T_2$.

**Case SA-Prod:** $S_1 \times S_2 <:_a T_1 \times T_2$ with $S_1 <:_a T_1$ and $S_2 <:_a T_2$. By IH, $S_1 <: T_1$ and $S_2 <: T_2$. By S-Prod, $S_1 \times S_2 <: T_1 \times T_2$.

**Case SA-Sum:** Analogous to SA-Prod.

**Case SA-Rcd:** $\{k_j : S_j\}_{j \in 1..m} <:_a \{l_i : T_i\}_{i \in 1..n}$ with for all $i$, there exists $j$ with $k_j = l_i$ and $S_j <:_a T_i$. By IH, $S_j <: T_i$ for each such pair. By S-Rcd, the conclusion follows. $\square$

### 3.2 Completeness of Algorithmic Subtyping

Completeness is harder. We must show that the algorithmic relation captures everything the declarative relation does, despite not having explicit reflexivity and transitivity rules.

The key lemma is that reflexivity and transitivity are admissible in the algorithmic system.

**Lemma 3.2 (Admissibility of Reflexivity).** For all types $S$, $S <:_a S$.

*Proof.* By structural induction on $S$.

**Case $S = \top$:** $\top <:_a \top$ by SA-Top.

**Case $S = \bot$:** $\bot <:_a \bot$ by SA-Bot.

**Case $S = \text{Bool}$:** $\text{Bool} <:_a \text{Bool}$ by SA-Bool.

**Case $S = \text{Nat}$:** $\text{Nat} <:_a \text{Nat}$ by SA-Nat.

**Case $S = S_1 \to S_2$:** By IH, $S_1 <:_a S_1$ and $S_2 <:_a S_2$. By SA-Arrow, $S_1 \to S_2 <:_a S_1 \to S_2$.

**Case $S = S_1 \times S_2$:** By IH, $S_1 <:_a S_1$ and $S_2 <:_a S_2$. By SA-Prod, $S_1 \times S_2 <:_a S_1 \times S_2$.

**Case $S = S_1 + S_2$:** Analogous to the product case.

**Case $S = \{l_i : T_i\}_{i \in 1..n}$:** By IH, $T_i <:_a T_i$ for each $i$. For each $i$, take $j = i$: we have $l_j = l_i$ and $T_j <:_a T_i$. By SA-Rcd, $\{l_i : T_i\}_{i \in 1..n} <:_a \{l_i : T_i\}_{i \in 1..n}$. $\square$

**Lemma 3.3 (Admissibility of Transitivity).** If $S <:_a U$ and $U <:_a T$, then $S <:_a T$.

*Proof.* By induction on the sum of the sizes of the derivations $S <:_a U$ and $U <:_a T$, with a subsidiary induction on the size of $U$.

We proceed by case analysis on the derivations.

**Case $T = \top$:** Then $S <:_a \top$ by SA-Top, regardless of $S$ and $U$.

**Case $S = \bot$:** Then $\bot <:_a T$ by SA-Bot, regardless of $U$ and $T$.

**Case $S <:_a U$ by SA-Top:** Then $U = \top$. Since $\top <:_a T$, we need $T = \top$ (the only rule with $\top$ on the left whose conclusion would follow is SA-Top with a right-hand $\top$, or no rule applies unless $T = \top$). If $T = \top$, then $S <:_a \top$ by SA-Top. More precisely: $U <:_a T$ with $U = \top$ means the only applicable rule for $\top <:_a T$ is SA-Top (if $T = \top$) or no rule (otherwise, since $\top$ is not $\bot$, not a base type, not an arrow, etc. unless we consider $\top$ as not matching any structural rule). Wait -- we must be careful. The only rule that applies with $U = \top$ on the left is SA-Top when $T = \top$. So if $U = \top$ and $U <:_a T$, we must have $T = \top$. Then $S <:_a T = \top$ by SA-Top.

**Case $U <:_a T$ by SA-Bot:** Then $U = \bot$. Since $S <:_a \bot$, we need $S = \bot$ (the only rule with $\bot$ on the right whose conclusion can follow is SA-Bot where the left is $\bot$, or no other rule concludes with $\bot$ on the right). If $S = \bot$, then $\bot <:_a T$ by SA-Bot.

**Case $S = S_1 \to S_2$, $U = U_1 \to U_2$, $T = T_1 \to T_2$:** The derivation $S <:_a U$ is by SA-Arrow with $U_1 <:_a S_1$ and $S_2 <:_a U_2$. The derivation $U <:_a T$ is by SA-Arrow with $T_1 <:_a U_1$ and $U_2 <:_a T_2$.

By IH (the sizes of the sub-derivations are smaller):
- From $T_1 <:_a U_1$ and $U_1 <:_a S_1$, we get $T_1 <:_a S_1$.
- From $S_2 <:_a U_2$ and $U_2 <:_a T_2$, we get $S_2 <:_a T_2$.

By SA-Arrow, $S_1 \to S_2 <:_a T_1 \to T_2$.

**Case $S = S_1 \times S_2$, $U = U_1 \times U_2$, $T = T_1 \times T_2$:** Analogous, using SA-Prod.

**Case $S = S_1 + S_2$, $U = U_1 + U_2$, $T = T_1 + T_2$:** Analogous, using SA-Sum.

**Case records:** $S = \{k_j : S_j\}$, $U = \{m_p : U_p\}$, $T = \{l_i : T_i\}$. From $S <:_a U$: for each $p$, there exists $j$ with $k_j = m_p$ and $S_j <:_a U_p$. From $U <:_a T$: for each $i$, there exists $p$ with $m_p = l_i$ and $U_p <:_a T_i$.

For each $i$: there exists $p$ with $m_p = l_i$ and $U_p <:_a T_i$. For this $p$, there exists $j$ with $k_j = m_p$ and $S_j <:_a U_p$. So $k_j = l_i$ and by IH, $S_j <:_a T_i$. By SA-Rcd, $S <:_a T$.

**Remaining cases:** If $S$ and $T$ are different type constructors that are not $\top$ or $\bot$, then $U$ must match both (to have both $S <:_a U$ and $U <:_a T$), which is impossible. For example, if $S$ is an arrow and $T$ is a product, $U$ cannot be both. $\square$

**Theorem 3.4 (Completeness).** If $S <: T$, then $S <:_a T$.

*Proof.* By induction on the derivation of $S <: T$.

**Case S-Refl:** $S <: S$. By Lemma 3.2, $S <:_a S$.

**Case S-Trans:** $S <: U$ and $U <: T$, so $S <: T$. By IH, $S <:_a U$ and $U <:_a T$. By Lemma 3.3, $S <:_a T$.

**Case S-Top:** $S <: \top$. By SA-Top, $S <:_a \top$.

**Case S-Bot:** $\bot <: T$. By SA-Bot, $\bot <:_a T$.

**Case S-Arrow:** $S_1 \to S_2 <: T_1 \to T_2$ with $T_1 <: S_1$ and $S_2 <: T_2$. By IH, $T_1 <:_a S_1$ and $S_2 <:_a T_2$. By SA-Arrow, $S_1 \to S_2 <:_a T_1 \to T_2$.

**Case S-Prod, S-Sum, S-Rcd:** Analogous. $\square$

### 3.3 Summary

**Corollary 3.5.** $S <:_a T \iff S <: T$.

The algorithmic and declarative subtyping relations are equivalent. The algorithmic version is implementable; the declarative version is easier to reason about in proofs.

---

## 4. Algorithmic Typing

### 4.1 The Problem with Subsumption

Even with algorithmic subtyping in hand, the typing relation $\Gamma \vdash t : T$ is still not syntax-directed because of T-Sub. We address this by defining an **algorithmic typing** relation $\Gamma \vdash_a t : T$ that eliminates T-Sub.

The strategy is to **inline** subsumption into the specific typing rules where it is needed. The key insight is that subsumption is only needed at certain "junctions" where types must match -- primarily in function application.

### 4.2 Algorithmic Typing Rules

We present the algorithmic typing rules. The key change is in T-App, where we incorporate subsumption.

**Variables:**

$$\frac{x : T \in \Gamma}{\Gamma \vdash_a x : T} \quad \text{(TA-Var)}$$

**Abstraction:**

$$\frac{\Gamma, x : T_1 \vdash_a t_2 : T_2}{\Gamma \vdash_a \lambda x : T_1.\, t_2 : T_1 \to T_2} \quad \text{(TA-Abs)}$$

**Application (with integrated subsumption):**

$$\frac{\Gamma \vdash_a t_1 : T_1 \qquad T_1 <:_a T_{11} \to T_{12} \qquad \Gamma \vdash_a t_2 : T_2 \qquad T_2 <:_a T_{11}}{\Gamma \vdash_a t_1\; t_2 : T_{12}} \quad \text{(TA-App)}$$

Wait -- this is not quite right either, because $T_1$ might not be syntactically an arrow type but could be a subtype of one. A cleaner formulation separates the problem.

**Revised Application:** The standard approach in TAPL is to compute the type of $t_1$, check that it is an arrow type (using the algorithmic subtyping to resolve this), and then check the argument:

$$\frac{\Gamma \vdash_a t_1 : S_1 \to S_2 \qquad \Gamma \vdash_a t_2 : T_2 \qquad T_2 <:_a S_1}{\Gamma \vdash_a t_1\; t_2 : S_2} \quad \text{(TA-App)}$$

In this formulation, the algorithmic type checker infers the type of $t_1$ and checks that it is structurally an arrow type. Then it checks that the argument type $T_2$ is a subtype of the domain $S_1$. The result type is $S_2$.

But this raises a subtle issue: what if $t_1$ has a minimal type that is not an arrow? In our system, the only type that is a supertype of an arrow type is $\top$ (via S-Top). If $t_1$ has type $\top$, we cannot apply it. So the algorithmic type checker must find a type for $t_1$ that is an arrow, or reject.

In practice, since our algorithmic typing computes the **unique minimal type** of each term (see Section 5), and that minimal type will be an arrow type if and only if the term is typeable as a function, this works correctly.

**Records:**

$$\frac{\Gamma \vdash_a t_i : T_i \quad \text{for each } i \in 1..n}{\Gamma \vdash_a \{l_i = t_i\}_{i \in 1..n} : \{l_i : T_i\}_{i \in 1..n}} \quad \text{(TA-Rcd)}$$

**Projection:**

$$\frac{\Gamma \vdash_a t : \{l_i : T_i\}_{i \in 1..n} \qquad j \in 1..n}{\Gamma \vdash_a t.l_j : T_j} \quad \text{(TA-Proj)}$$

Here again, the algorithmic type checker must find a record type for $t$. If $t$'s minimal type is a record type containing label $l_j$, the projection is well-typed.

**Pairs:**

$$\frac{\Gamma \vdash_a t_1 : T_1 \qquad \Gamma \vdash_a t_2 : T_2}{\Gamma \vdash_a \{t_1, t_2\} : T_1 \times T_2} \quad \text{(TA-Pair)}$$

$$\frac{\Gamma \vdash_a t : T_1 \times T_2}{\Gamma \vdash_a t.1 : T_1} \quad \text{(TA-Fst)} \qquad \frac{\Gamma \vdash_a t : T_1 \times T_2}{\Gamma \vdash_a t.2 : T_2} \quad \text{(TA-Snd)}$$

**Conditional:**

$$\frac{\Gamma \vdash_a t_1 : T_1 \qquad T_1 <:_a \text{Bool} \qquad \Gamma \vdash_a t_2 : T_2 \qquad \Gamma \vdash_a t_3 : T_3}{\Gamma \vdash_a \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 : T_2 \sqcup T_3} \quad \text{(TA-If)}$$

The conditional requires a **join** $T_2 \sqcup T_3$ to compute the least common supertype of the two branches. We develop joins in Section 6.

**Sums:**

$$\frac{\Gamma \vdash_a t : T_1}{\Gamma \vdash_a \text{inl}\; t : T_1 + T_2} \quad \text{(TA-Inl)}$$

Note: $\text{inl}$ and $\text{inr}$ require type annotations in an algorithmic system because the "other" type cannot be inferred. We assume the programmer provides an annotation: $\text{inl}_{T_1 + T_2}\; t$.

**Case:**

$$\frac{\Gamma \vdash_a t : T_1 + T_2 \qquad \Gamma, x : T_1 \vdash_a t_1 : S_1 \qquad \Gamma, y : T_2 \vdash_a t_2 : S_2}{\Gamma \vdash_a \text{case}\; t\; \text{of}\; \text{inl}\; x \Rightarrow t_1 \mid \text{inr}\; y \Rightarrow t_2 : S_1 \sqcup S_2} \quad \text{(TA-Case)}$$

Again using a join for the result type.

### 4.3 Where Did Subsumption Go?

Subsumption has been absorbed into two places:

1. **Application (TA-App):** The argument type $T_2$ must be a subtype of the domain $S_1$, rather than exactly equal to it.

2. **Conditionals and case analysis (TA-If, TA-Case):** The result type is the join of the branch types, rather than requiring them to be identical.

These are the only places where two types must "meet" and subsumption is needed to make them compatible.

### 4.4 Soundness of Algorithmic Typing

**Theorem 4.1 (Soundness of Algorithmic Typing).** If $\Gamma \vdash_a t : T$, then $\Gamma \vdash t : T$.

*Proof.* By induction on the derivation of $\Gamma \vdash_a t : T$.

**Case TA-Var:** Immediate from T-Var.

**Case TA-Abs:** $\Gamma \vdash_a \lambda x : T_1.\, t_2 : T_1 \to T_2$ with $\Gamma, x : T_1 \vdash_a t_2 : T_2$. By IH, $\Gamma, x : T_1 \vdash t_2 : T_2$. By T-Abs, $\Gamma \vdash \lambda x : T_1.\, t_2 : T_1 \to T_2$.

**Case TA-App:** $\Gamma \vdash_a t_1\; t_2 : S_2$ with $\Gamma \vdash_a t_1 : S_1 \to S_2$, $\Gamma \vdash_a t_2 : T_2$, and $T_2 <:_a S_1$. By IH, $\Gamma \vdash t_1 : S_1 \to S_2$ and $\Gamma \vdash t_2 : T_2$. By Theorem 3.1 (soundness of algorithmic subtyping), $T_2 <: S_1$. By T-Sub, $\Gamma \vdash t_2 : S_1$. By T-App, $\Gamma \vdash t_1\; t_2 : S_2$.

**Case TA-If:** $\Gamma \vdash_a \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 : T_2 \sqcup T_3$ with $\Gamma \vdash_a t_1 : T_1$, $T_1 <:_a \text{Bool}$, $\Gamma \vdash_a t_2 : T_2$, $\Gamma \vdash_a t_3 : T_3$. By IH, $\Gamma \vdash t_1 : T_1$, $\Gamma \vdash t_2 : T_2$, $\Gamma \vdash t_3 : T_3$. By soundness of algorithmic subtyping, $T_1 <: \text{Bool}$. By T-Sub, $\Gamma \vdash t_1 : \text{Bool}$. Since $T_2 <: T_2 \sqcup T_3$ and $T_3 <: T_2 \sqcup T_3$ (properties of join), by T-Sub: $\Gamma \vdash t_2 : T_2 \sqcup T_3$ and $\Gamma \vdash t_3 : T_2 \sqcup T_3$. By T-If (the declarative rule for conditionals), $\Gamma \vdash \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 : T_2 \sqcup T_3$.

The remaining cases are similar. $\square$

---

## 5. Minimal Typing and Principal Types

### 5.1 Minimal Types

With subtyping, a term may have many types. Among all the types a term can have, is there always a "best" one?

**Definition 5.1.** A type $S$ is a **minimal type** of $t$ under $\Gamma$ if:
1. $\Gamma \vdash t : S$.
2. For all $T$ such that $\Gamma \vdash t : T$, we have $S <: T$.

A minimal type is the most precise type we can assign to $t$ -- every other type for $t$ is a supertype of it.

**Theorem 5.2.** In the STLC with subtyping (and explicit type annotations on lambda abstractions), every well-typed term has a minimal type, and the algorithmic typing relation computes it.

*Proof sketch.* By induction on the structure of $t$.

- **Variable** $x$: the minimal type is $\Gamma(x)$, the type assigned in the context.
- **Abstraction** $\lambda x : T_1.\, t_2$: the minimal type is $T_1 \to S_2$ where $S_2$ is the minimal type of $t_2$ under $\Gamma, x : T_1$.
- **Application** $t_1\; t_2$: if $t_1$ has minimal type $S_1 \to S_2$, then the minimal type of the application is $S_2$ (provided the argument's minimal type is a subtype of $S_1$).
- **Record** $\{l_i = t_i\}$: the minimal type is $\{l_i : S_i\}$ where each $S_i$ is the minimal type of $t_i$.
- **Projection** $t.l$: if $t$ has minimal type $\{..., l : S, ...\}$, then $S$ is the minimal type of $t.l$.
- **Conditional**: the minimal type is the join of the branch minimal types. $\square$

### 5.2 Completeness of Algorithmic Typing

**Theorem 5.3 (Completeness of Algorithmic Typing, restated).** If $\Gamma \vdash t : T$, then $\Gamma \vdash_a t : S$ for some $S <: T$.

That is, the algorithmic system can type any term that the declarative system can, and the type it assigns is at least as precise.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$.

**Case T-Var:** $\Gamma \vdash x : T$ with $x : T \in \Gamma$. Then $\Gamma \vdash_a x : T$ by TA-Var, and $T <: T$ by S-Refl.

**Case T-Abs:** $\Gamma \vdash \lambda x : T_1.\, t_2 : T_1 \to T_2$ with $\Gamma, x : T_1 \vdash t_2 : T_2$. By IH, $\Gamma, x : T_1 \vdash_a t_2 : S_2$ with $S_2 <: T_2$. By TA-Abs, $\Gamma \vdash_a \lambda x : T_1.\, t_2 : T_1 \to S_2$. And $T_1 \to S_2 <: T_1 \to T_2$ by S-Arrow (with S-Refl for the domain).

**Case T-App:** $\Gamma \vdash t_1\; t_2 : T_{12}$ with $\Gamma \vdash t_1 : T_{11} \to T_{12}$ and $\Gamma \vdash t_2 : T_{11}$. By IH, $\Gamma \vdash_a t_1 : S$ for some $S <: T_{11} \to T_{12}$. We need $S$ to be an arrow type. By the structure of algorithmic subtyping (Lemma: if $S <:_a T_1 \to T_2$ and $S$ is not $\bot$, then $S = S_1 \to S_2$ with $T_1 <:_a S_1$ and $S_2 <:_a T_2$), we can decompose $S = S_1 \to S_2$ with $T_{11} <: S_1$ and $S_2 <: T_{12}$.

Also by IH, $\Gamma \vdash_a t_2 : S'$ for some $S' <: T_{11}$. By transitivity, $S' <: T_{11} <: S_1$, so $S' <:_a S_1$. By TA-App, $\Gamma \vdash_a t_1\; t_2 : S_2$, and $S_2 <: T_{12}$.

**Case T-Sub:** $\Gamma \vdash t : T$ with $\Gamma \vdash t : S$ and $S <: T$. By IH on the first premise, $\Gamma \vdash_a t : S'$ with $S' <: S$. By transitivity, $S' <: T$.

The remaining cases follow a similar pattern. $\square$

---

## 6. Joins and Meets

### 6.1 Definition

**Definition 6.1.** The **join** (least upper bound) of types $S$ and $T$, written $S \sqcup T$, is a type $J$ such that:
1. $S <: J$ and $T <: J$.
2. For all $U$ such that $S <: U$ and $T <: U$, we have $J <: U$.

**Definition 6.2.** The **meet** (greatest lower bound) of types $S$ and $T$, written $S \sqcap T$, is a type $M$ such that:
1. $M <: S$ and $M <: T$.
2. For all $U$ such that $U <: S$ and $U <: T$, we have $U <: M$.

### 6.2 Existence of Joins and Meets

Joins and meets do not always exist in arbitrary subtype systems, but they do exist in ours.

**Theorem 6.3.** In our type system (with $\top$, $\bot$, arrows, products, sums, base types, and records), every pair of types has a join and a meet.

The construction is by cases on the structure of the two types.

### 6.3 Computing Joins

We define $S \sqcup T$ recursively:

$$\top \sqcup T = \top$$

$$S \sqcup \top = \top$$

$$\bot \sqcup T = T$$

$$S \sqcup \bot = S$$

$$\text{Bool} \sqcup \text{Bool} = \text{Bool}$$

$$\text{Nat} \sqcup \text{Nat} = \text{Nat}$$

$$\text{Bool} \sqcup \text{Nat} = \text{Nat} \quad \text{(if S-BoolNat)}$$

$$\text{Nat} \sqcup \text{Bool} = \text{Nat} \quad \text{(if S-BoolNat)}$$

$$(S_1 \to S_2) \sqcup (T_1 \to T_2) = (S_1 \sqcap T_1) \to (S_2 \sqcup T_2)$$

Note the meet in the domain! This is because the domain is contravariant. The join of two function types has the meet of their domains (the most general common input) and the join of their codomains (the least specific common output).

$$(S_1 \times S_2) \sqcup (T_1 \times T_2) = (S_1 \sqcup T_1) \times (S_2 \sqcup T_2)$$

$$(S_1 + S_2) \sqcup (T_1 + T_2) = (S_1 \sqcup T_1) + (S_2 \sqcup T_2)$$

For records, the join keeps only common fields (the intersection of the label sets), with each common field's type joined:

$$\{k_j : S_j\}_{j \in 1..m} \sqcup \{l_i : T_i\}_{i \in 1..n} = \{l : S_l \sqcup T_l \mid l \in \text{labels}(S) \cap \text{labels}(T)\}$$

where $S_l$ and $T_l$ are the types associated with label $l$ in $S$ and $T$ respectively.

For types with **incompatible** outermost constructors (e.g., an arrow and a product), the join is $\top$:

$$(S_1 \to S_2) \sqcup (T_1 \times T_2) = \top$$

### 6.4 Computing Meets

Meets are dual to joins:

$$\top \sqcap T = T$$

$$S \sqcap \top = S$$

$$\bot \sqcap T = \bot$$

$$S \sqcap \bot = \bot$$

$$\text{Bool} \sqcap \text{Bool} = \text{Bool}$$

$$\text{Nat} \sqcap \text{Nat} = \text{Nat}$$

$$\text{Bool} \sqcap \text{Nat} = \text{Bool} \quad \text{(if S-BoolNat)}$$

$$\text{Nat} \sqcap \text{Bool} = \text{Bool} \quad \text{(if S-BoolNat)}$$

$$(S_1 \to S_2) \sqcap (T_1 \to T_2) = (S_1 \sqcup T_1) \to (S_2 \sqcap T_2)$$

Note the join in the domain (contravariance again) and the meet in the codomain.

$$(S_1 \times S_2) \sqcap (T_1 \times T_2) = (S_1 \sqcap T_1) \times (S_2 \sqcap T_2)$$

$$(S_1 + S_2) \sqcap (T_1 + T_2) = (S_1 \sqcap T_1) + (S_2 \sqcap T_2)$$

For records, the meet takes the union of the label sets:

$$\{k_j : S_j\}_{j \in 1..m} \sqcap \{l_i : T_i\}_{i \in 1..n} = \{l : S_l \sqcap T_l \mid l \in \text{labels}(S) \cap \text{labels}(T)\} \cup \{l : S_l \mid l \in \text{labels}(S) \setminus \text{labels}(T)\} \cup \{l : T_l \mid l \in \text{labels}(T) \setminus \text{labels}(S)\}$$

For incompatible constructors, the meet is $\bot$:

$$(S_1 \to S_2) \sqcap (T_1 \times T_2) = \bot$$

### 6.5 Correctness of Join and Meet

**Proposition 6.4.** The join operation defined above satisfies:
1. $S <: S \sqcup T$ and $T <: S \sqcup T$.
2. If $S <: U$ and $T <: U$, then $S \sqcup T <: U$.

*Proof.* By structural induction on $S$ and $T$, using the admissibility results for algorithmic subtyping. We verify each case.

For arrows: $(S_1 \to S_2) \sqcup (T_1 \to T_2) = (S_1 \sqcap T_1) \to (S_2 \sqcup T_2)$.

Property 1: $S_1 \to S_2 <: (S_1 \sqcap T_1) \to (S_2 \sqcup T_2)$? By S-Arrow, we need $(S_1 \sqcap T_1) <: S_1$ (the meet is below $S_1$, by the meet property) and $S_2 <: S_2 \sqcup T_2$ (by the join property for the codomain). Both hold by the induction hypothesis. Similarly for $T_1 \to T_2$.

Property 2: If $S_1 \to S_2 <: U$ and $T_1 \to T_2 <: U$, then $U$ must be an arrow type $U_1 \to U_2$ (or $\top$). In the arrow case, $U_1 <: S_1$ and $S_2 <: U_2$, and $U_1 <: T_1$ and $T_2 <: U_2$. So $U_1 <: S_1 \sqcap T_1$ (by the meet property) and $S_2 \sqcup T_2 <: U_2$ (by the join property). By S-Arrow, $(S_1 \sqcap T_1) \to (S_2 \sqcup T_2) <: U_1 \to U_2 = U$. $\square$

An analogous proposition holds for meets.

---

## 7. Decidability

### 7.1 Decidability of Algorithmic Subtyping

**Theorem 7.1.** The algorithmic subtyping relation $S <:_a T$ is decidable.

*Proof.* The algorithmic rules define $S <:_a T$ by structural recursion on $S$ and $T$. In each recursive call, at least one of $S$ or $T$ becomes structurally smaller (a strict subterm). The recursion therefore terminates on all inputs.

More precisely, we define a size measure:

$$|S| = \begin{cases}

1 & \text{if } S \text{ is a base type, } \top, \text{ or } \bot \\
1 + |S_1| + |S_2| & \text{if } S = S_1 \to S_2 \text{ or } S = S_1 \times S_2 \text{ or } S = S_1 + S_2 \\
1 + \sum_{i} |T_i| & \text{if } S = \{l_i : T_i\}_{i \in 1..n}
\end{cases}

$$
The function $\text{subtype}(S, T)$ terminates because each recursive call reduces $|S| + |T|$. $\square$

### 7.2 Complexity of Algorithmic Subtyping

**Proposition 7.2.** The algorithmic subtyping check runs in time $O(|S| \cdot |T|)$ in the worst case.

For arrow types, a single application of SA-Arrow produces two recursive calls, each on strictly smaller types. The total work is bounded by $|S| \cdot |T|$.

For record types, SA-Rcd requires matching each field of the supertype with a field of the subtype, which is at most $O(n \cdot m)$ label comparisons, plus the recursive subtype checks on matching fields.

### 7.3 Decidability of Algorithmic Typing

**Theorem 7.3.** The algorithmic typing relation $\Gamma \vdash_a t : T$ is decidable.

*Proof.* The algorithmic typing rules are syntax-directed: each rule applies based on the outermost syntactic form of $t$. Each rule either:
- Looks up a variable in $\Gamma$ (decidable).
- Recursively type-checks subterms (terminates by structural recursion on $t$).
- Checks a subtyping condition (decidable by Theorem 7.1).
- Computes a join (decidable since it reduces to recursive join computations on structurally smaller types).

The result is a decision procedure: given $\Gamma$ and $t$, we either compute the unique minimal type $T$ such that $\Gamma \vdash_a t : T$, or determine that $t$ is not typeable. $\square$

---

## 8. Examples

### 8.1 Algorithmic Subtyping Derivation

**Example 8.1.** Show $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat} <:_a \{x : \text{Nat}, y : \text{Bool}, z : \top\} \to \top$.

By SA-Arrow, we need:
1. $\{x : \text{Nat}, y : \text{Bool}, z : \top\} <:_a \{x : \text{Nat}, y : \text{Bool}\}$ (contravariance)
2. $\text{Nat} <:_a \top$ (covariance)

For (1), by SA-Rcd: for each field in the supertype $\{x : \text{Nat}, y : \text{Bool}\}$, find a matching field in the subtype. The subtype has $x : \text{Nat}$ (matches, $\text{Nat} <:_a \text{Nat}$ by SA-Nat) and $y : \text{Bool}$ (matches, $\text{Bool} <:_a \text{Bool}$ by SA-Bool). Done.

For (2), $\text{Nat} <:_a \top$ by SA-Top.

The full derivation tree:

$$\frac{\displaystyle\frac{\text{Nat} <:_a \text{Nat} \quad \text{Bool} <:_a \text{Bool}}{\{x:\text{Nat},y:\text{Bool},z:\top\} <:_a \{x:\text{Nat},y:\text{Bool}\}} \; \text{(SA-Rcd)} \qquad \displaystyle\frac{}{\text{Nat} <:_a \top} \; \text{(SA-Top)}}{\{x:\text{Nat},y:\text{Bool}\} \to \text{Nat} <:_a \{x:\text{Nat},y:\text{Bool},z:\top\} \to \top} \; \text{(SA-Arrow)}$$

### 8.2 Algorithmic Typing Example

**Example 8.2.** Type the term $(\lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; f\; \{x = 1, y = 2\})$ under the empty context.

1. $\Gamma_0 = \emptyset$, $t = \lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; f\; \{x = 1, y = 2\}$.

2. By TA-Abs, we need to type the body under $\Gamma_1 = f : \{x : \text{Nat}\} \to \text{Nat}$.

3. The body is $f\; \{x = 1, y = 2\}$. By TA-App:
   - $\Gamma_1 \vdash_a f : \{x : \text{Nat}\} \to \text{Nat}$ (by TA-Var, since $f : \{x : \text{Nat}\} \to \text{Nat} \in \Gamma_1$).
   - $\Gamma_1 \vdash_a \{x = 1, y = 2\} : \{x : \text{Nat}, y : \text{Nat}\}$ (by TA-Rcd).
   - Check: $\{x : \text{Nat}, y : \text{Nat}\} <:_a \{x : \text{Nat}\}$? By SA-Rcd: for the field $x : \text{Nat}$ in the supertype, the subtype has $x : \text{Nat}$, and $\text{Nat} <:_a \text{Nat}$. Yes.
   - Result type: $\text{Nat}$.

4. By TA-Abs: $\emptyset \vdash_a \lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; f\; \{x = 1, y = 2\} : (\{x : \text{Nat}\} \to \text{Nat}) \to \text{Nat}$.

### 8.3 Join Computation

**Example 8.3.** Compute the join of $\text{Nat} \to \{x : \text{Nat}, y : \text{Bool}\}$ and $\text{Bool} \to \{x : \text{Nat}, z : \text{Nat}\}$.

$$(\text{Nat} \to \{x : \text{Nat}, y : \text{Bool}\}) \sqcup (\text{Bool} \to \{x : \text{Nat}, z : \text{Nat}\})$$

$$= (\text{Nat} \sqcap \text{Bool}) \to (\{x : \text{Nat}, y : \text{Bool}\} \sqcup \{x : \text{Nat}, z : \text{Nat}\})$$

The meet of the domains: $\text{Nat} \sqcap \text{Bool} = \text{Bool}$ (since $\text{Bool} <: \text{Nat}$ with S-BoolNat, $\text{Bool}$ is the greatest lower bound).

The join of the codomains (records): common labels are $\{x\}$. The type for $x$: $\text{Nat} \sqcup \text{Nat} = \text{Nat}$.

So the join is: $\text{Bool} \to \{x : \text{Nat}\}$.

**Verification:** Is $\text{Nat} \to \{x : \text{Nat}, y : \text{Bool}\} <: \text{Bool} \to \{x : \text{Nat}\}$? By SA-Arrow: need $\text{Bool} <:_a \text{Nat}$ (contravariance, holds by SA-BoolNat) and $\{x : \text{Nat}, y : \text{Bool}\} <:_a \{x : \text{Nat}\}$ (holds by SA-Rcd). Yes.

Is $\text{Bool} \to \{x : \text{Nat}, z : \text{Nat}\} <: \text{Bool} \to \{x : \text{Nat}\}$? By SA-Arrow: need $\text{Bool} <:_a \text{Bool}$ (holds) and $\{x : \text{Nat}, z : \text{Nat}\} <:_a \{x : \text{Nat}\}$ (holds by SA-Rcd). Yes.

Both original types are subtypes of the join, confirming property 1 of the join.

---

## 9. Comparison with Other Approaches

### 9.1 Bidirectional Type Checking

An alternative to the monolithic algorithmic typing relation is **bidirectional type checking**, which splits the typing judgment into two modes:

- **Synthesis** (inference): $\Gamma \vdash t \Rightarrow T$ -- given $\Gamma$ and $t$, compute $T$.
- **Checking**: $\Gamma \vdash t \Leftarrow T$ -- given $\Gamma$, $t$, and $T$, verify that $t$ has type $T$.

With subtyping, the checking mode becomes:

$$\frac{\Gamma \vdash t \Rightarrow S \qquad S <: T}{\Gamma \vdash t \Leftarrow T} \quad \text{(Check-Sub)}$$

Subsumption is localized to the single rule that switches from synthesis to checking mode. This approach scales well to more complex type systems (see Dunfield and Krishnaswami 2021).

### 9.2 Constraint-Based Approaches

For type inference with subtyping (when type annotations are omitted), one can generate **subtyping constraints** and solve them. Given a term $t$, the algorithm:

1. Assigns fresh type variables $\alpha_i$ to un-annotated positions.
2. Generates constraints of the form $\alpha_i <: \alpha_j$ or $\alpha_i <: T$.
3. Solves the constraint system to find substitutions for the variables.

This approach is the foundation of type inference in languages like OCaml (for its object types). The constraint-solving problem is more complex than unification (Module 05) and can be undecidable in the presence of certain features.

### 9.3 Local Type Inference

Pierce and Turner (2000) introduced **local type inference**, which combines bidirectional checking with limited subtyping propagation. The idea is to propagate type information from the checking context into the term being checked, avoiding the need for explicit type annotations in many cases while keeping inference decidable. This is the basis of type inference in Scala.

### 9.4 Bidirectional Typing with Subtyping (Detailed)

We spell out the bidirectional typing rules for our system with subtyping. This formulation is increasingly popular in modern language implementations.

**Synthesis rules** (infer the type of a term):

$$\frac{x : T \in \Gamma}{\Gamma \vdash x \Rightarrow T} \quad \text{(Syn-Var)}$$

$$\frac{\Gamma, x : T_1 \vdash t_2 \Rightarrow T_2}{\Gamma \vdash \lambda x : T_1.\, t_2 \Rightarrow T_1 \to T_2} \quad \text{(Syn-Abs)}$$

$$\frac{\Gamma \vdash t_1 \Rightarrow S_1 \to S_2 \qquad \Gamma \vdash t_2 \Leftarrow S_1}{\Gamma \vdash t_1\; t_2 \Rightarrow S_2} \quad \text{(Syn-App)}$$

$$\frac{\Gamma \vdash t_i \Rightarrow T_i \quad \text{for each } i}{\Gamma \vdash \{l_i = t_i\} \Rightarrow \{l_i : T_i\}} \quad \text{(Syn-Rcd)}$$

$$\frac{\Gamma \vdash t \Rightarrow \{l_i : T_i\}_{i \in 1..n} \qquad j \in 1..n}{\Gamma \vdash t.l_j \Rightarrow T_j} \quad \text{(Syn-Proj)}$$

**Checking rules** (check a term against a given type):

$$\frac{\Gamma \vdash t \Rightarrow S \qquad S <: T}{\Gamma \vdash t \Leftarrow T} \quad \text{(Chk-Sub)}$$

$$\frac{\Gamma, x : T_1 \vdash t \Leftarrow T_2}{\Gamma \vdash \lambda x : T_1.\, t \Leftarrow T_1 \to T_2} \quad \text{(Chk-Abs)}$$

$$\frac{\Gamma \vdash t_1 \Leftarrow \text{Bool} \qquad \Gamma \vdash t_2 \Leftarrow T \qquad \Gamma \vdash t_3 \Leftarrow T}{\Gamma \vdash \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 \Leftarrow T} \quad \text{(Chk-If)}$$

Note how subsumption appears in only one place (Chk-Sub), making the system cleaner than the monolithic algorithmic typing relation. The checking mode allows propagating type information downward into subterms, which can eliminate the need for joins in conditional expressions (the expected type $T$ is propagated to both branches).

**Advantages of bidirectional typing with subtyping:**
- Subsumption is localized to a single rule.
- Type annotations can be omitted in more places.
- The system is modular: new typing rules can be added without modifying the subsumption mechanism.

**Disadvantages:**
- Some terms require mode annotations to indicate whether to synthesize or check.
- The system may require more type annotations on lambda parameters than the monolithic system (which can infer parameter types from application context).

---

## 10. Pitfalls and Subtleties

### 10.1 The Ascending Chain Problem

Consider an infinite ascending chain:

$$\{x : \text{Nat}\} <: \{\ \} <: \top$$

(assuming $\{\ \}$ is the empty record type). This chain is finite, but in the presence of recursive types, infinite ascending or descending chains can arise, making the subtype relation undecidable. Our system avoids this by not including recursive types with subtyping (a notoriously difficult combination).

### 10.2 Loss of Information Through Subsumption

When we apply T-Sub to a term, we permanently lose type information. The algorithmic system mitigates this by computing minimal types and only applying subsumption at the latest possible moment (in function application). But the programmer should be aware that excessive subsumption can make types less informative.

### 10.3 Interaction with Other Features

Subtyping interacts delicately with:
- **Type inference** (Module 05): subtype constraints are harder to solve than equality constraints.
- **Parametric polymorphism** (Module 06): bounded quantification ($F_{<:}$) combines both but has undecidable subtyping.
- **Recursive types** (Module 03): equi-recursive types with subtyping require coinductive definitions.
- **Mutable references** (Module 03): require invariance, which is the conjunction of covariance and contravariance.

---

---

## 11. Relationship Between Declarative and Algorithmic Systems

### 11.1 Why Two Systems?

The existence of both declarative and algorithmic formulations is a recurring pattern in type theory:

| System | Purpose | Properties |
|--------|---------|-----------|
| Declarative | Specifies meaning | Simple rules, easy metatheory proofs |
| Algorithmic | Implements type checking | Syntax-directed, deterministic |

The key results connecting them are:
- **Soundness**: $S <:_a T \implies S <: T$ (algorithmic is a subset of declarative)
- **Completeness**: $S <: T \implies S <:_a T$ (declarative is a subset of algorithmic)

Together, they establish equivalence: the algorithmic system decides exactly the same relation as the declarative system.

### 11.2 The Pattern in Other Settings

This declarative/algorithmic split appears throughout programming languages:

- **STLC**: Declarative typing (with T-Sub) vs. algorithmic typing (inlining subsumption).
- **Hindley-Milner** (Module 05): Declarative type scheme instantiation vs. Algorithm W.
- **System F** (Module 06): Declarative polymorphism vs. bidirectional checking with type annotations.
- **Dependent types** (Module 08): Declarative conversion rule vs. algorithmic normalization and comparison.

In each case, the declarative system is designed for human understanding and metatheory proofs, while the algorithmic system is designed for implementation.

---

## Summary

This lecture developed algorithmic versions of the subtyping and typing relations, addressing the non-syntax-directedness of the declarative rules.

1. **Algorithmic subtyping** eliminates S-Refl and S-Trans, checking subtyping by structural recursion on the types. It is sound and complete with respect to declarative subtyping.

2. **Algorithmic typing** eliminates T-Sub by inlining subsumption into application (checking the argument type against the domain) and conditional/case rules (using joins).

3. **Joins** compute the least common supertype. For arrows, the join uses the meet of domains (contravariance) and the join of codomains (covariance). For records, the join intersects the label sets.

4. **Meets** compute the greatest common subtype, dually.

5. **Decidability** follows from the structural recursion in the algorithmic rules.

6. **Minimal typing** ensures that the algorithmic system computes the most precise type for each term, from which all other types are obtainable via subsumption.

---

## Further Reading

### Primary Sources

- **Pierce, B. C. (2002)**. *Types and Programming Languages*, Chapter 16. The definitive treatment of algorithmic subtyping. Sections 16.1-16.3 cover the material of this lecture.

- **Pierce, B. C. and Turner, D. N. (2000)**. "Local Type Inference." *ACM Transactions on Programming Languages and Systems*, 22(1), 1-44. Introduces bidirectional checking with subtyping.

### Supplementary

- **Dunfield, J. and Krishnaswami, N. R. (2021)**. "Bidirectional Typing." *ACM Computing Surveys*, 54(5), Article 98. A comprehensive survey of bidirectional type checking, including systems with subtyping.

- **Pottier, F. (1998)**. "Type Inference in the Presence of Subtyping: from Theory to Practice." Research Report 3483, INRIA. Covers constraint-based type inference with subtyping.

- **Amadio, R. M. and Cardelli, L. (1993)**. "Subtyping Recursive Types." *ACM Transactions on Programming Languages and Systems*, 15(4), 575-631. Covers the difficult case of recursive types with subtyping.

### Exercises for Self-Study

1. Show that the algorithmic subtyping check for two arrow types $S_1 \to S_2$ and $T_1 \to T_2$ makes at most $O(\min(|S|, |T|))$ recursive calls, where $|S|$ and $|T|$ are the sizes of the types.

2. Compute the join and meet of $(\text{Nat} \to \text{Nat}) \to \text{Bool}$ and $(\text{Bool} \to \top) \to \text{Nat}$.

3. Prove that $S \sqcup T = T \sqcup S$ (commutativity of join) by induction on $|S| + |T|$.

4. Give an example where the algorithmic typing relation assigns a strictly more precise type than the declarative relation would with a particular derivation. (The declarative relation could assign the same type, but a different derivation is needed.)

5. Extend the algorithmic subtyping rules to handle a base type $\text{Int}$ with $\text{Nat} <: \text{Int}$. Show that the extended system is still sound and complete.

6. Implement the `subtype` function as pseudocode (or OCaml) and trace its execution on the input $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$ and $\{x : \text{Nat}\} \to \top$.

7. Prove that if $S \sqcup T = \top$ and $S$ and $T$ are both arrow types, then $S$ and $T$ must have incompatible domain types (their meet is $\bot$) or incompatible codomain types (their join is $\top$).

8. Explain why the algorithmic typing rule TA-If requires a join for the result type, but TA-App does not. What would go wrong if TA-App used a join?

9. Consider adding a rule SA-BoolNat' that makes $\text{Nat} <:_a \text{Bool}$ (the reverse of SA-BoolNat). Would the resulting system still be sound and complete with respect to a declarative system that includes both $\text{Bool} <: \text{Nat}$ and $\text{Nat} <: \text{Bool}$? What would be the consequences for the type system?

10. Consider a type system with three base types $\text{Int}$, $\text{Nat}$, and $\text{Bool}$ where $\text{Nat} <: \text{Int}$. Compute the following joins and meets:
    - $\text{join}(\text{Nat} \to \text{Bool},\; \text{Int} \to \text{Nat})$
    - $\text{meet}(\text{Nat} \to \text{Bool},\; \text{Int} \to \text{Nat})$
    - $\text{join}(\{x : \text{Nat}, y : \text{Int}\},\; \{x : \text{Int}, z : \text{Bool}\})$
    - $\text{meet}(\{x : \text{Nat}, y : \text{Int}\},\; \{x : \text{Int}, z : \text{Bool}\})$

    Verify your answers by checking that the join is the least upper bound and the meet is the greatest lower bound.

11. Prove that the algorithmic subtyping relation is antisymmetric up to type equality: if $S <:_a T$ and $T <:_a S$, then $S$ and $T$ are structurally identical (assuming our type system has no non-trivial type equalities beyond reflexivity). Hint: proceed by mutual structural induction on $S$ and $T$.

12. The **subtype ordering** on types can be visualized as a Hasse diagram. Draw the Hasse diagram for the set of types $\{\text{Nat}, \text{Bool}, \top, \bot, \text{Nat} \to \text{Nat}, \text{Nat} \to \top, \top \to \text{Nat}, \bot \to \top\}$. Identify the join and meet of each pair where they differ from $\top$ and $\bot$.

---

## Appendix A: Detailed Transitivity Admissibility Proof

The proof of Lemma 3.3 (admissibility of transitivity) is the most intricate part of the metatheory. We provide a more detailed treatment here, filling in cases that were sketched in the main text.

### A.1 The Induction Measure

We prove transitivity admissibility by induction on the **size of the intermediate type** $U$, with a subsidiary induction on the **sum of the derivation sizes** of $S <:_a U$ and $U <:_a T$.

Define the size of a type:

$$|T| = \begin{cases}

1 & \text{if } T \in \{\text{Bool}, \text{Nat}, \top, \bot\} \\
1 + |T_1| + |T_2| & \text{if } T = T_1 \to T_2, T_1 \times T_2, \text{or } T_1 + T_2 \\
1 + \sum_{i=1}^{n} |T_i| & \text{if } T = \{l_i : T_i\}_{i \in 1..n}
\end{cases}

$$
### A.2 The Critical Arrow Case

The most important case is when $S$, $U$, and $T$ are all arrow types:

$S = S_1 \to S_2$, $U = U_1 \to U_2$, $T = T_1 \to T_2$.

From $S <:_a U$: by SA-Arrow, $U_1 <:_a S_1$ and $S_2 <:_a U_2$.
From $U <:_a T$: by SA-Arrow, $T_1 <:_a U_1$ and $U_2 <:_a T_2$.

We need to show $S_1 \to S_2 <:_a T_1 \to T_2$, which requires $T_1 <:_a S_1$ and $S_2 <:_a T_2$.

For $T_1 <:_a S_1$: We have $T_1 <:_a U_1$ and $U_1 <:_a S_1$. The intermediate type here is $U_1$, and $|U_1| < |U| = |U_1 \to U_2|$. So by the induction hypothesis (on the size of the intermediate type), $T_1 <:_a S_1$.

For $S_2 <:_a T_2$: We have $S_2 <:_a U_2$ and $U_2 <:_a T_2$. The intermediate type is $U_2$, and $|U_2| < |U|$. By IH, $S_2 <:_a T_2$.

By SA-Arrow, $S_1 \to S_2 <:_a T_1 \to T_2$.

### A.3 The Record Case

$S = \{k_p : S_p\}_{p \in 1..r}$, $U = \{m_q : U_q\}_{q \in 1..s}$, $T = \{l_i : T_i\}_{i \in 1..n}$.

From $S <:_a U$ (SA-Rcd): for each $q \in 1..s$, there exists $p$ with $k_p = m_q$ and $S_p <:_a U_q$.
From $U <:_a T$ (SA-Rcd): for each $i \in 1..n$, there exists $q$ with $m_q = l_i$ and $U_q <:_a T_i$.

For each $i \in 1..n$:
1. There exists $q$ with $m_q = l_i$ and $U_q <:_a T_i$.
2. For this $q$, there exists $p$ with $k_p = m_q = l_i$ and $S_p <:_a U_q$.
3. So we have $S_p <:_a U_q$ and $U_q <:_a T_i$ with $|U_q| < |U|$.
4. By IH, $S_p <:_a T_i$.

Also $k_p = l_i$. So for each $i$, we have found $p$ with $k_p = l_i$ and $S_p <:_a T_i$. By SA-Rcd, $S <:_a T$.

### A.4 The Mixed Cases

When $S$ and $T$ have different outermost constructors (e.g., $S$ is an arrow and $T$ is a product), we must show that $U$ cannot serve as an intermediate type.

If $S = S_1 \to S_2$ and $T = T_1 \times T_2$:
- From $S <:_a U$, with $S$ an arrow: the only rules that could derive this are SA-Top (giving $U = \top$) or SA-Arrow (giving $U = U_1 \to U_2$).
- If $U = \top$: then $U <:_a T = T_1 \times T_2$. But the only rule deriving $\top <:_a T$ is SA-Top (giving $T = \top$), which contradicts $T = T_1 \times T_2$.
- If $U = U_1 \to U_2$: then $U <:_a T = T_1 \times T_2$. No rule derives a subtyping between an arrow and a product (except SA-Top, but $T$ is a product, not $\top$).

So this case is impossible.

### A.5 The Bot-on-Left Case

If $S = \bot$: then $S <:_a U$ by SA-Bot. We need $\bot <:_a T$, which holds by SA-Bot. No use of the intermediate type $U$ is needed.

### A.6 The Top-on-Right Case

If $T = \top$: then we need $S <:_a \top$, which holds by SA-Top. No use of $U$ is needed.

---

## Appendix B: The Lattice Structure in Detail

### B.1 Lattice Axioms

A **lattice** is a partially ordered set $(L, \leq)$ where every pair of elements has a least upper bound (join, $\sqcup$) and greatest lower bound (meet, $\sqcap$). The lattice axioms are:

1. **Idempotency**: $a \sqcup a = a$ and $a \sqcap a = a$.
2. **Commutativity**: $a \sqcup b = b \sqcup a$ and $a \sqcap b = b \sqcap a$.
3. **Associativity**: $a \sqcup (b \sqcup c) = (a \sqcup b) \sqcup c$ and $a \sqcap (b \sqcap c) = (a \sqcap b) \sqcap c$.
4. **Absorption**: $a \sqcup (a \sqcap b) = a$ and $a \sqcap (a \sqcup b) = a$.

### B.2 Verifying the Lattice Axioms for Our Type System

We verify each axiom for our type system. Note that equality here means mutual subtyping ($S <: T$ and $T <: S$), not syntactic identity.

**Idempotency of join:** $T \sqcup T = T$.

For base types: $\text{Nat} \sqcup \text{Nat} = \text{Nat}$. Immediate from the definition.

For arrows: $(S_1 \to S_2) \sqcup (S_1 \to S_2) = (S_1 \sqcap S_1) \to (S_2 \sqcup S_2) = S_1 \to S_2$ (by IH, $S_1 \sqcap S_1 = S_1$ and $S_2 \sqcup S_2 = S_2$).

For records: $\{l_i : T_i\} \sqcup \{l_i : T_i\}$. The common labels are all labels, and each field type is joined with itself, giving $T_i$. So $\{l_i : T_i\} \sqcup \{l_i : T_i\} = \{l_i : T_i\}$.

**Commutativity of join:** $S \sqcup T = T \sqcup S$.

For arrows: $(S_1 \to S_2) \sqcup (T_1 \to T_2) = (S_1 \sqcap T_1) \to (S_2 \sqcup T_2)$ and $(T_1 \to T_2) \sqcup (S_1 \to S_2) = (T_1 \sqcap S_1) \to (T_2 \sqcup S_2)$. By IH (commutativity of $\sqcap$ and $\sqcup$), these are equal.

For records: the common labels of $S$ and $T$ are the same as the common labels of $T$ and $S$, and $\text{join}$ is commutative on each field type by IH.

The remaining axioms can be verified similarly by structural induction.

### B.3 The Bounded Lattice

With $\top$ and $\bot$, our lattice is **bounded**:
- $\top$ is the top element: $T \sqcup \top = \top$ and $T \sqcap \top = T$.
- $\bot$ is the bottom element: $T \sqcup \bot = T$ and $T \sqcap \bot = \bot$.

### B.4 Distributivity

A lattice is **distributive** if:

$$a \sqcup (b \sqcap c) = (a \sqcup b) \sqcap (a \sqcup c)$$

$$a \sqcap (b \sqcup c) = (a \sqcap b) \sqcup (a \sqcap c)$$

Our type lattice is distributive for "simple" types (base types, products, sums), but distributivity can fail for arrow types due to the contravariance in the domain. The precise conditions under which distributivity holds depend on the specific type constructors and subtyping rules.

### B.5 Non-Distributivity Example

Consider types $A = \text{Nat} \to \text{Nat}$, $B = \text{Bool} \to \text{Bool}$, $C = \top \to \bot$.

$B \sqcap C$: The meet of $\text{Bool} \to \text{Bool}$ and $\top \to \bot$.
$= (\text{Bool} \sqcup \top) \to (\text{Bool} \sqcap \bot) = \top \to \bot$.

$A \sqcup (B \sqcap C) = (\text{Nat} \to \text{Nat}) \sqcup (\top \to \bot)$.
$= (\text{Nat} \sqcap \top) \to (\text{Nat} \sqcup \bot) = \text{Nat} \to \text{Nat}$.

$(A \sqcup B) \sqcap (A \sqcup C)$:
$A \sqcup B = (\text{Nat} \sqcap \text{Bool}) \to (\text{Nat} \sqcup \text{Bool}) = \text{Bool} \to \text{Nat}$.
$A \sqcup C = (\text{Nat} \sqcap \top) \to (\text{Nat} \sqcup \bot) = \text{Nat} \to \text{Nat}$.
$(A \sqcup B) \sqcap (A \sqcup C) = (\text{Bool} \to \text{Nat}) \sqcap (\text{Nat} \to \text{Nat})$.
$= (\text{Bool} \sqcup \text{Nat}) \to (\text{Nat} \sqcap \text{Nat}) = \text{Nat} \to \text{Nat}$.

In this case, $A \sqcup (B \sqcap C) = (A \sqcup B) \sqcap (A \sqcup C) = \text{Nat} \to \text{Nat}$, so distributivity holds for this particular triple. Constructing a genuine counterexample requires more complex types or features (such as intersection and union types that are not just joins and meets of the standard type constructors).

---

## Appendix C: Algorithmic Typing Trace

We provide a detailed trace of the algorithmic typing procedure on a non-trivial term to illustrate how the algorithm works in practice.

### C.1 The Term

$$t = (\lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; \lambda r : \{x : \text{Nat}, y : \text{Bool}, z : \top\}.\; f\; r)\; (\lambda p : \{x : \text{Nat}, y : \text{Bool}\}.\; p.x)$$

### C.2 The Trace

**Step 1.** The outermost form is an application. We type the function and argument separately.

**Step 2.** The function is $\lambda f : \{x : \text{Nat}\} \to \text{Nat}.\; \lambda r : \{x : \text{Nat}, y : \text{Bool}, z : \top\}.\; f\; r$.

Under $\Gamma_1 = [f : \{x : \text{Nat}\} \to \text{Nat}]$, type the inner abstraction:

Under $\Gamma_2 = \Gamma_1, [r : \{x : \text{Nat}, y : \text{Bool}, z : \top\}]$, type the body $f\; r$:
- $f : \{x : \text{Nat}\} \to \text{Nat}$ (from $\Gamma_2$)
- $r : \{x : \text{Nat}, y : \text{Bool}, z : \top\}$ (from $\Gamma_2$)
- Subtype check: $\{x : \text{Nat}, y : \text{Bool}, z : \top\} <:_a \{x : \text{Nat}\}$?
  - SA-Rcd: for $x : \text{Nat}$ in the supertype, the subtype has $x : \text{Nat}$, and $\text{Nat} <:_a \text{Nat}$. Yes.
- Result: $\text{Nat}$

Inner abstraction: $\{x : \text{Nat}, y : \text{Bool}, z : \top\} \to \text{Nat}$

Outer abstraction: $(\{x : \text{Nat}\} \to \text{Nat}) \to (\{x : \text{Nat}, y : \text{Bool}, z : \top\} \to \text{Nat})$

**Step 3.** The argument is $\lambda p : \{x : \text{Nat}, y : \text{Bool}\}.\; p.x$.

Under $\Gamma_3 = [p : \{x : \text{Nat}, y : \text{Bool}\}]$:
- $p : \{x : \text{Nat}, y : \text{Bool}\}$
- $p.x$ : project $x$ from the record, getting $\text{Nat}$

Argument type: $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$

**Step 4.** Application: the function expects $\{x : \text{Nat}\} \to \text{Nat}$. The argument has type $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat}$.

Subtype check: $\{x : \text{Nat}, y : \text{Bool}\} \to \text{Nat} <:_a \{x : \text{Nat}\} \to \text{Nat}$?
- SA-Arrow:
  - Domain (contravariant): $\{x : \text{Nat}\} <:_a \{x : \text{Nat}, y : \text{Bool}\}$? SA-Rcd: for $x$ in the supertype, the subtype has $x : \text{Nat}$. But wait, we also need $y$ from the supertype. The supertype is $\{x : \text{Nat}, y : \text{Bool}\}$, but the subtype (in the contravariant check) is $\{x : \text{Nat}\}$. For $y : \text{Bool}$, there is no $y$ field in $\{x : \text{Nat}\}$. **Fails.**

So the subtype check fails. The application is ill-typed!

**Analysis.** The function $\lambda p : \{x : \text{Nat}, y : \text{Bool}\}.\; p.x$ requires two fields ($x$ and $y$) from its argument, even though it only uses $x$. It is too specific for a context expecting $\{x : \text{Nat}\} \to \text{Nat}$, because the context might supply a record with only an $x$ field.

If we change the argument to $\lambda p : \{x : \text{Nat}\}.\; p.x$ (accepting only $x$), then:
- Argument type: $\{x : \text{Nat}\} \to \text{Nat}$
- Subtype check: $\{x : \text{Nat}\} \to \text{Nat} <:_a \{x : \text{Nat}\} \to \text{Nat}$ -- trivially yes.
- Result type: $\{x : \text{Nat}, y : \text{Bool}, z : \top\} \to \text{Nat}$

This trace illustrates the importance of contravariance: a function that accepts more general arguments (fewer required fields) is more substitutable than one that demands specific fields.

---

## Appendix D: Complexity Analysis of Algorithmic Subtyping

### D.1 Time Complexity

The algorithmic subtyping check $S <:_a T$ proceeds by structural recursion on the pair $(S, T)$. At each recursive call, at least one of the types decreases in size. We analyze the worst-case complexity.

**Base cases.** SA-Top, SA-Refl-Nat, SA-Refl-Bool each take $O(1)$ time.

**Arrow case.** SA-Arrow makes two recursive calls: one on the domains (swapped) and one on the codomains. The total work is bounded by the sum of the sizes of the two types:

$$T_{\text{arrow}}(|S_1 \to S_2|, |T_1 \to T_2|) = T(|T_1|, |S_1|) + T(|S_2|, |T_2|) + O(1)$$

**Record case.** SA-Rcd makes one recursive call per field in the supertype record. If the supertype has $m$ fields and the subtype has $n$ fields ($n \geq m$ for the check to succeed), then looking up each label in the subtype takes $O(n)$ with a linear scan (or $O(\log n)$ with sorted fields), and the recursive call on each field type adds its own cost. The total is:

$$T_{\text{rcd}}(|S|, |T|) \leq m \cdot O(n) + \sum_{i=1}^{m} T(|S_i|, |T_i|)$$

**Overall.** For types without records, the algorithm runs in $O(\min(|S|, |T|))$ time. With records, the worst case is $O(|S| \cdot |T|)$ due to label lookup, though this can be reduced to $O(|S| + |T|)$ with hash-based label lookup.

### D.2 Space Complexity

The algorithm uses space proportional to the depth of the recursion, which is bounded by the height of the smaller type. For balanced types, this is $O(\log(\min(|S|, |T|)))$. For degenerate types (deeply nested arrows), this is $O(\min(|S|, |T|))$.

### D.3 Comparison with Declarative Subtyping

The declarative system has no direct complexity bound because it is not an algorithm -- it defines a relation. However, if one were to naively search for a derivation, the transitivity rule S-Trans would introduce a search over all possible intermediate types, making the search space infinite. This is precisely why the algorithmic formulation is needed: it eliminates this search by proving that transitivity is admissible.
