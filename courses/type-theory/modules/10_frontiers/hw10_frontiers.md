---
title: "Homework 10: Frontiers"
tags:
  - type-theory
  - frontiers
  - homework
  - module-index
---
# Homework 10: Frontiers

> **Module 10 --- Frontiers (Weeks 19--20)**
> Due: End of Week 20

---

## Instructions

This homework has two parts of equal weight. Part A consists of formal, pen-and-paper exercises covering identity types, univalence, and gradual typing. Part B consists of implementation and formalization tasks, to be completed in a proof assistant of your choice (Coq, Lean, or Agda) and/or a general-purpose programming language. Submit your proof assistant code as compilable source files and your pen-and-paper proofs as a PDF.

---

## Part A: Theory (50%)

Answer each problem on paper (or in LaTeX). All proofs should be complete and rigorous, with explicit use of the J eliminator or cubical primitives as appropriate. When a proof uses path induction, state the motive $C$ and the base case $c$ explicitly.

### Problem A.1: Path Induction and Identity Types (15 points)

**(a)** (5 points) Using the J eliminator (path induction), prove that identity is a *congruence with respect to dependent pairs*: given $p : a =_A a'$, $b : B(a)$, and $q : \text{transport}^B(p, b) =_{B(a')} b'$, construct a term of type $(a, b) =_{\Sigma(x:A) B(x)} (a', b')$.

Write out the J application explicitly, specifying the motive $C$, the base case $c$, and verifying the computation rule.

**(b)** (5 points) Prove that transport respects composition: for any type family $P : A \to \mathcal{U}$, paths $p : a =_A b$ and $q : b =_A c$, and element $u : P(a)$:

$$\text{transport}^P(p \cdot q, u) =_{P(c)} \text{transport}^P(q, \text{transport}^P(p, u))$$

Use path induction. State clearly on which path(s) you induct.

**(c)** (5 points) Prove that for any equivalence $e : A \simeq B$, the map $\text{ap}_{\text{pr}_1}$ on the path $\text{ua}(e) : A =_\mathcal{U} B$ recovers $e$ in the following sense: for any $a : A$,

$$\text{transport}^{\text{id}_\mathcal{U}}(\text{ua}(e), a) =_B e(a)$$

You may use the computation rule for $\text{ua}$: $\text{transport}^{\text{id}_\mathcal{U}}(\text{ua}(e), a) \equiv e(a)$ (in cubical type theory) or $= e(a)$ (in axiomatic HoTT). In either case, explain which definitional or propositional equalities are involved and how the computation rule is used.

### Problem A.2: Univalence Implies Function Extensionality (15 points)

**(a)** (5 points) Let $A$ be a type and define the type $\text{Singl}(A) :\equiv \sum_{(x:A)} \sum_{(a:A)} (a =_A x)$. Prove that $\text{Singl}(A)$ is contractible. (Hint: the center of contraction is $(a, a, \text{refl}_a)$ for any fixed $a$; use path induction to show every element is equal to the center.)

**(b)** (5 points) Using the contractibility of the singleton type (or otherwise), prove that for any type family $P : A \to \mathcal{U}$ and $a : A$, the type $\sum_{(x:A)} (a =_A x) \times P(x)$ is equivalent to $P(a)$. (This is a form of the "transport is an equivalence" principle.)

**(c)** (5 points) Outline how univalence implies function extensionality by proving the following intermediate result: assuming univalence, show that for any $f, g : A \to B$ and $h : \prod_{(x:A)} f(x) =_B g(x)$, the total spaces $\sum_{(x:A)} \sum_{(y:B)} f(x) =_B y$ and $\sum_{(x:A)} \sum_{(y:B)} g(x) =_B y$ are equivalent, and that this equivalence, combined with the contractibility of singleton types (from part (a)), yields a path $f =_{A \to B} g$.

You may cite results from Lectures 10a and 10b without re-proving them, but you must clearly state which results you use and how they fit together.

### Problem A.3: Gradual Typing (20 points)

For all problems in this section, refer to the GTLC and cast calculus as defined in Lecture 10c. Recall that types are $\tau ::= \text{Int} \mid \text{Bool} \mid \tau_1 \to \tau_2 \mid \star$, and the consistency relation $\sim$ is defined by the rules C-Refl, C-UnkL, C-UnkR, and C-Fun.

**(a)** (5 points) Extend the GTLC with product types $\tau_1 \times \tau_2$. Define the consistency relation for the extended language (adding appropriate rules for products). State all rules formally and prove that the extended relation is reflexive and symmetric but not transitive. Also define the matching relation and typing rule for projections $\pi_1(e)$ and $\pi_2(e)$ in the extended GTLC.

**(b)** (5 points) Consider the following gradually typed term:

$$e \equiv (\lambda f{:}\star \to \text{Int}.\, f\;42 + f\;\text{true})\;(\lambda x{:}\star.\, 0)$$

Elaborate $e$ into the cast calculus, showing all inserted casts with explicit blame labels. Then trace the evaluation of the elaborated term step by step, showing each reduction and the final value.

**(c)** (5 points) Now consider the same term but with a different argument:

$$e' \equiv (\lambda f{:}\star \to \text{Int}.\, f\;42 + f\;\text{true})\;(\lambda x{:}\text{Int}.\, x)$$

Elaborate $e'$ into the cast calculus. Trace the evaluation and identify the point where blame is raised. Which blame label is responsible, and which boundary in the source program does it correspond to?

**(d)** (5 points) Prove the following **blame theorem** for the simply typed cast calculus (without subtyping): if $\langle G_1 \Leftarrow \star \rangle^l\;(\langle \star \Leftarrow G_2 \rangle^{l'}\;v) \longrightarrow^* r$, then either $r = v$ (when $G_1 = G_2$) or $r = \text{blame}\;l$ (when $G_1 \neq G_2$). Your proof should proceed by case analysis on whether $G_1 = G_2$ and should cite the relevant cast reduction rules from Lecture 10c (projection-success and projection-failure).

*Hint:* The proof is short (a few lines), but you must be precise about which reduction rules apply and why the blame label is $l$ (not $l'$) in the failure case.

---

## Part B: Implementation and Formalization (50%)

### Problem B.1: Formalization in a Proof Assistant (25 points)

Choose **one** of the following proof assistants: Coq, Lean 4, or Agda. Complete **one** of the following formalization tasks. Consult Recitation 10 for setup instructions, basic syntax, and examples in each system.

**Option 1: Sorted Lists and Insertion Sort.**

Formalize the following in your chosen proof assistant:

(a) Define a type `Sorted : List Nat -> Prop` (or `Set`/`Type` as appropriate) that asserts a list of natural numbers is sorted in non-decreasing order.

(b) Implement an `insert` function that inserts a natural number into a sorted list, preserving sortedness.

(c) Implement `insertionSort : List Nat -> List Nat` using `insert`.

(d) Prove that `insertionSort` produces sorted output: `forall xs, Sorted (insertionSort xs)`.

(e) Prove that `insertionSort` preserves the elements: `forall xs, Permutation xs (insertionSort xs)`. (You may use a library definition of `Permutation` or define your own as multiset equality.)

**Option 2: Simply Typed Lambda Calculus.**

Formalize the following:

(a) Define the syntax of types and terms for the simply typed lambda calculus (STLC) with booleans and a conditional.

(b) Define the typing relation $\Gamma \vdash t : \tau$ as an inductive type.

(c) Define the small-step operational semantics as an inductive relation.

(d) Prove **progress**: if $\vdash t : \tau$ (closed, well-typed term), then either $t$ is a value or $t \longrightarrow t'$ for some $t'$.

(e) Prove **preservation**: if $\Gamma \vdash t : \tau$ and $t \longrightarrow t'$, then $\Gamma \vdash t' : \tau$.

**Grading criteria for B.1:**

- **Correctness (15 points):** All definitions type-check and all theorems are proved (no `sorry`/`admit`/`postulate`).
- **Proof quality (5 points):** Proofs are reasonably concise and readable. Use appropriate lemmas and automation where available. Avoid excessively long proof scripts when shorter alternatives exist.
- **Code organization (5 points):** Clear module structure, meaningful names, helpful comments explaining the proof strategy for non-obvious steps.

**Submission requirements:**

- Submit a compilable source file (`.v`, `.lean`, or `.agda`) with no `sorry`, `admit`, or `postulate` (unless explicitly allowed for a specific lemma).
- Include comments explaining your proof strategy for the main theorems.
- State any library dependencies at the top of the file.

**Hints for Option 1 (Sorted Lists):**
- In Coq, consider using `Permutation` from `List` and `le_dec` from `Arith`.
- In Lean, the `omega` tactic handles natural number arithmetic.
- In Agda, you will need to define decidable ordering and construct the sortedness proof by pattern matching.

**Hints for Option 2 (STLC):**
- For progress, you will need a canonical forms lemma: if $\vdash v : \tau_1 \to \tau_2$ and $v$ is a value, then $v = \lambda x{:}\tau_1.\, e$ for some $e$.
- For preservation, the main challenge is the substitution lemma: if $\Gamma, x : \tau' \vdash e : \tau$ and $\vdash v : \tau'$, then $\Gamma \vdash e[x := v] : \tau$.
- In Coq, the `Software Foundations` approach (using de Bruijn indices or named variables with freshness) works well.
- In Lean, consider using `Finmap` or a list-based context representation.
- In Agda, intrinsically typed syntax (where the term type is indexed by its typing context and type) eliminates the need for a separate typing relation and makes progress/preservation trivial.

### Problem B.2: Gradual Type Checker with Blame (25 points)

Implement a type checker and interpreter for a simple gradually typed language. You may use any general-purpose programming language (OCaml, Haskell, Python, Rust, etc.).

**Language specification.**

Types:

$$\tau ::= \text{Int} \mid \text{Bool} \mid \tau_1 \to \tau_2 \mid \star$$

Terms:

$$e ::= n \mid b \mid x \mid \lambda x{:}\tau.\, e \mid e_1\;e_2 \mid e_1 + e_2 \mid \text{if}\;e_1\;\text{then}\;e_2\;\text{else}\;e_3$$

**Requirements:**

**(a)** (5 points) Implement the consistency relation on types. Write a function `consistent : Type -> Type -> Bool` that returns true if and only if the two types are consistent.

**(b)** (8 points) Implement a type checker for the GTLC that:
- Checks that each term is well-typed according to the rules of the GTLC (using consistency, not equality, for type matching).
- Returns the type of the term, or an error message if the term is ill-typed.
- Elaborates the term into a cast calculus (an internal AST with explicit cast nodes), inserting casts wherever the GTLC rules require them. Each cast should carry a unique blame label (a string or integer identifying its source location).

**(c)** (8 points) Implement an interpreter for the cast calculus that:
- Evaluates cast calculus terms using the reduction rules from Lecture 10c.
- Handles function casts (wrapping functions in proxies).
- Returns either a value or a blame error (with the blame label).

**(d)** (4 points) Provide the following test cases and show their outputs:

1. A program that evaluates successfully with dynamic types:

   $$(\lambda x{:}\star.\, x + 1)\;42$$

2. A program that raises blame at runtime:

   $$(\lambda x{:}\star.\, x + 1)\;\text{true}$$

3. A program with a higher-order cast that succeeds:

   $$(\lambda f{:}\star.\, f\;1)\;(\lambda x{:}\text{Int}.\, x + x)$$

4. A program with a higher-order cast that fails:

   $$(\lambda f{:}\text{Int} \to \text{Int}.\, f\;0)\;(\lambda x{:}\star.\, \text{true})$$

For each test case, show: the input term, the elaborated cast calculus term, and the evaluation result (value or blame with label).

**Additional test case (bonus, 2 points):** Design your own test case that demonstrates a subtle aspect of gradual typing (e.g., a program where blame is assigned to an unexpected label, or a program that reveals the difference between transient and behavioral semantics). Explain what the test case demonstrates.

**Grading criteria for B.2:**

- **Consistency checker (5 points):** Correct implementation of the consistency relation, including all cases (base types, function types, dynamic type). Include unit tests.
- **Type checker and elaboration (8 points):** Correctly type-checks well-typed GTLC terms and rejects ill-typed ones. Correctly inserts casts with unique blame labels. Handles function application with type matching and consistency checking.
- **Interpreter (8 points):** Correctly evaluates cast calculus terms. Handles all cast reduction rules (identity cast, injection, projection success/failure, function cast with contravariant argument casting). Correctly reports blame with the responsible label.
- **Test cases (4 points):** All four required test cases run correctly and produce the expected output.

**Implementation hints:**

- Start by defining the AST for types, GTLC terms, and cast calculus terms as algebraic data types.
- For the type checker, use a recursive function that pattern-matches on the term structure and returns either a typed cast-calculus term or an error.
- For the interpreter, use a small-step or big-step evaluator. Small-step is closer to the formal semantics but requires more bookkeeping; big-step is more natural for implementation.
- Function casts should be implemented as closures that wrap the original function with argument/result casts.
- Use a global counter for blame label generation to ensure uniqueness.
- Consider using a pretty-printer for terms to make the test case output readable.

**Submission requirements:**

- Submit well-documented source code.
- Include a `README` or header comment explaining how to build and run the code.
- Include the test case outputs (either as part of the code output or in a separate file).

---

## Grading Rubric

| Component | Points |
|-----------|--------|
| A.1(a): Congruence for dependent pairs via J | 5 |
| A.1(b): Transport respects composition | 5 |
| A.1(c): Computation rule for ua | 5 |
| A.2(a): Contractibility of singleton type | 5 |
| A.2(b): Singleton type equivalence | 5 |
| A.2(c): Univalence implies funext outline | 5 |
| A.3(a): Consistency relation with products | 5 |
| A.3(b): Elaboration and evaluation (succeeds) | 5 |
| A.3(c): Elaboration and evaluation (blame) | 5 |
| A.3(d): Blame theorem | 5 |
| B.1: Proof assistant formalization | 25 |
| B.2: Gradual type checker implementation | 25 |
| **Total** | **100** |

---

---

## Appendix: Reference Material

### Identity Type Rules (MLTT)

**Formation:** $\dfrac{\Gamma \vdash A : \mathcal{U} \quad \Gamma \vdash a : A \quad \Gamma \vdash b : A}{\Gamma \vdash \text{Id}_A(a,b) : \mathcal{U}}$

**Introduction:** $\dfrac{\Gamma \vdash a : A}{\Gamma \vdash \text{refl}_a : \text{Id}_A(a,a)}$

**Elimination (J):** $\dfrac{\Gamma, x:A, y:A, p:\text{Id}_A(x,y) \vdash C : \mathcal{U} \quad \Gamma, z:A \vdash c : C[x,y,p := z,z,\text{refl}_z]}{\Gamma, x:A, y:A, p:\text{Id}_A(x,y) \vdash J(C,c,x,y,p) : C}$

**Computation:** $J(C, c, a, a, \text{refl}_a) \equiv c[z := a]$

### GTLC Typing Rules (Summary)

**Consistency:** $\star \sim \tau$ and $\tau \sim \star$ for all $\tau$; $\tau \sim \tau$; $(\tau_1 \to \tau_2) \sim (\tau_3 \to \tau_4)$ if $\tau_1 \sim \tau_3$ and $\tau_2 \sim \tau_4$.

**Application:** $\dfrac{\Gamma \vdash e_1 : \tau_1 \quad \tau_1 \triangleright \tau_{11} \to \tau_{12} \quad \Gamma \vdash e_2 : \tau_2 \quad \tau_2 \sim \tau_{11}}{\Gamma \vdash e_1\;e_2 : \tau_{12}}$

**Cast:** $\dfrac{\Gamma \vdash e : \tau_1 \quad \tau_1 \sim \tau_2}{\Gamma \vdash \langle \tau_2 \Leftarrow \tau_1 \rangle^l\;e : \tau_2}$

### Cast Reduction Rules (Summary)

- Identity: $\langle \tau \Leftarrow \tau \rangle^l\;v \longrightarrow v$
- Projection (success): $\langle G \Leftarrow \star \rangle^l\;(\langle \star \Leftarrow G \rangle^{l'}\;v) \longrightarrow v$
- Projection (failure): $\langle G_1 \Leftarrow \star \rangle^l\;(\langle \star \Leftarrow G_2 \rangle^{l'}\;v) \longrightarrow \text{blame}\;l$ when $G_1 \neq G_2$
- Function: $(\langle \tau_3 \to \tau_4 \Leftarrow \tau_1 \to \tau_2 \rangle^l\;v)\;w \longrightarrow \langle \tau_4 \Leftarrow \tau_2 \rangle^l\;(v\;(\langle \tau_1 \Leftarrow \tau_3 \rangle^{\overline{l}}\;w))$
- Ground injection: Values of ground type $G$ are injected into $\star$ as tagged values.
- Non-ground to $\star$: $\langle \star \Leftarrow \tau \rangle^l\;v \longrightarrow \langle \star \Leftarrow G \rangle^l\;(\langle G \Leftarrow \tau \rangle^l\;v)$ where $G = \text{ground}(\tau)$

### Tips for Proof Assistant Problems

**General tips:**
- Start with the simplest definitions and work up. Define types, then functions, then properties, then proofs.
- Test your definitions on small examples before attempting the main theorems.
- When stuck on a proof, try `admit` (Coq/Lean) or `postulate` (Agda) temporarily to see if the overall structure works, then go back and fill in the gaps.
- Use the proof assistant's interactive mode (goal display) extensively. Understanding the current goal state is the key to making progress.

**Coq-specific tips:**
- `Search` finds relevant lemmas: `Search (_ ++ []).` finds lemmas about appending a singleton.
- `Check` shows the type of a term: `Check app_nil_r.`
- `Set Printing All.` shows implicit arguments and coercions.
- Use `Hint Resolve` to add lemmas to the `auto` database.

**Lean-specific tips:**
- `#check` shows types. `#print` shows definitions.
- `exact?` and `apply?` suggest applicable lemmas.
- `simp?` shows which lemmas `simp` uses.
- Mathlib's naming conventions: `List.append_nil`, `Nat.add_comm`, etc.

**Agda-specific tips:**
- Use `C-c C-c` (case split), `C-c C-r` (refine), `C-c C-a` (auto) in Emacs.
- Holes (`?`) let you see the expected type and available variables.
- Use `where` clauses to define helper functions locally.
- For proofs by induction, the termination checker requires that recursive calls are on structurally smaller arguments.

---

## Academic Integrity

You may consult the HoTT Book, the course lectures, and the documentation of your chosen proof assistant. You may discuss high-level strategies with classmates, but all submitted code and proofs must be your own work. If you use a proof or construction from a textbook or paper, cite it explicitly. Do not use AI code generation tools for the proof assistant formalization (Problem B.1); you may use them for the implementation (Problem B.2) if you cite them and can explain every line of the generated code.
