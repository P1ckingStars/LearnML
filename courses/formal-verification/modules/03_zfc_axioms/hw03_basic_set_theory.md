# Homework 03: Basic Set Theory

**Estimated Time:** ~15 hours
**Due Date:** See course schedule
**Submission:** Submit Isabelle `.thy` files and a PDF write-up for the paper exercises.

---

## Overview

This homework covers the core concepts from Module 03: the ZF axioms, derived set operations, bounded quantifiers, and comprehension. Part A (40%) tests your understanding of the axioms and their relationships through paper exercises. Part B (60%) requires you to prove set-theoretic identities and construct specific sets in Isabelle/ZF.

**Academic Integrity:** All proofs must be your own. You may use the ZF library lemmas but must cite any non-trivial lemma you use. You may **not** use `sorry`.

**Notation:** We use standard Isabelle/ZF notation as defined in the course [NOTATION.md](../../NOTATION.md).

---

## Part A: Paper Exercises (40%)

### Problem A1: Axiom Analysis (10 points)

**(a)** (3 points) State each of the six ZF axioms in ZF_Base.thy in both Isabelle syntax and standard mathematical notation. For each axiom, give one example of a set whose existence the axiom guarantees.

**(b)** (3 points) Explain why the Axiom of Separation is not needed as a separate axiom in Isabelle/ZF. Write out the derivation: given a set $A$ and a property $P$, express $\{x \in A : P(x)\}$ using `PrimReplace` and verify the functionality condition.

**(c)** (4 points) Explain why the Axiom of Pairing is not needed as a separate axiom. Trace through the construction of `Upair(a, b)`:
- What set do we apply Replacement to?
- What is the predicate $P$?
- Why is $P$ functional?
- What is the resulting characterization of `Upair(a, b)`?

---

### Problem A2: Foundation and Its Consequences (8 points)

**(a)** (3 points) Prove (on paper) that Foundation implies: for all sets $a$, $a \notin a$. (Show the proof in full detail using the axiom as stated in ZF_Base.)

**(b)** (2 points) Prove that Foundation implies: there is no set $A$ such that $A = \{A\}$.

**(c)** (3 points) Prove that Foundation implies: there do not exist sets $a$ and $b$ with $a \in b$ and $b \in a$. (This is the asymmetry of membership.)

---

### Problem A3: Replacement and RepFun (8 points)

**(a)** (3 points) Write out the definition of `RepFun(A, f)` in terms of `PrimReplace`. Verify that the functionality condition is automatically satisfied for any `f :: i => i`.

**(b)** (2 points) Prove (on paper) that `RepFun(A, \<lambda>x. x) = A`.

**(c)** (3 points) Prove that Replacement preserves subset: if $A \subseteq B$, then $\mathrm{RepFun}(A, f) \subseteq \mathrm{RepFun}(B, f)$ for any $f$.

---

### Problem A4: Comprehension and Bounded Quantifiers (8 points)

**(a)** (2 points) Prove that Collect is monotone in the bounding set: if $A \subseteq B$, then $\{x \in A. P(x)\} \subseteq \{x \in B. P(x)\}$.

**(b)** (3 points) Prove the following identity on paper:
$$\{x \in A \cup B : P(x)\} = \{x \in A : P(x)\} \cup \{x \in B : P(x)\}$$

**(c)** (3 points) Prove:
$$\{f(x) : x \in A \cup B\} = \{f(x) : x \in A\} \cup \{f(x) : x \in B\}$$

---

### Problem A5: Power Set and Union Interaction (6 points)

**(a)** (2 points) Prove: $\mathcal{P}(A) \cap \mathcal{P}(B) = \mathcal{P}(A \cap B)$.

**(b)** (2 points) Prove: $\mathcal{P}(A) \cup \mathcal{P}(B) \subseteq \mathcal{P}(A \cup B)$. Show by example that the reverse inclusion fails.

**(c)** (2 points) Prove: $A \subseteq B \iff \mathcal{P}(A) \subseteq \mathcal{P}(B)$.

---

## Part B: Isabelle Proofs (60%)

### General Instructions

- All proofs must be in Isabelle/ZF. Import `ZF`.
- You may use `auto`, `blast`, `force`, `fastforce`, `simp`, `rule`, and manual Isar reasoning.
- You may **not** use `sorry`.
- For each problem, provide both a structured Isar proof and (if possible) a one-line proof using automation. If automation alone suffices, note that.
- Include comments explaining key proof steps.

---

### Problem B1: Set Identities (12 points)

Prove the following identities in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B1a: "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"

lemma B1b: "A \<union> (B \<inter> C) = (A \<union> B) \<inter> (A \<union> C)"

lemma B1c: "A - (B \<union> C) = (A - B) \<inter> (A - C)"

lemma B1d: "A - (B \<inter> C) = (A - B) \<union> (A - C)"

lemma B1e: "(A \<union> B) - C = (A - C) \<union> (B - C)"

lemma B1f: "(A \<inter> B) - C = (A - C) \<inter> (B - C)"
```

For B1a and B1b, provide both a one-line proof and a full structured Isar proof.

---

### Problem B2: Power Set and Union (10 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B2a: "Pow(A \<inter> B) = Pow(A) \<inter> Pow(B)"

lemma B2b: "Pow(A) \<union> Pow(B) \<subseteq> Pow(A \<union> B)"

lemma B2c: "\<Union>(Pow(A)) = A"

lemma B2d: "A \<subseteq> Pow(\<Union>(A))"

lemma B2e: "A \<subseteq> B \<Longrightarrow> Pow(A) \<subseteq> Pow(B)"
```

---

### Problem B3: Successor and Natural Numbers (10 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B3a: "succ(n) \<noteq> 0"

lemma B3b: "succ(m) = succ(n) \<Longrightarrow> m = n"

lemma B3c: "n \<in> nat \<Longrightarrow> n = 0 \<or> (\<exists>m\<in>nat. n = succ(m))"

lemma B3d: "0 \<notin> 0"

lemma B3e: "n \<in> nat \<Longrightarrow> n \<notin> n"
```

For B3b, provide a structured proof explaining the key insight about Kuratowski pairs or the successor operation.

For B3e, provide a structured proof using natural number induction.

---

### Problem B4: Comprehension and Replacement (10 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B4a: "{x \<in> A. x \<in> B} = A \<inter> B"

lemma B4b: "{x \<in> A. x \<notin> B} = A - B"

lemma B4c: "RepFun(A, \<lambda>x. x) = A"

lemma B4d: "RepFun(A \<union> B, f) = RepFun(A, f) \<union> RepFun(B, f)"

lemma B4e:
  "A \<subseteq> B \<Longrightarrow> {x \<in> A. P(x)} \<subseteq> {x \<in> B. P(x)}"
```

---

### Problem B5: Bounded Quantifiers (8 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B5a: "(\<forall>x\<in>A. P(x)) \<longleftrightarrow> (\<forall>x. x \<in> A \<longrightarrow> P(x))"

lemma B5b: "(\<exists>x\<in>A. P(x)) \<longleftrightarrow> (\<exists>x. x \<in> A \<and> P(x))"

lemma B5c: "\<not>(\<forall>x\<in>A. P(x)) \<longleftrightarrow> (\<exists>x\<in>A. \<not>P(x))"

lemma B5d:
  "\<lbrakk> A \<subseteq> B; \<forall>x\<in>B. P(x) \<rbrakk> \<Longrightarrow> \<forall>x\<in>A. P(x)"
```

For B5c, provide a structured proof using classical logic (the law of excluded middle).

---

### Problem B6: Challenge Problems (10 points)

These problems are more difficult. Partial credit will be given.

**(a)** (3 points) Define the symmetric difference and prove associativity:

```isabelle
definition sym_diff :: "[i, i] => i"  (infixl "\<triangle>" 65) where
  "A \<triangle> B \<equiv> (A - B) \<union> (B - A)"

lemma sym_diff_assoc: "(A \<triangle> B) \<triangle> C = A \<triangle> (B \<triangle> C)"
```

**(b)** (3 points) Prove the generalized distributivity:

```isabelle
lemma general_Int_distrib:
  "C \<noteq> 0 \<Longrightarrow> A \<inter> \<Union>(C) = (\<Union>B\<in>C. A \<inter> B)"
```

where `\<Union>B\<in>C. f(B)` denotes `\<Union>({f(B). B \<in> C})`.

**(c)** (4 points) Prove that `Pow` distributes over intersection but not over union:

```isabelle
lemma Pow_Int: "Pow(A \<inter> B) = Pow(A) \<inter> Pow(B)"

(* For the failure of Pow over union, find a counterexample *)
lemma Pow_Un_counterexample:
  "\<exists>A B. Pow(A \<union> B) \<noteq> Pow(A) \<union> Pow(B)"
```

Provide a concrete `A` and `B` (as specific ZF sets, e.g., `{0}` and `{{0}}`) and prove the inequality.

---

## Grading Rubric

### Part A (40 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| A1 | 10 | Correct axiom statements, derivation of Separation and Pairing |
| A2 | 8 | Rigorous proofs from Foundation |
| A3 | 8 | Correct Replacement analysis |
| A4 | 8 | Clean proofs of comprehension identities |
| A5 | 6 | Power set / union interaction |

### Part B (60 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| B1 | 12 | Correct proofs, structured version for B1a/B1b |
| B2 | 10 | Correct proofs |
| B3 | 10 | Correct proofs, structured proofs where requested |
| B4 | 10 | Correct proofs |
| B5 | 8 | Correct proofs, structured proof for B5c |
| B6 | 10 | Challenge problems, partial credit available |

---

## Tips

1. **Start with automation.** Try `blast` or `auto` first. If they work, you have a correct proof. Then write a structured version if required.

2. **Know the key rules.** `subsetI`, `equalityI`, `UnI1`/`UnI2`, `UnE`, `IntI`, `IntD1`/`IntD2`, `DiffI`, `DiffD1`/`DiffD2`, `PowI`, `PowD`, `CollectI`, `CollectD1`/`CollectD2`.

3. **For induction on nat.** Use `erule nat_induct` or `induct n rule: nat_induct` in the proof body.

4. **For counterexamples.** Use specific small sets like `0`, `{0}`, `{0, {0}}` and compute their power sets explicitly.

5. **For structured proofs.** The pattern is almost always: `equalityI` + `subsetI` + `fix x` + `assume` + case analysis.

---

## Submission Checklist

- [ ] `A_paper.pdf`: Solutions to Part A (A1--A5), typeset or clearly handwritten.
- [ ] `B1_identities.thy`: Set identities (B1).
- [ ] `B2_pow_union.thy`: Power set and union (B2).
- [ ] `B3_successor.thy`: Successor and nat (B3).
- [ ] `B4_comprehension.thy`: Comprehension and replacement (B4).
- [ ] `B5_quantifiers.thy`: Bounded quantifiers (B5).
- [ ] `B6_challenge.thy`: Challenge problems (B6).
