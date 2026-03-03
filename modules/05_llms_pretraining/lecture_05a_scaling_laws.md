# Lecture 05a: Neural Scaling Laws

> **Module 05 — LLMs & Pretraining**
> Estimated study time: 6–8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. State and derive the Kaplan et al. power-law relationships $L(N)$, $L(D)$, and $L(C)$ for language model loss as a function of parameters, data, and compute.
2. Derive the compute-optimal allocation between model size $N$ and data $D$ under a fixed compute budget $C$, reproducing the Chinchilla result.
3. Explain the statistical mechanics perspective on why power laws arise in neural scaling.
4. Formalize emergent abilities as phase transitions and analyze when discontinuous capability jumps occur.
5. Apply scaling laws to predict training loss for a given compute budget and optimally allocate resources.
6. Implement scaling law fitting and extrapolation in PyTorch.

---

## 1. Motivation and Context

Modern large language models consume staggering resources. Training GPT-4 is estimated at $\sim 10^{25}$ FLOPs; LLaMA-3 405B required $3.8 \times 10^{25}$ FLOPs. Before committing such budgets, practitioners need principled answers to:

- Given a compute budget $C$, how large should the model be?
- How much data is needed?
- What loss can we expect?

Scaling laws transform these from guesswork into quantitative predictions. They are arguably the most important empirical discovery in modern deep learning: they tell us that **performance is a smooth, predictable function of resources**, and that we can extrapolate from small experiments to predict large-scale outcomes.

The key insight is that test loss $L$ follows **power-law** relationships:

$$L(N) = \left(\frac{N_c}{N}\right)^{\alpha_N}, \quad L(D) = \left(\frac{D_c}{D}\right)^{\alpha_D}, \quad L(C) = \left(\frac{C_c}{C}\right)^{\alpha_C}$$

where $N$ is number of parameters, $D$ is number of training tokens, and $C$ is compute in FLOPs. The exponents $\alpha_N, \alpha_D, \alpha_C$ are remarkably consistent across model families.

---

## 2. Core Theory

### 2.1 The Kaplan Power Laws

Kaplan et al. (2020) trained a series of Transformer language models spanning six orders of magnitude in parameter count and measured cross-entropy loss on a held-out set. They observed three clean power-law relationships.

**Definition (Test Loss as a Function of Parameters).** When training on effectively unlimited data with an optimal learning rate schedule:

$$L(N) = \left(\frac{N_c}{N}\right)^{\alpha_N} + L_\infty$$

where $N$ is the number of non-embedding parameters, $\alpha_N \approx 0.076$, $N_c \approx 8.8 \times 10^{13}$, and $L_\infty$ is the irreducible entropy of natural language.

**Definition (Test Loss as a Function of Data).** When the model is large enough not to be the bottleneck:

$$L(D) = \left(\frac{D_c}{D}\right)^{\alpha_D} + L_\infty$$

where $D$ is the number of training tokens, $\alpha_D \approx 0.095$, and $D_c \approx 5.4 \times 10^{13}$.

**Definition (Test Loss as a Function of Compute).** When model size and data are allocated optimally:

$$L(C) = \left(\frac{C_c}{C}\right)^{\alpha_C} + L_\infty$$

where $C$ is measured in FLOPs (typically $C \approx 6ND$ for a Transformer), $\alpha_C \approx 0.050$, and $C_c \approx 3.1 \times 10^8$.

### 2.2 The Joint Scaling Law

The three separate power laws are special cases of a single joint law. Kaplan et al. proposed:

$$L(N, D) = \left[\left(\frac{N_c}{N}\right)^{\alpha_N / \beta} + \left(\frac{D_c}{D}\right)^{\alpha_D / \beta}\right]^\beta + L_\infty$$

where $\beta$ is a blending exponent. Setting $D \to \infty$ recovers $L(N)$; setting $N \to \infty$ recovers $L(D)$.

**Interpretation.** The model encounters two independent sources of loss:

1. **Approximation error** $\sim N^{-\alpha_N/\beta}$: the model class is not rich enough.
2. **Estimation error** $\sim D^{-\alpha_D/\beta}$: not enough data to learn the true distribution.

This decomposition mirrors the classical bias-variance tradeoff, but in a regime where both decrease monotonically (we never see overfitting in the classical sense because both $N$ and $D$ are scaled together).

### 2.3 Deriving Compute-Optimal Allocation (Chinchilla)

**Problem.** Given a fixed compute budget $C$, choose $N$ and $D$ to minimize $L(N, D)$ subject to $C = 6ND$ (the approximate FLOP count for a dense Transformer forward + backward pass).

We use the simplified parametric form:

$$L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + L_\infty$$

where $A, B, \alpha, \beta$ are fitted constants and we absorb the blending into separate terms for clarity. Hoffmann et al. (2022) fitted $\alpha \approx 0.34$ and $\beta \approx 0.28$.

**Derivation via Lagrange Multipliers.** We minimize $L(N, D)$ subject to $g(N, D) = 6ND - C = 0$.

The Lagrangian is:

$$\mathcal{L}(N, D, \lambda) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + L_\infty + \lambda(6ND - C)$$

Setting partial derivatives to zero:

$$\frac{\partial \mathcal{L}}{\partial N} = -\frac{A\alpha}{N^{\alpha+1}} + 6\lambda D = 0 \quad \Rightarrow \quad \lambda = \frac{A\alpha}{6DN^{\alpha+1}} \tag{1}$$

$$\frac{\partial \mathcal{L}}{\partial D} = -\frac{B\beta}{D^{\beta+1}} + 6\lambda N = 0 \quad \Rightarrow \quad \lambda = \frac{B\beta}{6ND^{\beta+1}} \tag{2}$$

Equating (1) and (2):

$$\frac{A\alpha}{6DN^{\alpha+1}} = \frac{B\beta}{6ND^{\beta+1}}$$

$$\frac{A\alpha}{N^\alpha} = \frac{B\beta}{D^\beta}$$

$$A\alpha \cdot D^\beta = B\beta \cdot N^\alpha$$

$$\frac{N^\alpha}{D^\beta} = \frac{A\alpha}{B\beta} \tag{3}$$

From the constraint $D = C / (6N)$, substitute into (3):

$$\frac{N^\alpha}{\left(\frac{C}{6N}\right)^\beta} = \frac{A\alpha}{B\beta}$$

$$\frac{N^\alpha \cdot (6N)^\beta}{C^\beta} = \frac{A\alpha}{B\beta}$$

$$\frac{6^\beta \cdot N^{\alpha + \beta}}{C^\beta} = \frac{A\alpha}{B\beta}$$

$$N^{\alpha + \beta} = \frac{A\alpha \cdot C^\beta}{B\beta \cdot 6^\beta}$$

$$N^* = \left(\frac{A\alpha}{B\beta \cdot 6^\beta}\right)^{\frac{1}{\alpha+\beta}} \cdot C^{\frac{\beta}{\alpha+\beta}} \tag{4}$$

And correspondingly:

$$D^* = \frac{C}{6N^*} = \frac{C}{6} \cdot \left(\frac{B\beta \cdot 6^\beta}{A\alpha}\right)^{\frac{1}{\alpha+\beta}} \cdot C^{-\frac{\beta}{\alpha+\beta}}$$

$$D^* = \frac{1}{6}\left(\frac{B\beta \cdot 6^\beta}{A\alpha}\right)^{\frac{1}{\alpha+\beta}} \cdot C^{\frac{\alpha}{\alpha+\beta}} \tag{5}$$

**Key Result.** Both $N^*$ and $D^*$ are power laws in $C$:

$$N^* \propto C^{\frac{\beta}{\alpha+\beta}}, \quad D^* \propto C^{\frac{\alpha}{\alpha+\beta}}$$

With Hoffmann et al. values $\alpha \approx 0.34$, $\beta \approx 0.28$:

$$N^* \propto C^{0.45}, \quad D^* \propto C^{0.55}$$

This means **data should scale slightly faster than model size** as compute increases. The Chinchilla result overturned the previous Kaplan recommendation (which suggested $N^* \propto C^{0.73}$, scaling model size much faster than data).

**Numerical Example.** For a compute budget of $C = 10^{21}$ FLOPs (roughly a LLaMA-7B-scale training run):

Using Hoffmann et al. coefficients $A \approx 406.4$, $B \approx 410.7$, $\alpha = 0.34$, $\beta = 0.28$:

$$N^* \approx 6.7 \times 10^9 \text{ parameters (6.7B)}$$
$$D^* \approx 2.5 \times 10^{10} \text{ tokens (25B tokens)}$$

This closely matches the Chinchilla-70B result: a 70B model trained on 1.4T tokens at $C \approx 5 \times 10^{23}$ FLOPs.

### 2.4 Statistical Mechanics Perspective on Power Laws

Why do power laws arise? One compelling framework comes from statistical mechanics.

**Setup.** Consider a model learning a distribution over functions. The loss landscape has many local minima. Suppose the number of minima with loss in $[L, L + dL]$ scales as:

$$\Omega(L) \propto e^{S(L)}$$

where $S(L)$ is an entropy (log density of states). If $S(L)$ is concave and the optimization dynamics resemble simulated annealing, the model finds configurations near the minimum free energy:

$$F = L - T \cdot S(L)$$

where $T$ is an effective temperature related to the learning rate.

**The Power-Law Argument.** Assume the model class can be decomposed into independent "features" or "modes," each of which requires some number of parameters to learn. Let the $k$-th mode contribute loss reduction $\delta_k \sim k^{-\gamma}$ when learned (a Zipf-like distribution of feature importances, consistent with the power-law structure of natural language).

A model with $N$ parameters can learn approximately the top $K(N) \sim N^{1/d}$ modes (where $d$ is an effective dimension of the learning problem). The residual loss is:

$$L(N) - L_\infty = \sum_{k > K(N)} \delta_k \approx \int_{K(N)}^{\infty} k^{-\gamma}\, dk = \frac{K(N)^{1-\gamma}}{\gamma - 1} \propto N^{(1-\gamma)/d}$$

Setting $\alpha_N = (\gamma - 1)/d$ recovers the power law. The exponent depends on:

- $\gamma$: the decay rate of feature importances (set by the data distribution).
- $d$: the effective intrinsic dimension of the model class.

**Remark.** This is a heuristic argument, not a rigorous theorem. Rigorous results exist for simpler settings (e.g., kernel regression, linear models) where the spectral decay of the kernel determines the power-law exponent.

### 2.5 Emergent Abilities

Wei et al. (2022) documented capabilities that appear to emerge suddenly as model scale increases.

**Definition (Emergent Ability).** An ability is *emergent* if it is not present in smaller models but appears in larger models. Operationally, performance on a task is near-random below some scale threshold and then jumps sharply above it.

**Examples:**

- **Arithmetic**: GPT-3 175B can perform 3-digit addition, but GPT-3 13B cannot.
- **Chain-of-thought reasoning**: Only effective in models above ~60B parameters.
- **Word unscrambling**: Performance is near-zero until ~10B parameters, then rapidly improves.

**The Metric Hypothesis.** Schaeffer et al. (2023) argued that emergent abilities may be an artifact of the evaluation metric. When using nonlinear metrics (like exact-match accuracy), a smooth underlying log-probability improvement can appear as a sharp phase transition. If we instead measure log-likelihood (a linear metric), the improvement is smooth and predictable.

**Formal Analysis.** Let $p_\theta(y \mid x)$ be the model's probability of the correct answer. Suppose:

$$\log p_\theta(y \mid x) = -c \cdot N^{-\alpha}$$

for some constants $c, \alpha > 0$. The probability itself is:

$$p_\theta(y \mid x) = \exp(-c \cdot N^{-\alpha})$$

For exact-match accuracy on a multi-step task requiring $m$ independent correct steps:

$$\text{Acc}(N) = p_\theta(y \mid x)^m = \exp(-mc \cdot N^{-\alpha})$$

This function is sigmoidal in $\log N$: it is near-zero for $N \ll (mc/\epsilon)^{1/\alpha}$ and near-one for $N \gg (mc)^{1/\alpha}$. The "transition" is smooth but steep — appearing emergent when plotted on a coarse scale.

**Critical scale** where accuracy reaches 50%:

$$N_{50} = \left(\frac{mc}{\ln 2}\right)^{1/\alpha}$$

This grows polynomially in task complexity $m$, explaining why harder tasks emerge at larger scales.

### 2.6 Scaling Laws for Downstream Tasks

Scaling laws extend beyond pretraining loss. For downstream task accuracy $\text{Acc}$:

$$\text{Acc}(L) = A_{\max} - k \cdot L^{\gamma}$$

where $L$ is the pretraining loss. Combined with $L(C)$:

$$\text{Acc}(C) = A_{\max} - k' \cdot C^{-\gamma \cdot \alpha_C}$$

**Transfer scaling.** When fine-tuning on a downstream task with $D_{\text{ft}}$ examples:

$$L_{\text{ft}}(N, D_{\text{ft}}) = \frac{A_{\text{ft}}}{N^{\alpha_{\text{ft}}}} + \frac{B_{\text{ft}}}{D_{\text{ft}}^{\beta_{\text{ft}}}} + L_{\infty,\text{ft}}$$

The key observation is that $\alpha_{\text{ft}} > \alpha_{\text{pt}}$: downstream performance improves faster with model size than pretraining loss does. This is because larger models learn more transferable representations.

---

## 3. Algorithmic Derivation

### 3.1 Fitting Scaling Laws from Data

**Input:** Set of $(N_i, D_i, L_i)$ tuples from training runs.

**Goal:** Fit parameters $A, B, \alpha, \beta, L_\infty$ in $L(N, D) = A/N^\alpha + B/D^\beta + L_\infty$.

```
Algorithm: Scaling Law Fitting via Nonlinear Least Squares
───────────────────────────────────────────────────────────
Input: {(N_i, D_i, L_i)}_{i=1}^M — training run results
Output: Parameters θ = (A, B, α, β, L_∞)

1. Initialize θ₀ via grid search over plausible ranges:
     A ∈ [1, 10^4], B ∈ [1, 10^4]
     α ∈ [0.01, 1.0], β ∈ [0.01, 1.0]
     L_∞ ∈ [1.0, 2.0]  (for language modeling in nats)

2. Define residuals:
     r_i(θ) = L_i - [A / N_i^α + B / D_i^β + L_∞]

3. Minimize via Huber loss (robust to outliers):
     θ* = argmin_θ Σ_i ρ_δ(r_i(θ))
   where ρ_δ(r) = r²/2 if |r| ≤ δ, else δ(|r| - δ/2)

4. Use L-BFGS with analytic gradients:
     ∂r_i/∂A = -1/N_i^α
     ∂r_i/∂α = A·ln(N_i)/N_i^α
     ∂r_i/∂B = -1/D_i^β
     ∂r_i/∂β = B·ln(D_i)/D_i^β
     ∂r_i/∂L_∞ = -1

5. Return θ* and confidence intervals via bootstrap
```

**Complexity:** Each L-BFGS iteration is $O(M)$ for $M$ training runs. With $T$ iterations, total cost is $O(MT)$.

### 3.2 Compute-Optimal Allocation

```
Algorithm: Chinchilla-Optimal N and D
──────────────────────────────────────
Input: Compute budget C (FLOPs), fitted (A, B, α, β)
Output: Optimal N*, D*

1. Compute optimal parameters:
     N* = ( (A·α) / (B·β·6^β) )^(1/(α+β)) · C^(β/(α+β))

2. Compute optimal tokens:
     D* = C / (6·N*)

3. Predict loss:
     L* = A / N*^α + B / D*^β + L_∞

4. Return (N*, D*, L*)
```

### 3.3 Predicting Emergent Abilities

```
Algorithm: Emergence Threshold Prediction
──────────────────────────────────────────
Input: Scaling law L(N), task complexity m, accuracy threshold τ
Output: Critical model size N_τ

1. Model accuracy as:
     Acc(N) = exp(-m · exp(L(N) - L_∞))
   where L(N) = (N_c/N)^α_N + L_∞

2. Solve for N_τ such that Acc(N_τ) = τ:
     exp(-m · exp(L(N_τ) - L_∞)) = τ
     m · exp(L(N_τ) - L_∞) = -ln(τ)
     L(N_τ) - L_∞ = ln(-ln(τ)/m)
     (N_c/N_τ)^α_N = ln(-ln(τ)/m)     [requires -ln(τ)/m > 1, i.e., τ < e^{-m}... adjust model]

3. Simpler approach via per-token accuracy:
     p(N) = exp(-(N_c/N)^α_N)      (token-level accuracy)
     Acc(N) = p(N)^m               (m-step task)
     N_τ = N_c · (-ln(τ)/m)^{-1/α_N}  (solve for N)

4. Return N_τ
```

---

## 4. PyTorch Implementation

### 4.1 Scaling Law Fitting

```python
import torch
import torch.optim as optim
import numpy as np
import matplotlib.pyplot as plt
from dataclasses import dataclass
from typing import Tuple

@dataclass
class ScalingLawParams:
    """Parameters for L(N, D) = A/N^alpha + B/D^beta + L_inf."""
    A: float
    B: float
    alpha: float
    beta: float
    L_inf: float

class ScalingLawModel(torch.nn.Module):
    """Learnable scaling law: L(N, D) = A/N^alpha + B/D^beta + L_inf."""

    def __init__(self, init_params: ScalingLawParams = None):
        super().__init__()
        if init_params is None:
            init_params = ScalingLawParams(A=400.0, B=400.0, alpha=0.34, beta=0.28, L_inf=1.69)

        # Parameterize in log-space for positivity
        self.log_A = torch.nn.Parameter(torch.tensor(np.log(init_params.A)))       # scalar
        self.log_B = torch.nn.Parameter(torch.tensor(np.log(init_params.B)))       # scalar
        self.log_alpha = torch.nn.Parameter(torch.tensor(np.log(init_params.alpha)))  # scalar
        self.log_beta = torch.nn.Parameter(torch.tensor(np.log(init_params.beta)))    # scalar
        self.L_inf = torch.nn.Parameter(torch.tensor(init_params.L_inf))            # scalar

    def forward(
        self,
        N: torch.Tensor,   # (M,) — number of parameters per run
        D: torch.Tensor,   # (M,) — number of tokens per run
    ) -> torch.Tensor:     # (M,) — predicted loss per run
        A = torch.exp(self.log_A)           # scalar
        B = torch.exp(self.log_B)           # scalar
        alpha = torch.exp(self.log_alpha)   # scalar
        beta = torch.exp(self.log_beta)     # scalar

        # L(N, D) = A / N^alpha + B / D^beta + L_inf
        loss_N = A / (N ** alpha)   # (M,)
        loss_D = B / (D ** beta)    # (M,)
        return loss_N + loss_D + self.L_inf  # (M,)

    def get_params(self) -> ScalingLawParams:
        with torch.no_grad():
            return ScalingLawParams(
                A=torch.exp(self.log_A).item(),
                B=torch.exp(self.log_B).item(),
                alpha=torch.exp(self.log_alpha).item(),
                beta=torch.exp(self.log_beta).item(),
                L_inf=self.L_inf.item(),
            )

def fit_scaling_law(
    N_data: np.ndarray,     # (M,) — parameter counts
    D_data: np.ndarray,     # (M,) — token counts
    L_data: np.ndarray,     # (M,) — observed losses
    lr: float = 0.01,
    num_steps: int = 5000,
) -> ScalingLawParams:
    """Fit scaling law parameters via gradient descent with Huber loss."""

    model = ScalingLawModel()
    optimizer = optim.Adam(model.parameters(), lr=lr)

    N = torch.tensor(N_data, dtype=torch.float64)  # (M,)
    D = torch.tensor(D_data, dtype=torch.float64)  # (M,)
    L = torch.tensor(L_data, dtype=torch.float64)  # (M,)

    huber = torch.nn.HuberLoss(delta=0.05)

    for step in range(num_steps):
        optimizer.zero_grad()
        L_pred = model(N, D)                # (M,)
        loss = huber(L_pred, L)             # scalar
        loss.backward()
        optimizer.step()

        if step % 1000 == 0:
            print(f"Step {step}: fitting loss = {loss.item():.6f}")

    return model.get_params()

def chinchilla_optimal(
    C: float,
    params: ScalingLawParams,
) -> Tuple[float, float, float]:
    """Compute optimal N, D for a given compute budget C.

    Returns (N_opt, D_opt, L_predicted).
    """
    A, B, alpha, beta, L_inf = params.A, params.B, params.alpha, params.beta, params.L_inf

    # N* = ((A*alpha) / (B*beta*6^beta))^(1/(alpha+beta)) * C^(beta/(alpha+beta))
    coeff = (A * alpha / (B * beta * 6**beta)) ** (1.0 / (alpha + beta))
    N_opt = coeff * C ** (beta / (alpha + beta))
    D_opt = C / (6.0 * N_opt)

    L_pred = A / N_opt**alpha + B / D_opt**beta + L_inf
    return N_opt, D_opt, L_pred
```

### 4.2 Synthetic Scaling Experiments

```python
def generate_synthetic_scaling_data(
    num_runs: int = 50,
    seed: int = 42,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate synthetic (N, D, L) data following a known scaling law.

    Ground truth: A=406.4, B=410.7, alpha=0.34, beta=0.28, L_inf=1.69
    """
    rng = np.random.RandomState(seed)

    # True parameters (Hoffmann et al. approximate values)
    A, B, alpha, beta, L_inf = 406.4, 410.7, 0.34, 0.28, 1.69

    # Sample log-uniform parameter counts from 10M to 100B
    log_N = rng.uniform(np.log(1e7), np.log(1e11), num_runs)   # (num_runs,)
    N = np.exp(log_N)                                            # (num_runs,)

    # Sample D with some correlation to N (as in practice)
    # D ~ 20 * N with noise
    log_D = np.log(20) + log_N + rng.normal(0, 0.5, num_runs)  # (num_runs,)
    D = np.exp(log_D)                                            # (num_runs,)

    # Compute true loss + noise
    L_true = A / N**alpha + B / D**beta + L_inf                  # (num_runs,)
    noise = rng.normal(0, 0.01, num_runs)                        # (num_runs,)
    L_observed = L_true + noise                                   # (num_runs,)

    return N, D, L_observed

def demo_scaling_laws():
    """Full demo: generate data, fit scaling law, compute Chinchilla optimal."""

    # 1. Generate synthetic data
    N_data, D_data, L_data = generate_synthetic_scaling_data(num_runs=100)

    # 2. Fit scaling law
    print("=== Fitting Scaling Law ===")
    params = fit_scaling_law(N_data, D_data, L_data, lr=0.01, num_steps=5000)
    print(f"\nFitted parameters:")
    print(f"  A = {params.A:.2f}, B = {params.B:.2f}")
    print(f"  alpha = {params.alpha:.4f}, beta = {params.beta:.4f}")
    print(f"  L_inf = {params.L_inf:.4f}")

    # 3. Compute optimal allocation for various compute budgets
    print("\n=== Chinchilla-Optimal Allocation ===")
    for log_C in [19, 20, 21, 22, 23, 24]:
        C = 10.0 ** log_C
        N_opt, D_opt, L_pred = chinchilla_optimal(C, params)
        print(f"  C = 10^{log_C}: N* = {N_opt:.2e}, D* = {D_opt:.2e}, L* = {L_pred:.4f}")

    # 4. Plot scaling law fit
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))

    # Plot L vs N (fix D at median)
    D_med = np.median(D_data)
    N_range = np.logspace(7, 11, 200)
    L_pred_N = params.A / N_range**params.alpha + params.B / D_med**params.beta + params.L_inf

    axes[0].scatter(N_data, L_data, alpha=0.5, s=20, label="Data")
    axes[0].plot(N_range, L_pred_N, "r-", label="Fit")
    axes[0].set_xscale("log")
    axes[0].set_xlabel("Parameters N")
    axes[0].set_ylabel("Loss L")
    axes[0].set_title("L vs N (D fixed at median)")
    axes[0].legend()

    # Plot L vs D (fix N at median)
    N_med = np.median(N_data)
    D_range = np.logspace(8, 12, 200)
    L_pred_D = params.A / N_med**params.alpha + params.B / D_range**params.beta + params.L_inf

    axes[1].scatter(D_data, L_data, alpha=0.5, s=20, label="Data")
    axes[1].plot(D_range, L_pred_D, "r-", label="Fit")
    axes[1].set_xscale("log")
    axes[1].set_xlabel("Tokens D")
    axes[1].set_ylabel("Loss L")
    axes[1].set_title("L vs D (N fixed at median)")
    axes[1].legend()

    # Plot optimal N, D vs compute
    C_range = np.logspace(18, 25, 100)
    N_opts, D_opts, L_opts = [], [], []
    for C in C_range:
        n, d, l = chinchilla_optimal(C, params)
        N_opts.append(n)
        D_opts.append(d)
        L_opts.append(l)

    axes[2].plot(C_range, N_opts, "b-", label="N*")
    axes[2].plot(C_range, D_opts, "r-", label="D*")
    axes[2].set_xscale("log")
    axes[2].set_yscale("log")
    axes[2].set_xlabel("Compute C (FLOPs)")
    axes[2].set_ylabel("Optimal allocation")
    axes[2].set_title("Chinchilla-Optimal N* and D*")
    axes[2].legend()

    plt.tight_layout()
    plt.savefig("scaling_laws_fit.png", dpi=150)
    plt.show()

if __name__ == "__main__":
    demo_scaling_laws()
```

### 4.3 Emergence Threshold Calculator

```python
def emergence_threshold(
    N_c: float = 8.8e13,
    alpha_N: float = 0.076,
    task_complexity: int = 10,  # number of independent steps
    accuracy_threshold: float = 0.5,
) -> float:
    """Compute the critical model size for a task to 'emerge'.

    Model: Acc(N) = exp(-(N_c/N)^alpha_N)^m = exp(-m * (N_c/N)^alpha_N)
    Solve: Acc(N) = tau
    """
    m = task_complexity
    tau = accuracy_threshold

    # m * (N_c / N)^alpha_N = -ln(tau)
    # (N_c / N)^alpha_N = -ln(tau) / m
    # N_c / N = (-ln(tau) / m)^(1/alpha_N)
    # N = N_c / (-ln(tau) / m)^(1/alpha_N)

    ratio = (-np.log(tau) / m) ** (1.0 / alpha_N)
    N_critical = N_c / ratio

    return N_critical

def plot_emergence():
    """Visualize emergent abilities for tasks of different complexity."""
    N_range = np.logspace(7, 13, 500)  # 10M to 10T
    N_c, alpha_N = 8.8e13, 0.076

    fig, ax = plt.subplots(figsize=(10, 6))

    for m in [1, 5, 10, 20, 50]:
        acc = np.exp(-m * (N_c / N_range) ** alpha_N)
        ax.plot(N_range, acc, label=f"m = {m} steps")

        # Mark 50% threshold
        N_crit = emergence_threshold(N_c, alpha_N, m, 0.5)
        ax.axvline(N_crit, color="gray", linestyle="--", alpha=0.3)

    ax.set_xscale("log")
    ax.set_xlabel("Model size N (parameters)")
    ax.set_ylabel("Task accuracy")
    ax.set_title("Emergent Abilities: Accuracy vs Scale for Multi-Step Tasks")
    ax.legend()
    ax.set_ylim(0, 1.05)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("emergence_plot.png", dpi=150)
    plt.show()
```

---

## 5. Experimental Intuition

### 5.1 Why Power Laws and Not Other Functions?

Power laws ($y \propto x^{-\alpha}$) are distinguished from exponentials ($y \propto e^{-\alpha x}$) by their **scale invariance**: doubling the input changes the output by a constant factor $2^{-\alpha}$, regardless of the absolute scale. This arises naturally when:

1. The data distribution has a hierarchical structure (natural language is Zipfian).
2. The model learns features in order of importance (greedy feature selection).
3. The problem has no characteristic scale (no "natural" model size).

Empirically, exponential scaling would be far more optimistic — it would predict near-zero loss at moderate scale. The slower power-law decay explains why achieving human-level performance requires enormous scale.

### 5.2 Kaplan vs. Chinchilla: What Changed?

| Aspect | Kaplan et al. (2020) | Hoffmann et al. (2022) |
|--------|---------------------|----------------------|
| Optimal $N^* \propto C^a$ | $a \approx 0.73$ | $a \approx 0.50$ |
| Optimal $D^* \propto C^b$ | $b \approx 0.27$ | $b \approx 0.50$ |
| Recommendation | Scale model size aggressively | Scale model and data equally |
| Training tokens for 70B | ~300B tokens | ~1.4T tokens |
| Key model | GPT-3 (175B, 300B tokens) | Chinchilla (70B, 1.4T tokens) |

The difference arose because Kaplan et al. used a fixed learning rate schedule across runs, which biased toward larger models. Chinchilla used per-run optimal schedules.

### 5.3 Practical Implications

1. **Small model, more data** often beats **large model, less data** for the same compute.
2. **Data is the bottleneck**: high-quality training data is being exhausted. Estimates suggest all high-quality internet text is ~10T tokens.
3. **Extrapolation risk**: scaling laws are fit on log-log plots; small errors in exponents lead to large errors at scale. A 10% error in $\alpha$ at $10^{25}$ FLOPs changes the predicted loss significantly.
4. **Inference cost**: scaling laws address training cost but not inference cost. A model trained compute-optimally may be larger than needed for a given inference budget. This motivates over-training smaller models (e.g., LLaMA: 7B trained on 1T tokens, well beyond Chinchilla-optimal).

---

## 6. Connections

- **Module 04 (Transformers)**: Scaling laws apply specifically to the Transformer architecture; they rely on the efficient parameterization and optimization properties of attention + FFN.
- **Module 05b (GPT/BERT/LLaMA)**: Architecture choices (e.g., RMSNorm, SwiGLU) can shift scaling law constants but not exponents.
- **Module 05d (Data Curation)**: Data quality directly affects $B$ and $\beta$ in the scaling law; filtered data improves the data-side power law.
- **Module 06 (Alignment)**: Scaling laws for RLHF and instruction tuning follow different exponents.
- **Statistical Mechanics**: The power-law derivation connects to random energy models and the replica method in spin glass theory.
- **Information Theory (Module 00b)**: $L_\infty$ is the entropy of natural language, estimated at ~1.0–1.5 nats/token for English.

---

## 7. Paper Reading List

### Required

1. **Kaplan et al. (2020)**. *Scaling Laws for Neural Language Models*. arXiv:2001.08361.
   - The foundational paper. Read Sections 1–4 for the empirical laws; Section 6 for the joint scaling law.

2. **Hoffmann et al. (2022)**. *Training Compute-Optimal Large Language Models* (Chinchilla). arXiv:2203.15556.
   - Read the three independent methods for estimating optimal allocation (Sections 3.1–3.3).

3. **Wei et al. (2022)**. *Emergent Abilities of Large Language Models*. arXiv:2206.07682.
   - Catalogs emergent abilities; read the main text and study Figure 2 carefully.

### Recommended

4. **Schaeffer et al. (2023)**. *Are Emergent Abilities of Large Language Models a Mirage?* arXiv:2304.15004.
   - The rebuttal: emergence is a metric artifact. Essential for a balanced view.

5. **Henighan et al. (2020)**. *Scaling Laws for Autoregressive Generative Modeling*. arXiv:2010.14701.
   - Extends scaling laws to images, video, math, and code.

6. **Clark et al. (2022)**. *Unified Scaling Laws for Routed Language Models*. arXiv:2202.01169.
   - Scaling laws for Mixture-of-Experts models.

7. **Muennighoff et al. (2023)**. *Scaling Data-Constrained Language Models*. arXiv:2305.16264.
   - What to do when you run out of data: epoch-based scaling laws.

### Advanced

8. **Bahri et al. (2021)**. *Explaining Neural Scaling Laws*. arXiv:2102.06701.
   - Statistical mechanics derivation of power laws from data spectral properties.

9. **Sharma & Kaplan (2022)**. *Scaling Laws from the Data Manifold Dimension*. arXiv:2004.10802.
   - Connects scaling exponents to intrinsic data dimension.

---

## 8. Exercises

### Conceptual

**Exercise 5a.1.** Starting from the joint scaling law $L(N,D) = A/N^\alpha + B/D^\beta + L_\infty$ with the constraint $C = 6ND$, derive the compute-optimal allocation formulas (Equations 4 and 5 above) from scratch. Verify your answer numerically using the Hoffmann et al. values.

**Exercise 5a.2.** The Kaplan paper observed $\alpha_N \approx 0.076$ while the Chinchilla paper found $\alpha \approx 0.34$ (in a different parameterization). Explain the source of this discrepancy. How does fixing vs. optimizing the learning rate schedule per run change the apparent scaling exponent?

**Exercise 5a.3.** Suppose $L_\infty = 1.69$ nats/token for English. Convert this to bits/token and interpret: what is the per-character entropy implied, assuming an average of 4.5 characters per token?

**Exercise 5a.4.** Prove that if the feature importance distribution follows a power law $\delta_k \propto k^{-\gamma}$ and a model with $N$ parameters can learn the top $K \propto N^{1/d}$ features, then the residual loss $L(N) - L_\infty \propto N^{(1-\gamma)/d}$ for $\gamma > 1$.

### Computational

**Exercise 5a.5.** Using the synthetic data generator above, fit scaling laws and compare three optimization strategies: (a) Adam on Huber loss, (b) L-BFGS on MSE loss, (c) Bayesian optimization with a Gaussian process. Report the fitted parameters and confidence intervals.

**Exercise 5a.6.** Reproduce Figure 1 of the Chinchilla paper: train a series of GPT-2-scale models (1M to 100M parameters) on the Tiny Stories dataset with varying data budgets. Fit the scaling law and compute the Chinchilla-optimal allocation for a $10^{18}$ FLOP budget.

**Exercise 5a.7.** Implement the emergence threshold calculator and plot the critical model size as a function of task complexity $m$ for $m \in [1, 100]$. At what task complexity does emergence require a 1T-parameter model?

**Exercise 5a.8 (Research-Level).** The power-law derivation assumes features are learned in order of importance. In practice, neural networks may learn features in a different order due to the optimization landscape. Design an experiment with a synthetic dataset where you control the feature importance distribution and verify whether the predicted power-law exponent matches the empirical one.
