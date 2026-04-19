# Lecture 10c: On-Device ML & Edge Deployment

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Characterize** the hardware constraints of edge and embedded platforms (memory, compute, power, latency) and derive the maximum model size deployable on a given target device.
2. **Apply** quantization, pruning, and architecture search techniques to compress a neural network for deployment on microcontrollers and mobile devices, while reasoning about the accuracy-efficiency Pareto frontier.
3. **Design** an end-to-end on-device inference pipeline using mobile inference frameworks (CoreML, TFLite, ONNX Runtime Mobile), including model conversion, operator compatibility, and hardware delegate selection.
4. **Analyze** the compiler optimizations performed by TVM and related frameworks when targeting ARM and RISC-V architectures, including operator fusion, memory planning, and instruction selection.
5. **Evaluate** the tradeoffs of federated learning for training across edge devices, including communication efficiency, privacy guarantees, and statistical heterogeneity.

---

## 2. Motivation and Context

### 2.1 Why Edge ML?

Cloud-based inference has fundamental limitations:

| Constraint | Cloud Inference | On-Device Inference |
|-----------|----------------|---------------------|
| Latency | 50-500 ms (network RTT) | 1-50 ms (local) |
| Privacy | Data leaves device | Data stays on device |
| Connectivity | Requires internet | Works offline |
| Cost | Per-query API cost | Zero marginal cost |
| Bandwidth | Sends raw data | Sends only results |

Applications requiring on-device ML:

- **Autonomous vehicles**: <10 ms latency for perception and planning.
- **Medical devices**: Privacy regulations prohibit sending patient data to cloud.
- **Wearables**: Always-on keyword detection, health monitoring.
- **Industrial IoT**: Anomaly detection at the sensor edge.
- **Mobile phones**: Camera effects, speech recognition, text prediction.

### 2.2 The Edge Hardware Landscape

Edge devices span a vast range of capabilities:

| Device Class | Examples | SRAM | Flash/Storage | Compute | Power |
|-------------|---------|------|--------------|---------|-------|
| Microcontroller (MCU) | ARM Cortex-M4, ESP32 | 256 KB | 1 MB | 100 MOPS | 10 mW |
| Microcontroller (high-end) | ARM Cortex-M7, M55 | 2 MB | 16 MB | 1 GOPS | 50 mW |
| Edge SoC | Raspberry Pi, Jetson Nano | 1-8 GB | 16-128 GB | 10-500 GOPS | 5-15 W |
| Mobile SoC | Apple A17, Snapdragon 8 Gen 3 | 6-8 GB | 128-512 GB | 2-20 TOPS | 3-10 W |
| Edge accelerator | Google Coral, Intel Movidius | 8-64 MB | -- | 4-40 TOPS | 2-5 W |
| Edge GPU | Jetson Orin, Apple M-series | 8-64 GB | 256 GB-2 TB | 50-300 TOPS | 15-60 W |

**The MCU challenge.** A typical ARM Cortex-M4 has 256 KB of SRAM. A single layer of MobileNetV2 requires ~400 KB of peak activation memory. Even storing model weights for a small CNN exceeds available flash. This forces extreme compression and careful memory management.

### 2.3 Connection to Prior Lectures

- **Lecture 06a-b (Pruning, Quantization)**: The compression techniques from Module 06 are essential building blocks for edge deployment. This lecture focuses on the systems integration.
- **Lecture 03b-d (ML Compilers)**: Compiler optimizations for edge targets (ARM, RISC-V) build on the compiler stack from Module 03.
- **Lecture 07a (Inference Optimization)**: Operator fusion and graph optimization apply equally to edge inference engines.

---

## 3. Model Optimization for Edge

### 3.1 Quantization for Edge Deployment

Edge quantization goes beyond the PTQ/QAT techniques covered in Lecture 06b. On microcontrollers, we target INT8 or even sub-byte (INT4, INT2, binary) precision.

**INT8 quantization scheme.** Given a floating-point tensor $x$, the quantized representation is:

$$x_q = \text{clamp}\left(\text{round}\left(\frac{x}{s}\right) + z,\, 0,\, 255\right)$$

where $s$ is the scale factor and $z$ is the zero-point:

$$s = \frac{x_{\max} - x_{\min}}{255}, \quad z = \text{round}\left(-\frac{x_{\min}}{s}\right)$$

**Per-channel vs per-tensor.** For weights, per-channel quantization (one scale per output channel) provides better accuracy:

$$W_{q}[:, c] = \text{round}\left(\frac{W[:, c]}{s_c}\right) + z_c$$

This adds negligible overhead since the scales are applied once during the GEMM accumulation.

**Mixed-precision quantization.** Different layers have different sensitivity to quantization. Sensitivity analysis determines the optimal bit-width per layer:

```python
def layer_sensitivity_analysis(model, calibration_data, target_metric="accuracy"):
    """
    Measure the impact of quantizing each layer individually.

    For each layer:
      1. Quantize only that layer to INT8
      2. Keep all other layers in FP32
      3. Measure accuracy drop
    """
    baseline = evaluate(model, calibration_data)
    sensitivities = {}

    for name, module in model.named_modules():
        if isinstance(module, (nn.Conv2d, nn.Linear)):
            # Quantize this layer only
            quantized_model = copy.deepcopy(model)
            quantize_layer(quantized_model, name, bits=8)

            metric = evaluate(quantized_model, calibration_data)
            sensitivities[name] = baseline - metric

    # Sort by sensitivity (most sensitive first)
    return dict(sorted(sensitivities.items(), key=lambda x: -x[1]))
```

Layers with high sensitivity (e.g., first and last layers) are kept at higher precision; insensitive layers can be aggressively quantized.

### 3.2 Structured Pruning for Hardware Efficiency

Unstructured pruning (individual weight zeroing) does not translate to speedups on most hardware because sparse operations require special support. Structured pruning removes entire channels, filters, or attention heads.

**Channel pruning.** Remove output channels $c$ from layer $\ell$ where:

$$\|W_\ell[:, c, :, :]\|_1 < \tau$$

This removes the corresponding input channels from layer $\ell + 1$, reducing both parameter count and FLOPs.

**Impact on GEMM.** For a Conv2d with $C_{\text{out}} \times C_{\text{in}} \times k \times k$ weights, pruning $p$ fraction of output channels reduces FLOPs by:

$$\Delta\text{FLOPs} = p \cdot 2 \cdot C_{\text{in}} \cdot k^2 \cdot H_{\text{out}} \cdot W_{\text{out}}$$

Unlike unstructured pruning, this translates directly to wall-clock speedup because the pruned GEMM operates on smaller, dense matrices.

### 3.3 Efficient Architecture Design

Rather than compressing large models, designing efficient architectures from scratch yields better Pareto efficiency.

**MobileNetV2 inverted residuals.**

$$\text{Block}(x) = x + \text{PW}_{1\times1}(\text{DW}_{3\times3}(\text{PW}_{1\times1}(x)))$$

where PW is pointwise (1x1) convolution and DW is depthwise convolution. The expansion ratio $t$ controls the inner dimension:

$$\text{FLOPs}_{\text{block}} = H W (d \cdot td + td \cdot k^2 + td \cdot d) = HWd^2(2t + tk^2/d)$$

Compare with a standard residual block:

$$\text{FLOPs}_{\text{standard}} = HW(d \cdot d \cdot k^2 + d \cdot d \cdot k^2) = 2HWd^2k^2$$

The ratio: $\frac{2t + tk^2/d}{2k^2} \approx \frac{t}{k^2}$ for large $d$. With $t = 6$ and $k = 3$: ratio $\approx 0.67$ -- a 33% FLOPs reduction.

**EfficientNet compound scaling.** Scale depth ($d$), width ($w$), and resolution ($r$) simultaneously:

$$d = \alpha^\phi, \quad w = \beta^\phi, \quad r = \gamma^\phi$$

subject to $\alpha \cdot \beta^2 \cdot \gamma^2 \approx 2$ (each step doubles FLOPs). The optimal coefficients are found via grid search on a small base model.

---

## 4. TinyML: Deploying on Microcontrollers

### 4.1 The Memory Challenge

On MCUs, the binding constraint is SRAM (for activations) and Flash (for weights). The inference must fit within:

- **Peak SRAM usage**: Maximum memory needed at any point during inference, determined by the operator execution schedule.
- **Flash usage**: Total model size (weights + metadata).

**Example.** ARM Cortex-M4F: 320 KB SRAM, 1 MB Flash.

A MobileNetV2 with width multiplier 0.35 and 96x96 input:

- Weights: 380 KB (INT8)
- Peak activation: 265 KB
- Total SRAM: 265 KB < 320 KB (fits)
- Total Flash: 380 KB < 1 MB (fits)

### 4.2 MCUNet: Neural Architecture Search for MCUs

MCUNet (Lin et al., 2020) jointly optimizes the neural architecture and the inference schedule to fit within MCU memory constraints.

**Two-stage approach:**

1. **TinyNAS**: Architecture search with a memory-aware constraint:

$$\max_\alpha \text{Accuracy}(\alpha) \quad \text{s.t.} \quad \text{SRAM}(\alpha, \pi) \leq M_{\text{SRAM}}, \quad \text{Flash}(\alpha) \leq M_{\text{Flash}}$$

where $\alpha$ parameterizes the architecture and $\pi$ is the inference schedule (operator execution order).

2. **TinyEngine**: Custom inference engine that optimizes memory layout:

**Patch-based inference.** Instead of computing each layer for the full spatial extent, process spatial patches:

```
Standard: Layer 1 (full) -> Layer 2 (full) -> Layer 3 (full)
Peak SRAM: max(Act_1, Act_2, Act_3)

Patch-based: Layer 1 (patch A) -> Layer 2 (patch A) -> Layer 3 (patch A)
             Layer 1 (patch B) -> Layer 2 (patch B) -> Layer 3 (patch B)
Peak SRAM: max(Patch_Act_1, Patch_Act_2, Patch_Act_3) << max(Act_1, Act_2, Act_3)
```

This trades spatial recomputation for memory savings. The optimal patch size minimizes peak memory while keeping recomputation overhead manageable.

**In-place depthwise convolution.** For depthwise separable convolutions, the output can overwrite the input buffer since each output channel depends only on the corresponding input channel:

```c
// In-place depthwise conv: output overwrites input
//
// NOTE: The reverse spatial traversal trick (iterating h, w from high to low)
// only produces correct results for 1x1 kernels, where each output depends on
// exactly one input element at the same location. For larger kernels (e.g., 3x3),
// writing an output at (h, w) corrupts input values still needed by neighboring
// outputs. In that case, a small line buffer (kH rows) is required to hold
// original input values before they are overwritten.
void depthwise_conv_inplace(
    int8_t* buffer,       // Input AND output (in-place)
    const int8_t* kernel, // (C, kH, kW)
    int8_t* line_buf,     // Temporary buffer of size (C * kH * W) for kH>1 or kW>1
    int H, int W, int C, int kH, int kW
) {
    if (kH == 1 && kW == 1) {
        // 1x1 kernel: true in-place is safe with reverse traversal
        for (int c = C - 1; c >= 0; c--) {
            for (int h = H - 1; h >= 0; h--) {
                for (int w = W - 1; w >= 0; w--) {
                    int32_t acc = buffer[c * H * W + h * W + w]
                                * kernel[c];
                    buffer[c * H * W + h * W + w] = quantize(acc);
                }
            }
        }
    } else {
        // Larger kernels: use a rolling line buffer to preserve input rows
        // before they are overwritten.
        for (int c = 0; c < C; c++) {
            // Seed line buffer with the first kH rows
            for (int r = 0; r < kH && r < H; r++)
                for (int w = 0; w < W; w++)
                    line_buf[r * W + w] = buffer[c * H * W + r * W + w];

            for (int h = 0; h < H; h++) {
                // Load the next input row into the line buffer (circular)
                int next_row = h + kH / 2 + 1;
                if (next_row < H)
                    for (int w = 0; w < W; w++)
                        line_buf[(next_row % kH) * W + w] =
                            buffer[c * H * W + next_row * W + w];

                for (int w = 0; w < W; w++) {
                    int32_t acc = 0;
                    for (int kh = 0; kh < kH; kh++) {
                        for (int kw = 0; kw < kW; kw++) {
                            int ih = h + kh - kH / 2;
                            int iw = w + kw - kW / 2;
                            if (ih >= 0 && ih < H && iw >= 0 && iw < W) {
                                acc += line_buf[(ih % kH) * W + iw]
                                     * kernel[c * kH * kW + kh * kW + kw];
                            }
                        }
                    }
                    buffer[c * H * W + h * W + w] = quantize(acc);
                }
            }
        }
    }
}
```

### 4.3 Memory Planning

The inference engine must schedule operator execution to minimize peak memory. This is a graph scheduling problem.

**Operator execution order.** Given a computation graph $G = (V, E)$, find an execution order $\sigma$ that minimizes peak memory:

$$\min_\sigma \max_{t} \sum_{v : \text{live}(v, t, \sigma)} \text{size}(v)$$

where $\text{live}(v, t, \sigma)$ indicates whether tensor $v$'s buffer is alive at step $t$ under schedule $\sigma$.

This is NP-hard in general but can be solved efficiently for tree-structured graphs or approximated with heuristics:

1. **Reverse postorder**: Process nodes in reverse topological order. Good for chains.
2. **Min-cut scheduling**: At each step, choose the operator that minimizes the peak of the live set.
3. **ILP formulation**: Model as integer linear program for small graphs.

**Memory reuse.** After a tensor is consumed by all its downstream operators, its buffer can be reused. A memory allocator tracks buffer lifetimes:

```python
class MemoryPlanner:
    """
    Plans memory allocation for inference, reusing buffers
    when tensors' lifetimes don't overlap.
    """
    def __init__(self):
        self.allocations = []

    def plan(self, operators: list, tensor_sizes: dict,
             tensor_lifetimes: dict) -> dict:
        """
        Assign memory offsets to tensors, reusing space where possible.

        Args:
            operators: execution order
            tensor_sizes: {tensor_id: size_in_bytes}
            tensor_lifetimes: {tensor_id: (first_use_step, last_use_step)}
        Returns:
            {tensor_id: memory_offset}
        """
        # Sort tensors by size (largest first) for greedy bin-packing
        sorted_tensors = sorted(tensor_sizes.items(), key=lambda x: -x[1])

        offsets = {}
        allocated_regions = []  # list of (offset, size, start_step, end_step)

        for tensor_id, size in sorted_tensors:
            start, end = tensor_lifetimes[tensor_id]

            # Find the first gap that fits
            best_offset = None
            for offset, alloc_size, alloc_start, alloc_end in allocated_regions:
                # Check if lifetimes overlap
                if start > alloc_end or end < alloc_start:
                    # No overlap: can reuse this memory
                    if alloc_size >= size:
                        best_offset = offset
                        break

            if best_offset is None:
                # Allocate new region
                if allocated_regions:
                    best_offset = max(o + s for o, s, _, _ in allocated_regions)
                else:
                    best_offset = 0

            offsets[tensor_id] = best_offset
            allocated_regions.append((best_offset, size, start, end))

        return offsets
```

---

## 5. Mobile Inference Frameworks

### 5.1 Framework Comparison

| Framework | Vendor | Target Hardware | Key Features |
|-----------|--------|----------------|-------------|
| TFLite | Google | ARM, x86, GPU, Edge TPU | Delegate system, quantization |
| CoreML | Apple | Apple Neural Engine, GPU, CPU | iOS/macOS native, Metal backend |
| ONNX Runtime Mobile | Microsoft | ARM, x86, GPU (various) | Cross-platform, NNAPI/CoreML delegates |
| MNN | Alibaba | ARM, GPU (OpenCL/Vulkan) | Optimized ARM kernels |
| XNNPACK | Google | ARM, x86 | Highly optimized CPU micro-kernels |

### 5.2 Model Conversion Pipeline

```
     PyTorch Model
          |
          v
    torch.export / torch.onnx.export
          |
          v
     ONNX Model
          |
     +----+----+----+
     |    |    |    |
     v    v    v    v
   TFLite CoreML ONNX-RT  TVM
                  Mobile
```

**ONNX export from PyTorch:**

```python
import torch
import onnx

def export_to_onnx(model, input_shape, output_path, opset_version=17):
    """
    Export a PyTorch model to ONNX format.

    Args:
        model: trained PyTorch model (eval mode)
        input_shape: tuple, e.g., (1, 3, 224, 224)
        output_path: path for the .onnx file
        opset_version: ONNX opset version
    """
    model.eval()
    dummy_input = torch.randn(*input_shape)

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=["input"],
        output_names=["output"],
        opset_version=opset_version,
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
    )

    # Verify
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"Exported to {output_path}")
    print(f"  Inputs: {[i.name for i in onnx_model.graph.input]}")
    print(f"  Outputs: {[o.name for o in onnx_model.graph.output]}")
```

**TFLite conversion with quantization:**

```python
import tensorflow as tf

def convert_to_tflite_int8(saved_model_dir, output_path,
                            representative_dataset):
    """
    Convert a SavedModel to a fully quantized TFLite model.

    Args:
        saved_model_dir: path to TF SavedModel
        output_path: path for .tflite output
        representative_dataset: generator yielding calibration samples
    """
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)

    # Full integer quantization
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS_INT8
    ]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8

    tflite_model = converter.convert()

    with open(output_path, "wb") as f:
        f.write(tflite_model)

    print(f"Converted to {output_path}")
    print(f"  Size: {len(tflite_model) / 1024:.1f} KB")
```

### 5.3 Hardware Delegates

Mobile inference frameworks use hardware-specific delegates to accelerate computation:

| Delegate | Hardware | Operations | Typical Speedup |
|----------|----------|-----------|-----------------|
| NNAPI | Android NPU/DSP/GPU | Conv, MatMul, Pool | 2-10x vs CPU |
| GPU (OpenGL/Vulkan) | Mobile GPU | Most operators | 2-5x vs CPU |
| CoreML (ANE) | Apple Neural Engine | Conv, MatMul, LSTM | 5-20x vs CPU |
| Edge TPU | Google Coral | INT8 Conv, MatMul | 10-50x vs CPU |
| Hexagon DSP | Qualcomm DSP | INT8/INT16 operators | 3-8x vs CPU |

**Delegate partitioning.** Not all operators are supported by every delegate. The framework partitions the graph:

```
Full Graph:     [Op1] -> [Op2] -> [Op3] -> [Op4] -> [Op5]
                  |        |        |        |        |
Supported by GPU: Yes      Yes      No       Yes      Yes

Partitioned:    [GPU: Op1->Op2] -> [CPU: Op3] -> [GPU: Op4->Op5]
```

Each transition between CPU and GPU incurs a data transfer cost. The partitioner minimizes total latency:

$$T_{\text{total}} = \sum_{\text{GPU segments}} T_{\text{GPU}} + \sum_{\text{CPU segments}} T_{\text{CPU}} + n_{\text{transitions}} \cdot T_{\text{transfer}}$$

---

## 6. Compiler Optimization for Edge

### 6.1 TVM for Edge Targets

TVM (Tensor Virtual Machine) compiles ML models to optimized code for diverse hardware targets. For edge deployment, TVM targets ARM Cortex-M, Cortex-A, and RISC-V ISAs.

**Compilation pipeline:**

```
ONNX / PyTorch Model
        |
        v
  Relay IR (high-level)
        |
    Graph optimizations:
      - Operator fusion
      - Constant folding
      - Layout transformation (NCHW -> NHWC)
        |
        v
  Tensor IR (TIR, low-level)
        |
    Schedule optimizations:
      - Loop tiling
      - Vectorization (NEON/SVE)
      - Unrolling
      - Memory planning
        |
        v
  C / Assembly code
        |
        v
  Cross-compile for target
```

### 6.2 Operator Fusion for Edge

Fusion is critical on edge devices because memory bandwidth is the bottleneck. By fusing operators, intermediate tensors are kept in registers or L1 cache.

**Fusible patterns:**

```
Element-wise chain:    Conv -> BN -> ReLU     -->  FusedConvBNReLU
Broadcast + reduce:    MatMul -> BiasAdd -> GELU  -->  FusedLinearGELU
Depthwise + pointwise: DWConv -> PWConv           -->  FusedDWPWConv
```

**Memory savings from fusion.** Consider Conv -> BN -> ReLU on a feature map of size $C \times H \times W$:

- **Unfused**: Write $C \times H \times W$ after Conv, read + write after BN, read + write after ReLU. Total memory traffic: $5 \times C \times H \times W \times \text{sizeof(dtype)}$.
- **Fused**: Write only the final output. Total: $C \times H \times W \times \text{sizeof(dtype)}$.

A 5x reduction in memory traffic directly translates to reduced latency on bandwidth-bound edge hardware.

### 6.3 ARM NEON Optimization

ARM NEON is the SIMD instruction set on ARM Cortex-A and some Cortex-M processors. It provides 128-bit vector registers that can process:

- 16 x INT8 values
- 8 x INT16 values
- 4 x INT32 or FP32 values

**NEON-optimized INT8 GEMM kernel (pseudocode):**

```c
// Compute C[4x16] += A[4xK] * B[Kx16] in INT8
// Uses NEON sdot (signed dot product) instruction
void gemm_int8_4x16_neon(
    const int8_t* A,  // (4, K) row-major
    const int8_t* B,  // (K, 16) row-major
    int32_t* C,       // (4, 16) row-major, accumulator
    int K
) {
    // Load C accumulators into NEON registers (4x4 tiles)
    // 16 int32x4_t registers for the 4x16 output tile
    int32x4_t c[4][4];  // c[row][col_group]
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 4; j++)
            c[i][j] = vld1q_s32(&C[i * 16 + j * 4]);

    for (int k = 0; k < K; k += 4) {
        // Load 4 elements from each of 4 A rows
        int8x8_t a0 = vld1_s8(&A[0 * K + k]);  // loads 8, we use first 4
        int8x8_t a1 = vld1_s8(&A[1 * K + k]);
        int8x8_t a2 = vld1_s8(&A[2 * K + k]);
        int8x8_t a3 = vld1_s8(&A[3 * K + k]);

        // Load 4x16 block from B (4 rows of 16 elements)
        for (int bj = 0; bj < 4; bj++) {
            int8x8_t b_col = vld1_s8(&B[k * 16 + bj * 4]);
            // sdot: signed dot product of 4 int8 values -> int32
            c[0][bj] = vdotq_s32(c[0][bj], a0, b_col);
            c[1][bj] = vdotq_s32(c[1][bj], a1, b_col);
            c[2][bj] = vdotq_s32(c[2][bj], a2, b_col);
            c[3][bj] = vdotq_s32(c[3][bj], a3, b_col);
        }
    }

    // Store back
    for (int i = 0; i < 4; i++)
        for (int j = 0; j < 4; j++)
            vst1q_s32(&C[i * 16 + j * 4], c[i][j]);
}
```

The `sdot` instruction computes a 4-element INT8 dot product in a single cycle, providing 16 INT8 multiply-accumulate operations per cycle per NEON unit -- 16x throughput over scalar INT8.

### 6.4 RISC-V Vector Extension

RISC-V V extension provides scalable vector processing. Unlike NEON's fixed 128-bit vectors, RISC-V V has a configurable vector length (VLEN):

```
# RISC-V V extension INT8 GEMV
# Compute y[M] += A[M, K] * x[K] in INT8

vsetvli  t0, K, e8, m4     # Set vector length for INT8, LMUL=4
# Loop over rows of A
loop_m:
    vle8.v   v0, (A_row)    # Load row of A
    vmul.vv  v4, v0, v_x    # Element-wise multiply
    vredsum.vs v8, v4, v8   # Reduce (sum) into scalar
    vmv.x.s  t1, v8         # Move scalar result to GPR
    sw       t1, (y_ptr)    # Store to output
    # advance pointers...
```

The advantage of RISC-V V is that the same code runs on hardware with different VLEN (128, 256, 512, 1024 bits) without recompilation.

---

## 7. Federated Learning

### 7.1 System Architecture

Federated learning trains a shared model across many edge devices without centralizing data.

**FedAvg algorithm (McMahan et al., 2017):**

```
Algorithm: FEDERATED_AVERAGING
Input: K clients, each with local dataset D_k
       Global model parameters theta_0
       Rounds T, local epochs E, learning rate eta

For round t = 0, 1, ..., T-1:
  1. Server sends theta_t to a subset S_t of K clients (|S_t| = C*K)

  2. Each client k in S_t:
     a. theta_k <- theta_t                    # Initialize from global
     b. For epoch e = 1, ..., E:
          For batch (x, y) in D_k:
            theta_k <- theta_k - eta * grad(L(theta_k; x, y))
     c. Send delta_k = theta_k - theta_t to server

  3. Server aggregates:
     theta_{t+1} = theta_t + (1/|S_t|) * sum_{k in S_t} (n_k / n) * delta_k
     where n_k = |D_k| and n = sum n_k
```

### 7.2 Communication Efficiency

**The communication bottleneck.** Each round requires sending and receiving the full model:

$$\text{Comm/round} = 2 \times P \times \text{sizeof(dtype)}$$

For a 100M parameter model in FP32: 800 MB per client per round over a potentially slow wireless link.

**Compression techniques:**

1. **Gradient quantization**: Send updates in INT8 or lower precision.
   - Compression ratio: 4x (FP32 to INT8).
   - Error: Use error feedback (accumulate quantization error and add to next round's update).

2. **Gradient sparsification**: Send only the top-$k$ largest updates.
   - Compression ratio: $P/k$ (e.g., 100x with $k = P/100$).
   - Error: Error feedback is critical; without it, convergence degrades.

3. **Federated distillation**: Instead of sending model updates, clients send predictions on a shared public dataset. The server aggregates predictions, not gradients.

```python
def compress_update(delta: torch.Tensor, compression: str = "topk",
                     ratio: float = 0.01) -> tuple:
    """
    Compress a model update for communication-efficient federated learning.

    Args:
        delta: (P,) flattened parameter update
        compression: "topk", "quantize", or "random"
        ratio: compression ratio (fraction of values to keep for topk)
    Returns:
        compressed: compressed representation
        metadata: info needed for decompression
    """
    if compression == "topk":
        k = max(1, int(delta.numel() * ratio))
        values, indices = delta.abs().topk(k)
        return (delta[indices], indices), {"shape": delta.shape, "k": k}

    elif compression == "quantize":
        # Stochastic INT8 quantization
        scale = delta.abs().max() / 127.0
        if scale == 0:
            return (torch.zeros_like(delta, dtype=torch.int8), scale), {}
        quantized = torch.clamp(
            torch.round(delta / scale), -127, 127
        ).to(torch.int8)
        return (quantized, scale), {}

    else:
        raise ValueError(f"Unknown compression: {compression}")
```

### 7.3 Privacy and Security

**Differential privacy in federated learning.** Add calibrated noise to updates before sending to the server:

$$\tilde{\delta}_k = \text{clip}(\delta_k, C) + \mathcal{N}(0, \sigma^2 C^2 I)$$

where $C$ is the clipping norm and $\sigma$ controls the privacy-utility tradeoff. This provides $(\epsilon, \delta)$-differential privacy with:

$$\epsilon = \frac{q\sqrt{2T\log(1/\delta')}}{\sigma}$$

where $q$ is the sampling rate and $T$ is the number of rounds.

**Secure aggregation.** Cryptographic protocols that allow the server to compute the aggregate $\sum_k \delta_k$ without seeing any individual $\delta_k$. Techniques include:

- **Secret sharing**: Each client splits $\delta_k$ into shares distributed among other clients.
- **Homomorphic encryption**: Updates are encrypted; the server computes on ciphertexts.

Both add communication and computation overhead but provide strong privacy guarantees.

### 7.4 Statistical Heterogeneity

In practice, data distributions differ across clients (non-IID). This is the primary challenge for federated learning convergence.

**FedAvg convergence with non-IID data.** The convergence rate degrades with data heterogeneity. For strongly convex objectives:

$$\mathbb{E}[\|\theta_T - \theta^*\|^2] \leq O\left(\frac{\sigma^2}{T} + \frac{E^2 G^2}{T}\right)$$

where $\sigma^2$ is the stochastic gradient variance and $G^2$ measures data heterogeneity:

$$G^2 = \frac{1}{K}\sum_{k=1}^{K} \|\nabla F_k(\theta^*) - \nabla F(\theta^*)\|^2$$

With IID data, $G^2 = 0$ and FedAvg converges at the same rate as centralized SGD. With high heterogeneity, the $E^2 G^2$ term dominates, requiring more rounds or smaller $E$.

**Mitigations:**

- **FedProx**: Add proximal term $\frac{\mu}{2}\|\theta_k - \theta_t\|^2$ to local objective.
- **SCAFFOLD**: Use control variates to correct for client drift.
- **Per-client learning rates**: Adaptive aggregation weights based on client data size and diversity.

---

## 8. On-Device LLM Inference

### 8.1 Small Language Models

Recent work has focused on language models small enough to run on mobile devices:

| Model | Parameters | Size (INT4) | Target Device | Throughput |
|-------|-----------|-------------|---------------|-----------|
| Phi-3-mini | 3.8B | 2.1 GB | Mobile SoC | 10-20 tok/s |
| Gemma 2B | 2B | 1.1 GB | Mobile SoC | 20-40 tok/s |
| TinyLlama 1.1B | 1.1B | 600 MB | Mobile SoC | 40-60 tok/s |
| SmolLM-135M | 135M | 75 MB | MCU/Edge SoC | 100+ tok/s |

### 8.2 On-Device Inference Optimizations

**Weight-only quantization.** For autoregressive LLM inference (batch size 1), the computation is memory-bandwidth bound. Quantizing weights to INT4 while computing in FP16:

$$\text{Speedup} \approx \frac{\text{sizeof(FP16)}}{\text{sizeof(INT4)}} = 4\times$$

because the bottleneck is loading weights, not computation.

**KV cache quantization.** On devices with limited memory, the KV cache can be quantized to INT8 or INT4 to extend the context length:

$$S_{\max} = \frac{M_{\text{available}} - M_{\text{weights}}}{2Ld \cdot \text{sizeof(KV\_dtype)}}$$

For a 2B model (4 GB in INT4) on a phone with 6 GB RAM and 2 GB available for inference:

- FP16 KV cache: $S_{\max} = \frac{2\text{GB}}{2 \times 24 \times 2048 \times 2} \approx 10,400$ tokens
- INT8 KV cache: $S_{\max} \approx 20,800$ tokens
- INT4 KV cache: $S_{\max} \approx 41,600$ tokens

---

## Key Takeaways

1. Edge deployment spans a vast hardware range from 256 KB MCUs to multi-GB mobile SoCs. The binding constraint shifts from memory (MCUs) to latency and power (mobile/automotive).
2. Effective edge deployment requires co-optimization of the model architecture, quantization scheme, and inference engine. Techniques like MCUNet's joint NAS + memory planning achieve models that would be impossible with post-hoc compression alone.
3. Mobile inference frameworks (TFLite, CoreML, ONNX Runtime) provide hardware abstraction through delegate systems, but optimal performance requires understanding which operators map to which accelerators.
4. Compiler optimizations for edge (operator fusion, NEON/SVE vectorization, memory planning) provide 2-5x speedups beyond framework defaults. TVM enables auto-tuning for diverse edge targets.
5. Federated learning enables training across edge devices without data centralization, but faces challenges in communication efficiency, statistical heterogeneity, and privacy. Gradient compression and secure aggregation are active areas of research.

---

## Further Reading

1. **Lin, J., Chen, W.M., Lin, Y., Cohn, J., Gan, C., and Han, S.** (2020). "MCUNet: Tiny Deep Learning on IoT Devices." *NeurIPS 2020.*
2. **Lin, J., et al.** (2021). "MCUNetV2: Memory-Efficient Patch-based Inference for Tiny Deep Learning." *NeurIPS 2021.*
3. **David, R., et al.** (2021). "TensorFlow Lite Micro: Embedded Machine Learning for TinyML Systems." *MLSys 2021.*
4. **Chen, T., et al.** (2018). "TVM: An Automated End-to-End Optimizing Compiler for Deep Learning." *OSDI 2018.*
5. **McMahan, B., et al.** (2017). "Communication-Efficient Learning of Deep Networks from Decentralized Data." *AISTATS 2017.*
6. **Kairouz, P., et al.** (2021). "Advances and Open Problems in Federated Learning." *Foundations and Trends in Machine Learning 14(1-2):1-210.*
7. **Howard, A., et al.** (2019). "Searching for MobileNetV3." *ICCV 2019.*
