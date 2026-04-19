---
title: "Homework 01: Lambda Calculus Interpreter"
tags:
  - type-theory
  - untyped
  - homework
---
# Homework 01: Lambda Calculus Interpreter

**Estimated time:** 20 hours
**Due date:** Two weeks from assignment
**Submission:** PDF of derivations + OCaml code (as a tarball or Git repository link)

---

## Overview

This homework has two parts of equal weight. Part A tests your mathematical understanding of the core concepts from Lectures 01a-01d: structural induction, evaluation derivations, substitution, and reduction. Part B requires you to implement a complete lambda calculus interpreter in OCaml with parsing, substitution, and multiple evaluation strategies.

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. Cite any references you consult. Do not use any existing lambda calculus implementation.

---

## Part A: Mathematical Derivations (50%)

### Problem A1: Determinacy of Arithmetic Evaluation (15 points)

**(a)** [10 points] Prove the following theorem by structural induction on the derivation of $t \to t'$:

**Theorem (Determinacy).** If $t \to t'$ and $t \to t''$ under the small-step evaluation rules for arithmetic expressions (Lecture 01a), then $t' = t''$.

You must handle all cases explicitly. For each case, identify the last rule used in the derivation of $t \to t'$, enumerate which rules could derive $t \to t''$, and show that either the same result is obtained or a contradiction arises.

**(b)** [5 points] The determinacy theorem fails if we add the following rule to the evaluation relation:

$$
\frac{t_2 \to t_2'}{\text{if } t_1 \text{ then } t_2 \text{ else } t_3 \to \text{if } t_1 \text{ then } t_2' \text{ else } t_3} \quad \text{(E-IfThen)}
$$

Give a specific term $t$ and two distinct terms $t', t''$ such that $t \to t'$ and $t \to t''$ with $t' \neq t''$. Draw the two derivation trees.

---

### Problem A2: Church-Rosser for a Simple System (15 points)

Consider the following abstract rewriting system on strings over $\{a, b\}$:

- Rule R1: $ab \to ba$
- Rule R2: $ba \to ab$

where these rules can be applied to any substring.

**(a)** [5 points] Is this system confluent? Prove or disprove. (Hint: consider the string $aba$.)

**(b)** [5 points] Now consider the system with only Rule R1 ($ab \to ba$). Is this system confluent? Is it terminating? Prove your answers.

**(c)** [5 points] State the Church-Rosser theorem for beta-reduction in the untyped lambda calculus. Explain precisely why confluence implies uniqueness of normal forms. Then explain why uniqueness of normal forms is essential for the lambda calculus to serve as a foundation for computation.

---

### Problem A3: Lambda Calculus Reductions (20 points)

**(a)** [5 points] Reduce the following term to normal form under full beta-reduction. Show every step and identify the redex reduced at each step.

$$
(\lambda x.\, \lambda y.\, y\; x)\; ((\lambda z.\, z)\; a)\; (\lambda w.\, w)
$$

**(b)** [5 points] Reduce the same term under call-by-value. Show every step. If the result differs from part (a), explain why.

**(c)** [5 points] Perform the following substitution step by step, showing all alpha-renaming needed to avoid variable capture:

$$
[x \mapsto (\lambda y.\, y\; z)]\, (\lambda z.\, \lambda y.\, x\; y\; z)
$$

**(d)** [5 points] Convert the following term to de Bruijn index representation. Then perform one step of beta-reduction in the de Bruijn representation. Finally, convert the result back to named form and verify it matches the expected result of named beta-reduction.

$$
(\lambda f.\, \lambda x.\, f\; (f\; x))\; (\lambda y.\, y)
$$

---

### Problem A4: Properties of Substitution (10 points)

**(a)** [5 points] Prove the following property of capture-avoiding substitution by structural induction on $t$:

$$
\text{FV}([x \mapsto s]\, t) = (\text{FV}(t) \setminus \{x\}) \cup (x \in \text{FV}(t)\ ?\ \text{FV}(s) : \emptyset)
$$

More precisely, show:

$$
\text{FV}([x \mapsto s]\, t) = \begin{cases} (\text{FV}(t) \setminus \{x\}) \cup \text{FV}(s) & \text{if } x \in \text{FV}(t) \\ \text{FV}(t) & \text{if } x \notin \text{FV}(t) \end{cases}
$$

Handle all three cases of the term structure (variable, abstraction, application). For the abstraction case, you may assume Barendregt's variable convention (bound variables are distinct from free variables and from each other).

**(b)** [5 points] Use part (a) to prove that beta-reduction preserves closedness: if $t$ is a closed term and $t \to_\beta t'$, then $t'$ is also closed. *(Hint: the key case is $(\lambda x.\, t_1)\; t_2 \to_\beta [x \mapsto t_2]\, t_1$ with $\text{FV}((\lambda x.\, t_1)\; t_2) = \emptyset$.)*

---

### Problem A5: De Bruijn Indices (10 points)

**(a)** [3 points] Convert the following terms to de Bruijn representation. Show your work.

- (i) $\lambda x.\, \lambda y.\, \lambda z.\, x\; z\; (y\; z)$
- (ii) $(\lambda x.\, x\; (\lambda y.\, y))\; (\lambda z.\, z\; z)$
- (iii) $\lambda f.\, (\lambda x.\, f\; (x\; x))\; (\lambda x.\, f\; (x\; x))$ (the Y combinator)

**(b)** [4 points] Perform beta-reduction on the following de Bruijn term. Show the shifting and substitution operations explicitly.

$$
(\lambda.\, \lambda.\, 1\; 0)\; (\lambda.\, 0)
$$

Recall the beta-reduction rule for de Bruijn terms:

$$
(\lambda.\, t)\; s \to \uparrow^{-1}_0([0 \mapsto \uparrow^1_0(s)]\, t)
$$

**(c)** [3 points] Give an example of two lambda terms that are alpha-equivalent but have different surface syntax (different variable names). Convert both to de Bruijn representation and verify that they produce identical nameless terms.

---

## Part B: Implementation (50%)

Implement a lambda calculus interpreter in OCaml. Your implementation must include the components described below. You may use the code from Recitation 01 as a starting point, but you must extend it significantly.

### B1: Core Data Types (5 points)

Define the AST for lambda terms using both named and de Bruijn representations:

```ocaml
type term =
  | Var of string
  | Abs of string * term
  | App of term * term

type db_term =
  | DBVar of int
  | DBAbs of db_term
  | DBApp of db_term * db_term
```

Implement:
- `free_vars : term -> StringSet.t`
- `to_debruijn : string list -> term -> db_term`
- `from_debruijn : string list -> db_term -> term`

### B2: Substitution (10 points)

Implement capture-avoiding substitution for both representations:

- `subst : string -> term -> term -> term` (named, capture-avoiding)
- `shift : int -> int -> db_term -> db_term` (de Bruijn shifting)
- `db_subst : int -> db_term -> db_term -> db_term` (de Bruijn substitution)

Your named substitution must correctly handle variable capture by alpha-renaming. Include at least 5 test cases that exercise the capture-avoidance logic, including:
- A case where no renaming is needed.
- A case where the bound variable appears free in the substituted term.
- A case with nested binders requiring multiple renamings.

### B3: Evaluation Strategies (15 points)

Implement three evaluation strategies as single-step relations:

- `eval_cbv : term -> term` (call-by-value)
- `eval_cbn : term -> term` (call-by-name)
- `eval_full : term -> term` (full beta-reduction, leftmost-outermost)

Each should raise `NoRuleApplies` when the term is in the corresponding normal form.

The CBV rules (from Lecture 01c):

| Rule | Condition |
|------|-----------|
| E-BetaV | $(\lambda x.\, t)\; v \to [x \mapsto v]\, t$ when $v$ is a value |
| E-App1 | $\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2}$ |
| E-App2V | $\frac{t_2 \to t_2'}{v\; t_2 \to v\; t_2'}$ when $v$ is a value |

The CBN rules:

| Rule | Condition |
|------|-----------|
| E-BetaN | $(\lambda x.\, t)\; s \to [x \mapsto s]\, t$ (no value restriction) |
| E-App1 | $\frac{t_1 \to t_1'}{t_1\; t_2 \to t_1'\; t_2}$ |

Full beta-reduction should reduce the leftmost-outermost redex at each step. This means:
1. If the term is itself a redex $(\lambda x.\, t)\; s$, reduce it.
2. Otherwise, try reducing the function part of an application.
3. Otherwise, try reducing the argument part of an application.
4. Otherwise, try reducing under a lambda abstraction.

Implement multi-step wrappers:

```ocaml
(* Iterate a single-step function until no more rules apply *)
val eval : (term -> term) -> term -> term

(* Iterate with a step limit; return (result, steps_taken, finished) *)
val eval_bounded : int -> (term -> term) -> term -> term * int * bool
```

The `eval_bounded` function should return a triple: the final term, the number of steps taken, and a boolean indicating whether a normal form was reached (`true`) or the step limit was hit (`false`).

### B4: Parser (10 points)

Implement a parser for lambda terms that accepts the following grammar:

```
term ::= VARIABLE
       | '\' VARIABLE '.' term
       | '(' term ')'
       | term term
```

where `VARIABLE` is a sequence of lowercase letters and digits starting with a letter, and application is left-associative. The backslash `\` represents lambda.

Example inputs and expected ASTs:

| Input | AST |
|-------|-----|
| `x` | `Var "x"` |
| `\x. x` | `Abs ("x", Var "x")` |
| `\x. \y. x y` | `Abs ("x", Abs ("y", App (Var "x", Var "y")))` |
| `(\x. x) (\y. y)` | `App (Abs ("x", Var "x"), Abs ("y", Var "y"))` |
| `f x y` | `App (App (Var "f", Var "x"), Var "y")` |

You may use any parsing approach (recursive descent, parser combinators, etc.). Do not use external parsing libraries (ocamlyacc/menhir are allowed but not required).

### B5: Testing and Demonstration (10 points)

Write a comprehensive test suite that demonstrates your interpreter. Organize your tests into the following categories. For each test, print the input term, the evaluation strategy used, and the result (or "diverges" / "step limit reached" for divergent terms).

**5a. Church booleans (2 points):**

Define `tru`, `fls`, `and`, `or`, `not` as lambda terms (either by parsing strings or constructing ASTs directly). Verify the complete truth tables by evaluation:

- `not tru` evaluates to `fls`
- `not fls` evaluates to `tru`
- `and tru tru` evaluates to `tru`
- `and tru fls` evaluates to `fls`
- `or fls tru` evaluates to `tru`
- etc.

You may check results by converting to de Bruijn form and comparing with the expected Church boolean.

**5b. Church numerals and arithmetic (3 points):**

Define $c_0$ through $c_5$, `scc`, `plus`, `times`. Verify:

- $\text{scc}\; c_0 =_\beta c_1$
- $\text{scc}\; c_2 =_\beta c_3$
- $\text{plus}\; c_2\; c_1 =_\beta c_3$
- $\text{plus}\; c_0\; c_3 =_\beta c_3$
- $\text{times}\; c_2\; c_3 =_\beta c_6$
- $\text{times}\; c_0\; c_5 =_\beta c_0$

For verification, you can apply the result to a known function (like string concatenation in the metalanguage, or a successor-like function) and check the iteration count.

**5c. Divergence handling (1 point):**

Show that your bounded evaluator correctly handles:
- $\Omega = (\lambda x.\, x\; x)\; (\lambda x.\, x\; x)$ -- should report step limit reached.
- The "omega-3" term $(\lambda x.\, x\; x\; x)\; (\lambda x.\, x\; x\; x)$ -- should also diverge.

**5d. CBV vs CBN comparison (2 points):**

Demonstrate at least two terms where the strategies differ:
- A term where CBN terminates but CBV diverges (e.g., $(\lambda x.\, \text{tru})\; \Omega$).
- A term where both strategies terminate but take a different number of steps. Report the step counts for each strategy.

**5e. Alpha-equivalence via de Bruijn (1 point):**

Verify that the following pairs are identified as alpha-equivalent:
- `\x. x` and `\y. y`
- `\x. \y. x y` and `\a. \b. a b`
- `\x. \x. x` and `\y. \z. z`

And that these pairs are *not* alpha-equivalent:
- `\x. x` and `\x. \y. x`
- `\x. \y. x` and `\x. \y. y`

**5f. Parser round-trip (1 point):**

Parse the following strings, pretty-print the result, and verify correctness:
- `\x. x`
- `\x. \y. x y`
- `(\x. x) (\y. y)`
- `f x y z`
- `(\f. \x. f (f x)) (\y. y)`

---

## Submission Checklist

- [ ] Part A: PDF with all derivations, clearly labeled A1(a), A1(b), A2(a), A2(b), A2(c), A3(a), A3(b), A3(c), A3(d).
- [ ] Part B: OCaml source files that compile with `ocamlfind ocamlopt` or `dune build`.
- [ ] A `README` explaining how to build and run your code.
- [ ] Test output demonstrating all required test cases from B5.

---

## Grading Rubric

### Part A (50 points)

| Component | Points | Criteria |
|-----------|--------|----------|
| A1(a): Determinacy proof | 10 | Completeness of case analysis (all 10 evaluation rules), correctness of contradiction arguments |
| A1(b): Counterexample | 5 | Correct term, correct derivation trees, clear explanation |
| A2(a): Confluence of R1+R2 | 5 | Correct answer with proof or counterexample |
| A2(b): Properties of R1 alone | 5 | Correct confluence and termination analysis |
| A2(c): Church-Rosser statement | 5 | Precise statement, clear uniqueness argument, motivation |
| A3(a): Full beta-reduction | 5 | Every step shown, redex identified |
| A3(b): CBV reduction | 5 | Correct CBV ordering, comparison with (a) |
| A3(c): Substitution with capture | 5 | All renamings shown, correct final result |
| A3(d): De Bruijn round-trip | 5 | Correct conversion, correct reduction, correct back-conversion |

### Part B (50 points)

| Component | Points | Criteria |
|-----------|--------|----------|
| B1: Data types and conversions | 5 | Correct AST definitions, `free_vars`, `to_debruijn`, `from_debruijn` |
| B2: Substitution | 10 | Named substitution handles capture; de Bruijn shifting/substitution correct; 5+ test cases |
| B3: Evaluation strategies | 15 | CBV, CBN, full reduction all correct; bounded evaluation terminates gracefully |
| B4: Parser | 10 | Handles variables, abstractions, applications, parentheses; left-associative application |
| B5: Testing | 10 | All categories (5a-5f) present with correct output; clear formatting |

**Total: 100 points**

### Deductions

- -5 points for code that does not compile.
- -3 points per test category (5a-5f) with incorrect results.
- -2 points for missing `README` or unclear build instructions.
- -1 point per derivation with missing case (in Part A proofs).
- No deductions for minor formatting issues in output.

---

## Hints

### General Advice

- Start with Part B1 and B2 before attempting Part A. Implementing substitution will deepen your understanding of the formal definitions.
- Test your substitution implementation on the examples from Lecture 01b before moving to more complex cases.
- Build incrementally: get named substitution working before de Bruijn, get CBV working before CBN and full reduction.

### Part A Hints

- **A1:** The key insight is that computation rules and congruence rules are mutually exclusive: if a computation rule applies, the relevant subterm is a value (hence in normal form), so the corresponding congruence rule (which requires the subterm to step) cannot apply. Organize your proof by the last rule used in the derivation of $t \to t'$.

- **A2(a):** Consider the string $aba$. Can you reduce it in two different ways? Do the results have a common reduct?

- **A2(b):** Think about what invariant R1 preserves. Consider the number of $a$'s and $b$'s, and the "sorted" position of each character.

- **A3(c):** Draw the AST of $\lambda z.\, \lambda y.\, x\; y\; z$ before substituting. Identify which bound variables conflict with free variables in $\lambda y.\, y\; z$. Rename them one at a time, from outermost to innermost.

- **A3(d):** For the de Bruijn conversion, remember that $f$ is bound by the outer lambda (index 1 inside the inner lambda's scope) and $x$ is bound by the inner lambda (index 0).

### Part B Hints

- **B2 (Substitution):** The trickiest case is when the bound variable of a lambda appears free in the term being substituted. You must alpha-rename the bound variable to a fresh name. Use a `fresh_var` function that takes a set of variables to avoid and returns a name not in that set.

- **B3 (Evaluation):** For full beta-reduction, the leftmost-outermost strategy tries to reduce at the current level first, then recurses into subterms from left to right. The order is: (1) check if the term is a top-level redex, (2) try the function part of an application, (3) try the argument part, (4) try under a lambda.

- **B4 (Parser):** Recursive descent is the simplest approach. Separate lexing (tokenization) from parsing. Define tokens: `LAMBDA`, `DOT`, `LPAREN`, `RPAREN`, `VAR of string`. Handle left-associativity of application by parsing a sequence of "atomic" terms and folding them left with `App`:

```ocaml
(* Parse a sequence of atoms and fold into left-associative applications *)
let rec parse_app tokens =
  let (t1, rest) = parse_atom tokens in
  parse_app_rest t1 rest
and parse_app_rest acc tokens =
  match tokens with
  | tok :: _ when is_atom_start tok ->
    let (t2, rest) = parse_atom tokens in
    parse_app_rest (App (acc, t2)) rest
  | _ -> (acc, tokens)
```

- **B5 (Testing):** To check if two Church-encoded results are "the same," convert both to de Bruijn form and compare structurally. Alternatively, define a function `church_to_int` that applies a Church numeral to a successor function and zero, then counts.

### Suggested File Structure

```
hw01/
  bin/
    main.ml          (* Entry point: runs test suite *)
  lib/
    syntax.ml        (* AST definitions, free_vars *)
    debruijn.ml      (* De Bruijn conversion, shifting, substitution *)
    subst.ml         (* Named capture-avoiding substitution *)
    eval.ml          (* Evaluation strategies *)
    parser.ml        (* Lexer and parser *)
    church.ml        (* Church encodings for testing *)
  test/
    test_subst.ml    (* Substitution tests *)
    test_eval.ml     (* Evaluation tests *)
    test_parser.ml   (* Parser tests *)
  dune-project
  README
```

You are free to organize your code differently, but ensure it compiles with a single command and has a clear entry point.
