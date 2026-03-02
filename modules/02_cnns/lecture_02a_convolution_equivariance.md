# Lecture 02a: Convolution, Cross-Correlation, and Translation Equivariance

## 1. Learning Objectives

After completing this lecture, students will be able to:

1. State the precise mathematical definition of discrete convolution and cross-correlation in 1D and 2D, and explain why deep learning frameworks implement cross-correlation under the name "convolution."
2. Prove that the convolution operator is equivariant under the translation group acting on the input signal.
3. Formulate convolution as a group-equivariant map and state the conditions under which a linear map is equivariant (characterization theorem).
4. Derive the receptive field size for stacked convolutional layers with arbitrary kernel sizes, strides, and dilations.
5. Express convolution as matrix multiplication via Toeplitz (1D) and doubly-block-Toeplitz (2D) matrices, and describe the im2col strategy.
6. Compute output spatial dimensions given arbitrary stride, padding, and dilation.

---

## 2. Motivation and Context

### 2.1 Historical Background

The application of convolution to neural networks dates to Fukushima's Neocognitron (1980), which introduced the idea of local receptive fields and weight sharing inspired by Hubel and Wiesel's discoveries about simple and complex cells in the visual cortex. LeCun et al. (1989) made this practical by showing that backpropagation could train convolutional networks for handwritten digit recognition, leading to the LeNet family deployed at scale by the US Postal Service.

### 2.2 Why Convolution Matters

Fully connected layers applied to images are statistically and computationally wasteful. An image of size 224 x 224 x 3 has 150,528 input dimensions; a single hidden layer of 1,000 units would require ~150 million parameters. Convolution exploits two structural priors about images:

- **Locality**: Pixels that are spatially close carry correlated information. A local receptive field suffices to detect elementary features.
- **Stationarity (translation invariance of statistics)**: The same feature can appear anywhere in the image. Weight sharing across spatial positions captures this.

These priors reduce parameters by orders of magnitude and provide a strong inductive bias that accelerates learning from finite data.

---

## 3. Core Theory

### 3.1 Discrete Convolution in 1D

**Definition 3.1 (1D Discrete Convolution).** Let $f: \mathbb{Z} \to \mathbb{R}$ be an input signal and $g: \mathbb{Z} \to \mathbb{R}$ be a kernel (filter), both with finite support. The discrete convolution $(f * g)$ is defined as:

$$(f * g)[n] = \sum_{k=-\infty}^{\infty} f[k] \, g[n - k]$$

For a kernel of size $K$ (supported on $\{0, 1, \ldots, K-1\}$) and input of size $N$ (supported on $\{0, 1, \ldots, N-1\}$):

$$(f * g)[n] = \sum_{k=0}^{K-1} f[n - k] \, g[k]$$

**Definition 3.2 (1D Discrete Cross-Correlation).** The cross-correlation of $f$ with $g$ is:

$$(f \star g)[n] = \sum_{k=0}^{K-1} f[n + k] \, g[k]$$

**Remark.** Cross-correlation is convolution with a flipped kernel: $(f \star g)[n] = (f * \tilde{g})[n]$ where $\tilde{g}[k] = g[-k]$. Since learned kernels have no preferred orientation, the distinction is irrelevant for optimization. All major deep learning frameworks (PyTorch, TensorFlow) implement cross-correlation and call it "convolution." We follow this convention unless stated otherwise.

### 3.2 Discrete Convolution in 2D

**Definition 3.3 (2D Discrete Cross-Correlation).** Let $F: \mathbb{Z}^2 \to \mathbb{R}$ be a 2D input (single-channel image) and $W: \mathbb{Z}^2 \to \mathbb{R}$ be a 2D kernel of spatial size $K_h \times K_w$. The 2D cross-correlation is:

$$(F \star W)[i, j] = \sum_{m=0}^{K_h - 1} \sum_{n=0}^{K_w - 1} F[i + m, \, j + n] \, W[m, n]$$

**Definition 3.4 (Multi-Channel Convolution).** For input $F \in \mathbb{R}^{C_{\text{in}} \times H \times W}$ and a bank of $C_{\text{out}}$ filters, each $W^{(o)} \in \mathbb{R}^{C_{\text{in}} \times K_h \times K_w}$, with bias $b \in \mathbb{R}^{C_{\text{out}}}$:

$$Y[o, i, j] = b[o] + \sum_{c=0}^{C_{\text{in}}-1} \sum_{m=0}^{K_h-1} \sum_{n=0}^{K_w-1} F[c, \, i+m, \, j+n] \, W^{(o)}[c, m, n]$$

for $o = 0, \ldots, C_{\text{out}} - 1$.

### 3.3 Translation Equivariance

**Definition 3.5 (Translation Operator).** For a vector $a \in \mathbb{Z}^d$, define the translation operator $T_a$ acting on a function $f: \mathbb{Z}^d \to \mathbb{R}$ by:

$$(T_a f)[x] = f[x - a]$$

**Definition 3.6 (Equivariance).** A map $\Phi$ is equivariant with respect to a group action $T$ if:

$$\Phi \circ T_a = T_a \circ \Phi \quad \text{for all } a \text{ in the group}$$

That is, applying the transformation before or after the map yields the same result.

**Theorem 3.1 (Translation Equivariance of Convolution).** Let $\Phi_g(f) = f * g$ denote convolution with a fixed kernel $g$. Then $\Phi_g$ is equivariant under translations: for all $a \in \mathbb{Z}$,

$$T_a(\Phi_g(f)) = \Phi_g(T_a(f))$$

*Proof.* We compute each side. For the left-hand side:

$$[T_a(\Phi_g(f))][n] = (\Phi_g(f))[n - a] = \sum_k f[n - a - k] \, g[k]$$

For the right-hand side:

$$[\Phi_g(T_a f)][n] = \sum_k (T_a f)[n - k] \, g[k] = \sum_k f[(n - k) - a] \, g[k] = \sum_k f[n - a - k] \, g[k]$$

Both expressions are identical. $\square$

**Corollary 3.1.** The same result holds in 2D: if $T_{(a,b)}F[i,j] = F[i-a, j-b]$, then for the 2D convolution operator $\Phi_W$:

$$T_{(a,b)} \circ \Phi_W = \Phi_W \circ T_{(a,b)}$$

The proof is identical, applying the translation to both spatial indices.

**Remark.** Equivariance holds for the convolution operation itself. Pooling (max or average) over spatial regions introduces approximate translation invariance rather than equivariance — small translations may not change the pooled output.

### 3.4 Group-Theoretic Perspective

**Definition 3.7 (Translation Group).** The group $(\mathbb{Z}^2, +)$ acts on functions $f: \mathbb{Z}^2 \to \mathbb{R}$ via the translation operator. This is an abelian group.

**Theorem 3.2 (Characterization of Translation-Equivariant Linear Maps).** A bounded linear operator $\Phi: L^2(\mathbb{Z}^d) \to L^2(\mathbb{Z}^d)$ is equivariant under the translation group if and only if $\Phi$ is a convolution: there exists a kernel $g$ such that $\Phi(f) = f * g$.

*Proof sketch.* ($\Leftarrow$) Proved in Theorem 3.1. ($\Rightarrow$) Suppose $\Phi$ is linear and translation-equivariant. Define $g = \Phi(\delta)$, where $\delta$ is the Kronecker delta (unit impulse). For any input $f$, decompose $f = \sum_k f[k] \, T_k \delta$. By linearity and equivariance:

$$\Phi(f) = \sum_k f[k] \, \Phi(T_k \delta) = \sum_k f[k] \, T_k(\Phi(\delta)) = \sum_k f[k] \, T_k g = f * g$$

This is precisely convolution. $\square$

This theorem, due to the convolution theorem in harmonic analysis, tells us that convolution is not merely one possible equivariant architecture — it is the *only* linear translation-equivariant operation. Cohen and Welling (2016) generalize this to arbitrary groups, yielding group convolutions equivariant to rotations, reflections, and other symmetries.

### 3.5 Parameter Sharing and Statistical Benefits

**Proposition 3.1 (Parameter Reduction).** A convolutional layer with $C_{\text{in}}$ input channels, $C_{\text{out}}$ output channels, and kernel size $K \times K$ has:

$$\text{Parameters} = C_{\text{out}} \times (C_{\text{in}} \times K^2 + 1)$$

A fully connected layer mapping the same spatial input $C_{\text{in}} \times H \times W$ to output $C_{\text{out}} \times H' \times W'$ would require $(C_{\text{in}} \cdot H \cdot W) \times (C_{\text{out}} \cdot H' \cdot W')$ parameters.

**Example.** For $C_{\text{in}} = 64$, $C_{\text{out}} = 128$, $K = 3$, $H = W = 56$:
- Conv parameters: $128 \times (64 \times 9 + 1) = 73,856$
- FC parameters: $(64 \times 56 \times 56) \times (128 \times 56 \times 56) \approx 8.1 \times 10^{10}$

The ratio is over $10^5$. Weight sharing acts as a strong regularizer, reducing the effective model complexity and improving generalization from finite training data. From a Bayesian perspective, the convolutional parameterization places a prior that the same local feature detector is useful at every spatial position.

### 3.6 Receptive Field Analysis

**Definition 3.8 (Receptive Field).** The receptive field of a unit in layer $\ell$ is the set of input pixels that can influence its activation.

**Theorem 3.3 (Receptive Field of Stacked Convolutions).** Consider $L$ stacked convolutional layers, where layer $\ell$ has kernel size $k_\ell$, stride $s_\ell$, and dilation $d_\ell$. The receptive field size $r_L$ at layer $L$ (measured in input pixels) satisfies the recurrence:

$$r_L = r_{L-1} + (k_L - 1) \cdot d_L \cdot \prod_{\ell=1}^{L-1} s_\ell$$

with $r_0 = 1$.

*Proof.* We prove by induction on the number of layers.

**Base case:** $r_0 = 1$ (a single pixel has a receptive field of 1).

**Inductive step:** Assume the receptive field at layer $L-1$ is $r_{L-1}$ input pixels. At layer $L$, each unit looks at $k_L$ positions with dilation $d_L$, spanning $(k_L - 1) \cdot d_L + 1$ contiguous positions in layer $L-1$'s output. Each of those positions has receptive field $r_{L-1}$ in the input. However, due to the strides in layers $1, \ldots, L-1$, adjacent positions in layer $L-1$'s output are spaced $\prod_{\ell=1}^{L-1} s_\ell$ input pixels apart. Thus the additional extent is $(k_L - 1) \cdot d_L \cdot \prod_{\ell=1}^{L-1} s_\ell$ input pixels beyond the center position's receptive field:

$$r_L = r_{L-1} + (k_L - 1) \cdot d_L \cdot \prod_{\ell=1}^{L-1} s_\ell$$

$\square$

**Corollary 3.2.** For $L$ layers of $3 \times 3$ convolutions with stride 1 and no dilation:

$$r_L = 1 + 2L$$

Thus 3 stacked $3 \times 3$ layers give a receptive field of 7, matching a single $7 \times 7$ layer but with fewer parameters ($3 \times 9 = 27$ vs. $49$) and more nonlinearities.

### 3.7 Convolution as Matrix Multiplication

#### 3.7.1 Toeplitz Matrix (1D)

For a 1D input $\mathbf{x} \in \mathbb{R}^N$ and kernel $\mathbf{w} \in \mathbb{R}^K$ with stride 1 and no padding, the output $\mathbf{y} \in \mathbb{R}^{N - K + 1}$ can be written as $\mathbf{y} = \mathbf{T} \mathbf{x}$, where $\mathbf{T}$ is the Toeplitz matrix:

$$\mathbf{T} = \begin{pmatrix}
w_0 & w_1 & w_2 & \cdots & w_{K-1} & 0 & \cdots & 0 \\
0 & w_0 & w_1 & \cdots & w_{K-2} & w_{K-1} & \cdots & 0 \\
\vdots & & \ddots & & & & \ddots & \vdots \\
0 & \cdots & 0 & w_0 & w_1 & \cdots & & w_{K-1}
\end{pmatrix} \in \mathbb{R}^{(N-K+1) \times N}$$

Each row is a shifted copy of the kernel, reflecting weight sharing. The matrix is banded with bandwidth $K$.

#### 3.7.2 Doubly-Block-Toeplitz Matrix (2D)

For a 2D input $\mathbf{X} \in \mathbb{R}^{H \times W}$ (vectorized) and a 2D kernel $\mathbf{W} \in \mathbb{R}^{K_h \times K_w}$, the convolution can be expressed as $\text{vec}(\mathbf{Y}) = \mathbf{M} \, \text{vec}(\mathbf{X})$, where $\mathbf{M}$ is a doubly-block-Toeplitz matrix: it is block-Toeplitz with Toeplitz blocks. Each block corresponds to one row of the kernel applied across columns, and the blocks are arranged according to the kernel's rows.

#### 3.7.3 im2col Strategy

Rather than constructing the sparse Toeplitz matrix, practical implementations use the **im2col** (image-to-column) transformation:

1. For each output position $(i, j)$, extract the $C_{\text{in}} \times K_h \times K_w$ input patch and flatten it into a column vector of length $C_{\text{in}} K_h K_w$.
2. Stack all such columns to form a matrix $\mathbf{X}_{\text{col}} \in \mathbb{R}^{(C_{\text{in}} K_h K_w) \times (H_{\text{out}} W_{\text{out}})}$.
3. Reshape the filter bank into $\mathbf{W}_{\text{row}} \in \mathbb{R}^{C_{\text{out}} \times (C_{\text{in}} K_h K_w)}$.
4. Compute $\mathbf{Y}_{\text{col}} = \mathbf{W}_{\text{row}} \, \mathbf{X}_{\text{col}}$, a standard dense matrix multiply.
5. Reshape $\mathbf{Y}_{\text{col}}$ to $C_{\text{out}} \times H_{\text{out}} \times W_{\text{out}}$.

This trades memory (the unrolled matrix duplicates input values) for the ability to use highly optimized BLAS GEMM routines.

### 3.8 Stride, Padding, and Dilation

**Definition 3.9 (Stride).** Stride $s$ means the kernel moves $s$ positions between successive applications, subsampling the output.

**Definition 3.10 (Padding).** Zero-padding of $p$ pixels is added to each side of the input before convolution.

**Definition 3.11 (Dilation).** Dilation $d$ inserts $d - 1$ zeros between consecutive kernel elements, yielding an effective kernel size of $k + (k - 1)(d - 1) = d(k - 1) + 1$.

**Theorem 3.4 (Output Size Formula).** For input spatial size $H_{\text{in}}$, kernel size $k$, padding $p$, stride $s$, and dilation $d$:

$$H_{\text{out}} = \left\lfloor \frac{H_{\text{in}} + 2p - d(k - 1) - 1}{s} \right\rfloor + 1$$

The same formula applies independently to width.

*Proof.* After padding, the effective input size is $H_{\text{in}} + 2p$. The dilated kernel occupies $d(k-1) + 1$ positions. The first valid position is at index 0, and the last valid position is at index $H_{\text{in}} + 2p - [d(k-1) + 1]$. With stride $s$, the number of valid positions is:

$$\left\lfloor \frac{H_{\text{in}} + 2p - d(k-1) - 1}{s} \right\rfloor + 1$$

$\square$

**Common special cases:**
- "Same" padding ($s = 1$, $d = 1$): $p = \lfloor k/2 \rfloor$ gives $H_{\text{out}} = H_{\text{in}}$.
- "Valid" padding: $p = 0$, so $H_{\text{out}} = H_{\text{in}} - k + 1$ (for $s=1$, $d=1$).

---

## 4. Algorithmic Derivation

### 4.1 Naive 2D Convolution

```
Algorithm: Naive2DConv
Input: X ∈ R^{C_in × H × W}, W ∈ R^{C_out × C_in × K × K}, b ∈ R^{C_out}
       padding p, stride s, dilation d
Output: Y ∈ R^{C_out × H_out × W_out}

1.  H_out = floor((H + 2p - d(K-1) - 1) / s) + 1
2.  W_out = floor((W + 2p - d(K-1) - 1) / s) + 1
3.  X_pad = ZeroPad(X, p)
4.  for o = 0 to C_out - 1:
5.      for i = 0 to H_out - 1:
6.          for j = 0 to W_out - 1:
7.              acc = b[o]
8.              for c = 0 to C_in - 1:
9.                  for m = 0 to K - 1:
10.                     for n = 0 to K - 1:
11.                         acc += X_pad[c, i*s + m*d, j*s + n*d] * W[o, c, m, n]
12.             Y[o, i, j] = acc
13. return Y
```

**Complexity:** $O(C_{\text{out}} \cdot C_{\text{in}} \cdot K^2 \cdot H_{\text{out}} \cdot W_{\text{out}})$ multiply-adds.

### 4.2 im2col + GEMM

```
Algorithm: Im2ColConv
Input: X ∈ R^{C_in × H × W}, W ∈ R^{C_out × C_in × K × K}, b ∈ R^{C_out}
       padding p, stride s
Output: Y ∈ R^{C_out × H_out × W_out}

1.  Compute H_out, W_out
2.  X_pad = ZeroPad(X, p)
3.  // Im2col: extract patches
4.  X_col ∈ R^{(C_in · K · K) × (H_out · W_out)}
5.  col = 0
6.  for i = 0 to H_out - 1:
7.      for j = 0 to W_out - 1:
8.          X_col[:, col] = flatten(X_pad[:, i*s:i*s+K, j*s:j*s+K])
9.          col += 1
10. // Reshape filters
11. W_row = reshape(W, (C_out, C_in · K · K))
12. // GEMM
13. Y_col = W_row @ X_col + b[:, None]       // R^{C_out × (H_out · W_out)}
14. Y = reshape(Y_col, (C_out, H_out, W_out))
15. return Y
```

**Complexity:** Same FLOPs as naive, but GEMM achieves near-peak hardware utilization. Memory overhead: $O(C_{\text{in}} \cdot K^2 \cdot H_{\text{out}} \cdot W_{\text{out}})$ for the unrolled matrix.

---

## 5. PyTorch Implementation

### 5.1 Manual 2D Convolution (Cross-Correlation)

```python
import torch
import torch.nn.functional as F

def manual_conv2d(x: torch.Tensor, weight: torch.Tensor, bias: torch.Tensor = None,
                  stride: int = 1, padding: int = 0, dilation: int = 1) -> torch.Tensor:
    """
    Manual 2D convolution (cross-correlation) using unfold.

    Args:
        x: Input tensor of shape (N, C_in, H, W)
        weight: Kernel tensor of shape (C_out, C_in, K_h, K_w)
        bias: Optional bias of shape (C_out,)
        stride: Convolution stride
        padding: Zero-padding
        dilation: Kernel dilation

    Returns:
        Output tensor of shape (N, C_out, H_out, W_out)
    """
    N, C_in, H, W = x.shape                        # (N, C_in, H, W)
    C_out, C_in_k, K_h, K_w = weight.shape          # (C_out, C_in, K_h, K_w)
    assert C_in == C_in_k

    # Pad input
    if padding > 0:
        x = F.pad(x, [padding] * 4)                 # (N, C_in, H+2p, W+2p)

    H_pad, W_pad = x.shape[2], x.shape[3]
    ek_h = dilation * (K_h - 1) + 1                 # effective kernel height
    ek_w = dilation * (K_w - 1) + 1                 # effective kernel width
    H_out = (H_pad - ek_h) // stride + 1
    W_out = (W_pad - ek_w) // stride + 1

    # im2col via unfold
    # Unfold height dimension, then width dimension
    # Result: (N, C_in, K_h, K_w, H_out, W_out)
    patches = x.unfold(2, ek_h, stride).unfold(3, ek_w, stride)
    # Select dilated positions
    patches = patches[:, :, :, :, ::dilation, ::dilation]  # (N, C_in, H_out, W_out, K_h, K_w)

    # Reshape for matrix multiply
    patches = patches.contiguous().view(N, C_in * K_h * K_w, H_out * W_out)  # (N, C_in*K_h*K_w, H_out*W_out)
    w_row = weight.view(C_out, C_in * K_h * K_w)                              # (C_out, C_in*K_h*K_w)

    # GEMM: (C_out, C_in*K_h*K_w) @ (N, C_in*K_h*K_w, H_out*W_out)
    out = torch.bmm(w_row.unsqueeze(0).expand(N, -1, -1), patches)            # (N, C_out, H_out*W_out)
    out = out.view(N, C_out, H_out, W_out)                                     # (N, C_out, H_out, W_out)

    if bias is not None:
        out = out + bias.view(1, C_out, 1, 1)                                  # broadcast bias

    return out


# --- Verification against PyTorch ---
torch.manual_seed(42)
x = torch.randn(2, 3, 8, 8)          # (batch=2, channels=3, H=8, W=8)
w = torch.randn(16, 3, 3, 3)         # (C_out=16, C_in=3, K=3, K=3)
b = torch.randn(16)                   # (C_out=16,)

y_manual = manual_conv2d(x, w, b, stride=1, padding=1)
y_torch = F.conv2d(x, w, b, stride=1, padding=1)

print(f"Manual output shape: {y_manual.shape}")   # (2, 16, 8, 8)
print(f"PyTorch output shape: {y_torch.shape}")    # (2, 16, 8, 8)
print(f"Max absolute error: {(y_manual - y_torch).abs().max().item():.2e}")
# Expected: ~1e-6 (floating point)
```

### 5.2 Demonstrating Translation Equivariance

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

def demonstrate_equivariance():
    """
    Empirically verify: T_a(conv(x)) == conv(T_a(x))
    """
    torch.manual_seed(0)
    conv = nn.Conv2d(1, 1, kernel_size=3, padding=1, bias=False)

    # Input: single-channel 16x16 image
    x = torch.randn(1, 1, 16, 16)                         # (1, 1, 16, 16)

    # Translation: shift right by 3 pixels using circular padding
    shift = 3
    x_shifted = torch.roll(x, shifts=shift, dims=3)       # (1, 1, 16, 16)

    # Path 1: conv then shift
    y = conv(x)                                             # (1, 1, 16, 16)
    y_then_shift = torch.roll(y, shifts=shift, dims=3)     # (1, 1, 16, 16)

    # Path 2: shift then conv
    # Use circular padding to avoid boundary effects
    shift_then_y = conv(x_shifted)                          # (1, 1, 16, 16)

    # Interior comparison (avoid boundary effects from zero padding)
    interior = slice(2, -2)
    diff = (y_then_shift[:, :, interior, interior] -
            shift_then_y[:, :, interior, interior]).abs().max().item()

    print(f"Max difference (interior): {diff:.2e}")
    # Expected: ~1e-7 (numerical precision)

demonstrate_equivariance()
```

### 5.3 Visualizing the Toeplitz Structure

```python
import torch

def build_toeplitz_1d(kernel: torch.Tensor, input_size: int) -> torch.Tensor:
    """
    Build the Toeplitz matrix for 1D convolution.

    Args:
        kernel: 1D kernel of shape (K,)
        input_size: Length of input signal N

    Returns:
        Toeplitz matrix of shape (N - K + 1, N)
    """
    K = kernel.shape[0]
    output_size = input_size - K + 1
    T = torch.zeros(output_size, input_size)                # (N-K+1, N)

    for i in range(output_size):
        T[i, i:i+K] = kernel                                # place kernel at offset i

    return T

# Example
kernel = torch.tensor([1.0, 2.0, 3.0])                     # (K=3,)
x = torch.tensor([1.0, 4.0, 2.0, 5.0, 3.0])                # (N=5,)
T = build_toeplitz_1d(kernel, input_size=5)                  # (3, 5)

print("Toeplitz matrix:\n", T)
print("Matrix multiply result:", T @ x)                      # (3,)
print("Direct correlation:", torch.nn.functional.conv1d(
    x.view(1, 1, -1), kernel.view(1, 1, -1)).squeeze())     # (3,)
```

### 5.4 Receptive Field Computation

```python
def compute_receptive_field(layers: list[dict]) -> int:
    """
    Compute the receptive field of a stack of convolutional layers.

    Args:
        layers: List of dicts with keys 'k' (kernel), 's' (stride), 'd' (dilation).

    Returns:
        Receptive field size in input pixels.
    """
    r = 1
    for i, layer in enumerate(layers):
        k = layer['k']
        d = layer.get('d', 1)
        stride_product = 1
        for j in range(i):
            stride_product *= layers[j]['s']
        r += (k - 1) * d * stride_product
    return r

# VGG-style: 5 layers of 3x3, stride 1
vgg_layers = [{'k': 3, 's': 1, 'd': 1}] * 5
print(f"VGG 5x(3x3) receptive field: {compute_receptive_field(vgg_layers)}")
# Expected: 1 + 2*5 = 11

# ResNet-style: 7x7 stride 2, then 3x3 stride 1, 3x3 stride 1
resnet_layers = [
    {'k': 7, 's': 2, 'd': 1},
    {'k': 3, 's': 1, 'd': 1},
    {'k': 3, 's': 1, 'd': 1},
]
print(f"ResNet first 3 layers receptive field: {compute_receptive_field(resnet_layers)}")
# Expected: 1 + 6*1 + 2*2 + 2*2 = 15

# Dilated convolutions: 3 layers of 3x3, stride 1, dilation 1,2,4
dilated_layers = [
    {'k': 3, 's': 1, 'd': 1},
    {'k': 3, 's': 1, 'd': 2},
    {'k': 3, 's': 1, 'd': 4},
]
print(f"Dilated 3x(3x3) receptive field: {compute_receptive_field(dilated_layers)}")
# Expected: 1 + 2 + 4 + 8 = 15
```

---

## 6. Experimental Intuition

### 6.1 Kernel Size Ablations

| Kernel Size | Params (per layer, C=64) | Receptive Field (5 layers) | CIFAR-10 Acc |
|:-----------:|:------------------------:|:--------------------------:|:------------:|
| 3x3         | 36,864                   | 11                         | 93.2%        |
| 5x5         | 102,400                  | 21                         | 93.0%        |
| 7x7         | 200,704                  | 31                         | 92.5%        |

**Key insight:** Stacking small kernels is strictly preferable to large kernels: more nonlinearities, fewer parameters, same or better accuracy.

### 6.2 Padding Strategy

- **Zero padding** is standard but introduces border artifacts. First and last rows/columns of the output have weaker activations because they see fewer real input pixels.
- **Reflect padding** reduces border artifacts and can improve accuracy by ~0.1-0.3% on tasks sensitive to image boundaries.
- **Circular padding** is appropriate when the signal is genuinely periodic (e.g., panoramic images, angular data).

### 6.3 Failure Modes

1. **Aliasing from large strides:** Stride > kernel size creates gaps in the receptive field. Always ensure stride <= kernel size for the first layer.
2. **Excessive dilation:** Very large dilation factors create "gridding artifacts" — the kernel samples widely spaced points, missing local structure. Solution: mix dilated and non-dilated layers.
3. **Insufficient receptive field:** If the task requires global context (e.g., scene classification) and the receptive field is too small, the network cannot capture the necessary information. Solution: add more layers, use larger strides, or incorporate global average pooling.

### 6.4 Hyperparameter Guidance

- Start with 3x3 kernels throughout (the VGG/ResNet philosophy).
- Use stride-2 convolutions instead of max pooling for downsampling — learnable and often better.
- For the first layer on raw images, a larger kernel (5x5 or 7x7) with stride 2 can help capture low-frequency structure.
- Padding = k // 2 (for odd k) preserves spatial dimensions ("same" convolution).

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules
- **Module 01 (Foundations):** Convolution layers are composed with the nonlinearities and optimization techniques from Module 01. The gradient computations for convolution follow the same chain rule principles.

### 7.2 Links to Future Modules
- **Module 02b (Architectures):** The convolutional building block is assembled into deep architectures (ResNet, etc.).
- **Module 02c (Normalization):** Batch/layer normalization is inserted between conv layers.
- **Module 02d (Detection/Segmentation/ViT):** Convolutional features feed into task-specific heads. ViT replaces spatial convolution with self-attention, trading the translation equivariance prior for more flexibility.
- **Module 05 (Sequence Models):** 1D convolutions are used in temporal CNNs (TCN, WaveNet).

### 7.3 Extensions
- **Group equivariant CNNs (Cohen & Welling 2016):** Extend equivariance from translations to rotations, reflections via group convolutions.
- **Steerable CNNs (Cohen & Welling 2017):** Continuous rotation equivariance using steerable filters.
- **Deformable convolutions (Dai et al. 2017):** Learn spatial offsets for each kernel position, breaking the rigid grid structure.

---

## 8. Seminal Paper Reading List

### Required
1. Y. LeCun, B. Boser, J. S. Denker, D. Henderson, R. E. Howard, W. Hubbard, and L. D. Jackel. "Backpropagation Applied to Handwritten Zip Code Recognition." *Neural Computation*, 1(4):541-551, 1989.
2. T. S. Cohen and M. Welling. "Group Equivariant Convolutional Networks." *ICML*, 2016.

### Recommended
3. K. Fukushima. "Neocognitron: A Self-organizing Neural Network Model for a Mechanism of Pattern Recognition Unaffected by Shift in Position." *Biological Cybernetics*, 36(4):193-202, 1980.
4. V. Dumoulin and F. Visin. "A Guide to Convolution Arithmetic for Deep Learning." *arXiv:1603.07285*, 2016.
5. J. Dai, H. Qi, Y. Xiong, Y. Li, G. Zhang, H. Hu, and Y. Wei. "Deformable Convolutional Networks." *ICCV*, 2017.

---

## 9. Exercises

### Theory Exercises

**Exercise 3.1.** Prove that 2D convolution is equivariant under the full translation group $(\mathbb{Z}^2, +)$. Write out the proof for the multi-channel case (Definition 3.4).

**Exercise 3.2.** Show that max pooling with pool size $p$ and stride $p$ is *not* translation equivariant in general. Identify the precise condition under which equivariance holds (hint: consider translations that are multiples of $p$). Prove that max pooling is equivariant under the subgroup $p\mathbb{Z}^2 \subset \mathbb{Z}^2$.

**Exercise 3.3.** Derive the number of multiply-add operations (FLOPs) for a single convolutional layer with parameters $C_{\text{in}}, C_{\text{out}}, K, H_{\text{out}}, W_{\text{out}}$. Compare with the FLOPs of the equivalent fully connected layer.

**Exercise 3.4.** A network consists of: Conv(k=3, s=1, d=1), Conv(k=3, s=2, d=1), Conv(k=3, s=1, d=2), Conv(k=3, s=1, d=4). Compute the receptive field at the output.

**Exercise 3.5.** Prove Theorem 3.2 in full detail: that every bounded linear translation-equivariant operator on $\ell^2(\mathbb{Z})$ is a convolution. (Hint: use the decomposition $f = \sum_k f[k] \delta_k$ and the equivariance condition.)

### Implementation Exercises

**Exercise 3.6.** Implement the Toeplitz matrix construction for 2D convolution (doubly-block-Toeplitz). Verify that the matrix-vector product matches `F.conv2d` for a 1-channel, 8x8 input with a 3x3 kernel.

**Exercise 3.7.** Implement im2col from scratch (without using `unfold`). Benchmark your implementation against PyTorch's `F.conv2d` for various input and kernel sizes. Plot runtime vs. input size.

**Exercise 3.8.** Implement a function that, given a CNN architecture specification (list of layer configs), computes and visualizes the receptive field at each layer. Apply it to VGG-16 and ResNet-50.

**Exercise 3.9.** Implement 2D convolution using FFT (`torch.fft.fft2`). For what kernel sizes does FFT-based convolution become faster than direct convolution? (Hint: FFT convolution has complexity $O(HW \log(HW))$ regardless of kernel size.)

**Exercise 3.10.** Build a simple convolutional network and train it on MNIST. Then systematically destroy translation equivariance by using different kernels at different spatial positions (implement this). Show that the equivariant version generalizes better to translated test digits.
