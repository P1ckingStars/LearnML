# Lecture 04c: Well-Founded Relations & Recursion

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** well-founded relations and state the definition `wf(r)` as used in Isabelle/ZF.
2. **State** and apply the well-founded induction principle `wf_induct`.
3. **Explain** well-founded recursion via `wfrec(r, a, H)` and state the recursion equation.
4. **Define** the Knaster-Tarski theorem and use `lfp` and `gfp` for inductive and coinductive definitions.
5. **Explain** how inductive definitions in Isabelle/ZF work via monotone operators and least fixed points.
6. **Define** the natural numbers as an inductively defined set and derive the induction principle.
7. **Navigate** `WF.thy` and `Fixedpt.thy` in the Isabelle/ZF distribution.

---

## 2. Motivation and Context

### 2.1 Why Well-Foundedness?

Recursive definitions are ubiquitous in mathematics and computer science. To define a function $F$ by recursion, we need to ensure that the recursion terminates. In set theory, termination is guaranteed by *well-foundedness*: a relation $r$ is well-founded if there are no infinite descending chains $\cdots \mathbin{r} a_2 \mathbin{r} a_1 \mathbin{r} a_0$.

The membership relation $\in$ is well-founded on any set (this follows from the Foundation axiom). This enables $\in$-induction and $\in$-recursion, which are the basis for transfinite recursion on ordinals.

### 2.2 Why Fixed Points?

Many mathematical objects are defined as "the smallest set satisfying certain closure conditions":

- The natural numbers: the smallest set containing $0$ and closed under successor.
- The set of well-formed formulas: the smallest set containing atomic formulas and closed under connectives.
- The set of reachable states: the smallest set containing the initial state and closed under transitions.

The Knaster-Tarski theorem provides a general framework for such definitions: if an operator is monotone, its least fixed point exists and can be characterized as the intersection of all pre-fixed points.

---

## 3. Core Theory

### 3.1 Well-Founded Relations

**Definition 4.17 (Well-Founded Relation).**

A relation $r$ is well-founded if every non-empty set $A$ has an $r$-minimal element:

$$\mathrm{wf}(r) \iff \forall A.\, A \neq \emptyset \implies \exists x \in A.\, \forall y.\, \langle y, x \rangle \in r \implies y \notin A$$

In Isabelle/ZF:

```isabelle
definition wf :: "i => o" where
  "wf(r) \<equiv> \<forall>Z. Z \<noteq> 0 \<longrightarrow> (\<exists>x\<in>Z. \<forall>y. <y, x> \<in> r \<longrightarrow> y \<notin> Z)"
```

**Remark.** An equivalent characterization: $r$ is well-founded if and only if there is no function $f : \omega \to \mathrm{field}(r)$ with $f(n+1) \mathbin{r} f(n)$ for all $n$. But the "no infinite descending chain" formulation requires the Axiom of Choice (specifically, Dependent Choice). The definition above avoids AC.

### 3.2 Well-Founded Induction

**Theorem 4.5 (Well-Founded Induction).** If $r$ is well-founded, then to prove $P(a)$ for all $a$ in the field of $r$, it suffices to prove: for all $a$, if $P(y)$ holds for all $y$ with $\langle y, a \rangle \in r$, then $P(a)$.

```isabelle
lemma wf_induct:
  "\<lbrakk> wf(r);
     \<And>x. (\<forall>y. <y, x> \<in> r \<longrightarrow> P(y)) \<Longrightarrow> P(x) \<rbrakk>
   \<Longrightarrow> P(a)"
```

*Proof sketch.* Suppose for contradiction that $P(a)$ fails. Let $Z = \{x : \neg P(x)\}$. Then $Z \neq \emptyset$ (since $a \in Z$). By well-foundedness, there exists $x_0 \in Z$ with no $r$-predecessor in $Z$. That means $\forall y.\, \langle y, x_0 \rangle \in r \implies P(y)$. By the inductive hypothesis, $P(x_0)$, contradicting $x_0 \in Z$. $\blacksquare$

**Bounded variant:**

```isabelle
lemma wf_induct_rule:
  "\<lbrakk> wf(r); a \<in> A;
     \<And>x. \<lbrakk> x \<in> A; \<forall>y. <y, x> \<in> r \<longrightarrow> y \<in> A \<longrightarrow> P(y) \<rbrakk> \<Longrightarrow> P(x) \<rbrakk>
   \<Longrightarrow> P(a)"
```

### 3.3 The Membership Relation is Well-Founded

**Theorem 4.6.** For any set $A$, the membership relation restricted to $A$ is well-founded. That is, `wf(Memrel(A))` where:

```isabelle
definition Memrel :: "i => i" where
  "Memrel(A) \<equiv> {<x,y> \<in> A \<times> A. x \<in> y}"
```

This follows directly from the Foundation axiom: any non-empty subset of $A$ has a $\in$-minimal element.

### 3.4 Well-Founded Recursion

**Theorem 4.7 (Well-Founded Recursion).** If $r$ is well-founded, then for any class function $H$, there exists a unique function $F$ satisfying:

$$F(a) = H(a, \lambda x \in \{y : \langle y, a \rangle \in r\}.\, F(x))$$

In Isabelle/ZF:

```isabelle
definition wfrec :: "[i, i, [i, i] => i] => i" where
  "wfrec(r, a, H) \<equiv> THE y. <a, y> \<in> wftrec(r, H)"
```

The recursion equation:

```isabelle
lemma wfrec:
  "wf(r) \<Longrightarrow>
   wfrec(r, a, H) = H(a, lam x:{y. <y,a> \<in> r}. wfrec(r, x, H))"
```

This says: to compute $F(a)$, first recursively compute $F$ on all $r$-predecessors of $a$, collecting the results into a function, then apply $H$.

### 3.5 Example: Ackermann's Function

Here is how well-founded recursion can define a function. Consider a simpler example: factorial on natural numbers.

```isabelle
definition fact :: "i => i" where
  "fact(n) \<equiv> wfrec(Memrel(nat), n,
    \<lambda>n f. if n = 0 then succ(0)
          else n #* f ` pred(n))"
```

The well-founded relation is `Memrel(nat)` (the $\in$ relation on `nat`, which coincides with $<$ on natural numbers). The recursion equation gives:

$$\mathrm{fact}(n) = \begin{cases} 1 & \text{if } n = 0 \\ n \cdot \mathrm{fact}(n-1) & \text{otherwise} \end{cases}$$

---

## 4. The Knaster-Tarski Theorem

### 4.1 Lattice-Theoretic Background

**Definition 4.18 (Complete Lattice of Subsets).** For any set $D$, the power set $\mathcal{P}(D)$ ordered by inclusion forms a complete lattice. Every subset of $\mathcal{P}(D)$ has a supremum (union) and infimum (intersection).

**Definition 4.19 (Monotone Operator).** An operator $h : \mathcal{P}(D) \to \mathcal{P}(D)$ is monotone if $X \subseteq Y \implies h(X) \subseteq h(Y)$.

### 4.2 The Theorem

**Theorem 4.8 (Knaster-Tarski).** If $h$ is a monotone operator on $\mathcal{P}(D)$, then $h$ has a least fixed point:

$$\mathrm{lfp}(D, h) = \bigcap \{X \subseteq D : h(X) \subseteq X\}$$

and a greatest fixed point:

$$\mathrm{gfp}(D, h) = \bigcup \{X \subseteq D : X \subseteq h(X)\}$$

In Isabelle/ZF (from Fixedpt.thy):

```isabelle
definition lfp :: "[i, i => i] => i" where
  "lfp(D, h) \<equiv> \<Inter>({X \<in> Pow(D). h(X) \<subseteq> X})"

definition gfp :: "[i, i => i] => i" where
  "gfp(D, h) \<equiv> \<Union>({X \<in> Pow(D). X \<subseteq> h(X)})"
```

### 4.3 Properties of lfp

```isabelle
(* lfp is a fixed point *)
lemma lfp_unfold:
  "\<lbrakk> h(D) \<subseteq> D; bnd_mono(D, h) \<rbrakk> \<Longrightarrow> h(lfp(D, h)) = lfp(D, h)"

(* lfp is the LEAST fixed point *)
lemma lfp_lowerbound:
  "\<lbrakk> h(X) \<subseteq> X; X \<subseteq> D \<rbrakk> \<Longrightarrow> lfp(D, h) \<subseteq> X"

(* Induction principle for lfp *)
lemma lfp_induct:
  "\<lbrakk> a \<in> lfp(D, h); bnd_mono(D, h);
     \<And>x. \<lbrakk> x \<in> h(lfp(D, h) \<inter> {x \<in> D. P(x)}) \<rbrakk> \<Longrightarrow> P(x) \<rbrakk>
   \<Longrightarrow> P(a)"
```

**Bounded monotonicity:**

```isabelle
definition bnd_mono :: "[i, i => i] => o" where
  "bnd_mono(D, h) \<equiv> h(D) \<subseteq> D \<and>
    (\<forall>W X. W \<subseteq> X \<longrightarrow> X \<subseteq> D \<longrightarrow> h(W) \<subseteq> h(X))"
```

### 4.4 Inductive Definitions via lfp

The general pattern for inductive definitions in Isabelle/ZF is:

1. Choose a bounding set $D$ (the "domain").
2. Define a monotone operator $h : \mathcal{P}(D) \to \mathcal{P}(D)$ whose fixed points are exactly the sets closed under the desired rules.
3. The inductively defined set is $\mathrm{lfp}(D, h)$.

The system automatically derives:
- **Introduction rules**: from the definition of $h$.
- **Elimination rules**: from membership in $\mathrm{lfp}(D, h)$.
- **Induction principle**: from `lfp_induct`.

---

## 5. Natural Numbers as an Inductive Definition

### 5.1 Definition

The natural numbers are the least fixed point:

```isabelle
definition nat :: i where
  "nat \<equiv> lfp(Inf, \<lambda>X. {0} \<union> {succ(x). x \<in> X})"
```

The operator $h(X) = \{0\} \cup \{\mathrm{succ}(x) : x \in X\}$ is monotone on $\mathcal{P}(\mathrm{Inf})$:

- If $X \subseteq Y$, then $\{\mathrm{succ}(x) : x \in X\} \subseteq \{\mathrm{succ}(x) : x \in Y\}$, so $h(X) \subseteq h(Y)$.
- $h(\mathrm{Inf}) \subseteq \mathrm{Inf}$ follows from the Infinity axiom ($0 \in \mathrm{Inf}$ and $\mathrm{Inf}$ is closed under successor).

### 5.2 Derived Rules

```isabelle
(* Introduction rules *)
lemma nat_0I [TC, intro!]: "0 \<in> nat"
lemma nat_succI [TC, intro!]: "n \<in> nat \<Longrightarrow> succ(n) \<in> nat"

(* Elimination / case analysis *)
lemma natE:
  "\<lbrakk> n \<in> nat; n = 0 \<Longrightarrow> P; \<And>m. \<lbrakk> m \<in> nat; n = succ(m) \<rbrakk> \<Longrightarrow> P \<rbrakk>
   \<Longrightarrow> P"

(* Induction *)
lemma nat_induct:
  "\<lbrakk> n \<in> nat; P(0); \<And>m. \<lbrakk> m \<in> nat; P(m) \<rbrakk> \<Longrightarrow> P(succ(m)) \<rbrakk>
   \<Longrightarrow> P(n)"
```

### 5.3 Natural Number Recursion

```isabelle
definition nat_rec :: "[i, i, [i, i] => i] => i" where
  "nat_rec(n, a, b) \<equiv>
    wfrec(Memrel(nat), n,
      \<lambda>n f. nat_case(a, \<lambda>m. b(m, f ` m), n))"
```

Where `nat_case` does case analysis:

```isabelle
definition nat_case :: "[i, i => i, i] => i" where
  "nat_case(a, b, n) \<equiv> if n = 0 then a else b(pred(n))"
```

The recursion equations:

```isabelle
lemma nat_rec_0 [simp]: "nat_rec(0, a, b) = a"
lemma nat_rec_succ [simp]:
  "m \<in> nat \<Longrightarrow> nat_rec(succ(m), a, b) = b(m, nat_rec(m, a, b))"
```

### 5.4 Example: Addition

```isabelle
definition add :: "[i, i] => i"  (infixl "#+" 65) where
  "m #+ n \<equiv> nat_rec(n, m, \<lambda>_ r. succ(r))"
```

This defines $m + 0 = m$ and $m + \mathrm{succ}(n) = \mathrm{succ}(m + n)$.

```isabelle
lemma add_0 [simp]: "m #+ 0 = m"
lemma add_succ [simp]:
  "n \<in> nat \<Longrightarrow> m #+ succ(n) = succ(m #+ n)"
```

---

## 6. Connections and Extensions

### 6.1 Links to Prior Modules

- **Module 03**: Well-foundedness of $\in$ follows from the Foundation axiom.
- **Lecture 04a**: Relations are sets of ordered pairs; well-founded relations are a special class.
- **Lecture 04b**: Recursive definitions produce functions; type-checking ensures they belong to the right Pi type.

### 6.2 Links to Future Modules

- **Lecture 04d**: Ordinals are defined using transfinite induction and recursion, which specialize well-founded recursion to the ordinal ordering.
- **Module 06**: The constructible universe $L$ is defined by a transfinite recursion.

---

## 7. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1995).** "Set Theory for Verification: II. Induction and Recursion." *Journal of Automated Reasoning*, 15(2), 167--215.
   - *The foundational paper on well-founded recursion and inductive definitions in Isabelle/ZF.*

### Recommended

2. **Tarski, A. (1955).** "A Lattice-Theoretical Fixpoint Theorem and its Applications." *Pacific Journal of Mathematics*, 5(2), 285--309.
   - *The original Knaster-Tarski theorem.*

3. **Aczel, P. (1977).** "An Introduction to Inductive Definitions." *Handbook of Mathematical Logic*, 739--782.
   - *Comprehensive treatment of inductive definitions in set theory.*

---

## 8. Exercises

### Theory

**Exercise 4c.1.** Prove on paper that the less-than relation on $\mathbb{N}$ is well-founded. (Use the definition: every non-empty subset has a minimal element.)

**Exercise 4c.2.** Show that the lexicographic product of two well-founded relations is well-founded.

**Exercise 4c.3.** Prove the Knaster-Tarski theorem: if $h$ is monotone on the complete lattice $\mathcal{P}(D)$, then $\bigcap\{X \subseteq D : h(X) \subseteq X\}$ is a fixed point of $h$.

**Exercise 4c.4.** Verify that the operator $h(X) = \{0\} \cup \{\mathrm{succ}(x) : x \in X\}$ is bounded monotone on $\mathrm{Inf}$.

### Isabelle

**Exercise 4c.5.** Define multiplication on natural numbers using `nat_rec`:
```isabelle
definition mult :: "[i, i] => i"  (infixl "#*" 70) where
  "m #* n \<equiv> nat_rec(n, 0, \<lambda>_ r. r #+ m)"
```
Prove: `m #* 0 = 0` and `m #* succ(n) = m #* n #+ m`.

**Exercise 4c.6.** Prove commutativity of addition: `m #+ n = n #+ m` for `m, n \<in> nat`, by induction on `n`.

**Exercise 4c.7.** Define exponentiation `m #^ n` using `nat_rec` and prove `m #^ 0 = succ(0)` and `m #^ succ(n) = m #* (m #^ n)`.

**Exercise 4c.8.** Define the list datatype as an inductive definition: `list(A) = lfp(univ(A), \<lambda>X. {0} \<union> ...)`. State what the introduction rules, elimination rule, and induction principle should be.
