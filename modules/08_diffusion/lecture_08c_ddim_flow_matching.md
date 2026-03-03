# Lecture 08c: DDIM, Fast Sampling, and Flow Matching

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the DDIM (Denoising Diffusion Implicit Models) non-Markovian reverse process from first principles.
2. **Show** that DDIM is a discretization of the probability flow ODE for the VP-SDE.
3. **Explain** how DDIM enables deterministic sampling and interpolation in latent space.
4. **Derive** the flow matching objective and the conditional flow matching loss.
5. **Explain** optimal transport paths and rectified flows.
6. **Compare** DDPM, DDIM, and flow matching in terms of sampling speed, quality, and theoretical properties.
7. **Implement** DDIM sampling and flow matching training in PyTorch.

---

## 2. Motivation and Context

### 2.1 The Slow Sampling Problem

DDPM (Lecture 08a) requires $T \approx 1000$ sequential denoising steps to generate a single sample. Each step requires a full forward pass through the U-Net, making generation orders of magnitude slower than GANs or VAEs. For a $256 \times 256$ image with a standard U-Net, this translates to roughly 30 seconds on an A100 GPU --- far too slow for interactive applications.

The key insight of DDIM (Song, Meng, and Ermon, 2021) is that the DDPM training procedure does not commit us to DDPM's Markov chain for sampling. A different, non-Markovian reverse process can share the same marginals $q(x_t \mid x_0)$ and the same training objective, but allow deterministic sampling in far fewer steps.

### 2.2 Beyond Diffusion: Flow Matching

Flow matching (Lipman et al., 2023) takes a fundamentally different approach. Instead of defining a noising process and then learning to reverse it, flow matching directly regresses a vector field that transports a simple prior to the data distribution along straight-line (or near-straight) paths. This yields:

- Simpler training objectives (no need for noise schedule design).
- Straighter trajectories that require fewer ODE solver steps.
- Connections to optimal transport theory.

---

## 3. Core Theory

### 3.1 DDIM: Non-Markovian Forward Process

**Recall from DDPM.** The forward marginal is $q(x_t \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_t}\, x_0, (1 - \bar{\alpha}_t) I)$. In DDPM, this arises from the Markov chain $q(x_t \mid x_{t-1}) = \mathcal{N}(\sqrt{\alpha_t}\, x_{t-1}, \beta_t I)$. However, the marginals $q(x_t \mid x_0)$ do not uniquely determine the joint $q(x_{1:T} \mid x_0)$.

**Key observation (Song et al., 2021b).** There exists a family of non-Markovian forward processes indexed by a parameter $\sigma_t \geq 0$ that all share the same marginals $q(x_t \mid x_0)$.

**Definition 3.1 (DDIM Forward Process).** Define the joint:

$$q_\sigma(x_{1:T} \mid x_0) = q_\sigma(x_T \mid x_0) \prod_{t=2}^{T} q_\sigma(x_{t-1} \mid x_t, x_0)$$

where $q_\sigma(x_T \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_T}\, x_0, (1-\bar{\alpha}_T) I)$ and:

$$q_\sigma(x_{t-1} \mid x_t, x_0) = \mathcal{N}\!\left(\sqrt{\bar{\alpha}_{t-1}}\, x_0 + \sqrt{1 - \bar{\alpha}_{t-1} - \sigma_t^2}\cdot\frac{x_t - \sqrt{\bar{\alpha}_t}\, x_0}{\sqrt{1 - \bar{\alpha}_t}},\; \sigma_t^2 I\right)$$

**Proposition 3.2.** The marginal of this joint process at each timestep $t$ is $q_\sigma(x_t \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_t}\, x_0, (1 - \bar{\alpha}_t) I)$, regardless of the choice of $\{\sigma_t\}$.

*Proof.* We verify by induction. The base case $t = T$ holds by construction. For the inductive step, assume $q_\sigma(x_t \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_t}\, x_0, (1-\bar{\alpha}_t) I)$. We need to show that $q_\sigma(x_{t-1} \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_{t-1}}\, x_0, (1-\bar{\alpha}_{t-1}) I)$.

Write $x_{t-1}$ given $x_t$ and $x_0$ as:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}}\, x_0 + \sqrt{1 - \bar{\alpha}_{t-1} - \sigma_t^2} \cdot \frac{x_t - \sqrt{\bar{\alpha}_t}\, x_0}{\sqrt{1 - \bar{\alpha}_t}} + \sigma_t\, \varepsilon$$

where $\varepsilon \sim \mathcal{N}(0, I)$ is independent of $x_t$. The term $\frac{x_t - \sqrt{\bar{\alpha}_t} x_0}{\sqrt{1-\bar{\alpha}_t}}$ has distribution $\mathcal{N}(0, I)$ when $x_t \sim q_\sigma(x_t \mid x_0)$. Call this normalized noise $\hat{\varepsilon}$. Then:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}}\, x_0 + \sqrt{1 - \bar{\alpha}_{t-1} - \sigma_t^2}\, \hat{\varepsilon} + \sigma_t\, \varepsilon$$

Marginalizing over $x_t$ (equivalently, over $\hat{\varepsilon}$), the variance of the noise terms is:

$$(1 - \bar{\alpha}_{t-1} - \sigma_t^2) + \sigma_t^2 = 1 - \bar{\alpha}_{t-1}$$

So $q_\sigma(x_{t-1} \mid x_0) = \mathcal{N}(\sqrt{\bar{\alpha}_{t-1}}\, x_0, (1-\bar{\alpha}_{t-1}) I)$. $\blacksquare$

**Special cases:**
- $\sigma_t = \tilde{\beta}_t^{1/2} = \sqrt{\frac{(1-\bar{\alpha}_{t-1})\beta_t}{1-\bar{\alpha}_t}}$: recovers DDPM.
- $\sigma_t = 0$ for all $t$: the **DDIM deterministic** sampler. The reverse process is completely deterministic given $x_T$.

### 3.2 Deriving the DDIM Update Rule

Setting $\sigma_t = 0$ in the reverse posterior and substituting the learned noise prediction $\varepsilon_\theta(x_t, t)$ for the true noise:

**Step 1.** From $x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1-\bar{\alpha}_t}\, \varepsilon$, solve for $x_0$:

$$\hat{x}_0 = \frac{x_t - \sqrt{1-\bar{\alpha}_t}\, \varepsilon_\theta(x_t, t)}{\sqrt{\bar{\alpha}_t}}$$

**Step 2.** Substitute into the DDIM reverse step (with $\sigma_t = 0$):

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}}\, \hat{x}_0 + \sqrt{1-\bar{\alpha}_{t-1}} \cdot \frac{x_t - \sqrt{\bar{\alpha}_t}\, \hat{x}_0}{\sqrt{1-\bar{\alpha}_t}}$$

**Step 3.** Expanding $\hat{x}_0$:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \cdot \frac{x_t - \sqrt{1-\bar{\alpha}_t}\, \varepsilon_\theta(x_t, t)}{\sqrt{\bar{\alpha}_t}} + \sqrt{1-\bar{\alpha}_{t-1}}\, \varepsilon_\theta(x_t, t)$$

This is the **DDIM update rule**:

$$\boxed{x_{t-1} = \sqrt{\bar{\alpha}_{t-1}}\left(\frac{x_t - \sqrt{1-\bar{\alpha}_t}\, \varepsilon_\theta(x_t,t)}{\sqrt{\bar{\alpha}_t}}\right) + \sqrt{1-\bar{\alpha}_{t-1}}\, \varepsilon_\theta(x_t,t)}$$

Or equivalently, in the "predict $x_0$, then re-noise" form:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}}\, \hat{x}_0 + \sqrt{1-\bar{\alpha}_{t-1}}\, \varepsilon_\theta(x_t, t)$$

### 3.3 DDIM with Fewer Steps

A crucial advantage of DDIM: since the update only depends on $\bar{\alpha}_t$ and $\bar{\alpha}_{t-1}$ (not on intermediate steps), we can sub-sample a subsequence $\tau = \{t_1, t_2, \ldots, t_S\} \subset \{1, \ldots, T\}$ with $S \ll T$ and apply the DDIM update only at these timesteps.

For example, with $T = 1000$ and $S = 50$, we use $\tau = \{20, 40, 60, \ldots, 1000\}$ and apply:

$$x_{\tau_{i-1}} = \sqrt{\bar{\alpha}_{\tau_{i-1}}}\left(\frac{x_{\tau_i} - \sqrt{1-\bar{\alpha}_{\tau_i}}\, \varepsilon_\theta(x_{\tau_i}, \tau_i)}{\sqrt{\bar{\alpha}_{\tau_i}}}\right) + \sqrt{1-\bar{\alpha}_{\tau_{i-1}}}\, \varepsilon_\theta(x_{\tau_i}, \tau_i)$$

This uses only $S = 50$ neural network evaluations instead of 1000.

### 3.4 DDIM as Probability Flow ODE Discretization

**Theorem 3.3.** The DDIM update rule is a first-order (Euler) discretization of the probability flow ODE for the VP-SDE.

*Proof.* The probability flow ODE for the VP-SDE (from Lecture 08b) is:

$$\frac{dx}{dt} = -\frac{1}{2}\beta(t)\bigl[x + \nabla_x \log p_t(x)\bigr]$$

Using the relationship $\nabla_x \log p_t(x) \approx -\varepsilon_\theta(x, t)/\sqrt{1-\bar{\alpha}_t}$ and the change of variable from continuous time to the discrete $\bar{\alpha}_t$ schedule:

Define $\alpha = \bar{\alpha}_t$ as the "time" variable. The ODE becomes:

$$\frac{dx}{d\alpha} = \frac{x - \varepsilon_\theta(x, t(\alpha))/\sqrt{1-\alpha}}{2\alpha} \cdot (-1)$$

The Euler step from $\alpha_t = \bar{\alpha}_t$ to $\alpha_{t-1} = \bar{\alpha}_{t-1}$ gives:

$$x_{t-1} - x_t = \frac{x_t/\sqrt{\bar{\alpha}_t} - \varepsilon_\theta \cdot \sqrt{1-\bar{\alpha}_t}/\bar{\alpha}_t}{2} \cdot (\bar{\alpha}_{t-1} - \bar{\alpha}_t) + \ldots$$

A cleaner way to see the equivalence: reparametrize the ODE using $x_t = \sqrt{\bar{\alpha}_t}\, \hat{x}_0(t) + \sqrt{1-\bar{\alpha}_t}\, \hat{\varepsilon}(t)$ and note that DDIM updates this decomposition by holding the predicted noise constant between steps, which is exactly the Euler method applied to the ODE in this coordinate system. $\blacksquare$

### 3.5 DDIM Properties

1. **Deterministic mapping**: $x_T \mapsto x_0$ is a fixed function. This enables:
   - **Latent space interpolation**: interpolate between $x_T^{(1)}$ and $x_T^{(2)}$ in noise space, then decode deterministically.
   - **Image editing**: encode $x_0 \to x_T$ (run DDIM forward), edit $x_T$, decode $x_T \to x_0$.
   - **Reconstruction**: the same $x_T$ always produces the same $x_0$.

2. **Consistency**: DDIM samples are consistent across different numbers of steps $S$. Using more steps refines the same trajectory rather than generating a different sample.

3. **Stochastic variant**: Setting $\sigma_t > 0$ interpolates between DDIM ($\sigma_t = 0$, deterministic) and DDPM ($\sigma_t = \tilde{\beta}_t^{1/2}$, fully stochastic). The parameter $\eta \in [0, 1]$ with $\sigma_t = \eta \tilde{\beta}_t^{1/2}$ controls this interpolation.

### 3.6 Flow Matching: Setup

Flow matching (Lipman et al., 2023) takes a different approach to generative modeling. Instead of defining a noising process and learning to reverse it, we directly learn a velocity field that transports a prior distribution to the data distribution.

**Definition 3.4 (Probability Path).** A probability path is a time-indexed family of distributions $\{p_t\}_{t \in [0,1]}$ with $p_0 = \mathcal{N}(0, I)$ (prior) and $p_1 = p_{\text{data}}$ (data).

**Definition 3.5 (Velocity Field).** A time-dependent velocity field $u_t: \mathbb{R}^d \times [0,1] \to \mathbb{R}^d$ generates a probability path if the ODE $\frac{dx}{dt} = u_t(x)$ transforms samples from $p_0$ to $p_1$.

**Relationship to continuity equation.** The velocity field and the probability path are related by the continuity equation:

$$\frac{\partial p_t}{\partial t} + \nabla \cdot (u_t p_t) = 0$$

### 3.7 The Flow Matching Objective

**Definition 3.6 (Flow Matching Loss).** The flow matching objective is:

$$\mathcal{L}_{\text{FM}}(\theta) = \mathbb{E}_{t \sim \mathcal{U}[0,1]} \mathbb{E}_{x \sim p_t}\bigl[\|v_\theta(x, t) - u_t(x)\|^2\bigr]$$

where $v_\theta$ is the learned velocity field and $u_t$ is the target velocity field that generates the probability path $\{p_t\}$.

**Problem:** Computing $u_t(x)$ requires knowing $p_t$ and solving the continuity equation, which is intractable in general.

### 3.8 Conditional Flow Matching

**Theorem 3.7 (Lipman et al., 2023).** The flow matching loss can be decomposed as:

$$\mathcal{L}_{\text{FM}}(\theta) = \mathbb{E}_{t} \mathbb{E}_{x \sim p_t}\bigl[\|v_\theta(x,t)\|^2\bigr] - 2\mathbb{E}_{t} \mathbb{E}_{x \sim p_t}\bigl[v_\theta(x,t) \cdot u_t(x)\bigr] + C$$

The cross term can be rewritten using **conditional** quantities. Define a conditional probability path:

$$p_t(x \mid x_1) = \mathcal{N}\bigl(t\, x_1,\, (1-(1-\sigma_{\min})t)^2 I\bigr)$$

and a conditional velocity field:

$$u_t(x \mid x_1) = \frac{x_1 - (1-\sigma_{\min}) x}{1 - (1-\sigma_{\min})t}$$

**The Conditional Flow Matching (CFM) Loss:**

$$\mathcal{L}_{\text{CFM}}(\theta) = \mathbb{E}_{t \sim \mathcal{U}[0,1]} \mathbb{E}_{x_1 \sim p_{\text{data}}} \mathbb{E}_{x \sim p_t(\cdot \mid x_1)}\bigl[\|v_\theta(x, t) - u_t(x \mid x_1)\|^2\bigr]$$

**Theorem 3.8.** $\mathcal{L}_{\text{CFM}}$ and $\mathcal{L}_{\text{FM}}$ have the same gradients with respect to $\theta$.

*Proof.* It suffices to show the cross terms match:

$$\mathbb{E}_{x \sim p_t}\bigl[v_\theta(x,t) \cdot u_t(x)\bigr] = \mathbb{E}_{x_1} \mathbb{E}_{x \sim p_t(\cdot|x_1)}\bigl[v_\theta(x,t) \cdot u_t(x \mid x_1)\bigr]$$

This follows from the decomposition $p_t(x) = \int p_t(x \mid x_1) p_{\text{data}}(x_1)\, dx_1$ and the identity $u_t(x) p_t(x) = \int u_t(x \mid x_1) p_t(x \mid x_1) p_{\text{data}}(x_1)\, dx_1$, which holds because the marginal velocity is the mixture of conditional velocities. $\blacksquare$

### 3.9 Optimal Transport Conditional Flow Matching

**Definition 3.9 (OT-CFM).** The simplest and most common choice uses straight-line interpolation between noise and data:

$$x_t = (1-t)\, x_0 + t\, x_1, \quad x_0 \sim \mathcal{N}(0, I),\; x_1 \sim p_{\text{data}}$$

The conditional velocity field for this path is:

$$u_t(x \mid x_0, x_1) = x_1 - x_0$$

and the conditional flow matching loss simplifies to:

$$\mathcal{L}_{\text{OT-CFM}}(\theta) = \mathbb{E}_{t, x_0, x_1}\bigl[\|v_\theta(x_t, t) - (x_1 - x_0)\|^2\bigr]$$

where $x_t = (1-t) x_0 + t x_1$.

**Interpretation:** The model learns to predict the direction from noise to data along a straight line. This is analogous to DDPM's noise prediction, but with a much simpler geometric interpretation.

### 3.10 Rectified Flows

**Definition 3.10 (Liu et al., 2022).** A rectified flow is obtained by the following procedure:

1. **Train** a flow matching model $v_\theta$ using OT-CFM.
2. **Generate** paired data: for each noise sample $x_0 \sim \mathcal{N}(0,I)$, solve the ODE $dx/dt = v_\theta(x,t)$ to obtain $x_1$.
3. **Retrain** a new model $v_{\theta'}$ on the generated pairs $(x_0, x_1)$ using OT-CFM.

**Theorem 3.11 (Straightening, informal).** Each iteration of the rectified flow procedure produces straighter trajectories. In the limit, the trajectories converge to straight lines (constant velocity), enabling single-step generation.

*Intuition.* After the first training, the ODE trajectories may curve because different data points share the same noise region. The retraining step uses the actual ODE coupling (not random pairing), which reduces trajectory crossing and straightens the paths.

**Practical impact:** After 2-3 rounds of rectification, flows can generate decent images in 1-5 ODE steps, compared to 20-100 for standard diffusion/flow models.

### 3.11 Comparison: DDPM vs. DDIM vs. Flow Matching

| Property | DDPM | DDIM | Flow Matching (OT-CFM) |
|----------|------|------|----------------------|
| Sampling process | Stochastic (SDE) | Deterministic (ODE) | Deterministic (ODE) |
| Training loss | $\Vert\varepsilon - \varepsilon_\theta(x_t,t)\Vert^2$ | Same as DDPM | $\Vert v_\theta(x_t,t) - (x_1-x_0)\Vert^2$ |
| Min. sampling steps | $\sim$1000 for good quality | $\sim$20-50 | $\sim$10-30 |
| Noise schedule | Required (linear/cosine) | Inherits from DDPM | Not needed |
| Trajectory shape | Random walk | Curved ODE paths | Near-straight lines |
| Latent interpolation | Not meaningful | Smooth and meaningful | Smooth and meaningful |
| Exact likelihood | No (lower bound) | Yes (via ODE) | Yes (via ODE) |
| Framework | Discrete Markov chain | Non-Markovian | Continuous normalizing flow |

---

## 4. Algorithmic Derivation

### 4.1 DDIM Sampling

```
Algorithm 1: DDIM Sampling
─────────────────────────────────────────
Input: trained ε_θ, schedule {ᾱ_t}, subsequence τ = {τ_1,...,τ_S}, η ∈ [0,1]

x_{τ_S} ~ N(0, I)                         # Start from noise

for i = S, S-1, ..., 1:
    t = τ_i,  s = τ_{i-1}  (with τ_0 = 0)

    # Predict x_0
    x̂_0 = (x_t - √(1-ᾱ_t) · ε_θ(x_t, t)) / √ᾱ_t

    # Optional: clip x̂_0 to [-1, 1]

    # Compute σ for stochastic variant
    σ = η · √((1-ᾱ_s)/(1-ᾱ_t)) · √(1-ᾱ_t/ᾱ_s)

    # Direction pointing to x_t
    dir = √(1-ᾱ_s-σ²) · ε_θ(x_t, t)

    # Noise (zero for deterministic DDIM)
    z ~ N(0, I) if i > 1 else z = 0

    x_s = √ᾱ_s · x̂_0 + dir + σ · z

return x_0
```

**Complexity:** $S$ forward passes through $\varepsilon_\theta$, where $S$ can be 10-100x smaller than $T$.

### 4.2 Flow Matching Training (OT-CFM)

```
Algorithm 2: OT-CFM Training
─────────────────────────────────────────
Input: dataset D, velocity network v_θ, learning rate η

repeat:
    x_1 ~ D                              # Sample data
    x_0 ~ N(0, I)                        # Sample noise
    t ~ Uniform(0, 1)                    # Sample time
    x_t = (1-t) · x_0 + t · x_1          # Linear interpolation
    target = x_1 - x_0                    # Velocity target
    L = ||v_θ(x_t, t) - target||²        # Flow matching loss
    θ ← θ - η · ∇_θ L
until converged
```

**Complexity per step:** One forward + one backward pass through $v_\theta$. Same as DDPM training. Note the simplicity: no noise schedule to compute, no $\bar{\alpha}_t$ values needed.

### 4.3 Flow Matching Sampling

```
Algorithm 3: Flow Matching ODE Sampling
─────────────────────────────────────────
Input: trained v_θ, N steps

x ~ N(0, I)                              # Start from prior (t=0)
dt = 1/N

for i = 0, 1, ..., N-1:
    t = i/N
    x ← x + v_θ(x, t) · dt              # Euler step

return x                                  # Final sample at t=1
```

For higher accuracy, use Heun's method (2nd order) or higher-order Runge-Kutta solvers.

### 4.4 Rectified Flow Training

```
Algorithm 4: Rectified Flow (One Iteration)
─────────────────────────────────────────
Input: trained v_θ from previous round, dataset D

# Step 1: Generate couplings
for each x_0^(i) ~ N(0, I):
    Solve ODE dx/dt = v_θ(x,t) from t=0 to t=1  →  x_1^(i)
    Store pair (x_0^(i), x_1^(i))

# Step 2: Retrain with straight-line targets
repeat:
    Sample pair (x_0, x_1) from stored pairs
    t ~ Uniform(0, 1)
    x_t = (1-t) · x_0 + t · x_1
    L = ||v_{θ'}(x_t, t) - (x_1 - x_0)||²
    θ' ← θ' - η · ∇_{θ'} L
until converged

return v_{θ'}
```

---

## 5. PyTorch Implementation

### 5.1 DDIM Sampler

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class DDIMSampler:
    """DDIM sampler that uses a pre-trained DDPM noise prediction model."""

    def __init__(
        self,
        eps_model: nn.Module,
        alphas_cumprod: torch.Tensor,
        T: int = 1000,
    ):
        """
        Args:
            eps_model: trained ε_θ(x_t, t) noise prediction network
            alphas_cumprod: (T,) tensor of ᾱ_t values from DDPM training
            T: total number of diffusion timesteps
        """
        self.eps_model = eps_model
        self.alphas_cumprod = alphas_cumprod  # (T,)
        self.T = T

    def _get_subsequence(self, S: int) -> list:
        """Create a uniformly-spaced subsequence of S timesteps from [0, T-1].

        Args:
            S: number of sampling steps

        Returns:
            list of S+1 timestep indices including 0
        """
        step = self.T // S
        # τ_S, τ_{S-1}, ..., τ_1, 0
        seq = list(range(0, self.T, step))  # [0, step, 2*step, ...]
        return seq

    @torch.no_grad()
    def sample(
        self,
        shape: tuple,
        device: torch.device,
        S: int = 50,
        eta: float = 0.0,
        clip_x0: bool = True,
    ) -> torch.Tensor:
        """Generate samples using DDIM.

        Args:
            shape: (B, C, H, W) desired output shape
            device: torch device
            S: number of sampling steps (S << T for fast sampling)
            eta: interpolation parameter; 0 = deterministic DDIM, 1 ≈ DDPM
            clip_x0: whether to clip predicted x_0 to [-1, 1]

        Returns:
            x: (B, C, H, W) generated samples
        """
        # Build reversed timestep subsequence: [T-1, T-1-step, ..., step, 0]
        subsequence = self._get_subsequence(S)  # ascending
        timesteps = list(reversed(subsequence))   # descending

        # Start from pure noise
        x = torch.randn(shape, device=device)    # (B, C, H, W)

        for i in range(len(timesteps) - 1):
            t_cur = timesteps[i]                  # current timestep
            t_next = timesteps[i + 1]             # next timestep (smaller)

            t_batch = torch.full((shape[0],), t_cur, device=device, dtype=torch.long)

            # ᾱ values
            alpha_bar_t = self.alphas_cumprod[t_cur]        # scalar
            alpha_bar_s = self.alphas_cumprod[t_next]       # scalar

            # Predict noise
            eps_pred = self.eps_model(x, t_batch)           # (B, C, H, W)

            # Predict x_0
            x0_pred = (x - (1 - alpha_bar_t).sqrt() * eps_pred) / alpha_bar_t.sqrt()
            if clip_x0:
                x0_pred = x0_pred.clamp(-1, 1)             # (B, C, H, W)

            # Compute σ for stochastic variant
            if eta > 0 and t_next > 0:
                sigma = eta * (
                    (1 - alpha_bar_s) / (1 - alpha_bar_t) * (1 - alpha_bar_t / alpha_bar_s)
                ).sqrt()
            else:
                sigma = 0.0

            # Direction pointing to x_t
            coeff = (1 - alpha_bar_s - sigma**2).sqrt() if isinstance(sigma, float) and sigma == 0 \
                else torch.sqrt(torch.clamp(1 - alpha_bar_s - sigma**2, min=0))
            direction = coeff * eps_pred                    # (B, C, H, W)

            # Noise
            noise = torch.randn_like(x) if (isinstance(sigma, float) and sigma > 0) or \
                (torch.is_tensor(sigma) and sigma > 0) else 0

            # DDIM update
            x = alpha_bar_s.sqrt() * x0_pred + direction + sigma * noise  # (B, C, H, W)

        return x  # (B, C, H, W)

    @torch.no_grad()
    def encode(
        self,
        x0: torch.Tensor,
        S: int = 50,
    ) -> torch.Tensor:
        """Deterministic encoding: map x_0 to x_T via forward DDIM ODE.

        This is the inverse of deterministic DDIM sampling (eta=0).

        Args:
            x0: (B, C, H, W) clean images
            S: number of encoding steps

        Returns:
            xT: (B, C, H, W) latent codes
        """
        subsequence = self._get_subsequence(S)
        device = x0.device
        x = x0

        for i in range(len(subsequence) - 1):
            t_cur = subsequence[i]
            t_next = subsequence[i + 1]

            t_batch = torch.full((x.shape[0],), t_cur, device=device, dtype=torch.long)

            alpha_bar_t = self.alphas_cumprod[t_cur]
            alpha_bar_s = self.alphas_cumprod[t_next]

            eps_pred = self.eps_model(x, t_batch)
            x0_pred = (x - (1 - alpha_bar_t).sqrt() * eps_pred) / alpha_bar_t.sqrt()

            # Forward DDIM step (deterministic)
            x = alpha_bar_s.sqrt() * x0_pred + (1 - alpha_bar_s).sqrt() * eps_pred

        return x  # (B, C, H, W)
```

### 5.2 Flow Matching Module

```python
class FlowMatching(nn.Module):
    """Optimal-transport conditional flow matching (OT-CFM).

    The model learns a velocity field v_θ(x_t, t) that transports
    N(0, I) at t=0 to p_data at t=1 along straight-line paths.
    """

    def __init__(self, velocity_model: nn.Module, sigma_min: float = 1e-4):
        """
        Args:
            velocity_model: neural network v_θ(x, t) -> velocity
            sigma_min: minimum noise std for numerical stability
        """
        super().__init__()
        self.velocity_model = velocity_model
        self.sigma_min = sigma_min

    def compute_loss(self, x1: torch.Tensor) -> torch.Tensor:
        """Compute the OT-CFM loss.

        Args:
            x1: (B, C, H, W) data samples (convention: x_1 = data, x_0 = noise)

        Returns:
            loss: scalar tensor
        """
        B = x1.shape[0]
        device = x1.device

        # Sample noise and time
        x0 = torch.randn_like(x1)                              # (B, C, H, W)
        t = torch.rand(B, device=device)                        # (B,)

        # Linear interpolation
        t_expand = t[:, None, None, None]                       # (B, 1, 1, 1)
        xt = (1 - t_expand) * x0 + t_expand * x1               # (B, C, H, W)

        # Velocity target: x_1 - x_0 (straight-line direction)
        target = x1 - x0                                        # (B, C, H, W)

        # Velocity prediction
        v_pred = self.velocity_model(xt, t)                     # (B, C, H, W)

        return F.mse_loss(v_pred, target)                       # scalar

    @torch.no_grad()
    def sample_euler(
        self,
        shape: tuple,
        device: torch.device,
        N: int = 100,
    ) -> torch.Tensor:
        """Sample using Euler method for the ODE dx/dt = v_θ(x, t).

        Args:
            shape: (B, C, H, W)
            device: torch device
            N: number of Euler steps

        Returns:
            x: (B, C, H, W) generated samples
        """
        x = torch.randn(shape, device=device)                  # (B, C, H, W)
        dt = 1.0 / N

        for i in range(N):
            t = torch.full((shape[0],), i / N, device=device)  # (B,)
            v = self.velocity_model(x, t)                       # (B, C, H, W)
            x = x + v * dt                                      # (B, C, H, W)

        return x  # (B, C, H, W)

    @torch.no_grad()
    def sample_heun(
        self,
        shape: tuple,
        device: torch.device,
        N: int = 50,
    ) -> torch.Tensor:
        """Sample using Heun's method (2nd order) for the ODE.

        Args:
            shape: (B, C, H, W)
            device: torch device
            N: number of steps

        Returns:
            x: (B, C, H, W) generated samples
        """
        x = torch.randn(shape, device=device)                  # (B, C, H, W)
        dt = 1.0 / N

        for i in range(N):
            t_cur = i / N
            t_next = (i + 1) / N

            t_batch_cur = torch.full((shape[0],), t_cur, device=device)
            t_batch_next = torch.full((shape[0],), t_next, device=device)

            # Euler prediction
            v1 = self.velocity_model(x, t_batch_cur)            # (B, C, H, W)
            x_euler = x + v1 * dt                                # (B, C, H, W)

            # Correction
            v2 = self.velocity_model(x_euler, t_batch_next)     # (B, C, H, W)
            x = x + 0.5 * (v1 + v2) * dt                        # (B, C, H, W)

        return x  # (B, C, H, W)
```

### 5.3 Flow Matching Training Loop

```python
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader


def train_flow_matching(
    epochs: int = 100,
    batch_size: int = 128,
    lr: float = 2e-4,
    device: str = "cuda",
):
    """Train flow matching on CIFAR-10."""
    transform = transforms.Compose([
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
    ])
    dataset = torchvision.datasets.CIFAR10(
        root="./data", train=True, download=True, transform=transform
    )
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=4)

    # Use the same U-Net architecture, but now it predicts velocity instead of noise.
    # The time input is now continuous in [0, 1] instead of discrete in {0, ..., T-1}.
    # We use a TimeConditionedUNet that accepts continuous time.
    from lecture_08a_ddpm import SimpleUNet  # reuse architecture

    velocity_net = SimpleUNet(in_channels=3, time_dim=256).to(device)
    fm = FlowMatching(velocity_net).to(device)
    optimizer = torch.optim.Adam(fm.parameters(), lr=lr)

    for epoch in range(epochs):
        total_loss = 0.0
        for images, _ in loader:
            images = images.to(device)                           # (B, 3, 32, 32)
            loss = fm.compute_loss(images)                       # scalar
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(fm.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(loader)
        print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")

        if (epoch + 1) % 10 == 0:
            samples = fm.sample_heun((16, 3, 32, 32), device=device, N=50)
            samples = (samples.clamp(-1, 1) + 1) / 2
            grid = torchvision.utils.make_grid(samples, nrow=4)
            torchvision.utils.save_image(grid, f"fm_samples_epoch_{epoch+1}.png")

    return fm
```

### 5.4 Comparing Samplers

```python
@torch.no_grad()
def compare_samplers(
    ddpm_model,      # trained DDPM model
    fm_model,        # trained flow matching model
    device: str = "cuda",
):
    """Compare DDPM, DDIM, and flow matching sampling speed and quality."""
    import time

    shape = (64, 3, 32, 32)
    results = {}

    # DDPM (1000 steps)
    start = time.time()
    samples_ddpm = ddpm_model.sample(shape, device=torch.device(device))
    results["DDPM (1000)"] = time.time() - start

    # DDIM (50 steps)
    ddim = DDIMSampler(ddpm_model.eps_model, ddpm_model.alphas_cumprod, ddpm_model.T)
    start = time.time()
    samples_ddim_50 = ddim.sample(shape, device=torch.device(device), S=50, eta=0.0)
    results["DDIM (50)"] = time.time() - start

    # DDIM (10 steps)
    start = time.time()
    samples_ddim_10 = ddim.sample(shape, device=torch.device(device), S=10, eta=0.0)
    results["DDIM (10)"] = time.time() - start

    # Flow Matching Euler (50 steps)
    start = time.time()
    samples_fm_euler = fm_model.sample_euler(shape, device=torch.device(device), N=50)
    results["FM Euler (50)"] = time.time() - start

    # Flow Matching Heun (25 steps = 50 NFE)
    start = time.time()
    samples_fm_heun = fm_model.sample_heun(shape, device=torch.device(device), N=25)
    results["FM Heun (25)"] = time.time() - start

    print("\nSampling Time Comparison:")
    print("-" * 40)
    for method, t in results.items():
        print(f"  {method:20s}: {t:.2f}s")

    return {
        "ddpm": samples_ddpm,
        "ddim_50": samples_ddim_50,
        "ddim_10": samples_ddim_10,
        "fm_euler": samples_fm_euler,
        "fm_heun": samples_fm_heun,
    }
```

---

## 6. Experimental Intuition

### 6.1 DDIM Step Count vs. Quality

| Steps $S$ | NFE | FID (CIFAR-10) | Notes |
|-----------|-----|-----------------|-------|
| 10 | 10 | ~30-40 | Noticeable artifacts |
| 20 | 20 | ~10-15 | Reasonable quality |
| 50 | 50 | ~5-8 | Good quality |
| 100 | 100 | ~4-5 | Near-DDPM quality |
| 1000 | 1000 | ~3-5 | Same as DDPM |

The relationship is roughly logarithmic: doubling $S$ gives diminishing returns. The sweet spot for practice is typically $S \in [20, 50]$.

### 6.2 The Effect of $\eta$ in DDIM

- $\eta = 0$: Deterministic DDIM. Best for few-step generation and latent manipulation. Slightly lower diversity.
- $\eta = 0.5$: Moderate stochasticity. Good balance of diversity and quality.
- $\eta = 1$: Approximately DDPM-like stochasticity. Better diversity but needs more steps for quality.

### 6.3 Flow Matching: Trajectory Straightness

The key advantage of flow matching is that straight-line trajectories are easier for ODE solvers. Empirically:
- **Diffusion (probability flow ODE)**: Trajectories curve significantly, especially at early/late times. Euler method introduces large truncation errors.
- **Flow matching (OT-CFM)**: Trajectories are nearly straight after training. Euler method is nearly exact.
- **Rectified flows**: After 2 rounds of rectification, trajectories are almost perfectly straight, enabling 1-step generation.

### 6.4 When to Use Which Method

- **DDPM**: When you need maximum diversity and can afford slow sampling. Good for training; use DDIM for deployment.
- **DDIM**: The standard choice for deployment of DDPM-trained models. Enables fast sampling and deterministic generation.
- **Flow matching**: The modern default for new projects. Simpler training, faster convergence, better few-step quality.

---

## 7. Connections

### 7.1 Connection to DDPM (Lecture 08a)

DDIM uses the same trained model as DDPM --- only the sampling procedure differs. This means any DDPM model can be used with DDIM sampling at no extra training cost.

### 7.2 Connection to Score-SDE (Lecture 08b)

DDIM is a discretization of the probability flow ODE for the VP-SDE. This connection is made precise in Section 3.4. The probability flow ODE provides the continuous-time generalization, while DDIM provides the practical discrete algorithm.

### 7.3 Connection to Normalizing Flows

Flow matching models are continuous normalizing flows (CNFs) with a particular training strategy. Unlike Neural ODEs (Chen et al., 2018) which train via the adjoint method and backpropagate through the ODE solver, flow matching provides a simulation-free training objective.

### 7.4 Connection to Optimal Transport

The straight-line paths in OT-CFM define a transport plan between $\mathcal{N}(0, I)$ and $p_{\text{data}}$. While not the optimal transport map in general (which requires solving a Monge-Kantorovich problem), the name reflects the use of displacement interpolation --- a key concept in optimal transport theory (Benamou-Brenier formulation).

### 7.5 Forward Reference: Guidance (Lecture 08d)

All methods in this lecture can be combined with guidance techniques (Lecture 08d) for conditional generation. Classifier-free guidance works with DDIM sampling and with flow matching ODE sampling.

---

## 8. Paper Reading List

### Required Reading

1. **Song, J., Meng, C., and Ermon, S.** (2021). "Denoising Diffusion Implicit Models." *ICLR 2021.*
   Focus: Sections 3-4 (the non-Markovian forward process and the DDIM update rule). Understand how the same marginals $q(x_t \mid x_0)$ allow different sampling procedures.

2. **Lipman, Y., Chen, R. T. Q., Ben-Hamu, H., Nickel, M., and Le, M.** (2023). "Flow Matching for Generative Modeling." *ICLR 2023.*
   Focus: Sections 3-4 (conditional flow matching derivation). Compare the simplicity of the OT-CFM loss with the DDPM loss derivation.

### Recommended Reading

3. **Liu, X., Gong, C., and Liu, Q.** (2022). "Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flows." *ICLR 2023.*
   Focus: The rectification procedure and the empirical demonstration of trajectory straightening.

4. **Lu, C., Zhou, Y., Bao, F., Chen, J., Li, C., and Zhu, J.** (2022). "DPM-Solver: A Fast ODE Solver for Diffusion Probabilistic Model Sampling in Around 10 Steps." *NeurIPS 2022.*
   Focus: High-order solvers tailored for diffusion ODEs. DPM-Solver achieves good quality in 10-20 steps.

5. **Karras, T., Aittala, M., Aila, T., and Laine, S.** (2022). "Elucidating the Design Space of Diffusion-Based Generative Models." *NeurIPS 2022.*
   Focus: A systematic study of design choices (noise schedules, sampling, preconditioning) that improve both training and sampling.

---

## 9. Exercises

### Exercise 9.1: DDIM Derivation (Pen-and-Paper)

**(a)** Starting from the DDIM family of reverse posteriors $q_\sigma(x_{t-1} \mid x_t, x_0)$ in Definition 3.1, verify that the marginal $q_\sigma(x_t \mid x_0)$ is independent of $\sigma_t$ by computing $q_\sigma(x_{t-1} \mid x_0) = \int q_\sigma(x_{t-1} \mid x_t, x_0)\, q(x_t \mid x_0)\, dx_t$.

**(b)** Show that setting $\sigma_t = \sqrt{(1-\bar{\alpha}_{t-1})/(1-\bar{\alpha}_t)} \cdot \sqrt{\beta_t}$ recovers the DDPM reverse posterior from Lecture 08a, Theorem 3.4.

**(c)** Derive the DDIM update rule in the "$v$-prediction" parameterization, where the model predicts $v_\theta = \sqrt{\bar{\alpha}_t}\, \varepsilon - \sqrt{1-\bar{\alpha}_t}\, x_0$ instead of $\varepsilon$.

### Exercise 9.2: Flow Matching Theory (Pen-and-Paper)

**(a)** For the straight-line interpolation $x_t = (1-t) x_0 + t x_1$, compute the marginal distribution $p_t(x)$ when $x_0 \sim \mathcal{N}(0, I)$ and $x_1 \sim \mathcal{N}(\mu, \Sigma)$. Verify that $p_0 = \mathcal{N}(0, I)$ and $p_1 = \mathcal{N}(\mu, \Sigma)$.

**(b)** Show that the conditional velocity field $u_t(x \mid x_0, x_1) = x_1 - x_0$ satisfies the continuity equation for the conditional path $p_t(x \mid x_0, x_1) = \delta(x - (1-t)x_0 - t x_1)$.

**(c)** Prove that after one round of rectification, the expected trajectory curvature (measured by $\mathbb{E}[\int_0^1 \|\ddot{x}_t\|^2 dt]$) is non-increasing. State any assumptions you need.

### Exercise 9.3: Implementation

**(a)** Implement DDIM sampling using a trained DDPM model. Generate 64 samples with $S \in \{5, 10, 20, 50, 100, 1000\}$ steps. Visualize the samples and plot FID (or visual quality) vs. number of steps.

**(b)** Implement DDIM encoding ($x_0 \to x_T$) and verify that the round-trip $x_0 \to x_T \to \hat{x}_0$ is nearly lossless for deterministic DDIM ($\eta = 0$). Measure reconstruction MSE as a function of $S$.

**(c)** Implement OT-CFM training and sampling. Train on CIFAR-10 for 50 epochs. Compare sample quality (visual and FID) with DDPM/DDIM at the same number of function evaluations.

**(d)** Implement latent interpolation for both DDIM and flow matching: given two data samples $x_1^{(a)}$ and $x_1^{(b)}$, encode to noise, interpolate with spherical interpolation (slerp), and decode. Compare the smoothness of interpolation.

### Exercise 9.4: Advanced (Open-ended)

**(a)** Implement one round of the rectified flow procedure. Train an initial flow matching model, generate 50,000 couplings by solving the ODE, retrain on the couplings. Compare 1-step sample quality before and after rectification.

**(b)** Read the DPM-Solver paper (Lu et al., 2022) and implement the DPM-Solver-2 (second-order solver). Compare with Euler and Heun at the same NFE budget. Report FID at NFE $\in \{10, 20, 50\}$.
