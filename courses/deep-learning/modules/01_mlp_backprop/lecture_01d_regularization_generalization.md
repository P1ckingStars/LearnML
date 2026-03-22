# Lecture 01d: Regularization and Generalization

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the bias-variance decomposition for squared loss and interpret each component.
2. **Compare** L1 and L2 regularization from geometric, optimization, and Bayesian perspectives.
3. **Prove** that dropout is equivalent to training an ensemble of subnetworks and derive its approximate effect on the posterior.
4. **Derive** the complete forward and backward pass of Batch Normalization.
5. **Explain** the double descent phenomenon and its implications for model selection.

---

## 2. Motivation and Context

### 2.1 The Fundamental Question

A model that perfectly memorizes the training set may perform terribly on new data. **Generalization** — the ability to perform well on unseen examples — is the central goal of machine learning.

Regularization encompasses any technique that improves generalization, potentially at the cost of training performance. Modern deep learning has complicated the classical story: overparameterized models (more parameters than data points) can generalize well despite being able to memorize anything.

### 2.2 Historical Arc

- **1960s-70s:** Bias-variance tradeoff formalized in statistics.
- **1991:** Tikhonov regularization (L2) applied to neural networks as "weight decay."
- **1996:** Early stopping proposed as regularization by Sjöberg & Ljung.
- **2012:** Dropout (Hinton et al.) revolutionizes deep learning regularization.
- **2015:** Batch Normalization (Ioffe & Szegedy) accelerates training and provides implicit regularization.
- **2019-2021:** Double descent phenomenon challenges the classical bias-variance picture (Belkin et al., Nakkiran et al.).

---

## 3. Bias-Variance Decomposition

### 3.1 Setup

Consider a supervised learning problem. The true data-generating process is:

$$y = f^*(x) + \varepsilon, \quad \varepsilon \sim \mathcal{N}(0, \sigma^2)$$

where $f^*$ is the true function and $\varepsilon$ is irreducible noise. Given a training set $D = \{(x_i, y_i)\}_{i=1}^N$ drawn i.i.d., we train a model $\hat{f}_D(x)$ (the subscript $D$ emphasizes dependence on the training set).

### 3.2 Derivation for Squared Loss

The expected prediction error at a test point $x_0$ is:

$$\text{EPE}(x_0) = \mathbb{E}_D \mathbb{E}_\varepsilon\left[(y_0 - \hat{f}_D(x_0))^2\right]$$

where the outer expectation is over random training sets $D$ and the inner over noise $\varepsilon$.

**Step 1:** Expand using $y_0 = f^*(x_0) + \varepsilon$:

$$\text{EPE} = \mathbb{E}_D \mathbb{E}_\varepsilon\left[(f^*(x_0) + \varepsilon - \hat{f}_D(x_0))^2\right]$$

**Step 2:** Since $\varepsilon$ is independent of $D$ and has zero mean:

$$= \mathbb{E}_D\left[(f^*(x_0) - \hat{f}_D(x_0))^2\right] + \sigma^2$$

**Step 3:** Let $\bar{f}(x_0) = \mathbb{E}_D[\hat{f}_D(x_0)]$ be the average prediction over all possible training sets. Add and subtract $\bar{f}(x_0)$:

$$\mathbb{E}_D\left[(f^* - \hat{f}_D)^2\right] = \mathbb{E}_D\left[(\hat{f}_D - \bar{f} + \bar{f} - f^*)^2\right]$$

$$= \mathbb{E}_D\left[(\hat{f}_D - \bar{f})^2\right] + 2 \underbrace{\mathbb{E}_D[(\hat{f}_D - \bar{f})]}_{=0} ({\bar{f} - f^*}) + (\bar{f} - f^*)^2$$

The cross term vanishes because $\mathbb{E}_D[\hat{f}_D - \bar{f}] = 0$ by definition of $\bar{f}$.

**Result:**

$$\boxed{\text{EPE}(x_0) = \underbrace{(\bar{f}(x_0) - f^*(x_0))^2}_{\text{Bias}^2} + \underbrace{\mathbb{E}_D[(\hat{f}_D(x_0) - \bar{f}(x_0))^2]}_{\text{Variance}} + \underbrace{\sigma^2}_{\text{Irreducible noise}}}$$

### 3.3 Interpretation

| Component | Meaning | Reduced by |
|---|---|---|
| Bias$^2$ | Systematic error; the model class cannot represent $f^*$ | More complex models |
| Variance | Sensitivity to the specific training set | Simpler models, more data, ensemble methods |
| Noise | Inherent randomness in $y$ | Nothing (irreducible) |

**Classical tradeoff:** Increasing model complexity reduces bias but increases variance. The optimal complexity balances both.

**Modern twist:** In deep learning, models with millions of parameters (very low bias) can also have low variance — violating the classical tradeoff. This is the "double descent" phenomenon (Section 9).

---

## 4. L1 and L2 Regularization

### 4.1 L2 Regularization (Weight Decay / Ridge)

**Modified loss:**

$$\tilde{\mathcal{L}}(\theta) = \mathcal{L}(\theta) + \frac{\lambda}{2}\|\theta\|_2^2$$

**Gradient:**

$$\nabla \tilde{\mathcal{L}} = \nabla \mathcal{L} + \lambda \theta$$

**SGD update:**

$$\theta_{t+1} = \theta_t - \eta(\nabla \mathcal{L} + \lambda \theta_t) = (1 - \eta\lambda)\theta_t - \eta \nabla \mathcal{L}$$

The factor $(1 - \eta\lambda)$ multiplies each weight toward zero each step — hence "weight decay."

**Effect on the solution (linear regression).** For $\mathcal{L}(\theta) = \|X\theta - y\|^2 / 2N$:

$$\hat{\theta}_{\text{ridge}} = (X^\top X + N\lambda I)^{-1} X^\top y$$

Compare with OLS: $\hat{\theta}_{\text{OLS}} = (X^\top X)^{-1} X^\top y$. The regularization adds $N\lambda$ to the diagonal of $X^\top X$, preventing ill-conditioning.

**SVD interpretation.** If $X = U \Sigma V^\top$, then:

$$\hat{\theta}_{\text{ridge}} = \sum_{j=1}^{p} \frac{\sigma_j^2}{\sigma_j^2 + N\lambda} \frac{u_j^\top y}{\sigma_j} v_j$$

Each singular component is shrunk by the factor $\frac{\sigma_j^2}{\sigma_j^2 + N\lambda} \in [0, 1)$. Small singular values (noisy directions) are shrunk more aggressively.

### 4.2 L1 Regularization (Lasso)

**Modified loss:**

$$\tilde{\mathcal{L}}(\theta) = \mathcal{L}(\theta) + \lambda \|\theta\|_1 = \mathcal{L}(\theta) + \lambda \sum_j |\theta_j|$$

**Key property:** L1 promotes **sparsity** — many components of $\theta$ are driven exactly to zero.

**Geometric interpretation.** The regularized problem is equivalent to:

$$\min_\theta \mathcal{L}(\theta) \quad \text{s.t.} \quad \|\theta\|_p \le t$$

For L2 ($p=2$), the constraint region is a ball — smooth, so the loss contours typically touch the constraint at a non-axis point.

For L1 ($p=1$), the constraint region is a diamond (cross-polytope) — its corners lie on the axes, so the loss contours are likely to touch at a corner, giving an exactly sparse solution.

### 4.3 Bayesian Interpretation

Regularization corresponds to placing a **prior** on the weights:

$$\hat{\theta}_{\text{MAP}} = \arg\max_\theta \left[\log p(D|\theta) + \log p(\theta)\right] = \arg\min_\theta \left[-\log p(D|\theta) - \log p(\theta)\right]$$

| Regularization | Prior $p(\theta)$ | Distribution |
|---|---|---|
| L2 ($\frac{\lambda}{2}\Vert\theta\Vert_2^2$) | $\propto \exp(-\frac{\lambda}{2}\Vert\theta\Vert^2)$ | Gaussian: $\theta_j \sim \mathcal{N}(0, 1/\lambda)$ |
| L1 ($\lambda\Vert\theta\Vert_1$) | $\propto \exp(-\lambda\Vert\theta\Vert_1)$ | Laplace: $\theta_j \sim \text{Laplace}(0, 1/\lambda)$ |

The Laplace distribution has heavier tails but is more concentrated at zero — encouraging sparsity. The Gaussian prior encourages small weights but does not produce exact zeros.

### 4.4 Elastic Net

Combine L1 and L2:

$$\tilde{\mathcal{L}}(\theta) = \mathcal{L}(\theta) + \lambda_1 \|\theta\|_1 + \frac{\lambda_2}{2}\|\theta\|_2^2$$

This gets sparsity from L1 while maintaining the grouping effect of L2 (correlated features get similar weights).

---

## 5. Dropout

### 5.1 Definition

During training, each hidden unit is independently "dropped" (set to zero) with probability $p$ at each forward pass.

For layer $\ell$:

$$\tilde{h}_\ell = \frac{1}{1-p} \cdot m \odot h_\ell, \quad m_j \sim \text{Bernoulli}(1-p)$$

The factor $1/(1-p)$ is **inverted dropout**: it scales up the surviving units so that $\mathbb{E}[\tilde{h}_\ell] = h_\ell$. At test time, no dropout is applied (all units are active), and the expected output matches.

### 5.2 Ensemble Interpretation

**Theorem 5.1 (Informal).** Training with dropout is approximately equivalent to training an ensemble of $2^H$ subnetworks (where $H$ is the total number of hidden units), with shared weights, and averaging their predictions at test time.

**Proof sketch.** Each dropout mask $m$ defines a subnetwork $f_m(\cdot; \theta)$. The dropout training loss is:

$$\mathcal{L}_{\text{dropout}}(\theta) = \mathbb{E}_m\left[\frac{1}{N}\sum_{i=1}^N \ell(f_m(x_i; \theta), y_i)\right]$$

This is the average loss over all $2^H$ possible subnetworks. Minimizing this jointly trains all subnetworks.

At test time (with inverted dropout), the prediction is:

$$f_{\text{test}}(x; \theta) = \mathbb{E}_m[f_m(x; \theta)]$$

For linear models, this expectation can be computed exactly without sampling. For nonlinear models, it is an approximation — the inverted-dropout scaling ensures the first moment matches, but higher moments differ.

### 5.3 Gaussian Dropout and the Reparameterization

Instead of multiplying by Bernoulli masks, we can use Gaussian noise:

$$\tilde{h}_\ell = h_\ell \odot (1 + \epsilon), \quad \epsilon_j \sim \mathcal{N}(0, \alpha)$$

where $\alpha = p/(1-p)$ matches the variance of Bernoulli dropout. This is differentiable everywhere and connects to variational inference (Kingma et al., 2015).

### 5.4 When Dropout Works and When It Doesn't

**Works well:**

- Fully connected layers with many parameters.
- When the model is overparameterized relative to the data.
- Dropout rate $p = 0.5$ for hidden layers, $p = 0.1$-$0.2$ for input layers.

**Works less well:**

- Convolutional layers: spatial dropout (drop entire channels) is better than element-wise dropout.
- Batch normalization layers: BN provides its own regularization; combining with dropout can cause issues (variance mismatch between train and test).
- Very small models: dropout removes too much capacity.

---

## 6. Batch Normalization

### 6.1 Definition

For a mini-batch $\{z_i\}_{i=1}^B$ of pre-activations at some layer, Batch Normalization computes:

$$\hat{z}_i = \frac{z_i - \mu_B}{\sqrt{\sigma_B^2 + \epsilon}} \cdot \gamma + \beta$$

where:

- $\mu_B = \frac{1}{B}\sum_{i=1}^B z_i$ (batch mean)
- $\sigma_B^2 = \frac{1}{B}\sum_{i=1}^B (z_i - \mu_B)^2$ (batch variance)
- $\gamma, \beta$ are learnable scale and shift parameters
- $\epsilon \approx 10^{-5}$ for numerical stability

**Shape annotations** (for a layer with $d$ features):

- $z_i \in \mathbb{R}^d$, $\mu_B \in \mathbb{R}^d$, $\sigma_B^2 \in \mathbb{R}^d$ (computed per-feature)
- $\gamma \in \mathbb{R}^d$, $\beta \in \mathbb{R}^d$ (learnable, per-feature)

### 6.2 Forward Pass Derivation

```
Algorithm: BatchNorm_Forward(Z, gamma, beta, epsilon)
------------------------------------------------------
Input:  Z      - pre-activations, shape (B, d)
        gamma  - scale parameter, shape (d,)
        beta   - shift parameter, shape (d,)
        epsilon - small constant for stability
Output: Z_hat  - normalized activations, shape (B, d)
        cache  - saved values for backward pass

1. mu = mean(Z, axis=0)                  # (d,)
2. Z_centered = Z - mu                   # (B, d)
3. var = mean(Z_centered^2, axis=0)      # (d,)
4. std_inv = 1 / sqrt(var + epsilon)     # (d,)
5. Z_norm = Z_centered * std_inv         # (B, d)
6. Z_hat = gamma * Z_norm + beta         # (B, d)

cache = (Z_centered, std_inv, Z_norm, gamma, B)
Return Z_hat, cache
```

### 6.3 Backward Pass Derivation

This is the most involved backward pass we derive in this module. We need $\frac{\partial \mathcal{L}}{\partial Z}$, $\frac{\partial \mathcal{L}}{\partial \gamma}$, and $\frac{\partial \mathcal{L}}{\partial \beta}$, given $\frac{\partial \mathcal{L}}{\partial \hat{Z}} \in \mathbb{R}^{B \times d}$.

**Step 1: Gradients for learnable parameters.**

$$\frac{\partial \mathcal{L}}{\partial \gamma} = \sum_{i=1}^{B} \frac{\partial \mathcal{L}}{\partial \hat{z}_i} \odot z_{\text{norm},i} \in \mathbb{R}^d$$

$$\frac{\partial \mathcal{L}}{\partial \beta} = \sum_{i=1}^{B} \frac{\partial \mathcal{L}}{\partial \hat{z}_i} \in \mathbb{R}^d$$

**Step 2: Gradient through normalization.** Define $\delta_i = \frac{\partial \mathcal{L}}{\partial \hat{z}_i} \odot \gamma$ (the gradient flowing through the affine transform). We need $\frac{\partial \mathcal{L}}{\partial z_i}$.

Since $z_{\text{norm},i} = (z_i - \mu_B) / \sqrt{\sigma_B^2 + \epsilon}$, and both $\mu_B$ and $\sigma_B^2$ depend on all $z_i$, we must account for these dependencies.

$$\frac{\partial \mathcal{L}}{\partial z_i} = \frac{\partial \mathcal{L}}{\partial z_{\text{norm},i}} \cdot \frac{\partial z_{\text{norm},i}}{\partial z_i} + \sum_j \frac{\partial \mathcal{L}}{\partial z_{\text{norm},j}} \cdot \frac{\partial z_{\text{norm},j}}{\partial \mu_B} \cdot \frac{\partial \mu_B}{\partial z_i} + \sum_j \frac{\partial \mathcal{L}}{\partial z_{\text{norm},j}} \cdot \frac{\partial z_{\text{norm},j}}{\partial \sigma_B^2} \cdot \frac{\partial \sigma_B^2}{\partial z_i}$$

Computing each partial:

$$\frac{\partial z_{\text{norm},i}}{\partial z_i} = \frac{1}{\sqrt{\sigma_B^2 + \epsilon}} = \text{std\_inv}$$

$$\frac{\partial z_{\text{norm},j}}{\partial \mu_B} = -\text{std\_inv}$$

$$\frac{\partial \mu_B}{\partial z_i} = \frac{1}{B}$$

$$\frac{\partial z_{\text{norm},j}}{\partial \sigma_B^2} = -\frac{1}{2}(z_j - \mu_B)(\sigma_B^2 + \epsilon)^{-3/2} = -\frac{1}{2} z_{\text{norm},j} \cdot \text{std\_inv}$$

$$\frac{\partial \sigma_B^2}{\partial z_i} = \frac{2(z_i - \mu_B)}{B}$$

Combining all terms and simplifying:

$$\frac{\partial \mathcal{L}}{\partial z_i} = \frac{\text{std\_inv}}{B}\left(B \cdot \delta_i - \sum_j \delta_j - z_{\text{norm},i} \sum_j \delta_j \odot z_{\text{norm},j}\right)$$

```
Algorithm: BatchNorm_Backward(dZ_hat, cache)
----------------------------------------------
Input:  dZ_hat      - upstream gradient, shape (B, d)
        cache       - saved from forward pass
Output: dZ, dgamma, dbeta

1. (Z_centered, std_inv, Z_norm, gamma, B) = cache
2. dgamma = sum(dZ_hat * Z_norm, axis=0)          # (d,)
3. dbeta  = sum(dZ_hat, axis=0)                    # (d,)
4. delta  = dZ_hat * gamma                         # (B, d)
5. dZ = (std_inv / B) * (
       B * delta
       - sum(delta, axis=0)
       - Z_norm * sum(delta * Z_norm, axis=0)
   )                                                # (B, d)

Return dZ, dgamma, dbeta
```

### 6.4 Training vs. Inference

During training, BN uses per-batch statistics. During inference, it uses running averages computed during training:

$$\mu_{\text{running}} = (1 - \alpha) \mu_{\text{running}} + \alpha \mu_B$$
$$\sigma^2_{\text{running}} = (1 - \alpha) \sigma^2_{\text{running}} + \alpha \sigma_B^2$$

where $\alpha$ is the momentum (typically 0.1 in PyTorch).

**Critical practical note:** Always call `model.eval()` before inference. Failing to do so means BN uses batch statistics from the test batch, which is incorrect and causes accuracy drops (especially for small test batches).

### 6.5 The Internal Covariate Shift Debate

**Original claim (Ioffe & Szegedy, 2015):** BN reduces "internal covariate shift" — the change in the distribution of layer inputs as the preceding layers change during training.

**Counter-evidence (Santurkar et al., 2018):** BN's benefit may not come from reducing covariate shift. Instead, BN makes the loss landscape **smoother** (smaller Lipschitz constant of the loss and its gradient), enabling larger learning rates and faster convergence.

**Theorem 6.1 (Santurkar et al., informal).** For a loss function $\mathcal{L}(\theta)$, BN reduces the upper bound on $\|\nabla \mathcal{L}(\theta + \delta) - \nabla \mathcal{L}(\theta)\|$ (the gradient Lipschitz constant), making the landscape more predictable for gradient-based optimization.

### 6.6 Layer Normalization and Other Variants

| Normalization | Computes stats over | Use case |
|---|---|---|
| Batch Norm | Batch dimension (per feature) | CNNs, large batches |
| Layer Norm | Feature dimension (per example) | Transformers, RNNs |
| Instance Norm | Spatial dims (per channel, per example) | Style transfer |
| Group Norm | Groups of channels (per example) | CNNs, small batches |

Layer Norm normalizes over the feature dimension:

$$\hat{z}_i = \frac{z_i - \mu_i}{\sqrt{\sigma_i^2 + \epsilon}} \cdot \gamma + \beta$$

where $\mu_i = \frac{1}{d}\sum_{j=1}^d z_{i,j}$ and $\sigma_i^2 = \frac{1}{d}\sum_{j=1}^d (z_{i,j} - \mu_i)^2$ are per-example statistics. This removes the dependence on batch size.

---

## 7. Early Stopping

### 7.1 The Method

Monitor validation loss during training. Stop when validation loss has not improved for $k$ consecutive epochs ("patience").

```
Algorithm: EarlyStopping(model, train_data, val_data, patience)
--------------------------------------------------------------
1. best_val_loss = infinity
2. best_params = model.parameters()
3. counter = 0
4. For epoch = 1, 2, ...:
     a. Train one epoch on train_data
     b. Evaluate val_loss on val_data
     c. If val_loss < best_val_loss:
          best_val_loss = val_loss
          best_params = copy(model.parameters())
          counter = 0
        Else:
          counter += 1
     d. If counter >= patience:
          Restore model to best_params
          Return model
```

### 7.2 Early Stopping as Implicit L2 Regularization

**Theorem 7.1 (Bishop, 1995; Sjöberg & Ljung, 1995).** For quadratic loss and gradient descent with learning rate $\eta$, stopping at iteration $T$ is approximately equivalent to L2 regularization with $\lambda \approx 1/(\eta T)$.

**Proof sketch.** For the quadratic loss $\mathcal{L}(\theta) = \frac{1}{2}\theta^\top A \theta - b^\top \theta$, gradient descent from $\theta_0 = 0$ gives:

$$\theta_T = \sum_{t=0}^{T-1}(I - \eta A)^t \cdot \eta b = (I - (I - \eta A)^T) A^{-1} b$$

In the eigenbasis of $A$ with eigenvalues $\lambda_j$:

$$(\theta_T)_j = \frac{1 - (1 - \eta\lambda_j)^T}{\lambda_j} b_j$$

Compare with the ridge solution: $(\hat{\theta}_\text{ridge})_j = \frac{\lambda_j}{\lambda_j + \alpha} \cdot \frac{b_j}{\lambda_j}$

For small $\eta\lambda_j$, $(1 - \eta\lambda_j)^T \approx e^{-\eta\lambda_j T}$, and the GD filter $1 - e^{-\eta\lambda_j T}$ approximates the ridge filter $\frac{\lambda_j}{\lambda_j + 1/(\eta T)}$ with effective $\alpha = 1/(\eta T)$. Both suppress small eigenvalue directions. $\blacksquare$

---

## 8. Advanced Topics

### 8.1 PAC-Bayes Bounds

The PAC-Bayes framework provides **non-vacuous** generalization bounds for deep networks.

**Theorem 8.1 (McAllester, 1999).** For any prior $P$ over hypotheses (chosen before seeing data), posterior $Q$, and $\delta > 0$, with probability at least $1 - \delta$ over the training set:

$$\mathbb{E}_{h \sim Q}[\mathcal{L}_{\text{true}}(h)] \le \mathbb{E}_{h \sim Q}[\mathcal{L}_{\text{train}}(h)] + \sqrt{\frac{\text{KL}(Q \| P) + \ln(N/\delta)}{2N}}$$

**For neural networks:** Take $P = \mathcal{N}(0, \sigma_P^2 I)$ (Gaussian prior on weights) and $Q = \mathcal{N}(\theta^*, \sigma_Q^2 I)$ (posterior centered at trained weights). Then:

$$\text{KL}(Q \| P) = \frac{\|\theta^*\|^2}{2\sigma_P^2} + \frac{d}{2}\left(\frac{\sigma_Q^2}{\sigma_P^2} - 1 - \ln \frac{\sigma_Q^2}{\sigma_P^2}\right)$$

This gives a bound that depends on the **norm of the trained weights** relative to the prior — connecting to L2 regularization.

**Modern results (Dziugaite & Roy, 2017; Pérez-Ortiz et al., 2021):** By optimizing the PAC-Bayes bound directly (as a training objective), one can obtain **non-vacuous** bounds (test error < 100%) for networks trained on MNIST and even CIFAR-10.

### 8.2 Double Descent

**Classical picture:** Test error follows a U-shape as model complexity increases: first decreasing (bias reduction dominates), then increasing (variance increase dominates).

**Double descent (Belkin et al., 2019; Nakkiran et al., 2021):** For modern models, test error follows a more complex pattern:

1. **Underparameterized regime** (parameters $< N$): Classical U-shape applies.
2. **Interpolation threshold** (parameters $\approx N$): The model just barely fits the training data; test error **spikes** dramatically.
3. **Overparameterized regime** (parameters $\gg N$): Test error **decreases** again, sometimes below the classical optimum.

**Why the spike at the interpolation threshold?** When the model has exactly enough capacity to fit the training data, it is forced into a unique solution that fits every point — including noisy ones. This solution has extremely high variance.

**Why does overparameterization help?** With many more parameters than needed, there are infinitely many solutions that fit the training data. Gradient descent (with implicit regularization) selects a solution with particular properties (e.g., minimum norm in parameter space), which tends to be smoother and generalize better.

**Epoch-wise double descent.** The phenomenon also occurs over training time: test error can decrease, then increase (overfitting), then decrease again with more training.

### 8.3 Implicit Regularization of Gradient Descent

SGD does not just find any minimizer of the training loss — it finds a **particular** minimizer that depends on:

1. **Learning rate:** Larger learning rates bias toward flatter minima (SAM, Sharpness-Aware Minimization, formalizes this).
2. **Batch size:** Smaller batches add gradient noise that helps escape sharp minima.
3. **Architecture:** The parameterization of the network biases the solution (e.g., convolutional structure biases toward translation-invariant features).
4. **Initialization:** Starting near zero biases toward low-rank or low-norm solutions.

For linear models trained by gradient descent on underdetermined systems ($p > N$), the implicit bias is the **minimum $\ell_2$-norm solution** — exactly what explicit L2 regularization would give.

---

## 9. PyTorch Implementation

```python
"""
Regularization techniques: implementation and comparison.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import matplotlib.pyplot as plt
from copy import deepcopy

# ── MLP with configurable regularization ─────────────────────────

class RegularizedMLP(nn.Module):
    """
    MLP with optional dropout and batch normalization.

    Args:
        d_in:      input dimension
        d_hidden:  hidden layer width
        n_layers:  number of hidden layers
        d_out:     output dimension
        dropout_p: dropout probability (0 = no dropout)
        use_bn:    whether to use batch normalization
    """
    def __init__(
        self,
        d_in: int = 784,
        d_hidden: int = 256,
        n_layers: int = 3,
        d_out: int = 10,
        dropout_p: float = 0.0,
        use_bn: bool = False,
    ):
        super().__init__()
        self.layers = nn.ModuleList()
        self.bns = nn.ModuleList() if use_bn else None
        self.dropout_p = dropout_p
        self.use_bn = use_bn

        dims = [d_in] + [d_hidden] * n_layers + [d_out]
        for i in range(len(dims) - 1):
            self.layers.append(nn.Linear(dims[i], dims[i + 1]))
            if use_bn and i < len(dims) - 2:  # no BN on output layer
                self.bns.append(nn.BatchNorm1d(dims[i + 1]))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, d_in)
        for i, layer in enumerate(self.layers[:-1]):
            x = layer(x)                          # (B, d_hidden)
            if self.use_bn and self.bns is not None:
                x = self.bns[i](x)                # (B, d_hidden)
            x = F.relu(x)                         # (B, d_hidden)
            if self.dropout_p > 0:
                x = F.dropout(x, p=self.dropout_p,
                              training=self.training)  # (B, d_hidden)
        x = self.layers[-1](x)                    # (B, d_out)
        return x

# ── Batch Normalization from scratch ─────────────────────────────

class ManualBatchNorm1d(nn.Module):
    """
    Batch Normalization implemented from scratch, following the
    derivation in Section 6.
    """
    def __init__(self, num_features: int, eps: float = 1e-5,
                 momentum: float = 0.1):
        super().__init__()
        self.num_features = num_features
        self.eps = eps
        self.momentum = momentum

        # Learnable parameters
        self.gamma = nn.Parameter(torch.ones(num_features))    # (d,)
        self.beta = nn.Parameter(torch.zeros(num_features))    # (d,)

        # Running statistics (not parameters, not trained by gradient descent)
        self.register_buffer('running_mean', torch.zeros(num_features))
        self.register_buffer('running_var', torch.ones(num_features))

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        # z: (B, d)
        if self.training:
            mu = z.mean(dim=0)                                  # (d,)
            var = z.var(dim=0, unbiased=False)                  # (d,)

            # Update running statistics
            with torch.no_grad():
                self.running_mean = ((1 - self.momentum) * self.running_mean
                                     + self.momentum * mu)
                self.running_var = ((1 - self.momentum) * self.running_var
                                    + self.momentum * var)
        else:
            mu = self.running_mean                               # (d,)
            var = self.running_var                                # (d,)

        z_norm = (z - mu) / torch.sqrt(var + self.eps)          # (B, d)
        z_hat = self.gamma * z_norm + self.beta                 # (B, d)
        return z_hat

# ── Dropout from scratch ─────────────────────────────────────────

class ManualDropout(nn.Module):
    """
    Inverted dropout implemented from scratch.
    """
    def __init__(self, p: float = 0.5):
        super().__init__()
        self.p = p  # probability of dropping a unit

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if not self.training or self.p == 0:
            return x
        # Generate Bernoulli mask: 1 with probability (1-p), 0 with probability p
        mask = (torch.rand_like(x) > self.p).float()  # (same shape as x)
        # Scale by 1/(1-p) so that E[output] = input
        return x * mask / (1 - self.p)

# ── Early stopping ───────────────────────────────────────────────

class EarlyStopping:
    """
    Early stopping to halt training when validation loss stops improving.
    """
    def __init__(self, patience: int = 10, min_delta: float = 1e-4):
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss = float('inf')
        self.best_model_state = None
        self.should_stop = False

    def __call__(self, val_loss: float, model: nn.Module):
        if val_loss < self.best_loss - self.min_delta:
            self.best_loss = val_loss
            self.best_model_state = deepcopy(model.state_dict())
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.should_stop = True

    def restore_best(self, model: nn.Module):
        if self.best_model_state is not None:
            model.load_state_dict(self.best_model_state)

# ── Training loop with regularization comparison ─────────────────

def compare_regularization(
    train_loader,
    val_loader,
    n_epochs: int = 50,
):
    """
    Compare different regularization strategies on the same architecture.
    """
    configs = {
        'No regularization': {'dropout_p': 0.0, 'use_bn': False, 'wd': 0.0},
        'L2 (wd=1e-4)': {'dropout_p': 0.0, 'use_bn': False, 'wd': 1e-4},
        'Dropout (p=0.5)': {'dropout_p': 0.5, 'use_bn': False, 'wd': 0.0},
        'BatchNorm': {'dropout_p': 0.0, 'use_bn': True, 'wd': 0.0},
        'All combined': {'dropout_p': 0.3, 'use_bn': True, 'wd': 1e-4},
    }

    results = {}
    for name, cfg in configs.items():
        print(f"Training: {name}")
        model = RegularizedMLP(
            dropout_p=cfg['dropout_p'],
            use_bn=cfg['use_bn'],
        )
        optimizer = torch.optim.Adam(
            model.parameters(), lr=1e-3, weight_decay=cfg['wd']
        )
        loss_fn = nn.CrossEntropyLoss()
        early_stop = EarlyStopping(patience=10)

        train_losses, val_losses = [], []
        for epoch in range(n_epochs):
            # Training
            model.train()
            epoch_loss = 0.0
            n_batches = 0
            for bx, by in train_loader:
                logits = model(bx)                   # (B, 10)
                loss = loss_fn(logits, by)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                epoch_loss += loss.item()
                n_batches += 1
            train_losses.append(epoch_loss / n_batches)

            # Validation
            model.eval()
            val_loss = 0.0
            n_val = 0
            with torch.no_grad():
                for bx, by in val_loader:
                    logits = model(bx)
                    loss = loss_fn(logits, by)
                    val_loss += loss.item()
                    n_val += 1
            val_losses.append(val_loss / n_val)

            early_stop(val_losses[-1], model)
            if early_stop.should_stop:
                print(f"  Early stopping at epoch {epoch}")
                early_stop.restore_best(model)
                break

        results[name] = {'train': train_losses, 'val': val_losses}

    # Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    for name, data in results.items():
        ax1.plot(data['train'], label=name)
        ax2.plot(data['val'], label=name)
    ax1.set_title('Training Loss')
    ax2.set_title('Validation Loss')
    for ax in (ax1, ax2):
        ax.set_xlabel('Epoch')
        ax.set_ylabel('Loss')
        ax.legend(fontsize=8)
        ax.set_yscale('log')
    plt.tight_layout()
    plt.savefig('regularization_comparison.png', dpi=150)
    plt.show()
    return results

# ── L1 vs L2 visualization ──────────────────────────────────────

def visualize_l1_vs_l2():
    """
    2D visualization of L1 vs L2 constraint regions
    and how they interact with loss contours.
    """
    import numpy as np

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    # Loss contours (elongated ellipse)
    theta1 = np.linspace(-2, 2, 200)
    theta2 = np.linspace(-2, 2, 200)
    T1, T2 = np.meshgrid(theta1, theta2)
    # Elliptical loss: (theta1 - 1.5)^2 + 10*(theta2 - 0.3)^2
    L = (T1 - 1.5)**2 + 10 * (T2 - 0.3)**2

    for ax, title, constraint_fn in [
        (ax1, 'L1 (Lasso)', lambda t1, t2: np.abs(t1) + np.abs(t2)),
        (ax2, 'L2 (Ridge)', lambda t1, t2: t1**2 + t2**2),
    ]:
        ax.contour(T1, T2, L, levels=20, cmap='Blues', alpha=0.6)
        # Constraint boundary
        C = constraint_fn(T1, T2)
        ax.contour(T1, T2, C, levels=[1.0], colors='red', linewidths=2)
        ax.contourf(T1, T2, C, levels=[0, 1.0], colors=['red'], alpha=0.1)
        ax.set_xlabel(r'$\theta_1$')
        ax.set_ylabel(r'$\theta_2$')
        ax.set_title(title)
        ax.set_aspect('equal')
        ax.axhline(0, color='gray', linewidth=0.5)
        ax.axvline(0, color='gray', linewidth=0.5)

    plt.tight_layout()
    plt.savefig('l1_vs_l2.png', dpi=150)
    plt.show()

# ── Demo ─────────────────────────────────────────────────────────

if __name__ == '__main__':
    from torch.utils.data import DataLoader, TensorDataset, random_split

    # Synthetic data (with some noise to make regularization matter)
    N = 2000
    X = torch.randn(N, 784)
    # Noisy labels: true function + label noise
    true_w = torch.randn(784, 10) * 0.01
    logits = X @ true_w
    Y = logits.argmax(dim=1)
    # Flip 10% of labels (noise)
    flip_mask = torch.rand(N) < 0.1
    Y[flip_mask] = torch.randint(0, 10, (flip_mask.sum(),))

    dataset = TensorDataset(X, Y)
    train_data, val_data = random_split(dataset, [1600, 400])
    train_loader = DataLoader(train_data, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_data, batch_size=64)

    print("=== Regularization Comparison ===")
    compare_regularization(train_loader, val_loader)

    print("\n=== L1 vs L2 Visualization ===")
    visualize_l1_vs_l2()
```

---

## 10. Experimental Intuition

### 10.1 Regularization Selection Guide

| Technique | When to Use | Typical Settings |
|---|---|---|
| L2 / Weight Decay | Always (essentially free) | $\lambda = 10^{-4}$ to $10^{-2}$ |
| Dropout | FC layers, overparameterized models | $p = 0.1$ to $0.5$ |
| Batch Norm | CNNs, deep networks | Default settings |
| Layer Norm | Transformers, RNNs | Default settings |
| Early Stopping | Always (no cost) | Patience 5-20 epochs |
| Data Augmentation | Whenever domain knowledge allows | Task-specific |

### 10.2 Interactions Between Techniques

- **Dropout + BN:** Can be problematic. BN expects consistent activation statistics, but dropout changes the variance between train and test. Solutions: put dropout after BN, or use only one.
- **Weight decay + Adam:** Use AdamW, not Adam with L2 penalty (see Lecture 01c).
- **Early stopping + LR scheduling:** These interact. Cosine annealing naturally reduces LR, reducing the need for early stopping. Use both for safety.

---

## 11. Connections and Extensions

### 11.1 Links Within This Module

- **Lecture 01a (UAT):** The UAT says we can approximate any function; regularization limits which approximation we find.
- **Lecture 01b (Backprop):** BN and dropout modify the backward pass. Understanding their gradients is essential.
- **Lecture 01c (Optimization):** Weight decay is part of the optimizer; BN smooths the loss landscape.

### 11.2 Links to Future Modules

- **Module 02 (CNNs):** Batch Norm is ubiquitous. Data augmentation is the primary regularizer.
- **Module 05 (Transformers):** Layer Norm replaces BN. Dropout is applied to attention weights and FFN outputs.
- **Module 06 (Generative Models):** Regularization in VAEs (KL divergence) and GANs (spectral normalization).

---

## 12. Seminal Paper Reading List

### Required Reading

1. **Srivastava, N., Hinton, G., Krizhevsky, A., Sutskever, I., & Salakhutdinov, R.** (2014). "Dropout: A simple way to prevent neural networks from overfitting." *JMLR*, 15(1), 1929-1958.
   - The original dropout paper. Thorough empirical study.

2. **Ioffe, S. & Szegedy, C.** (2015). "Batch Normalization: Accelerating deep network training by reducing internal covariate shift." *ICML 2015*.
   - Batch Normalization. One of the most impactful papers in deep learning.

### Recommended Reading

3. **Nakkiran, P., Kaplun, G., Bansal, Y., Yang, T., Barak, B., & Sutskever, I.** (2021). "Deep double descent: Where bigger models and more data can hurt." *JSTAT*, 2021(12).
   - Comprehensive study of double descent across model size, data size, and training time.

4. **Santurkar, S., Tsipras, D., Ilyas, A., & Madry, A.** (2018). "How does Batch Normalization help optimization?" *NeurIPS 2018*.
   - Challenges the internal covariate shift explanation; proposes the smoothing perspective.

5. **Belkin, M., Hsu, D., Ma, S., & Mandal, S.** (2019). "Reconciling modern machine learning practice and the bias-variance trade-off." *PNAS*, 116(32), 15849-15854.
   - Introduces the "double descent" curve.

### Supplementary

6. **Glorot, X. & Bengio, Y.** (2010). "Understanding the difficulty of training deep feedforward neural networks." *AISTATS 2010*.

7. **Dziugaite, G. K. & Roy, D. M.** (2017). "Computing nonvacuous generalization bounds for deep (stochastic) neural networks with many more parameters than training data." *UAI 2017*.
   - First non-vacuous PAC-Bayes bounds for deep networks.

8. **Ba, J. L., Kiros, J. R., & Hinton, G. E.** (2016). "Layer Normalization." *arXiv:1607.06450*.

---

## 13. Exercises

### Theory Exercises

**Exercise 4.1.** Derive the bias-variance decomposition for the **0-1 classification loss**. Show that the decomposition is not as clean as for squared loss (define appropriate analogs of bias and variance).

**Exercise 4.2.** For L2 regularization on linear regression with design matrix $X \in \mathbb{R}^{N \times p}$ and SVD $X = U\Sigma V^\top$:

- (a) Show that the ridge solution can be written as $\hat{\theta}_{\text{ridge}} = V D_\lambda \Sigma^{-1} U^\top y$ where $D_\lambda = \text{diag}\left(\frac{\sigma_j^2}{\sigma_j^2 + N\lambda}\right)$.
- (b) Compute the effective degrees of freedom: $\text{df}(\lambda) = \text{tr}(X(X^\top X + N\lambda I)^{-1} X^\top) = \sum_j \frac{\sigma_j^2}{\sigma_j^2 + N\lambda}$.
- (c) Show that $\text{df}(\lambda) \to p$ as $\lambda \to 0$ and $\text{df}(\lambda) \to 0$ as $\lambda \to \infty$.

**Exercise 4.3.** Prove that dropout with rate $p$ on a linear layer $y = Wx$ is equivalent (in expectation) to L2 regularization. Specifically, show that:

$$\mathbb{E}_m[\|y_{\text{true}} - m \odot (Wx)\|^2] = \|y_{\text{true}} - (1-p)Wx\|^2 + p(1-p) \sum_j \|W_{:,j}\|^2 x_j^2$$

Interpret the second term as an input-dependent weight penalty.

**Exercise 4.4.** Derive the complete backward pass for Layer Normalization. Compare the computational complexity with Batch Normalization.

**Exercise 4.5.** (Double descent) Consider the minimum-norm least-squares solution for an overparameterized linear model ($p > N$): $\hat{\theta} = X^\top (XX^\top)^{-1}y$.

- (a) Show that this is the minimum $\ell_2$-norm interpolator.
- (b) Compute the test risk and show it has a spike at $p \approx N$.
- (c) Show that the test risk decreases for $p \gg N$ (the overparameterized regime).

### Implementation Exercises

**Exercise 4.6.** Implement Batch Normalization from scratch (forward and backward) using only NumPy. Verify against `torch.nn.BatchNorm1d` by comparing outputs and gradients.

**Exercise 4.7.** Implement inverted dropout from scratch and verify:

- (a) That $\mathbb{E}[\text{output}] = \text{input}$ (test empirically by averaging over many forward passes).
- (b) That the variance of the output increases by a factor of $1/(1-p)$.

**Exercise 4.8.** Reproduce the double descent curve:

- Train polynomial regression models of degree $d = 1, 2, \ldots, 100$ on $N = 20$ noisy data points.
- Plot test MSE vs. model complexity $d$.
- Identify the interpolation threshold and the second descent.

**Exercise 4.9.** Run the regularization comparison experiment from Section 9 on MNIST:

- Compare: no regularization, L2 only, dropout only, BN only, all combined.
- Report both training and test accuracy/loss curves.
- Which combination gives the best test accuracy? The smallest train-test gap?

---

*Next: Homework 01 — MLP from Scratch*
