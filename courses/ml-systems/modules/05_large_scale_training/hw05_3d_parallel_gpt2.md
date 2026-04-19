# Homework 05: Train GPT-2 with 3D Parallelism

**Estimated time:** 20 hours
**Due date:** Two weeks from assignment
**Submission:** Code repository (GitHub link) + PDF report (max 10 pages)

---

## Overview

This homework has two parts of equal weight. Part A tests your analytical understanding of mixed precision, memory budgeting, gradient checkpointing, and parallelism configuration. Part B requires you to implement a GPT-2 training pipeline with tensor parallelism, pipeline parallelism, and data parallelism, then measure scaling efficiency on a multi-GPU cluster.

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. You may reference Megatron-LM and DeepSpeed source code for understanding, but your implementation must be original. Cite any references you consult.

**Compute resources:** This homework requires access to at least 8 GPUs (2 nodes with 4 GPUs each, or 1 node with 8 GPUs). Use the class cluster or request cloud credits from the course staff.

---

## Part A: Analytical Problems (50%)

### Problem A1: Mixed-Precision Memory Budget (15 points)

You are training a GPT-2 XL model (1.5B parameters, 48 layers, $d = 1600$, $h = 25$, $d_{\text{ff}} = 6400$) with the Adam optimizer.

**(a)** [5 points] Compute the exact memory required for the following components under standard BF16 mixed-precision training (BF16 compute, FP32 master weights and optimizer states):

1. BF16 model parameters (weights only)
2. BF16 gradients
3. FP32 master weights
4. FP32 Adam first moment ($m$)
5. FP32 Adam second moment ($v$)

Express each in GB and compute the total. How does this compare to a single A100-80GB GPU?

**(b)** [5 points] Now compute the activation memory for a single transformer layer during a forward pass, with batch size $B = 4$ and sequence length $s = 1024$, in BF16. Account for the following stored activations:

- Input to QKV projection
- Q, K, V tensors
- Attention scores (pre-softmax)
- Attention probabilities (post-softmax)
- Attention dropout mask (stored as bytes)
- Attention output
- MLP up-projection output
- GeLU input (stored for backward)
- MLP dropout mask (stored as bytes)

Sum these to get per-layer activation memory, then multiply by 48 layers for total activation memory.

**(c)** [5 points] Suppose you enable gradient checkpointing with $k = 7$ checkpoint segments (each containing $\lceil 48/7 \rceil = 7$ layers). What is the new peak activation memory? How much memory is saved compared to no checkpointing? What is the theoretical compute overhead (as a percentage of the forward pass)?

---

### Problem A2: Loss Scaling Analysis (10 points)

**(a)** [5 points] Consider a gradient value $g = 3.7 \times 10^{-6}$ that needs to be represented in FP16.

1. What is the nearest representable FP16 value? (Show the binary representation.)
2. What is the relative quantization error?
3. If we apply a loss scale of $S = 2^{12} = 4096$, what is the scaled gradient $S \cdot g$? What is the nearest FP16 value? What is the relative error after unscaling?
4. Compare the two relative errors and explain why loss scaling improves gradient fidelity.

**(b)** [5 points] In dynamic loss scaling, the scale factor is halved whenever an `inf` or `nan` gradient is detected, and doubled every $k$ consecutive successful steps.

Model this as a Markov chain. Let the state be $\log_2(S)$. Assume that the probability of overflow at scale $S$ is $p(S) = \min(1, S / S_{\max})$ where $S_{\max}$ is the scale at which overflow is guaranteed. In steady state, what is the expected value of $S$? Under what conditions does the scale oscillate rather than converge?

---

### Problem A3: Parallelism Configuration (15 points)

You have a cluster of 64 A100-80GB GPUs arranged as 8 nodes with 8 GPUs each (connected by NVLink within a node, InfiniBand between nodes). You want to train a 13B parameter model (40 layers, $d = 5120$, $h = 40$, $d_{\text{ff}} = 13824$) with a global batch size of 512 sequences of length 2048.

**(a)** [5 points] Consider three parallelism configurations:

| Config | TP | PP | DP |
|--------|----|----|-----|
| A | 1 | 1 | 64 |
| B | 8 | 1 | 8 |
| C | 4 | 4 | 4 |

For each configuration, compute:
1. Per-GPU parameter memory (assuming ZeRO-1 for data parallel, which shards optimizer states across DP ranks).
2. Per-GPU activation memory (with gradient checkpointing at every layer).
3. Total per-GPU memory (parameters + optimizer + activations + estimated 5 GB overhead).
4. Does it fit in 80 GB?

**(b)** [5 points] For each configuration, analyze the communication:

1. **Config A:** What is the AllReduce volume per step for gradient synchronization? At 400 Gb/s inter-node bandwidth per GPU, how long does this take (using the ring AllReduce formula)?
2. **Config B:** How many AllReduce operations per transformer block for tensor parallelism? What is the volume per AllReduce? At 900 GB/s NVLink bandwidth, how long does this take?
3. **Config C:** Compute both the TP communication (within-node) and PP communication (between-node). With 16 micro-batches, what is the pipeline bubble fraction?

**(c)** [5 points] Based on your analysis in (a) and (b), which configuration would you recommend and why? Consider:
- Memory feasibility
- Communication overhead
- Implementation complexity
- Effective batch size per GPU (affects convergence)

Provide a quantitative throughput estimate (tokens/second) for your recommended configuration, assuming 50% MFU.

---

### Problem A4: Checkpointing Frequency Optimization (10 points)

A training run on 1024 GPUs has the following characteristics:
- Step time: 2.5 seconds
- Checkpoint save time (synchronous): 90 seconds
- Failure rate: 1 failure per 8 hours of training (measured empirically)
- Recovery time after failure (load checkpoint + reinitialize): 5 minutes

**(a)** [5 points] Derive the optimal checkpoint interval $T^*$ that minimizes the total training wall-clock time including checkpoint overhead and expected lost work from failures. Your derivation should account for:
- Time spent checkpointing
- Expected lost work between the last checkpoint and a failure
- Recovery time after each failure

**(b)** [5 points] Compute $T^*$ for the given parameters. How many training steps occur between checkpoints? If the team switches to asynchronous checkpointing (checkpoint save time reduced to 10 seconds of blocking time, with the remaining 80 seconds overlapped with training), how does $T^*$ change? How much total training time is saved over a 30-day run?

---

## Part B: Implementation (50%)

### Overview

Implement a GPT-2 (124M parameter) training pipeline with 3D parallelism. You will implement tensor parallelism and pipeline parallelism from scratch (building on PyTorch's distributed primitives), and use PyTorch DDP or ZeRO for data parallelism.

**Model specification:**
- GPT-2 Small: 12 layers, $d = 768$, $h = 12$, $d_{\text{ff}} = 3072$, vocab size 50257
- BF16 mixed-precision training
- Adam optimizer with $\beta_1 = 0.9$, $\beta_2 = 0.95$, weight decay 0.1, learning rate $6 \times 10^{-4}$

### Task B1: Tensor-Parallel Linear Layers (15 points)

Implement `ColumnParallelLinear` and `RowParallelLinear` as described in the Megatron-LM paper.

```python
class ColumnParallelLinear(nn.Module):
    """Linear layer with column-parallel weight partitioning.

    In PyTorch, the weight matrix W has shape (out_features, in_features).
    "Column-parallel" refers to partitioning along the output dimension
    (columns of the weight matrix in the mathematical convention Y = XW^T).
    Each rank stores a shard W_i of shape (out_features // tp, in_features),
    i.e., a contiguous block of output rows of the PyTorch weight tensor.

    Mathematically, the full weight is partitioned as:
        W = [W_0; W_1; ...; W_{tp-1}]   (vertical stack)
    so that each rank computes a slice of the output features.

    Forward: Y_i = X @ W_i^T + b_i   (no communication needed)
    """
    def __init__(self, in_features: int, out_features: int,
                 tp_group: dist.ProcessGroup, bias: bool = True,
                 gather_output: bool = True):
        super().__init__()
        self.tp_size = dist.get_world_size(tp_group)
        self.tp_group = tp_group
        self.gather_output = gather_output
        assert out_features % self.tp_size == 0

        self.out_features_per_rank = out_features // self.tp_size
        self.weight = nn.Parameter(
            torch.empty(self.out_features_per_rank, in_features)
        )
        if bias:
            self.bias = nn.Parameter(
                torch.empty(self.out_features_per_rank)
            )
        else:
            self.bias = None
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.kaiming_uniform_(self.weight, a=5**0.5)
        if self.bias is not None:
            nn.init.zeros_(self.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # TODO: Implement forward pass
        # 1. Compute local output: y_local = x @ self.weight^T + self.bias
        # 2. If gather_output, AllGather results across TP group
        # 3. Handle backward: gradient of x needs AllReduce across TP group
        raise NotImplementedError


class RowParallelLinear(nn.Module):
    """Linear layer with row-parallel weight partitioning.

    The weight matrix W (out_features x in_features) is partitioned
    row-wise across the tensor-parallel group:
        W = [W_0; W_1; ...; W_{tp-1}]
    Each rank stores W_i of shape (out_features, in_features / tp).

    Forward: Y = sum_i(X_i @ W_i^T) = AllReduce(X_local @ W_local^T)
    """
    def __init__(self, in_features: int, out_features: int,
                 tp_group: dist.ProcessGroup, bias: bool = True,
                 input_is_parallel: bool = True):
        super().__init__()
        self.tp_size = dist.get_world_size(tp_group)
        self.tp_group = tp_group
        self.input_is_parallel = input_is_parallel
        assert in_features % self.tp_size == 0

        self.in_features_per_rank = in_features // self.tp_size
        self.weight = nn.Parameter(
            torch.empty(out_features, self.in_features_per_rank)
        )
        if bias:
            self.bias = nn.Parameter(torch.empty(out_features))
        else:
            self.bias = None
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.kaiming_uniform_(self.weight, a=5**0.5)
        if self.bias is not None:
            nn.init.zeros_(self.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # TODO: Implement forward pass
        # 1. If not input_is_parallel, scatter input across TP group
        # 2. Compute local output: y_local = x_local @ self.weight^T
        # 3. AllReduce y_local across TP group
        # 4. Add bias (only on one rank, or after allreduce)
        raise NotImplementedError
```

**Requirements:**
- Implement custom `torch.autograd.Function` for the communication operations to ensure correct gradient flow.
- Write a gradient correctness test comparing your TP linear layers against a non-parallel baseline.
- Measure the overhead of the AllReduce communication.

### Task B2: Pipeline-Parallel GPT-2 (15 points)

Implement a simple GPipe-style pipeline parallel schedule.

```python
class PipelineStage(nn.Module):
    """One stage of the pipeline, containing a subset of transformer layers."""
    def __init__(self, layers: nn.ModuleList, stage_id: int,
                 num_stages: int, pp_group: dist.ProcessGroup):
        super().__init__()
        self.layers = layers
        self.stage_id = stage_id
        self.num_stages = num_stages
        self.pp_group = pp_group

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        for layer in self.layers:
            x = layer(x)
        return x


def gpipe_schedule(stage: PipelineStage, micro_batches: list,
                   loss_fn, pp_group: dist.ProcessGroup):
    """
    Execute GPipe pipeline schedule.

    Args:
        stage: This GPU's pipeline stage.
        micro_batches: List of micro-batch inputs (only used by stage 0).
        loss_fn: Loss function (only used by last stage).
        pp_group: Pipeline parallel process group.

    Returns:
        Total loss (on last stage), None on other stages.

    TODO: Implement the following:
    1. Forward all micro-batches through this stage.
       - Stage 0: process micro_batches directly.
       - Other stages: receive activations from previous stage via P2P.
       - Last stage: compute loss.
       - All stages: store activations for backward.
    2. Backward all micro-batches in reverse order.
       - Last stage: compute loss gradient.
       - Other stages: receive gradients from next stage.
       - Send gradients to previous stage.
    3. Return accumulated loss.
    """
    raise NotImplementedError
```

**Requirements:**
- Implement point-to-point communication (`dist.send`, `dist.recv`) between adjacent stages.
- Handle the case where the first stage receives input data and the last stage computes loss.
- Store intermediate activations for the backward pass.
- Verify gradient correctness by comparing against a non-pipelined baseline on a small model.
- Measure the pipeline bubble overhead for different numbers of micro-batches.

### Task B3: Putting It Together — 3D Parallel Training (10 points)

Combine your tensor-parallel layers (B1) and pipeline schedule (B2) with PyTorch DDP for data parallelism to create a complete 3D parallel training pipeline.

```python
def train_3d_parallel(config):
    """
    Train GPT-2 with 3D parallelism.

    Process group layout (example: 8 GPUs, TP=2, PP=2, DP=2):
        TP groups: {0,1}, {2,3}, {4,5}, {6,7}
        PP groups: {0,2}, {1,3}, {4,6}, {5,7}
        DP groups: {0,4}, {1,5}, {2,6}, {3,7}
    """
    # TODO: Implement the following:
    # 1. Initialize process groups for TP, PP, and DP.
    # 2. Build the GPT-2 model with TP linear layers.
    # 3. Partition layers across pipeline stages.
    # 4. Wrap with DDP for data parallelism.
    # 5. Training loop:
    #    a. Split batch into micro-batches.
    #    b. Run GPipe schedule.
    #    c. AllReduce gradients across DP group.
    #    d. Optimizer step.
    # 6. Log throughput, MFU, and loss.
    raise NotImplementedError
```

**Requirements:**
- Train on a synthetic dataset (random token IDs) for at least 500 steps.
- Report throughput (tokens/second) and estimated MFU.
- Compare training throughput for at least 2 different parallelism configurations (e.g., TP=2/PP=1/DP=4 vs. TP=1/PP=2/DP=4 on 8 GPUs).

### Task B4: Scaling Analysis Report (10 points)

Write a report (2-3 pages within the 10-page limit) analyzing your implementation:

1. **Correctness verification:** Show that your 3D parallel training produces the same gradients (up to floating-point tolerance) as a single-GPU baseline for a small model. Include gradient comparison plots or tables.

2. **Throughput analysis:** Report tokens/second for at least 3 configurations. Plot throughput vs. number of GPUs. Compute scaling efficiency.

3. **Communication breakdown:** Using the PyTorch profiler or manual timing, report the fraction of step time spent on:
   - TP AllReduce (within-node)
   - PP send/recv (between-stage)
   - DP AllReduce (gradient sync)
   - Compute (forward + backward)

4. **Memory analysis:** Report peak GPU memory for each configuration. Compare against your analytical predictions from Part A.

5. **Bottleneck identification:** Identify the primary bottleneck in your implementation and propose how you would address it in a production system.

---

## Submission Checklist

- [ ] **Part A:** PDF with all analytical derivations (A1-A4).
- [ ] **Part B code:**
  - [ ] `column_parallel_linear.py` and `row_parallel_linear.py` with tests (B1)
  - [ ] `pipeline_schedule.py` with tests (B2)
  - [ ] `train_3d_parallel.py` — end-to-end training script (B3)
  - [ ] `README.md` with instructions to reproduce all results
- [ ] **Part B report:** Scaling analysis (B4), included in the PDF.
- [ ] All code runs on the class cluster with the provided environment.

---

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A1: Memory budget | 15 | Correct calculations, proper accounting of all components |
| A2: Loss scaling | 10 | Correct FP16 analysis, reasonable Markov chain model |
| A3: Parallelism config | 15 | Correct memory/communication analysis, justified recommendation |
| A4: Checkpointing | 10 | Correct derivation, numerical answer, comparison |
| B1: TP linear layers | 15 | Correct forward/backward, gradient test passes, clean code |
| B2: Pipeline schedule | 15 | Correct GPipe implementation, gradient test passes |
| B3: 3D parallel training | 10 | End-to-end training works, reasonable throughput |
| B4: Scaling report | 10 | Thorough analysis, correct measurements, insightful discussion |

**Bonus (up to 10 points):**
- Implement 1F1B pipeline schedule instead of GPipe (+5 points).
- Implement gradient checkpointing within the pipeline and measure the memory-throughput tradeoff (+3 points).
- Implement communication-computation overlap for the DP gradient AllReduce (+2 points).

---

## Hints

1. **For B1:** Study the `_CopyToModelParallelRegion` and `_ReduceFromModelParallelRegion` autograd functions in Megatron-LM. You need custom `Function` classes to handle the communication in the backward pass.

2. **For B2:** Start with a simple 2-stage pipeline (half the layers on each GPU). Get the forward pass working first, then add the backward pass. Use `torch.cuda.synchronize()` liberally for debugging — remove it for performance measurement.

3. **For B3:** Initialize all three process groups carefully. A common bug is using the wrong group for a communication operation. Print the group membership at startup.

4. **Gradient checking tip:** Compare gradients for a 2-layer model with TP=2 against a single-GPU 2-layer model. Keep the batch small ($B = 2$, $s = 16$) for the comparison. Use `torch.allclose` with `atol=1e-5, rtol=1e-3`.

5. **Performance tip:** The synthetic dataset eliminates data loading as a bottleneck, isolating the parallelism overhead. This is intentional.
