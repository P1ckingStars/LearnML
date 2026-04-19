---
title: "Syllabus: Type Theory -- Foundations, Systems, and Frontiers"
tags:
  - type-theory
  - course-info
---
# Syllabus: Type Theory -- Foundations, Systems, and Frontiers

## Course Information

- **Duration**: 20 weeks (1 semester) + pre-work
- **Lectures**: 2 x 75 min per week
- **Recitation**: 1 x 50 min per week
- **Office Hours**: 2 x 60 min per week
- **Prerequisites**: See [PREREQUISITES.md](PREREQUISITES.md)

## Grading

| Component | Weight |
|-----------|--------|
| Homeworks (11) | 40% |
| Mini-Project 1 | 10% |
| Mini-Project 2 | 10% |
| Capstone Project | 30% |
| Paper Presentations | 10% |

**Late Policy**: 3 free late days total across all homeworks. After that, 20% penalty per day. No late submissions for projects.

---

## Pre-Work (Before Week 1)

### Module 00: Mathematical Foundations

Complete before the semester begins. Self-paced, ~2 weeks.

| Day | Topic | Materials |
|-----|-------|-----------|
| -- | What Is Type Theory? (Start here) | [Lecture 00a](modules/00_foundations/lecture_00a_what_is_type_theory.md) |
| -- | Logic & Proof Techniques | [Lecture 00b](modules/00_foundations/lecture_00b_logic_and_proof.md) |
| -- | Induction Principles | [Lecture 00c](modules/00_foundations/lecture_00c_induction_principles.md) |
| -- | Sets, Relations & Functions | [Lecture 00d](modules/00_foundations/lecture_00d_sets_relations_functions.md) |
| -- | **HW0 Due: First day of class** | [HW0: Foundations Bootcamp](modules/00_foundations/hw00_foundations_bootcamp.md) |

---

## Weeks 1-2: Untyped Systems

### Module 01: Lambda Calculus and Operational Semantics

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 1 | Mon | Untyped Arithmetic Expressions | [Lecture 01a](modules/01_untyped_systems/lecture_01a_untyped_arithmetic.md) |
| 1 | Wed | The Untyped Lambda Calculus | [Lecture 01b](modules/01_untyped_systems/lecture_01b_untyped_lambda_calculus.md) |
| 1 | Fri | *Recitation: OCaml Fundamentals* | [Recitation 01](modules/01_untyped_systems/recitation_01_ocaml_fundamentals.md) |
| 2 | Mon | Operational Semantics | [Lecture 01c](modules/01_untyped_systems/lecture_01c_operational_semantics.md) |
| 2 | Wed | Church Encodings & Computability | [Lecture 01d](modules/01_untyped_systems/lecture_01d_church_encodings.md) |
| 2 | Fri | **HW1 Due** | [HW1: Lambda Calculus Interpreter](modules/01_untyped_systems/hw01_lambda_interpreter.md) |

**Readings**: Church (1936), Barendregt Ch. 1-3, TAPL Ch. 3-7

---

## Weeks 3-4: Simply Typed Lambda Calculus

### Module 02: STLC, Type Safety, and Curry-Howard

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 3 | Mon | The Simply Typed Lambda Calculus | [Lecture 02a](modules/02_stlc/lecture_02a_stlc.md) |
| 3 | Wed | Type Safety: Progress & Preservation | [Lecture 02b](modules/02_stlc/lecture_02b_type_safety.md) |
| 3 | Fri | *Recitation: Implementing a Type Checker* | [Recitation 02](modules/02_stlc/recitation_02_type_checker.md) |
| 4 | Mon | Extensions: Products, Sums, Unit, Void | [Lecture 02c](modules/02_stlc/lecture_02c_extensions.md) |
| 4 | Wed | The Curry-Howard Correspondence | [Lecture 02d](modules/02_stlc/lecture_02d_curry_howard.md) |
| 4 | Fri | **HW2 Due** | [HW2: STLC Type Checker](modules/02_stlc/hw02_stlc_type_checker.md) |

**Readings**: Church (1940), Howard (1969/1980), Wright & Felleisen (1994), TAPL Ch. 8-11

---

## Weeks 5-6: Extensions & Recursive Types

### Module 03: References, Exceptions, and Recursion

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 5 | Mon | References & Mutable State | [Lecture 03a](modules/03_extensions_recursive/lecture_03a_references.md) |
| 5 | Wed | Exceptions & Error Handling | [Lecture 03b](modules/03_extensions_recursive/lecture_03b_exceptions.md) |
| 5 | Fri | *Recitation: Stateful Interpreter* | [Recitation 03](modules/03_extensions_recursive/recitation_03_stateful_interpreter.md) |
| 6 | Mon | Recursive Types: Iso-Recursive & Equi-Recursive | [Lecture 03c](modules/03_extensions_recursive/lecture_03c_recursive_types.md) |
| 6 | Wed | Fixed Points & the Y Combinator | [Lecture 03d](modules/03_extensions_recursive/lecture_03d_fixed_points.md) |
| 6 | Fri | **HW3 Due** | [HW3: Recursive Types](modules/03_extensions_recursive/hw03_recursive_types.md) |

**Capstone Milestone 1 Due: End of Week 5** -- [Problem Statement](projects/capstone/milestone_1.md)

**Readings**: TAPL Ch. 13-14, 20-21, Amadio & Cardelli (1993)

---

## Weeks 7-8: Subtyping

### Module 04: The Subtype Relation

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 7 | Mon | The Subtyping Relation | [Lecture 04a](modules/04_subtyping/lecture_04a_subtyping_relation.md) |
| 7 | Wed | Algorithmic Subtyping | [Lecture 04b](modules/04_subtyping/lecture_04b_algorithmic_subtyping.md) |
| 7 | Fri | *Recitation: Subtyping Implementation* | [Recitation 04](modules/04_subtyping/recitation_04_subtyping_implementation.md) |
| 8 | Mon | Metatheory of Subtyping | [Lecture 04c](modules/04_subtyping/lecture_04c_metatheory.md) |
| 8 | Wed | Records, Variants & Object Types | [Lecture 04d](modules/04_subtyping/lecture_04d_records_objects.md) |
| 8 | Fri | **HW4 Due** | [HW4: Subtyping](modules/04_subtyping/hw04_subtyping.md) |

**Mini-Project 1 Due: End of Week 8** -- [Spec](projects/mini_project_1/spec.md)

**Readings**: TAPL Ch. 15-17, Cardelli (1988), Pierce (1994)

---

## Weeks 9-10: Type Inference & Reconstruction

### Module 05: Unification, Hindley-Milner, and Algorithm W

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 9 | Mon | Type Inference for STLC | [Lecture 05a](modules/05_type_inference/lecture_05a_type_inference_stlc.md) |
| 9 | Wed | Unification | [Lecture 05b](modules/05_type_inference/lecture_05b_unification.md) |
| 9 | Fri | *Recitation: Implementing Algorithm W* | [Recitation 05](modules/05_type_inference/recitation_05_algorithm_w.md) |
| 10 | Mon | Hindley-Milner Type System | [Lecture 05c](modules/05_type_inference/lecture_05c_hindley_milner.md) |
| 10 | Wed | Constraint-Based Type Inference | [Lecture 05d](modules/05_type_inference/lecture_05d_constraint_inference.md) |
| 10 | Fri | **HW5 Due** | [HW5: Type Inference Engine](modules/05_type_inference/hw05_type_inference.md) |

**Capstone Milestone 2 Due: End of Week 10** -- [Method + Preliminary Results](projects/capstone/milestone_2.md)

**Readings**: Milner (1978), Damas & Milner (1982), Robinson (1965), TAPL Ch. 22

---

## Weeks 11-12: Polymorphism & System F

### Module 06: Universal Types, Existentials, and Parametricity

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 11 | Mon | System F: Universal Types | [Lecture 06a](modules/06_polymorphism_system_f/lecture_06a_system_f.md) |
| 11 | Wed | System F Metatheory | [Lecture 06b](modules/06_polymorphism_system_f/lecture_06b_system_f_metatheory.md) |
| 11 | Fri | *Recitation: Polymorphic Type Checker* | [Recitation 06](modules/06_polymorphism_system_f/recitation_06_polymorphic_type_checker.md) |
| 12 | Mon | Existential Types & Data Abstraction | [Lecture 06c](modules/06_polymorphism_system_f/lecture_06c_existential_types.md) |
| 12 | Wed | Parametricity & Free Theorems | [Lecture 06d](modules/06_polymorphism_system_f/lecture_06d_parametricity.md) |
| 12 | Fri | **HW6 Due** | [HW6: System F](modules/06_polymorphism_system_f/hw06_system_f.md) |

**Readings**: Girard (1972), Reynolds (1974, 1983), Wadler (1989), TAPL Ch. 23-24

---

## Weeks 13-14: Higher-Order Types & the Lambda Cube

### Module 07: Kinds, F-omega, F-sub, and Pure Type Systems

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 13 | Mon | Kinds & Type Operators | [Lecture 07a](modules/07_higher_order_lambda_cube/lecture_07a_kinds_type_operators.md) |
| 13 | Wed | System F-omega | [Lecture 07b](modules/07_higher_order_lambda_cube/lecture_07b_system_f_omega.md) |
| 13 | Fri | *Recitation: Higher-Kinded Types* | [Recitation 07](modules/07_higher_order_lambda_cube/recitation_07_higher_kinded.md) |
| 14 | Mon | Bounded Quantification (F-sub) | [Lecture 07c](modules/07_higher_order_lambda_cube/lecture_07c_f_sub.md) |
| 14 | Wed | The Lambda Cube & Pure Type Systems | [Lecture 07d](modules/07_higher_order_lambda_cube/lecture_07d_lambda_cube.md) |
| 14 | Fri | **HW7 Due** | [HW7: Higher-Order Types](modules/07_higher_order_lambda_cube/hw07_higher_order.md) |

**Mini-Project 2 Due: End of Week 14** -- [Spec](projects/mini_project_2/spec.md)

**Readings**: Barendregt (1992), TAPL Ch. 26, 28-30, Pierce (1994)

---

## Weeks 15-16: Dependent Types

### Module 08: Pi Types, Sigma Types, and Proof Assistants

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 15 | Mon | Dependent Function Types (Pi Types) | [Lecture 08a](modules/08_dependent_types/lecture_08a_pi_types.md) |
| 15 | Wed | Dependent Pair Types (Sigma Types) | [Lecture 08b](modules/08_dependent_types/lecture_08b_sigma_types.md) |
| 15 | Fri | *Recitation: Dependent Type Checker* | [Recitation 08](modules/08_dependent_types/recitation_08_dependent_type_checker.md) |
| 16 | Mon | Martin-Lof Type Theory | [Lecture 08c](modules/08_dependent_types/lecture_08c_martin_lof.md) |
| 16 | Wed | The Calculus of Constructions | [Lecture 08d](modules/08_dependent_types/lecture_08d_calculus_of_constructions.md) |
| 16 | Fri | **HW8 Due** | [HW8: Dependent Types](modules/08_dependent_types/hw08_dependent_types.md) |

**Capstone Milestone 3 Due: End of Week 15** -- [Full Draft](projects/capstone/milestone_3.md)

**Readings**: Martin-Lof (1984), Coquand & Huet (1988), Nederpelt & Geuvers Ch. 5-10

---

## Weeks 17-18: Substructural & Effect Types

### Module 09: Linear Types, Session Types, and Algebraic Effects

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 17 | Mon | Linear Types & Linear Logic | [Lecture 09a](modules/09_substructural_effects/lecture_09a_linear_types.md) |
| 17 | Wed | Affine Types & Ownership | [Lecture 09b](modules/09_substructural_effects/lecture_09b_affine_types.md) |
| 17 | Fri | *Recitation: Linear Type Checker* | [Recitation 09](modules/09_substructural_effects/recitation_09_linear_type_checker.md) |
| 18 | Mon | Session Types for Concurrency | [Lecture 09c](modules/09_substructural_effects/lecture_09c_session_types.md) |
| 18 | Wed | Effect Systems & Algebraic Effects | [Lecture 09d](modules/09_substructural_effects/lecture_09d_algebraic_effects.md) |
| 18 | Fri | **HW9 Due** | [HW9: Substructural Types](modules/09_substructural_effects/hw09_substructural.md) |

**Readings**: Girard (1987), Wadler (1990), Honda (1993), Plotkin & Pretnar (2009), Walker (2004)

---

## Weeks 19-20: Frontiers

### Module 10: HoTT, Cubical Type Theory, and Beyond

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 19 | Mon | Identity Types & Univalence | [Lecture 10a](modules/10_frontiers/lecture_10a_identity_univalence.md) |
| 19 | Wed | Cubical Type Theory | [Lecture 10b](modules/10_frontiers/lecture_10b_cubical.md) |
| 19 | Fri | *Recitation: Proof Assistants Tour* | [Recitation 10](modules/10_frontiers/recitation_10_proof_assistants.md) |
| 20 | Mon | Gradual Typing | [Lecture 10c](modules/10_frontiers/lecture_10c_gradual_typing.md) |
| 20 | Wed | The Future of Type Theory | [Lecture 10d](modules/10_frontiers/lecture_10d_future.md) |
| 20 | Fri | **HW10 Due** | [HW10: Frontiers](modules/10_frontiers/hw10_frontiers.md) |

**Capstone Final Report Due: End of Week 20** -- [Final Report](projects/capstone/final_report.md)

**Readings**: HoTT Book Ch. 1-2, Cohen et al. (2018), Siek & Taha (2006)

---

## Paper Presentation Schedule

Each student presents one paper during the semester (15 min + 10 min Q&A).

- Weeks 3-4: Foundational papers (Church, Curry, Howard)
- Weeks 7-8: Core type system papers (Milner, Reynolds, Girard)
- Weeks 11-14: Advanced type system papers (Wadler, Coquand, Barendregt)
- Weeks 17-20: Frontier papers (HoTT, cubical, effects, gradual typing)

See [resources/paper_reading_guide.md](resources/paper_reading_guide.md) for presentation guidelines.
