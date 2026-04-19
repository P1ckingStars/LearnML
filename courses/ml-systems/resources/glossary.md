# Glossary of ML Systems Terms

Over 100 key terms used in this course, organized alphabetically. Definitions aim for precision at a graduate level while remaining accessible. Terms emphasize the systems perspective: hardware behavior, performance characteristics, and implementation concerns.

---

## A

**Activation Checkpointing (Gradient Checkpointing).**
A memory optimization that discards intermediate activations during the forward pass and recomputes them during the backward pass. Trades compute (roughly one additional forward pass) for memory (reducing activation memory from O(n) layers to O(sqrt(n)) with optimal placement). Essential for training large models on limited GPU memory.

**Activation Memory.**
GPU memory consumed by intermediate activations stored during the forward pass for use in backpropagation. For a transformer with L layers, hidden dimension d, sequence length s, and batch size b, activation memory scales as O(L * s * b * d). Often the dominant memory cost during training, exceeding model parameter memory.

**All-Gather.**
A collective communication operation where each rank starts with a shard of data and ends with the full data. Used in ZeRO Stage 3 and FSDP to reconstruct full parameters before forward/backward computation. Communication volume: (N-1)/N of total data per rank, where N is the number of ranks.

**All-Reduce.**
A collective communication operation that reduces data across all ranks (e.g., summing gradients) and distributes the result to all ranks. Implemented efficiently as reduce-scatter followed by all-gather, or via ring or tree algorithms. Total communication volume: 2(N-1)/N of data size per rank for ring all-reduce.

**All-to-All.**
A collective communication operation where each rank sends a different portion of its data to every other rank. Used in expert parallelism for MoE models to route tokens to the correct expert across devices.

**Arithmetic Intensity.**
The ratio of floating-point operations to bytes of memory traffic (FLOPs/byte). Determines whether a workload is compute-bound (high arithmetic intensity) or memory-bound (low arithmetic intensity) on the roofline model. Matrix multiplication has high arithmetic intensity; element-wise operations have low arithmetic intensity.

**Asynchronous Execution.**
GPU execution model where kernel launches return immediately to the CPU, and the GPU executes them from a queue. CPU and GPU can execute concurrently. Requires explicit synchronization (cudaDeviceSynchronize, CUDA events) to ensure correctness and proper timing measurement.

## B

**Bank Conflict.**
A shared memory access pattern where multiple threads in a warp access different addresses that map to the same memory bank. Each conflicting access is serialized, reducing effective bandwidth by up to 32x (32-way bank conflict). Shared memory on modern GPUs has 32 banks with 4-byte stride.

**Batch Size (Effective vs. Per-Device).**
Per-device batch size is the number of samples processed by a single GPU in one forward pass. Effective batch size is the total across all devices and gradient accumulation steps: effective_batch = per_device_batch * num_devices * accumulation_steps. Large effective batch sizes require learning rate scaling (linear or sqrt).

**Bucket (Gradient Bucketing).**
In distributed data parallelism, small gradient tensors are grouped into larger buckets before communication to amortize the overhead of launching collective operations. PyTorch DDP uses a default bucket size of 25MB. Bucket boundaries trigger asynchronous all-reduce.

## C

**Coalesced Memory Access.**
A GPU memory access pattern where consecutive threads in a warp access consecutive memory addresses, enabling the hardware to combine multiple accesses into a single memory transaction. Coalesced accesses achieve near-peak memory bandwidth; non-coalesced accesses can be 10-32x slower.

**Collective Communication.**
Operations that involve all processes in a distributed group: all-reduce, all-gather, reduce-scatter, broadcast, all-to-all. Implemented by communication libraries (NCCL, Gloo) using optimized algorithms (ring, tree, recursive halving-doubling) that exploit network topology.

**Communication-Computation Overlap.**
Scheduling technique that executes communication operations concurrently with computation to hide communication latency. In DDP, gradient all-reduce for earlier layers is overlapped with backward computation of later layers. Requires multiple CUDA streams and careful dependency management.

**Compute Utilization (MFU, Model FLOPs Utilization).**
The ratio of achieved FLOPs to theoretical peak FLOPs: MFU = observed_throughput / hardware_peak. For LLM training, good MFU is 40-60% on GPUs. MFU accounts for all overhead (communication, memory, pipeline bubbles). Hardware FLOPs Utilization (HFU) additionally credits recomputation FLOPs.

**Continuous Batching (Iteration-Level Scheduling).**
A serving technique where new requests can join a batch at any generation step, and completed requests leave immediately. Maximizes GPU utilization compared to static batching, where all requests must finish before new ones start. Introduced by Orca.

**CUDA Stream.**
A sequence of GPU operations that execute in order. Operations on different streams can execute concurrently if hardware resources are available. Used to overlap computation with memory transfers or communication. The default stream synchronizes with all other streams (use non-default streams for overlap).

## D

**Data Parallelism.**
A distributed training strategy that replicates the full model on each device and partitions the training data across devices. Each device computes gradients on its data partition, then gradients are synchronized via all-reduce. The simplest and most common parallelism strategy.

**DeepSpeed.**
Microsoft's distributed training library providing ZeRO optimizer stages, pipeline parallelism, mixed precision training, and inference optimization. Integrates with PyTorch and provides a configuration-driven API.

**Device Mesh.**
An abstraction representing the arrangement of devices in a multi-dimensional grid for distributed training. A 2D mesh might have data parallelism along one axis and tensor parallelism along the other. Used by FSDP, Megatron, and DTensor for mapping logical parallelism to physical devices.

## E

**Expert Parallelism.**
A distributed strategy for Mixture of Experts models where different experts reside on different devices. Requires all-to-all communication to route tokens to the correct expert and collect results. Communication cost scales with the number of tokens dispatched to non-local experts.

## F

**FLOPs (Floating-Point Operations).**
The number of floating-point operations in a computation. For matrix multiplication of M x K by K x N matrices: 2MNK FLOPs (each output element requires K multiplies and K-1 additions). For a transformer forward pass with parameters P and sequence length s: approximately 2Ps FLOPs per token (6Ps including backward).

**FSDP (Fully Sharded Data Parallel).**
PyTorch's implementation of ZeRO Stage 3: model parameters, gradients, and optimizer states are sharded across all data-parallel ranks. Parameters are gathered (all-gather) before computation and re-sharded (reduce-scatter) after gradient computation. Reduces per-device memory by a factor of N (number of ranks).

**Fusion (Operator Fusion, Kernel Fusion).**
Combining multiple operations into a single GPU kernel to eliminate intermediate memory reads and writes. For example, fusing LayerNorm + dropout + residual add avoids writing and re-reading the intermediate tensor. The most impactful optimization in ML compilers.

## G

**GEMM (General Matrix Multiply).**
The fundamental compute primitive in deep learning: C = alpha * A * B + beta * C. Linear layers, convolutions (via im2col), and attention all reduce to GEMM. Optimized GEMM implementations (cuBLAS, CUTLASS) achieve near-peak hardware utilization through tiling, register blocking, and Tensor Core usage.

**GPU Memory Hierarchy.**
From fastest to slowest: registers (~0 cycle latency, ~256KB per SM) > shared memory / L1 cache (~20-30 cycles, 128-228KB per SM) > L2 cache (~200 cycles, 40-50MB) > HBM (~400-600 cycles, 40-80GB). Effective kernel optimization requires keeping data as close to the compute units as possible.

**Gradient Accumulation.**
Simulating a larger batch size by accumulating gradients over multiple forward-backward passes before performing an optimizer step. The loss is divided by the accumulation steps to maintain correct gradient magnitude. Enables large effective batch sizes when GPU memory limits per-device batch size.

## H

**HBM (High Bandwidth Memory).**
The main GPU memory (DRAM), offering high capacity (40-80GB) but lower bandwidth relative to on-chip memory. A100: 2TB/s HBM bandwidth, 80GB capacity. H100: 3.35TB/s, 80GB. Many ML workloads are HBM bandwidth-bound, not compute-bound. FlashAttention's key insight is minimizing HBM traffic.

**Host-to-Device Transfer.**
Moving data from CPU (host) memory to GPU (device) memory via PCIe or NVLink. PCIe Gen4 x16: ~32GB/s. PCIe Gen5 x16: ~64GB/s. Can be overlapped with computation using pinned (page-locked) memory and CUDA streams.

## I

**In-Flight Batching.**
See Continuous Batching.

**Interconnect.**
The communication fabric between GPUs or between nodes. NVLink (intra-node): 600-900 GB/s bidirectional per GPU on modern systems. InfiniBand (inter-node): 200-400 Gb/s per port. PCIe (fallback): 32-64 GB/s. Interconnect bandwidth often determines distributed training scaling efficiency.

## J

**JIT Compilation (Just-In-Time Compilation).**
Compiling code at runtime rather than ahead of time. PyTorch's torch.compile uses TorchDynamo for JIT graph capture and TorchInductor for JIT kernel generation. Triton JIT-compiles kernels on first invocation. JIT compilation introduces first-invocation latency but enables runtime specialization.

## K

**Kernel.**
A function that executes on the GPU, launched from the CPU. Defined by its grid dimensions (blocks and threads), shared memory allocation, and register usage. A single training step may launch hundreds of kernels. Kernel launch overhead is ~5-10 microseconds, which matters for small kernels.

**Kernel Launch Overhead.**
The CPU-side cost of dispatching a kernel to the GPU, typically 5-10 microseconds per launch. Dominates for small, fast kernels. Mitigated by CUDA Graphs (capturing and replaying sequences of launches) or kernel fusion.

**KV Cache.**
In autoregressive transformer inference, previously computed key and value tensors are cached and reused for each new token generation. Memory grows linearly with sequence length and batch size: 2 * num_layers * seq_len * hidden_dim * 2 bytes (FP16) per sequence. The primary memory bottleneck in LLM serving.

## L

**Launch Configuration.**
The grid and block dimensions specified when launching a GPU kernel. Grid dimensions determine the total number of thread blocks; block dimensions determine threads per block (max 1024). Choosing the right launch configuration affects occupancy, register pressure, and shared memory usage.

**Load Balancing (MoE).**
Ensuring that tokens are distributed evenly across experts in a Mixture of Experts model. Imbalanced routing causes some experts to be overloaded while others are idle, wasting compute and communication bandwidth. Addressed via auxiliary losses, expert choice routing, or capacity factors.

**Loss Scaling.**
A technique for mixed precision (FP16) training that multiplies the loss by a large factor before backward, then divides gradients by the same factor after backward. Prevents small gradient values from underflowing to zero in FP16. Not needed for BF16 (which has the same exponent range as FP32).

## M

**Memory Bandwidth.**
The rate at which data can be read from or written to GPU memory, measured in GB/s or TB/s. A100: 2TB/s HBM, ~19TB/s shared memory. Many ML operations (element-wise, normalization, softmax) are memory-bandwidth-bound: their throughput is limited by how fast data can be loaded, not by compute capacity.

**Megatron-LM.**
NVIDIA's distributed training framework implementing tensor parallelism, pipeline parallelism, and data parallelism for large language models. Tensor parallelism splits weight matrices across GPUs within a node; pipeline parallelism splits layers across nodes.

**Micro-Batch.**
A subdivision of a mini-batch used in pipeline parallelism. The mini-batch is split into m micro-batches that are pipelined through the pipeline stages. Larger m reduces the pipeline bubble fraction (bubble = (p-1)/(m+p-1) where p is the number of pipeline stages) but increases memory for storing intermediate activations.

**Mixed Precision Training.**
Training with a mix of FP16 (or BF16) and FP32 precision. Most GEMM operations use FP16/BF16 for 2x memory savings and higher throughput on Tensor Cores; accumulations, loss computation, and optimizer states remain in FP32 for numerical stability.

**Model Parallelism.**
A distributed strategy that partitions the model across devices. Tensor parallelism splits individual layers (weight matrices) across devices. Pipeline parallelism splits the model into sequential stages (groups of layers) assigned to different devices. Both require communication between devices at partition boundaries.

## N

**NCCL (NVIDIA Collective Communications Library).**
NVIDIA's optimized library for GPU-to-GPU collective communication. Supports all-reduce, all-gather, reduce-scatter, broadcast, and all-to-all over NVLink, PCIe, and InfiniBand. Automatically selects ring, tree, or other topologies based on the communication pattern and hardware.

**NVLink.**
NVIDIA's high-bandwidth GPU-to-GPU interconnect. NVLink 4.0 (H100): 900 GB/s bidirectional per GPU. NVLink 5.0 (B200): 1.8 TB/s. Provides 5-10x the bandwidth of PCIe, making it critical for tensor parallelism where GPUs within a node must communicate frequently.

## O

**Occupancy.**
The ratio of active warps per SM to the maximum supported by the hardware. Low occupancy means the SM cannot fully hide memory latency through warp scheduling. Affected by register usage per thread, shared memory allocation per block, and block size. Higher occupancy does not always mean higher performance.

**Operator.**
A single computational primitive in the ML framework (e.g., matmul, softmax, layernorm, convolution). Each operator maps to one or more GPU kernel launches. Operator-level optimization includes writing custom kernels, selecting optimal algorithms, and fusing adjacent operators.

## P

**Paged Attention (PagedAttention).**
KV cache memory management technique (from vLLM) that allocates KV cache in fixed-size blocks (pages) mapped via a page table, similar to OS virtual memory. Eliminates memory fragmentation and enables cache sharing across beams or prefix-matched requests.

**Peak Throughput.**
The maximum theoretical computation rate of a hardware device. A100 (FP16 Tensor Core): 312 TFLOPS. H100 (FP16 Tensor Core): 989 TFLOPS. H100 (FP8 Tensor Core): 1,979 TFLOPS. Real workloads achieve a fraction of peak due to memory bandwidth limits, communication, and pipeline bubbles.

**Pinned Memory (Page-Locked Memory).**
Host memory that is locked in physical RAM and cannot be swapped to disk. Enables DMA transfers between CPU and GPU, providing higher transfer bandwidth and enabling asynchronous (non-blocking) host-to-device copies. Use `torch.Tensor.pin_memory()` or DataLoader's `pin_memory=True`.

**Pipeline Bubble.**
Idle time in pipeline parallelism when stages are waiting for inputs or outputs from other stages. In GPipe with m micro-batches and p stages, bubble fraction = (p-1)/(m+p-1). The 1F1B schedule reduces the bubble by interleaving forward and backward micro-batches.

**Pipeline Parallelism.**
A model parallelism strategy that partitions the model into sequential stages assigned to different devices. Micro-batches are pipelined through stages. Requires careful scheduling (GPipe, 1F1B, interleaved) to minimize bubble overhead. Best suited for inter-node parallelism where bandwidth is limited.

**Prefetch.**
Loading data or parameters into faster memory before they are needed. In data loading: CPU workers prefetch and preprocess batches while the GPU computes. In FSDP: all-gather parameters for the next layer during computation of the current layer. In kernels: load next tile from global to shared memory while computing the current tile.

**Profiler (GPU Profiler).**
Tool for measuring GPU kernel execution time, memory usage, and hardware utilization. Nsight Systems: timeline view of CPU/GPU activity and communication. Nsight Compute: detailed per-kernel analysis (occupancy, memory throughput, compute throughput, stall reasons). PyTorch Profiler: framework-level view with operator-level breakdown.

## Q

**Quantization.**
Reducing the numerical precision of model weights, activations, or KV cache to use fewer bits. Weight-only quantization (GPTQ, AWQ) reduces model size and memory bandwidth requirements. Weight-and-activation quantization (INT8, FP8) additionally enables lower-precision compute on Tensor Cores. Key trade-off: lower precision reduces memory and compute cost but may degrade accuracy.

## R

**Reduce-Scatter.**
A collective communication operation that reduces data across all ranks (e.g., summing) and scatters the result so each rank holds a different shard. Used in ZeRO/FSDP for gradient reduction: each rank ends up with the reduced gradient for only its parameter shard.

**Register File.**
The fastest memory on the GPU, private to each thread. A100: 256KB register file per SM, ~65,536 32-bit registers. Register-heavy kernels reduce occupancy but enable maximum data reuse. High-performance GEMM kernels use extensive register tiling to keep micro-kernel data in registers.

**Rematerialization.**
See Activation Checkpointing.

**Ring All-Reduce.**
An all-reduce algorithm where N GPUs are arranged in a ring. Data is split into N chunks and each GPU sends/receives one chunk per step for 2(N-1) steps total. Each GPU sends and receives (N-1)/N of the data. Bandwidth-optimal but latency scales with N. Used by NCCL for moderate GPU counts.

**Roofline Model.**
A visual performance model that plots achievable performance as a function of arithmetic intensity. Performance is bounded by: min(peak_compute, peak_memory_bandwidth * arithmetic_intensity). Operations below the roofline are either compute-bound (limited by FLOPS) or memory-bound (limited by bandwidth).

## S

**Scaling Efficiency.**
The ratio of observed speedup to ideal speedup when increasing the number of devices: efficiency = throughput_N / (N * throughput_1). Efficiency < 1 due to communication overhead, load imbalance, and pipeline bubbles. Good scaling efficiency for LLM training: >85% for data parallelism, >70% for tensor parallelism.

**Shared Memory.**
Fast on-chip SRAM accessible by all threads in a thread block. A100: up to 164KB per SM (configurable between shared memory and L1 cache). Used for inter-thread communication, data reuse across warps, and as a programmer-managed cache. Access latency: ~20-30 cycles vs. ~400 cycles for HBM.

**SM (Streaming Multiprocessor).**
The fundamental compute unit on NVIDIA GPUs. Each SM contains CUDA cores, Tensor Cores, shared memory, register file, and warp schedulers. A100: 108 SMs. H100: 132 SMs. Kernel performance depends on keeping enough active warps per SM to hide memory latency.

**Speculative Decoding.**
An inference optimization where a small, fast draft model generates candidate tokens that are verified in parallel by the large target model. Tokens that the target model agrees with are accepted; divergent tokens trigger rejection and resampling. Achieves 2-3x speedup by converting sequential decoding into partially parallel verification.

## T

**Tensor Core.**
Specialized hardware units on NVIDIA GPUs (Volta and later) that perform matrix multiply-accumulate on small matrices (e.g., 16x16x16) in a single clock cycle. A100 Tensor Cores: 312 TFLOPS (FP16), 156 TFLOPS (TF32). H100: 989 TFLOPS (FP16), 1979 TFLOPS (FP8). Using Tensor Cores requires specific matrix dimensions (multiples of 8 or 16) and data layouts.

**Tensor Parallelism.**
A model parallelism strategy that partitions individual weight matrices across GPUs. In Megatron-style tensor parallelism, attention heads and MLP columns/rows are split across GPUs, with all-reduce or reduce-scatter communication after each partitioned layer. Requires high-bandwidth interconnect (NVLink); typically used within a node.

**Thread Block (Block).**
A group of threads that execute on the same SM and can cooperate via shared memory and synchronization barriers (__syncthreads). Max 1024 threads per block. Thread blocks are scheduled to SMs by the hardware; the programmer specifies grid dimensions (number of blocks) and block dimensions (threads per block).

**Throughput.**
The rate at which a system processes work. Measured in tokens/sec (training/inference), samples/sec, images/sec, or TFLOPS. Throughput is the primary optimization target for training; latency is the primary target for interactive serving.

**Tiling.**
Decomposing a large computation into smaller tiles that fit in faster memory (shared memory or registers). The core technique in optimized GEMM and attention kernels. Tile dimensions are chosen to maximize data reuse while fitting in the available fast memory. FlashAttention tiles over key/value blocks to avoid materializing the full attention matrix.

**torch.compile.**
PyTorch 2.0's compilation system. TorchDynamo captures the computation graph from Python bytecode; TorchInductor generates optimized GPU kernels (using Triton as backend). Modes: default (balanced), reduce-overhead (minimizes framework overhead), max-autotune (slower compilation, faster runtime).

**Triton.**
An open-source GPU programming language and compiler (by OpenAI/Meta) that operates at the block level rather than the thread level. The programmer writes operations on tile-sized arrays, and the compiler handles warp-level scheduling, shared memory management, and coalescing. Achieves near-CUDA performance with significantly less code.

## V

**Vectorized Load.**
Loading multiple consecutive elements in a single memory transaction (e.g., loading 4 floats with a float4 = 128-bit load). Maximizes memory bandwidth utilization by reducing the number of memory transactions. Requires data to be aligned to the vector width.

**vLLM.**
An open-source LLM serving engine implementing PagedAttention, continuous batching, and optimized CUDA kernels. Achieves 2-4x higher serving throughput than naive implementations by eliminating KV cache memory fragmentation and maximizing GPU utilization.

## W

**Warp.**
The fundamental execution unit on NVIDIA GPUs: 32 threads that execute the same instruction in lockstep (SIMT). All threads in a warp execute simultaneously; divergent branches cause serialization. Memory transactions and Tensor Core operations are warp-level. Understanding warp behavior is essential for GPU kernel optimization.

**Warp Divergence.**
When threads within a warp take different execution paths at a branch, the warp must execute both paths serially, masking inactive threads. Causes up to 2x slowdown per divergent branch. Avoid by ensuring all threads in a warp take the same path, or by restructuring computation to eliminate thread-level branches.

**Warp Specialization.**
Assigning different warps within a thread block to different roles (e.g., producer warps load data while consumer warps compute). Used in FlashAttention-3 for Hopper GPUs with the TMA (Tensor Memory Accelerator) unit. Enables software pipelining between data movement and computation.

## Z

**ZeRO (Zero Redundancy Optimizer).**
A family of memory optimizations for data-parallel training. Stage 1: partition optimizer states. Stage 2: additionally partition gradients. Stage 3: additionally partition parameters. Each stage reduces per-device memory proportionally to the number of ranks, at the cost of additional communication. Implemented in DeepSpeed and PyTorch FSDP.

---

## Symbols and Abbreviations

| Abbreviation | Expansion |
|---|---|
| AMP | Automatic Mixed Precision |
| BF16 | Brain Floating Point 16-bit |
| BLAS | Basic Linear Algebra Subprograms |
| CUDA | Compute Unified Device Architecture |
| cuBLAS | CUDA Basic Linear Algebra Subroutines |
| cuDNN | CUDA Deep Neural Network library |
| CUTLASS | CUDA Templates for Linear Algebra Subroutines |
| DDP | Distributed Data Parallel |
| DMA | Direct Memory Access |
| DP | Data Parallelism |
| FSDP | Fully Sharded Data Parallel |
| FLOPS | Floating-Point Operations Per Second |
| FP8 | 8-bit Floating Point (E4M3 or E5M2) |
| FP16 | Half-Precision Floating Point |
| FP32 | Single-Precision Floating Point |
| GEMM | General Matrix Multiply |
| GPU | Graphics Processing Unit |
| GQA | Grouped-Query Attention |
| HBM | High Bandwidth Memory |
| HFU | Hardware FLOPs Utilization |
| IR | Intermediate Representation |
| KV | Key-Value (as in KV Cache) |
| MFU | Model FLOPs Utilization |
| MHA | Multi-Head Attention |
| MoE | Mixture of Experts |
| NCCL | NVIDIA Collective Communications Library |
| NVMe | Non-Volatile Memory Express |
| OOM | Out of Memory |
| PCIe | Peripheral Component Interconnect Express |
| PP | Pipeline Parallelism |
| QKV | Query, Key, Value |
| RAG | Retrieval-Augmented Generation |
| RDMA | Remote Direct Memory Access |
| RoCE | RDMA over Converged Ethernet |
| SIMT | Single Instruction Multiple Threads |
| SM | Streaming Multiprocessor |
| SXM | Server PCI Express Module (GPU form factor) |
| TF32 | TensorFloat-32 |
| TFLOPS | Tera Floating-Point Operations Per Second |
| TMA | Tensor Memory Accelerator |
| TP | Tensor Parallelism |
| TPU | Tensor Processing Unit |
| TRT | TensorRT |
| ZeRO | Zero Redundancy Optimizer |
