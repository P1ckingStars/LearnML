# Lecture 06a: Pruning --- Unstructured, Structured, and the Lottery Ticket Hypothesis

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formalize** the pruning problem as a constrained optimization over binary masks and derive magnitude-based and gradient-based pruning criteria from first principles.
2. **Distinguish** between unstructured (weight-level), semi-structured (N:M), and structured (channel/head/layer) pruning in terms of their sparsity patterns, hardware compatibility, and actual inference speedup.
3. **State** the Lottery Ticket Hypothesis (Frankle & Carbin 2019), evaluate its supporting evidence, and articulate its practical limitations at scale.
4. **Implement** the iterative magnitude pruning (IMP) algorithm and analyze its convergence behavior as a function of pruning schedule.
5. **Evaluate** the gap between theoretical sparsity and practical speedup on modern hardware, including NVIDIA's 2:4 structured sparsity and sparse tensor core execution.

---

## 2. Motivation and Context

### 2.1 The Overparameterization Paradox

Modern neural networks are dramatically overparameterized. GPT-3 has 175B parameters; LLaMA-2-70B has 70B. Yet empirical evidence consistently shows that a large fraction of these parameters can be removed with minimal degradation in task performance. This is not merely a curiosity --- it has profound implications for deployment:

- **Memory**: A 70B-parameter model in FP16 requires 140 GB just for weights. Pruning to 50% sparsity halves the storage cost if the sparse representation is efficient.
- **Compute**: Fewer nonzero multiply-accumulate operations means less arithmetic --- but only if hardware can exploit sparsity.
- **Energy**: On mobile and edge devices, memory access dominates energy consumption. Sparse models reduce data movement.

### 2.2 Pruning in Historical Context

The idea of removing unnecessary connections predates deep learning. Optimal Brain Damage (LeCun et al., 1989) and Optimal Brain Surgeon (Hassibi & Stork, 1993) used second-order information (the Hessian of the loss) to determine which weights to prune. These methods were computationally expensive and largely forgotten during the deep learning revolution, only to be rediscovered and scaled up in the 2010s.

The modern pruning literature was reignited by Han et al. (2015), who showed that AlexNet and VGG could be pruned by 9--13x with negligible accuracy loss using simple magnitude-based pruning followed by fine-tuning. This result was shocking in its simplicity and effectiveness.

---

## 3. The Pruning Problem: Formalization

### 3.1 Pruning as Mask Optimization

Let $\theta \in \mathbb{R}^n$ denote the full parameter vector of a trained network, and let $m \in \{0, 1\}^n$ denote a binary mask. The pruned network computes the same function but with parameters $\theta \odot m$ (elementwise product). The pruning problem is:

$$\min_{m \in \{0,1\}^n} \mathcal{L}(\theta \odot m; \mathcal{D}) \quad \text{s.t.} \quad \|m\|_0 \le k$$

where $k$ is the target number of surviving parameters and $\mathcal{D}$ is the dataset. This is a combinatorial optimization problem --- choosing $k$ elements from $n$ involves $\binom{n}{k}$ possibilities, which is intractable for large networks.

### 3.2 Approximation via Importance Scores

All practical pruning methods replace the combinatorial search with a scoring function $s: \mathbb{R}^n \to \mathbb{R}^n$ that assigns an importance score to each parameter. The mask is then:

$$m_i = \begin{cases} 1 & \text{if } s(\theta)_i \ge \tau \\ 0 & \text{otherwise} \end{cases}$$

where $\tau$ is a threshold chosen to achieve the desired sparsity level. Different choices of $s$ define different pruning methods.

### 3.3 Taylor Expansion Justification

To justify importance scores, consider the change in loss when parameter $\theta_i$ is set to zero:

$$\Delta \mathcal{L}_i = \mathcal{L}(\theta \odot m^{(-i)}; \mathcal{D}) - \mathcal{L}(\theta; \mathcal{D})$$

where $m^{(-i)}$ is the mask with the $i$-th entry zeroed. A second-order Taylor expansion around $\theta$ gives:

$$\Delta \mathcal{L}_i \approx -g_i \theta_i + \frac{1}{2} H_{ii} \theta_i^2$$

where $g_i = \frac{\partial \mathcal{L}}{\partial \theta_i}$ is the gradient and $H_{ii} = \frac{\partial^2 \mathcal{L}}{\partial \theta_i^2}$ is the diagonal Hessian entry.

**At a local minimum**, $g_i \approx 0$, so:

$$\Delta \mathcal{L}_i \approx \frac{1}{2} H_{ii} \theta_i^2$$

This motivates **Optimal Brain Damage** (LeCun et al., 1989): prune parameters with the smallest $H_{ii} \theta_i^2$. When the Hessian is expensive to compute or roughly uniform across parameters, this simplifies to **magnitude pruning**: prune parameters with the smallest $|\theta_i|$.

---

## 4. Unstructured Pruning

### 4.1 Magnitude-Based Pruning

The simplest and most widely used criterion is to prune weights with the smallest absolute value:

$$s(\theta)_i = |\theta_i|$$

**Algorithm: One-Shot Magnitude Pruning**

```
Input:  Trained model with parameters theta, target sparsity p
Output: Pruned model with mask m

1. Compute importance scores: s_i = |theta_i| for all i
2. Set threshold tau = Quantile(s, p)   // p-th percentile
3. Set m_i = 1 if s_i >= tau, else m_i = 0
4. Apply mask: theta_pruned = theta * m
5. Fine-tune theta_pruned on training data (keeping m fixed)
```

**PyTorch implementation:**

```python
import torch
import torch.nn.utils.prune as prune

def magnitude_prune(model: torch.nn.Module, sparsity: float):
    """
    Apply global unstructured magnitude pruning to all Linear layers.

    Args:
        model: nn.Module with Linear layers
        sparsity: fraction of weights to prune (0.0 to 1.0)
    """
    # Collect all (module, 'weight') pairs for Linear layers
    parameters_to_prune = []
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Linear):
            parameters_to_prune.append((module, 'weight'))

    # Global pruning: threshold computed across all layers jointly
    prune.global_unstructured(
        parameters_to_prune,
        pruning_method=prune.L1Unstructured,
        amount=sparsity,
    )
    # After this, each module has:
    #   module.weight_mask: binary mask, shape same as weight
    #   module.weight_orig: original weight
    #   module.weight:      weight_orig * weight_mask (computed via forward hook)

def count_nonzero(model: torch.nn.Module) -> dict:
    """Count nonzero parameters per layer and globally."""
    stats = {}
    total, nonzero = 0, 0
    for name, param in model.named_parameters():
        n = param.numel()
        nz = param.nonzero().size(0)
        total += n
        nonzero += nz
        stats[name] = {'total': n, 'nonzero': nz, 'sparsity': 1.0 - nz / n}
    stats['global'] = {'total': total, 'nonzero': nonzero,
                       'sparsity': 1.0 - nonzero / total}
    return stats
```

### 4.2 Global vs. Per-Layer Pruning

**Per-layer pruning** applies the same sparsity ratio to every layer. This is simple but suboptimal: different layers have different sensitivities to pruning.

**Global pruning** computes a single threshold across all parameters. Layers that are more robust (with many small weights) naturally receive higher sparsity, while sensitive layers retain more parameters.

Empirically, global pruning consistently outperforms per-layer pruning at the same overall sparsity. The reason is that layers differ substantially in their weight magnitude distributions. Early layers in CNNs and attention heads in transformers tend to have smaller weights on average and can tolerate more pruning.

### 4.3 Movement Pruning

Sanh et al. (2020) observed that magnitude pruning is suboptimal when pruning is applied during fine-tuning (as opposed to after training). The reason: a weight that is small at initialization may grow during fine-tuning, while a large pretrained weight may become irrelevant for the downstream task.

**Movement pruning** uses the gradient signal during training to determine importance:

$$s(\theta)_i = |\theta_i \cdot g_i^{(\text{running})}|$$

where $g_i^{(\text{running})}$ is a running average of gradients. A weight is considered important if it consistently moves away from zero during training (large magnitude and gradient in the same direction).

More precisely, the score tracks whether the weight is moving away from zero:

$$S_i^{(t)} = S_i^{(t-1)} - \theta_i^{(t)} \cdot \frac{\partial \mathcal{L}^{(t)}}{\partial \theta_i}$$

Weights with negative accumulated scores (moving toward zero) are pruned. This is equivalent to applying $\ell_0$ regularization with straight-through estimation.

### 4.4 The Sparsity-Accuracy Tradeoff

A universal empirical finding is that accuracy degrades gracefully up to a critical sparsity level, then collapses rapidly:

| Sparsity | Typical Accuracy (ResNet-50 / ImageNet) |
|----------|----------------------------------------|
| 0%       | 76.1% (baseline)                       |
| 50%      | 76.0% (no degradation)                 |
| 80%      | 75.5% (-0.6%)                          |
| 90%      | 74.5% (-1.6%)                          |
| 95%      | 72.0% (-4.1%)                          |
| 98%      | 65.0% (-11.1%)                         |

The "knee" in this curve depends on the model, dataset, and pruning method. Larger models can tolerate higher sparsity, consistent with the overparameterization hypothesis.

---

## 5. Structured Pruning

### 5.1 Why Structure Matters

Unstructured sparsity produces irregular memory access patterns. On modern GPUs optimized for dense matrix multiplication, a 90% sparse matrix stored in CSR format is often *slower* than the dense original because:

1. **Irregular memory access** defeats the GPU's coalescing mechanism.
2. **Load imbalance** across warps/thread blocks when the sparsity is non-uniform.
3. **Metadata overhead** for storing indices can negate savings for moderate sparsity.

Structured pruning removes entire architectural units --- channels, attention heads, or layers --- producing a smaller but fully dense model that runs on standard hardware without any sparse computation support.

### 5.2 Channel Pruning

For a convolutional layer with weight tensor $W \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times k \times k}$, channel pruning removes entire output channels (filters). If we remove channel $j$, we zero out $W[j, :, :, :]$ and also the corresponding input channel of the next layer.

**Importance criterion for channels:**

$$s_j = \sum_{i, h, w} |W[j, i, h, w]|$$

This is the $\ell_1$-norm of filter $j$. Alternatives include:

- **Batch normalization scaling factors** (Liu et al., 2017): Use $|\gamma_j|$ from the BN layer following the convolution as a proxy for channel importance. Channels with small $\gamma$ contribute little to the output.
- **Feature map reconstruction error** (He et al., 2017): Prune channels that minimize the reconstruction error of the next layer's input.
- **Taylor expansion over channels** (Molchanov et al., 2019): Estimate $\Delta \mathcal{L}$ when removing each channel using first-order Taylor approximation.

### 5.3 Attention Head Pruning

In Transformers, attention head pruning removes entire heads from multi-head attention. Michel et al. (2019) showed that many heads can be removed with minimal quality loss. The importance score for head $h$ in layer $l$ is:

$$s_{l,h} = \mathbb{E}_{x \sim \mathcal{D}} \left| \frac{\partial \mathcal{L}}{\partial \alpha_{l,h}} \cdot \alpha_{l,h} \right|$$

where $\alpha_{l,h}$ is a scalar gate applied to head $h$'s output. This is the expected absolute value of the first-order Taylor approximation to the change in loss when the head is removed.

### 5.4 Layer Pruning and Depth Shrinking

At the extreme end of structured pruning, entire layers can be removed. For residual networks, this is straightforward: removing a residual block reduces the computation by that block's cost while the skip connection preserves the identity mapping.

Fan et al. (2020) proposed **LayerDrop**, which randomly drops layers during training (similar to dropout but at the layer level). At inference time, layers are removed deterministically based on their importance, producing models of variable depth without retraining.

---

## 6. The Lottery Ticket Hypothesis

### 6.1 Statement

**The Lottery Ticket Hypothesis (Frankle & Carbin, 2019).** *A randomly initialized, dense neural network contains a subnetwork (a "winning ticket") that --- when trained in isolation from the same initialization --- can match the test accuracy of the original network after training for at most the same number of iterations.*

Formally, let $f(\cdot; \theta_0)$ be a network at initialization $\theta_0$, and let $m$ be a binary mask found by training and pruning. The hypothesis claims there exists $m$ such that:

$$\text{acc}(f(\cdot; \theta_0 \odot m), T) \ge \text{acc}(f(\cdot; \theta_0), T)$$

where $T$ is the number of training iterations and $\text{acc}(\cdot, T)$ denotes the accuracy after $T$ steps of training.

### 6.2 The Iterative Magnitude Pruning (IMP) Algorithm

Frankle and Carbin found winning tickets using iterative magnitude pruning:

```
Algorithm: Iterative Magnitude Pruning (IMP)
---------------------------------------------
Input:  Architecture f, initial parameters theta_0,
        target sparsity p, pruning rounds R

1. Initialize theta = theta_0
2. For r = 1, ..., R:
   a. Train theta for T iterations -> theta_trained
   b. Prune: remove the bottom (p^{1/R}) fraction of weights by magnitude
      m = Mask(theta_trained, sparsity = 1 - (1-p)^{r/R})
   c. Reset surviving weights to their ORIGINAL initial values:
      theta = theta_0 * m
3. Return mask m, initial weights theta_0 * m
```

The critical step is 2c: **rewinding to initialization**. The winning ticket is defined by the combination of the mask $m$ and the original initialization $\theta_0$. A random re-initialization with the same mask does *not* match the original network's accuracy --- the specific initial values matter.

### 6.3 Evidence and Key Findings

**Small-scale validation.** On CIFAR-10 with small CNNs (Conv-2, Conv-4, Conv-6) and VGG-like architectures, IMP finds subnetworks at 10--20% of the original size that match or exceed the full network's accuracy.

**Rewinding to early training (Frankle et al., 2020).** For larger networks (ResNet-50 on ImageNet), rewinding to exact initialization ($\theta_0$) fails. However, **late rewinding** --- resetting to parameters at iteration $k$ early in training ($\theta_k$ for $k$ corresponding to 0.1--7% of total training) --- restores the Lottery Ticket phenomenon. This suggests that a brief initial training period establishes a "basin of attraction" that the winning ticket requires.

**Stability and reproducibility.** Winning tickets found on one task sometimes transfer to related tasks (Morcos et al., 2019), suggesting that the subnetwork structure captures something fundamental about the data domain.

### 6.4 Linear Mode Connectivity

Frankle et al. (2020) introduced **linear mode connectivity** as a diagnostic for the Lottery Ticket Hypothesis. Two solutions $\theta_A$ and $\theta_B$ are *linearly mode connected* if:

$$\mathcal{L}(\alpha \theta_A + (1-\alpha) \theta_B) \le \max(\mathcal{L}(\theta_A), \mathcal{L}(\theta_B)) \quad \forall \alpha \in [0,1]$$

The hypothesis is that winning tickets found by IMP produce solutions that are linearly connected to the full network's solution, while random subnetworks do not. The rewinding iteration $k$ is precisely the point at which the training trajectory enters a region of the loss landscape where linear mode connectivity holds.

### 6.5 Limitations and Criticisms

1. **Computational cost.** IMP requires training the full network $R$ times. Finding a winning ticket is far more expensive than training the dense network once.
2. **Scale.** The original hypothesis (rewinding to $\theta_0$) does not hold for large-scale tasks. Late rewinding is required, which weakens the hypothesis.
3. **Lottery tickets are not unique.** Multiple pruning runs find different winning tickets, suggesting the "structure" is not a single special subnetwork but a large family of adequate subnetworks.
4. **No practical deployment advantage.** Finding the ticket requires training the dense network first. The practical use case is limited to transfer and understanding, not deployment efficiency.

---

## 7. Hardware Support for Sparse Computation

### 7.1 The Sparsity Speedup Gap

A persistent frustration in the pruning literature is the gap between theoretical and actual speedup. A 90% sparse model has 10x fewer FLOPs in theory, but achieves only 1.5--3x speedup on GPUs in practice due to the memory access pattern issues described in Section 5.1.

### 7.2 NVIDIA 2:4 Structured Sparsity

NVIDIA's Ampere architecture (A100) introduced hardware support for **2:4 sparsity** (also called "fine-grained structured sparsity"): in every group of 4 consecutive weights, exactly 2 must be zero. This provides:

- Exactly 50% sparsity.
- A compressed representation: 2 nonzero values + 2-bit index encoding per group of 4.
- Hardware acceleration: the sparse tensor cores perform the compressed matrix multiplication in the same number of cycles as a dense matrix multiplication of half the size, yielding a theoretical 2x speedup.

**Constraint formulation.** For a weight matrix $W \in \mathbb{R}^{m \times n}$ (stored in row-major order), partition the elements of each row into groups of 4. In each group, retain exactly the 2 elements with the largest magnitude:

$$\text{For } W[i, 4j:4j+4], \text{ keep top-2 by } |\cdot|, \text{ zero the rest}$$

```python
def apply_2to4_sparsity(weight: torch.Tensor) -> torch.Tensor:
    """
    Apply 2:4 structured sparsity to a weight matrix.

    Args:
        weight: shape (out_features, in_features),
                in_features must be divisible by 4
    Returns:
        Sparse weight with exactly 2 zeros per group of 4
    """
    assert weight.shape[1] % 4 == 0, "in_features must be divisible by 4"

    w = weight.clone()
    # Reshape to groups of 4: (out_features, in_features // 4, 4)
    w_grouped = w.view(w.shape[0], -1, 4)

    # Find top-2 magnitudes in each group
    _, top2_indices = w_grouped.abs().topk(2, dim=-1)  # (out, in//4, 2)

    # Create mask: 1 for top-2, 0 for bottom-2
    mask = torch.zeros_like(w_grouped)
    mask.scatter_(-1, top2_indices, 1.0)

    # Apply mask and reshape back
    w_sparse = (w_grouped * mask).view_as(weight)
    return w_sparse
```

### 7.3 Sparse Matrix Formats and Their Costs

| Format | Storage per NNZ | Index Overhead | GPU Friendliness |
|--------|----------------|----------------|-------------------|
| Dense  | 1 value        | 0              | Excellent         |
| COO    | 1 value + 2 ints | High         | Poor              |
| CSR    | 1 value + 1 int + row ptrs | Moderate | Moderate     |
| BSR    | block values + block indices | Low (for block-sparse) | Good |
| 2:4    | 2 values + 2-bit index per 4 | Very low | Native HW support |

The key insight: only formats with regular, predictable access patterns (BSR, 2:4) achieve meaningful speedups on GPUs. Arbitrary unstructured sparsity remains difficult to accelerate.

### 7.4 DeepSparse and CPU-Side Sparsity

On CPUs, the story is different. Neural Magic's DeepSparse engine exploits unstructured sparsity on x86 CPUs by:

1. Reorganizing the sparse matrix into a "sparse register tiling" format.
2. Using VNNI (Vector Neural Network Instructions) to skip zero blocks.
3. Achieving near-linear speedup with sparsity on inference workloads.

This makes unstructured pruning practical for CPU deployment, a key distinction from GPU deployment.

---

## 8. Pruning Schedules and Training Integration

### 8.1 One-Shot vs. Iterative vs. Gradual Pruning

**One-shot pruning**: Train to completion, prune once, fine-tune. Simple but suboptimal at high sparsity.

**Iterative pruning**: Alternate between pruning and retraining for $R$ rounds. Better quality but $R$x the training cost.

**Gradual pruning** (Zhu & Gupta, 2017): Increase sparsity during training according to a schedule. The sparsity at step $t$ follows a cubic schedule:

$$s_t = s_f + (s_i - s_f)\left(1 - \frac{t - t_0}{t_f - t_0}\right)^3$$

where $s_i$ is the initial sparsity (typically 0), $s_f$ is the final target sparsity, $t_0$ is the pruning start step, and $t_f$ is the pruning end step. The cubic schedule prunes aggressively early (when the network is most redundant) and slowly later (allowing fine-grained adaptation).

### 8.2 Pruning During Training with the Straight-Through Estimator

When the mask is computed during training, the indicator function $m_i = \mathbf{1}[s_i \ge \tau]$ has zero gradient almost everywhere. The **straight-through estimator** (STE) passes the gradient through the masking operation as if it were the identity:

$$\frac{\partial \mathcal{L}}{\partial \theta_i} \approx \frac{\partial \mathcal{L}}{\partial (\theta_i \cdot m_i)} \cdot m_i$$

This is biased but empirically effective. The surviving weights receive gradients and update normally; pruned weights receive no gradient and remain at zero.

---

## 9. Pruning for LLMs

### 9.1 SparseGPT (Frantar & Alistarh, 2023)

SparseGPT solves the pruning problem for massive language models without any retraining. It frames pruning as a layer-wise sparse reconstruction problem:

$$\min_{m, \hat{W}} \|WX - \hat{W}X\|_F^2 \quad \text{s.t.} \quad \hat{W} \text{ has sparsity } s$$

where $X$ is a small calibration set of activations. The key insight is to solve this column-by-column using Hessian information $(X X^\top)^{-1}$, updating the remaining weights to compensate for each pruned weight --- similar to Optimal Brain Surgeon but applied at massive scale.

SparseGPT achieves 50--60% unstructured sparsity on OPT-175B and BLOOM-176B with less than 1 perplexity point degradation, and runs in under 4 GPU-hours.

### 9.2 Wanda (Sun et al., 2024)

Wanda (Pruning by Weights and Activations) simplifies SparseGPT by using a pruning criterion that accounts for activation magnitudes:

$$s_{ij} = |W_{ij}| \cdot \|X_j\|_2$$

where $X_j$ is the $j$-th input feature across the calibration set. The intuition: a weight is important if it is large *and* its corresponding input feature has large magnitude. This requires no weight update after pruning, making it orders of magnitude faster than SparseGPT while achieving competitive accuracy.

---

## Key Takeaways

1. **Pruning removes redundant parameters** but the choice between unstructured and structured pruning determines whether theoretical sparsity translates to practical speedup.
2. **Magnitude pruning** is a first-order approximation to the optimal pruning criterion (which requires Hessian information). It works remarkably well in practice, especially with global thresholding and iterative pruning.
3. **The Lottery Ticket Hypothesis** reveals that overparameterized networks contain small subnetworks that can train to full accuracy from the original initialization --- but finding these subnetworks is as expensive as training the full network multiple times.
4. **Hardware determines the practical value of sparsity.** NVIDIA's 2:4 format provides a guaranteed 2x speedup at 50% sparsity; arbitrary unstructured sparsity achieves poor GPU utilization.
5. **Modern LLM pruning** (SparseGPT, Wanda) achieves high sparsity without retraining by using calibration data and layer-wise reconstruction, making pruning practical for models too large to retrain.

---

## Further Reading

### Required

1. **Han, S., Pool, J., Tung, J., & Dally, W. J.** (2015). "Learning both Weights and Connections for Efficient Neural Networks." *NeurIPS 2015*.
   - The modern starting point for neural network pruning. Simple magnitude-based approach with iterative pruning and fine-tuning.

2. **Frankle, J. & Carbin, M.** (2019). "The Lottery Ticket Hypothesis: Finding Sparse, Trainable Neural Networks." *ICLR 2019*.
   - Introduces the Lottery Ticket Hypothesis and the iterative magnitude pruning algorithm.

### Recommended

3. **LeCun, Y., Denker, J. S., & Solla, S. A.** (1989). "Optimal Brain Damage." *NeurIPS 1989*.
   - The original second-order pruning method using diagonal Hessian approximation.

4. **Sanh, V., Wolf, T., & Rush, A.** (2020). "Movement Pruning: Adaptive Sparsity during Fine-Tuning." *NeurIPS 2020*.
   - Gradient-based pruning that outperforms magnitude pruning during fine-tuning.

5. **Frantar, E. & Alistarh, D.** (2023). "SparseGPT: Massive Language Models Can Be Accurately Pruned in One-Shot." *ICML 2023*.
   - Layer-wise pruning for LLMs without retraining, using Hessian-based weight updates.

6. **Sun, M., Liu, Z., Bair, A., & Kolter, J. Z.** (2024). "A Simple and Effective Pruning Approach for Large Language Models." *ICLR 2024*.
   - Wanda: activation-aware pruning with no weight update, competitive with SparseGPT.

7. **Mishra, A., Latorre, J. A., Pool, J., Stosic, D., Stosic, D., Venber, G., & Micikevicius, P.** (2021). "Accelerating Sparse Deep Neural Networks." arXiv:2104.08378.
   - NVIDIA's 2:4 structured sparsity: hardware design, training recipes, and benchmark results.

---

## Exercises

### Theory

**Exercise 6a.1.** Derive the Optimal Brain Damage criterion from the second-order Taylor expansion. Under what conditions does it reduce to magnitude pruning? Under what conditions does it differ substantially?

**Exercise 6a.2.** Prove that for a linear regression model $f(x) = w^\top x$ with squared loss, the optimal pruning criterion (removing the weight that least increases the loss) depends on both the weight magnitude and the inverse Hessian. Write the exact formula.

**Exercise 6a.3.** Consider a 2:4 sparsity pattern applied to a matrix $W \in \mathbb{R}^{m \times n}$. What is the total number of possible masks? Express this as a function of $m$ and $n$. Compare with the number of possible masks for 50% unstructured sparsity.

### Implementation

**Exercise 6a.4.** Implement iterative magnitude pruning for a ResNet-20 on CIFAR-10. Plot accuracy vs. sparsity for one-shot, 5-round IMP, and 20-round IMP. At what sparsity does each method begin to degrade?

**Exercise 6a.5.** Implement the Lottery Ticket experiment: train ResNet-20 on CIFAR-10, find a winning ticket at 80% sparsity using IMP, and compare (a) training the ticket from the original initialization, (b) training the ticket from a random initialization, (c) training the dense network. Report accuracy and convergence speed.

---

*Next: Lecture 06b --- Quantization: PTQ, QAT, GPTQ, AWQ*
