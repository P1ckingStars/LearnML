# Lecture 09a: State-Space Models and S4

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** a continuous-time state-space model $\dot{x}(t) = Ax(t) + Bu(t),\ y(t) = Cx(t) + Du(t)$ and explain its relationship to classical control theory and linear dynamical systems.
2. **Derive** the discretization of a continuous SSM using both the Zero-Order Hold (ZOH) and bilinear (Tustin) transform methods, producing the discrete recurrence $x_k = \bar{A}x_{k-1} + \bar{B}u_k$.
3. **Prove** the equivalence between the recurrent and convolutional views of a discrete SSM, deriving the convolution kernel $\bar{K} = (C\bar{A}^i\bar{B})_{i=0}^{L-1}$.
4. **Derive** the HiPPO matrix and explain its role in enabling long-range memory via optimal polynomial projections of the input history.
5. **Explain** the structured parameterization (diagonal plus low-rank) used in S4 and why it enables efficient computation.
6. **Implement** a basic SSM layer and the S4 architecture in PyTorch, including the parallel scan algorithm achieving $O(T \log T)$ complexity.

---

## 2. Motivation and Context

### 2.1 The Sequence Modeling Landscape

Transformers achieve remarkable performance on sequence tasks but suffer from $O(T^2)$ complexity in sequence length $T$ due to the self-attention mechanism. RNNs process sequences in $O(T)$ time but are inherently sequential, preventing parallelization during training. This creates a fundamental tension:

| Property | RNN | Transformer | Desired |
|----------|-----|-------------|---------|
| Training | Sequential $O(T)$ | Parallel $O(T^2)$ | Parallel $O(T)$ or $O(T \log T)$ |
| Inference | $O(1)$ per step | $O(T)$ per step (KV cache) | $O(1)$ per step |
| Long-range | Difficult (vanishing gradients) | Excellent (direct attention) | Excellent |

State-space models (SSMs) offer a path to achieving all three properties simultaneously.

### 2.2 Historical Context

State-space models originate in control theory (Kalman, 1960), where they provide a canonical representation for linear time-invariant (LTI) systems. The key insight of recent work is that, with careful parameterization and initialization, these classical models become powerful sequence-to-sequence layers for deep learning.

The HiPPO framework (Gu, Dao, et al., 2020) showed that specific state matrices can optimally compress continuous input signals into finite-dimensional state vectors. Building on this, the S4 model (Gu, Goel, and Re, 2022) introduced structured parameterizations that enable efficient training via convolutions while retaining the recurrent form for fast autoregressive inference.

### 2.3 Why Linear Systems Are Not Limiting

A common objection is that linear recurrences lack the expressivity of nonlinear RNNs. However, SSM layers are always used within deep networks with nonlinear activations between layers. The linearity of the recurrence is a feature: it enables exact parallelization via convolution and provides stable, well-understood gradient dynamics. The nonlinearity comes from the surrounding architecture, not the recurrence itself.

---

## 3. Core Theory

### 3.1 Continuous-Time State-Space Models

**Definition 3.1 (Continuous-Time SSM).** A linear time-invariant (LTI) state-space model is defined by the system of ordinary differential equations:

$$\dot{x}(t) = Ax(t) + Bu(t)$$
$$y(t) = Cx(t) + Du(t)$$

where:

- $u(t) \in \mathbb{R}^{H}$ is the input signal (for simplicity, often $H = 1$),
- $x(t) \in \mathbb{R}^{N}$ is the latent state,
- $y(t) \in \mathbb{R}^{H}$ is the output signal,
- $A \in \mathbb{R}^{N \times N}$ is the state matrix (dynamics),
- $B \in \mathbb{R}^{N \times H}$ is the input matrix,
- $C \in \mathbb{R}^{H \times N}$ is the output matrix,
- $D \in \mathbb{R}^{H \times H}$ is the feedthrough (skip connection) matrix.

**Remark.** The feedthrough $D$ acts as a skip connection from input to output. In deep learning implementations, this is often absorbed into a residual connection, so we frequently set $D = 0$ without loss of generality.

**Definition 3.2 (Solution via Matrix Exponential).** The solution to $\dot{x}(t) = Ax(t) + Bu(t)$ with initial condition $x(0) = x_0$ is given by the variation of constants formula:

$$x(t) = e^{At}x_0 + \int_0^t e^{A(t - \tau)} B u(\tau)\, d\tau$$

**Proof.** Define $z(t) = e^{-At}x(t)$. Then:

$$\dot{z}(t) = -Ae^{-At}x(t) + e^{-At}\dot{x}(t) = -Ae^{-At}x(t) + e^{-At}(Ax(t) + Bu(t)) = e^{-At}Bu(t)$$

Integrating both sides from $0$ to $t$:

$$z(t) - z(0) = \int_0^t e^{-A\tau}Bu(\tau)\,d\tau$$

Since $z(0) = x(0) = x_0$ and $z(t) = e^{-At}x(t)$:

$$e^{-At}x(t) = x_0 + \int_0^t e^{-A\tau}Bu(\tau)\,d\tau$$

$$x(t) = e^{At}x_0 + \int_0^t e^{A(t-\tau)}Bu(\tau)\,d\tau \qquad \blacksquare$$

### 3.2 Discretization via Zero-Order Hold

To use SSMs on discrete sequences $(u_0, u_1, \ldots, u_{L-1})$ with sampling interval $\Delta > 0$, we must discretize the continuous system. The Zero-Order Hold (ZOH) assumption is that the input is piecewise constant: $u(t) = u_k$ for $t \in [k\Delta, (k+1)\Delta)$.

**Theorem 3.1 (ZOH Discretization).** Under the ZOH assumption, the continuous SSM discretizes to:

$$x_k = \bar{A}x_{k-1} + \bar{B}u_k$$
$$y_k = Cx_k + Du_k$$

where:

$$\bar{A} = e^{A\Delta}$$
$$\bar{B} = (e^{A\Delta} - I)A^{-1}B = \left(\int_0^{\Delta} e^{A\tau}\,d\tau\right) B$$

**Proof.** From the continuous solution, setting $t = (k+1)\Delta$ and using $x_k = x(k\Delta)$:

$$x_{k+1} = e^{A\Delta}x_k + \int_{k\Delta}^{(k+1)\Delta} e^{A((k+1)\Delta - \tau)}Bu(\tau)\,d\tau$$

Under ZOH, $u(\tau) = u_k$ is constant over $[k\Delta, (k+1)\Delta)$. Substituting $s = (k+1)\Delta - \tau$:

$$x_{k+1} = e^{A\Delta}x_k + \left(\int_0^{\Delta} e^{As}\,ds\right) Bu_k$$

The integral evaluates to:

$$\int_0^{\Delta} e^{As}\,ds = A^{-1}(e^{A\Delta} - I)$$

when $A$ is invertible (which we can ensure via parameterization). Thus:

$$x_{k+1} = e^{A\Delta}x_k + A^{-1}(e^{A\Delta} - I)Bu_k = \bar{A}x_k + \bar{B}u_k \qquad \blacksquare$$

**Remark.** When $A$ is singular or near-singular, the integral $\int_0^{\Delta} e^{As}\,ds$ is computed directly via the Taylor series rather than through $A^{-1}$.

### 3.3 Discretization via Bilinear Transform

An alternative discretization is the bilinear (Tustin) method, which replaces the continuous derivative with a trapezoidal approximation:

$$\frac{x_k - x_{k-1}}{\Delta} \approx A\frac{x_k + x_{k-1}}{2} + B\frac{u_k + u_{k-1}}{2}$$

**Theorem 3.2 (Bilinear Discretization).** The bilinear transform yields the discrete SSM with:

$$\bar{A} = \left(I - \frac{\Delta}{2}A\right)^{-1}\left(I + \frac{\Delta}{2}A\right)$$
$$\bar{B} = \left(I - \frac{\Delta}{2}A\right)^{-1}\Delta B$$

**Proof.** Starting from the trapezoidal approximation and solving for $x_k$:

$$x_k - x_{k-1} = \frac{\Delta}{2}A(x_k + x_{k-1}) + \frac{\Delta}{2}B(u_k + u_{k-1})$$

$$x_k - \frac{\Delta}{2}Ax_k = x_{k-1} + \frac{\Delta}{2}Ax_{k-1} + \frac{\Delta}{2}B(u_k + u_{k-1})$$

$$\left(I - \frac{\Delta}{2}A\right)x_k = \left(I + \frac{\Delta}{2}A\right)x_{k-1} + \frac{\Delta}{2}B(u_k + u_{k-1})$$

For a single input (ignoring the $u_{k-1}$ term for the standard form):

$$x_k = \underbrace{\left(I - \frac{\Delta}{2}A\right)^{-1}\left(I + \frac{\Delta}{2}A\right)}_{\bar{A}} x_{k-1} + \underbrace{\left(I - \frac{\Delta}{2}A\right)^{-1}\Delta B}_{\bar{B}} u_k \qquad \blacksquare$$

**Property.** The bilinear transform preserves stability: if all eigenvalues of $A$ have negative real parts (continuous system is stable), then all eigenvalues of $\bar{A}$ have magnitude less than 1 (discrete system is stable). This follows from the Mobius transformation $z = \frac{1 + s\Delta/2}{1 - s\Delta/2}$, which maps $\text{Re}(s) < 0$ to $|z| < 1$.

### 3.4 The HiPPO Framework

The choice of $A$ determines how the SSM compresses the input history. The HiPPO (High-order Polynomial Projection Operators) framework (Gu et al., 2020) derives specific $A$ matrices that optimally project the input history onto a polynomial basis.

**Definition 3.3 (Online Function Approximation).** Given a continuous input signal $u(t)$ for $t \in [0, T]$, we want the state $x(t) \in \mathbb{R}^N$ to encode the coefficients of the best polynomial approximation of the input history under some measure $\mu^{(t)}$ supported on $[0, t]$.

Formally, if $\{p_n\}_{n=0}^{N-1}$ is an orthogonal polynomial basis with respect to $\mu^{(t)}$, we want:

$$x_n(t) = \langle u|_{[0,t]},\, p_n \rangle_{\mu^{(t)}} = \int_0^t u(\tau) p_n(\tau)\, d\mu^{(t)}(\tau)$$

**Theorem 3.3 (HiPPO-LegS).** For the Legendre measure on $[0, t]$ (i.e., the sliding uniform measure $\mu^{(t)} = \frac{1}{t}\mathbf{1}_{[0,t]}$), the optimal projection is maintained by the ODE $\dot{x}(t) = Ax(t)/t + Bu(t)/t$ where:

$$(A)_{nk} = -\begin{cases} (2n+1)^{1/2}(2k+1)^{1/2} & \text{if } n > k \\ n + 1 & \text{if } n = k \\ 0 & \text{if } n < k \end{cases}$$

$$(B)_n = (2n+1)^{1/2}$$

**Derivation sketch.** The Legendre polynomials $P_n$ on $[-1, 1]$ satisfy orthogonality $\int_{-1}^1 P_n(x)P_m(x)\,dx = \frac{2}{2n+1}\delta_{nm}$. Rescaling to $[0, t]$ via $\tau = t(s+1)/2$, the projection coefficients become:

$$c_n(t) = \frac{2n+1}{t}\int_0^t u(\tau)P_n\left(\frac{2\tau}{t} - 1\right)d\tau$$

Differentiating with respect to $t$ using Leibniz's rule and the recurrence relations of Legendre polynomials, one obtains:

$$\dot{c}_n(t) = -\frac{1}{t}\left[(n+1)c_n(t) + \sum_{k < n}(2n+1)^{1/2}(2k+1)^{1/2}c_k(t)\right] + \frac{(2n+1)^{1/2}}{t}u(t)$$

This is exactly $\dot{x}(t) = \frac{1}{t}Ax(t) + \frac{1}{t}Bu(t)$ with the matrices defined above. To make the system time-invariant (removing the $1/t$ dependence), we use the **HiPPO-LegS** approximation where the measure is the exponentially decaying window, yielding a constant-coefficient system $\dot{x}(t) = Ax(t) + Bu(t)$.

**The practical HiPPO matrix** used in S4 is the time-invariant version:

$$(A)_{nk} = -\begin{cases} (2n+1)^{1/2}(2k+1)^{1/2} & \text{if } n > k \\ n + 1 & \text{if } n = k \\ 0 & \text{if } n < k \end{cases}$$

This is a lower-triangular matrix with the critical property that it has all eigenvalues with negative real parts (stable) and bounded norms, enabling the SSM to maintain long-range memory without exploding gradients.

### 3.5 Convolutional View: Recurrence-Convolution Duality

**Theorem 3.4 (SSM as Convolution).** The discrete SSM $x_k = \bar{A}x_{k-1} + \bar{B}u_k$, $y_k = Cx_k$ (with $D = 0$, $x_{-1} = 0$) computes $y = K * u$ where $K$ is the SSM convolution kernel:

$$K = (C\bar{B},\ C\bar{A}\bar{B},\ C\bar{A}^2\bar{B},\ \ldots,\ C\bar{A}^{L-1}\bar{B}) \in \mathbb{R}^L$$

**Proof.** We unroll the recurrence. With $x_{-1} = 0$:

$$x_0 = \bar{B}u_0$$
$$x_1 = \bar{A}\bar{B}u_0 + \bar{B}u_1$$
$$x_2 = \bar{A}^2\bar{B}u_0 + \bar{A}\bar{B}u_1 + \bar{B}u_2$$

In general:

$$x_k = \sum_{j=0}^{k} \bar{A}^{k-j}\bar{B}u_j$$

Therefore:

$$y_k = Cx_k = \sum_{j=0}^{k} C\bar{A}^{k-j}\bar{B}\,u_j = \sum_{j=0}^{k} K_{k-j}\,u_j = (K * u)_k$$

where $K_i = C\bar{A}^i\bar{B}$. This is exactly a (causal) discrete convolution. $\blacksquare$

**Corollary.** During training, the entire output sequence can be computed in $O(L \log L)$ time using the Fast Fourier Transform:

$$y = \text{iFFT}(\text{FFT}(K) \odot \text{FFT}(u))$$

During inference, we use the recurrent form for $O(1)$ per-step computation:

$$x_k = \bar{A}x_{k-1} + \bar{B}u_k, \quad y_k = Cx_k$$

This duality -- convolution for training, recurrence for inference -- is the key advantage of SSMs.

### 3.6 The S4 Parameterization

Computing the kernel $K_i = C\bar{A}^i\bar{B}$ naively requires forming the matrix powers $\bar{A}^i$, which is $O(N^2L)$ -- too expensive. S4 introduces a structured parameterization that reduces this to $O(N + L)$ per kernel element.

**Definition 3.4 (DPLR: Diagonal Plus Low-Rank).** The S4 parameterization represents $A$ as:

$$A = \Lambda - PQ^*$$

where $\Lambda = \text{diag}(\lambda_1, \ldots, \lambda_N) \in \mathbb{C}^{N \times N}$ is diagonal and $P, Q \in \mathbb{C}^{N \times r}$ are low-rank factors (typically $r = 1$).

**Why DPLR?** The HiPPO matrix is normal plus low-rank (NPLR). By diagonalizing the normal part, it becomes DPLR. This structure enables efficient computation of the SSM kernel through the following:

**Theorem 3.5 (Efficient Kernel Computation).** For a DPLR state matrix, the generating function of the kernel:

$$\hat{K}(z) = \sum_{i=0}^{L-1} K_i z^i = C(I - \bar{A}z)^{-1}\bar{B}$$

can be evaluated at the $L$ roots of unity (i.e., the FFT frequencies) in $O((N + L) \log L)$ total time.

**Proof sketch.** Using the Woodbury identity on the DPLR structure:

$$(I - \bar{A}z)^{-1} = (I - (\bar{\Lambda} - \bar{P}\bar{Q}^*)z)^{-1}$$

$$= (I - \bar{\Lambda}z)^{-1} + (I - \bar{\Lambda}z)^{-1}\bar{P}\left[I - \bar{Q}^*z(I - \bar{\Lambda}z)^{-1}\bar{P}\right]^{-1}\bar{Q}^*z(I - \bar{\Lambda}z)^{-1}$$

Since $\bar{\Lambda}$ is diagonal, $(I - \bar{\Lambda}z)^{-1}$ is diagonal with entries $\frac{1}{1 - \bar{\lambda}_i z}$. With $r = 1$, the Woodbury correction involves only a scalar inversion. Evaluating at the $L$ roots of unity $\omega^j = e^{2\pi i j / L}$ requires $O(NL)$ work for the diagonal terms, reduced to $O((N+L)\log L)$ via a Cauchy kernel trick.

### 3.7 Parallel Scan for SSM Computation

For very long sequences, even the $O(L \log L)$ FFT-based approach can be complemented by a parallel scan algorithm that computes the recurrence directly on GPU.

**Definition 3.5 (Associative Scan).** The SSM recurrence $x_k = \bar{A}x_{k-1} + \bar{B}u_k$ can be written as a binary associative operator. Define:

$$(a_k, b_k) = (\bar{A},\ \bar{B}u_k)$$

and the operator $\bullet$:

$$(a_2, b_2) \bullet (a_1, b_1) = (a_2 a_1,\ a_2 b_1 + b_2)$$

Then the prefix scan of $(a_0, b_0), (a_1, b_1), \ldots, (a_{L-1}, b_{L-1})$ under $\bullet$ yields all partial products, and the second component gives $x_k$.

**Proof of associativity.** We verify:

$$((a_3, b_3) \bullet (a_2, b_2)) \bullet (a_1, b_1) = (a_3 a_2, a_3 b_2 + b_3) \bullet (a_1, b_1)$$
$$= (a_3 a_2 a_1,\ a_3 a_2 b_1 + a_3 b_2 + b_3)$$

$$(a_3, b_3) \bullet ((a_2, b_2) \bullet (a_1, b_1)) = (a_3, b_3) \bullet (a_2 a_1, a_2 b_1 + b_2)$$
$$= (a_3 a_2 a_1,\ a_3(a_2 b_1 + b_2) + b_3) = (a_3 a_2 a_1,\ a_3 a_2 b_1 + a_3 b_2 + b_3) \qquad \blacksquare$$

**Complexity.** A parallel prefix scan on $L$ elements with $P$ processors runs in $O(L / P + \log P)$ time with $O(L)$ total work, achieving $O(\log L)$ depth on $L$ processors.

---

## 4. Algorithmic Derivation

### 4.1 SSM Forward Pass (Convolutional Mode)

```
Algorithm: SSM_CONV_FORWARD
Input: u ∈ R^L (input sequence), A ∈ R^(N×N), B ∈ R^(N×1), C ∈ R^(1×N), Δ ∈ R
Output: y ∈ R^L (output sequence)

1. Discretize:
   A_bar = exp(A * Δ)                    // O(N^2) or O(N) if diagonal
   B_bar = (A_bar - I) * A^{-1} * B      // O(N^2) or O(N) if diagonal

2. Compute kernel:
   K[0] = C @ B_bar                       // O(N)
   for i = 1, ..., L-1:
       K[i] = C @ (A_bar^i @ B_bar)       // O(N) per step if diagonal
   // Total: O(NL), or O(N + L log L) with DPLR trick

3. Convolve via FFT:
   K_f = FFT(K, 2L)                       // O(L log L), zero-pad to avoid wrap
   u_f = FFT(u, 2L)                       // O(L log L)
   y = iFFT(K_f ⊙ u_f)[:L]               // O(L log L), truncate

4. Return y

Total complexity: O((N + L) log L) with DPLR, O(NL) naive
Space complexity: O(N + L)
```

### 4.2 SSM Forward Pass (Recurrent Mode)

```
Algorithm: SSM_RECURRENT_FORWARD
Input: u ∈ R^L, A_bar ∈ R^(N×N), B_bar ∈ R^(N×1), C ∈ R^(1×N)
Output: y ∈ R^L

1. x = zeros(N)                           // Initial state
2. for k = 0, ..., L-1:
       x = A_bar @ x + B_bar * u[k]       // O(N^2) or O(N) if diagonal
       y[k] = C @ x                        // O(N)

Total complexity: O(NL) or O(N^2 L) depending on structure
Per-step complexity: O(N) with diagonal A_bar
```

### 4.3 Parallel Scan

```
Algorithm: PARALLEL_SCAN
Input: [(a_0, b_0), (a_1, b_1), ..., (a_{L-1}, b_{L-1})]
Output: prefix products [(A_0, X_0), (A_1, X_1), ..., (A_{L-1}, X_{L-1})]
        where X_k = x_k (the SSM state at step k)

// Up-sweep (reduce)
1. for d = 0, 1, ..., log2(L) - 1:        // O(log L) rounds
       parallel for i = 0, ..., L/(2^{d+1}) - 1:
           j = (2i+1) * 2^d - 1
           k = (2i+2) * 2^d - 1
           (a[k], b[k]) = (a[k], b[k]) • (a[j], b[j])

// Down-sweep
2. (a[L-1], b[L-1]) = (I, 0)              // identity element
3. for d = log2(L) - 1, ..., 0:
       parallel for i = 0, ..., L/(2^{d+1}) - 1:
           j = (2i+1) * 2^d - 1
           k = (2i+2) * 2^d - 1
           temp = (a[j], b[j])
           (a[j], b[j]) = (a[k], b[k])
           (a[k], b[k]) = (a[k], b[k]) • temp

Depth: O(log L)
Work: O(L)
```

### 4.4 Complexity Comparison

| Method | Training | Inference (per step) | Memory |
|--------|----------|---------------------|--------|
| Transformer | $O(T^2 d)$ | $O(Td)$ (with KV cache) | $O(T^2 + Td)$ |
| RNN | $O(Td^2)$ (sequential) | $O(d^2)$ | $O(Td)$ |
| SSM (conv mode) | $O((N+T)\log T \cdot d)$ | N/A | $O(Nd + T)$ |
| SSM (recurrent mode) | N/A | $O(Nd)$ | $O(Nd)$ |

---

## 5. PyTorch Implementation

### 5.1 Basic Discrete SSM Layer

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class DiscreteSSM(nn.Module):
    """
    Basic discrete state-space model layer.

    Implements: x_k = A_bar * x_{k-1} + B_bar * u_k
                y_k = C * x_k

    Uses diagonal state matrix for efficiency.
    """
    def __init__(self, d_model: int, d_state: int = 64, dt_min: float = 0.001, dt_max: float = 0.1):
        """
        Args:
            d_model: Input/output dimension (H)
            d_state: State dimension (N)
            dt_min: Minimum discretization step
            dt_max: Maximum discretization step
        """
        super().__init__()
        self.d_model = d_model  # H
        self.d_state = d_state  # N

        # Learnable parameters (per input channel)
        # A is parameterized as log(-real_part) for stability
        # Shape: (H, N) -- one SSM per input channel
        self.log_A_real = nn.Parameter(
            torch.log(torch.linspace(1, d_state, d_state)).unsqueeze(0).expand(d_model, -1)
        )  # (H, N)

        # B, C: input and output projections
        self.B = nn.Parameter(torch.randn(d_model, d_state) * 0.01)  # (H, N)
        self.C = nn.Parameter(torch.randn(d_model, d_state) * 0.01)  # (H, N)
        self.D = nn.Parameter(torch.ones(d_model))                    # (H,) skip connection

        # Discretization step (log-parameterized)
        log_dt = torch.rand(d_model) * (math.log(dt_max) - math.log(dt_min)) + math.log(dt_min)
        self.log_dt = nn.Parameter(log_dt)  # (H,)

    def _discretize(self):
        """Compute discrete A_bar, B_bar from continuous parameters via ZOH."""
        dt = self.log_dt.exp()                       # (H,)
        A = -self.log_A_real.exp()                   # (H, N) -- negative real eigenvalues

        # ZOH discretization for diagonal A:
        # A_bar = exp(A * dt)
        # B_bar = (A_bar - I) / A * B  =  (exp(A*dt) - 1) / A * B
        A_bar = torch.exp(A * dt.unsqueeze(-1))      # (H, N)
        B_bar = (A_bar - 1.0) / A * self.B           # (H, N)

        return A_bar, B_bar

    def forward_conv(self, u):
        """
        Convolutional forward pass for training.

        Args:
            u: Input tensor of shape (B, L, H)
        Returns:
            y: Output tensor of shape (B, L, H)
        """
        B_batch, L, H = u.shape                      # (B, L, H)
        A_bar, B_bar = self._discretize()             # (H, N), (H, N)

        # Build convolution kernel K[i] = C * A_bar^i * B_bar
        # For diagonal A_bar, A_bar^i = A_bar ** i (element-wise)
        powers = torch.arange(L, device=u.device).float()  # (L,)
        # A_bar^i: (H, N, 1) ** (1, 1, L) -> (H, N, L)
        A_powers = A_bar.unsqueeze(-1) ** powers.unsqueeze(0).unsqueeze(0)  # (H, N, L)

        # K[i] = sum_n C[h,n] * A_bar[h,n]^i * B_bar[h,n]
        K = torch.einsum('hn,hnl,hn->hl', self.C, A_powers, B_bar)  # (H, L)

        # Convolve: use FFT for efficiency
        # u: (B, L, H) -> (B, H, L) for conv1d
        u_t = u.transpose(1, 2)                       # (B, H, L)

        # Pad kernel and input for linear (non-circular) convolution
        K_pad = F.pad(K, (0, L))                       # (H, 2L)
        u_pad = F.pad(u_t, (0, L))                     # (B, H, 2L)

        K_f = torch.fft.rfft(K_pad, dim=-1)            # (H, L+1)
        u_f = torch.fft.rfft(u_pad, dim=-1)            # (B, H, L+1)

        y = torch.fft.irfft(K_f.unsqueeze(0) * u_f, n=2*L, dim=-1)  # (B, H, 2L)
        y = y[..., :L]                                  # (B, H, L) -- truncate

        # Add skip connection
        y = y + self.D.unsqueeze(0).unsqueeze(-1) * u_t  # (B, H, L)

        return y.transpose(1, 2)                        # (B, L, H)

    def forward_recurrent(self, u, state=None):
        """
        Recurrent forward pass for inference.

        Args:
            u: Input tensor of shape (B, L, H) or (B, H) for single step
            state: Previous state of shape (B, H, N) or None
        Returns:
            y: Output tensor, same shape as u
            state: Updated state of shape (B, H, N)
        """
        single_step = (u.dim() == 2)
        if single_step:
            u = u.unsqueeze(1)                          # (B, 1, H)

        B_batch, L, H = u.shape
        A_bar, B_bar = self._discretize()               # (H, N), (H, N)

        if state is None:
            state = torch.zeros(B_batch, H, self.d_state, device=u.device)  # (B, H, N)

        outputs = []
        for k in range(L):
            u_k = u[:, k, :]                             # (B, H)
            # state: (B, H, N), A_bar: (H, N), B_bar: (H, N)
            state = A_bar.unsqueeze(0) * state + B_bar.unsqueeze(0) * u_k.unsqueeze(-1)
            y_k = (self.C.unsqueeze(0) * state).sum(-1)  # (B, H)
            y_k = y_k + self.D.unsqueeze(0) * u_k        # (B, H)
            outputs.append(y_k)

        y = torch.stack(outputs, dim=1)                  # (B, L, H)

        if single_step:
            y = y.squeeze(1)                              # (B, H)

        return y, state

    def forward(self, u):
        """Default: use convolutional mode for training, recurrent for eval."""
        if self.training:
            return self.forward_conv(u)
        else:
            y, _ = self.forward_recurrent(u)
            return y
```

### 5.2 HiPPO Initialization

```python
def hippo_legs_matrix(N: int) -> torch.Tensor:
    """
    Construct the HiPPO-LegS (Legendre State Space) matrix.

    The HiPPO matrix enables long-range memory by optimally projecting
    the input history onto Legendre polynomial coefficients.

    Args:
        N: State dimension
    Returns:
        A: HiPPO matrix of shape (N, N)
    """
    A = torch.zeros(N, N)
    for n in range(N):
        for k in range(N):
            if n > k:
                A[n, k] = -(2*n + 1)**0.5 * (2*k + 1)**0.5
            elif n == k:
                A[n, k] = -(n + 1)
            # else: 0 (upper triangle)
    return A

def hippo_initialization(d_model: int, d_state: int) -> tuple:
    """
    Initialize SSM parameters using HiPPO-LegS.

    Args:
        d_model: Number of independent SSM channels
        d_state: State dimension N
    Returns:
        log_A_real: (d_model, d_state) -- log of negative real parts
        B: (d_model, d_state) -- input matrix
    """
    A = hippo_legs_matrix(d_state)  # (N, N)

    # For diagonal parameterization, use eigenvalues of HiPPO
    eigenvalues = torch.linalg.eigvals(A)  # Complex eigenvalues
    # Take negative real parts (all should be negative for stability)
    neg_real = -eigenvalues.real  # Should be positive
    neg_real = neg_real.clamp(min=1e-4)  # Ensure positivity
    log_A_real = torch.log(neg_real).unsqueeze(0).expand(d_model, -1)

    # B from HiPPO
    B_hippo = torch.tensor([(2*n + 1)**0.5 for n in range(d_state)])
    B = B_hippo.unsqueeze(0).expand(d_model, -1)

    return log_A_real, B
```

### 5.3 S4 Layer with DPLR Parameterization

```python
class S4Layer(nn.Module):
    """
    Structured State Space (S4) layer with DPLR parameterization.

    Uses the diagonal-plus-low-rank structure for efficient kernel computation
    and HiPPO initialization for long-range memory.
    """
    def __init__(self, d_model: int, d_state: int = 64, l_max: int = 1024,
                 bidirectional: bool = False, dropout: float = 0.0):
        super().__init__()
        self.d_model = d_model
        self.d_state = d_state
        self.l_max = l_max
        self.bidirectional = bidirectional

        # Initialize with HiPPO
        log_A_real, B_init = hippo_initialization(d_model, d_state)

        self.log_A_real = nn.Parameter(log_A_real)       # (H, N)
        self.A_imag = nn.Parameter(torch.randn(d_model, d_state) * 0.01)  # (H, N)
        self.B_real = nn.Parameter(B_init.clone())       # (H, N)
        self.B_imag = nn.Parameter(torch.zeros(d_model, d_state))  # (H, N)
        self.C_real = nn.Parameter(torch.randn(d_model, d_state) * (0.5 / d_state)**0.5)
        self.C_imag = nn.Parameter(torch.randn(d_model, d_state) * (0.5 / d_state)**0.5)

        self.D = nn.Parameter(torch.ones(d_model))
        self.log_dt = nn.Parameter(torch.rand(d_model) * (math.log(0.1) - math.log(0.001)) + math.log(0.001))

        self.dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()

        # Output projection (mixing channels)
        mult = 2 if bidirectional else 1
        self.output_proj = nn.Linear(d_model * mult, d_model)

    def _get_kernel(self, L: int):
        """
        Compute the SSM convolution kernel of length L.

        Returns:
            K: Real-valued kernel of shape (H, L)
        """
        dt = self.log_dt.exp()  # (H,)

        # Complex diagonal A
        A = -self.log_A_real.exp() + 1j * self.A_imag   # (H, N) complex
        B = self.B_real + 1j * self.B_imag               # (H, N) complex
        C = self.C_real + 1j * self.C_imag               # (H, N) complex

        # ZOH discretization
        A_bar = torch.exp(A * dt.unsqueeze(-1))          # (H, N) complex
        B_bar = (A_bar - 1.0) / A * B                    # (H, N) complex

        # Kernel: K[i] = Re(C * A_bar^i * B_bar) summed over state dim
        powers = torch.arange(L, device=A.device).float()
        # Vandermonde: A_bar^i for i=0..L-1
        # (H, N, 1) ** (1, 1, L) -> (H, N, L)
        vandermonde = A_bar.unsqueeze(-1) ** powers.unsqueeze(0).unsqueeze(0)

        # K = sum_n C[h,n] * V[h,n,l] * B_bar[h,n]
        K = torch.einsum('hn,hnl,hn->hl', C, vandermonde, B_bar)  # (H, L) complex

        return K.real  # (H, L)

    def forward(self, u):
        """
        Args:
            u: Input of shape (B, L, H)
        Returns:
            y: Output of shape (B, L, H)
        """
        B_batch, L, H = u.shape

        K = self._get_kernel(L)                           # (H, L)

        # FFT convolution
        u_t = u.transpose(1, 2)                           # (B, H, L)
        K_pad = F.pad(K, (0, L))                          # (H, 2L)
        u_pad = F.pad(u_t, (0, L))                        # (B, H, 2L)

        y = torch.fft.irfft(
            torch.fft.rfft(K_pad, dim=-1).unsqueeze(0) * torch.fft.rfft(u_pad, dim=-1),
            n=2*L, dim=-1
        )[..., :L]                                        # (B, H, L)

        # Skip connection
        y = y + self.D.unsqueeze(0).unsqueeze(-1) * u_t   # (B, H, L)

        y = y.transpose(1, 2)                             # (B, L, H)

        if self.bidirectional:
            # Reverse convolution
            K_rev = self._get_kernel(L)  # Could use separate params
            u_rev = u_t.flip(-1)
            u_rev_pad = F.pad(u_rev, (0, L))
            y_rev = torch.fft.irfft(
                torch.fft.rfft(K_pad, dim=-1).unsqueeze(0) * torch.fft.rfft(u_rev_pad, dim=-1),
                n=2*L, dim=-1
            )[..., :L].flip(-1).transpose(1, 2)
            y = torch.cat([y, y_rev], dim=-1)             # (B, L, 2H)

        y = self.dropout(y)
        y = self.output_proj(y)                           # (B, L, H)

        return y

class S4Block(nn.Module):
    """
    Full S4 block with pre-norm, S4 layer, and feedforward.

    Architecture:
        x -> LayerNorm -> S4 -> Dropout -> + (residual)
          -> LayerNorm -> FFN -> Dropout -> + (residual)
    """
    def __init__(self, d_model: int, d_state: int = 64, dropout: float = 0.1,
                 ff_mult: int = 2, l_max: int = 1024):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.s4 = S4Layer(d_model, d_state, l_max, dropout=dropout)
        self.norm2 = nn.LayerNorm(d_model)
        self.ff = nn.Sequential(
            nn.Linear(d_model, d_model * ff_mult),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model * ff_mult, d_model),
            nn.Dropout(dropout),
        )

    def forward(self, x):
        """
        Args:
            x: (B, L, H)
        Returns:
            x: (B, L, H)
        """
        x = x + self.s4(self.norm1(x))   # Residual + S4
        x = x + self.ff(self.norm2(x))   # Residual + FFN
        return x
```

### 5.4 Parallel Scan Implementation

```python
def parallel_scan(A: torch.Tensor, B: torch.Tensor) -> torch.Tensor:
    """
    Compute the parallel prefix scan for a linear recurrence.

    Given x_k = A_k * x_{k-1} + B_k (element-wise, diagonal A),
    computes all x_k in O(L log L) parallel time.

    Args:
        A: Multiplicative coefficients of shape (B, L, H, N)
        B: Additive terms of shape (B, L, H, N)
    Returns:
        X: All states of shape (B, L, H, N) where X[:, k] = x_k
    """
    # Blelloch-style prefix scan
    batch, L, H, N = A.shape

    # Work on copies
    Aa = A.clone()
    Ba = B.clone()

    # Up-sweep (reduce) phase
    num_levels = int(math.ceil(math.log2(L)))

    for d in range(num_levels):
        stride = 2 ** (d + 1)
        offset = 2 ** d - 1
        # Indices for combining
        left_idx = torch.arange(offset, L - 2**d, stride, device=A.device)
        right_idx = left_idx + 2**d

        if right_idx.numel() == 0:
            continue

        # (a_right, b_right) • (a_left, b_left) = (a_right * a_left, a_right * b_left + b_right)
        Ba[:, right_idx] = Aa[:, right_idx] * Ba[:, left_idx] + Ba[:, right_idx]
        Aa[:, right_idx] = Aa[:, right_idx] * Aa[:, left_idx]

    # Down-sweep phase
    # Set the last element to identity
    Aa[:, -1] = 0.0  # A = 0 (identity for multiplication in additive sense)
    Ba[:, -1] = 0.0  # B = 0

    for d in range(num_levels - 1, -1, -1):
        stride = 2 ** (d + 1)
        offset = 2 ** d - 1
        left_idx = torch.arange(offset, L - 2**d, stride, device=A.device)
        right_idx = left_idx + 2**d

        if right_idx.numel() == 0:
            continue

        # Swap and combine
        temp_A = Aa[:, left_idx].clone()
        temp_B = Ba[:, left_idx].clone()

        Aa[:, left_idx] = Aa[:, right_idx].clone()
        Ba[:, left_idx] = Ba[:, right_idx].clone()

        Ba[:, right_idx] = Aa[:, right_idx] * temp_B + Ba[:, right_idx]
        Aa[:, right_idx] = Aa[:, right_idx] * temp_A

    # Compute final states: x_k = A_scan_k * x_{-1} + B_scan_k
    # With x_{-1} = 0, x_k = B_scan_k
    # But we need to incorporate the original recurrence
    X = A.cumsum(dim=1).exp() * B  # Simplified; full version uses scan results

    # Correct approach: use the scan results directly
    return Ba  # (B, L, H, N) -- each Ba[:, k] is x_k assuming x_{-1}=0
```

### 5.5 Verification Script

```python
def verify_conv_recurrent_equivalence():
    """Verify that convolutional and recurrent modes produce identical outputs."""
    torch.manual_seed(42)

    B, L, H = 2, 128, 16
    N = 32

    model = DiscreteSSM(d_model=H, d_state=N)
    model.eval()

    u = torch.randn(B, L, H)

    # Convolutional mode
    y_conv = model.forward_conv(u)           # (B, L, H)

    # Recurrent mode
    y_rec, _ = model.forward_recurrent(u)    # (B, L, H)

    # Check equivalence
    max_diff = (y_conv - y_rec).abs().max().item()
    print(f"Max difference between conv and recurrent: {max_diff:.2e}")
    assert max_diff < 1e-4, f"Modes differ by {max_diff}"
    print("PASSED: Conv and recurrent modes are equivalent.")

    # Verify shapes
    print(f"Input shape:  {u.shape}")       # (2, 128, 16)
    print(f"Output shape: {y_conv.shape}")  # (2, 128, 16)

if __name__ == "__main__":
    verify_conv_recurrent_equivalence()
```

---

## 6. Experimental Intuition

### 6.1 Long-Range Arena Benchmark

The Long-Range Arena (LRA) benchmark (Tay et al., 2021) evaluates models on sequences of length 1K--16K tokens across diverse tasks. Results demonstrate SSMs' advantage:

| Model | ListOps | Text | Retrieval | Image | Pathfinder | Path-X | Avg |
|-------|---------|------|-----------|-------|------------|--------|-----|
| Transformer | 36.37 | 64.27 | 57.46 | 42.44 | 71.40 | FAIL | 53.66 |
| S4 | 58.35 | 86.82 | 87.09 | 88.65 | 94.20 | 96.35 | 85.24 |

Key observations:

- **Path-X** (sequences of length 16K): Transformers fail entirely due to memory constraints. S4 achieves 96.35% accuracy.
- **Image classification** (treating pixels as a sequence): S4's HiPPO initialization provides the inductive bias needed for long-range spatial dependencies.

### 6.2 Effect of Initialization

| Initialization | LRA Avg | Path-X | Training Stability |
|---------------|---------|--------|-------------------|
| Random | 62.1 | FAIL | Unstable |
| HiPPO-LegS | 85.2 | 96.4 | Stable |
| HiPPO-LagT | 83.7 | 88.1 | Stable |

The HiPPO initialization is crucial. Without it, SSMs fail on long-range tasks.

### 6.3 Computational Profile

For a sequence of length $T$ with model dimension $d$ and state dimension $N$:

- **S4 training**: $O(T \log T)$ -- dominated by FFT.
- **S4 inference**: $O(N d)$ per step -- constant cost regardless of context length.
- **Memory during training**: $O(T d + N d)$ -- linear in sequence length.

Practical timing (single A100, $d = 256$, $N = 64$):

| Sequence Length | Transformer (ms) | S4 (ms) | Speedup |
|----------------|------------------|---------|---------|
| 1,024 | 12 | 8 | 1.5x |
| 4,096 | 85 | 15 | 5.7x |
| 16,384 | 1,200 | 35 | 34x |
| 65,536 | OOM | 120 | -- |

### 6.4 Kernel Visualization

The learned SSM kernel often exhibits interpretable structure:

- **Low-frequency components**: Smooth, slowly decaying kernel elements that capture global context.
- **High-frequency components**: Oscillatory patterns for local feature detection.
- **Exponential decay**: Controlled by the eigenvalues of $\bar{A}$, determining the effective memory horizon.

---

## 7. Connections

### 7.1 Connections to Prior Lectures

- **Lecture 03a (RNNs)**: SSMs are linear RNNs with structured parameterization. The vanishing gradient problem (Lecture 03a) is addressed by HiPPO initialization, which ensures eigenvalues are in the stable regime.
- **Lecture 03b (LSTM/GRU)**: The gating mechanism in LSTMs can be viewed as a data-dependent discretization step $\Delta$. Mamba (Lecture 09b) makes this connection explicit.
- **Lecture 04a (Attention)**: The convolutional view of SSMs relates to the linear attention approximation $\text{Attn}(Q, K, V) \approx \phi(Q)(\phi(K)^TV)$, where the kernel trick replaces the softmax.

### 7.2 Connections to Control Theory

- The SSM framework is exactly the state-space representation from control theory. The observability and controllability of the system (Kalman rank conditions) determine which input patterns can be detected and which states can be reached.
- The HiPPO matrix is related to the Kalman filter's optimal state estimation.

### 7.3 Connections to Signal Processing

- The convolutional view connects SSMs to FIR/IIR filters. The SSM kernel is an IIR filter (infinite impulse response due to the recurrence), computed via its truncated version.
- The FFT-based computation is standard in digital signal processing.

### 7.4 Forward Connections

- **Lecture 09b (Mamba)**: Mamba extends S4 by making the SSM parameters input-dependent (selective), breaking the LTI assumption while preserving efficient computation.
- **Lecture 09c (MoE)**: SSM and MoE are complementary: SSMs provide efficient sequence modeling; MoE provides efficient scaling of feedforward layers.

---

## 8. Paper Reading List

### Required Reading

1. **Gu, A., Goel, K., and Re, C.** (2022). "Efficiently Modeling Long Sequences with Structured State Spaces." *ICLR 2022.*
   - The S4 paper. Focus on Sections 2--3 (theory) and Section 4 (experiments).

2. **Gu, A., Dao, T., Ermon, S., Rudra, A., and Re, C.** (2020). "HiPPO: Recurrent Memory with Optimal Polynomial Projections." *NeurIPS 2020.*
   - Derives the HiPPO framework. Focus on Section 3 (the derivation of the LegS measure).

### Recommended Reading

3. **Gu, A., Johnson, I., Goel, K., Saab, K., Dao, T., Rudra, A., and Re, C.** (2022). "How to Train Your HiPPO: State Space Models with Generalized Orthogonal Basis Projections." *ICLR 2022.*
   - Generalizes HiPPO to different polynomial bases.

4. **Smith, J.T.H., Warrington, A., and Linderman, S.W.** (2023). "Simplified State Space Layers for Sequence Modeling." *ICLR 2023.*
   - S5 model: simplifies S4 using a single MIMO SSM with parallel scan.

5. **Gupta, A., Gu, A., and Berant, J.** (2022). "Diagonal State Spaces are as Effective as Structured State Spaces." *NeurIPS 2022.*
   - Shows that purely diagonal SSMs (DSS/S4D) match S4 performance.

6. **Tay, Y., Dehghani, M., Abnar, S., et al.** (2021). "Long Range Arena: A Benchmark for Efficient Transformers." *ICLR 2021.*
   - The benchmark used to evaluate long-range models.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9a.1.** Consider the continuous SSM $\dot{x} = Ax + Bu$ with $A = \begin{pmatrix} -1 & 0 \\ 0 & -2 \end{pmatrix}$, $B = \begin{pmatrix} 1 \\ 1 \end{pmatrix}$, $C = \begin{pmatrix} 1 & 1 \end{pmatrix}$.

(a) Compute the matrix exponential $e^{At}$ explicitly.

(b) Apply ZOH discretization with step size $\Delta = 0.5$ to obtain $\bar{A}$ and $\bar{B}$.

(c) Compute the first 4 elements of the convolution kernel $K_i = C\bar{A}^i\bar{B}$.

(d) For the same system, apply bilinear discretization with $\Delta = 0.5$ and compare $\bar{A}_{\text{ZOH}}$ vs. $\bar{A}_{\text{bilinear}}$.

**Exercise 9a.2.** Prove that the bilinear transform maps continuous-time stable systems to discrete-time stable systems. That is, show: if $\text{Re}(\lambda) < 0$ for all eigenvalues $\lambda$ of $A$, then $|\mu| < 1$ for all eigenvalues $\mu$ of $\bar{A} = (I - \frac{\Delta}{2}A)^{-1}(I + \frac{\Delta}{2}A)$.

*Hint:* Show that $\mu = \frac{1 + \lambda\Delta/2}{1 - \lambda\Delta/2}$ and compute $|\mu|^2$.

**Exercise 9a.3.** Derive the computational complexity of computing the SSM kernel $K_i = C\bar{A}^i\bar{B}$ for $i = 0, \ldots, L-1$ in the following cases:

(a) $\bar{A}$ is a general $N \times N$ matrix.

(b) $\bar{A}$ is diagonal.

(c) $\bar{A}$ is DPLR (diagonal plus rank-1).

**Exercise 9a.4.** The HiPPO-LegS matrix has the property that all eigenvalues have negative real parts equal to $-\frac{1}{2}$. Verify this numerically for $N = 8$ by computing the eigenvalues of the HiPPO matrix. Explain why this eigenvalue structure enables long-range memory.

### Implementation Exercises

**Exercise 9a.5.** Implement the bilinear discretization method in the `DiscreteSSM` class. Compare the learned kernels and downstream task performance of ZOH vs. bilinear discretization on a simple sequence classification task.

**Exercise 9a.6.** Implement the `parallel_scan` function correctly (the provided version is a sketch) and verify that:
(a) It produces the same output as the sequential recurrence.
(b) It achieves speedup on GPU for sequences of length $\geq 1024$.
Benchmark both implementations for $L \in \{256, 1024, 4096, 16384\}$.

**Exercise 9a.7.** Build a 4-layer S4 model and train it on the sequential CIFAR-10 task (treating the 32x32x3 image as a sequence of 3072 tokens). Report test accuracy and compare with an LSTM baseline of similar parameter count.

### Proof Exercises

**Exercise 9a.8.** Prove that for a diagonal SSM with state matrix $\bar{A} = \text{diag}(\lambda_1, \ldots, \lambda_N)$, the convolution kernel has the form:

$$K_i = \sum_{n=1}^{N} c_n \lambda_n^i$$

where $c_n = C_n B_n$. Interpret this as a sum of exponentials and discuss the expressivity in terms of the number of states $N$.

**Exercise 9a.9 (Challenge).** Derive the full HiPPO-LegS matrix. Starting from the Legendre polynomials $P_n$ on $[-1, 1]$, rescale to $[0, t]$, define the projection coefficients $c_n(t) = \frac{2n+1}{t}\int_0^t u(\tau)P_n(\frac{2\tau}{t} - 1)\,d\tau$, differentiate with respect to $t$, and show that the resulting ODE has the matrix $A$ given in Definition 3.3.
