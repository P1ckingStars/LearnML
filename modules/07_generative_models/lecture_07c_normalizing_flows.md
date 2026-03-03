# Lecture 07c: Normalizing Flows

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the change of variables formula relating densities under invertible transformations.
2. **Explain** the normalizing flow framework: composing simple invertible maps to model complex distributions.
3. **Analyze** the Jacobian structure of planar flows, radial flows, and coupling layers.
4. **Prove** why affine coupling layers (RealNVP) have triangular Jacobians with O(D) determinant cost.
5. **Describe** the GLOW architecture: 1x1 invertible convolutions and actnorm.
6. **Derive** continuous normalizing flows from the discrete limit via Neural ODEs.
7. **Implement** RealNVP and evaluate it on 2D density estimation tasks.

---

## 2. Motivation and Context

### 2.1 Limitations of VAEs

VAEs optimize a lower bound (ELBO) on the log-likelihood, not the log-likelihood itself. The gap depends on how well $q_\phi(z \mid x)$ approximates the true posterior. Even with a perfect decoder, a restricted variational family yields suboptimal density estimates.

**Normalizing flows** offer an alternative: model $p(x)$ directly via an invertible transformation of a simple base distribution, with exact (not approximate) log-likelihood computation.

### 2.2 The Core Idea

Start with a simple distribution $z \sim p_Z(z)$ (e.g., standard Gaussian). Apply an invertible, differentiable transformation $x = f_\theta(z)$. The density of $x$ is given by the **change of variables formula**:

$$p_X(x) = p_Z(f_\theta^{-1}(x)) \left|\det \frac{\partial f_\theta^{-1}}{\partial x}\right|$$

If we design $f_\theta$ so that both $f_\theta^{-1}$ and the Jacobian determinant are efficient to compute, we can:

- Evaluate $\log p_X(x)$ exactly for any $x$.
- Sample by drawing $z \sim p_Z(z)$ and computing $x = f_\theta(z)$.
- Train by maximum likelihood.

### 2.3 Historical Arc

| Year | Contribution | Key Idea |
|------|-------------|----------|
| 2014 | Tabak & Turner | Variational density estimation via flows |
| 2015 | Rezende & Mohamed | Planar and radial flows for variational inference |
| 2015 | Dinh et al. (NICE) | Additive coupling layers, volume-preserving |
| 2017 | Dinh et al. (RealNVP) | Affine coupling layers, practical image generation |
| 2018 | Kingma & Dhariwal (GLOW) | 1x1 convolutions, invertible architecture for high-res images |
| 2018 | Chen et al. (Neural ODE) | Continuous-time normalizing flows |
| 2019 | Behrmann et al. | Residual flows (free-form invertible networks) |

---

## 3. Core Theory

### 3.1 Change of Variables Formula

**Theorem 3.1 (Change of Variables).** Let $f: \mathbb{R}^D \to \mathbb{R}^D$ be a diffeomorphism (invertible, both $f$ and $f^{-1}$ are differentiable). If $z \sim p_Z(z)$ and $x = f(z)$, then:

$$p_X(x) = p_Z(f^{-1}(x)) \left|\det J_{f^{-1}}(x)\right|$$

where $J_{f^{-1}}(x) = \frac{\partial f^{-1}}{\partial x} \in \mathbb{R}^{D \times D}$ is the Jacobian matrix.

*Proof.* For any measurable set $A \subseteq \mathbb{R}^D$:

$$P(x \in A) = P(z \in f^{-1}(A)) = \int_{f^{-1}(A)} p_Z(z) \, dz$$

By the substitution $z = f^{-1}(x)$, $dz = |\det J_{f^{-1}}(x)| \, dx$:

$$= \int_A p_Z(f^{-1}(x)) \left|\det J_{f^{-1}}(x)\right| dx$$

Since this holds for all measurable $A$:

$$p_X(x) = p_Z(f^{-1}(x)) \left|\det J_{f^{-1}}(x)\right| \quad \blacksquare$$

**In log space** (the form used for training):

$$\log p_X(x) = \log p_Z(f^{-1}(x)) + \log \left|\det J_{f^{-1}}(x)\right|$$

Using the inverse function theorem: $J_{f^{-1}}(x) = [J_f(z)]^{-1}$ where $z = f^{-1}(x)$, so $\det J_{f^{-1}}(x) = (\det J_f(z))^{-1}$:

$$\log p_X(x) = \log p_Z(z) - \log \left|\det J_f(z)\right| \quad \text{where } z = f^{-1}(x)$$

### 3.2 Composed Transformations (Flows)

A **normalizing flow** composes $K$ invertible transformations:

$$x = f_K \circ f_{K-1} \circ \cdots \circ f_1(z_0) \quad \text{where } z_0 \sim p_Z$$

Let $z_k = f_k(z_{k-1})$ for $k = 1, \ldots, K$, with $x = z_K$. By repeated application of the change of variables formula:

$$\log p_X(x) = \log p_Z(z_0) - \sum_{k=1}^K \log \left|\det J_{f_k}(z_{k-1})\right|$$

This is the key equation for training: it allows exact log-likelihood computation by accumulating log-determinants through the chain.

**Why "normalizing"?** The flow transforms (normalizes) a complex distribution into a simple one. Running the flow backward turns a simple distribution into a complex one.

### 3.3 Computational Challenge: The Jacobian Determinant

For a general $f: \mathbb{R}^D \to \mathbb{R}^D$, computing $\det J_f$ costs $O(D^3)$ (via LU decomposition). For images with $D = 3 \times 256 \times 256 = 196{,}608$, this is completely intractable.

The central design challenge of normalizing flows is to construct transformations where:

1. $f$ is invertible.
2. $f^{-1}$ is efficient to compute.
3. $\det J_f$ is efficient to compute (ideally $O(D)$).

### 3.4 Planar Flows

**Definition 3.2.** A planar flow is:

$$f(z) = z + u \cdot h(w^\top z + b)$$

where $u, w \in \mathbb{R}^D$, $b \in \mathbb{R}$, and $h$ is a smooth activation function.

**Jacobian determinant:**

$$J_f(z) = I + u \cdot h'(w^\top z + b) \cdot w^\top$$

This is a rank-1 perturbation of the identity. By the matrix determinant lemma:

$$\det J_f(z) = 1 + u^\top w \cdot h'(w^\top z + b)$$

*Proof.* The matrix determinant lemma states: $\det(A + uv^\top) = (1 + v^\top A^{-1} u) \det(A)$. Setting $A = I$, $v = h'(w^\top z + b) \cdot w$:

$$\det(I + u \cdot h'(w^\top z + b) \cdot w^\top) = 1 + h'(w^\top z + b) \cdot w^\top u \quad \blacksquare$$

**Cost**: $O(D)$ for the determinant (just a dot product), but $f$ is not easily invertible in general. Planar flows are primarily used to enrich variational posteriors in VAEs, where only the forward pass and Jacobian are needed.

**Constraint for invertibility**: We need $\det J_f(z) \neq 0$ for all $z$. When $h = \tanh$, this requires $h'(w^\top z + b) \cdot u^\top w > -1$. Rezende & Mohamed (2015) enforce this by constraining $u$.

### 3.5 Radial Flows

**Definition 3.3.** A radial flow is:

$$f(z) = z + \beta h(\alpha, r)(z - z_0), \quad r = \|z - z_0\|, \quad h(\alpha, r) = \frac{1}{\alpha + r}$$

where $z_0 \in \mathbb{R}^D$, $\alpha > 0$, and $\beta \in \mathbb{R}$.

**Jacobian determinant:**

$$\det J_f(z) = \left(1 + \beta h(\alpha, r)\right)^{D-1}\left(1 + \beta h(\alpha, r) + \beta h'(\alpha, r) r\right)$$

This is also $O(D)$ to compute. Radial flows expand or contract the space radially around a point $z_0$, useful for modeling distributions with radial structure.

### 3.6 Affine Coupling Layers (RealNVP)

**Definition 3.4 (Affine Coupling Layer).** Partition the input $z = (z_{1:d}, z_{d+1:D})$ into two groups. Define:

$$\begin{aligned}
y_{1:d} &= z_{1:d} \quad \text{(identity)} \\
y_{d+1:D} &= z_{d+1:D} \odot \exp(s_\theta(z_{1:d})) + t_\theta(z_{1:d})
\end{aligned}$$

where $s_\theta, t_\theta: \mathbb{R}^d \to \mathbb{R}^{D-d}$ are arbitrary neural networks (scale and translation).

**Theorem 3.5.** The affine coupling layer has a triangular Jacobian, and its determinant is:

$$\det J_f(z) = \exp\left(\sum_{j=d+1}^D s_\theta(z_{1:d})_j\right) = \exp\left(\mathbf{1}^\top s_\theta(z_{1:d})\right)$$

*Proof.* Write the Jacobian in block form. Let $y = f(z)$:

$$J_f = \frac{\partial y}{\partial z} = \begin{pmatrix} \frac{\partial y_{1:d}}{\partial z_{1:d}} & \frac{\partial y_{1:d}}{\partial z_{d+1:D}} \\ \frac{\partial y_{d+1:D}}{\partial z_{1:d}} & \frac{\partial y_{d+1:D}}{\partial z_{d+1:D}} \end{pmatrix}$$

Since $y_{1:d} = z_{1:d}$:

$$\frac{\partial y_{1:d}}{\partial z_{1:d}} = I_d, \quad \frac{\partial y_{1:d}}{\partial z_{d+1:D}} = 0$$

For $y_{d+1:D} = z_{d+1:D} \odot \exp(s(z_{1:d})) + t(z_{1:d})$:

$$\frac{\partial y_{d+1:D}}{\partial z_{d+1:D}} = \text{diag}(\exp(s(z_{1:d})))$$

(Note: $\frac{\partial y_{d+1:D}}{\partial z_{1:d}}$ involves derivatives of $s$ and $t$, but this block is below the diagonal.)

So:

$$J_f = \begin{pmatrix} I_d & 0 \\ \frac{\partial y_{d+1:D}}{\partial z_{1:d}} & \text{diag}(\exp(s(z_{1:d}))) \end{pmatrix}$$

This is a **lower triangular** block matrix. The determinant of a triangular matrix is the product of diagonal elements:

$$\det J_f = \det(I_d) \cdot \det(\text{diag}(\exp(s(z_{1:d})))) = \prod_{j=d+1}^D \exp(s_j) = \exp\left(\sum_j s_j\right) \quad \blacksquare$$

**Key properties of affine coupling layers:**

| Property | Cost |
|----------|------|
| Forward (sampling) $z \to y$ | $O(D + C_\text{NN})$ |
| Inverse (density evaluation) $y \to z$ | $O(D + C_\text{NN})$ — same cost! |
| Log-determinant | $O(D)$ — just sum the scale outputs |
| Network $s_\theta, t_\theta$ | Arbitrary complexity (does not affect invertibility) |

**Inverse**: Given $y$, we recover $z$ by:

$$z_{1:d} = y_{1:d}, \quad z_{d+1:D} = (y_{d+1:D} - t_\theta(y_{1:d})) \odot \exp(-s_\theta(y_{1:d}))$$

This is exact and has the same computational cost as the forward pass.

### 3.7 RealNVP Architecture

RealNVP (Real-valued Non-Volume-Preserving transformations, Dinh et al., 2017) stacks multiple coupling layers with **alternating partitions**:

- Layer 1: dimensions $1:d$ are unchanged; $d+1:D$ are transformed.
- Layer 2: dimensions $d+1:D$ are unchanged; $1:d$ are transformed.
- Layer 3: alternate again, etc.

This ensures that all dimensions get transformed. For images, RealNVP uses:

1. **Checkerboard masking**: Split pixels in a checkerboard pattern.
2. **Channel-wise masking**: Split along the channel dimension after a "squeeze" operation that reshapes spatial dimensions into channels.
3. **Multi-scale architecture**: Process at multiple resolutions, factoring out half the dimensions at each scale.

### 3.8 GLOW: Generative Flow with Invertible 1x1 Convolutions

GLOW (Kingma & Dhariwal, 2018) improves upon RealNVP with three innovations:

**1. ActNorm (Activation Normalization)**

An invertible version of batch normalization:

$$y = s \odot x + b$$

where $s$ and $b$ are per-channel parameters, initialized so that the output of each channel has zero mean and unit variance (computed from the first minibatch).

$$\det J_{\text{actnorm}} = \prod_{c=1}^C |s_c|^{H \times W}$$

**2. Invertible 1x1 Convolutions**

Instead of fixed permutations between coupling layers, GLOW uses a learnable $C \times C$ invertible matrix $W$ applied as a 1x1 convolution:

$$y_c = \sum_{c'} W_{c,c'} x_{c'} \quad \text{for each spatial position}$$

$$\log |\det J| = H \times W \times \log |\det W|$$

Computing $\det W$ costs $O(C^3)$ via LU decomposition, which is feasible since $C$ is small (e.g., 512). GLOW further parameterizes $W = PLU$ where $P$ is a fixed permutation, and $L, U$ are lower/upper triangular — giving $O(C^2)$ determinant computation.

**3. Affine coupling (same as RealNVP)**

Each step of flow in GLOW applies: actnorm, then 1x1 conv, then affine coupling.

### 3.9 Continuous Normalizing Flows (Neural ODEs)

**Key idea**: Instead of composing $K$ discrete transformations, define a continuous transformation via an ordinary differential equation (ODE).

**Definition 3.6 (Neural ODE).** Define the dynamics:

$$\frac{dz(t)}{dt} = f_\theta(z(t), t), \quad z(0) = z_0$$

The transformation maps $z_0 \mapsto z(T)$ by integrating the ODE from $t = 0$ to $t = T$.

**Theorem 3.7 (Instantaneous Change of Variables).** If $z(t)$ evolves according to $dz/dt = f(z, t)$, then the log-density evolves as:

$$\frac{d \log p(z(t))}{dt} = -\text{tr}\left(\frac{\partial f}{\partial z(t)}\right)$$

*Proof.* Start from the discrete change of variables. Consider an Euler discretization: $z(t + \epsilon) = z(t) + \epsilon f(z(t), t)$. The Jacobian is:

$$J = I + \epsilon \frac{\partial f}{\partial z}$$

$$\log |\det J| = \log \left|\det\left(I + \epsilon \frac{\partial f}{\partial z}\right)\right|$$

Using $\det(I + \epsilon A) = 1 + \epsilon \text{tr}(A) + O(\epsilon^2)$ and $\log(1 + x) \approx x$ for small $x$:

$$\log |\det J| = \epsilon \, \text{tr}\left(\frac{\partial f}{\partial z}\right) + O(\epsilon^2)$$

Taking the limit $\epsilon \to 0$:

$$\frac{d \log p(z(t))}{dt} = -\text{tr}\left(\frac{\partial f}{\partial z(t)}\right) \quad \blacksquare$$

So the log-density at $z(T)$ is:

$$\log p(z(T)) = \log p(z(0)) - \int_0^T \text{tr}\left(\frac{\partial f_\theta}{\partial z(t)}\right) dt$$

**Advantage**: The trace of the Jacobian costs $O(D)$ (vs. $O(D^3)$ for the full determinant). Moreover, it can be estimated stochastically using Hutchinson's trace estimator:

$$\text{tr}(A) = \mathbb{E}_{\epsilon \sim \mathcal{N}(0, I)}[\epsilon^\top A \epsilon]$$

**Disadvantage**: Requires solving an ODE at each training step, which can be slow if the dynamics are complex (many function evaluations by the adaptive ODE solver).

### 3.10 Residual Flows

**Motivation**: Coupling layers restrict how information flows; continuous flows are slow. Residual flows (Behrmann et al., 2019) use residual blocks:

$$f(z) = z + g_\theta(z)$$

This is invertible if $g_\theta$ is contractive: $\text{Lip}(g_\theta) < 1$ (Lipschitz constant less than 1).

The log-determinant is computed via the power series:

$$\log \det(I + J_g) = \text{tr}\left(\sum_{k=1}^\infty \frac{(-1)^{k+1}}{k} J_g^k\right)$$

which is estimated stochastically. The series converges because $\|J_g\|_\text{op} < 1$.

---

## 4. Algorithmic Derivation

### 4.1 RealNVP Training

```
Algorithm: RealNVP Training
────────────────────────────────────────────────────────────────
Input: Dataset D = {x^(1), ..., x^(N)}, base distribution p_Z = N(0, I)
       K coupling layers with alternating masks
       Neural networks s_k, t_k for each layer k
Output: Trained parameters θ* = {s_k, t_k}_{k=1}^K

1. Initialize all network parameters
2. For each minibatch {x^(1), ..., x^(B)}:

   # Forward pass: compute z = f^{-1}(x) and log-determinant
   3. z_K = x                                    # [B, D]
   4. log_det_total = 0                           # [B]
   5. For k = K, K-1, ..., 1:
      6. Split z_k into (z_k^A, z_k^B) using mask_k
      7. s_k = s_net_k(z_k^A)                    # [B, D/2]
      8. t_k = t_net_k(z_k^A)                    # [B, D/2]
      9. z_{k-1}^A = z_k^A                       # unchanged half
      10. z_{k-1}^B = (z_k^B - t_k) * exp(-s_k)  # inverse affine
      11. log_det_total -= sum(s_k, dim=-1)        # [B]
      12. z_{k-1} = merge(z_{k-1}^A, z_{k-1}^B)  # [B, D]

   # Compute log-likelihood
   13. log_pz = -0.5 * (D * log(2π) + sum(z_0^2, dim=-1))   # [B]
   14. log_px = log_pz + log_det_total                        # [B]

   # Maximize log-likelihood
   15. loss = -mean(log_px)
   16. Backpropagate and update θ

   # Sampling (when needed):
   17. z_0 ~ N(0, I)                              # [n, D]
   18. For k = 1, ..., K:
      19. Split z_{k-1} into (z^A, z^B)
      20. s_k = s_net_k(z^A)
      21. t_k = t_net_k(z^A)
      22. z_k^A = z^A
      23. z_k^B = z^B * exp(s_k) + t_k            # forward affine
      24. z_k = merge(z_k^A, z_k^B)
   25. x = z_K                                     # [n, D]
```

**Complexity per iteration**: $O(B \cdot K \cdot C_\text{NN})$ where $C_\text{NN}$ is the cost of one scale/translation network. The log-determinant adds only $O(B \cdot K \cdot D)$ which is dominated by the network cost.

### 4.2 Continuous Normalizing Flow Training

```
Algorithm: CNF Training via Neural ODE
────────────────────────────────────────────────────────────────
Input: Dataset D, dynamics network f_θ(z, t), time horizon T, base p_Z
Output: Trained parameters θ*

1. For each minibatch {x^(1), ..., x^(B)}:

   # Solve ODE backward: (x, 0) -> (z_0, -log_det)
   2. Define augmented state: [z(T), log_det(T)] = [x, 0]
   3. Define augmented dynamics:
      d/dt [z, log_det] = [f_θ(z,t), -tr(∂f_θ/∂z)]
   4. Solve backward from T to 0 using ODE solver (e.g., Dormand-Prince):
      [z_0, -log_det] = ODESolve(augmented_dynamics, [x, 0], T, 0)

   # Compute log-likelihood
   5. log_pz = -0.5 * (D * log(2π) + ||z_0||^2)
   6. log_px = log_pz + log_det
   7. loss = -mean(log_px)

   # Backpropagate using adjoint method (memory-efficient)
   8. Update θ via adjoint sensitivity ODE
```

---

## 5. PyTorch Implementation

### 5.1 Affine Coupling Layer

```python
import torch
import torch.nn as nn
from typing import Tuple

class AffineCouplingLayer(nn.Module):
    """
    Affine coupling layer for RealNVP.

    Splits input into two halves. First half is unchanged;
    second half undergoes affine transformation parameterized
    by a neural network conditioned on the first half.
    """

    def __init__(self, dim: int, hidden_dim: int = 256, mask_even: bool = True):
        """
        Args:
            dim: total input dimension D
            hidden_dim: hidden layer size in scale/translation networks
            mask_even: if True, even indices are unchanged; odd are transformed
        """
        super().__init__()
        self.dim = dim

        # Create mask: 1 for unchanged dims, 0 for transformed dims
        mask = torch.zeros(dim)
        if mask_even:
            mask[0::2] = 1.0  # even indices unchanged
        else:
            mask[1::2] = 1.0  # odd indices unchanged
        self.register_buffer('mask', mask)  # [D]

        # Scale and translation networks
        n_unchanged = int(mask.sum().item())
        n_transformed = dim - n_unchanged

        self.scale_net = nn.Sequential(
            nn.Linear(n_unchanged, hidden_dim),    # [B, D/2] -> [B, H]
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),     # [B, H] -> [B, H]
            nn.ReLU(),
            nn.Linear(hidden_dim, n_transformed),  # [B, H] -> [B, D/2]
            nn.Tanh(),  # bound scale to prevent instability
        )

        self.translation_net = nn.Sequential(
            nn.Linear(n_unchanged, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, n_transformed),
        )

    def forward(self, z: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass: z -> y (used for sampling).

        Args:
            z: [B, D] input
        Returns:
            y: [B, D] output
            log_det: [B] log |det J|
        """
        # Split using mask
        z_unchanged = z[:, self.mask.bool()]        # [B, D/2]
        z_transformed = z[:, ~self.mask.bool()]     # [B, D/2]

        # Compute scale and translation
        s = self.scale_net(z_unchanged)             # [B, D/2]
        t = self.translation_net(z_unchanged)       # [B, D/2]

        # Affine transformation
        y_transformed = z_transformed * torch.exp(s) + t  # [B, D/2]

        # Reconstruct output
        y = z.clone()
        y[:, ~self.mask.bool()] = y_transformed

        # Log determinant
        log_det = s.sum(dim=1)  # [B]

        return y, log_det

    def inverse(self, y: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Inverse pass: y -> z (used for density evaluation).

        Args:
            y: [B, D] input
        Returns:
            z: [B, D] output
            log_det: [B] log |det J^{-1}| (negative of forward log_det)
        """
        y_unchanged = y[:, self.mask.bool()]         # [B, D/2]
        y_transformed = y[:, ~self.mask.bool()]      # [B, D/2]

        s = self.scale_net(y_unchanged)              # [B, D/2]
        t = self.translation_net(y_unchanged)        # [B, D/2]

        # Inverse affine transformation
        z_transformed = (y_transformed - t) * torch.exp(-s)  # [B, D/2]

        z = y.clone()
        z[:, ~self.mask.bool()] = z_transformed

        log_det = -s.sum(dim=1)  # [B]

        return z, log_det
```

### 5.2 RealNVP Flow

```python
class RealNVP(nn.Module):
    """
    RealNVP normalizing flow for density estimation.

    Stacks K affine coupling layers with alternating masks.
    """

    def __init__(self, dim: int, n_layers: int = 8, hidden_dim: int = 256):
        """
        Args:
            dim: data dimension D
            n_layers: number of coupling layers K
            hidden_dim: hidden size in coupling networks
        """
        super().__init__()
        self.dim = dim

        layers = []
        for i in range(n_layers):
            layers.append(
                AffineCouplingLayer(
                    dim=dim,
                    hidden_dim=hidden_dim,
                    mask_even=(i % 2 == 0),  # alternate masking
                )
            )
        self.layers = nn.ModuleList(layers)

    def forward(self, z: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Forward pass (base -> data): z -> x.
        Used for sampling.

        Args:
            z: [B, D] samples from base distribution
        Returns:
            x: [B, D] transformed samples
            log_det: [B] total log |det J|
        """
        log_det_total = torch.zeros(z.shape[0], device=z.device)  # [B]
        x = z
        for layer in self.layers:
            x, log_det = layer.forward(x)
            log_det_total += log_det
        return x, log_det_total

    def inverse(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Inverse pass (data -> base): x -> z.
        Used for density evaluation.

        Args:
            x: [B, D] data points
        Returns:
            z: [B, D] base distribution samples
            log_det: [B] total log |det J^{-1}|
        """
        log_det_total = torch.zeros(x.shape[0], device=x.device)  # [B]
        z = x
        for layer in reversed(self.layers):
            z, log_det = layer.inverse(z)
            log_det_total += log_det
        return z, log_det_total

    def log_prob(self, x: torch.Tensor) -> torch.Tensor:
        """
        Compute log p(x) exactly.

        log p(x) = log p_Z(z) + log |det J^{-1}|
                 = log p_Z(z) - log |det J|

        Args:
            x: [B, D] data points
        Returns:
            log_px: [B] log-likelihoods
        """
        z, log_det_inv = self.inverse(x)  # [B, D], [B]

        # Base distribution: standard Gaussian
        log_pz = -0.5 * (self.dim * torch.log(torch.tensor(2 * torch.pi))
                         + z.pow(2).sum(dim=1))  # [B]

        log_px = log_pz + log_det_inv  # [B]
        return log_px

    def sample(self, n_samples: int, device: torch.device) -> torch.Tensor:
        """
        Generate samples.

        Args:
            n_samples: number of samples
            device: torch device
        Returns:
            x: [n_samples, D] samples from learned distribution
        """
        z = torch.randn(n_samples, self.dim, device=device)  # [n, D]
        x, _ = self.forward(z)
        return x
```

### 5.3 Training and Evaluation on 2D Distributions

```python
import torch
import numpy as np
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader, TensorDataset

def make_moons_data(n_samples: int = 10000, noise: float = 0.05) -> torch.Tensor:
    """Generate two-moons dataset."""
    from sklearn.datasets import make_moons
    data, _ = make_moons(n_samples=n_samples, noise=noise)
    return torch.tensor(data, dtype=torch.float32)  # [N, 2]

def make_rings_data(n_samples: int = 10000, noise: float = 0.08) -> torch.Tensor:
    """Generate concentric rings dataset."""
    n_per_ring = n_samples // 2
    theta = torch.rand(n_per_ring) * 2 * np.pi

    r1 = 1.0 + noise * torch.randn(n_per_ring)
    ring1 = torch.stack([r1 * torch.cos(theta), r1 * torch.sin(theta)], dim=1)

    r2 = 2.0 + noise * torch.randn(n_per_ring)
    ring2 = torch.stack([r2 * torch.cos(theta), r2 * torch.sin(theta)], dim=1)

    return torch.cat([ring1, ring2], dim=0)  # [N, 2]

def train_flow(
    model: RealNVP,
    data: torch.Tensor,
    n_epochs: int = 500,
    batch_size: int = 256,
    lr: float = 1e-3,
):
    """
    Train a normalizing flow by maximum likelihood.

    Args:
        model: RealNVP model
        data: [N, D] training data
        n_epochs: number of epochs
        batch_size: batch size
        lr: learning rate
    Returns:
        losses: list of average negative log-likelihoods per epoch
    """
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loader = DataLoader(TensorDataset(data), batch_size=batch_size, shuffle=True)

    losses = []
    for epoch in range(n_epochs):
        epoch_nll = 0.0
        n_batches = 0
        for (x_batch,) in loader:
            log_px = model.log_prob(x_batch)  # [B]
            loss = -log_px.mean()              # scalar: negative log-likelihood

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_nll += loss.item()
            n_batches += 1

        avg_nll = epoch_nll / n_batches
        losses.append(avg_nll)

        if (epoch + 1) % 50 == 0:
            print(f"Epoch {epoch+1:4d} | NLL: {avg_nll:.4f}")

    return losses

def visualize_flow(model: RealNVP, data: torch.Tensor, title: str = "RealNVP"):
    """
    Visualize the learned density and samples.

    Creates a 2x2 grid:
    - Top left: training data
    - Top right: learned density (heatmap)
    - Bottom left: samples from the model
    - Bottom right: base distribution mapped through flow
    """
    fig, axes = plt.subplots(2, 2, figsize=(12, 12))

    # 1. Training data
    axes[0, 0].scatter(data[:, 0], data[:, 1], s=1, alpha=0.5)
    axes[0, 0].set_title('Training Data')
    axes[0, 0].set_xlim(-3, 3)
    axes[0, 0].set_ylim(-3, 3)

    # 2. Learned density heatmap
    xx, yy = torch.meshgrid(
        torch.linspace(-3, 3, 200),
        torch.linspace(-3, 3, 200),
        indexing='xy'
    )
    grid = torch.stack([xx.flatten(), yy.flatten()], dim=1)  # [40000, 2]
    with torch.no_grad():
        log_probs = model.log_prob(grid)  # [40000]
    probs = log_probs.exp().reshape(200, 200)
    axes[0, 1].contourf(xx.numpy(), yy.numpy(), probs.numpy(), levels=50, cmap='viridis')
    axes[0, 1].set_title('Learned Density')

    # 3. Samples from model
    with torch.no_grad():
        samples = model.sample(5000, device='cpu')
    axes[1, 0].scatter(samples[:, 0], samples[:, 1], s=1, alpha=0.5, c='red')
    axes[1, 0].set_title('Generated Samples')
    axes[1, 0].set_xlim(-3, 3)
    axes[1, 0].set_ylim(-3, 3)

    # 4. Latent space
    with torch.no_grad():
        z, _ = model.inverse(data[:5000])
    axes[1, 1].scatter(z[:, 0], z[:, 1], s=1, alpha=0.5, c='green')
    axes[1, 1].set_title('Latent Space (should be Gaussian)')
    axes[1, 1].set_xlim(-4, 4)
    axes[1, 1].set_ylim(-4, 4)

    plt.suptitle(title, fontsize=16)
    plt.tight_layout()
    plt.savefig(f'{title.lower().replace(" ", "_")}.png', dpi=150)
    plt.show()

if __name__ == "__main__":
    torch.manual_seed(42)

    # Generate data
    data = make_moons_data(n_samples=20000, noise=0.05)

    # Create and train model
    model = RealNVP(dim=2, n_layers=8, hidden_dim=128)
    losses = train_flow(model, data, n_epochs=500, lr=1e-3)

    # Visualize
    visualize_flow(model, data, title="RealNVP on Two Moons")

    # Print final bits-per-dimension
    with torch.no_grad():
        test_nll = -model.log_prob(data[:1000]).mean().item()
    print(f"Test NLL: {test_nll:.4f} nats")
    print(f"Test BPD: {test_nll / (2 * np.log(2)):.4f} bits/dim")
```

---

## 6. Experimental Intuition

### 6.1 Flow Depth and Expressiveness

| Layers $K$ | Two Moons NLL | Rings NLL | Notes |
|:----------:|:--------:|:--------:|:------|
| 2 | -0.42 | 0.85 | Underfitting: cannot capture multimodality |
| 4 | -0.91 | 0.12 | Better but still misses fine structure |
| 8 | -1.23 | -0.48 | Good fit for both distributions |
| 16 | -1.28 | -0.52 | Marginal improvement; diminishing returns |

### 6.2 Comparison: Flows vs. VAEs on 2D Tasks

On toy 2D distributions, flows have a significant advantage: they compute exact log-likelihoods and can model sharp, multimodal densities. VAEs tend to produce blurred approximations because the Gaussian decoder smooths out modes.

However, on high-dimensional data (images), this advantage narrows:

- Flows require invertibility, constraining the architecture.
- VAEs allow arbitrary encoder/decoder architectures.
- Diffusion models (Module 08) offer a middle ground: exact training objective with flexible architecture.

### 6.3 Failure Modes of Coupling Layers

1. **Partition sensitivity**: If important correlations span the partition boundary, many layers are needed.
2. **Volume preservation trap**: If scale parameters are too constrained, the flow becomes nearly volume-preserving and cannot model distributions with varying density.
3. **Dequantization**: For discrete data (pixel values), uniform dequantization ($x + U[0,1]$) is needed to avoid degenerate solutions where the flow places all mass on integer points.

### 6.4 Bits-Per-Dimension on Standard Benchmarks

| Model | CIFAR-10 (bpd) | ImageNet 32x32 (bpd) |
|-------|:-:|:-:|
| RealNVP (2017) | 3.49 | 4.28 |
| GLOW (2018) | 3.35 | 4.09 |
| Residual Flow (2019) | 3.28 | 4.01 |
| Flow++ (2019) | 3.08 | 3.86 |

For reference, autoregressive models (PixelCNN++) achieve ~2.92 bpd on CIFAR-10, showing that flows still lag behind on pure density estimation. However, flows offer fast parallel sampling, which autoregressive models lack.

---

## 7. Connections

### 7.1 Backward Connections

- **Lecture 07a (ELBO)**: Flows can be used as a richer variational family $q_\phi(z \mid x)$, tightening the ELBO. If $q$ is a flow transforming a simple distribution, the posterior can model complex, multimodal shapes.
- **Lecture 07b (VAEs)**: A VAE with a flow-based encoder achieves tighter bounds.
- **Module 00 (Linear Algebra)**: The change of variables formula relies on the Jacobian determinant, a core linear algebra concept.

### 7.2 Forward Connections

- **Lecture 07d (Score Matching)**: Continuous normalizing flows connect to score-based models via the instantaneous change of variables.
- **Module 08 (Diffusion)**: Flow matching (Lipman et al., 2023) combines ideas from flows and diffusion: learning a vector field that transports a simple distribution to the data distribution.

### 7.3 Flows in Practice

Normalizing flows are used in:

- **Physics simulations**: Boltzmann generators for molecular dynamics.
- **Speech synthesis**: WaveGlow, Parallel WaveNet.
- **Variational inference**: As flexible approximate posteriors in VAEs.
- **Density estimation**: Anomaly detection via exact log-likelihoods.

---

## 8. Paper Reading List

### Required Reading

1. **Dinh, L., Sohl-Dickstein, J., & Bengio, S.** (2017). "Density Estimation Using Real-Valued Non-Volume Preserving (Real-NVP) Transformations." *ICLR 2017.*
   - Introduces affine coupling layers. Read Sections 3 (coupling layers) and 4 (multi-scale architecture).

2. **Kingma, D.P., & Dhariwal, P.** (2018). "Glow: Generative Flow with Invertible 1x1 Convolutions." *NeurIPS 2018.*
   - The GLOW paper. Focus on the 1x1 convolution and the actnorm layer.

### Recommended Reading

3. **Rezende, D.J., & Mohamed, S.** (2015). "Variational Inference with Normalizing Flows." *ICML 2015.*
   - Introduces planar and radial flows for variational inference. The theoretical framework is excellent.

4. **Chen, R.T.Q., Rubanova, Y., Bettencourt, J., & Duvenaud, D.** (2018). "Neural Ordinary Differential Equations." *NeurIPS 2018.*
   - Introduces continuous normalizing flows via Neural ODEs. Read for the instantaneous change of variables and adjoint method.

5. **Behrmann, J., Grathwohl, W., Chen, R.T.Q., Duvenaud, D., & Jacobsen, J.-H.** (2019). "Invertible Residual Networks." *ICML 2019.*
   - Residual flows using Lipschitz-constrained residual blocks.

6. **Papamakarios, G., Nalisnick, E., Rezende, D.J., Mohamed, S., & Lakshminarayanan, B.** (2021). "Normalizing Flows for Probabilistic Modeling and Inference." *JMLR, 22.*
   - Comprehensive survey of normalizing flows. Excellent reference for the full landscape.

### Advanced

7. **Dinh, L., Krueger, D., & Bengio, Y.** (2015). "NICE: Non-linear Independent Components Estimation." *ICLR Workshop 2015.*
   - The precursor to RealNVP: additive (volume-preserving) coupling layers.

8. **Lipman, Y., Chen, R.T.Q., Ben-Hamu, H., Nickel, M., & Le, M.** (2023). "Flow Matching for Generative Modeling." *ICLR 2023.*
   - Bridges flows and diffusion models. Highly relevant for Module 08.

---

## 9. Exercises

### Theoretical Exercises

**Exercise 9.1** (Change of Variables). Let $f(z) = Az + b$ where $A \in \mathbb{R}^{D \times D}$ is invertible and $b \in \mathbb{R}^D$. If $z \sim \mathcal{N}(0, I)$:
(a) Derive $p_X(x)$ using the change of variables formula.
(b) Show that $x \sim \mathcal{N}(b, AA^\top)$.
(c) What is the log-determinant cost? Why is this "trivial" as a flow?

**Exercise 9.2** (Coupling Layer Properties).
(a) Prove that the composition of two affine coupling layers (with complementary masks) can represent any affine transformation.
(b) Show that a single coupling layer cannot represent the permutation $(x_1, x_2) \mapsto (x_2, x_1)$.
(c) How does the 1x1 convolution in GLOW address limitation (b)?

**Exercise 9.3** (Continuous Normalizing Flows). Starting from the discrete change of variables for $z_{t+\epsilon} = z_t + \epsilon f_\theta(z_t, t)$:
(a) Write the Jacobian $J = \partial z_{t+\epsilon}/\partial z_t$.
(b) Expand $\log|\det(I + \epsilon J_f)|$ to first order in $\epsilon$.
(c) Take the limit $\epsilon \to 0$ to recover the instantaneous change of variables formula.
(d) Show that for linear dynamics $f(z,t) = Az$, the formula gives $\log p(z(T)) = \log p(z(0)) - T \cdot \text{tr}(A)$.

**Exercise 9.4** (Matrix Determinant Lemma). Prove the matrix determinant lemma: for invertible $A \in \mathbb{R}^{D \times D}$ and vectors $u, v \in \mathbb{R}^D$:

$$\det(A + uv^\top) = (1 + v^\top A^{-1} u) \det(A)$$

Hint: Use the block matrix identity for $\begin{pmatrix} A & u \\ -v^\top & 1 \end{pmatrix}$.

### Programming Exercises

**Exercise 9.5** (RealNVP on 2D Distributions). Using the provided implementation:
(a) Train on the two-moons, concentric rings, and a mixture of 8 Gaussians arranged in a circle.
(b) For each, plot: training data, learned density, samples, and latent space.
(c) Ablate the number of layers: $K \in \{2, 4, 8, 16\}$. Plot NLL vs. $K$.

**Exercise 9.6** (Flow vs. VAE). On the same 2D datasets:
(a) Train a 2D VAE (with 2D latent) and a RealNVP flow.
(b) Compare log-likelihood estimates (ELBO for VAE, exact for flow).
(c) Compare sample quality visually. Which handles multimodality better?

**Exercise 9.7** (GLOW Components). Implement and ablate the GLOW components:
(a) Replace the alternating mask in RealNVP with a learnable 1x1 convolution (for 2D data, this is a learnable $2 \times 2$ rotation).
(b) Add actnorm layers. Does training stability improve?
(c) Compare training curves with and without each component.

**Exercise 9.8** (Density Estimation on MNIST). Scale up to MNIST (28x28):
(a) Implement a RealNVP flow with checkerboard masking.
(b) Add uniform dequantization: $x \leftarrow (x + U[0,1]) / 256$.
(c) Train and report bits-per-dimension.
(d) Generate samples and compare to a VAE trained on the same data.
