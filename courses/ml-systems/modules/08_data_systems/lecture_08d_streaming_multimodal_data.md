# Lecture 08d: Streaming, Tokenization Pipelines, and Multimodal Data

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Design** streaming data pipelines for large-scale pretraining that handle shuffle buffers, distributed shard assignment, and deterministic resumption, analyzing the tradeoff between shuffle quality and memory consumption.
2. **Compare** tokenization algorithms (BPE, Unigram, WordPiece) and their implementations (SentencePiece, HuggingFace Tokenizers), reasoning about vocabulary size, fertility, and encoding efficiency for different languages and domains.
3. **Evaluate** the tradeoffs between pre-tokenization (offline, stored as token IDs) and on-the-fly tokenization (online, stored as raw text) in terms of storage cost, pipeline flexibility, and compute overhead.
4. **Architect** data pipelines for multimodal training (image-text, video-text, audio-text) that handle heterogeneous sample sizes, variable aspect ratios, and cross-modal alignment.
5. **Implement** data mixing strategies and curriculum learning schedules that control the proportion of data sources during pretraining, with awareness of how mixing ratios affect downstream capabilities.

---

## 2. Motivation and Context

### 2.1 Why Streaming?

A Chinchilla-optimal 70B model requires ~1.4 trillion tokens of training data. At ~4 bytes per token (int32 token IDs), this is ~5.6 TB of token data. At ~5 tokens per word and ~5 characters per word, the raw text is ~1.4 TB. With metadata, the full dataset may be 10--50 TB.

This data cannot fit in RAM (even high-memory machines top out at 1--2 TB). It often cannot even fit on local storage of individual training nodes. The data must be **streamed** from distributed storage, processed on-the-fly, and consumed by the training loop without requiring random access to the entire dataset.

### 2.2 The Tokenization Decision

Tokenization is the first transformation applied to raw text, and it is irreversible: information is lost (whitespace normalization, case folding in some tokenizers) and the token vocabulary becomes a fundamental model hyperparameter. Choosing the wrong tokenization strategy can:

- **Waste model capacity**: An English-centric BPE vocabulary spends 3--5x more tokens encoding Chinese, Arabic, or Hindi text than a multilingual-aware vocabulary.
- **Hurt reasoning**: Sub-word boundaries that split meaningful morphemes can degrade performance on tasks requiring character-level understanding (spelling, arithmetic).
- **Lock in decisions**: Changing the tokenizer requires retraining the model from scratch.

### 2.3 The Multimodal Challenge

Modern foundation models consume text, images, video, audio, and structured data simultaneously. Each modality has wildly different characteristics:

| Modality | Sample Size | Sequence Length | Storage per 1B samples |
|----------|-------------|-----------------|----------------------|
| Text (documents) | 1--50 KB | 512--8192 tokens | 1--50 TB |
| Images (224x224 JPEG) | 20--200 KB | 196--1024 patches | 20--200 TB |
| Video (10s clip, 720p) | 5--50 MB | 1K--100K frames | 5--50 PB |
| Audio (30s clip, 16kHz) | 500 KB--2 MB | 1K--10K mel frames | 0.5--2 PB |

Batching heterogeneous samples efficiently is a non-trivial systems challenge.

---

## 3. Streaming Data Pipelines

### 3.1 The Sharded Streaming Architecture

The standard architecture for streaming training data:

```
Object Storage (S3/GCS)
  shard-000000.tar
  shard-000001.tar
  ...
  shard-099999.tar
         |
         v
[Shard Scheduler]  <-- assigns shards to (rank, worker) pairs
         |
    +----+----+----+----+
    |    |    |    |    |
   R0   R1   R2   R3   ...  (ranks = GPUs)
    |    |    |    |    |
  [Download + Decode + Buffer + Shuffle]
    |    |    |    |    |
  [Batch + Collate + Transfer to GPU]
```

Each rank (GPU) is assigned a disjoint subset of shards. Within its assigned shards, data is read sequentially and passed through a shuffle buffer before batching.

### 3.2 Shuffle Buffers

A shuffle buffer is a fixed-size reservoir that produces approximately-random samples from a sequential stream:

```python
import random

class ShuffleBuffer:
    """Reservoir-based shuffle buffer for streaming data."""

    def __init__(self, buffer_size: int):
        self.buffer = []
        self.buffer_size = buffer_size

    def add_and_pop(self, item):
        """Add an item and returns a random item from the buffer.

        When the buffer is full, each add displaces a random item.
        This provides approximate uniform shuffling within a window
        of buffer_size consecutive items.
        """
        self.buffer.append(item)
        if len(self.buffer) >= self.buffer_size:
            idx = random.randint(0, len(self.buffer) - 1)
            yield_item = self.buffer[idx]
            self.buffer[idx] = self.buffer[-1]
            self.buffer.pop()
            return yield_item
        return None

    def flush(self):
        """Yield all remaining items in random order."""
        random.shuffle(self.buffer)
        items = self.buffer
        self.buffer = []
        return items
```

**Shuffle quality analysis**: With a buffer of size $B$ and a dataset of size $N$ read sequentially, each sample's position in the output is approximately uniformly distributed within a window of $B$ positions around its original position. The expected displacement is $O(B)$. For the shuffling to be "good enough," we need $B$ to be large relative to any structure in the data (e.g., if documents from the same domain are stored consecutively, $B$ should be larger than the domain cluster size).

**Practical guidance**: For LLM pretraining with sharded data:
- Shuffle shard order (provides coarse shuffling across the dataset).
- Apply a sample-level shuffle buffer of size 10K--100K within each shard (provides fine shuffling).
- This two-level shuffle approximates global shuffling with $O(B)$ memory instead of $O(N)$.

### 3.3 Deterministic Resumption

Training runs crash. Checkpointing and resumption must reproduce the exact data order:

```python
class DeterministicStreamingDataset:
    """Streaming dataset with deterministic, resumable iteration.

    The key insight: the random state of the shard scheduler and
    shuffle buffer must be saved/restored alongside model checkpoints.
    """

    def __init__(self, shard_paths: list[str], seed: int, rank: int,
                 world_size: int, shuffle_buffer_size: int = 10000):
        self.shard_paths = shard_paths
        self.seed = seed
        self.rank = rank
        self.world_size = world_size
        self.shuffle_buffer_size = shuffle_buffer_size
        self.samples_yielded = 0

    def state_dict(self) -> dict:
        """Save state for checkpointing."""
        return {
            "seed": self.seed,
            "samples_yielded": self.samples_yielded,
            "rng_state": random.getstate(),
        }

    def load_state_dict(self, state: dict):
        """Restore state for resumption."""
        self.seed = state["seed"]
        self.samples_yielded = state["samples_yielded"]
        random.setstate(state["rng_state"])

    def __iter__(self):
        # Deterministic shard assignment
        rng = random.Random(self.seed)
        shuffled_shards = self.shard_paths.copy()
        rng.shuffle(shuffled_shards)

        # Assign shards to this rank
        my_shards = shuffled_shards[self.rank::self.world_size]

        # Skip to the correct position if resuming
        buffer = ShuffleBuffer(self.shuffle_buffer_size)
        count = 0
        for shard_path in my_shards:
            for sample in self._read_shard(shard_path):
                item = buffer.add_and_pop(sample)
                if item is not None:
                    count += 1
                    if count > self.samples_yielded:
                        self.samples_yielded = count
                        yield item

        # Flush remaining buffer
        for item in buffer.flush():
            self.samples_yielded += 1
            yield item
```

**MosaicML Streaming** implements this pattern with additional optimizations: it uses a permutation-based shuffling algorithm that avoids storing the full shuffle buffer state, and supports elastic sharding (adding/removing workers mid-training).

### 3.4 Distributed Shard Assignment

In distributed training, each rank must consume a disjoint partition of the data:

```python
def assign_shards(shard_paths: list[str], rank: int, world_size: int,
                  num_workers: int, worker_id: int, epoch: int) -> list[str]:
    """Deterministically assign shards to a specific (rank, worker) pair.

    Two-level partitioning:
    1. Partition shards across ranks (GPUs).
    2. Partition each rank's shards across its DataLoader workers.
    """
    # Shuffle shards deterministically per epoch
    rng = random.Random(epoch * 1000 + 42)
    shards = shard_paths.copy()
    rng.shuffle(shards)

    # Level 1: assign to rank
    rank_shards = shards[rank::world_size]

    # Level 2: assign to worker within rank
    worker_shards = rank_shards[worker_id::num_workers]

    return worker_shards
```

---

## 4. Tokenization Pipelines

### 4.1 Tokenization Algorithms

**Byte-Pair Encoding (BPE)** (Sennrich et al., 2016):
1. Start with a vocabulary of individual characters (or bytes).
2. Iteratively merge the most frequent adjacent pair into a new token.
3. Repeat until the vocabulary reaches the desired size.

```python
# Simplified BPE training
def train_bpe(corpus: list[str], vocab_size: int) -> list[tuple[str, str]]:
    """Train a BPE tokenizer on the given corpus."""
    # Initialize: split each word into characters
    word_freqs = Counter()
    for text in corpus:
        for word in text.split():
            word_freqs[tuple(word) + ('</w>',)] += 1

    vocab = set(c for word in word_freqs for c in word)
    merges = []

    while len(vocab) < vocab_size:
        # Count all adjacent pairs
        pair_freqs = Counter()
        for word, freq in word_freqs.items():
            for i in range(len(word) - 1):
                pair_freqs[(word[i], word[i+1])] += freq

        if not pair_freqs:
            break

        # Find the most frequent pair
        best_pair = pair_freqs.most_common(1)[0][0]
        merges.append(best_pair)

        # Merge the pair in all words
        new_word_freqs = Counter()
        for word, freq in word_freqs.items():
            new_word = []
            i = 0
            while i < len(word):
                if i < len(word) - 1 and (word[i], word[i+1]) == best_pair:
                    new_word.append(word[i] + word[i+1])
                    i += 2
                else:
                    new_word.append(word[i])
                    i += 1
            new_word_freqs[tuple(new_word)] += freq
        word_freqs = new_word_freqs

        # Add merged token to vocabulary
        vocab.add(best_pair[0] + best_pair[1])

    return merges
```

**Unigram** (Kudo, 2018): Start with a large vocabulary (all substrings up to some length), then iteratively remove tokens whose removal least increases the corpus likelihood under a unigram language model. This is the algorithm used by SentencePiece.

**WordPiece** (Schuster & Nakajima, 2012): Similar to BPE but selects the pair maximizing $P(t_1 t_2) / (P(t_1) \cdot P(t_2))$ --- the pair most disproportionately frequent relative to its components (not simply the most frequent pair). Used by BERT.

### 4.2 Byte-Level BPE

GPT-2 introduced byte-level BPE: instead of starting from Unicode characters, start from raw bytes (256 base tokens). This guarantees that any byte sequence can be encoded (no "unknown" tokens) and eliminates the need for a pre-tokenization step that handles Unicode.

**Advantages**:
- Universal: any text, code, or binary data can be tokenized.
- No out-of-vocabulary tokens.
- Naturally handles mixed-language text.

**Disadvantages**:
- Multi-byte Unicode characters (CJK, emoji) become multi-token sequences, reducing encoding efficiency.
- The merge table is larger for the same effective vocabulary coverage.

### 4.3 Vocabulary Size Tradeoffs

| Vocab Size | Fertility (tokens/word) | Embedding Table Size (d=4096) | Pros | Cons |
|-----------|------------------------|-------------------------------|------|------|
| 8K | ~2.5 (English) | 128 MB | Compact model, good for small models | Longer sequences, more compute |
| 32K | ~1.5 (English) | 512 MB | GPT-2 default, good balance | Standard |
| 64K | ~1.3 (English) | 1 GB | Better multilingual coverage | Larger embedding table |
| 128K | ~1.1 (English) | 2 GB | Llama 3 / GPT-4 class | Large embedding table, rare tokens |
| 256K | ~1.0 (English) | 4 GB | Near word-level for English | Very large, many rare tokens |

**Fertility** is the average number of tokens per word. Lower fertility means shorter sequences (less compute per document) but larger vocabulary (more parameters in the embedding/output layers).

**Multilingual considerations**: A 32K vocabulary trained on English-only data has fertility ~5x for Chinese text (each character becomes multiple tokens). A 128K vocabulary with multilingual training data achieves ~1.5 fertility for Chinese by allocating vocabulary entries to common CJK characters and words.

### 4.4 SentencePiece and HuggingFace Tokenizers

**SentencePiece** (Kudo & Richardson, 2018): A language-independent tokenizer that treats the input as a raw byte stream (no pre-tokenization). Supports BPE and Unigram models. Used by Llama, T5, and many multilingual models.

```python
import sentencepiece as spm

# Training a SentencePiece model
spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="tokenizer",
    vocab_size=32000,
    model_type="bpe",           # or "unigram"
    character_coverage=0.9995,  # cover 99.95% of characters
    byte_fallback=True,         # use byte tokens for rare characters
    split_digits=True,          # split each digit into a separate token
    num_threads=64,
)

# Using the trained model
sp = spm.SentencePieceProcessor(model_file="tokenizer.model")
tokens = sp.encode("Hello, world!", out_type=str)
# ['_Hello', ',', '_world', '!']
ids = sp.encode("Hello, world!", out_type=int)
# [8774, 29892, 3186, 29991]
```

**HuggingFace Tokenizers** (written in Rust, Python bindings): Extremely fast tokenization (~1M tokens/s per core). Supports BPE, WordPiece, and Unigram with configurable pre-tokenization, normalization, and post-processing.

```python
from tokenizers import Tokenizer, models, trainers, pre_tokenizers

tokenizer = Tokenizer(models.BPE())
tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)

trainer = trainers.BpeTrainer(
    vocab_size=32000,
    special_tokens=["<|pad|>", "<|eos|>", "<|bos|>", "<|unk|>"],
    min_frequency=2,
)
tokenizer.train(files=["corpus.txt"], trainer=trainer)

# Benchmark: tokenize 1M documents
import time
start = time.perf_counter()
for doc in documents[:1_000_000]:
    tokenizer.encode(doc)
elapsed = time.perf_counter() - start
print(f"Throughput: {1_000_000 / elapsed:.0f} docs/s")
# Typical output: Throughput: 150000 docs/s (single thread)
```

### 4.5 Pre-Tokenization vs. On-the-Fly Tokenization

**Pre-tokenization** (offline): Tokenize the entire dataset once and store token IDs. Training reads integer arrays, not strings.

```python
# Pre-tokenization pipeline
import numpy as np

def pretokenize_shard(shard_path: str, tokenizer, output_path: str,
                      seq_len: int = 2048):
    """Tokenize a shard and write packed sequences of token IDs."""
    all_ids = []
    for doc in read_documents(shard_path):
        ids = tokenizer.encode(doc)
        all_ids.extend(ids)
        all_ids.append(tokenizer.eos_token_id)

    # Pack into fixed-length sequences (concatenate + chunk)
    all_ids = np.array(all_ids, dtype=np.uint16)  # uint16 for vocab < 65536
    n_seqs = len(all_ids) // seq_len
    all_ids = all_ids[:n_seqs * seq_len].reshape(n_seqs, seq_len)

    # Save as memory-mappable binary
    np.save(output_path, all_ids)
```

**Advantages**: Zero tokenization overhead at training time. Storage is compact (uint16 for vocab < 65K). Easy to compute exact token counts and data statistics.

**Disadvantages**: Cannot change the tokenizer without re-processing. Cannot experiment with dynamic sequence lengths or packing strategies. Storage of token IDs is typically 30--50% smaller than raw text (after compression), but uncompressed token IDs can be larger.

**On-the-fly tokenization**: Store raw text, tokenize in the DataLoader workers during training.

**Advantages**: Flexibility to change tokenizer, sequence length, or packing strategy without reprocessing data. Raw text is easier to inspect and debug.

**Disadvantages**: Tokenization consumes CPU cycles during training. With fast tokenizers (HuggingFace Rust backend), this is typically not the bottleneck, but it can be for slow tokenizers or very high throughput training.

**Recommendation**: For large-scale pretraining (>100B tokens), pre-tokenize. The upfront cost is small relative to training cost, and eliminating tokenization from the critical path simplifies debugging. For research and experimentation, on-the-fly tokenization provides flexibility.

---

## 5. Multimodal Data Pipelines

### 5.1 Image-Text Data

Image-text pretraining datasets (LAION-5B, DataComp, CC3M/CC12M) consist of (image, caption) pairs scraped from web pages via alt-text extraction.

**Pipeline architecture**:

```python
import webdataset as wds
from torchvision import transforms

def create_image_text_pipeline(
    shard_urls: list[str],
    image_size: int = 224,
    batch_size: int = 256,
    tokenizer=None,
    max_text_len: int = 77,
):
    """Create a streaming image-text data pipeline."""
    image_transform = transforms.Compose([
        transforms.RandomResizedCrop(image_size, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])

    def process_sample(sample):
        image = image_transform(sample["jpg"])
        text = tokenizer.encode(
            sample["txt"],
            max_length=max_text_len,
            truncation=True,
            padding="max_length",
            return_tensors="pt",
        ).squeeze(0)
        return image, text

    dataset = (
        wds.WebDataset(shard_urls, shardshuffle=True)
        .shuffle(5000)
        .decode("pil")
        .map(process_sample)
        .batched(batch_size)
    )
    return dataset
```

**Challenges specific to image-text**:
- **Variable image sizes**: Images must be resized/cropped to a fixed resolution for batching. Aspect-ratio-preserving strategies (padding, bucketing) trade off information loss for computational efficiency.
- **Caption quality**: Alt-text is noisy. Filtering by CLIP score (cosine similarity between image and text embeddings) is standard practice.
- **Image deduplication**: Perceptual hashing (pHash, dHash) detects near-duplicate images faster than MinHash on pixel data.

### 5.2 Video Data

Video pretraining presents unique challenges due to the massive data volume and temporal structure:

```python
def create_video_text_pipeline(
    shard_paths: list[str],
    num_frames: int = 16,
    frame_size: int = 224,
    fps: int = 2,  # subsample to 2 FPS
):
    """Streaming video-text pipeline."""

    def decode_video(sample):
        # Decode video, subsample frames
        video_bytes = sample["mp4"]
        container = av.open(io.BytesIO(video_bytes))
        stream = container.streams.video[0]

        # Calculate frame indices for uniform temporal sampling
        total_frames = stream.frames
        if total_frames <= 0:
            total_frames = int(stream.duration * stream.average_rate)
        indices = np.linspace(0, total_frames - 1, num_frames, dtype=int)

        frames = []
        for i, frame in enumerate(container.decode(video=0)):
            if i in indices:
                img = frame.to_image().resize((frame_size, frame_size))
                frames.append(transforms.ToTensor()(img))
            if len(frames) == num_frames:
                break

        # Stack frames: (num_frames, C, H, W)
        video_tensor = torch.stack(frames)
        return video_tensor, sample.get("txt", "")

    dataset = (
        wds.WebDataset(shard_paths, shardshuffle=True)
        .shuffle(500)  # smaller buffer due to large sample size
        .map(decode_video)
        .batched(batch_size=8)  # small batches due to memory
    )
    return dataset
```

**Key design decisions for video**:
- **Temporal subsampling**: Raw video at 30 FPS is massively redundant. Subsampling to 1--4 FPS reduces data volume by 10--30x with minimal information loss for most tasks.
- **Spatial resolution**: Training at full resolution (1080p) is prohibitively expensive. Most video models train at 224x224 or 256x256.
- **Decode cost**: Video decoding (H.264/H.265) is CPU-intensive. Pre-extracting frames to JPEG or using hardware decoders (NVDEC via DALI) is essential for throughput.

### 5.3 Audio Data

Audio pipelines process waveforms or spectrograms:

```python
import torchaudio

def create_audio_text_pipeline(shard_paths: list[str],
                                sample_rate: int = 16000,
                                max_duration: float = 30.0):
    """Streaming audio-text pipeline."""

    def process_audio(sample):
        waveform, sr = torchaudio.load(io.BytesIO(sample["flac"]))

        # Resample if necessary
        if sr != sample_rate:
            resampler = torchaudio.transforms.Resample(sr, sample_rate)
            waveform = resampler(waveform)

        # Truncate to max duration
        max_samples = int(max_duration * sample_rate)
        waveform = waveform[:, :max_samples]

        # Compute mel spectrogram
        mel_transform = torchaudio.transforms.MelSpectrogram(
            sample_rate=sample_rate,
            n_fft=400,
            hop_length=160,
            n_mels=80,
        )
        mel = mel_transform(waveform)  # (1, n_mels, time)

        return mel.squeeze(0), sample.get("txt", "")

    dataset = (
        wds.WebDataset(shard_paths, shardshuffle=True)
        .shuffle(2000)
        .map(process_audio)
    )
    return dataset
```

### 5.4 Handling Variable-Length Multimodal Batches

A core challenge in multimodal training: samples within a batch may have different sizes (different image resolutions, different text lengths, different video durations). Strategies:

**Strategy 1: Fixed-size padding.** Pad all samples to the maximum size in the batch. Wastes compute on padding tokens but is simple to implement.

**Strategy 2: Bucketing.** Group samples with similar sizes into buckets and batch within buckets. Reduces padding waste but introduces batch-level correlation.

```python
class BucketBatchSampler:
    """Group samples by length into buckets, then batch within buckets."""

    def __init__(self, lengths: list[int], batch_size: int, num_buckets: int = 10):
        # Sort samples by length and divide into buckets
        sorted_indices = sorted(range(len(lengths)), key=lambda i: lengths[i])
        bucket_size = len(sorted_indices) // num_buckets

        self.batches = []
        for b in range(num_buckets):
            bucket = sorted_indices[b * bucket_size:(b + 1) * bucket_size]
            random.shuffle(bucket)
            for i in range(0, len(bucket), batch_size):
                self.batches.append(bucket[i:i + batch_size])
        random.shuffle(self.batches)

    def __iter__(self):
        return iter(self.batches)

    def __len__(self):
        return len(self.batches)
```

**Strategy 3: Packing (for text).** Concatenate multiple short documents into a single sequence, separated by special tokens. Eliminates padding entirely but requires attention masking to prevent cross-document attention.

```python
def pack_sequences(token_ids_list: list[list[int]], seq_len: int,
                   eos_id: int, pad_id: int) -> list[dict]:
    """Pack multiple documents into fixed-length sequences.

    Returns list of dicts with 'input_ids' and 'attention_mask'.
    """
    packed = []
    current_ids = []
    current_doc_ids = []  # track which doc each token belongs to
    doc_counter = 0

    for ids in token_ids_list:
        ids_with_eos = ids + [eos_id]
        if len(current_ids) + len(ids_with_eos) <= seq_len:
            current_ids.extend(ids_with_eos)
            current_doc_ids.extend([doc_counter] * len(ids_with_eos))
            doc_counter += 1
        else:
            # Pad current sequence and start a new one
            pad_len = seq_len - len(current_ids)
            packed.append({
                "input_ids": current_ids + [pad_id] * pad_len,
                "doc_ids": current_doc_ids + [-1] * pad_len,
            })
            current_ids = ids_with_eos
            current_doc_ids = [doc_counter] * len(ids_with_eos)
            doc_counter += 1

    # Don't forget the last partial sequence
    if current_ids:
        pad_len = seq_len - len(current_ids)
        packed.append({
            "input_ids": current_ids + [pad_id] * pad_len,
            "doc_ids": current_doc_ids + [-1] * pad_len,
        })

    return packed
```

---

## 6. Data Mixing Strategies

### 6.1 Why Mixing Matters

Large-scale pretraining corpora are assembled from multiple sources: web crawl, books, Wikipedia, code, academic papers, social media, etc. The mixing ratio --- the proportion of tokens from each source in each training batch --- significantly affects downstream capabilities.

**The DoReMi result** (Xie et al., 2023): Training a 280M proxy model with an optimized mixing ratio, then using that ratio for the full-scale model, improved performance by 2--5% across benchmarks compared to uniform or heuristic mixing.

### 6.2 Common Mixing Strategies

**Proportional mixing**: Sample from each source in proportion to its size. This is the simplest approach but over-represents large, low-quality sources (web crawl) and under-represents small, high-quality sources (textbooks, curated data).

**Upsampling high-quality sources**: Increase the weight of high-quality sources beyond their natural proportion. Llama 2 upsampled Wikipedia ~10x and books ~5x relative to web data. The risk: excessive upsampling causes memorization of the small sources.

**Temperature-based mixing**: Apply a temperature $\tau$ to source probabilities:

$$p_i^{(\tau)} = \frac{n_i^{1/\tau}}{\sum_j n_j^{1/\tau}}$$

where $n_i$ is the number of tokens in source $i$. Temperature $\tau = 1$ gives proportional mixing; $\tau \to 0$ gives uniform mixing; $\tau \to \infty$ gives single-source (largest).

```python
def compute_mixing_weights(source_sizes: dict[str, int],
                           temperature: float = 0.7) -> dict[str, float]:
    """Compute mixing weights with temperature scaling."""
    total = sum(n ** (1 / temperature) for n in source_sizes.values())
    return {
        source: (n ** (1 / temperature)) / total
        for source, n in source_sizes.items()
    }

# Example
sizes = {
    "web": 1_000_000_000_000,   # 1T tokens
    "books": 50_000_000_000,     # 50B tokens
    "wikipedia": 10_000_000_000, # 10B tokens
    "code": 200_000_000_000,     # 200B tokens
    "papers": 30_000_000_000,    # 30B tokens
}

weights = compute_mixing_weights(sizes, temperature=0.7)
# web: 0.52, books: 0.10, wikipedia: 0.05, code: 0.22, papers: 0.08
# (vs proportional: web: 0.78, books: 0.04, wikipedia: 0.008, ...)
```

### 6.3 Implementing Data Mixing in a Streaming Pipeline

```python
class MixedStreamingDataset(torch.utils.data.IterableDataset):
    """Streaming dataset that mixes from multiple data sources."""

    def __init__(self, sources: dict[str, list[str]],
                 weights: dict[str, float], seed: int = 42):
        """
        Args:
            sources: mapping from source name to list of shard paths
            weights: sampling weight for each source (must sum to 1)
            seed: random seed for reproducibility
        """
        self.sources = sources
        self.weights = weights
        self.seed = seed
        assert abs(sum(weights.values()) - 1.0) < 1e-6

    def __iter__(self):
        rng = random.Random(self.seed)
        source_names = list(self.sources.keys())
        source_weights = [self.weights[s] for s in source_names]

        # Create iterators for each source
        iterators = {}
        for name in source_names:
            shards = self.sources[name].copy()
            rng.shuffle(shards)
            iterators[name] = self._shard_iterator(shards)

        # Yield samples according to mixing weights
        while True:
            source = rng.choices(source_names, weights=source_weights, k=1)[0]
            try:
                sample = next(iterators[source])
                yield sample
            except StopIteration:
                # Source exhausted; restart (epoch cycling) or remove
                shards = self.sources[source].copy()
                rng.shuffle(shards)
                iterators[source] = self._shard_iterator(shards)
                yield next(iterators[source])

    def _shard_iterator(self, shard_paths: list[str]):
        for path in shard_paths:
            for sample in read_shard(path):
                yield sample
```

### 6.4 Dynamic Mixing and Curriculum Learning

**Curriculum learning** varies the data distribution over the course of training:

- **Easy-to-hard**: Start with simple, clean data (Wikipedia, textbooks) and gradually introduce harder, noisier data (web crawl). Motivated by the hypothesis that early training establishes core language understanding, and later training adds breadth.

- **Annealing**: Near the end of training, increase the proportion of high-quality data. This "annealing" phase can significantly improve benchmark performance. Llama 3 used a final annealing phase with increased weight on code, math, and instruction data.

```python
def curriculum_weights(step: int, total_steps: int,
                       source_schedules: dict) -> dict[str, float]:
    """Compute mixing weights that vary over training.

    source_schedules: {source_name: [(step_frac, weight), ...]}
    """
    progress = step / total_steps
    weights = {}
    for source, schedule in source_schedules.items():
        # Linear interpolation between schedule points
        for i in range(len(schedule) - 1):
            frac_start, w_start = schedule[i]
            frac_end, w_end = schedule[i + 1]
            if frac_start <= progress <= frac_end:
                t = (progress - frac_start) / (frac_end - frac_start)
                weights[source] = w_start + t * (w_end - w_start)
                break
        else:
            weights[source] = schedule[-1][1]

    # Normalize
    total = sum(weights.values())
    return {k: v / total for k, v in weights.items()}

# Example: increase code weight during training
schedules = {
    "web":       [(0.0, 0.60), (0.8, 0.50), (1.0, 0.30)],
    "code":      [(0.0, 0.15), (0.8, 0.25), (1.0, 0.35)],
    "books":     [(0.0, 0.10), (0.8, 0.10), (1.0, 0.15)],
    "wikipedia": [(0.0, 0.05), (0.8, 0.05), (1.0, 0.05)],
    "math":      [(0.0, 0.05), (0.8, 0.05), (1.0, 0.10)],
    "instruct":  [(0.0, 0.05), (0.8, 0.05), (1.0, 0.05)],
}
```

---

## 7. End-to-End Pipeline Architecture

### 7.1 Production Pipeline

A complete data pipeline for LLM pretraining ties together all components:

```
[Data Sources]
  Web crawl (Common Crawl)  -->  [Curation Pipeline (Lecture 08c)]
  Books corpus              -->      |
  Wikipedia dumps           -->      v
  Code (GitHub/Stack)       -->  [Curated Shards per Source]
  Academic papers           -->      |
                                     v
                              [Pre-tokenization]
                                     |
                                     v
                              [Token ID Shards (.bin files)]
                                     |
                                     v
                              [Streaming Data Loader]
                                  |        |
                          [Shard Shuffle] [Mixing Scheduler]
                                  |        |
                                  v        v
                              [Shuffle Buffer]
                                     |
                                     v
                              [Sequence Packing]
                                     |
                                     v
                              [Batch + Pad + Transfer to GPU]
                                     |
                                     v
                              [Training Loop]
```

### 7.2 Monitoring Data Pipelines

Key metrics to monitor during training:

```python
class DataPipelineMonitor:
    """Track data pipeline health metrics."""

    def __init__(self):
        self.source_counts = defaultdict(int)  # samples per source
        self.batch_times = []
        self.token_counts = defaultdict(int)

    def log_batch(self, batch_metadata: dict):
        """Log metadata for each training batch."""
        for source in batch_metadata["sources"]:
            self.source_counts[source] += 1

        self.batch_times.append(batch_metadata["load_time_ms"])
        self.token_counts["total"] += batch_metadata["num_tokens"]

    def report(self):
        """Print pipeline health report."""
        total = sum(self.source_counts.values())
        print("Source distribution:")
        for source, count in sorted(self.source_counts.items()):
            print(f"  {source}: {count/total:.2%}")

        print(f"\nData loading latency:")
        print(f"  Mean: {np.mean(self.batch_times):.1f} ms")
        print(f"  P99:  {np.percentile(self.batch_times, 99):.1f} ms")
        print(f"\nTotal tokens processed: {self.token_counts['total']:,}")
```

---

## Key Takeaways

1. **Streaming is mandatory at pretraining scale.** Datasets exceeding local storage capacity must be streamed from distributed storage with shard-level parallelism.
2. **Two-level shuffling** (shard order + sample buffer) approximates global shuffling with bounded memory. Buffer size of 10K--100K samples is typical.
3. **Deterministic resumption** requires saving the data pipeline state (shard position, buffer contents, RNG state) alongside model checkpoints.
4. **Tokenizer choice is a critical, irreversible decision.** Vocabulary size, byte-level vs. character-level base, and training data composition all affect downstream performance, especially for multilingual models.
5. **Pre-tokenize for production; tokenize on-the-fly for research.** The compute savings from pre-tokenization compound over the hundreds of epochs typical of large-scale training.
6. **Data mixing ratios significantly impact model capabilities.** Temperature-based scaling with $\tau \in [0.5, 0.8]$ is a robust default; optimized mixing (DoReMi) can yield further gains.
7. **Curriculum learning and annealing** provide additional levers: gradually shifting the distribution toward high-quality or task-specific data during training.

---

## Further Reading

1. **Kudo, T. and Richardson, J.** (2018). "SentencePiece: A Simple and Language Independent Subword Tokenizer and Detokenizer for Neural Text Processing." *EMNLP 2018.* --- The SentencePiece algorithm and implementation.

2. **Sennrich, R., Haddow, B., and Birch, A.** (2016). "Neural Machine Translation of Rare Words with Subword Units." *ACL 2016.* --- The original BPE for NMT paper.

3. **Xie, S. M., Santurkar, S., Ma, T., and Liang, P.** (2023). "DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining." *NeurIPS 2023.* --- Principled data mixing optimization.

4. **Grattafiori, A. et al.** (2024). "The Llama 3 Herd of Models." *arXiv:2407.21783.* --- Section 3 details Llama 3's data curation, tokenization, and annealing strategy.

5. **Li, S., Zhao, Y., et al.** (2023). "MosaicML Streaming." *arXiv:2303.06994.* --- Design of deterministic, resumable streaming for ML training.

6. **Radford, A. et al.** (2019). "Language Models are Unsupervised Multitask Learners." *OpenAI Technical Report.* --- Introduced byte-level BPE for GPT-2.

7. **Zhai, X., Mustafa, B., Kolesnikov, A., and Beyer, L.** (2023). "Sigmoid Loss for Language Image Pre-Training." *ICCV 2023.* --- SigLIP training with data engineering insights for image-text pretraining.
