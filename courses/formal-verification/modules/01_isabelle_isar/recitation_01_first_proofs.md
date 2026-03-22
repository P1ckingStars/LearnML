# Recitation 01: First Proofs in Isabelle

## Overview

This recitation is a hands-on introduction to writing proofs in Isabelle. Every code block is meant to be entered into a `.thy` file and processed by Isabelle. By the end, you will have completed several proofs in both FOL and HOL and developed intuition for choosing proof methods.

**Prerequisites:** Lectures 01a-01c, a working Isabelle installation with jEdit.

---

## 1. Setting Up: The jEdit IDE

### 1.1 Launching Isabelle

Start Isabelle/jEdit from the command line:

```bash
isabelle jedit
```

or on macOS, open the Isabelle application. The jEdit IDE provides:

- **Syntax highlighting** for `.thy` files.
- **Continuous checking**: Isabelle processes your theory file in the background as you type, showing results immediately.
- **Output panel** (bottom): displays the current proof state, error messages, and search results.
- **Sidekick panel** (right): shows the theory structure.

### 1.2 Creating Your First Theory File

Create a file `First_Proofs.thy`:

```isabelle
theory First_Proofs
  imports FOL
begin

(* We will add proofs here *)

end
```

Save it and watch Isabelle process it. The status bar at the bottom should show green (no errors).

---

## 2. Your First Proofs in FOL

### 2.1 Identity

The simplest possible theorem:

```isabelle
lemma identity: "P --> P"
  by (rule impI)
```

Let us unpack this. The goal is `P --> P` (object-level implication in FOL). The method `rule impI` applies the introduction rule for implication:

$$\frac{\Gamma, P \vdash P}{\Gamma \vdash P \longrightarrow P}$$

After `impI`, the remaining goal is `P ==> P` (a meta-implication: assuming `P`, prove `P`). This is trivially true, and `rule impI` handles it.

### 2.2 Conjunction Commutativity

```isabelle
lemma conj_comm: "P & Q --> Q & P"
proof (rule impI)
  assume pq: "P & Q"
  from pq have q: "Q" by (rule conjunct2)
  from pq have p: "P" by (rule conjunct1)
  from q p show "Q & P" by (rule conjI)
qed
```

Step by step:

1. `proof (rule impI)` — We are proving an implication, so assume the antecedent.
2. `assume pq: "P & Q"` — Name the assumption.
3. `from pq have q: "Q" by (rule conjunct2)` — Extract the second conjunct.
4. `from pq have p: "P" by (rule conjunct1)` — Extract the first conjunct.
5. `from q p show "Q & P" by (rule conjI)` — Combine them in the new order.

### 2.3 Modus Ponens Chain

```isabelle
lemma mp_chain: "[| P --> Q; Q --> R; P |] ==> R"
proof -
  assume pq: "P --> Q"
  assume qr: "Q --> R"
  assume p: "P"
  from pq p have "Q" by (rule mp)
  with qr show "R" by (rule mp)
qed
```

Note the bracket notation `[| A; B; C |] ==> D` which is syntactic sugar for `A ==> B ==> C ==> D`.

### 2.4 Disjunction Commutativity

```isabelle
lemma disj_comm: "P | Q --> Q | P"
proof (rule impI)
  assume "P | Q"
  then show "Q | P"
  proof (rule disjE)
    assume "P"
    then show "Q | P" by (rule disjI2)
  next
    assume "Q"
    then show "Q | P" by (rule disjI1)
  qed
qed
```

The `disjE` rule performs case analysis. The `next` keyword separates the two cases.

---

## 3. Working with Quantifiers

### 3.1 Universal Statements

```isabelle
lemma all_imp: "[| ALL x. P(x) --> Q(x); ALL x. P(x) |] ==> ALL x. Q(x)"
proof (rule allI)
  fix a
  assume h1: "ALL x. P(x) --> Q(x)"
  assume h2: "ALL x. P(x)"
  from h1 have "P(a) --> Q(a)" by (rule spec)
  moreover from h2 have "P(a)" by (rule spec)
  ultimately show "Q(a)" by (rule mp)
qed
```

Key points:

- `rule allI` reduces the goal from `ALL x. Q(x)` to `Q(a)` for a fixed `a`.
- `fix a` names the fixed variable.
- `rule spec` instantiates `ALL x. P(x)` to `P(a)` (spec is the name for $\forall$-elimination in FOL).

### 3.2 Existential Statements

```isabelle
lemma ex_conj: "EX x. P(x) & Q(x) ==> (EX x. P(x)) & (EX x. Q(x))"
proof -
  assume "EX x. P(x) & Q(x)"
  then obtain a where pqa: "P(a) & Q(a)" by (rule exE)
  from pqa have "P(a)" by (rule conjunct1)
  then have ep: "EX x. P(x)" by (rule exI)
  from pqa have "Q(a)" by (rule conjunct2)
  then have eq: "EX x. Q(x)" by (rule exI)
  from ep eq show "(EX x. P(x)) & (EX x. Q(x))" by (rule conjI)
qed
```

The `obtain` command is used with `exE` to introduce a witness variable.

---

## 4. Using Automation

### 4.1 When `auto` Suffices

Many of the proofs above can be solved instantly by automation:

```isabelle
lemma "P & Q --> Q & P" by auto
lemma "P | Q --> Q | P" by auto
lemma "[| ALL x. P(x) --> Q(x); ALL x. P(x) |] ==> ALL x. Q(x)" by auto
lemma "EX x. P(x) & Q(x) ==> (EX x. P(x)) & (EX x. Q(x))" by auto
```

### 4.2 When `blast` Is Better

For purely logical goals (no simplification needed), `blast` is often faster:

```isabelle
lemma "ALL x. EX y. P(x,y) ==> EX f. ALL x. P(x, f(x))"
  by blast   (* This requires Skolemization — blast handles it *)
```

Wait — this statement is actually the Axiom of Choice, which is not provable in plain FOL. Let us try something that actually works:

```isabelle
lemma "ALL x. P(x) | Q(x) ==> (ALL x. P(x)) | (EX x. Q(x))"
  (* This is NOT valid in FOL — blast will fail *)
  (* by blast  -- would fail *)
  oops

lemma "(ALL x. P(x) --> Q(x)) --> (EX x. P(x)) --> (EX x. Q(x))"
  by blast   (* This IS valid *)
```

### 4.3 When `simp` Is Needed

`simp` handles equational reasoning:

```isabelle
theory Simp_Examples
  imports Main    (* switching to HOL for arithmetic *)
begin

lemma "Suc (Suc 0) + Suc 0 = Suc (Suc (Suc 0))"
  by simp

lemma "(xs @ ys) @ zs = xs @ (ys @ zs)"
  by (simp add: append_assoc)

lemma "rev (rev xs) = xs"
  by simp

end
```

---

## 5. Debugging Failed Proofs

### 5.1 Reading the Proof State

When a method fails, inspect the proof state in the Output panel. Example:

```isabelle
lemma "P & Q --> R"
  apply (rule impI)
```

The output shows:

```
goal (1 subgoal):
 1. P & Q ==> R
```

This tells you: you need to prove `R` from the assumption `P & Q`. Since `R` is unrelated to `P` and `Q`, this goal is not provable — the lemma is wrong.

### 5.2 Using `apply` for Exploration

When an Isar proof is not working, temporarily switch to `apply` style to explore:

```isabelle
lemma "something complicated"
  apply (rule ...)
  apply (erule ...)
  (* inspect proof state *)
  sorry    (* placeholder *)
```

### 5.3 Common Error Messages

| Error | Likely cause |
|-------|-------------|
| `Failed to apply proof method` | The method does not match the current goal |
| `Local statement fails to refine any pending goal` | The `show` statement does not match a subgoal |
| `Illegal application of proof command in state ...` | Wrong proof command for the current state |
| `Undefined fact` | Referencing a name that was not `assume`d or `have`d |

### 5.4 Using `sorry` Strategically

`sorry` closes any goal without proof. Use it to:

1. Check that the overall proof structure is correct before filling in details.
2. Skip a difficult subgoal and work on other parts first.
3. Test whether a statement is even the right one to prove.

```isabelle
lemma complex_result: "..."
proof -
  have step1: "..." by sorry    (* fill in later *)
  have step2: "..." by sorry    (* fill in later *)
  from step1 step2 show "..." by sorry
qed
```

**Important:** `sorry` must be removed before the proof is considered complete. Isabelle marks theories containing `sorry` with a warning.

---

## 6. Practice Problems

Try these in Isabelle. Start with Isar proofs using explicit rules, then verify with `auto` or `blast`.

### 6.1 Propositional Logic (FOL)

```isabelle
(* Prove each of these *)
lemma "P --> P | Q"
  sorry

lemma "(P --> R) --> (Q --> R) --> (P | Q --> R)"
  sorry

lemma "P & (Q | R) --> (P & Q) | (P & R)"
  sorry

lemma "~~P --> P"     (* requires classical logic! *)
  sorry
```

### 6.2 Predicate Logic (FOL)

```isabelle
lemma "ALL x. P(x) & Q(x) ==> (ALL x. P(x)) & (ALL x. Q(x))"
  sorry

lemma "(ALL x. P(x)) | (ALL x. Q(x)) ==> ALL x. P(x) | Q(x)"
  sorry

lemma "~(EX x. P(x)) ==> ALL x. ~P(x)"
  sorry
```

### 6.3 Simple HOL

Switch to `imports Main`:

```isabelle
lemma "length (xs @ ys) = length xs + length ys"
  sorry

lemma "map f (map g xs) = map (f \<circ> g) xs"
  sorry

lemma "filter P (map f xs) = map f (filter (P \<circ> f) xs)"
  sorry
```

---

## 7. Summary

| Concept | Command/Method | When to use |
|---------|---------------|-------------|
| State a theorem | `lemma`, `theorem` | Always — this is how proofs start |
| Open a proof block | `proof (method)` | When you need multiple steps |
| Close a proof block | `qed` | To finish a structured proof |
| One-step proof | `by method` | When one method solves everything |
| Introduce assumption | `assume` | After `proof (rule impI)` or similar |
| Fix a variable | `fix` | After `proof (rule allI)` |
| Obtain a witness | `obtain` | When using an existential assumption |
| Intermediate step | `have` | For forward reasoning |
| Final step | `show` | To prove the current goal |
| Apply a rule | `rule thm` | For backward reasoning with named rules |
| Simplify | `simp` | For equational reasoning |
| Full automation | `auto`, `blast` | When manual steps are tedious |

---

## References

- Nipkow, T. and Klein, G. *Concrete Semantics with Isabelle/HOL*. Springer, 2014. Chapter 2.
- Paulson, L.C. *Logic and Proof* (Cambridge lecture notes). Chapters 1-3.
- Wenzel, M. *The Isabelle/Isar Reference Manual*. Quick Reference section.
