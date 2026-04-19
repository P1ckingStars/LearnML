# Lecture 03a: Computation Graph IR & Optimization Passes

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formalize** the computation graph as a compiler intermediate representation (IR) and distinguish between define-by-run and define-and-run execution models.
2. **Implement** classical compiler optimization passes -- constant folding, dead code elimination, common subexpression elimination -- on a graph IR for ML workloads.
3. **Classify** operator fusion strategies (vertical, horizontal, and mixed) and analyze their impact on memory traffic and kernel launch overhead.
4. **Evaluate** data layout choices (NCHW vs NHWC) and their interaction with hardware execution units and memory access patterns.
5. **Design** memory planning and operator scheduling algorithms that minimize peak memory consumption under topological ordering constraints.

---

## 2. Motivation and Context

### 2.1 From Eager Execution to Compilation

Modern deep learning frameworks default to eager execution: each operator runs immediately as Python encounters it. This is excellent for debugging but leaves significant performance on the table. A `y = relu(matmul(x, W) + b)` expressed eagerly launches three separate GPU kernels -- matmul, add, relu -- each of which reads from and writes to HBM. A compiler, by contrast, can fuse these into a single kernel, eliminating two round-trips to global memory.

The enabling abstraction is the **computation graph**: a directed acyclic graph (DAG) where nodes represent operators and edges represent tensor values flowing between them. Once the entire computation is captured as a graph, the compiler has a global view and can apply transformations that no single-operator runtime could discover.

### 2.2 Why ML Workloads Need Specialized IR

General-purpose compilers (LLVM, GCC) operate on scalar control flow. ML workloads are dominated by:

- **Tensor operations** with known shapes at compile time.
- **Regular, data-parallel** computation amenable to bulk optimization.
- **Memory-bound** element-wise operations where fusion is the primary optimization lever.
- **Hardware diversity**: the same graph must target CUDA cores, Tensor Cores, TPU MXUs, and CPUs.

These properties motivate IR designs that are higher-level than LLVM IR but lower-level than Python, sitting at the "tensor operation" granularity.

### 2.3 Landscape of ML Compiler IRs

| IR | Framework | Level | Key Feature |
|---|---|---|---|
| HLO (High-Level Operations) | XLA / JAX | Tensor ops | Whole-program optimization |
| Relay | TVM | Tensor ops + control flow | Type system, let-binding |
| torch.fx Graph | PyTorch | Python ops | Python-native, easy to extend |
| StableHLO | MLIR ecosystem | Tensor ops | Portability across compilers |
| ONNX | Cross-framework | Tensor ops | Interchange format |
| Linalg-on-tensors | MLIR | Structured ops | Progressive lowering |

---

## 3. The Computation Graph as an IR

### 3.1 Formal Definition

A computation graph is a DAG $G = (V, E)$ where:

- **Nodes** $v \in V$ represent operations (ops). Each node has a type $\text{op}(v) \in \{\texttt{matmul}, \texttt{conv2d}, \texttt{relu}, \texttt{add}, \ldots\}$ and an output tensor type $\tau(v)$ specifying shape and dtype.
- **Edges** $(u, v, i) \in E$ indicate that the output of node $u$ is consumed as the $i$-th input of node $v$.
- **Input nodes** (no incoming edges) represent model parameters and input data.
- **Output nodes** (marked explicitly) represent the tensors the user wants to retrieve.

The semantics are functional: each node computes a pure function of its inputs. Side effects (random number generation, in-place mutation) require special handling.

### 3.2 Static Shape Information

A critical advantage of ML compiler IRs over general-purpose IRs is that tensor shapes are typically known at compile time (or at graph-capture time). For a node $v$ computing a matrix multiplication:

$$v : \texttt{matmul}(A_{[m \times k]}, B_{[k \times n]}) \to C_{[m \times n]}$$

The compiler knows $m, k, n$ and can:
- Compute exact FLOP counts: $2mkn$ for matmul.
- Compute exact memory footprint: $(mk + kn + mn) \cdot \text{sizeof}(\text{dtype})$.
- Select optimal tiling parameters for the target hardware.
- Determine whether fusion is profitable based on arithmetic intensity.

### 3.3 SSA Form and Functional Semantics

Most ML graph IRs use **static single assignment (SSA)** form: each value is defined exactly once. This simplifies optimization passes because there is no aliasing by construction. Consider:

```
%0 = parameter("x")          : f32[B, 784]
%1 = parameter("W1")         : f32[784, 256]
%2 = parameter("b1")         : f32[256]
%3 = matmul(%0, %1)          : f32[B, 256]
%4 = add(%3, %2)             : f32[B, 256]    # broadcast b1
%5 = relu(%4)                : f32[B, 256]
%6 = parameter("W2")         : f32[256, 10]
%7 = matmul(%5, %6)          : f32[B, 10]
```

Each `%k` is defined exactly once and can be used zero or more times. An op with zero uses of its output is dead code.

### 3.4 Define-by-Run vs Define-and-Run

**Define-and-run** (TensorFlow 1.x, XLA, TVM): The user constructs the entire graph before execution. The compiler sees the whole program.

**Define-by-run** (PyTorch eager, JAX eager): The graph is constructed dynamically during execution. To compile, one must *trace* or *capture* the graph -- this is what `torch.compile` and `jax.jit` do.

The hybrid approach -- trace eagerly-written code into a static graph, then compile -- has become dominant. We analyze this in detail in Lecture 03d.

---

## 4. Classical Optimization Passes

Compiler optimization passes are functions $G \to G'$ that rewrite the graph while preserving its input-output semantics. We describe the most important ones for ML workloads.

### 4.1 Constant Folding

**Definition.** If all inputs to a node $v$ are compile-time constants (parameters that will not change, literal scalars), then $v$'s output can be computed at compile time and replaced with a constant node.

**Example.** In a batch normalization layer during inference, the running mean $\mu$, running variance $\sigma^2$, scale $\gamma$, and shift $\beta$ are all fixed. The normalization:

$$\hat{x} = \gamma \cdot \frac{x - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta = \frac{\gamma}{\sqrt{\sigma^2 + \epsilon}} \cdot x + \left(\beta - \frac{\gamma \mu}{\sqrt{\sigma^2 + \epsilon}}\right)$$

can be folded into a single affine transform $\hat{x} = w \cdot x + b$ where:

$$w = \frac{\gamma}{\sqrt{\sigma^2 + \epsilon}}, \quad b = \beta - w \cdot \mu$$

These are computed once at compile time.

**Algorithm:**

```
ConstantFold(G):
  worklist = {v in V : all inputs to v are constants}
  while worklist is not empty:
    v = worklist.pop()
    result = evaluate(v)                    # execute the op
    replace v with constant node holding result
    for each user u of v:
      if all inputs to u are now constants:
        worklist.add(u)
  return G
```

**Impact on ML workloads.** Constant folding is particularly effective for:
- Inference graphs where all batch norm statistics are frozen.
- Shape computations (e.g., `x.shape[0] * x.shape[1]` for reshape).
- Weight preprocessing (transposing weight matrices at compile time for better layout).

### 4.2 Dead Code Elimination (DCE)

**Definition.** Remove nodes whose outputs are not consumed by any other node and are not graph outputs.

**Algorithm:**

```
DeadCodeElimination(G):
  live = set of graph output nodes
  worklist = list(live)
  while worklist is not empty:
    v = worklist.pop()
    for each input u of v:
      if u not in live:
        live.add(u)
        worklist.append(u)
  remove all nodes not in live
  return G
```

**Time complexity:** $O(|V| + |E|)$ -- a single reverse traversal.

**When does DCE matter in ML?** After other transformations (e.g., fusion) create dead nodes, and when framework tracing captures operations that are only used for debugging (print statements, shape assertions) that the compiler can safely remove.

### 4.3 Common Subexpression Elimination (CSE)

**Definition.** If two nodes $u, v$ compute the same operation on the same inputs, replace all uses of $v$ with $u$ and delete $v$.

Two nodes are equivalent if:
1. Same operation type.
2. Same input values (by identity, not by value -- checking value equality is undecidable in general).
3. Same attributes (e.g., same padding mode for convolution).

**Algorithm (hash-consing):**

```
CSE(G):
  value_map = {}     # maps (op_type, input_ids, attributes) -> node
  for v in topological_order(G):
    key = (op(v), tuple(input_ids(v)), attrs(v))
    if key in value_map:
      replace all uses of v with value_map[key]
      delete v
    else:
      value_map[key] = v
  return G
```

**Example in ML.** Consider a model that computes both $\ell_1 = \|x - y\|_1$ and $\ell_2 = \|x - y\|_2^2$. Both require computing $x - y$. CSE ensures the subtraction happens only once.

### 4.4 Algebraic Simplification

Replace subgraphs with algebraically equivalent but cheaper computations:

| Pattern | Replacement | Savings |
|---|---|---|
| $x \cdot 1$ | $x$ | Eliminate multiply |
| $x + 0$ | $x$ | Eliminate add |
| $x \cdot 0$ | $0$ (broadcast to shape) | Eliminate multiply |
| $\text{transpose}(\text{transpose}(x))$ | $x$ | Eliminate two ops |
| $\text{reshape}(\text{reshape}(x, s_1), s_2)$ | $\text{reshape}(x, s_2)$ | Eliminate one op |
| $e^{\ln(x)}$ | $x$ | Eliminate two ops |
| $x / c$ | $x \cdot (1/c)$ | Multiply is faster on GPU |

**Strength reduction** is particularly important for ML: replacing a division by a constant with a multiplication by the reciprocal saves significant cycles on GPU hardware where division throughput is 4--16x lower than multiplication.

### 4.5 Pass Ordering and Fixed-Point Iteration

Optimization passes interact: constant folding may enable dead code elimination, which may expose new CSE opportunities. The standard approach is **fixed-point iteration**:

```
OptimizationPipeline(G):
  repeat:
    G_old = G
    G = ConstantFold(G)
    G = AlgebraicSimplify(G)
    G = CSE(G)
    G = DCE(G)
  until G == G_old    # fixed point reached
  return G
```

In practice, 2--3 iterations suffice for most ML graphs.

---

## 5. Operator Fusion

Operator fusion is the single most impactful optimization in ML compilers. The core idea: merge multiple operators into a single kernel to reduce memory traffic.

### 5.1 Why Fusion Matters: A Memory Traffic Analysis

Consider the element-wise computation $y = \text{relu}(\text{add}(x, b))$ on tensors of size $N$ (in bytes per element, $\beta$):

**Without fusion (two separate kernels):**

| Kernel | Reads | Writes |
|---|---|---|
| add: $t = x + b$ | $N\beta + N\beta$ | $N\beta$ |
| relu: $y = \max(0, t)$ | $N\beta$ | $N\beta$ |
| **Total** | $3N\beta$ | $2N\beta$ |

Total memory traffic: $5N\beta$. The intermediate $t$ is written and then immediately read back.

**With fusion (single kernel):**

| Kernel | Reads | Writes |
|---|---|---|
| fused: $y = \max(0, x + b)$ | $N\beta + N\beta$ | $N\beta$ |
| **Total** | $2N\beta$ | $N\beta$ |

Total memory traffic: $3N\beta$. The intermediate $t$ lives in registers, never touching HBM.

**Speedup.** For memory-bound operations (arithmetic intensity < hardware ridge point), the speedup from fusion is:

$$\text{Speedup} \approx \frac{\text{unfused memory traffic}}{\text{fused memory traffic}} = \frac{5N\beta}{3N\beta} = 1.67\times$$

For longer chains (e.g., `matmul -> add -> relu -> dropout`), the relative savings grow.

### 5.2 Fusion Categories

#### Vertical Fusion (Producer-Consumer)

Fuse a chain of operators where each consumes the output of the previous one. The canonical example is fusing a GEMM with its bias add and activation function.

**Condition for vertical fusion:** The consumer reads the producer's output element-wise or in a pattern compatible with the producer's computation order. Formally, if producer $P$ writes output element $P[i_1, \ldots, i_k]$ and consumer $C$ reads only $P[i_1, \ldots, i_k]$ to compute $C[i_1, \ldots, i_k]$, the fusion is straightforward.

**Example -- fusing a residual block's tail:**

```
Before:                          After:
%0 = conv2d(input, W)           %0 = fused_conv_bn_relu(input, W, gamma, beta, mu, sigma)
%1 = batch_norm(%0)
%2 = relu(%1)
```

#### Horizontal Fusion (Sibling Operations)

Fuse independent operations that share the same input, executing them in a single kernel launch to amortize launch overhead and improve GPU occupancy.

**Example -- multi-head attention projections:**

```
Before:                          After:
%Q = matmul(x, W_Q)            %QKV = matmul(x, W_QKV)   # W_QKV = concat(W_Q, W_K, W_V)
%K = matmul(x, W_K)            %Q, %K, %V = split(%QKV)
%V = matmul(x, W_V)
```

This replaces three GEMM kernel launches with one, and the fused GEMM has larger dimensions, improving GPU utilization.

#### Mixed (Reduction + Element-wise)

Fuse a reduction operation with the element-wise operations that follow it. For example, fusing softmax (which involves a reduction for the max and sum) with the subsequent element-wise division.

**Softmax fusion:**

$$\text{softmax}(x_i) = \frac{e^{x_i - \max(x)}}{\sum_j e^{x_j - \max(x)}}$$

Naively this requires three passes over the data: (1) find max, (2) compute exponentials and sum, (3) divide. A fused implementation uses the online softmax algorithm (Milakov & Gimelshein, 2018) to reduce this to two passes (one to compute the max and normalization constant, one to produce the output):

```
# Online softmax -- two passes (reduced from three)
m = -inf          # running max
d = 0.0           # running denominator
for i in range(N):
    m_new = max(m, x[i])
    d = d * exp(m - m_new) + exp(x[i] - m_new)
    m = m_new
# Second pass for output (unavoidable for exact softmax)
for i in range(N):
    y[i] = exp(x[i] - m) / d
```

### 5.3 Fusion Legality and Profitability

Not all fusions are legal or profitable.

**Legality constraints:**

1. **No cycles.** Fusing nodes $u$ and $v$ into a single node must not create a cycle in the graph. If there exists a path from $u$ to $v$ *not* through the direct edge being fused, the fusion creates a cycle and is illegal.

2. **Reduction boundaries.** Fusing an element-wise op with a reduction requires the element-wise op to be on the "correct side" of the reduction. Post-reduction element-wise ops fuse trivially; pre-reduction element-wise ops require tiling that matches the reduction decomposition.

3. **Memory constraints.** The fused kernel's register and shared memory usage must not exceed hardware limits.

**Profitability heuristics:**

$$\text{Fuse if } \frac{\text{eliminated memory traffic}}{\text{extra register pressure cost}} > \text{threshold}$$

In practice, the heuristic is simpler: always fuse element-wise chains; fuse element-wise ops with their producer GEMM/conv only if the epilogue fits in registers; never fuse two GEMMs unless it is a horizontal fusion with weight concatenation.

### 5.4 Fusion Algorithm

Most ML compilers use a **greedy fusion** algorithm:

```
GreedyFusion(G):
  // Phase 1: Classify nodes
  for each node v:
    classify v as REDUCE (matmul, conv, reduce_sum, ...)
                or ELEMENT (relu, add, mul, exp, ...)

  // Phase 2: Build fusion groups
  groups = {{v} for v in V}
  for each edge (u, v) in topological order:
    if can_fuse(groups[u], groups[v]):
      merge groups[u] and groups[v]

  // Phase 3: Generate fused kernels
  for each group g:
    emit_kernel(g)

  return compiled program

can_fuse(g1, g2):
  // Check no cycles
  if merging g1, g2 would create a cycle: return false
  // Check resource limits
  if combined register usage > max_registers: return false
  // Check profitability
  if no memory traffic is eliminated: return false
  return true
```

---

## 6. Data Layout Optimization

### 6.1 NCHW vs NHWC

For a 4D tensor representing a batch of images:

- **NCHW**: Batch, Channels, Height, Width (default in PyTorch)
- **NHWC**: Batch, Height, Width, Channels (default in TensorFlow, preferred by Tensor Cores)

The layout determines memory access patterns. For a convolution sliding a $3 \times 3$ filter across spatial dimensions:

**NCHW layout.** Reading a $3 \times 3$ patch for a single channel requires accessing 3 rows, each contiguous in memory along the W dimension. Different channels are in separate, potentially distant memory regions.

**NHWC layout.** Reading all channels at a single spatial position is contiguous (the C dimension is innermost). A $3 \times 3$ spatial patch accesses 9 non-contiguous blocks of $C$ elements each.

### 6.2 Hardware Preferences

| Hardware | Preferred Layout | Reason |
|---|---|---|
| NVIDIA Tensor Cores | NHWC | The HMMA instruction expects channel-last |
| NVIDIA CUDA cores | Either | cuDNN supports both; NHWC slightly faster since Volta |
| Google TPU MXU | Channel-last (NHWC-like) | Systolic array feeds from inner dimension |
| Intel AMX/AVX-512 | NHWC | Vectorization along channel dimension |
| ARM NEON | NHWC | Mobile-optimized kernels use channel-last |

### 6.3 Layout Propagation

The compiler must decide where to insert layout conversions. The problem is:

- Different operators may prefer different layouts.
- Layout conversions (transposes) are expensive: they are memory-bound with arithmetic intensity of exactly 1 (read and write each element once).
- A good layout assignment minimizes total conversion cost.

**Formulation as an optimization problem.** Let $\ell(v) \in \{L_1, L_2, \ldots\}$ be the layout assigned to node $v$'s output. For each node $v$ with preferred layout $\ell^*(v)$, define a cost:

$$\text{cost}(v) = \begin{cases} 0 & \text{if } \ell(v) = \ell^*(v) \\ c_{\text{transpose}}(\tau(v)) & \text{otherwise} \end{cases}$$

For each edge $(u, v)$, if $\ell(u) \neq$ the layout expected by $v$ for that input, an additional transpose cost is incurred. The goal is to minimize total cost.

This is an instance of a minimum-cut / graph labeling problem and can be solved optimally on DAGs in polynomial time via dynamic programming. In practice, most compilers use a simpler heuristic: pick the layout preferred by the most expensive operators (convolutions, GEMMs) and convert everything else.

---

## 7. Memory Planning and Operator Scheduling

### 7.1 The Memory Planning Problem

Each operator in the graph produces an output tensor that must reside in memory from the time it is produced until its last consumer finishes. The **peak memory** is determined by the maximum total size of all simultaneously live tensors.

**Formal definition.** Given a topological ordering $\pi$ of the graph nodes, the set of live tensors at step $t$ is:

$$\text{Live}(t) = \{v \in V : \pi^{-1}(\text{producer}(v)) \le t \le \pi^{-1}(\text{last\_consumer}(v))\}$$

Peak memory under ordering $\pi$:

$$M(\pi) = \max_{t} \sum_{v \in \text{Live}(t)} \text{size}(\tau(v))$$

The goal is to find the topological ordering $\pi$ that minimizes $M(\pi)$.

### 7.2 NP-Hardness and Heuristics

Minimizing peak memory over all valid topological orderings is NP-hard in general (reducible from register allocation). Practical approaches include:

**Heuristic 1: Reverse-post-order DFS.** Process nodes in reverse post-order of the graph. This tends to keep related computations close together, freeing intermediates sooner.

**Heuristic 2: Minimum memory increase.** At each step, among all schedulable nodes (whose inputs are all computed), pick the one that minimizes the net change in live memory:

$$\Delta M(v) = \text{size}(\tau(v)) - \sum_{u \in \text{freed}(v)} \text{size}(\tau(u))$$

where $\text{freed}(v)$ is the set of tensors whose last consumer is an input to $v$.

**Heuristic 3: Critical-path priority.** Schedule nodes on the critical path first to minimize total latency, breaking ties by memory impact.

### 7.3 In-Place Operations and Buffer Reuse

**In-place optimization.** If an operator's output has the same shape and dtype as one of its inputs, and that input has no other consumers, the output can reuse the input's buffer:

$$\text{Can reuse buffer}(u, v) \iff \tau(u) = \tau(v) \wedge |\text{users}(u)| = 1 \wedge u \in \text{inputs}(v)$$

Element-wise operations like ReLU, add-in-place, and dropout are prime candidates.

**Buffer pooling.** For tensors that are never simultaneously live, their buffers can be shared. This is analogous to register allocation in traditional compilers. The compiler builds an **interference graph** where tensors that are simultaneously live share an edge, then graph-colors it to assign buffer slots.

### 7.4 Memory Planning Pseudocode

```
MemoryPlan(G, schedule):
  // Phase 1: Compute liveness
  for each node v in schedule order:
    birth[v] = schedule_index(v)
    death[v] = max(schedule_index(u) for u in users(v))

  // Phase 2: Allocate buffers (first-fit decreasing)
  pool = []     // list of (offset, size, available_at) tuples
  allocation = {}

  for each node v in schedule order:
    size = tensor_size(v)
    // Try to reuse a freed buffer
    best = None
    for slot in pool:
      if slot.available_at <= birth[v] and slot.size >= size:
        if best is None or slot.size < best.size:  // best fit
          best = slot
    if best is not None:
      allocation[v] = best.offset
      best.available_at = death[v]
    else:
      offset = next_free_offset(pool)
      pool.append((offset, size, death[v]))
      allocation[v] = offset

  peak_memory = max(slot.offset + slot.size for slot in pool)
  return allocation, peak_memory
```

---

## 8. End-to-End Example: Optimizing a Transformer Block

Consider a single transformer self-attention block:

```
# Before optimization
%q_proj = matmul(x, W_Q)           # [B, S, d]
%k_proj = matmul(x, W_K)           # [B, S, d]
%v_proj = matmul(x, W_V)           # [B, S, d]
%q = reshape(%q_proj, [B, S, h, d_k])
%k = reshape(%k_proj, [B, S, h, d_k])
%v = reshape(%v_proj, [B, S, h, d_k])
%q2 = transpose(%q, [0, 2, 1, 3])  # [B, h, S, d_k]
%k2 = transpose(%k, [0, 2, 1, 3])  # [B, h, S, d_k]
%v2 = transpose(%v, [0, 2, 1, 3])  # [B, h, S, d_k]
%scores = matmul(%q2, transpose(%k2, [0, 1, 3, 2]))  # [B, h, S, S]
%scaled = multiply(%scores, 1/sqrt(d_k))
%weights = softmax(%scaled, axis=-1)
%attn = matmul(%weights, %v2)       # [B, h, S, d_k]
```

**Pass 1: Horizontal fusion of projections.**

```
%W_QKV = parameter(concat(W_Q, W_K, W_V, axis=1))   # [d, 3d]
%qkv = matmul(x, %W_QKV)                              # [B, S, 3d]
%q_proj, %k_proj, %v_proj = split(%qkv, 3, axis=-1)
```

Three GEMMs become one. For $B=32, S=1024, d=1024$, this reduces from $3 \times 2 \times 32 \times 1024 \times 1024 \times 1024 = 192$ GFLOP to the same FLOPs but with much better GPU utilization (larger GEMM dimensions).

**Pass 2: Constant folding of the scale factor.**

$1/\sqrt{d_k}$ is a compile-time constant. The multiply node becomes a multiply-by-constant, which can be fused into the matmul epilogue.

**Pass 3: Vertical fusion.**

The `matmul -> scale -> softmax` chain is fused into a single flash-attention-style kernel (covered in Module 02). The `reshape -> transpose` sequences become metadata changes (zero-cost view operations) if the memory layout is chosen correctly.

**Pass 4: Memory planning.**

The intermediate `%scores` tensor has shape $[B, h, S, S]$, which for $B=32, h=16, S=1024$ is $32 \times 16 \times 1024 \times 1024 \times 4 = 2$ GB in FP32. Flash attention eliminates this intermediate entirely, keeping it in SRAM tile by tile.

---

## 9. Implementation: A Minimal Graph IR and Optimization Passes

```python
"""
Minimal computation graph IR with optimization passes.
This is a pedagogical implementation -- production compilers (XLA, TVM, Inductor)
are far more sophisticated, but the core ideas are the same.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import numpy as np


# ── Graph IR ─────────────────────────────────────────────────────

@dataclass
class TensorType:
    """Static type: shape + dtype."""
    shape: tuple[int, ...]
    dtype: str = "f32"

    @property
    def num_bytes(self) -> int:
        dtype_sizes = {"f32": 4, "f16": 2, "bf16": 2, "i32": 4, "i64": 8}
        elems = 1
        for s in self.shape:
            elems *= s
        return elems * dtype_sizes[self.dtype]


@dataclass
class Node:
    """A node in the computation graph (SSA value)."""
    name: str
    op: str                                  # e.g., "matmul", "add", "relu", "const"
    inputs: list[Node] = field(default_factory=list)
    attrs: dict = field(default_factory=dict)  # e.g., {"axis": -1}
    tensor_type: Optional[TensorType] = None
    const_value: Optional[np.ndarray] = None   # for constant nodes

    def __hash__(self):
        return id(self)

    def __repr__(self):
        input_names = [n.name for n in self.inputs]
        return f"%{self.name} = {self.op}({', '.join(input_names)})"


class Graph:
    """A computation graph (DAG of Nodes)."""
    def __init__(self):
        self.nodes: list[Node] = []    # topological order
        self.outputs: list[Node] = []  # graph output nodes
        self._name_counter = 0

    def add_node(self, op: str, inputs: list[Node],
                 tensor_type: TensorType = None, **attrs) -> Node:
        name = f"v{self._name_counter}"
        self._name_counter += 1
        node = Node(name=name, op=op, inputs=inputs,
                    attrs=attrs, tensor_type=tensor_type)
        self.nodes.append(node)
        return node

    def add_constant(self, value: np.ndarray) -> Node:
        name = f"c{self._name_counter}"
        self._name_counter += 1
        tt = TensorType(shape=value.shape,
                        dtype="f32" if value.dtype == np.float32 else "i32")
        node = Node(name=name, op="const", tensor_type=tt, const_value=value)
        self.nodes.append(node)
        return node

    def users(self, node: Node) -> list[Node]:
        """Return all nodes that consume `node` as an input."""
        return [n for n in self.nodes if node in n.inputs]

    def __repr__(self):
        lines = [repr(n) for n in self.nodes]
        out_names = [n.name for n in self.outputs]
        lines.append(f"outputs: [{', '.join(out_names)}]")
        return "\n".join(lines)


# ── Optimization Passes ──────────────────────────────────────────

def constant_fold(graph: Graph) -> int:
    """Fold operations whose inputs are all constants. Returns count of folded ops."""
    # Mapping from op to a callable that evaluates it on numpy arrays
    evaluators = {
        "add": lambda a, b: a + b,
        "mul": lambda a, b: a * b,
        "neg": lambda a: -a,
        "relu": lambda a: np.maximum(a, 0),
        "transpose": lambda a: a.T,
    }
    folded = 0
    changed = True
    while changed:
        changed = False
        for node in list(graph.nodes):
            if node.op == "const":
                continue
            if node.op not in evaluators:
                continue
            if all(inp.op == "const" and inp.const_value is not None
                   for inp in node.inputs):
                # All inputs are constants -- fold
                args = [inp.const_value for inp in node.inputs]
                result = evaluators[node.op](*args)
                node.op = "const"
                node.const_value = result
                node.inputs = []
                node.tensor_type = TensorType(shape=result.shape)
                folded += 1
                changed = True
    return folded


def dead_code_elimination(graph: Graph) -> int:
    """Remove nodes whose outputs are unused. Returns count of removed nodes."""
    live = set(graph.outputs)
    worklist = list(live)
    while worklist:
        node = worklist.pop()
        for inp in node.inputs:
            if inp not in live:
                live.add(inp)
                worklist.append(inp)

    removed = len(graph.nodes) - len(live)
    graph.nodes = [n for n in graph.nodes if n in live]
    return removed


def common_subexpression_elimination(graph: Graph) -> int:
    """Eliminate duplicate computations. Returns count of eliminated nodes."""
    value_map = {}   # (op, input_ids, frozen_attrs) -> node
    eliminated = 0

    for node in list(graph.nodes):
        if node.op == "const":
            continue
        key = (node.op,
               tuple(id(inp) for inp in node.inputs),
               tuple(sorted(node.attrs.items())))
        if key in value_map:
            # Replace all uses of `node` with the existing equivalent
            existing = value_map[key]
            for other in graph.nodes:
                other.inputs = [existing if inp is node else inp
                                for inp in other.inputs]
            graph.outputs = [existing if o is node else o
                             for o in graph.outputs]
            eliminated += 1
        else:
            value_map[key] = node

    # Remove eliminated nodes
    if eliminated > 0:
        dead_code_elimination(graph)
    return eliminated


# ── Demo ─────────────────────────────────────────────────────────

def demo_optimization():
    """Build a small graph and optimize it."""
    g = Graph()

    # y = relu(matmul(x, W) + b) + relu(matmul(x, W) + b)
    # The two branches are identical -- CSE should catch this.
    x = g.add_node("parameter", [], tensor_type=TensorType((32, 784)))
    W = g.add_constant(np.random.randn(784, 256).astype(np.float32))
    b = g.add_constant(np.zeros(256, dtype=np.float32))

    mm1 = g.add_node("matmul", [x, W], tensor_type=TensorType((32, 256)))
    add1 = g.add_node("add", [mm1, b], tensor_type=TensorType((32, 256)))
    relu1 = g.add_node("relu", [add1], tensor_type=TensorType((32, 256)))

    mm2 = g.add_node("matmul", [x, W], tensor_type=TensorType((32, 256)))
    add2 = g.add_node("add", [mm2, b], tensor_type=TensorType((32, 256)))
    relu2 = g.add_node("relu", [add2], tensor_type=TensorType((32, 256)))

    out = g.add_node("add", [relu1, relu2], tensor_type=TensorType((32, 256)))
    g.outputs = [out]

    print("=== Before optimization ===")
    print(g)
    print(f"Nodes: {len(g.nodes)}")

    n_cse = common_subexpression_elimination(g)
    n_dce = dead_code_elimination(g)

    print(f"\n=== After CSE ({n_cse} eliminated) + DCE ({n_dce} removed) ===")
    print(g)
    print(f"Nodes: {len(g.nodes)}")


if __name__ == "__main__":
    demo_optimization()
```

---

## Key Takeaways

1. **The computation graph is the fundamental abstraction** that enables ML compiler optimizations. By capturing the full program as a DAG, the compiler gains a global view that eager execution cannot provide.

2. **Classical compiler passes transfer directly** to the ML domain: constant folding, DCE, CSE, and algebraic simplification each contribute incremental but composable improvements.

3. **Operator fusion is the dominant optimization** for memory-bound ML workloads. A chain of $n$ element-wise operations without fusion requires $O(n)$ round-trips to HBM; fusion reduces this to $O(1)$.

4. **Data layout is a first-class optimization concern.** The wrong layout can halve throughput on Tensor Cores. The compiler must propagate layout choices globally and insert conversions only where unavoidable.

5. **Memory planning is NP-hard** in general but tractable with heuristics. Good operator scheduling can reduce peak memory by 30--50% compared to naive orderings, which is the difference between fitting a model on one GPU and needing two.

---

## Further Reading

1. **Jia, Z., Thomas, J., Warzawski, T., Gao, M., Zaharia, M., & Aiken, A.** (2019). "Optimizing DNN Computation with Relaxed Graph Substitutions." *SysML 2019*.
   - Formalizes graph substitutions as an optimization search problem; introduces the TASO system.

2. **Roesch, J., Lyubomirsky, S., Weber, L., Pollock, J., Kirisame, M., Chen, T., & Tatlock, Z.** (2019). "Relay: A New IR for Machine Learning Frameworks." *2nd ACM SIGPLAN International Workshop on Machine Learning and Programming Languages*.
   - The IR design behind TVM's high-level optimizer.

3. **Chen, T., Moreau, T., Jiang, Z., Zheng, L., Yan, E., Cowan, M., Shen, H., Wang, L., Hu, Y., Ceze, L., Guestrin, C., & Krishnamurthy, A.** (2018). "TVM: An Automated End-to-End Optimizing Compiler for Deep Learning." *OSDI 2018*.
   - The foundational TVM paper covering graph-level and operator-level optimization.

4. **Aho, A. V., Lam, M. S., Sethi, R., & Ullman, J. D.** (2006). *Compilers: Principles, Techniques, and Tools* (2nd ed.). Addison-Wesley.
   - The "Dragon Book" -- Chapters 8-9 on code optimization apply directly to ML graph IRs.

5. **Paszke, A., Gross, S., Massa, F., et al.** (2019). "PyTorch: An Imperative Style, High-Performance Deep Learning Library." *NeurIPS 2019*.
   - Describes the tension between eager execution and compilation that motivates graph capture.

6. **Milakov, M. & Gimelshein, N.** (2018). "Online Normalizer Calculation for Softmax." *arXiv:1805.02867*.
   - The online softmax algorithm that enables efficient fused softmax kernels.

---

*Next: Lecture 03b -- XLA, TVM, and the ML Compiler Stack*
