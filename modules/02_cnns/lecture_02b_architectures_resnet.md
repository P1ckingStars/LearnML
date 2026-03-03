# Lecture 02b: CNN Architectures — From LeNet to ResNet

## 1. Learning Objectives

After completing this lecture, students will be able to:

1. Describe the architectural evolution from LeNet-5 through AlexNet, VGGNet, GoogLeNet, and ResNet, identifying the key innovation at each stage.
2. Derive the gradient flow equations through a residual block and prove that skip connections mitigate the vanishing gradient problem.
3. State and prove the result (Li et al., 2018) that residual connections smooth the loss landscape, formally in terms of Lipschitz continuity of the loss gradient.
4. Distinguish pre-activation and post-activation ResNet variants and explain when each is preferable.
5. Articulate architecture design principles: depth vs. width tradeoffs, kernel size selection, and computational budget allocation.

---

## 2. Motivation and Context

### 2.1 The Depth Revolution

The ImageNet Large Scale Visual Recognition Challenge (ILSVRC) drove rapid architectural innovation from 2012 to 2016:

| Year | Model       | Depth (layers) | Top-5 Error | Key Innovation                  |
|:----:|:-----------:|:--------------:|:-----------:|:-------------------------------:|
| 1998 | LeNet-5     | 5              | N/A         | Convolution + backprop          |
| 2012 | AlexNet     | 8              | 16.4%       | GPU training, ReLU, dropout     |
| 2014 | VGGNet      | 19             | 7.3%        | Small kernels, depth            |
| 2014 | GoogLeNet   | 22             | 6.7%        | Multi-scale (Inception)         |
| 2015 | ResNet      | 152            | 3.6%        | Skip connections                |

The central challenge: deeper networks should have greater representational capacity, but naive stacking of layers leads to degradation — deeper networks achieve *higher* training error than shallower ones. This is not overfitting (training error is worse); it is an optimization failure. ResNet's skip connections resolved this, enabling networks of unprecedented depth.

---

## 3. Core Theory

### 3.1 LeNet-5 (LeCun et al., 1998)

**Architecture:**

```
Input: 32x32 grayscale image
  -> Conv(6, 5x5, stride=1) -> Sigmoid -> AvgPool(2x2, stride=2)     => 6 x 14 x 14
  -> Conv(16, 5x5, stride=1) -> Sigmoid -> AvgPool(2x2, stride=2)    => 16 x 5 x 5
  -> Flatten -> FC(120) -> Sigmoid -> FC(84) -> Sigmoid -> FC(10)
```

**Parameter count:** ~60,000. Key contributions: (1) demonstrated that gradient-based learning could train multi-layer convolutional networks end-to-end, (2) introduced the pattern of alternating convolution and subsampling, (3) deployed commercially for check reading.

**Limitations:** Sigmoid activations saturate, average pooling discards discriminative information, shallow depth limits representational power.

### 3.2 AlexNet (Krizhevsky et al., 2012)

**Architecture:**

```
Input: 227x227x3 (note: often incorrectly stated as 224)
  -> Conv(96, 11x11, stride=4, pad=0) -> ReLU -> MaxPool(3x3, s=2) -> LRN
  -> Conv(256, 5x5, stride=1, pad=2) -> ReLU -> MaxPool(3x3, s=2) -> LRN
  -> Conv(384, 3x3, stride=1, pad=1) -> ReLU
  -> Conv(384, 3x3, stride=1, pad=1) -> ReLU
  -> Conv(256, 3x3, stride=1, pad=1) -> ReLU -> MaxPool(3x3, s=2)
  -> Flatten -> FC(4096) -> ReLU -> Dropout(0.5)
  -> FC(4096) -> ReLU -> Dropout(0.5)
  -> FC(1000)
```

**Parameter count:** ~61 million. **Key innovations:**

1. **ReLU activation:** $\text{ReLU}(x) = \max(0, x)$. Non-saturating gradient accelerates training by 6x vs. sigmoid.
2. **Dropout** (Srivastava et al., 2014): Randomly zero out units with probability $p = 0.5$ during training. Equivalent to training an ensemble of $2^n$ subnetworks.
3. **GPU training:** Split the network across two GTX 580 GPUs (3GB each).
4. **Data augmentation:** Random crops, horizontal flips, PCA color augmentation.
5. **Local Response Normalization (LRN):** Later shown to be unnecessary; replaced by batch normalization.

### 3.3 VGGNet (Simonyan & Zisserman, 2015)

**Core insight:** Replace large kernels with stacks of 3x3 kernels.

**Theorem 3.1 (Equivalence of Receptive Fields).** Two stacked 3x3 convolutions have a receptive field of 5x5, and three stacked 3x3 convolutions have a receptive field of 7x7.

*Proof.* By the receptive field recurrence from Lecture 02a: $r_L = 1 + 2L$ for $L$ layers of 3x3 with stride 1 and no dilation. For $L = 2$: $r_2 = 5$. For $L = 3$: $r_3 = 7$. $\square$

**Proposition 3.1 (Parameter Savings).** For $C$ channels, three 3x3 layers use $3 \times (C \times C \times 9) = 27C^2$ parameters, while a single 7x7 layer uses $C \times C \times 49 = 49C^2$ parameters. The savings factor is $49/27 \approx 1.8\times$, plus three nonlinearities instead of one.

**VGG-16 Architecture:**

```
2x Conv(64, 3x3)  -> MaxPool  => 64 x 112 x 112
2x Conv(128, 3x3) -> MaxPool  => 128 x 56 x 56
3x Conv(256, 3x3) -> MaxPool  => 256 x 28 x 28
3x Conv(512, 3x3) -> MaxPool  => 512 x 14 x 14
3x Conv(512, 3x3) -> MaxPool  => 512 x 7 x 7
Flatten -> FC(4096) -> FC(4096) -> FC(1000)
```

**Parameter count:** ~138 million (most in FC layers).

### 3.4 GoogLeNet / Inception (Szegedy et al., 2015)

**Key insight:** Different spatial scales of features are useful simultaneously. Instead of choosing a single kernel size, apply multiple in parallel.

**Inception Module:**

```
Input (C_in channels)
  |--- 1x1 Conv(a) ---------------------------------> |
  |--- 1x1 Conv(b) -> 3x3 Conv(c) -----------------> | Concatenate along channels
  |--- 1x1 Conv(d) -> 5x5 Conv(e) -----------------> |
  |--- 3x3 MaxPool -> 1x1 Conv(f) -----------------> |
Output: (a + c + e + f) channels
```

The 1x1 convolutions serve as **bottleneck layers**, reducing channel dimensionality before expensive 3x3 and 5x5 operations.

**Proposition 3.2 (1x1 Bottleneck Savings).** Consider applying a 5x5 convolution to a 256-channel input producing 128 channels. Direct: $256 \times 128 \times 25 = 819,200$ parameters. With a 1x1 bottleneck reducing to 32 channels first: $256 \times 32 \times 1 + 32 \times 128 \times 25 = 8,192 + 102,400 = 110,592$ parameters. Savings: $7.4\times$.

**GoogLeNet parameter count:** ~6.8 million — far fewer than VGG despite being deeper, due to aggressive use of bottlenecks and replacing FC layers with global average pooling.

### 3.5 ResNet (He et al., 2016a)

#### 3.5.1 The Degradation Problem

**Observation (He et al.):** A 56-layer plain CNN has *higher training error* than a 20-layer plain CNN on CIFAR-10. This is not overfitting — it is an optimization failure. A deeper network could, in principle, learn the identity for the extra layers and match the shallower network. That it fails to do so indicates that identity mappings are hard to learn with standard architectures.

#### 3.5.2 Residual Learning Framework

**Definition 3.1 (Residual Block).** Let $\mathbf{x}$ be the input to a block and $\mathcal{F}(\mathbf{x}; \theta)$ be the output of a stack of layers (e.g., two 3x3 convolutions with BN and ReLU). A residual block computes:

$$\mathbf{y} = \mathcal{F}(\mathbf{x}; \theta) + \mathbf{x}$$

The function $\mathcal{F}$ learns the *residual* mapping: the deviation from identity. If the optimal mapping is close to identity, $\mathcal{F}$ only needs to learn a small perturbation, which is easier than learning the full mapping from scratch.

**When spatial dimensions change** (stride > 1 or channel mismatch), a projection shortcut is used:

$$\mathbf{y} = \mathcal{F}(\mathbf{x}; \theta) + W_s \mathbf{x}$$

where $W_s$ is typically a 1x1 convolution with appropriate stride.

#### 3.5.3 Gradient Flow Analysis

**Theorem 3.2 (Gradient Flow Through Residual Networks).** Consider a residual network with $L$ blocks, where the output of block $\ell$ is:

$$\mathbf{x}_{\ell+1} = \mathbf{x}_\ell + \mathcal{F}_\ell(\mathbf{x}_\ell)$$

Unrolling the recursion from block $\ell$ to block $L$:

$$\mathbf{x}_L = \mathbf{x}_\ell + \sum_{i=\ell}^{L-1} \mathcal{F}_i(\mathbf{x}_i)$$

The gradient of the loss $\mathcal{L}$ with respect to $\mathbf{x}_\ell$ is:

$$\frac{\partial \mathcal{L}}{\partial \mathbf{x}_\ell} = \frac{\partial \mathcal{L}}{\partial \mathbf{x}_L} \cdot \frac{\partial \mathbf{x}_L}{\partial \mathbf{x}_\ell} = \frac{\partial \mathcal{L}}{\partial \mathbf{x}_L} \left( \mathbf{I} + \frac{\partial}{\partial \mathbf{x}_\ell} \sum_{i=\ell}^{L-1} \mathcal{F}_i(\mathbf{x}_i) \right)$$

*Proof.* By the chain rule applied to the unrolled expression:

$$\frac{\partial \mathbf{x}_L}{\partial \mathbf{x}_\ell} = \frac{\partial}{\partial \mathbf{x}_\ell}\left(\mathbf{x}_\ell + \sum_{i=\ell}^{L-1} \mathcal{F}_i(\mathbf{x}_i)\right)$$

The first term gives $\mathbf{I}$ (the identity matrix). For the sum, by the chain rule:

$$\frac{\partial}{\partial \mathbf{x}_\ell} \sum_{i=\ell}^{L-1} \mathcal{F}_i(\mathbf{x}_i) = \sum_{i=\ell}^{L-1} \frac{\partial \mathcal{F}_i(\mathbf{x}_i)}{\partial \mathbf{x}_\ell}$$

Each term $\frac{\partial \mathcal{F}_i}{\partial \mathbf{x}_\ell}$ involves a product of Jacobians through intermediate blocks. However, crucially:

$$\frac{\partial \mathcal{L}}{\partial \mathbf{x}_\ell} = \frac{\partial \mathcal{L}}{\partial \mathbf{x}_L} + \frac{\partial \mathcal{L}}{\partial \mathbf{x}_L} \cdot \frac{\partial}{\partial \mathbf{x}_\ell} \sum_{i=\ell}^{L-1} \mathcal{F}_i(\mathbf{x}_i)$$

The term $\frac{\partial \mathcal{L}}{\partial \mathbf{x}_L}$ propagates directly to every layer without multiplicative decay. In a plain network, the gradient must pass through all intermediate Jacobians multiplicatively:

$$\frac{\partial \mathcal{L}}{\partial \mathbf{x}_\ell} = \frac{\partial \mathcal{L}}{\partial \mathbf{x}_L} \prod_{i=\ell}^{L-1} \frac{\partial \mathbf{x}_{i+1}}{\partial \mathbf{x}_i}$$

If any Jacobian $\frac{\partial \mathbf{x}_{i+1}}{\partial \mathbf{x}_i}$ has spectral radius less than 1, the product vanishes exponentially in $L - \ell$. The additive identity in the residual case prevents this. $\square$

**Corollary 3.1.** Even if $\frac{\partial \mathcal{F}_i}{\partial \mathbf{x}_i}$ is small for some layers (e.g., near-zero weights), the gradient $\frac{\partial \mathcal{L}}{\partial \mathbf{x}_\ell}$ has a direct additive component $\frac{\partial \mathcal{L}}{\partial \mathbf{x}_L}$ that does not vanish. This is the fundamental reason residual networks can be trained to much greater depths.

#### 3.5.4 Loss Landscape Smoothing

**Theorem 3.3 (Informal, Li et al. 2018).** The loss surface of residual networks is significantly smoother than that of plain networks. Specifically, for a residual network, the loss function has a more Lipschitz-continuous gradient: there exists a smaller constant $\beta$ such that:

$$\|\nabla \mathcal{L}(\theta_1) - \nabla \mathcal{L}(\theta_2)\| \leq \beta \|\theta_1 - \theta_2\|$$

*Proof sketch.* Consider the Hessian $\mathbf{H} = \nabla^2 \mathcal{L}(\theta)$. For a plain network of depth $L$, the Hessian norm can grow exponentially with depth because the loss involves products of $L$ weight matrices. For a residual network, each block computes $\mathbf{I} + \mathcal{F}_\ell$, so the relevant operator is:

$$\prod_{\ell=1}^{L}(\mathbf{I} + J_\ell) \quad \text{vs.} \quad \prod_{\ell=1}^{L} J_\ell$$

where $J_\ell = \frac{\partial \mathcal{F}_\ell}{\partial \mathbf{x}_\ell}$ is the Jacobian. If $\|J_\ell\| < 1$, the plain network product vanishes, while the residual product remains $O(1)$ due to the identity. More importantly, the eigenvalue spectrum of the residual Hessian is more concentrated around zero, leading to a smoother landscape with fewer sharp minima and saddle points. $\square$

This smoothness means that gradient descent with larger learning rates converges reliably, and the loss function has fewer pathological local minima.

#### 3.5.5 ResNet Architecture Details

**Basic Block (ResNet-18/34):**
$$\mathcal{F}(\mathbf{x}) = W_2 \cdot \text{ReLU}(\text{BN}(W_1 \cdot \mathbf{x}))$$

where $W_1, W_2$ are 3x3 convolutions with batch normalization.

**Bottleneck Block (ResNet-50/101/152):**
$$\mathcal{F}(\mathbf{x}) = W_3^{1\times1} \cdot \text{ReLU}(\text{BN}(W_2^{3\times3} \cdot \text{ReLU}(\text{BN}(W_1^{1\times1} \cdot \mathbf{x}))))$$

The 1x1 convolutions reduce and restore channel dimensions, making the 3x3 convolution operate on a smaller channel count (typically 4x reduction).

**ResNet-50 Architecture:**

```
Conv(64, 7x7, stride=2) -> BN -> ReLU -> MaxPool(3x3, stride=2)  => 64 x 56 x 56
Stage 1: 3 x Bottleneck(64, 64, 256)                              => 256 x 56 x 56
Stage 2: 4 x Bottleneck(128, 128, 512), first stride=2            => 512 x 28 x 28
Stage 3: 6 x Bottleneck(256, 256, 1024), first stride=2           => 1024 x 14 x 14
Stage 4: 3 x Bottleneck(512, 512, 2048), first stride=2           => 2048 x 7 x 7
Global Average Pool -> FC(1000)
```

**Parameter count:** ~25.6 million.

### 3.6 Pre-Activation ResNet (He et al., 2016b)

**Definition 3.2 (Pre-Activation Residual Block).** Instead of Conv -> BN -> ReLU (post-activation), use BN -> ReLU -> Conv:

$$\mathbf{y} = \mathbf{x} + \text{Conv}_2(\text{ReLU}(\text{BN}_2(\text{Conv}_1(\text{ReLU}(\text{BN}_1(\mathbf{x}))))))$$

**Theorem 3.4 (Clean Information Path).** In pre-activation ResNet, the skip connection carries the unmodified input: $\mathbf{x}_{L} = \mathbf{x}_0 + \sum_{\ell=0}^{L-1} \mathcal{F}_\ell(\hat{\mathbf{x}}_\ell)$, where $\hat{\mathbf{x}}_\ell$ is the pre-activated input. This means:

$$\frac{\partial \mathbf{x}_L}{\partial \mathbf{x}_0} = \mathbf{I} + \ldots$$

The identity component is exact — no BN or ReLU on the skip path can distort it.

*Proof.* In post-activation ResNet, the output is $\mathbf{x}_{\ell+1} = \text{ReLU}(\mathbf{x}_\ell + \mathcal{F}_\ell(\mathbf{x}_\ell))$. The ReLU on the combined signal means $\frac{\partial \mathbf{x}_{\ell+1}}{\partial \mathbf{x}_\ell} = \text{diag}(\mathbf{1}[\mathbf{x}_\ell + \mathcal{F}_\ell(\mathbf{x}_\ell) > 0]) \cdot (\mathbf{I} + J_\ell)$. The diagonal masking matrix can kill gradient components. In pre-activation ResNet, $\mathbf{x}_{\ell+1} = \mathbf{x}_\ell + \mathcal{F}_\ell(\text{BN-ReLU}(\mathbf{x}_\ell))$, so $\frac{\partial \mathbf{x}_{\ell+1}}{\partial \mathbf{x}_\ell} = \mathbf{I} + \frac{\partial \mathcal{F}_\ell}{\partial \mathbf{x}_\ell}$. The identity is clean. $\square$

Empirically, pre-activation ResNet achieves lower error on CIFAR-10/100 and ImageNet, especially for very deep networks (1001 layers).

### 3.7 DenseNet (Huang et al., 2017)

**Definition 3.3 (Dense Block).** In a dense block, each layer receives as input the concatenation of all previous layers' feature maps:

$$\mathbf{x}_\ell = H_\ell([\mathbf{x}_0, \mathbf{x}_1, \ldots, \mathbf{x}_{\ell-1}])$$

where $[\cdot]$ denotes channel-wise concatenation and $H_\ell$ is BN -> ReLU -> Conv(growth_rate, 3x3).

**Growth rate** $k$: Each layer produces $k$ new feature maps. After $\ell$ layers in a dense block, the total channels are $k_0 + \ell \cdot k$, where $k_0$ is the initial channel count.

**Advantages:** (1) Maximal gradient flow — every layer has direct access to the loss gradient. (2) Feature reuse — later layers can access primitive features from early layers. (3) Compact models — typical growth rate $k = 12$ or $32$.

### 3.8 Architecture Design Principles

**Principle 1: Computational Budget Allocation.** Most FLOPs should be spent at the intermediate spatial resolutions, not the largest or smallest. ResNet-50 allocates 6 blocks to the 14x14 stage but only 3 to 56x56 and 3 to 7x7.

**Principle 2: Width vs. Depth.** For a fixed parameter budget, there is an optimal balance. Wide ResNets (Zagoruyko & Komodakis, 2016) showed that a 16-layer network with 10x width multiplier outperforms a 1000-layer thin ResNet on CIFAR.

**Principle 3: Downsampling Strategy.** Halve spatial dimensions while doubling channels to maintain approximately constant computational cost per layer:

$$\text{FLOPs} \propto C^2 \cdot K^2 \cdot H \cdot W$$

If $H, W \to H/2, W/2$ and $C \to 2C$, FLOPs change by $(2C)^2 \times (H/2)(W/2) / (C^2 \times HW) = 1$ (constant).

**Principle 4: Use Global Average Pooling.** Replace the FC classifier head with global average pooling + single FC layer. This dramatically reduces parameters and acts as a structural regularizer.

---

## 4. Algorithmic Derivation

### 4.1 ResNet Forward Pass

```
Algorithm: ResNetForward
Input: Image x ∈ R^{3 × 224 × 224}, network parameters θ
Output: Class logits ∈ R^{num_classes}

1.  h = ReLU(BN(Conv7x7_stride2(x)))          // R^{64 × 112 × 112}
2.  h = MaxPool3x3_stride2(h)                   // R^{64 × 56 × 56}
3.  for stage s = 1 to 4:
4.      for block b = 1 to num_blocks[s]:
5.          residual = h
6.          if b == 1 and s > 1:
7.              residual = Conv1x1_stride2(residual)  // downsample
8.          h = BN(Conv3x3(ReLU(BN(Conv3x3(h)))))
9.          h = ReLU(h + residual)
10. h = GlobalAveragePool(h)                     // R^{C}
11. logits = FC(h)                               // R^{num_classes}
12. return logits
```

**Complexity (ResNet-50):** ~4.1 GFLOPs (single 224x224 input). Memory: ~100MB activations at batch size 1.

### 4.2 Residual Block Backward Pass

For a residual block $\mathbf{y} = \text{ReLU}(\mathbf{x} + \mathcal{F}(\mathbf{x}))$:

```
Algorithm: ResidualBlockBackward
Input: grad_output dy, saved activations x, F(x)
Output: grad_input dx, grad_params dθ

1.  // Backward through ReLU
2.  mask = (x + F(x)) > 0
3.  dy_pre = dy * mask

4.  // Split gradient: skip connection + residual path
5.  dx_skip = dy_pre                         // identity gradient
6.  dF = dy_pre                              // residual gradient

7.  // Backward through F (two conv layers with BN, ReLU)
8.  [dx_residual, dθ] = backward_through_F(dF, saved_activations)

9.  // Sum gradients from both paths
10. dx = dx_skip + dx_residual

11. return dx, dθ
```

The key line is step 5: `dx_skip = dy_pre`. The gradient flows directly through the identity connection without any multiplicative transformation.

---

## 5. PyTorch Implementation

### 5.1 Basic Residual Block

```python
import torch
import torch.nn as nn

class BasicBlock(nn.Module):
    """
    Basic residual block for ResNet-18/34.
    Two 3x3 conv layers with skip connection.
    """
    expansion = 1

    def __init__(self, in_channels: int, out_channels: int, stride: int = 1,
                 downsample: nn.Module = None):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, kernel_size=3,
                               stride=stride, padding=1, bias=False)      # no bias before BN
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.conv2 = nn.Conv2d(out_channels, out_channels, kernel_size=3,
                               stride=1, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.downsample = downsample

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input tensor of shape (N, C_in, H, W)
        Returns:
            Output tensor of shape (N, C_out, H', W')
        """
        identity = x                                    # (N, C_in, H, W)

        out = self.conv1(x)                              # (N, C_out, H', W')
        out = self.bn1(out)                              # (N, C_out, H', W')
        out = self.relu(out)                             # (N, C_out, H', W')

        out = self.conv2(out)                            # (N, C_out, H', W')
        out = self.bn2(out)                              # (N, C_out, H', W')

        if self.downsample is not None:
            identity = self.downsample(x)                # (N, C_out, H', W')

        out += identity                                  # skip connection
        out = self.relu(out)                             # (N, C_out, H', W')
        return out
```

### 5.2 Bottleneck Block

```python
class Bottleneck(nn.Module):
    """
    Bottleneck residual block for ResNet-50/101/152.
    1x1 -> 3x3 -> 1x1 with skip connection.
    """
    expansion = 4

    def __init__(self, in_channels: int, mid_channels: int, stride: int = 1,
                 downsample: nn.Module = None):
        super().__init__()
        out_channels = mid_channels * self.expansion
        self.conv1 = nn.Conv2d(in_channels, mid_channels, kernel_size=1,
                               bias=False)                                  # reduce channels
        self.bn1 = nn.BatchNorm2d(mid_channels)
        self.conv2 = nn.Conv2d(mid_channels, mid_channels, kernel_size=3,
                               stride=stride, padding=1, bias=False)        # spatial conv
        self.bn2 = nn.BatchNorm2d(mid_channels)
        self.conv3 = nn.Conv2d(mid_channels, out_channels, kernel_size=1,
                               bias=False)                                  # restore channels
        self.bn3 = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        self.downsample = downsample

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        identity = x                                     # (N, C_in, H, W)

        out = self.relu(self.bn1(self.conv1(x)))         # (N, mid, H, W)
        out = self.relu(self.bn2(self.conv2(out)))        # (N, mid, H', W')
        out = self.bn3(self.conv3(out))                   # (N, C_out, H', W')

        if self.downsample is not None:
            identity = self.downsample(x)                 # (N, C_out, H', W')

        out += identity
        out = self.relu(out)                              # (N, C_out, H', W')
        return out
```

### 5.3 Full ResNet

```python
class ResNet(nn.Module):
    """
    Full ResNet implementation.

    Args:
        block: BasicBlock or Bottleneck
        layers: List of block counts per stage, e.g. [2,2,2,2] for ResNet-18
        num_classes: Number of output classes
    """
    def __init__(self, block, layers: list[int], num_classes: int = 1000):
        super().__init__()
        self.in_channels = 64

        # Stem
        self.conv1 = nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3,
                               bias=False)                              # (N, 64, 112, 112)
        self.bn1 = nn.BatchNorm2d(64)
        self.relu = nn.ReLU(inplace=True)
        self.maxpool = nn.MaxPool2d(kernel_size=3, stride=2, padding=1) # (N, 64, 56, 56)

        # Stages
        self.layer1 = self._make_layer(block, 64, layers[0], stride=1)
        self.layer2 = self._make_layer(block, 128, layers[1], stride=2)
        self.layer3 = self._make_layer(block, 256, layers[2], stride=2)
        self.layer4 = self._make_layer(block, 512, layers[3], stride=2)

        # Head
        self.avgpool = nn.AdaptiveAvgPool2d((1, 1))
        self.fc = nn.Linear(512 * block.expansion, num_classes)

        # Kaiming initialization
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)

    def _make_layer(self, block, mid_channels: int, num_blocks: int,
                    stride: int) -> nn.Sequential:
        downsample = None
        out_channels = mid_channels * block.expansion

        if stride != 1 or self.in_channels != out_channels:
            downsample = nn.Sequential(
                nn.Conv2d(self.in_channels, out_channels, kernel_size=1,
                          stride=stride, bias=False),
                nn.BatchNorm2d(out_channels),
            )

        layers = [block(self.in_channels, mid_channels, stride, downsample)]
        self.in_channels = out_channels
        for _ in range(1, num_blocks):
            layers.append(block(self.in_channels, mid_channels))

        return nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input image tensor of shape (N, 3, 224, 224)
        Returns:
            Logits of shape (N, num_classes)
        """
        x = self.relu(self.bn1(self.conv1(x)))          # (N, 64, 112, 112)
        x = self.maxpool(x)                               # (N, 64, 56, 56)

        x = self.layer1(x)                                # (N, 256, 56, 56)  for ResNet-50
        x = self.layer2(x)                                # (N, 512, 28, 28)
        x = self.layer3(x)                                # (N, 1024, 14, 14)
        x = self.layer4(x)                                # (N, 2048, 7, 7)

        x = self.avgpool(x)                               # (N, 2048, 1, 1)
        x = torch.flatten(x, 1)                           # (N, 2048)
        x = self.fc(x)                                    # (N, num_classes)
        return x

def resnet18(num_classes=1000):
    return ResNet(BasicBlock, [2, 2, 2, 2], num_classes)

def resnet50(num_classes=1000):
    return ResNet(Bottleneck, [3, 4, 6, 3], num_classes)

# Verification
model = resnet50(num_classes=100)
x = torch.randn(2, 3, 224, 224)
y = model(x)
print(f"Input shape:  {x.shape}")    # (2, 3, 224, 224)
print(f"Output shape: {y.shape}")    # (2, 100)
print(f"Parameters:   {sum(p.numel() for p in model.parameters()):,}")
# ResNet-50 with 100 classes: ~23.7M parameters
```

### 5.4 Gradient Flow Visualization

```python
import torch
import torch.nn as nn
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def compare_gradient_flow(depth: int = 20, width: int = 64):
    """
    Compare gradient norms in plain vs. residual networks.
    """

    # Plain network
    class PlainNet(nn.Module):
        def __init__(self):
            super().__init__()
            layers = [nn.Conv2d(3, width, 3, padding=1), nn.ReLU()]
            for _ in range(depth - 1):
                layers += [nn.Conv2d(width, width, 3, padding=1), nn.ReLU()]
            layers += [nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Linear(width, 10)]
            self.net = nn.Sequential(*layers)

        def forward(self, x):
            return self.net(x)

    # Residual network
    class ResidualNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.stem = nn.Sequential(nn.Conv2d(3, width, 3, padding=1), nn.ReLU())
            self.blocks = nn.ModuleList()
            for _ in range(depth - 1):
                self.blocks.append(nn.Sequential(
                    nn.Conv2d(width, width, 3, padding=1), nn.ReLU()
                ))
            self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(),
                                      nn.Linear(width, 10))

        def forward(self, x):
            x = self.stem(x)
            for block in self.blocks:
                x = x + block(x)               # residual connection
            return self.head(x)

    x = torch.randn(4, 3, 32, 32)
    target = torch.randint(0, 10, (4,))

    grad_norms = {}
    for name, Net in [("Plain", PlainNet), ("Residual", ResidualNet)]:
        model = Net()
        loss = nn.CrossEntropyLoss()(model(x), target)
        loss.backward()

        norms = []
        for p in model.parameters():
            if p.grad is not None and p.dim() == 4:    # conv weights only
                norms.append(p.grad.norm().item())
        grad_norms[name] = norms

    fig, ax = plt.subplots(1, 1, figsize=(10, 5))
    ax.semilogy(grad_norms["Plain"], label="Plain Network", marker='o', markersize=3)
    ax.semilogy(grad_norms["Residual"], label="Residual Network", marker='s', markersize=3)
    ax.set_xlabel("Layer index")
    ax.set_ylabel("Gradient norm (log scale)")
    ax.set_title(f"Gradient flow comparison (depth={depth})")
    ax.legend()
    plt.tight_layout()
    plt.savefig("gradient_flow_comparison.png", dpi=150)
    print("Saved gradient_flow_comparison.png")

compare_gradient_flow(depth=30)
```

---

## 6. Experimental Intuition

### 6.1 Depth vs. Accuracy (with and without skip connections)

| Architecture        | Depth | CIFAR-10 Test Error | Training Converges? |
|:-------------------:|:-----:|:-------------------:|:-------------------:|
| Plain-20            | 20    | 8.75%               | Yes                 |
| Plain-56            | 56    | 9.90%               | Slow                |
| Plain-110           | 110   | Diverges            | No                  |
| ResNet-20           | 20    | 8.42%               | Yes                 |
| ResNet-56           | 56    | 6.97%               | Yes                 |
| ResNet-110          | 110   | 6.43%               | Yes                 |
| ResNet-1202         | 1202  | 7.93%               | Yes (overfitting)   |

**Key observations:** (1) Plain networks degrade with depth even on training set. (2) ResNets consistently improve with depth up to a point. (3) Very deep ResNets (1202) overfit — regularization becomes the bottleneck.

### 6.2 Architecture Choice Heuristics

- **Small dataset (CIFAR-10/100):** ResNet-18 or WideResNet-28-10. Deeper models overfit.
- **Medium dataset (ImageNet):** ResNet-50 is the standard baseline. ResNet-101 gives ~0.5% improvement.
- **Transfer learning:** ResNet-50 pretrained on ImageNet is the most common feature extractor. Fine-tune with a small learning rate (1/10 to 1/100 of the head LR).
- **Compute-limited:** Use fewer channels (width multiplier < 1) rather than fewer layers.

### 6.3 Common Failure Modes

1. **Forgetting the projection shortcut:** When spatial dimensions change, the skip connection must downsample. Forgetting this causes dimension mismatches.
2. **BN before or after addition:** Post-activation BN (standard ResNet) works well; applying BN after the addition but before ReLU is suboptimal for very deep networks (use pre-activation).
3. **Zero initialization trap:** If all residual branches are initialized to zero, the network initially behaves as identity — gradients flow but there is no learning signal. In practice, Kaiming initialization provides sufficient initial gradient magnitude.

---

## 7. Connections and Extensions

### 7.1 Prior Modules

- **Module 01:** Optimization (SGD, momentum, Adam) is critical for training deep architectures. Weight initialization (Kaiming) depends on the analysis from Module 01.
- **Lecture 02a:** The convolutional layers within each residual block follow the theory of equivariance and receptive fields.

### 7.2 Future Modules

- **Lecture 02c:** Batch normalization is integral to ResNet; its analysis follows next.
- **Lecture 02d:** ResNet serves as the backbone for detection (Faster R-CNN) and segmentation (U-Net, FPN).
- **Module 04 (Transformers):** The attention mechanism can be seen as a generalization of the skip connection pattern. ViT replaces convolutions with self-attention but retains residual connections.

### 7.3 Extensions

- **ResNeXt (Xie et al., 2017):** Grouped convolutions within residual blocks — "cardinality" as a new dimension alongside depth and width.
- **Squeeze-and-Excitation Networks (Hu et al., 2018):** Channel attention modules recalibrate feature responses.
- **EfficientNet (Tan & Le, 2019):** Compound scaling of depth, width, and resolution using neural architecture search.

---

## 8. Seminal Paper Reading List

### Required

1. K. He, X. Zhang, S. Ren, and J. Sun. "Deep Residual Learning for Image Recognition." *CVPR*, 2016a.
2. K. He, X. Zhang, S. Ren, and J. Sun. "Identity Mappings in Deep Residual Networks." *ECCV*, 2016b.

### Recommended

3. Y. LeCun, L. Bottou, Y. Bengio, and P. Haffner. "Gradient-Based Learning Applied to Document Recognition." *Proceedings of the IEEE*, 86(11):2278-2324, 1998.
4. A. Krizhevsky, I. Sutskever, and G. E. Hinton. "ImageNet Classification with Deep Convolutional Neural Networks." *NeurIPS*, 2012.
5. K. Simonyan and A. Zisserman. "Very Deep Convolutional Networks for Large-Scale Image Recognition." *ICLR*, 2015.
6. C. Szegedy, W. Liu, Y. Jia, P. Sermanet, S. Reed, D. Anguelov, D. Erhan, V. Vanhoucke, and A. Rabinovich. "Going Deeper with Convolutions." *CVPR*, 2015.
7. H. Li, Z. Xu, G. Taylor, C. Studer, and T. Goldstein. "Visualizing the Loss Landscape of Neural Nets." *NeurIPS*, 2018.
8. G. Huang, Z. Liu, L. van der Maaten, and K. Q. Weinberger. "Densely Connected Convolutional Networks." *CVPR*, 2017.

---

## 9. Exercises

### Theory Exercises

**Exercise 3.1.** Consider a plain network $x_{L} = \prod_{\ell=1}^{L} W_\ell x_0$ and a residual network $x_{L} = x_0 + \sum_{\ell=1}^{L} \mathcal{F}_\ell(x_{\ell-1})$. Assume each $W_\ell$ has singular values in $[0.5, 1.5]$ and each Jacobian $J_\ell = \frac{\partial \mathcal{F}_\ell}{\partial x_\ell}$ has spectral norm bounded by 0.5. Compare the gradient norms $\|\frac{\partial x_L}{\partial x_0}\|$ for both networks when $L = 50$.

**Exercise 3.2.** Prove that the number of FLOPs in a bottleneck block with input channels $C$, bottleneck width $C/4$, and spatial dimensions $H \times W$ is approximately $\frac{17}{4} C^2 HW$. Compare with a basic block.

**Exercise 3.3.** Show that DenseNet with $L$ layers and growth rate $k$ has $O(L^2 k)$ channel dimensions at the final layer. Derive the total parameter count for a dense block and compare with the equivalent ResNet block.

**Exercise 3.4.** In pre-activation ResNet, prove that the gradient $\frac{\partial \mathcal{L}}{\partial x_\ell}$ contains a term $\frac{\partial \mathcal{L}}{\partial x_L}$ that is *exactly* the identity (not scaled or masked by any nonlinearity).

### Implementation Exercises

**Exercise 3.5.** Implement ResNet-18 from scratch (no `torchvision.models`). Train on CIFAR-10 and reproduce the ~93% test accuracy reported in the literature.

**Exercise 3.6.** Implement a "plain" version of your ResNet-18 (remove all skip connections). Train both on CIFAR-10 and plot: (a) training loss curves, (b) test accuracy curves, (c) gradient norms per layer at initialization and after 1 epoch.

**Exercise 3.7.** Implement WideResNet-28-10 and compare with ResNet-28 (same depth, standard width). Report accuracy, training time, and parameter count.

**Exercise 3.8.** Implement the Inception module and build a small Inception network for CIFAR-10. Compare FLOPs and accuracy with ResNet-18.

**Exercise 3.9.** Reproduce the loss landscape visualization from Li et al. (2018): for a trained ResNet-20 and a trained plain-20 on CIFAR-10, plot the loss along random directions in parameter space. Use the filter-normalized direction method.
