# Lecture 03a: Recurrent Neural Networks and the Vanishing Gradient Problem

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** the recurrent neural network as a parameterized dynamical system $h_t = f_\theta(h_{t-1}, x_t)$ and write out the full computational graph obtained by unrolling through time.
2. **Derive** the Backpropagation Through Time (BPTT) gradient $\frac{\partial \mathcal{L}}{\partial W_{hh}}$ as a sum over time steps, each involving a product of Jacobians $\prod_{s=t+1}^{T} \frac{\partial h_s}{\partial h_{s-1}}$.
3. **Prove** that $\left\|\frac{\partial h_T}{\partial h_t}\right\| \leq \left(\|W_{hh}\| \cdot \gamma_\sigma\right)^{T-t}$ where $\gamma_\sigma = \sup_z |\sigma'(z)|$, and derive the conditions under which this product vanishes or explodes.
4. **Perform** eigenvalue analysis of $W_{hh}$ to characterize gradient flow regimes.
5. **Implement** gradient clipping (norm and value) and explain its effect on the optimization landscape.
6. **Construct** bidirectional and deep (stacked) RNN architectures and analyze their computational graphs.

---

## 2. Motivation and Context

### 2.1 Why Sequences?

Much of the data we encounter has an inherent sequential structure: natural language (words in a sentence), time series (stock prices, sensor readings), audio (waveforms), and biological sequences (DNA, protein chains). Feedforward networks treat each input independently and require a fixed input dimensionality. We need architectures that can:

- Process inputs of **variable length**.
- Maintain a **memory** of past inputs.
- Share **parameters** across time steps (stationarity assumption).

### 2.2 Historical Context

The idea of recurrent computation in neural networks dates to the early days of connectionism. Jordan (1986) proposed networks with feedback connections from outputs to hidden units. **Elman (1990)** introduced the "simple recurrent network" (SRN), where hidden states feed back to themselves, creating the architecture we study today. This was a conceptual breakthrough: the hidden state acts as a learned, compressed memory of the input history.

However, Elman networks proved difficult to train on long sequences. **Bengio, Simard, and Frasconi (1994)** provided the first rigorous analysis of why: the gradient signal, when propagated backward through many time steps, either vanishes exponentially (making learning of long-range dependencies impossible) or explodes (causing numerical instability). This paper shaped two decades of research into gated architectures (LSTM, GRU) and ultimately motivated the development of attention mechanisms and Transformers.

**Pascanu, Mikolov, and Bengio (2013)** revisited the problem with modern tools, providing a clearer dynamical-systems perspective and practical solutions (gradient clipping).

---

## 3. Core Theory

### 3.1 The Recurrent Neural Network

**Definition 3.1 (Elman RNN).** Given an input sequence $(x_1, x_2, \ldots, x_T)$ with $x_t \in \mathbb{R}^d$, an Elman RNN defines a sequence of hidden states $(h_1, h_2, \ldots, h_T)$ with $h_t \in \mathbb{R}^n$ via the recurrence:

$$h_t = \sigma(W_{hh} h_{t-1} + W_{xh} x_t + b_h)$$

where:

- $W_{hh} \in \mathbb{R}^{n \times n}$ is the hidden-to-hidden (recurrent) weight matrix,
- $W_{xh} \in \mathbb{R}^{n \times d}$ is the input-to-hidden weight matrix,
- $b_h \in \mathbb{R}^n$ is the bias vector,
- $\sigma(\cdot)$ is an element-wise nonlinearity (typically $\tanh$),
- $h_0 \in \mathbb{R}^n$ is the initial hidden state (often set to $\mathbf{0}$).

An output at each time step can be produced as:

$$\hat{y}_t = W_{hy} h_t + b_y$$

where $W_{hy} \in \mathbb{R}^{m \times n}$ and $b_y \in \mathbb{R}^m$.

**Remark.** The parameter set $\theta = \{W_{hh}, W_{xh}, W_{hy}, b_h, b_y\}$ is **shared across all time steps**. This is the key inductive bias: the same transformation is applied at every position in the sequence, analogous to weight sharing in CNNs across spatial locations.

### 3.2 Unrolling Through Time

To analyze the RNN as a standard feedforward computation, we **unroll** the recurrence. The unrolled computational graph for a sequence of length $T$ has $T$ copies of the same recurrent cell, connected by the hidden state:

```
x_1        x_2        x_3            x_T
 |          |          |              |
 v          v          v              v
h_0 --> [Cell] --> [Cell] --> ... --> [Cell] --> h_T
           |          |              |
           v          v              v
          y_1        y_2            y_T
```

Each `[Cell]` applies the same function with the same parameters. This unrolled graph is a deep feedforward network of depth $T$, which explains both the representational power and the training difficulty of RNNs.

### 3.3 Loss and Backpropagation Through Time

Suppose we have a per-step loss $\ell_t = \ell(\hat{y}_t, y_t)$ and the total loss is:

$$\mathcal{L} = \sum_{t=1}^{T} \ell_t$$

We wish to compute $\frac{\partial \mathcal{L}}{\partial W_{hh}}$. By the chain rule:

$$\frac{\partial \mathcal{L}}{\partial W_{hh}} = \sum_{t=1}^{T} \frac{\partial \ell_t}{\partial W_{hh}}$$

For each term, we need to account for the fact that $W_{hh}$ influences $\ell_t$ through every intermediate hidden state $h_1, h_2, \ldots, h_t$:

$$\frac{\partial \ell_t}{\partial W_{hh}} = \sum_{k=1}^{t} \frac{\partial \ell_t}{\partial h_t} \frac{\partial h_t}{\partial h_k} \frac{\partial^+ h_k}{\partial W_{hh}}$$

where $\frac{\partial^+ h_k}{\partial W_{hh}}$ denotes the **immediate** (direct) partial derivative of $h_k$ with respect to $W_{hh}$, treating $h_{k-1}$ as a constant. The crucial term is:

$$\frac{\partial h_t}{\partial h_k} = \prod_{s=k+1}^{t} \frac{\partial h_s}{\partial h_{s-1}}$$

### 3.4 The Jacobian of the State Transition

**Lemma 3.1.** Let $z_s = W_{hh} h_{s-1} + W_{xh} x_s + b_h$. Then:

$$\frac{\partial h_s}{\partial h_{s-1}} = \text{diag}(\sigma'(z_s)) \cdot W_{hh}$$

*Proof.* We have $h_s = \sigma(z_s)$ where $z_s = W_{hh} h_{s-1} + W_{xh} x_s + b_h$. By the chain rule:

$$\frac{\partial h_s}{\partial h_{s-1}} = \frac{\partial \sigma(z_s)}{\partial z_s} \cdot \frac{\partial z_s}{\partial h_{s-1}} = \text{diag}(\sigma'(z_s)) \cdot W_{hh}$$

since $\frac{\partial z_s}{\partial h_{s-1}} = W_{hh}$ and the element-wise nonlinearity has Jacobian $\text{diag}(\sigma'(z_s))$. $\blacksquare$

**Corollary 3.1.** The long-range Jacobian is:

$$\frac{\partial h_T}{\partial h_t} = \prod_{s=t+1}^{T} \text{diag}(\sigma'(z_s)) \cdot W_{hh}$$

### 3.5 Vanishing and Exploding Gradients: Spectral Norm Analysis

**Theorem 3.1 (Gradient Norm Bound).** Let $\gamma_\sigma = \sup_z |\sigma'(z)|$ (for $\tanh$, $\gamma_\sigma = 1$; for sigmoid, $\gamma_\sigma = 1/4$). Then:

$$\left\|\frac{\partial h_T}{\partial h_t}\right\| \leq (\gamma_\sigma \cdot \|W_{hh}\|)^{T-t}$$

where $\|W_{hh}\|$ denotes the spectral norm (largest singular value) of $W_{hh}$.

*Proof.* Using the submultiplicativity of the spectral norm:

$$\left\|\frac{\partial h_T}{\partial h_t}\right\| = \left\|\prod_{s=t+1}^{T} \text{diag}(\sigma'(z_s)) \cdot W_{hh}\right\| \leq \prod_{s=t+1}^{T} \|\text{diag}(\sigma'(z_s))\| \cdot \|W_{hh}\|$$

Now, $\|\text{diag}(\sigma'(z_s))\| = \max_i |\sigma'(z_{s,i})| \leq \gamma_\sigma$. Therefore:

$$\left\|\frac{\partial h_T}{\partial h_t}\right\| \leq \prod_{s=t+1}^{T} \gamma_\sigma \cdot \|W_{hh}\| = (\gamma_\sigma \cdot \|W_{hh}\|)^{T-t}$$

$\blacksquare$

**Corollary 3.2 (Vanishing Gradients).** If $\gamma_\sigma \cdot \|W_{hh}\| < 1$, then:

$$\left\|\frac{\partial h_T}{\partial h_t}\right\| \leq (\gamma_\sigma \cdot \|W_{hh}\|)^{T-t} \xrightarrow{T-t \to \infty} 0$$

The gradient contribution from time step $t$ to the loss at time step $T$ vanishes exponentially in the temporal distance $T - t$.

**Corollary 3.3 (Exploding Gradients).** If the product of Jacobians has spectral norm consistently greater than 1 (which can happen when $\|W_{hh}\|$ is large), the gradient norm grows exponentially.

### 3.6 Eigenvalue Analysis

For deeper insight, consider the case where $\sigma$ is the identity (linear RNN). Then:

$$\frac{\partial h_T}{\partial h_t} = W_{hh}^{T-t}$$

Let $W_{hh} = Q \Lambda Q^{-1}$ be the eigendecomposition (assuming diagonalizability). Then $W_{hh}^{T-t} = Q \Lambda^{T-t} Q^{-1}$, and:

$$\|W_{hh}^{T-t}\| \approx |\lambda_{\max}|^{T-t}$$

where $\lambda_{\max}$ is the eigenvalue with largest absolute value (the spectral radius $\rho(W_{hh})$).

- If $\rho(W_{hh}) < 1$: gradients vanish.
- If $\rho(W_{hh}) > 1$: gradients explode.
- If $\rho(W_{hh}) = 1$: gradients are preserved (but this is a measure-zero set and unstable under perturbation).

For nonlinear RNNs, the analysis extends via the **effective spectral radius** of the time-varying linear maps $\text{diag}(\sigma'(z_s)) W_{hh}$. The qualitative picture remains: the eigenvalue structure of $W_{hh}$ combined with the saturation behavior of $\sigma$ determines gradient flow.

**Theorem 3.2 (Bengio et al., 1994 - Sufficient Condition for Vanishing Gradients).** For $\sigma = \tanh$, the gradient vanishes whenever:

$$\|W_{hh}\| < \frac{1}{\gamma_\sigma} = 1$$

In practice, since $\tanh$ saturates (i.e., $|\sigma'(z)| \ll 1$ for $|z|$ large), gradients vanish even when $\|W_{hh}\| \geq 1$ because the effective spectral radius is reduced by the diagonal scaling $\text{diag}(\sigma'(z_s))$.

### 3.7 The Geometry of the Loss Surface

Pascanu et al. (2013) showed that the loss surface of RNNs contains **high-curvature walls**. When the hidden-to-hidden weight matrix has spectral radius near 1, small changes in parameters can cause the gradient to suddenly transition from vanishing to exploding. This creates cliffs in the loss landscape where a single gradient step can catapult the parameters to a bad region.

This geometric picture motivates gradient clipping as a practical remedy.

---

## 4. Algorithmic Derivation

### 4.1 Backpropagation Through Time (BPTT)

```
Algorithm: BPTT for Elman RNN
------------------------------
Input: sequence (x_1, ..., x_T), targets (y_1, ..., y_T), parameters theta
Output: gradients d_theta

# Forward pass
h_0 = 0
for t = 1 to T:
    z_t = W_hh @ h_{t-1} + W_xh @ x_t + b_h         # O(n^2 + nd)
    h_t = sigma(z_t)                                    # O(n)
    y_hat_t = W_hy @ h_t + b_y                          # O(mn)
    L_t = loss(y_hat_t, y_t)                             # O(m)

# Backward pass
dW_hh = 0, dW_xh = 0, dW_hy = 0, db_h = 0, db_y = 0
dh_next = 0   # gradient flowing from the future

for t = T down to 1:
    # Gradient from output
    dy_hat_t = d_loss(y_hat_t, y_t)                      # O(m)
    dW_hy += dy_hat_t @ h_t^T                            # O(mn)
    db_y += dy_hat_t                                     # O(m)
    dh_t = W_hy^T @ dy_hat_t + dh_next                  # O(mn)

    # Gradient through nonlinearity
    dz_t = dh_t * sigma'(z_t)                            # O(n), element-wise

    # Parameter gradients (immediate partials)
    dW_hh += dz_t @ h_{t-1}^T                           # O(n^2)
    dW_xh += dz_t @ x_t^T                               # O(nd)
    db_h += dz_t                                         # O(n)

    # Gradient to pass backward in time
    dh_next = W_hh^T @ dz_t                             # O(n^2)

return {dW_hh, dW_xh, dW_hy, db_h, db_y}
```

**Complexity Analysis:**

- Time: $O(T \cdot (n^2 + nd + mn))$ for both forward and backward passes.
- Space: $O(T \cdot n)$ to store all hidden states (needed for backward pass). This is the main memory bottleneck for long sequences.

### 4.2 Gradient Clipping

**Algorithm: Norm Clipping (Pascanu et al., 2013)**

```
Input: gradient g, threshold tau
Output: clipped gradient g_clipped

norm_g = ||g||_2
if norm_g > tau:
    g_clipped = (tau / norm_g) * g
else:
    g_clipped = g
```

This rescales the gradient to have norm at most $\tau$ whenever it exceeds $\tau$. It preserves the direction of the gradient but controls its magnitude.

**Algorithm: Value Clipping**

```
Input: gradient g, threshold tau
Output: clipped gradient g_clipped

g_clipped = clip(g, -tau, tau)    # element-wise
```

This clips each element independently. It does **not** preserve gradient direction. Norm clipping is generally preferred because it maintains the relative importance of different gradient components.

### 4.3 Orthogonal Initialization

To start training near $\rho(W_{hh}) = 1$, initialize $W_{hh}$ as an orthogonal matrix (all singular values equal to 1):

```
W_hh = random orthogonal matrix of size n x n
```

This ensures that at initialization, the linear component of the Jacobian preserves gradient norms.

---

## 5. PyTorch Implementation

### 5.1 Vanilla RNN Cell from Scratch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class VanillaRNNCell(nn.Module):
    """
    Single RNN cell: h_t = tanh(W_hh h_{t-1} + W_xh x_t + b)
    """
    def __init__(self, input_size: int, hidden_size: int):
        super().__init__()
        self.input_size = input_size    # d
        self.hidden_size = hidden_size  # n

        # Combined weight matrix for efficiency: [W_xh; W_hh]
        # Shape: (hidden_size, input_size + hidden_size) = (n, d+n)
        self.W_xh = nn.Parameter(torch.randn(hidden_size, input_size) / input_size**0.5)
        self.W_hh = nn.Parameter(torch.empty(hidden_size, hidden_size))
        self.bias = nn.Parameter(torch.zeros(hidden_size))  # (n,)

        # Orthogonal initialization for recurrent weights
        nn.init.orthogonal_(self.W_hh)

    def forward(self, x_t: torch.Tensor, h_prev: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x_t:    (batch_size, input_size)    = (B, d)
            h_prev: (batch_size, hidden_size)   = (B, n)
        Returns:
            h_t:    (batch_size, hidden_size)   = (B, n)
        """
        # z_t = W_hh h_{t-1} + W_xh x_t + b
        # (B, n) = (B, d)@(d, n) + (B, n)@(n, n) + (n,)
        z_t = x_t @ self.W_xh.t() + h_prev @ self.W_hh.t() + self.bias
        h_t = torch.tanh(z_t)  # (B, n)
        return h_t

class VanillaRNN(nn.Module):
    """
    Full RNN that processes a sequence and returns all hidden states.
    """
    def __init__(self, input_size: int, hidden_size: int, output_size: int):
        super().__init__()
        self.hidden_size = hidden_size
        self.cell = VanillaRNNCell(input_size, hidden_size)
        self.output_proj = nn.Linear(hidden_size, output_size)  # W_hy: (m, n)

    def forward(self, x: torch.Tensor, h_0: torch.Tensor = None) -> tuple:
        """
        Args:
            x:   (batch_size, seq_len, input_size)  = (B, T, d)
            h_0: (batch_size, hidden_size)           = (B, n), optional
        Returns:
            outputs: (batch_size, seq_len, output_size) = (B, T, m)
            h_T:     (batch_size, hidden_size)          = (B, n)
        """
        B, T, d = x.shape
        if h_0 is None:
            h_0 = torch.zeros(B, self.hidden_size, device=x.device)  # (B, n)

        h_t = h_0
        outputs = []
        for t in range(T):
            h_t = self.cell(x[:, t, :], h_t)    # (B, n)
            out_t = self.output_proj(h_t)         # (B, m)
            outputs.append(out_t)

        outputs = torch.stack(outputs, dim=1)     # (B, T, m)
        return outputs, h_t
```

### 5.2 Gradient Clipping in Practice

```python
def train_step(model, optimizer, x, y, clip_value=1.0):
    """
    Single training step with gradient norm clipping.

    Args:
        model: RNN model
        optimizer: e.g., torch.optim.Adam
        x: (B, T, d) input tensor
        y: (B, T, m) target tensor
        clip_value: max gradient norm
    """
    optimizer.zero_grad()
    outputs, _ = model(x)                          # (B, T, m)
    loss = F.cross_entropy(
        outputs.reshape(-1, outputs.size(-1)),      # (B*T, m)
        y.reshape(-1)                               # (B*T,)
    )
    loss.backward()

    # Gradient norm clipping
    total_norm = torch.nn.utils.clip_grad_norm_(
        model.parameters(), max_norm=clip_value
    )

    optimizer.step()
    return loss.item(), total_norm.item()
```

### 5.3 Monitoring Gradient Flow

```python
def monitor_gradient_norms(model, x, y):
    """
    Compute and return the gradient norm of W_hh at each time step.
    This requires manual BPTT to inspect per-step gradients.
    """
    B, T, d = x.shape
    n = model.hidden_size
    cell = model.cell

    # Forward pass storing all hidden states with grad tracking
    h = [torch.zeros(B, n, device=x.device)]
    for t in range(T):
        h_t = cell(x[:, t, :], h[-1])
        h.append(h_t)

    # Compute loss at final step for simplicity
    logits = model.output_proj(h[-1])                  # (B, m)
    loss = F.cross_entropy(logits, y[:, -1])

    # Compute gradient of loss w.r.t. each hidden state
    grad_norms = []
    for t in range(1, T + 1):
        if h[t].requires_grad:
            grad = torch.autograd.grad(
                loss, h[t], retain_graph=True
            )[0]
            grad_norms.append(grad.norm().item())

    return grad_norms  # List of T floats
```

### 5.4 Bidirectional RNN

```python
class BidirectionalRNN(nn.Module):
    """
    Bidirectional RNN: runs one RNN forward, one backward,
    concatenates hidden states.
    """
    def __init__(self, input_size: int, hidden_size: int, output_size: int):
        super().__init__()
        self.hidden_size = hidden_size
        self.cell_fwd = VanillaRNNCell(input_size, hidden_size)
        self.cell_bwd = VanillaRNNCell(input_size, hidden_size)
        # Output projection from concatenated states: 2n -> m
        self.output_proj = nn.Linear(2 * hidden_size, output_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (B, T, d)
        Returns:
            outputs: (B, T, m)
        """
        B, T, d = x.shape
        device = x.device

        # Forward pass
        h_fwd = torch.zeros(B, self.hidden_size, device=device)  # (B, n)
        fwd_states = []
        for t in range(T):
            h_fwd = self.cell_fwd(x[:, t, :], h_fwd)  # (B, n)
            fwd_states.append(h_fwd)

        # Backward pass (reverse time)
        h_bwd = torch.zeros(B, self.hidden_size, device=device)  # (B, n)
        bwd_states = []
        for t in range(T - 1, -1, -1):
            h_bwd = self.cell_bwd(x[:, t, :], h_bwd)  # (B, n)
            bwd_states.insert(0, h_bwd)

        # Concatenate and project
        fwd_tensor = torch.stack(fwd_states, dim=1)   # (B, T, n)
        bwd_tensor = torch.stack(bwd_states, dim=1)   # (B, T, n)
        combined = torch.cat([fwd_tensor, bwd_tensor], dim=2)  # (B, T, 2n)
        outputs = self.output_proj(combined)           # (B, T, m)
        return outputs
```

### 5.5 Deep (Stacked) RNN

```python
class DeepRNN(nn.Module):
    """
    Multi-layer RNN: stack L recurrent layers.
    Layer l receives the hidden states of layer l-1 as input.
    """
    def __init__(self, input_size: int, hidden_size: int,
                 output_size: int, num_layers: int = 2,
                 dropout: float = 0.0):
        super().__init__()
        self.num_layers = num_layers
        self.hidden_size = hidden_size

        self.cells = nn.ModuleList()
        for l in range(num_layers):
            in_size = input_size if l == 0 else hidden_size
            self.cells.append(VanillaRNNCell(in_size, hidden_size))

        self.dropout = nn.Dropout(dropout)
        self.output_proj = nn.Linear(hidden_size, output_size)

    def forward(self, x: torch.Tensor) -> tuple:
        """
        Args:
            x: (B, T, d)
        Returns:
            outputs: (B, T, m)
            h_final: list of (B, n) for each layer
        """
        B, T, d = x.shape
        device = x.device

        # Initialize hidden states for all layers
        h = [torch.zeros(B, self.hidden_size, device=device)
             for _ in range(self.num_layers)]  # Each: (B, n)

        outputs = []
        for t in range(T):
            inp = x[:, t, :]                         # (B, d)
            for l in range(self.num_layers):
                h[l] = self.cells[l](inp, h[l])      # (B, n)
                inp = h[l]
                if l < self.num_layers - 1:
                    inp = self.dropout(inp)           # (B, n)
            outputs.append(self.output_proj(h[-1]))   # (B, m)

        outputs = torch.stack(outputs, dim=1)         # (B, T, m)
        return outputs, h
```

---

## 6. Experimental Intuition

### 6.1 Vanishing Gradients in Practice

**Experiment:** Train a vanilla RNN on a sequence copying task: given input at $t=1$, produce it as output at $t=T$ for varying $T$.

| Sequence Length $T$ | Vanilla RNN Accuracy | Training Convergence |
|---------------------|---------------------|----------------------|
| 10                  | ~98%                | ~500 steps           |
| 50                  | ~60%                | ~5000 steps          |
| 100                 | ~20%                | Does not converge    |
| 200                 | Random chance       | Does not converge    |

The RNN cannot learn to carry information across more than ~50 time steps. This is the vanishing gradient problem in action.

### 6.2 Gradient Norm Dynamics

When training an RNN, monitor `||dL/dW_hh||` over time. You will observe:

1. **Spikes**: sudden increases of 2-3 orders of magnitude, corresponding to the loss surface cliffs described by Pascanu et al.
2. **Plateau regions**: long stretches where the gradient norm is very small, indicating vanishing gradients.
3. **Instability without clipping**: without gradient clipping, a single spike can push parameters into a region from which recovery is impossible.

### 6.3 Hyperparameter Guidance

| Hyperparameter | Recommended Range | Notes |
|----------------|-------------------|-------|
| Hidden size | 128-512 | Larger helps capacity but worsens vanishing gradients |
| Learning rate | 1e-3 to 1e-2 | RNNs are sensitive; use LR warmup |
| Gradient clip norm | 1.0-5.0 | Essential for stable training |
| Initialization | Orthogonal for $W_{hh}$ | Helps gradient flow at initialization |
| Optimizer | Adam or RMSProp | SGD struggles with RNNs |

### 6.4 Failure Modes

1. **NaN loss**: almost always due to exploding gradients. Apply gradient clipping.
2. **Training loss plateaus early**: vanishing gradients. Consider LSTM/GRU (next lecture).
3. **Overfitting on short sequences, failing on long**: the model has not learned long-range dependencies. Fundamental limitation of vanilla RNNs.
4. **Hidden state saturation**: if most components of $h_t$ are near $\pm 1$ (for tanh), then $\sigma'(z_t) \approx 0$ everywhere, causing permanent vanishing gradients. Regularize or reduce learning rate.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Modules

- **Module 01 (MLPs and Backpropagation)**: BPTT is simply backpropagation applied to the unrolled computational graph. The same chain rule mechanics apply; the only difference is parameter sharing across "layers" (time steps).
- **Module 02 (CNNs)**: CNNs share parameters across spatial positions; RNNs share across temporal positions. Both are inductive biases for structured data. 1D convolutions can also process sequences and avoid vanishing gradients but lack the dynamic memory of recurrent states.

### 7.2 Links to Future Modules

- **Lecture 03b (LSTM/GRU)**: The vanishing gradient problem directly motivates gated architectures, which introduce additive gradient paths.
- **Module 04 (Transformers)**: Attention mechanisms bypass the sequential bottleneck entirely, allowing direct gradient flow between any two time steps. Understanding *why* RNNs fail is essential to appreciating *why* Transformers succeed.

### 7.3 Extensions

- **Echo State Networks / Reservoir Computing**: Fix $W_{hh}$ and only train the output projection. Avoids the training problem entirely at the cost of expressiveness.
- **Unitary/Orthogonal RNNs** (Arjovsky et al., 2016): Constrain $W_{hh}$ to be unitary, ensuring $\rho(W_{hh}) = 1$. Provably avoids vanishing/exploding gradients in the linear case.
- **IndRNN** (Li et al., 2018): Restrict $W_{hh}$ to be diagonal, simplifying the eigenvalue analysis and enabling very deep RNNs.

---

## 8. Seminal Paper Reading List

### Required

1. **Elman, J. L. (1990).** "Finding Structure in Time." *Cognitive Science*, 14(2), 179-211.
   - *Introduced the simple recurrent network. Read for historical context and the original motivation.*

2. **Bengio, Y., Simard, P., & Frasconi, P. (1994).** "Learning Long-Term Dependencies with Gradient Descent is Difficult." *IEEE Transactions on Neural Networks*, 5(2), 157-166.
   - *The foundational analysis of vanishing/exploding gradients. Read Sections 2-4 carefully for the proofs.*

3. **Pascanu, R., Mikolov, T., & Bengio, Y. (2013).** "On the Difficulty of Training Recurrent Neural Networks." *ICML 2013*.
   - *Modern treatment with dynamical systems perspective and gradient clipping. Read in full.*

### Recommended

4. **Hochreiter, S. (1991).** "Untersuchungen zu dynamischen neuronalen Netzen." Diploma thesis, TU Munich.
   - *The original discovery of the vanishing gradient problem, predating Bengio et al.*

5. **Arjovsky, M., Shah, A., & Bengio, Y. (2016).** "Unitary Evolution Recurrent Neural Networks." *ICML 2016*.
   - *Unitary constraints on recurrent weights to control gradient flow.*

6. **Tallec, C., & Ollivier, Y. (2018).** "Can Recurrent Neural Networks Warp Time?" *ICLR 2018*.
   - *Chrono initialization and temporal flexibility in RNNs.*

---

## 9. Exercises

### Theory

**Exercise 3a.1.** Consider a linear RNN (no nonlinearity): $h_t = W_{hh} h_{t-1} + W_{xh} x_t$. Let $W_{hh}$ have eigenvalues $\lambda_1, \ldots, \lambda_n$.

(a) Show that $\frac{\partial h_T}{\partial h_0} = W_{hh}^T$.

(b) Prove that $\|W_{hh}^T\|_2 = \sigma_{\max}(W_{hh})^T$ where $\sigma_{\max}$ is the largest singular value.

(c) If $W_{hh}$ is symmetric, show that $\sigma_{\max} = |\lambda_{\max}|$ and the gradient vanishes/explodes according to $|\lambda_{\max}| \lessgtr 1$.

**Exercise 3a.2.** For $\sigma = \tanh$, show that $\gamma_\sigma = 1$ and that this bound is achieved only at $z = 0$. Argue informally why, in practice, the effective scaling factor is much less than 1 after several time steps.

**Exercise 3a.3.** Let $W_{hh} \in \mathbb{R}^{2 \times 2}$ with eigenvalues $\lambda_1 = 0.95$ and $\lambda_2 = 0.5$. Compute an upper bound on $\left\|\frac{\partial h_{100}}{\partial h_0}\right\|$ for a linear RNN. What fraction of the gradient is lost compared to $t=0$?

**Exercise 3a.4.** Prove that norm clipping $g \mapsto \frac{\tau}{\|g\|} g$ (when $\|g\| > \tau$) is equivalent to projecting $g$ onto the $\ell_2$ ball of radius $\tau$, and that this projection is the solution to $\min_{\|g'\| \leq \tau} \|g' - g\|_2$.

**Exercise 3a.5.** Show that for an orthogonal matrix $Q$, $Q^T = Q^{T}$ has all singular values equal to 1 for any power $T$. Explain why orthogonal initialization helps but does not fully solve the vanishing gradient problem for nonlinear RNNs.

### Implementation

**Exercise 3a.6.** Implement the gradient monitoring function from Section 5.3. Train a vanilla RNN on a sequence memorization task (input a random bit at $t=0$, output it at $t=T$). Plot the gradient norm at each time step for $T \in \{10, 20, 50, 100\}$. Verify that the gradient at early time steps vanishes exponentially.

**Exercise 3a.7.** Implement gradient clipping from scratch (do not use `torch.nn.utils.clip_grad_norm_`). Train a vanilla RNN on the Penn Treebank character-level language modeling task with and without clipping. Plot the training loss and gradient norm over time for both cases.

**Exercise 3a.8.** Implement a bidirectional RNN and train it on a POS-tagging task (e.g., using the Universal Dependencies dataset). Compare its accuracy to a unidirectional RNN and explain the difference in terms of the information available at each time step.
