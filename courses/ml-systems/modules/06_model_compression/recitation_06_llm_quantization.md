# Recitation 06: Quantizing an LLM to 4-bit

## Overview

This recitation is a hands-on walkthrough of quantizing a large language model to 4-bit precision. We will take a pretrained LLM (GPT-2 or a small LLaMA variant), apply multiple quantization methods, measure perplexity and generation quality, and benchmark inference speed and memory usage. The goal is to develop practical intuition for the tradeoffs discussed in Lecture 06b.

**Outline:**

1. Baseline: FP16 model profiling
2. Naive round-to-nearest (RTN) quantization from scratch
3. Per-group INT4 quantization with calibration
4. Using AutoGPTQ for GPTQ quantization
5. Using AutoAWQ for AWQ quantization
6. Benchmarking: perplexity, latency, memory, generation quality
7. Exploring INT3 and INT2: when does quantization break?

**Prerequisites:** PyTorch, transformers, auto-gptq, autoawq, datasets libraries installed.

---

## 1. Setup and Baseline

### 1.1 Loading the Model

We use GPT-2-medium (355M parameters) as our primary model. It is small enough to run on a single consumer GPU while large enough to demonstrate meaningful quantization effects.

```python
import torch
import torch.nn as nn
from transformers import AutoModelForCausalLM, AutoTokenizer
from datasets import load_dataset
import time
import numpy as np

# ── Configuration ────────────────────────────────────────────────────
MODEL_NAME = "gpt2-medium"  # 355M params, 24 layers, d_model=1024
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DTYPE = torch.float16 if DEVICE.type == "cuda" else torch.float32

# ── Load model and tokenizer ────────────────────────────────────────
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.pad_token = tokenizer.eos_token

model_fp16 = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME,
    torch_dtype=DTYPE,
    device_map="auto",
)
model_fp16.eval()

print(f"Model: {MODEL_NAME}")
print(f"Parameters: {sum(p.numel() for p in model_fp16.parameters()) / 1e6:.1f}M")
print(f"FP16 model size: {sum(p.numel() * p.element_size() for p in model_fp16.parameters()) / 1e6:.1f} MB")
# Expected output:
# Model: gpt2-medium
# Parameters: 354.8M
# FP16 model size: 709.6 MB
```

### 1.2 Perplexity Evaluation Function

```python
@torch.no_grad()
def evaluate_perplexity(
    model: nn.Module,
    tokenizer: AutoTokenizer,
    dataset_name: str = "wikitext",
    dataset_config: str = "wikitext-2-raw-v1",
    split: str = "test",
    max_length: int = 1024,
    stride: int = 512,
) -> float:
    """
    Compute perplexity on a text dataset using sliding window evaluation.

    Args:
        model: causal language model
        tokenizer: corresponding tokenizer
        dataset_name: HuggingFace dataset name
        dataset_config: dataset configuration
        split: dataset split to evaluate on
        max_length: maximum sequence length per window
        stride: stride for sliding window (overlap = max_length - stride)

    Returns:
        Perplexity (float)
    """
    # Load and tokenize dataset
    dataset = load_dataset(dataset_name, dataset_config, split=split)
    text = "\n\n".join(dataset["text"])
    encodings = tokenizer(text, return_tensors="pt")
    input_ids = encodings.input_ids.to(model.device)
    # input_ids shape: (1, total_tokens)

    total_tokens = input_ids.size(1)
    nlls = []  # negative log-likelihoods
    prev_end = 0

    for begin in range(0, total_tokens, stride):
        end = min(begin + max_length, total_tokens)
        target_len = end - prev_end  # tokens to evaluate in this window

        input_window = input_ids[:, begin:end]  # (1, window_length)

        outputs = model(input_window)
        logits = outputs.logits  # (1, window_length, vocab_size)

        # Shift: predict token t from logits at position t-1
        shift_logits = logits[:, :-1, :]  # (1, window_length - 1, V)
        shift_labels = input_window[:, 1:]  # (1, window_length - 1)

        # Only compute loss on non-overlapping portion
        loss_fct = nn.CrossEntropyLoss(reduction="none")
        # Reshape for loss computation
        loss = loss_fct(
            shift_logits.reshape(-1, shift_logits.size(-1)),
            shift_labels.reshape(-1),
        )  # (window_length - 1,)

        # Only count the non-overlapping tokens
        nlls.append(loss[-target_len:].sum())

        prev_end = end
        if end == total_tokens:
            break

    total_nll = torch.stack(nlls).sum()
    avg_nll = total_nll / (total_tokens - 1)
    perplexity = torch.exp(avg_nll).item()
    return perplexity


# ── Evaluate baseline ───────────────────────────────────────────────
ppl_fp16 = evaluate_perplexity(model_fp16, tokenizer)
print(f"FP16 Perplexity: {ppl_fp16:.2f}")
# Expected: ~22-24 for GPT-2-medium on WikiText-2
```

### 1.3 Latency and Memory Benchmarking

```python
def benchmark_generation(
    model: nn.Module,
    tokenizer: AutoTokenizer,
    prompt: str = "The future of artificial intelligence is",
    max_new_tokens: int = 128,
    num_runs: int = 5,
) -> dict:
    """
    Benchmark generation latency and memory usage.

    Args:
        model: causal language model
        tokenizer: tokenizer
        prompt: input prompt text
        max_new_tokens: number of tokens to generate
        num_runs: number of runs to average over

    Returns:
        Dictionary with timing and memory statistics
    """
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    # inputs["input_ids"] shape: (1, prompt_length)

    # Warmup
    with torch.no_grad():
        _ = model.generate(**inputs, max_new_tokens=16, do_sample=False)

    if DEVICE.type == "cuda":
        torch.cuda.synchronize()
        torch.cuda.reset_peak_memory_stats()

    latencies = []
    for _ in range(num_runs):
        if DEVICE.type == "cuda":
            torch.cuda.synchronize()
        start = time.perf_counter()
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
            )
        if DEVICE.type == "cuda":
            torch.cuda.synchronize()
        elapsed = time.perf_counter() - start
        latencies.append(elapsed)

    generated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    tokens_generated = outputs.shape[1] - inputs["input_ids"].shape[1]

    stats = {
        "latency_ms": np.mean(latencies) * 1000,
        "latency_std_ms": np.std(latencies) * 1000,
        "tokens_per_sec": tokens_generated / np.mean(latencies),
        "generated_text": generated_text,
    }
    if DEVICE.type == "cuda":
        stats["peak_memory_mb"] = torch.cuda.max_memory_allocated() / 1e6

    return stats


# ── Baseline benchmark ──────────────────────────────────────────────
baseline_stats = benchmark_generation(model_fp16, tokenizer)
print(f"FP16 Latency: {baseline_stats['latency_ms']:.1f} ms")
print(f"FP16 Tokens/sec: {baseline_stats['tokens_per_sec']:.1f}")
print(f"FP16 Peak Memory: {baseline_stats.get('peak_memory_mb', 'N/A'):.1f} MB")
print(f"Generated: {baseline_stats['generated_text'][:200]}...")
```

---

## 2. Naive Round-to-Nearest (RTN) Quantization

Let us implement INT4 quantization from scratch to understand what happens under the hood.

### 2.1 Per-Group Symmetric INT4 Quantization

```python
def quantize_tensor_int4(
    tensor: torch.Tensor,
    group_size: int = 128,
) -> tuple[torch.Tensor, torch.Tensor, int]:
    """
    Quantize a 2D tensor to symmetric INT4 with per-group scales.

    INT4 range: [-8, 7] (signed 4-bit)

    Args:
        tensor: weight matrix, shape (out_features, in_features)
        group_size: number of elements per quantization group

    Returns:
        q_tensor: quantized values as int8 (storing 4-bit values),
                  shape (out_features, in_features)
        scales: per-group scale factors,
                shape (out_features, in_features // group_size)
        group_size: the group size used
    """
    assert tensor.dim() == 2, "Expected 2D tensor"
    out_features, in_features = tensor.shape
    assert in_features % group_size == 0, \
        f"in_features ({in_features}) must be divisible by group_size ({group_size})"

    qmin, qmax = -8, 7  # 4-bit signed range
    num_groups = in_features // group_size

    # Reshape to (out_features, num_groups, group_size)
    t = tensor.view(out_features, num_groups, group_size)

    # Per-group max absolute value
    amax = t.abs().amax(dim=-1, keepdim=True)  # (out, num_groups, 1)
    amax = amax.clamp(min=1e-8)

    # Scale: maps [-amax, amax] to [-8, 7]
    scales = amax / qmax  # (out, num_groups, 1)

    # Quantize
    q = (t / scales).round().clamp(qmin, qmax).to(torch.int8)
    # q shape: (out_features, num_groups, group_size)

    q_tensor = q.view(out_features, in_features)
    scales = scales.squeeze(-1)  # (out_features, num_groups)

    return q_tensor, scales, group_size


def dequantize_tensor_int4(
    q_tensor: torch.Tensor,
    scales: torch.Tensor,
    group_size: int,
) -> torch.Tensor:
    """
    Dequantize INT4 tensor back to float.

    Args:
        q_tensor: quantized values, shape (out_features, in_features)
        scales: per-group scales, shape (out_features, num_groups)
        group_size: elements per group

    Returns:
        Dequantized float tensor, shape (out_features, in_features)
    """
    out_features, in_features = q_tensor.shape
    num_groups = in_features // group_size

    q = q_tensor.view(out_features, num_groups, group_size).float()
    s = scales.unsqueeze(-1)  # (out, num_groups, 1)

    return (q * s).view(out_features, in_features)
```

### 2.2 Applying RTN to the Full Model

```python
import copy

def quantize_model_rtn(
    model: nn.Module,
    bits: int = 4,
    group_size: int = 128,
    skip_layers: list[str] | None = None,
) -> nn.Module:
    """
    Apply round-to-nearest INT4 quantization to all Linear layers.
    Stores quantized weights and scales, replaces forward to dequantize.

    Args:
        model: pretrained model
        bits: quantization bit-width
        group_size: per-group quantization group size
        skip_layers: layer name patterns to skip (e.g., ['lm_head'])

    Returns:
        Quantized model (dequantized weights, same architecture)
    """
    if skip_layers is None:
        skip_layers = ["lm_head"]  # Don't quantize the output head

    q_model = copy.deepcopy(model)
    total_params = 0
    quantized_params = 0

    for name, module in q_model.named_modules():
        if not isinstance(module, nn.Linear):
            continue

        skip = any(pattern in name for pattern in skip_layers)
        total_params += module.weight.numel()

        if skip:
            print(f"  Skipping {name}: {module.weight.shape}")
            continue

        # Quantize
        w = module.weight.data  # (out, in)
        q_w, scales, gs = quantize_tensor_int4(w, group_size)

        # Dequantize and replace weight
        w_hat = dequantize_tensor_int4(q_w, scales, gs)
        module.weight.data = w_hat.to(w.dtype)

        quantized_params += w.numel()

        # Compute per-layer quantization error
        mse = (w.float() - w_hat.float()).pow(2).mean().item()
        snr = 10 * np.log10(w.float().pow(2).mean().item() / (mse + 1e-10))
        print(f"  Quantized {name}: {w.shape}, MSE={mse:.6f}, SNR={snr:.1f} dB")

    print(f"\nTotal: {quantized_params/1e6:.1f}M / {total_params/1e6:.1f}M "
          f"params quantized ({100*quantized_params/total_params:.1f}%)")

    return q_model


# ── Apply RTN quantization ──────────────────────────────────────────
print("Quantizing model with RTN (INT4, group_size=128)...")
model_rtn = quantize_model_rtn(model_fp16, bits=4, group_size=128)

# ── Evaluate RTN model ──────────────────────────────────────────────
ppl_rtn = evaluate_perplexity(model_rtn, tokenizer)
print(f"\nRTN INT4 Perplexity: {ppl_rtn:.2f} (FP16 baseline: {ppl_fp16:.2f})")
print(f"Perplexity increase: {ppl_rtn - ppl_fp16:.2f}")
```

---

## 3. Understanding Quantization Error: Layer-by-Layer Analysis

### 3.1 Weight Distribution Visualization

```python
import matplotlib.pyplot as plt

def plot_weight_distributions(model: nn.Module, layer_names: list[str]):
    """
    Plot weight distributions for specified layers.
    Helps understand why some layers are harder to quantize.

    Args:
        model: the model to analyze
        layer_names: list of layer names to plot
    """
    fig, axes = plt.subplots(1, len(layer_names), figsize=(5 * len(layer_names), 4))
    if len(layer_names) == 1:
        axes = [axes]

    for ax, name in zip(axes, layer_names):
        for n, p in model.named_parameters():
            if name in n and 'weight' in n:
                w = p.data.cpu().float().flatten().numpy()
                ax.hist(w, bins=200, density=True, alpha=0.7)
                ax.set_title(f"{name}\nstd={np.std(w):.4f}, "
                             f"max={np.max(np.abs(w)):.4f}\n"
                             f"kurtosis={float(torch.tensor(w).float().pow(4).mean() / torch.tensor(w).float().pow(2).mean()**2):.1f}")
                ax.set_xlabel("Weight value")
                ax.set_ylabel("Density")
                break

    plt.tight_layout()
    plt.savefig("weight_distributions.png", dpi=150)
    plt.show()


# Plot first, middle, and last transformer blocks
plot_weight_distributions(model_fp16, [
    "transformer.h.0.mlp.c_fc",
    "transformer.h.12.mlp.c_fc",
    "transformer.h.23.mlp.c_fc",
])
```

### 3.2 Quantization Error vs. Group Size

```python
def analyze_group_size_effect(
    model: nn.Module,
    layer_name: str,
    group_sizes: list[int] = [32, 64, 128, 256, 512],
) -> dict:
    """
    Measure quantization error as a function of group size for a single layer.

    Args:
        model: the model
        layer_name: name of the layer to analyze
        group_sizes: list of group sizes to try

    Returns:
        Dictionary mapping group_size -> MSE
    """
    results = {}
    for name, module in model.named_modules():
        if layer_name in name and isinstance(module, nn.Linear):
            w = module.weight.data  # (out, in)
            for gs in group_sizes:
                if w.shape[1] % gs != 0:
                    continue
                q_w, scales, _ = quantize_tensor_int4(w, gs)
                w_hat = dequantize_tensor_int4(q_w, scales, gs)
                mse = (w.float() - w_hat.float()).pow(2).mean().item()
                results[gs] = mse
            break

    return results


# ── Analyze group size effect ────────────────────────────────────────
gs_results = analyze_group_size_effect(
    model_fp16,
    "transformer.h.0.mlp.c_fc",
    group_sizes=[32, 64, 128, 256, 512, 1024],
)
print("Group size -> MSE:")
for gs, mse in sorted(gs_results.items()):
    print(f"  {gs:>6d}: {mse:.8f}")

# Plot
plt.figure(figsize=(8, 5))
gs_list = sorted(gs_results.keys())
mse_list = [gs_results[gs] for gs in gs_list]
plt.plot(gs_list, mse_list, 'bo-')
plt.xlabel("Group Size")
plt.ylabel("MSE")
plt.title("Quantization Error vs. Group Size (INT4)")
plt.xscale("log", base=2)
plt.yscale("log")
plt.grid(True, alpha=0.3)
plt.savefig("group_size_effect.png", dpi=150)
plt.show()
```

---

## 4. GPTQ Quantization with AutoGPTQ

### 4.1 Applying GPTQ

```python
from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig

def quantize_with_gptq(
    model_name: str,
    bits: int = 4,
    group_size: int = 128,
    num_calibration_samples: int = 128,
) -> AutoGPTQForCausalLM:
    """
    Quantize a model using GPTQ via AutoGPTQ.

    Args:
        model_name: HuggingFace model name
        bits: quantization bit-width
        group_size: per-group quantization size
        num_calibration_samples: number of calibration examples

    Returns:
        Quantized model
    """
    # Quantization configuration
    quantize_config = BaseQuantizeConfig(
        bits=bits,
        group_size=group_size,
        desc_act=False,  # Don't reorder columns by activation magnitude
    )

    # Load model for quantization
    model = AutoGPTQForCausalLM.from_pretrained(
        model_name,
        quantize_config=quantize_config,
        torch_dtype=torch.float16,
    )

    # Prepare calibration data
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token

    dataset = load_dataset("wikitext", "wikitext-2-raw-v1", split="train")
    calibration_texts = [
        t for t in dataset["text"] if len(t.strip()) > 100
    ][:num_calibration_samples]

    calibration_data = [
        tokenizer(text, return_tensors="pt", max_length=1024, truncation=True)
        for text in calibration_texts
    ]

    # Run GPTQ quantization
    print(f"Running GPTQ quantization (bits={bits}, group_size={group_size})...")
    start = time.perf_counter()
    model.quantize(calibration_data)
    elapsed = time.perf_counter() - start
    print(f"GPTQ quantization took {elapsed:.1f} seconds")

    return model


# ── GPTQ Quantization ───────────────────────────────────────────────
model_gptq = quantize_with_gptq(MODEL_NAME, bits=4, group_size=128)

# Evaluate
ppl_gptq = evaluate_perplexity(model_gptq.model, tokenizer)
print(f"GPTQ INT4 Perplexity: {ppl_gptq:.2f}")
```

---

## 5. AWQ Quantization with AutoAWQ

### 5.1 Applying AWQ

```python
from awq import AutoAWQForCausalLM

def quantize_with_awq(
    model_name: str,
    bits: int = 4,
    group_size: int = 128,
    num_calibration_samples: int = 128,
) -> AutoAWQForCausalLM:
    """
    Quantize a model using AWQ via AutoAWQ.

    Args:
        model_name: HuggingFace model name
        bits: quantization bit-width
        group_size: per-group quantization size
        num_calibration_samples: number of calibration examples

    Returns:
        Quantized model
    """
    model = AutoAWQForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16,
        device_map="auto",
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token

    quant_config = {
        "zero_point": True,
        "q_group_size": group_size,
        "w_bit": bits,
        "version": "GEMM",  # Use GEMM kernel for inference
    }

    print(f"Running AWQ quantization (bits={bits}, group_size={group_size})...")
    start = time.perf_counter()
    model.quantize(
        tokenizer,
        quant_config=quant_config,
        calib_data="wikitext",
        split="train",
        n_samples=num_calibration_samples,
    )
    elapsed = time.perf_counter() - start
    print(f"AWQ quantization took {elapsed:.1f} seconds")

    return model


# ── AWQ Quantization ────────────────────────────────────────────────
model_awq = quantize_with_awq(MODEL_NAME, bits=4, group_size=128)

# Evaluate
ppl_awq = evaluate_perplexity(model_awq.model, tokenizer)
print(f"AWQ INT4 Perplexity: {ppl_awq:.2f}")
```

---

## 6. Comprehensive Benchmarking

### 6.1 Results Comparison

```python
def comprehensive_benchmark(
    models: dict[str, nn.Module],
    tokenizer: AutoTokenizer,
    prompts: list[str] | None = None,
) -> None:
    """
    Run comprehensive benchmarks on all models and print comparison table.

    Args:
        models: dictionary of model_name -> model
        tokenizer: shared tokenizer
        prompts: list of prompts for generation quality comparison
    """
    if prompts is None:
        prompts = [
            "The theory of general relativity predicts that",
            "In a randomized controlled trial, researchers found",
            "The primary advantage of transformer architectures is",
        ]

    results = {}
    for name, model in models.items():
        print(f"\n{'='*60}")
        print(f"Evaluating: {name}")
        print(f"{'='*60}")

        # Perplexity
        ppl = evaluate_perplexity(model, tokenizer)

        # Generation benchmark
        gen_stats = benchmark_generation(model, tokenizer)

        results[name] = {
            "perplexity": ppl,
            "latency_ms": gen_stats["latency_ms"],
            "tokens_per_sec": gen_stats["tokens_per_sec"],
            "peak_memory_mb": gen_stats.get("peak_memory_mb", "N/A"),
        }

        # Generation quality examples
        print(f"\nSample generations:")
        for prompt in prompts[:2]:
            inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
            with torch.no_grad():
                out = model.generate(
                    **inputs, max_new_tokens=64, do_sample=False
                )
            text = tokenizer.decode(out[0], skip_special_tokens=True)
            print(f"  Prompt: {prompt}")
            print(f"  Output: {text[:200]}")
            print()

    # ── Summary table ────────────────────────────────────────────────
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"{'Method':<15} {'PPL':>8} {'Latency (ms)':>14} "
          f"{'Tok/s':>8} {'Memory (MB)':>12}")
    print("-"*60)
    for name, r in results.items():
        mem = f"{r['peak_memory_mb']:.0f}" if isinstance(
            r['peak_memory_mb'], float) else r['peak_memory_mb']
        print(f"{name:<15} {r['perplexity']:>8.2f} "
              f"{r['latency_ms']:>14.1f} "
              f"{r['tokens_per_sec']:>8.1f} {mem:>12}")


# ── Run full benchmark ──────────────────────────────────────────────
# Note: Adapt the model references to match your setup.
# The GPTQ/AWQ models may have different attribute names.

models_to_benchmark = {
    "FP16": model_fp16,
    "RTN-INT4": model_rtn,
    # "GPTQ-INT4": model_gptq.model,  # Uncomment if available
    # "AWQ-INT4": model_awq.model,    # Uncomment if available
}

comprehensive_benchmark(models_to_benchmark, tokenizer)
```

### 6.2 Expected Results (GPT-2 Medium)

The following table shows typical results. Your numbers will vary based on hardware.

| Method | Perplexity | Delta PPL | Latency (ms) | Memory (MB) | Speedup |
|--------|-----------|-----------|--------------|-------------|---------|
| FP16   | ~22.5     | --        | ~800         | ~900        | 1.0x    |
| RTN-INT4 (g128) | ~24.0 | +1.5  | ~700         | ~500        | 1.1x    |
| GPTQ-INT4 (g128) | ~22.8 | +0.3 | ~500         | ~450        | 1.6x    |
| AWQ-INT4 (g128) | ~22.7 | +0.2  | ~480         | ~450        | 1.7x    |

Key observations:
- RTN causes a noticeable perplexity increase (+1.5 points).
- GPTQ and AWQ nearly close the gap to FP16 (+0.2--0.3 points).
- Memory is roughly halved (FP16 to INT4 for weights).
- Speed improvement depends heavily on the inference kernel used.

---

## 7. Stress Test: Lower Bit-Widths

### 7.1 INT3 and INT2 Quantization

```python
def quantize_tensor_arbitrary_bits(
    tensor: torch.Tensor,
    bits: int,
    group_size: int = 128,
) -> tuple[torch.Tensor, torch.Tensor]:
    """
    Quantize to arbitrary bit-width (2, 3, 4, 8).

    Args:
        tensor: 2D weight matrix
        bits: target bit-width
        group_size: elements per group

    Returns:
        Dequantized tensor (float), scales
    """
    out_features, in_features = tensor.shape
    assert in_features % group_size == 0

    qmin = -(2 ** (bits - 1))
    qmax = 2 ** (bits - 1) - 1
    num_groups = in_features // group_size

    t = tensor.view(out_features, num_groups, group_size)
    amax = t.abs().amax(dim=-1, keepdim=True).clamp(min=1e-8)
    scales = amax / qmax

    q = (t / scales).round().clamp(qmin, qmax)
    dequantized = (q * scales).view(out_features, in_features)

    return dequantized, scales.squeeze(-1)


def quantize_model_nbits(model: nn.Module, bits: int, group_size: int = 128):
    """Quantize all Linear layers to n-bit precision (RTN)."""
    q_model = copy.deepcopy(model)
    for name, module in q_model.named_modules():
        if isinstance(module, nn.Linear) and "lm_head" not in name:
            w = module.weight.data
            if w.shape[1] % group_size != 0:
                continue
            w_hat, _ = quantize_tensor_arbitrary_bits(w, bits, group_size)
            module.weight.data = w_hat.to(w.dtype)
    return q_model


# ── Bit-width sweep ─────────────────────────────────────────────────
print("Bit-width sweep (RTN, group_size=128):")
print(f"{'Bits':>6} {'Perplexity':>12} {'Delta':>8}")
print("-" * 30)

for bits in [8, 4, 3, 2]:
    model_q = quantize_model_nbits(model_fp16, bits=bits, group_size=128)
    ppl = evaluate_perplexity(model_q, tokenizer)
    delta = ppl - ppl_fp16
    status = "OK" if delta < 1.0 else ("DEGRADED" if delta < 5.0 else "BROKEN")
    print(f"{bits:>6} {ppl:>12.2f} {delta:>+8.2f}  [{status}]")
    del model_q
    torch.cuda.empty_cache() if DEVICE.type == "cuda" else None

# Expected output (approximate):
# Bits  Perplexity    Delta
# ----------------------------------------
#    8        22.52    +0.02  [OK]
#    4        24.00    +1.50  [DEGRADED]
#    3        30.50    +8.00  [BROKEN]
#    2       150.00  +127.50  [BROKEN]
```

### 7.2 Discussion Questions

After running the experiments, consider:

1. **Why does INT3 degrade so much more than INT4?** The number of representable values drops from 16 (INT4) to 8 (INT3), but the perplexity increase is more than 2x. Relate this to the MSE analysis in Lecture 06b.

2. **Why does GPTQ help more at INT4 than at INT8?** At INT8, RTN already has small quantization error; the Hessian-based weight update provides little improvement. At INT4, the error is large enough that compensation matters.

3. **Which layers show the largest quantization error?** Run the layer-by-layer analysis and correlate with perplexity degradation. Are the first/last layers more sensitive, as the theory predicts?

4. **How does group size interact with bit-width?** Try INT3 with group_size=32 vs. group_size=128. Does smaller group size help more at lower bit-widths?

---

## 8. Saving and Loading Quantized Models

```python
# ── Saving a GPTQ model ─────────────────────────────────────────────
# model_gptq.save_quantized("gpt2-medium-gptq-int4")
# tokenizer.save_pretrained("gpt2-medium-gptq-int4")

# ── Loading a pre-quantized model ───────────────────────────────────
# model_loaded = AutoGPTQForCausalLM.from_quantized(
#     "gpt2-medium-gptq-int4",
#     device_map="auto",
# )

# ── Using bitsandbytes for on-the-fly quantization ──────────────────
# from transformers import BitsAndBytesConfig
#
# bnb_config = BitsAndBytesConfig(
#     load_in_4bit=True,
#     bnb_4bit_quant_type="nf4",       # NormalFloat4 quantization
#     bnb_4bit_compute_dtype=torch.float16,
#     bnb_4bit_use_double_quant=True,   # Quantize the scales too
# )
#
# model_bnb = AutoModelForCausalLM.from_pretrained(
#     MODEL_NAME,
#     quantization_config=bnb_config,
#     device_map="auto",
# )
```

---

## 9. Summary and Checklist

After completing this recitation, you should be able to answer:

- [ ] What is the perplexity difference between RTN and GPTQ at INT4? Why?
- [ ] How does group size affect quantization error? What is the storage overhead?
- [ ] At what bit-width does RTN quantization "break" (perplexity > 2x baseline)?
- [ ] Which layers are most sensitive to quantization? How would you design a mixed-precision scheme?
- [ ] What is the actual memory savings and speed improvement you observed? How does it compare to the theoretical 4x?

---

*This recitation accompanies Module 06 of the PhD ML Systems course.*
