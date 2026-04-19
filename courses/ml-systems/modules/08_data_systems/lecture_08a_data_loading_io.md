# Lecture 08a: Data Loading, Preprocessing Pipelines, and I/O Bottlenecks

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Analyze** the CPU--GPU data pipeline and identify where I/O bottlenecks arise in training workloads using roofline-style reasoning.
2. **Design** efficient PyTorch `DataLoader` configurations by reasoning about `num_workers`, `pin_memory`, `persistent_workers`, and `prefetch_factor` tradeoffs.
3. **Compare** `tf.data` pipeline operators (`map`, `batch`, `prefetch`, `interleave`) with PyTorch equivalents and articulate the design philosophy differences.
4. **Evaluate** data storage formats (TFRecord, WebDataset, Parquet, Arrow, MDS) in terms of sequential read throughput, random access cost, compression, and suitability for distributed training.
5. **Apply** advanced I/O optimization techniques including memory-mapped files, asynchronous I/O, and GPU-accelerated preprocessing with NVIDIA DALI to eliminate data stalls.

---

## 2. Motivation and Context

### 2.1 The Hidden Bottleneck

Modern accelerators (A100, H100, TPUv5) can sustain hundreds of teraflops of compute. An H100 SXM delivers 989 TFLOPS of BF16 tensor operations. Yet in many production training runs, GPUs sit idle 10--40% of the time waiting for the next batch of data. This data stall problem is the single most common reason that expensive GPU clusters underperform their theoretical throughput.

The root cause is a fundamental asymmetry: GPU compute has scaled roughly 1000x over the past decade (K80 to H100), while storage and network bandwidth have scaled only 10--50x. A single NVMe SSD delivers ~7 GB/s sequential read; an H100's HBM3 bandwidth is 3.35 TB/s --- a 478x gap. The data pipeline must bridge this chasm through parallelism, prefetching, caching, and format optimization.

### 2.2 Why This Matters for ML Systems Engineers

- **Training cost**: A 1000-GPU training run at $2/GPU-hour costs $48,000/day. A 20% data stall wastes $9,600/day.
- **Scaling laws**: Chinchilla-optimal training requires processing vast token counts (e.g., 2T tokens for a 70B model). Data throughput directly constrains how fast you can train.
- **Reproducibility**: Nondeterministic data loading order can cause subtle reproducibility failures in distributed settings.
- **Multimodal models**: Image-text, video-text, and audio-text training dramatically increase per-sample I/O cost.

### 2.3 Scope

This lecture focuses on the systems engineering of getting data from storage to the accelerator. We treat the data as already prepared (curation and quality filtering are covered in Lecture 08c). Our goal is to maximize the sustained throughput of the data pipeline so that it never becomes the bottleneck.

---

## 3. The CPU--GPU Data Pipeline

### 3.1 Pipeline Stages

A typical training data pipeline consists of five stages, each with distinct compute and memory characteristics:

```
Storage --> Read --> Decode/Decompress --> Transform/Augment --> Transfer --> GPU
 (disk)   (CPU)        (CPU)                 (CPU/GPU)        (PCIe/NVLink)
```

**Stage 1: Storage Read.** Raw bytes are read from disk (local NVMe, networked filesystem like Lustre/GPFS, or object storage like S3). The critical metric is sequential read bandwidth. Random reads to spinning disks or high-latency object stores can be 100--1000x slower than sequential reads.

**Stage 2: Decode/Decompress.** For images, this means JPEG/PNG decoding. For text, this may involve decompression (zstd, gzip) of serialized records. JPEG decoding is surprisingly expensive: a single-threaded libjpeg decode of a 224x224 image takes ~1ms, limiting throughput to ~1000 images/s/core.

**Stage 3: Transform/Augment.** Random crops, flips, color jitter, normalization for images. Tokenization, padding, masking for text. Some transforms (random resized crop) are computationally expensive.

**Stage 4: Collation and Transfer.** Samples are collated into batches, tensors are allocated in pinned (page-locked) memory, and DMA transfers move them to GPU memory over PCIe or NVLink.

**Stage 5: GPU Consumption.** The forward and backward pass consume the batch. The pipeline must have the next batch ready by the time the current step completes.

### 3.2 Pipeline Analysis: Where Is the Bottleneck?

Let $T_{\text{read}}$, $T_{\text{decode}}$, $T_{\text{transform}}$, $T_{\text{transfer}}$, $T_{\text{gpu}}$ denote the per-batch times for each stage. Without pipelining, the per-step time is:

$$T_{\text{step}} = T_{\text{read}} + T_{\text{decode}} + T_{\text{transform}} + T_{\text{transfer}} + T_{\text{gpu}}$$

With perfect pipelining (all stages overlap), the per-step time is:

$$T_{\text{step}} = \max(T_{\text{read}}, T_{\text{decode}}, T_{\text{transform}}, T_{\text{transfer}}, T_{\text{gpu}})$$

The pipeline is **data-bound** when $\max(T_{\text{read}}, T_{\text{decode}}, T_{\text{transform}}, T_{\text{transfer}}) > T_{\text{gpu}}$ and **compute-bound** when $T_{\text{gpu}}$ dominates. The goal of data pipeline engineering is to ensure the system is always compute-bound.

### 3.3 Concrete Example: ImageNet Training

Consider training a ResNet-50 on ImageNet with batch size 256 on a single A100:

| Stage | Per-Batch Time | Notes |
|-------|---------------|-------|
| Read (NVMe) | ~2 ms | 256 images x ~140 KB = 35 MB at 7 GB/s |
| JPEG Decode | ~60 ms | 256 images / 4 workers = 64 images/worker, ~1ms each |
| Augmentation | ~15 ms | RandomResizedCrop + flip + normalize |
| Transfer | ~0.5 ms | 256 x 3 x 224 x 224 x 4B = 154 MB at ~25 GB/s PCIe Gen4 |
| GPU (fwd+bwd) | ~45 ms | A100 with mixed precision |

Without parallelism, $T_{\text{step}} \approx 123$ ms. The decode stage dominates. With 8 workers and prefetching, decode and transform overlap with GPU compute, and the pipeline becomes compute-bound at ~45 ms/step.

---

## 4. PyTorch DataLoader: Mechanics and Tuning

### 4.1 Architecture

The PyTorch `DataLoader` orchestrates multi-process data loading:

```python
from torch.utils.data import DataLoader, Dataset

loader = DataLoader(
    dataset,
    batch_size=256,
    shuffle=True,
    num_workers=8,
    pin_memory=True,
    persistent_workers=True,
    prefetch_factor=2,
    drop_last=True,
)
```

**Internal architecture:**

1. The main process maintains an index queue and a result queue (backed by shared memory).
2. Each worker process has its own copy of the `Dataset` object and runs in a loop: fetch index from queue, call `dataset[index]`, serialize result to shared memory, signal main process.
3. The main process collates results into batches and optionally copies them to pinned memory.
4. A prefetch thread (in the main process) keeps `prefetch_factor * num_workers` batches ready.

### 4.2 Key Parameters

**`num_workers`**: Controls CPU parallelism for data loading. Setting this too low causes data stalls; too high wastes CPU resources and memory. A good heuristic:

$$\texttt{num\_workers} \approx \min\!\left(\frac{T_{\text{cpu\_per\_batch}}}{T_{\text{gpu\_per\_batch}}}, \; \texttt{cpu\_cores\_per\_gpu}\right)$$

On a DGX-H100 (8 GPUs, 128 CPU cores), you have ~16 cores per GPU. If CPU preprocessing takes 4x longer than GPU compute, you need at least 4 workers.

**`pin_memory`**: Allocates tensors in page-locked (pinned) host memory, enabling asynchronous DMA transfers to GPU via `cuda.memcpyAsync`. Without pinned memory, the transfer requires an extra copy from pageable to pinned memory inside the CUDA runtime. Always set to `True` when training on GPU.

```python
# What pin_memory=True does internally:
# Instead of: tensor.to(device)  (synchronous, involves pageable->pinned copy)
# It enables: tensor.to(device, non_blocking=True)  (async DMA from pre-pinned memory)
```

**`persistent_workers`**: When `True`, worker processes are kept alive across epochs. This avoids the overhead of forking new processes (which includes re-initializing Dataset objects, re-loading shared libraries, and re-establishing file handles). On datasets with expensive `__init__` (e.g., opening memory-mapped files, connecting to databases), this can save 10--30 seconds per epoch.

**`prefetch_factor`**: Number of batches each worker pre-fetches. Default is 2. Increasing this smooths out variance in per-sample processing time at the cost of memory. For datasets with high variance in sample size (e.g., variable-length sequences), increasing to 3--4 can help.

### 4.3 Common Pitfalls

**Pitfall 1: GIL contention in `collate_fn`.** The collation happens in the main process under the GIL. If your `collate_fn` does heavy Python work (e.g., padding variable-length sequences), it serializes everything. Solution: move padding into the worker's `__getitem__` or use a C++/Cython collator.

**Pitfall 2: Shared memory exhaustion.** Each worker holds `prefetch_factor` batches in shared memory (`/dev/shm`). With 16 workers, prefetch_factor=2, and 1 GB batches, you need 32 GB of `/dev/shm`. Docker containers often default to 64 MB. Fix: `docker run --shm-size=64g` or `--ipc=host`.

**Pitfall 3: Fork vs. spawn.** The default `fork` start method copies the parent process's memory. If the parent has large objects (e.g., a loaded dataset index), each worker duplicates it via copy-on-write. On Linux this is usually fine, but on macOS or with certain libraries (OpenCV, some CUDA contexts), `fork` causes deadlocks. Use `mp.set_start_method('spawn')` when necessary, but note that `spawn` is slower to start.

**Pitfall 4: Non-determinism in shuffling.** With multiple workers, the order in which workers complete is nondeterministic. For reproducibility, set `worker_init_fn` with deterministic seeds:

```python
def worker_init_fn(worker_id):
    seed = torch.initial_seed() % 2**32
    np.random.seed(seed + worker_id)
    random.seed(seed + worker_id)

loader = DataLoader(dataset, ..., worker_init_fn=worker_init_fn)
```

### 4.4 IterableDataset for Streaming

For datasets too large to index (web-scale text corpora, streaming data), PyTorch provides `IterableDataset`:

```python
class ShardedTextDataset(torch.utils.data.IterableDataset):
    def __init__(self, shard_paths: list[str], tokenizer, seq_len: int):
        self.shard_paths = shard_paths
        self.tokenizer = tokenizer
        self.seq_len = seq_len

    def __iter__(self):
        worker_info = torch.utils.data.get_worker_info()
        if worker_info is None:
            shards = self.shard_paths
        else:
            # Partition shards across workers
            per_worker = len(self.shard_paths) // worker_info.num_workers
            start = worker_info.id * per_worker
            shards = self.shard_paths[start:start + per_worker]

        for shard_path in shards:
            with open(shard_path, 'rb') as f:
                for line in f:
                    tokens = self.tokenizer.encode(line.decode('utf-8'))
                    # Yield fixed-length chunks
                    for i in range(0, len(tokens) - self.seq_len, self.seq_len):
                        yield torch.tensor(tokens[i:i + self.seq_len], dtype=torch.long)
```

Key design consideration: each worker must process a disjoint set of shards to avoid duplicate data. In distributed training, shards must be partitioned across both workers and ranks.

---

## 5. tf.data: A Declarative Pipeline API

### 5.1 Design Philosophy

Unlike PyTorch's imperative `DataLoader`, `tf.data` provides a declarative pipeline DSL. You compose transformations as a directed graph, and the runtime optimizes execution (auto-tuning parallelism, fusing operations, reordering stages).

### 5.2 Core Operators

```python
import tensorflow as tf

dataset = tf.data.TFRecordDataset(
    filenames,
    num_parallel_reads=tf.data.AUTOTUNE,  # parallel file reads
)
dataset = dataset.shuffle(buffer_size=10000)
dataset = dataset.map(
    parse_and_augment,
    num_parallel_calls=tf.data.AUTOTUNE,  # parallel map
    deterministic=False,                   # allow out-of-order for speed
)
dataset = dataset.batch(256)
dataset = dataset.prefetch(tf.data.AUTOTUNE)  # overlap with accelerator
```

**`interleave`**: Reads from multiple files simultaneously, interleaving records. Critical for avoiding I/O stalls when reading from slow storage:

```python
dataset = tf.data.Dataset.from_tensor_slices(filenames)
dataset = dataset.interleave(
    lambda f: tf.data.TFRecordDataset(f),
    cycle_length=16,          # read from 16 files simultaneously
    num_parallel_calls=tf.data.AUTOTUNE,
    deterministic=False,
)
```

**`AUTOTUNE`**: The tf.data runtime dynamically adjusts parallelism based on measured throughput. It profiles each stage and allocates resources to the bottleneck. This is analogous to auto-tuning in database query optimizers.

### 5.3 tf.data Service (Distributed Data Loading)

For large-scale training, tf.data supports a distributed data service where dedicated CPU-only machines run the data pipeline and serve batches to TPU/GPU workers over the network. This decouples data preprocessing from training compute, allowing independent scaling of each resource.

```
[Data Workers]     -->  [Network]  -->  [Training Workers]
 CPU-heavy                              GPU/TPU-heavy
 Read + Decode +                        Forward + Backward
 Transform + Batch
```

This architecture is particularly valuable for TPU pods, where host CPUs are relatively weak compared to the TPU cores they serve.

### 5.4 PyTorch vs. tf.data: Comparative Analysis

| Aspect | PyTorch DataLoader | tf.data |
|--------|-------------------|---------|
| Paradigm | Imperative (Python loops) | Declarative (functional graph) |
| Parallelism | Manual (`num_workers`) | Auto-tuned (`AUTOTUNE`) |
| Determinism | Deterministic by default | Non-deterministic by default |
| Debugging | Standard Python debugging | Harder (graph execution) |
| Custom ops | Any Python code | Must be TF-compatible |
| Distributed | Manual shard partitioning | Built-in `tf.data.service` |
| Memory control | `/dev/shm`, pinned memory | Managed by runtime |

---

## 6. Efficient Data Formats

### 6.1 The Format Landscape

The choice of on-disk data format profoundly affects I/O throughput. Key dimensions:

- **Sequential vs. random access**: Training typically needs sequential access with global shuffling.
- **Compression**: Reduces storage and I/O bandwidth at the cost of CPU decompression.
- **Splittability**: Can the format be split across workers without reading the entire file?
- **Schema evolution**: Can you add fields without rewriting the entire dataset?

### 6.2 TFRecord

TFRecord is TensorFlow's native format: a sequence of length-prefixed, CRC-checksummed protocol buffer records.

```
[length (8 bytes)][crc of length (4 bytes)][data (length bytes)][crc of data (4 bytes)]
```

**Strengths**: Simple, sequential, streamable, supports compression (gzip, zlib). Widely used in Google's infrastructure.

**Weaknesses**: No random access (must scan from beginning). No schema --- records are opaque byte strings. No columnar access (must deserialize entire record even if you need one field).

### 6.3 WebDataset

WebDataset (developed by NVIDIA) stores samples as tar archives, where each sample is a group of files sharing a common prefix:

```
sample000000.jpg
sample000000.json
sample000000.cls
sample000001.jpg
sample000001.json
sample000001.cls
...
```

```python
import webdataset as wds

dataset = (
    wds.WebDataset("data-{000000..000099}.tar")
    .shuffle(1000)
    .decode("pil")           # decode images as PIL
    .to_tuple("jpg", "cls")  # extract image and class
    .map_tuple(transform, identity)
    .batched(256)
)
```

**Strengths**: Based on the POSIX tar format --- universally supported, trivially streamable from HTTP/S3/GCS. Excellent for distributed training because each shard is an independent tar file. Natural sample grouping (all modalities of a sample are adjacent).

**Weaknesses**: No random access within a tar. Shuffling requires a buffer (see Lecture 08d). Slight overhead from tar headers (~512 bytes per file).

### 6.4 Apache Parquet and Arrow

**Parquet** is a columnar storage format from the Hadoop ecosystem. Data is organized by column, then split into row groups:

```
[Row Group 0]
  [Column: image_bytes]  [Column: label]  [Column: caption]
[Row Group 1]
  [Column: image_bytes]  [Column: label]  [Column: caption]
```

**Strengths**: Columnar access (read only the columns you need), built-in statistics (min/max per column chunk for predicate pushdown), excellent compression (dictionary encoding, run-length encoding, delta encoding). Row groups enable parallel reads.

**Arrow** is an in-memory columnar format designed for zero-copy reads. HuggingFace Datasets uses Arrow as its backend, enabling memory-mapped access to datasets that exceed RAM:

```python
from datasets import load_dataset

# Data is memory-mapped from Arrow files on disk
# Only the accessed rows/columns are loaded into RAM
dataset = load_dataset("wikipedia", "20220301.en", split="train")
print(dataset[42]["text"])  # Only loads row 42's "text" column
```

### 6.5 Mosaic Data Shard (MDS) Format

MDS (from MosaicML/Databricks) is designed specifically for ML training. It combines the strengths of sequential formats (high throughput) with random access via a lightweight index:

```
shard.00000.mds    # data file (sequential records)
shard.00000.index  # index file (offset table)
```

Key design decisions:
- Deterministic, resumable shuffling via a permutation-based algorithm
- Built-in support for elastic distributed training (workers can join/leave)
- Streaming from object storage with local caching
- Sample-level random access via the index

### 6.6 Format Comparison

| Format | Seq. Read | Random Access | Columnar | Compression | Sharding | ML Ecosystem |
|--------|-----------|---------------|----------|-------------|----------|-------------|
| TFRecord | Excellent | None | No | gzip/zlib | Manual | TensorFlow |
| WebDataset | Excellent | None | No | Per-file | Natural (tar) | PyTorch |
| Parquet | Good | Row-group level | Yes | Excellent | Row groups | HuggingFace, Spark |
| Arrow | Excellent (mmap) | Row-level | Yes | Optional | Via sharding | HuggingFace |
| MDS | Excellent | Sample-level | No | zstd/snappy | Built-in | MosaicML |
| Petastorm | Good | Row-group | Yes | Parquet-based | Row groups | Uber |

---

## 7. I/O Optimization Techniques

### 7.1 Memory-Mapped Files

Memory mapping (`mmap`) maps file contents directly into the process's virtual address space. Reads become pointer dereferences, and the OS manages page faults and caching transparently.

```python
import mmap
import numpy as np

# Memory-map a large binary file of float32 arrays
with open("embeddings.bin", "r+b") as f:
    mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
    # Interpret as numpy array without copying
    embeddings = np.frombuffer(mm, dtype=np.float32).reshape(-1, 768)
    # Accessing embeddings[42] triggers a page fault only for that page
    sample = embeddings[42]  # ~4KB page read, not the entire file
```

**When to use mmap**: Datasets that fit on local storage, where random access is needed, and the working set (accessed portion) fits in RAM. The OS page cache handles LRU eviction automatically.

**When to avoid mmap**: When training accesses data purely sequentially (sequential `read()` with `readahead` is faster because the kernel can prefetch aggressively). Also avoid over NFS/Lustre where page faults have high latency.

### 7.2 Asynchronous I/O

Linux `io_uring` (kernel 5.1+) provides a high-performance async I/O interface. Instead of blocking on each read, you submit a batch of read requests and poll for completions:

```python
# Conceptual example using io_uring via Python wrapper
import liburing

ring = liburing.IoUring(queue_depth=256)

# Submit 256 read requests simultaneously
for i in range(256):
    sqe = ring.get_sqe()
    sqe.prep_read(fd, buffers[i], size, offsets[i])
ring.submit()

# Wait for all completions
for i in range(256):
    cqe = ring.wait_cqe()
    process(cqe)
    ring.cqe_seen(cqe)
```

In practice, most ML practitioners use higher-level abstractions (e.g., `aiofiles`, `fsspec`) rather than raw `io_uring`, but understanding the underlying mechanism is important for performance debugging.

### 7.3 OS-Level Tuning

Several OS-level parameters significantly affect I/O performance:

```bash
# Increase readahead buffer (default 128KB, increase for sequential workloads)
sudo blockdev --setra 4096 /dev/nvme0n1  # 2MB readahead

# Increase page cache pressure (keep more file pages in memory)
echo 10 | sudo tee /proc/sys/vm/vfs_cache_pressure

# Use deadline or mq-deadline I/O scheduler for NVMe
echo mq-deadline | sudo tee /sys/block/nvme0n1/queue/scheduler

# Increase number of in-flight I/O requests
echo 256 | sudo tee /sys/block/nvme0n1/queue/nr_requests
```

### 7.4 NVIDIA DALI: GPU-Accelerated Data Loading

DALI (Data Loading Library) offloads decode and augmentation to the GPU, freeing CPU cores for other work:

```python
from nvidia.dali import pipeline_def, fn, types
from nvidia.dali.plugin.pytorch import DALIGenericIterator

@pipeline_def(batch_size=256, num_threads=4, device_id=0)
def training_pipeline():
    jpegs, labels = fn.readers.file(
        file_root="imagenet/train",
        random_shuffle=True,
        name="Reader",
    )
    # GPU-accelerated JPEG decode
    images = fn.decoders.image(
        jpegs,
        device="mixed",       # decode on GPU
        output_type=types.RGB,
    )
    # GPU-accelerated augmentation
    images = fn.random_resized_crop(
        images,
        size=(224, 224),
        device="gpu",
    )
    images = fn.crop_mirror_normalize(
        images,
        device="gpu",
        dtype=types.FLOAT,
        mean=[0.485 * 255, 0.456 * 255, 0.406 * 255],
        std=[0.229 * 255, 0.224 * 255, 0.225 * 255],
        mirror=fn.random.coin_flip(probability=0.5),
    )
    return images, labels

pipe = training_pipeline()
loader = DALIGenericIterator(pipe, ["images", "labels"], reader_name="Reader")

for batch in loader:
    images = batch[0]["images"]  # Already on GPU, no transfer needed
    labels = batch[0]["labels"]
```

**Performance impact**: DALI can improve ImageNet training throughput by 2--4x on systems where CPU is the bottleneck. The GPU JPEG decoder (nvJPEG) achieves ~5,000--7,000 images/s on an A100, compared to ~1,000 images/s per CPU core with libjpeg-turbo.

**Limitations**: DALI's transform library is more limited than torchvision/albumentations. Custom transforms require writing DALI plugins in C++. Not all data types are supported (primarily images and video).

---

## 8. Profiling Data Pipelines

### 8.1 Identifying Data Stalls

The simplest diagnostic: measure the time between `optimizer.step()` calls. If the per-step time varies significantly, you likely have data stalls.

```python
import time

step_times = []
for batch_idx, (data, target) in enumerate(loader):
    start = time.perf_counter()

    data, target = data.cuda(non_blocking=True), target.cuda(non_blocking=True)
    output = model(data)
    loss = criterion(output, target)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()

    torch.cuda.synchronize()
    step_times.append(time.perf_counter() - start)

# Analyze: if std(step_times) > 0.1 * mean(step_times), suspect data stalls
# First few steps are often slow (pipeline warmup)
print(f"Mean: {np.mean(step_times[5:]):.3f}s, Std: {np.std(step_times[5:]):.3f}s")
```

### 8.2 PyTorch Profiler

The built-in profiler traces CPU, GPU, and data loader activity:

```python
from torch.profiler import profile, ProfilerActivity, schedule, tensorboard_trace_handler

with profile(
    activities=[ProfilerActivity.CPU, ProfilerActivity.CUDA],
    schedule=schedule(wait=1, warmup=1, active=3, repeat=1),
    on_trace_ready=tensorboard_trace_handler("./profiler_logs"),
    record_shapes=True,
    with_stack=True,
) as prof:
    for step, (data, target) in enumerate(loader):
        data = data.cuda(non_blocking=True)
        target = target.cuda(non_blocking=True)
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        prof.step()
        if step >= 6:
            break
```

In the TensorBoard trace view, look for:
- **Gaps in the GPU timeline**: Periods where no GPU kernel is running indicate data stalls.
- **Long `aten::copy_`**: Indicates slow host-to-device transfers (forgot `pin_memory=True`?).
- **Long `DataLoader` worker time**: Bottleneck in decode/transform.

### 8.3 Throughput Testing

A systematic approach to finding the bottleneck:

```python
def benchmark_dataloader(loader, num_batches=100):
    """Measure raw data loading throughput (no GPU compute)."""
    start = time.perf_counter()
    for i, batch in enumerate(loader):
        if i >= num_batches:
            break
    elapsed = time.perf_counter() - start
    samples_per_sec = (num_batches * loader.batch_size) / elapsed
    return samples_per_sec

# Test with increasing num_workers to find saturation point
for nw in [0, 1, 2, 4, 8, 16]:
    loader = DataLoader(dataset, batch_size=256, num_workers=nw,
                        pin_memory=True, persistent_workers=(nw > 0))
    throughput = benchmark_dataloader(loader)
    print(f"num_workers={nw:2d}: {throughput:.0f} samples/s")
```

If throughput plateaus well below GPU consumption rate, the bottleneck is in storage I/O (not CPU). If throughput scales linearly with workers, the bottleneck is CPU-bound decode/transform.

### 8.4 The Data Loading Roofline

By analogy with the compute roofline model (Lecture 00c), we can construct a data loading roofline:

- **X-axis**: Computational intensity of preprocessing (FLOPs per byte read from storage).
- **Y-axis**: Achieved sample throughput (samples/s).
- **Ceiling 1 (I/O bound)**: $\text{throughput} = \text{storage\_bandwidth} / \text{bytes\_per\_sample}$.
- **Ceiling 2 (CPU bound)**: $\text{throughput} = \text{cpu\_cores} \times \text{samples\_per\_core\_per\_second}$.
- **Ceiling 3 (GPU demand)**: $\text{throughput} = \text{batch\_size} / T_{\text{gpu}}$.

The pipeline is healthy when ceiling 3 (GPU demand) is the binding constraint.

---

## 9. Case Study: Optimizing a Real Training Pipeline

### 9.1 Scenario

Training a ViT-L/16 on ImageNet-22k:
- 14.2 million images, ~1.3 TB of JPEGs
- Batch size 4096 across 32 A100 GPUs (128 per GPU)
- GPU step time: ~180 ms

### 9.2 Initial Configuration (Naive)

```python
loader = DataLoader(dataset, batch_size=128, shuffle=True, num_workers=4)
```

Problem: `shuffle=True` on a map-style dataset builds a random permutation of 14.2M indices, then accesses files in random order. On a networked filesystem, this creates random I/O patterns with terrible throughput. Measured: ~1200 samples/s (needs ~22,000 samples/s to keep 32 GPUs busy).

### 9.3 Optimization Steps

**Step 1: Convert to WebDataset shards.** Pack images into 1000 tar files (~1.3 GB each). Sequential reads within each shard.

**Step 2: Shard-level shuffling + buffer shuffling.** Shuffle the shard order, then apply a 5000-sample shuffle buffer within each shard. This provides approximate global shuffling with purely sequential I/O.

**Step 3: Increase workers and enable pinned memory.**

```python
loader = wds.WebLoader(dataset, batch_size=None, num_workers=12,
                       pin_memory=True, persistent_workers=True)
```

**Step 4: Use DALI for GPU-accelerated decoding** on the subset of GPUs that are decode-bottlenecked.

**Result**: Throughput increased from 1,200 to 28,000 samples/s. GPU utilization went from 35% to 92%.

---

## Key Takeaways

1. **The data pipeline is the most common bottleneck** in large-scale training. GPU utilization of 30--50% due to data stalls is typical in unoptimized setups.
2. **Pipeline the pipeline**: Overlap storage reads, CPU decode/transform, and GPU compute using multi-worker prefetching.
3. **Format matters**: Sequential formats (WebDataset, TFRecord, MDS) with shard-level parallelism vastly outperform random-access patterns on individual files.
4. **Pin your memory**: `pin_memory=True` enables async DMA transfers that overlap with compute.
5. **Profile before optimizing**: Use PyTorch Profiler or simple timing to identify whether the bottleneck is I/O, CPU, or transfer before investing in optimization.
6. **Consider GPU-accelerated preprocessing**: DALI offloads decode/transform to GPU, freeing CPU for other work and eliminating the CPU bottleneck entirely for image workloads.

---

## Further Reading

1. **Murray, D. G., Simsa, J., Klimovic, A., and Indyk, I.** (2021). "tf.data: A Machine Learning Data Processing Framework." *VLDB 2021.* --- Authoritative description of the tf.data design, including auto-tuning and the distributed data service.

2. **NVIDIA DALI Documentation.** https://docs.nvidia.com/deeplearning/dali/ --- Comprehensive reference for GPU-accelerated data loading.

3. **Li, S., Zhao, Y., et al.** (2023). "MosaicML Streaming: Fast, Deterministic, Elastic Data Loading for ML Training." *arXiv:2303.06994.* --- Design of the MDS format and the Streaming library.

4. **Mohan, J., Phanishayee, A., Raniwala, A., and Chidambaram, V.** (2021). "Analyzing and Mitigating Data Stalls in DNN Training." *VLDB 2021.* --- Systematic study of data stalls in production training pipelines with taxonomy and mitigation strategies.

5. **Agrawal, A. et al.** (2019). "Also, TFRecords?" *arXiv:1907.02218.* --- Comparison of data formats for ML training workloads.

6. **WebDataset Documentation.** https://github.com/webdataset/webdataset --- Reference for the WebDataset format and API.
