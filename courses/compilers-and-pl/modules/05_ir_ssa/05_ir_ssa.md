# Module 05: Intermediate Representations & SSA

**Weeks 9--10** | ASTs, Three-Address Code, Control Flow Graphs, SSA Form

---

## Overview

Intermediate representations (IRs) are the bridge between the source-level AST and the target machine code. A well-designed IR enables effective analysis and transformation by exposing the essential structure of computation while abstracting away source-language idiosyncrasies and target-machine details. This module covers the design space of IRs, the construction and analysis of control flow graphs, the theory and algorithms of Static Single Assignment (SSA) form, and the optimizations that SSA enables.

## Learning Objectives

Upon completing this module, students will be able to:

1. Compare and contrast AST-based, linear (three-address code), stack-based, and graph-based IRs.
2. Construct control flow graphs and compute dominance relations.
3. Implement the SSA construction algorithm using dominance frontiers.
4. Explain the theoretical properties of SSA and their implications for optimization.
5. Implement SSA-based optimizations including sparse conditional constant propagation and global value numbering.

## Prerequisites

- Module 03: Semantic Analysis (symbol tables, type checking)
- Module 04: Type Theory & PL Foundations (operational semantics)
- Graph algorithms (DFS, BFS, topological sort)
- Basic understanding of computer architecture (registers, memory)

---

## Lectures

| # | Topic | File |
|---|-------|------|
| 05a | Intermediate Representations | [lecture_05a_intermediate_representations.md](lecture_05a_intermediate_representations.md) |
| 05b | Control Flow Graphs | [lecture_05b_control_flow_graphs.md](lecture_05b_control_flow_graphs.md) |
| 05c | Static Single Assignment Form | [lecture_05c_ssa_form.md](lecture_05c_ssa_form.md) |
| 05d | SSA-Based Optimizations | [lecture_05d_ssa_optimizations.md](lecture_05d_ssa_optimizations.md) |

## Recitation

| # | Topic | File |
|---|-------|------|
| R05 | Working with LLVM IR | [recitation_05_llvm_ir.md](recitation_05_llvm_ir.md) |

## Homework

| # | Topic | File |
|---|-------|------|
| HW5 | IR & SSA | [hw05_ir_ssa.md](hw05_ir_ssa.md) |

---

## Key References

- Cytron, R., Ferrante, J., Rosen, B.K., Wegman, M.N., & Zadeck, F.K. (1991). "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph." *ACM TOPLAS*, 13(4), 451--490.
- Lattner, C. & Adve, V. (2004). "LLVM: A Compilation Framework for Lifelong Program Analysis & Transformation." *CGO*.
- Cooper, K.D. & Torczon, L. (2011). *Engineering a Compiler* (2nd ed.), Chapters 4--5, 8--9.
- Appel, A.W. (1998). "SSA is Functional Programming." *ACM SIGPLAN Notices*, 33(4), 17--20.
- Click, C. & Paleczny, M. (1995). "A Simple Graph-Based Intermediate Representation." *ACM SIGPLAN Workshop on IR for Optimizing Compilers*.

---

## Schedule

| Week | Day | Activity |
|------|-----|----------|
| 9 | Mon | Lecture 05a: Intermediate Representations |
| 9 | Wed | Lecture 05b: Control Flow Graphs |
| 9 | Fri | Recitation: Working with LLVM IR |
| 10 | Mon | Lecture 05c: SSA Form |
| 10 | Wed | Lecture 05d: SSA-Based Optimizations |
| 10 | Fri | HW5 due; Review session |
