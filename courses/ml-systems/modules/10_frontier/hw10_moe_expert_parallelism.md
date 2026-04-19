# Homework 10: Frontier Systems

**Estimated Time: ~25 hours**

**Prerequisites:** Lectures 10a (MoE Systems), 10b (Long-Context & RAG), 10c (Edge & TinyML), 10d (Agentic Systems)

---

## Overview

This homework has two parts spanning all four Module 10 lectures. Part A focuses on theoretical analysis of MoE systems, retrieval-augmented generation, edge deployment, and inference scaling. Part B focuses on implementing a sparse MoE layer, a RAG retrieval pipeline, an agentic loop with tool dispatch, and benchmarking their performance characteristics.

**Submission:** Submit a single PDF (Part A, typeset in LaTeX) and a code repository (Part B, with a README explaining how to run your experiments).

---

## Part A: Theory (50%)

### Problem A.1: Load Balancing Analysis (8%)

Consider a Mixture-of-Experts layer with $E = 8$ experts, top-$K = 2$ routing, and a batch of $T$ tokens.

**(a)** (2%) Define the load balancing loss:

$$\mathcal{L}_{\text{balance}} = \alpha \cdot E \sum_{i=1}^{E} f_i \cdot p_i$$

where $f_i = \frac{1}{T}\sum_{t=1}^{T} \mathbf{1}[i \in \text{TopK}(h(x_t))]$ and $p_i = \frac{1}{T}\sum_{t=1}^{T} \text{softmax}(h(x_t))_i$.

Show that $\sum_{i=1}^E f_i = K$ and $\sum_{i=1}^E p_i = 1$. Under these constraints, use the method of Lagrange multipliers to find the values of $f_i$ and $p_i$ that minimize $\sum_i f_i \cdot p_i$. What is the minimum value? What is $\mathcal{L}_{\text{balance}}$ at this minimum?

**(b)** (2%) The indicator function $\mathbf{1}[\cdot]$ in $f_i$ makes $\mathcal{L}_{\text{balance}}$ non-differentiable with respect to the router weights $W_g$. Explain precisely how the product form $f_i \cdot p_i$ provides a useful gradient signal through $p_i$ despite $f_i$ being non-differentiable. Write out $\frac{\partial \mathcal{L}_{\text{balance}}}{\partial W_g}$ explicitly, treating $f_i$ as a constant (stop-gradient) and differentiating through $p_i$ only.

**(c)** (2%) The router z-loss is defined as:

$$\mathcal{L}_z = \frac{1}{T}\sum_{t=1}^{T}\log^2\left(\sum_{i=1}^{E} \exp(h_i(x_t))\right)$$

where $h(x_t) = W_g x_t \in \mathbb{R}^E$. Compute $\frac{\partial \mathcal{L}_z}{\partial h_j(x_t)}$. Show that this gradient is proportional to $\text{softmax}(h(x_t))_j$ and explain intuitively why this penalizes experts with large logit magnitudes while primarily affecting the experts that already receive high routing probability.

**(d)** (2%) Consider a scenario where the load balancing coefficient $\alpha$ is set too high. Explain the effect on:

- The router's output distribution (what happens to the entropy of the routing probabilities?).
- The quality of the main task loss.
- The specialization of individual experts.

Derive a bound on $\alpha$ in terms of the main task loss gradient magnitude to ensure the balancing loss does not dominate training.

### Problem A.2: Communication Cost Analysis (8%)

Consider an MoE layer with $E$ experts distributed across $N$ devices using expert parallelism (EP), with $E/N$ experts per device. Each device processes $B_g$ tokens of dimension $d$ in BF16. Top-$K$ routing is used.

**(a)** (3%) Derive the all-to-all communication volume (in bytes) for the dispatch phase. Express your answer in terms of $B_g$, $K$, $d$, $N$, and the element size. Compare this with the communication volume of an AllReduce in data parallelism with the same number of devices, where each device has a gradient vector of size $P$ parameters in BF16.

**(b)** (2%) In the worst case (maximally imbalanced routing), what is the maximum number of tokens any single device must process? In the best case (perfectly balanced)? Express the ratio of worst-case to best-case compute time as a function of $E$, $K$, and $N$.

**(c)** (3%) For the following configuration: $E = 64$, $N = 8$, $B_g = 4096$, $K = 6$, $d = 4096$, BF16 format:

1. Compute the all-to-all communication volume per device (dispatch + combine).
2. Compute the expert compute time per device assuming perfect balance, with each expert being a SwiGLU FFN ($d_{\text{ff}} = 4d$) running on H100 at 50% MFU.
3. Compute the communication time assuming NVLink bandwidth of 450 GB/s bidirectional.
4. What is the communication-to-computation ratio? Is this configuration communication-bound or compute-bound?

### Problem A.3: Expert Capacity and Token Dropping (4%)

**(a)** (1%) Define the capacity factor $C_f$ and the expert capacity $C = C_f \cdot B_g K/E$. For $E = 8$, $K = 2$, $B_g = 2048$:

1. Compute $C$ for $C_f \in \{1.0, 1.25, 1.5, 2.0\}$.
2. If the routing follows a Zipf distribution with parameter $s = 1.0$ (i.e., expert $i$ receives a fraction of tokens proportional to $1/i^s$), compute the expected token drop rate for each $C_f$.

**(b)** (1%) When a token is dropped (its expert is at capacity), the standard approach passes it through unchanged via the residual connection. Analyze the gradient flow for dropped tokens:

1. What gradient does a dropped token receive from the main task loss?
2. What gradient does the router receive for routing that token to the overloaded expert?
3. Does the load balancing loss provide a corrective signal for this case? Explain.

**(c)** (2%) An alternative to token dropping is **auxiliary routing**: if expert $i$ is full, route the token to its second choice (for $K = 1$) or to its $(K+1)$-th choice (for $K > 1$). Analyze the computational tradeoffs:

1. What is the maximum additional compute per expert under auxiliary routing vs. token dropping?
2. What is the effect on load balance (does auxiliary routing improve or worsen it)?
3. Propose a hybrid strategy that limits the overhead of auxiliary routing while reducing the drop rate. Describe the algorithm in pseudocode.

### Problem A.4: Inference Scaling Analysis (4%)

**(a)** (2%) Consider a best-of-$N$ sampling strategy applied to an MoE model with $E = 8$ experts and $K = 2$ routing. Assume the per-sample pass rate on a given benchmark is $p = 0.25$.

1. Compute the best-of-$N$ pass rate $P_N = 1 - (1-p)^N$ for $N \in \{1, 4, 16, 64, 256\}$.
2. Compute the total FLOPs for each $N$ (express as a multiple of single-sample FLOPs).
3. The "compute-quality frontier" is the relationship between total FLOPs and pass rate. At what $N$ does the marginal return (additional pass rate per additional FLOP) drop below 0.001 per single-sample FLOP?

**(b)** (2%) Compare best-of-$N$ with tree search (branching factor $B_f = 4$, depth $D = 3$):

1. How many total generations does tree search require if every node is expanded? Express as $B_f + B_f^2 + \cdots + B_f^D$.
2. How many total generations does tree search require with pruning (keep only top-2 branches at each level)?
3. Under what assumptions about the reward model's accuracy is tree search more compute-efficient than best-of-$N$? Express the condition in terms of $p$, $B_f$, $D$, and the reward model's true positive rate.

### Problem A.5: MoE Memory Budget (6%)

Consider deploying a Mixtral-8x7B model ($E = 8$, $K = 2$, $L = 32$ MoE layers, $d = 4096$, $d_{\text{ff}} = 14336$, plus 4 attention heads per layer with $d_k = 128$) on a server with 4 x A100 80GB GPUs.

**(a)** (3%) Compute the following memory requirements:

1. Total model parameters (attention + MoE experts + embeddings).
2. Memory for model weights in BF16.
3. KV cache memory for batch size $B_g = 32$ and sequence length $S = 4096$ in BF16.
4. Peak activation memory during inference (estimate for a single forward pass).

Can this model serve at batch size 32, sequence length 4096 on 4 x A100 80GB? If not, what is the maximum batch size or sequence length achievable?

**(b)** (3%) Now consider expert offloading: only $C = 3$ experts (out of 8) are cached on GPU at any time, with the rest on CPU memory. For each MoE layer:

1. What is the GPU memory savings compared to keeping all experts on GPU?
2. What is the maximum PCIe transfer time to load one expert (assuming PCIe Gen4 x16 at 32 GB/s)?
3. If the expert cache hit rate is 85% (averaged over all layers and tokens), what fraction of MoE layer time is spent on expert loading vs. computation?
4. At what cache hit rate does expert offloading become slower than tensor parallelism across 4 GPUs (estimate the TP all-reduce overhead)?

### Problem A.6: RAG Retrieval Quality (10%)

**(a)** (5%) Consider a corpus of $N = 10{,}000{,}000$ vectors of dimension $d_e = 768$ indexed with an IVF index using $n_{\text{list}}$ Voronoi cells. Assume vectors are distributed uniformly across cells after k-means training.

1. Derive the recall@$k$ formula for the IVF index as a function of $n_{\text{probe}}$ and $n_{\text{list}}$. Start from the assumption that each query's true top-$k$ nearest neighbors are distributed across cells proportionally to the query's proximity to each centroid. Show that in the uniform case, the expected recall@$k$ is approximately $\min(1,\; n_{\text{probe}} / n_{\text{list}} \cdot \gamma)$ where $\gamma \geq 1$ is a concentration factor that depends on the data distribution.
2. For $n_{\text{list}} = 4096$ and $k = 10$, plot the expected recall@10 as a function of $n_{\text{probe}} \in \{1, 2, 4, 8, 16, 32, 64, 128, 256\}$, assuming $\gamma = 1$ (uniform) and $\gamma = 3$ (concentrated). At what $n_{\text{probe}}$ does the uniform case achieve recall@10 $\geq 0.95$?

**(b)** (5%) Now consider adding Product Quantization (PQ) compression. Each 768-dimensional vector is split into $m$ sub-vectors, each quantized to $b = 8$ bits using a codebook of $2^b = 256$ centroids per sub-quantizer.

1. Compute the compressed memory per vector (in bytes) for $m \in \{8, 16, 32, 48, 96\}$. Compare with the uncompressed FP32 size (3072 bytes).
2. Compute the total index memory for the full corpus ($N = 10\text{M}$) at each $m$, including the PQ codebooks (each codebook stores 256 centroids of dimension $d_e / m$ in FP32).
3. The distance computation for PQ uses asymmetric distance (ADC): the query is left uncompressed and distances are computed via lookup tables. Derive the number of additions and table lookups per distance computation as a function of $m$, and compare the compute cost with brute-force FP32 inner product.
4. Discuss qualitatively how reducing $m$ (fewer, larger sub-vectors) affects recall and why there is a sweet spot for a given $d_e$.

### Problem A.7: Edge Deployment Memory Budget (10%)

**(a)** (5%) You need to deploy a 1-billion-parameter decoder-only Transformer ($L = 24$, $d = 2048$, $h = 16$, $d_k = 128$, $V = 32{,}000$, SwiGLU FFN with $d_{\text{ff}} = 5504$) on a mobile device with 512 MB of available RAM. The model must support autoregressive generation.

1. Compute the total parameter count explicitly: embedding parameters, per-layer attention parameters ($W_Q, W_K, W_V, W_O$), per-layer FFN parameters ($W_1, W_2, W_3$ for SwiGLU), and the output projection (tied with embedding).
2. Compute the model weight memory under FP16, INT8, and INT4 quantization. Which formats fit within the 512 MB budget?
3. For the quantization format(s) that fit, compute the remaining memory budget available for the KV cache. Derive the maximum sequence length $S_{\max}$ the model can support if the KV cache uses INT8 quantization.
4. Now account for activation memory during inference (a single token's forward pass). Estimate the peak activation memory and recompute $S_{\max}$.

**(b)** (5%) Consider the tradeoffs between three quantization strategies for fitting this model on the 512 MB device:

- **Strategy 1**: Uniform INT4 quantization (all layers, per-channel scales in FP16).
- **Strategy 2**: Mixed-precision -- first layer, last layer, and attention projections in INT8; FFN layers in INT4.
- **Strategy 3**: INT4 weights with INT8 KV cache, plus 4-bit GPTQ quantization with group size 128.

For each strategy:

1. Compute the total weight memory, including quantization metadata (scales, zero-points). For GPTQ with group size $g = 128$, each group of 128 weights shares one FP16 scale and one INT4 zero-point.
2. Determine whether it fits in 512 MB with enough headroom for a 2048-token KV cache.
3. Discuss the expected accuracy implications, referencing the sensitivity analysis concepts from Lecture 10c (which layers are most sensitive to aggressive quantization and why).

---

## Part B: Implementation (50%)

### Problem B.1: Sparse MoE Layer (10%)

Implement a sparse MoE layer from scratch in PyTorch.

**(a)** (4%) Implement a `SparseMoELayer` class with:

- A configurable number of experts $E$, top-$K$ routing, and capacity factor $C_f$.
- Each expert is a SwiGLU FFN with dimensions $d \to d_{\text{ff}} \to d$.
- Top-$K$ softmax routing with renormalization.
- Token dropping when expert capacity is exceeded.

Your implementation must support the following interface:

```python
moe = SparseMoELayer(
    d_model=256,
    d_ff=512,
    num_experts=8,
    top_k=2,
    capacity_factor=1.25,
)
x = torch.randn(4, 128, 256)      # (B, S, d)
y, aux = moe(x)                    # y: (B, S, d), aux: dict with metrics
```

The `aux` dict must contain:
- `balance_loss`: the load balancing auxiliary loss.
- `z_loss`: the router z-loss.
- `expert_counts`: tensor of shape $(E,)$ with token counts per expert.
- `token_drop_rate`: fraction of (token, expert) assignments that were dropped.

**(b)** (3%) Implement expert utilization tracking and verification:

1. After each forward pass, record the number of tokens routed to each expert, the average gate value per expert, and the token drop rate.
2. Train the MoE layer as part of a simple 2-layer Transformer on a synthetic sequence classification task (e.g., classifying sequences of random tokens into 10 classes based on a hidden rule). Train for 1000 steps.
3. Plot the following over training:
   - Expert utilization (tokens per expert) -- should converge to balanced.
   - Load balancing loss -- should decrease.
   - Token drop rate -- should decrease as balancing improves.
   - Main task loss -- should decrease.

**(c)** (3%) Ablation study on the load balancing coefficient $\alpha$. Train the same model with $\alpha \in \{0, 0.001, 0.01, 0.1, 1.0\}$. For each:

1. Plot training loss, expert utilization entropy, and token drop rate.
2. Report final task accuracy and load imbalance ratio $\rho = \max_i f_i / \text{mean}_i f_i$.
3. Identify the optimal $\alpha$ and explain your choice. What happens at $\alpha = 0$ (no balancing) and $\alpha = 1.0$ (strong balancing)?

### Problem B.2: Expert Parallelism Simulation (8%)

Simulate expert parallelism across multiple "virtual devices" within a single GPU.

**(a)** (4%) Implement a `SimulatedEPMoELayer` that:

1. Partitions experts into $N_{\text{EP}}$ groups (simulating $N_{\text{EP}}$ devices).
2. Implements the dispatch step: sort tokens by destination device and create per-device buffers.
3. Implements the expert computation step: each "device" processes its local tokens with its local experts.
4. Implements the combine step: scatter results back to the originating positions.
5. Verifies that the output matches the non-distributed `SparseMoELayer` from B.1.

```python
sim_moe = SimulatedEPMoELayer(
    d_model=256, d_ff=512,
    num_experts=8, top_k=2,
    ep_size=4,               # Simulate 4 devices
    capacity_factor=1.25,
)
x = torch.randn(4, 128, 256)
y, aux = sim_moe(x)
# aux now also includes 'per_device_token_counts' and 'communication_volume_bytes'
```

**(b)** (4%) Benchmark the communication and computation costs:

1. Measure the time spent in dispatch (sorting + buffer creation), expert computation, and combine (un-sorting) separately.
2. Plot these times for $E \in \{4, 8, 16, 32, 64\}$ with $N_{\text{EP}} \in \{1, 2, 4, 8\}$ and $B_g = 2048$ tokens.
3. Compute the communication volume (bytes) for each configuration and compare with the theoretical formula from A.2.
4. At what $E / N_{\text{EP}}$ ratio does the dispatch overhead become negligible (<5% of total time)?

### Problem B.3: MoE Inference with Expert Caching (7%)

Implement an expert caching system for MoE inference.

**(a)** (3%) Implement an `ExpertCache` class with LRU eviction:

```python
class ExpertCache:
    """
    LRU cache for expert weights.

    Simulates a GPU with limited memory that can hold
    only `cache_size` experts at a time. Remaining experts
    are stored in "CPU memory" (actually just a separate dict).
    """
    def __init__(self, num_experts: int, cache_size: int):
        ...

    def get_expert(self, expert_id: int) -> tuple[nn.Module, bool]:
        """
        Get an expert. Returns (expert, cache_hit).
        If cache miss, loads from "CPU" and evicts LRU if needed.
        """
        ...

    def prefetch(self, expert_ids: list[int]):
        """Asynchronously load experts into cache."""
        ...

    @property
    def hit_rate(self) -> float:
        """Running cache hit rate."""
        ...
```

**(b)** (2%) Build a full MoE inference pipeline that uses the expert cache:

1. For each layer, compute routing decisions.
2. Load required experts from the cache (tracking hits and misses).
3. Compute the expert FFNs.
4. Combine results.

Run inference on random input sequences of length 512, 1024, and 2048 with $E = 16$ experts and cache sizes $C \in \{2, 4, 8, 12, 16\}$. For each:
- Report the cache hit rate.
- Report the simulated latency (assuming 3 ms per expert load from "CPU" and 0.5 ms per expert computation).
- Compare with full-cache (all experts on GPU) baseline latency.

**(c)** (2%) Analyze routing locality:

1. Record the sequence of expert IDs accessed across all layers for a batch of 32 sequences.
2. Compute the "working set size" at each layer: how many unique experts are accessed?
3. Plot the working set size distribution across layers. Do later layers have smaller working sets (suggesting more specialized routing)?
4. Implement a prefetching strategy: when processing layer $\ell$, prefetch experts needed by layer $\ell + 1$ (determined by running the router for layer $\ell + 1$ on the current activations). Measure the impact on effective hit rate and simulated latency.

### Problem B.4: Comparative Benchmarking (5%)

**(a)** (3%) Build a dense-equivalent model with the same per-token FLOPs as your MoE model (same attention layers, but a single large FFN replacing the MoE). Train both models on the same synthetic task for 2000 steps with the same optimizer settings. Compare:

1. Final task accuracy.
2. Training throughput (tokens/second).
3. Total parameter count.
4. Peak memory usage.

Present results in a table and discuss whether MoE provides better accuracy-efficiency tradeoffs than the dense baseline.

**(b)** (2%) Using the benchmarking tools from Recitation 10, produce a comprehensive performance report for your MoE layer:

1. Throughput vs. batch size (for batch sizes 1, 4, 16, 64, 256).
2. Latency breakdown: routing, dispatch, expert compute, combine (as a stacked bar chart).
3. Memory usage vs. number of experts (for $E \in \{4, 8, 16, 32\}$).
4. Scaling: throughput vs. number of experts at fixed per-token compute (adjust $d_{\text{ff}}$ proportionally as $E$ increases so that $K \cdot d_{\text{ff}} / E$ is constant).

Include proper warm-up, multiple runs with confidence intervals, and follow the benchmarking checklist from Recitation 10.

### Problem B.5: RAG Pipeline with FAISS (10%)

Implement a simple retrieval-augmented generation pipeline and measure retrieval latency vs. accuracy tradeoffs across index types.

**(a)** (4%) Implement a `RAGBenchmark` class that:

1. Generates a synthetic corpus of $N = 100{,}000$ documents (random embeddings of dimension $d_e = 768$, L2-normalized). Alongside, generate 1000 query embeddings with known ground-truth top-10 nearest neighbors (computed via brute-force exact search).
2. Builds FAISS indices of the following types:
   - `IndexFlatIP` (exact brute-force baseline)
   - `IndexIVFFlat` with $n_{\text{list}} = 256$
   - `IndexIVFPQ` with $n_{\text{list}} = 256$, $m = 48$ sub-quantizers, 8 bits each
   - `IndexHNSWFlat` with $M = 32$
3. For each index, measures:
   - Build time (seconds)
   - Index memory (bytes)
   - Average query latency over 1000 queries (milliseconds)
   - Recall@10 against the brute-force ground truth

```python
class RAGBenchmark:
    def __init__(self, n_docs: int = 100_000, dim: int = 768, n_queries: int = 1000):
        ...

    def build_index(self, index_type: str, **kwargs) -> dict:
        """Build an index and return timing + memory stats."""
        ...

    def evaluate(self, index_type: str, nprobe_values: list[int] = None) -> dict:
        """Measure recall@10 and latency for a given index."""
        ...

    def sweep_nprobe(self, nprobe_values: list[int]) -> pd.DataFrame:
        """For IVF indices, sweep nprobe and record recall vs latency."""
        ...
```

**(b)** (3%) For the `IndexIVFFlat` index, sweep $n_{\text{probe}} \in \{1, 2, 4, 8, 16, 32, 64, 128, 256\}$ and produce:

1. A recall@10 vs. latency Pareto plot comparing all four index types (IVF points form a curve as $n_{\text{probe}}$ varies; HNSW and Flat are single points).
2. A table showing the memory-accuracy tradeoff: index memory vs. recall@10 at the $n_{\text{probe}}$ that achieves recall@10 $\geq 0.95$.
3. Identify the optimal index type and $n_{\text{probe}}$ for a latency budget of 1 ms and a recall requirement of 0.90.

**(c)** (3%) Integrate the retrieval index into a minimal end-to-end RAG pipeline:

1. Implement a `retrieve_and_format` function that takes a query string, embeds it (using a mock embedding function that returns random vectors), retrieves the top-$k$ chunks, and formats them into a prompt string.
2. Measure the end-to-end latency breakdown: embedding time, retrieval time, and prompt construction time. Plot as a stacked bar chart for each index type.
3. Discuss how you would extend this pipeline to support incremental index updates (inserting new documents without full re-indexing) and what constraints this places on the choice of index type.

### Problem B.6: Agentic Loop with Tool Dispatch (10%)

Implement a basic agentic loop with tool dispatch and measure the overhead of KV cache management across multi-turn conversations.

**(a)** (4%) Implement an `AgentLoop` class that:

1. Maintains a conversation history as a growing list of messages (system, user, assistant, tool_result).
2. Dispatches tool calls to registered tool functions. Implement at least three mock tools: `calculator(expression: str) -> str`, `lookup(key: str) -> str` (returns from a predefined dictionary), and `summarize(text: str) -> str` (returns a truncated version).
3. Parses structured tool calls from the assistant's output (use a simple JSON format).
4. Implements guardrails: maximum turns (20), maximum total tokens (50,000), and loop detection (same tool called with same arguments 3+ times).

```python
class AgentLoop:
    def __init__(self, generate_fn: Callable, tools: dict[str, Callable],
                 max_turns: int = 20, max_tokens: int = 50_000):
        ...

    def register_tool(self, name: str, fn: Callable, description: str):
        ...

    def run(self, user_query: str) -> dict:
        """
        Run the agent loop until final answer or guardrail hit.
        Returns dict with 'answer', 'turns', 'total_tokens',
        'tool_calls', 'termination_reason'.
        """
        ...
```

**(b)** (3%) Simulate KV cache overhead for multi-turn conversations:

1. Implement a `KVCacheSimulator` that tracks the token count at each turn, computes the KV cache memory (using the formula $M_{\text{KV}} = 2LdS \cdot \text{sizeof(dtype)}$ with configurable $L$, $d$, and dtype), and reports cumulative prefill FLOPs.
2. Run the agent loop for 10 simulated conversations of varying length (5, 10, 15, 20 turns), where each turn adds between 100-500 tokens of context.
3. Plot:
   - KV cache memory vs. turn number for a 7B-class model ($L = 32$, $d = 4096$, BF16).
   - Cumulative prefill FLOPs with and without prompt caching (with prompt caching, only new tokens require prefill; without it, the full context is re-prefilled each turn).
   - The ratio of prefill FLOPs saved by prompt caching as a function of turn number.

**(c)** (3%) Measure the overhead of the agentic orchestration layer:

1. Instrument your `AgentLoop` to measure wall-clock time spent in: tool argument parsing, tool execution, result formatting, guardrail checks, and context assembly (concatenating messages).
2. Run 100 simulated conversations (use a mock `generate_fn` that returns predefined tool calls for the first $N-1$ turns and a final answer on turn $N$, with configurable $N$).
3. Plot the orchestration overhead as a fraction of total loop time for $N \in \{2, 5, 10, 15, 20\}$ turns. At what turn count does orchestration overhead become negligible (<5% of total time)? Discuss how this changes if tool execution latency varies (simulate tools with latencies of 1 ms, 10 ms, 100 ms, and 1 s).

---

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A.1 Load balancing | 8 | Correct optimization, gradient analysis, coefficient analysis |
| A.2 Communication cost | 8 | Accurate derivations, numerical examples |
| A.3 Capacity and dropping | 4 | Zipf analysis, gradient flow, hybrid strategy |
| A.4 Inference scaling | 4 | Best-of-N analysis, tree search comparison |
| A.5 Memory budget | 6 | Accurate memory accounting, offloading analysis |
| A.6 RAG retrieval quality | 10 | IVF recall derivation, PQ compression analysis |
| A.7 Edge deployment budget | 10 | Quantization memory accounting, strategy comparison |
| B.1 MoE implementation | 10 | Working code, training dynamics, ablation |
| B.2 Expert parallelism sim | 8 | Correct dispatch/combine, benchmarks |
| B.3 Expert caching | 7 | LRU cache, locality analysis, prefetching |
| B.4 Benchmarking | 5 | Dense vs MoE comparison, comprehensive report |
| B.5 RAG pipeline | 10 | FAISS index comparison, recall-latency Pareto, end-to-end pipeline |
| B.6 Agentic loop | 10 | Tool dispatch, KV cache simulation, orchestration overhead |

**Total: 100 points**

---

## Submission Checklist

- [ ] Part A: LaTeX-typeset PDF with all derivations, proofs, and numerical results
- [ ] Part B: Code repository with:
  - [ ] `moe.py`: `SparseMoELayer` and `TopKRouter` implementations
  - [ ] `ep_simulation.py`: `SimulatedEPMoELayer` implementation
  - [ ] `expert_cache.py`: `ExpertCache` and caching inference pipeline
  - [ ] `train_moe.py`: Training script for MoE and dense baselines
  - [ ] `benchmark_moe.py`: Benchmarking script with comprehensive evaluation
  - [ ] `rag_pipeline.py`: `RAGBenchmark` and FAISS index evaluation
  - [ ] `agent_loop.py`: `AgentLoop`, `KVCacheSimulator`, and tool dispatch
  - [ ] `plots/`: All generated plots (expert utilization, ablation, benchmarks, recall-latency Pareto, KV cache growth, orchestration overhead)
  - [ ] `README.md`: Instructions for reproducing all results
- [ ] All plots referenced in the problems
- [ ] Benchmark results JSON files

---

## Hints

1. **Problem A.1d**: Think about the effective gradient as a weighted sum of the task gradient and the balancing gradient. When does the balancing gradient dominate? The answer depends on the relative magnitudes $\|\nabla_\theta \mathcal{L}_{\text{task}}\|$ and $\alpha \|\nabla_\theta \mathcal{L}_{\text{balance}}\|$.

2. **Problem A.2c**: For the expert compute time, note that each device processes $B_g \cdot K / N = 4096 \times 6 / 8 = 3072$ tokens under perfect balance. Each token requires forward through one SwiGLU FFN ($3 \times 2 \times d \times d_{\text{ff}}$ FLOPs).

3. **Problem A.6b**: Remember that PQ codebooks are small relative to the compressed vectors. For $m$ sub-quantizers with 256 centroids each, the codebook size is $m \times 256 \times (d_e / m) \times 4$ bytes $= 256 \times d_e \times 4$ bytes, independent of $m$. The per-vector cost dominates for large $N$.

4. **Problem A.7a**: For SwiGLU, the FFN has three weight matrices ($W_1$, $W_3$ of size $d_{\text{ff}} \times d$, and $W_2$ of size $d \times d_{\text{ff}}$), so the per-layer FFN parameter count is $3 \times d \times d_{\text{ff}}$. Do not forget the embedding matrix and any layer norm parameters.

5. **Problem B.1**: Use `torch.scatter_add_` and `torch.gather` for efficient token dispatching. Avoid Python loops over experts in the inner loop; instead, sort tokens by expert index and use grouped operations.

6. **Problem B.2**: The dispatch and combine operations can be implemented as permutations. Use `torch.argsort` to compute the permutation and its inverse.

7. **Problem B.3**: For the prefetching strategy, note that you can run the router for layer $\ell + 1$ using the *pre-FFN* activations (after attention but before the MoE). This gives you the routing decisions before the current MoE computation finishes.

8. **Problem B.4**: When building the dense equivalent, match per-token FLOPs, not total parameters. An MoE with $E = 8$, $K = 2$ experts of size $d_{\text{ff}} = 512$ has per-token FFN FLOPs of $2 \times 3 \times 256 \times 512 = 786K$. The dense equivalent should have $d_{\text{ff}} = 512$ (same per-token FLOPs) but only 1 FFN instead of 8.

9. **Problem B.5**: Use `faiss.index_factory` for concise index construction. To measure index memory, use `faiss.serialize_index` and check the size of the resulting byte array.

10. **Problem B.6b**: The key insight for prompt caching savings is that cumulative prefill FLOPs without caching grow as $\sum_{t=1}^{T} 4 S_t^2 d$ (quadratic in context length at each turn), while with caching they grow as $\sum_{t=1}^{T} 4 \Delta S_t \cdot S_t \cdot d$ (only new tokens attend to the full context).
