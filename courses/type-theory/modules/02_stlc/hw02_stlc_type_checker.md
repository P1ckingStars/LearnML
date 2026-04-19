---
title: "HW2: STLC Type Checker"
tags:
  - type-theory
  - stlc
  - homework
---
# HW2: STLC Type Checker

> **Module 02 --- Simply Typed Lambda Calculus**
> Due: End of Week 4
> Total: 100 points

---

## Instructions

This assignment has two parts of equal weight:

- **Part A (50 points)**: Pen-and-paper proofs. Submit as a PDF (LaTeX preferred).
- **Part B (50 points)**: OCaml implementation. Submit your source files and a README explaining how to build and run.

You may discuss ideas with classmates, but all written work and code must be your own.

---

## Part A: Proofs (50 points)

### Problem 1: Type Derivation Trees (10 points)

Construct complete type derivation trees for each of the following terms, showing every application of a typing rule. Use the notation from Lecture 02a.

**(a)** (5 points)

$$\vdash \lambda f : \text{Nat} \to \text{Bool}.\, \lambda x : \text{Nat}.\, \text{if}\; (f\; x)\; \text{then}\; x\; \text{else}\; (\text{succ}\; x) : \;?$$

Determine the type and give the full derivation.

**(b)** (5 points)

$$\vdash \lambda p : (\text{Bool} \times \text{Nat}).\, \text{case}\; (\text{inl}\; (\text{fst}\; p)\; \text{as}\; \text{Bool} + \text{Nat})\; \text{of}\; \text{inl}\; b \Rightarrow b \mid \text{inr}\; n \Rightarrow \text{iszero}\; n : \;?$$

Determine the type and give the full derivation.

**Guidance.** Your derivation trees should be formatted as nested inference rules, with premises above the line and the conclusion below. Label each rule application (T-Var, T-Abs, T-App, T-Pair, T-Fst, T-Snd, T-Inl, T-Case, T-If, T-Succ, T-IsZero, etc.). Leaves of the tree should be axiom rules (T-Var, T-True, T-False, T-Zero, T-Unit).

For example, the derivation of $\vdash \lambda x : \text{Bool}.\, x : \text{Bool} \to \text{Bool}$ is:

$$\frac{\frac{x : \text{Bool} \in \{x : \text{Bool}\}}{x : \text{Bool} \vdash x : \text{Bool}} \text{(T-Var)}}{\vdash \lambda x : \text{Bool}.\, x : \text{Bool} \to \text{Bool}} \text{(T-Abs)}$$

---

### Problem 2: Ill-Typed Terms (5 points)

For each of the following terms, explain precisely which typing rule fails and why. Identify the exact point in the attempted derivation where no rule applies.

**(a)** $\lambda x : \text{Bool}.\, \text{succ}\; x$

**(b)** $\text{fst}\; (\lambda x : \text{Nat}.\, x)$

**(c)** $(\lambda f : \text{Bool} \to \text{Bool}.\, f\; \text{true})\; (\lambda x : \text{Nat}.\, x)$

**(d)** $\text{case}\; \text{true}\; \text{of}\; \text{inl}\; x \Rightarrow x \mid \text{inr}\; y \Rightarrow y$

**(e)** $\text{if}\; \text{true}\; \text{then}\; (\lambda x : \text{Nat}.\, x)\; \text{else}\; 0$

**Guidance.** For each ill-typed term, you should:
1. Begin building the type derivation tree from the leaves.
2. Identify the specific rule that you attempt to apply and the specific premise that fails.
3. State explicitly what type was expected and what type was found (or why no rule applies at all).

For example, if asked about $\text{succ}\; \text{true}$: "We attempt to apply T-Succ, which requires the argument to have type Nat. But $\vdash \text{true} : \text{Bool}$ by T-True. Since Bool $\neq$ Nat, the premise of T-Succ is not satisfied. The term is ill-typed."

---

### Problem 3: Progress and Preservation for STLC with Pairs (15 points)

Consider the simply typed lambda calculus extended with pair types ($T_1 \times T_2$), pair construction $(t_1, t_2)$, and projections $\text{fst}\; t$ and $\text{snd}\; t$, as defined in Lecture 02c.

**(a)** (3 points) State and prove the **Canonical Forms Lemma** for the product type: if $v$ is a value and $\vdash v : T_1 \times T_2$, then $v = (v_1, v_2)$ for some values $v_1, v_2$.

**(b)** (6 points) Prove the **Progress** theorem for the cases involving products (T-Pair, T-Fst, T-Snd). You may assume progress holds for all other term forms. Write out the case analysis explicitly, citing specific evaluation rules.

**(c)** (6 points) Prove the **Preservation** theorem for the cases involving products (T-Pair with E-Pair1/E-Pair2, T-Fst with E-Fst/E-FstPair, T-Snd with E-Snd/E-SndPair). For the computation rules (E-FstPair, E-SndPair), show explicitly how inversion is used. You may assume the Substitution Lemma holds for the extended system.

**Guidance.** The preservation proof proceeds by induction on the typing derivation. For each case, you know:
- The typing rule used (the "last rule" in the derivation).
- The evaluation rule used (how $t \to t'$).

Your proof should have the structure: "Suppose the last rule was T-Fst, so $t = \text{fst}\; t_1$ with $\Gamma \vdash t_1 : T_1 \times T_2$. We case-split on which evaluation rule was used..."

For the computation rules (E-FstPair, E-SndPair), you must use **inversion** (the generation lemma): from $\Gamma \vdash (v_1, v_2) : T_1 \times T_2$, conclude that $\Gamma \vdash v_1 : T_1$ and $\Gamma \vdash v_2 : T_2$. State explicitly which inversion principle you use.

---

### Problem 4: The Substitution Lemma (10 points)

Consider STLC with booleans, arrow types, and pairs (no sums, no naturals, to keep the proof concise).

**Statement**: If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\, t : T$.

**(a)** (8 points) Prove the Substitution Lemma by induction on the derivation of $\Gamma, x : S \vdash t : T$. You must handle the following cases explicitly:

- T-Var (both subcases: $y = x$ and $y \neq x$)
- T-Abs (including the argument for why capture-avoidance is needed)
- T-App
- T-Pair
- T-Fst

For T-True, T-False, T-If, and T-Snd, you may write "analogous to ..." with a brief justification.

**(b)** (2 points) Explain why the T-Abs case of the Substitution Lemma requires the **Weakening Lemma**. State the Weakening Lemma precisely and explain where it is used.

**Guidance for part (a).**

The proof of the Substitution Lemma is by induction on the derivation of $\Gamma, x : S \vdash t : T$. This means you case-split on the last typing rule used.

For **T-Var** ($t = y$): Consider whether $y = x$ or $y \neq x$. In the first case, $[x \mapsto s]\, x = s$ and you use the fact that $\Gamma \vdash s : S$. In the second case, $[x \mapsto s]\, y = y$ and you use the fact that $y : T \in \Gamma$.

For **T-Abs** ($t = \lambda y : T_1.\, t_1$): You need to substitute under the binder. The key subtlety is ensuring $y \neq x$ and $y \notin \text{FV}(s)$, which can be arranged by alpha-renaming. This is where the Weakening Lemma is needed: to bring $\Gamma \vdash s : S$ into the extended context $\Gamma, y : T_1 \vdash s : S$.

For **T-App**, **T-Pair**, and **T-Fst**: These cases are straightforward applications of the induction hypothesis to subterms.

---

### Problem 5: Curry-Howard (10 points)

**(a)** (4 points) For each of the following propositions, either give a proof term (a well-typed STLC term inhabiting the corresponding type) or explain why no such term exists:

1. $A \implies B \implies A$
2. $(A \implies B \implies C) \implies (A \times B) \implies C$
3. $(A + B) \implies (A \implies C) \implies (B \implies C) \implies C$
4. $((A \implies B) \implies A) \implies A$

**(b)** (3 points) Prove that the types $A \times (B + C)$ and $(A \times B) + (A \times C)$ are isomorphic by giving terms $f$ and $g$ of the appropriate types and arguing (informally) that $g \circ f$ and $f \circ g$ are extensionally equal to the identity.

**(c)** (3 points) Under the Curry-Howard correspondence, what does the strong normalization theorem for STLC correspond to in logic? State the logical theorem precisely and explain in two to three sentences why it matters for the consistency of the logic.

**Guidance for part (a).** Recall:

- Under Curry-Howard, $A \implies B$ corresponds to the function type $A \to B$.
- A proof of a proposition corresponds to a well-typed term (inhabitant) of the corresponding type.
- STLC corresponds to intuitionistic propositional logic; in particular, the law of excluded middle ($A \lor \lnot A$) and Peirce's law are not provable.
- For item 4, note that $((A \implies B) \implies A) \implies A$ is Peirce's law. Consider whether it is intuitionistically provable.

**Guidance for part (b).** You need to define:

$$f : A \times (B + C) \to (A \times B) + (A \times C)$$

$$g : (A \times B) + (A \times C) \to A \times (B + C)$$

Use $\text{fst}$, $\text{snd}$, $\text{inl}$, $\text{inr}$, and $\text{case}$. Then argue informally (one or two sentences per direction) that $g(f(x)) = x$ and $f(g(y)) = y$ for all $x$ and $y$ of the appropriate types.

---

## Part B: Implementation (50 points)

Implement a complete type checker and interpreter for the simply typed lambda calculus in OCaml. Your implementation must support all of the following features:

### Required Features

| Feature | Types | Terms |
|---------|-------|-------|
| Booleans | `Bool` | `true`, `false`, `if t then t else t` |
| Natural numbers | `Nat` | `0`, `succ t`, `pred t`, `iszero t` |
| Functions | `T1 -> T2` | `lambda x : T . t`, `t1 t2` |
| Pairs | `T1 * T2` | `(t1, t2)`, `fst t`, `snd t` |
| Sums | `T1 + T2` | `inl t as T`, `inr t as T`, `case t of inl x => t1 \| inr y => t2` |
| Unit | `Unit` | `unit` |

### Required Components

**(1) AST definitions (5 points)**

Define OCaml algebraic data types for types (`typ`) and terms (`term`), as in Recitation 02. Your types should include at minimum:

```ocaml
type typ =
  | TBool
  | TNat
  | TArrow of typ * typ    (* T1 -> T2 *)
  | TProd of typ * typ      (* T1 * T2 *)
  | TSum of typ * typ       (* T1 + T2 *)
  | TUnit
```

Your terms should cover all constructs in the feature table above. Pay attention to which terms bind variables (lambda, case) and how you represent variable names (strings are fine).

**(2) Type checker (15 points)**

Implement a function:

```ocaml
val typecheck : context -> term -> typ
```

that implements all the typing rules. It should raise a descriptive error (using a custom exception or `Result` type) when a term is ill-typed. The error message must identify:
- What kind of error occurred (type mismatch, unbound variable, expected function type, etc.)
- What type was expected and what type was found.

**(3) Evaluator (15 points)**

Implement call-by-value small-step evaluation:

```ocaml
val eval1 : term -> term       (* single step, raises No_rule_applies *)
val eval : term -> term         (* multi-step, to normal form *)
```

You must implement capture-avoiding substitution. You may use either named variables with alpha-renaming or de Bruijn indices. Your evaluator must handle the following correctly:

- **Functions**: E-App1, E-App2, E-AppAbs (beta reduction with substitution).
- **Booleans**: E-If, E-IfTrue, E-IfFalse.
- **Natural numbers**: E-Succ, E-Pred, E-PredZero, E-PredSucc, E-IsZero, E-IsZeroZero, E-IsZeroSucc.
- **Pairs**: E-Pair1, E-Pair2, E-Fst, E-FstPair, E-Snd, E-SndPair.
- **Sums**: E-Inl, E-Inr, E-Case, E-CaseInl, E-CaseInr.

The `eval` function should repeatedly apply `eval1` until no rule applies (the term is a value or is stuck). Well-typed closed terms should always evaluate to a value (by the progress theorem).

**Important**: Your substitution function must be capture-avoiding. If using named variables, implement alpha-renaming (generate fresh variable names). If using de Bruijn indices, implement index shifting. See Recitation 02 for guidance.

A helper function for collecting free variables may be useful:

```ocaml
val free_vars : term -> string list
```

**(4) Test suite (10 points)**

Write a comprehensive test suite covering at least:
- 5 well-typed terms that evaluate to a value (covering all features).
- 5 ill-typed terms with distinct error types.
- 3 terms that test interaction between features (e.g., a function that takes a pair and returns a sum).
- 2 terms that test variable capture avoidance in substitution.

For each test, assert both the expected type (or expected error) and the expected evaluation result.

**Suggested well-typed terms:**

1. A boolean identity function applied to true: $(\lambda x : \text{Bool}.\, x)\; \text{true}$. Expected type: Bool. Expected result: true.
2. A term using natural numbers: $\text{pred}\; (\text{succ}\; (\text{succ}\; 0))$. Expected type: Nat. Expected result: $\text{succ}\; 0$.
3. A pair construction and projection: $\text{fst}\; (\text{true},\; 0)$. Expected type: Bool. Expected result: true.
4. A sum injection and case: $\text{case}\; (\text{inl}\; 0\; \text{as}\; \text{Nat} + \text{Bool})\; \text{of}\; \text{inl}\; n \Rightarrow \text{succ}\; n \mid \text{inr}\; b \Rightarrow 0$. Expected type: Nat. Expected result: $\text{succ}\; 0$.
5. A unit term: $(\lambda x : \text{Unit}.\, \text{true})\; \text{unit}$. Expected type: Bool. Expected result: true.

**Suggested ill-typed terms:**

1. Type mismatch in arithmetic: $\text{succ}\; \text{true}$ (Nat expected, Bool found).
2. Unbound variable: $x$ (variable $x$ not in context).
3. Non-function application: $\text{true}\; \text{false}$ (expected arrow type, found Bool).
4. If-branch mismatch: $\text{if}\; \text{true}\; \text{then}\; 0\; \text{else}\; \text{false}$ (branches have different types).
5. Projection of non-pair: $\text{fst}\; \text{true}$ (expected product type, found Bool).

**Suggested capture-avoidance tests:**

1. $(\lambda x : \text{Nat}.\, \lambda y : \text{Nat}.\, x)\; y$ where $y$ is a free variable. After substitution, the inner $\lambda y$ should not capture the free $y$.
2. $(\lambda f : \text{Nat} \to \text{Nat}.\, \lambda x : \text{Nat}.\, f\; x)\; (\lambda x : \text{Nat}.\, \text{succ}\; x)$. After beta reduction, the inner $x$ should not be confused with the outer $x$.

**(5) Main driver (5 points)**

Write a `main` function that:
1. Defines a term (hard-coded or read from command line).
2. Type-checks it and prints the type (or prints the error).
3. If well-typed, evaluates it and prints the result.

You will need a pretty-printer for types and terms:

```ocaml
val string_of_typ : typ -> string
val string_of_term : term -> string
```

Example output:

```
Term: (lambda x : Nat . succ x) 0
Type: Nat
Result: succ 0
```

```
Term: succ true
Error: Expected Nat but found Bool in succ
```

### Grading Criteria

| Criterion | Points |
|-----------|--------|
| Correct AST definitions | 5 |
| Type checker handles all rules correctly | 15 |
| Evaluator implements all evaluation rules | 15 |
| Test suite is comprehensive and all tests pass | 10 |
| Main driver works end-to-end | 5 |
| **Total** | **50** |

**Deductions**: Code that does not compile receives at most 10/50. Code with incorrect substitution (variable capture bugs) loses up to 10 points. Partial credit is given for each component that works correctly.

**Code style**: Your code should be clean, well-organized, and well-commented. Use meaningful variable names. Each function should have a brief comment describing its purpose and the typing/evaluation rule(s) it implements.

### Submission Format

Submit the following files:
- `typ.ml` -- Type definitions
- `term.ml` -- Term definitions
- `context.ml` -- Typing context
- `typecheck.ml` -- Type checker
- `eval.ml` -- Evaluator (including substitution)
- `test.ml` -- Test suite
- `main.ml` -- Main driver
- `Makefile` or `dune-project` -- Build instructions
- `README.md` -- Brief description and build/run instructions

Alternatively, you may submit a single file `stlc.ml` containing all components.

---

## Bonus (10 points, optional)

**(Bonus 1, 5 points)** Add **let-bindings** (`let x = t1 in t2`) to your type checker and evaluator, with at least 3 test cases.

**(Bonus 2, 5 points)** Implement a **pretty-printer** for type derivation trees. Given a well-typed term, output the full typing derivation in a human-readable tree format. For example:

```
                x : Bool in {x : Bool}
                ----------------------- (T-Var)
                x : Bool |- x : Bool
  ------------------------------------------ (T-Abs)
  |- (lambda x : Bool . x) : Bool -> Bool
```

The derivation tree printer should:
1. Take a well-typed term and a context as input.
2. Recursively build the derivation tree, labeling each node with the rule used.
3. Format the output with appropriate indentation so that premises appear above conclusions.
4. Handle all typing rules in the system.

**Hint**: Define a tree data type for derivations:

```ocaml
type derivation = {
  context : context;
  term : term;
  typ : typ;
  rule : string;
  premises : derivation list;
}
```

Then write a rendering function that converts a derivation tree to a string with proper alignment.

---

## Academic Integrity

You may consult the course materials (lectures, recitations, TAPL) and OCaml documentation. You may discuss high-level ideas with classmates, but all written proofs and code must be your own work. Do not copy solutions from the internet, previous offerings of this course, or AI assistants. If you use any external resources beyond the course materials, cite them.

---

## Tips

- **Start early.** The substitution lemma proof (Problem 4) and the evaluator implementation both require careful attention to variable binding.
- **Test incrementally.** Implement and test one feature at a time (booleans first, then naturals, then functions, then pairs, then sums, then unit).
- **Use the recitation code.** Recitation 02 provides a working skeleton. Extend it rather than starting from scratch.
- **Read TAPL.** Pierce, Chapters 8-11, covers all the material you need. The proofs in the textbook are models for the style expected in Part A.
- **Check your proofs.** For each case in a proof by induction, verify that you have used the induction hypothesis correctly and that all side conditions are met.
