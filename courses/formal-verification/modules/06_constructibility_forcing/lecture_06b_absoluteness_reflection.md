# Lecture 06b: Absoluteness and the Reflection Theorem

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** relativization of a formula to a class $M$ and state when a concept is absolute for $M$.
2. **Classify** formulas as $\Delta_0$, $\Sigma_1$, or $\Pi_1$ and state their absoluteness properties.
3. **Navigate** `Relative.thy` and explain the locale `M_trivial` and its relativized operations.
4. **State** the Reflection Theorem and explain its role in the constructibility proof.
5. **Verify** absoluteness results for specific set-theoretic concepts: ordered pairs, functions, ordinals, natural numbers.

---

## 2. Relativization

### 2.1 The Core Idea

Given a class $M$ (a definable collection of sets, possibly proper), we can *relativize* any set-theoretic statement $\varphi$ to $M$ by restricting all quantifiers to range over $M$. The relativized formula $\varphi^M$ replaces:

- $\forall x.\, \psi$ with $\forall x.\, x \in M \to \psi^M$
- $\exists x.\, \psi$ with $\exists x.\, x \in M \wedge \psi^M$

**Definition 2.1 (Relativization).** For a formula $\varphi$ and a class $M$, the *relativization* $\varphi^M$ is defined recursively:

$$(\forall x.\, \psi)^M = \forall x \in M.\, \psi^M$$
$$(\exists x.\, \psi)^M = \exists x \in M.\, \psi^M$$
$$(x \in y)^M = x \in y$$
$$(x = y)^M = x = y$$
$$(\neg \psi)^M = \neg(\psi^M)$$
$$(\psi \wedge \chi)^M = \psi^M \wedge \chi^M$$

**Example.** The formula expressing "there exists an empty set":

$$\exists z.\, \forall u.\, u \notin z$$

relativizes to $M$ as:

$$\exists z \in M.\, \forall u \in M.\, u \notin z$$

This says "$M$ thinks there is an empty set" --- i.e., there is an element of $M$ that $M$ sees as empty. Note that $z$ might have elements outside $M$; the relativized formula only checks membership for elements of $M$.

### 2.2 Relativized Concepts

For each set-theoretic concept, we define a *relativized* version parameterized by a class predicate $M$.

**Definition 2.2.** For a class predicate $M : i \Rightarrow o$:

| Concept | Standard | Relativized to $M$ |
|---|---|---|
| Empty set | $z = \emptyset$ | $\forall u \in M.\, u \notin z$ |
| Pair | $z = \{a, b\}$ | $\forall u \in M.\, u \in z \leftrightarrow (u = a \lor u = b)$ |
| Union | $z = \bigcup A$ | $\forall u \in M.\, u \in z \leftrightarrow (\exists v \in M.\, u \in v \wedge v \in A)$ |
| Powerset | $z = \mathcal{P}(A)$ | $\forall u \in M.\, u \in z \leftrightarrow u \subseteq A$ |
| Ordinal | $\mathrm{Ord}(\alpha)$ | $\mathrm{Transset}^M(\alpha) \wedge (\forall \beta \in M.\, \beta \in \alpha \to \mathrm{Transset}^M(\beta))$ |

---

## 3. Absoluteness

### 3.1 Definition

**Definition 3.1 (Absoluteness).** A formula $\varphi(x_1, \ldots, x_n)$ is *absolute for a class $M$* if for all $a_1, \ldots, a_n \in M$:

$$\varphi^M(a_1, \ldots, a_n) \iff \varphi(a_1, \ldots, a_n)$$

Equivalently, $M$ and $V$ agree on the truth value of $\varphi$ for elements of $M$.

A set-theoretic *operation* $F(x_1, \ldots, x_n)$ is *absolute for $M$* if for all $a_1, \ldots, a_n \in M$ with $F(a_1, \ldots, a_n) \in M$:

$$F^M(a_1, \ldots, a_n) = F(a_1, \ldots, a_n)$$

### 3.2 Why Absoluteness Matters for L

To show that $L$ satisfies ZF, we need to verify each axiom *relativized to $L$*. For example, the pairing axiom says $\forall a, b.\, \exists z.\, z = \{a, b\}$. Relativized to $L$:

$$\forall a \in L.\, \forall b \in L.\, \exists z \in L.\, z = \{a, b\}^L$$

This requires two things: (1) $\{a, b\}$ exists in $L$ (closure), and (2) the concept of "unordered pair" is absolute for $L$ (so $\{a, b\}^L = \{a, b\}$).

### 3.3 The Levy Hierarchy

**Definition 3.3 ($\Delta_0$ formulas).** A formula is $\Delta_0$ (or *bounded*) if all quantifiers are bounded: $\forall x \in y$ or $\exists x \in y$ for some set variable $y$. Atomic formulas ($x \in y$, $x = y$) are $\Delta_0$, and $\Delta_0$ is closed under boolean connectives and bounded quantifiers.

**Definition 3.4 ($\Sigma_1$ and $\Pi_1$ formulas).**
- A formula is $\Sigma_1$ if it has the form $\exists x_1 \cdots \exists x_n.\, \psi$ where $\psi$ is $\Delta_0$.
- A formula is $\Pi_1$ if it has the form $\forall x_1 \cdots \forall x_n.\, \psi$ where $\psi$ is $\Delta_0$.

**Theorem 3.5 ($\Delta_0$ Absoluteness).** If $M$ is a transitive class and $\varphi$ is $\Delta_0$, then $\varphi$ is absolute for $M$.

*Proof.* By induction on the structure of $\varphi$.

- *Atomic*: $x \in y$ and $x = y$ are absolute since membership and equality are independent of the ambient universe.
- *Boolean connectives*: if $\psi^M \iff \psi$ and $\chi^M \iff \chi$, then $(\neg \psi)^M \iff \neg(\psi^M) \iff \neg \psi$ and $(\psi \wedge \chi)^M \iff \psi^M \wedge \chi^M \iff \psi \wedge \chi$.
- *Bounded quantifier* $\forall x \in y.\, \psi(x)$: the relativization is $\forall x \in M.\, x \in y \to \psi^M(x)$. Since $M$ is transitive and $y \in M$, every $x \in y$ is in $M$. So this is equivalent to $\forall x \in y.\, \psi(x)$ by the induction hypothesis. $\blacksquare$

**Theorem 3.6 ($\Sigma_1$ Upward Absoluteness).** If $M \subseteq N$ are transitive classes and $\varphi$ is $\Sigma_1$, then:

$$M \models \varphi(a_1, \ldots, a_n) \implies N \models \varphi(a_1, \ldots, a_n)$$

*Proof.* $\varphi = \exists \bar{x}.\, \psi(\bar{x}, \bar{a})$ with $\psi$ being $\Delta_0$. If witnesses $\bar{x}$ exist in $M$, they also exist in $N \supseteq M$, and $\psi$ is absolute by Theorem 3.5. $\blacksquare$

**Theorem 3.7 ($\Pi_1$ Downward Absoluteness).** If $M \subseteq N$ are transitive classes and $\varphi$ is $\Pi_1$, then:

$$N \models \varphi(a_1, \ldots, a_n) \implies M \models \varphi(a_1, \ldots, a_n)$$

---

## 4. Key Absoluteness Results

### 4.1 Ordered Pairs

The Kuratowski ordered pair $\langle a, b \rangle = \{\{a\}, \{a, b\}\}$ is absolute for any transitive model $M$ containing $a$ and $b$. The defining formula uses only bounded quantifiers over the elements of $\{\{a\}, \{a, b\}\}$, making it $\Delta_0$.

### 4.2 Functions and Relations

**Proposition 4.1.** The following concepts are absolute for any transitive model $M$:

1. "$(x, y)$ is an ordered pair" (i.e., $x$ has the Kuratowski form).
2. "$r$ is a relation" ($\forall z \in r.\, \exists x, y.\, z = \langle x, y \rangle$).
3. "$f$ is a function" ($r$ is a relation and $\forall x, y_1, y_2.\, \langle x, y_1 \rangle \in f \wedge \langle x, y_2 \rangle \in f \to y_1 = y_2$).
4. "$y = f(x)$" (application of a function).
5. "$\mathrm{dom}(r) = d$" (domain of a relation).

These all have $\Delta_0$ definitions when the quantifiers are bounded by appropriate sets (using the pair components and elements of $r$).

### 4.3 Natural Numbers and Ordinals

**Proposition 4.2.** The following are absolute for transitive models:

1. "$x$ is a transitive set" ($\forall u \in x.\, u \subseteq x$) --- $\Delta_0$.
2. "$x$ is an ordinal" ($x$ is transitive and well-ordered by $\in$) --- $\Pi_1$ in general, but $\Delta_0$ when restricted to the relevant bounded quantifiers.
3. "$x = \omega$" --- requires more care; absoluteness of $\omega$ follows from the absoluteness of "is an inductive set" and "is the smallest inductive set."

### 4.4 Non-Absolute Concepts

**Proposition 4.3.** The following concepts are *not* absolute:

1. "$y = \mathcal{P}(x)$" (powerset) --- $M$ may be missing subsets of $x$.
2. "$|x| = |y|$" (equicardinality) --- the witnessing bijection may not be in $M$.
3. "$x$ is countable" --- a counting function may exist outside $M$.

The non-absoluteness of the powerset is crucial: $\mathcal{P}^L(x)$ may be strictly smaller than $\mathcal{P}(x)$, which is precisely what allows GCH to hold in $L$.

---

## 5. Relativization in Isabelle: Relative.thy

### 5.1 The Locale M_trivial

Paulson structures the relativized definitions using Isabelle locales. The base locale `M_trivial` assumes $M$ is a class satisfying basic closure conditions:

```isabelle
locale M_trivial =
  fixes M :: "i => o"
  assumes transM: "[| y \<in> x; M(x) |] ==> M(y)"
      and upair_ax: "[| M(a); M(b) |] ==> \<exists>z[M]. upair(M, a, b, z)"
      and Union_ax: "[| M(A) |] ==> \<exists>z[M]. big_union(M, A, z)"
```

Here `\<exists>z[M]` abbreviates `\<exists>z. M(z) \<and> ...`, and `transM` asserts transitivity.

### 5.2 Relativized Operations

Each set-theoretic operation gets a relativized version as a predicate:

```isabelle
definition
  empty :: "[i => o, i] => o" where
  "empty(M, z) == \<forall>x[M]. x \<notin> z"

definition
  upair :: "[i => o, i, i, i] => o" where
  "upair(M, a, b, z) == a \<in> z & b \<in> z & (\<forall>x[M]. x \<in> z \<longrightarrow> x = a | x = b)"

definition
  pair :: "[i => o, i, i, i] => o" where
  "pair(M, a, b, z) == \<exists>x[M]. upair(M, a, a, x) &
                        (\<exists>y[M]. upair(M, a, b, y) & upair(M, x, y, z))"

definition
  big_union :: "[i => o, i, i] => o" where
  "big_union(M, A, z) == \<forall>x[M]. x \<in> z \<longleftrightarrow> (\<exists>y[M]. y \<in> A & x \<in> y)"
```

### 5.3 Absoluteness Lemmas

For each relativized concept, Paulson proves an absoluteness lemma showing it agrees with the standard concept when $M$ is transitive:

```isabelle
lemma (in M_trivial) empty_abs [simp]:
  "M(z) ==> empty(M, z) \<longleftrightarrow> z = 0"

lemma (in M_trivial) upair_abs [simp]:
  "[| M(a); M(b); M(z) |] ==> upair(M, a, b, z) \<longleftrightarrow> z = {a, b}"

lemma (in M_trivial) pair_abs [simp]:
  "[| M(a); M(b); M(z) |] ==> pair(M, a, b, z) \<longleftrightarrow> z = <a, b>"

lemma (in M_trivial) union_abs [simp]:
  "[| M(A); M(z) |] ==> big_union(M, A, z) \<longleftrightarrow> z = \<Union>(A)"
```

These `[simp]` annotations register the lemmas as simplification rules, enabling automated reasoning.

---

## 6. The Reflection Theorem

### 6.1 Statement

The Reflection Theorem is a fundamental tool for constructing models and proving absoluteness. Informally, it states that for any finite set of formulas, there exist arbitrarily large levels of the cumulative hierarchy that "reflect" those formulas.

**Theorem 6.1 (Reflection Theorem, Montague--Levy).** Let $\varphi_1, \ldots, \varphi_n$ be first-order formulas in the language of set theory. For every ordinal $\alpha$, there exists an ordinal $\beta > \alpha$ such that for all $a_1, \ldots, a_k \in V_\beta$ and all $i \in \{1, \ldots, n\}$:

$$V_\beta \models \varphi_i(a_1, \ldots, a_k) \iff \varphi_i(a_1, \ldots, a_k)$$

That is, $V_\beta$ *reflects* the formulas $\varphi_1, \ldots, \varphi_n$: truth in $V_\beta$ coincides with truth in $V$ for these formulas.

### 6.2 Normal Functions

The proof of the Reflection Theorem uses *normal functions* on ordinals. These are defined in `Normal.thy`.

**Definition 6.2 (Normal function).** A class function $F : \mathrm{Ord} \to \mathrm{Ord}$ is *normal* if:

1. $F$ is strictly increasing: $\alpha < \beta \implies F(\alpha) < F(\beta)$.
2. $F$ is continuous at limits: $F(\lambda) = \sup_{\beta < \lambda} F(\beta)$ for limit $\lambda$.

**Proposition 6.3 (Fixed points of normal functions).** Every normal function has a proper class of fixed points. Moreover, the function enumerating the fixed points is itself normal.

In Isabelle:

```isabelle
definition
  normalize :: "[i => i, i] => i" where
  "normalize(F, x) == transrec(x, %i r. F(\<Union>j \<in> i. succ(r`j)))"
```

### 6.3 Proof Sketch of Reflection

For a single formula $\varphi(x_1, \ldots, x_k)$, define for each ordinal $\alpha$:

$$C_\varphi(\alpha) = \text{least } \beta \ge \alpha \text{ such that for all } a_1, \ldots, a_k \in V_\alpha,$$
$$\text{if } \exists x.\, \psi(x, a_1, \ldots, a_k) \text{ then } \exists x \in V_\beta.\, \psi(x, a_1, \ldots, a_k)$$

for each existential subformula $\exists x.\, \psi$ of $\varphi$. The function $C_\varphi$ is normal (or can be made normal by composing with a normal function). Its fixed points $\beta$ satisfy $V_\beta \models \varphi(\bar{a}) \iff \varphi(\bar{a})$ for $\bar{a} \in V_\beta$.

For finitely many formulas, take the intersection of the fixed point classes (which is still a proper class, being the intersection of finitely many clubs).

### 6.4 Reflection in the Constructibility Proof

In the context of $L$, the Reflection Theorem is applied to the constructible hierarchy $L_\alpha$ rather than $V_\alpha$. The key consequence is:

**Corollary 6.4.** For any first-order sentence $\sigma$, if $L \models \sigma$ then there exist unboundedly many ordinals $\alpha$ with $L_\alpha \models \sigma$.

This is essential for proving that replacement holds in $L$: given a class function $F$ definable in $L$, the image of a set under $F$ must be bounded, which reflection helps establish.

---

## 7. Reflection in Isabelle

In `Reflection.thy`, Paulson formalizes the Reflection Theorem for the constructible hierarchy:

```isabelle
theorem Reflection_L:
  assumes
    "L_reflecting(p)"
    "Ord(i)"
  shows
    "\<exists>j. i < j \<and> Ord(j) \<and>
         (\<forall>env \<in> list(Lset(j)).
           sats(Lset(j), env, p) \<longleftrightarrow> sats(L, env, p))"
```

The predicate `L_reflecting(p)` encodes that $p$ satisfies the conditions needed for the reflection argument: there exists an $L_j$ (with $j$ above any given ordinal $i$) in which $p$ has the same truth value as in the full class $L$. The proof follows the outline of Section 6.3, formalized using normal functions and their fixed-point properties from `Normal.thy`.

**Note:** The actual theorem in Paulson's `Reflection.thy` is stated within a locale and uses the `Reflects` predicate. The version above is a simplified statement capturing the essential content.

---

## 8. Putting It Together

The absoluteness and reflection machinery serves the following roles in the constructibility proof:

1. **Absoluteness** ensures that relativized concepts in $L$ agree with their standard meanings. This is needed to show that $L$ satisfies ZF axioms: e.g., if $L$ thinks $z$ is the union of $A$, then $z$ really is the union of $A$.

2. **Reflection** is used to prove replacement in $L$: if a definable function maps a set $x \in L$ to constructible sets, then the range is bounded by some $L_\alpha$, hence is a set in $L$.

3. **The Levy hierarchy** ($\Delta_0$, $\Sigma_1$, $\Pi_1$) provides the classification that determines which concepts are automatically absolute and which require additional argument.

---

## 9. Key Takeaways

1. Relativization restricts quantifiers to a class $M$; absoluteness means $M$ and $V$ agree on a concept.
2. $\Delta_0$ formulas (bounded quantifiers only) are absolute for all transitive models.
3. $\Sigma_1$ formulas are upward absolute; $\Pi_1$ formulas are downward absolute.
4. Standard set-theoretic operations (pairs, unions, ordinals) are absolute; powerset is not.
5. The Reflection Theorem guarantees that any finite collection of formulas is reflected by unboundedly many levels of the cumulative hierarchy.
6. In Isabelle, `Relative.thy` organizes relativized concepts via locales, and absoluteness lemmas are registered as `[simp]` rules.

---

## 10. Exercises

**Exercise 6b.1.** Classify each of the following formulas as $\Delta_0$, $\Sigma_1$, $\Pi_1$, or none:
- (a) $\forall u \in x.\, u \in y$
- (b) $\exists f.\, f : x \to y \text{ is a bijection}$
- (c) $\forall u \in x.\, \exists v \in y.\, \langle u, v \rangle \in r$
- (d) $\exists z.\, z = \mathcal{P}(x)$

**Exercise 6b.2.** Prove that "being a transitive set" is absolute for transitive models. Write out the relativized formula and verify it is $\Delta_0$.

**Exercise 6b.3.** Give an example of a transitive model $M$ and a set $x \in M$ such that $\mathcal{P}^M(x) \subsetneq \mathcal{P}(x)$.

**Exercise 6b.4.** In Isabelle, find the absoluteness lemma for `pair` in `Relative.thy`. State the lemma and explain its hypotheses.

**Exercise 6b.5.** Explain why the Reflection Theorem does not contradict Godel's Second Incompleteness Theorem.

---

## References

- Kunen, K. (2011). *Set Theory*. Chapter IV (Constructibility), especially Section IV.3 on absoluteness.
- Jech, T. (2003). *Set Theory*. Chapter 12 (Constructible Sets) and Chapter 13 (Constructibility).
- Paulson, L.C. (2003). The relative consistency of the axiom of choice --- mechanized using Isabelle/ZF. Sections 4--6 on absoluteness.
- Levy, A. (1960). Axiom schemata of strong infinity in axiomatic set theory. *Pacific Journal of Mathematics*, 10(1), 223--238.
