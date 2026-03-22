# Homework 01: Isar Proofs

> **Module 01 — Isabelle/Pure & the Isar Language**
> **Due:** Two weeks from assignment
> **Estimated time:** 15-20 hours
> **Submission:** Isabelle theory files (`.thy`)
> **Total points:** 200

---

## Instructions

- Submit your solutions as Isabelle theory files. Each file must be a complete, self-contained theory that Isabelle processes without errors.
- All proofs must be in **Isar style** (structured proofs using `proof`/`qed`, `have`, `show`, `assume`, `fix`, etc.). Do **not** submit apply-script proofs unless a problem explicitly allows it.
- You may use `auto`, `blast`, `simp`, and other automation to close individual subgoals, but the overall proof structure must be explicit Isar.
- Do **not** use `sorry` in your final submission.
- Collaboration policy: you may discuss proof strategies with classmates, but write all Isabelle code independently.

---

## Part A: Propositional Logic in FOL (60 points)

Submit as `HW01_PartA.thy` importing `FOL`.

### Problem A1: Basic Connectives (20 pts)

Prove each of the following lemmas using Isar. Use only the rules `impI`, `mp`, `conjI`, `conjunct1`, `conjunct2`, `disjI1`, `disjI2`, `disjE`, `notI`, `notE`, `FalseE`, `iffI`, `iffD1`, `iffD2`, and `classical` (for classical reasoning). You may use `assumption` but not `auto`, `blast`, or `simp`.

**(a)** (4 pts)

```isabelle
lemma A1a: "P & (Q & R) <-> (P & Q) & R"
```

**(b)** (4 pts)

```isabelle
lemma A1b: "P | (Q | R) <-> (P | Q) | R"
```

**(c)** (4 pts)

```isabelle
lemma A1c: "P & (Q | R) <-> (P & Q) | (P & R)"
```

**(d)** (4 pts)

```isabelle
lemma A1d: "(P --> Q) <-> (~P | Q)"
```

*Note:* One direction requires the `classical` rule: $(\neg P \Longrightarrow P) \Longrightarrow P$.

**(e)** (4 pts)

```isabelle
lemma A1e: "(P <-> Q) <-> (P --> Q) & (Q --> P)"
```

### Problem A2: Classical Reasoning (20 pts)

These theorems require classical logic. Use the `classical` axiom or derived rules like double negation elimination.

**(a)** (5 pts)

```isabelle
lemma A2a: "~~P --> P"
```

**(b)** (5 pts)

```isabelle
lemma A2b: "((P --> Q) --> P) --> P"
```

This is Peirce's law. Give a detailed Isar proof.

**(c)** (5 pts)

```isabelle
lemma A2c: "(~P --> ~Q) --> (Q --> P)"
```

Contrapositive (the direction that requires classical logic).

**(d)** (5 pts)

```isabelle
lemma A2d: "(~P --> Q) --> (~P --> ~Q) --> P"
```

### Problem A3: de Morgan's Laws (20 pts)

Prove all four de Morgan's laws. Two are intuitionistic; two require classical reasoning. For each, state in a comment whether the proof is intuitionistic or classical.

**(a)** (5 pts)

```isabelle
lemma A3a: "~(P | Q) <-> (~P & ~Q)"
```

**(b)** (5 pts)

```isabelle
lemma A3b: "~(P & Q) <-> (~P | ~Q)"
```

*Note:* One direction of (b) requires classical logic.

**(c)** (5 pts)

```isabelle
lemma A3c: "~(P & Q) --> (~P | ~Q)"
```

Give a standalone proof of the classical direction from (b).

**(d)** (5 pts)

```isabelle
lemma A3d: "(~P | ~Q) --> ~(P & Q)"
```

Give a standalone proof of the intuitionistic direction.

---

## Part B: Predicate Logic in FOL (60 points)

Submit as `HW01_PartB.thy` importing `FOL`.

### Problem B1: Quantifier Manipulation (20 pts)

**(a)** (5 pts)

```isabelle
lemma B1a: "(ALL x. P(x) & Q(x)) <-> (ALL x. P(x)) & (ALL x. Q(x))"
```

**(b)** (5 pts)

```isabelle
lemma B1b: "(EX x. P(x) | Q(x)) <-> (EX x. P(x)) | (EX x. Q(x))"
```

**(c)** (5 pts)

```isabelle
lemma B1c: "(ALL x. P(x)) | (ALL x. Q(x)) --> (ALL x. P(x) | Q(x))"
```

**(d)** (5 pts)

```isabelle
lemma B1d: "~(ALL x. P(x)) <-> (EX x. ~P(x))"
```

*Note:* One direction requires classical logic. State which in a comment.

### Problem B2: Quantifier Scope (20 pts)

**(a)** (5 pts)

```isabelle
lemma B2a: "(ALL x. P(x) --> Q) <-> ((EX x. P(x)) --> Q)"
```

Assume $x$ does not occur free in $Q$.

**(b)** (5 pts)

```isabelle
lemma B2b: "(EX x. P(x) --> Q) <-> ((ALL x. P(x)) --> Q)"
```

Assume $x$ does not occur free in $Q$. One direction requires classical logic.

**(c)** (5 pts)

```isabelle
lemma B2c: "(ALL x. P(x) --> Q(x)) --> (ALL x. P(x)) --> (ALL x. Q(x))"
```

**(d)** (5 pts)

```isabelle
lemma B2d: "(ALL x. P(x) --> Q(x)) --> (EX x. P(x)) --> (EX x. Q(x))"
```

### Problem B3: Equality (20 pts)

**(a)** (5 pts)

```isabelle
lemma B3a: "a = b --> b = a"
```

Prove using only `refl` and `subst` (the equality rules in FOL).

**(b)** (5 pts)

```isabelle
lemma B3b: "[| a = b; b = c |] ==> a = c"
```

Prove using only `subst`.

**(c)** (5 pts)

```isabelle
lemma B3c: "a = b --> f(a) = f(b)"
```

**(d)** (5 pts)

```isabelle
lemma B3d: "[| a = b; P(a) |] ==> P(b)"
```

---

## Part C: Set-Theoretic Statements (40 points)

Submit as `HW01_PartC.thy` importing `Main` (HOL).

Use Isabelle/HOL's built-in set theory (sets are typed as `'a set`). You may use `auto`, `blast`, and `simp` to close individual steps, but the overall proof must be structured Isar.

### Problem C1: Set Operations (20 pts)

**(a)** (5 pts)

```isabelle
lemma C1a: "A \<inter> (B \<union> C) = (A \<inter> B) \<union> (A \<inter> C)"
```

**(b)** (5 pts)

```isabelle
lemma C1b: "A - (B \<inter> C) = (A - B) \<union> (A - C)"
```

**(c)** (5 pts)

```isabelle
lemma C1c: "A \<subseteq> B \<Longrightarrow> C \<subseteq> D \<Longrightarrow> A \<inter> C \<subseteq> B \<inter> D"
```

**(d)** (5 pts)

```isabelle
lemma C1d: "f ` (A \<union> B) = f ` A \<union> f ` B"
```

where `f ` S` denotes the image of set `S` under function `f`.

### Problem C2: Indexed Families (20 pts)

**(a)** (5 pts)

```isabelle
lemma C2a: "(\<Inter>i \<in> I. A i \<inter> B) = (\<Inter>i \<in> I. A i) \<inter> B"
```

Assume `I \<noteq> {}`.

**(b)** (5 pts)

```isabelle
lemma C2b: "(\<Union>i \<in> I. A i) \<inter> B = (\<Union>i \<in> I. A i \<inter> B)"
```

**(c)** (5 pts)

```isabelle
lemma C2c: "f ` (\<Union>i \<in> I. A i) = (\<Union>i \<in> I. f ` A i)"
```

**(d)** (5 pts)

```isabelle
lemma C2d: "(\<Union>i \<in> I. A i) \<subseteq> B \<longleftrightarrow> (\<forall>i \<in> I. A i \<subseteq> B)"
```

---

## Part D: Locale Practice (40 points)

Submit as `HW01_PartD.thy` importing `Main` (HOL).

### Problem D1: Defining and Using a Locale (20 pts)

**(a)** (5 pts) Define a locale `preorder` with a fixed relation `le :: "'a => 'a => bool"` and assumptions for reflexivity and transitivity.

**(b)** (5 pts) Inside the `preorder` locale, define the strict order `lt a b = (le a b & a ~= b)` and prove that `lt` is irreflexive and transitive.

**(c)** (5 pts) Extend `preorder` to a locale `partial_order` by adding an antisymmetry assumption. Prove inside `partial_order` that `lt` is antisymmetric (in the sense that `lt a b ==> ~(lt b a)`).

**(d)** (5 pts) Provide an interpretation showing that `(<=)` on `nat` is a `partial_order`.

### Problem D2: Algebraic Hierarchy (20 pts)

**(a)** (5 pts) Define a locale `magma` with a binary operation `op :: "'a => 'a => 'a"`.

**(b)** (5 pts) Extend to `semigroup` by adding associativity. Prove a four-element associativity lemma: `op a (op b (op c d)) = op (op (op a b) c) d`.

**(c)** (5 pts) Extend to `monoid` by adding an identity element. Prove that the identity is unique.

**(d)** (5 pts) Provide interpretations showing that `(+)` on `nat` and `(@)` on `'a list` (list append) form monoids, with identities `0` and `[]` respectively.

---

## Submission Checklist

- [ ] `HW01_PartA.thy`: Propositional logic proofs (A1-A3), all in Isar style.
- [ ] `HW01_PartB.thy`: Predicate logic proofs (B1-B3), all in Isar style.
- [ ] `HW01_PartC.thy`: Set theory proofs (C1-C2), structured Isar with automation for subgoals.
- [ ] `HW01_PartD.thy`: Locale definitions, proofs, and interpretations (D1-D2).
- [ ] All files process without errors in Isabelle (no `sorry`, no red highlighting).
- [ ] Each classical proof is annotated with a comment indicating that classical reasoning is used.

---

## Grading Rubric Summary

| Problem | Points | Topic |
|---------|--------|-------|
| A1 | 20 | Basic connectives (biconditionals) |
| A2 | 20 | Classical reasoning |
| A3 | 20 | de Morgan's laws |
| B1 | 20 | Quantifier manipulation |
| B2 | 20 | Quantifier scope |
| B3 | 20 | Equality reasoning |
| C1 | 20 | Set operations |
| C2 | 20 | Indexed families |
| D1 | 20 | Preorder/partial order locales |
| D2 | 20 | Algebraic hierarchy |
| **Total** | **200** | |

---

## Hints

**A1d (right-to-left):** To prove `(~P | Q) --> (P --> Q)`, assume `~P | Q` and `P`, then case-split on the disjunction. In the `~P` case, derive `False` from `P` and `~P`, then use `FalseE`.

**A2b (Peirce's law):** Use `classical` to set up a proof by contradiction. Assume `~P`. Then construct a proof of `P --> Q` from `~P` (since `~P` and `P` give `False`, and `FalseE` gives `Q`). Apply the hypothesis `(P --> Q) --> P` to get `P`, contradicting `~P`.

**B1d (right-to-left):** Assume `EX x. ~P(x)` and `ALL x. P(x)`. Obtain a witness `a` with `~P(a)`. Also derive `P(a)` from the universal. Contradiction.

**B2b (right-to-left):** The proof that `((ALL x. P(x)) --> Q) --> (EX x. P(x) --> Q)` requires classical reasoning. Consider two cases: either `ALL x. P(x)` or `~(ALL x. P(x))`. In the first case, we can use any witness. In the second, we get `EX x. ~P(x)` (classically), and for such a witness, `P(x) --> Q` is vacuously true.

**D1(c):** To prove antisymmetry of `lt` in a partial order: assume `lt a b` and `lt b a`. Unfolding, we get `le a b`, `a ~= b`, `le b a`, `b ~= a`. By antisymmetry of `le`, we get `a = b`, contradicting `a ~= b`.

---

*This homework builds your Isabelle proficiency from basic rule application through structured reasoning to locale-based algebraic development.*
