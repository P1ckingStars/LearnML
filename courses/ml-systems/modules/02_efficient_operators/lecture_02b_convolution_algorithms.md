# Lecture 02b: Convolution Algorithms: im2col, Winograd, FFT

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Analyze** the computational complexity and memory access patterns of direct convolution and explain why it underperforms on GPUs.
2. **Derive** the im2col transformation and compute the memory overhead of converting convolution to GEMM.
3. **Apply** the Winograd minimal filtering algorithm to compute $F(m, r)$ for small tile sizes, proving the reduction in multiplications.
4. **Determine** when FFT-based convolution is preferable based on kernel size, and analyze its complexity trade-offs.
5. **Evaluate** cuDNN's algorithm selection strategy and the trade-offs between memory, compute, and numerical stability.

---

## 2. Motivation and Context

### 2.1 Convolution in Deep Learning

The 2D convolution operation is the backbone of convolutional neural networks. For input $X \in \mathbb{R}^{C_{\text{in}} \times H \times W}$ and kernel $K \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times k_h \times k_w}$:

$$Y[n, h, w] = \sum_{c=0}^{C_{\text{in}}-1} \sum_{i=0}^{k_h-1} \sum_{j=0}^{k_w-1} X[c, h+i, w+j] \cdot K[n, c, i, j]$$

for output channel $n = 0, \ldots, C_{\text{out}}-1$.

**FLOPs**: $2 \cdot C_{\text{out}} \cdot C_{\text{in}} \cdot k_h \cdot k_w \cdot H_{\text{out}} \cdot W_{\text{out}}$

For a ResNet-50 layer with $C_{\text{in}} = C_{\text{out}} = 256$, $k = 3$, $H = W = 56$:
$$\text{FLOPs} = 2 \times 256 \times 256 \times 9 \times 56 \times 56 \approx 3.7 \text{ GFLOP}$$

### 2.2 Why Not Direct Convolution?

Direct convolution (7-nested loop) has poor data reuse:

```c
for (n = 0; n < C_out; n++)           // output channel
  for (h = 0; h < H_out; h++)         // spatial height
    for (w = 0; w < W_out; w++)       // spatial width
      for (c = 0; c < C_in; c++)      // input channel
        for (i = 0; i < kH; i++)      // kernel height
          for (j = 0; j < kW; j++)    // kernel width
            Y[n][h][w] += X[c][h+i][w+j] * K[n][c][i][j];
```

Problems:
- The kernel $K$ is small ($3 \times 3 \times C \times C$) and reused heavily but the access pattern to $X$ involves sliding windows with overlapping regions.
- Irregular memory access: the window $X[c, h{:}h{+}k, w{:}w{+}k]$ is not contiguous for most memory layouts.
- Low arithmetic intensity for small kernels: each element of $X$ participates in at most $k^2$ output elements, limiting reuse.

The solution: reformulate convolution as a problem that maps to optimized GEMM.

---

## 3. im2col: Convolution as Matrix Multiplication

### 3.1 The Transformation

The **im2col** (image-to-column) transformation unrolls each receptive field of the input into a column of a matrix, then performs convolution as a single GEMM.

**Step 1**: Reshape the kernel $K \in \mathbb{R}^{C_{\text{out}} \times C_{\text{in}} \times k_h \times k_w}$ into a 2D matrix:

$$\hat{K} \in \mathbb{R}^{C_{\text{out}} \times (C_{\text{in}} \cdot k_h \cdot k_w)}$$

This is a simple reshape (no data movement).

**Step 2**: Extract each receptive field from $X$ and lay them out as columns:

$$\hat{X} \in \mathbb{R}^{(C_{\text{in}} \cdot k_h \cdot k_w) \times (H_{\text{out}} \cdot W_{\text{out}})}$$

Column $(h, w)$ of $\hat{X}$ contains the flattened patch $X[:, h{:}h{+}k_h, w{:}w{+}k_w]$.

**Step 3**: Compute:

$$\hat{Y} = \hat{K} \cdot \hat{X} \in \mathbb{R}^{C_{\text{out}} \times (H_{\text{out}} \cdot W_{\text{out}})}$$

**Step 4**: Reshape $\hat{Y}$ back to $Y \in \mathbb{R}^{C_{\text{out}} \times H_{\text{out}} \times W_{\text{out}}}$.

### 3.2 Worked Example

Consider: $C_{\text{in}} = 3$, $H = W = 5$, $k_h = k_w = 3$, stride $= 1$, padding $= 0$, $C_{\text{out}} = 2$.

- $H_{\text{out}} = W_{\text{out}} = 3$
- $\hat{K} \in \mathbb{R}^{2 \times 27}$ (2 output channels, $3 \times 3 \times 3 = 27$ unrolled kernel elements)
- $\hat{X} \in \mathbb{R}^{27 \times 9}$ (27 elements per patch, $3 \times 3 = 9$ output positions)
- GEMM: $(2 \times 27) \times (27 \times 9) = (2 \times 9)$

### 3.3 Memory Overhead Analysis

The im2col matrix $\hat{X}$ has dimensions $(C_{\text{in}} \cdot k_h \cdot k_w) \times (H_{\text{out}} \cdot W_{\text{out}})$.

**Original input memory**: $C_{\text{in}} \cdot H \cdot W$

**im2col memory**: $C_{\text{in}} \cdot k_h \cdot k_w \cdot H_{\text{out}} \cdot W_{\text{out}}$

**Blowup factor** (for stride 1, no padding):

$$\text{ratio} = \frac{C_{\text{in}} \cdot k_h \cdot k_w \cdot H_{\text{out}} \cdot W_{\text{out}}}{C_{\text{in}} \cdot H \cdot W} \approx k_h \cdot k_w$$

For $3 \times 3$ kernels: **9x memory overhead**. For $7 \times 7$ kernels: 49x. This is the main drawback of im2col.

### 3.4 Implicit GEMM (cuDNN's Approach)

cuDNN does not actually materialize the full im2col matrix. Instead, it uses **implicit GEMM**: the im2col indexing is computed on-the-fly within the GEMM kernel. Each thread computes the source address for its patch element using:

```c
// Implicit im2col: compute source index on the fly
int col = blockIdx.x * TILE_N + threadIdx.x;  // output spatial position
int row = threadIdx.y;                          // within C_in * kH * kW

int c_in = row / (kH * kW);
int kh   = (row / kW) % kH;
int kw   = row % kW;

int h_in = (col / W_out) * stride + kh - padding;
int w_in = (col % W_out) * stride + kw - padding;

float val = (h_in >= 0 && h_in < H && w_in >= 0 && w_in < W)
            ? X[c_in * H * W + h_in * W + w_in]
            : 0.0f;
```

This eliminates the memory overhead entirely at the cost of slightly more complex address computation in the kernel. On modern GPUs, the address computation is cheap relative to the memory latency.

### 3.5 im2col for the Backward Pass

The backward pass requires:

1. **Gradient w.r.t. input** ($dX$): This is a convolution of $dY$ with the transposed/rotated kernel. Using im2col, it becomes a GEMM with $\hat{K}^T$.

2. **Gradient w.r.t. kernel** ($dK$): This is a convolution between the input patches and the output gradient:

$$d\hat{K} = d\hat{Y} \cdot \hat{X}^T$$

Both operations reuse the same im2col infrastructure.

---

## 4. Winograd Minimal Filtering

### 4.1 The Core Idea

Winograd's minimal filtering algorithm (Winograd, 1980) reduces the number of **multiplications** required for small convolutions at the cost of extra additions. On modern GPUs, the cost difference between individual multiplications and additions is negligible (both are single-cycle FMA-class operations). The real benefit comes from reducing the **total operation count**: fewer multiplications means fewer FMAs overall, and the Winograd transform reshapes the computation into smaller element-wise products that can be more efficiently mapped to hardware, improving arithmetic throughput.

**Standard 1D convolution** of a filter $g$ of length $r$ with input $d$ to produce $m$ outputs requires $m \cdot r$ multiplications.

**Winograd** achieves $m + r - 1$ multiplications -- the **theoretical minimum** for computing $m$ outputs from an $r$-tap filter.

### 4.2 The $F(2, 3)$ Algorithm

Compute 2 outputs from a 3-tap filter. Standard: $2 \times 3 = 6$ multiplications. Winograd: $2 + 3 - 1 = 4$ multiplications. Savings: 33%.

Given input $d = [d_0, d_1, d_2, d_3]^T$ and filter $g = [g_0, g_1, g_2]^T$:

$$\begin{bmatrix} y_0 \\ y_1 \end{bmatrix} = \begin{bmatrix} d_0 g_0 + d_1 g_1 + d_2 g_2 \\ d_1 g_0 + d_2 g_1 + d_3 g_2 \end{bmatrix}$$

Winograd reformulates this as:

$$m_1 = (d_0 - d_2) \cdot g_0$$
$$m_2 = (d_1 + d_2) \cdot \frac{g_0 + g_1 + g_2}{2}$$
$$m_3 = (d_2 - d_1) \cdot \frac{g_0 - g_1 + g_2}{2}$$
$$m_4 = (d_1 - d_3) \cdot g_2$$

$$y_0 = m_1 + m_2 + m_3$$
$$y_1 = m_2 - m_3 - m_4$$

Only 4 multiplications (the $m_i$ terms). The filter transforms $\frac{g_0 + g_1 + g_2}{2}$ etc. are precomputed once.

### 4.3 Matrix Form: $Y = A^T[(Gg) \odot (B^Td)]$

The Winograd algorithm for $F(m, r)$ can be expressed in matrix form:

$$Y = A^T \left[ (G \cdot g) \odot (B^T \cdot d) \right]$$

where:
- $g \in \mathbb{R}^r$: filter
- $d \in \mathbb{R}^{m+r-1}$: input tile
- $G \in \mathbb{R}^{(m+r-1) \times r}$: filter transform matrix
- $B^T \in \mathbb{R}^{(m+r-1) \times (m+r-1)}$: input transform matrix
- $A^T \in \mathbb{R}^{m \times (m+r-1)}$: output inverse transform matrix
- $\odot$: element-wise multiplication

For $F(2, 3)$:

$$B^T = \begin{bmatrix} 1 & 0 & -1 & 0 \\ 0 & 1 & 1 & 0 \\ 0 & -1 & 1 & 0 \\ 0 & 1 & 0 & -1 \end{bmatrix}, \quad
G = \begin{bmatrix} 1 & 0 & 0 \\ \frac{1}{2} & \frac{1}{2} & \frac{1}{2} \\ \frac{1}{2} & -\frac{1}{2} & \frac{1}{2} \\ 0 & 0 & 1 \end{bmatrix}, \quad
A^T = \begin{bmatrix} 1 & 1 & 1 & 0 \\ 0 & 1 & -1 & -1 \end{bmatrix}$$

### 4.4 Extension to 2D: $F(m \times m, r \times r)$

For 2D convolution with an $r \times r$ filter producing $m \times m$ outputs per tile:

$$Y = A^T \left[ (G \cdot g \cdot G^T) \odot (B^T \cdot d \cdot B) \right] A$$

The element-wise multiplications are now $(m+r-1)^2$ instead of $(mr)^2$ for direct computation.

For $F(4 \times 4, 3 \times 3)$ (used in cuDNN):
- Direct: $4 \times 4 \times 3 \times 3 = 144$ multiplications per tile
- Winograd: $(4 + 3 - 1)^2 = 36$ multiplications per tile
- **Savings: 75%** (4x fewer multiplications)

### 4.5 Winograd for Multi-Channel Convolution

For $C_{\text{in}}$ input channels and $C_{\text{out}}$ output channels:

1. Transform all input tiles: $\hat{d}^{(c)} = B^T d^{(c)} B$ for each channel $c$ and each spatial tile
2. Transform all filters: $\hat{g}^{(n,c)} = G g^{(n,c)} G^T$ (precomputed)
3. For each of the $(m+r-1)^2$ transform positions $(\xi, \nu)$: perform a GEMM:

$$\hat{Y}^{(n)}_{\xi,\nu} = \sum_{c=0}^{C_{\text{in}}-1} \hat{g}^{(n,c)}_{\xi,\nu} \cdot \hat{d}^{(c)}_{\xi,\nu}$$

This is a **batched GEMM** with $(m+r-1)^2$ independent matrix multiplications, each of size $C_{\text{out}} \times C_{\text{in}}$ times $C_{\text{in}} \times P$ where $P$ is the number of spatial tiles.

4. Inverse-transform all output tiles: $Y^{(n)} = A^T \hat{Y}^{(n)} A$

### 4.6 Numerical Stability Concerns

Winograd has a significant drawback: **numerical instability for large tile sizes**. The transform matrices $B^T$ and $G$ contain entries that grow rapidly with $m$, amplifying rounding errors.

For $F(2, 3)$ and $F(4, 3)$, the condition numbers are acceptable. For $F(6, 3)$, errors become noticeable in FP16. This is why cuDNN only uses Winograd for $3 \times 3$ kernels with small tiles and typically in FP32 accumulation mode.

---

## 5. FFT-Based Convolution

### 5.1 The Convolution Theorem

The convolution theorem states that convolution in the spatial domain equals element-wise multiplication in the frequency domain:

$$y = x * g \iff \hat{y} = \hat{x} \odot \hat{g}$$

where $\hat{\cdot}$ denotes the Discrete Fourier Transform (DFT).

**Algorithm**:
1. Zero-pad $x$ and $g$ to length $n = H_{\text{out}} + k - 1$ (or next power of 2)
2. Compute FFT: $\hat{x} = \text{FFT}(x)$, $\hat{g} = \text{FFT}(g)$ -- $O(n \log n)$
3. Element-wise multiply: $\hat{y} = \hat{x} \odot \hat{g}$ -- $O(n)$
4. Inverse FFT: $y = \text{IFFT}(\hat{y})$ -- $O(n \log n)$

### 5.2 Complexity Comparison

For a 1D convolution with input length $N$ and kernel length $K$:

| Method | Multiplications | When Best |
|--------|:-:|:-:|
| Direct | $NK$ | Very small $K$ |
| Winograd | $\approx N + K$ | $K = 3, 5$ |
| FFT | $O(N \log N)$ | Large $K$ ($\ge 7$--$11$) |

For 2D ($N \times N$ input, $K \times K$ kernel):

| Method | Multiplications |
|--------|:-:|
| Direct | $N^2 K^2$ |
| FFT | $O(N^2 \log N)$ |

The crossover point where FFT wins is roughly $K \ge 7$ for 1D and $K \ge 11$ for 2D, depending on the implementation.

### 5.3 Why FFT Is Rarely Used in Modern DNNs

1. **Small kernels dominate**: Modern architectures use $3 \times 3$ (or $1 \times 1$) kernels almost exclusively. At $K = 3$, Winograd and im2col-GEMM are faster.

2. **Memory overhead**: The FFT requires zero-padding to the output size, and complex-valued intermediate results double the storage.

3. **Multi-channel complication**: For $C_{\text{in}}$ input channels, you need $C_{\text{in}}$ FFTs. The frequency-domain GEMM is $C_{\text{out}} \times C_{\text{in}}$ at each of $N^2$ frequency bins -- the same GEMM-per-frequency-bin structure as Winograd.

4. **Poor Tensor Core utilization**: FFT operations are not GEMM-shaped and cannot leverage Tensor Cores effectively.

### 5.4 Overlap-Add and Overlap-Save

For very long sequences (1D signal processing, audio), FFT convolution uses the **overlap-add** or **overlap-save** method to process the input in blocks:

**Overlap-Add**:
1. Partition input $x$ into blocks of length $L$
2. For each block: zero-pad to $L + K - 1$, FFT, multiply with $\hat{g}$, IFFT
3. Overlap and add adjacent output blocks (they share $K-1$ overlapping samples)

Optimal block size: $L \approx K$ minimizes total work of $O\left(\frac{N}{L}(L + K)\log(L + K)\right)$.

---

## 6. cuDNN Algorithm Selection

### 6.1 Available Algorithms

cuDNN provides multiple convolution algorithms and selects among them based on the problem parameters:

| Algorithm | Description | Memory | Best For |
|-----------|------------|--------|----------|
| `IMPLICIT_GEMM` | On-the-fly im2col | Minimal | General purpose |
| `IMPLICIT_PRECOMP_GEMM` | Precomputed im2col indices | Low | General purpose, faster |
| `GEMM` | Explicit im2col + cuBLAS | $k^2 \times$ input | Large channels |
| `WINOGRAD` | Winograd $F(2,3)$ | Transform buffers | $3 \times 3$, FP32 |
| `WINOGRAD_NONFUSED` | Winograd with separate transforms | More workspace | $3 \times 3$, large batch |
| `FFT` | FFT-based | $O(HW)$ complex | Large kernels |
| `FFT_TILING` | Tiled FFT | Less than FFT | Large kernels, large input |

### 6.2 Heuristic Selection

cuDNN's `cudnnFindAlgorithm` and `cudnnGetAlgorithm` use a combination of:

1. **Analytical heuristics**: Based on problem dimensions, filter out algorithms that would exceed memory limits or are known to be slow.

2. **Benchmarking** (when `cudnnFindAlgorithm` is called): Actually run each candidate algorithm and time it. This adds startup cost but gives optimal selection.

3. **Caching**: PyTorch's `torch.backends.cudnn.benchmark = True` enables algorithm benchmarking on the first call for each input shape, caching the result for subsequent calls.

```python
import torch.backends.cudnn as cudnn

# Enable cuDNN benchmarking (recommended for fixed input sizes)
cudnn.benchmark = True

# For dynamic input sizes (e.g., NLP), disable to avoid re-benchmarking
cudnn.benchmark = False
```

### 6.3 The Trade-Off Space

The choice between algorithms involves three axes:

**Compute vs. Memory**:
- Explicit im2col uses $k^2 \times$ more memory but achieves the best GEMM performance.
- Implicit GEMM uses minimal extra memory but pays for on-the-fly index computation.

**Multiplications vs. Additions**:
- Winograd reduces multiplications by up to 4x but increases additions. On Tensor Cores (where multiply-accumulate is fused), the benefit is smaller.
- FFT replaces spatial multiplications with frequency-domain ones, but the complex arithmetic overhead is significant for small problems.

**Numerical Stability vs. Speed**:
- Winograd introduces rounding errors that grow with tile size.
- FFT introduces rounding errors proportional to $\log N$.
- For training in FP16, these errors can affect convergence. cuDNN defaults to Winograd only in FP32.

---

## 7. Depthwise Convolution

### 7.1 The Operation

In depthwise convolution (used in MobileNets, EfficientNets), each input channel is convolved independently with its own kernel:

$$Y[c, h, w] = \sum_{i=0}^{k_h-1} \sum_{j=0}^{k_w-1} X[c, h+i, w+j] \cdot K[c, i, j]$$

**FLOPs**: $2 \cdot C \cdot k^2 \cdot H_{\text{out}} \cdot W_{\text{out}}$ (factor of $C$ fewer than standard convolution).

### 7.2 Why It Is Hard to Optimize

Depthwise convolution cannot be converted to a single large GEMM because there is no summation over input channels. Each channel produces independent $k^2$-element dot products. This results in:

- Very low arithmetic intensity: $\text{AI} = O(k^2)$, which is memory-bound for $k = 3$.
- The "GEMM" per channel is tiny: $(1 \times k^2) \times (k^2 \times HW)$.
- cuDNN uses specialized direct-convolution kernels for depthwise, not the im2col path.

This is one reason why MobileNet-style architectures, despite having far fewer FLOPs than ResNets, do not achieve proportionally higher throughput on GPUs. The depthwise layers are memory-bound and underutilize compute resources.

---

## 8. Putting It All Together: Algorithm Selection in Practice

### 8.1 Decision Framework

```
Input: Conv2d parameters (C_in, C_out, kernel_size, H, W, stride, padding)
       Hardware: GPU model, available memory

1. If kernel_size == 1x1:
     → Use GEMM (reshape + matmul, no im2col needed)

2. If kernel_size == 3x3 and dtype == FP32 and C_in, C_out >= 64:
     → Try Winograd F(4,3) first (4x fewer multiplications)
     → Fallback to implicit GEMM if workspace insufficient

3. If kernel_size >= 7x7 and H, W >= 64:
     → Consider FFT (but benchmark against GEMM)

4. Default:
     → Implicit precomputed GEMM (good balance of memory and speed)

5. Always: benchmark if input shapes are fixed (cudnn.benchmark = True)
```

### 8.2 Profiling Example

```python
import torch
import torch.nn as nn
import time

def benchmark_conv(C_in, C_out, H, k, dtype=torch.float16):
    """Benchmark different convolution implementations."""
    conv = nn.Conv2d(C_in, C_out, k, padding=k//2, bias=False).to('cuda', dtype)
    x = torch.randn(32, C_in, H, H, device='cuda', dtype=dtype)

    # Warmup
    for _ in range(10):
        _ = conv(x)
    torch.cuda.synchronize()

    # Benchmark
    start = time.perf_counter()
    for _ in range(100):
        _ = conv(x)
    torch.cuda.synchronize()
    elapsed = (time.perf_counter() - start) / 100

    flops = 2 * C_out * C_in * k * k * H * H * 32  # batch=32
    tflops = flops / elapsed / 1e12
    print(f"Conv2d({C_in}->{C_out}, {k}x{k}, {H}x{H}): "
          f"{elapsed*1000:.3f} ms, {tflops:.1f} TFLOPS")

# Compare different kernel sizes
benchmark_conv(256, 256, 56, 1)   # 1x1: pure GEMM
benchmark_conv(256, 256, 56, 3)   # 3x3: Winograd or im2col
benchmark_conv(256, 256, 56, 7)   # 7x7: im2col or FFT
```

---

## Key Takeaways

1. im2col converts convolution to GEMM, the most optimized operation on GPUs, at the cost of $k^2 \times$ memory overhead. Implicit GEMM (cuDNN) eliminates this overhead by computing indices on the fly.
2. Winograd minimal filtering reduces multiplications by up to 4x for $3 \times 3$ kernels using the $F(4, 3)$ algorithm, but introduces numerical instability for large tile sizes and FP16 computation.
3. FFT-based convolution has $O(N \log N)$ complexity independent of kernel size, making it advantageous only for large kernels ($K \ge 7$) that are rare in modern architectures.
4. The optimal convolution algorithm depends on kernel size, channel count, spatial dimensions, data type, and available memory. cuDNN's benchmarking mode (`cudnn.benchmark = True`) automates this selection.
5. Depthwise convolution is inherently memory-bound ($\text{AI} = O(k^2)$) and cannot benefit from the GEMM reformulation, limiting the practical speedup of architectures that rely on it.

---

## Further Reading

1. **Chellapilla, K., Puri, S., & Simard, P.** (2006). "High Performance Convolutional Neural Networks for Document Processing." IWFHR.
2. **Lavin, A. & Gray, S.** (2016). "Fast Algorithms for Convolutional Neural Networks." *CVPR*.
3. **Winograd, S.** (1980). *Arithmetic Complexity of Computations*. SIAM.
4. **Vasilache, N. et al.** (2015). "Fast Convolutional Nets With fbfft: A GPU Performance Evaluation." *ICLR*.
5. **NVIDIA cuDNN Developer Guide**. [docs.nvidia.com/deeplearning/cudnn](https://docs.nvidia.com/deeplearning/cudnn/).
6. **Chetlur, S. et al.** (2014). "cuDNN: Efficient Primitives for Deep Learning." *arXiv:1410.0759*.
