# Lecture 03c: Polyhedral Compilation & Loop Optimization

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Represent** loop nests using the polyhedral model: iteration domains as integer polyhedra, access functions as affine maps, and dependences as relations over iteration vectors.
2. **Apply** classical loop transformations -- tiling, interchange, fusion, fission, unrolling, and skewing -- and express each as an affine schedule transformation.
3. **Derive** data dependences for tensor computations and determine the legality of a proposed loop transformation using the dependence condition.
4. **Analyze** how the polyhedral model applies to tensor operations (GEMM, convolution, attention) and identify the optimization opportunities it exposes.
5. **Evaluate** the Halide scheduling language as a practical instantiation of the separation between algorithm and schedule.

---

## 2. Motivation and Context

### 2.1 The Loop Optimization Problem

After an ML compiler decides *what* fused operations to compute (graph-level optimization, Lecture 03a), it must decide *how* to execute each fused region: in what order to iterate, how to tile for caches and thread blocks, and how to vectorize. These are **loop optimization** problems.

Consider the computation $C_{ij} = \sum_k A_{ik} B_{kj}$ (matrix multiplication). The naive implementation has three nested loops:

```c
for (int i = 0; i < M; i++)
  for (int j = 0; j < N; j++)
    for (int k = 0; k < K; k++)
      C[i][j] += A[i][k] * B[k][j];
```

This naive version achieves $< 1\%$ of peak FLOPS on modern hardware because of poor cache behavior. The optimized version (tiled, vectorized, with register blocking) achieves $> 90\%$ of peak but has a radically different loop structure. The polyhedral model provides a *mathematical framework* for reasoning about all possible loop orderings and selecting the best one.

### 2.2 Why a Mathematical Framework?

Ad hoc loop transformations are fragile: manually applying tiling, interchange, and unrolling in combination requires checking that each transformation preserves correctness. The polyhedral model unifies all affine loop transformations into a single formalism where:

1. **Legality** is checked once via dependence analysis.
2. **Profitability** is estimated from the transformed iteration order.
3. **Composition** of transformations is simply matrix multiplication.

---

## 3. The Polyhedral Model

### 3.1 Iteration Domains

The **iteration domain** of a loop nest is the set of all iteration vectors. For the GEMM loop above:

$$\mathcal{D}_S = \{(i, j, k) \in \mathbb{Z}^3 : 0 \le i < M, \ 0 \le j < N, \ 0 \le k < K\}$$

This is an **integer polyhedron** -- the intersection of a set of half-spaces (defined by linear inequalities) with the integer lattice $\mathbb{Z}^3$.

More generally, for a statement $S$ inside $d$ loops with lower bounds $l_i$ and upper bounds $u_i$ (which may depend on outer loop variables and parameters):

$$\mathcal{D}_S = \{\vec{x} \in \mathbb{Z}^d : A\vec{x} + B\vec{p} + \vec{c} \ge \vec{0}\}$$

where $\vec{p}$ is a vector of symbolic parameters (e.g., $M, N, K$) and $A, B, \vec{c}$ encode the loop bounds.

### 3.2 Access Functions

An **access function** maps an iteration vector to the array element accessed. For the GEMM statement `C[i][j] += A[i][k] * B[k][j]`, the access functions are:

$$f_A(i, j, k) = (i, k), \quad f_B(i, j, k) = (k, j), \quad f_C(i, j, k) = (i, j)$$

Each access function is an **affine map**: $f(\vec{x}) = F\vec{x} + \vec{g}$ where $F$ is an integer matrix and $\vec{g}$ is a constant vector. For $f_A$:

$$f_A = \begin{pmatrix} 1 & 0 & 0 \\ 0 & 0 & 1 \end{pmatrix} \begin{pmatrix} i \\ j \\ k \end{pmatrix}$$

The affine restriction is key: it makes dependence analysis decidable and enables exact transformations. Most tensor computations (GEMM, convolution, pooling, attention score computation) have affine access patterns.

### 3.3 Schedules

A **schedule** assigns a logical timestamp to each operation instance. Formally, a schedule is a function:

$$\theta_S: \mathcal{D}_S \to \mathbb{Z}^{d'}$$

where $d'$ is the dimensionality of the time space. Instances mapped to the same timestamp execute simultaneously (if parallelism is available); otherwise they execute in lexicographic order of their timestamps.

**The original schedule** for the GEMM loop is the identity:

$$\theta_{\text{orig}}(i, j, k) = (i, j, k)$$

meaning: execute in the order $i$ outermost, $j$ middle, $k$ innermost.

**Loop interchange** ($i \leftrightarrow k$) is the schedule:

$$\theta_{\text{interchange}}(i, j, k) = (k, j, i)$$

**Tiling** with tile size $T$ maps:

$$\theta_{\text{tile}}(i, j, k) = (\lfloor i/T \rfloor, \lfloor j/T \rfloor, \lfloor k/T \rfloor, i \bmod T, j \bmod T, k \bmod T)$$

This is a piecewise affine schedule (due to the floor and mod), which the polyhedral model can handle with extensions.

### 3.4 Affine Schedules

In the basic polyhedral model, schedules are restricted to **affine functions** of the iteration vector and parameters:

$$\theta_S(\vec{x}) = T_S \vec{x} + \vec{t}_S$$

where $T_S$ is a $d' \times d$ integer matrix. An affine schedule can represent:

| Transformation | Schedule matrix $T_S$ (for 3 loops $i,j,k$) |
|---|---|
| Identity | $\begin{pmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{pmatrix}$ |
| Interchange $i \leftrightarrow k$ | $\begin{pmatrix} 0 & 0 & 1 \\ 0 & 1 & 0 \\ 1 & 0 & 0 \end{pmatrix}$ |
| Skew $(i, j, k) \to (i, j, i+k)$ | $\begin{pmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 1 & 0 & 1 \end{pmatrix}$ |
| Reversal of $j$ | $\begin{pmatrix} 1 & 0 & 0 \\ 0 & -1 & 0 \\ 0 & 0 & 1 \end{pmatrix}$ |

**Composition** of affine schedules is matrix multiplication: applying $T_1$ then $T_2$ yields $T_2 \cdot T_1$. This is why the polyhedral model is so powerful -- complex transformations decompose into simple matrix operations.

---

## 4. Dependence Analysis

### 4.1 Data Dependences

A **data dependence** exists from iteration $\vec{x}_1$ of statement $S_1$ to iteration $\vec{x}_2$ of statement $S_2$ if:

1. Both access the same memory location: $f_{S_1}(\vec{x}_1) = f_{S_2}(\vec{x}_2)$.
2. At least one access is a write.
3. $\vec{x}_1$ is executed before $\vec{x}_2$ in the original schedule.

**Types of dependences:**

- **Flow (RAW):** $S_1$ writes, $S_2$ reads the same location ($S_1 \to S_2$).
- **Anti (WAR):** $S_1$ reads, $S_2$ writes the same location.
- **Output (WAW):** Both $S_1$ and $S_2$ write the same location.

### 4.2 Dependence Relations

For affine access functions, the dependence condition $f_{S_1}(\vec{x}_1) = f_{S_2}(\vec{x}_2)$ is a system of linear equations. The set of all dependent iteration pairs forms an **affine relation**:

$$\mathcal{R} = \{(\vec{x}_1, \vec{x}_2) \in \mathcal{D}_{S_1} \times \mathcal{D}_{S_2} : F_1 \vec{x}_1 = F_2 \vec{x}_2, \ \theta_{\text{orig}}(\vec{x}_1) \prec \theta_{\text{orig}}(\vec{x}_2)\}$$

**GEMM example.** The statement `C[i][j] += A[i][k] * B[k][j]` has an output dependence on $C[i][j]$: iterations $(i, j, k_1)$ and $(i, j, k_2)$ with $k_1 < k_2$ both write to $C[i][j]$.

The dependence relation is:

$$\mathcal{R}_C = \{((i, j, k_1), (i, j, k_2)) : 0 \le k_1 < k_2 < K\}$$

The dependence distance vector is:

$$\vec{d} = \vec{x}_2 - \vec{x}_1 = (0, 0, k_2 - k_1) \quad \text{where } k_2 - k_1 > 0$$

This tells us: the $k$ loop carries a dependence, but the $i$ and $j$ loops do not. Therefore $i$ and $j$ are parallelizable, but $k$ is not (the sum must be accumulated in order, or using an associative reduction).

### 4.3 The Legality Condition

A schedule $\theta$ is **legal** if it preserves all dependences: for every dependent pair $(\vec{x}_1, \vec{x}_2)$, the source is scheduled before the sink:

$$\forall (\vec{x}_1, \vec{x}_2) \in \mathcal{R}: \theta(\vec{x}_1) \prec_{\text{lex}} \theta(\vec{x}_2)$$

where $\prec_{\text{lex}}$ denotes lexicographic ordering.

For affine schedules $\theta(\vec{x}) = T\vec{x} + \vec{t}$, this becomes:

$$T\vec{x}_1 + \vec{t} \prec_{\text{lex}} T\vec{x}_2 + \vec{t} \iff T(\vec{x}_2 - \vec{x}_1) \succ_{\text{lex}} \vec{0}$$

Since $\vec{d} = \vec{x}_2 - \vec{x}_1$ is the dependence distance vector, legality requires:

$$T\vec{d} \succ_{\text{lex}} \vec{0} \quad \text{for all dependence distance vectors } \vec{d}$$

**Example: Interchange $i \leftrightarrow k$ for GEMM.**

The output dependence on $C$ has $\vec{d} = (0, 0, \delta_k)$ with $\delta_k > 0$.

With the interchange schedule $T = \begin{pmatrix} 0 & 0 & 1 \\ 0 & 1 & 0 \\ 1 & 0 & 0 \end{pmatrix}$:

$$T\vec{d} = \begin{pmatrix} \delta_k \\ 0 \\ 0 \end{pmatrix} \succ_{\text{lex}} \vec{0} \quad \checkmark$$

The interchange is legal because the carried dependence distance maps to a positive first component. However, if we tried to reverse the $k$ loop ($T_k = -1$), we would get $T\vec{d} = (0, 0, -\delta_k) \prec_{\text{lex}} \vec{0}$, which is illegal.

---

## 5. Loop Transformations for Tensor Computations

### 5.1 Tiling

**Tiling** partitions the iteration space into rectangular blocks (tiles) and executes all iterations within a tile before moving to the next. For a 2D loop:

```
// Before tiling
for i in [0, M):
  for j in [0, N):
    S(i, j)

// After tiling with tile sizes (Ti, Tj)
for io in [0, M/Ti):
  for jo in [0, N/Tj):
    for ii in [0, Ti):
      for jj in [0, Tj):
        S(io*Ti + ii, jo*Tj + jj)
```

**Why tiling matters for ML.** Consider a GEMM $C_{ij} = \sum_k A_{ik} B_{kj}$ with tile sizes $(T_M, T_N, T_K)$:

- Each tile computes a $T_M \times T_N$ block of $C$ using a $T_M \times T_K$ block of $A$ and a $T_K \times T_N$ block of $B$.
- Data loaded: $(T_M T_K + T_K T_N) \cdot \text{sizeof}(\text{dtype})$ bytes per tile.
- Computation: $2 T_M T_N T_K$ FLOPs per tile.
- Arithmetic intensity per tile: $\frac{2 T_M T_N T_K}{(T_M T_K + T_K T_N) \cdot \beta}$ where $\beta$ is bytes per element.

For $T_M = T_N = T_K = T$, the arithmetic intensity is $\frac{2T^3}{2T^2 \beta} = \frac{T}{\beta}$. Increasing $T$ increases arithmetic intensity until the tile no longer fits in the cache/shared memory.

**Multi-level tiling** for GPU:
1. **Thread-block tile**: Fits in shared memory (~128 KB on A100). Typical: $128 \times 128 \times 32$.
2. **Warp tile**: Fits in register file. Typical: $64 \times 64 \times 32$.
3. **Thread tile**: Maps to Tensor Core MMA instructions. Typical: $16 \times 8 \times 16$.

### 5.2 Loop Interchange

**Interchange** permutes the loop ordering. For a 2D convolution:

```
// Original: output-stationary (accumulate into C[n][c_o][h][w])
for n in [0, N):
  for c_o in [0, C_out):
    for h in [0, H):
      for w in [0, W):
        for c_i in [0, C_in):
          for kh in [0, K):
            for kw in [0, K):
              C[n][c_o][h][w] += A[n][c_i][h+kh][w+kw] * W[c_o][c_i][kh][kw]
```

Interchanging to make `c_i` outermost creates an **input-stationary** dataflow that reuses each input element $A[n][c_i][h+kh][w+kw]$ across all output channels. The optimal interchange depends on which data reuse pattern best matches the memory hierarchy.

### 5.3 Loop Fusion and Fission

**Loop fusion** merges two loops with the same iteration space:

```
// Before fusion
for i in [0, N):
  B[i] = f(A[i])
for i in [0, N):
  C[i] = g(B[i])

// After fusion
for i in [0, N):
  B[i] = f(A[i])
  C[i] = g(B[i])
```

Benefits: eliminates the intermediate array $B$ from HBM (it lives in registers), halves memory traffic.

Legality condition: no dependence from the second loop iteration $i$ to a *later* first loop iteration $i' > i$. For producer-consumer patterns (which are the common case in ML), fusion is almost always legal.

**Loop fission** (the inverse) is useful when a fused loop exceeds register capacity, or when one part is parallelizable and the other is not.

### 5.4 Unrolling and Vectorization

**Unrolling** replicates the loop body to reduce loop overhead and enable instruction-level parallelism:

```
// Unrolled by factor 4
for i in [0, N, step=4):
  S(i)
  S(i+1)
  S(i+2)
  S(i+3)
```

On GPUs, unrolling is less about reducing branch overhead (which is negligible) and more about:
1. Increasing instruction-level parallelism (ILP) to hide memory latency.
2. Enabling the register allocator to keep more values in registers.
3. Exposing opportunities for the GPU's warp scheduler.

**Vectorization** maps the innermost loop to SIMD/vector instructions. On CPUs, this means AVX-512 instructions operating on 16 FP32 values simultaneously. On GPUs, this means coalesced memory access patterns where consecutive threads access consecutive memory addresses.

### 5.5 Loop Skewing

**Skewing** transforms the iteration space to expose parallelism in loops with carried dependences.

Consider a 1D stencil:

```
for t in [0, T):
  for i in [1, N-1):
    A[t+1][i] = 0.5 * (A[t][i-1] + A[t][i+1])
```

The dependence structure prevents parallelizing either loop directly. Skewing transforms $(t, i) \to (t, i + t)$, creating a "wavefront" where all points on the anti-diagonal $i + t = c$ are independent:

```
// After skewing
for t in [0, T):
  for j in [t+1, N-1+t):  // j = i + t
    A[t+1][j-t] = 0.5 * (A[t][j-t-1] + A[t][j-t+1])
```

Now, for fixed $t$, all iterations in $j$ are independent (within the same time step). This is directly applicable to the temporal dimension in recurrent neural networks and autoregressive inference, though in practice ML compilers handle these patterns at a higher level of abstraction.

---

## 6. Application to Tensor Computations

### 6.1 GEMM in the Polyhedral Model

The GEMM $C[i][j] \mathrel{+}= A[i][k] \cdot B[k][j]$ has:

- Iteration domain: $\mathcal{D} = \{(i,j,k) : 0 \le i < M, 0 \le j < N, 0 \le k < K\}$
- Access functions: $f_A = (i,k)$, $f_B = (k,j)$, $f_C = (i,j)$
- Dependences: Output dependence on $C$ with distance $(0, 0, 1)$

**Optimal tiled schedule** (informally):

$$\theta(i,j,k) = (i/T_M, j/T_N, k/T_K, i \bmod T_M, j \bmod T_N, k \bmod T_K)$$

The polyhedral framework can automatically derive this schedule by optimizing a cost function that minimizes data reuse distance (the "proximity" objective in the Pluto algorithm).

### 6.2 Convolution in the Polyhedral Model

A 2D convolution with input $I[n][c_i][h][w]$, kernel $K[c_o][c_i][kh][kw]$, output $O[n][c_o][oh][ow]$:

$$O[n][c_o][oh][ow] \mathrel{+}= I[n][c_i][oh \cdot s + kh][ow \cdot s + kw] \cdot K[c_o][c_i][kh][kw]$$

where $s$ is the stride. The access function for $I$:

$$f_I(n, c_o, oh, ow, c_i, kh, kw) = (n, c_i, oh \cdot s + kh, ow \cdot s + kw)$$

This is affine in the iteration variables, so the polyhedral model applies. The stride $s$ introduces a "dilation" in the access pattern that tiling must account for.

**Optimization opportunity.** The 7 nested loops of convolution can be tiled in multiple dimensions simultaneously. The polyhedral framework can find tile sizes that balance:
- Reuse of input ($I$ is read by multiple output positions).
- Reuse of kernel ($K$ is read by all spatial positions and batch elements).
- Output stationarity (accumulating into $O[n][c_o][oh][ow]$).

### 6.3 Attention Score Computation

The attention score $S = QK^T / \sqrt{d_k}$ where $Q, K \in \mathbb{R}^{B \times h \times S \times d_k}$:

$$S[b][n][i][j] = \frac{1}{\sqrt{d_k}} \sum_{d=0}^{d_k-1} Q[b][n][i][d] \cdot K[b][n][j][d]$$

This is a batched GEMM with contraction over $d$. The polyhedral model reveals that:
- $b, n$ are batch dimensions (trivially parallel, no dependences).
- $i, j$ are the spatial dimensions of the attention matrix (no dependences for the multiply-accumulate).
- $d$ is the reduction dimension (carries a dependence via the sum).

Tiling $i$ and $j$ together in a way that the tile of $S$ fits in SRAM is exactly the insight behind FlashAttention (Dao et al., 2022), which the polyhedral model could in principle derive automatically.

---

## 7. The Pluto Algorithm

### 7.1 Overview

The Pluto algorithm (Bondhugula et al., 2008) is the most widely used automatic parallelization and locality optimization algorithm based on the polyhedral model. Given a program's dependence polyhedra, Pluto finds an affine schedule that:

1. Maximizes the number of parallel (dependence-free) outermost loops.
2. Minimizes data reuse distance for the remaining sequential loops.

### 7.2 Formulation

Pluto solves for the schedule matrix $T$ row by row. For each row $\vec{c}$ of $T$ (representing one level of the target loop nest), Pluto solves the ILP:

$$\min \sum_e \delta_e$$

subject to, for each dependence $e$ with distance vector $\vec{d}_e$:

$$\vec{c} \cdot \vec{d}_e \ge 0 \quad \text{(legality: dependences go forward)}$$

$$\vec{c} \cdot \vec{d}_e \le \delta_e \quad \text{(proximity: minimize reuse distance)}$$

where $\delta_e \ge 0$ is a bounded variable representing the reuse distance for dependence $e$.

If a solution with $\vec{c} \cdot \vec{d}_e = 0$ for all $e$ exists, the loop level is fully parallel. Otherwise, Pluto minimizes the total reuse distance, which tends to produce tiling-friendly schedules.

### 7.3 Limitations of Polyhedral Approaches for ML

1. **Restricted to affine programs.** Dynamic indexing (e.g., `A[indices[i]]` in sparse operations, embedding lookups) falls outside the polyhedral model.

2. **Scalability.** The ILP solving step has exponential worst-case complexity. For deeply nested loops (7+ levels, common in convolutions), solving time can be significant.

3. **Operator-level only.** The polyhedral model optimizes individual operators or small fused regions. It does not replace graph-level optimization (fusion decisions, layout propagation).

4. **Cost model gap.** Pluto optimizes for reuse distance, which is a proxy for cache performance. It does not directly model GPU-specific concerns like shared memory bank conflicts, warp divergence, or Tensor Core alignment.

Despite these limitations, polyhedral techniques remain the theoretical foundation for understanding loop transformations, and they directly influence the design of systems like TVM's scheduling language and Halide.

---

## 8. Halide: Separating Algorithm from Schedule

### 8.1 The Halide Philosophy

Halide (Ragan-Kelley et al., 2013) was originally designed for image processing pipelines but has profoundly influenced ML compilers. Its core insight:

> *Separate the algorithm (what to compute) from the schedule (how to compute it).*

This separation means the same algorithm definition can be executed with radically different schedules -- tiled, parallelized, vectorized, GPU-mapped -- without changing the algorithm code.

### 8.2 Halide's Algorithm Language

```cpp
// Algorithm: 3x3 blur
Func blur_x("blur_x"), blur_y("blur_y");
Var x("x"), y("y"), c("c");

// Horizontal blur
blur_x(x, y, c) = (input(x-1, y, c) + input(x, y, c) + input(x+1, y, c)) / 3;

// Vertical blur
blur_y(x, y, c) = (blur_x(x, y-1, c) + blur_x(x, y, c) + blur_x(x, y+1, c)) / 3;
```

This is purely declarative: it defines `blur_y` as a function of `blur_x`, which is a function of `input`. No loop ordering is specified.

### 8.3 Halide's Schedule Language

```cpp
// Schedule 1: Naive (compute blur_x fully, then blur_y)
// -> poor locality (blur_x doesn't fit in cache for large images)
blur_x.compute_root();
blur_y.compute_root();

// Schedule 2: Inline (recompute blur_x for each blur_y access)
// -> no intermediate storage, but 3x redundant computation
blur_x.compute_inline();

// Schedule 3: Tiled with producer-consumer fusion
// -> compute blur_x tiles just before they're needed by blur_y
blur_y.tile(x, y, xo, yo, xi, yi, 256, 32);
blur_x.compute_at(blur_y, yo);  // compute blur_x at the yo tile level
blur_y.vectorize(xi, 8);
blur_y.parallel(yo);
```

**Schedule 3** is the sweet spot: it computes a strip of `blur_x` just wide enough for the current `blur_y` tile, keeping the intermediate in L1 cache. This eliminates the reuse distance problem while avoiding redundant computation.

### 8.4 Halide's Influence on ML Compilers

The algorithm/schedule separation is the direct ancestor of TVM's design:

| Halide Concept | TVM Equivalent |
|---|---|
| `Func` (algorithm) | `te.compute` (tensor expression) |
| `Var` (loop variable) | Loop axes in schedule |
| `.tile()` | `s[C].split() + reorder()` |
| `.compute_at()` | `s[B].compute_at(s[C], axis)` |
| `.vectorize()` | `s[C].vectorize(axis)` |
| `.parallel()` | `s[C].parallel(axis)` |
| `.compute_root()` | Default (compute fully, store to memory) |
| `.compute_inline()` | `s[B].compute_inline()` |

TVM extended Halide's ideas with:
- **GPU thread binding** (`.bind()` to `threadIdx`, `blockIdx`).
- **Tensor intrinsics** (mapping to Tensor Core MMA instructions).
- **Auto-scheduling** (Ansor), automating the schedule search that Halide leaves to the programmer.

### 8.5 The Compute-At Primitive

`compute_at` is perhaps the most important scheduling primitive for ML workloads. It controls where an intermediate tensor is materialized:

$$\texttt{compute\_at}(\text{producer}, \text{consumer}, \text{axis})$$

means: compute the producer's values at the granularity of the consumer's specified axis. This determines:

1. **Intermediate buffer size**: proportional to the tile size at the specified axis.
2. **Reuse**: elements computed once per tile are reused within the tile.
3. **Parallelism**: tiles can be computed independently.

**Example for fused GEMM + ReLU:**

```python
# Algorithm
C = te.compute((M, N), lambda i, j: te.sum(A[i, k] * B[k, j], axis=k))
D = te.compute((M, N), lambda i, j: te.max(C[i, j], 0))  # ReLU

# Schedule: fuse C into D
s = te.create_schedule(D.op)
xo, xi = s[D].split(D.op.axis[0], factor=32)
yo, yi = s[D].split(D.op.axis[1], factor=32)
s[C].compute_at(s[D], yi)  # compute C tile at inner-tile level of D
# C's buffer is now 32x32 (fits in shared memory), not MxN
```

---

## 9. Putting It Together: From Math to Code

### 9.1 GEMM Optimization Walkthrough

Starting from the naive GEMM, we apply polyhedral transformations step by step:

**Step 1: Tile for L2 cache.** Choose $T_M = T_N = 128, T_K = 64$ so that the $A$ tile ($128 \times 64 \times 4 = 32$ KB), $B$ tile ($64 \times 128 \times 4 = 32$ KB), and $C$ tile ($128 \times 128 \times 4 = 64$ KB) together fit in the L2 cache (typically 256 KB per SM).

**Step 2: Tile for registers.** Within each L2 tile, tile again with $T_M' = 8, T_N' = 8$ for register blocking. Each thread computes an $8 \times 8$ output sub-tile using an outer product formulation:

$$C[i:i+8, j:j+8] \mathrel{+}= A[i:i+8, k] \cdot B[k, j:j+8]$$

This requires $8 + 8 + 64 = 80$ registers per thread (holding a column of $A$, a row of $B$, and the $8 \times 8$ accumulator).

**Step 3: Vectorize.** The innermost loop (over the $8$-element rows/columns) maps to vector load instructions (LDG.128 on NVIDIA GPUs).

**Step 4: Software pipelining.** Overlap the loading of the next $k$-tile with computation of the current tile by double-buffering shared memory.

The polyhedral model provides the mathematical framework to verify that each transformation preserves the output dependence on $C$ and to compose all transformations into a single schedule matrix.

### 9.2 Pseudocode for the Optimized GEMM

```
OptimizedGEMM(A[M,K], B[K,N], C[M,N]):
  // Tile sizes chosen for A100 GPU
  TM, TN, TK = 128, 128, 32    // thread-block tile
  WM, WN = 64, 64               // warp tile
  RM, RN = 8, 8                 // register tile

  parallel for bm in [0, M/TM):         // gridDim.y
    parallel for bn in [0, N/TN):       // gridDim.x
      // Allocate shared memory for A and B tiles
      shared A_tile[TM, TK]             // 128 * 32 * 4 = 16 KB
      shared B_tile[TK, TN]             // 32 * 128 * 4 = 16 KB

      // Each thread block computes C[bm*TM:(bm+1)*TM, bn*TN:(bn+1)*TN]
      registers C_reg[RM, RN] = 0       // per-thread accumulator

      for bk in [0, K/TK):              // sequential over K tiles
        // Phase 1: Load A and B tiles to shared memory (coalesced)
        cooperative_load(A[bm*TM:, bk*TK:], A_tile)
        cooperative_load(B[bk*TK:, bn*TN:], B_tile)
        __syncthreads()

        // Phase 2: Compute using register blocking
        for k in [0, TK):
          load a_frag[RM] from A_tile[:, k]     // 8 elements
          load b_frag[RN] from B_tile[k, :]     // 8 elements
          // Outer product: 8x8 = 64 FMAs
          C_reg += outer_product(a_frag, b_frag)

        __syncthreads()

      // Write C_reg back to global memory
      store C_reg to C[bm*TM+..., bn*TN+...]
```

---

## 10. Connections to ML Compiler Design

The loop transformations discussed in this lecture appear throughout the ML compiler stack:

| Transformation | Where it appears |
|---|---|
| Tiling | GPU kernel design (GEMM, conv), FlashAttention |
| Loop fusion | Operator fusion in XLA, TVM, Inductor |
| Interchange | Dataflow selection (output/weight/input stationary) |
| Vectorization | Triton auto-vectorization, CPU SIMD codegen |
| Unrolling | Register blocking in GEMM, ILP in element-wise kernels |
| Skewing | Wavefront parallelism in RNNs (rare in modern ML) |

The key insight is that while production ML compilers may not use a full polyhedral framework internally (due to scalability concerns), they implement the *same transformations* with domain-specific heuristics. Understanding the polyhedral model gives you the theoretical tools to reason about correctness and optimality of any loop transformation.

---

## Key Takeaways

1. **The polyhedral model** represents loop nests as integer polyhedra and loop transformations as affine maps, providing a unified mathematical framework for reasoning about the correctness and composition of transformations.

2. **Dependence analysis** is the gatekeeper of legality: a transformation is valid if and only if it preserves all data dependences. For affine programs, this is decidable via integer linear programming.

3. **Tiling is the fundamental optimization** for tensor computations. It increases arithmetic intensity by exploiting data reuse in caches and shared memory, and it is the key to approaching peak hardware performance.

4. **Halide's separation of algorithm from schedule** is a paradigm shift that directly influenced TVM's design and, through it, the entire ML compiler ecosystem. The programmer specifies *what* to compute; the compiler (or auto-tuner) determines *how*.

5. **The polyhedral model has limitations** for ML: it requires affine access patterns (excluding sparse operations), it does not model GPU-specific hardware features well, and it does not address graph-level optimization. Modern ML compilers combine polyhedral ideas with domain-specific heuristics.

---

## Further Reading

1. **Bondhugula, U., Hartono, A., Ramanujam, J., & Sadayappan, P.** (2008). "A Practical Automatic Polyhedral Parallelizer and Locality Optimizer." *PLDI 2008*.
   - The Pluto algorithm for automatic parallelization and tiling.

2. **Ragan-Kelley, J., Barnes, C., Adams, A., Paris, S., Durand, F., & Amarasinghe, S.** (2013). "Halide: A Language and Compiler for Optimizing Parallelism, Locality, and Recomputation in Image Processing Pipelines." *PLDI 2013*.
   - The Halide system that pioneered the algorithm/schedule separation.

3. **Verdoolaege, S.** (2010). "isl: An Integer Set Library for the Polyhedral Model." *ICMS 2010*.
   - The polyhedral library used by LLVM/Polly, TVM, and many research compilers.

4. **Wolfe, M.** (1996). *High Performance Compilers for Parallel Computing*. Addison-Wesley.
   - Comprehensive textbook on loop transformations and dependence analysis.

5. **Dao, T., Fu, D. Y., Ermon, S., Rudra, A., & Re, C.** (2022). "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." *NeurIPS 2022*.
   - FlashAttention's tiling strategy can be understood as a polyhedral-style optimization of the attention computation.

6. **Mullapudi, R. T., Adams, A., Sharlet, D., Ragan-Kelley, J., & Fatahalian, K.** (2016). "Automatically Scheduling Halide Image Processing Pipelines." *SIGGRAPH 2016*.
   - Auto-scheduling for Halide, a precursor to TVM's Ansor.

---

*Next: Lecture 03d -- torch.compile, Inductor, and JIT Compilation*
