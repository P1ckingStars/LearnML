# Lecture 09c: Mixture of Experts

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** the sparse Mixture-of-Experts (MoE) layer and explain how it decouples model capacity (total parameters) from computational cost (FLOPs per token).
2. **Derive** the top-K routing mechanism, including the gating function, softmax normalization, and weighted expert combination.
3. **Prove** that naive routing leads to expert collapse and derive the auxiliary load-balancing loss that prevents it.
4. **Analyze** the expert capacity mechanism and token-dropping strategy, including their effects on training dynamics and model quality.
5. **Explain** the Switch Transformer (top-1 routing), GShard, and GLaM architectures, and their respective scaling strategies.
6. **Identify** the practical challenges of MoE training: communication overhead in distributed settings, training instability, and fine-tuning difficulties.

---

## 2. Motivation and Context

### 2.1 The Scaling Dilemma

Dense Transformer models have shown consistent improvements with scale: more parameters generally yield better performance (Kaplan et al., 2020). However, the computational cost of a dense model scales linearly with its parameter count -- every parameter is used for every input token. This creates a fundamental tension:

- **Want**: More parameters for higher capacity.
- **Constraint**: Fixed computational budget (FLOPs, latency, energy).

Mixture-of-Experts (MoE) resolves this by introducing **conditional computation**: for each input, only a small subset of the model's parameters are activated.

### 2.2 The MoE Principle

A standard feedforward layer applies the same function $f(\cdot)$ to every token:

$$y = f(x) = W_2 \cdot \text{ReLU}(W_1 x + b_1) + b_2$$

An MoE layer replaces this with $N$ parallel experts $\{f_1, f_2, \ldots, f_N\}$ and a gating function $G$ that selects $K \ll N$ experts per token:

$$y = \sum_{i \in \text{TopK}(G(x))} G(x)_i \cdot f_i(x)$$

**Key insight**: If each expert has the same architecture as the original FFN, the MoE layer has $N \times$ the parameters but approximately $K/N$ the computation per token (with routing overhead). For typical values ($N = 64$, $K = 2$), this gives a 32x parameter-to-compute ratio.

### 2.3 Historical Context

The MoE concept dates to Jacobs et al. (1991), who proposed it as a divide-and-conquer approach to function approximation. Shazeer et al. (2017) revived MoE for deep learning at scale, introducing the "Sparsely-Gated Mixture-of-Experts" layer within an LSTM language model. The Switch Transformer (Fedus et al., 2022) simplified routing to top-1 and demonstrated scaling to 1.6 trillion parameters. GShard (Lepikhin et al., 2021) and GLaM (Du et al., 2022) explored MoE for multilingual models and showed that MoE models can match dense model quality with far fewer FLOPs.

---

## 3. Core Theory

### 3.1 The MoE Layer

**Definition 3.1 (Mixture-of-Experts Layer).** Given input $x \in \mathbb{R}^d$, an MoE layer with $N$ experts and top-$K$ routing computes:

$$\text{MoE}(x) = \sum_{i=1}^{N} g_i(x) \cdot f_i(x)$$

where:

- $f_i: \mathbb{R}^d \to \mathbb{R}^d$ is the $i$-th expert (typically a feedforward network),
- $g_i(x)$ is the gating weight for expert $i$, with the constraint that $g_i(x) = 0$ for all but $K$ experts.

The sparsity constraint -- only $K$ of $N$ gates are nonzero -- is what makes the computation efficient.

### 3.2 The Gating Function

**Definition 3.2 (Top-K Softmax Gating).** The gating function is defined as:

$$h(x) = W_g x \in \mathbb{R}^N$$

$$G(x) = \text{TopK}(\text{softmax}(h(x)), K)$$

where $W_g \in \mathbb{R}^{N \times d}$ is the gating weight matrix, and $\text{TopK}$ zeros out all but the $K$ largest entries:

$$\text{TopK}(v, K)_i = \begin{cases} v_i & \text{if } v_i \text{ is among the top-}K \text{ values of } v \\ 0 & \text{otherwise} \end{cases}$$

**Renormalization.** After top-K selection, the nonzero gates are renormalized:

$$g_i(x) = \frac{\text{TopK}(\text{softmax}(h(x)), K)_i}{\sum_{j=1}^N \text{TopK}(\text{softmax}(h(x)), K)_j}$$

This ensures $\sum_i g_i(x) = 1$ over the selected experts.

**Remark on differentiability.** The $\text{TopK}$ operation is not differentiable with respect to the routing logits. In practice, the gradient flows through the softmax weights of the selected experts, and the gating network $W_g$ receives gradient signal only from the experts that were selected. This creates a "rich get richer" dynamic that leads to expert collapse without corrective measures.

### 3.3 Expert Collapse and Load Balancing

**Definition 3.3 (Expert Collapse).** Expert collapse occurs when the router consistently assigns tokens to a small subset of experts, leaving the remaining experts unused. In the extreme case, all tokens are routed to a single expert, and the MoE degenerates to a dense model.

**Why collapse occurs.** Consider the gradient of the loss with respect to the gating logits $h_i(x) = w_i^T x$:

$$\frac{\partial \mathcal{L}}{\partial w_i} = \sum_{x : i \in \text{TopK}(x)} \frac{\partial \mathcal{L}}{\partial g_i} \cdot \frac{\partial g_i}{\partial w_i} \cdot x$$

Experts that are selected more frequently receive more gradient updates, improving their output quality. The router then routes even more tokens to these improved experts, creating a positive feedback loop. Unused experts receive no gradients and stagnate.

**Theorem 3.1 (Load Balancing Loss).** To prevent expert collapse, we add an auxiliary loss that encourages uniform expert utilization. Given a batch of $T$ tokens $\{x_1, \ldots, x_T\}$, define:

$$f_i = \frac{1}{T}\sum_{t=1}^{T} \mathbf{1}[i \in \text{TopK}(G(x_t))]$$

This is the **fraction of tokens** routed to expert $i$.

$$p_i = \frac{1}{T}\sum_{t=1}^{T} \text{softmax}(h(x_t))_i$$

This is the **average routing probability** for expert $i$ (before top-K).

The load balancing loss is:

$$\mathcal{L}_{\text{balance}} = \alpha \cdot N \cdot \sum_{i=1}^{N} f_i \cdot p_i$$

where $\alpha$ is a hyperparameter (typically $\alpha \in [0.01, 0.1]$).

**Proof of optimality condition.** We show that $\mathcal{L}_{\text{balance}}$ is minimized when $f_i = p_i = 1/N$ for all $i$ (uniform routing).

By the Cauchy-Schwarz inequality:

$$\sum_{i=1}^N f_i \cdot p_i \geq \frac{(\sum_{i=1}^N \sqrt{f_i \cdot p_i})^2}{N}$$

Under the constraints $\sum_i f_i = K$ (each token selects $K$ experts) and $\sum_i p_i = 1$, the minimum of $\sum_i f_i \cdot p_i$ subject to these constraints is achieved when $f_i = K/N$ and $p_i = 1/N$ for all $i$, giving:

$$\sum_{i=1}^N \frac{K}{N} \cdot \frac{1}{N} = \frac{K}{N}$$

The factor of $N$ in the loss definition normalizes so that the minimum value is $K$, independent of $N$. $\blacksquare$

**Remark.** The product $f_i \cdot p_i$ is used rather than $f_i^2$ or $p_i^2$ because $f_i$ involves a non-differentiable indicator function ($\mathbf{1}[\cdot]$), while $p_i$ involves the differentiable softmax. The product allows gradients to flow through $p_i$ while the discrete assignment $f_i$ provides the target signal.

### 3.4 Expert Capacity and Token Dropping

**Definition 3.4 (Expert Capacity).** In a distributed setting where each expert resides on a different device, we need to bound the number of tokens each expert processes (to avoid load imbalance). The **expert capacity** is:

$$C = \left\lceil \frac{K \cdot T}{N} \cdot \text{CF} \right\rceil$$

where $T$ is the number of tokens in the batch, $K$ is the number of experts per token, $N$ is the total number of experts, and $\text{CF} \geq 1$ is the **capacity factor** (a hyperparameter, typically 1.0--1.5).

The term $KT/N$ is the expected number of tokens per expert under uniform routing. The capacity factor provides a buffer for non-uniformity.

**Token Dropping.** If more than $C$ tokens are routed to expert $i$, the excess tokens are **dropped**: they bypass the expert and are passed through via the residual connection only. Formally:

$$\hat{g}_i(x_t) = \begin{cases} g_i(x_t) & \text{if } x_t \text{ is within the first } C \text{ tokens routed to expert } i \\ 0 & \text{otherwise (token dropped)} \end{cases}$$

**Proposition 3.1 (Token dropping rate).** Under uniform routing, the probability that any token is dropped approaches 0 as $T \to \infty$ for $\text{CF} > 1$. Under non-uniform routing, the expected fraction of dropped tokens is:

$$\mathbb{E}[\text{drop rate}] = \sum_{i=1}^N \max(0, f_i - C/T) \cdot \frac{T}{KT}$$

The capacity factor $\text{CF}$ controls the trade-off between computational efficiency (lower $\text{CF}$, more drops, less computation) and model quality (higher $\text{CF}$, fewer drops, more computation).

### 3.5 Switch Transformer: Top-1 Routing

**Definition 3.5 (Switch Routing).** The Switch Transformer simplifies the gating to $K = 1$:

$$i^* = \arg\max_i\, h_i(x) = \arg\max_i\, (W_g x)_i$$
$$\text{MoE}(x) = \text{softmax}(h(x))_{i^*} \cdot f_{i^*}(x)$$

**Advantages of $K = 1$:**

1. **Reduced computation**: Each token is processed by exactly one expert (vs. $K$).
2. **Simplified routing**: No need to combine outputs from multiple experts.
3. **Reduced communication**: Each token is sent to one device only.
4. **Better scaling**: Switch Transformer showed that $K = 1$ with more experts ($N$) outperforms $K = 2$ with fewer experts at the same compute budget.

**Disadvantage:** Less gradient signal per training step (each expert sees fewer tokens). The Switch Transformer compensates with larger batch sizes and careful load balancing.

### 3.6 The Full Training Loss

The total loss for an MoE model is:

$$\mathcal{L}_{\text{total}} = \mathcal{L}_{\text{task}} + \alpha \cdot \mathcal{L}_{\text{balance}}$$

where $\mathcal{L}_{\text{task}}$ is the standard task loss (e.g., cross-entropy for language modeling) and $\mathcal{L}_{\text{balance}}$ is the load balancing auxiliary loss.

**Theorem 3.2 (Gradient of Load Balancing Loss).** The gradient of $\mathcal{L}_{\text{balance}}$ with respect to the router logits is:

$$\frac{\partial \mathcal{L}_{\text{balance}}}{\partial h_j(x_t)} = \alpha N \cdot f_j \cdot \frac{\partial p_j}{\partial h_j(x_t)}$$

Since $p_j = \frac{1}{T}\text{softmax}(h(x_t))_j$:

$$\frac{\partial p_j}{\partial h_j(x_t)} = \frac{1}{T} \text{softmax}(h(x_t))_j (1 - \text{softmax}(h(x_t))_j)$$

This shows that the load balancing loss pushes the router to reduce the probability of over-utilized experts ($f_j$ large) and increase the probability of under-utilized experts ($f_j$ small). $\blacksquare$

### 3.7 Expert Parallelism

**Definition 3.6 (Expert Parallelism).** In expert parallelism, each expert resides on a separate device (or a subset of devices). The forward pass involves:

1. **All-to-All communication (dispatch)**: Each device sends its tokens to the devices hosting their selected experts.
2. **Expert computation**: Each device computes its expert's output on the received tokens.
3. **All-to-All communication (combine)**: Each device receives back the expert outputs for its tokens.

**Communication cost.** For $P$ devices, $T$ tokens per device, hidden dimension $d$, and $K$ experts per token:

$$\text{Communication volume} = 2 \cdot P \cdot T \cdot d \cdot K / P = 2TdK \text{ per device}$$

(Factor of 2 for dispatch + combine.)

**Theorem 3.3 (Communication-Computation Balance).** The ratio of communication to computation in an MoE layer is:

$$\frac{\text{Communication}}{\text{Computation}} = \frac{2TdK}{T \cdot K \cdot 2d \cdot d_{\text{ff}} / P} = \frac{P}{d_{\text{ff}}}$$

where $d_{\text{ff}}$ is the expert feedforward dimension. This ratio increases linearly with the number of devices $P$, making MoE training communication-bound at large scale. Mitigations include overlapping communication with computation and using fewer, larger experts.

---

## 4. Algorithmic Derivation

### 4.1 MoE Forward Pass

```
Algorithm: MOE_FORWARD
Input: x ∈ R^(B, T, d), expert networks {f_1, ..., f_N}, router W_g ∈ R^(N×d)
Hyperparameters: K (top-K), capacity_factor CF
Output: y ∈ R^(B, T, d), L_balance ∈ R

1. Compute routing logits:
   h = x @ W_g^T                          // (B, T, N)

2. Compute routing weights:
   scores = softmax(h, dim=-1)            // (B, T, N)

3. Top-K selection:
   top_k_scores, top_k_indices = topk(scores, K, dim=-1)  // (B, T, K)
   top_k_scores = top_k_scores / top_k_scores.sum(-1, keepdim=True)  // renormalize

4. Expert capacity:
   C = ceil(K * B * T / N * CF)

5. Dispatch tokens to experts:
   for i = 1, ..., N:
       mask_i = (top_k_indices == i).any(dim=-1)    // (B, T) boolean
       tokens_i = x[mask_i][:C]                      // (≤C, d) -- capacity limit
       expert_out_i = f_i(tokens_i)                   // (≤C, d)

6. Combine expert outputs:
   y = zeros(B, T, d)
   for i = 1, ..., N:
       for each token t routed to expert i:
           y[t] += top_k_scores[t, i] * expert_out_i[index_of_t]

7. Load balancing loss:
   f = fraction of tokens routed to each expert    // (N,)
   p = mean routing probability per expert          // (N,)
   L_balance = α * N * sum(f * p)

8. Return y, L_balance

Complexity:
- Router: O(BTNd) for matrix multiply (negligible vs expert compute)
- Experts: O(BT * K/N * d * d_ff) -- each token uses K experts
- Total: O(BT * K * d * d_ff / N + BTNd)
```

### 4.2 Switch Transformer Routing (Top-1)

```
Algorithm: SWITCH_ROUTING
Input: x ∈ R^(B, T, d), W_g ∈ R^(N×d)
Output: expert_index ∈ Z^(B, T), gate_value ∈ R^(B, T)

1. h = x @ W_g^T                          // (B, T, N)
2. scores = softmax(h, dim=-1)            // (B, T, N)
3. expert_index = argmax(scores, dim=-1)  // (B, T)
4. gate_value = scores.gather(-1, expert_index.unsqueeze(-1)).squeeze(-1)  // (B, T)
5. Return expert_index, gate_value

// Output computation:
y[b, t] = gate_value[b, t] * f_{expert_index[b,t]}(x[b, t])
```

### 4.3 GShard: Top-2 with Auxiliary Losses

```
Algorithm: GSHARD_ROUTING
Input: x ∈ R^(B, T, d), W_g ∈ R^(N×d)
Output: y ∈ R^(B, T, d)

1. h = x @ W_g^T + noise                  // (B, T, N), noise for exploration
   // noise ~ Normal(0, 1/N^2) during training

2. scores = softmax(h, dim=-1)            // (B, T, N)
3. top1_idx = argmax(scores, dim=-1)      // (B, T) -- first expert
4. top1_score = scores.gather(-1, top1_idx.unsqueeze(-1)).squeeze(-1)

5. // Mask out first expert for second selection:
   scores_masked = scores.clone()
   scores_masked.scatter_(-1, top1_idx.unsqueeze(-1), -inf)
6. top2_idx = argmax(scores_masked, dim=-1)  // (B, T) -- second expert
7. top2_score = scores.gather(-1, top2_idx.unsqueeze(-1)).squeeze(-1)

8. // Renormalize
   total = top1_score + top2_score
   top1_score = top1_score / total
   top2_score = top2_score / total

9. // Expert computation with capacity limit
   y = top1_score * f_{top1_idx}(x) + top2_score * f_{top2_idx}(x)
   // (with token dropping if capacity exceeded)

10. Return y
```

### 4.4 Distributed MoE Forward Pass

```
Algorithm: DISTRIBUTED_MOE_FORWARD
Input: x_local ∈ R^(T_local, d) -- local tokens on this device
       experts_local: experts hosted on this device
       N_local: number of local experts, N_total = P * N_local
Output: y_local ∈ R^(T_local, d)

// Phase 1: Route
1. h = Router(x_local)                    // (T_local, N_total)
2. assignments = TopK(softmax(h), K)      // (T_local, K) -- expert indices

// Phase 2: All-to-All dispatch
3. // Sort tokens by destination device
   send_buffers = [[] for _ in range(P)]
   for each token t:
       for each assigned expert e:
           device = e // N_local
           send_buffers[device].append((t, e, gate_value))

4. recv_buffers = AllToAll(send_buffers)   // Exchange tokens between devices

// Phase 3: Expert computation
5. for each expert e in experts_local:
       tokens_for_e = recv_buffers[e][:C]  // Apply capacity limit
       outputs_for_e = e(tokens_for_e)

// Phase 4: All-to-All combine
6. send_back = [expert outputs grouped by source device]
7. recv_back = AllToAll(send_back)

// Phase 5: Combine
8. y_local = combine(recv_back, assignments, gate_values)
9. Return y_local

Communication: 2 × AllToAll of O(T_local × d × K) per device
```

---

## 5. PyTorch Implementation

### 5.1 Top-K Router

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class TopKRouter(nn.Module):
    """
    Top-K expert router with load balancing loss.

    Routes each token to its top-K experts based on learned gating weights.
    Computes the auxiliary load-balancing loss to prevent expert collapse.
    """
    def __init__(self, d_model: int, num_experts: int, top_k: int = 2,
                 noise_std: float = 0.1, balance_coeff: float = 0.01):
        """
        Args:
            d_model: Input dimension (d)
            num_experts: Number of experts (N)
            top_k: Number of experts per token (K)
            noise_std: Standard deviation of routing noise (training only)
            balance_coeff: Coefficient for load balancing loss (α)
        """
        super().__init__()
        self.num_experts = num_experts  # N
        self.top_k = top_k              # K
        self.noise_std = noise_std
        self.balance_coeff = balance_coeff

        # Gating network: simple linear projection
        self.gate = nn.Linear(d_model, num_experts, bias=False)  # d -> N

    def forward(self, x):
        """
        Args:
            x: Input tensor of shape (B, T, d)
        Returns:
            gate_values: (B, T, K) -- softmax weights for selected experts
            expert_indices: (B, T, K) -- indices of selected experts
            balance_loss: scalar -- auxiliary load balancing loss
        """
        B, T, d = x.shape
        N = self.num_experts
        K = self.top_k

        # Compute routing logits
        logits = self.gate(x)                               # (B, T, N)

        # Add noise during training for exploration
        if self.training and self.noise_std > 0:
            noise = torch.randn_like(logits) * self.noise_std
            logits = logits + noise

        # Softmax over experts
        scores = F.softmax(logits, dim=-1)                  # (B, T, N)

        # Top-K selection
        top_k_scores, top_k_indices = torch.topk(
            scores, K, dim=-1
        )                                                   # (B, T, K) each

        # Renormalize selected scores
        top_k_scores = top_k_scores / top_k_scores.sum(dim=-1, keepdim=True)  # (B, T, K)

        # Compute load balancing loss
        balance_loss = self._compute_balance_loss(scores, top_k_indices, B, T, N)

        return top_k_scores, top_k_indices, balance_loss

    def _compute_balance_loss(self, scores, top_k_indices, B, T, N):
        """
        Compute the load balancing auxiliary loss.

        L_balance = α * N * Σ_i f_i * p_i

        where f_i = fraction of tokens routed to expert i,
              p_i = average routing probability for expert i.
        """
        # f_i: fraction of tokens assigned to each expert
        # Create one-hot for each selected expert and average
        # top_k_indices: (B, T, K) -> flatten to (B*T*K,)
        flat_indices = top_k_indices.reshape(-1)             # (B*T*K,)
        # Count tokens per expert
        counts = torch.zeros(N, device=scores.device)
        counts.scatter_add_(0, flat_indices, torch.ones_like(flat_indices, dtype=torch.float))
        f = counts / (B * T)                                # (N,) -- fraction per expert

        # p_i: average routing probability
        p = scores.mean(dim=(0, 1))                         # (N,) -- mean over batch and seq

        # Load balancing loss
        balance_loss = self.balance_coeff * N * (f * p).sum()

        return balance_loss
```

### 5.2 Expert Layer

```python
class Expert(nn.Module):
    """
    Single expert: a standard feedforward network (FFN).

    Architecture: Linear -> Activation -> Linear
    """
    def __init__(self, d_model: int, d_ff: int = None, dropout: float = 0.0):
        super().__init__()
        d_ff = d_ff or 4 * d_model
        self.w1 = nn.Linear(d_model, d_ff)
        self.w2 = nn.Linear(d_ff, d_model)
        self.activation = nn.SiLU()
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        """
        Args:
            x: (*, d) -- arbitrary batch dimensions
        Returns:
            y: (*, d)
        """
        return self.dropout(self.w2(self.activation(self.w1(x))))
```

### 5.3 Sparse MoE Layer

```python
class SparseMoE(nn.Module):
    """
    Sparse Mixture-of-Experts layer with top-K routing.

    Replaces the standard FFN in a Transformer block.
    Each token is processed by K out of N experts, weighted by the router.
    """
    def __init__(self, d_model: int, num_experts: int = 8, top_k: int = 2,
                 d_ff: int = None, capacity_factor: float = 1.25,
                 dropout: float = 0.0, balance_coeff: float = 0.01):
        """
        Args:
            d_model: Model dimension (d)
            num_experts: Number of experts (N)
            top_k: Experts per token (K)
            d_ff: Expert FFN dimension (default: 4*d_model)
            capacity_factor: Buffer for expert capacity (CF)
            dropout: Dropout rate
            balance_coeff: Load balancing loss coefficient
        """
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k
        self.capacity_factor = capacity_factor

        # Router
        self.router = TopKRouter(
            d_model, num_experts, top_k,
            balance_coeff=balance_coeff
        )

        # Experts
        self.experts = nn.ModuleList([
            Expert(d_model, d_ff, dropout)
            for _ in range(num_experts)
        ])

    def forward(self, x):
        """
        Args:
            x: (B, T, d)
        Returns:
            y: (B, T, d)
            balance_loss: scalar
        """
        B, T, d = x.shape
        N = self.num_experts
        K = self.top_k

        # Route tokens
        gate_values, expert_indices, balance_loss = self.router(x)
        # gate_values: (B, T, K), expert_indices: (B, T, K)

        # Expert capacity
        C = int(K * B * T / N * self.capacity_factor)

        # Initialize output
        y = torch.zeros_like(x)                              # (B, T, d)

        # Process each expert
        for i in range(N):
            # Find tokens routed to expert i
            # expert_indices: (B, T, K) -- check if any of K slots equals i
            mask = (expert_indices == i)                      # (B, T, K) bool

            if not mask.any():
                continue

            # Get the positions and gate values for this expert
            # Flatten batch and sequence dims for indexing
            batch_idx, seq_idx, k_idx = mask.nonzero(as_tuple=True)

            # Apply capacity limit
            if batch_idx.shape[0] > C:
                batch_idx = batch_idx[:C]
                seq_idx = seq_idx[:C]
                k_idx = k_idx[:C]

            # Gather tokens for this expert
            tokens = x[batch_idx, seq_idx]                    # (num_tokens, d)
            gates = gate_values[batch_idx, seq_idx, k_idx]    # (num_tokens,)

            # Expert forward pass
            expert_out = self.experts[i](tokens)              # (num_tokens, d)

            # Scatter back, weighted by gate values
            # y[batch_idx, seq_idx] += gates.unsqueeze(-1) * expert_out
            y.index_put_(
                (batch_idx, seq_idx),
                gates.unsqueeze(-1) * expert_out,
                accumulate=True,
            )

        return y, balance_loss

class SparseMoEBatched(nn.Module):
    """
    Batched Sparse MoE for better GPU utilization.

    Instead of looping over experts, this implementation groups all tokens
    per expert and processes them in parallel using padding.
    """
    def __init__(self, d_model: int, num_experts: int = 8, top_k: int = 2,
                 d_ff: int = None, capacity_factor: float = 1.25,
                 dropout: float = 0.0, balance_coeff: float = 0.01):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k
        self.capacity_factor = capacity_factor

        self.router = TopKRouter(d_model, num_experts, top_k, balance_coeff=balance_coeff)
        self.experts = nn.ModuleList([
            Expert(d_model, d_ff, dropout) for _ in range(num_experts)
        ])

    def forward(self, x):
        """
        Args:
            x: (B, T, d)
        Returns:
            y: (B, T, d), balance_loss: scalar
        """
        B, T, d = x.shape
        N = self.num_experts
        K = self.top_k

        gate_values, expert_indices, balance_loss = self.router(x)

        # Flatten batch and sequence
        x_flat = x.reshape(B * T, d)                         # (B*T, d)
        gate_flat = gate_values.reshape(B * T, K)             # (B*T, K)
        idx_flat = expert_indices.reshape(B * T, K)           # (B*T, K)

        # Expert capacity
        C = max(1, int(K * B * T / N * self.capacity_factor))

        # Build expert assignment matrix
        # For each expert, collect up to C tokens
        y_flat = torch.zeros(B * T, d, device=x.device)      # (B*T, d)

        for k in range(K):
            for i in range(N):
                mask = (idx_flat[:, k] == i)                  # (B*T,) bool
                if not mask.any():
                    continue

                token_ids = mask.nonzero(as_tuple=True)[0][:C]
                tokens = x_flat[token_ids]                    # (<=C, d)
                gates = gate_flat[token_ids, k]               # (<=C,)

                out = self.experts[i](tokens)                 # (<=C, d)
                y_flat[token_ids] += gates.unsqueeze(-1) * out

        y = y_flat.reshape(B, T, d)
        return y, balance_loss
```

### 5.4 MoE Transformer Block

```python
class MoETransformerBlock(nn.Module):
    """
    Transformer block with MoE replacing the FFN.

    Architecture:
        x -> LayerNorm -> MultiHeadAttention -> + (residual)
          -> LayerNorm -> SparseMoE -> + (residual)
    """
    def __init__(self, d_model: int, n_heads: int, num_experts: int = 8,
                 top_k: int = 2, d_ff: int = None, dropout: float = 0.1):
        super().__init__()
        self.norm1 = nn.LayerNorm(d_model)
        self.attn = nn.MultiheadAttention(d_model, n_heads, dropout=dropout, batch_first=True)
        self.norm2 = nn.LayerNorm(d_model)
        self.moe = SparseMoE(d_model, num_experts, top_k, d_ff, dropout=dropout)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x, attn_mask=None):
        """
        Args:
            x: (B, T, d)
            attn_mask: Optional attention mask
        Returns:
            x: (B, T, d)
            balance_loss: scalar
        """
        # Self-attention block
        x_norm = self.norm1(x)
        attn_out, _ = self.attn(x_norm, x_norm, x_norm, attn_mask=attn_mask)
        x = x + self.dropout(attn_out)

        # MoE block
        x_norm = self.norm2(x)
        moe_out, balance_loss = self.moe(x_norm)
        x = x + self.dropout(moe_out)

        return x, balance_loss

class MoETransformer(nn.Module):
    """
    Full MoE Transformer language model.

    Some layers use MoE, others use dense FFN (interleaved).
    """
    def __init__(self, vocab_size: int, d_model: int = 512, n_layers: int = 12,
                 n_heads: int = 8, num_experts: int = 8, top_k: int = 2,
                 moe_frequency: int = 2, dropout: float = 0.1):
        """
        Args:
            moe_frequency: Apply MoE every N layers (others use dense FFN)
        """
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, d_model)
        self.pos_encoding = nn.Embedding(8192, d_model)  # Learned positional

        self.layers = nn.ModuleList()
        for i in range(n_layers):
            if (i + 1) % moe_frequency == 0:
                self.layers.append(MoETransformerBlock(
                    d_model, n_heads, num_experts, top_k, dropout=dropout
                ))
            else:
                # Dense layer (MoE with 1 expert = standard FFN)
                self.layers.append(MoETransformerBlock(
                    d_model, n_heads, num_experts=1, top_k=1, dropout=dropout
                ))

        self.norm_f = nn.LayerNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)
        self.lm_head.weight = self.embedding.weight

    def forward(self, input_ids):
        """
        Args:
            input_ids: (B, T) long tensor
        Returns:
            logits: (B, T, V)
            total_balance_loss: scalar
        """
        B, T = input_ids.shape
        positions = torch.arange(T, device=input_ids.device).unsqueeze(0)

        x = self.embedding(input_ids) + self.pos_encoding(positions)

        # Causal mask
        causal_mask = torch.triu(
            torch.ones(T, T, device=x.device, dtype=torch.bool), diagonal=1
        )

        total_balance_loss = 0.0
        for layer in self.layers:
            x, bl = layer(x, attn_mask=causal_mask)
            total_balance_loss = total_balance_loss + bl

        x = self.norm_f(x)
        logits = self.lm_head(x)

        return logits, total_balance_loss
```

### 5.5 Verification and Diagnostics

```python
def analyze_expert_utilization(model, dataloader, device='cpu'):
    """
    Analyze how tokens are distributed across experts.

    Prints per-expert utilization statistics and detects expert collapse.
    """
    model.eval()
    expert_counts = {}

    with torch.no_grad():
        for batch in dataloader:
            x = batch.to(device)
            B, T, d = x.shape if x.dim() == 3 else (x.shape[0], x.shape[1], None)

            for layer_idx, layer in enumerate(model.layers):
                if hasattr(layer, 'moe') and layer.moe.num_experts > 1:
                    router = layer.moe.router
                    if d is None:
                        # Need to get hidden states -- simplified
                        continue
                    _, indices, _ = router(x if x.dim() == 3 else model.embedding(x))
                    key = f"layer_{layer_idx}"
                    if key not in expert_counts:
                        expert_counts[key] = torch.zeros(layer.moe.num_experts)
                    for i in range(layer.moe.num_experts):
                        expert_counts[key][i] += (indices == i).sum().item()

    print("Expert Utilization Analysis")
    print("=" * 60)
    for layer_name, counts in expert_counts.items():
        total = counts.sum().item()
        fractions = counts / total if total > 0 else counts
        print(f"\n{layer_name}:")
        print(f"  Total tokens routed: {total:.0f}")
        print(f"  Utilization per expert: {fractions.tolist()}")
        print(f"  Max/Min ratio: {fractions.max() / (fractions.min() + 1e-8):.2f}")
        print(f"  Entropy: {-(fractions * (fractions + 1e-8).log()).sum():.3f}")
        uniform_entropy = -torch.log(torch.tensor(1.0 / len(fractions)))
        print(f"  Uniform entropy: {uniform_entropy:.3f}")

# Demo
if __name__ == "__main__":
    torch.manual_seed(42)

    # Create model
    model = MoETransformer(
        vocab_size=10000, d_model=256, n_layers=6,
        n_heads=4, num_experts=8, top_k=2, moe_frequency=2
    )

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")

    # Forward pass
    x = torch.randint(0, 10000, (4, 128))
    logits, balance_loss = model(x)
    print(f"Input shape: {x.shape}")                 # (4, 128)
    print(f"Logits shape: {logits.shape}")            # (4, 128, 10000)
    print(f"Balance loss: {balance_loss.item():.4f}")

    # Compute task loss
    targets = torch.randint(0, 10000, (4, 128))
    task_loss = F.cross_entropy(logits.view(-1, 10000), targets.view(-1))
    total_loss = task_loss + balance_loss
    print(f"Task loss: {task_loss.item():.4f}")
    print(f"Total loss: {total_loss.item():.4f}")
```

---

## 6. Experimental Intuition

### 6.1 Scaling Behavior

MoE models demonstrate a distinct scaling pattern compared to dense models:

| Model | Total Params | Active Params/Token | Perplexity | Training FLOPs |
|-------|-------------|--------------------|-----------:|---------------:|
| Dense 125M | 125M | 125M | 29.1 | 1x |
| Dense 350M | 350M | 350M | 22.0 | 2.8x |
| MoE 125M (8E, top-2) | 540M | 150M | 22.5 | 1.2x |
| MoE 125M (32E, top-2) | 1.8B | 175M | 20.1 | 1.4x |

Key observations:

- The MoE model with 1.8B total parameters achieves perplexity comparable to a 350M dense model but requires only ~50% of the FLOPs.
- Increasing the number of experts (with fixed K) provides "free" capacity.

### 6.2 Load Balancing Coefficient Sensitivity

| $\alpha$ | Final PPL | Token Drop Rate | Expert Utilization (entropy) |
|----------|-----------|----------------|------------------------------|
| 0.0 | 23.5 | 45% | 0.2 (severe collapse) |
| 0.001 | 21.8 | 15% | 1.5 |
| 0.01 | 20.1 | 3% | 2.0 (near uniform) |
| 0.1 | 21.2 | 1% | 2.1 (uniform) |
| 1.0 | 24.0 | 0.5% | 2.1 (uniform, but hurts task) |

The sweet spot is $\alpha \in [0.01, 0.1]$: strong enough to prevent collapse but not so strong that it dominates the task loss.

### 6.3 Top-1 vs Top-2 Routing

| Setting | PPL | Tokens/sec | Expert Communication |
|---------|-----|-----------|---------------------|
| Top-1, 16 experts | 20.5 | 85K | 1x |
| Top-2, 8 experts | 20.1 | 72K | 2x |
| Top-2, 16 experts | 19.3 | 65K | 2x |

Top-1 is faster (less computation and communication) but top-2 generally achieves better quality due to more gradient signal per expert and the ability to interpolate between experts.

### 6.4 Training Instability

MoE models are known to exhibit training instability, particularly:

1. **Loss spikes**: Sudden increases in training loss, often caused by a few experts receiving extreme gradients.
2. **Router oscillation**: Rapid switching of token-to-expert assignments, preventing experts from specializing.
3. **Mitigation strategies**:
   - Router z-loss: $\mathcal{L}_z = \frac{1}{T}\sum_t \log^2\left(\sum_i e^{h_i(x_t)}\right)$ penalizes large routing logits.
   - Reduced precision for router (fp32 even when model uses bf16).
   - Gradient clipping with lower threshold.

---

## 7. Connections

### 7.1 Connections to Prior Lectures

- **Lecture 01a (Universal Approximation)**: MoE can be viewed as a constructive proof that wider networks are more expressive -- each expert covers a different region of input space, with the router learning the partition.
- **Lecture 04b (Transformer Architecture)**: MoE replaces the dense FFN in Transformers. The attention mechanism is typically kept dense (shared across all tokens). Some recent work explores MoE attention as well.
- **Lecture 09a-b (SSMs)**: SSMs address sequence-length scaling; MoE addresses model-width scaling. They are complementary and can be combined (e.g., Jamba: Mamba + MoE).

### 7.2 Connections to Ensemble Methods

MoE can be viewed as a **learned ensemble**: instead of training $N$ independent models and averaging, MoE trains $N$ experts jointly with a learned routing function. The key differences from classical ensembles are:

- **Sparse activation**: Only $K$ of $N$ experts compute per input (vs. all models in an ensemble).
- **Shared backbone**: Experts share the embedding, attention layers, and router.
- **Specialization**: Experts learn to handle different inputs, rather than being diverse copies.

### 7.3 Connections to Conditional Computation

MoE is an instance of **conditional computation** (Bengio et al., 2013): the computation path through the network depends on the input. Other instances include:

- **Early exit**: Stopping computation at an intermediate layer if the prediction is confident.
- **Adaptive depth**: Choosing how many layers to apply per token (Universal Transformer).
- **Token pruning**: Dropping unimportant tokens in later layers.

### 7.4 Forward Connections

- **Lecture 09d (Multimodal)**: MoE is used in multimodal models to handle different modalities with specialized experts (e.g., vision experts, language experts).
- Modern frontier models (e.g., Mixtral, DeepSeek, Grok) use MoE as a core scaling strategy.

---

## 8. Paper Reading List

### Required Reading

1. **Shazeer, N., Mirhoseini, A., Maziarz, K., et al.** (2017). "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer." *ICLR 2017.*
   - The foundational MoE paper for deep learning. Focus on Sections 2 (architecture) and 3 (load balancing).

2. **Fedus, W., Zoph, B., and Shazeer, N.** (2022). "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity." *JMLR 2022.*
   - Top-1 routing and scaling analysis. Focus on Sections 2 (Switch routing) and 4 (scaling).

### Recommended Reading

3. **Lepikhin, D., Lee, H., Xu, Y., et al.** (2021). "GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding." *ICLR 2021.*
   - Distributed MoE training at scale. Focus on the expert parallelism strategy.

4. **Du, N., Huang, Y., Dai, A.M., et al.** (2022). "GLaM: Efficient Scaling of Language Models with Mixture-of-Experts." *ICML 2022.*
   - Demonstrates MoE efficiency: matches GPT-3 quality with 1/3 the training energy.

5. **Jiang, A.Q., Sablayrolles, A., Roux, A., et al.** (2024). "Mixtral of Experts." *arXiv:2401.04088.*
   - Mixtral 8x7B: an open MoE model that matches GPT-3.5 performance.

6. **Zoph, B., Bello, I., Kumar, S., et al.** (2022). "ST-MoE: Designing Stable and Transferable Sparse Expert Models." *arXiv:2202.08906.*
   - Addresses MoE training instability. Focus on the router z-loss and stability analysis.

7. **Jacobs, R.A., Jordan, M.I., Nowlan, S.J., and Hinton, G.E.** (1991). "Adaptive Mixtures of Local Experts." *Neural Computation.*
   - The original MoE paper from 1991. Historically important.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9c.1.** Consider an MoE layer with $N = 8$ experts, $K = 2$, and a batch of $T = 256$ tokens.

(a) What is the expected number of tokens per expert under uniform routing?

(b) Compute the expert capacity $C$ for capacity factors $\text{CF} \in \{1.0, 1.25, 1.5\}$.

(c) If the routing is such that expert 1 receives 50% of all tokens and the remaining 7 experts share the rest equally, what fraction of tokens are dropped with $\text{CF} = 1.25$?

**Exercise 9c.2.** Derive the gradient of the load balancing loss $\mathcal{L}_{\text{balance}} = \alpha N \sum_i f_i p_i$ with respect to the router parameters $W_g$, showing explicitly how the gradient depends on the current expert utilization $f_i$.

**Exercise 9c.3.** The Switch Transformer uses top-1 routing ($K = 1$) while GShard uses top-2 ($K = 2$). Analyze the trade-offs:

(a) How does the number of expert forward passes per token compare?

(b) How does the gradient signal to each expert compare?

(c) Under what conditions might top-1 outperform top-2 (considering total compute)?

**Exercise 9c.4.** In expert parallelism with $P$ devices and $N = P$ experts:

(a) Derive the All-to-All communication volume in terms of $B$, $T$, $d$, and $K$.

(b) Under what conditions does communication dominate computation?

(c) Propose a strategy to reduce the communication-to-computation ratio.

**Exercise 9c.5.** Explain why the load balancing loss uses $f_i \cdot p_i$ (product of dispatch fraction and routing probability) rather than:
(a) $f_i^2$ (squared dispatch fraction)
(b) $p_i^2$ (squared routing probability)
(c) $(f_i - 1/N)^2$ (deviation from uniform)

What differentiability issues arise with each alternative?

### Implementation Exercises

**Exercise 9c.6.** Implement the `SparseMoE` layer and verify:

(a) That the output shape matches the input shape.

(b) That the balance loss decreases during training.

(c) That expert utilization becomes more uniform over training. Plot the utilization entropy over training steps.

**Exercise 9c.7.** Train two language models on a small corpus (e.g., WikiText-2):

(a) A dense Transformer with 50M parameters.

(b) An MoE Transformer with 50M active parameters but 200M total parameters (8 experts, top-2).

Compare perplexity, training speed (wall-clock time per epoch), and inference speed.

**Exercise 9c.8.** Implement the router z-loss from ST-MoE:

$$\mathcal{L}_z = \frac{1}{BT}\sum_{b,t} \log^2\left(\sum_{i=1}^N e^{h_i(x_{b,t})}\right)$$

Add it to the training objective and compare training stability (loss spikes, gradient norms) with and without the z-loss.

**Exercise 9c.9 (Challenge).** Implement expert parallelism for a 2-GPU setup using `torch.distributed`:

(a) Place 4 experts on each GPU.

(b) Implement the All-to-All dispatch and combine operations.

(c) Measure the communication overhead as a fraction of total forward pass time.

(d) Compare with data parallelism (where all experts are replicated on each GPU).
