# Recitation 01: PyTorch Fundamentals

## Overview

This recitation is a hands-on guide to PyTorch's core abstractions. Every code block is runnable. By the end, you will have a complete training pipeline that you can adapt for the homework and future modules.

**Prerequisites:** Python fluency, basic linear algebra, Lecture 01b (backpropagation).

---

## 1. Tensors: Creation, Indexing, and Broadcasting

### 1.1 Tensor Creation

```python
import torch
import numpy as np

# ── From Python lists ────────────────────────────────────────────
a = torch.tensor([1.0, 2.0, 3.0])         # shape: (3,), dtype: float32
b = torch.tensor([[1, 2], [3, 4]])         # shape: (2, 2), dtype: int64

# ── From NumPy (shared memory — no copy!) ────────────────────────
np_arr = np.array([1.0, 2.0, 3.0])
t = torch.from_numpy(np_arr)               # shape: (3,), same memory
np_arr[0] = 999.0
print(t[0])                                 # tensor(999.) — shared!

# To avoid shared memory, use torch.tensor() which always copies:
t_copy = torch.tensor(np_arr)              # independent copy

# ── Factory functions ────────────────────────────────────────────
z = torch.zeros(3, 4)                      # shape: (3, 4), all zeros
o = torch.ones(2, 3, 5)                    # shape: (2, 3, 5), all ones
r = torch.randn(4, 4)                      # shape: (4, 4), standard normal
u = torch.rand(3, 3)                       # shape: (3, 3), uniform [0, 1)
e = torch.eye(3)                           # shape: (3, 3), identity matrix
seq = torch.arange(0, 10, 2)               # tensor([0, 2, 4, 6, 8])
lin = torch.linspace(0, 1, 5)              # tensor([0.00, 0.25, 0.50, 0.75, 1.00])

# ── Specifying dtype and device ──────────────────────────────────
x = torch.randn(3, 3, dtype=torch.float64) # 64-bit float
x = torch.randn(3, 3, device='cpu')        # explicit CPU
# x = torch.randn(3, 3, device='cuda')     # GPU (if available)

# ── Like functions (match shape/dtype/device of existing tensor) ─
y = torch.zeros_like(x)                    # same shape, dtype, device as x
y = torch.randn_like(x)
```

### 1.2 Tensor Properties

```python
x = torch.randn(2, 3, 4)

print(x.shape)       # torch.Size([2, 3, 4])
print(x.size())      # same as .shape
print(x.ndim)        # 3 (number of dimensions)
print(x.numel())     # 24 (total number of elements)
print(x.dtype)       # torch.float32
print(x.device)      # device(type='cpu')
print(x.requires_grad)  # False (by default)
```

### 1.3 Indexing and Slicing

```python
x = torch.arange(24).reshape(2, 3, 4).float()
# x shape: (2, 3, 4)

# Basic indexing (same as NumPy)
print(x[0])              # shape: (3, 4) — first "batch"
print(x[0, 1])           # shape: (4,)   — first batch, second row
print(x[0, 1, 2])        # shape: ()     — scalar (0-dim tensor)

# Slicing
print(x[:, :2, :])       # shape: (2, 2, 4) — first two rows
print(x[:, ::2, :])       # shape: (2, 2, 4) — every other row
print(x[..., -1])         # shape: (2, 3)    — last element along last dim

# Boolean indexing
mask = x > 10
print(x[mask])            # 1D tensor of elements > 10

# Fancy indexing
indices = torch.tensor([0, 2])
print(x[:, indices, :])   # shape: (2, 2, 4) — rows 0 and 2
```

### 1.4 Reshaping

```python
x = torch.randn(2, 3, 4)  # shape: (2, 3, 4)

# reshape / view (view requires contiguous memory)
y = x.reshape(6, 4)       # shape: (6, 4)
y = x.view(2, 12)         # shape: (2, 12)
y = x.reshape(-1)          # shape: (24,) — flatten

# Permute dimensions
y = x.permute(2, 0, 1)    # shape: (4, 2, 3) — reorder axes

# Transpose (swaps two dimensions)
y = x.transpose(1, 2)     # shape: (2, 4, 3) — swap dims 1 and 2

# Unsqueeze / squeeze
y = x.unsqueeze(0)         # shape: (1, 2, 3, 4) — add dim at position 0
y = x.unsqueeze(-1)        # shape: (2, 3, 4, 1) — add dim at end
z = y.squeeze(-1)           # shape: (2, 3, 4)    — remove dim of size 1

# Expand (no memory copy — creates a view with repeated data)
a = torch.tensor([1.0, 2.0, 3.0])  # shape: (3,)
b = a.unsqueeze(0).expand(4, 3)     # shape: (4, 3) — 4 copies of a
```

### 1.5 Broadcasting Rules

Broadcasting allows operations on tensors of different shapes. Rules (applied right-to-left):

1. If tensors have different number of dimensions, pad the smaller one's shape with 1s on the left.
2. Dimensions of size 1 are stretched to match the other tensor's size.
3. Dimensions must match or one of them must be 1.

```python
# Example 1: Vector + scalar
a = torch.randn(3)                # shape: (3,)
b = torch.tensor(5.0)             # shape: ()
c = a + b                          # shape: (3,) — b broadcast to (3,)

# Example 2: Matrix + row vector
A = torch.randn(3, 4)             # shape: (3, 4)
v = torch.randn(4)                # shape: (4,)
# Step 1: v -> (1, 4) (pad left)
# Step 2: v -> (3, 4) (stretch dim 0)
C = A + v                          # shape: (3, 4)

# Example 3: Column vector + row vector -> outer product
col = torch.randn(3, 1)           # shape: (3, 1)
row = torch.randn(1, 4)           # shape: (1, 4)
outer = col + row                   # shape: (3, 4)

# Example 4: Batch matrix + single matrix
batch = torch.randn(8, 3, 4)      # shape: (8, 3, 4)
single = torch.randn(3, 4)        # shape: (3, 4)
# single -> (1, 3, 4) -> (8, 3, 4)
result = batch + single             # shape: (8, 3, 4)

# Common pitfall: incompatible shapes
# a = torch.randn(3, 4)
# b = torch.randn(3, 5)
# c = a + b   # ERROR: dimensions 4 and 5 do not match and neither is 1

# ── Useful broadcasting pattern: batch-wise operations ───────────
# Subtract per-feature mean from a batch
X = torch.randn(32, 784)           # (batch_size, features)
mean = X.mean(dim=0, keepdim=True)  # (1, 784)
X_centered = X - mean               # (32, 784) — broadcast over batch dim
```

---

## 2. Autograd: Automatic Differentiation

### 2.1 Tracking Gradients

```python
import torch

# Only tensors with requires_grad=True track gradients
x = torch.tensor([2.0, 3.0], requires_grad=True)
print(x.requires_grad)  # True

# Operations on tracked tensors create a computation graph
y = x ** 2              # y = [4.0, 9.0], y.grad_fn = <PowBackward0>
z = y.sum()             # z = 13.0,        z.grad_fn = <SumBackward0>

# .backward() computes gradients via reverse-mode AD
z.backward()

# Gradients are stored in the .grad attribute of leaf tensors
print(x.grad)           # tensor([4., 6.])  = d(x^2.sum())/dx = 2x

# IMPORTANT: gradients accumulate! Must zero them between iterations.
z = (x ** 3).sum()
z.backward()
print(x.grad)           # tensor([16., 33.])  NOT [12., 27.]
                         # because 4+12=16, 6+27=33 (accumulated!)

# Zero gradients explicitly:
x.grad.zero_()
z = (x ** 3).sum()
z.backward()
print(x.grad)           # tensor([12., 27.])  = 3*x^2, correct
```

### 2.2 The Computation Graph

```python
# The computation graph is dynamic — built during the forward pass
# and consumed (by default) during .backward()

x = torch.randn(3, requires_grad=True)
y = torch.randn(3, requires_grad=True)

# Build the graph
z = x * y              # element-wise multiply
w = z.sum() + (x ** 2).sum()

# Inspect the graph
print(w.grad_fn)                           # <AddBackward0>
print(w.grad_fn.next_functions)            # tuple of (SumBackward0, SumBackward0)

# Compute gradients
w.backward()
print(x.grad)  # dw/dx = y + 2x
print(y.grad)  # dw/dy = x

# After .backward(), the graph is freed (by default)
# Calling .backward() again will raise an error:
# w.backward()  # RuntimeError: graph already freed

# To keep the graph (e.g., for second derivatives), use retain_graph=True:
x.grad.zero_()
y.grad.zero_()
z = x * y
w = z.sum()
w.backward(retain_graph=True)  # graph is kept
# Now you can backward again or compute higher-order derivatives
```

### 2.3 Detaching and Stopping Gradient Flow

```python
# .detach() creates a tensor that shares data but has no gradient history
x = torch.randn(3, requires_grad=True)
y = x ** 2
z = y.detach()          # z has the same values as y, but no grad_fn
print(z.requires_grad)  # False

# Use case 1: target networks (reinforcement learning, self-supervised learning)
# The target should not receive gradients:
with torch.no_grad():
    target = model_target(x)   # no graph built, faster
# OR:
target = model_target(x).detach()  # graph built but then detached

# ── torch.no_grad() context manager ─────────────────────────────
# Disables gradient tracking entirely (faster, less memory)
x = torch.randn(1000, 1000, requires_grad=True)

with torch.no_grad():
    y = x @ x.T           # no computation graph built
    print(y.requires_grad)  # False

# Use case: inference, evaluation, manual parameter updates
```

### 2.4 Computing Gradients of Non-Scalar Outputs

```python
# .backward() only works on scalar tensors (by default)
# For non-scalar outputs, pass a gradient tensor (the "vector" in VJP):

x = torch.randn(3, requires_grad=True)
y = x ** 2  # shape: (3,) — not scalar!

# This is equivalent to computing v^T @ (dy/dx) where v is the gradient argument
v = torch.tensor([1.0, 0.0, 0.0])  # select gradient of y[0] w.r.t. x
y.backward(gradient=v)
print(x.grad)  # tensor([2*x[0], 0, 0])

# More commonly, use torch.autograd.grad for functional-style gradients:
x = torch.randn(3, requires_grad=True)
y = x ** 2
grads = torch.autograd.grad(
    outputs=y.sum(),
    inputs=x,
    create_graph=True,  # needed if you want to differentiate through this gradient
)
print(grads[0])  # tensor([2*x[0], 2*x[1], 2*x[2]])
```

---

## 3. nn.Module: Building Blocks

### 3.1 The nn.Module Base Class

```python
import torch.nn as nn

class SimpleLinearModel(nn.Module):
    """
    A minimal nn.Module example.

    Key concepts:
    - __init__: define layers (registered as submodules/parameters)
    - forward: define computation
    - Never call backward manually — autograd handles it
    """
    def __init__(self, d_in: int, d_out: int):
        super().__init__()  # ALWAYS call super().__init__()

        # nn.Parameter: a tensor that is automatically registered
        # and will appear in .parameters()
        self.weight = nn.Parameter(torch.randn(d_out, d_in))  # (d_out, d_in)
        self.bias = nn.Parameter(torch.zeros(d_out))           # (d_out,)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, d_in) -> (B, d_out)
        return x @ self.weight.T + self.bias

# ── Usage ────────────────────────────────────────────────────────
model = SimpleLinearModel(784, 10)
x = torch.randn(32, 784)         # (B=32, d_in=784)
y = model(x)                      # calls model.forward(x) -> (32, 10)

# Inspect parameters
for name, param in model.named_parameters():
    print(f"{name}: shape={param.shape}, requires_grad={param.requires_grad}")
# Output:
# weight: shape=torch.Size([10, 784]), requires_grad=True
# bias: shape=torch.Size([10]), requires_grad=True
```

### 3.2 Building an MLP with nn.Module

```python
class MLP(nn.Module):
    """
    Multi-layer perceptron with configurable depth and width.

    Args:
        dims: list of layer dimensions, e.g., [784, 256, 128, 10]
        activation: 'relu', 'tanh', 'sigmoid', or 'gelu'
        dropout_p: dropout probability (0 = no dropout)
    """
    def __init__(self, dims: list, activation: str = 'relu',
                 dropout_p: float = 0.0):
        super().__init__()

        activation_map = {
            'relu': nn.ReLU,
            'tanh': nn.Tanh,
            'sigmoid': nn.Sigmoid,
            'gelu': nn.GELU,
        }
        act_cls = activation_map[activation]

        layers = []
        for i in range(len(dims) - 1):
            layers.append(nn.Linear(dims[i], dims[i + 1]))
            if i < len(dims) - 2:  # no activation/dropout after last layer
                layers.append(act_cls())
                if dropout_p > 0:
                    layers.append(nn.Dropout(p=dropout_p))

        # nn.Sequential: chains modules in order
        self.network = nn.Sequential(*layers)

        # Apply Kaiming initialization
        self._init_weights()

    def _init_weights(self):
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, nonlinearity='relu')
                nn.init.zeros_(module.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, dims[0]) -> (B, dims[-1])
        return self.network(x)

# ── Usage ────────────────────────────────────────────────────────
model = MLP([784, 256, 128, 10], activation='relu', dropout_p=0.2)
print(model)
# MLP(
#   (network): Sequential(
#     (0): Linear(in_features=784, out_features=256, bias=True)
#     (1): ReLU()
#     (2): Dropout(p=0.2)
#     (3): Linear(in_features=256, out_features=128, bias=True)
#     (4): ReLU()
#     (5): Dropout(p=0.2)
#     (6): Linear(in_features=128, out_features=10, bias=True)
#   )
# )

# Count parameters
total_params = sum(p.numel() for p in model.parameters())
trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"Total parameters: {total_params:,}")
print(f"Trainable parameters: {trainable_params:,}")
```

### 3.3 model.train() vs. model.eval()

```python
model = MLP([784, 256, 10], dropout_p=0.5)

# Training mode: dropout is active, BN uses batch statistics
model.train()
out_train_1 = model(x)
out_train_2 = model(x)
# out_train_1 != out_train_2 (different dropout masks)

# Eval mode: dropout is disabled, BN uses running statistics
model.eval()
out_eval_1 = model(x)
out_eval_2 = model(x)
# out_eval_1 == out_eval_2 (deterministic)

# CRITICAL: Always switch to eval mode before validation/testing!
# Forgetting this is one of the most common PyTorch bugs.
```

### 3.4 Saving and Loading Models

```python
# Save model parameters (recommended)
torch.save(model.state_dict(), 'model_weights.pth')

# Load model parameters
model = MLP([784, 256, 128, 10])  # create model with same architecture
model.load_state_dict(torch.load('model_weights.pth'))

# Save entire model (less portable, uses pickle)
torch.save(model, 'model_full.pth')
model = torch.load('model_full.pth')
```

---

## 4. DataLoader: Datasets and Batching

### 4.1 Built-in Datasets

```python
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

# MNIST with standard preprocessing
transform = transforms.Compose([
    transforms.ToTensor(),           # PIL Image -> (1, 28, 28) float tensor in [0, 1]
    transforms.Normalize((0.1307,), (0.3081,)),  # normalize to mean=0, std=1
])

train_dataset = datasets.MNIST(
    root='./data',
    train=True,
    download=True,
    transform=transform,
)

test_dataset = datasets.MNIST(
    root='./data',
    train=False,
    download=True,
    transform=transform,
)

print(f"Training samples: {len(train_dataset)}")   # 60000
print(f"Test samples: {len(test_dataset)}")         # 10000

# Inspect a single sample
image, label = train_dataset[0]
print(f"Image shape: {image.shape}")  # torch.Size([1, 28, 28])
print(f"Label: {label}")              # integer 0-9
```

### 4.2 Custom Datasets

```python
from torch.utils.data import Dataset

class CustomDataset(Dataset):
    """
    Custom dataset for tabular data.

    Must implement:
    - __len__: return number of samples
    - __getitem__: return (input, target) for index i
    """
    def __init__(self, X: torch.Tensor, Y: torch.Tensor,
                 transform=None):
        assert len(X) == len(Y), "X and Y must have same length"
        self.X = X                     # (N, d)
        self.Y = Y                     # (N,) or (N, K)
        self.transform = transform

    def __len__(self) -> int:
        return len(self.X)

    def __getitem__(self, idx: int):
        x = self.X[idx]                # (d,)
        y = self.Y[idx]                # scalar or (K,)
        if self.transform:
            x = self.transform(x)
        return x, y

# Usage
X = torch.randn(1000, 784)
Y = torch.randint(0, 10, (1000,))
dataset = CustomDataset(X, Y)
print(len(dataset))                    # 1000
x, y = dataset[0]                      # single sample
print(x.shape, y.shape)               # torch.Size([784]) torch.Size([])
```

### 4.3 DataLoader

```python
# DataLoader wraps a Dataset with batching, shuffling, and multiprocessing

train_loader = DataLoader(
    dataset=train_dataset,
    batch_size=64,           # number of samples per batch
    shuffle=True,            # shuffle at every epoch (IMPORTANT for training)
    num_workers=4,           # parallel data loading processes
    pin_memory=True,         # faster CPU -> GPU transfer
    drop_last=True,          # drop incomplete last batch (useful for BN)
)

test_loader = DataLoader(
    dataset=test_dataset,
    batch_size=256,          # can be larger for eval (no gradients stored)
    shuffle=False,           # no need to shuffle for evaluation
    num_workers=4,
    pin_memory=True,
)

# Iterate over batches
for batch_idx, (images, labels) in enumerate(train_loader):
    print(f"Batch {batch_idx}: images shape = {images.shape}, "
          f"labels shape = {labels.shape}")
    # images: (64, 1, 28, 28), labels: (64,)
    break  # just print one batch

# Number of batches per epoch
print(f"Batches per epoch: {len(train_loader)}")
# = ceil(60000 / 64) = 938 (or 937 with drop_last=True)
```

### 4.4 Train/Validation Split

```python
from torch.utils.data import random_split

# Split training data into train and validation
train_size = 55000
val_size = 5000
train_subset, val_subset = random_split(
    train_dataset,
    [train_size, val_size],
    generator=torch.Generator().manual_seed(42),  # reproducible split
)

train_loader = DataLoader(train_subset, batch_size=64, shuffle=True)
val_loader = DataLoader(val_subset, batch_size=256, shuffle=False)
```

---

## 5. The Canonical Training Loop

### 5.1 Complete Training Pipeline

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import time

# ── 1. Configuration ─────────────────────────────────────────────

config = {
    'batch_size': 128,
    'lr': 1e-3,
    'weight_decay': 1e-4,
    'n_epochs': 20,
    'device': 'cuda' if torch.cuda.is_available() else 'cpu',
}

# ── 2. Data ──────────────────────────────────────────────────────

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])

train_dataset = datasets.MNIST('./data', train=True, download=True,
                                transform=transform)
test_dataset = datasets.MNIST('./data', train=False, transform=transform)

train_loader = DataLoader(train_dataset, batch_size=config['batch_size'],
                          shuffle=True, num_workers=2)
test_loader = DataLoader(test_dataset, batch_size=256,
                         shuffle=False, num_workers=2)

# ── 3. Model ─────────────────────────────────────────────────────

model = MLP([784, 256, 128, 10], activation='relu', dropout_p=0.2)
model = model.to(config['device'])

# ── 4. Loss and Optimizer ────────────────────────────────────────

criterion = nn.CrossEntropyLoss()
optimizer = optim.AdamW(
    model.parameters(),
    lr=config['lr'],
    weight_decay=config['weight_decay'],
)
scheduler = optim.lr_scheduler.CosineAnnealingLR(
    optimizer,
    T_max=config['n_epochs'],
)

# ── 5. Training Loop ─────────────────────────────────────────────

def train_one_epoch(model, loader, criterion, optimizer, device):
    """
    Train for one epoch.

    Returns:
        avg_loss: average training loss over all batches
        accuracy: training accuracy
    """
    model.train()  # Enable dropout, use batch stats for BN
    total_loss = 0.0
    correct = 0
    total = 0

    for batch_x, batch_y in loader:
        # Move data to device
        batch_x = batch_x.view(batch_x.size(0), -1).to(device)
        # batch_x: (B, 784) after flatten
        batch_y = batch_y.to(device)
        # batch_y: (B,) integer labels

        # Forward pass
        logits = model(batch_x)                     # (B, 10)
        loss = criterion(logits, batch_y)            # scalar

        # Backward pass
        optimizer.zero_grad()   # CRITICAL: zero gradients first
        loss.backward()         # compute gradients
        optimizer.step()        # update parameters

        # Track metrics
        total_loss += loss.item() * batch_x.size(0)
        preds = logits.argmax(dim=1)                 # (B,)
        correct += (preds == batch_y).sum().item()
        total += batch_x.size(0)

    return total_loss / total, correct / total

# ── 6. Evaluation ────────────────────────────────────────────────

@torch.no_grad()  # decorator version of torch.no_grad()
def evaluate(model, loader, criterion, device):
    """
    Evaluate on a dataset.

    Returns:
        avg_loss: average loss
        accuracy: classification accuracy
    """
    model.eval()  # Disable dropout, use running stats for BN
    total_loss = 0.0
    correct = 0
    total = 0

    for batch_x, batch_y in loader:
        batch_x = batch_x.view(batch_x.size(0), -1).to(device)
        batch_y = batch_y.to(device)

        logits = model(batch_x)
        loss = criterion(logits, batch_y)

        total_loss += loss.item() * batch_x.size(0)
        preds = logits.argmax(dim=1)
        correct += (preds == batch_y).sum().item()
        total += batch_x.size(0)

    return total_loss / total, correct / total

# ── 7. Main Training Loop ────────────────────────────────────────

best_val_acc = 0.0
history = {'train_loss': [], 'train_acc': [], 'test_loss': [], 'test_acc': []}

for epoch in range(config['n_epochs']):
    t0 = time.time()

    train_loss, train_acc = train_one_epoch(
        model, train_loader, criterion, optimizer, config['device']
    )
    test_loss, test_acc = evaluate(
        model, test_loader, criterion, config['device']
    )
    scheduler.step()

    # Record history
    history['train_loss'].append(train_loss)
    history['train_acc'].append(train_acc)
    history['test_loss'].append(test_loss)
    history['test_acc'].append(test_acc)

    # Save best model
    if test_acc > best_val_acc:
        best_val_acc = test_acc
        torch.save(model.state_dict(), 'best_model.pth')

    elapsed = time.time() - t0
    current_lr = optimizer.param_groups[0]['lr']
    print(f"Epoch {epoch+1:3d}/{config['n_epochs']} | "
          f"Train Loss: {train_loss:.4f} Acc: {train_acc:.4f} | "
          f"Test  Loss: {test_loss:.4f} Acc: {test_acc:.4f} | "
          f"LR: {current_lr:.6f} | "
          f"Time: {elapsed:.1f}s")

print(f"\nBest test accuracy: {best_val_acc:.4f}")
```

### 5.2 Plotting Training Curves

```python
import matplotlib.pyplot as plt

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(history['train_loss'], label='Train')
ax1.plot(history['test_loss'], label='Test')
ax1.set_xlabel('Epoch')
ax1.set_ylabel('Loss')
ax1.set_title('Loss Curves')
ax1.legend()

ax2.plot(history['train_acc'], label='Train')
ax2.plot(history['test_acc'], label='Test')
ax2.set_xlabel('Epoch')
ax2.set_ylabel('Accuracy')
ax2.set_title('Accuracy Curves')
ax2.legend()

plt.tight_layout()
plt.savefig('training_curves.png', dpi=150)
plt.show()
```

---

## 6. Debugging: Gradient Checking, Hooks, and Anomaly Detection

### 6.1 Gradient Checking

```python
# Numerical gradient check for custom layers
from torch.autograd import gradcheck

class MyCustomLayer(torch.autograd.Function):
    @staticmethod
    def forward(ctx, x, w):
        ctx.save_for_backward(x, w)
        return x * w.unsqueeze(0)  # element-wise multiply with broadcast

    @staticmethod
    def backward(ctx, grad_output):
        x, w = ctx.saved_tensors
        grad_x = grad_output * w.unsqueeze(0)
        grad_w = (grad_output * x).sum(dim=0)
        return grad_x, grad_w

# Test with float64 for numerical precision
x = torch.randn(3, 4, dtype=torch.float64, requires_grad=True)
w = torch.randn(4, dtype=torch.float64, requires_grad=True)

# gradcheck perturbs each input by eps and compares
passed = gradcheck(MyCustomLayer.apply, (x, w), eps=1e-6, atol=1e-4)
print(f"Gradient check passed: {passed}")
```

### 6.2 Hooks for Inspecting Gradients

```python
# ── Forward hooks: inspect activations ───────────────────────────

activation_store = {}

def make_forward_hook(name):
    def hook(module, input, output):
        activation_store[name] = output.detach().clone()
    return hook

model = MLP([784, 256, 128, 10])
# Register hooks on specific layers
hooks = []
for name, module in model.named_modules():
    if isinstance(module, nn.Linear):
        h = module.register_forward_hook(make_forward_hook(name))
        hooks.append(h)

# Run forward pass
x = torch.randn(1, 784)
y = model(x)

# Inspect activations
for name, act in activation_store.items():
    print(f"{name}: shape={act.shape}, "
          f"mean={act.mean():.4f}, std={act.std():.4f}")

# Clean up hooks
for h in hooks:
    h.remove()

# ── Backward hooks: inspect gradients ────────────────────────────

gradient_store = {}

def make_backward_hook(name):
    def hook(module, grad_input, grad_output):
        gradient_store[name] = {
            'grad_output': grad_output[0].detach().clone()
                if grad_output[0] is not None else None,
            'grad_input': grad_input[0].detach().clone()
                if grad_input[0] is not None else None,
        }
    return hook

model = MLP([784, 256, 128, 10])
hooks = []
for name, module in model.named_modules():
    if isinstance(module, nn.Linear):
        h = module.register_full_backward_hook(make_backward_hook(name))
        hooks.append(h)

# Forward + backward
x = torch.randn(1, 784)
y = model(x)
loss = y.sum()
loss.backward()

# Inspect gradients at each layer
for name, grads in gradient_store.items():
    go = grads['grad_output']
    gi = grads['grad_input']
    print(f"{name}: "
          f"grad_output norm={go.norm():.4f}" if go is not None else "",
          f"grad_input norm={gi.norm():.4f}" if gi is not None else "")

for h in hooks:
    h.remove()
```

### 6.3 Anomaly Detection

```python
# Enable anomaly detection to get better error messages for NaN/Inf gradients
# WARNING: Significantly slower, use only for debugging!

with torch.autograd.detect_anomaly():
    x = torch.randn(3, requires_grad=True)
    y = x ** 2
    z = torch.log(y)  # log(negative number) will trigger warning
    z.sum().backward()

# You can also set it globally:
# torch.autograd.set_detect_anomaly(True)
```

### 6.4 Common Debugging Checklist

```python
# ── Debugging template ───────────────────────────────────────────

def debug_training_step(model, batch_x, batch_y, criterion, optimizer):
    """
    A verbose training step for debugging.
    """
    # 1. Check input shapes and values
    print(f"Input shape: {batch_x.shape}, range: [{batch_x.min():.3f}, {batch_x.max():.3f}]")
    print(f"Labels shape: {batch_y.shape}, unique: {batch_y.unique().tolist()}")

    # 2. Forward pass
    model.train()
    logits = model(batch_x)
    print(f"Logits shape: {logits.shape}, range: [{logits.min():.3f}, {logits.max():.3f}]")

    # 3. Check for NaN/Inf
    assert not torch.isnan(logits).any(), "NaN in logits!"
    assert not torch.isinf(logits).any(), "Inf in logits!"

    # 4. Loss
    loss = criterion(logits, batch_y)
    print(f"Loss: {loss.item():.6f}")
    assert not torch.isnan(loss), "NaN loss!"

    # 5. Backward
    optimizer.zero_grad()
    loss.backward()

    # 6. Check gradients
    for name, param in model.named_parameters():
        if param.grad is not None:
            grad_norm = param.grad.norm().item()
            grad_max = param.grad.abs().max().item()
            has_nan = torch.isnan(param.grad).any().item()
            print(f"  {name}: grad_norm={grad_norm:.6f}, "
                  f"grad_max={grad_max:.6f}, has_nan={has_nan}")
            assert not has_nan, f"NaN gradient in {name}!"

    # 7. Update
    optimizer.step()
    print(f"Step completed successfully.\n")

# Usage:
# model = MLP([784, 256, 10])
# optimizer = optim.Adam(model.parameters(), lr=1e-3)
# criterion = nn.CrossEntropyLoss()
# batch_x, batch_y = next(iter(train_loader))
# batch_x = batch_x.view(batch_x.size(0), -1)
# debug_training_step(model, batch_x, batch_y, criterion, optimizer)
```

---

## 7. GPU Usage

### 7.1 Moving Tensors and Models to GPU

```python
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# Move model to GPU
model = MLP([784, 256, 10]).to(device)

# Move data to GPU (must do this for every batch)
x = torch.randn(32, 784).to(device)
y = model(x)  # computation happens on GPU

# Check where a tensor lives
print(x.device)  # device(type='cuda', index=0)

# Move back to CPU (e.g., for NumPy conversion)
x_cpu = x.cpu()
x_numpy = x_cpu.numpy()  # or: x.cpu().numpy()

# COMMON BUG: model on GPU, data on CPU (or vice versa)
# model(x_cpu)  # RuntimeError: expected device cuda but got cpu
```

### 7.2 Mixed Precision Training (Modern Practice)

```python
# Automatic mixed precision (AMP) for faster training on modern GPUs
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()

for batch_x, batch_y in train_loader:
    batch_x = batch_x.view(batch_x.size(0), -1).to(device)
    batch_y = batch_y.to(device)

    optimizer.zero_grad()

    # Forward pass in mixed precision
    with autocast():
        logits = model(batch_x)           # computed in float16 where safe
        loss = criterion(logits, batch_y)  # computed in float32

    # Backward pass with gradient scaling
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

---

## 8. Putting It All Together: Complete MNIST Example

```python
"""
Complete, self-contained MNIST training script.
Copy this file and run it directly.
"""
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms
import matplotlib.pyplot as plt
import time

# ── Configuration ────────────────────────────────────────────────

BATCH_SIZE = 128
LR = 1e-3
WEIGHT_DECAY = 1e-4
N_EPOCHS = 15
DEVICE = 'cuda' if torch.cuda.is_available() else 'cpu'
SEED = 42

torch.manual_seed(SEED)

# ── Data ─────────────────────────────────────────────────────────

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,)),
])

full_train = datasets.MNIST('./data', train=True, download=True,
                             transform=transform)
test_data = datasets.MNIST('./data', train=False, transform=transform)

train_data, val_data = random_split(
    full_train, [55000, 5000],
    generator=torch.Generator().manual_seed(SEED),
)

train_loader = DataLoader(train_data, BATCH_SIZE, shuffle=True,
                          num_workers=2, pin_memory=True)
val_loader = DataLoader(val_data, 256, shuffle=False,
                        num_workers=2, pin_memory=True)
test_loader = DataLoader(test_data, 256, shuffle=False,
                         num_workers=2, pin_memory=True)

# ── Model ────────────────────────────────────────────────────────

class MNISTClassifier(nn.Module):
    def __init__(self):
        super().__init__()
        self.flatten = nn.Flatten()                    # (B,1,28,28) -> (B,784)
        self.net = nn.Sequential(
            nn.Linear(784, 256),                       # (B, 256)
            nn.BatchNorm1d(256),                       # (B, 256)
            nn.ReLU(),                                 # (B, 256)
            nn.Dropout(0.2),                           # (B, 256)
            nn.Linear(256, 128),                       # (B, 128)
            nn.BatchNorm1d(128),                       # (B, 128)
            nn.ReLU(),                                 # (B, 128)
            nn.Dropout(0.2),                           # (B, 128)
            nn.Linear(128, 10),                        # (B, 10)
        )
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, nonlinearity='relu')
                nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (B, 1, 28, 28) -> (B, 10)
        return self.net(self.flatten(x))

model = MNISTClassifier().to(DEVICE)
criterion = nn.CrossEntropyLoss()
optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=N_EPOCHS)

# ── Training ─────────────────────────────────────────────────────

def run_epoch(model, loader, criterion, optimizer=None, device='cpu'):
    is_training = optimizer is not None
    model.train() if is_training else model.eval()

    total_loss = 0.0
    correct = 0
    total = 0

    ctx = torch.enable_grad() if is_training else torch.no_grad()
    with ctx:
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            loss = criterion(logits, y)

            if is_training:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

            total_loss += loss.item() * x.size(0)
            correct += (logits.argmax(1) == y).sum().item()
            total += x.size(0)

    return total_loss / total, correct / total

# Main loop
print(f"Training on {DEVICE}")
print(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
print("-" * 70)

history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}
best_val_acc = 0.0

for epoch in range(N_EPOCHS):
    t0 = time.time()
    train_loss, train_acc = run_epoch(model, train_loader, criterion,
                                       optimizer, DEVICE)
    val_loss, val_acc = run_epoch(model, val_loader, criterion,
                                   device=DEVICE)
    scheduler.step()

    history['train_loss'].append(train_loss)
    history['val_loss'].append(val_loss)
    history['train_acc'].append(train_acc)
    history['val_acc'].append(val_acc)

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), 'best_mnist_model.pth')

    print(f"Epoch {epoch+1:2d}/{N_EPOCHS} | "
          f"Train: {train_loss:.4f} / {train_acc:.4f} | "
          f"Val: {val_loss:.4f} / {val_acc:.4f} | "
          f"{time.time()-t0:.1f}s")

# ── Final evaluation ─────────────────────────────────────────────

model.load_state_dict(torch.load('best_mnist_model.pth'))
test_loss, test_acc = run_epoch(model, test_loader, criterion, device=DEVICE)
print(f"\nFinal test accuracy: {test_acc:.4f}")

# ── Plot ─────────────────────────────────────────────────────────

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
ax1.plot(history['train_loss'], label='Train')
ax1.plot(history['val_loss'], label='Validation')
ax1.set_xlabel('Epoch')
ax1.set_ylabel('Loss')
ax1.legend()
ax1.set_title('Loss')

ax2.plot(history['train_acc'], label='Train')
ax2.plot(history['val_acc'], label='Validation')
ax2.set_xlabel('Epoch')
ax2.set_ylabel('Accuracy')
ax2.legend()
ax2.set_title('Accuracy')

plt.tight_layout()
plt.savefig('mnist_training.png', dpi=150)
plt.show()
```

---

## 9. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    PyTorch Quick Reference                      │
├─────────────────────────────────────────────────────────────────┤
│ TENSOR CREATION                                                 │
│   torch.zeros(m, n)       torch.ones(m, n)                     │
│   torch.randn(m, n)       torch.rand(m, n)                     │
│   torch.eye(n)            torch.arange(start, end, step)       │
│   torch.tensor(list)      torch.from_numpy(arr)                │
│                                                                 │
│ TENSOR OPS                                                      │
│   x.reshape(a, b)         x.view(a, b)   (contiguous only)    │
│   x.permute(dims)         x.transpose(d1, d2)                  │
│   x.unsqueeze(dim)        x.squeeze(dim)                       │
│   x.expand(sizes)         x.contiguous()                       │
│   x @ y  (matmul)         x * y  (element-wise)               │
│   x.sum(dim)              x.mean(dim)    x.max(dim)           │
│                                                                 │
│ AUTOGRAD                                                        │
│   x.requires_grad_(True)  loss.backward()                      │
│   x.grad                  x.grad.zero_()                       │
│   x.detach()              torch.no_grad():                     │
│   torch.autograd.grad()   torch.autograd.gradcheck()           │
│                                                                 │
│ NN.MODULE                                                       │
│   model.train()           model.eval()                          │
│   model.parameters()      model.named_parameters()              │
│   model.to(device)        model.state_dict()                    │
│   model.load_state_dict() model.zero_grad()                     │
│                                                                 │
│ TRAINING LOOP                                                   │
│   optimizer.zero_grad()   →  loss = criterion(pred, target)    │
│   loss.backward()         →  optimizer.step()                   │
│   scheduler.step()                                              │
│                                                                 │
│ COMMON LAYERS                                                   │
│   nn.Linear(d_in, d_out)  nn.Conv2d(c_in, c_out, k)          │
│   nn.ReLU()               nn.GELU()                            │
│   nn.Dropout(p)           nn.BatchNorm1d(d)                    │
│   nn.LayerNorm(d)         nn.Embedding(vocab, dim)             │
│   nn.Sequential(...)      nn.ModuleList([...])                  │
│                                                                 │
│ SAVING/LOADING                                                  │
│   torch.save(model.state_dict(), path)                          │
│   model.load_state_dict(torch.load(path))                       │
└─────────────────────────────────────────────────────────────────┘
```

---

*This recitation accompanies Module 01 of the PhD Deep Learning course.*
