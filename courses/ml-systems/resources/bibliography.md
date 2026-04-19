# Annotated Bibliography: Machine Learning Systems

A curated reading list for a PhD-track ML systems course, organized by topic. Each entry includes a citation, one-line summary, and significance rating.

**Significance Ratings:**

- ★★★ Essential -- foundational or field-defining; must read
- ★★ Important -- significant contribution; strongly recommended
- ★ Recommended -- valuable for depth or perspective; read as needed

---

## Table of Contents

1. [Hardware Foundations and Performance Analysis](#hardware-foundations-and-performance-analysis)
2. [Automatic Differentiation and Frameworks](#automatic-differentiation-and-frameworks)
3. [Efficient Operators and Kernel Optimization](#efficient-operators-and-kernel-optimization)
4. [ML Compilers and Graph Optimization](#ml-compilers-and-graph-optimization)
5. [Distributed Training](#distributed-training)
6. [Large-Scale Training Infrastructure](#large-scale-training-infrastructure)
7. [Model Compression and Quantization](#model-compression-and-quantization)
8. [Inference and Serving Systems](#inference-and-serving-systems)
9. [Data Systems and Pipelines](#data-systems-and-pipelines)
10. [MLOps and Production Systems](#mlops-and-production-systems)
11. [Frontier Systems](#frontier-systems)

---

## Hardware Foundations and Performance Analysis

**Williams, Waterman, Patterson. "Roofline: An Insightful Visual Performance Model for Multicore Architectures." Communications of the ACM, 2009.**
Introduced the roofline model for reasoning about whether a workload is compute-bound or memory-bound; essential for performance analysis of any GPU kernel. ★★★

**Jia, Maggioni, Smith, Scarpazza. "Dissecting the NVidia Turing T4 GPU via Microbenchmarking." arXiv, 2019.**
Detailed microbenchmarks characterizing GPU memory hierarchy latencies, bandwidth, and functional unit throughput; template for hardware characterization. ★★

**Jia et al. "Dissecting the Ampere GPU Architecture through Microbenchmarking." GPU Technology Conference, 2021.**
Extended microbenchmarking methodology to Ampere (A100), characterizing Tensor Core throughput, L2 cache behavior, and NVLink bandwidth. ★★

**NVIDIA. "CUDA C++ Programming Guide." NVIDIA Developer Documentation.**
The authoritative reference for CUDA programming: thread hierarchy, memory model, synchronization, and hardware capabilities. Continuously updated. ★★★

**Hennessy, Patterson. "Computer Architecture: A Quantitative Approach." 6th Edition, Morgan Kaufmann, 2017.**
The foundational textbook on computer architecture covering memory hierarchy, pipelining, and parallelism. Chapter on domain-specific architectures covers GPUs and TPUs. ★★★

---

## Automatic Differentiation and Frameworks

**Paszke et al. "PyTorch: An Imperative Style, High-Performance Deep Learning Library." NeurIPS, 2019.**
Introduced PyTorch's design philosophy: eager execution with tape-based autograd, enabling Pythonic research workflows while maintaining competitive performance. ★★★

**Abadi et al. "TensorFlow: A System for Large-Scale Machine Learning." OSDI, 2016.**
Described TensorFlow's dataflow graph execution model, automatic differentiation, and distributed training infrastructure; shaped the modern ML systems landscape. ★★★

**Bradbury et al. "JAX: Composable Transformations of Python+NumPy Programs." 2018.**
JAX's functional transformation approach (jit, grad, vmap, pmap) as composable program transformations; influenced modern ML compiler design. ★★★

**Baydin et al. "Automatic Differentiation in Machine Learning: A Survey." JMLR, 2018.**
Comprehensive survey of forward-mode and reverse-mode AD, their implementations, and connections to programming languages; the definitive reference for AD fundamentals. ★★

**Chen et al. "TVM: An Automated End-to-End Optimizing Compiler for Deep Learning." OSDI, 2018.**
Introduced TVM's graph-level and operator-level optimization with a learned cost model for auto-tuning; pioneered ML compiler design. ★★★

---

## Efficient Operators and Kernel Optimization

**Dao et al. "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." NeurIPS, 2022.**
Showed that IO-aware tiling of attention computation achieves 2-4x speedup and dramatic memory reduction without approximation; redefined how attention should be implemented. ★★★

**Dao. "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." ICLR, 2024.**
Improved FlashAttention with better warp-level work partitioning and parallelism across sequence length, achieving near-theoretical peak throughput on A100. ★★★

**Shah et al. "FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision." arXiv, 2024.**
Extended FlashAttention to H100 with warp specialization, FP8 computation, and asynchronous memory operations; demonstrated 1.5-2x speedup over FlashAttention-2 on Hopper. ★★

**Tillet, Kung, Cox. "Triton: An Intermediate Language and Compiler for Tiled Neural Network Computations." MAPL, 2019.**
Introduced Triton's block-level programming model that abstracts away warp-level details while enabling near-CUDA performance; the dominant tool for custom ML kernels. ★★★

**Goto, van de Geijn. "Anatomy of High-Performance Matrix Multiplication." ACM TOMS, 2008.**
Definitive analysis of how to structure GEMM for cache hierarchy: packing, micro-kernels, and register blocking; the conceptual foundation for all optimized BLAS implementations. ★★★

---

## ML Compilers and Graph Optimization

**XLA Team. "XLA: Optimizing Compiler for Machine Learning." Google, 2017.**
Google's ahead-of-time compiler for ML that performs whole-program optimization including operator fusion, layout assignment, and memory planning for TPUs and GPUs. ★★★

**Ansel et al. "PyTorch 2: Faster Machine Learning Through Dynamic Python Bytecode Transformation and Graph Compilation." ASPLOS, 2024.**
Described torch.compile's architecture: TorchDynamo for graph capture from Python, TorchInductor for code generation, and the integration with Triton for GPU kernel synthesis. ★★★

**Zheng et al. "Ansor: Generating High-Performance Tensor Programs for Deep Learning." OSDI, 2020.**
Automated tensor program generation using a hierarchical search space and learned cost model; generates competitive kernels without manual tuning. ★★

**Ragan-Kelley et al. "Halide: A Language and Compiler for Optimizing Parallelism, Locality, and Recomputation in Image Processing Pipelines." PLDI, 2013.**
Pioneered the separation of algorithm from schedule in domain-specific compilers; deeply influenced TVM and other ML compiler designs. ★★

**Lattner et al. "MLIR: Scaling Compiler Infrastructure for Domain Specific Computation." CGO, 2021.**
Introduced MLIR's multi-level IR framework for building reusable compiler infrastructure across domains; the foundation for StableHLO and many ML compiler stacks. ★★

---

## Distributed Training

**Li et al. "PyTorch Distributed: Experiences on Accelerating Data Parallel Training." VLDB, 2020.**
Described the engineering of PyTorch DDP: gradient bucketing, communication-computation overlap, and NCCL integration; the reference for production data parallelism. ★★★

**Rajbhandari et al. "ZeRO: Memory Optimizations Toward Training Trillion Parameter Models." SC, 2020.**
Introduced the three stages of ZeRO (optimizer state, gradient, and parameter partitioning) that eliminate memory redundancy in data parallelism; enabled training of 100B+ parameter models. ★★★

**Shoeybi et al. "Megatron-LM: Training Multi-Billion Parameter Language Models Using Model Parallelism." arXiv, 2019.**
Described tensor parallelism for transformer layers: column-parallel and row-parallel partitioning of attention and MLP weights with minimal communication. ★★★

**Huang et al. "GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism." NeurIPS, 2019.**
Introduced micro-batch pipelining to reduce pipeline bubble overhead in model-parallel training; first practical pipeline parallelism system. ★★★

**Narayanan et al. "Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM." SC, 2021.**
Combined data, tensor, and pipeline parallelism (3D parallelism) for training models up to 1T parameters; the engineering blueprint for large-scale training. ★★★

**Zhao et al. "PyTorch FSDP: Experiences on Scaling Fully Sharded Data Parallel." VLDB, 2023.**
Described PyTorch's FSDP implementation: ZeRO-3 with communication-computation overlap, mixed precision, and auto-wrapping; the production standard for sharded training. ★★

**Narayanan et al. "PipeDream: Generalized Pipeline Parallelism for DNN Training." SOSP, 2019.**
Introduced 1F1B scheduling and weight stashing for asynchronous pipeline parallelism, reducing bubble overhead compared to GPipe. ★★

---

## Large-Scale Training Infrastructure

**Chowdhery et al. "PaLM: Scaling Language Modeling with Pathways." JMLR, 2023.**
Trained a 540B-parameter model on 6144 TPUs; detailed the systems challenges of training at this scale including rematerialization, pipeline parallelism, and fault tolerance. ★★

**Grattafiori et al. "The Llama 3 Herd of Models." arXiv, 2024.**
Detailed the training infrastructure for Llama 3 405B on 16,384 H100 GPUs: 4D parallelism, training stability, and operational challenges at datacenter scale. ★★★

**DeepSeek-AI. "DeepSeek-V3 Technical Report." arXiv, 2024.**
Trained a 671B MoE model with FP8 computation throughout: DualPipe pipeline scheduling, cross-node expert parallelism, and multi-token prediction. Cost-efficient training at scale. ★★

**Micikevicius et al. "Mixed Precision Training." ICLR, 2018.**
Established the methodology for FP16 training with loss scaling and FP32 master weights; enabled 2x memory savings and throughput improvement on Volta and later GPUs. ★★★

**Chen et al. "Training Deep Nets with Sublinear Memory Cost." arXiv, 2016.**
Introduced gradient checkpointing (activation recomputation), trading compute for memory to enable training of deeper models on fixed hardware. ★★★

---

## Model Compression and Quantization

**Frantar et al. "GPTQ: Accurate Post-Training Quantization for Generative Pre-Trained Transformers." ICLR, 2023.**
One-shot weight quantization using approximate second-order information, enabling 3-4 bit quantization of LLMs with minimal accuracy loss. ★★★

**Lin et al. "AWQ: Activation-Aware Weight Quantization for On-Device LLM Compression." MLSys, 2024.**
Observation that protecting salient weight channels (identified by activation magnitude) enables better quantization; hardware-efficient implementation for edge deployment. ★★★

**Dettmers et al. "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale." NeurIPS, 2022.**
Mixed-precision decomposition that isolates outlier features for FP16 computation while quantizing the rest to INT8; enabled inference of 175B models on consumer GPUs. ★★

**Dettmers et al. "QLoRA: Efficient Finetuning of Quantized Language Models." NeurIPS, 2023.**
Combined 4-bit NormalFloat quantization with LoRA adapters and paged optimizers; enabled fine-tuning of 65B models on a single 48GB GPU. ★★★

**Han, Mao, Dally. "Deep Compression: Compressing Deep Neural Networks with Pruning, Trained Quantization and Huffman Coding." ICLR, 2016.**
Introduced the three-stage compression pipeline (pruning, quantization, encoding) achieving 35-49x compression without accuracy loss; foundational work in model compression. ★★★

---

## Inference and Serving Systems

**Kwon et al. "Efficient Memory Management for Large Language Model Serving with PagedAttention." SOSP, 2023.**
Introduced vLLM with PagedAttention: virtual memory-style KV cache management that eliminates fragmentation and enables sharing across requests; the dominant LLM serving system. ★★★

**Leviathan, Kalman, Matias. "Fast Inference from Transformers via Speculative Decoding." ICML, 2023.**
Used a small draft model to generate candidate tokens verified in parallel by the target model; achieves 2-3x speedup without changing output distribution. ★★★

**Yu et al. "ORCA: A Distributed Serving System for Transformer-Based Generative Models." OSDI, 2022.**
Introduced continuous batching (iteration-level scheduling) for LLM serving, enabling dynamic request joining and leaving to maximize GPU utilization. ★★★

**Aminabadi et al. "DeepSpeed-Inference: Enabling Efficient Inference of Transformer Models at Unprecedented Scale." SC, 2022.**
Multi-GPU inference system with tensor parallelism, customized kernels for transformer inference, and heterogeneous memory (GPU + CPU + NVMe) for KV cache. ★★

**NVIDIA. "TensorRT-LLM." NVIDIA Developer, 2023.**
Production inference engine combining graph optimization, kernel fusion, quantization, and in-flight batching for high-throughput LLM serving. ★★

---

## Data Systems and Pipelines

**Murray et al. "tf.data: A Machine Learning Data Processing Framework." VLDB, 2021.**
Described TensorFlow's data pipeline system: declarative API, automatic parallelization, prefetching, and caching for high-throughput data loading. ★★

**Mohan et al. "Analyzing and Mitigating Data Stalls in DNN Training." VLDB, 2021.**
Systematic analysis of how data loading bottlenecks cause GPU idle time; proposed solutions including caching, locality-aware loading, and coordinated prefetching. ★★

**Penedo et al. "The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale." NeurIPS Datasets Track, 2024.**
Detailed the pipeline for curating high-quality web text at scale: URL filtering, content extraction, deduplication, and quality classification. ★★

**Gadre et al. "DataComp: In Search of the Next Generation of Multimodal Datasets." NeurIPS, 2023.**
Benchmark for dataset design and curation methods; demonstrated that data quality and filtering matter more than scale for CLIP training. ★★

---

## MLOps and Production Systems

**Sculley et al. "Hidden Technical Debt in Machine Learning Systems." NeurIPS, 2015.**
Identified the pervasive systems challenges in production ML beyond model development: data dependencies, configuration debt, monitoring, and pipeline complexity. ★★★

**Baylor et al. "TFX: A TensorFlow-Based Production-Scale Machine Learning Platform." KDD, 2017.**
Described Google's end-to-end ML platform: data validation, feature engineering, training, model validation, serving, and monitoring in a unified pipeline. ★★

**Zaharia et al. "Accelerating the Machine Learning Lifecycle with MLflow." IEEE Data Engineering Bulletin, 2018.**
Introduced MLflow for experiment tracking, model packaging, and deployment; the open-source standard for ML lifecycle management. ★★

**Polyzotis et al. "Data Lifecycle Challenges in Production Machine Learning: A Survey." SIGMOD Record, 2018.**
Survey of data management challenges in production ML systems: data validation, schema evolution, feature management, and data debugging. ★

---

## Frontier Systems

**Fedus, Zoph, Shazeer. "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity." JMLR, 2022.**
Simplified MoE routing to top-1 expert selection with expert parallelism across devices; scaled to trillion parameters with stable training. ★★★

**Hwang et al. "Tutel: Adaptive Mixture-of-Experts at Scale." MLSys, 2023.**
Optimized all-to-all communication and adaptive parallelism for MoE training and inference; achieved near-linear scaling of expert parallelism. ★★

**Lewis et al. "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks." NeurIPS, 2020.**
Introduced the RAG framework combining parametric and non-parametric memory; spawned a systems subfield around efficient retrieval-augmented inference. ★★★

**Guo et al. "DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning." arXiv, 2025.**
Large-scale RL training for reasoning, requiring interleaved generation and training; novel systems challenge of long-horizon rollout at scale. ★★

**Waddington et al. "Sustainable AI: Environmental Implications, Challenges, and Opportunities." MLSys, 2023.**
Analysis of the energy and carbon costs of ML training and inference; proposed metrics and strategies for reducing environmental impact. ★

---

## How to Use This Bibliography

1. **Start with ★★★ papers** in the modules most relevant to your research or project.
2. **Read systems papers differently** than algorithm papers. Focus on: What is the system architecture? What are the bottlenecks addressed? How are benchmarks designed? What is the hardware configuration?
3. **Follow citation chains.** Systems papers often build directly on prior systems. Understanding the predecessor system clarifies the contribution of the new one.
4. **Read the evaluation section carefully.** In systems research, the evaluation methodology is often as important as the system design. Look at what metrics are reported, what baselines are used, and what configurations are tested.
5. **Verify recency.** This bibliography was compiled for a course starting in 2025-2026. The ML systems landscape evolves rapidly. Check for newer versions of systems, updated benchmarks, and follow-up work.
