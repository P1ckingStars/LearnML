# Homework 08: Diffusion Models

**Estimated Time:** 20 hours
**Due:** Two weeks from assignment date
**Submission:** Submit a single PDF (typeset in LaTeX) for Part A and a GitHub repository with runnable code for Part B.

---

## Overview

This homework covers the mathematical foundations and practical implementation of diffusion models. Part A tests your ability to derive the core results from first principles. Part B requires building a complete diffusion model pipeline, from training through evaluation.

**Grading:**
- Part A (Mathematical Derivations): 50%
- Part B (Implementation): 50%

**Academic integrity:** You may discuss approaches with classmates but all written derivations and code must be your own. Cite any resources used.

**Compute note:** Part B requires GPU access. CIFAR-10 training should be feasible on a single consumer GPU (e.g., RTX 3080) within 4-8 hours. If you lack GPU access, contact the instructors about cloud compute credits.

---

## Part A: Mathematical Derivations (50%)

### Problem A1: Forward Process Marginal (10 points)

**(a)** (6 points) Starting from the forward process definition:

$$q(x_t \mid x_{t-1}) = \mathcal{N}\bigl(x_t;\, \sqrt{1-\beta_t}\, x_{t-1},\, \beta_t I\bigr)$$

derive the closed-form marginal:

$$q(x_t \mid x_0) = \mathcal{N}\bigl(x_t;\, \sqrt{\bar{\alpha}_t}\, x_0,\, (1-\bar{\alpha}_t) I\bigr)$$

where $\alpha_t = 1 - \beta_t$ and $\bar{\alpha}_t = \prod_{s=1}^{t} \alpha_s$.

**Requirements:**
- Use proof by induction.
- Show every step in the variance computation, explicitly using the independence of $\varepsilon_1$ and $\varepsilon_2$ when combining Gaussian noise terms.
- State the key identity $\alpha_t(1-\bar{\alpha}_{t-1}) + \beta_t = 1 - \bar{\alpha}_t$ and prove it.

**(b)** (4 points) Compute the signal-to-noise ratio $\text{SNR}(t) = \bar{\alpha}_t / (1-\bar{\alpha}_t)$ for:
1. The linear schedule with $\beta_1 = 10^{-4}$, $\beta_T = 0.02$, $T = 1000$. Express $\bar{\alpha}_t$ as a product and give a numerical approximation for $t \in \{1, 100, 500, 1000\}$.
2. The cosine schedule with $\bar{\alpha}_t = f(t)/f(0)$, $f(t) = \cos^2((t/T+s)/(1+s) \cdot \pi/2)$, $s = 0.008$. Give numerical values for the same $t$ values.

Compare the two schedules: which distributes the SNR more uniformly across timesteps?

---

### Problem A2: Reverse Posterior (12 points)

**(a)** (8 points) Derive the reverse posterior $q(x_{t-1} \mid x_t, x_0)$ by applying Bayes' rule to three Gaussians.

Specifically, show that:

$$q(x_{t-1} \mid x_t, x_0) = \mathcal{N}(x_{t-1};\, \tilde{\mu}_t,\, \tilde{\beta}_t I)$$

where:

$$\tilde{\mu}_t = \frac{\sqrt{\bar{\alpha}_{t-1}}\, \beta_t}{1 - \bar{\alpha}_t}\, x_0 + \frac{\sqrt{\alpha_t}(1-\bar{\alpha}_{t-1})}{1-\bar{\alpha}_t}\, x_t$$

$$\tilde{\beta}_t = \frac{(1-\bar{\alpha}_{t-1})\beta_t}{1-\bar{\alpha}_t}$$

**Requirements:**
- Write out the three Gaussians explicitly (numerator and denominator of Bayes' rule).
- Show the "completing the square" computation in full detail.
- Verify that the precision (inverse variance) and mean match the claimed expressions.

**(b)** (4 points) Express $\tilde{\mu}_t$ in terms of $x_t$ and $\varepsilon$ (not $x_0$), using $x_0 = (x_t - \sqrt{1-\bar{\alpha}_t}\, \varepsilon) / \sqrt{\bar{\alpha}_t}$. Show that:

$$\tilde{\mu}_t = \frac{1}{\sqrt{\alpha_t}}\left(x_t - \frac{\beta_t}{\sqrt{1-\bar{\alpha}_t}}\, \varepsilon\right)$$

Show all intermediate algebraic steps. This is the formula that motivates noise prediction.

---

### Problem A3: From VLB to $L_{\text{simple}}$ (15 points)

**(a)** (5 points) Starting from the ELBO:

$$-\log p_\theta(x_0) \leq -\mathbb{E}_{q(x_{1:T} | x_0)}\left[\log \frac{p_\theta(x_{0:T})}{q(x_{1:T} | x_0)}\right]$$

derive the variational lower bound decomposition:

$$L_{\text{vlb}} = L_T + \sum_{t=2}^{T} L_{t-1} + L_0$$

where $L_T = D_{\text{KL}}(q(x_T | x_0) \| p(x_T))$, $L_{t-1} = D_{\text{KL}}(q(x_{t-1}|x_t,x_0) \| p_\theta(x_{t-1}|x_t))$, and $L_0 = -\mathbb{E}[\log p_\theta(x_0|x_1)]$.

Show the telescoping argument in full detail.

**(b)** (5 points) Using the result that both $q(x_{t-1}|x_t,x_0)$ and $p_\theta(x_{t-1}|x_t)$ are Gaussian (with the same variance $\tilde{\beta}_t$), show that:

$$L_{t-1} = \frac{1}{2\tilde{\beta}_t} \|\tilde{\mu}_t - \mu_\theta(x_t, t)\|^2 + C$$

Then substitute $\mu_\theta(x_t,t) = \frac{1}{\sqrt{\alpha_t}}(x_t - \frac{\beta_t}{\sqrt{1-\bar{\alpha}_t}} \varepsilon_\theta(x_t,t))$ and derive the per-timestep noise prediction loss:

$$L_{t-1} = \frac{\beta_t^2}{2\tilde{\beta}_t \alpha_t (1-\bar{\alpha}_t)} \|\varepsilon - \varepsilon_\theta(x_t, t)\|^2$$

**(c)** (5 points) Define $L_{\text{simple}} = \mathbb{E}_{t,x_0,\varepsilon}[\|\varepsilon - \varepsilon_\theta(x_t,t)\|^2]$. Show that $L_{\text{simple}}$ is a reweighted version of $L_{\text{vlb}}$:

$$L_{\text{simple}} = \sum_{t=1}^{T} \frac{1}{T} \|\varepsilon - \varepsilon_\theta(x_t,t)\|^2 \quad \text{vs.} \quad L_{\text{vlb}} = \sum_{t=2}^{T} w_t^{\text{vlb}} \|\varepsilon - \varepsilon_\theta(x_t,t)\|^2 + L_T + L_0$$

Compute the ratio $w_t^{\text{simple}} / w_t^{\text{vlb}} = \frac{2\tilde{\beta}_t \alpha_t(1-\bar{\alpha}_t)}{T \beta_t^2}$ and explain qualitatively why this reweighting helps sample quality.

---

### Problem A4: DDIM Update Rule (6 points)

**(a)** (4 points) Starting from the DDIM non-Markovian reverse posterior:

$$q_\sigma(x_{t-1} \mid x_t, x_0) = \mathcal{N}\!\left(\sqrt{\bar{\alpha}_{t-1}}\, x_0 + \sqrt{1-\bar{\alpha}_{t-1}-\sigma_t^2} \cdot \frac{x_t - \sqrt{\bar{\alpha}_t}\, x_0}{\sqrt{1-\bar{\alpha}_t}},\; \sigma_t^2 I\right)$$

set $\sigma_t = 0$ and substitute $\hat{x}_0 = (x_t - \sqrt{1-\bar{\alpha}_t}\, \varepsilon_\theta(x_t,t)) / \sqrt{\bar{\alpha}_t}$ to derive:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \cdot \hat{x}_0 + \sqrt{1-\bar{\alpha}_{t-1}} \cdot \varepsilon_\theta(x_t, t)$$

Show all steps.

**(b)** (2 points) Verify that the DDIM marginal $q_\sigma(x_t \mid x_0)$ is independent of $\sigma_t$ by computing the mean and variance of $x_{t-1} \mid x_0$ using the law of total variance (marginalizing over $x_t$).

---

### Problem A5: Classifier-Free Guidance (7 points)

**(a)** (3 points) Derive the CFG noise prediction formula. Starting from the classifier guidance score:

$$\tilde{s}(x_t) = \nabla_{x_t} \log p(x_t) + w \cdot \nabla_{x_t} \log p(c \mid x_t)$$

use the implicit classifier identity $\nabla_{x_t} \log p(c \mid x_t) = \nabla_{x_t} \log p(x_t \mid c) - \nabla_{x_t} \log p(x_t)$ to show:

$$\tilde{\varepsilon} = (1+w)\, \varepsilon_\theta(x_t, t, c) - w\, \varepsilon_\theta(x_t, t, \varnothing)$$

**(b)** (2 points) Show that CFG corresponds to sampling from $\tilde{p}_w(x \mid c) \propto p(x \mid c)^{1+w} / p(x)^w$. Compute the entropy of $\tilde{p}_w$ relative to $p(\cdot \mid c)$ and show it decreases with $w$.

**(c)** (2 points) For a 1D Gaussian example with $p(x \mid c) = \mathcal{N}(\mu, \sigma^2)$ and $p(x) = \mathcal{N}(0, \tau^2)$, compute $\tilde{p}_w(x \mid c)$ explicitly. Plot it for $\mu = 2$, $\sigma = 1$, $\tau = 3$, and $w \in \{0, 1, 5, 20\}$.

---

## Part B: Implementation (50%)

### Problem B1: DDPM Training from Scratch (20 points)

Implement a complete DDPM training pipeline:

**(a)** (3 points) **Noise schedule:** Implement both linear and cosine noise schedules. Plot $\bar{\alpha}_t$, $\beta_t$, and $\text{SNR}(t)$ for both.

**(b)** (5 points) **Forward process:** Implement `q_sample(x0, t, noise)` that computes $x_t = \sqrt{\bar{\alpha}_t}\, x_0 + \sqrt{1-\bar{\alpha}_t}\, \varepsilon$ using the closed-form marginal. Include a unit test: verify empirically that the mean and variance of $x_t \mid x_0$ match the theory for 10,000 samples.

**(c)** (7 points) **U-Net for noise prediction:** Implement a U-Net with:
- Sinusoidal time embeddings.
- At least 3 levels of encoder/decoder with skip connections.
- GroupNorm and SiLU activations.
- Time conditioning via addition to feature maps.
- Total parameter count should be 5-40M.

Report your architecture details (channels, number of blocks, attention layers if any, parameter count).

**(d)** (5 points) **Training loop:** Train on CIFAR-10 with:
- Cosine noise schedule, $T = 1000$.
- Adam optimizer, learning rate $2 \times 10^{-4}$.
- Gradient clipping at norm 1.0.
- At least 50 epochs (more is better).
- Log the loss curve and training time.

Generate 64 unconditional samples using the full DDPM reverse process (1000 steps) and include them in your report.

---

### Problem B2: DDIM Sampling (10 points)

Using the DDPM model trained in B1:

**(a)** (5 points) Implement DDIM sampling (deterministic, $\eta = 0$) with a variable number of steps $S$. Generate 64 samples with $S \in \{5, 10, 20, 50, 100, 1000\}$. Display all six grids and discuss the quality-speed tradeoff.

**(b)** (3 points) Implement DDIM encoding: given an image $x_0$, run the forward DDIM ODE to obtain $x_T$. Verify the reconstruction quality: compute the round-trip MSE $\|x_0 - \hat{x}_0\|^2$ (encode then decode) for 100 CIFAR-10 test images. Report mean and standard deviation of the MSE for $S \in \{50, 100, 500\}$.

**(c)** (2 points) Demonstrate latent interpolation: take two CIFAR-10 images, encode both to $x_T^{(a)}$ and $x_T^{(b)}$ via DDIM, perform spherical interpolation (slerp) in noise space with 5 intermediate points, and decode each to an image. Display the interpolation sequence.

---

### Problem B3: Classifier-Free Guidance (10 points)

**(a)** (4 points) Modify your U-Net to accept class labels (10 CIFAR-10 classes) via learned class embeddings added to the time embedding. Include a "null class" token for unconditional generation. Implement conditioning dropout with probability $p_{\text{uncond}} = 0.1$.

**(b)** (3 points) Train the class-conditional model for at least 50 epochs. Generate class-conditional samples (8 samples per class) with guidance scale $w \in \{0, 1, 3, 7, 15\}$. Display 5 grids (one per $w$ value), each with 10 columns (one per class) and 8 rows.

**(c)** (3 points) **FID evaluation:** Compute FID scores for your model at guidance scales $w \in \{0, 1, 3, 5, 7, 10, 15\}$. For each $w$, generate 10,000 samples (1,000 per class) using DDIM with $S = 50$ steps.

Plot FID vs. $w$ and identify the optimal guidance scale. Use the `pytorch-fid` or `torch-fidelity` library.

Include a table summarizing:
| Guidance $w$ | FID | Sampling time (total for 10K samples) |

---

### Problem B4: Analysis and Comparison (10 points)

**(a)** (3 points) **Sampling speed comparison:** Time the generation of 64 samples for:
1. DDPM (1000 steps)
2. DDIM (50 steps, $\eta = 0$)
3. DDIM (20 steps, $\eta = 0$)

Report wall-clock time and speedup relative to DDPM. Include both with and without CFG ($w = 3$).

**(b)** (3 points) **Noise schedule ablation:** Compare linear vs. cosine schedules by training two models (at least 30 epochs each) and generating 64 samples from each. Report:
- Loss curves (overlaid on the same plot).
- Sample quality (visual comparison and FID if feasible).
- Which timestep range contributes most to the loss for each schedule?

**(c)** (4 points) **Denoising visualization and analysis:**
- Visualize the denoising process: starting from $x_T \sim \mathcal{N}(0, I)$, show $x_t$ at 10 evenly-spaced timesteps during DDIM sampling ($S = 50$).
- For a single image, plot $\|\hat{x}_0^{(t)} - x_0^{\text{true}}\|$ (the predicted clean image at each timestep) vs. $t$ during sampling. At which timestep does the model "decide" the main content?
- Discuss the relationship between the denoising trajectory and the "coarse to fine" generation process.

---

## Submission Checklist

- [ ] **Part A:** LaTeX PDF with all derivations.
- [ ] **Part B:** GitHub repository containing:
  - [ ] `model.py`: U-Net architecture
  - [ ] `diffusion.py`: DDPM and DDIM implementations
  - [ ] `train.py`: Training script
  - [ ] `sample.py`: Sampling script (DDPM, DDIM, CFG)
  - [ ] `evaluate.py`: FID evaluation script
  - [ ] `README.md`: Instructions to reproduce results
  - [ ] `report.pdf`: Figures, tables, and analysis for Part B
  - [ ] Trained model checkpoint (upload to cloud storage if too large for git)
- [ ] All figures referenced in the report are included.
- [ ] FID scores are computed and tabulated.
