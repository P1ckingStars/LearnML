---
title: "Type Theory: Foundations, Systems, and Frontiers"
tags:
  - type-theory
  - course-info
---
# Type Theory: Foundations, Systems, and Frontiers

**A PhD-track course in type theory — 20 weeks, 11 modules, from lambda calculus to homotopy type theory.**

---

## Overview

This course provides a rigorous, self-contained treatment of type theory at the level expected of PhD students in programming languages, formal methods, and foundations of mathematics. Every type system is developed from first principles with full metatheoretic proofs, implemented from scratch in OCaml, and connected to seminal research papers.

**What makes this course different:**

- Full proofs of progress, preservation, and normalization — not just "it can be shown that..."
- Every type system is implemented as a working type checker and interpreter
- Coverage of frontier topics: dependent types, HoTT, linear types, session types, algebraic effects, gradual typing
- Research-oriented: students read papers, implement type systems, and produce an original capstone

## Course Structure

| Module | Title | Weeks | Key Topics |
|--------|-------|-------|------------|
| 00 | [Mathematical Foundations](modules/00_foundations/00_foundations.md) | Pre-work | What is type theory, logic, induction, sets |
| 01 | [Untyped Systems](modules/01_untyped_systems/01_untyped_systems.md) | 1-2 | Arithmetic expressions, lambda calculus, operational semantics |
| 02 | [Simply Typed Lambda Calculus](modules/02_stlc/02_stlc.md) | 3-4 | STLC, type safety, Curry-Howard, extensions |
| 03 | [Extensions & Recursive Types](modules/03_extensions_recursive/03_extensions_recursive.md) | 5-6 | References, exceptions, recursive types, fixed points |
| 04 | [Subtyping](modules/04_subtyping/04_subtyping.md) | 7-8 | Subtype relation, algorithmic subtyping, records, objects |
| 05 | [Type Inference](modules/05_type_inference/05_type_inference.md) | 9-10 | Unification, Hindley-Milner, Algorithm W |
| 06 | [Polymorphism & System F](modules/06_polymorphism_system_f/06_polymorphism_system_f.md) | 11-12 | System F, existential types, parametricity |
| 07 | [Higher-Order Types & the Lambda Cube](modules/07_higher_order_lambda_cube/07_higher_order_lambda_cube.md) | 13-14 | Kinds, F-omega, F-sub, pure type systems |
| 08 | [Dependent Types](modules/08_dependent_types/08_dependent_types.md) | 15-16 | Pi types, Sigma types, Martin-Lof type theory, CoC |
| 09 | [Substructural & Effect Types](modules/09_substructural_effects/09_substructural_effects.md) | 17-18 | Linear types, affine types, session types, algebraic effects |
| 10 | [Frontiers](modules/10_frontiers/10_frontiers.md) | 19-20 | HoTT, cubical type theory, gradual typing |

## Deliverables

- **11 Homeworks** (~20 hours each): metatheoretic proofs + from-scratch implementations in OCaml
- **2 Mini-Projects**: bidirectional type checker (Week 8), proof assistant core (Week 14)
- **1 Capstone**: original research contribution with 4 milestones across the semester
- **Paper Reading**: 5-8 seminal papers per module

## How to Use This Course

### As a Self-Learner

1. Read [PREREQUISITES.md](PREREQUISITES.md) and complete the self-assessment
2. Follow [SETUP.md](SETUP.md) to configure your OCaml and proof assistant environment
3. Work through modules sequentially — each builds on the previous
4. Do every homework from scratch before looking at solutions
5. Read at least the required papers for each module

### As a Course Instructor

- [SYLLABUS.md](SYLLABUS.md) contains a week-by-week schedule
- Lectures are designed for 75-minute sessions
- Recitations provide hands-on OCaml coding walkthroughs
- Homeworks and projects have detailed rubrics

### As a Researcher

- Jump to specific modules as needed
- Each lecture is self-contained with explicit prerequisites listed
- Use [resources/bibliography.md](resources/bibliography.md) as an annotated reading list

## Prerequisites

See [PREREQUISITES.md](PREREQUISITES.md) for details. In brief:

- **Logic**: Propositional and predicate logic, natural deduction
- **Discrete Mathematics**: Induction, sets, relations, functions
- **Programming**: Functional programming experience (OCaml, Haskell, ML, or similar)
- **Mathematical Maturity**: Comfort with formal definitions, theorems, and proofs

## Notation

See [NOTATION.md](NOTATION.md) for the global notation reference used throughout all materials.

## Resources

- [Paper Reading Guide](resources/paper_reading_guide.md) -- how to read PL/type theory papers effectively
- [Math Reference](resources/math_reference.md) -- quick-reference for inference rules, key theorems, and proof patterns
- [OCaml Patterns](resources/ocaml_patterns.md) -- idiomatic OCaml for language implementation
- [Bibliography](resources/bibliography.md) -- master annotated bibliography
- [Glossary](resources/glossary.md) -- definitions of key terms

## Acknowledgments

This course draws inspiration from:

- Pierce -- *Types and Programming Languages* (MIT Press)
- Harper -- *Practical Foundations for Programming Languages* (Cambridge)
- Girard, Lafont, Taylor -- *Proofs and Types* (Cambridge)
- Nederpelt, Geuvers -- *Type Theory and Formal Proof* (Cambridge)
- The Univalent Foundations Program -- *Homotopy Type Theory* (IAS)
- CMU 15-814 (Pfenning, Hoffmann), UPenn CIS 5000 (Pierce), Cambridge Part II Types
