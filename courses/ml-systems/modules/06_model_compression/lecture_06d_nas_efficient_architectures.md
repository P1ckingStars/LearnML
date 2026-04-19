# Lecture 06d: Neural Architecture Search & Efficient Architectures

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formalize** the Neural Architecture Search problem as a bilevel optimization over a discrete search space, identifying the search space, search strategy, and performance estimation components.
2. **Derive** the continuous relaxation used in differentiable NAS (DARTS) and analyze its computational cost relative to reinforcement-learning-based and evolutionary search strategies.
3. **Analyze** the design principles behind efficient architectures --- depthwise separable convolutions (MobileNet), compound scaling (EfficientNet), and inverted residual blocks --- quantifying their FLOPs and parameter savings.
4. **Evaluate** hardware-aware NAS methods that co-optimize accuracy and latency, understanding how platform-specific constraints shape the resulting architectures.
5. **Compare** architecture efficiency metrics (FLOPs, latency, memory, parameter count) and explain when each is the appropriate optimization target.
6. **Explain** parameter-efficient fine-tuning methods (LoRA, QLoRA, adapters, prefix tuning), analyzing their memory savings, trainable parameter counts, and inference overhead tradeoffs.

---

## 2. Motivation and Context

### 2.1 The Architecture Design Bottleneck

For most of deep learning's history, architecture design has been a manual, expert-driven process. ResNet, Inception, VGG --- each represents thousands of researcher-hours of intuition, experimentation, and incremental refinement. Neural Architecture Search (NAS) automates this process by searching over a space of architectures for one that optimizes a given objective.

The appeal is twofold:

1. **Discovery**: NAS can find architectures that human designers would not consider, potentially discovering novel design patterns.
2. **Task-specific optimization**: Rather than using a general-purpose architecture, NAS can find architectures tailored to specific hardware, latency constraints, or data characteristics.

### 2.2 Cost and Controversy

The original NAS paper (Zoph & Le, 2017) used 800 GPUs for 28 days --- approximately 22,400 GPU-days --- to search for a cell architecture on CIFAR-10. At 2017 cloud prices, this cost roughly $\$150,000$. This sparked both excitement (the found architecture was competitive with human designs) and criticism (the search cost was impractical for most researchers).

Modern NAS methods have reduced the cost by 1000--10000x through weight sharing and differentiable relaxations, making NAS practical on a single GPU in hours.

---

## 3. The NAS Problem Formulation

### 3.1 Three Components

NAS is defined by three components:

**Search space** $\mathcal{A}$: The set of candidate architectures. Typically parameterized as a directed acyclic graph (DAG) where nodes are feature maps and edges are operations (conv 3x3, conv 5x5, max pool, skip connection, zero).

**Search strategy**: The algorithm for exploring $\mathcal{A}$. Options include reinforcement learning, evolutionary algorithms, Bayesian optimization, and gradient-based methods.

**Performance estimation**: How to evaluate a candidate architecture's quality. Options range from full training to convergence (expensive) to weight sharing, early stopping, and learning curve extrapolation (cheap but noisy).

### 3.2 Bilevel Optimization

NAS is naturally a bilevel optimization problem:

$$\min_{\alpha \in \mathcal{A}} \; \mathcal{L}_{\text{val}}(w^*(\alpha), \alpha)$$

$$\text{s.t.} \quad w^*(\alpha) = \arg\min_w \; \mathcal{L}_{\text{train}}(w, \alpha)$$

The outer problem optimizes the architecture $\alpha$ to minimize validation loss. The inner problem trains the weights $w$ to optimality for each architecture candidate. The inner problem is itself a large-scale optimization (full neural network training), making exact bilevel optimization intractable.

### 3.3 Cell-Based Search Spaces

To reduce the search space, NAS typically searches for a **cell** (a small computational block) that is stacked repeatedly to form the full network. This mirrors human architecture design (e.g., ResNet stacks residual blocks).

A cell takes as input the outputs of the two preceding cells and produces a single output. Internally, it is a DAG with $N$ nodes ($N$ typically 4--7). Each node $x_j$ computes:

$$x_j = \sum_{i < j} o_{ij}(x_i)$$

where $o_{ij} \in \mathcal{O}$ is an operation selected from a predefined operation set:

$$\mathcal{O} = \{\text{conv 3x3}, \text{conv 5x5}, \text{sep conv 3x3}, \text{sep conv 5x5}, \text{max pool 3x3}, \text{avg pool 3x3}, \text{skip}, \text{zero}\}$$

The search space size is $|\mathcal{O}|^{N(N-1)/2}$. For $|\mathcal{O}| = 8$ and $N = 7$: $8^{21} \approx 9.4 \times 10^{18}$ --- astronomical, but structured enough for efficient search.

---

## 4. Search Strategies

### 4.1 Reinforcement Learning (Zoph & Le, 2017)

The original NAS approach uses a **controller** (an RNN) that generates architecture descriptions as sequences of tokens. The controller is trained with REINFORCE to maximize the expected validation accuracy:

$$J(\theta_c) = \mathbb{E}_{a \sim \pi_{\theta_c}} [R(a)]$$

where $\theta_c$ are the controller parameters, $a$ is a sampled architecture, and $R(a)$ is the validation accuracy after training architecture $a$ to convergence.

The gradient is estimated via the REINFORCE estimator:

$$\nabla_{\theta_c} J \approx \frac{1}{M} \sum_{m=1}^{M} (R(a_m) - b) \nabla_{\theta_c} \log \pi_{\theta_c}(a_m)$$

where $b$ is a baseline (moving average of rewards) for variance reduction.

**Cost**: Each architecture sample requires full training. With $M$ samples per update and $U$ updates: total cost $= M \times U \times T_{\text{train}}$. This is why the original NAS required 22,400 GPU-days.

### 4.2 Evolutionary Search (Real et al., 2019)

AmoebaNet uses regularized evolution:

```
Algorithm: Regularized Evolution for NAS
-----------------------------------------
Input: Population size P, num_generations G, search space A

1. Initialize population: sample P random architectures from A
2. Train each and record validation accuracy
3. For g = 1, ..., G:
   a. SELECTION: sample S individuals uniformly at random
   b. PARENT: select the one with highest accuracy
   c. MUTATION: modify one random edge/operation in the parent
   d. CHILD: train the mutated architecture
   e. ADD child to population
   f. REMOVE the oldest individual (regardless of fitness)
4. Return the architecture with highest accuracy
```

The key innovation is step 3f: removing the *oldest* (not worst) individual prevents the population from converging prematurely and encourages exploration.

### 4.3 Differentiable NAS: DARTS (Liu et al., 2019)

DARTS (Differentiable Architecture Search) makes the search space continuous, enabling gradient-based optimization over architectures.

**Continuous relaxation.** Instead of selecting a single operation $o_{ij}$ for each edge, DARTS computes a weighted mixture:

$$\bar{o}_{ij}(x) = \sum_{o \in \mathcal{O}} \frac{\exp(\alpha_{ij}^o)}{\sum_{o'} \exp(\alpha_{ij}^{o'})} \cdot o(x)$$

where $\alpha_{ij}^o$ are learnable architecture parameters. The softmax produces mixing weights over operations.

**Bilevel optimization with gradient descent.** DARTS alternates between:

1. **Weight update**: Fix $\alpha$, update $w$ by gradient descent on training loss:

$$w \leftarrow w - \eta_w \nabla_w \mathcal{L}_{\text{train}}(w, \alpha)$$

2. **Architecture update**: Fix $w$, update $\alpha$ by gradient descent on validation loss:

$$\alpha \leftarrow \alpha - \eta_\alpha \nabla_\alpha \mathcal{L}_{\text{val}}(w, \alpha)$$

The architecture gradient is:

$$\nabla_\alpha \mathcal{L}_{\text{val}}(w^*(\alpha), \alpha) \approx \nabla_\alpha \mathcal{L}_{\text{val}}(w - \eta_w \nabla_w \mathcal{L}_{\text{train}}(w, \alpha), \alpha)$$

This involves a gradient through a gradient (second-order), computed efficiently via finite differences:

$$\nabla_\alpha^2 \approx \frac{\nabla_\alpha \mathcal{L}_{\text{val}}(w^+, \alpha) - \nabla_\alpha \mathcal{L}_{\text{val}}(w^-, \alpha)}{2 \epsilon}$$

where $w^\pm = w \pm \epsilon \nabla_w \mathcal{L}_{\text{val}}(w, \alpha)$.

**Discretization.** After search, the continuous architecture is discretized by selecting the top-$k$ operations per node:

$$o_{ij}^* = \arg\max_{o \in \mathcal{O}} \alpha_{ij}^o$$

**Cost.** DARTS trains a single shared network with architecture parameters, requiring only $O(1)$ times the cost of training a single architecture. The total cost is about 1--4 GPU-days on CIFAR-10.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class MixedOp(nn.Module):
    """
    A mixed operation: softmax-weighted sum of all candidate operations.
    During search, all operations are active. After search, only the
    top-1 is retained.
    """
    def __init__(self, C: int, operations: list[nn.Module]):
        super().__init__()
        self.ops = nn.ModuleList(operations)
        # Architecture parameters: one per operation
        self.alpha = nn.Parameter(torch.zeros(len(operations)))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: input tensor, shape (B, C, H, W)
        Returns:
            Weighted sum of all operations applied to x
        """
        weights = F.softmax(self.alpha, dim=0)  # (num_ops,)
        return sum(w * op(x) for w, op in zip(weights, self.ops))
        # Output shape: (B, C, H, W)


class DARTSCell(nn.Module):
    """
    A single DARTS cell with N intermediate nodes.
    Each node receives input from all previous nodes via MixedOps.
    """
    def __init__(self, C: int, N: int, op_constructors: list):
        """
        Args:
            C: number of channels
            N: number of intermediate nodes
            op_constructors: list of callables, each returns an nn.Module
        """
        super().__init__()
        self.N = N
        self.edges = nn.ModuleDict()
        for j in range(2, N + 2):  # nodes 2..N+1 (0,1 are inputs)
            for i in range(j):
                ops = [ctor(C) for ctor in op_constructors]
                self.edges[f"{i}_{j}"] = MixedOp(C, ops)

    def forward(self, s0: torch.Tensor, s1: torch.Tensor) -> torch.Tensor:
        """
        Args:
            s0: output of cell_{l-2}, shape (B, C, H, W)
            s1: output of cell_{l-1}, shape (B, C, H, W)
        Returns:
            Cell output, shape (B, C, H, W)
        """
        states = [s0, s1]
        for j in range(2, self.N + 2):
            s_j = sum(
                self.edges[f"{i}_{j}"](states[i])
                for i in range(j)
            )
            states.append(s_j)
        # Concatenate all intermediate node outputs
        return torch.cat(states[2:], dim=1)  # (B, N*C, H, W)
```

### 4.4 Limitations of DARTS

1. **Collapse**: DARTS tends to select parameter-free operations (skip connections, pooling) over parameterized ones (convolutions) because parameter-free operations have lower validation loss early in training. This leads to degenerate architectures.

2. **Discretization gap**: The continuous architecture (softmax mixture) and the discretized architecture (argmax selection) can behave very differently. A small change in $\alpha$ can flip the argmax, causing a large change in the discrete architecture.

3. **Memory cost**: The supernet holds all operations simultaneously, multiplying memory cost by $|\mathcal{O}|$.

**Mitigations**: Progressive DARTS (P-DARTS) gradually narrows the search space. FairDARTS adds entropy regularization to prevent collapse. ProxylessNAS binarizes the search to reduce memory.

---

## 5. Efficient Architecture Design Principles

### 5.1 Depthwise Separable Convolutions

A standard convolution with kernel $k$, input channels $C_{\text{in}}$, and output channels $C_{\text{out}}$ costs:

$$\text{FLOPs}_{\text{standard}} = 2 \cdot k^2 \cdot C_{\text{in}} \cdot C_{\text{out}} \cdot H \cdot W$$

$$\text{Params}_{\text{standard}} = k^2 \cdot C_{\text{in}} \cdot C_{\text{out}}$$

A **depthwise separable convolution** decomposes this into two operations:

1. **Depthwise convolution**: Apply a separate $k \times k$ filter to each input channel independently.

$$\text{FLOPs}_{\text{DW}} = 2 \cdot k^2 \cdot C_{\text{in}} \cdot H \cdot W, \qquad \text{Params}_{\text{DW}} = k^2 \cdot C_{\text{in}}$$

2. **Pointwise convolution**: Apply a $1 \times 1$ convolution to mix channels.

$$\text{FLOPs}_{\text{PW}} = 2 \cdot C_{\text{in}} \cdot C_{\text{out}} \cdot H \cdot W, \qquad \text{Params}_{\text{PW}} = C_{\text{in}} \cdot C_{\text{out}}$$

**Total depthwise separable cost:**

$$\text{FLOPs}_{\text{DS}} = 2 H W C_{\text{in}} (k^2 + C_{\text{out}})$$

**Savings ratio:**

$$\frac{\text{FLOPs}_{\text{DS}}}{\text{FLOPs}_{\text{standard}}} = \frac{k^2 + C_{\text{out}}}{k^2 \cdot C_{\text{out}}} = \frac{1}{C_{\text{out}}} + \frac{1}{k^2}$$

For $C_{\text{out}} = 256$, $k = 3$: savings $= 1/256 + 1/9 \approx 0.115$, an **8.7x reduction** in FLOPs.

### 5.2 MobileNet V1 and V2

**MobileNet V1 (Howard et al., 2017)** replaces all standard convolutions with depthwise separable convolutions and introduces two hyperparameters:

- **Width multiplier** $\alpha \in (0, 1]$: Scales the number of channels by $\alpha$. FLOPs scale as $\alpha^2$.
- **Resolution multiplier** $\rho \in (0, 1]$: Scales the input resolution. FLOPs scale as $\rho^2$.

**MobileNet V2 (Sandler et al., 2018)** introduces the **inverted residual block**:

```
Input (C channels)
  |
  v
1x1 Conv: C -> t*C  (expansion, ReLU6)     // Expand to higher dim
  |
  v
3x3 DWConv: t*C -> t*C  (depthwise, ReLU6) // Spatial filtering
  |
  v
1x1 Conv: t*C -> C' (projection, linear)    // Project back to low dim
  |
  v
(+ residual if C == C' and stride == 1)
```

The expansion factor $t$ (typically 6) temporarily expands the representation to a higher dimension, applies the depthwise convolution in this high-dimensional space, then projects back. The residual connection is on the *narrow* (low-dimensional) representations, which is the opposite of a standard residual block (hence "inverted").

**Why inverted?** The bottleneck (narrow) representation is where information flows through the residual connection. This is efficient because the skip connection adds no FLOPs, and it operates on compact representations. The expanded representation exists only transiently within the block.

### 5.3 EfficientNet and Compound Scaling

**Observation (Tan & Le, 2019):** Prior work scaled networks along a single dimension --- width (WideResNet), depth (ResNet), or resolution (higher input size). Tan and Le showed that scaling all three dimensions simultaneously with a fixed ratio is more efficient.

**Compound scaling.** Given a baseline network $B$, the compound scaling rule is:

$$\text{depth}: d = \alpha^\phi, \quad \text{width}: w = \beta^\phi, \quad \text{resolution}: r = \gamma^\phi$$

subject to the constraint:

$$\alpha \cdot \beta^2 \cdot \gamma^2 \approx 2$$

This constraint ensures that increasing $\phi$ by 1 approximately doubles the FLOPs ($d$ is linear in FLOPs, $w^2$ and $r^2$ are quadratic).

The coefficients $\alpha, \beta, \gamma$ are found by a small grid search at $\phi = 1$, then $\phi$ is increased for larger models.

**EfficientNet family:**

| Model | $\phi$ | Resolution | Params | FLOPs | ImageNet Top-1 |
|-------|--------|------------|--------|-------|----------------|
| B0    | 0      | 224        | 5.3M   | 0.39B | 77.1%          |
| B1    | 1      | 240        | 7.8M   | 0.70B | 79.1%          |
| B3    | 3      | 300        | 12M    | 1.8B  | 81.6%          |
| B5    | 5      | 456        | 30M    | 9.9B  | 83.6%          |
| B7    | 7      | 600        | 66M    | 37B   | 84.3%          |

For comparison, ResNet-50 achieves 76.0% with 25.6M parameters and 4.1B FLOPs --- EfficientNet-B0 is more accurate with 2x fewer FLOPs.

---

## 6. Hardware-Aware NAS

### 6.1 The FLOPs Fallacy

FLOPs (floating-point operations) are a poor proxy for actual latency on real hardware because:

1. **Memory access cost** varies with data layout, cache behavior, and memory bandwidth.
2. **Parallelism**: A layer with fewer FLOPs but lower parallelism (e.g., depthwise conv with few channels) can be slower than a layer with more FLOPs but high parallelism.
3. **Operator fusion**: Some operation sequences (conv + BN + ReLU) are fused into a single kernel by compilers, making their combined latency less than the sum.
4. **Platform-specific**: The same architecture has different relative latencies on a GPU vs. a mobile CPU vs. a TPU.

**Example:** On a mobile CPU, a standard 3x3 convolution with $C_{\text{in}} = C_{\text{out}} = 32$ may be faster than a depthwise separable convolution with the same $C$ because the standard convolution maps efficiently to NEON SIMD instructions, while the depthwise convolution has low arithmetic intensity and is memory-bound.

### 6.2 Latency-Constrained NAS

Hardware-aware NAS directly optimizes for measured latency. The search objective becomes multi-objective:

$$\max_\alpha \; \text{Acc}(\alpha) \quad \text{s.t.} \quad \text{Latency}(\alpha) \le L_{\text{target}}$$

or equivalently (Lagrangian relaxation):

$$\max_\alpha \; \text{Acc}(\alpha) - \lambda \cdot \max(0, \text{Latency}(\alpha) - L_{\text{target}})$$

**MnasNet (Tan et al., 2019)** uses the reward function:

$$R(\alpha) = \text{Acc}(\alpha) \times \left(\frac{\text{Latency}(\alpha)}{T}\right)^w$$

where $T$ is the target latency and $w = -0.07$ provides a soft penalty for exceeding the latency target.

### 6.3 Latency Prediction

Measuring latency on-device for every candidate architecture is expensive. Latency prediction models enable fast evaluation:

**Lookup tables (LUTs)**: Profile each operation type at each possible configuration (channels, spatial size, stride) on the target device. Total latency is the sum of per-operation latencies. Accurate for sequential execution (mobile CPUs) but misses inter-operation effects (pipelining, caching).

**Learned predictors**: Train a neural network to predict latency from architecture descriptors. More accurate than LUTs because it captures inter-operation interactions, but requires a training set of (architecture, measured latency) pairs.

### 6.4 Once-for-All Networks (Cai et al., 2020)

OFA trains a single "supernet" that supports $10^{19}$ sub-architectures (varying depth, width, kernel size, and resolution). At deployment time, a specialized sub-architecture is extracted for the target device without any retraining:

```
Algorithm: Once-for-All
-----------------------
1. TRAINING: Train a supernet supporting all configurations
   - Progressive shrinking: start with the largest config,
     gradually activate smaller sub-networks
   - Use knowledge distillation from the largest sub-network

2. DEPLOYMENT: For a target device with latency constraint L:
   a. Build a latency predictor for the device
   b. Evolutionary search over sub-architectures:
      maximize accuracy subject to latency <= L
   c. Extract the sub-architecture (no retraining needed)
```

The key benefit: the supernet is trained once (about 1200 GPU-hours), and deployment to a new device requires only a few minutes of evolutionary search.

---

## 7. Efficiency Metrics

### 7.1 FLOPs (Multiply-Accumulate Operations)

$$\text{FLOPs} = \sum_{\ell} \text{FLOPs}(\ell)$$

For linear layers: $\text{FLOPs} = 2 \cdot d_{\text{in}} \cdot d_{\text{out}} \cdot B$ (multiply and accumulate per output element).

For convolutions: $\text{FLOPs} = 2 \cdot k^2 \cdot C_{\text{in}} \cdot C_{\text{out}} \cdot H_{\text{out}} \cdot W_{\text{out}} \cdot B$.

**Limitation**: FLOPs ignore memory access patterns, parallelism, and hardware-specific optimizations.

### 7.2 Parameter Count

$$\text{Params} = \sum_{\ell} |\theta_\ell|$$

Determines model storage size and download cost. Not directly related to inference speed (a model with fewer parameters can be slower if it has more sequential operations).

### 7.3 Latency

Actual wall-clock time for a forward pass on specific hardware. The gold standard for deployment decisions, but hardware-specific and batch-size-dependent.

### 7.4 Memory Footprint

Peak memory during inference, determined by the largest intermediate activation tensor:

$$\text{Peak memory} = \max_\ell \; \text{sizeof}(\text{activations}_\ell) + \text{sizeof}(\text{weights})$$

Critical for edge deployment where RAM is limited.

### 7.5 Throughput

Tokens (or images) processed per second at a given batch size. The relevant metric for serving workloads where many requests are batched together.

```python
import time
import torch

def measure_latency(
    model: torch.nn.Module,
    input_shape: tuple,
    device: torch.device,
    warmup: int = 50,
    repeats: int = 200,
) -> dict:
    """
    Measure model latency and throughput.

    Args:
        model: the model to benchmark
        input_shape: (batch_size, ...) input tensor shape
        device: torch device
        warmup: number of warmup iterations
        repeats: number of timed iterations

    Returns:
        Dictionary with latency_ms, throughput, and peak_memory_mb
    """
    model = model.to(device).eval()
    x = torch.randn(input_shape, device=device)

    # Warmup
    with torch.no_grad():
        for _ in range(warmup):
            _ = model(x)

    if device.type == 'cuda':
        torch.cuda.synchronize()
        torch.cuda.reset_peak_memory_stats()

    # Timed runs
    with torch.no_grad():
        start = time.perf_counter()
        for _ in range(repeats):
            _ = model(x)
        if device.type == 'cuda':
            torch.cuda.synchronize()
        end = time.perf_counter()

    elapsed_ms = (end - start) * 1000 / repeats
    batch_size = input_shape[0]
    throughput = batch_size / (elapsed_ms / 1000)

    stats = {
        'latency_ms': elapsed_ms,
        'throughput': throughput,
    }
    if device.type == 'cuda':
        stats['peak_memory_mb'] = torch.cuda.max_memory_allocated() / 1e6

    return stats
```

### 7.6 When to Use Which Metric

| Deployment Scenario | Primary Metric | Secondary Metric |
|--------------------|----------------|------------------|
| Mobile / edge (real-time) | Latency | Memory footprint |
| Cloud serving (high throughput) | Throughput | Cost per query |
| Model download (OTA update) | Parameter count | FLOPs |
| Research comparison | FLOPs | Accuracy vs. FLOPs Pareto |

---

## 8. Parameter-Efficient Fine-Tuning (PEFT)

### 8.1 The Fine-Tuning Problem

Large language models are typically deployed via fine-tuning: take a pretrained base model and update its parameters on a downstream task. **Full fine-tuning** updates all $N$ parameters, which requires storing the full model weights and optimizer state in memory.

For a 70B-parameter model in FP16:

- Model weights: $70 \times 10^9 \times 2$ bytes = **140 GB**
- Adam optimizer state (FP32 copy of weights + first and second moments): $70 \times 10^9 \times (4 + 4 + 4)$ bytes = **840 GB**
- Gradients (FP16): $70 \times 10^9 \times 2$ bytes = **140 GB**

Total memory for full fine-tuning exceeds **700 GB**, requiring multiple high-end GPUs even before accounting for activations. This is impractical for most researchers and organizations.

### 8.2 Low-Rank Adaptation (LoRA)

**Key insight (Hu et al., 2022):** The weight updates $\Delta W$ learned during fine-tuning have low intrinsic rank --- even though the weight matrices are large, the adaptation lies in a low-dimensional subspace.

LoRA freezes the pretrained weight matrix $W \in \mathbb{R}^{d \times k}$ and injects a trainable low-rank decomposition:

$$W' = W + \Delta W = W + BA$$

where $B \in \mathbb{R}^{d \times r}$, $A \in \mathbb{R}^{r \times k}$, and $r \ll \min(d, k)$.

**Trainable parameters per adapted layer:** $2 \times d \times r$ (for $B$ and $A$), compared to $d \times k$ for full fine-tuning. With typical $r = 8$--$64$ and $d, k$ in the thousands, this reduces trainable parameters by a factor of 10,000x or more.

**Initialization:** $A$ is initialized with Kaiming uniform and $B$ is initialized to zero, so $\Delta W = BA = 0$ at the start of training --- the model begins exactly at the pretrained weights.

**Inference:** After fine-tuning, the adapter weights are merged into the base model:

$$W' = W + BA$$

This merge is a one-time operation. At inference time, the model has exactly the same architecture and latency as the original --- **zero overhead**.

**Memory analysis:** For LLaMA 70B with $r = 16$, applying LoRA to all query and value projection matrices:

- Number of adapted matrices: $\sim$160 (80 layers $\times$ 2 projections)
- Parameters per adapter pair: $2 \times 8192 \times 16 = 262{,}144$
- Total adapter parameters: $\sim$42 million $\approx$ **40 MB** in FP16
- Compared to the 140 GB base model: a **3,500x reduction** in stored parameters

**Systems benefits:** Multiple task-specific adapters can share a single base model. Swapping tasks requires loading only ~40 MB of adapter weights rather than 140 GB of model weights.

### 8.3 QLoRA

**QLoRA (Dettmers et al., 2023)** combines aggressive quantization of the base model with LoRA adapters, enabling fine-tuning of very large models on a single GPU.

Three key innovations:

1. **4-bit NormalFloat (NF4) quantization:** The frozen base model is stored in 4-bit precision using a quantization scheme optimized for normally distributed weights. This reduces the base model from 140 GB (FP16) to ~35 GB for a 70B model.

2. **Double quantization:** The quantization constants (scale factors) themselves are quantized to 8-bit, saving an additional ~0.5 GB for a 70B model. This reduces the per-parameter overhead of quantization constants from 32 bits to approximately 8 bits.

3. **Paged optimizers:** Optimizer states are offloaded from GPU to CPU memory using NVIDIA unified memory, with automatic page migration. This prevents out-of-memory errors during gradient spikes caused by long sequences.

**Result:** Fine-tune a 65B-parameter model on a single 48 GB GPU (A6000 or A40), matching full 16-bit fine-tuning quality. QLoRA fine-tuning of a 33B model fits on a single 24 GB consumer GPU.

### 8.4 Systems Aspects of PEFT

**Multi-tenant serving.** In production, a single base model serves many clients, each with a task-specific LoRA adapter. The base model weights are loaded once into GPU memory and shared across all requests. Only the small adapter weights differ per tenant.

**Adapter hot-swapping.** At serving time, incoming requests are routed to the appropriate adapter. Since adapters are small (~40 MB), they can be loaded from CPU memory or SSD in milliseconds, enabling rapid switching between tasks without reloading the base model.

**Batched LoRA serving (S-LoRA, Sheng et al., 2023).** Serving many concurrent LoRA adapters efficiently requires careful memory management. S-LoRA introduces:

- A unified paging mechanism for adapter weights in GPU memory
- A custom CUDA kernel that batches the $BA$ computation across different adapters within the same batch
- Dynamic adapter loading and eviction based on request patterns

This enables serving thousands of LoRA adapters on a single GPU with minimal latency overhead compared to serving the base model alone.

**Adapter fusion.** Multiple adapters trained on different tasks can be composed --- by addition, concatenation, or learned mixing --- to create models with combined capabilities without retraining.

**Training compute savings.** Because only the adapter parameters require gradients, backpropagation through the frozen base model layers computes only activations (for the forward pass) without storing the full computational graph. This reduces both memory and compute during training.

### 8.5 Other PEFT Methods

**Adapters (Houlsby et al., 2019).** Insert small bottleneck modules between existing transformer sublayers. Each adapter consists of a down-projection $W_{\text{down}} \in \mathbb{R}^{d \times r}$, a nonlinearity, and an up-projection $W_{\text{up}} \in \mathbb{R}^{r \times d}$, with a residual connection. Unlike LoRA, adapters add sequential computation and therefore increase inference latency.

**Prefix tuning (Li & Liang, 2021).** Learn continuous "soft prompt" vectors that are prepended to the key and value sequences at every transformer layer. The base model parameters are frozen; only the prefix vectors are trained. This modifies attention patterns without changing model weights.

**Prompt tuning (Lester et al., 2021).** A simplification of prefix tuning that prepends learnable embeddings only to the input layer (not every layer). With sufficient model scale (>10B parameters), prompt tuning matches full fine-tuning performance.

**Comparison of PEFT methods:**

| Method | Trainable Params | Training Memory | Inference Overhead | Merging |
|--------|------------------|-----------------|--------------------|---------|
| Full fine-tuning | 100% | Very high | None | N/A |
| LoRA ($r = 16$) | ~0.01% | Low | None (merged) | Yes |
| QLoRA ($r = 16$) | ~0.01% | Very low | Quantization cost | Yes |
| Adapters | ~1--4% | Moderate | Added latency | No |
| Prefix tuning | ~0.1% | Low | Longer sequence | No |
| Prompt tuning | ~0.01% | Low | Longer input | No |

LoRA has become the dominant PEFT method in practice because it introduces zero inference overhead, supports weight merging, and achieves performance competitive with full fine-tuning across a wide range of tasks.

---

## Key Takeaways

1. **NAS automates architecture design** by searching over a discrete space of architectures. The three key components --- search space, search strategy, and performance estimation --- each involve critical design choices.
2. **DARTS makes NAS differentiable** by relaxing discrete operation choices into continuous softmax mixtures, reducing search cost from thousands of GPU-days to single GPU-days. However, it suffers from operation collapse and discretization gap.
3. **Depthwise separable convolutions** achieve approximately $k^2 \times$ FLOPs reduction by decomposing spatial and channel mixing. This is the foundation of MobileNet and all modern efficient architectures.
4. **Compound scaling** (EfficientNet) demonstrates that jointly scaling width, depth, and resolution with a fixed ratio outperforms scaling any single dimension.
5. **FLOPs are a poor proxy for latency.** Hardware-aware NAS methods that directly optimize for on-device latency produce architectures that are 1.5--2x faster than FLOPs-optimized architectures at the same accuracy.
6. **Parameter-efficient fine-tuning (PEFT) makes large model adaptation practical.** LoRA decomposes weight updates into low-rank matrices, reducing trainable parameters by 10,000x with zero inference overhead. Combined with quantization (QLoRA), this enables fine-tuning 65B+ models on a single consumer GPU.

---

## Further Reading

### Required

1. **Zoph, B. & Le, Q. V.** (2017). "Neural Architecture Search with Reinforcement Learning." *ICLR 2017*.
   - The original NAS paper. RL-based controller generates architectures; prohibitively expensive but foundational.

2. **Liu, H., Simonyan, K., & Yang, Y.** (2019). "DARTS: Differentiable Architecture Search." *ICLR 2019*.
   - Continuous relaxation enables gradient-based architecture search. 1000x cheaper than RL-based NAS.

### Recommended

3. **Howard, A. G., Zhu, M., Chen, B., Kalenichenko, D., Wang, W., Weyand, T., Andreetto, M., & Adam, H.** (2017). "MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications." arXiv:1704.04861.
   - Depthwise separable convolutions and width/resolution multipliers.

4. **Sandler, M., Howard, A., Zhu, M., Zhmoginov, A., & Chen, L.-C.** (2018). "MobileNetV2: Inverted Residuals and Linear Bottlenecks." *CVPR 2018*.
   - Inverted residual blocks: expand-depthwise-project with linear bottleneck.

5. **Tan, M. & Le, Q. V.** (2019). "EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks." *ICML 2019*.
   - Compound scaling: jointly scale width, depth, and resolution.

6. **Tan, M., Chen, B., Pang, R., Vasudevan, V., Sandler, M., Howard, A., & Le, Q. V.** (2019). "MnasNet: Platform-Aware Neural Architecture Search for Mobile." *CVPR 2019*.
   - Hardware-aware NAS with latency in the reward function.

7. **Cai, H., Gan, C., Wang, T., Zhang, Z., & Han, S.** (2020). "Once-for-All: Train One Network and Specialize it for Efficient Deployment." *ICLR 2020*.
   - Train a single supernet supporting $10^{19}$ sub-architectures; deploy by extraction.

8. **Real, E., Aggarwal, A., Huang, Y., & Le, Q. V.** (2019). "Regularized Evolution for Image Classifier Architecture Search." *AAAI 2019*.
   - AmoebaNet: evolutionary NAS with aging-based population management.

9. **Hu, E. J., Shen, Y., Wallis, P., Allen-Zhu, Z., Li, Y., Wang, S., Wang, L., & Chen, W.** (2022). "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR 2022*.
   - Low-rank decomposition of weight updates; zero inference overhead; dominant PEFT method.

10. **Dettmers, T., Pagnoni, A., Holtzman, A., & Zettlemoyer, L.** (2023). "QLoRA: Efficient Finetuning of Quantized Language Models." *NeurIPS 2023*.
    - 4-bit quantized base model + FP16 LoRA adapters; fine-tune 65B models on a single 48 GB GPU.

11. **Sheng, Y., Zheng, L., Yuan, B., Li, Z., Ryabinin, M., Chen, B., Liang, P., Re, C., Stoica, I., & Zhang, C.** (2023). "S-LoRA: Serving Thousands of Concurrent LoRA Adapters." arXiv:2311.03285.
    - Batched multi-adapter serving with unified memory management.

---

## Exercises

### Theory

**Exercise 6d.1.** For a depthwise separable convolution with $C_{\text{in}} = C_{\text{out}} = C$, kernel size $k$, and spatial dimensions $H \times W$:
- (a) Derive the exact FLOPs and parameter count.
- (b) At what value of $C$ does the FLOPs savings ratio equal exactly 10x compared to standard convolution?
- (c) Derive the arithmetic intensity (FLOPs / bytes loaded) for both standard and depthwise separable convolutions, assuming FP16 weights. Which is more compute-bound?

**Exercise 6d.2.** In DARTS, the architecture parameters $\alpha$ are updated using $\nabla_\alpha \mathcal{L}_{\text{val}}(w - \eta \nabla_w \mathcal{L}_{\text{train}}, \alpha)$. Derive the full expression for this gradient using the chain rule. Show that the first-order approximation (ignoring the dependence of $w^*$ on $\alpha$) reduces to simply $\nabla_\alpha \mathcal{L}_{\text{val}}(w, \alpha)$.

**Exercise 6d.3.** EfficientNet's compound scaling requires $\alpha \cdot \beta^2 \cdot \gamma^2 \approx 2$. Derive this constraint from the requirement that doubling $\phi$ should approximately double the FLOPs. What assumption about the model's FLOPs decomposition does this require?

### Implementation

**Exercise 6d.4.** Implement a simplified DARTS cell with 4 intermediate nodes and operations $\{$conv 3x3, conv 5x5, max pool 3x3, skip, zero$\}$. Train on CIFAR-10 with architecture search. Report the discovered cell architecture and its test accuracy. Compare with a manually designed ResNet cell of similar FLOPs.

**Exercise 6d.5.** Profile the latency of MobileNetV2 and ResNet-50 on CPU and GPU at batch sizes 1, 8, and 64. Compute the FLOPs ratio and compare with the measured latency ratio. At which batch size is the FLOPs ratio most predictive of the latency ratio?

---

*Next: Recitation 06 --- Quantizing an LLM to 4-bit*
