# Lecture 11d: Symbolic Execution & Software Verification

## 0. Motivation: Why Symbolic Execution?

Before diving into formalism, consider a concrete scenario. Suppose you are given the following C function that is meant to safely copy a user-supplied buffer:

```c
void safe_copy(int src[], int len, int dst[4]) {
    // Developer intends: copy at most 4 elements
    for (int i = 0; i <= len; i++) {   // BUG: should be i < len
        if (i >= 4) break;
        dst[i] = src[i];
    }
}
```

The bug is subtle: the loop condition is `i <= len` instead of `i < len`. When `len` is, say, `-1`, the developer expects no iteration, but `0 <= -1` is false, so that case is actually fine. The real problem is the off-by-one: when `len = 3`, the loop iterates for `i = 0, 1, 2, 3` -- four iterations -- which is one more than intended if the caller expected at most `len` copies (not `len + 1`). Depending on context, this is a classic fence-post error.

How would a testing approach find this? You would have to guess the right value of `len`. Random testing might stumble on it, or might not.

**Symbolic execution takes a different approach.** Instead of guessing concrete values, it runs the program with a *symbolic* input $\alpha_{\text{len}}$ and tracks what happens:

1. **Start:** `len` $= \alpha_{\text{len}}$, `i` $= 0$. Path condition: $\mathit{true}$.
2. **Loop guard:** Is $0 \le \alpha_{\text{len}}$? The symbolic executor *forks*:
   - **Path A:** $\alpha_{\text{len}} < 0$. Loop body never executes. No copy occurs.
   - **Path B:** $\alpha_{\text{len}} \ge 0$. Enter loop with `i = 0`. Check `i >= 4`: false. Copy `dst[0] = src[0]`. Increment `i = 1`.
3. **Continue unrolling** along Path B. At each iteration, the executor forks again on the loop guard and the `break` condition. After unrolling far enough, it discovers paths where `i` reaches values the programmer did not intend.
4. **Assert the intended property**, for example: "the number of elements written to `dst` is at most `min(len, 4)`." The executor queries an SMT solver: is there a value of $\alpha_{\text{len}}$ on any path where this property is violated? The solver answers *yes* and provides a concrete witness -- a counterexample you can run in a debugger.

This is the core idea: *execute all paths simultaneously using symbolic values, and let a solver find the inputs that trigger bugs.*

The rest of this lecture formalizes this idea, extends it to concolic execution and bounded model checking, and connects it to the broader landscape of program verification.

---

## 1. Classical Symbolic Execution

### 1.1 Origins and Intuition

Symbolic execution, introduced by James King (1976), executes a program with *symbolic* input values rather than concrete ones. Instead of computing concrete results, the execution builds up *symbolic expressions* and *path conditions* that characterize the behavior of each execution path.

**Key idea.** If a program has input $x$, instead of running it with $x = 5$, we run it with $x = \alpha$ (a symbolic value). Arithmetic produces symbolic expressions ($\alpha + 1$, $2\alpha - 3$), and conditionals produce *path conditions* ($\alpha > 0$, $\alpha \le 10$).

### 1.2 Symbolic State

**Definition.** A *symbolic state* is a triple $(\sigma, \pi, \ell)$ where:
- $\sigma : \text{Var} \to \text{SymExpr}$ is the *symbolic store*, mapping variables to symbolic expressions
- $\pi$ is the *path condition*, a conjunction of constraints over symbolic inputs
- $\ell$ is the current program location (program counter)

**Definition.** The *execution tree* is a tree where:
- Each node is a symbolic state
- Each leaf is either a *terminal state* (program exit) or a *stuck state* (infeasible path)
- Branching occurs at conditional statements

### 1.3 Execution Rules

For a simple imperative language with assignment, sequencing, conditionals, and loops:

**Assignment ($x := e$):**
$$(\sigma, \pi, \ell) \xrightarrow{x := e} (\sigma[x \mapsto \hat{e}], \pi, \ell')$$
where $\hat{e}$ is $e$ with variables replaced by their symbolic values in $\sigma$.

**Conditional ($\text{if } b \text{ then } S_1 \text{ else } S_2$):**

The execution *forks* into two branches:
$$(\sigma, \pi, \ell) \xrightarrow{\text{then}} (\sigma, \pi \land \hat{b}, \ell_1) \quad \text{if } \pi \land \hat{b} \text{ is satisfiable}$$
$$(\sigma, \pi, \ell) \xrightarrow{\text{else}} (\sigma, \pi \land \neg\hat{b}, \ell_2) \quad \text{if } \pi \land \neg\hat{b} \text{ is satisfiable}$$

where $\hat{b}$ is the symbolic evaluation of condition $b$. Infeasible branches (where the path condition is unsatisfiable) are pruned.

### 1.4 Full Algorithm

```
function SymbolicExecution(program, entryPoint):
    // Initialize symbolic state
    symbolicInputs := freshSymbolicVariables(program.inputs)
    initialState := (symbolicInputs, TRUE, entryPoint)
    worklist := {initialState}
    results := {}

    while worklist is not empty:
        (sigma, pi, loc) := pickState(worklist)
        stmt := program.getStatement(loc)

        switch stmt:
            case "x := e":
                symExpr := evaluate(e, sigma)
                sigma' := sigma[x -> symExpr]
                worklist.add((sigma', pi, nextLoc(loc)))

            case "if b then S1 else S2":
                symCond := evaluate(b, sigma)

                // Then branch
                piThen := pi AND symCond
                if isSatisfiable(piThen):    // SMT query
                    worklist.add((sigma, piThen, loc_S1))

                // Else branch
                piElse := pi AND NOT(symCond)
                if isSatisfiable(piElse):    // SMT query
                    worklist.add((sigma, piElse, loc_S2))

            case "assert(b)":
                symCond := evaluate(b, sigma)
                piViolation := pi AND NOT(symCond)
                if isSatisfiable(piViolation):    // SMT query
                    model := getModel(piViolation)
                    results.add(AssertionViolation(loc, model))
                // Continue on the path where assertion holds
                piSafe := pi AND symCond
                if isSatisfiable(piSafe):
                    worklist.add((sigma, piSafe, nextLoc(loc)))

            case "return e":
                results.add(PathResult(sigma, pi, evaluate(e, sigma)))

            case "while b do S":
                // Unroll or handle (see Section 2)
                ...

    return results
```

### 1.5 Simple Example: Absolute Value

Consider the program:

```
int abs(int x) {
    if (x < 0)
        return -x;
    else
        return x;
}
```

Symbolic execution with input $x = \alpha$:

- **Path 1:** $\alpha < 0$ -- returns $-\alpha$. Path condition: $\alpha < 0$.
- **Path 2:** $\alpha \ge 0$ -- returns $\alpha$. Path condition: $\alpha \ge 0$.

To test: "does `abs` ever return a negative value?", we query the SMT solver:
- Path 1: $\alpha < 0 \land -\alpha < 0$. Equivalent to $\alpha < 0 \land \alpha > 0$. UNSAT.
- Path 2: $\alpha \ge 0 \land \alpha < 0$. UNSAT.

Therefore `abs` never returns a negative value (for mathematical integers; bitvector overflow is a separate concern).

### 1.6 Detailed Worked Example: Multi-Input Program with a Loop

The `abs` example has no loops and only one input. Let us work through a more realistic example with two inputs, a loop, and an assertion that can fail.

**Program under test:**

```c
// Compute the sum of the first n elements of array a[],
// but cap each element at a threshold t before summing.
// Postcondition: result <= n * t  (should hold if code is correct)
int capped_sum(int a[], int n, int t) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        int val = a[i];
        if (val > t)
            val = t;
        // BUG: forgot the case val < 0; negative values pass through uncapped
        sum = sum + val;
    }
    assert(sum <= n * t);  // Can this fail?
    return sum;
}
```

For symbolic execution, we fix $n = 2$ (unroll the loop twice) and use symbolic inputs $a[0] = \alpha_0$, $a[1] = \alpha_1$, and $t = \tau$.

**Execution tree (unrolled to $n = 2$):**

```
                    sigma = {sum=0, i=0, n=2, t=tau, a[0]=alpha0, a[1]=alpha1}
                    pi = true
                    loc = loop_guard
                         |
                    [i < n?  i.e., 0 < 2: always true]
                         |
                    val = a[0] = alpha0
                         |
                 [val > t?  i.e., alpha0 > tau]
                /                              \
         (TRUE branch)                    (FALSE branch)
         val = tau                        val = alpha0
         sum = 0 + tau = tau              sum = 0 + alpha0 = alpha0
         i = 1                            i = 1
         pi: alpha0 > tau                 pi: alpha0 <= tau
              |                                |
         [i < n? 1 < 2: true]            [i < n? 1 < 2: true]
              |                                |
         val = a[1] = alpha1              val = a[1] = alpha1
              |                                |
       [alpha1 > tau]                   [alpha1 > tau]
        /          \                     /          \
    Path A       Path B             Path C       Path D
```

**Four leaf paths with their symbolic states:**

| Path | Path Condition $\pi$ | `sum` at assertion |
|------|---------------------|--------------------|
| A | $\alpha_0 > \tau \;\land\; \alpha_1 > \tau$ | $\tau + \tau = 2\tau$ |
| B | $\alpha_0 > \tau \;\land\; \alpha_1 \le \tau$ | $\tau + \alpha_1$ |
| C | $\alpha_0 \le \tau \;\land\; \alpha_1 > \tau$ | $\alpha_0 + \tau$ |
| D | $\alpha_0 \le \tau \;\land\; \alpha_1 \le \tau$ | $\alpha_0 + \alpha_1$ |

**Checking the assertion** `sum <= n * t`, i.e., $\text{sum} \le 2\tau$, on each path:

- **Path A:** $2\tau \le 2\tau$. Always true. No violation.
- **Path B:** We query the SMT solver for $(\alpha_0 > \tau) \land (\alpha_1 \le \tau) \land (\tau + \alpha_1 > 2\tau)$. Simplifying: $\alpha_1 > \tau$. But the path condition says $\alpha_1 \le \tau$. Contradiction. UNSAT. No violation.
- **Path C:** Symmetric to Path B. UNSAT. No violation.
- **Path D:** We query for $(\alpha_0 \le \tau) \land (\alpha_1 \le \tau) \land (\alpha_0 + \alpha_1 > 2\tau)$. Is this satisfiable? If $\alpha_0 \le \tau$ and $\alpha_1 \le \tau$, then $\alpha_0 + \alpha_1 \le 2\tau$... *unless the values are negative and $\tau$ is negative too*. Wait -- actually, the issue is different. With uncapped negative values, `sum` can be less than zero, and the assertion `sum <= n * t` would hold (since $n \cdot t$ could be large). The real bug shows up differently.

Let us reconsider. Suppose $\tau = 5$, $\alpha_0 = -100$, $\alpha_1 = -100$. Then `sum = -200` and $n \cdot t = 10$. The assertion $-200 \le 10$ holds. So the assertion as stated does not catch the bug. Let us add a *stronger* assertion that exposes the real defect:

```c
assert(sum >= 0);  // Should hold if all values are capped to [0, t]
```

Now re-check Path D: $(\alpha_0 \le \tau) \land (\alpha_1 \le \tau) \land (\alpha_0 + \alpha_1 < 0)$.

**SMT query:** $\alpha_0 \le \tau \land \alpha_1 \le \tau \land \alpha_0 + \alpha_1 < 0$

**Result: SAT.** The solver returns a model, e.g.:

$$\alpha_0 = -3, \quad \alpha_1 = -2, \quad \tau = 5$$

**Counterexample:** `a = {-3, -2}, n = 2, t = 5`. Running concretely: neither $-3$ nor $-2$ exceeds $5$, so the capping branch is never taken, `sum = -5`, and the assertion `sum >= 0` fails. The bug is confirmed: the function does not handle negative array values.

This example illustrates several important points:
- Symbolic execution *systematically* explores all paths through the loop body.
- At each branch, the SMT solver checks feasibility, pruning impossible paths.
- When an assertion violation is possible, the solver produces a *concrete* counterexample that a developer can use to reproduce and debug the issue.
- Choosing the right assertion matters -- weak assertions miss bugs even when symbolic execution covers the relevant paths.

---

## 2. The Path Explosion Problem

### 2.1 Exponential Blowup

The number of paths through a program is, in the worst case, exponential in the number of branch points. For $n$ sequential if-else statements, there are $2^n$ paths. For loops with $k$ iterations, unrolling produces $k$ iterations worth of branching.

**Theorem.** For a program with $n$ branch points and no loops, the number of execution paths is $O(2^n)$.

For a program with a loop executed up to $k$ times with $b$ branches per iteration, the number of paths is $O(b^k)$.

### 2.2 Visualizing Path Explosion

To build intuition, consider this tiny program with just three independent if-else statements:

```c
void example(int a, int b, int c) {
    int x = 0;
    if (a > 0) { x += 1; } else { x += 2; }   // Branch 1: 2 choices
    if (b > 0) { x += 4; } else { x += 8; }   // Branch 2: 2 choices
    if (c > 0) { x += 16; } else { x += 32; } // Branch 3: 2 choices
    // ... use x ...
}
```

The execution tree looks like this:

```
                            [a > 0?]
                           /        \
                     (yes)            (no)
                     x=1              x=2
                    /    \           /    \
              [b>0?]      [b>0?] [b>0?]   [b>0?]
              /   \       /   \   /   \    /   \
            x=5   x=9  x=6 x=10 x=6 x=10 x=7 x=11
            ...   ...  ...  ...  ...  ... ...  ...
```

At depth 3, we have $2^3 = 8$ paths. Each path has a unique path condition:

| Path | Condition | Final `x` |
|------|-----------|-----------|
| 1 | $a > 0 \land b > 0 \land c > 0$ | $1 + 4 + 16 = 21$ |
| 2 | $a > 0 \land b > 0 \land c \le 0$ | $1 + 4 + 32 = 37$ |
| 3 | $a > 0 \land b \le 0 \land c > 0$ | $1 + 8 + 16 = 25$ |
| ... | ... | ... |
| 8 | $a \le 0 \land b \le 0 \land c \le 0$ | $2 + 8 + 32 = 42$ |

Now extrapolate. A real function might have 30 branches, yielding $2^{30} \approx 10^9$ paths. A function with a loop containing 2 branches, iterated 20 times, yields $2^{20} \approx 10^6$ paths *per loop*. Nested loops and function calls compound this further. A modest program with a few hundred branches can have more paths than atoms in the observable universe.

This is why *path explosion mitigation* (the techniques in the following subsections) is the central engineering challenge of symbolic execution.

### 2.3 Search Strategies

Different strategies for exploring the execution tree:

**DFS (Depth-First Search).** Explore one path to completion before backtracking. Memory-efficient but may get stuck in deep paths (e.g., long loops).

**BFS (Breadth-First Search).** Explore all paths level by level. Finds shortest paths first but uses more memory.

**Coverage-guided.** Prioritize paths that reach new code locations. Combines symbolic execution with coverage metrics.

**Random path selection.** At each fork, randomly choose a branch. Provides probabilistic coverage guarantees.

### 2.4 Path Merging (Veritesting)

Avgerinos et al. (2014) proposed *Veritesting*: instead of forking at every branch, merge paths by encoding the branch outcome as an ITE (if-then-else) expression.

For a diamond-shaped CFG:
```
if (c) { x = e1; } else { x = e2; }
```

Instead of two separate paths, create one path with $x = \text{ITE}(\hat{c}, \hat{e}_1, \hat{e}_2)$.

**Trade-off.** Path merging reduces the number of paths but produces more complex symbolic expressions, making SMT queries harder.

### 2.5 State Merging

More generally, when two symbolic states $(\sigma_1, \pi_1, \ell)$ and $(\sigma_2, \pi_2, \ell)$ reach the same program point $\ell$, they can be merged:

$$\sigma_{\text{merged}}(x) = \text{ITE}(\pi_1, \sigma_1(x), \sigma_2(x))$$
$$\pi_{\text{merged}} = \pi_1 \lor \pi_2$$

### 2.6 Function Summarization

Compute a *summary* for each function: a relation between inputs and outputs. Reuse the summary at each call site instead of re-exploring the function.

$$\text{Summary}(f) = \bigvee_{\text{path } p} (\pi_p \land \text{out} = e_p)$$

Summaries can be computed lazily (on-demand) or eagerly (for all functions).

---

## 3. Concolic Execution

### 3.1 DART: Directed Automated Random Testing

Godefroid, Klarlund, and Sen (2005) introduced *concolic execution* (concrete + symbolic) in DART:

1. **Run the program concretely** with initial random inputs.
2. **Simultaneously collect symbolic constraints** along the executed path.
3. **Negate one constraint** in the path condition to explore a new path.
4. **Solve the modified path condition** using an SMT solver to get new concrete inputs.
5. **Repeat.**

```
function Concolic(program, maxIter):
    inputs := randomInputs()
    explored := {}

    for i := 1 to maxIter:
        // Concrete execution with symbolic tracking
        (pathCondition, output) := executeWithSymbolicTracking(program, inputs)

        explored.add(pathCondition)

        // Choose a branch to flip
        constraints := splitConjuncts(pathCondition)
        for j := len(constraints) downto 1:
            // Negate the j-th constraint, keep constraints 1..j-1
            newPC := constraints[1..j-1] AND NOT(constraints[j])
            if newPC not in explored:
                if isSatisfiable(newPC):
                    inputs := getModel(newPC)
                    break

    return allBugsFound
```

### 3.2 Advantages of Concolic Execution

1. **Handles complex operations.** If the symbolic representation of an operation is too complex (e.g., calls to libraries, system calls, floating-point), use the concrete value as a fallback. This sacrifices completeness but maintains progress.

2. **Avoids the environment problem.** Concrete execution interacts with the real OS, file system, network. Only the parts that affect branching need symbolic modeling.

3. **Incremental exploration.** Each run covers one complete path; new runs systematically explore neighbors.

### 3.3 Concolic Execution: Complete Worked Example

Consider this program:

```c
int classify(int x, int y) {
    if (x > 0) {            // Branch 1
        if (y > x) {        // Branch 2
            return 1;        // Region A
        } else {
            return 2;        // Region B
        }
    } else {
        if (y < -10) {      // Branch 3
            return 3;        // Region C
        } else {
            return 4;        // Region D
        }
    }
}
```

We want to cover all four return statements (regions A through D). Let us trace concolic execution step by step.

**Iteration 1: Random initial inputs.**

Choose $x = 7$, $y = 3$ (randomly generated).

- *Concrete execution:* $x = 7 > 0$, so take the then-branch. $y = 3 > 7$? No, so take the else-branch. Return 2 (Region B).
- *Symbolic path condition collected:* $\alpha_x > 0 \;\land\; \alpha_y \le \alpha_x$
- *Constraints list:* $[c_1: \alpha_x > 0, \;\; c_2: \alpha_y \le \alpha_x]$
- *Paths explored:* $\{B\}$

**Iteration 2: Negate the last constraint.**

We negate $c_2$ while keeping $c_1$:

$$\text{New PC} = \alpha_x > 0 \;\land\; \alpha_y > \alpha_x$$

SMT solver returns: $\alpha_x = 1, \alpha_y = 2$. We re-run with $x = 1, y = 2$.

- *Concrete execution:* $x = 1 > 0$: then-branch. $y = 2 > 1$: then-branch. Return 1 (Region A).
- *Symbolic path condition:* $\alpha_x > 0 \;\land\; \alpha_y > \alpha_x$
- *Paths explored:* $\{B, A\}$

**Iteration 3: Negate to explore the other top-level branch.**

We have already explored both sub-branches under $\alpha_x > 0$. Now negate $c_1$ from Iteration 2's path:

$$\text{New PC} = \alpha_x \le 0$$

SMT solver returns: $\alpha_x = 0, \alpha_y = 0$. Re-run with $x = 0, y = 0$.

- *Concrete execution:* $x = 0 > 0$? No: else-branch. $y = 0 < -10$? No: else-branch. Return 4 (Region D).
- *Symbolic path condition:* $\alpha_x \le 0 \;\land\; \alpha_y \ge -10$
- *Paths explored:* $\{B, A, D\}$

**Iteration 4: Negate the last constraint of Iteration 3.**

$$\text{New PC} = \alpha_x \le 0 \;\land\; \alpha_y < -10$$

SMT solver returns: $\alpha_x = 0, \alpha_y = -11$. Re-run with $x = 0, y = -11$.

- *Concrete execution:* $x = 0 > 0$? No: else-branch. $y = -11 < -10$? Yes: then-branch. Return 3 (Region C).
- *Symbolic path condition:* $\alpha_x \le 0 \;\land\; \alpha_y < -10$
- *Paths explored:* $\{B, A, D, C\}$

**Result:** Full path coverage achieved in 4 iterations. Each iteration required exactly one SMT query to generate new inputs. Compare this with pure random testing, which would need to *guess* inputs in each region -- particularly Region C (requiring $x \le 0$ and $y < -10$) could take many random attempts.

**Key observations from this example:**

- Concolic execution is *directed*: each iteration targets unexplored code by systematically negating constraints.
- The algorithm works from the *last* constraint backward, which tends to explore nearby paths first (a form of local search).
- When the solver returns UNSAT for a negated constraint, that sub-tree is fully explored, and the algorithm moves to the next constraint.
- Each concrete run provides a "fallback" -- even if the symbolic engine cannot handle some operation (e.g., a hash function), the concrete value allows execution to continue.

### 3.4 SAGE: Scalable Automated Guided Execution

SAGE (Godefroid, Levin, Molnar 2008) at Microsoft applies concolic execution to security testing of file parsers. It has found numerous security vulnerabilities in Windows applications.

**Key innovations:**
- Start from well-formed seed inputs (e.g., valid JPEG files).
- Use *generational search*: negate multiple constraints at once, not just one.
- Prioritize constraints that are likely to reach new code.

---

## 4. Bounded Model Checking

### 4.1 Idea

Bounded model checking (BMC), introduced by Biere et al. (1999), checks whether a program can violate a safety property within $k$ execution steps.

**Encoding.** Given a transition system $(I, T, P)$:
- $I(s_0)$: initial state predicate
- $T(s_i, s_{i+1})$: transition relation (one step of execution)
- $P(s_i)$: safety property (should hold at every reachable state)

The BMC formula for bound $k$:

$$\text{BMC}(k) = I(s_0) \land \bigwedge_{i=0}^{k-1} T(s_i, s_{i+1}) \land \bigvee_{i=0}^{k} \neg P(s_i)$$

If $\text{BMC}(k)$ is satisfiable, the model gives a counterexample of length $\le k$.
If $\text{BMC}(k)$ is unsatisfiable, no counterexample of length $\le k$ exists.

### 4.2 Loop Unrolling for Programs

For a C program, BMC works by:

1. **Unroll all loops up to bound $k$.**
2. **Convert to Static Single Assignment (SSA) form.**
3. **Encode each SSA statement as an SMT constraint.**
4. **Add property violations as assertions.**
5. **Feed to an SMT solver.**

**Example.** The program:
```c
int x = 0;
for (int i = 0; i < 3; i++) {
    x = x + i;
}
assert(x == 3);
```

Unrolled to $k = 3$:
```
x0 = 0; i0 = 0;
// Iteration 1: i0 < 3 is true
x1 = x0 + i0;  // x1 = 0
i1 = i0 + 1;    // i1 = 1
// Iteration 2: i1 < 3 is true
x2 = x1 + i1;  // x2 = 1
i2 = i1 + 1;    // i2 = 2
// Iteration 3: i2 < 3 is true
x3 = x2 + i2;  // x3 = 3
i3 = i2 + 1;    // i3 = 3
// i3 < 3 is false: loop exits
assert(x3 == 3);
```

SMT encoding: $x_0 = 0 \land i_0 = 0 \land x_1 = x_0 + i_0 \land i_1 = i_0 + 1 \land x_2 = x_1 + i_1 \land i_2 = i_1 + 1 \land x_3 = x_2 + i_2 \land i_3 = i_2 + 1 \land \neg(x_3 = 3)$

The solver returns UNSAT, confirming the assertion holds.

### 4.3 BMC Worked Example: Finding a Real Bug

Consider this buggy function:

```c
int find_max(int a, int b, int c) {
    int m = a;
    if (b > m)
        m = b;
    if (c > a)   // BUG: should be c > m
        m = c;
    assert(m >= a && m >= b && m >= c);
    return m;
}
```

The bug is on line 5: the comparison `c > a` should be `c > m`. This means when $b > a$ and $c > a$ but $c < b$, the function incorrectly sets $m = c$ instead of keeping $m = b$.

**Step 1: SSA encoding.**

Using symbolic inputs $\alpha, \beta, \gamma$ for `a, b, c`:

```
m0 = alpha
guard1 = (beta > m0)
m1 = ITE(guard1, beta, m0)
guard2 = (gamma > alpha)          // BUG: uses alpha, not m1
m2 = ITE(guard2, gamma, m1)
```

**Step 2: Negate the assertion.**

The assertion is $m_2 \ge \alpha \;\land\; m_2 \ge \beta \;\land\; m_2 \ge \gamma$. We want to find inputs where this fails:

$$\Phi = (m_0 = \alpha) \;\land\; (m_1 = \text{ITE}(\beta > m_0,\; \beta,\; m_0)) \;\land\; (m_2 = \text{ITE}(\gamma > \alpha,\; \gamma,\; m_1))$$
$$\land\; \neg(m_2 \ge \alpha \;\land\; m_2 \ge \beta \;\land\; m_2 \ge \gamma)$$

**Step 3: SMT solver result -- SAT.**

The solver returns a satisfying assignment (a counterexample):

$$\alpha = 1, \quad \beta = 10, \quad \gamma = 5$$

**Step 4: Verify the counterexample concretely.**

- `m = a = 1`
- `b > m`? $10 > 1$: yes. `m = b = 10`.
- `c > a`? $5 > 1$: yes. `m = c = 5`. (Here is the bug: we should have checked `c > m`, i.e., $5 > 10$, which is false.)
- Assertion: $m \ge a$? $5 \ge 1$: yes. $m \ge b$? $5 \ge 10$: **NO**. Assertion fails.

The solver found a concrete input triple that triggers the bug. The developer can now see that the comparison on line 5 should use `m` (the current maximum) rather than `a` (the first input).

### 4.4 CBMC: C Bounded Model Checker

CBMC (Clarke, Kroening, Lerda 2004) is the leading BMC tool for C:

**Architecture:**
```
C source -> C frontend -> GOTO program -> SSA -> SMT encoding -> solver
                                            |
                                     loop unwinding
                                     (with unwinding assertions)
```

**Key features:**
- Full C semantics: pointers, arrays, structs, bitwise operations, floating-point
- Bitvector-precise encoding (no integer abstraction)
- Unwinding assertions: adds $\neg(\text{loop guard})$ after the last unrolling to check if the bound is sufficient
- Supports multiple backends: MiniSat, Z3, Boolector

**Getting started with CBMC.** Save the `find_max` example above as `find_max.c` and run:

```bash
$ cbmc find_max.c --function find_max
```

CBMC will produce output similar to:

```
CBMC version 5.95.1
Parsing find_max.c
Converting
Type-checking find_max
Generating GOTO Program
...
** Results:
[find_max.assertion.1] line 6 assertion m >= a && m >= b && m >= c: FAILURE

Trace for find_max.assertion.1:
  State 1: a=1 b=10 c=5
  ...
  State 4: m=5 (from assignment m = c)
  Violated property:
    assertion m >= a && m >= b && m >= c
    m >= b is false (5 >= 10)

** 1 of 1 failed
VERIFICATION FAILED
```

The trace gives you the concrete counterexample ($a=1, b=10, c=5$) and shows exactly which part of the assertion fails.

### 4.5 Completeness: Loop Unwinding Assertions

BMC is inherently incomplete: if the bound $k$ is too small, a real bug may be missed. *Unwinding assertions* provide a partial solution.

**Definition.** An *unwinding assertion* for a loop at bound $k$ asserts that the loop would not execute a $(k+1)$-th iteration:

After unrolling a `while(c)` loop $k$ times, add: `assert(!c)`.

If the unwinding assertion holds (UNSAT), then the loop executes at most $k$ times for all inputs, and BMC at bound $k$ is *complete* for this loop.

If the unwinding assertion fails (SAT), there exists an input causing more than $k$ iterations, and the bound should be increased.

---

## 5. Program Verification

### 5.1 Verification Condition Generation

Given a program annotated with pre/postconditions and loop invariants, *verification condition generation* (VCGen) produces logical formulas whose validity implies program correctness.

**Connection to Hoare Logic (Module 04).** The Hoare triple $\{P\} S \{Q\}$ means: if $P$ holds before $S$, then $Q$ holds after $S$ (assuming $S$ terminates for partial correctness).

VCGen computes the *weakest precondition* $\text{wp}(S, Q)$:

$$\text{wp}(x := e, Q) = Q[e/x]$$
$$\text{wp}(S_1; S_2, Q) = \text{wp}(S_1, \text{wp}(S_2, Q))$$
$$\text{wp}(\text{if } b \text{ then } S_1 \text{ else } S_2, Q) = (b \implies \text{wp}(S_1, Q)) \land (\neg b \implies \text{wp}(S_2, Q))$$

For loops with invariant $I$:
$$\text{wp}(\text{while } b \text{ do } S \text{ [inv: } I\text{]}, Q) = I$$

with side conditions (verification conditions):
1. $I \land b \implies \text{wp}(S, I)$ (invariant preservation)
2. $I \land \neg b \implies Q$ (post-condition at exit)

The verification condition for $\{P\} S \{Q\}$ is: $P \implies \text{wp}(S, Q)$ conjoined with all loop VCs. This formula is discharged by an SMT solver.

### 5.2 Predicate Abstraction

**Definition.** Given a set of predicates $\{p_1, \ldots, p_k\}$ over program variables, *predicate abstraction* represents program states as Boolean combinations of these predicates.

The abstract domain is $\mathbb{B}^k$ (one Boolean per predicate). The concrete state $s$ is abstracted as:

$$\alpha(s) = (p_1(s), p_2(s), \ldots, p_k(s))$$

The abstract transfer function is computed using an SMT solver:
$$f^\sharp(b_1, \ldots, b_k) = (\exists \vec{x}.\, \bigwedge_i (p_i \leftrightarrow b_i) \land T(\vec{x}, \vec{x}') \implies p_j(\vec{x}'))$$

Predicate abstraction produces a finite-state Boolean program, which can be model-checked.

### 5.3 CEGAR: CounterExample-Guided Abstraction Refinement

CEGAR (Clarke et al. 2003) iteratively refines the set of predicates:

```
function CEGAR(program, property):
    predicates := initialPredicates()

    while true:
        // Abstract
        boolProgram := predicateAbstraction(program, predicates)

        // Model check
        result := modelCheck(boolProgram, property)

        if result == SAFE:
            return SAFE

        // Counterexample
        cex := result.counterexample

        // Check feasibility
        if isFeasible(cex, program):
            return UNSAFE(cex)

        // Refine: find new predicates that rule out spurious cex
        newPredicates := analyzeSpuriousCex(cex, program)
        predicates := predicates union newPredicates
```

**Key step: Refinement.** Given a spurious counterexample (feasible in the abstraction but infeasible in the concrete program), find predicates that distinguish the spurious path from real paths. Craig interpolation is the standard technique:

**Theorem (Craig 1957).** If $A \land B$ is unsatisfiable, there exists a formula $I$ (the *interpolant*) such that:
1. $A \implies I$
2. $I \land B$ is unsatisfiable
3. $I$ only mentions variables common to $A$ and $B$

Interpolants along the counterexample path provide new predicates.

### 5.4 CEGAR: Step-by-Step Worked Example

To make CEGAR concrete, consider this small program with variables `x`, `y`, `lock`:

```c
void driver() {
    int x = 0, y = 0, lock = 0;

    while (x < 100) {
        lock = 1;       // acquire lock
        y = x + 1;
        x = y;
        lock = 0;       // release lock
    }

    assert(lock == 0);  // Property: lock must be released at exit
}
```

The property is: when the loop exits, `lock` must be 0. This is clearly true (the release always happens before the loop guard is re-checked), but let us see how CEGAR proves it.

**Round 1: Initial coarse abstraction.**

We start with a single predicate: $p_1: \text{lock} = 0$.

The abstract Boolean program tracks only whether $p_1$ is true or false:

```
Abstract program:
    p1 = true              // lock = 0 initially
    while (*):             // x < 100 abstracted to nondeterministic
        p1 = false         // lock = 1 (p1 becomes false)
        p1 = true          // lock = 0 (p1 becomes true again)
    assert(p1)
```

Wait -- the loop guard `x < 100` has been abstracted to nondeterministic choice (`*`), because our predicate set says nothing about `x`. The model checker checks: can we reach `assert(p1)` with `p1 = false`?

Within each loop iteration, `p1` goes false then true. The model checker finds: the loop can exit *at any point* (because the guard is nondeterministic). In particular, it can exit right after `p1 = false` (i.e., right after acquiring the lock but before releasing it).

**Spurious counterexample found:**

```
x=0, y=0, lock=0  -->  lock=1  -->  [loop exits]  -->  assert(lock==0) FAILS
```

The abstract model says: enter loop, set `lock = 1`, then the loop exits. But this is *spurious*: in the concrete program, the loop body always completes fully (both `lock = 1` and `lock = 0` execute) before the guard is re-checked.

**Round 2: Analyze the spurious counterexample.**

Why is the counterexample infeasible? The exit from the loop happens at the loop guard `x < 100`. After `lock = 1`, the next statements `y = x + 1; x = y; lock = 0` execute *before* the guard is checked again. The abstract model incorrectly allows exiting mid-body.

The concrete path in the counterexample is:
- $A$: $(x_0 = 0) \land (lock_1 = 1)$ (loop entry, acquire lock)
- $B$: $(x_1 \ge 100)$ (loop exits immediately)

But $A \land B$ requires $x_1 \ge 100$, while $A$ implies $x_1 = x_0 + 1 = 1$. So $A \land B$ is unsatisfiable.

Using Craig interpolation on the split $(A, B)$:
- $A$ implies $x_1 = 1$
- $B$ requires $x_1 \ge 100$
- Interpolant: $x < 100$ (mentioning the common variable $x$)

**New predicate discovered:** $p_2: x < 100$.

**Round 3: Refined abstraction.**

Now the abstract program tracks two predicates: $p_1: \text{lock} = 0$ and $p_2: x < 100$.

```
Abstract program:
    p1 = true, p2 = true     // lock=0, x=0 < 100
    while (p2):               // loop while x < 100
        p1 = false            // lock = 1
        p2 = * or p2          // y = x+1; x = y (can't determine x < 100)
        p1 = true             // lock = 0
    assert(p1)
```

Now the loop guard is $p_2$ (not fully nondeterministic). Within the loop body, `lock` goes to 1 then back to 0 before the guard is re-checked. The model checker finds: at the point where `p2` becomes false (loop exit), `p1` is always true (lock has been released). No counterexample found.

**CEGAR returns SAFE.** The program is verified with two predicates: $\text{lock} = 0$ and $x < 100$.

**Key observations:**
- The initial abstraction was too coarse and produced a spurious counterexample.
- Interpolation identified the missing predicate ($x < 100$) that the abstraction needed to distinguish real from spurious executions.
- The refined abstraction was precise enough to prove the property, without tracking the exact value of $x$ -- just whether $x < 100$.
- CEGAR often converges in a small number of rounds, even for programs with large state spaces.

### 5.5 The SLAM/SDV Project

SLAM (Ball, Rajamani 2001) and its successor Static Driver Verifier (SDV) applied CEGAR to verify Windows device drivers against API usage rules.

**Architecture:**
1. **C2BP:** C-to-Boolean-Program abstraction via predicate abstraction.
2. **Bebop:** Boolean program model checker.
3. **Newton:** Counterexample-guided refinement.

SDV ships with the Windows Driver Kit and has been mandatory for driver certification. It has found thousands of bugs in production drivers.

---

## 6. Choosing the Right Verification Tool

Different verification techniques excel in different scenarios. The following guide summarizes the practical trade-offs.

### 6.1 Decision Factors

When choosing a verification approach, consider these factors:

1. **What is the property?** Safety (nothing bad happens), liveness (something good eventually happens), functional correctness (output matches specification), or absence of runtime errors (no buffer overflows, no division by zero)?

2. **What is the program structure?** Loop-free, bounded loops, unbounded loops, recursion, concurrency?

3. **How much automation do you need?** Fully push-button, or can a developer write annotations?

4. **What is the acceptable cost of failure?** Is a missed bug catastrophic (avionics, medical devices) or merely expensive (web application)?

### 6.2 Decision Guide

```
START: What do you want to achieve?
  |
  +---> "Find bugs quickly, no guarantees needed"
  |       |
  |       +---> Program has complex input formats?
  |       |       YES --> Concolic execution / fuzzing (SAGE, AFL)
  |       |       NO  --> Symbolic execution (KLEE) or random testing
  |
  +---> "Prove absence of bugs (runtime errors) automatically"
  |       |
  |       +---> Loops are bounded or small bound suffices?
  |       |       YES --> Bounded model checking (CBMC)
  |       |       NO  --> Abstract interpretation (Astree, Polyspace)
  |       |               or predicate abstraction + CEGAR (SLAM)
  |
  +---> "Prove full functional correctness"
  |       |
  |       +---> Willing to write specifications and invariants?
  |       |       YES --> Deductive verification (Frama-C, Dafny)
  |       |       NO  --> Not feasible with current technology
  |
  +---> "Highest possible assurance (safety-critical)"
          |
          +---> Proof assistant (Coq, Lean 4, Isabelle)
                  Requires significant expert effort
```

### 6.3 Comparison Summary

| Scenario | Recommended approach | Tool examples | Effort |
|----------|---------------------|---------------|--------|
| Buffer overflow detection in C | BMC or symbolic execution | CBMC, KLEE | Low (push-button) |
| Device driver API compliance | CEGAR | SDV/SLAM | Low (rules predefined) |
| Compiler optimization correctness | SMT-based equivalence | Alive2 | Medium (pattern specs) |
| Numerical code (no overflows) | Abstract interpretation | Astree | Low to medium |
| Full functional correctness | Deductive verification | Dafny, Frama-C | High (annotations) |
| Verified compiler/OS kernel | Proof assistant | CompCert (Coq), seL4 | Very high |
| Security fuzzing of parsers | Concolic execution | SAGE, AFL + symbolic | Low (seed inputs) |

The key insight is that these techniques are *complementary*, not competing. Industrial verification workflows often combine multiple approaches: use fuzzing and symbolic execution for rapid bug-finding during development, apply BMC and abstract interpretation in CI pipelines, and reserve deductive verification or proof assistants for the most critical components.

---

## 7. Compiler-Specific Applications

### 7.1 Translation Validation Using Symbolic Execution

Instead of verifying the compiler itself, *translation validation* (Pnueli, Siegel, Singerman 1998) checks each compilation run: given source $S$ and compiled output $T$, verify that $S$ and $T$ are semantically equivalent.

**Approach:**
1. Symbolically execute both $S$ and $T$ on the same symbolic inputs.
2. At each corresponding program point, check that the symbolic states are equivalent.
3. Use an SMT solver to verify the equivalences.

### 7.2 Equivalence Checking of Compiler Optimizations

For an optimization that transforms $S$ to $T$:

$$\forall \vec{x}.\, \text{defined}(S, \vec{x}) \implies S(\vec{x}) = T(\vec{x})$$

This is valid iff the negation is UNSAT:

$$\exists \vec{x}.\, \text{defined}(S, \vec{x}) \land S(\vec{x}) \ne T(\vec{x})$$

### 7.3 Alive and Alive2

**Alive** (Lopes et al. 2015) and **Alive2** (Lopes et al. 2021) verify LLVM peephole optimizations:

**Alive2 workflow:**
1. Parse the source and target LLVM IR patterns.
2. Encode semantics as SMT formulas over bitvectors (matching LLVM's exact semantics for `undef`, `poison`, UB).
3. Check *refinement*: the target refines the source. This means:
   - If the source is defined, the target must be defined.
   - If both are defined, they must produce the same result.
   - The target may have *fewer* undefined behaviors.
4. The refinement check is a single $\forall$ query, negated and solved by Z3.

**Results:** Alive2 has found numerous bugs in LLVM's InstCombine, including incorrect transformations of `select`, `icmp`, and integer overflow-related optimizations. It runs as part of LLVM's continuous integration.

### 7.4 Fuzzing Compiler Correctness

**CSmith** (Yang et al. 2011) generates random C programs and checks for miscompilations by comparing the output of different compilers and optimization levels. CSmith found over 300 bugs in GCC and LLVM.

**YARPGen** (Livinskii et al. 2020) is a newer random program generator designed to stress-test specific optimization patterns.

**Connection to symbolic execution:** Generated programs can be further analyzed with symbolic execution to understand *why* a miscompilation occurred and to construct minimal test cases.

---

## 8. Modern Tools

### 8.1 KLEE: Symbolic Execution for LLVM

KLEE (Cadar, Dunbar, Engler 2008) performs symbolic execution on LLVM bitcode:

**Architecture:**
```
C source -> clang -> LLVM IR -> KLEE
                                 |
                        symbolic execution engine
                                 |
                    +-----+------+------+
                    |     |      |      |
                  path1  path2  path3  ...
                    |     |      |      |
                  STP/Z3 queries for feasibility
                    |
              test inputs / bug reports
```

**Key features:**
- Operates on LLVM IR (handles C, C++, and anything that compiles to LLVM)
- Models memory precisely: symbolic pointers, array bounds
- Environment modeling: models parts of POSIX (files, sockets)
- Heuristics: coverage-guided search, random path selection
- State forking: copy-on-write memory for efficient forking

**Notable result:** KLEE achieved over 90% line coverage on GNU Coreutils and found bugs in well-tested utilities.

**Getting started with KLEE.** Suppose you have a file `test.c`:

```c
#include <klee/klee.h>

int check(int x, int y) {
    if (x > 0) {
        if (y == x * x) {
            assert(0);  // Can KLEE find x,y such that y == x*x?
        }
    }
    return 0;
}

int main() {
    int x, y;
    klee_make_symbolic(&x, sizeof(x), "x");
    klee_make_symbolic(&y, sizeof(y), "y");
    check(x, y);
    return 0;
}
```

Compile and run with KLEE:

```bash
$ clang -emit-llvm -c -g -O0 -Xclang -disable-O0-optnone test.c -o test.bc
$ klee test.bc
```

Output:

```
KLEE: output directory is "klee-out-0"
KLEE: Using STP solver backend
KLEE: ERROR: test.c:6: ASSERTION FAIL: 0
KLEE: NOTE: now ignoring this error at this location
KLEE: done: total instructions = 42
KLEE: done: completed paths = 3
KLEE: done: generated tests = 3
```

Examine the failing test case:

```bash
$ ktest-tool klee-out-0/test000003.ktest
ktest file : 'klee-out-0/test000003.ktest'
object 0: name: 'x'
object 0: int : 1
object 1: name: 'y'
object 1: int : 1
```

KLEE found that $x = 1, y = 1$ satisfies $y = x^2$ and triggers the assertion. It automatically generated concrete test inputs that reach the "hard-to-reach" code path.

### 8.2 CBMC: Bounded Model Checking for C

See Section 4.4 for the getting-started example. CBMC is particularly effective for:
- Hardware/software co-verification
- Embedded systems verification
- Security property checking (buffer overflows, integer overflows)

Additional useful CBMC flags:

```bash
# Check for common C errors (null pointers, array bounds, overflow)
$ cbmc program.c --bounds-check --pointer-check --signed-overflow-check

# Set loop unwinding bound
$ cbmc program.c --unwind 10

# Check that the unwinding bound is sufficient
$ cbmc program.c --unwind 10 --unwinding-assertions
```

### 8.3 Frama-C: Modular Verification for C

Frama-C uses ACSL (ANSI/ISO C Specification Language) annotations:

```c
/*@ requires \valid(a+(0..n-1));
    requires n > 0;
    ensures \result >= 0 && \result < n;
    ensures \forall integer i; 0 <= i < n ==> a[\result] <= a[i];
*/
int find_min(int *a, int n);
```

The WP (Weakest Precondition) plugin generates verification conditions discharged by SMT solvers (Alt-Ergo, Z3, CVC4).

### 8.4 Dafny: Verification-Aware Language

Dafny (Leino 2010) is a language designed for verification:
- Built-in specification constructs (`requires`, `ensures`, `invariant`, `decreases`)
- Automatic verification via Boogie (an intermediate verification language) and Z3
- Compiles to C#, Java, JavaScript, Go, Python

**Example:**
```dafny
method Abs(x: int) returns (y: int)
    ensures y >= 0
    ensures y == x || y == -x
{
    if x < 0 { y := -x; } else { y := x; }
}
```

### 8.5 Lean 4 and Coq: Proof Assistants

For the highest assurance, proof assistants provide *machine-checked proofs*:

**CompCert** (Leroy 2006, 2009): A fully verified optimizing C compiler, proved correct in Coq. The compiler is extracted from the proof to OCaml code. CompCert guarantees that every behavior of the compiled assembly code is a permitted behavior of the source C program.

**Lean 4** is increasingly used for verified systems:
- The compiler itself is written in Lean and verified.
- Mathlib provides a library of formalized mathematics.
- Applications to verified cryptography, networking, operating systems.

---

## 9. Comparison of Verification Approaches

| Approach | Automation | Completeness | Scalability | Guarantees |
|---|---|---|---|---|
| Abstract interpretation | Fully automatic | Sound (over-approx) | Industrial scale | No false negatives |
| Symbolic execution | Automatic | Path-complete | Limited by path explosion | Per-path correctness |
| Bounded model checking | Automatic | Complete up to bound | Medium | Bug-finding |
| Deductive verification | Semi-automatic | Complete (with annotations) | Function-level | Full correctness |
| Proof assistants | Manual | Complete | Function/module | Machine-checked |

**Trade-offs:**
- More automation generally means less precision.
- Soundness (no false negatives) is hard to combine with completeness (no false positives).
- Scalability and precision are in tension.

---

## 10. Theoretical Foundations: Undecidability and Rice's Theorem

### 10.1 Fundamental Limits

**Theorem (Rice 1953).** Every non-trivial semantic property of programs is undecidable.

Formally, let $P$ be a property of partial functions $\mathbb{N} \to \mathbb{N}$ that is non-trivial (some programs have it, some don't). Then the set $\{e \mid \varphi_e \in P\}$ is undecidable, where $\varphi_e$ is the function computed by program $e$.

**Consequence.** Perfect program verification (no false positives, no false negatives, always terminates) is impossible for any non-trivial property. Every practical verification technique must give up one of these three properties:
- Abstract interpretation: gives up precision (may have false positives)
- Testing/symbolic execution: gives up soundness (may miss bugs)
- Deductive verification: gives up full automation (requires human annotations)

### 10.2 What We Can Do

Despite undecidability, practical verification is achievable because:
1. Real programs are far from adversarial Turing machines.
2. Many properties of interest are decidable for restricted program classes.
3. Sound over-approximation (abstract interpretation) is sufficient for proving safety.
4. Bug-finding (testing, BMC) is sufficient for increasing confidence.
5. Human insight (invariants, specifications) fills the automation gap.

---

## 11. Summary

Symbolic execution, bounded model checking, and deductive verification form a spectrum of software verification techniques, all powered by SAT/SMT solvers:

- **Symbolic execution** explores program paths, building path conditions that characterize inputs reaching each path. Concolic execution (DART, SAGE) combines concrete and symbolic execution for better scalability.

- **Bounded model checking** (CBMC) unrolls programs to a fixed depth and encodes the entire verification problem as a single SMT query. It is sound for bug-finding within the bound and can be complete when unwinding assertions hold.

- **Predicate abstraction + CEGAR** (SLAM/SDV) iteratively refines an abstract model until either the property is proved or a real counterexample is found.

- **Deductive verification** (Frama-C, Dafny) generates verification conditions from annotated programs and discharges them with SMT solvers.

- **Verified compilation** (CompCert) and **optimization verification** (Alive2) use these techniques to ensure that compilers themselves are correct.

The SAT and SMT solvers from Lectures 11a and 11b are the engines that power all of these approaches. The abstract interpretation framework from Lecture 11c provides the theoretical foundation for sound over-approximation. Together, they represent the state of the art in ensuring that the software (and compilers) we depend on actually do what we intend.

---

## References

1. King, J.C. (1976). "Symbolic execution and program testing." *Communications of the ACM*, 19(7), 385-394.
2. Godefroid, P., Klarlund, N. & Sen, K. (2005). "DART: Directed automated random testing." *PLDI*, 213-223.
3. Godefroid, P., Levin, M.Y. & Molnar, D. (2008). "Automated whitebox fuzz testing." *NDSS*.
4. Cadar, C., Dunbar, D. & Engler, D. (2008). "KLEE: Unassisted and automatic generation of high-coverage tests for complex systems programs." *OSDI*, 209-224.
5. Biere, A., Cimatti, A., Clarke, E. & Zhu, Y. (1999). "Symbolic model checking without BDDs." *TACAS*, LNCS 1579, 193-207.
6. Clarke, E., Grumberg, O., Jha, S., Lu, Y. & Veith, H. (2003). "Counterexample-guided abstraction refinement for symbolic model checking." *Journal of the ACM*, 50(5), 752-794.
7. Clarke, E., Kroening, D. & Lerda, F. (2004). "A tool for checking ANSI-C programs." *TACAS*, LNCS 2988, 168-176.
8. Ball, T., Bounimova, E., Kumar, R. & Levin, V. (2011). "SLAM2: Static driver verification with under 4% false alarms." *FMCAD*, 35-42.
9. Ball, T. & Rajamani, S.K. (2001). "The SLAM toolkit." *CAV*, LNCS 2102, 260-264.
10. Lopes, N.P. et al. (2015). "Provably correct peephole optimizations with Alive." *PLDI*, 22-32.
11. Lopes, N.P. et al. (2021). "Alive2: Bounded translation validation for LLVM." *PLDI*, 65-79.
12. Yang, X. et al. (2011). "Finding and understanding bugs in C compilers." *PLDI*, 283-294.
13. Leroy, X. (2009). "Formal verification of a realistic compiler." *Communications of the ACM*, 52(7), 107-115.
14. Leino, K.R.M. (2010). "Dafny: An automatic program verifier for functional correctness." *LPAR*, LNCS 6355, 348-370.
15. Pnueli, A., Siegel, M. & Singerman, E. (1998). "Translation validation." *TACAS*, LNCS 1384, 151-166.
16. Craig, W. (1957). "Three uses of the Herbrand-Gentzen theorem in relating model theory and proof theory." *Journal of Symbolic Logic*, 22(3), 269-285.
17. Avgerinos, T. et al. (2014). "Enhancing symbolic execution with Veritesting." *ICSE*, 1083-1094.
18. Rice, H.G. (1953). "Classes of recursively enumerable sets and their decision problems." *Transactions of the AMS*, 74(2), 358-366.
