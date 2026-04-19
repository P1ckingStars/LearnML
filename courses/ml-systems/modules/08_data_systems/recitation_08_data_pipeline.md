# Recitation 08: Building a Data Pipeline with WebDataset

## Overview

In this recitation, you will build a complete, production-quality data pipeline for ML training using WebDataset. Starting from raw data, you will create sharded tar archives, build streaming data loaders, implement shuffle buffers, profile I/O throughput, and optimize the pipeline to eliminate data stalls. By the end, you will have a reusable template for efficient data loading in any training workload.

**Prerequisites:** Lectures 08a (Data Loading and I/O) and 08d (Streaming and Multimodal Data).

**Setup:**

```bash
pip install webdataset torchvision torchaudio pillow-simd tqdm
pip install torch-tb-profiler  # for profiling
```

---

## 1. Creating WebDataset Shards

### 1.1 From Raw Files to Tar Shards

The first step is converting a dataset of individual files into sharded tar archives. Each shard should be 100 MB -- 1 GB for optimal I/O performance (large enough for sequential read efficiency, small enough for parallel processing).

```python
import webdataset as wds
import os
import json
from pathlib import Path
from tqdm import tqdm

def create_shards(
    image_dir: str,
    output_dir: str,
    max_shard_size: int = 500_000_000,  # 500 MB per shard
    pattern: str = "shard-%05d.tar",
):
    """Convert a directory of images + metadata into WebDataset shards.

    Expected directory structure:
        image_dir/
            00000.jpg
            00000.json   (metadata: label, caption, etc.)
            00001.jpg
            00001.json
            ...
    """
    os.makedirs(output_dir, exist_ok=True)
    output_pattern = os.path.join(output_dir, pattern)

    # Collect all samples (pairs of .jpg + .json files)
    samples = sorted(set(
        p.stem for p in Path(image_dir).glob("*.jpg")
    ))
    print(f"Found {len(samples)} samples")

    with wds.ShardWriter(output_pattern, maxsize=max_shard_size) as sink:
        for sample_id in tqdm(samples, desc="Creating shards"):
            img_path = os.path.join(image_dir, f"{sample_id}.jpg")
            meta_path = os.path.join(image_dir, f"{sample_id}.json")

            with open(img_path, "rb") as f:
                image_data = f.read()
            with open(meta_path, "r") as f:
                metadata = json.load(f)

            sink.write({
                "__key__": sample_id,
                "jpg": image_data,
                "json": metadata,
                "cls": int(metadata.get("label", 0)),
            })

    # Report shard statistics
    shards = sorted(Path(output_dir).glob("shard-*.tar"))
    total_size = sum(s.stat().st_size for s in shards)
    print(f"Created {len(shards)} shards, total size: {total_size / 1e9:.2f} GB")
    print(f"Average shard size: {total_size / len(shards) / 1e6:.1f} MB")

# Example usage with CIFAR-10
# First, export CIFAR-10 to individual files:
def export_cifar10(output_dir: str):
    """Export CIFAR-10 to individual files for sharding."""
    import torchvision
    os.makedirs(output_dir, exist_ok=True)
    dataset = torchvision.datasets.CIFAR10(root="./data", train=True, download=True)

    for idx, (image, label) in enumerate(tqdm(dataset, desc="Exporting")):
        image.save(os.path.join(output_dir, f"{idx:05d}.jpg"))
        with open(os.path.join(output_dir, f"{idx:05d}.json"), "w") as f:
            json.dump({"label": label, "index": idx}, f)

# export_cifar10("cifar10_raw")
# create_shards("cifar10_raw", "cifar10_shards")
```

### 1.2 Verifying Shard Contents

Always verify your shards after creation:

```python
def verify_shards(shard_dir: str, num_samples: int = 5):
    """Verify shard contents by inspecting a few samples."""
    shard_paths = sorted(Path(shard_dir).glob("shard-*.tar"))
    print(f"Found {len(shard_paths)} shards")

    dataset = wds.WebDataset(str(shard_paths[0])).decode("pil")

    for i, sample in enumerate(dataset):
        if i >= num_samples:
            break
        print(f"\nSample {i}:")
        print(f"  Key: {sample['__key__']}")
        print(f"  Image size: {sample['jpg'].size}")
        print(f"  Metadata: {sample['json']}")
        print(f"  Class: {sample['cls']}")

verify_shards("cifar10_shards")
```

---

## 2. Building the Streaming Data Loader

### 2.1 Basic Pipeline

```python
import torch
from torchvision import transforms

def build_training_pipeline(
    shard_dir: str,
    batch_size: int = 256,
    num_workers: int = 4,
    image_size: int = 32,
    shuffle_buffer: int = 5000,
):
    """Build a complete training data pipeline with WebDataset."""

    # Define transforms
    train_transform = transforms.Compose([
        transforms.RandomCrop(image_size, padding=4),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.4914, 0.4822, 0.4465],
            std=[0.2470, 0.2435, 0.2616],
        ),
    ])

    # Collect shard URLs
    shard_paths = sorted(Path(shard_dir).glob("shard-*.tar"))
    shard_urls = [str(p) for p in shard_paths]
    print(f"Loading from {len(shard_urls)} shards")

    # Build the pipeline
    dataset = (
        wds.WebDataset(shard_urls, shardshuffle=True)
        .shuffle(shuffle_buffer)
        .decode("pil")
        .to_tuple("jpg", "cls")
        .map_tuple(train_transform, lambda x: x)
    )

    # Wrap in a standard DataLoader for batching and multi-process loading
    loader = wds.WebLoader(
        dataset,
        batch_size=batch_size,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=True,
    )

    # Add a second shuffle at the batch level (shuffles batches, not samples)
    loader = loader.unbatched().shuffle(1000).batched(batch_size)

    return loader

# Usage
loader = build_training_pipeline("cifar10_shards", batch_size=256, num_workers=4)
for images, labels in loader:
    print(f"Batch shape: {images.shape}, Labels shape: {labels.shape}")
    break
```

### 2.2 Pipeline for Distributed Training

In distributed training, each rank must process a disjoint partition of shards:

```python
import torch.distributed as dist

def build_distributed_pipeline(
    shard_dir: str,
    batch_size: int = 256,
    num_workers: int = 4,
    image_size: int = 32,
    shuffle_buffer: int = 5000,
    epoch: int = 0,
):
    """Build a distributed training data pipeline."""
    rank = dist.get_rank()
    world_size = dist.get_world_size()

    shard_paths = sorted(Path(shard_dir).glob("shard-*.tar"))
    shard_urls = [str(p) for p in shard_paths]

    # Deterministic shard shuffling per epoch
    import random
    rng = random.Random(epoch)
    rng.shuffle(shard_urls)

    # Partition shards across ranks
    # nodesplitter handles this automatically in WebDataset:
    dataset = (
        wds.WebDataset(shard_urls, shardshuffle=True)
        .shuffle(shuffle_buffer)
        .decode("pil")
        .to_tuple("jpg", "cls")
        .map_tuple(
            transforms.Compose([
                transforms.RandomCrop(image_size, padding=4),
                transforms.RandomHorizontalFlip(),
                transforms.ToTensor(),
                transforms.Normalize([0.4914, 0.4822, 0.4465],
                                     [0.2470, 0.2435, 0.2616]),
            ]),
            lambda x: x,
        )
    )

    # Use nodesplitter for proper distributed partitioning
    dataset = dataset.compose(wds.filters.slice(rank, world_size))

    loader = wds.WebLoader(
        dataset,
        batch_size=batch_size,
        num_workers=num_workers,
        pin_memory=True,
        persistent_workers=True,
    )

    return loader
```

---

## 3. Profiling and Benchmarking

### 3.1 Throughput Benchmarking

The most important metric: can the data pipeline deliver data faster than the GPU can consume it?

```python
import time
import numpy as np

def benchmark_pipeline(loader, num_batches: int = 200, warmup: int = 10):
    """Measure data loading throughput."""
    batch_times = []
    total_samples = 0

    for i, batch in enumerate(loader):
        if i == 0:
            start_time = time.perf_counter()

        if i < warmup:
            continue

        batch_start = time.perf_counter()

        # Simulate GPU transfer
        if isinstance(batch, (tuple, list)):
            images = batch[0]
            if torch.cuda.is_available():
                images = images.cuda(non_blocking=True)
            batch_size = images.shape[0]
        else:
            batch_size = batch.shape[0]

        batch_times.append(time.perf_counter() - batch_start)
        total_samples += batch_size

        if i >= warmup + num_batches:
            break

    elapsed = time.perf_counter() - start_time
    throughput = total_samples / elapsed

    print(f"Throughput: {throughput:.0f} samples/sec")
    print(f"Mean batch time: {np.mean(batch_times)*1000:.2f} ms")
    print(f"P50 batch time:  {np.percentile(batch_times, 50)*1000:.2f} ms")
    print(f"P99 batch time:  {np.percentile(batch_times, 99)*1000:.2f} ms")
    print(f"Total samples:   {total_samples}")
    print(f"Total time:      {elapsed:.2f} s")

    return throughput, batch_times

# Test with different configurations
configs = [
    {"num_workers": 0, "shuffle_buffer": 1000},
    {"num_workers": 2, "shuffle_buffer": 1000},
    {"num_workers": 4, "shuffle_buffer": 1000},
    {"num_workers": 8, "shuffle_buffer": 1000},
    {"num_workers": 4, "shuffle_buffer": 100},
    {"num_workers": 4, "shuffle_buffer": 10000},
]

results = {}
for config in configs:
    print(f"\n{'='*60}")
    print(f"Config: {config}")
    print(f"{'='*60}")
    loader = build_training_pipeline(
        "cifar10_shards",
        batch_size=256,
        **config,
    )
    throughput, times = benchmark_pipeline(loader)
    results[str(config)] = throughput
```

### 3.2 Identifying the Bottleneck

```python
def diagnose_bottleneck(shard_dir: str, batch_size: int = 256):
    """Isolate the bottleneck in the data pipeline."""

    shard_paths = sorted(Path(shard_dir).glob("shard-*.tar"))
    shard_urls = [str(p) for p in shard_paths]

    # Test 1: Raw I/O throughput (read bytes, no decode)
    print("Test 1: Raw I/O throughput")
    start = time.perf_counter()
    total_bytes = 0
    for shard_url in shard_urls[:3]:  # test on first 3 shards
        with open(shard_url, "rb") as f:
            while True:
                chunk = f.read(1 << 20)  # 1 MB chunks
                if not chunk:
                    break
                total_bytes += len(chunk)
    elapsed = time.perf_counter() - start
    print(f"  I/O: {total_bytes / elapsed / 1e9:.2f} GB/s")

    # Test 2: Decode throughput (read + decode, no transform)
    print("\nTest 2: Decode throughput")
    dataset = (
        wds.WebDataset(shard_urls[:3])
        .decode("pil")
        .to_tuple("jpg", "cls")
    )
    start = time.perf_counter()
    count = 0
    for img, cls in dataset:
        count += 1
    elapsed = time.perf_counter() - start
    print(f"  Decode: {count / elapsed:.0f} samples/s")

    # Test 3: Decode + transform throughput
    print("\nTest 3: Decode + transform throughput")
    transform = transforms.Compose([
        transforms.RandomCrop(32, padding=4),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize([0.4914, 0.4822, 0.4465],
                             [0.2470, 0.2435, 0.2616]),
    ])
    dataset = (
        wds.WebDataset(shard_urls[:3])
        .decode("pil")
        .to_tuple("jpg", "cls")
        .map_tuple(transform, lambda x: x)
    )
    start = time.perf_counter()
    count = 0
    for img, cls in dataset:
        count += 1
    elapsed = time.perf_counter() - start
    print(f"  Decode + transform: {count / elapsed:.0f} samples/s")

    # Test 4: Full pipeline with batching
    print("\nTest 4: Full pipeline with batching")
    loader = build_training_pipeline(shard_dir, batch_size=batch_size, num_workers=4)
    throughput, _ = benchmark_pipeline(loader, num_batches=100)

diagnose_bottleneck("cifar10_shards")
```

### 3.3 PyTorch Profiler Integration

```python
from torch.profiler import profile, ProfilerActivity, schedule, tensorboard_trace_handler

def profile_training_loop(model, loader, device, num_steps: int = 20):
    """Profile the training loop including data loading."""
    criterion = torch.nn.CrossEntropyLoss()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.1, momentum=0.9)

    with profile(
        activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
        schedule=schedule(wait=2, warmup=3, active=10, repeat=1),
        on_trace_ready=tensorboard_trace_handler("./profiler_output"),
        record_shapes=True,
        profile_memory=True,
        with_stack=True,
    ) as prof:
        for step, (images, labels) in enumerate(loader):
            if step >= num_steps:
                break

            images = images.to(device, non_blocking=True)
            labels = labels.to(device, non_blocking=True)

            output = model(images)
            loss = criterion(output, labels)
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()

            prof.step()

    print("Profile saved to ./profiler_output/")
    print("View with: tensorboard --logdir=./profiler_output")

    # Print summary
    print(prof.key_averages().table(sort_by="cpu_time_total", row_limit=20))
```

---

## 4. Advanced: Text Data Pipeline

### 4.1 Tokenized Text Shards

For text training, we often pre-tokenize and pack sequences:

```python
from transformers import AutoTokenizer
import numpy as np

def create_text_shards(
    input_files: list[str],
    output_dir: str,
    tokenizer_name: str = "gpt2",
    seq_len: int = 1024,
    shard_size: int = 100_000,  # sequences per shard
):
    """Create pre-tokenized text shards for LLM training."""
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)
    os.makedirs(output_dir, exist_ok=True)

    all_tokens = []
    shard_idx = 0

    for input_file in tqdm(input_files, desc="Processing files"):
        with open(input_file, "r") as f:
            for line in f:
                text = line.strip()
                if not text:
                    continue
                tokens = tokenizer.encode(text)
                all_tokens.extend(tokens)
                all_tokens.append(tokenizer.eos_token_id)

                # Write shard when we have enough tokens
                while len(all_tokens) >= shard_size * seq_len:
                    shard_tokens = all_tokens[:shard_size * seq_len]
                    all_tokens = all_tokens[shard_size * seq_len:]

                    # Reshape into sequences
                    shard_array = np.array(shard_tokens, dtype=np.uint16)
                    shard_array = shard_array.reshape(shard_size, seq_len)

                    # Save as numpy binary
                    output_path = os.path.join(output_dir, f"shard-{shard_idx:05d}.npy")
                    np.save(output_path, shard_array)
                    print(f"Wrote {output_path}: {shard_array.shape}")
                    shard_idx += 1

    # Write remaining tokens (partial shard)
    if len(all_tokens) >= seq_len:
        n_seqs = len(all_tokens) // seq_len
        shard_tokens = all_tokens[:n_seqs * seq_len]
        shard_array = np.array(shard_tokens, dtype=np.uint16).reshape(n_seqs, seq_len)
        output_path = os.path.join(output_dir, f"shard-{shard_idx:05d}.npy")
        np.save(output_path, shard_array)
        print(f"Wrote {output_path}: {shard_array.shape}")

    print(f"\nTotal shards: {shard_idx + 1}")

class TokenizedTextDataset(torch.utils.data.IterableDataset):
    """Streaming dataset for pre-tokenized text shards."""

    def __init__(self, shard_dir: str, seq_len: int = 1024,
                 shuffle_shards: bool = True, seed: int = 42):
        self.shard_paths = sorted(Path(shard_dir).glob("shard-*.npy"))
        self.seq_len = seq_len
        self.shuffle_shards = shuffle_shards
        self.seed = seed

    def __iter__(self):
        worker_info = torch.utils.data.get_worker_info()

        # Partition shards across workers
        if worker_info is not None:
            shards = self.shard_paths[worker_info.id::worker_info.num_workers]
        else:
            shards = self.shard_paths

        if self.shuffle_shards:
            rng = random.Random(self.seed)
            shards = list(shards)
            rng.shuffle(shards)

        for shard_path in shards:
            data = np.load(shard_path)  # (num_seqs, seq_len)
            indices = list(range(len(data)))
            random.shuffle(indices)

            for idx in indices:
                tokens = torch.tensor(data[idx], dtype=torch.long)
                yield {
                    "input_ids": tokens[:-1],     # (seq_len - 1,)
                    "labels": tokens[1:],          # (seq_len - 1,)
                }

# Usage
text_dataset = TokenizedTextDataset("text_shards", seq_len=1024)
text_loader = torch.utils.data.DataLoader(
    text_dataset,
    batch_size=32,
    num_workers=4,
    pin_memory=True,
    persistent_workers=True,
)

for batch in text_loader:
    print(f"input_ids: {batch['input_ids'].shape}")
    print(f"labels: {batch['labels'].shape}")
    break
```

---

## 5. Optimization Exercises

### Exercise 1: Worker Scaling

Measure throughput as a function of `num_workers` for the image pipeline. Plot throughput vs. num_workers and identify the saturation point. What is the limiting factor after saturation?

### Exercise 2: Shuffle Buffer Analysis

Create a synthetic dataset where samples are sorted by class (all class 0, then all class 1, etc.). Measure the class distribution within each batch for shuffle buffer sizes of 100, 1000, 10000, and 50000. At what buffer size does the per-batch class distribution become approximately uniform?

### Exercise 3: Format Comparison

Convert the same dataset to three formats: (a) individual files, (b) WebDataset tar shards, (c) numpy arrays. Benchmark the training throughput for each. Report the results in a table:

| Format | Throughput (samples/s) | Storage Size | Num Files |
|--------|----------------------|--------------|-----------|
| Individual files | | | |
| WebDataset | | | |
| NumPy shards | | | |

### Exercise 4: End-to-End Optimization

Starting from the naive pipeline (num_workers=0, no pin_memory, no persistent_workers, individual files), apply optimizations one at a time and measure the cumulative speedup:

1. Add `num_workers=4`
2. Add `pin_memory=True`
3. Add `persistent_workers=True`
4. Switch to WebDataset format
5. Add shuffle buffer
6. Increase `num_workers` to saturation

Report the throughput after each step.

---

## 6. Putting It All Together

### Complete Working Example

```python
"""
Complete data pipeline example that ties together all components.
Run this script to verify your setup works end-to-end.
"""

import torch
import torch.nn as nn
import torchvision
from torchvision import transforms
from pathlib import Path
import webdataset as wds
import time
import os

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Step 1: Prepare data (download CIFAR-10 and create shards)
    shard_dir = "cifar10_wds"
    if not Path(shard_dir).exists():
        print("Creating WebDataset shards from CIFAR-10...")
        raw_dir = "cifar10_raw_temp"
        export_cifar10(raw_dir)
        create_shards(raw_dir, shard_dir, max_shard_size=50_000_000)

    # Step 2: Build pipeline
    loader = build_training_pipeline(
        shard_dir,
        batch_size=128,
        num_workers=4,
        shuffle_buffer=5000,
    )

    # Step 3: Create a simple model
    model = torchvision.models.resnet18(num_classes=10)
    model = model.to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.1, momentum=0.9,
                                weight_decay=1e-4)

    # Step 4: Training loop with timing
    model.train()
    step_times = []
    data_times = []

    num_steps = 100
    data_start = time.perf_counter()

    for step, (images, labels) in enumerate(loader):
        data_time = time.perf_counter() - data_start
        data_times.append(data_time)

        step_start = time.perf_counter()

        images = images.to(device, non_blocking=True)
        labels = labels.to(device, non_blocking=True)

        output = model(images)
        loss = criterion(output, labels)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()

        if device.type == "cuda":
            torch.cuda.synchronize()

        step_time = time.perf_counter() - step_start
        step_times.append(step_time)

        if step % 20 == 0:
            print(f"Step {step}: loss={loss.item():.4f}, "
                  f"step_time={step_time*1000:.1f}ms, "
                  f"data_time={data_time*1000:.1f}ms")

        if step >= num_steps:
            break

        data_start = time.perf_counter()

    # Step 5: Report
    import numpy as np
    print(f"\n{'='*60}")
    print(f"Pipeline Performance Report")
    print(f"{'='*60}")
    print(f"Step time  - Mean: {np.mean(step_times[5:])*1000:.1f}ms, "
          f"P99: {np.percentile(step_times[5:], 99)*1000:.1f}ms")
    print(f"Data time  - Mean: {np.mean(data_times[5:])*1000:.1f}ms, "
          f"P99: {np.percentile(data_times[5:], 99)*1000:.1f}ms")
    data_frac = np.mean(data_times[5:]) / (np.mean(data_times[5:]) + np.mean(step_times[5:]))
    print(f"Data fraction of total time: {data_frac:.1%}")
    if data_frac > 0.2:
        print("WARNING: Data loading is a significant bottleneck!")
        print("Consider: more workers, faster storage, DALI, or format optimization.")
    else:
        print("OK: Pipeline is compute-bound (data loading is not the bottleneck).")

if __name__ == "__main__":
    main()
```

---

## Reference: Key WebDataset API

| Operation | Description | Example |
|-----------|-------------|---------|
| `WebDataset(urls)` | Create streaming dataset from tar URLs | `wds.WebDataset("shards-{000..099}.tar")` |
| `.shuffle(n)` | Shuffle with buffer of size n | `.shuffle(5000)` |
| `.decode("pil")` | Decode image bytes to PIL images | `.decode("pil")` |
| `.to_tuple(...)` | Extract fields as tuple | `.to_tuple("jpg", "cls")` |
| `.map(fn)` | Apply function to each sample dict | `.map(preprocess)` |
| `.map_tuple(fn1, fn2)` | Apply functions to tuple elements | `.map_tuple(img_tfm, id)` |
| `.batched(n)` | Batch n samples | `.batched(256)` |
| `WebLoader(dataset)` | Multi-process loader wrapper | `wds.WebLoader(ds, num_workers=4)` |
| `ShardWriter(pattern)` | Write samples to sharded tars | `wds.ShardWriter("shard-%05d.tar")` |
