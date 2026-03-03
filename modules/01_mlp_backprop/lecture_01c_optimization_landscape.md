# Lecture 01c: Optimization Landscape

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Characterize** the loss surface of neural networks: critical points, saddle points, and their prevalence in high dimensions.
2. **Derive** the update rules for SGD, momentum, RMSProp, and Adam from first principles.
3. **Explain** learning rate scheduling strategies (warmup, cosine annealing, cyclical LR) and the theory behind them.
4. **Analyze** the effect of batch size on gradient noise, generalization, and compute efficiency.
5. **Derive** the Xavier/Glorot and He/Kaiming initialization variance formulas.

---

## 2. Motivation and Context

### 2.1 The Central Problem

Backpropagation gives us gradients. But how should we use them? The loss function $\mathcal{L}(\theta)$ over parameter space $\theta \in \mathbb{R}^p$ (where $p$ can be billions) defines a landscape we must navigate. The choice of optimizer, learning rate, batch size, and initialization profoundly affects:

- **Whether** training converges at all.
- **Where** it converges (sharp vs. flat minima).
- **How fast** it converges (wall-clock time, not just iterations).
- **How well** the solution generalizes to unseen data.

### 2.2 Historical Arc

- **1847:** Cauchy introduces gradient descent.
- **1951:** Robbins & Monro establish stochastic approximation theory.
- **1964:** Polyak introduces momentum.
- **2012:** Duchi et al. propose AdaGrad — adaptive learning rates.
- **2014:** Kingma & Ba introduce Adam — the default optimizer for a decade.
- **2017-present:** LAMB, AdaFactor, Lion, and other modern optimizers for large-scale training.

---

## 3. Loss Surface Geometry

### 3.1 Critical Points

A **critical point** $\theta^*$ satisfies $\nabla \mathcal{L}(\theta^*) = 0$. Critical points are classified by the Hessian $H = \nabla^2 \mathcal{L}(\theta^*)$:

| Type | Hessian Eigenvalues | Description |
|---|---|---|
| Local minimum | All $\lambda_i > 0$ | Bowl shape, attracts gradient descent |
| Local maximum | All $\lambda_i < 0$ | Hilltop, unstable |
| Saddle point | Mixed signs | Minimum in some directions, maximum in others |
| Degenerate | Some $\lambda_i = 0$ | Flat directions, common in overparameterized models |

### 3.2 Saddle Points Dominate in High Dimensions

**Theorem 3.1 (Informal, Dauphin et al., 2014).** In high-dimensional non-convex optimization landscapes (such as those of neural networks), the ratio of saddle points to local minima grows exponentially with dimension.

**Intuition.** At a critical point in $p$ dimensions, each eigenvalue of the Hessian is independently positive or negative (under random matrix assumptions). The probability that all $p$ eigenvalues are positive (a local minimum) is roughly $2^{-p}$, while the probability of a saddle point (mixed signs) is $1 - 2 \cdot 2^{-p} \approx 1$.

**Random matrix theory argument.** For a Gaussian random function in $p$ dimensions, the expected number of critical points at loss value $\mathcal{L}$ with index $k$ (exactly $k$ negative eigenvalues) is:

$$\mathbb{E}[N_k(\mathcal{L})] \propto \exp\left(p \cdot S(\mathcal{L}, k/p)\right)$$

where $S$ is an entropy function. The key finding: critical points with low loss tend to have low index (few negative eigenvalues) — meaning they are "almost" local minima. Bad saddle points (high loss, many negative directions) are easy to escape.

### 3.3 Implications for Optimization

1. **Local minima are rare:** Gradient descent is unlikely to get "stuck" at a bad local minimum.
2. **Saddle points slow convergence:** The gradient near a saddle is small, leading to slow progress. Second-order methods or momentum help escape.
3. **Good minima are connected:** Draxler et al. (2018) showed that good local minima are connected by low-loss paths — the landscape is more benign than feared.
4. **Sharp vs. flat minima:** Flat minima (low curvature) are hypothesized to generalize better (Hochreiter & Schmidhuber 1997, Keskar et al. 2017). This remains debated.

---

## 4. Gradient Descent Variants

### 4.1 Vanilla Gradient Descent

**Update rule:**

$$\theta_{t+1} = \theta_t - \eta \nabla \mathcal{L}(\theta_t)$$

where $\eta > 0$ is the learning rate.

**Convergence for convex functions.** If $\mathcal{L}$ is $L$-smooth (i.e., $\|\nabla^2 \mathcal{L}\| \le L$) and convex, then with $\eta = 1/L$:

$$\mathcal{L}(\theta_T) - \mathcal{L}(\theta^*) \le \frac{L \|\theta_0 - \theta^*\|^2}{2T}$$

Convergence rate: $O(1/T)$.

For $\mu$-strongly convex functions ($\nabla^2 \mathcal{L} \succeq \mu I$), with $\eta = 2/(\mu + L)$:

$$\|\theta_T - \theta^*\|^2 \le \left(\frac{\kappa - 1}{\kappa + 1}\right)^{2T} \|\theta_0 - \theta^*\|^2$$

where $\kappa = L/\mu$ is the condition number. Rate: linear (exponential) convergence.

### 4.2 Stochastic Gradient Descent (SGD)

In practice, computing $\nabla \mathcal{L}(\theta) = \frac{1}{N}\sum_{i=1}^{N} \nabla \ell_i(\theta)$ over the full dataset is expensive. SGD uses a mini-batch estimate:

$$g_t = \frac{1}{|B_t|} \sum_{i \in B_t} \nabla \ell_i(\theta_t)$$

where $B_t \subset \{1, \ldots, N\}$ is a random mini-batch of size $|B_t| = B$.

**Properties:**

- $\mathbb{E}[g_t] = \nabla \mathcal{L}(\theta_t)$ — unbiased estimator.
- $\text{Var}[g_t] = \frac{\sigma^2}{B}$ where $\sigma^2$ is the per-sample gradient variance.
- **Update:** $\theta_{t+1} = \theta_t - \eta \, g_t$

**Convergence (convex case):** With decaying learning rate $\eta_t = O(1/\sqrt{t})$:

$$\mathbb{E}[\mathcal{L}(\bar{\theta}_T)] - \mathcal{L}(\theta^*) = O\left(\frac{1}{\sqrt{T}}\right)$$

This is slower than full GD ($O(1/T)$), but each step is $N/B$ times cheaper.

### 4.3 SGD with Momentum (Polyak, 1964)

**Problem with vanilla SGD:** The gradient can oscillate in directions of high curvature while making slow progress in directions of low curvature.

**Momentum** introduces a velocity variable that accumulates past gradients:

$$v_{t+1} = \beta v_t + g_t$$
$$\theta_{t+1} = \theta_t - \eta \, v_{t+1}$$

where $\beta \in [0, 1)$ is the momentum coefficient (typically $\beta = 0.9$).

**Interpretation:** The velocity $v_t$ is an exponential moving average of past gradients:

$$v_t = \sum_{k=0}^{t} \beta^{t-k} g_k$$

This smooths out oscillations and accelerates progress along consistent gradient directions.

**Nesterov momentum (Nesterov, 1983).** Look ahead before computing the gradient:

$$v_{t+1} = \beta v_t + \nabla \mathcal{L}(\theta_t - \eta \beta v_t)$$
$$\theta_{t+1} = \theta_t - \eta \, v_{t+1}$$

For convex functions, Nesterov momentum achieves the optimal convergence rate $O(1/T^2)$ — a quadratic improvement over vanilla GD.

### 4.4 AdaGrad (Duchi et al., 2011)

**Idea:** Adapt the learning rate for each parameter based on the history of its gradients. Parameters that have received large gradients get smaller learning rates.

$$s_{t+1} = s_t + g_t^2 \quad \text{(element-wise square)}$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{s_{t+1}} + \epsilon} \odot g_t$$

where $\epsilon \approx 10^{-8}$ prevents division by zero.

**Problem:** The accumulated squared gradients $s_t$ grow monotonically, causing the effective learning rate to shrink to zero. This is good for convex problems (acts as automatic learning rate decay) but bad for non-convex deep learning (learning stops too early).

### 4.5 RMSProp (Hinton, 2012)

**Fix AdaGrad's problem** by using an exponential moving average of squared gradients:

$$s_{t+1} = \rho \, s_t + (1 - \rho) \, g_t^2$$
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{s_{t+1}} + \epsilon} \odot g_t$$

where $\rho \in [0, 1)$ is the decay rate (typically $\rho = 0.99$).

The term $\sqrt{s_{t+1}}$ approximates the RMS (root mean square) of recent gradients — hence the name.

### 4.6 Adam (Kingma & Ba, 2015)

**Adam = Adaptive Moments.** Combines momentum (first moment) with RMSProp (second moment):

**First moment** (mean of gradients):
$$m_{t+1} = \beta_1 m_t + (1 - \beta_1) g_t$$

**Second moment** (mean of squared gradients):
$$v_{t+1} = \beta_2 v_t + (1 - \beta_2) g_t^2$$

**Bias correction** (crucial for early steps when $m_t$ and $v_t$ are biased toward zero):
$$\hat{m}_{t+1} = \frac{m_{t+1}}{1 - \beta_1^{t+1}}, \quad \hat{v}_{t+1} = \frac{v_{t+1}}{1 - \beta_2^{t+1}}$$

**Update:**
$$\theta_{t+1} = \theta_t - \frac{\eta}{\sqrt{\hat{v}_{t+1}} + \epsilon} \odot \hat{m}_{t+1}$$

**Default hyperparameters:** $\beta_1 = 0.9$, $\beta_2 = 0.999$, $\epsilon = 10^{-8}$, $\eta = 10^{-3}$.

**Derivation of bias correction.** At step $t$, the first moment is:

$$m_t = (1 - \beta_1) \sum_{k=1}^{t} \beta_1^{t-k} g_k$$

Taking expectation (assuming stationary gradient distribution with mean $\mu_g$):

$$\mathbb{E}[m_t] = (1 - \beta_1) \mu_g \sum_{k=1}^{t} \beta_1^{t-k} = \mu_g (1 - \beta_1^t)$$

So $m_t$ underestimates $\mu_g$ by a factor of $(1 - \beta_1^t)$. Dividing by this factor yields an unbiased estimate. The same argument applies to $v_t$.

### 4.7 AdamW (Loshchilov & Hutter, 2019)

**Problem with Adam + L2 regularization:** When using Adam with L2 weight penalty (adding $\lambda \|\theta\|^2 / 2$ to the loss), the adaptive scaling interacts badly with the regularization term. The gradient of the penalty is $\lambda \theta$, which gets divided by $\sqrt{\hat{v}}$ — effectively reducing the regularization strength for parameters with large gradients.

**Fix: Decoupled weight decay.** Apply weight decay directly to the parameters, not through the gradient:

$$\theta_{t+1} = (1 - \eta \lambda) \theta_t - \frac{\eta}{\sqrt{\hat{v}_{t+1}} + \epsilon} \odot \hat{m}_{t+1}$$

This is **not** equivalent to L2 regularization with Adam (but it is equivalent for SGD). AdamW has become the default optimizer for large-scale training (transformers, LLMs, etc.).

### 4.8 Summary of Optimizers

```
Algorithm: OptimizerUpdate(type, theta, grad, state, hyperparams)
-----------------------------------------------------------------
Input:  type - optimizer name
        theta - current parameters
        grad - current gradient
        state - optimizer state (momentum, etc.)
        hyperparams - lr, beta1, beta2, etc.
Output: updated theta, updated state

Case SGD:
    theta = theta - lr * grad

Case SGD+Momentum:
    state.v = beta * state.v + grad
    theta = theta - lr * state.v

Case RMSProp:
    state.s = rho * state.s + (1 - rho) * grad^2
    theta = theta - lr * grad / (sqrt(state.s) + eps)

Case Adam:
    state.t += 1
    state.m = beta1 * state.m + (1 - beta1) * grad
    state.v = beta2 * state.v + (1 - beta2) * grad^2
    m_hat = state.m / (1 - beta1^state.t)
    v_hat = state.v / (1 - beta2^state.t)
    theta = theta - lr * m_hat / (sqrt(v_hat) + eps)

Case AdamW:
    [Same as Adam, but add:]
    theta = theta - lr * weight_decay * theta  # decoupled

Return theta, state
```

---

## 5. Learning Rate Schedules

### 5.1 Why Schedules Matter

A fixed learning rate faces a fundamental tension:

- **Too large:** Training is unstable, loss diverges or oscillates.
- **Too small:** Training is slow, may get stuck in bad regions.
- **Just right early, too large late:** After approaching a minimum, the learning rate should decrease to allow convergence.

### 5.2 Step Decay

$$\eta_t = \eta_0 \cdot \gamma^{\lfloor t / S \rfloor}$$

where $\gamma \in (0, 1)$ is the decay factor and $S$ is the step size (epochs between decays). Common choice: $\gamma = 0.1$, $S = 30$ epochs.

### 5.3 Cosine Annealing (Loshchilov & Hutter, 2017)

$$\eta_t = \eta_{\min} + \frac{1}{2}(\eta_{\max} - \eta_{\min})\left(1 + \cos\left(\frac{t}{T} \pi\right)\right)$$

where $T$ is the total number of steps.

**Why cosine?** The schedule spends more time at low learning rates (near the end) while smoothly decreasing, avoiding the abrupt drops of step decay.

**With warm restarts (SGDR):** Reset the schedule periodically:

$$\eta_t = \eta_{\min} + \frac{1}{2}(\eta_{\max} - \eta_{\min})\left(1 + \cos\left(\frac{t \mod T_i}{T_i} \pi\right)\right)$$

where $T_i$ is the period of the $i$-th restart (often $T_i = T_0 \cdot 2^i$, doubling the period each time).

### 5.4 Learning Rate Warmup

Start training with a small learning rate and linearly increase it over the first $T_w$ steps:

$$\eta_t = \eta_{\max} \cdot \frac{t}{T_w} \quad \text{for } t \le T_w$$

**Why warmup helps:**

1. **Adam's bias correction is imperfect for the first few steps.** The second moment estimate $v_t$ is noisy when $t$ is small, leading to excessively large updates. Warmup compensates.
2. **Initial loss landscape exploration.** At initialization, the loss surface may have sharp features. Small steps prevent overshooting into bad regions.
3. **Batch normalization statistics.** Early BN statistics are noisy; small learning rates reduce sensitivity to this noise.

Typical warmup: $T_w = 5\%$ to $10\%$ of total training steps, or 1-5 epochs.

### 5.5 One-Cycle Policy (Smith & Topin, 2019)

Combines warmup and cosine decay:

1. **Phase 1 (warmup):** Linear increase from $\eta_{\min}$ to $\eta_{\max}$ over $T/2$ steps.
2. **Phase 2 (annealing):** Cosine decrease from $\eta_{\max}$ to $\eta_{\min}/100$ over $T/2$ steps.

This "super-convergence" schedule often achieves the same final accuracy in $\sim 10\times$ fewer iterations.

---

## 6. Batch Size Effects

### 6.1 Gradient Noise

The mini-batch gradient $g_t = \frac{1}{B}\sum_{i \in B_t} \nabla \ell_i(\theta_t)$ has variance:

$$\text{Var}[g_t] = \frac{\sigma^2(\theta_t)}{B}$$

where $\sigma^2(\theta_t) = \frac{1}{N}\sum_{i=1}^N \|\nabla \ell_i(\theta_t) - \nabla \mathcal{L}(\theta_t)\|^2$.

**Interpretation:** Larger batches reduce noise but provide diminishing returns (the $1/B$ scaling). Doubling the batch size halves the variance but doubles the compute per step.

### 6.2 Linear Scaling Rule (Goyal et al., 2017)

**Rule:** When increasing batch size by factor $k$, multiply the learning rate by $k$.

**Justification:** After $k$ steps of SGD with batch size $B$ and learning rate $\eta$:

$$\theta_{t+k} \approx \theta_t - \eta \sum_{j=0}^{k-1} g_{t+j}$$

One step with batch size $kB$ and learning rate $k\eta$:

$$\theta_{t+1} = \theta_t - k\eta \cdot \frac{1}{kB}\sum_{i \in B'} \nabla \ell_i = \theta_t - \frac{\eta}{B} \sum_{i \in B'} \nabla \ell_i$$

These are approximately equivalent when the gradient does not change much over $k$ steps. The rule breaks down for very large batches or early in training (hence the need for warmup).

### 6.3 Critical Batch Size (McCandlish et al., 2018)

There is a **critical batch size** $B_{\text{crit}}$ below which doubling the batch size approximately halves the number of steps to converge, and above which the benefit saturates:

$$B_{\text{crit}} = \frac{B_{\text{noise}}}{G^2}$$

where $B_{\text{noise}} = \text{tr}(\Sigma)$ is the trace of the gradient covariance and $G = \|\nabla \mathcal{L}\|$ is the gradient norm.

- $B \ll B_{\text{crit}}$: Noise-dominated. Increasing $B$ is efficient.
- $B \gg B_{\text{crit}}$: Signal-dominated. Increasing $B$ wastes compute.

### 6.4 Generalization Effects

**Observation (Keskar et al., 2017):** Large-batch training tends to converge to **sharp minima** (high curvature), which generalize poorly. Small-batch training finds **flat minima** via the implicit regularization of gradient noise.

**Counterpoint:** With proper learning rate scaling and training time, large-batch training can match small-batch generalization (Hoffer et al., 2017; Goyal et al., 2017).

---

## 7. Weight Initialization

### 7.1 The Problem

If weights are too large, activations and gradients explode. If too small, they vanish. We need initialization that preserves signal magnitude through the network.

### 7.2 Xavier/Glorot Initialization (Glorot & Bengio, 2010)

**Setup.** Consider a linear layer $\mathbf{z} = W\mathbf{h} + \mathbf{b}$ where $W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$, with entries $W_{ij}$ drawn i.i.d. from some zero-mean distribution.

**Goal.** Choose $\text{Var}[W_{ij}]$ such that $\text{Var}[z_k] = \text{Var}[h_j]$ (variance is preserved in the forward pass) and $\text{Var}[\partial \mathcal{L}/\partial h_j] = \text{Var}[\partial \mathcal{L}/\partial z_k]$ (variance is preserved in the backward pass).

**Derivation (forward pass).** Assuming $h_j$ are i.i.d. with zero mean, $W_{ij}$ are i.i.d. with zero mean, and $h$ and $W$ are independent:

$$z_k = \sum_{j=1}^{d_{\text{in}}} W_{kj} h_j + b_k$$

$$\text{Var}[z_k] = \sum_{j=1}^{d_{\text{in}}} \text{Var}[W_{kj}] \cdot \mathbb{E}[h_j^2] = d_{\text{in}} \cdot \text{Var}[W] \cdot \text{Var}[h]$$

(using $\mathbb{E}[h_j^2] = \text{Var}[h_j]$ since $\mathbb{E}[h_j] = 0$.)

For $\text{Var}[z] = \text{Var}[h]$, we need:

$$\text{Var}[W] = \frac{1}{d_{\text{in}}}$$

**Derivation (backward pass).** By analogous reasoning (the backward pass through a linear layer is multiplication by $W^\top$):

$$\text{Var}[W] = \frac{1}{d_{\text{out}}}$$

**Compromise:** Glorot & Bengio average the two constraints:

$$\boxed{\text{Var}[W] = \frac{2}{d_{\text{in}} + d_{\text{out}}}}$$

**Distributions used in practice:**

- Uniform: $W_{ij} \sim \mathcal{U}\left(-\sqrt{\frac{6}{d_{\text{in}} + d_{\text{out}}}}, \sqrt{\frac{6}{d_{\text{in}} + d_{\text{out}}}}\right)$
- Normal: $W_{ij} \sim \mathcal{N}\left(0, \frac{2}{d_{\text{in}} + d_{\text{out}}}\right)$

**Assumption:** This derivation assumes **linear activations** (or activations near the origin where they are approximately linear, such as $\tanh$ for small inputs).

### 7.3 He/Kaiming Initialization (He et al., 2015)

**Modification for ReLU.** ReLU kills half the activations (those with $z < 0$), so:

$$\mathbb{E}[\text{ReLU}(z)^2] = \frac{1}{2} \mathbb{E}[z^2] = \frac{1}{2} \text{Var}[z]$$

(assuming symmetric distribution for $z$.)

This halving propagates through each layer. To compensate, double the variance:

$$\boxed{\text{Var}[W] = \frac{2}{d_{\text{in}}}}$$

This is **Kaiming initialization** (fan-in mode). The fan-out version is $\text{Var}[W] = 2/d_{\text{out}}$.

**PyTorch defaults:**

- `nn.Linear` uses Kaiming uniform by default (fan-in mode).
- `nn.Conv2d` also uses Kaiming uniform.

### 7.4 Orthogonal Initialization (Saxe et al., 2014)

For deep linear networks, orthogonal weight matrices preserve both forward signal and backward gradient norms exactly (all singular values are 1). For nonlinear networks, this provides a good starting point.

```python
# PyTorch orthogonal initialization
nn.init.orthogonal_(layer.weight, gain=1.0)
```

The `gain` factor adjusts for the activation function: `gain=1` for linear/sigmoid, `gain=sqrt(2)` for ReLU.

### 7.5 Summary Table

| Initialization | Variance | Best For |
|---|---|---|
| Xavier (uniform) | $\frac{6}{d_{\text{in}} + d_{\text{out}}}$ (range) | Sigmoid, Tanh |
| Xavier (normal) | $\frac{2}{d_{\text{in}} + d_{\text{out}}}$ | Sigmoid, Tanh |
| Kaiming (fan-in) | $\frac{2}{d_{\text{in}}}$ | ReLU, Leaky ReLU |
| Kaiming (fan-out) | $\frac{2}{d_{\text{out}}}$ | ReLU (backward-preserving) |
| Orthogonal | $\sigma_{\max}(W) = 1$ | Deep networks, RNNs |

---

## 8. PyTorch Implementation

```python
"""
Optimizer comparison and learning rate schedule visualization.
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR, OneCycleLR
import matplotlib.pyplot as plt

# ── MLP for experiments ──────────────────────────────────────────

class ExperimentMLP(nn.Module):
    def __init__(self, d_in: int = 784, d_hidden: int = 256,
                 n_layers: int = 4, d_out: int = 10,
                 init: str = 'kaiming'):
        super().__init__()
        layers = []
        dims = [d_in] + [d_hidden] * (n_layers - 1) + [d_out]
        for i in range(len(dims) - 1):
            layer = nn.Linear(dims[i], dims[i + 1])
            # Apply initialization
            if init == 'kaiming':
                nn.init.kaiming_normal_(layer.weight, nonlinearity='relu')
            elif init == 'xavier':
                nn.init.xavier_normal_(layer.weight)
            elif init == 'orthogonal':
                nn.init.orthogonal_(layer.weight, gain=2**0.5)
            elif init == 'zeros':
                nn.init.zeros_(layer.weight)  # pathological: breaks symmetry
            nn.init.zeros_(layer.bias)
            layers.append(layer)
            if i < len(dims) - 2:
                layers.append(nn.ReLU())
        self.net = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, d_in) -> (B, d_out)
        return self.net(x)

# ── Optimizer comparison ─────────────────────────────────────────

def compare_optimizers(
    train_loader,
    d_in: int = 784,
    d_out: int = 10,
    n_epochs: int = 20,
):
    """
    Train the same architecture with different optimizers and compare
    training curves.
    """
    optimizer_configs = {
        'SGD (lr=0.1)': lambda p: optim.SGD(p, lr=0.1),
        'SGD+Momentum (lr=0.1)': lambda p: optim.SGD(p, lr=0.1, momentum=0.9),
        'RMSProp (lr=1e-3)': lambda p: optim.RMSprop(p, lr=1e-3),
        'Adam (lr=1e-3)': lambda p: optim.Adam(p, lr=1e-3),
        'AdamW (lr=1e-3)': lambda p: optim.AdamW(p, lr=1e-3, weight_decay=0.01),
    }

    results = {}
    for name, opt_fn in optimizer_configs.items():
        print(f"Training with {name}...")
        model = ExperimentMLP(d_in=d_in, d_out=d_out)
        optimizer = opt_fn(model.parameters())
        loss_fn = nn.CrossEntropyLoss()

        losses = []
        for epoch in range(n_epochs):
            epoch_loss = 0.0
            n_batches = 0
            for batch_x, batch_y in train_loader:
                # batch_x: (B, d_in), batch_y: (B,)
                logits = model(batch_x)          # (B, d_out)
                loss = loss_fn(logits, batch_y)  # scalar
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
                n_batches += 1
            losses.append(epoch_loss / n_batches)
        results[name] = losses

    # Plot
    fig, ax = plt.subplots(figsize=(10, 5))
    for name, losses in results.items():
        ax.plot(losses, label=name)
    ax.set_xlabel('Epoch')
    ax.set_ylabel('Training Loss')
    ax.set_title('Optimizer Comparison')
    ax.legend()
    ax.set_yscale('log')
    plt.tight_layout()
    plt.savefig('optimizer_comparison.png', dpi=150)
    plt.show()
    return results

# ── Learning rate schedule visualization ─────────────────────────

def visualize_lr_schedules(total_steps: int = 10000, lr_max: float = 1e-3):
    """
    Compare different learning rate schedules.
    """
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))

    # 1. Step decay
    model = nn.Linear(10, 10)
    opt = optim.SGD(model.parameters(), lr=lr_max)
    sched = optim.lr_scheduler.StepLR(opt, step_size=2500, gamma=0.1)
    lrs = []
    for _ in range(total_steps):
        lrs.append(opt.param_groups[0]['lr'])
        opt.step()
        sched.step()
    axes[0, 0].plot(lrs)
    axes[0, 0].set_title('Step Decay')

    # 2. Cosine annealing
    model = nn.Linear(10, 10)
    opt = optim.SGD(model.parameters(), lr=lr_max)
    sched = CosineAnnealingLR(opt, T_max=total_steps)
    lrs = []
    for _ in range(total_steps):
        lrs.append(opt.param_groups[0]['lr'])
        opt.step()
        sched.step()
    axes[0, 1].plot(lrs)
    axes[0, 1].set_title('Cosine Annealing')

    # 3. Cosine with warm restarts
    model = nn.Linear(10, 10)
    opt = optim.SGD(model.parameters(), lr=lr_max)
    sched = optim.lr_scheduler.CosineAnnealingWarmRestarts(
        opt, T_0=2500, T_mult=2
    )
    lrs = []
    for step in range(total_steps):
        lrs.append(opt.param_groups[0]['lr'])
        opt.step()
        sched.step(step)
    axes[1, 0].plot(lrs)
    axes[1, 0].set_title('Cosine with Warm Restarts')

    # 4. One-cycle
    model = nn.Linear(10, 10)
    opt = optim.SGD(model.parameters(), lr=lr_max)
    sched = OneCycleLR(opt, max_lr=lr_max, total_steps=total_steps)
    lrs = []
    for _ in range(total_steps):
        lrs.append(opt.param_groups[0]['lr'])
        opt.step()
        sched.step()
    axes[1, 1].plot(lrs)
    axes[1, 1].set_title('One-Cycle Policy')

    for ax in axes.flat:
        ax.set_xlabel('Step')
        ax.set_ylabel('Learning Rate')
    plt.tight_layout()
    plt.savefig('lr_schedules.png', dpi=150)
    plt.show()

# ── Initialization comparison ────────────────────────────────────

def compare_initializations(train_loader, n_epochs: int = 20):
    """
    Train deep networks with different initializations
    and compare training dynamics.
    """
    inits = ['kaiming', 'xavier', 'orthogonal']
    depths = [4, 8, 16]

    fig, axes = plt.subplots(1, len(depths), figsize=(5 * len(depths), 4))
    for ax, depth in zip(axes, depths):
        for init in inits:
            model = ExperimentMLP(n_layers=depth, init=init)
            optimizer = optim.Adam(model.parameters(), lr=1e-3)
            loss_fn = nn.CrossEntropyLoss()

            losses = []
            for epoch in range(n_epochs):
                epoch_loss = 0.0
                n_batches = 0
                for bx, by in train_loader:
                    logits = model(bx)
                    loss = loss_fn(logits, by)
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()
                    epoch_loss += loss.item()
                    n_batches += 1
                losses.append(epoch_loss / n_batches)
            ax.plot(losses, label=init)

        ax.set_title(f'Depth = {depth}')
        ax.set_xlabel('Epoch')
        ax.set_ylabel('Loss')
        ax.legend()
        ax.set_yscale('log')

    plt.tight_layout()
    plt.savefig('init_comparison.png', dpi=150)
    plt.show()

# ── Demo ─────────────────────────────────────────────────────────

if __name__ == '__main__':
    from torch.utils.data import DataLoader, TensorDataset

    # Synthetic data
    X = torch.randn(2000, 784)
    Y = torch.randint(0, 10, (2000,))
    loader = DataLoader(TensorDataset(X, Y), batch_size=128, shuffle=True)

    print("=== Optimizer Comparison ===")
    compare_optimizers(loader)

    print("\n=== Learning Rate Schedules ===")
    visualize_lr_schedules()

    print("\n=== Initialization Comparison ===")
    compare_initializations(loader)
```

---

## 9. Experimental Intuition

### 9.1 Optimizer Selection Guidelines

| Scenario | Recommended Optimizer | Rationale |
|---|---|---|
| Default / exploration | AdamW | Robust, fast convergence, good generalization with weight decay |
| Computer vision (CNNs) | SGD + Momentum + cosine LR | Often better final accuracy than Adam for image tasks |
| NLP / Transformers | AdamW | Standard; used in BERT, GPT, etc. |
| Fine-tuning pretrained | AdamW with low LR | Prevents catastrophic forgetting |
| Very deep networks | Adam/AdamW with warmup | Warmup stabilizes early training |

### 9.2 Common Failures and Fixes

1. **Loss diverges:** Learning rate too high. Reduce by 10x. Add warmup.
2. **Loss plateaus early:** Learning rate too low, or bad initialization. Increase LR or use better init.
3. **Training loss drops but validation loss rises:** Overfitting. Add regularization (next lecture).
4. **Loss oscillates wildly:** Batch size too small or learning rate too high. Increase batch size or reduce LR.
5. **NaN loss:** Numerical instability. Check for log(0), division by zero, exploding gradients. Use gradient clipping.

---

## 10. Connections and Extensions

### 10.1 Links Within This Module

- **Lecture 01b:** Provides the gradients that optimizers consume.
- **Lecture 01d:** Regularization techniques interact with optimization (weight decay, dropout noise, BN smoothing).

### 10.2 Links to Future Modules

- **Module 03 (RNNs):** Gradient clipping is essential due to exploding gradients in long sequences.
- **Module 05 (Transformers):** Learning rate warmup is critical; AdamW with cosine schedule is the standard recipe.
- **Module 07 (Scaling Laws):** Batch size and learning rate interact with model size in predictable ways.

---

## 11. Seminal Paper Reading List

### Required Reading

1. **Kingma, D. P. & Ba, J.** (2015). "Adam: A method for stochastic optimization." *ICLR 2015*.
   - The Adam optimizer. One of the most cited papers in deep learning.

2. **Loshchilov, I. & Hutter, F.** (2019). "Decoupled weight decay regularization." *ICLR 2019*.
   - AdamW: fixes the interaction between Adam and weight decay. Critical for modern practice.

### Recommended Reading

3. **He, K., Zhang, X., Ren, S., & Sun, J.** (2015). "Delving deep into rectifiers: Surpassing human-level performance on ImageNet classification." *ICCV 2015*.
   - Kaiming initialization. Also introduces PReLU.

4. **Glorot, X. & Bengio, Y.** (2010). "Understanding the difficulty of training deep feedforward neural networks." *AISTATS 2010*.
   - Xavier initialization. Foundational analysis of signal propagation.

5. **Dauphin, Y., Pascanu, R., Gulcehre, C., Cho, K., Ganguli, S., & Bengio, Y.** (2014). "Identifying and attacking the saddle point problem in high-dimensional non-convex optimization." *NeurIPS 2014*.
   - Saddle points dominate the loss landscape.

### Supplementary

6. **Goyal, P., et al.** (2017). "Accurate, large minibatch SGD: Training ImageNet in 1 hour." *arXiv:1706.02677*.
   - Linear scaling rule and warmup for large-batch training.

7. **Smith, L. N. & Topin, N.** (2019). "Super-convergence: Very fast training of neural networks using large learning rates." *AISTATS 2019*.
   - One-cycle learning rate policy.

8. **McCandlish, S., Kaplan, J., Amodei, D., & Team, O. D.** (2018). "An empirical model of large-batch training." *arXiv:1812.06162*.
   - Critical batch size theory.

---

## 12. Exercises

### Theory Exercises

**Exercise 3.1.** Derive the Adam update rule from scratch.

- (a) Show that without bias correction, $\mathbb{E}[m_t] = (1 - \beta_1^t) \mathbb{E}[g_t]$.
- (b) Show that the bias-corrected estimate $\hat{m}_t = m_t / (1 - \beta_1^t)$ is unbiased.
- (c) Derive the analogous result for $v_t$.

**Exercise 3.2.** Prove that for a quadratic loss $\mathcal{L}(\theta) = \frac{1}{2}\theta^\top A \theta$ with $A \succ 0$:

- (a) Gradient descent with step size $\eta = 2/(\lambda_{\max} + \lambda_{\min})$ converges as $\left(\frac{\kappa - 1}{\kappa + 1}\right)^t$ where $\kappa = \lambda_{\max}/\lambda_{\min}$.
- (b) Heavy-ball momentum with optimal parameters achieves $\left(\frac{\sqrt{\kappa} - 1}{\sqrt{\kappa} + 1}\right)^t$ — a quadratic improvement in the condition number.

**Exercise 3.3.** Derive the Xavier initialization variance formula for a layer with **tanh** activation, accounting for the fact that $\text{Var}[\tanh(z)] \approx (1 - \frac{2}{3}\text{Var}[z]) \cdot \text{Var}[z]$ for small $\text{Var}[z]$.

**Exercise 3.4.** (Critical batch size) Consider SGD on the loss $\mathcal{L}(\theta) = \frac{1}{N}\sum_i \ell_i(\theta)$ with batch size $B$.

- (a) Show that the update direction variance scales as $\text{Var}[g] = \sigma^2/B$.
- (b) Argue that the "signal-to-noise ratio" of the gradient is $\|\nabla \mathcal{L}\|^2 B / \sigma^2$.
- (c) Define the critical batch size as the $B$ where SNR $= 1$, and derive $B_{\text{crit}} = \sigma^2 / \|\nabla \mathcal{L}\|^2$.

### Implementation Exercises

**Exercise 3.5.** Implement Adam from scratch (without using `torch.optim.Adam`):

- Maintain running estimates of $m_t$ and $v_t$ as Python dictionaries keyed by parameter id.
- Apply bias correction.
- Verify that your implementation matches `torch.optim.Adam` on a simple problem (should get identical parameter values).

**Exercise 3.6.** Implement cosine annealing with warm restarts from scratch. Plot the learning rate schedule for 100 epochs with initial period $T_0 = 10$ and $T_{\text{mult}} = 2$.

**Exercise 3.7.** Run the initialization comparison experiment from Section 8 on MNIST:

- Compare Kaiming, Xavier, orthogonal, and zero initialization for depths 4, 8, 16, 32.
- Plot: (a) training loss curves, (b) gradient norm per layer at initialization, (c) activation variance per layer at initialization.
- At what depth does zero initialization completely fail? Why?

---

*Next: Lecture 01d — Regularization and Generalization*
