# Homework 07: LLM Serving Engine with Continuous Batching

**Estimated time**: ~25 hours
**Due date**: See course calendar
**Submission**: C++ source code with CMake build, CUDA kernels, benchmark scripts, and a brief PDF report (max 6 pages).

---

## Overview

In this assignment, you will derive key performance properties of LLM serving systems (Part A), then build a simplified but functional LLM serving engine **in C++** with a CUDA paged attention kernel, continuous batching scheduler, and HTTP API from scratch (Part B).

This is a systems assignment. The scheduler, memory manager, and request lifecycle are all C++. The attention kernel that gathers from non-contiguous KV cache blocks is CUDA C++. A thin Python client is used only for sending requests and plotting benchmarks.

**Rules:**

- You may NOT use vLLM, TGI, TensorRT-LLM, SGLang, or any existing serving framework in Part B.
- You MAY use libtorch (PyTorch C++ API) for model loading and tensor operations.
- You MAY use a lightweight HTTP library (e.g., cpp-httplib, Crow, or Boost.Beast) for the server endpoint.
- All scheduling, batching, and memory management code must be your own C++.

---

## Part A: Theory (50 points)

### Problem A.1: Continuous Batching Throughput Analysis (10 points)

Consider an LLM serving system with continuous batching. Requests arrive as a Poisson process with rate $\lambda$ (requests/second). Each request has a prompt of length $P$ (fixed) and generates $G \sim \text{Geometric}(p)$ output tokens (mean $1/p$).

**(a)** (3 points) Let $t_{\text{step}}(B)$ be the time for one decode step with $B$ active sequences. Assuming the decode step is memory-bandwidth-bound:

$$t_{\text{step}}(B) = \frac{2N \cdot \text{sizeof(dtype)} + B \cdot S_{\text{avg}} \cdot C_{\text{kv}}}{\text{BW}_{\text{mem}}}$$

where $N$ is the number of model parameters, $S_{\text{avg}}$ is the average sequence length of active sequences, $C_{\text{kv}}$ is the KV cache bytes per token, and $\text{BW}_{\text{mem}}$ is the memory bandwidth.

Derive the steady-state throughput (tokens/second) as a function of the steady-state batch size $\bar{B}$. Under what condition is the system stable (i.e., the queue does not grow unboundedly)?

**(b)** (3 points) For a model with $N = 7 \times 10^9$ parameters in FP16 on an A100 (BW = 2 TB/s), $C_{\text{kv}} = 512$ KB/token, mean output length $1/p = 200$ tokens, and prompt length $P = 256$:

Compute the maximum sustainable request rate $\lambda_{\max}$ assuming a maximum batch size of $B_{\max} = 32$. What is the average sequence length $S_{\text{avg}}$ in steady state?

**(c)** (4 points) Compare the throughput of continuous batching versus static batching for the same system. For static batching, derive the throughput under the assumption that a batch of $B$ requests is formed, and the batch completes when the longest sequence finishes.

Let $G_1, \ldots, G_B$ be i.i.d. $\text{Geometric}(p)$ random variables. Show that:

$$\mathbb{E}\left[\max_{i} G_i\right] = \sum_{k=1}^{\infty} \left(1 - (1 - (1-p)^k)^B\right)$$

and derive an asymptotic approximation for large $B$. Compute the throughput ratio $\text{Throughput}_{\text{continuous}} / \text{Throughput}_{\text{static}}$ for $B = 32$ and $p = 1/200$.

### Problem A.2: PagedAttention Fragmentation Analysis (10 points)

**(a)** (4 points) Consider a KV cache memory pool with $M$ blocks of size $B_s$ tokens each. Requests arrive with sequence lengths drawn from a distribution $F$. Derive the expected steady-state memory utilization:

$$U = \frac{\mathbb{E}[\text{blocks occupied per sequence}] \times \bar{B}}{\min(M, \; \mathbb{E}[\text{blocks per seq}] \times \bar{B})}$$

Express $\mathbb{E}[\text{blocks occupied per sequence}]$ in terms of $\mathbb{E}[S]$ and $B_s$, accounting for internal fragmentation. Show that the internal fragmentation waste is:

$$W_{\text{internal}} = \frac{B_s - 1}{2 \cdot \mathbb{E}[S]}$$

as a fraction of allocated memory, assuming $S$ is uniformly distributed modulo $B_s$.

**(b)** (3 points) For the naive contiguous allocation scheme, derive the probability that a new request with sequence length $S$ cannot be allocated, given that $k$ existing sequences of various lengths are present. Model the free memory as a set of contiguous segments. Show that even when the total free memory exceeds $S$, the allocation can fail due to external fragmentation, and bound the probability of this event using the distribution of gap sizes.

**(c)** (3 points) Determine the optimal block size $B_s$ that minimizes total memory waste (internal fragmentation + block metadata overhead). Each block requires $H$ bytes of metadata (block table entry, reference count, etc.). The total overhead per sequence with $\lceil S / B_s \rceil$ blocks is:

$$\text{Overhead}(B_s) = \underbrace{\frac{(B_s - 1) \cdot C_{\text{kv}}}{2}}_{\text{internal fragmentation}} + \underbrace{\left\lceil \frac{S}{B_s} \right\rceil \cdot H}_{\text{metadata}}$$

Find the $B_s$ that minimizes $\text{Overhead}(B_s)$ in expectation. Evaluate for $C_{\text{kv}} = 512$ bytes/token, $H = 64$ bytes, $\mathbb{E}[S] = 500$ tokens.

### Problem A.3: Speculative Decoding Speedup (10 points)

**(a)** (4 points) Prove that the expected number of tokens produced per speculation round with draft length $K$ and per-token acceptance probability $\alpha$ is:

$$\tau(K, \alpha) = \frac{1 - \alpha^{K+1}}{1 - \alpha}$$

Start from the definition: $\tau = \sum_{k=0}^{K-1}(k+1)(1-\alpha)\alpha^k + (K+1)\alpha^K$ and derive the closed form. Verify the boundary cases $\alpha = 0$ and $\alpha = 1$.

**(b)** (3 points) The wall-clock speedup of speculative decoding versus standard autoregressive decoding is:

$$\text{Speedup}(K, \alpha, c) = \frac{\tau(K, \alpha)}{1 + Kc}$$

where $c = C_{\text{draft}} / C_{\text{target}}$ is the relative cost of the draft model. Find the optimal $K^*$ that maximizes the speedup. Derive the condition $\alpha^{K^*+1} \ln \alpha = -\frac{c(1-\alpha^{K^*+1})}{1+K^*c}$ and solve numerically for $\alpha = 0.8, c = 0.1$ and $\alpha = 0.9, c = 0.05$.

**(c)** (3 points) Consider tree-structured speculation with a binary tree of depth $D$. At each depth, we have two candidate tokens (two children per node). The tree has $2^{D+1} - 1$ total nodes.

Derive the expected number of accepted tokens along the best root-to-leaf path. Show that it satisfies:

$$\tau_{\text{tree}}(D, \alpha) \geq \tau_{\text{chain}}(D, \alpha) = \frac{1 - \alpha^{D+1}}{1 - \alpha}$$

Compute the improvement ratio $\tau_{\text{tree}} / \tau_{\text{chain}}$ for $D = 4$ and $\alpha = 0.7$. Is tree speculation always better than chain speculation in terms of wall-clock speedup? Discuss the conditions under which the additional verification cost of the tree outweighs the benefit.

### Problem A.4: Memory-Bandwidth Roofline (10 points)

**(a)** (4 points) For an autoregressive Transformer with $L$ layers, model dimension $d$, and $h$ attention heads generating one token with batch size $B$ and average sequence length $S$:

Derive the exact FLOP count and HBM traffic for one decode step. Include:

- QKV projection: FLOPs and weight loading
- Attention against KV cache: FLOPs and KV loading
- Output projection: FLOPs and weight loading
- FFN (SwiGLU with intermediate size $\frac{8}{3}d$, rounded to a multiple of 256): FLOPs and weight loading

Compute the arithmetic intensity $I(B, S)$.

**(b)** (3 points) On an H100 SXM (1,979 TFLOPS FP16, 3.35 TB/s HBM bandwidth), compute the crossover batch size $B^*$ where decode transitions from memory-bound to compute-bound, assuming $S = 1024$. Use LLaMA-2 70B parameters ($L = 80$, $d = 8192$, GQA with $h_{\text{kv}} = 8$, $d_k = 128$).

**(c)** (3 points) The decode latency is:

$$t_{\text{decode}} = \max\left(\frac{\text{FLOPs}}{\text{Peak FLOPS}}, \frac{\text{HBM Traffic}}{\text{HBM BW}}\right)$$

Plot $t_{\text{decode}}$ as a function of $B$ for $B \in [1, 512]$. Identify the three regimes: (1) fully memory-bound, (2) transition, (3) fully compute-bound. At what batch size does latency per token start to increase?

### Problem A.5: Serving SLA Analysis (10 points)

**(a)** (4 points) An LLM serving endpoint must satisfy:

- TTFT $\leq 500$ ms at p99
- ITL $\leq 50$ ms at p99
- Arrival rate: $\lambda = 10$ requests/second

Model the system as an M/G/1 queue. The service time for each request has two phases: prefill (deterministic time $t_p = P \cdot \delta_p$ where $\delta_p$ is the per-token prefill time) and decode (random time $G \cdot \delta_d$ where $G \sim \text{Geometric}(p)$ and $\delta_d$ is the per-token decode time).

Derive the mean and variance of the service time. Use the Pollaczek-Khinchine formula to bound the p99 wait time.

**(b)** (3 points) The TTFT consists of wait time plus prefill time: $\text{TTFT} = W + t_p$. Derive the minimum number of replicas $R$ needed to meet the TTFT SLA, assuming each replica handles $\lambda / R$ arrival rate.

Use concrete values: $P = 256$, $\delta_p = 0.1$ ms/token, $\delta_d = 30$ ms/token, $1/p = 200$.

**(c)** (3 points) Adding continuous batching changes the service model: decode steps serve all $B$ active sequences simultaneously, so the per-request decode cost is amortized. Model the effective service time for a request in a system with average batch size $\bar{B}$ as:

$$S_{\text{eff}} = t_p + \frac{G \cdot \delta_d}{\bar{B}}$$

Recompute the number of replicas needed. How much does continuous batching reduce the required replicas?

---

## Part B: Implementation (50 points)

### Overview

Build a simplified but functional LLM serving engine in C++ that implements:

1. A block-based KV cache memory manager in C++ (PagedAttention-style).
2. A CUDA kernel for paged attention (gather KV from non-contiguous blocks).
3. A continuous batching scheduler in C++.
4. An HTTP server endpoint for request handling.

We use GPT-2 (loaded via libtorch) to keep the model side tractable. The focus is on the systems infrastructure, not the model.

### B.1: Block-Based KV Cache Manager (15 points)

Implement a KV cache manager in C++ with block-based allocation:

```cpp
// include/block_allocator.h
#pragma once
#include <vector>
#include <cstdint>
#include <cuda_fp16.h>

struct BlockAllocator {
    // Physical KV cache on GPU:
    //   k_cache: [num_blocks, num_layers, block_size, num_kv_heads, head_dim]
    //   v_cache: same shape
    half* k_cache_ptr;  // device pointer
    half* v_cache_ptr;  // device pointer

    int num_blocks;
    int block_size;
    int num_layers;
    int num_kv_heads;
    int head_dim;

    BlockAllocator(int num_blocks, int block_size, int num_layers,
                   int num_kv_heads, int head_dim);
    ~BlockAllocator();

    // Allocate n blocks, returns their physical block IDs.
    // Returns empty vector if insufficient blocks.
    std::vector<int> allocate(int n);

    // Free blocks back to pool.
    void free(const std::vector<int>& block_ids);

    int num_free() const;

    // Write a single token's KV into a block at a given position.
    // k_vec, v_vec are device pointers of shape [num_kv_heads, head_dim].
    void write_kv(int block_id, int layer_idx, int pos_in_block,
                  const half* k_vec, const half* v_vec,
                  cudaStream_t stream = 0);

    // Gather KV for a sequence from its block table.
    // block_table: logical block -> physical block mapping.
    // Returns contiguous K, V of shape [seq_len, num_kv_heads, head_dim].
    void gather_kv(const std::vector<int>& block_table,
                   int layer_idx, int seq_len,
                   half* k_out, half* v_out,
                   cudaStream_t stream = 0);

private:
    std::vector<int> free_list_;
    size_t block_stride_;  // elements per block per layer
};
```

Requirements:
- RAII: constructor allocates GPU memory (`cudaMalloc`), destructor frees it.
- Zero external fragmentation (any free block can serve any request).
- Internal fragmentation bounded by `block_size - 1` tokens per sequence.
- Thread-safe `allocate`/`free` (use `std::mutex`).

**C++ tests** (using Catch2 or GoogleTest):
- Allocate blocks for 100 sequences with random lengths, free half, verify reuse.
- Verify `gather_kv` produces correct output by writing known values and reading them back.
- Stress test: rapid allocate/free cycles, verify memory accounting stays consistent.

### B.2: CUDA Paged Attention Kernel (10 points)

Write a CUDA kernel that computes attention with a block table (non-contiguous KV cache):

```cuda
// cuda/paged_attention.cu

// Each thread block handles one query head for one sequence.
// The KV cache is accessed via a block table that maps logical
// block indices to physical block indices.

__global__ void paged_attention_kernel(
    const half* __restrict__ Q,           // [num_seqs, num_heads, head_dim]
    const half* __restrict__ k_cache,     // [num_blocks, block_size, num_kv_heads, head_dim]
    const half* __restrict__ v_cache,     // same shape
    half* __restrict__ output,            // [num_seqs, num_heads, head_dim]
    const int* __restrict__ block_tables, // [num_seqs, max_num_blocks]
    const int* __restrict__ seq_lens,     // [num_seqs]
    int num_seqs,
    int num_heads,
    int num_kv_heads,
    int head_dim,
    int block_size,
    int max_num_blocks,
    float scale                           // 1/sqrt(head_dim)
) {
    // Each thread block: one (seq, head) pair
    // 1. Load Q vector for this (seq, head) into registers
    // 2. Iterate over KV blocks in this sequence's block table:
    //    a. Look up physical block ID from block_tables
    //    b. Load K block from k_cache at the physical location
    //    c. Compute QK^T dot products for this block
    //    d. Track running max and sum for online softmax
    // 3. Second pass (or fused): compute weighted sum of V
    // 4. Write output

    // TODO: Implement with online softmax (same algorithm as Flash Attention
    //       but reading from non-contiguous physical blocks)
}
```

Requirements:
- Correct attention output matching a reference implementation (torch SDPA on gathered KV).
- Handle variable-length sequences in the same batch (use `seq_lens` array).
- Use shared memory for partial QK^T results if needed.
- Profile with `ncu`: report achieved bandwidth and occupancy.

### B.3: Continuous Batching Scheduler (10 points)

```cpp
// include/scheduler.h
#pragma once
#include <deque>
#include <vector>
#include <chrono>
#include "block_allocator.h"

enum class RequestState { WAITING, PREFILL, RUNNING, COMPLETED };

struct Request {
    int request_id;
    std::vector<int> prompt_token_ids;
    int max_output_tokens;
    float temperature;
    std::chrono::steady_clock::time_point arrival_time;

    std::vector<int> generated_tokens;
    std::vector<int> block_table;  // logical -> physical block mapping
    RequestState state = RequestState::WAITING;

    int current_len() const {
        return prompt_token_ids.size() + generated_tokens.size();
    }
    bool is_complete() const;
};

struct ScheduleResult {
    std::vector<Request*> prefill;    // New requests to prefill
    std::vector<Request*> decode;     // Existing requests to decode
    std::vector<Request*> preempted;  // Evicted due to memory pressure
};

class Scheduler {
public:
    Scheduler(BlockAllocator& allocator, int max_batch_size,
              int max_tokens_in_batch);

    void add_request(Request req);
    ScheduleResult schedule_step();
    void update_after_step(
        const std::vector<std::pair<int, int>>& outputs  // (request_id, token_id)
    );
    bool has_pending() const;

private:
    BlockAllocator& allocator_;
    int max_batch_;
    int max_tokens_;
    std::deque<Request> waiting_;
    std::vector<Request> running_;

    bool try_admit(Request& req);
    void evict_and_free(Request& req);
};
```

Requirements:
- FCFS scheduling for waiting requests.
- Completed sequences evicted immediately, blocks freed.
- New requests admitted at every step (continuous batching).
- Preemption under memory pressure (evict lowest-priority running request).
- **Simulation test**: 200 requests, random lengths, verify all complete, no memory overrun.

### B.4: HTTP Server and Integration (5 points)

Build a minimal HTTP server that accepts generation requests:

```cpp
// src/server.cpp
// Using cpp-httplib (single-header, no dependencies)
#include "httplib.h"
#include "engine.h"
#include <nlohmann/json.hpp>

int main(int argc, char** argv) {
    // Load model via libtorch
    // Initialize BlockAllocator, Scheduler, Engine
    // ...

    httplib::Server svr;

    svr.Post("/generate", [&](const httplib::Request& req,
                               httplib::Response& res) {
        auto body = nlohmann::json::parse(req.body);
        std::string prompt = body["prompt"];
        int max_tokens = body.value("max_tokens", 128);
        float temperature = body.value("temperature", 1.0f);

        // Tokenize, create Request, add to scheduler
        // Block until completion (or use SSE for streaming)
        // Return generated text as JSON

        nlohmann::json response;
        response["text"] = generated_text;
        response["tokens_generated"] = num_tokens;
        response["ttft_ms"] = ttft;
        response["total_ms"] = total;
        res.set_content(response.dump(), "application/json");
    });

    svr.listen("0.0.0.0", 8080);
}
```

Requirements:
- Server compiles and runs, accepts POST requests.
- Returns correct generated text for GPT-2.
- Handles multiple concurrent requests (use a background generation thread).

### B.5: Benchmarking and Analysis (10 points)

Use a Python client script to benchmark your C++ engine:

**(a)** (4 points) Measure throughput (tokens/s) and latency (TTFT, mean ITL) for:
- Your engine with continuous batching, batch sizes 1, 4, 8, 16.
- Baseline: sequential single-request generation.

Use 50 requests with prompt lengths from $\text{Uniform}(50, 500)$ and output lengths from $\text{Uniform}(50, 300)$.

**(b)** (3 points) Instrument your C++ engine to log:
- GPU memory usage (total, model, KV cache) over time.
- Number of active sequences per step.
- Free blocks over time.
Plot these from the logs.

**(c)** (3 points) Compare measured metrics with theoretical predictions from Part A:
- Average batch utilization: $\bar{B} / B_{\max}$
- Internal fragmentation waste vs. theoretical $\frac{B_s - 1}{2}$.
- Throughput ratio: continuous vs. static batching.
Write a 1-page analysis of discrepancies.

---

## Deliverables

1. **PDF** (Part A): Complete derivations for A.1--A.5.

2. **C++ project** (Part B):
   - `CMakeLists.txt`
   - `include/`: `block_allocator.h`, `scheduler.h`, `engine.h`
   - `src/`: `block_allocator.cpp`, `scheduler.cpp`, `engine.cpp`, `server.cpp`
   - `cuda/`: `paged_attention.cu`
   - `tests/`: `test_allocator.cpp`, `test_scheduler.cpp`, `test_attention.cu`
   - Build instructions in `README.md`

3. **Python client** (benchmarking):
   - `benchmark_client.py`: Sends requests, collects metrics, generates plots.

---

## Grading Rubric

| Component | Points | Criteria |
|---|---|---|
| A.1 Throughput analysis | 10 | Correct derivations, boundary cases, asymptotic analysis |
| A.2 Fragmentation | 10 | Rigorous probability arguments, correct optimization |
| A.3 Speculative decoding | 10 | Complete proof, correct numerical solutions |
| A.4 Roofline | 10 | Exact FLOP/bandwidth accounting, correct crossover |
| A.5 SLA analysis | 10 | Correct queueing theory application |
| B.1 Block allocator (C++) | 15 | RAII, thread-safe, correct allocation/free, tests pass |
| B.2 Paged attention (CUDA) | 10 | Correct output, variable-length batches, profiled |
| B.3 Scheduler (C++) | 10 | Continuous batching, preemption, simulation test |
| B.4 HTTP server | 5 | Compiles, serves, handles concurrent requests |
| B.5 Benchmarking | 10 | Thorough measurements, theory vs. practice analysis |
| **Total** | **100** | |

---

## Hints and Tips

1. **Start with Part A** before implementing. The theoretical analysis will guide your implementation decisions (e.g., block size, batch budget).

2. **Build order**: Block allocator -> CUDA attention kernel -> Scheduler -> Server. Test each component in isolation before integrating.

3. **For libtorch**, load GPT-2 via TorchScript:
   ```cpp
   torch::jit::script::Module model = torch::jit::load("gpt2_traced.pt");
   model.to(torch::kCUDA);
   model.to(torch::kHalf);
   ```
   You can create the traced model in Python: `torch.jit.trace(model, example_input)`.

4. **For the paged attention kernel**, the key insight is that it's the same as Flash Attention but with an indirection table. Each logical block index is translated to a physical block index via `block_tables[seq_idx][logical_block]`. The rest is standard tiled attention.

5. **For the HTTP server**, `cpp-httplib` is a single header file — just drop it in your project. Use a separate `std::thread` for the generation loop so the server remains responsive.

6. **Thread safety**: The scheduler runs on the generation thread. The HTTP handler pushes requests into a thread-safe queue (`std::mutex` + `std::condition_variable`). The generation thread pulls from this queue each step.

---

## Further Reading

1. **Kwon et al.** "Efficient Memory Management for Large Language Model Serving with PagedAttention." SOSP 2023.
2. **Yu et al.** "Orca: A Distributed Serving System for Transformer-Based Generative Models." OSDI 2022.
3. **vLLM source code.** github.com/vllm-project/vllm --- Study the `Scheduler`, `BlockSpaceManager`, and `Worker` classes.
4. **Leviathan et al.** "Fast Inference from Transformers via Speculative Decoding." ICML 2023.
