# Lecture 01b: Isar Structured Proofs

> **Module 01 — Isabelle/Pure & the Isar Language (Weeks 1-2)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain the Isar philosophy of human-readable, structured proofs.
2. Write proofs using `lemma`/`theorem`, `proof`/`qed`, and terminal `by`.
3. Use forward reasoning commands: `have`, `then`, `from`, `with`, `hence`, `thus`.
4. Use backward reasoning: `show`, `using`.
5. Introduce assumptions and universal variables with `assume` and `fix`.
6. Construct existential witnesses with `obtain`.
7. Accumulate intermediate results with `moreover`/`ultimately`.
8. Write nested proof blocks and compose complex proofs.

---

## 1. The Isar Philosophy

### 1.1 Two Styles of Proof

Isabelle supports two proof styles:

**Apply-script style** (the old way):

```isabelle
lemma "P & Q --> Q & P"
  apply (rule impI)
  apply (erule conjE)
  apply (rule conjI)
  apply assumption
  apply assumption
  done
```

This is a sequence of tactic applications. Each `apply` transforms the proof state. The proof is *imperative* — it tells the machine what to do step by step — but it is opaque to human readers. You cannot understand the proof without replaying it in Isabelle.

**Isar style** (the modern way):

```isabelle
lemma "P & Q --> Q & P"
proof (rule impI)
  assume pq: "P & Q"
  from pq have "Q" by (rule conjunct2)
  from pq have "P" by (rule conjunct1)
  from `Q` `P` show "Q & P" by (rule conjI)
qed
```

This is a *structured* proof. It reads like a mathematical argument: "Assume $P \land Q$. From this, we have $Q$ (by the second projection). We also have $P$ (by the first projection). From $Q$ and $P$, we show $Q \land P$ (by conjunction introduction)."

### 1.2 Why Isar?

Isar (Intelligible Semi-Automated Reasoning) was introduced by Markus Wenzel in 1999. The design goals:

- **Readability.** Proofs should be comprehensible without running Isabelle.
- **Maintainability.** When definitions change, structured proofs give meaningful error messages pointing to the broken step. Apply scripts often break silently or give unhelpful errors.
- **Composability.** Proof fragments can be understood and reused independently.
- **Documentation.** An Isar proof serves as its own documentation of the mathematical argument.

---

## 2. Basic Proof Structure

### 2.1 Lemma and Theorem

A proof begins with a statement:

```isabelle
lemma name: "statement"
```

or

```isabelle
theorem name: "statement"
```

There is no logical difference between `lemma` and `theorem` — both are proved and stored the same way. The distinction is conventional: `theorem` is for main results, `lemma` for auxiliary results.

### 2.2 Terminal Proof Methods

The simplest proofs use a *terminal method* — a single tactic that solves the goal completely:

```isabelle
lemma "True"
  by (rule TrueI)

lemma "P --> P"
  by (rule impI)

lemma "P & Q --> P"
  by auto

lemma "P | Q --> Q | P"
  by blast
```

The keyword `by` takes a proof method, applies it, and closes the proof. If the method fails to solve all goals, the proof fails.

### 2.3 Proof/Qed Blocks

For non-trivial proofs, use the `proof ... qed` block:

```isabelle
lemma "A --> B --> A & B"
proof (rule impI)
  assume a: "A"
  show "B --> A & B"
  proof (rule impI)
    assume b: "B"
    from a b show "A & B" by (rule conjI)
  qed
qed
```

The `proof (method)` command applies the method to the current goal and enters a proof block where we must solve the remaining subgoals. The `qed` command closes the block.

If no initial method is needed, use `proof -` (the dash means "no method"):

```isabelle
lemma "P & Q --> Q & P"
proof -
  assume "P & Q"
  (* ... rest of proof ... *)
qed
```

---

## 3. Forward Reasoning

### 3.1 The `have` Command

`have` states and proves an intermediate fact:

```isabelle
have "intermediate_fact"
  by method
```

or with a proof block:

```isabelle
have "intermediate_fact"
proof
  ...
qed
```

The fact is then available for use in subsequent proof steps.

### 3.2 The `then` Keyword

`then` passes the previous fact to the next proof step as a *chained fact*:

```isabelle
have "P & Q" by fact_method
then have "P" by (rule conjunct1)
```

Here, `then have "P"` means: use the previously established fact (that `P & Q` holds) when proving `P`.

### 3.3 The `from` Command

`from` explicitly names which facts to chain:

```isabelle
from fact1 fact2 have "conclusion" by method
```

This passes `fact1` and `fact2` as chained facts. It is equivalent to:

```isabelle
note fact1 fact2
then have "conclusion" by method
```

### 3.4 The `with` Command

`with` is syntactic sugar: `with a` is equivalent to `from a and this`, where `this` is the most recently established fact.

```isabelle
have "Q" by some_method
with pq_fact have "P & Q" by (rule conjI)
```

### 3.5 Short Forms: `hence` and `thus`

- `hence` = `then have` (chain the previous fact into a new intermediate fact)
- `thus` = `then show` (chain the previous fact into the goal)

```isabelle
assume pq: "P & Q"
hence "Q" by (rule conjunct2)     (* then have "Q" ... *)
```

### 3.6 Naming Facts

Facts can be named when they are established:

```isabelle
have q: "Q" by some_method
have p: "P" by some_method
from q p show "Q & P" by (rule conjI)
```

Named facts persist throughout the proof block. The special name `this` always refers to the most recently established fact.

### 3.7 Backtick Notation

Previously established statements can be referenced by their content using backticks:

```isabelle
have "Q" by some_method
have "P" by some_method
from `Q` `P` show "Q & P" by (rule conjI)
```

This is convenient when names would be throwaway. Backtick references are matched by alpha-equivalence.

---

## 4. Backward Reasoning

### 4.1 The `show` Command

`show` declares the goal we are trying to prove (it must match a pending subgoal):

```isabelle
show "Q & P" by (rule conjI)
```

When `show` is used with a method that does not fully solve the goal, it creates subgoals that must be solved in subsequent steps.

### 4.2 The `using` Keyword

`using` adds facts to the proof context without chaining them:

```isabelle
show "Q & P" using q p by (rule conjI)
```

The difference between `from` and `using`: `from` chains facts (they are consumed by the next method), while `using` adds them to the context (they are available as assumptions).

---

## 5. Assumptions and Universal Variables

### 5.1 The `assume` Command

`assume` introduces a hypothesis:

```isabelle
assume "P"
```

or with a label:

```isabelle
assume hyp: "P & Q"
```

In a proof of $A \Longrightarrow B$, after `proof (rule impI)` or similar, we `assume` the antecedent $A$.

Multiple assumptions:

```isabelle
assume "P" and "Q"
```

### 5.2 The `fix` Command

`fix` introduces a universally quantified variable (an arbitrary but fixed element):

```isabelle
fix x :: "'a"
```

This is the Isar analogue of the eigenvariable condition. In a proof of $\forall x.\, P(x)$, we `fix x` and then `show "P(x)"`.

**Example:**

```isabelle
lemma "ALL x. P(x) --> P(x)"
proof (rule allI)
  fix x
  show "P(x) --> P(x)" by (rule impI)
qed
```

### 5.3 The `obtain` Command

`obtain` introduces an existential witness:

```isabelle
from `EX x. P(x)` obtain y where "P(y)" by (rule exE)
```

This says: since we know $\exists x.\, P(x)$, let $y$ be such a witness, so $P(y)$ holds. The variable $y$ is fresh. After `obtain`, $y$ is available as a fixed variable and `P(y)` is available as a fact.

**Example:**

```isabelle
lemma "EX x. P(x) ==> EX x. P(x) | Q(x)"
proof -
  assume "EX x. P(x)"
  then obtain y where py: "P(y)" by (rule exE)
  from py have "P(y) | Q(y)" by (rule disjI1)
  then show "EX x. P(x) | Q(x)" by (rule exI)
qed
```

---

## 6. The moreover/ultimately Pattern

### 6.1 Accumulating Facts

The `moreover`/`ultimately` pattern lets you accumulate several intermediate results and use them together:

```isabelle
have "A" by method_a
moreover have "B" by method_b
moreover have "C" by method_c
ultimately have "A & B & C" by blast
```

`moreover` saves the current fact without consuming it. `ultimately` collects all facts saved by `moreover` (plus the current `this`) and chains them into the next step.

This is cleaner than naming every intermediate result:

```isabelle
(* Without moreover/ultimately — more verbose *)
have a: "A" by method_a
have b: "B" by method_b
have c: "C" by method_c
from a b c have "A & B & C" by blast
```

### 6.2 Example: A Three-Part Proof

```isabelle
lemma assumes h: "P & Q & R"
  shows "R & Q & P"
proof -
  from h have "R" by blast
  moreover from h have "Q" by blast
  moreover from h have "P" by blast
  ultimately show "R & Q & P" by blast
qed
```

---

## 7. Proof Blocks and Nesting

### 7.1 Nested Proof Blocks

Proofs can be nested to handle subgoals:

```isabelle
lemma "(P --> Q) --> (Q --> R) --> (P --> R)"
proof (rule impI)
  assume pq: "P --> Q"
  show "(Q --> R) --> (P --> R)"
  proof (rule impI)
    assume qr: "Q --> R"
    show "P --> R"
    proof (rule impI)
      assume p: "P"
      from pq p have "Q" by (rule mp)
      with qr show "R" by (rule mp)
    qed
  qed
qed
```

Each `proof ... qed` block handles one subgoal. The nesting mirrors the structure of the statement.

### 7.2 Blocks with `{ ... }`

Curly-brace blocks introduce a local scope for assumptions:

```isabelle
{ assume "P"
  have "Q" by some_method
}
```

Facts established inside `{ ... }` are not visible outside, but the block as a whole yields the implication "P implies Q" (or whatever was shown inside).

### 7.3 Case Analysis

For disjunctions, Isar provides a structured case analysis:

```isabelle
lemma assumes h: "P | Q" shows "Q | P"
proof -
  from h show "Q | P"
  proof (rule disjE)
    assume "P"
    then show "Q | P" by (rule disjI2)
  next
    assume "Q"
    then show "Q | P" by (rule disjI1)
  qed
qed
```

The `next` keyword separates subgoals within a proof block.

---

## 8. Complete Examples

### 8.1 Propositional Logic

```isabelle
lemma contrapositive: "(P --> Q) --> (~Q --> ~P)"
proof (rule impI)
  assume pq: "P --> Q"
  show "~Q --> ~P"
  proof (rule impI)
    assume nq: "~Q"
    show "~P"
    proof (rule notI)
      assume p: "P"
      from pq p have "Q" by (rule mp)
      with nq show "False" by (rule notE)
    qed
  qed
qed
```

### 8.2 Simple Arithmetic (in HOL)

```isabelle
lemma "n + 0 = (n :: nat)"
  by simp

lemma "n + Suc m = Suc (n + m)"
  by simp

lemma add_comm: "(n :: nat) + m = m + n"
  by (induction n) auto
```

### 8.3 Set Theory (in FOL/ZF or HOL)

```isabelle
lemma "(A Int B) Un C = (A Un C) Int (B Un C)"
  by auto
```

---

## 9. Common Mistakes and Debugging

### 9.1 Type Mismatches

When a `show` statement does not match the current subgoal, Isabelle reports a type error. Common causes:

- Implicit `Trueprop` coercion not matching.
- Schematic variables instantiated differently than expected.
- Object-level vs meta-level confusion.

### 9.2 Undischarged Assumptions

If you `assume` something that is not a pending premise, the proof will fail at `qed`. Every `assume` must correspond to a premise in the current goal.

### 9.3 Method Failures

When a method fails silently (e.g., `auto` does not solve the goal), the proof state remains unchanged. Use `apply` style temporarily to inspect the proof state:

```isabelle
lemma "..."
  apply (rule ...)   (* inspect the resulting proof state *)
  sorry              (* placeholder — remove after debugging *)
```

### 9.4 The `sorry` Escape

`sorry` closes any goal without proof. It is only for development and debugging. Isabelle marks theories containing `sorry` as unfinished, and they cannot be used in the Archive of Formal Proofs.

---

## 10. Exercises

**Exercise 10.1.** Write an Isar proof of $\vdash (P \land Q) \to (Q \land P)$ in FOL, using only the rules `impI`, `conjunct1`, `conjunct2`, and `conjI`. Do not use `auto` or `blast`.

**Exercise 10.2.** Write an Isar proof of $\vdash P \to \neg\neg P$ in FOL.

**Exercise 10.3.** Write an Isar proof of $\forall x.\, (P(x) \to Q(x)) \Longrightarrow \forall x.\, P(x) \Longrightarrow \forall x.\, Q(x)$.

**Exercise 10.4.** Write an Isar proof of $\exists x.\, (P(x) \land Q(x)) \Longrightarrow (\exists x.\, P(x)) \land (\exists x.\, Q(x))$ using `obtain`.

**Exercise 10.5.** Rewrite the `contrapositive` proof from Section 8.1 using the `moreover`/`ultimately` pattern. Is it clearer or less clear? When is `moreover`/`ultimately` most useful?

**Exercise 10.6.** Write an Isar proof of $(P \lor Q) \to (P \to R) \to (Q \to R) \to R$ using case analysis (`disjE` or the `proof cases` command).

---

## References

- Wenzel, M. "Isar - A Generic Interpretive Approach to Readable Formal Proof Documents." *TPHOLs 1999*, Springer LNCS 1690.
- Wenzel, M. *The Isabelle/Isar Reference Manual*. Chapters 2-6.
- Nipkow, T. and Klein, G. *Concrete Semantics with Isabelle/HOL*. Springer, 2014. Chapter 2.
- Paulson, L.C. *Logic and Proof* (lecture notes). University of Cambridge.

---

*Previous: [Lecture 01a: The Pure Metalogic](lecture_01a_pure_metalogic.md)*
*Next: [Lecture 01c: Proof Methods & Automation](lecture_01c_proof_methods_automation.md)*
