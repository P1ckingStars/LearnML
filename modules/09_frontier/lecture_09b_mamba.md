# Lecture 09b: Mamba — Selective State-Space Models

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Identify** the key limitation of linear time-invariant (LTI) SSMs: the inability to perform content-based reasoning, and explain why input-dependent (selective) parameters are needed.
2. **Derive** the selective SSM mechanism where $B$, $C$, and $\Delta$ are functions of the input $x$, and analyze how this breaks the convolutional equivalence.
3. **Explain** the hardware-aware parallel scan algorithm that enables efficient computation of selective SSMs on modern GPUs.
4. **Describe** the full Mamba architecture: the interplay of selective SSM, gating, and depthwise convolution.
5. **Compare** Mamba and Transformer architectures in terms of computational complexity, memory usage, and empirical performance across different modalities.
6. **Discuss** Mamba-2 and its connection to structured (masked) attention, unifying SSMs and attention.

---

## 2. Motivation and Context

### 2.1 The Limitation of LTI Systems

Recall from Lecture 09a that S4 and related models are **linear time-invariant** (LTI): the state-space parameters $A, B, C$ are fixed regardless of the input. This means the same convolution kernel is applied to every input sequence. While this enables efficient FFT-based computation, it fundamentally limits the model's ability to perform **content-based reasoning**.

**Example: Selective Copying Task.** Consider a sequence `[a, _, b, _, _, c, COPY, ?, ?, ?]` where the model must copy exactly the non-blank tokens. An LTI system applies the same filter regardless of whether a token is relevant (`a`, `b`, `c`) or irrelevant (`_`). It cannot selectively attend to certain positions based on their content.

**Example: Induction Heads.** In-context learning in Transformers relies on induction heads that perform pattern matching: "find the previous occurrence of the current token and copy what came after it." This requires comparing the current input with the stored context -- fundamentally a content-dependent operation that LTI systems cannot express.

### 2.2 The Selection Mechanism Intuition

The key insight of Mamba is that making the SSM parameters **input-dependent** allows the model to:

1. **Filter irrelevant information**: When $\Delta \to 0$, the state is not updated ($\bar{A} \to I$, $\bar{B} \to 0$), effectively ignoring the current input.
2. **Store relevant information**: When $\Delta$ is large, the state is strongly updated with the current input.
3. **Content-based routing**: Since $B$ and $C$ depend on the input, different inputs project into and out of the state space differently.

This is analogous to the gating mechanism in LSTMs, but derived from continuous-time principles rather than ad hoc design.

### 2.3 Historical Context

Mamba (Gu and Dao, 2023) was the first SSM to match Transformer performance on language modeling at scale. Its key contributions are:

1. The **selection mechanism** (input-dependent SSM parameters).
2. A **hardware-aware algorithm** that avoids materializing the full state in HBM.
3. A **simplified architecture** that removes the need for attention and MLP blocks entirely.

Mamba-2 (Dao and Gu, 2024) subsequently revealed a deep connection between selective SSMs and a form of structured (linear) attention, unifying the two paradigms.

---

## 3. Core Theory

### 3.1 From LTI to Selective SSMs

**Definition 3.1 (LTI SSM, Review).** A linear time-invariant SSM processes an input sequence $u \in \mathbb{R}^{L \times H}$ via:

$$x_k = \bar{A}x_{k-1} + \bar{B}u_k, \quad y_k = Cx_k$$

where $\bar{A}, \bar{B}, C$ are **constant** across time steps (though they vary across channels $h = 1, \ldots, H$).

**Definition 3.2 (Selective SSM).** A selective SSM makes the parameters functions of the input:

$$B_k = s_B(u_k), \quad C_k = s_C(u_k), \quad \Delta_k = s_\Delta(u_k)$$

where $s_B: \mathbb{R}^H \to \mathbb{R}^{H \times N}$, $s_C: \mathbb{R}^H \to \mathbb{R}^{H \times N}$, and $s_\Delta: \mathbb{R}^H \to \mathbb{R}^H$ are learned projection functions (typically linear layers followed by appropriate activations).

The discretized recurrence becomes time-varying:

$$\bar{A}_k = \exp(A \cdot \Delta_k), \quad \bar{B}_k = (\bar{A}_k - I) \odot A^{-1} \odot B_k \cdot \Delta_k$$
$$x_k = \bar{A}_k x_{k-1} + \bar{B}_k u_k$$
$$y_k = C_k x_k$$

**Remark.** The state matrix $A$ remains **input-independent** (constant). This is deliberate: $A$ determines the system dynamics and should be learned as a stable, structured matrix (e.g., diagonal with negative real parts). The selectivity comes from $B_k$ (what to write into the state), $C_k$ (what to read from the state), and $\Delta_k$ (how much to update).

### 3.2 The Selection Mechanism in Detail

**Theorem 3.1 (Selection as Gating).** The discretization step $\Delta_k$ acts as a gate controlling the trade-off between memory retention and input incorporation.

**Proof.** Consider a single state dimension with scalar $\bar{A}_k = e^{a \Delta_k}$ where $a < 0$:

- When $\Delta_k \to 0$: $\bar{A}_k \to 1$ and $\bar{B}_k \to 0$. The recurrence becomes $x_k \approx x_{k-1}$: the state is preserved unchanged (ignore input).
- When $\Delta_k \to \infty$: $\bar{A}_k \to 0$ and $\bar{B}_k \to -a^{-1}B_k\Delta_k$. The recurrence becomes $x_k \approx \bar{B}_ku_k$: the state is reset to the current input (forget history).
- Intermediate $\Delta_k$: smooth interpolation between these extremes.

This is directly analogous to the forget gate $f_t$ and input gate $i_t$ in an LSTM:

| LSTM | Selective SSM |
|------|--------------|
| $f_t = \sigma(W_f [h_{t-1}, x_t])$ | $\bar{A}_k = \exp(A \cdot \Delta_k)$ |
| $i_t = \sigma(W_i [h_{t-1}, x_t])$ | $\bar{B}_k = (\bar{A}_k - I) / A \cdot B_k$ |
| $f_t + i_t \approx 1$ (common constraint) | $\bar{A}_k + \Delta_k \bar{B}_k / B_k \approx 1$ (from discretization) |

The discretization naturally couples the forget and input gates, unlike LSTMs where they are independent. $\blacksquare$

### 3.3 Breaking the Convolutional Equivalence

**Proposition 3.1.** A selective SSM (with time-varying $B_k, C_k, \Delta_k$) does **not** admit a fixed convolution kernel and therefore cannot be computed via FFT.

**Proof.** In the LTI case, $y_k = \sum_{j=0}^k C\bar{A}^{k-j}\bar{B}u_j = (K * u)_k$ where $K_i = C\bar{A}^i\bar{B}$ is a fixed kernel. In the selective case:

$$y_k = C_k x_k = C_k \sum_{j=0}^k \left(\prod_{i=j+1}^k \bar{A}_i\right) \bar{B}_j u_j$$

The "kernel" $K_{k,j} = C_k \left(\prod_{i=j+1}^k \bar{A}_i\right) \bar{B}_j$ depends on **both** $k$ and $j$ independently (not just on $k - j$), making it a general matrix-vector product rather than a convolution. $\blacksquare$

**Consequence.** We need a different parallel algorithm. The solution is the **parallel scan** (also called parallel prefix sum), which can compute the linear recurrence in $O(L \log L)$ work and $O(\log L)$ depth.

### 3.4 Hardware-Aware Parallel Scan

The naive approach to computing the selective SSM would materialize the full state $x_k \in \mathbb{R}^{B \times L \times H \times N}$ in GPU high-bandwidth memory (HBM), where $B$ is batch size, $L$ is sequence length, $H$ is model dimension, and $N$ is state dimension. For typical values ($B = 64, L = 8192, H = 2048, N = 16$), this requires $\sim 128$ GB, far exceeding GPU memory.

**The Mamba Algorithm (Hardware-Aware Scan).** The key optimization is to:

1. **Fuse** the discretization, scan, and output computation into a single CUDA kernel.
2. **Keep the state in SRAM** (on-chip memory, $\sim 20$ MB per SM on A100) rather than HBM.
3. **Process the sequence in chunks** that fit in SRAM.

```
Algorithm: HARDWARE_AWARE_SELECTIVE_SCAN
Input: u ∈ R^(B,L,H), A ∈ R^(H,N), B_proj, C_proj, Δ_proj (linear layers)
Output: y ∈ R^(B,L,H)

// All operations fused into a single kernel:
1. Load parameters from HBM to SRAM:
   Δ = softplus(Δ_proj(u))       // (B, L, H) -- in SRAM
   B = B_proj(u)                   // (B, L, N) -- in SRAM
   C = C_proj(u)                   // (B, L, N) -- in SRAM

2. Discretize in SRAM:
   A_bar[k] = exp(A ⊙ Δ[k])      // (B, L, H, N)
   B_bar[k] = Δ[k] ⊙ B[k]        // (B, L, H, N) -- simplified

3. Parallel scan in SRAM:
   // For each (batch, hidden) pair, scan over L:
   x[k] = A_bar[k] ⊙ x[k-1] + B_bar[k] ⊙ u[k]  // state in SRAM
   y[k] = (C[k] * x[k]).sum(dim=N)                  // output

4. Write y to HBM                  // Only the output leaves SRAM

IO Complexity: O(BLH + BLN) HBM reads/writes (no O(BLHN) materialization)
Compute: O(BLH N log L) with parallel scan
```

**Memory Savings.** The state $x_k \in \mathbb{R}^{H \times N}$ is kept in SRAM and never materialized fully in HBM. Only the input $u$ and output $y$ (both $\mathbb{R}^{B \times L \times H}$) reside in HBM. This reduces memory from $O(BLHN)$ to $O(BLH + BHN)$.

### 3.5 The Selective SSM as a Structured Matrix

**Theorem 3.2 (SSM-Attention Connection).** The selective SSM computes a matrix-vector product $y = M u$ where $M \in \mathbb{R}^{L \times L}$ is a structured matrix:

$$M_{k,j} = \begin{cases} C_k^T \left(\prod_{i=j+1}^{k} \text{diag}(\bar{A}_i)\right) \bar{B}_j & \text{if } k \geq j \\ 0 & \text{if } k < j \end{cases}$$

This matrix is:
- **Causal**: lower-triangular (zero above the diagonal).
- **Low-rank per entry**: each entry is a product of $N$-dimensional vectors (rank $\leq N$).
- **Semiseparable**: a matrix where every submatrix of the lower-triangular part has rank $\leq N$.

**Connection to attention.** Self-attention computes $y = \text{softmax}(QK^T/\sqrt{d}) V$, where $\text{softmax}(QK^T/\sqrt{d})$ is also a lower-triangular matrix (with causal masking). The key difference is:

| Property | Attention | Selective SSM |
|----------|-----------|--------------|
| Matrix structure | Low-rank ($QK^T$) + softmax | Semiseparable (rank $N$) |
| Computation | $O(L^2 d)$ | $O(LNd)$ via scan |
| Entries | $\exp(q_i^T k_j)$ (normalized) | $C_i^T (\prod \bar{A}) \bar{B}_j$ |

This connection is made precise in Mamba-2.

---

## 4. Algorithmic Derivation

### 4.1 Mamba Architecture

```
Algorithm: MAMBA_BLOCK
Input: x ∈ R^(B, L, D) -- input sequence
Output: y ∈ R^(B, L, D) -- output sequence
Hyperparameters: D (model dim), E = 2D (expanded dim), N (state dim), d_conv (conv width)

1. Linear projections (no bias):
   x_proj = Linear_D→E(x)                // (B, L, E) -- "x branch"
   z = Linear_D→E(x)                     // (B, L, E) -- "z branch" (gate)

2. Short convolution on x branch:
   x_conv = DepthwiseConv1d(x_proj, width=d_conv)  // (B, L, E)
   x_conv = SiLU(x_conv)                            // (B, L, E)

3. SSM parameter projections from x_conv:
   B = Linear_E→N(x_conv)                // (B, L, N) -- input-dependent
   C = Linear_E→N(x_conv)                // (B, L, N) -- input-dependent
   Δ = softplus(Linear_E→1(x_conv))      // (B, L, E) -- input-dependent

4. Selective scan:
   y_ssm = SelectiveScan(x_conv, A, B, C, Δ)  // (B, L, E)
   // A ∈ R^(E, N) is a learned, input-independent parameter

5. Gating:
   y_gated = y_ssm ⊙ SiLU(z)            // (B, L, E) -- element-wise gate

6. Output projection:
   y = Linear_E→D(y_gated)               // (B, L, D)

7. Return y

Parameter count per block:
- Input projections: 2 × D × E = 4D²
- Conv1d: E × d_conv ≈ 2D × 4 = 8D
- SSM projections: E × N + E × N + E × 1 ≈ 2EN + E
- A: E × N
- Output projection: E × D = 2D²
- Total: ≈ 6D² + 4EN + 8D (dominated by 6D² for large D)
```

### 4.2 Selective Scan (Detailed)

```
Algorithm: SELECTIVE_SCAN
Input: u ∈ R^(B, L, E), A ∈ R^(E, N), B ∈ R^(B, L, N),
       C ∈ R^(B, L, N), Δ ∈ R^(B, L, E)
Output: y ∈ R^(B, L, E)

1. Discretize (element-wise):
   A_bar[b,l,e,n] = exp(A[e,n] × Δ[b,l,e])     // (B, L, E, N)
   B_bar[b,l,e,n] = Δ[b,l,e] × B[b,l,n]         // (B, L, E, N)

2. Form scan inputs:
   // For each (b, e) pair, we have a length-L sequence of (a, b) pairs:
   //   a_k = A_bar[b, k, e, :]  ∈ R^N  (diagonal multiply)
   //   b_k = B_bar[b, k, e, :] × u[b, k, e]  ∈ R^N

3. Parallel prefix scan over L:
   x[b, 0, e, :] = B_bar[b, 0, e, :] × u[b, 0, e]
   for k = 1, ..., L-1 (in parallel via scan):
       x[b, k, e, :] = A_bar[b, k, e, :] ⊙ x[b, k-1, e, :]
                      + B_bar[b, k, e, :] × u[b, k, e]

4. Read out:
   y[b, k, e] = Σ_n C[b, k, n] × x[b, k, e, n]  // (B, L, E)

5. Return y

Complexity: O(BLEN log L) with parallel scan, O(BLEN) work
```

### 4.3 Full Mamba Model

```
Algorithm: MAMBA_MODEL
Input: tokens ∈ Z^(B, L)
Output: logits ∈ R^(B, L, V) where V is vocabulary size
Hyperparameters: n_layers, D, N, d_conv

1. x = Embedding(tokens)                 // (B, L, D)
2. for layer = 1, ..., n_layers:
       x = x + MambaBlock(RMSNorm(x))    // Residual + pre-norm
3. x = RMSNorm(x)                        // Final norm
4. logits = Linear_D→V(x)                // (B, L, V) -- tied with embedding
5. Return logits

Total FLOPs per token: ≈ 12D² + 4DEN per layer
(Compare Transformer: ≈ 12D² + 2D × L per layer for attention)
```

### 4.4 Complexity Comparison: Mamba vs Transformer

| Operation | Transformer | Mamba |
|-----------|------------|-------|
| Attention/SSM | $O(L^2 D)$ | $O(L D N \log L)$ |
| FFN/Gate | $O(L D^2)$ | $O(L D^2)$ (in projections) |
| Per-step inference | $O(LD + D^2)$ | $O(DN + D^2)$ |
| KV cache memory | $O(L D)$ per layer | $O(DN)$ per layer |
| Total inference memory | $O(n_{layers} \cdot L \cdot D)$ | $O(n_{layers} \cdot D \cdot N)$ |

For typical values ($D = 2048, N = 16, L = 8192$):
- Transformer KV cache: $\sim 128$ MB per layer
- Mamba state: $\sim 0.25$ MB per layer (512x smaller)

---

## 5. PyTorch Implementation

### 5.1 Selective SSM Layer

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class SelectiveSSM(nn.Module):
    """
    Selective State-Space Model (the core of Mamba).

    Unlike S4's LTI SSM, the parameters B, C, and Δ are input-dependent,
    enabling content-based reasoning.
    """
    def __init__(self, d_inner: int, d_state: int = 16, dt_rank: int = None,
                 dt_min: float = 0.001, dt_max: float = 0.1, dt_init: str = "random"):
        """
        Args:
            d_inner: Expanded model dimension (E)
            d_state: SSM state dimension (N)
            dt_rank: Rank of Δ projection (default: ceil(d_inner / 16))
            dt_min: Min discretization step
            dt_max: Max discretization step
        """
        super().__init__()
        self.d_inner = d_inner  # E
        self.d_state = d_state  # N
        self.dt_rank = dt_rank or math.ceil(d_inner / 16)

        # A is NOT input-dependent; parameterized as log for stability
        # Shape: (E, N)
        A = torch.arange(1, d_state + 1, dtype=torch.float32).unsqueeze(0).expand(d_inner, -1)
        self.log_A = nn.Parameter(torch.log(A))  # (E, N)

        # Projections for input-dependent B, C, Δ
        # Combined into a single linear for efficiency
        # Projects from E -> dt_rank + 2*N
        self.x_proj = nn.Linear(d_inner, self.dt_rank + 2 * d_state, bias=False)  # (E) -> (dt_rank + 2N)

        # Δ projection: dt_rank -> E
        self.dt_proj = nn.Linear(self.dt_rank, d_inner, bias=True)  # (dt_rank) -> (E)

        # Initialize dt_proj bias for proper Δ range
        dt = torch.exp(
            torch.rand(d_inner) * (math.log(dt_max) - math.log(dt_min)) + math.log(dt_min)
        )
        # Inverse of softplus: log(exp(x) - 1)
        inv_softplus_dt = torch.log(torch.exp(dt) - 1.0).clamp(min=-4.0)
        with torch.no_grad():
            self.dt_proj.bias.copy_(inv_softplus_dt)

        # D: skip connection
        self.D = nn.Parameter(torch.ones(d_inner))  # (E,)

    def forward(self, x):
        """
        Args:
            x: Input of shape (B, L, E) -- already expanded and convolved
        Returns:
            y: Output of shape (B, L, E)
        """
        B_batch, L, E = x.shape
        N = self.d_state

        # Project to get B, C, Δ (all input-dependent)
        x_dbl = self.x_proj(x)                            # (B, L, dt_rank + 2N)

        dt_input = x_dbl[:, :, :self.dt_rank]             # (B, L, dt_rank)
        B = x_dbl[:, :, self.dt_rank:self.dt_rank + N]    # (B, L, N)
        C = x_dbl[:, :, self.dt_rank + N:]                # (B, L, N)

        # Δ: project and apply softplus
        dt = F.softplus(self.dt_proj(dt_input))            # (B, L, E)

        # Discretize
        A = -self.log_A.exp()                              # (E, N)
        # A_bar = exp(A * dt): (B, L, E, N)
        A_bar = torch.exp(
            A.unsqueeze(0).unsqueeze(0) * dt.unsqueeze(-1) # (1, 1, E, N) * (B, L, E, 1)
        )                                                  # (B, L, E, N)

        # B_bar = dt * B (simplified ZOH for small dt)
        # (B, L, E, 1) * (B, L, 1, N) -> (B, L, E, N)
        B_bar = dt.unsqueeze(-1) * B.unsqueeze(-2).expand(-1, -1, E, -1)
        # Alternatively: B_bar[b,l,e,n] = dt[b,l,e] * B[b,l,n]

        # Sequential scan (for clarity; production uses parallel scan)
        y = self._sequential_scan(x, A_bar, B_bar, C)     # (B, L, E)

        # Skip connection
        y = y + self.D.unsqueeze(0).unsqueeze(0) * x       # (B, L, E)

        return y

    def _sequential_scan(self, u, A_bar, B_bar, C):
        """
        Sequential scan for correctness verification.

        Args:
            u: (B, L, E)
            A_bar: (B, L, E, N)
            B_bar: (B, L, E, N)
            C: (B, L, N)
        Returns:
            y: (B, L, E)
        """
        B_batch, L, E = u.shape
        N = self.d_state

        x = torch.zeros(B_batch, E, N, device=u.device)    # (B, E, N) state
        outputs = []

        for k in range(L):
            # x = A_bar * x + B_bar * u
            x = A_bar[:, k] * x + B_bar[:, k] * u[:, k].unsqueeze(-1)
            # (B, E, N) = (B, E, N) * (B, E, N) + (B, E, N) * (B, E, 1)

            # y = (C * x).sum(N)
            y_k = (C[:, k].unsqueeze(1) * x).sum(-1)       # (B, E)
            # (B, 1, N) * (B, E, N) -> (B, E, N) -> sum -> (B, E)
            outputs.append(y_k)

        return torch.stack(outputs, dim=1)                  # (B, L, E)

    def _parallel_scan(self, u, A_bar, B_bar, C):
        """
        Parallel scan using torch operations.
        For true efficiency, this should be a custom CUDA kernel.

        This implementation uses the associative scan pattern.
        """
        B_batch, L, E = u.shape
        N = self.d_state

        # Form scan elements: (a_k, b_k) where
        # a_k = A_bar[:, k]  (B, E, N)
        # b_k = B_bar[:, k] * u[:, k, :, None]  (B, E, N)

        a = A_bar                                           # (B, L, E, N)
        b = B_bar * u.unsqueeze(-1)                         # (B, L, E, N)

        # Blelloch scan
        n_levels = int(math.ceil(math.log2(L)))

        # Pad to power of 2
        L_pad = 2 ** n_levels
        if L_pad > L:
            pad_a = torch.ones(B_batch, L_pad - L, E, N, device=u.device)
            pad_b = torch.zeros(B_batch, L_pad - L, E, N, device=u.device)
            a = torch.cat([a, pad_a], dim=1)
            b = torch.cat([b, pad_b], dim=1)

        # Up-sweep
        for d in range(n_levels):
            stride = 2 ** (d + 1)
            left = torch.arange(2**d - 1, L_pad, stride, device=u.device)
            right = left + 2**d
            right = right[right < L_pad]
            left = left[:right.shape[0]]

            # (a_r, b_r) • (a_l, b_l) = (a_r * a_l, a_r * b_l + b_r)
            b[:, right] = a[:, right] * b[:, left] + b[:, right]
            a[:, right] = a[:, right] * a[:, left]

        # The result b[:, k] now contains x_k for certain indices
        # Full down-sweep needed for all indices (omitted for brevity)

        # Read out
        x = b[:, :L]                                        # (B, L, E, N)
        y = (C.unsqueeze(2) * x).sum(-1)                    # (B, L, E)

        return y
```

### 5.2 Mamba Block

```python
class MambaBlock(nn.Module):
    """
    Full Mamba block: linear projections + conv + selective SSM + gating.

    Architecture:
        x -> [Linear -> Conv1d -> SiLU -> SelectiveSSM] ⊙ [Linear -> SiLU] -> Linear -> y
              "x branch"                                    "z branch (gate)"
    """
    def __init__(self, d_model: int, d_state: int = 16, d_conv: int = 4,
                 expand: int = 2, dropout: float = 0.0):
        """
        Args:
            d_model: Model dimension (D)
            d_state: SSM state dimension (N)
            d_conv: Local convolution width
            expand: Expansion factor for inner dimension
        """
        super().__init__()
        self.d_model = d_model      # D
        self.d_inner = d_model * expand  # E = 2D
        self.d_state = d_state      # N
        self.d_conv = d_conv

        # Input projections: D -> 2E (split into x and z branches)
        self.in_proj = nn.Linear(d_model, 2 * self.d_inner, bias=False)  # D -> 2E

        # Depthwise convolution on x branch
        self.conv1d = nn.Conv1d(
            in_channels=self.d_inner,    # E
            out_channels=self.d_inner,   # E
            kernel_size=d_conv,
            padding=d_conv - 1,          # Causal padding
            groups=self.d_inner,         # Depthwise
            bias=True,
        )

        # Selective SSM
        self.ssm = SelectiveSSM(
            d_inner=self.d_inner,
            d_state=d_state,
        )

        # Output projection: E -> D
        self.out_proj = nn.Linear(self.d_inner, d_model, bias=False)  # E -> D

        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        """
        Args:
            x: (B, L, D)
        Returns:
            y: (B, L, D)
        """
        B, L, D = x.shape

        # Project and split into x and z branches
        xz = self.in_proj(x)                               # (B, L, 2E)
        x_branch, z = xz.chunk(2, dim=-1)                  # (B, L, E) each

        # x branch: Conv1d + SiLU + SSM
        # Conv1d expects (B, C, L) format
        x_branch = x_branch.transpose(1, 2)                # (B, E, L)
        x_branch = self.conv1d(x_branch)[:, :, :L]         # (B, E, L) causal: truncate
        x_branch = x_branch.transpose(1, 2)                # (B, L, E)
        x_branch = F.silu(x_branch)                        # (B, L, E)

        # Selective SSM
        x_branch = self.ssm(x_branch)                      # (B, L, E)

        # Gate with z branch
        z = F.silu(z)                                       # (B, L, E)
        y = x_branch * z                                    # (B, L, E)

        # Output projection
        y = self.out_proj(y)                                # (B, L, D)
        y = self.dropout(y)

        return y


class RMSNorm(nn.Module):
    """Root Mean Square Layer Normalization."""
    def __init__(self, d_model: int, eps: float = 1e-6):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(d_model))
        self.eps = eps

    def forward(self, x):
        # x: (B, L, D)
        rms = torch.sqrt(torch.mean(x ** 2, dim=-1, keepdim=True) + self.eps)
        return x / rms * self.weight
```

### 5.3 Full Mamba Language Model

```python
class MambaLM(nn.Module):
    """
    Mamba language model.

    Architecture: Embedding -> [RMSNorm -> MambaBlock] × n_layers -> RMSNorm -> LM Head
    """
    def __init__(self, vocab_size: int, d_model: int = 768, n_layers: int = 12,
                 d_state: int = 16, d_conv: int = 4, expand: int = 2,
                 dropout: float = 0.0):
        super().__init__()
        self.d_model = d_model

        self.embedding = nn.Embedding(vocab_size, d_model)

        self.layers = nn.ModuleList([
            nn.ModuleDict({
                'norm': RMSNorm(d_model),
                'mamba': MambaBlock(d_model, d_state, d_conv, expand, dropout),
            })
            for _ in range(n_layers)
        ])

        self.norm_f = RMSNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

        # Weight tying
        self.lm_head.weight = self.embedding.weight

        # Initialize
        self.apply(self._init_weights)

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, std=0.02)

    def forward(self, input_ids):
        """
        Args:
            input_ids: (B, L) long tensor of token IDs
        Returns:
            logits: (B, L, V)
        """
        x = self.embedding(input_ids)                       # (B, L, D)

        for layer in self.layers:
            x = x + layer['mamba'](layer['norm'](x))        # (B, L, D) residual

        x = self.norm_f(x)                                  # (B, L, D)
        logits = self.lm_head(x)                            # (B, L, V)

        return logits

    def generate(self, input_ids, max_new_tokens: int = 100, temperature: float = 1.0):
        """
        Autoregressive generation using the recurrent form.

        Args:
            input_ids: (B, L) prompt tokens
            max_new_tokens: Number of tokens to generate
            temperature: Sampling temperature
        Returns:
            generated: (B, L + max_new_tokens)
        """
        # For simplicity, this uses the full forward pass (not cached recurrence)
        # A production implementation would cache the SSM states
        for _ in range(max_new_tokens):
            logits = self.forward(input_ids)                 # (B, L_current, V)
            next_logits = logits[:, -1, :] / temperature     # (B, V)
            probs = F.softmax(next_logits, dim=-1)           # (B, V)
            next_token = torch.multinomial(probs, 1)         # (B, 1)
            input_ids = torch.cat([input_ids, next_token], dim=1)
        return input_ids


def count_parameters(model):
    """Count total and trainable parameters."""
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Total parameters:     {total:>12,}")
    print(f"Trainable parameters: {trainable:>12,}")
    return total


# Demo
if __name__ == "__main__":
    model = MambaLM(vocab_size=32000, d_model=768, n_layers=12, d_state=16)
    count_parameters(model)

    # Test forward pass
    x = torch.randint(0, 32000, (2, 512))                   # (B=2, L=512)
    logits = model(x)                                        # (B=2, L=512, V=32000)
    print(f"Input shape:  {x.shape}")
    print(f"Output shape: {logits.shape}")
```

### 5.4 Selective Copying Task (Diagnostic)

```python
def create_selective_copying_data(B: int, L: int, n_tokens: int, vocab_size: int = 16):
    """
    Create data for the selective copying task.

    The model sees a sequence with n_tokens meaningful tokens interspersed
    with blanks, followed by a COPY token, and must reproduce the meaningful
    tokens in order.

    Args:
        B: Batch size
        L: Sequence length (before COPY section)
        n_tokens: Number of meaningful tokens to copy
        vocab_size: Number of distinct tokens (excluding BLANK and COPY)
    Returns:
        input_seq: (B, L + n_tokens + 1) -- input with COPY marker
        target: (B, n_tokens) -- tokens to reproduce
    """
    BLANK = vocab_size
    COPY = vocab_size + 1

    input_seq = torch.full((B, L), BLANK, dtype=torch.long)
    target = torch.randint(0, vocab_size, (B, n_tokens))

    # Place meaningful tokens at random positions
    for b in range(B):
        positions = torch.randperm(L)[:n_tokens].sort().values
        input_seq[b, positions] = target[b]

    # Append COPY marker and blank slots for output
    copy_marker = torch.full((B, 1), COPY, dtype=torch.long)
    output_slots = torch.full((B, n_tokens), BLANK, dtype=torch.long)
    input_seq = torch.cat([input_seq, copy_marker, output_slots], dim=1)

    return input_seq, target
```

---

## 6. Experimental Intuition

### 6.1 Language Modeling Scaling

Mamba matches Transformer performance on language modeling while being significantly more efficient:

| Model | Params | Training Tokens | Perplexity (Pile) | Throughput (tok/s) |
|-------|--------|----------------|-------------------|-------------------|
| Transformer (GPT-3 style) | 1.3B | 300B | 8.5 | 45K |
| Mamba | 1.3B | 300B | 8.3 | 68K |
| Transformer | 2.7B | 300B | 7.8 | 28K |
| Mamba | 2.7B | 300B | 7.7 | 42K |

Key observation: Mamba achieves comparable or slightly better perplexity with ~1.5x higher training throughput due to the lack of quadratic attention.

### 6.2 Inference Speed

The recurrent form gives Mamba a decisive advantage for long-context generation:

| Sequence Length | Transformer (ms/token) | Mamba (ms/token) | Speedup |
|----------------|----------------------|-----------------|---------|
| 512 | 2.1 | 1.8 | 1.2x |
| 2,048 | 4.5 | 1.8 | 2.5x |
| 8,192 | 12.3 | 1.9 | 6.5x |
| 32,768 | 45.1 | 1.9 | 23.7x |
| 131,072 | OOM | 2.0 | -- |

The Mamba generation speed is nearly constant because each step only reads and updates the fixed-size state $x \in \mathbb{R}^{D \times N}$, rather than the growing KV cache.

### 6.3 When Transformers Still Win

Despite Mamba's efficiency, Transformers retain advantages in certain settings:

1. **In-context learning with many examples**: Tasks requiring comparison across many distant examples (e.g., many-shot prompting) benefit from attention's ability to directly compare any two positions.
2. **Complex retrieval**: Finding a specific fact in a long context is easier with explicit attention than with a compressed state.
3. **Established ecosystem**: FlashAttention, KV cache quantization, speculative decoding, and other Transformer optimizations are mature.

### 6.4 Ablation: Impact of Selection

| Model Variant | Selective Copy | Induction Heads | LM PPL |
|--------------|---------------|-----------------|--------|
| S4 (LTI, no selection) | 50% (random) | FAIL | 9.1 |
| S4 + input-dependent B only | 72% | Partial | 8.8 |
| S4 + input-dependent Δ only | 85% | Partial | 8.6 |
| Mamba (full selection: B, C, Δ) | 99.8% | PASS | 8.3 |

The selection mechanism is crucial for content-based tasks.

---

## 7. Connections

### 7.1 Connections to Prior Lectures

- **Lecture 03b (LSTM/GRU)**: Mamba's selection mechanism is a principled, continuous-time analog of LSTM gating. The discretization step $\Delta_k$ replaces the sigmoid gates, with the coupling between forget and input gates arising naturally from the ZOH discretization.
- **Lecture 04a (Attention)**: The SSM-attention duality (Theorem 3.2) shows that selective SSMs compute a structured version of the attention matrix. Mamba-2 makes this precise.
- **Lecture 09a (S4)**: Mamba builds directly on S4 by adding input dependence. The trade-off: convolution mode is lost, but the parallel scan provides an efficient alternative.

### 7.2 Mamba-2: The SSD Framework

Mamba-2 (Dao and Gu, 2024) introduces the **State Space Duality (SSD)** framework, which shows that:

1. The selective SSM is equivalent to a form of **structured masked attention** where the attention matrix is constrained to be semiseparable (rank $\leq N$ in every submatrix).
2. This equivalence enables a new algorithm that uses **matrix multiplications** (matmuls) instead of parallel scan, better utilizing GPU tensor cores.
3. The SSD framework interpolates between pure SSM ($N$ small) and full attention ($N = L$).

The Mamba-2 architecture modifies the original Mamba block by:
- Using **multi-head** SSMs (analogous to multi-head attention).
- Replacing the parallel scan with a **chunk-wise** algorithm that processes the sequence in blocks of size $Q$ and uses matmuls within each block.
- Achieving 2--8x speedup over Mamba-1 with equivalent or better quality.

### 7.3 Forward Connections

- **Lecture 09c (MoE)**: Mamba + MoE is a natural combination: Mamba handles sequence mixing efficiently, while MoE scales the feedforward capacity. Models like Jamba (AI21) explore this direction.
- **Lecture 09d (Multimodal)**: SSMs are being explored for vision (Vim, VMamba) and audio, extending the Mamba architecture to non-text modalities.

---

## 8. Paper Reading List

### Required Reading

1. **Gu, A. and Dao, T.** (2023). "Mamba: Linear-Time Sequence Modeling with Selective State Spaces." *arXiv:2312.00752.*
   - The original Mamba paper. Focus on Sections 2 (selection mechanism), 3 (hardware-aware algorithm), and 4 (experiments).

2. **Dao, T. and Gu, A.** (2024). "Transformers are SSMs: Generalized Models and Efficient Algorithms through Structured State Space Duality." *ICML 2024.*
   - Mamba-2. Focus on the SSD framework (Section 3) and the connection to attention (Section 4).

### Recommended Reading

3. **Gu, A., Goel, K., and Re, C.** (2022). "Efficiently Modeling Long Sequences with Structured State Spaces." *ICLR 2022.*
   - S4, the foundation for Mamba. Reviewed in Lecture 09a.

4. **Poli, M., Massaroli, S., Nguyen, E., et al.** (2023). "Hyena Hierarchy: Towards Larger Convolutional Language Models." *ICML 2023.*
   - An alternative to attention using long convolutions, related to the convolutional view of SSMs.

5. **De, S., Smith, S.L., Fernando, A., et al.** (2024). "Griffin: Mixing Gated Linear Recurrences with Local Attention for Efficient Language Models." *arXiv:2402.19427.*
   - Google's hybrid model combining gated linear recurrences (related to Mamba) with local attention.

6. **Lieber, O., Lenz, B., Bata, H., et al.** (2024). "Jamba: A Hybrid Transformer-Mamba Language Model." *arXiv:2403.19887.*
   - Combines Mamba layers with Transformer layers and MoE, demonstrating practical hybrid architectures.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9b.1.** Consider a selective SSM with scalar state ($N = 1$), $A = -1$, and input-dependent $\Delta_k = \sigma(w^T u_k + b)$ where $\sigma$ is the softplus function.

(a) Write out the discrete recurrence $x_k = \bar{A}_k x_{k-1} + \bar{B}_k u_k$ explicitly in terms of $\Delta_k$.

(b) Show that when $\Delta_k \to 0$, the model ignores the input at step $k$.

(c) Show that when $\Delta_k \to \infty$, the model resets its state to depend only on $u_k$.

(d) Compare this behavior to the LSTM forget gate. What is the key structural difference?

**Exercise 9b.2.** Prove that the selective SSM output $y = Mu$ where $M$ is defined in Theorem 3.2 is a lower-triangular semiseparable matrix of rank $\leq N$. That is, show that every submatrix of the lower-triangular part of $M$ has rank at most $N$.

*Hint:* Write $M_{i,j} = C_i^T D_{i,j} B_j$ where $D_{i,j} = \prod_{k=j+1}^i \text{diag}(\bar{A}_k)$ is diagonal, and use the factorization $M = \text{tril}(\hat{C} \hat{B}^T)$ with appropriate $\hat{C}, \hat{B} \in \mathbb{R}^{L \times N}$.

**Exercise 9b.3.** The Mamba architecture does not use positional encodings. Explain why positional information is implicitly captured by the SSM recurrence. Under what conditions would explicit positional encodings be beneficial?

**Exercise 9b.4.** Mamba-2 shows that when $N = L$, the selective SSM becomes equivalent to (linear) attention. Explain why increasing $N$ increases the expressivity of the SSM but also increases computational cost. What is the optimal trade-off in practice?

### Implementation Exercises

**Exercise 9b.5.** Implement the selective copying task and train both a Mamba model and an S4 (LTI) model. Verify that:
(a) S4 fails (near-random accuracy) when the number of tokens to copy is large.
(b) Mamba succeeds with high accuracy.
Plot accuracy vs. sequence length for both models.

**Exercise 9b.6.** Implement a simple character-level language model using the `MambaLM` class and train it on a small text corpus (e.g., Shakespeare). Compare:
(a) Training loss curves with an LSTM and Transformer of similar parameter count.
(b) Inference speed (tokens/second) for generating 1000 tokens at different context lengths.
(c) Quality of generated text.

**Exercise 9b.7.** Implement the chunk-wise algorithm from Mamba-2:
(a) Divide the sequence into chunks of size $Q$.
(b) Within each chunk, compute the SSM output using matrix multiplications.
(c) Between chunks, propagate the state using the recurrence.
(d) Compare wall-clock time with the sequential scan for $L \in \{1024, 4096, 16384\}$.

### Proof Exercises

**Exercise 9b.8 (Challenge).** Prove the State Space Duality: show that for a selective SSM with diagonal $\bar{A}_k \in \mathbb{R}^{N \times N}$, the output matrix $M$ satisfies:

$$M = L \circ (C \cdot \text{diag}(\bar{A})_{\text{cumulative}} \cdot B^T)$$

where $L$ is the lower-triangular mask, $\circ$ is element-wise product, and the middle term involves cumulative products of the diagonal $\bar{A}$ matrices. Relate this to the linear attention formula $M = L \circ (QK^T)$.
