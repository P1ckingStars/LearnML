# Lecture 04a: Ordered Pairs, Products & Relations

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** the Kuratowski ordered pair $\langle a, b \rangle = \{\{a\}, \{a, b\}\}$ and prove that it satisfies the characteristic property: $\langle a, b \rangle = \langle c, d \rangle \iff a = c \land b = d$.
2. **Define** Cartesian products $A \times B$ and dependent sums $\Sigma(A, B)$ in Isabelle/ZF.
3. **Define** fst, snd, and split (case analysis on pairs) and use them in proofs.
4. **Construct** relations as sets of ordered pairs and state their basic properties.
5. **Define** domain, range, field, image, converse, and composition of relations.
6. **Define** and prove properties of reflexive, symmetric, transitive, and antisymmetric relations.
7. **State** equivalence relations and equivalence classes following EquivClass.thy.

---

## 2. Motivation and Context

### 2.1 Why Ordered Pairs?

Unordered pairs $\{a, b\}$ do not distinguish order: $\{a, b\} = \{b, a\}$. But virtually all of mathematics requires ordered tuples --- functions are sets of ordered pairs, relations are sets of ordered pairs, sequences are functions from natural numbers. We need a set-theoretic encoding of ordered pairs that satisfies:

$$\langle a, b \rangle = \langle c, d \rangle \iff a = c \land b = d$$

The standard encoding, due to Kuratowski (1921), defines $\langle a, b \rangle = \{\{a\}, \{a, b\}\}$. This is simple, elegant, and works within ZF without additional axioms.

### 2.2 The Structure of pair.thy

The file `pair.thy` in Isabelle/ZF defines:

- Ordered pairs: `<a, b> = Upair(Upair(a,a), Upair(a,b))`
- Projections: `fst(p)` and `snd(p)`
- Case analysis: `split(f, p) = f(fst(p), snd(p))`
- Sigma types: `Sigma(A, B) = \<Union>x\<in>A. \<Union>y\<in>B(x). {<x,y>}`
- Cartesian product: `A * B = Sigma(A, \<lambda>_. B)`

---

## 3. Core Theory

### 3.1 The Kuratowski Ordered Pair

**Definition 4.1 (Ordered Pair).**

$$\langle a, b \rangle = \{\{a\}, \{a, b\}\}$$

In Isabelle syntax:

```isabelle
definition Pair :: "[i, i] => i" where
  "Pair(a, b) \<equiv> Upair(Upair(a,a), Upair(a,b))"

notation Pair  ("\<langle>_, _\<rangle>")
```

So $\langle a, b \rangle = \{\{a, a\}, \{a, b\}\} = \{\{a\}, \{a, b\}\}$.

**Theorem 4.1 (Pair Characterization).**

$$\langle a, b \rangle = \langle c, d \rangle \iff a = c \land b = d$$

*Proof.* ($\Leftarrow$) Trivial by substitution.

($\Rightarrow$) Assume $\{\{a\}, \{a, b\}\} = \{\{c\}, \{c, d\}\}$.

**Case 1:** $\{a\} = \{c\}$ and $\{a, b\} = \{c, d\}$. From $\{a\} = \{c\}$ we get $a = c$. From $\{a, b\} = \{c, d\}$ and $a = c$, we get $\{a, b\} = \{a, d\}$. If $a = b$, then $\{a\} = \{a, d\}$, so $d = a = b$. If $a \neq b$, then $b = d$.

**Case 2:** $\{a\} = \{c, d\}$ and $\{a, b\} = \{c\}$. From $\{a, b\} = \{c\}$, we get $a = b = c$. From $\{a\} = \{c, d\}$, we get $d = a = c$. So $a = b = c = d$.

In all cases, $a = c$ and $b = d$. $\blacksquare$

```isabelle
lemma Pair_inject:
  "\<lbrakk> <a,b> = <c,d>; \<lbrakk> a = c; b = d \<rbrakk> \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"
```

### 3.2 Projections

**Definition 4.2 (fst and snd).**

```isabelle
definition fst :: "i => i" where
  "fst(p) \<equiv> THE a. \<exists>b. p = <a, b>"

definition snd :: "i => i" where
  "snd(p) \<equiv> THE b. \<exists>a. p = <a, b>"
```

The operator `THE` denotes the unique element satisfying a property (definite description). For well-formed pairs:

```isabelle
lemma fst_conv [simp]: "fst(<a, b>) = a"
lemma snd_conv [simp]: "snd(<a, b>) = b"
```

**Warning.** `fst(x)` and `snd(x)` are well-defined for any `x :: i`, but they return meaningful results only when `x` is actually a pair. If `x` is not a pair, the result is unspecified (some arbitrary set). This is a consequence of working in an untyped setting.

### 3.3 Case Analysis on Pairs: split

**Definition 4.3 (split).**

```isabelle
definition split :: "[[i, i] => 'a, i] => 'a" where
  "split(f, p) \<equiv> f(fst(p), snd(p))"
```

The notation `\<lambda><x,y>. t(x,y)` is syntactic sugar for `split(\<lambda>x y. t(x,y), _)`.

```isabelle
lemma split_conv [simp]: "split(f, <a,b>) = f(a, b)"
```

### 3.4 Sigma Types (Dependent Pairs)

**Definition 4.4 (Sigma).**

$$\Sigma(A, B) = \bigcup_{x \in A} \bigcup_{y \in B(x)} \{\langle x, y \rangle\}$$

```isabelle
definition Sigma :: "[i, i => i] => i" where
  "Sigma(A, B) \<equiv> \<Union>x\<in>A. \<Union>y\<in>B(x). {<x,y>}"
```

**Characterization:**

```isabelle
lemma SigmaI [TC, intro!]:
  "\<lbrakk> a \<in> A; b \<in> B(a) \<rbrakk> \<Longrightarrow> <a, b> \<in> Sigma(A, B)"

lemma SigmaE [elim!]:
  "\<lbrakk> c \<in> Sigma(A, B);
     \<And>x y. \<lbrakk> x \<in> A; y \<in> B(x); c = <x,y> \<rbrakk> \<Longrightarrow> P \<rbrakk>
   \<Longrightarrow> P"

lemma Sigma_iff:
  "p \<in> Sigma(A, B) \<longleftrightarrow> (\<exists>x\<in>A. \<exists>y\<in>B(x). p = <x,y>)"
```

### 3.5 Cartesian Product

**Definition 4.5 (Cartesian Product).**

$$A \times B = \Sigma(A, \lambda\_.\, B)$$

```isabelle
abbreviation cart_prod :: "[i, i] => i"  (infixr "\<times>" 80) where
  "A \<times> B \<equiv> Sigma(A, \<lambda>_. B)"
```

**Characterization:**

```isabelle
lemma mem_Sigma_iff: "<a,b> \<in> A \<times> B \<longleftrightarrow> a \<in> A \<and> b \<in> B"
```

---

## 4. Relations

### 4.1 Relations as Sets of Pairs

**Definition 4.6 (Relation).** A relation $r$ from $A$ to $B$ is a subset of $A \times B$:

$$r \subseteq A \times B$$

In Isabelle/ZF, there is no separate type for relations; a relation is simply a set of ordered pairs.

### 4.2 Domain, Range, and Field

```isabelle
definition domain :: "i => i" where
  "domain(r) \<equiv> {x \<in> \<Union>(\<Union>(r)). \<exists>y. <x,y> \<in> r}"

definition range :: "i => i" where
  "range(r) \<equiv> domain(converse(r))"

definition field :: "i => i" where
  "field(r) \<equiv> domain(r) \<union> range(r)"
```

**Key rules:**

```isabelle
lemma domainI: "<a, b> \<in> r \<Longrightarrow> a \<in> domain(r)"
lemma domainE:
  "\<lbrakk> a \<in> domain(r); \<And>y. <a, y> \<in> r \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"

lemma rangeI: "<a, b> \<in> r \<Longrightarrow> b \<in> range(r)"
lemma rangeE:
  "\<lbrakk> b \<in> range(r); \<And>x. <x, b> \<in> r \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"
```

### 4.3 Converse

**Definition 4.7 (Converse).**

$$r^{-1} = \{\langle y, x \rangle : \langle x, y \rangle \in r\}$$

```isabelle
definition converse :: "i => i" where
  "converse(r) \<equiv> {z \<in> range(r) \<times> domain(r). \<exists>x y. <x,y> \<in> r \<and> z = <y,x>}"
```

**Key rules:**

```isabelle
lemma converseI: "<a, b> \<in> r \<Longrightarrow> <b, a> \<in> converse(r)"
lemma converseD: "<a, b> \<in> converse(r) \<Longrightarrow> <b, a> \<in> r"
lemma converse_converse: "r \<subseteq> A \<times> B \<Longrightarrow> converse(converse(r)) = r"
```

### 4.4 Image

**Definition 4.8 (Image of a Set Under a Relation).**

$$r \mathbin{``} A = \{y : \exists x \in A.\, \langle x, y \rangle \in r\}$$

```isabelle
definition image :: "[i, i] => i"  (infixl "``" 90) where
  "r `` A \<equiv> {y. x \<in> A, <x, y> \<in> r}"
```

**Key rules:**

```isabelle
lemma imageI: "\<lbrakk> <a, b> \<in> r; a \<in> A \<rbrakk> \<Longrightarrow> b \<in> r `` A"
lemma imageE:
  "\<lbrakk> b \<in> r `` A; \<And>x. \<lbrakk> <x, b> \<in> r; x \<in> A \<rbrakk> \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"
```

### 4.5 Composition

**Definition 4.9 (Composition).**

$$r \circ s = \{\langle x, z \rangle : \exists y.\, \langle x, y \rangle \in s \land \langle y, z \rangle \in r\}$$

```isabelle
definition comp :: "[i, i] => i"  (infixr "O" 60) where
  "r O s \<equiv> {xz. \<exists>x y z. xz = <x,z> \<and> <x,y> \<in> s \<and> <y,z> \<in> r}"
```

Note the order: `r O s` means "first apply $s$, then apply $r$" (standard mathematical convention).

```isabelle
lemma compI: "\<lbrakk> <a, b> \<in> s; <b, c> \<in> r \<rbrakk> \<Longrightarrow> <a, c> \<in> r O s"
```

---

## 5. Properties of Relations

### 5.1 Reflexivity, Symmetry, Transitivity

```isabelle
definition refl :: "[i, i] => o" where
  "refl(A, r) \<equiv> \<forall>x\<in>A. <x, x> \<in> r"

definition sym :: "i => o" where
  "sym(r) \<equiv> \<forall>x y. <x, y> \<in> r \<longrightarrow> <y, x> \<in> r"

definition trans :: "i => o" where
  "trans(r) \<equiv> \<forall>x y z. <x,y> \<in> r \<longrightarrow> <y,z> \<in> r \<longrightarrow> <x,z> \<in> r"

definition antisym :: "i => o" where
  "antisym(r) \<equiv> \<forall>x y. <x,y> \<in> r \<longrightarrow> <y,x> \<in> r \<longrightarrow> x = y"
```

### 5.2 Equivalence Relations

**Definition 4.10 (Equivalence Relation).** A relation $r$ on $A$ is an equivalence relation if it is reflexive on $A$, symmetric, and transitive.

```isabelle
definition equiv :: "[i, i] => o" where
  "equiv(A, r) \<equiv> r \<subseteq> A \<times> A \<and> refl(A, r) \<and> sym(r) \<and> trans(r)"
```

### 5.3 Equivalence Classes

**Definition 4.11 (Equivalence Class).**

$$[a]_r = r \mathbin{``} \{a\} = \{y : \langle a, y \rangle \in r\}$$

```isabelle
definition equiv_class :: "[i, i] => i"  (infixl "//" 90) where
  "r // A \<equiv> {r `` {x}. x \<in> A}"
```

The quotient `A // r` is the set of all equivalence classes:

$$A / r = \{[a]_r : a \in A\}$$

**Key properties from EquivClass.thy:**

```isabelle
lemma equiv_class_self:
  "\<lbrakk> equiv(A, r); a \<in> A \<rbrakk> \<Longrightarrow> a \<in> r `` {a}"

lemma equiv_class_eq:
  "\<lbrakk> equiv(A, r); <a, b> \<in> r \<rbrakk> \<Longrightarrow> r `` {a} = r `` {b}"

lemma equiv_class_disjoint:
  "\<lbrakk> equiv(A, r); r `` {a} \<noteq> r `` {b} \<rbrakk>
   \<Longrightarrow> r `` {a} \<inter> r `` {b} = 0"
```

The quotient forms a partition of $A$:

```isabelle
lemma equiv_partition:
  "equiv(A, r) \<Longrightarrow> \<Union>(A // r) = A"
```

---

## 6. Worked Examples

### 6.1 Proving a Relation is an Equivalence

```isabelle
definition mod_rel :: "[i, i] => i" where
  "mod_rel(n, A) \<equiv> {<x,y> \<in> A \<times> A. \<exists>k\<in>int. x #- y = n #* k}"

lemma mod_rel_equiv:
  assumes "n \<in> nat" "n \<noteq> 0"
  shows "equiv(int, mod_rel(n, int))"
proof (unfold equiv_def, intro conjI)
  show "mod_rel(n, int) \<subseteq> int \<times> int"
    by (auto simp add: mod_rel_def)
next
  show "refl(int, mod_rel(n, int))"
    unfolding refl_def mod_rel_def
    by auto  (* x - x = 0 = n * 0 *)
next
  show "sym(mod_rel(n, int))"
    unfolding sym_def mod_rel_def
    by auto  (* if x - y = n*k then y - x = n*(-k) *)
next
  show "trans(mod_rel(n, int))"
    unfolding trans_def mod_rel_def
    by auto  (* if x-y = n*k and y-z = n*l then x-z = n*(k+l) *)
qed
```

### 6.2 Working with Cartesian Products

```isabelle
lemma Sigma_mono:
  "\<lbrakk> A \<subseteq> A'; \<And>x. x \<in> A \<Longrightarrow> B(x) \<subseteq> B'(x) \<rbrakk>
   \<Longrightarrow> Sigma(A, B) \<subseteq> Sigma(A', B')"
proof (rule subsetI)
  fix p
  assume "p \<in> Sigma(A, B)"
  then obtain x y where "x \<in> A" "y \<in> B(x)" "p = <x,y>"
    by (erule SigmaE)
  from \<open>x \<in> A\<close> \<open>A \<subseteq> A'\<close> have "x \<in> A'" by (rule subsetD)
  from \<open>y \<in> B(x)\<close> \<open>x \<in> A\<close> have "y \<in> B'(x)"
    using assms(2) by (auto dest: subsetD)
  with \<open>x \<in> A'\<close> \<open>p = <x,y>\<close>
  show "p \<in> Sigma(A', B')" by auto
qed
```

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Module 03**: Ordered pairs are built from unordered pairs (Upair), which were derived from Replacement and Power Set.
- **Lecture 03c**: The `Upair` construction is the foundation for `Pair`.

### 7.2 Links to Future Modules

- **Lecture 04b**: Functions are special relations (functional relations with specified domain).
- **Lecture 04c**: Well-founded relations enable recursion and induction.
- **Module 05**: Equipollence ($A \approx B$) is defined via bijections, which are special relations.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1993).** "Set Theory for Verification: I. From Foundations to Functions." *Journal of Automated Reasoning*, 11(3), 353--389.
   - *Section 6: ordered pairs, products, and relations.*

### Recommended

2. **Kuratowski, C. (1921).** "Sur la notion de l'ordre dans la Theorie des Ensembles." *Fundamenta Mathematicae*, 2, 161--171.
   - *The original definition of ordered pairs.*

---

## 9. Exercises

### Theory

**Exercise 4a.1.** Verify the Kuratowski pair characterization: prove on paper that $\{\{a\}, \{a, b\}\} = \{\{c\}, \{c, d\}\}$ implies $a = c$ and $b = d$, handling all cases.

**Exercise 4a.2.** Show that the Wiener pair $\langle a, b \rangle_W = \{\{\{a\}, \emptyset\}, \{\{b\}\}\}$ also satisfies the ordered pair property. Compare with Kuratowski's definition.

**Exercise 4a.3.** Prove on paper that `domain(r O s) \<subseteq> domain(s)` and `range(r O s) \<subseteq> range(r)`.

**Exercise 4a.4.** Prove that if `equiv(A, r)` and `equiv(A, s)`, then `equiv(A, r \<inter> s)`.

### Isabelle

**Exercise 4a.5.** Prove in Isabelle/ZF:
```isabelle
lemma "A \<times> B = 0 \<longleftrightarrow> A = 0 \<or> B = 0"
lemma "converse(A \<times> B) = B \<times> A"
lemma "domain(A \<times> B) = (if B = 0 then 0 else A)"
```

**Exercise 4a.6.** Prove: `(r O s) O t = r O (s O t)` (associativity of composition).

**Exercise 4a.7.** Prove: `converse(r O s) = converse(s) O converse(r)`.

**Exercise 4a.8.** Define the identity relation on $A$:
```isabelle
definition id_rel :: "i => i" where "id_rel(A) \<equiv> {<x,x>. x \<in> A}"
```
Prove: `r O id_rel(domain(r)) = r` (assuming `r \<subseteq> domain(r) \<times> range(r)`).
