# Lecture 10b: Long-Context Systems & Retrieval-Augmented Generation Infrastructure

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Analyze** the memory and compute bottlenecks of long-context Transformer inference, deriving KV cache size and attention FLOPs as functions of sequence length, and identifying the crossover points where each becomes dominant.
2. **Design** a ring attention or sequence parallelism strategy for distributing long-context computation across multiple devices, accounting for communication overlap and memory constraints.
3. **Evaluate** sparse attention patterns (sliding window, dilated, landmark) in terms of their approximation quality, memory savings, and implementation complexity on GPU hardware.
4. **Compare** sub-quadratic attention alternatives (linear attention, state-space models) to standard Transformers, analyzing the systems-level tradeoffs in training parallelism, inference memory, and per-step compute.
5. **Architect** a retrieval-augmented generation (RAG) pipeline, selecting appropriate vector database, embedding model, chunking strategy, and retrieval algorithm for a given latency and accuracy requirement.
6. **Implement** an end-to-end RAG system with vector indexing, approximate nearest neighbor search, and retrieval-augmented prompt construction.

---

## 2. Motivation and Context

### 2.1 The Context Length Frontier

Context length has grown rapidly across model generations:

| Model | Year | Max Context | KV Cache (BF16, 70B-class) |
|-------|------|-------------|---------------------------|
| GPT-3 | 2020 | 2,048 | 2.6 GB |
| GPT-4 | 2023 | 8,192 / 32,768 | 10.5 / 42 GB |
| Claude 3 | 2024 | 200,000 | 256 GB |
| Gemini 1.5 | 2024 | 1,000,000 | 1.28 TB |

These numbers reveal the core systems challenge: **long contexts are a memory problem, not a compute problem**. At 1M tokens, the KV cache alone exceeds the memory of any single GPU.

### 2.2 Why Long Context Matters

Long context enables:

- **Document understanding**: Processing entire books, codebases, or legal documents.
- **Multi-turn conversation**: Retaining full conversation history without summarization.
- **In-context learning**: More examples in the prompt improve task performance.
- **Reduced retrieval dependence**: The model can "see" more of the relevant corpus directly.

### 2.3 RAG as a Complementary Approach

Retrieval-Augmented Generation addresses the same need from a different angle: instead of fitting everything in context, retrieve the most relevant information on demand. RAG trades context length for retrieval quality, offering:

- **Constant memory**: KV cache size is independent of corpus size.
- **Updatable knowledge**: The retrieval index can be updated without retraining.
- **Attribution**: Retrieved passages provide citations for generated text.

### 2.4 Connection to Prior Lectures

- **Lecture 02d (Flash Attention)**: The IO-aware attention algorithm that makes long-context training feasible.
- **Lecture 04b (Model Parallelism)**: Sequence parallelism as a strategy for distributing long-context computation.
- **Lecture 07b (KV Cache)**: Paged attention and KV cache management are foundational for long-context serving.

---

## 3. Long-Context Challenges

### 3.1 Attention Complexity

Standard self-attention computes:

$$\text{Attn}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

For sequence length $S$, head dimension $d_k$, and $h$ heads:

$$\text{FLOPs}_{\text{attn}} = 4S^2 d_k h = 4S^2 d$$

where $d = d_k h$ is the model dimension. The quadratic scaling means:

| Sequence Length | Attention FLOPs (d=4096) | Ratio to S=2K |
|----------------|--------------------------|---------------|
| 2,048 | 6.7 x 10^10 | 1x |
| 32,768 | 1.7 x 10^13 | 256x |
| 131,072 | 2.7 x 10^14 | 4096x |
| 1,000,000 | 1.6 x 10^16 | 238,000x |

### 3.2 KV Cache Memory

During autoregressive generation, the KV cache stores key and value tensors for all previous tokens. For a model with $L$ layers, $h$ heads, head dimension $d_k$, and sequence length $S$:

$$M_{\text{KV}} = 2 \cdot L \cdot h \cdot d_k \cdot S \cdot \text{sizeof(dtype)} = 2LdS \cdot \text{sizeof(dtype)}$$

For a 70B-class model ($L = 80$, $d = 8192$) in BF16:

$$M_{\text{KV}} = 2 \times 80 \times 8192 \times S \times 2 = 2.62 \times 10^6 \cdot S \text{ bytes}$$

| Sequence Length | KV Cache Size | A100 80GB Budget |
|----------------|---------------|-------------------|
| 4,096 | 10.7 GB | Fits easily |
| 32,768 | 85.9 GB | Exceeds single GPU |
| 131,072 | 343 GB | Needs 5+ GPUs |
| 1,000,000 | 2.62 TB | Needs 33+ GPUs |

### 3.3 Memory vs Compute Regimes

At inference (generating one token), the attention computation is:

$$\text{FLOPs}_{\text{attn/token}} = 2 \cdot S \cdot d_k \cdot h = 2Sd$$

The memory bandwidth required to read the KV cache:

$$\text{Bytes}_{\text{KV/token}} = 2 \cdot L \cdot S \cdot d_k \cdot h \cdot \text{sizeof(dtype)} = 2LdS \cdot \text{sizeof(dtype)}$$

The arithmetic intensity (FLOPs per byte) for the attention portion of decoding:

$$\text{AI}_{\text{attn}} = \frac{2Sd}{2LdS \cdot \text{sizeof(dtype)}} = \frac{1}{L \cdot \text{sizeof(dtype)}}$$

For $L = 80$ layers and BF16: $\text{AI} = 1/(80 \times 2) = 0.00625$ FLOPs/byte.

This is far below the compute-to-bandwidth ratio of any GPU (~312 on H100), meaning **long-context decoding is entirely memory-bandwidth bound**. The sequence length cancels out -- longer contexts do not change the arithmetic intensity, but they do increase the absolute memory required.

---

## 4. Ring Attention and Sequence Parallelism

### 4.1 The Idea

Ring attention (Liu et al., 2023) distributes a long sequence across $N$ devices in a ring topology. Each device holds $S/N$ tokens and their corresponding KV cache. Attention is computed incrementally by passing KV blocks around the ring.

### 4.2 Algorithm

```
Algorithm: RING_ATTENTION
Input:
  Q_local, K_local, V_local on each device (S/N tokens each)
  N devices in a ring

Output:
  Attn output O_local on each device

1. Each device i initializes:
     O_i = 0                          # Running output accumulator
     l_i = 0                          # Running log-sum-exp denominator
     K_recv = K_local, V_recv = V_local

2. For step s = 0, 1, ..., N-1:
   a. Compute partial attention:
        S_partial = Q_local @ K_recv.T / sqrt(d_k)    # (S/N, S/N)
        m_new = max(m_old, rowmax(S_partial))           # Safe softmax
        P_partial = exp(S_partial - m_new)              # Partial attention weights

   b. Online softmax update (from Flash Attention):
        correction = exp(m_old - m_new)
        l_i = correction * l_i + P_partial.sum(dim=-1)
        O_i = correction * O_i + P_partial @ V_recv

   c. Asynchronous send/receive (ring):
        Send K_recv, V_recv to next device (i+1) % N
        Receive K_recv, V_recv from prev device (i-1) % N

3. Final normalization:
     O_i = O_i / l_i
```

### 4.3 Communication-Computation Overlap

The key insight is that step 2c (communication) can overlap with step 2a-b (computation) of the next iteration:

```
  Step 0:  [Compute attn(Q, KV_0)]  [Send KV_0 -> next, Recv KV_{N-1}]
  Step 1:  [Compute attn(Q, KV_{N-1})] [Send KV_{N-1} -> next, Recv KV_{N-2}]
  ...
```

**Communication volume per step:** $2 \times (S/N) \times d \times \text{sizeof(dtype)}$ bytes (K and V).

**Computation per step:** $4 \times (S/N)^2 \times d$ FLOPs.

The communication is hidden when:

$$T_{\text{comm}} \leq T_{\text{comp}}$$
$$\frac{2 \cdot (S/N) \cdot d \cdot \text{sizeof(dtype)}}{\text{BW}_{\text{link}}} \leq \frac{4 \cdot (S/N)^2 \cdot d}{\text{FLOPS}_{\text{GPU}}}$$

Simplifying:

$$S/N \geq \frac{\text{FLOPS}_{\text{GPU}} \cdot \text{sizeof(dtype)}}{2 \cdot \text{BW}_{\text{link}}}$$

For H100 (990 TFLOPS BF16, 450 GB/s NVLink per-direction (900 GB/s bidirectional total)):

$$S/N \geq \frac{990 \times 10^{12} \times 2}{2 \times 450 \times 10^9} \approx 2200 \text{ tokens}$$

This means each device needs at least ~2200 tokens for the communication to be fully hidden.

### 4.4 Memory Scaling

With ring attention, each device stores:

- **Q, K, V for local tokens**: $3 \times (S/N) \times d \times \text{sizeof(dtype)}$
- **KV receive buffer**: $2 \times (S/N) \times d \times \text{sizeof(dtype)}$ (one block from another device)
- **Output accumulator**: $(S/N) \times d \times \text{sizeof(dtype)}$

Total per-device memory for attention: $O(S \cdot d / N)$ -- linear in $S/N$.

The KV cache during inference is similarly distributed:

$$M_{\text{KV/device}} = \frac{2LdS \cdot \text{sizeof(dtype)}}{N}$$

This enables serving 1M-token contexts across a cluster: with $N = 32$ GPUs, each stores $\approx 82$ GB of KV cache.

---

## 5. Sparse Attention Patterns

### 5.1 Sliding Window Attention

**Definition.** Each token attends only to the $w$ most recent tokens:

$$\text{Attn}(q_i, K, V) = \text{softmax}\left(\frac{q_i K_{[i-w:i]}^T}{\sqrt{d_k}}\right) V_{[i-w:i]}$$

**Complexity:** $O(S \cdot w \cdot d)$ -- linear in $S$ for fixed $w$.

**KV cache:** Only $w$ entries per layer, regardless of total sequence length:

$$M_{\text{KV}} = 2Lwd \cdot \text{sizeof(dtype)}$$

For Mistral ($w = 4096$, $L = 32$, $d = 4096$): $M_{\text{KV}} = 2 \times 32 \times 4096 \times 4096 \times 2 = 2.1$ GB.

**Limitation.** Information beyond the window is invisible. For tasks requiring global context (e.g., answering questions about the beginning of a document), sliding window alone is insufficient.

### 5.2 Sliding Window + Global Tokens

Combine local sliding window attention with a set of $g$ global tokens that attend to and are attended by all positions:

$$\text{Attn}(q_i, K, V) = \begin{cases} \text{softmax}(\frac{q_i K^T}{\sqrt{d_k}}) V & \text{if } i \text{ is global} \\ \text{softmax}(\frac{q_i K_{[i-w:i] \cup G}^T}{\sqrt{d_k}}) V_{[i-w:i] \cup G} & \text{otherwise} \end{cases}$$

where $G$ is the set of global token indices.

**Complexity:** $O(S \cdot (w + g) \cdot d)$ for $S - g$ local tokens plus $O(g \cdot S \cdot d)$ for $g$ global tokens. Total: $O(S \cdot (w + g) \cdot d + g \cdot S \cdot d) \approx O(S \cdot w \cdot d)$ when $g \ll w$.

### 5.3 Dilated Attention

**Definition.** Tokens attend to positions at regular intervals (dilation rate $r$) in addition to local context:

$$\text{positions}(i) = \{i - w, \ldots, i\} \cup \{i - rw, i - r(w-1), \ldots, i\}$$

This creates a receptive field that grows exponentially with the number of layers, analogous to dilated convolutions. After $L$ layers with dilation rate $r$, the effective receptive field is $w \cdot r^L$.

### 5.4 Landmark Attention

Landmark attention (Mohtashami and Jaggi, 2023) inserts special "landmark" tokens at regular intervals. These landmarks compress the information of the tokens they represent:

```
Tokens:    [t0 t1 t2 t3 LM t4 t5 t6 t7 LM t8 t9 t10 t11 LM ...]
                         ^                  ^                  ^
                    Landmark 1         Landmark 2         Landmark 3
```

During attention, a token first attends to landmarks to determine which blocks are relevant, then attends to the full tokens in the selected blocks.

**Two-stage attention:**

1. **Coarse selection**: $\text{scores}_{\text{coarse}} = q_i \cdot K_{\text{landmarks}}^T / \sqrt{d_k}$
2. **Fine attention**: Attend to tokens in top-$k$ blocks selected by coarse scores.

**Complexity:** $O(S/b \cdot d + k \cdot b \cdot d)$ per query, where $b$ is the block size and $k$ is the number of selected blocks. For $k \ll S/b$, this is sublinear in $S$.

### 5.5 Implementation Considerations

Sparse attention patterns require custom CUDA kernels because the standard FlashAttention implementation assumes dense attention masks. The implementation challenges include:

1. **Block-sparse storage**: Store the attention mask as a set of non-zero blocks. Use block-sparse matrix multiplication kernels.
2. **Memory access patterns**: Sparse patterns create irregular memory accesses that can hurt GPU throughput. Block sizes must align with GPU warp sizes (32 threads) and shared memory tile sizes.
3. **Causal masking interaction**: The sparse pattern must be intersected with the causal mask, which can create irregular block shapes.

Frameworks like xformers and FlashAttention 2 support configurable block-sparse attention patterns.

---

## 6. State-Space Models and Sub-Quadratic Attention Alternatives

### 6.1 The Quadratic Attention Bottleneck (Recap)

Standard attention costs $O(N^2 d)$ compute and $O(N^2)$ memory for sequence length $N$ and model dimension $d$. FlashAttention (Lecture 02d) reduces the memory to $O(N)$ by tiling, but the FLOP count remains $O(N^2 d)$ -- it is an IO optimization, not an algorithmic one.

To make the scale concrete: for $N = 10^6$ tokens, $N^2 = 10^{12}$ attention entries per layer per head. Even at H100 peak throughput (990 TFLOPS), a single attention layer with $d = 4096$ would require $\sim 4 \times 10^{15}$ FLOPs, or roughly 4 seconds of sustained peak compute -- per layer. With 80 layers, this is over 5 minutes for a single forward pass. This motivates architectures that break the quadratic barrier entirely. The sparse attention patterns of Section 5 reduce the constant but keep the fundamental scaling. The approaches below change the asymptotic complexity itself.

### 6.2 Linear Attention

**Kernel substitution.** Katharopoulos et al. (2020) replace the softmax attention kernel with a decomposable feature map $\phi$:

$$\text{Attn}(Q, K, V) = \text{softmax}(QK^T)V \;\;\longrightarrow\;\; \phi(Q)\bigl(\phi(K)^T V\bigr)$$

where $\phi: \mathbb{R}^d \to \mathbb{R}^{d'}$ is a non-negative feature map applied row-wise to $Q$ and $K$.

**Key insight: associativity of matrix multiplication.** In standard attention the product $QK^T$ (an $N \times N$ matrix) must be formed first. With a feature map $\phi: \mathbb{R}^d \to \mathbb{R}^{d'}$, we can instead compute $\phi(K)^T V$ first, which is a $d' \times d$ matrix independent of $N$:

$$\text{Cost: } O(N d'^2) \text{ instead of } O(N^2 d)$$

For $d' \approx d$ and $N \gg d$, this is a dramatic reduction. For example, with $N = 10^6$ and $d = 128$ (per head), standard attention costs $\sim 10^{12} \cdot 128 = 1.28 \times 10^{14}$ FLOPs, while linear attention costs $\sim 10^6 \cdot 128^2 = 1.64 \times 10^{10}$ -- a $\sim$8000x reduction.

**Trade-offs.** Linear attention is approximate: the feature map $\phi$ cannot perfectly replicate softmax, and quality degrades for long-range dependencies where the softmax distribution is sharply peaked. In practice, linear attention models underperform standard Transformers on tasks requiring precise token-level retrieval (e.g., copying, associative recall). The connection to kernel methods is direct -- softmax attention corresponds to an infinite-dimensional kernel, and $\phi$ approximates it via random features (Rahimi and Recht, 2007). Common choices for $\phi$ include the ELU-based map $\phi(x) = \text{elu}(x) + 1$ and random Fourier features.

### 6.3 State-Space Models (S4 / Mamba)

**Continuous SSM formulation.** State-space models define a linear dynamical system:

$$x'(t) = Ax(t) + Bu(t), \qquad y(t) = Cx(t) + Du(t)$$

where $u(t) \in \mathbb{R}$ is the input signal, $x(t) \in \mathbb{R}^{d_s}$ is the hidden state, and $y(t) \in \mathbb{R}$ is the output. The matrices $A \in \mathbb{R}^{d_s \times d_s}$, $B \in \mathbb{R}^{d_s \times 1}$, $C \in \mathbb{R}^{1 \times d_s}$, and $D \in \mathbb{R}$ are learnable parameters. In a deep SSM, independent SSMs operate on each channel of the model dimension, so the total state size is $d \times d_s$.

**Discretization.** For discrete sequences (e.g., tokens), apply a step size $\Delta$ to convert to a recurrence:

$$x_k = \bar{A}\, x_{k-1} + \bar{B}\, u_k, \qquad y_k = C\, x_k + D\, u_k$$

where $\bar{A} = \exp(\Delta A)$ and $\bar{B} = (\Delta A)^{-1}(\bar{A} - I)\Delta B$ (zero-order hold discretization). Note that the recurrence is inherently causal: $y_k$ depends only on $u_1, \ldots, u_k$, so no causal mask is needed -- causality is built into the structure.

**Complexity.** Each step requires $O(d_s^2)$ work (matrix-vector product with $\bar{A}$). For a sequence of length $N$, total compute is $O(N d_s^2)$ and memory per step is $O(d_s)$ -- constant in $N$. In practice, $d_s$ (the state dimension) is typically 16-64 per channel, much smaller than the sequence length.

**S4 (Gu et al., 2022).** Structured State Spaces for Sequence Modeling introduces HiPPO initialization for $A$, which is designed to optimally compress continuous history into the state vector. Specifically, HiPPO constructs $A$ so that the state $x_k$ approximates a projection of the input history onto a polynomial basis, giving the recurrence a principled notion of "memory." S4 also exploits the fact that the discrete recurrence (with time-invariant $\bar{A}, \bar{B}, C$) is a linear convolution, enabling $O(N \log N)$ parallel training via FFT. This dual view -- recurrence for inference, convolution for training -- is a central design principle.

**Mamba (Gu and Dao, 2023).** Mamba introduces *selective* state spaces: the parameters $\Delta$, $B$, and $C$ are made functions of the input, creating data-dependent dynamics:

$$\Delta_k = \text{softplus}(\text{Linear}(u_k)), \quad B_k = \text{Linear}(u_k), \quad C_k = \text{Linear}(u_k)$$

This selection mechanism allows the model to decide, at each step, how much to retain or forget from the state -- analogous to gating in LSTMs but within the SSM framework. The input dependence breaks the convolution structure (the kernel is no longer time-invariant), so Mamba uses a hardware-aware parallel scan algorithm on GPU instead of FFT. The parallel scan computes all $N$ state updates in $O(N \log N)$ work and $O(\log N)$ depth, enabling efficient training on long sequences.

### 6.4 Systems Implications: Recurrence vs. Attention

The architectural difference between Transformers and SSMs has direct consequences for hardware utilization.

**Training.** SSMs use a parallel scan (or convolution for S4) with $O(N \log N)$ or $O(N d_s^2)$ work, compared to attention's $O(N^2 d)$ tiled GEMM. Attention maps naturally to highly optimized matrix multiplication kernels (cuBLAS, CUTLASS); the parallel scan has lower theoretical cost but a smaller ratio of arithmetic to memory operations, making it harder to saturate GPU compute. Mamba's hardware-aware scan fuses the discretization, scan, and output projection into a single kernel to minimize HBM reads, analogous to how FlashAttention fuses the attention computation.

**Prefill.** During prompt processing, attention benefits from large batch GEMM across all $N$ tokens simultaneously. SSMs must execute the scan sequentially in $O(\log N)$ depth (with work-efficient parallel scan). In practice, Mamba's prefill throughput is competitive with FlashAttention for $N > 2K$ tokens but can be slower for short sequences where GEMM efficiency dominates.

**Inference.** SSMs process each new token with a fixed-size state update: $O(d_s^2)$ per step and $O(d_s^2)$ memory for the state. Transformers require reading the entire KV cache at each step: $O(Nd)$ compute per step and $O(Nd)$ memory that grows linearly with context. This means SSMs have **no KV cache** -- a fundamental advantage for long-context serving. For a 1M-token context, a Transformer's KV cache might be 2.6 TB (Section 3.2), while a Mamba model's state is a fixed $\sim$few MB regardless of context length.

**Comparison table:**

| Aspect | Transformer | Mamba / SSM |
|--------|------------|-------------|
| Training compute (sequence) | $O(N^2 d)$ | $O(N d_s^2)$ or $O(N \log N)$ |
| Inference compute per step | $O(Nd)$ (KV cache read) | $O(d_s^2)$ (state update) |
| Inference memory | $O(N \cdot d)$ KV cache, grows with $N$ | $O(d_s^2)$ state, fixed |
| Training parallelism | High (attention is GEMM) | Moderate (parallel scan) |
| Long-range recall | Exact (attends to all positions) | Compressed (finite state) |

The "compressed recall" row is the fundamental limitation of SSMs: because the state has fixed size, information from early in the sequence must be compressed. Tasks that require verbatim retrieval of arbitrary past tokens (e.g., "what was the 5th word?") are inherently difficult for pure SSMs but trivial for attention.

### 6.5 Hybrid Architectures

**Jamba (AI21, 2024)** interleaves Transformer attention layers and Mamba SSM layers within a single model. The rationale is to combine the strengths of each:

- **Attention layers** provide precise, content-addressable recall -- critical for tasks like exact copying, lookup, and multi-hop reasoning.
- **SSM layers** provide efficient long-range propagation with constant memory, handling the bulk of sequence processing cheaply.

The systems challenge is that hybrid models have heterogeneous compute patterns across layers: attention layers are GEMM-dominated with a KV cache, while SSM layers use element-wise operations with a scan. Serving frameworks must handle both patterns efficiently, and the memory profile is a weighted combination (e.g., if 1 in 4 layers uses attention, the KV cache is 4x smaller than a pure Transformer of the same depth).

**Practical impact.** Jamba-1.5-Mini (12B active parameters, 52B total with MoE) supports 256K token contexts with a KV cache roughly 8x smaller than a comparably-sized pure Transformer. This directly translates to higher throughput in serving: smaller KV caches mean more concurrent requests fit in GPU memory, which is often the binding constraint for long-context workloads (Section 3.3).

**Open questions.** The optimal ratio of attention to SSM layers, and where to place each in the architecture, remain active research areas. Early evidence suggests that placing attention layers at regular intervals (e.g., every 4th or 8th layer) preserves recall quality while keeping the overall memory footprint close to a pure SSM. From a systems perspective, the key design decision is balancing three constraints:

1. **Memory budget**: More attention layers means a larger KV cache.
2. **Recall quality**: Tasks requiring exact retrieval (e.g., coding, factual QA) need sufficient attention layers.
3. **Throughput**: SSM layers have higher tokens-per-second throughput at inference due to $O(1)$ per-step cost.

The hybrid approach transforms long-context serving from a purely memory-bound problem (KV cache) into one where the systems engineer can tune the memory-quality tradeoff at the architecture level.

---

## 7. RAG Architecture

### 7.1 System Overview

A RAG system has three stages:

```
                     +------------------+
                     |   User Query     |
                     +--------+---------+
                              |
                    +---------v----------+
                    |  1. RETRIEVAL      |
                    |  Embed query       |
                    |  Search vector DB  |
                    |  Return top-k docs |
                    +---------+----------+
                              |
                    +---------v----------+
                    |  2. AUGMENTATION   |
                    |  Format context    |
                    |  Construct prompt   |
                    +---------+----------+
                              |
                    +---------v----------+
                    |  3. GENERATION     |
                    |  LLM generates     |
                    |  with context       |
                    +--------------------+
```

### 7.2 Embedding Pipeline

**Embedding model.** A text encoder maps passages to dense vectors:

$$e = f_\theta(\text{text}) \in \mathbb{R}^{d_e}$$

Common choices:

| Model | Dimensions | Parameters | Throughput (A100) |
|-------|-----------|------------|-------------------|
| text-embedding-3-small | 1536 | ~100M | ~10K passages/s |
| BGE-large-en | 1024 | 335M | ~3K passages/s |
| E5-mistral-7b-instruct | 4096 | 7B | ~200 passages/s |
| GTE-Qwen2-7B-instruct | 3584 | 7B | ~200 passages/s |

**Batch embedding.** For a corpus of $N$ passages, embedding is embarrassingly parallel:

$$\text{Time}_{\text{embed}} = \frac{N \cdot \text{avg\_tokens}}{B \cdot \text{throughput\_tokens/s}}$$

For 10M passages at 256 tokens each on a single A100: ~7 hours with a 335M-parameter encoder.

### 7.3 Chunking Strategies

The quality of retrieval depends heavily on how documents are split into chunks.

**Fixed-size chunking:**

```python
def fixed_chunk(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split text into fixed-size chunks with overlap."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if chunk:
            chunks.append(chunk)
    return chunks
```

**Semantic chunking:** Split at natural boundaries (paragraphs, sections, sentences) and merge adjacent chunks to meet a target size.

**Recursive chunking:** Try splitting by paragraph, then sentence, then word, until chunks are within the target size range.

| Strategy | Pros | Cons |
|----------|------|------|
| Fixed-size | Simple, predictable sizes | May split mid-sentence |
| Sentence | Preserves sentence integrity | Variable sizes |
| Semantic | Best retrieval quality | Complex, requires structure detection |
| Recursive | Good balance | Moderate complexity |

**Chunk size tradeoffs:**

- **Small chunks (100-200 tokens)**: Higher retrieval precision, but may lack context. More chunks to embed and index.
- **Large chunks (500-1000 tokens)**: More context per chunk, but lower precision. Fewer chunks needed.
- **Typical sweet spot**: 256-512 tokens with 10-20% overlap.

### 7.4 Similarity Search

Retrieval uses cosine similarity (or inner product for normalized embeddings):

$$\text{sim}(q, d) = \frac{q \cdot d}{\|q\| \|d\|}$$

Finding the top-$k$ most similar documents from a corpus of $N$ embeddings of dimension $d_e$:

- **Exact search (brute force):** $O(N \cdot d_e)$ -- a single matrix multiply $Q \cdot D^T$.
- **Approximate Nearest Neighbor (ANN):** Sublinear in $N$ with controlled accuracy loss.

---

## 8. Vector Database Systems

### 8.1 FAISS

Facebook AI Similarity Search (FAISS) is the most widely used library for dense vector search. Key index types:

**Flat index (exact):**

$$\text{IndexFlatIP}: \text{sim}(q, d_i) = q^T d_i \quad \forall i \in \{1, \ldots, N\}$$

- Time: $O(Nd_e)$. Space: $O(Nd_e)$.
- Exact results but slow for large $N$.

**IVF (Inverted File Index):**

1. **Training**: Cluster $N$ vectors into $n_{\text{list}}$ clusters using k-means.
2. **Indexing**: Assign each vector to its nearest cluster centroid.
3. **Search**: Compare query to $n_{\text{probe}}$ nearest centroids, then brute-force within those clusters.

$$\text{Time}_{\text{search}} \approx O(n_{\text{probe}} \cdot N / n_{\text{list}} \cdot d_e)$$

Recall depends on $n_{\text{probe}} / n_{\text{list}}$: higher ratios give better recall at higher latency.

**HNSW (Hierarchical Navigable Small World graphs):**

Builds a multi-layer graph where each layer is a navigable small-world graph. Search navigates from coarse to fine layers:

- Construction: $O(N \log N)$ time, $O(N \cdot M)$ space where $M$ is the graph degree.
- Search: $O(\log N \cdot M)$ per query.
- Recall@10 > 0.99 is achievable with proper tuning.

**Product Quantization (PQ):**

Compresses $d_e$-dimensional vectors into $m$ sub-vectors, each quantized to $b$ bits:

$$\text{Compressed size} = m \cdot b \text{ bits} \quad \text{vs} \quad d_e \times 32 \text{ bits (FP32)}$$

For $d_e = 768$, $m = 48$ sub-quantizers, $b = 8$ bits: 48 bytes per vector vs. 3072 bytes -- a 64x compression.

**Quantized recall tradeoff:**

| Index Type | Memory per Vector | Recall@10 | Latency (1M vectors) |
|-----------|-------------------|-----------|---------------------|
| Flat (exact) | 3072 B | 1.000 | 15 ms |
| IVF4096,PQ48 | 48 B | 0.92 | 0.3 ms |
| HNSW-32 | 3072 B + 256 B | 0.99 | 0.1 ms |
| IVF4096,SQ8 | 768 B | 0.98 | 0.5 ms |

### 8.2 Vector Database Architecture

Production vector databases (Milvus, Pinecone, Qdrant, Weaviate) add:

1. **Distributed indexing**: Shard vectors across nodes for horizontal scaling.
2. **Metadata filtering**: Filter by attributes before or after ANN search.
3. **Real-time updates**: Insert, delete, and update vectors without full re-indexing.
4. **Replication**: Multiple replicas for fault tolerance and read throughput.
5. **Hybrid search**: Combine dense (vector) and sparse (BM25/keyword) retrieval.

**Architecture:**

```
                 +-------------------+
                 |   Query Router    |
                 +---+----------+----+
                     |          |
              +------v--+  +---v------+
              | Shard 1  |  | Shard 2  |  ...
              |  IVF +   |  |  IVF +   |
              |  HNSW    |  |  HNSW    |
              +----+-----+  +----+-----+
                   |              |
              +----v-----+  +----v-----+
              | Metadata  |  | Metadata  |
              | Store     |  | Store     |
              +----------+  +----------+
```

**Query processing:**

1. Route query to relevant shards.
2. Each shard performs ANN search locally.
3. Merge results across shards (top-k merge).
4. Apply metadata filters (pre-filter or post-filter).
5. Return final top-k results.

### 8.3 Scaling Characteristics

| Corpus Size | Index Type | Build Time | Index Size | Query Latency |
|------------|-----------|-----------|-----------|---------------|
| 100K | HNSW | 30 s | 500 MB | 0.05 ms |
| 1M | IVF+HNSW | 5 min | 5 GB | 0.1 ms |
| 10M | IVF+PQ | 30 min | 5 GB | 0.3 ms |
| 100M | IVF+PQ (sharded) | 5 hr | 50 GB | 1 ms |
| 1B | IVF+PQ (distributed) | 2 days | 500 GB | 5 ms |

---

## 9. RAG Implementation

### 9.1 End-to-End RAG System

```python
import numpy as np
import torch
import torch.nn.functional as F
from dataclasses import dataclass
from typing import Optional

@dataclass
class Document:
    """A retrieved document chunk."""
    text: str
    metadata: dict
    score: float
    doc_id: str

class FaissVectorStore:
    """
    Vector store backed by FAISS for approximate nearest neighbor search.

    Supports both exact and approximate search with configurable index types.
    """
    def __init__(self, dimension: int, index_type: str = "flat",
                 nlist: int = 100, nprobe: int = 10):
        """
        Args:
            dimension: Embedding dimension
            index_type: "flat" (exact), "ivf" (approximate), or "hnsw"
            nlist: Number of IVF clusters (only for ivf)
            nprobe: Number of clusters to search (only for ivf)
        """
        import faiss

        self.dimension = dimension
        self.index_type = index_type

        if index_type == "flat":
            self.index = faiss.IndexFlatIP(dimension)
        elif index_type == "ivf":
            quantizer = faiss.IndexFlatIP(dimension)
            self.index = faiss.IndexIVFFlat(quantizer, dimension, nlist,
                                             faiss.METRIC_INNER_PRODUCT)
            self.index.nprobe = nprobe
        elif index_type == "hnsw":
            self.index = faiss.IndexHNSWFlat(dimension, 32,
                                              faiss.METRIC_INNER_PRODUCT)
            self.index.hnsw.efConstruction = 200
            self.index.hnsw.efSearch = 64
        else:
            raise ValueError(f"Unknown index type: {index_type}")

        self.documents: list[Document] = []
        self.is_trained = (index_type != "ivf")

    def add(self, embeddings: np.ndarray, documents: list[Document]):
        """
        Add vectors and associated documents to the index.

        Args:
            embeddings: (N, d) float32 array, L2-normalized
            documents: list of N Document objects
        """
        assert embeddings.shape[0] == len(documents)
        assert embeddings.shape[1] == self.dimension

        if not self.is_trained:
            self.index.train(embeddings)
            self.is_trained = True

        self.index.add(embeddings)
        self.documents.extend(documents)

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> list[Document]:
        """
        Search for the top-k most similar documents.

        Args:
            query_embedding: (1, d) or (d,) float32 array, L2-normalized
            top_k: number of results
        Returns:
            list of Document objects with scores
        """
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        scores, indices = self.index.search(query_embedding, top_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0:  # FAISS returns -1 for missing results
                doc = self.documents[idx]
                doc.score = float(score)
                results.append(doc)

        return results


class EmbeddingModel:
    """
    Wrapper for text embedding models.

    Handles tokenization, batching, and normalization.
    """
    def __init__(self, model_name: str = "BAAI/bge-base-en-v1.5",
                 device: str = "cuda", max_length: int = 512):
        from transformers import AutoTokenizer, AutoModel

        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name).to(device)
        self.model.eval()
        self.device = device
        self.max_length = max_length
        self.dimension = self.model.config.hidden_size

    @torch.no_grad()
    def encode(self, texts: list[str], batch_size: int = 32,
               show_progress: bool = False) -> np.ndarray:
        """
        Encode texts into normalized embeddings.

        Args:
            texts: list of strings
            batch_size: encoding batch size
            show_progress: show progress bar
        Returns:
            embeddings: (N, d) float32 array, L2-normalized
        """
        all_embeddings = []
        iterator = range(0, len(texts), batch_size)

        for start in iterator:
            batch_texts = texts[start:start + batch_size]

            encoded = self.tokenizer(
                batch_texts, padding=True, truncation=True,
                max_length=self.max_length, return_tensors="pt"
            ).to(self.device)

            outputs = self.model(**encoded)

            # CLS token embedding (or mean pooling depending on model)
            embeddings = outputs.last_hidden_state[:, 0, :]  # (B, d)

            # L2 normalize
            embeddings = F.normalize(embeddings, p=2, dim=-1)

            all_embeddings.append(embeddings.cpu().numpy())

        return np.concatenate(all_embeddings, axis=0).astype(np.float32)


class TextChunker:
    """
    Splits documents into chunks for embedding and retrieval.
    """
    def __init__(self, chunk_size: int = 256, chunk_overlap: int = 50,
                 strategy: str = "recursive"):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.strategy = strategy

    def chunk(self, text: str, doc_id: str = "") -> list[Document]:
        """Split text into Document chunks."""
        if self.strategy == "fixed":
            return self._fixed_chunk(text, doc_id)
        elif self.strategy == "recursive":
            return self._recursive_chunk(text, doc_id)
        else:
            raise ValueError(f"Unknown strategy: {self.strategy}")

    def _fixed_chunk(self, text: str, doc_id: str) -> list[Document]:
        words = text.split()
        chunks = []
        step = self.chunk_size - self.chunk_overlap
        for i, start in enumerate(range(0, len(words), step)):
            chunk_text = " ".join(words[start:start + self.chunk_size])
            if chunk_text.strip():
                chunks.append(Document(
                    text=chunk_text,
                    metadata={"doc_id": doc_id, "chunk_idx": i, "start_word": start},
                    score=0.0,
                    doc_id=f"{doc_id}_chunk_{i}",
                ))
        return chunks

    def _recursive_chunk(self, text: str, doc_id: str) -> list[Document]:
        """Recursively split by paragraph, then sentence, then word."""
        separators = ["\n\n", "\n", ". ", " "]
        return self._recursive_split(text, separators, doc_id)

    def _recursive_split(self, text: str, separators: list[str],
                          doc_id: str) -> list[Document]:
        chunks = []
        if not separators or len(text.split()) <= self.chunk_size:
            if text.strip():
                chunks.append(Document(
                    text=text.strip(),
                    metadata={"doc_id": doc_id},
                    score=0.0,
                    doc_id=f"{doc_id}_chunk_{len(chunks)}",
                ))
            return chunks

        sep = separators[0]
        parts = text.split(sep)
        current = ""
        chunk_idx = 0

        for part in parts:
            if len((current + sep + part).split()) <= self.chunk_size:
                current = current + sep + part if current else part
            else:
                if current.strip():
                    sub_chunks = self._recursive_split(
                        current.strip(), separators[1:],
                        f"{doc_id}_c{chunk_idx}"
                    )
                    chunks.extend(sub_chunks)
                    chunk_idx += 1
                current = part

        if current.strip():
            sub_chunks = self._recursive_split(
                current.strip(), separators[1:],
                f"{doc_id}_c{chunk_idx}"
            )
            chunks.extend(sub_chunks)

        return chunks


class RAGPipeline:
    """
    End-to-end Retrieval-Augmented Generation pipeline.

    Usage:
        rag = RAGPipeline(embedding_model, vector_store, llm)
        rag.ingest(documents)
        answer = rag.query("What is ring attention?")
    """
    def __init__(self, embedder: EmbeddingModel, store: FaissVectorStore,
                 chunker: Optional[TextChunker] = None, top_k: int = 5):
        self.embedder = embedder
        self.store = store
        self.chunker = chunker or TextChunker()
        self.top_k = top_k

    def ingest(self, documents: list[dict], batch_size: int = 64):
        """
        Ingest documents into the vector store.

        Args:
            documents: list of {"text": ..., "id": ..., "metadata": ...}
            batch_size: embedding batch size
        """
        all_chunks = []
        for doc in documents:
            chunks = self.chunker.chunk(doc["text"], doc.get("id", ""))
            for chunk in chunks:
                chunk.metadata.update(doc.get("metadata", {}))
            all_chunks.extend(chunks)

        # Embed all chunks
        texts = [c.text for c in all_chunks]
        embeddings = self.embedder.encode(texts, batch_size=batch_size)

        # Add to store
        self.store.add(embeddings, all_chunks)
        print(f"Ingested {len(documents)} documents -> {len(all_chunks)} chunks")

    def retrieve(self, query: str, top_k: Optional[int] = None) -> list[Document]:
        """Retrieve relevant chunks for a query."""
        k = top_k or self.top_k
        query_embedding = self.embedder.encode([query])
        return self.store.search(query_embedding, top_k=k)

    def build_prompt(self, query: str, retrieved: list[Document],
                      system_prompt: str = "") -> str:
        """
        Construct the augmented prompt with retrieved context.

        Args:
            query: user query
            retrieved: list of retrieved documents
            system_prompt: optional system instructions
        Returns:
            formatted prompt string
        """
        context_parts = []
        for i, doc in enumerate(retrieved, 1):
            context_parts.append(
                f"[Source {i}] (score: {doc.score:.3f})\n{doc.text}"
            )
        context = "\n\n".join(context_parts)

        prompt = f"""{system_prompt}

Use the following retrieved context to answer the question. If the context
does not contain enough information, say so. Cite sources using [Source N].

Context:
{context}

Question: {query}

Answer:"""
        return prompt.strip()

    def query(self, query: str, generate_fn=None, top_k: Optional[int] = None) -> dict:
        """
        Full RAG pipeline: retrieve + augment + generate.

        Args:
            query: user question
            generate_fn: callable(prompt) -> str, the LLM generation function
            top_k: number of documents to retrieve
        Returns:
            dict with 'answer', 'sources', 'prompt'
        """
        retrieved = self.retrieve(query, top_k)
        prompt = self.build_prompt(query, retrieved)

        answer = generate_fn(prompt) if generate_fn else "[LLM generation placeholder]"

        return {
            "answer": answer,
            "sources": retrieved,
            "prompt": prompt,
        }
```

### 9.2 Retrieval Quality Metrics

**Recall@k**: Fraction of relevant documents found in the top-$k$ results:

$$\text{Recall@}k = \frac{|\text{relevant} \cap \text{retrieved@}k|}{|\text{relevant}|}$$

**MRR (Mean Reciprocal Rank)**: Average of reciprocal ranks of the first relevant result:

$$\text{MRR} = \frac{1}{|Q|}\sum_{i=1}^{|Q|}\frac{1}{\text{rank}_i}$$

**NDCG (Normalized Discounted Cumulative Gain)**: Accounts for graded relevance:

$$\text{DCG@}k = \sum_{i=1}^{k}\frac{2^{\text{rel}_i} - 1}{\log_2(i + 1)}$$

$$\text{NDCG@}k = \frac{\text{DCG@}k}{\text{IDCG@}k}$$

### 9.3 Hybrid Retrieval

Combine dense (vector) and sparse (BM25/keyword) retrieval with reciprocal rank fusion:

$$\text{RRF}(d) = \sum_{r \in \text{rankers}} \frac{1}{k + \text{rank}_r(d)}$$

where $k = 60$ is a standard constant that controls the importance of rank position.

```python
def reciprocal_rank_fusion(
    dense_results: list[tuple[str, float]],
    sparse_results: list[tuple[str, float]],
    k: int = 60,
    top_n: int = 10,
) -> list[tuple[str, float]]:
    """
    Combine dense and sparse retrieval results using RRF.

    Args:
        dense_results: list of (doc_id, score) from dense retrieval
        sparse_results: list of (doc_id, score) from sparse retrieval
        k: RRF constant
        top_n: number of results to return
    Returns:
        list of (doc_id, rrf_score) sorted by score
    """
    rrf_scores: dict[str, float] = {}

    for rank, (doc_id, _) in enumerate(dense_results):
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)

    for rank, (doc_id, _) in enumerate(sparse_results):
        rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (k + rank + 1)

    sorted_results = sorted(rrf_scores.items(), key=lambda x: -x[1])
    return sorted_results[:top_n]
```

---

## 10. System Design Tradeoffs

### 10.1 Long Context vs RAG

| Dimension | Long Context | RAG |
|-----------|-------------|-----|
| Accuracy on in-context info | Very high | Depends on retrieval quality |
| Corpus size | Limited by context window | Unlimited |
| Latency (first query) | High (prefill cost) | Low (retrieve + short prompt) |
| Latency (follow-up) | Low (KV cache reuse) | Same as first query |
| Memory | KV cache scales with context | Fixed per query |
| Freshness | Requires re-prompting | Index can be updated |
| Cost | Proportional to context length | Fixed retrieval + short generation |

### 10.2 When to Use Each

**Use long context when:**

- The full document is needed (legal analysis, code review).
- Multi-hop reasoning across the document is required.
- The user will ask many follow-up questions about the same document.

**Use RAG when:**

- The knowledge base is very large (>10M tokens).
- The knowledge base is frequently updated.
- Attribution and citation are important.
- Cost per query must be minimized.

**Use both (hybrid) when:**

- Use RAG to select the most relevant documents, then fit them into a long context for the LLM. This combines retrieval precision with the LLM's ability to reason over the full retrieved context.

---

## Key Takeaways

1. Long-context Transformer inference is memory-bandwidth bound, not compute bound. The KV cache dominates memory consumption, scaling linearly with sequence length and model size.
2. Ring attention enables distributing long-context computation across devices with $O(1)$ memory per device per attention block, provided the per-device token count is large enough to hide communication behind computation.
3. Sparse attention patterns (sliding window, landmark) reduce the quadratic cost to near-linear but sacrifice global context. Hybrid patterns combining local and global attention provide the best tradeoffs.
4. State-space models (S4, Mamba) achieve $O(N)$ training and $O(1)$-per-step inference by replacing attention with a linear recurrence over a fixed-size state. They eliminate the KV cache entirely, but compress history into a finite state vector, trading exact recall for constant memory. Hybrid architectures (e.g., Jamba) interleave attention and SSM layers to combine the strengths of both.
5. RAG systems provide a complementary approach to long context by retrieving relevant information from arbitrarily large corpora. The retrieval quality depends critically on chunking strategy, embedding model, and index type.
6. Vector databases use approximate nearest neighbor algorithms (IVF, HNSW, PQ) to achieve sublinear search time with controllable recall loss. The choice of index type depends on corpus size, latency requirements, and memory budget.

---

## Further Reading

1. **Liu, H., Zaharia, M., and Abbeel, P.** (2023). "Ring Attention with Blockwise Transformers for Near-Infinite Context." *arXiv:2310.01889.*
2. **Mohtashami, A. and Jaggi, M.** (2023). "Landmark Attention: Random-Access Infinite Context Length for Transformers." *arXiv:2305.16300.*
3. **Lewis, P., et al.** (2020). "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." *NeurIPS 2020.*
4. **Johnson, J., Douze, M., and Jegou, H.** (2019). "Billion-scale similarity search with GPUs." *IEEE Transactions on Big Data 7(3):535-547.*
5. **Malkov, Y. and Yashunin, D.** (2020). "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs." *IEEE TPAMI 42(4):824-836.*
6. **Gao, Y., et al.** (2024). "Retrieval-Augmented Generation for Large Language Models: A Survey." *arXiv:2312.10997.*
7. **Dao, T.** (2024). "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." *ICLR 2024.*
8. **Gu, A., Goel, K., and Re, C.** (2022). "Efficiently Modeling Long Sequences with Structured State Spaces." *ICLR 2022.*
9. **Gu, A. and Dao, T.** (2023). "Mamba: Linear-Time Sequence Modeling with Selective State Spaces." *arXiv:2312.00752.*
10. **Katharopoulos, A., Vyas, A., Pappas, N., and Fleuret, F.** (2020). "Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention." *ICML 2020.*
11. **Lieber, O., et al.** (2024). "Jamba: A Hybrid Transformer-Mamba Language Model." *arXiv:2403.19887.*
