# Lecture 00a: Linear Algebra for Deep Learning

> **Module 00 — Mathematical Foundations (Pre-Work)**
> Estimated study time: 6–8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define a vector space over ℝ and verify the axioms for common spaces (ℝⁿ, function spaces, matrix spaces).
2. State and prove the rank-nullity theorem for linear maps.
3. Compute the eigendecomposition of a symmetric matrix and prove the spectral theorem.
4. Derive the singular value decomposition (SVD) from the eigendecomposition of $A^{\top}A$.
5. Apply the denominator-layout convention for matrix calculus and derive key matrix derivatives used in deep learning.
6. Implement power iteration, SVD, and matrix calculus operations in PyTorch with correct shape tracking.

---

## 1. Motivation: Why Linear Algebra Is the Language of Deep Learning

Every neural network, at its core, is a composition of affine maps and pointwise nonlinearities. A single fully connected layer computes

$$\mathbf{h}^{(l)} = \sigma\!\bigl(W^{(l)}\,\mathbf{h}^{(l-1)} + \mathbf{b}^{(l)}\bigr)$$

where $W^{(l)} \in \mathbb{R}^{m \times n}$ is a weight matrix, $\mathbf{b}^{(l)} \in \mathbb{R}^m$ is a bias vector, and $\sigma$ is a nonlinear activation applied element-wise. Understanding what a matrix "does" — stretches, rotates, projects — directly reveals what a network layer does to data.

Beyond individual layers:

- **Backpropagation** is repeated application of the chain rule to Jacobians (matrices of partial derivatives).
- **Batch normalization** decorrelates activations — an operation understood through eigenvalues of covariance matrices.
- **Weight initialization** (Xavier, Kaiming) is designed to preserve norms of activations across layers, a linear-algebraic condition.
- **Low-rank adaptation** (LoRA) factorizes weight updates as $\Delta W = BA$ where $B \in \mathbb{R}^{m \times r}$, $A \in \mathbb{R}^{r \times n}$, $r \ll \min(m,n)$ — directly exploiting the SVD principle that weight matrices are approximately low-rank.
- **Attention** in Transformers computes $\text{softmax}(QK^\top / \sqrt{d_k})\,V$, a sequence of matrix multiplications that can be analyzed via rank and spectral properties.

Fluency in linear algebra is non-negotiable for understanding, debugging, and advancing deep learning.

---

## 2. Core Theory

### 2.1 Vector Spaces

**Definition.** A *vector space* over ℝ is a set $V$ equipped with two operations — vector addition $+ : V \times V \to V$ and scalar multiplication $\cdot : \mathbb{R} \times V \to V$ — satisfying eight axioms: closure under addition and scalar multiplication, commutativity and associativity of addition, existence of additive identity and inverses, compatibility and identity of scalar multiplication, and distributivity.

**Examples relevant to deep learning:**

- $\mathbb{R}^n$: the space of $n$-dimensional column vectors.
- $\mathbb{R}^{m \times n}$: the space of $m \times n$ real matrices (equivalently, $\mathbb{R}^{mn}$).
- The space of functions $f : \mathbb{R}^d \to \mathbb{R}$ (infinite-dimensional — relevant to kernel methods and neural tangent kernels).

**Definition.** A subset $S \subseteq V$ is a *subspace* if it is closed under addition and scalar multiplication. The *span* of vectors $\{\mathbf{v}_1, \dots, \mathbf{v}_k\}$ is the smallest subspace containing them:

$$\text{span}(\mathbf{v}_1, \dots, \mathbf{v}_k) = \left\{ \sum_{i=1}^k \alpha_i \mathbf{v}_i : \alpha_i \in \mathbb{R} \right\}$$

**Definition.** Vectors $\{\mathbf{v}_1, \dots, \mathbf{v}_k\}$ are *linearly independent* if $\sum_i \alpha_i \mathbf{v}_i = \mathbf{0}$ implies all $\alpha_i = 0$. A *basis* for $V$ is a linearly independent spanning set. The *dimension* of $V$ is the cardinality of any basis.

### 2.2 Linear Maps

**Definition.** A function $T : V \to W$ between vector spaces is *linear* if for all $\mathbf{u}, \mathbf{v} \in V$ and $\alpha \in \mathbb{R}$:

$$T(\mathbf{u} + \mathbf{v}) = T(\mathbf{u}) + T(\mathbf{v}), \quad T(\alpha \mathbf{v}) = \alpha\,T(\mathbf{v})$$

Every linear map $T : \mathbb{R}^n \to \mathbb{R}^m$ can be represented by a matrix $A \in \mathbb{R}^{m \times n}$ such that $T(\mathbf{x}) = A\mathbf{x}$.

**Definition.** The *kernel* (null space) and *image* (column space, range) of $T$ are:

$$\ker(T) = \{\mathbf{x} \in V : T(\mathbf{x}) = \mathbf{0}\}, \quad \text{im}(T) = \{T(\mathbf{x}) : \mathbf{x} \in V\}$$

**Theorem (Rank-Nullity).** For a linear map $T : V \to W$ with $\dim(V) = n$:

$$\dim(\ker(T)) + \dim(\text{im}(T)) = n$$

Equivalently, for $A \in \mathbb{R}^{m \times n}$: $\text{nullity}(A) + \text{rank}(A) = n$.

*Proof.* Let $\{\mathbf{u}_1, \dots, \mathbf{u}_k\}$ be a basis for $\ker(T)$. Extend it to a basis $\{\mathbf{u}_1, \dots, \mathbf{u}_k, \mathbf{v}_1, \dots, \mathbf{v}_r\}$ for $V$, where $k + r = n$. We claim $\{T(\mathbf{v}_1), \dots, T(\mathbf{v}_r)\}$ is a basis for $\text{im}(T)$.

*Spanning:* Any $T(\mathbf{x})$ with $\mathbf{x} = \sum_i \alpha_i \mathbf{u}_i + \sum_j \beta_j \mathbf{v}_j$ equals $\sum_j \beta_j T(\mathbf{v}_j)$ since $T(\mathbf{u}_i) = \mathbf{0}$.

*Independence:* If $\sum_j \beta_j T(\mathbf{v}_j) = \mathbf{0}$, then $T(\sum_j \beta_j \mathbf{v}_j) = \mathbf{0}$, so $\sum_j \beta_j \mathbf{v}_j \in \ker(T)$, hence $\sum_j \beta_j \mathbf{v}_j = \sum_i \gamma_i \mathbf{u}_i$. By independence of the full basis, all $\beta_j = 0$.

Therefore $\dim(\text{im}(T)) = r$ and $\dim(\ker(T)) + \dim(\text{im}(T)) = k + r = n$. $\square$

### 2.3 Inner Products, Norms, and Orthogonality

**Definition.** An *inner product* on $\mathbb{R}^n$ is the standard dot product $\langle \mathbf{x}, \mathbf{y} \rangle = \mathbf{x}^\top \mathbf{y} = \sum_i x_i y_i$. The induced norm is $\|\mathbf{x}\|_2 = \sqrt{\langle \mathbf{x}, \mathbf{x} \rangle}$.

**Key norms in deep learning:**

| Norm | Definition | Use |
|------|-----------|-----|
| $\Vert\mathbf{x}\Vert_1 = \sum_i \vert x_i\vert$ | ℓ₁ norm | Sparsity-inducing regularization (L1) |
| $\Vert\mathbf{x}\Vert_2 = \sqrt{\sum_i x_i^2}$ | ℓ₂ norm | Weight decay, gradient clipping |
| $\Vert X\Vert_F = \sqrt{\sum_{i,j} X_{ij}^2}$ | Frobenius norm | Matrix regularization |
| $\Vert X\Vert_2 = \sigma_1(X)$ | Spectral norm | Spectral normalization in GANs |

**Cauchy-Schwarz inequality:** $|\langle \mathbf{x}, \mathbf{y} \rangle| \le \|\mathbf{x}\|_2 \|\mathbf{y}\|_2$, with equality iff $\mathbf{x}$ and $\mathbf{y}$ are linearly dependent.

**Orthogonality.** Vectors $\mathbf{x}, \mathbf{y}$ are orthogonal if $\langle \mathbf{x}, \mathbf{y} \rangle = 0$. A matrix $Q \in \mathbb{R}^{n \times n}$ is *orthogonal* if $Q^\top Q = Q Q^\top = I$, i.e., its columns form an orthonormal basis. Orthogonal matrices preserve norms: $\|Q\mathbf{x}\|_2 = \|\mathbf{x}\|_2$.

**Gram-Schmidt.** Given linearly independent $\{\mathbf{v}_1, \dots, \mathbf{v}_k\}$, the Gram-Schmidt process produces an orthonormal set $\{\mathbf{q}_1, \dots, \mathbf{q}_k\}$ via:

$$\mathbf{u}_i = \mathbf{v}_i - \sum_{j=1}^{i-1} \frac{\langle \mathbf{v}_i, \mathbf{q}_j \rangle}{\langle \mathbf{q}_j, \mathbf{q}_j \rangle}\,\mathbf{q}_j, \quad \mathbf{q}_i = \frac{\mathbf{u}_i}{\|\mathbf{u}_i\|_2}$$

This underlies the QR decomposition $A = QR$, which is more numerically stable than direct eigenvalue computation for certain problems.

### 2.4 Eigendecomposition

**Definition.** A scalar $\lambda \in \mathbb{C}$ is an *eigenvalue* of $A \in \mathbb{R}^{n \times n}$ if there exists a nonzero $\mathbf{v} \in \mathbb{C}^n$ such that $A\mathbf{v} = \lambda\mathbf{v}$. The vector $\mathbf{v}$ is a corresponding *eigenvector*.

Eigenvalues are roots of the *characteristic polynomial* $\det(A - \lambda I) = 0$.

**Theorem (Spectral Theorem).** Let $A \in \mathbb{R}^{n \times n}$ be *symmetric* ($A = A^\top$). Then:

1. All eigenvalues of $A$ are real.
2. Eigenvectors corresponding to distinct eigenvalues are orthogonal.
3. $A$ admits the decomposition $A = Q \Lambda Q^\top$ where $Q$ is orthogonal and $\Lambda = \text{diag}(\lambda_1, \dots, \lambda_n)$.

*Proof of (1).* Let $A\mathbf{v} = \lambda\mathbf{v}$ with $\mathbf{v} \ne \mathbf{0}$. Then:

$$\bar{\lambda}\,\bar{\mathbf{v}}^\top \mathbf{v} = (A\mathbf{v})^* \mathbf{v} = \mathbf{v}^* A^\top \mathbf{v} = \mathbf{v}^* A \mathbf{v} = \lambda\,\mathbf{v}^* \mathbf{v}$$

Since $\mathbf{v}^* \mathbf{v} = \|\mathbf{v}\|^2 > 0$, we get $\bar{\lambda} = \lambda$, so $\lambda \in \mathbb{R}$. $\square$

*Proof of (2).* Let $A\mathbf{v}_1 = \lambda_1 \mathbf{v}_1$ and $A\mathbf{v}_2 = \lambda_2 \mathbf{v}_2$ with $\lambda_1 \ne \lambda_2$. Then:

$$\lambda_1 \langle \mathbf{v}_1, \mathbf{v}_2 \rangle = \langle A\mathbf{v}_1, \mathbf{v}_2 \rangle = \langle \mathbf{v}_1, A^\top \mathbf{v}_2 \rangle = \langle \mathbf{v}_1, A\mathbf{v}_2 \rangle = \lambda_2 \langle \mathbf{v}_1, \mathbf{v}_2 \rangle$$

So $(\lambda_1 - \lambda_2) \langle \mathbf{v}_1, \mathbf{v}_2 \rangle = 0$. Since $\lambda_1 \ne \lambda_2$, we must have $\langle \mathbf{v}_1, \mathbf{v}_2 \rangle = 0$. $\square$

**Deep learning relevance.** The covariance matrix $\Sigma = \frac{1}{N}\sum_{i=1}^N \mathbf{x}_i \mathbf{x}_i^\top$ is symmetric positive semidefinite. Its eigendecomposition reveals the principal directions of variation in data — the foundation of PCA and whitening transforms used in data preprocessing.

### 2.5 Singular Value Decomposition (SVD)

The SVD generalizes eigendecomposition to *any* matrix, including rectangular ones. This is critical because weight matrices $W \in \mathbb{R}^{m \times n}$ in neural networks are typically not square.

**Theorem (SVD).** Any matrix $A \in \mathbb{R}^{m \times n}$ can be decomposed as

$$A = U \Sigma V^\top$$

where:

- $U \in \mathbb{R}^{m \times m}$ is orthogonal (columns are *left singular vectors*)
- $V \in \mathbb{R}^{n \times n}$ is orthogonal (columns are *right singular vectors*)
- $\Sigma \in \mathbb{R}^{m \times n}$ is diagonal with non-negative entries $\sigma_1 \ge \sigma_2 \ge \cdots \ge \sigma_{\min(m,n)} \ge 0$ (the *singular values*)

**Full Derivation from Eigendecomposition of $A^\top A$.**

*Step 1.* Consider the matrix $A^\top A \in \mathbb{R}^{n \times n}$. It is symmetric: $(A^\top A)^\top = A^\top (A^\top)^\top = A^\top A$. It is positive semidefinite: for any $\mathbf{x} \in \mathbb{R}^n$, $\mathbf{x}^\top (A^\top A) \mathbf{x} = \|A\mathbf{x}\|_2^2 \ge 0$.

*Step 2.* By the Spectral Theorem, $A^\top A$ has an orthogonal eigendecomposition:

$$A^\top A = V \hat{\Lambda} V^\top$$

where $\hat{\Lambda} = \text{diag}(\hat{\lambda}_1, \dots, \hat{\lambda}_n)$ with $\hat{\lambda}_i \ge 0$ (positive semidefiniteness). Define $\sigma_i = \sqrt{\hat{\lambda}_i}$, so $\hat{\lambda}_i = \sigma_i^2$. Order them so that $\sigma_1 \ge \sigma_2 \ge \cdots \ge \sigma_r > 0 = \sigma_{r+1} = \cdots = \sigma_n$, where $r = \text{rank}(A)$.

*Step 3.* Define the first $r$ left singular vectors as:

$$\mathbf{u}_i = \frac{1}{\sigma_i} A \mathbf{v}_i, \quad i = 1, \dots, r$$

Verify orthonormality:

$$\langle \mathbf{u}_i, \mathbf{u}_j \rangle = \frac{1}{\sigma_i \sigma_j} \mathbf{v}_i^\top A^\top A \mathbf{v}_j = \frac{1}{\sigma_i \sigma_j} \mathbf{v}_i^\top (\sigma_j^2 \mathbf{v}_j) = \frac{\sigma_j}{\sigma_i} \delta_{ij} = \delta_{ij}$$

*Step 4.* Extend $\{\mathbf{u}_1, \dots, \mathbf{u}_r\}$ to an orthonormal basis $\{\mathbf{u}_1, \dots, \mathbf{u}_m\}$ of $\mathbb{R}^m$ (e.g., via Gram-Schmidt on the orthogonal complement). Set $U = [\mathbf{u}_1 \cdots \mathbf{u}_m]$.

*Step 5.* Construct $\Sigma \in \mathbb{R}^{m \times n}$ with $\Sigma_{ii} = \sigma_i$ for $i = 1, \dots, \min(m,n)$ and all other entries zero. Then:

$$U \Sigma V^\top = \sum_{i=1}^{r} \sigma_i \mathbf{u}_i \mathbf{v}_i^\top = \sum_{i=1}^{r} \sigma_i \cdot \frac{A\mathbf{v}_i}{\sigma_i} \cdot \mathbf{v}_i^\top = \sum_{i=1}^r A \mathbf{v}_i \mathbf{v}_i^\top = A \sum_{i=1}^r \mathbf{v}_i \mathbf{v}_i^\top$$

Since $\{\mathbf{v}_1, \dots, \mathbf{v}_n\}$ is an orthonormal basis and $A\mathbf{v}_i = \mathbf{0}$ for $i > r$ (because $\sigma_i = 0$), we have:

$$A \sum_{i=1}^r \mathbf{v}_i \mathbf{v}_i^\top = A \sum_{i=1}^n \mathbf{v}_i \mathbf{v}_i^\top = A V V^\top = A I = A$$

Therefore $A = U \Sigma V^\top$. $\square$

**Compact (thin) SVD.** In practice, if $m > n$, we only need the first $n$ columns of $U$ and the $n \times n$ upper portion of $\Sigma$:

$$A = U_n \Sigma_n V^\top, \quad U_n \in \mathbb{R}^{m \times n},\; \Sigma_n \in \mathbb{R}^{n \times n}$$

**Eckart-Young-Mirsky Theorem.** The best rank-$k$ approximation to $A$ (in Frobenius or spectral norm) is:

$$A_k = \sum_{i=1}^{k} \sigma_i \mathbf{u}_i \mathbf{v}_i^\top = U_k \Sigma_k V_k^\top$$

with $\|A - A_k\|_F^2 = \sum_{i=k+1}^r \sigma_i^2$. This is the theoretical foundation for low-rank weight compression.

### 2.6 Matrix Calculus (Denominator Layout)

Matrix calculus is essential for deriving gradient updates. We adopt the **denominator layout** convention: if $f : \mathbb{R}^{m \times n} \to \mathbb{R}$, then $\partial f / \partial X$ has the same shape as $X$ (i.e., $m \times n$), with $(\partial f / \partial X)_{ij} = \partial f / \partial X_{ij}$.

This convention is consistent with PyTorch's `.grad` attribute, which always has the same shape as the parameter tensor.

**Key identities and their derivations.**

**Identity 1.** $\dfrac{\partial}{\partial X}\,\text{tr}(AX) = A^\top$

*Proof.* We have $\text{tr}(AX) = \sum_{i,j} A_{ij} X_{ji}$ (by expanding the matrix product and then the trace). Therefore:

$$\frac{\partial\,\text{tr}(AX)}{\partial X_{kl}} = \frac{\partial}{\partial X_{kl}} \sum_{i,j} A_{ij} X_{ji} = A_{lk}$$

So $\partial\,\text{tr}(AX) / \partial X = A^\top$. $\square$

**Identity 2.** $\dfrac{\partial}{\partial X}\,\text{tr}(X^\top A X) = (A + A^\top) X$

*Proof.* Write $f(X) = \text{tr}(X^\top A X)$. Consider a perturbation $X \to X + \epsilon H$:

$$f(X + \epsilon H) = \text{tr}\bigl((X + \epsilon H)^\top A (X + \epsilon H)\bigr)$$
$$= \text{tr}(X^\top A X) + \epsilon\,\text{tr}(H^\top A X) + \epsilon\,\text{tr}(X^\top A H) + \epsilon^2\,\text{tr}(H^\top A H)$$

The directional derivative is:

$$\lim_{\epsilon \to 0} \frac{f(X+\epsilon H) - f(X)}{\epsilon} = \text{tr}(H^\top A X) + \text{tr}(X^\top A H)$$

Using $\text{tr}(X^\top A H) = \text{tr}(H^\top A^\top X)$ (since $\text{tr}(B) = \text{tr}(B^\top)$):

$$= \text{tr}\bigl(H^\top (A + A^\top) X\bigr)$$

Since this must equal $\text{tr}(H^\top \nabla_X f)$ for all $H$, we conclude $\nabla_X f = (A + A^\top) X$. $\square$

**Identity 3.** $\dfrac{\partial}{\partial \mathbf{x}}\,\mathbf{x}^\top A \mathbf{x} = (A + A^\top)\mathbf{x}$

This is the vector specialization of Identity 2. When $A$ is symmetric, it simplifies to $2A\mathbf{x}$.

**Identity 4.** $\dfrac{\partial}{\partial X}\,\text{tr}(AXB) = A^\top B^\top$ (note: not $(AB)^\top$, but rather the individual transposes rearranged — this follows from $\text{tr}(AXB) = \text{tr}(BAX)$ by cyclic permutation, then applying Identity 1 with the matrix $BA$)

*Proof.* $\text{tr}(AXB) = \text{tr}((BA)X)$ by the cyclic property of trace. Applying Identity 1 with $A$ replaced by $BA$: $\partial\,\text{tr}((BA)X)/\partial X = (BA)^\top = A^\top B^\top$. $\square$

**Identity 5.** $\dfrac{\partial}{\partial X}\,\log\det(X) = X^{-\top}$

This identity is crucial for Gaussian log-likelihoods involving covariance matrices. We state it without full proof here; it follows from Jacobi's formula.

**Identity 6.** $\dfrac{\partial}{\partial \mathbf{x}}\,\|\mathbf{x}\|_2^2 = 2\mathbf{x}$, and $\dfrac{\partial}{\partial \mathbf{x}}\,\|A\mathbf{x} - \mathbf{b}\|_2^2 = 2A^\top(A\mathbf{x} - \mathbf{b})$

This is the gradient of the least-squares objective and underlies linear regression.

### 2.7 The Chain Rule for Matrix Expressions

For scalar-valued functions of matrices, the chain rule uses the Frobenius inner product. If $f = g(Y)$ and $Y = h(X)$, then:

$$\frac{\partial f}{\partial X_{ij}} = \sum_{k,l} \frac{\partial f}{\partial Y_{kl}} \frac{\partial Y_{kl}}{\partial X_{ij}}$$

In vectorized form (flattening matrices into vectors), the Jacobian $J_h$ of the map $X \mapsto Y$ is multiplied by the gradient of $g$:

$$\text{vec}\left(\frac{\partial f}{\partial X}\right) = J_h^\top \,\text{vec}\left(\frac{\partial f}{\partial Y}\right)$$

**Example: gradient through a linear layer.** Let $L(\mathbf{h}) = \ell(W\mathbf{h} + \mathbf{b})$ where $\ell : \mathbb{R}^m \to \mathbb{R}$. Let $\mathbf{z} = W\mathbf{h} + \mathbf{b}$ and $\boldsymbol{\delta} = \partial \ell / \partial \mathbf{z} \in \mathbb{R}^m$ (the "upstream gradient"). Then:

$$\frac{\partial L}{\partial W} = \boldsymbol{\delta}\,\mathbf{h}^\top \in \mathbb{R}^{m \times n}, \quad \frac{\partial L}{\partial \mathbf{h}} = W^\top \boldsymbol{\delta} \in \mathbb{R}^n, \quad \frac{\partial L}{\partial \mathbf{b}} = \boldsymbol{\delta} \in \mathbb{R}^m$$

These formulas are the backbone of backpropagation through fully connected layers.

---

## 3. Algorithmic Derivation: Power Iteration

Power iteration is the simplest algorithm for computing the dominant eigenvalue/eigenvector pair of a matrix. It is used in practice for spectral normalization of neural network weights.

### 3.1 Algorithm

**Input:** Matrix $A \in \mathbb{R}^{n \times n}$, initial vector $\mathbf{v}_0 \in \mathbb{R}^n$ (random, nonzero), tolerance $\epsilon > 0$.

**Output:** Dominant eigenvalue $\lambda_1$ and eigenvector $\mathbf{v}_1$.

```
POWER-ITERATION(A, v₀, ε):
  v ← v₀ / ‖v₀‖₂
  λ_prev ← 0
  repeat:
    w ← A v                    # O(n²) matrix-vector multiply
    λ ← vᵀ w                   # Rayleigh quotient, O(n)
    v ← w / ‖w‖₂              # Normalize, O(n)
    if |λ - λ_prev| < ε:
      return λ, v
    λ_prev ← λ
```

### 3.2 Convergence Analysis

Let $A$ have eigenvalues $|\lambda_1| > |\lambda_2| \ge \cdots \ge |\lambda_n|$ with corresponding orthonormal eigenvectors. Expand $\mathbf{v}_0 = \sum_i c_i \mathbf{q}_i$ (assuming $c_1 \ne 0$). After $k$ iterations:

$$A^k \mathbf{v}_0 = \sum_i c_i \lambda_i^k \mathbf{q}_i = \lambda_1^k \left( c_1 \mathbf{q}_1 + \sum_{i \ge 2} c_i \left(\frac{\lambda_i}{\lambda_1}\right)^k \mathbf{q}_i \right)$$

Since $|\lambda_i / \lambda_1| < 1$ for $i \ge 2$, the terms with $i \ge 2$ vanish as $k \to \infty$. The convergence rate is $\mathcal{O}(|\lambda_2/\lambda_1|^k)$ — linear convergence with ratio $|\lambda_2/\lambda_1|$.

**Complexity per iteration:** $\mathcal{O}(n^2)$ for the matrix-vector product (or $\mathcal{O}(\text{nnz}(A))$ for sparse $A$). Total: $\mathcal{O}(n^2 \cdot k)$ where $k$ depends on the eigenvalue gap.

### 3.3 Computing SVD via Power Iteration

To find the largest singular value $\sigma_1$ of $A \in \mathbb{R}^{m \times n}$:

1. Run power iteration on $A^\top A$ to get $\mathbf{v}_1$ (right singular vector) and $\sigma_1^2$ (eigenvalue).
2. Compute $\mathbf{u}_1 = A\mathbf{v}_1 / \sigma_1$.
3. For subsequent singular values, deflate: $A \leftarrow A - \sigma_1 \mathbf{u}_1 \mathbf{v}_1^\top$ and repeat.

---

## 4. PyTorch Implementation

### 4.1 Basic Operations with Shape Annotations

```python
import torch

# --- Vector operations ---
x = torch.randn(5)          # x: (5,) — a vector in R^5
y = torch.randn(5)          # y: (5,)

dot_product = x @ y          # scalar — inner product <x, y>
outer_product = x.unsqueeze(1) @ y.unsqueeze(0)  # (5, 1) @ (1, 5) -> (5, 5)
# Equivalently:
outer_product = torch.outer(x, y)  # (5, 5)

l2_norm = torch.norm(x, p=2)   # scalar — ‖x‖₂
l1_norm = torch.norm(x, p=1)   # scalar — ‖x‖₁

# --- Matrix operations ---
A = torch.randn(3, 5)       # A: (3, 5) — a matrix in R^{3×5}
b = torch.randn(3)          # b: (3,)

# Linear map: y = Ax
y = A @ x                   # (3, 5) @ (5,) -> (3,)

# Transpose
A_T = A.T                   # (5, 3) — Aᵀ

# Frobenius norm
frob = torch.norm(A, p='fro')  # scalar — ‖A‖_F

# Trace (square matrices only)
M = torch.randn(4, 4)
trace = torch.trace(M)      # scalar — tr(M)
```

### 4.2 Eigendecomposition and SVD

```python
# --- Symmetric eigendecomposition ---
# Create a symmetric PSD matrix (e.g., a covariance matrix)
X = torch.randn(100, 5)              # X: (100, 5) — 100 data points in R^5
Sigma = (X.T @ X) / X.shape[0]       # Sigma: (5, 5) — sample covariance

eigenvalues, eigenvectors = torch.linalg.eigh(Sigma)
# eigenvalues: (5,) — sorted ascending
# eigenvectors: (5, 5) — columns are eigenvectors

# Verify: Sigma @ v_i = lambda_i * v_i
i = 0
lhs = Sigma @ eigenvectors[:, i]               # (5,)
rhs = eigenvalues[i] * eigenvectors[:, i]       # (5,)
print(f"Reconstruction error: {torch.norm(lhs - rhs):.2e}")

# --- Full SVD ---
A = torch.randn(6, 4)                # A: (6, 4)
U, S, Vh = torch.linalg.svd(A, full_matrices=True)
# U: (6, 6)  — left singular vectors
# S: (4,)    — singular values (only min(m,n) values)
# Vh: (4, 4) — V^T (right singular vectors, transposed)

# Verify reconstruction: A = U @ diag(S) @ Vh (using compact form)
U_compact = U[:, :4]                  # (6, 4)
A_reconstructed = U_compact @ torch.diag(S) @ Vh  # (6, 4) @ (4, 4) @ (4, 4)
print(f"SVD reconstruction error: {torch.norm(A - A_reconstructed):.2e}")

# --- Low-rank approximation ---
k = 2  # keep top-k singular values
A_k = U[:, :k] @ torch.diag(S[:k]) @ Vh[:k, :]  # (6, k) @ (k, k) @ (k, 4) -> (6, 4)
print(f"Rank-{k} approximation error: {torch.norm(A - A_k):.4f}")
print(f"Sum of discarded singular values^2: {(S[k:]**2).sum():.4f}")
```

### 4.3 Power Iteration in PyTorch

```python
def power_iteration(A: torch.Tensor, num_iters: int = 100) -> tuple:
    """
    Compute the dominant eigenvalue and eigenvector of a symmetric matrix.

    Args:
        A: (n, n) symmetric matrix
        num_iters: number of iterations

    Returns:
        eigenvalue: scalar
        eigenvector: (n,) unit vector
    """
    n = A.shape[0]
    v = torch.randn(n)                   # v: (n,) — random initial vector
    v = v / torch.norm(v)                 # normalize

    for _ in range(num_iters):
        w = A @ v                         # w: (n,) — matrix-vector product
        eigenvalue = v @ w                # scalar — Rayleigh quotient
        v = w / torch.norm(w)             # v: (n,) — normalized

    return eigenvalue, v

# Test
M = torch.randn(5, 5)
M = M + M.T  # make symmetric, (5, 5)
lam, v = power_iteration(M, num_iters=200)

# Compare with torch.linalg.eigh
eigenvalues, _ = torch.linalg.eigh(M)
print(f"Power iteration: {lam:.6f}")
print(f"Largest eigenvalue (absolute): {eigenvalues.abs().max():.6f}")
```

### 4.4 Matrix Calculus Verification with Autograd

```python
# Verify Identity 1: d/dX tr(AX) = A^T
A = torch.randn(3, 4)
X = torch.randn(4, 3, requires_grad=True)  # X: (4, 3)

f = torch.trace(A @ X)   # scalar — tr(AX), note A: (3,4), X: (4,3), AX: (3,3)
f.backward()

analytical_grad = A.T     # (4, 3) — should match X.grad
print(f"Identity 1 error: {torch.norm(X.grad - analytical_grad):.2e}")

# Verify Identity 2: d/dX tr(X^T A X) = (A + A^T) X
A = torch.randn(4, 4)
X = torch.randn(4, 4, requires_grad=True)

f = torch.trace(X.T @ A @ X)  # scalar
f.backward()

analytical_grad = (A + A.T) @ X.detach()  # (4, 4)
print(f"Identity 2 error: {torch.norm(X.grad - analytical_grad):.2e}")

# Verify gradient through a linear layer
W = torch.randn(3, 5, requires_grad=True)  # W: (3, 5)
h = torch.randn(5)                          # h: (5,)
b = torch.randn(3, requires_grad=True)      # b: (3,)

z = W @ h + b          # z: (3,) — pre-activation
loss = z.sum()          # scalar (simplified loss)
loss.backward()

# W.grad should be delta @ h^T where delta = d(loss)/dz = ones(3)
delta = torch.ones(3)                        # (3,)
analytical_W_grad = delta.unsqueeze(1) @ h.unsqueeze(0)  # (3,1)@(1,5) -> (3,5)
print(f"Linear layer W grad error: {torch.norm(W.grad - analytical_W_grad):.2e}")
print(f"Linear layer b grad error: {torch.norm(b.grad - delta):.2e}")
```

---

## 5. Connections to Deep Learning

### 5.1 SVD and PCA

Principal Component Analysis (PCA) seeks the $k$-dimensional subspace that maximizes variance of the projected data. Given centered data $X \in \mathbb{R}^{N \times D}$ (rows are samples):

$$\text{Covariance} = \frac{1}{N} X^\top X$$

The top-$k$ principal components are the $k$ eigenvectors of $X^\top X$ with largest eigenvalues — equivalently, the top-$k$ right singular vectors of $X$. The projection is $X V_k$ where $V_k \in \mathbb{R}^{D \times k}$.

This is used in deep learning for:

- **Data whitening**: transforming inputs to have identity covariance.
- **Analyzing learned representations**: PCA of hidden activations reveals what a network has learned.
- **Dimensionality reduction** before training on high-dimensional inputs.

### 5.2 Low-Rank Approximation and Weight Compression

A weight matrix $W \in \mathbb{R}^{m \times n}$ can be approximated as $W \approx U_k \Sigma_k V_k^\top$. Storing $U_k \in \mathbb{R}^{m \times k}$, $\Sigma_k \in \mathbb{R}^{k \times k}$, $V_k \in \mathbb{R}^{n \times k}$ uses $k(m + n + k)$ parameters instead of $mn$ — a large saving when $k \ll \min(m, n)$.

**LoRA** (Low-Rank Adaptation) uses this principle: instead of fine-tuning the full weight matrix $W$, it learns a low-rank update $\Delta W = BA$ where $B \in \mathbb{R}^{m \times r}$, $A \in \mathbb{R}^{r \times n}$, and $r$ is small (e.g., 4 or 8).

### 5.3 Weight Initialization

**Xavier/Glorot initialization** sets $W_{ij} \sim \mathcal{N}(0, 2/(n_{\text{in}} + n_{\text{out}}))$. The variance is chosen so that the variance of activations is preserved across layers — a condition derived from the singular value analysis of random matrices.

**Orthogonal initialization** sets $W$ to a random orthogonal matrix (from the QR decomposition of a random Gaussian matrix). Since orthogonal matrices have all singular values equal to 1, they perfectly preserve norms: $\|W\mathbf{x}\|_2 = \|\mathbf{x}\|_2$. This prevents vanishing/exploding gradients in deep networks.

### 5.4 Spectral Normalization

In GANs, spectral normalization divides each weight matrix by its largest singular value:

$$\bar{W} = W / \sigma_1(W)$$

This constrains the Lipschitz constant of the discriminator to 1, stabilizing training. The largest singular value is computed efficiently via a single step of power iteration per training step.

---

## 6. Paper Reading List

### Textbook Chapters

1. **Strang, G.** *Introduction to Linear Algebra*, 6th ed. Chapters 1-8. (Comprehensive reference.)
2. **Strang, G.** *Linear Algebra and Learning from Data* (2019). Chapters I-III. (Directly connects linear algebra to data science and deep learning.)
3. **Goodfellow, Bengio, Courville.** *Deep Learning*, Chapter 2: Linear Algebra. (Concise review tailored for DL.)

### Survey and Research Papers

4. **Petersen, K. B., & Pedersen, M. S.** *The Matrix Cookbook* (2012). Technical report. (Essential reference for matrix calculus identities — keep this bookmarked.)
5. **Halko, N., Martinsson, P. G., & Tropp, J. A.** "Finding structure with randomness: Probabilistic algorithms for constructing approximate matrix decompositions." *SIAM Review* 53.2 (2011): 217-288. (Randomized SVD — used in practice for large matrices.)
6. **Miyato, T., Kataoka, T., Koyama, M., & Yoshida, Y.** "Spectral Normalization for Generative Adversarial Networks." *ICLR* (2018). (Power iteration for spectral norm — application of this lecture's material.)
7. **Hu, E. J., et al.** "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR* (2022). (Low-rank structure of weight updates during fine-tuning.)

---

## 7. Exercises

### Theory Problems

**Problem 1** (10 pts). Let $A \in \mathbb{R}^{m \times n}$ with $m > n$. Prove that $\text{rank}(A^\top A) = \text{rank}(A)$.

*Hint:* Show that $\ker(A^\top A) = \ker(A)$.

**Problem 2** (15 pts). Let $A \in \mathbb{R}^{n \times n}$ be symmetric positive definite. Prove:

- (a) All eigenvalues are strictly positive.
- (b) $\det(A) > 0$.
- (c) The Cholesky decomposition $A = LL^\top$ exists, where $L$ is lower triangular with positive diagonal entries.

**Problem 3** (15 pts). *Matrix calculus.* Derive $\partial f / \partial X$ for each of the following, where $A, B$ are constant matrices of appropriate size:

- (a) $f(X) = \text{tr}(AX^\top B)$
- (b) $f(X) = \text{tr}\bigl((AX + B)^\top (AX + B)\bigr)$
- (c) $f(\mathbf{x}) = \mathbf{x}^\top A^\top A \mathbf{x} - 2\mathbf{b}^\top A\mathbf{x}$ (the squared residual in least squares, expanded)

Verify your answers numerically using PyTorch autograd.

**Problem 4** (10 pts). *SVD and norms.* Prove:

- (a) $\|A\|_F = \sqrt{\sum_i \sigma_i^2}$ (Frobenius norm equals root sum of squared singular values).
- (b) $\|A\|_2 = \sigma_1$ (spectral norm equals largest singular value).

**Problem 5** (10 pts). *Orthogonal Procrustes problem.* Given $A, B \in \mathbb{R}^{n \times d}$, find the orthogonal matrix $Q \in \mathbb{R}^{d \times d}$ that minimizes $\|A - BQ\|_F$. Show that $Q = V U^\top$ where $B^\top A = U \Sigma V^\top$ is the SVD.

*Hint:* Expand the squared Frobenius norm and use the cyclic property of trace. Then argue that the trace is maximized when the product is a PSD matrix.

### Implementation Problems

**Problem 6** (15 pts). *SVD from scratch.*
Implement the full SVD of an $m \times n$ matrix using only power iteration (no calls to `torch.linalg.svd` or `torch.linalg.eigh`). Your implementation should:

- Use deflation to extract successive singular values.
- Return $U$, $\Sigma$, $V^\top$ in the same format as `torch.linalg.svd`.
- Achieve relative error $< 10^{-4}$ on random $50 \times 30$ matrices.

```python
def svd_power(A: torch.Tensor, num_iters: int = 300) -> tuple:
    """
    Compute the SVD of A using power iteration + deflation.

    Args:
        A: (m, n) tensor
        num_iters: iterations per singular value

    Returns:
        U: (m, m) orthogonal
        S: (min(m,n),) singular values
        Vh: (n, n) orthogonal (V^T)
    """
    # YOUR CODE HERE
    pass
```

**Problem 7** (10 pts). *Low-rank approximation.*
Given the MNIST dataset (28x28 images flattened to 784-d vectors):

- Compute the SVD of the data matrix.
- Plot the top 20 singular values. What fraction of total variance do the top 10 principal components capture?
- Reconstruct images using rank-$k$ approximations for $k \in \{5, 10, 50, 100, 784\}$. Display results in a grid.
- Determine the minimum $k$ needed to achieve $< 5\%$ reconstruction error (in relative Frobenius norm).

**Problem 8** (15 pts). *Spectral normalization.*
Implement spectral normalization for a linear layer:

- Maintain running estimates $\hat{\mathbf{u}}$, $\hat{\mathbf{v}}$ of the top left/right singular vectors.
- At each forward pass, perform one step of power iteration to update the estimates.
- Divide the weight matrix by the estimated spectral norm.

```python
class SpectralNormLinear(torch.nn.Module):
    def __init__(self, in_features: int, out_features: int):
        super().__init__()
        self.weight = torch.nn.Parameter(torch.randn(out_features, in_features))
        self.bias = torch.nn.Parameter(torch.zeros(out_features))
        # Register buffers for u, v (not trainable)
        self.register_buffer('u', torch.randn(out_features))
        self.register_buffer('v', torch.randn(in_features))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # YOUR CODE HERE: one step of power iteration, then normalize
        pass
```

Compare training a small GAN with and without spectral normalization on a 2D Gaussian mixture.

---

*Next: [Lecture 00b — Probability and Information Theory](lecture_00b_probability_information_theory.md)*
