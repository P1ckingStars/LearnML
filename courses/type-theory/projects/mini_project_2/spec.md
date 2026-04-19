---
title: "Mini-Project 2: Proof Assistant Core"
tags:
  - type-theory
  - project
---
# Mini-Project 2: Proof Assistant Core

**Course:** Type Theory (PhD Track)
**Due:** Week 14
**Weight:** 10% of final grade
**Format:** Individual

---

## Overview

In this project, you will build a minimal but functional proof assistant for a dependently typed language based on Martin-Lof type theory. Your proof assistant must support Pi types (dependent functions), Sigma types (dependent pairs), natural numbers with an eliminator, and propositional identity types. Users of your system should be able to state theorems as types and prove them by constructing inhabitants of those types, either through direct term construction or through a small tactic language that you design.

This project bridges the gap between understanding dependent types in theory and implementing them in practice. The core challenge is implementing a correct type checker for a dependently typed language, which requires that type checking and evaluation be mutually recursive: to check that two types are equal, you must normalize them, and normalization itself must be type-directed in a dependently typed setting.

You will also compare two approaches to normalization -- normalization by evaluation (NbE) and reduction-based normalization -- and analyze their trade-offs in terms of correctness, performance, and implementation complexity. Your report will include several non-trivial theorems stated and proved within your system, serving as evidence that the implementation is correct and usable.

---

## Objectives

1. Implement a core dependently typed language with Pi types, Sigma types, natural numbers, and identity types, following the conventions of Martin-Lof type theory.
2. Implement a type checker for this language that correctly handles dependent types, including the mutual recursion between type checking and normalization.
3. Implement two normalization strategies -- normalization by evaluation (NbE) and reduction-based normalization -- and provide a mechanism to switch between them.
4. Design and implement a small tactic language that allows users to construct proofs interactively rather than writing raw proof terms.
5. State and prove at least 10 non-trivial theorems within your system, demonstrating its expressiveness and correctness.
6. Write a technical report comparing the two normalization strategies and documenting the design of your proof assistant.
7. Produce a clean, well-documented codebase that could serve as a reference implementation for others learning about dependent type theory.

---

## Technical Requirements

### Core Language

Your proof assistant must support the following type and term formers:

#### Universe

```
U : U    (Type-in-Type for simplicity; discuss the inconsistency in your report)
```

You may implement a universe hierarchy (`U_0 : U_1 : U_2 : ...`) as an extension, but Type-in-Type is acceptable for this project. If you use Type-in-Type, you must discuss Girard's paradox and why it does not undermine the practical utility of the system for this project's purposes.

#### Pi Types (Dependent Functions)

```
Formation:  G |- A : U    G, x:A |- B : U
            --------------------------------
            G |- (x : A) -> B : U

Introduction: G, x:A |- e : B
              ------------------
              G |- \(x:A).e : (x:A) -> B

Elimination:  G |- f : (x:A) -> B    G |- a : A
              ------------------------------------
              G |- f a : B[a/x]

Computation:  (\(x:A).e) a -->  e[a/x]
```

#### Sigma Types (Dependent Pairs)

```
Formation:  G |- A : U    G, x:A |- B : U
            --------------------------------
            G |- (x : A) * B : U

Introduction: G |- a : A    G |- b : B[a/x]
              --------------------------------
              G |- (a, b) : (x : A) * B

Elimination:  G |- p : (x:A) * B    G, x:A, y:B |- C : U    G, x:A, y:B |- e : C
              -----------------------------------------------------------------------
              G |- split(p, (x,y) => e) : C[(fst p)/x, (snd p)/y]

Projections:  fst (a, b) --> a
              snd (a, b) --> b
```

#### Natural Numbers

```
Formation:  Nat : U

Introduction: zero : Nat
              suc : Nat -> Nat

Elimination:  G |- n : Nat    G |- P : Nat -> U
              G |- z : P zero    G |- s : (k:Nat) -> P k -> P (suc k)
              ----------------------------------------------------------
              G |- natrec(n, P, z, s) : P n

Computation:  natrec(zero, P, z, s) --> z
              natrec(suc n, P, z, s) --> s n (natrec(n, P, z, s))
```

#### Identity Types

```
Formation:  G |- A : U    G |- a : A    G |- b : A
            -----------------------------------------
            G |- Id(A, a, b) : U

Introduction: G |- a : A
              ----------------
              G |- refl(a) : Id(A, a, a)

Elimination:  G |- p : Id(A, a, b)
              G |- C : (x:A) -> (y:A) -> Id(A, x, y) -> U
              G |- d : (x:A) -> C x x (refl x)
              -----------------------------------------------
              G |- J(C, d, a, b, p) : C a b p

Computation:  J(C, d, a, a, refl(a)) --> d a
```

### Type Checking

Your type checker must implement the following judgments:

- **Type checking:** `G |- e : T` -- check that term `e` has type `T` in context `G`.
- **Type synthesis:** `G |- e => T` -- infer the type `T` of term `e` in context `G`.
- **Definitional equality:** `G |- S == T` -- check that types `S` and `T` are definitionally equal. This requires normalization.
- **Context well-formedness:** `|- G ok` -- verify that a context is well-formed.

The type checker must correctly handle:

- **Dependent application:** When checking `f a`, the result type `B[a/x]` involves substitution of the argument into the codomain of the Pi type.
- **Conversion rule:** A term `e : A` also has type `B` whenever `A` is definitionally equal to `B`. This is the point where normalization enters type checking.
- **Universe checking:** Ensure that types are themselves well-typed (i.e., they inhabit a universe).

### Normalization

Implement two normalization strategies:

#### Strategy 1: Normalization by Evaluation (NbE)

NbE works by:

1. **Evaluating** a syntactic term into a semantic value in a host-language domain.
2. **Reading back** the semantic value into a syntactic normal form.

Your NbE implementation must:

- Define a domain of semantic values (closures for functions, neutral terms for stuck computations).
- Implement an evaluation function `eval : Env -> Term -> Value` that interprets terms in an environment.
- Implement a readback function `readback : Level -> Value -> Term` that quotes values back into normal forms.
- Handle all term formers (Pi, Sigma, Nat, Id) correctly.
- Produce beta-normal, eta-long normal forms for function types (eta-expansion of neutral functions).

#### Strategy 2: Reduction-Based Normalization

Reduction-based normalization works by:

1. Defining a set of reduction rules (beta, iota for eliminators, delta for definitions).
2. Applying these rules exhaustively under a chosen reduction strategy (e.g., weak head normal form first, then structural recursion into subterms).

Your reduction-based implementation must:

- Implement capture-avoiding substitution.
- Define a reduction relation that includes beta-reduction, iota-reduction for `natrec` and `J`, and delta-reduction for let-bound definitions.
- Implement a normalization function that reduces to beta-normal form.
- Handle open terms correctly (terms containing free variables that cannot be reduced).

#### Comparison Requirements

Provide a mechanism (e.g., a command-line flag or configuration option) to switch between the two normalization strategies. Your comparison must address:

1. **Correctness:** Do both strategies produce the same normal forms on a shared test suite of at least 30 terms? Document any discrepancies.
2. **Performance:** Measure normalization time on a set of benchmark terms of increasing size (e.g., computing `add 100 100`, normalizing large proof terms). Report wall-clock times.
3. **Implementation complexity:** Compare the two implementations in terms of lines of code, number of cases, conceptual difficulty, and ease of debugging.
4. **Eta-expansion:** Does your NbE implementation produce eta-long normal forms while your reduction-based normalizer does not? How does this affect definitional equality checking?

### Tactic Language

Implement a small tactic language that allows users to construct proofs step by step. Your tactic language must support at least the following tactics:

| Tactic | Effect |
|---|---|
| `intro x` | When the goal is `(x:A) -> B`, introduce `x:A` into the context and set the goal to `B`. |
| `apply f` | When `f : (x:A) -> B` and the goal is `B[a/x]` for some `a`, set the goal to `A`. |
| `exact e` | Close the goal by providing a term `e` of the goal type. |
| `refl` | When the goal is `Id(A, a, a)`, close it with `refl(a)`. |
| `induction n` | When `n : Nat` is in the context, perform case analysis and induction on `n`, generating subgoals for the `zero` and `suc` cases. |
| `split` | When the goal is `(x:A) * B`, generate two subgoals: one for `A` and one for `B`. |
| `assumption` | Search the context for a term of the goal type. |

Your tactic engine must:

- Maintain a proof state consisting of a list of open goals, each with a local context and a goal type.
- Apply tactics to the current goal, producing zero or more subgoals.
- Verify the completed proof term after all goals are closed.
- Report meaningful errors when a tactic fails (e.g., "intro: goal is not a Pi type").

You are encouraged to add additional tactics beyond the minimum set, such as `symmetry`, `transitivity`, `rewrite`, or `unfold`.

### Required Proofs

Your submission must include the following theorems, stated and proved within your system:

1. **Commutativity of addition:** `(m n : Nat) -> Id(Nat, add m n, add n m)`
2. **Associativity of addition:** `(m n k : Nat) -> Id(Nat, add (add m n) k, add m (add n k))`
3. **Zero is a right identity:** `(n : Nat) -> Id(Nat, add n zero, n)`
4. **Successor distributes over addition:** `(m n : Nat) -> Id(Nat, add (suc m) n, suc (add m n))`
5. **Symmetry of identity:** `(A : U) -> (a b : A) -> Id(A, a, b) -> Id(A, b, a)`
6. **Transitivity of identity:** `(A : U) -> (a b c : A) -> Id(A, a, b) -> Id(A, b, c) -> Id(A, a, c)`
7. **Congruence (ap):** `(A B : U) -> (f : A -> B) -> (a b : A) -> Id(A, a, b) -> Id(B, f a, f b)`
8. **Pair eta:** `(A : U) -> (B : A -> U) -> (p : (x:A) * B x) -> Id((x:A) * B x, (fst p, snd p), p)` (if your type theory supports this)
9. **Double negation introduction:** `(A : U) -> A -> ((A -> Void) -> Void)` where `Void` is the empty type (define it yourself)
10. **Disjunction commutativity:** `(A B : U) -> Either A B -> Either B A` where `Either` is a sum type (define it yourself or encode it)

You may define auxiliary functions (e.g., `add`, `Either`, `Void`) as part of a prelude. For proofs that require types not in the core language (e.g., `Void`, `Either`), you may encode them using existing types or extend the core language minimally.

At least 5 of these proofs must be written using the tactic language (not just raw proof terms).

### Evaluation

Your proof assistant will be evaluated on:

- **Type checker correctness:** A suite of instructor-provided terms will be checked for correct acceptance and rejection.
- **Normalization correctness:** A set of terms with known normal forms will be normalized and compared.
- **Proof verification:** The 10 required proofs will be verified by your system.
- **Tactic functionality:** The tactic language will be tested with instructor-provided tactic scripts.
- **Usability:** The system should be usable enough that a knowledgeable user could state and prove a simple theorem without consulting the source code.

---

## Deliverables

### Report

- **Format:** LaTeX, 8 pages max (excluding references and appendix)
- **Template:** ACM SIGPLAN two-column format or comparable PL-community template
- **Required sections:**
  1. **Abstract** (150 words max): Summarize the proof assistant, its core features, and the key findings of the normalization comparison.
  2. **Introduction:** Motivate dependent types and proof assistants. What is the Curry-Howard correspondence and why does it make proof assistants possible?
  3. **Core language:** Present the typing rules formally using inference rule notation. Discuss design choices (Type-in-Type vs. universe hierarchy, etc.).
  4. **Type checking algorithm:** Describe the bidirectional type checking algorithm for your dependently typed language. Explain the mutual recursion between type checking and normalization.
  5. **Normalization:** Describe both NbE and reduction-based normalization in detail. Present pseudocode or key code excerpts for each. Discuss correctness arguments.
  6. **Tactic language:** Describe your tactic language design. Explain how tactics manipulate the proof state. Discuss the verification of completed proofs.
  7. **Normalization comparison:** Present the results of your NbE vs. reduction-based comparison. Include performance benchmarks, correctness comparison, and implementation complexity analysis.
  8. **Example proofs:** Present at least 3 of your 10 required proofs in detail, showing both the theorem statement and the proof (in tactic form or as a proof term). Discuss what these proofs exercise in your system.
  9. **Related work:** Situate your work relative to existing proof assistants (Lean, Coq, Agda) and pedagogical implementations (MiniTT, pi-forall, Andrasek).
  10. **Conclusion:** Summarize findings, discuss limitations, and suggest extensions (universe polymorphism, inductive types, unification-based implicit arguments).

### Code

- **Repository:** A clean repository with a README containing:
  - Build and run instructions
  - How to load and check a file of definitions and theorems
  - How to enter tactic mode and construct proofs interactively
  - How to switch between NbE and reduction-based normalization
  - Description of the source file organization
- **Source code:** Well-organized with clear module boundaries:
  - Syntax (AST definitions)
  - Parser (if applicable)
  - Type checker
  - NbE normalizer
  - Reduction-based normalizer
  - Tactic engine
  - Pretty-printer
  - REPL or file-based interface
- **Proof library:** A file containing all 10 required proofs, loadable by the system
- **Test suite:** At least 30 test cases covering:
  - Well-typed terms that should be accepted
  - Ill-typed terms that should be rejected
  - Normalization tests with known results
  - Tactic tests

---

## Milestones

### Week 12: Checkpoint (5% of project grade)

Submit a brief progress report (1 page) and evidence of a working prototype:

- Type checker for Pi types and natural numbers (at minimum)
- At least one normalization strategy implemented
- At least 3 terms successfully type-checked
- A brief description of your plan for the tactic language and the normalization comparison

### Week 14: Final Submission (95% of project grade)

Submit the full report, code, proof library, and test suite as described above.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Type Checker Correctness** | 25% | The type checker correctly handles all four type formers (Pi, Sigma, Nat, Id). Dependent types are handled correctly, including substitution in types. The conversion rule is properly implemented. |
| **Normalization** | 20% | Both NbE and reduction-based normalization are implemented and produce correct normal forms. The comparison is thorough and insightful. Performance benchmarks are included. |
| **Tactic Language** | 15% | The tactic language supports at least the 7 required tactics. Proof state management is correct. Completed proofs are verified. Error messages for failed tactics are helpful. |
| **Proofs and Expressiveness** | 15% | All 10 required proofs are stated and verified by the system. At least 5 use the tactic language. The proofs demonstrate meaningful use of dependent types and the identity type. |
| **Report Quality** | 15% | The report is clear, technically precise, and well-organized. Typing rules use standard inference rule notation. The normalization comparison is well-presented. Related work is appropriately cited. |
| **Code Quality** | 10% | Code is clean, well-organized, and documented. Module boundaries are clear. The system is usable without reading the source code. The test suite is comprehensive. |

### Grade Descriptors

- **A (90-100%):** The proof assistant correctly handles all type formers. Both normalization strategies work correctly. The tactic language is functional and well-designed. All 10 proofs verify. The normalization comparison reveals genuine insights. The report is polished and precise.
- **B (80-89%):** The proof assistant handles most type formers correctly. At least one normalization strategy works well. The tactic language is present but may have limitations. Most proofs verify. The report is well-written.
- **C (70-79%):** The proof assistant handles Pi types and Nat but may struggle with Sigma types or identity types. One normalization strategy works. The tactic language is minimal. Some proofs fail. The report is adequate.
- **D/F (<70%):** The type checker has fundamental correctness issues. Normalization is buggy or missing. The tactic language is absent or non-functional. Few proofs verify. The report is incomplete.

---

## Helpful Guidance

### Getting Started

1. Begin with Pi types only. Implement type checking and one normalization strategy for a language with just `U`, Pi types, and variables. Get this working and tested thoroughly.
2. Add natural numbers and the `natrec` eliminator. This introduces iota-reduction and is a good test of your normalization.
3. Add Sigma types. These are structurally similar to Pi types but with pairs instead of functions.
4. Add identity types last. The `J` eliminator is the most complex and is easiest to add once the rest of the system is solid.
5. Implement the second normalization strategy once the first is working. Having a reference implementation makes debugging the second much easier.
6. Build the tactic language on top of the working type checker. Tactics generate proof terms that are verified by the type checker.

### Common Pitfalls

- **Incorrect substitution:** Substitution in a dependently typed language must be capture-avoiding and must handle substitution into types, not just terms. This is the single most common source of bugs.
- **Forgetting to normalize in the conversion rule:** When checking whether two types are equal, you must normalize both before comparing. Comparing un-normalized types leads to false negatives (rejecting well-typed programs).
- **Universe inconsistency with Type-in-Type:** While Type-in-Type is acceptable for this project, be aware that it makes the system logically inconsistent. Do not rely on logical consistency for your proofs -- they are still computationally meaningful.
- **De Bruijn indices vs. named variables:** If you use named variables, you must handle alpha-equivalence correctly. De Bruijn indices avoid this problem but make the code harder to read and debug. Either choice is acceptable; document your decision and its implications.
- **Tactic verification:** Always verify the proof term generated by tactics against the type checker. A bug in a tactic should produce a type error, not a silently incorrect proof.

### Suggested Reading

- Loh, McBride, and Swierstra, "A Tutorial Implementation of a Dependently Typed Lambda Calculus" (2010) -- essential starting point
- Abel, "Normalization by Evaluation: Dependent Types and Impredicativity" (Habilitation thesis, 2013)
- Coquand, "An Algorithm for Type-Checking Dependent Types" (1996)
- Norell, "Towards a Practical Programming Language Based on Dependent Type Theory" (PhD thesis, 2007) -- Agda's foundations
- Brady, "Idris, a General-Purpose Dependently Typed Programming Language: Design and Implementation" (JFP, 2013)
- Christiansen, "Implementing Dependent Types" (lecture notes, various years)
- The pi-forall tutorial implementation by Weirich (available on GitHub)

### Implementation Tips

- Use de Bruijn indices for the internal representation but named variables for the surface syntax. Implement a translation layer between them.
- For NbE, use closures that capture their environment. A closure is a pair of (environment, body term). Evaluation applies the closure by extending the environment.
- For readback, use a "level" counter that increases as you go under binders. Convert de Bruijn levels to de Bruijn indices during readback.
- For the tactic engine, represent the proof state as a zipper or a list of goals. Each goal is a pair of (context, type). Tactics transform goals into subgoals and accumulate a partial proof term.
- Test your type checker on small, hand-written terms before attempting the required proofs. A bug in the type checker will make the proofs impossible.

---

## Academic Integrity

- You must implement the proof assistant yourself. Using an existing proof assistant implementation (Lean, Coq, Agda, pi-forall, etc.) as your submission is not permitted.
- You may study existing implementations for design guidance. Cite anything you reference.
- You may use standard libraries for parsing, pretty-printing, and testing.
- Your report must be your own writing. LLM-assisted editing is permitted; LLM-generated technical content is not.

---

## Submission

Submit via the course portal by **Week 14, Friday 11:59 PM**:

1. Report as PDF (ACM SIGPLAN format or comparable)
2. Code as a zip archive or link to a private repository
3. Proof library file containing all 10 required proofs
4. Test suite included in the repository
5. A `README` with build, run, and usage instructions
