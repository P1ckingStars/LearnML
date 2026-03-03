# Lecture 07d: Energy-Based Models and Score Matching

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Define** energy-based models (EBMs) and explain why the partition function is intractable.
2. **Derive** the score function $s_\theta(x) = \nabla_x \log p_\theta(x)$ and explain why it avoids the partition function.
3. **Derive** the score matching objective from the Fisher divergence, including the integration-by-parts trick that makes it tractable.
4. **Prove** the equivalence between denoising score matching and explicit score matching.
5. **Explain** noise-conditional score networks (NCSN) and the multi-scale denoising strategy.
6. **Implement** score matching and Langevin dynamics sampling in PyTorch.
7. **Connect** score-based models to diffusion models (bridging to Module 08).

---

## 2. Motivation and Context

### 2.1 Beyond Normalized Models

All models we have seen so far either:
- Compute $p(x)$ exactly (autoregressive models, normalizing flows).
- Optimize a lower bound on $\log p(x)$ (VAEs).

What if we drop the requirement of a normalized density entirely? Define:

$$p_\theta(x) = \frac{\exp(-E_\theta(x))}{Z(\theta)}, \quad Z(\theta) = \int \exp(-E_\theta(x)) \, dx$$

where $E_\theta: \mathbb{R}^D \to \mathbb{R}$ is an **energy function** (any neural network mapping data to a scalar) and $Z(\theta)$ is the **partition function** (normalizing constant).

This formulation is maximally flexible: any positive density can be written in this form. The catch is that $Z(\theta)$ is an intractable integral over all of $\mathbb{R}^D$.

### 2.2 The Score Function Escape

The key insight: the **score function** — the gradient of the log-density with respect to the data — does not depend on $Z(\theta)$:

$$\nabla_x \log p_\theta(x) = \nabla_x [-E_\theta(x) - \log Z(\theta)] = -\nabla_x E_\theta(x)$$

The $\log Z(\theta)$ term vanishes because $Z(\theta)$ does not depend on $x$. So we can learn the score function without ever computing the partition function.

### 2.3 Historical Arc

| Year | Contribution | Key Idea |
|------|-------------|----------|
| 1982 | Hopfield networks | Energy-based associative memory |
| 2002 | Hinton — Contrastive divergence | Approximate MCMC training for RBMs |
| 2005 | Hyvarinen — Score matching | Learn score without partition function |
| 2011 | Vincent — Denoising score matching | Equivalence to denoising |
| 2019 | Song & Ermon — NCSN | Multi-scale noise for score estimation |
| 2020 | Song et al. — Score-based SDE | Unification with diffusion models |

---

## 3. Core Theory

### 3.1 Energy-Based Models: Formulation

**Definition 3.1 (Energy-Based Model).** An energy-based model defines a probability density:

$$p_\theta(x) = \frac{1}{Z(\theta)} \exp(-E_\theta(x))$$

where $E_\theta: \mathbb{R}^D \to \mathbb{R}$ is the energy function and $Z(\theta) = \int_{\mathbb{R}^D} \exp(-E_\theta(x)) \, dx$ is the partition function.

**Why the partition function is intractable:**

For a neural network energy function $E_\theta(x)$, the integral $Z(\theta)$ is over the full data space $\mathbb{R}^D$. Even for modest $D$ (e.g., $D = 784$ for MNIST), numerical integration is infeasible, and Monte Carlo estimation has exponential variance.

**Consequences of intractability:**

1. We cannot compute $\log p_\theta(x)$ for maximum likelihood training.
2. We cannot compute the MLE gradient: $\nabla_\theta \log p_\theta(x) = -\nabla_\theta E_\theta(x) - \nabla_\theta \log Z(\theta)$. The second term requires $\mathbb{E}_{p_\theta}[\nabla_\theta E_\theta(x)]$, an expectation under the model distribution.

### 3.2 Classical Approaches: Contrastive Divergence

Before score matching, the dominant approach was **contrastive divergence** (Hinton, 2002). The MLE gradient is:

$$\nabla_\theta \log p_\theta(x) = -\nabla_\theta E_\theta(x) + \mathbb{E}_{p_\theta(x')}[\nabla_\theta E_\theta(x')]$$

The second term (the "negative phase") requires samples from $p_\theta$. Contrastive divergence approximates this with $k$ steps of MCMC (typically Gibbs sampling for RBMs), starting from the data.

**Problems**: The approximation is biased for finite $k$; convergence is slow; the approach is largely restricted to specific architectures (RBMs).

### 3.3 The Score Function

**Definition 3.2 (Score Function).** The score function of a distribution $p(x)$ is:

$$s(x) = \nabla_x \log p(x)$$

**Properties:**

1. The score is a vector field: $s: \mathbb{R}^D \to \mathbb{R}^D$, pointing in the direction of increasing log-density.

2. For an EBM: $s_\theta(x) = \nabla_x \log p_\theta(x) = -\nabla_x E_\theta(x)$.

3. **Partition-function-free**: $s_\theta(x)$ depends only on $E_\theta$, not on $Z(\theta)$.

4. $\mathbb{E}_{p(x)}[s(x)] = 0$ (the score has zero mean under the data distribution). *Proof*: $\int p(x) \nabla_x \log p(x) \, dx = \int \nabla_x p(x) \, dx = \nabla_x \int p(x) \, dx = \nabla_x 1 = 0$.

5. $-\mathbb{E}_{p(x)}[\nabla_x s(x)] = \mathbb{E}_{p(x)}[s(x)s(x)^\top]$ (this identity is used in score matching). Here $\nabla_x s(x)$ denotes the Jacobian $\frac{\partial s_i}{\partial x_j}$.

### 3.4 Fisher Divergence and Score Matching

**Definition 3.3 (Fisher Divergence).** The Fisher divergence between two distributions $p_\text{data}$ and $p_\theta$ is:

$$D_F(p_\text{data} \| p_\theta) = \frac{1}{2} \mathbb{E}_{p_\text{data}(x)}\left[\|s_\theta(x) - s_\text{data}(x)\|^2\right]$$

where $s_\text{data}(x) = \nabla_x \log p_\text{data}(x)$ and $s_\theta(x) = \nabla_x \log p_\theta(x)$.

**Problem**: We do not know $s_\text{data}(x) = \nabla_x \log p_\text{data}(x)$; if we did, we would already know the data distribution.

**Theorem 3.4 (Hyvarinen, 2005 — Score Matching).** Under mild regularity conditions on $p_\text{data}$ and $s_\theta$, the Fisher divergence can be rewritten without $s_\text{data}$:

$$D_F(p_\text{data} \| p_\theta) = \mathbb{E}_{p_\text{data}(x)}\left[\frac{1}{2}\|s_\theta(x)\|^2 + \text{tr}(\nabla_x s_\theta(x))\right] + C$$

where $C = \frac{1}{2}\mathbb{E}_{p_\text{data}}[\|s_\text{data}(x)\|^2]$ is a constant independent of $\theta$.

*Proof.* Expand the Fisher divergence:

$$D_F = \frac{1}{2}\mathbb{E}_{p_\text{data}}\left[\|s_\theta(x)\|^2 - 2 s_\theta(x)^\top s_\text{data}(x) + \|s_\text{data}(x)\|^2\right]$$

The key is the cross term. We show:

$$\mathbb{E}_{p_\text{data}}\left[s_\theta(x)^\top s_\text{data}(x)\right] = -\mathbb{E}_{p_\text{data}}\left[\text{tr}(\nabla_x s_\theta(x))\right]$$

Consider the $j$-th component:

$$\mathbb{E}_{p_\text{data}}\left[s_{\theta,j}(x) \cdot \frac{\partial \log p_\text{data}(x)}{\partial x_j}\right] = \int s_{\theta,j}(x) \frac{\partial p_\text{data}(x)}{\partial x_j} dx$$

Integrate by parts (assuming $p_\text{data}(x) s_{\theta,j}(x) \to 0$ as $\|x\| \to \infty$):

$$= \left[s_{\theta,j}(x) p_\text{data}(x)\right]_{-\infty}^{+\infty} - \int \frac{\partial s_{\theta,j}(x)}{\partial x_j} p_\text{data}(x) \, dx$$

$$= 0 - \mathbb{E}_{p_\text{data}}\left[\frac{\partial s_{\theta,j}(x)}{\partial x_j}\right]$$

Summing over $j = 1, \ldots, D$:

$$\mathbb{E}_{p_\text{data}}[s_\theta^\top s_\text{data}] = -\mathbb{E}_{p_\text{data}}\left[\sum_j \frac{\partial s_{\theta,j}}{\partial x_j}\right] = -\mathbb{E}_{p_\text{data}}[\text{tr}(\nabla_x s_\theta)]$$

Substituting back:

$$D_F = \frac{1}{2}\mathbb{E}_{p_\text{data}}[\|s_\theta\|^2] + \mathbb{E}_{p_\text{data}}[\text{tr}(\nabla_x s_\theta)] + \frac{1}{2}\mathbb{E}_{p_\text{data}}[\|s_\text{data}\|^2]$$

The last term is constant w.r.t. $\theta$, so minimizing $D_F$ is equivalent to minimizing:

$$J_{\text{SM}}(\theta) = \mathbb{E}_{p_\text{data}}\left[\frac{1}{2}\|s_\theta(x)\|^2 + \text{tr}(\nabla_x s_\theta(x))\right] \quad \blacksquare$$

**The score matching objective** $J_{\text{SM}}(\theta)$ requires:
1. Computing $s_\theta(x) = \nabla_x \log p_\theta(x)$: one backprop through the energy network.
2. Computing $\text{tr}(\nabla_x s_\theta(x)) = \sum_j \frac{\partial^2 \log p_\theta}{\partial x_j^2}$: this is the **Laplacian** of $\log p_\theta$, requiring $D$ second derivatives.

**Computational issue**: The trace of the Hessian costs $O(D)$ backward passes (one per diagonal element), which is expensive for high-dimensional data.

### 3.5 Sliced Score Matching

To avoid the $O(D)$ cost, Song et al. (2020) propose **sliced score matching**. Using the Hutchinson trace estimator:

$$\text{tr}(\nabla_x s_\theta(x)) = \mathbb{E}_{v \sim \mathcal{N}(0, I)}[v^\top \nabla_x s_\theta(x) v]$$

This requires only one vector-Jacobian product, computable via a single backward pass:

$$J_{\text{SSM}}(\theta) = \mathbb{E}_{p_\text{data}} \mathbb{E}_{v}\left[\frac{1}{2}\|s_\theta(x)\|^2 + v^\top \nabla_x s_\theta(x) v\right]$$

### 3.6 Denoising Score Matching

**Theorem 3.5 (Vincent, 2011).** Let $q_\sigma(\tilde{x} \mid x) = \mathcal{N}(\tilde{x} \mid x, \sigma^2 I)$ be a Gaussian perturbation kernel, and let $q_\sigma(\tilde{x}) = \int q_\sigma(\tilde{x} \mid x) p_\text{data}(x) \, dx$ be the noisy data distribution. Then:

$$\frac{1}{2}\mathbb{E}_{q_\sigma(\tilde{x}, x)}\left[\|s_\theta(\tilde{x}) - \nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x)\|^2\right] = \frac{1}{2}\mathbb{E}_{q_\sigma(\tilde{x})}\left[\|s_\theta(\tilde{x}) - \nabla_{\tilde{x}} \log q_\sigma(\tilde{x})\|^2\right] + C'$$

where $C'$ is constant w.r.t. $\theta$.

In other words, training a model to predict the score of the noisy distribution $\nabla_{\tilde{x}} \log q_\sigma(\tilde{x})$ is equivalent (up to a constant) to training it to predict the conditional score $\nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x)$, which is known in closed form.

*Proof.* The conditional score for Gaussian noise is:

$$\nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x) = \nabla_{\tilde{x}} \left[-\frac{\|\tilde{x} - x\|^2}{2\sigma^2}\right] = -\frac{\tilde{x} - x}{\sigma^2}$$

Now expand the right-hand side:

$$\frac{1}{2}\mathbb{E}_{q_\sigma(\tilde{x})}\left[\|s_\theta(\tilde{x}) - \nabla_{\tilde{x}} \log q_\sigma(\tilde{x})\|^2\right]$$

$$= \frac{1}{2}\mathbb{E}_{q_\sigma(\tilde{x})}\left[\|s_\theta(\tilde{x})\|^2 - 2 s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} \log q_\sigma(\tilde{x}) + \|\nabla_{\tilde{x}} \log q_\sigma(\tilde{x})\|^2\right]$$

And the left-hand side:

$$\frac{1}{2}\mathbb{E}_{q_\sigma(\tilde{x}, x)}\left[\|s_\theta(\tilde{x}) - \nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x)\|^2\right]$$

$$= \frac{1}{2}\mathbb{E}_{q_\sigma}\left[\|s_\theta(\tilde{x})\|^2 - 2 s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x) + \|\nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x)\|^2\right]$$

The key equality is in the cross terms. Using Bayes: $q_\sigma(\tilde{x}, x) = q_\sigma(\tilde{x} \mid x) p_\text{data}(x) = q_\sigma(x \mid \tilde{x}) q_\sigma(\tilde{x})$:

$$\mathbb{E}_{q_\sigma(\tilde{x}, x)}\left[s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x)\right]$$

$$= \int \int s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x) \, q_\sigma(\tilde{x} \mid x) p_\text{data}(x) \, dx \, d\tilde{x}$$

$$= \int s_\theta(\tilde{x})^\top \left[\int \nabla_{\tilde{x}} q_\sigma(\tilde{x} \mid x) p_\text{data}(x) \, dx\right] d\tilde{x}$$

$$= \int s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} q_\sigma(\tilde{x}) \, d\tilde{x}$$

$$= \int s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} \log q_\sigma(\tilde{x}) \, q_\sigma(\tilde{x}) \, d\tilde{x}$$

$$= \mathbb{E}_{q_\sigma(\tilde{x})}\left[s_\theta(\tilde{x})^\top \nabla_{\tilde{x}} \log q_\sigma(\tilde{x})\right]$$

So the cross terms are equal. The difference between LHS and RHS is only in the constant terms (the squared score norms), which do not depend on $\theta$. $\blacksquare$

**The denoising score matching objective** is therefore:

$$J_{\text{DSM}}(\theta) = \frac{1}{2}\mathbb{E}_{x \sim p_\text{data}} \mathbb{E}_{\tilde{x} \sim \mathcal{N}(x, \sigma^2 I)}\left[\left\|s_\theta(\tilde{x}) + \frac{\tilde{x} - x}{\sigma^2}\right\|^2\right]$$

This is a simple regression problem: train $s_\theta$ to predict the direction back to the clean data from a noisy version.

### 3.7 Noise-Conditional Score Networks (NCSN)

**Problem with a single noise level**: If $\sigma$ is too small, the noisy distribution $q_\sigma(\tilde{x})$ is nearly identical to $p_\text{data}$, but score estimation in low-density regions is poor (few training samples land there). If $\sigma$ is too large, score estimation is easy but the learned score is for a distribution far from $p_\text{data}$.

**Solution** (Song & Ermon, 2019): Use a geometric sequence of noise levels $\sigma_1 > \sigma_2 > \cdots > \sigma_L$ and train a single network conditioned on the noise level:

$$J_{\text{NCSN}}(\theta) = \frac{1}{L}\sum_{i=1}^L \lambda(\sigma_i) \, \mathbb{E}_{x \sim p_\text{data}} \mathbb{E}_{\tilde{x} \sim \mathcal{N}(x, \sigma_i^2 I)}\left[\left\|s_\theta(\tilde{x}, \sigma_i) + \frac{\tilde{x} - x}{\sigma_i^2}\right\|^2\right]$$

where $\lambda(\sigma_i) = \sigma_i^2$ is a weighting that ensures each noise level contributes equally (since the score magnitude scales as $1/\sigma_i^2$).

**Sampling via annealed Langevin dynamics**: Generate samples by running Langevin dynamics at each noise level, from largest to smallest:

For $i = 1, \ldots, L$:
$$x_t = x_{t-1} + \frac{\alpha_i}{2} s_\theta(x_{t-1}, \sigma_i) + \sqrt{\alpha_i} \, \epsilon_t, \quad \epsilon_t \sim \mathcal{N}(0, I)$$

### 3.8 Langevin Dynamics

**Theorem 3.6 (Langevin Dynamics).** The stochastic differential equation:

$$dx = \frac{1}{2} \nabla_x \log p(x) \, dt + dW_t$$

where $W_t$ is a Wiener process, has $p(x)$ as its stationary distribution.

*Proof sketch.* The Fokker-Planck equation for the SDE $dx = \mu(x)dt + \sigma dW_t$ gives the evolution of the probability density $\rho(x, t)$:

$$\frac{\partial \rho}{\partial t} = -\nabla \cdot (\mu \rho) + \frac{\sigma^2}{2} \nabla^2 \rho$$

For Langevin dynamics with $\mu = \frac{1}{2}\nabla \log p$ and $\sigma = 1$:

$$\frac{\partial \rho}{\partial t} = -\nabla \cdot \left(\frac{1}{2}\nabla \log p \cdot \rho\right) + \frac{1}{2}\nabla^2 \rho$$

$$= -\frac{1}{2}\nabla \cdot \left(\frac{\nabla p}{p} \rho\right) + \frac{1}{2}\nabla^2 \rho$$

Setting $\rho = p$:

$$= -\frac{1}{2}\nabla \cdot (\nabla p) + \frac{1}{2}\nabla^2 p = -\frac{1}{2}\nabla^2 p + \frac{1}{2}\nabla^2 p = 0$$

So $\rho = p$ is a stationary solution. $\blacksquare$

**Discrete Langevin MCMC** (Unadjusted Langevin Algorithm):

$$x_{t+1} = x_t + \frac{\alpha}{2} s_\theta(x_t) + \sqrt{\alpha} \, \epsilon_t, \quad \epsilon_t \sim \mathcal{N}(0, I)$$

For small step size $\alpha$ and many steps, the samples approximate $p_\theta(x)$.

### 3.9 Connection to Diffusion Models

The NCSN framework is the precursor to diffusion models (Module 08). The key bridge:

1. **NCSN**: Perturb data with noise at discrete levels $\sigma_1, \ldots, \sigma_L$. Train a score network. Sample via annealed Langevin dynamics.

2. **Score-based SDE** (Song et al., 2020): Replace the discrete noise levels with a continuous diffusion process. The forward SDE:

$$dx = f(x, t) \, dt + g(t) \, dW_t$$

gradually corrupts data into noise. The reverse SDE:

$$dx = [f(x, t) - g(t)^2 \nabla_x \log p_t(x)] \, dt + g(t) \, d\bar{W}_t$$

generates samples given the time-dependent score $\nabla_x \log p_t(x)$.

The denoising score matching objective at each noise level becomes the diffusion training objective. We will develop this fully in Module 08.

---

## 4. Algorithmic Derivation

### 4.1 Denoising Score Matching Training

```
Algorithm: Denoising Score Matching (Single Noise Level)
────────────────────────────────────────────────────────────────
Input: Dataset D = {x^(1), ..., x^(N)}, score network s_θ: R^D -> R^D
       Noise level σ, learning rate η, batch size B
Output: Trained score network s_θ*

1. Initialize θ randomly
2. For each minibatch {x^(1), ..., x^(B)} from D:

   # Add noise
   3. ε^(j) ~ N(0, I_D) for j = 1, ..., B                  # [B, D]
   4. x̃^(j) = x^(j) + σ · ε^(j)                            # [B, D]

   # Target score: ∇ log q_σ(x̃|x) = -(x̃ - x)/σ² = -ε/σ
   5. target^(j) = -ε^(j) / σ                                # [B, D]

   # Predicted score
   6. ŝ^(j) = s_θ(x̃^(j))                                    # [B, D]

   # Loss: ||ŝ - target||²
   7. L = (1/B) Σ_j ||ŝ^(j) - target^(j)||²

   8. θ ← θ - η · ∇_θ L
```

### 4.2 Noise-Conditional Score Matching (NCSN)

```
Algorithm: NCSN Training
────────────────────────────────────────────────────────────────
Input: Dataset D, conditional score network s_θ(x, σ): R^D × R -> R^D
       Noise levels σ_1 > σ_2 > ... > σ_L (geometric sequence)
       Learning rate η, batch size B
Output: Trained s_θ*

1. Initialize θ randomly
2. For each minibatch {x^(1), ..., x^(B)} from D:

   # Sample noise level uniformly
   3. For each j, sample i_j ~ Uniform{1, ..., L}
   4. σ_j = σ_{i_j}

   # Add noise at the sampled level
   5. ε^(j) ~ N(0, I_D)                                      # [B, D]
   6. x̃^(j) = x^(j) + σ_j · ε^(j)                           # [B, D]

   # Weighted loss (λ(σ) = σ²)
   7. L = (1/B) Σ_j σ_j² · ||s_θ(x̃^(j), σ_j) + ε^(j)/σ_j||²

   8. θ ← θ - η · ∇_θ L
```

**Complexity**: $O(B \cdot C_\text{score\_net})$ per iteration. The score network $s_\theta$ is a standard neural network (U-Net for images), so the cost is dominated by the network forward/backward pass. No partition function computation is needed.

### 4.3 Annealed Langevin Dynamics Sampling

```
Algorithm: Annealed Langevin Dynamics
────────────────────────────────────────────────────────────────
Input: Trained score network s_θ(x, σ),
       noise levels σ_1 > ... > σ_L,
       step sizes α_1, ..., α_L (or α_i = ε · σ_i² / σ_L²),
       T steps per noise level
Output: Samples x

1. Initialize x ~ N(0, σ_1² · I) or x ~ Uniform                # [n_samples, D]

2. For i = 1, ..., L:        # coarse to fine
   3. For t = 1, ..., T:
      4. ε ~ N(0, I_D)                                           # [n_samples, D]
      5. x ← x + (α_i / 2) · s_θ(x, σ_i) + √α_i · ε          # [n_samples, D]

6. Return x
```

**Complexity**: $O(L \cdot T \cdot C_\text{score\_net} \cdot n_\text{samples})$. Typical values: $L = 10$, $T = 100$, giving 1000 score network evaluations per sample.

---

## 5. PyTorch Implementation

### 5.1 Score Network Architecture

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Optional

class ScoreNetwork(nn.Module):
    """
    A noise-conditional score network for 2D data.

    Architecture: MLP with noise level conditioning via concatenation.
    For image data, replace with a U-Net (see Module 08).
    """

    def __init__(self, data_dim: int = 2, hidden_dim: int = 256, n_layers: int = 4):
        super().__init__()

        layers = []
        # Input: [B, D + 1] (data concatenated with log(sigma))
        layers.append(nn.Linear(data_dim + 1, hidden_dim))
        layers.append(nn.SiLU())

        for _ in range(n_layers - 2):
            layers.append(nn.Linear(hidden_dim, hidden_dim))
            layers.append(nn.SiLU())

        # Output: [B, D] (score vector)
        layers.append(nn.Linear(hidden_dim, data_dim))

        self.net = nn.Sequential(*layers)
        self.data_dim = data_dim

    def forward(self, x: torch.Tensor, sigma: torch.Tensor) -> torch.Tensor:
        """
        Predict the score s_θ(x, σ) ≈ ∇_x log p_σ(x).

        Args:
            x: [B, D] noisy data
            sigma: [B, 1] or [B] noise level
        Returns:
            score: [B, D] estimated score
        """
        if sigma.dim() == 1:
            sigma = sigma.unsqueeze(1)  # [B, 1]

        # Condition on log(sigma) for numerical stability
        log_sigma = torch.log(sigma)               # [B, 1]
        x_cond = torch.cat([x, log_sigma], dim=1)  # [B, D+1]

        score = self.net(x_cond)  # [B, D]

        # Scale output by 1/sigma to match expected score magnitude
        score = score / sigma

        return score
```

### 5.2 Denoising Score Matching Training

```python
def denoising_score_matching_loss(
    model: ScoreNetwork,
    x: torch.Tensor,         # [B, D] clean data
    sigma: torch.Tensor,     # [B] noise level per sample
) -> torch.Tensor:
    """
    Compute the denoising score matching loss.

    L = E[σ² ||s_θ(x̃, σ) + (x̃ - x)/σ²||²]
      = E[σ² ||s_θ(x̃, σ) + ε/σ||²]      (since x̃ - x = σε)

    Equivalently, with the 1/sigma scaling in the network:
    L = E[||σ · s_θ(x̃, σ) + ε||²]

    Args:
        model: score network
        x: [B, D] clean data samples
        sigma: [B] noise levels
    Returns:
        loss: scalar
    """
    B, D = x.shape

    # Sample noise
    eps = torch.randn_like(x)                      # [B, D]
    x_noisy = x + sigma.unsqueeze(1) * eps         # [B, D]

    # Predict score
    score = model(x_noisy, sigma)                   # [B, D]

    # Target: -eps / sigma (the conditional score)
    # But since model already divides by sigma, the target for (sigma * score) is -eps
    # Loss: sigma² * ||score + eps/sigma||² = ||sigma * score + eps||²
    loss = torch.sum(
        (sigma.unsqueeze(1) * score + eps) ** 2,
        dim=1
    ).mean()  # scalar

    return loss


def train_ncsn(
    model: ScoreNetwork,
    data: torch.Tensor,        # [N, D] training data
    sigma_min: float = 0.01,
    sigma_max: float = 10.0,
    n_sigmas: int = 10,
    n_epochs: int = 1000,
    batch_size: int = 256,
    lr: float = 1e-3,
):
    """
    Train a noise-conditional score network.

    Args:
        model: ScoreNetwork
        data: [N, D] training data
        sigma_min, sigma_max: range of noise levels
        n_sigmas: number of discrete noise levels
        n_epochs: number of training epochs
        batch_size: minibatch size
        lr: learning rate
    Returns:
        losses: list of per-epoch average losses
    """
    # Geometric sequence of noise levels
    sigmas = torch.exp(
        torch.linspace(np.log(sigma_max), np.log(sigma_min), n_sigmas)
    )  # [L], from large to small
    print(f"Noise levels: {sigmas.tolist()}")

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    N = data.shape[0]

    losses = []
    for epoch in range(n_epochs):
        # Shuffle data
        perm = torch.randperm(N)
        epoch_loss = 0.0
        n_batches = 0

        for i in range(0, N, batch_size):
            x_batch = data[perm[i:i+batch_size]]  # [B, D]
            B = x_batch.shape[0]

            # Sample random noise levels
            sigma_indices = torch.randint(0, n_sigmas, (B,))
            sigma_batch = sigmas[sigma_indices]  # [B]

            loss = denoising_score_matching_loss(model, x_batch, sigma_batch)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        avg_loss = epoch_loss / n_batches
        losses.append(avg_loss)

        if (epoch + 1) % 100 == 0:
            print(f"Epoch {epoch+1:5d} | Loss: {avg_loss:.4f}")

    return losses, sigmas
```

### 5.3 Annealed Langevin Dynamics Sampling

```python
@torch.no_grad()
def annealed_langevin_dynamics(
    model: ScoreNetwork,
    sigmas: torch.Tensor,          # [L] noise levels, descending
    n_samples: int = 1000,
    data_dim: int = 2,
    n_steps_per_sigma: int = 100,
    step_size_factor: float = 2e-5,
    device: torch.device = torch.device('cpu'),
) -> torch.Tensor:
    """
    Generate samples via annealed Langevin dynamics.

    Args:
        model: trained score network
        sigmas: [L] noise levels from large to small
        n_samples: number of samples to generate
        data_dim: dimension of data
        n_steps_per_sigma: Langevin steps per noise level
        step_size_factor: base step size (scaled by sigma)
        device: torch device
    Returns:
        x: [n_samples, D] generated samples
    """
    model.eval()

    # Initialize from broad noise
    x = torch.randn(n_samples, data_dim, device=device) * sigmas[0]  # [n, D]

    for i, sigma in enumerate(sigmas):
        # Step size proportional to sigma^2
        alpha = step_size_factor * (sigma / sigmas[-1]) ** 2

        sigma_tensor = sigma.expand(n_samples).to(device)  # [n]

        for t in range(n_steps_per_sigma):
            # Score prediction
            score = model(x, sigma_tensor)  # [n, D]

            # Langevin update
            noise = torch.randn_like(x)  # [n, D]
            x = x + (alpha / 2) * score + torch.sqrt(alpha) * noise  # [n, D]

    return x
```

### 5.4 Full Example: Score Matching on 2D Data

```python
import matplotlib.pyplot as plt

def visualize_score_field(
    model: ScoreNetwork,
    sigma: float,
    x_range: tuple = (-3, 3),
    y_range: tuple = (-3, 3),
    n_grid: int = 20,
    device: torch.device = torch.device('cpu'),
):
    """Visualize the learned score field as a quiver plot."""
    xx = torch.linspace(*x_range, n_grid)
    yy = torch.linspace(*y_range, n_grid)
    grid_x, grid_y = torch.meshgrid(xx, yy, indexing='xy')
    points = torch.stack([grid_x.flatten(), grid_y.flatten()], dim=1).to(device)  # [n^2, 2]

    sigma_tensor = torch.full((points.shape[0],), sigma, device=device)

    with torch.no_grad():
        scores = model(points, sigma_tensor).cpu()  # [n^2, 2]

    plt.quiver(
        points[:, 0].cpu(), points[:, 1].cpu(),
        scores[:, 0], scores[:, 1],
        scale=50, alpha=0.7
    )
    plt.title(f'Score Field (sigma={sigma:.2f})')
    plt.xlim(*x_range)
    plt.ylim(*y_range)


if __name__ == "__main__":
    torch.manual_seed(42)

    # Generate training data: mixture of 4 Gaussians
    n_samples = 10000
    centers = torch.tensor([[1, 1], [-1, 1], [1, -1], [-1, -1]], dtype=torch.float32)
    data = []
    for _ in range(n_samples):
        k = torch.randint(0, 4, (1,)).item()
        data.append(centers[k] + 0.2 * torch.randn(2))
    data = torch.stack(data)  # [N, 2]

    # Create and train model
    model = ScoreNetwork(data_dim=2, hidden_dim=256, n_layers=4)
    losses, sigmas = train_ncsn(
        model, data,
        sigma_min=0.01, sigma_max=5.0, n_sigmas=10,
        n_epochs=2000, batch_size=256, lr=1e-3
    )

    # Generate samples
    samples = annealed_langevin_dynamics(
        model, sigmas,
        n_samples=2000, data_dim=2,
        n_steps_per_sigma=100, step_size_factor=5e-5,
    )

    # Visualize
    fig, axes = plt.subplots(1, 3, figsize=(18, 6))

    # Training data
    axes[0].scatter(data[:, 0], data[:, 1], s=1, alpha=0.3)
    axes[0].set_title('Training Data')
    axes[0].set_xlim(-3, 3)
    axes[0].set_ylim(-3, 3)
    axes[0].set_aspect('equal')

    # Generated samples
    axes[1].scatter(samples[:, 0], samples[:, 1], s=1, alpha=0.3, c='red')
    axes[1].set_title('Generated Samples (Annealed Langevin)')
    axes[1].set_xlim(-3, 3)
    axes[1].set_ylim(-3, 3)
    axes[1].set_aspect('equal')

    # Score field at smallest noise level
    plt.sca(axes[2])
    visualize_score_field(model, sigma=sigmas[-1].item())
    axes[2].scatter(data[:2000, 0], data[:2000, 1], s=1, alpha=0.1)
    axes[2].set_aspect('equal')

    plt.tight_layout()
    plt.savefig('ncsn_results.png', dpi=150)
    plt.show()
```

---

## 6. Experimental Intuition

### 6.1 Effect of Noise Levels

| Setting | Result |
|---------|--------|
| Single small $\sigma$ | Good score in data regions; poor in low-density regions; Langevin gets stuck |
| Single large $\sigma$ | Smooth score everywhere; but blurry/inaccurate near data |
| Multi-scale (NCSN) | Best of both: large $\sigma$ for global structure, small $\sigma$ for fine detail |

### 6.2 Score Matching vs. Maximum Likelihood

| Aspect | Maximum Likelihood | Score Matching |
|--------|-------------------|----------------|
| Requires partition function | Yes | No |
| Loss function | $-\log p_\theta(x)$ | $\Vert s_\theta(x) - \nabla_x \log p(x)\Vert^2$ |
| What is learned | Full density $p_\theta(x)$ | Score (gradient of log-density) only |
| Sampling | Direct (if model allows) | Requires MCMC (Langevin) |
| Mode coverage | Can miss modes (mode collapse) | Better mode coverage (Fisher divergence) |

### 6.3 Langevin Dynamics: Step Size and Convergence

**Too large step size ($\alpha$)**: Langevin dynamics becomes unstable; samples diverge.
**Too small step size**: Convergence is extremely slow; chains do not mix.
**Rule of thumb**: $\alpha \propto \sigma^2 / \sigma_L^2$ where $\sigma_L$ is the smallest noise level.

Number of function evaluations (NFE) needed for good samples on typical benchmarks:
- 2D toy data: ~1000 NFE
- CIFAR-10 (NCSN): ~10,000 NFE
- High-resolution images: ~1000-4000 NFE (with improved methods from Module 08)

### 6.4 Energy Functions vs. Score Functions

One might ask: why not just learn $E_\theta(x)$ and derive the score as $-\nabla_x E_\theta(x)$? This is valid and sometimes preferred:

**Score parameterization** (s_theta directly): More expressive; no constraint that the output is a gradient of some scalar function. But the learned vector field may not be a valid score (not conservative).

**Energy parameterization** ($s_\theta = -\nabla_x E_\theta$): Guaranteed to be a valid score; the energy $E_\theta$ is available for other purposes (e.g., classification). But requires backprop through the network to get the score, which is slower.

In practice, modern score-based models (NCSN, DDPM) use the score parameterization directly.

---

## 7. Connections

### 7.1 Backward Connections

- **Lecture 07a (ELBO)**: EBMs avoid the ELBO entirely by working with unnormalized densities. The score matching objective is an alternative to variational inference.
- **Lecture 07b (VAEs)**: The VAE decoder $p_\theta(x \mid z)$ can be seen as a conditional EBM with $E_\theta(x, z) = -\log p_\theta(x \mid z)$.
- **Lecture 07c (Flows)**: Continuous normalizing flows (Neural ODEs) connect to score-based models: the vector field in a CNF is related to the score function.

### 7.2 Forward Connections

- **Module 08 (Diffusion Models)**: The NCSN framework is the direct precursor to diffusion models:
  - DDPM (Ho et al., 2020) = denoising score matching with a specific noise schedule.
  - Score SDE (Song et al., 2020) = continuous-time generalization of NCSN.
  - The score network architecture (U-Net) carries over directly.

### 7.3 EBMs Beyond Generation

Energy-based models have applications beyond generation:
- **Classification**: The energy function provides a natural out-of-distribution detector (Grathwohl et al., 2020 — JEM).
- **Structured prediction**: Conditional EBMs for structured outputs.
- **Physics**: Equivariant EBMs for molecular force fields.

---

## 8. Paper Reading List

### Required Reading

1. **Hyvarinen, A.** (2005). "Estimation of Non-Normalized Statistical Models by Score Matching." *JMLR, 6.*
   - The original score matching paper. Read Sections 1-3 for the derivation via integration by parts.

2. **Song, Y., & Ermon, S.** (2019). "Generative Modeling by Estimating Gradients of the Data Distribution." *NeurIPS 2019.*
   - The NCSN paper. Introduces multi-scale denoising score matching and annealed Langevin dynamics.

### Recommended Reading

3. **Vincent, P.** (2011). "A Connection Between Score Matching and Denoising Autoencoders." *Neural Computation, 23(7).*
   - Proves the equivalence between denoising score matching and explicit score matching. Short and elegant.

4. **Song, Y., Sohl-Dickstein, J., Kingma, D.P., Kumar, A., Ermon, S., & Poole, B.** (2021). "Score-Based Generative Modeling through Stochastic Differential Equations." *ICLR 2021.*
   - Unifies NCSN and DDPM under the score SDE framework. The bridge to Module 08.

5. **Grathwohl, W., Wang, K.C., Jacobsen, J.-H., Duvenaud, D., Zemel, R.** (2020). "Your Classifier is Secretly an Energy Based Model and You Should Treat it Like One." *ICLR 2020.*
   - JEM: jointly train a classifier and generative model via EBM framework.

### Historical Context

6. **Hinton, G.E.** (2002). "Training Products of Experts by Minimizing Contrastive Divergence." *Neural Computation, 14(8).*
   - The contrastive divergence algorithm for RBMs. Important historical context for EBM training.

7. **LeCun, Y., Chopra, S., Hadsell, R., Ranzato, M.A., & Huang, F.J.** (2006). "A Tutorial on Energy-Based Learning." *Predicting Structured Data.*
   - Broad tutorial on EBMs from a discriminative and generative perspective.

---

## 9. Exercises

### Theoretical Exercises

**Exercise 9.1** (Score Matching Derivation). Reproduce the full proof of the score matching objective (Theorem 3.4) without looking at the notes. Verify each step of the integration by parts.

**Exercise 9.2** (Score of Gaussian Mixture). Consider $p(x) = \sum_k \pi_k \mathcal{N}(x \mid \mu_k, \sigma_k^2 I)$.
(a) Derive $\nabla_x \log p(x)$ in closed form.
(b) Show that the score is a weighted average of the individual component scores.
(c) Analyze the behavior of the score near and far from the component means.

**Exercise 9.3** (DSM Equivalence). For Gaussian noise $q_\sigma(\tilde{x} \mid x) = \mathcal{N}(\tilde{x} \mid x, \sigma^2 I)$:
(a) Derive $\nabla_{\tilde{x}} \log q_\sigma(\tilde{x} \mid x) = -(\tilde{x} - x)/\sigma^2$.
(b) Show that the denoising score matching objective is equivalent (up to constants) to training $s_\theta$ to denoise: $s_\theta(\tilde{x}) \approx -(\tilde{x} - x)/\sigma^2$.
(c) Relate this to the classical denoising autoencoder objective. What is the precise connection?

**Exercise 9.4** (Langevin Convergence). For a 1D Gaussian $p(x) = \mathcal{N}(0, 1)$ and exact score $s(x) = -x$:
(a) Write the Langevin update: $x_{t+1} = x_t - \frac{\alpha}{2}x_t + \sqrt{\alpha}\epsilon_t$.
(b) Show that this is an AR(1) process and find its stationary distribution.
(c) For what values of $\alpha$ does it converge?
(d) What is the optimal $\alpha$ (fastest mixing)?

**Exercise 9.5** (Noise Level Selection). Prove that the choice $\lambda(\sigma_i) = \sigma_i^2$ in the NCSN objective ensures that each noise level contributes equally to the gradient magnitude. Hint: consider the expected gradient norm for each term.

### Programming Exercises

**Exercise 9.6** (2D Score Matching). Using the provided implementation:
(a) Train NCSN on the four-Gaussians mixture with $L = 10$ noise levels.
(b) Visualize the score field at each noise level. How does the field change from $\sigma_1$ to $\sigma_L$?
(c) Generate samples and compare to the training distribution.

**Exercise 9.7** (Explicit vs. Denoising Score Matching). For a simple 2D distribution:
(a) Implement explicit (Hyvarinen) score matching, computing the trace of the Hessian exactly.
(b) Implement denoising score matching.
(c) Compare training curves and final score quality. Which converges faster?

**Exercise 9.8** (Langevin Dynamics Analysis). On a 2D Gaussian mixture:
(a) Implement Langevin dynamics with exact score and study mixing as a function of step size $\alpha$.
(b) Replace the exact score with a learned score network. How does score accuracy affect sample quality?
(c) Implement annealed Langevin dynamics and compare mode coverage vs. standard Langevin.

**Exercise 9.9** (Bridge to Diffusion). Implement a simple version of the score SDE:
(a) Define a variance-exploding (VE) forward process: $dx = \sigma(t) dW_t$ with $\sigma(t)$ increasing.
(b) Train a time-conditional score network $s_\theta(x, t)$ using denoising score matching at continuous noise levels (sample $t$ uniformly).
(c) Generate samples using the reverse SDE (Euler-Maruyama discretization).
(d) Compare to the discrete NCSN approach. Is the continuous version better?
