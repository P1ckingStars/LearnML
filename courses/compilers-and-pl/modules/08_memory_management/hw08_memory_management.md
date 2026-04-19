# HW8: Memory Management & Runtime Systems

**Due**: End of Week 16
**Total Points**: 100 (Part A: 50, Part B: 50)

---

## Part A: Theory (50 points)

### Problem 1: GC Algorithm Tracing (10 points)

Consider the following heap state where the root set is $\{r_1, r_2\}$:

```
r1 -> A -> B -> C
           ^    |
           |    v
r2 -> D -> E -> F -> G
```

**(a)** Trace mark-and-sweep on this heap. Which objects are collected?

**(b)** Now suppose $r_2$ is removed from the root set. Trace Cheney's copying collection. Show the state of from-space and to-space after collection, including forwarding pointers.

**(c)** Add a cycle: $G \to D$. Explain why reference counting fails to collect $\{D, E, F, G\}$ when $r_2$ is removed. Describe how trial deletion (cycle detection) would handle this.

### Problem 2: Generational GC Analysis (10 points)

**(a)** State the generational hypothesis. Explain why it motivates dividing the heap into generations.

**(b)** A young generation uses copying collection and an old generation uses mark-sweep. Write barriers track old-to-young pointers. Prove that the remembered set plus the root set forms a complete set of roots for a young-generation-only collection.

**(c)** Analyze the asymptotic cost of a nursery collection. Let $n$ be the nursery size and $s$ be the number of surviving objects. Show that the amortized cost per allocation is $O(s/n)$ when the nursery is collected upon filling.

### Problem 3: Ownership Types (10 points)

Consider a simplified ownership type system with the following rules:

$$\frac{\Gamma, x: \tau \vdash e : \sigma}{\Gamma \vdash \text{let } x = v \text{ in } e : \sigma} \quad (\text{x fresh, v consumed})$$

**(a)** Explain the difference between affine types (use at most once) and linear types (use exactly once). Which does Rust implement, and why?

**(b)** Given the Rust-like program below, identify which lines would fail the borrow checker and explain why:

```rust
let mut x = vec![1, 2, 3];
let y = &x;           // line 2
let z = &mut x;       // line 3
println!("{}", y[0]); // line 4
```

**(c)** Prove that in a system with the borrowing rules (one mutable XOR any number of shared references), data races are impossible in single-threaded execution.

### Problem 4: Region-Based Memory Management (10 points)

**(a)** In the Tofte-Talpin region system, explain what a region inference algorithm does. Give an example function and show how regions would be assigned.

**(b)** Consider:

```
let r1 = new_region() in
  let x = alloc(r1, 42) in
  let r2 = new_region() in
    let y = alloc(r2, x) in
    free_region(r2);
  deref(x)  (* Is this safe? *)
```

Argue whether this program is safe. What constraint must the region system enforce?

**(c)** Compare the expressiveness of region-based management vs Rust's ownership. Give an example that is easy in one but hard in the other.

### Problem 5: Object Layout and Dispatch (10 points)

**(a)** Given the class hierarchy:

```
class A { virtual void f(); virtual void g(); }
class B : A { void f() override; virtual void h(); }
class C : B { void g() override; void h() override; }
```

Draw the vtable for each class. Show the memory layout of an instance of `C`.

**(b)** Explain the diamond problem in C++ with virtual inheritance. Draw the object layout for:

```
class A { int x; virtual void f(); }
class B : virtual A { int y; }
class C : virtual A { int z; }
class D : B, C { int w; }
```

**(c)** Compare vtable dispatch cost with monomorphization (as in Rust generics). Analyze the time/space trade-offs.

---

## Part B: Implementation (50 points)

### Project: Garbage Collector Implementation

Implement two garbage collection algorithms for a simple runtime system.

**Language**: C, C++, or Rust (your choice)

#### Phase 1: Mark-and-Sweep Collector (25 points)

Implement a mark-and-sweep GC with:

1. **Heap management**: A contiguous heap with a free list allocator
2. **Object model**: Objects have a header (mark bit, size, type tag) and payload (fields that may be pointers)
3. **Root scanning**: Maintain an explicit root set (simulating stack scanning)
4. **Mark phase**: Recursive or iterative marking using a worklist
5. **Sweep phase**: Rebuild the free list from unmarked objects
6. **Coalescing**: Merge adjacent free blocks

Test with a program that:
- Allocates linked list nodes
- Creates and breaks cycles
- Triggers multiple GC cycles
- Verifies no live objects are collected (safety)
- Verifies all garbage is collected (completeness)

#### Phase 2: Copying Collector (25 points)

Implement Cheney's semi-space copying collector:

1. **Semi-spaces**: Two equal halves of the heap (from-space, to-space)
2. **Allocation**: Bump pointer in from-space
3. **Collection**: BFS copy using Cheney's scan pointer technique
4. **Forwarding**: Install forwarding pointers in from-space
5. **Pointer update**: Fix all references to point to to-space copies

Test with the same programs as Phase 1, plus:
- Measure fragmentation before/after collection
- Benchmark allocation throughput (allocations per second)
- Compare pause times between mark-sweep and copying

#### Deliverables

- Source code with clear comments
- Test suite demonstrating correctness
- Benchmark results comparing the two collectors
- Short writeup (~2 pages) analyzing:
  - Time complexity of each collector
  - Space overhead of each approach
  - When you would choose one over the other

#### Grading Rubric

| Component | Points |
|-----------|--------|
| Mark-and-sweep correctness | 12 |
| Mark-and-sweep edge cases (cycles, fragmentation) | 5 |
| Free list coalescing | 3 |
| Space management | 5 |
| Copying collector correctness | 12 |
| Copying collector forwarding pointers | 5 |
| Benchmarks and comparison | 5 |
| Writeup | 3 |

---

## References

- McCarthy, J. (1960). "Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I"
- Cheney, C. J. (1970). "A Nonrecursive List Compacting Algorithm"
- Wilson, P. R. (1992). "Uniprocessor Garbage Collection Techniques" (survey)
- Jones, R., Hosking, A., & Moss, E. (2011). *The Garbage Collection Handbook*
- Jung, R., et al. (2017). "RustBelt: Securing the Foundations of the Rust Programming Language"
