# Homework 08: End-to-End Data Pipeline

**Estimated Time:** 20 hours
**Due:** Two weeks from assignment date
**Submission:** Submit a single PDF (typeset in LaTeX) for Part A and a GitHub repository with runnable code for Part B.

---

## Overview

This homework covers the design, implementation, and analysis of data systems for ML training at scale. Part A tests your ability to reason analytically about data pipeline performance, deduplication algorithms, and feature store design. Part B requires building a complete data curation and loading pipeline, from raw web-crawled text through tokenized, sharded, streaming training data.

**Grading:**

- Part A (Analytical): 50%
- Part B (Implementation): 50%

**Academic integrity:** You may discuss approaches with classmates but all written analysis and code must be your own. Cite any resources used.

**Compute note:** Part B is designed to run on a single machine with at least 16 GB RAM and 4 CPU cores. GPU access is helpful but not required for the data pipeline portions. If you use a GPU for the training benchmark (B4), a single consumer GPU suffices.

---

## Part A: Analytical Problems (50%)

### Problem A1: Data Pipeline Throughput Analysis (12 points)

You are training a Vision Transformer (ViT-B/16) on ImageNet-1k with the following system specifications:

- **GPU**: NVIDIA A100 80 GB
- **Storage**: NVMe SSD, 7 GB/s sequential read, 500K IOPS random read (4 KB)
- **CPU**: 16 cores, each can decode ~1200 JPEG images/s and apply augmentations at ~3000 images/s
- **PCIe**: Gen4 x16, ~25 GB/s
- **Batch size**: 512 per GPU
- **GPU forward+backward time**: 220 ms per batch
- **Average JPEG size**: 150 KB
- **Training image resolution**: 224x224x3, float32 (after decode and transform)

**(a)** (3 points) Compute the per-batch time for each pipeline stage:
1. Storage read (assuming sequential reads from sharded files)
2. JPEG decoding (using all 16 cores)
3. Data augmentation (RandomResizedCrop + horizontal flip + normalization, using all 16 cores)
4. Host-to-device transfer (with and without `pin_memory`)
5. GPU computation

Identify the bottleneck stage. Is this pipeline compute-bound or data-bound?

**(b)** (3 points) Now consider the same pipeline but with images stored as individual files on a network filesystem (NFS) with:
- Sequential read: 1 GB/s
- Random read latency: 2 ms per file
- Metadata operation (stat/open/close): 0.5 ms per file

Compute the per-batch time for storage read under two access patterns:
1. Random access to individual files (the naive PyTorch `ImageFolder` approach)
2. Sequential read from tar shards (WebDataset approach)

What is the speedup of the sharded approach?

**(c)** (3 points) The training runs on 8 A100 GPUs on a single DGX node. Each GPU has a DataLoader with `num_workers=N`. Derive the minimum value of `N` per GPU to keep the pipeline compute-bound, assuming:
- Each worker handles decode + augment serially
- Workers operate in parallel with each other and with the GPU
- Per-image decode time: 0.83 ms, per-image augment time: 0.33 ms

Show your derivation. What happens if you set `N` higher than the minimum? What is the maximum useful value of `N` given the 16-core constraint (shared across 8 GPUs)?

**(d)** (3 points) You add NVIDIA DALI to offload JPEG decoding to the GPU. The GPU JPEG decoder (nvJPEG) achieves 10,000 images/s on the A100. Assume augmentations are also GPU-accelerated and negligible compared to decode.

1. What is the new bottleneck?
2. DALI consumes GPU memory for decode buffers. Estimate the memory required for a double-buffered decode pipeline processing batch_size=512 images at 224x224x3 float32. Is this acceptable on an A100 80 GB?
3. Does DALI help when training on TPU pods where host CPU is the bottleneck? Why or why not?

---

### Problem A2: MinHash Analysis (12 points)

**(a)** (4 points) **Theoretical analysis of LSH banding.**

Given a MinHash signature of length $m = 128$, divided into $b$ bands of $r$ rows each ($m = b \cdot r$), derive the probability that two documents with Jaccard similarity $s$ are identified as candidates:

$$P(s) = 1 - (1 - s^r)^b$$

1. For the configuration $b = 16, r = 8$, compute $P(s)$ for $s \in \{0.2, 0.4, 0.6, 0.8, 0.9, 0.95\}$.
2. Compute the approximate threshold $t$ (the value of $s$ where $P(s) = 0.5$).
3. Plot $P(s)$ for three configurations: $(b=16, r=8)$, $(b=32, r=4)$, $(b=64, r=2)$. Discuss which configuration has the sharpest threshold transition and why.

**(b)** (4 points) **False positive and false negative analysis.**

Define:
- False positive rate at similarity $s$: $\text{FPR}(s) = P(s)$ for $s < t$ (documents below threshold that are flagged as candidates)
- False negative rate at similarity $s$: $\text{FNR}(s) = 1 - P(s)$ for $s \geq t$ (true duplicates missed)

For the configuration $b = 20, r = 5$ (so $m = 100$):

1. Compute $\text{FPR}(0.5)$ and $\text{FNR}(0.9)$.
2. A dataset has 100 million documents. Assuming the pairwise Jaccard similarity distribution is: 0.1% of pairs have $s > 0.9$ (true duplicates), 1% of pairs have $0.5 < s < 0.9$, and the rest have $s < 0.5$. Estimate the number of false positive candidate pairs and the number of missed true duplicate pairs.
3. Each candidate pair requires an $O(m)$ verification step to compute exact Jaccard similarity. Estimate the total verification cost (number of pairs to verify) and compare to the brute-force cost of $\binom{N}{2}$ pairwise comparisons.

**(c)** (4 points) **Scaling analysis.**

1. Derive the time complexity of the full MinHash LSH pipeline: (i) shingling, (ii) MinHash signature computation, (iii) LSH banding and candidate generation, (iv) candidate verification. Express each in terms of $N$ (number of documents), $L$ (average document length in words), $k$ (shingle size), $m$ (signature length), $b$ (number of bands), and $C$ (number of candidate pairs).
2. The Common Crawl has approximately 3 billion documents with average length 500 words. Estimate the total computation time for the full pipeline on a 128-core machine, assuming: shingling at 100K words/s/core, MinHash at 50K signatures/s/core, and candidate verification at 1M pairs/s/core.
3. How would you parallelize this pipeline across a 100-node cluster? Describe the communication pattern and identify the stage most difficult to distribute.

---

### Problem A3: Feature Store Design (12 points)

**(a)** (4 points) **Point-in-time join correctness.**

Consider a feature table with the following entries for `user_id = 42`:

| feature_timestamp | feature_value |
|-------------------|---------------|
| 2025-01-01 00:00 | 10.0 |
| 2025-01-15 00:00 | 25.0 |
| 2025-02-01 00:00 | 18.0 |
| 2025-02-15 00:00 | 30.0 |

And a label table:

| label_timestamp | label |
|-----------------|-------|
| 2025-01-10 12:00 | 1 |
| 2025-01-20 06:00 | 0 |
| 2025-02-10 18:00 | 1 |
| 2025-03-01 00:00 | 0 |

1. Perform the point-in-time join manually. For each label row, determine which feature value should be used. Show your reasoning.
2. What would happen if you used a naive `LEFT JOIN ON user_id` without the temporal constraint? Explain specifically which training examples would use incorrect feature values and in which direction the data leakage would bias the model.
3. The feature has a TTL (time-to-live) of 30 days. Which label rows, if any, would have a null feature value due to TTL expiry? How should the training pipeline handle these nulls?

**(b)** (4 points) **Online/offline consistency.**

A feature store computes `user_30d_purchase_count` via two paths:
- **Offline**: A daily Spark job queries a data warehouse with `WHERE timestamp >= current_date - 30`.
- **Online**: A Redis cache is updated by a Flink job consuming a Kafka purchase event stream with a 30-day sliding window.

1. Describe three specific scenarios where the online and offline values for the same user at the same point in time could differ. For each scenario, quantify the expected magnitude of divergence.
2. Propose a monitoring system that detects online/offline skew. What metric would you track, what threshold would trigger an alert, and how would you sample pairs for comparison?
3. How does the "write once, read everywhere" principle of a feature store address these consistency issues? What are its limitations?

**(c)** (4 points) **Versioning tradeoffs.**

You maintain a 500 GB training dataset that is updated weekly (approximately 5% of rows change per week). Compare the storage cost over 52 weeks (1 year) for three versioning strategies:

1. **Full copy**: Store a complete copy of the dataset each week.
2. **DVC with content-addressable storage**: Store each file version once (deduplication at the file level). Assume the dataset is stored as 100 Parquet files of 5 GB each, and each week 5 files change entirely.
3. **Delta Lake**: Append-only transaction log with Parquet data files. Each week, changed rows are written as new Parquet files; old files are retained for time travel.

For each strategy, compute: (a) total storage after 52 weeks, (b) time to restore version from 26 weeks ago, and (c) storage cost at $0.023/GB/month (S3 Standard). State your assumptions clearly.

---

### Problem A4: Data Quality Impact (14 points)

**(a)** (4 points) **Deduplication impact modeling.**

A training dataset of 100B tokens contains the following duplication profile:
- 5% of tokens appear in documents that are exact duplicates (identical content).
- 10% of tokens appear in documents that are near-duplicates (Jaccard similarity > 0.8).
- 3% of tokens appear in documents that are semantic duplicates (different wording, same information).

Assume that:
- Exact duplicates contribute zero marginal learning signal after the first copy.
- Near-duplicates contribute 20% of the learning signal of a unique document.
- Semantic duplicates contribute 50% of the learning signal of a unique document.

1. Compute the "effective token count" --- the number of unique-equivalent tokens the model sees after accounting for duplication.
2. If you apply exact + near-duplicate deduplication (removing the second category entirely and keeping one copy of exact duplicates), what is the new dataset size and effective token count?
3. Using the Chinchilla scaling law ($L(D) = A / D^\alpha$ with $\alpha = 0.095$), estimate the loss improvement from deduplication relative to training on the original dataset for the same number of gradient steps.

**(b)** (5 points) **Quality filtering bias analysis.**

You train a perplexity-based quality filter using a 5-gram KenLM model trained on English Wikipedia. You apply this filter to a multilingual web crawl, keeping documents with perplexity below 200.

1. Explain why this filter systematically removes more documents from certain demographics and topics. Give three specific examples of content types that would have high perplexity under this filter despite being high-quality.
2. A classifier-based filter trained on (Wikipedia=positive, random web=negative) assigns quality scores. Compute the expected false negative rate (high-quality documents classified as low-quality) for: (a) formal academic text, (b) African American Vernacular English transcripts, (c) medical forum discussions with domain jargon, (d) poetry. For each, explain your reasoning qualitatively.
3. Propose a multi-stage filtering strategy that mitigates these biases while still removing genuinely low-quality content. Describe at least three specific modifications to the standard pipeline.

**(c)** (5 points) **Benchmark contamination.**

You are evaluating a language model on the HellaSwag benchmark (70,000 test examples). Your training data is 1T tokens of web-crawled text.

1. Estimate the probability that at least one HellaSwag example appears verbatim in the training data, given that HellaSwag examples were generated from web-sourced ActivityNet Captions and WikiHow articles. Justify your estimate with a calculation based on n-gram overlap rates from published contamination studies (cite specific numbers from Dodge et al. 2021 or Brown et al. 2020 if known, otherwise state reasonable assumptions).
2. If 2% of test examples are contaminated (appear in training data), and the model achieves 95% accuracy on contaminated examples vs. 82% on uncontaminated examples, what is the inflated accuracy due to contamination? What is the true (uncontaminated) accuracy?
3. Describe the 13-gram overlap detection method. Why is 13 the standard choice? What are the false positive and false negative failure modes?

---

## Part B: Implementation (50%)

### Problem B1: Data Curation Pipeline (15 points)

Implement a text data curation pipeline that processes raw web text. You will work with a subset of the OSCAR or C4 dataset (or similar open web corpus). If these are too large, use a 1 GB sample.

**(a)** (3 points) **Heuristic filtering.** Implement at least 8 of the Gopher-style heuristic filters from Lecture 08c. Apply them to the dataset and report:
- The number and fraction of documents removed by each filter.
- The total dataset size before and after filtering.
- Three examples of documents correctly removed and one example of a false positive (a good document incorrectly removed).

**(b)** (5 points) **Deduplication.** Implement:
1. Exact deduplication via SHA-256 hashing.
2. Near-duplicate detection via MinHash LSH (use the `datasketch` library or implement from scratch).

Apply both to the filtered dataset and report:
- Number of exact duplicates found.
- Number of near-duplicate clusters found, with the distribution of cluster sizes.
- Total documents removed.
- Two examples of near-duplicate pairs detected (show the texts side by side with differences highlighted).

Configuration: use 128 hash functions, word-level 5-grams as shingles, and a Jaccard threshold of 0.8.

**(c)** (4 points) **Quality scoring.** Implement a perplexity-based quality filter:
1. Train a KenLM 5-gram model on a reference corpus (English Wikipedia dump or similar).
2. Compute perplexity for each document in the curated dataset.
3. Plot the perplexity distribution (histogram) and choose a threshold that removes the bottom 20% of documents by quality.
4. Show 3 examples near the threshold: 2 correctly removed, 1 incorrectly removed (false positive).

**(d)** (3 points) **Pipeline statistics.** Generate a comprehensive report showing:
- Dataset size at each stage (raw, after heuristics, after dedup, after quality filtering).
- A pipeline diagram (text-based or matplotlib) showing the data flow and reduction at each stage.
- Total processing time for each stage.
- Final dataset statistics: number of documents, total tokens, average document length, language distribution (if multilingual).

---

### Problem B2: Sharding and Streaming (10 points)

**(a)** (4 points) **Create WebDataset shards.** Take the curated dataset from B1 and package it into WebDataset tar shards. Requirements:
- Target shard size: ~100 MB.
- Each sample should contain: `txt` (document text), `json` (metadata: quality score, source URL, word count).
- Report the number of shards created and verify by reading back 10 random samples.

**(b)** (3 points) **Streaming data loader.** Build a PyTorch `IterableDataset` that:
- Streams from the WebDataset shards.
- Tokenizes text on-the-fly using a HuggingFace tokenizer (e.g., GPT-2).
- Packs tokenized sequences into fixed-length chunks (1024 tokens).
- Applies a shuffle buffer of configurable size.
- Correctly partitions shards across DataLoader workers.

Verify correctness by checking that:
- No duplicate samples appear across workers.
- The token distribution matches the expected vocabulary distribution.
- The packed sequences have the correct length.

**(c)** (3 points) **Throughput benchmark.** Measure the throughput (tokens/second) of your streaming pipeline with:
- `num_workers` in {0, 1, 2, 4, 8}
- `shuffle_buffer_size` in {100, 1000, 10000}
- With and without `pin_memory`

Present results as a table and plot. Identify the optimal configuration and explain the observed scaling behavior.

---

### Problem B3: Data Mixing (10 points)

**(a)** (3 points) **Multi-source mixing.** Create a `MixedStreamingDataset` that samples from at least 3 different text sources (e.g., web text, Wikipedia, code). Implement temperature-based mixing weights with a configurable temperature parameter $\tau$.

Verify that the empirical sampling distribution matches the target distribution by processing 100,000 samples and comparing observed vs. expected source fractions.

**(b)** (3 points) **Curriculum learning schedule.** Implement a training loop that changes mixing weights over the course of training according to a predefined schedule. The schedule should:
- Start with 80% high-quality (Wikipedia), 10% web, 10% code.
- Linearly transition to 40% web, 30% code, 30% Wikipedia by 50% of training.
- In the final 10% of training (annealing), shift to 20% web, 50% code, 30% Wikipedia.

Plot the mixing weights as a function of training step. Verify that the actual batch composition matches the schedule.

**(c)** (4 points) **Impact measurement.** Using a small language model (e.g., GPT-2 small, 124M parameters) or a simple LSTM, train for a fixed number of steps (e.g., 10,000) under three mixing strategies:
1. Proportional mixing (each source proportional to its size).
2. Temperature mixing ($\tau = 0.7$).
3. Curriculum learning (your schedule from B3b).

For each strategy, report:
- Training loss curve.
- Evaluation perplexity on a held-out set from each source.
- Total training time.

Discuss which strategy performs best and hypothesize why.

---

### Problem B4: Integration and Profiling (15 points)

**(a)** (5 points) **End-to-end pipeline.** Combine your curation pipeline (B1), sharding (B2), and streaming loader (B2) into a single end-to-end pipeline that:
1. Takes raw text data as input.
2. Applies heuristic filtering, deduplication, and quality scoring.
3. Produces WebDataset shards of curated, tokenized data.
4. Serves streaming batches to a training loop.

The pipeline should be configurable via a YAML file:

```yaml
curation:
  min_word_count: 50
  max_word_count: 100000
  dedup_threshold: 0.8
  quality_threshold: 200  # max perplexity

sharding:
  shard_size_mb: 100
  output_dir: "shards/"

loading:
  tokenizer: "gpt2"
  seq_len: 1024
  batch_size: 32
  num_workers: 4
  shuffle_buffer: 10000
  pin_memory: true

mixing:
  sources:
    web: {weight: 0.5}
    wiki: {weight: 0.3}
    code: {weight: 0.2}
  temperature: 0.7
```

**(b)** (5 points) **Profiling.** Profile your pipeline and produce a detailed performance report:

1. **Stage timing**: How long does each pipeline stage take (filtering, dedup, quality scoring, sharding, tokenization)?
2. **Bottleneck identification**: Use PyTorch Profiler to trace the training loop. Identify whether training is compute-bound or data-bound. Include a screenshot or text dump of the profiler trace.
3. **Memory profiling**: Track peak memory usage of the data pipeline. Where is memory consumed (shuffle buffer, tokenizer, data loader queues)?
4. **Scaling analysis**: How does throughput scale with the number of DataLoader workers? At what point does adding workers stop helping?

**(c)** (5 points) **Optimization.** Starting from your profiling results, apply at least 3 optimizations to improve pipeline throughput. For each optimization:
1. Describe what you changed and why.
2. Show before/after throughput measurements.
3. Explain why the optimization helped (or did not help).

Possible optimizations include:
- Pre-tokenization (offline tokenization stored as numpy arrays)
- Increased shuffle buffer
- Format changes (e.g., memory-mapped numpy vs. WebDataset)
- Parallel tokenization in workers
- Sequence packing to eliminate padding
- Operating system tuning (readahead, page cache)

Report the cumulative speedup from all optimizations.

---

## Submission Checklist

- [ ] **Part A:** LaTeX PDF with all analytical problems.
  - [ ] A1: Pipeline throughput calculations with clearly stated assumptions.
  - [ ] A2: MinHash LSH analysis with plots.
  - [ ] A3: Feature store design with storage cost calculations.
  - [ ] A4: Data quality impact analysis with bias discussion.
- [ ] **Part B:** GitHub repository containing:
  - [ ] `pipeline/curation.py`: Heuristic filtering, deduplication, quality scoring.
  - [ ] `pipeline/sharding.py`: WebDataset shard creation.
  - [ ] `pipeline/streaming.py`: Streaming data loader with tokenization and packing.
  - [ ] `pipeline/mixing.py`: Multi-source mixing and curriculum learning.
  - [ ] `pipeline/profiling.py`: Profiling and benchmarking scripts.
  - [ ] `config.yaml`: Pipeline configuration.
  - [ ] `run_pipeline.py`: End-to-end pipeline script.
  - [ ] `report.pdf`: All figures, tables, profiling results, and analysis for Part B.
  - [ ] `README.md`: Setup instructions and how to reproduce results.
- [ ] All figures referenced in the report are included.
- [ ] Throughput benchmarks include error bars or confidence intervals (run each config 3x).
- [ ] Code runs without errors with the provided `config.yaml`.
