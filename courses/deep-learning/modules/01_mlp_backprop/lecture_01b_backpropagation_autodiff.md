# Lecture 01b: Backpropagation and Automatic Differentiation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** backpropagation for a general directed acyclic computation graph using the chain rule.
2. **Distinguish** forward-mode from reverse-mode automatic differentiation and determine which is more efficient given the Jacobian dimensions.
3. **Compute** the full backward pass for a 3-layer MLP with explicit Jacobian matrices and shape annotations.
4. **Implement** custom autograd functions in PyTorch with correct forward and backward methods.
5. **Apply** numerical stability techniques (log-sum-exp, gradient clipping) in practice.

---

## 2. Motivation and Context

### 2.1 Historical Background

Backpropagation has been independently discovered multiple times:

- **Bryson & Ho (1969):** Dynamic programming formulation for control systems.
- **Werbos (1974):** First application to neural networks (PhD thesis, largely unnoticed).
- **Rumelhart, Hinton, & Williams (1986):** The landmark paper that popularized backpropagation and catalyzed the connectionist movement.

The term "automatic differentiation" (AD) comes from the numerical computing community, predating neural networks. Backpropagation is precisely reverse-mode AD applied to the loss function of a neural network.

### 2.2 Why This Matters

- Every modern deep learning framework (PyTorch, JAX, TensorFlow) is, at its core, an automatic differentiation engine.
- Understanding backpropagation deeply is essential for debugging gradient issues, designing custom layers, and reasoning about computational cost.
- The choice between forward-mode and reverse-mode AD determines the computational complexity of gradient computation.

---

## 3. Core Theory

### 3.1 The Chain Rule in Multiple Dimensions

**Scalar chain rule.** If $y = f(g(x))$ where $f, g: \mathbb{R} \to \mathbb{R}$, then:

$$\frac{dy}{dx} = \frac{df}{dg} \cdot \frac{dg}{dx}$$

**Multivariate chain rule.** If $\mathbf{y} = f(\mathbf{z})$ and $\mathbf{z} = g(\mathbf{x})$ where $f: \mathbb{R}^m \to \mathbb{R}^p$ and $g: \mathbb{R}^n \to \mathbb{R}^m$, then the Jacobian of the composition is:

$$\frac{\partial \mathbf{y}}{\partial \mathbf{x}} = \frac{\partial \mathbf{y}}{\partial \mathbf{z}} \cdot \frac{\partial \mathbf{z}}{\partial \mathbf{x}}$$

where $\frac{\partial \mathbf{y}}{\partial \mathbf{z}}$ is the $p \times m$ Jacobian of $f$ and $\frac{\partial \mathbf{z}}{\partial \mathbf{x}}$ is the $m \times n$ Jacobian of $g$. The result is a $p \times n$ matrix.

**Convention.** The Jacobian $J_f$ of $f: \mathbb{R}^n \to \mathbb{R}^m$ is the $m \times n$ matrix:

$$(J_f)_{ij} = \frac{\partial f_i}{\partial x_j}$$

### 3.2 Computation Graphs

**Definition 3.1.** A **computation graph** is a directed acyclic graph (DAG) $G = (V, E)$ where:

- Each node $v_i \in V$ represents an intermediate variable.
- Each edge $(v_i, v_j) \in E$ indicates that $v_j$ depends on $v_i$ (i.e., $v_i$ is an input to the operation computing $v_j$).
- **Source nodes** (no incoming edges) are inputs or parameters.
- The **sink node** is typically the scalar loss $\mathcal{L}$.

**Example.** For $\mathcal{L} = (y - \hat{y})^2$ where $\hat{y} = \sigma(w \cdot x + b)$:

```
   x   w   b
    \  |  /
     v1 = w*x + b
         |
     v2 = sigma(v1)
         |
   y     |
    \   /
     v3 = (y - v2)^2 = L
```

Nodes: $\{x, w, b, y, v_1, v_2, v_3\}$. Edges connect inputs to outputs of each operation.

### 3.3 Topological Sort and Evaluation Order

**Forward pass:** Evaluate nodes in topological order (every node is evaluated after all its parents).

**Backward pass:** Evaluate nodes in **reverse** topological order (every node's gradient is computed after all its children's gradients).

```
Algorithm: TopologicalSort(G)
------------------------------
Input:  DAG G = (V, E)
Output: Linear ordering of V

1. Compute in-degree for each node
2. Initialize queue Q with all nodes of in-degree 0
3. While Q is not empty:
   a. Remove node v from Q, append to ordering
   b. For each child u of v:
      - Decrement in-degree of u
      - If in-degree of u becomes 0, add u to Q
4. Return ordering

Time complexity: O(|V| + |E|)
```

### 3.4 Backpropagation as Reverse-Mode AD

**Theorem 3.2 (Backpropagation).** Let $G$ be a computation graph with scalar output $\mathcal{L}$ and intermediate nodes $v_1, \ldots, v_N$ in topological order (so $v_N = \mathcal{L}$). Define the **adjoint** of node $v_i$ as:

$$\bar{v}_i \equiv \frac{\partial \mathcal{L}}{\partial v_i}$$

Then the adjoints satisfy:

$$\bar{v}_i = \sum_{j \in \text{children}(i)} \bar{v}_j \cdot \frac{\partial v_j}{\partial v_i}$$

with the base case $\bar{v}_N = \frac{\partial \mathcal{L}}{\partial \mathcal{L}} = 1$.

**Proof.** By the multivariate chain rule. Since $\mathcal{L}$ depends on $v_i$ only through the children of $v_i$ in the graph, we apply the chain rule summing over all paths:

$$\frac{\partial \mathcal{L}}{\partial v_i} = \sum_{j \in \text{children}(i)} \frac{\partial \mathcal{L}}{\partial v_j} \cdot \frac{\partial v_j}{\partial v_i}$$

This is exactly the recursive formula above. The recursion terminates at $\bar{v}_N = 1$ and propagates backward through the graph. $\blacksquare$

### 3.5 Forward Mode vs. Reverse Mode

**Forward mode.** Propagates derivatives **forward** from inputs to outputs. For each input variable $x_i$, we compute:

$$\dot{v}_k = \frac{\partial v_k}{\partial x_i}$$

for all nodes $v_k$ in topological order. One forward sweep computes derivatives with respect to **one input**. Cost: $O(n \cdot T)$ to get all $n$ input derivatives, where $T$ is the cost of one forward evaluation.

**Reverse mode.** Propagates adjoints **backward** from outputs to inputs. One backward sweep computes derivatives of **one output** with respect to **all inputs**. Cost: $O(m \cdot T)$ for $m$ outputs.

**When to use which:**

| Scenario | $f: \mathbb{R}^n \to \mathbb{R}^m$ | Preferred Mode | Cost |
|---|---|---|---|
| Many inputs, one output | $n \gg 1, m = 1$ | **Reverse** | $O(T)$ |
| One input, many outputs | $n = 1, m \gg 1$ | **Forward** | $O(T)$ |
| Full Jacobian needed | general $n, m$ | Reverse if $m < n$, Forward if $n < m$ | $O(\min(n,m) \cdot T)$ |

**Key insight for deep learning:** The loss $\mathcal{L}$ is a scalar ($m = 1$), and we have millions of parameters ($n \gg 1$). Reverse mode computes all gradients in **one** backward pass — this is why backpropagation is efficient.

**Theorem 3.3 (Cheap Gradient Principle).** For $f: \mathbb{R}^n \to \mathbb{R}$, the cost of computing $\nabla f(x)$ via reverse-mode AD is at most $5 \times$ the cost of computing $f(x)$. The constant does not depend on $n$.

---

## 4. Full Derivation: 3-Layer MLP

### 4.1 Architecture

Consider a 3-layer MLP for $K$-class classification:

$$\hat{\mathbf{y}} = \text{softmax}(W_3 \cdot \text{ReLU}(W_2 \cdot \text{ReLU}(W_1 \mathbf{x} + \mathbf{b}_1) + \mathbf{b}_2) + \mathbf{b}_3)$$

**Dimensions:**

- Input: $\mathbf{x} \in \mathbb{R}^{d_0}$
- Layer 1: $W_1 \in \mathbb{R}^{d_1 \times d_0}$, $\mathbf{b}_1 \in \mathbb{R}^{d_1}$
- Layer 2: $W_2 \in \mathbb{R}^{d_2 \times d_1}$, $\mathbf{b}_2 \in \mathbb{R}^{d_2}$
- Layer 3: $W_3 \in \mathbb{R}^{K \times d_2}$, $\mathbf{b}_3 \in \mathbb{R}^{K}$
- Output: $\hat{\mathbf{y}} \in \mathbb{R}^{K}$ (probability simplex)

### 4.2 Forward Pass (with shape annotations)

Define intermediate variables:

$$\mathbf{z}_1 = W_1 \mathbf{x} + \mathbf{b}_1 \in \mathbb{R}^{d_1}$$
$$\mathbf{h}_1 = \text{ReLU}(\mathbf{z}_1) \in \mathbb{R}^{d_1}$$
$$\mathbf{z}_2 = W_2 \mathbf{h}_1 + \mathbf{b}_2 \in \mathbb{R}^{d_2}$$
$$\mathbf{h}_2 = \text{ReLU}(\mathbf{z}_2) \in \mathbb{R}^{d_2}$$
$$\mathbf{z}_3 = W_3 \mathbf{h}_2 + \mathbf{b}_3 \in \mathbb{R}^{K}$$
$$\hat{\mathbf{y}} = \text{softmax}(\mathbf{z}_3) \in \mathbb{R}^{K}$$

**Loss (cross-entropy):**

$$\mathcal{L} = -\sum_{k=1}^{K} y_k \log \hat{y}_k$$

where $\mathbf{y} \in \{0, 1\}^K$ is the one-hot label.

### 4.3 Backward Pass: Layer-by-Layer Jacobians

**Step 0: Seed.** $\frac{\partial \mathcal{L}}{\partial \mathcal{L}} = 1$.

**Step 1: Gradient of cross-entropy w.r.t. softmax output.**

$$\frac{\partial \mathcal{L}}{\partial \hat{y}_k} = -\frac{y_k}{\hat{y}_k} \in \mathbb{R}$$

As a vector: $\frac{\partial \mathcal{L}}{\partial \hat{\mathbf{y}}} = -\mathbf{y} \oslash \hat{\mathbf{y}} \in \mathbb{R}^{K}$ (element-wise division).

**Step 2: Jacobian of softmax.**

For softmax $\hat{y}_i = \frac{e^{z_{3,i}}}{\sum_j e^{z_{3,j}}}$, the Jacobian is:

$$\frac{\partial \hat{y}_i}{\partial z_{3,j}} = \hat{y}_i (\delta_{ij} - \hat{y}_j)$$

So the Jacobian matrix is:

$$J_{\text{softmax}} = \text{diag}(\hat{\mathbf{y}}) - \hat{\mathbf{y}} \hat{\mathbf{y}}^\top \in \mathbb{R}^{K \times K}$$

**The elegant cancellation.** Combining cross-entropy with softmax:

$$\frac{\partial \mathcal{L}}{\partial z_{3,j}} = \sum_{i} \frac{\partial \mathcal{L}}{\partial \hat{y}_i} \cdot \frac{\partial \hat{y}_i}{\partial z_{3,j}} = \sum_i \left(-\frac{y_i}{\hat{y}_i}\right) \hat{y}_i (\delta_{ij} - \hat{y}_j)$$

$$= \sum_i (-y_i)(\delta_{ij} - \hat{y}_j) = -y_j + \hat{y}_j \sum_i y_i = -y_j + \hat{y}_j$$

Since $\sum_i y_i = 1$ for a one-hot vector. Therefore:

$$\boxed{\frac{\partial \mathcal{L}}{\partial \mathbf{z}_3} = \hat{\mathbf{y}} - \mathbf{y} \in \mathbb{R}^K}$$

This remarkably simple result is why cross-entropy + softmax is the standard choice.

**Step 3: Gradients for Layer 3 parameters.**

$$\frac{\partial \mathcal{L}}{\partial W_3} = \frac{\partial \mathcal{L}}{\partial \mathbf{z}_3} \cdot \frac{\partial \mathbf{z}_3}{\partial W_3}$$

Since $\mathbf{z}_3 = W_3 \mathbf{h}_2 + \mathbf{b}_3$:

$$\frac{\partial \mathcal{L}}{\partial W_3} = \underbrace{(\hat{\mathbf{y}} - \mathbf{y})}_{K \times 1} \underbrace{\mathbf{h}_2^\top}_{1 \times d_2} \in \mathbb{R}^{K \times d_2}$$

$$\frac{\partial \mathcal{L}}{\partial \mathbf{b}_3} = \hat{\mathbf{y}} - \mathbf{y} \in \mathbb{R}^{K}$$

**Step 4: Propagate to $\mathbf{h}_2$.**

$$\frac{\partial \mathcal{L}}{\partial \mathbf{h}_2} = W_3^\top (\hat{\mathbf{y}} - \mathbf{y}) \in \mathbb{R}^{d_2}$$

**Step 5: Through ReLU.**

The Jacobian of $\text{ReLU}$ is:

$$\frac{\partial \mathbf{h}_2}{\partial \mathbf{z}_2} = \text{diag}(\mathbf{1}[\mathbf{z}_2 > 0]) \in \mathbb{R}^{d_2 \times d_2}$$

where $\mathbf{1}[\mathbf{z}_2 > 0]$ is the element-wise indicator. In practice, we never form this diagonal matrix; we simply do element-wise multiplication:

$$\frac{\partial \mathcal{L}}{\partial \mathbf{z}_2} = \frac{\partial \mathcal{L}}{\partial \mathbf{h}_2} \odot \mathbf{1}[\mathbf{z}_2 > 0] \in \mathbb{R}^{d_2}$$

**Step 6: Gradients for Layer 2 parameters.**

$$\frac{\partial \mathcal{L}}{\partial W_2} = \frac{\partial \mathcal{L}}{\partial \mathbf{z}_2} \cdot \mathbf{h}_1^\top \in \mathbb{R}^{d_2 \times d_1}$$

$$\frac{\partial \mathcal{L}}{\partial \mathbf{b}_2} = \frac{\partial \mathcal{L}}{\partial \mathbf{z}_2} \in \mathbb{R}^{d_2}$$

**Step 7: Propagate to $\mathbf{h}_1$.**

$$\frac{\partial \mathcal{L}}{\partial \mathbf{h}_1} = W_2^\top \frac{\partial \mathcal{L}}{\partial \mathbf{z}_2} \in \mathbb{R}^{d_1}$$

**Step 8: Through ReLU.**

$$\frac{\partial \mathcal{L}}{\partial \mathbf{z}_1} = \frac{\partial \mathcal{L}}{\partial \mathbf{h}_1} \odot \mathbf{1}[\mathbf{z}_1 > 0] \in \mathbb{R}^{d_1}$$

**Step 9: Gradients for Layer 1 parameters.**

$$\frac{\partial \mathcal{L}}{\partial W_1} = \frac{\partial \mathcal{L}}{\partial \mathbf{z}_1} \cdot \mathbf{x}^\top \in \mathbb{R}^{d_1 \times d_0}$$

$$\frac{\partial \mathcal{L}}{\partial \mathbf{b}_1} = \frac{\partial \mathcal{L}}{\partial \mathbf{z}_1} \in \mathbb{R}^{d_1}$$

### 4.4 General Pattern

For a layer $\ell$ with $\mathbf{z}_\ell = W_\ell \mathbf{h}_{\ell-1} + \mathbf{b}_\ell$, the gradients follow the pattern:

$$\boldsymbol{\delta}_\ell \equiv \frac{\partial \mathcal{L}}{\partial \mathbf{z}_\ell} \quad \text{(the "error signal" at layer } \ell \text{)}$$

$$\frac{\partial \mathcal{L}}{\partial W_\ell} = \boldsymbol{\delta}_\ell \, \mathbf{h}_{\ell-1}^\top$$

$$\frac{\partial \mathcal{L}}{\partial \mathbf{b}_\ell} = \boldsymbol{\delta}_\ell$$

$$\boldsymbol{\delta}_{\ell-1} = (W_\ell^\top \boldsymbol{\delta}_\ell) \odot \sigma'(\mathbf{z}_{\ell-1})$$

This is the backpropagation recursion.

### 4.5 Batch Formulation

For a mini-batch of $B$ samples, $X \in \mathbb{R}^{B \times d_0}$ (rows are samples):

**Forward:**
$$Z_\ell = H_{\ell-1} W_\ell^\top + \mathbf{1}_B \mathbf{b}_\ell^\top \in \mathbb{R}^{B \times d_\ell}$$
$$H_\ell = \text{ReLU}(Z_\ell) \in \mathbb{R}^{B \times d_\ell}$$

**Backward:**
$$\Delta_\ell = \frac{\partial \mathcal{L}}{\partial Z_\ell} \in \mathbb{R}^{B \times d_\ell}$$

$$\frac{\partial \mathcal{L}}{\partial W_\ell} = \frac{1}{B} \Delta_\ell^\top H_{\ell-1} \in \mathbb{R}^{d_\ell \times d_{\ell-1}}$$

$$\frac{\partial \mathcal{L}}{\partial \mathbf{b}_\ell} = \frac{1}{B} \sum_{i=1}^{B} (\Delta_\ell)_i \in \mathbb{R}^{d_\ell}$$

$$\Delta_{\ell-1} = (\Delta_\ell W_\ell) \odot \mathbf{1}[Z_{\ell-1} > 0] \in \mathbb{R}^{B \times d_{\ell-1}}$$

---

## 5. Algorithmic Derivation

### 5.1 Backpropagation Pseudocode (General Graph)

```
Algorithm: Backpropagation(G, params, x, y)
--------------------------------------------
Input:  G - computation graph (DAG)
        params - set of parameter nodes
        x - input data
        y - target labels
Output: grad[p] for each p in params

# ── Forward Pass ──────────────────────────────────
1. Order nodes v_1, ..., v_N by topological sort of G
2. Assign input values to source nodes
3. For i = 1 to N:
     v_i.value = Op_i(parents(v_i).values)
     # Store intermediate values for backward pass
     cache[i] = (v_i.value, parents(v_i).values)
4. loss = v_N.value

# ── Backward Pass ─────────────────────────────────
5. Initialize: adjoint[v_N] = 1.0
6. For i = N down to 1:
     For each parent v_p of v_i:
       local_grad = d(Op_i) / d(v_p)   # local Jacobian
       # evaluated using cache[i]
       adjoint[v_p] += adjoint[v_i] * local_grad
       # accumulate contributions from all children

7. Return {adjoint[p] : p in params}
```

**Complexity Analysis:**

- Forward pass: $O(T_f)$ where $T_f$ is the total cost of evaluating all operations.
- Backward pass: $O(T_f)$ — each operation's local gradient costs the same order as the operation itself.
- Total: $O(T_f)$ time, $O(M)$ memory where $M$ is the total size of intermediate activations stored in cache.
- **Space-time tradeoff:** Checkpointing (recomputation) can reduce memory to $O(\sqrt{L} \cdot d)$ for an $L$-layer network at the cost of one extra forward pass.

### 5.2 Backpropagation for MLP (Specialized)

```
Algorithm: MLP_Backprop(X, Y, {W_l, b_l}_{l=1}^{L})
-----------------------------------------------------
Input:  X   - input batch, shape (B, d_0)
        Y   - one-hot labels, shape (B, K)
        W_l - weight matrices, b_l - bias vectors
Output: dW_l, db_l for l = 1, ..., L

# ── Forward Pass ──────────────────────────────────
H_0 = X                                   # (B, d_0)
For l = 1 to L-1:
    Z_l = H_{l-1} @ W_l.T + b_l           # (B, d_l)
    H_l = ReLU(Z_l)                        # (B, d_l)
Z_L = H_{L-1} @ W_L.T + b_L               # (B, K)
Y_hat = softmax(Z_L, axis=1)              # (B, K)
loss = -mean(sum(Y * log(Y_hat), axis=1)) # scalar

# ── Backward Pass ─────────────────────────────────
Delta = (Y_hat - Y) / B                   # (B, K)
dW_L = Delta.T @ H_{L-1}                  # (K, d_{L-1})
db_L = sum(Delta, axis=0)                 # (K,)

For l = L-1 down to 1:
    Delta = (Delta @ W_{l+1}) * (Z_l > 0) # (B, d_l)
    dW_l = Delta.T @ H_{l-1}              # (d_l, d_{l-1})
    db_l = sum(Delta, axis=0)             # (d_l,)

Return {dW_l, db_l}_{l=1}^{L}
```

---

## 6. Numerical Stability

### 6.1 The Log-Sum-Exp Trick

Computing $\text{softmax}(\mathbf{z})$ naively overflows for large $z_i$:

$$\hat{y}_i = \frac{e^{z_i}}{\sum_j e^{z_j}}$$

If $z_i = 1000$, then $e^{z_i}$ overflows float64. The fix:

$$\hat{y}_i = \frac{e^{z_i - c}}{\sum_j e^{z_j - c}} \quad \text{where } c = \max_j z_j$$

This is mathematically equivalent (the $e^{-c}$ cancels) but numerically stable, since the largest exponent is $e^0 = 1$.

For log-softmax (needed for cross-entropy):

$$\log \hat{y}_i = z_i - \log \sum_j e^{z_j}$$

Use the log-sum-exp trick:

$$\log \sum_j e^{z_j} = c + \log \sum_j e^{z_j - c}$$

This avoids both overflow (from $e^{z_j}$) and catastrophic cancellation.

### 6.2 Gradient Clipping

When gradients explode (common in deep networks or RNNs), we clip them:

**Clip by value:** $g_i \leftarrow \text{clip}(g_i, -\tau, \tau)$ for each component.

**Clip by global norm (preferred):**

$$\hat{\mathbf{g}} = \begin{cases} \mathbf{g} & \text{if } \|\mathbf{g}\| \le \tau \\ \tau \frac{\mathbf{g}}{\|\mathbf{g}\|} & \text{if } \|\mathbf{g}\| > \tau \end{cases}$$

where $\mathbf{g}$ is the concatenation of all parameter gradients and $\tau$ is the threshold (commonly $\tau = 1.0$ or $5.0$).

**Why clip by norm?** Clipping by value distorts the gradient direction. Clipping by norm preserves the direction but limits the step size — it is equivalent to restricting gradient descent to a trust region of radius $\tau$.

### 6.3 Vanishing and Exploding Gradients

For a deep linear network $\mathbf{h}_L = W_L W_{L-1} \cdots W_1 \mathbf{x}$, the gradient with respect to $W_1$ involves the product $W_L W_{L-1} \cdots W_2$. If $\|W_\ell\| > 1$ for all $\ell$, gradients explode exponentially; if $\|W_\ell\| < 1$, they vanish exponentially.

**Quantitatively:** If each $W_\ell$ has spectral norm $\rho$, then:

$$\left\|\frac{\partial \mathcal{L}}{\partial W_1}\right\| = O(\rho^{L-1})$$

- $\rho > 1$: exponential explosion
- $\rho < 1$: exponential vanishing
- $\rho = 1$: stable propagation (but this is a knife-edge)

Solutions: careful initialization (Xavier/He), residual connections, normalization layers, LSTM/GRU gating.

---

## 7. PyTorch Autograd: How It Works

### 7.1 The Tape-Based System

PyTorch uses a **define-by-run** (dynamic) computation graph. Each operation on tensors with `requires_grad=True` records an entry on the "tape":

```python
import torch

x = torch.tensor([2.0, 3.0], requires_grad=True)  # (2,)
y = x ** 2       # y.grad_fn = <PowBackward0>       (2,)
z = y.sum()      # z.grad_fn = <SumBackward0>        scalar

z.backward()     # traverse the graph in reverse
print(x.grad)    # tensor([4., 6.])  = 2*x
```

### 7.2 Key Autograd Concepts

```python
# ── requires_grad ──────────────────────────────────
# Only leaf tensors track gradients by default
w = torch.randn(3, 3, requires_grad=True)   # leaf, tracks grad
x = torch.randn(3)                            # leaf, no grad tracking
y = w @ x                                     # non-leaf, grad_fn is set

# ── .backward() ───────────────────────────────────
loss = y.sum()
loss.backward()     # computes dloss/dw for all tensors with requires_grad=True
print(w.grad)       # shape (3, 3), dloss/dw = outer product contributions
# NOTE: x.grad is None because x.requires_grad is False

# ── .detach() ─────────────────────────────────────
# Detach a tensor from the computation graph
y_detached = y.detach()  # same data, but no grad_fn
# Useful for: targets in loss computation, stopping gradient flow

# ── torch.no_grad() ──────────────────────────────
# Context manager to disable gradient tracking (inference mode)
with torch.no_grad():
    y_inference = w @ x   # no graph is built, faster + less memory
```

### 7.3 Custom Autograd Functions

When you need a custom forward/backward (e.g., a non-standard activation or a numerically stable implementation):

```python
import torch
from torch.autograd import Function

class StableSoftmaxCrossEntropy(Function):
    """
    Numerically stable softmax + cross-entropy in one fused operation.
    Avoids computing softmax probabilities explicitly in the forward pass.
    """

    @staticmethod
    def forward(ctx, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        Args:
            logits:  (B, K) raw scores (pre-softmax)
            targets: (B,)   integer class labels

        Returns:
            loss: scalar, mean cross-entropy loss
        """
        # Log-sum-exp trick for numerical stability
        c = logits.max(dim=1, keepdim=True).values       # (B, 1)
        log_sum_exp = c + (logits - c).exp().sum(dim=1, keepdim=True).log()
        # (B, 1)

        log_probs = logits - log_sum_exp                  # (B, K)
        B = logits.shape[0]
        loss = -log_probs[range(B), targets].mean()       # scalar

        # Save for backward
        probs = log_probs.exp()                            # (B, K)
        ctx.save_for_backward(probs, targets)
        return loss

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        """
        Args:
            grad_output: scalar (gradient of final loss w.r.t. this op's output)

        Returns:
            grad_logits:  (B, K)
            grad_targets: None (integer targets are not differentiable)
        """
        probs, targets = ctx.saved_tensors
        B = probs.shape[0]

        grad_logits = probs.clone()                        # (B, K)
        grad_logits[range(B), targets] -= 1.0              # subtract one-hot
        grad_logits /= B                                   # average over batch
        grad_logits *= grad_output                         # chain rule

        return grad_logits, None  # None for targets

# Usage:
logits = torch.randn(32, 10, requires_grad=True)   # (B=32, K=10)
targets = torch.randint(0, 10, (32,))               # (32,)
loss = StableSoftmaxCrossEntropy.apply(logits, targets)
loss.backward()
print(logits.grad.shape)  # (32, 10)
```

### 7.4 Gradient Checking

Always verify custom backward implementations with numerical gradients:

```python
from torch.autograd import gradcheck

logits = torch.randn(4, 5, dtype=torch.float64, requires_grad=True)
targets = torch.randint(0, 5, (4,))

# gradcheck perturbs each input element and compares
# numerical gradient with analytical gradient
test = gradcheck(
    StableSoftmaxCrossEntropy.apply,
    (logits, targets),
    eps=1e-6,
    atol=1e-4,
    rtol=1e-3,
)
print(f"Gradient check passed: {test}")
```

---

## 8. PyTorch Implementation: Full MLP with Backprop Visualization

```python
"""
Complete 3-layer MLP with explicit shape annotations and gradient visualization.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib.pyplot as plt

class MLP(nn.Module):
    """
    3-layer MLP for classification.

    Architecture: input -> Linear -> ReLU -> Linear -> ReLU -> Linear -> Softmax
    """
    def __init__(self, d_in: int, d_h1: int, d_h2: int, d_out: int):
        super().__init__()
        self.fc1 = nn.Linear(d_in, d_h1)    # W1: (d_h1, d_in),  b1: (d_h1,)
        self.fc2 = nn.Linear(d_h1, d_h2)    # W2: (d_h2, d_h1),  b2: (d_h2,)
        self.fc3 = nn.Linear(d_h2, d_out)   # W3: (d_out, d_h2),  b3: (d_out,)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (B, d_in)
        z1 = self.fc1(x)                     # (B, d_h1)
        h1 = F.relu(z1)                      # (B, d_h1)
        z2 = self.fc2(h1)                    # (B, d_h2)
        h2 = F.relu(z2)                      # (B, d_h2)
        z3 = self.fc3(h2)                    # (B, d_out)
        return z3                             # raw logits

# ── Training with gradient monitoring ─────────────────────────────

def train_with_gradient_monitoring(
    model: MLP,
    train_loader,
    n_epochs: int = 10,
    lr: float = 1e-3,
):
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.CrossEntropyLoss()

    gradient_norms = {name: [] for name, _ in model.named_parameters()}

    for epoch in range(n_epochs):
        for batch_x, batch_y in train_loader:
            # batch_x: (B, d_in), batch_y: (B,)
            logits = model(batch_x)            # (B, d_out)
            loss = loss_fn(logits, batch_y)    # scalar

            optimizer.zero_grad()
            loss.backward()

            # Record gradient norms per layer
            for name, param in model.named_parameters():
                if param.grad is not None:
                    gradient_norms[name].append(param.grad.norm().item())

            optimizer.step()

    return gradient_norms

def plot_gradient_norms(gradient_norms: dict):
    """Plot gradient norms over training steps for each layer."""
    fig, ax = plt.subplots(figsize=(10, 4))
    for name, norms in gradient_norms.items():
        if 'weight' in name:
            ax.plot(norms, label=name, alpha=0.7)
    ax.set_xlabel('Training step')
    ax.set_ylabel('Gradient L2 norm')
    ax.set_title('Gradient norms during training')
    ax.legend()
    ax.set_yscale('log')
    plt.tight_layout()
    plt.savefig('gradient_norms.png', dpi=150)
    plt.show()

# ── Hook-based gradient inspection ──────────────────────────────

def register_gradient_hooks(model: MLP):
    """
    Register backward hooks to inspect gradients at each layer.
    Hooks fire during the backward pass and receive the gradient
    of the loss w.r.t. the module's output.
    """
    activations = {}

    def make_hook(name):
        def hook_fn(module, grad_input, grad_output):
            # grad_output[0] shape: (B, d_out_of_module)
            # grad_input[0] shape:  (B, d_in_of_module) [for Linear]
            activations[name] = {
                'grad_output_norm': grad_output[0].norm().item(),
                'grad_input_norm': grad_input[0].norm().item()
                    if grad_input[0] is not None else None,
            }
        return hook_fn

    hooks = []
    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            h = module.register_full_backward_hook(make_hook(name))
            hooks.append(h)

    return hooks, activations

# ── Demo ─────────────────────────────────────────────────────────

if __name__ == '__main__':
    from torch.utils.data import DataLoader, TensorDataset

    # Synthetic data
    B, d_in, K = 256, 784, 10
    X = torch.randn(1000, d_in)
    Y = torch.randint(0, K, (1000,))
    loader = DataLoader(TensorDataset(X, Y), batch_size=B, shuffle=True)

    model = MLP(d_in=784, d_h1=256, d_h2=128, d_out=10)
    hooks, activations = register_gradient_hooks(model)

    grad_norms = train_with_gradient_monitoring(model, loader, n_epochs=5)
    plot_gradient_norms(grad_norms)

    # Clean up hooks
    for h in hooks:
        h.remove()
```

---

## 9. Experimental Intuition

### 9.1 Gradient Flow Through Depth

| Activation | Gradient Range per Unit | Deep Network Behavior |
|---|---|---|
| Sigmoid | $(0, 0.25]$ | Vanishes exponentially: $0.25^L \to 0$ |
| Tanh | $(0, 1]$ | Better than sigmoid, still vanishes |
| ReLU | $\{0, 1\}$ | No vanishing for active units, but "dead neuron" problem |
| GELU | continuous | Smooth, no dead neurons, mild vanishing |

### 9.2 Memory Cost of Backpropagation

For an $L$-layer MLP with hidden dimension $d$ and batch size $B$:

- **Forward activations stored:** $O(L \cdot B \cdot d)$ — this is the dominant memory cost.
- **Parameters:** $O(L \cdot d^2)$ — independent of batch size.
- **Gradient computation:** same order as forward pass.
- **Gradient checkpointing:** Reduce activation memory to $O(\sqrt{L} \cdot B \cdot d)$ at the cost of one extra forward pass.

### 9.3 Common Pitfalls

1. **Forgetting `optimizer.zero_grad()`:** Gradients accumulate by default in PyTorch. This is intentional (useful for gradient accumulation with large effective batch sizes) but a common source of bugs.
2. **In-place operations:** Operations like `x += 1` or `x.relu_()` can break autograd. Prefer `x = x + 1`.
3. **Detach for targets:** When using one network's output as another's target (e.g., target networks in RL), always `.detach()` to stop gradient flow.
4. **Double backward:** Second-order derivatives require `create_graph=True` in the first `backward()` call.

---

## 10. Connections and Extensions

### 10.1 Links to This Module

- **Lecture 01a (UAT):** The UAT guarantees the function we want exists in the network's hypothesis class. Backpropagation is how we navigate the parameter space to find it.
- **Lecture 01c (Optimization):** Backpropagation gives us the gradient; the optimizer decides what to do with it.
- **Lecture 01d (Regularization):** Techniques like dropout modify the backward pass; batch normalization adds additional gradient pathways.

### 10.2 Links to Future Modules

- **Module 02 (CNNs):** Convolution layers have structured weight sharing, making their Jacobians sparse and structured — the backward pass is a "transposed convolution."
- **Module 03 (RNNs):** Backpropagation through time (BPTT) is backprop on an unrolled computation graph, where the depth equals the sequence length.
- **Module 05 (Transformers):** The attention mechanism's backward pass involves computing gradients through softmax and matrix multiplications — directly building on this lecture.

---

## 11. Seminal Paper Reading List

### Required Reading

1. **Rumelhart, D. E., Hinton, G. E., & Williams, R. J.** (1986). "Learning representations by back-propagating errors." *Nature*, 323(6088), 533-536.
   - The paper that popularized backpropagation. Short and readable.

2. **Baydin, A. G., Pearlmutter, B. A., Radul, A. A., & Siskind, J. M.** (2018). "Automatic differentiation in machine learning: a survey." *JMLR*, 18(153), 1-43.
   - Comprehensive survey of AD. Sections 1-3 are essential.

### Recommended Reading

3. **Paszke, A., et al.** (2019). "PyTorch: An imperative style, high-performance deep learning library." *NeurIPS 2019*.
   - How PyTorch's autograd system is designed.

4. **Griewank, A. & Walther, A.** (2008). *Evaluating Derivatives: Principles and Techniques of Algorithmic Differentiation.* SIAM.
   - The definitive textbook on automatic differentiation.

### Historical

5. **Werbos, P. J.** (1974). "Beyond regression: new tools for prediction and analysis in the behavioral sciences." PhD Thesis, Harvard University.
   - First application of backpropagation to neural networks (predates Rumelhart et al. by 12 years).

6. **Linnainmaa, S.** (1970). "The representation of the cumulative rounding error of an algorithm as a Taylor expansion of the local rounding errors." Master's thesis, University of Helsinki.
   - Earliest known description of reverse-mode AD.

---

## 12. Exercises

### Theory Exercises

**Exercise 2.1.** For a function $f: \mathbb{R}^n \to \mathbb{R}^m$, the full Jacobian has $nm$ entries. Show that:

- (a) Forward-mode AD computes one column of the Jacobian per pass (cost: $n$ passes for the full Jacobian).
- (b) Reverse-mode AD computes one row of the Jacobian per pass (cost: $m$ passes for the full Jacobian).

**Exercise 2.2.** Derive the backward pass (i.e., $\partial \mathcal{L} / \partial \mathbf{z}$) through the following operations, stating shapes at each step:

- (a) $\mathbf{h} = \tanh(\mathbf{z})$ where $\mathbf{z} \in \mathbb{R}^d$.
- (b) $\mathbf{h} = \text{LayerNorm}(\mathbf{z})$ where $\text{LayerNorm}(\mathbf{z}) = \frac{\mathbf{z} - \mu}{\sqrt{\sigma^2 + \epsilon}} \odot \gamma + \beta$, with $\mu = \frac{1}{d}\sum_i z_i$, $\sigma^2 = \frac{1}{d}\sum_i (z_i - \mu)^2$.
- (c) $Y = \text{softmax}(X W^T)$ where $X \in \mathbb{R}^{B \times d}$, $W \in \mathbb{R}^{K \times d}$.

**Exercise 2.3.** Prove the Cheap Gradient Principle: if $f: \mathbb{R}^n \to \mathbb{R}$ can be evaluated in time $T$, then reverse-mode AD computes $\nabla f$ in time at most $cT$ where $c \le 5$. *(Hint: count the operations. Each elementary operation in the forward pass generates at most one multiplication and one addition in the backward pass.)*

**Exercise 2.4.** Consider a deep linear network $f(\mathbf{x}) = W_L W_{L-1} \cdots W_1 \mathbf{x}$ with $W_\ell \in \mathbb{R}^{d \times d}$.

- (a) Compute $\frac{\partial f}{\partial W_\ell}$ as a function of the other weight matrices.
- (b) Show that if all $W_\ell = W$, then $\|\frac{\partial f}{\partial W_1}\| = O(\|W\|^{L-1})$. Interpret this in terms of vanishing/exploding gradients.

### Implementation Exercises

**Exercise 2.5.** Implement a custom `torch.autograd.Function` for the Swish activation $\text{Swish}(x) = x \cdot \sigma(x)$ where $\sigma$ is the sigmoid. Verify with `torch.autograd.gradcheck`.

**Exercise 2.6.** Implement gradient clipping by global norm. Given a list of parameter tensors, compute the global gradient norm and scale all gradients if the norm exceeds a threshold $\tau$. Compare with `torch.nn.utils.clip_grad_norm_`.

**Exercise 2.7.** Implement **gradient checkpointing** for an $L$-layer MLP:

- During the forward pass, only store activations at every $\sqrt{L}$ layers.
- During the backward pass, recompute the missing activations from the nearest checkpoint.
- Measure memory usage vs. the naive approach and verify gradients match.

**Exercise 2.8.** Build a computation graph visualizer:

- Given a PyTorch model and an input, trace the computation graph.
- Output a DOT graph showing each operation, tensor shapes on edges, and gradient flow direction.
- *(Hint: use `torch.autograd.grad` with `create_graph=True` and inspect `grad_fn` attributes.)*

---

*Next: Lecture 01c — Optimization Landscape*
