# Lecture 03b: The Six ZF Axioms

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **State** each of the six ZF axioms as formalized in ZF_Base.thy and translate them into standard mathematical notation.
2. **Explain** the role of each axiom: what it asserts, what constructions it enables, and what breaks without it.
3. **Compare** Isabelle's axiomatization with standard textbook presentations (Kunen, Suppes, Jech).
4. **Derive** Separation from Replacement and explain why Isabelle omits it as an axiom.
5. **Explain** why Replacement uses higher-order meta-variables rather than first-order schemas.
6. **Prove** simple consequences of individual axioms in Isabelle/ZF.

---

## 2. Motivation and Context

### 2.1 The Role of Axioms

The ZF axioms accomplish two things: they assert the *existence* of certain sets (Infinity, Power Set, Union, Replacement) and they impose *structure* on the membership relation (Extensionality, Foundation). Together, they give us a universe of sets rich enough to formalize all of ordinary mathematics.

Isabelle/ZF uses a minimal axiom set: six axioms that generate everything else. The standard textbook presentation typically lists seven to nine axioms (including Pairing, Separation, and sometimes the Empty Set axiom). Isabelle derives these from the six primitives.

### 2.2 Historical Note

Zermelo published his original axiom system in 1908, including Separation but not Replacement. Fraenkel (1922) and Skolem (1923) independently added Replacement, which is needed to prove the existence of $\aleph_\omega$ and to carry out transfinite recursion in full generality. The Regularity axiom (Foundation) was added by von Neumann in 1925.

---

## 3. Core Theory

### 3.1 Axiom 1: Extensionality

**Isabelle statement:**

```isabelle
axiom extension:
  "A = B \<longleftrightarrow> (\<forall>x. x \<in> A \<longleftrightarrow> x \<in> B)"
```

**Mathematical notation:**

$$A = B \iff \forall x.\, (x \in A \iff x \in B)$$

**What it says.** Two sets are equal if and only if they have exactly the same members. This is the defining property of sets: a set is completely determined by its members.

**What it enables.** Extensionality gives us a *method* for proving set equality: show mutual inclusion. Every proof of `A = B` in Isabelle/ZF ultimately reduces to showing `\<forall>x. x \<in> A \<longleftrightarrow> x \<in> B`.

**Derived rules in Isabelle:**

```isabelle
lemma equalityI:
  "\<lbrakk> A \<subseteq> B; B \<subseteq> A \<rbrakk> \<Longrightarrow> A = B"

lemma equalityE:
  "\<lbrakk> A = B; \<lbrakk> A \<subseteq> B; B \<subseteq> A \<rbrakk> \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"

lemma equalityD1: "A = B \<Longrightarrow> A \<subseteq> B"
lemma equalityD2: "A = B \<Longrightarrow> B \<subseteq> A"
```

**Example proof.** To prove `A \<inter> B = B \<inter> A`, we show mutual inclusion:

```isabelle
lemma Int_commute: "A \<inter> B = B \<inter> A"
proof (rule equalityI)
  show "A \<inter> B \<subseteq> B \<inter> A"
  proof (rule subsetI)
    fix x assume "x \<in> A \<inter> B"
    then have "x \<in> A" and "x \<in> B" by auto
    then show "x \<in> B \<inter> A" by auto
  qed
next
  show "B \<inter> A \<subseteq> A \<inter> B"
  proof (rule subsetI)
    fix x assume "x \<in> B \<inter> A"
    then have "x \<in> B" and "x \<in> A" by auto
    then show "x \<in> A \<inter> B" by auto
  qed
qed
```

In practice, `auto` or `blast` handles this directly:

```isabelle
lemma Int_commute: "A \<inter> B = B \<inter> A"
  by blast
```

### 3.2 Axiom 2: Union

**Isabelle statement:**

```isabelle
axiom Union_iff:
  "A \<in> \<Union>(C) \<longleftrightarrow> (\<exists>B\<in>C. A \<in> B)"
```

**Mathematical notation:**

$$x \in \bigcup C \iff \exists B \in C.\, x \in B$$

**What it says.** The union of a set of sets $C$ contains exactly those elements that belong to at least one member of $C$. If $C = \{A_1, A_2, A_3, \ldots\}$, then $\bigcup C = A_1 \cup A_2 \cup A_3 \cup \cdots$.

**What it enables.** Given any collection of sets (itself a set), we can form their union. This is essential for constructing limit stages in transfinite constructions.

**Derived rules:**

```isabelle
lemma UnionI:
  "\<lbrakk> B \<in> C; A \<in> B \<rbrakk> \<Longrightarrow> A \<in> \<Union>(C)"

lemma UnionE:
  "\<lbrakk> A \<in> \<Union>(C); \<And>B. \<lbrakk> A \<in> B; B \<in> C \<rbrakk> \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"
```

**Example.** The binary union `A \<union> B` is defined as `\<Union>(Upair(A, B))`. To show `x \<in> A \<union> B`, we produce a witness: either `A` or `B` is in `Upair(A, B)`, and `x` is in that witness.

### 3.3 Axiom 3: Power Set

**Isabelle statement:**

```isabelle
axiom power_set:
  "A \<in> Pow(B) \<longleftrightarrow> A \<subseteq> B"
```

**Mathematical notation:**

$$A \in \mathcal{P}(B) \iff A \subseteq B$$

**What it says.** The power set of $B$ contains exactly the subsets of $B$.

**What it enables.** Given any set, we can form the set of all its subsets. Together with Replacement, this gives us pairing (as we will see in Lecture 03c). Power set is also essential for defining function spaces: a function from $A$ to $B$ is a subset of $A \times B$ with certain properties, so it lives in $\mathcal{P}(A \times B)$.

**Derived rules:**

```isabelle
lemma PowI: "A \<subseteq> B \<Longrightarrow> A \<in> Pow(B)"
lemma PowD: "A \<in> Pow(B) \<Longrightarrow> A \<subseteq> B"
```

**Key property.** Power set is the main source of "higher cardinality" in ZFC. Cantor's theorem states $|A| < |\mathcal{P}(A)|$ for every set $A$, which gives us the hierarchy $\aleph_0 < 2^{\aleph_0} < 2^{2^{\aleph_0}} < \cdots$.

### 3.4 Axiom 4: Infinity

**Isabelle statement:**

```isabelle
axiom infinity:
  "0 \<in> Inf \<and> (\<forall>y \<in> Inf. succ(y) \<in> Inf)"
```

**Mathematical notation:**

$$0 \in \mathrm{Inf} \quad \land \quad \forall y \in \mathrm{Inf}.\, \mathrm{succ}(y) \in \mathrm{Inf}$$

where $\mathrm{succ}(y) = y \cup \{y\}$.

**What it says.** There exists a set that contains the empty set and is closed under the successor operation. This is an *inductive set*.

**What it enables.** Without Infinity, we can only construct finite sets. Infinity gives us a set that contains $0, \{0\}, \{0, \{0\}\}, \ldots$ --- the von Neumann encoding of the natural numbers. The set of natural numbers `nat` is then defined as the smallest inductive subset of `Inf`:

```isabelle
definition nat :: i where
  "nat \<equiv> lfp(Inf, \<lambda>X. {0} \<union> {succ(x). x \<in> X})"
```

In Isabelle/ZF, `nat` is defined using `lfp` (least fixed point) applied to the operator $X \mapsto \{0\} \cup \{\mathrm{succ}(x) : x \in X\}$ within the bounding set `Inf`. This is equivalent to the intersection of all inductive subsets of `Inf`.

**Remark.** The Infinity axiom asserts existence of `Inf` as a *constant*. This is slightly different from the textbook formulation, which uses an existential: $\exists I.\, 0 \in I \land \forall y \in I.\, \mathrm{succ}(y) \in I$. Isabelle's formulation is equivalent: the constant `Inf` is a Skolem witness for the existential.

### 3.5 Axiom 5: Foundation (Regularity)

**Isabelle statement:**

```isabelle
axiom foundation:
  "A = 0 \<or> (\<exists>x\<in>A. \<forall>y\<in>x. y \<notin> A)"
```

**Mathematical notation:**

$$A = \emptyset \;\lor\; \exists x \in A.\, \forall y \in x.\, y \notin A$$

**What it says.** Every non-empty set $A$ has a member $x$ that is disjoint from $A$ (i.e., $x \cap A = \emptyset$). Such an $x$ is called an *$\in$-minimal element* of $A$.

**What it enables.** Foundation has several important consequences:

1. **No circular membership.** There is no set $a$ with $a \in a$. *Proof:* Consider $A = \{a\}$. By Foundation, there exists $x \in A$ with $\forall y \in x.\, y \notin A$. The only element is $x = a$, so we need $\forall y \in a.\, y \notin \{a\}$. In particular, $a \notin \{a\}$, i.e., $a \neq a$, which is absurd if $a \in a$.

2. **Well-foundedness of $\in$.** The membership relation on any set is well-founded, enabling $\in$-induction and $\in$-recursion.

3. **The cumulative hierarchy.** Every set appears in some $V_\alpha$, where $V_0 = \emptyset$, $V_{\alpha+1} = \mathcal{P}(V_\alpha)$, and $V_\lambda = \bigcup_{\alpha < \lambda} V_\alpha$ for limit $\lambda$.

```isabelle
lemma mem_not_refl: "a \<notin> a"
proof
  assume "a \<in> a"
  have "{a} \<noteq> 0" using \<open>a \<in> a\<close> by blast
  then obtain x where "x \<in> {a}" and "\<forall>y \<in> x. y \<notin> {a}"
    using foundation by blast
  then have "x = a" by blast
  with \<open>\<forall>y \<in> x. y \<notin> {a}\<close> \<open>a \<in> a\<close> show False by blast
qed
```

### 3.6 Axiom 6: Replacement

**Isabelle statement:**

```isabelle
axiom replacement:
  "(\<forall>x\<in>A. \<forall>y z. P(x,y) \<and> P(x,z) \<longrightarrow> y = z)
   \<Longrightarrow> b \<in> PrimReplace(A,P) \<longleftrightarrow> (\<exists>x\<in>A. P(x,b))"
```

**Mathematical notation (schema version):**

$$\forall x \in A.\, \exists! y.\, \varphi(x,y) \implies \exists B.\, \forall b.\, (b \in B \iff \exists x \in A.\, \varphi(x,b))$$

**What it says.** If $P$ is a functional relation on $A$ (for each $x \in A$ there is at most one $y$ with $P(x,y)$), then the "image" of $A$ under $P$ is a set.

**What it enables.** Replacement is the workhorse of set theory. It allows us to:

- Construct the image of a set under any definable function.
- Carry out transfinite recursion: given a class function $G$, define $F(\alpha) = G(F \restriction \alpha)$ and know that $\{F(\alpha) : \alpha < \beta\}$ is a set.
- Derive Separation (see below).
- Derive the Axiom of Pairing (with Power Set; see Lecture 03c).

**Functionality condition.** The premise `\<forall>x\<in>A. \<forall>y z. P(x,y) \<and> P(x,z) \<longrightarrow> y = z` is essential. Without it, `PrimReplace(A, P)` could be a proper class. For example, if `P(x, y) \<longleftrightarrow> True`, then `PrimReplace(A, P)` would be "all sets", which is not a set (Russell's paradox).

---

## 4. Deriving Separation from Replacement

### 4.1 The Separation Principle

**Theorem 4.1 (Separation).** For any set $A$ and property $P$, the set $\{x \in A : P(x)\}$ exists.

In Isabelle/ZF, `Collect(A, P)` denotes this set. It is *defined* using `PrimReplace`:

```isabelle
definition Collect :: "[i, i => o] => i" where
  "Collect(A, P) \<equiv> PrimReplace(A, \<lambda>x y. x = y \<and> P(x))"
```

**Proof that this works.** Define $Q(x, y) \equiv (x = y \land P(x))$. Then:

1. **Functionality.** If $Q(x, y)$ and $Q(x, z)$, then $x = y$ and $x = z$, so $y = z$. The functionality condition is satisfied.

2. **Characterization.** $b \in \mathrm{PrimReplace}(A, Q)$ iff $\exists x \in A.\, Q(x, b)$ iff $\exists x \in A.\, (x = b \land P(x))$ iff $b \in A \land P(b)$.

So $\mathrm{PrimReplace}(A, Q) = \{x \in A : P(x)\}$ as desired. $\blacksquare$

### 4.2 Why This Matters

This derivation shows that Isabelle's axiom set is truly minimal. Many textbooks include Separation as a separate axiom, but it is redundant in the presence of Replacement. By deriving Separation, Isabelle/ZF reduces the trusted axiom base.

---

## 5. Comparison with Textbook Presentations

### 5.1 Kunen's Axioms

Kenneth Kunen's *Set Theory* (2011) lists the following axioms:

1. Extensionality
2. Foundation
3. Comprehension Schema (Separation)
4. Pairing
5. Union
6. Replacement Schema
7. Infinity
8. Power Set
9. Choice (for ZFC)

Isabelle omits axioms 3 (Separation) and 4 (Pairing) because they follow from 6 (Replacement) and 8 (Power Set).

### 5.2 Suppes's Axioms

Patrick Suppes's *Axiomatic Set Theory* (1960) uses a similar list but with explicit Separation. Suppes also derives Pairing from Replacement + Power Set, using essentially the same construction that Isabelle uses.

### 5.3 Jech's Axioms

Thomas Jech's *Set Theory* (2003) uses the same axioms as Kunen but with slightly different formulations. The key difference is that Jech formulates Replacement as a schema quantified over first-order formulas, while Isabelle uses higher-order meta-variables.

### 5.4 The Schema Question

In textbook set theory, Replacement is an axiom *schema*: for each first-order formula $\varphi(x, y, \vec{p})$, we get one axiom instance. This gives infinitely many axioms. Isabelle's formulation with a meta-variable `P :: [i, i] => o` captures all instances at once. Each concrete instantiation of `P` (which happens when the axiom is applied in a proof) gives one instance of the schema.

This is possible because Isabelle's metalogic is higher-order: meta-variables can range over functions and predicates, not just terms. In a first-order proof assistant, one would need an explicit reflection mechanism or Godel coding to achieve the same effect.

---

## 6. Using the Axioms in Proofs

### 6.1 Typical Proof Patterns

Most proofs in Isabelle/ZF do not invoke the raw axioms directly. Instead, they use derived rules like `subsetI`, `equalityI`, `UnionI`, `PowI`, etc. The raw axioms are wrapped in introduction and elimination rules:

```isabelle
(* Introduction rules *)
lemma UnionI: "\<lbrakk> B \<in> C; A \<in> B \<rbrakk> \<Longrightarrow> A \<in> \<Union>(C)"
lemma PowI:   "A \<subseteq> B \<Longrightarrow> A \<in> Pow(B)"

(* Elimination rules *)
lemma UnionE: "\<lbrakk> A \<in> \<Union>(C); \<And>B. \<lbrakk> A \<in> B; B \<in> C \<rbrakk> \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"
lemma PowD:   "A \<in> Pow(B) \<Longrightarrow> A \<subseteq> B"
```

### 6.2 A Proof Using Foundation

Let us prove the asymmetry of membership: if $a \in b$, then $b \notin a$.

```isabelle
lemma mem_asym: "\<lbrakk> a \<in> b \<rbrakk> \<Longrightarrow> b \<notin> a"
proof
  assume ab: "a \<in> b" and ba: "b \<in> a"
  let ?A = "{a, b}"
  have "?A \<noteq> 0" using ab by blast
  then obtain x where xA: "x \<in> ?A" and disj: "\<forall>y\<in>x. y \<notin> ?A"
    using foundation by blast
  from xA have "x = a \<or> x = b" by auto
  then show False
  proof
    assume "x = a"
    with disj ab have "b \<notin> ?A" by auto
    then show False by auto
  next
    assume "x = b"
    with disj ba have "a \<notin> ?A" by auto
    then show False by auto
  qed
qed
```

This proof constructs the two-element set $\{a, b\}$ and applies Foundation to get an element disjoint from $\{a, b\}$. But any element of $\{a, b\}$ contains another element of $\{a, b\}$ (since $a \in b$ and $b \in a$), giving a contradiction.

### 6.3 A Proof Using Replacement

Here is how we might use Replacement to construct a specific set. Suppose we want to form $\{f(x) : x \in A\}$ for a definable function $f$:

```isabelle
lemma RepFun_iff: "b \<in> {f(x). x \<in> A} \<longleftrightarrow> (\<exists>x\<in>A. b = f(x))"
  by blast
```

Under the hood, `{f(x). x \<in> A}` is syntactic sugar for `RepFun(A, f)`, which is defined as:

```isabelle
definition RepFun :: "[i, i => i] => i" where
  "RepFun(A, f) \<equiv> PrimReplace(A, \<lambda>x y. y = f(x))"
```

The functionality condition is trivially satisfied since `\<lambda>x y. y = f(x)` is functional by construction.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Module 02 (FOL)**: The quantifiers, connectives, and proof methods used throughout this lecture come from the FOL layer.
- **Lecture 03a**: The constants and types discussed here were introduced in Lecture 03a.

### 7.2 Links to Future Modules

- **Lecture 03c**: We will see how Pairing is derived from Power Set and Replacement.
- **Lecture 03d**: Bounded quantifiers and comprehension notation build on Separation (derived from Replacement).
- **Module 04**: Functions, ordinals, and transfinite constructions rely heavily on Replacement and Union.
- **Module 05**: The Axiom of Choice is *not* part of ZF. Module 05 studies what it adds.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1993).** "Set Theory for Verification: I. From Foundations to Functions." *Journal of Automated Reasoning*, 11(3), 353--389.
   - *Read Section 3 for the axiomatization. Compare with this lecture.*

### Recommended

2. **Kunen, K. (2011).** *Set Theory.* College Publications.
   - *Chapter I, Section 3: the ZFC axioms. The standard modern reference.*

3. **Fraenkel, A. A., Bar-Hillel, Y., & Levy, A. (1973).** *Foundations of Set Theory.* North-Holland.
   - *Historical discussion of the axioms and their motivations.*

---

## 9. Exercises

### Theory

**Exercise 3b.1.** Prove from the axioms that there is no set of all sets. That is, show $\neg \exists V.\, \forall x.\, x \in V$. (Use Separation and Russell's argument.)

**Exercise 3b.2.** Show that Foundation implies there is no infinite descending chain $\cdots \in a_2 \in a_1 \in a_0$. (Hint: form the set $\{a_0, a_1, a_2, \ldots\}$ and apply Foundation.)

**Exercise 3b.3.** Verify that the functionality condition for Replacement is necessary by constructing a "replacement" without it that would yield a proper class.

**Exercise 3b.4.** Compare the formulation of Replacement in Kunen's textbook with Isabelle's formulation. Write out both versions and explain the correspondence.

### Isabelle

**Exercise 3b.5.** Prove in Isabelle/ZF:
```isabelle
lemma "A \<in> Pow(A)"
lemma "0 \<in> Pow(A)"
lemma "Pow(0) = {0}"
```

**Exercise 3b.6.** Prove:
```isabelle
lemma "\<Union>(0) = 0"
lemma "\<Union>({A}) = A"
lemma "\<Union>({A, B}) = A \<union> B"
```

**Exercise 3b.7.** Prove that Foundation implies `a \<notin> a` for all `a`, and then prove `a \<noteq> {a}` for all `a`.

**Exercise 3b.8.** Prove that Replacement preserves subsets: if $A \subseteq B$ and $P$ is functional on $B$, then $\mathrm{PrimReplace}(A, P) \subseteq \mathrm{PrimReplace}(B, P)$.
