# Recitation 08: SDE Numerics and Sampling Methods

## Overview

This recitation covers the numerical methods used to solve stochastic and ordinary differential equations in the context of diffusion models. We will work through the Euler-Maruyama method for SDEs, several ODE solvers for the probability flow ODE, analyze the impact of noise schedules on sample quality, and walk through the sampling process step by step.

**Prerequisites:** Lectures 08a (DDPM), 08b (Score-SDE), 08c (DDIM and Flow Matching).

---

## 1. Euler-Maruyama Method for SDEs

### 1.1 Background

The Euler-Maruyama method is the simplest numerical scheme for Ito SDEs, analogous to the forward Euler method for ODEs.

Given a general Ito SDE:

$$dx = f(x, t)\, dt + g(t)\, dW$$

the Euler-Maruyama discretization with step size $\Delta t$ is:

$$x_{n+1} = x_n + f(x_n, t_n)\, \Delta t + g(t_n)\, \sqrt{|\Delta t|}\, z_n, \quad z_n \sim \mathcal{N}(0, I)$$

### 1.2 Convergence Properties

**Definition (Strong and Weak Convergence).** A numerical scheme has:
- **Strong order $\gamma$** if $\mathbb{E}[\|x_N - x(T)\|] \leq C \cdot \Delta t^\gamma$.
- **Weak order $\beta$** if $|\mathbb{E}[g(x_N)] - \mathbb{E}[g(x(T))]| \leq C \cdot \Delta t^\beta$ for smooth test functions $g$.

**Theorem 1.1.** The Euler-Maruyama method has:
- Strong order $\gamma = 1/2$.
- Weak order $\beta = 1$.

*Proof sketch (strong order).* The local error has two components:
1. Drift truncation error: $O(\Delta t^2)$ (same as Euler for ODEs).
2. Diffusion truncation error: The Ito integral $\int_{t_n}^{t_{n+1}} g(t)\, dW$ is approximated by $g(t_n) \Delta W_n$ where $\Delta W_n \sim \mathcal{N}(0, \Delta t\, I)$. The approximation error from the time-variation of $g$ is $O(\Delta t)$ in the $L^2$ sense. Since $\Delta W_n = O(\sqrt{\Delta t})$ in magnitude, the local strong error is $O(\Delta t^{3/2})$. Accumulating $N = T/\Delta t$ such errors: $N \cdot O(\Delta t^{3/2}) = O(\Delta t^{1/2})$.

### 1.3 Application to the Reverse VP-SDE

The reverse VP-SDE (from Lecture 08b) is:

$$dx = \left[-\frac{1}{2}\beta(t)\, x - \beta(t)\, s_\theta(x, t)\right] dt + \sqrt{\beta(t)}\, d\bar{W}$$

where $s_\theta(x, t) \approx \nabla_x \log p_t(x)$ is the learned score, and time runs backward from $T$ to $0$.

**Euler-Maruyama discretization** with $N$ steps and $\Delta t = -T/N$:

$$x_{n+1} = x_n + \left[-\frac{1}{2}\beta(t_n)\, x_n - \beta(t_n)\, s_\theta(x_n, t_n)\right] \Delta t + \sqrt{\beta(t_n)}\, \sqrt{|\Delta t|}\, z_n$$

where $t_n = T - n \cdot T/N$ and $z_n \sim \mathcal{N}(0, I)$.

### 1.4 Worked Example

**Setup:** VP-SDE with $\beta(t) = 0.1 + 19.9t$, $T = 1$, $d = 2$ (2D).

**Step-by-step with $N = 4$ steps:**

| Step | $t$ | $\beta(t)$ | $\Delta t$ | Action |
|------|-----|-----------|------------|--------|
| 0 | 1.0 | 20.0 | -0.25 | $x_0 \sim \mathcal{N}(0, I)$ |
| 1 | 0.75 | 15.025 | -0.25 | $x_1 = x_0 + f(x_0, 1.0)(-0.25) + \sqrt{20.0} \cdot 0.5 \cdot z_0$ |
| 2 | 0.50 | 10.05 | -0.25 | $x_2 = x_1 + f(x_1, 0.75)(-0.25) + \sqrt{15.025} \cdot 0.5 \cdot z_1$ |
| 3 | 0.25 | 5.075 | -0.25 | $x_3 = x_2 + f(x_2, 0.50)(-0.25) + \sqrt{10.05} \cdot 0.5 \cdot z_2$ |
| 4 | 0.0 | 0.1 | -0.25 | $x_4 = x_3 + f(x_3, 0.25)(-0.25) + \sqrt{5.075} \cdot 0.5 \cdot z_3$ |

where $f(x, t) = -\frac{1}{2}\beta(t) x - \beta(t) s_\theta(x, t)$.

**Observation:** The noise coefficient $\sqrt{\beta(t)} \cdot \sqrt{|\Delta t|}$ is large at early steps ($t$ near $T$) and small at late steps ($t$ near $0$). This means errors at the beginning of sampling (coarse structure) are averaged over by subsequent noise, while errors near the end (fine details) persist.

---

## 2. Probability Flow ODE Solvers

### 2.1 The Probability Flow ODE

From Lecture 08b, the probability flow ODE (for VP-SDE) is:

$$\frac{dx}{dt} = -\frac{1}{2}\beta(t)\left[x + s_\theta(x, t)\right]$$

Running from $t = T$ to $t = 0$ produces samples from $p_0 \approx p_{\text{data}}$.

Since this is a standard ODE (no stochastic term), we can apply any ODE solver.

### 2.2 Euler Method

The simplest first-order method:

$$x_{n+1} = x_n + h \cdot F(x_n, t_n)$$

where $F(x, t) = -\frac{1}{2}\beta(t)[x + s_\theta(x, t)]$ and $h = \Delta t = -T/N$.

**Properties:**
- 1 neural network evaluation (NFE) per step.
- Local truncation error: $O(h^2)$.
- Global error: $O(h)$ (first order).
- Total NFE for $N$ steps: $N$.

### 2.3 Heun's Method (Improved Euler / Explicit Trapezoidal)

A second-order method using a predictor-corrector approach:

$$\tilde{x}_{n+1} = x_n + h \cdot F(x_n, t_n) \quad \text{(Euler predictor)}$$
$$x_{n+1} = x_n + \frac{h}{2}\bigl[F(x_n, t_n) + F(\tilde{x}_{n+1}, t_{n+1})\bigr] \quad \text{(trapezoidal corrector)}$$

**Properties:**
- 2 NFE per step.
- Local truncation error: $O(h^3)$.
- Global error: $O(h^2)$ (second order).
- Total NFE for $N$ steps: $2N$.

**Why Heun's method is popular for diffusion:** At the same NFE budget, Heun with $N/2$ steps usually outperforms Euler with $N$ steps. The improved accuracy is worth the doubled cost per step.

### 2.4 DPM-Solver

Lu et al. (2022) designed ODE solvers specifically for the diffusion ODE structure. The key insight is that the ODE can be solved semi-analytically by separating the linear (drift) and nonlinear (score) parts.

**DPM-Solver-1 (equivalent to DDIM):**

The diffusion ODE can be rewritten in terms of $\hat{\varepsilon}(x, t) = -\sqrt{1-\bar{\alpha}_t}\, s_\theta(x, t)$:

$$\frac{dx}{d\lambda} = \hat{\varepsilon}(x, \lambda)$$

where $\lambda = \log(\bar{\alpha}_t / (1-\bar{\alpha}_t))$ is the log-SNR. In this parameterization, the exact solution from $\lambda_s$ to $\lambda_t$ is:

$$x_t = \frac{\sqrt{\bar{\alpha}_t}}{\sqrt{\bar{\alpha}_s}}\, x_s + \sqrt{\bar{\alpha}_t}\int_{\lambda_s}^{\lambda_t} e^{-\lambda} \hat{\varepsilon}(x_\lambda, \lambda)\, d\lambda$$

DPM-Solver-1 approximates $\hat{\varepsilon}$ as constant over the interval:

$$x_t \approx \frac{\sqrt{\bar{\alpha}_t}}{\sqrt{\bar{\alpha}_s}}\, x_s + \sqrt{\bar{\alpha}_t}\left(e^{-\lambda_t} - e^{-\lambda_s}\right) \hat{\varepsilon}(x_s, \lambda_s)$$

This is exactly the DDIM update rule (as shown in Lecture 08c).

**DPM-Solver-2:**

Approximate $\hat{\varepsilon}$ as linear over the interval using two evaluations:

1. Compute $\hat{\varepsilon}_s = \hat{\varepsilon}(x_s, \lambda_s)$ at the starting point.
2. Take a half-step to $\lambda_{s_{1/2}} = (\lambda_s + \lambda_t)/2$ using DPM-Solver-1 to get $x_{s_{1/2}}$.
3. Compute $\hat{\varepsilon}_{s_{1/2}} = \hat{\varepsilon}(x_{s_{1/2}}, \lambda_{s_{1/2}})$.
4. Use the linear extrapolation to take the full step:

$$x_t = \frac{\sqrt{\bar{\alpha}_t}}{\sqrt{\bar{\alpha}_s}} x_s + \sqrt{\bar{\alpha}_t}\left(e^{-\lambda_t} - e^{-\lambda_s}\right)\left[\hat{\varepsilon}_s + \frac{1}{2(\lambda_{s_{1/2}} - \lambda_s)}(\hat{\varepsilon}_{s_{1/2}} - \hat{\varepsilon}_s)(e^{-\lambda_t} - e^{-\lambda_s})\right]$$

**Properties:**
- 2 NFE per step.
- Achieves second-order convergence in the log-SNR domain.
- Empirically: good quality in 10-20 steps (20-40 NFE).

### 2.5 Solver Comparison Table

| Solver | Order | NFE/step | Steps for FID < 10 (CIFAR-10) | Total NFE |
|--------|-------|----------|-------------------------------|-----------|
| Euler | 1 | 1 | ~200 | ~200 |
| Heun | 2 | 2 | ~50 | ~100 |
| DPM-Solver-1 (DDIM) | 1* | 1 | ~50-100 | ~50-100 |
| DPM-Solver-2 | 2* | 2 | ~15-20 | ~30-40 |
| DPM-Solver-3 | 3* | 3 | ~10-15 | ~30-45 |

*Note: DPM-Solver orders are in the log-SNR domain, which is better adapted to the diffusion ODE structure.

---

## 3. Noise Schedule Analysis

### 3.1 Impact on Sample Quality

The noise schedule $\{\beta_t\}$ (or equivalently $\{\bar{\alpha}_t\}$) controls how the signal-to-noise ratio evolves during the forward process. This directly impacts:

1. **Training**: Which noise levels the model sees most frequently and how much signal remains.
2. **Sampling**: How much denoising work is needed at each step.

### 3.2 Linear Schedule Analysis

For the linear schedule with $\beta_1 = 10^{-4}$, $\beta_T = 0.02$, $T = 1000$:

$$\beta_t = 10^{-4} + \frac{t-1}{999}(0.02 - 10^{-4})$$

Key values:

| $t$ | $\beta_t$ | $\bar{\alpha}_t$ | SNR | log SNR |
|-----|-----------|-------------------|-----|---------|
| 1 | 0.0001 | 0.9999 | 9999 | 9.2 |
| 100 | 0.0021 | 0.900 | 9.0 | 2.2 |
| 250 | 0.0051 | 0.616 | 1.6 | 0.47 |
| 500 | 0.0100 | 0.189 | 0.23 | -1.5 |
| 750 | 0.0150 | 0.028 | 0.029 | -3.5 |
| 1000 | 0.0200 | 0.0015 | 0.0015 | -6.5 |

**Problem:** The SNR drops below 1 (log SNR < 0) by $t \approx 300$. This means for the last 700 timesteps, the signal is weaker than the noise. The model spends 70% of its timesteps on heavily noised inputs where little structure remains.

### 3.3 Cosine Schedule Analysis

For the cosine schedule:

$$\bar{\alpha}_t = \frac{\cos^2\!\left(\frac{t/T + s}{1+s} \cdot \frac{\pi}{2}\right)}{\cos^2\!\left(\frac{s}{1+s} \cdot \frac{\pi}{2}\right)}, \quad s = 0.008$$

Key values:

| $t$ | $\bar{\alpha}_t$ | SNR | log SNR |
|-----|-------------------|-----|---------|
| 1 | 0.9999 | ~10000 | 9.2 |
| 100 | 0.975 | 39.0 | 3.7 |
| 250 | 0.891 | 8.2 | 2.1 |
| 500 | 0.572 | 1.34 | 0.29 |
| 750 | 0.151 | 0.178 | -1.7 |
| 1000 | 0.0001 | 0.0001 | -9.2 |

**Advantage:** The cosine schedule distributes the SNR more evenly on a log scale. The SNR crosses 1 near the midpoint ($t \approx 500$), meaning the model spends roughly equal time on signal-dominated and noise-dominated regimes.

### 3.4 Optimal Schedule Design Principles

1. **Uniform log-SNR spacing**: For a fixed $T$ steps, distribute $\log \text{SNR}$ uniformly from $\log \text{SNR}(0) \approx \infty$ to $\log \text{SNR}(T) \approx -\infty$.
2. **Endpoints matter**: $\bar{\alpha}_0$ should be close to 1 (minimal noise), and $\bar{\alpha}_T$ should be close to 0 (pure noise).
3. **Resolution dependence**: Higher-resolution images need schedules that maintain signal longer (smaller $\beta$ values), because the relative importance of high-frequency content increases.

---

## 4. Step-by-Step Sampling Walkthrough

### 4.1 DDPM Sampling (Detailed)

We walk through DDPM sampling for a 2D toy example where $p_{\text{data}}$ is a mixture of two Gaussians.

**Setup:**
- $T = 5$ (small for illustration; real models use $T = 1000$).
- $\beta = [0.1, 0.2, 0.3, 0.4, 0.5]$.
- $\alpha = [0.9, 0.8, 0.7, 0.6, 0.5]$.
- $\bar{\alpha} = [0.9, 0.72, 0.504, 0.3024, 0.1512]$.

**Step 0: Initialize.** Sample $x_5 \sim \mathcal{N}(0, I)$. Say $x_5 = [1.2, -0.8]$.

**Step 1: $t = 5 \to 4$.** Compute $\varepsilon_\theta(x_5, 5)$. Suppose the model predicts $\hat{\varepsilon} = [0.9, -0.5]$.

$$\mu = \frac{1}{\sqrt{0.5}}\left([1.2, -0.8] - \frac{0.5}{\sqrt{1-0.1512}} [0.9, -0.5]\right)$$

$$= 1.414 \cdot \left([1.2, -0.8] - 0.543 \cdot [0.9, -0.5]\right)$$

$$= 1.414 \cdot [0.711, -0.528] = [1.006, -0.747]$$

Posterior variance: $\tilde{\beta}_5 = \frac{(1-0.3024) \cdot 0.5}{1-0.1512} = \frac{0.3488}{0.8488} = 0.411$.

Sample: $x_4 = [1.006, -0.747] + \sqrt{0.411} \cdot z_4$ where $z_4 \sim \mathcal{N}(0, I)$.

**Steps 2-4:** Repeat with decreasing noise. The model gradually sharpens its prediction.

**Step 5: $t = 1 \to 0$.** No noise added. $x_0 = \mu_\theta(x_1, 1)$.

### 4.2 DDIM Sampling (Detailed)

Same setup, but using $S = 3$ steps with $\tau = \{2, 4, 5\}$ (subsample of timesteps).

**Step 0:** $x_5 \sim \mathcal{N}(0, I)$, $x_5 = [1.2, -0.8]$.

**Step 1: $t = 5 \to 4$ (using DDIM, $\eta = 0$).**

Predict $x_0$: $\hat{x}_0 = (x_5 - \sqrt{1-\bar{\alpha}_5}\, \hat{\varepsilon}) / \sqrt{\bar{\alpha}_5}$

$$= ([1.2, -0.8] - \sqrt{0.849} \cdot [0.9, -0.5]) / \sqrt{0.1512}$$

$$= ([1.2, -0.8] - [0.829, -0.461]) / 0.389 = [0.371, -0.339] / 0.389 = [0.954, -0.872]$$

DDIM step: $x_4 = \sqrt{\bar{\alpha}_4}\, \hat{x}_0 + \sqrt{1-\bar{\alpha}_4}\, \hat{\varepsilon}$

$$= \sqrt{0.3024} \cdot [0.954, -0.872] + \sqrt{0.6976} \cdot [0.9, -0.5]$$

$$= 0.550 \cdot [0.954, -0.872] + 0.835 \cdot [0.9, -0.5] = [0.525, -0.480] + [0.752, -0.418] = [1.277, -0.897]$$

**Steps 2-3:** Continue to $\tau_1 = 2$ and then to $\tau_0 = 0$.

**Key difference from DDPM:** No random noise is added at each step (deterministic). The same $x_5$ always produces the same $x_0$.

### 4.3 What Happens Inside the Model at Different Timesteps

During sampling, the model's predictions evolve:

| Timestep | SNR regime | What $\hat{x}_0$ looks like | Model's task |
|----------|-----------|----------------------------|--------------|
| $t = T$ | Very low SNR | Blurry, coarse structure | Guess global layout |
| $t = 3T/4$ | Low SNR | Rough shapes emerge | Refine object boundaries |
| $t = T/2$ | SNR $\approx$ 1 | Recognizable structure | Add medium-frequency detail |
| $t = T/4$ | High SNR | Nearly clean | Sharpen edges, add texture |
| $t = 1$ | Very high SNR | Almost final | Final fine detail |

---

## 5. Practice Problems with Solutions

### Problem 1: Euler-Maruyama Convergence

**Problem:** Given the OU process $dx = -x\, dt + dW$ with $x_0 = 1$ and the Euler-Maruyama scheme:

$$x_{n+1} = x_n - x_n \Delta t + \sqrt{\Delta t}\, z_n, \quad z_n \sim \mathcal{N}(0, 1)$$

**(a)** Compute $\mathbb{E}[x_n]$ and $\text{Var}[x_n]$ for the numerical scheme.

**(b)** Compare with the exact solution $\mathbb{E}[x_t] = e^{-t}$ and $\text{Var}[x_t] = \frac{1}{2}(1 - e^{-2t})$.

**(c)** For what step sizes $\Delta t$ is the scheme stable (i.e., $|\mathbb{E}[x_n]| \to 0$ as $n \to \infty$)?

**Solution:**

**(a)** Taking expectations: $\mathbb{E}[x_{n+1}] = \mathbb{E}[x_n](1 - \Delta t)$. Iterating: $\mathbb{E}[x_n] = (1 - \Delta t)^n$.

For variance: $\text{Var}[x_{n+1}] = (1-\Delta t)^2 \text{Var}[x_n] + \Delta t$. This is a linear recurrence with solution:

$$\text{Var}[x_n] = \frac{\Delta t}{1 - (1-\Delta t)^2}\left[1 - (1-\Delta t)^{2n}\right] = \frac{1}{2 - \Delta t}\left[1 - (1-\Delta t)^{2n}\right]$$

**(b)** At $t = n\Delta t$:
- Exact mean: $e^{-n\Delta t}$. EM mean: $(1-\Delta t)^n$. For small $\Delta t$: $(1-\Delta t)^n \approx e^{-n\Delta t} + O(\Delta t)$.
- Exact variance: $\frac{1}{2}(1 - e^{-2n\Delta t})$. EM variance: $\frac{1}{2-\Delta t}(1 - (1-\Delta t)^{2n})$. As $\Delta t \to 0$: $\frac{1}{2-\Delta t} \to \frac{1}{2}$ and $(1-\Delta t)^{2n} \to e^{-2n\Delta t}$, so they agree at leading order.

**(c)** Stability requires $|1 - \Delta t| < 1$, which gives $0 < \Delta t < 2$. For diffusion model sampling with $N$ steps over $[0, T]$, $\Delta t = T/N$, so we need $N > T/2$. For $T = 1$, any $N \geq 1$ suffices. But for quality, many more steps are needed.

---

### Problem 2: Comparing Euler and Heun

**Problem:** For the ODE $dx/dt = -\sin(x)$ with $x(0) = 3$, compare Euler and Heun methods with $h = 0.5$ for 4 steps.

**Solution:**

**Euler:**

| $n$ | $t_n$ | $x_n$ | $f(x_n) = -\sin(x_n)$ | $x_{n+1} = x_n + 0.5 f(x_n)$ |
|-----|-------|-------|------------------------|-------------------------------|
| 0 | 0 | 3.000 | -0.141 | 2.929 |
| 1 | 0.5 | 2.929 | -0.224 | 2.817 |
| 2 | 1.0 | 2.817 | -0.323 | 2.655 |
| 3 | 1.5 | 2.655 | -0.441 | 2.434 |

**Heun:**

| $n$ | $t_n$ | $x_n$ | $f_1 = f(x_n)$ | $\tilde{x} = x_n + 0.5 f_1$ | $f_2 = f(\tilde{x})$ | $x_{n+1} = x_n + 0.25(f_1+f_2)$ |
|-----|-------|-------|----|------|-----|-------|
| 0 | 0 | 3.000 | -0.141 | 2.929 | -0.224 | 2.909 |
| 1 | 0.5 | 2.909 | -0.240 | 2.789 | -0.348 | 2.762 |
| 2 | 1.0 | 2.762 | -0.373 | 2.576 | -0.507 | 2.542 |
| 3 | 1.5 | 2.542 | -0.539 | 2.273 | -0.702 | 2.232 |

The Heun values more closely track the exact solution because the second-order correction accounts for the curvature of the solution.

---

### Problem 3: DDIM as ODE Solver

**Problem:** Show that the DDIM update (with $\eta = 0$):

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \cdot \hat{x}_0 + \sqrt{1-\bar{\alpha}_{t-1}} \cdot \hat{\varepsilon}$$

where $\hat{x}_0 = (x_t - \sqrt{1-\bar{\alpha}_t}\, \hat{\varepsilon})/\sqrt{\bar{\alpha}_t}$, can be viewed as an Euler step of the probability flow ODE in a particular coordinate system.

**Solution:**

Define new coordinates: write $x_t = \sqrt{\bar{\alpha}_t}\, D(t) + \sqrt{1-\bar{\alpha}_t}\, E(t)$ where $D(t)$ and $E(t)$ are the "data" and "noise" components.

The DDIM update holds $\hat{\varepsilon} = \varepsilon_\theta(x_t, t)$ constant across the step:

$$x_{t-1} = \sqrt{\bar{\alpha}_{t-1}} \cdot \frac{x_t - \sqrt{1-\bar{\alpha}_t}\, \hat{\varepsilon}}{\sqrt{\bar{\alpha}_t}} + \sqrt{1-\bar{\alpha}_{t-1}} \cdot \hat{\varepsilon}$$

Rearranging:

$$x_{t-1} = \frac{\sqrt{\bar{\alpha}_{t-1}}}{\sqrt{\bar{\alpha}_t}} x_t + \left(\sqrt{1-\bar{\alpha}_{t-1}} - \frac{\sqrt{\bar{\alpha}_{t-1}}\sqrt{1-\bar{\alpha}_t}}{\sqrt{\bar{\alpha}_t}}\right) \hat{\varepsilon}$$

Now consider the probability flow ODE in the $\sigma = \sqrt{(1-\bar{\alpha})/\bar{\alpha}}$ coordinate:

$$\frac{dx}{d\sigma} = \hat{\varepsilon}(x, \sigma)$$

The Euler step from $\sigma_t$ to $\sigma_{t-1}$ with $\hat{\varepsilon}$ held constant gives exactly the DDIM update after transforming back to the $x$ coordinate. The key insight is that DDIM is Euler in the "noise level" coordinate system, not in the time coordinate, which is why it converges faster than naive Euler in time.

---

### Problem 4: Noise Schedule Design

**Problem:** Design a noise schedule such that $\log \text{SNR}(t)$ decreases linearly from $\log \text{SNR}(0) = A$ to $\log \text{SNR}(T) = -A$ for some $A > 0$.

**Solution:**

We want $\log \text{SNR}(t) = A(1 - 2t/T)$, which gives:

$$\text{SNR}(t) = e^{A(1-2t/T)}$$

Since $\text{SNR}(t) = \bar{\alpha}_t / (1-\bar{\alpha}_t)$:

$$\bar{\alpha}_t = \frac{\text{SNR}(t)}{1 + \text{SNR}(t)} = \frac{1}{1 + e^{-A(1-2t/T)}} = \sigma\!\left(A\left(1 - \frac{2t}{T}\right)\right)$$

where $\sigma$ is the logistic sigmoid function. This is a **sigmoid schedule** that naturally produces uniform log-SNR spacing.

The corresponding $\beta_t$ values are:

$$\beta_t = 1 - \frac{\bar{\alpha}_t}{\bar{\alpha}_{t-1}}$$

which can be computed numerically.

**Verification:** At $t = 0$, $\bar{\alpha}_0 = \sigma(A) \approx 1$ for large $A$. At $t = T$, $\bar{\alpha}_T = \sigma(-A) \approx 0$. At $t = T/2$, $\bar{\alpha}_{T/2} = \sigma(0) = 0.5$, so $\text{SNR}(T/2) = 1$, confirming log SNR = 0 at the midpoint.

---

### Problem 5: Higher-Order SDE Solvers

**Problem:** The Milstein method for the SDE $dx = f(x)\, dt + g(x)\, dW$ is:

$$x_{n+1} = x_n + f(x_n) \Delta t + g(x_n) \Delta W_n + \frac{1}{2} g(x_n) g'(x_n)\bigl[(\Delta W_n)^2 - \Delta t\bigr]$$

**(a)** For the reverse VP-SDE where $g(t) = \sqrt{\beta(t)}$ (state-independent), show that the Milstein method reduces to Euler-Maruyama.

**(b)** Explain why this means higher-order SDE solvers provide no benefit for the VP-SDE reverse process.

**Solution:**

**(a)** The Milstein correction term is $\frac{1}{2} g(x_n) g'(x_n) [(\Delta W_n)^2 - \Delta t]$. When $g$ is a function of $t$ only (not of $x$), we have $g'(x_n) = \partial g / \partial x = 0$. Therefore the correction term vanishes and Milstein reduces to Euler-Maruyama.

**(b)** The Milstein method achieves strong order 1.0 (vs. EM's 0.5) by capturing the diffusion-diffusion interaction term. For state-independent diffusion coefficients, this term is exactly zero, so there is no room for improvement. This is why the diffusion model community focuses on ODE solvers (where higher-order methods do help) rather than higher-order SDE solvers. The probability flow ODE is the preferred sampling method when speed is important, precisely because it allows high-order solvers.

---

### Problem 6: Adaptive Step Size

**Problem:** Explain why adaptive step-size ODE solvers (e.g., Dormand-Prince / RK45) are particularly useful for diffusion model sampling, and what determines where they place their steps.

**Solution:**

Adaptive solvers estimate the local truncation error and adjust the step size to maintain it below a tolerance. For the diffusion probability flow ODE:

1. **Near $t = T$ (heavy noise):** The predicted score $s_\theta(x, t)$ changes slowly because $x$ is nearly Gaussian. The ODE vector field is smooth. Large steps are accurate.

2. **Near $t = 0$ (low noise):** The score function captures fine-grained data structure and changes rapidly. The ODE vector field has high curvature. Small steps are needed for accuracy.

3. **Transition region ($t \approx T/2$):** The ODE transitions from smooth to structured behavior. Moderate step sizes suffice.

Therefore, adaptive solvers automatically:
- Take large steps in the high-noise regime (saving compute).
- Take small steps in the low-noise regime (preserving quality).
- Achieve target accuracy with fewer total NFE than uniform-step solvers.

Empirically, RK45 typically uses 80-150 NFE for CIFAR-10, compared to ~200 for uniform Euler at similar quality. The step distribution roughly follows $dt \propto 1/\|\nabla F(x_t, t)\|$, placing more steps where the vector field has high curvature.

---

### Problem 7: Comparing Stochastic and Deterministic Sampling

**Problem:** For a 1D Gaussian mixture $p_{\text{data}} = 0.5\,\mathcal{N}(-3, 0.5^2) + 0.5\,\mathcal{N}(3, 0.5^2)$, simulate both:
1. The reverse SDE (Euler-Maruyama, $N = 100$ steps).
2. The probability flow ODE (Euler, $N = 100$ steps).

Use the exact score $\nabla_x \log p_t(x)$ (computable for Gaussian mixtures). Generate 1000 samples from each and compare histograms.

**Solution (outline):**

For a Gaussian mixture, the marginal at time $t$ under the VP-SDE is:

$$p_t(x) = 0.5\,\mathcal{N}\bigl(\sqrt{\bar{\alpha}_t}(-3),\, \bar{\alpha}_t \cdot 0.25 + (1-\bar{\alpha}_t)\bigr) + 0.5\,\mathcal{N}\bigl(\sqrt{\bar{\alpha}_t}(3),\, \bar{\alpha}_t \cdot 0.25 + (1-\bar{\alpha}_t)\bigr)$$

The exact score is:

$$\nabla_x \log p_t(x) = \frac{-w_1(x)\frac{x - \mu_1(t)}{\sigma^2(t)} - w_2(x)\frac{x - \mu_2(t)}{\sigma^2(t)}}{1}$$

where $w_i(x) = \pi_i \mathcal{N}(x; \mu_i(t), \sigma^2(t)) / p_t(x)$ are the posterior responsibilities.

**Expected results:**
- Both methods recover the bimodal distribution.
- The SDE samples show more spread (higher variance around each mode) due to the stochastic noise.
- The ODE samples are deterministic: each starting point maps to a unique endpoint, producing a cleaner histogram but with no randomness.
- The SDE is better at mode coverage when the score estimate is imperfect, because the noise helps escape local minima in the score landscape.

```python
import torch
import numpy as np
import matplotlib.pyplot as plt


def exact_score_gaussian_mixture(x, t, alpha_bar):
    """Exact score for a 1D mixture of two Gaussians."""
    mu1, mu2 = -3.0, 3.0
    data_var = 0.25
    mean1 = np.sqrt(alpha_bar) * mu1
    mean2 = np.sqrt(alpha_bar) * mu2
    var = alpha_bar * data_var + (1 - alpha_bar)

    # Log-sum-exp for numerical stability
    log_p1 = -0.5 * (x - mean1)**2 / var
    log_p2 = -0.5 * (x - mean2)**2 / var
    max_log = np.maximum(log_p1, log_p2)

    p1 = np.exp(log_p1 - max_log)
    p2 = np.exp(log_p2 - max_log)
    total = p1 + p2

    w1 = p1 / total
    w2 = p2 / total

    score = -(w1 * (x - mean1) + w2 * (x - mean2)) / var
    return score


def sample_reverse_sde(N=100, n_samples=1000, T=1.0, beta_min=0.1, beta_max=20.0):
    """Sample via reverse SDE (Euler-Maruyama)."""
    dt = -T / N
    x = np.random.randn(n_samples)  # start from N(0, 1)

    for i in range(N):
        t = T - i * T / N
        beta_t = beta_min + t * (beta_max - beta_min)
        log_alpha = -0.25 * t**2 * (beta_max - beta_min) - 0.5 * t * beta_min
        alpha_bar = np.exp(2 * log_alpha)

        score = exact_score_gaussian_mixture(x, t, alpha_bar)
        drift = -0.5 * beta_t * x - beta_t * score
        diffusion = np.sqrt(beta_t)

        z = np.random.randn(n_samples) if i < N - 1 else 0
        x = x + drift * dt + diffusion * np.sqrt(abs(dt)) * z

    return x


def sample_probability_flow_ode(N=100, n_samples=1000, T=1.0, beta_min=0.1, beta_max=20.0):
    """Sample via probability flow ODE (Euler)."""
    dt = -T / N
    x = np.random.randn(n_samples)

    for i in range(N):
        t = T - i * T / N
        beta_t = beta_min + t * (beta_max - beta_min)
        log_alpha = -0.25 * t**2 * (beta_max - beta_min) - 0.5 * t * beta_min
        alpha_bar = np.exp(2 * log_alpha)

        score = exact_score_gaussian_mixture(x, t, alpha_bar)
        ode_drift = -0.5 * beta_t * (x + score)

        x = x + ode_drift * dt

    return x
```

---

## 6. Summary of Key Takeaways

1. **Euler-Maruyama** is the workhorse SDE solver but has low convergence order. For diffusion models, the probability flow ODE is preferred because it admits higher-order solvers.

2. **Heun's method** provides a good quality-cost tradeoff: 2x the NFE per step, but roughly $4$x the accuracy, meaning fewer total NFE for the same quality.

3. **DPM-Solver** exploits the specific structure of the diffusion ODE to achieve better convergence than generic solvers. It is currently the state-of-the-art for fast sampling from diffusion models.

4. **Noise schedules** fundamentally determine the SNR trajectory. The cosine schedule provides more uniform coverage than the linear schedule, leading to better sample quality.

5. **Adaptive solvers** automatically allocate more computation where the ODE is stiff (low noise regime), saving overall compute.

6. The choice between **stochastic (SDE) and deterministic (ODE) sampling** involves a tradeoff between mode coverage (SDE) and speed/controllability (ODE).
