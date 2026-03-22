# Recitation 02: Convolution Arithmetic and Practical Computation

## Overview

This recitation provides a hands-on guide to convolution arithmetic — the "plumbing" of CNNs. We cover output size formulas, transposed convolution, dilated convolution, depthwise separable convolution, 1x1 convolutions, and practical FLOPs/parameter counting. Each section includes worked examples and runnable PyTorch code.

---

## 1. Output Size Formulas

### 1.1 Standard Convolution

**Formula.** For input size $H_{\text{in}}$, kernel $k$, padding $p$, stride $s$, dilation $d$:

$$H_{\text{out}} = \left\lfloor \frac{H_{\text{in}} + 2p - d(k-1) - 1}{s} \right\rfloor + 1$$

### 1.2 Worked Examples

**Example 1: Basic convolution.**

- Input: $H = 32$, kernel $k = 3$, padding $p = 0$, stride $s = 1$, dilation $d = 1$
- $H_{\text{out}} = \lfloor \frac{32 + 0 - 1(2) - 1}{1} \rfloor + 1 = \lfloor 29 \rfloor + 1 = 30$

**Example 2: "Same" convolution.**

- Input: $H = 32$, $k = 5$, $p = 2$, $s = 1$, $d = 1$
- $H_{\text{out}} = \lfloor \frac{32 + 4 - 4 - 1}{1} \rfloor + 1 = 31 + 1 = 32$
- Rule: for "same" output with $s=1$, $d=1$: $p = \lfloor k/2 \rfloor$

**Example 3: Strided convolution.**

- Input: $H = 224$, $k = 7$, $p = 3$, $s = 2$, $d = 1$
- $H_{\text{out}} = \lfloor \frac{224 + 6 - 6 - 1}{2} \rfloor + 1 = \lfloor 111.5 \rfloor + 1 = 112$
- This is the ResNet stem: halves spatial dimensions.

**Example 4: Dilated convolution.**

- Input: $H = 32$, $k = 3$, $p = 2$, $s = 1$, $d = 2$
- Effective kernel: $d(k-1) + 1 = 2(2) + 1 = 5$
- $H_{\text{out}} = \lfloor \frac{32 + 4 - 4 - 1}{1} \rfloor + 1 = 32$
- Note: padding $p = d \lfloor k/2 \rfloor = 2$ gives "same" for dilated conv.

**Example 5: Combined stride and dilation.**

- Input: $H = 64$, $k = 3$, $p = 2$, $s = 2$, $d = 2$
- $H_{\text{out}} = \lfloor \frac{64 + 4 - 4 - 1}{2} \rfloor + 1 = \lfloor 31.5 \rfloor + 1 = 32$

**Example 6: Max Pooling.**

- Same formula applies. Input: $H = 112$, $k = 3$, $p = 1$, $s = 2$
- $H_{\text{out}} = \lfloor \frac{112 + 2 - 2 - 1}{2} \rfloor + 1 = \lfloor 55.5 \rfloor + 1 = 56$

### 1.3 Quick Reference Table

| Operation           | $k$ | $p$ | $s$ | $d$ | $H_{\text{in}}=224$ | $H_{\text{out}}$ |
|:-------------------:|:---:|:---:|:---:|:---:|:--------------------:|:-----------------:|
| Conv 3x3 same       | 3   | 1   | 1   | 1   | 224                  | 224               |
| Conv 3x3 valid      | 3   | 0   | 1   | 1   | 224                  | 222               |
| Conv 3x3 stride 2   | 3   | 1   | 2   | 1   | 224                  | 112               |
| Conv 7x7 stride 2   | 7   | 3   | 2   | 1   | 224                  | 112               |
| MaxPool 3x3 stride 2| 3   | 1   | 2   | 1   | 112                  | 56                |
| Conv 3x3 dilation 2 | 3   | 2   | 1   | 2   | 56                   | 56                |
| Conv 1x1            | 1   | 0   | 1   | 1   | 56                   | 56                |

### 1.4 PyTorch Verification

```python
import torch
import torch.nn as nn

def verify_output_size(H_in, k, p, s, d=1):
    """Verify the output size formula against PyTorch."""
    # Formula
    H_out_formula = (H_in + 2*p - d*(k-1) - 1) // s + 1

    # PyTorch
    conv = nn.Conv2d(1, 1, k, stride=s, padding=p, dilation=d)
    x = torch.randn(1, 1, H_in, H_in)
    H_out_pytorch = conv(x).shape[2]

    match = "OK" if H_out_formula == H_out_pytorch else "MISMATCH"
    print(f"H_in={H_in}, k={k}, p={p}, s={s}, d={d} -> "
          f"formula={H_out_formula}, pytorch={H_out_pytorch} [{match}]")

verify_output_size(32, 3, 0, 1)       # 30
verify_output_size(32, 5, 2, 1)       # 32
verify_output_size(224, 7, 3, 2)      # 112
verify_output_size(32, 3, 2, 1, 2)    # 32
verify_output_size(64, 3, 2, 2, 2)    # 32
verify_output_size(112, 3, 1, 2)      # 56
```

---

## 2. Transposed Convolution (Deconvolution)

### 2.1 Motivation

Standard convolution with stride > 1 reduces spatial dimensions. Many tasks (segmentation, generation) require *increasing* spatial dimensions. Transposed convolution (sometimes misleadingly called "deconvolution") achieves this.

### 2.2 Definition

**Definition 2.1 (Transposed Convolution).** A transposed convolution with kernel $k$, stride $s$, and padding $p$ is defined as the transpose of the corresponding standard convolution operator. If the forward convolution maps $\mathbb{R}^{H_{\text{in}}} \to \mathbb{R}^{H_{\text{out}}}$ via a matrix $\mathbf{C}$, then the transposed convolution maps $\mathbb{R}^{H_{\text{out}}} \to \mathbb{R}^{H_{\text{in}}}$ via $\mathbf{C}^T$.

### 2.3 Relationship to Standard Convolution

**Theorem 2.1.** A transposed convolution with kernel $k$, stride $s$, and padding $p$ is equivalent to:

1. Insert $s - 1$ zeros between each input element (upsampling by factor $s$).
2. Add $k - p - 1$ zeros of padding on each side.
3. Perform a standard convolution with the **rotated** kernel (180-degree rotation).

**Output size formula for transposed convolution:**

$$H_{\text{out}} = (H_{\text{in}} - 1) \times s - 2p + k + \text{output\_padding}$$

where `output_padding` resolves the ambiguity when multiple input sizes map to the same output size under the forward convolution.

### 2.4 Derivation: Why "Transposed"?

Consider a 1D convolution with kernel $\mathbf{w} = [w_0, w_1, w_2]$, input $\mathbf{x} \in \mathbb{R}^5$, stride 1, no padding. The output $\mathbf{y} \in \mathbb{R}^3$ is computed as $\mathbf{y} = \mathbf{C}\mathbf{x}$ where:

$$\mathbf{C} = \begin{pmatrix}
w_0 & w_1 & w_2 & 0 & 0 \\
0 & w_0 & w_1 & w_2 & 0 \\
0 & 0 & w_0 & w_1 & w_2
\end{pmatrix} \in \mathbb{R}^{3 \times 5}$$

The transposed convolution maps $\mathbb{R}^3 \to \mathbb{R}^5$ via:

$$\mathbf{C}^T = \begin{pmatrix}
w_0 & 0 & 0 \\
w_1 & w_0 & 0 \\
w_2 & w_1 & w_0 \\
0 & w_2 & w_1 \\
0 & 0 & w_2
\end{pmatrix} \in \mathbb{R}^{5 \times 3}$$

Observe: $\mathbf{C}^T$ is also a Toeplitz matrix, but with the reversed kernel $[w_2, w_1, w_0]$ and "full" padding. This is exactly a standard convolution with the flipped kernel and padding $k - 1 = 2$.

### 2.5 Checkerboard Artifacts

**Warning:** Transposed convolutions with stride > 1 often produce **checkerboard artifacts** when the kernel size is not divisible by the stride. This occurs because output pixels receive contributions from different numbers of input pixels.

**Solution:** Use `kernel_size` divisible by `stride` (e.g., $k=4, s=2$ or $k=2, s=2$), or use bilinear upsampling followed by a standard convolution.

### 2.6 PyTorch Implementation and Verification

```python
import torch
import torch.nn as nn

def demonstrate_transposed_conv():
    """Show that transposed conv is the gradient of the forward conv."""
    # Forward convolution
    conv = nn.Conv2d(1, 1, kernel_size=3, stride=2, padding=1, bias=False)

    # Transposed convolution with same weights
    trans_conv = nn.ConvTranspose2d(1, 1, kernel_size=3, stride=2,
                                    padding=1, output_padding=1, bias=False)
    trans_conv.weight.data = conv.weight.data.clone()

    # Forward: (1,1,8,8) -> (1,1,4,4)
    x = torch.randn(1, 1, 8, 8)
    y = conv(x)
    print(f"Forward:    {x.shape} -> {y.shape}")     # (1,1,8,8) -> (1,1,4,4)

    # Transposed: (1,1,4,4) -> (1,1,8,8)
    x_recon = trans_conv(y)
    print(f"Transposed: {y.shape} -> {x_recon.shape}")  # (1,1,4,4) -> (1,1,8,8)

    # Verify: transposed conv = gradient of forward conv
    x.requires_grad_(True)
    y = conv(x)
    grad_x = torch.autograd.grad(y.sum(), x)[0]             # (1,1,8,8)

    ones_input = torch.ones_like(y)
    trans_output = trans_conv(ones_input)                      # (1,1,8,8)

    # These should be equal (transposed conv of all-ones = sum of conv gradients)
    print(f"Grad vs TransConv error: {(grad_x - trans_output).abs().max():.2e}")

demonstrate_transposed_conv()
```

### 2.7 Output Size Examples

```python
def transposed_conv_output_size(H_in, k, s, p, op=0):
    """Output size for transposed convolution."""
    return (H_in - 1) * s - 2 * p + k + op

# Common upsampling configurations
cases = [
    ("2x upsample (k=4,s=2,p=1)", 16, 4, 2, 1, 0),
    ("2x upsample (k=2,s=2,p=0)", 16, 2, 2, 0, 0),
    ("2x upsample (k=3,s=2,p=1,op=1)", 16, 3, 2, 1, 1),
    ("4x upsample (k=4,s=4,p=0)", 7, 4, 4, 0, 0),
]

for name, H_in, k, s, p, op in cases:
    H_out = transposed_conv_output_size(H_in, k, s, p, op)
    print(f"{name}: {H_in} -> {H_out}")
```

---

## 3. Dilated (Atrous) Convolution

### 3.1 Motivation

Standard convolutions grow the receptive field linearly with depth. For tasks requiring large receptive fields (semantic segmentation, audio generation), this requires many layers. Dilation allows exponential receptive field growth.

### 3.2 Effective Kernel Size

A kernel of size $k$ with dilation $d$ has an effective kernel size of:

$$k_{\text{eff}} = d(k - 1) + 1$$

For a $3 \times 3$ kernel: dilation 1 gives effective $3 \times 3$, dilation 2 gives $5 \times 5$, dilation 4 gives $9 \times 9$.

### 3.3 Exponential Receptive Field Growth

Stack $L$ dilated convolutions with dilation rates $d_\ell = 2^{\ell-1}$ (for $\ell = 1, \ldots, L$) and $3 \times 3$ kernels:

$$r_L = 1 + \sum_{\ell=1}^{L} 2 \cdot 2^{\ell-1} = 1 + 2(2^L - 1) = 2^{L+1} - 1$$

| $L$ | Dilation rates | Receptive field | Params ($3 \times 3$, single channel) |
|:---:|:--------------:|:---------------:|:------------------------------------:|
| 1   | [1]            | 3               | 9                                    |
| 3   | [1, 2, 4]      | 15              | 27                                   |
| 5   | [1,2,4,8,16]   | 63              | 45                                   |
| 8   | [1,...,128]     | 511             | 72                                   |

Compare: 8 standard $3 \times 3$ layers give receptive field $1 + 2 \times 8 = 17$.

### 3.4 When to Use Dilation

- **Semantic segmentation:** DeepLab uses dilated convolutions (atrous spatial pyramid pooling, ASPP) to maintain resolution while increasing receptive field.
- **Audio generation:** WaveNet uses exponentially growing dilations for long-range temporal dependencies.
- **Avoid when:** The task requires fine-grained local detail (dilation creates "holes" in the receptive field). Mix dilated and non-dilated layers.

### 3.5 Gridding Problem

**Problem:** With dilation $d$, the kernel only samples every $d$-th pixel, creating a grid pattern. If all layers use the same dilation, information between grid points never interacts.

**Solutions:**

1. Use a sequence of different dilation rates (e.g., [1, 2, 4, 8] or [1, 2, 5, 1, 2, 5]).
2. The Hybrid Dilated Convolution (HDC) principle: use dilation rates whose GCD is 1.
3. Interleave dilated and non-dilated layers.

```python
import torch
import torch.nn as nn

# Dilated convolution example
conv_d1 = nn.Conv2d(64, 64, 3, padding=1, dilation=1)    # standard
conv_d2 = nn.Conv2d(64, 64, 3, padding=2, dilation=2)    # dilation 2
conv_d4 = nn.Conv2d(64, 64, 3, padding=4, dilation=4)    # dilation 4

x = torch.randn(1, 64, 32, 32)                            # (1, 64, 32, 32)

# All produce same spatial size with appropriate padding
y1 = conv_d1(x)   # (1, 64, 32, 32)
y2 = conv_d2(x)   # (1, 64, 32, 32)
y4 = conv_d4(x)   # (1, 64, 32, 32)

print(f"Dilation 1: {y1.shape}, params={sum(p.numel() for p in conv_d1.parameters()):,}")
print(f"Dilation 2: {y2.shape}, params={sum(p.numel() for p in conv_d2.parameters()):,}")
print(f"Dilation 4: {y4.shape}, params={sum(p.numel() for p in conv_d4.parameters()):,}")
# All have the same number of parameters (only the sampling pattern differs)
```

---

## 4. Depthwise Separable Convolution

### 4.1 Motivation

Standard convolution with $C_{\text{in}}$ input channels, $C_{\text{out}}$ output channels, and kernel $k \times k$ requires $C_{\text{out}} \times C_{\text{in}} \times k^2$ parameters and $C_{\text{out}} \times C_{\text{in}} \times k^2 \times H_{\text{out}} \times W_{\text{out}}$ multiply-adds. For large $C$ and $k$, this dominates computation.

### 4.2 Decomposition

**Definition 4.1 (Depthwise Separable Convolution).** Factor the standard convolution into two steps:

**Step 1: Depthwise convolution.** Apply a separate $k \times k$ filter to each input channel independently:

$$\hat{Y}[c, i, j] = \sum_{m,n} X[c, i+m, j+n] \cdot W_{\text{dw}}[c, m, n]$$

This has $C_{\text{in}} \times k^2$ parameters. The output has $C_{\text{in}}$ channels.

**Step 2: Pointwise convolution.** Apply $1 \times 1$ convolution to mix channels:

$$Y[o, i, j] = \sum_{c} \hat{Y}[c, i, j] \cdot W_{\text{pw}}[o, c]$$

This has $C_{\text{out}} \times C_{\text{in}}$ parameters.

### 4.3 Parameter and Computation Savings

**Proposition 4.1.** The ratio of parameters (and FLOPs) for depthwise separable vs. standard convolution is:

$$\frac{C_{\text{in}} k^2 + C_{\text{out}} C_{\text{in}}}{C_{\text{out}} C_{\text{in}} k^2} = \frac{1}{C_{\text{out}}} + \frac{1}{k^2}$$

**Example.** For $C_{\text{in}} = C_{\text{out}} = 256$, $k = 3$:

$$\text{Standard: } 256 \times 256 \times 9 = 589,824 \text{ params}$$
$$\text{Separable: } 256 \times 9 + 256 \times 256 = 2,304 + 65,536 = 67,840 \text{ params}$$
$$\text{Ratio: } \frac{1}{256} + \frac{1}{9} \approx 0.115 \quad (8.7\times \text{ reduction})$$

For a typical $3 \times 3$ kernel, the reduction factor is approximately $8\text{-}9\times$.

### 4.4 PyTorch Implementation

```python
import torch
import torch.nn as nn

class DepthwiseSeparableConv2d(nn.Module):
    """
    Depthwise separable convolution: depthwise + pointwise.
    """
    def __init__(self, in_channels: int, out_channels: int, kernel_size: int,
                 stride: int = 1, padding: int = 0, bias: bool = True):
        super().__init__()
        # Depthwise: groups=in_channels, each channel gets its own filter
        self.depthwise = nn.Conv2d(
            in_channels, in_channels, kernel_size,
            stride=stride, padding=padding,
            groups=in_channels, bias=False                     # (C_in, 1, k, k)
        )
        # Pointwise: 1x1 conv for channel mixing
        self.pointwise = nn.Conv2d(
            in_channels, out_channels, 1, bias=bias           # (C_out, C_in, 1, 1)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (N, C_in, H, W)
        Returns:
            (N, C_out, H', W')
        """
        x = self.depthwise(x)           # (N, C_in, H', W')
        x = self.pointwise(x)           # (N, C_out, H', W')
        return x

# --- Comparison ---
C_in, C_out, k = 256, 256, 3
H, W = 56, 56

standard = nn.Conv2d(C_in, C_out, k, padding=1)
separable = DepthwiseSeparableConv2d(C_in, C_out, k, padding=1)

x = torch.randn(1, C_in, H, W)

y_std = standard(x)                     # (1, 256, 56, 56)
y_sep = separable(x)                     # (1, 256, 56, 56)

params_std = sum(p.numel() for p in standard.parameters())
params_sep = sum(p.numel() for p in separable.parameters())

print(f"Standard Conv:  {y_std.shape}, params={params_std:,}")
print(f"Depthwise Sep:  {y_sep.shape}, params={params_sep:,}")
print(f"Reduction ratio: {params_std / params_sep:.1f}x")
```

### 4.5 Applications

- **MobileNet (Howard et al., 2017):** Entire architecture built from depthwise separable convolutions. Achieves near-AlexNet accuracy with 1/30 the parameters.
- **EfficientNet (Tan & Le, 2019):** Uses MBConv blocks (inverted residual with depthwise separable convolutions).
- **ConvNeXt (Liu et al., 2022):** Uses depthwise convolution (but with 7x7 kernels and full channel expansion in pointwise layers).

---

## 5. 1x1 Convolution as Channel Mixing

### 5.1 What Does 1x1 Convolution Do?

A $1 \times 1$ convolution with $C_{\text{in}}$ input channels and $C_{\text{out}}$ output channels performs a linear transformation independently at each spatial position:

$$Y[o, i, j] = \sum_{c=0}^{C_{\text{in}}-1} W[o, c] \cdot X[c, i, j] + b[o]$$

This is equivalent to applying a shared fully connected layer (with weight matrix $W \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}}}$) at every spatial location.

### 5.2 Use Cases

1. **Dimensionality reduction:** Reduce channels before expensive operations (Inception bottleneck, ResNet bottleneck).
2. **Dimensionality expansion:** Increase channels (ConvNeXt inverted bottleneck, ResNet bottleneck output).
3. **Cross-channel interaction:** Learn nonlinear combinations of features from different channels.
4. **Final prediction:** Map feature channels to class scores in segmentation (FCN, U-Net).

### 5.3 Parameter and FLOPs Analysis

**Parameters:** $C_{\text{out}} \times C_{\text{in}} + C_{\text{out}}$ (weight + bias).

**FLOPs:** $2 \times C_{\text{out}} \times C_{\text{in}} \times H \times W$ (multiply-adds).

**Example:** $1 \times 1$ conv from 2048 to 512 channels on a $7 \times 7$ feature map:

- Parameters: $2048 \times 512 + 512 = 1,049,088$
- FLOPs: $2 \times 2048 \times 512 \times 7 \times 7 = 102,760,448 \approx 103\text{M}$

```python
import torch
import torch.nn as nn

# 1x1 convolution for channel reduction
reduce = nn.Conv2d(2048, 512, kernel_size=1, bias=True)      # (512, 2048, 1, 1)
x = torch.randn(1, 2048, 7, 7)                                # (1, 2048, 7, 7)
y = reduce(x)                                                  # (1, 512, 7, 7)

print(f"1x1 Conv: {x.shape} -> {y.shape}")
print(f"Parameters: {sum(p.numel() for p in reduce.parameters()):,}")

# Equivalence to per-pixel FC
fc = nn.Linear(2048, 512)
fc.weight.data = reduce.weight.data.squeeze(-1).squeeze(-1)   # (512, 2048)
fc.bias.data = reduce.bias.data

x_flat = x.permute(0, 2, 3, 1).reshape(-1, 2048)              # (49, 2048)
y_fc = fc(x_flat).reshape(1, 7, 7, 512).permute(0, 3, 1, 2)  # (1, 512, 7, 7)

print(f"Max error (1x1 conv vs FC): {(y - y_fc).abs().max():.2e}")
```

---

## 6. Practical Exercise: Computing FLOPs and Parameters

### 6.1 FLOPs Formulas

**Convention:** 1 FLOP = 1 multiply-add operation (some papers count multiplies and adds separately, doubling the count).

**Convolutional layer:**
$$\text{FLOPs} = C_{\text{out}} \times C_{\text{in}} \times K^2 \times H_{\text{out}} \times W_{\text{out}}$$

**Fully connected layer:**
$$\text{FLOPs} = C_{\text{in}} \times C_{\text{out}}$$

**Batch Normalization:** $4 \times C \times H \times W$ (mean, variance, normalize, scale-shift).

**ReLU:** $C \times H \times W$ (one comparison per element).

### 6.2 Architecture Analysis Tool

```python
import torch
import torch.nn as nn

def count_parameters(model: nn.Module) -> dict:
    """Count parameters per layer type."""
    counts = {}
    for name, module in model.named_modules():
        if len(list(module.children())) > 0:
            continue  # skip container modules
        n_params = sum(p.numel() for p in module.parameters())
        if n_params > 0:
            layer_type = type(module).__name__
            if layer_type not in counts:
                counts[layer_type] = {'count': 0, 'params': 0}
            counts[layer_type]['count'] += 1
            counts[layer_type]['params'] += n_params
    return counts

def compute_conv_flops(module: nn.Conv2d, input_shape: tuple) -> int:
    """
    Compute FLOPs for a Conv2d layer.

    Args:
        module: Conv2d module
        input_shape: (N, C_in, H, W)

    Returns:
        Number of multiply-add operations
    """
    N, C_in, H, W = input_shape
    C_out = module.out_channels
    K_h, K_w = module.kernel_size
    s_h, s_w = module.stride
    p_h, p_w = module.padding
    d_h, d_w = module.dilation
    groups = module.groups

    H_out = (H + 2*p_h - d_h*(K_h-1) - 1) // s_h + 1
    W_out = (W + 2*p_w - d_w*(K_w-1) - 1) // s_w + 1

    # FLOPs per output element: (C_in/groups) * K_h * K_w
    flops_per_element = (C_in // groups) * K_h * K_w
    total_flops = N * C_out * H_out * W_out * flops_per_element

    return total_flops

def analyze_architecture(model: nn.Module, input_shape: tuple = (1, 3, 224, 224)):
    """
    Analyze FLOPs and parameters for each layer in a model.
    Uses hooks to capture intermediate tensor shapes.
    """
    flops_list = []
    hooks = []

    def make_hook(name, module):
        def hook_fn(mod, inp, out):
            if isinstance(mod, nn.Conv2d):
                f = compute_conv_flops(mod, inp[0].shape)
                p = sum(param.numel() for param in mod.parameters())
                out_shape = out.shape
                flops_list.append({
                    'name': name, 'type': 'Conv2d',
                    'flops': f, 'params': p,
                    'out_shape': tuple(out_shape),
                })
            elif isinstance(mod, nn.Linear):
                f = inp[0].shape[0] * mod.in_features * mod.out_features
                p = sum(param.numel() for param in mod.parameters())
                flops_list.append({
                    'name': name, 'type': 'Linear',
                    'flops': f, 'params': p,
                    'out_shape': tuple(out.shape),
                })
        return hook_fn

    for name, module in model.named_modules():
        if isinstance(module, (nn.Conv2d, nn.Linear)):
            h = module.register_forward_hook(make_hook(name, module))
            hooks.append(h)

    x = torch.randn(*input_shape)
    with torch.no_grad():
        model(x)

    for h in hooks:
        h.remove()

    # Print results
    total_flops = 0
    total_params = 0
    print(f"{'Layer':<40} {'Type':<10} {'Output Shape':<22} {'FLOPs':>12} {'Params':>10}")
    print("-" * 100)

    for info in flops_list:
        total_flops += info['flops']
        total_params += info['params']
        print(f"{info['name']:<40} {info['type']:<10} {str(info['out_shape']):<22} "
              f"{info['flops']:>12,} {info['params']:>10,}")

    print("-" * 100)
    print(f"{'TOTAL':<40} {'':<10} {'':<22} {total_flops:>12,} {total_params:>10,}")
    print(f"\nTotal FLOPs: {total_flops/1e9:.2f} GFLOPs")
    print(f"Total Params: {total_params/1e6:.2f} M")

    return total_flops, total_params

# --- Analyze common architectures ---

# Simple VGG-like network
class SimpleVGG(nn.Module):
    def __init__(self):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1),      # 224x224
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 64, 3, padding=1),     # 224x224
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),                   # 112x112

            nn.Conv2d(64, 128, 3, padding=1),    # 112x112
            nn.ReLU(inplace=True),
            nn.Conv2d(128, 128, 3, padding=1),   # 112x112
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),                   # 56x56

            nn.Conv2d(128, 256, 3, padding=1),   # 56x56
            nn.ReLU(inplace=True),
            nn.Conv2d(256, 256, 3, padding=1),   # 56x56
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),                   # 28x28
        )
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(256, 10),
        )

    def forward(self, x):
        x = self.features(x)
        x = self.classifier(x)
        return x

print("=" * 100)
print("Simple VGG-like Network")
print("=" * 100)
model = SimpleVGG()
analyze_architecture(model)
```

### 6.3 Comparison Table: Famous Architectures

| Architecture  | Params (M) | FLOPs (G) | Top-1 Acc | FLOPs/Param Ratio |
|:-------------:|:----------:|:---------:|:---------:|:-----------------:|
| AlexNet       | 61.1       | 0.72      | 56.5%     | 0.012             |
| VGG-16        | 138.4      | 15.5      | 71.6%     | 0.112             |
| GoogLeNet     | 6.8        | 1.5       | 69.8%     | 0.221             |
| ResNet-50     | 25.6       | 4.1       | 76.1%     | 0.160             |
| MobileNet-v1  | 4.2        | 0.57      | 70.6%     | 0.136             |
| EfficientNet-B0| 5.3       | 0.39      | 77.1%     | 0.074             |
| ViT-B/16      | 86.6       | 17.6      | 77.9%     | 0.203             |
| ConvNeXt-T    | 28.6       | 4.5       | 82.1%     | 0.157             |

**Key observations:**

- AlexNet has the most parameters but fewest FLOPs — most parameters are in FC layers (cheap to compute, expensive to store).
- EfficientNet achieves the best accuracy-per-FLOP ratio through compound scaling.
- ViT is computationally expensive due to $O(N^2)$ self-attention.
- ConvNeXt matches ViT accuracy with CNN efficiency.

### 6.4 Practical Exercise

**Task:** For each of the following architectures, compute the total parameters and FLOPs by hand. Then verify with the `analyze_architecture` function.

1. **LeNet-5** on 32x32 input
2. **A 3-layer CNN:** Conv(3->32, 5x5, s=1, p=2) -> Pool(2x2) -> Conv(32->64, 3x3, s=1, p=1) -> Pool(2x2) -> Conv(64->128, 3x3, s=1, p=1) -> GAP -> FC(128, 10), on 32x32 input
3. **MobileNet-style block:** Conv_dw(64, 3x3, s=1, p=1) -> Conv_pw(64->128, 1x1), on 56x56 input

```python
# Exercise solution template

def manual_flops_exercise():
    """Compute FLOPs by hand for verification."""

    # Architecture 2: 3-layer CNN on 32x32
    print("Architecture 2: 3-layer CNN")
    print("-" * 50)

    # Conv1: 3->32, 5x5, 32x32->32x32
    flops_conv1 = 32 * 3 * 25 * 32 * 32      # C_out * C_in * K^2 * H_out * W_out
    params_conv1 = 32 * 3 * 25 + 32           # weights + bias
    print(f"Conv1: FLOPs={flops_conv1:,}, Params={params_conv1:,}")

    # Pool: 32x32 -> 16x16 (no params, no multiply-adds)

    # Conv2: 32->64, 3x3, 16x16->16x16
    flops_conv2 = 64 * 32 * 9 * 16 * 16
    params_conv2 = 64 * 32 * 9 + 64
    print(f"Conv2: FLOPs={flops_conv2:,}, Params={params_conv2:,}")

    # Pool: 16x16 -> 8x8

    # Conv3: 64->128, 3x3, 8x8->8x8
    flops_conv3 = 128 * 64 * 9 * 8 * 8
    params_conv3 = 128 * 64 * 9 + 128
    print(f"Conv3: FLOPs={flops_conv3:,}, Params={params_conv3:,}")

    # GAP: 8x8->1x1 (128 channels), no learnable params

    # FC: 128->10
    flops_fc = 128 * 10
    params_fc = 128 * 10 + 10
    print(f"FC:    FLOPs={flops_fc:,}, Params={params_fc:,}")

    total_flops = flops_conv1 + flops_conv2 + flops_conv3 + flops_fc
    total_params = params_conv1 + params_conv2 + params_conv3 + params_fc
    print(f"\nTotal: FLOPs={total_flops:,} ({total_flops/1e6:.2f}M), "
          f"Params={total_params:,}")

    # MobileNet-style block
    print("\n\nMobileNet-style block (64ch -> 128ch, 56x56)")
    print("-" * 50)

    # Depthwise: 64 channels, 3x3, 56x56
    flops_dw = 64 * 9 * 56 * 56
    params_dw = 64 * 9
    print(f"Depthwise:  FLOPs={flops_dw:,}, Params={params_dw:,}")

    # Pointwise: 64->128, 1x1, 56x56
    flops_pw = 128 * 64 * 56 * 56
    params_pw = 128 * 64 + 128
    print(f"Pointwise:  FLOPs={flops_pw:,}, Params={params_pw:,}")

    total_sep = flops_dw + flops_pw
    print(f"Total sep:  FLOPs={total_sep:,}")

    # Standard conv equivalent
    flops_std = 128 * 64 * 9 * 56 * 56
    print(f"Standard:   FLOPs={flops_std:,}")
    print(f"Ratio:      {flops_std / total_sep:.1f}x")

manual_flops_exercise()
```

---

## 7. Summary Cheat Sheet

### Output Size Formulas

| Operation | Formula |
|:---------:|:-------:|
| Conv/Pool | $\lfloor \frac{H + 2p - d(k-1) - 1}{s} \rfloor + 1$ |
| Transposed Conv | $(H-1) \cdot s - 2p + k + \text{op}$ |
| "Same" padding | $p = \lfloor k/2 \rfloor$ (for $s=1$, $d=1$, odd $k$) |
| Dilated "same" | $p = d \lfloor k/2 \rfloor$ (for $s=1$, odd $k$) |

### Parameter Count

| Layer Type | Parameters |
|:----------:|:----------:|
| Standard Conv | $C_{\text{out}} \times C_{\text{in}} \times k^2 + C_{\text{out}}$ |
| Depthwise Conv | $C \times k^2 + C$ |
| Pointwise Conv | $C_{\text{out}} \times C_{\text{in}} + C_{\text{out}}$ |
| Depthwise Separable | $C_{\text{in}} \times k^2 + C_{\text{out}} \times C_{\text{in}} + C_{\text{out}}$ |
| FC Layer | $C_{\text{in}} \times C_{\text{out}} + C_{\text{out}}$ |
| BN | $2C$ (learnable $\gamma, \beta$) |

### FLOPs (Multiply-Adds)

| Layer Type | FLOPs |
|:----------:|:-----:|
| Standard Conv | $C_{\text{out}} \times C_{\text{in}} \times k^2 \times H_{\text{out}} \times W_{\text{out}}$ |
| Depthwise Conv | $C \times k^2 \times H_{\text{out}} \times W_{\text{out}}$ |
| Pointwise Conv | $C_{\text{out}} \times C_{\text{in}} \times H \times W$ |
| FC Layer | $C_{\text{in}} \times C_{\text{out}}$ |
| Self-Attention | $2 \times N^2 \times D + 2 \times N \times D^2$ |

### Receptive Field

$$r_L = r_{L-1} + (k_L - 1) \cdot d_L \cdot \prod_{i=1}^{L-1} s_i, \quad r_0 = 1$$

### Key Design Rules

1. Use 3x3 kernels (or 7x7 depthwise for ConvNeXt-style).
2. Double channels when halving spatial dimensions.
3. Use depthwise separable convolutions for efficiency (~8-9x savings).
4. 1x1 convolutions for channel mixing and dimensionality reduction.
5. Global average pooling instead of FC layers for the classifier.
6. Transposed convolution kernel size should be divisible by stride to avoid checkerboard artifacts.
7. Dilated convolution: use sequences with GCD=1 to avoid gridding.
