# Homework 04: Data-Parallel and Pipeline-Parallel Training

**Estimated time**: ~20 hours
**Due date**: See course calendar
**Submission**: A single `.zip` archive containing your Python source files, profiling results (screenshots or exported traces), and a PDF report answering all analytical questions.

---

## Overview

In this assignment, you will derive fundamental properties of distributed training algorithms (Part A) and implement data-parallel and pipeline-parallel training from scratch (Part B). You will gain deep understanding of AllReduce algorithms, pipeline schedules, and the performance trade-offs that govern large-scale training.

**Rules:**

- You may NOT use `torch.nn.parallel.DistributedDataParallel`, `FullyShardedDataParallel`, or any high-level distributed training wrapper for Part B implementation tasks.
- You MAY use `torch.distributed` collective primitives (`dist.all_reduce`, `dist.reduce_scatter`, `dist.all_gather`, `dist.send`, `dist.recv`, `dist.isend`, `dist.irecv`).
- You MAY use standard PyTorch modules (`nn.Linear`, `nn.LayerNorm`, etc.) for model construction.
- All code must be your own and well-documented.

---

## Part A: Theory (50 points)

### Problem A.1: AllReduce Algorithm Analysis (12 points)

Consider $N$ workers, each holding a vector $g_k \in \mathbb{R}^d$ with $M = d \cdot 4$ bytes (float32). Communication cost is modeled as $T(m) = \alpha + m\beta$ for a message of $m$ bytes, where $\alpha$ is latency and $\beta$ is inverse bandwidth.

**(a)** (3 points) Derive the total time for **naive AllReduce** (all workers send to a designated root, root computes the sum, root broadcasts back using a binomial tree). Express the answer in terms of $N$, $M$, $\alpha$, and $\beta$. Identify the bottleneck.

**(b)** (4 points) Derive the total time for **ring AllReduce** step by step. Show that the reduce-scatter phase takes $(N-1)(\alpha + \frac{M}{N}\beta)$ and the allgather phase takes $(N-1)(\alpha + \frac{M}{N}\beta)$. Combine to get the total cost. Prove that the bandwidth term $2\frac{N-1}{N}M\beta$ is optimal (i.e., no AllReduce algorithm can use less bandwidth per worker).

**(c)** (3 points) **Recursive halving-doubling** achieves latency $2\lceil\log_2 N\rceil \cdot \alpha$ with the same bandwidth term as ring. Explain (with a diagram for $N = 8$) how the recursive halving step works in the reduce-scatter phase. Why does this achieve $O(\log N)$ latency?

**(d)** (2 points) For a 1.3B parameter model in BF16 on 64 GPUs connected by 200 Gb/s InfiniBand ($\alpha = 5\ \mu s$, $\beta = 1/(25 \times 10^9)$ s/byte), compute the AllReduce time for both ring and recursive halving-doubling. Which algorithm is faster and why?

### Problem A.2: Pipeline Parallelism Schedules (12 points)

Consider a model with $L = 32$ layers partitioned into $P$ pipeline stages (equal layers per stage). Each micro-batch forward pass through one stage takes $t_f$ and each backward pass takes $t_b = 2t_f$ (backward is approximately twice as expensive as forward).

**(a)** (3 points) For GPipe with $P = 4$ stages and $M = 16$ micro-batches, compute:
1. The total time for one training step (wall-clock).
2. The bubble fraction.
3. The peak activation memory at each stage (in units of "micro-batch activations").

**(b)** (3 points) Repeat part (a) for the **1F1B schedule**. Show that the bubble fraction is the same as GPipe but the peak activation memory at each stage is $P$ (not $M$). Draw the schedule timeline for the first 12 time slots.

**(c)** (3 points) For the **interleaved 1F1B schedule** with $v = 2$ virtual stages per device (so $2P = 8$ virtual stages total on $P = 4$ devices), derive:
1. The bubble fraction.
2. The additional communication cost compared to non-interleaved 1F1B.
3. Under what conditions (in terms of computation time, communication bandwidth) does the interleaved schedule outperform the non-interleaved schedule?

**(d)** (3 points) **Pipeline bubble lower bound.** Prove that for any pipeline schedule maintaining sequential semantics (each micro-batch passes through all stages in order, forward before backward), with $P$ stages and $M$ micro-batches:

$$\text{bubble fraction} \geq \frac{P - 1}{M + P - 1} \quad \text{(when } t_f = t_b = t \text{)}$$

*Hint*: Consider the critical path through the first micro-batch and the total available computation slots.

### Problem A.3: ZeRO Memory Analysis (14 points)

Consider training a Transformer model with $P$ parameters using the Adam optimizer in mixed precision (BF16 compute, FP32 optimizer states). The model has $L$ Transformer layers, each with hidden dimension $d$, FFN intermediate dimension $4d$, and $h$ attention heads. Batch size is $b$, sequence length is $s$, and there are $N$ data-parallel workers.

**(a)** (4 points) Derive the **exact** model state memory per worker for:
1. Standard DDP (all replicated)
2. ZeRO Stage 1 (optimizer states partitioned)
3. ZeRO Stage 2 (optimizer states + gradients partitioned)
4. ZeRO Stage 3 (everything partitioned)

Express answers in bytes as functions of $P$ and $N$.

**(b)** (3 points) Derive the **exact** communication volume per training step (in bytes, per worker) for each of the four configurations above. Specify which collective operations are used.

**(c)** (3 points) For a 13B parameter model ($P = 13 \times 10^9$, $d = 5120$, $L = 40$, $h = 40$) with $N = 8$ GPUs (80 GB each), batch size $b = 2$, sequence length $s = 4096$:
1. Compute the model state memory per GPU for DDP and each ZeRO stage.
2. Estimate activation memory per layer (ignoring checkpointing).
3. Which is the minimum ZeRO stage that fits in a single 80 GB GPU? Show your work.

**(d)** (4 points) **Activation checkpointing interaction.** With ZeRO Stage 3 and activation checkpointing (checkpoint every $\sqrt{L}$ layers):
1. How many additional AllGather operations are needed compared to ZeRO-3 without checkpointing? (When recomputing forward activations, parameters must be AllGathered again.)
2. Derive the total communication volume per step with activation checkpointing.
3. For the 13B model above, compute the actual additional communication time assuming 8 GPUs connected via NVLink at 600 GB/s effective bandwidth.

### Problem A.4: Scaling Efficiency (12 points)

**(a)** (3 points) A training run on 1 GPU takes 100 ms per step (forward: 30 ms, backward: 70 ms). On 8 GPUs with DDP (ring AllReduce), the gradient size is 500 MB and the interconnect provides 300 GB/s bus bandwidth. Compute:
1. The AllReduce time.
2. The per-step time assuming perfect overlap of communication with backward computation.
3. The per-step time assuming zero overlap.
4. The scaling efficiency in each case.

**(b)** (3 points) Derive the **critical batch size** $B_{\text{crit}}$ below which gradient noise dominates and above which increasing batch size yields diminishing returns. Start from the gradient noise scale $\mathcal{B}_{\text{noise}} = \text{tr}(\Sigma) / \|\mu\|^2$ where $\mu = \nabla f(\theta)$ and $\Sigma = \text{Cov}(\nabla \ell(\theta; x))$. Show that:
- For $B \ll \mathcal{B}_{\text{noise}}$: halving noise requires $2\times$ more samples (linear scaling regime).
- For $B \gg \mathcal{B}_{\text{noise}}$: halving noise requires $4\times$ more samples (diminishing returns).

**(c)** (3 points) A team scales training from 32 to 256 GPUs (8x more GPUs). They keep the per-GPU batch size constant, so the global batch size increases 8x. Using the linear scaling rule (scale learning rate by $k$ when batch size increases by $k$), they find that:
- Loss after 1000 steps is similar to the 32-GPU run after 1000 steps.
- But loss after 10000 steps is higher than the 32-GPU run after 10000 steps.

Explain this observation. What batch size effects could cause this? What mitigation strategies would you recommend?

**(d)** (3 points) For a 70B parameter model trained on a cluster of 512 H100 GPUs with the following configuration:
- TP = 8 (NVLink, 900 GB/s)
- PP = 8 (InfiniBand, 50 GB/s per rail, 4 rails)
- DP = 8 (InfiniBand, 50 GB/s per rail, 4 rails)

Estimate the Model FLOPs Utilization (MFU), defined as:

$$\text{MFU} = \frac{\text{Achieved FLOPs/s per GPU}}{\text{Peak FLOPs/s per GPU}}$$

Assume: per-step compute takes 2 seconds (at 50% raw MFU), TP adds 5% overhead, PP bubble is 8%, DP AllReduce is fully overlapped. Compute the effective MFU accounting for all overheads.

---

## Part B: Implementation (50 points)

### Problem B.1: Ring AllReduce Implementation (15 points)

Implement ring AllReduce from scratch using only point-to-point primitives (`dist.send`, `dist.recv`, `dist.isend`, `dist.irecv`).

```python
def ring_allreduce(tensor: torch.Tensor) -> torch.Tensor:
    """
    Perform AllReduce (sum) using the ring algorithm.

    Args:
        tensor: Local tensor to reduce. Same shape on all ranks.

    Returns:
        Tensor containing the sum across all ranks.

    Implementation requirements:
        1. Use only dist.send/recv or dist.isend/dist.irecv.
        2. Split the tensor into world_size chunks.
        3. Perform reduce-scatter phase (N-1 steps).
        4. Perform allgather phase (N-1 steps).
    """
    # YOUR CODE HERE
    pass
```

**Requirements:**
1. Implement the reduce-scatter and allgather phases correctly.
2. Handle tensors that are not evenly divisible by world_size (with padding).
3. Use non-blocking sends (`isend`) for double-buffering to achieve better performance.

**Verification:**
```python
# Test correctness
local = torch.randn(10000, device='cuda') + rank  # different on each rank
result = ring_allreduce(local.clone())
expected = torch.zeros_like(local)
dist.all_reduce(expected.copy_(local))  # use NCCL as reference
assert torch.allclose(result, expected, atol=1e-5), "Ring AllReduce incorrect!"

# Benchmark vs NCCL
for size_mb in [1, 10, 100, 500]:
    t_custom = benchmark(ring_allreduce, size_mb)
    t_nccl = benchmark(dist.all_reduce, size_mb)
    print(f"{size_mb} MB: custom={t_custom:.3f}ms, NCCL={t_nccl:.3f}ms, "
          f"ratio={t_custom/t_nccl:.2f}x")
```

**Deliverables:**
- Working `ring_allreduce` function.
- Correctness verification output.
- Benchmark results table comparing your implementation to NCCL for message sizes 1 MB, 10 MB, 100 MB, 500 MB.
- Brief explanation (1 paragraph) of why NCCL is faster than your implementation.

### Problem B.2: Data-Parallel Training from Scratch (15 points)

Implement data-parallel training without using `DistributedDataParallel`. You will manually manage gradient synchronization with communication-computation overlap.

```python
class ManualDDP:
    """
    Manual data-parallel training wrapper.

    Features to implement:
    1. Gradient AllReduce after backward pass.
    2. Gradient bucketing (configurable bucket size).
    3. Communication-computation overlap using backward hooks.
    """
    def __init__(self, model, bucket_size_mb=25):
        self.model = model
        self.bucket_size_mb = bucket_size_mb
        self.world_size = dist.get_world_size()
        # YOUR CODE: set up buckets and hooks
        self._setup_buckets()
        self._register_hooks()

    def _setup_buckets(self):
        """Assign parameters to buckets (reverse order of model.parameters())."""
        # YOUR CODE HERE
        pass

    def _register_hooks(self):
        """Register backward hooks for communication-computation overlap."""
        # YOUR CODE HERE
        pass

    def forward(self, *args, **kwargs):
        return self.model(*args, **kwargs)

    def finish_gradient_sync(self):
        """Wait for all pending AllReduce operations to complete."""
        # YOUR CODE HERE
        pass
```

**Requirements:**
1. Gradient bucketing: group parameters into buckets of configurable size.
2. Communication-computation overlap: launch AllReduce as soon as a bucket is ready (all gradients in the bucket computed).
3. Gradient averaging: divide by world_size after AllReduce.

**Training loop:**
```python
model = ManualDDP(MyModel().cuda(rank), bucket_size_mb=25)
optimizer = torch.optim.Adam(model.model.parameters(), lr=1e-3)

for data, target in dataloader:
    output = model.forward(data)
    loss = F.cross_entropy(output, target)
    optimizer.zero_grad()
    loss.backward()
    model.finish_gradient_sync()  # wait for all AllReduces
    optimizer.step()
```

**Deliverables:**
- Working `ManualDDP` class.
- Train a ResNet-18 on CIFAR-10 to >90% accuracy using your ManualDDP on 2+ GPUs. Report training curves.
- Compare training throughput (samples/sec) of your ManualDDP vs. PyTorch DDP. Report the overhead.
- Sweep bucket size {1, 5, 10, 25, 50, 100} MB and plot throughput vs bucket size. Explain the trend.

### Problem B.3: Pipeline-Parallel Training (20 points)

Implement GPipe-style and 1F1B pipeline-parallel training for a simple Transformer model.

**Step 1: Model partitioning (5 points).**

```python
def partition_model(model, num_stages):
    """
    Partition a sequential model into pipeline stages.

    Args:
        model: nn.Sequential model with L layers.
        num_stages: Number of pipeline stages P.

    Returns:
        List of nn.Sequential modules, one per stage.
    """
    # YOUR CODE HERE
    pass
```

**Step 2: GPipe schedule (7 points).**

```python
class GPipePipeline:
    """
    GPipe pipeline parallelism implementation.

    Forward: process all M micro-batches through all stages.
    Backward: process all M micro-batches backward through all stages.
    """
    def __init__(self, stage_module, stage_id, num_stages, num_microbatches):
        self.stage = stage_module
        self.stage_id = stage_id
        self.num_stages = num_stages
        self.num_microbatches = num_microbatches

    def forward_backward(self, microbatches, targets):
        """
        Execute the full GPipe schedule.

        Args:
            microbatches: list of M input tensors (only used by stage 0)
            targets: list of M target tensors (only used by last stage)

        Returns:
            Total loss (on last stage), None on other stages.
        """
        # YOUR CODE HERE
        # 1. Forward pass: send/recv activations between stages
        # 2. Backward pass: send/recv gradients between stages
        # 3. Accumulate gradients across micro-batches
        pass
```

**Step 3: 1F1B schedule (8 points).**

```python
class OneF1BPipeline:
    """
    1F1B (one forward, one backward) pipeline parallelism.

    Warmup: P-1 forward passes.
    Steady state: alternate 1 forward + 1 backward.
    Cooldown: remaining backward passes.
    """
    def __init__(self, stage_module, stage_id, num_stages, num_microbatches):
        self.stage = stage_module
        self.stage_id = stage_id
        self.num_stages = num_stages
        self.num_microbatches = num_microbatches

    def forward_backward(self, microbatches, targets):
        """Execute the 1F1B schedule."""
        # YOUR CODE HERE
        pass
```

**Requirements:**
1. Implement inter-stage communication using `dist.send`/`dist.recv` for activation and gradient tensors.
2. Support gradient accumulation across micro-batches.
3. Handle the case where `num_microbatches` is not divisible by `num_stages`.

**Deliverables:**
- Working `GPipePipeline` and `OneF1BPipeline` classes.
- Train a 4-layer Transformer (each layer = one stage) on a text dataset using both schedules. Report final loss and training curves.
- Measure and report for both schedules:
  - Wall-clock time per step
  - Bubble fraction (measured, by timing idle time on each stage)
  - Peak GPU memory per stage
- Compare measured bubble fractions to theoretical predictions from Part A.
- Write a 1-page analysis comparing the two schedules: when does 1F1B's memory advantage matter in practice?

---

## Grading Rubric

| Component | Points |
|---|---|
| **Part A** | **50** |
| A.1: AllReduce analysis | 12 |
| A.2: Pipeline schedules | 12 |
| A.3: ZeRO memory analysis | 14 |
| A.4: Scaling efficiency | 12 |
| **Part B** | **50** |
| B.1: Ring AllReduce implementation | 15 |
| B.2: Manual DDP with bucketing | 15 |
| B.3: Pipeline parallelism (GPipe + 1F1B) | 20 |
| **Total** | **100** |

**Bonus (up to 10 extra points):**
- B.1 bonus (3 pts): Implement double-buffered ring AllReduce with overlapping send/recv. Show the speedup vs your baseline implementation.
- B.3 bonus (4 pts): Implement the interleaved 1F1B schedule with $v = 2$ virtual stages. Compare bubble fraction and throughput to non-interleaved 1F1B.
- B.3 bonus (3 pts): Implement activation checkpointing within your pipeline stages. Measure the memory savings and recomputation overhead.

---

## Tips and Resources

1. **Multi-GPU testing**: If you only have 1 GPU, you can test with `torch.distributed.launch` using the `gloo` backend on CPU (slower but functional for correctness testing).

2. **Debugging distributed code**: Add `torch.distributed.barrier()` at key points to synchronize prints. Use `NCCL_DEBUG=INFO` for communication debugging.

3. **Common pitfalls**:
   - Forgetting to divide gradients by world_size after AllReduce (or equivalently, using `dist.ReduceOp.AVG` instead of `SUM`).
   - Deadlocks from mismatched send/recv pairs -- draw the communication pattern before coding.
   - Not calling `torch.cuda.synchronize()` before timing measurements.

4. **Useful PyTorch distributed APIs**:
   ```python
   dist.send(tensor, dst=rank)      # blocking send
   dist.recv(tensor, src=rank)      # blocking recv
   req = dist.isend(tensor, dst=rank)  # non-blocking send
   req = dist.irecv(tensor, src=rank)  # non-blocking recv
   req.wait()                        # wait for completion
   dist.all_reduce(tensor)           # in-place AllReduce
   dist.reduce_scatter(output, input_list)
   dist.all_gather(output_list, input)
   ```

5. **Reference**: PyTorch Distributed documentation (https://pytorch.org/docs/stable/distributed.html)
