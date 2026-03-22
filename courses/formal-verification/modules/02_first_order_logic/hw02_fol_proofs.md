# Homework 02: FOL Proofs

> **Module 02 — First-Order Logic in Isabelle**
> **Due:** Two weeks from assignment
> **Estimated time:** 15-20 hours
> **Submission:** Isabelle theory files (`.thy`)
> **Total points:** 200

---

## Instructions

- Submit your solutions as Isabelle theory files. Each file must process without errors.
- Unless otherwise specified, all proofs must be in **Isar style** with explicit reasoning steps. You may use `auto`, `blast`, `simp`, etc. to close individual subgoals within a structured proof, but the overall proof must show the logical structure.
- For problems marked **[manual]**, use only the named natural deduction rules (`rule`, `erule`, `drule`, `assumption`) without `auto`, `blast`, `simp`, or other automation.
- For problems marked **[any method]**, you may use any proof method.
- Mark each proof with a comment indicating whether it uses classical reasoning.
- Do **not** use `sorry`.

---

## Part A: Propositional Reasoning (50 points)

Submit as `HW02_PartA.thy` importing `FOL`.

### Problem A1: Tautologies [manual] (20 pts)

Prove each using only named rules (no automation). Label each proof as intuitionistic or classical.

**(a)** (4 pts) Commutativity of disjunction:

```isabelle
lemma A1a: "P | Q --> Q | P"
```

**(b)** (4 pts) Currying:

```isabelle
lemma A1b: "(P & Q --> R) <-> (P --> Q --> R)"
```

**(c)** (4 pts) Exportation and importation combined.

```isabelle
lemma A1c: "(P --> Q --> R) --> (P & Q --> R)"
```

**(d)** (4 pts) Material conditional equivalence:

```isabelle
lemma A1d: "(P --> Q) <-> (~P | Q)"
```

**(e)** (4 pts) Disjunctive syllogism:

```isabelle
lemma A1e: "[| P | Q; ~P |] ==> Q"
```

### Problem A2: Classical Proofs [manual] (15 pts)

These proofs require the `classical` axiom. Show exactly where classical reasoning enters.

**(a)** (5 pts) Peirce's law:

```isabelle
lemma A2a: "((P --> Q) --> P) --> P"
```

**(b)** (5 pts) De Morgan (the classical direction):

```isabelle
lemma A2b: "~(P & Q) --> ~P | ~Q"
```

**(c)** (5 pts) Conditional excluded middle:

```isabelle
lemma A2c: "(P --> Q) | (P --> ~Q)"
```

### Problem A3: Proof Comparison [any method] (15 pts)

For each of the following, provide **two proofs**: one using only `blast` or `auto`, and one in detailed Isar style (using explicit rule applications). In a comment, state which you find clearer and why.

**(a)** (5 pts)

```isabelle
lemma A3a: "(P --> Q) --> (Q --> R) --> (R --> S) --> (P --> S)"
```

**(b)** (5 pts)

```isabelle
lemma A3b: "(P | Q) --> (P --> R) --> (Q --> S) --> (R | S)"
```

**(c)** (5 pts)

```isabelle
lemma A3c: "((P --> Q) --> R) --> ((R --> P) --> (S --> P))"
```

---

## Part B: Quantifier Reasoning (50 points)

Submit as `HW02_PartB.thy` importing `FOL`.

### Problem B1: Basic Quantifiers [manual] (20 pts)

**(a)** (5 pts)

```isabelle
lemma B1a: "(ALL x. P(x) --> Q(x)) --> (ALL x. P(x)) --> (ALL x. Q(x))"
```

**(b)** (5 pts)

```isabelle
lemma B1b: "(ALL x. P(x)) --> (EX x. P(x))"
```

*Note:* This requires the domain to be nonempty, which is guaranteed in Isabelle/FOL.

**(c)** (5 pts)

```isabelle
lemma B1c: "EX x. P(x) & Q(x) ==> (EX x. P(x)) & (EX x. Q(x))"
```

**(d)** (5 pts)

```isabelle
lemma B1d: "(ALL x. P(x)) | (ALL x. Q(x)) ==> ALL x. P(x) | Q(x)"
```

### Problem B2: Quantifier Duality [manual] (15 pts)

Prove all four quantifier duality laws. Mark which require classical reasoning.

**(a)** (4 pts)

```isabelle
lemma B2a: "~(EX x. P(x)) ==> ALL x. ~P(x)"
```

**(b)** (4 pts)

```isabelle
lemma B2b: "(ALL x. ~P(x)) ==> ~(EX x. P(x))"
```

**(c)** (4 pts)

```isabelle
lemma B2c: "~(ALL x. P(x)) ==> EX x. ~P(x)"
```

**(d)** (3 pts)

```isabelle
lemma B2d: "(EX x. ~P(x)) ==> ~(ALL x. P(x))"
```

### Problem B3: Challenging Quantifier Problems [any method] (15 pts)

**(a)** (5 pts) The Drinker's Paradox:

```isabelle
lemma B3a: "EX x. P(x) --> (ALL y. P(y))"
```

Prove this using both `blast` and a detailed Isar proof. Explain in a comment why classical reasoning is essential.

**(b)** (5 pts) Prenex normal form conversion:

```isabelle
lemma B3b: "(ALL x. P(x)) --> (EX y. Q(y)) --> (EX z. ALL w. P(w) & Q(z))"
```

**(c)** (5 pts) Quantifier distribution over biconditional:

```isabelle
lemma B3c: "(ALL x. P(x) <-> Q(x)) ==> (ALL x. P(x)) <-> (ALL x. Q(x))"
```

---

## Part C: Equality Reasoning (50 points)

Submit as `HW02_PartC.thy` importing `FOL`.

### Problem C1: Basic Equality [manual] (20 pts)

Use only `refl`, `subst`, `sym`, `trans`, and propositional rules.

**(a)** (4 pts)

```isabelle
lemma C1a: "a = b ==> f(a) = f(b)"
```

**(b)** (4 pts)

```isabelle
lemma C1b: "[| a = b; b = c; c = d |] ==> f(g(a)) = f(g(d))"
```

**(c)** (4 pts)

```isabelle
lemma C1c: "a = b ==> b = a"
```

Give a proof using only `refl` and `subst` (do not use `sym`).

**(d)** (4 pts)

```isabelle
lemma C1d: "[| a = b; P(a) |] ==> P(b)"
```

This is just `subst`, but prove it using a structured Isar proof that shows the reasoning.

**(e)** (4 pts) Congruence for binary functions:

```isabelle
lemma C1e: "[| a = a'; b = b' |] ==> f(a, b) = f(a', b')"
```

### Problem C2: Equality with Quantifiers [any method] (15 pts)

**(a)** (5 pts) Leibniz's identity of indiscernibles (one direction):

```isabelle
lemma C2a: "a = b ==> (ALL P. P(a) <-> P(b))"
```

**(b)** (5 pts)

```isabelle
lemma C2b: "(ALL x. f(x) = g(x)) ==> f(a) = g(a)"
```

**(c)** (5 pts)

```isabelle
lemma C2c: "[| ALL x. f(x) = x; ALL x. g(f(x)) = x |] ==> ALL x. g(x) = x"
```

### Problem C3: Equational Theories [any method] (15 pts)

**(a)** (5 pts) Suppose $f$ is idempotent and $g$ is its left inverse:

```isabelle
lemma C3a:
  assumes idem: "ALL x. f(f(x)) = f(x)"
      and linv: "ALL x. g(f(x)) = x"
  shows "ALL x. f(x) = x"
```

*Hint:* Apply $g$ to both sides of $f(f(x)) = f(x)$.

**(b)** (5 pts) Suppose $f$ is injective:

```isabelle
lemma C3b:
  assumes inj: "ALL x y. f(x) = f(y) --> x = y"
      and eq:  "f(a) = f(b)"
  shows "a = b"
```

**(c)** (5 pts) Composition of injections:

```isabelle
lemma C3c:
  assumes injf: "ALL x y. f(x) = f(y) --> x = y"
      and injg: "ALL x y. g(x) = g(y) --> x = y"
  shows "ALL x y. f(g(x)) = f(g(y)) --> x = y"
```

---

## Part D: Mixed Problems (50 points)

Submit as `HW02_PartD.thy` importing `FOL`.

### Problem D1: Pelletier's Problems [any method] (25 pts)

Prove each of the following from Pelletier's benchmark set:

**(a)** (5 pts) Pelletier 5:

```isabelle
lemma D1a: "((P --> Q) --> (P --> R)) --> (P --> (Q --> R))"
```

**(b)** (5 pts) Pelletier 13:

```isabelle
lemma D1b: "P | (Q & R) <-> (P | Q) & (P | R)"
```

**(c)** (5 pts) Pelletier 24 (in two parts):

```isabelle
lemma D1c1: "~(EX x. S(x) & Q(x)) & (ALL x. P(x) --> Q(x) | R(x))
             & (~(EX x. P(x)) --> (EX x. Q(x)))
             & (ALL x. Q(x) | R(x) --> S(x))
             --> (EX x. P(x) & R(x))"
```

**(d)** (5 pts) Pelletier 36:

```isabelle
lemma D1d:
  "(ALL x. EX y. J(x,y))
    --> (ALL x. EX y. G(x,y))
    --> (ALL x y. J(x,y) | G(x,y) --> (ALL z. J(y,z) | G(y,z) --> H(x,z)))
    --> (ALL x. EX y. H(x,y))"
```

**(e)** (5 pts) Pelletier 40:

```isabelle
lemma D1e:
  "(EX y. ALL x. F(x,y) <-> F(x,x)) --> ~(ALL x. EX y. ALL z. F(z,y) <-> ~F(z,x))"
```

### Problem D2: Barber Paradox and Russell's Paradox Analogue (25 pts)

**(a)** (10 pts) The Barber Paradox: There is no barber who shaves exactly those who do not shave themselves.

```isabelle
lemma D2a: "~(EX b. ALL x. shaves(b, x) <-> ~shaves(x, x))"
```

Prove this in Isar style with detailed reasoning. Explain the connection to Russell's Paradox in a comment.

**(b)** (5 pts) The fixed-point lemma: every predicate transformer has a fixed point.

```isabelle
lemma D2b:
  assumes surj: "ALL P. EX x. ALL y. F(x, y) <-> P(y)"
  shows "False"
```

*Hint:* Instantiate `P` with the "anti-diagonal" predicate `%y. ~F(y, y)`.

**(c)** (10 pts) Cantor's theorem in FOL: there is no surjection from a set to its power set (expressed without set theory, using predicates).

```isabelle
lemma D2c:
  assumes "\<And>P. \<exists>x. \<forall>y. F(x, y) \<longleftrightarrow> P(y)"
  shows "False"
```

Give a detailed Isar proof. Compare with (b) and explain in a comment why they are essentially the same result.

---

## Submission Checklist

- [ ] `HW02_PartA.thy`: Propositional reasoning (A1-A3).
- [ ] `HW02_PartB.thy`: Quantifier reasoning (B1-B3).
- [ ] `HW02_PartC.thy`: Equality reasoning (C1-C3).
- [ ] `HW02_PartD.thy`: Mixed problems (D1-D2).
- [ ] All files process in Isabelle without errors (no `sorry`).
- [ ] Each proof is annotated: intuitionistic or classical.
- [ ] Problems A3 include both automated and Isar proofs with comparison comments.
- [ ] Problem D2a includes a comment relating to Russell's Paradox.

---

## Grading Rubric Summary

| Problem | Points | Topic |
|---------|--------|-------|
| A1 | 20 | Propositional tautologies (manual) |
| A2 | 15 | Classical reasoning (manual) |
| A3 | 15 | Proof comparison (auto + Isar) |
| B1 | 20 | Basic quantifiers (manual) |
| B2 | 15 | Quantifier duality (manual) |
| B3 | 15 | Challenging quantifier problems |
| C1 | 20 | Basic equality (manual) |
| C2 | 15 | Equality with quantifiers |
| C3 | 15 | Equational theories |
| D1 | 25 | Pelletier's problems |
| D2 | 25 | Russell/Barber/Cantor |
| **Total** | **200** | |

---

## Hints for Selected Problems

**A1d (right-to-left, ~P | Q --> P --> Q):** Assume `~P | Q` and `P`. Case-split on `~P | Q`. In the `~P` case, `P` and `~P` give `False`, hence `Q` by `FalseE`. In the `Q` case, we are done.

**A2b (~(P & Q) --> ~P | ~Q):** Use `classical`. Assume `~(~P | ~Q)` (i.e., the conclusion fails). From `~(~P | ~Q)`, derive both `P` and `Q` (since if `~P` held, we would have `~P | ~Q`, contradiction). So `P & Q` holds, contradicting `~(P & Q)`.

**B2c (~(ALL x. P(x)) ==> EX x. ~P(x)):** Use `classical`. Assume `~(EX x. ~P(x))`. Show `ALL x. P(x)` by fixing `x` and using `classical` again: assume `~P(x)`, then `EX x. ~P(x)` by `exI`, contradicting the assumption.

**B3a (Drinker's Paradox):** Use excluded middle on `ALL y. P(y)`. If yes, any witness works. If no, there exists some $z$ with $\neg P(z)$; use $z$ as witness, and $P(z) \to \forall y.\, P(y)$ is vacuously true since $P(z)$ is false.

**C3a:** From `g(f(f(x))) = g(f(x))` (apply `g` to `idem`) and `g(f(y)) = y` (instantiate `linv`), get `f(x) = x`.

**D2a:** Assume `EX b. ALL x. shaves(b,x) <-> ~shaves(x,x)`. Obtain witness `b`. Instantiate with `x = b` to get `shaves(b,b) <-> ~shaves(b,b)`. Case-split to derive `False`.

---

*This homework develops your proficiency with Isabelle's FOL, from basic rule manipulation to substantive logical reasoning.*
