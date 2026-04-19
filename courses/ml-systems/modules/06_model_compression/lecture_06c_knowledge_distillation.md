# Lecture 06c: Knowledge Distillation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the knowledge distillation loss function from first principles, showing how temperature scaling controls the entropy of the teacher's soft targets and the information transferred to the student.
2. **Distinguish** between logit-based, feature-based, and relation-based distillation methods, and analyze the inductive biases each transfers.
3. **Formalize** self-distillation and explain why training a model on its own predictions can improve performance, connecting to label smoothing and regularization.
4. **Evaluate** the challenges and recent techniques for distilling large language models, including on-policy distillation and sequence-level objectives.
5. **Identify** the conditions under which distillation succeeds or fails, relating the capacity gap, task complexity, and data availability to expected gains.

---

## 2. Motivation and Context

### 2.1 The Compression Problem

Knowledge distillation addresses a fundamental tension: large models achieve the best accuracy, but deployment constraints demand small models. Unlike pruning (which removes parameters from a trained model) or quantization (which reduces parameter precision), distillation trains a smaller model from scratch to mimic a larger one.

The key insight, due to Hinton, Vinyals, and Dean (2015), is that the *soft predictions* of a trained teacher model contain far more information than the *hard labels* in the training set. A teacher that outputs "cat: 0.7, dog: 0.2, fox: 0.1" for an image communicates that cats and dogs are more visually similar than cats and foxes --- information that is completely absent from the hard label "cat."

### 2.2 Dark Knowledge

Hinton et al. coined the term **dark knowledge** for the information encoded in the teacher's non-argmax outputs. Consider a 1000-class ImageNet classifier. For a given image, the hard label provides $\log_2(1000) \approx 10$ bits of information. But the teacher's full probability distribution over 1000 classes provides a 999-dimensional probability simplex, encoding rich relational structure: which classes the teacher considers similar, which it finds confusing, and how confident it is.

This is the theoretical foundation for why distillation can outperform training on hard labels: the student receives more supervision signal per example.

---

## 3. The Distillation Framework

### 3.1 Setup

Let $f_T(\cdot; \theta_T)$ be a pretrained **teacher** model and $f_S(\cdot; \theta_S)$ be a smaller **student** model. Both produce logit vectors:

$$z_T = f_T(x; \theta_T) \in \mathbb{R}^K, \qquad z_S = f_S(x; \theta_S) \in \mathbb{R}^K$$

where $K$ is the number of classes and $x$ is the input.

### 3.2 Temperature Scaling

The softmax with temperature $\tau > 0$ is:

$$p_i^\tau = \frac{\exp(z_i / \tau)}{\sum_{j=1}^K \exp(z_j / \tau)}$$

As $\tau \to 0$, the distribution concentrates on the argmax (hard label). As $\tau \to \infty$, the distribution approaches uniform.

**Why temperature matters.** At $\tau = 1$, a well-trained teacher's outputs are very peaked: $p_\text{true class} \approx 0.99$, with the remaining mass spread thinly. The gradients from matching these peaked distributions are dominated by the true class, and the "dark knowledge" in the tails is overwhelmed. Raising $\tau$ softens the distribution, amplifying the relative differences among non-argmax classes:

**Proposition 3.1.** *In the high-temperature limit, the gradient of the KL divergence with respect to the student logits is proportional to the difference in logits (not probabilities):*

$$\frac{\partial}{\partial z_S} \text{KL}(p_T^\tau \| p_S^\tau) \approx \frac{1}{\tau^2} \frac{1}{K}(z_S - z_T) + O(\tau^{-3})$$

*Proof sketch.* For large $\tau$, $p_i^\tau \approx \frac{1}{K}(1 + z_i/\tau - \bar{z}/\tau)$ where $\bar{z} = \frac{1}{K}\sum_j z_j$. Substituting into the KL divergence gradient and expanding to leading order in $1/\tau$ yields the result. The $1/\tau^2$ factor motivates multiplying the distillation loss by $\tau^2$ (see below). $\blacksquare$

### 3.3 The Distillation Loss

The standard distillation loss combines the soft target loss with the hard label loss:

$$\mathcal{L}_{\text{distill}} = \alpha \cdot \tau^2 \cdot \text{KL}\left(p_T^\tau \;\|\; p_S^\tau\right) + (1 - \alpha) \cdot \text{CE}(y, p_S^1)$$

where:

- $\text{KL}(p_T^\tau \| p_S^\tau)$ is the Kullback-Leibler divergence between the teacher's and student's softened predictions.
- $\text{CE}(y, p_S^1)$ is the cross-entropy between the hard label $y$ and the student's standard ($\tau = 1$) prediction.
- $\alpha \in [0, 1]$ balances the two losses.
- $\tau^2$ compensates for the $1/\tau^2$ scaling of the gradients (from Proposition 3.1), ensuring the gradient magnitudes are comparable regardless of $\tau$.

**Typical hyperparameters**: $\tau \in [3, 20]$, $\alpha \in [0.5, 0.9]$. Higher $\alpha$ emphasizes the teacher's knowledge; lower $\alpha$ ensures the student fits the true labels.

### 3.4 Implementation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class DistillationLoss(nn.Module):
    """
    Knowledge distillation loss: soft targets + hard label cross-entropy.

    Args:
        temperature: softmax temperature for soft targets
        alpha: weight for soft target loss (1 - alpha for hard label loss)
    """
    def __init__(self, temperature: float = 4.0, alpha: float = 0.7):
        super().__init__()
        self.temperature = temperature
        self.alpha = alpha

    def forward(
        self,
        student_logits: torch.Tensor,  # (B, K)
        teacher_logits: torch.Tensor,  # (B, K)
        labels: torch.Tensor,          # (B,) integer class labels
    ) -> torch.Tensor:
        """
        Compute the distillation loss.

        Returns:
            Scalar loss value.
        """
        T = self.temperature

        # Soft target loss: KL divergence between softened distributions
        # F.kl_div expects log-probabilities as input, probabilities as target
        soft_student = F.log_softmax(student_logits / T, dim=-1)  # (B, K)
        soft_teacher = F.softmax(teacher_logits / T, dim=-1)      # (B, K)
        soft_loss = F.kl_div(
            soft_student, soft_teacher,
            reduction='batchmean'
        )  # scalar
        # Multiply by T^2 to compensate for gradient scaling
        soft_loss = soft_loss * (T ** 2)

        # Hard label loss: standard cross-entropy at temperature 1
        hard_loss = F.cross_entropy(student_logits, labels)  # scalar

        # Combined loss
        loss = self.alpha * soft_loss + (1 - self.alpha) * hard_loss
        return loss


def train_student(
    student: nn.Module,
    teacher: nn.Module,
    train_loader: torch.utils.data.DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: DistillationLoss,
    device: torch.device,
    epochs: int = 100,
):
    """
    Train student model using knowledge distillation from teacher.
    """
    teacher.eval()  # Teacher is frozen
    for epoch in range(epochs):
        student.train()
        total_loss = 0.0
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            # x shape: (B, C, H, W) for images, y shape: (B,)

            # Get teacher predictions (no gradient needed)
            with torch.no_grad():
                teacher_logits = teacher(x)  # (B, K)

            # Get student predictions
            student_logits = student(x)  # (B, K)

            # Compute distillation loss
            loss = criterion(student_logits, teacher_logits, y)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(train_loader)
        print(f"Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")
```

---

## 4. Feature-Based Distillation

### 4.1 Motivation

Logit-based distillation transfers only the final output distribution. Feature-based distillation additionally aligns the student's intermediate representations with the teacher's, providing richer supervisory signal.

### 4.2 FitNets (Romero et al., 2015)

FitNets train the student to match the teacher's intermediate feature maps. Let $h_T^\ell \in \mathbb{R}^{d_T}$ and $h_S^\ell \in \mathbb{R}^{d_S}$ be the teacher's and student's activations at matched layers. Since $d_T \neq d_S$ in general, a projection layer $r: \mathbb{R}^{d_S} \to \mathbb{R}^{d_T}$ (a learnable linear or small convolutional network) bridges the dimensionality gap:

$$\mathcal{L}_{\text{hint}} = \|r(h_S^\ell) - h_T^\ell\|_2^2$$

The total FitNets loss combines the hint losses at multiple layers with the standard distillation loss:

$$\mathcal{L}_{\text{FitNets}} = \mathcal{L}_{\text{distill}} + \sum_{\ell \in \mathcal{M}} \beta_\ell \|r_\ell(h_S^\ell) - h_T^\ell\|_2^2$$

where $\mathcal{M}$ is the set of matched layer pairs and $\beta_\ell$ are weighting coefficients.

### 4.3 Attention Transfer (Zagoruyko & Komodakis, 2017)

Instead of matching full feature maps (which requires projection networks when dimensions differ), attention transfer aligns spatial attention maps:

$$A(h) = \sum_{c=1}^{C} |h_c|^p \in \mathbb{R}^{H \times W}$$

where $h \in \mathbb{R}^{C \times H \times W}$ is a feature map and $p$ is typically 2. The attention map $A(h)$ is a channel-wise pooled saliency map showing where the network "attends" spatially.

The loss is:

$$\mathcal{L}_{\text{AT}} = \sum_{\ell} \left\| \frac{A(h_T^\ell)}{\|A(h_T^\ell)\|_2} - \frac{A(h_S^\ell)}{\|A(h_S^\ell)\|_2} \right\|_2^2$$

This is dimension-agnostic in the channel dimension: teacher and student can have different numbers of channels as long as their spatial resolutions match.

### 4.4 Contrastive Representation Distillation (Tian et al., 2020)

CRD frames distillation as a contrastive learning problem. Rather than minimizing $\ell_2$ distance between teacher and student features (which depends on the coordinate system), CRD maximizes the mutual information $I(h_T; h_S)$ using a contrastive bound:

$$\mathcal{L}_{\text{CRD}} = -\mathbb{E}_{(h_T, h_S) \sim p_{\text{pos}}} \left[ \log \frac{f(h_T, h_S)}{f(h_T, h_S) + N \cdot \mathbb{E}_{h_S' \sim p_{\text{neg}}} f(h_T, h_S')} \right]$$

where $f$ is a learned critic function, positive pairs $(h_T, h_S)$ are from the same input, and negative pairs use features from different inputs.

CRD outperforms $\ell_2$-based feature matching across a range of teacher-student architecture pairs, suggesting that the *structure* of the representation space matters more than the exact point-wise alignment.

---

## 5. Self-Distillation

### 5.1 Definition and Mechanism

**Self-distillation** uses a model as its own teacher: the model is trained, then used to generate soft targets for retraining a model of the same architecture from scratch (or fine-tuning itself).

Surprisingly, self-distillation consistently improves performance. Furlanello et al. (2018) showed that repeating this process multiple "generations" yields monotonically improving accuracy on CIFAR-100:

| Generation | Top-1 Accuracy (ResNet-18 / CIFAR-100) |
|------------|----------------------------------------|
| 0 (baseline) | 76.5% |
| 1            | 77.8% |
| 2            | 78.1% |
| 3            | 78.2% |

### 5.2 Why Does Self-Distillation Work?

The improvement from self-distillation can be understood through multiple lenses:

**Label smoothing perspective.** The teacher's soft labels are a form of data-dependent label smoothing. Unlike uniform label smoothing (which spreads mass uniformly across all classes), the teacher's predictions concentrate mass on plausible alternatives. This provides a more informative regularizer.

**Bias-variance perspective.** The teacher's predictions average out idiosyncratic noise in the training labels. If the teacher achieves 80% accuracy, its soft targets are correct 80% of the time and provide useful distributional information even when wrong. Training on these smoothed targets reduces the variance of the student's generalization error.

**Dark knowledge recapture.** The teacher has learned inter-class relationships (which classes are similar) that are implicit in its predictions but not in the hard labels. Self-distillation allows a new model to benefit from these learned relationships from the start of training.

### 5.3 Born-Again Networks (Furlanello et al., 2018)

The Born-Again Networks (BAN) framework formalizes iterated self-distillation:

```
Algorithm: Born-Again Networks
-------------------------------
Input: Architecture A, training data D

1. Train generation 0: theta_0 = Train(A, D, hard_labels)
2. For g = 1, 2, ..., G:
   a. Generate soft targets: p_T(x) = softmax(f(x; theta_{g-1}) / tau)
   b. Train generation g:
      theta_g = Train(A, D, loss = alpha * KL(p_T || p_S) + (1-alpha) * CE)
3. Return theta_G or ensemble of all generations
```

The ensemble of all generations further improves accuracy, suggesting each generation learns complementary information.

---

## 6. Distillation for Large Language Models

### 6.1 Challenges Specific to LLMs

Distilling LLMs presents unique challenges that do not arise in the classification setting:

1. **Autoregressive generation**: The output space is a sequence, not a fixed-size vector. The teacher's distribution at each token depends on all preceding tokens.
2. **Exposure bias**: If the student is trained on teacher-forced inputs (ground truth prefix), it may not learn how to recover from its own errors during generation.
3. **Capacity gap**: When distilling from a 70B teacher to a 7B student, the capacity gap is enormous. The student may lack the representational capacity to match the teacher's distribution.
4. **Cost of teacher inference**: Running the teacher on the full training set is expensive. For a 70B model on trillions of tokens, this is prohibitive.

### 6.2 Sequence-Level Distillation (Kim & Rush, 2016)

For sequence generation tasks, there are two forms of distillation:

**Word-level distillation**: At each position $t$, minimize the KL divergence between the teacher's and student's next-token distributions:

$$\mathcal{L}_{\text{word}} = \sum_{t=1}^{T} \text{KL}(p_T(\cdot | y_{<t}) \| p_S(\cdot | y_{<t}))$$

This is the direct analog of classification distillation applied at each token position.

**Sequence-level distillation**: Generate complete sequences from the teacher using beam search or sampling, then train the student on these sequences as if they were ground truth:

$$\mathcal{L}_{\text{seq}} = -\sum_{t=1}^{T} \log p_S(\hat{y}_t | \hat{y}_{<t})$$

where $\hat{y}$ is a sequence generated by the teacher. This is simpler and cheaper (no need to store the teacher's full vocabulary distribution at each position) but loses the distributional information.

### 6.3 On-Policy Distillation (GKD, Agarwal et al., 2024)

Generalized Knowledge Distillation (GKD) addresses the exposure bias problem by using the student's own generated sequences as the context for computing the distillation loss:

$$\mathcal{L}_{\text{GKD}} = \mathbb{E}_{\hat{y} \sim p_S} \left[ \sum_{t=1}^{T} \text{KL}(p_T(\cdot | \hat{y}_{<t}) \| p_S(\cdot | \hat{y}_{<t})) \right]$$

The key difference from standard word-level distillation: the prefix $\hat{y}_{<t}$ is sampled from the student, not from the training data. This ensures the student learns to match the teacher's distribution on inputs that the student itself will generate, closing the train-test distribution gap.

**On-policy vs. off-policy:**

| Aspect | Off-policy (standard KD) | On-policy (GKD) |
|--------|--------------------------|-----------------|
| Prefix source | Ground truth $y_{<t}$ | Student samples $\hat{y}_{<t}$ |
| Computational cost | 1 forward pass each | Student generates, then teacher evaluates |
| Exposure bias | Yes | No |
| Training stability | Stable | Requires careful tuning |

### 6.4 Distillation in Practice: DistilBERT, TinyLlama, Phi

**DistilBERT (Sanh et al., 2019)**: 6-layer student distilled from 12-layer BERT-base using:
- Initialization from every other layer of the teacher.
- Word-level distillation loss + masked language modeling loss + cosine embedding loss on hidden states.
- Result: 40% smaller, 60% faster, retains 97% of BERT's GLUE performance.

**TinyLlama (Zhang et al., 2024)**: 1.1B model trained on 3T tokens. While not purely distilled (it uses standard pretraining), it demonstrates that small models can achieve strong performance given enough data --- a finding that informs how we think about the distillation-data tradeoff.

**Phi-series (Microsoft)**: Phi-1.5 (1.3B), Phi-2 (2.7B), and Phi-3 (3.8B) achieve performance competitive with much larger models by training on high-quality "textbook-like" synthetic data, much of which is generated by larger models. This is a form of implicit distillation: the larger model's knowledge is encoded in the generated training data.

---

## 7. When Does Distillation Work?

### 7.1 The Capacity Gap Problem

Distillation fails when the student is too small to represent the teacher's function. Mirzadeh et al. (2020) showed that distillation performance degrades sharply when the teacher-student capacity gap is large, and proposed **teacher assistant distillation**: an intermediate-size model bridges the gap.

$$\text{Teacher (large)} \to \text{Assistant (medium)} \to \text{Student (small)}$$

Each distillation step transfers knowledge across a smaller capacity gap, where distillation is most effective.

### 7.2 Sufficient Conditions for Effective Distillation

Based on empirical evidence across numerous studies, distillation is most effective when:

1. **The teacher is significantly better than training on hard labels.** If the teacher only marginally outperforms the student trained on hard labels, there is little "dark knowledge" to transfer.

2. **The student has sufficient capacity.** A rough guideline: the student should have at least 25--50% of the teacher's parameters to capture the essential knowledge.

3. **The training data is limited.** Distillation provides the greatest gains in low-data regimes, where the teacher's soft targets provide additional supervision. With unlimited data, a student trained on hard labels eventually catches up.

4. **The task has rich inter-class structure.** Fine-grained classification (where many classes are similar) benefits more from distillation than binary classification (where the dark knowledge is minimal).

### 7.3 Failure Modes

1. **Architecture mismatch**: A CNN student may struggle to learn from a Transformer teacher because they process information fundamentally differently.
2. **Temperature sensitivity**: Too-high temperature washes out all information into a near-uniform distribution; too-low temperature reverts to hard labels.
3. **Overreliance on teacher errors**: If the teacher is poorly calibrated, its soft targets may transfer systematic biases to the student.

---

## 8. Advanced Topics

### 8.1 Data-Free Distillation

When the original training data is unavailable (due to privacy, licensing, or storage constraints), data-free distillation generates synthetic inputs by inverting the teacher:

$$x^* = \arg\max_x \; H(p_T(x))$$

where $H$ is the entropy. This finds inputs that maximally activate the teacher's knowledge by producing high-entropy (informative) predictions. Techniques include:

- **Generator-based** (Micaelli & Storkey, 2019): Train a generator network to produce inputs that maximize the disagreement between teacher and student.
- **Batch normalization statistics** (Yin et al., 2020): Use the running mean and variance stored in the teacher's BN layers to regularize generated images to match the training distribution.

### 8.2 Multi-Teacher Distillation

When multiple teachers are available (e.g., an ensemble or models trained on different data), the student can be trained on a combination of their predictions:

$$p_{\text{ensemble}} = \frac{1}{M} \sum_{m=1}^{M} p_{T_m}^\tau(x)$$

This is more effective than distilling from any single teacher because the ensemble's predictions are better calibrated and average out individual model biases.

### 8.3 Online Distillation and Mutual Learning

Instead of the traditional offline paradigm (train teacher, freeze, train student), **deep mutual learning** (Zhang et al., 2018) trains two or more networks simultaneously, each acting as a teacher for the others:

$$\mathcal{L}_1 = \text{CE}(y, p_1) + \text{KL}(p_2 \| p_1), \quad \mathcal{L}_2 = \text{CE}(y, p_2) + \text{KL}(p_1 \| p_2)$$

Both networks improve beyond their individual baselines, even when they have the same architecture. This eliminates the need to pretrain a teacher.

---

## Key Takeaways

1. **Knowledge distillation** trains a small student to mimic a large teacher's soft predictions, transferring "dark knowledge" about inter-class relationships that hard labels lack.
2. **Temperature scaling** is the critical hyperparameter: higher temperatures amplify the teacher's distributional information but reduce signal-to-noise. The $\tau^2$ factor in the loss compensates for gradient scaling.
3. **Feature-based distillation** provides richer supervision than logit-only distillation by aligning intermediate representations, but requires careful layer matching.
4. **Self-distillation** improves accuracy even with no capacity reduction, functioning as a learned label smoothing regularizer.
5. **LLM distillation** must address autoregressive generation and exposure bias; on-policy methods (GKD) that train on the student's own outputs are more effective than off-policy approaches.

---

## Further Reading

### Required

1. **Hinton, G., Vinyals, O., & Dean, J.** (2015). "Distilling the Knowledge in a Neural Network." *NeurIPS Deep Learning Workshop 2014*, arXiv:1503.02531.
   - The foundational paper. Introduces temperature scaling, soft targets, and the combined distillation loss.

2. **Gou, J., Yu, B., Maybank, S. J., & Tao, D.** (2021). "Knowledge Distillation: A Survey." *International Journal of Computer Vision*, 129(6), 1789-1819.
   - Comprehensive survey covering logit-based, feature-based, and relation-based methods.

### Recommended

3. **Romero, A., Ballas, N., Kahou, S. E., Chassang, A., Gatta, C., & Bengio, Y.** (2015). "FitNets: Hints for Thin Deep Nets." *ICLR 2015*.
   - Feature-based distillation using intermediate layer matching.

4. **Furlanello, T., Lipton, Z. C., Tschannen, M., Itti, L., & Anandkumar, A.** (2018). "Born Again Neural Networks." *ICML 2018*.
   - Iterated self-distillation: each generation improves upon the last.

5. **Agarwal, R., Singh, N., Sinha, A., Anand, T., Singhal, P., Goyal, S., Maas, A. L., Le, Q. V., & Firat, O.** (2024). "On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes." *ICLR 2024*.
   - GKD: on-policy distillation for LLMs that eliminates exposure bias.

6. **Sanh, V., Debut, L., Chaumond, J., & Wolf, T.** (2019). "DistilBERT, a distilled version of BERT: smaller, faster, cheaper and lighter." *NeurIPS EMC2 Workshop 2019*.
   - Practical distillation of BERT with impressive efficiency/accuracy tradeoff.

---

## Exercises

### Theory

**Exercise 6c.1.** Prove Proposition 3.1: show that in the high-temperature limit, the gradient of $\text{KL}(p_T^\tau \| p_S^\tau)$ with respect to $z_S$ is $\frac{1}{\tau^2 K}(z_S - z_T) + O(\tau^{-3})$. Start by expanding $p_i^\tau$ to first order in $1/\tau$.

**Exercise 6c.2.** Show that logit-based distillation (matching $z_T$ and $z_S$ directly via MSE) is equivalent to KL distillation in the limit $\tau \to \infty$. What is lost compared to finite-temperature distillation?

**Exercise 6c.3.** Consider a teacher with $K = 3$ classes and logits $z_T = (5, 3, 1)$. Compute the soft targets $p_T^\tau$ for $\tau \in \{1, 2, 5, 10, 100\}$. At what temperature does the dark knowledge (information about relative class similarities) become visible? At what temperature is it washed out?

**Exercise 6c.4.** In the Born-Again Networks framework, why does ensembling multiple generations outperform the final generation alone? Connect your answer to bias-variance decomposition.

### Implementation

**Exercise 6c.5.** Implement knowledge distillation for CIFAR-100: train a ResNet-110 teacher, then distill into a ResNet-20 student. Compare the student's accuracy with and without distillation across temperatures $\tau \in \{1, 2, 4, 8, 16, 32\}$ and mixing weights $\alpha \in \{0.1, 0.3, 0.5, 0.7, 0.9\}$. Plot a heatmap of accuracy vs. $(\tau, \alpha)$.

**Exercise 6c.6.** Implement self-distillation: train a ResNet-20 on CIFAR-100 for 3 generations. Report accuracy at each generation and compare with the baseline. Does the improvement saturate?

---

*Next: Lecture 06d --- Neural Architecture Search & Efficient Architectures*
