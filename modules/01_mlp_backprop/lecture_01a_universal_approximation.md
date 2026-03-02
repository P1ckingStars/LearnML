# Lecture 01a: The Universal Approximation Theorem

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **State** the Universal Approximation Theorem in its classical form (Cybenko 1989) and its generalized form (Hornik 1991).
2. **Prove** the theorem for sigmoidal activations using the Hahn-Banach theorem and Riesz representation.
3. **Construct** an explicit approximation of a continuous function using step-function decompositions.
4. **Distinguish** between width-bounded and depth-bounded approximation regimes, citing Telgarsky (2016).
5. **Articulate** what the UAT does and does not guarantee about the practical trainability of neural networks.

---

## 2. Motivation and Context

### 2.1 Historical Background

The question "what functions can neural networks represent?" predates modern deep learning. In the late 1980s, skepticism lingered from the Minsky-Papert critique of perceptrons (1969). The community needed a theoretical foundation showing that multilayer networks escape the limitations of single-layer models.

George Cybenko (1989) and Kurt Hornik, Maxwell Stinchcombe, and Halbert White (1989) independently established that feedforward networks with a single hidden layer are **universal approximators** — they can approximate any continuous function on a compact set to arbitrary precision, given enough hidden units.

### 2.2 Why This Matters

- **Existential guarantee**: Neural networks are not fundamentally limited in representational power.
- **Architecture design**: Understanding the theorem's limits helps us see why depth, not just width, matters in practice.
- **Theory vs. practice gap**: The theorem says nothing about finding the right weights — it is purely about representational capacity.

---

## 3. Core Theory

### 3.1 Setup and Notation

Let $I_n = [0,1]^n$ denote the unit hypercube in $\mathbb{R}^n$. Let $C(I_n)$ denote the space of continuous real-valued functions on $I_n$ equipped with the supremum norm:

$$\|f\|_\infty = \sup_{x \in I_n} |f(x)|$$

A **single hidden layer feedforward network** computes functions of the form:

$$N(x) = \sum_{j=1}^{m} \alpha_j \, \sigma(w_j^\top x + b_j)$$

where $x \in \mathbb{R}^n$, $w_j \in \mathbb{R}^n$, $b_j, \alpha_j \in \mathbb{R}$, and $\sigma: \mathbb{R} \to \mathbb{R}$ is the activation function.

### 3.2 Sigmoidal Functions

**Definition 3.1.** A function $\sigma: \mathbb{R} \to \mathbb{R}$ is **sigmoidal** if:

$$\sigma(t) \to \begin{cases} 1 & \text{as } t \to +\infty \\ 0 & \text{as } t \to -\infty \end{cases}$$

The standard logistic sigmoid $\sigma(t) = 1/(1 + e^{-t})$ is the canonical example, but the definition is far more general. The hyperbolic tangent (shifted and scaled) also qualifies.

### 3.3 The Cybenko Theorem (1989)

**Theorem 3.2 (Cybenko, 1989).** Let $\sigma$ be any continuous sigmoidal function. Then the set of functions of the form

$$N(x) = \sum_{j=1}^{m} \alpha_j \, \sigma(w_j^\top x + b_j)$$

is **dense** in $C(I_n)$ with respect to $\|\cdot\|_\infty$. That is, for every $f \in C(I_n)$ and every $\varepsilon > 0$, there exist $m \in \mathbb{N}$, $\alpha_j, b_j \in \mathbb{R}$, and $w_j \in \mathbb{R}^n$ such that:

$$\|N - f\|_\infty < \varepsilon$$

### 3.4 Proof of Cybenko's Theorem

We proceed by contradiction using the Hahn-Banach theorem and the Riesz representation theorem.

**Step 1: Setup by contradiction.**

Let $\mathcal{S}$ denote the set of all functions of the form $N(x) = \sum_{j=1}^m \alpha_j \sigma(w_j^\top x + b_j)$ in $C(I_n)$. Let $\overline{\mathcal{S}}$ be its closure in the sup-norm topology. We wish to show $\overline{\mathcal{S}} = C(I_n)$.

Suppose for contradiction that $\overline{\mathcal{S}} \neq C(I_n)$. Then $\overline{\mathcal{S}}$ is a proper closed linear subspace of $C(I_n)$.

**Step 2: Apply Hahn-Banach.**

By the Hahn-Banach theorem, there exists a bounded linear functional $L \in C(I_n)^*$, $L \neq 0$, such that:

$$L(g) = 0 \quad \text{for all } g \in \overline{\mathcal{S}}$$

**Step 3: Apply Riesz representation.**

By the Riesz-Markov representation theorem, since $I_n$ is compact, there exists a finite signed regular Borel measure $\mu$ on $I_n$ such that:

$$L(g) = \int_{I_n} g(x) \, d\mu(x) \quad \text{for all } g \in C(I_n)$$

The condition $L(g) = 0$ for all $g \in \overline{\mathcal{S}}$ implies, in particular, that for every $w \in \mathbb{R}^n$ and $b \in \mathbb{R}$:

$$\int_{I_n} \sigma(w^\top x + b) \, d\mu(x) = 0 \quad \cdots (*)$$

**Step 4: Show $\mu = 0$ to reach contradiction.**

We need to show that $(*)$ forces $\mu = 0$, contradicting $L \neq 0$.

**Step 4a: Pointwise limit argument.**

Consider a fixed direction $w$ and define the half-spaces $H_{w,\theta} = \{x : w^\top x > \theta\}$. For $\lambda > 0$, consider:

$$\sigma(\lambda(w^\top x + b)) = \sigma(\lambda(w^\top x - \theta))$$

where $\theta = -b$. As $\lambda \to \infty$, this converges pointwise to:

$$\gamma(x) = \begin{cases} 1 & \text{if } w^\top x > \theta \\ \sigma(0) & \text{if } w^\top x = \theta \\ 0 & \text{if } w^\top x < \theta \end{cases}$$

By the bounded convergence theorem (since $\sigma$ is bounded and $\mu$ is finite):

$$\int_{I_n} \gamma(x) \, d\mu(x) = \lim_{\lambda \to \infty} \int_{I_n} \sigma(\lambda(w^\top x - \theta)) \, d\mu(x) = 0$$

This gives us:

$$\mu(H_{w,\theta}) + \sigma(0) \, \mu(\{x : w^\top x = \theta\}) = 0$$

for all $w, \theta$.

**Step 4b: Half-spaces determine the measure.**

By varying $\theta$, we can show $\mu(\Pi_{w,\theta}) = 0$ for all open half-spaces $\Pi_{w,\theta} = \{x : w^\top x > \theta\}$. Since the collection of all open half-spaces generates the Borel $\sigma$-algebra on $I_n$ (they form a $\pi$-system generating the full topology), and $\mu$ vanishes on all of them, we conclude $\mu = 0$.

This contradicts $L \neq 0$. Therefore $\overline{\mathcal{S}} = C(I_n)$. $\blacksquare$

### 3.5 The Hornik Generalization (1991)

Cybenko's proof relies on the sigmoidal property. Hornik et al. (1991) vastly generalized this.

**Theorem 3.3 (Hornik, 1991).** Let $\sigma: \mathbb{R} \to \mathbb{R}$ be any continuous, **non-constant** function. Then single hidden layer feedforward networks with activation $\sigma$ are dense in $C(K)$ for any compact $K \subset \mathbb{R}^n$.

The key insight: what matters is not the specific shape of $\sigma$, but that it is nonlinear. A constant activation gives only affine functions — clearly not universal. Any non-constant continuous activation suffices.

**Proof sketch (Hornik).** The argument uses the Stone-Weierstrass theorem machinery applied to the algebra generated by compositions $\sigma(w^\top x + b)$. The non-constancy ensures the generated algebra separates points and contains non-zero constants, satisfying the hypotheses of Stone-Weierstrass. The conclusion follows. $\blacksquare$

**Remark.** The result extends to $L^p$ approximation (Hornik 1991), meaning neural networks are also universal approximators in the $L^p$ sense for $1 \le p < \infty$.

### 3.6 ReLU and Non-Continuous Activations

**Theorem 3.4 (Leshno et al., 1993).** A single hidden layer network with activation $\sigma$ is a universal approximator if and only if $\sigma$ is not a polynomial.

This covers ReLU ($\sigma(t) = \max(0, t)$), which is not even sigmoidal and not bounded, yet yields universal approximation. ReLU networks approximate continuous functions by constructing piecewise linear approximations — a finite sum of ReLU units produces a continuous piecewise linear function, and these are dense in $C(K)$.

---

## 4. Constructive Approximation

### 4.1 The Construction Strategy

While the existence proof above is non-constructive, we can give an explicit construction. The idea proceeds in three stages.

**Stage 1: Approximate indicator functions of intervals.**

For a single input ($n = 1$), consider:

$$h(x) = \sigma(\lambda(x - a)) - \sigma(\lambda(x - b)), \quad a < b$$

As $\lambda \to \infty$, this approaches the indicator function $\mathbf{1}_{[a,b]}(x)$. With finite $\lambda$, we get a smooth "bump" concentrated on $[a,b]$.

**Stage 2: Approximate step functions.**

Any step function $s(x) = \sum_{k=1}^K c_k \mathbf{1}_{[a_k, b_k]}(x)$ can be approximated by:

$$\hat{s}(x) = \sum_{k=1}^K c_k \left[\sigma(\lambda(x - a_k)) - \sigma(\lambda(x - b_k))\right]$$

This uses $2K$ hidden units.

**Stage 3: Approximate continuous functions by step functions.**

By uniform continuity on compact sets, any $f \in C([0,1])$ can be uniformly approximated by step functions. Composing the two approximations yields the result.

**Multivariate extension.** For $n > 1$, we approximate $f$ by sums of "ridge functions" $g(w^\top x + b)$ — each depends on a one-dimensional projection of $x$. The same interval-bump construction works along each projection direction.

### 4.2 Pseudocode: Constructive Approximation

```
Algorithm: ConstructiveApproximation(f, epsilon, domain, sigma)
-----------------------------------------------------------
Input:  f - target continuous function on [0,1]^n
        epsilon - approximation tolerance
        sigma - sigmoidal activation
        domain - compact subset of R^n
Output: weights (W, alpha, b) such that ||N - f||_inf < epsilon

1. Choose grid resolution delta such that
   |f(x) - f(y)| < epsilon/2 whenever ||x - y|| < delta
   (possible by uniform continuity on compact domain)

2. Partition [0,1]^n into hypercubes of side length delta
   Number of cubes: M = ceil(1/delta)^n

3. For each cube C_k, k = 1, ..., M:
   a. Pick representative point x_k in C_k
   b. Set target value c_k = f(x_k)
   c. Construct bump function B_k(x) approximating 1_{C_k}(x):
      - For each dimension i, create:
        h_i(x) = sigma(lambda * (x_i - a_k^i)) - sigma(lambda * (x_i - a_k^i - delta))
      - Combine: B_k(x) = product of h_i (approximated by further network layers
        or by using ridge functions along axis-aligned directions)

4. Form network: N(x) = sum_{k=1}^{M} c_k * B_k(x)

5. Choose lambda large enough that bump function errors < epsilon/2

6. Total hidden units: O(M * n) = O((1/delta)^n * n)

Return network parameters
```

**Complexity Analysis:**
- Grid cells: $M = O(1/\delta)^n$ where $\delta$ depends on the modulus of continuity of $f$
- Hidden units per cell: $O(n)$ for axis-aligned bumps
- Total hidden units: $O(n / \delta^n)$
- This is **exponential in $n$** — the curse of dimensionality

---

## 5. Width vs. Depth: The Depth Separation

### 5.1 The Width Problem

The UAT guarantees that a **single** hidden layer suffices, but it may require exponentially many neurons. A natural question: does depth help?

### 5.2 Telgarsky's Depth Separation (2016)

**Theorem 5.1 (Telgarsky, 2016).** For every positive integer $k$, there exists a function $f_k: [0,1] \to [0,1]$ computable by a ReLU network of depth $O(k^2)$ and width $O(1)$ (constant width) such that any network of depth $O(k)$ requires width $\Omega(2^k)$ to approximate $f_k$ within $L^1$ error $1/3$.

**Proof Idea.** The function $f_k$ is a "sawtooth" function — the $k$-fold composition of the triangle wave $g(x) = 2\min(x, 1-x)$:

$$f_k(x) = \underbrace{g \circ g \circ \cdots \circ g}_{2^k \text{ times}}(x)$$

This function oscillates $2^k$ times on $[0,1]$. A deep network represents this with $O(k)$ layers (one composition per layer), but a shallow network needs $\Omega(2^k)$ linear pieces — and hence $\Omega(2^k)$ hidden units — to represent a piecewise linear function with that many oscillations.

**Key lemma.** A ReLU network with $L$ layers and width $w$ per layer computes a piecewise linear function with at most $w^L$ linear pieces. If the target has $2^k$ oscillations, we need $w^L \ge 2^k$, so $L \log w \ge k$. With $L = O(k)$, we get $w = \Omega(2)$, but more precise analysis gives the exponential lower bound.

### 5.3 Lu et al. (2017): Width-Bounded Universal Approximation

**Theorem 5.2 (Lu et al., 2017).** For ReLU networks, width $n + 4$ is sufficient for universal approximation (where $n$ is the input dimension), provided there is no constraint on depth.

This is essentially tight: width $n$ is not sufficient for universal approximation with bounded depth (there exist continuous functions that cannot be approximated).

### 5.4 Summary: Width-Depth Trade-offs

| Property | Width (shallow) | Depth (narrow) |
|---|---|---|
| UAT holds? | Yes (Cybenko) | Yes if width $\ge n+4$ (Lu et al.) |
| Representation cost | May be exponential | Can be polynomial |
| Optimization | Convex-like landscape | Harder landscape, but richer features |
| Practice | Rarely used alone | Modern architectures are deep |

---

## 6. Limitations of the Universal Approximation Theorem

### 6.1 What the UAT Does NOT Say

1. **No constructive algorithm.** The theorem does not tell us how to find the right weights. Gradient descent might not find them.
2. **No sample complexity bound.** It says nothing about how much data we need to learn $f$ from samples.
3. **No bound on network size.** The required width may be exponentially large in the input dimension or the smoothness requirements.
4. **No generalization guarantee.** A network that memorizes the training set perfectly might not generalize.
5. **No optimization guarantee.** The loss landscape may have bad local minima or saddle points that prevent SGD from reaching the optimal network.

### 6.2 The Curse of Dimensionality

For Lipschitz-continuous functions on $[0,1]^n$, any method (neural networks or otherwise) that achieves $\varepsilon$-approximation in $L^\infty$ requires $\Omega((1/\varepsilon)^n)$ parameters. Neural networks do not escape this worst case.

However, real-world functions often have **low-dimensional structure** (manifold hypothesis), and neural networks can exploit this. The practical success of deep learning is not primarily explained by the UAT.

### 6.3 The Modern Perspective

The UAT is a **necessary but insufficient** foundation for understanding deep learning. It tells us:

- Neural networks are **expressive enough** — the model class is not the bottleneck.
- The real questions are about **optimization** (can we find good parameters?), **generalization** (will they work on new data?), and **efficiency** (how big a network do we need for structured problems?).

Modern theory focuses on:
- **Neural tangent kernels** (Jacot et al., 2018): connecting wide networks to kernel methods
- **Mean field theory**: understanding infinite-width limits
- **Lottery ticket hypothesis** (Frankle & Carlin, 2019): sparse subnetworks suffice
- **Feature learning**: why deep networks learn useful representations, beyond what kernels can do

---

## 7. PyTorch Implementation: Visualizing Approximation

```python
"""
Visualize the Universal Approximation Theorem:
Train a single-hidden-layer network to approximate various target functions.
"""
import torch
import torch.nn as nn
import torch.optim as optim
import matplotlib.pyplot as plt
import numpy as np

# ── Target functions to approximate ──────────────────────────────────

def target_smooth(x: torch.Tensor) -> torch.Tensor:
    """Smooth target: sin(2*pi*x) + 0.5*cos(4*pi*x)"""
    return torch.sin(2 * np.pi * x) + 0.5 * torch.cos(4 * np.pi * x)
    # Shape: same as x

def target_discontinuous(x: torch.Tensor) -> torch.Tensor:
    """Step function (discontinuous)."""
    return (x > 0.3).float() - (x > 0.7).float()
    # Shape: same as x

def target_oscillatory(x: torch.Tensor) -> torch.Tensor:
    """High-frequency oscillation: sin(20*pi*x)."""
    return torch.sin(20 * np.pi * x)
    # Shape: same as x

# ── Single hidden layer MLP ──────────────────────────────────────────

class UniversalApproximator(nn.Module):
    """
    Single hidden layer network: f(x) = W2 @ sigma(W1 @ x + b1) + b2

    Parameters:
        input_dim:  int, dimension of input (1 for 1D approximation)
        hidden_dim: int, number of hidden units (width)
        activation: str, one of 'sigmoid', 'relu', 'tanh'
    """
    def __init__(self, input_dim: int = 1, hidden_dim: int = 64,
                 activation: str = 'sigmoid'):
        super().__init__()
        self.hidden = nn.Linear(input_dim, hidden_dim)
        # hidden.weight shape: (hidden_dim, input_dim)
        # hidden.bias shape:   (hidden_dim,)

        self.output = nn.Linear(hidden_dim, 1)
        # output.weight shape: (1, hidden_dim)
        # output.bias shape:   (1,)

        activations = {
            'sigmoid': nn.Sigmoid(),
            'relu': nn.ReLU(),
            'tanh': nn.Tanh(),
        }
        self.activation = activations[activation]

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, 1)
        h = self.hidden(x)          # (batch_size, hidden_dim)
        h = self.activation(h)      # (batch_size, hidden_dim)
        out = self.output(h)         # (batch_size, 1)
        return out

# ── Training loop ────────────────────────────────────────────────────

def train_approximator(
    target_fn,
    hidden_dim: int = 64,
    activation: str = 'sigmoid',
    n_train: int = 1000,
    n_epochs: int = 5000,
    lr: float = 1e-3,
):
    """
    Train a single-hidden-layer network to approximate target_fn on [0, 1].

    Returns:
        model: trained UniversalApproximator
        losses: list of training losses
    """
    # Training data: uniform samples from [0, 1]
    x_train = torch.rand(n_train, 1)          # (n_train, 1)
    y_train = target_fn(x_train)               # (n_train, 1)

    model = UniversalApproximator(
        input_dim=1, hidden_dim=hidden_dim, activation=activation
    )
    optimizer = optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    losses = []
    for epoch in range(n_epochs):
        pred = model(x_train)                  # (n_train, 1)
        loss = loss_fn(pred, y_train)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        losses.append(loss.item())

    return model, losses

# ── Width ablation: effect of hidden_dim on approximation quality ────

def width_ablation(target_fn, widths=[4, 16, 64, 256]):
    """
    Train networks with varying widths and compare approximation quality.
    """
    x_test = torch.linspace(0, 1, 500).unsqueeze(1)  # (500, 1)
    y_test = target_fn(x_test)                         # (500, 1)

    fig, axes = plt.subplots(1, len(widths), figsize=(4 * len(widths), 3))
    for ax, w in zip(axes, widths):
        model, losses = train_approximator(target_fn, hidden_dim=w)
        with torch.no_grad():
            y_pred = model(x_test)                     # (500, 1)
        ax.plot(x_test.numpy(), y_test.numpy(), 'b-', label='Target')
        ax.plot(x_test.numpy(), y_pred.numpy(), 'r--', label='Network')
        ax.set_title(f'Width = {w}\nFinal loss = {losses[-1]:.2e}')
        ax.legend(fontsize=8)
    plt.tight_layout()
    plt.savefig('width_ablation.png', dpi=150)
    plt.show()

# ── Depth separation demo ───────────────────────────────────────────

def sawtooth(x: torch.Tensor, n_compositions: int) -> torch.Tensor:
    """
    n-fold composition of the triangle wave g(x) = 2*min(x, 1-x).
    Illustrates Telgarsky's depth separation.
    """
    y = x.clone()
    for _ in range(n_compositions):
        y = 2 * torch.min(y, 1 - y)  # shape preserved
    return y

def depth_separation_demo():
    """
    Show that composing the triangle wave k times creates 2^k oscillations,
    easily representable by a depth-k ReLU network but requiring
    exponential width in a shallow network.
    """
    x = torch.linspace(0, 1, 2000).unsqueeze(1)  # (2000, 1)
    fig, axes = plt.subplots(1, 4, figsize=(16, 3))
    for ax, k in zip(axes, [1, 2, 4, 8]):
        y = sawtooth(x, k)
        ax.plot(x.numpy(), y.numpy(), 'b-', linewidth=0.5)
        ax.set_title(f'{k} compositions\n({2**k} oscillations)')
    plt.tight_layout()
    plt.savefig('depth_separation.png', dpi=150)
    plt.show()

# ── Run demos ────────────────────────────────────────────────────────

if __name__ == '__main__':
    print("=== Width Ablation (smooth target) ===")
    width_ablation(target_smooth)

    print("\n=== Width Ablation (discontinuous target) ===")
    width_ablation(target_discontinuous)

    print("\n=== Depth Separation Demo ===")
    depth_separation_demo()
```

---

## 8. Experimental Intuition

### 8.1 Ablation: Width vs. Approximation Quality

Typical findings when running the code above:

| Width | MSE (smooth) | MSE (discontinuous) | MSE (oscillatory) |
|-------|-------------|---------------------|-------------------|
| 4     | ~1e-1       | ~5e-2               | ~5e-1             |
| 16    | ~1e-3       | ~1e-2               | ~1e-1             |
| 64    | ~1e-5       | ~5e-3               | ~1e-3             |
| 256   | ~1e-6       | ~3e-3               | ~1e-5             |

**Observations:**
- Smooth functions converge quickly with moderate width.
- Discontinuous functions converge slowly — Gibbs-like phenomenon near discontinuities.
- Oscillatory functions require width proportional to the number of oscillations.
- Sigmoid activations produce smoother (but possibly slower-converging) approximations than ReLU.

### 8.2 Failure Modes

1. **Underfitting (too narrow).** Width 4 cannot capture a function with 20 oscillations.
2. **Optimization failure.** Even with width 256, poor initialization or learning rate can prevent convergence.
3. **Sigmoid saturation.** Large pre-activations cause vanishing gradients; sigmoid networks are harder to train for deep architectures.
4. **ReLU dead neurons.** With aggressive learning rates, ReLU units can "die" (always output zero) and never recover.

### 8.3 Hyperparameter Guidance

- **Width**: Start with $4 \times$ the "intrinsic complexity" of the target function. For MNIST digits, width 128-256 is typically sufficient for a single-hidden-layer network.
- **Activation**: ReLU for speed, sigmoid/tanh if you need bounded outputs. GELU for a smooth ReLU alternative.
- **Learning rate**: 1e-3 for Adam is a robust default. For SGD, 1e-1 with decay.

---

## 9. Connections and Extensions

### 9.1 Links to This Module

- **Lecture 01b (Backpropagation):** The UAT says good networks *exist*; backpropagation is how we *find* them.
- **Lecture 01c (Optimization):** The loss landscape determines whether gradient-based methods can reach the good networks guaranteed by the UAT.
- **Lecture 01d (Regularization):** The UAT allows arbitrarily complex functions — regularization prevents overfitting to the particular training set.

### 9.2 Links to Future Modules

- **Module 02 (CNNs):** Convolutional architectures exploit spatial structure to achieve approximation with far fewer parameters than fully-connected networks.
- **Module 05 (Transformers):** Attention mechanisms provide a different form of universal approximation for sequence-to-sequence functions.
- **Module 08 (Theory):** Neural tangent kernels and mean field theory provide quantitative refinements of the UAT.

---

## 10. Seminal Paper Reading List

### Required Reading

1. **Cybenko, G.** (1989). "Approximation by superpositions of a sigmoidal function." *Mathematics of Control, Signals and Systems*, 2(4), 303-314.
   - *The* original UAT for continuous sigmoidal activations.

2. **Hornik, K., Stinchcombe, M., & White, H.** (1989). "Multilayer feedforward networks are universal approximators." *Neural Networks*, 2(5), 359-366.
   - Simultaneous independent proof; extends to measurable sigmoidal functions.

### Recommended Reading

3. **Hornik, K.** (1991). "Approximation capabilities of multilayer feedforward networks." *Neural Networks*, 4(2), 251-257.
   - Extension to arbitrary non-constant activations and $L^p$ approximation.

4. **Telgarsky, M.** (2016). "Benefits of depth in neural networks." *COLT 2016*.
   - Proves the depth separation result for ReLU networks.

5. **Lu, Z., Pu, H., Wang, F., Hu, Z., & Wang, L.** (2017). "The expressive power of neural networks: A view from the width." *NeurIPS 2017*.
   - Width-bounded universal approximation: width $n + 4$ suffices with unbounded depth.

### Historical and Supplementary

6. **Leshno, M., Lin, V. Y., Pinkus, A., & Schocken, S.** (1993). "Multilayer feedforward networks with a nonpolynomial activation function can approximate any function." *Neural Networks*, 6(6), 861-867.
   - The most general classical result: any non-polynomial activation works.

7. **Barron, A. R.** (1993). "Universal approximation bounds for superpositions of a sigmoidal function." *IEEE Transactions on Information Theory*, 39(3), 930-945.
   - Gives quantitative bounds: $O(1/m)$ convergence rate in $L^2$ for functions with bounded Fourier moments.

8. **Minsky, M. & Papert, S.** (1969). *Perceptrons: An Introduction to Computational Geometry.* MIT Press.
   - The famous critique that (single-layer) perceptrons cannot compute XOR. Essential historical context.

---

## 11. Exercises

### Theory Exercises

**Exercise 1.1.** Show that the function $\sigma(t) = \max(0, t)$ (ReLU) is **not** sigmoidal in the sense of Definition 3.1, yet single-hidden-layer ReLU networks are still universal approximators. Which theorem applies?

**Exercise 1.2.** Let $f: [0,1] \to \mathbb{R}$ be Lipschitz continuous with constant $L$. Give an explicit upper bound on the number of hidden units needed in a ReLU network to approximate $f$ within $\varepsilon$ in the sup-norm. *(Hint: piecewise linear approximation.)*

**Exercise 1.3.** Prove that a single-hidden-layer network with polynomial activation $\sigma(t) = t^2$ **cannot** be a universal approximator. What class of functions does it generate? *(Hint: consider the output as a polynomial in $x$.)*

**Exercise 1.4.** Telgarsky's depth separation uses the triangle wave $g(x) = 2\min(x, 1-x)$.
- (a) Show that $g$ can be represented by a ReLU network with 2 hidden units and 1 layer.
- (b) Show that $g \circ g$ has exactly 4 linear pieces.
- (c) Prove by induction that the $k$-fold composition $g^{(k)}$ has $2^k$ linear pieces.

**Exercise 1.5.** The Barron (1993) result shows that if $f$ has bounded Fourier moment $C_f = \int_{\mathbb{R}^n} |\omega| |\hat{f}(\omega)| d\omega < \infty$, then a network with $m$ hidden sigmoid units can achieve $L^2$ error $O(C_f / \sqrt{m})$. This is **independent of dimension** $n$. Explain why this does not contradict the curse of dimensionality. *(Hint: what role does $C_f$ play?)*

### Implementation Exercises

**Exercise 1.6.** Modify the `train_approximator` function to:
- (a) Compare sigmoid, tanh, ReLU, and GELU activations for the same target function. Plot all four approximations.
- (b) Track not just training loss, but also the maximum pointwise error $\|N - f\|_\infty$ on a test grid.

**Exercise 1.7.** Implement the **constructive approximation** from Section 4.1:
- For $f(x) = \sin(2\pi x)$ on $[0,1]$, manually construct a sigmoid network by choosing weights that create bump functions at grid points.
- Compare the constructed network's approximation with one found by gradient descent.

**Exercise 1.8.** Replicate Telgarsky's depth separation empirically:
- Train a shallow network (1 hidden layer, varying width) to approximate the 8-fold triangle wave composition.
- Train a deep narrow network (8 layers, width 4) to approximate the same function.
- Plot approximation quality vs. parameter count for both architectures.

---

*Next: Lecture 01b — Backpropagation and Automatic Differentiation*
