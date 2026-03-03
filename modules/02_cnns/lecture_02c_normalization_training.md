# Lecture 02c: Normalization Techniques and Training Deep CNNs

## 1. Learning Objectives

After completing this lecture, students will be able to:

1. Derive the full forward and backward pass of Batch Normalization, including the gradient with respect to each parameter and the input, and explain the role of running statistics at inference.
2. Explain the modern understanding of why BN works (loss smoothing, not internal covariate shift) per Santurkar et al. (2018).
3. Compare Batch, Layer, Instance, and Group Normalization: derive each, state their computation axes, and identify when each is preferred.
4. Formulate data augmentation strategies (Cutout, Mixup, CutMix) as regularization and derive the modified training objective for each.
5. Apply training techniques (learning rate warmup, progressive resizing) with theoretical justification.

---

## 2. Motivation and Context

### 2.1 The Normalization Problem

Training deep networks is notoriously difficult. As gradients propagate through many layers, the distribution of activations at each layer changes during training — a phenomenon Ioffe and Szegedy (2015) termed **internal covariate shift (ICS)**. While the original ICS explanation has been challenged (Santurkar et al., 2018), the practical benefit of normalization is indisputable: it enables higher learning rates, reduces sensitivity to initialization, and acts as a regularizer.

### 2.2 Historical Context

Before batch normalization (2015), training deep networks required careful initialization (Glorot, He), small learning rates, and extensive hyperparameter tuning. BN changed this: it became possible to train ResNets, Inception networks, and other deep architectures with much less tuning. By 2016, essentially all competitive ImageNet models used BN. The subsequent development of Layer Normalization (2016), Group Normalization (2018), and others addressed BN's limitations in specific settings (small batches, sequence models, style transfer).

---

## 3. Core Theory

### 3.1 Batch Normalization

#### 3.1.1 Forward Pass

**Definition 3.1 (Batch Normalization).** Given a mini-batch of activations $\{x_i\}_{i=1}^{N}$ for a single channel at a single spatial position (or equivalently, all spatial positions in a convolutional layer share the same statistics per channel), BN computes:

**Step 1: Compute batch statistics.**

$$\mu_B = \frac{1}{m} \sum_{i=1}^{m} x_i$$

$$\sigma_B^2 = \frac{1}{m} \sum_{i=1}^{m} (x_i - \mu_B)^2$$

where $m = N \cdot H \cdot W$ for a convolutional layer (statistics computed over batch and spatial dimensions, per channel).

**Step 2: Normalize.**

$$\hat{x}_i = \frac{x_i - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}}$$

where $\epsilon > 0$ is a small constant for numerical stability (typically $10^{-5}$).

**Step 3: Scale and shift.**

$$y_i = \gamma \hat{x}_i + \beta$$

where $\gamma, \beta \in \mathbb{R}$ are learnable parameters (per channel). These restore the representational capacity: without them, the normalized activations would be constrained to have zero mean and unit variance, limiting the network's expressivity.

**Remark.** For a convolutional layer with $C$ channels, BN maintains $2C$ learnable parameters ($\gamma_c, \beta_c$ for each channel) and $2C$ running statistics ($\mu_c^{\text{run}}, (\sigma_c^2)^{\text{run}}$).

#### 3.1.2 Inference (Running Statistics)

During training, BN tracks exponential moving averages:

$$\mu^{\text{run}} \leftarrow (1 - \alpha) \mu^{\text{run}} + \alpha \mu_B$$
$$(\sigma^2)^{\text{run}} \leftarrow (1 - \alpha) (\sigma^2)^{\text{run}} + \alpha \sigma_B^2$$

where $\alpha$ is the momentum (default 0.1 in PyTorch). At inference:

$$y_i = \gamma \frac{x_i - \mu^{\text{run}}}{\sqrt{(\sigma^2)^{\text{run}} + \epsilon}} + \beta$$

This removes the dependence on batch statistics, making inference deterministic and applicable to single samples.

#### 3.1.3 Full Backward Pass Derivation

We derive the gradients for the batch normalization layer. Let $\frac{\partial \mathcal{L}}{\partial y_i}$ be the upstream gradient. We need $\frac{\partial \mathcal{L}}{\partial x_i}$, $\frac{\partial \mathcal{L}}{\partial \gamma}$, and $\frac{\partial \mathcal{L}}{\partial \beta}$.

**Gradient w.r.t. $\gamma$ and $\beta$:**

$$\frac{\partial \mathcal{L}}{\partial \gamma} = \sum_{i=1}^{m} \frac{\partial \mathcal{L}}{\partial y_i} \hat{x}_i$$

$$\frac{\partial \mathcal{L}}{\partial \beta} = \sum_{i=1}^{m} \frac{\partial \mathcal{L}}{\partial y_i}$$

**Gradient w.r.t. $\hat{x}_i$:**

$$\frac{\partial \mathcal{L}}{\partial \hat{x}_i} = \frac{\partial \mathcal{L}}{\partial y_i} \cdot \gamma$$

**Gradient w.r.t. $\sigma_B^2$:**

$$\frac{\partial \mathcal{L}}{\partial \sigma_B^2} = \sum_{i=1}^{m} \frac{\partial \mathcal{L}}{\partial \hat{x}_i} \cdot (x_i - \mu_B) \cdot \left(-\frac{1}{2}\right)(\sigma_B^2 + \epsilon)^{-3/2}$$

*Derivation:* Since $\hat{x}_i = (x_i - \mu_B)(\sigma_B^2 + \epsilon)^{-1/2}$, we have $\frac{\partial \hat{x}_i}{\partial \sigma_B^2} = (x_i - \mu_B) \cdot (-\frac{1}{2})(\sigma_B^2 + \epsilon)^{-3/2}$. Sum over all $i$.

**Gradient w.r.t. $\mu_B$:**

$$\frac{\partial \mathcal{L}}{\partial \mu_B} = \sum_{i=1}^{m} \frac{\partial \mathcal{L}}{\partial \hat{x}_i} \cdot \frac{-1}{\sqrt{\sigma_B^2 + \epsilon}} + \frac{\partial \mathcal{L}}{\partial \sigma_B^2} \cdot \frac{-2}{m}\sum_{i=1}^{m}(x_i - \mu_B)$$

Note: the second term simplifies because $\sum_i (x_i - \mu_B) = 0$ by definition of $\mu_B$. Therefore:

$$\frac{\partial \mathcal{L}}{\partial \mu_B} = \frac{-1}{\sqrt{\sigma_B^2 + \epsilon}} \sum_{i=1}^{m} \frac{\partial \mathcal{L}}{\partial \hat{x}_i}$$

**Gradient w.r.t. $x_i$:**

$x_i$ affects $\mathcal{L}$ through three paths: (1) directly through $\hat{x}_i$, (2) through $\mu_B$, and (3) through $\sigma_B^2$.

$$\frac{\partial \mathcal{L}}{\partial x_i} = \frac{\partial \mathcal{L}}{\partial \hat{x}_i} \cdot \frac{1}{\sqrt{\sigma_B^2 + \epsilon}} + \frac{\partial \mathcal{L}}{\partial \sigma_B^2} \cdot \frac{2(x_i - \mu_B)}{m} + \frac{\partial \mathcal{L}}{\partial \mu_B} \cdot \frac{1}{m}$$

**Simplified form (combining all terms):**

Let $\sigma^{-1} = (\sigma_B^2 + \epsilon)^{-1/2}$ and $d\hat{x}_i = \frac{\partial \mathcal{L}}{\partial y_i} \cdot \gamma$. Then:

$$\frac{\partial \mathcal{L}}{\partial x_i} = \frac{\sigma^{-1}}{m}\left(m \cdot d\hat{x}_i - \sum_{j} d\hat{x}_j - \hat{x}_i \sum_{j} d\hat{x}_j \cdot \hat{x}_j\right)$$

This compact form is what is actually implemented in practice. It reveals that BN centers and rescales the gradient, which has a normalizing effect on the gradient itself.

### 3.2 Why Batch Normalization Works

#### 3.2.1 Original Explanation: Internal Covariate Shift

Ioffe and Szegedy (2015) argued that BN works by reducing **internal covariate shift (ICS)**: the change in the distribution of layer inputs during training. By normalizing activations, each layer sees a more stable input distribution, enabling faster training.

#### 3.2.2 Modern Understanding: Loss Smoothing (Santurkar et al., 2018)

Santurkar et al. showed that:

1. **BN does not reduce ICS.** Networks with BN can exhibit *more* ICS than networks without it, while still training faster.
2. **BN smooths the loss landscape.** The key benefit is that BN makes the loss function more Lipschitz continuous and its gradient more Lipschitz:

**Theorem 3.1 (Informal, Santurkar et al.).** For a network with BN, the loss function $\mathcal{L}(\theta)$ satisfies:

$$|\mathcal{L}(\theta_1) - \mathcal{L}(\theta_2)| \leq L \|\theta_1 - \theta_2\|$$

$$\|\nabla \mathcal{L}(\theta_1) - \nabla \mathcal{L}(\theta_2)\| \leq \beta \|\theta_1 - \theta_2\|$$

with smaller Lipschitz constants $L$ and $\beta$ than the unnormalized network.

*Proof sketch.* Normalization bounds the magnitude of activations: $\|\hat{x}\|^2 \approx d$ (the dimension), regardless of the magnitude of the unnormalized activations. This prevents large activations from creating steep gradients and sharp curvature. More precisely, the Hessian eigenvalues are bounded because the normalization division by $\sigma$ prevents the activations from scaling with the weight norms. The loss landscape becomes more "convex-like" locally, enabling larger learning rates without divergence. $\square$

**Consequence:** BN enables higher learning rates because the gradient is a more reliable indicator of the loss landscape's geometry. Steps in the negative gradient direction are more likely to decrease the loss.

### 3.3 Layer Normalization (Ba et al., 2016)

**Definition 3.2 (Layer Normalization).** For a single sample, normalize across all channels and spatial positions (or all features in an FC layer):

$$\mu_{\text{LN}} = \frac{1}{C \cdot H \cdot W} \sum_{c,h,w} x_{c,h,w}$$

$$\sigma_{\text{LN}}^2 = \frac{1}{C \cdot H \cdot W} \sum_{c,h,w} (x_{c,h,w} - \mu_{\text{LN}})^2$$

$$\hat{x}_{c,h,w} = \frac{x_{c,h,w} - \mu_{\text{LN}}}{\sqrt{\sigma_{\text{LN}}^2 + \epsilon}}$$

$$y_{c,h,w} = \gamma_c \hat{x}_{c,h,w} + \beta_c$$

**Key difference from BN:** Statistics are computed per sample, not per batch. This makes LN independent of batch size, suitable for:

- Sequence models (variable-length sequences)
- Small batch sizes
- Online/single-sample inference
- Reinforcement learning (where batch statistics are meaningless)

**Limitation for CNNs:** LN treats all channels equally, but in CNNs different channels often have very different activation scales (e.g., edge detectors vs. texture detectors). BN's per-channel normalization respects this.

### 3.4 Instance Normalization (Ulyanov et al., 2016)

**Definition 3.3 (Instance Normalization).** Normalize over spatial dimensions only, per channel and per sample:

$$\mu_{\text{IN}}^{(n,c)} = \frac{1}{HW}\sum_{h,w} x_{n,c,h,w} \qquad \sigma_{\text{IN}}^{2(n,c)} = \frac{1}{HW}\sum_{h,w}(x_{n,c,h,w} - \mu_{\text{IN}}^{(n,c)})^2$$

**Use case:** Style transfer and generative models, where the style information is encoded in per-channel feature statistics. IN removes style-specific contrast from each channel, enabling content-style disentanglement.

### 3.5 Group Normalization (Wu & He, 2018)

**Definition 3.4 (Group Normalization).** Divide channels into $G$ groups. For each group, normalize over spatial dimensions and channels within the group:

$$\mu_g^{(n)} = \frac{1}{(C/G) \cdot HW} \sum_{c \in \text{group } g} \sum_{h,w} x_{n,c,h,w}$$

- **$G = 1$:** Equivalent to Layer Normalization.
- **$G = C$:** Equivalent to Instance Normalization.
- **Typical choice:** $G = 32$ (each group has $C/32$ channels).

**Advantage:** Like LN, GN is independent of batch size. Unlike LN, it respects the grouping structure of channels, which better matches CNN channel semantics. GN achieves comparable accuracy to BN on ImageNet when batch size is moderate (>= 16 per GPU) and *surpasses* BN at very small batch sizes.

### 3.6 Summary of Normalization Axes

For a feature map $x \in \mathbb{R}^{N \times C \times H \times W}$:

| Method | Normalization Axes | Stats Depend on Batch? | Learnable Params |
|:------:|:------------------:|:----------------------:|:----------------:|
| BN     | N, H, W            | Yes                    | 2C               |
| LN     | C, H, W            | No                     | 2C               |
| IN     | H, W               | No                     | 2C               |
| GN     | C/G, H, W          | No                     | 2C               |

### 3.7 Weight Standardization (Qiao et al., 2019)

**Definition 3.5.** Instead of normalizing activations, normalize the convolutional weights:

$$\hat{W}_{o,i,h,w} = \frac{W_{o,i,h,w} - \bar{W}_o}{\sigma_{W_o} + \epsilon}$$

where $\bar{W}_o$ and $\sigma_{W_o}$ are the mean and std of the weights for output channel $o$ (computed over $C_{\text{in}}, K_h, K_w$).

Weight standardization is often combined with Group Normalization and can replace Batch Normalization entirely, enabling training with batch size 1.

### 3.8 Data Augmentation

#### 3.8.1 Standard Augmentations

**Random horizontal flip:** $x' = \text{flip}(x)$ with probability 0.5.

**Random crop:** Pad the image by $p$ pixels (typically 4 for CIFAR), then take a random $H \times W$ crop.

**Color jitter:** Randomly adjust brightness $b$, contrast $c$, saturation $s$, hue $h$:

$$x' = \text{Hue}(h, \text{Sat}(s, \text{Contrast}(c, \text{Brightness}(b, x))))$$

where each parameter is sampled uniformly from a specified range.

#### 3.8.2 Cutout (DeVries & Taylor, 2017)

**Definition 3.6.** Randomly mask a square region of the image with zeros:

$$x'_{c,i,j} = \begin{cases} 0 & \text{if } |i - i_0| \leq l/2 \text{ and } |j - j_0| \leq l/2 \\ x_{c,i,j} & \text{otherwise} \end{cases}$$

where $(i_0, j_0)$ is a randomly chosen center and $l$ is the mask size. Typical: $l = 16$ for 32x32 images.

**Interpretation:** Forces the network to use distributed representations rather than relying on any single local feature.

#### 3.8.3 Mixup (Zhang et al., 2018)

**Definition 3.7.** Construct virtual training examples by linearly interpolating pairs:

$$\tilde{x} = \lambda x_i + (1 - \lambda) x_j$$
$$\tilde{y} = \lambda y_i + (1 - \lambda) y_j$$

where $\lambda \sim \text{Beta}(\alpha, \alpha)$ and $(x_i, y_i), (x_j, y_j)$ are randomly drawn training pairs. Labels $y$ are one-hot vectors, so $\tilde{y}$ is a soft label.

**Modified loss:** The cross-entropy becomes:

$$\mathcal{L}(\tilde{x}, \tilde{y}) = -\sum_k \tilde{y}_k \log p_k(\tilde{x}) = -\lambda \log p_{y_i}(\tilde{x}) - (1-\lambda) \log p_{y_j}(\tilde{x})$$

**Theoretical interpretation:** Mixup is a form of Vicinal Risk Minimization (VRM) that linearly interpolates between data points in input space, encouraging the model to behave linearly between training examples.

#### 3.8.4 CutMix (Yun et al., 2019)

**Definition 3.8.** Combine patches from two images and mix labels proportionally to the area:

$$\tilde{x} = \mathbf{M} \odot x_i + (1 - \mathbf{M}) \odot x_j$$
$$\tilde{y} = \lambda y_i + (1 - \lambda) y_j$$

where $\mathbf{M} \in \{0, 1\}^{H \times W}$ is a binary mask defining a rectangular region, and $\lambda = 1 - \frac{r_w r_h}{HW}$ is the ratio of the unmasked area, with $r_w, r_h$ sampled so that $\frac{r_w r_h}{HW} \sim \text{Beta}(\alpha, \alpha)$.

**Advantage over Cutout:** The masked region contains informative pixels from another image rather than zeros. Advantage over Mixup: preserves local statistics (no ghosting artifacts from blending).

### 3.9 Learning Rate Warmup

**Definition 3.9 (Linear Warmup).** For the first $T_w$ steps, linearly increase the learning rate from a small value to the target:

$$\eta_t = \eta_{\text{target}} \cdot \frac{t}{T_w} \quad \text{for } t \leq T_w$$

**Justification (Gotmare et al., 2019):** At the start of training, the model parameters are far from any reasonable solution. Large gradients with a high learning rate can push the model into a poor region of loss space. Warmup allows the running statistics of BN and the optimizer state (e.g., Adam's moment estimates) to stabilize before taking large steps.

### 3.10 Progressive Resizing (Howard, 2018)

**Strategy:** Begin training on small images (e.g., 128x128) and progressively increase resolution (to 224x224 or larger) during training.

**Benefits:**

- Early epochs are computationally cheap (small images = fewer FLOPs).
- Low-resolution training acts as regularization (the model cannot rely on fine details).
- Higher resolution in later stages provides fine-grained features.

---

## 4. Algorithmic Derivation

### 4.1 Batch Normalization Forward Pass

```
Algorithm: BatchNorm_Forward
Input: x ∈ R^{N × C × H × W}, γ ∈ R^C, β ∈ R^C, ε, momentum α
       running_mean ∈ R^C, running_var ∈ R^C, training: bool
Output: y ∈ R^{N × C × H × W}

1.  if training:
2.      for c = 0 to C-1:
3.          // Compute per-channel statistics over N, H, W
4.          m = N * H * W
5.          μ_c = (1/m) * sum_{n,h,w} x[n,c,h,w]
6.          σ²_c = (1/m) * sum_{n,h,w} (x[n,c,h,w] - μ_c)²
7.          // Normalize
8.          x̂[n,c,h,w] = (x[n,c,h,w] - μ_c) / sqrt(σ²_c + ε)  for all n,h,w
9.          // Scale and shift
10.         y[n,c,h,w] = γ_c * x̂[n,c,h,w] + β_c              for all n,h,w
11.         // Update running stats
12.         running_mean[c] = (1-α)*running_mean[c] + α*μ_c
13.         running_var[c]  = (1-α)*running_var[c]  + α*σ²_c
14. else:
15.     for c = 0 to C-1:
16.         y[n,c,h,w] = γ_c * (x[n,c,h,w] - running_mean[c]) / sqrt(running_var[c] + ε) + β_c
17. return y
```

**Time complexity:** $O(NCHW)$ per forward pass (two passes over the data: mean, then variance).

### 4.2 Batch Normalization Backward Pass

```
Algorithm: BatchNorm_Backward
Input: dy ∈ R^{N × C × H × W}, cached: x̂, σ_inv (per channel), γ
Output: dx ∈ R^{N × C × H × W}, dγ ∈ R^C, dβ ∈ R^C

1.  m = N * H * W
2.  for c = 0 to C-1:
3.      // Gradient w.r.t. γ and β
4.      dβ[c] = sum_{n,h,w} dy[n,c,h,w]
5.      dγ[c] = sum_{n,h,w} dy[n,c,h,w] * x̂[n,c,h,w]
6.
7.      // Gradient w.r.t. x̂
8.      dx̂[n,c,h,w] = dy[n,c,h,w] * γ[c]           for all n,h,w
9.
10.     // Efficient combined gradient w.r.t. x
11.     // dx = σ_inv/m * (m*dx̂ - sum(dx̂) - x̂*sum(dx̂*x̂))
12.     sum_dx̂ = sum_{n,h,w} dx̂[n,c,h,w]
13.     sum_dx̂_x̂ = sum_{n,h,w} dx̂[n,c,h,w] * x̂[n,c,h,w]
14.     dx[n,c,h,w] = σ_inv[c] / m * (
15.         m * dx̂[n,c,h,w] - sum_dx̂ - x̂[n,c,h,w] * sum_dx̂_x̂
16.     )   for all n,h,w
17. return dx, dγ, dβ
```

**Time complexity:** $O(NCHW)$ — same as forward pass.

---

## 5. PyTorch Implementation

### 5.1 Batch Normalization from Scratch

```python
import torch
import torch.nn as nn

class BatchNorm2d(nn.Module):
    """
    Batch Normalization implemented from scratch.

    Normalizes over (N, H, W) dimensions for each channel.
    Maintains running statistics for inference.
    """

    def __init__(self, num_features: int, eps: float = 1e-5, momentum: float = 0.1):
        super().__init__()
        self.num_features = num_features
        self.eps = eps
        self.momentum = momentum

        # Learnable parameters
        self.gamma = nn.Parameter(torch.ones(num_features))    # (C,)
        self.beta = nn.Parameter(torch.zeros(num_features))    # (C,)

        # Running statistics (not parameters, not updated by optimizer)
        self.register_buffer('running_mean', torch.zeros(num_features))  # (C,)
        self.register_buffer('running_var', torch.ones(num_features))    # (C,)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input of shape (N, C, H, W)
        Returns:
            Normalized output of shape (N, C, H, W)
        """
        N, C, H, W = x.shape

        if self.training:
            # Compute batch statistics over N, H, W for each channel
            mean = x.mean(dim=(0, 2, 3))                       # (C,)
            var = x.var(dim=(0, 2, 3), unbiased=False)         # (C,)

            # Update running statistics
            with torch.no_grad():
                self.running_mean = (1 - self.momentum) * self.running_mean + self.momentum * mean
                self.running_var = (1 - self.momentum) * self.running_var + self.momentum * var
        else:
            mean = self.running_mean                            # (C,)
            var = self.running_var                               # (C,)

        # Reshape for broadcasting: (C,) -> (1, C, 1, 1)
        mean = mean.view(1, C, 1, 1)                           # (1, C, 1, 1)
        var = var.view(1, C, 1, 1)                              # (1, C, 1, 1)
        gamma = self.gamma.view(1, C, 1, 1)                    # (1, C, 1, 1)
        beta = self.beta.view(1, C, 1, 1)                      # (1, C, 1, 1)

        # Normalize, scale, shift
        x_hat = (x - mean) / torch.sqrt(var + self.eps)       # (N, C, H, W)
        y = gamma * x_hat + beta                                # (N, C, H, W)
        return y

# --- Verification ---
torch.manual_seed(42)
bn_custom = BatchNorm2d(64)
bn_torch = nn.BatchNorm2d(64, eps=1e-5, momentum=0.1)

# Copy parameters
bn_torch.weight.data = bn_custom.gamma.data.clone()
bn_torch.bias.data = bn_custom.beta.data.clone()

x = torch.randn(8, 64, 16, 16)                                # (N=8, C=64, H=16, W=16)

bn_custom.train()
bn_torch.train()
y_custom = bn_custom(x)                                        # (8, 64, 16, 16)
y_torch = bn_torch(x)                                          # (8, 64, 16, 16)

print(f"Max error (training): {(y_custom - y_torch).abs().max().item():.2e}")
# Expected: ~1e-6
```

### 5.2 Layer Normalization from Scratch

```python
class LayerNorm2d(nn.Module):
    """
    Layer Normalization for 2D feature maps.
    Normalizes over (C, H, W) for each sample independently.
    """

    def __init__(self, num_features: int, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        self.gamma = nn.Parameter(torch.ones(num_features))    # (C,)
        self.beta = nn.Parameter(torch.zeros(num_features))    # (C,)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input of shape (N, C, H, W)
        Returns:
            Output of shape (N, C, H, W)
        """
        # Statistics over C, H, W for each sample
        mean = x.mean(dim=(1, 2, 3), keepdim=True)            # (N, 1, 1, 1)
        var = x.var(dim=(1, 2, 3), keepdim=True, unbiased=False)  # (N, 1, 1, 1)

        x_hat = (x - mean) / torch.sqrt(var + self.eps)       # (N, C, H, W)

        gamma = self.gamma.view(1, -1, 1, 1)                  # (1, C, 1, 1)
        beta = self.beta.view(1, -1, 1, 1)                    # (1, C, 1, 1)
        return gamma * x_hat + beta                             # (N, C, H, W)
```

### 5.3 Group Normalization from Scratch

```python
class GroupNorm2d(nn.Module):
    """
    Group Normalization.
    Divides channels into G groups and normalizes within each group.

    G=1  -> Layer Norm
    G=C  -> Instance Norm
    """

    def __init__(self, num_groups: int, num_channels: int, eps: float = 1e-5):
        super().__init__()
        assert num_channels % num_groups == 0, "C must be divisible by G"
        self.G = num_groups
        self.C = num_channels
        self.eps = eps
        self.gamma = nn.Parameter(torch.ones(num_channels))    # (C,)
        self.beta = nn.Parameter(torch.zeros(num_channels))    # (C,)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input of shape (N, C, H, W)
        Returns:
            Output of shape (N, C, H, W)
        """
        N, C, H, W = x.shape
        G = self.G

        # Reshape: (N, G, C//G, H, W)
        x = x.view(N, G, C // G, H, W)

        # Statistics over (C//G, H, W) for each (N, G)
        mean = x.mean(dim=(2, 3, 4), keepdim=True)            # (N, G, 1, 1, 1)
        var = x.var(dim=(2, 3, 4), keepdim=True, unbiased=False)  # (N, G, 1, 1, 1)

        x_hat = (x - mean) / torch.sqrt(var + self.eps)       # (N, G, C//G, H, W)
        x_hat = x_hat.view(N, C, H, W)                        # (N, C, H, W)

        gamma = self.gamma.view(1, C, 1, 1)                   # (1, C, 1, 1)
        beta = self.beta.view(1, C, 1, 1)                     # (1, C, 1, 1)
        return gamma * x_hat + beta                             # (N, C, H, W)

# --- Compare all normalization methods ---
torch.manual_seed(0)
x = torch.randn(4, 32, 8, 8)                                  # (N=4, C=32, H=8, W=8)

bn = BatchNorm2d(32)
ln = LayerNorm2d(32)
gn = GroupNorm2d(num_groups=8, num_channels=32)

y_bn = bn(x)                                                   # (4, 32, 8, 8)
y_ln = ln(x)                                                   # (4, 32, 8, 8)
y_gn = gn(x)                                                   # (4, 32, 8, 8)

for name, y in [("BN", y_bn), ("LN", y_ln), ("GN", y_gn)]:
    print(f"{name}: mean={y.mean():.4f}, std={y.std():.4f}")
```

### 5.4 Data Augmentation Implementations

```python
import torch
import torch.nn.functional as F

def cutout(x: torch.Tensor, mask_size: int = 16) -> torch.Tensor:
    """
    Apply Cutout augmentation.

    Args:
        x: Input images of shape (N, C, H, W)
        mask_size: Side length of the square mask

    Returns:
        Augmented images of shape (N, C, H, W)
    """
    N, C, H, W = x.shape
    x = x.clone()

    # Random center for each image
    cy = torch.randint(0, H, (N,))                            # (N,)
    cx = torch.randint(0, W, (N,))                             # (N,)

    for i in range(N):
        y1 = max(0, cy[i] - mask_size // 2)
        y2 = min(H, cy[i] + mask_size // 2)
        x1 = max(0, cx[i] - mask_size // 2)
        x2 = min(W, cx[i] + mask_size // 2)
        x[i, :, y1:y2, x1:x2] = 0                            # zero out region

    return x                                                    # (N, C, H, W)

def mixup(x: torch.Tensor, y: torch.Tensor, alpha: float = 1.0):
    """
    Apply Mixup augmentation.

    Args:
        x: Input images of shape (N, C, H, W)
        y: One-hot labels of shape (N, num_classes)
        alpha: Beta distribution parameter

    Returns:
        Mixed images (N, C, H, W) and mixed labels (N, num_classes)
    """
    lam = torch.distributions.Beta(alpha, alpha).sample()      # scalar

    # Random permutation for pairing
    perm = torch.randperm(x.shape[0])

    x_mix = lam * x + (1 - lam) * x[perm]                     # (N, C, H, W)
    y_mix = lam * y + (1 - lam) * y[perm]                     # (N, num_classes)

    return x_mix, y_mix

def cutmix(x: torch.Tensor, y: torch.Tensor, alpha: float = 1.0):
    """
    Apply CutMix augmentation.

    Args:
        x: Input images of shape (N, C, H, W)
        y: One-hot labels of shape (N, num_classes)
        alpha: Beta distribution parameter

    Returns:
        Mixed images (N, C, H, W) and mixed labels (N, num_classes)
    """
    N, C, H, W = x.shape
    lam = torch.distributions.Beta(alpha, alpha).sample()

    # Random permutation for pairing
    perm = torch.randperm(N)

    # Sample bounding box
    cut_ratio = torch.sqrt(1 - lam)
    cut_h = int(H * cut_ratio)
    cut_w = int(W * cut_ratio)

    cy = torch.randint(0, H, (1,)).item()
    cx = torch.randint(0, W, (1,)).item()

    y1 = max(0, cy - cut_h // 2)
    y2 = min(H, cy + cut_h // 2)
    x1 = max(0, cx - cut_w // 2)
    x2 = min(W, cx + cut_w // 2)

    x_mix = x.clone()
    x_mix[:, :, y1:y2, x1:x2] = x[perm, :, y1:y2, x1:x2]   # (N, C, H, W)

    # Adjust lambda to actual area ratio
    lam_actual = 1 - (y2 - y1) * (x2 - x1) / (H * W)
    y_mix = lam_actual * y + (1 - lam_actual) * y[perm]       # (N, num_classes)

    return x_mix, y_mix

# --- Demo ---
torch.manual_seed(0)
x = torch.randn(8, 3, 32, 32)                                  # (N=8, C=3, H=32, W=32)
y = F.one_hot(torch.randint(0, 10, (8,)), 10).float()          # (N=8, 10)

x_cutout = cutout(x, mask_size=16)
print(f"Cutout: zeros fraction = {(x_cutout == 0).float().mean():.2%}")

x_mix, y_mix = mixup(x, y, alpha=0.4)
print(f"Mixup: label entropy = {-(y_mix * y_mix.clamp(min=1e-8).log()).sum(-1).mean():.4f}")

x_cmix, y_cmix = cutmix(x, y, alpha=1.0)
print(f"CutMix: mixed image range = [{x_cmix.min():.2f}, {x_cmix.max():.2f}]")
```

### 5.5 Learning Rate Warmup with Cosine Annealing

```python
import torch.optim as optim
import math

def get_lr_schedule(optimizer, warmup_steps: int, total_steps: int):
    """
    Create a learning rate schedule with linear warmup and cosine decay.

    Args:
        optimizer: PyTorch optimizer
        warmup_steps: Number of warmup steps
        total_steps: Total number of training steps
    """
    def lr_lambda(step):
        if step < warmup_steps:
            # Linear warmup
            return step / warmup_steps
        else:
            # Cosine annealing
            progress = (step - warmup_steps) / (total_steps - warmup_steps)
            return 0.5 * (1 + math.cos(math.pi * progress))

    return optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

# --- Example usage ---
model = nn.Linear(10, 10)
optimizer = optim.SGD(model.parameters(), lr=0.1)
scheduler = get_lr_schedule(optimizer, warmup_steps=500, total_steps=10000)

lrs = []
for step in range(10000):
    lrs.append(optimizer.param_groups[0]['lr'])
    optimizer.step()
    scheduler.step()

print(f"LR at step 0:    {lrs[0]:.6f}")      # ~0 (warmup start)
print(f"LR at step 500:  {lrs[500]:.6f}")     # ~0.1 (warmup end)
print(f"LR at step 5000: {lrs[5000]:.6f}")    # ~0.05 (cosine mid)
print(f"LR at step 9999: {lrs[9999]:.6f}")    # ~0 (cosine end)
```

---

## 6. Experimental Intuition

### 6.1 BN vs. LN vs. GN on Image Classification

| Method | CIFAR-100 (batch=128) | CIFAR-100 (batch=2) | ImageNet Top-1 |
|:------:|:---------------------:|:-------------------:|:--------------:|
| BN     | 78.5%                 | 62.3%               | 76.3%          |
| LN     | 75.2%                 | 75.0%               | 74.5%          |
| GN-32  | 77.8%                 | 77.5%               | 75.9%          |
| IN     | 71.3%                 | 71.1%               | 72.1%          |

**Key observations:**

- BN excels with large batches but degrades dramatically with small batches.
- GN is nearly batch-size invariant and close to BN's large-batch accuracy.
- LN works but is slightly worse for CNNs.
- IN is too aggressive (per-channel, per-sample normalization discards too much information for classification).

### 6.2 Data Augmentation Ablation

| Augmentation              | CIFAR-100 (ResNet-18) | Additional Training Cost |
|:-------------------------:|:---------------------:|:------------------------:|
| Baseline (flip + crop)    | 77.3%                 | 1.0x                    |
| + Cutout (16)             | 78.9%                 | 1.0x                    |
| + Mixup (alpha=0.2)       | 79.1%                 | 1.0x                    |
| + CutMix (alpha=1.0)      | 79.8%                 | 1.0x                    |
| + Mixup + CutMix          | 80.3%                 | 1.0x                    |

Data augmentation is "free" in terms of FLOPs (same batch size, same forward/backward cost) but provides substantial regularization.

### 6.3 Failure Modes

1. **BN with batch size 1:** Statistics are undefined (variance = 0). Use GN or LN instead.
2. **BN in recurrent networks:** The statistics vary across time steps, requiring per-timestep BN parameters, which is cumbersome. Use LN.
3. **BN with very different train/test distributions:** Running statistics may not match test data. Solution: recalculate BN statistics on test data (BN calibration).
4. **Over-aggressive augmentation:** Very strong Cutout (large mask) or Mixup (high alpha) can hurt if the dataset is small — the model never sees "clean" examples.

---

## 7. Connections and Extensions

### 7.1 Prior Modules

- **Module 01:** BN changes the loss landscape, interacting with optimizer choice. Adam is less sensitive to BN than SGD.
- **Lecture 02a:** BN is applied after convolution, before activation.
- **Lecture 02b:** BN is integral to ResNet — the original ResNet paper uses BN in every residual block.

### 7.2 Future Modules

- **Module 04 (Transformers):** Layer Normalization is standard in Transformers. Understanding why LN > BN for sequences is critical.
- **Module 06 (GANs):** Spectral normalization and instance normalization are standard for discriminators and generators.

### 7.3 Extensions

- **Adaptive Instance Normalization (AdaIN, Huang & Belongie 2017):** Transfers style by adjusting IN statistics — foundational for neural style transfer.
- **Switchable Normalization (Luo et al., 2019):** Learns to combine BN, LN, IN per layer.
- **RandAugment (Cubuk et al., 2020):** Automated augmentation policy with only 2 hyperparameters.

---

## 8. Seminal Paper Reading List

### Required

1. S. Ioffe and C. Szegedy. "Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift." *ICML*, 2015.
2. S. Santurkar, D. Tsipras, A. Ilyas, and A. Madry. "How Does Batch Normalization Help Optimization?" *NeurIPS*, 2018.

### Recommended

3. J. L. Ba, J. R. Kiros, and G. E. Hinton. "Layer Normalization." *arXiv:1607.06450*, 2016.
4. Y. Wu and K. He. "Group Normalization." *ECCV*, 2018.
5. H. Zhang, M. Cisse, Y. N. Dauphin, and D. Lopez-Paz. "mixup: Beyond Empirical Risk Minimization." *ICLR*, 2018.
6. S. Yun, D. Han, S. J. Oh, S. Chun, J. Choe, and Y. Yoo. "CutMix: Regularization Strategy to Train Strong Classifiers with Localizable Features." *ICCV*, 2019.
7. T. DeVries and G. W. Taylor. "Improved Regularization of Convolutional Neural Networks with Cutout." *arXiv:1708.04552*, 2017.

---

## 9. Exercises

### Theory Exercises

**Exercise 3.1.** Derive the full backward pass for batch normalization step by step, without using the compact form. Show all intermediate gradients: $\frac{\partial \mathcal{L}}{\partial \gamma}$, $\frac{\partial \mathcal{L}}{\partial \beta}$, $\frac{\partial \mathcal{L}}{\partial \hat{x}_i}$, $\frac{\partial \mathcal{L}}{\partial \sigma^2}$, $\frac{\partial \mathcal{L}}{\partial \mu}$, $\frac{\partial \mathcal{L}}{\partial x_i}$.

**Exercise 3.2.** Prove that the compact form $\frac{\partial \mathcal{L}}{\partial x_i} = \frac{\sigma^{-1}}{m}(m \cdot d\hat{x}_i - \sum_j d\hat{x}_j - \hat{x}_i \sum_j d\hat{x}_j \hat{x}_j)$ is equivalent to the step-by-step derivation.

**Exercise 3.3.** Show that if $\gamma = \sigma$ and $\beta = \mu$ (the BN parameters learn to undo the normalization), then BN becomes the identity function. What does this imply about the representational capacity of a network with BN?

**Exercise 3.4.** Derive the Mixup training objective and show that it is equivalent to Vicinal Risk Minimization with a specific vicinity distribution.

**Exercise 3.5.** Prove that for a linear model $f(x) = w^T x$, Mixup training (with $\alpha \to \infty$, i.e., $\lambda \to 0.5$) is equivalent to standard training with an additional gradient penalty $\|\nabla_x f\|^2$.

### Implementation Exercises

**Exercise 3.6.** Implement Batch Normalization backward pass from scratch (do not use autograd). Verify against PyTorch's autograd using `torch.autograd.gradcheck`.

**Exercise 3.7.** Train ResNet-18 on CIFAR-100 with BN, LN, GN (32 groups), and no normalization. Plot training curves and test accuracy for each. Repeat with batch sizes {128, 32, 8, 2}.

**Exercise 3.8.** Implement and compare Cutout, Mixup, and CutMix on CIFAR-100 with a ResNet-18 baseline. Report accuracy and visualize augmented samples.

**Exercise 3.9.** Implement progressive resizing for CIFAR-100: start training at 16x16, increase to 24x24 at epoch 100, and 32x32 at epoch 200 (out of 300 total). Compare with fixed 32x32 training.

**Exercise 3.10.** Visualize the loss landscape with and without BN using the method of Li et al. (2018). Train two ResNet-20 models on CIFAR-10 (one with BN, one without) and plot 2D loss surfaces along random directions.
