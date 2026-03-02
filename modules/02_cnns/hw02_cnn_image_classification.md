# Homework 02: CNN Image Classification

**Estimated Time:** 20 hours
**Due:** Two weeks from assignment date
**Submission:** Submit a single PDF (typeset in LaTeX) for Part A and a GitHub repository with runnable code for Part B.

---

## Overview

This homework covers the core mathematical and implementation aspects of convolutional neural networks. Part A tests your ability to derive and prove fundamental CNN properties. Part B requires building and training CNNs from scratch, conducting ablation studies, and analyzing the results.

**Grading:**
- Part A (Mathematical Derivations): 50%
- Part B (Implementation): 50%

**Academic integrity:** You may discuss approaches with classmates but all written derivations and code must be your own. Cite any resources used.

---

## Part A: Mathematical Derivations (50%)

### Problem A1: Convolution Output Dimensions (8 points)

**(a)** (4 points) Derive the output spatial dimension formula for a 2D convolution with:
- Input size: $H_{\text{in}} \times W_{\text{in}}$
- Kernel size: $k_h \times k_w$
- Padding: $(p_h, p_w)$ (possibly asymmetric: $p_h^{\text{top}}, p_h^{\text{bottom}}, p_w^{\text{left}}, p_w^{\text{right}}$)
- Stride: $(s_h, s_w)$
- Dilation: $(d_h, d_w)$

Show all steps. Your formula should handle the fully general case with asymmetric padding.

**(b)** (2 points) Compute the output size for the following specific configuration:
- Input: $32 \times 32$
- Kernel: $5 \times 5$
- Padding: 2
- Stride: 2
- Dilation: 3

**(c)** (2 points) Given a desired output size $H_{\text{out}}$, derive the padding $p$ needed (assuming symmetric padding, stride $s$, dilation $d$, kernel $k$). Under what conditions does an integer solution exist?

---

### Problem A2: Translation Equivariance (10 points)

**(a)** (5 points) Prove that 2D multi-channel convolution (as defined in Lecture 02a, Definition 3.4) is equivariant under the translation group $(\mathbb{Z}^2, +)$. Write out the full proof, handling the summation over input channels.

Specifically, let $T_{(a,b)}$ denote translation by $(a,b)$ acting on a multi-channel feature map $F \in \mathbb{R}^{C_{\text{in}} \times H \times W}$:

$$(T_{(a,b)} F)[c, i, j] = F[c, i-a, j-b]$$

Prove that for any kernel $W \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times K \times K}$:

$$T_{(a,b)} \circ \text{Conv}_W = \text{Conv}_W \circ T_{(a,b)}$$

**(b)** (3 points) Show that applying ReLU after convolution preserves translation equivariance. More generally, prove that any pointwise nonlinearity $\sigma: \mathbb{R} \to \mathbb{R}$ applied elementwise preserves equivariance.

**(c)** (2 points) Does stride-$s$ convolution preserve translation equivariance? Prove or provide a counterexample. If not, characterize the subgroup of translations under which it remains equivariant.

---

### Problem A3: Backward Pass Through a Convolutional Layer (12 points)

Consider a single convolutional layer with input $X \in \mathbb{R}^{C_{\text{in}} \times H \times W}$, kernel $W \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times K \times K}$, no bias, stride 1, and padding $p = \lfloor K/2 \rfloor$ ("same" convolution). The output is $Y \in \mathbb{R}^{C_{\text{out}} \times H \times W}$.

**(a)** (6 points) Given the upstream gradient $\frac{\partial \mathcal{L}}{\partial Y} \in \mathbb{R}^{C_{\text{out}} \times H \times W}$, derive $\frac{\partial \mathcal{L}}{\partial X} \in \mathbb{R}^{C_{\text{in}} \times H \times W}$.

Show that:

$$\frac{\partial \mathcal{L}}{\partial X} = \frac{\partial \mathcal{L}}{\partial Y} \star_{\text{full}} \text{rot}_{180}(W)$$

where $\star_{\text{full}}$ denotes "full" convolution (with sufficient padding) and $\text{rot}_{180}(W)$ denotes rotating the spatial dimensions of $W$ by 180 degrees (i.e., $\text{rot}_{180}(W)[o, c, m, n] = W[o, c, K-1-m, K-1-n]$), with summation over $C_{\text{out}}$ rather than $C_{\text{in}}$.

Derive this step by step from the chain rule.

**(b)** (4 points) Derive $\frac{\partial \mathcal{L}}{\partial W} \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times K \times K}$:

$$\frac{\partial \mathcal{L}}{\partial W[o, c, m, n]} = \sum_{i,j} \frac{\partial \mathcal{L}}{\partial Y[o, i, j]} \cdot X[c, i+m-p, j+n-p]$$

Show that this is a convolution of $X$ with $\frac{\partial \mathcal{L}}{\partial Y}$.

**(c)** (2 points) What is the computational complexity of the backward pass relative to the forward pass? Justify your answer.

---

### Problem A4: Receptive Field Analysis (8 points)

Consider the following network architecture:

```
Layer 1: Conv(k=7, s=2, d=1, p=3)
Layer 2: MaxPool(k=3, s=2, p=1)
Layer 3: Conv(k=3, s=1, d=1, p=1)
Layer 4: Conv(k=3, s=1, d=1, p=1)
Layer 5: Conv(k=3, s=2, d=1, p=1)
Layer 6: Conv(k=3, s=1, d=2, p=2)
Layer 7: Conv(k=3, s=1, d=4, p=4)
```

**(a)** (4 points) Compute the receptive field at the output of each layer using the recurrence relation from Lecture 02a. Show your work at each step.

**(b)** (2 points) What is the spatial size of the output feature map if the input is $224 \times 224$? Compute the output size after each layer.

**(c)** (2 points) Suppose we want the receptive field at the final layer to cover the entire $224 \times 224$ input. What is the minimum number of additional 3x3 stride-1 dilation-1 layers needed? What if we allow dilation?

---

### Problem A5: Batch Normalization Backward Pass (12 points)

**(a)** (8 points) Derive the complete backward pass for Batch Normalization from scratch.

Given:
- Mini-batch: $\{x_1, \ldots, x_m\}$
- Forward: $\mu = \frac{1}{m}\sum x_i$, $\sigma^2 = \frac{1}{m}\sum(x_i - \mu)^2$, $\hat{x}_i = \frac{x_i - \mu}{\sqrt{\sigma^2 + \epsilon}}$, $y_i = \gamma \hat{x}_i + \beta$

Derive each gradient in the following order, showing full derivations (no skipping steps):

1. $\frac{\partial \mathcal{L}}{\partial \beta}$
2. $\frac{\partial \mathcal{L}}{\partial \gamma}$
3. $\frac{\partial \mathcal{L}}{\partial \hat{x}_i}$
4. $\frac{\partial \mathcal{L}}{\partial \sigma^2}$
5. $\frac{\partial \mathcal{L}}{\partial \mu}$
6. $\frac{\partial \mathcal{L}}{\partial x_i}$

For step 6, account for all three paths through which $x_i$ affects $\mathcal{L}$: directly through $\hat{x}_i$, through $\mu$, and through $\sigma^2$.

**(b)** (4 points) Show that the gradient $\frac{\partial \mathcal{L}}{\partial x_i}$ can be written in the compact form:

$$\frac{\partial \mathcal{L}}{\partial x_i} = \frac{\gamma}{m\sqrt{\sigma^2 + \epsilon}} \left(m \frac{\partial \mathcal{L}}{\partial y_i} - \sum_{j=1}^m \frac{\partial \mathcal{L}}{\partial y_j} - \hat{x}_i \sum_{j=1}^m \frac{\partial \mathcal{L}}{\partial y_j} \hat{x}_j \right)$$

Prove that this is equivalent to the result from part (a).

---

## Part B: Implementation (50%)

All code should be in PyTorch. Include all training curves and visualizations in your report.

### Problem B1: Conv2d from Scratch (10 points)

Implement a `Conv2d` layer using only basic tensor operations (no `nn.Conv2d`, no `F.conv2d`). Your implementation should support:

- Arbitrary input channels, output channels, kernel size
- Stride and padding
- Both forward and backward pass

```python
class ManualConv2d:
    """
    Requirements:
    - forward(x): compute convolution
    - backward(grad_output): compute gradients w.r.t. input and weights
    - Verify against nn.Conv2d on random inputs
    - Report max absolute error (should be < 1e-5)
    """
    pass
```

**Deliverables:**
1. Working implementation with forward and backward passes.
2. Verification: show that your implementation matches `nn.Conv2d` and `autograd` to within floating-point precision.
3. Benchmark: compare wall-clock time of your implementation vs. `nn.Conv2d` for input size (8, 64, 32, 32) with 128 output channels and 3x3 kernel.

---

### Problem B2: ResNet-18 from Scratch (12 points)

Implement ResNet-18 from scratch and train on CIFAR-100.

**Requirements:**
1. Implement `BasicBlock` and `ResNet` classes without using `torchvision.models`.
2. Adapt the architecture for CIFAR-100 (32x32 images): use a 3x3 stem instead of 7x7+maxpool.
3. Training recipe:
   - SGD with momentum 0.9, weight decay 5e-4
   - Initial learning rate 0.1 with cosine annealing
   - 200 epochs, batch size 128
   - Standard augmentation: random crop with padding 4, random horizontal flip
4. Target accuracy: >= 76% on CIFAR-100 test set.

**Deliverables:**
1. Complete code for model, training, and evaluation.
2. Training and test accuracy/loss curves.
3. Final test accuracy and comparison with published baselines.
4. Total parameter count and FLOPs per forward pass.

---

### Problem B3: Batch Normalization from Scratch (8 points)

Implement Batch Normalization without using `nn.BatchNorm2d` or any built-in normalization.

**Requirements:**
1. Forward pass with proper handling of training vs. eval modes.
2. Running statistics with configurable momentum.
3. Backward pass implemented manually (not using autograd for BN gradients).
4. Verify against `nn.BatchNorm2d` for both forward and backward passes.

**Deliverables:**
1. Working implementation.
2. Numerical verification (max absolute error for forward and backward).
3. Train your ResNet-18 from Problem B2 with your custom BN and verify that accuracy is comparable.

---

### Problem B4: Normalization Ablation Study (8 points)

Using your ResNet-18 from Problem B2, compare four normalization strategies:

1. Batch Normalization
2. Layer Normalization
3. Group Normalization (G=32)
4. No normalization

For each, train on CIFAR-100 with the same hyperparameters (except you may need to reduce the learning rate for the no-normalization case).

**Deliverables:**
1. Training curves (loss and accuracy) for all four methods on the same plot.
2. Final test accuracies in a table.
3. For each method, measure and plot the mean and standard deviation of activations at layers {4, 8, 12, 16} during training (at epochs {1, 10, 50, 200}).
4. Discussion: which method works best and why? When would you choose each?

---

### Problem B5: Skip Connection Ablation (8 points)

Compare your ResNet-18 with a "PlainNet-18" (same architecture but all skip connections removed).

**Deliverables:**
1. Training and test curves for both models.
2. **Gradient norm visualization:** At initialization and after epochs {1, 10, 50}, compute and plot the L2 norm of the gradient with respect to each convolutional layer's weights. Show that the plain network exhibits gradient vanishing while ResNet does not.
3. **Loss landscape visualization (bonus, +2 points):** For both trained models, plot the loss along a random direction in parameter space (1D slice). Show that ResNet's landscape is smoother.

---

### Problem B6: Filter and Feature Map Visualization (4 points)

Using your trained ResNet-18:

1. Visualize the learned first-layer filters (should show edge detectors, color blobs, etc.).
2. For a sample image, visualize the feature maps at layers {1, 4, 8, 16}. Show how features become more abstract with depth.
3. Apply gradient-based visualization (e.g., vanilla gradient or Grad-CAM) to show which regions of the input the model focuses on for a given prediction.

**Deliverables:**
1. Figure with first-layer filters.
2. Figure with feature maps at multiple depths.
3. Figure with gradient visualization for 3 sample images.
4. Brief discussion of what you observe.

---

## Submission Checklist

- [ ] Part A: PDF with all derivations, clearly labeled.
- [ ] Part B: GitHub repository with:
  - [ ] `conv2d.py` — Manual Conv2d implementation (B1)
  - [ ] `resnet.py` — ResNet-18 implementation (B2)
  - [ ] `batchnorm.py` — Manual BatchNorm implementation (B3)
  - [ ] `train.py` — Training script with all ablation options (B2, B4, B5)
  - [ ] `visualize.py` — Visualization code (B5, B6)
  - [ ] `report.pdf` — Results, figures, and discussion
  - [ ] `requirements.txt` — Python dependencies
  - [ ] `README.md` — Instructions to reproduce results

---

## Grading Rubric

### Part A (50 points total)
- **Correctness (30 points):** Mathematical statements are correct, proofs are valid.
- **Rigor (10 points):** All steps are justified, no hand-waving.
- **Clarity (10 points):** Well-organized, clearly written, proper notation.

### Part B (50 points total)
- **Correctness (25 points):** Code runs, produces correct results, matches baselines.
- **Completeness (15 points):** All deliverables present, all experiments conducted.
- **Analysis (10 points):** Thoughtful discussion of results, proper visualization.

---

## Hints and Tips

1. **Problem A3:** Think of the convolution as $Y = W \star X$ (cross-correlation). The backward pass w.r.t. $X$ is a "full" convolution of the upstream gradient with the rotated kernel. Draw a small example (3x3 kernel, 5x5 input) to build intuition.

2. **Problem B1:** Use `torch.Tensor.unfold` or explicit indexing. Do not try to be efficient — correctness is more important. The im2col approach works well.

3. **Problem B2:** For CIFAR-100, the standard ResNet adaptation uses: Conv(3x3, stride=1) as the stem (no maxpool), then 4 stages with [2,2,2,2] blocks. The channel progression is [64, 128, 256, 512].

4. **Problem B3:** Be very careful with the backward pass. The gradient has three contributing paths. Use `torch.autograd.gradcheck` to verify.

5. **Problem B5:** For gradient visualization, use `torch.autograd.grad` or register hooks on the layers. Plot gradient norms on a log scale.

6. **General:** Use `torch.manual_seed(42)` for reproducibility. Train on GPU if available. Save checkpoints periodically.
