# Recitation 03: Set Constructions in Isabelle

## Overview

This recitation provides hands-on practice building sets from the ZF axioms and proving basic set identities in Isabelle. We will:

1. Construct specific sets step by step from the axioms.
2. Prove commutativity, associativity, and distributivity of set operations.
3. Work with bounded quantifiers in structured Isar proofs.
4. Practice the type-checking discipline using `[TC]` rules.
5. Work through solved exercises and common pitfalls.

**Prerequisites:** Lectures 03a--03d (ZF_Base, axioms, pairing, comprehension).

---

## 1. Building Sets from the Axioms

### 1.1 Constructing Small Sets

Let us trace how specific sets are built from the primitive axioms.

**The empty set.** The constant `0` is primitive. Its key property is:

```isabelle
lemma emptyE [elim!]: "a \<in> 0 \<Longrightarrow> P"
```

This says: membership in `0` is contradictory, so anything follows.

**The singleton {0}.** We have `{0} = cons(0, 0) = Upair(0, 0) \<union> 0 = {0}`. In the axiom trace:

1. `Pow(0) = {0}` (from the Power Set axiom: the only subset of `0` is `0`).
2. `Pow(Pow(0)) = {0, {0}}` (Power Set again).
3. `Upair(0, 0)` is obtained by Replacement on `Pow(Pow(0))`.
4. Since `Upair(0, 0) = {0}`, we get our singleton.

**The set {0, {0}}.** This is `Pow(Pow(0))` directly, or equivalently `cons(Pow(0), cons(0, 0))`.

**Verification in Isabelle:**

```isabelle
theory Recitation03
  imports ZF
begin

lemma "Pow(0) = {0}"
  by blast

lemma "0 \<in> Pow(Pow(0))"
  by blast

lemma "{0} \<in> Pow(Pow(0))"
  by blast

lemma "Pow(Pow(0)) = {0, {0}}"
  by (auto simp add: Pow_iff subset_def)
```

### 1.2 The First Few Natural Numbers

```isabelle
lemma nat_0: "0 = 0"
  by simp

lemma nat_1: "succ(0) = {0}"
  by (simp add: succ_def cons_def)

lemma nat_2: "succ(succ(0)) = {0, {0}}"
  by (auto simp add: succ_def cons_def Upair_def)

lemma "0 \<in> succ(0)"
  by (simp add: succ_iff)

lemma "0 \<in> succ(succ(0))"
  by (simp add: succ_iff)

lemma "succ(0) \<in> succ(succ(0))"
  by (simp add: succ_iff)
```

---

## 2. Proving Set Identities

### 2.1 Strategy: Mutual Inclusion

The standard method for proving `A = B` in ZF is to prove `A \<subseteq> B` and `B \<subseteq> A`, then apply `equalityI`. Each subset proof typically proceeds by fixing an arbitrary element and reasoning about membership.

### 2.2 Worked Example: Commutativity of Union

```isabelle
lemma Un_commute: "A \<union> B = B \<union> A"
proof (rule equalityI)
  show "A \<union> B \<subseteq> B \<union> A"
  proof (rule subsetI)
    fix x
    assume "x \<in> A \<union> B"
    then show "x \<in> B \<union> A"
    proof (erule UnE)
      assume "x \<in> A"
      then show "x \<in> B \<union> A" by (rule UnI2)
    next
      assume "x \<in> B"
      then show "x \<in> B \<union> A" by (rule UnI1)
    qed
  qed
next
  show "B \<union> A \<subseteq> A \<union> B"
  proof (rule subsetI)
    fix x
    assume "x \<in> B \<union> A"
    then show "x \<in> A \<union> B"
    proof (erule UnE)
      assume "x \<in> B"
      then show "x \<in> A \<union> B" by (rule UnI2)
    next
      assume "x \<in> A"
      then show "x \<in> A \<union> B" by (rule UnI1)
    qed
  qed
qed
```

This verbose proof illustrates the structure. In practice:

```isabelle
lemma Un_commute': "A \<union> B = B \<union> A"
  by blast
```

### 2.3 Worked Example: Distributivity

```isabelle
lemma Int_Un_distrib: "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"
proof (rule equalityI)
  show "A \<inter> (B \<union> C) \<subseteq> (A \<inter> B) \<union> (A \<inter> C)"
  proof (rule subsetI)
    fix x
    assume xABC: "x \<in> A \<inter> (B \<union> C)"
    then have xA: "x \<in> A" by (rule IntD1)
    from xABC have "x \<in> B \<union> C" by (rule IntD2)
    then show "x \<in> (A \<inter> B) \<union> (A \<inter> C)"
    proof (erule UnE)
      assume "x \<in> B"
      with xA have "x \<in> A \<inter> B" by (rule IntI)
      then show ?thesis by (rule UnI1)
    next
      assume "x \<in> C"
      with xA have "x \<in> A \<inter> C" by (rule IntI)
      then show ?thesis by (rule UnI2)
    qed
  qed
next
  show "(A \<inter> B) \<union> (A \<inter> C) \<subseteq> A \<inter> (B \<union> C)"
  proof (rule subsetI)
    fix x
    assume "x \<in> (A \<inter> B) \<union> (A \<inter> C)"
    then show "x \<in> A \<inter> (B \<union> C)"
    proof (erule UnE)
      assume "x \<in> A \<inter> B"
      then have "x \<in> A" and "x \<in> B" by auto
      from \<open>x \<in> B\<close> have "x \<in> B \<union> C" by (rule UnI1)
      with \<open>x \<in> A\<close> show ?thesis by (rule IntI)
    next
      assume "x \<in> A \<inter> C"
      then have "x \<in> A" and "x \<in> C" by auto
      from \<open>x \<in> C\<close> have "x \<in> B \<union> C" by (rule UnI2)
      with \<open>x \<in> A\<close> show ?thesis by (rule IntI)
    qed
  qed
qed
```

### 2.4 Automation Summary

| Identity | Method |
|----------|--------|
| `A \<union> B = B \<union> A` | `blast` |
| `A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)` | `blast` or `auto` |
| `A - (B \<union> C) = (A - B) \<inter> (A - C)` | `blast` |
| `\<Union>({A, B}) = A \<union> B` | `auto` |
| `Pow(A) \<inter> Pow(B) = Pow(A \<inter> B)` | `blast` |

For most basic set identities, `blast` is the method of choice. Use structured proofs when `blast` fails or when you want to understand the proof structure.

---

## 3. Working with Bounded Quantifiers

### 3.1 Proving Bounded Universal Statements

```isabelle
lemma ball_example: "\<forall>x\<in>succ(succ(0)). x = 0 \<or> x = succ(0)"
proof (rule ballI)
  fix x
  assume "x \<in> succ(succ(0))"
  then show "x = 0 \<or> x = succ(0)"
    by (auto simp add: succ_iff)
qed
```

### 3.2 Proving Bounded Existential Statements

```isabelle
lemma bex_example: "\<exists>x\<in>nat. x \<noteq> 0"
proof (rule bexI)
  show "succ(0) \<noteq> 0" by (rule succ_neq_0)
  show "succ(0) \<in> nat" by auto
qed
```

### 3.3 Using bspec for Specialization

```isabelle
lemma bspec_example:
  assumes "\<forall>x\<in>A. P(x)"
  assumes "a \<in> A"
  shows "P(a)"
  using assms by (rule bspec)
```

---

## 4. The Type-Checking Discipline

### 4.1 Understanding [TC] Rules

In Isabelle/ZF, many lemmas carry the `[TC]` attribute. These are automatically tried when the system needs to prove a goal of the form `t \<in> S`. The type-checker works by backward chaining.

**Example rules:**

```isabelle
lemma nat_0I [TC]: "0 \<in> nat"
lemma nat_succI [TC]: "n \<in> nat \<Longrightarrow> succ(n) \<in> nat"
lemma Pair_in_Sigma [TC]:
  "\<lbrakk> a \<in> A; b \<in> B(a) \<rbrakk> \<Longrightarrow> <a, b> \<in> Sigma(A, B)"
```

### 4.2 A Type-Checking Proof

```isabelle
lemma type_check_example:
  shows "<0, succ(0)> \<in> nat \<times> nat"
proof -
  have "0 \<in> nat" by (rule nat_0I)
  moreover have "succ(0) \<in> nat"
  proof (rule nat_succI)
    show "0 \<in> nat" by (rule nat_0I)
  qed
  ultimately show ?thesis
    by (auto intro: SigmaI)
qed
```

With `[TC]` rules, this becomes:

```isabelle
lemma type_check_example': "<0, succ(0)> \<in> nat \<times> nat"
  by auto
```

The `auto` method uses the `[TC]` rules automatically.

### 4.3 Common Pitfall: Forgetting Type Obligations

A common mistake in Isabelle/ZF is to forget that function application `f ` a` requires `a \<in> domain(f)`:

```isabelle
(* THIS WILL NOT WORK without proving a \<in> A *)
lemma bad_example:
  assumes "f \<in> A \<rightarrow> B"
  shows "f ` a \<in> B"
  (* Cannot prove: we do not know a \<in> A! *)
  oops
```

The correct version:

```isabelle
lemma good_example:
  assumes "f \<in> A \<rightarrow> B" and "a \<in> A"
  shows "f ` a \<in> B"
  using assms by (rule apply_type)
```

---

## 5. Practice Problems (with Solutions)

### Problem 1

**Prove:** `A \<union> (A \<inter> B) = A`

**Solution:**

```isabelle
lemma "A \<union> (A \<inter> B) = A"
proof (rule equalityI)
  show "A \<union> (A \<inter> B) \<subseteq> A"
  proof (rule subsetI)
    fix x assume "x \<in> A \<union> (A \<inter> B)"
    then show "x \<in> A" by blast
  qed
next
  show "A \<subseteq> A \<union> (A \<inter> B)"
    by (rule Un_upper1)
qed
```

Or simply: `by blast`.

### Problem 2

**Prove:** `\<Union>(Pow(A)) = A`

**Solution:**

```isabelle
lemma "Union(Pow(A)) = A"
proof (rule equalityI)
  show "Union(Pow(A)) \<subseteq> A"
  proof (rule subsetI)
    fix x assume "x \<in> Union(Pow(A))"
    then obtain B where "B \<in> Pow(A)" and "x \<in> B"
      by (rule UnionE)
    from \<open>B \<in> Pow(A)\<close> have "B \<subseteq> A" by (rule PowD)
    with \<open>x \<in> B\<close> show "x \<in> A" by (rule subsetD)
  qed
next
  show "A \<subseteq> Union(Pow(A))"
  proof (rule subsetI)
    fix x assume "x \<in> A"
    have "A \<in> Pow(A)" by (rule PowI [OF subset_refl])
    with \<open>x \<in> A\<close> show "x \<in> Union(Pow(A))"
      by (rule UnionI)
  qed
qed
```

### Problem 3

**Prove:** `Pow(A \<inter> B) = Pow(A) \<inter> Pow(B)`

**Solution:**

```isabelle
lemma "Pow(A \<inter> B) = Pow(A) \<inter> Pow(B)"
  by blast
```

The structured proof would proceed by showing that `C \<subseteq> A \<inter> B` iff `C \<subseteq> A` and `C \<subseteq> B`.

### Problem 4

**Prove:** `{f(x). x \<in> 0} = 0` for any `f`.

**Solution:**

```isabelle
lemma RepFun_0: "{f(x). x \<in> 0} = 0"
  by blast
```

This follows because there are no elements in `0` to map.

---

## 6. Common Mistakes and Debugging

### 6.1 Confusing meta-level and object-level

In Isabelle/ZF, be careful to distinguish:

- `\<And>x.` (meta-universal) vs `\<forall>x.` (object-universal) vs `\<forall>x\<in>A.` (bounded)
- `\<Longrightarrow>` (meta-implication) vs `\<longrightarrow>` (object-implication)
- `\<equiv>` (meta-equality/definition) vs `=` (object-equality)

### 6.2 Tactic did not apply

If `blast` or `auto` fails on a set identity, try:

1. `simp` with specific lemmas: `by (simp add: Upair_def cons_def)`
2. Manual `rule` application to break down the goal.
3. Check whether you need type-checking assumptions (membership obligations).

### 6.3 Unresolved type-checking goals

If you see a goal like `?a \<in> ?A` that auto cannot solve, you likely need an explicit membership assumption. Add it to the lemma statement or prove it as an intermediate step.
