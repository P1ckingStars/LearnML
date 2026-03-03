# Lecture 05d: Data Curation and Pretraining Infrastructure

> **Module 05 — LLMs & Pretraining**
> Estimated study time: 6–8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Describe the major data sources used for LLM pretraining and their characteristics (quality, size, license).
2. Implement data cleaning pipelines including deduplication (exact, near-duplicate via MinHash), quality filtering, and PII removal.
3. Derive optimal data mixing strategies and analyze the effect of domain proportions on model capabilities.
4. Explain the four major parallelism strategies (data, tensor, pipeline, ZeRO) with mathematical precision.
5. Diagnose and address training instabilities: loss spikes, gradient explosions, and numerical issues with mixed precision.
6. Design an evaluation suite for monitoring pretraining progress.

---

## 1. Motivation and Context

The quality and composition of pretraining data is as important as model architecture and scale. Garbage in, garbage out — but at the scale of trillions of tokens.

**Scale of Modern Pretraining Data:**

| Dataset | Size (tokens) | Source |
|---------|--------------|--------|
| Common Crawl (raw) | ~200T | Web scrapes |
| FineWeb (filtered) | 15T | Filtered Common Crawl |
| RedPajama v2 | 30T | Multi-source |
| The Pile | 825B | Curated 22-domain mix |
| LLaMA-3 training data | 15T | Multi-source |

The gap between raw Common Crawl (~200T tokens) and curated datasets (~15T tokens) highlights the scale of filtering: **over 90% of raw web data is discarded**.

Training infrastructure at this scale requires distributing computation across thousands of GPUs. A single LLaMA-3 405B training run uses ~16,000 H100 GPUs for ~54 days.

---

## 2. Core Theory

### 2.1 Data Sources

**Common Crawl.** The largest publicly available web scrape, containing ~250 billion pages since 2008. Each monthly snapshot is ~3–5 billion pages. Raw data includes HTML, which must be extracted (using tools like `trafilatura` or `resiliparse`) to plain text.

**Characteristics of raw web data:**

- **Low quality**: much of the text is boilerplate, navigation menus, ads, spam, SEO content, machine-translated garbage.
- **Duplication**: 30–50% of documents are near-duplicates.
- **PII**: names, emails, phone numbers, addresses appear frequently.
- **Harmful content**: toxic language, misinformation, explicit content.

**Books.** Project Gutenberg (~70K books, public domain), Books3 (~200K books, copyright concerns), BookCorpus (~11K books). Books provide long-form, high-quality narrative text that helps models learn coherent long-range structure.

**Wikipedia.** ~6M English articles, ~60M articles total across languages. High quality, well-structured, encyclopedic. Typically included at 2–5x its natural proportion (upsampled for quality).

**Code.** GitHub public repositories (~1T tokens of code). Code improves reasoning abilities, even for non-code tasks. StarCoder training data: The Stack (~6T tokens across 350+ programming languages).

**Curated/Academic.** ArXiv papers, StackExchange Q&A, patents, legal documents. Small but high quality.

### 2.2 Data Cleaning Pipeline

The standard pipeline has multiple stages, each reducing dataset size:

$$\text{Raw Crawl} \xrightarrow{\text{Extract}} \text{Plain Text} \xrightarrow{\text{Language ID}} \text{Target Lang} \xrightarrow{\text{Dedup}} \text{Unique Docs} \xrightarrow{\text{Quality Filter}} \text{Clean Data} \xrightarrow{\text{PII}} \text{Safe Data}$$

**Text Extraction.** Convert HTML to plain text, preserving paragraph structure. Remove boilerplate (headers, footers, navigation, ads). Tools: `trafilatura`, `jusText`, `resiliparse`.

**Language Identification.** Use fastText's language identification model (`lid.176.bin`) to classify each document. Discard documents with confidence below a threshold (e.g., 0.65) or in non-target languages.

### 2.3 Deduplication

Deduplication is critical: duplicate data causes memorization, wastes compute, and can lead to training instabilities.

**Exact Deduplication.** Hash each document (e.g., SHA-256) and remove exact matches.

$$\text{hash}(d) = \text{SHA256}(\text{normalize}(d))$$

where $\text{normalize}$ lowercases, removes whitespace, and strips punctuation. Time complexity: $O(N)$ with a hash set.

**Near-Duplicate Detection via MinHash + LSH.**

**Definition (Jaccard Similarity).** For two sets $A, B$:

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

For documents, $A$ and $B$ are the sets of $n$-grams (typically $n = 5$ words or 13-grams of characters).

**Definition (MinHash).** Let $h: \mathcal{U} \to [0, 1]$ be a random hash function. The MinHash of a set $S$ is:

$$\text{MinHash}_h(S) = \min_{x \in S} h(x)$$

**Theorem (MinHash Approximation).** For two sets $A, B$:

$$\Pr[\text{MinHash}_h(A) = \text{MinHash}_h(B)] = J(A, B)$$

*Proof.* Let $U = A \cup B$. The MinHash of $A$ (resp. $B$) is the hash of the element in $U$ with the smallest hash value, restricted to $A$ (resp. $B$). The MinHash values are equal if and only if the element of $U$ with the globally smallest hash value is in $A \cap B$. Each element of $U$ is equally likely to have the smallest hash value (since $h$ is uniformly random), so:

$$\Pr[\text{MinHash}_h(A) = \text{MinHash}_h(B)] = \frac{|A \cap B|}{|A \cup B|} = J(A, B) \quad \square$$

**MinHash Signature.** Use $k$ independent hash functions $h_1, \ldots, h_k$. The MinHash signature of $S$ is:

$$\text{sig}(S) = (\text{MinHash}_{h_1}(S), \ldots, \text{MinHash}_{h_k}(S))$$

The fraction of positions where $\text{sig}(A)$ and $\text{sig}(B)$ agree estimates $J(A, B)$ with standard error $\sqrt{J(1-J)/k}$.

**Locality-Sensitive Hashing (LSH) for Candidate Pair Generation.**

Computing all pairwise MinHash similarities is $O(N^2)$. LSH reduces this to approximately $O(N)$ expected time.

Divide the $k$-dimensional signature into $b$ bands of $r$ rows each ($k = br$). Two documents are a candidate pair if they agree in all $r$ rows of at least one band.

**Theorem (LSH Probability).** The probability that documents with Jaccard similarity $s$ become a candidate pair is:

$$P(s) = 1 - (1 - s^r)^b$$

*Proof.* For a single band of $r$ rows, the probability that all $r$ MinHash values match is $s^r$ (independence of hash functions). The probability that a band does NOT match is $1 - s^r$. The probability that no band matches is $(1 - s^r)^b$. Therefore, the probability of at least one band matching is $1 - (1 - s^r)^b$. $\square$

This function approximates a step function: it is near 0 for $s \ll s^*$ and near 1 for $s \gg s^*$, where the threshold $s^* = (1/b)^{1/r}$.

**Example.** With $k = 128$ MinHash values, $b = 16$ bands, $r = 8$ rows:

- $s = 0.5$: $P = 1 - (1 - 0.5^8)^{16} = 0.063$ (6.3% chance of detection)
- $s = 0.8$: $P = 1 - (1 - 0.8^8)^{16} = 0.998$ (99.8% chance of detection)
- Threshold: $s^* = (1/16)^{1/8} \approx 0.72$

### 2.4 Quality Filtering

**Perplexity-Based Filtering.** Train a small language model (e.g., KenLM 5-gram) on high-quality reference text (Wikipedia). Score each document by perplexity and discard those above a threshold.

$$\text{PPL}(d) = \exp\left(-\frac{1}{T}\sum_{t=1}^{T} \log p_{\text{ref}}(x_t \mid x_{<t})\right)$$

Documents with $\text{PPL}(d) > \tau$ (e.g., $\tau = 1000$) are discarded.

**Heuristic Filters (from C4, FineWeb, Gopher):**

| Filter | Rule | Rationale |
|--------|------|-----------|
| Length | Remove docs with < 50 or > 100,000 words | Too short = low content; too long = boilerplate |
| Word length | Remove if mean word length > 10 chars | Non-natural text |
| Repetition | Remove if any line repeated > 3 times | Boilerplate |
| Terminal punctuation | Remove if < 5% of lines end with `.!?` | Non-prose |
| Bullet/ellipsis ratio | Remove if > 90% of lines start with bullet | Lists without context |
| Stop-word ratio | Remove if fewer than 2% of tokens are stop words | Non-natural text |
| Flagged word ratio | Remove if > 1% of words are flagged | Toxic/explicit content |
| JavaScript/HTML | Remove if contains `{` or `<div` above threshold | Code in text |

**Classifier-Based Filtering.** Train a binary classifier (e.g., fastText) on positive examples (Wikipedia, curated text) and negative examples (random web crawl). Score each document and keep those above a quality threshold.

### 2.5 PII Removal

Personally Identifiable Information (PII) must be removed or anonymized. Common patterns:

- **Email addresses**: regex `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`
- **Phone numbers**: regex patterns for international formats
- **IP addresses**: `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b`
- **Social Security Numbers**: `\b\d{3}-\d{2}-\d{4}\b`

Named Entity Recognition (NER) models can identify and mask person names, locations, and organizations.

### 2.6 Data Mixing

Given $K$ domains (web, books, code, Wikipedia, etc.) with datasets $\mathcal{D}_1, \ldots, \mathcal{D}_K$, what sampling proportions $(\pi_1, \ldots, \pi_K)$ maximize downstream performance?

**Static Mixing.** Fixed proportions throughout training:

$$p(\text{sample from domain } k) = \pi_k, \quad \sum_{k=1}^K \pi_k = 1$$

**Proportional Mixing.** $\pi_k \propto |\mathcal{D}_k|$ — sample proportional to domain size. This underweights rare, high-quality domains.

**Temperature-Based Mixing.** (Raffel et al., 2020):

$$\pi_k = \frac{|\mathcal{D}_k|^{1/T}}{\sum_j |\mathcal{D}_j|^{1/T}}$$

where $T$ is a temperature. $T = 1$ gives proportional mixing; $T \to 0$ gives uniform mixing; $T \to \infty$ gives all weight to the largest domain.

**Optimal Mixing (DoReMi).** Xie et al. (2023) proposed learning the mixing proportions online:

1. Train a small reference model $p_{\text{ref}}$ on the full dataset.
2. Train a proxy model $p_\theta$ with learnable domain weights $\lambda = (\lambda_1, \ldots, \lambda_K)$.
3. Update $\lambda_k$ to maximize the worst-case performance across domains:

$$\lambda_k^{(t+1)} \propto \lambda_k^{(t)} \cdot \exp\left(\eta \cdot \mathbb{E}_{x \sim \mathcal{D}_k}\left[\ell(p_\theta, x) - \ell(p_{\text{ref}}, x)\right]\right)$$

This upweights domains where the proxy model underperforms the reference model, automatically finding a balanced mix.

### 2.7 Training Infrastructure: Parallelism Strategies

Training a model with $N$ parameters requires memory for:

$$\text{Memory} = \underbrace{2N}_{\text{params (fp16)}} + \underbrace{2N}_{\text{gradients (fp16)}} + \underbrace{12N}_{\text{optimizer (fp32 params + momentum + variance)}} + \underbrace{?}_{\text{activations}}$$

For a 70B model: $16 \times 70 \times 10^9 = 1.12$ TB just for parameters, gradients, and optimizer states. This exceeds any single GPU's memory.

**Data Parallelism (DP).** Replicate the full model on each GPU. Each GPU processes different data. Synchronize gradients via AllReduce.

Let there be $P$ GPUs. Each GPU computes gradients on a local mini-batch of size $B/P$:

$$g_i = \frac{1}{B/P} \sum_{j=1}^{B/P} \nabla_\theta \ell(x_{ij}, \theta), \quad i = 1, \ldots, P$$

AllReduce computes:

$$\bar{g} = \frac{1}{P} \sum_{i=1}^P g_i$$

and distributes $\bar{g}$ to all GPUs. Communication cost: $O(N)$ per step (ring AllReduce sends $2N$ values).

**Tensor Parallelism (TP).** Split individual layers across GPUs. For a linear layer $Y = XW$ with $W \in \mathbb{R}^{d \times d'}$:

**Column parallel:** Split $W$ column-wise across $P$ GPUs:

$$W = [W_1 | W_2 | \cdots | W_P], \quad W_i \in \mathbb{R}^{d \times d'/P}$$

Each GPU $i$ computes $Y_i = X W_i \in \mathbb{R}^{B \times d'/P}$. A subsequent row-parallel layer can consume this directly.

**Row parallel:** Split $W$ row-wise:

$$W = \begin{bmatrix} W_1 \\ W_2 \\ \vdots \\ W_P \end{bmatrix}, \quad W_i \in \mathbb{R}^{d/P \times d'}$$

Each GPU $i$ computes $Y_i = X_i W_i$ where $X_i$ is the corresponding columns of $X$. The outputs are summed via AllReduce: $Y = \sum_i Y_i$.

**For Multi-Head Attention:** Split heads across GPUs. With $H$ heads and $P$ GPUs, each GPU handles $H/P$ heads. The QKV projections are column-parallel; the output projection is row-parallel.

**Pipeline Parallelism (PP).** Assign different layers to different GPUs:

$$\text{GPU}_1: \text{layers } 1\text{–}8, \quad \text{GPU}_2: \text{layers } 9\text{–}16, \quad \ldots$$

**The Bubble Problem.** Naive pipeline parallelism has low utilization due to the "pipeline bubble": while GPU 2 processes microbatch 1's layers 9–16, GPU 1 is idle.

**GPipe** (Huang et al., 2019): Split each mini-batch into $M$ microbatches. Forward all microbatches sequentially, accumulate gradients, then backward all. Bubble fraction: $(P-1)/(M+P-1)$. With $M \gg P$, bubble is small.

**PipeDream** (1F1B Schedule): Alternate forward and backward passes. Each GPU starts backward as soon as the corresponding forward completes. Reduces memory by not storing all microbatch activations simultaneously.

**ZeRO (Zero Redundancy Optimizer).** DeepSpeed's ZeRO eliminates memory redundancy across data-parallel GPUs:

| Stage | What is sharded | Memory per GPU | Communication |
|-------|----------------|---------------|---------------|
| ZeRO-1 | Optimizer states | $2N + 2N + 12N/P$ | AllGather for optim update |
| ZeRO-2 | + Gradients | $2N + 2N/P + 12N/P$ | Reduce-Scatter for grads |
| ZeRO-3 | + Parameters | $(2N + 2N + 12N)/P$ | AllGather for params |

**ZeRO-3 Memory per GPU:**

$$\text{Memory} = \frac{16N}{P} + \text{activation memory}$$

For 70B parameters on $P = 64$ GPUs: $16 \times 70 \times 10^9 / 64 = 17.5$ GB per GPU (fits on 80GB A100/H100).

### 2.8 Mixed Precision Training

**BF16 Training.** Brain floating point (bfloat16) uses 8 exponent bits and 7 mantissa bits, providing the same dynamic range as float32 but with lower precision. This is critical for training stability: fp16 (5 exponent, 10 mantissa) has insufficient dynamic range for gradients and loss values.

**The Loss Scaling Trick (for fp16).** Multiply the loss by a large factor $S$ before backward pass, then divide gradients by $S$ after:

$$g_{\text{fp16}} = S \cdot \nabla_\theta \ell(\theta) \quad \Rightarrow \quad g = g_{\text{fp16}} / S$$

This keeps small gradients above the fp16 underflow threshold ($\sim 6 \times 10^{-5}$). Dynamic loss scaling adjusts $S$ automatically: increase $S$ if no overflow for $K$ consecutive steps; halve $S$ on overflow.

### 2.9 Training Stability

**Loss Spikes.** Sudden increases in training loss, observed in GPT-3, PaLM, and other large runs. Causes:

1. **Data quality**: a batch of unusually bad data.
2. **Numerical instability**: overflow in attention logits or layer norms.
3. **Learning rate**: too high in combination with a difficult batch.

**Mitigations:**

- Skip batches where loss exceeds $k$ standard deviations of the running mean.
- Clip gradient norms: $\|g\| \leq G_{\max}$ (typically $G_{\max} = 1.0$).
- Use $z$-loss regularization: add $\alpha \cdot \log^2 Z$ to the loss, where $Z = \sum_v \exp(\ell_v)$ is the softmax partition function. This prevents logit magnitudes from growing.

**Learning Rate Schedule.** The standard schedule for LLM pretraining:

1. **Linear warmup** for $W$ steps: $\eta_t = \eta_{\max} \cdot t / W$
2. **Cosine decay** from step $W$ to $T$:

$$\eta_t = \eta_{\min} + \frac{1}{2}(\eta_{\max} - \eta_{\min})\left(1 + \cos\left(\pi \cdot \frac{t - W}{T - W}\right)\right)$$

Typical values: $\eta_{\max} = 3 \times 10^{-4}$, $\eta_{\min} = \eta_{\max} / 10$, $W = 2000$ steps.

### 2.10 Evaluation During Pretraining

**Validation Perplexity.** Track perplexity on held-out data from each domain:

$$\text{PPL} = \exp\left(-\frac{1}{T}\sum_{t=1}^T \log p_\theta(x_t \mid x_{<t})\right)$$

**Downstream Probes.** Periodically evaluate on benchmark tasks without fine-tuning:

- **HellaSwag**: commonsense reasoning (accuracy)
- **ARC**: science questions (accuracy)
- **MMLU**: multi-domain knowledge (accuracy)
- **TruthfulQA**: factual accuracy

**Early Stopping Heuristics.** In practice, LLMs are not early-stopped (data is only seen once). Instead, the final checkpoint is used. But monitoring downstream metrics helps detect catastrophic issues.

---

## 3. Algorithmic Derivation

### 3.1 MinHash Deduplication Pipeline

```
Algorithm: MinHash Deduplication
─────────────────────────────────
Input: Corpus D = {d_1, ..., d_N}, num_hashes k, bands b, rows r = k/b,
       n-gram size n, similarity threshold τ
Output: Deduplicated corpus D'

1. Shingling:
   For each document d_i:
     S_i = {all n-grams of d_i}    (set of strings)

2. MinHash Signatures:
   For each document d_i:
     sig_i = [MinHash_{h_1}(S_i), ..., MinHash_{h_k}(S_i)]    ∈ ℤ^k

3. LSH Banding:
   Initialize b hash tables, one per band
   For each document d_i:
     For band j = 1 to b:
       band_hash = hash(sig_i[(j-1)*r : j*r])
       Insert (i, band_hash) into hash_table_j

4. Candidate Pair Generation:
   candidates = {}
   For each hash table j:
     For each bucket with multiple documents:
       For each pair (i, i') in the bucket:
         candidates.add((min(i,i'), max(i,i')))

5. Verification and Clustering:
   For each candidate pair (i, i'):
     sim = (number of matching positions in sig_i, sig_i') / k
     If sim ≥ τ:
       Mark i and i' as duplicates (union-find)

6. Deduplication:
   For each cluster of duplicates:
     Keep one representative (e.g., longest or highest quality)
     Remove the rest

7. Return D' = remaining documents

Complexity:
  Shingling: O(N * avg_doc_len)
  MinHash:   O(N * k * avg_doc_len)  (but optimized with single-pass)
  LSH:       O(N * b) expected, up to O(N²) worst case
  Total:     O(N * k * avg_doc_len) typical
Memory:      O(N * k) for signatures
```

### 3.2 Data Mixing with DoReMi

```
Algorithm: DoReMi Domain Reweighting
──────────────────────────────────────
Input: Domains D_1,...,D_K, reference model p_ref, proxy model p_θ, learning rate η
Output: Optimal domain weights λ* = (λ_1,...,λ_K)

1. Initialize: λ_k = 1/K for all k (uniform)

2. Train reference model p_ref on uniform mix to convergence

3. For T optimization steps:
   a. Sample batch B_k ~ D_k for each domain k

   b. Compute excess loss per domain:
      δ_k = (1/|B_k|) Σ_{x∈B_k} [ℓ(p_θ, x) - ℓ(p_ref, x)]

   c. Update weights (exponentiated gradient):
      λ_k ← λ_k · exp(η · max(δ_k, 0))
      λ ← λ / Σ_k λ_k  (normalize)

   d. Sample training batch according to weights λ
      Train proxy model p_θ on this batch

4. Return λ*

Rationale: Domains where the proxy underperforms the reference
are upweighted, ensuring no domain is neglected.
```

### 3.3 Gradient Accumulation with Mixed Precision

```
Algorithm: Mixed-Precision Training with Gradient Accumulation
──────────────────────────────────────────────────────────────
Input: Model θ (fp32 master copy), data loader, accumulation steps A,
       loss scale S (dynamic)
Output: Trained model

1. θ_bf16 = cast(θ, bfloat16)  (working copy)

2. For each training step:
   g_accumulated = 0  (fp32)

   For a = 1 to A:
     x = next_batch()
     loss = forward(θ_bf16, x)              (bf16 computation)
     scaled_loss = loss * S
     g_bf16 = backward(scaled_loss, θ_bf16)  (bf16 gradients)
     g_accumulated += cast(g_bf16, fp32) / S  (unscale and accumulate in fp32)

   g = g_accumulated / A                      (average over accumulation steps)

   If any(isinf(g) or isnan(g)):
     S = S / 2                                (reduce loss scale)
     Continue (skip this step)

   clip_grad_norm(g, max_norm=1.0)
   θ = optimizer_step(θ, g)                   (fp32 update)
   θ_bf16 = cast(θ, bfloat16)                 (update working copy)

   If no overflow for last 2000 steps:
     S = S * 2                                (increase loss scale)
```

---

## 4. PyTorch Implementation

### 4.1 MinHash Deduplication

```python
import hashlib
import struct
import collections
from typing import List, Set, Tuple, Dict
import numpy as np

class MinHashDeduplicator:
    """Near-duplicate detection using MinHash + LSH."""

    def __init__(
        self,
        num_hashes: int = 128,
        num_bands: int = 16,
        ngram_size: int = 5,
        threshold: float = 0.8,
        seed: int = 42,
    ):
        self.num_hashes = num_hashes                    # k
        self.num_bands = num_bands                      # b
        self.rows_per_band = num_hashes // num_bands    # r
        self.ngram_size = ngram_size
        self.threshold = threshold

        # Generate random hash function parameters: h(x) = (a*x + b) mod p
        rng = np.random.RandomState(seed)
        self.PRIME = (1 << 61) - 1  # Mersenne prime
        self.hash_a = rng.randint(1, self.PRIME, size=num_hashes)  # (k,)
        self.hash_b = rng.randint(0, self.PRIME, size=num_hashes)  # (k,)

    def _get_ngrams(self, text: str) -> Set[str]:
        """Extract word n-grams from text.

        Args:
            text: input document

        Returns:
            set of n-gram strings
        """
        words = text.lower().split()
        if len(words) < self.ngram_size:
            return {text.lower()}
        return {
            " ".join(words[i:i + self.ngram_size])
            for i in range(len(words) - self.ngram_size + 1)
        }

    def _hash_ngram(self, ngram: str) -> int:
        """Hash an n-gram to a 64-bit integer."""
        return int(hashlib.md5(ngram.encode()).hexdigest()[:16], 16)

    def _compute_signature(self, ngrams: Set[str]) -> np.ndarray:
        """Compute MinHash signature for a set of n-grams.

        Args:
            ngrams: set of n-gram strings

        Returns:
            signature array of shape (num_hashes,)
        """
        sig = np.full(self.num_hashes, np.iinfo(np.int64).max, dtype=np.int64)  # (k,)

        for ngram in ngrams:
            h = self._hash_ngram(ngram)
            # Apply all hash functions: h_i(x) = (a_i * x + b_i) mod p
            hashes = (self.hash_a * h + self.hash_b) % self.PRIME  # (k,)
            sig = np.minimum(sig, hashes)  # element-wise min

        return sig

    def _lsh_candidates(
        self,
        signatures: List[np.ndarray],
    ) -> Set[Tuple[int, int]]:
        """Find candidate duplicate pairs using LSH banding.

        Args:
            signatures: list of MinHash signatures, each of shape (num_hashes,)

        Returns:
            set of candidate (i, j) pairs
        """
        candidates: Set[Tuple[int, int]] = set()

        for band in range(self.num_bands):
            start = band * self.rows_per_band
            end = start + self.rows_per_band

            # Hash each document's band to a bucket
            buckets: Dict[bytes, List[int]] = collections.defaultdict(list)
            for doc_id, sig in enumerate(signatures):
                band_slice = sig[start:end]                    # (r,)
                band_hash = band_slice.tobytes()               # bytes
                buckets[band_hash].append(doc_id)

            # All pairs within a bucket are candidates
            for bucket_docs in buckets.values():
                if len(bucket_docs) > 1:
                    for i in range(len(bucket_docs)):
                        for j in range(i + 1, len(bucket_docs)):
                            candidates.add((bucket_docs[i], bucket_docs[j]))

        return candidates

    def deduplicate(self, documents: List[str]) -> List[int]:
        """Find and remove near-duplicate documents.

        Args:
            documents: list of document strings

        Returns:
            indices of documents to keep
        """
        N = len(documents)
        print(f"Deduplicating {N} documents...")

        # Step 1: Compute n-grams and signatures
        signatures = []
        for i, doc in enumerate(documents):
            ngrams = self._get_ngrams(doc)
            sig = self._compute_signature(ngrams)   # (k,)
            signatures.append(sig)
            if (i + 1) % 1000 == 0:
                print(f"  Computed {i+1}/{N} signatures")

        # Step 2: LSH candidate pairs
        candidates = self._lsh_candidates(signatures)
        print(f"  Found {len(candidates)} candidate pairs")

        # Step 3: Verify candidates and build duplicate clusters (union-find)
        parent = list(range(N))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py

        for i, j in candidates:
            # Estimate Jaccard similarity from signatures
            matches = np.sum(signatures[i] == signatures[j])
            estimated_sim = matches / self.num_hashes
            if estimated_sim >= self.threshold:
                union(i, j)

        # Step 4: Keep one document per cluster (first occurrence)
        seen_roots = set()
        keep_indices = []
        for i in range(N):
            root = find(i)
            if root not in seen_roots:
                seen_roots.add(root)
                keep_indices.append(i)

        removed = N - len(keep_indices)
        print(f"  Removed {removed} duplicates ({100*removed/N:.1f}%)")
        return keep_indices

def demo_deduplication():
    """Demonstrate MinHash deduplication."""
    documents = [
        "The quick brown fox jumps over the lazy dog in the park on a sunny day",
        "The quick brown fox jumps over the lazy dog in the park on a rainy day",  # near-dup
        "Machine learning models can process natural language text effectively",
        "Deep neural networks have revolutionized computer vision tasks",
        "The fast brown fox leaps over the sleepy dog in the garden on a sunny day",  # near-dup
        "Machine learning models can process natural language text very effectively",  # near-dup
        "Transformers use self-attention to model sequential dependencies",
        "Deep neural networks have revolutionized computer vision tasks today",  # near-dup
    ]

    dedup = MinHashDeduplicator(num_hashes=64, num_bands=8, ngram_size=3, threshold=0.5)
    keep = dedup.deduplicate(documents)

    print(f"\nKept documents ({len(keep)}/{len(documents)}):")
    for i in keep:
        print(f"  [{i}] {documents[i][:80]}...")
```

### 4.2 Learning Rate Schedule

```python
import torch
import math
import matplotlib.pyplot as plt

class CosineWarmupScheduler(torch.optim.lr_scheduler._LRScheduler):
    """Learning rate schedule with linear warmup and cosine decay.

    Used in GPT-3, LLaMA, and most modern LLM training.
    """

    def __init__(
        self,
        optimizer: torch.optim.Optimizer,
        warmup_steps: int,
        total_steps: int,
        min_lr_ratio: float = 0.1,
    ):
        self.warmup_steps = warmup_steps
        self.total_steps = total_steps
        self.min_lr_ratio = min_lr_ratio
        super().__init__(optimizer)

    def get_lr(self):
        step = self.last_epoch
        if step < self.warmup_steps:
            # Linear warmup
            scale = step / max(1, self.warmup_steps)
        else:
            # Cosine decay
            progress = (step - self.warmup_steps) / max(1, self.total_steps - self.warmup_steps)
            progress = min(progress, 1.0)
            scale = self.min_lr_ratio + 0.5 * (1.0 - self.min_lr_ratio) * (1 + math.cos(math.pi * progress))

        return [base_lr * scale for base_lr in self.base_lrs]

def plot_lr_schedule():
    """Visualize the cosine warmup learning rate schedule."""
    # Create a dummy model and optimizer
    model = torch.nn.Linear(10, 10)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.1)

    total_steps = 100000
    warmup_steps = 2000
    scheduler = CosineWarmupScheduler(optimizer, warmup_steps, total_steps, min_lr_ratio=0.1)

    lrs = []
    for step in range(total_steps):
        lrs.append(scheduler.get_last_lr()[0])
        scheduler.step()

    plt.figure(figsize=(10, 4))
    plt.plot(lrs)
    plt.xlabel("Training Step")
    plt.ylabel("Learning Rate")
    plt.title("Cosine Warmup Schedule (warmup=2000, total=100K)")
    plt.axvline(warmup_steps, color="r", linestyle="--", alpha=0.5, label="End of warmup")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig("lr_schedule.png", dpi=150)
    plt.show()
```

### 4.3 Quality Filter Implementation

```python
import re
from typing import Optional

class QualityFilter:
    """Heuristic quality filters for web-crawled text, inspired by C4 and FineWeb."""

    def __init__(
        self,
        min_words: int = 50,
        max_words: int = 100000,
        max_mean_word_length: float = 10.0,
        min_stop_word_ratio: float = 0.02,
        max_line_repetition: int = 3,
        min_terminal_punct_ratio: float = 0.05,
    ):
        self.min_words = min_words
        self.max_words = max_words
        self.max_mean_word_length = max_mean_word_length
        self.min_stop_word_ratio = min_stop_word_ratio
        self.max_line_repetition = max_line_repetition
        self.min_terminal_punct_ratio = min_terminal_punct_ratio

        self.stop_words = {
            "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "shall", "can", "need", "dare", "ought",
            "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
            "into", "through", "during", "before", "after", "above", "below",
            "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
            "neither", "each", "every", "all", "any", "few", "more", "most",
            "other", "some", "such", "no", "only", "own", "same", "than",
            "too", "very", "just", "because", "if", "when", "while", "that",
            "this", "these", "those", "i", "you", "he", "she", "it", "we", "they",
        }

        self.pii_patterns = [
            re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),  # email
            re.compile(r'\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b'),                       # phone
            re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),                  # IP
            re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),                                    # SSN
        ]

    def filter_document(self, text: str) -> tuple[bool, Optional[str]]:
        """Apply quality filters to a document.

        Args:
            text: document text

        Returns:
            (keep, reason): whether to keep the document and the rejection reason
        """
        words = text.split()
        n_words = len(words)

        # Length filter
        if n_words < self.min_words:
            return False, f"too_short ({n_words} words)"
        if n_words > self.max_words:
            return False, f"too_long ({n_words} words)"

        # Mean word length
        mean_word_len = sum(len(w) for w in words) / n_words
        if mean_word_len > self.max_mean_word_length:
            return False, f"mean_word_length ({mean_word_len:.1f})"

        # Stop word ratio
        lower_words = [w.lower() for w in words]
        stop_count = sum(1 for w in lower_words if w in self.stop_words)
        stop_ratio = stop_count / n_words
        if stop_ratio < self.min_stop_word_ratio:
            return False, f"low_stop_word_ratio ({stop_ratio:.3f})"

        # Line repetition
        lines = text.split("\n")
        line_counts = collections.Counter(lines)
        max_rep = max(line_counts.values()) if line_counts else 0
        if max_rep > self.max_line_repetition:
            return False, f"line_repetition (max {max_rep})"

        # Terminal punctuation
        if lines:
            terminal = sum(1 for line in lines if line.strip() and line.strip()[-1] in ".!?")
            non_empty = sum(1 for line in lines if line.strip())
            if non_empty > 0:
                punct_ratio = terminal / non_empty
                if punct_ratio < self.min_terminal_punct_ratio:
                    return False, f"low_terminal_punct ({punct_ratio:.3f})"

        return True, None

    def remove_pii(self, text: str) -> str:
        """Replace PII patterns with placeholder tokens.

        Args:
            text: input text

        Returns:
            text with PII replaced
        """
        result = text
        replacements = ["[EMAIL]", "[PHONE]", "[IP_ADDRESS]", "[SSN]"]
        for pattern, replacement in zip(self.pii_patterns, replacements):
            result = pattern.sub(replacement, result)
        return result

def demo_quality_filter():
    """Demonstrate quality filtering."""
    qf = QualityFilter()

    documents = [
        # Good document
        "The transformer architecture has revolutionized natural language processing. "
        "Self-attention mechanisms allow models to capture long-range dependencies. "
        "This has led to significant improvements in tasks like translation and summarization. "
        * 5,

        # Too short
        "Hello world.",

        # Low stop word ratio (technical gibberish)
        "xyzzy plugh frobnicate gazorninplat " * 20,

        # High line repetition (boilerplate)
        "Click here to subscribe\n" * 10 + "Some actual content here.",
    ]

    print("=== Quality Filter Demo ===")
    for i, doc in enumerate(documents):
        keep, reason = qf.filter_document(doc)
        status = "KEEP" if keep else f"REJECT ({reason})"
        print(f"  Document {i}: {status} (first 60 chars: '{doc[:60]}...')")

    # PII removal demo
    text_with_pii = "Contact john@example.com or call 555-123-4567. Server at 192.168.1.1."
    cleaned = qf.remove_pii(text_with_pii)
    print(f"\nPII removal:")
    print(f"  Before: {text_with_pii}")
    print(f"  After:  {cleaned}")

if __name__ == "__main__":
    demo_deduplication()
    print("\n" + "=" * 60 + "\n")
    demo_quality_filter()
    print("\n" + "=" * 60 + "\n")
    plot_lr_schedule()
```

---

## 5. Experimental Intuition

### 5.1 How Much Data Filtering Matters

The FineWeb paper (Penedo et al., 2024) showed that:

- Raw Common Crawl: $\text{PPL} \approx 35$ on validation set after 1T tokens of training.
- After URL dedup: $\text{PPL} \approx 30$ (14% improvement).
- After quality filtering: $\text{PPL} \approx 25$ (further 17% improvement).
- After dedup + quality: $\text{PPL} \approx 22$ (37% total improvement).

This improvement from filtering is equivalent to approximately $4\times$ more compute with unfiltered data.

### 5.2 Data Repetition

When data is limited, some repetition is inevitable. Muennighoff et al. (2023) found:

- 1–4 epochs: minimal degradation.
- 4–16 epochs: gradual degradation, roughly equivalent to using $D_{\text{eff}} \approx D / \log(\text{epochs})$ unique tokens.
- >16 epochs: severe memorization and overfitting.

The practical rule: if $D_{\text{unique}} < D_{\text{Chinchilla-optimal}}$, it is better to use a smaller model trained on unique data than a larger model trained with many repeats.

### 5.3 The Parallelism Decision Tree

| Budget | Model Size | Strategy |
|--------|-----------|----------|
| 1 GPU | <1B | No parallelism, gradient accumulation |
| 2–8 GPUs | 1–10B | Data parallelism (DDP) or FSDP (ZeRO-3) |
| 8–64 GPUs | 10–70B | FSDP + tensor parallelism (TP=8 within node) |
| 64–1000 GPUs | 70–200B | FSDP + TP + pipeline parallelism |
| 1000+ GPUs | 200B+ | Full 3D parallelism: DP x TP x PP |

### 5.4 Memory Budgeting for a 7B Model

| Component | Precision | Size |
|-----------|-----------|------|
| Parameters | bf16 | 14 GB |
| Gradients | bf16 | 14 GB |
| Optimizer (AdamW) | fp32 | 84 GB (3 copies: params, momentum, variance, each 28 GB) |
| Activations (seq_len=4096, batch=1) | bf16 | ~8 GB |
| **Total** | | **~120 GB** |

With FSDP on 8 GPUs: $120/8 \approx 15$ GB per GPU (fits on 40GB A100). With gradient checkpointing, activation memory drops to ~2 GB, freeing space for larger batch sizes.

---

## 6. Connections

- **Module 05a (Scaling Laws)**: Data quality shifts the constants $A, B$ in the scaling law. Higher-quality data effectively increases the value of each token.
- **Module 05b (GPT/BERT/LLaMA)**: Architecture choices interact with parallelism strategies. LLaMA's no-bias design simplifies tensor parallelism.
- **Module 05c (Tokenization)**: Tokenizer training should use data from the same distribution as pretraining data. Mismatch leads to high fertility and wasted compute.
- **Module 06 (Alignment)**: Data curation for alignment (instruction data, preference data) follows different principles — quality over quantity.
- **Module 00c (Optimization)**: Learning rate schedules and gradient clipping build on optimization fundamentals.

---

## 7. Paper Reading List

### Required

1. **Penedo et al. (2024)**. *The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale*. arXiv:2406.17557.
   - The most comprehensive modern data curation paper. Read the filtering pipeline description.

2. **Rajbhandari et al. (2020)**. *ZeRO: Memory Optimizations Toward Training Trillion Parameter Models*. arXiv:1910.02054.
   - The ZeRO paper. Read Sections 3–4 for the three stages and their memory analysis.

3. **Touvron et al. (2023)**. *LLaMA: Open and Efficient Foundation Language Models*. Section 2 (Training).
   - Read for the data mix and training configuration.

### Recommended

4. **Together (2023)**. *RedPajama: An Open Dataset for Training Large Language Models*.
   - Read for the data composition and replication of LLaMA's data mix.

5. **Narayanan et al. (2021)**. *Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM*. arXiv:2104.04473.
   - Tensor and pipeline parallelism for Transformers.

6. **Huang et al. (2019)**. *GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism*. arXiv:1811.06965.
   - The GPipe scheduling algorithm.

7. **Lee et al. (2022)**. *Deduplicating Training Data Makes Language Models Better*. arXiv:2107.06499.
   - Systematic study of deduplication effects on LLM quality.

### Advanced

8. **Xie et al. (2023)**. *DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining*. arXiv:2305.10429.
   - Learned data mixing weights.

9. **Muennighoff et al. (2023)**. *Scaling Data-Constrained Language Models*. arXiv:2305.16264.
   - Analysis of data repetition and value of unique data.

---

## 8. Exercises

### Conceptual

**Exercise 5d.1.** Prove the MinHash theorem: $\Pr[\text{MinHash}_h(A) = \text{MinHash}_h(B)] = J(A, B)$ for a uniformly random hash function $h$.

**Exercise 5d.2.** For an LSH scheme with $b$ bands and $r$ rows per band, derive the false positive rate $P_{\text{FP}}(s) = 1 - (1 - s^r)^b$ as a function of true Jaccard similarity $s$. For a target threshold $s^* = 0.8$, find the values of $b$ and $r$ (with $b \cdot r = 128$) that minimize the sum of false positive and false negative rates at $s^*$.

**Exercise 5d.3.** Derive the memory requirements for ZeRO Stage 1, 2, and 3 for a model with $N$ parameters on $P$ GPUs. Express each in terms of $N$, $P$, and the byte widths for fp16 and fp32.

**Exercise 5d.4.** Prove that the communication volume of ring AllReduce is $2N \cdot (P-1)/P \approx 2N$ for large $P$, regardless of the number of GPUs (it does not increase with $P$, only the number of communication steps does).

### Computational

**Exercise 5d.5.** Implement the MinHash deduplication pipeline above. Generate a corpus of 10,000 documents with 20% near-duplicates (Jaccard > 0.8) and measure the precision and recall of your deduplication at different thresholds.

**Exercise 5d.6.** Implement the quality filter and apply it to a sample of Common Crawl data (use the `datasets` library to load `allenai/c4`). Report: (a) what fraction of documents is filtered at each stage, (b) the average document length before and after filtering, (c) sample rejected documents from each filter.

**Exercise 5d.7.** Implement the cosine warmup learning rate schedule. Train a small GPT-2 (10M parameters) on Tiny Shakespeare with three schedules: (a) constant LR, (b) cosine decay (no warmup), (c) warmup + cosine decay. Plot training loss curves and compare final validation loss.

**Exercise 5d.8.** Compute the memory budget for training LLaMA-7B with: (a) vanilla data parallelism on 8x A100-80GB, (b) FSDP (ZeRO-3) on 8x A100-80GB, (c) FSDP + gradient checkpointing. For each, determine the maximum batch size per GPU.

**Exercise 5d.9 (Research-Level).** Implement a simplified DoReMi: train a small LM on a mix of 3 domains (Wikipedia, books, web) with learnable domain weights. Show that the learned weights improve validation perplexity compared to uniform and proportional mixing.
