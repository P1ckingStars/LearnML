# Lecture 02b: Natural Deduction Rules in Isabelle

> **Module 02 — First-Order Logic in Isabelle (Weeks 3-4)**
> Estimated study time: 5-7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. State every natural deduction rule available in Isabelle/FOL with its precise type and Isabelle name.
2. Classify rules as introduction, elimination, or destruction rules and explain the distinction.
3. Apply rules interactively using `rule`, `erule`, and `drule` with explicit rule names.
4. Chain multiple rule applications to construct complete proofs.
5. Use the equality rules (`refl`, `subst`, `sym`, `trans`) for equational reasoning.

---

## 1. The Complete Rule Set

Isabelle/FOL provides the following natural deduction rules. We present them grouped by connective, with the Isabelle name, statement, and the natural deduction rule it corresponds to.

### 1.1 Conjunction ($\land$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `conjI` | `[| P; Q |] ==> P & Q` | Introduction |
| `conjunct1` | `P & Q ==> P` | Destruction |
| `conjunct2` | `P & Q ==> Q` | Destruction |
| `conjE` | `[| P & Q; [| P; Q |] ==> R |] ==> R` | Elimination |

**Usage patterns:**

```isabelle
(* Introduction: prove P & Q by proving P and Q separately *)
from `P` `Q` have "P & Q" by (rule conjI)

(* Destruction: extract one conjunct *)
from `P & Q` have "P" by (rule conjunct1)
from `P & Q` have "Q" by (rule conjunct2)

(* Elimination: split P & Q into P and Q as assumptions *)
from `P & Q` have "R"
proof (erule conjE)
  assume "P" and "Q"
  show "R" by ...
qed
```

**When to use which.** `conjunct1`/`conjunct2` are simpler and preferred for forward reasoning. `conjE` is useful in backward reasoning when you want both conjuncts simultaneously as assumptions.

### 1.2 Disjunction ($\lor$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `disjI1` | `P ==> P \| Q` | Introduction |
| `disjI2` | `Q ==> P \| Q` | Introduction |
| `disjE` | `[| P \| Q; P ==> R; Q ==> R |] ==> R` | Elimination |

**Usage patterns:**

```isabelle
(* Introduction: inject into left or right disjunct *)
from `P` have "P | Q" by (rule disjI1)
from `Q` have "P | Q" by (rule disjI2)

(* Elimination: case analysis *)
from `P | Q` have "R"
proof (rule disjE)
  assume "P"
  show "R" by ...
next
  assume "Q"
  show "R" by ...
qed
```

**Note.** `disjE` is the most commonly used case-analysis rule. In Isar, the two cases are separated by `next`.

### 1.3 Implication ($\longrightarrow$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `impI` | `(P ==> Q) ==> P --> Q` | Introduction |
| `mp` | `[| P --> Q; P |] ==> Q` | Elimination |
| `impE` | `[| P --> Q; P; Q ==> R |] ==> R` | Elimination (alternative) |

**Usage patterns:**

```isabelle
(* Introduction: assume antecedent, prove consequent *)
show "P --> Q"
proof (rule impI)
  assume "P"
  show "Q" by ...
qed

(* Elimination: modus ponens *)
from `P --> Q` `P` have "Q" by (rule mp)

(* Alternative elimination with continuation *)
from `P --> Q` `P` have "R"
  by (erule impE, assumption, ...)
```

**`mp` vs `impE`.** The rule `mp` directly produces the consequent. The rule `impE` produces $R$ from $P \to Q$, $P$, and a subproof of $R$ from $Q$. Use `mp` for forward reasoning; `impE` is used by `erule` in backward reasoning.

### 1.4 Negation ($\neg$) and Falsehood ($\bot$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `notI` | `(P ==> False) ==> ~P` | Introduction |
| `notE` | `[| ~P; P |] ==> R` | Elimination |
| `FalseE` | `False ==> P` | Elimination (ex falso) |

**Usage patterns:**

```isabelle
(* Introduction: proof by contradiction *)
show "~P"
proof (rule notI)
  assume "P"
  show "False" by ...
qed

(* Elimination: derive anything from contradiction *)
from `~P` `P` have "R" by (rule notE)

(* Ex falso: from False, conclude anything *)
from `False` have "P" by (rule FalseE)
```

### 1.5 Biconditional ($\leftrightarrow$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `iffI` | `[| P ==> Q; Q ==> P |] ==> P <-> Q` | Introduction |
| `iffD1` | `[| P <-> Q; P |] ==> Q` | Destruction |
| `iffD2` | `[| P <-> Q; Q |] ==> P` | Destruction |
| `iffE` | `[| P <-> Q; [| P --> Q; Q --> P |] ==> R |] ==> R` | Elimination |

**Usage patterns:**

```isabelle
(* Introduction: prove both directions *)
show "P <-> Q"
proof (rule iffI)
  assume "P" show "Q" by ...
next
  assume "Q" show "P" by ...
qed

(* Destruction: use one direction *)
from `P <-> Q` `P` have "Q" by (rule iffD1)
from `P <-> Q` `Q` have "P" by (rule iffD2)
```

### 1.6 Universal Quantifier ($\forall$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `allI` | `(!!x. P(x)) ==> ALL x. P(x)` | Introduction |
| `spec` | `ALL x. P(x) ==> P(a)` | Elimination |
| `allE` | `[| ALL x. P(x); P(a) ==> R |] ==> R` | Elimination (with continuation) |

**Usage patterns:**

```isabelle
(* Introduction: fix an arbitrary variable *)
show "ALL x. P(x)"
proof (rule allI)
  fix x
  show "P(x)" by ...
qed

(* Elimination: specialize to a particular term *)
from `ALL x. P(x)` have "P(a)" by (rule spec)

(* With continuation *)
from `ALL x. P(x)` have "R"
  by (erule allE, ...)   (* instantiates x, gives P(a) as assumption *)
```

**Note on `spec` vs `allE`.** `spec` directly instantiates the universal and is preferred for forward reasoning. `allE` is used by `erule` in backward reasoning; the instance is determined by unification with the goal.

### 1.7 Existential Quantifier ($\exists$)

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `exI` | `P(a) ==> EX x. P(x)` | Introduction |
| `exE` | `[| EX x. P(x); !!x. P(x) ==> Q |] ==> Q` | Elimination |

**Usage patterns:**

```isabelle
(* Introduction: provide a witness *)
from `P(a)` have "EX x. P(x)" by (rule exI)

(* Elimination: obtain a witness *)
from `EX x. P(x)` obtain a where "P(a)" by (rule exE)
```

**The witness problem.** When applying `rule exI` backward, Isabelle needs to know the witness term. Sometimes unification determines it:

```isabelle
show "EX x. x = a"
  by (rule exI, rule refl)   (* Isabelle infers x = a *)
```

But sometimes you need to specify it:

```isabelle
show "EX x. P(x)"
  by (rule exI [of _ "a"])   (* explicitly say x = a *)
```

### 1.8 Classical Axiom

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `classical` | `(~P ==> P) ==> P` | Axiom (classical) |

And derived classical rules:

| Name | Statement |
|------|-----------|
| `excluded_middle` | `~P \| P` |
| `notnotD` | `~~P ==> P` |
| `case_split` | `[| P ==> Q; ~P ==> Q |] ==> Q` |
| `ccontr` | `(~P ==> False) ==> P` |

### 1.9 Equality

| Name | Statement | Rule Type |
|------|-----------|-----------|
| `refl` | `a = a` | Axiom |
| `subst` | `[| a = b; P(a) |] ==> P(b)` | Axiom |
| `sym` | `a = b ==> b = a` | Derived |
| `trans` | `[| a = b; b = c |] ==> a = c` | Derived |
| `ssubst` | `[| b = a; P(a) |] ==> P(b)` | Derived (reverse subst) |

---

## 2. Rule Classification

### 2.1 Introduction vs Elimination vs Destruction

**Introduction rules** tell you how to *prove* a formula. They match the *conclusion* of the rule against your goal:

$$\frac{\text{premises}}{\text{connective-formula}} \; (\text{intro})$$

**Elimination rules** tell you how to *use* a formula. They match a *premise* against an assumption and the *conclusion* against the goal:

$$\frac{\text{connective-formula} \quad \text{side-premises}}{\text{conclusion}} \; (\text{elim})$$

**Destruction rules** are a special case of elimination: they match a premise against an assumption and add the conclusion as a new assumption, without changing the goal:

$$\frac{\text{connective-formula}}{\text{simpler-formula}} \; (\text{dest})$$

### 2.2 Safe vs Unsafe Rules

**Safe rules** always make progress and never lose information:

- All introduction rules (except `disjI1`, `disjI2`, `exI`)
- `conjE`, `disjE`, `exE`

**Unsafe rules** may commit to a choice that turns out wrong:

- `disjI1`, `disjI2` (choose left or right — might choose wrong)
- `exI` (choose a witness — might choose wrong)
- `allE` (choose an instance — might choose wrong)
- `impE` (requires proving the antecedent — might not be provable)

Automation methods like `blast` handle unsafe rules by backtracking. In manual proofs, you apply unsafe rules when you know which choice is correct.

---

## 3. Interactive Rule Application

### 3.1 The `rule` Method

`rule thm` applies a theorem backward:

1. Unifies the conclusion of `thm` with the current goal.
2. Replaces the goal with the premises of `thm`.

```isabelle
(* Goal: P & Q --> P *)
apply (rule impI)
(* New goal: P & Q ==> P *)
apply (drule conjunct1)
(* Assumption P & Q replaced by P; goal is P *)
apply assumption
(* Goal solved *)
```

Note: we use `drule` (destruction rule), not `erule`, because `conjunct1` is a destruction rule (`P & Q ==> P`) that replaces an assumption rather than eliminating a connective. Alternatively, the single step `apply (erule conjunct1)` works here because `erule` unifies `conjunct1`'s conclusion with the goal and its premise with an assumption, but conceptually `drule` is the correct classification.

### 3.2 The `erule` Method

`erule thm` is like `rule` but additionally matches the first premise of `thm` with an assumption and removes that assumption:

```isabelle
(* Goal: [| P & Q |] ==> ... *)
apply (erule conjE)
(* Assumption P & Q is removed; P and Q are added separately *)
```

### 3.3 The `drule` Method

`drule thm` matches the first premise of `thm` with an assumption, removes that assumption, and adds `thm`'s conclusion as a new assumption:

```isabelle
(* Goal: [| P & Q |] ==> R *)
apply (drule conjunct1)
(* Goal: [| P |] ==> R    — P & Q replaced by P *)
```

### 3.4 Choosing Between `rule`, `erule`, `drule`

| Method | Matches goal? | Matches assumption? | Removes assumption? |
|--------|--------------|--------------------|--------------------|
| `rule` | Yes (conclusion) | No | No |
| `erule` | Yes (conclusion) | Yes (first premise) | Yes |
| `drule` | No | Yes (first premise) | Yes |

**Guidelines:**

- Use `rule` for introduction rules (matching the goal).
- Use `erule` for elimination rules (matching an assumption and the goal).
- Use `drule` for destruction rules (transforming an assumption).

---

## 4. Worked Examples

### 4.1 Modus Tollens

```isabelle
lemma modus_tollens: "[| P --> Q; ~Q |] ==> ~P"
proof (rule notI)
  assume "P --> Q"
  assume "~Q"
  assume "P"
  from `P --> Q` `P` have "Q" by (rule mp)
  from `~Q` this show "False" by (rule notE)
qed
```

### 4.2 Constructive Dilemma

```isabelle
lemma constructive_dilemma:
  "[| P --> Q; R --> S; P | R |] ==> Q | S"
proof -
  assume pq: "P --> Q"
  assume rs: "R --> S"
  assume "P | R"
  then show "Q | S"
  proof (rule disjE)
    assume "P"
    with pq have "Q" by (rule mp)
    then show "Q | S" by (rule disjI1)
  next
    assume "R"
    with rs have "S" by (rule mp)
    then show "Q | S" by (rule disjI2)
  qed
qed
```

### 4.3 Quantifier Reasoning

```isabelle
lemma barber:
  "ALL x. P(x) <-> ~P(x) ==> False"
proof -
  assume h: "ALL x. P(x) <-> ~P(x)"
  from h have inst: "P(a) <-> ~P(a)" by (rule spec)
  show "False"
  proof (cases "P(a)")
    assume pa: "P(a)"
    from inst pa have "~P(a)" by (rule iffD1)
    from this pa show "False" by (rule notE)
  next
    assume npa: "~P(a)"
    from inst npa have "P(a)" by (rule iffD2)
    from npa this show "False" by (rule notE)
  qed
qed
```

### 4.4 Equality Chain

```isabelle
lemma eq_chain: "[| f(a) = b; g(b) = c; h(c) = d |] ==> h(g(f(a))) = d"
proof -
  assume "f(a) = b" and "g(b) = c" and "h(c) = d"
  from `f(a) = b` have "g(f(a)) = g(b)" by (rule subst, rule refl)
  from this `g(b) = c` have "g(f(a)) = c" by (rule trans)
  hence "h(g(f(a))) = h(c)" by (rule subst, rule refl)
  from this `h(c) = d` show "h(g(f(a))) = d" by (rule trans)
qed
```

In practice, `simp` handles such chains effortlessly:

```isabelle
lemma "[| f(a) = b; g(b) = c; h(c) = d |] ==> h(g(f(a))) = d"
  by simp
```

---

## 5. Summary Table

| Connective | Intro | Elim | Destruction | Classical |
|-----------|-------|------|-------------|-----------|
| $\land$ | `conjI` | `conjE` | `conjunct1`, `conjunct2` | No |
| $\lor$ | `disjI1`, `disjI2` | `disjE` | — | No |
| $\to$ | `impI` | `impE` | `mp` | No |
| $\neg$ | `notI` | `notE` | — | No |
| $\leftrightarrow$ | `iffI` | `iffE` | `iffD1`, `iffD2` | No |
| $\forall$ | `allI` | `allE` | `spec` | No |
| $\exists$ | `exI` | `exE` | — | No |
| $\bot$ | — | `FalseE` | — | No |
| $=$ | `refl` | — | `subst`, `sym`, `trans` | No |
| classical | — | — | `classical`, `notnotD`, `ccontr` | Yes |

---

## 6. Exercises

**Exercise 6.1.** Prove `"[| P --> Q; P --> ~Q |] ==> ~P"` using only the named rules (no automation).

**Exercise 6.2.** Prove `"(ALL x. P(x)) --> ~(EX x. ~P(x))"` without automation. Identify whether classical reasoning is needed.

**Exercise 6.3.** Prove `"~(EX x. P(x)) --> (ALL x. ~P(x))"` without automation. This is one direction of quantifier duality.

**Exercise 6.4.** Prove the other direction: `"(ALL x. ~P(x)) --> ~(EX x. P(x))"` without automation.

**Exercise 6.5.** Use `rule`, `erule`, and `drule` in apply-script style to prove `"P & Q & R ==> R & Q & P"`. Write out the proof state after each step.

**Exercise 6.6.** Prove `"a = b ==> f(a) = f(b)"` using only `refl` and `subst`. Then explain why this is called the *congruence* property of equality.

---

## References

- Isabelle source: `src/FOL/IFOL.thy`, `src/FOL/FOL.thy`
- Paulson, L.C. "Natural Deduction as Higher-Order Resolution." *Journal of Logic Programming* 3:237-258, 1986.
- Paulson, L.C. *Logic and Proof* (Cambridge lecture notes). Chapter on FOL in Isabelle.
- Nipkow, T., Paulson, L.C., and Wenzel, M. *Isabelle/HOL: A Proof Assistant for Higher-Order Logic*. Chapter 5.

---

*Previous: [Lecture 02a: IFOL & the Classical Extension](lecture_02a_ifol_classical_extension.md)*
*Next: [Lecture 02c: Proof Methods — rule, blast, auto](lecture_02c_proof_methods_deep_dive.md)*
