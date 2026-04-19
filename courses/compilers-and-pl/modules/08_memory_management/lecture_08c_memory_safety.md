# Lecture 08c: Memory Safety Without GC

## 1. Introduction

Memory safety---the guarantee that a program does not access memory in unintended ways---is one of the most critical properties in systems programming. Buffer overflows, use-after-free, double-free, and dangling pointer bugs account for the majority of security vulnerabilities in C and C++ codebases (estimated at 60--70% of CVEs in major software projects).

Garbage collection provides memory safety but at a cost: runtime overhead, unpredictable pauses, and inability to precisely control when resources are released. This lecture explores alternative approaches that achieve memory safety *without* GC, primarily through type systems and static analysis: region-based memory management, Rust's ownership and borrowing model, and the underlying theory of linear and affine type systems.

---

## 2. The Memory Safety Problem

### 2.1 Classes of Memory Errors

| Error | Description | Consequence |
|-------|-------------|-------------|
| Use-after-free | Accessing memory after it has been deallocated | Undefined behavior, code execution exploits |
| Double-free | Freeing the same memory twice | Heap corruption, exploits |
| Buffer overflow | Writing beyond allocated bounds | Stack smashing, code injection |
| Memory leak | Failing to free unreachable memory | Resource exhaustion |
| Dangling pointer | Pointer to freed memory | Same as use-after-free |
| Uninitialized read | Reading memory before writing | Information disclosure |

### 2.2 Formal Definition

**Definition (Memory Safety).** A program is *memory-safe* if every memory access satisfies:
1. **Spatial safety**: the access is within the bounds of the allocated region.
2. **Temporal safety**: the accessed memory is currently allocated (not freed or not yet allocated).

### 2.3 The Cost of Unsafety

Microsoft reports that ~70% of its security patches address memory safety bugs. Google's Project Zero found similar rates for Chrome (70%) and Android (65%). The estimated annual cost of memory unsafety in software is in the billions of dollars.

---

## 3. Region-Based Memory Management

### 3.1 Overview (Tofte & Talpin, 1994, 1997)

Region-based memory management allocates objects in *regions* (also called *arenas* or *zones*). All objects in a region are freed simultaneously when the region is deallocated. No per-object deallocation is needed.

### 3.2 Region Calculus

Tofte and Talpin formalized regions with a type-and-effect system. Each allocation is annotated with a region:

$$e \text{ at } \rho$$

means expression $e$ is allocated in region $\rho$. Regions have a stack discipline: they are created by `letregion` and destroyed when the scope exits.

```
letregion rho in
    let x = (1, 2) at rho in
    let y = (3, 4) at rho in
    fst x + fst y
end
// rho is deallocated here; x and y are freed
```

### 3.3 Region Inference

The compiler automatically infers region annotations using a type inference algorithm. The key typing rule:

$$\frac{\Gamma \vdash e : \tau \text{ with effect } \phi \quad \rho \notin \text{free}(\Gamma, \tau)}{\Gamma \vdash \text{letregion } \rho \text{ in } e : \tau \text{ with effect } \phi \setminus \{\rho\}}$$

The effect $\phi$ tracks which regions are accessed by $e$. A region $\rho$ can be deallocated (via `letregion`) only if it does not escape---i.e., $\rho$ does not appear in the type of the result.

### 3.4 Safety Theorem

**Theorem 3.1 (Tofte & Talpin, 1997).** If a program is well-typed in the region calculus, then:
1. No dangling pointer is ever dereferenced (temporal safety).
2. No region is accessed after deallocation.

*Proof sketch.* The type system ensures that the lifetime of every region $\rho$ contains all accesses to objects in $\rho$. The `letregion` rule's side condition ($\rho \notin \text{free}(\Gamma, \tau)$) guarantees that no reference to $\rho$ survives the deallocation point. By subject reduction (preservation), these properties are maintained throughout evaluation. $\square$

### 3.5 Practical Issues

**Pros:**
- Deterministic deallocation (no GC pauses).
- Bulk deallocation is fast ($O(1)$ per region).
- Good for server-style workloads (allocate per-request, free at end).

**Cons:**
- Region inference can produce excessively long-lived regions when lifetimes are hard to separate (the "region drift" problem).
- Objects with different lifetimes in the same region waste memory until the entire region is freed.
- Limited adoption: MLKit (ML with regions), Cyclone (safe C with regions).

### 3.6 Regions in Practice

- **Apache APR**: manual region-based allocation for HTTP request handling.
- **Zig**: `ArenaAllocator` provides region-style allocation.
- **Rust**: the `bumpalo` crate provides bump-allocated arenas.
- **Swift autorelease pools**: a form of region-based management for Objective-C objects.

---

## 4. Rust's Ownership and Borrowing Model

### 4.1 Overview

Rust achieves memory safety (and data-race freedom) through a compile-time *ownership* system. No GC is needed; memory is freed deterministically when the owner goes out of scope.

### 4.2 Ownership Rules

Rust enforces three fundamental rules:

1. **Each value has exactly one owner** (a variable binding).
2. **When the owner goes out of scope, the value is dropped** (memory is freed).
3. **Ownership can be transferred** (*moved*) but not duplicated (for non-`Copy` types).

```rust
fn main() {
    let s1 = String::from("hello");  // s1 owns the String
    let s2 = s1;                      // ownership moves to s2; s1 is invalid
    // println!("{}", s1);            // ERROR: s1 no longer valid
    println!("{}", s2);               // OK
}   // s2 goes out of scope; String is dropped (freed)
```

### 4.3 Borrowing

To use a value without taking ownership, Rust allows *borrowing* via references:

- **Shared reference** (`&T`): read-only access. Multiple shared references can coexist.
- **Mutable reference** (`&mut T`): read-write access. At most one mutable reference can exist at a time, and no shared references can coexist with it.

**The Borrowing Rules:**

$$\text{At any given time, either:}$$
$$\text{(a) One mutable reference } (\texttt{\&mut T}), \text{ or}$$
$$\text{(b) Any number of shared references } (\texttt{\&T})$$
$$\text{but not both.}$$

### 4.4 Lifetimes

Lifetimes ensure that references do not outlive the data they refer to. The compiler infers lifetimes in most cases; explicit annotations are sometimes required:

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
```

The lifetime parameter `'a` says: the returned reference is valid for at least as long as both input references are valid.

### 4.5 Formal Model

Rust's type system can be formalized as an *affine type system* with regions:

- **Affine types**: each value is used *at most once* (it can be dropped but not duplicated). This corresponds to ownership/move semantics.
- **Borrowing**: introduces *shared* and *unique* reference types with lifetime constraints.

The key typing judgments:

$$\frac{\Gamma, x : T \vdash e : U \quad x \notin \text{FV}(U)}{\Gamma \vdash \text{let } x = v \text{ in } e : U} \quad \text{(move, x consumed)}$$

$$\frac{\Gamma, x : \&'a T \vdash e : U \quad 'a \text{ outlives scope of } e}{\Gamma \vdash \text{let } x = \&v \text{ in } e : U} \quad \text{(borrow)}$$

---

## 5. Affine and Linear Type Systems for Memory

### 5.1 Substructural Type Systems

Standard type systems allow variables to be used any number of times (*contraction*) and to be unused (*weakening*). Substructural type systems restrict these:

| System | Contraction | Weakening | Usage |
|--------|------------|-----------|-------|
| Unrestricted | Yes | Yes | Use any number of times |
| Affine | No | Yes | Use *at most* once |
| Linear | No | No | Use *exactly* once |
| Relevant | Yes | No | Use *at least* once |

### 5.2 Linear Types

**Definition.** In a *linear type system*, every variable must be used exactly once.

**Typing rule (linear function application):**

$$\frac{\Gamma_1 \vdash f : A \multimap B \quad \Gamma_2 \vdash x : A \quad \Gamma_1 \cap \Gamma_2 = \emptyset}{\Gamma_1 \cup \Gamma_2 \vdash f\; x : B}$$

The context is split between $f$ and $x$, and each variable in $\Gamma_1 \cup \Gamma_2$ is used exactly once.

### 5.3 Application to Memory Management

Linear types are natural for modeling resources that must be used (consumed) exactly once:
- A linear `File` type ensures files are always closed.
- A linear `MemoryBlock` type ensures memory is always freed.
- A linear `Lock` type ensures locks are always released.

**Theorem 5.1 (Memory Safety via Linear Types).** If a memory allocation returns a linear value and deallocation consumes it, then in a well-typed program:
1. Every allocated block is eventually freed (no leaks).
2. No block is freed more than once (no double-free).
3. No block is used after being freed (no use-after-free).

*Proof.* By the linearity constraint, each allocation result is used exactly once. The only operation that consumes it is `free`. Therefore, every allocation is matched by exactly one `free`, and no reference to the block exists after `free` (since the value has been consumed). $\square$

### 5.4 Affine Types and Rust

Rust uses *affine* types (at most once) rather than linear types (exactly once). The difference: affine types allow *dropping* values without explicit use. This is important for ergonomics:

```rust
{
    let x = Box::new(42);
    // x is dropped here implicitly (affine: at most once)
    // No explicit free() needed
}
```

The `Drop` trait in Rust provides custom cleanup (destructor) that runs when an affine value is dropped.

---

## 6. Borrow Checking: Formal Model

### 6.1 The Non-Lexical Lifetimes (NLL) Model

Rust's borrow checker (since the NLL reform) associates each reference with a *region* (set of program points) where it is live. The checker verifies:

1. **No use after free**: every reference's region is contained within its referent's lifetime.
2. **Exclusive access for mutation**: at each program point, mutable and shared references do not overlap for the same memory location.

### 6.2 Constraint Generation

For each reference `r: &'a T`, the borrow checker generates *outlives* constraints:

$$'a : 'b \quad \text{("}\text{a outlives b")}$$

meaning every program point in region $'b$ is also in region $'a$.

At each borrow site `let r = &x`:
$$\text{lifetime}(x) : \text{lifetime}(r)$$

At each use of `r`:
$$\text{use\_point} \in \text{lifetime}(r)$$

### 6.3 Constraint Solving

The borrow checker computes the *minimum* lifetimes satisfying all constraints, using a fixed-point algorithm on the CFG:

```
Algorithm: BorrowCheck(cfg, constraints)
1.  Initialize: all regions = empty
2.  For each constraint 'a : 'b:
3.      region('a) = region('a) union region('b)
4.  Propagate through CFG (if 'a is live at point p, it must be live at
    all points on a path from p to a use of 'a)
5.  Check: for each mutable borrow 'a of location l:
6.      No other borrow 'b of l overlaps with 'a
7.  Check: for each borrow 'a of location l:
8.      l is not moved or freed during 'a
```

### 6.4 Soundness

**Theorem 6.1 (Informal).** If a Rust program passes the borrow checker, it is free of:
- Use-after-free
- Data races (on the single-threaded level; `Send`/`Sync` traits handle multi-threading)
- Double-free
- Dangling references

The formal proof of this is given by RustBelt (Jung et al., 2017), which provides a machine-checked soundness proof for a core calculus modeling Rust's type system, including unsafe code behind safe abstractions.

---

## 7. Comparison: GC vs Ownership vs Manual

### 7.1 Dimensions of Comparison

| Dimension | GC (Java, Go) | Ownership (Rust) | Manual (C, C++) |
|-----------|---------------|-------------------|-----------------|
| Memory safety | Yes | Yes (compile-time) | No |
| Data race freedom | No (separate mechanism) | Yes (type system) | No |
| Deterministic deallocation | No | Yes | Yes |
| Pause times | GC pauses | None | None |
| Runtime overhead | GC thread, write barriers | None | None |
| Compile-time overhead | Low | Higher (borrow checker) | Low |
| Programmer burden | Low | Medium (learning curve) | High (manual free) |
| Memory leaks | Possible (logical leaks) | Possible (`Rc` cycles) | Common |
| Performance ceiling | Lower (GC overhead) | Highest | Highest (when correct) |
| Expressiveness | Unrestricted aliasing | Restricted (borrowing rules) | Unrestricted |

### 7.2 When to Use Each

- **GC**: high-level applications, rapid development, programs where latency spikes are acceptable or mitigated by concurrent GC.
- **Ownership**: systems programming, embedded systems, latency-sensitive applications, security-critical code.
- **Manual**: legacy codebases, extreme performance requirements, interfacing with hardware. Increasingly replaced by Rust for new projects.

### 7.3 Hybrid Approaches

- **Rust with `Rc<T>` / `Arc<T>`**: reference counting for shared ownership. Cycles require `Weak<T>` or careful design.
- **Swift**: automatic reference counting (ARC) + cycle detection for class types.
- **C++ smart pointers**: `unique_ptr` (ownership), `shared_ptr` (reference counting), `weak_ptr` (cycle breaking). Not enforced by the type system (still possible to use raw pointers unsafely).

---

## 8. Beyond Rust: Related Systems

### 8.1 Cyclone (Jim et al., 2002)

A safe dialect of C with:
- Region-based memory management.
- Fat pointers for bounds checking.
- Never-null pointers.
- Tagged unions.

Cyclone demonstrated that C-like languages could be made safe with modest syntax changes, influencing Rust's design.

### 8.2 Vault and Sing# (DeLine & Fahndrich, 2001)

Microsoft Research's Vault language used *adoption and focus* to track aliasing:
- *Adoption*: transfer an object into a region.
- *Focus*: temporarily gain unique access to an adopted object.

Sing# applied these ideas to the Singularity OS, achieving memory safety for an entire operating system kernel.

### 8.3 Linear Haskell (Bernardy et al., 2018)

Linear Haskell extends Haskell's type system with linear types:

```haskell
f :: A %1 -> B   -- f uses its argument exactly once
```

This enables safe resource management (file handles, network connections) within a garbage-collected language, and enables optimizations (in-place mutation of linearly-held arrays).

---

## 9. Summary

Memory safety without garbage collection is achievable through type systems that track ownership and resource usage at compile time. The key theoretical tools are:
- **Region-based memory management**: deterministic bulk deallocation via scoped regions.
- **Affine/linear types**: restrict value usage to prevent aliasing violations.
- **Borrow checking**: enforces temporal and spatial safety through lifetime analysis.

Rust's success demonstrates that these ideas, once confined to academic type theory, can be made practical for large-scale systems programming. The borrow checker imposes a learning cost but provides strong guarantees---memory safety and data-race freedom---without any runtime overhead.

---

## References

1. Tofte, M., & Talpin, J.-P. (1997). "Region-Based Memory Management." *Information and Computation*, 132(2), 109--176.
2. Tofte, M., & Birkedal, L. (1998). "A Region Inference Algorithm." *ACM TOPLAS*, 20(4), 724--767.
3. Jung, R., Jourdan, J.-H., Krebbers, R., & Dreyer, D. (2017). "RustBelt: Securing the Foundations of the Rust Programming Language." *POPL*, 66:1--66:34.
4. Weiss, A., Patterson, D., Matsakis, N. D., & Ahmed, A. (2019). "Oxide: The Essence of Rust." *arXiv preprint arXiv:1903.00982*.
5. Jim, T., Morrisett, J. G., Grossman, D., Hicks, M. W., Cheney, J., & Wang, Y. (2002). "Cyclone: A Safe Dialect of C." *USENIX ATC*, 275--288.
6. Walker, D. (2005). "Substructural Type Systems." In *Advanced Topics in Types and Programming Languages*, MIT Press, Chapter 1.
7. Bernardy, J.-P., Boespflug, M., Newton, R. R., Peyton Jones, S., & Spiwack, A. (2018). "Linear Haskell: Practical Linearity in a Higher-Order Polymorphic Language." *POPL*, 5:1--5:29.
8. Swamy, N., et al. (2016). "Dependent Types and Multi-Monadic Effects in F*." *POPL*, 256--270.
