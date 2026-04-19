# Environment Setup

## Hardware Requirements

- **Minimum**: CPU with 16 GB RAM, NVIDIA GPU with >= 8 GB VRAM (sufficient for Modules 00-04)
- **Recommended**: NVIDIA GPU with >= 24 GB VRAM (RTX 4090 or better) for Modules 05-10
- **For distributed training modules (04-05)**: Access to a multi-GPU machine or cluster

### Cloud Options

If you lack sufficient local hardware:

- **Lambda Labs**: A100/H100 on-demand, good for distributed training labs
- **RunPod**: Flexible GPU instances, multi-GPU available
- **Google Colab Pro** ($10/month): T4/A100, sufficient for most single-GPU homeworks
- **University cluster**: Check with your department for multi-node access

## Software Setup

### 1. C++ Toolchain (Required — install first)

This course requires a modern C++ compiler and build system. Most homework code is C++17.

```bash
# GCC 12+ or Clang 15+ (Ubuntu/Debian)
sudo apt install build-essential gcc-12 g++-12 cmake ninja-build

# Verify
g++ --version    # needs C++17 support
cmake --version  # needs 3.20+
```

### 2. CUDA Toolkit (Required)

```bash
# CUDA Toolkit 12.x (includes nvcc, cuBLAS, cuDNN headers)
# Follow: https://developer.nvidia.com/cuda-downloads
# Verify:
nvcc --version
nvidia-smi
```

### 3. pybind11 (Required for Module 01)

```bash
# System install
pip install pybind11
# Or via conda: conda install -c conda-forge pybind11
# Verify:
python -m pybind11 --includes
```

### 4. MLIR/LLVM (Required for Module 03)

You need an MLIR-enabled LLVM build. Two options:

```bash
# Option A: Pre-built (recommended)
# Download LLVM 18+ release with MLIR enabled from:
# https://github.com/llvm/llvm-project/releases
# Extract and set:
export MLIR_DIR=/path/to/llvm-install/lib/cmake/mlir

# Option B: Build from source (~30 min on 8 cores)
git clone --depth 1 https://github.com/llvm/llvm-project.git
cd llvm-project
cmake -S llvm -B build -G Ninja \
    -DLLVM_ENABLE_PROJECTS="mlir" \
    -DLLVM_TARGETS_TO_BUILD="host;NVPTX" \
    -DCMAKE_BUILD_TYPE=Release \
    -DMLIR_ENABLE_CUDA_RUNNER=ON
cmake --build build --target check-mlir
export MLIR_DIR=$(pwd)/build/lib/cmake/mlir

# Verify:
mlir-opt --version
```

### 5. Install Conda & Python Environment

```bash
# Download Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh

conda create -n mlsys python=3.11 -y
conda activate mlsys
```

### 6. Install PyTorch

```bash
# CUDA 12.1 (check your driver version with nvidia-smi)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

### 7. Install Triton & Python Packages

```bash
# Triton (for kernel development in Module 02)
pip install triton

# Additional packages
pip install \
    numpy scipy matplotlib jupyter jupyterlab pandas tqdm \
    wandb datasets transformers accelerate deepspeed \
    tensorboard pynvml pybind11
```

### 8. Install Profiling Tools

```bash
# NVIDIA Nsight Systems (for GPU profiling)
# Download from: https://developer.nvidia.com/nsight-systems

# NVIDIA Nsight Compute (for kernel profiling)
# Download from: https://developer.nvidia.com/nsight-compute

# Verify profiling setup
nsys --version
ncu --version
```

### 9. Verify Installation

```bash
# Verify C++ toolchain
cat > /tmp/test_cuda.cu << 'EOF'
#include <cstdio>
__global__ void hello() { printf("CUDA kernel from thread %d\n", threadIdx.x); }
int main() {
    hello<<<1, 4>>>();
    cudaDeviceSynchronize();
    return 0;
}
EOF
nvcc -o /tmp/test_cuda /tmp/test_cuda.cu && /tmp/test_cuda
```

```python
# Verify Python/PyTorch
import torch
print(f"PyTorch: {torch.__version__}, CUDA: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")

# Verify pybind11
import pybind11
print(f"pybind11: {pybind11.__version__}")
print(f"includes: {pybind11.get_include()}")
```

### 10. (Optional) Docker Setup

For reproducible environments and deployment modules:

```bash
# Install Docker
# Follow: https://docs.docker.com/engine/install/

# Install NVIDIA Container Toolkit
# Follow: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

# Verify GPU access in Docker
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

### 11. (Optional) Weights & Biases

We use W&B for experiment tracking in later modules.

```bash
wandb login
# Enter your API key from https://wandb.ai/authorize
```

## Directory Structure for Submissions

```
LearnML/
├── submissions/
│   ├── mlsys_hw00/
│   │   ├── hw00_solutions.pdf
│   │   └── code/
│   ├── mlsys_hw01/                # C++ autodiff engine
│   │   ├── hw01_solutions.pdf
│   │   └── code/
│   │       ├── CMakeLists.txt
│   │       ├── include/
│   │       │   ├── tensor.h
│   │       │   └── autograd.h
│   │       ├── src/
│   │       │   ├── tensor.cpp
│   │       │   └── autograd.cpp
│   │       ├── bindings/
│   │       │   └── pybind_module.cpp
│   │       └── tests/
│   │           ├── test_tensor.cpp
│   │           └── test_autograd.py
│   ├── mlsys_hw02/                # CUDA GEMM + Triton Flash Attention
│   │   ├── hw02_solutions.pdf
│   │   └── code/
│   │       ├── CMakeLists.txt
│   │       ├── gemm_kernel.cu
│   │       ├── flash_attention.py  # Triton
│   │       └── benchmarks/
│   ├── mlsys_hw03/                # MLIR + torch.fx
│   │   ├── hw03_solutions.pdf
│   │   └── code/
│   │       ├── CMakeLists.txt
│   │       ├── mlir_passes/       # C++ MLIR passes
│   │       └── fx_passes/         # Python torch.fx
│   ├── ...
│   ├── mlsys_hw07/                # C++ serving engine
│   │   ├── hw07_solutions.pdf
│   │   └── code/
│   │       ├── CMakeLists.txt
│   │       ├── include/
│   │       ├── src/
│   │       └── cuda/
│   ├── mlsys_mini_project_1/
│   │   ├── report.pdf
│   │   └── code/
│   └── mlsys_capstone/
│       ├── report.pdf
│       └── code/
```

Create this structure:

```bash
for i in $(seq -w 0 10); do
    mkdir -p submissions/mlsys_hw${i}/code
done
mkdir -p submissions/mlsys_{mini_project_1,mini_project_2,capstone}/code
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `CUDA out of memory` | Reduce batch size, use `torch.cuda.empty_cache()`, or use gradient checkpointing |
| `No CUDA runtime found` | Install CUDA toolkit matching your PyTorch build |
| `triton` import error | Ensure Triton version matches your CUDA version |
| `NCCL timeout` | Check firewall rules, set `NCCL_P2P_DISABLE=1` as workaround |
| `nvcc not found` | Add CUDA to PATH: `export PATH=/usr/local/cuda/bin:$PATH` |
| Slow profiling | Use `nsys profile` for high-level view before `ncu` for kernel-level |
| Docker GPU not found | Install NVIDIA Container Toolkit and use `--gpus all` flag |
