# Homework 0: Mathematical Foundations Bootcamp

> **Module 00 — Pre-Work**
> **Due:** First day of class
> **Estimated time:** 10–15 hours
> **Total points:** 200

---

## Instructions

- Show all work for theory problems. A correct answer without justification receives no credit.
- For proofs, state clearly what you are assuming and what you are proving.
- For coding problems, submit clean, commented code and include all plots.
- You may use PyTorch and NumPy. Do **not** use high-level library functions that trivialize the problem (e.g., do not call `torch.linalg.svd` in Problem D1).
- Notation follows the course [NOTATION.md](../../NOTATION.md). Vectors are bold lowercase (**x**), matrices are uppercase ($A$), scalars are lowercase italic ($\alpha$).
- Collaboration policy: you may discuss ideas with classmates, but write up all solutions independently. Cite any sources you consult beyond the lecture notes.

---

## Part A: Linear Algebra (50 points)

### Problem A1: SVD Computation (12 pts)

Let $A = \begin{pmatrix} 3 & 2 & 2 \\ 2 & 3 & -2 \end{pmatrix}$.

**(a)** (4 pts) Compute $A^\top A$ and find its eigenvalues and eigenvectors.

**(b)** (4 pts) From part (a), determine the singular values and right singular vectors $\mathbf{v}_1, \mathbf{v}_2, \mathbf{v}_3$ of $A$.

**(c)** (2 pts) Compute the left singular vectors $\mathbf{u}_1, \mathbf{u}_2$ using $\mathbf{u}_i = \frac{1}{\sigma_i} A\mathbf{v}_i$.

**(d)** (2 pts) Write out the full SVD $A = U\Sigma V^\top$ and verify by multiplying.

### Problem A2: Matrix Calculus (15 pts)

Derive the following gradients using the denominator-layout convention ($\partial f / \partial X$ has the same shape as $X$). Show all steps.

**(a)** (3 pts) $f(W) = \|\mathbf{y} - W\mathbf{x}\|_2^2$ where $\mathbf{y} \in \mathbb{R}^m$, $W \in \mathbb{R}^{m \times n}$, $\mathbf{x} \in \mathbb{R}^n$ are given.

Find $\partial f / \partial W$.

*Hint:* Expand the squared norm and apply trace identities.

**(b)** (4 pts) $f(X) = \text{tr}(X^\top AXB)$ where $A \in \mathbb{R}^{n \times n}$, $B \in \mathbb{R}^{m \times m}$, $X \in \mathbb{R}^{n \times m}$.

Find $\partial f / \partial X$.

*Hint:* Use the perturbation approach: compute $f(X + \epsilon H) - f(X)$ to first order in $\epsilon$.

**(c)** (4 pts) $f(\mathbf{x}) = \mathbf{x}^\top A^\top B^{-1} A\mathbf{x} + 2\mathbf{c}^\top A\mathbf{x}$ where $A \in \mathbb{R}^{m \times n}$, $B \in \mathbb{R}^{m \times m}$ is invertible, $\mathbf{c} \in \mathbb{R}^m$, $\mathbf{x} \in \mathbb{R}^n$.

Find $\nabla_\mathbf{x} f$.

**(d)** (4 pts) $f(\Sigma) = \log\det(\Sigma) + \text{tr}(\Sigma^{-1} S)$ where $\Sigma, S \in \mathbb{R}^{n \times n}$, $\Sigma \succ 0$, $S$ is given.

Find $\partial f / \partial \Sigma$.

*Hint:* Use $\partial \log\det(X) / \partial X = X^{-\top}$ and $\partial \text{tr}(X^{-1}A) / \partial X = -X^{-\top} A^\top X^{-\top}$.

This gradient arises in MLE for the Gaussian covariance matrix. Setting it to zero gives the MLE $\hat{\Sigma} = S$.

### Problem A3: Properties of Norms and Trace (12 pts)

**(a)** (3 pts) Prove the triangle inequality for the ℓ₂ norm: $\|\mathbf{x} + \mathbf{y}\|_2 \le \|\mathbf{x}\|_2 + \|\mathbf{y}\|_2$.

*Hint:* Square both sides and use Cauchy-Schwarz.

**(b)** (3 pts) Prove that the Frobenius norm is submultiplicative: $\|AB\|_F \le \|A\|_F \|B\|_F$.

*Hint:* Use the Cauchy-Schwarz inequality on each row of $A$ and column of $B$.

**(c)** (3 pts) Prove the cyclic property of the trace: $\text{tr}(ABC) = \text{tr}(CAB) = \text{tr}(BCA)$ for matrices of compatible dimensions.

**(d)** (3 pts) Prove that $\|A\|_F^2 = \text{tr}(A^\top A) = \sum_i \sigma_i^2(A)$, connecting the Frobenius norm to singular values.

### Problem A4: Eigenvalue Inequalities (11 pts)

**(a)** (4 pts) *Weyl's inequality.* Let $A, B \in \mathbb{R}^{n \times n}$ be symmetric. Prove that for all $i$:

$$\lambda_i(A) + \lambda_n(B) \le \lambda_i(A + B) \le \lambda_i(A) + \lambda_1(B)$$

where eigenvalues are ordered $\lambda_1 \ge \lambda_2 \ge \cdots \ge \lambda_n$.

*Hint:* Use the Courant-Fischer min-max characterization: $\lambda_k(M) = \max_{\dim(V)=k} \min_{\mathbf{x} \in V, \|\mathbf{x}\|=1} \mathbf{x}^\top M\mathbf{x}$.

**(b)** (3 pts) Use Weyl's inequality to explain why adding a small perturbation $\epsilon I$ to a matrix shifts all eigenvalues by exactly $\epsilon$. Why is this technique used in practice (e.g., $\Sigma + \epsilon I$ for numerical stability)?

**(c)** (4 pts) *Cauchy interlacing.* Let $A \in \mathbb{R}^{n \times n}$ be symmetric and let $B$ be the $(n-1) \times (n-1)$ leading principal submatrix of $A$. Prove the interlacing inequalities:

$$\lambda_1(A) \ge \lambda_1(B) \ge \lambda_2(A) \ge \lambda_2(B) \ge \cdots \ge \lambda_{n-1}(B) \ge \lambda_n(A)$$

*Hint:* Use Courant-Fischer and the fact that any $(n-1)$-dimensional subspace of $\mathbb{R}^{n-1}$ (embedded in $\mathbb{R}^n$) is an $(n-1)$-dimensional subspace of $\mathbb{R}^n$.

---

## Part B: Probability and Information Theory (50 points)

### Problem B1: Maximum Likelihood Estimation (12 pts)

**(a)** (4 pts) *Gaussian MLE.* Given i.i.d. samples $\mathbf{x}_1, \dots, \mathbf{x}_N$ from $\mathcal{N}(\boldsymbol{\mu}, \Sigma)$, derive the MLE for $\boldsymbol{\mu}$ and $\Sigma$.

Write the log-likelihood, take derivatives with respect to $\boldsymbol{\mu}$ and $\Sigma$, and set them to zero. You may use the matrix calculus results from Part A.

**(b)** (4 pts) *Bernoulli MLE with Beta prior.* Given $k$ successes in $n$ trials with prior $\theta \sim \text{Beta}(\alpha, \beta)$:

- Derive the MAP estimate $\hat{\theta}_{\text{MAP}}$.
- Show that the MAP estimate is a weighted average of the prior mode and the MLE.
- What happens as $\alpha, \beta \to 1$ (uniform prior)?

**(c)** (4 pts) *Categorical MLE.* Given counts $\mathbf{c} = (c_1, \dots, c_K)$ with $\sum_k c_k = N$, derive the MLE for the categorical parameters $\boldsymbol{\pi}$ using Lagrange multipliers to enforce $\sum_k \pi_k = 1$.

### Problem B2: KL Divergence Computations (12 pts)

**(a)** (3 pts) Compute $\text{KL}(\text{Ber}(p) \| \text{Ber}(q))$ in closed form.

**(b)** (4 pts) Compute $\text{KL}(\mathcal{N}(\mu_1, \sigma_1^2) \| \mathcal{N}(\mu_2, \sigma_2^2))$ for the univariate case. Verify your result by checking:

- It equals zero when $(\mu_1, \sigma_1) = (\mu_2, \sigma_2)$.
- It is non-negative.

**(c)** (5 pts) *KL divergence and exponential families.* Let $p_\theta(\mathbf{x}) = h(\mathbf{x}) \exp(\boldsymbol{\eta}(\theta)^\top \mathbf{T}(\mathbf{x}) - A(\theta))$ be an exponential family distribution with natural parameter $\boldsymbol{\eta}$, sufficient statistic $\mathbf{T}$, and log-partition function $A$.

Show that $\text{KL}(p_{\theta_1} \| p_{\theta_2}) = A(\theta_2) - A(\theta_1) - \nabla A(\theta_1)^\top(\boldsymbol{\eta}_2 - \boldsymbol{\eta}_1)$, where $\boldsymbol{\eta}_i = \boldsymbol{\eta}(\theta_i)$.

*Hint:* Use the fact that $\nabla_{\boldsymbol{\eta}} A(\boldsymbol{\eta}) = \mathbb{E}_{p_\theta}[\mathbf{T}(\mathbf{x})]$.

### Problem B3: Entropy Calculations (12 pts)

**(a)** (3 pts) Compute the entropy $H(X)$ when $X \sim \text{Cat}(\boldsymbol{\pi})$ with $\boldsymbol{\pi} = (1/4, 1/4, 1/4, 1/4)$. What is the entropy for general $K$ with the uniform distribution?

**(b)** (4 pts) Show that among all distributions on $\{1, \dots, K\}$, the uniform distribution maximizes entropy. Use Lagrange multipliers.

**(c)** (5 pts) Compute the differential entropy $h(\mathbf{x})$ of $\mathbf{x} \sim \mathcal{N}(\boldsymbol{\mu}, \Sigma)$ where $\Sigma = \text{diag}(\sigma_1^2, \dots, \sigma_d^2)$. Show it equals $\sum_{i=1}^d h(x_i)$ where $x_i \sim \mathcal{N}(\mu_i, \sigma_i^2)$, confirming that entropy is additive for independent variables.

### Problem B4: Bayesian Inference (14 pts)

**(a)** (5 pts) *Gaussian-Gaussian model.* You observe $x_1, \dots, x_N$ where $x_i | \mu \sim \mathcal{N}(\mu, \sigma^2)$ (known $\sigma^2$) and $\mu \sim \mathcal{N}(\mu_0, \tau^2)$ (prior).

- Derive the posterior $p(\mu | x_1, \dots, x_N)$.
- Express the posterior mean as a convex combination of $\mu_0$ and $\bar{x} = \frac{1}{N}\sum x_i$.
- Derive the posterior predictive distribution $p(x_{N+1} | x_1, \dots, x_N) = \int p(x_{N+1} | \mu)\,p(\mu | x_1, \dots, x_N)\,d\mu$.

**(b)** (5 pts) *Beta-Binomial model.* A coin has unknown bias $\theta \sim \text{Beta}(2, 2)$ (prior centered at 0.5 with mild concentration). You observe 7 heads in 10 flips.

- Compute the posterior distribution.
- Compute the posterior mean, mode, and 95% credible interval (numerically is fine).
- How does the posterior compare to the MLE $\hat{\theta} = 0.7$?

**(c)** (4 pts) *Bayesian model comparison.* You have two models: $M_1$ says $\theta = 0.5$ (fair coin) and $M_2$ says $\theta \sim \text{Beta}(1, 1)$ (uniform prior). Compute the Bayes factor $\frac{p(\text{data} | M_2)}{p(\text{data} | M_1)}$ for the data from part (b). Which model does the data favor?

*Hint:* $p(\text{data} | M_2) = \int_0^1 \binom{10}{7}\theta^7(1-\theta)^3 \cdot 1\,d\theta = \binom{10}{7}\frac{7!\,3!}{11!}$.

---

## Part C: Optimization (50 points)

### Problem C1: Convexity Analysis (10 pts)

For each function, determine whether it is convex. Prove or disprove.

**(a)** (2 pts) $f(\mathbf{x}) = \max(x_1, x_2, \dots, x_n)$

**(b)** (3 pts) $f(x) = x \log x$ for $x > 0$

**(c)** (2 pts) $f(\mathbf{x}) = \|A\mathbf{x} - \mathbf{b}\|_2$ (not squared)

**(d)** (3 pts) $f(\mathbf{x}) = \sum_{i=1}^n \log(1 + e^{-x_i})$ (sum of logistic losses)

### Problem C2: Gradient Descent Convergence (15 pts)

**(a)** (5 pts) *Prove the sufficient decrease lemma.* If $f$ is $L$-smooth and we take a gradient step $\mathbf{x}^+ = \mathbf{x} - \frac{1}{L}\nabla f(\mathbf{x})$, then:

$$f(\mathbf{x}^+) \le f(\mathbf{x}) - \frac{1}{2L}\|\nabla f(\mathbf{x})\|^2$$

**(b)** (5 pts) *Convergence rate for strongly convex.* Prove that for $m$-strongly convex, $L$-smooth $f$ with $\eta = 1/L$:

$$\|\mathbf{x}_{t+1} - \mathbf{x}^*\|^2 \le \left(1 - \frac{m}{L}\right)\|\mathbf{x}_t - \mathbf{x}^*\|^2$$

*Hint:* Use strong convexity to lower-bound $\nabla f(\mathbf{x})^\top(\mathbf{x} - \mathbf{x}^*)$ and the co-coercivity inequality: $\|\nabla f(\mathbf{x}) - \nabla f(\mathbf{y})\|^2 \le L\,\langle \nabla f(\mathbf{x}) - \nabla f(\mathbf{y}),\, \mathbf{x} - \mathbf{y} \rangle$.

**(c)** (5 pts) *Lower bound.* Show that no first-order method (using only gradient evaluations) can converge faster than $\mathcal{O}(1/T^2)$ on the class of $L$-smooth convex functions, by constructing a "hard instance."

*Hint:* Consider the tridiagonal matrix $A$ with $A_{ii} = 2$, $A_{i,i+1} = A_{i+1,i} = -1$, and the quadratic $f(\mathbf{x}) = \frac{1}{2}\mathbf{x}^\top A\mathbf{x} - e_1^\top\mathbf{x}$. Argue that after $T$ steps, a first-order method can only have information in the subspace $\text{span}(\mathbf{e}_1, A\mathbf{e}_1, \dots, A^T\mathbf{e}_1)$ — the Krylov subspace.

### Problem C3: Momentum Analysis (12 pts)

Consider the quadratic $f(x, y) = \frac{1}{2}(ax^2 + by^2)$ with $a = 100$, $b = 1$ (condition number $\kappa = 100$).

**(a)** (3 pts) Compute the optimal constant learning rate for GD and the resulting per-iteration convergence rate.

**(b)** (3 pts) Add Polyak momentum with coefficient $\beta$. Write the iteration as a 2D linear system and find the eigenvalues of the iteration matrix (for each coordinate separately). What is the optimal $\beta$?

**(c)** (3 pts) Show that with optimal momentum, the convergence rate improves from $\frac{\kappa - 1}{\kappa + 1} \approx 0.98$ to $\frac{\sqrt{\kappa} - 1}{\sqrt{\kappa} + 1} \approx 0.82$ per iteration.

**(d)** (3 pts) Implement both methods and plot the trajectories in the $(x, y)$ plane, along with $f$ vs. iteration number. Verify the convergence rates empirically.

### Problem C4: Adam Derivation Details (13 pts)

**(a)** (3 pts) *Bias in moment estimates.* Prove that $\mathbb{E}[\mathbf{m}_t] = (1 - \beta_1^t)\,\mathbb{E}[\mathbf{g}]$ (assuming i.i.d. gradients) by unrolling the recursion $\mathbf{m}_t = \beta_1\,\mathbf{m}_{t-1} + (1-\beta_1)\,\mathbf{g}_t$.

**(b)** (3 pts) *Effective step size.* Show that Adam's update has an effective per-coordinate learning rate of approximately $\eta / \sqrt{\mathbb{E}[g_j^2]}$ for coordinate $j$ (ignoring bias correction and the $\epsilon$ term).

**(c)** (4 pts) *Adam failure case.* Construct a simple 1D online optimization problem where Adam converges to the wrong answer but SGD converges correctly.

*Hint:* This is the example from Reddi et al. (2018). Consider alternating between two gradient values $g_t \in \{+C, -1\}$ with appropriate frequencies, chosen so that the sign of the mean gradient disagrees with the sign of Adam's accumulated update.

**(d)** (3 pts) *AMSGrad fix.* Describe the AMSGrad modification and explain why it fixes the issue in part (c).

---

## Part D: Coding Warmup (50 points)

### Problem D1: SVD via Power Iteration (18 pts)

Implement the SVD of an $m \times n$ matrix using power iteration and deflation. Do **not** use `torch.linalg.svd`, `torch.linalg.eigh`, or similar library routines for eigendecomposition or SVD.

```python
import torch

def power_iteration(A: torch.Tensor, num_iters: int = 300) -> tuple:
    """
    Find the largest singular value and corresponding singular vectors of A.

    Args:
        A: (m, n) tensor

    Returns:
        sigma: scalar, largest singular value
        u: (m,) left singular vector
        v: (n,) right singular vector
    """
    # YOUR CODE HERE
    pass

def svd_power(A: torch.Tensor, k: int = None, num_iters: int = 300) -> tuple:
    """
    Compute the rank-k SVD using power iteration + deflation.

    Args:
        A: (m, n) tensor
        k: number of singular values to compute (default: min(m, n))
        num_iters: iterations per singular value

    Returns:
        U: (m, k) left singular vectors
        S: (k,) singular values
        Vh: (k, n) right singular vectors (transposed)
    """
    # YOUR CODE HERE
    pass
```

**Requirements:**

- (6 pts) Correct implementation of power iteration for the top singular triplet.
- (6 pts) Correct deflation and iterative extraction of all singular values.
- (3 pts) Test on random matrices of sizes $10 \times 8$, $50 \times 30$, and $100 \times 100$. Report relative error $\|A - U\Sigma V^\top\|_F / \|A\|_F$ for each.
- (3 pts) Plot convergence: singular value estimate vs. iteration number for a $20 \times 15$ matrix.

### Problem D2: MLE for Gaussian Mixture Model (16 pts)

Implement the EM algorithm for a mixture of $K$ Gaussians in 2D.

```python
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

def generate_gmm_data(means, covs, weights, N):
    """
    Generate N samples from a Gaussian mixture model.

    Args:
        means: list of K tensors, each (2,)
        covs: list of K tensors, each (2, 2)
        weights: (K,) tensor, mixture weights
        N: number of samples

    Returns:
        data: (N, 2) samples
        labels: (N,) true cluster assignments
    """
    # YOUR CODE HERE
    pass

def em_gmm(data: torch.Tensor, K: int, num_iters: int = 100) -> dict:
    """
    EM algorithm for Gaussian mixture model.

    Args:
        data: (N, 2) samples
        K: number of mixture components
        num_iters: number of EM iterations

    Returns:
        dict with keys:
            'means': list of K tensors (2,)
            'covs': list of K tensors (2, 2)
            'weights': (K,) tensor
            'responsibilities': (N, K) tensor
            'log_likelihoods': list of floats (one per iteration)
    """
    # YOUR CODE HERE
    pass
```

**Requirements:**

- (4 pts) Correct E-step: compute responsibilities $\gamma_{ik} = \pi_k \mathcal{N}(\mathbf{x}_i; \boldsymbol{\mu}_k, \Sigma_k) / \sum_j \pi_j \mathcal{N}(\mathbf{x}_i; \boldsymbol{\mu}_j, \Sigma_j)$.
- (4 pts) Correct M-step: update $\pi_k$, $\boldsymbol{\mu}_k$, $\Sigma_k$ using the responsibilities.
- (4 pts) Generate data from a 3-component mixture with well-separated means. Run EM and plot:
  - Data colored by estimated cluster assignment.
  - Fitted Gaussian contours (1 and 2 standard deviation ellipses).
  - Log-likelihood vs. iteration number (verify it is non-decreasing).
- (4 pts) Experiment with initialization: run EM 10 times with random initializations. How often does it find the correct clustering? Plot the histogram of final log-likelihoods.

### Problem D3: Optimizer Comparison on the Rosenbrock Function (16 pts)

Implement GD, SGD (with artificial noise), Momentum, and Adam *from scratch* (no `torch.optim`).

**The Rosenbrock function:** $f(x, y) = (1 - x)^2 + 100(y - x^2)^2$, with global minimum at $(1, 1)$.

```python
def rosenbrock(xy: torch.Tensor) -> torch.Tensor:
    """
    Rosenbrock function.
    Args: xy: (2,) tensor [x, y]
    Returns: scalar
    """
    x, y = xy[0], xy[1]
    return (1 - x)**2 + 100 * (y - x**2)**2

def rosenbrock_grad(xy: torch.Tensor) -> torch.Tensor:
    """
    Gradient of Rosenbrock function.
    Args: xy: (2,) tensor [x, y]
    Returns: (2,) gradient
    """
    x, y = xy[0], xy[1]
    dfdx = -2 * (1 - x) - 400 * x * (y - x**2)
    dfdy = 200 * (y - x**2)
    return torch.tensor([dfdx, dfdy])
```

**Requirements:**

- (4 pts) Implement all four optimizers from scratch. Each should accept a gradient function, initial point, and hyperparameters.
- (4 pts) For each optimizer, carefully tune hyperparameters to achieve the best convergence. Report the hyperparameters you used and how you chose them.
- (4 pts) Generate the following plots (all in one figure with subplots):
  1. Trajectories in the $(x, y)$ plane overlaid on contours of $f$.
  2. $f(\mathbf{x}_t)$ vs. iteration $t$ (log scale on $y$-axis).
  3. $\|\mathbf{x}_t - \mathbf{x}^*\|$ vs. iteration $t$ (log scale).
- (4 pts) Discussion: Which optimizer converges fastest? Why? What happens if you use the same learning rate for all optimizers?

---

## Submission Checklist

- [ ] Part A: Problems A1–A4, all handwritten proofs or typed LaTeX.
- [ ] Part B: Problems B1–B4, all derivations shown.
- [ ] Part C: Problems C1–C4, all proofs and analyses.
- [ ] Part D: Problems D1–D3, all code files and generated plots.
- [ ] All code runs without errors on a machine with PyTorch >= 2.0.
- [ ] No use of prohibited library functions (see individual problem statements).

---

## Grading Rubric Summary

| Problem | Points | Topic |
|---------|--------|-------|
| A1 | 12 | SVD computation |
| A2 | 15 | Matrix calculus |
| A3 | 12 | Norm/trace properties |
| A4 | 11 | Eigenvalue inequalities |
| B1 | 12 | MLE derivations |
| B2 | 12 | KL divergence |
| B3 | 12 | Entropy |
| B4 | 14 | Bayesian inference |
| C1 | 10 | Convexity analysis |
| C2 | 15 | GD convergence proofs |
| C3 | 12 | Momentum analysis |
| C4 | 13 | Adam derivation |
| D1 | 18 | SVD implementation |
| D2 | 16 | GMM-EM implementation |
| D3 | 16 | Optimizer comparison |
| **Total** | **200** | |

---

## Hints for Selected Problems

**A2(b):** The perturbation approach is often easier than index manipulation. Compute:

$$f(X+\epsilon H) = \text{tr}\bigl((X+\epsilon H)^\top A(X+\epsilon H)B\bigr) = f(X) + \epsilon\,\text{tr}(H^\top AXB) + \epsilon\,\text{tr}(X^\top AHB) + \mathcal{O}(\epsilon^2)$$

Then use $\text{tr}(X^\top AHB) = \text{tr}(BX^\top AH) = \text{tr}(H^\top A^\top XB^\top)$ (combining the cyclic property and transpose-of-trace). So the directional derivative is $\text{tr}(H^\top(AXB + A^\top XB^\top))$, giving $\nabla_X f = AXB + A^\top XB^\top$.

**B4(a):** The posterior for the Gaussian-Gaussian model is:

$$\mu | \text{data} \sim \mathcal{N}\!\left(\frac{\tau^2 N \bar{x} + \sigma^2 \mu_0}{N\tau^2 + \sigma^2},\; \frac{\sigma^2 \tau^2}{N\tau^2 + \sigma^2}\right)$$

The posterior mean is a precision-weighted average: $\mu_{\text{post}} = \frac{N/\sigma^2}{N/\sigma^2 + 1/\tau^2}\bar{x} + \frac{1/\tau^2}{N/\sigma^2 + 1/\tau^2}\mu_0$.

**C2(b):** The co-coercivity inequality for $L$-smooth convex functions states: $\langle \nabla f(\mathbf{x}) - \nabla f(\mathbf{y}), \mathbf{x} - \mathbf{y} \rangle \ge \frac{1}{L}\|\nabla f(\mathbf{x}) - \nabla f(\mathbf{y})\|^2$. Use this with $\mathbf{y} = \mathbf{x}^*$ (so $\nabla f(\mathbf{y}) = \mathbf{0}$) together with strong convexity $\nabla f(\mathbf{x})^\top(\mathbf{x} - \mathbf{x}^*) \ge m\|\mathbf{x} - \mathbf{x}^*\|^2$.

**D2:** For numerical stability in the E-step, work in log-space: compute $\log \gamma_{ik}$ using the log-sum-exp trick. Add a small ridge $\epsilon I$ ($\epsilon = 10^{-6}$) to covariance estimates to prevent singularity.

---

*Good luck! Completing this homework thoroughly will prepare you well for the semester.*
