---
title: "Lecture 01c: Operational Semantics"
tags:
  - type-theory
  - untyped
  - lecture
---
# Lecture 01c: Operational Semantics

> **Module 01 -- Untyped Systems (Weeks 1-2)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. **Formulate** small-step (structural) operational semantics for the lambda calculus using inference rules.
2. **Formulate** big-step (natural) semantics and relate it to small-step semantics.
3. **Compare** call-by-value, call-by-name, and call-by-need evaluation strategies and analyze their trade-offs.
4. **Identify** normal forms, head normal forms, and weak head normal forms for lambda terms.
5. **Define** the multi-step reduction relation as a reflexive-transitive closure.
6. **State** the Church-Rosser theorem (confluence) and explain its significance for the consistency of reduction.
7. **Distinguish** weak normalization from strong normalization and identify which properties hold for the untyped lambda calculus.
8. **Prove** basic metatheoretic results about evaluation relations, including determinacy of specific strategies.

---

## 1. Motivation

In Lecture 01b, we introduced beta-reduction as the computational mechanism of the lambda calculus:

$$
(\lambda x.\, t)\; s \to_\beta [x \mapsto s]\, t
$$

But we left several critical questions unanswered:

- If a term has multiple redexes, which one do we reduce first?
- Does the order of reduction matter?
- When do we stop reducing?
- If we make different choices, do we reach the same result?

These questions are the domain of **operational semantics** -- the study of how programs execute. The answers turn out to be subtle and have profound consequences for programming language design. Different choices lead to different evaluation strategies, each with distinct performance characteristics and expressive power.

This lecture develops the operational semantics of the lambda calculus systematically, building on the framework introduced for arithmetic expressions in Lecture 01a.

---

## 2. Core Theory

### 2.1 Small-Step Semantics: Full Beta-Reduction

**Full beta-reduction** allows a redex to be reduced anywhere inside a term. The relation $\to$ is defined by the following rules:

$$
\frac{}{(\lambda x.\, t)\; s \to [x \mapsto s]\, t} \quad \text{(E-Beta)}
$$

$$
\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)}
$$

$$
\frac{t_2 \to t_2'}{t_1\; t_2 \to t_1\; t_2'} \quad \text{(E-App2)}
$$

$$
\frac{t \to t'}{\lambda x.\, t \to \lambda x.\, t'} \quad \text{(E-Abs)}
$$

This relation is **non-deterministic**: a term with multiple redexes can step in multiple ways.

**Example 2.1.** The term $(\lambda x.\, x)\; ((\lambda y.\, y)\; z)$ has two redexes:

1. The outer redex: $(\lambda x.\, x)\; ((\lambda y.\, y)\; z) \to [x \mapsto ((\lambda y.\, y)\; z)]\, x = (\lambda y.\, y)\; z$
2. The inner redex: $(\lambda x.\, x)\; ((\lambda y.\, y)\; z) \to (\lambda x.\, x)\; z$ (reducing the argument first)

Both paths eventually reach $z$:

$$
(\lambda x.\, x)\; ((\lambda y.\, y)\; z) \to (\lambda y.\, y)\; z \to z
$$

$$
(\lambda x.\, x)\; ((\lambda y.\, y)\; z) \to (\lambda x.\, x)\; z \to z
$$

This "diamond" property is not a coincidence -- it is guaranteed by the Church-Rosser theorem (Section 2.9).

### 2.2 Evaluation Strategies

In practice, we want evaluation to be deterministic. We achieve this by restricting *where* reduction can occur. The result is an **evaluation strategy**.

The key design decisions are:

1. **Do we reduce under lambda abstractions?** (Inside function bodies before they are called?)
2. **Do we reduce the argument of an application before substituting?**

Different combinations of these choices give different strategies.

### 2.3 Call-by-Value (CBV)

**Call-by-value** is the strategy used by most mainstream languages (OCaml, Java, C, Python). The key principles are:

- **Do not reduce under lambda abstractions.** A lambda abstraction is already a value -- we do not look inside its body.
- **Evaluate the argument to a value before substituting.** The function is applied only when the argument is fully evaluated.

**Definition 2.2 (CBV values).**

$$
v ::= \lambda x.\, t
$$

In call-by-value, the only values are lambda abstractions (in a pure lambda calculus without additional constants).

**Definition 2.3 (CBV evaluation rules).**

$$
\frac{}{(\lambda x.\, t)\; v \to [x \mapsto v]\, t} \quad \text{(E-BetaV)}
$$

$$
\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)}
$$

$$
\frac{t_2 \to t_2'}{v\; t_2 \to v\; t_2'} \quad \text{(E-App2V)}
$$

Note the differences from full beta-reduction:

- **E-BetaV** requires the argument to be a value $v$ (not an arbitrary term $s$).
- **E-App2V** only applies when the function position is already a value $v$ -- this enforces left-to-right evaluation: we evaluate the function first, then the argument, then perform the beta-step.
- There is **no rule for reducing under lambda** (no analogue of E-Abs).

**Theorem 2.4 (Determinacy of CBV).** If $t \to t'$ and $t \to t''$ under the CBV rules, then $t' = t''$.

*Proof.* By structural induction on the derivation of $t \to t'$, case-analyzing the last rule used and showing that exactly one rule applies to each term.

**Case E-BetaV:** $t = (\lambda x.\, t_1)\; v_2$ with $v_2$ a value, and $t' = [x \mapsto v_2]\, t_1$.

Could E-App1 also apply? E-App1 requires $\lambda x.\, t_1 \to t_1'$, but there is no CBV rule reducing a bare lambda abstraction. Could E-App2V also apply? E-App2V requires $v_2 \to t_2'$, but $v_2$ is a value and no CBV rule reduces a value. So only E-BetaV applies, and $t' = t''$.

**Case E-App1:** $t = t_1\; t_2$ with $t_1 \to t_1'$.

E-BetaV requires $t_1$ to be a value; but $t_1$ can take a step, so it is not a value (values are normal forms under CBV). E-App2V requires $t_1$ to be a value, which it is not. So only E-App1 applies. By induction, the step $t_1 \to t_1'$ is unique, hence $t' = t''$.

**Case E-App2V:** $t = v_1\; t_2$ with $v_1$ a value and $t_2 \to t_2'$.

E-App1 requires $v_1 \to t_1'$, but $v_1$ is a value. E-BetaV requires $t_2$ to be a value, but $t_2$ can step. So only E-App2V applies, and by induction on $t_2 \to t_2'$, the result is unique. $\square$

**Example 2.5 (CBV evaluation).** Evaluate $(\lambda f.\, f\; (\lambda x.\, x))\; (\lambda y.\, y)$ under CBV.

Step 1: The function $\lambda f.\, f\; (\lambda x.\, x)$ and the argument $\lambda y.\, y$ are both values. Apply E-BetaV:

$$
(\lambda f.\, f\; (\lambda x.\, x))\; (\lambda y.\, y) \to [f \mapsto (\lambda y.\, y)]\, (f\; (\lambda x.\, x)) = (\lambda y.\, y)\; (\lambda x.\, x)
$$

Step 2: Both subterms are values. Apply E-BetaV:

$$
(\lambda y.\, y)\; (\lambda x.\, x) \to [y \mapsto (\lambda x.\, x)]\, y = \lambda x.\, x
$$

Final result: $\lambda x.\, x$.

### 2.4 Call-by-Name (CBN)

**Call-by-name** does not evaluate the argument before substituting. Instead, the unevaluated argument is substituted directly into the function body. If the argument is never used (i.e., the bound variable does not appear in the body), the argument is never evaluated.

**Definition 2.6 (CBN evaluation rules).**

$$
\frac{}{(\lambda x.\, t)\; s \to [x \mapsto s]\, t} \quad \text{(E-BetaN)}
$$

$$
\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)}
$$

Note:
- **E-BetaN** does not require the argument $s$ to be a value. The raw term is substituted.
- There is **no rule for evaluating the argument** (no analogue of E-App2). The argument is only evaluated if and when it is used inside the function body.
- There is **no rule for reducing under lambda** (no analogue of E-Abs).

**Theorem 2.7 (Determinacy of CBN).** The CBN evaluation relation is deterministic.

*Proof.* Simpler than CBV: there are only two rules, and E-BetaN applies only when $t_1 = \lambda x.\, t$ (a value, so E-App1 does not apply). E-App1 applies only when $t_1$ is not a value (so E-BetaN does not apply). $\square$

**Example 2.8 (CBN vs CBV on a divergent argument).** Consider:

$$
(\lambda x.\, \lambda y.\, y)\; \Omega
$$

where $\Omega = (\lambda z.\, z\; z)\; (\lambda z.\, z\; z)$.

Under **CBN**: The function $\lambda x.\, \lambda y.\, y$ is applied to $\Omega$ immediately (E-BetaN):

$$
(\lambda x.\, \lambda y.\, y)\; \Omega \to [x \mapsto \Omega]\, (\lambda y.\, y) = \lambda y.\, y
$$

The result is $\lambda y.\, y$. The divergent argument $\Omega$ is never evaluated because $x$ does not appear in the body $\lambda y.\, y$.

Under **CBV**: We must first evaluate the argument $\Omega$ to a value (E-App2V). But $\Omega \to \Omega \to \Omega \to \cdots$ -- evaluation of the argument diverges. The term has no CBV normal form.

This example demonstrates a fundamental difference: **CBN can terminate on terms where CBV diverges.** The converse is not true, as the following theorem shows.

### 2.5 Call-by-Need (Lazy Evaluation)

Call-by-name has a performance problem: if the argument is used multiple times in the function body, it is evaluated multiple times.

**Example 2.9.** Under CBN:

$$
(\lambda x.\, x\; x)\; ((\lambda y.\, y)\; z) \to ((\lambda y.\, y)\; z)\; ((\lambda y.\, y)\; z)
$$

The argument $((\lambda y.\, y)\; z)$ has been duplicated and will be evaluated twice.

**Call-by-need** (lazy evaluation) addresses this by sharing: the first time the argument is needed, it is evaluated and its value is memoized. Subsequent uses of the argument retrieve the cached value.

Formally, call-by-need requires a more complex semantics involving a **heap** (or store) that maps variables to (possibly unevaluated) terms. We will not formalize it fully here, but note that it is the strategy used by Haskell.

**Key property:** Call-by-need evaluates each argument at most once, combining the termination behavior of call-by-name with the performance characteristics of call-by-value (in the best case).

### 2.6 Comparison of Strategies

| Property | Call-by-Value | Call-by-Name | Call-by-Need |
|----------|--------------|--------------|--------------|
| Evaluates argument before substitution? | Yes | No | Only when first needed |
| Number of times argument is evaluated | Exactly once | Once per occurrence | At most once |
| Reduces under lambdas? | No | No | No |
| Deterministic? | Yes | Yes | Yes |
| Terminates if CBV terminates? | Yes | Yes | Yes |
| Terminates if CBN terminates? | Not always | Yes | Yes |
| Performance model | Predictable | Can duplicate work | Needs memoization |
| Used by | OCaml, ML, Scheme, Java | Algol 60 (by specification) | Haskell |

**Theorem 2.10 (Standardization, informal).** If a term has a normal form, then call-by-name evaluation will find it.

This is a consequence of the standardization theorem (Curry and Feys, 1958): reducing the leftmost-outermost redex at each step always reaches a normal form if one exists. Call-by-name approximates this strategy (it reduces the leftmost-outermost redex that is not under a lambda).

### 2.7 Normal Forms and Their Variants

The notion of "normal form" depends on how much reduction we allow. Several variants are useful.

**Definition 2.11 (Beta-normal form).** A term $t$ is in **beta-normal form** if it contains no beta-redex anywhere (including under lambdas).

**Examples:** $x$, $\lambda x.\, x$, $x\; y\; z$, $\lambda x.\, x\; y$. **Non-examples:** $(\lambda x.\, x)\; y$, $\lambda x.\, (\lambda y.\, y)\; x$.

**Definition 2.12 (Weak normal form / Value).** A term is in **weak normal form** if it is not itself a redex at the top level, though it may contain redexes internally.

For CBV, the weak normal forms are lambda abstractions. For CBN, weak normal forms are also lambda abstractions (since application to a non-lambda function position cannot be reduced).

**Definition 2.13 (Head normal form).** A term is in **head normal form** if it has the shape:

$$
\lambda x_1.\, \lambda x_2.\, \cdots \lambda x_n.\, y\; t_1\; t_2\; \cdots\; t_m
$$

where $n \ge 0$, $m \ge 0$, and $y$ is a variable. That is, the "head" of the term (after stripping lambdas and applications) is a variable, not a redex.

**Examples:** $x$, $\lambda x.\, x\; y$, $\lambda x.\, \lambda y.\, x\; y\; (\lambda z.\, z)$. The last example has a redex ($(\lambda z.\, z)$) but not in "head position."

**Non-example:** $\lambda x.\, (\lambda y.\, y)\; x$. After stripping the outer lambda, the head is $(\lambda y.\, y)\; x$, which is a redex.

**Definition 2.14 (Weak head normal form, WHNF).** A term is in **weak head normal form** if it is either:
- A lambda abstraction $\lambda x.\, t$ (regardless of whether $t$ contains redexes), or
- An application $x\; t_1\; \cdots\; t_n$ where the head is a free variable.

WHNF is the notion of "result" used by call-by-name and call-by-need evaluation. Haskell evaluates expressions to WHNF.

**Containment hierarchy:**

$$
\text{Normal forms} \subset \text{Head normal forms} \subset \text{Weak head normal forms}
$$

Every normal form is a head normal form (the head is necessarily a variable). Every head normal form is a weak head normal form.

### 2.8 Stuck Terms in the Lambda Calculus

In the pure untyped lambda calculus, are there stuck terms? Consider the CBV rules. A term is stuck under CBV if it is not a value and no evaluation rule applies.

**Example 2.15.** The term $x\; (\lambda y.\, y)$ is stuck under CBV: $x$ is a free variable (not a lambda), so E-BetaV does not apply; $x$ cannot take a step, so E-App1 does not apply; and the argument $\lambda y.\, y$ is already a value, but E-App2V requires the function to be a value.

In the **pure** lambda calculus (where all terms are built from variables, abstractions, and applications), stuck terms arise only when a free variable appears in "function position." If we restrict attention to **closed** terms (no free variables), then under CBV, every closed term either is a value or can take a step.

**Proposition 2.16.** If $t$ is a closed term, then under CBV evaluation, either $t$ is a value or there exists $t'$ with $t \to t'$.

*Proof.* By structural induction on $t$.

- $t = x$: impossible, since $t$ is closed and $x$ is free.
- $t = \lambda x.\, t_1$: then $t$ is a value.
- $t = t_1\; t_2$: since $t$ is closed, both $t_1$ and $t_2$ are closed. By induction, $t_1$ is either a value or can step.
  - If $t_1$ can step to $t_1'$, then $t \to t_1'\; t_2$ by E-App1.
  - If $t_1$ is a value, then $t_1 = \lambda x.\, t_{1}'$ for some $t_{1}'$. Now $t_2$ is either a value or can step.
    - If $t_2$ can step to $t_2'$, then $t \to (\lambda x.\, t_{1}')\; t_2'$ by E-App2V.
    - If $t_2$ is a value $v$, then $t = (\lambda x.\, t_{1}')\; v$ and E-BetaV applies. $\square$

This is a "mini progress theorem" for the untyped lambda calculus on closed terms. In Module 02, we will prove a much stronger version: well-typed terms do not get stuck even in the presence of additional constants (booleans, numbers, etc.).

### 2.9 The Church-Rosser Theorem (Confluence)

The Church-Rosser theorem is arguably the most important metatheoretic result about the lambda calculus. It says that the order of reduction does not matter: no matter which redexes we choose to reduce, we can always reach a common term.

**Definition 2.17 (Confluence / Church-Rosser property).** A reduction relation $\to$ on terms is **confluent** (or has the **Church-Rosser property**) if whenever $t \twoheadrightarrow t_1$ and $t \twoheadrightarrow t_2$ (where $\twoheadrightarrow$ is the reflexive-transitive closure of $\to$), there exists a term $t_3$ such that $t_1 \twoheadrightarrow t_3$ and $t_2 \twoheadrightarrow t_3$.

Diagrammatically:

```
        t
       / \
      /   \
     *     *
    /       \
   t1       t2
    \       /
     *     *
      \   /
       t3
```

where the single arrows represent multi-step reduction ($\twoheadrightarrow$).

**Theorem 2.18 (Church-Rosser, 1936).** Beta-reduction on the untyped lambda calculus is confluent.

This is a deep theorem with a non-trivial proof. We outline the main ideas.

**Proof strategy (Tait-Martin-Lof method).** The standard proof proceeds in two stages:

**Stage 1: Diamond property for parallel reduction.** Define a relation $\Rightarrow$ called **parallel reduction**, which allows zero or more redexes to be reduced simultaneously in a single step:

$$
\frac{}{x \Rightarrow x}
$$

$$
\frac{t \Rightarrow t'}{\lambda x.\, t \Rightarrow \lambda x.\, t'}
$$

$$
\frac{t_1 \Rightarrow t_1' \quad t_2 \Rightarrow t_2'}{t_1\; t_2 \Rightarrow t_1'\; t_2'}
$$

$$
\frac{t_1 \Rightarrow t_1' \quad t_2 \Rightarrow t_2'}{(\lambda x.\, t_1)\; t_2 \Rightarrow [x \mapsto t_2']\, t_1'}
$$

The key property: parallel reduction satisfies the **diamond property**: if $t \Rightarrow t_1$ and $t \Rightarrow t_2$, then there exists $t_3$ with $t_1 \Rightarrow t_3$ and $t_2 \Rightarrow t_3$.

The proof defines a **complete development** $t^*$ for each parallel reduction from $t$, which reduces *all* redexes in $t$ simultaneously. One shows that any parallel reduction can be "completed" to this maximal reduction.

**Stage 2: From parallel confluence to sequential confluence.** One shows that:

- $\to_\beta\ \subseteq\ \Rightarrow\ \subseteq\ \twoheadrightarrow_\beta$

That is, a single beta-step is a special case of parallel reduction, and a parallel reduction is a special case of multi-step beta-reduction.

From the diamond property of $\Rightarrow$ and these containments, it follows that $\twoheadrightarrow_\beta$ is confluent. $\square$

**Corollary 2.19 (Uniqueness of normal forms).** If $t \twoheadrightarrow_\beta u$ and $t \twoheadrightarrow_\beta u'$ with $u$ and $u'$ in normal form, then $u =_\alpha u'$.

*Proof.* By Church-Rosser, there exists $w$ with $u \twoheadrightarrow_\beta w$ and $u' \twoheadrightarrow_\beta w$. But $u$ is in normal form, so $u \twoheadrightarrow_\beta w$ implies $u = w$. Similarly $u' = w$. Hence $u = u'$. $\square$

**Corollary 2.20 (Consistency of beta-equality).** There exist terms $t, s$ with $t \neq_\beta s$. In particular, $\text{true} \neq_\beta \text{false}$ (using the Church encodings from Lecture 01d).

*Proof.* If $\text{true} =_\beta \text{false}$, then by the definition of $=_\beta$ there would be a reduction path connecting them. By Church-Rosser, they would have a common reduct. But both $\text{true} = \lambda t.\, \lambda f.\, t$ and $\text{false} = \lambda t.\, \lambda f.\, f$ are in normal form. By the previous corollary, they would be alpha-equivalent, which they are not. Contradiction. $\square$

### 2.10 Significance of Church-Rosser

The Church-Rosser theorem has several profound consequences:

1. **Normal forms are unique** (up to alpha-equivalence). A term has at most one normal form, regardless of the evaluation strategy used to find it. This justifies using any convenient strategy: the answer is always the same.

2. **Beta-equivalence is consistent.** Not all terms are beta-equivalent. Without confluence, it would be conceivable that every term reduces to every other term, rendering the calculus trivially inconsistent.

3. **Call-by-name finds normal forms if they exist.** Combined with the standardization theorem, Church-Rosser guarantees that the leftmost-outermost strategy is normalizing: if a term has a normal form, this strategy finds it.

4. **Denotational soundness.** Any denotational semantics that respects beta-equivalence is consistent (maps different normal forms to different denotations).

### 2.11 Normalization

**Definition 2.21.** A term $t$ is **weakly normalizing** if there exists a reduction sequence from $t$ to a normal form. A term is **strongly normalizing** if every reduction sequence from $t$ eventually reaches a normal form (i.e., there are no infinite reduction sequences starting from $t$).

Strong normalization implies weak normalization, but not conversely.

**Example 2.22.** Consider the term $(\lambda x.\, \lambda y.\, y)\; \Omega$, where $\Omega = (\lambda z.\, z\; z)\; (\lambda z.\, z\; z)$.

This term is **weakly normalizing**: there is a reduction sequence to a normal form (reduce the outer redex first, discarding $\Omega$):

$$
(\lambda x.\, \lambda y.\, y)\; \Omega \to_\beta \lambda y.\, y
$$

But it is **not strongly normalizing**: there also exists an infinite reduction sequence (keep reducing $\Omega$ inside the argument position):

$$
(\lambda x.\, \lambda y.\, y)\; \Omega \to (\lambda x.\, \lambda y.\, y)\; \Omega \to (\lambda x.\, \lambda y.\, y)\; \Omega \to \cdots
$$

(under full beta-reduction, where we can choose to reduce the inner $\Omega$).

**Theorem 2.23.** The untyped lambda calculus is **not** strongly normalizing (due to $\Omega$) and is **not** weakly normalizing (some terms, like $\Omega$ itself, have no normal form at all). However, every weakly normalizing term has a unique normal form (by Church-Rosser).

**Remark.** The simply typed lambda calculus (Module 02) is strongly normalizing: every well-typed term has a normal form, and every reduction sequence reaches it. This is one of the most important consequences of adding types.

### 2.12 The Standardization Theorem

**Theorem 2.24 (Curry and Feys, 1958).** If $t$ has a beta-normal form, then the **standard reduction sequence** (reducing the leftmost-outermost redex at each step) reaches it.

The standard reduction order is closely related to call-by-name: it always reduces the redex whose $\lambda$ is furthest to the left. However, the standard reduction allows reduction under lambdas, while call-by-name does not.

This theorem provides an operational justification for lazy evaluation: if you always evaluate the leftmost-outermost redex, you will find the normal form whenever one exists. No other strategy can do better in terms of termination (though it might do better in terms of efficiency).

---

## 3. Big-Step Semantics

### 3.1 Definition

**Big-step semantics** (or **natural semantics**, introduced by Gilles Kahn in 1987) defines evaluation as a relation $t \Downarrow v$ between a term and its final value, bypassing intermediate steps entirely.

**Definition 2.25 (Big-step CBV for the lambda calculus).**

$$
\frac{}{\lambda x.\, t \Downarrow \lambda x.\, t} \quad \text{(B-Value)}
$$

$$
\frac{t_1 \Downarrow \lambda x.\, t \quad t_2 \Downarrow v_2 \quad [x \mapsto v_2]\, t \Downarrow v}{t_1\; t_2 \Downarrow v} \quad \text{(B-App)}
$$

Rule B-Value says that a lambda abstraction evaluates to itself (it is already a value). Rule B-App says that to evaluate an application $t_1\; t_2$:

1. Evaluate $t_1$ to a function $\lambda x.\, t$.
2. Evaluate $t_2$ to a value $v_2$.
3. Substitute $v_2$ for $x$ in the body $t$ and evaluate the result to $v$.

**Example 2.26.** Derive $(\lambda f.\, f\; f)\; (\lambda x.\, x) \Downarrow \lambda x.\, x$.

We need:
1. $\lambda f.\, f\; f \Downarrow \lambda f.\, f\; f$ (by B-Value).
2. $\lambda x.\, x \Downarrow \lambda x.\, x$ (by B-Value).
3. $[f \mapsto (\lambda x.\, x)]\, (f\; f) = (\lambda x.\, x)\; (\lambda x.\, x) \Downarrow \lambda x.\, x$.

For step 3, we need another application of B-App:
- $\lambda x.\, x \Downarrow \lambda x.\, x$ (B-Value).
- $\lambda x.\, x \Downarrow \lambda x.\, x$ (B-Value).
- $[x \mapsto (\lambda x.\, x)]\, x = \lambda x.\, x \Downarrow \lambda x.\, x$ (B-Value).

So the full derivation tree is:

$$
\frac{\frac{}{\lambda f.\, f\; f \Downarrow \lambda f.\, f\; f} \quad \frac{}{\lambda x.\, x \Downarrow \lambda x.\, x} \quad \frac{\frac{}{\lambda x.\, x \Downarrow \lambda x.\, x} \quad \frac{}{\lambda x.\, x \Downarrow \lambda x.\, x} \quad \frac{}{\lambda x.\, x \Downarrow \lambda x.\, x}}{(\lambda x.\, x)\; (\lambda x.\, x) \Downarrow \lambda x.\, x}}{(\lambda f.\, f\; f)\; (\lambda x.\, x) \Downarrow \lambda x.\, x}
$$

### 3.2 Small-Step vs Big-Step: Comparison

| Aspect | Small-step | Big-step |
|--------|-----------|----------|
| Defines | $t \to t'$ (one step) | $t \Downarrow v$ (final result) |
| Intermediate states | Visible | Hidden |
| Non-termination | No derivation for $t \to^* v$ | No derivation for $t \Downarrow v$ |
| Error handling | Term gets stuck | No derivation |
| Compositionality | Steps compose naturally | Rules can be more complex |
| Distinguishing errors from divergence | Stuck term vs infinite sequence | Both look the same (no derivation) |

The last point is a significant disadvantage of big-step semantics: if $t$ has no value, we cannot tell whether evaluation diverges or gets stuck. With small-step semantics, divergence produces an infinite sequence $t \to t_1 \to t_2 \to \cdots$, while stuckness produces a finite sequence ending in a non-value normal form.

### 3.3 Equivalence of Small-Step and Big-Step

**Theorem 2.27.** For the CBV lambda calculus, $t \to^* v$ (where $v$ is a value and $v$ is in normal form) if and only if $t \Downarrow v$.

*Proof sketch.*

($\Leftarrow$): By induction on the derivation of $t \Downarrow v$.

- B-Value: $\lambda x.\, t \Downarrow \lambda x.\, t$, and indeed $\lambda x.\, t \to^* \lambda x.\, t$ (zero steps).
- B-App: $t_1\; t_2 \Downarrow v$ with $t_1 \Downarrow \lambda x.\, t$, $t_2 \Downarrow v_2$, $[x \mapsto v_2]\, t \Downarrow v$. By induction, $t_1 \to^* \lambda x.\, t$, $t_2 \to^* v_2$, $[x \mapsto v_2]\, t \to^* v$. Then:

$$
t_1\; t_2 \to^* (\lambda x.\, t)\; t_2 \to^* (\lambda x.\, t)\; v_2 \to [x \mapsto v_2]\, t \to^* v
$$

using the fact that $\to$ is compatible with application (congruence rules).

($\Rightarrow$): By induction on the length of $t \to^* v$, using determinacy and the fact that values are normal forms. $\square$

### 3.4 Big-Step Semantics for Arithmetic Expressions

For completeness, we also give big-step semantics for the arithmetic expression language of Lecture 01a:

$$
\frac{}{v \Downarrow v} \quad \text{(B-Value)} \qquad \text{(where } v \text{ is a value)}
$$

$$
\frac{t_1 \Downarrow \text{true} \quad t_2 \Downarrow v_2}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \Downarrow v_2} \quad \text{(B-IfTrue)}
$$

$$
\frac{t_1 \Downarrow \text{false} \quad t_3 \Downarrow v_3}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \Downarrow v_3} \quad \text{(B-IfFalse)}
$$

$$
\frac{t_1 \Downarrow nv_1}{\text{succ } t_1 \Downarrow \text{succ } nv_1} \quad \text{(B-Succ)}
$$

$$
\frac{t_1 \Downarrow 0}{\text{pred } t_1 \Downarrow 0} \quad \text{(B-PredZero)}
$$

$$
\frac{t_1 \Downarrow \text{succ } nv_1}{\text{pred } t_1 \Downarrow nv_1} \quad \text{(B-PredSucc)}
$$

$$
\frac{t_1 \Downarrow 0}{\text{iszero } t_1 \Downarrow \text{true}} \quad \text{(B-IszeroZero)}
$$

$$
\frac{t_1 \Downarrow \text{succ } nv_1}{\text{iszero } t_1 \Downarrow \text{false}} \quad \text{(B-IszeroSucc)}
$$

---

## 4. Combining Arithmetic and Lambda Calculus

### 4.1 Syntax of the Combined Language

We can combine the arithmetic expressions from Lecture 01a with the lambda calculus:

$$
t ::= x \mid \lambda x.\, t \mid t\; t \mid \text{true} \mid \text{false} \mid \text{if } t \text{ then } t \text{ else } t \mid 0 \mid \text{succ } t \mid \text{pred } t \mid \text{iszero } t
$$

$$
v ::= \lambda x.\, t \mid \text{true} \mid \text{false} \mid nv
$$

$$
nv ::= 0 \mid \text{succ } nv
$$

### 4.2 CBV Evaluation Rules for the Combined Language

All the rules from the arithmetic language (Lecture 01a) carry over, plus the CBV lambda calculus rules. The only subtlety is the interaction between function application and the non-lambda values.

**New stuck terms.** In the combined language, stuck terms are more interesting:

- $\text{true}\; \text{false}$: application of a non-function to an argument.
- $\text{iszero } (\lambda x.\, x)$: iszero applied to a function.
- $\text{if } 0 \text{ then } t_2 \text{ else } t_3$: conditional with a non-boolean guard.

These are precisely the "type errors" that the simply typed lambda calculus (Module 02) will prevent.

### 4.3 Evaluation Contexts for CBV Lambda Calculus

The evaluation-context approach introduced in Lecture 01a applies equally well to the lambda calculus.

**Definition 2.28 (CBV evaluation contexts).**

$$
E ::= [\cdot] \mid E\; t \mid v\; E
$$

An evaluation context is either the hole, an application with the context in the function position (and an arbitrary term in the argument position), or an application with a value in the function position and the context in the argument position.

The single computation rule is:

$$
(\lambda x.\, t)\; v \hookrightarrow [x \mapsto v]\, t
$$

And the lifting rule:

$$
\frac{t \hookrightarrow t'}{E[t] \to E[t']}
$$

**Proposition 2.29 (Unique decomposition for CBV).** For every closed term $t$ that is not a value, there exist a unique evaluation context $E$ and a unique redex $(\lambda x.\, t_1)\; v_2$ such that $t = E[(\lambda x.\, t_1)\; v_2]$.

This proposition is equivalent to the determinacy of CBV evaluation: the unique decomposition gives a unique next step.

**Definition 2.30 (CBN evaluation contexts).**

$$
E ::= [\cdot] \mid E\; t
$$

The only change is that we do not have $v\; E$ -- we never evaluate the argument, so we never have a context with a value in the function position waiting for the argument to be evaluated.

**Definition 2.31 (Full beta-reduction evaluation contexts).**

$$
E ::= [\cdot] \mid E\; t \mid t\; E \mid \lambda x.\, E
$$

Here the context can be in any position: either side of an application, or under a lambda. This is why full beta-reduction is non-deterministic: the decomposition is not unique.

---

## 5. Formal Properties and Proofs

### 5.1 The Substitution Lemma

Many proofs about the lambda calculus require reasoning about the interaction of substitution with itself. The key result is:

**Lemma 2.32 (Substitution commutes, restated).** If $x \neq y$ and $x \notin \text{FV}(s)$, then:

$$
[x \mapsto s]\, [y \mapsto r]\, t = [y \mapsto [x \mapsto s]\, r]\, [x \mapsto s]\, t
$$

*Proof.* By structural induction on $t$. We show two representative cases.

**Case $t = y$:**

LHS: $[x \mapsto s]\, [y \mapsto r]\, y = [x \mapsto s]\, r$.

RHS: $[y \mapsto [x \mapsto s]\, r]\, [x \mapsto s]\, y = [y \mapsto [x \mapsto s]\, r]\, y$ (since $y \neq x$) $= [x \mapsto s]\, r$. Equal.

**Case $t = x$:**

LHS: $[x \mapsto s]\, [y \mapsto r]\, x = [x \mapsto s]\, x$ (since $x \neq y$) $= s$.

RHS: $[y \mapsto [x \mapsto s]\, r]\, [x \mapsto s]\, x = [y \mapsto [x \mapsto s]\, r]\, s = s$ (since $y \notin \text{FV}(s)$, the substitution does not change $s$). Equal.

**Case $t = z$ (for $z \neq x, z \neq y$):** Both sides reduce to $z$.

**Case $t = t_1\; t_2$:** Follows directly from the induction hypothesis applied to $t_1$ and $t_2$.

**Case $t = \lambda z.\, t_1$:** By Barendregt's convention, we may assume $z \neq x$, $z \neq y$, $z \notin \text{FV}(s)$, $z \notin \text{FV}(r)$. Then both sides reduce to $\lambda z.\,$ applied to the inductive result on $t_1$. $\square$

### 5.2 Preservation of Free Variables Under Reduction

**Lemma 2.33.** If $t \to_\beta t'$, then $\text{FV}(t') \subseteq \text{FV}(t)$.

*Proof.* By induction on the derivation of $t \to_\beta t'$. The key case is E-Beta: $(\lambda x.\, t_1)\; t_2 \to_\beta [x \mapsto t_2]\, t_1$. We have:

$$
\text{FV}([x \mapsto t_2]\, t_1) \subseteq (\text{FV}(t_1) \setminus \{x\}) \cup \text{FV}(t_2) \subseteq \text{FV}(\lambda x.\, t_1) \cup \text{FV}(t_2) = \text{FV}((\lambda x.\, t_1)\; t_2)
$$

The congruence cases follow from the induction hypothesis. $\square$

**Corollary 2.34.** If $t$ is closed and $t \to_\beta^* t'$, then $t'$ is closed.

### 5.3 Determinacy and Evaluation Contexts

There is a deep connection between determinacy and the unique decomposition property of evaluation contexts.

**Theorem 2.36 (Unique decomposition for CBV).** For every closed term $t$ that is not a value, there exist a unique evaluation context $E$ and a unique redex $r = (\lambda x.\, t_1)\; v_2$ such that $t = E[r]$.

*Proof sketch.* By induction on $t$.

- $t = x$: impossible (closed).
- $t = \lambda x.\, t_1$: a value, excluded by hypothesis.
- $t = t_1\; t_2$: Consider $t_1$.
  - If $t_1$ is not a value, by IH there is a unique $E_1, r_1$ with $t_1 = E_1[r_1]$. Then $t = (E_1\; t_2)[r_1]$ and the context $E = E_1\; t_2$ is unique.
  - If $t_1 = \lambda x.\, t_1'$ (a value), consider $t_2$.
    - If $t_2$ is not a value, by IH there is a unique $E_2, r_2$ with $t_2 = E_2[r_2]$. Then $t = (v_1\; E_2)[r_2]$.
    - If $t_2$ is a value $v_2$, then $t = (\lambda x.\, t_1')\; v_2$ is itself a redex. $E = [\cdot]$ and $r = t$. $\square$

The determinacy of CBV follows immediately: the unique decomposition gives a unique next step.

This proof technique generalizes to richer languages. In Module 02, we will use evaluation contexts to define the semantics of the simply typed lambda calculus with extensions.

### 5.4 Confluence: Proof Details

We provide more details on the proof of the Church-Rosser theorem (Theorem 2.18).

**Definition 2.35 (Complete development).** For a term $t$, define $t^*$ (the complete development) by simultaneously reducing *all* redexes:

$$
x^* = x
$$

$$
(\lambda x.\, t)^* = \lambda x.\, t^*
$$

$$
(t_1\; t_2)^* = t_1^*\; t_2^* \quad \text{if } t_1 \text{ is not an abstraction}
$$

$$
((\lambda x.\, t_1)\; t_2)^* = [x \mapsto t_2^*]\, t_1^*
$$

**Key lemma.** If $t \Rightarrow t'$ (parallel reduction), then $t' \Rightarrow t^*$.

*Proof.* By induction on $t$, case-analyzing the derivation of $t \Rightarrow t'$. The non-trivial case is $(\lambda x.\, t_1)\; t_2 \Rightarrow [x \mapsto t_2']\, t_1'$ (where $t_1 \Rightarrow t_1'$ and $t_2 \Rightarrow t_2'$). By IH, $t_1' \Rightarrow t_1^*$ and $t_2' \Rightarrow t_2^*$. Then:

$$
[x \mapsto t_2']\, t_1' \Rightarrow [x \mapsto t_2^*]\, t_1^*
$$

using the fact that substitution preserves parallel reduction (proved by a separate induction). And $[x \mapsto t_2^*]\, t_1^* = ((\lambda x.\, t_1)\; t_2)^*$. $\square$

The diamond property of $\Rightarrow$ follows immediately: if $t \Rightarrow t_1$ and $t \Rightarrow t_2$, then both $t_1 \Rightarrow t^*$ and $t_2 \Rightarrow t^*$, so $t^*$ is the common reduct.

---

## 6. Worked Examples

### 5.1 Tracing CBV Evaluation

Evaluate $(\lambda x.\, \lambda y.\, x\; y)\; (\lambda z.\, z)\; \text{true}$ under CBV (using the combined language).

Recall that application is left-associative, so this is $((\lambda x.\, \lambda y.\, x\; y)\; (\lambda z.\, z))\; \text{true}$.

Step 1: Evaluate the inner application. Both $\lambda x.\, \lambda y.\, x\; y$ and $\lambda z.\, z$ are values. Apply E-BetaV:

$$
(\lambda x.\, \lambda y.\, x\; y)\; (\lambda z.\, z) \to [x \mapsto (\lambda z.\, z)]\, (\lambda y.\, x\; y) = \lambda y.\, (\lambda z.\, z)\; y
$$

So the whole term becomes $(\lambda y.\, (\lambda z.\, z)\; y)\; \text{true}$.

Step 2: Both $\lambda y.\, (\lambda z.\, z)\; y$ and $\text{true}$ are values. Apply E-BetaV:

$$
(\lambda y.\, (\lambda z.\, z)\; y)\; \text{true} \to [y \mapsto \text{true}]\, ((\lambda z.\, z)\; y) = (\lambda z.\, z)\; \text{true}
$$

Step 3: Both $\lambda z.\, z$ and $\text{true}$ are values. Apply E-BetaV:

$$
(\lambda z.\, z)\; \text{true} \to [z \mapsto \text{true}]\, z = \text{true}
$$

Final result: $\text{true}$.

### 5.2 Tracing CBN Evaluation

Evaluate the same term under CBN.

Step 1: $(\lambda x.\, \lambda y.\, x\; y)\; (\lambda z.\, z)$ is a redex (no need to check if argument is a value):

$$
(\lambda x.\, \lambda y.\, x\; y)\; (\lambda z.\, z) \to \lambda y.\, (\lambda z.\, z)\; y
$$

Whole term: $(\lambda y.\, (\lambda z.\, z)\; y)\; \text{true}$.

Step 2: E-BetaN:

$$
(\lambda y.\, (\lambda z.\, z)\; y)\; \text{true} \to (\lambda z.\, z)\; \text{true}
$$

Step 3: E-BetaN:

$$
(\lambda z.\, z)\; \text{true} \to \text{true}
$$

Same result, same number of steps in this case.

### 5.3 A Case Where CBN Saves Work

Evaluate $(\lambda x.\, \text{true})\; ((\lambda y.\, y\; y)\; (\lambda y.\, y\; y))$ under both strategies.

Under **CBN**: Apply E-BetaN immediately, discarding the argument:

$$
(\lambda x.\, \text{true})\; ((\lambda y.\, y\; y)\; (\lambda y.\, y\; y)) \to \text{true}
$$

One step, done.

Under **CBV**: Must first evaluate the argument $(\lambda y.\, y\; y)\; (\lambda y.\, y\; y) = \Omega$. But $\Omega \to \Omega \to \cdots$. Evaluation diverges.

### 5.4 Building a Big-Step Derivation

Derive $(\lambda x.\, x)\; ((\lambda y.\, y)\; (\lambda z.\, z)) \Downarrow \lambda z.\, z$ using big-step CBV.

We apply B-App with $t_1 = \lambda x.\, x$ and $t_2 = (\lambda y.\, y)\; (\lambda z.\, z)$:

1. $t_1 \Downarrow \lambda x.\, x$ (B-Value).
2. $t_2 \Downarrow ?$ We need another application of B-App:
   - $\lambda y.\, y \Downarrow \lambda y.\, y$ (B-Value).
   - $\lambda z.\, z \Downarrow \lambda z.\, z$ (B-Value).
   - $[y \mapsto (\lambda z.\, z)]\, y = \lambda z.\, z \Downarrow \lambda z.\, z$ (B-Value).
   - So $t_2 \Downarrow \lambda z.\, z$.
3. $[x \mapsto (\lambda z.\, z)]\, x = \lambda z.\, z \Downarrow \lambda z.\, z$ (B-Value).

$$
\frac{\frac{}{\lambda x.\, x \Downarrow \lambda x.\, x} \quad \frac{\frac{}{\lambda y.\, y \Downarrow \lambda y.\, y} \quad \frac{}{\lambda z.\, z \Downarrow \lambda z.\, z} \quad \frac{}{\lambda z.\, z \Downarrow \lambda z.\, z}}{(\lambda y.\, y)\; (\lambda z.\, z) \Downarrow \lambda z.\, z} \quad \frac{}{\lambda z.\, z \Downarrow \lambda z.\, z}}{(\lambda x.\, x)\; ((\lambda y.\, y)\; (\lambda z.\, z)) \Downarrow \lambda z.\, z}
$$

### 6.5 Comparing Normal Form Variants

Consider the term $t = \lambda x.\, (\lambda y.\, y)\; x$.

- **Is $t$ in beta-normal form?** No. The body contains the redex $(\lambda y.\, y)\; x$.
- **Is $t$ in head normal form?** No. After stripping the outer lambda, the head is $(\lambda y.\, y)\; x$, which is a redex.
- **Is $t$ in weak head normal form?** Yes. The term is a lambda abstraction, and WHNF does not look inside lambda bodies.

Under CBV and CBN (which do not reduce under lambdas), $t$ is in normal form (a value). Under full beta-reduction, $t \to_\beta \lambda x.\, x$ (the identity).

This illustrates the layered structure of normal forms:

$$
\text{WHNF} \supset \text{HNF} \supset \text{NF}
$$

### 6.6 An Extended Reduction Exercise

Reduce $(\lambda f.\, \lambda x.\, f\; (f\; x))\; (\lambda y.\, \text{succ}\; y)\; 0$ under CBV (in the combined arithmetic + lambda calculus language).

Step 1: The function $(\lambda f.\, \lambda x.\, f\; (f\; x))$ and the first argument $(\lambda y.\, \text{succ}\; y)$ are both values. Apply E-BetaV:

$$
(\lambda f.\, \lambda x.\, f\; (f\; x))\; (\lambda y.\, \text{succ}\; y) \to \lambda x.\, (\lambda y.\, \text{succ}\; y)\; ((\lambda y.\, \text{succ}\; y)\; x)
$$

The whole term becomes $(\lambda x.\, (\lambda y.\, \text{succ}\; y)\; ((\lambda y.\, \text{succ}\; y)\; x))\; 0$.

Step 2: Both parts are values. Apply E-BetaV:

$$
(\lambda x.\, (\lambda y.\, \text{succ}\; y)\; ((\lambda y.\, \text{succ}\; y)\; x))\; 0 \to (\lambda y.\, \text{succ}\; y)\; ((\lambda y.\, \text{succ}\; y)\; 0)
$$

Step 3: The function $\lambda y.\, \text{succ}\; y$ is a value. Evaluate the argument $(\lambda y.\, \text{succ}\; y)\; 0$:

$$
(\lambda y.\, \text{succ}\; y)\; 0 \to \text{succ}\; 0
$$

Step 4: Now the outer application has a value argument $\text{succ}\; 0$:

$$
(\lambda y.\, \text{succ}\; y)\; (\text{succ}\; 0) \to \text{succ}\; (\text{succ}\; 0)
$$

Final result: $\text{succ}\; (\text{succ}\; 0)$, i.e., the number $2$. This correctly computes "apply successor twice to zero."

---

## 7. Exercises

**Exercise 7.1.** Reduce the following term to normal form under (a) CBV, (b) CBN, and (c) full beta-reduction. Compare the number of steps in each case.

$$
(\lambda x.\, x\; x)\; (\lambda y.\, y)\; (\lambda z.\, z)
$$

**Exercise 7.2.** Find a term $t$ such that:
- $t$ has a CBN normal form.
- $t$ does not have a CBV normal form.

*(Hint: use a constant function that discards a divergent argument.)*

**Exercise 7.3.** Prove Proposition 2.16 (progress for closed terms under CBV) in full detail.

**Exercise 7.4.** Write down the CBN evaluation contexts and verify that the unique decomposition property holds by examining the grammar. Explain why the grammar guarantees at most one decomposition.

**Exercise 7.5.** Consider the term $(\lambda x.\, x\; x\; x)\; (\lambda x.\, x\; x\; x)$.

- (a) Show that this term reduces to a term with strictly more redexes.
- (b) Does this term have a normal form? Justify your answer.
- (c) What does this tell us about the relationship between the number of redexes and termination?

**Exercise 7.6.** Prove that if $t \Downarrow v$ (big-step CBV) and $t \Downarrow v'$, then $v = v'$ (determinacy of big-step evaluation). *(Hint: induction on the derivation of $t \Downarrow v$.)*

**Exercise 7.7.** Define big-step semantics for call-by-name evaluation of the pure lambda calculus. Ensure that your rules correctly handle the case where the argument is never evaluated.

**Exercise 7.8.** The **head reduction** strategy reduces only the leftmost redex that is not under a lambda but may be under applications. Define the evaluation rules for head reduction and show that it is deterministic.

**Exercise 7.9.** Prove that the multi-step relation $\to^*$ is a preorder (reflexive and transitive) by showing that:
- $t \to^* t$ for all $t$ (reflexivity).
- If $t \to^* t'$ and $t' \to^* t''$, then $t \to^* t''$ (transitivity).

**Exercise 7.10.** The omega-3 combinator $\omega_3 = \lambda x.\, x\; x\; x$ satisfies $\omega_3\; \omega_3 \to_\beta \omega_3\; \omega_3\; \omega_3$. Show that the reduction sequence starting from $\omega_3\; \omega_3$ produces terms of unbounded size. Conclude that strong normalization fails for the untyped lambda calculus.

---

## Summary

This lecture developed the operational semantics of the lambda calculus:

1. **Full beta-reduction** is non-deterministic; restricting where reduction can occur yields deterministic **evaluation strategies**.
2. **Call-by-value** evaluates arguments before substitution; **call-by-name** substitutes unevaluated arguments; **call-by-need** combines the termination benefits of CBN with the efficiency of CBV through memoization.
3. Normal forms come in several varieties: **beta-normal form** (no redexes anywhere), **head normal form** (no redex in head position), **weak head normal form** (top-level lambda or neutral application).
4. The **Church-Rosser theorem** guarantees that beta-reduction is confluent: different reduction orders lead to the same normal form (if one exists). This makes the normal form a well-defined "meaning" for each term.
5. The untyped lambda calculus is neither weakly nor strongly normalizing in general, but the standardization theorem guarantees that call-by-name finds a normal form whenever one exists.
6. **Big-step semantics** relates terms directly to their final values, complementing the step-by-step view of small-step semantics. Both describe the same evaluation.

---

## Appendix: Complete Evaluation Rules Reference

For reference, we collect all evaluation rules defined in this lecture.

### A.1 Full Beta-Reduction

$$
\frac{}{(\lambda x.\, t)\; s \to [x \mapsto s]\, t} \quad \text{(E-Beta)}
$$

$$
\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)} \qquad \frac{t_2 \to t_2'}{t_1\; t_2 \to t_1\; t_2'} \quad \text{(E-App2)}
$$

$$
\frac{t \to t'}{\lambda x.\, t \to \lambda x.\, t'} \quad \text{(E-Abs)}
$$

### A.2 Call-by-Value

Values: $v ::= \lambda x.\, t$

$$
\frac{}{(\lambda x.\, t)\; v \to [x \mapsto v]\, t} \quad \text{(E-BetaV)}
$$

$$
\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)} \qquad \frac{t_2 \to t_2'}{v\; t_2 \to v\; t_2'} \quad \text{(E-App2V)}
$$

### A.3 Call-by-Name

$$
\frac{}{(\lambda x.\, t)\; s \to [x \mapsto s]\, t} \quad \text{(E-BetaN)}
$$

$$
\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2} \quad \text{(E-App1)}
$$

### A.4 Big-Step CBV

$$
\frac{}{\lambda x.\, t \Downarrow \lambda x.\, t} \quad \text{(B-Value)}
$$

$$
\frac{t_1 \Downarrow \lambda x.\, t \quad t_2 \Downarrow v_2 \quad [x \mapsto v_2]\, t \Downarrow v}{t_1\; t_2 \Downarrow v} \quad \text{(B-App)}
$$

### A.5 Evaluation Contexts

CBV: $E ::= [\cdot] \mid E\; t \mid v\; E$

CBN: $E ::= [\cdot] \mid E\; t$

Full: $E ::= [\cdot] \mid E\; t \mid t\; E \mid \lambda x.\, E$

### A.6 Summary of Normal Form Variants

| Notion | Definition | Used by |
|--------|-----------|---------|
| Beta-normal form | No beta-redex anywhere | Full beta-reduction |
| Head normal form | $\lambda x_1 \ldots x_n.\, y\; t_1 \ldots t_m$ | Head reduction |
| Weak head normal form | Lambda abstraction or neutral application $x\; t_1 \ldots t_m$ | CBN, CBV, Haskell |

### A.7 Key Metatheoretic Results

| Result | Statement |
|--------|-----------|
| Determinacy of CBV | If $t \to_{cbv} t'$ and $t \to_{cbv} t''$, then $t' = t''$ |
| Determinacy of CBN | If $t \to_{cbn} t'$ and $t \to_{cbn} t''$, then $t' = t''$ |
| Church-Rosser | If $t \twoheadrightarrow t_1$ and $t \twoheadrightarrow t_2$, then $\exists t_3$ with $t_1 \twoheadrightarrow t_3$ and $t_2 \twoheadrightarrow t_3$ |
| Uniqueness of NF | If $t \twoheadrightarrow u$ and $t \twoheadrightarrow u'$ with $u, u'$ normal, then $u =_\alpha u'$ |
| Standardization | If $t$ has a NF, leftmost-outermost reduction finds it |
| Progress (closed, CBV) | If $t$ is closed, then $t$ is a value or $t \to_{cbv} t'$ |
| Small-step/big-step equiv. | $t \to^*_{cbv} v$ iff $t \Downarrow v$ |

---

## Further Reading

- **Pierce, B. C.** *Types and Programming Languages* (2002), Chapters 3-5. Small-step and big-step semantics for arithmetic expressions and the lambda calculus.
- **Plotkin, G. D.** "Call-by-Name, Call-by-Value, and the Lambda Calculus" (1975). The foundational paper on evaluation strategies for the lambda calculus.
- **Barendregt, H. P.** *The Lambda Calculus: Its Syntax and Semantics* (1984), Chapter 3. The Church-Rosser theorem with full proof.
- **Takahashi, M.** "Parallel Reductions in Lambda-Calculus" (1995). A clean proof of the Church-Rosser theorem using the Tait-Martin-Lof method of parallel reduction.
- **Kahn, G.** "Natural Semantics" (1987). The original paper on big-step (natural) semantics.
- **Curry, H. B. and Feys, R.** *Combinatory Logic, Volume I* (1958). The standardization theorem.
- **Sestoft, P.** "Demonstrating Lambda Calculus Reduction" (2002). Practical algorithms for implementing various lambda calculus reduction strategies.
- **Ariola, Z. M. and Felleisen, M.** "The Call-by-Need Lambda Calculus" (1997). Formal foundations of lazy evaluation.
- **Winskel, G.** *The Formal Semantics of Programming Languages* (1993). A comprehensive introduction to operational, denotational, and axiomatic semantics.
