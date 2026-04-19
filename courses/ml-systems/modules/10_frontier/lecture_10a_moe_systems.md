# Lecture 10a: Mixture-of-Experts Systems -- Routing, Load Balancing, Expert Parallelism

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Analyze** the systems-level tradeoffs in sparse Mixture-of-Experts architectures, including the tension between model capacity, communication cost, and load balance.
2. **Derive** the all-to-all communication cost of expert parallelism and compare it against data-parallel and tensor-parallel alternatives for MoE layers.
3. **Design** a load-balancing strategy using auxiliary losses, capacity factors, and token-dropping policies that maintains training stability while maximizing expert utilization.
4. **Evaluate** the end-to-end throughput of MoE inference under expert caching and offloading regimes, modeling the interaction between routing decisions and memory hierarchy.
5. **Implement** a top-k gated MoE layer with expert parallelism across multiple devices, including the all-to-all dispatch and combine primitives.

---

## 2. Motivation and Context

### 2.1 The Scaling Dilemma

Dense Transformer scaling follows the Chinchilla-optimal frontier: to train a model with $P$ parameters optimally, we need approximately $20P$ training tokens and $6P \cdot 20P = 120P^2$ FLOPs. Doubling the model size quadruples the compute budget. At the frontier, this means:

| Model | Parameters | Training FLOPs | GPU-hours (A100) |
|-------|-----------|----------------|------------------|
| 7B | 7 x 10^9 | ~5.9 x 10^21 | ~180,000 |
| 70B | 7 x 10^10 | ~5.9 x 10^23 | ~18,000,000 |
| 405B | 4 x 10^11 | ~3.8 x 10^25 | ~1,150,000,000 |

Mixture-of-Experts (MoE) breaks this relationship by decoupling parameter count from per-token compute. An MoE model with $E$ experts and top-$K$ routing activates only $K/E$ of its expert parameters per token, achieving:

$$\text{FLOPs}_{\text{MoE}} \approx \text{FLOPs}_{\text{dense-backbone}} + K \cdot \text{FLOPs}_{\text{single-expert}}$$

For Mixtral 8x7B ($E=8$, $K=2$), the model has ~47B total parameters but per-token compute comparable to a ~13B dense model.

### 2.2 Systems Perspective

From a systems standpoint, MoE introduces challenges absent in dense models:

1. **Dynamic routing** -- each token may go to a different subset of experts, creating irregular computation patterns.
2. **All-to-all communication** -- tokens must be dispatched to the devices hosting their selected experts and results must be gathered back.
3. **Load imbalance** -- popular experts receive more tokens, creating stragglers.
4. **Memory footprint** -- all $E$ experts must reside in memory (or be loaded on demand), even though only $K$ are active per token.
5. **Expert caching at inference** -- with billions of expert parameters, fitting everything in GPU memory for serving is non-trivial.

This lecture covers the systems design of MoE architectures from routing to deployment.

### 2.3 Connection to Prior Lectures

- **Lecture 04b (Model Parallelism)**: Expert parallelism is a new parallelism dimension orthogonal to tensor and pipeline parallelism.
- **Lecture 04d (Communication Topology)**: All-to-all collectives are the communication primitive for MoE; their cost depends on network topology.
- **Lecture 07b (KV Cache)**: MoE inference requires managing both KV cache and expert weights in a shared memory budget.

---

## 3. MoE Architecture Review

### 3.1 Sparse Gating

A standard Transformer block alternates attention and feedforward (FFN) layers:

$$\text{Block}(x) = \text{FFN}(\text{Attn}(x))$$

In an MoE Transformer, the FFN is replaced by a gated mixture of $E$ expert FFNs:

$$\text{MoE-FFN}(x) = \sum_{i=1}^{E} g_i(x) \cdot \text{FFN}_i(x)$$

where $g(x) \in \mathbb{R}^E$ is the gating (routing) function. For sparse MoE, only the top-$K$ gate values are nonzero.

### 3.2 Top-K Routing

**Definition.** Given an input token representation $x \in \mathbb{R}^d$, the router computes:

$$h(x) = W_g x + b_g, \quad W_g \in \mathbb{R}^{E \times d}$$

$$g_i(x) = \begin{cases} \text{softmax}(h(x))_i & \text{if } i \in \text{TopK}(h(x)) \\ 0 & \text{otherwise} \end{cases}$$

The output is:

$$y = \sum_{i \in \text{TopK}(h(x))} g_i(x) \cdot \text{FFN}_i(x)$$

**Renormalization.** In practice, the gate values for the selected experts are renormalized:

$$\tilde{g}_i(x) = \frac{g_i(x)}{\sum_{j \in \text{TopK}} g_j(x)}$$

This ensures the outputs are properly scaled regardless of the absolute gate magnitudes.

### 3.3 Expert FFN Architecture

Each expert is typically a standard SwiGLU FFN:

$$\text{FFN}_i(x) = W_{2,i}\left(\sigma(W_{1,i} x) \odot (W_{3,i} x)\right)$$

where $W_{1,i}, W_{3,i} \in \mathbb{R}^{d_{\text{ff}} \times d}$, $W_{2,i} \in \mathbb{R}^{d \times d_{\text{ff}}}$, and $\sigma$ is the SiLU activation.

**Parameter count per expert:**

$$P_{\text{expert}} = 3 \cdot d \cdot d_{\text{ff}}$$

**Total MoE layer parameters:**

$$P_{\text{MoE}} = E \cdot P_{\text{expert}} + E \cdot d = E(3d \cdot d_{\text{ff}} + d)$$

For Mixtral with $d = 4096$, $d_{\text{ff}} = 14336$, $E = 8$: $P_{\text{MoE}} \approx 8 \times 3 \times 4096 \times 14336 \approx 1.41 \times 10^9$ parameters per MoE layer.

---

## 4. Systems Challenges

### 4.1 Load Imbalance

Without intervention, routing is highly non-uniform. A small number of "popular" experts attract the majority of tokens, while others receive few or none.

**Formal model.** Let $f_i$ be the fraction of tokens routed to expert $i$:

$$f_i = \frac{1}{T}\sum_{t=1}^{T} \mathbf{1}[i \in \text{TopK}(h(x_t))]$$

In the balanced case, $f_i = K/E$ for all $i$. The load imbalance ratio is:

$$\rho = \frac{\max_i f_i}{\text{mean}_i f_i} = \frac{E}{K} \max_i f_i$$

A value of $\rho = 1$ means perfect balance. In practice without auxiliary losses, $\rho > 5$ is common, meaning the slowest expert takes 5x longer than the average.

**Why it matters.** In a synchronized system, all devices must wait for the most loaded expert to finish. If expert $i^*$ receives $\rho$ times the average load, the effective throughput is reduced by a factor of $1/\rho$:

$$\text{Throughput}_{\text{effective}} = \frac{\text{Throughput}_{\text{ideal}}}{\rho}$$

### 4.2 All-to-All Communication

Expert parallelism distributes experts across devices. Each device holds $E/N_{\text{EP}}$ experts (where $N_{\text{EP}}$ is the expert-parallel degree). Processing a batch requires:

1. **Dispatch (All-to-All)**: Each device sends its tokens to the devices hosting the selected experts.
2. **Expert computation**: Each device runs its local experts on the received tokens.
3. **Combine (All-to-All)**: Results are sent back to the originating devices.

**Communication volume.** For a batch of $B$ tokens per device with hidden dimension $d$:

$$V_{\text{dispatch}} = B \cdot K \cdot d \cdot \text{sizeof(dtype)}$$

The all-to-all sends each device's tokens to up to $N_{\text{EP}}$ destinations. Total bytes transferred per device:

$$V_{\text{all2all}} = B \cdot K \cdot d \cdot \text{sizeof(dtype)} \cdot \frac{N_{\text{EP}} - 1}{N_{\text{EP}}}$$

**Example.** With $B = 4096$, $K = 2$, $d = 4096$, BF16, $N_{\text{EP}} = 8$:

$$V_{\text{all2all}} = 4096 \times 2 \times 4096 \times 2 \times \frac{7}{8} = 58.7\text{ MB per device}$$

The dispatch and combine together require $2 \times 58.7 = 117.4$ MB per device per MoE layer.

### 4.3 Memory Footprint

At inference, all expert weights must be accessible. For the Mixtral example:

$$M_{\text{experts}} = E \times P_{\text{expert}} \times \text{sizeof(dtype)} = 8 \times 3 \times 4096 \times 14336 \times 2 \approx 2.82\text{ GB per layer}$$

With 32 MoE layers: $\approx 90$ GB of expert weights alone, before accounting for attention weights, KV cache, or activations.

---

## 5. Expert Parallelism

### 5.1 Parallelism Strategy

Expert parallelism (EP) is orthogonal to data parallelism (DP), tensor parallelism (TP), and pipeline parallelism (PP). In a multi-dimensional parallel configuration:

$$N_{\text{total}} = N_{\text{DP}} \times N_{\text{TP}} \times N_{\text{PP}} \times N_{\text{EP}}$$

**Within an MoE layer:**

- **Attention layers** use DP + TP (no expert parallelism -- they are shared).
- **Expert FFN layers** use DP + EP (experts are distributed, not sharded).

### 5.2 Dispatch and Combine

The core EP primitives are implemented as structured all-to-all operations.

**Dispatch algorithm:**

```
Algorithm: MoE_DISPATCH
Input:
  x[B, d]          -- local tokens on this device
  indices[B, K]     -- top-K expert indices for each token
  gates[B, K]       -- top-K gate values for each token
  N_EP              -- expert parallel degree
  E_local           -- experts per device (E / N_EP)

Output:
  x_recv[B_max, d]  -- tokens received by local experts
  metadata           -- bookkeeping for combine

1. Compute destination device for each (token, expert) pair:
     device[b, k] = indices[b, k] // E_local

2. Sort tokens by destination device (for coalesced communication):
     sorted_x, permutation = sort_by_device(x, indices)

3. Compute send_counts[N_EP]: number of tokens going to each device
   Compute recv_counts[N_EP]: (obtained via all-to-all of send_counts)

4. All-to-All-v(sorted_x, send_counts, recv_counts) -> x_recv

5. Return x_recv, metadata=(permutation, recv_counts, gates)
```

**Combine algorithm (reverse dispatch):**

```
Algorithm: MoE_COMBINE
Input:
  y_local[B_max, d]  -- expert outputs on this device
  metadata            -- from dispatch

Output:
  y[B, d]             -- combined output on originating device

1. All-to-All-v(y_local, recv_counts, send_counts) -> y_sorted

2. Unpermute: y_unsorted = y_sorted[inverse_permutation]

3. Weighted sum: y[b] = sum_k gates[b,k] * y_unsorted[b,k]

4. Return y
```

### 5.3 Communication-Computation Overlap

The all-to-all can be pipelined with computation:

```
                Device 0                    Device 1
                --------                    --------
Time 0:  [Expert 0 compute chunk A]   [Expert 1 compute chunk A]
Time 1:  [All2All send chunk A]       [All2All send chunk A]
         [Expert 0 compute chunk B]   [Expert 1 compute chunk B]
Time 2:  [All2All send chunk B]       [All2All send chunk B]
         [Expert 0 compute chunk C]   [Expert 1 compute chunk C]
         ...
```

By splitting the batch into micro-chunks and overlapping communication of completed chunks with computation of the next, we can hide latency. The optimal chunk count $M$ satisfies:

$$M \geq \frac{T_{\text{comm}}}{T_{\text{comp}}} + 1$$

where $T_{\text{comm}}$ is the all-to-all latency for a chunk and $T_{\text{comp}}$ is the expert compute time for a chunk.

---

## 6. Load Balancing

### 6.1 Auxiliary Load Balancing Loss

The Switch Transformer (Fedus et al., 2022) refined the auxiliary load balancing loss (first introduced in GShard, Lepikhin et al., 2021). Define:

$$f_i = \frac{1}{T}\sum_{t=1}^{T} \mathbf{1}[i \in \text{TopK}(h(x_t))]$$

$$p_i = \frac{1}{T}\sum_{t=1}^{T} \text{softmax}(h(x_t))_i$$

The load balancing loss is:

$$\mathcal{L}_{\text{balance}} = \alpha \cdot E \sum_{i=1}^{E} f_i \cdot p_i$$

**Why this form?** The indicator in $f_i$ is non-differentiable, but $p_i$ is differentiable with respect to the router weights $W_g$. The product $f_i \cdot p_i$ provides a gradient signal: if expert $i$ receives too many tokens ($f_i$ is large), the gradient pushes $p_i$ down, discouraging further routing to that expert.

**Minimum value.** Under the constraints $\sum_i f_i = K$ and $\sum_i p_i = 1$, the minimum of $\sum_i f_i \cdot p_i$ occurs when $f_i = K/E$ and $p_i = 1/E$ for all $i$:

$$\min \sum_i f_i \cdot p_i = E \cdot \frac{K}{E} \cdot \frac{1}{E} = \frac{K}{E}$$

Hence $\mathcal{L}_{\text{balance}}^{\min} = \alpha \cdot E \cdot K/E = \alpha K$.

### 6.2 Router Z-Loss

The ST-MoE paper (Zoph et al., 2022) introduced the router z-loss to prevent router logit explosion:

$$\mathcal{L}_z = \frac{1}{BT}\sum_{b,t}\log^2\left(\sum_{i=1}^{E} \exp(h_i(x_{b,t}))\right)$$

**Gradient analysis.** The partial derivative with respect to logit $h_j$:

$$\frac{\partial \mathcal{L}_z}{\partial h_j} = \frac{2\log\left(\sum_i e^{h_i}\right) \cdot e^{h_j}}{\sum_i e^{h_i}} = 2 \cdot \text{softmax}(h)_j \cdot \log\left(\sum_i e^{h_i}\right)$$

When logits are large, $\log(\sum_i e^{h_i})$ is large, producing a strong gradient that pushes logits back toward zero. This prevents the instability that arises when router logits grow unbounded during training.

### 6.3 Capacity Factor and Token Dropping

**Definition.** The capacity factor $C_f$ determines the maximum number of tokens each expert can process:

$$\text{expert\_capacity} = C_f \cdot \frac{B \cdot K}{E}$$

where $B$ is the batch size (tokens) and $K/E$ is the ideal fraction per expert.

- $C_f = 1.0$: each expert processes exactly the balanced share. Any imbalance causes token dropping.
- $C_f > 1.0$: experts have buffer capacity. $C_f = 1.25$ means 25% buffer.
- $C_f < 1.0$: intentional under-provisioning (rarely used).

**Token dropping.** When expert $i$ receives more than its capacity, excess tokens are dropped. The dropped tokens either:

1. **Pass through unchanged** (via the residual connection) -- the expert output for dropped tokens is zero.
2. **Are routed to their next-best expert** (overflow routing).

**Impact on training.** Token dropping introduces a form of implicit regularization but can harm convergence if the drop rate is too high. Empirically:

| Capacity Factor | Token Drop Rate | Perplexity Impact |
|----------------|----------------|-------------------|
| 1.0 | ~15-30% | +5-10% degradation |
| 1.25 | ~3-8% | +1-2% degradation |
| 1.5 | ~0.5-2% | Negligible |
| 2.0 | ~0% | None (wastes memory) |

---

## 7. Production MoE Systems

### 7.1 GShard

GShard (Lepikhin et al., 2021) was one of the first systems to scale MoE to 600B parameters across 2048 TPU v3 cores. Key design decisions:

- **Top-2 routing** with first-expert and second-expert capacity tracked independently.
- **Random routing** for the second expert: with probability proportional to the gate value, the token is sent to the second expert. This reduces communication load.
- **Group-level expert parallelism**: experts are distributed within groups of devices, limiting all-to-all to within-group communication.

### 7.2 Switch Transformer

Switch Transformer (Fedus et al., 2022) simplified MoE by using $K = 1$ (single expert per token):

**Advantages of $K = 1$:**

- Communication volume is halved compared to $K = 2$.
- Simpler dispatch logic (each token goes to exactly one expert).
- Reduced compute per token.

**Disadvantages:**

- Less robust: if the selected expert is poor, there is no fallback.
- Requires higher capacity factor to absorb load imbalance.

**Selective precision.** Switch Transformer routes tokens in FP32 for numerical stability of the softmax, but computes expert FFNs in BF16:

```python
# Pseudocode for Switch Transformer routing
def switch_route(x, W_g):
    # x: (B, d) in BF16
    # Route in FP32 for stability
    h = x.float() @ W_g.float().T          # (B, E) in FP32
    probs = F.softmax(h, dim=-1)            # (B, E) in FP32
    top1_idx = probs.argmax(dim=-1)         # (B,)
    top1_gate = probs.gather(-1, top1_idx.unsqueeze(-1)).squeeze(-1)  # (B,)
    # Cast back to BF16 for expert computation
    return top1_idx, top1_gate.bfloat16()
```

### 7.3 Mixtral Systems Design

Mixtral (Jiang et al., 2024) uses $E = 8$ experts with $K = 2$ routing across 32 MoE layers. Systems-level decisions:

**Memory layout.** Each expert's weights are stored contiguously in memory. The dispatch operation gathers tokens into per-expert buffers:

```
Input tokens:  [t0, t1, t2, t3, t4, t5, t6, t7]
Routing:       [E0, E2, E0, E5, E2, E0, E7, E2]  (showing top-1 only)

After dispatch:
  Expert 0 buffer: [t0, t2, t5]
  Expert 2 buffer: [t1, t4, t7]
  Expert 5 buffer: [t3]
  Expert 7 buffer: [t6]
```

**Grouped GEMM.** The expert computations are batched into a single grouped GEMM call. Each expert has a different number of tokens, so we use variable-batch grouped matrix multiply:

$$Y_{[i]} = X_{[i]} W_i^T, \quad \text{for } i = 1, \ldots, E$$

where $X_{[i]}$ is the matrix of tokens routed to expert $i$ with shape $(n_i, d)$.

Frameworks like CUTLASS provide grouped GEMM kernels that launch a single GPU kernel with different problem sizes per group, avoiding kernel launch overhead.

### 7.4 DeepSeek-MoE: Fine-Grained Experts

DeepSeek-MoE (Dai et al., 2024) takes a different approach: instead of 8 large experts, it uses 64 fine-grained experts with $K = 6$ and additionally 2 shared experts that process every token:

$$y = \text{FFN}_{\text{shared}}(x) + \sum_{i \in \text{TopK}(h(x))} g_i(x) \cdot \text{FFN}_i(x)$$

**Systems implications:**

- More experts means finer-grained load balancing (central limit theorem -- averaging over more experts reduces variance).
- But more experts means more entries in the all-to-all permutation, potentially increasing communication overhead.
- The shared experts provide a "baseline" that reduces the impact of routing errors.

---

## 8. MoE Inference Systems

### 8.1 The Inference Memory Problem

At inference, all expert weights must be accessible. For a model with $E$ experts, each with $P_e$ parameters in $w$-bit precision:

$$M_{\text{experts}} = E \times P_e \times w / 8$$

For DeepSeek-V2 (236B total parameters, 21B active): fitting all experts on a single GPU is impossible. Options:

1. **Expert parallelism across GPUs**: Split experts across $N$ GPUs, use all-to-all for dispatch. Introduces inter-GPU latency.
2. **Expert offloading**: Keep active experts in GPU memory, offload inactive ones to CPU memory or SSD. Load on demand.
3. **Expert caching**: Maintain an LRU cache of expert weights on GPU; fetch from CPU/SSD on cache miss.

### 8.2 Expert Caching Strategy

**Observation.** In practice, token routing exhibits temporal locality: the same experts tend to be selected for consecutive tokens in a sequence. This motivates caching.

**Cache model.** Let the GPU hold $C$ experts out of $E$ total. For each token, $K$ experts are needed. The cache hit rate depends on the routing distribution:

- **Best case** (all tokens route to the same $K$ experts): hit rate $= 1$ if $C \geq K$.
- **Worst case** (uniform random routing): hit rate $= \binom{C}{K} / \binom{E}{K}$.
- **Typical case**: routing follows a Zipfian distribution, with a small number of experts handling most traffic.

**Prefetching.** By examining the routing decisions for the next layer during the current layer's computation, we can prefetch expert weights:

```
Layer L computation:
  1. Compute attention for layer L+1 (to get routing decisions)
  2. Prefetch expert weights for layer L+1 from CPU -> GPU
  3. Compute MoE for layer L (using cached experts)
  4. Synchronize prefetch
```

This hides the PCIe transfer latency behind computation. With PCIe Gen5 (64 GB/s) and expert size of ~180 MB (one Mixtral expert in BF16), loading one expert takes ~2.8 ms.

### 8.3 Inference Throughput Model

The per-token latency for an MoE layer with expert caching:

$$T_{\text{MoE}} = T_{\text{route}} + \max(T_{\text{fetch}}, T_{\text{compute}}) + T_{\text{combine}}$$

where:

- $T_{\text{route}} \approx 2Ed / \text{FLOPS}_{\text{GPU}}$ (router linear layer)
- $T_{\text{fetch}} = \text{cache\_miss\_rate} \times P_e \times w/8 / \text{BW}_{\text{PCIe}}$ (expert loading)
- $T_{\text{compute}} = K \times 2 \times 3 \times d \times d_{\text{ff}} / \text{FLOPS}_{\text{GPU}}$ (expert FFN forward)
- $T_{\text{combine}}$: negligible (weighted sum)

With efficient caching (hit rate > 95%), the fetch time is amortized and MoE inference approaches the speed of a dense model with $K$ experts worth of FFN compute.

---

## 9. Implementation

### 9.1 Sparse MoE Layer with Expert Parallelism

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.distributed as dist
from typing import Optional, Tuple

class TopKRouter(nn.Module):
    """
    Top-K sparse router with load balancing loss.

    Computes routing decisions and auxiliary losses for
    training-time load balancing.
    """
    def __init__(self, d_model: int, num_experts: int, top_k: int = 2,
                 balance_coeff: float = 0.01, z_loss_coeff: float = 0.001):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k
        self.balance_coeff = balance_coeff
        self.z_loss_coeff = z_loss_coeff
        self.gate = nn.Linear(d_model, num_experts, bias=False)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, dict]:
        """
        Args:
            x: (B * S, d) -- flattened token representations
        Returns:
            top_k_indices: (B * S, K) -- selected expert indices
            top_k_gates: (B * S, K) -- gate values (renormalized)
            aux_losses: dict with 'balance_loss' and 'z_loss'
        """
        # Route in FP32 for numerical stability
        logits = self.gate(x.float())                  # (T, E)

        # Router z-loss: penalize large logits
        z_loss = torch.logsumexp(logits, dim=-1).square().mean()

        # Softmax probabilities
        probs = F.softmax(logits, dim=-1)              # (T, E)

        # Top-K selection
        top_k_gates, top_k_indices = probs.topk(self.top_k, dim=-1)  # (T, K)

        # Renormalize gates
        top_k_gates = top_k_gates / top_k_gates.sum(dim=-1, keepdim=True)

        # Load balancing loss
        # f_i: fraction of tokens routed to expert i
        num_tokens = x.shape[0]
        expert_mask = F.one_hot(top_k_indices, self.num_experts)  # (T, K, E)
        expert_mask = expert_mask.sum(dim=1)                       # (T, E)
        f = expert_mask.float().mean(dim=0)                        # (E,)

        # p_i: mean probability assigned to expert i
        p = probs.mean(dim=0)                                      # (E,)

        balance_loss = self.num_experts * (f * p).sum()

        aux_losses = {
            'balance_loss': self.balance_coeff * balance_loss,
            'z_loss': self.z_loss_coeff * z_loss,
        }

        # Cast gates back to input dtype
        top_k_gates = top_k_gates.to(x.dtype)

        return top_k_indices, top_k_gates, aux_losses


class ExpertFFN(nn.Module):
    """Single expert: SwiGLU feedforward network."""
    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.w1 = nn.Linear(d_model, d_ff, bias=False)
        self.w2 = nn.Linear(d_ff, d_model, bias=False)
        self.w3 = nn.Linear(d_model, d_ff, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.w2(F.silu(self.w1(x)) * self.w3(x))


class SparseMoELayer(nn.Module):
    """
    Sparse Mixture-of-Experts layer with capacity-factor token dropping.

    For single-device usage. See DistributedMoELayer for multi-device.
    """
    def __init__(self, d_model: int, d_ff: int, num_experts: int = 8,
                 top_k: int = 2, capacity_factor: float = 1.25,
                 balance_coeff: float = 0.01):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k
        self.capacity_factor = capacity_factor

        self.router = TopKRouter(d_model, num_experts, top_k, balance_coeff)
        self.experts = nn.ModuleList([
            ExpertFFN(d_model, d_ff) for _ in range(num_experts)
        ])

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, dict]:
        """
        Args:
            x: (B, S, d) -- input tensor
        Returns:
            y: (B, S, d) -- output tensor
            aux: dict with auxiliary losses and metrics
        """
        B, S, d = x.shape
        x_flat = x.view(-1, d)                         # (T, d) where T = B*S
        T = x_flat.shape[0]

        # Route tokens
        indices, gates, aux_losses = self.router(x_flat)  # (T, K), (T, K)

        # Compute expert capacity
        capacity = int(self.capacity_factor * T * self.top_k / self.num_experts)

        # Dispatch tokens to experts
        y_flat = torch.zeros_like(x_flat)               # (T, d)
        tokens_dropped = 0
        expert_counts = torch.zeros(self.num_experts, device=x.device)

        for k in range(self.top_k):
            expert_idx = indices[:, k]                   # (T,)
            gate_val = gates[:, k]                       # (T,)

            for e in range(self.num_experts):
                mask = (expert_idx == e)                 # (T,) bool
                token_ids = mask.nonzero(as_tuple=True)[0]

                # Apply capacity limit
                if token_ids.shape[0] > capacity:
                    tokens_dropped += token_ids.shape[0] - capacity
                    token_ids = token_ids[:capacity]

                if token_ids.shape[0] == 0:
                    continue

                expert_counts[e] += token_ids.shape[0]
                expert_input = x_flat[token_ids]         # (n_e, d)
                expert_output = self.experts[e](expert_input)
                y_flat[token_ids] += gate_val[token_ids].unsqueeze(-1) * expert_output

        # Metrics
        aux_losses['tokens_dropped'] = tokens_dropped / (T * self.top_k)
        aux_losses['expert_counts'] = expert_counts
        aux_losses['load_imbalance'] = (expert_counts.max() / expert_counts.float().mean()).item()

        return y_flat.view(B, S, d), aux_losses
```

### 9.2 Distributed MoE with All-to-All

```python
class DistributedMoELayer(nn.Module):
    """
    MoE layer with expert parallelism across devices.

    Each device holds E // world_size experts. Tokens are dispatched
    via all-to-all collective communication.
    """
    def __init__(self, d_model: int, d_ff: int, num_experts: int = 8,
                 top_k: int = 2, capacity_factor: float = 1.25,
                 ep_group: Optional[dist.ProcessGroup] = None):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k
        self.capacity_factor = capacity_factor

        self.ep_group = ep_group or dist.group.WORLD
        self.ep_size = dist.get_world_size(self.ep_group)
        self.ep_rank = dist.get_rank(self.ep_group)

        assert num_experts % self.ep_size == 0
        self.experts_per_device = num_experts // self.ep_size

        self.router = TopKRouter(d_model, num_experts, top_k)
        self.local_experts = nn.ModuleList([
            ExpertFFN(d_model, d_ff) for _ in range(self.experts_per_device)
        ])

    def _dispatch_all_to_all(self, x: torch.Tensor,
                               indices: torch.Tensor) -> Tuple[torch.Tensor, dict]:
        """
        Dispatch tokens to expert-hosting devices via all-to-all.

        Args:
            x: (T, d) tokens on this device
            indices: (T, K) expert indices
        Returns:
            recv_tokens: tokens received by this device's experts
            dispatch_info: metadata for combine step
        """
        T, d = x.shape
        capacity = int(self.capacity_factor * T * self.top_k / self.num_experts)

        # Build per-device send buffers
        # tokens_for_device[r] = tokens whose expert lives on device r
        send_counts = torch.zeros(self.ep_size, dtype=torch.long, device=x.device)

        # Flatten (token, expert_slot) pairs
        flat_indices = indices.reshape(-1)                # (T*K,)
        flat_token_ids = torch.arange(T, device=x.device).unsqueeze(1).expand(-1, self.top_k).reshape(-1)

        # Destination device for each expert
        dest_device = flat_indices // self.experts_per_device  # (T*K,)

        # Sort by destination for coalesced communication
        sort_order = dest_device.argsort(stable=True)
        sorted_tokens = x[flat_token_ids[sort_order]]     # (T*K, d)
        sorted_experts = flat_indices[sort_order]          # (T*K,)

        for r in range(self.ep_size):
            send_counts[r] = (dest_device == r).sum()

        # Exchange counts
        recv_counts = torch.zeros_like(send_counts)
        dist.all_to_all_single(recv_counts, send_counts, group=self.ep_group)

        # All-to-all for token data
        send_splits = send_counts.tolist()
        recv_splits = recv_counts.tolist()

        recv_tokens = torch.empty(sum(recv_splits), d,
                                   dtype=x.dtype, device=x.device)

        dist.all_to_all(
            list(recv_tokens.split(recv_splits)),
            list(sorted_tokens.split(send_splits)),
            group=self.ep_group
        )

        dispatch_info = {
            'sort_order': sort_order,
            'send_splits': send_splits,
            'recv_splits': recv_splits,
            'sorted_experts': sorted_experts,
        }

        return recv_tokens, dispatch_info

    def _combine_all_to_all(self, y_local: torch.Tensor,
                              dispatch_info: dict) -> torch.Tensor:
        """Reverse the dispatch: send expert outputs back to originating devices."""
        send_splits = dispatch_info['recv_splits']   # reversed
        recv_splits = dispatch_info['send_splits']   # reversed

        recv_buffer = torch.empty(sum(recv_splits), y_local.shape[-1],
                                   dtype=y_local.dtype, device=y_local.device)

        dist.all_to_all(
            list(recv_buffer.split(recv_splits)),
            list(y_local.split(send_splits)),
            group=self.ep_group
        )

        # Unsort
        inverse_order = dispatch_info['sort_order'].argsort()
        return recv_buffer[inverse_order]

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, dict]:
        """
        Args:
            x: (B, S, d)
        Returns:
            y: (B, S, d)
            aux: dict
        """
        B, S, d = x.shape
        x_flat = x.view(-1, d)

        # Route
        indices, gates, aux = self.router(x_flat)

        # Dispatch
        recv_tokens, dispatch_info = self._dispatch_all_to_all(x_flat, indices)

        # Local expert computation
        # Determine which local expert each received token belongs to
        # (tokens arrive sorted by source device, need to route to local experts)
        y_local = torch.zeros_like(recv_tokens)

        for e_local in range(self.experts_per_device):
            e_global = self.ep_rank * self.experts_per_device + e_local
            # Find tokens assigned to this global expert
            # (simplified -- production code tracks this in dispatch_info)
            mask = (dispatch_info.get('local_expert_ids',
                    torch.zeros(recv_tokens.shape[0], dtype=torch.long,
                                device=x.device)) == e_local)
            if mask.any():
                y_local[mask] = self.local_experts[e_local](recv_tokens[mask])

        # Combine
        y_combined = self._combine_all_to_all(y_local, dispatch_info)

        # Apply gates and reshape
        y_combined = y_combined.view(-1, self.top_k, d)
        y_flat = (gates.unsqueeze(-1) * y_combined).sum(dim=1)

        return y_flat.view(B, S, d), aux
```

### 9.3 Grouped GEMM for Efficient Expert Computation

```python
def grouped_gemm_reference(
    inputs: list[torch.Tensor],
    weights: list[torch.Tensor],
) -> list[torch.Tensor]:
    """
    Reference implementation of grouped GEMM.

    In production, this would be a single fused CUDA kernel
    (e.g., from CUTLASS or Triton).

    Args:
        inputs: list of (n_i, d_in) tensors, one per expert
        weights: list of (d_out, d_in) tensors, one per expert
    Returns:
        outputs: list of (n_i, d_out) tensors
    """
    return [x @ w.T for x, w in zip(inputs, weights)]


def moe_forward_grouped(
    x: torch.Tensor,
    expert_indices: torch.Tensor,
    gate_values: torch.Tensor,
    expert_weights_w1: list[torch.Tensor],
    expert_weights_w2: list[torch.Tensor],
    expert_weights_w3: list[torch.Tensor],
    num_experts: int,
) -> torch.Tensor:
    """
    Efficient MoE forward using grouped GEMM pattern.

    Args:
        x: (T, d) input tokens
        expert_indices: (T, K) selected expert indices
        gate_values: (T, K) gate weights
        expert_weights_*: lists of weight matrices per expert
    Returns:
        y: (T, d) output
    """
    T, d = x.shape
    K = expert_indices.shape[1]
    y = torch.zeros_like(x)

    for k in range(K):
        # Sort tokens by expert for this slot
        experts_k = expert_indices[:, k]             # (T,)
        gates_k = gate_values[:, k]                  # (T,)

        sort_order = experts_k.argsort(stable=True)
        sorted_x = x[sort_order]                     # (T, d)
        sorted_gates = gates_k[sort_order]            # (T,)
        sorted_experts = experts_k[sort_order]        # (T,)

        # Build per-expert slices
        expert_inputs = []
        expert_slices = []
        offset = 0
        for e in range(num_experts):
            count = (sorted_experts == e).sum().item()
            if count > 0:
                expert_inputs.append(sorted_x[offset:offset+count])
                expert_slices.append((e, offset, offset + count))
            offset += count

        # Grouped GEMM: w1 and w3 (gate and up projections)
        gate_outputs = grouped_gemm_reference(
            expert_inputs, [expert_weights_w1[e] for e, _, _ in expert_slices]
        )
        up_outputs = grouped_gemm_reference(
            expert_inputs, [expert_weights_w3[e] for e, _, _ in expert_slices]
        )

        # SwiGLU activation
        hidden = [F.silu(g) * u for g, u in zip(gate_outputs, up_outputs)]

        # Grouped GEMM: w2 (down projection)
        expert_outputs = grouped_gemm_reference(
            hidden, [expert_weights_w2[e] for e, _, _ in expert_slices]
        )

        # Scatter back with gating
        sorted_y = torch.cat(expert_outputs, dim=0)   # (T, d)
        sorted_y = sorted_gates.unsqueeze(-1) * sorted_y

        # Unsort
        inverse_order = sort_order.argsort()
        y += sorted_y[inverse_order]

    return y
```

---

## 10. Performance Analysis

### 10.1 Communication vs Computation Breakdown

For a Mixtral-style MoE layer ($d = 4096$, $d_{\text{ff}} = 14336$, $E = 8$, $K = 2$) on 8 GPUs with NVLink:

| Component | FLOPs | Bytes | Time (H100) |
|-----------|-------|-------|-------------|
| Router ($W_g x$) | $2 \times 4096 \times 8 = 65K$ | -- | 0.001 ms |
| All-to-All dispatch | -- | 67 MB | 0.42 ms |
| Expert FFN ($K=2$ experts) | $2 \times 2 \times 3 \times 4096 \times 14336 = 704M$ | -- | 0.36 ms |
| All-to-All combine | -- | 67 MB | 0.42 ms |
| **Total** | **704M** | **134 MB** | **1.21 ms** |

Compare with a dense FFN of equivalent per-token FLOPs ($d_{\text{ff}} = 2 \times 14336 = 28672$):

| Dense FFN | FLOPs | Time (H100) |
|-----------|-------|-------------|
| $W_1, W_3$, SwiGLU, $W_2$ | 704M | 0.36 ms |

The MoE layer pays a ~3.4x latency premium for the same FLOPs due to communication overhead. This premium decreases with larger batch sizes (more compute per communication).

### 10.2 Scaling Expert Count

| Config | Experts | Active | Total Params | FLOPs/token | Memory (BF16) |
|--------|---------|--------|-------------|-------------|---------------|
| Dense | 1 | 1 | 7B | 14T | 14 GB |
| MoE-8 | 8 | 2 | 47B | 26T | 94 GB |
| MoE-16 | 16 | 2 | 86B | 26T | 172 GB |
| MoE-64 | 64 | 6 | 314B | 78T | 628 GB |

More experts increase capacity but also increase memory requirements and communication complexity. The sweet spot depends on the deployment target.

---

## Key Takeaways

1. MoE decouples parameter count from per-token compute, enabling models with much higher capacity at similar inference cost to dense models.
2. The primary systems challenges are load imbalance, all-to-all communication overhead, and memory management for expert weights.
3. Load balancing requires auxiliary losses ($\mathcal{L}_{\text{balance}}$ and $\mathcal{L}_z$), capacity factors, and sometimes token dropping. The balance coefficient $\alpha$ must be tuned carefully -- too low causes collapse, too high hurts task loss.
4. Expert parallelism distributes experts across devices and requires all-to-all collectives, whose cost scales with the EP degree and can dominate latency for small batch sizes.
5. MoE inference benefits from expert caching with prefetching, exploiting the temporal locality of routing decisions to avoid loading experts from CPU/SSD on every layer.

---

## Further Reading

1. **Fedus, W., Zoph, B., and Shazeer, N.** (2022). "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity." *JMLR 23(120):1-39.*
2. **Lepikhin, D., et al.** (2021). "GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding." *ICLR 2021.*
3. **Jiang, A.Q., et al.** (2024). "Mixtral of Experts." *arXiv:2401.04088.*
4. **Zoph, B., et al.** (2022). "ST-MoE: Designing Stable and Transferable Sparse Expert Models." *arXiv:2202.08906.*
5. **Dai, D., et al.** (2024). "DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models." *arXiv:2401.06066.*
6. **Hwang, C., et al.** (2023). "Tutel: Adaptive Mixture-of-Experts at Scale." *MLSys 2023.*
7. **Rajbhandari, S., et al.** (2022). "DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training to Power Next-Generation AI Scale." *ICML 2022.*
