# Lecture 07b: Variational Autoencoders (VAEs)

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Explain** how VAEs implement amortized variational inference using neural network encoders and decoders.
2. **Derive** the reparameterization trick and prove why it enables low-variance gradient estimation.
3. **Prove** the closed-form KL divergence between two diagonal Gaussian distributions from first principles.
4. **Implement** a complete VAE in PyTorch with proper shape annotations and training loop.
5. **Diagnose** posterior collapse and apply mitigations: KL annealing, free bits, and cyclical schedules.
6. **Describe** the beta-VAE framework for learning disentangled representations.
7. **Explain** VQ-VAE and how discrete latent codes differ from continuous ones.

---

## 2. Motivation and Context

### 2.1 From Variational Inference to Amortized Inference

In Lecture 07a, we derived the ELBO and showed that variational EM optimizes per-datapoint variational parameters $\phi_i$ for each $x^{(i)}$. This has two problems:

1. **Computational cost**: For $N$ datapoints, we need $N$ sets of variational parameters, each requiring iterative optimization.
2. **No generalization**: We learn nothing about the posterior of unseen data.

**Amortized inference** solves both: instead of optimizing $\phi_i$ per datapoint, we train a single neural network $q_\phi(z \mid x)$ that maps any $x$ to an approximate posterior. This is the encoder of a VAE.

### 2.2 The VAE Architecture

A VAE consists of three components:

| Component | Notation | Role |
|-----------|----------|------|
| Encoder | $q_\phi(z \mid x) = \mathcal{N}(\mu_\phi(x), \text{diag}(\sigma_\phi^2(x)))$ | Approximate posterior |
| Prior | $p(z) = \mathcal{N}(0, I)$ | Latent space regularizer |
| Decoder | $p_\theta(x \mid z)$ | Generative model |

The decoder distribution depends on the data type:
- **Continuous data**: $p_\theta(x \mid z) = \mathcal{N}(f_\theta(z), \sigma^2 I)$ or learned variance.
- **Binary data**: $p_\theta(x \mid z) = \text{Bernoulli}(\sigma(f_\theta(z)))$ where $\sigma$ is the sigmoid.
- **Categorical data**: $p_\theta(x \mid z) = \text{Categorical}(\text{softmax}(f_\theta(z)))$.

### 2.3 Historical Context

Kingma & Welling (2014) and Rezende, Mohamed & Wierstra (2014) independently proposed the VAE framework within months of each other. The key insight was combining three ideas:

1. **Variational inference** (from Bayesian statistics).
2. **Neural network parameterization** (from deep learning).
3. **The reparameterization trick** (enabling end-to-end gradient-based training).

---

## 3. Core Theory

### 3.1 The VAE Objective

The VAE maximizes the ELBO with amortized inference:

$$\mathcal{L}(\theta, \phi; x) = \mathbb{E}_{q_\phi(z \mid x)}[\log p_\theta(x \mid z)] - D_{\text{KL}}(q_\phi(z \mid x) \| p(z))$$

We want to compute gradients $\nabla_\theta \mathcal{L}$ and $\nabla_\phi \mathcal{L}$ for stochastic gradient ascent.

**Gradient w.r.t. $\theta$** is straightforward:

$$\nabla_\theta \mathcal{L} = \nabla_\theta \mathbb{E}_{q_\phi(z \mid x)}[\log p_\theta(x \mid z)] = \mathbb{E}_{q_\phi(z \mid x)}[\nabla_\theta \log p_\theta(x \mid z)]$$

The gradient passes inside the expectation because $q_\phi(z \mid x)$ does not depend on $\theta$.

**Gradient w.r.t. $\phi$** is problematic:

$$\nabla_\phi \mathcal{L} = \nabla_\phi \mathbb{E}_{q_\phi(z \mid x)}[\log p_\theta(x \mid z)] - \nabla_\phi D_{\text{KL}}(q_\phi(z \mid x) \| p(z))$$

The first term involves $\nabla_\phi \mathbb{E}_{q_\phi(z \mid x)}[\cdot]$ — we are differentiating through an expectation whose distribution depends on $\phi$. We cannot simply move the gradient inside.

### 3.2 The Score Function Estimator (REINFORCE)

One approach is the **score function estimator** (a.k.a. REINFORCE):

$$\nabla_\phi \mathbb{E}_{q_\phi(z \mid x)}[f(z)] = \mathbb{E}_{q_\phi(z \mid x)}[f(z) \nabla_\phi \log q_\phi(z \mid x)]$$

*Proof.*

$$\nabla_\phi \mathbb{E}_{q_\phi}[f(z)] = \nabla_\phi \int f(z) q_\phi(z \mid x) \, dz = \int f(z) \nabla_\phi q_\phi(z \mid x) \, dz$$

Using the log-derivative trick: $\nabla_\phi q_\phi = q_\phi \nabla_\phi \log q_\phi$:

$$= \int f(z) q_\phi(z \mid x) \nabla_\phi \log q_\phi(z \mid x) \, dz = \mathbb{E}_{q_\phi}[f(z) \nabla_\phi \log q_\phi(z \mid x)] \quad \blacksquare$$

**Problem**: This estimator has **extremely high variance**. The term $f(z) \nabla_\phi \log q_\phi(z \mid x)$ can vary wildly across samples, making optimization impractical for high-dimensional latent spaces.

### 3.3 The Reparameterization Trick

**Theorem 3.1 (Reparameterization Trick).** If $z \sim q_\phi(z \mid x)$ can be written as a deterministic transformation $z = g_\phi(\epsilon, x)$ of a noise variable $\epsilon \sim p(\epsilon)$ that is independent of $\phi$, then:

$$\nabla_\phi \mathbb{E}_{q_\phi(z \mid x)}[f(z)] = \mathbb{E}_{p(\epsilon)}[\nabla_\phi f(g_\phi(\epsilon, x))]$$

*Proof.* By the change of variables in the expectation:

$$\mathbb{E}_{q_\phi(z \mid x)}[f(z)] = \mathbb{E}_{p(\epsilon)}[f(g_\phi(\epsilon, x))]$$

Since $p(\epsilon)$ does not depend on $\phi$, we can move the gradient inside:

$$\nabla_\phi \mathbb{E}_{p(\epsilon)}[f(g_\phi(\epsilon, x))] = \mathbb{E}_{p(\epsilon)}[\nabla_\phi f(g_\phi(\epsilon, x))]$$

By the chain rule:

$$= \mathbb{E}_{p(\epsilon)}\left[\nabla_z f(z)\big|_{z = g_\phi(\epsilon, x)} \cdot \nabla_\phi g_\phi(\epsilon, x)\right] \quad \blacksquare$$

**For Gaussian $q_\phi(z \mid x) = \mathcal{N}(\mu_\phi(x), \text{diag}(\sigma_\phi^2(x)))$:**

$$\epsilon \sim \mathcal{N}(0, I), \quad z = g_\phi(\epsilon, x) = \mu_\phi(x) + \sigma_\phi(x) \odot \epsilon$$

The gradient flows through $\mu_\phi$ and $\sigma_\phi$ via standard backpropagation.

### 3.4 Variance Comparison

**Proposition 3.2.** The reparameterization trick estimator typically has much lower variance than the score function estimator.

*Intuition.* The score function estimator uses the signal $f(z) \nabla_\phi \log q_\phi(z \mid x)$. When $f(z)$ has high magnitude but varying sign, the product oscillates wildly. The reparameterized estimator uses $\nabla_z f(z) \cdot \nabla_\phi g_\phi(\epsilon, x)$, which directly uses the gradient of $f$ w.r.t. $z$ — a much smoother signal.

Formally, for a one-dimensional Gaussian $q_\phi = \mathcal{N}(\mu, \sigma^2)$ with $f(z) = z^2$:

- **Score function variance**: $\text{Var}[f(z) \nabla_\mu \log q] = \text{Var}[z^2 \cdot (z - \mu)/\sigma^2] = O(\sigma^2)$
- **Reparameterization variance**: $\text{Var}[\nabla_\mu f(g(\epsilon))] = \text{Var}[2(\mu + \sigma\epsilon)] = 4\sigma^2$

The score function estimator's variance grows with higher moments of $f$, while the reparameterized version only involves the gradient of $f$.

### 3.5 Closed-Form KL for Diagonal Gaussians

**Theorem 3.3.** For two diagonal Gaussian distributions $q = \mathcal{N}(\mu_1, \text{diag}(\sigma_1^2))$ and $p = \mathcal{N}(\mu_2, \text{diag}(\sigma_2^2))$ in $\mathbb{R}^d$:

$$D_{\text{KL}}(q \| p) = \sum_{j=1}^d \left[\log \frac{\sigma_{2,j}}{\sigma_{1,j}} + \frac{\sigma_{1,j}^2 + (\mu_{1,j} - \mu_{2,j})^2}{2\sigma_{2,j}^2} - \frac{1}{2}\right]$$

*Proof.* We derive this from the definition of KL divergence.

$$D_{\text{KL}}(q \| p) = \mathbb{E}_q\left[\log \frac{q(z)}{p(z)}\right] = \mathbb{E}_q[\log q(z)] - \mathbb{E}_q[\log p(z)]$$

**Term 1**: $\mathbb{E}_q[\log q(z)]$. For a diagonal Gaussian:

$$\log q(z) = -\frac{d}{2}\log(2\pi) - \sum_{j=1}^d \log \sigma_{1,j} - \frac{1}{2}\sum_{j=1}^d \frac{(z_j - \mu_{1,j})^2}{\sigma_{1,j}^2}$$

Taking the expectation under $q$, where $\mathbb{E}_q[(z_j - \mu_{1,j})^2] = \sigma_{1,j}^2$:

$$\mathbb{E}_q[\log q(z)] = -\frac{d}{2}\log(2\pi) - \sum_{j=1}^d \log \sigma_{1,j} - \frac{d}{2}$$

This is $-\mathbb{H}[q] = -\frac{d}{2}(1 + \log(2\pi)) - \sum_j \log \sigma_{1,j}$.

**Term 2**: $\mathbb{E}_q[\log p(z)]$.

$$\log p(z) = -\frac{d}{2}\log(2\pi) - \sum_{j=1}^d \log \sigma_{2,j} - \frac{1}{2}\sum_{j=1}^d \frac{(z_j - \mu_{2,j})^2}{\sigma_{2,j}^2}$$

Taking the expectation under $q$:

$$\mathbb{E}_q\left[\frac{(z_j - \mu_{2,j})^2}{\sigma_{2,j}^2}\right] = \frac{\mathbb{E}_q[(z_j - \mu_{2,j})^2]}{\sigma_{2,j}^2} = \frac{\sigma_{1,j}^2 + (\mu_{1,j} - \mu_{2,j})^2}{\sigma_{2,j}^2}$$

(using $\mathbb{E}_q[(z_j - a)^2] = \text{Var}_q[z_j] + (\mathbb{E}_q[z_j] - a)^2 = \sigma_{1,j}^2 + (\mu_{1,j} - a)^2$)

So:

$$\mathbb{E}_q[\log p(z)] = -\frac{d}{2}\log(2\pi) - \sum_{j=1}^d \log \sigma_{2,j} - \frac{1}{2}\sum_{j=1}^d \frac{\sigma_{1,j}^2 + (\mu_{1,j} - \mu_{2,j})^2}{\sigma_{2,j}^2}$$

**Combining**:

$$D_{\text{KL}}(q \| p) = \sum_{j=1}^d \left[-\log \sigma_{1,j} - \frac{1}{2} + \log \sigma_{2,j} + \frac{\sigma_{1,j}^2 + (\mu_{1,j} - \mu_{2,j})^2}{2\sigma_{2,j}^2}\right]$$

$$= \sum_{j=1}^d \left[\log \frac{\sigma_{2,j}}{\sigma_{1,j}} + \frac{\sigma_{1,j}^2 + (\mu_{1,j} - \mu_{2,j})^2}{2\sigma_{2,j}^2} - \frac{1}{2}\right] \quad \blacksquare$$

**Special case**: $p = \mathcal{N}(0, I)$ (standard normal prior), used in standard VAEs:

$$D_{\text{KL}}(q_\phi(z \mid x) \| p(z)) = \frac{1}{2}\sum_{j=1}^d \left[\sigma_j^2(x) + \mu_j^2(x) - 1 - \log \sigma_j^2(x)\right]$$

where we set $\mu_2 = 0, \sigma_2 = 1$ and write $\mu_1 = \mu(x), \sigma_1 = \sigma(x)$.

### 3.6 The Full VAE Loss

Combining the reconstruction term (MC estimated) and the KL term (analytic), the VAE loss for a single datapoint is:

$$\mathcal{L}_{\text{VAE}}(\theta, \phi; x) = -\frac{1}{L}\sum_{\ell=1}^L \log p_\theta(x \mid z^{(\ell)}) + D_{\text{KL}}(q_\phi(z \mid x) \| p(z))$$

where $z^{(\ell)} = \mu_\phi(x) + \sigma_\phi(x) \odot \epsilon^{(\ell)}$, $\epsilon^{(\ell)} \sim \mathcal{N}(0, I)$, and $L$ is typically 1 in practice.

For binary data with a Bernoulli decoder, $-\log p_\theta(x \mid z)$ becomes binary cross-entropy:

$$-\log p_\theta(x \mid z) = -\sum_{i=1}^D [x_i \log \hat{x}_i + (1 - x_i) \log(1 - \hat{x}_i)]$$

where $\hat{x} = \sigma(f_\theta(z))$.

### 3.7 Posterior Collapse

**Definition 3.4 (Posterior Collapse).** Posterior collapse occurs when the approximate posterior $q_\phi(z \mid x)$ collapses to the prior $p(z)$ for all (or some dimensions of) $x$:

$$q_\phi(z \mid x) \approx p(z), \quad \forall x$$

In this regime, $D_{\text{KL}}(q_\phi \| p) \approx 0$, but the latent code carries no information about $x$, and the decoder relies solely on its own capacity (autoregressive power) to model $p(x)$.

**Why it happens — an optimization perspective:**

Consider the ELBO decomposition:

$$\mathcal{L} = \underbrace{\mathbb{E}_{q_\phi}[\log p_\theta(x \mid z)]}_{\text{improves with informative } z} - \underbrace{D_{\text{KL}}(q_\phi \| p)}_{\text{penalizes informative } z}$$

Early in training:
1. The decoder $p_\theta(x \mid z)$ has not yet learned to use $z$ effectively.
2. Increasing KL (by making $q_\phi$ informative) incurs an immediate cost.
3. The reconstruction benefit from informative $z$ is delayed until the decoder learns.
4. The optimizer takes the path of least resistance: keep $q_\phi \approx p$, let the decoder model $p(x)$ independently.

**Theorem 3.5 (Information Preference Property).** If $p_\theta(x \mid z)$ is a sufficiently powerful autoregressive model, then the global optimum of the ELBO satisfies $q_\phi(z \mid x) = p(z)$ and $p_\theta(x \mid z) = p(x)$.

*Proof sketch.* If the decoder can model $p(x)$ exactly without using $z$, then:
- $\mathbb{E}_{q}[\log p_\theta(x \mid z)] = \log p(x)$ regardless of $q$.
- The ELBO becomes $\log p(x) - D_{\text{KL}}(q \| p)$, maximized when $D_{\text{KL}} = 0$. $\blacksquare$

### 3.8 Solutions to Posterior Collapse

**KL Annealing** (Bowman et al., 2016): Gradually increase the weight of the KL term:

$$\mathcal{L}_\beta = \mathbb{E}_{q_\phi}[\log p_\theta(x \mid z)] - \beta(t) \cdot D_{\text{KL}}(q_\phi \| p)$$

where $\beta(t)$ increases from 0 to 1 over training. This gives the decoder time to learn to use $z$ before the KL penalty kicks in.

**Free Bits** (Kingma et al., 2016): Ensure a minimum KL per dimension:

$$\mathcal{L}_{\text{FB}} = \mathbb{E}_{q_\phi}[\log p_\theta(x \mid z)] - \sum_{j=1}^d \max(\lambda, D_{\text{KL}}(q_\phi(z_j \mid x) \| p(z_j)))$$

where $\lambda > 0$ (typically 0.125 to 0.5 nats per dimension). When $\text{KL}_j < \lambda$, there is no gradient pushing $q_\phi(z_j \mid x)$ toward the prior, allowing it to encode information.

**Cyclical Annealing** (Fu et al., 2019): Repeatedly cycle $\beta$ from 0 to 1:

$$\beta(t) = \min\left(1, \frac{t \mod T_{\text{cycle}}}{T_{\text{cycle}} / 2}\right)$$

This allows multiple opportunities for the model to break out of collapse.

### 3.9 Beta-VAE: Disentangled Representations

**Definition 3.6 (beta-VAE).** The beta-VAE modifies the ELBO by weighting the KL term:

$$\mathcal{L}_\beta = \mathbb{E}_{q_\phi}[\log p_\theta(x \mid z)] - \beta \cdot D_{\text{KL}}(q_\phi(z \mid x) \| p(z))$$

For $\beta > 1$, the model is more aggressively regularized, encouraging each latent dimension to capture a single, independent factor of variation — a property called **disentanglement**.

**Intuition**: With $\beta > 1$, the model is constrained in how much total information it can encode in $z$ (the "information bottleneck" is tighter). It therefore prioritizes the most salient, statistically independent factors.

**Disentanglement metrics**: The beta-VAE paper (Higgins et al., 2017) proposes a metric based on a classifier's ability to identify which factor was varied from latent traversals.

### 3.10 VQ-VAE: Discrete Latent Codes

**Motivation**: Continuous latent spaces can be difficult to use for downstream tasks and suffer from posterior collapse. VQ-VAE (van den Oord et al., 2017) replaces the continuous latent with a **discrete codebook**.

**Architecture**:

1. **Encoder** $z_e = f_\phi(x)$: maps input to a continuous embedding $z_e \in \mathbb{R}^d$.
2. **Quantization**: Find nearest codebook vector $e_k = \arg\min_{e_j \in \mathcal{E}} \|z_e - e_j\|_2$.
3. **Decoder** $p_\theta(x \mid e_k)$: reconstructs from the discrete code.

**Loss function**:

$$\mathcal{L}_{\text{VQ-VAE}} = \underbrace{\|x - \hat{x}\|^2}_{\text{reconstruction}} + \underbrace{\|\text{sg}[z_e] - e_k\|^2}_{\text{codebook loss}} + \underbrace{\beta\|z_e - \text{sg}[e_k]\|^2}_{\text{commitment loss}}$$

where $\text{sg}[\cdot]$ is the stop-gradient operator.

**Straight-through estimator**: Since the argmin is non-differentiable, gradients from the decoder to the encoder are passed through using:

$$z_q = z_e + \text{sg}[e_k - z_e]$$

In the forward pass, $z_q = e_k$. In the backward pass, $\nabla_{z_e} z_q = I$ (gradients flow as if $z_q = z_e$).

**Key advantage**: VQ-VAE does not use a KL term and cannot suffer from posterior collapse. The discrete bottleneck naturally forces the model to use the latent codes.

---

## 4. Algorithmic Derivation

### 4.1 VAE Training Algorithm

```
Algorithm: VAE Training
────────────────────────────────────────────────────────────────
Input: Dataset D = {x^(1), ..., x^(N)}, encoder q_φ, decoder p_θ
       prior p(z) = N(0, I), learning rate η, batch size B
       Optional: KL annealing schedule β(t)
Output: Trained parameters θ*, φ*

1. Initialize θ, φ randomly
2. For epoch = 1, 2, ...:
   3. For each minibatch {x^(b_1), ..., x^(b_B)} from D:

      # Encode: compute variational parameters
      4. For each x^(b_j):
         5. [μ_j, log σ²_j] = Encoder_φ(x^(b_j))     # [d], [d]

      # Reparameterize: sample latents
      6. For each j:
         7. ε_j ~ N(0, I_d)                             # [d]
         8. z_j = μ_j + σ_j ⊙ ε_j                      # [d]

      # Decode: compute reconstruction
      9. For each j:
         10. x̂_j = Decoder_θ(z_j)                       # [D]

      # Compute loss
      11. L_recon = -(1/B) Σ_j log p_θ(x^(b_j) | z_j)
      12. L_KL = (1/B) Σ_j KL(q_φ(z|x^(b_j)) || p(z))  # analytic
      13. L = L_recon + β(t) · L_KL

      # Update
      14. g_θ, g_φ = ∇_{θ,φ} L
      15. θ ← θ - η · g_θ
      16. φ ← φ - η · g_φ
```

**Complexity**: Per minibatch: $O(B \cdot (C_\text{enc} + C_\text{dec} + d))$ where $d$ is the latent dimension (for KL computation). The overall complexity per epoch is $O(N \cdot (C_\text{enc} + C_\text{dec}))$.

### 4.2 VQ-VAE Training Algorithm

```
Algorithm: VQ-VAE Training
────────────────────────────────────────────────────────────────
Input: Dataset D, encoder f_φ, decoder g_θ, codebook E = {e_1, ..., e_K}
       Commitment weight β, EMA decay γ (if using EMA updates)
Output: Trained parameters θ*, φ*, codebook E*

1. Initialize θ, φ randomly; Initialize E with K-means on encoder outputs
2. For each minibatch {x^(1), ..., x^(B)}:

   # Encode
   3. z_e^(j) = f_φ(x^(j))                    # [B, d]

   # Quantize (find nearest codebook entry)
   4. k_j = argmin_i ||z_e^(j) - e_i||²        # [B] (indices)
   5. z_q^(j) = e_{k_j}                         # [B, d]

   # Straight-through for decoder
   6. z_st^(j) = z_e^(j) + sg[z_q^(j) - z_e^(j)]   # forward: z_q, backward: z_e

   # Decode
   7. x̂^(j) = g_θ(z_st^(j))                    # [B, D]

   # Loss
   8. L_recon = ||x - x̂||²
   9. L_codebook = ||sg[z_e] - z_q||²           # move codebook toward encoder
   10. L_commit = β · ||z_e - sg[z_q]||²        # move encoder toward codebook
   11. L = L_recon + L_codebook + L_commit

   # Update (encoder + decoder via L; codebook via L_codebook or EMA)
   12. θ, φ ← θ, φ - η · ∇_{θ,φ} L
   13. Update codebook vectors via gradient or EMA
```

---

## 5. PyTorch Implementation

### 5.1 Standard VAE

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple

class VAE(nn.Module):
    """
    Variational Autoencoder with convolutional encoder/decoder.

    Architecture designed for 64x64 RGB images (e.g., CelebA).
    """

    def __init__(self, latent_dim: int = 128, in_channels: int = 3):
        super().__init__()
        self.latent_dim = latent_dim

        # --- Encoder ---
        # Input: [B, 3, 64, 64]
        self.encoder = nn.Sequential(
            nn.Conv2d(in_channels, 32, 4, 2, 1),   # [B, 32, 32, 32]
            nn.ReLU(),
            nn.Conv2d(32, 64, 4, 2, 1),             # [B, 64, 16, 16]
            nn.ReLU(),
            nn.Conv2d(64, 128, 4, 2, 1),            # [B, 128, 8, 8]
            nn.ReLU(),
            nn.Conv2d(128, 256, 4, 2, 1),           # [B, 256, 4, 4]
            nn.ReLU(),
            nn.Flatten(),                             # [B, 256*4*4] = [B, 4096]
        )

        self.fc_mu = nn.Linear(4096, latent_dim)       # [B, 4096] -> [B, d]
        self.fc_logvar = nn.Linear(4096, latent_dim)   # [B, 4096] -> [B, d]

        # --- Decoder ---
        # Input: [B, d]
        self.fc_decode = nn.Linear(latent_dim, 4096)   # [B, d] -> [B, 4096]

        self.decoder = nn.Sequential(
            nn.Unflatten(1, (256, 4, 4)),              # [B, 256, 4, 4]
            nn.ConvTranspose2d(256, 128, 4, 2, 1),    # [B, 128, 8, 8]
            nn.ReLU(),
            nn.ConvTranspose2d(128, 64, 4, 2, 1),     # [B, 64, 16, 16]
            nn.ReLU(),
            nn.ConvTranspose2d(64, 32, 4, 2, 1),      # [B, 32, 32, 32]
            nn.ReLU(),
            nn.ConvTranspose2d(32, in_channels, 4, 2, 1),  # [B, 3, 64, 64]
            nn.Sigmoid(),  # output in [0, 1] for Bernoulli likelihood
        )

    def encode(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Encode input to variational parameters.

        Args:
            x: [B, 3, 64, 64] input images
        Returns:
            mu: [B, d] posterior mean
            logvar: [B, d] posterior log-variance
        """
        h = self.encoder(x)          # [B, 4096]
        mu = self.fc_mu(h)           # [B, d]
        logvar = self.fc_logvar(h)   # [B, d]
        return mu, logvar

    def reparameterize(self, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        """
        Reparameterization trick.

        z = mu + sigma * epsilon,  epsilon ~ N(0, I)

        Args:
            mu: [B, d]
            logvar: [B, d]
        Returns:
            z: [B, d]
        """
        std = torch.exp(0.5 * logvar)  # [B, d]
        eps = torch.randn_like(std)     # [B, d]
        return mu + std * eps           # [B, d]

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        """
        Decode latent to image.

        Args:
            z: [B, d]
        Returns:
            x_recon: [B, 3, 64, 64] in [0, 1]
        """
        h = F.relu(self.fc_decode(z))  # [B, 4096]
        return self.decoder(h)          # [B, 3, 64, 64]

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Full forward pass.

        Args:
            x: [B, 3, 64, 64]
        Returns:
            x_recon: [B, 3, 64, 64]
            mu: [B, d]
            logvar: [B, d]
        """
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        x_recon = self.decode(z)
        return x_recon, mu, logvar

    def sample(self, n_samples: int, device: torch.device) -> torch.Tensor:
        """
        Sample from the model by sampling z ~ p(z) and decoding.

        Args:
            n_samples: number of samples
            device: torch device
        Returns:
            samples: [n_samples, 3, 64, 64]
        """
        z = torch.randn(n_samples, self.latent_dim, device=device)  # [n, d]
        return self.decode(z)  # [n, 3, 64, 64]


def vae_loss(
    x: torch.Tensor,
    x_recon: torch.Tensor,
    mu: torch.Tensor,
    logvar: torch.Tensor,
    beta: float = 1.0,
    free_bits: float = 0.0,
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Compute VAE loss = reconstruction + beta * KL.

    Args:
        x: [B, C, H, W] original images
        x_recon: [B, C, H, W] reconstructed images
        mu: [B, d] posterior mean
        logvar: [B, d] posterior log-variance
        beta: weight on KL term (1.0 for standard VAE, >1 for beta-VAE)
        free_bits: minimum KL per dimension (0 for standard VAE)
    Returns:
        loss: scalar, total loss
        recon_loss: scalar, reconstruction component
        kl_loss: scalar, KL component
    """
    B = x.shape[0]

    # Reconstruction: binary cross-entropy (Bernoulli decoder)
    # Sum over spatial/channel dims, average over batch
    recon_loss = F.binary_cross_entropy(
        x_recon, x, reduction='none'
    ).view(B, -1).sum(dim=1).mean()  # scalar

    # KL divergence: analytic for diagonal Gaussian vs standard normal
    # KL_j = 0.5 * (sigma_j^2 + mu_j^2 - 1 - log(sigma_j^2))
    kl_per_dim = 0.5 * (logvar.exp() + mu.pow(2) - 1 - logvar)  # [B, d]

    if free_bits > 0:
        # Free bits: clamp KL per dimension from below
        kl_per_dim = torch.clamp(kl_per_dim, min=free_bits)  # [B, d]

    kl_loss = kl_per_dim.sum(dim=1).mean()  # scalar

    loss = recon_loss + beta * kl_loss
    return loss, recon_loss, kl_loss
```

### 5.2 Training with KL Annealing

```python
import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

def kl_annealing_schedule(epoch: int, n_epochs: int, strategy: str = 'linear',
                          n_cycles: int = 4) -> float:
    """
    Compute beta for KL annealing.

    Args:
        epoch: current epoch
        n_epochs: total epochs
        strategy: 'linear', 'sigmoid', or 'cyclical'
        n_cycles: number of cycles (for cyclical)
    Returns:
        beta: float in [0, 1]
    """
    if strategy == 'linear':
        # Linear warmup over first half of training
        return min(1.0, 2.0 * epoch / n_epochs)
    elif strategy == 'sigmoid':
        midpoint = n_epochs // 2
        return float(1 / (1 + torch.exp(torch.tensor(-0.1 * (epoch - midpoint)))))
    elif strategy == 'cyclical':
        cycle_length = n_epochs // n_cycles
        position = epoch % cycle_length
        return min(1.0, 2.0 * position / cycle_length)
    else:
        return 1.0


def train_vae(
    model: VAE,
    train_loader: DataLoader,
    n_epochs: int = 100,
    lr: float = 1e-3,
    beta_strategy: str = 'linear',
    beta_max: float = 1.0,
    free_bits: float = 0.0,
    device: torch.device = torch.device('cpu'),
):
    """
    Train a VAE with optional KL annealing and free bits.

    Args:
        model: VAE model
        train_loader: DataLoader yielding (images, labels)
        n_epochs: number of epochs
        lr: learning rate
        beta_strategy: 'linear', 'cyclical', or 'none'
        beta_max: maximum beta value (1.0 for VAE, >1 for beta-VAE)
        free_bits: minimum KL per latent dimension
        device: torch device
    """
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    model.to(device)
    model.train()

    history = {'loss': [], 'recon': [], 'kl': [], 'beta': []}

    for epoch in range(n_epochs):
        # Compute current beta
        if beta_strategy == 'none':
            beta = beta_max
        else:
            beta = kl_annealing_schedule(epoch, n_epochs, beta_strategy) * beta_max

        epoch_loss, epoch_recon, epoch_kl = 0.0, 0.0, 0.0
        n_batches = 0

        for x_batch, _ in train_loader:
            x_batch = x_batch.to(device)  # [B, C, H, W]

            x_recon, mu, logvar = model(x_batch)
            loss, recon, kl = vae_loss(x_batch, x_recon, mu, logvar,
                                       beta=beta, free_bits=free_bits)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            epoch_recon += recon.item()
            epoch_kl += kl.item()
            n_batches += 1

        # Log
        avg_loss = epoch_loss / n_batches
        avg_recon = epoch_recon / n_batches
        avg_kl = epoch_kl / n_batches
        history['loss'].append(avg_loss)
        history['recon'].append(avg_recon)
        history['kl'].append(avg_kl)
        history['beta'].append(beta)

        if (epoch + 1) % 10 == 0:
            print(f"Epoch {epoch+1:4d} | beta={beta:.3f} | Loss={avg_loss:.1f} | "
                  f"Recon={avg_recon:.1f} | KL={avg_kl:.1f}")

    return history
```

### 5.3 Latent Space Visualization (Beta-VAE Traversals)

```python
import torch
import matplotlib.pyplot as plt

def latent_traversal(
    model: VAE,
    x: torch.Tensor,         # [1, C, H, W] single input image
    dim: int,                 # which latent dimension to traverse
    n_steps: int = 11,        # number of steps
    range_val: float = 3.0,   # range: [-range_val, +range_val]
    device: torch.device = torch.device('cpu'),
) -> torch.Tensor:
    """
    Generate latent traversal images by varying one dimension.

    Args:
        model: trained VAE
        x: [1, C, H, W] input to encode
        dim: latent dimension to vary
        n_steps: number of interpolation steps
        range_val: range of variation in standard deviations
        device: torch device
    Returns:
        images: [n_steps, C, H, W] traversal images
    """
    model.eval()
    x = x.to(device)

    with torch.no_grad():
        mu, logvar = model.encode(x)  # [1, d], [1, d]

    # Create n_steps copies of mu
    z = mu.expand(n_steps, -1).clone()  # [n_steps, d]

    # Vary the specified dimension
    values = torch.linspace(-range_val, range_val, n_steps, device=device)
    z[:, dim] = values

    with torch.no_grad():
        images = model.decode(z)  # [n_steps, C, H, W]

    return images


def visualize_traversals(
    model: VAE,
    x: torch.Tensor,          # [1, C, H, W]
    n_dims: int = 10,          # number of dimensions to traverse
    n_steps: int = 11,
    device: torch.device = torch.device('cpu'),
):
    """
    Visualize latent traversals for multiple dimensions.
    Each row shows one latent dimension being varied.

    Args:
        model: trained VAE
        x: [1, C, H, W] input image
        n_dims: number of latent dimensions to show
        n_steps: number of steps per traversal
        device: torch device
    """
    fig, axes = plt.subplots(n_dims, n_steps, figsize=(n_steps * 1.5, n_dims * 1.5))

    for d in range(n_dims):
        images = latent_traversal(model, x, dim=d, n_steps=n_steps, device=device)
        for s in range(n_steps):
            img = images[s].cpu().permute(1, 2, 0).numpy()  # [H, W, C]
            axes[d, s].imshow(img)
            axes[d, s].axis('off')
            if s == 0:
                axes[d, s].set_ylabel(f'dim {d}', fontsize=10)

    plt.suptitle('Latent Traversals (each row = one latent dimension)', fontsize=14)
    plt.tight_layout()
    plt.savefig('latent_traversals.png', dpi=150, bbox_inches='tight')
    plt.show()
```

### 5.4 VQ-VAE Core Components

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class VectorQuantizer(nn.Module):
    """
    Vector Quantization layer for VQ-VAE.

    Maps continuous encoder outputs to nearest codebook vectors.
    Uses straight-through estimator for gradients.
    """

    def __init__(self, n_embeddings: int = 512, embedding_dim: int = 64,
                 commitment_cost: float = 0.25, use_ema: bool = True,
                 ema_decay: float = 0.99):
        super().__init__()
        self.n_embeddings = n_embeddings      # K: codebook size
        self.embedding_dim = embedding_dim    # d: dimension of each code
        self.commitment_cost = commitment_cost
        self.use_ema = use_ema

        # Codebook: [K, d]
        self.embedding = nn.Embedding(n_embeddings, embedding_dim)
        self.embedding.weight.data.uniform_(-1/n_embeddings, 1/n_embeddings)

        if use_ema:
            self.register_buffer('ema_cluster_size', torch.zeros(n_embeddings))
            self.register_buffer('ema_embed_sum', self.embedding.weight.data.clone())
            self.ema_decay = ema_decay

    def forward(self, z_e: torch.Tensor):
        """
        Quantize encoder output.

        Args:
            z_e: [B, d, H', W'] continuous encoder output
        Returns:
            z_q: [B, d, H', W'] quantized output (straight-through)
            loss: scalar, VQ loss (codebook + commitment)
            encoding_indices: [B, H', W'] codebook indices
        """
        B, d, H, W = z_e.shape

        # Reshape: [B, d, H, W] -> [B*H*W, d]
        z_e_flat = z_e.permute(0, 2, 3, 1).reshape(-1, d)  # [BHW, d]

        # Compute distances to codebook vectors: ||z_e - e_k||^2
        # = ||z_e||^2 + ||e_k||^2 - 2 * z_e @ e_k^T
        distances = (
            z_e_flat.pow(2).sum(dim=1, keepdim=True)         # [BHW, 1]
            + self.embedding.weight.pow(2).sum(dim=1)         # [K]
            - 2 * z_e_flat @ self.embedding.weight.t()        # [BHW, K]
        )  # [BHW, K]

        # Find nearest codebook entry
        encoding_indices = distances.argmin(dim=1)  # [BHW]

        # Quantize
        z_q_flat = self.embedding(encoding_indices)  # [BHW, d]

        # Reshape back: [BHW, d] -> [B, H, W, d] -> [B, d, H, W]
        z_q = z_q_flat.reshape(B, H, W, d).permute(0, 3, 1, 2)  # [B, d, H, W]

        # Compute losses
        if self.use_ema and self.training:
            # EMA update for codebook
            self._ema_update(z_e_flat, encoding_indices)
            loss = self.commitment_cost * F.mse_loss(z_e_flat, z_q_flat.detach())
        else:
            # Standard VQ loss
            codebook_loss = F.mse_loss(z_q_flat, z_e_flat.detach())  # move codebook to encoder
            commitment_loss = F.mse_loss(z_e_flat, z_q_flat.detach())  # move encoder to codebook
            loss = codebook_loss + self.commitment_cost * commitment_loss

        # Straight-through estimator
        z_q_st = z_e + (z_q - z_e).detach()  # [B, d, H, W]

        encoding_indices = encoding_indices.reshape(B, H, W)  # [B, H, W]
        return z_q_st, loss, encoding_indices

    def _ema_update(self, z_e_flat: torch.Tensor, encoding_indices: torch.Tensor):
        """EMA update for codebook vectors."""
        # One-hot encoding
        encodings = F.one_hot(encoding_indices, self.n_embeddings).float()  # [BHW, K]

        # Update cluster sizes
        cluster_size = encodings.sum(dim=0)  # [K]
        self.ema_cluster_size.data.mul_(self.ema_decay).add_(
            cluster_size, alpha=1 - self.ema_decay
        )

        # Laplace smoothing
        n = self.ema_cluster_size.sum()
        self.ema_cluster_size.data.add_(1e-5).div_(
            n + self.n_embeddings * 1e-5
        ).mul_(n)

        # Update embedding sums
        embed_sum = encodings.t() @ z_e_flat  # [K, d]
        self.ema_embed_sum.data.mul_(self.ema_decay).add_(
            embed_sum, alpha=1 - self.ema_decay
        )

        # Update embedding weights
        self.embedding.weight.data.copy_(
            self.ema_embed_sum / self.ema_cluster_size.unsqueeze(1)
        )
```

---

## 6. Experimental Intuition

### 6.1 Reconstruction Quality vs. Beta

| Beta | Recon Loss | KL | Sample Quality | Disentanglement |
|:----:|:----------:|:--:|:--------------:|:---------------:|
| 0.5 | Low (sharp) | High | Poor (mode collapse) | Low |
| 1.0 | Medium | Medium | Good | Medium |
| 4.0 | High (blurry) | Low | Diverse | High |
| 10.0 | Very high | Very low | Very diverse | Highest |

**Key tradeoff**: Higher beta produces more disentangled representations but blurrier reconstructions. The "right" beta depends on the downstream task.

### 6.2 Effect of KL Annealing

Without annealing on a text VAE (Penn Treebank):
- KL collapses to ~0.1 nats within the first epoch.
- The decoder learns a near-perfect language model ignoring $z$.
- Generated samples show no latent structure.

With linear annealing over 10 epochs:
- KL gradually rises to ~6-8 nats.
- The decoder learns to use $z$ for global sentence properties.
- Interpolations in latent space show smooth transitions.

### 6.3 VQ-VAE Codebook Utilization

A common pathology: only a fraction of codebook entries are used ("codebook collapse"). Monitoring codebook usage ("perplexity of code usage") is essential:

$$\text{Perplexity} = \exp\left(-\sum_k p_k \log p_k\right)$$

where $p_k$ is the fraction of time code $k$ is selected. A well-utilized codebook of size $K$ should have perplexity close to $K$.

### 6.4 Latent Space Geometry

In a well-trained VAE:
- The aggregate posterior $q(z) = \frac{1}{N}\sum_i q_\phi(z \mid x^{(i)})$ approximately matches $p(z) = \mathcal{N}(0, I)$.
- Points sampled from the prior decode to realistic samples.
- Linear interpolations in latent space yield smooth transitions.

In a poorly trained VAE:
- "Holes" in the latent space: regions where $p(z) > 0$ but no $q_\phi(z \mid x)$ places mass.
- Sampling from the prior produces artifacts or unrealistic images.

---

## 7. Connections

### 7.1 Backward Connections

- **Lecture 07a (ELBO)**: The VAE loss is exactly the negative ELBO, with a specific parameterization choice.
- **Module 01 (Backprop/Autodiff)**: The reparameterization trick works because modern autodiff can differentiate through the sampling operation $z = \mu + \sigma \odot \epsilon$.
- **Module 02 (CNNs)**: VAE encoder/decoder architectures borrow heavily from CNN design (ResNet-style encoders, transposed convolutions for decoding).

### 7.2 Forward Connections

- **Lecture 07c (Flows)**: Normalizing flows can serve as a more expressive variational family $q_\phi(z \mid x)$, yielding tighter ELBOs.
- **Lecture 07d (Score Matching)**: The score function $\nabla_x \log p(x)$ can be estimated from a trained VAE, connecting to score-based models.
- **Module 08 (Diffusion)**: Diffusion models can be viewed as hierarchical VAEs with a specific encoder structure (the forward diffusion process).
- **Module 09 (Frontier)**: VQ-VAE is the foundation for modern image tokenizers used in multimodal models (DALL-E, Parti).

### 7.3 VAEs in the Modern Landscape

VAEs are no longer state-of-the-art for pure image generation (diffusion models dominate), but they remain critical for:
- **Representation learning**: Disentangled representations for downstream tasks.
- **Discrete tokenization**: VQ-VAE variants power image tokenizers in DALL-E, Stable Diffusion (latent space), and video generation.
- **Drug discovery and molecular generation**: VAEs over molecular graphs.
- **Anomaly detection**: Using the ELBO as an anomaly score.

---

## 8. Paper Reading List

### Required Reading

1. **Kingma, D.P., & Welling, M.** (2014). "Auto-Encoding Variational Bayes." *ICLR 2014.*
   - The foundational VAE paper. Focus on Sections 2 (method), 3 (reparameterization trick), and Appendix B (KL derivation).

2. **Higgins, I., Matthey, L., Pal, A., et al.** (2017). "beta-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework." *ICLR 2017.*
   - Introduces the beta-VAE and the disentanglement metric. Read for the experimental methodology.

### Recommended Reading

3. **van den Oord, A., Vinyals, O., & Kavukcuoglu, K.** (2017). "Neural Discrete Representation Learning." *NeurIPS 2017.*
   - The VQ-VAE paper. Key contribution: discrete latent codes via vector quantization.

4. **Bowman, S.R., Vilnis, L., Vinyals, O., et al.** (2016). "Generating Sentences from a Continuous Space." *CoNLL 2016.*
   - First diagnosis and treatment of posterior collapse in text VAEs. Introduces KL annealing.

5. **Razavi, A., van den Oord, A., & Vinyals, O.** (2019). "Generating Diverse High-Fidelity Images with VQ-VAE-2." *NeurIPS 2019.*
   - Hierarchical VQ-VAE achieving near state-of-the-art image quality.

6. **Kingma, D.P., Salimans, T., Jozefowicz, R., et al.** (2016). "Improved Variational Inference with Inverse Autoregressive Flow." *NeurIPS 2016.*
   - Introduces IAF for richer variational posteriors and the free bits technique.

### Deeper Dives

7. **Rezende, D.J., Mohamed, S., & Wierstra, D.** (2014). "Stochastic Backpropagation and Approximate Inference in Deep Generative Models." *ICML 2014.*
   - The concurrent VAE paper, with a different perspective on stochastic backpropagation.

8. **Hoffman, M.D., & Johnson, M.J.** (2016). "ELBO Surgery: Yet Another Way to Carve Up the Variational Evidence Lower Bound." *NeurIPS Workshop on Advances in Approximate Bayesian Inference.*
   - Decomposes the ELBO into mutual information and marginal KL terms, providing deeper insight into VAE training dynamics.

---

## 9. Exercises

### Theoretical Exercises

**Exercise 9.1** (Reparameterization for Non-Gaussians). Derive the reparameterization trick for:
(a) An exponential distribution: $q_\phi(z) = \text{Exp}(\lambda_\phi)$. Hint: use the inverse CDF.
(b) A mixture of Gaussians: $q_\phi(z) = \sum_k \pi_k \mathcal{N}(\mu_k, \sigma_k^2)$. What is the difficulty?
(c) A Bernoulli distribution: $q_\phi(z) = \text{Bern}(p_\phi)$. Why does the standard reparameterization fail? Describe the Gumbel-Softmax relaxation.

**Exercise 9.2** (KL Derivation). Derive the KL divergence $D_{\text{KL}}(\mathcal{N}(\mu_1, \Sigma_1) \| \mathcal{N}(\mu_2, \Sigma_2))$ for full (non-diagonal) covariance matrices. Show that the result is:

$$\frac{1}{2}\left[\text{tr}(\Sigma_2^{-1}\Sigma_1) + (\mu_2 - \mu_1)^T \Sigma_2^{-1}(\mu_2 - \mu_1) - d + \log\frac{|\Sigma_2|}{|\Sigma_1|}\right]$$

**Exercise 9.3** (Posterior Collapse Theory). Consider a linear VAE with encoder $\mu_\phi(x) = Ax + b$ and decoder $f_\theta(z) = Cz + d$, with $p(z) = \mathcal{N}(0, I)$ and $p_\theta(x \mid z) = \mathcal{N}(f_\theta(z), \sigma^2 I)$.
(a) Derive the optimal ELBO in closed form as a function of $A$, $C$, $\sigma^2$.
(b) Show that when $\sigma^2$ is large, the optimal $A \to 0$ (posterior collapse).
(c) Find the critical value of $\sigma^2$ where collapse occurs.

**Exercise 9.4** (IWAE Gradient). Show that the IWAE gradient estimator for $K > 1$ places more weight on "surprising" samples (those with large importance weights). Specifically, show:

$$\nabla_\phi \mathcal{L}_K = \mathbb{E}\left[\sum_{k=1}^K \tilde{w}_k \nabla_\phi \log q_\phi(z^{(k)} \mid x)\right]$$

where $\tilde{w}_k = w_k / \sum_j w_j$ are self-normalized importance weights.

### Programming Exercises

**Exercise 9.5** (Full VAE on CelebA). Using the provided VAE implementation:
(a) Train on CelebA (64x64) for 50 epochs with $d = 128$.
(b) Compare: no annealing, linear annealing, cyclical annealing (4 cycles).
(c) Plot the KL over training for each. Which avoids posterior collapse?
(d) Show reconstructions and random samples for each variant.

**Exercise 9.6** (Beta-VAE Disentanglement). Train beta-VAEs with $\beta \in \{0.5, 1, 2, 4, 10\}$:
(a) For each, compute latent traversals across all dimensions.
(b) Identify which dimensions correspond to interpretable factors (smile, azimuth, glasses, etc.).
(c) Plot reconstruction quality vs. disentanglement as a function of beta.

**Exercise 9.7** (VQ-VAE). Implement VQ-VAE:
(a) Build encoder, vector quantizer, and decoder for CIFAR-10 (32x32).
(b) Monitor codebook utilization (perplexity) during training.
(c) Implement EMA updates and compare with gradient-based codebook learning.
(d) Train a small PixelCNN prior over the discrete codes and generate samples.

**Exercise 9.8** (Comparison). On Fashion-MNIST:
(a) Train a standard VAE, a beta-VAE ($\beta = 4$), and a VQ-VAE.
(b) Compare: reconstruction MSE, FID score (if feasible), and latent space structure.
(c) For VAE and beta-VAE, interpolate between pairs of digits. For VQ-VAE, show the codebook entries.
