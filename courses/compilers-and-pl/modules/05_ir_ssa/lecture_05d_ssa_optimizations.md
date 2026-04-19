# Lecture 05d: SSA-Based Optimizations

## 1. Introduction

SSA form enables compiler optimizations to be simpler, more efficient, and more powerful. The single-definition property provides explicit def-use chains, enabling **sparse** analyses that examine only relevant definitions and uses rather than all program points.

This lecture covers the major optimizations that exploit SSA form: constant propagation, dead code elimination, global value numbering, copy propagation, and strength reduction.

---

## 2. Sparse Conditional Constant Propagation (SCCP)

### 2.1 Motivation

Simple constant propagation replaces variables with their constant values when possible. **Conditional constant propagation** additionally reasons about which branches are taken, enabling discovery of constants that simple analysis misses. The **sparse** variant operates on the SSA def-use graph rather than iterating over all program points.

### 2.2 The Lattice

SCCP uses a three-level lattice for each SSA variable:

$$\top \quad (\text{undefined: not yet analyzed})$$
$$c \quad (\text{constant: variable has value } c)$$
$$\bot \quad (\text{non-constant: variable has multiple possible values})$$

The lattice order: $\top \sqsubseteq c \sqsubseteq \bot$ for all constants $c$.

The **meet** operation:

$$
\begin{aligned}
\top \sqcap x &= x \\
\bot \sqcap x &= \bot \\
c_1 \sqcap c_2 &= \begin{cases} c_1 & \text{if } c_1 = c_2 \\ \bot & \text{otherwise} \end{cases}
\end{aligned}
$$

### 2.3 The Algorithm

SCCP (Wegman & Zadeck, 1991) uses two worklists:
1. **SSA worklist:** SSA edges (def-use pairs) whose value has changed.
2. **CFG worklist:** CFG edges that have become executable.

```
function SCCP(cfg):
    // Initialize
    for each variable v:
        lattice[v] := TOP
    executable := {}                // set of executable CFG edges
    ssa_worklist := empty
    cfg_worklist := {(ENTRY, first_block)}

    while cfg_worklist or ssa_worklist not empty:
        // Process CFG edges
        if cfg_worklist not empty:
            (src, dst) := cfg_worklist.pop()
            if (src, dst) not in executable:
                executable.add((src, dst))
                // Process phi functions in dst
                for each phi in dst:
                    visit_phi(phi)
                // If first time dst is reachable, process all instructions
                if dst was not previously reachable:
                    for each non-phi instruction I in dst:
                        visit_instruction(I)

        // Process SSA edges
        if ssa_worklist not empty:
            (def, use) := ssa_worklist.pop()
            use_block := block_of(use)
            if use_block is reachable:
                if use is a phi:
                    visit_phi(use)
                else:
                    visit_instruction(use)

    // Apply results: replace constants, remove dead branches
    for each variable v:
        if lattice[v] is a constant c:
            replace all uses of v with c
    for each branch "if cond goto L1 else L2":
        if lattice[cond] is a constant:
            replace branch with unconditional goto

function visit_phi(phi):
    // Meet over all executable incoming edges
    result := TOP
    for each (value, pred_block) in phi.operands:
        if (pred_block, phi.block) in executable:
            result := result MEET lattice[value]
    if result != lattice[phi.target]:
        lattice[phi.target] := result
        for each use of phi.target:
            ssa_worklist.add((phi.target, use))

function visit_instruction(I):
    // Evaluate instruction if possible
    if I is "v = a + b":
        if lattice[a] = c1 and lattice[b] = c2:
            new_val := c1 + c2     // constant fold
        else if lattice[a] = BOT or lattice[b] = BOT:
            new_val := BOT
        else:
            new_val := TOP
        if new_val != lattice[v]:
            lattice[v] := new_val
            for each use of v:
                ssa_worklist.add((v, use))
    else if I is "if cond goto L1 else L2":
        if lattice[cond] = true:
            cfg_worklist.add((I.block, L1))
        else if lattice[cond] = false:
            cfg_worklist.add((I.block, L2))
        else:
            cfg_worklist.add((I.block, L1))
            cfg_worklist.add((I.block, L2))
```

### 2.4 Example

```
B0: x1 = 1
    y1 = 2
    goto B1

B1: z1 = phi(x1:B0, z2:B2)
    w1 = z1 + y1
    if w1 < 10 goto B2 else B3

B2: z2 = z1 + 1
    goto B1

B3: return w1
```

**SCCP trace:**

1. B0 is reachable. $x_1 = 1$, $y_1 = 2$.
2. B1 reachable (from B0). $z_1 = \phi(1:\text{B0}) = 1$ (only B0 edge is executable). $w_1 = 1 + 2 = 3$. $3 < 10$ is true, so B2 becomes reachable.
3. B2: $z_2 = 1 + 1 = 2$. B1 edge from B2 becomes executable.
4. Revisit $z_1 = \phi(1:\text{B0}, 2:\text{B2}) = 1 \sqcap 2 = \bot$. Now $z_1$ is non-constant.
5. $w_1 = \bot + 2 = \bot$. Branch condition is $\bot$, so B3 also becomes reachable.
6. Final: $x_1 = 1$, $y_1 = 2$, $z_1 = \bot$, $w_1 = \bot$.

### 2.5 Complexity

**Theorem 2.1.** SCCP runs in $O(E_{\text{SSA}} + E_{\text{CFG}})$ time, where $E_{\text{SSA}}$ is the number of SSA def-use edges and $E_{\text{CFG}}$ is the number of CFG edges.

*Proof.* Each SSA edge is processed at most twice (once for the value going to a constant, once for it going to $\bot$) since the lattice has height 2. Each CFG edge becomes executable at most once. $\square$

---

## 3. Dead Code Elimination on SSA

### 3.1 Simple DCE

On SSA, dead code elimination is straightforward: an instruction is **dead** if its result has no uses.

```
function simple_dce(cfg):
    worklist := {all instructions}
    while worklist not empty:
        I := worklist.pop()
        if I has no uses and I has no side effects:
            for each operand v of I:
                remove I from uses of v
                if def(v) has no remaining uses:
                    worklist.add(def(v))
            remove I from its block
```

**Complexity:** $O(n)$ where $n$ is the number of instructions (each instruction processed at most once).

### 3.2 Aggressive Dead Code Elimination (ADCE)

**Aggressive DCE** (Cytron et al.) works in reverse: instead of finding dead code, find *live* code and remove everything else.

```
function adce(cfg):
    // Mark phase: find essential instructions
    live := {}
    worklist := {}

    // Step 1: Mark instructions with side effects as live
    for each instruction I:
        if I is a store, call, return, or I/O:
            live.add(I)
            worklist.add(I)

    // Step 2: Mark instructions that contribute to live instructions
    while worklist not empty:
        I := worklist.pop()
        for each operand v of I:
            d := def(v)       // unique definition in SSA
            if d not in live:
                live.add(d)
                worklist.add(d)
        // Also mark the branch that controls I's execution
        for each block B that I is control-dependent on:
            terminator := B.terminator
            if terminator not in live:
                live.add(terminator)
                worklist.add(terminator)

    // Sweep phase: remove non-live instructions
    for each instruction I:
        if I not in live:
            remove I
    // Simplify branches to dead blocks
    for each branch I that was removed:
        replace with unconditional branch to nearest live post-dominator
```

ADCE is more powerful than simple DCE because it can remove entire branches of dead computation, including their control flow.

---

## 4. Global Value Numbering (GVN)

### 4.1 Motivation

**Value numbering** assigns a unique number to each distinct value computed in the program. Expressions that compute the same value get the same number, enabling redundancy elimination.

**Local value numbering** works within a single basic block. **Global value numbering** (GVN) extends this across the entire function using SSA.

### 4.2 Hash-Based GVN

The key idea: hash an instruction by its opcode and the value numbers of its operands. If two instructions hash to the same value, they compute the same value.

```
function gvn(cfg):
    value_table := hash table mapping (opcode, vn(arg1), vn(arg2), ...) -> value number
    vn := {}     // maps SSA variable -> value number
    next_vn := 0

    // Process blocks in dominator tree preorder
    for each block B in dominator tree preorder:
        for each instruction "v = op(a1, a2, ...)" in B:
            key := (op, vn[a1], vn[a2], ...)

            if key in value_table:
                // Redundant computation: reuse existing value
                existing_vn := value_table[key]
                vn[v] := existing_vn
                replace all uses of v with the variable that has value number existing_vn
                remove instruction
            else:
                vn[v] := next_vn
                value_table[key] := next_vn
                next_vn += 1

        // Handle phi functions
        for each phi "v = phi(a1, a2, ...)" in B:
            // Check for trivial phi (all args same value number)
            vns := {vn[a] for a in phi.args}
            if |vns| == 1:
                vn[v] := vns.single()
            else:
                key := (PHI, vn[a1], vn[a2], ...)
                if key in value_table:
                    vn[v] := value_table[key]
                else:
                    vn[v] := next_vn
                    value_table[key] := next_vn
                    next_vn += 1
```

### 4.3 Dominator-Based GVN (Simpson, 1996; Alpern, Wegman, Zadeck, 1988)

A more powerful approach processes blocks in dominator tree order, maintaining a scoped value table:

```
function dvn(block, value_table):
    saved_table := snapshot(value_table)

    for each instruction I in block:
        // ... same as above ...

    for each child C of block in dominator tree:
        dvn(C, value_table)

    restore(value_table, saved_table)
```

The scoping ensures that value numbers from a dominating block are visible in dominated blocks but not siblings.

### 4.4 GVN and Commutativity

To detect that `a + b` and `b + a` compute the same value, normalize commutative operations:

```
if op is commutative and vn[a1] > vn[a2]:
    swap a1, a2
key := (op, vn[a1], vn[a2])
```

### 4.5 Algebraic Simplifications

GVN can incorporate algebraic identities:

$$x + 0 \to x, \quad x \times 1 \to x, \quad x \times 0 \to 0, \quad x - x \to 0$$

These are checked before inserting into the value table.

---

## 5. Copy Propagation

### 5.1 On SSA

Copy propagation eliminates copy instructions $x_i = y_j$ by replacing all uses of $x_i$ with $y_j$.

On SSA, this is trivial:

```
function copy_propagation(cfg):
    for each instruction "xi = yj" (simple copy):
        replace all uses of xi with yj
        remove the copy instruction
```

**Complexity:** $O(n)$. The SSA property guarantees that $x_i$ has a unique definition, so replacing its uses is safe.

### 5.2 Phi Copy Propagation

Phi functions that are copies can also be eliminated:

```
x3 = phi(x1, x1)    // all args are the same -> x3 = x1
x4 = phi(x4, x2)    // self-reference -> x4 = x2
```

---

## 6. Strength Reduction

### 6.1 Classical Strength Reduction

**Strength reduction** replaces expensive operations with cheaper ones:

| Expensive | Cheap |
|-----------|-------|
| $x \times 2^k$ | $x \ll k$ |
| $x / 2^k$ | $x \gg k$ (unsigned) |
| $x \times c$ | sequence of shifts and adds |
| $x^2$ | $x \times x$ |

### 6.2 Operator Strength Reduction on SSA (OSR)

In loops, induction variables often involve multiplications that can be replaced by additions.

**Example:**

```
// Before:
for i = 0 to n:
    j = i * 4
    a[j] = ...

// After strength reduction:
j = 0
for i = 0 to n:
    a[j] = ...
    j = j + 4
```

On SSA, induction variables are identified through chains of phi functions and addition operations:

**Definition 6.1 (Induction Variable).** In SSA, a variable $v$ is a **linear induction variable** of a loop $L$ if $v = \phi(v_{\text{init}}, v + c)$ where $c$ is a loop-invariant constant.

```
function find_induction_variables(loop):
    ivs := {}
    for each phi "v = phi(init, step)" in loop.header:
        if step is "v + c" or "v - c" where c is loop-invariant:
            ivs[v] := (init, c)
    return ivs

function strength_reduce(loop, ivs):
    for each instruction "w = v * k" in loop:
        if v in ivs and k is loop-invariant:
            (init, stride) := ivs[v]
            // Replace w with a new induction variable
            w_init := init * k
            w_stride := stride * k
            // Insert: w_phi = phi(w_init, w_phi + w_stride)
            replace w with w_phi
```

### 6.3 SSA-Based Strength Reduction (Cooper, Simpson, Vick, 1995)

The SSA-based approach classifies SSA variables into:
- **Region constants:** Loop-invariant values.
- **Induction variables:** Linear functions of the loop iteration.
- **Other:** Everything else.

The classification propagates through the SSA graph:

$$\text{IV} + \text{RC} = \text{IV}, \quad \text{IV} \times \text{RC} = \text{IV}, \quad \text{IV} + \text{IV} = \text{IV}$$

---

## 7. SSA-Based Register Allocation

### 7.1 Motivation

Traditional register allocation uses **interference graphs**: two variables interfere if they are simultaneously live. SSA properties simplify this.

### 7.2 Chordal Interference Graphs

**Theorem 7.1 (Bouchez, Brisk, Hack et al.).** The interference graph of a program in SSA form is **chordal** (every cycle of length 4 or more has a chord).

A chordal graph can be optimally colored in $O(n + e)$ time using a perfect elimination ordering.

**Corollary:** Register allocation (graph coloring) on SSA programs can be solved optimally in polynomial time, unlike the general case which is NP-complete.

*Proof sketch.* The key property is that in SSA, live ranges have a tree structure (following the dominator tree). Two live ranges can only interfere if one is an ancestor of the other in the dominator tree. This nesting structure produces a chordal interference graph. $\square$

### 7.3 Practical Approach

In practice, modern allocators (e.g., LLVM's) use SSA to:
1. Build a **live range** for each SSA variable.
2. Coalesce copies (especially from phi elimination).
3. Build the interference graph.
4. Color the graph (using the chordal property or heuristics).
5. Spill variables that cannot be colored.

---

## 8. Other SSA-Based Optimizations

### 8.1 Partial Redundancy Elimination (PRE) on SSA

PRE removes computations that are redundant on some (but not all) paths by hoisting them to earlier points. On SSA, this is formulated as a placement problem for phi functions of expressions.

### 8.2 Loop-Invariant Code Motion (LICM)

On SSA, loop-invariant instructions are easily identified: an instruction in a loop is loop-invariant if all its operands are defined outside the loop.

```
function licm(loop):
    preheader := loop.preheader
    for each instruction I in loop.body:
        if all operands of I are defined outside loop or are loop-invariant:
            if I has no side effects:
                move I to end of preheader
```

### 8.3 Sparse Predicated SSA (SPSSA)

For predicated execution (if-conversion), $\psi$-functions replace phi functions, encoding the predicate:

$$x_3 = \psi(p ? x_1 : x_2)$$

---

## 9. Summary

| Optimization | Key Technique | Enabled by SSA |
|-------------|---------------|----------------|
| SCCP | Two-worklist lattice iteration | Sparse: follow def-use edges |
| DCE | Remove instructions with no uses | Trivial use counting |
| ADCE | Mark-and-sweep from essential instructions | Reverse reachability on def-use |
| GVN | Hash (opcode, value numbers) | Single def: unique value number per variable |
| Copy propagation | Replace copies | Trivial on SSA |
| Strength reduction | Replace multiply with add in loops | IV detection via phi chains |
| Register allocation | Chordal graph coloring | SSA guarantees chordal interference |

---

## References

1. Wegman, M.N. & Zadeck, F.K. (1991). "Constant Propagation with Conditional Branches." *ACM TOPLAS*, 13(2), 181--210.
2. Alpern, B., Wegman, M.N., & Zadeck, F.K. (1988). "Detecting Equality of Variables in Programs." *POPL*, 1--11.
3. Click, C. (1995). "Global Code Motion / Global Value Numbering." *PLDI*, 246--257.
4. Cooper, K.D., Simpson, L.T., & Vick, C.A. (1995). "Operator Strength Reduction." *ACM TOPLAS*, 23(5), 603--625.
5. Hack, S., Grund, D., & Goos, G. (2006). "Register Allocation for Programs in SSA Form." *CC*, LNCS 3923, 247--262.
6. Bouchez, F., Brisk, P., & Eckstein, E. (2007). "Register Allocation: What Does the NP-Completeness Proof of Chaitin et al. Really Prove?" *WDDD*.
7. Cytron, R. et al. (1991). (See Lecture 05c references.)
8. Cooper, K.D. & Torczon, L. (2011). *Engineering a Compiler* (2nd ed.), Chapters 9--10.
9. Muchnick, S.S. (1997). *Advanced Compiler Design and Implementation*, Chapters 12--15.
