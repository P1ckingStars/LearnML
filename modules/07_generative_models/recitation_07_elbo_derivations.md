# Recitation 07: ELBO Derivations, Reparameterization, and IWAE

## Overview

This recitation provides three complete derivations of the Evidence Lower Bound, worked examples for specific models, a step-by-step walkthrough of the reparameterization trick, a derivation of the Importance-Weighted Autoencoder (IWAE) bound, and practice problems with full solutions.

---

## 1. Three Derivations of the ELBO

### 1.1 Derivation 1: Jensen's Inequality

**Setup**: We want to compute $\log p_\theta(x) = \log \int p_\theta(x, z) \, dz$, which is intractable. We introduce an arbitrary distribution $q(z)$.

**Step 1**: Multiply and divide by $q(z)$ inside the integral.

$$\log p_\theta(x) = \log \int p_\theta(x, z) \, dz = \log \int \frac{p_\theta(x, z)}{q(z)} q(z) \, dz$$

**Step 2**: Recognize this as $\log \mathbb{E}_{q(z)}\left[\frac{p_\theta(x, z)}{q(z)}\right]$.

**Step 3**: Apply Jensen's inequality. Since $\log$ is a concave function:

$$\log \mathbb{E}_{q(z)}\left[\frac{p_\theta(x, z)}{q(z)}\right] \geq \mathbb{E}_{q(z)}\left[\log \frac{p_\theta(x, z)}{q(z)}\right]$$

**Step 4**: Expand.

$$\mathbb{E}_{q(z)}\left[\log \frac{p_\theta(x, z)}{q(z)}\right] = \mathbb{E}_{q(z)}[\log p_\theta(x, z)] - \mathbb{E}_{q(z)}[\log q(z)]$$

$$= \mathbb{E}_{q(z)}[\log p_\theta(x, z)] + \mathbb{H}[q]$$

This is the ELBO: $\mathcal{L}(\theta, q) = \mathbb{E}_{q(z)}[\log p_\theta(x, z)] + \mathbb{H}[q]$.

**Step 5**: Alternative form. Since $p_\theta(x, z) = p_\theta(x \mid z) p(z)$:

$$\mathcal{L} = \mathbb{E}_{q(z)}[\log p_\theta(x \mid z) + \log p(z) - \log q(z)]$$

$$= \mathbb{E}_{q(z)}[\log p_\theta(x \mid z)] - \mathbb{E}_{q(z)}\left[\log \frac{q(z)}{p(z)}\right]$$

$$= \underbrace{\mathbb{E}_{q(z)}[\log p_\theta(x \mid z)]}_{\text{reconstruction}} - \underbrace{D_{\text{KL}}(q(z) \| p(z))}_{\text{regularization}}$$

$\blacksquare$

### 1.2 Derivation 2: KL Divergence Gap

**Step 1**: Start from the KL divergence between $q(z)$ and the true posterior $p_\theta(z \mid x)$.

$$D_{\text{KL}}(q(z) \| p_\theta(z \mid x)) = \mathbb{E}_{q(z)}\left[\log \frac{q(z)}{p_\theta(z \mid x)}\right]$$

**Step 2**: Expand using Bayes' rule: $p_\theta(z \mid x) = \frac{p_\theta(x, z)}{p_\theta(x)}$.

$$= \mathbb{E}_{q(z)}\left[\log \frac{q(z) \cdot p_\theta(x)}{p_\theta(x, z)}\right]$$

$$= \mathbb{E}_{q(z)}\left[\log q(z) - \log p_\theta(x, z) + \log p_\theta(x)\right]$$

**Step 3**: Since $\log p_\theta(x)$ does not depend on $z$:

$$= -\mathbb{E}_{q(z)}\left[\log \frac{p_\theta(x, z)}{q(z)}\right] + \log p_\theta(x)$$

$$= -\mathcal{L}(\theta, q) + \log p_\theta(x)$$

**Step 4**: Rearrange.

$$\log p_\theta(x) = \mathcal{L}(\theta, q) + D_{\text{KL}}(q(z) \| p_\theta(z \mid x))$$

Since $D_{\text{KL}} \geq 0$:

$$\log p_\theta(x) \geq \mathcal{L}(\theta, q)$$

with equality iff $q(z) = p_\theta(z \mid x)$ a.e. $\blacksquare$

**Key insight**: This derivation tells us exactly what the gap is: $D_{\text{KL}}(q \| p_\theta(z \mid x))$. The ELBO is tight when $q$ equals the true posterior.

### 1.3 Derivation 3: Importance Sampling

**Step 1**: Write the marginal likelihood as an importance sampling estimator.

$$p_\theta(x) = \int p_\theta(x, z) \, dz = \int \frac{p_\theta(x, z)}{q(z)} q(z) \, dz = \mathbb{E}_{q(z)}\left[\frac{p_\theta(x, z)}{q(z)}\right]$$

**Step 2**: Take the log.

$$\log p_\theta(x) = \log \mathbb{E}_{q(z)}\left[\frac{p_\theta(x, z)}{q(z)}\right]$$

**Step 3**: The ELBO is the single-sample ($K = 1$) estimator under the log:

$$\log p_\theta(x) = \log \mathbb{E}_{q(z)}[w(z)] \geq \mathbb{E}_{q(z)}[\log w(z)] = \mathcal{L}(\theta, q)$$

where $w(z) = \frac{p_\theta(x, z)}{q(z)}$ is the importance weight. The inequality is Jensen's.

**Step 4**: Tightening with $K$ samples (IWAE):

$$\mathcal{L}_K = \mathbb{E}_{z^{(1)}, \ldots, z^{(K)} \sim q}\left[\log \frac{1}{K}\sum_{k=1}^K w(z^{(k)})\right]$$

By Jensen's:

$$\log \frac{1}{K}\sum_k w(z^{(k)}) \leq \log \mathbb{E}_q[w(z)] = \log p_\theta(x)$$

(after taking the outer expectation, both sides are equal in expectation, but the concavity of $\log$ applied to the inner average gives the bound).

**Key insight**: The ELBO is a biased (downward) estimate of $\log p_\theta(x)$. Using more importance samples tightens the bound. $\blacksquare$

---

## 2. Worked Examples: ELBO for Specific Models

### 2.1 Example: Gaussian Prior and Gaussian Likelihood (Linear Case)

**Model**: $p(z) = \mathcal{N}(0, 1)$, $p(x \mid z) = \mathcal{N}(z, \sigma^2)$ (1D for simplicity).

**True posterior**: By conjugacy,

$$p(z \mid x) = \mathcal{N}\left(\frac{x}{1 + \sigma^2}, \frac{\sigma^2}{1 + \sigma^2}\right)$$

**Variational family**: $q_\phi(z \mid x) = \mathcal{N}(az + b, c^2)$ for parameters $a, b, c$.

**ELBO computation**:

$$\mathcal{L} = \mathbb{E}_{q}[\log p(x \mid z)] - D_{\text{KL}}(q \| p(z))$$

**Reconstruction term**:

$$\mathbb{E}_q[\log p(x \mid z)] = \mathbb{E}_q\left[-\frac{1}{2}\log(2\pi\sigma^2) - \frac{(x - z)^2}{2\sigma^2}\right]$$

$$= -\frac{1}{2}\log(2\pi\sigma^2) - \frac{1}{2\sigma^2}\mathbb{E}_q[(x - z)^2]$$

With $q(z) = \mathcal{N}(ax + b, c^2)$:

$$\mathbb{E}_q[(x - z)^2] = (x - ax - b)^2 + c^2 = x^2(1-a)^2 - 2bx(1-a) + b^2 + c^2$$

**KL term** (using our formula for 1D Gaussians):

$$D_{\text{KL}}(q \| p(z)) = D_{\text{KL}}(\mathcal{N}(ax + b, c^2) \| \mathcal{N}(0, 1))$$

$$= \frac{1}{2}[c^2 + (ax + b)^2 - 1 - \log c^2]$$

**Optimal parameters**: Setting the ELBO to the true $\log p(x)$ (achieved when $q = p(z \mid x)$):

$$a^* = \frac{1}{1 + \sigma^2}, \quad b^* = 0, \quad (c^*)^2 = \frac{\sigma^2}{1 + \sigma^2}$$

These match the true posterior parameters.

**Verification**: At these optimal values, $D_{\text{KL}}(q^* \| p(z \mid x)) = 0$, and $\mathcal{L} = \log p(x)$.

$$\log p(x) = -\frac{1}{2}\log(2\pi(1 + \sigma^2)) - \frac{x^2}{2(1 + \sigma^2)}$$

which is $\log \mathcal{N}(x \mid 0, 1 + \sigma^2)$ as expected (by marginalizing $z$ out of the joint).

### 2.2 Example: Gaussian Mixture Model

**Model**: $p(z = k) = \pi_k$ for $k = 1, \ldots, K$, $p(x \mid z = k) = \mathcal{N}(\mu_k, \sigma_k^2)$.

**ELBO with discrete $q$**: $q(z = k \mid x) = r_k(x)$ where $\sum_k r_k = 1$.

$$\mathcal{L} = \sum_k r_k(x) \left[\log p(x \mid z = k) + \log \pi_k - \log r_k(x)\right]$$

$$= \sum_k r_k(x) \log \frac{\pi_k \, p(x \mid z = k)}{r_k(x)}$$

**E-step optimum**: Setting $\nabla_{r_k} \mathcal{L} = 0$ (with Lagrange multiplier for the constraint $\sum_k r_k = 1$):

$$r_k^*(x) = \frac{\pi_k \, p(x \mid z = k)}{\sum_j \pi_j \, p(x \mid z = j)} = p(z = k \mid x)$$

This is the usual responsibility in EM.

**At the optimum**: $\mathcal{L} = \log \sum_k \pi_k p(x \mid z = k) = \log p(x)$, which is tight (as expected, since the variational family contains the true posterior).

### 2.3 Example: Bernoulli VAE on Binary Data

**Model**: $p(z) = \mathcal{N}(0, I_d)$, $p(x \mid z) = \prod_{i=1}^D \text{Bern}(x_i \mid \sigma(f_\theta(z)_i))$.

**ELBO**:

$$\mathcal{L} = \mathbb{E}_{q_\phi(z \mid x)}\left[\sum_{i=1}^D \left(x_i \log \hat{x}_i + (1 - x_i)\log(1 - \hat{x}_i)\right)\right] - D_{\text{KL}}(q_\phi \| p)$$

where $\hat{x} = \sigma(f_\theta(z))$ and $q_\phi(z \mid x) = \mathcal{N}(\mu_\phi(x), \text{diag}(\sigma_\phi^2(x)))$.

**Monte Carlo estimation** (1 sample):

$$\hat{\mathcal{L}} = \sum_i [x_i \log \hat{x}_i^{(1)} + (1-x_i)\log(1-\hat{x}_i^{(1)})] - \frac{1}{2}\sum_j [\sigma_j^2 + \mu_j^2 - 1 - \log\sigma_j^2]$$

where $z^{(1)} = \mu_\phi(x) + \sigma_\phi(x) \odot \epsilon^{(1)}$, $\epsilon^{(1)} \sim \mathcal{N}(0, I)$.

---

## 3. Reparameterization Trick: Step-by-Step

### 3.1 The Problem

We want to compute:

$$\nabla_\phi \mathcal{L} = \nabla_\phi \left[\mathbb{E}_{q_\phi(z \mid x)}[\log p_\theta(x \mid z)] - D_{\text{KL}}(q_\phi \| p)\right]$$

The KL term (for Gaussians) can be differentiated analytically. The reconstruction term is the problem:

$$\nabla_\phi \mathbb{E}_{q_\phi(z \mid x)}[\log p_\theta(x \mid z)]$$

### 3.2 Why We Cannot Naively Differentiate

The sampling $z \sim q_\phi(z \mid x) = \mathcal{N}(\mu_\phi(x), \sigma_\phi^2(x) I)$ is a stochastic operation. The gradient of a random sample w.r.t. the distribution parameters is not well-defined in the standard sense.

More formally:

$$\nabla_\phi \int \log p_\theta(x \mid z) \, q_\phi(z \mid x) \, dz$$

We cannot move $\nabla_\phi$ inside because $q_\phi$ depends on $\phi$.

### 3.3 The Reparameterization

**Key idea**: Express $z$ as a deterministic function of $\phi$ and a noise variable $\epsilon$ that does not depend on $\phi$.

For the Gaussian case:

$$\epsilon \sim \mathcal{N}(0, I_d) \quad \text{(does not depend on } \phi\text{)}$$

$$z = g(\phi, \epsilon, x) = \mu_\phi(x) + \sigma_\phi(x) \odot \epsilon$$

Now the expectation is over $p(\epsilon)$, not $q_\phi$:

$$\mathbb{E}_{q_\phi(z \mid x)}[\log p_\theta(x \mid z)] = \mathbb{E}_{p(\epsilon)}[\log p_\theta(x \mid g(\phi, \epsilon, x))]$$

### 3.4 Computing the Gradient

Since $p(\epsilon) = \mathcal{N}(0, I)$ does not depend on $\phi$:

$$\nabla_\phi \mathbb{E}_{p(\epsilon)}[\log p_\theta(x \mid g(\phi, \epsilon, x))] = \mathbb{E}_{p(\epsilon)}[\nabla_\phi \log p_\theta(x \mid g(\phi, \epsilon, x))]$$

By the chain rule:

$$\nabla_\phi \log p_\theta(x \mid z)\big|_{z = g(\phi, \epsilon, x)} = \nabla_z \log p_\theta(x \mid z) \cdot \frac{\partial g}{\partial \phi}$$

where:

$$\frac{\partial g}{\partial \mu_\phi} = I, \quad \frac{\partial g}{\partial \sigma_\phi} = \text{diag}(\epsilon)$$

So the gradient w.r.t. $\mu_\phi$ and $\sigma_\phi$ is:

$$\nabla_{\mu_\phi} = \nabla_z \log p_\theta(x \mid z)\big|_{z = \mu + \sigma \odot \epsilon}$$

$$\nabla_{\sigma_\phi} = \nabla_z \log p_\theta(x \mid z)\big|_{z = \mu + \sigma \odot \epsilon} \odot \epsilon$$

### 3.5 Single-Sample Estimator

In practice, we use $L = 1$ sample:

1. Compute $\mu = \mu_\phi(x)$, $\log\sigma^2 = \log\sigma^2_\phi(x)$ via the encoder.
2. Sample $\epsilon \sim \mathcal{N}(0, I)$.
3. Compute $z = \mu + \exp(0.5 \cdot \log\sigma^2) \odot \epsilon$.
4. Compute $\hat{x} = \text{decoder}_\theta(z)$.
5. Compute loss $= -\log p_\theta(x \mid z) + D_{\text{KL}}(q_\phi \| p)$.
6. Backpropagate through the entire computation graph (including through $z$).

The gradient flows: loss $\to$ decoder $\to$ $z$ $\to$ ($\mu$, $\sigma$) $\to$ encoder $\to$ $\phi$.

### 3.6 Reparameterization for Other Distributions

| Distribution | Reparameterization | Notes |
|:--|:--|:--|
| $\mathcal{N}(\mu, \sigma^2)$ | $z = \mu + \sigma \epsilon$, $\epsilon \sim \mathcal{N}(0,1)$ | Standard |
| $\text{Exp}(\lambda)$ | $z = -\frac{1}{\lambda}\log(1 - u)$, $u \sim \text{Uniform}(0,1)$ | Inverse CDF |
| $\text{Gamma}(\alpha, \beta)$ | Rejection sampling + implicit reparameterization | Complex |
| $\text{Bernoulli}(p)$ | Cannot directly; use Gumbel-Softmax relaxation | Discrete |
| $\text{Categorical}(\pi)$ | Gumbel-Softmax: $z = \text{softmax}((\log\pi + g)/\tau)$ | Temperature $\tau$ |

---

## 4. IWAE Bound Derivation

### 4.1 Motivation

The ELBO is a lower bound that becomes tight only when $q = p(z \mid x)$. Can we tighten the bound without changing $q$? Yes — by using multiple importance samples.

### 4.2 Definition

**Definition (IWAE Bound).** For $K$ i.i.d. samples $z^{(1)}, \ldots, z^{(K)} \sim q(z \mid x)$:

$$\mathcal{L}_K = \mathbb{E}_{z^{(1)}, \ldots, z^{(K)} \sim q}\left[\log \frac{1}{K}\sum_{k=1}^K w_k\right]$$

where $w_k = \frac{p_\theta(x, z^{(k)})}{q(z^{(k)} \mid x)}$ are the importance weights.

### 4.3 Proof that $\mathcal{L}_K$ is a Lower Bound

**Claim**: $\mathcal{L}_K \leq \log p_\theta(x)$ for all $K$.

*Proof.* By Jensen's inequality (applied to the outer expectation):

$$\mathcal{L}_K = \mathbb{E}\left[\log \frac{1}{K}\sum_k w_k\right] \leq \log \mathbb{E}\left[\frac{1}{K}\sum_k w_k\right]$$

Now, $\mathbb{E}[w_k] = \mathbb{E}_{q(z \mid x)}\left[\frac{p_\theta(x, z)}{q(z \mid x)}\right] = \int p_\theta(x, z) \, dz = p_\theta(x)$.

So: $\log \mathbb{E}\left[\frac{1}{K}\sum_k w_k\right] = \log p_\theta(x)$. $\blacksquare$

### 4.4 Proof that $\mathcal{L}_K$ is Monotonically Non-Decreasing in $K$

**Claim**: $\mathcal{L}_K \leq \mathcal{L}_{K+1}$ for all $K$.

*Proof.* Write:

$$\frac{1}{K+1}\sum_{k=1}^{K+1} w_k = \frac{K}{K+1} \cdot \frac{1}{K}\sum_{k=1}^K w_k + \frac{1}{K+1} w_{K+1}$$

By the concavity of $\log$:

$$\log\left(\frac{K}{K+1} \cdot A + \frac{1}{K+1} \cdot B\right) \geq \frac{K}{K+1}\log A + \frac{1}{K+1}\log B$$

where $A = \frac{1}{K}\sum_{k=1}^K w_k$ and $B = w_{K+1}$.

Taking the outer expectation and using the symmetry of the samples (all $z^{(k)}$ are i.i.d.):

$$\mathcal{L}_{K+1} \geq \frac{K}{K+1}\mathcal{L}_K + \frac{1}{K+1}\mathcal{L}_1 \geq \frac{K}{K+1}\mathcal{L}_K + \frac{1}{K+1}\mathcal{L}_K = \mathcal{L}_K$$

where the second inequality uses $\mathcal{L}_1 \geq \mathcal{L}_K$ ... wait, this is backwards. Let us use a cleaner argument.

**Cleaner proof using conditional Jensen**: Consider $K+1$ samples. By the law of total expectation:

$$\mathcal{L}_{K+1} = \mathbb{E}\left[\log \frac{1}{K+1}\sum_{k=1}^{K+1} w_k\right]$$

Condition on $z^{(1)}, \ldots, z^{(K)}$ and take the expectation over $z^{(K+1)}$. Define $S_K = \sum_{k=1}^K w_k$:

$$\mathbb{E}_{z^{(K+1)}}\left[\log\left(\frac{S_K + w_{K+1}}{K+1}\right)\right]$$

Since $\log$ is concave, by Jensen:

$$\geq \log\left(\frac{S_K + \mathbb{E}[w_{K+1}]}{K+1}\right) = \log\left(\frac{S_K + p_\theta(x)}{K+1}\right)$$

But this is not directly useful. Instead, the standard proof uses the following:

**Alternative proof via convexity of $-\log$**: For $K+1$ i.i.d. variables $w_1, \ldots, w_{K+1}$:

$$-\mathcal{L}_{K+1} = \mathbb{E}\left[-\log\frac{1}{K+1}\sum_{k=1}^{K+1}w_k\right]$$

Since $-\log$ is convex, and $\frac{1}{K+1}\sum w_k$ is the average of $K+1$ i.i.d. terms, while $\frac{1}{K}\sum_{k=1}^K w_k$ is the average of $K$ i.i.d. terms, the variance of the inner average decreases with more terms. By the tower property and Jensen's inequality applied carefully:

$$\mathbb{E}\left[-\log\bar{w}_{K+1}\right] \leq \mathbb{E}\left[-\log\bar{w}_K\right]$$

where $\bar{w}_K = \frac{1}{K}\sum_{k=1}^K w_k$. This follows because $-\log$ is convex and $\bar{w}_{K+1}$ is a mean-preserving contraction of $\bar{w}_K$ (it has the same mean but lower variance). For convex functions, $\mathbb{E}[f(\bar{w}_{K+1})] \leq \mathbb{E}[f(\bar{w}_K)]$ when $\bar{w}_{K+1}$ has lower variance and the same mean.

More rigorously: $\bar{w}_{K+1} = \frac{K}{K+1}\bar{w}_K + \frac{1}{K+1}w_{K+1}$, so conditioned on $\bar{w}_K$:

$$\mathbb{E}[-\log\bar{w}_{K+1} \mid \bar{w}_K] = \mathbb{E}\left[-\log\left(\frac{K}{K+1}\bar{w}_K + \frac{1}{K+1}w_{K+1}\right)\right]$$

$$\leq -\log\left(\frac{K}{K+1}\bar{w}_K + \frac{1}{K+1}\mathbb{E}[w_{K+1}]\right) \quad \text{(Jensen, convexity of } -\log\text{)}$$

This doesn't immediately simplify to $-\log\bar{w}_K$ either. The clean proof is:

**Standard proof (Burda et al., 2016)**: Write the $K+1$ sample bound as an expectation over choosing which sample to "leave out":

$$\frac{1}{K+1}\sum_{k=1}^{K+1} w_k = \frac{1}{K+1}\sum_{j=1}^{K+1} \frac{1}{K}\sum_{k \neq j} w_k + \text{correction}$$

The formal proof uses exchangeability: see Burda et al. (2016), Proposition 1. The result is:

$$\mathcal{L}_1 \leq \mathcal{L}_2 \leq \cdots \leq \mathcal{L}_K \leq \mathcal{L}_{K+1} \leq \cdots \leq \log p_\theta(x) \quad \blacksquare$$

### 4.5 IWAE as $K \to \infty$

**Claim**: $\lim_{K \to \infty} \mathcal{L}_K = \log p_\theta(x)$.

*Proof.* By the strong law of large numbers:

$$\frac{1}{K}\sum_{k=1}^K w_k \xrightarrow{\text{a.s.}} \mathbb{E}_q[w] = p_\theta(x)$$

By the continuous mapping theorem (since $\log$ is continuous):

$$\log\frac{1}{K}\sum_k w_k \xrightarrow{\text{a.s.}} \log p_\theta(x)$$

By dominated convergence (under mild conditions), the expectation converges as well:

$$\mathcal{L}_K \to \log p_\theta(x) \quad \blacksquare$$

### 4.6 IWAE Gradient

The gradient of $\mathcal{L}_K$ w.r.t. $\phi$ (the encoder parameters) is:

$$\nabla_\phi \mathcal{L}_K = \mathbb{E}\left[\sum_{k=1}^K \tilde{w}_k \nabla_\phi \log w_k\right]$$

where $\tilde{w}_k = \frac{w_k}{\sum_j w_j}$ are the **self-normalized importance weights**.

This means the IWAE gradient up-weights samples that are more "surprising" (high importance weight), which leads to a different learning dynamic than the standard ELBO.

**Caveat** (Rainforth et al., 2018): As $K \to \infty$, the signal-to-noise ratio of the gradient w.r.t. $\phi$ degrades. The IWAE becomes a better bound but a worse objective for learning the encoder.

---

## 5. Practice Problems with Solutions

### Problem 1: ELBO for a Poisson-Gamma Model

**Setup**: Let $z \sim \text{Gamma}(\alpha, \beta)$ (prior) and $x \mid z \sim \text{Poisson}(z)$ (likelihood). Let $q_\phi(z) = \text{Gamma}(a, b)$ (variational approximation).

**Task**: Write the ELBO and identify the reconstruction and KL terms.

**Solution**:

$$\mathcal{L} = \mathbb{E}_{q(z)}[\log p(x \mid z)] - D_{\text{KL}}(q(z) \| p(z))$$

**Reconstruction term**:

$$\mathbb{E}_q[\log p(x \mid z)] = \mathbb{E}_q[x \log z - z - \log(x!)]$$

$$= x \mathbb{E}_q[\log z] - \mathbb{E}_q[z] - \log(x!)$$

For $q = \text{Gamma}(a, b)$: $\mathbb{E}_q[z] = a/b$ and $\mathbb{E}_q[\log z] = \psi(a) - \log b$ (where $\psi$ is the digamma function).

$$= x(\psi(a) - \log b) - a/b - \log(x!)$$

**KL term**: For two Gamma distributions $\text{Gamma}(a, b)$ and $\text{Gamma}(\alpha, \beta)$:

$$D_{\text{KL}} = (a - \alpha)\psi(a) - \log\Gamma(a) + \log\Gamma(\alpha) + \alpha(\log b - \log\beta) + a\frac{\beta - b}{b}$$

The full ELBO is the reconstruction minus the KL.

### Problem 2: When Does Mean-Field Fail?

**Setup**: Consider the true posterior $p(z_1, z_2 \mid x) = \mathcal{N}\left(\begin{pmatrix}0\\0\end{pmatrix}, \begin{pmatrix}1 & \rho \\ \rho & 1\end{pmatrix}\right)$ with correlation $\rho$.

**Task**: Let $q(z_1, z_2) = \mathcal{N}(m_1, s_1^2) \cdot \mathcal{N}(m_2, s_2^2)$ (mean-field). Find the optimal $q$ that minimizes $D_{\text{KL}}(q \| p)$ and compute the ELBO gap.

**Solution**:

The KL divergence between a product of marginals and a correlated Gaussian is:

$$D_{\text{KL}}(q \| p) = \frac{1}{2}\left[\frac{s_1^2 + s_2^2 + m_1^2 + m_2^2}{1} - 2 + \frac{2\rho m_1 m_2}{1-\rho^2} + \log\frac{1-\rho^2}{s_1^2 s_2^2} + \frac{\text{extra terms involving } \rho}{...}\right]$$

More carefully, using the formula for KL between multivariate Gaussians with $q$ having covariance $\Sigma_q = \text{diag}(s_1^2, s_2^2)$ and $p$ having covariance $\Sigma_p$:

$$D_{\text{KL}}(q \| p) = \frac{1}{2}\left[\text{tr}(\Sigma_p^{-1}\Sigma_q) + (\mu_p - \mu_q)^\top\Sigma_p^{-1}(\mu_p - \mu_q) - 2 + \log\frac{|\Sigma_p|}{|\Sigma_q|}\right]$$

With $\mu_q = (m_1, m_2)$, $\mu_p = (0, 0)$:

$$\Sigma_p^{-1} = \frac{1}{1 - \rho^2}\begin{pmatrix} 1 & -\rho \\ -\rho & 1 \end{pmatrix}$$

**Optimal mean**: $m_1^* = m_2^* = 0$ (by symmetry and the positive definite quadratic form).

**Optimal variances**: Minimizing over $s_1^2, s_2^2$:

$$\frac{\partial D_{\text{KL}}}{\partial s_1^2} = \frac{1}{2}\left[\frac{1}{1-\rho^2} - \frac{1}{s_1^2}\right] = 0 \implies s_1^2 = 1 - \rho^2$$

Similarly, $s_2^2 = 1 - \rho^2$.

**Residual KL** (the ELBO gap):

$$D_{\text{KL}}(q^* \| p) = \frac{1}{2}\left[\frac{2(1-\rho^2)}{1-\rho^2} - 2 + \log\frac{1-\rho^2}{(1-\rho^2)^2}\right] = \frac{1}{2}\left[0 + \log\frac{1}{1-\rho^2}\right] = -\frac{1}{2}\log(1-\rho^2)$$

**Interpretation**: The gap grows as $|\rho| \to 1$. When $\rho = 0$ (independent), mean-field is exact. When $\rho = \pm 0.9$, the gap is $\frac{1}{2}\log(1/0.19) \approx 0.83$ nats. Mean-field fails most when the posterior has strong correlations.

### Problem 3: ELBO Surgery

**Setup**: Hoffman & Johnson (2016) show the KL term in the ELBO can be decomposed:

$$\mathbb{E}_{p_\text{data}(x)}[D_{\text{KL}}(q_\phi(z \mid x) \| p(z))] = I_q(x; z) + D_{\text{KL}}(q_\phi(z) \| p(z))$$

where $q_\phi(z) = \mathbb{E}_{p_\text{data}(x)}[q_\phi(z \mid x)]$ is the aggregate posterior and $I_q(x; z) = \mathbb{E}_{p_\text{data}}[D_{\text{KL}}(q_\phi(z \mid x) \| q_\phi(z))]$ is the mutual information between $x$ and $z$ under the encoder.

**Task**: Prove this decomposition.

**Solution**:

$$\mathbb{E}_{p(x)}[D_{\text{KL}}(q_\phi(z|x) \| p(z))]$$

$$= \mathbb{E}_{p(x)}\mathbb{E}_{q_\phi(z|x)}\left[\log\frac{q_\phi(z|x)}{p(z)}\right]$$

$$= \mathbb{E}_{p(x)}\mathbb{E}_{q_\phi(z|x)}\left[\log\frac{q_\phi(z|x)}{q_\phi(z)} + \log\frac{q_\phi(z)}{p(z)}\right]$$

(multiplying and dividing by $q_\phi(z)$)

$$= \underbrace{\mathbb{E}_{p(x)}\mathbb{E}_{q_\phi(z|x)}\left[\log\frac{q_\phi(z|x)}{q_\phi(z)}\right]}_{I_q(x;z)} + \underbrace{\mathbb{E}_{p(x)}\mathbb{E}_{q_\phi(z|x)}\left[\log\frac{q_\phi(z)}{p(z)}\right]}_{D_{\text{KL}}(q_\phi(z) \| p(z))}$$

For the second term: $\mathbb{E}_{p(x)}\mathbb{E}_{q_\phi(z|x)}[\cdot] = \mathbb{E}_{q_\phi(z)}[\cdot]$ since $q_\phi(z) = \int q_\phi(z|x)p(x)dx$.

$$= \mathbb{E}_{q_\phi(z)}\left[\log\frac{q_\phi(z)}{p(z)}\right] = D_{\text{KL}}(q_\phi(z) \| p(z)) \quad \blacksquare$$

**Interpretation**:
- $I_q(x; z)$: How much the encoder differentiates between different inputs. High $I_q$ means the latent code carries information about $x$.
- $D_{\text{KL}}(q_\phi(z) \| p(z))$: How much the aggregate posterior deviates from the prior. This measures the overall "spread" mismatch.

In posterior collapse: $I_q \approx 0$ (the encoder ignores the input) and $D_{\text{KL}}(q_\phi(z) \| p(z)) \approx 0$ (the aggregate posterior matches the prior).

### Problem 4: Compute the IWAE Bound Numerically

**Setup**: Consider a 1D latent variable model with $p(z) = \mathcal{N}(0, 1)$, $p(x \mid z) = \mathcal{N}(z, 1)$, and variational $q(z \mid x) = \mathcal{N}(x/2, 1/2)$ (which is the true posterior).

**Task**: For $x = 2$, compute:
(a) The true $\log p(x)$.
(b) The ELBO $\mathcal{L}_1$.
(c) Verify that $\mathcal{L}_1 = \log p(x)$ when $q$ is the true posterior.

**Solution**:

**(a)** $p(x) = \int p(x \mid z) p(z) \, dz = \int \mathcal{N}(x \mid z, 1) \mathcal{N}(z \mid 0, 1) \, dz = \mathcal{N}(x \mid 0, 2)$.

$$\log p(2) = -\frac{1}{2}\log(4\pi) - \frac{4}{4} = -\frac{1}{2}\log(4\pi) - 1 \approx -2.919$$

**(b)** With $q(z \mid x) = \mathcal{N}(x/2, 1/2)$, which is the true posterior $p(z \mid x)$:

**Reconstruction**: $\mathbb{E}_q[\log p(x \mid z)] = -\frac{1}{2}\log(2\pi) - \frac{1}{2}\mathbb{E}_q[(x - z)^2]$

$\mathbb{E}_q[(x-z)^2] = (x - x/2)^2 + 1/2 = x^2/4 + 1/2 = 1 + 1/2 = 3/2$ (for $x = 2$).

$= -\frac{1}{2}\log(2\pi) - 3/4 \approx -1.669$

**KL**: $D_{\text{KL}}(\mathcal{N}(1, 1/2) \| \mathcal{N}(0, 1)) = \frac{1}{2}[1/2 + 1 - 1 - \log(1/2)] = \frac{1}{2}[1/2 + \log 2] \approx 0.597 + \frac{1}{4}$

Let me compute more carefully: $= \frac{1}{2}[\sigma^2 + \mu^2 - 1 - \log\sigma^2] = \frac{1}{2}[0.5 + 1 - 1 - \log 0.5] = \frac{1}{2}[0.5 + 0.693] = 0.597$

Wait. $\log 0.5 = -0.693$, so $-\log 0.5 = 0.693$.

$D_{\text{KL}} = \frac{1}{2}[0.5 + 1 - 1 + 0.693] = \frac{1}{2}[1.193] = 0.597$

Hmm, let me redo: $D_{\text{KL}} = \frac{1}{2}[\sigma_q^2 + \mu_q^2 - 1 - \log\sigma_q^2] = \frac{1}{2}[0.5 + 1 - 1 - \ln(0.5)] = \frac{1}{2}[0.5 + 0.6931] = 0.5966$

**ELBO**: $\mathcal{L}_1 = -1.669 - 0.5966$. Hmm, let me verify differently.

Since $q = p(z \mid x)$, we know $\mathcal{L}_1 = \log p(x)$. Let me verify:

$\log p(x = 2) = \log \mathcal{N}(2 \mid 0, 2) = -\frac{1}{2}\log(2\pi \cdot 2) - \frac{4}{2 \cdot 2} = -\frac{1}{2}\log(4\pi) - 1$

$= -\frac{1}{2}(1.3863 + 1.1447) - 1 = -\frac{1}{2}(2.5310) - 1 = -1.2655 - 1 = -2.2655$

And the ELBO: $-1.669 - 0.597 = -2.266$. This matches (up to rounding). $\checkmark$

**(c)** Confirmed: when $q$ is the true posterior, the ELBO gap is zero and $\mathcal{L}_1 = \log p(x)$. This is because $D_{\text{KL}}(q \| p(z \mid x)) = 0$.

### Problem 5: Derive the Optimal Encoder for a Linear VAE

**Setup**: Linear VAE with $p(z) = \mathcal{N}(0, I_d)$, $p(x \mid z) = \mathcal{N}(Wz, \sigma^2 I_D)$, and mean-field encoder $q(z \mid x) = \mathcal{N}(\mu(x), \text{diag}(s^2))$ where we optimize over $\mu(\cdot)$ and $s$.

**Task**: Find the optimal encoder.

**Solution**:

The true posterior is:

$$p(z \mid x) = \mathcal{N}\left((W^\top W + \sigma^2 I)^{-1} W^\top x, \, \sigma^2(W^\top W + \sigma^2 I)^{-1}\right)$$

Let $M = W^\top W + \sigma^2 I$. Then:
- Optimal $\mu^*(x) = M^{-1}W^\top x$ (linear in $x$).
- Optimal covariance: $\sigma^2 M^{-1}$, which is generally not diagonal.

With the mean-field restriction ($\text{diag}(s^2)$), the optimal diagonal approximation has $s_j^2 = [\sigma^2 M^{-1}]_{jj}$ (the diagonal elements of the true posterior covariance).

The ELBO gap equals $D_{\text{KL}}(\text{diag approximation} \| \text{true posterior})$, which depends on the off-diagonal elements of $\sigma^2 M^{-1}$. If $W$ has orthogonal columns (i.e., $W^\top W$ is diagonal), the gap is zero.

---

## 6. Summary of Key Identities

| Identity | Formula |
|----------|---------|
| ELBO (Jensen) | $\log p(x) \geq \mathbb{E}_q[\log p(x,z)/q(z)]$ |
| ELBO (KL gap) | $\log p(x) = \mathcal{L} + D_{\text{KL}}(q \| p(z \mid x))$ |
| ELBO decomposition | $\mathcal{L} = \mathbb{E}_q[\log p(x \mid z)] - D_{\text{KL}}(q \| p(z))$ |
| Reparameterization | $z = \mu + \sigma \odot \epsilon, \; \epsilon \sim \mathcal{N}(0,I)$ |
| KL (diagonal Gaussian to standard) | $\frac{1}{2}\sum_j(\sigma_j^2 + \mu_j^2 - 1 - \log\sigma_j^2)$ |
| IWAE bound | $\mathcal{L}_K = \mathbb{E}[\log\frac{1}{K}\sum_k w_k]$, $w_k = p(x,z_k)/q(z_k \mid x)$ |
| Monotonicity | $\mathcal{L}_1 \leq \mathcal{L}_K \leq \log p(x)$ |
| ELBO surgery | $\mathbb{E}[D_{\text{KL}}(q(z \mid x) \| p(z))] = I_q(x;z) + D_{\text{KL}}(q(z) \| p(z))$ |
