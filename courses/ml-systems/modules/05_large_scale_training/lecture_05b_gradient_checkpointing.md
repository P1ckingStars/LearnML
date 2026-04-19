# Lecture 05b: Gradient Checkpointing & Activation Recomputation

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Quantify** the memory breakdown of a transformer training step, identifying activations as the dominant memory consumer at large batch sizes and sequence lengths.
2. **Derive** the $O(\sqrt{N})$ optimal checkpointing strategy for a sequential $N$-layer network and prove its optimality under the single-recomputation constraint (Chen et al., 2016).
3. **Implement** gradient checkpointing in PyTorch using `torch.utils.checkpoint` and custom segment-based strategies.
4. **Design** selective checkpointing policies that balance memory savings against recomputation overhead for specific architectures (transformers, U-Nets).
5. **Evaluate** the interaction between gradient checkpointing and other memory-optimization techniques (mixed precision, activation offloading, tensor parallelism).

---

## 2. Motivation and Context

### 2.1 The Memory Wall

Consider training a 7B-parameter Llama-2 model with a batch size of 1 and a sequence length of 4096:

| Component | Memory |
|-----------|--------|
| Parameters (BF16) | 14 GB |
| Gradients (BF16) | 14 GB |
| Adam optimizer states (FP32 $m, v$ + master weights) | 42 GB |
| **Activations** (BF16, no checkpointing) | **~60 GB** |
| **Total** | **~130 GB** |

The activations alone exceed the parameter memory. For longer sequences or larger batches, activations grow linearly in both dimensions, quickly exceeding the 80 GB capacity of an A100 or H100. Gradient checkpointing trades a moderate increase in compute (typically 30-40%) for a dramatic reduction in activation memory (typically 5-10x).

### 2.2 Why Activations Must Be Stored

During the forward pass of layer $\ell$, we compute:

$$h_\ell = f_\ell(h_{\ell-1}; \theta_\ell)$$

During the backward pass, computing $\frac{\partial \mathcal{L}}{\partial \theta_\ell}$ requires both the incoming gradient $\frac{\partial \mathcal{L}}{\partial h_\ell}$ (from the layer above) and the **input activation** $h_{\ell-1}$ (from the forward pass):

$$\frac{\partial \mathcal{L}}{\partial \theta_\ell} = \frac{\partial \mathcal{L}}{\partial h_\ell} \cdot \frac{\partial h_\ell}{\partial \theta_\ell} = g(h_{\ell-1}, \frac{\partial \mathcal{L}}{\partial h_\ell}; \theta_\ell)$$

Without the stored activation $h_{\ell-1}$, we cannot compute the gradient. The standard approach stores **all** intermediate activations during the forward pass, consuming $O(N \cdot B \cdot d)$ memory for $N$ layers, batch size $B$, and hidden dimension $d$.

### 2.3 The Fundamental Tradeoff

Gradient checkpointing exploits a simple observation: **activations can be recomputed from earlier activations**. If we store only a subset of activations (the "checkpoints") and recompute the rest during the backward pass, we reduce peak memory at the cost of additional forward computation.

---

## 3. Memory Breakdown for Transformers

### 3.1 Per-Layer Activation Memory

For a single transformer layer processing a sequence of length $s$ with hidden dimension $d$, batch size $B$, and $h$ attention heads, the stored activations include:

| Activation | Shape | Size (elements) |
|------------|-------|-----------------|
| Input to QKV projection | $(B, s, d)$ | $Bsd$ |
| Q, K, V matrices | $3 \times (B, h, s, d/h)$ | $3Bsd$ |
| Attention scores (pre-softmax) | $(B, h, s, s)$ | $Bhs^2$ |
| Attention probabilities (post-softmax) | $(B, h, s, s)$ | $Bhs^2$ |
| Dropout mask (attention) | $(B, h, s, s)$ | $Bhs^2$ |
| Attention output | $(B, s, d)$ | $Bsd$ |
| Post-attention residual | $(B, s, d)$ | $Bsd$ |
| MLP intermediate (after first linear) | $(B, s, 4d)$ | $4Bsd$ |
| MLP activation (e.g., GeLU input) | $(B, s, 4d)$ | $4Bsd$ |
| Dropout masks (2x) | $(B, s, d) + (B, s, 4d)$ | $5Bsd$ |

**Total per layer** $\approx 19Bsd + 3Bhs^2$ elements.

For Llama-2 7B ($d = 4096$, $h = 32$, $s = 4096$, $B = 1$, BF16):

$$\text{Per layer} \approx 19 \times 1 \times 4096 \times 4096 + 3 \times 1 \times 32 \times 4096^2 \approx 1.96 \times 10^9 \text{ elements}$$

At 2 bytes per BF16 element: $\approx 3.9$ GB per layer. With 32 layers: $\approx 125$ GB total.

### 3.2 The Attention Score Bottleneck

The attention score matrices have shape $(B, h, s, s)$, which grows **quadratically** in sequence length. For $s = 4096$, $h = 32$, $B = 1$:

$$\text{Attention scores per layer} = 3 \times 1 \times 32 \times 4096^2 \times 2 \text{ bytes} \approx 3.2 \text{ GB}$$

This is why FlashAttention (covered in Module 02) is synergistic with gradient checkpointing: FlashAttention never materializes the full $s \times s$ attention matrix, reducing per-layer activation memory by roughly 2x for long sequences.

### 3.3 Memory Timeline

```
                Forward Pass                   Backward Pass
    ┌──────────────────────────┐    ┌──────────────────────────┐
    │                          │    │                          │
    │   Layer 1: store h_1     │    │   Layer N: use h_{N-1}   │
    │   Layer 2: store h_2     │    │     free h_{N-1}         │
    │   Layer 3: store h_3     │    │   Layer N-1: use h_{N-2} │
    │   ...                    │    │     free h_{N-2}         │
    │   Layer N: store h_N     │    │   ...                    │
    │                          │    │   Layer 1: use h_0       │
    │   Peak: O(N * B * d)     │    │     free h_0             │
    └──────────────────────────┘    └──────────────────────────┘

Memory
  ^
  |        ┌───────────────────────┐
  |       /                         \
  |      /   activations accumulate  \  activations freed
  |     /                             \  as backward proceeds
  |    /                               \
  |───┘                                 └───
  └──────────────────────────────────────────> Time
       Forward                   Backward
```

---

## 4. Gradient Checkpointing: Core Algorithm

### 4.1 Basic Idea

Divide the $N$ layers into **segments** of $k$ layers each. Store the activation only at segment boundaries (the "checkpoints"). During the backward pass, when we need the activation for a layer inside a segment, we recompute the entire segment from its checkpoint.

```
Without checkpointing (store all):
  Layer:  1   2   3   4   5   6   7   8   9
  Store:  h1  h2  h3  h4  h5  h6  h7  h8  h9
  Memory: O(N)

With checkpointing (segments of 3):
  Layer:  1   2   3 | 4   5   6 | 7   8   9
  Store:  h1          h3          h6          h9
  Memory: O(N/k + k) = O(N/k + k)
  Recompute: during backward, rerun each segment
```

### 4.2 Formal Definition

**Definition 4.1.** Given a sequential computation $h_N = f_N \circ f_{N-1} \circ \ldots \circ f_1(h_0)$, a **checkpointing policy** $\mathcal{C} \subseteq \{0, 1, \ldots, N\}$ specifies which intermediate activations $\{h_i : i \in \mathcal{C}\}$ are stored during the forward pass. All other activations are discarded and recomputed during the backward pass from the nearest preceding checkpoint.

**Memory cost:** $|\mathcal{C}| \times \text{(activation size per layer)}$

**Compute overhead:** Each layer not in $\mathcal{C}$ is computed twice (once in forward, once recomputed in backward).

### 4.3 The $\sqrt{N}$ Optimal Strategy

**Theorem 4.2 (Chen et al., 2016).** For a sequential network of $N$ layers, if each layer has equal compute cost and activation size, the memory-optimal checkpointing strategy under a single recomputation constraint places checkpoints at uniform intervals of $k = \lfloor\sqrt{N}\rfloor$, achieving:

- **Memory:** $O(\sqrt{N})$ activations stored (the checkpoints plus one segment being recomputed)
- **Compute:** At most one additional forward pass (33% overhead for sequential networks)

**Proof sketch.** Let $k$ be the segment size and $N/k$ be the number of segments. During the backward pass, we process one segment at a time:

1. Recompute the segment's activations from the nearest checkpoint: stores $k$ activations.
2. Perform the backward pass through the segment: frees activations as we go.

Peak activation memory is:

$$M(k) = \underbrace{\lceil N/k \rceil}_{\text{checkpoints}} + \underbrace{k}_{\text{one segment being recomputed}}$$

Minimizing $M(k)$ over $k$:

$$\frac{dM}{dk} = -\frac{N}{k^2} + 1 = 0 \implies k^* = \sqrt{N}$$

Substituting: $M(\sqrt{N}) = \sqrt{N} + \sqrt{N} = 2\sqrt{N}$.

The second derivative $\frac{d^2M}{dk^2} = \frac{2N}{k^3} > 0$ confirms this is a minimum. $\blacksquare$

**Example:** For $N = 96$ layers (GPT-3 scale):
- Without checkpointing: store 96 activations.
- With $\sqrt{96} \approx 10$ checkpoints: store $\sim 20$ activations.
- Memory reduction: $\sim 4.8\times$.

### 4.4 Compute Overhead Analysis

Each of the $N/k$ segments is recomputed once during the backward pass. The total forward computation is:

$$\text{Total forward ops} = \underbrace{N}_{\text{original forward}} + \underbrace{N - \lceil N/k \rceil}_{\text{recomputed layers}}$$

For $k = \sqrt{N}$, the recomputed work is:

$$\frac{N - \sqrt{N}}{N} \approx 1 - \frac{1}{\sqrt{N}} \to 1 \text{ as } N \to \infty$$

This means the recomputed work approaches one full extra forward pass $F_{\text{fwd}}$, so the forward pass is computed roughly **twice** in total. The backward pass cost remains unchanged. To quantify the overhead on total step time: a standard training step costs $F_{\text{fwd}} + F_{\text{bwd}} \approx 3F_{\text{fwd}}$ (since the backward pass costs roughly $2F_{\text{fwd}}$). Adding the extra $F_{\text{fwd}}$ of recomputation gives $4F_{\text{fwd}}$, which is a **33% overhead on total step time** (not a doubling of total cost).

### 4.5 Multi-Level Checkpointing

The $\sqrt{N}$ strategy allows only one level of recomputation. Recursive checkpointing applies the same idea hierarchically:

- Level 0: Store all activations. Memory $O(N)$, overhead 0.
- Level 1: Store $\sqrt{N}$ checkpoints. Memory $O(\sqrt{N})$, overhead 33%.
- Level 2: Within each segment, apply checkpointing again. Memory $O(N^{1/3})$, overhead $\sim 2\times$.
- Level $r$: Memory $O(N^{1/(r+1)})$, overhead $O(r \times F)$.

In practice, level 1 (single $\sqrt{N}$) is almost always the right choice. Level 2+ introduces excessive recomputation and is only worthwhile in extreme memory-constrained settings.

---

## 5. Selective Checkpointing

### 5.1 Non-Uniform Compute and Memory Costs

The $\sqrt{N}$ result assumes all layers have equal cost. In transformers, this is roughly true across transformer blocks, but **within** a block, the costs are very non-uniform:

| Sub-layer | Compute Cost | Activation Memory |
|-----------|-------------|-------------------|
| QKV projection | $6Bsd^2$ FLOPs | $3Bsd$ elements |
| Attention (Q K^T) | $2Bs^2d$ FLOPs | $Bhs^2$ elements (large!) |
| Softmax | $O(Bhs^2)$ FLOPs | $Bhs^2$ elements |
| Attention * V | $2Bs^2d$ FLOPs | $Bsd$ elements |
| Output projection | $2Bsd^2$ FLOPs | $Bsd$ elements |
| MLP (up projection) | $8Bsd^2$ FLOPs | $4Bsd$ elements |
| MLP (activation) | $O(Bsd)$ FLOPs | $4Bsd$ elements |
| MLP (down projection) | $8Bsd^2$ FLOPs | $Bsd$ elements |

**Key observation:** The attention scores ($Bhs^2$ each for pre-softmax scores, post-softmax probs, and dropout mask) are memory-expensive but cheap to recompute from Q, K, V. The MLP intermediate activations ($4Bsd$) are also large but cheap to recompute from the input.

### 5.2 Selective Recomputation Strategy

Instead of checkpointing at the granularity of entire transformer blocks, we can selectively discard only the most memory-hungry, cheapest-to-recompute activations:

1. **Always recompute:** Attention scores, softmax outputs, dropout masks — these are $O(s^2)$ in memory but $O(s^2)$ in compute (cheap relative to the $O(sd)$ projections).
2. **Always store:** QKV projections, output projections, MLP projections — these are $O(sd)$ in memory and $O(sd^2)$ in compute (expensive to recompute).

This achieves ~70% of the memory savings of full checkpointing with only ~10% compute overhead (vs. 33% for full checkpointing).

### 5.3 FlashAttention as Implicit Checkpointing

FlashAttention (Dao et al., 2022) implements a form of selective checkpointing at the kernel level. The forward pass stores only Q, K, V, the output O, and the softmax normalization statistics (logsumexp, shape $(B, h, s)$). It does **not** store the $s \times s$ attention matrix.

During the backward pass, FlashAttention recomputes the attention scores tile-by-tile from Q, K, V, applying the same tiling strategy to avoid materializing the full matrix.

Memory comparison per layer:

| Strategy | Attention Memory |
|----------|-----------------|
| Standard (store all) | $3Bhs^2$ (scores + probs + mask) |
| Full checkpointing | 0 (recompute from checkpoint) |
| FlashAttention | $Bhs$ (logsumexp only) |

FlashAttention is strictly superior because it also runs faster (better memory access patterns), whereas full recomputation of standard attention would be slower.

---

## 6. Implementation in PyTorch

### 6.1 Basic Usage: `torch.utils.checkpoint`

```python
import torch
from torch.utils.checkpoint import checkpoint

class TransformerBlock(torch.nn.Module):
    def __init__(self, d_model: int, n_heads: int, d_ff: int):
        super().__init__()
        self.attn = MultiHeadAttention(d_model, n_heads)
        self.ff = FeedForward(d_model, d_ff)
        self.norm1 = torch.nn.LayerNorm(d_model)
        self.norm2 = torch.nn.LayerNorm(d_model)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.norm1(x))
        x = x + self.ff(self.norm2(x))
        return x

class TransformerWithCheckpointing(torch.nn.Module):
    def __init__(self, n_layers: int, d_model: int, n_heads: int, d_ff: int):
        super().__init__()
        self.layers = torch.nn.ModuleList([
            TransformerBlock(d_model, n_heads, d_ff)
            for _ in range(n_layers)
        ])

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            # checkpoint() discards intermediate activations in `layer`
            # and recomputes them during backward
            x = checkpoint(layer, x, use_reentrant=False)
        return x
```

### 6.2 How `torch.utils.checkpoint` Works Internally

The `checkpoint` function wraps a module's forward pass so that:

1. **Forward pass:** Run the module normally but under `torch.no_grad()`. Save only the **inputs** to the checkpointed region (not the intermediate activations). Record what random number generator (RNG) states were used (for dropout reproducibility).

2. **Backward pass:** When the backward pass reaches the checkpointed region, re-run the forward pass **with gradients enabled**, restoring the original RNG state so that dropout masks match. Then perform the backward pass through the recomputed graph.

```python
# Simplified implementation (conceptual, not production)
class CheckpointFunction(torch.autograd.Function):
    @staticmethod
    def forward(ctx, run_function, *args):
        # Save inputs (but not intermediate activations)
        ctx.run_function = run_function
        ctx.save_for_backward(*args)
        # Save RNG state for reproducible dropout
        ctx.fwd_rng_state = torch.cuda.get_rng_state()

        # Run forward without tracking gradients
        with torch.no_grad():
            output = run_function(*args)
        return output

    @staticmethod
    def backward(ctx, *grad_outputs):
        inputs = ctx.saved_tensors

        # Restore RNG state so dropout is identical
        torch.cuda.set_rng_state(ctx.fwd_rng_state)

        # Recompute forward with gradient tracking
        with torch.enable_grad():
            inputs = tuple(x.detach().requires_grad_(x.requires_grad)
                          for x in inputs)
            outputs = ctx.run_function(*inputs)

        # Now compute gradients through the recomputed graph
        torch.autograd.backward(outputs, grad_outputs)

        return (None,) + tuple(inp.grad for inp in inputs)
```

### 6.3 The `use_reentrant` Parameter

PyTorch offers two checkpoint implementations:

- **`use_reentrant=True`** (legacy): Uses the approach above with `torch.autograd.Function`. Has known issues with `torch.compile`, double backward, and non-tensor inputs.
- **`use_reentrant=False`** (recommended): Uses a newer implementation based on saved-tensor hooks. More robust, compatible with `torch.compile`, and handles edge cases correctly.

**Always use `use_reentrant=False`** in new code:

```python
x = checkpoint(layer, x, use_reentrant=False)
```

### 6.4 Checkpoint Sequential

For a simple sequential stack of layers, PyTorch provides a convenience function:

```python
from torch.utils.checkpoint import checkpoint_sequential

class SequentialTransformer(torch.nn.Module):
    def __init__(self, n_layers: int, d_model: int, n_heads: int, d_ff: int):
        super().__init__()
        self.layers = torch.nn.Sequential(*[
            TransformerBlock(d_model, n_heads, d_ff)
            for _ in range(n_layers)
        ])
        self.n_segments = int(n_layers ** 0.5)  # sqrt(N) segments

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Automatically divides layers into segments
        # and checkpoints each segment boundary
        return checkpoint_sequential(
            self.layers,
            segments=self.n_segments,
            input=x,
            use_reentrant=False,
        )
```

### 6.5 Custom Selective Checkpointing

For fine-grained control, implement selective checkpointing within a transformer block:

```python
class TransformerBlockSelective(torch.nn.Module):
    """Transformer block with selective activation recomputation.

    Stores: input, QKV projections, output projection, MLP projections.
    Recomputes: attention scores, softmax, dropout masks.
    """
    def __init__(self, d_model: int, n_heads: int, d_ff: int,
                 checkpoint_attention: bool = True):
        super().__init__()
        self.checkpoint_attention = checkpoint_attention
        self.q_proj = torch.nn.Linear(d_model, d_model)
        self.k_proj = torch.nn.Linear(d_model, d_model)
        self.v_proj = torch.nn.Linear(d_model, d_model)
        self.o_proj = torch.nn.Linear(d_model, d_model)
        self.norm1 = torch.nn.LayerNorm(d_model)
        self.norm2 = torch.nn.LayerNorm(d_model)
        self.ff_up = torch.nn.Linear(d_model, d_ff)
        self.ff_down = torch.nn.Linear(d_ff, d_model)
        self.n_heads = n_heads

    def _attention_core(self, q, k, v):
        """The part we want to checkpoint: scores, softmax, matmul."""
        d_k = q.size(-1)
        scores = torch.matmul(q, k.transpose(-2, -1)) / (d_k ** 0.5)
        attn_weights = torch.softmax(scores, dim=-1)
        attn_weights = torch.nn.functional.dropout(attn_weights, p=0.1,
                                                     training=self.training)
        return torch.matmul(attn_weights, v)

    def forward(self, x):
        # --- Attention ---
        residual = x
        x = self.norm1(x)
        B, S, D = x.shape
        H = self.n_heads

        q = self.q_proj(x).view(B, S, H, D // H).transpose(1, 2)
        k = self.k_proj(x).view(B, S, H, D // H).transpose(1, 2)
        v = self.v_proj(x).view(B, S, H, D // H).transpose(1, 2)

        # Checkpoint only the attention core (scores + softmax)
        if self.checkpoint_attention and self.training:
            attn_out = checkpoint(self._attention_core, q, k, v,
                                  use_reentrant=False)
        else:
            attn_out = self._attention_core(q, k, v)

        attn_out = attn_out.transpose(1, 2).contiguous().view(B, S, D)
        x = residual + self.o_proj(attn_out)

        # --- MLP ---
        residual = x
        x = self.norm2(x)
        x = residual + self.ff_down(torch.nn.functional.gelu(self.ff_up(x)))
        return x
```

---

## 7. Memory Savings Analysis: Concrete Numbers

### 7.1 Case Study: Llama-2 7B

Model configuration: $N = 32$ layers, $d = 4096$, $h = 32$, $d_{\text{ff}} = 11008$, BF16 activations.

**Per-layer activation memory (without FlashAttention):**

$$M_{\text{layer}}(s) = (19 \times 4096 \times s + 3 \times 32 \times s^2) \times 2 \text{ bytes}$$

For $s = 4096$: $M_{\text{layer}} \approx 3.9$ GB.

| Strategy | Stored Layers | Peak Activation Memory | Compute Overhead |
|----------|--------------|----------------------|-----------------|
| No checkpointing | 32 | 125 GB | 0% |
| Full checkpointing ($k = 6$) | $\sim 12$ | 27 GB | 33% |
| Full checkpointing + FlashAttention | $\sim 12$ | 14 GB | 33% |
| Selective (attn scores only) + FA | 32 (partial) | 18 GB | ~10% |

### 7.2 Scaling with Sequence Length

The attention scores contribute $O(s^2)$ memory per layer. Without FlashAttention:

| Sequence Length | Attn Scores / Layer | Total Attn (32 layers) | % of Total Activations |
|----------------|--------------------|-----------------------|----------------------|
| 2048 | 0.8 GB | 25.6 GB | 41% |
| 4096 | 3.2 GB | 102.4 GB | 65% |
| 8192 | 12.8 GB | 409.6 GB | 82% |
| 32768 | 204.8 GB | 6553.6 GB | 96% |

This makes it abundantly clear why FlashAttention (which eliminates the $O(s^2)$ attention score storage) is essential for long-context training, independent of its compute benefits.

---

## 8. Advanced Techniques

### 8.1 Activation Offloading

Instead of recomputing activations, **offload** them to CPU memory during the forward pass and reload them during the backward pass. The tradeoff is PCIe bandwidth vs. recomputation cost.

PCIe Gen5 x16 provides ~64 GB/s bidirectional bandwidth. For a layer producing 3.9 GB of activations:

$$\text{Transfer time} = \frac{3.9 \text{ GB}}{64 \text{ GB/s}} \approx 61 \text{ ms}$$

If the layer's forward pass takes ~5 ms, recomputation is 6x cheaper than offloading. Offloading is only worthwhile for very compute-heavy layers where recomputation cost exceeds transfer cost, which is rare on modern GPUs.

However, **overlapping** offloading with compute can hide the latency:

```python
class OffloadingCheckpoint:
    """Overlap activation offload to CPU with forward computation."""

    def __init__(self):
        self.cpu_activations = {}
        self.d2h_stream = torch.cuda.Stream()  # device-to-host stream
        self.h2d_stream = torch.cuda.Stream()  # host-to-device stream

    def save_activation(self, name: str, tensor: torch.Tensor):
        """Async copy activation to CPU pinned memory."""
        cpu_tensor = torch.empty_like(tensor, device='cpu',
                                       pin_memory=True)
        with torch.cuda.stream(self.d2h_stream):
            cpu_tensor.copy_(tensor, non_blocking=True)
        self.cpu_activations[name] = cpu_tensor

    def load_activation(self, name: str, device: torch.device) -> torch.Tensor:
        """Async copy activation back to GPU."""
        cpu_tensor = self.cpu_activations[name]
        gpu_tensor = torch.empty_like(cpu_tensor, device=device)
        with torch.cuda.stream(self.h2d_stream):
            gpu_tensor.copy_(cpu_tensor, non_blocking=True)
        self.h2d_stream.synchronize()
        return gpu_tensor
```

### 8.2 Checkpointing with Pipeline Parallelism

In pipeline parallelism, different stages (groups of layers) run on different GPUs. Each stage stores activations for its layers. Gradient checkpointing reduces per-stage memory, allowing either:
- More layers per stage (fewer pipeline stages, higher throughput).
- Larger micro-batch sizes (better pipeline bubble ratio).

The interaction is multiplicative: if gradient checkpointing reduces activation memory by $5\times$ and the model has 4 pipeline stages, each stage needs $\frac{1}{5} \times \frac{1}{4} = \frac{1}{20}$ of the total activation memory.

### 8.3 Checkpointing in the Presence of Stochasticity

Layers with stochastic operations (dropout, stochastic depth) require special handling during recomputation. The recomputed forward pass must produce **identical** random masks as the original, or the gradients will be incorrect.

PyTorch's `checkpoint` handles this by saving and restoring the CUDA RNG state:

```python
# Internally, checkpoint saves:
fwd_rng_state_cuda = torch.cuda.get_rng_state()
fwd_rng_state_cpu = torch.random.get_rng_state()

# Before recomputation in backward:
torch.cuda.set_rng_state(fwd_rng_state_cuda)
torch.random.set_rng_state(fwd_rng_state_cpu)
# Now dropout will produce the same mask
```

**Caution:** If you use non-PyTorch random number generators (e.g., NumPy, Python `random`) inside a checkpointed function, their states will NOT be saved/restored, leading to silent gradient errors.

### 8.4 Optimal Checkpointing for DAGs (Griewank & Walther)

The $\sqrt{N}$ result applies to sequential (chain) computation graphs. For general DAGs (e.g., U-Nets with skip connections, multi-branch architectures), optimal checkpointing is NP-hard in general.

**Revolve algorithm** (Griewank & Walther, 2000): For sequential graphs with a budget of $c$ checkpoints and $N$ time steps, the optimal schedule can be computed in $O(N \cdot c)$ time using dynamic programming. The minimum number of recomputations $r(N, c)$ satisfies:

$$r(N, c) = r(N - c, c) + r(c - 1, c - 1) + c - 1$$

with base cases $r(0, c) = 0$ and $r(N, 0) = \infty$ for $N > 0$.

For practical deep learning, the simple uniform $\sqrt{N}$ strategy is near-optimal and much simpler to implement.

---

## 9. Profiling and Debugging

### 9.1 Measuring Activation Memory

```python
import torch
from torch.profiler import profile, ProfilerActivity

def measure_activation_memory(model, input_tensor):
    """Measure peak activation memory during a training step."""
    torch.cuda.reset_peak_memory_stats()
    torch.cuda.empty_cache()

    # Baseline: just parameters + optimizer
    baseline = torch.cuda.memory_allocated()

    output = model(input_tensor)
    fwd_peak = torch.cuda.max_memory_allocated() - baseline

    loss = output.sum()
    loss.backward()
    bwd_peak = torch.cuda.max_memory_allocated() - baseline

    print(f"Forward peak activation memory: {fwd_peak / 1e9:.2f} GB")
    print(f"Overall peak memory (fwd+bwd):  {bwd_peak / 1e9:.2f} GB")

    return fwd_peak, bwd_peak
```

### 9.2 Comparing With and Without Checkpointing

```python
import torch
import torch.nn as nn
from torch.utils.checkpoint import checkpoint

class BenchmarkModel(nn.Module):
    def __init__(self, n_layers, d_model, use_checkpointing=False):
        super().__init__()
        self.layers = nn.ModuleList([
            nn.Sequential(
                nn.LayerNorm(d_model),
                nn.Linear(d_model, 4 * d_model),
                nn.GELU(),
                nn.Linear(4 * d_model, d_model),
            )
            for _ in range(n_layers)
        ])
        self.use_checkpointing = use_checkpointing

    def forward(self, x):
        for layer in self.layers:
            if self.use_checkpointing:
                x = x + checkpoint(layer, x, use_reentrant=False)
            else:
                x = x + layer(x)
        return x

# --- Benchmark ---
n_layers, d_model, seq_len, batch_size = 48, 2048, 1024, 4

for use_ckpt in [False, True]:
    model = BenchmarkModel(n_layers, d_model, use_ckpt).cuda()
    optimizer = torch.optim.AdamW(model.parameters())
    x = torch.randn(batch_size, seq_len, d_model, device='cuda')

    torch.cuda.reset_peak_memory_stats()
    torch.cuda.synchronize()

    # Warmup
    for _ in range(3):
        optimizer.zero_grad(set_to_none=True)
        loss = model(x).sum()
        loss.backward()
        optimizer.step()

    torch.cuda.synchronize()
    peak_mem = torch.cuda.max_memory_allocated() / 1e9

    # Timed run
    import time
    torch.cuda.synchronize()
    start = time.perf_counter()
    for _ in range(10):
        optimizer.zero_grad(set_to_none=True)
        loss = model(x).sum()
        loss.backward()
        optimizer.step()
    torch.cuda.synchronize()
    elapsed = (time.perf_counter() - start) / 10

    label = "With checkpointing" if use_ckpt else "Without checkpointing"
    print(f"{label}: Peak memory = {peak_mem:.2f} GB, "
          f"Step time = {elapsed*1000:.1f} ms")

    del model, optimizer, x
    torch.cuda.empty_cache()
```

### 9.3 Verifying Gradient Correctness

Gradient checkpointing should produce **identical** gradients to standard training (modulo floating-point non-associativity with `use_reentrant=False`). Always verify:

```python
def verify_checkpoint_gradients(model_cls, *args, **kwargs):
    """Verify that checkpointing produces identical gradients."""
    torch.manual_seed(42)
    model_no_ckpt = model_cls(*args, use_checkpointing=False, **kwargs).cuda()

    torch.manual_seed(42)
    model_ckpt = model_cls(*args, use_checkpointing=True, **kwargs).cuda()

    x = torch.randn(2, 128, args[1], device='cuda')  # small input

    # Same forward/backward
    torch.manual_seed(0)
    loss1 = model_no_ckpt(x).sum()
    loss1.backward()

    torch.manual_seed(0)
    loss2 = model_ckpt(x).sum()
    loss2.backward()

    for (n1, p1), (n2, p2) in zip(
        model_no_ckpt.named_parameters(),
        model_ckpt.named_parameters()
    ):
        if p1.grad is not None:
            max_diff = (p1.grad - p2.grad).abs().max().item()
            assert max_diff < 1e-5, f"Gradient mismatch in {n1}: {max_diff}"
    print("All gradients match!")
```

---

## 10. Decision Framework

### 10.1 When to Use Gradient Checkpointing

| Scenario | Recommendation |
|----------|---------------|
| Activation memory fits in GPU | Do not checkpoint — avoid the overhead. |
| Activation memory 1.5-3x over budget | Selective checkpointing (attention scores only). |
| Activation memory 3-10x over budget | Full per-block checkpointing ($\sqrt{N}$ segments). |
| Extreme memory pressure | Full checkpointing + FlashAttention + offloading. |
| Already using pipeline parallelism | Checkpoint to reduce per-stage memory, enabling larger micro-batches. |

### 10.2 Interaction with Other Techniques

| Technique | Reduces | Interaction with Checkpointing |
|-----------|---------|-------------------------------|
| Mixed precision (BF16) | Activation memory by 2x | Complementary — checkpoint BF16 activations. |
| FlashAttention | Attention activation memory by $O(s)$ | Highly synergistic — eliminates the $O(s^2)$ term. |
| Tensor parallelism | Per-device activation by $1/T$ | Complementary — each device checkpoints independently. |
| ZeRO / FSDP | Parameter + optimizer memory | Orthogonal — targets different memory components. |

---

## Key Takeaways

1. **Activations dominate memory** at large batch sizes and sequence lengths, often exceeding parameter memory by 5-10x for transformer models.

2. **The $\sqrt{N}$ checkpointing strategy** is optimal for sequential networks: store activations at $\sqrt{N}$ evenly-spaced checkpoints, achieving $O(\sqrt{N})$ memory with at most 33% compute overhead.

3. **Selective checkpointing** of attention scores (the most memory-hungry, cheapest-to-recompute activations) achieves most of the memory savings with much less compute overhead (~10%).

4. **FlashAttention is the most important complement** to gradient checkpointing: it eliminates the $O(s^2)$ attention score storage, which dominates at long sequence lengths.

5. **Always verify gradient correctness** when implementing checkpointing. Use `use_reentrant=False` in PyTorch for robustness and compatibility with `torch.compile`.

6. **Profile before deciding.** Use `torch.cuda.max_memory_allocated()` to measure actual peak memory. The theoretical analysis provides guidance, but kernel-level details and memory fragmentation can shift the balance.

---

## Further Reading

### Required

1. **Chen, T., Xu, B., Zhang, C., & Guestrin, C.** (2016). "Training Deep Nets with Sublinear Memory Cost." arXiv:1604.06174.
   - The foundational paper on gradient checkpointing for deep learning. Derives the $\sqrt{N}$ strategy.

2. **Dao, T., Fu, D. Y., Ermon, S., Rudra, A., & Re, C.** (2022). "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." *NeurIPS 2022*.
   - Sections on memory analysis and the implicit checkpointing of attention scores.

### Recommended

3. **Griewank, A. & Walther, A.** (2000). "Algorithm 799: Revolve: An Implementation of Checkpointing for the Reverse or Adjoint Mode of Computational Differentiation." *ACM TOMS*, 26(1), 19-45.
   - The optimal checkpointing algorithm for sequential computations with bounded checkpoint storage.

4. **Korthikanti, V., et al.** (2023). "Reducing Activation Recomputation in Large Transformer Models." *MLSys 2023*.
   - Describes Megatron-LM's selective recomputation strategy for large-scale transformer training.

5. **Jain, P., et al.** (2020). "Checkmate: Breaking the Memory Wall with Optimal Tensor Rematerialization." *MLSys 2020*.
   - ILP-based optimal checkpointing for general computation graphs.

### Implementation References

6. **PyTorch Documentation.** `torch.utils.checkpoint`.
   - Official API reference and usage examples.

7. **DeepSpeed Activation Checkpointing Documentation.**
   - Describes CPU offloading and partitioned checkpointing for extremely large models.
