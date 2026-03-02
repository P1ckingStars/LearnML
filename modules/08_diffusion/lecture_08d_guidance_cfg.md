# Lecture 08d: Guidance, Classifier-Free Guidance, and Latent Diffusion

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** classifier guidance from Bayes' rule applied to diffusion models and show the modified score decomposition.
2. **Derive** classifier-free guidance (CFG), including the implicit classifier interpretation.
3. **Explain** the quality-diversity tradeoff controlled by the guidance scale $w$.
4. **Describe** conditional generation architectures for class-conditional and text-conditional models.
5. **Explain** latent diffusion models and why compressing to a learned latent space improves efficiency.
6. **Implement** classifier-free guidance in PyTorch for both DDPM and DDIM sampling.

---

## 2. Motivation and Context

### 2.1 The Need for Conditional Generation

Unconditional diffusion models generate diverse samples from the data distribution, but practical applications require **controllable** generation:

- Generate an image of a specific class (e.g., "golden retriever").
- Generate an image matching a text description (e.g., "an astronaut riding a horse").
- Vary the tradeoff between sample quality (fidelity to the condition) and diversity.

The question is: how do we inject conditioning information $c$ (class label, text embedding, etc.) into the reverse process?

### 2.2 Two Paradigms

1. **Classifier guidance** (Dhariwal & Nichol, 2021): Train an unconditional diffusion model and a separate classifier $p(y \mid x_t)$ on noisy images. Use the classifier's gradient to steer sampling.

2. **Classifier-free guidance** (Ho & Salimans, 2022): Train a single conditional model $\varepsilon_\theta(x_t, t, c)$ that can also operate unconditionally (by setting $c = \varnothing$). Use the difference between conditional and unconditional predictions to steer sampling --- no separate classifier needed.

Classifier-free guidance has become the dominant approach, powering DALL-E 2, Imagen, Stable Diffusion, and nearly all modern text-to-image systems.

---

## 3. Core Theory

### 3.1 Classifier Guidance

#### 3.1.1 Setup

Suppose we have:
- An unconditional diffusion model that estimates the score $\nabla_{x_t} \log p(x_t)$.
- A classifier $p_\phi(y \mid x_t)$ trained on noisy images at all noise levels.

We want to sample from the **class-conditional** distribution $p(x_t \mid y)$.

#### 3.1.2 Score Decomposition

**Theorem 3.1 (Classifier Guidance).** The score of the conditional distribution decomposes as:

$$\nabla_{x_t} \log p(x_t \mid y) = \nabla_{x_t} \log p(x_t) + \nabla_{x_t} \log p(y \mid x_t)$$

*Proof.* By Bayes' rule:

$$p(x_t \mid y) = \frac{p(y \mid x_t)\, p(x_t)}{p(y)}$$

Taking the log:

$$\log p(x_t \mid y) = \log p(y \mid x_t) + \log p(x_t) - \log p(y)$$

Taking the gradient with respect to $x_t$ (note $\nabla_{x_t} \log p(y) = 0$ since $p(y)$ does not depend on $x_t$):

$$\nabla_{x_t} \log p(x_t \mid y) = \nabla_{x_t} \log p(x_t) + \nabla_{x_t} \log p(y \mid x_t) \qquad \blacksquare$$

#### 3.1.3 Guided Score with Scale

Dhariwal and Nichol (2021) introduced a **guidance scale** $s > 0$ to amplify the classifier signal:

$$\nabla_{x_t} \log p_s(x_t \mid y) = \nabla_{x_t} \log p(x_t) + s \cdot \nabla_{x_t} \log p_\phi(y \mid x_t)$$

This corresponds to sampling from a modified distribution:

$$\tilde{p}_s(x_t \mid y) \propto p(x_t) \cdot p_\phi(y \mid x_t)^s$$

- $s = 0$: unconditional sampling.
- $s = 1$: exact class-conditional sampling.
- $s > 1$: sharpened conditional, trading diversity for quality.

#### 3.1.4 In Terms of Noise Prediction

Converting to $\varepsilon$-prediction using the score-noise relationship $\nabla_{x_t} \log p(x_t) \approx -\varepsilon_\theta(x_t, t) / \sqrt{1-\bar{\alpha}_t}$:

$$\hat{\varepsilon} = \varepsilon_\theta(x_t, t) - s \sqrt{1-\bar{\alpha}_t}\, \nabla_{x_t} \log p_\phi(y \mid x_t)$$

This modified noise estimate replaces $\varepsilon_\theta$ in the standard DDPM/DDIM sampling step.

#### 3.1.5 Limitations of Classifier Guidance

1. **Requires a separate classifier** trained on noisy data at all noise levels --- non-trivial to train and maintain.
2. **Adversarial gradients**: The classifier gradient can produce adversarial perturbations rather than semantically meaningful guidance, especially at high guidance scales.
3. **Restricted to classification**: Extending to complex conditions (text, layout) is awkward.

### 3.2 Classifier-Free Guidance

#### 3.2.1 Setup

Train a single model $\varepsilon_\theta(x_t, t, c)$ that takes a conditioning signal $c$ (class label, text embedding, etc.) and also supports unconditional generation by passing a null token $c = \varnothing$:

- During training, randomly drop the conditioning signal (replace $c$ with $\varnothing$) with probability $p_{\text{uncond}}$ (typically 10-20%). This trains both the conditional and unconditional models simultaneously.
- At inference, combine the conditional and unconditional predictions.

#### 3.2.2 The Implicit Classifier

**Theorem 3.2 (Implicit Classifier in CFG).** The difference between conditional and unconditional score functions defines an implicit classifier:

$$\nabla_{x_t} \log p(c \mid x_t) = \nabla_{x_t} \log p(x_t \mid c) - \nabla_{x_t} \log p(x_t)$$

In terms of noise prediction:

$$\nabla_{x_t} \log p(c \mid x_t) \propto -\bigl[\varepsilon_\theta(x_t, t, c) - \varepsilon_\theta(x_t, t, \varnothing)\bigr]$$

*Proof.* From Bayes' rule (as in Theorem 3.1):

$$\nabla_{x_t} \log p(c \mid x_t) = \nabla_{x_t} \log p(x_t \mid c) - \nabla_{x_t} \log p(x_t)$$

(since $\nabla_{x_t} \log p(c) = 0$). Converting to $\varepsilon$-prediction:

$$\nabla_{x_t} \log p(x_t \mid c) = -\frac{\varepsilon_\theta(x_t, t, c)}{\sqrt{1-\bar{\alpha}_t}}, \quad \nabla_{x_t} \log p(x_t) = -\frac{\varepsilon_\theta(x_t, t, \varnothing)}{\sqrt{1-\bar{\alpha}_t}}$$

Therefore:

$$\nabla_{x_t} \log p(c \mid x_t) = -\frac{\varepsilon_\theta(x_t, t, c) - \varepsilon_\theta(x_t, t, \varnothing)}{\sqrt{1-\bar{\alpha}_t}} \qquad \blacksquare$$

#### 3.2.3 CFG Score Formula

Substituting the implicit classifier into the guided score (with guidance weight $w$):

$$\nabla_{x_t} \log \tilde{p}_w(x_t \mid c) = \nabla_{x_t} \log p(x_t) + (1+w) \cdot \nabla_{x_t} \log p(c \mid x_t)$$

Wait --- let us be more careful. Start from the classifier guidance formulation:

$$\tilde{s}(x_t) = \nabla_{x_t} \log p(x_t) + w \cdot \nabla_{x_t} \log p(c \mid x_t)$$

Substituting the implicit classifier:

$$= \nabla_{x_t} \log p(x_t) + w \bigl[\nabla_{x_t} \log p(x_t \mid c) - \nabla_{x_t} \log p(x_t)\bigr]$$

$$= (1-w)\, \nabla_{x_t} \log p(x_t) + w\, \nabla_{x_t} \log p(x_t \mid c)$$

Converting to $\varepsilon$-prediction:

$$\boxed{\tilde{\varepsilon} = (1+w)\, \varepsilon_\theta(x_t, t, c) - w\, \varepsilon_\theta(x_t, t, \varnothing)}$$

**Derivation of the boxed formula.** We have:

$$\tilde{s} = (1-w)\left(-\frac{\varepsilon_\theta(x_t,t,\varnothing)}{\sqrt{1-\bar{\alpha}_t}}\right) + w\left(-\frac{\varepsilon_\theta(x_t,t,c)}{\sqrt{1-\bar{\alpha}_t}}\right)$$

$$= -\frac{(1-w)\varepsilon_\theta(x_t,t,\varnothing) + w\, \varepsilon_\theta(x_t,t,c)}{\sqrt{1-\bar{\alpha}_t}}$$

So the guided noise prediction is:

$$\tilde{\varepsilon} = (1-w)\, \varepsilon_\theta(x_t,t,\varnothing) + w\, \varepsilon_\theta(x_t,t,c)$$

But wait --- this uses the convention where $w = 1$ means standard conditional and $w > 1$ amplifies guidance. The standard CFG formula uses $w$ as the **extra** guidance strength, so the convention is:

$$\tilde{\varepsilon} = \varepsilon_\theta(x_t,t,c) + w \bigl[\varepsilon_\theta(x_t,t,c) - \varepsilon_\theta(x_t,t,\varnothing)\bigr]$$

$$= (1+w)\, \varepsilon_\theta(x_t,t,c) - w\, \varepsilon_\theta(x_t,t,\varnothing)$$

This is the widely-used form. Setting $w = 0$ recovers standard conditional generation. Typical values are $w \in [1, 15]$.

**Remark on notation.** Some papers (including Ho & Salimans, 2022) use a different convention where the guidance scale is denoted $w_{\text{cfg}}$ and the formula is $\tilde{\varepsilon} = (1-w_{\text{cfg}}) \varepsilon_\theta(\varnothing) + w_{\text{cfg}} \varepsilon_\theta(c)$ with $w_{\text{cfg}} > 1$. In this convention, the correspondence is $w_{\text{cfg}} = 1 + w$. Always check the paper's convention.

#### 3.2.4 What Distribution Does CFG Sample From?

**Proposition 3.3.** CFG with guidance weight $w$ samples from:

$$\tilde{p}_w(x \mid c) \propto p(x \mid c) \cdot \left(\frac{p(x \mid c)}{p(x)}\right)^w = \frac{p(x \mid c)^{1+w}}{p(x)^w}$$

*Proof.* The guided score is:

$$\tilde{s}(x) = (1+w)\, \nabla_x \log p(x \mid c) - w\, \nabla_x \log p(x)$$

$$= \nabla_x \bigl[(1+w) \log p(x \mid c) - w \log p(x)\bigr]$$

$$= \nabla_x \log \frac{p(x \mid c)^{1+w}}{p(x)^w}$$

Therefore the guided distribution is $\tilde{p}_w(x \mid c) \propto p(x \mid c)^{1+w} / p(x)^w$. $\blacksquare$

**Interpretation:** CFG sharpens the conditional distribution. For $w > 0$:
- Modes of $p(x \mid c)$ are amplified.
- Regions where $p(x \mid c) \ll p(x)$ (common but not condition-matching samples) are suppressed.
- This explains the quality-diversity tradeoff: higher $w$ produces more prototypical (but less diverse) samples.

### 3.3 Guidance Scale Effects

**Quality vs. Diversity Tradeoff:**

| $w$ (CFG scale) | Behavior | FID | IS |
|-----------------|----------|-----|----|
| $w = 0$ | Standard conditional | Higher FID | Lower IS |
| $w = 1$--$3$ | Mild guidance | Moderate | Moderate |
| $w = 5$--$10$ | Strong guidance | Optimal FID | High IS |
| $w > 15$ | Over-saturation | Rising FID | Declining IS |

**Precision and Recall:** Dhariwal and Nichol (2021) measured:
- **Precision** (sample quality): monotonically increases with guidance scale up to saturation.
- **Recall** (mode coverage): monotonically decreases with guidance scale.
- The FID-optimal point balances precision and recall.

### 3.4 Conditional Generation Architectures

#### 3.4.1 Class-Conditional Models

For a discrete class label $y \in \{1, \ldots, K\}$:

1. **Embedding**: Map $y$ to a vector $e_y \in \mathbb{R}^d$ via a learned embedding table.
2. **Conditioning mechanisms**:
   - **Adaptive Group Normalization (AdaGN)**: Replace GroupNorm parameters with class-dependent affine transforms: $\text{AdaGN}(h, e) = e_s \odot \text{GN}(h) + e_b$ where $e_s, e_b$ are projected from the class embedding.
   - **Addition to time embedding**: Concatenate or add $e_y$ to the sinusoidal time embedding before the MLP.

#### 3.4.2 Text-Conditional Models

For text conditioning (as in Imagen, DALL-E 2, Stable Diffusion):

1. **Text encoder**: Use a pre-trained language model (CLIP, T5, etc.) to encode the text prompt into a sequence of embeddings $c = \{c_1, \ldots, c_L\} \in \mathbb{R}^{L \times d}$.
2. **Cross-attention**: Add cross-attention layers in the U-Net where the query is the image feature and the key/value are the text embeddings:
   $$\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{Q K^\top}{\sqrt{d}}\right) V$$
   where $Q = W_Q h$ (from image features), $K = W_K c$, $V = W_V c$ (from text embeddings).
3. **Pooled embedding**: A pooled text embedding (e.g., [CLS] token) can be added to the time embedding for global conditioning.

### 3.5 Latent Diffusion Models

#### 3.5.1 Motivation

Running diffusion in pixel space is expensive. For a $512 \times 512 \times 3$ image, the U-Net operates on tensors with $\sim$786K dimensions per sample. Most of this dimensionality is perceptually redundant --- neighboring pixels are highly correlated.

**Key idea (Rombach et al., 2022):** First compress images into a lower-dimensional latent space using a pre-trained autoencoder, then run the diffusion process in latent space.

#### 3.5.2 Architecture

The latent diffusion model (LDM) consists of two components:

**Component 1: Autoencoder.** A VQ-VAE or KL-regularized VAE with encoder $\mathcal{E}$ and decoder $\mathcal{D}$:
- $z = \mathcal{E}(x)$: encode image $x \in \mathbb{R}^{H \times W \times 3}$ to latent $z \in \mathbb{R}^{h \times w \times c}$, where typically $h = H/f$, $w = W/f$ for downsampling factor $f \in \{4, 8\}$ and $c \in \{3, 4, 8, 16\}$.
- $\hat{x} = \mathcal{D}(z)$: decode latent back to image.
- The autoencoder is trained with reconstruction loss + perceptual loss + adversarial loss + mild KL regularization.

**Component 2: Latent Diffusion Model.** A standard diffusion model (DDPM/DDIM/flow matching) operating on the latent space $z$ instead of pixel space $x$:
- Forward process: $q(z_t \mid z_0)$ adds noise to the latent.
- Reverse process: $p_\theta(z_{t-1} \mid z_t, c)$ denoises in latent space, with text/class conditioning via cross-attention.
- The U-Net operates on $h \times w \times c$ tensors, which is $f^2 \cdot (3/c)$ times cheaper per pixel than pixel-space diffusion.

#### 3.5.3 Efficiency Gains

For $f = 8$ (Stable Diffusion's default):

| Space | Resolution | Dimensions | Relative Cost |
|-------|-----------|------------|---------------|
| Pixel | $512 \times 512 \times 3$ | 786,432 | 1x |
| Latent | $64 \times 64 \times 4$ | 16,384 | ~0.02x |

This $\sim$50x reduction in dimensionality translates to:
- ~10x faster training.
- ~10x faster sampling.
- Ability to train on consumer GPUs.

#### 3.5.4 Stable Diffusion Architecture Summary

```
Text Prompt → CLIP Text Encoder → text embeddings c ∈ R^{77×768}
                                       ↓ (cross-attention)
z_T ~ N(0,I)  →  U-Net(z_t, t, c)  →  z_0  →  VAE Decoder  →  image x
     (64x64x4)    (latent diffusion)   (64x64x4)    D(z_0)     (512x512x3)
```

**Training pipeline:**
1. Pre-train the autoencoder on images (reconstruction + adversarial loss).
2. Freeze the autoencoder.
3. Encode the entire dataset: $z_0^{(i)} = \mathcal{E}(x^{(i)})$.
4. Train the U-Net diffusion model in latent space with text conditioning and CFG dropout.

---

## 4. Algorithmic Derivation

### 4.1 Classifier-Free Guided Sampling (DDPM)

```
Algorithm 1: CFG-DDPM Sampling
─────────────────────────────────────────
Input: conditional ε_θ, schedule {β_t}, condition c, guidance weight w

x_T ~ N(0, I)

for t = T, T-1, ..., 1:
    # Compute conditional and unconditional noise predictions
    ε_cond   = ε_θ(x_t, t, c)        # conditional prediction
    ε_uncond = ε_θ(x_t, t, ∅)        # unconditional prediction

    # Apply CFG
    ε̃ = (1+w) · ε_cond - w · ε_uncond

    # Standard DDPM step with guided noise
    z ~ N(0, I) if t > 1 else z = 0
    x_{t-1} = (1/√α_t)(x_t - (β_t/√(1-ᾱ_t)) · ε̃) + σ_t · z

return x_0
```

**Cost:** $2 \times T$ forward passes (conditional + unconditional). This can be batched: run both predictions as a batch of size $2B$.

### 4.2 Classifier-Free Guided Sampling (DDIM)

```
Algorithm 2: CFG-DDIM Sampling
─────────────────────────────────────────
Input: conditional ε_θ, schedule {ᾱ_t}, condition c, guidance weight w,
       subsequence τ, η=0

x_{τ_S} ~ N(0, I)

for i = S, ..., 1:
    t = τ_i,  s = τ_{i-1}

    # CFG noise prediction
    ε_cond   = ε_θ(x_t, t, c)
    ε_uncond = ε_θ(x_t, t, ∅)
    ε̃ = (1+w) · ε_cond - w · ε_uncond

    # DDIM step with guided noise
    x̂_0 = (x_t - √(1-ᾱ_t) · ε̃) / √ᾱ_t
    x̂_0 = clip(x̂_0, -1, 1)          # optional but helps stability
    x_s = √ᾱ_s · x̂_0 + √(1-ᾱ_s) · ε̃

return x_0
```

### 4.3 Latent Diffusion Sampling

```
Algorithm 3: Latent Diffusion + CFG Sampling
─────────────────────────────────────────
Input: ε_θ (latent U-Net), decoder D, text encoder E,
       prompt text, guidance weight w, S DDIM steps

# Encode text
c = E(text)                             # text embeddings

# Sample in latent space
z_T ~ N(0, I) ∈ R^{h×w×c_latent}
z_0 = DDIM_sample(ε_θ, z_T, c, w, S)   # Algorithm 2 in latent space

# Decode to pixel space
x = D(z_0)                              # decode to full resolution

return x
```

---

## 5. PyTorch Implementation

### 5.1 Conditional U-Net with CFG Support

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class SinusoidalPositionEmbedding(nn.Module):
    """Sinusoidal timestep embedding."""

    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim

    def forward(self, t: torch.Tensor) -> torch.Tensor:
        """
        Args:
            t: (B,) timesteps (integer or float)
        Returns:
            emb: (B, dim)
        """
        device = t.device
        half = self.dim // 2
        freqs = torch.exp(
            -math.log(10000) * torch.arange(half, device=device) / (half - 1)
        )                                               # (dim/2,)
        args = t[:, None].float() * freqs[None, :]     # (B, dim/2)
        return torch.cat([args.sin(), args.cos()], dim=-1)  # (B, dim)


class ConditionalResBlock(nn.Module):
    """Residual block with adaptive group normalization for class conditioning."""

    def __init__(self, in_ch: int, out_ch: int, cond_dim: int):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1)
        self.norm1 = nn.GroupNorm(8, out_ch)
        self.norm2 = nn.GroupNorm(8, out_ch)

        # Adaptive GroupNorm: condition modulates scale and shift
        self.adagn = nn.Sequential(
            nn.SiLU(),
            nn.Linear(cond_dim, out_ch * 2),  # scale and shift
        )
        self.skip = nn.Conv2d(in_ch, out_ch, 1) if in_ch != out_ch else nn.Identity()

    def forward(self, x: torch.Tensor, cond: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, in_ch, H, W) input features
            cond: (B, cond_dim) combined time + class/text embedding
        Returns:
            out: (B, out_ch, H, W)
        """
        h = self.norm1(self.conv1(x))                        # (B, out_ch, H, W)
        h = F.silu(h)

        # Adaptive modulation
        scale_shift = self.adagn(cond)                       # (B, 2*out_ch)
        scale, shift = scale_shift.chunk(2, dim=-1)          # (B, out_ch) each
        h = self.norm2(self.conv2(h))                        # (B, out_ch, H, W)
        h = h * (1 + scale[:, :, None, None]) + shift[:, :, None, None]
        h = F.silu(h)

        return h + self.skip(x)                               # (B, out_ch, H, W)


class ConditionalUNet(nn.Module):
    """U-Net with class conditioning and CFG support.

    For text conditioning, replace the class embedding with a cross-attention
    mechanism (shown in Section 5.3).
    """

    def __init__(
        self,
        in_channels: int = 3,
        num_classes: int = 10,
        time_dim: int = 256,
        cond_dim: int = 256,
    ):
        super().__init__()

        # Time embedding
        self.time_embed = nn.Sequential(
            SinusoidalPositionEmbedding(time_dim),
            nn.Linear(time_dim, cond_dim),
            nn.SiLU(),
            nn.Linear(cond_dim, cond_dim),
        )

        # Class embedding (+ 1 for null class ∅)
        self.class_embed = nn.Embedding(num_classes + 1, cond_dim)
        self.null_class_id = num_classes  # index for ∅

        # Encoder
        self.enc1 = ConditionalResBlock(in_channels, 64, cond_dim)
        self.enc2 = ConditionalResBlock(64, 128, cond_dim)
        self.enc3 = ConditionalResBlock(128, 256, cond_dim)

        self.down1 = nn.Conv2d(64, 64, 3, stride=2, padding=1)
        self.down2 = nn.Conv2d(128, 128, 3, stride=2, padding=1)

        # Bottleneck
        self.bottleneck = ConditionalResBlock(256, 256, cond_dim)

        # Decoder
        self.up2 = nn.ConvTranspose2d(256, 128, 2, stride=2)
        self.dec2 = ConditionalResBlock(256, 128, cond_dim)
        self.up1 = nn.ConvTranspose2d(128, 64, 2, stride=2)
        self.dec1 = ConditionalResBlock(128, 64, cond_dim)

        self.out_conv = nn.Conv2d(64, in_channels, 1)

    def forward(
        self,
        x: torch.Tensor,
        t: torch.Tensor,
        y: torch.Tensor = None,
    ) -> torch.Tensor:
        """
        Args:
            x: (B, C, H, W) noisy input
            t: (B,) timesteps
            y: (B,) class labels. None or self.null_class_id for unconditional.

        Returns:
            eps_pred: (B, C, H, W) predicted noise
        """
        # Compute conditioning vector
        t_emb = self.time_embed(t)                              # (B, cond_dim)

        if y is None:
            y = torch.full((x.shape[0],), self.null_class_id,
                          device=x.device, dtype=torch.long)
        c_emb = self.class_embed(y)                             # (B, cond_dim)

        cond = t_emb + c_emb                                    # (B, cond_dim)

        # Encoder
        h1 = self.enc1(x, cond)                                 # (B, 64, 32, 32)
        h2 = self.enc2(self.down1(h1), cond)                    # (B, 128, 16, 16)
        h3 = self.enc3(self.down2(h2), cond)                    # (B, 256, 8, 8)

        # Bottleneck
        h = self.bottleneck(h3, cond)                           # (B, 256, 8, 8)

        # Decoder
        h = self.up2(h)                                          # (B, 128, 16, 16)
        h = self.dec2(torch.cat([h, h2], dim=1), cond)          # (B, 128, 16, 16)
        h = self.up1(h)                                          # (B, 64, 32, 32)
        h = self.dec1(torch.cat([h, h1], dim=1), cond)          # (B, 64, 32, 32)

        return self.out_conv(h)                                  # (B, 3, 32, 32)
```

### 5.2 CFG Training and Sampling

```python
class DDPM_CFG(nn.Module):
    """DDPM with classifier-free guidance support."""

    def __init__(
        self,
        cond_unet: ConditionalUNet,
        T: int = 1000,
        schedule: str = "cosine",
        p_uncond: float = 0.1,
    ):
        """
        Args:
            cond_unet: conditional noise prediction network
            T: number of diffusion timesteps
            schedule: noise schedule type
            p_uncond: probability of dropping conditioning during training
        """
        super().__init__()
        self.eps_model = cond_unet
        self.T = T
        self.p_uncond = p_uncond
        self.null_class_id = cond_unet.null_class_id

        # Compute schedule (same as Lecture 08a)
        if schedule == "cosine":
            steps = torch.arange(T + 1, dtype=torch.float64)
            s = 0.008
            f = torch.cos(((steps / T) + s) / (1 + s) * (math.pi / 2)) ** 2
            alphas_cumprod = (f / f[0]).float()
            betas = (1 - alphas_cumprod[1:] / alphas_cumprod[:-1]).clip(0, 0.999)
            alphas_cumprod = alphas_cumprod[1:]  # (T,)
        else:
            betas = torch.linspace(1e-4, 0.02, T)
            alphas = 1.0 - betas
            alphas_cumprod = torch.cumprod(alphas, dim=0)

        self.register_buffer("betas", betas)
        self.register_buffer("alphas", 1.0 - betas)
        self.register_buffer("alphas_cumprod", alphas_cumprod)
        self.register_buffer("sqrt_alphas_cumprod", torch.sqrt(alphas_cumprod))
        self.register_buffer("sqrt_one_minus_alphas_cumprod", torch.sqrt(1.0 - alphas_cumprod))
        self.register_buffer("sqrt_recip_alphas", 1.0 / torch.sqrt(1.0 - betas))

        alphas_cumprod_prev = F.pad(alphas_cumprod[:-1], (1, 0), value=1.0)
        posterior_variance = betas * (1.0 - alphas_cumprod_prev) / (1.0 - alphas_cumprod)
        self.register_buffer("posterior_variance", posterior_variance)

    def compute_loss(self, x0: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
        """Training loss with random conditioning dropout.

        Args:
            x0: (B, C, H, W) clean images
            y: (B,) class labels

        Returns:
            loss: scalar
        """
        B = x0.shape[0]
        device = x0.device

        # Random conditioning dropout for CFG
        drop_mask = torch.rand(B, device=device) < self.p_uncond  # (B,)
        y_input = y.clone()
        y_input[drop_mask] = self.null_class_id                    # replace with ∅

        # Standard DDPM loss
        t = torch.randint(0, self.T, (B,), device=device)         # (B,)
        noise = torch.randn_like(x0)                               # (B, C, H, W)

        sqrt_ab = self.sqrt_alphas_cumprod[t][:, None, None, None]
        sqrt_omab = self.sqrt_one_minus_alphas_cumprod[t][:, None, None, None]
        xt = sqrt_ab * x0 + sqrt_omab * noise                     # (B, C, H, W)

        eps_pred = self.eps_model(xt, t, y_input)                  # (B, C, H, W)
        return F.mse_loss(eps_pred, noise)                         # scalar

    @torch.no_grad()
    def sample_ddim_cfg(
        self,
        y: torch.Tensor,
        shape: tuple,
        device: torch.device,
        w: float = 3.0,
        S: int = 50,
    ) -> torch.Tensor:
        """Sample with DDIM and classifier-free guidance.

        Args:
            y: (B,) class labels to condition on
            shape: (B, C, H, W) desired output shape
            device: torch device
            w: guidance weight (0 = no guidance)
            S: number of DDIM steps

        Returns:
            x: (B, C, H, W) generated samples
        """
        B = shape[0]
        x = torch.randn(shape, device=device)                     # (B, C, H, W)

        # Build subsequence
        step = self.T // S
        timesteps = list(reversed(range(0, self.T, step)))         # descending

        # Null labels for unconditional pass
        y_null = torch.full((B,), self.null_class_id, device=device, dtype=torch.long)

        for i in range(len(timesteps) - 1):
            t_cur = timesteps[i]
            t_next = timesteps[i + 1]

            t_batch = torch.full((B,), t_cur, device=device, dtype=torch.long)

            # Two forward passes (can be batched)
            eps_cond = self.eps_model(x, t_batch, y)               # (B, C, H, W)
            eps_uncond = self.eps_model(x, t_batch, y_null)        # (B, C, H, W)

            # CFG combination
            eps_guided = (1 + w) * eps_cond - w * eps_uncond       # (B, C, H, W)

            # DDIM update
            alpha_bar_t = self.alphas_cumprod[t_cur]
            alpha_bar_s = self.alphas_cumprod[t_next]

            x0_pred = (x - alpha_bar_t.sqrt() ** 0 * self.sqrt_one_minus_alphas_cumprod[t_cur] * eps_guided) / self.sqrt_alphas_cumprod[t_cur]
            # Simpler: use the formula directly
            x0_pred = (x - (1 - alpha_bar_t).sqrt() * eps_guided) / alpha_bar_t.sqrt()
            x0_pred = x0_pred.clamp(-1, 1)

            x = alpha_bar_s.sqrt() * x0_pred + (1 - alpha_bar_s).sqrt() * eps_guided

        return x  # (B, C, H, W)

    @torch.no_grad()
    def sample_ddpm_cfg(
        self,
        y: torch.Tensor,
        shape: tuple,
        device: torch.device,
        w: float = 3.0,
    ) -> torch.Tensor:
        """Sample with full DDPM reverse process and CFG.

        Args:
            y: (B,) class labels
            shape: (B, C, H, W)
            device: torch device
            w: guidance weight

        Returns:
            x: (B, C, H, W) generated samples
        """
        B = shape[0]
        x = torch.randn(shape, device=device)
        y_null = torch.full((B,), self.null_class_id, device=device, dtype=torch.long)

        for t in reversed(range(self.T)):
            t_batch = torch.full((B,), t, device=device, dtype=torch.long)

            eps_cond = self.eps_model(x, t_batch, y)
            eps_uncond = self.eps_model(x, t_batch, y_null)
            eps_guided = (1 + w) * eps_cond - w * eps_uncond

            coeff = self.betas[t] / self.sqrt_one_minus_alphas_cumprod[t]
            mean = self.sqrt_recip_alphas[t] * (x - coeff * eps_guided)

            if t > 0:
                noise = torch.randn_like(x)
                sigma = self.posterior_variance[t].sqrt()
                x = mean + sigma * noise
            else:
                x = mean

        return x
```

### 5.3 Cross-Attention for Text Conditioning

```python
class CrossAttention(nn.Module):
    """Cross-attention layer for text-conditional generation.

    Used in latent diffusion models (Stable Diffusion) to condition
    on text encoder outputs.
    """

    def __init__(self, query_dim: int, context_dim: int, heads: int = 8, dim_head: int = 64):
        """
        Args:
            query_dim: dimension of image features (query)
            context_dim: dimension of text embeddings (key/value)
            heads: number of attention heads
            dim_head: dimension per head
        """
        super().__init__()
        inner_dim = heads * dim_head
        self.heads = heads
        self.scale = dim_head ** -0.5

        self.to_q = nn.Linear(query_dim, inner_dim, bias=False)
        self.to_k = nn.Linear(context_dim, inner_dim, bias=False)
        self.to_v = nn.Linear(context_dim, inner_dim, bias=False)
        self.to_out = nn.Linear(inner_dim, query_dim)

    def forward(self, x: torch.Tensor, context: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, N, query_dim) image features (flattened spatial dims)
            context: (B, L, context_dim) text embeddings from text encoder

        Returns:
            out: (B, N, query_dim) attended image features
        """
        B, N, _ = x.shape
        H = self.heads

        q = self.to_q(x)                        # (B, N, inner_dim)
        k = self.to_k(context)                   # (B, L, inner_dim)
        v = self.to_v(context)                   # (B, L, inner_dim)

        # Reshape for multi-head attention
        q = q.view(B, N, H, -1).transpose(1, 2)  # (B, H, N, dim_head)
        k = k.view(B, -1, H, -1).transpose(1, 2) # (B, H, L, dim_head)
        v = v.view(B, -1, H, -1).transpose(1, 2) # (B, H, L, dim_head)

        # Attention
        attn = torch.matmul(q, k.transpose(-2, -1)) * self.scale  # (B, H, N, L)
        attn = attn.softmax(dim=-1)                                 # (B, H, N, L)
        out = torch.matmul(attn, v)                                 # (B, H, N, dim_head)

        # Reshape back
        out = out.transpose(1, 2).reshape(B, N, -1)                # (B, N, inner_dim)
        return self.to_out(out)                                     # (B, N, query_dim)
```

### 5.4 Training Loop with CFG

```python
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader


def train_cfg_ddpm(
    epochs: int = 100,
    batch_size: int = 128,
    lr: float = 2e-4,
    T: int = 1000,
    p_uncond: float = 0.1,
    device: str = "cuda",
):
    """Train class-conditional DDPM with CFG on CIFAR-10."""
    transform = transforms.Compose([
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5)),
    ])
    dataset = torchvision.datasets.CIFAR10(
        root="./data", train=True, download=True, transform=transform
    )
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=4)

    unet = ConditionalUNet(in_channels=3, num_classes=10, time_dim=256, cond_dim=256)
    model = DDPM_CFG(unet, T=T, schedule="cosine", p_uncond=p_uncond).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    for epoch in range(epochs):
        total_loss = 0.0
        for images, labels in loader:
            images = images.to(device)                        # (B, 3, 32, 32)
            labels = labels.to(device)                        # (B,)

            loss = model.compute_loss(images, labels)
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(loader)
        print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")

        # Generate class-conditional samples
        if (epoch + 1) % 10 == 0:
            # Generate 2 samples per class with guidance w=3
            class_labels = torch.arange(10, device=device).repeat(2)  # (20,)
            samples = model.sample_ddim_cfg(
                y=class_labels,
                shape=(20, 3, 32, 32),
                device=device,
                w=3.0,
                S=50,
            )
            samples = (samples.clamp(-1, 1) + 1) / 2
            grid = torchvision.utils.make_grid(samples, nrow=10)
            torchvision.utils.save_image(grid, f"cfg_samples_epoch_{epoch+1}.png")

    return model
```

---

## 6. Experimental Intuition

### 6.1 Effect of Guidance Scale

The guidance scale $w$ controls a fundamental tradeoff:

**Low $w$ (0--2):**
- Diverse samples spanning many modes.
- Individual samples may be less sharp or "typical."
- FID may be moderate.

**Optimal $w$ (3--7.5 for images):**
- Samples are sharp and class-consistent.
- FID is minimized at this range.
- Most real-world applications use this range (Stable Diffusion default: $w = 7.5$).

**High $w$ (>10):**
- Oversaturated, "deep-fried" samples.
- Loss of fine details and subtlety.
- FID increases again due to loss of diversity.

### 6.2 Unconditional Dropout Rate $p_{\text{uncond}}$

| $p_{\text{uncond}}$ | Effect |
|---------------------|--------|
| 0% | No CFG possible (never sees null conditioning) |
| 5% | Works, but unconditional model is weak |
| 10-20% | Standard choice; good balance |
| 50% | Unconditional model is strong; conditional model weakens |

### 6.3 Latent vs. Pixel Space Diffusion

| Aspect | Pixel Diffusion | Latent Diffusion |
|--------|----------------|------------------|
| Training compute | $\sim$1000 A100 days | $\sim$100 A100 days |
| Sampling speed | Slow | Fast |
| Sample quality | Slightly better at 256px | Comparable or better |
| Resolution scaling | Quadratic in resolution | Quadratic in latent resolution |
| Fine-grained detail | Direct control | Limited by decoder quality |

### 6.4 Text Conditioning: Architecture Matters

Saharia et al. (2022, Imagen) showed that the choice of text encoder matters more than the diffusion architecture:
- **CLIP text encoder** (used in Stable Diffusion): good for compositional understanding, trained on image-text pairs.
- **T5 text encoder** (used in Imagen): better at understanding complex text, trained on text-only data.
- **Frozen encoders** work better than fine-tuned ones, as fine-tuning can cause mode collapse in text understanding.

---

## 7. Connections

### 7.1 Connection to Classifier Guidance

CFG can be viewed as classifier guidance with an implicit classifier that is automatically learned during training. The implicit classifier $\nabla_{x_t} \log p(c \mid x_t) \propto \varepsilon(x_t,t,c) - \varepsilon(x_t,t,\varnothing)$ avoids the need for a separate model and the adversarial gradient issues.

### 7.2 Connection to Energy-Based Models

The guided distribution $\tilde{p}_w(x \mid c) \propto p(x \mid c)^{1+w} / p(x)^w$ can be interpreted as an energy-based model with energy $E(x) = -(1+w) \log p(x \mid c) + w \log p(x)$. The sampling process is Langevin dynamics in this energy landscape.

### 7.3 Connection to Retrieval-Augmented Generation

In text-to-image generation, the text encoder creates a representation that the diffusion model conditions on. This is analogous to RAG in language models: an external representation (text embedding) guides the generative process.

### 7.4 Connection to Prior Lectures

- **VAE latent space (Module 07)**: The autoencoder in latent diffusion is a VAE. The quality of the latent space directly impacts generation quality.
- **Attention mechanism (Module 04)**: Cross-attention for text conditioning uses the same mechanism as Transformer attention.

### 7.5 Forward Reference

- **Module 09/10**: Modern systems (DALL-E 3, Stable Diffusion XL, video models) build on all components from this module: latent diffusion + CFG + DDIM/flow matching sampling. Scaling laws and architectural innovations continue to drive progress.

---

## 8. Paper Reading List

### Required Reading

1. **Dhariwal, P. and Nichol, A.** (2021). "Diffusion Models Beat GANs on Image Synthesis." *NeurIPS 2021.*
   Focus: Sections 4-5 on classifier guidance. Study the precision/recall analysis and how guidance improves FID.

2. **Ho, J. and Salimans, T.** (2022). "Classifier-Free Diffusion Guidance." *NeurIPS 2021 Workshop on Deep Generative Models and Downstream Applications.*
   Focus: The full paper (it is short). Understand how conditioning dropout enables an implicit classifier.

3. **Rombach, R., Blattmann, A., Lorenz, D., Esser, P., and Ommer, B.** (2022). "High-Resolution Image Synthesis with Latent Diffusion Models." *CVPR 2022.*
   Focus: Sections 3-4 on the autoencoder design and the latent diffusion architecture. Understand the efficiency gains.

### Recommended Reading

4. **Saharia, C., Chan, W., Saxena, S., et al.** (2022). "Photorealistic Text-to-Image Diffusion Models with Deep Language Understanding." *NeurIPS 2022.* (Imagen)
   Focus: The role of the text encoder and the cascaded diffusion architecture.

5. **Peebles, W. and Xie, S.** (2023). "Scalable Diffusion Models with Transformers." *ICCV 2023.* (DiT)
   Focus: Replacing U-Net with a Transformer backbone. Introduces Adaptive Layer Norm (adaLN-Zero) for conditioning.

---

## 9. Exercises

### Exercise 9.1: CFG Derivations (Pen-and-Paper)

**(a)** Starting from Bayes' rule, derive the classifier guidance formula. Then derive the CFG formula by substituting the implicit classifier. Verify that the two approaches give the same guided score when the implicit classifier matches the explicit one.

**(b)** Prove that the guided distribution $\tilde{p}_w(x \mid c) \propto p(x \mid c)^{1+w} / p(x)^w$ is a valid (normalizable) distribution for any $w > 0$, assuming $p(x \mid c)$ and $p(x)$ have full support. (Hint: use Holder's inequality or direct integration.)

**(c)** Compute $D_{\text{KL}}(\tilde{p}_w \| p(\cdot \mid c))$ as a function of $w$. Show that it is zero at $w = 0$ and increases monotonically with $w$.

**(d)** For a Gaussian conditional $p(x \mid c) = \mathcal{N}(\mu_c, \sigma^2 I)$ and Gaussian marginal $p(x) = \mathcal{N}(0, \tau^2 I)$, compute $\tilde{p}_w(x \mid c)$ in closed form. What happens to the mean and variance as $w$ increases?

### Exercise 9.2: Latent Diffusion Analysis

**(a)** Suppose the autoencoder has downsampling factor $f = 8$ and latent channels $c = 4$. For a $512 \times 512$ input, compute: (i) the latent spatial resolution, (ii) the compression ratio (total latent dimensions / total pixel dimensions), (iii) the approximate speedup factor for the U-Net forward pass (assuming FLOPs scale as $O(h^2 w^2)$).

**(b)** The autoencoder introduces reconstruction error. If the autoencoder has PSNR $= 30$ dB on average, and the diffusion model generates perfect latents, what is the maximum achievable PSNR of the final generated images? What does this imply about the relative importance of autoencoder quality vs. diffusion quality?

### Exercise 9.3: Implementation

**(a)** Implement `DDPM_CFG` and `ConditionalUNet` as described. Train on CIFAR-10 for 50 epochs with $p_{\text{uncond}} = 0.1$. Generate class-conditional samples for each of the 10 classes with $w \in \{0, 1, 3, 5, 10, 20\}$ and visualize the quality-diversity tradeoff.

**(b)** Implement the cross-attention text conditioning module. Using a pre-trained CLIP text encoder (from the `transformers` library), build a text-conditional U-Net. Note: full training requires significant compute; this exercise is primarily about the architecture.

**(c)** Compute FID scores for your class-conditional model at various guidance scales. Plot FID vs. $w$ and identify the optimal guidance scale. Also compute precision and recall (using the `torch-fidelity` library) and plot them vs. $w$.

**(d)** Implement the "batched CFG" optimization: instead of two separate forward passes for conditional and unconditional predictions, concatenate them into a single batch of size $2B$. Measure the wall-clock speedup compared to two separate forward passes.
