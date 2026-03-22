# Homework 06: Advanced Set Theory

> **Module 06 --- Advanced ZF: Constructibility & Forcing**
> **Due:** Two weeks after assignment
> **Estimated time:** ~20 hours
> **Total points:** 200

---

## Instructions

- Show all work for theory problems. A correct answer without justification receives no credit.
- For proofs, state clearly what you are assuming and what you are proving.
- For Isabelle problems, submit your `.thy` files. Proofs must check without errors (no `sorry`).
- You may consult Paulson (2003), Kunen (2011), and Jech (2003). Cite any additional sources.
- Collaboration policy: you may discuss ideas with classmates, but write up all solutions independently.

---

## Part A: Theory (100 points)

### Problem A1: The Constructible Hierarchy (20 pts)

**(a)** (5 pts) Compute $L_4$ explicitly. List all its elements and verify $|L_4| = 14$.

**(b)** (5 pts) Prove that $L_\omega = V_\omega$ (i.e., the hereditarily finite sets are all constructible). *Hint:* show by induction on $n$ that $L_n = V_n$ for all $n < \omega$.

**(c)** (5 pts) Let $A$ be a countably infinite set. Show that $|\mathrm{Def}(A)| = \aleph_0$. Conclude that $|L_{\omega+1}| = \aleph_0$.

**(d)** (5 pts) Show that $|L_{\omega_1}| = \aleph_1$. *Hint:* use the fact that $|L_\alpha| = |\alpha|$ for infinite ordinals $\alpha$, and prove this by transfinite induction.

### Problem A2: Absoluteness Classification (20 pts)

**(a)** (10 pts) For each of the following formulas, classify it as $\Delta_0$, $\Sigma_1$, $\Pi_1$, or none, and prove your classification:

1. "$x$ is a transitive set": $\forall u \in x.\, \forall v \in u.\, v \in x$
2. "$f$ is a surjection from $A$ onto $B$": $\forall y \in B.\, \exists x \in A.\, \langle x, y \rangle \in f$
3. "$x$ is countable": $\exists f.\, f : \omega \twoheadrightarrow x$
4. "$\alpha$ is a limit ordinal": $\mathrm{Ord}(\alpha) \wedge \alpha \ne 0 \wedge \forall \beta \in \alpha.\, \beta + 1 \in \alpha$
5. "$x$ is well-orderable": $\exists R.\, R \text{ well-orders } x$

**(b)** (10 pts) Let $M$ be a countable transitive model of ZF. Give a concrete example of a set $x \in M$ such that $x$ is countable in $V$ but uncountable in $M$. Explain why countability is not absolute.

### Problem A3: Separation and Internalized Formulas (25 pts)

**(a)** (10 pts) Using de Bruijn indices, write the internal formula corresponding to "$x$ is a subset of $y$" (i.e., $\forall u.\, u \in x \to u \in y$). Use the constructors `Member`, `Nand`, and `Forall`. Verify your formula by computing $\mathrm{sats}(A, [a, b], p)$ for a small example.

**(b)** (10 pts) Explain why the separation axiom schema cannot be replaced by a single axiom in first-order logic. How does this relate to the need for multiple separation instances in Paulson's formalization?

**(c)** (5 pts) Paulson's formalization uses approximately 70 separation instances. Describe a plausible strategy for reducing this number by 50% while maintaining the same final theorem. What are the tradeoffs in proof development effort vs. proof structure?

### Problem A4: Forcing Basics (35 pts)

**(a)** (10 pts) Let $\mathbb{P} = (\mathrm{Fn}(\omega \times \omega, 2), \supseteq)$ be the poset of finite partial functions from $\omega \times \omega$ to $\{0, 1\}$. Prove that $\mathbb{P}$ satisfies the countable chain condition (ccc): every antichain in $\mathbb{P}$ is countable. *Hint:* use the Delta-system lemma.

**(b)** (10 pts) Let $M$ be a ctm and $\mathbb{P} \in M$. Prove the Rasiowa-Sikorski lemma: for any $p \in \mathbb{P}$, there exists an $M$-generic filter $G$ containing $p$. (Write a complete proof, not just a sketch.)

**(c)** (5 pts) Explain why $G \notin M$ when $\mathbb{P}$ is a nontrivial forcing poset (one that adds new sets). *Hint:* consider the dense set $\{p \in \mathbb{P} \mid p \notin G\}$.

**(d)** (10 pts) In Cohen forcing for the independence of CH, we use $\mathbb{P} = \mathrm{Fn}(\omega_2 \times \omega, 2)$. Show that for distinct $\alpha, \beta < \omega_2$, the generic reals $r_\alpha$ and $r_\beta$ are distinct. Write out the dense set argument explicitly.

---

## Part B: Isabelle (100 points)

### Problem B1: Internalized Formulas (25 pts)

In a new Isabelle/ZF theory that imports `Constructible/Formula`:

**(a)** (10 pts) Define an internalized formula `subset_fm(x, y)` representing "$\mathrm{var}(x) \subseteq \mathrm{var}(y)$" using the basic constructors. Prove that your formula has the correct arity.

**(b)** (15 pts) Prove a satisfaction lemma for your formula:

```isabelle
lemma sats_subset_fm:
  "[| x \<in> nat; y \<in> nat; env \<in> list(A) ;
      x < length(env); y < length(env) |]
   ==> sats(A, env, subset_fm(x, y)) \<longleftrightarrow>
       nth(x, env) \<subseteq> nth(y, env)"
```

### Problem B2: Absoluteness Proofs (25 pts)

Working in the context of the locale `M_trivial`:

**(a)** (10 pts) Prove that the intersection operation is absolute: if $M(A)$ and $M(z)$, then $z = \bigcap A$ in the standard sense iff $z$ satisfies the relativized intersection predicate.

**(b)** (15 pts) Prove that the transitive closure operation `trcl` is absolute for transitive models. You may assume the relevant closure properties of $M$. State your assumptions clearly.

### Problem B3: Exploring the Constructible Session (25 pts)

**(a)** (10 pts) In `L_axioms.thy`, find the theorem asserting that the union axiom holds in $L$. Copy its statement and list all lemmas it directly invokes in its proof.

**(b)** (15 pts) In `AC_in_L.thy`, find the final theorem `choice_ax(L)`. Trace its proof backward to identify the three most important intermediate lemmas. For each, state the lemma and explain its role in one sentence.

### Problem B4: A New Absoluteness Result (25 pts)

**(a)** (25 pts) Prove in Isabelle that the "is an ordinal" predicate is absolute for transitive models. Specifically, define:

```isabelle
definition
  is_ordinal :: "[i => o, i] => o" where
  "is_ordinal(M, x) == transitive_set(M, x) &
    (\<forall>y[M]. y \<in> x \<longrightarrow> transitive_set(M, y))"
```

and prove:

```isabelle
lemma (in M_trivial) ordinal_abs:
  "M(x) ==> is_ordinal(M, x) \<longleftrightarrow> Ord(x)"
```

You will need to define `transitive_set(M, x)` if it is not already available, and prove its absoluteness as an intermediate step.

---

## References

- Paulson, L.C. (2003). The relative consistency of the axiom of choice --- mechanized using Isabelle/ZF.
- Kunen, K. (2011). *Set Theory*. Chapters IV and VII.
- Jech, T. (2003). *Set Theory*. Chapters 12--14.
- Cohen, P.J. (1966). *Set Theory and the Continuum Hypothesis*.
