# Prerequisites

This course assumes strong mathematical maturity and programming skills. Below is a detailed checklist — if you can comfortably solve 80%+ of the self-assessment problems, you are ready.

## 1. Linear Algebra

**Required level**: A full undergraduate course (e.g., Strang's *Linear Algebra and Its Applications*, or Axler's *Linear Algebra Done Right*).

You should be fluent in:
- Vector spaces, bases, dimension, rank, null space
- Matrix multiplication, inverses, determinants
- Eigendecomposition: eigenvalues, eigenvectors, diagonalization
- Singular Value Decomposition (SVD) and its geometric interpretation
- Positive definite matrices and quadratic forms
- Matrix calculus: gradients of scalar-valued functions of matrices, the chain rule for matrix expressions
- Norms: vector norms (ℓ₁, ℓ₂, ℓ∞), matrix norms (Frobenius, spectral)
- Trace and its cyclic property: tr(ABC) = tr(CAB)

**Self-assessment problems**:
1. Prove that the rank of AB is at most min(rank(A), rank(B)).
2. Given A = UΣVᵀ (SVD), express the pseudoinverse A⁺ in terms of U, Σ, V.
3. Compute ∂/∂W tr(WᵀAW) where W ∈ ℝⁿˣᵏ and A is symmetric.
4. Show that a symmetric matrix is positive definite iff all eigenvalues are positive.
5. Prove that the Frobenius norm satisfies ‖A‖_F = √(tr(AᵀA)).

## 2. Multivariate Calculus

**Required level**: Multivariable calculus + familiarity with vector calculus.

You should be fluent in:
- Partial derivatives, gradients, Jacobians, Hessians
- Chain rule for compositions of multivariate functions
- Taylor expansion (first and second order) for multivariate functions
- Implicit function theorem (conceptual understanding)
- Leibniz integral rule (differentiation under the integral sign)

**Self-assessment problems**:
1. Compute the Jacobian of f(x) = softmax(x) for x ∈ ℝⁿ.
2. Show that the Hessian of f(x) = ½xᵀAx is A (for symmetric A).
3. Derive the gradient of the cross-entropy loss L = −Σᵢ yᵢ log(pᵢ) with respect to the logits z, where p = softmax(z).

## 3. Probability & Statistics

**Required level**: A graduate-level probability course or strong undergraduate course (e.g., Casella & Berger, or Wasserman's *All of Statistics*).

You should be fluent in:
- Random variables, PDFs, CDFs, expectations, variance, covariance
- Joint, marginal, and conditional distributions
- Bayes' theorem and its applications
- Common distributions: Gaussian, Bernoulli, categorical, Poisson, exponential
- Maximum likelihood estimation (MLE) and maximum a posteriori (MAP)
- KL divergence: definition, non-negativity (Gibbs' inequality), asymmetry
- Entropy, cross-entropy, mutual information
- Law of large numbers, central limit theorem (conceptual)
- Monte Carlo estimation basics

**Self-assessment problems**:
1. Derive the MLE for the mean and variance of a Gaussian distribution.
2. Prove that KL(p‖q) ≥ 0 using Jensen's inequality.
3. Show that minimizing cross-entropy H(p, q) is equivalent to minimizing KL(p‖q) when p is fixed.
4. Derive the entropy of a d-dimensional Gaussian N(μ, Σ).
5. Explain why KL divergence is not a metric (give a counterexample for the triangle inequality).

## 4. Optimization

**Required level**: Exposure to convex optimization (e.g., first few chapters of Boyd & Vandenberghe).

You should be fluent in:
- Gradient descent and its convergence for convex functions
- Convexity: definitions, first-order and second-order conditions
- Stochastic gradient descent (SGD): basics and convergence intuition
- Lagrangian duality and KKT conditions (conceptual)
- Line search, learning rate schedules (conceptual)

**Self-assessment problems**:
1. Prove that gradient descent with step size η < 2/L converges for L-smooth convex functions.
2. Show that f(x) = log(1 + eˣ) (softplus) is convex.
3. Write the Lagrangian for min ‖x‖² subject to Ax = b, and derive the dual.

## 5. Programming

**Required level**: Fluent Python programmer with scientific computing experience.

You should be comfortable with:
- Python: classes, decorators, generators, context managers
- NumPy: broadcasting, vectorized operations, linear algebra routines
- PyTorch: tensors, autograd, nn.Module, DataLoader, training loops
- Matplotlib: basic plotting and visualization
- Git: branching, committing, basic collaboration
- Command line: SSH, tmux/screen, package management

**Self-assessment**:
1. Implement matrix multiplication using only NumPy (no `np.matmul` or `@`).
2. Write a PyTorch `nn.Module` that implements a 2-layer MLP with ReLU activation.
3. Write a training loop that trains the MLP on synthetic data with SGD.

## 6. Machine Learning Fundamentals

**Required level**: One ML course (e.g., Andrew Ng's Coursera, Bishop Ch. 1–4, or Murphy Ch. 1–8).

You should understand:
- Supervised learning: regression, classification, loss functions
- Bias-variance tradeoff
- Overfitting, underfitting, train/validation/test splits
- Cross-validation
- Logistic regression and softmax regression
- Regularization: L1, L2, early stopping
- Basic neural networks: what they are, how they're trained

## Recommended Textbooks

| Topic | Book |
|-------|------|
| Linear Algebra | Strang, *Linear Algebra and Its Applications* |
| Probability | Wasserman, *All of Statistics* |
| Optimization | Boyd & Vandenberghe, *Convex Optimization* |
| Machine Learning | Bishop, *Pattern Recognition and Machine Learning* |
| Deep Learning | Goodfellow et al., *Deep Learning* (MIT Press) |
| Deep Learning | Prince, *Understanding Deep Learning* (MIT Press) |

## If You Need to Catch Up

- **Linear algebra gap**: Work through 3Blue1Brown's *Essence of Linear Algebra* (video), then Strang Ch. 1–7
- **Probability gap**: Work through Blitzstein & Hwang, *Introduction to Probability*
- **Optimization gap**: Read Boyd & Vandenberghe Ch. 1–5 (available free online)
- **Programming gap**: Complete the PyTorch official tutorials (60-minute blitz + data loading)
- **ML gap**: Complete Andrew Ng's Machine Learning Specialization on Coursera

Complete [HW0: Math Bootcamp](modules/00_foundations/hw00_math_bootcamp.md) as a diagnostic — it covers all prerequisite topics.
