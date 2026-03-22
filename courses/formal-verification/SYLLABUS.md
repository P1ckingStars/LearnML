# Syllabus: Formal Verification with Isabelle — From ZFC Set Theory to C Program Verification

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

### Module 00: Foundations — Logic & Proof

Complete before the semester begins. Self-paced, ~2 weeks.

| Day | Topic | Materials |
|-----|-------|-----------|
| — | Propositional & Predicate Logic Review | [Lecture 00a](modules/00_foundations/lecture_00a_propositional_predicate_logic.md) |
| — | Natural Deduction & Sequent Calculus | [Lecture 00b](modules/00_foundations/lecture_00b_natural_deduction_sequent_calculus.md) |
| — | Proof Assistants & the LCF Architecture | [Lecture 00c](modules/00_foundations/lecture_00c_proof_assistants_lcf_architecture.md) |
| — | **HW0 Due: First day of class** | [HW0: Logic Bootcamp](modules/00_foundations/hw00_logic_bootcamp.md) |

---

## Weeks 1–2: Isabelle/Pure & the Isar Language

### Module 01: Getting Started with Isabelle

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 1 | Mon | The Pure Metalogic | [Lecture 01a](modules/01_isabelle_isar/lecture_01a_pure_metalogic.md) |
| 1 | Wed | Isar Structured Proofs | [Lecture 01b](modules/01_isabelle_isar/lecture_01b_isar_structured_proofs.md) |
| 1 | Fri | *Recitation: First Proofs in Isabelle* | [Recitation 01](modules/01_isabelle_isar/recitation_01_first_proofs.md) |
| 2 | Mon | Proof Methods & Automation | [Lecture 01c](modules/01_isabelle_isar/lecture_01c_proof_methods_automation.md) |
| 2 | Wed | Locales, Theories & the Isabelle Ecosystem | [Lecture 01d](modules/01_isabelle_isar/lecture_01d_locales_theories_ecosystem.md) |
| 2 | Fri | **HW1 Due** | [HW1: Isar Proofs](modules/01_isabelle_isar/hw01_isar_proofs.md) |

**Readings**: Wenzel, "The Isabelle/Isar Reference Manual"; Nipkow, "A Tutorial Introduction to Structured Isar Proofs"

---

## Weeks 3–4: First-Order Logic in Isabelle

### Module 02: FOL as an Object Logic

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 3 | Mon | IFOL & the Classical Extension | [Lecture 02a](modules/02_first_order_logic/lecture_02a_ifol_classical_extension.md) |
| 3 | Wed | Natural Deduction Rules in Isabelle | [Lecture 02b](modules/02_first_order_logic/lecture_02b_natural_deduction_rules.md) |
| 3 | Fri | *Recitation: FOL Exercises* | [Recitation 02](modules/02_first_order_logic/recitation_02_fol_exercises.md) |
| 4 | Mon | Proof Methods: rule, blast, auto | [Lecture 02c](modules/02_first_order_logic/lecture_02c_proof_methods_deep_dive.md) |
| 4 | Wed | Locales & Structured Theory Development | [Lecture 02d](modules/02_first_order_logic/lecture_02d_locales_structured_development.md) |
| 4 | Fri | **HW2 Due** | [HW2: FOL Proofs](modules/02_first_order_logic/hw02_fol_proofs.md) |

**Readings**: Paulson, "Isabelle's Logics: FOL and ZF" (Ch. 1–3)

---

## Weeks 5–6: ZFC Axioms & Basic Constructions

### Module 03: The Axioms of Zermelo-Fraenkel Set Theory

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 5 | Mon | ZF_Base: Type `i` and Membership | [Lecture 03a](modules/03_zfc_axioms/lecture_03a_zf_base_type_i.md) |
| 5 | Wed | The Six ZF Axioms | [Lecture 03b](modules/03_zfc_axioms/lecture_03b_axioms_extensionality_to_replacement.md) |
| 5 | Fri | *Recitation: Set Constructions* | [Recitation 03](modules/03_zfc_axioms/recitation_03_set_constructions.md) |
| 6 | Mon | Derived Pairing & Separation | [Lecture 03c](modules/03_zfc_axioms/lecture_03c_derived_pairing_separation.md) |
| 6 | Wed | Bounded Quantifiers & Comprehension | [Lecture 03d](modules/03_zfc_axioms/lecture_03d_bounded_quantifiers_comprehension.md) |
| 6 | Fri | **HW3 Due** | [HW3: Basic Set Theory](modules/03_zfc_axioms/hw03_basic_set_theory.md) |

**Capstone Milestone 1 Due: End of Week 5** — [Problem Statement](projects/capstone/milestone_1.md)

**Readings**: Paulson, "Set Theory for Verification I" (1993); Suppes, *Axiomatic Set Theory* (Ch. 1–4)

---

## Weeks 7–8: Relations, Functions & Ordinals

### Module 04: Building Mathematics in ZF

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 7 | Mon | Ordered Pairs, Products & Relations | [Lecture 04a](modules/04_relations_functions_ordinals/lecture_04a_ordered_pairs_relations.md) |
| 7 | Wed | Functions, Pi Types & Lambda Abstraction | [Lecture 04b](modules/04_relations_functions_ordinals/lecture_04b_functions_pi_types_lambda.md) |
| 7 | Fri | *Recitation: Ordinal Arithmetic* | [Recitation 04](modules/04_relations_functions_ordinals/recitation_04_ordinal_arithmetic.md) |
| 8 | Mon | Well-Founded Relations & Recursion | [Lecture 04c](modules/04_relations_functions_ordinals/lecture_04c_well_founded_recursion.md) |
| 8 | Wed | Ordinals & Transfinite Induction | [Lecture 04d](modules/04_relations_functions_ordinals/lecture_04d_ordinals_transfinite_induction.md) |
| 8 | Fri | **HW4 Due** | [HW4: Ordinals & Recursion](modules/04_relations_functions_ordinals/hw04_ordinals_recursion.md) |

**Mini-Project 1 Due: End of Week 10** — [Spec](projects/mini_project_1/spec.md)

**Readings**: Paulson, "Set Theory for Verification II" (1995); Kunen, *Set Theory* (Ch. I, Sec. 6–7)

---

## Weeks 9–10: Cardinals, Choice & Zorn

### Module 05: Cardinal Arithmetic and the Axiom of Choice

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 9 | Mon | Equipollence & Cardinal Numbers | [Lecture 05a](modules/05_cardinals_choice/lecture_05a_equipollence_cardinal_numbers.md) |
| 9 | Wed | The Schroeder-Bernstein Theorem | [Lecture 05b](modules/05_cardinals_choice/lecture_05b_schroeder_bernstein.md) |
| 9 | Fri | *Recitation: AC Equivalences* | [Recitation 05](modules/05_cardinals_choice/recitation_05_ac_equivalences.md) |
| 10 | Mon | The Axiom of Choice & Zorn's Lemma | [Lecture 05c](modules/05_cardinals_choice/lecture_05c_axiom_of_choice_zorn.md) |
| 10 | Wed | Cardinal Arithmetic | [Lecture 05d](modules/05_cardinals_choice/lecture_05d_cardinal_arithmetic.md) |
| 10 | Fri | **HW5 Due** | [HW5: Cardinals & Choice](modules/05_cardinals_choice/hw05_cardinals_choice.md) |

**Capstone Milestone 2 Due: End of Week 10** — [Method + Preliminary Results](projects/capstone/milestone_2.md)

**Readings**: Paulson & Grabczewski, "Mechanizing Set Theory: Cardinal Arithmetic and the Axiom of Choice"; Halmos, *Naive Set Theory*

---

## Weeks 11–12: Constructibility & Forcing

### Module 06: Advanced Set Theory in Isabelle

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 11 | Mon | Godel's Constructible Universe L | [Lecture 06a](modules/06_constructibility_forcing/lecture_06a_constructible_universe.md) |
| 11 | Wed | Absoluteness & the Reflection Theorem | [Lecture 06b](modules/06_constructibility_forcing/lecture_06b_absoluteness_reflection.md) |
| 11 | Fri | *Recitation: Reading a Large Formalization* | [Recitation 06](modules/06_constructibility_forcing/recitation_06_reading_formalization.md) |
| 12 | Mon | AC Holds in L | [Lecture 06c](modules/06_constructibility_forcing/lecture_06c_ac_in_l.md) |
| 12 | Wed | Forcing & the Independence of CH | [Lecture 06d](modules/06_constructibility_forcing/lecture_06d_forcing_independence.md) |
| 12 | Fri | **HW6 Due** | [HW6: Advanced Set Theory](modules/06_constructibility_forcing/hw06_advanced_set_theory.md) |

**Readings**: Paulson, "The Relative Consistency of the Axiom of Choice Mechanized Using Isabelle/ZF" (2003); Gunther et al., "Formalization of Forcing in Isabelle/ZF" (IJCAR 2020)

---

## Weeks 13–14: Isabelle/HOL

### Module 07: Higher-Order Logic and Isabelle's Type System

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 13 | Mon | Simple Type Theory & Polymorphism | [Lecture 07a](modules/07_isabelle_hol/lecture_07a_simple_type_theory.md) |
| 13 | Wed | Datatypes & Pattern Matching | [Lecture 07b](modules/07_isabelle_hol/lecture_07b_datatypes_pattern_matching.md) |
| 13 | Fri | *Recitation: HOL vs. ZF* | [Recitation 07](modules/07_isabelle_hol/recitation_07_hol_vs_zf.md) |
| 14 | Mon | Induction & Recursive Functions | [Lecture 07c](modules/07_isabelle_hol/lecture_07c_induction_recursion.md) |
| 14 | Wed | Sledgehammer, Nitpick & Automation | [Lecture 07d](modules/07_isabelle_hol/lecture_07d_sledgehammer_automation.md) |
| 14 | Fri | **HW7 Due** | [HW7: HOL Proofs](modules/07_isabelle_hol/hw07_hol_proofs.md) |

**Readings**: Nipkow & Klein, *Concrete Semantics* (Ch. 1–4); Nipkow, Paulson, Wenzel, *Isabelle/HOL Tutorial*

---

## Weeks 15–16: Program Semantics & Hoare Logic

### Module 08: From IMP to SIMPL

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 15 | Mon | The IMP Language & Operational Semantics | [Lecture 08a](modules/08_program_semantics/lecture_08a_imp_operational_semantics.md) |
| 15 | Wed | Hoare Logic & Verification Conditions | [Lecture 08b](modules/08_program_semantics/lecture_08b_hoare_logic_vcg.md) |
| 15 | Fri | *Recitation: IMP Proofs* | [Recitation 08](modules/08_program_semantics/recitation_08_imp_proofs.md) |
| 16 | Mon | The SIMPL Framework | [Lecture 08c](modules/08_program_semantics/lecture_08c_simpl_framework.md) |
| 16 | Wed | Monadic Verification & State Monads | [Lecture 08d](modules/08_program_semantics/lecture_08d_monadic_verification.md) |
| 16 | Fri | **HW8 Due** | [HW8: Hoare Logic](modules/08_program_semantics/hw08_hoare_logic.md) |

**Mini-Project 2 Due: End of Week 16** — [Spec](projects/mini_project_2/spec.md)

**Capstone Milestone 3 Due: End of Week 15** — [Full Draft](projects/capstone/milestone_3.md)

**Readings**: Nipkow & Klein, *Concrete Semantics* (Ch. 7–8, 12); Schirmer, "Verification of Sequential Imperative Programs in Isabelle/HOL"

---

## Weeks 17–18: C Verification

### Module 09: Verifying C Programs with Isabelle

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 17 | Mon | The StrictC Parser & C-to-Isabelle Translation | [Lecture 09a](modules/09_c_verification/lecture_09a_c_parser_strictc.md) |
| 17 | Wed | The AutoCorres Abstraction Pipeline | [Lecture 09b](modules/09_c_verification/lecture_09b_autocorres_pipeline.md) |
| 17 | Fri | *Recitation: AutoCorres Exercises* | [Recitation 09](modules/09_c_verification/recitation_09_autocorres_exercises.md) |
| 18 | Mon | Verifying C Functions End-to-End | [Lecture 09c](modules/09_c_verification/lecture_09c_verifying_c_functions.md) |
| 18 | Wed | Memory Models & Separation Logic | [Lecture 09d](modules/09_c_verification/lecture_09d_memory_model_separation_logic.md) |
| 18 | Fri | **HW9 Due** | [HW9: C Verification](modules/09_c_verification/hw09_c_verification.md) |

**Readings**: Greenaway, "Automated Proof-Producing Abstraction of C Code" (PhD, 2015); Tuch, Klein, Norrish, "Types, Bytes, and Separation Logic" (POPL 2007)

---

## Weeks 19–20: seL4, Refinement & Frontier

### Module 10: The seL4 Story and Open Problems

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 19 | Mon | The seL4 Verification Story | [Lecture 10a](modules/10_sel4_frontier/lecture_10a_sel4_verification_story.md) |
| 19 | Wed | Refinement Proofs: Abstract to C | [Lecture 10b](modules/10_sel4_frontier/lecture_10b_refinement_proofs.md) |
| 19 | Fri | *Recitation: l4v Repository Walkthrough* | [Recitation 10](modules/10_sel4_frontier/recitation_10_l4v_walkthrough.md) |
| 20 | Mon | Binary Verification & Translation Validation | [Lecture 10c](modules/10_sel4_frontier/lecture_10c_binary_verification.md) |
| 20 | Wed | Frontier: Open Problems in Formal Verification | [Lecture 10d](modules/10_sel4_frontier/lecture_10d_frontier_open_problems.md) |
| 20 | Fri | **HW10 Due** | [HW10: Verification Project](modules/10_sel4_frontier/hw10_verification_project.md) |

**Capstone Final Report Due: End of Week 20** — [Final Report](projects/capstone/final_report.md)

**Readings**: Klein et al., "seL4: Formal Verification of an OS Kernel" (SOSP 2009); Klein et al., "Comprehensive Formal Verification of an OS Microkernel" (ACM TOCS 2014)

---

## Paper Presentation Schedule

Each student presents one paper during the semester (15 min + 10 min Q&A).

- Weeks 3–4: Foundational logic and proof theory papers
- Weeks 7–8: Set theory formalization papers
- Weeks 11–14: Constructibility, forcing, and HOL papers
- Weeks 17–20: Program verification and seL4 papers

See [resources/paper_reading_guide.md](resources/paper_reading_guide.md) for presentation guidelines.
