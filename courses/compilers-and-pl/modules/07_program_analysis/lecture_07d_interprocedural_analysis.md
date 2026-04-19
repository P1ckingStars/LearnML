# Lecture 07d: Interprocedural Analysis

## 1. Introduction

Intraprocedural analysis considers each function in isolation, assuming worst-case behavior at call boundaries. *Interprocedural analysis* crosses function boundaries, enabling the compiler to exploit knowledge about callees and callers. This is essential for optimizing real programs, where computations are distributed across many functions and abstraction layers.

The challenges are substantial: the number of possible call chains grows exponentially with call depth, dynamic dispatch and function pointers make call targets uncertain, and separate compilation limits whole-program visibility. This lecture develops the key techniques for tractable interprocedural analysis.

---

## 2. Call Graphs

### 2.1 Definition

**Definition.** A *call graph* $CG = (N, E)$ has:
- $N$: set of functions (procedures) in the program.
- $E \subseteq N \times N$: directed edges where $(f, g) \in E$ if $f$ may call $g$.

Call graph construction is itself an analysis problem: function pointers, virtual dispatch, and reflection make it difficult to determine the set of possible call targets.

### 2.2 Construction Methods

#### 2.2.1 Class Hierarchy Analysis (CHA)

For object-oriented languages, CHA (Dean et al., 1995) resolves virtual calls by consulting the class hierarchy.

For a call `x.m()` where the declared type of `x` is `T`:
$$\text{targets}(x.m()) = \{C.m : C \text{ is } T \text{ or a subclass of } T, \text{ and } C \text{ defines or inherits } m\}$$

**Complexity:** $O(|E_{\text{call}}| \cdot |H|)$ where $H$ is the class hierarchy size.

**Precision:** Conservative---may include targets whose receiver type can never actually reach the call site.

#### 2.2.2 Rapid Type Analysis (RTA)

RTA (Bacon & Sweeney, 1996) refines CHA by tracking which classes are *instantiated* in the program.

$$\text{targets}(x.m()) = \{C.m : C \in \text{Instantiated} \cap \text{Subtypes}(T), \text{ and } C \text{ defines or inherits } m\}$$

**Algorithm:**

```
Algorithm: RTA(program)
Input: Program with class hierarchy
Output: Call graph, set of instantiated classes

1.  Instantiated = {}
2.  Reachable = {main}
3.  worklist = {main}
4.  While worklist is non-empty:
5.      f = worklist.remove()
6.      For each "new C" in f:
7.          Instantiated = Instantiated union {C}
8.          // May need to re-resolve previously seen virtual calls
9.      For each call "x.m()" in f:
10.         targets = {C.m : C in Instantiated, C <: declared_type(x)}
11.         For each t in targets:
12.             Add edge f -> t
13.             If t not in Reachable:
14.                 Reachable = Reachable union {t}
15.                 worklist.add(t)
16. Return (Reachable, edges)
```

RTA iterates because discovering new reachable methods may reveal new instantiation sites, which may resolve additional virtual calls.

#### 2.2.3 Points-To-Based Call Graph Construction

For languages with function pointers (C, C++), call graph construction requires pointer analysis:

For a call `(*fp)(args)`:
$$\text{targets}(fp) = \text{pt}(fp)$$

This creates a *mutual dependency*: the call graph is needed for interprocedural pointer analysis, and pointer analysis is needed for call graph construction. The solution is to compute them simultaneously, iterating to a fixed point.

```
Algorithm: SimultaneousCallGraphAndPointsTo(program)
1.  Initialize CG with direct calls only
2.  Repeat until convergence:
3.      Run (or update) points-to analysis using current CG
4.      For each indirect call site:
5.          Resolve targets using points-to results
6.          Add new CG edges
7.      If CG changed, continue; else stop
```

### 2.3 Call Graph Precision Hierarchy

$$\text{CHA} \supseteq \text{RTA} \supseteq \text{0-CFA (Andersen's)} \supseteq \text{k-CFA} \supseteq \text{Exact}$$

Each successive analysis produces a (weakly) smaller, more precise call graph, at increasing computational cost.

---

## 3. Interprocedural Dataflow Analysis

### 3.1 The Exploded Supergraph

An interprocedural dataflow analysis can be formulated on the *supergraph*: the CFG obtained by connecting call sites to callee entries and callee exits to return sites.

**Definition.** The *supergraph* $G^* = (N^*, E^*)$ has:
- $N^* = \bigcup_{f} N_f$ (all nodes from all function CFGs).
- **Intraprocedural edges**: edges within each function CFG.
- **Call edges**: from call site $c_f$ to entry of callee $g$.
- **Return edges**: from exit of callee $g$ to return site $r_f$.
- **Call-to-return edges**: from $c_f$ to $r_f$ (for transmitting local information that bypasses the callee).

### 3.2 The Realizable Paths Problem

Not all paths in the supergraph correspond to valid executions. A *realizable path* is one where every call return matches the corresponding call site (i.e., returns go back to the correct caller).

**Formally.** Label each call edge with $(_i$ and each return edge with $)_i$ where $i$ identifies the call site. A path is realizable if the sequence of parentheses is a prefix of a string in the Dyck language $D_k$ (matched parentheses with $k$ types).

The *meet-over-all-valid-paths* (MOVP) solution:

$$\text{MOVP}[n] = \bigsqcap_{p \in \text{RealPaths}(\text{entry}, n)} f_p(\iota)$$

This is strictly more precise than the meet-over-all-paths (MOP) solution on the supergraph, which includes infeasible paths.

---

## 4. Context Sensitivity

### 4.1 The Problem

Context-insensitive analysis merges information from all call sites of a function, conflating unrelated data.

### 4.2 Call Strings (Sharir & Pnueli, 1981)

A *call string* is a sequence of call sites $\langle c_1, c_2, \ldots, c_m \rangle$ recording the call chain leading to the current invocation.

**$k$-bounded call strings:** truncate call strings to the last $k$ elements:
- $k = 0$: context-insensitive.
- $k = 1$: distinguish immediate callers.
- $k = \infty$: fully context-sensitive (exponential).

**Dataflow state:** $D : \text{Node} \times \text{CallString}^{\leq k} \to L$

The number of contexts per function is $O(|CS|^k)$ where $|CS|$ is the number of call sites, making $k > 2$ impractical for large programs.

### 4.3 Functional Approach (Sharir & Pnueli, 1981)

Instead of tracking call strings, compute the *transfer function* (or *summary*) of each procedure: a function $\phi_f : L \to L$ mapping input states to output states.

At a call site calling $f$ with input $x$:
$$\text{output} = \phi_f(x)$$

**Computing summaries:**

```
Algorithm: FunctionalApproach(program)
1.  Initialize: phi_f = identity for all functions f
2.  worklist = all functions
3.  While worklist non-empty:
4.      Remove function f
5.      Compute phi_f by analyzing f's body:
6.          For each call to g in f: use phi_g as the transfer function
7.      If phi_f changed:
8.          Add all callers of f to worklist
```

This converges because the lattice of transfer functions (ordered pointwise) has finite height if $L$ does.

**Advantage:** automatically context-sensitive without explicit context enumeration.

**Limitation:** works only when transfer functions can be represented compactly. For distributive frameworks over finite lattices, summaries can be represented as sets of input-output pairs.

---

## 5. The IFDS Framework

### 5.1 Overview

The IFDS (Interprocedural Finite Distributive Subset) framework, due to Reps, Horwitz, and Sagiv (1995), provides a polynomial-time algorithm for interprocedural dataflow analysis of problems that:
1. Are *distributive* (transfer functions distribute over meet).
2. Operate over *finite* domains.
3. Use *subset* lattices.

Key insight: such problems can be reduced to *graph reachability* on an "exploded supergraph."

### 5.2 Exploded Supergraph

Given a program with dataflow domain $D = \{d_1, d_2, \ldots, d_n\}$ (a finite set of dataflow facts), the *exploded supergraph* $G^\#$ has:
- For each node $n$ in the supergraph: $n+1$ copies, one for each fact $d \in D$ plus a special node $\mathbf{0}$ representing the "empty fact" (used for gen).
- Edges encode the transfer function: an edge from $(n, d)$ to $(m, d')$ means that if fact $d$ holds before $n$, then $d'$ holds after (at $m$).

### 5.3 Transfer Function Encoding

A distributive function $f : 2^D \to 2^D$ on a finite set $D$ can be uniquely represented by its *representation relation* $R_f \subseteq (D \cup \{\mathbf{0}\}) \times D$:

$$d' \in f(S) \iff (\mathbf{0}, d') \in R_f \quad \text{or} \quad \exists d \in S : (d, d') \in R_f$$

**Theorem 5.1 (Reps et al., 1995).** A function $f : 2^D \to 2^D$ is distributive (distributes over union) if and only if it has such a representation relation. The representation has size $O(|D|^2)$.

*Proof.* ($\Leftarrow$) Given $R_f$, we verify distributivity:

$$f(A \cup B) = \{d' : (\mathbf{0}, d') \in R_f\} \cup \{d' : \exists d \in A \cup B.\; (d, d') \in R_f\}$$
$$= \{d' : (\mathbf{0}, d') \in R_f \lor \exists d \in A.\; (d, d') \in R_f\} \cup \{d' : (\mathbf{0}, d') \in R_f \lor \exists d \in B.\; (d, d') \in R_f\}$$
$$= f(A) \cup f(B)$$

($\Rightarrow$) Define $(d, d') \in R_f \iff d' \in f(\{d\})$ and $(\mathbf{0}, d') \in R_f \iff d' \in f(\emptyset)$. By distributivity, $f(S) = f(\emptyset) \cup \bigcup_{d \in S} f(\{d\})$, which matches the relation definition. $\square$

### 5.4 The IFDS Algorithm

Dataflow fact $d$ holds at node $n$ if and only if there is a *realizable* path in the exploded supergraph from $(\text{entry}_{\text{main}}, \mathbf{0})$ to $(n, d)$.

**Realizable path:** as before, call-return parentheses must match (Dyck language).

The algorithm computes reachability in the exploded supergraph, respecting the Dyck condition, using a *tabulation* algorithm:

```
Algorithm: IFDS_Tabulate(exploded_supergraph)
Input: Exploded supergraph G#
Output: For each node n, set of reachable facts

PathEdge = { (entry_main, 0) -> (entry_main, 0) }
SummaryEdge = {}
worklist = { (entry_main, 0) -> (entry_main, 0) }

While worklist non-empty:
    Remove edge e = (s_p, d1) -> (n, d2) from worklist

    Case 1: n is a normal (non-call, non-exit) node
        For each (d2, d3) in flow_function(n, successor(n)):
            Propagate (s_p, d1) -> (succ(n), d3)

    Case 2: n is a call node calling procedure q
        For each (d2, d3) in call_flow(n, entry_q):
            Propagate (entry_q, d3) -> (entry_q, d3)   // start new path in q
        For each (d2, d3) in call-to-return_flow(n, ret_n):
            Propagate (s_p, d1) -> (ret_n, d3)
        // Also: use existing summaries for q
        For each summary (entry_q, d3) -> (exit_q, d4):
            For each (d4, d5) in return_flow(exit_q, ret_n):
                Propagate (s_p, d1) -> (ret_n, d5)

    Case 3: n is an exit node of procedure p
        Add summary (s_p, d1) -> (n, d2) to SummaryEdge
        For each caller c of p:
            For each (s_c, d0) -> (c, d_call) in PathEdge
                where (d_call, d1) in call_flow(c, entry_p):
                For each (d2, d3) in return_flow(n, ret_c):
                    Propagate (s_c, d0) -> (ret_c, d3)

Propagate(e):
    If e not in PathEdge:
        Add e to PathEdge
        Add e to worklist
```

### 5.5 Complexity

**Theorem 5.2.** The IFDS algorithm runs in time $O(|E^*| \cdot |D|^3)$ where $|E^*|$ is the number of edges in the supergraph and $|D|$ is the size of the dataflow domain.

*Proof sketch.* The exploded supergraph has $O(|N^*| \cdot |D|)$ nodes and $O(|E^*| \cdot |D|^2)$ edges. The PathEdge and SummaryEdge sets have $O(|N^*|^2 \cdot |D|^2)$ entries. Each edge is added at most once to the worklist. Processing each edge involves constant work plus summary lookups. The summary computation at exit nodes involves matching call edges, bounded by $|D|$ per call. The dominant term is the summary propagation, yielding $O(|E^*| \cdot |D|^3)$. $\square$

### 5.6 Applications of IFDS

Classic problems naturally expressible as IFDS:
- **Possibly-uninitialized variables**: $D$ = set of variables; gen when a variable is used without initialization.
- **Taint analysis**: $D$ = set of tainted variables; track taint through assignments.
- **Copy-constant propagation**: $D$ = set of (variable, constant) pairs.

---

## 6. The IDE Framework

### 6.1 Extension of IFDS

The IDE (Interprocedural Distributive Environment) framework (Sagiv, Reps, Horwitz, 1996) generalizes IFDS from subset problems ($2^D$) to *environment* problems (functions from $D$ to a value domain $V$). Edge functions map input values to output values.

**IDE solves:** problems where the transfer function for each dataflow fact is an element of a finite-height lattice of *micro-functions* $\mathcal{M} : V \to V$.

**Key applications:** linear constant propagation, type-state analysis.

### 6.2 Complexity

IDE runs in $O(|E^*| \cdot |D|^3 \cdot h)$ where $h$ is the height of the micro-function lattice.

---

## 7. Inlining

### 7.1 Concept

*Inlining* replaces a function call with the body of the called function. This is the most powerful interprocedural "analysis" in a sense: it converts interprocedural optimization opportunities into intraprocedural ones.

### 7.2 Benefits

- Eliminates call/return overhead.
- Enables constant propagation into the callee.
- Enables intraprocedural optimizations across the original call boundary.
- Enables dead code elimination of unused callee code paths.

### 7.3 Costs

- Code size increase (exponential in worst case with recursive/mutual inlining).
- Instruction cache pollution.
- Increased register pressure in the inlined caller.
- Compile time increase.

### 7.4 Inlining Heuristics

**Typical heuristics (used in GCC, LLVM):**

1. **Always inline**: small functions (body size below threshold, e.g., 75 IR instructions in LLVM).
2. **Hot call sites**: profile-guided inlining at frequently executed call sites.
3. **Single call site**: if a function is called from only one site, inline it (no code size increase after the original is deleted).
4. **Cost-benefit analysis**: estimate the size increase and the optimization benefit (e.g., number of constant arguments that enable simplification).
5. **Recursive functions**: generally not inlined, or inlined to a fixed depth.

### 7.5 Inlining and Other Analyses

Inlining is a *substitute* for interprocedural analysis: if a function is inlined, intraprocedural analysis automatically sees through the call boundary. Conversely, good interprocedural analysis can reduce the need for aggressive inlining.

---

## 8. Whole-Program vs Modular Analysis

### 8.1 Whole-Program Analysis

Analyzes the entire program simultaneously. Provides the most precise results but requires all source code to be available and is expensive for large programs.

**Use cases:** link-time optimization (LTO) in GCC/LLVM, whole-program devirtualization.

### 8.2 Modular (Compositional) Analysis

Analyzes each module (function, file, library) independently, producing *summaries* that are composed at call sites.

**Advantages:** scales to large programs, supports separate compilation, incremental analysis.

**Challenges:** summaries must be sufficiently expressive to capture the function's behavior. Overly simple summaries lose precision; overly complex summaries are expensive.

### 8.3 Summary-Based Approach

```
Algorithm: ModularAnalysis(program)
Phase 1: Bottom-up (summarize callees before callers)
  For each function f in reverse topological order of call graph:
    Analyze f, using summaries of callees
    Produce summary for f

Phase 2: Top-down (propagate caller context to callees)
  For each function f in topological order:
    Use caller-provided context
    Refine callee summaries with actual arguments
```

For recursive functions (SCCs in the call graph), iterate within the SCC until convergence.

---

## 9. Summary

| Technique | Precision | Scalability | Key Application |
|-----------|-----------|-------------|-----------------|
| CHA | Low | Excellent | Quick devirtualization |
| RTA | Medium | Excellent | Call graph pruning |
| Context-insensitive | Low | Good | Baseline interprocedural |
| k-call-string | Medium--High | Poor ($k > 2$) | Research |
| Functional approach | High | Medium | Summary-based analysis |
| IFDS/IDE | Optimal (for distributive) | Good | Taint, init, typestate |
| Inlining | Highest (for inlined code) | Limited by code growth | Hot paths |

Interprocedural analysis is where the compiler transitions from optimizing individual functions to optimizing the program as a whole. The IFDS/IDE framework provides a theoretically elegant and practically effective solution for an important class of problems, while inlining and modular analysis offer complementary approaches for different scenarios.

---

## References

1. Reps, T., Horwitz, S., & Sagiv, M. (1995). "Precise Interprocedural Dataflow Analysis via Graph Reachability." *POPL*, 49--61.
2. Sagiv, M., Reps, T., & Horwitz, S. (1996). "Precise Interprocedural Dataflow Analysis with Applications to Constant Propagation." *Theoretical Computer Science*, 167(1--2), 131--170.
3. Grove, D., & Chambers, C. (2001). "A Framework for Call Graph Construction Algorithms." *ACM TOPLAS*, 23(6), 685--746.
4. Sharir, M., & Pnueli, A. (1981). "Two Approaches to Interprocedural Data Flow Analysis." In *Program Flow Analysis: Theory and Applications*, 189--233.
5. Dean, J., Grove, D., & Chambers, C. (1995). "Optimization of Object-Oriented Programs Using Static Class Hierarchy Analysis." *ECOOP*, 77--101.
6. Bacon, D. F., & Sweeney, P. F. (1996). "Fast Static Analysis of C++ Virtual Function Calls." *OOPSLA*, 324--341.
7. Naeem, N. A., Lhotak, O., & Rodriguez, J. (2010). "Practical Extensions to the IFDS Algorithm." *CC*, 124--144.
8. Bodden, E. (2012). "Inter-procedural Data-flow Analysis with IFDS/IDE and Soot." *SOAP*, 3--8.
