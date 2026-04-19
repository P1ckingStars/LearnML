# Module 10: Frontier Topics

**Weeks 19--20** | JIT Compilation, Verified Compilers, ML for Compilers, Language Design

---

## Overview

This module explores the cutting edge of compiler and programming language research. We examine how just-in-time compilation bridges interpretation and ahead-of-time compilation, how formal verification can guarantee compiler correctness, how machine learning is transforming compiler optimization, and where programming language design is heading. These topics represent active research areas with significant open problems.

---

## Lectures

| Lecture | Title | Topics |
|---------|-------|--------|
| [Lecture 10a](lecture_10a_jit_compilation.md) | Just-In-Time Compilation | Tracing JITs, method JITs, tiered compilation, OSR, deoptimization, inline caches, hidden classes |
| [Lecture 10b](lecture_10b_verified_compilers.md) | Verified & Correct Compilers | CompCert, simulation relations, translation validation, Alive2, CakeML, proof-carrying code |
| [Lecture 10c](lecture_10c_ml_for_compilers.md) | Machine Learning for Compilers | ML for scheduling, register allocation, MLGO, autotuning, TVM, neural program synthesis, LLMs for code |
| [Lecture 10d](lecture_10d_language_design_frontiers.md) | Language Design Frontiers | Algebraic effects, capabilities, gradual typing, dependent types, quantum/differentiable/probabilistic PLs |

## Recitation

| Session | Title | Activities |
|---------|-------|------------|
| [Recitation 10](recitation_10_frontier.md) | Exploring Frontiers | Effect handlers in Koka/Eff, verified optimizations, ML-guided LLVM, PL research survey |

## Homework

| Assignment | Title | Components |
|------------|-------|------------|
| [HW 10](hw10_frontiers.md) | Frontier Topics | Part A: Paper review (2 recent papers). Part B: Implementation (mini tracing JIT, translation validation, or DSL with effect handlers) |

---

## Learning Objectives

By the end of this module, students will be able to:

1. Explain the design space of JIT compilers, including tracing vs. method compilation, tiered compilation, and speculative optimization.
2. Formalize compiler correctness via simulation relations and state the key theorems of CompCert and CakeML.
3. Describe how machine learning is applied to compiler optimization decisions and evaluate the strengths and limitations of this approach.
4. Analyze emerging PL features -- algebraic effects, dependent types, gradual typing -- and their theoretical foundations.
5. Critically read and evaluate recent research papers from top PL/compiler venues (PLDI, POPL, OOPSLA, ASPLOS, CGO).

---

## Key References

- Holzle, U., Chambers, C., & Ungar, D. (1991). "Optimizing dynamically-typed object-oriented languages with polymorphic inline caches."
- Gal, A., et al. (2009). "Trace-based just-in-time type specialization for dynamic languages." (TraceMonkey)
- Wurthinger, T., et al. (2017). "Practical partial evaluation for high-performance dynamic language runtimes." (GraalVM/Truffle)
- Leroy, X. (2009). "A formally verified compiler back-end." (CompCert)
- Lopes, N. P., et al. (2021). "Alive2: Bounded translation validation for LLVM."
- Kumar, R., et al. (2014). "CakeML: A verified implementation of ML."
- Trofin, M., et al. (2021). "MLGO: A machine learning guided compiler optimization framework."
- Chen, T., et al. (2018). "TVM: An automated end-to-end optimizing compiler for deep learning."
- Plotkin, G. & Pretnar, M. (2009). "Handlers of algebraic effects."
- Brady, E. (2013). "Idris, a general-purpose dependently typed programming language."
