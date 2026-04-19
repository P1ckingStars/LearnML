# Lecture 08b: Advanced Garbage Collection

## 1. Introduction

The fundamental collectors (mark-and-sweep, copying, generational) all share a critical limitation: they require *stop-the-world* pauses during which the application cannot execute. For interactive applications, servers, and real-time systems, these pauses are unacceptable. This lecture develops techniques for reducing or eliminating GC pauses: concurrent collection, incremental collection, and real-time GC. We also survey modern production collectors and the role of escape analysis in reducing GC pressure.

---

## 2. The Tricolor Abstraction

### 2.1 Definition

The *tricolor abstraction* (Dijkstra et al., 1978) provides a unified framework for reasoning about concurrent and incremental GC. During collection, every object is one of three colors:

- **White**: not yet visited. At the end of marking, white objects are garbage.
- **Gray**: visited but not fully scanned (some children may be unvisited).
- **Black**: visited and fully scanned (all children are gray or black).

### 2.2 Invariants

**The Tricolor Invariant:** No black object points directly to a white object.

If this invariant holds when marking terminates (no gray objects remain), then all reachable objects are black and all white objects are garbage.

**Theorem 2.1 (Correctness of Tricolor Marking).** If marking begins with all roots gray and all other objects white, and the tricolor invariant is maintained throughout, then upon termination (no gray objects), the set of white objects is exactly the garbage.

*Proof.* We show that every reachable object is black at termination.

Base case: roots are initially gray, hence visited.

Inductive step: if a reachable object $o$ is black, all of $o$'s children are gray or black (by the invariant). Since marking processes all gray objects, every gray object eventually becomes black. By induction along the reachability chain from roots, every reachable object is eventually black.

Conversely, white objects have no path from any root (otherwise, a black-to-white pointer would exist somewhere on the path, violating the invariant). $\square$

### 2.3 The Problem with Concurrency

When the mutator (application) runs concurrently with the GC, it can violate the tricolor invariant by:
1. Writing a pointer from a black object to a white object (creating a black-to-white edge).
2. Removing the only gray-to-white path (making the white object unreachable from any gray object).

Both conditions must hold simultaneously for an object to be *lost* (incorrectly collected):

**Theorem 2.2 (Wilson, 1992).** A concurrent collector incorrectly collects a live object only if both:
(a) The mutator stores a pointer to a white object in a black object.
(b) All other paths from gray objects to the white object are destroyed before the collector traces them.

### 2.4 Solutions: Write Barriers for Concurrent GC

**Dijkstra's barrier (snapshot-at-beginning):** When the mutator writes a pointer field, shade the *new* referent gray (ensure it will be scanned).

```
dijkstra_write_barrier(obj, field, new_value):
    If new_value is white:
        Color new_value gray
        Add new_value to gray worklist
    obj.field = new_value
```

This prevents condition (a): no black object can point to a white object because any newly referenced white object is immediately grayed.

**Steele's barrier:** When a black object's field is written, revert the object to gray.

```
steele_write_barrier(obj, field, new_value):
    obj.field = new_value
    If obj is black:
        Color obj gray
        Add obj to gray worklist
```

**Yuasa's barrier (snapshot-at-beginning with deletion):** When a pointer is overwritten, shade the *old* referent gray (preserve the snapshot).

```
yuasa_write_barrier(obj, field, new_value):
    old_value = obj.field
    If old_value is white:
        Color old_value gray
        Add old_value to gray worklist
    obj.field = new_value
```

This prevents condition (b): even if the mutator removes a pointer, the old referent is preserved for scanning.

---

## 3. Concurrent Garbage Collection

### 3.1 Architecture

A concurrent GC runs simultaneously with the mutator on separate threads/cores. The typical structure:

1. **Initial pause (brief)**: scan roots, shade them gray.
2. **Concurrent marking**: GC thread(s) trace the object graph while the mutator runs, using a write barrier to maintain the tricolor invariant.
3. **Remark pause (brief)**: stop the mutator briefly to process objects modified during concurrent marking.
4. **Concurrent sweeping/compaction**: reclaim garbage while the mutator runs.

### 3.2 Correctness Argument

**Theorem 3.1.** A concurrent mark-and-sweep collector with Dijkstra's write barrier correctly identifies all garbage (no live objects are collected).

*Proof.* The write barrier ensures that every white object that receives a pointer from a black object is immediately grayed. Therefore, the tricolor invariant is maintained. By Theorem 2.1, all reachable objects are black at termination. The remark phase catches any mutations during the final moments of marking. $\square$

**Caveat:** concurrent GC may exhibit *floating garbage*---objects that become unreachable during the current collection cycle but are not identified until the next cycle (because they were already gray/black when they became garbage). This is safe (no dangling pointers) but wastes some memory.

### 3.3 Concurrent Sweeping

Sweeping can also be concurrent: the sweep thread scans the heap and frees unmarked objects while the mutator runs. The allocator must coordinate with the sweep thread to avoid allocating from regions not yet swept.

---

## 4. Incremental Garbage Collection

### 4.1 Concept

Incremental GC interleaves small units of GC work with mutator execution on the same thread, bounding the pause time per increment.

**Structure:**
```
While program is running:
    Execute mutator for T_mutator time
    Execute GC for T_gc time (one increment)
    // T_gc << T_mutator to maintain responsiveness
```

### 4.2 Read Barriers vs Write Barriers

Incremental collectors can use *read barriers* (Baker, 1978): when the mutator reads a pointer to a white object, the object is immediately copied/grayed.

```
baker_read_barrier(ptr):
    If ptr is in from-space:
        ptr = Forward(ptr)    // copy to to-space
    Return ptr
```

This is more expensive per read than a write barrier but guarantees that the mutator never sees white objects.

### 4.3 Bounds on Pause Time

With careful scheduling, incremental GC can bound pause times to a few hundred microseconds. The tradeoff is increased total GC time (due to barrier overhead and repeated scanning of mutated objects).

---

## 5. Real-Time GC Constraints

### 5.1 Requirements

A *real-time* GC provides hard or soft guarantees on pause times:
- **Hard real-time**: maximum pause time is bounded (e.g., < 1 ms). GC must never exceed this bound.
- **Soft real-time**: pause times are usually bounded but occasional violations are tolerated.

### 5.2 Design Principles

1. **Incremental or concurrent**: never perform a full stop-the-world collection.
2. **Bounded work per allocation**: each allocation performs a bounded amount of GC work, amortizing collection over allocations.
3. **Memory reservation**: ensure the GC can always complete before memory is exhausted.

**Scheduling constraint.** Let $A$ be the allocation rate, $G$ be the garbage generation rate, and $C$ be the GC processing rate. For the GC to keep up:

$$C > A \cdot \frac{R}{R + G} \cdot k$$

where $R$ is live data, $G$ is garbage per cycle, and $k$ is a constant depending on the GC algorithm (e.g., $k = 2$ for copying).

### 5.3 Metronome (Bacon et al., 2003)

The Metronome GC provides hard real-time guarantees for Java:
- Uses incremental mark-sweep with defragmentation.
- GC work is scheduled in fixed-size time quanta.
- Memory utilization guarantees: at most $2 \times$ the live data is needed.

---

## 6. Immix: Mark-Region Collection

### 6.1 Overview

Immix (Blackburn & McKinley, 2008) is a *mark-region* collector that combines the best features of mark-and-sweep (no copying overhead for long-lived data) and copying (bump-pointer allocation, compaction).

### 6.2 Design

The heap is divided into coarse-grained *blocks* (e.g., 32 KB) and fine-grained *lines* (e.g., 128 bytes).

- **Allocation**: bump pointer within a block, along unmarked lines.
- **Collection**: mark objects, then reclaim entire unmarked lines and blocks. No object copying in the common case.
- **Defragmentation (opportunistic)**: when fragmentation is detected, selectively copy objects from fragmented blocks to compact them. This is triggered only when necessary.

### 6.3 Performance

Immix achieves:
- Fast allocation (bump pointer): comparable to a copying collector.
- Low fragmentation: line-granularity recycling reduces fragmentation vs mark-and-sweep.
- Low copying overhead: most collections do not copy; only fragmented blocks trigger copying.
- Excellent mutator locality: objects allocated sequentially are physically adjacent.

**Empirical results (Blackburn & McKinley, 2008):** Immix is 5--15% faster than generational copying and 10--25% faster than mark-sweep on standard benchmarks.

---

## 7. Modern Java GC Overview

### 7.1 G1 (Garbage First)

G1 (Detlefs et al., 2004) is the default Java GC since JDK 9:
- **Region-based**: heap is divided into equal-sized regions (1--32 MB).
- **Generational**: regions are classified as eden, survivor, or old.
- **Incremental compaction**: G1 selectively evacuates (copies) regions with the most garbage ("garbage first" selection heuristic).
- **Concurrent marking**: identifies garbage concurrently with the mutator.
- **Pause time target**: G1 attempts to meet a user-specified pause time target (e.g., 200 ms) by adjusting the number of regions collected.

### 7.2 ZGC

ZGC (Liden & Karlsson, 2018) targets ultra-low latency:
- **Sub-millisecond pauses**: typically < 1 ms, regardless of heap size (up to 16 TB).
- **Concurrent everything**: marking, relocation, and reference processing are all concurrent.
- **Colored pointers**: uses unused bits in 64-bit pointers to store GC metadata (marked, remapped, etc.). This enables *load barriers* instead of store barriers.
- **Multi-mapped memory**: the same physical memory is mapped at multiple virtual addresses, one per pointer color.

### 7.3 Shenandoah

Shenandoah (Flood et al., 2016) is another low-pause Java GC:
- **Concurrent compaction**: moves objects while the mutator runs, using *Brooks forwarding pointers* (an indirection pointer in each object header).
- **Pause times**: typically < 10 ms.
- **No generational design** (originally; generational mode added later).

### 7.4 Comparison

| GC | Typical Pause | Throughput | Heap Overhead | Concurrent |
|----|--------------|------------|---------------|------------|
| G1 | 50--200 ms | High | Moderate (region metadata) | Marking + partial compaction |
| ZGC | < 1 ms | Good | Higher (colored pointers) | Everything |
| Shenandoah | < 10 ms | Good | Brooks pointers (1 word/object) | Everything |
| Parallel GC | 100 ms -- seconds | Highest | Low | Nothing (stop-the-world) |

---

## 8. GC for Functional Languages

### 8.1 Allocation Patterns

Functional languages (ML, Haskell, OCaml) allocate heavily (often > 1 GB/sec) due to:
- Immutable data structures (every "update" creates a new object).
- Closures (each lambda creates a heap object).
- Boxing of values.

The generational hypothesis holds strongly: most of these objects are very short-lived.

### 8.2 OCaml's GC

OCaml uses a generational collector:
- **Minor heap (nursery)**: small (256 KB -- 1 MB), collected by copying (Cheney-style). Very fast due to high death rate.
- **Major heap**: collected by incremental mark-and-sweep.
- **Write barrier**: card marking for old-to-young pointers.
- **Compaction**: optional, run when fragmentation is high.

**Performance characteristic:** minor collections take < 1 ms; major collections are interleaved with mutator execution.

### 8.3 GHC (Haskell) GC

GHC uses a generational copying collector with:
- **Multiple generations** (typically 2, configurable).
- **Parallel collection**: multi-threaded GC using work-stealing.
- **Pinned objects**: some objects (e.g., foreign-allocated) cannot be moved; these are handled specially.
- **Thunk evaluation**: lazy evaluation creates thunks that are short-lived, fitting the generational hypothesis well.

---

## 9. Escape Analysis and Stack Allocation

### 9.1 Concept

*Escape analysis* determines whether an object's lifetime is bounded by the allocating function's scope. If an object does *not escape*---it is not stored in a global, not returned, and not passed to a function that might retain it---it can be allocated on the stack instead of the heap.

### 9.2 Formal Definition

**Definition.** An object $o$ allocated in function $f$ *escapes* if:
1. $o$ is returned from $f$.
2. $o$ is stored in a global variable or a field of an object that escapes.
3. $o$ is passed as an argument to a function that may retain it.

### 9.3 Analysis

Escape analysis is typically formulated as an interprocedural dataflow analysis. For each allocation site, determine if the allocated object can escape the allocating function or thread.

```
Algorithm: EscapeAnalysis(function f)
For each allocation site a in f:
    Create abstract object o_a
    Track o_a through:
        - Assignments (pt analysis)
        - Return statements (escapes to caller)
        - Stores to fields of escaping objects (transitive escape)
        - Arguments to callees (check callee's summary)
    If o_a does not escape:
        Mark a for stack allocation
```

### 9.4 Impact

**Java (HotSpot JIT):** escape analysis enables scalar replacement (decompose the object into individual fields in registers) and stack allocation, eliminating GC pressure entirely for non-escaping objects. Studies show 5--20% of allocations can be eliminated in typical Java programs.

**Go:** the Go compiler performs escape analysis at compile time, allocating non-escaping objects on the stack. The `go build -gcflags='-m'` flag reports escape analysis decisions.

### 9.5 Connection to GC

Escape analysis is synergistic with GC:
- Objects that do not escape never become heap garbage, reducing GC frequency.
- Stack-allocated objects are automatically "freed" on function return, with zero GC overhead.
- Even partial escape analysis (handling simple cases) can significantly reduce GC pressure in allocation-heavy programs.

---

## 10. Summary

| Technique | Key Innovation | Pause Characteristic |
|-----------|---------------|---------------------|
| Tricolor marking | Unified framework for concurrent/incremental GC | Enables concurrent tracing |
| Concurrent GC | GC runs on separate thread(s) | Brief remark pauses only |
| Incremental GC | GC work interleaved with mutator | Bounded pause per increment |
| Real-time GC | Hard bounds on pause time | Guaranteed sub-ms pauses |
| Immix | Mark-region with opportunistic copying | Stop-the-world but fast |
| G1 | Region-based with pause time targets | Configurable pause target |
| ZGC | Colored pointers, concurrent compaction | Sub-ms pauses at any heap size |
| Escape analysis | Avoid heap allocation entirely | No GC needed for escaped objects |

The evolution of GC technology has been driven by the tension between throughput (total time spent in GC) and latency (maximum pause time). Modern concurrent collectors like ZGC demonstrate that sub-millisecond pauses are achievable even for multi-terabyte heaps, finally putting to rest the argument that GC is incompatible with low-latency systems.

---

## References

1. Dijkstra, E. W., Lamport, L., Martin, A. J., Scholten, C. S., & Steffens, E. F. M. (1978). "On-the-Fly Garbage Collection: An Exercise in Cooperation." *Communications of the ACM*, 21(11), 966--975.
2. Baker, H. G. (1978). "List Processing in Real Time on a Serial Computer." *Communications of the ACM*, 21(4), 280--294.
3. Blackburn, S. M., & McKinley, K. S. (2008). "Immix: A Mark-Region Garbage Collector with Space Efficiency, Fast Collection, and Mutator Performance." *PLDI*, 22--32.
4. Detlefs, D., Flood, C., Heller, S., & Printezis, T. (2004). "Garbage-First Garbage Collection." *ISMM*, 37--48.
5. Bacon, D. F., Cheng, P., & Rajan, V. T. (2003). "A Real-Time Garbage Collector with Low Overhead and Consistent Utilization." *POPL*, 285--298.
6. Liden, P., & Karlsson, S. (2018). "ZGC: A Scalable Low-Latency Garbage Collector." Oracle Technical Report.
7. Cheng, P., & Blelloch, G. (2001). "A Parallel, Real-Time Garbage Collector." *PLDI*, 125--136.
8. Jones, R., Hosking, A., & Moss, E. (2011). *The Garbage Collection Handbook*. CRC Press. Chapters 15--18.
