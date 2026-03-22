# Homework 04: Ordinals & Recursion

**Estimated Time:** ~18 hours
**Due Date:** See course schedule
**Submission:** Submit Isabelle `.thy` files and a PDF write-up for the paper exercises.

---

## Overview

This homework covers Module 04: ordered pairs, functions, well-founded recursion, and ordinals. Part A (40%) tests your understanding through paper exercises. Part B (60%) requires Isabelle/ZF proofs involving functions, natural number arithmetic, and ordinal properties.

**Academic Integrity:** All proofs must be your own. You may use the ZF library lemmas. You may **not** use `sorry`.

---

## Part A: Paper Exercises (40%)

### Problem A1: Kuratowski Pairs (8 points)

**(a)** (4 points) Prove the ordered pair characterization: $\{\{a\}, \{a,b\}\} = \{\{c\}, \{c,d\}\} \implies a = c \land b = d$. Write out all cases in full detail.

**(b)** (4 points) The Kuratowski pair has the property that $\langle a, b \rangle \in \mathcal{P}(\mathcal{P}(\{a\} \cup \{b\}))$. Prove this. Then show that $\langle a, b \rangle \in \mathcal{P}(\mathcal{P}(A \cup B))$ whenever $a \in A$ and $b \in B$. Explain why this is important for defining $A \times B \subseteq \mathcal{P}(\mathcal{P}(A \cup B))$.

---

### Problem A2: Function Properties (10 points)

**(a)** (3 points) Prove that the composition of two injections is an injection. State the claim precisely using the ZF definitions of `inj(A,B)` and prove it.

**(b)** (3 points) Prove: if $g \circ f$ is injective, then $f$ is injective.

**(c)** (4 points) Prove: if $f : A \to B$ and $g : B \to C$ are both bijections, then $g \circ f : A \to C$ is a bijection, and $(g \circ f)^{-1} = f^{-1} \circ g^{-1}$.

---

### Problem A3: Well-Founded Induction (8 points)

**(a)** (3 points) State the well-founded induction principle. Prove (on paper) that it implies there are no infinite descending $r$-chains when $r$ is well-founded. (You may assume Dependent Choice for this direction.)

**(b)** (2 points) Prove that the lexicographic order on $\mathbb{N} \times \mathbb{N}$ (defined by $(a_1, b_1) <_{\mathrm{lex}} (a_2, b_2) \iff a_1 < a_2 \lor (a_1 = a_2 \land b_1 < b_2)$) is well-founded.

**(c)** (3 points) State the Knaster-Tarski theorem for the power-set lattice. Prove that if $h$ is monotone and $h(D) \subseteq D$, then $\mathrm{lfp}(D, h)$ is a fixed point of $h$.

---

### Problem A4: Ordinal Theory (8 points)

**(a)** (3 points) Prove that every element of an ordinal is an ordinal.

**(b)** (2 points) Prove that the union of a set of ordinals is an ordinal.

**(c)** (3 points) Prove that ordinal addition is associative using three-case transfinite induction. Write out the base, successor, and limit cases.

---

### Problem A5: Rank Function (6 points)

**(a)** (3 points) Prove that $\mathrm{rank}(\alpha) = \alpha$ for every ordinal $\alpha$ by transfinite induction. Write out all three cases.

**(b)** (3 points) Prove that $a \in b \implies \mathrm{rank}(a) < \mathrm{rank}(b)$ for all sets $a$ and $b$.

---

## Part B: Isabelle Proofs (60%)

### General Instructions

- All proofs must be in Isabelle/ZF. Import `ZF`.
- You may use `auto`, `blast`, `force`, `fastforce`, `simp`, `rule`, `induct`, and manual Isar reasoning.
- You may **not** use `sorry`.
- Include comments explaining key proof steps for non-trivial proofs.

---

### Problem B1: Pairs and Products (10 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B1a: "<a,b> = <c,d> \<Longrightarrow> a = c \<and> b = d"

lemma B1b: "A \<times> (B \<union> C) = (A \<times> B) \<union> (A \<times> C)"

lemma B1c: "A \<times> (B \<inter> C) = (A \<times> B) \<inter> (A \<times> C)"

lemma B1d: "(A \<times> B) - (A \<times> C) = A \<times> (B - C)"

lemma B1e: "A \<times> B = 0 \<longleftrightarrow> A = 0 \<or> B = 0"
```

---

### Problem B2: Functions (12 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B2a:
  "b \<in> B \<Longrightarrow> (lam x:A. b) \<in> A \<rightarrow> B"

lemma B2b:
  "\<lbrakk> f \<in> A \<rightarrow> B; a \<in> A \<rbrakk> \<Longrightarrow> f ` a \<in> B"

lemma B2c:
  "\<lbrakk> f \<in> A \<rightarrow> B; g \<in> B \<rightarrow> C \<rbrakk> \<Longrightarrow> g O f \<in> A \<rightarrow> C"

lemma B2d:
  "f \<in> Pi(A, B) \<Longrightarrow> (lam x:A. f ` x) = f"

lemma B2e:
  "\<lbrakk> f \<in> A \<rightarrow> B; g \<in> A \<rightarrow> B;
     \<forall>x\<in>A. f ` x = g ` x \<rbrakk>
   \<Longrightarrow> f = g"

lemma B2f:
  "f \<in> bij(A, B) \<Longrightarrow> converse(f) \<in> bij(B, A)"
```

---

### Problem B3: Natural Number Arithmetic (12 points)

Prove the following in Isabelle/ZF. Use induction on natural numbers.

```isabelle
(* 3 points each *)
lemma B3a:
  "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk> \<Longrightarrow> m #+ n \<in> nat"

lemma B3b:
  "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk> \<Longrightarrow> m #+ n = n #+ m"

lemma B3c:
  "\<lbrakk> m \<in> nat; n \<in> nat; k \<in> nat \<rbrakk>
   \<Longrightarrow> m #+ (n #+ k) = (m #+ n) #+ k"

lemma B3d:
  "\<lbrakk> m \<in> nat; n \<in> nat \<rbrakk>
   \<Longrightarrow> m #* succ(n) = m #+ (m #* n)"
```

For B3b, provide a structured Isar proof with explicit induction steps. (Note: you will likely need a helper lemma that `m #+ 0 = m` and `succ(m) #+ n = succ(m #+ n)`.)

---

### Problem B4: Ordinal Properties (12 points)

Prove the following in Isabelle/ZF:

```isabelle
(* 2 points each *)
lemma B4a: "Ord(0)"

lemma B4b: "Ord(i) \<Longrightarrow> Ord(succ(i))"

lemma B4c: "\<lbrakk> Ord(i); j \<in> i \<rbrakk> \<Longrightarrow> Ord(j)"

lemma B4d: "\<lbrakk> Ord(i); Ord(j); i < j; j < k; Ord(k) \<rbrakk> \<Longrightarrow> i < k"

lemma B4e: "Limit(nat)"

lemma B4f: "\<lbrakk> Ord(i); 0 < i \<rbrakk> \<Longrightarrow> 0 \<in> i"
```

---

### Problem B5: Transfinite Recursion (6 points)

**(a)** (3 points) Define the cumulative hierarchy $V_\alpha$ via transfinite recursion:

```isabelle
definition Vset :: "i => i" where
  "Vset(i) \<equiv> transrec(i, \<lambda>x f. \<Union>y\<in>x. Pow(f ` y))"
```

Prove the recursion equation:
```isabelle
lemma Vset_eq: "Vset(i) = (\<Union>j\<in>i. Pow(Vset(j)))"
```

**(b)** (3 points) Prove the following properties:
```isabelle
lemma "Vset(0) = 0"
lemma "Vset(succ(i)) = Pow(Vset(i))"
lemma "Ord(i) \<Longrightarrow> Transset(Vset(i))"
```

---

### Problem B6: Challenge (8 points)

**(a)** (4 points) Prove the recursion theorem for natural numbers from scratch: define a function by primitive recursion on `nat` without using `nat_rec`, using well-founded recursion on `Memrel(nat)` directly. Show that it satisfies the expected recursion equations.

**(b)** (4 points) Prove that every well-ordered set is order-isomorphic to a unique ordinal. That is:

```isabelle
lemma well_ord_ordertype:
  assumes "well_ord(A, r)"
  shows "\<exists>!i. Ord(i) \<and> ordermap(A, r) \<in> bij(A, i)"
```

You may use lemmas from OrderType.thy.

---

## Grading Rubric

### Part A (40 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| A1 | 8 | Complete pair characterization proof |
| A2 | 10 | Correct function property proofs |
| A3 | 8 | Well-founded induction, Knaster-Tarski |
| A4 | 8 | Ordinal theory proofs |
| A5 | 6 | Rank function properties |

### Part B (60 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| B1 | 10 | Pair and product proofs |
| B2 | 12 | Function proofs including composition and bijection |
| B3 | 12 | Nat arithmetic with induction |
| B4 | 12 | Ordinal property proofs |
| B5 | 6 | Transfinite recursion |
| B6 | 8 | Challenge problems |

---

## Tips

1. **For induction on nat:** Use `erule nat_induct` or the structured form `proof (induct n rule: nat_induct)`.

2. **For transfinite induction:** Use `proof (induct i rule: trans_induct)` or `trans_induct3` for the three-case version.

3. **For function proofs:** The key rules are `lam_type`, `apply_type`, `beta`, `eta`, and `fun_extension`.

4. **For ordinal proofs:** The key rules are `Ord_linear`, `ltI`, `ltD`, `lt_trans`, and the various `Ord_*` rules.

5. **Helper lemmas:** Do not hesitate to prove intermediate lemmas. For commutativity of addition, you will likely need `0 #+ n = n` and `succ(m) #+ n = succ(m #+ n)` as separate lemmas.

---

## Submission Checklist

- [ ] `A_paper.pdf`: Solutions to Part A (A1--A5).
- [ ] `B1_pairs.thy`: Pair and product proofs.
- [ ] `B2_functions.thy`: Function proofs.
- [ ] `B3_arithmetic.thy`: Natural number arithmetic.
- [ ] `B4_ordinals.thy`: Ordinal properties.
- [ ] `B5_transrec.thy`: Transfinite recursion.
- [ ] `B6_challenge.thy`: Challenge problems.
