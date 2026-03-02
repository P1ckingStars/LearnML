# Environment Setup

## Hardware Requirements

- **Minimum**: CPU with 16 GB RAM (sufficient for Modules 00–04)
- **Recommended**: NVIDIA GPU with ≥8 GB VRAM (RTX 3070 or better)
- **For LLM/Diffusion modules (05–10)**: NVIDIA GPU with ≥16 GB VRAM, or use cloud compute

### Cloud Options
If you lack a local GPU:
- **Google Colab Pro** ($10/month): T4/A100, sufficient for most homeworks
- **Lambda Labs**: A10/A100 on-demand
- **RunPod**: Good for longer training runs
- **University cluster**: Check with your department

## Software Setup

### 1. Install Conda

```bash
# Download Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh

# Or use Homebrew on macOS
brew install miniconda
```

### 2. Create the Course Environment

```bash
conda create -n deepnets python=3.11 -y
conda activate deepnets
```

### 3. Install PyTorch

```bash
# CUDA 12.1 (check your driver version with nvidia-smi)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# CPU only
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# macOS with Apple Silicon
pip install torch torchvision torchaudio
```

### 4. Install Additional Packages

```bash
pip install \
    numpy \
    scipy \
    matplotlib \
    seaborn \
    jupyter \
    jupyterlab \
    pandas \
    scikit-learn \
    tqdm \
    wandb \
    einops \
    datasets \
    tokenizers \
    transformers \
    accelerate \
    peft \
    sentencepiece
```

### 5. Verify Installation

```python
import torch
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"GPU memory: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB")

# Quick test
x = torch.randn(3, 3, device='cuda' if torch.cuda.is_available() else 'cpu')
print(f"Tensor device: {x.device}")
print(f"Matmul test: {(x @ x.T).shape}")
print("Setup successful!")
```

### 6. (Optional) Weights & Biases

We use W&B for experiment tracking in later modules.

```bash
wandb login
# Enter your API key from https://wandb.ai/authorize
```

### 7. (Optional) Hugging Face Hub

For accessing pre-trained models and datasets:

```bash
huggingface-cli login
# Enter your token from https://huggingface.co/settings/tokens
```

## Directory Structure for Submissions

```
LearnML/
├── submissions/
│   ├── hw00/
│   │   ├── hw00_solutions.pdf    # LaTeX writeup
│   │   └── code/                 # Implementation
│   ├── hw01/
│   │   ├── hw01_solutions.pdf
│   │   └── code/
│   │       ├── mlp_numpy.py
│   │       ├── mlp_pytorch.py
│   │       └── train.py
│   ├── ...
│   ├── mini_project_1/
│   │   ├── report.pdf
│   │   └── code/
│   └── capstone/
│       ├── report.pdf
│       └── code/
```

Create this structure:
```bash
for i in $(seq -w 0 10); do
    mkdir -p submissions/hw${i}/code
done
mkdir -p submissions/{mini_project_1,mini_project_2,capstone}/code
```

## LaTeX Setup (for writeups)

We recommend LaTeX for mathematical writeups.

```bash
# Ubuntu/Debian
sudo apt install texlive-full

# macOS
brew install --cask mactex

# Or use Overleaf (online, free tier available)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `CUDA out of memory` | Reduce batch size, use `torch.cuda.empty_cache()`, or use gradient accumulation |
| `No CUDA runtime found` | Install CUDA toolkit matching your PyTorch build |
| `Module not found` | Ensure you activated the conda environment: `conda activate deepnets` |
| Slow training on CPU | Use Colab for GPU access, or reduce model/dataset size for debugging |
| `RuntimeError: NCCL` | For multi-GPU: set `NCCL_P2P_DISABLE=1` as a workaround |
