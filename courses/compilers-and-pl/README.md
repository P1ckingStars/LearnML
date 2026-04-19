# Compilers & Programming Languages: Theory, Implementation, and Frontiers

**A PhD-track course in compilers and programming languages -- 22 weeks, 12 modules, from formal foundations to frontier research.**

---

## Overview

This course provides a rigorous, self-contained treatment of compiler construction and programming language theory at the level expected of PhD students at top research universities. Every topic is developed from first principles with full mathematical proofs, implemented from scratch, and connected to seminal research papers.

**What makes this course different:**

- Full proofs and derivations -- not just "the algorithm works because..."
- Every compiler phase is built from raw code before using library abstractions
- Coverage of both classic topics (parsing, code generation) and modern frontiers (verified compilers, ML for compilers, effect handlers)
- Research-oriented: students read papers, implement algorithms, and explore open problems

## Course Structure

| Module | Title | Weeks | Key Topics |
|--------|-------|-------|------------|
| 00 | [Mathematical Foundations](modules/00_foundations/00_foundations.md) | Pre-work | Formal languages, automata, lattices, fixed points |
| 01 | [Lexical Analysis](modules/01_lexical_analysis/01_lexical_analysis.md) | 1-2 | Regular expressions, automata, scanner construction |
| 02 | [Parsing](modules/02_parsing/02_parsing.md) | 3-4 | CFGs, LL/LR parsing, error recovery |
| 03 | [Semantic Analysis](modules/03_semantic_analysis/03_semantic_analysis.md) | 5-6 | Symbol tables, type checking, type inference |
| 04 | [Type Theory & PL Foundations](modules/04_type_theory_pl/04_type_theory_pl.md) | 7-8 | Lambda calculus, Curry-Howard, operational semantics |
| 05 | [IR & SSA](modules/05_ir_ssa/05_ir_ssa.md) | 9-10 | Three-address code, CFGs, dominance, SSA form |
| 06 | [Code Generation](modules/06_code_generation/06_code_generation.md) | 11-12 | Instruction selection, register allocation, calling conventions |
| 07 | [Program Analysis & Optimization](modules/07_program_analysis/07_program_analysis.md) | 13-14 | Dataflow analysis, loop optimizations, alias analysis |
| 08 | [Memory Management & Runtime](modules/08_memory_management/08_memory_management.md) | 15-16 | Garbage collection, memory safety, runtime systems |
| 09 | [PL Paradigms](modules/09_pl_paradigms/09_pl_paradigms.md) | 17-18 | Functional, OOP, concurrency, logic programming |
| 10 | [Frontier Topics](modules/10_frontiers/10_frontiers.md) | 19-20 | JIT compilation, verified compilers, ML for compilers |
| 11 | [Formal Verification & SMT](modules/11_formal_verification_smt/11_formal_verification_smt.md) | 21-22 | SAT/SMT solving, abstract interpretation, symbolic execution |

## Deliverables

- **12 Homeworks** (~20 hours each): proofs and derivations + from-scratch implementations
- **2 Mini-Projects**: end-to-end compiler front-end (Week 8), optimizer + code generator (Week 14)
- **1 Capstone**: original research contribution with 4 milestones across the semester
- **Paper Reading**: 5-8 seminal papers per module

## Teaching Team

See [TEAM.md](TEAM.md) for the full teaching staff, office hours, grading pipeline, and how to get help.

---

## How to Use This Course

### As a Self-Learner

1. Read [PREREQUISITES.md](PREREQUISITES.md) and complete the self-assessment
2. Follow [SETUP.md](SETUP.md) to configure your environment
3. Work through modules sequentially -- each builds on the previous
4. Do every homework from scratch before looking at solutions
5. Read at least the required papers for each module

### As a Course Instructor

- [SYLLABUS.md](SYLLABUS.md) contains a week-by-week schedule
- Lectures are designed for 75-minute sessions
- Recitations provide hands-on coding walkthroughs
- Homeworks and projects have detailed rubrics

### As a Researcher

- Jump to specific modules as needed
- Each lecture is self-contained with explicit prerequisites listed
- Use [resources/bibliography.md](resources/bibliography.md) as an annotated reading list

## Prerequisites

See [PREREQUISITES.md](PREREQUISITES.md) for details. In brief:

- **Mathematics**: Discrete math, basic logic, sets/relations, proof techniques (induction)
- **Programming**: Fluency in at least one systems language (C, C++, Rust, or OCaml/Haskell)
- **CS Fundamentals**: Data structures, algorithms, basic architecture (assembly, memory hierarchy)
- **Theory**: Basic automata theory and computability (helpful but reviewed in Module 00)

## Notation

See [NOTATION.md](NOTATION.md) for the notation conventions used throughout all materials.

## Resources

- [Paper Reading Guide](resources/paper_reading_guide.md) -- how to read PL/compilers papers effectively
- [Math Reference](resources/math_reference.md) -- quick-reference for lattices, fixed points, and type rules
- [Tool Guide](resources/tool_guide.md) -- LLVM, GDB, Flex/Bison, and other tools
- [Bibliography](resources/bibliography.md) -- master annotated bibliography
- [Glossary](resources/glossary.md) -- definitions of key terms

## Acknowledgments

This course draws inspiration from:

- Stanford CS143, CS242, CS243
- MIT 6.035 (Computer Language Engineering)
- CMU 15-411/611 (Compiler Design), 15-312 (Foundations of PL)
- Cornell CS6120 (Advanced Compilers)
- UPenn CIS 341/4521 (Compilers)
- Aho, Lam, Sethi, Ullman -- *Compilers: Principles, Techniques, and Tools* (The Dragon Book)
- Appel -- *Modern Compiler Implementation in ML*
- Pierce -- *Types and Programming Languages*
- Harper -- *Practical Foundations for Programming Languages*
