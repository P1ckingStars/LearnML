# Mini-Project 2: Distributed Training System

**Course:** Machine Learning Systems (PhD Track)
**Due:** Week 14
**Weight:** 10% of final grade
**Format:** Individual or pairs

---

## Overview

In this project, you will implement and rigorously evaluate a distributed training system using one or more parallelism strategies. You will start with a single-GPU baseline, implement a parallelism strategy from scratch (or by extending a framework at a low level), and conduct a thorough evaluation measuring scaling efficiency, throughput, memory usage, and communication overhead across multiple GPUs.

The goal is to develop a deep understanding of the systems challenges in distributed training: communication costs, memory partitioning, pipeline scheduling, and the trade-offs between different parallelism strategies.

---

## Objectives

1. Implement a distributed training system supporting at least one parallelism strategy.
2. Train a real model (GPT-2 scale or equivalent) using your system.
3. Conduct a rigorous evaluation of scaling efficiency and overhead.
4. Write a conference-quality systems evaluation report.

---

## Technical Requirements

### Choose One Track

You must complete **one** of the following three tracks:

#### Track A: Data Parallelism with Gradient Compression

Implement data-parallel training with communication optimization:

| Component | Description |
|---|---|
| **Baseline DDP** | Implement DistributedDataParallel-style allreduce gradient synchronization from scratch using `torch.distributed` primitives (send, recv, all_reduce). Do not use `nn.parallel.DistributedDataParallel`. |
| **Gradient bucketing** | Group small gradient tensors into larger buckets before communication to amortize launch overhead. Experiment with bucket sizes. |
| **Communication-computation overlap** | Overlap allreduce communication with backward pass computation. Trigger allreduce for each bucket as soon as its gradients are ready, not after the full backward pass. |
| **Gradient compression** | Implement at least one compression technique: top-k sparsification, random-k sparsification, quantization to FP16/INT8, or PowerSGD low-rank compression. |

Evaluate:

- Scaling efficiency from 1 to 2, 4, and 8 GPUs
- Throughput (samples/sec) at each GPU count
- Communication time vs. computation time breakdown
- Impact of compression on convergence (training loss curve)
- Impact of bucket size on throughput

#### Track B: Pipeline Parallelism

Implement pipeline-parallel training for a transformer model:

| Component | Description |
|---|---|
| **Model partitioning** | Split a transformer model across GPUs by layer groups. Implement the forward and backward pass across device boundaries. |
| **GPipe schedule** | Implement micro-batch pipelining following the GPipe scheme: split each mini-batch into micro-batches, pipeline them through the stages, then synchronize gradients. |
| **1F1B schedule** | Implement the one-forward-one-backward (1F1B) interleaved schedule that reduces pipeline bubble by starting backward passes before all forward passes complete. |
| **Memory optimization** | Implement activation recomputation (gradient checkpointing) at pipeline stage boundaries to reduce peak memory. |

Evaluate:

- Pipeline bubble fraction for GPipe vs. 1F1B at different micro-batch counts (4, 8, 16, 32)
- Throughput (tokens/sec) at 2, 4, and 8 pipeline stages
- Memory usage per stage
- Impact of micro-batch count on throughput and bubble fraction
- Comparison against naive sequential execution (no pipelining)

#### Track C: ZeRO-style Memory Optimization

Implement ZeRO (Zero Redundancy Optimizer) stages:

| Component | Description |
|---|---|
| **ZeRO Stage 1** | Partition optimizer states across data-parallel ranks. Each rank stores optimizer states for only its shard of parameters. Implement the gather and scatter operations for optimizer steps. |
| **ZeRO Stage 2** | Additionally partition gradients. Each rank reduces and stores gradients for only its parameter shard. |
| **ZeRO Stage 3** | Additionally partition parameters. Each rank stores only its shard of model parameters. Implement all-gather before forward/backward and reduce-scatter after backward. |
| **Communication scheduling** | Implement prefetching of parameters for the next layer during computation of the current layer. |

Evaluate:

- Memory usage per GPU at each ZeRO stage for models of 125M, 350M, and 1.3B parameters
- Throughput (tokens/sec) at each ZeRO stage
- Communication overhead at each stage
- Maximum model size trainable on a fixed GPU memory budget at each stage
- Comparison against PyTorch FSDP on the same workloads

### Model and Dataset

All tracks must use the same model and dataset for fair comparison:

- **Model:** GPT-2 (124M parameters) as the primary benchmark. Optionally scale to GPT-2 Medium (350M) or GPT-2 Large (774M) if your implementation supports it.
- **Dataset:** OpenWebText subset or WikiText-103 for language modeling. Use a standard BPE tokenizer (GPT-2 tokenizer recommended).
- **Training:** Train for at least 5,000 steps to demonstrate convergence. Report validation perplexity.

### Correctness Validation

Your distributed implementation must produce results consistent with single-GPU training:

- Training loss curves should closely match the single-GPU baseline (within noise due to non-determinism in distributed reductions).
- Validation perplexity after a fixed number of steps should be within 5% of the single-GPU baseline.
- Gradient norms should be comparable between distributed and single-GPU training.

### Benchmarking Requirements

- **Throughput:** Tokens per second, with standard deviation over 3 runs.
- **Scaling efficiency:** Throughput at N GPUs divided by (N times single-GPU throughput).
- **Communication overhead:** Time spent in communication vs. computation, measured with proper instrumentation (NCCL tracing or PyTorch profiler).
- **Memory usage:** Peak GPU memory per rank at each configuration.
- **Convergence:** Training loss and validation perplexity curves.
- Report hardware configuration: GPU model, interconnect (NVLink, PCIe, InfiniBand), driver and CUDA versions.

---

## Deliverables

### 1. Report (NeurIPS Format, 8 pages max)

Your report must follow the NeurIPS 2024 LaTeX template and include:

1. **Abstract** (200 words max): Summarize the parallelism strategy, system design, and key performance findings.
2. **Introduction**: Motivation for distributed training. Why is this parallelism strategy important? What workloads benefit?
3. **Background**: Brief overview of the parallelism strategy and its systems challenges. Focus on communication patterns and memory trade-offs.
4. **System Design**: Detailed description of your implementation:
   - Architecture diagrams showing data flow and communication patterns
   - Pseudocode for the core distributed algorithms
   - Key design decisions and trade-offs
5. **Experimental Setup**: Hardware configuration, model details, dataset, training hyperparameters, software versions.
6. **Results**:
   - Scaling efficiency plot (throughput vs. GPU count)
   - Communication vs. computation breakdown
   - Memory usage analysis
   - Convergence curves (distributed vs. single-GPU)
   - Track-specific metrics (see above)
7. **Analysis**:
   - Where does your system spend time? What is the bottleneck?
   - How does performance change with model size?
   - What are the limitations of your implementation vs. production systems?
8. **Conclusion**: Key takeaways and lessons learned.
9. **References**

The 8-page limit excludes references and an optional appendix (up to 4 pages for additional benchmarks or implementation details).

### 2. Code Submission

- Clean implementation of the distributed training system
- Single-GPU baseline for comparison
- Benchmark scripts that reproduce all numbers in the report
- Correctness validation scripts
- `README.md` with setup and reproduction instructions
- `requirements.txt` or `environment.yml`

### 3. Profiling Data

- PyTorch Profiler or NCCL trace showing communication patterns
- Screenshots or exports from profiling tools showing the key findings

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Implementation** | 30% | Distributed training system is correctly implemented and produces training results consistent with the single-GPU baseline. Code is organized and readable. Core algorithms are implemented at a low level (not just wrapping existing DDP/FSDP). |
| **Experimental Methodology** | 25% | Benchmarks are properly conducted with controlled conditions. Scaling efficiency is measured correctly. Communication and computation are properly separated. Hardware configuration is fully documented. |
| **Analysis** | 25% | Results are interpreted with systems insight. Bottlenecks are identified and explained in terms of hardware behavior (bandwidth, latency, compute utilization). Trade-offs are clearly articulated. Comparison against production systems is honest. |
| **Writing** | 20% | Report is clear, well-structured, and technically precise. Figures effectively communicate performance characteristics. Communication patterns are clearly diagrammed. |

### Grade Descriptors

- **A (90-100%):** Distributed system works correctly and scales well. Analysis reveals deep understanding of communication costs and hardware utilization. Report is of workshop-paper quality. Track-specific evaluation is thorough.
- **B (80-89%):** System works correctly. Scaling is demonstrated but may not be optimal. Analysis is solid but may miss some systems-level insights. Report is well-written.
- **C (70-79%):** System works but with issues (poor scaling, correctness problems at some scales). Analysis is present but shallow. Report is adequate.
- **D/F (<70%):** System does not scale or produces incorrect results. Analysis is missing. Report is incomplete.

---

## Helpful Guidance

### Getting Started

1. **Start with single-GPU training.** Get a clean, well-instrumented single-GPU baseline working first. Measure throughput, memory, and training loss.
2. **Implement the simplest distributed version first.** For Track A: basic allreduce without overlap. For Track B: sequential pipeline without micro-batching. For Track C: ZeRO Stage 1.
3. **Validate correctness early.** Compare distributed training loss curves against single-GPU before optimizing.
4. **Add instrumentation before optimization.** You cannot optimize what you cannot measure. Add communication timing from the start.

### Common Pitfalls

- **Not synchronizing before timing:** `torch.distributed` operations are asynchronous. Call `torch.cuda.synchronize()` and `dist.barrier()` appropriately when timing.
- **Incorrect gradient scaling:** In data parallelism, gradients must be averaged across ranks, not summed. Verify by comparing gradient norms.
- **Deadlocks:** Distributed collectives must be called in the same order on all ranks. A mismatch causes a hang, not an error.
- **Ignoring interconnect bandwidth:** PCIe has much lower bandwidth than NVLink. Your scaling results will differ dramatically based on interconnect. Report which you use.
- **Comparing unfairly against FSDP:** PyTorch FSDP has years of optimization. Report the gap honestly and focus your analysis on understanding why the gap exists.

### Suggested Reading

- Rajbhandari et al., "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models" (2020)
- Huang et al., "GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism" (2019)
- Narayanan et al., "PipeDream: Generalized Pipeline Parallelism for DNN Training" (2019)
- Narayanan et al., "Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM" (2021)
- Li et al., "PyTorch Distributed: Experiences on Accelerating Data Parallel Training" (2020)
- Zhao et al., "PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel" (2023)

### Compute Expectations

- Single-GPU baseline (GPT-2 124M, 5K steps): 1-2 hours on A100
- Multi-GPU benchmarks (2, 4, 8 GPUs): 2-4 hours of total GPU time per configuration
- Full evaluation suite: approximately 30-60 GPU-hours

Plan accordingly. If multi-GPU access is limited, prioritize 2-GPU and 4-GPU results over 8-GPU results.

---

## Academic Integrity

- You must implement the core distributed training logic yourself. Using `nn.parallel.DistributedDataParallel`, `FullyShardedDataParallel`, or similar high-level wrappers as your submission is not permitted.
- You may use `torch.distributed` primitives (all_reduce, all_gather, reduce_scatter, send, recv, broadcast).
- You may use existing data loading, tokenization, and model definition code.
- Cite any code or papers you reference or adapt.
- If working in pairs, both students must contribute substantially. Include a contribution statement.

---

## Submission

Submit via the course portal by **Week 14, Friday 11:59 PM**:

1. Report as PDF (NeurIPS format)
2. Code as a zip archive or link to a private repository
3. Profiling traces or screenshots
4. A `README.md` with reproduction instructions
5. If working in pairs: contribution statement
