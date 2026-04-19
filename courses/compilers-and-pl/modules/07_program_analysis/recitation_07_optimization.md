# Recitation 07: Implementing Optimizations

## Overview

This recitation focuses on implementing core compiler optimizations from the ground up: a dataflow analysis framework, reaching definitions, constant folding and propagation, and dead code elimination. These exercises bridge the theory from Lectures 07a--07d with practical implementation.

**Prerequisites:** Understanding of CFGs, lattice theory, the worklist algorithm, and dataflow analysis equations.

---

## Exercise 1: Building a Dataflow Analysis Framework

### 1.1 Framework Design

Design a generic dataflow analysis framework that can be instantiated for different analyses. The framework should support:

- Forward and backward analyses.
- Configurable lattice (meet/join operator, top/bottom elements).
- Configurable transfer functions.
- Worklist-based iteration with convergence detection.

### 1.2 Pseudocode

```
Class DataflowFramework:
    Properties:
        direction: FORWARD | BACKWARD
        lattice: Lattice
        transfer: Node -> (LatValue -> LatValue)

    Method solve(cfg):
        // Initialize
        For each node n in cfg:
            If direction == FORWARD:
                out[n] = lattice.initial_value()
            Else:
                in[n] = lattice.initial_value()

        // Set boundary conditions
        If direction == FORWARD:
            out[cfg.entry] = lattice.boundary_value()
        Else:
            in[cfg.exit] = lattice.boundary_value()

        // Build worklist in appropriate order
        If direction == FORWARD:
            worklist = reverse_postorder(cfg)
        Else:
            worklist = postorder(cfg)

        // Iterate
        changed = true
        While changed:
            changed = false
            For each node n in worklist:
                If direction == FORWARD:
                    new_in = lattice.meet([out[p] for p in pred(n)])
                    new_out = transfer(n)(new_in)
                    If new_out != out[n]:
                        out[n] = new_out
                        changed = true
                Else:  // BACKWARD
                    new_out = lattice.meet([in[s] for s in succ(n)])
                    new_in = transfer(n)(new_out)
                    If new_in != in[n]:
                        in[n] = new_in
                        changed = true

        Return (in, out)
```

### 1.3 Implementation Notes

- Use sets (Python `frozenset`, Java `Set<T>`, C++ `std::set` or bitsets) for bit-vector frameworks.
- For the worklist, a simple list in reverse postorder suffices for correctness. For efficiency, use a priority queue ordered by RPO number.
- The meet operator for may-analyses is union; for must-analyses it is intersection.

### 1.4 Task

Implement the framework in your language of choice. Test it by running a simple forward union analysis on a CFG with known results.

---

## Exercise 2: Implementing Reaching Definitions

### 2.1 Setup

Given the following CFG:

```
         [entry]
            |
            v
    +----> [B1: d1: x = 5]
    |       |
    |       v
    |      [B2: d2: y = x + 1]
    |       |
    |       v
    |      [B3: d3: x = y * 2]
    |      / \
    |     /   \
    |    v     v
    |  [B4]  [B5: d4: y = 10]
    |    \   /
    |     \ /
    |      v
    |    [B6: d5: z = x + y]
    |      |
    +------+  (back edge B6 -> B1)
            |
            v
         [exit]
```

### 2.2 Task

**(a)** Define the Gen and Kill sets for each block:

| Block | Gen | Kill |
|-------|-----|------|
| B1 | {d1} | {d3} (other defs of x) |
| B2 | {d2} | {d4} (other defs of y) |
| B3 | {d3} | {d1} (other defs of x) |
| B4 | {} | {} |
| B5 | {d4} | {d2} (other defs of y) |
| B6 | {d5} | {} (z not defined elsewhere, assume) |

**(b)** Compute the reaching definitions at each block by hand. Show each iteration of the worklist algorithm.

**(c)** Instantiate your framework from Exercise 1 with the reaching definitions analysis and verify the results match.

### 2.3 Solution Sketch

**Iteration 1 (forward, RPO order: B1, B2, B3, B4, B5, B6):**

```
In[B1] = Out[entry] union Out[B6] = {} (B6 not yet computed)
Out[B1] = {d1} union ({} \ {d3}) = {d1}

In[B2] = Out[B1] = {d1}
Out[B2] = {d2} union ({d1} \ {d4}) = {d1, d2}

In[B3] = Out[B2] = {d1, d2}
Out[B3] = {d3} union ({d1, d2} \ {d1}) = {d2, d3}

In[B4] = Out[B3] = {d2, d3}
Out[B4] = {d2, d3}

In[B5] = Out[B3] = {d2, d3}
Out[B5] = {d4} union ({d2, d3} \ {d2}) = {d3, d4}

In[B6] = Out[B4] union Out[B5] = {d2, d3} union {d3, d4} = {d2, d3, d4}
Out[B6] = {d5} union ({d2, d3, d4} \ {}) = {d2, d3, d4, d5}
```

**Iteration 2 (B6 feeds back to B1):**

```
In[B1] = Out[entry] union Out[B6] = {d2, d3, d4, d5}
Out[B1] = {d1} union ({d2, d3, d4, d5} \ {d3}) = {d1, d2, d4, d5}

In[B2] = Out[B1] = {d1, d2, d4, d5}
Out[B2] = {d2} union ({d1, d2, d4, d5} \ {d4}) = {d1, d2, d5}

In[B3] = {d1, d2, d5}
Out[B3] = {d3} union ({d1, d2, d5} \ {d1}) = {d2, d3, d5}

...continue until stable...
```

Continue until no Out set changes. Typically converges in 2--3 iterations for this small example.

---

## Exercise 3: Constant Folding and Propagation Pass

### 3.1 Constant Folding

Constant folding evaluates expressions with known constant operands at compile time.

```
Algorithm: ConstantFold(instruction I)
Input: Instruction I: t = a op b
Output: Simplified instruction or original

1.  If a is a constant c1 AND b is a constant c2:
2.      result = evaluate(c1 op c2) at compile time
3.      Replace I with: t = result
4.      Return modified instruction
5.  // Special cases:
6.  If op is + and b == 0: replace with t = a
7.  If op is * and b == 1: replace with t = a
8.  If op is * and b == 0: replace with t = 0
9.  If op is - and a == b: replace with t = 0
10. Return original instruction (no folding possible)
```

### 3.2 Constant Propagation

Constant propagation uses dataflow analysis to determine which variables have constant values at each program point, then substitutes the constant for the variable.

**Lattice (per variable):**

```
     Top (undefined/not yet seen)
    / | \
   1  2  3 ...  (known constants)
    \ | /
   Bottom (not a constant: multiple values reach here)
```

**Transfer function for `x = a + b`:**

$$\sigma'(x) = \begin{cases}
c_1 + c_2 & \text{if } \sigma(a) = c_1, \sigma(b) = c_2 \\
\top & \text{if } \sigma(a) = \top \text{ or } \sigma(b) = \top \\
\bot & \text{otherwise}
\end{cases}$$

**Meet:**

$$a \sqcap b = \begin{cases}
a & \text{if } b = \top \\
b & \text{if } a = \top \\
a & \text{if } a = b \\
\bot & \text{otherwise}
\end{cases}$$

### 3.3 Task

Implement constant propagation for this program:

```
B1: x = 10
    y = 20
    goto B2

B2: z = x + y
    w = z * 2
    if (w > 50) goto B3 else goto B4

B3: a = w + 1
    goto B5

B4: a = w - 1
    goto B5

B5: b = a + x
    return b
```

**Expected results after constant propagation and folding:**

- B1: x = 10, y = 20
- B2: z = 30, w = 60
- B2 branch: 60 > 50 is true, so goto B3 always (B4 becomes dead)
- B3: a = 61
- B5: b = 71, return 71

### 3.4 Implementation Sketch

```
Algorithm: ConstantPropagation(cfg)
1.  Run forward dataflow analysis with constant lattice
2.  For each instruction I in cfg:
3.      For each operand a of I:
4.          If constants[a] is a known constant c:
5.              Replace a with c in I
6.      Apply constant folding to I
7.  // Simplify branches with known conditions:
8.  For each conditional branch IF cond GOTO L1 ELSE L2:
9.      If cond is a known constant:
10.         Replace with unconditional GOTO to the true target
11.         Mark the other target as potentially dead
12. Run dead code elimination to remove unreachable blocks
```

---

## Exercise 4: Dead Code Elimination Pass

### 4.1 Two Types of Dead Code

1. **Dead definitions**: assignments to variables that are never used (not live after the definition).
2. **Unreachable code**: basic blocks that cannot be reached from the entry.

### 4.2 Algorithm: Dead Definition Elimination

```
Algorithm: DeadDefElimination(cfg)
Input: CFG with liveness information
Output: Modified CFG with dead definitions removed

1.  Run live variable analysis (backward)
2.  changed = true
3.  While changed:
4.      changed = false
5.      For each instruction I: x = expr:
6.          If x not in LiveOut[I]:  // x is dead after I
7.              If expr has no side effects:
8.                  Remove I from the CFG
9.                  changed = true
10.     // Removal may create new dead code, so iterate
```

### 4.3 Algorithm: Unreachable Code Elimination

```
Algorithm: UnreachableCodeElimination(cfg)
Input: CFG
Output: Modified CFG with unreachable blocks removed

1.  reachable = {}
2.  worklist = {entry}
3.  While worklist non-empty:
4.      b = worklist.remove()
5.      reachable.add(b)
6.      For each successor s of b:
7.          If s not in reachable:
8.              worklist.add(s)
9.  For each block b in cfg:
10.     If b not in reachable:
11.         Remove b from cfg
12.         Update predecessor/successor lists
```

### 4.4 Task

Apply dead code elimination to the result of Exercise 3 (after constant propagation). After the branch in B2 is resolved to always-goto-B3:

1. Block B4 becomes unreachable -- remove it.
2. The phi/merge at B5 simplifies (only one predecessor).
3. Check for any dead definitions introduced by constant propagation (e.g., if `z = 30` is used only in `w = z * 2` and both are folded, intermediate variables may become dead).

### 4.5 Combined Pass: Iterative Optimization

In practice, constant propagation and dead code elimination are run *iteratively* because each enables the other:

```
Algorithm: IterativeOptimization(cfg)
1.  Repeat until no changes:
2.      Run constant propagation
3.      Run constant folding
4.      Run dead code elimination (dead defs + unreachable)
5.      Run copy propagation (replace x = y with uses of y)
```

---

## Exercise 5: Putting It All Together

### 5.1 Complete Example

Start with this IR and apply all optimizations:

```
entry:
    a = 5
    b = 3
    c = a + b       // -> c = 8
    d = c * 2       // -> d = 16
    e = read()      // unknown value
    f = d + e
    if (c > 10) goto then_block else goto else_block

then_block:         // unreachable since c = 8 <= 10
    g = f + 100
    goto merge

else_block:
    g = f - 1
    goto merge

merge:
    h = g + a       // a = 5, g = f - 1
    i = b + b       // i = 6
    j = h + i
    return j
```

### 5.2 Expected Optimization Steps

1. **Constant propagation**: a=5, b=3, c=8, d=16.
2. **Branch resolution**: 8 > 10 is false, unconditional goto else_block.
3. **Unreachable code elimination**: remove then_block.
4. **Constant folding in merge**: i = 3 + 3 = 6.
5. **Simplification**: g = f - 1, h = g + 5 = f + 4, j = f + 4 + 6 = f + 10.
6. **Strength of copy propagation**: f = 16 + e, so j = 16 + e + 10 = e + 26.

**Final optimized program:**

```
entry:
    e = read()
    j = e + 26
    return j
```

All intermediate variables eliminated as dead code.

---

## Summary

These exercises demonstrate the core optimization pipeline:

1. **Analysis** (dataflow framework, reaching definitions, liveness, constant propagation) provides the information.
2. **Transformation** (constant folding, constant propagation, dead code elimination) uses that information to simplify the program.
3. **Iteration** is essential: each transformation may enable further analysis and further transformation.

The generic dataflow framework you build here is reusable across many analyses---the same worklist solver drives reaching definitions, liveness, available expressions, and constant propagation, with only the lattice and transfer functions changing.
