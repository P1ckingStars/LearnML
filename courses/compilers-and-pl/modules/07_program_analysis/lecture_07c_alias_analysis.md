# Lecture 07c: Alias Analysis & Pointer Analysis

## 1. Introduction

Alias analysis determines whether two pointer expressions can refer to the same memory location. This information is critical for almost every compiler optimization: without it, the compiler must conservatively assume that any two pointers might alias, crippling code motion, dead store elimination, register promotion, and parallelization.

This lecture develops the theory and practice of alias and pointer analysis, from the foundational hardness results through the two dominant algorithmic approaches (Andersen's inclusion-based and Steensgaard's unification-based), to modern refinements and practical implementations.

---

## 2. Why Alias Analysis Is Hard

### 2.1 The Fundamental Limitation

**Theorem 2.1 (Rice's Theorem Connection).** Determining whether two pointers must alias at a given program point is undecidable in general.

*Proof sketch.* Alias analysis, in its exact form, requires determining the set of memory locations a pointer can reference at runtime. This is equivalent to determining a non-trivial semantic property of the program. By Rice's theorem, all non-trivial semantic properties of Turing-complete programs are undecidable. $\square$

**Practical consequence.** All alias analyses are *approximations*:
- **May-alias**: overapproximation---reports all pairs that *could* alias, plus possibly some that cannot. Sound for most optimizations (which need to know "could these alias?").
- **Must-alias**: underapproximation---reports only pairs guaranteed to alias. Useful for specific optimizations like store forwarding.

### 2.2 Dimensions of Precision

Alias analyses vary along several axes:

| Dimension | Less Precise | More Precise |
|-----------|-------------|-------------|
| Flow sensitivity | Flow-insensitive (one result for entire program) | Flow-sensitive (result per program point) |
| Context sensitivity | Context-insensitive (one result per function) | Context-sensitive (result per call context) |
| Field sensitivity | Field-insensitive (struct = one object) | Field-sensitive (each field separate) |
| Heap modeling | Allocation-site-insensitive | Allocation-site-sensitive, recency |
| Path sensitivity | Path-insensitive | Path-sensitive (track branch conditions) |

Greater precision generally means greater cost. The art is finding the sweet spot for practical compilation.

---

## 3. Points-To Analysis Foundations

### 3.1 Points-To Sets

**Definition.** A *points-to set* $\text{pt}(p)$ for a pointer variable $p$ is the set of abstract memory locations that $p$ may point to.

Two pointers $p$ and $q$ may alias if $\text{pt}(p) \cap \text{pt}(q) \neq \emptyset$.

### 3.2 Abstract Memory Locations

Concrete memory locations are infinite (unbounded allocation). We abstract them:
- **Allocation-site abstraction**: each `malloc`/`new` call site represents one abstract location.
- **Variable-based**: each stack variable is its own abstract location.

### 3.3 Constraint Language

Pointer operations generate constraints:

| Statement | Constraint | Name |
|-----------|-----------|------|
| `p = &x` | $\{x\} \subseteq \text{pt}(p)$ | Address-of |
| `p = q` | $\text{pt}(q) \subseteq \text{pt}(p)$ | Copy |
| `p = *q` | $\forall v \in \text{pt}(q): \text{pt}(v) \subseteq \text{pt}(p)$ | Load |
| `*p = q` | $\forall v \in \text{pt}(p): \text{pt}(q) \subseteq \text{pt}(v)$ | Store |

---

## 4. Andersen's Analysis (Inclusion-Based)

### 4.1 Overview

Andersen's analysis (1994) is a *flow-insensitive*, *context-insensitive*, *inclusion-based* points-to analysis. It models pointer constraints as subset (inclusion) constraints and solves them to a fixed point.

### 4.2 Constraint Generation

For each pointer statement in the program, generate a constraint as in Section 3.3. The analysis processes *all* statements in the program without regard to control flow (flow-insensitive).

### 4.3 Constraint Resolution Algorithm

```
Algorithm: AndersenAnalysis(program)
Input: Program with pointer statements
Output: Points-to sets pt(v) for all pointer variables v

1.  Initialize: pt(v) = {} for all v
2.  For each "p = &x": pt(p) = pt(p) union {x}
3.
4.  worklist = all variables with non-empty pt sets
5.  While worklist is non-empty:
6.      Remove variable v from worklist
7.      For each copy constraint "p = v":
8.          If pt(v) not subset of pt(p):
9.              pt(p) = pt(p) union pt(v)
10.             Add p to worklist
11.     For each load constraint "p = *v":
12.         For each w in pt(v):
13.             Add copy edge w -> p (if not already present)
14.             If pt(w) not subset of pt(p):
15.                 pt(p) = pt(p) union pt(w)
16.                 Add p to worklist
17.     For each store constraint "*v = q":
18.         For each w in pt(v):
19.             Add copy edge q -> w (if not already present)
20.             If pt(q) not subset of pt(w):
21.                 pt(w) = pt(w) union pt(q)
22.                 Add w to worklist
```

### 4.4 Complexity Analysis

**Theorem 4.1 (Andersen's Analysis Complexity).** Andersen's analysis has worst-case time complexity $O(n^3)$ where $n$ is the number of pointer variables.

*Proof sketch.* The constraint graph has $O(n)$ nodes. Each node's points-to set can grow to size $O(n)$. Propagation along an edge copies a points-to set in $O(n)$ time. There are $O(n^2)$ possible edges (including dynamically added edges from load/store resolution). Each edge propagates at most $O(n)$ new elements. Total: $O(n^2 \cdot n) = O(n^3)$.

More precisely, with $O(n)$ initial constraints and $O(n)$ variables, the number of possible (variable, pointed-to location) pairs is $O(n^2)$. Each pair is propagated along $O(n)$ edges. Hence $O(n^3)$. $\square$

### 4.5 Implementation Optimizations

- **Difference propagation**: only propagate *new* elements of a points-to set, not the entire set. Reduces redundant work.
- **Cycle detection**: variables in a cycle of copy constraints have identical points-to sets. Detecting and collapsing cycles (e.g., via Tarjan's SCC algorithm) significantly improves performance.
- **BDD-based representations**: represent points-to sets as Binary Decision Diagrams for compact storage and efficient set operations. Whaley and Lam (2004) showed this enables Andersen's analysis on million-line programs.

---

## 5. Steensgaard's Analysis (Unification-Based)

### 5.1 Overview

Steensgaard's analysis (1996) trades precision for speed by using *unification* instead of inclusion. When a constraint `p = q` is encountered, the points-to sets of `p` and `q` are *unified* (merged), rather than making one a subset of the other.

### 5.2 Union-Find Formulation

Steensgaard's analysis uses a union-find data structure. Each pointer variable is represented by a node, and points-to relationships are represented by edges between equivalence classes.

```
Algorithm: SteensgaardAnalysis(program)
Input: Program with pointer statements
Output: Points-to equivalence classes

1.  Initialize: for each variable v, create a union-find node
2.  For each statement:
3.      "p = &x":
4.          If pt(find(p)) is empty:
5.              Set pt(find(p)) = find(x)
6.          Else:
7.              Union(pt(find(p)), find(x))
8.      "p = q":
9.          Union(find(p), find(q))
10.         // Also unify their points-to targets if both have one
11.         If pt(find(p)) and pt(find(q)) both exist:
12.             Union(pt(find(p)), pt(find(q)))
13.     "*p = q":
14.         Let target = pt(find(p))
15.         If target exists:
16.             Union(find(target), find(q))
17.             // And unify targets
18.         Else:
19.             Set pt(find(p)) = find(q)
20.     "p = *q":
21.         (symmetric to *p = q)
```

### 5.3 Complexity

**Theorem 5.1.** Steensgaard's analysis runs in $O(n \cdot \alpha(n))$ time, where $n$ is the number of pointer statements and $\alpha$ is the inverse Ackermann function.

*Proof.* Each statement generates $O(1)$ union-find operations. With path compression and union by rank, each operation takes amortized $O(\alpha(n))$ time. Total: $O(n \cdot \alpha(n)) \approx O(n)$. $\square$

### 5.4 Precision Loss

Steensgaard's analysis is less precise than Andersen's because unification is symmetric: if `p = q`, both `p` and `q` get the same points-to set, even if the assignment only goes one way.

**Example:**

```c
p = &a;
q = &b;
p = q;    // Now p points to {b}
```

- **Andersen's**: pt(p) = {a, b}, pt(q) = {b}.
- **Steensgaard's**: pt(p) = pt(q) = {a, b} (unified, losing precision on q).

### 5.5 Comparison

| Property | Andersen's | Steensgaard's |
|----------|-----------|---------------|
| Constraint type | Inclusion ($\subseteq$) | Unification ($=$) |
| Complexity | $O(n^3)$ | $O(n \cdot \alpha(n))$ |
| Precision | Higher | Lower |
| Points-to relation | Many-to-many | Equivalence classes |
| Practical use | Medium-scale programs | Very large programs |

---

## 6. Flow-Sensitive vs Flow-Insensitive Analysis

### 6.1 Flow-Insensitive

Computes a single points-to set per variable for the entire program. Does not consider the order of statements. Both Andersen's and Steensgaard's analyses are flow-insensitive.

**Advantage:** Simpler, faster.
**Disadvantage:** Cannot distinguish "p points to x before the assignment" from "p points to y after."

### 6.2 Flow-Sensitive

Computes points-to sets at each program point, using dataflow analysis.

**Dataflow formulation:**

- **Lattice:** maps from variables to sets of abstract locations (or $\top$).
- **Transfer function for `p = &x`:** $\sigma' = \sigma[p \mapsto \{x\}]$ (strong update if $p$ is a single concrete variable).
- **Transfer function for `p = q`:** $\sigma' = \sigma[p \mapsto \sigma(q)]$.
- **Meet:** $\sigma_1 \sqcap \sigma_2 = \lambda v.\; \sigma_1(v) \cup \sigma_2(v)$.

**Strong vs weak updates:**
- **Strong update**: $p$ is known to point to exactly one location; the old value is replaced.
- **Weak update**: $p$ might point to multiple locations; the new value is added to all of them.

**Complexity:** $O(n^2 \cdot |L|)$ where $|L|$ is the lattice height, which can be $O(n)$ for pointer analyses. Practical for single procedures, expensive interprocedurally.

---

## 7. Context-Sensitive Analysis

### 7.1 The Problem

Context-insensitive analysis merges information from all call sites of a function, losing precision.

```c
int *id(int *x) { return x; }

int a, b;
int *p = id(&a);    // call site 1
int *q = id(&b);    // call site 2
```

Context-insensitive: pt(p) = pt(q) = {a, b} (because `id` returns whatever `x` points to, and `x` is merged across both calls).

Context-sensitive: pt(p) = {a}, pt(q) = {b} (each call analyzed separately).

### 7.2 Context Sensitivity Methods

**Call strings (Sharir & Pnueli, 1981):** distinguish contexts by the sequence of call sites on the stack. A $k$-call-string limits the sequence to the last $k$ calls.

**Functional approach:** treat each function as a transfer function from input states to output states; memoize results to avoid redundant analysis.

**Object sensitivity (Milanova et al., 2005):** for object-oriented programs, distinguish contexts by the receiver object's allocation site. Often more precise than call-site sensitivity for Java programs.

### 7.3 Cloning-Based Analysis

Conceptually *clone* each function for each calling context, then run a context-insensitive analysis on the cloned program. BDD-based representations (Whaley & Lam, 2004) make this feasible for large programs.

---

## 8. Alias Analysis in Practice: LLVM's Infrastructure

### 8.1 LLVM's AA Framework

LLVM provides a composable alias analysis framework where multiple analyses contribute results:

1. **BasicAA**: type-based alias analysis (TBAA), `noalias` attributes, GEP analysis.
2. **TBAA (Type-Based Alias Analysis)**: uses C/C++ strict aliasing rules: `int*` and `float*` cannot alias.
3. **ScopedNoAliasAA**: uses metadata from `restrict` qualifiers and scoped `noalias` annotations.
4. **GlobalsAA**: tracks which functions access which globals.
5. **CFLAnders / CFLSteens**: CFL-reachability-based implementations of Andersen's and Steensgaard's analyses.

### 8.2 The AA Interface

```
enum AliasResult {
    NoAlias,        // Definitely do not alias
    MayAlias,       // Might alias
    PartialAlias,   // Overlapping but not identical memory regions
    MustAlias       // Definitely the same location
};

AliasResult alias(MemoryLocation A, MemoryLocation B);
```

The framework chains multiple AA passes: if BasicAA returns `MayAlias`, it queries TBAA, then GlobalsAA, etc. The first definitive answer wins.

### 8.3 MemorySSA

LLVM's MemorySSA provides SSA form for memory operations: each memory write creates a new "memory version," and reads are linked to their defining write. This enables efficient flow-sensitive alias queries within a function without running a full flow-sensitive points-to analysis.

---

## 9. Shape Analysis (Brief Introduction)

### 9.1 Motivation

Points-to analysis abstracts each allocation site as a single node, losing information about the *shape* of heap-allocated data structures. Shape analysis infers structural properties: "this is a singly-linked list," "this is a tree," "this list is acyclic."

### 9.2 Three-Valued Logic Analysis (TVLA)

Sagiv, Reps, and Wilhelm (2002) developed a framework based on three-valued predicate logic $\{0, 1, 1/2\}$ where $1/2$ means "unknown." Abstract states are three-valued logical structures, and transformers are defined by predicate update formulas.

**Key predicates:**
- $x(v)$: pointer variable $x$ points to heap node $v$.
- $n(v_1, v_2)$: heap node $v_1$ has a `next` pointer to $v_2$.
- Derived: $r[x](v)$: $v$ is reachable from $x$ via `next` pointers.
- Derived: $c(v)$: $v$ lies on a cycle.

### 9.3 Summarization

To keep the abstract state finite, nodes with identical unary predicate values are *summarized* into a single summary node. This is the key abstraction: a list of 1000 nodes becomes a summary node representing "many list nodes."

### 9.4 Limitations and Applications

Shape analysis is expensive ($O(2^{|P|})$ in the number of predicates) and requires careful predicate design. It is primarily used in verification and static analysis tools rather than production compilers.

---

## 10. Summary

| Analysis | Type | Complexity | Precision | Use Case |
|----------|------|-----------|-----------|----------|
| Steensgaard's | Unification-based | $O(n \cdot \alpha(n))$ | Low | Very large codebases, quick results |
| Andersen's | Inclusion-based | $O(n^3)$ | Medium | Whole-program optimization |
| Flow-sensitive | Dataflow-based | $O(n^2 \cdot h)$ | High | Per-function analysis |
| Context-sensitive | Various | $O(n^3)$ to exponential | High | Precise interprocedural |
| Shape analysis | 3-valued logic | Exponential | Very high | Verification |

Alias analysis is the "gatekeeper" optimization---its precision directly determines the effectiveness of virtually every other optimization. Investing in alias analysis precision has compounding benefits throughout the optimization pipeline.

---

## References

1. Andersen, L. O. (1994). "Program Analysis and Specialization for the C Programming Language." PhD Thesis, DIKU, University of Copenhagen.
2. Steensgaard, B. (1996). "Points-to Analysis in Almost Linear Time." *POPL*, 32--41.
3. Hind, M. (2001). "Pointer Analysis: Haven't We Solved This Problem Yet?" *PASTE*, 54--61.
4. Whaley, J., & Lam, M. S. (2004). "Cloning-Based Context-Sensitive Pointer Alias Analysis Using Binary Decision Diagrams." *PLDI*, 131--144.
5. Milanova, A., Rountev, A., & Ryder, B. G. (2005). "Parameterized Object Sensitivity for Points-to Analysis for Java." *ACM TOSEM*, 14(1), 1--41.
6. Sagiv, M., Reps, T., & Wilhelm, R. (2002). "Parametric Shape Analysis via 3-Valued Logic." *ACM TOPLAS*, 24(3), 217--298.
7. Lattner, C., Lenharth, A., & Adve, V. (2007). "Making Context-Sensitive Points-to Analysis with Heap Cloning Practical for the Real World." *PLDI*, 278--289.
8. Nielson, F., Nielson, H. R., & Hankin, C. (2005). *Principles of Program Analysis*. Springer. Chapter 4.
