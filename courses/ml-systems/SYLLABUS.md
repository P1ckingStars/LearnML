# Syllabus: Machine Learning Systems — From Silicon to Serving

## Course Information

- **Duration**: 20 weeks (1 semester) + pre-work
- **Lectures**: 2 x 75 min per week
- **Recitation**: 1 x 50 min per week
- **Office Hours**: 2 x 60 min per week
- **Prerequisites**: See [PREREQUISITES.md](PREREQUISITES.md)

## Grading

| Component | Weight |
|-----------|--------|
| Homeworks (11) | 40% |
| Mini-Project 1 | 10% |
| Mini-Project 2 | 10% |
| Capstone Project | 30% |
| Paper Presentations | 10% |

**Late Policy**: 3 free late days total across all homeworks. After that, 20% penalty per day. No late submissions for projects.

---

## Pre-Work (Before Week 1)

### Module 00: Hardware & Compute Foundations

Complete before the semester begins. Self-paced, ~2 weeks.

| Day | Topic | Materials |
|-----|-------|-----------|
| -- | CPU Architecture & Memory Hierarchy | [Lecture 00a](modules/00_foundations/lecture_00a_cpu_memory_hierarchy.md) |
| -- | GPU Architecture & CUDA Programming Model | [Lecture 00b](modules/00_foundations/lecture_00b_gpu_architecture_cuda.md) |
| -- | The Roofline Model & Performance Analysis | [Lecture 00c](modules/00_foundations/lecture_00c_roofline_model.md) |
| -- | **HW0 Due: First day of class** | [HW0: Systems Bootcamp](modules/00_foundations/hw00_systems_bootcamp.md) |

---

## Weeks 1--2: Automatic Differentiation & Frameworks

### Module 01: Building a Deep Learning Framework

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 1 | Mon | Computational Graphs & Forward/Reverse Mode AD | [Lecture 01a](modules/01_autodiff_frameworks/lecture_01a_computational_graphs_ad.md) |
| 1 | Wed | Tensor Libraries: Storage, Strides, Views, and Memory Layout | [Lecture 01b](modules/01_autodiff_frameworks/lecture_01b_tensor_libraries.md) |
| 1 | Fri | *Recitation: C++ Tensor Class & pybind11 Setup* | [Recitation 01](modules/01_autodiff_frameworks/recitation_01_mini_autograd.md) |
| 2 | Mon | Operator Implementation & Memory Management in C++ | [Lecture 01c](modules/01_autodiff_frameworks/lecture_01c_operator_memory_management.md) |
| 2 | Wed | Framework Internals: PyTorch C++ Core, Dispatcher, JAX Tracing | [Lecture 01d](modules/01_autodiff_frameworks/lecture_01d_framework_internals.md) |
| 2 | Fri | **HW1 Due** | [HW1: C++ Autodiff Engine with pybind11](modules/01_autodiff_frameworks/hw01_autodiff_from_scratch.md) |

**Readings**: Paszke et al. (2019), Bradbury et al. (2018) JAX, Baydin et al. (2018) AD Survey

---

## Weeks 3--4: Efficient Operator Implementation

### Module 02: Kernels, GEMM, and Attention

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 3 | Mon | Matrix Multiplication: Tiling, GEMM, and Tensor Cores | [Lecture 02a](modules/02_efficient_operators/lecture_02a_gemm_tensor_cores.md) |
| 3 | Wed | Convolution Algorithms: im2col, Winograd, FFT | [Lecture 02b](modules/02_efficient_operators/lecture_02b_convolution_algorithms.md) |
| 3 | Fri | *Recitation: CUDA Kernel Profiling with Nsight Systems & Nsight Compute* | [Recitation 02](modules/02_efficient_operators/recitation_02_kernel_profiling.md) |
| 4 | Mon | CUDA C++ Kernel Optimization: Register Blocking, Double Buffering, WMMA | [Lecture 02c](modules/02_efficient_operators/lecture_02c_triton_kernels.md) |
| 4 | Wed | Flash Attention: Algorithm, Memory Analysis, and Triton Implementation | [Lecture 02d](modules/02_efficient_operators/lecture_02d_flash_attention.md) |
| 4 | Fri | **HW2 Due** | [HW2: CUDA C++ GEMM & Flash Attention](modules/02_efficient_operators/hw02_gemm_flash_attention.md) |

**Readings**: Dao et al. (2022) FlashAttention, Tillet et al. (2019) Triton, Goto & van de Geijn (2008) BLAS

---

## Weeks 5--6: ML Compilers & Graph Optimization

### Module 03: Compiling ML Workloads

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 5 | Mon | Computation Graph IR & Optimization Passes | [Lecture 03a](modules/03_ml_compilers/lecture_03a_graph_ir_optimization.md) |
| 5 | Wed | MLIR: Multi-Level IR, Dialects, and the ML Compiler Stack | [Lecture 03b](modules/03_ml_compilers/lecture_03b_xla_tvm.md) |
| 5 | Fri | *Recitation: Building an MLIR Dialect in C++ (TableGen + Passes)* | [Recitation 03](modules/03_ml_compilers/recitation_03_custom_compiler_pass.md) |
| 6 | Mon | Polyhedral Compilation & Loop Optimization | [Lecture 03c](modules/03_ml_compilers/lecture_03c_polyhedral_loop_optimization.md) |
| 6 | Wed | torch.compile, Inductor, and JIT Compilation | [Lecture 03d](modules/03_ml_compilers/lecture_03d_torch_compile_inductor.md) |
| 6 | Fri | **HW3 Due** | [HW3: MLIR Passes & Graph Fusion](modules/03_ml_compilers/hw03_graph_fusion_passes.md) |

**Capstone Milestone 1 Due: End of Week 5** -- [Problem Statement](projects/capstone/milestone_1.md)

**Readings**: Chen et al. (2018) TVM, Ansel et al. (2024) torch.compile, Lattner et al. (2021) MLIR

---

## Weeks 7--8: Distributed Training Fundamentals

### Module 04: Parallelism Strategies

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 7 | Mon | Data Parallelism, AllReduce, and Ring Communication | [Lecture 04a](modules/04_distributed_training/lecture_04a_data_parallelism_allreduce.md) |
| 7 | Wed | Model Parallelism: Tensor, Pipeline, and Sequence Parallelism | [Lecture 04b](modules/04_distributed_training/lecture_04b_model_parallelism.md) |
| 7 | Fri | *Recitation: Profiling Distributed Training with NCCL Traces* | [Recitation 04](modules/04_distributed_training/recitation_04_distributed_profiling.md) |
| 8 | Mon | ZeRO, FSDP, and Memory-Efficient Training | [Lecture 04c](modules/04_distributed_training/lecture_04c_zero_fsdp.md) |
| 8 | Wed | Communication Primitives & Network Topology | [Lecture 04d](modules/04_distributed_training/lecture_04d_communication_topology.md) |
| 8 | Fri | **HW4 Due** | [HW4: Data-Parallel & Pipeline-Parallel Training](modules/04_distributed_training/hw04_parallel_training.md) |

**Mini-Project 1 Due: End of Week 8** -- [Spec](projects/mini_project_1/spec.md)

**Readings**: Li et al. (2020) PyTorch Distributed, Huang et al. (2019) GPipe, Zhao et al. (2023) PyTorch FSDP

---

## Weeks 9--10: Large-Scale Training Systems

### Module 05: Training at Scale

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 9 | Mon | Mixed Precision Training: FP16, BF16, FP8 & Loss Scaling | [Lecture 05a](modules/05_large_scale_training/lecture_05a_mixed_precision.md) |
| 9 | Wed | Gradient Checkpointing & Activation Recomputation | [Lecture 05b](modules/05_large_scale_training/lecture_05b_gradient_checkpointing.md) |
| 9 | Fri | *Recitation: Setting Up Multi-Node Training* | [Recitation 05](modules/05_large_scale_training/recitation_05_multi_node_setup.md) |
| 10 | Mon | Megatron-LM, DeepSpeed, and Large-Scale Frameworks | [Lecture 05c](modules/05_large_scale_training/lecture_05c_megatron_deepspeed.md) |
| 10 | Wed | Training Infrastructure: Cluster Management, Fault Tolerance, Checkpointing | [Lecture 05d](modules/05_large_scale_training/lecture_05d_training_infrastructure.md) |
| 10 | Fri | **HW5 Due** | [HW5: Train GPT-2 with 3D Parallelism](modules/05_large_scale_training/hw05_3d_parallel_gpt2.md) |

**Capstone Milestone 2 Due: End of Week 10** -- [Method + Preliminary Results](projects/capstone/milestone_2.md)

**Readings**: Shoeybi et al. (2019) Megatron-LM, Rajbhandari et al. (2020) ZeRO, Micikevicius et al. (2018) Mixed Precision

---

## Weeks 11--12: Model Compression & Efficiency

### Module 06: Making Models Smaller and Faster

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 11 | Mon | Pruning: Unstructured, Structured, and the Lottery Ticket Hypothesis | [Lecture 06a](modules/06_model_compression/lecture_06a_pruning.md) |
| 11 | Wed | Quantization: PTQ, QAT, GPTQ, AWQ | [Lecture 06b](modules/06_model_compression/lecture_06b_quantization.md) |
| 11 | Fri | *Recitation: Quantizing an LLM to 4-bit* | [Recitation 06](modules/06_model_compression/recitation_06_llm_quantization.md) |
| 12 | Mon | Knowledge Distillation | [Lecture 06c](modules/06_model_compression/lecture_06c_knowledge_distillation.md) |
| 12 | Wed | Neural Architecture Search & Efficient Architectures | [Lecture 06d](modules/06_model_compression/lecture_06d_nas_efficient_architectures.md) |
| 12 | Fri | **HW6 Due** | [HW6: Compress & Benchmark](modules/06_model_compression/hw06_compress_benchmark.md) |

**Readings**: Frantar et al. (2023) GPTQ, Lin et al. (2024) AWQ, Frankle & Carlin (2019) Lottery Ticket, Hinton et al. (2015) Distillation

---

## Weeks 13--14: Inference & Serving Systems

### Module 07: Deploying Models at Scale

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 13 | Mon | Inference Optimization: Batching, Operator Fusion, Graph Optimization | [Lecture 07a](modules/07_inference_serving/lecture_07a_inference_optimization.md) |
| 13 | Wed | KV Cache Management & CUDA Paged Attention Kernels | [Lecture 07b](modules/07_inference_serving/lecture_07b_kv_cache_paged_attention.md) |
| 13 | Fri | *Recitation: Benchmarking LLM Serving (Throughput, Latency, TTFT)* | [Recitation 07](modules/07_inference_serving/recitation_07_serving_benchmarks.md) |
| 14 | Mon | Speculative Decoding & Draft-Verify Paradigms | [Lecture 07c](modules/07_inference_serving/lecture_07c_speculative_decoding.md) |
| 14 | Wed | Serving Architecture: C++ Engines, libtorch, TensorRT, vLLM Internals | [Lecture 07d](modules/07_inference_serving/lecture_07d_serving_frameworks.md) |
| 14 | Fri | **HW7 Due** | [HW7: C++ LLM Serving Engine](modules/07_inference_serving/hw07_serving_engine.md) |

**Mini-Project 2 Due: End of Week 14** -- [Spec](projects/mini_project_2/spec.md)

**Readings**: Kwon et al. (2023) vLLM/PagedAttention, Leviathan et al. (2023) Speculative Decoding, Yu et al. (2022) ORCA

---

## Weeks 15--16: Data Systems for ML

### Module 08: Data at Scale

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 15 | Mon | Data Loading, Preprocessing Pipelines, and I/O Bottlenecks | [Lecture 08a](modules/08_data_systems/lecture_08a_data_loading_io.md) |
| 15 | Wed | Feature Stores & Data Versioning | [Lecture 08b](modules/08_data_systems/lecture_08b_feature_stores_versioning.md) |
| 15 | Fri | *Recitation: Building a Data Pipeline with WebDataset/Mosaic* | [Recitation 08](modules/08_data_systems/recitation_08_data_pipeline.md) |
| 16 | Mon | Data Curation at Scale: Deduplication, Filtering, Quality Scoring | [Lecture 08c](modules/08_data_systems/lecture_08c_data_curation.md) |
| 16 | Wed | Streaming, Tokenization Pipelines, and Multimodal Data | [Lecture 08d](modules/08_data_systems/lecture_08d_streaming_multimodal_data.md) |
| 16 | Fri | **HW8 Due** | [HW8: End-to-End Data Pipeline](modules/08_data_systems/hw08_data_pipeline.md) |

**Capstone Milestone 3 Due: End of Week 15** -- [Full Draft](projects/capstone/milestone_3.md)

**Readings**: Penedo et al. (2023) FineWeb, Lee et al. (2022) Deduplication, Murray et al. (2021) tf.data

---

## Weeks 17--18: MLOps & Production Systems

### Module 09: ML in Production

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 17 | Mon | ML System Design Patterns & Architecture | [Lecture 09a](modules/09_mlops_production/lecture_09a_system_design_patterns.md) |
| 17 | Wed | Experiment Tracking, Model Registry, and CI/CD for ML | [Lecture 09b](modules/09_mlops_production/lecture_09b_experiment_tracking_cicd.md) |
| 17 | Fri | *Recitation: Deploying a Model with Containerization + Monitoring* | [Recitation 09](modules/09_mlops_production/recitation_09_deployment.md) |
| 18 | Mon | Monitoring, Drift Detection, and Online Evaluation | [Lecture 09c](modules/09_mlops_production/lecture_09c_monitoring_drift.md) |
| 18 | Wed | Cost Optimization: Spot Instances, Autoscaling, Multi-Tenancy | [Lecture 09d](modules/09_mlops_production/lecture_09d_cost_optimization.md) |
| 18 | Fri | **HW9 Due** | [HW9: Deploy with A/B Testing & Monitoring](modules/09_mlops_production/hw09_deploy_ab_testing.md) |

**Readings**: Sculley et al. (2015) Technical Debt in ML, Paleyes et al. (2022) Challenges in Deploying ML

---

## Weeks 19--20: Frontier Systems

### Module 10: Emerging ML Systems

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 19 | Mon | Mixture-of-Experts Systems: Routing, Load Balancing, Expert Parallelism | [Lecture 10a](modules/10_frontier/lecture_10a_moe_systems.md) |
| 19 | Wed | Long-Context Systems & Retrieval-Augmented Generation Infrastructure | [Lecture 10b](modules/10_frontier/lecture_10b_long_context_rag.md) |
| 19 | Fri | *Recitation: Benchmarking & Evaluation Methodology* | [Recitation 10](modules/10_frontier/recitation_10_benchmarking.md) |
| 20 | Mon | On-Device ML & Edge Deployment | [Lecture 10c](modules/10_frontier/lecture_10c_edge_tinyml.md) |
| 20 | Wed | Agentic Systems: Tool Use, Orchestration, and Inference Scaling | [Lecture 10d](modules/10_frontier/lecture_10d_agentic_systems.md) |
| 20 | Fri | **HW10 Due** | [HW10: MoE Routing & Expert Parallelism](modules/10_frontier/hw10_moe_expert_parallelism.md) |

**Capstone Final Report Due: End of Week 20** -- [Final Report](projects/capstone/final_report.md)

**Readings**: Fedus et al. (2022) Switch Transformer, Lin et al. (2023) MCUNet, Kwon et al. (2023) vLLM

---

## Paper Presentation Schedule

Each student presents one paper during the semester (15 min + 10 min Q&A).

- Weeks 3--4: Classic systems papers (pre-2020)
- Weeks 7--8: Distributed training papers (2019--2022)
- Weeks 11--14: Efficiency and serving papers (2022--2024)
- Weeks 17--20: Frontier systems papers (2024--present)

See [resources/paper_reading_guide.md](resources/paper_reading_guide.md) for presentation guidelines.
