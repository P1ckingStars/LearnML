# Module 07: Program Analysis & Optimization

**Weeks 13--14** | Dataflow Analysis, Loop Optimizations, Alias Analysis, Interprocedural Analysis

---

## Overview

Program analysis extracts information about program behavior without actually running the program. This information drives optimizations that can dramatically improve performance: eliminating dead code, moving invariant computations out of loops, replacing expensive operations with cheaper ones, and enabling parallelism. The analyses themselves rest on elegant mathematical foundations---lattice theory, fixed-point computation, and abstract interpretation---that guarantee both correctness and termination.

This module covers the major families of program analysis and the optimizations they enable: intraprocedural dataflow analysis (reaching definitions, liveness, available expressions), loop optimizations (code motion, strength reduction, tiling), alias and pointer analysis (Andersen's, Steensgaard's), and interprocedural analysis (call graphs, context sensitivity, the IFDS framework).

---

## Lectures

| Lecture | Title | Key Topics |
|---------|-------|------------|
| [Lecture 07a](lecture_07a_dataflow_analysis.md) | Dataflow Analysis | Lattices, transfer functions, fixed points, reaching definitions, liveness, available expressions, worklist algorithm, MOP vs MFP, monotone framework |
| [Lecture 07b](lecture_07b_loop_optimizations.md) | Loop Optimizations | LICM, strength reduction, induction variables, loop unrolling, fusion/fission, tiling, polyhedral model, vectorization |
| [Lecture 07c](lecture_07c_alias_analysis.md) | Alias Analysis & Pointer Analysis | Andersen's, Steensgaard's, flow-sensitivity, context-sensitivity, points-to analysis, shape analysis |
| [Lecture 07d](lecture_07d_interprocedural_analysis.md) | Interprocedural Analysis | Call graphs, CHA, RTA, context sensitivity, inlining, IFDS/IDE, modular analysis |

## Recitation

| Session | Title | Focus |
|---------|-------|-------|
| [Recitation 07](recitation_07_optimization.md) | Implementing Optimizations | Dataflow framework, reaching definitions, constant propagation, dead code elimination |

## Homework

| Assignment | Title | Components |
|------------|-------|------------|
| [HW 07](hw07_program_analysis.md) | Program Analysis | Part A: Theory (dataflow equations, fixed points, lattice proofs, alias analysis). Part B: Implementation (dataflow framework + analyses + LICM) |

---

## Learning Objectives

By the end of this module, students will be able to:

1. Formulate dataflow analyses as instances of the monotone framework and prove their correctness.
2. Implement a generic worklist-based dataflow analysis solver.
3. Apply loop optimizations including LICM, strength reduction, and loop tiling.
4. Distinguish between and implement Andersen's and Steensgaard's pointer analyses.
5. Construct call graphs and reason about context sensitivity in interprocedural analysis.
6. Explain the IFDS framework and its application to distributive dataflow problems.

---

## Prerequisites

- Module 05: Intermediate Representations (CFGs, SSA form, dominance)
- Module 06: Code Generation (understanding of target-level implications)
- Mathematical maturity: partial orders, lattices, fixed-point theorems

---

## Key References

- Kildall, G. A. (1973). "A Unified Approach to Global Program Optimization." *POPL*, 194--206.
- Kam, J. B., & Ullman, J. D. (1977). "Monotone Data Flow Analysis Frameworks." *Acta Informatica*, 7, 305--317.
- Andersen, L. O. (1994). "Program Analysis and Specialization for the C Programming Language." PhD Thesis, DIKU, University of Copenhagen.
- Steensgaard, B. (1996). "Points-to Analysis in Almost Linear Time." *POPL*, 32--41.
- Reps, T., Horwitz, S., & Sagiv, M. (1995). "Precise Interprocedural Dataflow Analysis via Graph Reachability." *POPL*, 49--61.
- Muchnick, S. S. (1997). *Advanced Compiler Design and Implementation*. Morgan Kaufmann.
- Nielson, F., Nielson, H. R., & Hankin, C. (2005). *Principles of Program Analysis*. Springer.
