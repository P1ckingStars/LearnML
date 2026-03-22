# Lecture 03d: Bounded Quantifiers & Comprehension

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** bounded quantifiers `Ball(A, P)` and `Bex(A, P)` and use their Isabelle notation `\<forall>x\<in>A. P(x)` and `\<exists>x\<in>A. P(x)`.
2. **Distinguish** between replacement (`RepFun`, `Replace`, `PrimReplace`) and separation (`Collect`) and use the correct notation for each.
3. **Use** set comprehension syntax `{f(x). x \<in> A}` and `{x \<in> A. P(x)}` in Isabelle/ZF proofs.
4. **Prove** basic set identities from `equalities.thy` using `auto`, `blast`, and set-specific tactics.
5. **Define** and work with the Booleans `bool = {0, 1}` and the conditional `cond(P, a, b)` from `Bool.thy`.
6. **Navigate** the type-checking workflow for set membership obligations.

---

## 2. Motivation and Context

### 2.1 Why Bounded Quantifiers?

In ZFC, we frequently quantify over elements of a particular set rather than over all sets. The statements "for all $x \in A$, $P(x)$" and "there exists $x \in A$ such that $P(x)$" are the bread and butter of set-theoretic reasoning. While these can be expressed using ordinary quantifiers:

$$\forall x \in A.\, P(x) \equiv \forall x.\, x \in A \implies P(x)$$
$$\exists x \in A.\, P(x) \equiv \exists x.\, x \in A \land P(x)$$

having dedicated bounded quantifiers provides better notation, better automation, and cleaner proof states. Isabelle/ZF defines them as abbreviations with their own introduction and elimination rules.

### 2.2 Why Comprehension Notation?

Set comprehension is the primary way to construct new sets in mathematics. The notation $\{f(x) : x \in A\}$ and $\{x \in A : P(x)\}$ is so standard that any formalization must support it. Isabelle/ZF provides three levels of comprehension:

| Notation | Isabelle Name | Operation |
|----------|---------------|-----------|
| `{x \<in> A. P(x)}` | `Collect(A, P)` | Separation |
| `{f(x). x \<in> A}` | `RepFun(A, f)` | Replacement (functional) |
| `{y. x \<in> A, P(x, y)}` | `Replace(A, P)` | General replacement |

Each corresponds to a different use of the Replacement axiom.

---

## 3. Core Theory

### 3.1 Bounded Universal Quantifier

**Definition 3.1 (Ball).**

```isabelle
definition Ball :: "[i, i => o] => o" where
  "Ball(A, P) \<equiv> \<forall>x. x \<in> A \<longrightarrow> P(x)"

syntax  "_Ball" :: "[pttrn, i, o] => o"  ("(3\<forall>_\<in>_./ _)" 10)
translations  "\<forall>x\<in>A. P" \<rightleftharpoons> "CONST Ball(A, \<lambda>x. P)"
```

**Introduction and elimination rules:**

```isabelle
lemma ballI [intro!]:
  "(\<And>x. x \<in> A \<Longrightarrow> P(x)) \<Longrightarrow> \<forall>x\<in>A. P(x)"

lemma ballE [elim]:
  "\<lbrakk> \<forall>x\<in>A. P(x); P(a) \<Longrightarrow> Q; a \<notin> A \<Longrightarrow> Q \<rbrakk> \<Longrightarrow> Q"

lemma bspec:
  "\<lbrakk> \<forall>x\<in>A. P(x); a \<in> A \<rbrakk> \<Longrightarrow> P(a)"
```

The rule `bspec` is the most frequently used: given that $P$ holds for all elements of $A$, and $a \in A$, conclude $P(a)$.

### 3.2 Bounded Existential Quantifier

**Definition 3.2 (Bex).**

```isabelle
definition Bex :: "[i, i => o] => o" where
  "Bex(A, P) \<equiv> \<exists>x. x \<in> A \<and> P(x)"

syntax  "_Bex" :: "[pttrn, i, o] => o"  ("(3\<exists>_\<in>_./ _)" 10)
translations  "\<exists>x\<in>A. P" \<rightleftharpoons> "CONST Bex(A, \<lambda>x. P)"
```

**Introduction and elimination rules:**

```isabelle
lemma bexI [intro]:
  "\<lbrakk> P(a); a \<in> A \<rbrakk> \<Longrightarrow> \<exists>x\<in>A. P(x)"

lemma bexE [elim!]:
  "\<lbrakk> \<exists>x\<in>A. P(x); \<And>x. \<lbrakk> x \<in> A; P(x) \<rbrakk> \<Longrightarrow> Q \<rbrakk> \<Longrightarrow> Q"

lemma bexCI:
  "\<lbrakk> \<forall>x\<in>A. \<not>P(x) \<Longrightarrow> P(a); a \<in> A \<rbrakk> \<Longrightarrow> \<exists>x\<in>A. P(x)"
```

### 3.3 Relationships Between Bounded Quantifiers

The bounded quantifiers interact with negation in the expected way:

```isabelle
lemma ball_not_bex: "(\<forall>x\<in>A. \<not>P(x)) \<longleftrightarrow> \<not>(\<exists>x\<in>A. P(x))"

lemma bex_not_ball: "(\<exists>x\<in>A. \<not>P(x)) \<longleftrightarrow> \<not>(\<forall>x\<in>A. P(x))"
```

These are the bounded versions of the classical duality between $\forall$ and $\exists$.

**Monotonicity:**

```isabelle
lemma ball_mono:
  "\<lbrakk> A \<subseteq> B; \<forall>x\<in>B. P(x) \<rbrakk> \<Longrightarrow> \<forall>x\<in>A. P(x)"

lemma bex_mono:
  "\<lbrakk> A \<subseteq> B; \<exists>x\<in>A. P(x) \<rbrakk> \<Longrightarrow> \<exists>x\<in>B. P(x)"
```

### 3.4 Set Comprehension: Collect (Separation)

Recall from Lecture 03c:

```isabelle
definition Collect :: "[i, i => o] => i" where
  "Collect(A, P) \<equiv> PrimReplace(A, \<lambda>x y. x = y \<and> P(x))"
```

The notation `{x \<in> A. P(x)}` is syntactic sugar for `Collect(A, \<lambda>x. P(x))`.

**Key rules:**

```isabelle
lemma CollectI [intro!]:
  "\<lbrakk> a \<in> A; P(a) \<rbrakk> \<Longrightarrow> a \<in> {x \<in> A. P(x)}"

lemma CollectE [elim!]:
  "\<lbrakk> a \<in> {x \<in> A. P(x)}; \<lbrakk> a \<in> A; P(a) \<rbrakk> \<Longrightarrow> Q \<rbrakk> \<Longrightarrow> Q"

lemma CollectD1: "a \<in> {x \<in> A. P(x)} \<Longrightarrow> a \<in> A"
lemma CollectD2: "a \<in> {x \<in> A. P(x)} \<Longrightarrow> P(a)"
```

**Example.** The set of even natural numbers:

```isabelle
definition evens :: i where
  "evens \<equiv> {n \<in> nat. \<exists>k\<in>nat. n = k #+ k}"
```

Here `#+` denotes natural number addition in Isabelle/ZF.

### 3.5 Set Comprehension: RepFun (Functional Replacement)

**Definition 3.3 (RepFun).**

```isabelle
definition RepFun :: "[i, i => i] => i" where
  "RepFun(A, f) \<equiv> PrimReplace(A, \<lambda>x y. y = f(x))"
```

The notation `{f(x). x \<in> A}` is syntactic sugar for `RepFun(A, \<lambda>x. f(x))`.

**Key rules:**

```isabelle
lemma RepFunI:
  "a \<in> A \<Longrightarrow> f(a) \<in> {f(x). x \<in> A}"

lemma RepFunE [elim!]:
  "\<lbrakk> b \<in> {f(x). x \<in> A}; \<And>x. \<lbrakk> x \<in> A; b = f(x) \<rbrakk> \<Longrightarrow> P \<rbrakk> \<Longrightarrow> P"

lemma RepFun_iff: "b \<in> {f(x). x \<in> A} \<longleftrightarrow> (\<exists>x\<in>A. b = f(x))"
```

**Example.** The set of successors of natural numbers:

```isabelle
lemma "{succ(n). n \<in> nat} = nat - {0}"
```

This says: applying `succ` to every natural number gives exactly the positive natural numbers.

### 3.6 Set Comprehension: Replace (General Replacement)

**Definition 3.4 (Replace).**

```isabelle
definition Replace :: "[i, [i, i] => o] => i" where
  "Replace(A, P) \<equiv> PrimReplace(A, P)"
```

The notation `{y. x \<in> A, P(x, y)}` denotes `Replace(A, \<lambda>x y. P(x, y))`.

The key difference from `RepFun` is that `Replace` uses a relation $P(x, y)$ rather than a function $f(x) = y$. The functionality condition must be satisfied: for each $x \in A$, there is at most one $y$ with $P(x, y)$.

```isabelle
lemma Replace_iff:
  "(\<forall>x\<in>A. \<forall>y z. P(x,y) \<and> P(x,z) \<longrightarrow> y = z)
   \<Longrightarrow> b \<in> Replace(A, P) \<longleftrightarrow> (\<exists>x\<in>A. P(x, b))"
```

### 3.7 Summary of Comprehension Forms

| Form | Notation | Isabelle | Underlying |
|------|----------|----------|------------|
| Separation | $\{x \in A : P(x)\}$ | `{x \<in> A. P(x)}` | `Collect(A, P)` |
| Functional replacement | $\{f(x) : x \in A\}$ | `{f(x). x \<in> A}` | `RepFun(A, f)` |
| General replacement | $\{y : \exists x \in A.\, P(x, y)\}$ | `{y. x \<in> A, P(x, y)}` | `Replace(A, P)` |

---

## 4. Set Identities: equalities.thy

### 4.1 Overview

The file `equalities.thy` in the Isabelle/ZF distribution proves a comprehensive collection of set identities. These are the building blocks for most set-theoretic proofs.

### 4.2 Distributivity Laws

```isabelle
lemma Int_Un_distrib:
  "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"

lemma Un_Int_distrib:
  "A \<union> (B \<inter> C) = (A \<union> B) \<inter> (A \<union> C)"

lemma Int_Un_distrib2:
  "(B \<union> C) \<inter> A = (B \<inter> A) \<union> (C \<inter> A)"
```

### 4.3 De Morgan's Laws

Since ZF has no universal complement, De Morgan's laws are stated relative to a bounding set:

```isabelle
lemma Diff_Un:
  "A - (B \<union> C) = (A - B) \<inter> (A - C)"

lemma Diff_Int:
  "A - (B \<inter> C) = (A - B) \<union> (A - C)"
```

These are the set-theoretic analogues of $\neg(P \lor Q) \iff \neg P \land \neg Q$ and $\neg(P \land Q) \iff \neg P \lor \neg Q$.

### 4.4 Absorption Laws

```isabelle
lemma Un_Int_absorb: "A \<union> (A \<inter> B) = A"
lemma Int_Un_absorb: "A \<inter> (A \<union> B) = A"
```

### 4.5 Union and Intersection with Special Sets

```isabelle
lemma Un_0:           "A \<union> 0 = A"
lemma Int_0:          "A \<inter> 0 = 0"
lemma Un_absorb:      "A \<union> A = A"
lemma Int_absorb:     "A \<inter> A = A"
lemma Diff_cancel:    "A - A = 0"
lemma Diff_0:         "A - 0 = A"
lemma empty_Diff:     "0 - A = 0"
```

---

## 5. Booleans: Bool.thy

### 5.1 Definition

In Isabelle/ZF, the Booleans are defined as a two-element set:

```isabelle
definition bool :: i where
  "bool \<equiv> {0, 1}"
```

where `1 = succ(0) = {0}`. Note that `0` and `1` are *sets* (everything in ZF is a set), and `bool` is a set containing exactly two elements.

### 5.2 The Conditional

**Definition 3.5 (cond).**

```isabelle
definition cond :: "[o, i, i] => i" where
  "cond(P, a, b) \<equiv> THE z. (P \<longrightarrow> z = a) \<and> (\<not>P \<longrightarrow> z = b)"
```

This is a set-theoretic definition using the definite description operator `THE`. It is *not* a meta-level `if-then-else`; everything in ZF must be defined in terms of sets. The notation `if P then a else b` is syntactic sugar that Isabelle provides for `cond(P, a, b)`.

**Key rules:**

```isabelle
lemma cond_true [simp]:  "P \<Longrightarrow> cond(P, a, b) = a"
lemma cond_false [simp]: "\<not>P \<Longrightarrow> cond(P, a, b) = b"
```

### 5.3 Boolean Operations

```isabelle
definition bool_not :: "i => i" where
  "bool_not(b) \<equiv> cond(b = 1, 0, 1)"

definition bool_and :: "[i, i] => i" where
  "bool_and(a, b) \<equiv> cond(a = 1, b, 0)"

definition bool_or :: "[i, i] => i" where
  "bool_or(a, b) \<equiv> cond(a = 1, 1, b)"
```

These operations are all type-correct: if `a \<in> bool` and `b \<in> bool`, then `bool_not(a) \<in> bool`, etc. But these type-checking obligations must be proved manually.

---

## 6. Proof Techniques for Set Theory

### 6.1 The auto Method

The `auto` method combines simplification with classical reasoning. For set identities, it is often the first method to try:

```isabelle
lemma "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"
  by auto
```

`auto` works by:

1. Rewriting using `[simp]` rules (like `Int_iff`, `Un_iff`, etc.).
2. Applying classical reasoning to handle the resulting logical formulas.
3. Using introduction and elimination rules marked `[intro]` and `[elim]`.

### 6.2 The blast Method

The `blast` method is a tableau-based prover for classical first-order logic. It is often more powerful than `auto` for pure set-membership reasoning:

```isabelle
lemma "A - (B \<inter> C) = (A - B) \<union> (A - C)"
  by blast
```

`blast` does not use simplification rules; instead, it works directly with introduction and elimination rules. It is complete for first-order logic (up to resource limits).

### 6.3 The force and fastforce Methods

These are stronger variants of `auto` that apply more aggressive reasoning:

```isabelle
lemma "\<lbrakk> A \<subseteq> B; B \<subseteq> C; x \<in> A \<rbrakk> \<Longrightarrow> x \<in> C"
  by fastforce
```

### 6.4 The Type-Checking Workflow

A typical proof in Isabelle/ZF alternates between mathematical reasoning and type-checking. Here is a pattern:

```isabelle
lemma function_application_example:
  assumes "f \<in> A \<rightarrow> B"
  assumes "g \<in> B \<rightarrow> C"
  assumes "a \<in> A"
  shows   "g ` (f ` a) \<in> C"
proof -
  from \<open>f \<in> A \<rightarrow> B\<close> \<open>a \<in> A\<close>
  have "f ` a \<in> B" by (rule apply_type)    -- type-checking step
  with \<open>g \<in> B \<rightarrow> C\<close>
  show "g ` (f ` a) \<in> C" by (rule apply_type)  -- type-checking step
qed
```

Each `apply_type` step is a type-checking obligation: we must show that the argument belongs to the domain before we can conclude the result belongs to the codomain.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Lecture 03b**: The Replacement axiom underlies all three comprehension forms.
- **Lecture 03c**: `Collect`, `RepFun`, and `Replace` are all defined using `PrimReplace` and `Upair`.

### 7.2 Links to Future Modules

- **Module 04**: Ordered pairs, Cartesian products, and function spaces are defined using comprehension. Sigma types use a variant of `Collect`.
- **Module 05**: Cardinal arithmetic uses `RepFun` extensively to construct images under bijections.

---

## 8. Seminal Paper Reading List

### Required

1. **Paulson, L. C. (1993).** "Set Theory for Verification: I. From Foundations to Functions." *Journal of Automated Reasoning*, 11(3), 353--389.
   - *Section 5: comprehension, bounded quantifiers, and the Bool theory.*

### Recommended

2. **Paulson, L. C. (1995).** "Set Theory for Verification: II. Induction and Recursion." *Journal of Automated Reasoning*, 15(2), 167--215.
   - *Uses bounded quantifiers and comprehension extensively.*

---

## 9. Exercises

### Theory

**Exercise 3d.1.** Write out the bounded quantifier expansions: show that `\<forall>x\<in>A. \<forall>y\<in>B. P(x,y)` is equivalent to `\<forall>x. \<forall>y. x \<in> A \<longrightarrow> y \<in> B \<longrightarrow> P(x,y)`.

**Exercise 3d.2.** Prove (on paper) the bounded De Morgan laws:
- $\neg(\forall x \in A.\, P(x)) \iff \exists x \in A.\, \neg P(x)$
- $\neg(\exists x \in A.\, P(x)) \iff \forall x \in A.\, \neg P(x)$

**Exercise 3d.3.** Explain why `{x. P(x)}` (unbounded comprehension) is not available in ZF. What goes wrong? Give a specific example (Russell's paradox).

**Exercise 3d.4.** Show that `RepFun(A, \<lambda>x. x) = A`. That is, applying the identity function via replacement recovers the original set.

### Isabelle

**Exercise 3d.5.** Prove in Isabelle/ZF:
```isabelle
lemma "A - (B \<union> C) = (A - B) \<inter> (A - C)"
lemma "A - (B \<inter> C) = (A - B) \<union> (A - C)"
lemma "{x \<in> A. True} = A"
lemma "{x \<in> A. False} = 0"
```

**Exercise 3d.6.** Define the image of a set under a meta-level function:
```isabelle
definition image :: "[i => i, i] => i" where
  "image(f, A) \<equiv> {f(x). x \<in> A}"
```
Prove: `image(f, A \<union> B) = image(f, A) \<union> image(f, B)`.

**Exercise 3d.7.** Prove that bounded quantifiers are monotone in the bounding set:
```isabelle
lemma "\<lbrakk> A \<subseteq> B; \<forall>x\<in>B. P(x) \<rbrakk> \<Longrightarrow> \<forall>x\<in>A. P(x)"
lemma "\<lbrakk> A \<subseteq> B; \<exists>x\<in>A. P(x) \<rbrakk> \<Longrightarrow> \<exists>x\<in>B. P(x)"
```

**Exercise 3d.8.** Prove that `bool_not` is an involution on `bool`:
```isabelle
lemma "b \<in> bool \<Longrightarrow> bool_not(bool_not(b)) = b"
```
(Hint: case split on `b = 0` vs `b = 1`.)
