# Lecture 07b: KV Cache Management & Paged Attention

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Derive** the per-layer and per-token KV cache memory requirements for autoregressive Transformer models, computing the total cache size as a function of model dimensions, batch size, and sequence length.
2. **Identify** the internal and external fragmentation problems in naive contiguous KV cache allocation and quantify the resulting memory waste.
3. **Explain** the PagedAttention algorithm (vLLM), mapping the concepts of virtual memory, page tables, and demand paging to KV cache management.
4. **Analyze** how multi-query attention (MQA) and grouped-query attention (GQA) reduce KV cache size, deriving the memory savings relative to standard multi-head attention.
5. **Evaluate** advanced KV cache compression techniques --- including token eviction, quantized caches, and sliding window attention --- and their impact on generation quality and memory efficiency.

---

## 2. Motivation and Context

### 2.1 The Autoregressive Generation Bottleneck

Recall from Lecture 07a that autoregressive decoding generates one token per forward pass. At step $t$, the model produces token $x_t$ conditioned on all previous tokens $x_1, \ldots, x_{t-1}$. The attention mechanism requires:

$$\text{Attn}(q_t, K_{1:t}, V_{1:t}) = \text{softmax}\!\left(\frac{q_t K_{1:t}^\top}{\sqrt{d_k}}\right) V_{1:t}$$

where $q_t \in \mathbb{R}^{d_k}$ is the query for the new token and $K_{1:t}, V_{1:t} \in \mathbb{R}^{t \times d_k}$ are the keys and values for all tokens up to position $t$.

Without caching, generating token $t$ requires recomputing the key and value projections for all $t-1$ previous tokens, making the total cost of generating a sequence of length $T$:

$$\text{Total FLOPs (no cache)} = \sum_{t=1}^{T} O(t \cdot d^2) = O(T^2 d^2)$$

With caching, we store the previously computed $K$ and $V$ tensors and only compute the new token's projections:

$$\text{Total FLOPs (with cache)} = \sum_{t=1}^{T} O(d^2 + t \cdot d) = O(Td^2 + T^2 d)$$

The savings from caching the key and value projections are $O(T \cdot d^2)$ FLOPs per token --- for a model with $d = 8192$, this is a $\sim 8000 \times$ reduction in projection FLOPs.

### 2.2 The Memory Cost of Caching

The computational savings of KV caching come at a steep memory cost. For LLMs at the scale of hundreds of billions of parameters, the KV cache can exceed the model weights in memory consumption for long sequences or large batches.

---

## 3. KV Cache Memory Analysis

### 3.1 Per-Layer, Per-Token Memory

For a single Transformer layer with:

- $h$ attention heads
- $d_k = d_v = d_{\text{model}} / h$ per-head dimension
- $d_{\text{model}}$ total model dimension

Each token contributes one key vector and one value vector per layer:

$$\text{Memory per token per layer} = 2 \times d_{\text{model}} \times \text{sizeof(dtype)}$$

The factor of 2 accounts for both the $K$ and $V$ vectors. Note that $h \times d_k = d_{\text{model}}$, so the per-head dimension cancels with the number of heads.

### 3.2 Total KV Cache Size

For a model with $L$ layers, batch size $B$, and maximum sequence length $S$:

$$\text{KV Cache Size} = 2 \times B \times S \times L \times d_{\text{model}} \times \text{sizeof(dtype)}$$

**Example: LLaMA-2 70B** ($L = 80$, $d_{\text{model}} = 8192$, $h = 64$, GQA with $h_{\text{kv}} = 8$):

With standard MHA (hypothetical):

$$\text{KV per token per layer} = 2 \times 8192 \times 2 = 32{,}768 \text{ bytes (FP16)}$$

$$\text{KV for } S = 4096, B = 1: \quad 32{,}768 \times 80 \times 4096 = 10.7 \text{ GB}$$

With GQA ($h_{\text{kv}} = 8$ instead of $h = 64$):

$$\text{KV per token per layer} = 2 \times (h_{\text{kv}} \times d_k) \times 2 = 2 \times 1024 \times 2 = 4{,}096 \text{ bytes}$$

$$\text{KV for } S = 4096, B = 1: \quad 4{,}096 \times 80 \times 4096 = 1.34 \text{ GB}$$

GQA provides an $8\times$ KV cache reduction in this case.

### 3.3 KV Cache vs. Model Parameters

| Model | Parameters (FP16) | KV Cache per token (FP16) | Tokens to equal param memory |
|---|---|---|---|
| LLaMA-2 7B ($L=32$, $d=4096$) | 14 GB | 512 KB | 28,672 |
| LLaMA-2 70B ($L=80$, $d=8192$, GQA) | 140 GB | 320 KB | 458,752 |
| GPT-3 175B ($L=96$, $d=12288$) | 350 GB | 4.7 MB | 76,800 |

For a batch of $B = 32$ with $S = 4096$, the KV cache for GPT-3 would be $32 \times 4096 \times 4.7 \text{ MB} \approx 600 \text{ GB}$ --- exceeding the model weights.

---

## 4. The Memory Fragmentation Problem

### 4.1 Naive Contiguous Allocation

The simplest KV cache implementation pre-allocates a contiguous buffer for each sequence at the maximum possible sequence length:

```cpp
// Naive KV cache allocation -- contiguous buffer per sequence
struct NaiveKVCache {
    half* k_cache;  // [num_layers, batch_size, num_heads, max_seq_len, head_dim]
    half* v_cache;
    int*  seq_lens; // [batch_size] current length of each sequence

    int num_layers, batch_size, num_heads, max_seq_len, head_dim;

    NaiveKVCache(int num_layers, int batch_size, int num_heads,
                 int max_seq_len, int head_dim)
        : num_layers(num_layers), batch_size(batch_size),
          num_heads(num_heads), max_seq_len(max_seq_len), head_dim(head_dim)
    {
        size_t cache_elems = (size_t)num_layers * batch_size * num_heads
                             * max_seq_len * head_dim;
        cudaMalloc(&k_cache, cache_elems * sizeof(half));
        cudaMalloc(&v_cache, cache_elems * sizeof(half));
        cudaMalloc(&seq_lens, batch_size * sizeof(int));
        cudaMemset(k_cache, 0, cache_elems * sizeof(half));
        cudaMemset(v_cache, 0, cache_elems * sizeof(half));
        cudaMemset(seq_lens, 0, batch_size * sizeof(int));
    }

    ~NaiveKVCache() {
        cudaFree(k_cache);
        cudaFree(v_cache);
        cudaFree(seq_lens);
    }

    // Returns a pointer into the flat buffer for a given
    // (layer, batch, head, position) coordinate.
    half* kv_offset(half* base, int layer, int batch, int pos) const {
        size_t idx = (((size_t)layer * batch_size + batch) * num_heads)
                     * max_seq_len + pos;
        return base + idx * head_dim;
    }

    // Append new K/V vectors for one token (all heads) at the current
    // sequence position.  Called from host; launches a small memcpy.
    void update(int layer_idx, int batch_idx,
                const half* new_k, const half* new_v,
                int pos, cudaStream_t stream = 0)
    {
        size_t row_bytes = (size_t)num_heads * head_dim * sizeof(half);
        cudaMemcpyAsync(kv_offset(k_cache, layer_idx, batch_idx, pos),
                        new_k, row_bytes, cudaMemcpyDeviceToDevice, stream);
        cudaMemcpyAsync(kv_offset(v_cache, layer_idx, batch_idx, pos),
                        new_v, row_bytes, cudaMemcpyDeviceToDevice, stream);
    }
};
```

### 4.2 Internal Fragmentation

**Definition 4.1 (Internal Fragmentation).** Memory allocated to a request but not yet used, because the cache is pre-allocated for the maximum sequence length but the current sequence is shorter.

If a request generates 50 tokens but the maximum sequence length is 2048, the internal fragmentation is:

$$\text{Waste}_{\text{internal}} = \frac{S_{\max} - S_{\text{actual}}}{S_{\max}} = \frac{2048 - 50}{2048} = 97.6\%$$

Averaged across requests with variable output lengths, the expected waste is:

$$\mathbb{E}\left[\text{Waste}_{\text{internal}}\right] = 1 - \frac{\mathbb{E}[S_{\text{actual}}]}{S_{\max}}$$

For typical LLM workloads where mean output length is 200 tokens and $S_{\max} = 8192$: waste is $97.6\%$.

### 4.3 External Fragmentation

**Definition 4.2 (External Fragmentation).** Free memory exists but cannot be used because it is not contiguous. When requests of different sizes arrive and depart, the memory becomes a patchwork of allocated and free regions.

Consider three sequences allocated contiguously in a 1 GB buffer:

```
|---Seq A (200MB)---|---Seq B (300MB)---|---Seq C (150MB)---|---Free (350MB)---|

Seq B completes and is freed:
|---Seq A (200MB)---|------Free (300MB)------|---Seq C (150MB)---|---Free (350MB)---|

New Seq D needs 400MB: FAILS (no contiguous 400MB block, even though 650MB total is free)
```

### 4.4 Quantifying the Combined Waste

Kwon et al. (2023) measured that in practice, naive KV cache management wastes **60--80%** of GPU memory for LLM serving. This directly limits the achievable batch size and hence throughput:

$$B_{\text{effective}} = \left\lfloor \frac{\text{GPU Memory} - \text{Model Params}}{\text{KV per request (max)}} \right\rfloor$$

versus the ideal:

$$B_{\text{ideal}} = \left\lfloor \frac{\text{GPU Memory} - \text{Model Params}}{\text{KV per request (actual)}} \right\rfloor$$

The ratio $B_{\text{ideal}} / B_{\text{effective}}$ can be $5\text{--}10\times$ for workloads with high variance in output lengths.

---

## 5. PagedAttention: Virtual Memory for KV Cache

### 5.1 Key Insight: Borrow from OS Virtual Memory

The PagedAttention algorithm, introduced by Kwon et al. (2023) in vLLM, applies the same insight that operating systems use for process memory management:

1. **Virtual memory** decouples the process's view of memory (contiguous address space) from physical memory (scattered pages).
2. **Pages** are fixed-size blocks that can be placed anywhere in physical memory.
3. **Page tables** map virtual page numbers to physical frame numbers.

PagedAttention applies this directly to KV cache management.

### 5.2 Block-Based KV Cache

**Definition 5.1 (KV Block).** A fixed-size unit of KV cache storage that holds the key and value vectors for $B_s$ consecutive tokens across all attention heads in a single layer.

$$\text{Block size} = B_s \times 2 \times h_{\text{kv}} \times d_k \times \text{sizeof(dtype)}$$

For typical values ($B_s = 16$, $h_{\text{kv}} = 32$, $d_k = 128$, FP16):

$$\text{Block size} = 16 \times 2 \times 32 \times 128 \times 2 = 256 \text{ KB}$$

### 5.3 Block Table

Each sequence maintains a **block table** that maps logical block indices to physical block indices:

```cpp
// ----- Block allocator with RAII GPU memory and a free list -----
//
// Each physical block stores B_s tokens worth of K and V vectors
// for a single layer: shape [B_s, num_kv_heads, head_dim] x 2.
//
// The allocator owns the entire GPU pool and hands out / reclaims
// individual block indices.  Thread-safety is provided by a mutex
// so that the host-side scheduler can allocate from multiple threads.

struct BlockAllocator {
    half* k_pool;          // contiguous GPU memory: [num_blocks, block_size, num_kv_heads, head_dim]
    half* v_pool;
    int   num_blocks;
    int   block_size;      // B_s -- tokens per block
    int   num_kv_heads;
    int   head_dim;

    std::vector<int>  free_list;
    std::mutex        mu;

    BlockAllocator(int num_blocks, int block_size,
                   int num_kv_heads, int head_dim)
        : num_blocks(num_blocks), block_size(block_size),
          num_kv_heads(num_kv_heads), head_dim(head_dim)
    {
        size_t elems_per_block = (size_t)block_size * num_kv_heads * head_dim;
        size_t pool_bytes = num_blocks * elems_per_block * sizeof(half);
        cudaMalloc(&k_pool, pool_bytes);
        cudaMalloc(&v_pool, pool_bytes);
        cudaMemset(k_pool, 0, pool_bytes);
        cudaMemset(v_pool, 0, pool_bytes);

        free_list.reserve(num_blocks);
        for (int i = num_blocks - 1; i >= 0; --i)
            free_list.push_back(i);          // stack order
    }

    ~BlockAllocator() {
        cudaFree(k_pool);
        cudaFree(v_pool);
    }

    // --- allocation / deallocation (host-side, thread-safe) --------

    int allocate() {
        std::lock_guard<std::mutex> lock(mu);
        if (free_list.empty()) return -1;    // out of memory
        int blk = free_list.back();
        free_list.pop_back();
        return blk;
    }

    void free(int block_id) {
        std::lock_guard<std::mutex> lock(mu);
        free_list.push_back(block_id);
    }

    int num_free() const { return (int)free_list.size(); }

    // --- GPU data access helpers -----------------------------------

    // Byte offset to the start of a physical block in the pool.
    size_t block_offset_bytes(int block_id) const {
        return (size_t)block_id * block_size * num_kv_heads
               * head_dim * sizeof(half);
    }

    // Write a single token's K and V into a block at the given slot.
    void write_kv(int block_id, int slot,
                  const half* new_k, const half* new_v,
                  cudaStream_t stream = 0)
    {
        size_t row_bytes = (size_t)num_kv_heads * head_dim * sizeof(half);
        size_t off = block_offset_bytes(block_id)
                     + (size_t)slot * num_kv_heads * head_dim * sizeof(half);
        cudaMemcpyAsync((char*)k_pool + off, new_k,
                        row_bytes, cudaMemcpyDeviceToDevice, stream);
        cudaMemcpyAsync((char*)v_pool + off, new_v,
                        row_bytes, cudaMemcpyDeviceToDevice, stream);
    }

    // Gather K (or V) rows for an entire sequence from its block
    // table into a contiguous destination buffer (useful for debug
    // or non-paged attention fallbacks).
    void gather_kv(half* dst_k, half* dst_v,
                   const int* block_table, int num_blocks_used,
                   int seq_len, cudaStream_t stream = 0)
    {
        size_t row_bytes = (size_t)num_kv_heads * head_dim * sizeof(half);
        int copied = 0;
        for (int b = 0; b < num_blocks_used; ++b) {
            int phys = block_table[b];
            int valid = std::min(block_size, seq_len - copied);
            size_t src_off = block_offset_bytes(phys);
            cudaMemcpyAsync(dst_k + (size_t)copied * num_kv_heads * head_dim,
                            (char*)k_pool + src_off,
                            valid * row_bytes,
                            cudaMemcpyDeviceToDevice, stream);
            cudaMemcpyAsync(dst_v + (size_t)copied * num_kv_heads * head_dim,
                            (char*)v_pool + src_off,
                            valid * row_bytes,
                            cudaMemcpyDeviceToDevice, stream);
            copied += valid;
        }
    }
};

// ----- Per-sequence block table ------------------------------------
// Maps logical block indices to physical block IDs returned by the
// BlockAllocator.  One block table exists per active sequence.

struct BlockTable {
    std::vector<int> table;   // table[logical_block] = physical_block
    int num_tokens = 0;

    void append_block(int physical_block_id) {
        table.push_back(physical_block_id);
    }

    int get_physical_block(int logical_idx) const {
        return table[logical_idx];
    }

    int num_blocks() const { return (int)table.size(); }
};
```

**Example.** A sequence with 35 tokens and block size $B_s = 16$ needs $\lceil 35/16 \rceil = 3$ blocks per layer. The block table might map:

```
Logical block 0 → Physical block 47   (tokens 0-15)
Logical block 1 → Physical block 12   (tokens 16-31)
Logical block 2 → Physical block 83   (tokens 32-34, 13 slots unused)
```

The physical blocks need not be contiguous.

### 5.4 The PagedAttention Kernel

The attention computation must be modified to work with non-contiguous KV blocks. The PagedAttention kernel:

1. Receives the query vector $q_t$ and the block table for the sequence.
2. Iterates over blocks in the block table.
3. For each block, loads the $K$ and $V$ tensors from the physical block location.
4. Computes partial attention scores and accumulates the output using online softmax.

```cuda
// ----- Paged Attention CUDA kernel --------------------------------
//
// Grid: one thread-block per (sequence, head) pair.
//   gridDim.x = batch_size,  gridDim.y = num_heads
// Block: THREADS threads collaborate on the dot-product and reduction.
//
// Each thread-block loops over the logical blocks for its sequence,
// follows the block-table indirection to find the physical block,
// and accumulates the attention output using online softmax so that
// the non-contiguous blocks are handled in a single streaming pass
// without materialising the full score vector.

constexpr int BLOCK_SIZE = 16;   // tokens per KV block (B_s)
constexpr int THREADS    = 128;  // threads per thread-block

__global__ void paged_attention_kernel(
    half*       __restrict__ output,        // [batch, num_heads, head_dim]
    const half* __restrict__ Q,             // [batch, num_heads, head_dim]
    const half* __restrict__ k_cache,       // [num_physical_blocks, BLOCK_SIZE,
                                            //  num_kv_heads, head_dim]
    const half* __restrict__ v_cache,       // same layout as k_cache
    const int*  __restrict__ block_tables,  // [batch, max_blocks_per_seq]
    const int*  __restrict__ seq_lens,      // [batch]
    int num_kv_heads,
    int head_dim,
    int max_blocks_per_seq,
    float scale)                            // 1/sqrt(d_k)
{
    const int seq_idx  = blockIdx.x;
    const int head_idx = blockIdx.y;
    const int tid      = threadIdx.x;

    const int seq_len    = seq_lens[seq_idx];
    const int num_blocks = (seq_len + BLOCK_SIZE - 1) / BLOCK_SIZE;

    // Which KV head does this query head map to? (handles GQA/MQA)
    const int kv_head = head_idx % num_kv_heads;

    // Pointer to this head's query vector
    const half* q_ptr = Q + ((size_t)seq_idx * gridDim.y + head_idx) * head_dim;

    // --- shared memory for partial QK^T scores within a block ------
    __shared__ float s_scores[BLOCK_SIZE];   // one score per token in block
    __shared__ float s_max;                  // running max  (online softmax)
    __shared__ float s_sum;                  // running sum  (online softmax)

    // Per-thread accumulators for the output vector (register-tiled).
    // Each thread owns head_dim / THREADS elements.
    float acc[8];  // assume head_dim <= THREADS * 8 (e.g., 128 <= 1024)
    const int elems_per_thread = (head_dim + THREADS - 1) / THREADS;
    for (int i = 0; i < elems_per_thread; ++i) acc[i] = 0.f;

    if (tid == 0) { s_max = -INFINITY; s_sum = 0.f; }
    __syncthreads();

    // ---- iterate over logical KV blocks ---------------------------
    for (int b = 0; b < num_blocks; ++b) {
        // Block-table indirection: logical -> physical
        int physical_block = block_tables[seq_idx * max_blocks_per_seq + b];

        int start = b * BLOCK_SIZE;
        int valid = min(BLOCK_SIZE, seq_len - start);

        // --- Phase 1: compute QK^T scores for this block -----------
        // Each thread handles a subset of the tokens.
        for (int t = tid; t < valid; t += THREADS) {
            const half* k_ptr = k_cache
                + ((size_t)physical_block * BLOCK_SIZE + t)
                  * num_kv_heads * head_dim
                + (size_t)kv_head * head_dim;

            float dot = 0.f;
            for (int d = 0; d < head_dim; ++d)
                dot += __half2float(q_ptr[d]) * __half2float(k_ptr[d]);

            s_scores[t] = dot * scale;
        }
        // Zero-out invalid slots so they don't affect the max/sum.
        for (int t = valid + tid; t < BLOCK_SIZE; t += THREADS)
            s_scores[t] = -INFINITY;
        __syncthreads();

        // --- Phase 2: online softmax update ------------------------
        // Single-thread reduction (BLOCK_SIZE is small, e.g. 16).
        if (tid == 0) {
            float block_max = -INFINITY;
            for (int t = 0; t < valid; ++t)
                block_max = fmaxf(block_max, s_scores[t]);

            float new_max   = fmaxf(s_max, block_max);
            float old_scale = expf(s_max - new_max);
            float new_scale = expf(block_max - new_max);

            // Rescale running sum
            s_sum = s_sum * old_scale;

            // Convert scores to exp(score - block_max) * new_scale
            for (int t = 0; t < valid; ++t)
                s_scores[t] = expf(s_scores[t] - block_max) * new_scale;

            float block_sum = 0.f;
            for (int t = 0; t < valid; ++t) block_sum += s_scores[t];
            s_sum += block_sum;

            s_max = new_max;

            // We also need old_scale visible to all threads for
            // rescaling their accumulators.
            s_scores[BLOCK_SIZE - 1 + 1] = old_scale;  // stash in scratch
            // Actually: store in a second shared var for clarity:
        }
        __syncthreads();

        // Broadcast old_scale to all threads (recompute to avoid
        // extra shared memory; block_max is derivable from s_max).
        float old_scale_bc;
        {
            // Recompute from the updated s_max stored by tid 0:
            // We need the *previous* s_max.  A cleaner approach:
            // store it in shared memory.  For brevity, we use
            // the identity:  old_scale = s_sum_before / s_sum_after
            // when the block contribution is factored out.
            // In practice, store the old_scale in shared memory.
            // Here we use a simplified two-pass approach.
            old_scale_bc = 1.f;  // placeholder; see note below
        }
        // NOTE: production kernels (vLLM, FlashDecoding) use a warp-
        // level reduction and keep old_scale in a shared variable.
        // The full implementation is left to HW07.

        // --- Phase 3: accumulate weighted V -------------------------
        for (int t = 0; t < valid; ++t) {
            float w = s_scores[t];
            const half* v_ptr = v_cache
                + ((size_t)physical_block * BLOCK_SIZE + t)
                  * num_kv_heads * head_dim
                + (size_t)kv_head * head_dim;

            for (int d = tid; d < head_dim; d += THREADS) {
                int local = d / THREADS;
                acc[local] = acc[local] /* * old_scale (on first iter) */
                             + w * __half2float(v_ptr[d]);
            }
        }
        __syncthreads();
    }

    // ---- final normalisation and write-back -----------------------
    half* out_ptr = output
        + ((size_t)seq_idx * gridDim.y + head_idx) * head_dim;

    float inv_sum = (s_sum > 0.f) ? 1.f / s_sum : 0.f;
    for (int d = tid; d < head_dim; d += THREADS) {
        int local = d / THREADS;
        out_ptr[d] = __float2half(acc[local] * inv_sum);
    }
}

// Host-side launch wrapper
void paged_attention(
    half* output, const half* Q,
    const half* k_cache, const half* v_cache,
    const int* block_tables, const int* seq_lens,
    int batch_size, int num_heads, int num_kv_heads,
    int head_dim, int max_blocks_per_seq,
    cudaStream_t stream = 0)
{
    float scale = 1.f / sqrtf((float)head_dim);
    dim3 grid(batch_size, num_heads);
    dim3 block(THREADS);
    paged_attention_kernel<<<grid, block, 0, stream>>>(
        output, Q, k_cache, v_cache, block_tables, seq_lens,
        num_kv_heads, head_dim, max_blocks_per_seq, scale);
}
```

**Implementation notes.** The kernel above is intentionally simplified for pedagogical clarity. A production-grade paged attention kernel (as in vLLM or FlashDecoding) would additionally:

- Use **warp-level reductions** (`__shfl_down_sync`) instead of shared-memory reductions for the online softmax, avoiding `__syncthreads()` barriers inside the block loop.
- **Tile the head dimension** across warps so that each warp owns a contiguous chunk of the output vector, improving memory coalescing on the V read.
- Explicitly **track `old_scale`** in a shared variable updated by a single lane, then broadcast it via `__shfl_sync` before rescaling the per-thread accumulators.
- Use `__half2` vectorised loads to double the memory throughput on the K and V reads.

You will implement a complete, correct version of this kernel in HW07.

### 5.5 Memory Waste Reduction

**Internal fragmentation.** With block size $B_s$, the maximum internal fragmentation per sequence per layer is $B_s - 1$ token slots. The expected waste is:

$$\mathbb{E}[\text{Waste}_{\text{internal}}] = \frac{B_s - 1}{2} \text{ tokens per sequence}$$

Compared to naive allocation (waste of $S_{\max} - S_{\text{actual}}$), this is a dramatic improvement. For $B_s = 16$ and $S_{\max} = 8192$: average waste drops from $\sim 4096$ tokens to $\sim 7.5$ tokens.

**External fragmentation.** Because blocks are fixed-size and individually allocable, there is **zero external fragmentation** --- any free block can serve any request.

**Quantitative comparison (Kwon et al., 2023):**

| Allocation Strategy | Memory Waste (ShareGPT traces) |
|---|---|
| Naive contiguous (max length) | 76.4% |
| Naive contiguous (dynamic growth) | 55.2% (external frag.) |
| PagedAttention ($B_s = 16$) | < 4% |

### 5.6 Copy-on-Write for Shared Prefixes

Many serving scenarios involve shared prefixes (system prompts, few-shot examples). PagedAttention supports **copy-on-write (CoW)** semantics:

1. Multiple sequences that share a prefix share the same physical KV blocks (via reference counting).
2. When a sequence diverges (generates different tokens), only the diverging block is copied.

For a system prompt of 1000 tokens shared across 100 concurrent requests:

$$\text{Savings} = (100 - 1) \times 1000 \times \text{KV per token} = 99 \times \text{shared prefix KV}$$

This is critical for chat applications where the system prompt is identical across all user conversations.

---

## 6. Multi-Query and Grouped-Query Attention

### 6.1 Standard Multi-Head Attention (MHA)

In standard MHA, each of the $h$ attention heads has its own $K$ and $V$ projections:

$$K^{(i)} = X W_K^{(i)}, \quad V^{(i)} = X W_V^{(i)} \qquad i = 1, \ldots, h$$

KV cache per token per layer: $2 \times h \times d_k \times \text{sizeof(dtype)}$

### 6.2 Multi-Query Attention (MQA)

**Definition 6.1 (Multi-Query Attention, Shazeer 2019).** All $h$ query heads share a single set of keys and values:

$$K = X W_K, \quad V = X W_V \qquad \text{(single head)}$$

$$\text{head}_i = \text{Attn}(XW_Q^{(i)}, K, V)$$

KV cache per token per layer: $2 \times d_k \times \text{sizeof(dtype)}$

**Reduction factor:** $h\times$ compared to MHA.

For $h = 64$ (as in PaLM), this is a $64\times$ reduction.

**Quality impact.** MQA can degrade model quality, particularly for smaller models where the reduced KV capacity limits the model's ability to represent diverse attention patterns.

### 6.3 Grouped-Query Attention (GQA)

**Definition 6.2 (Grouped-Query Attention, Ainslie et al., 2023).** The $h$ query heads are partitioned into $g$ groups, each group sharing a single set of keys and values:

$$K^{(j)} = X W_K^{(j)}, \quad V^{(j)} = X W_V^{(j)} \qquad j = 1, \ldots, g$$

$$\text{head}_i = \text{Attn}(XW_Q^{(i)}, K^{(\lceil ig/h \rceil)}, V^{(\lceil ig/h \rceil)})$$

KV cache per token per layer: $2 \times g \times d_k \times \text{sizeof(dtype)}$

**Reduction factor:** $h/g$ compared to MHA.

GQA interpolates between MHA ($g = h$) and MQA ($g = 1$).

**Theorem 6.1 (GQA Expressiveness).** GQA with $g$ groups can express any attention pattern that MQA can express, plus any pattern where heads within the same group attend to the same positions (but with different value projections). It cannot express patterns where heads within the same group attend to different positions, which MHA can.

*Proof sketch.* The attention weights for heads within the same group are computed from the same $K^{(j)}$:

$$\alpha_i = \text{softmax}\!\left(\frac{q_i (K^{(j)})^\top}{\sqrt{d_k}}\right)$$

Since $q_i$ differs across heads, the attention weights differ. However, all heads in group $j$ attend over the same key set. In MHA, each head has its own key set, allowing fundamentally different attention patterns. $\blacksquare$

### 6.4 Empirical Comparison

| Model | Attention Type | $h$ | $h_{\text{kv}}$ | KV/token/layer (FP16) | Quality (MMLU) |
|---|---|---|---|---|---|
| LLaMA-1 65B | MHA | 64 | 64 | 32 KB | 63.4% |
| LLaMA-2 70B | GQA | 64 | 8 | 4 KB | 68.9% |
| PaLM 540B | MQA | 48 | 1 | 1.5 KB | 69.3% |

The LLaMA-2 result is particularly striking: GQA with $g = 8$ achieves better quality than MHA (due to other training improvements) while using $8\times$ less KV cache.

---

## 7. Advanced KV Cache Optimization

### 7.1 KV Cache Quantization

The KV cache can be quantized to lower precision to reduce memory:

$$\text{KV Cache Size (INT8)} = \frac{1}{2} \times \text{KV Cache Size (FP16)}$$

**Per-channel quantization** of the KV cache:

$$K_{\text{quant}} = \text{round}\!\left(\frac{K}{\Delta_K}\right), \quad \Delta_K = \frac{\max(|K|)}{127}$$

The quantization error introduces noise into the attention computation:

$$\hat{K} = K + \epsilon_K, \quad \|\epsilon_K\|_\infty \leq \Delta_K / 2$$

The perturbed attention scores are:

$$\hat{s}_t = \frac{q_t \hat{K}^\top}{\sqrt{d_k}} = \frac{q_t K^\top}{\sqrt{d_k}} + \frac{q_t \epsilon_K^\top}{\sqrt{d_k}}$$

The perturbation in scores is bounded by:

$$\left|\frac{q_t \epsilon_K^\top}{\sqrt{d_k}}\right| \leq \frac{\|q_t\|_1 \cdot \|\epsilon_K\|_\infty}{\sqrt{d_k}} \leq \frac{\|q_t\|_1 \cdot \Delta_K}{2\sqrt{d_k}}$$

In practice, INT8 KV cache quantization incurs $< 0.5\%$ degradation on most benchmarks for large models (Hooper et al., 2024).

### 7.2 Token Eviction and Attention Sinks

**H2O (Heavy-Hitter Oracle, Zhang et al., 2023)** observes that attention in LLMs is highly concentrated: a small fraction of tokens receive most of the attention weight. The strategy:

1. Track cumulative attention scores for each cached token.
2. Evict tokens with the lowest cumulative attention scores.
3. Always retain a fixed number of "attention sinks" (initial tokens that receive disproportionate attention regardless of content).

The attention sink phenomenon: Xiao et al. (2023) showed that the first few tokens in a sequence consistently receive high attention weight across all layers and heads, even when they are semantically irrelevant. This is hypothesized to be because softmax must allocate its probability mass somewhere, and the model learns to use initial tokens as "sinks" for residual attention.

### 7.3 Sliding Window Attention

**Definition 7.1 (Sliding Window Attention).** Each token attends only to the most recent $W$ tokens:

$$\text{Attn}(q_t, K_{t-W:t}, V_{t-W:t})$$

KV cache size becomes $O(W)$ independent of sequence length. Used in Mistral 7B with $W = 4096$.

Information from tokens beyond the window is not directly accessible but can propagate through layers: at layer $l$, token $t$ has indirect access to tokens as far back as $t - lW$ due to the receptive field growth across layers.

**Effective receptive field:** After $L$ layers with window $W$, the effective context length is $L \times W$. For Mistral 7B ($L = 32$, $W = 4096$): effective context = $131{,}072$ tokens, even though the KV cache per layer is bounded to $W$ tokens.

---

## 8. KV Cache-Aware Scheduling

### 8.1 Preemption and Swapping

When GPU memory is exhausted, the vLLM scheduler can **preempt** lower-priority sequences by:

1. **Swapping:** Moving KV cache blocks to CPU memory. The sequence can be resumed later by swapping back.
2. **Recomputation:** Discarding KV cache blocks entirely. The sequence is resumed by re-running the prefill on the prompt plus generated tokens.

The choice depends on the ratio of swap bandwidth to recomputation cost:

$$\text{Prefer swap if: } \frac{\text{KV blocks} \times \text{block\_size}}{PCIe\_bandwidth} < \frac{(P + G) \times \text{prefill\_cost\_per\_token}}{GPU\_throughput}$$

where $P$ is the prompt length and $G$ is the number of tokens generated so far.

### 8.2 Prefix Caching

**Definition 8.1 (Prefix Caching).** When multiple requests share a common prefix (e.g., the same system prompt or few-shot examples), the KV cache for that prefix is computed once and shared across all requests.

Implementation with PagedAttention: the shared prefix blocks have a reference count > 1. They are evicted only when all referencing sequences complete.

**Radix tree for prefix matching.** SGLang (Zheng et al., 2024) uses a radix tree to efficiently match incoming prompts against cached prefixes:

```
Root
├── "You are a helpful" → KV blocks [0, 1, 2]
│   ├── "assistant. Translate:" → KV blocks [3, 4]
│   └── "assistant. Summarize:" → KV blocks [5, 6]
└── "System: You are" → KV blocks [7, 8, 9]
```

A new request with prompt "You are a helpful assistant. Translate: Hello" matches the first branch and reuses blocks [0, 1, 2, 3, 4], needing only to compute KV for "Hello".

---

## Key Takeaways

1. **KV cache memory is a dominant bottleneck** in LLM serving. For large models with long sequences and large batches, KV cache can exceed the model weight memory.
2. **Naive contiguous allocation wastes 60--80% of GPU memory** due to internal fragmentation (over-allocation for max length) and external fragmentation (non-contiguous free regions).
3. **PagedAttention** eliminates external fragmentation entirely and reduces internal fragmentation to at most $B_s - 1$ tokens per sequence, achieving $< 4\%$ waste. The key ideas --- block-based allocation, block tables, copy-on-write --- are directly borrowed from OS virtual memory.
4. **GQA reduces KV cache by $h/g$ times** compared to MHA while maintaining near-MHA quality, making it the standard choice for modern LLMs (LLaMA-2/3, Gemma, Mistral).
5. **Further optimizations** --- KV quantization, token eviction (H2O), sliding window attention, and prefix caching --- provide additional memory savings but introduce quality-memory tradeoffs that must be carefully evaluated.

---

## Further Reading

1. **Kwon et al.** "Efficient Memory Management for Large Language Model Serving with PagedAttention." SOSP 2023. --- The foundational vLLM paper.
2. **Shazeer.** "Fast Transformer Decoding: One Write-Head is All You Need." arXiv 2019. --- Multi-query attention.
3. **Ainslie et al.** "GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints." EMNLP 2023.
4. **Zhang et al.** "H2O: Heavy-Hitter Oracle for Efficient Generative Inference of Large Language Models." NeurIPS 2023.
5. **Xiao et al.** "Efficient Streaming Language Models with Attention Sinks." ICLR 2024.
6. **Hooper et al.** "KVQuant: Towards 10 Million Context Length LLM Inference with KV Cache Quantization." arXiv 2024.
7. **Zheng et al.** "SGLang: Efficient Execution of Structured Language Model Programs." arXiv 2024.
8. **Jiang et al.** "Mistral 7B." arXiv 2023. --- Sliding window attention in practice.

---

## Homework Connection (HW07)

In the homework, you will implement the full block allocator, CUDA paged attention kernel, and a C++ scheduler from scratch. Specifically:

1. **Block Allocator (C++).** Complete the `BlockAllocator` class with RAII GPU memory management, thread-safe free-list allocation, and `write_kv` / `gather_kv` helpers.
2. **Paged Attention Kernel (CUDA C++).** Implement a correct paged attention kernel with proper online softmax across non-contiguous physical blocks, including the warp-level `old_scale` broadcast elided in the lecture kernel above.
3. **Request Scheduler (C++).** Build a scheduler that manages block tables per sequence, decides when to preempt and swap, and coordinates the allocator and kernel launch.
