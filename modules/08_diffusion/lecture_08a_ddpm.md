# Lecture 08a: Denoising Diffusion Probabilistic Models (DDPM)

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** the forward diffusion process as a Markov chain of Gaussian perturbations and derive the closed-form marginal $q(x_t \mid x_0)$.
2. **Derive** the reverse posterior $q(x_{t-1} \mid x_t, x_0)$ and show it is Gaussian with tractable mean and variance.
3. **Derive** the variational lower bound $L_{\text{vlb}}$ and decompose it into per-timestep KL divergence terms.
4. **Prove** that the simplified loss $L_{\text{simple}} = \mathbb{E}\bigl[\|\varepsilon - \varepsilon_\theta(x_t, t)\|^2\bigr]$ is a reweighted version of $L_{\text{vlb}}$.
5. **Explain** the design of linear and cosine noise schedules and their impact on generation quality.
6. **Describe** the U-Net architecture used for noise prediction, including time conditioning and skip connections.
7. **Implement** DDPM training and sampling in PyTorch with correct shape management.

---

## 2. Motivation and Context

### 2.1 Historical Background

Generative modeling has seen successive paradigm shifts: from Boltzmann machines, through VAEs (Kingma & Welling, 2014) and GANs (Goodfellow et al., 2014), to normalizing flows (Rezende & Mohamed, 2015). Each framework trades off training stability, sample quality, and mode coverage differently. GANs produce sharp images but suffer from mode collapse and training instability. VAEs are stable but produce blurry samples. Normalizing flows require invertible architectures with expensive Jacobian computations.

Sohl-Dickstein et al. (2015) introduced diffusion probabilistic models, inspired by non-equilibrium thermodynamics: systematically destroy data with noise, then learn to reverse the destruction. The idea languished for five years until Ho, Jain, and Abbeel (2020) demonstrated that a carefully designed diffusion model --- DDPM --- produces samples rivaling GANs on image benchmarks, with the training stability of likelihood-based models.

### 2.2 Why This Matters

- **Training stability**: DDPM optimizes a simple MSE loss; no adversarial dynamics, no posterior collapse.
- **Mode coverage**: The stochastic reverse process naturally covers all modes of the data distribution.
- **Foundation for modern generative AI**: DALL-E 2, Stable Diffusion, Imagen, and video generation models all descend from the DDPM framework.
- **Theoretical elegance**: The derivation connects variational inference, stochastic processes, and score functions into one coherent framework.

---

## 3. Core Theory

### 3.1 Setup and Notation

Let $x_0 \sim q(x_0)$ denote data drawn from an unknown distribution (e.g., natural images). We define a discrete-time diffusion process indexed by $t \in \{0, 1, \ldots, T\}$, where $T$ is typically 1000.

**Notation conventions:**

- $\beta_t \in (0, 1)$: variance schedule at timestep $t$
- $\alpha_t = 1 - \beta_t$
- $\bar{\alpha}_t = \prod_{s=1}^{t} \alpha_s$: cumulative product of $\alpha$ values
- $\varepsilon \sim \mathcal{N}(0, I)$: standard Gaussian noise
- $x_t$: the noisy version of $x_0$ at timestep $t$

### 3.2 Forward Process

**Definition 3.1 (Forward Process).** The forward (diffusion) process is a Markov chain that gradually adds Gaussian noise:

$$q(x_t \mid x_{t-1}) = \mathcal{N}\bigl(x_t;\, \sqrt{1 - \beta_t}\, x_{t-1},\, \beta_t I\bigr)$$

Equivalently, the sampling rule is:

$$x_t = \sqrt{1 - \beta_t}\, x_{t-1} + \sqrt{\beta_t}\, \varepsilon_t, \quad \varepsilon_t \sim \mathcal{N}(0, I)$$

The joint forward process is:

$$q(x_{1:T} \mid x_0) = \prod_{t=1}^{T} q(x_t \mid x_{t-1})$$

**Interpretation:** At each step, the signal $x_{t-1}$ is shrunk by factor $\sqrt{\alpha_t}$ and independent noise of variance $\beta_t$ is added. For large $T$ and appropriate $\{\beta_t\}$, $x_T$ is approximately pure Gaussian noise.

### 3.3 Closed-Form Marginal: Deriving $q(x_t \mid x_0)$

**Theorem 3.2.** The marginal at any timestep $t$ can be written in closed form as:

$$q(x_t \mid x_0) = \mathcal{N}\bigl(x_t;\, \sqrt{\bar{\alpha}_t}\, x_0,\, (1 - \bar{\alpha}_t) I\bigr)$$

*Proof.* We proceed by induction on $t$.

**Base case ($t = 1$):** By definition, $q(x_1 \mid x_0) = \mathcal{N}(x_1; \sqrt{\alpha_1}\, x_0, \beta_1 I)$. Since $\bar{\alpha}_1 = \alpha_1$ and $1 - \bar{\alpha}_1 = 1 - \alpha_1 = \beta_1$, the claim holds.

**Inductive step:** Assume $q(x_{t-1} \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_{t-1}}\, x_0, (1 - \bar{\alpha}_{t-1}) I)$. We can write:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}}\, x_0 + \sqrt{1 - \bar{\alpha}_{t-1}}\, \varepsilon_1, \quad \varepsilon_1 \sim \mathcal{N}(0, I)$$

Substituting into the forward step:

$$x_t = \sqrt{\alpha_t}\, x_{t-1} + \sqrt{\beta_t}\, \varepsilon_2, \quad \varepsilon_2 \sim \mathcal{N}(0, I)$$

$$= \sqrt{\alpha_t}\bigl(\sqrt{\bar{\alpha}_{t-1}}\, x_0 + \sqrt{1 - \bar{\alpha}_{t-1}}\, \varepsilon_1\bigr) + \sqrt{\beta_t}\, \varepsilon_2$$

$$= \sqrt{\alpha_t \bar{\alpha}_{t-1}}\, x_0 + \sqrt{\alpha_t(1 - \bar{\alpha}_{t-1})}\, \varepsilon_1 + \sqrt{\beta_t}\, \varepsilon_2$$

Since $\varepsilon_1$ and $\varepsilon_2$ are independent standard Gaussians, the sum of the noise terms is Gaussian with variance:

$$\alpha_t(1 - \bar{\alpha}_{t-1}) + \beta_t = \alpha_t - \alpha_t \bar{\alpha}_{t-1} + 1 - \alpha_t = 1 - \alpha_t \bar{\alpha}_{t-1} = 1 - \bar{\alpha}_t$$

where we used $\beta_t = 1 - \alpha_t$ and $\bar{\alpha}_t = \alpha_t \bar{\alpha}_{t-1}$. Therefore:

$$x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \varepsilon, \quad \varepsilon \sim \mathcal{N}(0, I) \qquad \blacksquare$$

**Remark.** This is the "reparameterization trick" for diffusion: we can jump directly from $x_0$ to any $x_t$ in one step, which is crucial for efficient training.

### 3.4 Signal-to-Noise Ratio

**Definition 3.3 (SNR).** The signal-to-noise ratio at timestep $t$ is:

$$\text{SNR}(t) = \frac{\bar{\alpha}_t}{1 - \bar{\alpha}_t}$$

As $t$ increases from $0$ to $T$:

- $\bar{\alpha}_t$ decreases from $1$ toward $0$.
- $\text{SNR}(t)$ decreases from $\infty$ toward $0$.
- The signal is progressively destroyed and replaced by noise.

### 3.5 Reverse Process

The reverse process aims to denoise from $x_T \sim \mathcal{N}(0, I)$ back to $x_0 \sim q(x_0)$. We parametrize:

$$p_\theta(x_{0:T}) = p(x_T) \prod_{t=1}^{T} p_\theta(x_{t-1} \mid x_t)$$

where $p(x_T) = \mathcal{N}(0, I)$ and:

$$p_\theta(x_{t-1} \mid x_t) = \mathcal{N}\bigl(x_{t-1};\, \mu_\theta(x_t, t),\, \sigma_t^2 I\bigr)$$

The key theoretical result is that for small $\beta_t$, the true reverse conditional $q(x_{t-1} \mid x_t)$ is approximately Gaussian. We can compute the exact reverse posterior when we also condition on $x_0$.

### 3.6 Deriving the Reverse Posterior $q(x_{t-1} \mid x_t, x_0)$

**Theorem 3.4.** The posterior of the forward process, conditioned on both endpoints, is:

$$q(x_{t-1} \mid x_t, x_0) = \mathcal{N}(x_{t-1};\, \tilde{\mu}_t(x_t, x_0),\, \tilde{\beta}_t I)$$

where:

$$\tilde{\mu}_t(x_t, x_0) = \frac{\sqrt{\bar{\alpha}_{t-1}}\, \beta_t}{1 - \bar{\alpha}_t}\, x_0 + \frac{\sqrt{\alpha_t}(1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t}\, x_t$$

$$\tilde{\beta}_t = \frac{(1 - \bar{\alpha}_{t-1})}{(1 - \bar{\alpha}_t)} \beta_t$$

*Proof.* By Bayes' rule:

$$q(x_{t-1} \mid x_t, x_0) = \frac{q(x_t \mid x_{t-1}, x_0)\, q(x_{t-1} \mid x_0)}{q(x_t \mid x_0)}$$

Since the forward process is Markov, $q(x_t \mid x_{t-1}, x_0) = q(x_t \mid x_{t-1})$. All three distributions on the right-hand side are Gaussian:

$$q(x_t \mid x_{t-1}) = \mathcal{N}\bigl(\sqrt{\alpha_t}\, x_{t-1}, \beta_t I\bigr)$$

$$q(x_{t-1} \mid x_0) = \mathcal{N}\bigl(\sqrt{\bar{\alpha}_{t-1}}\, x_0, (1 - \bar{\alpha}_{t-1}) I\bigr)$$

$$q(x_t \mid x_0) = \mathcal{N}\bigl(\sqrt{\bar{\alpha}_t}\, x_0, (1 - \bar{\alpha}_t) I\bigr)$$

Taking the product of the numerator Gaussians and completing the square in $x_{t-1}$:

$$\log q(x_{t-1} \mid x_t, x_0) \propto -\frac{1}{2}\left[\frac{(x_t - \sqrt{\alpha_t}\, x_{t-1})^2}{\beta_t} + \frac{(x_{t-1} - \sqrt{\bar{\alpha}_{t-1}}\, x_0)^2}{1 - \bar{\alpha}_{t-1}}\right]$$

Expanding and collecting terms in $x_{t-1}$:

$$= -\frac{1}{2}\left[x_{t-1}^2 \left(\frac{\alpha_t}{\beta_t} + \frac{1}{1 - \bar{\alpha}_{t-1}}\right) - 2 x_{t-1}\left(\frac{\sqrt{\alpha_t}\, x_t}{\beta_t} + \frac{\sqrt{\bar{\alpha}_{t-1}}\, x_0}{1 - \bar{\alpha}_{t-1}}\right) + C\right]$$

where $C$ does not depend on $x_{t-1}$. This is a quadratic in $x_{t-1}$, hence Gaussian. The precision (inverse variance) is:

$$\tilde{\beta}_t^{-1} = \frac{\alpha_t}{\beta_t} + \frac{1}{1 - \bar{\alpha}_{t-1}} = \frac{\alpha_t(1 - \bar{\alpha}_{t-1}) + \beta_t}{\beta_t(1 - \bar{\alpha}_{t-1})} = \frac{1 - \bar{\alpha}_t}{\beta_t(1 - \bar{\alpha}_{t-1})}$$

Therefore:

$$\tilde{\beta}_t = \frac{\beta_t(1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t}$$

The mean is $\tilde{\beta}_t$ times the linear coefficient:

$$\tilde{\mu}_t = \tilde{\beta}_t \left(\frac{\sqrt{\alpha_t}\, x_t}{\beta_t} + \frac{\sqrt{\bar{\alpha}_{t-1}}\, x_0}{1 - \bar{\alpha}_{t-1}}\right) = \frac{\sqrt{\alpha_t}(1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t}\, x_t + \frac{\sqrt{\bar{\alpha}_{t-1}}\, \beta_t}{1 - \bar{\alpha}_t}\, x_0 \qquad \blacksquare$$

### 3.7 Variational Lower Bound

**Theorem 3.5.** The negative log-likelihood of the model admits the variational bound:

$$-\log p_\theta(x_0) \leq L_{\text{vlb}} = \underbrace{D_{\text{KL}}\bigl(q(x_T \mid x_0)\, \|\, p(x_T)\bigr)}_{L_T} + \sum_{t=2}^{T} \underbrace{D_{\text{KL}}\bigl(q(x_{t-1} \mid x_t, x_0)\, \|\, p_\theta(x_{t-1} \mid x_t)\bigr)}_{L_{t-1}} \underbrace{-\, \mathbb{E}_{q(x_1 \mid x_0)}\bigl[\log p_\theta(x_0 \mid x_1)\bigr]}_{L_0}$$

*Proof.* Starting from the standard variational bound:

$$-\log p_\theta(x_0) \leq -\mathbb{E}_{q(x_{1:T} \mid x_0)}\left[\log \frac{p_\theta(x_{0:T})}{q(x_{1:T} \mid x_0)}\right]$$

Expanding the joint distributions:

$$= -\mathbb{E}_q\left[\log \frac{p(x_T) \prod_{t=1}^{T} p_\theta(x_{t-1} \mid x_t)}{\prod_{t=1}^{T} q(x_t \mid x_{t-1})}\right]$$

$$= -\mathbb{E}_q\left[\log p(x_T) + \sum_{t=1}^{T} \log \frac{p_\theta(x_{t-1} \mid x_t)}{q(x_t \mid x_{t-1})}\right]$$

Rewriting $q(x_t \mid x_{t-1})$ using Bayes' rule for $t \geq 2$:

$$q(x_t \mid x_{t-1}) = \frac{q(x_{t-1} \mid x_t, x_0)\, q(x_t \mid x_0)}{q(x_{t-1} \mid x_0)}$$

After telescoping the $q(x_t \mid x_0) / q(x_{t-1} \mid x_0)$ ratios:

$$L_{\text{vlb}} = D_{\text{KL}}\bigl(q(x_T \mid x_0) \| p(x_T)\bigr) + \sum_{t=2}^{T} D_{\text{KL}}\bigl(q(x_{t-1} \mid x_t, x_0) \| p_\theta(x_{t-1} \mid x_t)\bigr) - \mathbb{E}_q\bigl[\log p_\theta(x_0 \mid x_1)\bigr]$$

Note that $L_T$ is constant (no learnable parameters) and $L_0$ is a reconstruction term. The terms $L_{t-1}$ for $t = 2, \ldots, T$ are KL divergences between Gaussians, which have closed form. $\blacksquare$

### 3.8 KL Between Gaussians and the Per-Timestep Loss

Since both $q(x_{t-1} \mid x_t, x_0)$ and $p_\theta(x_{t-1} \mid x_t)$ are Gaussian (with the same variance $\tilde{\beta}_t$ if we fix it), the KL divergence simplifies to:

$$L_{t-1} = D_{\text{KL}}\bigl(q(x_{t-1} \mid x_t, x_0)\, \|\, p_\theta(x_{t-1} \mid x_t)\bigr) = \frac{1}{2\tilde{\beta}_t} \bigl\|\tilde{\mu}_t(x_t, x_0) - \mu_\theta(x_t, t)\bigr\|^2 + C$$

where $C$ is a constant not depending on $\theta$.

### 3.9 From Mean Prediction to Noise Prediction

Since $x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1 - \bar{\alpha}_t}\, \varepsilon$, we can express $x_0$ as:

$$x_0 = \frac{x_t - \sqrt{1 - \bar{\alpha}_t}\, \varepsilon}{\sqrt{\bar{\alpha}_t}}$$

Substituting into $\tilde{\mu}_t$:

$$\tilde{\mu}_t = \frac{1}{\sqrt{\alpha_t}}\left(x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}}\, \varepsilon\right)$$

*Derivation:*

$$\tilde{\mu}_t = \frac{\sqrt{\alpha_t}(1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t} x_t + \frac{\sqrt{\bar{\alpha}_{t-1}} \beta_t}{1 - \bar{\alpha}_t} \cdot \frac{x_t - \sqrt{1 - \bar{\alpha}_t}\,\varepsilon}{\sqrt{\bar{\alpha}_t}}$$

$$= \frac{\sqrt{\alpha_t}(1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t} x_t + \frac{\beta_t}{(1 - \bar{\alpha}_t)\sqrt{\alpha_t}} x_t - \frac{\beta_t}{\sqrt{\alpha_t}\sqrt{1 - \bar{\alpha}_t}} \varepsilon$$

For the first two $x_t$ terms:

$$\frac{\sqrt{\alpha_t}(1 - \bar{\alpha}_{t-1})}{1 - \bar{\alpha}_t} + \frac{\beta_t}{(1 - \bar{\alpha}_t)\sqrt{\alpha_t}} = \frac{\alpha_t(1 - \bar{\alpha}_{t-1}) + \beta_t}{(1 - \bar{\alpha}_t)\sqrt{\alpha_t}} = \frac{1 - \bar{\alpha}_t}{(1 - \bar{\alpha}_t)\sqrt{\alpha_t}} = \frac{1}{\sqrt{\alpha_t}}$$

Therefore:

$$\tilde{\mu}_t = \frac{1}{\sqrt{\alpha_t}}\left(x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}}\, \varepsilon\right)$$

If we parametrize the model to predict the noise $\varepsilon_\theta(x_t, t)$, we set:

$$\mu_\theta(x_t, t) = \frac{1}{\sqrt{\alpha_t}}\left(x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}}\, \varepsilon_\theta(x_t, t)\right)$$

Substituting into $L_{t-1}$:

$$L_{t-1} = \frac{\beta_t^2}{2\tilde{\beta}_t \alpha_t (1 - \bar{\alpha}_t)} \bigl\|\varepsilon - \varepsilon_\theta(x_t, t)\bigr\|^2$$

### 3.10 The Simplified Loss $L_{\text{simple}}$

Ho et al. (2020) found that dropping the weighting factor and simply training with:

$$L_{\text{simple}} = \mathbb{E}_{t \sim \mathcal{U}\{1,T\},\, x_0,\, \varepsilon}\bigl[\|\varepsilon - \varepsilon_\theta(x_t, t)\|^2\bigr]$$

yields better sample quality in practice. This is a **reweighted** version of $L_{\text{vlb}}$ where the per-timestep weight is:

$$w_t^{\text{vlb}} = \frac{\beta_t^2}{2\tilde{\beta}_t \alpha_t (1 - \bar{\alpha}_t)}, \qquad w_t^{\text{simple}} = 1$$

The simplified weighting up-weights loss terms at small $t$ (low noise) relative to $L_{\text{vlb}}$, encouraging the model to focus on fine details.

### 3.11 Noise Schedules

**Linear schedule (Ho et al., 2020):** $\beta_t$ increases linearly from $\beta_1 = 10^{-4}$ to $\beta_T = 0.02$:

$$\beta_t = \beta_1 + \frac{t - 1}{T - 1}(\beta_T - \beta_1)$$

This results in $\bar{\alpha}_T \approx 0$, but the SNR drops too quickly in later timesteps, wasting capacity on heavily noised inputs.

**Cosine schedule (Nichol & Dhariwal, 2021):** Define $\bar{\alpha}_t$ directly through a cosine function:

$$\bar{\alpha}_t = \frac{f(t)}{f(0)}, \quad f(t) = \cos^2\!\left(\frac{t/T + s}{1 + s} \cdot \frac{\pi}{2}\right)$$

where $s = 0.008$ is a small offset to prevent $\beta_t$ from being too small near $t = 0$. The $\beta_t$ values are then:

$$\beta_t = 1 - \frac{\bar{\alpha}_t}{\bar{\alpha}_{t-1}}, \quad \text{clipped to } [0, 0.999]$$

The cosine schedule distributes the SNR more uniformly across timesteps, improving sample quality.

---

## 4. Algorithmic Derivation

### 4.1 DDPM Training Algorithm

```
Algorithm 1: DDPM Training
─────────────────────────────────────────
Input: dataset D, noise predictor ε_θ, schedule {β_t}_{t=1}^T, learning rate η
Precompute: α_t = 1 - β_t, ᾱ_t = ∏_{s=1}^t α_s

repeat:
    x_0 ~ D                          # Sample a data point
    t ~ Uniform({1, ..., T})          # Sample a random timestep
    ε ~ N(0, I)                       # Sample noise
    x_t = √ᾱ_t · x_0 + √(1-ᾱ_t) · ε  # Closed-form noising
    L = ||ε - ε_θ(x_t, t)||²         # Compute loss
    θ ← θ - η · ∇_θ L               # Gradient step
until converged
```

**Complexity per step:** One forward pass through $\varepsilon_\theta$ (typically a U-Net, $O(CHW)$ for images of size $H \times W$ with $C$ channels in the widest layer) plus one backward pass of equal cost. The closed-form noising is $O(d)$ where $d$ is data dimensionality.

### 4.2 DDPM Sampling Algorithm

```
Algorithm 2: DDPM Sampling
─────────────────────────────────────────
Input: trained noise predictor ε_θ, schedule {β_t}_{t=1}^T
Precompute: α_t, ᾱ_t, σ_t = √β_t  (or σ_t = √β̃_t)

x_T ~ N(0, I)                        # Start from pure noise
for t = T, T-1, ..., 1:
    z ~ N(0, I)  if t > 1  else z = 0
    x_{t-1} = (1/√α_t)(x_t - (β_t/√(1-ᾱ_t)) · ε_θ(x_t, t)) + σ_t · z
return x_0
```

**Complexity:** $T$ sequential forward passes through $\varepsilon_\theta$. For $T = 1000$ and a U-Net with $\sim 35$M parameters on $32 \times 32$ images, this takes several seconds on a modern GPU. The sequential nature is the primary bottleneck.

---

## 5. PyTorch Implementation

### 5.1 Noise Schedule Utilities

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

def linear_schedule(T: int, beta_start: float = 1e-4, beta_end: float = 0.02) -> torch.Tensor:
    """Linear noise schedule from Ho et al. (2020).

    Returns:
        betas: (T,) tensor of noise variances
    """
    return torch.linspace(beta_start, beta_end, T)  # (T,)

def cosine_schedule(T: int, s: float = 0.008) -> torch.Tensor:
    """Cosine noise schedule from Nichol & Dhariwal (2021).

    Returns:
        betas: (T,) tensor of noise variances
    """
    steps = torch.arange(T + 1, dtype=torch.float64)           # (T+1,)
    f = torch.cos(((steps / T) + s) / (1 + s) * (math.pi / 2)) ** 2  # (T+1,)
    alphas_cumprod = f / f[0]                                   # (T+1,)
    betas = 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])      # (T,)
    return betas.clip(0, 0.999).float()                         # (T,)
```

### 5.2 DDPM Module

```python
class DDPM(nn.Module):
    """Denoising Diffusion Probabilistic Model.

    Wraps a noise prediction network and handles the forward/reverse processes.
    """

    def __init__(self, eps_model: nn.Module, T: int = 1000, schedule: str = "linear"):
        super().__init__()
        self.eps_model = eps_model  # ε_θ(x_t, t) -> predicted noise
        self.T = T

        # Compute schedule quantities
        if schedule == "linear":
            betas = linear_schedule(T)                # (T,)
        elif schedule == "cosine":
            betas = cosine_schedule(T)                # (T,)
        else:
            raise ValueError(f"Unknown schedule: {schedule}")

        alphas = 1.0 - betas                          # (T,)
        alphas_cumprod = torch.cumprod(alphas, dim=0)  # (T,) = ᾱ_t
        alphas_cumprod_prev = F.pad(alphas_cumprod[:-1], (1, 0), value=1.0)  # (T,) = ᾱ_{t-1}

        # Register as buffers (not parameters) so they move with .to(device)
        self.register_buffer("betas", betas)
        self.register_buffer("alphas", alphas)
        self.register_buffer("alphas_cumprod", alphas_cumprod)
        self.register_buffer("alphas_cumprod_prev", alphas_cumprod_prev)
        self.register_buffer("sqrt_alphas_cumprod", torch.sqrt(alphas_cumprod))
        self.register_buffer("sqrt_one_minus_alphas_cumprod", torch.sqrt(1.0 - alphas_cumprod))
        self.register_buffer("sqrt_recip_alphas", 1.0 / torch.sqrt(alphas))

        # Posterior variance: β̃_t = β_t * (1 - ᾱ_{t-1}) / (1 - ᾱ_t)
        posterior_variance = betas * (1.0 - alphas_cumprod_prev) / (1.0 - alphas_cumprod)
        self.register_buffer("posterior_variance", posterior_variance)

    def q_sample(self, x0: torch.Tensor, t: torch.Tensor, noise: torch.Tensor = None) -> torch.Tensor:
        """Forward process: sample x_t given x_0 using closed-form marginal.

        Args:
            x0: (B, C, H, W) clean images
            t:  (B,) integer timesteps in [0, T-1]
            noise: (B, C, H, W) optional pre-sampled noise

        Returns:
            xt: (B, C, H, W) noisy images at timestep t
        """
        if noise is None:
            noise = torch.randn_like(x0)  # (B, C, H, W)

        # Gather schedule values for each sample in the batch
        sqrt_alpha_bar = self.sqrt_alphas_cumprod[t]               # (B,)
        sqrt_one_minus_alpha_bar = self.sqrt_one_minus_alphas_cumprod[t]  # (B,)

        # Reshape for broadcasting: (B,) -> (B, 1, 1, 1)
        sqrt_alpha_bar = sqrt_alpha_bar[:, None, None, None]
        sqrt_one_minus_alpha_bar = sqrt_one_minus_alpha_bar[:, None, None, None]

        return sqrt_alpha_bar * x0 + sqrt_one_minus_alpha_bar * noise  # (B, C, H, W)

    def compute_loss(self, x0: torch.Tensor) -> torch.Tensor:
        """Compute L_simple = E[||ε - ε_θ(x_t, t)||²].

        Args:
            x0: (B, C, H, W) clean images

        Returns:
            loss: scalar tensor
        """
        B = x0.shape[0]
        t = torch.randint(0, self.T, (B,), device=x0.device)  # (B,)
        noise = torch.randn_like(x0)                           # (B, C, H, W)
        xt = self.q_sample(x0, t, noise)                       # (B, C, H, W)
        eps_pred = self.eps_model(xt, t)                        # (B, C, H, W)
        return F.mse_loss(eps_pred, noise)                      # scalar

    @torch.no_grad()
    def p_sample(self, xt: torch.Tensor, t: int) -> torch.Tensor:
        """Single reverse step: sample x_{t-1} from p_θ(x_{t-1}|x_t).

        Args:
            xt: (B, C, H, W) noisy images at timestep t
            t:  integer timestep

        Returns:
            x_{t-1}: (B, C, H, W) denoised one step
        """
        B = xt.shape[0]
        t_batch = torch.full((B,), t, device=xt.device, dtype=torch.long)

        eps_pred = self.eps_model(xt, t_batch)  # (B, C, H, W)

        # Compute the mean: μ_θ = (1/√α_t)(x_t - β_t/√(1-ᾱ_t) · ε_θ)
        coeff = self.betas[t] / self.sqrt_one_minus_alphas_cumprod[t]
        mean = self.sqrt_recip_alphas[t] * (xt - coeff * eps_pred)  # (B, C, H, W)

        if t > 0:
            noise = torch.randn_like(xt)  # (B, C, H, W)
            sigma = torch.sqrt(self.posterior_variance[t])
            return mean + sigma * noise   # (B, C, H, W)
        else:
            return mean                   # (B, C, H, W)

    @torch.no_grad()
    def sample(self, shape: tuple, device: torch.device) -> torch.Tensor:
        """Generate samples by running the full reverse process.

        Args:
            shape: (B, C, H, W) desired output shape
            device: torch device

        Returns:
            x0: (B, C, H, W) generated samples
        """
        x = torch.randn(shape, device=device)  # (B, C, H, W)

        for t in reversed(range(self.T)):
            x = self.p_sample(x, t)  # (B, C, H, W)

        return x  # (B, C, H, W)
```

### 5.3 Simplified U-Net for Noise Prediction

```python
class SinusoidalPositionEmbedding(nn.Module):
    """Sinusoidal timestep embedding, analogous to Transformer position encoding."""

    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim

    def forward(self, t: torch.Tensor) -> torch.Tensor:
        """
        Args:
            t: (B,) integer timesteps

        Returns:
            emb: (B, dim) sinusoidal embeddings
        """
        device = t.device
        half_dim = self.dim // 2
        emb_scale = math.log(10000) / (half_dim - 1)
        emb = torch.exp(torch.arange(half_dim, device=device) * -emb_scale)  # (dim/2,)
        emb = t[:, None].float() * emb[None, :]   # (B, dim/2)
        emb = torch.cat([emb.sin(), emb.cos()], dim=-1)  # (B, dim)
        return emb

class ResBlock(nn.Module):
    """Residual block with time conditioning."""

    def __init__(self, in_ch: int, out_ch: int, time_dim: int):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1)
        self.norm1 = nn.GroupNorm(8, out_ch)
        self.norm2 = nn.GroupNorm(8, out_ch)
        self.time_mlp = nn.Sequential(
            nn.SiLU(),
            nn.Linear(time_dim, out_ch),
        )
        self.skip = nn.Conv2d(in_ch, out_ch, 1) if in_ch != out_ch else nn.Identity()

    def forward(self, x: torch.Tensor, t_emb: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, in_ch, H, W) input features
            t_emb: (B, time_dim) timestep embedding

        Returns:
            out: (B, out_ch, H, W)
        """
        h = self.norm1(self.conv1(x))             # (B, out_ch, H, W)
        h = F.silu(h)
        h = h + self.time_mlp(t_emb)[:, :, None, None]  # broadcast time to spatial
        h = self.norm2(self.conv2(h))             # (B, out_ch, H, W)
        h = F.silu(h)
        return h + self.skip(x)                    # (B, out_ch, H, W)

class SimpleUNet(nn.Module):
    """Minimal U-Net for noise prediction on 32x32 images.

    Architecture:
        Encoder: 3->64->128->256 with 2x downsampling
        Bottleneck: 256->256
        Decoder: 256->128->64->3 with 2x upsampling + skip connections
    """

    def __init__(self, in_channels: int = 3, time_dim: int = 256):
        super().__init__()
        self.time_embed = nn.Sequential(
            SinusoidalPositionEmbedding(time_dim),
            nn.Linear(time_dim, time_dim),
            nn.SiLU(),
            nn.Linear(time_dim, time_dim),
        )

        # Encoder
        self.enc1 = ResBlock(in_channels, 64, time_dim)   # 32x32 -> 32x32
        self.enc2 = ResBlock(64, 128, time_dim)            # 16x16 -> 16x16
        self.enc3 = ResBlock(128, 256, time_dim)           # 8x8 -> 8x8

        self.down1 = nn.Conv2d(64, 64, 3, stride=2, padding=1)    # 32->16
        self.down2 = nn.Conv2d(128, 128, 3, stride=2, padding=1)  # 16->8

        # Bottleneck
        self.bottleneck = ResBlock(256, 256, time_dim)     # 8x8

        # Decoder
        self.up2 = nn.ConvTranspose2d(256, 128, 2, stride=2)  # 8->16
        self.dec2 = ResBlock(256, 128, time_dim)               # concat skip: 128+128=256->128
        self.up1 = nn.ConvTranspose2d(128, 64, 2, stride=2)   # 16->32
        self.dec1 = ResBlock(128, 64, time_dim)                # concat skip: 64+64=128->64

        self.out_conv = nn.Conv2d(64, in_channels, 1)          # 64->3

    def forward(self, x: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, C, H, W) noisy input (e.g., B, 3, 32, 32)
            t: (B,) integer timesteps

        Returns:
            eps_pred: (B, C, H, W) predicted noise
        """
        t_emb = self.time_embed(t)                          # (B, time_dim)

        # Encoder
        h1 = self.enc1(x, t_emb)                            # (B, 64, 32, 32)
        h2 = self.enc2(self.down1(h1), t_emb)               # (B, 128, 16, 16)
        h3 = self.enc3(self.down2(h2), t_emb)               # (B, 256, 8, 8)

        # Bottleneck
        h = self.bottleneck(h3, t_emb)                      # (B, 256, 8, 8)

        # Decoder with skip connections
        h = self.up2(h)                                      # (B, 128, 16, 16)
        h = self.dec2(torch.cat([h, h2], dim=1), t_emb)     # (B, 128, 16, 16)
        h = self.up1(h)                                      # (B, 64, 32, 32)
        h = self.dec1(torch.cat([h, h1], dim=1), t_emb)     # (B, 64, 32, 32)

        return self.out_conv(h)                              # (B, 3, 32, 32)
```

### 5.4 Training Loop

```python
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader

def train_ddpm(
    epochs: int = 100,
    batch_size: int = 128,
    lr: float = 2e-4,
    T: int = 1000,
    device: str = "cuda",
):
    """Train DDPM on CIFAR-10."""
    # Data
    transform = transforms.Compose([
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),  # scale to [-1, 1]
    ])
    dataset = torchvision.datasets.CIFAR10(
        root="./data", train=True, download=True, transform=transform
    )
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=4)

    # Model
    unet = SimpleUNet(in_channels=3, time_dim=256).to(device)
    ddpm = DDPM(unet, T=T, schedule="cosine").to(device)
    optimizer = torch.optim.Adam(ddpm.parameters(), lr=lr)

    # Training
    for epoch in range(epochs):
        total_loss = 0.0
        for batch_idx, (images, _) in enumerate(loader):
            images = images.to(device)              # (B, 3, 32, 32)
            loss = ddpm.compute_loss(images)         # scalar
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(ddpm.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(loader)
        print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")

        # Sample every 10 epochs
        if (epoch + 1) % 10 == 0:
            samples = ddpm.sample((16, 3, 32, 32), device=device)  # (16, 3, 32, 32)
            # Rescale from [-1, 1] to [0, 1] for visualization
            samples = (samples.clamp(-1, 1) + 1) / 2
            grid = torchvision.utils.make_grid(samples, nrow=4)
            torchvision.utils.save_image(grid, f"samples_epoch_{epoch+1}.png")

    return ddpm
```

---

## 6. Experimental Intuition

### 6.1 Effect of the Number of Timesteps $T$

| $T$ | Training cost per epoch | Sampling cost | FID (CIFAR-10) | Notes |
|-----|------------------------|---------------|-----------------|-------|
| 100 | Same (1 step/sample) | 100 NFE | ~15-20 | Too few steps for high quality |
| 1000 | Same | 1000 NFE | ~3-5 | Standard setting |
| 4000 | Same | 4000 NFE | ~3-4 | Marginal improvement, much slower sampling |

**Key insight:** Training cost is independent of $T$ (we always take one random timestep per sample). Sampling cost scales linearly with $T$. The DDPM framework thus has a fundamental asymmetry: cheap training, expensive sampling.

### 6.2 Noise Schedule Comparison

- **Linear schedule**: SNR drops rapidly in later timesteps. The model wastes capacity on highly noised inputs where little structure remains. Produces good results on $32 \times 32$ but degrades at higher resolutions.
- **Cosine schedule**: SNR decreases more gradually, maintaining useful signal for longer. Consistently better FID at all resolutions. Now the default in most implementations.

### 6.3 What Does the Model Learn at Different Timesteps?

- **Large $t$ (heavy noise)**: Model learns global structure --- object placement, rough color palette, scene composition. The loss gradients here teach coarse features.
- **Small $t$ (light noise)**: Model learns fine details --- textures, edges, subtle color transitions. This is where most perceptual quality comes from.
- **$L_{\text{simple}}$ weighting**: By up-weighting small-$t$ terms relative to $L_{\text{vlb}}$, the model allocates more capacity to fine details, explaining the improved perceptual quality despite potentially worse log-likelihood.

### 6.4 U-Net Architecture Design Choices

- **Time embedding**: The sinusoidal embedding followed by an MLP (analogous to Transformer positional encoding) gives the model a smooth representation of the timestep.
- **GroupNorm over BatchNorm**: DDPM training uses relatively small effective batch sizes (since each sample has a different timestep). GroupNorm is more stable in this regime.
- **Skip connections**: Essential for preserving fine spatial details through the encoder-decoder pathway. Without skip connections, sample quality degrades significantly.
- **Self-attention at intermediate resolutions**: Adding attention layers at $16 \times 16$ or $8 \times 8$ improves FID by ~10-15% on CIFAR-10 by capturing long-range dependencies.

---

## 7. Connections

### 7.1 Connection to VAEs

DDPM can be viewed as a hierarchical VAE with $T$ levels of latent variables $x_1, \ldots, x_T$:

- The encoder $q(x_{1:T} \mid x_0)$ is fixed (not learned), unlike a standard VAE.
- The decoder $p_\theta(x_{0:T})$ is learned.
- The ELBO decomposes into per-level KL terms, just as in a hierarchical VAE.

The key difference: fixing the encoder eliminates posterior collapse and allows a simple MSE training objective.

### 7.2 Connection to Score Matching

The noise prediction $\varepsilon_\theta(x_t, t)$ is directly related to the score function:

$$\nabla_{x_t} \log q(x_t \mid x_0) = -\frac{x_t - \sqrt{\bar{\alpha}_t}\, x_0}{\sqrt{1 - \bar{\alpha}_t}} = -\frac{\varepsilon}{\sqrt{1 - \bar{\alpha}_t}}$$

Therefore, $\varepsilon_\theta(x_t, t) \approx -\sqrt{1 - \bar{\alpha}_t}\, \nabla_{x_t} \log q_t(x_t)$. This connection to score-based models is explored in depth in Lecture 08b.

### 7.3 Connection to Denoising Autoencoders

Vincent (2011) showed that denoising autoencoders learn the score function. DDPM formalizes this into a principled generative model by:

1. Using a sequence of noise levels rather than a single one.
2. Providing a well-defined sampling procedure (reverse process).
3. Connecting training to a variational bound on log-likelihood.

### 7.4 Forward Reference: Faster Sampling

The main drawback of DDPM is slow sampling ($T$ sequential forward passes). Lecture 08c will show how DDIM (Song et al., 2021) enables deterministic sampling in far fewer steps, and how flow matching provides an alternative formulation with straight-line trajectories.

---

## 8. Paper Reading List

### Required Reading

1. **Ho, J., Jain, A., and Abbeel, P.** (2020). "Denoising Diffusion Probabilistic Models." *NeurIPS 2020.*
   Focus: Sections 2-4 (forward process, reverse process, loss derivation). Study Algorithm 1 (training) and Algorithm 2 (sampling) carefully. Compare with the implementation in this lecture.

2. **Sohl-Dickstein, J., Weiss, E., Maheswaranathan, N., and Ganguli, S.** (2015). "Deep Unsupervised Learning using Nonequilibrium Thermodynamics." *ICML 2015.*
   Focus: Section 2 (the thermodynamic motivation). This paper introduced diffusion models but with a different loss formulation. Understand how Ho et al. simplified the approach.

### Recommended Reading

3. **Nichol, A. and Dhariwal, P.** (2021). "Improved Denoising Diffusion Probabilistic Models." *ICML 2021.*
   Focus: Cosine schedule (Section 3.2), learned variances (Section 3.1), and the hybrid loss $L_{\text{hybrid}} = L_{\text{simple}} + \lambda L_{\text{vlb}}$.

4. **Luo, C.** (2022). "Understanding Diffusion Models: A Unified Perspective." *arXiv:2208.11970.*
   Focus: Excellent tutorial that provides a unified derivation connecting VAEs, score matching, and diffusion models.

---

## 9. Exercises

### Exercise 9.1: Forward Process Properties (Pen-and-Paper)

**(a)** Starting from $q(x_t \mid x_{t-1}) = \mathcal{N}(\sqrt{1 - \beta_t}\, x_{t-1}, \beta_t I)$, show that $\mathbb{E}[x_t \mid x_0] = \sqrt{\bar{\alpha}_t}\, x_0$ and $\text{Var}[x_t \mid x_0] = (1 - \bar{\alpha}_t) I$ without using the reparameterization trick (use the law of iterated expectations instead).

**(b)** Prove that the forward process preserves the $L^2$ norm in expectation if and only if $\beta_t = 0$ for all $t$. That is, show $\mathbb{E}[\|x_t\|^2] < \mathbb{E}[\|x_0\|^2]$ for any $\beta_t > 0$.

**(c)** Compute the mutual information $I(x_0; x_t)$ for Gaussian $x_0$ and show it decreases monotonically with $t$.

### Exercise 9.2: VLB Decomposition (Pen-and-Paper)

**(a)** Fill in all the algebraic steps in the telescoping argument of Theorem 3.5 that yields the VLB decomposition. Start from the ELBO and show every intermediate step.

**(b)** Show that $L_T$ is constant with respect to $\theta$ and compute its value for the cosine schedule with $T = 1000$.

**(c)** Compute the per-timestep weight ratio $w_t^{\text{vlb}} / w_t^{\text{simple}}$ and plot it as a function of $t$ for the linear schedule. Explain why $L_{\text{simple}}$ emphasizes fine details.

### Exercise 9.3: Alternative Parameterizations

**(a)** Instead of predicting noise $\varepsilon$, suppose the model predicts $x_0$ directly: $\hat{x}_0 = f_\theta(x_t, t)$. Derive the corresponding mean $\mu_\theta$ and the training loss. Show that this is equivalent to noise prediction up to a timestep-dependent reweighting.

**(b)** The "velocity" parameterization predicts $v = \sqrt{\bar{\alpha}_t}\, \varepsilon - \sqrt{1 - \bar{\alpha}_t}\, x_0$. Show that $x_0$ and $\varepsilon$ can both be recovered from $v$ given $x_t$, and derive the loss.

### Exercise 9.4: Implementation

**(a)** Implement the cosine schedule and plot $\bar{\alpha}_t$, $\text{SNR}(t)$, and $\beta_t$ for $T = 1000$. Compare with the linear schedule.

**(b)** Using the provided `SimpleUNet`, train DDPM on CIFAR-10 for 50 epochs. Record the loss curve. Generate and visualize 64 samples. Experiment with both linear and cosine schedules and report the visual difference.

**(c)** Implement a function that visualizes the forward process by showing $x_t$ for $t \in \{0, 50, 100, 250, 500, 750, 1000\}$ given a single CIFAR-10 image. Verify that $x_T$ is visually indistinguishable from Gaussian noise.
