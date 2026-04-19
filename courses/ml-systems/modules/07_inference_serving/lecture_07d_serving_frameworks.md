# Lecture 07d: Serving Frameworks --- TensorRT-LLM, ONNX Runtime, TGI, vLLM

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Describe** the end-to-end optimization pipeline of TensorRT-LLM, including layer fusion, precision calibration, kernel auto-tuning, and in-flight batching.
2. **Explain** the ONNX Runtime architecture --- computation graph, execution providers, and the extensibility model --- and evaluate when cross-platform inference is preferable to vendor-specific optimization.
3. **Analyze** the architecture of vLLM (scheduler, block manager, worker processes) and trace a request through the system from arrival to completion, including the C++ and CUDA layers beneath the Python API.
4. **Compare** serving frameworks (vLLM, TGI, TensorRT-LLM, SGLang) across throughput, latency, supported models, and operational complexity, selecting the appropriate framework for a given deployment scenario.
5. **Explain** why production inference servers use C++ for their critical path, and describe the thread architecture (request handler, scheduler, GPU execution) and synchronization patterns used in a typical serving engine.
6. **Design** a horizontally scaled LLM serving deployment with load balancing, GPU multiplexing, and autoscaling, computing capacity requirements from SLA constraints.

---

## 2. Motivation and Context

### 2.1 The Serving Stack

Deploying an LLM in production requires far more than a model checkpoint and a GPU. The serving stack includes:

```
┌─────────────────────────────────┐
│         Load Balancer           │  ← Route requests across replicas
├─────────────────────────────────┤
│       API Gateway / Router      │  ← Rate limiting, auth, routing
├─────────────────────────────────┤
│      Serving Framework          │  ← vLLM, TGI, TRT-LLM, SGLang
│  ┌───────────┬────────────────┐ │
│  │ Scheduler │ KV Cache Mgr   │ │
│  ├───────────┼────────────────┤ │
│  │  Workers  │ Model Executor │ │
│  └───────────┴────────────────┘ │
├─────────────────────────────────┤
│      Inference Engine           │  ← TensorRT, ONNX RT, PyTorch
├─────────────────────────────────┤
│      Hardware (GPU / CPU)       │
└─────────────────────────────────┘
```

The serving framework orchestrates batching, scheduling, memory management, and streaming. The inference engine handles low-level kernel execution. Some systems (TensorRT-LLM) combine both layers; others (vLLM) use PyTorch as the inference engine.

### 2.2 Key Metrics

| Metric | Definition | Typical SLA |
|---|---|---|
| TTFT | Time to first token (from request arrival) | < 500 ms |
| ITL | Inter-token latency (time between consecutive tokens) | < 50 ms |
| Throughput | Tokens generated per second (across all requests) | Maximize |
| p99 latency | 99th percentile end-to-end latency | < 10 s |
| Goodput | Requests completed within SLA / total requests | > 99% |

The challenge is that TTFT, ITL, and throughput are often in tension. Higher batch sizes improve throughput but degrade ITL (more sequences share bandwidth). Longer prompts increase TTFT (more prefill computation).

---

## 3. TensorRT-LLM

### 3.1 Architecture Overview

TensorRT-LLM is NVIDIA's high-performance LLM inference library. It combines:

1. **Model definition in Python** using a TensorRT-LLM-specific API (not standard PyTorch).
2. **Compilation to TensorRT engines** with aggressive layer fusion and precision optimization.
3. **C++ runtime** with in-flight batching, paged KV cache, and multi-GPU support.

```python
# TensorRT-LLM model definition (simplified)
import tensorrt_llm
from tensorrt_llm.layers import (
    Attention, MLP, LayerNorm, Embedding
)

class LlamaDecoderLayer(tensorrt_llm.Module):
    def __init__(self, config):
        super().__init__()
        self.attention = Attention(
            hidden_size=config.hidden_size,
            num_attention_heads=config.num_heads,
            num_kv_heads=config.num_kv_heads,
            max_position_embeddings=config.max_seq_len,
            dtype=config.dtype,
        )
        self.mlp = MLP(
            hidden_size=config.hidden_size,
            ffn_hidden_size=config.intermediate_size,
            hidden_act="silu",
            dtype=config.dtype,
        )
        self.input_layernorm = LayerNorm(config.hidden_size)
        self.post_attention_layernorm = LayerNorm(config.hidden_size)

    def forward(self, hidden_states, attention_mask, kv_cache):
        residual = hidden_states
        hidden_states = self.input_layernorm(hidden_states)
        hidden_states = self.attention(
            hidden_states, attention_mask, kv_cache
        )
        hidden_states = residual + hidden_states

        residual = hidden_states
        hidden_states = self.post_attention_layernorm(hidden_states)
        hidden_states = self.mlp(hidden_states)
        hidden_states = residual + hidden_states
        return hidden_states
```

### 3.2 Optimization Pipeline

**Phase 1: Graph construction.** The Python model definition is traced into a TensorRT network definition (a computational graph).

**Phase 2: Layer fusion.** TensorRT applies aggressive fusion rules:

- **QKV fusion:** Three separate linear layers ($W_Q, W_K, W_V$) are fused into a single GEMM.
- **Attention fusion:** The entire multi-head attention (QKV projection, score computation, softmax, value aggregation, output projection) is fused into a single kernel.
- **MLP fusion:** SiLU gate and up-projection are fused: $\text{SiLU}(xW_{\text{gate}}) \odot xW_{\text{up}}$ becomes a single fused kernel.
- **Add + LayerNorm fusion:** The residual addition and subsequent LayerNorm are fused.

The result is that a Transformer layer, which might have 15--20 separate operators in PyTorch, becomes 3--5 fused kernels.

**Phase 3: Precision calibration.** TensorRT selects per-layer precision (FP16, FP8, INT8, INT4) to meet a target quality threshold:

1. Run a calibration dataset through the FP16 model, collecting activation statistics.
2. For each layer, compute the quantization error under different precisions.
3. Select the lowest precision that keeps error below threshold, or use a user-specified precision policy.

**Phase 4: Kernel auto-tuning.** For each fused operator, TensorRT benchmarks multiple kernel implementations:

- Different tile sizes (e.g., 64x64, 128x128, 256x128 for GEMMs).
- Different numbers of pipeline stages.
- Different shared memory configurations.

The fastest kernel for the target GPU is selected. This auto-tuning is GPU-specific --- a TensorRT engine built for A100 will not run on H100.

**Phase 5: Memory planning.** Intermediate tensors are assigned to a pre-allocated workspace buffer with optimal reuse.

### 3.3 In-Flight Batching Runtime

TensorRT-LLM's C++ runtime implements:

- **In-flight batching** (continuous batching from Lecture 07a).
- **Paged KV cache** (from Lecture 07b).
- **Chunked prefill:** Long prompts are processed in chunks to avoid starving decode requests of GPU time.
- **Guaranteed no padding (GNP):** Unlike static batching, sequences of different lengths in a batch do not require padding; the attention kernel handles variable-length sequences natively.

### 3.4 Multi-GPU Support

TensorRT-LLM supports tensor parallelism and pipeline parallelism for models that do not fit on a single GPU:

- **Tensor parallelism (TP):** Each layer's weight matrices are split across GPUs. Requires all-reduce communication after each attention and MLP block.
- **Pipeline parallelism (PP):** Different layers are placed on different GPUs. Requires point-to-point communication between pipeline stages.

For a model with $N$ parameters on $G$ GPUs:

$$\text{Per-GPU memory} = \frac{N}{G} \text{ (parameters)} + \frac{\text{KV cache}}{G_{\text{TP}}} \text{ (KV cache with TP)}$$

---

## 4. ONNX Runtime

### 4.1 Architecture

ONNX Runtime (ORT) is Microsoft's cross-platform inference engine. Its key architectural feature is the **Execution Provider (EP)** abstraction:

```
ONNX Model (graph) → Graph Optimizer → Partitioner → Execution Providers
                                                      ├── CUDA EP
                                                      ├── TensorRT EP
                                                      ├── DirectML EP (Windows GPU)
                                                      ├── OpenVINO EP (Intel)
                                                      ├── CoreML EP (Apple)
                                                      └── CPU EP (fallback)
```

The partitioner assigns each subgraph to the most efficient EP. Operators not supported by a hardware-specific EP fall back to the CPU EP.

### 4.2 Optimization Levels

ORT applies optimizations at three levels (as discussed in Lecture 07a):

```python
import onnxruntime as ort

# Configure session
options = ort.SessionOptions()
options.graph_optimization_level = (
    ort.GraphOptimizationLevel.ORT_ENABLE_ALL
)

# Enable parallel execution
options.execution_mode = ort.ExecutionMode.ORT_PARALLEL
options.inter_op_num_threads = 4

# Use CUDA with TensorRT sub-EP for applicable subgraphs
providers = [
    ("TensorrtExecutionProvider", {
        "trt_max_workspace_size": 2 << 30,
        "trt_fp16_enable": True,
    }),
    ("CUDAExecutionProvider", {
        "device_id": 0,
        "arena_extend_strategy": "kNextPowerOfTwo",
    }),
    "CPUExecutionProvider",
]

session = ort.InferenceSession("model.onnx", options, providers)
```

### 4.3 When to Use ORT

ORT excels when:

- **Cross-platform deployment** is needed (same model on NVIDIA, AMD, Intel, Apple, mobile).
- **Heterogeneous hardware** within a fleet requires a single inference stack.
- **Model format standardization** (ONNX as lingua franca) is an organizational goal.
- **Edge deployment** with CPU or mobile accelerators.

ORT is generally not the best choice for maximum-throughput LLM serving on NVIDIA GPUs, where TensorRT-LLM or vLLM typically outperform it.

---

## 5. Text Generation Inference (TGI)

### 5.1 Architecture

TGI is Hugging Face's production-grade LLM serving framework. Written primarily in Rust (router) and Python (model execution), it provides:

```
┌──────────────────────────┐
│     HTTP/gRPC Server     │
├──────────────────────────┤
│    Router (Rust)         │  ← Request queuing, batching decisions
├──────────────────────────┤
│    Model Server (Python) │  ← Model loading, inference execution
│    ├── Continuous Batch   │
│    ├── Flash Attention    │
│    ├── Paged Attention    │
│    └── Quantization       │
└──────────────────────────┘
```

### 5.2 Key Features

- **Token streaming:** Tokens are streamed to clients via Server-Sent Events (SSE) as they are generated.
- **Built-in quantization:** GPTQ, AWQ, GGML, and bitsandbytes quantization.
- **Watermarking:** Optional text watermarking for provenance tracking.
- **Safetensors:** Loads models from the safetensors format for security and speed.

### 5.3 Batching Strategy

TGI implements continuous batching with a **prefill priority** strategy: new requests are prefilled as soon as GPU resources allow, and prefill and decode can be interleaved within the same step (chunked prefill). The Rust router enforces maximum waiting queue size and batch size constraints, evicting completed requests and admitting new ones each step --- functionally similar to vLLM's scheduler but implemented in Rust for lower overhead.

### 5.4 Deployment

TGI is typically deployed via Docker:

```bash
docker run --gpus all \
    -p 8080:80 \
    -v $MODEL_DIR:/data \
    ghcr.io/huggingface/text-generation-inference:latest \
    --model-id meta-llama/Llama-2-70b-chat-hf \
    --quantize gptq \
    --max-input-length 4096 \
    --max-total-tokens 8192 \
    --max-batch-size 32 \
    --num-shard 4  # tensor parallelism across 4 GPUs
```

---

## 6. vLLM: Architecture Deep Dive

### 6.1 System Architecture

vLLM (Kwon et al., 2023) is an open-source LLM serving engine built around PagedAttention. Its architecture:

```
┌─────────────────────────────────────────┐
│              API Server                  │
│         (FastAPI / OpenAI-compat)        │
├─────────────────────────────────────────┤
│              LLM Engine                  │
│  ┌──────────────┬──────────────────────┐ │
│  │  Scheduler   │   Block Manager      │ │
│  │              │   ├── GPU Allocator   │ │
│  │              │   └── CPU Allocator   │ │
│  ├──────────────┴──────────────────────┤ │
│  │           Model Runner               │ │
│  │  ┌──────────┐  ┌──────────────────┐ │ │
│  │  │ Worker 0 │  │ Worker 1 (TP=2) │ │ │
│  │  │ (GPU 0)  │  │ (GPU 1)         │ │ │
│  │  └──────────┘  └──────────────────┘ │ │
│  └──────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 6.2 Request Lifecycle

**Step 1: Arrival.** An API request arrives and is converted into a `SequenceGroup` containing one or more `Sequence` objects (one per beam for beam search, or one for sampling).

**Step 2: Waiting queue.** The sequence group enters the scheduler's waiting queue, ordered by arrival time (FCFS by default).

**Step 3: Scheduling.** The scheduler runs at each step and decides which sequence groups to process:

```python
class Scheduler:
    def schedule(self):
        """Determine which sequences to process in this step."""
        scheduled = SchedulerOutputs()

        # 1. Handle running sequences (decode step)
        for seq_group in self.running:
            if not self.block_manager.can_append_slot(seq_group):
                # Not enough KV cache blocks; must preempt
                self._preempt(seq_group)
            else:
                self.block_manager.append_slot(seq_group)
                scheduled.running.append(seq_group)

        # 2. Handle swapped sequences (swapped to CPU)
        for seq_group in self.swapped:
            if self.block_manager.can_swap_in(seq_group):
                self.block_manager.swap_in(seq_group)
                scheduled.running.append(seq_group)

        # 3. Admit new sequences from waiting queue
        for seq_group in self.waiting:
            if self.block_manager.can_allocate(seq_group):
                self.block_manager.allocate(seq_group)
                scheduled.prefill.append(seq_group)

        return scheduled
```

**Step 4: Execution.** The model runner executes a forward pass on all scheduled sequences. Prefill sequences process their full prompts; running sequences process one token.

**Step 5: Sampling.** The output logits are sampled according to each sequence's sampling parameters (temperature, top-k, top-p).

**Step 6: KV cache update.** New KV entries are written to the allocated blocks.

**Step 7: Completion check.** If a sequence produces an EOS token or reaches the maximum length, it is removed from the running queue and its KV blocks are freed.

### 6.3 Block Manager

The block manager wraps a `BlockAllocator` (GPU and CPU) and maintains per-sequence block tables. Key operations:

- `allocate(seq_group)`: Allocate $\lceil P / B_s \rceil$ blocks for a new sequence with prompt length $P$.
- `append_slot(seq_group)`: Check if the last block has space; if not, allocate a new block. Cost: O(1).
- `swap_out(seq_group)`: Async-copy all GPU blocks to CPU blocks, freeing GPU blocks. Enables preemption.
- `swap_in(seq_group)`: Reverse of swap_out; requires enough free GPU blocks.

The block table is a simple list of physical block IDs per sequence. This is the data structure passed to the PagedAttention CUDA kernel (see Lecture 07b).

### 6.4 Performance Characteristics

vLLM's throughput advantage comes primarily from higher GPU memory utilization (less waste = larger effective batch size):

| System | Max batch (A100 80GB, LLaMA-13B) | Throughput (tokens/s) |
|---|---|---|
| HuggingFace Transformers | 4 | ~800 |
| TGI | 16 | ~2,400 |
| vLLM | 48 | ~5,200 |

The 2--3x throughput advantage over TGI (at the time of the original paper) was primarily due to PagedAttention's better memory utilization, enabling larger batch sizes.

### 6.5 vLLM's C++ and CUDA Architecture

While vLLM exposes a Python API, the performance-critical path is implemented in C++ and CUDA. Understanding this layer is essential for reasoning about where latency actually goes.

**Custom CUDA kernels.** vLLM does not rely solely on PyTorch's built-in attention. Instead, it ships custom CUDA kernels for PagedAttention that operate directly on the block table data structure. The kernel receives:

- The query tensor for the current step.
- A block table (a 2D integer tensor mapping `[sequence_index, logical_block]` to a physical block ID).
- The physical KV cache buffer laid out as contiguous blocks in GPU memory.

The PagedAttention kernel iterates over each sequence's block table entries, fetches the corresponding key/value blocks from the physical cache, and computes scaled dot-product attention --- all within a single fused kernel launch. This avoids the overhead of gathering KV entries into a contiguous buffer before calling a standard attention kernel.

**C++ worker layer.** Each vLLM worker process loads the model via PyTorch and registers the custom CUDA operations as PyTorch extensions (`torch.ops.vllm`). When the Python scheduler dispatches a batch, the worker calls into these C++ extensions:

1. `paged_attention_v1` / `paged_attention_v2` --- the core attention kernel, with v2 using a two-pass reduction for long sequences that exceed a single thread block's capacity.
2. `reshape_and_cache` --- writes newly computed KV vectors into the correct slots within the paged cache.
3. `copy_blocks` --- implements copy-on-write when a block is shared between sequences (e.g., during beam search forking).

**Scheduler--block manager interaction.** The Python scheduler and block manager cooperate to produce the metadata that the C++ kernels consume:

1. The scheduler selects which sequences run this step and calls `block_manager.append_slot()` for each decode sequence.
2. The block manager returns a `block_tables` tensor and a `slot_mapping` tensor (mapping each token position to a physical slot index).
3. These tensors are passed directly to the CUDA kernel --- no Python logic runs in the inner loop of attention computation.

This split --- Python for scheduling policy, C++/CUDA for execution --- is a common pattern in production ML systems. The scheduler runs once per step (milliseconds of Python overhead), while the GPU kernels dominate wall-clock time.

---

## 7. SGLang and Emerging Frameworks

### 7.1 SGLang

**SGLang** (Zheng et al., 2024) introduces a programming model for LLM applications and a serving engine optimized for structured generation:

**RadixAttention:** A radix tree-based prefix caching system (described in Lecture 07b) that automatically shares KV cache across requests with common prefixes.

**Compressed finite-state machine (FSM) for constrained decoding:** When the output must conform to a schema (e.g., JSON), SGLang pre-compiles the schema into an FSM and restricts the token sampling at each step to valid continuations. This is done with precomputed token masks:

```python
# SGLang constrained generation example
import sglang as sgl

@sgl.function
def extract_info(s, text):
    s += "Extract name and age from: " + text + "\n"
    s += "Output JSON:\n"
    s += sgl.gen("output", regex=r'\{"name": "[^"]+", "age": \d+\}')
```

### 7.2 Framework Comparison

| Feature | vLLM | TGI | TRT-LLM | SGLang |
|---|---|---|---|---|
| Continuous batching | Yes | Yes | Yes | Yes |
| PagedAttention | Yes | Yes | Yes | Yes (RadixAttention) |
| Prefix caching | Yes | Limited | Yes | Yes (radix tree) |
| Speculative decoding | Yes | Yes | Yes | Yes |
| Tensor parallelism | Yes | Yes | Yes | Yes |
| Quantization | AWQ, GPTQ, FP8 | GPTQ, AWQ, BnB | FP8, INT8, INT4 | AWQ, GPTQ, FP8 |
| Constrained decoding | Basic | Basic | No | Advanced (FSM) |
| Multi-modal | Yes | Yes | Yes | Yes |
| Language | Python | Rust + Python | C++ + Python | Python |
| Ease of use | High | High | Medium | High |
| Peak throughput | High | High | Highest | High |

**When to use which:**

- **TensorRT-LLM:** Maximum throughput on NVIDIA GPUs, when you can invest in the compilation step and accept GPU-specific engines.
- **vLLM:** General-purpose LLM serving with excellent memory efficiency, broad model support, and active community.
- **TGI:** Production deployment with Hugging Face ecosystem integration, Docker-first workflow.
- **SGLang:** Complex LLM applications with structured output, multi-turn conversations with prefix sharing, or programmatic LLM workflows.

---

## 8. C++ Serving Internals

Production inference servers are overwhelmingly implemented in C++ (with CUDA for GPU kernels), even when the user-facing API is Python. This section examines why, and traces the architecture of a typical C++ serving engine.

### 8.1 Why C++ for Inference Serving

Three concerns push production serving code below the Python layer:

1. **Latency control.** Python's GIL serializes CPU-side work. When the server must prepare attention metadata, manage block tables, and launch kernels for hundreds of concurrent sequences, GIL contention adds milliseconds of jitter to every step. C++ threads run in parallel without coordination overhead.
2. **Memory control.** A serving engine manages a large, long-lived KV cache (often 30--60 GB). C++ allows deterministic allocation and deallocation --- no garbage collector pauses, no reference-counting overhead, and the ability to use custom allocators (e.g., a slab allocator for fixed-size KV blocks).
3. **Threading model.** A serving engine needs distinct threads for request handling, scheduling, and GPU execution, with carefully controlled synchronization. C++ provides `std::thread`, `std::mutex`, `std::condition_variable`, and lock-free data structures that map directly to OS primitives.

### 8.2 Model Loading with libtorch

The PyTorch C++ API (libtorch) allows loading and executing TorchScript models without Python:

```cpp
#include <torch/script.h>

// Load a TorchScript model exported via torch.jit.trace or torch.jit.script
torch::jit::script::Module model = torch::jit::load("model.pt");
model.to(torch::kCUDA);
model.eval();

// Prepare input tensor
auto input_tensor = torch::randn({1, seq_len, hidden_dim},
                                  torch::device(torch::kCUDA));

// Run inference
torch::NoGradGuard no_grad;  // Disable autograd for inference
auto output = model.forward({input_tensor});
auto logits = output.toTensor();  // Shape: [1, seq_len, vocab_size]
```

libtorch handles CUDA memory management, kernel dispatch, and operator execution. The serving engine wraps this in a worker thread that pulls batched inputs from a queue and pushes results to a completion map.

### 8.3 Thread Architecture

A typical C++ serving engine uses three thread pools with explicit synchronization:

```
┌──────────────────────────────────────────────────────────┐
│                   Request Handler Threads                 │
│  (accept HTTP/gRPC, parse request, enqueue, stream back) │
└────────────────────────┬─────────────────────────────────┘
                         │ push to request queue
                         v
              ┌─────────────────────┐
              │   Pending Request    │
              │       Queue          │  ← std::queue<Request> + mutex + cv
              └──────────┬──────────┘
                         │ scheduler pops and batches
                         v
┌──────────────────────────────────────────────────────────┐
│                   Scheduler Thread                        │
│  (batch formation, block allocation, preemption policy)  │
└────────────────────────┬─────────────────────────────────┘
                         │ submit batch to GPU
                         v
┌──────────────────────────────────────────────────────────┐
│                GPU Execution Threads                      │
│  (model forward pass, KV cache writes, sampling)         │
└──────────────────────────────────────────────────────────┘
```

**Request handler threads** run an async I/O loop (e.g., via `boost::asio` or `libuv`) and enqueue parsed requests into the pending queue.

**The scheduler thread** wakes on a condition variable whenever the queue is non-empty or a GPU step completes. It forms the next batch, updates block tables, and submits work.

**GPU execution threads** call into libtorch or custom CUDA kernels, synchronize on the CUDA stream, and write results back.

### 8.4 Thread-Safe Request Queue

The request queue is the central synchronization point. A minimal implementation:

```cpp
#include <mutex>
#include <condition_variable>
#include <queue>

struct Request {
    std::string request_id;
    std::vector<int> token_ids;         // prompt tokens
    SamplingParams sampling_params;
    std::promise<GenerationResult> result;  // fulfilled on completion
};

class RequestQueue {
    std::mutex mtx;
    std::condition_variable cv;
    std::queue<Request> pending;

public:
    void enqueue(Request req) {
        {
            std::lock_guard<std::mutex> lock(mtx);
            pending.push(std::move(req));
        }
        cv.notify_one();
    }

    std::vector<Request> drain(size_t max_batch) {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait(lock, [&] { return !pending.empty(); });

        std::vector<Request> batch;
        while (!pending.empty() && batch.size() < max_batch) {
            batch.push_back(std::move(pending.front()));
            pending.pop();
        }
        return batch;
    }
};
```

The scheduler thread calls `drain()`, which blocks until at least one request is available, then returns up to `max_batch` requests. The `std::promise`/`std::future` pair allows the request handler thread to asynchronously wait for the result and stream tokens back to the client.

This pattern --- lock-protected queue with condition variable notification --- is the backbone of every major serving engine, whether implemented in C++ (TensorRT-LLM), Rust (TGI's router), or a combination.

> **HW07 connection.** In the homework, you will build a simplified version of this architecture: a C++ serving engine with a CUDA paged attention kernel, block allocator, continuous batching scheduler, and HTTP endpoint.

---

## 9. Scaling and Production Deployment

### 9.1 Horizontal Scaling

For serving at scale, multiple model replicas run behind a load balancer:

```
                    ┌──────────────┐
                    │ Load Balancer│
                    └──────┬───────┘
              ┌────────────┼────────────┐
              v            v            v
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │Replica 0│ │Replica 1│ │Replica 2│
         │(4 GPUs) │ │(4 GPUs) │ │(4 GPUs) │
         └─────────┘ └─────────┘ └─────────┘
```

**Load balancing strategies** range from simple round-robin (ignores request complexity) to least-connections (ignores sequence lengths) to token-aware routing (routes based on estimated total tokens, requiring output length prediction) to prefix-aware routing (routes requests with shared prefixes to the same replica for cache reuse).

### 9.2 Capacity Planning

Given an SLA requiring:

- TTFT $\leq T_{\text{ttft}}$ at p99
- ITL $\leq T_{\text{itl}}$ at p99
- Arrival rate $\lambda$ requests per second
- Average prompt length $P$, average output length $G$

The minimum number of replicas (each with throughput capacity $\Theta$ tokens/s):

$$R = \left\lceil \frac{\lambda \cdot G}{\Theta} \right\rceil$$

But this ignores queueing effects. Using an M/G/1 queue model where each request has service time $S = T_{\text{prefill}}(P) + G \cdot T_{\text{decode}}$:

$$\text{p99 wait time} \approx \frac{\lambda \mathbb{E}[S^2]}{2(1 - \rho)} \cdot \ln(100)$$

> **Note:** The $\text{p99} \approx \mathbb{E}[W] \times \ln(100)$ relationship is a heuristic approximation valid when waiting times are approximately exponentially distributed (as in M/M/1 queues). For general M/G/1 queues with heavy-tailed service times, the actual p99 can be significantly higher. Use simulation or the exact Pollaczek-Khinchine transform for precise tail bounds.

where $\rho = \lambda \mathbb{E}[S]$ is the utilization. To meet the TTFT SLA:

$$T_{\text{ttft}} \geq T_{\text{prefill}}(P_{\text{p99}}) + \text{p99 wait time}$$

Solving for $R$ (each replica handles $\lambda / R$ arrival rate) typically requires numerical simulation due to the heavy-tailed distribution of service times.

### 9.3 GPU Multiplexing

Multiple models can share a single GPU using:

- **Temporal multiplexing:** Models take turns using the GPU. Context switching involves loading/unloading model weights --- expensive for large models.
- **Spatial multiplexing (MPS/MIG):** NVIDIA MPS (Multi-Process Service) allows concurrent kernel execution. MIG (Multi-Instance GPU) partitions an A100/H100 into isolated instances. Each instance has dedicated memory and compute.

**MIG partitioning on A100 80GB:**

| Profile | GPU Memory | SM Count | Use Case |
|---|---|---|---|
| 1g.10gb | 10 GB | 14 | Small models (< 5B at FP16) |
| 2g.20gb | 20 GB | 28 | Medium models (5--10B) |
| 3g.40gb | 40 GB | 42 | Larger models |
| 7g.80gb | 80 GB | 98 (full GPU) | Single large model |

### 9.4 Autoscaling

Cloud deployments use Kubernetes HPA (Horizontal Pod Autoscaler) to match capacity to demand. Typical scaling signals include GPU utilization (scale up above 70%), request queue depth (scale up above 10 pending requests), and custom metrics like mean TTFT.

Key configuration decisions:

- **Scale-up policy:** Aggressive (add replicas within 1--2 minutes) to handle traffic spikes.
- **Scale-down policy:** Conservative (wait 5+ minutes) to avoid thrashing.
- **Min replicas:** At least 2 for availability; cold start makes zero-scaling impractical for LLMs.

**Cold start problem:** Scaling up an LLM replica requires loading model weights into GPU memory (30--120 seconds for large models). Mitigations include pre-warmed standby replicas, shared filesystem model caching, and serverless platforms with keep-alive periods.

---

## Key Takeaways

1. **TensorRT-LLM delivers the highest single-GPU throughput** through aggressive compilation (layer fusion, kernel auto-tuning, precision calibration), but requires GPU-specific engine building and a non-standard model definition API.
2. **ONNX Runtime provides cross-platform inference** via the execution provider abstraction, making it ideal for heterogeneous deployments but typically not matching peak throughput of GPU-specific solutions.
3. **vLLM's architecture** (scheduler + block manager + workers) is built around PagedAttention, achieving high throughput through better memory utilization rather than faster kernels. Beneath the Python API, custom C++ extensions and CUDA kernels handle the performance-critical attention and cache management operations.
4. **Production inference servers use C++ for their critical path** because of latency control (no GIL), deterministic memory management (no GC pauses), and explicit threading. The typical architecture separates request handling, scheduling, and GPU execution into distinct thread pools connected by lock-protected queues.
5. **Framework selection depends on the use case:** TRT-LLM for maximum throughput on NVIDIA, vLLM for flexibility and broad model support, TGI for Hugging Face ecosystem integration, SGLang for structured generation.
6. **Production serving requires horizontal scaling**, with careful attention to load balancing (ideally prefix-aware or token-aware), capacity planning (queueing theory), and autoscaling (with mitigations for cold start latency).

---

## Further Reading

1. **Kwon et al.** "Efficient Memory Management for Large Language Model Serving with PagedAttention." SOSP 2023.
2. **NVIDIA.** "TensorRT-LLM: A TensorRT Toolbox for Optimized Large Language Model Inference." github.com/NVIDIA/TensorRT-LLM.
3. **Hugging Face.** "Text Generation Inference." github.com/huggingface/text-generation-inference.
4. **Zheng et al.** "SGLang: Efficient Execution of Structured Language Model Programs." arXiv 2024.
5. **Yu et al.** "Orca: A Distributed Serving System for Transformer-Based Generative Models." OSDI 2022.
6. **Patel et al.** "Splitwise: Efficient Generative LLM Inference Using Phase Splitting." ISCA 2024.
7. **Agrawal et al.** "Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve." OSDI 2024.
8. **ONNX Runtime Team.** "ONNX Runtime: cross-platform, high performance ML inferencing and training accelerator." onnxruntime.ai.
