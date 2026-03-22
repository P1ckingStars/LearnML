# Recitation 02: FOL Exercises

## Overview

This recitation provides hands-on practice with Isabelle/FOL. We will prove standard first-order logic tautologies, work through some of Pelletier's FOL problems, and practice choosing between apply-script style and Isar style.

**Prerequisites:** Lectures 02a-02c, a working Isabelle installation.

---

## 1. Setup

Create a theory file `FOL_Exercises.thy`:

```isabelle
theory FOL_Exercises
  imports FOL
begin

(* Exercises go here *)

end
```

All exercises in Sections 2-4 should be done in this theory.

---

## 2. Pelletier's Problems

Francis Jeffry Pelletier published a collection of 75 first-order logic problems, widely used as benchmarks for automated theorem provers. We will work through a selection.

### 2.1 Problem 1: $(P \to Q) \leftrightarrow (\neg Q \to \neg P)$

```isabelle
lemma pelletier_1: "(P --> Q) <-> (~Q --> ~P)"
```

**Isar proof:**

```isabelle
lemma pelletier_1: "(P --> Q) <-> (~Q --> ~P)"
proof (rule iffI)
  assume pq: "P --> Q"
  show "~Q --> ~P"
  proof (rule impI)
    assume nq: "~Q"
    show "~P"
    proof (rule notI)
      assume "P"
      with pq have "Q" by (rule mp)
      with nq show "False" by (rule notE)
    qed
  qed
next
  assume contra: "~Q --> ~P"
  show "P --> Q"
  proof (rule impI)
    assume p: "P"
    show "Q"
    proof (rule classical)
      assume "~Q"
      with contra have "~P" by (rule mp)
      with p show "Q" by (rule notE)
    qed
  qed
qed
```

Note: the left-to-right direction is intuitionistic, but the right-to-left direction requires classical reasoning.

**Quick proof:**

```isabelle
lemma pelletier_1': "(P --> Q) <-> (~Q --> ~P)"
  by blast
```

### 2.2 Problem 2: $\neg\neg P \leftrightarrow P$

```isabelle
lemma pelletier_2: "~~P <-> P"
```

**Exercise:** Prove this in both Isar style (using `classical` for one direction) and with `blast`.

### 2.3 Problem 4: $(\neg P \to Q) \leftrightarrow (\neg Q \to P)$

```isabelle
lemma pelletier_4: "(~P --> Q) <-> (~Q --> P)"
```

**Exercise:** Prove this. Both directions require classical reasoning.

### 2.4 Problem 9: $(P \lor Q) \land (\neg P \lor Q) \land (P \lor \neg Q) \to \neg(\neg P \lor \neg Q)$

```isabelle
lemma pelletier_9:
  "(P | Q) & (~P | Q) & (P | ~Q) --> ~(~P | ~Q)"
```

**Exercise:** Prove this. Try both `blast` and a manual proof.

### 2.5 Problem 18: $\exists x.\, \forall y.\, P(x) \to P(y)$

```isabelle
lemma pelletier_18: "EX x. ALL y. P(x) --> P(y)"
```

This is actually a form of the Drinker's Paradox. It requires classical reasoning.

**Guided proof:**

```isabelle
lemma pelletier_18: "EX x. ALL y. P(x) --> P(y)"
proof (rule classical)
  assume h: "~(EX x. ALL y. P(x) --> P(y))"
  (* From h, we can derive: for all x, there exists y such that P(x) and ~P(y) *)
  (* In particular, for all x, P(x) must hold (otherwise P(x) --> P(y) for any y) *)
  (* But then ALL y. P(a) --> P(y) for any a, contradicting h *)
  show "EX x. ALL y. P(x) --> P(y)"
    by blast  (* blast can handle this with classical reasoning *)
qed
```

Actually, let us give a cleaner version:

```isabelle
lemma pelletier_18: "EX x. ALL y. P(x) --> P(y)"
  by blast
```

**Exercise:** Try to construct a manual Isar proof. Where exactly does classical reasoning enter?

---

## 3. Comparing Apply-Script vs Isar

### 3.1 Example: Transitivity of Implication

**Apply-script style:**

```isabelle
lemma trans_imp: "(P --> Q) --> (Q --> R) --> (P --> R)"
  apply (rule impI)
  apply (rule impI)
  apply (rule impI)
  apply (erule impE)
   apply assumption
  apply (erule impE)
   apply assumption
  apply assumption
  done
```

**Isar style:**

```isabelle
lemma trans_imp': "(P --> Q) --> (Q --> R) --> (P --> R)"
proof (rule impI)
  assume pq: "P --> Q"
  show "(Q --> R) --> (P --> R)"
  proof (rule impI)
    assume qr: "Q --> R"
    show "P --> R"
    proof (rule impI)
      assume "P"
      with pq have "Q" by (rule mp)
      with qr show "R" by (rule mp)
    qed
  qed
qed
```

**Comparison:**

| Aspect | Apply-script | Isar |
|--------|-------------|------|
| Readability | Low (need to replay) | High (self-documenting) |
| Maintainability | Fragile (breaks easily) | Robust (meaningful errors) |
| Automation-friendly | Yes (mix with auto) | Yes (auto in subgoals) |
| Exploration | Good (inspect proof states) | Requires planning |

### 3.2 Exercise: Rewrite in Both Styles

Take this `blast` proof and rewrite it in both apply-script and Isar:

```isabelle
lemma "(ALL x. P(x) --> Q(x)) --> (EX x. P(x)) --> (EX x. Q(x))"
  by blast
```

**Apply-script version:**

```isabelle
lemma "(ALL x. P(x) --> Q(x)) --> (EX x. P(x)) --> (EX x. Q(x))"
  apply (rule impI)+
  apply (erule exE)
  apply (drule spec)
  apply (erule impE)
   apply assumption
  apply (rule exI)
  apply assumption
  done
```

**Exercise:** Write the Isar version.

---

## 4. Practice with Rule Selection

### 4.1 Guidelines

When faced with a goal, ask:

1. **What is the outermost connective of the goal?** Apply its introduction rule.
2. **What assumptions do I have?** Apply elimination rules to decompose them.
3. **Can I close the goal?** Try `assumption`, `refl`, or direct contradiction.

### 4.2 Exercises

For each problem, first identify which rules you would apply and in what order. Then write the proof.

**Exercise 4.2.1:** `"P & Q --> Q"` (trivial)

**Exercise 4.2.2:** `"P --> ~~P"` (intuitionistic)

**Exercise 4.2.3:** `"(P --> Q) --> (~Q --> ~P)"` (intuitionistic contrapositive)

**Exercise 4.2.4:** `"ALL x. P(x) & Q(x) ==> (ALL x. P(x)) & (ALL x. Q(x))"` (universal distributes over conjunction)

**Exercise 4.2.5:** `"(EX x. P(x)) --> ~(ALL x. ~P(x))"` (existence implies non-universal-negation)

**Exercise 4.2.6:** `"~(EX x. P(x)) <-> (ALL x. ~P(x))"` (quantifier duality, one direction classical)

**Exercise 4.2.7:** `"(P <-> Q) --> (Q <-> P)"` (biconditional symmetry)

**Exercise 4.2.8:** `"EX x. P(x) ==> EX x. P(x) | Q(x)"` (existential weakening)

---

## 5. Debugging Practice

### 5.1 Identifying Wrong Lemmas

Try to prove the following. Some are valid, some are not. Identify the invalid ones and explain why.

```isabelle
(* Valid or invalid? *)
lemma "P --> Q --> P & Q"       (* a *)
lemma "P | Q --> P"             (* b *)
lemma "P --> P | Q"             (* c *)
lemma "ALL x. P(x) | Q(x) --> (ALL x. P(x)) | (ALL x. Q(x))"  (* d *)
lemma "(EX x. P(x) & Q(x)) --> (EX x. P(x)) & (EX x. Q(x))"  (* e *)
lemma "(EX x. P(x)) & (EX x. Q(x)) --> (EX x. P(x) & Q(x))"  (* f *)
```

### 5.2 Diagnosing Method Failures

```isabelle
lemma "ALL x. EX y. P(x) --> P(y)"
  apply (rule allI)
  apply (rule exI)
  apply (rule impI)
  (* What is the proof state here? Why is the goal not trivially solvable? *)
  sorry
```

**Exercise:** Inspect the proof state and explain the issue. The problem is with the witness chosen by `exI`. How would you fix this?

---

## 6. Summary

Key takeaways from this recitation:

1. **Start with the goal's outermost connective** and apply its introduction rule.
2. **Decompose assumptions** using elimination/destruction rules.
3. **Use `blast`** for pure logical goals; **use `auto`** when simplification is also needed.
4. **Classical reasoning** is needed for: double negation elimination, excluded middle, contrapositive (one direction), the Drinker's Paradox, and quantifier duality ($\neg\forall \leftrightarrow \exists\neg$, one direction).
5. **Isar proofs** are preferred for readability and maintainability. Use apply-script style for exploration and debugging.

---

## References

- Pelletier, F.J. "Seventy-Five Problems for Testing Automatic Theorem Provers." *Journal of Automated Reasoning* 2:191-216, 1986.
- Paulson, L.C. *Logic and Proof* (Cambridge lecture notes).
- Nipkow, T. and Klein, G. *Concrete Semantics with Isabelle/HOL*. Chapter 2.
