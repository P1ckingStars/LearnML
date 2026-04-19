# Lecture 06b: Quantization --- PTQ, QAT, GPTQ, AWQ

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the uniform and affine quantization mappings, compute the quantization error as a function of bit-width and dynamic range, and distinguish symmetric from asymmetric schemes.
2. **Compare** Post-Training Quantization (PTQ) and Quantization-Aware Training (QAT) in terms of accuracy, computational cost, and applicability to pretrained models.
3. **Analyze** modern LLM quantization methods --- GPTQ, AWQ, and SqueezeLLM --- deriving their objective functions and explaining why they outperform naive round-to-nearest quantization.
4. **Evaluate** the tradeoffs between weight-only and weight-and-activation quantization in terms of memory bandwidth, compute throughput, and accuracy degradation.
5. **Reason** about the systems-level implications of INT8, INT4, and sub-4-bit quantization on GPU memory, bandwidth utilization, and kernel efficiency.

---

## 2. Motivation and Context

### 2.1 The Memory Wall

Modern LLMs are memory-bandwidth bound during inference, not compute-bound. For autoregressive generation with batch size 1, each token requires reading the entire model's weights from GPU memory exactly once. The arithmetic intensity (FLOPs per byte loaded) is approximately:

$$\text{Arithmetic intensity} \approx \frac{2 \cdot d_{\text{model}}}{b_w}$$

where $b_w$ is the number of bytes per weight. For FP16 ($b_w = 2$) and $d_{\text{model}} = 4096$, this gives $\approx 4096$ FLOPs/byte, which seems high. But the actual bottleneck is per-token: each token requires loading all weights, performing $2 \cdot n_{\text{params}}$ FLOPs, and the ratio of compute time to memory time determines whether the workload is compute- or memory-bound.

For a 7B model in FP16 on an A100 (2 TB/s memory bandwidth, 312 TFLOPS):

- **Memory load time**: $14 \text{ GB} / 2000 \text{ GB/s} = 7 \text{ ms}$
- **Compute time**: $14 \times 10^9 \text{ FLOPs} / 312 \times 10^{12} \text{ FLOPS} = 0.045 \text{ ms}$

The model is 150x memory-bound. Quantizing from FP16 to INT4 reduces weight size by 4x, directly translating to a 4x reduction in memory load time and thus a proportional speedup for batch-1 inference.

### 2.2 Quantization Taxonomy

| Dimension | Options |
|-----------|---------|
| What is quantized | Weights only, weights + activations, weights + activations + KV cache |
| When | Post-training (PTQ), during training (QAT) |
| Bit-width | INT8, INT4, INT3, INT2, mixed-precision |
| Granularity | Per-tensor, per-channel, per-group, per-token |
| Scheme | Symmetric, asymmetric (affine) |

---

## 3. Quantization Fundamentals

### 3.1 Uniform Quantization

**Definition.** Uniform quantization maps a floating-point value $x \in \mathbb{R}$ to a $b$-bit integer $x_q \in \{0, 1, \ldots, 2^b - 1\}$ (unsigned) or $x_q \in \{-2^{b-1}, \ldots, 2^{b-1} - 1\}$ (signed) using a linear mapping.

**Asymmetric (affine) quantization.** Given a range $[\beta, \alpha]$ (min and max of the values to quantize):

$$\text{scale} \; s = \frac{\alpha - \beta}{2^b - 1}, \qquad \text{zero-point} \; z = \text{round}\left(-\frac{\beta}{s}\right)$$

$$\text{Quantize:} \quad x_q = \text{clamp}\left(\text{round}\left(\frac{x}{s}\right) + z, \; 0, \; 2^b - 1\right)$$

$$\text{Dequantize:} \quad \hat{x} = s \cdot (x_q - z)$$

The zero-point $z$ ensures that the real value 0.0 maps to an integer, which is critical for operations like zero-padding in convolutions.

**Symmetric quantization.** A special case where $z = 0$ and $\alpha = -\beta$:

$$s = \frac{\alpha}{2^{b-1} - 1}, \qquad x_q = \text{clamp}\left(\text{round}\left(\frac{x}{s}\right), \; -2^{b-1}, \; 2^{b-1} - 1\right)$$

Symmetric quantization is simpler (no zero-point computation in the inner loop) and is the standard choice for weight quantization in practice.

### 3.2 Quantization Error Analysis

The quantization error for a single value is:

$$\epsilon = x - \hat{x} = x - s \cdot \text{round}(x / s)$$

Assuming $x$ is uniformly distributed within a quantization bin of width $s$, the error is uniform on $[-s/2, s/2]$ with variance:

$$\text{Var}[\epsilon] = \frac{s^2}{12}$$

For a weight tensor $W$ quantized with scale $s$, the total mean squared error is:

$$\text{MSE} = \mathbb{E}\left[\|W - \hat{W}\|_F^2\right] \approx n \cdot \frac{s^2}{12}$$

where $n$ is the number of elements. Since $s \propto \text{range}(W) / 2^b$, the MSE scales as:

$$\text{MSE} \propto \frac{n \cdot \text{range}(W)^2}{12 \cdot 4^b}$$

Each additional bit of precision reduces quantization error by 4x ($6$ dB).

### 3.3 Quantization Granularity

**Per-tensor**: A single $(s, z)$ pair for the entire tensor. Simplest but most lossy --- if the tensor has outlier values, the range is stretched and interior values are quantized coarsely.

**Per-channel** (per-row for weight matrices): Each output channel has its own $(s_c, z_c)$. Standard for weight quantization. Allows different rows with different dynamic ranges to be quantized accurately.

**Per-group**: Divide each row into groups of $g$ elements, each with their own scale. Typical group sizes are $g = 32, 64, 128$. This is the standard for INT4 weight quantization:

$$\text{Overhead} = \frac{\text{FP16 scale per group}}{g \cdot b \text{ bits per weight}} = \frac{16}{g \cdot b}$$

For $g = 128$ and $b = 4$: overhead $= 16 / 512 = 3.1\%$, which is negligible.

**Per-token** (activations): Each token's activation vector has its own scale. This handles the wide variation in activation magnitudes across different tokens.

### 3.4 Implementation: Basic Quantization

```python
import torch

def symmetric_quantize(
    x: torch.Tensor,
    bits: int = 8,
    per_channel: bool = True,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Symmetric quantization of a weight tensor.

    Args:
        x: weight tensor, shape (out_features, in_features)
        bits: quantization bit-width
        per_channel: if True, compute scale per output channel

    Returns:
        x_q: quantized integer tensor, same shape as x
        scale: scale factor, shape (out_features, 1) or scalar
    """
    qmin = -(2 ** (bits - 1))
    qmax = 2 ** (bits - 1) - 1

    if per_channel:
        # Per-channel: max abs per row
        # x shape: (out_features, in_features)
        amax = x.abs().amax(dim=-1, keepdim=True)  # (out_features, 1)
    else:
        # Per-tensor: single max abs
        amax = x.abs().amax()  # scalar

    # Avoid division by zero
    amax = amax.clamp(min=1e-8)

    scale = amax / qmax  # (out_features, 1) or scalar

    # Quantize
    x_q = (x / scale).round().clamp(qmin, qmax).to(torch.int8)

    return x_q, scale


def dequantize(x_q: torch.Tensor, scale: torch.Tensor) -> torch.Tensor:
    """
    Dequantize: x_hat = scale * x_q

    Args:
        x_q: quantized tensor (int8)
        scale: scale factor

    Returns:
        x_hat: dequantized float tensor
    """
    return scale * x_q.float()


def group_quantize(
    x: torch.Tensor,
    bits: int = 4,
    group_size: int = 128,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Per-group symmetric quantization.

    Args:
        x: weight tensor, shape (out_features, in_features)
           in_features must be divisible by group_size
        bits: quantization bit-width
        group_size: number of elements per group

    Returns:
        x_q: quantized tensor, same shape as x
        scales: scale factors, shape (out_features, in_features // group_size)
    """
    assert x.shape[-1] % group_size == 0
    qmax = 2 ** (bits - 1) - 1

    # Reshape into groups: (out_features, num_groups, group_size)
    out_features, in_features = x.shape
    num_groups = in_features // group_size
    x_grouped = x.view(out_features, num_groups, group_size)

    # Per-group scale
    amax = x_grouped.abs().amax(dim=-1, keepdim=True)  # (out, num_groups, 1)
    amax = amax.clamp(min=1e-8)
    scales = amax / qmax  # (out, num_groups, 1)

    # Quantize
    x_q = (x_grouped / scales).round().clamp(-qmax, qmax)
    x_q = x_q.view(out_features, in_features)
    scales = scales.squeeze(-1)  # (out, num_groups)

    return x_q, scales
```

---

## 4. Post-Training Quantization (PTQ)

### 4.1 Round-to-Nearest (RTN)

The simplest PTQ approach: quantize each weight to the nearest integer grid point using the formulas above. No calibration data is needed (only the weight values determine the mapping). RTN works well for INT8 but degrades significantly at INT4 and below.

### 4.2 Calibration-Based PTQ

Better PTQ methods use a small calibration dataset (typically 128--512 samples from the training distribution) to:

1. **Determine activation ranges** for activation quantization.
2. **Optimize the quantization parameters** $(s, z)$ to minimize the output error of each layer.

The layer-wise optimization objective is:

$$\min_{s, z} \| W X - Q(W; s, z) X \|_F^2$$

where $X$ is the matrix of calibration activations and $Q(W; s, z)$ is the quantized-then-dequantized weight.

### 4.3 Handling Outliers: Clipping and Mixed-Precision

Weight distributions are approximately Gaussian, but activation distributions in transformers often have **outlier features** --- a small number of dimensions with magnitudes 10--100x larger than the rest (Dettmers et al., 2022). These outliers stretch the quantization range and waste most of the integer dynamic range on the bulk of the distribution.

**Clipping**: Choose $\alpha < \max(|x|)$ to sacrifice accuracy on outliers for better accuracy on inliers. The optimal clipping threshold minimizes:

$$\min_\alpha \; \mathbb{E}\left[(x - Q_\alpha(x))^2\right]$$

where $Q_\alpha$ clips to $[-\alpha, \alpha]$ before quantizing. For Gaussian-distributed values, the optimal $\alpha \approx 2.83\sigma$ for INT8 (Migacz, 2017).

**Mixed-precision (LLM.int8(), Dettmers et al., 2022)**: Keep outlier features (top 0.1% by magnitude) in FP16 and quantize the remaining 99.9% to INT8. The decomposition is:

$$Y = W X = W_{\text{outlier}} X_{\text{outlier}} + W_{\text{normal}} X_{\text{normal}}$$

where the outlier columns are identified from the calibration set.

---

## 5. Quantization-Aware Training (QAT)

### 5.1 The Straight-Through Estimator for Quantization

During QAT, quantization is inserted into the forward pass. The quantize-dequantize operation $\hat{x} = s \cdot \text{round}(x/s)$ has zero gradient almost everywhere (the rounding function is piecewise constant). The **straight-through estimator** (STE) approximates the gradient:

$$\frac{\partial \hat{x}}{\partial x} \approx \begin{cases} 1 & \text{if } x \in [\text{qmin} \cdot s, \; \text{qmax} \cdot s] \\ 0 & \text{otherwise} \end{cases}$$

This treats the quantization as an identity function within the clipping range and zero outside. The STE is biased but works well empirically because:

1. The quantization error is small relative to the weight values.
2. The gradient direction (which weights to increase/decrease) is approximately preserved.
3. The model adapts its weights to be "quantization-friendly" during training.

### 5.2 Fake Quantization

QAT uses **fake quantization** nodes in the computational graph: the forward pass simulates quantized computation in floating-point, and the backward pass uses the STE.

```python
class FakeQuantize(torch.autograd.Function):
    """
    Fake quantization: quantize then immediately dequantize.
    Forward: x -> round(x/s)*s  (simulates quantized values)
    Backward: straight-through estimator (gradient = 1 within range)
    """
    @staticmethod
    def forward(ctx, x: torch.Tensor, scale: torch.Tensor,
                zero_point: torch.Tensor, qmin: int, qmax: int):
        # x shape: arbitrary
        # scale shape: broadcastable to x
        x_q = ((x / scale) + zero_point).round().clamp(qmin, qmax)
        x_hat = (x_q - zero_point) * scale
        # Save mask for STE
        mask = ((x / scale + zero_point) >= qmin) & \
               ((x / scale + zero_point) <= qmax)
        ctx.save_for_backward(mask)
        return x_hat  # same shape as x

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        mask, = ctx.saved_tensors
        # STE: pass gradient through where within clipping range
        grad_input = grad_output * mask.float()
        return grad_input, None, None, None, None
```

### 5.3 QAT Training Procedure

```
Algorithm: Quantization-Aware Training
---------------------------------------
Input: Pretrained model M, training data D, target bit-width b

1. Insert FakeQuantize nodes after each weight and activation
2. Initialize quantization parameters (scale, zero-point) from
   weight ranges and calibration activations
3. For each training epoch:
   a. Forward pass: compute with fake-quantized weights/activations
   b. Backward pass: use STE to propagate gradients through FakeQuantize
   c. Update model weights with optimizer (Adam, SGD, etc.)
   d. Update quantization parameters (learned or recomputed from ranges)
4. Export: replace FakeQuantize with actual integer quantization
```

QAT typically requires 10--20% of the original training compute (a few epochs of fine-tuning on the training data) and closes most of the accuracy gap that PTQ leaves at INT4 and lower bit-widths.

---

## 6. LLM Quantization: GPTQ, AWQ, and Beyond

### 6.1 GPTQ (Frantar et al., 2023)

GPTQ adapts the Optimal Brain Quantization (OBQ) framework to scale to LLMs with billions of parameters. The core idea: quantize weights one column at a time, and after quantizing each column, update the remaining unquantized weights to compensate for the quantization error.

**Layer-wise objective.** For a linear layer with weight $W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$ and calibration inputs $X \in \mathbb{R}^{d_{\text{in}} \times n}$:

$$\min_{\hat{W}} \|WX - \hat{W}X\|_F^2$$

where $\hat{W}$ is the quantized weight. This decomposes row-by-row since the rows of $W$ are independent.

For a single row $w \in \mathbb{R}^{d_{\text{in}}}$, the objective is:

$$\min_{\hat{w}} \|wX - \hat{w}X\|_2^2 = \min_{\hat{w}} (w - \hat{w})^\top H (w - \hat{w})$$

where $H = XX^\top \in \mathbb{R}^{d_{\text{in}} \times d_{\text{in}}}$ is the Hessian of the quadratic loss.

**Optimal weight update.** When quantizing weight $w_j$ to $\hat{w}_j = Q(w_j)$, the optimal update to the remaining weights $w_{j+1:}$ that minimizes the increase in loss is (from Optimal Brain Surgeon):

$$\delta_{j+1:} = -\frac{w_j - \hat{w}_j}{[H^{-1}]_{jj}} \cdot (H^{-1})_{j+1:, j}$$

GPTQ processes columns in order $j = 1, 2, \ldots, d_{\text{in}}$, quantizing each and updating the rest. The Hessian inverse is updated efficiently using the Schur complement:

$$H_{-j}^{-1} = \left(H^{-1} - \frac{H^{-1}_{:,j} H^{-1}_{j,:}}{H^{-1}_{jj}}\right)_{-j,-j}$$

where the subscript $-j$ denotes removing row and column $j$.

**Lazy batch updates.** To exploit GPU parallelism, GPTQ processes columns in blocks of size $B$ (typically 128). Within a block, updates are accumulated lazily and applied once:

```python
def gptq_quantize_layer(
    W: torch.Tensor,         # (d_out, d_in) weight matrix
    H_inv: torch.Tensor,     # (d_in, d_in) inverse Hessian
    bits: int = 4,
    group_size: int = 128,
    block_size: int = 128,
) -> torch.Tensor:
    """
    GPTQ quantization for a single linear layer.

    Args:
        W: weight matrix, shape (d_out, d_in)
        H_inv: inverse of X @ X.T + lambda*I, shape (d_in, d_in)
        bits: target bit-width
        group_size: quantization group size
        block_size: columns processed per batch

    Returns:
        W_q: quantized weight matrix, shape (d_out, d_in)
    """
    d_out, d_in = W.shape
    W_q = torch.zeros_like(W)

    for col_start in range(0, d_in, block_size):
        col_end = min(col_start + block_size, d_in)
        # Current block of columns
        W_block = W[:, col_start:col_end].clone()
        Err = torch.zeros_like(W_block)

        for j in range(col_end - col_start):
            col_idx = col_start + j
            w = W_block[:, j]  # (d_out,)

            # Quantize this column
            # Determine group for scale computation
            group_idx = col_idx // group_size
            # ... compute per-group scale and quantize ...
            w_q = quantize_column(w, bits, group_size, group_idx)
            W_q[:, col_idx] = w_q

            # Quantization error
            err = (w - w_q) / H_inv[col_idx, col_idx]  # (d_out,)
            Err[:, j] = err

            # Update remaining columns in this block
            W_block[:, j+1:] -= err.unsqueeze(1) * \
                H_inv[col_idx, col_start+j+1:col_end].unsqueeze(0)

        # Apply accumulated error to remaining unprocessed columns
        W[:, col_end:] -= Err @ H_inv[col_start:col_end, col_end:]

    return W_q
```

**Complexity.** GPTQ processes each layer in $O(d_{\text{in}}^2 \cdot d_{\text{out}} / B)$ time, which is dominated by the Hessian inverse computation. For a 175B model, the entire quantization takes 3--4 GPU-hours.

### 6.2 AWQ: Activation-Aware Weight Quantization (Lin et al., 2024)

AWQ observes that not all weights are equally important: weights corresponding to channels with large activation magnitudes are disproportionately important. Rather than directly protecting these weights (which would require mixed-precision), AWQ scales them up before quantization:

**Key insight.** For a weight-activation pair $(w, x)$, the output contribution is $w \cdot x$. If we scale $w \to w \cdot s$ and $x \to x / s$ for some scalar $s > 0$, the output is unchanged but the quantization error changes:

$$\text{quantization error of } w \cdot s = s \cdot \Delta_w$$

where $\Delta_w$ is the per-element quantization error. The resulting output error is:

$$\text{output error} = (s \cdot \Delta_w) \cdot (x / s) = \Delta_w \cdot x$$

Wait --- this is unchanged. The benefit comes from the *relative* quantization error: scaling up salient weights reduces their *relative* error $\Delta_w / (w \cdot s)$ at the cost of increasing the relative error of non-salient weights. Since salient weights contribute more to the output, this trade-off is favorable.

**Optimal per-channel scale.** AWQ searches for the optimal scale $s_j$ per input channel $j$:

$$s_j^* = \arg\min_{s_j} \| Q(W \cdot \text{diag}(s)) \cdot \text{diag}(s)^{-1} X - WX \|_F^2$$

In practice, AWQ uses a grid search over $s_j \in \{ (\bar{x}_j)^\alpha : \alpha \in [0, 1] \}$ where $\bar{x}_j = \mathbb{E}[|X_j|]$ is the average activation magnitude. The parameter $\alpha$ trades off protection of salient channels vs. accuracy of non-salient channels.

### 6.3 SqueezeLLM (Kim et al., 2024)

SqueezeLLM combines two ideas:

1. **Sensitivity-based non-uniform quantization**: Instead of uniform quantization levels, use k-means clustering on weight values (weighted by the diagonal Hessian) to find optimal quantization centroids.
2. **Dense-and-sparse decomposition**: Extract outlier weights into a sparse matrix and quantize the remaining dense matrix. The output is:

$$Y = Q(W_{\text{dense}}) X + W_{\text{sparse}} X$$

where $W_{\text{sparse}}$ contains the top-$k$ outlier weights in FP16, and $Q(W_{\text{dense}})$ is the ultra-low-bit quantized dense matrix.

### 6.4 Comparison of LLM Quantization Methods

| Method | Retraining? | Calibration Data | Time (7B) | INT4 PPL (LLaMA-7B, WikiText-2) |
|--------|-------------|------------------|-----------|----------------------------------|
| RTN    | No          | No               | Minutes   | ~6.5 (+1.0 from FP16)           |
| GPTQ   | No          | 128 samples      | ~20 min   | ~5.7 (+0.2)                     |
| AWQ    | No          | 128 samples      | ~20 min   | ~5.6 (+0.1)                     |
| SqueezeLLM | No     | 128 samples      | ~40 min   | ~5.6 (+0.1) with sparse         |
| QAT    | Yes         | Full dataset     | ~Days     | ~5.5 (+0.0)                     |

---

## 7. Weight-Only vs. Weight-and-Activation Quantization

### 7.1 Weight-Only Quantization

Store weights in INT4/INT8 but dequantize to FP16 before matrix multiplication. The multiplication itself is in FP16.

**Advantages:**

- Simple: no activation calibration needed.
- Reduces memory footprint and bandwidth (the primary bottleneck for LLM inference).
- No accuracy loss from activation quantization (which is harder due to outliers and dynamic ranges).

**Disadvantage:**

- No compute speedup: the GEMM is still in FP16. Speedup comes only from reduced memory traffic.

### 7.2 Weight-and-Activation Quantization (W8A8, W4A16, etc.)

Both weights and activations are quantized, enabling integer matrix multiplication (IGEMM). The computation proceeds as:

$$Y = s_W \cdot s_X \cdot (W_q X_q) + \text{zero-point corrections}$$

where $W_q$ and $X_q$ are integer matrices and the multiply-accumulate is performed in INT32 arithmetic.

**Advantages:**

- Compute speedup: INT8 tensor cores on A100 provide 2x the throughput of FP16.
- Further memory reduction for activations and KV cache.

**Challenges:**

- Activation outliers cause severe accuracy degradation without careful handling (LLM.int8(), SmoothQuant).
- Dynamic activation ranges require per-token calibration at runtime.
- INT4 activation quantization is still an active research area.

### 7.3 SmoothQuant (Xiao et al., 2023)

SmoothQuant addresses activation outliers by migrating the quantization difficulty from activations to weights. The key observation: activation outlier channels are consistent across tokens (the same channels are always large). SmoothQuant applies a per-channel scaling:

$$Y = (X \cdot \text{diag}(s)^{-1}) \cdot (\text{diag}(s) \cdot W) = \hat{X} \hat{W}$$

The scaling factor $s_j = \max(|X_j|)^\alpha / \max(|W_j|)^{1-\alpha}$ balances the quantization difficulty between activations and weights, with $\alpha = 0.5$ being a typical choice.

After smoothing, both $\hat{X}$ and $\hat{W}$ have similar dynamic ranges per channel, enabling accurate W8A8 quantization.

---

## 8. Systems-Level Implications

### 8.1 Memory Savings

For a model with $N$ parameters:

| Precision | Bytes/param | 7B Model | 70B Model |
|-----------|-------------|----------|-----------|
| FP32      | 4           | 28 GB    | 280 GB    |
| FP16/BF16 | 2           | 14 GB    | 140 GB    |
| INT8      | 1           | 7 GB     | 70 GB     |
| INT4      | 0.5         | 3.5 GB   | 35 GB     |
| INT3      | 0.375       | 2.6 GB   | 26 GB     |
| INT2      | 0.25        | 1.75 GB  | 17.5 GB   |

Group quantization adds overhead: for group size 128 with INT4 weights, each group requires a FP16 scale (2 bytes). The effective bytes per parameter become:

$$b_{\text{eff}} = \frac{4}{8} + \frac{2}{128} = 0.516 \text{ bytes}$$

### 8.2 Inference Throughput

For batch-1 autoregressive generation (decode phase), throughput is:

$$\text{tokens/sec} \approx \frac{\text{memory bandwidth}}{N \cdot b_{\text{eff}}}$$

| GPU | BW (GB/s) | FP16 (tok/s) | INT8 (tok/s) | INT4 (tok/s) |
|-----|-----------|--------------|--------------|--------------|
| A100 80GB | 2039 | 145 | 291 | 582 |
| RTX 4090   | 1008 | 72  | 144 | 288 |
| Apple M2 Ultra | 800 | 57 | 114 | 228 |

These are theoretical upper bounds for a 7B model, ignoring attention compute and KV cache overhead.

### 8.3 Kernel Support

INT8 matrix multiplication is natively supported on all modern GPUs via tensor cores (NVIDIA: IMMA instructions, AMD: MFMA). INT4 matrix multiplication is supported starting from:

- NVIDIA Hopper (H100): native INT4 tensor cores.
- NVIDIA Ampere (A100): via INT4 packing into INT8 operands with custom kernels (e.g., CUTLASS, Marlin).

Sub-4-bit (INT3, INT2) requires custom dequantization kernels that unpack and dequantize weights to FP16 before the GEMM, losing the compute benefit but retaining the memory benefit.

---

## 9. The Quantization Error Propagation Problem

### 9.1 Error Accumulation Across Layers

Quantization error in one layer propagates to subsequent layers. For an $L$-layer network, the output error is approximately:

$$\|\Delta y\| \approx \sum_{\ell=1}^{L} \left(\prod_{k=\ell+1}^{L} \|W_k\|\right) \|\Delta W_\ell X_\ell\|$$

where $\Delta W_\ell$ is the quantization error at layer $\ell$. This is why layer-wise reconstruction (GPTQ, AWQ) works: by minimizing the output error of each layer independently, the accumulated error across the full network is controlled.

### 9.2 Sensitivity Analysis

Not all layers are equally sensitive to quantization. Common findings:

- **First and last layers** are most sensitive (they directly interface with the input/output distributions).
- **Attention layers** are generally more sensitive than FFN layers.
- **Deeper layers** in very deep networks tend to be less sensitive (higher redundancy).

This motivates **mixed-precision quantization**: keep sensitive layers in higher precision (INT8 or FP16) while aggressively quantizing robust layers to INT4 or below.

---

## Key Takeaways

1. **Quantization reduces memory and bandwidth** --- the primary bottleneck for LLM inference. INT4 weight quantization provides a near-4x memory reduction with minimal accuracy loss when using methods like GPTQ or AWQ.
2. **Per-group quantization** (group size 64--128) is essential for INT4 accuracy, adding only 3--5% storage overhead for the scales.
3. **PTQ methods** (GPTQ, AWQ) quantize pretrained models in minutes to hours using small calibration sets, achieving near-lossless INT4. QAT achieves slightly better accuracy but requires days of retraining.
4. **The Straight-Through Estimator** is the mathematical trick that makes QAT work: it provides a biased but effective gradient through the non-differentiable rounding operation.
5. **Weight-only quantization** reduces memory but not compute; **weight-and-activation quantization** reduces both but requires careful handling of activation outliers (SmoothQuant, LLM.int8()).

---

## Further Reading

### Required

1. **Frantar, E., Ashkboos, S., Hoefler, T., & Alistarh, D.** (2023). "GPTQ: Accurate Post-Training Quantization for Generative Pre-Trained Transformers." *ICLR 2023*.
   - Layer-wise Hessian-based weight quantization for LLMs. The standard PTQ method.

2. **Lin, J., Tang, J., Tang, H., Yang, S., Chen, W.-M., Wang, W.-C., Xiao, G., Dang, J., Gan, C., & Han, S.** (2024). "AWQ: Activation-Aware Weight Quantization for On-Device LLM Compression and Acceleration." *MLSys 2024*.
   - Activation-aware channel scaling before quantization. Competitive with GPTQ, more elegant.

### Recommended

3. **Jacob, B., Kligys, S., Chen, B., Zhu, M., Tang, M., Howard, A., Adam, H., & Kalenichenko, D.** (2018). "Quantization and Training of Neural Networks for Efficient Integer-Arithmetic-Only Inference." *CVPR 2018*.
   - The foundational paper on integer-only inference with quantization-aware training.

4. **Dettmers, T., Lewis, M., Belkada, Y., & Zettlemoyer, L.** (2022). "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale." *NeurIPS 2022*.
   - Mixed-precision decomposition for handling activation outliers in LLMs.

5. **Xiao, G., Lin, J., Seznec, M., Wu, H., Demouth, J., & Han, S.** (2023). "SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models." *ICML 2023*.
   - Migrates quantization difficulty from activations to weights via per-channel smoothing.

6. **Kim, S., Hooper, C., Gholami, A., Dong, Z., Li, X., Shen, S., Mahoney, M. W., & Keutzer, K.** (2024). "SqueezeLLM: Dense-and-Sparse Quantization." *ICML 2024*.
   - Non-uniform quantization with sparse outlier decomposition.

---

## Exercises

### Theory

**Exercise 6b.1.** Derive the optimal clipping threshold $\alpha^*$ for symmetric INT8 quantization of a Gaussian-distributed weight tensor $w \sim \mathcal{N}(0, \sigma^2)$. Minimize the expected MSE:

$$\alpha^* = \arg\min_\alpha \; \mathbb{E}\left[(w - Q_\alpha(w))^2\right]$$

where $Q_\alpha$ clips to $[-\alpha, \alpha]$ and then quantizes uniformly to 256 levels. Show that $\alpha^* \approx 2.83\sigma$.

**Exercise 6b.2.** For the GPTQ weight update formula $\delta_{j+1:} = -\frac{w_j - \hat{w}_j}{H^{-1}_{jj}} \cdot H^{-1}_{j+1:,j}$, prove that this is the solution to: "given that $w_j$ is fixed at $\hat{w}_j$, find the update to $w_{j+1:}$ that minimizes the quadratic objective $(w - \hat{w})^\top H (w - \hat{w})$."

**Exercise 6b.3.** SmoothQuant uses the scaling $s_j = (\max |X_j|)^\alpha / (\max |W_j|)^{1-\alpha}$. Show that for $\alpha = 0.5$, this equalizes the maximum values of the smoothed activations and weights per channel: $\max |\hat{X}_j| / \max |\hat{W}_j| = 1$.

### Implementation

**Exercise 6b.4.** Implement per-group INT4 quantization and measure the perplexity of a quantized GPT-2 (124M) model on WikiText-2. Compare RTN with group sizes 32, 64, 128, 256, and per-channel. Plot perplexity vs. group size.

**Exercise 6b.5.** Implement a simplified version of GPTQ for a single linear layer. Given a weight matrix and calibration activations, quantize column-by-column with Hessian-based weight updates. Compare the layer output MSE against RTN.

---

*Next: Lecture 06c --- Knowledge Distillation*
