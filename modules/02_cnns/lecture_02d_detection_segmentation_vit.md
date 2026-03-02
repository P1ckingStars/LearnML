# Lecture 02d: Detection, Segmentation, and Vision Transformers

## 1. Learning Objectives

After completing this lecture, students will be able to:

1. Trace the evolution of object detection from R-CNN through Fast R-CNN to Faster R-CNN, identifying the computational bottleneck resolved at each stage.
2. Derive the anchor box mechanism and the loss function for Region Proposal Networks (RPNs).
3. Explain Feature Pyramid Networks (FPN) and why multi-scale feature representation is essential for detecting objects at varying sizes.
4. Describe the architecture of Fully Convolutional Networks (FCN) and U-Net for semantic segmentation, proving that the decoder path recovers spatial resolution.
5. Derive the Vision Transformer (ViT) architecture from first principles: patch embedding, positional encoding, and self-attention over image patches.
6. Compare the inductive biases of CNNs (locality, translation equivariance) with those of ViT (global receptive field, permutation equivariance with learned position) and articulate when each is preferred.

---

## 2. Motivation and Context

### 2.1 Beyond Classification

Image classification assigns a single label to an entire image. Real-world vision requires more:

- **Object detection:** Localize and classify multiple objects via bounding boxes.
- **Semantic segmentation:** Assign a class label to every pixel.
- **Instance segmentation:** Distinguish individual object instances at the pixel level.

These tasks demand architectures that preserve spatial information while capturing semantic meaning at multiple scales.

### 2.2 The Rise of Vision Transformers

The success of Transformers in NLP (Vaswani et al., 2017) prompted the question: can self-attention replace convolution for vision? Dosovitskiy et al. (2021) showed that with sufficient data, a pure transformer (ViT) matches or exceeds CNNs. This challenged the assumption that spatial inductive biases are necessary and sparked a productive dialogue between CNN and transformer design, culminating in hybrid architectures like ConvNeXt.

---

## 3. Core Theory

### 3.1 Object Detection: The R-CNN Family

#### 3.1.1 R-CNN (Girshick et al., 2014)

**Pipeline:**
1. **Region proposals:** Use Selective Search to generate ~2,000 candidate regions per image.
2. **Feature extraction:** Warp each region to 227x227 and pass through AlexNet to obtain a 4096-dim feature vector.
3. **Classification:** Train a linear SVM per class on the features.
4. **Bounding box regression:** Train a linear regressor to refine box coordinates.

**Computational cost:** Each of the ~2,000 regions requires a separate CNN forward pass. For a 227x227 input through AlexNet, this is ~725 MFLOPs per region, totaling ~1.45 TFLOPs per image. Inference takes ~47 seconds per image on a GPU.

#### 3.1.2 Fast R-CNN (Girshick, 2015)

**Key insight:** Compute the CNN features *once* for the entire image, then extract features for each region from the shared feature map.

**Pipeline:**
1. Pass the full image through a CNN backbone (e.g., VGG-16) to get a feature map.
2. For each region proposal, use **RoI Pooling** to extract a fixed-size feature vector.
3. Pass through FC layers to produce class probabilities and bounding box refinements.

**Definition 3.1 (RoI Pooling).** Given a feature map $\mathbf{F} \in \mathbb{R}^{C \times H \times W}$ and a region of interest (RoI) defined by $(x_1, y_1, x_2, y_2)$ in image coordinates:

1. Project the RoI onto the feature map by dividing coordinates by the feature stride.
2. Divide the projected RoI into a $k \times k$ grid (e.g., $7 \times 7$).
3. Apply max pooling within each grid cell to produce an output of size $C \times k \times k$.

**Speedup:** ~213x over R-CNN for the feature extraction step (single forward pass vs. 2,000).

**Bottleneck:** Region proposals (Selective Search) are still computed separately and are slow (~2 seconds per image).

#### 3.1.3 Faster R-CNN (Ren et al., 2015)

**Key insight:** Replace Selective Search with a **Region Proposal Network (RPN)** that shares convolutional features with the detection network.

**Architecture overview:**
```
Image -> Backbone CNN -> Feature Map
                          |
                    +-----+-----+
                    |           |
                   RPN     RoI Pooling + Detection Head
                    |           |
              Region Proposals  Class + BBox
```

### 3.2 Anchor Boxes and Region Proposal Networks

**Definition 3.2 (Anchor Boxes).** At each spatial position $(i, j)$ of the feature map, define $k$ anchor boxes of predefined shapes (combinations of scales and aspect ratios). For 3 scales $\times$ 3 aspect ratios, $k = 9$.

Each anchor box $a$ is parameterized by its center $(x_a, y_a)$, width $w_a$, and height $h_a$ in image coordinates.

**RPN outputs (per anchor):**
- **Objectness score:** $p \in [0, 1]$ — probability that the anchor contains an object (vs. background).
- **Box regression:** $\Delta = (t_x, t_y, t_w, t_h)$ — offsets to refine the anchor into a proposal.

**Definition 3.3 (Box Parameterization).** The predicted box is:

$$\hat{x} = x_a + t_x \cdot w_a, \quad \hat{y} = y_a + t_y \cdot h_a$$
$$\hat{w} = w_a \cdot e^{t_w}, \quad \hat{h} = h_a \cdot e^{t_h}$$

This parameterization is scale-invariant: the same $t$ values produce proportionally the same offset regardless of anchor size.

**RPN Loss Function:**

$$\mathcal{L}_{\text{RPN}} = \frac{1}{N_{\text{cls}}} \sum_i L_{\text{cls}}(p_i, p_i^*) + \lambda \frac{1}{N_{\text{reg}}} \sum_i p_i^* \cdot L_{\text{reg}}(t_i, t_i^*)$$

where:
- $p_i^* = 1$ if anchor $i$ is positive (IoU with ground truth > 0.7), $p_i^* = 0$ if negative (IoU < 0.3), ignored otherwise.
- $L_{\text{cls}}$ is binary cross-entropy.
- $L_{\text{reg}}$ is smooth $L_1$ loss: $\text{smooth}_{L_1}(x) = \begin{cases} 0.5x^2 & |x| < 1 \\ |x| - 0.5 & \text{otherwise} \end{cases}$
- $\lambda = 10$ balances the two terms (approximately, since $N_{\text{cls}} \approx 256$ and $N_{\text{reg}} \approx 2400$).

**Definition 3.4 (Intersection over Union).** For two boxes $A$ and $B$:

$$\text{IoU}(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

IoU is used both for assigning labels to anchors and for non-maximum suppression (NMS) at inference.

### 3.3 Feature Pyramid Networks (Lin et al., 2017)

**Problem:** Objects at different scales produce features at different levels of the backbone. Small objects are best detected from high-resolution (early) feature maps; large objects from low-resolution (deep) feature maps. Standard detectors use only the final feature map, limiting small-object detection.

**FPN Architecture:**

```
Bottom-up pathway (backbone):           Top-down pathway + lateral connections:
C1 (stride 4)                           P2 = Conv1x1(C2) + Upsample(P3)
C2 (stride 4)     ----lateral--->       P3 = Conv1x1(C3) + Upsample(P4)
C3 (stride 8)     ----lateral--->       P4 = Conv1x1(C4) + Upsample(P5)
C4 (stride 16)    ----lateral--->       P5 = Conv1x1(C5)
C5 (stride 32)    ----lateral--->
```

**Definition 3.5 (FPN Construction).**

1. **Bottom-up:** Standard CNN backbone (e.g., ResNet) produces feature maps $\{C_2, C_3, C_4, C_5\}$ at strides $\{4, 8, 16, 32\}$.
2. **Top-down:** Starting from $C_5$, build $P_5 = \text{Conv}_{1\times1}(C_5)$. For each level $\ell$ from 4 down to 2:
   $$P_\ell = \text{Conv}_{1\times1}(C_\ell) + \text{Upsample}_{2\times}(P_{\ell+1})$$
3. **Post-processing:** Apply a 3x3 convolution to each $P_\ell$ to reduce aliasing from upsampling.

Each pyramid level $P_\ell$ has the same channel dimension (typically 256), enabling a single detection head to be shared across scales.

### 3.4 Semantic Segmentation

#### 3.4.1 Fully Convolutional Networks (Long et al., 2015)

**Key insight:** Replace all FC layers with 1x1 convolutions, making the network fully convolutional and able to process images of arbitrary size.

**Architecture:**

1. **Encoder:** Standard classification network (e.g., VGG-16) with FC layers converted to 1x1 convolutions. Produces a coarse spatial map of size $H/32 \times W/32$.
2. **Decoder:** Upsample with learnable transposed convolutions (or bilinear interpolation).

**FCN-32s:** Single 32x upsample (very coarse).
**FCN-16s:** Fuse predictions from stride-16 and stride-32 feature maps, then 16x upsample.
**FCN-8s:** Further fuse stride-8 features for finer predictions.

**Loss:** Per-pixel cross-entropy:

$$\mathcal{L} = -\frac{1}{HW}\sum_{i=1}^{H}\sum_{j=1}^{W}\sum_{c=1}^{C} y_{i,j,c} \log p_{i,j,c}$$

where $y_{i,j,c}$ is the one-hot ground truth label and $p_{i,j,c}$ is the predicted probability for class $c$ at pixel $(i,j)$.

#### 3.4.2 U-Net (Ronneberger et al., 2015)

**Key insight:** The encoder-decoder architecture with **skip connections** between corresponding encoder and decoder levels preserves fine spatial information that is lost during downsampling.

**Architecture:**

```
Encoder (contracting path):           Decoder (expanding path):
Conv3x3 + Conv3x3 (64)  ----skip--->  Conv3x3 + Conv3x3 (64) -> Output
  MaxPool2x2                              UpConv2x2
Conv3x3 + Conv3x3 (128) ----skip--->  Conv3x3 + Conv3x3 (128)
  MaxPool2x2                              UpConv2x2
Conv3x3 + Conv3x3 (256) ----skip--->  Conv3x3 + Conv3x3 (256)
  MaxPool2x2                              UpConv2x2
Conv3x3 + Conv3x3 (512) ----skip--->  Conv3x3 + Conv3x3 (512)
  MaxPool2x2                              UpConv2x2
Conv3x3 + Conv3x3 (1024)              (bottleneck)
```

**Skip connection mechanism:** The encoder feature map at each level is concatenated (along the channel dimension) with the decoder feature map after upsampling:

$$\mathbf{D}_\ell = \text{Conv}([\mathbf{E}_\ell \, ; \, \text{Upsample}(\mathbf{D}_{\ell+1})])$$

where $[\cdot \, ; \, \cdot]$ denotes channel concatenation.

**Theorem 3.1 (Information Recovery via Skip Connections).** Without skip connections, the decoder must reconstruct fine spatial details from the bottleneck representation alone. With skip connections, the decoder has access to the encoder's high-resolution feature maps, which preserve edge and boundary information. Formally, let the encoder mapping be $E: \mathbb{R}^{H \times W} \to \mathbb{R}^{H/16 \times W/16}$ and the decoder $D: \mathbb{R}^{H/16 \times W/16} \to \mathbb{R}^{H \times W}$. The composition $D \circ E$ must recover spatial details, which requires the decoder to invert the information loss from pooling. Skip connections provide the residual information $\mathbf{E}_\ell - \text{reconstruct}(\mathbf{E}_{\ell+1})$, eliminating this need.

### 3.5 Vision Transformers (ViT)

#### 3.5.1 Architecture

**Definition 3.6 (Patch Embedding).** Given an image $\mathbf{x} \in \mathbb{R}^{H \times W \times C}$ and patch size $P$:

1. Divide the image into $N = HW/P^2$ non-overlapping patches, each of size $P \times P \times C$.
2. Flatten each patch to a vector $\mathbf{p}_i \in \mathbb{R}^{P^2 C}$.
3. Linearly project to embedding dimension $D$: $\mathbf{z}_i^0 = \mathbf{E}\mathbf{p}_i + \mathbf{e}_i^{\text{pos}}$, where $\mathbf{E} \in \mathbb{R}^{D \times P^2C}$ is the projection matrix and $\mathbf{e}_i^{\text{pos}} \in \mathbb{R}^D$ is the positional embedding.

**Remark.** The patch embedding is equivalent to a convolution with kernel size $P$ and stride $P$:

$$\mathbf{z}_i^0 = \text{Conv2d}(C_{\text{in}}=C, C_{\text{out}}=D, \text{kernel}=P, \text{stride}=P)(\mathbf{x})_i + \mathbf{e}_i^{\text{pos}}$$

**Classification token:** Prepend a learnable [CLS] token $\mathbf{z}_0^0 \in \mathbb{R}^D$ to the sequence. The final representation of [CLS] is used for classification.

**Full input sequence:**

$$\mathbf{Z}^0 = [\mathbf{z}_{\text{cls}}; \mathbf{z}_1^0; \mathbf{z}_2^0; \ldots; \mathbf{z}_N^0] \in \mathbb{R}^{(N+1) \times D}$$

#### 3.5.2 Transformer Encoder

Each of the $L$ transformer layers applies:

**Multi-Head Self-Attention (MHSA):**

$$\mathbf{Z}'^{\ell} = \text{MHSA}(\text{LN}(\mathbf{Z}^{\ell-1})) + \mathbf{Z}^{\ell-1}$$

**MLP (Feed-Forward Network):**

$$\mathbf{Z}^{\ell} = \text{MLP}(\text{LN}(\mathbf{Z}'^{\ell})) + \mathbf{Z}'^{\ell}$$

where $\text{LN}$ is Layer Normalization and the MLP has one hidden layer with GELU activation:

$$\text{MLP}(\mathbf{z}) = W_2 \cdot \text{GELU}(W_1 \mathbf{z} + b_1) + b_2$$

with $W_1 \in \mathbb{R}^{4D \times D}$ and $W_2 \in \mathbb{R}^{D \times 4D}$ (expansion ratio 4).

**Self-attention computation:** For $h$ heads, each head $k$ computes:

$$Q_k = \mathbf{Z} W_k^Q, \quad K_k = \mathbf{Z} W_k^K, \quad V_k = \mathbf{Z} W_k^V$$

$$\text{Attn}_k(\mathbf{Z}) = \text{softmax}\left(\frac{Q_k K_k^T}{\sqrt{d_k}}\right) V_k$$

where $d_k = D / h$ is the head dimension. The outputs are concatenated and projected:

$$\text{MHSA}(\mathbf{Z}) = [\text{Attn}_1; \ldots; \text{Attn}_h] W^O$$

#### 3.5.3 Classification Head

$$\hat{y} = \text{FC}(\text{LN}(\mathbf{z}_{\text{cls}}^L))$$

#### 3.5.4 ViT Configurations

| Model    | Layers $L$ | Hidden $D$ | Heads $h$ | MLP dim | Params |
|:--------:|:----------:|:----------:|:---------:|:-------:|:------:|
| ViT-B/16 | 12         | 768        | 12        | 3072    | 86M    |
| ViT-L/16 | 24         | 1024       | 16        | 4096    | 307M   |
| ViT-H/14 | 32         | 1280       | 16        | 5120    | 632M   |

The "/16" and "/14" denote patch size $P$.

### 3.6 ViT vs. CNN: Inductive Biases

**Theorem 3.2 (Inductive Bias Comparison).**

| Property | CNN | ViT |
|:--------:|:---:|:---:|
| Locality | Hard (kernel size) | Soft (attention can be local or global) |
| Translation equivariance | Built-in (weight sharing) | None (broken by positional embedding) |
| Receptive field | Grows with depth | Global from layer 1 |
| Parameter sharing | Spatial (same kernel everywhere) | None spatial (attention is position-specific via position embeddings) |
| Data efficiency | High (strong prior) | Low (weak prior, needs more data) |

**Proposition 3.3 (Data Regime).** ViT underperforms ResNet on small datasets (e.g., ImageNet-1K without pretraining) because it lacks CNN's inductive biases. With large-scale pretraining (JFT-300M, ImageNet-21K), ViT matches or exceeds CNNs because the data provides enough signal to overcome the weaker prior.

*Informal argument.* CNNs have an implicit prior that: (a) features are local, (b) the same feature can appear anywhere, and (c) nearby pixels are more relevant than distant ones. ViT replaces these with: (a') all patches can attend to all other patches, (b') position information comes from learned embeddings, and (c') no spatial bias. With limited data, the CNN prior aids generalization. With sufficient data, the ViT's flexibility allows it to learn optimal spatial relationships unconstrained by local connectivity.

### 3.7 ConvNeXt: Modernizing CNNs (Liu et al., 2022)

**Key idea:** Take a standard ResNet and systematically modernize it with design choices borrowed from transformers, without using self-attention.

**Modernization steps (cumulative):**

1. **Macro design:** Use Swin Transformer's stage compute ratio (3:3:9:3 blocks instead of 3:4:6:3). Use "patchify" stem (4x4 stride-4 conv) instead of 7x7 stride-2 + maxpool. Result: +0.7%.
2. **ResNeXt-style grouped convolution:** Use depthwise convolution (groups = channels). Result: +0.1%.
3. **Inverted bottleneck:** Expand channel dimension in the middle (like MobileNetV2/Transformer FFN). Result: +0.2%.
4. **Large kernels:** Move from 3x3 to 7x7 depthwise convolution. Result: +0.7%.
5. **Micro design:** Replace ReLU with GELU, use fewer activation functions (one per block, like Transformer), replace BN with LN, use separate downsampling layers between stages. Result: +0.6%.

**Final result:** ConvNeXt-T (28.6M params) achieves 82.1% ImageNet top-1, matching Swin-T (28.3M params, 81.3%) while being a pure CNN.

**ConvNeXt Block:**
```
Input x ∈ R^{C × H × W}
  -> DepthwiseConv(7x7)           // spatial mixing
  -> LayerNorm
  -> PointwiseConv(4C)             // channel expansion
  -> GELU
  -> PointwiseConv(C)              // channel reduction
  -> x + residual                  // skip connection
```

---

## 4. Algorithmic Derivation

### 4.1 Faster R-CNN Inference

```
Algorithm: FasterRCNN_Inference
Input: Image I ∈ R^{3 × H × W}, model parameters θ
Output: List of (class, confidence, bbox) tuples

1.  // Backbone + FPN
2.  {P2, P3, P4, P5} = FPN(Backbone(I))

3.  // RPN: generate proposals from each pyramid level
4.  proposals = []
5.  for each level P_l:
6.      for each spatial position (i,j) in P_l:
7.          for each anchor a ∈ {9 anchors}:
8.              score = σ(cls_head(P_l[i,j]))          // objectness
9.              delta = reg_head(P_l[i,j])              // (tx, ty, tw, th)
10.             box = decode(anchor(i,j,a), delta)
11.             proposals.append((box, score))

12. // Non-Maximum Suppression on proposals
13. proposals = NMS(proposals, iou_threshold=0.7)
14. proposals = top_k(proposals, k=1000)

15. // Detection head
16. detections = []
17. for each proposal box:
18.     level = assign_to_level(box_area)             // FPN level selection
19.     features = RoIAlign(P_level, box, 7x7)         // R^{C × 7 × 7}
20.     features = flatten(features)                    // R^{C*49}
21.     cls_scores = cls_fc(features)                   // R^{num_classes+1}
22.     bbox_deltas = reg_fc(features)                  // R^{num_classes × 4}
23.     class = argmax(cls_scores)
24.     refined_box = decode(box, bbox_deltas[class])
25.     detections.append((class, softmax(cls_scores)[class], refined_box))

26. // Final NMS per class
27. detections = per_class_NMS(detections, iou_threshold=0.5)
28. return detections
```

**Complexity:** Backbone: ~4 GFLOPs (ResNet-50). RPN: ~0.5 GFLOPs. Detection head per proposal: ~1 MFLOPs. Total: ~4.5 GFLOPs for ~300 proposals.

### 4.2 ViT Forward Pass

```
Algorithm: ViT_Forward
Input: Image x ∈ R^{3 × H × W}, patch size P, model params θ
Output: Class logits ∈ R^{num_classes}

1.  N = (H/P) * (W/P)                                  // number of patches
2.  // Patch embedding
3.  patches = reshape(x, (N, 3*P*P))                   // (N, 3P²)
4.  z = patches @ E + e_pos                             // (N, D) + (N, D)
5.  z = [z_cls; z]                                      // (N+1, D)

6.  // Transformer encoder
7.  for l = 1 to L:
8.      // Multi-head self-attention with pre-norm
9.      z_norm = LayerNorm(z)                            // (N+1, D)
10.     Q = z_norm @ W_Q, K = z_norm @ W_K, V = z_norm @ W_V   // each (N+1, D)
11.     // Split into h heads, each (N+1, D/h)
12.     attn = softmax(Q @ K^T / sqrt(D/h)) @ V          // (N+1, D)
13.     z = z + attn @ W_O                                // residual connection

14.     // MLP with pre-norm
15.     z_norm = LayerNorm(z)                             // (N+1, D)
16.     z = z + W2 @ GELU(W1 @ z_norm + b1) + b2         // residual connection

17. // Classification head
18. logits = FC(LayerNorm(z[0]))                          // z[0] is CLS token -> (num_classes,)
19. return logits
```

**Complexity:** Self-attention is $O(N^2 D)$ per layer, MLP is $O(ND^2)$ per layer. For ViT-B/16 on 224x224: $N = 196$, $D = 768$, $L = 12$. Total: ~17.6 GFLOPs.

---

## 5. PyTorch Implementation

### 5.1 Region Proposal Network (Simplified)

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class RPN(nn.Module):
    """
    Simplified Region Proposal Network.

    Args:
        in_channels: Number of input feature channels
        num_anchors: Number of anchors per spatial position
    """
    def __init__(self, in_channels: int = 256, num_anchors: int = 9):
        super().__init__()
        self.conv = nn.Conv2d(in_channels, 256, 3, padding=1)     # intermediate layer
        self.cls_head = nn.Conv2d(256, num_anchors, 1)             # objectness score
        self.reg_head = nn.Conv2d(256, num_anchors * 4, 1)        # box regression

    def forward(self, feature_map: torch.Tensor):
        """
        Args:
            feature_map: Backbone output of shape (N, C, H, W)

        Returns:
            cls_scores: (N, num_anchors, H, W)
            bbox_deltas: (N, num_anchors*4, H, W)
        """
        t = F.relu(self.conv(feature_map))          # (N, 256, H, W)
        cls_scores = self.cls_head(t)                # (N, num_anchors, H, W)
        bbox_deltas = self.reg_head(t)               # (N, num_anchors*4, H, W)
        return cls_scores, bbox_deltas


def generate_anchors(feature_h: int, feature_w: int, stride: int,
                     scales: list = [128, 256, 512],
                     ratios: list = [0.5, 1.0, 2.0]) -> torch.Tensor:
    """
    Generate anchor boxes for all spatial positions.

    Args:
        feature_h, feature_w: Feature map spatial dimensions
        stride: Feature stride (e.g., 16 for conv4)
        scales: Anchor scales in pixels
        ratios: Anchor aspect ratios (h/w)

    Returns:
        anchors: (feature_h * feature_w * num_anchors, 4) in (x1, y1, x2, y2) format
    """
    # Base anchors at origin
    base_anchors = []
    for s in scales:
        for r in ratios:
            w = s / (r ** 0.5)
            h = s * (r ** 0.5)
            base_anchors.append([-w/2, -h/2, w/2, h/2])
    base_anchors = torch.tensor(base_anchors)                    # (K, 4) where K = len(scales)*len(ratios)

    # Shift to all positions
    shift_x = torch.arange(0, feature_w) * stride + stride // 2  # (W,)
    shift_y = torch.arange(0, feature_h) * stride + stride // 2  # (H,)
    shift_y, shift_x = torch.meshgrid(shift_y, shift_x, indexing='ij')
    shifts = torch.stack([shift_x, shift_y, shift_x, shift_y], dim=-1)  # (H, W, 4)
    shifts = shifts.reshape(-1, 4)                                        # (H*W, 4)

    # Broadcast: (H*W, 1, 4) + (1, K, 4)
    anchors = shifts.unsqueeze(1) + base_anchors.unsqueeze(0)   # (H*W, K, 4)
    anchors = anchors.reshape(-1, 4)                              # (H*W*K, 4)
    return anchors


# --- Demo ---
rpn = RPN(in_channels=256, num_anchors=9)
feat = torch.randn(2, 256, 14, 14)                              # (N=2, C=256, H=14, W=14)
cls, reg = rpn(feat)
print(f"RPN cls shape: {cls.shape}")      # (2, 9, 14, 14)
print(f"RPN reg shape: {reg.shape}")      # (2, 36, 14, 14)

anchors = generate_anchors(14, 14, stride=16)
print(f"Total anchors: {anchors.shape}")  # (1764, 4) = 14*14*9
```

### 5.2 U-Net

```python
class UNetBlock(nn.Module):
    """Double convolution block used in U-Net."""

    def __init__(self, in_ch: int, out_ch: int):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),   # (N, out_ch, H, W)
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),  # (N, out_ch, H, W)
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class UNet(nn.Module):
    """
    U-Net for semantic segmentation.

    Args:
        in_channels: Input image channels (e.g., 3 for RGB)
        num_classes: Number of segmentation classes
        base_ch: Base channel count (doubled at each encoder level)
    """
    def __init__(self, in_channels: int = 3, num_classes: int = 21, base_ch: int = 64):
        super().__init__()

        # Encoder
        self.enc1 = UNetBlock(in_channels, base_ch)               # -> base_ch
        self.enc2 = UNetBlock(base_ch, base_ch * 2)               # -> base_ch*2
        self.enc3 = UNetBlock(base_ch * 2, base_ch * 4)           # -> base_ch*4
        self.enc4 = UNetBlock(base_ch * 4, base_ch * 8)           # -> base_ch*8

        # Bottleneck
        self.bottleneck = UNetBlock(base_ch * 8, base_ch * 16)    # -> base_ch*16

        # Decoder (transpose conv for upsampling)
        self.up4 = nn.ConvTranspose2d(base_ch * 16, base_ch * 8, 2, stride=2)
        self.dec4 = UNetBlock(base_ch * 16, base_ch * 8)          # concat doubles channels

        self.up3 = nn.ConvTranspose2d(base_ch * 8, base_ch * 4, 2, stride=2)
        self.dec3 = UNetBlock(base_ch * 8, base_ch * 4)

        self.up2 = nn.ConvTranspose2d(base_ch * 4, base_ch * 2, 2, stride=2)
        self.dec2 = UNetBlock(base_ch * 4, base_ch * 2)

        self.up1 = nn.ConvTranspose2d(base_ch * 2, base_ch, 2, stride=2)
        self.dec1 = UNetBlock(base_ch * 2, base_ch)

        self.pool = nn.MaxPool2d(2)
        self.final = nn.Conv2d(base_ch, num_classes, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input image of shape (N, C, H, W). H, W should be divisible by 16.
        Returns:
            Segmentation logits of shape (N, num_classes, H, W)
        """
        # Encoder
        e1 = self.enc1(x)                       # (N, 64, H, W)
        e2 = self.enc2(self.pool(e1))            # (N, 128, H/2, W/2)
        e3 = self.enc3(self.pool(e2))            # (N, 256, H/4, W/4)
        e4 = self.enc4(self.pool(e3))            # (N, 512, H/8, W/8)

        # Bottleneck
        b = self.bottleneck(self.pool(e4))       # (N, 1024, H/16, W/16)

        # Decoder with skip connections
        d4 = self.up4(b)                         # (N, 512, H/8, W/8)
        d4 = self.dec4(torch.cat([d4, e4], 1))   # (N, 512, H/8, W/8) after concat+conv

        d3 = self.up3(d4)                        # (N, 256, H/4, W/4)
        d3 = self.dec3(torch.cat([d3, e3], 1))   # (N, 256, H/4, W/4)

        d2 = self.up2(d3)                        # (N, 128, H/2, W/2)
        d2 = self.dec2(torch.cat([d2, e2], 1))   # (N, 128, H/2, W/2)

        d1 = self.up1(d2)                        # (N, 64, H, W)
        d1 = self.dec1(torch.cat([d1, e1], 1))   # (N, 64, H, W)

        return self.final(d1)                     # (N, num_classes, H, W)


# --- Verification ---
model = UNet(in_channels=3, num_classes=21)
x = torch.randn(2, 3, 256, 256)                                 # (N=2, C=3, H=256, W=256)
out = model(x)
print(f"U-Net input:  {x.shape}")    # (2, 3, 256, 256)
print(f"U-Net output: {out.shape}")  # (2, 21, 256, 256)
print(f"Parameters: {sum(p.numel() for p in model.parameters()):,}")
```

### 5.3 Vision Transformer (ViT)

```python
class PatchEmbedding(nn.Module):
    """Convert image to sequence of patch embeddings."""

    def __init__(self, img_size: int = 224, patch_size: int = 16,
                 in_channels: int = 3, embed_dim: int = 768):
        super().__init__()
        self.num_patches = (img_size // patch_size) ** 2           # 196 for 224/16
        self.proj = nn.Conv2d(in_channels, embed_dim,
                              kernel_size=patch_size, stride=patch_size)  # patchify

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (N, 3, H, W)
        Returns:
            (N, num_patches, embed_dim)
        """
        x = self.proj(x)                                          # (N, D, H/P, W/P)
        x = x.flatten(2)                                           # (N, D, num_patches)
        x = x.transpose(1, 2)                                     # (N, num_patches, D)
        return x


class MultiHeadSelfAttention(nn.Module):
    """Multi-head self-attention."""

    def __init__(self, embed_dim: int, num_heads: int, dropout: float = 0.0):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads
        self.scale = self.head_dim ** -0.5

        self.qkv = nn.Linear(embed_dim, 3 * embed_dim)
        self.proj = nn.Linear(embed_dim, embed_dim)
        self.attn_drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (N, seq_len, D)
        Returns:
            (N, seq_len, D)
        """
        N, L, D = x.shape
        h = self.num_heads

        qkv = self.qkv(x).reshape(N, L, 3, h, self.head_dim)    # (N, L, 3, h, d_k)
        qkv = qkv.permute(2, 0, 3, 1, 4)                         # (3, N, h, L, d_k)
        q, k, v = qkv.unbind(0)                                   # each (N, h, L, d_k)

        attn = (q @ k.transpose(-2, -1)) * self.scale             # (N, h, L, L)
        attn = attn.softmax(dim=-1)                                # (N, h, L, L)
        attn = self.attn_drop(attn)

        x = (attn @ v).transpose(1, 2).reshape(N, L, D)           # (N, L, D)
        x = self.proj(x)                                           # (N, L, D)
        return x


class TransformerBlock(nn.Module):
    """Single transformer encoder block with pre-norm."""

    def __init__(self, embed_dim: int, num_heads: int, mlp_ratio: float = 4.0,
                 dropout: float = 0.0):
        super().__init__()
        self.norm1 = nn.LayerNorm(embed_dim)
        self.attn = MultiHeadSelfAttention(embed_dim, num_heads, dropout)
        self.norm2 = nn.LayerNorm(embed_dim)
        mlp_hidden = int(embed_dim * mlp_ratio)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, mlp_hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(mlp_hidden, embed_dim),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (N, seq_len, D)
        Returns:
            (N, seq_len, D)
        """
        x = x + self.attn(self.norm1(x))                          # (N, L, D) residual
        x = x + self.mlp(self.norm2(x))                           # (N, L, D) residual
        return x


class VisionTransformer(nn.Module):
    """
    Vision Transformer (ViT).

    Args:
        img_size: Input image size (assumes square)
        patch_size: Patch size P
        in_channels: Number of input channels
        num_classes: Number of output classes
        embed_dim: Transformer embedding dimension D
        depth: Number of transformer layers L
        num_heads: Number of attention heads h
        mlp_ratio: MLP hidden dimension ratio
        dropout: Dropout rate
    """
    def __init__(self, img_size: int = 224, patch_size: int = 16,
                 in_channels: int = 3, num_classes: int = 1000,
                 embed_dim: int = 768, depth: int = 12, num_heads: int = 12,
                 mlp_ratio: float = 4.0, dropout: float = 0.1):
        super().__init__()
        self.patch_embed = PatchEmbedding(img_size, patch_size,
                                          in_channels, embed_dim)
        num_patches = self.patch_embed.num_patches

        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))      # (1, 1, D)
        self.pos_embed = nn.Parameter(
            torch.randn(1, num_patches + 1, embed_dim) * 0.02)          # (1, N+1, D)
        self.pos_drop = nn.Dropout(dropout)

        self.blocks = nn.Sequential(*[
            TransformerBlock(embed_dim, num_heads, mlp_ratio, dropout)
            for _ in range(depth)
        ])

        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)

        # Initialize CLS token
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: Input image of shape (N, 3, H, W)
        Returns:
            Logits of shape (N, num_classes)
        """
        N = x.shape[0]

        # Patch embedding
        x = self.patch_embed(x)                                    # (N, num_patches, D)

        # Prepend CLS token
        cls_tokens = self.cls_token.expand(N, -1, -1)             # (N, 1, D)
        x = torch.cat([cls_tokens, x], dim=1)                     # (N, num_patches+1, D)

        # Add positional embedding
        x = self.pos_drop(x + self.pos_embed)                     # (N, num_patches+1, D)

        # Transformer encoder
        x = self.blocks(x)                                         # (N, num_patches+1, D)

        # Classification head (CLS token)
        x = self.norm(x[:, 0])                                    # (N, D)
        x = self.head(x)                                           # (N, num_classes)
        return x


# --- Verification ---
vit = VisionTransformer(
    img_size=224, patch_size=16, num_classes=100,
    embed_dim=768, depth=12, num_heads=12
)
x = torch.randn(2, 3, 224, 224)
y = vit(x)
print(f"ViT input:  {x.shape}")      # (2, 3, 224, 224)
print(f"ViT output: {y.shape}")      # (2, 100)
print(f"Parameters: {sum(p.numel() for p in vit.parameters()):,}")
# ViT-B/16 with 100 classes: ~85.9M parameters
```

### 5.4 ConvNeXt Block

```python
class ConvNeXtBlock(nn.Module):
    """
    ConvNeXt block: depthwise conv -> LN -> pointwise expand -> GELU -> pointwise shrink
    """
    def __init__(self, dim: int, expansion: int = 4, layer_scale_init: float = 1e-6):
        super().__init__()
        self.dwconv = nn.Conv2d(dim, dim, 7, padding=3, groups=dim)   # depthwise
        self.norm = nn.LayerNorm(dim)
        self.pwconv1 = nn.Linear(dim, expansion * dim)                 # pointwise expand
        self.act = nn.GELU()
        self.pwconv2 = nn.Linear(expansion * dim, dim)                 # pointwise shrink
        self.gamma = nn.Parameter(
            layer_scale_init * torch.ones(dim)) if layer_scale_init > 0 else None

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (N, C, H, W)
        Returns:
            (N, C, H, W)
        """
        residual = x                                                   # (N, C, H, W)
        x = self.dwconv(x)                                             # (N, C, H, W)
        x = x.permute(0, 2, 3, 1)                                     # (N, H, W, C) for LN
        x = self.norm(x)                                               # (N, H, W, C)
        x = self.pwconv1(x)                                            # (N, H, W, 4C)
        x = self.act(x)                                                # (N, H, W, 4C)
        x = self.pwconv2(x)                                            # (N, H, W, C)
        if self.gamma is not None:
            x = self.gamma * x                                         # layer scale
        x = x.permute(0, 3, 1, 2)                                     # (N, C, H, W)
        x = residual + x                                               # skip connection
        return x


# --- Demo ---
block = ConvNeXtBlock(dim=96)
x = torch.randn(2, 96, 56, 56)
y = block(x)
print(f"ConvNeXt block: {x.shape} -> {y.shape}")   # (2, 96, 56, 56) -> (2, 96, 56, 56)
```

---

## 6. Experimental Intuition

### 6.1 Detection Model Comparison

| Model             | Backbone    | AP (COCO) | Inference Time | Key Feature         |
|:-----------------:|:-----------:|:---------:|:--------------:|:-------------------:|
| R-CNN             | AlexNet     | 31.4      | 47s/image      | Selective Search    |
| Fast R-CNN        | VGG-16      | 35.9      | 0.32s/image    | Shared features     |
| Faster R-CNN      | ResNet-101  | 42.1      | 0.06s/image    | Learned RPN         |
| Faster R-CNN + FPN| ResNet-101  | 44.9      | 0.10s/image    | Multi-scale         |

### 6.2 ViT vs. CNN: Data Scaling

| Pretraining Data | ViT-B/16 (Top-1) | ResNet-152 (Top-1) |
|:----------------:|:-----------------:|:------------------:|
| ImageNet-1K      | 77.9%             | 78.3%              |
| ImageNet-21K     | 83.6%             | 79.1%              |
| JFT-300M         | 87.1%             | 79.9%              |

**Key insight:** ViT's performance scales much better with data. At small scale, CNN wins. At large scale, ViT wins decisively.

### 6.3 Failure Modes

1. **Small object detection:** Without FPN, small objects are lost in deep feature maps. Always use multi-scale features for detection.
2. **ViT with small datasets:** Without pretraining, ViT-B overfits severely on CIFAR-10 (test accuracy drops ~10% vs. ResNet-18). Solution: use DeiT-style training with strong augmentation, or pretrain on larger data.
3. **U-Net memory:** Skip connections store high-resolution feature maps, consuming significant memory. For very high-resolution images (e.g., 2048x2048), use patch-based inference or reduce encoder channels.
4. **Positional embedding resolution mismatch:** ViT's positional embeddings are fixed to training resolution. For different inference resolutions, interpolate the position embeddings (bilinear), which introduces artifacts. ConvNeXt avoids this issue entirely.

---

## 7. Connections and Extensions

### 7.1 Prior Modules
- **Lecture 02a:** Convolution theory underlies all backbone networks.
- **Lecture 02b:** ResNet is the standard backbone for detection and segmentation.
- **Lecture 02c:** BN/GN are essential for training these architectures.

### 7.2 Future Modules
- **Module 04 (Transformers):** ViT is a direct application of the transformer architecture; full attention mechanism theory is covered there.
- **Module 07 (Self-Supervised Learning):** MAE (Masked Autoencoders) uses ViT for self-supervised pretraining by masking patches.
- **Module 09 (Diffusion Models):** U-Net is the standard architecture for diffusion model denoising networks.

### 7.3 Extensions
- **DETR (Carion et al., 2020):** End-to-end object detection with transformers, eliminating NMS and anchor boxes.
- **Swin Transformer (Liu et al., 2021):** Hierarchical vision transformer with shifted windows for linear complexity.
- **Segment Anything (Kirillov et al., 2023):** Foundation model for segmentation using ViT with prompt-based interface.

---

## 8. Seminal Paper Reading List

### Required
1. R. Girshick, J. Donahue, T. Darrell, and J. Malik. "Rich feature hierarchies for accurate object detection and semantic segmentation." *CVPR*, 2014.
2. O. Ronneberger, P. Fischer, and T. Brox. "U-Net: Convolutional Networks for Biomedical Image Segmentation." *MICCAI*, 2015.
3. A. Dosovitskiy et al. "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale." *ICLR*, 2021.
4. Z. Liu, H. Mao, C.-Y. Wu, C. Feichtenhofer, T. Darrell, and S. Xie. "A ConvNet for the 2020s." *CVPR*, 2022.

### Recommended
5. S. Ren, K. He, R. Girshick, and J. Sun. "Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks." *NeurIPS*, 2015.
6. T.-Y. Lin, P. Dollar, R. Girshick, K. He, B. Hariharan, and S. Belongie. "Feature Pyramid Networks for Object Detection." *CVPR*, 2017.
7. J. Long, E. Shelhamer, and T. Darrell. "Fully Convolutional Networks for Semantic Segmentation." *CVPR*, 2015.
8. Z. Liu et al. "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows." *ICCV*, 2021.

---

## 9. Exercises

### Theory Exercises

**Exercise 3.1.** Derive the computational complexity (FLOPs) of self-attention for ViT as a function of the number of patches $N$ and embedding dimension $D$. At what image resolution does the $O(N^2)$ cost become prohibitive? (Consider $N = (H/P)^2$.)

**Exercise 3.2.** Prove that ViT with learned positional embeddings is *not* translation equivariant. Specifically, show that shifting all patches by one position and correspondingly shifting positional embeddings does not produce the same output as shifting the result.

**Exercise 3.3.** In Faster R-CNN, derive the expected number of positive and negative anchors for an image with $k$ objects of varying sizes. Analyze the class imbalance problem and explain why focal loss (Lin et al., 2017) addresses it.

**Exercise 3.4.** Show that the U-Net skip connection is functionally equivalent to learning a residual mapping in the decoder. Relate this to the ResNet analysis from Lecture 02b.

### Implementation Exercises

**Exercise 3.5.** Implement ViT-Tiny (depth=6, embed_dim=192, heads=3) from scratch and train on CIFAR-10. Compare with ResNet-18. You will likely need strong augmentation (RandAugment, Mixup) to make ViT competitive.

**Exercise 3.6.** Implement U-Net from scratch and train on a segmentation dataset (e.g., Pascal VOC or Oxford Pets). Visualize the predictions and compute mean IoU.

**Exercise 3.7.** Visualize the attention maps of a pretrained ViT. For each transformer layer, extract the attention weights of the [CLS] token attending to all patch tokens and reshape to a spatial map. How do the attention patterns change across layers?

**Exercise 3.8.** Implement a simplified Faster R-CNN using a pretrained ResNet-50 backbone. Train on Pascal VOC and report mAP at IoU=0.5.

**Exercise 3.9.** Implement the ConvNeXt block and build a small ConvNeXt model for CIFAR-10. Compare accuracy, speed, and parameter count with ViT-Tiny and ResNet-18.
