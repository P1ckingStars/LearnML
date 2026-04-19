# Prerequisites

This course assumes strong systems programming skills and mathematical maturity. Below is a detailed checklist — if you can comfortably solve 80%+ of the self-assessment problems, you are ready.

## 1. Systems Programming

**Required level**: A full undergraduate OS course (e.g., OSTEP or xv6) and comfort with C/C++.

You should be fluent in:

- Memory management: stack vs heap, pointers, cache locality
- Concurrency: threads, locks, atomics, race conditions
- Process scheduling, virtual memory, page tables
- Basic networking: sockets, TCP/IP, bandwidth vs latency
- Profiling: reading flame graphs, understanding bottlenecks

**Self-assessment problems**:

1. Explain why accessing a 2D array row-major vs column-major has different performance on modern CPUs.
2. Write a C program that demonstrates false sharing between two threads.
3. Estimate the time to read 1 GB sequentially from an NVMe SSD vs over a 100 Gbps network link.
4. Explain what happens at the hardware level when a CPU encounters a cache miss on an L1 access.

## 2. GPU Programming (Required)

**Required level**: Hands-on experience writing CUDA C++ kernels, profiling with Nsight, and understanding GPU architecture.

You should be fluent in:

- GPU architecture: SMs, warps, threads, blocks, grids
- Memory hierarchy: global, shared, registers, L1/L2
- CUDA C++: kernel launches (`<<<...>>>`), thread indexing, `__syncthreads()`, shared memory allocation
- Memory coalescing and bank conflicts (conceptual and practical)
- Using `nvcc` to compile and link CUDA code
- Nsight Systems / Nsight Compute for profiling

**Self-assessment**:

1. Explain the difference between GPU global memory and shared memory.
2. What is a warp, and why does warp divergence reduce performance?
3. Write a CUDA C++ kernel that adds two vectors element-wise. Compile and run it with `nvcc`.
4. Write a CUDA kernel that uses shared memory to perform a tiled 1D stencil operation. Explain why shared memory helps.
5. Explain how memory coalescing (or lack thereof) impacts GPU kernel performance, and describe a scenario where non-coalesced access leads to significant slowdown.
6. Profile a CUDA kernel with `nsys profile` and `ncu`. Identify achieved occupancy and memory throughput.

## 3. Linear Algebra

**Required level**: Undergraduate linear algebra with computational focus.

You should be fluent in:

- Matrix multiplication and its computational complexity
- Matrix decompositions: LU, QR, SVD (conceptual)
- Sparse vs dense representations
- Blocked/tiled matrix operations
- Norms: vector norms (l1, l2, l-inf), matrix norms (Frobenius)

**Self-assessment problems**:

1. How many FLOPs does multiplying an m x k matrix by a k x n matrix require?
2. Explain why tiled matrix multiplication is more cache-friendly than naive triple-loop multiplication.
3. Given a matrix stored in row-major order, what memory access pattern does column iteration produce?

## 4. Machine Learning Fundamentals

**Required level**: One ML course + familiarity with neural network training.

You should understand:

- Neural networks: forward pass, loss functions, backpropagation
- Stochastic gradient descent and its variants (Adam, etc.)
- Training loops: batching, epochs, learning rate schedules
- Overfitting, regularization, train/val/test splits
- Basic architectures: MLPs, CNNs, RNNs, Transformers (conceptual)
- Attention mechanism and the Transformer architecture (conceptual)

**Self-assessment**:

1. Implement a training loop in PyTorch for a 2-layer MLP on MNIST.
2. Explain why batch size affects both training speed and convergence.
3. Describe at a high level how the attention mechanism in a Transformer works.

## 5. Programming

**Required level**: Fluent in C++ (C++17) and comfortable with Python/PyTorch.

You should be comfortable with:

- C++17: RAII, smart pointers (`unique_ptr`, `shared_ptr`), move semantics, templates, `std::variant`, `std::optional`
- Build systems: CMake (writing `CMakeLists.txt`), linking libraries, managing dependencies
- Python: classes, decorators, generators, context managers
- pybind11: basic exposure helpful (we teach it in Module 01)
- PyTorch: tensors, autograd, nn.Module, DataLoader, training loops
- Git: branching, committing, basic collaboration
- Command line: SSH, tmux/screen, package management
- Docker basics (helpful for later modules)

## 6. Basic Networking & Distributed Systems (Helpful)

**Recommended level**: Conceptual understanding of distributed computing.

Familiarity with:

- Client-server architecture, RPC
- Consistency models (eventual, strong)
- Load balancing concepts
- Bandwidth, latency, throughput

## Recommended Textbooks

| Topic | Book |
|-------|------|
| Computer Architecture | Hennessy & Patterson, *Computer Architecture: A Quantitative Approach* |
| Operating Systems | Arpaci-Dusseau, *Operating Systems: Three Easy Pieces* (free online) |
| CUDA Programming | Kirk & Hwu, *Programming Massively Parallel Processors* (4th ed.) |
| Modern C++ | Stroustrup, *A Tour of C++* (3rd ed.) |
| Linear Algebra | Strang, *Linear Algebra and Its Applications* |
| Deep Learning | Goodfellow et al., *Deep Learning* (MIT Press) |
| Distributed Systems | Kleppmann, *Designing Data-Intensive Applications* |
| Compilers | Lattner et al., *MLIR: Scaling Compiler Infrastructure for Domain Specific Computation* (2021) |

## If You Need to Catch Up

- **Systems gap**: Work through OSTEP chapters 1-30 (free online), then write a simple memory allocator
- **GPU gap**: Complete NVIDIA's CUDA C/C++ Basics tutorial, then read Kirk & Hwu Ch. 1-5. Write a matrix transpose kernel with shared memory.
- **ML gap**: Complete the deep-learning course Module 01 or fast.ai's Practical Deep Learning
- **C++ gap**: Work through Stroustrup's *A Tour of C++* (3rd ed.) focusing on Ch. 1-9, 13-15. Then implement a thread-safe memory pool from scratch. Ensure you're comfortable with CMake.
- **Python gap**: Complete the PyTorch official tutorials (60-minute blitz + data loading)

Complete [HW0: Systems Bootcamp](modules/00_foundations/hw00_systems_bootcamp.md) as a diagnostic — it covers all prerequisite topics.
