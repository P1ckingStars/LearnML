# Lecture 05b: Control Flow Graphs

## 1. Introduction

A **control flow graph** (CFG) is a directed graph representation of all paths that might be traversed through a program during execution. Each node represents a **basic block** (a straight-line sequence of instructions with no branches except at the end), and each edge represents a possible transfer of control.

The CFG is the fundamental data structure for most compiler analyses and transformations.

---

## 2. Basic Blocks and Leaders

### 2.1 Definition

**Definition 2.1 (Basic Block).** A **basic block** is a maximal sequence of consecutive instructions such that:
1. Control flow can only enter through the first instruction.
2. Control flow can only exit from the last instruction.
3. No instruction in the block (except the last) can halt or transfer control elsewhere.

### 2.2 Leader Algorithm

**Definition 2.2 (Leader).** The first instruction of a basic block is called a **leader**. An instruction is a leader if:
1. It is the first instruction in the program.
2. It is the target of a branch (conditional or unconditional).
3. It immediately follows a branch instruction.

```
function find_leaders(instructions):
    leaders := {0}                    // first instruction is a leader
    for i := 0 to |instructions| - 1:
        instr := instructions[i]
        if instr is a branch to label L:
            leaders.add(index_of(L))  // branch target
            leaders.add(i + 1)        // fall-through
        if instr is a conditional branch:
            leaders.add(i + 1)        // fall-through
    return leaders
```

### 2.3 CFG Construction

```
function build_cfg(instructions):
    leaders := find_leaders(instructions)
    blocks := partition instructions at leaders
    cfg := empty directed graph

    for each block B:
        cfg.add_node(B)
        last := B.last_instruction
        if last is "goto L":
            cfg.add_edge(B, block_containing(L))
        else if last is "if cond goto L":
            cfg.add_edge(B, block_containing(L))       // taken
            cfg.add_edge(B, next_block(B))              // fall-through
        else if last is "return":
            cfg.add_edge(B, EXIT)
        else:
            cfg.add_edge(B, next_block(B))              // fall-through

    return cfg
```

### 2.4 Entry and Exit Nodes

By convention, the CFG has two distinguished nodes:
- **ENTRY:** A unique entry node with an edge to the first basic block. Contains no instructions.
- **EXIT:** A unique exit node reached from all return statements.

---

## 3. Dominance

### 3.1 Definitions

**Definition 3.1 (Dominance).** A node $d$ **dominates** a node $n$ in a CFG, written $d\; \text{dom}\; n$, if every path from the ENTRY node to $n$ must pass through $d$.

**Properties:**
1. **Reflexive:** Every node dominates itself: $n\; \text{dom}\; n$.
2. **Transitive:** If $a\; \text{dom}\; b$ and $b\; \text{dom}\; c$, then $a\; \text{dom}\; c$.
3. **Antisymmetric:** If $a\; \text{dom}\; b$ and $b\; \text{dom}\; a$, then $a = b$.

Therefore, dominance is a **partial order** on the nodes of the CFG.

**Definition 3.2 (Strict Dominance).** $d$ **strictly dominates** $n$, written $d\; \text{sdom}\; n$, if $d\; \text{dom}\; n$ and $d \neq n$.

**Definition 3.3 (Immediate Dominator).** The **immediate dominator** of $n$, written $\text{idom}(n)$, is the unique node $d$ such that:
1. $d\; \text{sdom}\; n$, and
2. There is no $d'$ with $d\; \text{sdom}\; d'$ and $d'\; \text{sdom}\; n$.

**Theorem 3.1.** Every node except ENTRY has a unique immediate dominator.

*Proof.* Since ENTRY dominates all nodes (every path starts at ENTRY) and dominance is a partial order, the set of strict dominators of any node $n \neq \text{ENTRY}$ is a totally ordered chain (if $d_1$ and $d_2$ both strictly dominate $n$, then one dominates the other---because every path to $n$ passes through both, and the paths from ENTRY to $n$ are totally ordered by dominance). The maximum element of this chain is the immediate dominator. $\square$

### 3.2 Dominator Trees

Since every node has a unique immediate dominator, the idom relation forms a tree rooted at ENTRY:

**Definition 3.4 (Dominator Tree).** The **dominator tree** $T$ of a CFG has:
- Root: ENTRY node.
- Parent of node $n$: $\text{idom}(n)$.
- $d$ is an ancestor of $n$ in $T$ iff $d\; \text{dom}\; n$.

---

## 4. Computing Dominators

### 4.1 Iterative Algorithm (Allen & Cocke)

The simplest algorithm computes dominators as a fixed point of set equations:

$$\text{Dom}(n) = \{n\} \cup \bigcap_{p \in \text{pred}(n)} \text{Dom}(p)$$

with $\text{Dom}(\text{ENTRY}) = \{\text{ENTRY}\}$.

```
function compute_dominators(cfg):
    Dom[ENTRY] := {ENTRY}
    for each node n != ENTRY:
        Dom[n] := all_nodes             // initialize to universal set

    changed := true
    while changed:
        changed := false
        for each node n != ENTRY in reverse postorder:
            new_dom := intersection of Dom[p] for all predecessors p of n
            new_dom := new_dom union {n}
            if new_dom != Dom[n]:
                Dom[n] := new_dom
                changed := true

    return Dom
```

**Complexity:** $O(n^2)$ per iteration (set intersection), $O(d)$ iterations where $d$ is the depth of the dominator tree. Total: $O(n^2 \cdot d)$. For reducible CFGs, $d$ is typically $O(\log n)$.

### 4.2 Cooper, Harvey & Kennedy Algorithm

A more efficient iterative algorithm (Cooper et al., 2001) computes immediate dominators directly using a numbering from reverse postorder:

```
function compute_idom(cfg):
    // Number nodes in reverse postorder
    rpo := reverse_postorder(cfg)
    rpo_number[n] := position of n in rpo

    idom[ENTRY] := ENTRY
    for each node n != ENTRY:
        idom[n] := undefined

    changed := true
    while changed:
        changed := false
        for each node b in rpo (excluding ENTRY):
            new_idom := first processed predecessor of b
            for each other predecessor p of b:
                if idom[p] is defined:
                    new_idom := intersect(new_idom, p)
            if idom[b] != new_idom:
                idom[b] := new_idom
                changed := true

function intersect(b1, b2):
    finger1 := b1
    finger2 := b2
    while finger1 != finger2:
        while rpo_number[finger1] > rpo_number[finger2]:
            finger1 := idom[finger1]
        while rpo_number[finger2] > rpo_number[finger1]:
            finger2 := idom[finger2]
    return finger1
```

**Complexity:** Nearly linear in practice. Theoretically $O(n \cdot \alpha(n))$ per iteration with $O(d)$ iterations.

### 4.3 Lengauer-Tarjan Algorithm

The asymptotically fastest algorithm is **Lengauer-Tarjan** (1979), running in $O(n \cdot \alpha(n))$ time (nearly linear), where $\alpha$ is the inverse Ackermann function.

**High-level approach:**

1. Perform a DFS on the CFG, numbering nodes in DFS order.
2. Compute **semi-dominators** using the EVAL/LINK operations on a forest.
3. Derive immediate dominators from semi-dominators.

**Definition 4.1 (Semi-dominator).** The semi-dominator of $n$, $\text{sdom}(n)$, is:

$$\text{sdom}(n) = \min\{v \mid \exists \text{ path } v = v_0, v_1, \ldots, v_k = n \text{ with } v_i > n \text{ for } 1 \leq i \leq k-1\}$$

where $<$ and $>$ refer to DFS numbering.

```
function lengauer_tarjan(cfg):
    // Step 1: DFS numbering
    dfs_number, parent, vertex := dfs(cfg, ENTRY)
    n := |vertices|

    // Step 2: Compute semi-dominators (in reverse DFS order)
    for w := n-1 downto 1:
        for each predecessor v of vertex[w]:
            u := EVAL(v)
            if semi[u] < semi[w]:
                semi[w] := semi[u]
        // Add w to bucket of vertex[semi[w]]
        bucket[vertex[semi[w]]].add(w)
        LINK(parent[w], w)

        // Step 3: Implicitly compute idom
        for each v in bucket[parent[w]]:
            u := EVAL(v)
            if semi[u] < semi[v]:
                idom[v] := u
            else:
                idom[v] := parent[w]
        bucket[parent[w]].clear()

    // Step 4: Finalize idom
    for w := 1 to n-1:
        if idom[w] != vertex[semi[w]]:
            idom[w] := idom[idom[w]]

    return idom
```

The EVAL and LINK operations maintain a forest using **path compression** and **union by rank**, achieving nearly linear time.

**Theorem 4.1 (Lengauer-Tarjan).** The algorithm correctly computes immediate dominators in $O(m \cdot \alpha(m, n))$ time, where $m$ is the number of CFG edges, $n$ is the number of nodes, and $\alpha$ is the inverse Ackermann function.

---

## 5. Dominance Frontiers

### 5.1 Definition

**Definition 5.1 (Dominance Frontier).** The **dominance frontier** of a node $d$, written $\text{DF}(d)$, is the set of nodes $n$ such that:
1. $d$ dominates a predecessor of $n$, but
2. $d$ does not strictly dominate $n$.

Formally:

$$\text{DF}(d) = \{n \mid \exists p \in \text{pred}(n).\; d\; \text{dom}\; p \wedge \neg(d\; \text{sdom}\; n)\}$$

**Intuition:** The dominance frontier of $d$ is the "border" where $d$'s dominance ends. These are exactly the nodes where we need phi functions when inserting SSA form (Lecture 05c).

### 5.2 Computing Dominance Frontiers

**Algorithm (Cytron et al., 1991):**

```
function compute_dominance_frontiers(cfg, idom):
    for each node n:
        DF[n] := {}

    for each node n in cfg:
        if |predecessors(n)| >= 2:       // n is a join point
            for each predecessor p of n:
                runner := p
                while runner != idom[n]:
                    DF[runner].add(n)
                    runner := idom[runner]

    return DF
```

**Complexity:** $O(n^2)$ in the worst case (e.g., dense CFGs), but typically $O(n + |E|)$ for structured programs.

### 5.3 Iterated Dominance Frontier

For SSA construction, we need the **iterated dominance frontier** $\text{DF}^+(S)$ for a set of nodes $S$:

$$\text{DF}^1(S) = \bigcup_{n \in S} \text{DF}(n)$$
$$\text{DF}^{i+1}(S) = \text{DF}^1(S \cup \text{DF}^i(S))$$
$$\text{DF}^+(S) = \lim_{i \to \infty} \text{DF}^i(S)$$

The fixed point is reached in at most $O(n)$ iterations (bounded by the depth of the dominator tree).

---

## 6. Post-Dominance and Control Dependence

### 6.1 Post-Dominance

**Definition 6.1.** Node $p$ **post-dominates** node $n$ if every path from $n$ to EXIT passes through $p$.

Post-dominance is dominance on the **reverse CFG** (reverse all edges, swap ENTRY and EXIT).

### 6.2 Control Dependence

**Definition 6.2.** Node $n$ is **control-dependent** on node $c$ if:
1. There exists a path from $c$ to $n$ such that $n$ post-dominates every node on the path (excluding $c$).
2. $n$ does not post-dominate $c$.

**Intuition:** $n$ is control-dependent on $c$ if $c$ is a branch point where one branch leads to $n$ and another can bypass it.

**Theorem 6.1.** The control dependence relation can be computed as the dominance frontier on the reverse CFG:

$$\text{CD}(c) = \text{DF}_{\text{reverse}}(c)$$

---

## 7. Reducible and Irreducible Control Flow

### 7.1 Reducible CFGs

**Definition 7.1.** A CFG is **reducible** if every cycle has a single entry point (the loop header).

Equivalently, the edges can be partitioned into:
- **Forward edges:** forming a DAG.
- **Back edges:** $n \to h$ where $h$ dominates $n$.

**Theorem 7.1 (Hecht-Ullman).** A CFG is reducible iff it can be reduced to a single node by repeated application of:
- T1: Remove a self-loop.
- T2: If $n$ has a single predecessor $p$, merge $n$ into $p$.

Most structured programs produce reducible CFGs. Irreducible CFGs arise from `goto` statements that jump into the middle of loops.

### 7.2 Implications

- Reducible CFGs have simpler loop structures.
- Many analyses are cheaper on reducible CFGs.
- SSA construction on irreducible CFGs may require additional techniques (e.g., node splitting).

---

## 8. Loop Detection

### 8.1 Natural Loops

**Definition 8.1 (Back Edge).** An edge $n \to h$ in the CFG is a **back edge** if $h$ dominates $n$.

**Definition 8.2 (Natural Loop).** Given a back edge $n \to h$, the **natural loop** is:

$$\text{Loop}(n \to h) = \{h\} \cup \{m \mid m \text{ can reach } n \text{ without passing through } h\}$$

$h$ is the **loop header**; $n$ is a **latch** (has the back edge to the header).

### 8.2 Loop Detection Algorithm

```
function find_natural_loops(cfg, idom):
    back_edges := {}
    for each edge (n, h) in cfg:
        if h dominates n:                // back edge
            back_edges.add((n, h))

    loops := {}
    for each (n, h) in back_edges:
        loop_body := {h}
        worklist := {n}
        while worklist is not empty:
            m := worklist.pop()
            if m not in loop_body:
                loop_body.add(m)
                for each predecessor p of m:
                    if p != h:
                        worklist.add(p)
        loops.add(Loop(header=h, body=loop_body, latch=n))

    return loops
```

### 8.3 Loop Nesting Forest

Loops can be nested. The **loop nesting forest** is a tree where:
- Each node is a natural loop (identified by its header).
- Loop $L_1$ is a child of $L_2$ if $L_1 \subset L_2$ and there is no loop $L_3$ with $L_1 \subset L_3 \subset L_2$.

The nesting depth of a basic block is the number of loops containing it. This is useful for optimization heuristics (prioritize optimizing inner loops).

---

## 9. Practical Considerations

### 9.1 CFG in LLVM

In LLVM, the CFG is implicit in the structure of the IR:
- Each `Function` contains a list of `BasicBlock`s.
- Each `BasicBlock` ends with a `TerminatorInst` (branch, switch, return, etc.).
- Successor/predecessor edges are derived from terminator targets.

```cpp
// LLVM C++ API: iterating over CFG
for (BasicBlock &BB : F) {
    for (BasicBlock *Succ : successors(&BB)) {
        // Process edge BB -> Succ
    }
}

// Computing dominators
DominatorTree DT;
DT.recalculate(F);
if (DT.dominates(A, B)) { /* ... */ }
```

### 9.2 Visualization

LLVM can dump CFGs as DOT graphs:

```bash
opt -passes=dot-cfg input.ll
dot -Tpng .func_name.dot -o cfg.png
```

---

## 10. Summary

| Concept | Definition |
|---------|------------|
| Basic block | Maximal straight-line code |
| CFG | Directed graph of basic blocks |
| Dominance | $d\;\text{dom}\;n$: all paths to $n$ go through $d$ |
| Immediate dominator | Closest strict dominator |
| Dominator tree | Tree formed by idom relation |
| Dominance frontier | Border of dominance; phi placement sites |
| Post-dominance | Dominance on reverse CFG |
| Control dependence | $\text{DF}$ on reverse CFG |
| Natural loop | Body of a back edge |
| Reducible CFG | All loops have single entry |

---

## References

1. Lengauer, T. & Tarjan, R.E. (1979). "A Fast Algorithm for Finding Dominators in a Flowgraph." *ACM TOPLAS*, 1(1), 121--141.
2. Cytron, R., Ferrante, J., Rosen, B.K., Wegman, M.N., & Zadeck, F.K. (1991). "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph." *ACM TOPLAS*, 13(4), 451--490.
3. Allen, F.E. (1970). "Control Flow Analysis." *ACM SIGPLAN Notices*, 5(7), 1--19.
4. Cooper, K.D., Harvey, T.J., & Kennedy, K. (2001). "A Simple, Fast Dominance Algorithm." Software Practice & Experience.
5. Hecht, M.S. & Ullman, J.D. (1972). "Flow Graph Reducibility." *SIAM Journal on Computing*, 1(2), 188--202.
6. Cooper, K.D. & Torczon, L. (2011). *Engineering a Compiler* (2nd ed.), Chapters 8--9.
