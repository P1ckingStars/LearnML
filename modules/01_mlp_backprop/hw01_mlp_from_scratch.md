# Homework 01: MLP from Scratch

**Estimated time:** 20 hours
**Due date:** Two weeks from assignment
**Submission:** Jupyter notebook (.ipynb) + PDF of derivations

---

## Overview

This homework has two parts of equal weight. Part A tests your mathematical understanding of the core concepts from Lectures 01a-01d. Part B requires you to implement a multi-layer perceptron entirely from scratch using NumPy, then compare with PyTorch.

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. Cite any references you consult. Do not use any automatic differentiation library in Part B's NumPy implementation.

---

## Part A: Mathematical Derivations (50%)

### Problem A1: Softmax + Cross-Entropy Gradient (15 points)

Consider a $K$-class classification problem. The model outputs logits $\mathbf{z} \in \mathbb{R}^K$, which are passed through the softmax function:

$$\hat{y}_k = \text{softmax}(\mathbf{z})_k = \frac{e^{z_k}}{\sum_{j=1}^K e^{z_j}}$$

The cross-entropy loss against a one-hot target $\mathbf{y} \in \{0,1\}^K$ is:

$$\mathcal{L} = -\sum_{k=1}^K y_k \log \hat{y}_k$$

**(a)** [5 points] Compute the Jacobian of softmax: $\frac{\partial \hat{y}_i}{\partial z_j}$ for all $i, j$. Express this as a matrix using $\text{diag}(\hat{\mathbf{y}})$ and the outer product $\hat{\mathbf{y}}\hat{\mathbf{y}}^\top$.

**(b)** [5 points] Derive $\frac{\partial \mathcal{L}}{\partial z_j}$ by composing the cross-entropy gradient with the softmax Jacobian. Show every step of the simplification that yields $\frac{\partial \mathcal{L}}{\partial \mathbf{z}} = \hat{\mathbf{y}} - \mathbf{y}$.

**(c)** [5 points] Explain why this elegant cancellation makes softmax + cross-entropy the standard choice for classification. What would the gradient look like if we used the squared error loss $\frac{1}{2}\|\hat{\mathbf{y}} - \mathbf{y}\|^2$ instead? Show that the gradient involves a $K \times K$ Jacobian multiplication that does not simplify as cleanly.

---

### Problem A2: Batch Normalization Smooths the Loss Landscape (15 points)

Santurkar et al. (2018) argued that Batch Normalization's main benefit is making the loss landscape smoother, rather than reducing internal covariate shift.

**(a)** [5 points] Consider a function $g(\mathbf{z}) = \frac{\mathbf{z} - \mu(\mathbf{z})}{\sigma(\mathbf{z})}$ where $\mu$ and $\sigma$ are the mean and standard deviation of the components of $\mathbf{z}$. Show that:

$$\left\|\frac{\partial g}{\partial \mathbf{z}}\right\| \le \frac{\sqrt{d}}{\sigma(\mathbf{z})}$$

where $d$ is the dimension of $\mathbf{z}$. *(Hint: compute the Jacobian of the normalization and bound its spectral norm.)*

**(b)** [5 points] Using the chain rule, argue that for a network with BN at layer $\ell$, the gradient $\frac{\partial \mathcal{L}}{\partial W_\ell}$ is bounded in terms of the post-BN activation variance, independent of the pre-BN activation magnitude. Contrast this with a network without BN, where the gradient scales with the activation magnitude.

**(c)** [5 points] A key property of smooth loss landscapes is that the gradient is Lipschitz continuous: $\|\nabla \mathcal{L}(\theta + \delta) - \nabla \mathcal{L}(\theta)\| \le L \|\delta\|$ for some constant $L$. Explain qualitatively why BN reduces $L$. What are the practical consequences for choosing the learning rate?

---

### Problem A3: Xavier Initialization (10 points)

**(a)** [5 points] Consider a single fully-connected layer $\mathbf{z} = W\mathbf{h}$ where $W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$ with i.i.d. entries $W_{ij} \sim \mathcal{N}(0, \sigma_w^2)$ and $\mathbf{h} \in \mathbb{R}^{d_{\text{in}}}$ with i.i.d. entries $h_j$ having zero mean and variance $\sigma_h^2$, independent of $W$.

Derive the condition on $\sigma_w^2$ such that $\text{Var}[z_k] = \text{Var}[h_j]$ (forward signal preservation). Then derive the condition from the backward pass (preserving gradient variance). Show that both conditions cannot be simultaneously satisfied unless $d_{\text{in}} = d_{\text{out}}$, and derive the Glorot compromise $\sigma_w^2 = \frac{2}{d_{\text{in}} + d_{\text{out}}}$.

**(b)** [5 points] Now consider ReLU activations: $\mathbf{h}_\ell = \text{ReLU}(W_\ell \mathbf{h}_{\ell-1})$. Assuming the pre-activation $\mathbf{z} = W\mathbf{h}$ is symmetrically distributed around zero, show that:

$$\mathbb{E}[\text{ReLU}(z)^2] = \frac{1}{2}\text{Var}[z]$$

Use this to derive the He/Kaiming initialization: $\sigma_w^2 = \frac{2}{d_{\text{in}}}$.

---

### Problem A4: Gradient Flow in Deep Linear Networks (10 points)

Consider a deep linear network with $L$ layers: $f(\mathbf{x}) = W_L W_{L-1} \cdots W_1 \mathbf{x}$, where each $W_\ell \in \mathbb{R}^{d \times d}$.

**(a)** [3 points] Compute $\frac{\partial f}{\partial W_\ell}$ as a function of the other weight matrices and $\mathbf{x}$. Express the result as a Kronecker product involving the "prefix" $W_L \cdots W_{\ell+1}$ and the "suffix" $W_{\ell-1} \cdots W_1 \mathbf{x}$.

Specifically, show that for a scalar loss $\mathcal{L}$:

$$\frac{\partial \mathcal{L}}{\partial W_\ell} = \underbrace{(W_L \cdots W_{\ell+1})^\top \frac{\partial \mathcal{L}}{\partial f}}_{\text{backward signal}} \cdot \underbrace{(W_{\ell-1} \cdots W_1 \mathbf{x})^\top}_{\text{forward activation}}$$

**(b)** [4 points] Suppose all weight matrices are initialized identically: $W_\ell = \alpha I$ for some scalar $\alpha > 0$. Show that:

$$\left\|\frac{\partial \mathcal{L}}{\partial W_1}\right\| = \alpha^{L-1} \left\|\frac{\partial \mathcal{L}}{\partial f}\right\| \cdot \|\mathbf{x}\|$$

For what values of $\alpha$ do gradients vanish? Explode? What is the "critical" $\alpha$?

**(c)** [3 points] For general (non-identity) initialization, let $\rho_\ell = \|W_\ell\|$ (spectral norm). Show that:

$$\left\|\frac{\partial \mathcal{L}}{\partial W_\ell}\right\| \le \left(\prod_{k \neq \ell} \rho_k\right) \cdot \left\|\frac{\partial \mathcal{L}}{\partial f}\right\| \cdot \|\mathbf{x}\|$$

Discuss the implications for networks with $L = 100$ layers.

---

## Part B: Implementation (50%)

### Problem B1: NumPy MLP (25 points)

Implement a complete multi-layer perceptron in **NumPy only** (no PyTorch, no TensorFlow, no JAX). Your implementation must include:

#### B1.1 Module Interface (5 points)

Define a base `Module` class and implement the following layers:

```python
class Module:
    """Base class for all modules."""
    def forward(self, x: np.ndarray) -> np.ndarray:
        raise NotImplementedError

    def backward(self, grad_output: np.ndarray) -> np.ndarray:
        """
        Given dL/d(output), compute and store dL/d(params)
        and return dL/d(input).
        """
        raise NotImplementedError

    def parameters(self) -> list:
        """Return list of (param, grad) tuples."""
        return []

class Linear(Module):
    """Fully connected layer: z = Wx + b"""
    # W shape: (d_out, d_in), b shape: (d_out,)
    # Input x shape: (B, d_in), output shape: (B, d_out)
    # Stored gradients: dW shape (d_out, d_in), db shape (d_out,)
    ...

class ReLU(Module):
    """Element-wise ReLU activation."""
    ...

class Sigmoid(Module):
    """Element-wise sigmoid activation."""
    ...

class Tanh(Module):
    """Element-wise tanh activation."""
    ...

class GELU(Module):
    """Gaussian Error Linear Unit (approximate version)."""
    ...

class Softmax(Module):
    """Softmax (for the final layer)."""
    ...

class BatchNorm1d(Module):
    """Batch normalization (optional, for bonus points)."""
    ...
```

#### B1.2 Loss Functions (3 points)

```python
class CrossEntropyLoss:
    """
    Cross-entropy loss with numerically stable log-softmax.
    Input: logits (B, K), targets (B,) integer class labels
    Output: scalar loss
    """
    def forward(self, logits: np.ndarray, targets: np.ndarray) -> float:
        ...

    def backward(self) -> np.ndarray:
        """Return dL/d(logits), shape (B, K)."""
        ...

class MSELoss:
    """Mean squared error loss."""
    ...
```

#### B1.3 Optimizers (3 points)

```python
class SGD:
    """SGD with optional momentum."""
    def __init__(self, params, lr=0.01, momentum=0.0):
        ...
    def step(self):
        ...

class Adam:
    """Adam optimizer."""
    def __init__(self, params, lr=0.001, beta1=0.9, beta2=0.999, eps=1e-8):
        ...
    def step(self):
        ...
```

#### B1.4 MLP Assembly (4 points)

```python
class MLP:
    """
    Multi-layer perceptron assembled from the above components.

    Example:
        model = MLP([784, 256, 128, 10], activation='relu')
        model.forward(x)    # x shape: (B, 784), returns logits (B, 10)
        model.backward(dL)  # dL shape: (B, 10)
    """
    def __init__(self, dims: list, activation: str = 'relu'):
        ...
```

#### B1.5 Gradient Checking (5 points)

Implement numerical gradient checking to verify your backward pass:

```python
def gradient_check(model, loss_fn, x, y, eps=1e-5, tolerance=1e-5):
    """
    For each parameter, compare:
      - Analytical gradient (from backward pass)
      - Numerical gradient: (L(param + eps) - L(param - eps)) / (2 * eps)

    Report the relative error for each parameter tensor:
      error = |analytical - numerical| / max(|analytical|, |numerical|, 1e-8)

    Return True if all errors < tolerance.
    """
    ...
```

Your gradient check must pass for all layer types and loss functions.

#### B1.6 Training on MNIST (5 points)

- Download MNIST (you may use any library for data loading).
- Normalize pixel values to $[0, 1]$ and flatten to vectors of shape $(784,)$.
- Split into train (55,000), validation (5,000), and test (10,000).
- Train your NumPy MLP and achieve at least **97%** test accuracy with a well-chosen architecture.
- Report your final architecture, hyperparameters, and training time.

---

### Problem B2: PyTorch Reimplementation (10 points)

**(a)** [5 points] Reimplement the same architecture from B1 using `torch.nn.Module`. Verify that your PyTorch implementation achieves similar accuracy to your NumPy implementation.

```python
import torch
import torch.nn as nn

class PyTorchMLP(nn.Module):
    def __init__(self, dims: list, activation: str = 'relu'):
        super().__init__()
        # Build layers using nn.Linear, nn.ReLU, etc.
        ...

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, d_in) -> logits: (B, K)
        ...
```

**(b)** [5 points] Compare training speed (wall-clock time per epoch) between your NumPy implementation and PyTorch on the same hardware. Report the speedup factor and explain the sources of PyTorch's advantage (BLAS optimizations, GPU support, fused operations, etc.).

---

### Problem B3: Optimizer Comparison (8 points)

Using your PyTorch implementation, fix the architecture (e.g., [784, 256, 128, 10] with ReLU) and compare the following optimizers:

1. SGD (lr=0.1)
2. SGD + Momentum (lr=0.1, momentum=0.9)
3. SGD + Nesterov Momentum (lr=0.1, momentum=0.9, nesterov=True)
4. Adam (lr=1e-3)
5. AdamW (lr=1e-3, weight_decay=1e-4)

For each optimizer:

- Plot training loss vs. epoch (all on one plot).
- Plot test accuracy vs. epoch (all on one plot).
- Report final test accuracy and number of epochs to reach 97% accuracy.
- Measure wall-clock time per epoch.

**Analysis questions:**

- Which optimizer converges fastest in terms of epochs? In wall-clock time?
- Which achieves the best final test accuracy?
- Does momentum help? By how much (quantify in epochs-to-97%)?

---

### Problem B4: Activation Function Ablation (7 points)

Fix the optimizer (Adam, lr=1e-3) and architecture depth/width ([784, 256, 128, 10]). Compare the following activation functions:

1. Sigmoid: $\sigma(z) = 1/(1 + e^{-z})$
2. Tanh: $\tanh(z) = (e^z - e^{-z})/(e^z + e^{-z})$
3. ReLU: $\max(0, z)$
4. GELU: $z \cdot \Phi(z)$ where $\Phi$ is the standard normal CDF

For each activation:

- Plot training loss and test accuracy curves.
- Plot the **gradient norm per layer** at initialization and after 1 epoch. Use this to diagnose vanishing/exploding gradients.
- Plot the **activation distribution** (histogram of hidden layer outputs) at initialization and after training.

**Analysis questions:**

- Which activation function trains fastest? Achieves the best accuracy?
- For sigmoid and tanh, at what depth does training become difficult? Provide evidence using gradient norm plots.
- How does GELU compare to ReLU in terms of training dynamics?

---

## Deliverables

1. **PDF** (Part A): Clearly written derivations with all intermediate steps. Use LaTeX or neatly handwritten.

2. **Jupyter notebook** (Part B): Well-organized code with:
   - Clear section headers matching the problem numbers.
   - All code runnable from top to bottom (restart kernel and run all before submitting).
   - All plots embedded in the notebook with proper labels, legends, and titles.
   - A brief text analysis cell after each experiment summarizing your findings.

3. **Summary table** at the end of the notebook:

| Experiment | Best Config | Test Accuracy | Notes |
|---|---|---|---|
| B1: NumPy MLP | [arch, activation] | XX.X% | Training time: Xs |
| B2: PyTorch MLP | Same arch | XX.X% | Speedup: Xx |
| B3: Best optimizer | [name] | XX.X% | Epochs to 97%: X |
| B4: Best activation | [name] | XX.X% | Gradient behavior: ... |

---

## Grading Rubric

| Component | Points |
|---|---|
| **Part A** | **50** |
| A1: Softmax + CE gradient | 15 |
| A2: BN smoothness argument | 15 |
| A3: Xavier initialization | 10 |
| A4: Deep linear network gradients | 10 |
| **Part B** | **50** |
| B1: NumPy MLP (correctness + gradient check) | 25 |
| B2: PyTorch reimplementation | 10 |
| B3: Optimizer comparison + analysis | 8 |
| B4: Activation ablation + analysis | 7 |

**Bonus points (up to 10 extra):**

- Implement BatchNorm from scratch in NumPy with correct backward pass (+5).
- Implement learning rate scheduling (cosine annealing) and show improvement (+3).
- Reproduce the double descent curve for your MLP on a subset of MNIST (+2).

---

## Hints and Tips

1. **Gradient checking is your best friend.** Implement it early and run it often. A single sign error in the backward pass will produce terrible training — gradient checking catches this.

2. **Start with a tiny model** (e.g., [4, 3, 2] with 10 data points) for debugging. Only scale up once the gradient check passes.

3. **NumPy broadcasting.** Be very careful with shapes. Use `assert` statements to verify tensor shapes throughout your forward and backward passes.

4. **Numerical stability in softmax.** Always subtract $\max(\mathbf{z})$ before exponentiating. Always use log-softmax for cross-entropy loss.

5. **Batch dimension.** All your arrays should have a batch dimension as the first axis: shapes are `(B, d)`, never `(d,)`.

6. **Common bugs:**
   - Forgetting to average the loss (and gradients) over the batch.
   - Off-by-one in layer indexing during backward pass.
   - Not handling the bias gradient correctly (sum over batch, not mean, unless you mean over the loss).
   - Using `=` instead of `+=` when accumulating gradients (if a parameter is used multiple times).

---

*This homework accompanies Module 01 of the PhD Deep Learning course.*
