# Lecture 01a: Computational Graphs and Forward/Reverse Mode Automatic Differentiation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Construct** computational graphs (Wengert lists) for arbitrary differentiable programs and identify their structural properties as DAGs.
2. **Derive** forward-mode AD using dual numbers and compute Jacobian-vector products (JVPs) for composite functions.
3. **Derive** reverse-mode AD using the adjoint method and compute vector-Jacobian products (VJPs) through backpropagation.
4. **Analyze** the computational complexity of forward vs. reverse mode AD and determine which is optimal given the function's input/output dimensionality.
5. **Execute** a full worked example computing gradients of a multi-layer function via both forward and reverse mode, verifying equivalence.

---

## 2. Motivation and Context

### 2.1 Historical Background

Automatic differentiation is older than deep learning by decades. The foundational insight -- that the chain rule can be applied mechanically to computer programs -- dates back to the early 1960s:

- **Wengert (1964)** introduced what is now called the Wengert list: an ordered sequence of elementary operations whose derivatives can be computed alongside or after the primal computation.
- **Speelpenning (1980)** built one of the first reverse-mode AD systems as a compiler transformation in his PhD thesis at the University of Illinois.
- **Griewank (1989)** formalized the theory in "On Automatic Differentiation," unifying forward and reverse modes under a common algebraic framework.
- **Baydin et al. (2018)** provided a modern survey connecting AD to machine learning, distinguishing it clearly from numerical differentiation (finite differences) and symbolic differentiation (computer algebra).

The critical realization is that backpropagation -- popularized by Rumelhart, Hinton, and Williams (1986) -- is simply reverse-mode AD applied to the loss function of a neural network. Every modern ML framework is, at its core, an AD engine.

### 2.2 Why This Matters for ML Systems

From a systems perspective, understanding AD is foundational because:

- **Framework design**: The choice of AD mode (forward, reverse, or mixed) determines the architecture of the entire computation engine.
- **Memory-compute trade-offs**: Reverse-mode AD requires storing intermediate values (or recomputing them), creating a fundamental tension between memory usage and compute.
- **Compiler optimizations**: Modern ML compilers (XLA, TorchInductor, Triton) must understand AD to fuse operations, schedule memory, and generate efficient gradient kernels.
- **Custom operators**: Implementing new operations requires writing both forward and backward passes, demanding fluency with VJPs and JVPs.

### 2.3 AD vs. Alternatives

There are three ways to compute derivatives of a computer program:

| Method | Pros | Cons |
|--------|------|------|
| **Numerical (finite differences)** | Trivial to implement | $O(n)$ evaluations for $n$ inputs; catastrophic cancellation at small $\epsilon$; no exact derivatives |
| **Symbolic (CAS)** | Exact closed-form expressions | Expression swell (exponential growth); cannot handle control flow; does not exploit sharing |
| **Automatic differentiation** | Exact (to machine precision); handles control flow; exploits graph structure | Requires program transformation or operator overloading; memory overhead for tapes |

AD computes derivatives that are exact to floating-point precision, handles branches and loops, and has well-understood complexity guarantees. It is the only viable approach for modern deep learning.

---

## 3. Computational Graphs

### 3.1 Programs as DAGs

Any differentiable computation can be decomposed into a sequence of elementary operations and represented as a directed acyclic graph (DAG).

**Definition 3.1 (Computational graph).** A computational graph $G = (V, E)$ consists of:

- **Nodes** $V = \{v_1, v_2, \ldots, v_N\}$, where each node represents an intermediate variable.
- **Edges** $E \subseteq V \times V$, where $(v_i, v_j) \in E$ indicates that $v_i$ is a direct input to the operation computing $v_j$.
- **Source nodes** $\{v_1, \ldots, v_n\}$ (no incoming edges) represent inputs $x_1, \ldots, x_n$.
- **Sink node** $v_N$ represents the final output (typically a scalar loss $\mathcal{L}$).
- Each non-source node $v_i$ has an associated elementary operation $\phi_i$ such that $v_i = \phi_i(\text{parents}(v_i))$.

**Example.** Consider the function $f(x_1, x_2) = \ln(x_1) + x_1 x_2 - \sin(x_2)$. Its computational graph is:

```
v_1 = x_1               (input)
v_2 = x_2               (input)
v_3 = ln(v_1)           (unary op)
v_4 = v_1 * v_2         (binary op)
v_5 = sin(v_2)          (unary op)
v_6 = v_3 + v_4         (binary op)
v_7 = v_6 - v_5         (binary op, output)
```

### 3.2 Wengert Lists (Evaluation Traces)

The linearized representation above is called a **Wengert list** or **evaluation trace**. It is the foundation for tape-based AD systems.

**Definition 3.2 (Wengert list).** A Wengert list for a function $f: \mathbb{R}^n \to \mathbb{R}^m$ is an ordered sequence of assignments:

$$v_i = \phi_i(v_{\pi_1(i)}, v_{\pi_2(i)}, \ldots)$$

for $i = n+1, \ldots, N$, where $\pi_j(i) < i$ denotes the indices of the parents of $v_i$, and $v_1, \ldots, v_n$ are the inputs. The topological ordering ensures that every variable is defined before it is used.

This representation is crucial for systems because:
1. It defines a clear execution order (topological sort of the DAG).
2. It makes data dependencies explicit, enabling scheduling and parallelism analysis.
3. It can be stored as a "tape" for later reverse-mode traversal.

### 3.3 Local Jacobians

Each elementary operation $\phi_i$ has a **local Jacobian** that is cheap to compute. For common operations:

| Operation | $v_i = \phi_i(\ldots)$ | Local partial derivatives |
|-----------|------------------------|---------------------------|
| Addition | $v_i = v_a + v_b$ | $\frac{\partial v_i}{\partial v_a} = 1, \quad \frac{\partial v_i}{\partial v_b} = 1$ |
| Multiplication | $v_i = v_a \cdot v_b$ | $\frac{\partial v_i}{\partial v_a} = v_b, \quad \frac{\partial v_i}{\partial v_b} = v_a$ |
| Unary function | $v_i = g(v_a)$ | $\frac{\partial v_i}{\partial v_a} = g'(v_a)$ |
| Power | $v_i = v_a^k$ | $\frac{\partial v_i}{\partial v_a} = k v_a^{k-1}$ |
| Exponential | $v_i = e^{v_a}$ | $\frac{\partial v_i}{\partial v_a} = e^{v_a} = v_i$ |
| Logarithm | $v_i = \ln(v_a)$ | $\frac{\partial v_i}{\partial v_a} = 1/v_a$ |

The full Jacobian of $f$ is the product of these local Jacobians along paths in the graph. The key question is: in which order do we multiply them?

---

## 4. Forward Mode AD: Dual Numbers and JVPs

### 4.1 Dual Numbers

Forward-mode AD can be elegantly derived using the algebra of **dual numbers**.

**Definition 4.1 (Dual numbers).** Define the dual number system $\mathbb{D} = \{a + b\epsilon \mid a, b \in \mathbb{R}\}$ where $\epsilon \neq 0$ but $\epsilon^2 = 0$. The arithmetic rules follow from this nilpotent property:

$$
(a + b\epsilon) + (c + d\epsilon) = (a + c) + (b + d)\epsilon
$$
$$
(a + b\epsilon) \cdot (c + d\epsilon) = ac + (ad + bc)\epsilon
$$

The key insight is what happens when we evaluate an analytic function $f$ at a dual number:

$$f(a + b\epsilon) = f(a) + f'(a) \cdot b \cdot \epsilon$$

This follows from the Taylor expansion $f(a + b\epsilon) = f(a) + f'(a)b\epsilon + \frac{1}{2}f''(a)(b\epsilon)^2 + \cdots$, where all terms with $\epsilon^2$ and higher vanish. The real part gives the primal value $f(a)$, and the dual part gives $f'(a) \cdot b$ -- the derivative scaled by $b$.

### 4.2 Tangent Variables and the Forward Mode Algorithm

**Definition 4.2 (Tangent variable).** Given a computational graph evaluated at input $x$ and a chosen perturbation direction $\dot{x} \in \mathbb{R}^n$, the **tangent variable** $\dot{v}_i$ of an intermediate node $v_i$ is the directional derivative of $v_i$ with respect to the input along $\dot{x}$:

$$\dot{v}_i \;\equiv\; \frac{\partial v_i}{\partial x} \cdot \dot{x}$$

The name comes from the dual-number view in Section 4.1: when we propagate the dual number $v_i + \dot{v}_i\,\epsilon$ through each operation, $v_i$ is the **primal** (real part) and $\dot{v}_i$ is the **tangent** ($\epsilon$-coefficient). The dot notation $\dot{v}$ follows the AD literature convention (analogous to $\dot{y} = dy/dt$ in physics, but here the "time" is the perturbation direction $\dot{x}$).

To compute the derivative of $f: \mathbb{R}^n \to \mathbb{R}^m$ along direction $\dot{x}$, we propagate these dual numbers forward through the graph.

**Algorithm (Forward-mode AD):**

```
Input:  Wengert list for f, input x, tangent vector dot(x)
Output: f(x) and Jf(x) @ dot(x)  (the JVP)

1. Initialize: v_i = x_i,  dot(v_i) = dot(x_i)   for i = 1, ..., n
2. For i = n+1, ..., N:
     v_i     = phi_i(v_{pi(i)})                         # primal computation
     dot(v_i) = sum_j (d phi_i / d v_j) * dot(v_j)      # tangent propagation
3. Return v_N, dot(v_N)
```

Step 2 follows directly from the chain rule: each tangent $\dot{v}_i$ is the sum of local partial derivatives times the tangents of the parent nodes.

### 4.3 Jacobian-Vector Products (JVPs)

For $f: \mathbb{R}^n \to \mathbb{R}^m$ with Jacobian $J_f \in \mathbb{R}^{m \times n}$, one forward pass with tangent $\dot{x}$ computes:

$$\text{JVP}(x, \dot{x}) = J_f(x) \cdot \dot{x} \in \mathbb{R}^m$$

This is a matrix-vector product where the matrix is $m \times n$ and the vector is $n \times 1$, yielding an $m \times 1$ result.

**To compute the full Jacobian**, we need $n$ forward passes with the standard basis vectors $\dot{x} = e_i$ for $i = 1, \ldots, n$. The $i$-th pass yields the $i$-th column of $J_f$.

**Cost per forward pass:** $O(\text{cost of evaluating } f)$. The tangent computation at each node involves the same number of operations as the primal computation (up to a small constant factor, typically $\leq 3$).

### 4.4 Worked Example: Forward Mode

Let $f(x_1, x_2) = \ln(x_1) + x_1 x_2 - \sin(x_2)$ evaluated at $(x_1, x_2) = (2, 5)$.

**Pass 1: tangent $\dot{x} = (1, 0)$** (computes $\partial f / \partial x_1$):

| Step | Primal $v_i$ | Tangent $\dot{v}_i$ |
|------|---------------|----------------------|
| $v_1 = x_1 = 2$ | 2 | 1 |
| $v_2 = x_2 = 5$ | 5 | 0 |
| $v_3 = \ln(v_1) = \ln 2$ | 0.6931 | $\dot{v}_1/v_1 = 1/2 = 0.5$ |
| $v_4 = v_1 \cdot v_2$ | 10 | $\dot{v}_1 v_2 + v_1 \dot{v}_2 = 5 + 0 = 5$ |
| $v_5 = \sin(v_2) = \sin 5$ | -0.9589 | $\cos(v_2) \dot{v}_2 = 0$ |
| $v_6 = v_3 + v_4$ | 10.6931 | $0.5 + 5 = 5.5$ |
| $v_7 = v_6 - v_5$ | 11.6520 | $5.5 - 0 = 5.5$ |

So $\partial f / \partial x_1 = 5.5$.

**Pass 2: tangent $\dot{x} = (0, 1)$** (computes $\partial f / \partial x_2$):

| Step | Primal $v_i$ | Tangent $\dot{v}_i$ |
|------|---------------|----------------------|
| $v_1 = 2$ | 2 | 0 |
| $v_2 = 5$ | 5 | 1 |
| $v_3 = \ln 2$ | 0.6931 | 0 |
| $v_4 = v_1 v_2$ | 10 | $0 + 2 \cdot 1 = 2$ |
| $v_5 = \sin 5$ | -0.9589 | $\cos(5) \cdot 1 = 0.2837$ |
| $v_6 = v_3 + v_4$ | 10.6931 | $0 + 2 = 2$ |
| $v_7 = v_6 - v_5$ | 11.6520 | $2 - 0.2837 = 1.7163$ |

So $\partial f / \partial x_2 = 1.7163$.

**Verification:** $\frac{\partial f}{\partial x_1} = \frac{1}{x_1} + x_2 = 0.5 + 5 = 5.5$ and $\frac{\partial f}{\partial x_2} = x_1 - \cos(x_2) = 2 - 0.2837 = 1.7163$. Both match.

---

## 5. Reverse Mode AD: The Adjoint Method and VJPs

### 5.1 The Adjoint (Bar) Variables

Reverse-mode AD computes derivatives by propagating **adjoints** backward through the graph. Given a scalar output $\mathcal{L} = v_N$, the adjoint of variable $v_i$ is:

$$\bar{v}_i \equiv \frac{\partial \mathcal{L}}{\partial v_i}$$

The adjoint represents the sensitivity of the final output to changes in the intermediate variable $v_i$.

### 5.2 Reverse Mode Algorithm

**Algorithm (Reverse-mode AD):**

```
Input: Wengert list for f, input x
Output: f(x) and the gradient nabla_x f(x)

Forward pass:
1. For i = 1, ..., N:
     Compute v_i = phi_i(v_{pi(i)})
     Store v_i (and any needed intermediates) on tape

Backward pass:
2. Initialize: v_bar_N = 1  (seed: df/df = 1)
3. For i = N, N-1, ..., n+1:
     For each parent j of node i:
       v_bar_j += v_bar_i * (d phi_i / d v_j)   # accumulate adjoint
4. Return v_bar_1, ..., v_bar_n
```

The critical operation in step 3 is **adjoint accumulation**: when a variable $v_j$ feeds into multiple downstream operations, its adjoint is the sum of contributions from all consumers. This implements the multivariate chain rule:

$$\bar{v}_j = \frac{\partial \mathcal{L}}{\partial v_j} = \sum_{i : j \in \text{parents}(i)} \frac{\partial \mathcal{L}}{\partial v_i} \frac{\partial v_i}{\partial v_j} = \sum_{i : j \in \text{parents}(i)} \bar{v}_i \frac{\partial \phi_i}{\partial v_j}$$

### 5.3 Vector-Jacobian Products (VJPs)

For $f: \mathbb{R}^n \to \mathbb{R}^m$ with Jacobian $J_f \in \mathbb{R}^{m \times n}$, one reverse pass with seed vector $\bar{y} \in \mathbb{R}^m$ computes:

$$\text{VJP}(x, \bar{y}) = J_f(x)^\top \cdot \bar{y} \in \mathbb{R}^n$$

This is a matrix-vector product where the matrix is $n \times m$ (the transposed Jacobian) and the vector is $m \times 1$, yielding an $n \times 1$ result.

When $m = 1$ (scalar output, as in a loss function), a single reverse pass with $\bar{y} = 1$ computes the entire gradient $\nabla_x f \in \mathbb{R}^n$. This is the reason reverse mode is used in deep learning: the loss is scalar, but $n$ (the number of parameters) can be billions.

### 5.4 Worked Example: Reverse Mode

Using the same function $f(x_1, x_2) = \ln(x_1) + x_1 x_2 - \sin(x_2)$ at $(2, 5)$.

**Forward pass:** (same as before, storing all intermediate values)

| Node | Value |
|------|-------|
| $v_1 = x_1$ | 2 |
| $v_2 = x_2$ | 5 |
| $v_3 = \ln(v_1)$ | 0.6931 |
| $v_4 = v_1 \cdot v_2$ | 10 |
| $v_5 = \sin(v_2)$ | -0.9589 |
| $v_6 = v_3 + v_4$ | 10.6931 |
| $v_7 = v_6 - v_5$ | 11.6520 |

**Backward pass:** (seed $\bar{v}_7 = 1$)

| Step | Adjoint computation | Value |
|------|---------------------|-------|
| $\bar{v}_7 = 1$ | Seed | 1 |
| $\bar{v}_6 += \bar{v}_7 \cdot \frac{\partial v_7}{\partial v_6} = 1 \cdot 1$ | $v_7 = v_6 - v_5$ | 1 |
| $\bar{v}_5 += \bar{v}_7 \cdot \frac{\partial v_7}{\partial v_5} = 1 \cdot (-1)$ | $v_7 = v_6 - v_5$ | -1 |
| $\bar{v}_3 += \bar{v}_6 \cdot 1$ | $v_6 = v_3 + v_4$ | 1 |
| $\bar{v}_4 += \bar{v}_6 \cdot 1$ | $v_6 = v_3 + v_4$ | 1 |
| $\bar{v}_1 += \bar{v}_3 \cdot \frac{1}{v_1} = 1 \cdot 0.5$ | $v_3 = \ln(v_1)$ | 0.5 |
| $\bar{v}_1 += \bar{v}_4 \cdot v_2 = 1 \cdot 5$ | $v_4 = v_1 v_2$ | 5.5 |
| $\bar{v}_2 += \bar{v}_4 \cdot v_1 = 1 \cdot 2$ | $v_4 = v_1 v_2$ | 2 |
| $\bar{v}_2 += \bar{v}_5 \cdot \cos(v_2) = (-1)(0.2837)$ | $v_5 = \sin(v_2)$ | 1.7163 |

**Result:** $\bar{v}_1 = \frac{\partial f}{\partial x_1} = 5.5$ and $\bar{v}_2 = \frac{\partial f}{\partial x_2} = 1.7163$. Both gradients computed in a **single** backward pass.

---

## 6. Complexity Analysis: Forward vs. Reverse Mode

### 6.1 Cost Model

Let $W$ denote the computational cost of evaluating $f$ (the "work" of the forward pass, proportional to the number of operations in the Wengert list).

| Mode | Cost per pass | Passes to get full Jacobian | Total cost |
|------|---------------|------------------------------|------------|
| Forward | $O(W)$ | $n$ (one per input dimension) | $O(nW)$ |
| Reverse | $O(W)$ | $m$ (one per output dimension) | $O(mW)$ |

**Theorem 6.1 (Cheap Gradient Principle, Griewank 2000).** For $f: \mathbb{R}^n \to \mathbb{R}$ (scalar output), the gradient $\nabla f$ can be computed via reverse-mode AD at a cost of at most $5W$, where $W$ is the cost of evaluating $f$. The constant factor of 5 is a worst-case bound; in practice it is typically 2-4.

This means the cost of computing the gradient is essentially independent of $n$. For a neural network with $10^9$ parameters, one backward pass costs roughly the same as 3-4 forward passes -- not $10^9$ forward passes as finite differences would require.

### 6.2 When to Use Which Mode

The decision rule is simple:

- **Reverse mode** when $m \ll n$ (few outputs, many inputs). This is the common case in ML: scalar loss, millions of parameters.
- **Forward mode** when $n \ll m$ (few inputs, many outputs). Example: sensitivity analysis of a system with 3 parameters and 10,000 outputs.
- **Mixed mode** when both $m$ and $n$ are large. Cross-country elimination and optimal Jacobian accumulation are NP-hard in general (Naumann, 2008).

### 6.3 Memory Trade-off

Reverse mode has a hidden cost: **memory**. The forward pass must store all intermediate values needed for the backward pass. For a computation with $N$ intermediate nodes, this is $O(N)$ memory.

For deep networks with $L$ layers, the memory cost is $O(L)$ for storing activations. This motivates techniques such as:

- **Gradient checkpointing** (Chen et al., 2016): Trade compute for memory by recomputing some activations during the backward pass. With optimal checkpointing, memory reduces to $O(\sqrt{L})$ with a constant-factor increase in compute.
- **Rematerialization**: The compiler decides which values to store and which to recompute.

---

## 7. Tape-Based AD Systems

### 7.1 The Tape Data Structure

Modern AD frameworks use an execution tape (also called a Wengert tape or computation trace) to record operations during the forward pass.

```python
class TapeEntry:
    """One entry in the AD tape."""
    def __init__(self, op, inputs, output, local_gradients):
        self.op = op                     # string name of operation
        self.inputs = inputs             # list of Variable references
        self.output = output             # resulting Variable
        self.local_gradients = local_gradients  # list of (Variable, grad_fn) pairs

tape = []  # global tape, appended during forward pass
```

Each operation appends an entry. The backward pass traverses the tape in reverse order.

### 7.2 Tape Lifetime and Cleanup

A critical systems question is when to release the tape:

- **PyTorch** builds a new tape for each forward pass and releases it after `.backward()` (unless `retain_graph=True`). This is eager/define-by-run.
- **JAX** uses tracing: the tape is built once during `jax.jit` or `jax.grad` and compiled into an XLA computation. The trace is reused across calls.
- **TensorFlow 1.x** used a persistent graph (define-and-run). The graph was built once and executed many times.

### 7.3 Handling Control Flow

One advantage of tape-based (define-by-run) AD is natural handling of control flow:

```python
def f(x):
    if x.sum() > 0:
        return x ** 2
    else:
        return x ** 3
```

In tape-based systems, the tape records whichever branch was actually taken. The backward pass simply reverses whatever was recorded. This is why PyTorch's dynamic graphs handle Python control flow seamlessly.

In graph-based (define-and-run) systems like TensorFlow 1.x, control flow required special graph primitives (`tf.cond`, `tf.while_loop`), making programs less Pythonic.

---

## 8. Higher-Order Derivatives

### 8.1 Computing Hessians

The Hessian $H_f \in \mathbb{R}^{n \times n}$ of a scalar function $f: \mathbb{R}^n \to \mathbb{R}$ can be computed by composing AD modes:

- **Forward-over-reverse:** First compute $g(x) = \nabla f(x)$ using reverse mode. Then compute $J_g(x) \cdot v$ (one column of the Hessian) using forward mode applied to $g$. Cost: $O(nW)$ for the full Hessian.
- **Reverse-over-forward:** Apply forward mode to get a directional derivative, then reverse mode to differentiate that. Used for Hessian-vector products.

### 8.2 Hessian-Vector Products

For many applications (conjugate gradients, trust-region methods), we only need $H_f \cdot v$, not the full Hessian. This can be computed in $O(W)$ using the R-operator (Pearlmutter, 1994):

$$H_f(x) \cdot v = \nabla_x \left[ \nabla_x f(x)^\top v \right]$$

The inner expression $\nabla_x f(x)^\top v$ is a scalar (a JVP applied to the gradient). Differentiating this scalar with respect to $x$ using reverse mode gives $H_f \cdot v$ at cost $O(W)$.

```python
# PyTorch implementation of Hessian-vector product
import torch

def hvp(f, x, v):
    """Compute Hessian-vector product H @ v."""
    x = x.detach().requires_grad_(True)
    # Forward: compute gradient
    y = f(x)
    grad, = torch.autograd.grad(y, x, create_graph=True)
    # The JVP: grad^T @ v
    gv = (grad * v).sum()
    # Reverse through the JVP to get H @ v
    hvp_result, = torch.autograd.grad(gv, x)
    return hvp_result
```

---

## 9. Full Worked Example: Multi-Layer Network

Consider a two-layer network with scalar output:

$$f(x; W_1, W_2) = W_2 \cdot \sigma(W_1 \cdot x)$$

where $x \in \mathbb{R}^3$, $W_1 \in \mathbb{R}^{2 \times 3}$, $W_2 \in \mathbb{R}^{1 \times 2}$, and $\sigma$ is applied elementwise.

The computational graph (Wengert list):

```
v_1 = x                     (input, shape 3)
v_2 = W_1                   (parameter, shape 2x3)
v_3 = W_2                   (parameter, shape 1x2)
v_4 = W_1 @ x               (matmul, shape 2)
v_5 = sigma(v_4)            (elementwise, shape 2)
v_6 = W_2 @ v_5             (matmul, shape 1)
```

### 9.1 Local Jacobians

- $\frac{\partial v_4}{\partial W_1}$: For $v_4 = W_1 x$, the Jacobian with respect to $\text{vec}(W_1)$ is $x^\top \otimes I_2$ (Kronecker product). Alternatively, $\frac{\partial v_4}{\partial W_1} = I_2 \otimes x^\top$ depending on vectorization convention. More practically, $\frac{\partial \mathcal{L}}{\partial W_1} = \bar{v}_4^\top \cdot x^\top$ (outer product of backward signal and forward activation).
- $\frac{\partial v_5}{\partial v_4} = \text{diag}(\sigma'(v_4))$: a $2 \times 2$ diagonal matrix.
- $\frac{\partial v_6}{\partial v_5} = W_2$: a $1 \times 2$ matrix.
- $\frac{\partial v_6}{\partial W_2} = v_5^\top$: a $1 \times 2$ vector.

### 9.2 Reverse Mode

Backward pass with $\bar{v}_6 = 1$:

$$\bar{v}_5 = \bar{v}_6 \cdot W_2 = W_2 \in \mathbb{R}^{1 \times 2}$$

$$\bar{v}_4 = \bar{v}_5 \odot \sigma'(v_4) \in \mathbb{R}^{1 \times 2}$$

$$\frac{\partial \mathcal{L}}{\partial W_2} = \bar{v}_6 \cdot v_5^\top = v_5^\top \in \mathbb{R}^{1 \times 2}$$

$$\frac{\partial \mathcal{L}}{\partial W_1} = \bar{v}_4^\top \cdot x^\top \in \mathbb{R}^{2 \times 3}$$

This is exactly the backpropagation algorithm: the "error signal" $\bar{v}$ flows backward through the transpose of each layer's Jacobian.

### 9.3 Forward Mode

To compute $\frac{\partial f}{\partial x_1}$ (first component of input), set $\dot{x} = e_1 = (1, 0, 0)^\top$:

$$\dot{v}_4 = W_1 \cdot \dot{x} = W_1[:, 0] \in \mathbb{R}^2$$

$$\dot{v}_5 = \sigma'(v_4) \odot \dot{v}_4 \in \mathbb{R}^2$$

$$\dot{v}_6 = W_2 \cdot \dot{v}_5 \in \mathbb{R}$$

This gives a single entry of the Jacobian $\frac{\partial f}{\partial x}$. We would need 3 passes for the full gradient with respect to $x$, or 8 passes for the full gradient with respect to all parameters. Reverse mode does it in 1 pass.

---

## 10. The Baur-Strassen Theorem

A remarkable theoretical result connects the complexity of evaluating a function to the complexity of computing its gradient.

**Theorem 10.1 (Baur and Strassen, 1983).** Let $f: \mathbb{R}^n \to \mathbb{R}$ be a rational function that can be evaluated using $p$ additions/subtractions and $q$ multiplications/divisions. Then the gradient $\nabla f$ can be computed using at most $5p$ additions/subtractions and $5q$ multiplications/divisions.

This is a stronger version of the cheap gradient principle, stated in terms of arithmetic complexity rather than runtime. It implies that the overhead of reverse-mode AD is bounded by a constant factor, regardless of the dimensionality of the input.

---

## Key Takeaways

1. **Computational graphs** (Wengert lists) decompose any differentiable program into elementary operations, forming a DAG that makes data dependencies explicit.
2. **Forward-mode AD** propagates tangent vectors forward, computing JVPs. Cost: $O(nW)$ for the full Jacobian. Efficient when $n \ll m$.
3. **Reverse-mode AD** propagates adjoint variables backward, computing VJPs. Cost: $O(mW)$ for the full Jacobian. Efficient when $m \ll n$ -- the standard case in ML.
4. The **cheap gradient principle** guarantees that the gradient of a scalar function costs at most $O(W)$, independent of input dimension.
5. Reverse mode requires **storing intermediate values**, creating a memory-compute trade-off that fundamentally shapes ML systems design (checkpointing, rematerialization).
6. Tape-based AD naturally handles **control flow** (branches, loops), which is the primary advantage of eager/define-by-run frameworks.

---

## Further Reading

1. **Griewank, A. and Walther, A. (2008).** *Evaluating Derivatives: Principles and Techniques of Algorithmic Differentiation*. SIAM. The definitive textbook on AD theory.
2. **Baydin, A.G. et al. (2018).** "Automatic Differentiation in Machine Learning: a Survey." *JMLR* 18(153):1-43. Modern survey connecting AD to ML.
3. **Pearlmutter, B.A. (1994).** "Fast Exact Multiplication by the Hessian." *Neural Computation* 6(1):147-160. The R-operator for Hessian-vector products.
4. **Baur, W. and Strassen, V. (1983).** "The Complexity of Partial Derivatives." *Theoretical Computer Science* 22(3):317-330. The foundational complexity result.
5. **Chen, T. et al. (2016).** "Training Deep Nets with Sublinear Memory Cost." arXiv:1604.06174. Gradient checkpointing.
6. **Naumann, U. (2008).** "Optimal Jacobian Accumulation is NP-Complete." *Mathematical Programming* 112:427-441. Complexity of mixed-mode AD.
