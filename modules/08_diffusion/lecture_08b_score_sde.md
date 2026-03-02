# Lecture 08b: Score-Based Generative Models and Stochastic Differential Equations

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formulate** the forward diffusion process as a continuous-time stochastic differential equation (SDE).
2. **Define** VP-SDE and VE-SDE and explain their relationship to DDPM and SMLD respectively.
3. **Derive** the reverse-time SDE using Anderson's (1982) result and explain the role of the score function $\nabla_x \log p_t(x)$.
4. **Derive** the probability flow ODE as a deterministic counterpart to the reverse SDE.
5. **Prove** that denoising score matching provides a tractable objective for learning the score function.
6. **Show** the formal equivalence between discrete-time DDPM and the VP-SDE in the continuous limit.
7. **Implement** continuous-time score matching training in PyTorch.

---

## 2. Motivation and Context

### 2.1 From Discrete to Continuous

Lecture 08a presented DDPM as a discrete-time Markov chain with $T$ timesteps. While effective, this formulation has limitations:

- The number of steps $T$ is a fixed hyperparameter that affects both training and sampling.
- The noise schedule $\{\beta_t\}$ must be carefully tuned.
- There is no principled way to vary the number of sampling steps independently of training.

Song et al. (2021) unified score-based models and diffusion models by formulating both as **stochastic differential equations** (SDEs). In continuous time, the forward process becomes an Ito SDE, and the reverse process is also an SDE --- with the data score function as the key learned quantity. This framework yields:

- A unified view of DDPM, NCSN (noise conditional score networks), and new model classes.
- The probability flow ODE: a deterministic process that generates the same marginals as the SDE, enabling exact likelihood computation.
- Flexible sampling with any SDE or ODE solver at any desired number of steps.

### 2.2 Prerequisites

This lecture assumes familiarity with:
- Ito calculus: Ito SDEs, Ito's lemma, Wiener processes.
- DDPM (Lecture 08a): forward/reverse processes, noise prediction, $L_{\text{simple}}$.
- Basic measure theory: density evolution, Fokker-Planck equations.

We will provide necessary background on SDEs as needed, but a deeper treatment can be found in Oksendal (2003).

---

## 3. Core Theory

### 3.1 Stochastic Differential Equations: Background

**Definition 3.1 (Wiener Process).** A standard Wiener process (Brownian motion) $\{W_t\}_{t \geq 0}$ in $\mathbb{R}^d$ satisfies:
1. $W_0 = 0$.
2. $W_t - W_s \sim \mathcal{N}(0, (t-s)I_d)$ for $0 \leq s < t$.
3. Increments over non-overlapping intervals are independent.

**Definition 3.2 (Ito SDE).** An Ito SDE has the form:

$$dx = f(x, t)\, dt + G(x, t)\, dW$$

where $f: \mathbb{R}^d \times [0, T] \to \mathbb{R}^d$ is the **drift** coefficient, $G: \mathbb{R}^d \times [0, T] \to \mathbb{R}^{d \times d}$ is the **diffusion** coefficient, and $W$ is a $d$-dimensional Wiener process. We restrict attention to the case $G(x,t) = g(t) I$ (scalar diffusion) for simplicity:

$$dx = f(x, t)\, dt + g(t)\, dW$$

**Definition 3.3 (Marginal Density).** Let $p_t(x)$ denote the marginal density of $x_t$ at time $t$. The evolution of $p_t$ is governed by the **Fokker-Planck equation** (also called Kolmogorov forward equation):

$$\frac{\partial p_t(x)}{\partial t} = -\nabla \cdot \bigl[f(x, t)\, p_t(x)\bigr] + \frac{g(t)^2}{2} \Delta p_t(x)$$

where $\nabla \cdot$ denotes divergence and $\Delta$ is the Laplacian.

### 3.2 Forward SDE

We define the forward (noising) process as an Ito SDE on $t \in [0, T]$:

$$dx = f(x, t)\, dt + g(t)\, dW \qquad (\text{Forward SDE})$$

with initial condition $x_0 \sim p_{\text{data}}(x)$. The SDE gradually transforms the data distribution $p_0 = p_{\text{data}}$ into a simple prior $p_T \approx \pi$ (typically $\mathcal{N}(0, \sigma_T^2 I)$).

### 3.3 VP-SDE (Variance Preserving)

**Definition 3.4 (VP-SDE).** The variance-preserving SDE is:

$$dx = -\frac{1}{2}\beta(t)\, x\, dt + \sqrt{\beta(t)}\, dW$$

where $\beta(t) > 0$ is a continuous noise schedule. Here $f(x, t) = -\frac{1}{2}\beta(t)\, x$ and $g(t) = \sqrt{\beta(t)}$.

**Proposition 3.5 (VP-SDE Transition Kernel).** The transition kernel of the VP-SDE is:

$$p_{0t}(x_t \mid x_0) = \mathcal{N}\!\left(x_t;\, e^{-\frac{1}{2}\int_0^t \beta(s)\,ds}\, x_0,\, \left(1 - e^{-\int_0^t \beta(s)\,ds}\right) I\right)$$

*Proof.* The VP-SDE is a linear SDE of the Ornstein-Uhlenbeck type. Define $\lambda(t) = \int_0^t \beta(s)\, ds$. The SDE $dx = -\frac{1}{2}\beta(t) x\, dt + \sqrt{\beta(t)}\, dW$ has the solution:

$$x_t = e^{-\lambda(t)/2}\, x_0 + \int_0^t e^{-(\lambda(t) - \lambda(s))/2}\, \sqrt{\beta(s)}\, dW_s$$

The stochastic integral is Gaussian with mean zero and variance:

$$\text{Var} = \int_0^t e^{-(\lambda(t) - \lambda(s))}\, \beta(s)\, ds = e^{-\lambda(t)} \int_0^t e^{\lambda(s)}\, \beta(s)\, ds$$

Since $\lambda'(s) = \beta(s)$, we have $e^{\lambda(s)} \beta(s) = \frac{d}{ds} e^{\lambda(s)}$, so:

$$\text{Var} = e^{-\lambda(t)} \bigl[e^{\lambda(t)} - e^{\lambda(0)}\bigr] = 1 - e^{-\lambda(t)}$$

Therefore $p_{0t}(x_t \mid x_0) = \mathcal{N}(e^{-\lambda(t)/2} x_0,\, (1 - e^{-\lambda(t)}) I)$. $\blacksquare$

**Connection to DDPM.** Setting $\bar{\alpha}_t = e^{-\lambda(t)} = e^{-\int_0^t \beta(s)\, ds}$, we recover:

$$p_{0t}(x_t \mid x_0) = \mathcal{N}\!\bigl(\sqrt{\bar{\alpha}_t}\, x_0,\, (1 - \bar{\alpha}_t) I\bigr)$$

which is exactly the DDPM marginal from Theorem 3.2 of Lecture 08a. The discrete schedule $\beta_k$ is related to the continuous schedule by $\beta_k = \int_{(k-1)/N}^{k/N} \beta(s)\, ds$ when dividing $[0, 1]$ into $N$ intervals.

### 3.4 VE-SDE (Variance Exploding)

**Definition 3.6 (VE-SDE).** The variance-exploding SDE is:

$$dx = \sqrt{\frac{d[\sigma^2(t)]}{dt}}\, dW$$

where $\sigma(t)$ is an increasing noise scale. Here $f(x, t) = 0$ (no drift) and $g(t) = \sqrt{d\sigma^2(t)/dt}$.

**Proposition 3.7 (VE-SDE Transition Kernel).**

$$p_{0t}(x_t \mid x_0) = \mathcal{N}\!\bigl(x_0,\, [\sigma^2(t) - \sigma^2(0)] I\bigr)$$

*Proof.* Since $f = 0$, the SDE is purely diffusive: $x_t = x_0 + \int_0^t g(s)\, dW_s$. The variance accumulates as:

$$\text{Var} = \int_0^t g^2(s)\, ds = \int_0^t \frac{d\sigma^2(s)}{ds}\, ds = \sigma^2(t) - \sigma^2(0) \qquad \blacksquare$$

**Connection to NCSN/SMLD.** In the score matching with Langevin dynamics (SMLD) framework of Song and Ermon (2019), noise is added without attenuating the signal. The marginal at level $\sigma_i$ is $\mathcal{N}(x_0, \sigma_i^2 I)$. VE-SDE is the continuous-time limit of this discrete process, with $\sigma(t)$ chosen so that $\sigma^2(T) \gg \|x_0\|^2$ to ensure the terminal distribution is approximately $\mathcal{N}(0, \sigma^2(T) I)$.

### 3.5 Comparison: VP-SDE vs. VE-SDE

| Property | VP-SDE | VE-SDE |
|----------|--------|--------|
| Drift | $f(x,t) = -\frac{1}{2}\beta(t) x$ | $f(x,t) = 0$ |
| Diffusion | $g(t) = \sqrt{\beta(t)}$ | $g(t) = \sqrt{d\sigma^2/dt}$ |
| Signal attenuation | Yes ($\sqrt{\bar{\alpha}_t}$ decay) | No |
| Variance at time $t$ | $1 - \bar{\alpha}_t$ (bounded by 1) | $\sigma^2(t)$ (unbounded) |
| Terminal distribution | $\approx \mathcal{N}(0, I)$ | $\approx \mathcal{N}(0, \sigma^2(T) I)$ |
| Discrete analog | DDPM | SMLD/NCSN |

### 3.6 Reverse-Time SDE

**Theorem 3.8 (Anderson, 1982).** Given a forward SDE:

$$dx = f(x, t)\, dt + g(t)\, dW$$

the reverse-time SDE, running from $t = T$ to $t = 0$, is:

$$dx = \bigl[f(x, t) - g(t)^2 \nabla_x \log p_t(x)\bigr]\, dt + g(t)\, d\bar{W}$$

where $\bar{W}$ is a reverse-time Wiener process, $dt$ is an infinitesimal negative time step (time runs backward), and $\nabla_x \log p_t(x)$ is the **score function** of the marginal density at time $t$.

*Proof sketch.* Starting from the Fokker-Planck equation for the forward process:

$$\frac{\partial p_t}{\partial t} = -\nabla \cdot [f(x,t) p_t] + \frac{g^2(t)}{2} \Delta p_t$$

We seek an SDE $dx = \tilde{f}(x,t) dt + g(t) d\bar{W}$ whose Fokker-Planck equation, when run backward in time, produces the same marginals $p_t$.

The backward Fokker-Planck equation (with reversed time $\tau = T - t$) is:

$$-\frac{\partial p_t}{\partial t} = -\nabla \cdot [\tilde{f}(x,t) p_t] + \frac{g^2(t)}{2} \Delta p_t$$

Setting this equal to the negative of the forward Fokker-Planck equation and solving for $\tilde{f}$:

$$\nabla \cdot [\tilde{f}\, p_t] - \frac{g^2}{2} \Delta p_t = \nabla \cdot [f\, p_t] - \frac{g^2}{2} \Delta p_t$$

This requires:

$$\tilde{f}\, p_t = f\, p_t - g^2 \nabla p_t$$

Dividing by $p_t$:

$$\tilde{f} = f - g^2 \frac{\nabla p_t}{p_t} = f - g^2 \nabla_x \log p_t(x) \qquad \blacksquare$$

**Key insight:** If we know the score function $\nabla_x \log p_t(x)$ for all $t$, we can run the reverse SDE to transform noise into data.

### 3.7 Probability Flow ODE

**Theorem 3.9 (Probability Flow ODE).** For any forward SDE with scalar diffusion, there exists an ODE whose solution trajectories have the same marginal densities $\{p_t\}_{t \in [0,T]}$:

$$\frac{dx}{dt} = f(x, t) - \frac{1}{2} g(t)^2 \nabla_x \log p_t(x) \qquad (\text{Probability Flow ODE})$$

*Proof.* Consider the Fokker-Planck equation for a general SDE $dx = \hat{f}(x,t)\, dt + \hat{g}(t)\, dW$:

$$\frac{\partial p_t}{\partial t} = -\nabla \cdot [\hat{f}\, p_t] + \frac{\hat{g}^2}{2} \Delta p_t$$

For an ODE ($\hat{g} = 0$), the continuity equation is:

$$\frac{\partial p_t}{\partial t} = -\nabla \cdot [\hat{f}\, p_t]$$

We need to find $\hat{f}$ such that this matches the SDE's Fokker-Planck. Expanding the diffusion term:

$$\frac{g^2}{2} \Delta p_t = \frac{g^2}{2} \nabla \cdot (\nabla p_t) = \nabla \cdot \left[\frac{g^2}{2} \nabla p_t\right] = \nabla \cdot \left[\frac{g^2}{2} p_t \nabla \log p_t\right]$$

Substituting:

$$\frac{\partial p_t}{\partial t} = -\nabla \cdot \left[\left(f - \frac{g^2}{2} \nabla \log p_t\right) p_t\right]$$

This is the continuity equation for an ODE with drift $\hat{f} = f - \frac{g^2}{2} \nabla_x \log p_t(x)$. $\blacksquare$

**Important properties of the probability flow ODE:**
1. **Deterministic:** Given $x_T$, the trajectory $x_t$ is uniquely determined. This enables deterministic sampling.
2. **Exact likelihood:** By the instantaneous change of variables formula (Chen et al., 2018):
$$\log p_0(x_0) = \log p_T(x_T) + \int_0^T \nabla \cdot \hat{f}(x_t, t)\, dt$$
3. **Same marginals:** Despite being deterministic, the ODE produces the same marginal distribution $p_t$ as the stochastic reverse SDE at every time $t$.

### 3.8 Score Matching

The central learning problem is to estimate $\nabla_x \log p_t(x)$ with a neural network $s_\theta(x, t) \approx \nabla_x \log p_t(x)$.

**Definition 3.10 (Explicit Score Matching).** The ideal objective is:

$$\mathcal{J}(\theta) = \frac{1}{2} \mathbb{E}_{t \sim \mathcal{U}[0,T]} \mathbb{E}_{x \sim p_t}\!\left[\lambda(t) \bigl\|s_\theta(x, t) - \nabla_x \log p_t(x)\bigr\|^2\right]$$

where $\lambda(t) > 0$ is a weighting function. This is intractable because $\nabla_x \log p_t(x)$ is unknown.

**Theorem 3.11 (Denoising Score Matching).** The score matching objective is equivalent (up to a constant independent of $\theta$) to:

$$\mathcal{J}_{\text{DSM}}(\theta) = \frac{1}{2} \mathbb{E}_{t} \mathbb{E}_{x_0 \sim p_0} \mathbb{E}_{x_t \sim p_{0t}(\cdot \mid x_0)}\!\left[\lambda(t) \bigl\|s_\theta(x_t, t) - \nabla_{x_t} \log p_{0t}(x_t \mid x_0)\bigr\|^2\right]$$

*Proof.* We show that the cross term in the squared norm expansion yields a constant. Expand:

$$\|s_\theta - \nabla \log p_t\|^2 = \|s_\theta\|^2 - 2\, s_\theta \cdot \nabla \log p_t + \|\nabla \log p_t\|^2$$

The last term is independent of $\theta$. For the cross term, we use:

$$\mathbb{E}_{x \sim p_t}\bigl[s_\theta(x,t) \cdot \nabla \log p_t(x)\bigr] = \int s_\theta(x,t) \cdot \frac{\nabla p_t(x)}{p_t(x)} p_t(x)\, dx = \int s_\theta(x,t) \cdot \nabla p_t(x)\, dx$$

Now, $p_t(x) = \int p_{0t}(x \mid x_0)\, p_0(x_0)\, dx_0$, so:

$$\int s_\theta \cdot \nabla p_t\, dx = \int \int s_\theta(x, t) \cdot \nabla_x p_{0t}(x \mid x_0)\, p_0(x_0)\, dx_0\, dx$$

$$= \mathbb{E}_{x_0}\!\left[\int s_\theta(x, t) \cdot \nabla_x \log p_{0t}(x \mid x_0)\, p_{0t}(x \mid x_0)\, dx\right]$$

$$= \mathbb{E}_{x_0} \mathbb{E}_{x_t \mid x_0}\bigl[s_\theta(x_t, t) \cdot \nabla_{x_t} \log p_{0t}(x_t \mid x_0)\bigr]$$

Substituting back, we find that minimizing the explicit score matching loss is equivalent to minimizing the denoising score matching loss $\mathcal{J}_{\text{DSM}}$ up to a $\theta$-independent constant. $\blacksquare$

**For the VP-SDE:** Since $p_{0t}(x_t \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_t} x_0, (1 - \bar{\alpha}_t) I)$:

$$\nabla_{x_t} \log p_{0t}(x_t \mid x_0) = -\frac{x_t - \sqrt{\bar{\alpha}_t}\, x_0}{1 - \bar{\alpha}_t} = -\frac{\varepsilon}{\sqrt{1 - \bar{\alpha}_t}}$$

With the choice $\lambda(t) = 1 - \bar{\alpha}_t$, the DSM loss becomes:

$$\mathcal{J}_{\text{DSM}} \propto \mathbb{E}_{t, x_0, \varepsilon}\bigl[\|\varepsilon - \varepsilon_\theta(x_t, t)\|^2\bigr] = L_{\text{simple}}$$

This proves that **DDPM's simplified loss is denoising score matching** with a specific weighting.

### 3.9 The Score-Noise Relationship

**Proposition 3.12.** The score function and the noise prediction network are related by:

$$s_\theta(x_t, t) = -\frac{\varepsilon_\theta(x_t, t)}{\sqrt{1 - \bar{\alpha}_t}}$$

*Proof.* The optimal score satisfies $s^*(x_t, t) = \nabla_{x_t} \log p_t(x_t)$. For the conditional:

$$\nabla_{x_t} \log p_{0t}(x_t \mid x_0) = -\frac{x_t - \sqrt{\bar{\alpha}_t} x_0}{1 - \bar{\alpha}_t}$$

Since $x_t = \sqrt{\bar{\alpha}_t} x_0 + \sqrt{1 - \bar{\alpha}_t}\, \varepsilon$, we have $x_t - \sqrt{\bar{\alpha}_t} x_0 = \sqrt{1 - \bar{\alpha}_t}\, \varepsilon$, so:

$$\nabla_{x_t} \log p_{0t}(x_t \mid x_0) = -\frac{\varepsilon}{\sqrt{1 - \bar{\alpha}_t}}$$

The denoising score matching objective trains $s_\theta$ to match this conditional score. If we define $\varepsilon_\theta(x_t, t) = -\sqrt{1 - \bar{\alpha}_t}\, s_\theta(x_t, t)$, then the DSM loss reduces to $L_{\text{simple}}$. $\blacksquare$

---

## 4. Algorithmic Derivation

### 4.1 Continuous-Time Score Matching Training

```
Algorithm 1: Score-SDE Training
─────────────────────────────────────────
Input: dataset D, score network s_θ, forward SDE (f, g), T, weighting λ(t)

repeat:
    x_0 ~ D                                    # Sample data
    t ~ Uniform(ε, T)                          # Sample time (ε > 0 for stability)
    Compute mean m(t) and std σ(t) of p_{0t}(·|x_0)
    ε ~ N(0, I)                                # Sample noise
    x_t = m(t) · x_0 + σ(t) · ε               # (or appropriate form for VE-SDE)
    target = ∇_{x_t} log p_{0t}(x_t|x_0)      # = -ε/σ(t) for VP-SDE
    L = λ(t) · ||s_θ(x_t, t) - target||²
    θ ← θ - η · ∇_θ L
until converged
```

### 4.2 Reverse SDE Sampling (Euler-Maruyama)

```
Algorithm 2: Reverse SDE Sampling
─────────────────────────────────────────
Input: score network s_θ, SDE (f, g), T, N steps

dt = -T/N
x ~ p_T ≈ N(0, I)  (or N(0, σ²(T)I) for VE)

for i = N-1, ..., 0:
    t = (i+1) · T/N
    z ~ N(0, I)
    x ← x + [f(x,t) - g²(t) · s_θ(x,t)] · dt + g(t) · √|dt| · z
return x
```

**Complexity:** $N$ forward passes through $s_\theta$. For $N \ll T_{\text{discrete}}$, this can be significantly faster than discrete DDPM.

### 4.3 Probability Flow ODE Sampling

```
Algorithm 3: Probability Flow ODE Sampling
─────────────────────────────────────────
Input: score network s_θ, SDE (f, g), T, ODE solver (e.g., Euler, Heun)

x ~ p_T
Solve ODE: dx/dt = f(x,t) - (1/2)g²(t) · s_θ(x,t) from t=T to t=0
return x(0)
```

**Advantages:** Deterministic, enables exact log-likelihood computation, can use adaptive step-size ODE solvers (e.g., Dormand-Prince RK45). Higher-order solvers (Heun, RK4) converge faster, needing fewer function evaluations.

---

## 5. PyTorch Implementation

### 5.1 VP-SDE Class

```python
import torch
import torch.nn as nn
import math


class VPSDE:
    """Variance-Preserving SDE: dx = -0.5*β(t)*x*dt + √β(t)*dW.

    Provides transition kernel, score targets, and sampling utilities.
    """

    def __init__(self, beta_min: float = 0.1, beta_max: float = 20.0, T: float = 1.0):
        """
        Args:
            beta_min: β(0) of linear continuous schedule
            beta_max: β(T) of linear continuous schedule
            T: terminal time
        """
        self.beta_min = beta_min
        self.beta_max = beta_max
        self.T = T

    def beta(self, t: torch.Tensor) -> torch.Tensor:
        """Continuous noise schedule β(t) = beta_min + t*(beta_max - beta_min).

        Args:
            t: (...,) time values in [0, T]

        Returns:
            beta_t: (...,) noise schedule values
        """
        return self.beta_min + t * (self.beta_max - self.beta_min)  # (...,)

    def log_mean_coeff(self, t: torch.Tensor) -> torch.Tensor:
        """log(√ᾱ_t) = -1/4 * t² * (beta_max - beta_min) - 1/2 * t * beta_min.

        Args:
            t: (...,) time values

        Returns:
            log_coeff: (...,)
        """
        return -0.25 * t**2 * (self.beta_max - self.beta_min) - 0.5 * t * self.beta_min

    def mean_and_std(self, t: torch.Tensor):
        """Compute mean coefficient and standard deviation of p_{0t}(x_t|x_0).

        Args:
            t: (...,) time values

        Returns:
            mean_coeff: (...,) = √ᾱ_t = exp(log_mean_coeff)
            std: (...,) = √(1 - ᾱ_t)
        """
        log_coeff = self.log_mean_coeff(t)      # (...,)
        mean_coeff = torch.exp(log_coeff)        # (...,) = √ᾱ_t
        std = torch.sqrt(1.0 - torch.exp(2.0 * log_coeff))  # (...,) = √(1 - ᾱ_t)
        return mean_coeff, std

    def marginal_prob(self, x0: torch.Tensor, t: torch.Tensor):
        """Sample from p_{0t}(x_t|x_0) = N(mean_coeff*x_0, std²*I).

        Args:
            x0: (B, C, H, W) clean data
            t: (B,) time values

        Returns:
            xt: (B, C, H, W) noisy data
            noise: (B, C, H, W) the noise that was added
            std: (B,) standard deviation at each time
        """
        mean_coeff, std = self.mean_and_std(t)   # (B,), (B,)

        # Reshape for broadcasting
        mc = mean_coeff[:, None, None, None]     # (B, 1, 1, 1)
        s = std[:, None, None, None]             # (B, 1, 1, 1)

        noise = torch.randn_like(x0)            # (B, C, H, W)
        xt = mc * x0 + s * noise                 # (B, C, H, W)
        return xt, noise, std

    def prior_sampling(self, shape: tuple, device: torch.device) -> torch.Tensor:
        """Sample from the prior p_T ≈ N(0, I).

        Args:
            shape: desired tensor shape
            device: torch device

        Returns:
            x_T: tensor of given shape
        """
        return torch.randn(shape, device=device)

    def drift_and_diffusion(self, x: torch.Tensor, t: torch.Tensor):
        """Compute f(x,t) and g(t) for the forward SDE.

        Args:
            x: (B, C, H, W) current state
            t: (B,) time values

        Returns:
            drift: (B, C, H, W) = -0.5*β(t)*x
            diffusion: (B,) = √β(t)
        """
        beta_t = self.beta(t)                              # (B,)
        drift = -0.5 * beta_t[:, None, None, None] * x     # (B, C, H, W)
        diffusion = torch.sqrt(beta_t)                     # (B,)
        return drift, diffusion
```

### 5.2 Score-SDE Training

```python
class ScoreSDETrainer:
    """Training loop for continuous-time score matching."""

    def __init__(
        self,
        score_model: nn.Module,
        sde: VPSDE,
        lr: float = 2e-4,
        weighting: str = "likelihood",
    ):
        """
        Args:
            score_model: s_θ(x, t) -> score estimate, shape (B, C, H, W)
            sde: forward SDE object
            lr: learning rate
            weighting: "likelihood" uses λ(t) = g²(t), "simple" uses λ(t) = σ²(t)
        """
        self.model = score_model
        self.sde = sde
        self.optimizer = torch.optim.Adam(score_model.parameters(), lr=lr)
        self.weighting = weighting

    def loss_fn(self, x0: torch.Tensor) -> torch.Tensor:
        """Compute denoising score matching loss.

        Args:
            x0: (B, C, H, W) clean data

        Returns:
            loss: scalar
        """
        B = x0.shape[0]
        eps = 1e-5  # avoid t=0 singularity

        # Sample random times uniformly in [eps, T]
        t = torch.rand(B, device=x0.device) * (self.sde.T - eps) + eps  # (B,)

        # Forward process
        xt, noise, std = self.sde.marginal_prob(x0, t)  # (B,C,H,W), (B,C,H,W), (B,)

        # Score target: ∇ log p_{0t}(x_t|x_0) = -noise / std
        score_target = -noise / std[:, None, None, None]  # (B, C, H, W)

        # Score prediction
        score_pred = self.model(xt, t)                    # (B, C, H, W)

        # Compute weighted loss
        if self.weighting == "likelihood":
            # λ(t) = g²(t) = β(t) -- corresponds to likelihood weighting
            weight = self.sde.beta(t)[:, None, None, None]  # (B, 1, 1, 1)
        else:
            # λ(t) = σ²(t) -- corresponds to L_simple
            weight = (std ** 2)[:, None, None, None]         # (B, 1, 1, 1)

        losses = weight * (score_pred - score_target) ** 2   # (B, C, H, W)
        return losses.mean()                                  # scalar

    def train_step(self, x0: torch.Tensor) -> float:
        """One gradient step.

        Args:
            x0: (B, C, H, W) batch of clean data

        Returns:
            loss_value: float
        """
        self.optimizer.zero_grad()
        loss = self.loss_fn(x0)
        loss.backward()
        nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()
        return loss.item()
```

### 5.3 Reverse SDE Sampler (Euler-Maruyama)

```python
@torch.no_grad()
def euler_maruyama_sampler(
    score_model: nn.Module,
    sde: VPSDE,
    shape: tuple,
    device: torch.device,
    N: int = 1000,
) -> torch.Tensor:
    """Sample by solving the reverse SDE with Euler-Maruyama.

    Args:
        score_model: trained score network s_θ(x, t)
        sde: forward SDE object
        shape: (B, C, H, W) desired output shape
        device: torch device
        N: number of discretization steps

    Returns:
        x: (B, C, H, W) generated samples
    """
    dt = -sde.T / N                                    # negative time step
    x = sde.prior_sampling(shape, device)              # (B, C, H, W)
    time_steps = torch.linspace(sde.T, 1e-5, N, device=device)  # (N,)

    for i in range(N):
        t = time_steps[i]
        t_batch = torch.full((shape[0],), t, device=device)      # (B,)

        # Compute drift and diffusion
        drift, diffusion = sde.drift_and_diffusion(x, t_batch)   # (B,C,H,W), (B,)

        # Score
        score = score_model(x, t_batch)                           # (B, C, H, W)

        # Reverse SDE drift: f(x,t) - g²(t) * score
        g_sq = diffusion[:, None, None, None] ** 2                # (B, 1, 1, 1)
        reverse_drift = drift - g_sq * score                      # (B, C, H, W)

        # Euler-Maruyama step
        z = torch.randn_like(x) if i < N - 1 else torch.zeros_like(x)
        x = x + reverse_drift * dt + diffusion[:, None, None, None] * (abs(dt) ** 0.5) * z

    return x  # (B, C, H, W)
```

### 5.4 Probability Flow ODE Sampler

```python
@torch.no_grad()
def probability_flow_ode_sampler(
    score_model: nn.Module,
    sde: VPSDE,
    shape: tuple,
    device: torch.device,
    N: int = 1000,
) -> torch.Tensor:
    """Sample by solving the probability flow ODE with Euler method.

    dx/dt = f(x,t) - 0.5 * g²(t) * s_θ(x,t)

    Args:
        score_model: trained score network
        sde: forward SDE object
        shape: (B, C, H, W)
        device: torch device
        N: number of Euler steps

    Returns:
        x: (B, C, H, W) generated samples
    """
    dt = -sde.T / N
    x = sde.prior_sampling(shape, device)              # (B, C, H, W)
    time_steps = torch.linspace(sde.T, 1e-5, N, device=device)

    for i in range(N):
        t = time_steps[i]
        t_batch = torch.full((shape[0],), t, device=device)

        drift, diffusion = sde.drift_and_diffusion(x, t_batch)
        score = score_model(x, t_batch)

        # ODE drift: f(x,t) - 0.5 * g²(t) * score
        g_sq = diffusion[:, None, None, None] ** 2
        ode_drift = drift - 0.5 * g_sq * score          # (B, C, H, W)

        # Euler step (deterministic -- no noise term)
        x = x + ode_drift * dt                           # (B, C, H, W)

    return x  # (B, C, H, W)
```

---

## 6. Experimental Intuition

### 6.1 VP-SDE vs. VE-SDE in Practice

Song et al. (2021) found that VP-SDE generally produces better FID scores on image benchmarks, while VE-SDE can achieve better log-likelihoods. The VP-SDE's signal attenuation acts as implicit regularization, preventing the variance from growing without bound.

### 6.2 Reverse SDE vs. Probability Flow ODE

| Method | Stochastic? | Sample diversity | Sample quality | Likelihood | NFE |
|--------|------------|------------------|----------------|------------|-----|
| Reverse SDE | Yes | Higher | Good | Not exact | $N$ |
| Prob. Flow ODE | No | Lower (deterministic) | Comparable | Exact | $N$ (can use adaptive) |

In practice, the stochastic reverse SDE often produces higher-quality samples because the noise acts as a form of implicit annealing, correcting errors in the score estimate. The probability flow ODE is preferred when exact likelihoods are needed or when used with high-order ODE solvers.

### 6.3 Number of Function Evaluations (NFE)

The continuous-time formulation decouples training (which implicitly covers all noise levels) from sampling (which can use any number of discretization steps). Experiments show:

- **Euler-Maruyama with $N = 1000$**: Quality comparable to discrete DDPM with $T = 1000$.
- **Higher-order solvers (Heun, RK45) with $N = 50$--$200$**: Often sufficient for good quality, a 5--20x speedup.
- **Adaptive step-size ODE solvers**: Automatically select the number of steps, typically $\sim 100$--$200$ NFE for good quality.

### 6.4 Score Function Geometry

The score $\nabla_x \log p_t(x)$ points in the direction of increasing log-density. At high noise levels ($t \approx T$), $p_t$ is nearly Gaussian and the score points toward the origin. At low noise levels ($t \approx 0$), the score captures fine-grained structure of the data manifold. The denoising score matching objective asks the network to estimate this vector field at all noise levels simultaneously.

---

## 7. Connections

### 7.1 Connection to DDPM (Lecture 08a)

The VP-SDE is the continuous-time limit of DDPM:
- **Marginals match**: $q(x_t \mid x_0)$ in DDPM equals $p_{0t}(x_t \mid x_0)$ in VP-SDE when $\bar{\alpha}_t = e^{-\int_0^t \beta(s) ds}$.
- **Losses match**: $L_{\text{simple}}$ is denoising score matching with $\lambda(t) = \sigma^2(t)$.
- **Sampling**: DDPM sampling is Euler-Maruyama applied to the reverse VP-SDE with $N = T$ steps.

### 7.2 Connection to Normalizing Flows

The probability flow ODE defines a continuous normalizing flow (CNF):
- The ODE transforms the prior $p_T$ into the data distribution $p_0$.
- Unlike discrete normalizing flows (RealNVP, Glow), the architecture is unconstrained --- no need for invertibility or triangular Jacobians.
- The instantaneous change of variables formula allows exact likelihood computation without computing full Jacobians.

### 7.3 Connection to Optimal Transport

The probability flow ODE transport map $x_T \mapsto x_0$ defines a coupling between $p_T$ and $p_0$. While not the optimal transport map in general, it is related: the probability flow ODE tends to produce smoother, more direct transport paths than the stochastic reverse SDE.

### 7.4 Forward Reference: DDIM and Flow Matching (Lecture 08c)

DDIM (Song et al., 2021b) can be derived as a discretization of the probability flow ODE for the VP-SDE. Flow matching (Lipman et al., 2023) replaces the SDE framework entirely with a direct regression on a velocity field, yielding simpler training and straighter transport paths.

---

## 8. Paper Reading List

### Required Reading

1. **Song, Y., Sohl-Dickstein, J., Kingma, D. P., Kumar, A., Ermon, S., and Poole, B.** (2021). "Score-Based Generative Modeling through Stochastic Differential Equations." *ICLR 2021.*
   Focus: Sections 2-3 (VP-SDE, VE-SDE, reverse SDE, probability flow ODE). Study the unified framework and the connection to discrete models.

2. **Anderson, B. D. O.** (1982). "Reverse-time diffusion equation models." *Stochastic Processes and their Applications*, 12(3), 313-326.
   Focus: Theorem 1 (the reverse-time SDE). This is the foundational result enabling score-based generation.

### Recommended Reading

3. **Song, Y. and Ermon, S.** (2019). "Generative Modeling by Estimating Gradients of the Data Distribution." *NeurIPS 2019.*
   Focus: The original NCSN paper. Sections 3-4 on score matching with Langevin dynamics. Compare with the continuous-time formulation.

4. **Vincent, P.** (2011). "A Connection Between Score Matching and Denoising Autoencoders." *Neural Computation*, 23(7).
   Focus: The theorem connecting denoising autoencoders to score matching. This is the theoretical foundation for denoising score matching.

5. **Chen, R. T. Q., Rubanova, Y., Bettencourt, J., and Duvenaud, D.** (2018). "Neural Ordinary Differential Equations." *NeurIPS 2018.*
   Focus: Section 4 on continuous normalizing flows and the instantaneous change of variables formula.

---

## 9. Exercises

### Exercise 9.1: SDE Transition Kernels (Pen-and-Paper)

**(a)** Derive the transition kernel $p_{0t}(x_t \mid x_0)$ for the VE-SDE with $\sigma(t) = \sigma_{\min}(\sigma_{\max}/\sigma_{\min})^t$ and verify that $p_{0t}(x_t \mid x_0) = \mathcal{N}(x_0, [\sigma^2(t) - \sigma^2(0)] I)$.

**(b)** For the VP-SDE with linear $\beta(t) = \beta_{\min} + t(\beta_{\max} - \beta_{\min})$, compute $\bar{\alpha}_t = e^{-\int_0^t \beta(s) ds}$ in closed form. Verify that $\bar{\alpha}_0 = 1$ and compute $\bar{\alpha}_1$ for $\beta_{\min} = 0.1$, $\beta_{\max} = 20$.

**(c)** Show that the VP-SDE's stationary distribution (as $t \to \infty$) is $\mathcal{N}(0, I)$ by analyzing the mean and variance of $x_t \mid x_0$ in the limit.

### Exercise 9.2: Reverse SDE Derivation (Pen-and-Paper)

**(a)** Starting from the Fokker-Planck equation for the VP-SDE, derive the reverse-time drift explicitly. Write out the reverse SDE for VP-SDE.

**(b)** Verify that the probability flow ODE for the VP-SDE is:

$$\frac{dx}{dt} = -\frac{1}{2}\beta(t)\left[x + \nabla_x \log p_t(x)\right]$$

**(c)** Consider the special case where $p_0$ is a single Gaussian $\mathcal{N}(\mu_0, \Sigma_0)$. Compute $p_t$ exactly for the VP-SDE and verify that the reverse SDE reconstructs it correctly.

### Exercise 9.3: Score Matching Equivalences

**(a)** Prove that implicit score matching (Hyvarinen, 2005):

$$\mathcal{J}_{\text{ISM}}(\theta) = \mathbb{E}_{x \sim p}\!\left[\frac{1}{2}\|s_\theta(x)\|^2 + \nabla \cdot s_\theta(x)\right]$$

is equivalent to explicit score matching up to a constant. (Hint: integrate by parts.)

**(b)** Starting from the denoising score matching objective, show that for $p_{0t}(x_t \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_t}\, x_0, (1-\bar{\alpha}_t) I)$, the loss reduces to $L_{\text{simple}}$ with the substitution $s_\theta(x_t, t) = -\varepsilon_\theta(x_t, t) / \sqrt{1-\bar{\alpha}_t}$.

### Exercise 9.4: Implementation

**(a)** Implement the `VPSDE` class and verify that `marginal_prob` produces the correct mean and variance by empirically estimating them from 10,000 samples at various values of $t$.

**(b)** Implement both the Euler-Maruyama reverse SDE sampler and the probability flow ODE sampler. Using a trained score model, compare samples from both at $N \in \{50, 100, 500, 1000\}$ steps. Report visual quality and compute FID if possible.

**(c)** Implement exact log-likelihood computation via the probability flow ODE using the Hutchinson trace estimator for the divergence $\nabla \cdot \hat{f}$. Compute bits-per-dimension on CIFAR-10 test set.
