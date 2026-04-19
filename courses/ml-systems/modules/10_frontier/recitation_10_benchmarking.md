# Recitation 10: Benchmarking & Evaluation Methodology for ML Systems

## Overview

This recitation covers the practical methodology of benchmarking ML systems: measuring latency, throughput, memory, and energy correctly. Unlike model-quality benchmarking (covered in the deep learning course), systems benchmarking focuses on hardware utilization, operational efficiency, and reproducibility. We will implement benchmarking tools, identify common measurement pitfalls, and run a comparative evaluation of different inference configurations.

---

## 1. Why Systems Benchmarking Is Hard

### 1.1 Common Mistakes

| Mistake | What Goes Wrong | Correct Approach |
|---------|----------------|------------------|
| No warm-up | JIT compilation, caching not triggered | Run 5-10 warm-up iterations |
| Wall-clock only | Ignores async GPU execution | Use `torch.cuda.synchronize()` |
| Single run | No confidence interval | Report mean +/- std over 10+ runs |
| Wrong batch size | Not representative of production | Benchmark at production batch size |
| Cold cache | First run includes compilation | Separate warm-up from measurement |
| Ignoring tail latency | Report mean instead of P99 | Report P50, P90, P95, P99 |
| Mixed metrics | Comparing throughput vs latency | Report both; state which is held constant |

### 1.2 What to Measure

For inference systems, the key metrics are:

| Metric | Definition | Units |
|--------|-----------|-------|
| **Throughput** | Tokens processed per second (all requests) | tok/s |
| **Latency (TTFT)** | Time to first token | ms |
| **Latency (TPOT)** | Time per output token (after first) | ms |
| **Latency (E2E)** | End-to-end time for a complete request | ms |
| **P99 Latency** | 99th percentile of latency distribution | ms |
| **Memory** | Peak GPU memory usage | GB |
| **MFU** | Model FLOPs utilization (actual / theoretical peak) | % |
| **Energy** | Energy per token (or per request) | J/tok |
| **Cost** | Dollar cost per 1M tokens | $/Mtok |

---

## 2. Accurate GPU Timing

### 2.1 CUDA Events

CPU-side timing (`time.time()`) does not capture GPU execution accurately because GPU operations are asynchronous. Use CUDA events:

```python
import torch
import torch.cuda

def benchmark_gpu_operation(fn, *args, warmup=10, repeats=100, **kwargs):
    """
    Accurately benchmark a GPU operation using CUDA events.

    Args:
        fn: function to benchmark
        *args: arguments to fn
        warmup: number of warm-up iterations
        repeats: number of timed iterations
    Returns:
        dict with timing statistics
    """
    # Warm-up
    for _ in range(warmup):
        fn(*args, **kwargs)
    torch.cuda.synchronize()

    # Timed runs
    start_events = [torch.cuda.Event(enable_timing=True) for _ in range(repeats)]
    end_events = [torch.cuda.Event(enable_timing=True) for _ in range(repeats)]

    for i in range(repeats):
        start_events[i].record()
        fn(*args, **kwargs)
        end_events[i].record()

    torch.cuda.synchronize()

    times_ms = [s.elapsed_time(e) for s, e in zip(start_events, end_events)]

    return {
        "mean_ms": sum(times_ms) / len(times_ms),
        "std_ms": (sum((t - sum(times_ms)/len(times_ms))**2
                       for t in times_ms) / len(times_ms)) ** 0.5,
        "min_ms": min(times_ms),
        "max_ms": max(times_ms),
        "median_ms": sorted(times_ms)[len(times_ms) // 2],
        "p90_ms": sorted(times_ms)[int(0.9 * len(times_ms))],
        "p99_ms": sorted(times_ms)[int(0.99 * len(times_ms))],
        "all_times_ms": times_ms,
    }
```

### 2.2 Memory Measurement

```python
def measure_peak_memory(fn, *args, **kwargs):
    """
    Measure peak GPU memory used by a function.

    Uses torch.cuda.max_memory_allocated for accurate measurement.
    """
    torch.cuda.empty_cache()
    torch.cuda.reset_peak_memory_stats()

    baseline = torch.cuda.memory_allocated()

    fn(*args, **kwargs)
    torch.cuda.synchronize()

    peak = torch.cuda.max_memory_allocated()
    current = torch.cuda.memory_allocated()

    return {
        "baseline_mb": baseline / 1024**2,
        "peak_mb": peak / 1024**2,
        "delta_mb": (peak - baseline) / 1024**2,
        "current_mb": current / 1024**2,
    }
```

### 2.3 FLOPs Measurement and MFU

```python
def compute_mfu(model_flops_per_token: int, tokens_per_second: float,
                gpu_peak_flops: float) -> float:
    """
    Compute Model FLOPs Utilization.

    MFU = (actual FLOPs/s) / (theoretical peak FLOPs/s)

    Args:
        model_flops_per_token: FLOPs for one forward pass per token
            For Transformers: ~2 * P (parameters) for forward
        tokens_per_second: measured throughput
        gpu_peak_flops: theoretical peak (e.g., 990e12 for H100 BF16)
    Returns:
        MFU as a fraction (0 to 1)
    """
    actual_flops = model_flops_per_token * tokens_per_second
    return actual_flops / gpu_peak_flops


def estimate_transformer_flops(
    num_params: int,
    seq_length: int,
    num_layers: int,
    hidden_dim: int,
    vocab_size: int,
    is_forward_only: bool = True,
) -> dict:
    """
    Estimate FLOPs for a Transformer model.

    Follows the Megatron-LM counting methodology.

    Forward pass FLOPs per token:
      - Attention QKV projection: 6 * S * d^2 per layer (3 projections, each 2Sd^2)
        Wait -- this is per sequence. Per token: 6 * d^2 per layer
      - Attention score: 2 * S * d per token per layer
      - Attention output projection: 2 * d^2 per layer
      - FFN: 2 * 4 * d * d_ff per layer (with SwiGLU: 3 * 2 * d * d_ff)
      - Embedding: 2 * d * V (amortized per token)
    """
    d = hidden_dim
    L = num_layers
    S = seq_length
    V = vocab_size

    # Per-token FLOPs (forward only)
    attn_qkv = 6 * d * d * L        # Q, K, V projections
    attn_score = 2 * S * d * L       # QK^T and softmax @ V
    attn_output = 2 * d * d * L      # Output projection
    ffn = 16 * d * d * L             # SwiGLU: 3 linear layers, 2 FLOPs each
    # (assuming d_ff = 4d with 3 matrices for SwiGLU: W1, W2, W3)

    embedding = 2 * d * V            # Per-token, amortized

    total_forward = attn_qkv + attn_score + attn_output + ffn + embedding

    # Approximate: ~2P per token for forward
    approx_forward = 2 * num_params

    multiplier = 1 if is_forward_only else 3  # backward is ~2x forward

    return {
        "per_token_forward": total_forward,
        "per_token_total": total_forward * multiplier,
        "approx_2P": approx_forward,
        "per_sequence_forward": total_forward * S,
        "breakdown": {
            "attn_qkv": attn_qkv,
            "attn_score": attn_score,
            "attn_output": attn_output,
            "ffn": ffn,
            "embedding": embedding,
        },
    }
```

---

## 3. Inference Benchmarking Framework

### 3.1 Comprehensive Inference Benchmark

```python
import time
import json
import statistics
import torch
from dataclasses import dataclass, field, asdict
from typing import Optional

@dataclass
class BenchmarkConfig:
    """Configuration for an inference benchmark run."""
    model_name: str = "gpt2"
    batch_sizes: list[int] = field(default_factory=lambda: [1, 4, 8, 16, 32])
    input_lengths: list[int] = field(default_factory=lambda: [128, 512, 1024])
    output_length: int = 128
    warmup_iterations: int = 5
    benchmark_iterations: int = 20
    device: str = "cuda"
    dtype: str = "float16"
    use_kv_cache: bool = True

@dataclass
class BenchmarkResult:
    """Results from a single benchmark configuration."""
    batch_size: int
    input_length: int
    output_length: int

    # Latency
    ttft_ms: float = 0.0              # Time to first token
    tpot_ms: float = 0.0              # Time per output token
    e2e_latency_ms: float = 0.0       # End-to-end latency
    p99_latency_ms: float = 0.0       # P99 end-to-end latency

    # Throughput
    tokens_per_second: float = 0.0    # Total output tokens / time
    requests_per_second: float = 0.0  # Requests completed / time

    # Memory
    peak_memory_mb: float = 0.0       # Peak GPU memory
    kv_cache_memory_mb: float = 0.0   # KV cache size estimate

    # Efficiency
    mfu: float = 0.0                  # Model FLOPs utilization


class InferenceBenchmark:
    """
    Comprehensive inference benchmarking framework.

    Measures TTFT, TPOT, throughput, memory, and MFU across
    different batch sizes and sequence lengths.
    """
    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self.results: list[BenchmarkResult] = []

    def _setup_model(self):
        """Load and configure the model for benchmarking."""
        from transformers import AutoModelForCausalLM, AutoTokenizer

        dtype_map = {
            "float16": torch.float16,
            "bfloat16": torch.bfloat16,
            "float32": torch.float32,
        }

        self.tokenizer = AutoTokenizer.from_pretrained(self.config.model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.config.model_name,
            torch_dtype=dtype_map[self.config.dtype],
        ).to(self.config.device)
        self.model.eval()

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.num_params = sum(p.numel() for p in self.model.parameters())

    def _benchmark_prefill(self, input_ids: torch.Tensor) -> dict:
        """Benchmark the prefill (prompt processing) phase."""
        def prefill_fn():
            with torch.no_grad():
                self.model(input_ids, use_cache=True)

        return benchmark_gpu_operation(
            prefill_fn,
            warmup=self.config.warmup_iterations,
            repeats=self.config.benchmark_iterations,
        )

    def _benchmark_generation(self, input_ids: torch.Tensor,
                                max_new_tokens: int) -> dict:
        """Benchmark full generation (prefill + decode)."""
        times_ms = []
        ttft_times = []

        for _ in range(self.config.warmup_iterations):
            with torch.no_grad():
                self.model.generate(
                    input_ids, max_new_tokens=max_new_tokens,
                    do_sample=False, pad_token_id=self.tokenizer.pad_token_id,
                )

        torch.cuda.synchronize()

        for _ in range(self.config.benchmark_iterations):
            torch.cuda.synchronize()

            # Measure TTFT
            start_event = torch.cuda.Event(enable_timing=True)
            first_token_event = torch.cuda.Event(enable_timing=True)
            end_event = torch.cuda.Event(enable_timing=True)

            start_event.record()

            with torch.no_grad():
                outputs = self.model.generate(
                    input_ids, max_new_tokens=max_new_tokens,
                    do_sample=False, pad_token_id=self.tokenizer.pad_token_id,
                )

            end_event.record()
            torch.cuda.synchronize()

            e2e_ms = start_event.elapsed_time(end_event)
            times_ms.append(e2e_ms)

        B = input_ids.shape[0]
        total_output_tokens = B * max_new_tokens

        return {
            "mean_e2e_ms": statistics.mean(times_ms),
            "std_e2e_ms": statistics.stdev(times_ms) if len(times_ms) > 1 else 0,
            "p50_ms": sorted(times_ms)[len(times_ms) // 2],
            "p99_ms": sorted(times_ms)[int(0.99 * len(times_ms))],
            "tokens_per_second": total_output_tokens / (statistics.mean(times_ms) / 1000),
            "requests_per_second": B / (statistics.mean(times_ms) / 1000),
        }

    def run(self) -> list[BenchmarkResult]:
        """Run the full benchmark suite."""
        self._setup_model()

        print(f"Model: {self.config.model_name}")
        print(f"Parameters: {self.num_params:,}")
        print(f"Device: {self.config.device}")
        print(f"Dtype: {self.config.dtype}")
        print("=" * 80)

        for input_len in self.config.input_lengths:
            for batch_size in self.config.batch_sizes:
                print(f"\nBenchmarking: batch_size={batch_size}, "
                      f"input_len={input_len}, "
                      f"output_len={self.config.output_length}")

                # Create input
                input_ids = torch.randint(
                    0, self.tokenizer.vocab_size,
                    (batch_size, input_len),
                    device=self.config.device,
                )

                try:
                    # Memory measurement
                    torch.cuda.empty_cache()
                    torch.cuda.reset_peak_memory_stats()

                    # Generation benchmark
                    gen_results = self._benchmark_generation(
                        input_ids, self.config.output_length
                    )

                    peak_mem = torch.cuda.max_memory_allocated() / 1024**2

                    # Compute MFU
                    flops_per_token = 2 * self.num_params
                    gpu_peak = 990e12  # H100 BF16 (adjust for your GPU)
                    mfu = compute_mfu(
                        flops_per_token,
                        gen_results["tokens_per_second"],
                        gpu_peak,
                    )

                    # Estimate KV cache size
                    model_config = self.model.config
                    num_layers = getattr(model_config, 'n_layer',
                                        getattr(model_config, 'num_hidden_layers', 12))
                    hidden_dim = getattr(model_config, 'n_embd',
                                        getattr(model_config, 'hidden_size', 768))
                    total_seq = input_len + self.config.output_length
                    bytes_per_element = 2 if self.config.dtype != "float32" else 4
                    kv_cache_mb = (
                        2 * num_layers * hidden_dim * total_seq
                        * batch_size * bytes_per_element / 1024**2
                    )

                    result = BenchmarkResult(
                        batch_size=batch_size,
                        input_length=input_len,
                        output_length=self.config.output_length,
                        e2e_latency_ms=gen_results["mean_e2e_ms"],
                        p99_latency_ms=gen_results["p99_ms"],
                        tokens_per_second=gen_results["tokens_per_second"],
                        requests_per_second=gen_results["requests_per_second"],
                        peak_memory_mb=peak_mem,
                        kv_cache_memory_mb=kv_cache_mb,
                        mfu=mfu,
                    )

                    self.results.append(result)

                    print(f"  E2E Latency: {result.e2e_latency_ms:.1f} ms "
                          f"(P99: {result.p99_latency_ms:.1f} ms)")
                    print(f"  Throughput: {result.tokens_per_second:.1f} tok/s "
                          f"({result.requests_per_second:.2f} req/s)")
                    print(f"  Memory: {result.peak_memory_mb:.1f} MB "
                          f"(KV cache: {result.kv_cache_memory_mb:.1f} MB)")
                    print(f"  MFU: {result.mfu:.4f} ({result.mfu*100:.2f}%)")

                except torch.cuda.OutOfMemoryError:
                    print(f"  OOM! Skipping batch_size={batch_size}, "
                          f"input_len={input_len}")
                    torch.cuda.empty_cache()

        return self.results

    def save_results(self, path: str):
        """Save results to JSON."""
        with open(path, "w") as f:
            json.dump([asdict(r) for r in self.results], f, indent=2)
        print(f"\nResults saved to {path}")

    def print_summary_table(self):
        """Print a formatted summary table."""
        print("\n" + "=" * 100)
        print(f"{'Batch':>6} {'InLen':>6} {'OutLen':>7} {'E2E(ms)':>10} "
              f"{'P99(ms)':>10} {'Tok/s':>10} {'Mem(MB)':>10} {'MFU':>8}")
        print("-" * 100)
        for r in self.results:
            print(f"{r.batch_size:>6} {r.input_length:>6} "
                  f"{r.output_length:>7} {r.e2e_latency_ms:>10.1f} "
                  f"{r.p99_latency_ms:>10.1f} {r.tokens_per_second:>10.1f} "
                  f"{r.peak_memory_mb:>10.1f} {r.mfu:>7.4f}")


# Main entry point
if __name__ == "__main__":
    config = BenchmarkConfig(
        model_name="gpt2",
        batch_sizes=[1, 4, 8, 16],
        input_lengths=[128, 512],
        output_length=64,
        warmup_iterations=3,
        benchmark_iterations=10,
    )

    benchmark = InferenceBenchmark(config)
    results = benchmark.run()
    benchmark.print_summary_table()
    benchmark.save_results("inference_benchmark_results.json")
```

---

## 4. Comparing Inference Configurations

### 4.1 Quantization Impact Benchmark

```python
def benchmark_quantization_impact(model_name: str = "gpt2",
                                    batch_size: int = 8,
                                    input_length: int = 256,
                                    output_length: int = 64):
    """
    Compare FP32, FP16, and INT8 (simulated) inference.

    Measures throughput, memory, and latency for each precision.
    """
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    configs = [
        ("FP32", torch.float32),
        ("FP16", torch.float16),
        ("BF16", torch.bfloat16),
    ]

    input_ids = torch.randint(
        0, tokenizer.vocab_size, (batch_size, input_length), device="cuda"
    )

    results = {}

    for name, dtype in configs:
        print(f"\nBenchmarking {name}...")
        torch.cuda.empty_cache()

        model = AutoModelForCausalLM.from_pretrained(
            model_name, torch_dtype=dtype
        ).to("cuda").eval()

        # Memory
        torch.cuda.reset_peak_memory_stats()

        # Timing
        def generate():
            with torch.no_grad():
                model.generate(
                    input_ids.clone(), max_new_tokens=output_length,
                    do_sample=False, pad_token_id=tokenizer.pad_token_id,
                )

        timing = benchmark_gpu_operation(generate, warmup=3, repeats=10)
        peak_mem = torch.cuda.max_memory_allocated() / 1024**2

        total_tokens = batch_size * output_length
        throughput = total_tokens / (timing["mean_ms"] / 1000)

        results[name] = {
            "latency_ms": timing["mean_ms"],
            "p99_ms": timing["p99_ms"],
            "throughput_tok_s": throughput,
            "peak_memory_mb": peak_mem,
            "model_size_mb": sum(p.numel() * p.element_size()
                                for p in model.parameters()) / 1024**2,
        }

        print(f"  Latency: {timing['mean_ms']:.1f} ms")
        print(f"  Throughput: {throughput:.1f} tok/s")
        print(f"  Memory: {peak_mem:.1f} MB")

        del model
        torch.cuda.empty_cache()

    # Summary table
    print("\n" + "=" * 70)
    print(f"{'Dtype':>8} {'Latency(ms)':>12} {'P99(ms)':>10} "
          f"{'Tok/s':>10} {'Mem(MB)':>10} {'Model(MB)':>10}")
    print("-" * 70)
    for name, r in results.items():
        print(f"{name:>8} {r['latency_ms']:>12.1f} {r['p99_ms']:>10.1f} "
              f"{r['throughput_tok_s']:>10.1f} {r['peak_memory_mb']:>10.1f} "
              f"{r['model_size_mb']:>10.1f}")

    return results
```

### 4.2 Batch Size Scaling Analysis

```python
def analyze_batch_scaling(results: list[BenchmarkResult]):
    """
    Analyze how throughput and latency scale with batch size.

    Produces insights about:
    - At what batch size does throughput saturate?
    - What is the latency-throughput tradeoff?
    - Where is the compute-bound / memory-bound crossover?
    """
    import collections

    by_input_len = collections.defaultdict(list)
    for r in results:
        by_input_len[r.input_length].append(r)

    for input_len, res_list in sorted(by_input_len.items()):
        res_list.sort(key=lambda x: x.batch_size)

        print(f"\n--- Input Length: {input_len} ---")
        print(f"{'Batch':>6} {'Tok/s':>10} {'Lat(ms)':>10} "
              f"{'Tok/s/BS':>10} {'MFU':>8}")

        for r in res_list:
            per_sample = r.tokens_per_second / r.batch_size
            print(f"{r.batch_size:>6} {r.tokens_per_second:>10.1f} "
                  f"{r.e2e_latency_ms:>10.1f} {per_sample:>10.1f} "
                  f"{r.mfu:>7.4f}")

        # Check scaling efficiency
        if len(res_list) >= 2:
            base = res_list[0]
            for r in res_list[1:]:
                batch_ratio = r.batch_size / base.batch_size
                throughput_ratio = r.tokens_per_second / base.tokens_per_second
                efficiency = throughput_ratio / batch_ratio
                print(f"  BS {base.batch_size}->{r.batch_size}: "
                      f"scaling efficiency = {efficiency:.2f}")
```

---

## 5. Profiling with PyTorch Profiler

### 5.1 Trace-Based Profiling

```python
import torch
from torch.profiler import profile, record_function, ProfilerActivity

def profile_model_inference(model, input_ids, output_path="trace.json"):
    """
    Profile model inference and export a Chrome trace.

    The trace can be viewed at chrome://tracing or
    https://ui.perfetto.dev/
    """
    model.eval()

    with profile(
        activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
        record_shapes=True,
        profile_memory=True,
        with_stack=True,
    ) as prof:
        with record_function("model_inference"):
            with torch.no_grad():
                outputs = model.generate(
                    input_ids, max_new_tokens=32,
                    do_sample=False,
                    pad_token_id=0,
                )

    # Print summary
    print(prof.key_averages().table(
        sort_by="cuda_time_total", row_limit=20
    ))

    # Export trace
    prof.export_chrome_trace(output_path)
    print(f"\nTrace saved to {output_path}")
    print("View at: https://ui.perfetto.dev/")

    # Memory timeline
    print("\n--- Memory Events ---")
    for event in prof.key_averages():
        if event.cuda_memory_usage > 0:
            print(f"  {event.key}: +{event.cuda_memory_usage / 1024**2:.1f} MB")


def profile_operator_breakdown(model, input_ids):
    """
    Profile individual operator execution times.

    Useful for identifying which operators dominate inference.
    """
    model.eval()

    with profile(
        activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
        record_shapes=True,
    ) as prof:
        with torch.no_grad():
            _ = model(input_ids)

    # Group by operator type
    print("\n--- Operator Breakdown ---")
    print(prof.key_averages(group_by_input_shape=False).table(
        sort_by="cuda_time_total", row_limit=15
    ))

    # Identify bottleneck
    events = prof.key_averages()
    total_cuda_time = sum(e.cuda_time_total for e in events)

    print(f"\nTotal CUDA time: {total_cuda_time / 1000:.2f} ms")
    print("\nTop operators by CUDA time:")
    for e in sorted(events, key=lambda x: -x.cuda_time_total)[:5]:
        pct = 100 * e.cuda_time_total / total_cuda_time
        print(f"  {e.key}: {e.cuda_time_total/1000:.2f} ms ({pct:.1f}%)")
```

---

## 6. Serving System Benchmarking

### 6.1 Load Testing an LLM Server

```python
import asyncio
import aiohttp
import time
import statistics
from dataclasses import dataclass

@dataclass
class LoadTestConfig:
    """Configuration for a serving load test."""
    server_url: str = "http://localhost:8000/v1/completions"
    num_requests: int = 100
    concurrency: int = 10
    prompt: str = "Explain the concept of attention in neural networks."
    max_tokens: int = 128
    model: str = "gpt2"

@dataclass
class RequestResult:
    """Result of a single request."""
    latency_ms: float
    ttft_ms: float
    output_tokens: int
    status: int
    error: str = ""

async def send_request(session: aiohttp.ClientSession,
                        config: LoadTestConfig) -> RequestResult:
    """Send a single completion request and measure latency."""
    payload = {
        "model": config.model,
        "prompt": config.prompt,
        "max_tokens": config.max_tokens,
        "temperature": 0.0,
    }

    start = time.monotonic()
    ttft = None

    try:
        async with session.post(config.server_url, json=payload) as resp:
            if resp.status == 200:
                # For streaming, measure TTFT from first chunk
                data = await resp.json()
                end = time.monotonic()

                output_tokens = data.get("usage", {}).get("completion_tokens", 0)

                return RequestResult(
                    latency_ms=(end - start) * 1000,
                    ttft_ms=0,  # Non-streaming; TTFT = latency
                    output_tokens=output_tokens,
                    status=resp.status,
                )
            else:
                end = time.monotonic()
                error_text = await resp.text()
                return RequestResult(
                    latency_ms=(end - start) * 1000,
                    ttft_ms=0,
                    output_tokens=0,
                    status=resp.status,
                    error=error_text[:200],
                )

    except Exception as e:
        end = time.monotonic()
        return RequestResult(
            latency_ms=(end - start) * 1000,
            ttft_ms=0,
            output_tokens=0,
            status=0,
            error=str(e),
        )

async def run_load_test(config: LoadTestConfig) -> dict:
    """
    Run a load test against an LLM serving endpoint.

    Sends `num_requests` requests with `concurrency` in parallel.
    """
    semaphore = asyncio.Semaphore(config.concurrency)
    results: list[RequestResult] = []

    async def bounded_request(session):
        async with semaphore:
            return await send_request(session, config)

    print(f"Starting load test: {config.num_requests} requests, "
          f"concurrency={config.concurrency}")
    print(f"Target: {config.server_url}")

    overall_start = time.monotonic()

    async with aiohttp.ClientSession() as session:
        tasks = [bounded_request(session) for _ in range(config.num_requests)]
        results = await asyncio.gather(*tasks)

    overall_elapsed = time.monotonic() - overall_start

    # Analyze results
    successful = [r for r in results if r.status == 200]
    failed = [r for r in results if r.status != 200]

    if not successful:
        print("All requests failed!")
        return {"error": "All requests failed"}

    latencies = [r.latency_ms for r in successful]
    total_output_tokens = sum(r.output_tokens for r in successful)

    summary = {
        "total_requests": config.num_requests,
        "successful": len(successful),
        "failed": len(failed),
        "total_time_s": overall_elapsed,
        "requests_per_second": len(successful) / overall_elapsed,
        "output_tokens_per_second": total_output_tokens / overall_elapsed,
        "latency": {
            "mean_ms": statistics.mean(latencies),
            "p50_ms": sorted(latencies)[len(latencies) // 2],
            "p90_ms": sorted(latencies)[int(0.9 * len(latencies))],
            "p95_ms": sorted(latencies)[int(0.95 * len(latencies))],
            "p99_ms": sorted(latencies)[int(0.99 * len(latencies))],
            "min_ms": min(latencies),
            "max_ms": max(latencies),
        },
    }

    print(f"\n{'='*60}")
    print("LOAD TEST RESULTS")
    print(f"{'='*60}")
    print(f"Requests:     {summary['successful']}/{summary['total_requests']} "
          f"succeeded ({len(failed)} failed)")
    print(f"Duration:     {overall_elapsed:.2f}s")
    print(f"Throughput:   {summary['requests_per_second']:.2f} req/s, "
          f"{summary['output_tokens_per_second']:.1f} tok/s")
    print(f"Latency (ms): mean={summary['latency']['mean_ms']:.1f}, "
          f"P50={summary['latency']['p50_ms']:.1f}, "
          f"P90={summary['latency']['p90_ms']:.1f}, "
          f"P99={summary['latency']['p99_ms']:.1f}")

    return summary


# Usage
if __name__ == "__main__":
    config = LoadTestConfig(
        server_url="http://localhost:8000/v1/completions",
        num_requests=100,
        concurrency=10,
        max_tokens=64,
    )
    asyncio.run(run_load_test(config))
```

---

## 7. Exercises

**Exercise 10r.1.** Using the `InferenceBenchmark` class, benchmark GPT-2 (124M) on your GPU. Produce a table of throughput vs. batch size for input lengths {128, 512, 1024}. At what batch size does throughput saturate? Explain why in terms of compute vs. memory bandwidth.

**Exercise 10r.2.** Compare FP32, FP16, and BF16 inference for the same model. For each dtype, report:
- Throughput (tok/s)
- Peak memory (MB)
- P99 latency (ms)

Compute the speedup ratio (FP16/FP32) and explain any discrepancy from the theoretical 2x.

**Exercise 10r.3.** Profile a model forward pass using `profile_operator_breakdown`. Identify the top-3 operators by CUDA time. For each, explain:
- What the operator does
- Whether it is compute-bound or memory-bound
- What optimization could reduce its time

**Exercise 10r.4.** Modify the `InferenceBenchmark` to measure energy consumption using `torch.cuda.power_draw()` (if available) or `nvidia-smi`. Report joules per token for different batch sizes and discuss the energy-efficiency sweet spot.

**Exercise 10r.5 (Challenge).** Implement a load test for an actual vLLM or TGI server. Compare throughput and P99 latency at different concurrency levels (1, 5, 10, 20, 50). Plot throughput vs. latency and identify the point where the server saturates.

---

## 8. Benchmarking Best Practices Checklist

Before reporting any systems benchmark result:

- [ ] **Warm-up**: At least 5 iterations discarded before measurement.
- [ ] **Synchronization**: `torch.cuda.synchronize()` before and after timing.
- [ ] **Multiple runs**: At least 10 measurement iterations; report mean and std.
- [ ] **Percentiles**: Report P50, P90, P99 in addition to mean.
- [ ] **Memory reset**: `torch.cuda.reset_peak_memory_stats()` before each measurement.
- [ ] **Cache state**: Document whether CUDA context and JIT caches are warm or cold.
- [ ] **Hardware**: Report GPU model, driver version, CUDA version, PyTorch version.
- [ ] **Configuration**: Report all relevant settings (dtype, batch size, sequence length, model variant).
- [ ] **Baseline**: Compare against a well-known reference (published numbers or official benchmark).
- [ ] **Reproducibility**: Provide code and random seeds.

---

## References

1. Dao, T. (2024). "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." ICLR 2024.
2. Kwon, W., et al. (2023). "Efficient Memory Management for Large Language Model Serving with PagedAttention." SOSP 2023.
3. Aminabadi, R.Y., et al. (2022). "DeepSpeed-Inference: Enabling Efficient Inference of Transformer Models at Unprecedented Scale." SC 2022.
4. NVIDIA. (2024). "NVIDIA Nsight Systems User Guide."
5. PyTorch. (2024). "PyTorch Profiler Documentation." pytorch.org/tutorials/recipes/recipes/profiler_recipe.html
