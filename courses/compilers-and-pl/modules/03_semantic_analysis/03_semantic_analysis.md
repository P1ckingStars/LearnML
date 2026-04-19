# Module 03: Semantic Analysis

**Weeks 5--6** | Symbol Tables, Type Checking, Scope, Name Resolution

---

## Overview

Semantic analysis is the compiler phase that enforces the *meaning* constraints of a program that cannot be captured by context-free grammars alone. Where parsing ensures syntactic well-formedness, semantic analysis ensures that programs are *well-typed*, that names are *properly resolved*, and that the static invariants required by the language specification are upheld. This module covers the theory and practice of symbol tables, type checking, type inference, and advanced type systems.

## Learning Objectives

Upon completing this module, students will be able to:

1. Design and implement block-structured symbol tables supporting static and dynamic scoping.
2. Formulate type checking rules as formal inference rules and prove soundness properties.
3. Implement the Hindley-Milner type inference algorithm (Algorithm W) with unification.
4. Analyze and compare advanced type system features including subtyping, polymorphism, and linear types.
5. Build a complete type checker with inference for a small functional language.

## Prerequisites

- Module 01: Lexical Analysis (tokens, regular languages)
- Module 02: Parsing (ASTs, context-free grammars)
- Mathematical maturity: comfort with formal logic, inference rules, induction proofs

---

## Lectures

| # | Topic | File |
|---|-------|------|
| 03a | Symbol Tables & Scope | [lecture_03a_symbol_tables_scope.md](lecture_03a_symbol_tables_scope.md) |
| 03b | Type Checking | [lecture_03b_type_checking.md](lecture_03b_type_checking.md) |
| 03c | Type Inference | [lecture_03c_type_inference.md](lecture_03c_type_inference.md) |
| 03d | Advanced Type Systems | [lecture_03d_advanced_type_systems.md](lecture_03d_advanced_type_systems.md) |

## Recitation

| # | Topic | File |
|---|-------|------|
| R03 | Implementing a Type Checker | [recitation_03_type_checker.md](recitation_03_type_checker.md) |

## Homework

| # | Topic | File |
|---|-------|------|
| HW3 | Semantic Analysis | [hw03_semantic_analysis.md](hw03_semantic_analysis.md) |

---

## Key References

- Aho, Lam, Sethi, Ullman. *Compilers: Principles, Techniques, and Tools* (Dragon Book), Chapters 6--7.
- Cardelli, L. & Wegner, P. (1985). "On Understanding Types, Data Abstraction, and Polymorphism."
- Milner, R. (1978). "A Theory of Type Polymorphism in Programming."
- Damas, L. & Milner, R. (1982). "Principal Type-Schemes for Functional Programs."
- Pierce, B.C. *Types and Programming Languages* (TAPL), Chapters 9--22.

---

## Schedule

| Week | Day | Activity |
|------|-----|----------|
| 5 | Mon | Lecture 03a: Symbol Tables & Scope |
| 5 | Wed | Lecture 03b: Type Checking |
| 5 | Fri | Recitation: Implementing a Type Checker |
| 6 | Mon | Lecture 03c: Type Inference |
| 6 | Wed | Lecture 03d: Advanced Type Systems |
| 6 | Fri | HW3 due; Review session |
