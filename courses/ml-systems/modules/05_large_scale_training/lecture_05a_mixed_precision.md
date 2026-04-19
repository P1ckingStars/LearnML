# Lecture 05a: Mixed Precision Training: FP16, BF16, FP8 & Loss Scaling

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Describe** the IEEE 754 floating-point formats (FP32, FP16, BF16, FP8 variants) in terms of exponent bits, mantissa bits, representable range, and precision.
2. **Analyze** the throughput and memory advantages of reduced-precision arithmetic on modern GPU hardware (Tensor Cores, Transformer Engine).
3. **Derive** why naive FP16 training diverges and how loss scaling restores gradient fidelity, distinguishing static from dynamic loss scaling strategies.
4. **Evaluate** the tradeoffs between FP16, BF16, and FP8 training regimes for different model architectures and scales.
5. **Diagnose** numerical failure modes (underflow, overflow, loss-of-precision) in mixed-precision training and apply targeted mitigations.

---

## 2. Motivation and Context

### 2.1 The Arithmetic Intensity Wall

Training large models is bottlenecked by two resources: **memory bandwidth** and **compute throughput**. A single NVIDIA H100 SXM delivers 989 TFLOPS in FP16 Tensor Core operations but only 67 TFLOPS in FP32 — a factor of ~15x. Similarly, halving the data type width from 32 bits to 16 bits doubles the effective memory bandwidth and halves the memory footprint for activations, gradients, and optimizer communication.

The push toward reduced precision is not merely an optimization — it is an economic necessity. Training GPT-4-scale models in FP32 would require roughly 2x the GPU-hours and 2x the memory, translating to millions of additional dollars per training run.

### 2.2 Historical Arc

- **2017**: Micikevicius et al. (NVIDIA) publish the mixed-precision training recipe with loss scaling, demonstrating parity with FP32 on ImageNet, machine translation, and speech recognition.
- **2018**: NVIDIA Volta (V100) introduces Tensor Cores with native FP16 accumulate-to-FP32 support.
- **2020**: Google TPU v3 popularizes BF16, which becomes the default for large language model training.
- **2022**: NVIDIA Hopper (H100) introduces FP8 Tensor Cores with the Transformer Engine.
- **2024**: FP8 training is validated at scale for models exceeding 100B parameters (DeepSeek-V2, Llama 3).

### 2.3 Prerequisites

This lecture assumes familiarity with:
- IEEE 754 binary representation (sign, exponent, mantissa)
- GPU memory hierarchy and Tensor Core execution model (Module 00)
- Gradient computation via backpropagation (Module 01)

---

## 3. IEEE 754 Floating-Point Formats

### 3.1 General Structure

An IEEE 754 binary floating-point number is encoded as:

$$(-1)^s \times 2^{e - \text{bias}} \times (1 + m)$$

where $s$ is the sign bit, $e$ is the stored (biased) exponent, and $m$ is the mantissa (fractional part with an implicit leading 1 for normal numbers). The **bias** is $2^{k-1} - 1$ for $k$ exponent bits.

### 3.2 Format Comparison

| Format | Sign | Exponent | Mantissa | Bias | Range ($\approx$) | Precision (decimal digits) |
|--------|------|----------|----------|------|-------|-----------|
| FP32   | 1    | 8        | 23       | 127  | $\pm 3.4 \times 10^{38}$ | ~7.2 |
| FP16   | 1    | 5        | 10       | 15   | $\pm 6.55 \times 10^{4}$ | ~3.3 |
| BF16   | 1    | 8        | 7        | 127  | $\pm 3.4 \times 10^{38}$ | ~2.4 |
| FP8 E4M3 | 1 | 4        | 3        | 7    | $\pm 448$ | ~1.2 |
| FP8 E5M2 | 1 | 5        | 2        | 15   | $\pm 57344$ | ~0.9 |

### 3.3 FP16: High Precision, Narrow Range

FP16 offers 10 mantissa bits, yielding relative precision of $2^{-10} \approx 10^{-3}$, sufficient for representing weights and activations. However, its 5-bit exponent limits the representable range to roughly $[6 \times 10^{-8}, 6.55 \times 10^{4}]$ for positive normals.

The critical problem for training: **gradients are often much smaller than $10^{-8}$**. A gradient of $10^{-10}$ underflows to zero in FP16, causing the parameter to stop updating entirely.

**Smallest positive normal (FP16):**

$$2^{1-15} = 2^{-14} \approx 6.10 \times 10^{-5}$$

**Smallest positive subnormal (FP16):**

$$2^{-14} \times 2^{-10} = 2^{-24} \approx 5.96 \times 10^{-8}$$

### 3.4 BF16: Trading Precision for Range

BF16 (Brain Float 16) was designed by Google specifically for deep learning. It takes the 8-bit exponent of FP32 — giving the same dynamic range ($10^{-38}$ to $10^{38}$) — while keeping only 7 mantissa bits.

The key insight: in deep learning training, **range matters more than precision**. The loss landscape is robust to small quantization errors (which act as a form of regularization), but it is catastrophically sensitive to values being flushed to zero.

**Conversion from FP32 to BF16:** Simply truncate the lower 16 bits of the FP32 representation. This means BF16 is trivially created by taking the upper 16 bits of any FP32 value:

```python
import torch

x_fp32 = torch.tensor(3.141592653589793, dtype=torch.float32)
x_bf16 = x_fp32.to(torch.bfloat16)
print(f"FP32: {x_fp32.item():.10f}")   # 3.1415927410
print(f"BF16: {x_bf16.item():.10f}")   # 3.1406250000
# Relative error: ~0.03%, well within training tolerance
```

### 3.5 FP8: The Frontier

FP8 comes in two variants defined by the OFP8 (Open FP8) specification:

**E4M3** (4 exponent, 3 mantissa): Higher precision (~1.2 decimal digits), smaller range ($[-448, 448]$). Used for **forward pass** activations and weights where values are typically in a moderate range.

**E5M2** (5 exponent, 2 mantissa): Lower precision (~0.9 decimal digits), larger range ($[-57344, 57344]$). Used for **backward pass** gradients where the dynamic range is larger and less predictable.

This asymmetric assignment is a core design principle of the NVIDIA Transformer Engine.

---

## 4. Mixed-Precision Training Architecture

### 4.1 The Three-Copy Recipe

The standard mixed-precision training recipe from Micikevicius et al. (2018) maintains three copies of the model:

1. **FP32 master weights** ($\theta_{32}$): The authoritative copy of parameters, stored in FP32.
2. **FP16/BF16 working weights** ($\theta_{16}$): A reduced-precision copy used for forward and backward passes.
3. **FP32 optimizer states**: Adam's $m$ and $v$ accumulators remain in FP32.

```
                 ┌──────────────────────────────────────────┐
                 │           Training Loop                  │
                 │                                          │
                 │  1. Cast: θ_32 → θ_16                    │
                 │  2. Forward:  loss = f(x; θ_16)          │
                 │  3. Scale:    loss_scaled = loss * S      │
                 │  4. Backward: g_16 = ∇ loss_scaled       │
                 │  5. Unscale:  g_32 = g_16 / S            │
                 │  6. Update:   θ_32 = optimizer(θ_32, g_32)│
                 │  7. Repeat from step 1                   │
                 └──────────────────────────────────────────┘
```

### 4.2 Memory Analysis

For a model with $P$ parameters using Adam:

| Component | FP32 baseline | Mixed precision (FP16 compute) |
|-----------|--------------|-------------------------------|
| Weights | $4P$ bytes | $4P$ (master) + $2P$ (working) = $6P$ bytes |
| Gradients | $4P$ bytes | $2P$ bytes |
| Adam $m$ | $4P$ bytes | $4P$ bytes |
| Adam $v$ | $4P$ bytes | $4P$ bytes |
| **Total** | **$16P$ bytes** | **$16P$ bytes** |
| Activations | $A_{32}$ | $A_{16} \approx A_{32}/2$ |

The parameter memory is roughly the same (the extra FP16 copy offsets savings in gradients), but the **activation memory** is halved, which is the dominant term for large-batch or long-sequence training. Additionally, compute throughput doubles on Tensor Cores.

### 4.3 Tensor Core Execution

NVIDIA Tensor Cores perform matrix multiply-accumulate (MMA) operations:

$$D = A \times B + C$$

where $A$ and $B$ are in reduced precision (FP16/BF16/FP8) and the accumulation $C, D$ is in FP32. This fused operation is critical: the intermediate products $A \times B$ produce values outside the FP16 range, but accumulating in FP32 preserves numerical fidelity.

On the H100:
- FP16 Tensor Cores: 1,979 TFLOPS
- BF16 Tensor Cores: 1,979 TFLOPS
- TF32 Tensor Cores: 989 TFLOPS
- FP8 Tensor Cores: 3,958 TFLOPS
- FP32 (non-TC): 67 TFLOPS

The 15x gap between FP16 TC and FP32 non-TC is why mixed-precision training is not optional at scale — it is essential.

---

## 5. Loss Scaling

### 5.1 The Gradient Underflow Problem

Consider a transformer with 96 layers. During backpropagation, the gradient at layer 1 is the product of ~96 local Jacobians times the loss gradient. Even with well-conditioned layers, individual gradient values at early layers often fall in the range $[10^{-8}, 10^{-5}]$.

The FP16 smallest positive subnormal is $\approx 6 \times 10^{-8}$. Any gradient value below this threshold is flushed to zero. In a histogram of gradient values for a typical large model, 5-20% of gradient values may fall below this threshold, causing those parameters to receive zero updates.

### 5.2 The Loss Scaling Trick

The key observation: if we multiply the loss by a constant $S$ before backpropagation, all gradients are also multiplied by $S$ (by linearity of differentiation):

$$\nabla_\theta (S \cdot \mathcal{L}) = S \cdot \nabla_\theta \mathcal{L}$$

This shifts the entire gradient histogram upward by $\log_2(S)$ positions, moving small gradients out of the underflow zone. After the backward pass, we divide by $S$ to recover the true gradients before the optimizer step.

**Choosing $S$:** We want $S$ large enough to prevent underflow but small enough to prevent overflow. Since FP16 max is ~65504, and typical loss values are $O(1)$, we have room for $S$ up to $\sim 10^4$.

### 5.3 Static Loss Scaling

The simplest approach: pick a constant $S$ and never change it.

```python
loss_scale = 1024.0  # 2^10, a common choice

for batch in dataloader:
    optimizer.zero_grad()

    # Forward in FP16
    with torch.autocast(device_type='cuda', dtype=torch.float16):
        output = model(batch)
        loss = criterion(output, targets)

    # Scale and backward
    scaled_loss = loss * loss_scale
    scaled_loss.backward()

    # Unscale gradients and step
    for param in model.parameters():
        if param.grad is not None:
            param.grad.data /= loss_scale
    optimizer.step()
```

**Limitation:** A fixed scale cannot adapt to changing gradient distributions during training. Too small and gradients still underflow; too large and gradients overflow to `inf` or `nan`.

### 5.4 Dynamic Loss Scaling

Dynamic loss scaling adjusts $S$ during training based on observed overflow:

```
Algorithm: DynamicLossScaling
──────────────────────────────────────────────────
Initialize: S = S_init (e.g., 2^16), patience = 0
For each training step:
  1. Compute scaled_loss = S * loss
  2. Backward pass → gradients g in FP16
  3. Check: are any gradients inf or nan?
     - If YES:
         S = S / 2          (halve the scale)
         patience = 0
         Skip optimizer step (discard this batch)
     - If NO:
         patience += 1
         Unscale: g = g / S
         Optimizer step with g
         If patience >= grow_interval (e.g., 2000):
             S = S * 2      (double the scale)
             patience = 0
```

This algorithm converges to the largest stable scale factor, maximizing gradient fidelity. The key insight: overflow is cheap to detect (check for `inf`/`nan`) and the recovery (halving $S$, skipping one step) has negligible impact on convergence.

### 5.5 PyTorch GradScaler

PyTorch provides `torch.amp.GradScaler` implementing dynamic loss scaling:

```python
import torch
from torch.amp import autocast, GradScaler

model = MyModel().cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
scaler = GradScaler()

for batch, targets in dataloader:
    optimizer.zero_grad()

    # Autocast: operations run in FP16 where safe, FP32 where needed
    with autocast(device_type='cuda', dtype=torch.float16):
        output = model(batch)
        loss = criterion(output, targets)

    # Scaled backward pass
    scaler.scale(loss).backward()

    # Unscale, clip, step
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)  # skips step if inf/nan detected
    scaler.update()         # adjust scale factor
```

**Critical detail:** `scaler.unscale_(optimizer)` must be called before gradient clipping. Otherwise, the clipping threshold would need to account for the unknown scale factor.

---

## 6. BF16 Training: The Modern Default

### 6.1 Why BF16 Simplifies Everything

BF16 shares the 8-bit exponent of FP32, so its representable range is identical: $\pm 3.4 \times 10^{38}$. This eliminates the gradient underflow problem entirely — **loss scaling is not required for BF16 training**.

The training recipe simplifies to:

```python
model = MyModel().cuda()
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

for batch, targets in dataloader:
    optimizer.zero_grad()

    with autocast(device_type='cuda', dtype=torch.bfloat16):
        output = model(batch)
        loss = criterion(output, targets)

    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    optimizer.step()
```

No `GradScaler`, no unscaling, no skipped steps. This is why virtually all large-scale LLM training (GPT-4, Llama, Gemini, Claude) uses BF16 as the compute dtype.

### 6.2 The Precision Cost

BF16 has only 7 mantissa bits vs. FP16's 10, giving relative precision of $2^{-7} \approx 0.78\%$ vs. $2^{-10} \approx 0.098\%$. Does this matter?

**For weights and activations:** No. Neural network weights are typically in $[-1, 1]$, and the loss landscape is smooth enough that 0.78% quantization noise acts as mild regularization.

**For accumulations:** Yes, potentially. When summing $N$ terms in BF16, the rounding error grows as $O(N \cdot 2^{-7})$. For a dot product of two vectors of length $d = 12288$ (GPT-3 hidden dimension), the probabilistic upper bound under a stochastic rounding model is:

$$\text{Relative error} \approx \sqrt{d} \cdot 2^{-7} \approx 110 \cdot 0.0078 \approx 0.86$$

Note that $\sqrt{d} \cdot 2^{-7}$ is a probabilistic upper bound derived from a stochastic rounding model (where individual rounding errors are treated as independent random variables), not the exact worst-case relative error of a BF16 dot product. Nonetheless, it demonstrates that the error is catastrophically large. The solution: **accumulate in FP32**, which is exactly what Tensor Cores do. The BF16 inputs are multiplied, and partial products are accumulated in an FP32 register.

### 6.3 Operations That Must Remain in FP32

Certain operations are numerically sensitive and should not be performed in reduced precision:

1. **Softmax:** The exponential $e^x$ amplifies relative error. For large logits, $e^{x + \delta} / e^x = e^\delta$, and BF16 errors can shift probabilities significantly. Compute softmax in FP32.

2. **Layer normalization / RMS normalization:** Computing variance requires subtraction of nearly equal numbers (catastrophic cancellation). Compute the reduction statistics in FP32.

3. **Loss computation:** Cross-entropy loss involves $\log(p)$ where $p$ can be very small. FP32 is essential for numerical stability.

4. **Adam moment updates:** The running averages $m_t = \beta_1 m_{t-1} + (1-\beta_1) g_t$ with $\beta_1 = 0.9$ or $0.99$ require precise accumulation over thousands of steps.

PyTorch's `autocast` handles these automatically by maintaining an allowlist (run in reduced precision: linear, matmul, conv) and a denylist (run in FP32: softmax, layernorm, loss functions).

---

## 7. FP8 Training

### 7.1 The FP8 Landscape

FP8 halves the memory and doubles the throughput relative to FP16/BF16 on Hopper-class hardware. However, with only 3-4 bits of mantissa, the quantization noise is substantial — FP8 training requires careful per-tensor scaling to be numerically viable.

### 7.2 E4M3 vs. E5M2 Assignment

The Transformer Engine uses an asymmetric precision strategy:

| Operation | Format | Rationale |
|-----------|--------|-----------|
| Forward weights | E4M3 | Weights are stationary, benefit from precision |
| Forward activations | E4M3 | Activations have bounded range after normalization |
| Backward gradients (dY) | E5M2 | Gradient magnitudes span a wider range |
| Weight gradients (dW) | Accumulated in FP32 | Final gradient needs full precision for optimizer |

### 7.3 Per-Tensor Scaling (Delayed Scaling)

FP8's limited range means that a single global scale factor is insufficient. Instead, each tensor gets its own scale factor $s$ such that the FP8 representation is:

$$x_{\text{fp8}} = \text{quantize}\left(\frac{x}{s}\right), \quad x \approx s \cdot x_{\text{fp8}}$$

The scale $s$ is chosen to map the tensor's maximum absolute value to the FP8 maximum representable value:

$$s = \frac{\max |x|}{\text{fp8\_max}}$$

**Delayed scaling** (used in practice): The scale factor for step $t$ is computed from the **amax** (absolute maximum) history of previous steps, not the current step. This avoids a synchronization point (computing the current max requires a full tensor reduction before quantization).

```python
# Simplified delayed scaling logic (Transformer Engine)
class DelayedScaling:
    def __init__(self, fp8_max: float, history_len: int = 16):
        self.fp8_max = fp8_max
        self.amax_history = []
        self.history_len = history_len

    def compute_scale(self) -> float:
        if not self.amax_history:
            return 1.0
        # Use the max of recent amax values
        recent_amax = max(self.amax_history[-self.history_len:])
        # Add margin to avoid overflow
        scale = self.fp8_max / (recent_amax * 1.1)
        return scale

    def update_amax(self, tensor: torch.Tensor):
        self.amax_history.append(tensor.abs().max().item())
        # Trim history
        if len(self.amax_history) > 2 * self.history_len:
            self.amax_history = self.amax_history[-self.history_len:]
```

### 7.4 FP8 GEMM with Scaling

The core compute kernel for FP8 training is the scaled matrix multiplication:

$$C_{32} = s_A \cdot s_B \cdot (A_{\text{fp8}} \times B_{\text{fp8}})$$

where $A_{\text{fp8}}$ and $B_{\text{fp8}}$ are quantized inputs, $s_A$ and $s_B$ are their per-tensor scale factors, and the product is accumulated in FP32. The outer scaling by $s_A \cdot s_B$ is a single scalar multiply applied to the FP32 result.

```python
import transformer_engine.pytorch as te

# Transformer Engine Linear layer handles FP8 automatically
linear = te.Linear(4096, 4096, bias=True)

# Enable FP8 compute
with te.fp8_autocast(enabled=True):
    output = linear(input_tensor)
    # Internally:
    # 1. Quantize input to FP8 E4M3 with per-tensor scale
    # 2. Quantize weight to FP8 E4M3 with per-tensor scale
    # 3. FP8 GEMM with FP32 accumulation
    # 4. Dequantize output to BF16
```

### 7.5 Per-Channel vs. Per-Tensor Scaling

Per-tensor scaling uses one scale factor for the entire tensor. If the tensor has outlier values (common in LLM activations — see Dettmers et al. "LLM.int8()"), the scale is dominated by outliers, and small values lose precision.

**Per-channel scaling** applies a separate scale factor to each row or column of a matrix. This captures local dynamic range more faithfully:

$$A_{\text{fp8}}[i, :] = \text{quantize}\left(\frac{A[i, :]}{s_i}\right)$$

The GEMM kernel must then handle $N$ scale factors instead of one, which is more complex but increasingly supported in hardware (NVIDIA Blackwell).

**Block-wise scaling** (e.g., per-128-element blocks) offers a middle ground and is used in techniques like MXFP (Microscaling Floating Point).

---

## 8. Numerical Stability Analysis

### 8.1 Gradient Histogram Analysis

A powerful diagnostic for mixed-precision training is the gradient histogram. For each parameter tensor, plot the distribution of gradient values on a log scale:

```python
import matplotlib.pyplot as plt
import numpy as np

def plot_gradient_histogram(model, step: int):
    """Plot gradient magnitude distribution across all parameters."""
    all_grads = []
    for name, param in model.named_parameters():
        if param.grad is not None:
            grads = param.grad.detach().abs().cpu().float().numpy().flatten()
            grads = grads[grads > 0]  # exclude exact zeros
            all_grads.append(grads)

    all_grads = np.concatenate(all_grads)
    log_grads = np.log10(all_grads)

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.hist(log_grads, bins=200, density=True, alpha=0.7)

    # Mark FP16 underflow threshold
    fp16_min_subnormal = 6e-8
    ax.axvline(np.log10(fp16_min_subnormal), color='red',
               linestyle='--', label=f'FP16 min subnormal ({fp16_min_subnormal:.0e})')

    ax.set_xlabel('log10(|gradient|)')
    ax.set_ylabel('Density')
    ax.set_title(f'Gradient magnitude distribution (step {step})')
    ax.legend()
    plt.tight_layout()
    plt.savefig(f'grad_hist_step_{step}.png', dpi=150)
```

### 8.2 Common Failure Modes

**Mode 1: Gradient underflow (FP16 without loss scaling).**
Symptoms: Training loss plateaus or diverges; early layers stop learning (gradient norms near zero). The gradient histogram shows a significant mass below $10^{-8}$.

**Mode 2: Gradient overflow (loss scale too large).**
Symptoms: `nan` or `inf` in loss; GradScaler repeatedly halves the scale. Check the maximum gradient magnitude — it should be well below 65504.

**Mode 3: Loss-of-significance in reductions (BF16).**
Symptoms: Layer normalization produces incorrect statistics; softmax probabilities do not sum to 1. This occurs when reductions (sum, mean) are accidentally performed in BF16 instead of FP32.

**Mode 4: Weight update stagnation (BF16).**
When $|\text{lr} \times g| < 2^{-7} \times |w|$, the BF16 weight update is rounded to zero. For a weight $w = 1.0$ and learning rate $10^{-4}$, this happens when $|g| < 0.078$ — which is almost always. The fix: **always update master weights in FP32**.

### 8.3 Kahan Summation for Reductions

When accumulating many small values in reduced precision, standard summation loses significant accuracy. Kahan (compensated) summation tracks the running error:

$$\text{Let } c = 0, s = 0$$

$$\text{For each } x_i: \quad y = x_i - c, \quad t = s + y, \quad c = (t - s) - y, \quad s = t$$

The compensation term $c$ captures the rounding error from each addition and feeds it back into the next iteration. This achieves $O(1)$ error growth instead of $O(N)$.

In practice, hardware FP32 accumulation in Tensor Cores makes Kahan summation unnecessary for GEMMs. It is most relevant for custom reduction kernels (e.g., gradient allreduce, normalization statistics).

---

## 9. Putting It Together: A Complete Mixed-Precision Training Pipeline

```python
"""
Production-grade mixed-precision training loop with all best practices.
"""
import torch
import torch.nn as nn
from torch.amp import autocast, GradScaler
from torch.utils.data import DataLoader
import logging

logger = logging.getLogger(__name__)

def train_mixed_precision(
    model: nn.Module,
    train_loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    num_epochs: int,
    dtype: torch.dtype = torch.bfloat16,
    max_grad_norm: float = 1.0,
    log_interval: int = 100,
):
    """
    Mixed-precision training supporting FP16 (with GradScaler) and BF16 (without).

    Args:
        model: Model with FP32 master weights.
        train_loader: DataLoader yielding (input, target) tuples.
        optimizer: Optimizer operating on FP32 parameters.
        criterion: Loss function (will run in FP32 via autocast).
        num_epochs: Number of training epochs.
        dtype: Compute dtype — torch.float16 or torch.bfloat16.
        max_grad_norm: Maximum gradient norm for clipping.
        log_interval: Log every N steps.
    """
    device = next(model.parameters()).device
    use_scaler = (dtype == torch.float16)
    scaler = GradScaler(enabled=use_scaler)

    model.train()
    global_step = 0

    for epoch in range(num_epochs):
        for batch_idx, (inputs, targets) in enumerate(train_loader):
            inputs = inputs.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)  # More memory efficient

            # Forward pass in reduced precision
            with autocast(device_type='cuda', dtype=dtype):
                outputs = model(inputs)
                loss = criterion(outputs, targets)

            # Backward pass (scaled for FP16, unscaled for BF16)
            scaler.scale(loss).backward()

            # Unscale before clipping (no-op if scaler is disabled)
            scaler.unscale_(optimizer)
            grad_norm = torch.nn.utils.clip_grad_norm_(
                model.parameters(), max_grad_norm
            )

            # Optimizer step (skipped if inf/nan for FP16)
            scaler.step(optimizer)
            scaler.update()

            global_step += 1

            if global_step % log_interval == 0:
                scale_val = scaler.get_scale() if use_scaler else 1.0
                logger.info(
                    f"Epoch {epoch} | Step {global_step} | "
                    f"Loss {loss.item():.4f} | "
                    f"Grad norm {grad_norm:.4f} | "
                    f"Loss scale {scale_val:.1f}"
                )
```

---

## 10. Advanced Topics

### 10.1 Mixed-Precision with FSDP

When combining mixed-precision with Fully Sharded Data Parallelism (FSDP), the precision strategy applies at multiple levels:

```python
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import MixedPrecision

mp_policy = MixedPrecision(
    param_dtype=torch.bfloat16,    # Sharded params stored in BF16
    reduce_dtype=torch.float32,    # Gradient allreduce in FP32
    buffer_dtype=torch.bfloat16,   # Buffers (e.g., BN stats) in BF16
)

model = FSDP(model, mixed_precision=mp_policy)
```

The `reduce_dtype` is critical: reducing gradients in BF16 across many ranks introduces additional quantization error at each communication step. FP32 reduction preserves gradient fidelity.

### 10.2 Stochastic Rounding

Standard rounding (round-to-nearest-even) is deterministic but biased for uniform distributions of values near the rounding boundary. **Stochastic rounding** rounds up with probability proportional to the fractional part:

$$\text{SR}(x) = \begin{cases} \lfloor x \rfloor & \text{with probability } \lceil x \rceil - x \\ \lceil x \rceil & \text{with probability } x - \lfloor x \rfloor \end{cases}$$

This ensures $\mathbb{E}[\text{SR}(x)] = x$, making it an unbiased estimator. Stochastic rounding is particularly beneficial for FP8 training and for gradient accumulation, where systematic rounding errors can compound over thousands of steps.

Hardware support for stochastic rounding is available on some accelerators (Graphcore IPU, certain FPGA implementations) but not yet on NVIDIA GPUs as of Hopper.

### 10.3 Loss Scaling for Specific Layers

In some architectures, different layers have vastly different gradient magnitudes. A single global loss scale may be insufficient. **Per-layer loss scaling** assigns different scale factors to different layers:

$$\mathcal{L}_{\text{scaled}} = S_1 \cdot \mathcal{L}_1 + S_2 \cdot \mathcal{L}_2 + \ldots$$

This is rarely used in practice because dynamic loss scaling adapts well enough, but it appears in some multi-task training setups where auxiliary losses have very different gradient magnitudes.

---

## Key Takeaways

1. **Mixed-precision training is not optional at scale.** The 15x throughput difference between FP32 and FP16 Tensor Cores makes reduced precision an economic necessity for large model training.

2. **BF16 is the modern default.** Its FP32-equivalent dynamic range eliminates the need for loss scaling while providing sufficient precision for neural network training. Use BF16 unless your hardware does not support it.

3. **FP16 requires loss scaling.** The narrow 5-bit exponent causes gradient underflow. Dynamic loss scaling (GradScaler) adapts automatically and is the standard mitigation.

4. **FP8 doubles throughput again** but requires per-tensor scaling and careful assignment of E4M3 (forward) vs. E5M2 (backward) formats.

5. **FP32 master weights and FP32 accumulation are non-negotiable.** Reduced precision is for compute and communication; the optimizer state and weight updates must remain in full precision.

6. **Always profile gradient histograms** when deploying a new mixed-precision configuration. The distribution of gradient magnitudes relative to the dtype's representable range is the definitive diagnostic.

---

## Further Reading

### Required

1. **Micikevicius, P., et al.** (2018). "Mixed Precision Training." *ICLR 2018*.
   - The foundational paper. Introduces the three-copy recipe and loss scaling.

2. **NVIDIA.** (2022). "FP8 Formats for Deep Learning." arXiv:2209.05433.
   - Defines the E4M3/E5M2 formats and validates FP8 training at scale.

### Recommended

3. **Kalamkar, D., et al.** (2019). "A Study of BFLOAT16 for Deep Learning Training." arXiv:1905.12322.
   - Empirical validation that BF16 matches FP32 training quality across vision, NLP, and speech tasks.

4. **Dettmers, T., et al.** (2022). "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale." *NeurIPS 2022*.
   - Analysis of activation outliers in LLMs and their impact on quantization.

5. **Noune, B., et al.** (2022). "8-bit Numerical Formats for Deep Neural Networks." arXiv:2206.02915.
   - Comprehensive analysis of 8-bit format design choices.

### Hardware References

6. **NVIDIA H100 Tensor Core GPU Architecture Whitepaper.** (2022).
   - Details on Tensor Core generations and their precision support.

7. **NVIDIA Transformer Engine Documentation.**
   - Practical guide to FP8 training with delayed scaling.
