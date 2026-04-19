# Lecture 04b: Model Parallelism -- Tensor, Pipeline, and Sequence Parallelism

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Derive** the memory requirements for training a Transformer model and identify which components dominate, justifying when model parallelism is necessary beyond data parallelism.
2. **Analyze** Megatron-style tensor parallelism for column-parallel and row-parallel linear layers, proving correctness of the forward and backward passes and computing the communication overhead per Transformer layer.
3. **Compare** pipeline parallelism schedules (GPipe, 1F1B, interleaved 1F1B) by deriving their bubble ratios and memory footprints as functions of the number of pipeline stages and micro-batches.
4. **Formulate** sequence parallelism as a partitioning of the sequence dimension and analyze its interaction with tensor parallelism, deriving the communication pattern for LayerNorm and dropout.
5. **Design** a hybrid parallelism strategy (combining data, tensor, pipeline, and sequence parallelism) for a given model size, cluster topology, and memory budget.

---

## 2. Motivation and Context

### 2.1 When Data Parallelism Is Not Enough

Data parallelism requires each worker to hold a complete copy of the model. For large models, this is infeasible:

| Model | Parameters | Memory per replica (BF16 training) |
|---|---|---|
| GPT-2 (1.5B) | 1.5B | ~30 GB |
| GPT-3 (175B) | 175B | ~3.5 TB |
| PaLM (540B) | 540B | ~10.8 TB |
| Llama 3.1 (405B) | 405B | ~8.1 TB |

Even a single A100 (80 GB) cannot hold GPT-3's training state. We must partition the model itself across devices.

### 2.2 Taxonomy of Model Parallelism

Model parallelism splits the model across devices along different dimensions:

- **Tensor parallelism (TP)**: splits individual operators (weight matrices) across devices.
- **Pipeline parallelism (PP)**: splits the model into sequential stages, each on a different device.
- **Sequence parallelism (SP)**: splits activations along the sequence dimension.

These are complementary and are routinely combined in large-scale training (e.g., Megatron-LM uses all three plus data parallelism).

### 2.3 Memory Breakdown for Training

For a model with $P$ parameters trained with Adam in mixed precision (BF16 forward/backward, FP32 optimizer states):

| Component | Memory (bytes) |
|---|---|
| Parameters (BF16) | $2P$ |
| Gradients (BF16) | $2P$ |
| FP32 master weights | $4P$ |
| Adam first moment $m$ (FP32) | $4P$ |
| Adam second moment $v$ (FP32) | $4P$ |
| **Total (excluding activations)** | **$16P$** |

For GPT-3 (175B): $16 \times 175 \times 10^9 = 2.8$ TB. Activations add further memory proportional to batch size, sequence length, and model width.

---

## 3. Tensor Parallelism

### 3.1 Core Idea

Split weight matrices across devices so that each device performs a fraction of each matrix multiplication. The key challenge is minimizing the communication needed to combine partial results.

### 3.2 Column-Parallel Linear Layer

Consider a linear layer $Y = XA$ where $X \in \mathbb{R}^{b \times k}$ and $A \in \mathbb{R}^{k \times n}$. Partition $A$ column-wise across $T$ devices:

$$A = [A_1 \mid A_2 \mid \cdots \mid A_T]$$

where $A_i \in \mathbb{R}^{k \times n/T}$. Each device $i$ holds $A_i$ and computes:

$$Y_i = X A_i \in \mathbb{R}^{b \times n/T}$$

**Key property:** Column-parallel splitting requires that *every device has a full copy of the input $X$*, but produces a partial output $Y_i$ (a slice of the full output $Y = [Y_1 \mid \cdots \mid Y_T]$).

**No communication needed in the forward pass** if the input $X$ is replicated across devices. Each device independently produces its slice of the output.

### 3.3 Row-Parallel Linear Layer

Now consider $Y = XA$ with $A$ partitioned row-wise:

$$A = \begin{bmatrix} A_1 \\ A_2 \\ \vdots \\ A_T \end{bmatrix}, \quad X = [X_1 \mid X_2 \mid \cdots \mid X_T]$$

where $A_i \in \mathbb{R}^{k/T \times n}$ and $X_i \in \mathbb{R}^{b \times k/T}$. Device $i$ computes:

$$\tilde{Y}_i = X_i A_i \in \mathbb{R}^{b \times n}$$

The full output is the sum of partial results:

$$Y = \sum_{i=1}^{T} \tilde{Y}_i = \sum_{i=1}^{T} X_i A_i$$

**Communication required:** An AllReduce to sum $\tilde{Y}_i$ across devices. Communication volume: $b \times n \times \text{sizeof(dtype)}$ per forward pass.

### 3.4 Megatron-Style Transformer Parallelism

**Shoeybi et al. (2020)** introduced an elegant partitioning of the Transformer layer that minimizes communication to exactly two AllReduce operations per layer (one in the attention block, one in the FFN block).

**MLP Block.** A Transformer FFN has two linear layers with a GeLU activation:

$$Y = \text{GeLU}(X A) B + X \quad \text{(with residual connection)}$$

Megatron splits $A$ column-wise and $B$ row-wise:

$$A = [A_1 \mid A_2 \mid \cdots \mid A_T], \quad B = \begin{bmatrix} B_1 \\ B_2 \\ \vdots \\ B_T \end{bmatrix}$$

**Forward pass on device $i$:**
1. Compute $Z_i = \text{GeLU}(X A_i)$ -- no communication needed (GeLU is element-wise).
2. Compute $\tilde{Y}_i = Z_i B_i$ -- partial result.
3. **AllReduce**: $Y = \sum_i \tilde{Y}_i$ -- this produces the full FFN output on all devices.

**Why this works:** GeLU is applied element-wise, so splitting $A$ column-wise and applying GeLU to each slice independently gives the correct result:

$$\text{GeLU}(XA) = [\text{GeLU}(XA_1) \mid \text{GeLU}(XA_2) \mid \cdots \mid \text{GeLU}(XA_T)]$$

This output is already partitioned along the hidden dimension, which is exactly the row-partitioning that $B$ expects.

**Self-Attention Block.** For multi-head attention with $h$ heads, assign $h/T$ heads to each device. Each device computes full attention for its assigned heads:

1. Compute $Q_i, K_i, V_i$ using column-parallel projections (each of size $d_{\text{model}} \times d_{\text{model}}/T$).
2. Compute attention output $O_i$ for heads on device $i$.
3. Apply row-parallel output projection $W_O^{(i)}$.
4. **AllReduce** to sum partial output projections.

**Theorem 3.1 (Megatron Communication Cost per Layer).** Each Transformer layer with Megatron-style tensor parallelism requires exactly 2 AllReduce operations in the forward pass and 2 in the backward pass. For a model with $L$ layers, sequence length $s$, batch size $b$, and model dimension $d$, the total communication volume per forward+backward pass is:

$$V_{\text{TP}} = 4L \cdot 2 \cdot \frac{T-1}{T} \cdot bsd \cdot \text{sizeof(dtype)}$$

The factor of 4 accounts for 2 AllReduces per layer (forward) $\times$ 2 (forward + backward). Each AllReduce communicates a tensor of shape $(b, s, d)$.

### 3.5 Correctness of Backward Pass

Consider the column-parallel forward: $Y_i = X A_i$. In the backward pass, given $\frac{\partial \mathcal{L}}{\partial Y} = [\frac{\partial \mathcal{L}}{\partial Y_1} \mid \cdots \mid \frac{\partial \mathcal{L}}{\partial Y_T}]$:

- $\frac{\partial \mathcal{L}}{\partial A_i} = X^\top \frac{\partial \mathcal{L}}{\partial Y_i}$ -- local, no communication.
- $\frac{\partial \mathcal{L}}{\partial X} = \sum_i \frac{\partial \mathcal{L}}{\partial Y_i} A_i^\top$ -- requires **AllReduce** across devices.

For row-parallel forward: $Y = \sum_i X_i A_i$, given $\frac{\partial \mathcal{L}}{\partial Y}$:

- $\frac{\partial \mathcal{L}}{\partial A_i} = X_i^\top \frac{\partial \mathcal{L}}{\partial Y}$ -- local (each device has $X_i$ and full $\frac{\partial \mathcal{L}}{\partial Y}$ from the forward AllReduce).
- $\frac{\partial \mathcal{L}}{\partial X_i} = \frac{\partial \mathcal{L}}{\partial Y} A_i^\top$ -- local (each device has $A_i$).

**Key insight:** By pairing column-parallel with row-parallel, Megatron arranges the communication so that:
- Forward: 1 AllReduce (after the row-parallel layer)
- Backward: 1 AllReduce (after the column-parallel layer's gradient w.r.t. input)

The conjugate $f$ and $\bar{f}$ operators implement this: $f$ is an identity in forward and AllReduce in backward; $\bar{f}$ is an AllReduce in forward and identity in backward.

```python
class _CopyToModelParallelRegion(torch.autograd.Function):
    """f: Identity in forward, AllReduce in backward."""
    @staticmethod
    def forward(ctx, input_):
        return input_

    @staticmethod
    def backward(ctx, grad_output):
        return _reduce(grad_output)  # AllReduce

class _ReduceFromModelParallelRegion(torch.autograd.Function):
    """f_bar: AllReduce in forward, Identity in backward."""
    @staticmethod
    def forward(ctx, input_):
        return _reduce(input_)  # AllReduce

    @staticmethod
    def backward(ctx, grad_output):
        return grad_output

class ColumnParallelLinear(nn.Module):
    def __init__(self, in_features, out_features, tp_size):
        super().__init__()
        self.local_out = out_features // tp_size
        self.weight = nn.Parameter(torch.empty(self.local_out, in_features))

    def forward(self, x):
        # x is replicated on all TP ranks -> copy_to_mp ensures
        # backward does AllReduce on dL/dx
        x = _CopyToModelParallelRegion.apply(x)
        return F.linear(x, self.weight)

class RowParallelLinear(nn.Module):
    def __init__(self, in_features, out_features, tp_size):
        super().__init__()
        self.local_in = in_features // tp_size
        self.weight = nn.Parameter(torch.empty(out_features, self.local_in))

    def forward(self, x):
        # x is already partitioned (output of column-parallel + activation)
        out = F.linear(x, self.weight)
        # AllReduce to combine partial sums across TP ranks
        out = _ReduceFromModelParallelRegion.apply(out)
        return out
```

---

## 4. Pipeline Parallelism

### 4.1 Problem Setup

Partition a model of $L$ layers into $P$ stages, where stage $p$ contains layers $L_{s_p}, \ldots, L_{s_{p+1}-1}$ and resides on device $p$. A mini-batch of $B$ samples is divided into $M$ micro-batches of size $B/M$.

**The pipeline bubble problem.** In a naive implementation, devices are idle while waiting for inputs from preceding stages. The bubble (idle time) is the fundamental challenge of pipeline parallelism.

### 4.2 GPipe: Micro-Batching

**Huang et al. (2019).** GPipe processes all $M$ micro-batches in the forward direction, then all $M$ micro-batches in the backward direction.

**Schedule** (for $P = 4$ stages, $M = 4$ micro-batches):

```
Time  ->
Stage 0: [F0][F1][F2][F3]                  [B3][B2][B1][B0]
Stage 1:     [F0][F1][F2][F3]          [B3][B2][B1][B0]
Stage 2:         [F0][F1][F2][F3]  [B3][B2][B1][B0]
Stage 3:             [F0][F1][F2][F3][B3][B2][B1][B0]

F_i = forward pass of micro-batch i
B_i = backward pass of micro-batch i
```

**Theorem 4.1 (GPipe Bubble Ratio).** With $P$ stages and $M$ micro-batches, each forward or backward pass taking time $t_f \approx t_b \approx t$, the bubble fraction is:

$$\text{bubble}_{\text{GPipe}} = \frac{(P-1) \cdot 2t}{M \cdot 2t + (P-1) \cdot 2t} = \frac{P-1}{M + P - 1}$$

*Proof.* Total useful work: $M$ micro-batches $\times$ 2 passes (forward + backward) $\times$ $t$ per pass = $2Mt$. The pipeline startup takes $(P-1)t$ (forward warmup) and the pipeline drain takes $(P-1)t$ (backward drain), for a total bubble of $2(P-1)t$. The total time is $2Mt + 2(P-1)t$. The bubble fraction is $2(P-1)t / (2Mt + 2(P-1)t) = (P-1)/(M + P-1)$. $\blacksquare$

**Corollary 4.1.** To keep the bubble below $\epsilon$, we need $M \geq P(1/\epsilon - 1) + 1$. For $P = 64$ and $\epsilon = 5\%$, $M \geq 1217$.

**GPipe memory issue.** GPipe must store all $M$ micro-batches' activations simultaneously (for the backward pass), requiring $O(M)$ activation memory per stage. Gradient accumulation across micro-batches reduces parameter memory but activation memory remains high.

### 4.3 1F1B Schedule (PipeDream-Flush)

**Narayanan et al. (2021).** Instead of running all forward passes then all backward passes, interleave them: once the pipeline is warmed up, each stage alternates between forward and backward passes.

**Schedule** (for $P = 4$ stages, $M = 8$ micro-batches):

```
Time  ->
Stage 0: [F0][F1][F2][F3][B0][F4][B1][F5][B2][F6][B3][F7]    [B4][B5][B6][B7]
Stage 1:     [F0][F1][F2]    [B0][F3][B1][F4][B2][F5][B3][F6][B4][F7][B5][B6][B7]
Stage 2:         [F0][F1]        [B0][F2][B1][F3][B2][F4][B3][F5][B4][F6][B5][F7]...
Stage 3:             [F0]            [B0][F1][B1][F2][B2][F3][B3][F4][B4][F5]...
```

**Theorem 4.2 (1F1B Bubble Ratio).** The 1F1B schedule has the same bubble fraction as GPipe:

$$\text{bubble}_{\text{1F1B}} = \frac{P-1}{M + P - 1}$$

The advantage is in **memory**: the maximum number of in-flight micro-batches at any stage is $P$ (during the warmup phase), rather than $M$. So activation memory is $O(P)$ instead of $O(M)$.

*Proof of memory bound.* During steady state, each stage has at most $P$ micro-batches in flight (those that have completed their forward pass on this stage but not yet their backward pass). The warmup phase fills the pipeline with $P-1$ forward passes at the first stage before any backward pass begins. At steady state, each completed backward pass frees one micro-batch's activations before a new forward pass creates another. $\blacksquare$

### 4.4 Interleaved 1F1B Schedule

**Narayanan et al. (2021).** Assign multiple non-contiguous stages to each device. Instead of device $p$ holding layers $\{L_{pL/P}, \ldots, L_{(p+1)L/P - 1}\}$, device $p$ holds layers $\{L_p, L_{p+P}, L_{p+2P}, \ldots\}$ (every $P$-th chunk of layers).

With $v$ virtual stages per device (so $v \cdot P$ total stages), the bubble ratio becomes:

$$\text{bubble}_{\text{interleaved}} = \frac{P-1}{v \cdot M + P - 1}$$

**Trade-off.** The interleaved schedule reduces the bubble by a factor of $v$, but increases communication volume by a factor of $v$ (since activations must be sent between non-adjacent devices more frequently) and adds pipeline communication over the network rather than within a single node.

### 4.5 Pipeline Bubble Analysis: A Complete Treatment

**Definition 4.1 (Pipeline Efficiency).** The pipeline efficiency is defined as:

$$\eta_{\text{pipe}} = 1 - \text{bubble fraction} = \frac{M}{M + P - 1}$$

**Theorem 4.3 (Lower Bound on Pipeline Bubble).** For any pipeline parallelism schedule that maintains sequential semantics (each micro-batch must pass through stages in order), the bubble fraction is at least:

$$\text{bubble} \geq \frac{P-1}{M + P - 1}$$

*Proof sketch.* The critical path through the pipeline for any micro-batch requires $P$ sequential forward passes and $P$ sequential backward passes (or $2P$ passes total). With $M$ micro-batches, the total available time slots across all stages is $P \times T_{\text{total}}$. The useful work is $2PM$ time slots. The pipeline startup requires at least $P-1$ time slots of idle time on the last stage (it must wait for the first micro-batch to arrive). By a symmetric argument, pipeline drain adds another $P-1$ idle slots. The minimum total time is thus $2M + 2(P-1)$ per stage, giving the stated bound. $\blacksquare$

### 4.6 Load Balancing Across Stages

In practice, stages may have different computation costs due to:
- The embedding layer (first stage) and output layer (last stage) having different costs than hidden layers.
- Attention layers and FFN layers having different FLOP counts.
- Activation recomputation being applied selectively.

If stage $p$ takes time $t_p$, the pipeline throughput is limited by the slowest stage:

$$\text{Throughput} \propto \frac{1}{\max_p t_p}$$

The load imbalance factor is:

$$\text{imbalance} = \frac{\max_p t_p}{\frac{1}{P}\sum_p t_p}$$

Ideal balance has imbalance $= 1$. Megatron-LM addresses this by profiling layer times and assigning unequal numbers of layers to stages.

---

## 5. Sequence Parallelism

### 5.1 Motivation

In tensor parallelism, the LayerNorm and dropout operations are applied to the full hidden dimension, which is replicated across all TP ranks. This means these operations are redundantly computed on all devices, and their activations are not distributed -- they consume full memory on each device.

### 5.2 The Insight

**Korthikanti et al. (2023).** Operations like LayerNorm and dropout do not involve the weight matrices and operate independently along the sequence dimension. We can partition the activations along the sequence dimension for these operations and only gather them when entering the column-parallel linear layers.

### 5.3 Communication Pattern

The modified communication pattern for a Transformer layer with both TP and SP:

1. **LayerNorm**: Each device holds a slice of shape $(b, s/T, d)$. LayerNorm operates independently per token, so no communication is needed.

2. **Before column-parallel linear**: **AllGather** along the sequence dimension to reconstruct the full $(b, s, d)$ tensor, since the column-parallel linear layer needs the full sequence.

3. **Column-parallel linear + GeLU + Row-parallel linear**: Standard Megatron TP.

4. **After row-parallel linear**: Instead of an AllReduce (which produces the full $(b, s, d)$ result on all devices), use a **ReduceScatter** to produce a sequence-partitioned $(b, s/T, d)$ result.

5. **Residual connection + Dropout + LayerNorm**: Operate on the sequence-partitioned $(b, s/T, d)$ tensor.

**Theorem 5.1 (SP Communication Equivalence).** Replacing AllReduce with ReduceScatter + AllGather does not change the total communication volume:

$$V_{\text{AllReduce}} = 2 \frac{T-1}{T} \cdot bsd$$
$$V_{\text{ReduceScatter}} + V_{\text{AllGather}} = \frac{T-1}{T} \cdot bsd + \frac{T-1}{T} \cdot bsd = 2 \frac{T-1}{T} \cdot bsd$$

The communication cost is identical, but sequence parallelism reduces activation memory by a factor of $T$ for LayerNorm, dropout, and residual connection activations.

### 5.4 Memory Savings

For a Transformer layer with sequence parallelism, the activations that were previously replicated across all $T$ devices (LayerNorm inputs/outputs, dropout masks, residual tensors) are now partitioned. The memory savings per device are:

$$\Delta \text{Memory} = \left(1 - \frac{1}{T}\right) \cdot \text{Memory}_{\text{replicated-activations}}$$

For a typical Transformer layer, replicated activations account for approximately $10bsd$ bytes (in BF16), so SP saves roughly $10bsd(1 - 1/T)$ bytes per layer per device.

---

## 6. Combining Parallelism Strategies

### 6.1 The 3D Parallelism Framework

For training a model with $P$ parameters on a cluster of $G$ GPUs, the standard approach (Megatron-LM, DeepSpeed) uses:

$$G = N_{\text{DP}} \times N_{\text{TP}} \times N_{\text{PP}}$$

where:
- $N_{\text{TP}}$: tensor parallelism degree (typically 2-8, limited by intra-node bandwidth)
- $N_{\text{PP}}$: pipeline parallelism degree (limited by number of layers, bubble fraction)
- $N_{\text{DP}}$: data parallelism degree ($G / (N_{\text{TP}} \times N_{\text{PP}})$)

### 6.2 Placement Rules

**Rule 1:** TP should be within a single node (NVLink), because it requires frequent AllReduce with low latency.

**Rule 2:** PP can span nodes, since it only requires point-to-point communication of activations (one tensor per micro-batch per stage boundary).

**Rule 3:** DP can span the entire cluster, since AllReduce is bandwidth-optimal and tolerates higher latency.

### 6.3 Worked Example: Training a 175B Model

**Setup:** 512 A100 GPUs (64 nodes, 8 GPUs/node), NVLink within node, InfiniBand between nodes.

**Parallelism configuration:**
- $N_{\text{TP}} = 8$ (one node per TP group)
- $N_{\text{PP}} = 8$ (8 pipeline stages across 8 nodes)
- $N_{\text{DP}} = 512 / (8 \times 8) = 8$ (8 data-parallel replicas)

**Memory per GPU:**
- Parameters: $175 \times 10^9 / (8 \times 8) = 2.73 \times 10^9$ params per GPU (TP splits within each stage, PP splits stages). Memory: $2.73 \times 10^9 \times 2 \approx 5.5$ GB (BF16).
- Optimizer states: $2.73 \times 10^9 \times 12 \approx 32.8$ GB (Adam FP32 states).
- Activations: depends on micro-batch size and activation checkpointing.

**Communication:**
- TP: 2 AllReduce per layer (forward) $\times$ 2 (backward), within NVLink (fast)
- PP: 1 send/recv per micro-batch per stage boundary, over InfiniBand
- DP: 1 AllReduce of $2.73 \times 10^9 \times 2 = 5.5$ GB gradients, over InfiniBand

---

## Key Takeaways

1. Model parallelism is necessary when a model's training state exceeds single-device memory. The three axes -- tensor, pipeline, and sequence parallelism -- address complementary dimensions of the computation.

2. Megatron-style tensor parallelism achieves exactly 2 AllReduce operations per Transformer layer by pairing column-parallel and row-parallel linear layers with conjugate $f/\bar{f}$ operators.

3. Pipeline parallelism introduces bubbles with a fundamental lower bound of $(P-1)/(M+P-1)$. The 1F1B schedule matches this bound while reducing activation memory from $O(M)$ to $O(P)$. Interleaved schedules reduce bubbles by a factor of $v$ at the cost of $v\times$ more communication.

4. Sequence parallelism partitions activations along the sequence dimension for non-tensor-parallel operations, reducing per-device activation memory by up to $T\times$ with no additional communication cost.

5. In practice, TP is confined within a node (NVLink), PP spans nodes, and DP spans the cluster. The configuration $G = N_{\text{DP}} \times N_{\text{TP}} \times N_{\text{PP}}$ must be tuned to the model size, cluster topology, and memory constraints.

---

## Further Reading

1. **Shoeybi, M., Patwary, M., Puri, R., LeGresley, P., Casper, J., & Catanzaro, B.** (2020). *Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism.* arXiv:1909.08053.
   - The foundational paper on tensor parallelism for Transformers.

2. **Huang, Y., Cheng, Y., Bapna, A., Firat, O., Chen, D., Chen, M., Lee, H., Ngiam, J., Le, Q. V., Wu, Y., & Chen, Z.** (2019). *GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism.* NeurIPS 2019.
   - Micro-batching for pipeline parallelism with gradient accumulation.

3. **Narayanan, D., Shoeybi, M., Casper, J., LeGresley, P., Patwary, M., Korthikanti, V., Vainbrand, D., Kasber, P., Andrejczuk, E., Bernauer, J., Catanzaro, B., Subramanian, A., & Matsuoka, K.** (2021). *Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM.* SC 2021.
   - 3D parallelism, interleaved pipeline schedule, and practical scaling results.

4. **Korthikanti, V., Casper, J., Lym, S., McAfee, L., Andersch, M., Shoeybi, M., & Catanzaro, B.** (2023). *Reducing Activation Recomputation in Large Transformer Models.* MLSys 2023.
   - Sequence parallelism and selective activation recomputation.

5. **Qi, H., Sparber, M., & Berger, D.** (2023). *Zero Bubble Pipeline Parallelism.* ICLR 2024.
   - Novel schedule that achieves near-zero pipeline bubble by overlapping forward, backward-input-grad, and backward-weight-grad.

6. **Fan, S., Rong, Y., Meng, C., Cao, Z., Wang, S., Zheng, Z., Wu, C., Long, G., Yang, J., Xia, L., et al.** (2021). *DAPPLE: A Pipelined Data Parallel Approach for Training Large Models.* PPoPP 2021.
   - Co-optimizing data and pipeline parallelism placement and scheduling.
