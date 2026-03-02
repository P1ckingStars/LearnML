# Recitation 06: LoRA and QLoRA

## 1. Overview

This recitation covers **parameter-efficient fine-tuning (PEFT)** methods, focusing on LoRA (Low-Rank Adaptation) and QLoRA (Quantized LoRA). These techniques are essential for practical alignment work: they enable fine-tuning models with billions of parameters on consumer hardware by updating only a tiny fraction of the total parameters.

**Outline:**

1. LoRA: theory, derivation of parameter savings, and implementation from scratch.
2. Why LoRA works: the intrinsic dimensionality hypothesis.
3. QLoRA: combining quantization with LoRA.
4. Practical guide: rank selection, module targeting, alpha scaling.
5. Hands-on: fine-tuning with the PEFT library.

---

## 2. LoRA: Low-Rank Adaptation

### 2.1 Motivation

Full fine-tuning updates all $N$ parameters of a pretrained model. For a 7B parameter model in FP16, this requires:

- **Model weights:** $7 \times 10^9 \times 2$ bytes $= 14$ GB
- **Gradients:** $14$ GB
- **Optimizer states (AdamW):** $2 \times 14 = 28$ GB (first and second moments)
- **Total:** $\approx 56$ GB

This exceeds the memory of most single GPUs. LoRA reduces this dramatically by freezing the pretrained weights and only training low-rank additive updates.

### 2.2 Mathematical Formulation

Consider a pretrained weight matrix $W_0 \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$. During fine-tuning, the weight update $\Delta W$ also lies in $\mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$.

**Hypothesis (Aghajanyan et al., 2021; Hu et al., 2021):** The weight update $\Delta W$ has **low intrinsic rank**. That is, $\Delta W$ can be well approximated by a low-rank matrix.

LoRA parameterizes the update as:

$$W = W_0 + \frac{\alpha}{r} B A$$

where:
- $W_0 \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$ is the frozen pretrained weight.
- $B \in \mathbb{R}^{d_{\text{out}} \times r}$ is a trainable matrix.
- $A \in \mathbb{R}^{r \times d_{\text{in}}}$ is a trainable matrix.
- $r \ll \min(d_{\text{in}}, d_{\text{out}})$ is the rank.
- $\alpha$ is a scaling hyperparameter.
- The factor $\alpha / r$ controls the magnitude of the update.

The forward pass computes:

$$\mathbf{y} = W\mathbf{x} = W_0 \mathbf{x} + \frac{\alpha}{r} B A \mathbf{x}$$

### 2.3 Parameter Savings Derivation

**Proposition 2.1.** *The number of trainable parameters per LoRA-adapted linear layer is $r(d_{\text{in}} + d_{\text{out}})$, compared to $d_{\text{in}} \cdot d_{\text{out}}$ for full fine-tuning. The savings ratio is:*

$$\text{savings} = 1 - \frac{r(d_{\text{in}} + d_{\text{out}})}{d_{\text{in}} \cdot d_{\text{out}}}$$

*Proof.* Full fine-tuning updates all entries of $W_0$, requiring $d_{\text{in}} \cdot d_{\text{out}}$ parameters. LoRA introduces $A \in \mathbb{R}^{r \times d_{\text{in}}}$ ($r \cdot d_{\text{in}}$ parameters) and $B \in \mathbb{R}^{d_{\text{out}} \times r}$ ($d_{\text{out}} \cdot r$ parameters). Total: $r(d_{\text{in}} + d_{\text{out}})$. The fraction of original parameters is:

$$\frac{r(d_{\text{in}} + d_{\text{out}})}{d_{\text{in}} \cdot d_{\text{out}}} = \frac{r}{d_{\text{out}}} + \frac{r}{d_{\text{in}}}$$

$\blacksquare$

**Concrete example.** For a transformer with $d_{\text{model}} = 4096$ (like LLaMA-7B), a single attention projection has $d_{\text{in}} = d_{\text{out}} = 4096$.

| Rank $r$ | LoRA params per layer | Full params per layer | Ratio |
|-----------|----------------------|----------------------|-------|
| 1 | 8,192 | 16,777,216 | 0.049% |
| 4 | 32,768 | 16,777,216 | 0.195% |
| 8 | 65,536 | 16,777,216 | 0.391% |
| 16 | 131,072 | 16,777,216 | 0.781% |
| 64 | 524,288 | 16,777,216 | 3.125% |

With rank 8 applied to all attention projections ($Q, K, V, O$) across 32 layers:

$$\text{Total LoRA params} = 4 \times 32 \times 65{,}536 = 8{,}388{,}608 \approx 8.4\text{M}$$

compared to $\approx 7\text{B}$ total parameters --- about **0.12%** of the model.

### 2.4 Initialization

**Theorem 2.2 (Zero-init preserves pretrained behavior).** *If $B$ is initialized to zero, then at initialization $BA = 0$ and the LoRA-augmented layer computes the same function as the original layer: $W\mathbf{x} = W_0\mathbf{x}$.*

This is critical: fine-tuning starts from exactly the pretrained model's behavior, and the LoRA update smoothly deviates from it during training.

**Standard initialization:**
- $A$: Kaiming uniform (or Gaussian with std $1/\sqrt{d_{\text{in}}}$) for proper gradient flow.
- $B$: Zeros.

Some variants (e.g., PiSSA) initialize $A$ and $B$ from the SVD of $W_0$, but zero-init for $B$ is the standard LoRA approach.

### 2.5 Alpha Scaling

The scaling factor $\alpha / r$ ensures that the magnitude of the LoRA update is roughly independent of rank:

$$\Delta W = \frac{\alpha}{r} B A$$

**Why $\alpha / r$?** Consider the norm of $BA$ at initialization. With Kaiming-initialized $A$ and zero $B$, the initial update is zero. During training, the elements of $A$ and $B$ are $O(1/\sqrt{d})$. The product $BA$ has entries of magnitude $O(r / d)$ (sum of $r$ terms). Dividing by $r$ normalizes this to $O(1/d)$, independent of $r$.

The $\alpha$ parameter then controls the overall scale. **Practical guideline:** Set $\alpha = 2r$ as a starting point (so $\alpha/r = 2$). Common values: $\alpha = 16$ with $r = 8$, or $\alpha = 32$ with $r = 16$.

### 2.6 Merging LoRA Weights

After training, the LoRA weights can be **merged** into the base weights:

$$W_{\text{merged}} = W_0 + \frac{\alpha}{r} B A$$

This produces a standard model with no additional inference cost. The merged model has the same architecture and parameter count as the original.

**Proposition 2.3.** *Merging is exact: for any input $\mathbf{x}$, $W_{\text{merged}} \mathbf{x} = W_0 \mathbf{x} + (\alpha/r) BA\mathbf{x}$. There is no approximation error.*

---

## 3. Why LoRA Works: Intrinsic Dimensionality

### 3.1 The Intrinsic Dimensionality Hypothesis

**Theorem 3.1 (Aghajanyan et al., 2021, informal).** *For common NLP tasks, the weight update $\Delta W$ during fine-tuning lies approximately in a subspace of dimension $d_{\text{intrinsic}} \ll d_{\text{total}}$, where $d_{\text{total}}$ is the total number of parameters.*

Specifically, Aghajanyan et al. showed that one can reparameterize the fine-tuning as:

$$\theta = \theta_0 + P \mathbf{z}$$

where $\theta_0$ is the pretrained parameter vector, $P \in \mathbb{R}^{d_{\text{total}} \times d_{\text{intrinsic}}}$ is a random projection matrix, and $\mathbf{z} \in \mathbb{R}^{d_{\text{intrinsic}}}$ is the only trainable vector. For a 280M parameter model, $d_{\text{intrinsic}} \approx 200$ suffices for 90% of full fine-tuning performance on many tasks.

### 3.2 Connection to LoRA

LoRA is a structured version of this random subspace approach. Instead of a random projection $P$, LoRA imposes:

1. **Block structure:** Each weight matrix gets its own low-rank update.
2. **Low-rank factorization:** $\Delta W = BA$ rather than a random projection.
3. **Targeted modules:** Only specific layers (e.g., attention projections) receive LoRA adapters.

This structured approach is more parameter-efficient than random projections and easier to implement.

### 3.3 Spectral Analysis

Let $W_0$ be the pretrained weight and $W_{\text{FT}}$ be the fully fine-tuned weight. Define $\Delta W = W_{\text{FT}} - W_0$.

**Empirical finding (Hu et al., 2021):** The singular values of $\Delta W$ decay rapidly. For attention weights in GPT-3 175B fine-tuned on various tasks, $\sigma_1 / \sigma_{64} > 10$ and the first 4--8 singular values capture $> 50\%$ of the Frobenius norm of $\Delta W$.

**Corollary.** If $\Delta W = U \Sigma V^\top$ and $\sigma_{r+1} / \sigma_1 \ll 1$, then the rank-$r$ approximation $\Delta W_r = U_r \Sigma_r V_r^\top$ has small relative error:

$$\frac{\|\Delta W - \Delta W_r\|_F}{\|\Delta W\|_F} = \frac{\sqrt{\sum_{i>r} \sigma_i^2}}{\sqrt{\sum_{i} \sigma_i^2}} \ll 1$$

This justifies using LoRA with small $r$.

---

## 4. QLoRA: Quantization + LoRA

### 4.1 Motivation

Even with LoRA, the frozen base weights $W_0$ must be stored in memory. For a 70B model, this alone requires 140 GB in FP16. QLoRA (Dettmers et al., 2023) solves this by **quantizing** the base weights to 4 bits, reducing memory by $4\times$.

### 4.2 NormalFloat4 (NF4) Data Type

QLoRA introduces the **NF4** data type, designed specifically for quantizing normally distributed weights.

**Key insight:** Neural network weights are approximately normally distributed. A quantization scheme that places quantization levels at the quantiles of the normal distribution minimizes the expected quantization error.

**Definition 4.1 (NF4).** Given that $w \sim \mathcal{N}(0, \sigma^2)$, the NF4 data type uses 16 quantization levels ($2^4 = 16$) placed at the quantiles:

$$q_i = \Phi^{-1}\left(\frac{2i + 1}{32}\right) \quad \text{for } i = 0, 1, \ldots, 15$$

where $\Phi^{-1}$ is the inverse CDF of the standard normal.

This ensures that each quantization bin contains approximately $1/16$ of the probability mass, minimizing the expected squared quantization error.

**Quantization error bound.** For a normally distributed weight $w \sim \mathcal{N}(0, \sigma^2)$ quantized to the nearest NF4 level:

$$\mathbb{E}\left[(w - Q(w))^2\right] \le \frac{\sigma^2}{16 \cdot 12} \approx 0.005 \sigma^2$$

where $Q(w)$ is the quantized value. This is smaller than the error from uniform quantization with the same bit width.

### 4.3 Double Quantization

QLoRA also quantizes the **quantization constants** (the scale factors used in block-wise quantization). This is called **double quantization**:

1. **First quantization:** Quantize the weight matrix in blocks of 64 elements. Each block has a FP32 scale factor. This adds $32/64 = 0.5$ bits per weight.
2. **Double quantization:** Quantize these FP32 scale factors to FP8 (8-bit floating point). This reduces the overhead from 0.5 bits to $8/64 = 0.125$ bits per weight.

**Effective bits per weight:** $4 + 0.125 = 4.125$ bits (compared to 16 bits in FP16).

### 4.4 Paged Optimizers

QLoRA uses **paged optimizers** (via NVIDIA's unified memory) to handle memory spikes during gradient computation. When GPU memory is exhausted, optimizer states are automatically paged to CPU memory, allowing training of larger models than would otherwise fit.

### 4.5 QLoRA Training Pipeline

$$W_0 \in \text{NF4} \xrightarrow{\text{dequantize}} \hat{W}_0 \in \text{FP16/BF16} \xrightarrow{+ (\alpha/r) BA} W \in \text{FP16/BF16} \xrightarrow{\text{forward}} \mathbf{y}$$

During the forward pass:
1. Dequantize $W_0$ from NF4 to FP16 (on the fly, per-layer).
2. Compute $W_0 \mathbf{x} + (\alpha/r) BA\mathbf{x}$.
3. Gradients flow through $A$ and $B$ (in FP16/BF16), but **not** through $W_0$.

The base weights are never modified --- they remain in NF4 throughout training.

### 4.6 Memory Comparison

| Method | 7B Model | 13B Model | 70B Model |
|--------|----------|-----------|-----------|
| Full FT (FP16) | 56 GB | 104 GB | 560 GB |
| LoRA (FP16 base) | 15 GB | 28 GB | 145 GB |
| QLoRA (NF4 base) | 5.5 GB | 10 GB | 40 GB |

QLoRA makes it possible to fine-tune a 65B model on a single 48GB A6000 GPU, or a 7B model on a consumer RTX 3090 (24GB).

---

## 5. Practical Guide

### 5.1 Which Modules to Adapt

**Recommendation (Hu et al., 2021; empirical):**

| Modules | Performance | Cost |
|---------|-------------|------|
| $Q, V$ only | Good | Lowest |
| $Q, K, V, O$ | Better | 2x above |
| All attention + FFN | Best | Highest |
| All linear layers | Marginal gain over above | Highest |

The standard practice for alignment (SFT, DPO) is to apply LoRA to **all attention projections** ($Q, K, V, O$) and optionally the **gate/up/down projections** in the FFN.

### 5.2 Rank Selection

| Rank | Use case | Notes |
|------|----------|-------|
| 1--4 | Simple tasks (classification, NER) | Minimal parameters |
| 8--16 | Standard NLP tasks (summarization, QA) | Good default |
| 32--64 | Complex generation (instruction tuning, alignment) | Approaching full FT quality |
| 128+ | When LoRA underperforms full FT | Diminishing returns |

**Heuristic:** Start with rank 8. If validation performance is significantly worse than full fine-tuning, increase to 16 or 32. If it matches full FT, try decreasing to save memory.

### 5.3 Learning Rate

LoRA typically uses a **higher learning rate** than full fine-tuning because only a small fraction of parameters are updated:

| Method | Typical LR |
|--------|-----------|
| Full fine-tuning | 1e-5 to 5e-5 |
| LoRA (rank 8--16) | 1e-4 to 3e-4 |
| QLoRA | 1e-4 to 2e-4 |

The $\alpha/r$ scaling partially compensates, but LoRA parameters generally benefit from larger learning rates.

### 5.4 Common Pitfalls

1. **Forgetting to freeze base weights.** If $W_0$ is not frozen, LoRA provides no memory savings.
2. **Wrong alpha/rank ratio.** Too large $\alpha/r$ causes instability; too small underfits.
3. **Not targeting enough modules.** Applying LoRA only to $Q, V$ may be insufficient for alignment tasks.
4. **Rank too low for the task.** Alignment requires more capacity than simple classification.
5. **Merging before evaluation.** Always verify that the merged model matches the LoRA model's outputs before discarding the LoRA weights.

---

## 6. Implementation from Scratch

```python
"""
LoRA and QLoRA implementation from scratch.

Implements:
- LoRALinear: a linear layer with low-rank adaptation
- apply_lora: inject LoRA into an existing model
- merge_lora: merge LoRA weights into base weights
- Simulated QLoRA: NF4 quantization simulation

Requires: torch >= 2.0
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Optional, Set
import math
import copy


# ── LoRA Linear Layer ────────────────────────────────────────────────

class LoRALinear(nn.Module):
    """
    Linear layer augmented with LoRA.

    Computes: y = W_0 x + (alpha / r) * B @ A @ x

    The base weight W_0 is frozen. Only A and B are trainable.

    Args:
        base_layer:  original nn.Linear layer (will be frozen)
        rank:        LoRA rank r                              (int)
        alpha:       LoRA scaling factor                      (float)
        dropout:     dropout on LoRA path                     (float)
    """
    def __init__(
        self,
        base_layer: nn.Linear,
        rank: int = 8,
        alpha: float = 16.0,
        dropout: float = 0.0,
    ):
        super().__init__()

        self.base_layer = base_layer
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank

        in_features = base_layer.in_features    # d_in
        out_features = base_layer.out_features  # d_out

        # Freeze base layer
        for param in self.base_layer.parameters():
            param.requires_grad = False

        # LoRA matrices
        # A: (rank, in_features) — projects input to low-rank space
        self.lora_A = nn.Parameter(
            torch.empty(rank, in_features)               # (r, d_in)
        )
        # B: (out_features, rank) — projects from low-rank space to output
        self.lora_B = nn.Parameter(
            torch.empty(out_features, rank)               # (d_out, r)
        )

        # Initialization
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        nn.init.zeros_(self.lora_B)   # B = 0 → LoRA starts as identity

        # Optional dropout
        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (*, d_in) input tensor

        Returns:
            y: (*, d_out) output tensor
        """
        # Base forward pass (frozen)
        base_out = self.base_layer(x)                     # (*, d_out)

        # LoRA forward pass
        # x:          (*, d_in)
        # A @ x^T:    (r, *) → we compute x @ A^T for batched operation
        lora_out = self.dropout(x)
        lora_out = F.linear(lora_out, self.lora_A)        # (*, r)
        lora_out = F.linear(lora_out, self.lora_B)        # (*, d_out)
        lora_out = lora_out * self.scaling

        return base_out + lora_out                        # (*, d_out)

    @property
    def weight(self) -> torch.Tensor:
        """Return the effective weight (base + LoRA)."""
        return self.base_layer.weight + self.scaling * (
            self.lora_B @ self.lora_A
        )

    def merge(self) -> nn.Linear:
        """
        Merge LoRA weights into base layer and return a standard nn.Linear.

        Returns:
            merged: nn.Linear with W = W_0 + (α/r) B A
        """
        merged = nn.Linear(
            self.base_layer.in_features,
            self.base_layer.out_features,
            bias=self.base_layer.bias is not None,
        )
        # Merge weights
        merged.weight.data = (
            self.base_layer.weight.data +
            self.scaling * (self.lora_B.data @ self.lora_A.data)
        )                                                  # (d_out, d_in)
        if self.base_layer.bias is not None:
            merged.bias.data = self.base_layer.bias.data.clone()

        return merged


# ── Apply LoRA to a Model ────────────────────────────────────────────

def apply_lora(
    model: nn.Module,
    rank: int = 8,
    alpha: float = 16.0,
    target_modules: Optional[Set[str]] = None,
    dropout: float = 0.0,
) -> nn.Module:
    """
    Replace target nn.Linear layers with LoRALinear layers.

    Args:
        model:          the model to modify (modified in place)
        rank:           LoRA rank                              (int)
        alpha:          LoRA alpha                             (float)
        target_modules: set of module name substrings to target
                        e.g., {'q_proj', 'v_proj', 'k_proj', 'o_proj'}
                        If None, targets all nn.Linear layers.
        dropout:        LoRA dropout rate                      (float)

    Returns:
        model: the modified model (same object, modified in place)
    """
    if target_modules is None:
        target_modules = set()  # empty = match all

    replacements = {}

    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            # Check if this module should be targeted
            if target_modules and not any(t in name for t in target_modules):
                continue
            replacements[name] = LoRALinear(
                module, rank=rank, alpha=alpha, dropout=dropout
            )

    # Apply replacements
    for name, new_module in replacements.items():
        # Navigate to parent module
        parts = name.split('.')
        parent = model
        for part in parts[:-1]:
            parent = getattr(parent, part)
        setattr(parent, parts[-1], new_module)

    # Freeze all non-LoRA parameters
    for name, param in model.named_parameters():
        if 'lora_' not in name:
            param.requires_grad = False

    return model


def merge_lora(model: nn.Module) -> nn.Module:
    """
    Merge all LoRA layers back into standard nn.Linear layers.
    The resulting model has no LoRA components and identical behavior.

    Args:
        model: model with LoRALinear layers

    Returns:
        model: model with merged nn.Linear layers (modified in place)
    """
    replacements = {}
    for name, module in model.named_modules():
        if isinstance(module, LoRALinear):
            replacements[name] = module.merge()

    for name, new_module in replacements.items():
        parts = name.split('.')
        parent = model
        for part in parts[:-1]:
            parent = getattr(parent, part)
        setattr(parent, parts[-1], new_module)

    return model


def count_parameters(model: nn.Module) -> Dict[str, int]:
    """
    Count total and trainable parameters.

    Returns:
        dict with 'total', 'trainable', 'frozen', 'pct_trainable'
    """
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    frozen = total - trainable

    return {
        'total': total,
        'trainable': trainable,
        'frozen': frozen,
        'pct_trainable': 100 * trainable / total if total > 0 else 0,
    }


# ── Simulated NF4 Quantization (for QLoRA demonstration) ────────────

class NF4Tensor:
    """
    Simulated NF4 (NormalFloat4) quantized tensor.

    In practice, NF4 quantization is handled by bitsandbytes.
    This is a pedagogical implementation showing the key ideas.

    The NF4 data type uses 16 quantization levels placed at the
    quantiles of the standard normal distribution.
    """

    # NF4 quantization levels (precomputed)
    # These are Φ^{-1}((2i+1)/32) for i = 0..15, with special handling
    # for the zero point
    NF4_LEVELS = torch.tensor([
        -1.0, -0.6961928009986877, -0.5250730514526367,
        -0.39491748809814453, -0.28444138169288635,
        -0.18477343022823334, -0.09105003625154495, 0.0,
        0.07958029955625534, 0.16093020141124725,
        0.24611230194568634, 0.33791524171829224,
        0.44070982933044434, 0.5626170039176941,
        0.7229568362236023, 1.0,
    ])

    def __init__(self, tensor: torch.Tensor, block_size: int = 64):
        """
        Quantize a tensor to NF4.

        Args:
            tensor:     the FP32/FP16 tensor to quantize
            block_size: quantization block size               (int)
        """
        self.shape = tensor.shape
        self.block_size = block_size
        self.dtype = tensor.dtype
        self.device = tensor.device

        # Flatten
        flat = tensor.reshape(-1).float()                   # (N,)
        N = flat.shape[0]

        # Pad to multiple of block_size
        pad_size = (block_size - N % block_size) % block_size
        if pad_size > 0:
            flat = F.pad(flat, (0, pad_size))
        self.padded_size = flat.shape[0]

        # Reshape into blocks
        blocks = flat.reshape(-1, block_size)                # (num_blocks, block_size)
        num_blocks = blocks.shape[0]

        # Per-block absmax scaling
        self.absmax = blocks.abs().max(dim=1).values         # (num_blocks,)
        self.absmax = self.absmax.clamp(min=1e-12)

        # Normalize blocks to [-1, 1]
        normalized = blocks / self.absmax.unsqueeze(1)       # (num_blocks, block_size)

        # Quantize: find nearest NF4 level for each element
        levels = self.NF4_LEVELS.to(flat.device)             # (16,)
        # Distance from each element to each level
        dists = (normalized.unsqueeze(-1) - levels.unsqueeze(0).unsqueeze(0)).abs()
        # dists shape: (num_blocks, block_size, 16)
        self.codes = dists.argmin(dim=-1).to(torch.uint8)    # (num_blocks, block_size)

        self.num_elements = N

    def dequantize(self) -> torch.Tensor:
        """
        Dequantize NF4 tensor back to FP16/FP32.

        Returns:
            tensor: dequantized tensor with original shape
        """
        levels = self.NF4_LEVELS.to(self.device)             # (16,)

        # Look up quantized values
        values = levels[self.codes.long()]                    # (num_blocks, block_size)

        # Rescale by absmax
        values = values * self.absmax.unsqueeze(1)           # (num_blocks, block_size)

        # Flatten and truncate padding
        flat = values.reshape(-1)[:self.num_elements]        # (N,)

        return flat.reshape(self.shape).to(self.dtype)

    @property
    def bits_per_element(self) -> float:
        """Compute effective bits per element including scale overhead."""
        scale_bits = 32  # FP32 absmax per block
        data_bits = 4    # NF4 code per element
        overhead = scale_bits / self.block_size
        return data_bits + overhead


# ── QLoRA Linear Layer (simulated) ──────────────────────────────────

class QLoRALinear(nn.Module):
    """
    Simulated QLoRA linear layer.

    The base weight is stored in NF4, dequantized on-the-fly during forward.
    LoRA parameters are in FP16/BF16.

    In production, use bitsandbytes.nn.Linear4bit instead.

    Args:
        base_layer:  original nn.Linear (will be quantized)
        rank:        LoRA rank                               (int)
        alpha:       LoRA alpha                              (float)
        block_size:  NF4 quantization block size             (int)
    """
    def __init__(
        self,
        base_layer: nn.Linear,
        rank: int = 8,
        alpha: float = 16.0,
        block_size: int = 64,
    ):
        super().__init__()

        in_features = base_layer.in_features
        out_features = base_layer.out_features
        self.in_features = in_features
        self.out_features = out_features
        self.scaling = alpha / rank

        # Quantize base weight to NF4
        self.quantized_weight = NF4Tensor(
            base_layer.weight.data, block_size=block_size
        )

        # Store bias separately (not quantized)
        if base_layer.bias is not None:
            self.bias = nn.Parameter(base_layer.bias.data.clone(),
                                     requires_grad=False)
        else:
            self.bias = None

        # LoRA parameters (in FP16/BF16)
        self.lora_A = nn.Parameter(
            torch.empty(rank, in_features)                   # (r, d_in)
        )
        self.lora_B = nn.Parameter(
            torch.empty(out_features, rank)                  # (d_out, r)
        )
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        nn.init.zeros_(self.lora_B)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (*, d_in)

        Returns:
            y: (*, d_out)
        """
        # Dequantize base weight
        W0 = self.quantized_weight.dequantize()              # (d_out, d_in)

        # Base computation
        base_out = F.linear(x, W0, self.bias)                # (*, d_out)

        # LoRA computation
        lora_out = F.linear(x, self.lora_A)                  # (*, r)
        lora_out = F.linear(lora_out, self.lora_B)           # (*, d_out)
        lora_out = lora_out * self.scaling

        return base_out + lora_out                           # (*, d_out)


# ── Demo ─────────────────────────────────────────────────────────────

def demo_lora():
    """
    Demonstrate LoRA: apply to a model, train, merge, verify.
    """
    print("=== LoRA Demo ===\n")

    # Create a simple model
    class SimpleModel(nn.Module):
        def __init__(self, d_in=64, d_hidden=128, d_out=10):
            super().__init__()
            self.fc1 = nn.Linear(d_in, d_hidden)
            self.relu = nn.ReLU()
            self.fc2 = nn.Linear(d_hidden, d_out)

        def forward(self, x):
            return self.fc2(self.relu(self.fc1(x)))

    model = SimpleModel()
    print("Before LoRA:")
    stats = count_parameters(model)
    print(f"  Total params:     {stats['total']:,}")
    print(f"  Trainable params: {stats['trainable']:,}")

    # Apply LoRA
    apply_lora(model, rank=4, alpha=8.0)
    print("\nAfter LoRA (rank=4):")
    stats = count_parameters(model)
    print(f"  Total params:     {stats['total']:,}")
    print(f"  Trainable params: {stats['trainable']:,}")
    print(f"  % trainable:      {stats['pct_trainable']:.2f}%")

    # Verify initialization preserves behavior
    x = torch.randn(8, 64)                                    # (8, 64)
    y_lora = model(x)                                          # (8, 10)

    # Train for a few steps
    optimizer = torch.optim.Adam(
        [p for p in model.parameters() if p.requires_grad],
        lr=1e-3
    )
    target = torch.randn(8, 10)
    for step in range(10):
        pred = model(x)
        loss = F.mse_loss(pred, target)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        if step % 3 == 0:
            print(f"  Step {step}: loss = {loss.item():.4f}")

    # Merge and verify
    y_before_merge = model(x).detach()
    merge_lora(model)
    y_after_merge = model(x).detach()
    merge_error = (y_before_merge - y_after_merge).abs().max().item()
    print(f"\nMerge verification error: {merge_error:.2e}")
    print(f"After merge - Total params: {count_parameters(model)['total']:,}")

    return model


def demo_nf4():
    """
    Demonstrate NF4 quantization and measure error.
    """
    print("\n=== NF4 Quantization Demo ===\n")

    # Create a normally-distributed weight matrix
    W = torch.randn(256, 256)                                  # (256, 256)
    print(f"Original weight: shape={W.shape}, "
          f"dtype={W.dtype}, "
          f"size={W.numel() * 4 / 1024:.1f} KB (FP32)")

    # Quantize
    W_nf4 = NF4Tensor(W, block_size=64)
    print(f"NF4 quantized: {W_nf4.bits_per_element:.2f} bits/element, "
          f"size={W.numel() * W_nf4.bits_per_element / 8 / 1024:.1f} KB")

    # Dequantize and measure error
    W_deq = W_nf4.dequantize()
    error = (W - W_deq).norm() / W.norm()
    max_error = (W - W_deq).abs().max()
    print(f"Relative L2 error: {error:.4f}")
    print(f"Max absolute error: {max_error:.4f}")
    print(f"Compression ratio: {32 / W_nf4.bits_per_element:.1f}x")


if __name__ == '__main__':
    demo_lora()
    demo_nf4()
```

---

## 7. Hands-On: Fine-Tuning with PEFT Library

The following code demonstrates practical fine-tuning using the Hugging Face `peft` library. This is the production approach (as opposed to the from-scratch implementation above).

```python
"""
Practical LoRA fine-tuning with Hugging Face PEFT.

This script shows the standard workflow for fine-tuning an LLM
with LoRA for instruction tuning.

Requires: torch, transformers, peft, datasets, bitsandbytes (for QLoRA)
"""

# ── Standard LoRA Fine-Tuning ────────────────────────────────────────

def finetune_with_lora():
    """
    Fine-tune GPT-2 with LoRA on a small instruction dataset.
    """
    from transformers import (
        AutoTokenizer, AutoModelForCausalLM, TrainingArguments
    )
    from peft import LoraConfig, get_peft_model, TaskType

    # 1. Load base model
    model_name = "gpt2"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(model_name)

    # 2. Configure LoRA
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=8,                    # rank
        lora_alpha=16,          # alpha (scaling = alpha/r = 2)
        lora_dropout=0.05,
        target_modules=[        # which modules to adapt
            "c_attn",           # GPT-2's combined QKV projection
            "c_proj",           # output projection
        ],
        bias="none",            # don't adapt biases
    )

    # 3. Apply LoRA
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    # Example output:
    # trainable params: 294,912 || all params: 124,734,464 || trainable%: 0.24%

    # 4. Prepare data (simplified example)
    instructions = [
        "Explain what machine learning is in one sentence.",
        "What is the capital of France?",
        "Write a Python function to reverse a string.",
    ]
    responses = [
        "Machine learning is a subset of AI where computers learn patterns "
        "from data to make predictions without explicit programming.",
        "The capital of France is Paris.",
        "def reverse_string(s): return s[::-1]",
    ]

    # Tokenize
    def tokenize(inst, resp):
        text = f"### Instruction:\n{inst}\n\n### Response:\n{resp}"
        return tokenizer(text, truncation=True, max_length=256,
                         padding="max_length", return_tensors="pt")

    # 5. Training loop (simplified)
    from torch.optim import AdamW

    optimizer = AdamW(
        [p for p in model.parameters() if p.requires_grad],
        lr=2e-4,
        weight_decay=0.01,
    )

    model.train()
    for epoch in range(3):
        total_loss = 0
        for inst, resp in zip(instructions, responses):
            encoding = tokenize(inst, resp)
            input_ids = encoding["input_ids"]             # (1, L)
            attention_mask = encoding["attention_mask"]    # (1, L)

            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=input_ids,                         # LM loss
            )
            loss = outputs.loss

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        print(f"Epoch {epoch+1}: avg loss = {total_loss/len(instructions):.4f}")

    # 6. Save LoRA adapter (only the small LoRA weights)
    # model.save_pretrained("./lora_adapter")
    # This saves ~1.2 MB instead of ~500 MB for the full model

    # 7. Merge and save full model (optional)
    # merged_model = model.merge_and_unload()
    # merged_model.save_pretrained("./merged_model")

    return model


# ── QLoRA Fine-Tuning ────────────────────────────────────────────────

def finetune_with_qlora():
    """
    Fine-tune with QLoRA (4-bit quantized base + LoRA).

    NOTE: Requires bitsandbytes library and a CUDA GPU.
    """
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from transformers import BitsAndBytesConfig
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

    model_name = "meta-llama/Llama-2-7b-hf"  # example; requires access

    # 1. Quantization config (NF4)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",           # NormalFloat4
        bnb_4bit_compute_dtype="bfloat16",    # compute in BF16
        bnb_4bit_use_double_quant=True,       # double quantization
    )

    # 2. Load quantized model
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
    )

    # 3. Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)

    # 4. Apply LoRA
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    # Example: trainable params: ~18M || all params: ~7B || trainable%: 0.26%

    # 5. Training proceeds as above (using Trainer or custom loop)
    # Memory usage: ~5.5 GB for 7B model (vs ~56 GB for full FT)

    print("QLoRA model ready for training.")
    print(f"GPU memory: ~5.5 GB (vs ~56 GB for full fine-tuning)")

    return model


# ── Verification ─────────────────────────────────────────────────────

if __name__ == '__main__':
    print("=== LoRA Fine-Tuning with PEFT ===\n")
    model = finetune_with_lora()

    # QLoRA requires GPU + bitsandbytes; uncomment to run:
    # print("\n=== QLoRA Fine-Tuning ===\n")
    # model = finetune_with_qlora()
```

---

## 8. Exercises

**Exercise R6.1.** (LoRA math) For a transformer with $d_{\text{model}} = 2048$, 24 layers, and LoRA applied to $Q, K, V, O$ projections with rank 16:

(a) Compute the total number of LoRA parameters.

(b) Compute the total number of model parameters (assuming 4-head attention with $d_k = d_{\text{model}} / 4$ and FFN dimension $4 \times d_{\text{model}}$).

(c) What fraction of parameters are trainable?

(d) If each LoRA parameter takes 2 bytes (FP16) and each base parameter takes 0.5 bytes (NF4), what is the total memory for QLoRA vs. full FT?

**Exercise R6.2.** (Rank ablation) Using the from-scratch LoRA implementation:

(a) Apply LoRA with ranks $r \in \{1, 2, 4, 8, 16, 32, 64\}$ to GPT-2 and fine-tune on the same dataset.

(b) Plot final validation loss vs. rank. At what rank does performance saturate?

(c) Plot trainable parameters vs. rank. What is the Pareto-optimal rank?

**Exercise R6.3.** (NF4 analysis) Using the NF4 implementation:

(a) Compare NF4 quantization error to uniform 4-bit quantization on normally distributed weights. Plot the histogram of quantization errors for both.

(b) What happens if the weights are not normally distributed (e.g., uniform or Laplace)? Measure the quantization error.

(c) Implement block-wise quantization with block sizes $\{32, 64, 128, 256\}$. How does block size affect the quantization error and the bits-per-element overhead?

**Exercise R6.4.** (LoRA for alignment) Fine-tune a small model (GPT-2 or Phi-2) with:

(a) LoRA-SFT on the Alpaca dataset (2000 examples).

(b) LoRA-DPO on the UltraFeedback dataset (using the SFT model as reference).

(c) Compare the two models on a set of test prompts. Does DPO improve over SFT for this model and data combination?

**Exercise R6.5.** (LoRA vs. full fine-tuning) Compare LoRA (rank 16) vs. full fine-tuning on a classification task (e.g., SST-2 sentiment analysis) and a generation task (e.g., summarization):

(a) For each task, report accuracy/quality and training time.

(b) For the generation task, compute the singular values of $W_{\text{FT}} - W_0$ for each adapted layer. How many singular values capture 90% of the Frobenius norm?

(c) Does this match the rank used in LoRA? What does this tell us about the intrinsic dimensionality of the task?

---

## 9. References

1. **Hu, E. J., Shen, Y., Wallis, P., et al.** (2021). "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR 2022*.

2. **Dettmers, T., Pagnoni, A., Holtzman, A., & Zettlemoyer, L.** (2023). "QLoRA: Efficient Finetuning of Quantized Language Models." *NeurIPS 2023*.

3. **Aghajanyan, A., Gupta, S., & Zettlemoyer, L.** (2021). "Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning." *ACL 2021*.

4. **Meng, R., Chen, L., & Chen, D.** (2024). "PiSSA: Principal Singular Values and Singular Vectors Adaptation of Large Language Models." *arXiv:2404.02948*.

---

*This recitation accompanies Module 06 (Alignment & Post-Training). See Lectures 06a--06d for the alignment methods that use LoRA in practice.*
