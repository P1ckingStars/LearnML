# Lecture 04d: Ordinals & Transfinite Induction

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** transitive sets and ordinals in Isabelle/ZF and state the key characterization: $\mathrm{Ord}(i) \iff \mathrm{Transset}(i) \land \forall x \in i.\, \mathrm{Transset}(x)$.
2. **Prove** basic ordinal properties: trichotomy, well-ordering, closure under successor and union.
3. **Distinguish** successor ordinals from limit ordinals and state the `Limit` predicate.
4. **State** and apply the transfinite induction principle `Ord_induct` and `trans_induct`.
5. **Define** transfinite recursion via `transrec` and state the recursion equation.
6. **Define** the epsilon closure `eclose` and the rank function.
7. **Navigate** `Ordinal.thy`, `Epsilon.thy`, `Nat.thy`, and `Arith.thy`.

---

## 2. Motivation and Context

### 2.1 Why Ordinals?

Ordinals extend the natural numbers into the transfinite. Where the natural numbers $0, 1, 2, \ldots$ index finite iterations, ordinals $0, 1, 2, \ldots, \omega, \omega+1, \ldots, \omega \cdot 2, \ldots, \omega^2, \ldots$ index arbitrary well-ordered iterations. They are the backbone of:

- Transfinite induction and recursion (defining objects by iterating into the transfinite).
- The cumulative hierarchy $V_\alpha$ (every set appears at some ordinal rank).
- Cardinal arithmetic (cardinals are initial ordinals).
- The constructible hierarchy $L_\alpha$ (Module 06).

### 2.2 Historical Note

Cantor introduced ordinal numbers in the 1880s to study the "lengths" of well-ordered sets. Von Neumann (1923) gave the modern set-theoretic definition: an ordinal is a transitive set well-ordered by $\in$. This definition is used in Isabelle/ZF.

---

## 3. Core Theory

### 3.1 Transitive Sets

**Definition 4.20 (Transitive Set).**

A set $A$ is transitive if every element of $A$ is also a subset of $A$:

$$\mathrm{Transset}(A) \iff \forall x \in A.\, x \subseteq A$$

Equivalently, $A \subseteq \mathcal{P}(A)$, or $\bigcup A \subseteq A$.

```isabelle
definition Transset :: "i => o" where
  "Transset(A) \<equiv> \<forall>x\<in>A. x \<subseteq> A"
```

**Examples:**
- $\emptyset$ is transitive (vacuously).
- $\{0\} = \{\emptyset\}$ is transitive: the only element is $\emptyset$, and $\emptyset \subseteq \{0\}$.
- $\{0, \{0\}\}$ is transitive: $0 \subseteq \{0, \{0\}\}$ and $\{0\} \subseteq \{0, \{0\}\}$.
- $\{\{0\}\}$ is *not* transitive: $\{0\} \in \{\{0\}\}$ but $0 \in \{0\}$ and $0 \notin \{\{0\}\}$.

### 3.2 Ordinals

**Definition 4.21 (Ordinal).**

$$\mathrm{Ord}(i) \iff \mathrm{Transset}(i) \land \forall x \in i.\, \mathrm{Transset}(x)$$

```isabelle
definition Ord :: "i => o" where
  "Ord(i) \<equiv> Transset(i) \<and> (\<forall>x\<in>i. Transset(x))"
```

An ordinal is a transitive set all of whose elements are also transitive. This is equivalent to saying: $i$ is a transitive set that is well-ordered by $\in$.

**Examples:**
- $0 = \emptyset$ is an ordinal: transitive vacuously, all elements transitive vacuously.
- $1 = \{0\}$ is an ordinal: transitive (checked above), and its only element $0$ is transitive.
- $2 = \{0, 1\} = \{0, \{0\}\}$ is an ordinal.
- $\omega = \{0, 1, 2, 3, \ldots\}$ (= `nat`) is an ordinal.
- $\omega + 1 = \omega \cup \{\omega\}$ is an ordinal.

### 3.3 Ordinal Ordering

The ordering on ordinals is simply the membership relation:

$$i < j \iff i \in j \quad (\text{when } \mathrm{Ord}(j))$$

```isabelle
definition lt :: "[i, i] => o"  (infixl "<" 50) where
  "i < j \<equiv> i \<in> j \<and> Ord(j)"

definition le :: "[i, i] => o"  (infixl "\<le>" 50) where
  "i \<le> j \<equiv> i < j \<or> i = j"
```

**Remark.** The `Ord(j)` condition in the definition of `<` is essential: without it, `i < j` would be true whenever `i \<in> j`, even for non-ordinal `j`. By including `Ord(j)`, the ordering is restricted to ordinals. The `\<le>` relation inherits this via `<`.

### 3.4 Key Properties of Ordinals

**Theorem 4.9 (Ordinal Trichotomy).** For ordinals $i$ and $j$:

$$\mathrm{Ord}(i) \land \mathrm{Ord}(j) \implies i \in j \lor i = j \lor j \in i$$

```isabelle
lemma Ord_linear:
  "\<lbrakk> Ord(i); Ord(j) \<rbrakk> \<Longrightarrow> i \<in> j \<or> i = j \<or> j \<in> i"
```

**Theorem 4.10 (Ordinals are Well-Ordered).** The class of all ordinals is well-ordered by $\in$: every non-empty set of ordinals has a $\in$-least element.

```isabelle
lemma Ord_wf_on: "wf(Memrel(i))" when "Ord(i)"
```

This follows from Foundation: the $\in$ relation on any set is well-founded.

**Theorem 4.11 (Closure Properties).**

```isabelle
lemma Ord_0 [TC, intro!]: "Ord(0)"
lemma Ord_succ [TC]: "Ord(i) \<Longrightarrow> Ord(succ(i))"
lemma Ord_Union [TC]: "(\<forall>i\<in>A. Ord(i)) \<Longrightarrow> Ord(\<Union>(A))"

(* Every element of an ordinal is an ordinal *)
lemma Ord_in_Ord: "\<lbrakk> Ord(i); j \<in> i \<rbrakk> \<Longrightarrow> Ord(j)"

(* Ordinals are transitive: j < i and i < k implies j < k *)
lemma lt_trans: "\<lbrakk> i < j; j < k \<rbrakk> \<Longrightarrow> i < k"
```

### 3.5 Successor and Limit Ordinals

**Definition 4.22 (Successor Ordinal).** An ordinal $i$ is a *successor ordinal* if $i = \mathrm{succ}(j)$ for some ordinal $j$.

**Definition 4.23 (Limit Ordinal).**

```isabelle
definition Limit :: "i => o" where
  "Limit(i) \<equiv> Ord(i) \<and> 0 < i \<and> (\<forall>y. y < i \<longrightarrow> succ(y) < i)"
```

A limit ordinal is a non-zero ordinal that is not a successor. The first limit ordinal is $\omega$ (= `nat`).

**Theorem 4.12 (Ordinal Trichotomy by Type).**

$$\mathrm{Ord}(i) \implies i = 0 \;\lor\; (\exists j.\, \mathrm{Ord}(j) \land i = \mathrm{succ}(j)) \;\lor\; \mathrm{Limit}(i)$$

```isabelle
lemma Ord_cases:
  "\<lbrakk> Ord(i); i = 0 \<Longrightarrow> P;
     \<And>j. \<lbrakk> Ord(j); i = succ(j) \<rbrakk> \<Longrightarrow> P;
     Limit(i) \<Longrightarrow> P \<rbrakk>
   \<Longrightarrow> P"
```

### 3.6 Limit Ordinal is nat

```isabelle
lemma Limit_nat [TC]: "Limit(nat)"

lemma nat_le_Limit:
  "Limit(i) \<Longrightarrow> nat \<le> i"
```

The smallest limit ordinal is $\omega$ = `nat`.

---

## 4. Transfinite Induction

### 4.1 The Principle

**Theorem 4.13 (Transfinite Induction).**

To prove $P(\alpha)$ for all ordinals $\alpha$, it suffices to prove: for all ordinals $\alpha$, if $P(\beta)$ holds for all $\beta < \alpha$, then $P(\alpha)$.

```isabelle
lemma trans_induct:
  "\<lbrakk> Ord(i);
     \<And>x. \<lbrakk> Ord(x); \<forall>y. y < x \<longrightarrow> P(y) \<rbrakk> \<Longrightarrow> P(x) \<rbrakk>
   \<Longrightarrow> P(i)"
```

### 4.2 Three-Case Transfinite Induction

In practice, transfinite induction is often applied with three cases: zero, successor, and limit.

```isabelle
lemma trans_induct3:
  "\<lbrakk> Ord(i);
     P(0);
     \<And>j. \<lbrakk> Ord(j); P(j) \<rbrakk> \<Longrightarrow> P(succ(j));
     \<And>j. \<lbrakk> Limit(j); \<forall>k. k < j \<longrightarrow> P(k) \<rbrakk> \<Longrightarrow> P(j) \<rbrakk>
   \<Longrightarrow> P(i)"
```

This decomposes the inductive step into three sub-cases matching the ordinal trichotomy.

---

## 5. Transfinite Recursion

### 5.1 The transrec Combinator

**Definition 4.24 (Transfinite Recursion).**

```isabelle
definition transrec :: "[i, [i, i] => i] => i" where
  "transrec(a, H) \<equiv> wfrec(Memrel(eclose({a})), a, H)"
```

The recursion equation:

```isabelle
lemma transrec:
  "transrec(a, H) = H(a, lam x:a. transrec(x, H))"
```

This says: $F(\alpha) = H(\alpha, F \restriction \alpha)$, where $F \restriction \alpha = \lambda x \in \alpha.\, F(x)$.

### 5.2 Transfinite Recursion on Ordinals

When $\alpha$ is an ordinal:

- **Zero case:** $F(0) = H(0, \lambda x \in \emptyset.\, F(x)) = H(0, \emptyset)$
- **Successor case:** $F(\mathrm{succ}(\alpha)) = H(\mathrm{succ}(\alpha), \lambda x \in \mathrm{succ}(\alpha).\, F(x))$
- **Limit case:** $F(\lambda) = H(\lambda, \lambda x \in \lambda.\, F(x))$ where $\lambda$ is a limit ordinal.

### 5.3 The Epsilon Closure

**Definition 4.25 (Epsilon Closure).**

$$\mathrm{eclose}(A) = A \cup \bigcup A \cup \bigcup\bigcup A \cup \cdots$$

More precisely, $\mathrm{eclose}(A)$ is the smallest transitive set containing $A$.

```isabelle
definition eclose :: "i => i" where
  "eclose(A) \<equiv> \<Union>n\<in>nat. nat_rec(n, A, \<lambda>_ r. \<Union>(r))"
```

This iterates the union operation: `nat_rec(0, A, ...) = A`, `nat_rec(1, A, ...) = Union(A)`, `nat_rec(2, A, ...) = Union(Union(A))`, and so on. Taking the union over all `n` yields the smallest transitive set containing `A`.

**Properties:**

```isabelle
lemma arg_subset_eclose: "A \<subseteq> eclose(A)"
lemma Transset_eclose: "Transset(eclose(A))"
lemma eclose_least:
  "\<lbrakk> Transset(X); A \<subseteq> X \<rbrakk> \<Longrightarrow> eclose(A) \<subseteq> X"
```

### 5.4 The Rank Function

**Definition 4.26 (Rank).**

$$\mathrm{rank}(a) = \sup\{\mathrm{succ}(\mathrm{rank}(x)) : x \in a\}$$

```isabelle
definition rank :: "i => i" where
  "rank(a) \<equiv> transrec(a, \<lambda>x f. \<Union>y\<in>x. succ(f ` y))"
```

**Properties:**

```isabelle
lemma rank_of_Ord: "Ord(i) \<Longrightarrow> rank(i) = i"
lemma Ord_rank: "Ord(rank(a))"
lemma rank_lt: "a \<in> b \<Longrightarrow> rank(a) < rank(b)"
```

The rank function assigns to each set the least ordinal $\alpha$ such that the set belongs to $V_{\alpha+1}$. It provides a measure of the "complexity" of a set.

---

## 6. Natural Numbers in ZF

### 6.1 Nat.thy and Arith.thy

The natural numbers `nat` are defined as the least inductive set (Section 5 of Lecture 04c). The files `Nat.thy` and `Arith.thy` develop:

- **Nat.thy**: basic properties of `nat`, `nat_case`, `nat_rec`, predecessor.
- **Arith.thy**: addition (`#+`), multiplication (`#*`), subtraction (`#-`), ordering on `nat`, division and modular arithmetic.

### 6.2 Key Theorems

```isabelle
(* nat is an ordinal *)
lemma Ord_nat [TC]: "Ord(nat)"

(* nat is a limit ordinal *)
lemma Limit_nat [TC]: "Limit(nat)"

(* Every natural number is an ordinal *)
lemma nat_into_Ord [TC]: "n \<in> nat \<Longrightarrow> Ord(n)"

(* nat is the smallest limit ordinal *)
lemma nat_le_Limit: "Limit(i) \<Longrightarrow> nat \<le> i"
```

### 6.3 Arithmetic Properties

```isabelle
lemma add_commute: "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk> \<Longrightarrow> m #+ n = n #+ m"
lemma add_assoc:
  "\<lbrakk> m \<in> nat; n \<in> nat; k \<in> nat \<rbrakk> \<Longrightarrow> (m #+ n) #+ k = m #+ (n #+ k)"

lemma mult_commute: "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk> \<Longrightarrow> m #* n = n #* m"
lemma mult_assoc:
  "\<lbrakk> m \<in> nat; n \<in> nat; k \<in> nat \<rbrakk> \<Longrightarrow> (m #* n) #* k = m #* (n #* k)"

lemma add_mult_distrib:
  "\<lbrakk> m \<in> nat; n \<in> nat; k \<in> nat \<rbrakk>
   \<Longrightarrow> (m #+ n) #* k = (m #* k) #+ (n #* k)"
```

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Lecture 04c**: Ordinals are defined using transitive sets (from the Foundation axiom) and well-founded recursion.
- **Module 03**: The Infinity axiom provides the bounding set for defining `nat`.

### 7.2 Links to Future Modules

- **Module 05**: Cardinals are defined as initial ordinals (ordinals with no bijection to any smaller ordinal).
- **Module 06**: The constructible hierarchy $L_\alpha$ is defined by transfinite recursion over the ordinals.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1995).** "Set Theory for Verification: II. Induction and Recursion." *Journal of Automated Reasoning*, 15(2), 167--215.
   - *Sections 6--8: ordinals, transfinite induction, and arithmetic.*

### Recommended

2. **Kunen, K. (2011).** *Set Theory.* College Publications.
   - *Chapter I, Sections 6--7: ordinals and transfinite recursion.*

3. **von Neumann, J. (1923).** "Zur Einfuhrung der transfiniten Zahlen." *Acta Szeged*, 1, 199--208.
   - *The original definition of ordinals as transitive sets well-ordered by membership.*

---

## 9. Exercises

### Theory

**Exercise 4d.1.** Prove on paper that every ordinal is transitive and every element of an ordinal is an ordinal.

**Exercise 4d.2.** Prove ordinal trichotomy for ordinals $i$ and $j$: $i \in j \lor i = j \lor j \in i$. (Hint: consider $i \cap j$ and use transitivity.)

**Exercise 4d.3.** Prove that $\omega$ (= `nat`) is a limit ordinal. Verify the three conditions: $\mathrm{Ord}(\omega)$, $0 < \omega$, and $\forall y < \omega.\, \mathrm{succ}(y) < \omega$.

**Exercise 4d.4.** Prove that $\mathrm{rank}(\alpha) = \alpha$ for every ordinal $\alpha$ by transfinite induction.

### Isabelle

**Exercise 4d.5.** Prove in Isabelle/ZF:
```isabelle
lemma "Ord(0)"
lemma "Ord(succ(succ(succ(0))))"
lemma "Limit(nat)"
lemma "\<lbrakk> Ord(i); Ord(j); i < j \<rbrakk> \<Longrightarrow> succ(i) \<le> j"
```

**Exercise 4d.6.** Prove by transfinite induction:
```isabelle
lemma "\<lbrakk> Ord(i); 0 < i \<rbrakk> \<Longrightarrow> 0 \<in> i"
```

**Exercise 4d.7.** Define ordinal addition via transfinite recursion and prove `i #+ 0 = i` and `i #+ succ(j) = succ(i #+ j)`.

**Exercise 4d.8.** Prove that `nat` is the smallest ordinal that is not a natural number:
```isabelle
lemma "\<lbrakk> Ord(i); i \<notin> nat \<rbrakk> \<Longrightarrow> nat \<le> i"
```
