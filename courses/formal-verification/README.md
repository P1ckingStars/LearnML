# Formal Verification with Isabelle: From ZFC Set Theory to C Program Verification

**A PhD-track course in formal verification — 20 weeks, 11 modules, from logical foundations through ZFC formalization to verified C programs.**

---

## Overview

This course provides a rigorous, self-contained treatment of the Isabelle proof assistant, covering two major tracks: the formalization of ZFC set theory (Isabelle/ZF) and the verification of C programs (Isabelle/HOL). Every topic is developed from first principles with full formal derivations, implemented as Isabelle theory files, and connected to seminal research papers.

**What makes this course different:**

- Two object logics, one framework — understand Isabelle's generic architecture from the metalogic up
- Full ZFC formalization — axioms, ordinals, cardinals, the constructible universe, and forcing
- Real-world C verification — the same tools and techniques used to verify the seL4 microkernel
- Research-oriented: students read formalization papers, study real proof developments, and produce an original capstone

## Course Structure

| Module | Title | Weeks | Key Topics |
|--------|-------|-------|------------|
| 00 | [Foundations: Logic & Proof](modules/00_foundations/00_foundations.md) | Pre-work | Propositional & predicate logic, natural deduction, proof assistants |
| 01 | [Isabelle/Pure & the Isar Language](modules/01_isabelle_isar/01_isabelle_isar.md) | 1–2 | Pure metalogic, Isar structured proofs, basic automation |
| 02 | [First-Order Logic in Isabelle](modules/02_first_order_logic/02_first_order_logic.md) | 3–4 | IFOL, FOL, natural deduction rules, locales |
| 03 | [ZFC I: Axioms & Basic Constructions](modules/03_zfc_axioms/03_zfc_axioms.md) | 5–6 | Type `i`, ZF axioms, separation, pairing, comprehension |
| 04 | [ZFC II: Relations, Functions & Ordinals](modules/04_relations_functions_ordinals/04_relations_functions_ordinals.md) | 7–8 | Ordered pairs, Pi types, well-founded recursion, ordinals |
| 05 | [ZFC III: Cardinals, Choice & Zorn](modules/05_cardinals_choice/05_cardinals_choice.md) | 9–10 | Equipollence, Schroeder-Bernstein, AC, cardinal arithmetic |
| 06 | [Advanced ZF: Constructibility & Forcing](modules/06_constructibility_forcing/06_constructibility_forcing.md) | 11–12 | Godel's L, absoluteness, AC in L, forcing, independence of CH |
| 07 | [Isabelle/HOL: Types, Datatypes & Induction](modules/07_isabelle_hol/07_isabelle_hol.md) | 13–14 | Simple type theory, polymorphism, datatypes, Sledgehammer |
| 08 | [Program Semantics & Hoare Logic](modules/08_program_semantics/08_program_semantics.md) | 15–16 | IMP language, operational semantics, Hoare logic, VCG, SIMPL |
| 09 | [C Verification: Parser, AutoCorres & Proofs](modules/09_c_verification/09_c_verification.md) | 17–18 | StrictC parser, AutoCorres pipeline, verifying C functions |
| 10 | [seL4, Refinement & Frontier](modules/10_sel4_frontier/10_sel4_frontier.md) | 19–20 | seL4 verification story, refinement proofs, binary verification |

## Deliverables

- **11 Homeworks** (~15–20 hours each): pen-and-paper proofs + Isabelle `.thy` file submissions
- **2 Mini-Projects**: formalize a set-theoretic result in Isabelle/ZF (Week 10), verify a C program with AutoCorres (Week 16)
- **1 Capstone**: original formalization contribution with 4 milestones across the semester
- **Paper Reading**: 3–6 seminal papers per module

## Teaching Team

See [TEAM.md](TEAM.md) for the full teaching staff, office hours, grading pipeline, and how to get help.

---

## How to Use This Course

### As a Self-Learner

1. Read [PREREQUISITES.md](PREREQUISITES.md) and complete the self-assessment
2. Follow [SETUP.md](SETUP.md) to install Isabelle and configure your environment
3. Work through modules sequentially — each builds on the previous
4. Do every homework as Isabelle theory files before looking at solutions
5. Read at least the required papers for each module

### As a Course Instructor

- [SYLLABUS.md](SYLLABUS.md) contains a week-by-week schedule
- Lectures are designed for 75-minute sessions
- Recitations provide hands-on Isabelle walkthroughs
- Homeworks and projects have detailed rubrics

### As a Researcher

- Jump to specific modules as needed
- Each lecture is self-contained with explicit prerequisites listed
- Use [resources/bibliography.md](resources/bibliography.md) as an annotated reading list
- The ZF track (modules 02–06) and C verification track (modules 07–10) can be studied semi-independently after module 01

## Prerequisites

See [PREREQUISITES.md](PREREQUISITES.md) for details. In brief:

- **Mathematics**: Undergraduate logic, basic set theory, mathematical maturity (proof-writing fluency)
- **Programming**: Familiarity with a typed functional language (ML, Haskell, OCaml) is helpful but not required; C programming for the verification track
- **No prior Isabelle experience required** — the course builds from scratch

## Notation

See [NOTATION.md](NOTATION.md) for the global notation reference used throughout all materials.

## Resources

- [Paper Reading Guide](resources/paper_reading_guide.md) — how to read formalization papers effectively
- [Math Reference](resources/math_reference.md) — quick-reference for logic and set theory
- [Isabelle Quick Reference](resources/isabelle_reference.md) — idiomatic Isabelle patterns and tactics
- [Bibliography](resources/bibliography.md) — master annotated bibliography
- [Glossary](resources/glossary.md) — definitions of key terms

## Acknowledgments

This course draws inspiration from:

- Cambridge Part III — *Interactive Formal Verification* (Lawrence Paulson)
- TU Munich — *Interactive Software Verification* (Tobias Nipkow)
- UNSW COMP4161 — *Advanced Topics in Software Verification*
- University of Freiburg — *Isabelle and Program Verification*
- Nipkow, Paulson, Wenzel — *Isabelle/HOL: A Proof Assistant for Higher-Order Logic*
- Nipkow & Klein — *Concrete Semantics with Isabelle/HOL*
- Paulson — *Set Theory for Verification I & II*
- Klein et al. — *seL4: Formal Verification of an OS Kernel*
