# Recitation 07: Benchmarking LLM Serving --- Throughput, Latency, TTFT

## Overview

This recitation provides hands-on experience benchmarking LLM serving systems. The goals are:

1. Understand and measure the key serving metrics: TTFT, ITL, throughput, and p99 latency.
2. Observe the impact of batch size, sequence length, and quantization on serving performance.
3. Compare vLLM and Hugging Face Transformers under controlled conditions.
4. Build intuition for the prefill-decode tradeoff through empirical measurement.

**Prerequisites:** A machine with at least one NVIDIA GPU (16+ GB VRAM). We use a 7B parameter model for accessibility. All code runs in Python 3.10+ with PyTorch 2.0+.

---

## Section 1: Setting Up the Benchmark Environment

### 1.1 Installation

```bash
# Create environment
conda create -n serving-bench python=3.10 -y
conda activate serving-bench

# Install dependencies
pip install vllm torch transformers datasets aiohttp tqdm numpy matplotlib

# Verify GPU
python -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0)}, Memory: {torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB')"
```

### 1.2 Benchmark Utilities

```python
"""bench_utils.py -- Shared utilities for serving benchmarks."""

import time
import json
import numpy as np
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RequestMetrics:
    """Metrics for a single request."""
    request_id: int
    prompt_len: int
    output_len: int
    ttft: float              # Time to first token (seconds)
    total_time: float        # Total request time (seconds)
    itl_list: list = field(default_factory=list)  # Inter-token latencies

    @property
    def mean_itl(self) -> float:
        return np.mean(self.itl_list) if self.itl_list else 0.0

    @property
    def tokens_per_second(self) -> float:
        return self.output_len / self.total_time if self.total_time > 0 else 0


@dataclass
class BenchmarkResult:
    """Aggregate benchmark results."""
    name: str
    num_requests: int
    total_time: float
    metrics: list  # List[RequestMetrics]

    @property
    def throughput(self) -> float:
        """Total tokens generated per second."""
        total_tokens = sum(m.output_len for m in self.metrics)
        return total_tokens / self.total_time

    @property
    def mean_ttft(self) -> float:
        return np.mean([m.ttft for m in self.metrics])

    @property
    def p50_ttft(self) -> float:
        return np.percentile([m.ttft for m in self.metrics], 50)

    @property
    def p99_ttft(self) -> float:
        return np.percentile([m.ttft for m in self.metrics], 99)

    @property
    def mean_itl(self) -> float:
        all_itls = [itl for m in self.metrics for itl in m.itl_list]
        return np.mean(all_itls) if all_itls else 0.0

    @property
    def p99_itl(self) -> float:
        all_itls = [itl for m in self.metrics for itl in m.itl_list]
        return np.percentile(all_itls, 99) if all_itls else 0.0

    def summary(self) -> str:
        return (
            f"{'='*60}\n"
            f"Benchmark: {self.name}\n"
            f"{'='*60}\n"
            f"Requests:      {self.num_requests}\n"
            f"Total time:    {self.total_time:.2f} s\n"
            f"Throughput:    {self.throughput:.1f} tokens/s\n"
            f"TTFT mean:     {self.mean_ttft*1000:.1f} ms\n"
            f"TTFT p50:      {self.p50_ttft*1000:.1f} ms\n"
            f"TTFT p99:      {self.p99_ttft*1000:.1f} ms\n"
            f"ITL mean:      {self.mean_itl*1000:.1f} ms\n"
            f"ITL p99:       {self.p99_itl*1000:.1f} ms\n"
            f"{'='*60}"
        )


def generate_synthetic_prompts(num_requests, prompt_len, output_len,
                                tokenizer):
    """Generate synthetic prompts with controlled lengths."""
    # Use a repeated token to create prompts of exact length
    base_text = "The quick brown fox jumps over the lazy dog. "
    prompts = []
    for _ in range(num_requests):
        # Build a prompt of approximately prompt_len tokens
        text = base_text * (prompt_len // 10 + 1)
        tokens = tokenizer.encode(text)[:prompt_len]
        prompt = tokenizer.decode(tokens)
        prompts.append((prompt, output_len))
    return prompts
```

---

## Section 2: Measuring Offline Throughput

### 2.1 HuggingFace Transformers Baseline

```python
"""bench_hf.py -- Benchmark HuggingFace Transformers (static batching)."""

import time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from bench_utils import RequestMetrics, BenchmarkResult, generate_synthetic_prompts


def benchmark_hf(model_name, prompts, batch_size, device="cuda"):
    """Benchmark HuggingFace generate() with static batching."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype=torch.float16, device_map=device
    )
    model.eval()

    metrics = []
    total_start = time.perf_counter()

    # Process in batches
    for batch_start in range(0, len(prompts), batch_size):
        batch = prompts[batch_start : batch_start + batch_size]
        batch_prompts = [p[0] for p in batch]
        batch_max_new = max(p[1] for p in batch)

        inputs = tokenizer(
            batch_prompts, return_tensors="pt",
            padding=True, truncation=True
        ).to(device)

        prompt_lens = inputs.attention_mask.sum(dim=1).tolist()

        # Time the generation
        torch.cuda.synchronize()
        gen_start = time.perf_counter()

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=batch_max_new,
                do_sample=False,  # greedy for reproducibility
                pad_token_id=tokenizer.eos_token_id,
            )

        torch.cuda.synchronize()
        gen_end = time.perf_counter()

        # Record metrics (no per-token timing with HF generate)
        gen_time = gen_end - gen_start
        for i, (prompt_text, target_len) in enumerate(batch):
            output_tokens = outputs[i, prompt_lens[i]:]
            actual_output_len = (
                output_tokens != tokenizer.eos_token_id
            ).sum().item()
            actual_output_len = max(actual_output_len, 1)

            metrics.append(RequestMetrics(
                request_id=batch_start + i,
                prompt_len=prompt_lens[i],
                output_len=actual_output_len,
                ttft=0.0,  # Cannot measure TTFT from batch generate(); see online benchmark (Section 3) for accurate TTFT measurement
                total_time=gen_time,
                itl_list=[gen_time / actual_output_len]
                    * actual_output_len,
            ))

    total_time = time.perf_counter() - total_start

    return BenchmarkResult(
        name=f"HF Transformers (bs={batch_size})",
        num_requests=len(prompts),
        total_time=total_time,
        metrics=metrics,
    )


if __name__ == "__main__":
    MODEL = "meta-llama/Llama-2-7b-hf"
    tokenizer = AutoTokenizer.from_pretrained(MODEL)

    prompts = generate_synthetic_prompts(
        num_requests=32, prompt_len=128, output_len=128,
        tokenizer=tokenizer
    )

    for bs in [1, 4, 8, 16]:
        result = benchmark_hf(MODEL, prompts, batch_size=bs)
        print(result.summary())
```

### 2.2 vLLM Benchmark

```python
"""bench_vllm.py -- Benchmark vLLM offline throughput."""

import time
from vllm import LLM, SamplingParams
from bench_utils import (
    RequestMetrics, BenchmarkResult, generate_synthetic_prompts
)
from transformers import AutoTokenizer


def benchmark_vllm(model_name, prompts, max_batch_size=None):
    """Benchmark vLLM with continuous batching."""
    llm = LLM(
        model=model_name,
        dtype="float16",
        max_model_len=4096,
        gpu_memory_utilization=0.9,
    )

    sampling_params = SamplingParams(
        temperature=0,  # greedy
        max_tokens=max(p[1] for p in prompts),
    )

    prompt_texts = [p[0] for p in prompts]

    # Time the generation
    start = time.perf_counter()
    outputs = llm.generate(prompt_texts, sampling_params)
    end = time.perf_counter()

    total_time = end - start

    metrics = []
    for i, output in enumerate(outputs):
        prompt_len = len(output.prompt_token_ids)
        output_len = len(output.outputs[0].token_ids)
        per_token = total_time / max(output_len, 1)

        metrics.append(RequestMetrics(
            request_id=i,
            prompt_len=prompt_len,
            output_len=output_len,
            ttft=0.0,  # Cannot measure TTFT from batch generate(); see online benchmark (Section 3) for accurate TTFT measurement
            total_time=total_time,
            itl_list=[per_token] * output_len,
        ))

    return BenchmarkResult(
        name="vLLM (continuous batching)",
        num_requests=len(prompts),
        total_time=total_time,
        metrics=metrics,
    )


if __name__ == "__main__":
    MODEL = "meta-llama/Llama-2-7b-hf"
    tokenizer = AutoTokenizer.from_pretrained(MODEL)

    prompts = generate_synthetic_prompts(
        num_requests=32, prompt_len=128, output_len=128,
        tokenizer=tokenizer,
    )

    result = benchmark_vllm(MODEL, prompts)
    print(result.summary())
```

---

## Section 3: Measuring Online Serving Metrics

### 3.1 Starting the vLLM Server

```bash
# Start vLLM OpenAI-compatible server
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-hf \
    --dtype float16 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.9 \
    --port 8000
```

### 3.2 Online Benchmark Client

```python
"""bench_online.py -- Benchmark online serving with streaming."""

import asyncio
import aiohttp
import time
import json
import numpy as np
from bench_utils import RequestMetrics, BenchmarkResult


async def send_request(session, url, prompt, max_tokens, request_id):
    """Send a single streaming request and measure per-token timing."""
    payload = {
        "model": "meta-llama/Llama-2-7b-hf",
        "prompt": prompt,
        "max_tokens": max_tokens,
        "temperature": 0,
        "stream": True,
    }

    token_times = []
    first_token_time = None
    start_time = time.perf_counter()

    async with session.post(
        f"{url}/v1/completions",
        json=payload
    ) as response:
        async for line in response.content:
            line = line.decode("utf-8").strip()
            if line.startswith("data: ") and line != "data: [DONE]":
                now = time.perf_counter()
                if first_token_time is None:
                    first_token_time = now
                token_times.append(now)

    end_time = time.perf_counter()

    # Compute inter-token latencies
    itl_list = []
    for i in range(1, len(token_times)):
        itl_list.append(token_times[i] - token_times[i - 1])

    ttft = (first_token_time - start_time) if first_token_time else 0

    return RequestMetrics(
        request_id=request_id,
        prompt_len=len(prompt.split()) * 2,  # rough estimate
        output_len=len(token_times),
        ttft=ttft,
        total_time=end_time - start_time,
        itl_list=itl_list,
    )


async def benchmark_online(
    url, prompts, max_tokens, rate, num_requests
):
    """Send requests at a given rate and collect metrics.

    Args:
        url: Server URL
        prompts: List of prompt strings
        max_tokens: Max tokens to generate per request
        rate: Requests per second (Poisson arrival)
        num_requests: Total number of requests to send
    """
    async with aiohttp.ClientSession() as session:
        tasks = []
        start_time = time.perf_counter()

        for i in range(num_requests):
            prompt = prompts[i % len(prompts)]
            task = asyncio.create_task(
                send_request(session, url, prompt, max_tokens, i)
            )
            tasks.append(task)

            # Poisson inter-arrival time
            if rate > 0:
                interval = np.random.exponential(1.0 / rate)
                await asyncio.sleep(interval)

        # Wait for all requests to complete
        metrics = await asyncio.gather(*tasks)
        total_time = time.perf_counter() - start_time

    return BenchmarkResult(
        name=f"Online (rate={rate} req/s)",
        num_requests=num_requests,
        total_time=total_time,
        metrics=list(metrics),
    )


async def main():
    URL = "http://localhost:8000"
    prompts = [
        "Explain the concept of virtual memory in operating systems.",
        "Write a Python function that implements binary search.",
        "What are the key differences between TCP and UDP?",
        "Describe the PagedAttention algorithm used in vLLM.",
    ]

    # Test at different request rates
    for rate in [1, 2, 5, 10, 20]:
        result = await benchmark_online(
            URL, prompts, max_tokens=128,
            rate=rate, num_requests=50
        )
        print(result.summary())
        print()


if __name__ == "__main__":
    asyncio.run(main())
```

---

## Section 4: Analyzing the Prefill-Decode Tradeoff

### 4.1 Measuring Prefill and Decode Separately

```python
"""bench_prefill_decode.py -- Isolate prefill vs decode costs."""

import time
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def measure_prefill_decode(model_name, prompt_lengths, output_length=64):
    """Measure prefill and decode times separately."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype=torch.float16, device_map="cuda"
    )
    model.eval()

    results = []

    for prompt_len in prompt_lengths:
        # Create prompt of desired length
        base = "The quick brown fox " * (prompt_len // 4 + 1)
        tokens = tokenizer.encode(base, return_tensors="pt")[:, :prompt_len]
        tokens = tokens.to("cuda")

        # Warm up
        with torch.no_grad():
            _ = model(tokens)
        torch.cuda.synchronize()

        # Measure prefill (single forward pass on full prompt)
        torch.cuda.synchronize()
        t0 = time.perf_counter()
        with torch.no_grad():
            out = model(tokens, use_cache=True)
            past_kv = out.past_key_values
        torch.cuda.synchronize()
        prefill_time = time.perf_counter() - t0

        # Measure decode (generate output_length tokens one at a time)
        decode_times = []
        next_token = out.logits[:, -1:, :].argmax(dim=-1)

        for _ in range(output_length):
            torch.cuda.synchronize()
            t0 = time.perf_counter()
            with torch.no_grad():
                out = model(
                    next_token,
                    past_key_values=past_kv,
                    use_cache=True,
                )
                past_kv = out.past_key_values
            torch.cuda.synchronize()
            decode_times.append(time.perf_counter() - t0)
            next_token = out.logits[:, -1:, :].argmax(dim=-1)

        mean_decode = sum(decode_times) / len(decode_times)
        results.append({
            "prompt_len": prompt_len,
            "prefill_ms": prefill_time * 1000,
            "prefill_ms_per_token": prefill_time * 1000 / prompt_len,
            "decode_ms_per_token": mean_decode * 1000,
            "decode_total_ms": sum(decode_times) * 1000,
        })

        print(f"Prompt={prompt_len:5d}  "
              f"Prefill={prefill_time*1000:8.1f}ms "
              f"({prefill_time*1000/prompt_len:.2f} ms/tok)  "
              f"Decode={mean_decode*1000:6.2f}ms/tok")

    return results


if __name__ == "__main__":
    MODEL = "meta-llama/Llama-2-7b-hf"
    results = measure_prefill_decode(
        MODEL,
        prompt_lengths=[32, 64, 128, 256, 512, 1024, 2048],
        output_length=64,
    )
```

### 4.2 Expected Observations

**Prefill scaling:** Prefill time should scale roughly linearly with prompt length (for short prompts where the GEMM is compute-bound) and quadratically for very long prompts (where the $O(P^2)$ attention term dominates).

**Decode independence from prompt:** Decode time per token should be approximately constant regardless of prompt length, because the decode step is memory-bandwidth-bound (dominated by loading model weights). The slight increase at longer prompts comes from the growing KV cache attention computation.

**Arithmetic intensity check:** Compute the ratio:

$$\text{Ratio} = \frac{\text{Prefill ms/token}}{\text{Decode ms/token}}$$

This ratio should be $\ll 1$ for short prompts (prefill processes many tokens in parallel via GEMM, amortizing the weight loading cost), and approach 1 for batch size 1 decode.

---

## Section 5: KV Cache Memory Measurement

### 5.1 Tracking GPU Memory During Generation

```python
"""bench_kv_memory.py -- Measure KV cache memory growth."""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def measure_kv_cache_memory(model_name, max_tokens=512):
    """Track GPU memory as sequence length grows."""
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype=torch.float16, device_map="cuda"
    )
    model.eval()

    # Measure baseline memory (model loaded, no KV cache)
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()
    baseline_mem = torch.cuda.memory_allocated() / 1e9

    print(f"Model memory: {baseline_mem:.2f} GB")
    print(f"{'Tokens':>8s}  {'KV Cache (MB)':>14s}  "
          f"{'Per-token (KB)':>14s}  {'Total GPU (GB)':>14s}")
    print("-" * 60)

    # Start generation
    prompt = "Once upon a time in a land far away"
    input_ids = tokenizer.encode(prompt, return_tensors="pt").to("cuda")

    memory_points = []

    with torch.no_grad():
        # Prefill
        out = model(input_ids, use_cache=True)
        past_kv = out.past_key_values
        next_token = out.logits[:, -1:, :].argmax(dim=-1)

        seq_len = input_ids.shape[1]
        current_mem = torch.cuda.memory_allocated() / 1e9
        kv_mem = (current_mem - baseline_mem) * 1000  # MB

        memory_points.append((seq_len, kv_mem))
        print(f"{seq_len:8d}  {kv_mem:14.2f}  "
              f"{kv_mem * 1000 / seq_len:14.2f}  {current_mem:14.3f}")

        # Decode
        for step in range(max_tokens):
            out = model(
                next_token,
                past_key_values=past_kv,
                use_cache=True,
            )
            past_kv = out.past_key_values
            next_token = out.logits[:, -1:, :].argmax(dim=-1)
            seq_len += 1

            if (step + 1) % 64 == 0:
                current_mem = torch.cuda.memory_allocated() / 1e9
                kv_mem = (current_mem - baseline_mem) * 1000
                per_token_kb = kv_mem * 1000 / seq_len
                memory_points.append((seq_len, kv_mem))
                print(f"{seq_len:8d}  {kv_mem:14.2f}  "
                      f"{per_token_kb:14.2f}  {current_mem:14.3f}")

    return memory_points


if __name__ == "__main__":
    MODEL = "meta-llama/Llama-2-7b-hf"
    points = measure_kv_cache_memory(MODEL, max_tokens=512)
```

### 5.2 Verification Exercise

**Exercise.** For LLaMA-2 7B ($L = 32$, $d = 4096$, $h = 32$, $d_k = 128$, MHA), compute the theoretical KV cache size per token:

$$\text{KV per token} = 2 \times L \times h \times d_k \times \text{sizeof(FP16)} = 2 \times 32 \times 32 \times 128 \times 2 = 524{,}288 \text{ bytes} = 512 \text{ KB}$$

Compare this theoretical value with the measured per-token memory from Section 5.1. Explain any discrepancy (hint: PyTorch memory allocator granularity and tensor metadata overhead).

---

## Section 6: Comparative Benchmark

### 6.1 Putting It All Together

```python
"""bench_compare.py -- Compare HF vs vLLM across configurations."""

import json
from bench_hf import benchmark_hf
from bench_vllm import benchmark_vllm
from bench_utils import generate_synthetic_prompts
from transformers import AutoTokenizer


def run_comparison(model_name):
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    configs = [
        {"num_requests": 16, "prompt_len": 64,  "output_len": 64},
        {"num_requests": 16, "prompt_len": 256, "output_len": 128},
        {"num_requests": 32, "prompt_len": 128, "output_len": 128},
        {"num_requests": 64, "prompt_len": 128, "output_len": 256},
    ]

    all_results = []

    for cfg in configs:
        prompts = generate_synthetic_prompts(
            tokenizer=tokenizer, **cfg
        )

        print(f"\n{'='*60}")
        print(f"Config: {cfg}")
        print(f"{'='*60}")

        # HF with different batch sizes
        for bs in [1, 8]:
            result = benchmark_hf(model_name, prompts, batch_size=bs)
            print(result.summary())
            all_results.append({
                "config": cfg,
                "system": result.name,
                "throughput": result.throughput,
                "mean_ttft_ms": result.mean_ttft * 1000,
            })

        # vLLM
        result = benchmark_vllm(model_name, prompts)
        print(result.summary())
        all_results.append({
            "config": cfg,
            "system": result.name,
            "throughput": result.throughput,
            "mean_ttft_ms": result.mean_ttft * 1000,
        })

    # Save results
    with open("benchmark_results.json", "w") as f:
        json.dump(all_results, f, indent=2)

    return all_results


if __name__ == "__main__":
    run_comparison("meta-llama/Llama-2-7b-hf")
```

### 6.2 Visualization

```python
"""plot_results.py -- Visualize benchmark results."""

import json
import matplotlib.pyplot as plt
import numpy as np


def plot_throughput_comparison(results_file="benchmark_results.json"):
    with open(results_file) as f:
        results = json.load(f)

    # Group by config
    configs = []
    seen = set()
    for r in results:
        key = json.dumps(r["config"], sort_keys=True)
        if key not in seen:
            configs.append(r["config"])
            seen.add(key)

    systems = sorted(set(r["system"] for r in results))
    x = np.arange(len(configs))
    width = 0.25

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    for i, system in enumerate(systems):
        throughputs = []
        ttfts = []
        for cfg in configs:
            match = [
                r for r in results
                if r["system"] == system
                and r["config"] == cfg
            ]
            throughputs.append(match[0]["throughput"] if match else 0)
            ttfts.append(match[0]["mean_ttft_ms"] if match else 0)

        ax1.bar(x + i * width, throughputs, width, label=system)
        ax2.bar(x + i * width, ttfts, width, label=system)

    ax1.set_ylabel("Throughput (tokens/s)")
    ax1.set_title("Throughput Comparison")
    ax1.set_xticks(x + width)
    ax1.set_xticklabels(
        [f"P={c['prompt_len']},O={c['output_len']},N={c['num_requests']}"
         for c in configs],
        rotation=30, ha="right",
    )
    ax1.legend()

    ax2.set_ylabel("Mean TTFT (ms)")
    ax2.set_title("Time to First Token")
    ax2.set_xticks(x + width)
    ax2.set_xticklabels(
        [f"P={c['prompt_len']},O={c['output_len']},N={c['num_requests']}"
         for c in configs],
        rotation=30, ha="right",
    )
    ax2.legend()

    plt.tight_layout()
    plt.savefig("serving_benchmark.png", dpi=150)
    plt.show()


if __name__ == "__main__":
    plot_throughput_comparison()
```

---

## Section 7: Exercises

### Exercise 7.1: Roofline Analysis (15 minutes)

Using your decode timing measurements from Section 4:

**(a)** Compute the achieved arithmetic intensity during decode for batch size 1:

$$I = \frac{\text{FLOPs per token}}{\text{Bytes loaded per token}}$$

Use the formula: FLOPs per token $\approx 2N$ (where $N$ is the number of parameters), bytes loaded $\approx 2N$ (FP16 weights). What is the resulting $I$?

**(b)** Plot the measured decode throughput (tokens/s) against the roofline model for your GPU. How close to the bandwidth ceiling are you?

**(c)** Estimate the batch size needed to reach the compute ceiling. Compare with the maximum batch size your GPU can support (given model + KV cache memory).

### Exercise 7.2: KV Cache Budget (15 minutes)

For your GPU with total memory $M_{\text{GPU}}$:

**(a)** Compute the maximum batch size as a function of sequence length:

$$B_{\max}(S) = \left\lfloor \frac{M_{\text{GPU}} - M_{\text{model}}}{\text{KV per token per sequence} \times S} \right\rfloor$$

Plot $B_{\max}(S)$ for $S \in [128, 8192]$.

**(b)** Compute the maximum throughput (tokens/s) as a function of $S$, assuming continuous batching at full utilization with batch size $B_{\max}(S)$. At what sequence length does throughput peak?

### Exercise 7.3: Comparing Quantization Impact (20 minutes)

Run the vLLM benchmark with different quantization settings:

```python
# FP16
llm_fp16 = LLM(model=MODEL, dtype="float16")

# AWQ INT4 (if available)
llm_awq = LLM(model=f"{MODEL}-AWQ", quantization="awq")
```

Compare throughput and TTFT. Compute:

- Memory savings (model + KV cache)
- Throughput improvement (due to increased batch size and reduced memory traffic)
- Any quality degradation (run a small eval set)

---

## Section 8: Discussion Questions

1. **Why does vLLM outperform HuggingFace Transformers in throughput even though both use the same underlying model?** Discuss the role of continuous batching and PagedAttention.

2. **Under what conditions would static batching outperform continuous batching?** Consider the case of fixed-length inputs and outputs.

3. **The prefill-decode tradeoff creates scheduling challenges.** If you have 10 new requests and 50 ongoing decode requests, should you prefill all 10 immediately? What happens to the decode latency of existing requests?

4. **Design a benchmark that would expose the weaknesses of PagedAttention.** Hint: consider workloads where all sequences have exactly the same length.
