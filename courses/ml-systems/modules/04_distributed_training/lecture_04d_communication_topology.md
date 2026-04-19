# Lecture 04d: Communication Primitives and Network Topology

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** and **implement** all MPI-style collective operations (broadcast, scatter, gather, allgather, reduce, allreduce, reduce-scatter, alltoall) and derive their bandwidth and latency costs under ring and tree algorithms.
2. **Analyze** NCCL's architecture -- channel-based parallelism, kernel fusion, and protocol selection (LL, LL128, Simple) -- and predict performance for a given collective on a given topology.
3. **Model** the communication cost of distributed training workloads on realistic network topologies including NVLink meshes, NVSwitch fabrics, InfiniBand fat-trees, and RoCE networks.
4. **Distinguish** intra-node and inter-node communication bandwidth hierarchies and design parallelism strategies that respect the bandwidth hierarchy.
5. **Diagnose** communication bottlenecks using bandwidth modeling, identifying whether a workload is latency-bound, bandwidth-bound, or compute-bound.

---

## 2. Motivation and Context

### 2.1 Communication as the Bottleneck

In distributed training, the computation (matrix multiplications on GPUs) is embarrassingly parallel once the data and model are distributed. The fundamental challenge is *communication*: moving data between devices. The performance of distributed training is ultimately limited by:

1. The **bandwidth** of the interconnect (how fast data can move).
2. The **latency** of the interconnect (how long until the first byte arrives).
3. The **topology** (which devices can communicate directly).

### 2.2 The Bandwidth Hierarchy

Modern GPU clusters have a deep bandwidth hierarchy:

| Level | Technology | Bandwidth (per direction) | Latency |
|---|---|---|---|
| On-chip (GPU) | HBM3 | 3.35 TB/s (H100) | ~100 ns |
| Intra-node GPU-GPU | NVLink (4th gen) | 900 GB/s (H100) | ~1 us |
| Intra-node (NVSwitch) | NVSwitch | 900 GB/s per GPU | ~1 us |
| Inter-node | InfiniBand NDR | 400 Gb/s = 50 GB/s | ~1-2 us |
| Inter-node | RoCE v2 | 100-400 Gb/s | ~2-5 us |
| Data center | Ethernet | 100-400 Gb/s | ~5-20 us |

The ratio between NVLink and InfiniBand bandwidth is approximately $18\times$, which fundamentally shapes how parallelism strategies are mapped to hardware.

---

## 3. Collective Communication Primitives

### 3.1 Taxonomy

All distributed training communication can be expressed as compositions of a small set of collective operations. Let $N$ be the number of participating processes (ranks), each holding data $x_k$ of size $M$.

### 3.2 Broadcast

**Definition.** One rank (root) sends its data to all other ranks. After broadcast, all ranks hold a copy of the root's data.

$$\text{Before: } x_{\text{root}} \quad \text{After: } \forall k, \; x_k = x_{\text{root}}$$

**Cost (binomial tree):**
- Latency: $\lceil \log_2 N \rceil \cdot \alpha$
- Bandwidth: $\lceil \log_2 N \rceil \cdot M \beta$ (per worker on critical path)

**Cost (ring):**
- Latency: $(N-1) \cdot \alpha$
- Bandwidth: $M \beta$

**Cost (pipelined binary tree, message size $M$, $k$ segments):**
- Latency: $(\lceil \log_2 N \rceil + k - 1) \cdot \alpha$
- Bandwidth: $\lceil \log_2 N \rceil \cdot (M/k) \beta$

### 3.3 Reduce

**Definition.** Combine data from all ranks to a single root using an associative operator $\oplus$ (typically sum):

$$x_{\text{root}} = x_0 \oplus x_1 \oplus \cdots \oplus x_{N-1}$$

Same cost as broadcast (by symmetry of the communication pattern).

### 3.4 AllReduce

**Definition.** Reduce followed by broadcast -- all ranks hold the reduced result.

$$\forall k, \; x_k = x_0 \oplus x_1 \oplus \cdots \oplus x_{N-1}$$

As derived in Lecture 04a, the bandwidth-optimal cost is:

$$T_{\text{AllReduce}} = 2(N-1)\alpha + 2\frac{N-1}{N} M\beta$$

AllReduce can be decomposed as ReduceScatter + AllGather (used by ring AllReduce and FSDP).

### 3.5 Scatter

**Definition.** The root partitions its data into $N$ equal chunks and sends chunk $k$ to rank $k$:

$$\text{Root has } [x_0 \mid x_1 \mid \cdots \mid x_{N-1}] \quad \Rightarrow \quad \text{Rank } k \text{ receives } x_k$$

**Cost (direct from root):**
- Latency: $(N-1)\alpha$ (sequential) or $\lceil \log_2 N \rceil \alpha$ (tree)
- Bandwidth: $\frac{N-1}{N} M \beta$ (root sends all but its own chunk)

### 3.6 Gather

**Definition.** Inverse of scatter. Each rank sends its data to the root, which concatenates them:

$$\text{Each rank } k \text{ has } x_k \quad \Rightarrow \quad \text{Root has } [x_0 \mid x_1 \mid \cdots \mid x_{N-1}]$$

Same cost as scatter.

### 3.7 AllGather

**Definition.** Every rank sends its data to every other rank. Each rank ends up with the concatenation of all ranks' data:

$$\forall k, \; x_k = [x_0 \mid x_1 \mid \cdots \mid x_{N-1}]$$

**Cost (ring):**
- Latency: $(N-1)\alpha$
- Bandwidth: $\frac{N-1}{N} M \beta$ (each rank sends its chunk to $N-1$ others)

Note: each rank starts with a chunk of size $M/N$ (its own data). The total data size after allgather is $M$.

**Usage in distributed training:** FSDP uses AllGather to reconstruct full parameters before each layer's computation.

### 3.8 ReduceScatter

**Definition.** Combines reduce and scatter: reduce across all ranks, then scatter the result so rank $k$ holds the $k$-th chunk of the reduced data.

$$\text{Rank } k \text{ has } x_k \in \mathbb{R}^d \quad \Rightarrow \quad \text{Rank } k \text{ receives } \left(\bigoplus_{j} x_j\right)\!\left[\frac{kd}{N}:\frac{(k+1)d}{N}\right]$$

**Cost (ring):**
- Latency: $(N-1)\alpha$
- Bandwidth: $\frac{N-1}{N} M \beta$

**Usage in distributed training:** FSDP uses ReduceScatter to aggregate and shard gradients. ZeRO-2 uses it instead of AllReduce to save gradient memory.

### 3.9 AllToAll

**Definition.** Each rank holds $N$ chunks (one per destination). Each chunk $j$ on rank $k$ is sent to rank $j$:

$$\text{Rank } k \text{ sends chunk}_{k \to j} \text{ to rank } j, \quad \forall j \in \{0, \ldots, N-1\}$$

This is the most general collective -- it is a full personalized exchange.

**Cost:**
- Latency: $(N-1)\alpha$
- Bandwidth: $\frac{N-1}{N} M \beta$

**Usage in distributed training:** AllToAll is used in Mixture-of-Experts (MoE) models to route tokens to the appropriate expert on each device, and in some sequence parallelism schemes.

### 3.10 Summary of Communication Costs

For $N$ ranks, data size $M$ (input on each rank for reduce-like operations, or total for scatter-like operations), using ring algorithms:

| Collective | Latency | Bandwidth (per rank) | Data flow |
|---|---|---|---|
| Broadcast | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | 1-to-all (same data) |
| Reduce | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | All-to-1 (combine) |
| Scatter | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | 1-to-all (different data) |
| Gather | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | All-to-1 (concatenate) |
| AllGather | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | All-to-all (replicate) |
| ReduceScatter | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | All-to-all (combine + shard) |
| AllReduce | $2(N-1)\alpha$ | $2\frac{N-1}{N}M\beta$ | = ReduceScatter + AllGather |
| AllToAll | $(N-1)\alpha$ | $\frac{N-1}{N}M\beta$ | Personalized exchange |

**Observation.** For large messages (bandwidth-dominated regime), all single-phase collectives have the same asymptotic bandwidth cost of $\approx M\beta$ per rank. AllReduce costs $\approx 2M\beta$ because it is a composition of two single-phase collectives.

---

## 4. NCCL: The NVIDIA Collective Communication Library

### 4.1 Architecture Overview

NCCL (pronounced "nickel") is the de facto standard for GPU-to-GPU collective communication. Key architectural features:

1. **Topology detection**: NCCL auto-detects the GPU interconnect topology (NVLink, PCIe, InfiniBand) and selects optimal algorithms.
2. **Channel parallelism**: NCCL splits data across multiple "channels" (independent communication paths) to saturate available bandwidth.
3. **Kernel-based communication**: Communication is implemented as GPU kernels that directly read/write remote GPU memory via NVLink or RDMA, avoiding CPU involvement.

### 4.2 Protocols

NCCL uses three protocols depending on message size:

| Protocol | Description | Best for |
|---|---|---|
| **LL (Low Latency)** | 8-byte flag-based synchronization, no flow control. 4 bytes data + 4 bytes flag per element. | Messages < 8 KB |
| **LL128** | 128-byte cache-line based protocol, NVLS (NVLink SHARP)-aware. | Messages 8 KB -- 256 KB |
| **Simple** | Full buffered protocol with credit-based flow control. Maximum bandwidth utilization. | Messages > 256 KB |

**Performance implication:** For gradient AllReduce with large models, messages are in the "Simple" regime where NCCL achieves near-peak bandwidth. For small per-layer communications in tensor parallelism, the protocol selection matters more.

### 4.3 Ring and Tree Algorithms in NCCL

NCCL implements both ring and tree AllReduce and selects between them based on message size:

```
NCCL algorithm selection (simplified):
  if message_size < NCCL_TREE_THRESHOLD:
      use tree AllReduce (lower latency)
  else:
      use ring AllReduce (higher bandwidth)
```

The threshold is configurable via the `NCCL_ALGO` environment variable:
```bash
export NCCL_ALGO=Ring    # Force ring algorithm
export NCCL_ALGO=Tree    # Force tree algorithm
export NCCL_ALGO=Auto    # Let NCCL decide (default)
```

### 4.4 Channel Parallelism

NCCL uses multiple channels to parallelize communication. Each channel operates an independent ring (or tree), and the data is split across channels. With $C$ channels, each channel handles $M/C$ data, and the channels operate in parallel.

**Why multiple channels?**
- A single ring may not saturate all NVLink connections (e.g., 8 GPUs with NVLink mesh have $8 \times 4 = 32$ links, but a single ring uses only 2 links per GPU).
- Multiple channels use different subsets of links, increasing aggregate bandwidth.

**Typical configuration:** NCCL uses 2-8 channels for intra-node and 1-2 channels for inter-node communication.

### 4.5 NCCL Environment Variables for Tuning

```bash
# Number of channels
export NCCL_MIN_NCHANNELS=4
export NCCL_MAX_NCHANNELS=8

# Buffer size per channel
export NCCL_BUFFSIZE=8388608    # 8MB buffer

# Network interface selection
export NCCL_SOCKET_IFNAME=eth0
export NCCL_IB_HCA=mlx5_0      # InfiniBand HCA selection

# Debugging and profiling
export NCCL_DEBUG=INFO          # Logging level
export NCCL_DEBUG_SUBSYS=ALL    # Which subsystems to log

# Algorithm and protocol forcing
export NCCL_ALGO=Ring
export NCCL_PROTO=Simple
```

---

## 5. Network Topologies for GPU Clusters

### 5.1 Intra-Node: NVLink

**NVLink** is NVIDIA's high-bandwidth GPU-to-GPU interconnect. Each NVLink connection (4th gen, H100) provides 50 GB/s per direction (100 GB/s bidirectional). Each GPU has 18 NVLink connections.

**Topology variants:**

**Full mesh (with NVSwitch):** Every GPU can communicate directly with every other GPU at full NVLink bandwidth. The DGX H100 has 4 NVSwitch chips connecting 8 H100 GPUs, providing $8 \times 900 = 7200$ GB/s bisection bandwidth.

```
GPU Topology (DGX H100 with NVSwitch):

   GPU0 --- GPU1 --- GPU2 --- GPU3
    |   \  / |   \  / |   \  / |
    |    \/  |    \/  |    \/  |
    |    /\  |    /\  |    /\  |
    |   /  \ |   /  \ |   /  \ |
   GPU4 --- GPU5 --- GPU6 --- GPU7
                  |
           [NVSwitch x4]
           (all-to-all at 900 GB/s per GPU)
```

**Partial mesh (without NVSwitch, e.g., DGX-1 V100 or PCIe-based multi-GPU systems):** GPUs connected in a partial mesh via direct NVLink connections. Not all pairs have direct links; some paths require traversal through intermediate GPUs.

### 5.2 Inter-Node: InfiniBand

**InfiniBand** is the dominant high-performance networking fabric for GPU clusters. Key specifications:

| Generation | Per-port bandwidth | Ports per HCA | Common in |
|---|---|---|---|
| HDR (200 Gb/s) | 25 GB/s | 1-2 | A100 clusters |
| NDR (400 Gb/s) | 50 GB/s | 1-2 | H100 clusters |
| XDR (800 Gb/s) | 100 GB/s | 1-2 | GB200 clusters |

**Fat-tree topology.** Cluster-level InfiniBand networks use a fat-tree (Clos) topology with multiple switch tiers:

```
        [Core switches]
       /    |    |    \
      /     |    |     \
[Aggregation switches]
   / | \   / | \   / | \
 [Leaf switches]
  |||    |||    |||
 Nodes  Nodes  Nodes
```

**Bisection bandwidth.** A full fat-tree provides full bisection bandwidth: any $N/2$ nodes can communicate with the other $N/2$ nodes at full per-node bandwidth simultaneously. In practice, oversubscription ratios of 2:1 or 4:1 are common at higher tiers to reduce cost.

### 5.3 Inter-Node: RoCE (RDMA over Converged Ethernet)

RoCE v2 enables RDMA (Remote Direct Memory Access) over standard Ethernet. Advantages: lower cost than InfiniBand, uses commodity Ethernet switches. Disadvantages: congestion control is harder, tail latency is higher, and bandwidth is typically lower (100-400 Gb/s).

**Key difference from InfiniBand:** RoCE relies on Priority Flow Control (PFC) and DCQCN for congestion management, while InfiniBand has hardware-based credit-based flow control. Under heavy load (as in distributed training), InfiniBand typically provides more consistent performance.

### 5.4 Multi-Rail Networking

Large GPU servers (like DGX H100) have multiple network interfaces (NICs) connected to different GPUs:

```
DGX H100 networking:
GPU0,1 <-> NIC0 (400 Gb/s InfiniBand)
GPU2,3 <-> NIC1 (400 Gb/s InfiniBand)
GPU4,5 <-> NIC2 (400 Gb/s InfiniBand)
GPU6,7 <-> NIC3 (400 Gb/s InfiniBand)

Total inter-node bandwidth: 4 x 400 Gb/s = 1600 Gb/s = 200 GB/s
```

NCCL exploits multi-rail by assigning different channels to different NICs, achieving aggregate bandwidth across all rails.

---

## 6. Communication Cost Modeling

### 6.1 The Alpha-Beta Model

The time to send a message of size $m$ bytes between two directly connected devices is modeled as:

$$T(m) = \alpha + m \cdot \beta$$

where:
- $\alpha$ is the startup latency (time to initiate the transfer)
- $\beta$ is the inverse bandwidth ($1/\text{BW}$, seconds per byte)

For GPU communication, $\alpha$ is dominated by kernel launch overhead ($\sim 5$-$15$ us on GPU) and $\beta$ depends on the interconnect tier.

### 6.2 Hierarchical Communication Model

For a multi-tier cluster, we model communication with different $(\alpha, \beta)$ pairs at each level:

$$T_{\text{total}} = \sum_{\text{tier} \in \{\text{NVLink, IB}\}} n_{\text{steps}}^{(\text{tier})} \cdot \alpha^{(\text{tier})} + m^{(\text{tier})} \cdot \beta^{(\text{tier})}$$

**Example values (H100 cluster):**

| Tier | $\alpha$ | $\beta$ (per byte, per direction) |
|---|---|---|
| NVLink (intra-node) | 5 us | $1/(900 \times 10^9)$ s/B $\approx 1.11$ ns/B |
| InfiniBand NDR (inter-node) | 2 us | $1/(50 \times 10^9)$ s/B = 20 ns/B |

### 6.3 Modeling Megatron-LM Communication

Consider a Megatron-LM setup with TP=8 (intra-node), PP=8 (inter-node), DP=8 (inter-node).

**Tensor parallelism communication (per layer):**
- 2 AllReduce of size $bsd$ each (forward), 2 more (backward)
- $bsd$ for $b=4, s=2048, d=4096$: $bsd \times 2 = 4 \times 2048 \times 4096 \times 2 = 67\text{MB}$
- AllReduce over 8 GPUs via NVLink: $T = 2 \times 7 \times 5\text{us} + 2 \times \frac{7}{8} \times 67\text{MB} \times 1.11\text{ns/B}$
- $= 70\text{us} + 130\text{us} \approx 200\text{us}$ per AllReduce
- Per layer (4 AllReduce in fwd+bwd): $\approx 0.8\text{ms}$

**Pipeline parallelism communication (per micro-batch):**
- Point-to-point send of activation tensor $bsd$: $67\text{MB}$
- Over InfiniBand: $T = 2\text{us} + 67\text{MB} \times 20\text{ns/B} = 2\text{us} + 1.34\text{ms} \approx 1.34\text{ms}$

**Data parallelism communication (per step):**
- AllReduce of gradient shard: total params / (TP $\times$ PP) = $P/(8 \times 8) = P/64$ params
- For 175B params: $175\text{B}/64 \times 2\text{B/param} = 5.47\text{GB}$
- Over InfiniBand, 8 nodes: $T = 2 \times 7 \times 2\text{us} + 2 \times \frac{7}{8} \times 5.47\text{GB} \times 20\text{ns/B}$
- $= 28\text{us} + 191\text{ms} \approx 191\text{ms}$

### 6.4 Identifying Communication Bottlenecks

Given the per-step breakdown:
- TP communication per layer: 0.8 ms (overlaps partially with compute)
- PP communication per micro-batch: 1.34 ms (serial, adds to pipeline latency)
- DP communication per step: 191 ms (can overlap with backward pass)
- Computation per step (est.): 500-1000 ms

The DP AllReduce (191 ms) is the largest single communication, but it can be overlapped with the backward pass. The TP AllReduces are on the fast NVLink path. The PP point-to-point transfers contribute to pipeline latency.

**Diagnostic rule of thumb:**
- If $T_{\text{comm}}^{(\text{exposed})} < 0.1 \times T_{\text{comp}}$: compute-bound (ideal)
- If $0.1 \times T_{\text{comp}} < T_{\text{comm}}^{(\text{exposed})} < T_{\text{comp}}$: communication is significant, optimize overlap
- If $T_{\text{comm}}^{(\text{exposed})} > T_{\text{comp}}$: communication-bound, consider reducing parallelism or improving interconnect

---

## 7. Advanced Communication Optimization

### 7.1 Hierarchical AllReduce

When the cluster has a two-level hierarchy (fast intra-node, slow inter-node), hierarchical AllReduce is more efficient than a flat ring:

1. **Intra-node Reduce**: Each node reduces its $G_{\text{node}}$ GPUs' data to one representative (using fast NVLink). Cost: $(G_{\text{node}}-1)\alpha_{\text{NV}} + \frac{G_{\text{node}}-1}{G_{\text{node}}} M \beta_{\text{NV}}$.

2. **Inter-node AllReduce**: The representatives perform AllReduce across nodes (using InfiniBand). Cost: $2(N_{\text{nodes}}-1)\alpha_{\text{IB}} + 2\frac{N_{\text{nodes}}-1}{N_{\text{nodes}}} M \beta_{\text{IB}}$.

3. **Intra-node Broadcast**: Each representative broadcasts the result to its node. Cost: same as step 1.

**Total:**
$$T_{\text{hier}} = 2(G_{\text{node}}-1)\alpha_{\text{NV}} + 2\frac{G_{\text{node}}-1}{G_{\text{node}}} M \beta_{\text{NV}} + 2(N_{\text{nodes}}-1)\alpha_{\text{IB}} + 2\frac{N_{\text{nodes}}-1}{N_{\text{nodes}}} M \beta_{\text{IB}}$$

Compared to a flat ring over all $N = G_{\text{node}} \times N_{\text{nodes}}$ GPUs, which would use the slow inter-node links for the entire ring, hierarchical AllReduce keeps most data movement on fast NVLink.

### 7.2 In-Network Reduction (SHARP)

**Mellanox SHARP** (Scalable Hierarchical Aggregation and Reduction Protocol) performs reduction operations *inside the network switches*, eliminating the need for data to traverse the full network.

In a fat-tree with SHARP:
1. Data flows up the tree, being reduced at each switch level.
2. The result flows back down.
3. Total latency: $O(\log N)$ switch hops.
4. Network traffic: reduced by $2\times$ (no separate broadcast phase).

**NCCL SHARP integration:**
```bash
export NCCL_NET_GDR_LEVEL=5     # Enable GPUDirect RDMA
export NCCL_SHARP_DISABLE=0      # Enable SHARP
export NCCL_COLLNET_ENABLE=1     # Enable collective network
```

### 7.3 GPUDirect Technologies

| Technology | Description | Benefit |
|---|---|---|
| GPUDirect P2P | Direct GPU-to-GPU transfers via NVLink/PCIe, bypassing CPU | Eliminates CPU bounce buffer |
| GPUDirect RDMA | NIC reads/writes GPU memory directly | Eliminates CPU copy for network transfers |
| GPUDirect Storage | NVMe directly to GPU memory | For checkpoint loading/saving |

Without GPUDirect RDMA, an inter-node GPU transfer requires: GPU $\to$ CPU (PCIe) $\to$ NIC $\to$ network $\to$ NIC $\to$ CPU (PCIe) $\to$ GPU. With GPUDirect RDMA: GPU $\to$ NIC $\to$ network $\to$ NIC $\to$ GPU, eliminating two PCIe copies.

---

## 8. Putting It All Together: Communication-Aware System Design

### 8.1 Design Principles

1. **Match parallelism to topology:** Use TP within NVLink domains (highest bandwidth), PP across nearby nodes, DP across the full cluster.

2. **Minimize cross-domain communication volume:** TP communicates activation-sized tensors; PP communicates activation-sized tensors at stage boundaries; DP communicates gradient-sized tensors. If $M_{\text{params}} \gg M_{\text{activations}}$, put DP on the fast link.

3. **Maximize overlap:** Launch communication as early as possible. Use bucketing (DDP), prefetching (FSDP), and asynchronous communication to hide latency behind computation.

4. **Respect the bandwidth hierarchy:** A 175B model trained on 512 H100s might use: TP=8 (NVLink, 900 GB/s), PP=8 (InfiniBand, 50 GB/s per rail), DP=8 (InfiniBand, 50 GB/s per rail). TP generates frequent small AllReduces that need low latency; PP generates infrequent point-to-point transfers; DP generates one large AllReduce per step that needs high bandwidth.

### 8.2 Communication Profiling

Use NCCL's built-in profiling and PyTorch's profiler to measure actual communication performance:

```python
import torch
from torch.profiler import profile, ProfilerActivity

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=torch.profiler.schedule(wait=1, warmup=1, active=3),
    on_trace_ready=torch.profiler.tensorboard_trace_handler('./log'),
    record_shapes=True,
    with_stack=True,
) as prof:
    for step, (data, target) in enumerate(dataloader):
        train_step(model, data, target, optimizer)
        prof.step()
```

NCCL operations appear as `ncclAllReduce`, `ncclReduceScatter`, `ncclAllGather` in the trace, with per-operation timing and data sizes.

---

## Key Takeaways

1. All distributed training communication reduces to a small set of collective primitives (broadcast, reduce, scatter, gather, allgather, reduce-scatter, allreduce, alltoall). Each has well-understood bandwidth and latency costs under ring/tree algorithms.

2. NCCL is the production-grade implementation for GPU collectives. It auto-selects algorithms and protocols based on message size and topology, uses channel parallelism to saturate interconnects, and integrates with GPUDirect for zero-copy transfers.

3. Modern GPU clusters have a 10-20x bandwidth gap between intra-node (NVLink) and inter-node (InfiniBand) communication. This hierarchy dictates parallelism placement: TP on NVLink, PP and DP on InfiniBand.

4. Communication cost can be modeled with the alpha-beta model at each level of the hierarchy. For large-model training, the bandwidth term dominates, and the key metric is the computation-to-communication ratio.

5. Advanced optimizations (hierarchical AllReduce, in-network reduction with SHARP, GPUDirect RDMA) can significantly reduce communication overhead but require hardware support and careful configuration.

---

## Further Reading

1. **NVIDIA.** (2023). *NCCL Documentation.* https://docs.nvidia.com/deeplearning/nccl/
   - Official NCCL documentation covering API, environment variables, and tuning.

2. **Thakur, R., Rabenseifner, R., & Gropp, W.** (2005). *Optimization of Collective Communication Operations in MPICH.* International Journal of High Performance Computing Applications, 19(1), 49-66.
   - Classical analysis of collective algorithms with bandwidth and latency models.

3. **Graham, R. L., Bureddy, D., Lui, P., Roesler, H., Mora, G., Mellanox, M., & Shainer, G.** (2016). *Scalable Hierarchical Aggregation Protocol (SHARP): A Hardware Architecture for Efficient Data Reduction.* COM-HPC 2016.
   - In-network computation for collective operations.

4. **NVIDIA.** (2024). *DGX H100 System Architecture White Paper.*
   - Detailed NVLink, NVSwitch, and multi-rail networking architecture.

5. **Cai, Z., Liu, Z., Muralidharan, S., Wang, Q., & Catanzaro, B.** (2024). *Network Topology and Communication Optimization for Distributed Training.* MLSys 2024.
   - Modern analysis of communication patterns in large-scale training with multi-dimensional parallelism.

6. **Zhang, H., Zheng, Z., Xu, S., Dai, W., Ho, Q., Liang, X., Hu, Z., Wei, J., Xie, P., & Xing, E. P.** (2017). *Poseidon: An Efficient Communication Architecture for Distributed Deep Learning on GPU Clusters.* USENIX ATC 2017.
   - Communication scheduling and topology-aware optimization.
