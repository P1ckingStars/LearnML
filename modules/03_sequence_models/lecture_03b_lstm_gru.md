# Lecture 03b: Long Short-Term Memory (LSTM) and Gated Recurrent Unit (GRU)

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Derive** all four gate equations of the LSTM cell (forget, input, output, cell update) from first principles, understanding each gate's role in controlling information flow.
2. **Prove** that the LSTM cell state gradient flow is **additive** rather than multiplicative, and formally show why this resolves the vanishing gradient problem.
3. **Compute** the full backward pass through an LSTM cell, deriving gradients with respect to all parameters and gate activations.
4. **Explain** peephole connections and their effect on the gradient dynamics.
5. **Derive** the GRU as a simplification of the LSTM within a general gated RNN framework.
6. **Compare** LSTM and GRU empirically and theoretically, identifying regimes where each is preferred.
7. **Implement** both architectures from scratch in PyTorch with correct initialization.

---

## 2. Motivation and Context

### 2.1 The Problem

In Lecture 03a, we proved that vanilla RNNs suffer from vanishing gradients: the Jacobian product $\prod_{s} \text{diag}(\sigma'(z_s)) W_{hh}$ contracts exponentially when $\gamma_\sigma \|W_{hh}\| < 1$. This makes it impossible to learn dependencies spanning more than ~20 time steps in practice.

The core issue is that information in the hidden state is transformed **multiplicatively** at every step. Even if each individual transformation is close to the identity, the composition of many such transformations either contracts or expands exponentially.

### 2.2 The Key Insight: Additive Memory

**Hochreiter and Schmidhuber (1997)** proposed a radical solution: introduce a separate **cell state** $c_t$ that is updated **additively** rather than multiplicatively. Instead of $c_t = f(c_{t-1})$, the update takes the form:

$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$$

where $f_t, i_t \in (0, 1)^n$ are learned gates that control how much of the old cell state to retain and how much new information to add. When $f_t \approx 1$ and $i_t \approx 0$, the cell state is carried forward unchanged, and the gradient flows backward without attenuation.

This is analogous to the **residual connection** $y = x + F(x)$ in ResNets (He et al., 2016), which was proposed nearly two decades later. The LSTM can be viewed as the first architecture to implement the "identity shortcut" principle.

### 2.3 Historical Timeline

- **1991**: Hochreiter identifies the vanishing gradient problem (diploma thesis).
- **1994**: Bengio et al. publish the formal analysis.
- **1997**: Hochreiter & Schmidhuber publish the LSTM.
- **2000**: Gers, Schmidhuber, & Cummins add the **forget gate** (the original LSTM had no forget gate and could only accumulate information).
- **2000**: Gers & Schmidhuber add **peephole connections**.
- **2014**: Cho et al. propose the **GRU** as a simpler alternative.
- **2015**: Greff et al. conduct a large-scale empirical comparison of LSTM variants.
- **2017**: Greff et al. (JMLR version) provide a comprehensive LSTM survey.

---

## 3. Core Theory

### 3.1 The LSTM Cell

**Definition 3.2 (LSTM Cell).** Given input $x_t \in \mathbb{R}^d$ and previous hidden state $h_{t-1} \in \mathbb{R}^n$ and cell state $c_{t-1} \in \mathbb{R}^n$, the LSTM computes:

**Forget gate** (what to erase from cell state):
$$f_t = \sigma(W_f [h_{t-1}, x_t] + b_f)$$

**Input gate** (what new information to write):
$$i_t = \sigma(W_i [h_{t-1}, x_t] + b_i)$$

**Candidate cell state** (proposed new content):
$$\tilde{c}_t = \tanh(W_c [h_{t-1}, x_t] + b_c)$$

**Cell state update** (the critical additive update):
$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$$

**Output gate** (what to expose from cell state):
$$o_t = \sigma(W_o [h_{t-1}, x_t] + b_o)$$

**Hidden state** (the output of this time step):
$$h_t = o_t \odot \tanh(c_t)$$

Here:
- $[h_{t-1}, x_t]$ denotes concatenation, yielding a vector in $\mathbb{R}^{n+d}$.
- $W_f, W_i, W_c, W_o \in \mathbb{R}^{n \times (n+d)}$ are weight matrices.
- $b_f, b_i, b_c, b_o \in \mathbb{R}^n$ are bias vectors.
- $\sigma(\cdot)$ is the element-wise sigmoid function.
- $\odot$ denotes the Hadamard (element-wise) product.

**Notation.** We can write the LSTM more compactly. Let $\mathbf{x}_t = [h_{t-1}, x_t] \in \mathbb{R}^{n+d}$ and stack all weight matrices:

$$\begin{pmatrix} \bar{f}_t \\ \bar{i}_t \\ \bar{c}_t \\ \bar{o}_t \end{pmatrix} = W \mathbf{x}_t + b$$

where $W \in \mathbb{R}^{4n \times (n+d)}$ and $b \in \mathbb{R}^{4n}$. Then apply $\sigma$ to the first three $n$-blocks and $\tanh$ to the third.

### 3.2 Why LSTM Solves Vanishing Gradients

**Theorem 3.3 (LSTM Gradient Flow Through Cell State).** The gradient of the loss with respect to the cell state at time $t$, propagated from time $T > t$, satisfies:

$$\frac{\partial c_T}{\partial c_t} = \prod_{s=t+1}^{T} \left(\text{diag}(f_s) + \Delta_s\right)$$

where $\Delta_s$ collects the indirect dependencies through the gates. In the simplified case where we ignore the dependence of the gates on $c$ (no peephole connections), this reduces to:

$$\frac{\partial c_T}{\partial c_t} = \prod_{s=t+1}^{T} \text{diag}(f_s)$$

*Proof.* Consider the cell state update:

$$c_s = f_s \odot c_{s-1} + i_s \odot \tilde{c}_s$$

Taking the partial derivative with respect to $c_{s-1}$, and noting that $f_s, i_s, \tilde{c}_s$ depend on $h_{s-1}$ (and thus indirectly on $c_{s-1}$ through $h_{s-1} = o_{s-1} \odot \tanh(c_{s-1})$), we get:

$$\frac{\partial c_s}{\partial c_{s-1}} = \text{diag}(f_s) + \frac{\partial c_s}{\partial h_{s-1}} \cdot \frac{\partial h_{s-1}}{\partial c_{s-1}}$$

The first term $\text{diag}(f_s)$ is the **direct additive path**: it is diagonal with entries in $(0, 1)$.

The second term captures indirect paths through the gates. Crucially, the first term is the dominant contribution, and when $f_s \approx 1$, the gradient flows through the cell state nearly unchanged.

For the product over $T - t$ steps:

$$\frac{\partial c_T}{\partial c_t} = \prod_{s=t+1}^{T} \text{diag}(f_s)$$

Each factor is diagonal with entries in $(0, 1)$. The $(j, j)$-entry of this product is:

$$\left[\frac{\partial c_T}{\partial c_t}\right]_{jj} = \prod_{s=t+1}^{T} f_{s,j}$$

If the forget gates are close to 1 (i.e., $f_{s,j} \approx 1$ for most $s$), this product stays close to 1, and the gradient does not vanish. $\blacksquare$

**Contrast with Vanilla RNN:** In the vanilla RNN, the analogous quantity is $\prod_{s} \text{diag}(\sigma'(z_s)) W_{hh}$. The presence of the full matrix $W_{hh}$ means the product involves matrix-matrix multiplications, and the spectral properties of $W_{hh}$ dominate. In the LSTM, the cell-state path involves only **diagonal** matrices, eliminating the spectral radius issue.

**Remark.** The LSTM does not prevent the gradient from vanishing through the hidden state $h_t$. The gradient through $h_t$ still involves matrix multiplications. However, the cell state provides a **highway** for gradient flow that bypasses these bottlenecks.

### 3.3 Full Backward Pass Through LSTM

We derive the gradients step by step. Let $\delta h_t = \frac{\partial \mathcal{L}}{\partial h_t}$ be the incoming gradient to $h_t$ (from both the output loss and the next time step). Let $\delta c_t^{\text{next}}$ be the gradient flowing back through the cell state from step $t+1$.

**Step 1: Gradient through the hidden state output.**

$$h_t = o_t \odot \tanh(c_t)$$

$$\delta o_t = \delta h_t \odot \tanh(c_t)$$
$$\delta c_t^{(h)} = \delta h_t \odot o_t \odot (1 - \tanh^2(c_t))$$

The total cell state gradient is:

$$\delta c_t = \delta c_t^{(h)} + \delta c_t^{\text{next}}$$

**Step 2: Gradient through the cell state update.**

$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$$

$$\delta f_t = \delta c_t \odot c_{t-1}$$
$$\delta i_t = \delta c_t \odot \tilde{c}_t$$
$$\delta \tilde{c}_t = \delta c_t \odot i_t$$
$$\delta c_{t-1}^{\text{next}} = \delta c_t \odot f_t \quad \text{(this is } \delta c_t^{\text{next}} \text{ for step } t-1\text{)}$$

**Step 3: Gradient through the gate activations.**

Each gate has the form $g = \sigma(\bar{g})$ or $g = \tanh(\bar{g})$ where $\bar{g} = W_g \mathbf{x}_t + b_g$.

$$\delta \bar{f}_t = \delta f_t \odot f_t \odot (1 - f_t) \quad \text{(sigmoid derivative)}$$
$$\delta \bar{i}_t = \delta i_t \odot i_t \odot (1 - i_t)$$
$$\delta \bar{o}_t = \delta o_t \odot o_t \odot (1 - o_t)$$
$$\delta \bar{c}_t = \delta \tilde{c}_t \odot (1 - \tilde{c}_t^2) \quad \text{(tanh derivative)}$$

**Step 4: Gradient with respect to parameters and inputs.**

Stack the pre-activation gradients: $\delta \bar{z}_t = [\delta \bar{f}_t; \delta \bar{i}_t; \delta \bar{c}_t; \delta \bar{o}_t] \in \mathbb{R}^{4n}$.

$$\delta W = \delta \bar{z}_t \cdot \mathbf{x}_t^T \quad \in \mathbb{R}^{4n \times (n+d)}$$
$$\delta b = \delta \bar{z}_t \quad \in \mathbb{R}^{4n}$$
$$\delta \mathbf{x}_t = W^T \delta \bar{z}_t \quad \in \mathbb{R}^{n+d}$$

From $\delta \mathbf{x}_t$, extract:
$$\delta h_{t-1}^{\text{next}} = \delta \mathbf{x}_t[0:n]$$
$$\delta x_t = \delta \mathbf{x}_t[n:n+d]$$

### 3.4 Peephole Connections

**Definition 3.3 (Peephole LSTM, Gers & Schmidhuber, 2000).** In peephole LSTMs, the gates have direct access to the cell state:

$$f_t = \sigma(W_f [h_{t-1}, x_t] + w_{f,p} \odot c_{t-1} + b_f)$$
$$i_t = \sigma(W_i [h_{t-1}, x_t] + w_{i,p} \odot c_{t-1} + b_i)$$
$$o_t = \sigma(W_o [h_{t-1}, x_t] + w_{o,p} \odot c_t + b_o)$$

where $w_{f,p}, w_{i,p}, w_{o,p} \in \mathbb{R}^n$ are peephole weight vectors. Note that $f_t$ and $i_t$ use $c_{t-1}$ while $o_t$ uses the updated $c_t$.

**Effect on gradient flow:** Peephole connections modify $\frac{\partial c_s}{\partial c_{s-1}}$ by adding terms from the gate derivatives that depend on $c_{s-1}$. This can improve the network's ability to learn precise timing, but empirically the gains are often marginal (Greff et al., 2017).

### 3.5 The Gated Recurrent Unit (GRU)

**Definition 3.4 (GRU, Cho et al., 2014).** The GRU simplifies the LSTM by merging the cell state and hidden state into a single state $h_t$ and using two gates instead of three:

**Reset gate** (controls how much of the previous state to forget for the candidate computation):
$$r_t = \sigma(W_r [h_{t-1}, x_t] + b_r)$$

**Update gate** (controls the interpolation between old and new state):
$$z_t = \sigma(W_z [h_{t-1}, x_t] + b_z)$$

**Candidate hidden state** (uses the reset gate to mask previous state):
$$\tilde{h}_t = \tanh(W_h [r_t \odot h_{t-1}, x_t] + b_h)$$

**Hidden state update** (convex combination):
$$h_t = (1 - z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t$$

Here:
- $W_r, W_z, W_h \in \mathbb{R}^{n \times (n+d)}$ are weight matrices.
- $b_r, b_z, b_h \in \mathbb{R}^n$ are bias vectors.

### 3.6 GRU as a Special Case of a General Gated Framework

**Theorem 3.4.** Both LSTM and GRU can be derived as special cases of a general gated recurrent framework.

*Proof.* Define a general gated RNN with memory state $m_t$, output state $h_t$, and $K$ gates $g_t^{(k)}$:

$$m_t = \alpha_t \odot m_{t-1} + \beta_t \odot \tilde{m}_t$$
$$h_t = \gamma_t \odot \phi(m_t)$$

where $\alpha_t, \beta_t, \gamma_t$ are gate vectors derived from the inputs and states, and $\tilde{m}_t$ is a candidate state.

**LSTM instantiation:**
- $m_t = c_t$ (cell state), $h_t$ is the hidden state.
- $\alpha_t = f_t$ (forget gate), $\beta_t = i_t$ (input gate): **independent** gates.
- $\gamma_t = o_t$ (output gate), $\phi = \tanh$.
- 4 parameter matrices, 3 independent gates.

**GRU instantiation:**
- $m_t = h_t$ (no separate cell state).
- $\alpha_t = (1 - z_t)$, $\beta_t = z_t$: **coupled** gates ($\alpha + \beta = 1$).
- $\gamma_t = I$ (identity, no output gate), $\phi = \text{id}$.
- 3 parameter matrices, 2 independent gates.
- Additionally, the reset gate $r_t$ modifies the candidate computation.

The GRU enforces the constraint $\alpha_t + \beta_t = 1$ (convex combination), which means the GRU hidden state update is always an interpolation between the old state and the candidate. The LSTM allows $f_t + i_t \neq 1$, giving it more flexibility (the cell state can grow or shrink in magnitude). $\blacksquare$

### 3.7 Gradient Flow in GRU

**Proposition 3.1.** The gradient of $h_T$ with respect to $h_t$ through the GRU update has the form:

$$\frac{\partial h_T}{\partial h_t} = \prod_{s=t+1}^{T} \left(\text{diag}(1 - z_s) + \Gamma_s\right)$$

where $\Gamma_s$ collects terms from the dependence of $z_s$ and $\tilde{h}_s$ on $h_{s-1}$.

The leading term $\text{diag}(1 - z_s)$ plays the same role as the forget gate in the LSTM. When $z_s \approx 0$ (update gate is off), the gradient flows through unchanged.

### 3.8 LSTM vs GRU: Theoretical Comparison

| Property | LSTM | GRU |
|----------|------|-----|
| Parameters per cell | $4n(n+d) + 4n$ | $3n(n+d) + 3n$ |
| Separate memory (cell) state | Yes ($c_t$) | No |
| Forget and input coupling | Independent ($f_t, i_t$) | Coupled ($z_t, 1-z_t$) |
| Output gating | Yes ($o_t$) | No |
| Gradient highway | Through $c_t$ | Through $h_t$ directly |
| Memory capacity | Can store info indefinitely if $f_t = 1$ | Interpolation constrains capacity |

---

## 4. Algorithmic Derivation

### 4.1 LSTM Forward Pass

```
Algorithm: LSTM Forward Pass
-----------------------------
Input: sequence (x_1, ..., x_T), initial states h_0, c_0
Output: hidden states (h_1, ..., h_T), cell states (c_1, ..., c_T)

for t = 1 to T:
    # Concatenate inputs
    X_t = [h_{t-1}; x_t]                 # (n+d,)

    # Compute all gates in one matrix multiply
    Z_t = W @ X_t + b                     # (4n,)    O(n(n+d))

    # Split and apply activations
    f_t = sigmoid(Z_t[0:n])               # (n,)     Forget gate
    i_t = sigmoid(Z_t[n:2n])              # (n,)     Input gate
    c_tilde = tanh(Z_t[2n:3n])            # (n,)     Candidate
    o_t = sigmoid(Z_t[3n:4n])             # (n,)     Output gate

    # Cell state update (ADDITIVE!)
    c_t = f_t * c_{t-1} + i_t * c_tilde  # (n,)     O(n)

    # Hidden state
    h_t = o_t * tanh(c_t)                 # (n,)     O(n)

    store h_t, c_t for backward pass

Complexity: O(T * n * (n + d)) time, O(T * n) space
```

### 4.2 LSTM Backward Pass (BPTT)

```
Algorithm: LSTM Backward Pass
-------------------------------
Input: stored forward quantities, loss gradients dL/dh_t for each t
Output: gradients dW, db

dW = 0, db = 0
dh_next = 0, dc_next = 0

for t = T down to 1:
    # Total gradient to h_t
    dh_t = dL/dh_t + dh_next                  # (n,)

    # Through h_t = o_t * tanh(c_t)
    do_t = dh_t * tanh(c_t)                    # (n,)
    dc_t = dh_t * o_t * (1 - tanh(c_t)^2) + dc_next  # (n,)

    # Through c_t = f_t * c_{t-1} + i_t * c_tilde
    df_t = dc_t * c_{t-1}                      # (n,)
    di_t = dc_t * c_tilde                      # (n,)
    dc_tilde = dc_t * i_t                      # (n,)
    dc_next = dc_t * f_t                       # (n,)  -> passes to t-1

    # Through gate activations
    dZ_f = df_t * f_t * (1 - f_t)              # (n,)  sigmoid'
    dZ_i = di_t * i_t * (1 - i_t)              # (n,)
    dZ_c = dc_tilde * (1 - c_tilde^2)          # (n,)  tanh'
    dZ_o = do_t * o_t * (1 - o_t)              # (n,)

    dZ_t = [dZ_f; dZ_i; dZ_c; dZ_o]           # (4n,)

    # Parameter gradients
    X_t = [h_{t-1}; x_t]                       # (n+d,)
    dW += dZ_t @ X_t^T                         # (4n, n+d)  O(n(n+d))
    db += dZ_t                                 # (4n,)

    # Gradient to previous hidden state
    dX_t = W^T @ dZ_t                          # (n+d,)
    dh_next = dX_t[0:n]                        # (n,)

Complexity: O(T * n * (n + d)) time, same as forward
```

### 4.3 GRU Forward Pass

```
Algorithm: GRU Forward Pass
----------------------------
Input: sequence (x_1, ..., x_T), initial state h_0
Output: hidden states (h_1, ..., h_T)

for t = 1 to T:
    X_t = [h_{t-1}; x_t]                      # (n+d,)

    # Reset and update gates
    r_t = sigmoid(W_r @ X_t + b_r)            # (n,)     O(n(n+d))
    z_t = sigmoid(W_z @ X_t + b_z)            # (n,)

    # Candidate with reset gate applied
    X_r = [r_t * h_{t-1}; x_t]                # (n+d,)
    h_tilde = tanh(W_h @ X_r + b_h)           # (n,)

    # Interpolation update
    h_t = (1 - z_t) * h_{t-1} + z_t * h_tilde # (n,)

Complexity: O(T * n * (n + d)) time
```

---

## 5. PyTorch Implementation

### 5.1 LSTM Cell from Scratch

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple

class LSTMCellScratch(nn.Module):
    """
    LSTM cell implemented from scratch.
    Computes all four gates with a single matrix multiply for efficiency.
    """
    def __init__(self, input_size: int, hidden_size: int):
        super().__init__()
        self.input_size = input_size    # d
        self.hidden_size = hidden_size  # n

        # Single weight matrix for all gates: (4n, n+d)
        # Order: forget, input, cell candidate, output
        self.weight = nn.Parameter(
            torch.randn(4 * hidden_size, input_size + hidden_size)
            / (input_size + hidden_size) ** 0.5
        )
        self.bias = nn.Parameter(torch.zeros(4 * hidden_size))  # (4n,)

        # Critical: initialize forget gate bias to 1.0
        # This ensures the forget gate starts near 1 (i.e., "remember everything")
        # See Jozefowicz et al. (2015) for empirical validation
        with torch.no_grad():
            self.bias[0:hidden_size].fill_(1.0)

    def forward(
        self,
        x_t: torch.Tensor,
        state: Tuple[torch.Tensor, torch.Tensor]
    ) -> Tuple[torch.Tensor, Tuple[torch.Tensor, torch.Tensor]]:
        """
        Args:
            x_t:   (B, d)
            state: (h_{t-1}, c_{t-1}) each of shape (B, n)
        Returns:
            h_t:   (B, n)
            (h_t, c_t): tuple of (B, n) tensors
        """
        h_prev, c_prev = state  # Each (B, n)
        n = self.hidden_size

        # Concatenate input and previous hidden state
        combined = torch.cat([h_prev, x_t], dim=1)  # (B, n+d)

        # Single matrix multiply for all gates
        # (B, n+d) @ (n+d, 4n) + (4n,) -> (B, 4n)
        gates = combined @ self.weight.t() + self.bias

        # Split into individual gates
        f_gate = torch.sigmoid(gates[:, 0:n])       # (B, n) forget
        i_gate = torch.sigmoid(gates[:, n:2*n])     # (B, n) input
        c_tilde = torch.tanh(gates[:, 2*n:3*n])     # (B, n) candidate
        o_gate = torch.sigmoid(gates[:, 3*n:4*n])   # (B, n) output

        # Cell state update (additive!)
        c_t = f_gate * c_prev + i_gate * c_tilde     # (B, n)

        # Hidden state
        h_t = o_gate * torch.tanh(c_t)               # (B, n)

        return h_t, (h_t, c_t)


class LSTMScratch(nn.Module):
    """
    Full LSTM that processes a sequence using LSTMCellScratch.
    """
    def __init__(self, input_size: int, hidden_size: int,
                 output_size: int, num_layers: int = 1):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.cells = nn.ModuleList()
        for l in range(num_layers):
            in_size = input_size if l == 0 else hidden_size
            self.cells.append(LSTMCellScratch(in_size, hidden_size))

        self.output_proj = nn.Linear(hidden_size, output_size)  # (m, n)

    def forward(
        self,
        x: torch.Tensor,
        initial_states: list = None
    ) -> Tuple[torch.Tensor, list]:
        """
        Args:
            x: (B, T, d) input sequence
            initial_states: list of (h_0, c_0) tuples for each layer
        Returns:
            outputs: (B, T, m)
            final_states: list of (h_T, c_T) tuples for each layer
        """
        B, T, d = x.shape
        device = x.device

        if initial_states is None:
            initial_states = [
                (torch.zeros(B, self.hidden_size, device=device),
                 torch.zeros(B, self.hidden_size, device=device))
                for _ in range(self.num_layers)
            ]

        states = list(initial_states)
        outputs = []

        for t in range(T):
            inp = x[:, t, :]                              # (B, d)
            for l in range(self.num_layers):
                _, states[l] = self.cells[l](inp, states[l])
                inp = states[l][0]                         # h_t of layer l -> input to l+1

            outputs.append(self.output_proj(inp))          # (B, m)

        outputs = torch.stack(outputs, dim=1)              # (B, T, m)
        return outputs, states
```

### 5.2 GRU Cell from Scratch

```python
class GRUCellScratch(nn.Module):
    """
    GRU cell implemented from scratch.
    """
    def __init__(self, input_size: int, hidden_size: int):
        super().__init__()
        self.input_size = input_size    # d
        self.hidden_size = hidden_size  # n

        # Weights for reset and update gates (computed together)
        self.W_gates = nn.Parameter(
            torch.randn(2 * hidden_size, input_size + hidden_size)
            / (input_size + hidden_size) ** 0.5
        )  # (2n, n+d)
        self.b_gates = nn.Parameter(torch.zeros(2 * hidden_size))  # (2n,)

        # Weights for candidate hidden state
        self.W_h = nn.Parameter(
            torch.randn(hidden_size, input_size + hidden_size)
            / (input_size + hidden_size) ** 0.5
        )  # (n, n+d)
        self.b_h = nn.Parameter(torch.zeros(hidden_size))  # (n,)

    def forward(
        self,
        x_t: torch.Tensor,
        h_prev: torch.Tensor
    ) -> torch.Tensor:
        """
        Args:
            x_t:    (B, d)
            h_prev: (B, n)
        Returns:
            h_t:    (B, n)
        """
        n = self.hidden_size

        # Compute reset and update gates
        combined = torch.cat([h_prev, x_t], dim=1)        # (B, n+d)
        gate_vals = combined @ self.W_gates.t() + self.b_gates  # (B, 2n)
        r_t = torch.sigmoid(gate_vals[:, 0:n])             # (B, n) reset
        z_t = torch.sigmoid(gate_vals[:, n:2*n])           # (B, n) update

        # Candidate with reset gate applied to hidden state
        combined_r = torch.cat([r_t * h_prev, x_t], dim=1)  # (B, n+d)
        h_tilde = torch.tanh(combined_r @ self.W_h.t() + self.b_h)  # (B, n)

        # Interpolation
        h_t = (1 - z_t) * h_prev + z_t * h_tilde          # (B, n)

        return h_t


class GRUScratch(nn.Module):
    """
    Full GRU model for sequence processing.
    """
    def __init__(self, input_size: int, hidden_size: int, output_size: int):
        super().__init__()
        self.hidden_size = hidden_size
        self.cell = GRUCellScratch(input_size, hidden_size)
        self.output_proj = nn.Linear(hidden_size, output_size)

    def forward(
        self,
        x: torch.Tensor,
        h_0: torch.Tensor = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: (B, T, d)
            h_0: (B, n) optional
        Returns:
            outputs: (B, T, m)
            h_T: (B, n)
        """
        B, T, d = x.shape
        if h_0 is None:
            h_0 = torch.zeros(B, self.hidden_size, device=x.device)

        h_t = h_0
        outputs = []
        for t in range(T):
            h_t = self.cell(x[:, t, :], h_t)          # (B, n)
            outputs.append(self.output_proj(h_t))       # (B, m)

        outputs = torch.stack(outputs, dim=1)           # (B, T, m)
        return outputs, h_t
```

### 5.3 Comparing Gradient Flow: Vanilla RNN vs LSTM

```python
def compare_gradient_flow(seq_len: int = 100, hidden_size: int = 64):
    """
    Compare gradient norms at the first hidden state for vanilla RNN and LSTM.
    Demonstrates vanishing gradients in RNN vs stable flow in LSTM.
    """
    input_size = 10
    B = 32

    # Random input
    x = torch.randn(B, seq_len, input_size)
    target = torch.randn(B, hidden_size)

    results = {}

    for name, CellClass in [("RNN", VanillaRNNCell), ("LSTM", LSTMCellScratch)]:
        cell = CellClass(input_size, hidden_size)

        # Forward pass storing states
        if name == "RNN":
            h = torch.zeros(B, hidden_size, requires_grad=True)
            first_h = h
            for t in range(seq_len):
                h = cell(x[:, t, :], h)
            loss = ((h - target) ** 2).sum()
        else:
            h = torch.zeros(B, hidden_size, requires_grad=True)
            c = torch.zeros(B, hidden_size, requires_grad=True)
            first_h = h
            for t in range(seq_len):
                h, (h, c) = cell(x[:, t, :], (h, c))
            loss = ((h - target) ** 2).sum()

        loss.backward()
        grad_norm = first_h.grad.norm().item()
        results[name] = grad_norm
        print(f"{name}: gradient norm at t=0 = {grad_norm:.6e}")

    print(f"\nRatio (LSTM/RNN): {results['LSTM']/max(results['RNN'], 1e-30):.2f}")
    return results

# Typical output for seq_len=100:
# RNN:  gradient norm at t=0 = 1.23e-15
# LSTM: gradient norm at t=0 = 2.87e-01
# Ratio (LSTM/RNN): ~10^14
```

### 5.4 Proper LSTM Training Loop

```python
def train_lstm_language_model(
    model: LSTMScratch,
    data_loader,
    epochs: int = 10,
    lr: float = 1e-3,
    clip_norm: float = 5.0,
    device: str = "cpu"
):
    """
    Training loop with proper LSTM practices:
    - Gradient clipping
    - Hidden state detaching (for truncated BPTT)
    - Learning rate scheduling
    """
    model = model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, patience=2, factor=0.5
    )

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        states = None  # Will be initialized in first batch

        for batch_idx, (x, y) in enumerate(data_loader):
            x = x.to(device)  # (B, T, d)
            y = y.to(device)  # (B, T)

            # Detach states from previous batch's computation graph
            # This implements truncated BPTT
            if states is not None:
                states = [(h.detach(), c.detach()) for h, c in states]

            outputs, states = model(x, states)  # (B, T, m)

            loss = F.cross_entropy(
                outputs.reshape(-1, outputs.size(-1)),  # (B*T, vocab_size)
                y.reshape(-1)                            # (B*T,)
            )

            optimizer.zero_grad()
            loss.backward()

            # Gradient clipping (essential for RNNs!)
            grad_norm = torch.nn.utils.clip_grad_norm_(
                model.parameters(), clip_norm
            )

            optimizer.step()
            total_loss += loss.item()

        avg_loss = total_loss / len(data_loader)
        scheduler.step(avg_loss)
        print(f"Epoch {epoch+1}: loss={avg_loss:.4f}")
```

---

## 6. Experimental Intuition

### 6.1 Forget Gate Bias Initialization

**Critical practical detail:** Initialize the forget gate bias to 1.0 (or higher). This means $f_0 = \sigma(1) \approx 0.73$, so the cell starts by retaining most of its state. Without this:

| Forget bias init | PTB Perplexity | Convergence |
|-----------------|----------------|-------------|
| 0.0             | 95.2           | Slow        |
| 1.0             | 82.3           | Normal      |
| 2.0             | 83.1           | Normal      |
| 5.0             | 86.7           | Slow (forget gate saturated) |

The sweet spot is 1.0, as recommended by Jozefowicz et al. (2015).

### 6.2 LSTM vs GRU: Empirical Comparison

From Greff et al. (2017) and Chung et al. (2014):

| Task | LSTM | GRU | Notes |
|------|------|-----|-------|
| Language modeling (PTB) | 82.3 | 84.1 | LSTM slightly better |
| Machine translation | Better | Competitive | LSTM preferred for long sequences |
| Speech recognition | Better | Competitive | |
| Music modeling | Better | Slightly worse | Long-range structure matters |
| Polyphonic music | Comparable | Comparable | |
| Small datasets | Comparable | **Better** | Fewer parameters help |
| Training speed (wall clock) | 1.0x | ~1.3x faster | GRU has fewer params |

**Rules of thumb:**
- Default to LSTM for large-scale tasks or when long-range memory is critical.
- Use GRU when training speed or model size matters, or on smaller datasets.
- Always try both if computational budget allows.

### 6.3 Ablation: Which LSTM Components Matter?

Greff et al. (2017) performed a systematic ablation of LSTM components:

| Variant | Effect on Performance |
|---------|----------------------|
| Remove forget gate | **Large degradation** (most important gate) |
| Remove input gate | Moderate degradation |
| Remove output gate | Small degradation |
| Couple forget + input ($i_t = 1 - f_t$) | No significant change (this is essentially a GRU-like simplification) |
| Add peephole connections | No significant change |

**Key finding:** The forget gate and the output activation function ($\tanh$ on $c_t$) are the most critical components.

### 6.4 Common Failure Modes

1. **Forget gate bias = 0**: Cell state is reset at every step, defeating the purpose of the LSTM.
2. **No gradient clipping**: While LSTMs mitigate vanishing gradients, they do NOT prevent exploding gradients. Always clip.
3. **Forgetting to detach states in truncated BPTT**: If you pass states between batches without detaching, the computation graph grows unboundedly and you run out of memory.
4. **Too many layers without residual connections**: Deep LSTMs (>3 layers) benefit from residual or skip connections between layers.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Material

- **Lecture 03a (Vanilla RNNs)**: LSTM and GRU are direct responses to the vanishing gradient problem analyzed there. The Jacobian analysis carries over: the LSTM achieves stable gradients by making the dominant Jacobian factor diagonal with entries in $(0,1)$.
- **Module 01 (Backpropagation)**: The LSTM backward pass is an application of reverse-mode autodiff through the LSTM computational graph. The gates introduce multiplicative interactions (Hadamard products) whose derivatives are straightforward.

### 7.2 Links to Future Material

- **Lecture 03c (Language Modeling)**: LSTMs are the standard architecture for neural language models before Transformers. The training techniques developed here (truncated BPTT, gradient clipping, forget gate initialization) are directly applied.
- **Module 04 (Transformers)**: The attention mechanism can be seen as an even more flexible solution to the information flow problem. While LSTM provides a single additive highway (the cell state), attention provides direct connections between all pairs of time steps.
- **ResNets (Module 02)**: The LSTM cell state update $c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$ is a gated version of the residual connection $y = x + F(x)$. Highway Networks (Srivastava et al., 2015) make this connection explicit.

### 7.3 Modern Variants

- **Mogrifier LSTM** (Melis et al., 2020): Applies mutual gating between input and hidden state before the main LSTM computation.
- **AWD-LSTM** (Merity et al., 2018): DropConnect on recurrent weights, NT-ASGD optimizer. State-of-the-art for LSTM-based language modeling.
- **Quasi-RNN** (Bradbury et al., 2017): Replaces recurrent matrix multiplications with convolutions, keeping element-wise gating. Much faster on GPUs.

---

## 8. Seminal Paper Reading List

### Required

1. **Hochreiter, S. & Schmidhuber, J. (1997).** "Long Short-Term Memory." *Neural Computation*, 9(8), 1735-1780.
   - *The original LSTM paper. Dense but essential. Focus on Sections 1-4.*

2. **Cho, K., et al. (2014).** "Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation." *EMNLP 2014*.
   - *Introduces the GRU and the encoder-decoder framework. Read in full.*

3. **Greff, K., Srivastava, R. K., Koutnik, J., Steunebrink, B. R., & Schmidhuber, J. (2017).** "LSTM: A Search Space Odyssey." *IEEE Transactions on Neural Networks and Learning Systems*, 28(10), 2222-2232.
   - *Comprehensive empirical comparison of LSTM variants. Essential for understanding what matters.*

### Recommended

4. **Jozefowicz, R., Zaremba, W., & Sutskever, I. (2015).** "An Empirical Exploration of Recurrent Network Architectures." *ICML 2015*.
   - *Forget gate bias initialization and other practical insights.*

5. **Gers, F. A., Schmidhuber, J., & Cummins, F. (2000).** "Learning to Forget: Continual Prediction with LSTM." *Neural Computation*, 12(10), 2451-2471.
   - *Introduces the forget gate, which is crucial for modern LSTMs.*

6. **Chung, J., Gulcehre, C., Cho, K., & Bengio, Y. (2014).** "Empirical Evaluation of Gated Recurrent Neural Networks on Sequence Modeling." *NIPS 2014 Workshop*.
   - *Direct LSTM vs GRU comparison across tasks.*

---

## 9. Exercises

### Theory

**Exercise 3b.1.** Derive the full LSTM backward pass for a single time step. Given $\delta h_t$ and $\delta c_t^{\text{next}}$, compute:
(a) $\delta c_t$ (the total gradient to the cell state),
(b) $\delta W_f, \delta W_i, \delta W_c, \delta W_o$ (gradients to all weight matrices),
(c) $\delta h_{t-1}$ and $\delta c_{t-1}^{\text{next}}$ (gradients to pass to the previous time step).

**Exercise 3b.2.** Consider the limiting case where $f_t = 1$ and $i_t = 0$ for all $t$ in an LSTM.
(a) Show that $c_T = c_0$ for all $T$.
(b) Compute $\frac{\partial c_T}{\partial c_0}$ and show it equals the identity matrix.
(c) Explain why this represents "perfect memory" and relate it to the vanishing gradient solution.

**Exercise 3b.3.** Prove that the GRU update $h_t = (1-z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t$ is a convex combination of $h_{t-1}$ and $\tilde{h}_t$ component-wise. What constraint does this impose on the norm of $h_t$ compared to the LSTM cell state?

**Exercise 3b.4.** Derive the gradient of the loss with respect to $W_z$ (the update gate weight matrix) in a GRU, accounting for the dependence of both $z_t$ and $\tilde{h}_t$ on $W_z$.

**Exercise 3b.5.** Add peephole connections to the LSTM and re-derive $\frac{\partial c_s}{\partial c_{s-1}}$. Show how the additional terms affect the gradient flow analysis.

### Implementation

**Exercise 3b.6.** Implement the LSTM cell from scratch as shown in Section 5.1. Verify correctness by comparing outputs and gradients against `torch.nn.LSTMCell` on random inputs. Use `torch.allclose` with appropriate tolerance.

**Exercise 3b.7.** Implement a GRU from scratch and train both LSTM and GRU on the Penn Treebank character-level language modeling task. Plot:
(a) Training and validation loss curves.
(b) Gradient norms (of the recurrent weights) over training.
(c) Training time per epoch.
Report final perplexity for both models.

**Exercise 3b.8.** Implement the forget gate bias experiment from Section 6.1. Train the same LSTM architecture on a sequence memorization task with forget gate biases in $\{-1, 0, 0.5, 1, 2, 5\}$. Plot convergence curves and report final accuracy.

**Exercise 3b.9.** Implement a "minimal GRU" (Zhou et al., 2016) that uses only the update gate (no reset gate): $\tilde{h}_t = \tanh(W_h [h_{t-1}, x_t] + b_h)$, $h_t = (1-z_t) \odot h_{t-1} + z_t \odot \tilde{h}_t$. Compare against the full GRU on a language modeling task. How much performance is lost?
