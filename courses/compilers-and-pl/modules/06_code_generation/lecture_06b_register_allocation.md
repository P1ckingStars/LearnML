# Lecture 06b: Register Allocation

## 1. Introduction

Register allocation assigns program variables (and compiler temporaries) to a finite set of physical machine registers. This is one of the most impactful compiler optimizations: the difference between a variable residing in a register versus memory can be an order of magnitude in access latency.

**The core tension.** Programs may use an unbounded number of virtual registers (temporaries), but the target machine has a fixed number $k$ of physical registers. When demand exceeds supply, some values must be *spilled* to memory. The goal is to minimize the total cost of spills while respecting the constraint that no two simultaneously live values occupy the same register.

---

## 2. Liveness Analysis (Review)

Register allocation depends critically on *liveness information*.

**Definition.** A variable $v$ is *live* at program point $p$ if there exists a path from $p$ to a use of $v$ that does not pass through a redefinition of $v$.

The live variables at each point are computed by a backward dataflow analysis:

$$\text{LiveIn}[B] = \text{Use}[B] \cup (\text{LiveOut}[B] \setminus \text{Def}[B])$$

$$\text{LiveOut}[B] = \bigcup_{S \in \text{succ}(B)} \text{LiveIn}[S]$$

where $\text{Use}[B]$ is the set of variables used before definition in block $B$, and $\text{Def}[B]$ is the set of variables defined in $B$.

### 2.1 Live Ranges and Live Intervals

A *live range* of variable $v$ is the maximal connected region of the control flow graph where $v$ is live. In the simpler *linear scan* setting, we work with *live intervals* $[s_v, e_v]$ representing the first and last points in a linear ordering where $v$ is live.

---

## 3. Interference Graphs

### 3.1 Construction

**Definition.** The *interference graph* $G = (V, E)$ has:
- $V$ = set of virtual registers (variables/temporaries).
- $(u, v) \in E$ if and only if $u$ and $v$ are simultaneously live at some program point.

More precisely, two variables interfere if one is live at a point where the other is defined (with the exception of move instructions where source and destination do not interfere if coalescing is considered).

**Algorithm: Interference Graph Construction**

```
Algorithm: BuildInterferenceGraph(CFG)
Input: Control flow graph with liveness information
Output: Interference graph G

1.  Initialize G = (V, {}) where V = all virtual registers
2.  For each basic block B in CFG:
3.      Let live = LiveOut[B]
4.      For each instruction I in B (in reverse order):
5.          If I is a definition of variable d:
6.              For each v in live:
7.                  If v != d:
8.                      Add edge (d, v) to G
9.          Update live:
10.             Remove variables defined by I from live
11.             Add variables used by I to live
12. Return G
```

### 3.2 Properties of Interference Graphs

**Observation.** Interference graphs from real programs are *chordal* with high probability. A graph is chordal if every cycle of length $\geq 4$ has a chord. Chordal graphs can be optimally colored in polynomial time using a perfect elimination ordering.

**Theorem 3.1 (Gavril, 1972).** Interval graphs (from linear live ranges) are chordal, and hence $k$-colorable in $O(|V| + |E|)$ time.

However, interference graphs from programs with complex control flow are not in general chordal, motivating the use of heuristics.

---

## 4. Graph Coloring Formulation

### 4.1 The $k$-Coloring Problem

**Definition.** A *$k$-coloring* of graph $G = (V, E)$ is a function $c: V \to \{1, 2, \ldots, k\}$ such that $(u, v) \in E \implies c(u) \neq c(v)$. The *chromatic number* $\chi(G)$ is the minimum $k$ for which a $k$-coloring exists.

Register allocation with $k$ registers reduces to $k$-coloring the interference graph. If $\chi(G) \leq k$, all variables fit in registers. Otherwise, some variables must be spilled.

### 4.2 NP-Completeness

**Theorem 4.1 (Chaitin, 1981).** Register allocation by graph coloring is NP-complete.

*Proof sketch.* We reduce from the graph $k$-colorability problem, which is NP-complete for $k \geq 3$ (Karp, 1972). Given an arbitrary graph $G = (V, E)$, we construct a program whose interference graph is isomorphic to $G$:

1. For each vertex $v_i \in V$, create a variable $x_i$.
2. For each edge $(v_i, v_j) \in E$, arrange the program so that $x_i$ and $x_j$ are simultaneously live at some point. This can be achieved by interleaving definitions and uses appropriately.
3. The resulting interference graph is $G$.

A $k$-coloring of this interference graph (i.e., a valid register assignment with $k$ registers) exists if and only if $G$ is $k$-colorable. Since the program construction is polynomial and $k$-coloring is NP-complete, register allocation is NP-complete. $\square$

**Important caveat.** While the general problem is NP-complete, the *structure* of interference graphs arising from real programs (often chordal or near-chordal) makes heuristic algorithms very effective in practice.

---

## 5. Chaitin's Algorithm

### 5.1 Overview

Chaitin et al. (1981) proposed the first graph-coloring register allocator, used in the IBM PL.8 compiler.

### 5.2 The Algorithm

```
Algorithm: ChaitinRegisterAllocation(G, k)
Input: Interference graph G = (V, E), number of registers k
Output: Coloring c: V -> {1..k} union {SPILL}

Phase 1: Simplify
1.  Initialize stack S = empty
2.  While G is non-empty:
3.      If there exists a node v with degree(v) < k:
4.          Push v onto S
5.          Remove v and its edges from G
6.      Else:
7.          // Must spill: select a node v to spill (heuristic)
8.          Mark v as SPILL
9.          Push v onto S
10.         Remove v and its edges from G

Phase 2: Select
11. While S is non-empty:
12.     Pop v from S
13.     If v is marked SPILL:
14.         Assign v -> SPILL (insert load/store code)
15.     Else:
16.         Let used = { c(u) : u is a neighbor of v already colored }
17.         Assign c(v) = smallest color in {1..k} \ used
18.         // This always succeeds because degree(v) < k when v was pushed
```

### 5.3 Correctness of the Simplify Phase

**Lemma 5.1.** If $\text{degree}(v) < k$ in $G$, then $G$ is $k$-colorable if and only if $G \setminus \{v\}$ is $k$-colorable.

*Proof.* ($\Rightarrow$) Trivial: a coloring of $G$ restricted to $G \setminus \{v\}$ is a valid coloring.

($\Leftarrow$) Given a $k$-coloring of $G \setminus \{v\}$, the neighbors of $v$ use at most $\text{degree}(v) < k$ colors, so at least one color remains available for $v$. $\square$

This lemma guarantees that the Select phase will always find a color for non-spilled nodes.

### 5.4 Spill Heuristics

When no node has degree $< k$, Chaitin must choose a node to spill. Common heuristics:

- **Maximum degree**: spill the node with the most neighbors (removes the most edges).
- **Minimum spill cost**: estimate the cost of spilling each candidate (based on number of uses/defs, loop nesting depth) and spill the cheapest.
- **Combined**: use $\frac{\text{spill\_cost}(v)}{\text{degree}(v)}$ as the metric; spill the node with the smallest ratio.

### 5.5 Spill Code Insertion

When variable $v$ is spilled:
1. Allocate a stack slot for $v$.
2. After each definition of $v$, insert a store to the stack slot.
3. Before each use of $v$, insert a load from the stack slot.
4. Each load/store introduces a new short-lived temporary, which is added to the interference graph.
5. **Re-run** the entire algorithm on the modified program.

This iterative process is guaranteed to terminate because each iteration either succeeds or introduces temporaries with very short live ranges that are easy to color.

---

## 6. Briggs' Optimistic Coloring

### 6.1 Motivation

Chaitin's algorithm is *pessimistic*: when it encounters a node with degree $\geq k$, it immediately marks it for spilling. But removing other high-degree nodes might reduce this node's effective degree below $k$.

### 6.2 The Key Insight

**Observation (Briggs et al., 1994).** A node with degree $\geq k$ might still be colorable if its neighbors do not use all $k$ colors. We should delay the spill decision until the Select phase, when we have more information.

### 6.3 Briggs' Modified Algorithm

The simplify phase changes:

```
Phase 1: Simplify (Briggs' version)
1.  Initialize stack S = empty
2.  While G is non-empty:
3.      If there exists a node v with degree(v) < k:
4.          Push v onto S
5.          Remove v and its edges from G
6.      Else:
7.          // Optimistic: push a high-degree node but do NOT mark as spill yet
8.          Select v using spill heuristic
9.          Push v onto S (unmarked)
10.         Remove v and its edges from G

Phase 2: Select (Briggs' version)
11. While S is non-empty:
12.     Pop v from S
13.     Let used = { c(u) : u is a neighbor of v already colored }
14.     If |{1..k} \ used| > 0:
15.         Assign c(v) = smallest color in {1..k} \ used
16.     Else:
17.         // Actual spill: could not find a color
18.         Mark v for spilling
```

### 6.4 Benefit

**Theorem 6.1.** Briggs' algorithm spills no more nodes than Chaitin's algorithm, and frequently spills fewer.

*Proof.* Every node that Chaitin would color, Briggs also colors (the degree $< k$ nodes are handled identically). Nodes that Chaitin spills may or may not be colored by Briggs, but are never made worse: in the worst case, they are spilled in the Select phase. $\square$

---

## 7. George & Appel: Iterated Register Coalescing

### 7.1 Register Coalescing

*Coalescing* eliminates move instructions by assigning the source and destination of a move to the same register. If variables $a$ and $b$ are related by `MOV a, b` and do not interfere, we can *coalesce* them into a single node $ab$ in the interference graph.

**Risk.** Coalescing increases the degree of the merged node ($\text{degree}(ab) \leq \text{degree}(a) + \text{degree}(b)$), potentially making the graph harder to color and causing additional spills.

### 7.2 Conservative Coalescing Criteria

**Briggs' criterion.** Coalesce $a$ and $b$ if the merged node $ab$ has fewer than $k$ neighbors of significant degree ($\geq k$).

**George's criterion.** Coalesce $a$ and $b$ if every neighbor $t$ of $a$ either (1) already interferes with $b$, or (2) has degree $< k$.

Both criteria guarantee that coalescing does not make a previously $k$-colorable graph non-$k$-colorable.

### 7.3 The Iterated Register Coalescing (IRC) Algorithm

George and Appel (1996) combined simplification, coalescing, freezing, and spilling into a unified framework.

```
Algorithm: IteratedRegisterCoalescing(G, k)
Input: Interference graph G with move-related edges, k registers
Output: Coloring or spill decisions

Build: Construct interference graph and classify nodes:
  - simplifyWorklist: low-degree, non-move-related nodes
  - freezeWorklist: low-degree, move-related nodes
  - spillWorklist: high-degree nodes
  - moveWorklist: active move instructions

Repeat until all worklists are empty:
  1. Simplify: If simplifyWorklist is non-empty:
       Remove a node, push onto stack.
       Update neighbor degrees; may move neighbors between worklists.

  2. Coalesce: If moveWorklist is non-empty:
       For each move (a, b):
         If a and b don't interfere AND conservative criterion is met:
           Merge a and b. Update graph.
         Else:
           Mark move as constrained or frozen.

  3. Freeze: If freezeWorklist is non-empty and nothing else can be done:
       Select a move-related node, give up on coalescing its moves.
       Move it to simplifyWorklist.

  4. Spill: If spillWorklist is non-empty and nothing else can be done:
       Select a node to spill (heuristic), push onto stack.

Select: Pop nodes from stack and color (optimistic, as in Briggs).

If actual spills occurred:
  Insert spill code, rebuild interference graph, restart.
```

### 7.4 Correctness Properties

**Theorem 7.1.** The IRC algorithm terminates and produces a valid register assignment (or identifies necessary spills).

*Proof sketch.* Each iteration of the main loop either removes a node (Simplify/Spill) or removes a move edge (Coalesce/Freeze), strictly reducing the problem size. The Select phase produces valid colorings for non-spilled nodes by Lemma 5.1. The outer loop (rebuild after spills) terminates because spilled variables are replaced by short-lived temporaries that are easy to color. $\square$

---

## 8. Linear Scan Register Allocation

### 8.1 Motivation

Graph coloring is effective but expensive: building the interference graph takes $O(V^2)$ time in the worst case, and the coloring heuristics, while polynomial, have significant constant factors. For just-in-time (JIT) compilers and other settings where compilation speed is critical, *linear scan* allocation offers a compelling alternative.

### 8.2 Live Intervals

Linearize the program's instructions into a sequence $1, 2, \ldots, n$. Each variable $v$ has a *live interval* $[s_v, e_v]$ where $s_v$ is the first definition and $e_v$ is the last use.

### 8.3 Algorithm (Poletto & Sarkar, 1999)

```
Algorithm: LinearScan(intervals, k)
Input: List of live intervals sorted by start point, k registers
Output: Register assignment

1.  active = {} (set of intervals currently assigned registers, sorted by end point)
2.  freeRegs = {r1, r2, ..., rk}

3.  For each interval i in order of increasing start point:
4.      ExpireOldIntervals(i):
5.          For each interval j in active (sorted by end point):
6.              If j.end >= i.start: break  // j still active
7.              Remove j from active
8.              Add j.register to freeRegs

9.      If freeRegs is empty:
10.         SpillAtInterval(i):
11.             Let spill = interval in active with latest end point
12.             If spill.end > i.end:
13.                 i.register = spill.register
14.                 spill.location = STACK
15.                 Remove spill from active; add i to active
16.             Else:
17.                 i.location = STACK
18.     Else:
19.         i.register = freeRegs.pop()
20.         Add i to active (sorted by end point)
```

### 8.4 Complexity

**Theorem 8.1.** Linear scan register allocation runs in $O(n \log n)$ time, where $n$ is the number of live intervals.

*Proof.* Sorting intervals by start point: $O(n \log n)$. The main loop iterates $n$ times. Each `ExpireOldIntervals` call does amortized $O(\log n)$ work (each interval is added to and removed from the active set at most once; if the active set is maintained as a sorted structure, insertions and deletions cost $O(\log n)$ each). Total: $O(n \log n)$. $\square$

### 8.5 Quality vs Graph Coloring

Linear scan produces code that is typically within 5--15% of graph coloring quality on benchmarks, at a fraction of the compilation cost. This makes it the preferred choice for JIT compilers (e.g., HotSpot C1, V8 Crankshaft).

**Limitation.** Linear scan does not account for the full structure of the interference graph. Two variables with overlapping intervals but in different branches of an `if-else` do not actually interfere, but linear scan treats them as conflicting.

### 8.6 Lifetime Holes and Second-Chance Allocation

Extensions to linear scan include:
- **Lifetime holes**: split intervals at points where a variable is not live, allowing registers to be temporarily reused.
- **Second-chance bin packing** (Traub et al., 1998): when a register must be freed, consider evicting an existing assignment rather than always spilling the new interval.

---

## 9. SSA-Based Register Allocation

### 9.1 Motivation

In SSA form, each variable is defined exactly once. This gives the interference graph a special structure.

**Theorem 9.1 (Bouchez et al., 2007; Hack et al., 2006).** The interference graph of a program in strict SSA form is *chordal*.

*Proof sketch.* In strict SSA form, every use is dominated by its (unique) definition. The dominance tree induces a tree structure on live ranges. Interference graphs of such "tree-structured" live ranges are interval graphs on a tree, which are chordal. $\square$

**Corollary.** Optimal register allocation (minimum coloring) for SSA programs can be computed in polynomial time.

### 9.2 SSA-Based Allocation Algorithm

```
Algorithm: SSARegisterAllocation(program_in_SSA, k)
Input: Program in SSA form, k registers
Output: Register assignment

1. Build interference graph G (chordal by Theorem 9.1)
2. Compute a perfect elimination ordering (PEO) of G
   (possible because G is chordal; use maximum cardinality search)
3. Color G greedily using the PEO:
   For each node v in reverse PEO order:
     Assign v the smallest color not used by its already-colored neighbors
4. If chromatic number > k:
   Spill variables (various strategies)
5. Eliminate phi-functions by inserting moves
6. Perform move coalescing
```

### 9.3 Phi-Function Elimination

After coloring, phi-functions must be replaced by move instructions at the ends of predecessor blocks. If $\phi(a, b, c) \to d$ at the join of three predecessors, insert:
- `MOV d, a` at the end of predecessor 1
- `MOV d, b` at the end of predecessor 2
- `MOV d, c` at the end of predecessor 3

If $a$ and $d$ are assigned the same register, the move is unnecessary (this is effectively coalescing).

### 9.4 Advantages

- **Simplicity**: chordal graphs admit optimal polynomial-time coloring.
- **Decoupling**: spilling and coloring can be handled in separate phases.
- **Clean framework**: SSA properties simplify analysis and transformation.

---

## 10. Spilling Strategies

### 10.1 Spill Cost Estimation

The cost of spilling variable $v$ is estimated as:

$$\text{SpillCost}(v) = \sum_{i \in \text{defs}(v)} w_i \cdot C_{\text{store}} + \sum_{i \in \text{uses}(v)} w_i \cdot C_{\text{load}}$$

where $w_i$ is the execution frequency of point $i$ (estimated from loop nesting: $w_i = 10^{d_i}$ where $d_i$ is the loop depth), and $C_{\text{store}}, C_{\text{load}}$ are the costs of store/load instructions.

### 10.2 Spill Everywhere vs Spill Locally

- **Spill everywhere**: insert loads before every use and stores after every definition. Simple but generates excessive spill code.
- **Spill locally (rematerialization)**: if the spilled value can be cheaply recomputed (e.g., constants, simple expressions), regenerate it instead of loading from the stack.
- **Partial spilling**: spill only in certain regions where register pressure is high, keeping the value in a register elsewhere.

### 10.3 Live Range Splitting

Instead of spilling an entire variable, *split* its live range at strategic points. This creates multiple shorter-lived variables, each of which may be individually colorable. Splitting points are typically at loop boundaries or basic block edges.

**Algorithm: Live Range Splitting**

```
1. Identify a variable v with high spill cost
2. Find a split point p where register pressure is high
3. Create v1 (before p) and v2 (after p)
4. Insert: STORE v1 -> stack_slot at p
           LOAD  v2 <- stack_slot at p
5. Update interference graph and re-color
```

---

## 11. Precolored Nodes and Register Constraints

### 11.1 Precoloring

Some variables must reside in specific registers due to calling conventions or instruction constraints:
- Function arguments in designated registers (e.g., `rdi`, `rsi`, `rdx` on System V AMD64).
- Return values in `rax`.
- Division operands in `rax`/`rdx` on x86.

These are modeled as *precolored nodes* in the interference graph---nodes with a fixed color that cannot be changed. All other nodes must avoid conflicting with precolored neighbors.

### 11.2 Handling Precolored Nodes

In the IRC algorithm:
- Precolored nodes are never simplified, coalesced away, or spilled.
- They participate in interference normally.
- Other nodes may be coalesced *into* a precolored node if the conservative criterion is satisfied.

---

## 12. Comparison of Approaches

| Approach | Quality | Compile Time | Best For |
|----------|---------|-------------|----------|
| Chaitin | Good | $O(n^2)$ | Batch compilers |
| Briggs (optimistic) | Better than Chaitin | $O(n^2)$ | Batch compilers |
| IRC (George-Appel) | Best heuristic | $O(n^2)$ | Production optimizing compilers |
| Linear Scan | Good (5--15% worse) | $O(n \log n)$ | JIT compilers |
| SSA-based | Optimal for SSA | $O(n + e)$ | SSA-based compilers |

---

## 13. Summary

Register allocation transforms the idealized world of unlimited virtual registers into the constrained reality of physical hardware. The graph coloring formulation provides an elegant mathematical framework, while practical algorithms---from Chaitin's pioneering work through Briggs' optimistic improvement to George and Appel's iterated coalescing---demonstrate how heuristics can tame NP-hard problems. For time-critical compilation, linear scan offers an excellent quality-speed tradeoff, and SSA-based methods exploit structural properties for polynomial-time optimal solutions.

---

## References

1. Chaitin, G. J., Auslander, M. A., Chandra, A. K., Cocke, J., Hopkins, M. E., & Markstein, P. W. (1981). "Register Allocation via Coloring." *Computer Languages*, 6(1), 47--57.
2. Chaitin, G. J. (1982). "Register Allocation and Spilling via Graph Coloring." *SIGPLAN Notices*, 17(6), 98--105.
3. Briggs, P., Cooper, K. D., & Torczon, L. (1994). "Improvements to Graph Coloring Register Allocation." *ACM TOPLAS*, 16(3), 428--455.
4. George, L., & Appel, A. W. (1996). "Iterated Register Coalescing." *ACM TOPLAS*, 18(3), 300--324.
5. Poletto, M., & Sarkar, V. (1999). "Linear Scan Register Allocation." *ACM TOPLAS*, 21(5), 895--913.
6. Hack, S., Grund, D., & Goos, G. (2006). "Register Allocation for Programs in SSA Form." *CC*, 247--262.
7. Bouchez, F., Darte, A., & Rastello, F. (2007). "On the Complexity of Register Coalescing." *CGO*, 102--114.
8. Traub, O., Holloway, G., & Smith, M. D. (1998). "Quality and Speed in Linear-Scan Register Allocation." *PLDI*, 142--151.
9. Appel, A. W. (2004). *Modern Compiler Implementation in ML*. Cambridge University Press. Chapter 11.
