# Lecture 05c: Static Single Assignment Form

## 1. Introduction and Motivation

**Static Single Assignment (SSA) form** is a property of an intermediate representation where every variable is assigned exactly once and every use of a variable refers to exactly one definition. SSA was introduced by Cytron et al. (1991) and has become the standard IR form for modern optimizing compilers.

### 1.1 Why SSA?

Consider the code:

```
x = 1
x = 2
y = x
```

Without SSA, we must perform reaching definitions analysis to determine that `y = x` uses the value from `x = 2`. With SSA:

```
x1 = 1
x2 = 2
y1 = x2
```

Every use directly names its definition. This makes def-use chains trivial and enables sparse (per-variable rather than per-program-point) analyses.

### 1.2 The Problem at Join Points

At control flow join points, a variable may have different definitions along different paths:

```
if (cond)
    x = 1      // path A
else
    x = 2      // path B
y = x           // which x?
```

In SSA:

```
if (cond)
    x1 = 1
else
    x2 = 2
x3 = phi(x1, x2)   // phi function: selects the appropriate value
y1 = x3
```

---

## 2. Phi Functions

### 2.1 Definition

A **phi function** ($\phi$-function) is a special instruction placed at the beginning of a basic block that merges values from different incoming control flow edges:

$$x_i = \phi(x_j, x_k, \ldots)$$

The phi function takes one argument per predecessor block and selects the argument corresponding to the edge actually taken at runtime.

### 2.2 Semantics

The phi function $x = \phi(x_1 : B_1, x_2 : B_2, \ldots, x_n : B_n)$ has the semantics:

$$x = \begin{cases} x_1 & \text{if control arrived from } B_1 \\ x_2 & \text{if control arrived from } B_2 \\ \vdots \\ x_n & \text{if control arrived from } B_n \end{cases}$$

**Important:** Phi functions are not "real" instructions. They are simultaneously evaluated at the start of a basic block before any other instruction executes. All phi functions in a block read their inputs from the *predecessor* blocks, not from other phi functions in the same block.

### 2.3 Formal Property

**Definition 2.1 (SSA Form).** A program is in SSA form if:
1. Every variable has exactly one (static) definition point.
2. Every use of a variable is dominated by its definition.

Property (2) is called the **dominance property** of SSA.

---

## 3. Phi Placement: The Dominance Frontier Algorithm

### 3.1 Where Do We Need Phi Functions?

**Key insight (Cytron et al., 1991):** A phi function for variable $v$ is needed at node $n$ if and only if $n$ is in the **iterated dominance frontier** of the set of blocks that define $v$.

**Theorem 3.1.** Let $\text{Defs}(v) = \{B_1, \ldots, B_k\}$ be the set of blocks containing definitions of variable $v$. Then phi functions for $v$ must be placed at exactly the nodes in $\text{DF}^+(\text{Defs}(v))$.

*Proof sketch.* ($\Rightarrow$) If node $n$ is in $\text{DF}(B_i)$ for some $B_i \in \text{Defs}(v)$, then there exist two paths to $n$: one through $B_i$ (carrying the definition from $B_i$) and one that bypasses $B_i$. At $n$, we need a phi function to merge these. The iteration handles the transitive case: if the phi function at $n$ is itself a new definition of $v$, we must place further phi functions at $\text{DF}(n)$.

($\Leftarrow$) If $n \notin \text{DF}^+(\text{Defs}(v))$, then either $n$ is dominated by a single definition (no merge needed) or $v$ is not live at $n$ (no use). $\square$

### 3.2 Phi Placement Algorithm

```
function place_phi_functions(cfg, defs):
    // defs[v] = set of blocks that define variable v
    // DF[n] = dominance frontier of node n

    for each variable v:
        worklist := defs[v].copy()
        has_phi := {}           // blocks where phi for v is already placed
        ever_on_worklist := defs[v].copy()

        while worklist is not empty:
            B := worklist.pop()
            for each D in DF[B]:
                if D not in has_phi:
                    insert phi function for v at start of D:
                        v = phi(v, v, ..., v)   // one arg per predecessor
                    has_phi.add(D)
                    if D not in ever_on_worklist:
                        ever_on_worklist.add(D)
                        worklist.add(D)
                        // phi is a new def of v; propagate
```

**Complexity:** $O(|\text{Defs}(v)| \cdot |\text{DF}^+(v)|)$ per variable. Total: $O(\sum_v |\text{Defs}(v)| \cdot |\text{DF}^+(v)|)$, which is $O(n^2)$ in the worst case but typically linear for structured programs.

---

## 4. SSA Construction: Full Algorithm

SSA construction has two phases:
1. **Place phi functions** (Section 3).
2. **Rename variables** (assign unique names).

### 4.1 Variable Renaming

After phi functions are placed, we rename variables during a preorder traversal of the dominator tree. Each variable $v$ gets a stack of names; the current name is the top of the stack.

```
function rename_variables(cfg, dom_tree):
    for each variable v:
        counter[v] := 0
        stack[v] := empty

    function fresh_name(v):
        i := counter[v]
        counter[v] := i + 1
        name := v_i
        stack[v].push(name)
        return name

    function rename(block):
        // Save stack state for backtracking
        saved_sizes := {v: |stack[v]| for each variable v}

        // Rename phi function targets
        for each phi instruction "v = phi(...)" in block:
            phi.target := fresh_name(v)

        // Rename ordinary instructions
        for each instruction "v = op(a, b, ...)" in block:
            // Rename uses (right-hand side)
            replace each use of variable u with stack[u].top()
            // Rename definition (left-hand side)
            if instruction defines v:
                instruction.target := fresh_name(v)

        // Fill in phi function arguments in successors
        for each successor S of block:
            j := index of block in predecessors of S
            for each phi "v = phi(...)" in S:
                phi.args[j] := stack[v].top()

        // Recurse on dominator tree children
        for each child C of block in dom_tree:
            rename(C)

        // Restore stacks (backtrack)
        for each variable v:
            while |stack[v]| > saved_sizes[v]:
                stack[v].pop()

    rename(ENTRY)
```

### 4.2 Complete Example

Original code:

```
     B0: a = 1
         b = 2
         if cond goto B2

     B1: a = 3
         goto B3

     B2: b = 4
         goto B3

     B3: c = a + b
         return c
```

**Step 1: Compute dominators.**

$\text{idom}(\text{B1}) = \text{B0}$, $\text{idom}(\text{B2}) = \text{B0}$, $\text{idom}(\text{B3}) = \text{B0}$.

**Step 2: Compute dominance frontiers.**

$\text{DF}(\text{B0}) = \emptyset$, $\text{DF}(\text{B1}) = \{\text{B3}\}$, $\text{DF}(\text{B2}) = \{\text{B3}\}$, $\text{DF}(\text{B3}) = \emptyset$.

**Step 3: Place phi functions.**

Variable $a$: defined in B0, B1. $\text{DF}^+(\{B0, B1\}) = \{B3\}$. Place $a = \phi(\ldots)$ in B3.

Variable $b$: defined in B0, B2. $\text{DF}^+(\{B0, B2\}) = \{B3\}$. Place $b = \phi(\ldots)$ in B3.

**Step 4: Rename.**

```
     B0: a1 = 1
         b1 = 2
         if cond goto B2

     B1: a2 = 3
         goto B3

     B2: b2 = 4
         goto B3

     B3: a3 = phi(a2, a1)    // from B1, B2 (note: B2 has a1, not a2)
         b3 = phi(b1, b2)    // from B1, B2
         c1 = a3 + b3
         return c1
```

Wait---we need to be careful about which predecessor contributes which value. B3 has predecessors B1 and B2:
- From B1: $a = a_2$, $b = b_1$ (B1 only redefines $a$).
- From B2: $a = a_1$, $b = b_2$ (B2 only redefines $b$).

```
     B3: a3 = phi(a2:B1, a1:B2)
         b3 = phi(b1:B1, b2:B2)
         c1 = a3 + b3
         return c1
```

---

## 5. Minimal vs. Pruned vs. Semi-Pruned SSA

### 5.1 Minimal SSA

The dominance frontier algorithm produces **minimal SSA**: the minimum number of phi functions needed to maintain the SSA property. However, some of these phi functions may be "dead"---they define variables that are never used.

### 5.2 Pruned SSA

**Pruned SSA** eliminates phi functions for variables that are not live at the join point. This requires liveness analysis as a preprocessing step.

**Definition 5.1.** A phi function $v = \phi(\ldots)$ at block $B$ is **dead** if $v$ is not live-out of $B$ and is not used by any instruction in $B$ (other than other dead phi functions).

Pruned SSA has strictly fewer phi functions than minimal SSA.

### 5.3 Semi-Pruned SSA

**Semi-pruned SSA** (Briggs et al., 1998) is a compromise: it avoids placing phi functions for variables that are local to a single basic block. This is cheaper than full liveness analysis but eliminates many useless phi functions.

```
function is_global(v):
    // A variable is "global" if it is used outside the block where it is defined.
    for each use of v:
        if use is in a different block than def(v):
            return true
    return false

// Only place phi functions for global variables
```

---

## 6. SSA Destruction (Phi Elimination)

After SSA-based optimizations, the SSA form must be converted back to conventional (non-SSA) form for code generation, since phi functions have no direct hardware support.

### 6.1 Basic Approach: Copy Insertion

Replace each phi function with copy instructions in predecessor blocks:

```
// Before (SSA):
B3: x3 = phi(x1:B1, x2:B2)

// After (copies):
B1: ...
    x3 = x1        // copy inserted at end of B1
    goto B3

B2: ...
    x3 = x2        // copy inserted at end of B2
    goto B3

B3: // x3 is now available
```

### 6.2 The Lost-Copy Problem

Naive copy insertion can fail with **critical edges** (edges from a block with multiple successors to a block with multiple predecessors):

```
// B0 has successors B1, B2 (conditional branch)
// B1 has predecessors B0, B3

// Where to insert the copy for B0 -> B1?
// Cannot put it at the end of B0 (would also affect B0 -> B2 path)
// Cannot put it at the start of B1 (would also affect B3 -> B1 path)
```

**Solution:** **Split critical edges** by inserting an empty block:

```
// Insert B_new on the edge B0 -> B1:
B0 -> B_new -> B1

// Place the copy in B_new:
B_new: x3 = x1
       goto B1
```

### 6.3 The Swap Problem

When multiple phi functions in the same block reference each other's variables, naive sequential copies can produce wrong results:

```
// SSA:
a2 = phi(b1, ...)
b2 = phi(a1, ...)

// Naive copies in predecessor:
a2 = b1
b2 = a1     // ERROR: a1 was already overwritten!

// Solution: use a temporary
t = a1
a2 = b1
b2 = t
```

A correct algorithm (Sreedhar et al., 1999) detects such circular dependencies and inserts temporaries as needed.

---

## 7. Properties of SSA Form

### 7.1 Factored Use-Def Chains

In SSA, every use of a variable $v_i$ is linked to exactly one definition---the definition of $v_i$. This gives us **factored use-def chains** for free: the def-use graph is explicit in the naming.

**Consequence:** Many analyses that traditionally require iterative dataflow (reaching definitions, available expressions) become simple graph traversals on the SSA def-use graph.

### 7.2 SSA and Functional Programming

**Theorem 7.1 (Appel, 1998).** SSA form is equivalent to functional programming in continuation-passing style (CPS).

The correspondence is:
- Basic blocks $\leftrightarrow$ functions (continuations).
- Phi functions $\leftrightarrow$ function parameters.
- Branches $\leftrightarrow$ tail calls.
- SSA variables $\leftrightarrow$ immutable bindings.

**Example:**

```
// SSA:
B1: x1 = 1
    goto B3

B2: x2 = 2
    goto B3

B3: x3 = phi(x1:B1, x2:B2)
    return x3

// CPS:
let B3 = fun x3 -> return x3 in
let B1 = fun () -> let x1 = 1 in B3 x1 in
let B2 = fun () -> let x2 = 2 in B2 x2 in
...
```

This insight means that techniques from functional programming (lambda lifting, inlining, dead code elimination) can be applied directly to SSA.

### 7.3 Dominance Property

**Theorem 7.2.** In well-formed SSA, every use of a variable $v_i$ is dominated by the (unique) definition of $v_i$.

*Proof.* By construction. The renaming algorithm pushes names onto the stack during a preorder traversal of the dominator tree and pops them when backtracking. A name is visible (on the stack) exactly in the subtree of the dominator tree rooted at the defining block. Since uses only see names on the stack, every use is within the dominator subtree of the definition, hence dominated by it. $\square$

---

## 8. Gated SSA and Variants

### 8.1 Gated SSA (GSA)

**Gated SSA** (Ballance et al., 1990) replaces phi functions with more informative gating functions that record the *condition* under which each value is selected:

- $\gamma(c, v_1, v_2)$: if condition $c$ is true, selects $v_1$; otherwise $v_2$.
- $\mu(v_{\text{init}}, v_{\text{iter}})$: loop merge---initial value vs. iterated value.
- $\eta(c, v)$: loop exit---value at loop termination.

GSA makes control dependence information explicit, enabling more powerful analyses.

### 8.2 SSA with Memory

Standard SSA only handles scalar variables. For memory operations, variants include:

- **Memory SSA (MemorySSA in LLVM):** Tracks may-def/may-use relationships for memory operations in SSA-like form. Uses `MemoryDef`, `MemoryUse`, and `MemoryPhi` nodes.

- **Array SSA (Knobe & Sarkar, 1998):** Extends SSA to array elements using `define` and `use` at indexed positions.

- **Heap SSA:** Extends SSA to heap-allocated objects using access paths.

---

## 9. Alternative SSA Construction: The Braun Algorithm

Braun et al. (2013) presented a simpler SSA construction algorithm that builds SSA *during* IR generation (no separate pass):

```
function read_variable(variable, block):
    if current_def[variable][block] is defined:
        return current_def[variable][block]
    return read_variable_recursive(variable, block)

function read_variable_recursive(variable, block):
    if block not sealed:    // not all predecessors known yet
        // create incomplete phi
        phi := new Phi(block)
        incomplete_phis[block].add((variable, phi))
        val := phi
    else if |predecessors(block)| == 1:
        // no phi needed for single predecessor
        val := read_variable(variable, predecessors(block)[0])
    else:
        // break potential cycles with a placeholder phi
        phi := new Phi(block)
        write_variable(variable, block, phi)
        val := add_phi_operands(variable, phi)
    write_variable(variable, block, val)
    return val

function add_phi_operands(variable, phi):
    for each predecessor p of phi.block:
        phi.append_operand(read_variable(variable, p))
    return try_remove_trivial_phi(phi)

function try_remove_trivial_phi(phi):
    // A phi is trivial if all operands are the same or self-referencing
    same := null
    for each operand op of phi:
        if op == same or op == phi:
            continue
        if same != null:
            return phi    // non-trivial: at least two distinct values
        same := op
    // Trivial phi: replace with the single value
    replace_all_uses(phi, same)
    phi.remove()
    // Check if removing this phi makes other phis trivial
    for each user u of phi:
        if u is a Phi:
            try_remove_trivial_phi(u)
    return same
```

**Advantages:**
- No need to precompute dominance frontiers.
- Builds SSA on-the-fly during AST lowering.
- Automatically produces pruned SSA (trivial phis are removed).
- Used in libFirm, Cranelift, and other compilers.

---

## 10. Summary

| Concept | Key Idea |
|---------|----------|
| SSA property | Each variable defined exactly once |
| Phi functions | Merge values at join points |
| Dominance frontiers | Determine phi placement |
| Minimal SSA | Fewest phis via DF algorithm |
| Pruned SSA | Remove dead phis (requires liveness) |
| SSA destruction | Replace phis with copies |
| Critical edges | Must be split for correct phi elimination |
| SSA = CPS | Functional programming connection |
| Dominance property | Every use dominated by its definition |
| Braun algorithm | On-the-fly SSA construction |

---

## References

1. Cytron, R., Ferrante, J., Rosen, B.K., Wegman, M.N., & Zadeck, F.K. (1991). "Efficiently Computing Static Single Assignment Form and the Control Dependence Graph." *ACM TOPLAS*, 13(4), 451--490.
2. Rosen, B.K., Wegman, M.N., & Zadeck, F.K. (1988). "Global Value Numbers and Redundant Computations." *POPL*, 12--27.
3. Appel, A.W. (1998). "SSA is Functional Programming." *ACM SIGPLAN Notices*, 33(4), 17--20.
4. Briggs, P., Cooper, K.D., Harvey, T.J., & Simpson, L.T. (1998). "Practical Improvements to the Construction and Destruction of Static Single Assignment Form." *Software---Practice and Experience*, 28(8), 859--881.
5. Braun, M., Buchwald, S., Hack, S., Leissa, R., Mallon, C., & Zwinkau, A. (2013). "Simple and Efficient Construction of Static Single Assignment Form." *CC*, LNCS 7791, 102--122.
6. Sreedhar, V.C., Ju, R.D.-C., Gillies, D.M., & Santhanam, V. (1999). "Translating Out of Static Single Assignment Form." *SAS*, LNCS 1694, 194--210.
7. Ballance, R.A., Maccabe, A.B., & Ottenstein, K.J. (1990). "The Program Dependence Web: A Representation Supporting Control-, Data-, and Demand-Driven Interpretation of Imperative Languages." *PLDI*, 257--271.
8. Knobe, K. & Sarkar, V. (1998). "Array SSA Form and Its Use in Parallelization." *POPL*, 107--120.
