# Notation Reference

This document defines all notation used throughout the course. When in doubt, refer here.

## Hardware & Performance

| Notation | Meaning |
|----------|---------|
| FLOP | Floating-point operation (one add or multiply) |
| FLOPS | Floating-point operations per second |
| TFLOPS | Tera-FLOPS (10^12 FLOPS) |
| BW | Memory bandwidth (bytes/second) |
| AI | Arithmetic intensity (FLOPs / bytes transferred) |
| SM | Streaming Multiprocessor (GPU compute unit) |
| HBM | High Bandwidth Memory |
| SRAM | Static Random Access Memory (on-chip, e.g., shared memory) |

## Memory & Storage

| Notation | Meaning |
|----------|---------|
| B | Bytes |
| KB, MB, GB, TB | Kilo/Mega/Giga/Tera-bytes (powers of 10 unless context implies binary) |
| KiB, MiB, GiB | Kibi/Mebi/Gibi-bytes (powers of 2) |
| FP32, FP16, BF16, FP8 | Floating-point formats (32/16/8 bit) |
| INT8, INT4 | Integer quantized formats |

## Parallelism & Distribution

| Notation | Meaning |
|----------|---------|
| DP | Data parallelism |
| TP | Tensor parallelism |
| PP | Pipeline parallelism |
| SP | Sequence parallelism |
| EP | Expert parallelism |
| N | Number of devices / GPUs |
| p | Number of pipeline stages |
| B_g | Global batch size (not `B`, which is reserved for Bytes) |
| b | Micro-batch size (B_g / N for data parallelism) |
| G | Number of gradient accumulation steps |

## Model Parameters

| Notation | Meaning |
|----------|---------|
| P | Total number of model parameters |
| L | Number of layers |
| d | Hidden dimension (d_model) |
| h | Number of attention heads |
| d_k | Dimension per attention head (d / h) |
| d_ff | Intermediate (feedforward) dimension, e.g., in SwiGLU FFN |
| V | Vocabulary size |
| S | Sequence length (uppercase; do not use lowercase `s` for sequence length to avoid collision with sparsity ratio) |
| E | Number of experts (MoE) |
| C_f | Capacity factor (MoE token-dropping threshold) |
| C | Number of FLOPs for one forward pass (~6P for Transformers) |

## Training

| Notation | Meaning |
|----------|---------|
| theta | All learnable parameters |
| eta | Learning rate |
| T | Total training steps |
| D | Dataset size (tokens) |
| C_total | Total compute budget (FLOPs) |
| B_r | Ridge point: the critical batch size where gradient noise equals gradient signal, above which data parallelism yields diminishing returns |
| L(theta) | Loss function |

## Inference & Serving

| Notation | Meaning |
|----------|---------|
| TTFT | Time to first token |
| TPOT | Time per output token |
| TPS | Tokens per second |
| QPS | Queries per second |
| SLO | Service-level objective: a target latency or throughput constraint (e.g., p99 TTFT < 500 ms) |
| KV cache | Key-value cache for autoregressive generation |

## Compression

| Notation | Meaning |
|----------|---------|
| s | Sparsity ratio (fraction of zeros) |
| w | Bit-width after quantization |
| alpha | Scaling factor (quantization) |
| z | Zero-point (asymmetric quantization) |

## Automatic Differentiation

| Notation | Meaning |
|----------|---------|
| v_i | Intermediate variable (node) in the computational graph |
| phi_i | Elementary operation at node i |
| dot(v_i), v&#x0307;_i | **Tangent variable**: directional derivative of v_i along perturbation direction dot(x), i.e. (partial v_i / partial x) . dot(x). The epsilon-coefficient in dual-number propagation (forward mode) |
| bar(v_i), v&#x0304;_i | **Adjoint variable**: sensitivity of the scalar output L to v_i, i.e. partial L / partial v_i (reverse mode) |
| J_f | Jacobian matrix of f, with entries [J_f]_{ij} = partial f_i / partial x_j |
| JVP | Jacobian-vector product: J_f(x) . dot(x) (computed by one forward-mode pass) |
| VJP | Vector-Jacobian product: J_f(x)^T . bar(y) (computed by one reverse-mode pass) |
| W | Computational work — cost of one forward evaluation of f (Sections on complexity) |
| e_i | Standard basis vector (1 in coordinate i, 0 elsewhere) |
| otimes | Kronecker product |
| odot | Hadamard (elementwise) product |

## Graphs & Compilation

| Notation | Meaning |
|----------|---------|
| G = (V, E) | Computation graph with nodes V and edges E |
| IR | Intermediate representation |
| HLO | High-level operations (XLA IR) |
| op | An operator / graph node |

## Common Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| GEMM | General matrix multiply |
| BLAS | Basic linear algebra subprograms |
| cuBLAS | CUDA BLAS library |
| cuDNN | CUDA Deep Neural Network library |
| NCCL | NVIDIA Collective Communications Library |
| NVLink | NVIDIA high-speed GPU interconnect |
| IB | InfiniBand |
| RoCE | RDMA over Converged Ethernet |
| PCIe | Peripheral Component Interconnect Express |
| TVM | Tensor Virtual Machine |
| XLA | Accelerated Linear Algebra (compiler) |
| MLIR | Multi-Level Intermediate Representation |
| ONNX | Open Neural Network Exchange |
| TRT | TensorRT |
| PTQ | Post-training quantization |
| QAT | Quantization-aware training |
| NAS | Neural architecture search |
| MoE | Mixture of experts |
| vLLM | vLLM serving framework (PagedAttention-based LLM inference engine) |
| TGI | Text Generation Inference |
| FSDP | Fully Sharded Data Parallel |
| ZeRO | Zero Redundancy Optimizer |
| DDP | Distributed Data Parallel |
