# Recitation 05: AC Equivalences

## Overview

This recitation explores the Axiom of Choice session (`AC/`) in Isabelle/ZF. We will:

1. Survey the 20+ forms of AC and 8 forms of the Well-Ordering Principle formalized in Isabelle/ZF.
2. Walk through one AC equivalence proof in detail.
3. Understand the theory dependency graph: which theories import ZF and which import ZFC.
4. Compare ZF and ZFC theory imports and observe what changes.
5. Discuss the mathematical and foundational significance of the AC equivalences.

**Prerequisites:** Lectures 05a--05c (equipollence, Schroeder-Bernstein, Axiom of Choice).

---

## 1. The AC/ Session: Overview

### 1.1 Location and Structure

The AC equivalences are formalized in the `AC/` subdirectory of the Isabelle/ZF distribution. The key files are:

| File | Contents |
|------|----------|
| `AC_Equiv.thy` | Core equivalences between AC forms |
| `WO_AC.thy` | Well-Ordering implies AC forms |
| `AC_WO.thy` | AC forms imply Well-Ordering |
| `Hartog.thy` | Hartogs' theorem |
| `DC.thy` | Dependent Choice |
| `WO1_WO8.thy` | The eight WO forms |
| `AC0_AC19.thy` | The twenty AC forms |

### 1.2 The Eight WO Forms

| Name | Statement |
|------|-----------|
| WO1 | Every set can be well-ordered |
| WO2 | Every set is equipollent to an ordinal |
| WO3 | Every set has a cardinal number (= least equinumerous ordinal) |
| WO4 | Every set of non-empty sets has a choice function |
| WO5 | The union of a well-orderable family of well-orderable sets is well-orderable |
| WO6 | Every set is the union of a well-orderable chain |
| WO7 | Hartogs' inequality: for all A, there exists an ordinal not dominated by A |
| WO8 | Dependent Choice (weak form) |

### 1.3 The Twenty AC Forms

| Name | Statement (informal) |
|------|---------------------|
| AC0 | Choice function for families of non-empty sets |
| AC1 | System of representatives for disjoint families |
| AC2 | Product of non-empty sets is non-empty |
| AC3 | Every surjection has a right inverse |
| AC4 | Every relation contains a function with the same domain |
| AC5 | Every epimorphism in Set splits |
| AC6 | Equivalent to AC0 for well-orderable index sets |
| AC7 | Similar to AC0, restricted form |
| AC8 | Every set is a union of singletons (trivially true, but the indexed version is AC) |
| AC9 | Finite-character version |
| AC10 | Every infinite set is Dedekind-infinite |
| AC11 | Restricted AC for countable families |
| AC12 | Restricted AC for finite families |
| AC13 | AC for countable families of finite sets |
| AC14 | Restricted form |
| AC15 | Every partial order extends to a total order |
| AC16 | Restricted form |
| AC17 | Restricted form |
| AC18 | Tukey's Lemma: every family of finite character has a maximal element |
| AC19 | Hausdorff Maximal Principle |

---

## 2. Walking Through an Equivalence Proof

### 2.1 AC0 <-> AC2

Let us trace the proof that AC0 (choice function) and AC2 (non-empty product) are equivalent.

**AC0:** For every set $A$ of non-empty sets, there exists a function $f$ with $f(x) \in x$ for all $x \in A$.

**AC2:** If $\{B_i\}_{i \in I}$ is a family of non-empty sets, then $\prod_{i \in I} B_i \neq \emptyset$.

**AC0 => AC2:** Given a family $\{B_i\}_{i \in I}$ with each $B_i \neq \emptyset$, apply AC0 to the set $\{B_i : i \in I\}$ to get a choice function $f$ with $f(B_i) \in B_i$. But we need a function $g \in \Pi(I, B)$ with $g(i) \in B_i$. Define $g = \lambda i \in I.\, f(B_i)$.

Wait, there is a subtlety: if two indices $i \neq j$ have $B_i = B_j$, the choice function gives the same element for both, which is fine.

```isabelle
lemma AC0_imp_AC2:
  assumes AC0: "\<forall>A. (\<forall>x\<in>A. x \<noteq> 0) \<longrightarrow>
                 (\<exists>f. f \<in> Pi(A, \<lambda>x. x))"
  assumes "\<forall>i\<in>I. B(i) \<noteq> 0"
  shows "Pi(I, B) \<noteq> 0"
proof -
  let ?A = "{B(i). i \<in> I}"
  have "\<forall>x\<in>?A. x \<noteq> 0"
    using \<open>\<forall>i\<in>I. B(i) \<noteq> 0\<close> by auto
  then obtain f where "f \<in> Pi(?A, \<lambda>x. x)"
    using AC0 by auto
  (* Now construct g \<in> Pi(I, B) *)
  let ?g = "lam i:I. f ` B(i)"
  have "?g \<in> Pi(I, B)"
  proof (rule lam_type)
    fix i assume "i \<in> I"
    then have "B(i) \<in> ?A" by auto
    with \<open>f \<in> Pi(?A, \<lambda>x. x)\<close>
    show "f ` B(i) \<in> B(i)" by (rule apply_type)
  qed
  then show "Pi(I, B) \<noteq> 0" by auto
qed
```

**AC2 => AC0:** Given a set $A$ of non-empty sets, we need a choice function. View $A$ as a family indexed by itself: $B(x) = x$ for $x \in A$. By AC2, $\prod_{x \in A} x = \Pi(A, \lambda x.\, x) \neq \emptyset$. Any element of this product is a choice function.

```isabelle
lemma AC2_imp_AC0:
  assumes AC2: "\<forall>I B. (\<forall>i\<in>I. B(i) \<noteq> 0) \<longrightarrow> Pi(I, B) \<noteq> 0"
  assumes "\<forall>x\<in>A. x \<noteq> 0"
  shows "\<exists>f. f \<in> Pi(A, \<lambda>x. x)"
proof -
  from \<open>\<forall>x\<in>A. x \<noteq> 0\<close> and AC2
  have "Pi(A, \<lambda>x. x) \<noteq> 0" by auto
  then show ?thesis by auto
qed
```

This is essentially trivial: AC0 and AC2 are just different ways of saying the same thing.

### 2.2 A Non-Trivial Equivalence: AC <-> Zorn

The equivalence AC <-> Zorn's Lemma is much more substantial. Let us sketch one direction.

**Zorn => AC:** Given a family $\{B_i\}_{i \in I}$ with $B_i \neq \emptyset$, consider the poset:

$$P = \{f : f \text{ is a partial choice function on some } J \subseteq I\}$$

ordered by extension: $f \leq g$ iff $J_f \subseteq J_g$ and $g$ extends $f$.

- $P$ is non-empty: any single choice $\{(i, b_i)\}$ for some $i \in I$ is in $P$.
- Every chain in $P$ has an upper bound: the union of a chain of compatible partial functions is a partial function.
- By Zorn, $P$ has a maximal element $f$.
- Claim: $\mathrm{domain}(f) = I$. If not, there exists $i \in I \setminus \mathrm{domain}(f)$, and we can extend $f$ by choosing any $b \in B_i$, contradicting maximality.
- So $f \in \Pi(I, B)$ is a total choice function.

---

## 3. The Theory Dependency Graph

### 3.1 ZF Theories (No AC)

```
ZF_Base -> upair -> pair -> func -> equalities -> Bool
                                  \-> WF -> Fixedpt
                                  \-> Ordinal -> Nat -> Arith
                                  \-> Cardinal -> CardinalArith
```

All of these import `ZF` (or earlier theories) and do not use AC. Results include:

- All basic set theory (pairing, union, power set, separation, replacement).
- Functions, ordinals, natural numbers.
- Cardinal definitions, Cantor's theorem, Schroeder-Bernstein.
- Cardinal addition and multiplication (commutativity, associativity, distributivity).

### 3.2 ZFC Theories (With AC)

```
ZFC = ZF + AC axiom
  \-> Cardinal_AC (absorption law, cardinal comparability)
  \-> Zorn (Zorn's Lemma)
  \-> AC/ session (equivalence proofs)
```

### 3.3 What Changes When You Import ZFC?

When a theory imports `ZFC` instead of `ZF`, the following become available:

1. `well_ord(A, r)` for any `A` (every set can be well-ordered).
2. `|A| \<approx> A` for any `A` (every set has a cardinal).
3. `|A| \<le> |B| \<or> |B| \<le> |A|` (cardinal comparability).
4. `InfCard(K) \<Longrightarrow> K \<otimes> K = K` (absorption law).
5. Zorn's Lemma.

---

## 4. Exploring the Dependency Graph: Hands-On

### 4.1 Experiment 1: Cardinal Comparability

Create a theory that imports only `ZF`:

```isabelle
theory AC_Experiment imports ZF begin

(* This should NOT be provable without AC *)
lemma "|nat| \<le> |Pow(nat)| \<or> |Pow(nat)| \<le> |nat|"
  sorry (* Cannot prove without AC *)

end
```

Now change the import to `ZFC`:

```isabelle
theory AC_Experiment imports ZFC begin

lemma "|nat| \<le> |Pow(nat)| \<or> |Pow(nat)| \<le> |nat|"
  by (rule cardinal_linear)

end
```

### 4.2 Experiment 2: The Absorption Law

```isabelle
theory Absorption imports ZF begin

lemma "InfCard(nat) \<Longrightarrow> nat \<otimes> nat = nat"
  sorry (* Requires AC *)

end
```

With `ZFC`:

```isabelle
theory Absorption imports ZFC begin

lemma "InfCard(nat) \<Longrightarrow> nat \<otimes> nat = nat"
  by (rule InfCard_cmult_eq)

end
```

---

## 5. Practice Problems

### Problem 1

**Verify** that AC3 (every surjection has a right inverse) follows from AC0. Write out the proof on paper.

**Solution:** Let $f : A \twoheadrightarrow B$ be surjective. For each $b \in B$, the preimage $f^{-1}[\{b\}] = \{a \in A : f(a) = b\}$ is non-empty (by surjectivity). Apply AC0 to the family $\{f^{-1}[\{b\}] : b \in B\}$ to get a choice function $c$ with $c(f^{-1}[\{b\}]) \in f^{-1}[\{b\}]$. Define $g(b) = c(f^{-1}[\{b\}])$. Then $g : B \to A$ and $f(g(b)) = b$ for all $b \in B$.

### Problem 2

**List** all the theory files in the `AC/` session and classify them as:
- Definition files
- Forward implication proofs (AC_x => AC_y)
- Backward implication proofs (AC_y => AC_x)
- Cycle-closing proofs (establishing full equivalence)

### Problem 3

**Explain** why Dependent Choice (DC) is strictly weaker than full AC. Give an example of a mathematical result that requires DC but not full AC, and one that requires full AC but not DC.

**Solution sketch:**
- DC suffices for: the Baire Category Theorem, Borel determinacy, "well-foundedness = no infinite descending chains."
- Full AC is needed for: the Well-Ordering Theorem for arbitrary sets, the Hahn-Banach Theorem (in full generality), the existence of non-Lebesgue-measurable sets (Vitali sets).

---

## 6. Common Questions

### Q: Is AC "true"?

This is a philosophical question, not a mathematical one. Most working mathematicians accept AC because it is useful and leads to a cleaner theory. Some constructivists reject it because it asserts existence without providing a construction. From the formalist perspective, AC is an axiom: it is consistent with ZF and independent of ZF.

### Q: Does Isabelle/ZF assume AC by default?

No. You must explicitly import `ZFC` to use AC. Theories that import only `ZF` cannot use AC, and Isabelle will reject any proof that relies on it.

### Q: Can I use AC in some lemmas but not others within the same theory?

If your theory imports `ZFC`, then AC is available everywhere. To mix, you would need separate theory files: one importing `ZF` and one importing `ZFC`. In practice, mark clearly which results use AC.
