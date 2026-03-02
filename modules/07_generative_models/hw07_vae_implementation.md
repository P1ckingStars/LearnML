# Homework 07: Variational Autoencoders and Generative Models

**Estimated time**: ~20 hours
**Due**: Two weeks from assignment date

---

## Overview

This homework consists of two parts. Part A focuses on mathematical derivations that build your theoretical foundations in variational inference, latent variable models, and change of variables. Part B requires you to implement and train several generative models from scratch, analyzing their behavior empirically.

**Submission**: A single PDF (for Part A) and a code repository with a README (for Part B). Include all plots, training curves, and analysis in your writeup.

---

## Part A: Theory (50%)

### Problem 1: Two Derivations of the ELBO (10%)

**(a)** Derive the Evidence Lower Bound starting from Jensen's inequality.

Let $q(z)$ be any distribution over the latent space. Starting from:

$$\log p_\theta(x) = \log \int p_\theta(x, z) \, dz$$

Introduce $q(z)$ and apply Jensen's inequality to obtain:

$$\log p_\theta(x) \geq \mathbb{E}_{q(z)}\left[\log \frac{p_\theta(x, z)}{q(z)}\right] = \mathcal{L}(\theta, q)$$

Show every step, explicitly stating where Jensen's inequality is applied and why the inequality direction is correct.

**(b)** Derive the ELBO starting from the KL divergence between $q(z)$ and the true posterior $p_\theta(z \mid x)$.

Starting from:

$$D_{\text{KL}}(q(z) \| p_\theta(z \mid x)) \geq 0$$

Expand using the definition of KL divergence, apply Bayes' rule to $p_\theta(z \mid x)$, and rearrange to obtain:

$$\log p_\theta(x) = \mathcal{L}(\theta, q) + D_{\text{KL}}(q(z) \| p_\theta(z \mid x))$$

Identify the gap between the ELBO and the true log-likelihood and explain when this gap is zero.

**(c)** Show that the ELBO decomposes as:

$$\mathcal{L}(\theta, q) = \underbrace{\mathbb{E}_{q(z)}[\log p_\theta(x \mid z)]}_{\text{reconstruction}} - \underbrace{D_{\text{KL}}(q(z) \| p(z))}_{\text{regularization}}$$

Give an intuitive explanation of each term and why they compete.

### Problem 2: The Reparameterization Trick (10%)

**(a)** Explain why we cannot directly backpropagate through the sampling operation $z \sim q_\phi(z \mid x)$.

**(b)** For $q_\phi(z \mid x) = \mathcal{N}(\mu_\phi(x), \text{diag}(\sigma_\phi^2(x)))$, write the reparameterization:

$$z = g(\phi, \epsilon, x), \quad \epsilon \sim p(\epsilon)$$

State explicitly what $g$, $p(\epsilon)$ are, and why $\nabla_\phi \mathbb{E}_{q_\phi}[f(z)]$ can now be computed via backpropagation.

**(c)** Derive the gradient estimator. Show:

$$\nabla_\phi \mathbb{E}_{q_\phi(z \mid x)}[f(z)] = \mathbb{E}_{p(\epsilon)}[\nabla_\phi f(g(\phi, \epsilon, x))]$$

Prove this step by step. Then apply the chain rule to express the gradient in terms of $\nabla_z f$, $\nabla_\phi \mu_\phi$, and $\nabla_\phi \sigma_\phi$.

**(d)** Compare the reparameterization trick estimator to the REINFORCE (score function) estimator:

$$\nabla_\phi \mathbb{E}_{q_\phi}[f(z)] = \mathbb{E}_{q_\phi}[f(z) \nabla_\phi \log q_\phi(z \mid x)]$$

Prove the REINFORCE identity using the log-derivative trick. For $f(z) = z^2$, $q_\phi = \mathcal{N}(\mu, 1)$, compute the variance of both estimators as a function of $\mu$. Which has lower variance and why?

### Problem 3: KL Divergence Between Diagonal Gaussians (10%)

**(a)** Derive the KL divergence between two univariate Gaussians:

$$D_{\text{KL}}(\mathcal{N}(\mu_1, \sigma_1^2) \| \mathcal{N}(\mu_2, \sigma_2^2))$$

from the definition: $D_{\text{KL}}(q \| p) = \int q(x) \log \frac{q(x)}{p(x)} \, dx$.

Show all intermediate steps. You should arrive at:

$$D_{\text{KL}} = \log\frac{\sigma_2}{\sigma_1} + \frac{\sigma_1^2 + (\mu_1 - \mu_2)^2}{2\sigma_2^2} - \frac{1}{2}$$

**(b)** Generalize to $d$-dimensional diagonal Gaussians. Show that independence across dimensions implies the KL decomposes as a sum:

$$D_{\text{KL}}(\mathcal{N}(\mu_1, \Sigma_1) \| \mathcal{N}(\mu_2, \Sigma_2)) = \sum_{j=1}^d D_{\text{KL}}(\mathcal{N}(\mu_{1,j}, \sigma_{1,j}^2) \| \mathcal{N}(\mu_{2,j}, \sigma_{2,j}^2))$$

where $\Sigma_1 = \text{diag}(\sigma_1^2)$, $\Sigma_2 = \text{diag}(\sigma_2^2)$.

**(c)** Specialize to the VAE case: $q = \mathcal{N}(\mu, \text{diag}(\sigma^2))$, $p = \mathcal{N}(0, I)$. Derive:

$$D_{\text{KL}}(q \| p) = \frac{1}{2}\sum_{j=1}^d [\sigma_j^2 + \mu_j^2 - 1 - \log \sigma_j^2]$$

Verify that this is zero when $\mu = 0$ and $\sigma = 1$ (i.e., $q = p$). Show it is strictly positive otherwise by proving each term $h(s) = s + s^{-1} - 2 \geq 0$ for $s > 0$ (where $s = \sigma_j^2$), with equality iff $s = 1$.

### Problem 4: Change of Variables Formula (10%)

**(a)** State the change of variables formula for a diffeomorphism $f: \mathbb{R}^D \to \mathbb{R}^D$. Derive it from the probability integral transform in 1D, then extend to multiple dimensions using the Jacobian.

**(b)** For the affine coupling layer:

$$y_{1:d} = z_{1:d}, \quad y_{d+1:D} = z_{d+1:D} \odot \exp(s(z_{1:d})) + t(z_{1:d})$$

Compute the full Jacobian matrix $\frac{\partial y}{\partial z}$ in block form. Show it is lower triangular and compute its determinant. Explain why this gives $O(D)$ determinant computation.

**(c)** For a composition of $K$ transformations $x = f_K \circ \cdots \circ f_1(z_0)$, derive:

$$\log p_X(x) = \log p_Z(z_0) - \sum_{k=1}^K \log|\det J_{f_k}(z_{k-1})|$$

**(d)** For the continuous normalizing flow with dynamics $dz/dt = v_\theta(z, t)$, derive the instantaneous change of variables:

$$\frac{d}{dt}\log p(z(t), t) = -\text{tr}\left(\frac{\partial v_\theta}{\partial z}\right)$$

Start from the Euler discretization with step $\epsilon$, compute $\log|\det(I + \epsilon J_v)|$ to first order, and take the limit $\epsilon \to 0$.

### Problem 5: Analysis of Posterior Collapse (10%)

Consider a linear VAE with:
- Encoder: $q_\phi(z \mid x) = \mathcal{N}(Wx + b, \text{diag}(\sigma^2))$ where $W \in \mathbb{R}^{d \times D}$, $b \in \mathbb{R}^d$, and $\sigma^2 \in \mathbb{R}^d$ (learned but shared across datapoints).
- Decoder: $p_\theta(x \mid z) = \mathcal{N}(Vz + c, \gamma^2 I)$ where $V \in \mathbb{R}^{D \times d}$, $c \in \mathbb{R}^D$.
- Prior: $p(z) = \mathcal{N}(0, I)$.

**(a)** Write out the ELBO $\mathcal{L}(\theta, \phi; x)$ in closed form (both the reconstruction term and the KL term).

**(b)** Show that the expected reconstruction term (under $q_\phi$) can be written as:

$$\mathbb{E}_{q_\phi}[\log p_\theta(x \mid z)] = -\frac{D}{2}\log(2\pi\gamma^2) - \frac{1}{2\gamma^2}\left[\|x - V(Wx+b) - c\|^2 + \text{tr}(V^\top V \text{diag}(\sigma^2))\right]$$

**(c)** Analyze the KL term:

$$D_{\text{KL}}(q_\phi \| p) = \frac{1}{2}\sum_{j=1}^d [\sigma_j^2 + (Wx+b)_j^2 - 1 - \log\sigma_j^2]$$

For large $\gamma^2$ (high observation noise), show that the optimal $\sigma_j^2 \to 1$ and $(Wx + b)_j \to 0$, i.e., posterior collapse occurs.

**(d)** Find the critical value of $\gamma^2$ (as a function of the singular values of $V$) at which posterior collapse begins. Hint: consider the case $d = 1$ and $V$ has singular value $s$.

**(e)** Explain in words: why does a powerful autoregressive decoder cause posterior collapse in a VAE? Connect to the mathematical analysis above.

---

## Part B: Implementation (50%)

All implementations should be in PyTorch. Include training curves for all experiments.

### Problem 6: VAE from Scratch (15%)

Implement a Variational Autoencoder from scratch and train it on CelebA (64x64 resolution).

**(a)** **Architecture** (5%):
- Build a convolutional encoder that maps 64x64x3 images to a latent space of dimension $d = 128$. Use the architecture: 4 Conv layers (channels: 32, 64, 128, 256, kernel 4x4, stride 2) with ReLU activations, followed by linear layers to produce $\mu$ and $\log\sigma^2$.
- Build a mirror decoder using transposed convolutions with a sigmoid output.
- Report the total number of parameters.

**(b)** **Training** (5%):
- Implement the VAE loss: binary cross-entropy reconstruction + analytic KL.
- Train for 50 epochs with Adam (lr=1e-4) and batch size 128.
- Plot the ELBO, reconstruction loss, and KL divergence over training.
- Show 8 random reconstructions at epochs 1, 10, 25, and 50.
- Show 16 random samples from the trained model.

**(c)** **Analysis** (5%):
- Interpolate between 5 pairs of images in latent space (show 10 steps each).
- Compute the active units: how many latent dimensions have $D_{\text{KL}}(q_\phi(z_j \mid x) \| p(z_j)) > 0.01$ on average? What fraction of the 128 dimensions are "active"?

### Problem 7: KL Annealing and Beta-VAE (15%)

**(a)** **KL Annealing** (5%):
Implement three KL annealing strategies:
1. No annealing ($\beta = 1$ throughout).
2. Linear annealing ($\beta$ from 0 to 1 over the first 25 epochs).
3. Cyclical annealing (4 cycles over 50 epochs, each cycling $\beta$ from 0 to 1).

For each, train a VAE on CelebA and plot:
- KL divergence over training.
- Number of active latent dimensions over training.
- Reconstruction quality at epoch 50 (show 8 examples each).

Which strategy best avoids posterior collapse?

**(b)** **Beta-VAE** (5%):
Train beta-VAEs with $\beta \in \{0.5, 1, 2, 4, 10\}$ (no annealing).

For each:
- Report final reconstruction loss and KL.
- Show latent traversals: for each of the top 5 latent dimensions (by KL), show an image grid where that dimension varies from $-3$ to $+3$ in 11 steps.
- Qualitatively: which latent dimensions correspond to which visual factors (e.g., smile, hair color, pose)?

Plot a curve: $\beta$ vs. reconstruction quality and $\beta$ vs. number of "interpretable" dimensions.

**(c)** **Free Bits** (5%):
Implement the free bits strategy with $\lambda \in \{0.0, 0.125, 0.25, 0.5, 1.0\}$ nats per dimension. Compare KL and reconstruction quality with KL annealing. Which approach gives better results?

### Problem 8: RealNVP Implementation (10%)

**(a)** **2D Normalizing Flow** (5%):
Implement RealNVP with affine coupling layers for 2D data.

Train on three toy distributions:
1. Two moons (from scikit-learn).
2. Concentric rings (two circles at radii 1 and 2).
3. A mixture of 8 Gaussians arranged in a circle.

For each distribution:
- Plot training data, learned density (as a contour plot), generated samples, and the latent space.
- Report the test negative log-likelihood.
- Ablate the number of layers $K \in \{2, 4, 8, 16\}$ and plot NLL vs. $K$.

**(b)** **Comparison: VAE vs. Flow** (5%):
On the same three 2D distributions:
- Train a VAE with 2D latent space.
- Compare visually: which produces sharper density estimates? Which better captures multimodality?
- Compare numerically: ELBO (for VAE) vs. exact NLL (for flow).
- Discuss: what fundamental property of flows gives them an advantage on these tasks?

### Problem 9: Bringing It Together (10%)

**(a)** **Quantitative Comparison Table** (5%):
On Fashion-MNIST (28x28 grayscale), train:
1. Standard VAE ($d = 20$).
2. Beta-VAE ($d = 20$, $\beta = 4$).
3. VAE with KL annealing ($d = 20$, linear annealing over 20 epochs).

For each, report:
- Negative ELBO (nats/dim).
- Reconstruction MSE on the test set.
- Number of active latent dimensions.
- Show 64 random samples in an 8x8 grid.

**(b)** **Latent Space Analysis** (5%):
For the best-performing model from (a):
- Apply t-SNE to the latent representations of the test set, colored by class label. Are the classes separated?
- Perform class-conditional generation: for each of the 10 Fashion-MNIST classes, find the mean latent vector of all test images in that class. Decode these 10 mean vectors and show the results. Do they look like prototypical items?
- Interpolate between class centroids (e.g., "T-shirt" to "Coat"). Show 10-step interpolations for 3 pairs.

---

## Grading Rubric

| Component | Points |
|-----------|--------|
| Problem 1: ELBO Derivations | 10 |
| Problem 2: Reparameterization Trick | 10 |
| Problem 3: KL Divergence | 10 |
| Problem 4: Change of Variables | 10 |
| Problem 5: Posterior Collapse Analysis | 10 |
| Problem 6: VAE Implementation | 15 |
| Problem 7: KL Annealing and Beta-VAE | 15 |
| Problem 8: RealNVP Implementation | 10 |
| Problem 9: Comparison and Analysis | 10 |
| **Total** | **100** |

**Note on code quality**: Your implementation should be clean, well-documented, and runnable. Include a `requirements.txt` and a `README.md` with instructions to reproduce your results. Deductions will be applied for code that does not run, missing plots, or insufficient analysis.

---

## Tips

1. **Start early**. The implementation tasks (especially CelebA training) require significant GPU time.
2. **Monitor KL during training**. If it goes to zero and stays there, you have posterior collapse.
3. **Use TensorBoard or Weights & Biases** for logging training metrics and visualizations.
4. **For CelebA**: Download via `torchvision.datasets.CelebA` and center-crop to 128x128, then resize to 64x64. Normalize to [0, 1].
5. **For the RealNVP 2D experiments**: Training should be fast (~1 minute on CPU for 500 epochs).
6. **Debugging VAEs**: If reconstructions are blurry but samples look reasonable, the model is working correctly — the blurriness comes from the Gaussian likelihood. If both are bad, check the loss computation.
