# Lecture 00c: Optimization and Convexity for Deep Learning

> **Module 00 — Mathematical Foundations (Pre-Work)**
> Estimated study time: 6–8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define convex sets and convex functions, and verify convexity using first-order and second-order conditions.
2. Prove the convergence rate of gradient descent on $L$-smooth convex functions ($\mathcal{O}(1/T)$ for function value).
3. Analyze SGD convergence and explain the role of variance reduction.
4. Derive the momentum update rules (Polyak heavy ball and Nesterov accelerated gradient) and the Adam optimizer.
5. Explain why deep learning optimization works despite non-convexity, including the role of saddle points, overparameterization, and the loss landscape.
6. Implement and compare GD, SGD, momentum, and Adam on convex and non-convex objectives.

---

## 1. Motivation

Training a neural network means solving:

$$\min_{\theta \in \mathbb{R}^p} \mathcal{L}(\theta) = \frac{1}{N}\sum_{i=1}^N \ell\bigl(f_\theta(\mathbf{x}_i),\, y_i\bigr)$$

where $\theta$ contains all learnable parameters (potentially billions), $f_\theta$ is the network, and $\ell$ is the per-sample loss. This is a high-dimensional, non-convex optimization problem.

Despite non-convexity, first-order methods (gradient descent and its variants) work remarkably well in practice. Understanding *why* requires:
- Convex optimization theory as the foundation and source of intuition.
- Analysis of what changes in the non-convex setting.
- Knowledge of the specific optimizers used in practice (SGD + momentum, Adam, AdamW).

---

## 2. Core Theory: Convex Optimization

### 2.1 Convex Sets

**Definition.** A set $\mathcal{C} \subseteq \mathbb{R}^n$ is *convex* if for all $\mathbf{x}, \mathbf{y} \in \mathcal{C}$ and $t \in [0, 1]$:

$$t\,\mathbf{x} + (1 - t)\,\mathbf{y} \in \mathcal{C}$$

Geometrically: the line segment between any two points in $\mathcal{C}$ lies entirely within $\mathcal{C}$.

**Examples:**
- Hyperplanes $\{\mathbf{x} : \mathbf{a}^\top \mathbf{x} = b\}$ and halfspaces $\{\mathbf{x} : \mathbf{a}^\top \mathbf{x} \le b\}$.
- Balls $\{\mathbf{x} : \|\mathbf{x} - \mathbf{c}\| \le r\}$ in any norm.
- The positive semidefinite cone $\{X \in \mathbb{R}^{n \times n} : X \succeq 0\}$.
- The probability simplex $\Delta^K$.
- Intersections of convex sets (but not unions in general).

### 2.2 Convex Functions

**Definition.** A function $f : \mathcal{C} \to \mathbb{R}$ (where $\mathcal{C}$ is convex) is *convex* if for all $\mathbf{x}, \mathbf{y} \in \mathcal{C}$ and $t \in [0, 1]$:

$$f\bigl(t\,\mathbf{x} + (1-t)\,\mathbf{y}\bigr) \le t\,f(\mathbf{x}) + (1-t)\,f(\mathbf{y})$$

$f$ is *strictly convex* if the inequality is strict for $t \in (0, 1)$ and $\mathbf{x} \ne \mathbf{y}$.

$f$ is *strongly convex* with parameter $m > 0$ if $f(\mathbf{x}) - \frac{m}{2}\|\mathbf{x}\|^2$ is convex, equivalently:

$$f\bigl(t\,\mathbf{x} + (1-t)\,\mathbf{y}\bigr) \le t\,f(\mathbf{x}) + (1-t)\,f(\mathbf{y}) - \frac{m}{2}\,t(1-t)\,\|\mathbf{x} - \mathbf{y}\|^2$$

**Examples relevant to deep learning:**
- Convex: linear functions, norms, $\|\mathbf{x}\|^2$, $\log(1 + e^{-x})$ (logistic loss), cross-entropy loss (as a function of logits for fixed labels).
- Not convex: the loss landscape $\mathcal{L}(\theta)$ of a neural network with respect to $\theta$ (in general).

### 2.3 First-Order Condition for Convexity

**Theorem.** Let $f : \mathbb{R}^n \to \mathbb{R}$ be differentiable. Then $f$ is convex if and only if:

$$f(\mathbf{y}) \ge f(\mathbf{x}) + \nabla f(\mathbf{x})^\top (\mathbf{y} - \mathbf{x}) \quad \text{for all } \mathbf{x}, \mathbf{y}$$

*Proof ($\Rightarrow$).* By convexity, for $t \in (0, 1)$:

$$f(\mathbf{x} + t(\mathbf{y} - \mathbf{x})) \le f(\mathbf{x}) + t\bigl(f(\mathbf{y}) - f(\mathbf{x})\bigr)$$

Rearranging: $\frac{f(\mathbf{x} + t(\mathbf{y} - \mathbf{x})) - f(\mathbf{x})}{t} \le f(\mathbf{y}) - f(\mathbf{x})$.

Taking $t \to 0^+$: $\nabla f(\mathbf{x})^\top (\mathbf{y} - \mathbf{x}) \le f(\mathbf{y}) - f(\mathbf{x})$.

*Proof ($\Leftarrow$).* Let $\mathbf{z} = t\mathbf{x} + (1-t)\mathbf{y}$. Applying the first-order condition twice:

$$f(\mathbf{x}) \ge f(\mathbf{z}) + \nabla f(\mathbf{z})^\top(\mathbf{x} - \mathbf{z})$$
$$f(\mathbf{y}) \ge f(\mathbf{z}) + \nabla f(\mathbf{z})^\top(\mathbf{y} - \mathbf{z})$$

Multiplying the first by $t$, the second by $(1-t)$, and adding:

$$t\,f(\mathbf{x}) + (1-t)\,f(\mathbf{y}) \ge f(\mathbf{z}) + \nabla f(\mathbf{z})^\top\bigl(t\mathbf{x} + (1-t)\mathbf{y} - \mathbf{z}\bigr) = f(\mathbf{z})$$

since $t\mathbf{x} + (1-t)\mathbf{y} - \mathbf{z} = \mathbf{0}$. $\square$

**Corollary.** For convex $f$, any point $\mathbf{x}^*$ with $\nabla f(\mathbf{x}^*) = \mathbf{0}$ is a *global* minimizer. (Set $\mathbf{x} = \mathbf{x}^*$ in the first-order condition.)

### 2.4 Second-Order Condition for Convexity

**Theorem.** Let $f : \mathbb{R}^n \to \mathbb{R}$ be twice differentiable. Then $f$ is convex if and only if:

$$\nabla^2 f(\mathbf{x}) \succeq 0 \quad \text{for all } \mathbf{x}$$

(i.e., the Hessian is positive semidefinite everywhere). $f$ is strongly convex with parameter $m$ iff $\nabla^2 f(\mathbf{x}) \succeq mI$ for all $\mathbf{x}$.

*Proof ($\Rightarrow$).* By the first-order condition, for all $\mathbf{y}$:

$$f(\mathbf{y}) \ge f(\mathbf{x}) + \nabla f(\mathbf{x})^\top(\mathbf{y} - \mathbf{x})$$

By Taylor expansion with $\mathbf{y} = \mathbf{x} + t\mathbf{v}$ for small $t > 0$:

$$f(\mathbf{x} + t\mathbf{v}) = f(\mathbf{x}) + t\,\nabla f(\mathbf{x})^\top \mathbf{v} + \frac{t^2}{2}\,\mathbf{v}^\top \nabla^2 f(\mathbf{x})\,\mathbf{v} + \mathcal{O}(t^3)$$

Substituting into the first-order condition:

$$\frac{t^2}{2}\,\mathbf{v}^\top \nabla^2 f(\mathbf{x})\,\mathbf{v} + \mathcal{O}(t^3) \ge 0$$

Dividing by $t^2/2$ and taking $t \to 0$: $\mathbf{v}^\top \nabla^2 f(\mathbf{x})\,\mathbf{v} \ge 0$ for all $\mathbf{v}$.

*Proof ($\Leftarrow$).* By Taylor's theorem with integral remainder:

$$f(\mathbf{y}) = f(\mathbf{x}) + \nabla f(\mathbf{x})^\top(\mathbf{y}-\mathbf{x}) + \int_0^1 (1-t)\,(\mathbf{y}-\mathbf{x})^\top \nabla^2 f(\mathbf{x}+t(\mathbf{y}-\mathbf{x}))\,(\mathbf{y}-\mathbf{x})\,dt$$

Since $\nabla^2 f \succeq 0$, the integral is $\ge 0$, giving the first-order condition. $\square$

### 2.5 Smoothness

**Definition.** A differentiable function $f$ is *$L$-smooth* if:

$$\|\nabla f(\mathbf{x}) - \nabla f(\mathbf{y})\| \le L\,\|\mathbf{x} - \mathbf{y}\| \quad \text{for all } \mathbf{x}, \mathbf{y}$$

Equivalently (for twice-differentiable functions): $\nabla^2 f(\mathbf{x}) \preceq LI$ for all $\mathbf{x}$.

**Key consequence (quadratic upper bound).** If $f$ is $L$-smooth:

$$f(\mathbf{y}) \le f(\mathbf{x}) + \nabla f(\mathbf{x})^\top(\mathbf{y} - \mathbf{x}) + \frac{L}{2}\|\mathbf{y} - \mathbf{x}\|^2$$

*Proof.* By the fundamental theorem of calculus:

$$f(\mathbf{y}) - f(\mathbf{x}) = \int_0^1 \nabla f(\mathbf{x} + t(\mathbf{y}-\mathbf{x}))^\top (\mathbf{y}-\mathbf{x})\,dt$$

$$= \nabla f(\mathbf{x})^\top(\mathbf{y}-\mathbf{x}) + \int_0^1 \bigl[\nabla f(\mathbf{x}+t(\mathbf{y}-\mathbf{x})) - \nabla f(\mathbf{x})\bigr]^\top (\mathbf{y}-\mathbf{x})\,dt$$

By Cauchy-Schwarz and $L$-smoothness:

$$\le \nabla f(\mathbf{x})^\top(\mathbf{y}-\mathbf{x}) + \int_0^1 L\,t\,\|\mathbf{y}-\mathbf{x}\|^2\,dt = \nabla f(\mathbf{x})^\top(\mathbf{y}-\mathbf{x}) + \frac{L}{2}\|\mathbf{y}-\mathbf{x}\|^2 \quad \square$$

### 2.6 Condition Number

For a strongly convex, $L$-smooth function with strong convexity parameter $m$, the *condition number* is:

$$\kappa = L / m$$

The condition number measures how "elongated" the sublevel sets of $f$ are. For quadratic $f(\mathbf{x}) = \frac{1}{2}\mathbf{x}^\top A\mathbf{x}$, we have $\kappa = \lambda_{\max}(A) / \lambda_{\min}(A)$.

A large $\kappa$ means:
- Gradient descent converges slowly (the gradient points away from the minimizer in ill-conditioned directions).
- Preconditioning (e.g., Adam's adaptive learning rates) can dramatically improve convergence.

---

## 3. Gradient Descent and Convergence

### 3.1 Gradient Descent Algorithm

For minimizing $f : \mathbb{R}^n \to \mathbb{R}$:

```
GRADIENT-DESCENT(f, x₀, η, T):
  x ← x₀
  for t = 1 to T:
    x ← x - η ∇f(x)        # O(n) for the update, O(?) for gradient computation
  return x
```

The learning rate $\eta > 0$ controls the step size. Too large: divergence. Too small: slow convergence.

### 3.2 Convergence Proof for $L$-Smooth Convex Functions

**Theorem.** Let $f$ be convex and $L$-smooth, and let $\mathbf{x}^* = \arg\min f$. With step size $\eta = 1/L$, gradient descent satisfies:

$$f(\mathbf{x}_T) - f(\mathbf{x}^*) \le \frac{L\,\|\mathbf{x}_0 - \mathbf{x}^*\|^2}{2T}$$

This is a convergence rate of $\mathcal{O}(1/T)$.

*Proof.* **Step 1: Sufficient decrease.** By the quadratic upper bound (Section 2.5), setting $\mathbf{y} = \mathbf{x} - \frac{1}{L}\nabla f(\mathbf{x})$ (one GD step with $\eta = 1/L$):

$$f(\mathbf{x}_{t+1}) \le f(\mathbf{x}_t) + \nabla f(\mathbf{x}_t)^\top(\mathbf{x}_{t+1} - \mathbf{x}_t) + \frac{L}{2}\|\mathbf{x}_{t+1} - \mathbf{x}_t\|^2$$

Since $\mathbf{x}_{t+1} - \mathbf{x}_t = -\frac{1}{L}\nabla f(\mathbf{x}_t)$:

$$f(\mathbf{x}_{t+1}) \le f(\mathbf{x}_t) - \frac{1}{L}\|\nabla f(\mathbf{x}_t)\|^2 + \frac{L}{2} \cdot \frac{1}{L^2}\|\nabla f(\mathbf{x}_t)\|^2 = f(\mathbf{x}_t) - \frac{1}{2L}\|\nabla f(\mathbf{x}_t)\|^2$$

**Step 2: Use convexity.** By the first-order condition:

$$f(\mathbf{x}^*) \ge f(\mathbf{x}_t) + \nabla f(\mathbf{x}_t)^\top(\mathbf{x}^* - \mathbf{x}_t)$$

Rearranging: $f(\mathbf{x}_t) - f(\mathbf{x}^*) \le \nabla f(\mathbf{x}_t)^\top(\mathbf{x}_t - \mathbf{x}^*) \le \|\nabla f(\mathbf{x}_t)\| \cdot \|\mathbf{x}_t - \mathbf{x}^*\|$ by Cauchy-Schwarz.

**Step 3: Track distance to optimum.**

$$\|\mathbf{x}_{t+1} - \mathbf{x}^*\|^2 = \|\mathbf{x}_t - \eta\nabla f(\mathbf{x}_t) - \mathbf{x}^*\|^2$$
$$= \|\mathbf{x}_t - \mathbf{x}^*\|^2 - 2\eta\,\nabla f(\mathbf{x}_t)^\top(\mathbf{x}_t - \mathbf{x}^*) + \eta^2\|\nabla f(\mathbf{x}_t)\|^2$$

Using the first-order condition: $\nabla f(\mathbf{x}_t)^\top(\mathbf{x}_t - \mathbf{x}^*) \ge f(\mathbf{x}_t) - f(\mathbf{x}^*)$. With $\eta = 1/L$:

$$\|\mathbf{x}_{t+1} - \mathbf{x}^*\|^2 \le \|\mathbf{x}_t - \mathbf{x}^*\|^2 - \frac{2}{L}(f(\mathbf{x}_t) - f(\mathbf{x}^*)) + \frac{1}{L^2}\|\nabla f(\mathbf{x}_t)\|^2$$

From Step 1: $\|\nabla f(\mathbf{x}_t)\|^2 \le 2L(f(\mathbf{x}_t) - f(\mathbf{x}_{t+1}))$. Substituting and using $f(\mathbf{x}_{t+1}) \le f(\mathbf{x}_t)$:

$$\|\mathbf{x}_{t+1} - \mathbf{x}^*\|^2 \le \|\mathbf{x}_t - \mathbf{x}^*\|^2 - \frac{2}{L}(f(\mathbf{x}_t) - f(\mathbf{x}^*)) + \frac{2}{L}(f(\mathbf{x}_t) - f(\mathbf{x}_{t+1}))$$

**Step 4: Telescope.** Let $\delta_t = f(\mathbf{x}_t) - f(\mathbf{x}^*)$. From Step 1:

$$\delta_{t+1} \le \delta_t - \frac{1}{2L}\|\nabla f(\mathbf{x}_t)\|^2$$

Since $\delta_t$ is non-increasing and $\|\nabla f(\mathbf{x}_t)\|^2 \ge 2L(\delta_t - \delta_{t+1})$, summing the sufficient decrease over $t = 0, \dots, T-1$:

$$\sum_{t=0}^{T-1}\frac{1}{2L}\|\nabla f(\mathbf{x}_t)\|^2 \le \delta_0 - \delta_T \le \delta_0$$

Meanwhile, from the distance tracking (telescoping the sum):

$$\frac{2}{L}\sum_{t=0}^{T-1}\delta_t \le \|\mathbf{x}_0 - \mathbf{x}^*\|^2$$

Since $\delta_t$ is non-increasing, $T \cdot \delta_{T-1} \le \sum_{t=0}^{T-1}\delta_t$, so actually we can use the tighter per-step analysis. Combining the sufficient decrease and convexity directly:

From Step 1: $\delta_{t+1} \le \delta_t - \frac{1}{2L}\|\nabla f(\mathbf{x}_t)\|^2$. From the first-order condition: $\delta_t \le \|\nabla f(\mathbf{x}_t)\|\|\mathbf{x}_t - \mathbf{x}^*\|$. These together with the distance recursion yield after telescoping:

$$T \cdot \delta_T \le \sum_{t=0}^{T-1} \delta_t \le \frac{L}{2}\|\mathbf{x}_0 - \mathbf{x}^*\|^2$$

Therefore: $f(\mathbf{x}_T) - f(\mathbf{x}^*) \le \frac{L\|\mathbf{x}_0 - \mathbf{x}^*\|^2}{2T}$. $\square$

**Convergence rate for strongly convex functions.** If additionally $f$ is $m$-strongly convex, then with $\eta = 1/L$:

$$f(\mathbf{x}_T) - f(\mathbf{x}^*) \le \left(1 - \frac{m}{L}\right)^T \bigl(f(\mathbf{x}_0) - f(\mathbf{x}^*)\bigr)$$

This is *linear* (exponential) convergence with rate $1 - 1/\kappa$. To reach $\epsilon$-accuracy, we need $T = \mathcal{O}(\kappa \log(1/\epsilon))$ iterations.

### 3.3 Stochastic Gradient Descent (SGD)

In deep learning, computing the full gradient $\nabla \mathcal{L}(\theta) = \frac{1}{N}\sum_{i=1}^N \nabla \ell_i(\theta)$ is expensive ($\mathcal{O}(N)$ per step). Instead, SGD uses a mini-batch estimate:

$$\mathbf{g}_t = \frac{1}{B}\sum_{i \in \mathcal{B}_t} \nabla \ell_i(\theta_t)$$

where $\mathcal{B}_t$ is a random mini-batch of size $B$, and updates $\theta_{t+1} = \theta_t - \eta_t \mathbf{g}_t$.

**Properties of the stochastic gradient:**
- Unbiased: $\mathbb{E}[\mathbf{g}_t] = \nabla \mathcal{L}(\theta_t)$.
- Variance: $\mathbb{E}[\|\mathbf{g}_t - \nabla \mathcal{L}(\theta_t)\|^2] = \sigma^2 / B$ (approximately), where $\sigma^2$ is the per-sample gradient variance.

**Theorem (SGD convergence for smooth convex functions).** Under standard assumptions (bounded variance $\sigma^2$, $L$-smoothness, convexity), with step size $\eta_t = \eta / \sqrt{T}$:

$$\mathbb{E}[f(\bar{\mathbf{x}}_T)] - f(\mathbf{x}^*) \le \mathcal{O}\!\left(\frac{\|\mathbf{x}_0 - \mathbf{x}^*\|^2 + \sigma^2/B}{\sqrt{T}}\right)$$

where $\bar{\mathbf{x}}_T = \frac{1}{T}\sum_{t=1}^T \mathbf{x}_t$ is the iterate average. The rate is $\mathcal{O}(1/\sqrt{T})$ — slower than GD's $\mathcal{O}(1/T)$, but each iteration is $N/B$ times cheaper.

**The SGD tradeoff:** Per-epoch cost comparison:
- GD: 1 epoch = 1 gradient computation over all $N$ samples = 1 step.
- SGD with batch size $B$: 1 epoch = $N/B$ steps, each using $B$ samples.

Per-epoch, SGD makes more progress (many small steps > one large step), but the noise prevents convergence below a "noise floor" without decreasing the learning rate.

### 3.4 Variance Reduction

The $\mathcal{O}(1/\sqrt{T})$ rate of SGD is due to gradient noise. *Variance reduction* methods achieve the $\mathcal{O}(1/T)$ rate of full GD with SGD's per-iteration cost:

**SVRG (Stochastic Variance-Reduced Gradient):** Periodically compute the full gradient $\tilde{\mathbf{g}} = \nabla \mathcal{L}(\tilde{\theta})$, then use corrected stochastic gradients:

$$\mathbf{g}_t = \nabla \ell_i(\theta_t) - \nabla \ell_i(\tilde{\theta}) + \tilde{\mathbf{g}}$$

This has $\mathbb{E}[\mathbf{g}_t] = \nabla \mathcal{L}(\theta_t)$ (unbiased) but variance $\to 0$ as $\theta_t \to \tilde{\theta}$.

In practice, variance reduction is rarely used in deep learning (the implicit regularization of SGD noise is beneficial), but the theory provides insight into why batch size affects training dynamics.

---

## 4. Momentum Methods

### 4.1 Polyak Heavy Ball Momentum

Motivated by physics: add a "momentum" term that keeps the iterate moving in the previous direction.

$$\mathbf{v}_{t+1} = \beta\,\mathbf{v}_t - \eta\,\nabla f(\mathbf{x}_t) \quad (\text{velocity update})$$
$$\mathbf{x}_{t+1} = \mathbf{x}_t + \mathbf{v}_{t+1} \quad (\text{position update})$$

Equivalently (substituting):

$$\mathbf{x}_{t+1} = \mathbf{x}_t - \eta\,\nabla f(\mathbf{x}_t) + \beta\,(\mathbf{x}_t - \mathbf{x}_{t-1})$$

The parameter $\beta \in [0, 1)$ is the momentum coefficient (typically $\beta = 0.9$).

**Intuition:** On a quadratic $f(\mathbf{x}) = \frac{1}{2}\mathbf{x}^\top A\mathbf{x}$, the eigenvalues of $A$ represent different curvatures. Momentum smooths out oscillations in high-curvature directions while accumulating speed in low-curvature directions. For the optimal $\beta$, the convergence rate improves from $(\kappa - 1)/(\kappa + 1)$ to $(\sqrt{\kappa} - 1)/(\sqrt{\kappa} + 1)$.

### 4.2 Nesterov Accelerated Gradient (NAG)

Nesterov's key insight: compute the gradient at the *lookahead* point $\mathbf{x}_t + \beta\mathbf{v}_t$ rather than at $\mathbf{x}_t$.

$$\mathbf{v}_{t+1} = \beta\,\mathbf{v}_t - \eta\,\nabla f(\mathbf{x}_t + \beta\,\mathbf{v}_t)$$
$$\mathbf{x}_{t+1} = \mathbf{x}_t + \mathbf{v}_{t+1}$$

**Theoretical guarantee.** For $L$-smooth convex functions, Nesterov's method achieves:

$$f(\mathbf{x}_T) - f(\mathbf{x}^*) \le \mathcal{O}\!\left(\frac{L\|\mathbf{x}_0 - \mathbf{x}^*\|^2}{T^2}\right)$$

This is an $\mathcal{O}(1/T^2)$ rate — a quadratic speedup over GD's $\mathcal{O}(1/T)$. For strongly convex functions, the rate improves to $(1 - 1/\sqrt{\kappa})^T$, matching the lower bound (optimal among first-order methods).

### 4.3 PyTorch Momentum

PyTorch implements momentum slightly differently from the classical formulation. With `torch.optim.SGD(params, lr=η, momentum=β)`:

$$\mathbf{b}_{t+1} = \beta\,\mathbf{b}_t + \nabla f(\theta_t) \quad (\text{buffer accumulation})$$
$$\theta_{t+1} = \theta_t - \eta\,\mathbf{b}_{t+1}$$

This is equivalent to Polyak momentum with a rescaled learning rate. With `nesterov=True`, PyTorch uses:

$$\theta_{t+1} = \theta_t - \eta\,(\nabla f(\theta_t) + \beta\,\mathbf{b}_{t+1})$$

---

## 5. Adam and Adaptive Methods

### 5.1 Adam Derivation

Adam (Adaptive Moment Estimation) maintains per-parameter running estimates of the first and second moments of the gradient.

**First moment estimate (momentum):**

$$\mathbf{m}_t = \beta_1\,\mathbf{m}_{t-1} + (1 - \beta_1)\,\mathbf{g}_t$$

**Second moment estimate (RMSprop-like):**

$$\mathbf{v}_t = \beta_2\,\mathbf{v}_{t-1} + (1 - \beta_2)\,\mathbf{g}_t^2$$

where $\mathbf{g}_t^2$ denotes element-wise squaring.

**Bias correction.** Since $\mathbf{m}_0 = \mathbf{v}_0 = \mathbf{0}$, the estimates are biased toward zero, especially in early iterations. The bias-corrected estimates are:

$$\hat{\mathbf{m}}_t = \frac{\mathbf{m}_t}{1 - \beta_1^t}, \quad \hat{\mathbf{v}}_t = \frac{\mathbf{v}_t}{1 - \beta_2^t}$$

*Derivation of bias correction:* Expanding the recursion for $\mathbf{m}_t$:

$$\mathbf{m}_t = (1-\beta_1)\sum_{i=1}^t \beta_1^{t-i}\,\mathbf{g}_i$$

Taking expectation (assuming stationary gradient distribution $\mathbb{E}[\mathbf{g}_i] = \mathbf{g}$):

$$\mathbb{E}[\mathbf{m}_t] = (1-\beta_1)\,\mathbf{g}\sum_{i=1}^t \beta_1^{t-i} = \mathbf{g}\,(1 - \beta_1^t)$$

So $\mathbb{E}[\hat{\mathbf{m}}_t] = \mathbf{g}$ — unbiased. Similarly for $\hat{\mathbf{v}}_t$.

**Update rule:**

$$\theta_{t+1} = \theta_t - \eta \cdot \frac{\hat{\mathbf{m}}_t}{\sqrt{\hat{\mathbf{v}}_t} + \epsilon}$$

where $\epsilon \approx 10^{-8}$ prevents division by zero, and division is element-wise.

**Default hyperparameters** (Kingma & Ba, 2015): $\beta_1 = 0.9$, $\beta_2 = 0.999$, $\eta = 10^{-3}$, $\epsilon = 10^{-8}$.

**Intuition:** Adam provides per-parameter adaptive learning rates. Parameters with large gradients get smaller effective learning rates (due to large $\hat{v}_t$), and vice versa. This is a form of *diagonal preconditioning* — an approximation to the inverse Hessian.

### 5.2 AdamW (Decoupled Weight Decay)

Standard L2 regularization adds $\lambda\|\theta\|^2$ to the loss, which modifies the gradient to $\mathbf{g}_t + 2\lambda\theta_t$. For Adam, this means the weight decay signal gets divided by $\sqrt{\hat{\mathbf{v}}_t}$ — an unintended interaction.

AdamW (Loshchilov & Hutter, 2019) decouples the weight decay from the gradient:

$$\theta_{t+1} = \theta_t - \eta\left(\frac{\hat{\mathbf{m}}_t}{\sqrt{\hat{\mathbf{v}}_t} + \epsilon} + \lambda\,\theta_t\right)$$

This is the standard optimizer for training Transformers and large language models.

### 5.3 Learning Rate Schedules

The learning rate $\eta_t$ often varies during training:

**Warmup:** Linearly increase $\eta$ from $\eta_{\min}$ to $\eta_{\max}$ over the first $T_w$ steps:

$$\eta_t = \eta_{\min} + \frac{t}{T_w}(\eta_{\max} - \eta_{\min}), \quad t \le T_w$$

**Cosine decay** (Loshchilov & Hutter, 2017):

$$\eta_t = \eta_{\min} + \frac{1}{2}(\eta_{\max} - \eta_{\min})\left(1 + \cos\!\left(\frac{\pi\,(t - T_w)}{T - T_w}\right)\right), \quad t > T_w$$

**Linear decay:**

$$\eta_t = \eta_{\max}\left(1 - \frac{t}{T}\right)$$

**Warmup + cosine decay** is the standard schedule for training Transformers.

---

## 6. Non-Convex Optimization Landscape

### 6.1 Saddle Points

In high dimensions, critical points of the loss ($\nabla \mathcal{L} = \mathbf{0}$) are overwhelmingly saddle points rather than local minima. At a saddle point, the Hessian has both positive and negative eigenvalues.

**Argument (Baldi & Hornik, 1989; Dauphin et al., 2014).** For a random function in $n$ dimensions, a critical point is a local minimum only if all $n$ Hessian eigenvalues are positive. If each eigenvalue is positive with probability $p$, the probability of a local minimum is $p^n$, which vanishes exponentially with $n$.

For neural networks with millions of parameters, almost all critical points are saddle points. This is actually *good news*: SGD with momentum can escape saddle points (noise in the gradient provides perturbation in the negative curvature direction), so getting "stuck" at bad minima is not the primary concern.

### 6.2 Local Minima Quality

**Empirical observation:** In overparameterized networks (more parameters than data points), local minima tend to have similar loss values to the global minimum. This is explained by:

1. **Overparameterization:** With more parameters than constraints, the loss surface has many global minima (a connected manifold of solutions).
2. **Mode connectivity** (Garipov et al., 2018): different solutions found by SGD are connected by low-loss paths in parameter space.
3. **Linear mode connectivity** (Frankle et al., 2020): for networks trained from the same initialization, the linear path between two solutions stays at low loss.

### 6.3 Why Does DL Optimization Work?

Several complementary explanations:

1. **SGD noise helps exploration.** The stochastic gradient is biased toward flatter minima (which generalize better), because sharp minima have high gradient variance and SGD "bounces out" of them.

2. **Implicit regularization.** Gradient descent (without explicit regularization) converges to the minimum-norm solution for linear models. For neural networks, SGD has an implicit bias toward simpler functions.

3. **Loss landscape smoothness.** Batch normalization, skip connections (ResNet), and careful initialization all smooth the loss landscape, making optimization easier.

4. **Overparameterization and the NTK regime.** In the infinite-width limit, neural network training becomes a convex problem in function space (the Neural Tangent Kernel regime).

---

## 7. PyTorch Implementation

### 7.1 Gradient Descent from Scratch

```python
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def gradient_descent(f, grad_f, x0, lr, num_steps):
    """
    Full-batch gradient descent.

    Args:
        f: callable, objective function
        grad_f: callable, gradient of f
        x0: (n,) initial point
        lr: float, learning rate
        num_steps: int

    Returns:
        xs: (num_steps+1, n) trajectory
        fs: (num_steps+1,) function values
    """
    x = x0.clone()
    xs = [x.clone()]
    fs = [f(x).item()]

    for t in range(num_steps):
        g = grad_f(x)         # (n,) — gradient
        x = x - lr * g        # (n,) — GD step
        xs.append(x.clone())
        fs.append(f(x).item())

    return torch.stack(xs), torch.tensor(fs)  # (T+1, n), (T+1,)

# Example: minimize f(x) = 0.5 * x^T A x (quadratic)
A = torch.tensor([[10.0, 0.0],
                   [0.0,  1.0]])  # condition number = 10

f = lambda x: 0.5 * x @ A @ x
grad_f = lambda x: A @ x

x0 = torch.tensor([5.0, 5.0])
xs, fs = gradient_descent(f, grad_f, x0, lr=0.1, num_steps=50)
# lr = 1/L = 1/10 = 0.1

print(f"Initial f: {fs[0]:.4f}")
print(f"Final f:   {fs[-1]:.6f}")
```

### 7.2 SGD with Momentum and Adam from Scratch

```python
def sgd_momentum(grad_fn, x0, lr, beta, num_steps):
    """
    SGD with Polyak heavy-ball momentum.

    Args:
        grad_fn: callable returning stochastic gradient estimate
        x0: (n,) initial point
        lr: learning rate
        beta: momentum coefficient
        num_steps: int

    Returns:
        xs: list of iterates
    """
    x = x0.clone()
    v = torch.zeros_like(x)  # (n,) — velocity
    xs = [x.clone()]

    for t in range(num_steps):
        g = grad_fn(x)        # (n,) — stochastic gradient
        v = beta * v - lr * g  # (n,) — velocity update
        x = x + v              # (n,) — position update
        xs.append(x.clone())

    return xs


def adam(grad_fn, x0, lr=1e-3, beta1=0.9, beta2=0.999, eps=1e-8, num_steps=1000):
    """
    Adam optimizer from scratch.

    Args:
        grad_fn: callable returning stochastic gradient
        x0: (n,) initial point
        lr, beta1, beta2, eps: Adam hyperparameters
        num_steps: int

    Returns:
        xs: list of iterates
    """
    x = x0.clone()
    m = torch.zeros_like(x)   # (n,) — first moment
    v = torch.zeros_like(x)   # (n,) — second moment
    xs = [x.clone()]

    for t in range(1, num_steps + 1):
        g = grad_fn(x)                      # (n,) — stochastic gradient

        m = beta1 * m + (1 - beta1) * g     # (n,) — biased first moment
        v = beta2 * v + (1 - beta2) * g**2  # (n,) — biased second moment

        m_hat = m / (1 - beta1**t)          # (n,) — bias-corrected first moment
        v_hat = v / (1 - beta2**t)          # (n,) — bias-corrected second moment

        x = x - lr * m_hat / (v_hat.sqrt() + eps)  # (n,) — Adam step
        xs.append(x.clone())

    return xs
```

### 7.3 Comparing Optimizers on the Rosenbrock Function

```python
# Rosenbrock function: f(x, y) = (1-x)^2 + 100*(y - x^2)^2
# Minimum at (1, 1) with f* = 0
# Famous for its narrow, curved valley — tests optimizer ability to navigate
# ill-conditioned landscapes.

def rosenbrock(xy):
    x, y = xy[0], xy[1]
    return (1 - x)**2 + 100 * (y - x**2)**2

def rosenbrock_grad(xy):
    x, y = xy[0], xy[1]
    dfdx = -2*(1-x) + 200*(y - x**2)*(-2*x)
    dfdy = 200*(y - x**2)
    return torch.tensor([dfdx, dfdy])

x0 = torch.tensor([-1.0, 1.0])

# Run each optimizer
traj_gd = gradient_descent(rosenbrock, rosenbrock_grad, x0, lr=1e-3, num_steps=5000)
traj_mom = sgd_momentum(rosenbrock_grad, x0, lr=1e-3, beta=0.9, num_steps=5000)
traj_adam = adam(rosenbrock_grad, x0, lr=1e-2, num_steps=5000)

print(f"GD final:   x={traj_gd[0][-1].tolist()}, f={rosenbrock(traj_gd[0][-1]):.6f}")
print(f"Mom final:  x={traj_mom[-1].tolist()}, f={rosenbrock(traj_mom[-1]):.6f}")
print(f"Adam final: x={traj_adam[-1].tolist()}, f={rosenbrock(traj_adam[-1]):.6f}")
```

### 7.4 Using PyTorch's Built-in Optimizers

```python
import torch.nn as nn
import torch.optim as optim

# Simple example: linear regression
torch.manual_seed(42)
N, D = 100, 5
X = torch.randn(N, D)                          # (100, 5) — input data
w_true = torch.randn(D)                         # (5,)     — true weights
y = X @ w_true + 0.1 * torch.randn(N)           # (100,)   — noisy targets

# Model
model = nn.Linear(D, 1, bias=False)              # weight: (1, 5)
optimizer = optim.AdamW(model.parameters(), lr=0.01, weight_decay=0.01)

# Training loop
for epoch in range(200):
    y_pred = model(X).squeeze()                  # (100,)
    loss = ((y_pred - y)**2).mean()              # scalar — MSE loss

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    if (epoch + 1) % 50 == 0:
        print(f"Epoch {epoch+1}: loss = {loss.item():.6f}")

print(f"\nTrue weights:    {w_true.tolist()}")
print(f"Learned weights: {model.weight.data.squeeze().tolist()}")
```

### 7.5 Learning Rate Schedule Implementation

```python
def cosine_warmup_schedule(optimizer, warmup_steps, total_steps, eta_min=0):
    """
    Create a learning rate schedule with linear warmup + cosine decay.

    Args:
        optimizer: PyTorch optimizer
        warmup_steps: number of warmup steps
        total_steps: total number of training steps
        eta_min: minimum learning rate

    Returns:
        scheduler: callable that steps the LR schedule
    """
    def lr_lambda(step):
        if step < warmup_steps:
            return step / warmup_steps  # linear warmup
        else:
            progress = (step - warmup_steps) / (total_steps - warmup_steps)
            return eta_min + 0.5 * (1 - eta_min) * (1 + torch.cos(torch.tensor(progress * 3.14159)).item())

    return optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

# Usage:
model = nn.Linear(10, 1)
optimizer = optim.AdamW(model.parameters(), lr=1e-3)
scheduler = cosine_warmup_schedule(optimizer, warmup_steps=100, total_steps=1000)

lrs = []
for step in range(1000):
    lrs.append(optimizer.param_groups[0]['lr'])
    optimizer.step()
    scheduler.step()

print(f"LR at step 0:   {lrs[0]:.6f}")
print(f"LR at step 100: {lrs[100]:.6f}")
print(f"LR at step 500: {lrs[500]:.6f}")
print(f"LR at step 999: {lrs[999]:.6f}")
```

---

## 8. Connections

### 8.1 Summary of Convergence Rates

| Method | Setting | Rate | Cost/iter |
|--------|---------|------|-----------|
| GD | $L$-smooth convex | $\mathcal{O}(1/T)$ | $\mathcal{O}(Np)$ |
| GD | $m$-strongly convex, $L$-smooth | $\mathcal{O}((1 - m/L)^T)$ | $\mathcal{O}(Np)$ |
| Nesterov | $L$-smooth convex | $\mathcal{O}(1/T^2)$ | $\mathcal{O}(Np)$ |
| SGD | $L$-smooth convex | $\mathcal{O}(1/\sqrt{T})$ | $\mathcal{O}(Bp)$ |
| SGD | $m$-strongly convex, $L$-smooth | $\mathcal{O}(1/T)$ | $\mathcal{O}(Bp)$ |

### 8.2 Which Optimizer to Use?

**Rules of thumb from practice:**

- **SGD + momentum** ($\beta = 0.9$): Often achieves the best generalization for vision models (CNNs, ViTs). Requires more learning rate tuning.
- **AdamW** ($\beta_1 = 0.9$, $\beta_2 = 0.999$ or $0.95$): Standard for Transformers, LLMs, and most modern architectures. Less sensitive to learning rate. Always use weight decay.
- **Learning rate warmup**: Essential for large models; prevents early divergence.
- **Cosine decay**: Standard schedule; alternative: linear decay to 10% of peak LR.
- **Gradient clipping** (max norm): $\|\mathbf{g}\|_2 \le c$ (typically $c = 1.0$). Prevents exploding gradients. Applied before the optimizer step.

---

## 9. Paper Reading List

### Textbook Chapters
1. **Boyd, S. & Vandenberghe, L.** *Convex Optimization* (2004). Chapters 2-3 (convex sets and functions), Chapter 9 (unconstrained minimization). Free at: https://web.stanford.edu/~boyd/cvxbook/
2. **Nesterov, Y.** *Introductory Lectures on Convex Optimization* (2004). (Theoretical foundation.)
3. **Goodfellow, Bengio, Courville.** *Deep Learning*, Chapter 8: Optimization for Training Deep Models.

### Research Papers
4. **Kingma, D. P. & Ba, J.** "Adam: A method for stochastic optimization." *ICLR* (2015). (The Adam paper.)
5. **Loshchilov, I. & Hutter, F.** "Decoupled weight decay regularization." *ICLR* (2019). (AdamW.)
6. **Loshchilov, I. & Hutter, F.** "SGDR: Stochastic gradient descent with warm restarts." *ICLR* (2017). (Cosine annealing.)
7. **Li, H., Xu, Z., Taylor, G., Studer, C., & Goldstein, T.** "Visualizing the loss landscape of neural nets." *NeurIPS* (2018). (Loss landscape visualization; skip connections dramatically smooth the landscape.)
8. **Dauphin, Y. N., Pascanu, R., Gulcehre, C., Cho, K., Ganguli, S., & Bengio, Y.** "Identifying and attacking the saddle point problem in high-dimensional non-convex optimization." *NeurIPS* (2014). (Saddle points dominate in high dimensions.)
9. **Zhang, J., Karimireddy, S. P., Veit, A., Kim, S., Reddi, S., Kumar, S., & Sra, S.** "Why are adaptive methods good for attention models?" *NeurIPS* (2020). (Why Adam works better than SGD for Transformers.)

---

## 10. Exercises

### Theory Problems

**Problem 1** (12 pts). *Verifying convexity.*
For each function below, determine whether it is convex, strictly convex, or strongly convex. Prove your answer using the appropriate condition (first-order, second-order, or definition).
- (a) $f(\mathbf{x}) = \log\!\left(\sum_{i=1}^n e^{x_i}\right)$ (log-sum-exp)
- (b) $f(\mathbf{x}) = \|\mathbf{x}\|_1$
- (c) $f(\mathbf{x}) = \mathbf{x}^\top A\mathbf{x} + \mathbf{b}^\top\mathbf{x}$ where $A \succ 0$
- (d) $f(X) = -\log\det(X)$ for $X \succ 0$

**Problem 2** (15 pts). *Convergence analysis.*
Consider minimizing $f(\mathbf{x}) = \frac{1}{2}\mathbf{x}^\top A\mathbf{x}$ where $A$ is symmetric positive definite with eigenvalues $\lambda_1 \ge \cdots \ge \lambda_n > 0$.
- (a) What is the optimal constant step size for gradient descent? (Express in terms of $\lambda_1$ and $\lambda_n$.)
- (b) Write out the GD iteration in the eigenbasis of $A$. Show that each coordinate converges independently as a geometric series.
- (c) Prove that the convergence rate (per iteration) is $\left(\frac{\lambda_1 - \lambda_n}{\lambda_1 + \lambda_n}\right)^2 = \left(\frac{\kappa - 1}{\kappa + 1}\right)^2$ where $\kappa = \lambda_1/\lambda_n$.
- (d) How does momentum improve this rate?

**Problem 3** (12 pts). *SGD noise analysis.*
Consider $f(\theta) = \mathbb{E}_{x \sim p}[\ell(\theta, x)]$ where $\ell(\theta, x) = \frac{1}{2}(\theta - x)^2$ and $x \sim \mathcal{N}(0, 1)$. (So $f(\theta) = \frac{1}{2}(\theta^2 + 1)$, minimized at $\theta^* = 0$.)
- (a) Compute $\nabla f(\theta)$ and the stochastic gradient $g(\theta, x) = \nabla_\theta \ell(\theta, x)$.
- (b) Compute the variance of the stochastic gradient as a function of $\theta$.
- (c) Show that with constant step size $\eta$, SGD does not converge to $\theta^* = 0$ but instead fluctuates around it. What is the stationary distribution of $\theta_t$ for large $t$?

**Problem 4** (10 pts). *Adam analysis.*
Show that Adam with $\beta_1 = 0$, $\beta_2 = 0$ reduces to standard gradient descent (with a factor of $1/(1+\epsilon)$ in the effective learning rate). What does Adam with $\beta_1 = 0$ (but $\beta_2 > 0$) correspond to?

**Problem 5** (12 pts). *Condition number and preconditioning.*
Consider $f(\mathbf{x}) = \frac{1}{2}\mathbf{x}^\top A\mathbf{x}$ with $A = \text{diag}(100, 1)$.
- (a) What is the condition number $\kappa$?
- (b) Run GD for 1000 steps with $\eta = 2/(\lambda_1 + \lambda_n)$ starting from $\mathbf{x}_0 = (10, 10)^\top$. Plot the trajectory in 2D and $f(\mathbf{x}_t)$ vs. $t$.
- (c) Now apply the preconditioner $P = A^{-1}$ (i.e., update $\mathbf{x} \leftarrow \mathbf{x} - \eta\,P\,\nabla f(\mathbf{x})$). Show this converges in one step. What is the condition number of the preconditioned system?
- (d) Explain why Adam's adaptive learning rates act as a diagonal preconditioner. When does this fail?

### Implementation Problems

**Problem 6** (15 pts). *Optimizer comparison on neural network training.*
Train a 3-layer MLP on MNIST with:
- SGD (lr=0.01)
- SGD + momentum (lr=0.01, momentum=0.9)
- Adam (lr=0.001)
- AdamW (lr=0.001, weight_decay=0.01)

For each optimizer:
- Plot training loss and test accuracy vs. epoch.
- Plot the learning rate schedule (use cosine decay for all).
- Report final test accuracy.
- Measure wall-clock time per epoch.

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

class MLP(nn.Module):
    def __init__(self, input_dim=784, hidden_dim=256, num_classes=10):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),   # (784, 256)
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),  # (256, 256)
            nn.ReLU(),
            nn.Linear(hidden_dim, num_classes),  # (256, 10)
        )

    def forward(self, x):
        return self.net(x.view(x.size(0), -1))  # (batch, 10)

# YOUR CODE: training loop with different optimizers
```

**Problem 7** (15 pts). *Loss landscape visualization.*
For a simple 2-layer network trained on a small dataset:
- After training, compute the loss along random 1D and 2D slices through the parameter space.
- Implement the filter-normalized visualization from Li et al. (2018): for random direction $\mathbf{d}$, normalize $\mathbf{d}_i = \frac{\mathbf{d}_i}{\|\mathbf{d}_i\|}\|\theta_i\|$ for each layer $i$, then plot $f(\theta^* + \alpha\,\mathbf{d})$ for $\alpha \in [-1, 1]$.
- Compare the landscape for a network with and without skip connections.

**Problem 8** (12 pts). *Gradient clipping analysis.*
Implement gradient clipping (max-norm) and compare training stability:
- Train an RNN (single-layer, hidden size 128) on a simple sequence copying task.
- Train with and without gradient clipping ($c = 1.0$).
- Plot the gradient norm $\|\nabla \mathcal{L}\|$ vs. training step for both cases.
- Show that without clipping, the gradient norm occasionally spikes, causing training instability.

```python
def clip_grad_norm(parameters, max_norm):
    """
    Clip gradient norm in-place.

    Args:
        parameters: iterable of tensors with .grad attribute
        max_norm: float, maximum allowed gradient norm

    Returns:
        total_norm: float, the original gradient norm
    """
    # YOUR CODE HERE
    pass
```

---

*Previous: [Lecture 00b — Probability and Information Theory](lecture_00b_probability_information_theory.md)*
*Next: [Module 01 — MLPs, Backprop, and Optimization](../01_mlp_backprop/lecture_01a_universal_approximation.md)*
