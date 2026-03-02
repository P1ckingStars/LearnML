# Recitation 03: Backpropagation Through Time (BPTT)

## Overview

This recitation provides a hands-on, step-by-step walkthrough of Backpropagation Through Time. We will:

1. Derive BPTT from first principles on a concrete small example.
2. Understand truncated BPTT and why it is necessary.
3. Work through a complete numerical example for a 2-layer RNN on a 5-step sequence.
4. Solve gradient computation exercises (with solutions).
5. Cover common pitfalls in PyTorch: hidden state detaching, packed sequences, and debugging gradient flow.

**Prerequisites:** Lecture 03a (RNNs and vanishing gradients), Module 01 (backpropagation).

---

## 1. Backpropagation Through Time: Step-by-Step

### 1.1 Setup

Consider a single-layer vanilla RNN with:
- Input dimension $d$
- Hidden dimension $n$
- Output dimension $m$

The forward pass for a sequence of length $T$:

$$z_t = W_{hh} h_{t-1} + W_{xh} x_t + b_h \quad \in \mathbb{R}^n$$
$$h_t = \tanh(z_t) \quad \in \mathbb{R}^n$$
$$o_t = W_{hy} h_t + b_y \quad \in \mathbb{R}^m$$
$$\ell_t = \text{loss}(o_t, y_t) \quad \in \mathbb{R}$$
$$\mathcal{L} = \sum_{t=1}^{T} \ell_t$$

### 1.2 The Key Insight

The parameter $W_{hh}$ is shared across all time steps. When we compute $\frac{\partial \mathcal{L}}{\partial W_{hh}}$, we must sum the contributions from **every** time step where $W_{hh}$ was used. This is the essence of BPTT: unroll the RNN into a feedforward network and apply standard backpropagation, accumulating gradients across the shared parameters.

### 1.3 Forward Pass (Storing Everything)

```
t=0: h_0 = 0                           (initial state)
t=1: z_1 = W_hh h_0 + W_xh x_1 + b_h
     h_1 = tanh(z_1)
     o_1 = W_hy h_1 + b_y
     L_1 = loss(o_1, y_1)

t=2: z_2 = W_hh h_1 + W_xh x_2 + b_h
     h_2 = tanh(z_2)
     o_2 = W_hy h_2 + b_y
     L_2 = loss(o_2, y_2)

...

t=T: z_T = W_hh h_{T-1} + W_xh x_T + b_h
     h_T = tanh(z_T)
     o_T = W_hy h_T + b_y
     L_T = loss(o_T, y_T)
```

**Memory requirement:** We must store all $h_t$ and $z_t$ for $t = 0, 1, \ldots, T$. This is $O(T \cdot n)$ memory.

### 1.4 Backward Pass (The Full Derivation)

We process time steps in reverse order, accumulating parameter gradients and propagating the hidden state gradient backward.

**Notation:** Let $\delta h_t = \frac{\partial \mathcal{L}}{\partial h_t}$ denote the **total** gradient flowing into $h_t$, from both the local loss $\ell_t$ and the future time steps $t+1, t+2, \ldots, T$.

**At each time step $t$ (going from $T$ down to $1$):**

**Step 1: Gradient from the output.**
$$\frac{\partial \ell_t}{\partial o_t} = \delta o_t \quad \text{(depends on the loss function)}$$

For cross-entropy with softmax: $\delta o_t = \hat{p}_t - y_t$ where $\hat{p}_t = \text{softmax}(o_t)$.

$$\frac{\partial \ell_t}{\partial h_t} = W_{hy}^T \delta o_t \quad \in \mathbb{R}^n$$

**Step 2: Total gradient at $h_t$.**
$$\delta h_t = \frac{\partial \ell_t}{\partial h_t} + \delta h_t^{\text{future}}$$

where $\delta h_t^{\text{future}}$ is the gradient propagated back from time step $t+1$ (see Step 5 below). At $t = T$, $\delta h_T^{\text{future}} = 0$.

**Step 3: Gradient through the nonlinearity.**
$$\delta z_t = \delta h_t \odot \tanh'(z_t) = \delta h_t \odot (1 - h_t^2) \quad \in \mathbb{R}^n$$

(Element-wise product with the derivative of tanh.)

**Step 4: Accumulate parameter gradients (immediate partials).**
$$\frac{\partial \mathcal{L}}{\partial W_{hh}} \mathrel{+}= \delta z_t \cdot h_{t-1}^T \quad \in \mathbb{R}^{n \times n}$$
$$\frac{\partial \mathcal{L}}{\partial W_{xh}} \mathrel{+}= \delta z_t \cdot x_t^T \quad \in \mathbb{R}^{n \times d}$$
$$\frac{\partial \mathcal{L}}{\partial b_h} \mathrel{+}= \delta z_t \quad \in \mathbb{R}^n$$
$$\frac{\partial \mathcal{L}}{\partial W_{hy}} \mathrel{+}= \delta o_t \cdot h_t^T \quad \in \mathbb{R}^{m \times n}$$
$$\frac{\partial \mathcal{L}}{\partial b_y} \mathrel{+}= \delta o_t \quad \in \mathbb{R}^m$$

**Step 5: Propagate gradient backward in time.**
$$\delta h_{t-1}^{\text{future}} = W_{hh}^T \delta z_t \quad \in \mathbb{R}^n$$

This is the gradient that will be added to $\delta h_{t-1}$ at the next iteration of the backward loop.

### 1.5 Summary of the Backward Loop

```
Initialize: dW_hh = 0, dW_xh = 0, dW_hy = 0, db_h = 0, db_y = 0
            delta_h_future = 0   (no future beyond T)

for t = T, T-1, ..., 1:
    # Step 1: Gradient from local loss
    delta_o_t = d_loss / d_o_t                           # (m,)
    delta_h_local = W_hy^T @ delta_o_t                   # (n,)

    # Step 2: Total gradient at h_t
    delta_h_t = delta_h_local + delta_h_future            # (n,)

    # Step 3: Through tanh
    delta_z_t = delta_h_t * (1 - h_t**2)                 # (n,)

    # Step 4: Accumulate parameter gradients
    dW_hh += delta_z_t @ h_{t-1}^T                       # (n, n)
    dW_xh += delta_z_t @ x_t^T                           # (n, d)
    db_h  += delta_z_t                                    # (n,)
    dW_hy += delta_o_t @ h_t^T                            # (m, n)
    db_y  += delta_o_t                                    # (m,)

    # Step 5: Propagate to previous time step
    delta_h_future = W_hh^T @ delta_z_t                   # (n,)
```

---

## 2. Truncated BPTT

### 2.1 The Problem with Full BPTT

For a sequence of length $T$:
- **Memory**: $O(T \cdot n)$ to store all hidden states.
- **Computation**: $O(T \cdot n^2)$ for the backward pass.

For $T = 10{,}000$ (a modest document) and $n = 512$, storing hidden states requires $\sim$20 MB per sample. For $T = 1{,}000{,}000$ (a book), this becomes $\sim$2 GB. This is infeasible.

### 2.2 The Solution: Truncated BPTT

Instead of backpropagating through the entire sequence, we split it into chunks of length $K$ and backpropagate only within each chunk.

**Algorithm:**

```
Split the sequence into chunks of length K:
    chunk_1 = (x_1, ..., x_K)
    chunk_2 = (x_{K+1}, ..., x_{2K})
    ...

h = h_0
for each chunk (x_{start}, ..., x_{start+K-1}):
    # Forward pass through chunk (K steps)
    for t = 0 to K-1:
        h_t = RNN(x_{start+t}, h)
        h = h_t

    # Backward pass through chunk only (K steps)
    loss_chunk.backward()
    optimizer.step()

    # CRITICAL: detach h from the computation graph
    h = h.detach()   # <--- This cuts the gradient flow
```

The hidden state $h$ is carried forward across chunks (maintaining the RNN's memory), but the gradient is not propagated across chunk boundaries. This limits the effective temporal receptive field of the gradient to $K$ steps.

### 2.3 Why Detaching is Necessary

Without `h.detach()`, PyTorch's autograd engine would retain the entire computation graph from the beginning of the sequence. Each `.backward()` call would backpropagate through all previous chunks as well, resulting in:
- $O(\text{num\_chunks\_seen} \times K)$ backward computation instead of $O(K)$.
- Memory that grows linearly with the number of chunks processed.

With `h.detach()`, we tell autograd: "treat this tensor as a leaf node with no history." The gradient stops here.

### 2.4 Tradeoffs

| BPTT Length $K$ | Gradient Receptive Field | Memory | Long-range Learning |
|-----------------|-------------------------|--------|---------------------|
| Full ($K = T$) | All $T$ steps | $O(T \cdot n)$ | Best (in principle) |
| $K = 200$ | 200 steps | $O(200n)$ | Good for most tasks |
| $K = 35$ | 35 steps | $O(35n)$ | Standard for LM |
| $K = 1$ | 1 step | $O(n)$ | No temporal learning |

The standard choice for language modeling is $K = 35$ (Zaremba et al., 2014) or $K = 70$ (Merity et al., 2018).

---

## 3. Worked Example: 2-Layer RNN on a 5-Step Sequence

### 3.1 Architecture

- Input dim $d = 2$
- Hidden dim $n = 3$ (for both layers)
- Output dim $m = 2$
- Sequence length $T = 5$
- 2 layers: layer 1 feeds its hidden state as input to layer 2.

**Layer 1:**
$$h_t^{(1)} = \tanh(W_{hh}^{(1)} h_{t-1}^{(1)} + W_{xh}^{(1)} x_t + b^{(1)})$$

**Layer 2:**
$$h_t^{(2)} = \tanh(W_{hh}^{(2)} h_{t-1}^{(2)} + W_{xh}^{(2)} h_t^{(1)} + b^{(2)})$$

**Output:**
$$o_t = W_{hy} h_t^{(2)} + b_y$$

### 3.2 Concrete Values

Let us use tiny concrete values for a traceable computation.

```
Input sequence (T=5, d=2):
x_1 = [1.0, 0.5]
x_2 = [0.3, -0.2]
x_3 = [-0.5, 0.8]
x_4 = [0.1, 0.1]
x_5 = [0.7, -0.3]

Parameters (layer 1, n=3, d=2):
W_hh^(1) = [[0.1, -0.2, 0.3],    W_xh^(1) = [[0.5, 0.1],
             [0.4,  0.1, -0.1],                [-0.3, 0.4],
             [-0.2, 0.3, 0.2]]                 [0.2, -0.2]]
b^(1) = [0, 0, 0]

Parameters (layer 2, n=3):
W_hh^(2) = [[0.2, 0.1, -0.3],    W_xh^(2) = [[0.4, -0.1, 0.3],
             [-0.1, 0.3, 0.2],                 [0.2,  0.3, -0.2],
             [0.3, -0.2, 0.1]]                 [-0.1, 0.1, 0.4]]
b^(2) = [0, 0, 0]

Output (m=2):
W_hy = [[0.3, -0.2, 0.1],
        [0.1, 0.4, -0.3]]
b_y = [0, 0]
```

### 3.3 Forward Pass (First 2 Steps)

**t=1, Layer 1:**
$$z_1^{(1)} = W_{hh}^{(1)} \cdot \mathbf{0} + W_{xh}^{(1)} \cdot [1.0, 0.5]^T + b^{(1)}$$
$$= [0.5 \cdot 1.0 + 0.1 \cdot 0.5, \; -0.3 \cdot 1.0 + 0.4 \cdot 0.5, \; 0.2 \cdot 1.0 + (-0.2) \cdot 0.5]$$
$$= [0.55, \; -0.10, \; 0.10]$$
$$h_1^{(1)} = \tanh([0.55, -0.10, 0.10]) = [0.4995, \; -0.0997, \; 0.0997]$$

**t=1, Layer 2:**
$$z_1^{(2)} = W_{hh}^{(2)} \cdot \mathbf{0} + W_{xh}^{(2)} \cdot h_1^{(1)} + b^{(2)}$$
$$= [0.4 \cdot 0.4995 + (-0.1) \cdot (-0.0997) + 0.3 \cdot 0.0997, \ldots]$$
$$= [0.2398 + 0.0100 + 0.0299, \; 0.0999 + (-0.0299) + (-0.0199), \; -0.0500 + (-0.0100) + 0.0399]$$
$$\approx [0.2797, \; 0.0501, \; -0.0201]$$
$$h_1^{(2)} = \tanh([0.2797, 0.0501, -0.0201]) \approx [0.2724, \; 0.0501, \; -0.0201]$$

**t=1, Output:**
$$o_1 = W_{hy} \cdot h_1^{(2)} + b_y$$
$$= [0.3 \cdot 0.2724 + (-0.2) \cdot 0.0501 + 0.1 \cdot (-0.0201), \ldots]$$
$$\approx [0.0696, \; 0.0534]$$

**t=2, Layer 1:**
$$z_2^{(1)} = W_{hh}^{(1)} \cdot h_1^{(1)} + W_{xh}^{(1)} \cdot x_2 + b^{(1)}$$

First compute $W_{hh}^{(1)} h_1^{(1)}$:
$$= [0.1 \cdot 0.4995 + (-0.2)(-0.0997) + 0.3 \cdot 0.0997, \ldots]$$
$$= [0.0500 + 0.0199 + 0.0299, \; 0.1998 + (-0.0100) + (-0.0100), \; -0.0999 + (-0.0299) + 0.0199]$$
$$= [0.0999, \; 0.1798, \; -0.1099]$$

Then $W_{xh}^{(1)} x_2 = W_{xh}^{(1)} [0.3, -0.2]^T$:
$$= [0.5 \cdot 0.3 + 0.1 \cdot (-0.2), \; -0.3 \cdot 0.3 + 0.4 \cdot (-0.2), \; 0.2 \cdot 0.3 + (-0.2)(-0.2)]$$
$$= [0.13, \; -0.17, \; 0.10]$$

$$z_2^{(1)} = [0.0999 + 0.13, \; 0.1798 + (-0.17), \; -0.1099 + 0.10] = [0.2299, \; 0.0098, \; -0.0099]$$
$$h_2^{(1)} = \tanh([0.2299, 0.0098, -0.0099]) \approx [0.2253, \; 0.0098, \; -0.0099]$$

(The remaining steps follow the same pattern.)

### 3.4 Backward Pass (Sketch for t=5)

Assume MSE loss: $\ell_t = \frac{1}{2}\|o_t - y_t\|^2$, so $\delta o_t = o_t - y_t$.

At $t = 5$ (the last time step):

**Layer 2 backward:**
1. $\delta o_5 = o_5 - y_5$ (shape: $(m,)$).
2. $\delta h_5^{(2)} = W_{hy}^T \delta o_5$ (shape: $(n,)$). No future contribution since $t=5$ is the last step.
3. $\delta z_5^{(2)} = \delta h_5^{(2)} \odot (1 - (h_5^{(2)})^2)$ (shape: $(n,)$).
4. Accumulate: $\Delta W_{hh}^{(2)} \mathrel{+}= \delta z_5^{(2)} (h_4^{(2)})^T$, etc.
5. Propagate to layer 2's previous step: $\delta h_4^{(2), \text{future}} = (W_{hh}^{(2)})^T \delta z_5^{(2)}$.
6. Propagate to layer 1: $\delta h_5^{(1)} = (W_{xh}^{(2)})^T \delta z_5^{(2)}$.

**Layer 1 backward (at t=5):**
1. $\delta h_5^{(1)}$ comes from layer 2 above.
2. $\delta z_5^{(1)} = \delta h_5^{(1)} \odot (1 - (h_5^{(1)})^2)$.
3. Accumulate: $\Delta W_{hh}^{(1)} \mathrel{+}= \delta z_5^{(1)} (h_4^{(1)})^T$, etc.
4. Propagate: $\delta h_4^{(1), \text{future}} = (W_{hh}^{(1)})^T \delta z_5^{(1)}$.

Then we move to $t = 4$, where $\delta h_4^{(2)}$ receives contributions from both the local loss $\ell_4$ and the future gradient $\delta h_4^{(2), \text{future}}$ from $t=5$.

**The key pattern for multi-layer RNNs:** At each time step $t$, work from the top layer down. Each layer receives gradients from above (from the next layer or the output) and from the future (from the same layer at $t+1$).

---

## 4. Gradient Computation Exercises with Solutions

### Exercise 4.1: Single-Step Gradient

Consider a single RNN step with $n = 2$, $d = 1$:
$$h = \tanh\left(\begin{bmatrix} 0.5 & -0.3 \\ 0.2 & 0.4 \end{bmatrix} h_{\text{prev}} + \begin{bmatrix} 1.0 \\ -0.5 \end{bmatrix} x + \begin{bmatrix} 0 \\ 0 \end{bmatrix}\right)$$

Given $h_{\text{prev}} = [0.8, -0.3]^T$, $x = 0.5$, and $\delta h = [1.0, 0.0]^T$ (gradient flowing into $h$), compute:
(a) $h$ (the output hidden state).
(b) $\delta z$ (the gradient before the nonlinearity).
(c) $\delta W_{hh}$ (the gradient of the loss w.r.t. $W_{hh}$).
(d) $\delta h_{\text{prev}}$ (the gradient to propagate backward in time).

**Solution:**

**(a)** Forward:
$$z = \begin{bmatrix} 0.5 & -0.3 \\ 0.2 & 0.4 \end{bmatrix} \begin{bmatrix} 0.8 \\ -0.3 \end{bmatrix} + \begin{bmatrix} 1.0 \\ -0.5 \end{bmatrix} \cdot 0.5$$
$$= \begin{bmatrix} 0.4 + 0.09 \\ 0.16 - 0.12 \end{bmatrix} + \begin{bmatrix} 0.5 \\ -0.25 \end{bmatrix} = \begin{bmatrix} 0.99 \\ -0.21 \end{bmatrix}$$
$$h = \tanh\left(\begin{bmatrix} 0.99 \\ -0.21 \end{bmatrix}\right) = \begin{bmatrix} 0.7574 \\ -0.2070 \end{bmatrix}$$

**(b)** Gradient through tanh:
$$\delta z = \delta h \odot (1 - h^2) = \begin{bmatrix} 1.0 \\ 0.0 \end{bmatrix} \odot \begin{bmatrix} 1 - 0.7574^2 \\ 1 - 0.2070^2 \end{bmatrix} = \begin{bmatrix} 1.0 \\ 0.0 \end{bmatrix} \odot \begin{bmatrix} 0.4264 \\ 0.9571 \end{bmatrix} = \begin{bmatrix} 0.4264 \\ 0 \end{bmatrix}$$

**(c)** Parameter gradient:
$$\delta W_{hh} = \delta z \cdot h_{\text{prev}}^T = \begin{bmatrix} 0.4264 \\ 0 \end{bmatrix} \begin{bmatrix} 0.8 & -0.3 \end{bmatrix} = \begin{bmatrix} 0.3411 & -0.1279 \\ 0 & 0 \end{bmatrix}$$

**(d)** Gradient to previous time step:
$$\delta h_{\text{prev}} = W_{hh}^T \delta z = \begin{bmatrix} 0.5 & 0.2 \\ -0.3 & 0.4 \end{bmatrix} \begin{bmatrix} 0.4264 \\ 0 \end{bmatrix} = \begin{bmatrix} 0.2132 \\ -0.1279 \end{bmatrix}$$

---

### Exercise 4.2: Two-Step BPTT

Using the same RNN from Exercise 4.1, now consider two time steps with $h_0 = [0, 0]^T$, $x_1 = 1.0$, $x_2 = -0.5$. The loss is only at $t = 2$: $\mathcal{L} = h_2[0]$ (just the first component of $h_2$).

Compute $\frac{\partial \mathcal{L}}{\partial W_{hh}}$ by:
(a) BPTT.
(b) Numerical differentiation (perturb each entry of $W_{hh}$ by $\epsilon = 10^{-5}$ and recompute $\mathcal{L}$).
Verify that the two agree.

**Solution:**

**(a)** BPTT:

**Forward pass:**

$t=1$: $z_1 = W_{hh} [0,0]^T + W_{xh} \cdot 1.0 = [1.0, -0.5]^T$
$h_1 = \tanh([1.0, -0.5]) = [0.7616, -0.4621]$

$t=2$: $z_2 = W_{hh} h_1 + W_{xh} \cdot (-0.5)$
$= \begin{bmatrix} 0.5 \cdot 0.7616 + (-0.3)(-0.4621) \\ 0.2 \cdot 0.7616 + 0.4 \cdot (-0.4621) \end{bmatrix} + \begin{bmatrix} -0.5 \\ 0.25 \end{bmatrix}$
$= \begin{bmatrix} 0.3808 + 0.1386 \\ 0.1523 - 0.1848 \end{bmatrix} + \begin{bmatrix} -0.5 \\ 0.25 \end{bmatrix} = \begin{bmatrix} 0.0194 \\ 0.2175 \end{bmatrix}$

$h_2 = \tanh([0.0194, 0.2175]) = [0.0194, 0.2141]$

$\mathcal{L} = h_2[0] = 0.0194$

**Backward pass:**

$\delta h_2 = [1, 0]^T$ (gradient of $\mathcal{L} = h_2[0]$)

At $t=2$:
$\delta z_2 = \delta h_2 \odot (1 - h_2^2) = [1, 0] \odot [1 - 0.0194^2, 1 - 0.2141^2] = [0.9996, 0]$

$\delta W_{hh}^{(t=2)} = \delta z_2 \cdot h_1^T = [0.9996, 0]^T [0.7616, -0.4621] = \begin{bmatrix} 0.7613 & -0.4619 \\ 0 & 0 \end{bmatrix}$

$\delta h_1^{\text{future}} = W_{hh}^T \delta z_2 = \begin{bmatrix} 0.5 & 0.2 \\ -0.3 & 0.4 \end{bmatrix} \begin{bmatrix} 0.9996 \\ 0 \end{bmatrix} = \begin{bmatrix} 0.4998 \\ -0.2999 \end{bmatrix}$

At $t=1$:
$\delta h_1 = \delta h_1^{\text{future}} = [0.4998, -0.2999]$ (no local loss at $t=1$)

$\delta z_1 = \delta h_1 \odot (1 - h_1^2) = [0.4998, -0.2999] \odot [1-0.7616^2, 1-0.4621^2] = [0.4998, -0.2999] \odot [0.4200, 0.7865]$

$= [0.2099, -0.2359]$

$\delta W_{hh}^{(t=1)} = \delta z_1 \cdot h_0^T = [0.2099, -0.2359]^T [0, 0] = \begin{bmatrix} 0 & 0 \\ 0 & 0 \end{bmatrix}$

(Since $h_0 = \mathbf{0}$, the gradient contribution at $t=1$ w.r.t. $W_{hh}$ is zero.)

**Total:**
$$\frac{\partial \mathcal{L}}{\partial W_{hh}} = \delta W_{hh}^{(t=2)} + \delta W_{hh}^{(t=1)} = \begin{bmatrix} 0.7613 & -0.4619 \\ 0 & 0 \end{bmatrix}$$

**(b)** Numerical verification is left as a coding exercise. The results should agree to within $O(\epsilon)$.

---

### Exercise 4.3: Vanishing Gradient Demonstration

Consider a linear RNN ($\sigma = \text{id}$) with:
$$W_{hh} = \begin{bmatrix} 0.5 & 0 \\ 0 & 0.9 \end{bmatrix}$$

The Jacobian $\frac{\partial h_t}{\partial h_{t-1}} = W_{hh}$ (constant since there is no nonlinearity).

Compute $\frac{\partial h_{20}}{\partial h_0} = W_{hh}^{20}$ and $\frac{\partial h_{100}}{\partial h_0} = W_{hh}^{100}$.

**Solution:**

Since $W_{hh}$ is diagonal:
$$W_{hh}^k = \begin{bmatrix} 0.5^k & 0 \\ 0 & 0.9^k \end{bmatrix}$$

$$W_{hh}^{20} = \begin{bmatrix} 0.5^{20} & 0 \\ 0 & 0.9^{20} \end{bmatrix} = \begin{bmatrix} 9.54 \times 10^{-7} & 0 \\ 0 & 0.1216 \end{bmatrix}$$

$$W_{hh}^{100} = \begin{bmatrix} 0.5^{100} & 0 \\ 0 & 0.9^{100} \end{bmatrix} = \begin{bmatrix} 7.89 \times 10^{-31} & 0 \\ 0 & 2.66 \times 10^{-5} \end{bmatrix}$$

The first component's gradient has vanished by $t=20$. The second component's gradient (with eigenvalue 0.9) vanishes more slowly but still decays exponentially.

At $t = 100$, even the 0.9-eigenvalue component has decayed by a factor of $\sim 40{,}000$.

This demonstrates why learning long-range dependencies is impossible when all eigenvalues are less than 1.

---

### Exercise 4.4: LSTM Gradient Flow

Consider an LSTM cell in the limiting case where $f_t = 1$, $i_t = 0$, $o_t = 1$ for all $t > 1$, and at $t = 1$: $f_1 = 0$, $i_1 = 1$.

**(a)** What does $c_t$ equal for $t \geq 1$?

**(b)** Compute $\frac{\partial c_{100}}{\partial c_1}$.

**(c)** Compare with the vanilla RNN result from Exercise 4.3.

**Solution:**

**(a)** At $t=1$: $c_1 = f_1 \odot c_0 + i_1 \odot \tilde{c}_1 = 0 \cdot c_0 + 1 \cdot \tilde{c}_1 = \tilde{c}_1$.

For $t > 1$: $c_t = 1 \odot c_{t-1} + 0 \odot \tilde{c}_t = c_{t-1}$.

So $c_t = \tilde{c}_1 = c_1$ for all $t \geq 1$. The cell state is perfectly preserved.

**(b)** $\frac{\partial c_{100}}{\partial c_1} = \prod_{s=2}^{100} \text{diag}(f_s) = \prod_{s=2}^{100} I = I$.

The gradient flows through **perfectly** with no attenuation.

**(c)** Compare: vanilla RNN gradient decays as $0.9^{99} = 2.66 \times 10^{-5}$ (best eigenvalue), while the LSTM gradient is exactly $1.0$.

This is the fundamental advantage of the LSTM: the additive cell state update provides a gradient highway.

---

## 5. Common Pitfalls and PyTorch Best Practices

### 5.1 Hidden State Detaching

**The problem:**
```python
# WRONG: memory leak in truncated BPTT
hidden = None
for batch in data_loader:
    output, hidden = model(batch, hidden)  # hidden retains computation graph
    loss = compute_loss(output)
    loss.backward()
    optimizer.step()
    # hidden still connected to previous batch's graph!
    # Next backward() will try to backprop through all previous batches
```

**The fix:**
```python
# CORRECT: detach hidden state between batches
hidden = None
for batch in data_loader:
    if hidden is not None:
        # For LSTM: hidden is a tuple (h, c)
        hidden = tuple(h.detach() for h in hidden)
        # For RNN/GRU: hidden is a single tensor
        # hidden = hidden.detach()
    output, hidden = model(batch, hidden)
    loss = compute_loss(output)
    loss.backward()
    optimizer.step()
```

### 5.2 Packed Sequences in PyTorch

When processing batches of variable-length sequences, we need to handle padding correctly. PyTorch provides `pack_padded_sequence` and `pad_packed_sequence`.

**Complete example:**

```python
import torch
import torch.nn as nn
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

def process_variable_length_batch(
    rnn: nn.LSTM,
    sequences: list,      # List of tensors with different lengths
    device: str = "cpu"
):
    """
    Process a batch of variable-length sequences with proper packing.
    """
    # Step 1: Sort by length (descending) if using enforce_sorted=True
    lengths = torch.tensor([s.size(0) for s in sequences])  # (B,)

    # Step 2: Pad to same length
    padded = nn.utils.rnn.pad_sequence(
        sequences, batch_first=True, padding_value=0.0
    )  # (B, T_max, d)

    # Step 3: Pack
    packed = pack_padded_sequence(
        padded, lengths.cpu(),
        batch_first=True,
        enforce_sorted=False  # Allows unsorted input
    )

    # Step 4: Run RNN
    packed_output, (h_n, c_n) = rnn(packed)

    # Step 5: Unpack
    output, output_lengths = pad_packed_sequence(
        packed_output, batch_first=True
    )  # (B, T_max, hidden_size)

    return output, (h_n, c_n), output_lengths


# Example usage:
rnn = nn.LSTM(input_size=10, hidden_size=20, batch_first=True)

# Three sequences of different lengths
seq1 = torch.randn(5, 10)   # Length 5
seq2 = torch.randn(3, 10)   # Length 3
seq3 = torch.randn(7, 10)   # Length 7

output, hidden, lengths = process_variable_length_batch(
    rnn, [seq1, seq2, seq3]
)
print(f"Output shape: {output.shape}")      # (3, 7, 20)
print(f"Lengths: {lengths}")                 # tensor([5, 3, 7])
```

**Why packing matters:**
1. **Correctness:** Without packing, the RNN processes padding tokens and their hidden states contaminate the output. With packing, the RNN skips padding positions.
2. **Efficiency:** Packing allows cuDNN to skip computation on padding tokens.
3. **Final hidden state:** With packing, `h_n` correctly contains the hidden state at the last **real** token of each sequence, not at the last padding position.

### 5.3 Debugging Gradient Flow

```python
def check_gradient_flow(model):
    """
    Print gradient statistics for each parameter.
    Useful for detecting vanishing/exploding gradients.
    """
    print(f"{'Parameter':<40} {'Grad Norm':>12} {'Grad Mean':>12} {'Grad Max':>12}")
    print("-" * 80)

    for name, param in model.named_parameters():
        if param.grad is not None:
            grad = param.grad
            print(f"{name:<40} {grad.norm().item():>12.6f} "
                  f"{grad.mean().item():>12.8f} {grad.abs().max().item():>12.6f}")
        else:
            print(f"{name:<40} {'None':>12}")


# Usage: call after loss.backward() but before optimizer.step()
# loss.backward()
# check_gradient_flow(model)
# optimizer.step()
```

### 5.4 Common Mistakes Checklist

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Not detaching hidden states | OOM error after several batches | `hidden = hidden.detach()` |
| Wrong BPTT length | Poor long-range learning | Increase truncation length |
| No gradient clipping | NaN loss | `clip_grad_norm_(params, max_norm)` |
| Forget gate bias = 0 | LSTM performs like vanilla RNN | Set to 1.0 |
| Averaging loss over batch then exponentiation | Incorrect perplexity | Sum loss, divide by total tokens, then exp |
| Not using `batch_first=True` consistently | Dimension mismatch errors | Be consistent throughout |
| Using teacher forcing at test time | Artificially low test perplexity | Use autoregressive generation at test time |
| Computing perplexity on train set | Misleading metric | Always report on held-out set |

### 5.5 Gradient Clipping: Where in the Code

```python
# CORRECT order of operations
optimizer.zero_grad()                                       # 1. Zero gradients
output = model(input)                                       # 2. Forward pass
loss = criterion(output, target)                            # 3. Compute loss
loss.backward()                                             # 4. Backward pass
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)    # 5. Clip AFTER backward
optimizer.step()                                            # 6. Update AFTER clipping

# WRONG: clipping before backward does nothing
# WRONG: clipping after optimizer.step() is too late
```

---

## 6. PyTorch Packed Sequences: In-Depth Tutorial

### 6.1 What is a PackedSequence?

A `PackedSequence` is PyTorch's representation of a batch of variable-length sequences. Instead of a padded tensor where the RNN wastes computation on padding, a PackedSequence stores the data in a compact format.

**Internal representation:**

For sequences of lengths [5, 3, 7] in a batch:

```
Padded representation (B=3, T_max=7):
  t:  1  2  3  4  5  6  7
seq1: a1 a2 a3 a4 a5 -- --
seq2: b1 b2 b3 -- -- -- --
seq3: c1 c2 c3 c4 c5 c6 c7

Packed representation:
data:        [a1,b1,c1, a2,b2,c2, a3,b3,c3, a4,c4, a5,c5, c6, c7]
batch_sizes: [3,       3,       3,       2,    2,    1,  1]
```

At each time step, the packed data contains only the elements from sequences that have not yet ended. The `batch_sizes` tensor records how many sequences are active at each step.

### 6.2 Step-by-Step Example

```python
import torch
from torch.nn.utils.rnn import (
    pad_sequence, pack_padded_sequence, pad_packed_sequence, pack_sequence
)

# Create sequences of different lengths
seq_a = torch.tensor([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]])           # Length 3
seq_b = torch.tensor([[7.0, 8.0], [9.0, 10.0]])                       # Length 2
seq_c = torch.tensor([[11.0, 12.0], [13.0, 14.0], [15.0, 16.0],
                       [17.0, 18.0]])                                   # Length 4

sequences = [seq_a, seq_b, seq_c]
lengths = torch.tensor([3, 2, 4])

# Pad sequences to same length
padded = pad_sequence(sequences, batch_first=True, padding_value=0.0)
print(f"Padded shape: {padded.shape}")  # (3, 4, 2)
# tensor([[[ 1.,  2.], [ 3.,  4.], [ 5.,  6.], [ 0.,  0.]],
#          [[ 7.,  8.], [ 9., 10.], [ 0.,  0.], [ 0.,  0.]],
#          [[11., 12.], [13., 14.], [15., 16.], [17., 18.]]])

# Pack
packed = pack_padded_sequence(padded, lengths, batch_first=True,
                               enforce_sorted=False)
print(f"Packed data shape: {packed.data.shape}")        # (9, 2)
print(f"Batch sizes: {packed.batch_sizes}")              # tensor([3, 3, 2, 1])
print(f"Sorted indices: {packed.sorted_indices}")        # tensor([2, 0, 1])

# The data is sorted by length (descending) internally
# batch_sizes: [3, 3, 2, 1] means:
#   step 1: 3 sequences active (c, a, b)
#   step 2: 3 sequences active
#   step 3: 2 sequences active (c, a) -- b ended
#   step 4: 1 sequence active (c) -- a ended

# Process with LSTM
lstm = torch.nn.LSTM(input_size=2, hidden_size=3, batch_first=True)
packed_output, (h_n, c_n) = lstm(packed)
# h_n: (1, 3, 3) - final hidden state for each sequence at its TRUE length

# Unpack
output, output_lengths = pad_packed_sequence(packed_output, batch_first=True)
print(f"Unpacked output shape: {output.shape}")  # (3, 4, 3)
print(f"Output lengths: {output_lengths}")         # tensor([4, 3, 2])
```

### 6.3 Extracting the Final Hidden State

When using packed sequences, the final hidden state `h_n` automatically contains the state at the last real token, not the last padding token. However, if you need to extract hidden states from the **output** tensor (e.g., for attention), you need to be careful:

```python
def extract_last_hidden(output: torch.Tensor, lengths: torch.Tensor):
    """
    Extract the hidden state at the last real position for each sequence.

    Args:
        output:  (B, T_max, n) padded output from pad_packed_sequence
        lengths: (B,) actual lengths
    Returns:
        last_hidden: (B, n)
    """
    B = output.size(0)
    # lengths - 1 gives the index of the last real position
    idx = (lengths - 1).long().unsqueeze(1).unsqueeze(2)   # (B, 1, 1)
    idx = idx.expand(-1, -1, output.size(2))                # (B, 1, n)
    last_hidden = output.gather(1, idx).squeeze(1)          # (B, n)
    return last_hidden
```

### 6.4 Creating Masks from Lengths

For attention mechanisms, we need to mask out padding positions:

```python
def create_mask(lengths: torch.Tensor, max_len: int = None) -> torch.Tensor:
    """
    Create a boolean mask where True = padding position (to be ignored).

    Args:
        lengths: (B,) actual sequence lengths
        max_len: maximum length (default: max of lengths)
    Returns:
        mask: (B, max_len) boolean tensor
    """
    if max_len is None:
        max_len = lengths.max().item()
    # (1, max_len) >= (B, 1) -> (B, max_len)
    mask = torch.arange(max_len, device=lengths.device).unsqueeze(0) >= \
           lengths.unsqueeze(1)
    return mask

# Example:
lengths = torch.tensor([3, 5, 2])
mask = create_mask(lengths, max_len=5)
# tensor([[False, False, False,  True,  True],
#          [False, False, False, False, False],
#          [False, False,  True,  True,  True]])
```

---

## 7. Practice Problems

### Problem 7.1
Implement full BPTT from scratch (without autograd) for a vanilla RNN with $n = 4$, $d = 3$, $T = 10$, using MSE loss. Compare your gradients with PyTorch autograd. They should agree to within $10^{-6}$.

### Problem 7.2
Implement truncated BPTT with truncation length $K = 3$ for the same RNN. Train on a sequence classification task and compare convergence speed with full BPTT (using $K = T$).

### Problem 7.3
For the LSTM from Exercise 4.4, relax the constraint: let $f_t \in \{0.8, 0.9, 0.95, 0.99, 1.0\}$ (constant across time). Compute $\frac{\partial c_{100}}{\partial c_1}$ for each case. Plot the gradient magnitude as a function of $f$ and compare with the vanilla RNN case.

### Problem 7.4
Implement the gradient flow monitoring function from Lecture 03a, Section 5.3. Apply it to both a vanilla RNN and an LSTM on a sequence copying task ($T = 50$). Plot $\|\delta h_t\|$ as a function of $t$ for both architectures on the same graph. Explain the difference.

### Problem 7.5
Consider a GRU cell. Derive the backward pass analogous to the LSTM backward pass in Section 3 of this recitation. Identify which term corresponds to the "gradient highway" and compare with the LSTM.

---

## Solutions to Practice Problems

### Solution 7.1

```python
import torch
import torch.nn as nn

def manual_bptt(x, y, W_hh, W_xh, W_hy, b_h, b_y, h0):
    """
    Manual BPTT implementation for verification.

    Args:
        x:     (T, d) input sequence
        y:     (T, m) targets
        W_hh:  (n, n)
        W_xh:  (n, d)
        W_hy:  (m, n)
        b_h:   (n,)
        b_y:   (m,)
        h0:    (n,)
    Returns:
        loss, gradients dict
    """
    T = x.shape[0]
    n = W_hh.shape[0]

    # Forward pass: store everything
    zs = []    # pre-activations
    hs = [h0]  # hidden states (h_0 through h_T)
    os = []    # outputs
    loss = 0.0

    for t in range(T):
        z_t = W_hh @ hs[t] + W_xh @ x[t] + b_h   # (n,)
        h_t = torch.tanh(z_t)                       # (n,)
        o_t = W_hy @ h_t + b_y                      # (m,)
        l_t = 0.5 * ((o_t - y[t]) ** 2).sum()       # MSE

        zs.append(z_t)
        hs.append(h_t)
        os.append(o_t)
        loss += l_t

    # Backward pass
    dW_hh = torch.zeros_like(W_hh)
    dW_xh = torch.zeros_like(W_xh)
    dW_hy = torch.zeros_like(W_hy)
    db_h = torch.zeros_like(b_h)
    db_y = torch.zeros_like(b_y)
    dh_future = torch.zeros(n)

    for t in range(T - 1, -1, -1):
        # Gradient from output loss
        do_t = os[t] - y[t]                          # (m,)
        dh_local = W_hy.t() @ do_t                   # (n,)

        # Total gradient at h_t
        dh_t = dh_local + dh_future                   # (n,)

        # Through tanh
        dz_t = dh_t * (1 - hs[t + 1] ** 2)           # (n,)

        # Accumulate
        dW_hh += dz_t.unsqueeze(1) @ hs[t].unsqueeze(0)  # (n, n)
        dW_xh += dz_t.unsqueeze(1) @ x[t].unsqueeze(0)    # (n, d)
        dW_hy += do_t.unsqueeze(1) @ hs[t + 1].unsqueeze(0)  # (m, n)
        db_h += dz_t
        db_y += do_t

        # Propagate backward
        dh_future = W_hh.t() @ dz_t                  # (n,)

    return loss, {
        'W_hh': dW_hh, 'W_xh': dW_xh, 'W_hy': dW_hy,
        'b_h': db_h, 'b_y': db_y
    }


# Verification
torch.manual_seed(42)
n, d, m, T = 4, 3, 2, 10

x = torch.randn(T, d)
y = torch.randn(T, m)
h0 = torch.zeros(n)

# Parameters (shared between manual and autograd)
W_hh = torch.randn(n, n, requires_grad=True)
W_xh = torch.randn(n, d, requires_grad=True)
W_hy = torch.randn(m, n, requires_grad=True)
b_h = torch.zeros(n, requires_grad=True)
b_y = torch.zeros(m, requires_grad=True)

# Manual BPTT
loss_manual, grads_manual = manual_bptt(
    x, y, W_hh.detach(), W_xh.detach(), W_hy.detach(),
    b_h.detach(), b_y.detach(), h0
)

# Autograd BPTT
h = h0
loss_auto = 0.0
for t in range(T):
    z = W_hh @ h + W_xh @ x[t] + b_h
    h = torch.tanh(z)
    o = W_hy @ h + b_y
    loss_auto += 0.5 * ((o - y[t]) ** 2).sum()

loss_auto.backward()

# Compare
print(f"Loss manual: {loss_manual.item():.6f}")
print(f"Loss auto:   {loss_auto.item():.6f}")
print(f"dW_hh max diff: {(grads_manual['W_hh'] - W_hh.grad).abs().max():.2e}")
print(f"dW_xh max diff: {(grads_manual['W_xh'] - W_xh.grad).abs().max():.2e}")
print(f"dW_hy max diff: {(grads_manual['W_hy'] - W_hy.grad).abs().max():.2e}")

# Expected output: all diffs < 1e-6
```

### Solution 7.3 (Sketch)

For constant forget gate $f$:
$$\frac{\partial c_{100}}{\partial c_1} = f^{99} \cdot I$$

| $f$ | $f^{99}$ | Gradient preserved? |
|-----|---------|---------------------|
| 0.80 | $2.0 \times 10^{-10}$ | Vanished |
| 0.90 | $2.9 \times 10^{-5}$ | Nearly vanished |
| 0.95 | $5.9 \times 10^{-3}$ | Small but nonzero |
| 0.99 | $0.370$ | Significant |
| 1.00 | $1.000$ | Perfect |

Compare with vanilla RNN (eigenvalue 0.9): $0.9^{99} = 2.9 \times 10^{-5}$, which matches the LSTM with $f = 0.9$. The LSTM's advantage is that it can **learn** to set $f$ close to 1 for important information, while the vanilla RNN's "effective forget gate" is determined by the fixed eigenvalue structure of $W_{hh}$.
