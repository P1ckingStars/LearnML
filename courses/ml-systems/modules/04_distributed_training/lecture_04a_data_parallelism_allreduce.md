# Lecture 04a: Data Parallelism, AllReduce, and Ring Communication

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Formalize** data-parallel distributed training as a mathematical decomposition of the stochastic gradient into per-worker partial sums, proving equivalence to large-batch SGD under exact gradient synchronization.
2. **Derive** the bandwidth cost of naive AllReduce, ring AllReduce, tree AllReduce, and recursive halving-doubling, proving that ring AllReduce achieves the bandwidth-optimal bound of $2 \frac{N-1}{N} \cdot M$ bytes communicated per worker.
3. **Analyze** PyTorch DistributedDataParallel (DDP) internals -- gradient bucketing, communication-computation overlap, and the backward hook mechanism -- and predict their impact on throughput.
4. **Model** scaling efficiency as a function of communication bandwidth, computation time, and the number of workers, deriving conditions under which linear speedup is achievable.
5. **Evaluate** the impact of gradient compression (quantization, sparsification, error feedback) on convergence guarantees and communication reduction.

---

## 2. Motivation and Context

### 2.1 The Computational Imperative

Training modern large models requires enormous compute budgets. GPT-3 (175B parameters) required approximately $3.14 \times 10^{23}$ FLOPs. A single NVIDIA A100 at 312 TFLOPS (BF16) would need:

$$T_{\text{single}} = \frac{3.14 \times 10^{23}}{312 \times 10^{12}} \approx 1.0 \times 10^9 \text{ seconds} \approx 32 \text{ years}$$

Even with perfect utilization, single-GPU training is infeasible. We need to distribute training across thousands of accelerators.

### 2.2 Why Data Parallelism First?

Data parallelism is the simplest and most widely used form of distributed training. It requires no model architecture changes, works for any model that fits in a single accelerator's memory, and scales well when the computation-to-communication ratio is favorable. Understanding data parallelism deeply is a prerequisite for all other parallelism strategies.

### 2.3 The Central Challenge: Gradient Synchronization

Data parallelism introduces a fundamental tension: each worker computes gradients on different data, but all workers must converge to the same model. The synchronization mechanism -- how gradients are aggregated and distributed -- determines both the statistical properties of training and the systems-level performance.

---

## 3. Mathematical Framework for Data Parallelism

### 3.1 Single-Worker SGD

Consider minimizing $f(\theta) = \mathbb{E}_{x \sim \mathcal{D}}[\ell(\theta; x)]$ where $\theta \in \mathbb{R}^d$ are the model parameters and $\ell$ is the per-sample loss. Standard mini-batch SGD with batch size $B$ performs:

$$\theta_{t+1} = \theta_t - \eta \cdot \frac{1}{B} \sum_{i=1}^{B} \nabla_\theta \ell(\theta_t; x_i)$$

where $\{x_1, \ldots, x_B\}$ is a mini-batch sampled from $\mathcal{D}$.

### 3.2 Data-Parallel SGD with $N$ Workers

Distribute the mini-batch across $N$ workers, each processing $B/N$ samples (we assume $N$ divides $B$). Worker $k$ holds a replica of the model $\theta_t$ and computes:

$$g_k = \frac{1}{B/N} \sum_{i \in \mathcal{B}_k} \nabla_\theta \ell(\theta_t; x_i)$$

where $\mathcal{B}_k$ is the subset of size $B/N$ assigned to worker $k$, with $\mathcal{B}_1, \ldots, \mathcal{B}_N$ forming a partition of the full mini-batch.

**Theorem 3.1 (Equivalence to Large-Batch SGD).** If all workers synchronize exactly, data-parallel SGD with $N$ workers and per-worker batch size $b = B/N$ is mathematically identical to single-worker SGD with batch size $B$:

$$\frac{1}{N} \sum_{k=1}^{N} g_k = \frac{1}{N} \sum_{k=1}^{N} \frac{N}{B} \sum_{i \in \mathcal{B}_k} \nabla_\theta \ell(\theta_t; x_i) = \frac{1}{B} \sum_{i=1}^{B} \nabla_\theta \ell(\theta_t; x_i)$$

*Proof.* The sum over all per-worker local gradients, divided by $N$, telescopes to the full-batch gradient because $\{\mathcal{B}_k\}$ partitions $\{1, \ldots, B\}$ and each partial average is weighted by $N/B$. $\blacksquare$

**Corollary 3.1.** Data-parallel training inherits all convergence guarantees of single-worker SGD at batch size $B$. The convergence rate, in terms of number of gradient steps, is unchanged. The wall-clock speedup comes from reducing per-step time.

### 3.3 The AllReduce Requirement

After the local forward and backward passes, each worker $k$ holds its local gradient $g_k \in \mathbb{R}^d$. To perform the synchronized update, every worker needs:

$$\bar{g} = \frac{1}{N} \sum_{k=1}^{N} g_k$$

This operation -- computing the average across all workers and distributing the result to all workers -- is the **AllReduce** operation. The efficiency of AllReduce determines the overhead of data parallelism.

### 3.4 Gradient Variance and Large-Batch Training

**Proposition 3.1 (Gradient Noise Reduction).** Let $g^{(b)}$ be the stochastic gradient with batch size $b$. The variance of the gradient estimator satisfies:

$$\text{Var}(g^{(b)}) = \frac{\sigma^2}{b}$$

where $\sigma^2 = \text{Var}(\nabla \ell(\theta; x))$ is the per-sample gradient variance. Data-parallel training with $N$ workers and per-worker batch size $b$ yields effective batch size $Nb$, giving variance $\sigma^2 / (Nb)$.

**Implication.** As we scale to more workers, the effective batch size grows, and gradient noise decreases. Beyond some critical batch size $B_{\text{crit}}$, the noise is so low that we are in the "large-batch regime" where further scaling yields diminishing returns in convergence speed. This is formalized by the *gradient noise scale* $\mathcal{B}_{\text{noise}} = \text{tr}(\Sigma) / \|\nabla f(\theta)\|^2$ from McCandlish et al. (2018).

---

## 4. AllReduce Algorithms

### 4.1 Problem Formulation

**Definition 4.1 (AllReduce).** Given $N$ workers, each holding a vector $g_k \in \mathbb{R}^d$, AllReduce computes $\bar{g} = \sum_{k=1}^{N} g_k$ (or the average) and places the result on every worker.

We measure cost by two metrics:
- **Latency** ($\alpha$): the number of sequential communication steps (proportional to the number of messages sent on the critical path).
- **Bandwidth** ($\beta$): the total data volume transmitted by any single worker, measured in units of $M = d \cdot \text{sizeof}(\text{element})$ bytes.

### 4.2 Naive AllReduce (Centralized)

**Algorithm.** Designate one worker as the root. All $N-1$ other workers send their gradient to the root. The root computes the sum, then broadcasts the result back.

**Cost analysis:**
- **Receive phase**: The root receives $N-1$ messages, each of size $M$. Time: $(N-1)(\alpha + M\beta)$.
- **Broadcast phase**: The root sends to $N-1$ workers. Time: $(N-1)(\alpha + M\beta)$ (sequential) or $\lceil \log_2 N \rceil (\alpha + M\beta)$ (tree broadcast).

Best case (tree broadcast for both phases):

$$T_{\text{naive}} = 2 \lceil \log_2 N \rceil \cdot \alpha + 2(N-1) \cdot M\beta$$

**Problems:** The root is a bandwidth bottleneck -- it must receive and send $O(NM)$ data. This does not scale.

### 4.3 Ring AllReduce

**Algorithm (Patarasuk & Yuan, 2009).** Arrange $N$ workers in a logical ring: $0 \to 1 \to 2 \to \cdots \to N-1 \to 0$. Each worker partitions its gradient into $N$ chunks of size $M/N$. The algorithm has two phases:

**Phase 1: Reduce-Scatter.** In $N-1$ steps, each worker sends one chunk to its right neighbor and receives one chunk from its left neighbor, accumulating (summing) the received chunk into its local buffer. After $N-1$ steps, worker $k$ holds the fully reduced chunk $k$.

```
Step 1: Worker k sends chunk[k] to worker (k+1) % N
        Worker k receives chunk[k-1] from worker (k-1) % N
        Worker k: chunk[k-1] += received_chunk[k-1]

Step 2: Worker k sends chunk[k-1] (now partially reduced) to (k+1) % N
        Worker k receives chunk[k-2] from (k-1) % N
        Worker k: chunk[k-2] += received_chunk[k-2]

... (repeat for N-1 steps total)
```

**Phase 2: AllGather.** In another $N-1$ steps, each worker sends its fully reduced chunk around the ring so all workers end up with all chunks.

**Theorem 4.1 (Ring AllReduce Cost).** The ring AllReduce with $N$ workers and message size $M$ has cost:

$$T_{\text{ring}} = 2(N-1) \cdot \alpha + 2 \cdot \frac{N-1}{N} \cdot M\beta$$

*Proof.* Each phase consists of $N-1$ steps. In each step, every worker sends and receives exactly one chunk of size $M/N$. The latency cost is $(N-1)\alpha$ per phase, giving $2(N-1)\alpha$ total. The bandwidth cost per worker per phase is $(N-1) \cdot M/N$ bytes sent. Total bandwidth per worker: $2(N-1) \cdot M/N = 2\frac{N-1}{N} M$. $\blacksquare$

**Theorem 4.2 (Bandwidth Optimality).** The ring AllReduce achieves the information-theoretic lower bound on bandwidth. Any AllReduce algorithm must have each worker send at least $\frac{N-1}{N} M$ bytes (for the reduce-scatter) and receive at least $\frac{N-1}{N} M$ bytes (for the allgather), giving a total bandwidth cost of at least $2\frac{N-1}{N} M$ per worker.

*Proof.* In the reduce-scatter phase, the final result on each worker is the sum of data from all $N$ workers. Worker $k$ starts with $M/N$ bytes of the final chunk $k$ and needs $(N-1) \cdot M/N$ bytes from other workers to complete it. Summing over all workers and dividing by $N$, each worker must receive at least $\frac{N-1}{N} M$ bytes. By symmetry, each worker must also send at least $\frac{N-1}{N} M$ bytes. The same argument applies to the allgather phase. $\blacksquare$

**Remark.** As $N \to \infty$, the bandwidth factor $2\frac{N-1}{N} \to 2$, meaning the bandwidth cost is approximately $2M$ regardless of the number of workers. This is why ring AllReduce scales well.

### 4.4 Tree AllReduce

**Algorithm.** Workers form a binary tree. Reduction proceeds bottom-up (each node receives from its children, sums, and sends to its parent), then the root broadcasts the result top-down.

**Cost:**

$$T_{\text{tree}} = 2 \lceil \log_2 N \rceil \cdot \alpha + 2 \lceil \log_2 N \rceil \cdot M\beta$$

**Comparison with Ring.** Tree AllReduce has $O(\log N)$ latency (better than ring's $O(N)$), but $O(M \log N)$ bandwidth (worse than ring's $O(M)$). Tree AllReduce is preferred when $M$ is small (latency-dominated) and the ring is preferred when $M$ is large (bandwidth-dominated).

### 4.5 Recursive Halving-Doubling

**Algorithm (Thakur, Rabenseifner, and Gropp, 2005).** Combines the latency advantage of tree algorithms with the bandwidth advantage of ring algorithms:

1. **Reduce-Scatter via Recursive Halving**: In step $i$ (for $i = 0, \ldots, \lceil \log_2 N \rceil - 1$), each worker exchanges data with a partner at distance $2^i$. The data is partitioned recursively: in step $i$, each worker sends half of its current data to its partner and receives the other half (already reduced).

2. **AllGather via Recursive Doubling**: The reverse process. In each step, workers exchange their locally complete chunks with partners, doubling the amount of complete data each step.

**Cost:**

$$T_{\text{rh-rd}} = 2 \lceil \log_2 N \rceil \cdot \alpha + 2 \cdot \frac{N-1}{N} \cdot M\beta$$

This achieves both $O(\log N)$ latency and $O(M)$ bandwidth -- the best of both worlds. In practice, this is the preferred algorithm for small to medium $N$ and large $M$.

### 4.6 Summary Table

| Algorithm | Latency | Bandwidth (per worker) | Best for |
|---|---|---|---|
| Naive (centralized) | $O(N) \alpha$ | $O(NM) \beta$ | Never (baseline) |
| Tree | $O(\log N) \alpha$ | $O(M \log N) \beta$ | Small messages |
| Ring | $O(N) \alpha$ | $O(M) \beta$ | Large messages, small $N$ |
| Recursive Halving-Doubling | $O(\log N) \alpha$ | $O(M) \beta$ | General purpose |

---

## 5. Gradient Bucketing and Communication-Computation Overlap

### 5.1 The Overlap Opportunity

In the backward pass, gradients are produced layer by layer, starting from the output layer and proceeding to the input layer. The key insight is that once a layer's gradient is computed, it can be communicated *while* earlier layers' gradients are still being computed.

Without overlap, the total time per step is:

$$T_{\text{no-overlap}} = T_{\text{fwd}} + T_{\text{bwd}} + T_{\text{comm}}$$

With perfect overlap, where communication of later layers hides behind computation of earlier layers:

$$T_{\text{overlap}} = T_{\text{fwd}} + \max(T_{\text{bwd}}, T_{\text{comm}})$$

The speedup from overlap depends on the ratio $T_{\text{comm}} / T_{\text{bwd}}$.

### 5.2 Gradient Bucketing

Rather than launching a separate AllReduce for each parameter tensor (which would incur high per-message latency overhead), PyTorch DDP groups parameters into **buckets** of a configurable size (default 25 MB). When all gradients in a bucket have been computed, the entire bucket is reduced in a single AllReduce call.

**Bucket formation rules:**
1. Parameters are added to buckets in *reverse* order of `model.parameters()` (matching the backward pass order).
2. A bucket is "ready" when all its constituent gradients have been computed.
3. Bucket size trades off latency (fewer large AllReduces) vs. overlap (many small AllReduces that can overlap with more computation).

### 5.3 PyTorch DDP Implementation

```python
import torch
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

def setup_ddp(rank, world_size):
    """Initialize DDP process group."""
    dist.init_process_group(
        backend="nccl",       # NCCL for GPU communication
        init_method="env://", # environment-variable based rendezvous
        rank=rank,
        world_size=world_size,
    )
    torch.cuda.set_device(rank)

def train_step(model, data, target, optimizer):
    """Single training step with DDP."""
    optimizer.zero_grad()
    output = model(data)
    loss = torch.nn.functional.cross_entropy(output, target)
    loss.backward()  # DDP hooks fire AllReduce during backward
    optimizer.step()  # All workers have identical gradients here
    return loss.item()

# Wrap model in DDP
model = DDP(
    model.to(rank),
    device_ids=[rank],
    bucket_cap_mb=25,           # bucket size in MB
    find_unused_parameters=False, # set True if forward has conditional paths
    gradient_as_bucket_view=True, # avoid gradient copy (memory optimization)
)
```

### 5.4 DDP Internals: The Backward Hook Mechanism

DDP registers autograd hooks on each parameter. The key data structures and flow:

1. **Bucket assignment**: At construction, DDP assigns each parameter to a bucket (in reverse `model.parameters()` order). A `Reducer` object manages bucket state.

2. **Autograd hooks**: For each parameter $p$, DDP registers a hook via `p.register_hook(reducer.autograd_hook)`. When the gradient for $p$ is computed during `loss.backward()`, the hook fires.

3. **Bucket readiness**: The hook marks $p$ as "ready" in its bucket. When all parameters in a bucket are ready, the bucket's AllReduce is launched asynchronously.

4. **Synchronization barrier**: Before `loss.backward()` returns, DDP waits for all AllReduce operations to complete.

5. **Gradient averaging**: The AllReduce computes the sum of gradients; DDP divides by world size to get the average.

```
[backward pass timeline]
Layer N grad computed  --> Hook fires, bucket B_last ready --> AllReduce(B_last) starts
Layer N-1 grad computed --> Hook fires
Layer N-2 grad computed --> Hook fires, bucket B_prev ready --> AllReduce(B_prev) starts
...                                                             AllReduce(B_last) finishes
Layer 1 grad computed   --> Hook fires, bucket B_first ready --> AllReduce(B_first) starts
                                                                 AllReduce(B_prev) finishes
backward() returns      <-- Wait for all AllReduces              AllReduce(B_first) finishes
```

### 5.5 Optimal Bucket Size Analysis

Let $L$ be the number of layers, $\alpha$ the per-AllReduce latency, $\beta$ the per-byte transfer cost, and $M$ the total gradient size.

With $k$ equal-sized buckets, each of size $M/k$:
- Total latency: $k \cdot \alpha$ (each bucket incurs one AllReduce launch)
- Overlap benefit: more buckets allow finer-grained overlap
- Total communication time (no overlap): $k \cdot \alpha + 2\frac{N-1}{N} M \beta$ (bandwidth term is fixed)

The optimal bucket count minimizes the exposed (non-overlapped) communication:

$$k^* = \underset{k}{\arg\min}\left[k \cdot \alpha + \left(2\frac{N-1}{N} \frac{M}{k} \beta - T_{\text{bwd}}/k\right)^+\right]$$

where $(\cdot)^+$ denotes $\max(\cdot, 0)$. In practice, bucket sizes of 10-50 MB work well on modern GPU clusters.

---

## 6. Scaling Efficiency Analysis

### 6.1 Throughput Model

Let $T_{\text{comp}}(b)$ be the computation time (forward + backward) for local batch size $b$, and $T_{\text{comm}}(M, N)$ be the AllReduce communication time for gradient size $M$ across $N$ workers.

With perfect overlap, throughput (samples/sec) with $N$ workers:

$$\text{Throughput}(N) = \frac{N \cdot b}{\max(T_{\text{comp}}(b), T_{\text{comm}}(M, N))}$$

Without overlap:

$$\text{Throughput}(N) = \frac{N \cdot b}{T_{\text{comp}}(b) + T_{\text{comm}}(M, N)}$$

### 6.2 Scaling Efficiency

**Definition 6.1 (Scaling Efficiency).** The scaling efficiency with $N$ workers is:

$$\eta(N) = \frac{\text{Throughput}(N)}{N \cdot \text{Throughput}(1)}$$

Linear scaling corresponds to $\eta(N) = 1$. In practice, $\eta(N) < 1$ due to communication overhead.

**Theorem 6.1 (Scaling Efficiency Bound).** Under the simple model where computation time is constant and communication uses ring AllReduce:

$$\eta(N) = \frac{1}{1 + \frac{T_{\text{comm}}}{T_{\text{comp}}}} = \frac{1}{1 + \frac{2\frac{N-1}{N} M \beta}{T_{\text{comp}}}}$$

For fixed $T_{\text{comp}}$ and large $N$, $\eta(N) \approx \frac{1}{1 + 2M\beta / T_{\text{comp}}}$.

*Proof.* Without overlap: $\text{Throughput}(N) = Nb / (T_{\text{comp}} + T_{\text{comm}})$. Single-worker throughput: $b / T_{\text{comp}}$. The ratio gives $\eta(N) = T_{\text{comp}} / (T_{\text{comp}} + T_{\text{comm}})$. $\blacksquare$

### 6.3 The Computation-to-Communication Ratio

**Definition 6.2 (Arithmetic Intensity of Training).** The computation-to-communication ratio for data-parallel training is:

$$\rho = \frac{\text{FLOPs per step}}{\text{Bytes communicated per step}} = \frac{F(b)}{2M}$$

where $F(b)$ is the FLOPs for a forward+backward pass with batch size $b$ and $M$ is the gradient size in bytes.

**Example.** For a Transformer with $P$ parameters, batch size $b$, sequence length $s$:
- FLOPs $\approx 6Pbs$ (the "6P" rule: 2P for forward, 4P for backward, times $bs$ tokens)
- Communication: $2M = 2P \cdot \text{sizeof(dtype)}$ bytes (e.g., $2P \times 2 = 4P$ bytes for BF16)

$$\rho = \frac{6Pbs}{4P} = \frac{3bs}{2} \quad \text{(FLOP/byte for BF16)}$$

To achieve good scaling, we need $\rho \cdot \text{bandwidth} \gg \text{compute\_throughput}$, i.e., the time to communicate must be much less than the time to compute.

### 6.4 Worked Example

**Setup:** 8 A100 GPUs (312 TFLOPS BF16 each), NVLink interconnect (600 GB/s bidirectional per GPU), training a 1.3B parameter model (BF16), batch size $b = 8$ per GPU, sequence length $s = 2048$.

- Gradient size: $M = 1.3 \times 10^9 \times 2 = 2.6$ GB
- FLOPs per step per GPU: $6 \times 1.3 \times 10^9 \times 8 \times 2048 \approx 1.28 \times 10^{14}$ FLOPs
- Compute time (at 50% MFU): $T_{\text{comp}} = 1.28 \times 10^{14} / (0.5 \times 312 \times 10^{12}) = 0.82$ s
- Comm time (ring AllReduce): $T_{\text{comm}} = 2 \times \frac{7}{8} \times 2.6 \times 10^9 / (600 \times 10^9) = 7.6$ ms
- Scaling efficiency: $\eta = 0.82 / (0.82 + 0.0076) = 99.1\%$

This shows that for large models with fast interconnects, data parallelism scales extremely well.

---

## 7. Gradient Compression

### 7.1 Motivation

When the interconnect bandwidth is limited (e.g., commodity Ethernet), communication becomes the bottleneck. Gradient compression reduces the volume of data communicated at the cost of introducing noise into the gradient.

### 7.2 Gradient Quantization

**Approach.** Represent each gradient element with fewer bits. For example, 1-bit SGD (Seide et al., 2014) quantizes each gradient element to its sign:

$$\tilde{g}_i = \|g\|_1 / d \cdot \text{sign}(g_i)$$

**Communication savings**: $32\times$ for FP32 $\to$ 1-bit. However, the quantized gradient has high variance, which slows convergence.

### 7.3 Gradient Sparsification

**Top-$k$ Sparsification (Aji & Heafield, 2017).** Transmit only the $k$ largest-magnitude gradient elements and their indices:

$$[\tilde{g}]_i = \begin{cases} g_i & \text{if } |g_i| \geq |g|_{(k)} \\ 0 & \text{otherwise} \end{cases}$$

where $|g|_{(k)}$ is the $k$-th largest absolute value. With $k = 0.001d$ (0.1% sparsity), we achieve $\sim 1000\times$ communication reduction.

### 7.4 Error Feedback (Memory)

**Key insight (Stich et al., 2018; Karimireddy et al., 2019).** Naively applying compression at each step discards gradient information, causing divergence. Error feedback accumulates the compression error and adds it to the next step's gradient:

$$e_{t+1} = g_t + e_t - C(g_t + e_t)$$

$$\tilde{g}_t = C(g_t + e_t)$$

where $C(\cdot)$ is the compression operator. This ensures that no gradient information is permanently lost.

**Theorem 7.1 (Convergence with Error Feedback).** Under standard smoothness assumptions and using a $\delta$-compressor (where $\mathbb{E}\|C(x) - x\|^2 \leq (1-\delta)\|x\|^2$ for $\delta \in (0, 1]$), SGD with compressed communication and error feedback converges at rate:

$$\frac{1}{T} \sum_{t=0}^{T-1} \mathbb{E}\|\nabla f(\theta_t)\|^2 \leq O\!\left(\frac{f(\theta_0) - f^*}{\eta T} + \eta L \sigma^2 + \frac{\eta L \sigma^2}{\delta}\right)$$

The additional $1/\delta$ factor is the price of compression. With appropriate learning rate scheduling, the final convergence rate matches uncompressed SGD up to constants.

---

## 8. Synchronous vs. Asynchronous Data Parallelism

### 8.1 Synchronous SGD (Bulk Synchronous Parallel)

All workers synchronize at a barrier after each step. Properties:
- Mathematically equivalent to large-batch SGD (Theorem 3.1)
- **Straggler problem**: the slowest worker determines the step time
- Deterministic given the same random seeds and data ordering

### 8.2 Asynchronous SGD

Workers update a shared parameter server without waiting for each other. Worker $k$ reads parameters, computes gradients, and pushes updates independently.

**Staleness.** Worker $k$'s gradient at step $t_k$ may be computed with parameters $\theta_{t_k - \tau_k}$ where $\tau_k$ is the staleness (number of intervening updates by other workers).

**Theorem 8.1 (Convergence with Bounded Staleness).** If the maximum staleness $\tau_{\max}$ is bounded, asynchronous SGD converges for convex and certain non-convex objectives, with convergence rate degraded by a factor proportional to $\tau_{\max}$:

$$\frac{1}{T}\sum_{t=0}^{T-1}\mathbb{E}\|\nabla f(\theta_t)\|^2 \leq O\!\left(\frac{1}{\sqrt{T}} + \frac{\tau_{\max}}{T}\right)$$

### 8.3 Local SGD (Periodic Averaging)

**Algorithm.** Workers run $H$ steps of local SGD independently, then average parameters:

$$\theta_t^{\text{global}} = \frac{1}{N} \sum_{k=1}^{N} \theta_t^{(k)}$$

This reduces communication frequency by a factor of $H$. Lin et al. (2020) proved that local SGD achieves the same asymptotic convergence rate as mini-batch SGD when $H = O(\sqrt{T/N})$.

---

## Key Takeaways

1. Data-parallel training partitions data across workers, with each worker maintaining a full model replica. Under exact synchronization, it is mathematically equivalent to large-batch SGD.

2. Ring AllReduce achieves the bandwidth-optimal bound of $2\frac{N-1}{N}M$ bytes per worker, making communication cost nearly independent of the number of workers.

3. PyTorch DDP uses gradient bucketing and backward-pass hooks to overlap communication with computation, approaching the theoretical lower bound of $T_{\text{step}} = \max(T_{\text{comp}}, T_{\text{comm}})$.

4. Scaling efficiency depends critically on the computation-to-communication ratio $\rho$. For large models on fast interconnects, data parallelism achieves near-linear speedup.

5. Gradient compression (quantization, sparsification with error feedback) can reduce communication by orders of magnitude while preserving convergence guarantees, enabling data parallelism on slower networks.

---

## Further Reading

1. **Patarasuk, P. & Yuan, X.** (2009). *Bandwidth optimal all-reduce algorithms for clusters of workstations.* Journal of Parallel and Distributed Computing, 69(2), 117-124.
   - The original ring AllReduce algorithm derivation and optimality proof.

2. **Li, M., Andersen, D. G., Park, J. W., Smola, A. J., Ahmed, A., Josifovski, V., Long, J., Shekita, E. J., & Su, B-Y.** (2014). *Scaling Distributed Machine Learning with the Parameter Server.* OSDI 2014.
   - The parameter server architecture for asynchronous distributed training.

3. **Goyal, P., Dollar, P., Girshick, R., Noordhuis, P., Wesolowski, L., Kyrola, A., Tulloch, A., Jia, Y., & He, K.** (2017). *Accurate, Large Minibatch SGD: Training ImageNet in 1 Hour.* arXiv:1706.02677.
   - Practical recipe for scaling data-parallel training (linear scaling rule, warmup).

4. **Li, S., Zhao, Y., Varma, R., Salpekar, O., Noordhuis, P., Li, T., Paszke, A., Smith, J., Vaughan, B., Damania, P., & Chintala, S.** (2020). *PyTorch Distributed: Experiences on Accelerating Data Parallel Training.* VLDB 2020.
   - PyTorch DDP implementation details and performance analysis.

5. **Karimireddy, S. P., Rebjock, Q., Stich, S. U., & Jaggi, M.** (2019). *Error Feedback Fixes SignSGD and Other Gradient Compression Schemes.* ICML 2019.
   - Convergence theory for compressed gradient communication with error feedback.

6. **McCandlish, S., Kaplan, J., Amodei, D., & the OpenAI Dota Team.** (2018). *An Empirical Model of Large-Batch Training.* arXiv:1812.06162.
   - Gradient noise scale and the critical batch size.

7. **Lin, T., Stich, S. U., Patel, K. K., & Jaggi, M.** (2020). *Don't Use Large Mini-Batches, Use Local SGD.* ICLR 2020.
   - Local SGD as a communication-efficient alternative to synchronized data parallelism.
