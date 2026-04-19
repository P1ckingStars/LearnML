# Module 08: Memory Management & Runtime Systems

**Weeks 15--16** | Garbage Collection, Memory Safety, Runtime Environments

---

## Overview

Memory management is the bridge between the abstract world of programming languages and the physical reality of finite memory. Every language must answer a fundamental question: how is memory allocated, tracked, and reclaimed? The answers range from fully manual (C/C++) to fully automatic (garbage-collected languages like Java, Go, and OCaml) to novel type-system-based approaches (Rust).

This module covers the theory and practice of memory management: garbage collection algorithms from the foundational (mark-and-sweep, copying) to the modern (concurrent, generational, region-based); memory safety without garbage collection through ownership types and region inference; and the runtime system infrastructure that supports objects, dynamic dispatch, concurrency, and foreign function interfaces.

---

## Lectures

| Lecture | Title | Key Topics |
|---------|-------|------------|
| [Lecture 08a](lecture_08a_garbage_collection.md) | Garbage Collection Fundamentals | Reference counting, mark-and-sweep, copying collection, generational GC, write barriers |
| [Lecture 08b](lecture_08b_advanced_gc.md) | Advanced Garbage Collection | Concurrent GC, tricolor abstraction, real-time GC, Immix, modern Java GCs, escape analysis |
| [Lecture 08c](lecture_08c_memory_safety.md) | Memory Safety Without GC | Region-based management, Rust ownership/borrowing, affine/linear types, borrow checking |
| [Lecture 08d](lecture_08d_runtime_systems.md) | Runtime Systems | Object layout, vtables, dynamic dispatch, green threads, FFI, JIT support |

## Recitation

| Session | Title | Focus |
|---------|-------|-------|
| [Recitation 08](recitation_08_gc_implementation.md) | Implementing a GC | Mark-and-sweep collector, generational support, performance measurement, tuning |

## Homework

| Assignment | Title | Components |
|------------|-------|------------|
| [HW 08](hw08_memory_management.md) | Memory Management | Part A: Theory (GC algorithm traces, heap layout, ownership proofs). Part B: Implementation (mark-and-sweep + copying collector) |

---

## Learning Objectives

By the end of this module, students will be able to:

1. Implement mark-and-sweep and copying garbage collectors.
2. Explain the generational hypothesis and design a generational collector.
3. Describe the tricolor abstraction and how concurrent GC maintains correctness.
4. Formalize Rust's ownership and borrowing model and explain borrow checking.
5. Compare GC, ownership, and manual memory management along dimensions of safety, performance, and programmer burden.
6. Design runtime system components: object layouts, vtable dispatch, stack walking.

---

## Prerequisites

- Module 06: Code Generation (stack frames, calling conventions)
- Module 07: Program Analysis (dataflow analysis, alias analysis)
- Understanding of pointer semantics and heap allocation

---

## Key References

- McCarthy, J. (1960). "Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I." *Communications of the ACM*, 3(4).
- Cheney, C. J. (1970). "A Nonrecursive List Compacting Algorithm." *Communications of the ACM*, 13(11).
- Lieberman, H., & Hewitt, C. (1983). "A Real-Time Garbage Collector Based on the Lifetimes of Objects." *Communications of the ACM*, 26(6).
- Dijkstra, E. W., Lamport, L., Martin, A. J., Scholten, C. S., & Steffens, E. F. M. (1978). "On-the-Fly Garbage Collection: An Exercise in Cooperation." *Communications of the ACM*, 21(11).
- Tofte, M., & Talpin, J.-P. (1997). "Region-Based Memory Management." *Information and Computation*, 132(2).
- Jung, R., Jourdan, J.-H., Krebbers, R., & Dreyer, D. (2017). "RustBelt: Securing the Foundations of the Rust Programming Language." *POPL*.
- Jones, R., Hosking, A., & Moss, E. (2011). *The Garbage Collection Handbook*. CRC Press.
