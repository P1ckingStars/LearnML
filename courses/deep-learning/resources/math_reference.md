# Mathematical Reference for Deep Learning

A concise reference for the mathematical identities, theorems, distributions, and inequalities most frequently encountered in deep learning research.

---

## Table of Contents

1. [Linear Algebra and Matrix Calculus](#linear-algebra-and-matrix-calculus)
2. [Probability Distributions](#probability-distributions)
3. [Information Theory](#information-theory)
4. [Key Inequalities](#key-inequalities)
5. [Optimization](#optimization)
6. [Useful Approximations and Asymptotics](#useful-approximations-and-asymptotics)
7. [Measure-Theoretic Probability](#measure-theoretic-probability)
8. [Functional Analysis Basics](#functional-analysis-basics)

---

## Linear Algebra and Matrix Calculus

### Notation

- Scalars: lowercase italic (x, y, alpha)
- Vectors: bold lowercase (**x**, **y**) -- column vectors by default
- Matrices: bold uppercase (**A**, **B**)
- Tensors: calligraphic or bold script
- **I**_n: n x n identity matrix
- **1**: vector of all ones
- tr(**A**): trace of **A**
- det(**A**): determinant of **A**
- **A**^T: transpose, **A**^H: conjugate transpose
- **A**^{-1}: inverse, **A**^+: Moore-Penrose pseudoinverse
- ||**x**||_p: L^p norm, ||**A**||_F: Frobenius norm
- diag(**x**): diagonal matrix from vector, diag(**A**): diagonal vector from matrix
- **A** circle-times **B**: Kronecker product
- **A** circle-dot **B**: Hadamard (element-wise) product
- vec(**A**): column-major vectorization

### Matrix Calculus Identities

All derivatives follow the **numerator layout** convention unless stated otherwise. For f: R^{m x n} -> R, the gradient d f / d **X** is an m x n matrix with (d f / d **X**)_{ij} = d f / d X_{ij}.

#### Scalar-by-Vector Derivatives

| Function f(**x**) | Gradient nabla_**x** f |
|---|---|
| **a**^T **x** | **a** |
| **x**^T **A** **x** | (**A** + **A**^T) **x** |
| **x**^T **x** | 2**x** |
| \|\|**x**\|\|_2 | **x** / \|\|**x**\|\|_2 |
| **a**^T **X** **b** (w.r.t. vec(**X**)) | **b** circle-times **a** |
| sigma(**x**) (element-wise) | diag(sigma'(**x**)) |

#### Scalar-by-Matrix Derivatives

| Function f(**X**) | Gradient d f / d **X** |
|---|---|
| tr(**A** **X**) | **A**^T |
| tr(**X**^T **A**) | **A** |
| tr(**X**^T **X**) | 2**X** |
| tr(**A** **X** **B**) | **A**^T **B**^T (transposed) |
| tr(**X**^{-1} **A**) | -**X**^{-T} **A**^T **X**^{-T} |
| log det(**X**) | **X**^{-T} |
| det(**X**) | det(**X**) **X**^{-T} |
| **a**^T **X**^{-1} **b** | -**X**^{-T} **a** **b**^T **X**^{-T} |

#### Chain Rules

**Vector chain rule.** If f(**x**) = g(**h**(**x**)) where **h**: R^n -> R^m and g: R^m -> R, then:

nabla_**x** f = **J**_**h**^T nabla_**h** g

where **J**_**h** is the m x n Jacobian of **h**.

**Matrix chain rule.** If f(**X**) = g(h(**X**)) where h: R^{m x n} -> R^{p x q} and g: R^{p x q} -> R, then:

d f / d X_{ij} = sum_{k,l} (d g / d h_{kl}) (d h_{kl} / d X_{ij})

In practice, use the vec operator and Kronecker products:

d vec(f) / d vec(**X**) follows standard chain rules for vectorized forms.

### Key Matrix Identities

**Woodbury identity:**
(**A** + **U** **C** **V**)^{-1} = **A**^{-1} - **A**^{-1} **U** (**C**^{-1} + **V** **A**^{-1} **U**)^{-1} **V** **A**^{-1}

**Matrix inversion lemma (Sherman-Morrison, rank-1 case):**
(**A** + **u** **v**^T)^{-1} = **A**^{-1} - (**A**^{-1} **u** **v**^T **A**^{-1}) / (1 + **v**^T **A**^{-1} **u**)

**Push-through identity:**
**A** (**I** + **B** **A**)^{-1} = (**I** + **A** **B**)^{-1} **A**

**Trace cycling:**
tr(**A** **B** **C**) = tr(**C** **A** **B**) = tr(**B** **C** **A**)

**Determinant of block matrices:**
det([**A**, **B**; **C**, **D**]) = det(**A**) det(**D** - **C** **A**^{-1} **B**) (when **A** is invertible)

**Kronecker product mixed-product rule:**
(**A** circle-times **B**)(**C** circle-times **D**) = (**A****C**) circle-times (**B****D**)

### Eigendecomposition and SVD

**Eigendecomposition** (for square **A**): **A** = **Q** **Lambda** **Q**^{-1} where **Lambda** = diag(lambda_1, ..., lambda_n).

For symmetric **A**: **A** = **Q** **Lambda** **Q**^T with orthogonal **Q**.

**Singular Value Decomposition:** **A** = **U** **Sigma** **V**^T where **U** in R^{m x m}, **Sigma** in R^{m x n}, **V** in R^{n x n}.

Properties:

- ||**A**||_F = sqrt(sum_i sigma_i^2)
- ||**A**||_2 = sigma_max(**A**)
- rank(**A**) = number of nonzero singular values
- Best rank-k approximation (Eckart-Young): **A**_k = sum_{i=1}^{k} sigma_i **u**_i **v**_i^T

### Positive Definite Matrices

**A** is positive semi-definite (PSD, **A** >= 0) iff:

- **x**^T **A** **x** >= 0 for all **x**
- All eigenvalues are non-negative
- There exists **B** such that **A** = **B**^T **B**
- All principal minors are non-negative

**A** is positive definite (PD, **A** > 0) iff all of the above hold with strict inequality.

**Schur complement:** The block matrix [**A**, **B**; **B**^T, **C**] >= 0 iff **A** >= 0 and **C** - **B**^T **A**^+ **B** >= 0 (and range(**B**) subset range(**A**)).

---

## Probability Distributions

### Discrete Distributions

**Bernoulli(p):**

- PMF: P(X = k) = p^k (1-p)^{1-k} for k in {0, 1}
- Mean: p, Variance: p(1-p)
- Used in: binary classification, dropout, binary latent variables

**Categorical(p_1, ..., p_K):**

- PMF: P(X = k) = p_k for k in {1, ..., K}
- Mean of one-hot encoding: (p_1, ..., p_K)
- Used in: multi-class classification, language modeling, discrete VAEs

**Binomial(n, p):**

- PMF: P(X = k) = C(n,k) p^k (1-p)^{n-k}
- Mean: np, Variance: np(1-p)

**Poisson(lambda):**

- PMF: P(X = k) = lambda^k e^{-lambda} / k!
- Mean: lambda, Variance: lambda
- Used in: count data, point processes

### Continuous Distributions

**Normal (Gaussian) N(mu, sigma^2):**

- PDF: f(x) = (2 pi sigma^2)^{-1/2} exp(-(x - mu)^2 / (2 sigma^2))
- Mean: mu, Variance: sigma^2
- Entropy: (1/2) ln(2 pi e sigma^2)
- MGF: exp(mu t + sigma^2 t^2 / 2)
- Closure properties: Sum of independent normals is normal. Affine transformations preserve normality.
- Used in: VAE latent spaces, weight initialization, noise models, diffusion processes

**Multivariate Normal N(**mu**, **Sigma**):**

- PDF: f(**x**) = (2 pi)^{-d/2} |**Sigma**|^{-1/2} exp(-(1/2)(**x** - **mu**)^T **Sigma**^{-1} (**x** - **mu**))
- Conditional: If [**x**_1; **x**_2] ~ N([**mu**_1; **mu**_2], [**Sigma**_{11}, **Sigma**_{12}; **Sigma**_{21}, **Sigma**_{22}]), then **x**_1 | **x**_2 ~ N(**mu**_1 + **Sigma**_{12} **Sigma**_{22}^{-1}(**x**_2 - **mu**_2), **Sigma**_{11} - **Sigma**_{12} **Sigma**_{22}^{-1} **Sigma**_{21})
- Entropy: (d/2) ln(2 pi e) + (1/2) ln det(**Sigma**)
- KL divergence: `KL(N_0 || N_1) = (1/2)[tr(Sigma_1^{-1} Sigma_0) + (mu_1 - mu_0)^T Sigma_1^{-1} (mu_1 - mu_0) - d + ln(det Sigma_1 / det Sigma_0)]`

**Exponential(lambda):**

- PDF: f(x) = lambda e^{-lambda x} for x >= 0
- Mean: 1/lambda, Variance: 1/lambda^2
- Memoryless property: P(X > s + t | X > s) = P(X > t)

**Gamma(alpha, beta):**

- PDF: f(x) = beta^alpha / Gamma(alpha) x^{alpha-1} e^{-beta x}
- Mean: alpha/beta, Variance: alpha/beta^2
- Special cases: Exponential (alpha=1), Chi-squared (alpha=k/2, beta=1/2)

**Beta(alpha, beta):**

- PDF: f(x) = x^{alpha-1} (1-x)^{beta-1} / B(alpha, beta)
- Mean: alpha / (alpha + beta)
- Conjugate prior for Bernoulli likelihood
- Used in: Bayesian inference, Beta-VAE

**Dirichlet(alpha_1, ..., alpha_K):**

- PDF: f(**x**) = (1/B(**alpha**)) prod_i x_i^{alpha_i - 1} on the simplex
- Mean: alpha_i / sum_j alpha_j
- Conjugate prior for Categorical likelihood
- Used in: topic models (LDA), mixture models

**Laplace(mu, b):**

- PDF: f(x) = (1/2b) exp(-|x - mu| / b)
- Mean: mu, Variance: 2b^2
- Heavier tails than Gaussian; corresponds to L1 regularization as a prior

**Student-t(nu):**

- Heavier tails than Gaussian; approaches Gaussian as nu -> infinity
- Used in: robust regression, uncertainty estimation

**Gumbel(mu, beta):**

- CDF: F(x) = exp(-exp(-(x - mu)/beta))
- Used in: Gumbel-Softmax trick for differentiable discrete sampling

### The Exponential Family

A distribution is in the exponential family if its PDF/PMF can be written as:

f(x | theta) = h(x) exp(eta(theta)^T T(x) - A(theta))

where T(x) is the sufficient statistic, eta(theta) is the natural parameter, A(theta) is the log-partition function, and h(x) is the base measure.

Key properties:

- nabla_eta A(eta) = E[T(X)] (mean of sufficient statistics)
- nabla^2_eta A(eta) = Cov[T(X)] (and is therefore PSD)
- Maximum entropy distribution given constraints on E[T(X)]
- Conjugate priors exist in closed form
- Members: Gaussian, Bernoulli, Categorical, Poisson, Exponential, Gamma, Beta, Dirichlet

---

## Information Theory

### Entropy

**Shannon entropy** of a discrete random variable X:

H(X) = -sum_x p(x) log p(x)

Properties:

- H(X) >= 0, with equality iff X is deterministic
- H(X) <= log |X| (maximized by uniform distribution)
- H(X, Y) = H(X) + H(Y|X) = H(Y) + H(X|Y)
- H(X, Y) <= H(X) + H(Y), with equality iff X, Y independent

**Differential entropy** of a continuous random variable:

h(X) = -integral f(x) log f(x) dx

Note: Differential entropy can be negative (e.g., for Uniform(0, 1/2), h = -log 2 < 0).

### KL Divergence

**Kullback-Leibler divergence:**

KL(p || q) = sum_x p(x) log(p(x) / q(x)) = E_p[log(p/q)]

Properties:

- KL(p || q) >= 0 (Gibbs' inequality), with equality iff p = q a.e.
- NOT symmetric: KL(p || q) != KL(q || p) in general
- NOT a metric (does not satisfy triangle inequality)
- Forward KL (KL(p || q)): mean-seeking, penalizes q(x) = 0 where p(x) > 0
- Reverse KL (KL(q || p)): mode-seeking, penalizes q(x) > 0 where p(x) = 0
- Connection to MLE: Minimizing KL(p_data || p_model) is equivalent to maximizing the expected log-likelihood

### Mutual Information

I(X; Y) = KL(p(x,y) || p(x)p(y)) = H(X) - H(X|Y) = H(Y) - H(Y|X)

Properties:

- I(X; Y) >= 0, with equality iff X, Y independent
- I(X; Y) = I(Y; X)
- Data processing inequality: If X -> Y -> Z is a Markov chain, then I(X; Z) <= I(X; Y)
- Used in: InfoNCE loss, mutual information neural estimation (MINE), information bottleneck

### Cross-Entropy

H(p, q) = -sum_x p(x) log q(x) = H(p) + KL(p || q)

This is the standard classification loss: p is the one-hot label, q is the model's predicted distribution.

### Fisher Information

For a parametric family p(x | theta):

F(theta) = E_p[nabla_theta log p(x|theta) nabla_theta log p(x|theta)^T]
         = -E_p[nabla^2_theta log p(x|theta)]

Properties:

- F(theta) is PSD
- Cramer-Rao bound: Var(theta_hat) >= F(theta)^{-1} for unbiased estimators
- Natural gradient: theta_{t+1} = theta_t - alpha F(theta_t)^{-1} nabla L(theta_t)
- Connection to KL: KL(p_theta || p_{theta + d_theta}) approximately (1/2) d_theta^T F(theta) d_theta

### Evidence Lower Bound (ELBO)

For latent variable models with observed x and latent z:

log p(x) = ELBO + KL(q(z|x) || p(z|x))

where ELBO = E_{q(z|x)}[log p(x|z)] - KL(q(z|x) || p(z))

Since KL >= 0, ELBO <= log p(x). Maximizing ELBO jointly optimizes:

- Reconstruction: E_q[log p(x|z)] (how well we reconstruct x from z)
- Regularization: -KL(q(z|x) || p(z)) (how close the approximate posterior is to the prior)

---

## Key Inequalities

### Jensen's Inequality

If phi is convex and X is a random variable:

phi(E[X]) <= E[phi(X)]

If phi is concave, the inequality reverses. Equality holds iff X is constant a.s. or phi is linear.

**Applications in ML:**

- Derivation of the ELBO: log E_p[f(z)] >= E_p[log f(z)]
- EM algorithm: log p(x) >= E_q[log p(x,z)/q(z)]
- Proving KL(p||q) >= 0: Apply Jensen to the concave log function

### Cauchy-Schwarz Inequality

|E[XY]|^2 <= E[X^2] E[Y^2]

Vector form: |**x**^T **y**| <= ||**x**||_2 ||**y**||_2

Equality iff X = cY for some constant c (vectors are collinear).

**Applications:** Bounding inner products, proving convergence rates, cosine similarity bounds.

### Holder's Inequality

For p, q >= 1 with 1/p + 1/q = 1:

E[|XY|] <= (E[|X|^p])^{1/p} (E[|Y|^q])^{1/q}

Cauchy-Schwarz is the special case p = q = 2.

### Minkowski's Inequality

For p >= 1:

||X + Y||_p <= ||X||_p + ||Y||_p

This is the triangle inequality for L^p norms.

### Markov's Inequality

For non-negative X and a > 0:

P(X >= a) <= E[X] / a

### Chebyshev's Inequality

P(|X - mu| >= k sigma) <= 1/k^2

### Hoeffding's Inequality

For independent bounded random variables X_i in [a_i, b_i]:

P(|S_n/n - E[S_n/n]| >= t) <= 2 exp(-2n^2 t^2 / sum_i (b_i - a_i)^2)

where S_n = sum_i X_i.

**Application:** PAC learning bounds, generalization bounds.

### McDiarmid's Inequality (Bounded Differences)

If f(x_1, ..., x_n) satisfies |f(x) - f(x')| <= c_i when x and x' differ only in coordinate i:

P(f(X) - E[f(X)] >= t) <= exp(-2t^2 / sum_i c_i^2)

**Application:** Rademacher complexity-based generalization bounds.

### Pinsker's Inequality

TV(p, q) <= sqrt((1/2) KL(p || q))

where TV is the total variation distance. Connects information-theoretic and distributional distances.

### Log-Sum Inequality

For non-negative a_i and b_i:

sum_i a_i log(a_i / b_i) >= (sum_i a_i) log(sum_i a_i / sum_i b_i)

Used to prove: convexity of KL divergence, data processing inequality.

### AM-GM Inequality

For non-negative reals:

`(a_1 + ... + a_n) / n >= (a_1 * ... * a_n)^{1/n}`

---

## Optimization

### Convexity

A function f is convex iff for all x, y and lambda in [0, 1]:

f(lambda x + (1-lambda) y) <= lambda f(x) + (1-lambda) f(y)

Equivalent characterizations (for twice-differentiable f):

- f is convex iff nabla^2 f(x) >= 0 (Hessian is PSD) for all x
- f is convex iff f(y) >= f(x) + nabla f(x)^T (y - x) for all x, y (first-order condition)

**Strong convexity.** f is mu-strongly convex if f(x) - (mu/2)||x||^2 is convex. Equivalently: nabla^2 f(x) >= mu **I** for all x.

**Smoothness.** f is L-smooth if nabla f is L-Lipschitz: ||nabla f(x) - nabla f(y)|| <= L ||x - y||. Equivalently: nabla^2 f(x) <= L **I** for all x.

### Convergence Rates

| Setting | Algorithm | Rate |
|---|---|---|
| Convex, L-smooth | GD | O(1/T) |
| mu-strongly convex, L-smooth | GD | O(exp(-T mu/L)) |
| Convex, Lipschitz | SGD | O(1/sqrt(T)) |
| mu-strongly convex, Lipschitz | SGD | O(1/(mu T)) |
| Non-convex, L-smooth | SGD | O(1/sqrt(T)) to stationary point |

### Gradient Descent Variants

**SGD with momentum:**
v_{t+1} = beta v_t + nabla L(theta_t)
theta_{t+1} = theta_t - alpha v_{t+1}

**Adam:**
m_t = beta_1 m_{t-1} + (1 - beta_1) g_t
v_t = beta_2 v_{t-1} + (1 - beta_2) g_t^2
m_hat_t = m_t / (1 - beta_1^t)
v_hat_t = v_t / (1 - beta_2^t)
theta_{t+1} = theta_t - alpha m_hat_t / (sqrt(v_hat_t) + epsilon)

Default: beta_1 = 0.9, beta_2 = 0.999, epsilon = 1e-8.

**AdamW** (decoupled weight decay):
theta_{t+1} = theta_t - alpha (m_hat_t / (sqrt(v_hat_t) + epsilon) + lambda theta_t)

### Lagrangian Duality

**Primal:** min_x f(x) s.t. g_i(x) <= 0, h_j(x) = 0

**Lagrangian:** L(x, lambda, nu) = f(x) + sum_i lambda_i g_i(x) + sum_j nu_j h_j(x)

**Dual:** max_{lambda >= 0, nu} min_x L(x, lambda, nu)

**Weak duality:** d\* <= p\* always.
**Strong duality:** d\* = p\* under Slater's condition (for convex problems).

**KKT conditions** (necessary for optimality under constraint qualification):

1. Stationarity: nabla_x L = 0
2. Primal feasibility: g_i(x*) <= 0, h_j(x*) = 0
3. Dual feasibility: lambda_i >= 0
4. Complementary slackness: lambda_i g_i(x*) = 0

---

## Useful Approximations and Asymptotics

### Taylor Expansions

f(x + delta) approximately f(x) + nabla f(x)^T delta + (1/2) delta^T nabla^2 f(x) delta + ...

**Common approximations used in ML:**

- log(1 + x) approximately x - x^2/2 + x^3/3 - ... for |x| < 1
- exp(x) approximately 1 + x + x^2/2 for small x
- (1 + x)^n approximately 1 + nx for small x
- softmax(x_i + c) = softmax(x_i) (shift invariance, exact)
- log sum exp(x_i) approximately max_i x_i for large differences (used in numerical stability)
- sigmoid(x) approximately (1 + x/4) / 2 for small x; approximately 1 for x >> 0

### Stirling's Approximation

n! approximately sqrt(2 pi n) (n/e)^n

log(n!) approximately n log n - n + (1/2) log(2 pi n)

### Gaussian Integral

integral_{-inf}^{inf} exp(-a x^2 + bx + c) dx = sqrt(pi/a) exp(b^2/(4a) + c)

### Laplace Approximation

For integral exp(-n f(x)) dx where f has a minimum at x*:

integral exp(-n f(x)) dx approximately exp(-n f(x*)) sqrt(2 pi / (n f''(x*)))

Used in: Bayesian inference to approximate posterior distributions.

### Softmax Temperature

softmax(x_i / T)_j = exp(x_j / T) / sum_k exp(x_k / T)

- T -> 0: approaches argmax (hard selection)
- T = 1: standard softmax
- T -> inf: approaches uniform distribution

### Reparameterization Trick

To backpropagate through z ~ N(mu, sigma^2):

`z = mu + sigma * epsilon`, where epsilon ~ N(0, 1)

Generalizes to any location-scale family. For other distributions, use the Gumbel-Softmax trick (discrete) or normalizing flows (complex continuous).

---

## Measure-Theoretic Probability

These concepts appear in advanced ML theory papers.

### Key Definitions

- **Sigma-algebra** F on Omega: collection of subsets closed under complement and countable union.
- **Probability measure** P: F -> [0, 1] satisfying P(Omega) = 1 and countable additivity.
- **Random variable** X: (Omega, F) -> (R, B(R)), a measurable function.
- **Expectation:** E[X] = integral_Omega X dP (Lebesgue integral).
- **Absolute continuity:** P << Q iff Q(A) = 0 implies P(A) = 0.
- **Radon-Nikodym derivative:** If P << Q, there exists dP/dQ such that P(A) = integral_A (dP/dQ) dQ.

### Convergence Modes

From strongest to weakest:

1. **Almost sure:** X_n -> X a.s. iff P(lim X_n = X) = 1
2. **L^p convergence:** E[|X_n - X|^p] -> 0
3. **In probability:** P(|X_n - X| > epsilon) -> 0 for all epsilon > 0
4. **In distribution:** F_n(x) -> F(x) at all continuity points of F

Implications: a.s. => in probability => in distribution. L^p => in probability.

### Important Theorems

**Law of Large Numbers (Strong):** If X_1, X_2, ... are i.i.d. with E[|X_1|] < inf, then S_n / n -> E[X_1] a.s.

**Central Limit Theorem:** If X_1, X_2, ... are i.i.d. with mean mu and variance sigma^2, then sqrt(n)(S_n/n - mu) -> N(0, sigma^2) in distribution.

**Dominated Convergence Theorem:** If X_n -> X a.s. and |X_n| <= Y with E[Y] < inf, then E[X_n] -> E[X] and integral is interchangeable with limit.

---

## Functional Analysis Basics

Relevant for kernel methods, neural tangent kernels, and infinite-width limits.

### Hilbert Spaces

A complete inner product space. Key example: L^2(X, mu) = {f : integral |f|^2 d mu < inf}.

**Reproducing Kernel Hilbert Space (RKHS):** A Hilbert space H of functions f: X → R such that evaluation functionals f ↦ f(x) are continuous. By the Riesz representation theorem, there exists a kernel k: X × X → R such that:

- k(x, .) in H for all x
- f(x) = ⟨f, k(x, .)⟩_H (reproducing property)
- k is symmetric and positive semi-definite

**Representer Theorem:** For regularized empirical risk minimization in an RKHS:

min_{f in H} sum_i L(y_i, f(x_i)) + lambda ||f||_H^2

The solution has the form f*(x) = sum_i alpha_i k(x_i, x).

### Universal Approximation

**Cybenko (1989), Hornik (1991):** A single hidden layer neural network with non-polynomial activation can approximate any continuous function on a compact set to arbitrary precision (in the supremum norm).

**Modern variants:** Depth-width tradeoffs; O(d) neurons suffice for Lipschitz functions in d dimensions with ReLU networks, but may require exponential width without sufficient depth.

### Neural Tangent Kernel

In the infinite-width limit, a neural network trained with gradient descent is equivalent to kernel regression with the NTK:

K_NTK(x, x') = E_{theta ~ init}[⟨∇_theta f(x; theta), ∇_theta f(x'; theta)⟩]

The NTK is constant during training in the infinite-width limit (lazy training regime).
