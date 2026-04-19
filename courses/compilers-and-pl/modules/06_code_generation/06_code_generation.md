# Module 06: Code Generation

**Weeks 11--12** | Instruction Selection, Register Allocation, Calling Conventions, Target Architectures

---

## Overview

Code generation is the final major phase of a compiler, transforming an intermediate representation (IR) into executable machine code for a specific target architecture. This module covers the fundamental algorithms and engineering decisions involved: how to select instructions that best exploit the target ISA, how to map an unbounded set of virtual registers onto a finite physical register file, how calling conventions and runtime organization shape the generated code, and how different target architectures influence the entire code generation pipeline.

The problems encountered here are among the most computationally challenging in compilation. Register allocation is NP-complete in general, instruction selection involves combinatorial pattern matching, and calling conventions require precise adherence to platform ABIs. Despite this, practical algorithms---graph coloring heuristics, linear scan allocation, tree pattern matching---produce excellent code in reasonable time.

---

## Lectures

| Lecture | Title | Key Topics |
|---------|-------|------------|
| [Lecture 06a](lecture_06a_instruction_selection.md) | Instruction Selection | Tree pattern matching, maximal munch, dynamic programming (Aho-Johnson), BURG, peephole optimization, superoptimization |
| [Lecture 06b](lecture_06b_register_allocation.md) | Register Allocation | Graph coloring, Chaitin's algorithm, Briggs' optimistic coloring, iterated register coalescing, linear scan, SSA-based allocation, spilling |
| [Lecture 06c](lecture_06c_calling_conventions_runtime.md) | Calling Conventions & Runtime Organization | Stack frames, cdecl, System V AMD64 ABI, closures, exception handling, coroutines |
| [Lecture 06d](lecture_06d_target_architectures.md) | Target Architectures | x86-64, ARM64, RISC-V, WebAssembly, GPU targets, cross-compilation |

## Recitation

| Session | Title | Focus |
|---------|-------|-------|
| [Recitation 06](recitation_06_codegen.md) | Code Generation Workshop | IR to x86-64 translation, register allocation by hand, stack frame layout, debugging assembly |

## Homework

| Assignment | Title | Components |
|------------|-------|------------|
| [HW 06](hw06_code_generation.md) | Code Generation | Part A: Theory (interference graphs, graph coloring, instruction selection). Part B: Implementation (IR to x86-64 code generator with register allocator) |

---

## Learning Objectives

By the end of this module, students will be able to:

1. Implement instruction selection using tree pattern matching and the maximal munch algorithm.
2. Construct interference graphs from liveness information and apply graph coloring for register allocation.
3. Explain why register allocation is NP-complete and evaluate practical heuristics.
4. Design stack frame layouts conforming to standard calling conventions.
5. Implement a complete code generator targeting x86-64 from a three-address IR.
6. Compare instruction selection and register allocation strategies across RISC and CISC architectures.

---

## Prerequisites

- Module 05: Intermediate Representations (three-address code, SSA form, control flow graphs)
- Familiarity with at least one assembly language (x86-64 preferred)
- Graph theory fundamentals (coloring, interference, NP-completeness)

---

## Key References

- Aho, A. V., Ganapathi, M., & Tjiang, S. W. K. (1989). "Code Generation Using Tree Matching and Dynamic Programming." *ACM TOPLAS*, 11(4).
- Chaitin, G. J. et al. (1981). "Register Allocation via Coloring." *Computer Languages*, 6(1).
- Briggs, P., Cooper, K., & Torczon, L. (1994). "Improvements to Graph Coloring Register Allocation." *ACM TOPLAS*, 16(3).
- Appel, A. W. (2004). *Modern Compiler Implementation in ML/Java/C*. Cambridge University Press.
- Muchnick, S. S. (1997). *Advanced Compiler Design and Implementation*. Morgan Kaufmann.
