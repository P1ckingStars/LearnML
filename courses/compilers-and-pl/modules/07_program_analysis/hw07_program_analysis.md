# HW7: Program Analysis

**Due:** Two weeks from assignment date
**Total Points:** 100 (Part A: 40, Part B: 60)

---

## Part A: Theory (40 points)

### Problem 1: Dataflow Equations and Fixed-Point Computation (12 points)

Consider the following control flow graph:

```
         [entry]
            |
            v
          [B1]  d1: a = 1
            |        d2: b = 2
            v
          [B2]  d3: c = a + b
           / \
          /   \
         v     v
       [B3]  [B4]  d4: a = b + 1
  d5: b = 3       d6: c = a * 2
         \     /
          \   /
           v v
          [B5]  d7: d = a + b
            |        d8: a = d
            |
            v  (back edge to B2)
          [B6]
            |
            v
         [exit]
```

Assume B5 has a back edge to B2 (i.e., this is a loop B2--B5) and B6 is reached after the loop exits (e.g., from B5 via a conditional not shown).

**(a)** (4 pts) Compute the Gen and Kill sets for reaching definitions at each block.

**(b)** (6 pts) Solve the reaching definitions equations by hand. Show the state of In[B] and Out[B] for each block after each iteration of the worklist algorithm (use reverse postorder). Clearly indicate when the fixed point is reached.

**(c)** (2 pts) Identify which definitions of `a` reach the use of `a` in block B5 (`d7: d = a + b`). Explain how this information could be used by constant propagation.

---

### Problem 2: Lattice Proofs (10 points)

**(a)** (4 pts) Prove that the Gen/Kill transfer function $f(x) = \text{Gen} \cup (x \setminus \text{Kill})$ is *monotone* with respect to the subset ordering. That is, show that $A \subseteq B \implies f(A) \subseteq f(B)$.

**(b)** (3 pts) Prove that the same transfer function is *distributive*: $f(A \cup B) = f(A) \cup f(B)$.

**(c)** (3 pts) Consider the constant propagation lattice for a single variable: $\top$ (undefined), constant values $c_1, c_2, \ldots$, and $\bot$ (not constant). The meet is defined as:

$$x \sqcap y = \begin{cases} x & \text{if } y = \top \\ y & \text{if } x = \top \\ x & \text{if } x = y \\ \bot & \text{otherwise} \end{cases}$$

Consider the transfer function for `x = y + z` where $f(\sigma) = \sigma[x \mapsto \sigma(y) + \sigma(z)]$ (with the obvious extension of $+$ to the lattice). Show by counterexample that this transfer function is *not* distributive, i.e., find $\sigma_1, \sigma_2$ such that $f(\sigma_1 \sqcap \sigma_2) \neq f(\sigma_1) \sqcap f(\sigma_2)$.

---

### Problem 3: Alias Analysis (10 points)

Consider the following C-like program:

```c
1:  int a, b, c;
2:  int *p = &a;
3:  int *q = &b;
4:  int **r = &p;
5:  *r = q;          // p now points to b
6:  int *s = *r;
7:  *s = 10;
8:  int *t = &c;
9:  if (cond) {
10:     t = p;
11: }
12: printf(*t);
```

**(a)** (4 pts) Compute the points-to sets after each statement using *Andersen's analysis* (flow-insensitive). List pt(p), pt(q), pt(r), pt(s), pt(t) in the final result.

**(b)** (3 pts) Compute the points-to sets using *Steensgaard's analysis*. Show which variables are unified. Compare with Andersen's result---where does Steensgaard's lose precision?

**(c)** (3 pts) Now compute the points-to sets using a *flow-sensitive* analysis. At statement 12, what are the possible values of `*t`? Is this more precise than the flow-insensitive results?

---

### Problem 4: Loop Optimization (8 points)

Consider the following loop:

```c
for (i = 0; i < N; i++) {
    t = x * y;              // S1
    a[i] = t + i;           // S2
    b[i] = a[i] * z;        // S3
    c[i] = b[i-1] + 1;      // S4 (assume c[-1] = 0 for i=0)
}
```

**(a)** (2 pts) Identify all loop-invariant computations. Which can be safely moved to the preheader? Justify using the dominance conditions for LICM.

**(b)** (2 pts) Identify all induction variables and their families. Show how strength reduction would transform the loop.

**(c)** (2 pts) Analyze the data dependences in this loop. Draw the dependence graph for statements S1--S4. Which dependences are loop-carried?

**(d)** (2 pts) Can this loop be vectorized? If not, which dependence prevents it? Can any loop transformation (e.g., loop distribution) enable partial vectorization?

---

## Part B: Implementation (60 points)

### Overview

Implement a dataflow analysis framework, instantiate it with 2--3 analyses, and implement loop-invariant code motion (LICM). Your implementation will operate on a simple IR.

### IR Specification

Use the same IR from HW6, extended with explicit basic block labels:

```
FUNCTION name(params...)
  BLOCK L0:
    t = a OP b
    t = CONST
    t = a
    IF a CMP b GOTO L1 ELSE L2
    GOTO L
    CALL t = f(args...)
    RETURN a
  BLOCK L1:
    ...
END
```

### Task 1: Dataflow Analysis Framework (20 points)

Implement a generic dataflow analysis framework supporting:

1. **Forward and backward directions.**
2. **Configurable lattice** with meet operator.
3. **Worklist-based solver** with convergence detection.
4. **CFG representation** with predecessor/successor queries.

The framework should be parameterized so that different analyses can be instantiated by providing:
- The lattice type and operations (initial value, meet).
- The transfer function for each instruction or block.
- The direction (forward/backward).

### Task 2: Analysis Implementations (25 points)

Using your framework, implement at least **two** of the following three analyses (implement all three for bonus credit):

**(a) Reaching Definitions** (10 pts)
- Gen/Kill computation for each block.
- Verify on provided test cases.

**(b) Live Variable Analysis** (10 pts)
- Use/Def computation for each block.
- Verify correctness (useful for dead code elimination in Task 3).

**(c) Available Expressions** (10 pts if done as third analysis, 5 pts bonus)
- EGen/EKill computation.
- Useful for common subexpression elimination.

**For each analysis, provide:**
- Correctness argument (how does your implementation match the formal specification?).
- Output on at least 2 test cases showing the analysis results at each program point.

### Task 3: Loop-Invariant Code Motion (15 points)

Implement LICM:

1. **Loop detection**: identify natural loops (back edges, loop headers, loop bodies).
2. **Preheader insertion**: create preheader blocks for each loop.
3. **Loop-invariant identification**: mark instructions as loop-invariant using the reaching definitions analysis or SSA properties.
4. **Code motion**: move loop-invariant instructions to the preheader, checking the safety conditions:
   - The instruction dominates all loop exits where its result is live.
   - The result is not defined elsewhere in the loop.
5. **Correctness verification**: the transformed program must produce the same results as the original.

**Test cases** (IR will be provided):
- A loop with several invariant computations (some movable, some not due to safety conditions).
- A nested loop (invariant of the inner loop may be movable to the outer loop's preheader).
- A loop with no invariant code (LICM should make no changes).

### Grading Criteria

| Component | Points | Criteria |
|-----------|--------|----------|
| Framework | 20 | Generic design (5), forward support (5), backward support (5), convergence (5) |
| Analysis 1 | 10--12 | Correct Gen/Kill or Use/Def (5), correct fixed-point (5), test cases (2) |
| Analysis 2 | 10--12 | Same criteria as Analysis 1 |
| LICM | 15 | Loop detection (4), invariant identification (4), code motion with safety checks (5), test cases (2) |
| Bonus: 3rd analysis | 5 | Correct implementation and test cases |

### Submission

Submit a tarball or zip containing:
1. All source code with build instructions.
2. Test IR programs (at least 2 per analysis, 3 for LICM).
3. Output of each analysis on test programs (printed analysis results).
4. A brief report (1--2 pages) describing:
   - Your framework design (how analyses are parameterized).
   - Implementation decisions and challenges.
   - Correctness argument for each analysis.

### Hints

- Start with the framework and reaching definitions. Once those work, the other analyses are straightforward to add.
- For LICM, you will need a dominator tree. Implement a simple dominator computation or use the iterative dataflow approach (forward must-analysis where dom facts are sets of blocks).
- Test incrementally: verify each analysis independently before combining them for LICM.
- Edge cases to watch: empty loops, loops with a single block, nested loops, irreducible control flow (you may assume reducible CFGs for simplicity).

---

## Academic Integrity

This is an individual assignment. You may discuss high-level approaches with classmates, but all code must be your own. Cite any external references used.
