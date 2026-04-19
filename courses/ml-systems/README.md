# Machine Learning Systems: From Silicon to Serving

**A PhD-track course in ML systems — 20 weeks, 11 modules, from hardware primitives to production deployment.**

---

## Overview

This course provides a rigorous, systems-oriented treatment of the infrastructure that powers modern machine learning. Every topic is developed with full architectural reasoning, implemented with real hardware in mind, and connected to state-of-the-art systems papers.

**What makes this course different:**

- Full-stack coverage — from GPU memory hierarchies to production serving at scale
- **Systems languages for systems work** — C++/CUDA for kernels, compilers, and inference engines; Python only where it genuinely belongs (PyTorch training orchestration, experiment tooling)
- Every system is built from scratch before using library abstractions
- Coverage of frontier topics: LLM serving, speculative decoding, MoE systems, ML compilers, and agentic infrastructure
- Research-oriented: students read systems papers, benchmark implementations, and produce an original capstone

**Language philosophy:** ML systems are systems. The core infrastructure — autodiff engines, GPU kernels, compiler passes, inference servers — is written in C++ and CUDA, not Python. This course reflects that reality. You will write C++ with pybind11, CUDA kernels, MLIR passes, and a C++ serving engine. Python is used for PyTorch-level training, scripting, and visualization — never as a substitute for proper systems code.

## Course Structure

| Module | Title | Weeks | Key Topics |
|--------|-------|-------|------------|
| 00 | [Hardware & Compute Foundations](modules/00_foundations/00_foundations.md) | Pre-work | CPU/GPU architecture, memory hierarchy, roofline model |
| 01 | [Automatic Differentiation & Frameworks](modules/01_autodiff_frameworks/01_autodiff_frameworks.md) | 1–2 | Computational graphs, autodiff engine in C++, pybind11, framework internals |
| 02 | [Efficient Operator Implementation](modules/02_efficient_operators/02_efficient_operators.md) | 3–4 | CUDA C++ GEMM, Triton kernels, Flash Attention |
| 03 | [ML Compilers & Graph Optimization](modules/03_ml_compilers/03_ml_compilers.md) | 5–6 | MLIR passes in C++, XLA, TVM, torch.compile, operator fusion |
| 04 | [Distributed Training Fundamentals](modules/04_distributed_training/04_distributed_training.md) | 7–8 | Data/model/pipeline parallelism, AllReduce, FSDP |
| 05 | [Large-Scale Training Systems](modules/05_large_scale_training/05_large_scale_training.md) | 9–10 | Mixed precision, Megatron-LM, DeepSpeed, fault tolerance |
| 06 | [Model Compression & Efficiency](modules/06_model_compression/06_model_compression.md) | 11–12 | Pruning, quantization, distillation, NAS |
| 07 | [Inference & Serving Systems](modules/07_inference_serving/07_inference_serving.md) | 13–14 | C++ serving engine, CUDA PagedAttention, KV caching, speculative decoding |
| 08 | [Data Systems for ML](modules/08_data_systems/08_data_systems.md) | 15–16 | Data pipelines, feature stores, curation at scale |
| 09 | [MLOps & Production Systems](modules/09_mlops_production/09_mlops_production.md) | 17–18 | Deployment, monitoring, CI/CD for ML, cost optimization |
| 10 | [Frontier Systems](modules/10_frontier/10_frontier.md) | 19–20 | MoE systems, edge ML, agentic infrastructure |

## Deliverables

- **11 Homeworks** (~20 hours each): systems analysis + from-scratch implementations
- **2 Mini-Projects**: custom kernel optimization (Week 8), distributed training system (Week 14)
- **1 Capstone**: original systems contribution with 4 milestones across the semester
- **Paper Reading**: 5–8 systems papers per module

---

## How to Use This Course

### As a Self-Learner

1. Read [PREREQUISITES.md](PREREQUISITES.md) and complete the self-assessment
2. Follow [SETUP.md](SETUP.md) to configure your environment
3. Work through modules sequentially — each builds on the previous
4. Do every homework from scratch before looking at solutions
5. Read at least the required papers for each module

### As a Course Instructor

- [SYLLABUS.md](SYLLABUS.md) contains a week-by-week schedule
- Lectures are designed for 75-minute sessions
- Recitations provide hands-on coding and profiling walkthroughs
- Homeworks and projects have detailed rubrics

### As a Researcher

- Jump to specific modules as needed
- Each lecture is self-contained with explicit prerequisites listed
- Use [resources/bibliography.md](resources/bibliography.md) as an annotated reading list

## Prerequisites

See [PREREQUISITES.md](PREREQUISITES.md) for details. In brief:

- **Systems**: Operating systems fundamentals, memory management, concurrency
- **Programming**: C++ fluency (C++17, templates, smart pointers, RAII), working CUDA knowledge, Python for PyTorch
- **Mathematics**: Linear algebra (through SVD), basic optimization
- **ML**: Neural networks, backpropagation, training loops (at the level of the deep-learning course Module 01)

## Notation

See [NOTATION.md](NOTATION.md) for the global notation reference used throughout all materials.

## Resources

- [Paper Reading Guide](resources/paper_reading_guide.md) — how to read ML systems papers effectively
- [Systems Reference](resources/systems_reference.md) — quick-reference for profiling tools and benchmarks
- [CUDA Patterns](resources/cuda_patterns.md) — idiomatic CUDA/Triton for research
- [Bibliography](resources/bibliography.md) — master annotated bibliography
- [Glossary](resources/glossary.md) — definitions of key terms

## Acknowledgments

This course draws inspiration from:

- CMU 10-414/714: Deep Learning Systems (Kolter & Chen)
- Stanford CS 329S: Machine Learning Systems Design (Huynh Chip)
- MIT 6.5940: TinyML and Efficient Deep Learning Computing (Song Han)
- UC Berkeley CS 294-162: Machine Learning Systems (Stoica & Zaharia)
- UW CSE 599W: Systems for ML (Chen & Ceze)
- Hennessy & Patterson — *Computer Architecture: A Quantitative Approach*
