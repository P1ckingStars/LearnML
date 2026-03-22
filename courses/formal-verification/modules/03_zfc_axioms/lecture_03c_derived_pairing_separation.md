# Lecture 03c: Derived Pairing & Separation

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Prove** that the unordered pair `Upair(a,b)` can be derived from Replacement and Power Set, without an explicit Pairing axiom.
2. **Explain** why `Pow(Pow(0)) = {0, {0}}` and how this two-element set bootstraps pairing.
3. **Define** binary union, binary intersection, singletons, and set difference from unordered pairs and Separation.
4. **State** the successor operation `succ(x) = x \<union> {x}` and `cons(a, A) = Upair(a,a) \<union> A`.
5. **Walk through** the key definitions and lemmas in `upair.thy`.
6. **Prove** basic identities involving these derived operations in Isabelle/ZF.

---

## 2. Motivation and Context

### 2.1 The Minimality Principle

One of the elegant features of Isabelle's ZF axiomatization is its minimality: only six axioms, from which all standard set-theoretic constructions are derived. The most surprising derivation is *pairing*: the ability to form the set $\{a, b\}$ from any two sets $a$ and $b$.

In most textbooks, pairing is taken as an axiom:

$$\forall a.\, \forall b.\, \exists C.\, \forall x.\, (x \in C \iff x = a \lor x = b)$$

Isabelle instead derives this from Replacement and Power Set. The construction, due to Suppes, is a beautiful piece of combinatorial set theory.

### 2.2 The Structure of upair.thy

The file `upair.thy` in the Isabelle/ZF distribution defines and develops:

1. Unordered pairs: `Upair(a, b)`
2. Singletons: `{a}` (as `cons(a, 0)`)
3. The `cons` operation: `cons(a, A) = Upair(a, a) \<union> A`
4. Binary union: `A \<union> B = \<Union>(Upair(A, B))`
5. Binary intersection: `A \<inter> B` (via Separation)
6. Set difference: `A - B` (via Separation)
7. The conditional: `if P then a else b`
8. Successor: `succ(x) = cons(x, x)`

---

## 3. Core Theory

### 3.1 The Key Insight: Pow(Pow(0))

Before constructing unordered pairs, we need a two-element set to serve as an "index set". The empty set `0` gives us a starting point:

**Lemma 3.1.** $\mathcal{P}(0) = \{0\}$.

*Proof.* $A \in \mathcal{P}(0) \iff A \subseteq 0 \iff A = 0$. The forward direction: if every element of $A$ is in $0 = \emptyset$, then $A$ has no elements, so $A = 0$. The backward direction: $0 \subseteq 0$ trivially. $\blacksquare$

```isabelle
lemma Pow_0: "Pow(0) = {0}"
  by blast
```

**Lemma 3.2.** $\mathcal{P}(\mathcal{P}(0)) = \{0, \{0\}\}$.

*Proof.* $\mathcal{P}(\{0\}) = \{A : A \subseteq \{0\}\}$. The subsets of $\{0\}$ are $0$ and $\{0\}$ itself. So $\mathcal{P}(\{0\}) = \{0, \{0\}\}$. $\blacksquare$

This gives us a *specific two-element set* without any pairing axiom: $\mathcal{P}(\mathcal{P}(0))$ has exactly two elements, $0$ and $\{0\}$.

### 3.2 Constructing Unordered Pairs

**Definition 3.1 (Upair).** For any sets $a$ and $b$:

$$\mathrm{Upair}(a, b) = \{y : x \in \mathcal{P}(\mathcal{P}(0)),\, (x = 0 \land y = a) \lor (x = \mathcal{P}(0) \land y = b)\}$$

In Isabelle syntax:

```isabelle
definition Upair :: "[i, i] => i" where
  "Upair(a, b) \<equiv>
    PrimReplace(Pow(Pow(0)),
      \<lambda>x y. (x = 0 \<and> y = a) \<or> (x = Pow(0) \<and> y = b))"
```

**Theorem 3.1.** $\mathrm{Upair}(a, b) = \{a, b\}$. That is, $c \in \mathrm{Upair}(a, b) \iff c = a \lor c = b$.

*Proof.* We must verify:

1. **The predicate is functional on $\mathcal{P}(\mathcal{P}(0))$.** Let $P(x, y) \equiv (x = 0 \land y = a) \lor (x = \mathcal{P}(0) \land y = b)$. For any $x \in \mathcal{P}(\mathcal{P}(0))$, we have $x = 0$ or $x = \mathcal{P}(0)$ (since these are the only two elements). If $x = 0$, then $P(x, y)$ forces $y = a$, which is unique. If $x = \mathcal{P}(0)$, then $P(x, y)$ forces $y = b$, which is unique. So $P$ is functional.

2. **Characterization.** By the Replacement axiom:
   $c \in \mathrm{Upair}(a, b)$
   $\iff \exists x \in \mathcal{P}(\mathcal{P}(0)).\, P(x, c)$
   $\iff (0 \in \mathcal{P}(\mathcal{P}(0)) \land c = a) \lor (\mathcal{P}(0) \in \mathcal{P}(\mathcal{P}(0)) \land c = b)$
   $\iff c = a \lor c = b$

   where the last step uses the facts $0 \in \mathcal{P}(\mathcal{P}(0))$ and $\mathcal{P}(0) \in \mathcal{P}(\mathcal{P}(0))$, both of which follow from $0 \subseteq \mathcal{P}(0)$ and $\mathcal{P}(0) \subseteq \mathcal{P}(0)$. $\blacksquare$

```isabelle
lemma Upair_iff [simp]: "c \<in> Upair(a,b) \<longleftrightarrow> (c = a \<or> c = b)"
```

### 3.3 Derived Operations from Upair

With unordered pairs in hand, we can define the standard set operations.

**Definition 3.2 (Binary Union).**

$$A \cup B = \bigcup \mathrm{Upair}(A, B)$$

```isabelle
definition Un :: "[i, i] => i"  (infixl "\<union>" 65) where
  "A \<union> B \<equiv> \<Union>(Upair(A, B))"
```

**Verification:**
$x \in A \cup B$
$\iff x \in \bigcup \mathrm{Upair}(A, B)$
$\iff \exists C \in \mathrm{Upair}(A, B).\, x \in C$
$\iff (x \in A) \lor (x \in B)$

**Definition 3.3 (Singleton).**

$$\{a\} = \mathrm{Upair}(a, a)$$

More precisely, singletons in Isabelle/ZF use the `cons` operation (see below), but the basic idea is $\mathrm{Upair}(a, a) = \{a\}$.

```isabelle
lemma Upair_same: "Upair(a, a) = {a}"
  by blast
```

**Definition 3.4 (cons).**

$$\mathrm{cons}(a, A) = \mathrm{Upair}(a, a) \cup A = \{a\} \cup A$$

```isabelle
definition cons :: "[i, i] => i" where
  "cons(a, A) \<equiv> Upair(a, a) \<union> A"
```

The finite set notation `{a, b, c}` is syntactic sugar for `cons(a, cons(b, cons(c, 0)))`.

**Definition 3.5 (Successor).**

$$\mathrm{succ}(x) = \mathrm{cons}(x, x) = \{x\} \cup x = x \cup \{x\}$$

```isabelle
definition succ :: "i => i" where
  "succ(x) \<equiv> cons(x, x)"
```

The von Neumann encoding of natural numbers is:
- $0 = \emptyset$
- $1 = \mathrm{succ}(0) = \{0\} = \{\emptyset\}$
- $2 = \mathrm{succ}(1) = \{0, 1\} = \{\emptyset, \{\emptyset\}\}$
- $3 = \mathrm{succ}(2) = \{0, 1, 2\} = \{\emptyset, \{\emptyset\}, \{\emptyset, \{\emptyset\}\}\}$

Each natural number $n$ is the set of all natural numbers less than $n$.

### 3.4 Separation as Derived

**Definition 3.6 (Collect / Separation).**

$$\mathrm{Collect}(A, P) = \{x \in A : P(x)\}$$

As shown in Lecture 03b, this is defined via PrimReplace:

```isabelle
definition Collect :: "[i, i => o] => i" where
  "Collect(A, P) \<equiv> PrimReplace(A, \<lambda>x y. x = y \<and> P(x))"
```

**Key characterization:**

```isabelle
lemma Collect_iff [simp]: "b \<in> Collect(A, P) \<longleftrightarrow> b \<in> A \<and> P(b)"
```

### 3.5 Binary Intersection

**Definition 3.7 (Binary Intersection).**

$$A \cap B = \{x \in A : x \in B\}$$

```isabelle
definition Int :: "[i, i] => i"  (infixl "\<inter>" 70) where
  "A \<inter> B \<equiv> Collect(A, \<lambda>x. x \<in> B)"
```

This uses Separation (Collect): starting from $A$, we keep only those elements that also belong to $B$.

**Characterization:**

```isabelle
lemma Int_iff [simp]: "c \<in> A \<inter> B \<longleftrightarrow> c \<in> A \<and> c \<in> B"
```

### 3.6 Set Difference

**Definition 3.8 (Set Difference).**

$$A \setminus B = \{x \in A : x \notin B\}$$

```isabelle
definition Diff :: "[i, i] => i"  (infixl "-" 65) where
  "A - B \<equiv> Collect(A, \<lambda>x. x \<notin> B)"
```

**Characterization:**

```isabelle
lemma Diff_iff [simp]: "c \<in> A - B \<longleftrightarrow> c \<in> A \<and> c \<notin> B"
```

### 3.7 General Intersection

**Definition 3.9 (Intersection of a Family).**

$$\bigcap C = \{x \in \bigcup C : \forall B \in C.\, x \in B\}$$

```isabelle
definition Inter :: "i => i"  ("\<Inter>_" [90] 90) where
  "\<Inter>(C) \<equiv> Collect(\<Union>(C), \<lambda>x. \<forall>B\<in>C. x \<in> B)"
```

Note: $\bigcap \emptyset$ is problematic because it would be the class of all sets. The definition handles this by using $\bigcup C$ as the bounding set: if $C = \emptyset$, then $\bigcup C = \emptyset$, so $\bigcap \emptyset = \emptyset$.

---

## 4. Key Lemmas from upair.thy

### 4.1 Membership Lemmas

```isabelle
lemma UpairI1:  "a \<in> Upair(a, b)"
lemma UpairI2:  "b \<in> Upair(a, b)"
lemma UpairE:
  "\<lbrakk> c \<in> Upair(a, b); c = a \<Longrightarrow> P; c = b \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"

lemma UnI1:  "c \<in> A \<Longrightarrow> c \<in> A \<union> B"
lemma UnI2:  "c \<in> B \<Longrightarrow> c \<in> A \<union> B"
lemma UnE:
  "\<lbrakk> c \<in> A \<union> B; c \<in> A \<Longrightarrow> P; c \<in> B \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"

lemma IntI:  "\<lbrakk> c \<in> A; c \<in> B \<rbrakk> \<Longrightarrow> c \<in> A \<inter> B"
lemma IntD1: "c \<in> A \<inter> B \<Longrightarrow> c \<in> A"
lemma IntD2: "c \<in> A \<inter> B \<Longrightarrow> c \<in> B"

lemma DiffI:  "\<lbrakk> c \<in> A; c \<notin> B \<rbrakk> \<Longrightarrow> c \<in> A - B"
lemma DiffD1: "c \<in> A - B \<Longrightarrow> c \<in> A"
lemma DiffD2: "c \<in> A - B \<Longrightarrow> c \<notin> B"
```

### 4.2 Successor Lemmas

```isabelle
lemma succI1: "i \<in> succ(i)"
lemma succI2: "i \<in> j \<Longrightarrow> i \<in> succ(j)"
lemma succE:
  "\<lbrakk> i \<in> succ(j); i = j \<Longrightarrow> P; i \<in> j \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"

lemma succ_iff: "i \<in> succ(j) \<longleftrightarrow> i = j \<or> i \<in> j"
lemma succ_neq_0: "succ(n) \<noteq> 0"
```

The last lemma `succ_neq_0` is crucial: no successor is the empty set. This is one of the Peano axioms, derived here from the ZF axioms.

---

## 5. Proofs of Basic Set Identities

### 5.1 Commutativity of Union

```isabelle
lemma Un_commute: "A \<union> B = B \<union> A"
proof (rule equalityI)
  show "A \<union> B \<subseteq> B \<union> A"
  proof (rule subsetI)
    fix x assume "x \<in> A \<union> B"
    then show "x \<in> B \<union> A"
      by (auto elim: UnE intro: UnI1 UnI2)
  qed
next
  show "B \<union> A \<subseteq> A \<union> B"
  proof (rule subsetI)
    fix x assume "x \<in> B \<union> A"
    then show "x \<in> A \<union> B"
      by (auto elim: UnE intro: UnI1 UnI2)
  qed
qed
```

In practice: `by blast`.

### 5.2 Distributivity

```isabelle
lemma Int_Un_distrib: "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"
  by blast

lemma Un_Int_distrib: "A \<union> (B \<inter> C) = (A \<union> B) \<inter> (A \<union> C)"
  by blast
```

### 5.3 Empty Set Identities

```isabelle
lemma Un_0: "A \<union> 0 = A"
  by blast

lemma Int_0: "A \<inter> 0 = 0"
  by blast

lemma Diff_0: "A - 0 = A"
  by blast
```

---

## 6. Connections and Extensions

### 6.1 Links to Prior Modules

- **Lecture 03a**: The primitive constants (`Pow`, `Union`, `PrimReplace`) are used here to derive pairing.
- **Lecture 03b**: The Replacement and Power Set axioms are the key ingredients.

### 6.2 Links to Future Modules

- **Lecture 03d**: Bounded quantifiers and comprehension notation build on `Collect` (Separation).
- **Module 04**: Ordered pairs `<a, b>` are built from unordered pairs via the Kuratowski encoding.

---

## 7. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1993).** "Set Theory for Verification: I. From Foundations to Functions." *Journal of Automated Reasoning*, 11(3), 353--389.
   - *Section 4 covers the derived pairing construction.*

### Recommended

2. **Suppes, P. (1960).** *Axiomatic Set Theory.* Dover.
   - *Chapter 2, Theorem Schema 37: the original derivation of Pairing from Replacement + Power Set.*

---

## 8. Exercises

### Theory

**Exercise 3c.1.** Verify the construction of `Upair` by showing directly (without Isabelle) that the predicate $P(x, y) \equiv (x = 0 \land y = a) \lor (x = \mathcal{P}(0) \land y = b)$ is functional on $\mathcal{P}(\mathcal{P}(0))$.

**Exercise 3c.2.** Show that $\mathrm{cons}(a, A) = \{a\} \cup A$. Then show that $\{a, b, c\} = \mathrm{cons}(a, \mathrm{cons}(b, \mathrm{cons}(c, 0)))$ has exactly three elements when $a$, $b$, $c$ are distinct.

**Exercise 3c.3.** Prove that for any set $A$: $A \cup A = A$, $A \cap A = A$, $A - A = 0$.

**Exercise 3c.4.** Prove De Morgan's laws for sets: $(A \cup B)^c = A^c \cap B^c$ and $(A \cap B)^c = A^c \cup B^c$, where $A^c$ denotes the complement relative to some universal set $U$. Explain why there is no absolute complement in ZF.

### Isabelle

**Exercise 3c.5.** Prove in Isabelle/ZF:
```isabelle
lemma "succ(0) = {0}"
lemma "succ(succ(0)) = {0, succ(0)}"
lemma "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"
```

**Exercise 3c.6.** Prove: `cons(a, cons(b, 0)) = Upair(a, b)`.

**Exercise 3c.7.** Prove that `\<Inter>({A, B}) = A \<inter> B` and `\<Union>({A, B}) = A \<union> B`.

**Exercise 3c.8.** Define the symmetric difference $A \triangle B = (A - B) \cup (B - A)$ and prove that $\triangle$ is commutative and associative.
