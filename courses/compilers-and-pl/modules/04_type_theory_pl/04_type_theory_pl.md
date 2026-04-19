# Module 04: Type Theory & PL Foundations

**Weeks 7--8** | Lambda Calculus, Curry-Howard Correspondence, Operational Semantics

---

## Overview

This module develops the theoretical foundations that underpin programming language design and compiler construction. We study the lambda calculus as the universal model of computation, define what it means for programs to "run" through operational semantics, establish the deep connection between logic and type theory via the Curry-Howard correspondence, and survey denotational and axiomatic approaches to program meaning. These foundations are not merely theoretical curiosities---they directly inform language design decisions, compiler correctness arguments, and verification tools.

## Learning Objectives

Upon completing this module, students will be able to:

1. Perform alpha, beta, and eta reductions in the untyped and typed lambda calculus.
2. Encode data structures and control flow using Church encodings.
3. Define and use big-step and small-step operational semantics for a simple language.
4. State and prove progress and preservation theorems (type safety).
5. Explain the Curry-Howard correspondence and translate between propositions and types.
6. Formulate Hoare logic specifications and prove program correctness.

## Prerequisites

- Module 03: Semantic Analysis (type systems, typing rules)
- Mathematical logic (propositional and predicate logic)
- Proof techniques (induction, structural induction)

---

## Lectures

| # | Topic | File |
|---|-------|------|
| 04a | Lambda Calculus | [lecture_04a_lambda_calculus.md](lecture_04a_lambda_calculus.md) |
| 04b | Operational Semantics | [lecture_04b_operational_semantics.md](lecture_04b_operational_semantics.md) |
| 04c | The Curry-Howard Correspondence | [lecture_04c_curry_howard.md](lecture_04c_curry_howard.md) |
| 04d | Denotational & Axiomatic Semantics | [lecture_04d_denotational_axiomatic.md](lecture_04d_denotational_axiomatic.md) |

## Recitation

| # | Topic | File |
|---|-------|------|
| R04 | Lambda Calculus & Proofs | [recitation_04_lambda_proofs.md](recitation_04_lambda_proofs.md) |

## Homework

| # | Topic | File |
|---|-------|------|
| HW4 | Type Theory & PL Foundations | [hw04_type_theory.md](hw04_type_theory.md) |

---

## Key References

- Church, A. (1936). "An Unsolvable Problem of Elementary Number Theory."
- Barendregt, H.P. (1984). *The Lambda Calculus: Its Syntax and Semantics* (revised ed.).
- Plotkin, G.D. (1981). "A Structural Approach to Operational Semantics." Tech Report DAIMI FN-19.
- Howard, W.A. (1980). "The Formulae-as-Types Notion of Construction."
- Hoare, C.A.R. (1969). "An Axiomatic Basis for Computer Programming."
- Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press.
- Harper, R. (2016). *Practical Foundations for Programming Languages* (2nd ed.). Cambridge.

---

## Schedule

| Week | Day | Activity |
|------|-----|----------|
| 7 | Mon | Lecture 04a: Lambda Calculus |
| 7 | Wed | Lecture 04b: Operational Semantics |
| 7 | Fri | Recitation: Lambda Calculus & Proofs |
| 8 | Mon | Lecture 04c: Curry-Howard Correspondence |
| 8 | Wed | Lecture 04d: Denotational & Axiomatic Semantics |
| 8 | Fri | HW4 due; Midterm review |
