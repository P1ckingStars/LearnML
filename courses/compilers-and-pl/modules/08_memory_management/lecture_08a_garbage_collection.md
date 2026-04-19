# Lecture 08a: Garbage Collection Fundamentals

## 1. Introduction

Garbage collection (GC) is the automatic reclamation of memory that is no longer reachable by the program. Introduced by McCarthy (1960) for Lisp, GC frees programmers from manual memory management and eliminates entire classes of bugs: use-after-free, double-free, and memory leaks. The cost is runtime overhead---GC must identify and reclaim garbage without disrupting program execution.

This lecture develops the fundamental GC algorithms: reference counting, mark-and-sweep, and copying collection, then introduces generational GC, which exploits empirical properties of object lifetimes for dramatically improved performance.

---

## 2. Stack vs Heap Allocation

### 2.1 Stack Allocation

Stack allocation is deterministic and fast: objects are allocated on function entry and deallocated on function return (LIFO discipline). Cost: $O(1)$ per allocation (just adjust the stack pointer).

**Limitations:**
- Objects cannot outlive the function that creates them.
- Object size must be known at compile time (in most languages).
- Cannot handle recursive or dynamic data structures.

### 2.2 Heap Allocation

Heap allocation supports objects with arbitrary lifetimes and sizes. The heap is a region of memory managed by a runtime allocator.

**Interface:**
```
allocate(size) -> pointer    // obtain memory
free(pointer)                // release memory (manual) or GC reclaims
```

**The problem:** determining *when* to free heap memory. Too early causes use-after-free; too late (or never) causes memory leaks. GC automates this decision.

### 2.3 Reachability

**Definition.** An object $o$ is *reachable* if there exists a chain of pointers from a *root* to $o$. Roots include:
- Stack variables (local variables and parameters in active stack frames).
- Global/static variables.
- CPU registers containing pointers.

An object is *garbage* if it is not reachable. GC reclaims garbage objects.

**Theorem 2.1 (Soundness of Reachability).** If an object is unreachable, the program can never access it again. Therefore, reclaiming unreachable objects is safe.

*Proof.* The program can only access memory through pointers. An access requires dereferencing a pointer, which must be obtained from a root or from another reachable object. An unreachable object has no path from any root, so no pointer to it can be obtained. $\square$

---

## 3. Reference Counting

### 3.1 Basic Algorithm

Each object maintains a *reference count*: the number of pointers pointing to it. When the count drops to zero, the object is garbage and can be freed.

```
Algorithm: Reference Counting

On pointer assignment p = q:
    If q != null: q.refcount++
    If p != null:
        p.refcount--
        If p.refcount == 0:
            For each pointer field f in p:
                Decrement(p.f)    // recursively decrement
            Free(p)
    p = q
```

### 3.2 Properties

**Advantages:**
- Incremental: work is distributed across pointer operations, no long pauses.
- Immediate reclamation: objects are freed as soon as they become garbage.
- Simple to implement for basic cases.
- Good locality: freed objects were recently accessed.

**Disadvantages:**
- **Overhead per pointer write**: every assignment requires count update(s). On a modern CPU, the atomic increment/decrement for concurrent programs is especially expensive (~10--100 cycles).
- **Space overhead**: each object needs a count field (typically 4--8 bytes).
- **Cannot collect cycles**: the fundamental limitation.

### 3.3 The Cycle Problem

**Theorem 3.1.** Basic reference counting cannot collect cyclic garbage.

*Proof.* Consider objects $A$ and $B$ with $A.next = B$ and $B.next = A$, and no external references. Both have refcount $= 1$ (from the other object). Neither refcount will ever reach zero through normal program operations, despite both being unreachable. $\square$

### 3.4 Cycle Detection

Several approaches address cycles:

**Trial deletion (Bobrow, 1980; Lins, 2008).** When a refcount is decremented but does not reach zero, the object is a *candidate* for being part of a cycle. A local mark-sweep traces from candidates to find and collect cycles.

```
Algorithm: TrialDeletion
1.  When refcount(o) decremented to > 0:
2.      Add o to candidate list (colored PURPLE)
3.  Periodically:
4.      For each candidate c:
5.          MarkGray(c):  // trial-decrement refcounts
6.              For each child of c:
7.                  child.refcount--
8.                  If child not already gray: MarkGray(child)
9.      For each candidate c:
10.         Scan(c):
11.             If c.refcount > 0:
12.                 ScanBlack(c)  // externally referenced, restore counts
13.             Else:
14.                 Color c WHITE  // garbage
15.     CollectWhite(candidates)  // free white objects
```

**Backup tracing collector.** Periodically run a full mark-sweep to catch cycles. Reference counting handles acyclic garbage; tracing handles cycles. This is the approach used by CPython.

### 3.5 Deferred Reference Counting (Deutsch & Bobrow, 1976)

Avoid updating reference counts for stack pointer operations (which are very frequent). Instead:
1. Only maintain reference counts for heap-to-heap pointers.
2. Periodically scan the stack to find objects referenced only from the stack (whose heap refcount is zero but are still reachable).

This eliminates most refcount update overhead at the cost of deferred collection.

---

## 4. Mark-and-Sweep

### 4.1 Algorithm

Mark-and-sweep (McCarthy, 1960) is the simplest tracing collector. It operates in two phases:

**Phase 1: Mark.** Starting from the roots, traverse all reachable objects and set a *mark bit*.

**Phase 2: Sweep.** Scan the entire heap. Free all unmarked objects; clear mark bits on marked objects.

```
Algorithm: MarkAndSweep

Phase 1: Mark
1.  worklist = all roots
2.  While worklist non-empty:
3.      obj = worklist.pop()
4.      If obj is not marked:
5.          Mark obj
6.          For each pointer field f in obj:
7.              If obj.f is not null and not marked:
8.                  worklist.push(obj.f)

Phase 2: Sweep
9.  For each object obj in heap (linear scan):
10.     If obj is marked:
11.         Unmark obj
12.     Else:
13.         Free(obj)     // add to free list
```

### 4.2 Complexity Analysis

**Theorem 4.1.** Mark-and-sweep runs in $O(R + H)$ time where $R$ is the number of reachable objects and $H$ is the total heap size.

*Proof.* The mark phase visits each reachable object exactly once: $O(R)$. The sweep phase scans every object on the heap: $O(H)$. Total: $O(R + H)$. $\square$

Note that the sweep phase cost is proportional to the entire heap, not just garbage. This is a significant disadvantage when most of the heap is live.

### 4.3 Space Requirements

- **Mark bit**: 1 bit per object (can be stored in the object header or in a separate bitmap).
- **Worklist**: $O(d)$ where $d$ is the maximum depth of the object graph. In the worst case (a linked list of length $R$), the stack depth is $O(R)$.

**Reducing stack depth:** Use pointer reversal (Schorr-Waite algorithm) to traverse the graph in $O(1)$ extra space, at the cost of more complex pointer manipulation.

### 4.4 Free List Management

After sweeping, free objects are organized into a *free list*. Allocation searches the free list for a sufficiently large block.

**Fragmentation problem:** Over time, the heap becomes fragmented---many small free blocks interspersed with live objects. This can cause allocation failures even when total free memory is sufficient.

**Mitigation:**
- **Best fit**: find the smallest free block that fits. Minimizes wasted space but is slow ($O(n)$ per allocation).
- **First fit**: use the first block that fits. Faster but may increase fragmentation.
- **Size classes**: maintain separate free lists for common object sizes (8, 16, 32, 64 bytes, etc.). Allocation is $O(1)$ within a size class.
- **Compaction**: periodically move live objects to eliminate fragmentation (see copying collection).

---

## 5. Copying Collection

### 5.1 Semispace Architecture

The heap is divided into two equal halves: *from-space* and *to-space*. Objects are allocated in from-space. When from-space is full, all live objects are copied to to-space, and the spaces are swapped.

### 5.2 Cheney's Algorithm (1970)

Cheney's algorithm performs the copy using a breadth-first traversal with no additional stack, using the to-space itself as the work queue.

```
Algorithm: CheneysCopyingGC

1.  scan = free = to_space_start
2.  // Copy roots
3.  For each root r:
4.      r = Forward(r)
5.  // Process to-space (BFS using scan pointer)
6.  While scan < free:
7.      obj = object at scan
8.      For each pointer field f in obj:
9.          obj.f = Forward(obj.f)
10.     scan = scan + sizeof(obj)
11. // Swap spaces
12. Swap(from_space, to_space)

Function Forward(p):
    If p is null: return null
    If p is in from_space:
        If p has a forwarding pointer:
            Return the forwarding pointer
        Else:
            Copy p to address 'free' in to_space
            Install forwarding pointer at p's old location
            free = free + sizeof(p)
            Return new address of p
    Else:
        Return p  // already in to-space
```

### 5.3 Properties

**Theorem 5.1.** Cheney's algorithm runs in $O(R)$ time and $O(1)$ extra space (beyond the semispace itself).

*Proof.* Each live object is copied exactly once (the forwarding pointer prevents re-copying). The scan pointer advances through to-space, visiting each copied object once. No auxiliary data structures are used; the BFS queue is implicit in the gap between `scan` and `free`. $\square$

**Advantages over mark-and-sweep:**
- Cost is $O(R)$, proportional only to live data (not total heap).
- Allocation is a simple bump pointer: $O(1)$.
- Compaction is automatic: live objects are packed contiguously.
- Improved cache locality: objects are laid out in BFS order.

**Disadvantages:**
- Requires twice the memory (only half the heap is usable at any time).
- All pointers must be updated (forwarding).
- Long-lived objects are repeatedly copied.

### 5.4 Allocation in Copying Collectors

Allocation is extremely fast:

```
allocate(size):
    If free + size > from_space_end:
        run_gc()
    ptr = free
    free = free + size
    Return ptr
```

This *bump-pointer allocation* is $O(1)$ with no free list management, no fragmentation, and excellent cache behavior.

---

## 6. Generational Garbage Collection

### 6.1 The Generational Hypothesis

**Empirical observation (Lieberman & Hewitt, 1983; Ungar, 1984):** Most objects die young. The distribution of object lifetimes is heavily skewed: a large fraction of objects become garbage shortly after allocation.

Quantitatively, studies across many languages and workloads show that 80--98% of objects die before the next GC cycle (for appropriately frequent collections).

### 6.2 Design

Divide the heap into *generations*, typically two:
- **Young generation (nursery)**: where new objects are allocated. Small, collected frequently.
- **Old generation (tenured)**: where long-lived objects reside. Large, collected infrequently.

Objects that survive a collection in the young generation are *promoted* (tenured) to the old generation.

### 6.3 Algorithm

```
Algorithm: GenerationalGC

Minor collection (young generation only):
1.  Roots for minor GC = program roots + remembered set
2.  Copy (or mark-sweep) the young generation
3.  Promote survivors to old generation
4.  Clear the young generation

Major collection (full heap):
5.  Run a full mark-sweep or copying collection on both generations
```

### 6.4 The Remembered Set Problem

When collecting the young generation, we need to know which old-generation objects point to young-generation objects (these are additional roots for the minor collection).

**The problem:** scanning the entire old generation to find such pointers would negate the benefit of generational collection.

**Solution:** maintain a *remembered set* of old-to-young pointers, updated at each pointer write.

### 6.5 Performance Analysis

Let $f$ be the fraction of young objects that survive (typically $f \approx 0.02$--$0.20$).

**Cost of minor GC:** $O(R_{\text{young}} \cdot f + |\text{remembered set}|)$

Since $f$ is small and the young generation is small, minor collections are fast (sub-millisecond for nurseries of a few MB).

**Amortized cost per allocation:** if the nursery has size $S$ and each minor GC processes $O(S \cdot f)$ live data:

$$\text{Cost per allocation} = \frac{O(S \cdot f)}{S / \text{avg\_object\_size}} = O(f \cdot \text{avg\_object\_size})$$

For $f = 0.05$ and 32-byte objects: about 1.6 bytes of GC work per allocation, comparable to `malloc` overhead.

---

## 7. GC Roots and Root Scanning

### 7.1 Identifying Roots

The GC must precisely identify all pointers in:
1. **Stack frames**: which words on the stack are pointers?
2. **Registers**: which registers hold pointers?
3. **Global variables**: which globals are pointers?

### 7.2 Stack Maps

The compiler generates *stack maps* (also called GC maps) at each potential GC safepoint, recording:
- Which stack slots contain pointers.
- Which registers contain pointers.

```
Safepoint at PC = 0x4012a0:
    Stack offsets with pointers: [RBP-8, RBP-24, RBP-40]
    Registers with pointers: [RBX, R12]
```

The GC consults these maps during root scanning.

### 7.3 Conservative vs Precise GC

**Conservative GC (Boehm-Demers-Weiser):**
- Treats any word on the stack that *looks like* a valid heap pointer as a root.
- No compiler support needed; works with unmodified C/C++ programs.
- **Drawback**: may retain garbage (false positives---an integer that happens to look like a pointer keeps an object alive). Cannot move objects (since it cannot update "pointers" that might be integers).

**Precise (exact) GC:**
- Uses stack maps to identify exactly which words are pointers.
- Requires compiler support.
- Can move objects (all pointers are known and can be updated).
- No false retention.

---

## 8. Write Barriers

### 8.1 Purpose

A *write barrier* is code executed on every pointer write to maintain GC invariants. Generational and concurrent collectors require write barriers.

### 8.2 Types

**Generational write barrier (for remembered set):**

```
write_barrier(obj, field, new_value):
    If obj is in old generation AND new_value is in young generation:
        remembered_set.add(obj)    // or add (obj, field)
    obj.field = new_value
```

**Card marking (coarse-grained):**

Divide the heap into fixed-size *cards* (e.g., 512 bytes). A card table is a byte array where `card_table[addr >> 9]` indicates whether the card is "dirty" (contains a pointer to the young generation).

```
write_barrier(addr, new_value):
    card_table[addr >> CARD_SHIFT] = DIRTY
    *addr = new_value
```

During minor GC, only dirty cards are scanned for old-to-young pointers.

**Cost:** card marking adds 1--2 instructions per pointer write. On x86-64:

```nasm
; Write barrier for card marking:
mov [addr], new_value         ; the actual write
shr rax, 9                     ; addr >> 9 (card index)
mov byte [card_table + rax], 0 ; mark card dirty
```

### 8.3 Overhead Analysis

Empirical studies show write barrier overhead of 1--5% of total execution time, depending on the application's pointer mutation rate. This is generally considered acceptable given the benefits of generational collection (which often reduces total GC time by 10x or more).

---

## 9. Comparison of Fundamental Algorithms

| Property | Reference Counting | Mark-and-Sweep | Copying (Cheney) | Generational |
|----------|-------------------|---------------|-------------------|-------------|
| Time complexity | $O(1)$ per write | $O(R + H)$ | $O(R)$ | $O(R_{\text{young}})$ amortized |
| Handles cycles | No (without backup) | Yes | Yes | Yes |
| Compaction | No | No (without compaction pass) | Yes | Yes (young gen) |
| Allocation cost | varies | Free list: $O(1)$--$O(n)$ | Bump pointer: $O(1)$ | Bump pointer: $O(1)$ |
| Pause time | Low (incremental) | $O(R + H)$ stop-the-world | $O(R)$ stop-the-world | Short (minor), Long (major) |
| Space overhead | Refcount per object | Mark bit per object | 2x heap | Remembered set |
| Best for | Short-lived acyclic structures | Simple implementation | Functional languages | General purpose |

---

## 10. Summary

Garbage collection transforms memory management from a manual, error-prone task into an automatic, provably safe one. The fundamental algorithms---reference counting, mark-and-sweep, and copying---each have distinct performance characteristics. Generational collection, built on the empirical observation that most objects die young, combines these approaches to achieve excellent amortized performance. Modern language runtimes (JVM, .NET, Go, OCaml) all use generational collection as their foundation, augmented by the concurrent and real-time techniques covered in the next lecture.

---

## References

1. McCarthy, J. (1960). "Recursive Functions of Symbolic Expressions and Their Computation by Machine, Part I." *Communications of the ACM*, 3(4), 184--195.
2. Cheney, C. J. (1970). "A Nonrecursive List Compacting Algorithm." *Communications of the ACM*, 13(11), 677--678.
3. Lieberman, H., & Hewitt, C. (1983). "A Real-Time Garbage Collector Based on the Lifetimes of Objects." *Communications of the ACM*, 26(6), 419--429.
4. Ungar, D. (1984). "Generation Scavenging: A Non-Disruptive High-Performance Storage Reclamation Algorithm." *SDE*, 157--167.
5. Deutsch, L. P., & Bobrow, D. G. (1976). "An Efficient, Incremental, Automatic Garbage Collector." *Communications of the ACM*, 19(9), 522--526.
6. Boehm, H.-J., & Weiser, M. (1988). "Garbage Collection in an Uncooperative Environment." *Software: Practice and Experience*, 18(9), 807--820.
7. Jones, R., Hosking, A., & Moss, E. (2011). *The Garbage Collection Handbook: The Art of Automatic Memory Management*. CRC Press.
8. Wilson, P. R. (1992). "Uniprocessor Garbage Collection Techniques." *IWMM*, 1--42.
