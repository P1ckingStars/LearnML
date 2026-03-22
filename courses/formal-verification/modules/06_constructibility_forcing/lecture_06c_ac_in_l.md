# Lecture 06c: AC Holds in L

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **State** the main theorem: $V = L$ implies AC (and GCH), hence Con(ZF) implies Con(ZFC + GCH).
2. **Outline** the strategy: well-ordering $L$ via the definable powerset construction.
3. **Describe** how each ZF axiom is verified for $L$ in Paulson's formalization, focusing on the powerset and replacement axioms.
4. **Explain** the role of separation instances and why they constitute the technical heart of the proof.
5. **Navigate** the theory files `L_axioms.thy`, `Separation.thy`, and `AC_in_L.thy`.

---

## 2. The Main Theorem

### 2.1 Statement

**Theorem 2.1 (Godel, 1938--1940).** If ZF is consistent, then ZFC + GCH is consistent. Formally:

$$\mathrm{Con}(\mathrm{ZF}) \implies \mathrm{Con}(\mathrm{ZFC} + \mathrm{GCH})$$

The proof proceeds by showing that $L$, the constructible universe, is an inner model of ZF that additionally satisfies AC and GCH. Since $L$ is definable within ZF, any contradiction from ZFC + GCH would yield a contradiction in ZF alone.

### 2.2 V = L

The statement $V = L$ ("every set is constructible") is the axiom asserting:

$$\forall x.\, \exists \alpha.\, \mathrm{Ord}(\alpha) \wedge x \in L_\alpha$$

This is not provable from ZF (unless ZF is inconsistent), but it holds *relativized to $L$*: within $L$, every set is constructible. The key insight is that $L$ is *absolute*: $L^L = L$.

### 2.3 Strategy: Well-Ordering L

To prove AC in $L$, we construct a well-ordering of $L$. Each set $x \in L$ first appears at some level $L_{\alpha+1} = \mathrm{Def}(L_\alpha)$, determined by a formula $p$ and parameters from $L_\alpha$. We can order sets by:

1. First, by the ordinal $\alpha$ at which they first appear.
2. Then, by the Godel number of the defining formula $p$.
3. Then, by the parameters (ordered recursively).

Since ordinals are well-ordered, Godel numbers are natural numbers (hence well-ordered), and parameters come from earlier levels (well-ordered by induction), this gives a well-ordering of all of $L$.

---

## 3. L Satisfies the ZF Axioms

### 3.1 Overview

The ZF axioms that must be verified for $L$ are:

| Axiom | Difficulty | Key issue |
|---|---|---|
| Extensionality | Trivial | $L$ is a transitive class |
| Foundation | Trivial | Inherited from $V$ |
| Empty set | Easy | $\emptyset \in L_1$ |
| Pairing | Easy | $\{a, b\}$ is definable |
| Union | Easy | $\bigcup A$ is definable |
| Infinity | Easy | $\omega \in L_{\omega+1}$ |
| Separation | Hard | Each instance needs a formula absoluteness proof |
| Replacement | Hard | Uses the Reflection Theorem |
| Powerset | Subtle | $\mathcal{P}^L(x) \ne \mathcal{P}(x)$ in general |

### 3.2 The Easy Axioms

**Extensionality.** Since $L$ is a transitive class, if $x, y \in L$ have the same elements (even considering all of $V$), they have the same elements in $L$. By extensionality in $V$, $x = y$.

**Foundation.** If $A \in L$ is nonempty, foundation in $V$ gives an $\in$-minimal element $x \in A$. Since $L$ is transitive, $x \in L$, and the minimality property relativizes because $\in$ is absolute.

**Pairing.** Given $a, b \in L_\alpha$, the set $\{a, b\}$ is definable over $L_\alpha$ (using parameters $a$ and $b$ with the formula $x = a \lor x = b$), so $\{a, b\} \in L_{\alpha+1} \subseteq L$.

**Union.** Given $A \in L_\alpha$, we have $\bigcup A \subseteq L_\alpha$ by transitivity. The set $\bigcup A = \{x \in L_\alpha \mid \exists y \in L_\alpha.\, x \in y \wedge y \in A\}$ is definable over $L_\alpha$, so $\bigcup A \in L_{\alpha+1}$.

**Infinity.** Each natural number $n$ is constructible (provable by induction: $0 = \emptyset \in L_1$, and if $n \in L_k$ then $n+1 = n \cup \{n\} \in L_{k+1}$). Thus $\omega \subseteq L_\omega$. Since $\omega$ is definable over $L_\omega$ as "the smallest inductive set," $\omega \in L_{\omega+1}$.

### 3.3 The Powerset Axiom

The powerset axiom in $L$ states: for every $x \in L$, there exists $z \in L$ such that $z$ contains all *constructible* subsets of $x$. Formally:

$$\forall x \in L.\, \exists z \in L.\, \forall u \in L.\, u \subseteq x \to u \in z$$

The set $z$ is $\mathcal{P}^L(x) = \{u \in L \mid u \subseteq x\}$, which collects only the constructible subsets of $x$. This may be strictly smaller than $\mathcal{P}(x)$.

**Key argument.** If $x \in L_\alpha$, then every constructible subset $u \subseteq x$ appears at some level $L_{\beta+1}$ for $\beta < |L_\alpha|^+ $ (a cardinal bound). The set of all such $u$ is bounded by some $L_\gamma$, and is definable over $L_\gamma$, hence belongs to $L_{\gamma+1}$.

In Isabelle, this is among the most involved arguments. The theory `L_axioms.thy` contains:

```isabelle
theorem power_ax: "power_ax(L)"
```

The proof invokes the condensation lemma and a careful analysis of definability ranks.

### 3.4 The Replacement Axiom

Replacement in $L$ states: if $F$ is a class function definable in $L$ and $A \in L$, then $F[A] = \{F(x) \mid x \in A\}$ is a set in $L$ (assuming $F[A] \subseteq L$).

The proof uses the Reflection Theorem (Lecture 06b): given $A \in L_\alpha$, reflect the defining formula for $F$ to find $L_\beta \supseteq L_\alpha$ that reflects $F$'s definition. Then $F[A] \subseteq L_\beta$, and since $F[A]$ is definable over $L_\beta$ (using the reflected formula), $F[A] \in L_{\beta+1}$.

---

## 4. Separation Instances: The Technical Heart

### 4.1 The Challenge

The separation axiom schema has infinitely many instances --- one for each first-order formula $\varphi$. To show that separation holds in $L$, we must show that for each $\varphi$, the set $\{x \in A \mid L \models \varphi(x, \bar{p})\}$ belongs to $L$ whenever $A, \bar{p} \in L$.

In a pen-and-paper proof, this is handled by a meta-theoretic argument: for each $\varphi$, the separating formula has an internal representation (Godel number) that can be used within the constructible hierarchy. But in Isabelle, we must provide a concrete internal formula for each separation instance.

### 4.2 Paulson's Approach

Paulson's formalization identifies the specific separation instances needed for the proofs of the ZF axioms in $L$. Each instance requires:

1. An internalized formula $p \in \mathrm{formula}$ corresponding to the separating property.
2. A proof that $p$'s satisfaction relation agrees with the meta-level property (the *absoluteness* of $p$).
3. An arity bound on $p$.

The relevant theories are:

| Theory | Content |
|---|---|
| `Separation.thy` | Basic separation instances (pairs, unions, domains, etc.) |
| `Rec_Separation.thy` | Separation instances for recursive definitions |
| `Rank_Separation.thy` | Separation instances involving ordinal ranks |

### 4.3 A Concrete Separation Instance

Consider the separation instance needed for the domain operation: given $r \in L$, we need $\mathrm{dom}(r) = \{x \in \bigcup\bigcup r \mid \exists y.\, \langle x, y \rangle \in r\} \in L$.

The separating property is $\exists y.\, \langle x, y \rangle \in r$. Paulson provides:

```isabelle
lemma domain_separation:
  "[| L(r) |] ==> separation(L, \<lambda>x. \<exists>y[L]. pair(L, x, y, z) & z \<in> r)"
```

The proof constructs the internal formula for "there exist $y$ and $z$ in $L$ such that $z$ is the ordered pair of $x$ and $y$, and $z \in r$," proves its absoluteness, and applies the generic separation machinery.

### 4.4 Counting the Instances

Paulson's formalization requires approximately **70 separation instances**. Each is a separate lemma with a non-trivial proof. This is the single largest source of proof effort in the formalization, accounting for a significant fraction of the total line count.

In `Separation.thy`:

```isabelle
lemma empty_separation: "separation(L, \<lambda>x. False)"
lemma Un_separation: "[| L(B) |] ==> separation(L, \<lambda>x. x \<in> B)"
lemma Diff_separation: "[| L(B) |] ==> separation(L, \<lambda>x. x \<notin> B)"
lemma cartprod_separation:
  "[| L(A); L(B) |] ==>
   separation(L, \<lambda>z. \<exists>x[L]. x \<in> A & (\<exists>y[L]. y \<in> B & pair(L,x,y,z)))"
```

### 4.5 Well-Founded Recursion Absoluteness

Several separation instances involve well-founded recursion (e.g., the rank function, transitive closure). The theories `WF_absolute.thy` and `WFrec.thy` establish that well-founded recursion is absolute for $L$:

```isabelle
theorem wf_abs:
  assumes "M(r)" and "wf(r)"
  shows "wellfounded(M, r)"
```

This is delicate because well-foundedness is $\Pi_1$ and not automatically absolute. The proof exploits the specific structure of the well-founded relations used in the constructibility proof (they are all set-like, which gives a stronger absoluteness result).

---

## 5. The Axiom of Choice in L

### 5.1 AC_in_L.thy

The culminating theorem is proved in `AC_in_L.thy`:

```isabelle
theorem L_satisfies_AC:
  "choice_ax(L)"
```

The proof proceeds via the well-ordering principle (equivalent to AC). As outlined in Section 2.3, every element of $L$ can be well-ordered by its "birthday" (the ordinal at which it first appears) and its defining formula.

### 5.2 GCH in L

The Generalized Continuum Hypothesis also holds in $L$:

$$L \models \forall \kappa.\, 2^\kappa = \kappa^+$$

The key is the *condensation lemma*: every subset of $\omega$ that belongs to $L$ appears by level $L_{\omega_1}$, and $|L_{\omega_1}| = \aleph_1$. So $|\mathcal{P}^L(\omega)| = \aleph_1$. The argument generalizes to arbitrary infinite cardinals.

---

## 6. Paulson's Reflections on the Formalization

### 6.1 Scale of the Effort

Paulson's formalization of Con(ZF) implies Con(ZFC) comprises approximately 12,500 lines of Isabelle proof across the `Constructible` session. Key statistics:

- `Formula.thy` + `Satisfies.thy`: ~2,000 lines (internalized logic).
- `Relative.thy`: ~1,500 lines (relativized concepts and absoluteness).
- `Separation.thy` + `Rec_Separation.thy` + `Rank_Separation.thy`: ~4,000 lines (separation instances).
- `L_axioms.thy` + `AC_in_L.thy`: ~2,000 lines (the main theorems).

### 6.2 Lessons Learned

Paulson noted several key lessons:

1. **Separation instances dominate the effort.** The mathematical content of each instance is straightforward, but the formalization overhead --- constructing internal formulas, managing de Bruijn indices, proving arity bounds --- is substantial.

2. **De Bruijn indices are error-prone.** Index arithmetic is tedious and a major source of bugs. Paulson developed specialized tactics to automate index management.

3. **The proof is inherently schematic.** In principle, one could write a verified program that generates separation instances automatically. Paulson chose to enumerate them explicitly, trading development time for confidence.

4. **Isabelle/ZF vs. Isabelle/HOL.** The formalization is in Isabelle/ZF because the mathematics is inherently set-theoretic. The lack of types in ZF makes some proofs harder (no type-based automation) but the set-theoretic reasoning is more natural.

---

## 7. What the Proof Tells Us

### 7.1 The Relative Consistency Chain

The complete picture is:

$$\mathrm{Con}(\mathrm{ZF}) \implies \mathrm{Con}(\mathrm{ZFC}) \implies \mathrm{Con}(\mathrm{ZFC} + \mathrm{GCH})$$

The first implication follows because $L$ is a model of ZFC within any model of ZF. The second follows because $L$ also satisfies GCH.

### 7.2 What It Does Not Tell Us

1. **AC is not provable from ZF.** Godel's result shows AC is *consistent* with ZF, not that it follows. Cohen's forcing (Lecture 06d) shows ZF + $\neg$AC is also consistent.

2. **V = L is a strong assumption.** Most set theorists do not assume $V = L$ because it rules out large cardinals (measurable cardinals are inconsistent with $V = L$). The constructible universe is "too thin."

3. **The proof is about relative consistency, not truth.** We have not shown that ZF is consistent (that would contradict Godel's Second Incompleteness Theorem).

---

## 8. Key Takeaways

1. $L$ satisfies all ZF axioms, which is proved by verifying each axiom relativized to $L$ using absoluteness results.
2. The powerset axiom is the most subtle: $\mathcal{P}^L(x)$ collects only constructible subsets, and showing this set exists in $L$ requires condensation.
3. Separation instances constitute the bulk of the formalization effort: approximately 70 instances, each requiring an internal formula and an absoluteness proof.
4. AC holds in $L$ because $L$ can be well-ordered via constructibility rank, defining formula, and parameters.
5. The complete result is Con(ZF) implies Con(ZFC + GCH).

---

## 9. Exercises

**Exercise 6c.1.** Explain why the pairing axiom is "easy" for $L$ but the powerset axiom is "subtle." What goes wrong if you try the same argument for powerset?

**Exercise 6c.2.** The condensation lemma states that every constructible subset of $\omega$ appears before $L_{\omega_1}$. Why does this imply $|\mathcal{P}^L(\omega)| = \aleph_1$?

**Exercise 6c.3.** How many separation instances does Paulson's formalization require? Why can this number not be reduced to a single generic lemma in Isabelle?

**Exercise 6c.4.** In Isabelle, locate `AC_in_L.thy` and find the statement of `choice_ax(L)`. What are its direct dependencies?

**Exercise 6c.5.** Explain why $V = L$ is inconsistent with the existence of a measurable cardinal. (Hint: Scott's theorem.)

---

## References

- Paulson, L.C. (2003). The relative consistency of the axiom of choice --- mechanized using Isabelle/ZF. *LMS J. Comput. Math.*, 6, 198--248.
- Godel, K. (1940). *The Consistency of the Axiom of Choice and of the Generalized Continuum Hypothesis*. Annals of Mathematics Studies.
- Kunen, K. (2011). *Set Theory*. Chapter VI: Constructibility.
- Scott, D. (1961). Measurable cardinals and constructible sets. *Bull. Acad. Polon. Sci.*, 9, 521--524.
