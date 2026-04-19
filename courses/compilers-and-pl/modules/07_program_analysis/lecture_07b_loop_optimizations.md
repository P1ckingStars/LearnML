# Lecture 07b: Loop Optimizations

## 1. Introduction

Loops dominate program execution time: empirically, programs spend 90% or more of their time in 10% of the code, and that 10% is almost always loops. Consequently, loop optimizations have the highest payoff of any compiler transformation. This lecture covers the major loop optimizations, from classical techniques (code motion, strength reduction) to modern approaches (polyhedral optimization, vectorization).

---

## 2. Loop Fundamentals

### 2.1 Natural Loops

**Definition.** A *natural loop* in a CFG is defined by a *back edge* $n \to h$ where $h$ dominates $n$. The loop consists of $h$ (the *header*) and all nodes from which $n$ can be reached without going through $h$.

**Algorithm: Finding Natural Loops**

```
Algorithm: FindNaturalLoop(back_edge n -> h, CFG)
Input: Back edge n -> h where h dominates n
Output: Set of nodes in the natural loop

1.  loop = {h}
2.  stack = [n]
3.  While stack is non-empty:
4.      m = stack.pop()
5.      If m not in loop:
6.          loop = loop union {m}
7.          For each predecessor p of m:
8.              stack.push(p)
9.  Return loop
```

### 2.2 Loop-Related Definitions

- **Loop header**: the unique entry node; dominates all loop nodes.
- **Preheader**: a new block inserted before the header with the header as its only successor. Used as a landing zone for hoisted code.
- **Loop exit**: an edge from a loop node to a non-loop node.
- **Induction variable**: a variable whose successive values form an arithmetic progression across loop iterations.
- **Loop-invariant computation**: a computation whose result does not change across iterations.

### 2.3 Trip Count and Loop Bounds

For a loop `for i = lo to hi step s`, the trip count is:

$$N = \max\left(0, \left\lfloor \frac{\text{hi} - \text{lo} + s}{s} \right\rfloor\right)$$

Knowledge of the trip count enables unrolling decisions, vectorization, and bounds checking elimination.

---

## 3. Loop-Invariant Code Motion (LICM)

### 3.1 Definition

A computation `t = a op b` inside a loop is *loop-invariant* if for every iteration:
1. `a` and `b` are either constants, defined outside the loop, or themselves defined by loop-invariant computations.

LICM moves such computations to the loop preheader, executing them once instead of every iteration.

### 3.2 Algorithm

```
Algorithm: LICM(loop, preheader)
Input: Natural loop with preheader
Output: Modified CFG with invariant code hoisted

1.  Compute reaching definitions and loop-invariant marks:
2.  Repeat until no change:
3.      For each instruction I: t = a op b in loop:
4.          If all operands of I are loop-invariant:
5.              Mark I as loop-invariant

6.  For each loop-invariant instruction I: t = a op b:
7.      If all of the following hold:
8.          (a) I dominates all loop exits where t is live
9.          (b) t is not defined elsewhere in the loop
10.         (c) I dominates all uses of t in the loop
11.     Then:
12.         Move I to the end of the preheader
```

### 3.3 Correctness Conditions

The conditions in lines 7--10 ensure safety:

**Condition (a)** ensures that if the loop exits before reaching $I$, the hoisted computation is not observed at exit points where it was not originally executed.

**Condition (b)** ensures there is no other definition of $t$ that might be the one reaching some use.

**Condition (c)** ensures that moving $I$ earlier does not change which definition of $t$ reaches uses inside the loop.

**Theorem 3.1.** LICM with conditions (a)--(c) preserves program semantics.

*Proof sketch.* By conditions (b) and (c), $I$ is the unique definition of $t$ reaching all uses of $t$ in the loop. Since $I$ is loop-invariant, it computes the same value on every iteration. Moving it to the preheader computes this value once before the loop begins. By condition (a), at every loop exit where $t$ is used, $I$ would have executed (it dominates the exit), so the hoisted computation is available. $\square$

### 3.4 Interaction with SSA

On SSA form, LICM is simpler: a phi-free definition in the loop is loop-invariant if all its operands are defined outside the loop or are themselves loop-invariant. The dominance conditions are automatically satisfied by SSA properties.

---

## 4. Strength Reduction

### 4.1 Concept

*Strength reduction* replaces expensive operations (multiplication, division) with cheaper ones (addition, subtraction) by exploiting the regular pattern of induction variables.

### 4.2 Example

```c
// Before strength reduction:
for (int i = 0; i < n; i++) {
    a[i] = b[i * 4];     // multiplication by 4 each iteration
}

// After strength reduction:
int t = 0;
for (int i = 0; i < n; i++) {
    a[i] = b[t];
    t += 4;               // replaced multiplication with addition
}
```

### 4.3 Formal Framework

**Definition (Basic Induction Variable).** A variable $i$ is a *basic induction variable* of loop $L$ if the only definitions of $i$ in $L$ are of the form $i := i \pm c$ where $c$ is loop-invariant.

**Definition (Derived Induction Variable).** A variable $j$ is a *derived induction variable* in the family of basic induction variable $i$ if:

$$j = a \cdot i + b$$

where $a$ and $b$ are loop-invariant. We write $j \in \langle i, a, b \rangle$ (the *triple* representation).

### 4.4 Algorithm

```
Algorithm: StrengthReduction(loop)
Input: Natural loop with induction variable analysis
Output: Modified loop with expensive ops replaced

1.  Identify all basic induction variables
2.  For each instruction j = a * i + b where i is a basic IV:
3.      Create a new variable j' (shadow variable)
4.      In the preheader: j' = a * i_init + b
5.      After each i = i + c in the loop: j' = j' + a * c
6.      Replace all uses of j with j'
7.  // The multiplication a * c is loop-invariant and can be precomputed
```

### 4.5 Induction Variable Elimination

After strength reduction, the original induction variable $i$ may only be used in the loop test. If so, we can *eliminate* it by rewriting the test in terms of a derived variable:

```c
// Before:
for (i = 0; i < n; i++) {
    *p = 0;
    p += 4;
}

// After (i eliminated, test rewritten):
p_end = p_init + 4 * n;
while (p < p_end) {
    *p = 0;
    p += 4;
}
```

---

## 5. Loop Unrolling

### 5.1 Concept

*Loop unrolling* replicates the loop body multiple times, reducing the number of iterations and the overhead of loop control (branch, increment, compare).

```c
// Original:
for (int i = 0; i < 100; i++)
    a[i] = b[i] + c[i];

// Unrolled by factor 4:
for (int i = 0; i < 100; i += 4) {
    a[i]   = b[i]   + c[i];
    a[i+1] = b[i+1] + c[i+1];
    a[i+2] = b[i+2] + c[i+2];
    a[i+3] = b[i+3] + c[i+3];
}
```

### 5.2 Benefits and Costs

**Benefits:**
- Reduced loop overhead (branch, counter update): from $N$ to $N/k$ iterations.
- Exposed instruction-level parallelism: independent operations in the unrolled body can execute in parallel on superscalar processors.
- Enabled further optimizations: common subexpressions, register reuse across iterations.

**Costs:**
- Increased code size: factor of $k$ for the loop body.
- Potential instruction cache pressure.
- Cleanup code for residual iterations when $N$ is not divisible by $k$.

### 5.3 Optimal Unroll Factor

The optimal unroll factor $k$ depends on:
- **Register pressure**: unrolling increases live ranges; if $k$ is too large, spilling occurs.
- **Issue width**: on a processor that can issue $w$ operations per cycle, unroll enough to fill all issue slots.
- **Code size constraints**: especially for embedded targets.

An approximate heuristic: $k \approx \min\left(\frac{R}{r}, \frac{I_{\max}}{s}\right)$ where $R$ is the number of available registers, $r$ is the number of registers needed per iteration, $I_{\max}$ is the instruction cache size, and $s$ is the loop body size.

---

## 6. Loop Fusion and Fission

### 6.1 Loop Fusion

*Loop fusion* (also: loop jamming) combines two adjacent loops with the same iteration space into one:

```c
// Before fusion:
for (i = 0; i < n; i++) a[i] = b[i] + 1;
for (i = 0; i < n; i++) c[i] = a[i] * 2;

// After fusion:
for (i = 0; i < n; i++) {
    a[i] = b[i] + 1;
    c[i] = a[i] * 2;
}
```

**Benefits:** Reduced loop overhead; improved temporal locality (a[i] used immediately after being produced).

**Legality:** Fusion is legal if it does not violate any data dependences. Formally, if fusing loops $L_1$ and $L_2$ creates a dependence cycle in the fused loop, fusion is illegal.

### 6.2 Loop Fission

*Loop fission* (also: loop distribution) splits one loop into multiple loops:

```c
// Before fission:
for (i = 0; i < n; i++) {
    a[i] = b[i] + 1;
    c[i] = d[i] * e[i];
}

// After fission:
for (i = 0; i < n; i++) a[i] = b[i] + 1;
for (i = 0; i < n; i++) c[i] = d[i] * e[i];
```

**Benefits:** Reduced register pressure per loop; improved spatial locality; enables vectorization of individual loops.

---

## 7. Loop Tiling/Blocking for Cache Locality

### 7.1 The Problem

Matrix multiplication has poor cache behavior in the naive implementation:

```c
for (i = 0; i < N; i++)
    for (j = 0; j < N; j++)
        for (k = 0; k < N; k++)
            C[i][j] += A[i][k] * B[k][j];
```

The access pattern for `B[k][j]` strides through columns, causing cache misses when $N$ exceeds cache capacity.

### 7.2 Tiling Transformation

Loop tiling partitions the iteration space into smaller *tiles* that fit in the cache:

```c
for (ii = 0; ii < N; ii += T)
    for (jj = 0; jj < N; jj += T)
        for (kk = 0; kk < N; kk += T)
            for (i = ii; i < min(ii+T, N); i++)
                for (j = jj; j < min(jj+T, N); j++)
                    for (k = kk; k < min(kk+T, N); k++)
                        C[i][j] += A[i][k] * B[k][j];
```

### 7.3 Tile Size Selection

The tile size $T$ should be chosen so that the working set fits in the L1 cache. For matrix multiplication with three $T \times T$ sub-matrices:

$$3 T^2 \cdot \text{sizeof(element)} \leq C_{\text{L1}}$$

$$T \leq \sqrt{\frac{C_{\text{L1}}}{3 \cdot \text{sizeof(element)}}}$$

For a 32 KB L1 cache with 8-byte doubles: $T \leq \sqrt{32768 / 24} \approx 36$.

### 7.4 Cache Complexity Analysis

**Theorem 7.1.** The naive matrix multiplication has $\Theta(N^3 / B)$ cache misses (where $B$ is the cache line size), while the tiled version achieves $\Theta(N^3 / (B\sqrt{M}))$ cache misses, where $M$ is the cache size (in elements).

*Proof sketch.* In the tiled version, each $T \times T$ sub-matrix is accessed $N/T$ times but loaded into cache only once per tile computation. With $T = \Theta(\sqrt{M})$, the total number of cache misses for loading all tiles across all computations is $\Theta(N^3 / (B \cdot T)) = \Theta(N^3 / (B\sqrt{M}))$. $\square$

This is optimal by the cache-oblivious lower bound of Hong & Kung (1981).

---

## 8. The Polyhedral Model

### 8.1 Overview

The *polyhedral model* (also: polytope model) provides a unified mathematical framework for representing and transforming loop nests. It represents the iteration space and data dependences as polyhedra, enabling powerful automatic optimization.

### 8.2 Iteration Spaces

A loop nest with $d$ nested loops defines an *iteration space* $\mathcal{I} \subseteq \mathbb{Z}^d$. For a loop:

```
for (i = 0; i < N; i++)
    for (j = 0; j < M; j++)
        S(i, j);
```

The iteration space is $\mathcal{I} = \{(i, j) \in \mathbb{Z}^2 : 0 \leq i < N, 0 \leq j < M\}$, a convex polyhedron.

### 8.3 Dependence Polyhedra

A dependence from statement instance $S(\mathbf{x})$ to $T(\mathbf{y})$ exists if they access the same memory location and at least one access is a write. The set of dependence instances forms a *dependence polyhedron*:

$$\mathcal{D} = \{(\mathbf{x}, \mathbf{y}) : \mathbf{x} \in \mathcal{I}_S,\; \mathbf{y} \in \mathcal{I}_T,\; f_S(\mathbf{x}) = f_T(\mathbf{y}),\; \mathbf{x} \prec \mathbf{y}\}$$

where $f_S, f_T$ are the access functions and $\prec$ is the lexicographic execution order.

### 8.4 Affine Transformations

A loop transformation is represented as an affine schedule function $\theta : \mathbb{Z}^d \to \mathbb{Z}^{d'}$:

$$\theta(\mathbf{x}) = A\mathbf{x} + \mathbf{b}$$

**Legality.** A transformation is legal if it preserves all dependences: for every dependence $\mathbf{x} \prec \mathbf{y}$, we require $\theta(\mathbf{x}) \prec_{\text{lex}} \theta(\mathbf{y})$.

**Examples of transformations as affine maps:**

| Transformation | Matrix $A$ (2D) |
|---------------|-----------------|
| Identity | $\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}$ |
| Loop interchange | $\begin{pmatrix} 0 & 1 \\ 1 & 0 \end{pmatrix}$ |
| Skewing by factor $s$ | $\begin{pmatrix} 1 & 0 \\ s & 1 \end{pmatrix}$ |
| Reversal of inner loop | $\begin{pmatrix} 1 & 0 \\ 0 & -1 \end{pmatrix}$ |

### 8.5 Automatic Optimization

The polyhedral model enables automatic optimization by solving an integer linear programming (ILP) problem: find a schedule $\theta$ that minimizes a cost function (e.g., number of cache misses, communication volume) subject to dependence legality constraints.

Tools: ISL (Integer Set Library), Pluto, Polly (LLVM), PPCG (for GPUs).

---

## 9. Loop Vectorization

### 9.1 Concept

*Loop vectorization* transforms scalar loop iterations into vector (SIMD) operations that process multiple data elements in parallel.

```c
// Scalar:
for (i = 0; i < N; i++)
    a[i] = b[i] + c[i];

// Vectorized (conceptual, 4-wide SIMD):
for (i = 0; i < N; i += 4) {
    va = LOAD_VEC(&b[i]);    // load 4 elements
    vb = LOAD_VEC(&c[i]);
    vc = ADD_VEC(va, vb);     // 4 additions in parallel
    STORE_VEC(&a[i], vc);
}
```

### 9.2 Legality

Vectorization is legal if the loop carries no loop-carried dependences that would be violated by executing iterations simultaneously. Formally, for a dependence $S(i) \to S(j)$ with $i < j$, vectorization requires $j - i \geq \text{VF}$ (vector factor) or the dependence is forward (read-after-write with no intervening write).

### 9.3 Vectorization Techniques

**Inner loop vectorization**: vectorize the innermost loop (most common).

**Outer loop vectorization**: vectorize an outer loop when the inner loop cannot be vectorized or when the outer loop exposes more parallelism.

**SLP (Superword Level Parallelism)**: identify isomorphic operations on adjacent data in straight-line code and pack them into vector operations. This does not require a loop.

### 9.4 Compiler Support

Modern compilers (GCC, Clang/LLVM, ICC) perform auto-vectorization:
1. **Loop analysis**: identify vectorizable loops, check dependences.
2. **Cost model**: estimate speedup from vectorization vs overhead of vector setup, masking, and remainder loops.
3. **Code generation**: emit vector intrinsics or target-specific SIMD instructions.
4. **Masking/predication**: handle loops with conditionals using predicated SIMD or blending.

---

## 10. Dependence Analysis

### 10.1 The Dependence Problem

Two array accesses $A[f(\mathbf{i})]$ and $A[g(\mathbf{j})]$ in a loop nest are dependent if:

$$\exists \mathbf{i}, \mathbf{j} \in \mathcal{I} : f(\mathbf{i}) = g(\mathbf{j}) \land (\mathbf{i} \prec \mathbf{j} \text{ or } \mathbf{j} \prec \mathbf{i})$$

When $f$ and $g$ are affine, this reduces to solving a system of linear Diophantine equations, which is decidable.

### 10.2 Dependence Tests

| Test | Complexity | Precision | Approach |
|------|-----------|-----------|----------|
| GCD test | $O(1)$ | Necessary condition | Check if GCD of coefficients divides the constant |
| Banerjee test | $O(d)$ | Sufficient condition | Bound the range of dependence distance |
| Omega test | Exponential (worst case) | Exact | Integer programming (Presburger arithmetic) |
| Delta test | Polynomial | Heuristic | Decompose into per-dimension tests |

### 10.3 Dependence Distance and Direction Vectors

For a dependence from iteration $\mathbf{i}$ to $\mathbf{j}$, the *dependence distance vector* is $\mathbf{d} = \mathbf{j} - \mathbf{i}$ and the *direction vector* classifies each component as $<$, $=$, or $>$.

A loop-carried dependence at level $l$ has $d_1 = \cdots = d_{l-1} = 0$ and $d_l > 0$. This limits which loops can be parallelized or interchanged.

---

## 11. Summary

| Optimization | Benefit | Key Requirement |
|-------------|---------|-----------------|
| LICM | Reduces redundant computation | Loop invariance, dominance conditions |
| Strength reduction | Replaces expensive ops with cheap ops | Induction variable identification |
| Loop unrolling | Reduces overhead, exposes ILP | Trip count, register pressure analysis |
| Loop fusion | Improves locality, reduces overhead | No dependence cycle between fused loops |
| Loop tiling | Improves cache locality | Tile size fits in cache, legal reordering |
| Vectorization | Exploits SIMD hardware | No violated loop-carried dependences |
| Polyhedral optimization | Unified framework for all above | Affine loop nests, ILP solver |

Loop optimizations form the core of any optimizing compiler's backend. The combination of classical techniques (LICM, strength reduction) with modern approaches (polyhedral optimization, auto-vectorization) can yield order-of-magnitude speedups on compute-intensive code.

---

## References

1. Allen, F. E., & Cocke, J. (1972). "A Catalogue of Optimizing Transformations." In *Design and Optimization of Compilers*, Prentice-Hall.
2. Wolfe, M. J. (1989). *Optimizing Supercompilers for Supercomputers*. MIT Press.
3. Feautrier, P. (1991). "Dataflow Analysis of Array and Scalar References." *International Journal of Parallel Programming*, 20(1), 23--53.
4. Hong, J. W., & Kung, H. T. (1981). "I/O Complexity: The Red-Blue Pebble Game." *STOC*, 326--333.
5. Bondhugula, U., Hartono, A., Ramanujam, J., & Sadayappan, P. (2008). "A Practical Automatic Polyhedral Parallelizer and Locality Optimizer." *PLDI*, 101--113.
6. Muchnick, S. S. (1997). *Advanced Compiler Design and Implementation*. Morgan Kaufmann. Chapters 14--18.
7. Allen, R., & Kennedy, K. (2001). *Optimizing Compilers for Modern Architectures*. Morgan Kaufmann.
