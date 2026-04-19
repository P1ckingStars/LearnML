# Module 09: Programming Language Paradigms

**Weeks 17--18** | Functional, Logic, Concurrent, and Object-Oriented Programming

---

## Overview

This module surveys the major programming language paradigms, examining their theoretical foundations, implementation strategies, and the trade-offs each paradigm presents. We move from the lambda calculus roots of functional programming through object-oriented type systems, concurrency models, and logic programming, arriving at domain-specific language design. The emphasis throughout is on how paradigm choices affect both language semantics and compiler/runtime implementation.

---

## Lectures

| Lecture | Title | Topics |
|---------|-------|--------|
| [Lecture 09a](lecture_09a_functional_programming.md) | Functional Programming Languages | Referential transparency, lazy vs strict evaluation, algebraic data types, monads and monad transformers, CPS, defunctionalization, STG machine |
| [Lecture 09b](lecture_09b_oop_type_systems.md) | Object-Oriented Languages & Advanced Type Systems | Classes, inheritance, vtables, multiple inheritance, mixins/traits, generics, variance, type erasure vs reification, existential types, GADTs |
| [Lecture 09c](lecture_09c_concurrency_models.md) | Concurrency & Parallelism in PLs | Threads, locks, memory models, lock-free structures, actors, CSP, pi-calculus, STM, async/await, data parallelism, session types |
| [Lecture 09d](lecture_09d_logic_dsl.md) | Logic Programming & Domain-Specific Languages | Unification, resolution, Prolog, constraint logic programming, Datalog, DSL design, macro systems, metaprogramming |

## Recitation

| Session | Title | Activities |
|---------|-------|------------|
| [Recitation 09](recitation_09_paradigms.md) | Multi-Paradigm Programming | Implementing monads, actor-based concurrency, mini Prolog interpreter, DSL design |

## Homework

| Assignment | Title | Components |
|------------|-------|------------|
| [HW 09](hw09_pl_paradigms.md) | PL Paradigms | Part A: Theory (monad laws, CPS transforms, session types, Datalog). Part B: Implementation (mini Prolog or monad library) |

---

## Learning Objectives

By the end of this module, students will be able to:

1. Formally state and verify the monad laws; apply monadic abstractions to structure effectful computation.
2. Perform CPS transformations and defunctionalization on higher-order programs.
3. Explain vtable layout, virtual dispatch, and the implementation challenges of multiple inheritance.
4. Analyze variance in generic type systems and distinguish type erasure from reification.
5. Compare shared-memory and message-passing concurrency models; derive session types for simple protocols.
6. Implement unification and resolution for a fragment of logic programming.
7. Design and implement a small domain-specific language, choosing between embedded and standalone approaches.

---

## Key References

- Wadler, P. (1992). "Monads for functional programming."
- Peyton Jones, S. (1992). "Implementing lazy functional languages on stock hardware: the Spineless Tagless G-machine."
- Cardelli, L. (1984). "A semantics of multiple inheritance."
- Wadler, P. & Blott, S. (1989). "How to make ad-hoc polymorphism less ad hoc."
- Hoare, C. A. R. (1978). "Communicating sequential processes."
- Milner, R. (1999). *Communicating and Mobile Systems: the Pi-Calculus.*
- Robinson, J. A. (1965). "A machine-oriented logic based on the resolution principle."
- Kowalski, R. (1974). "Predicate logic as a programming language."
