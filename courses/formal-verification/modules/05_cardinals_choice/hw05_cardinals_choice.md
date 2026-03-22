# Homework 05: Cardinals & Choice

**Estimated Time:** ~18 hours
**Due Date:** See course schedule
**Submission:** Submit Isabelle `.thy` files and a PDF write-up for the paper exercises.

---

## Overview

This homework covers Module 05: equipollence, cardinal numbers, the Schroeder-Bernstein theorem, the Axiom of Choice, and cardinal arithmetic. Part A (40%) tests your understanding through paper exercises. Part B (60%) requires Isabelle/ZF proofs involving cardinality, AC, and cardinal arithmetic.

**Academic Integrity:** All proofs must be your own. You may use the ZF and ZFC library lemmas. You may **not** use `sorry`.

**Important:** Some problems require AC and must import `ZFC`. Others should work with only `ZF`. The problem statement specifies which import to use.

---

## Part A: Paper Exercises (40%)

### Problem A1: Equipollence (8 points)

**(a)** (3 points) Prove that equipollence is an equivalence relation: reflexive, symmetric, and transitive. For each property, construct the required bijection explicitly.

**(b)** (2 points) Prove: if $A \approx A'$ and $B \approx B'$, and $A \cap B = \emptyset$ and $A' \cap B' = \emptyset$, then $A \cup B \approx A' \cup B'$.

**(c)** (3 points) Prove: $A \times B \approx B \times A$ for all sets $A$ and $B$. Construct the bijection and verify it is well-defined.

---

### Problem A2: Cantor's Theorem (8 points)

**(a)** (4 points) Prove Cantor's theorem on paper: for every set $A$, there is no surjection $f : A \twoheadrightarrow \mathcal{P}(A)$. Write out the diagonal argument in full detail.

**(b)** (2 points) Explain why the argument fails for the "Russell set" $R = \{x : x \notin x\}$ --- why is this not a paradox in ZF?

**(c)** (2 points) Prove that $\{0, 1\}^A \approx \mathcal{P}(A)$ (the set of functions from $A$ to $\{0, 1\}$ is equinumerous to the power set of $A$). Construct a bijection via characteristic functions.

---

### Problem A3: Schroeder-Bernstein (8 points)

**(a)** (4 points) Prove the Schroeder-Bernstein theorem on paper using Banach's decomposition. Write out:
- The definition of the operator $T(X) = A \setminus g[B \setminus f[X]]$.
- The proof that $T$ is monotone.
- The construction of the bijection $h$.
- The verification that $h$ is injective and surjective.

**(b)** (4 points) Use Schroeder-Bernstein to prove $\mathbb{N} \approx \mathbb{Z}$ (in ZF notation: $\mathrm{nat} \approx \mathrm{int}$). Construct injections in both directions.

---

### Problem A4: Axiom of Choice (8 points)

**(a)** (3 points) State three different formulations of AC (choose from AC0--AC19) and prove that any two of them are equivalent.

**(b)** (2 points) Explain why the Axiom of Choice is needed to prove cardinal comparability: $|A| \leq |B|$ or $|B| \leq |A|$ for all sets $A$ and $B$.

**(c)** (3 points) Prove that AC implies: every infinite set $A$ satisfies $A \approx A \cup \{x\}$ for any $x \notin A$. (Hint: use the fact that $\mathrm{nat} \lesssim A$ and the Hilbert Hotel argument.)

---

### Problem A5: Cardinal Arithmetic (8 points)

**(a)** (3 points) Prove that $\aleph_0 + \aleph_0 = \aleph_0$ (i.e., $|\mathrm{nat}| \oplus |\mathrm{nat}| = |\mathrm{nat}|$). Construct a bijection between $\mathrm{nat} + \mathrm{nat}$ and $\mathrm{nat}$.

**(b)** (2 points) Prove that $\aleph_0 \cdot \aleph_0 = \aleph_0$ using the Cantor pairing function. Write out the bijection explicitly.

**(c)** (3 points) Prove Konig's theorem for the special case: if $|A_n| < |B_n|$ for all $n \in \omega$, then $\left|\bigcup_{n \in \omega} A_n\right| < \left|\prod_{n \in \omega} B_n\right|$. (You may assume AC for this problem.)

---

## Part B: Isabelle Proofs (60%)

### General Instructions

- All proofs must be in Isabelle/ZF or Isabelle/ZFC as specified.
- You may **not** use `sorry`.
- Include comments for non-trivial proof steps.

---

### Problem B1: Equipollence Properties (10 points)

Import: `ZF`

```isabelle
(* 2 points each *)
lemma B1a: "A \<approx> A"

lemma B1b: "A \<approx> B \<Longrightarrow> B \<approx> A"

lemma B1c: "\<lbrakk> A \<approx> B; B \<approx> C \<rbrakk> \<Longrightarrow> A \<approx> C"

lemma B1d: "A \<lesssim> A"

lemma B1e: "\<lbrakk> A \<lesssim> B; B \<lesssim> C \<rbrakk> \<Longrightarrow> A \<lesssim> C"
```

---

### Problem B2: Cardinal Inequalities (10 points)

Import: `ZF`

```isabelle
(* 2 points each *)
lemma B2a: "0 \<lesssim> A"

lemma B2b: "A \<lesssim> A \<union> B"

lemma B2c: "A \<subseteq> B \<Longrightarrow> A \<lesssim> B"

lemma B2d: "A \<prec> Pow(A)"

lemma B2e: "Finite(A) \<Longrightarrow> Finite(A \<union> B) \<longleftrightarrow> Finite(B)"
```

For B2d (Cantor's theorem), provide a structured proof showing both the injection and the non-surjection.

---

### Problem B3: Schroeder-Bernstein Applications (12 points)

Import: `ZF`

```isabelle
(* 3 points each *)
lemma B3a: "\<lbrakk> A \<lesssim> B; B \<lesssim> A \<rbrakk> \<Longrightarrow> A \<approx> B"

lemma B3b: "nat \<approx> nat - {0}"

lemma B3c: "A \<lesssim> B \<Longrightarrow> Pow(A) \<lesssim> Pow(B)"

lemma B3d: "A \<times> {0} \<approx> A"
```

For B3b, construct explicit injections in both directions and apply Schroeder-Bernstein.

---

### Problem B4: Cardinal Arithmetic (12 points)

Import: `ZFC` (for problems requiring AC, use `ZFC`; mark which ones)

```isabelle
(* 2 points each *)
lemma B4a: "K \<oplus> L = L \<oplus> K"

lemma B4b: "K \<otimes> L = L \<otimes> K"

lemma B4c: "K \<otimes> (L \<oplus> M) = (K \<otimes> L) \<oplus> (K \<otimes> M)"

(* Requires ZFC: *)
lemma B4d: "InfCard(K) \<Longrightarrow> K \<oplus> K = K"

lemma B4e: "Card(csucc(nat))"

lemma B4f: "nat < csucc(nat)"
```

---

### Problem B5: AC and Well-Ordering (8 points)

Import: `ZFC`

```isabelle
(* 2 points each *)
lemma B5a: "\<exists>r. well_ord(A, r)"

lemma B5b: "|A| \<le> |B| \<or> |B| \<le> |A|"

lemma B5c:
  "\<lbrakk> f \<in> surj(A, B) \<rbrakk> \<Longrightarrow> \<exists>g \<in> inj(B, A). \<forall>b\<in>B. f ` (g ` b) = b"

lemma B5d: "InfCard(K) \<Longrightarrow> K \<otimes> K = K"
```

---

### Problem B6: Challenge Problems (8 points)

**(a)** (4 points) Import: `ZFC`

Prove that $\mathrm{nat} \times \mathrm{nat} \approx \mathrm{nat}$. You may use the absorption law or construct an explicit bijection:

```isabelle
lemma "nat \<times> nat \<approx> nat"
```

**(b)** (4 points) Import: `ZF`

Prove Hartogs' theorem: for every set $A$, there exists an ordinal $\alpha$ with $\alpha \not\lesssim A$:

```isabelle
lemma "\<exists>\<alpha>. Ord(\<alpha>) \<and> \<not>(\<alpha> \<lesssim> A)"
```

(Hint: consider the set of all ordinals that inject into $A$.)

---

## Grading Rubric

### Part A (40 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| A1 | 8 | Correct equipollence proofs |
| A2 | 8 | Cantor's theorem, diagonal argument |
| A3 | 8 | Schroeder-Bernstein proof and application |
| A4 | 8 | AC formulations and implications |
| A5 | 8 | Cardinal arithmetic proofs |

### Part B (60 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| B1 | 10 | Equipollence properties |
| B2 | 10 | Cardinal inequalities, Cantor's theorem |
| B3 | 12 | Schroeder-Bernstein applications |
| B4 | 12 | Cardinal arithmetic |
| B5 | 8 | AC and well-ordering |
| B6 | 8 | Challenge problems |

---

## Tips

1. **Know the key lemmas.** For equipollence: `eqpoll_refl`, `eqpoll_sym`, `eqpoll_trans`. For cardinal injection: `lepoll_refl`, `lepoll_trans`. For Schroeder-Bernstein: `lepoll_antisym`.

2. **Constructing injections.** To prove $A \lesssim B$, construct a `lam x:A. ...` and prove it is in `inj(A, B)`.

3. **AC vs ZF.** Always check whether your proof requires AC. If `auto` or `blast` fails and you are importing only `ZF`, try importing `ZFC` (but document the dependency).

4. **Cardinal arithmetic.** The key rules are `cadd_commute`, `cmult_commute`, `cmult_cadd_distrib`, and (with AC) `InfCard_cmult_eq`.

5. **For Cantor's theorem.** The key insight is the diagonal set `{x \<in> A. x \<notin> f ` x}`. Use `CollectI` and `CollectD2` to reason about membership.

---

## Submission Checklist

- [ ] `A_paper.pdf`: Solutions to Part A (A1--A5).
- [ ] `B1_equipollence.thy`: Equipollence properties.
- [ ] `B2_cardinal_ineq.thy`: Cardinal inequalities.
- [ ] `B3_schroeder_bernstein.thy`: Schroeder-Bernstein applications.
- [ ] `B4_cardinal_arith.thy`: Cardinal arithmetic.
- [ ] `B5_ac.thy`: AC and well-ordering.
- [ ] `B6_challenge.thy`: Challenge problems.
