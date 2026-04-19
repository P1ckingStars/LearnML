# Lecture 08c: Data Curation at Scale: Deduplication, Filtering, Quality Scoring

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Justify** why data quality dominates data quantity for modern LLM pretraining by citing empirical evidence from scaling law studies and ablation experiments on curated datasets.
2. **Implement** exact deduplication (document-level and paragraph-level hashing), near-duplicate detection (MinHash with LSH), and semantic deduplication pipelines, analyzing their computational complexity and false-positive/negative tradeoffs.
3. **Design** multi-stage data filtering pipelines that combine heuristic rules, perplexity-based filtering, and classifier-based quality scoring, calibrating each stage's precision-recall tradeoff for a target downstream task.
4. **Evaluate** toxicity filtering and PII removal systems, reasoning about the tension between safety, data loss, and bias amplification.
5. **Critique** the data processing pipelines of major open datasets (Common Crawl, FineWeb, RedPajama, Dolma) and identify which design decisions most impact downstream model quality.

---

## 2. Motivation and Context

### 2.1 The Data-Centric AI Shift

The first generation of deep learning research (2012--2020) focused almost exclusively on model architecture and training algorithms, treating data as a fixed input. Benchmark datasets (ImageNet, SQuAD, WMT) were canonical, and progress was measured by squeezing more accuracy from the same data.

The LLM era inverted this paradigm. The Chinchilla scaling laws (Hoffmann et al., 2022) showed that compute-optimal training requires scaling data proportionally to model size: a 70B parameter model needs ~1.4T tokens. At this scale, the internet is your dataset, and the quality of that dataset becomes the dominant factor in model quality.

Empirical evidence:

- **Phi-1** (Gunasekar et al., 2023): A 1.3B model trained on 7B tokens of "textbook-quality" data matched GPT-3.5 on coding benchmarks. The curation was more important than the model architecture.
- **FineWeb** (Penedo et al., 2024): Systematic ablations showed that deduplication alone improved downstream performance by 2--5% across benchmarks, and quality filtering added another 3--7%.
- **Dolma** (Soldaini et al., 2024): Documented that removing 40% of Common Crawl through filtering improved perplexity by 8% compared to training on unfiltered data.

### 2.2 The Cost of Bad Data

Bad data does not merely waste compute --- it actively harms the model:

- **Duplicated text** causes memorization, reducing generalization. A passage seen 100x is effectively 100x overweighted in the loss.
- **Low-quality text** (boilerplate, SEO spam, auto-generated content) dilutes the signal from high-quality text, requiring more compute to learn the same capabilities.
- **Toxic content** can cause the model to reproduce harmful outputs, creating safety and legal risks.
- **PII leakage** (emails, phone numbers, addresses) creates privacy violations and potential regulatory liability (GDPR, CCPA).
- **Benchmark contamination** inflates evaluation metrics, making it impossible to measure true capability.

### 2.3 Scope

This lecture covers the data curation pipeline for text pretraining data, with a focus on web-crawled corpora. The techniques generalize to image-text pairs (see Lecture 08d) and code datasets, with domain-specific adaptations.

---

## 3. The Data Curation Pipeline

### 3.1 Pipeline Overview

A typical curation pipeline for web text processes data through multiple stages:

```
Raw Crawl (e.g., Common Crawl, ~250 TB compressed)
    |
    v
[1. URL Filtering]           Block known-bad domains, adult content
    |
    v
[2. Text Extraction]         Strip HTML, extract main content (trafilatura, resiliparse)
    |
    v
[3. Language Detection]      Identify language, filter to target languages (fastText LID)
    |
    v
[4. Heuristic Filtering]     Line-level and document-level rules
    |
    v
[5. Deduplication]           Exact + near-duplicate removal
    |
    v
[6. Quality Filtering]       Perplexity-based, classifier-based scoring
    |
    v
[7. PII Removal]             Regex + NER-based PII scrubbing
    |
    v
[8. Toxicity Filtering]      Classifier-based toxicity scoring
    |
    v
Curated Dataset (~5--15% of raw crawl)
```

Each stage is a filter that reduces the dataset size. The order matters: cheap, high-recall filters (URL blocking, heuristics) are applied first to reduce the volume for expensive filters (classifier-based quality scoring).

---

## 4. Deduplication

### 4.1 Why Deduplication Matters

Web crawls contain massive amounts of duplication:

- **Exact duplicates**: The same page crawled multiple times, mirror sites, syndicated content.
- **Near-duplicates**: Slightly modified copies (different headers/footers, minor edits, translated-and-back-translated content).
- **Boilerplate**: Cookie banners, navigation menus, and legal disclaimers that appear on every page of a site.

Lee et al. (2022) showed that deduplication of C4 reduced the dataset by ~30% while improving downstream perplexity by 0.3--0.5 nats. The effect is larger for smaller models (where memorization is a greater fraction of learning).

### 4.2 Exact Deduplication

**Document-level hashing**: Compute a hash (SHA-256, MD5) of each document's normalized text. Documents with identical hashes are exact duplicates.

```python
import hashlib
from collections import defaultdict

def exact_dedup(documents: list[str]) -> list[str]:
    """Remove exact duplicate documents via content hashing."""
    seen = set()
    unique = []
    for doc in documents:
        # Normalize: lowercase, strip whitespace, remove punctuation
        normalized = doc.lower().strip()
        doc_hash = hashlib.sha256(normalized.encode('utf-8')).hexdigest()
        if doc_hash not in seen:
            seen.add(doc_hash)
            unique.append(doc)
    return unique
```

**Complexity**: $O(n)$ time and $O(n)$ space, where $n$ is the number of documents. A SHA-256 hash is 32 bytes; for 1 billion documents, the hash set requires ~32 GB of RAM (feasible on a single machine).

**Paragraph-level (substring) deduplication**: Some pipelines hash at the paragraph or n-line level to catch documents that share large blocks of text but differ in headers/footers:

```python
def paragraph_dedup(documents: list[str], min_lines: int = 5) -> list[str]:
    """Remove documents that share large paragraph-level overlaps."""
    paragraph_hashes = defaultdict(int)  # hash -> count

    # Pass 1: Count paragraph occurrences
    for doc in documents:
        lines = doc.split('\n')
        for i in range(len(lines) - min_lines + 1):
            paragraph = '\n'.join(lines[i:i + min_lines])
            h = hashlib.md5(paragraph.encode()).hexdigest()
            paragraph_hashes[h] += 1

    # Pass 2: Flag documents with too many duplicated paragraphs
    result = []
    for doc in documents:
        lines = doc.split('\n')
        dup_count = 0
        total = max(1, len(lines) - min_lines + 1)
        for i in range(total):
            paragraph = '\n'.join(lines[i:i + min_lines])
            h = hashlib.md5(paragraph.encode()).hexdigest()
            if paragraph_hashes[h] > 1:
                dup_count += 1
        if dup_count / total < 0.5:  # less than 50% duplicated paragraphs
            result.append(doc)
    return result
```

### 4.3 Near-Duplicate Detection: MinHash + LSH

Exact hashing misses near-duplicates (documents that differ by a few words or sentences). MinHash with Locality-Sensitive Hashing (LSH) detects these efficiently.

**Step 1: Shingling.** Convert each document into a set of character n-grams (shingles):

$$S(d) = \{d[i:i+k] \mid 0 \leq i \leq |d| - k\}$$

Typical $k = 9$--$13$ for character shingles or $k = 5$ for word shingles.

**Step 2: MinHash signature.** For each document, compute a signature of $m$ hash values. Each hash value is the minimum hash of any shingle under a random hash function:

$$\text{sig}(d)[j] = \min_{s \in S(d)} h_j(s), \quad j = 1, \ldots, m$$

The key property (Broder, 1997): for two documents $d_1, d_2$,

$$\Pr[\text{sig}(d_1)[j] = \text{sig}(d_2)[j]] = J(S(d_1), S(d_2))$$

where $J(A, B) = |A \cap B| / |A \cup B|$ is the Jaccard similarity.

**Step 3: LSH banding.** Divide the $m$-element signature into $b$ bands of $r$ rows each ($m = b \cdot r$). Two documents are candidate duplicates if their signatures agree on all $r$ rows of at least one band.

The probability that two documents with Jaccard similarity $s$ become candidates is:

$$P(\text{candidate}) = 1 - (1 - s^r)^b$$

This is an S-shaped curve. By choosing $b$ and $r$, you control the threshold:
- Approximate threshold: $t \approx (1/b)^{1/r}$
- Example: $b = 20, r = 5, m = 100 \implies t \approx 0.57$

```python
from datasketch import MinHash, MinHashLSH

def minhash_dedup(documents: list[str], threshold: float = 0.8,
                  num_perm: int = 128) -> list[int]:
    """Find near-duplicate clusters using MinHash LSH.

    Returns indices of documents to keep.
    """
    lsh = MinHashLSH(threshold=threshold, num_perm=num_perm)
    minhashes = []

    for idx, doc in enumerate(documents):
        m = MinHash(num_perm=num_perm)
        # Word-level 5-grams as shingles
        words = doc.split()
        for i in range(len(words) - 4):
            shingle = ' '.join(words[i:i+5])
            m.update(shingle.encode('utf-8'))
        minhashes.append(m)

        try:
            lsh.insert(str(idx), m)
        except ValueError:
            pass  # Duplicate detected, skip

    # Query each document; keep only cluster representatives
    keep = set()
    visited = set()
    for idx in range(len(documents)):
        if idx in visited:
            continue
        result = lsh.query(minhashes[idx])
        cluster = [int(r) for r in result]
        # Keep the longest document in each cluster
        best = max(cluster, key=lambda i: len(documents[i]))
        keep.add(best)
        visited.update(cluster)

    return sorted(keep)
```

**Complexity**: MinHash computation is $O(n \cdot |S| \cdot m)$ where $|S|$ is the average number of shingles. LSH query is $O(1)$ expected time per query. Total: approximately $O(n \cdot |S| \cdot m)$ time, $O(n \cdot m)$ space for signatures.

**Scale**: For Common Crawl (~3 billion documents), storing 128-element MinHash signatures requires ~1.5 TB. This is feasible with distributed systems (Spark, Ray) but not on a single machine. The FineWeb pipeline uses a parallelized Rust implementation of MinHash LSH.

### 4.4 Semantic Deduplication

MinHash operates on surface-level token overlap. Paraphrases or translations that convey the same information but use different words will not be detected. Semantic deduplication uses embedding similarity:

```python
from sentence_transformers import SentenceTransformer
import faiss

def semantic_dedup(documents: list[str], threshold: float = 0.95,
                   batch_size: int = 1024) -> list[int]:
    """Semantic deduplication via embedding similarity."""
    model = SentenceTransformer("all-MiniLM-L6-v2")

    # Compute embeddings
    embeddings = model.encode(documents, batch_size=batch_size,
                              show_progress_bar=True, normalize_embeddings=True)

    # Build FAISS index for efficient similarity search
    d = embeddings.shape[1]  # embedding dimension
    index = faiss.IndexFlatIP(d)  # inner product = cosine for normalized vectors
    index.add(embeddings)

    # Find near-duplicate pairs
    keep = set(range(len(documents)))
    for i in range(len(documents)):
        if i not in keep:
            continue
        # Search for neighbors with similarity > threshold
        D, I = index.search(embeddings[i:i+1], k=100)
        for sim, j in zip(D[0], I[0]):
            if j != i and j in keep and sim > threshold:
                # Remove the shorter document
                if len(documents[j]) <= len(documents[i]):
                    keep.discard(j)
                else:
                    keep.discard(i)
                    break
    return sorted(keep)
```

**Cost**: Embedding computation is expensive ($O(n)$ model forward passes). FAISS ANN search is $O(n \log n)$ with IVF indices. This is typically used as a final deduplication pass after MinHash has already removed the easy cases.

**SemDeDup** (Abbas et al., 2023) showed that removing semantic duplicates from C4 improved downstream performance even after MinHash deduplication, with the optimal deduplication aggressiveness depending on the compute budget.

### 4.5 Deduplication at Scale: Practical Considerations

**Dedup scope**: Should you deduplicate within a single crawl snapshot or across all snapshots? Cross-snapshot deduplication is more thorough but requires storing signatures for the union of all snapshots. FineWeb deduplicates independently within each of 96 Common Crawl snapshots; cross-snapshot dedup was tested and found to degrade quality.

**Dedup granularity**: Document-level dedup misses documents that share large blocks of text but differ overall. Paragraph-level or n-gram-level dedup catches more redundancy but is more expensive. The Dolma pipeline uses a suffix array approach for exact substring deduplication.

**Dedup ordering**: When two documents are duplicates, which do you keep? Common strategies:
- Keep the longer document (more context).
- Keep the document from the higher-quality domain.
- Keep the earlier crawl (less likely to be a copy of the original).

---

## 5. Heuristic Filtering

### 5.1 Line-Level Rules

These rules remove or modify individual lines within a document:

```python
def filter_lines(text: str) -> str:
    """Apply line-level heuristic filters."""
    lines = text.split('\n')
    filtered = []
    for line in lines:
        # Remove lines that are mostly non-alphabetic
        alpha_ratio = sum(c.isalpha() for c in line) / max(len(line), 1)
        if alpha_ratio < 0.5:
            continue

        # Remove very short lines (likely navigation elements)
        if len(line.split()) < 3:
            continue

        # Remove lines that end with common boilerplate patterns
        boilerplate = [
            "cookie", "privacy policy", "terms of service",
            "all rights reserved", "subscribe to our newsletter",
            "click here", "read more", "share this",
        ]
        if any(line.lower().strip().endswith(bp) for bp in boilerplate):
            continue

        filtered.append(line)
    return '\n'.join(filtered)
```

### 5.2 Document-Level Rules

These rules decide whether to keep or discard an entire document:

```python
def passes_document_filters(text: str) -> bool:
    """Apply document-level heuristic filters (inspired by C4/FineWeb)."""
    words = text.split()
    n_words = len(words)

    # Document length filters
    if n_words < 50 or n_words > 100000:
        return False

    # Mean word length (filters out garbled text)
    mean_word_len = sum(len(w) for w in words) / max(n_words, 1)
    if mean_word_len < 3 or mean_word_len > 10:
        return False

    # Fraction of lines ending with ellipsis (sign of truncation / listicles)
    lines = text.split('\n')
    ellipsis_frac = sum(1 for l in lines if l.rstrip().endswith('...')) / max(len(lines), 1)
    if ellipsis_frac > 0.3:
        return False

    # Fraction of duplicate lines (boilerplate, repetitive content)
    unique_lines = set(lines)
    if len(unique_lines) / max(len(lines), 1) < 0.5:
        return False

    # Fraction of lines starting with bullet points (sign of list-only pages)
    bullet_frac = sum(1 for l in lines if l.strip().startswith(('- ', '* ', '+ '))) / max(len(lines), 1)
    if bullet_frac > 0.9:
        return False

    # "Curly bracket" ratio: high ratio suggests code/template, not prose
    curly_ratio = text.count('{') / max(n_words, 1)
    if curly_ratio > 0.1:
        return False

    # Stop word presence: natural text contains stop words
    stop_words = {"the", "is", "at", "which", "on", "a", "an", "and", "or", "but"}
    stop_count = sum(1 for w in words if w.lower() in stop_words)
    if stop_count / max(n_words, 1) < 0.05:
        return False

    return True
```

### 5.3 The Gopher Rules

The Gopher paper (Rae et al., 2022) introduced a widely-adopted set of heuristic filters. Key rules:

| Rule | Threshold | Rationale |
|------|-----------|-----------|
| Word count | 50--100,000 | Remove too-short and too-long documents |
| Mean word length | 3--10 chars | Filter garbled/non-natural text |
| Symbol-to-word ratio | < 0.1 | Filter code, markup |
| Fraction of lines with terminal punctuation | > 0.1 | Filter non-prose content |
| Fraction of alphabetic characters | > 0.8 | Filter numeric/special char heavy text |
| "Lorem ipsum" presence | Absent | Filter placeholder text |
| Curly brace density | Low | Filter template/code |
| Stop word fraction | > 0.06 | Ensure natural language |

These rules are fast (pure string operations), high-recall (catch most obviously bad content), but low-precision (some good content is discarded). They are designed as a first pass before more expensive model-based filtering.

---

## 6. Quality Filtering

### 6.1 Perplexity-Based Filtering

The intuition: a language model trained on high-quality text will assign low perplexity to high-quality documents and high perplexity to low-quality documents.

**KenLM approach** (used by CCNet/CC-100):

1. Train a 5-gram KenLM model on a high-quality reference corpus (e.g., Wikipedia).
2. Compute the perplexity of each document under this model.
3. Remove documents in the highest perplexity quartile.

```python
import kenlm

model = kenlm.Model("wikipedia_5gram.arpa")

def compute_perplexity(text: str) -> float:
    """Compute perplexity under a KenLM model."""
    # KenLM scores are log10 probabilities per word
    words = text.split()
    log_score = model.score(text, bos=True, eos=True)
    # Perplexity = 10^(-log_score / n_words)
    n_words = len(words)
    if n_words == 0:
        return float('inf')
    return 10 ** (-log_score / n_words)

def perplexity_filter(documents: list[str], max_perplexity: float = 300.0) -> list[str]:
    """Keep only documents below the perplexity threshold."""
    return [doc for doc in documents if compute_perplexity(doc) < max_perplexity]
```

**Limitations**: Perplexity-based filtering is biased toward Wikipedia-like text. It penalizes conversational text, dialect, domain-specific jargon, and creative writing. This can systematically remove content from underrepresented communities.

### 6.2 Classifier-Based Quality Scoring

Train a binary classifier to distinguish "high-quality" from "low-quality" text:

**Training data**:
- Positive class: Wikipedia, curated books, academic papers.
- Negative class: Random web crawl samples.

```python
from fasttext import train_supervised

# Prepare training data in fastText format
# __label__hq This is a high-quality Wikipedia article about...
# __label__lq Buy cheap viagra online click here for...

model = train_supervised(
    input="quality_classifier_train.txt",
    lr=0.1,
    epoch=5,
    wordNgrams=2,
    dim=100,
    loss="softmax",
)

def quality_score(text: str) -> float:
    """Return probability of being high-quality."""
    labels, probs = model.predict(text.replace('\n', ' '), k=2)
    for label, prob in zip(labels, probs):
        if label == "__label__hq":
            return prob
    return 0.0
```

**FineWeb's approach**: The FineWeb team found that a fastText classifier trained to distinguish Wikipedia+high-quality web from random Common Crawl achieved 85% accuracy and, when used to filter the top 30% of documents by quality score, improved downstream benchmark performance by 3--5% compared to perplexity filtering alone.

### 6.3 Model-Based Quality Estimation

More sophisticated approaches use instruction-tuned LLMs to score quality:

**Instruction-based scoring** (used by DCLM, FineWeb-Edu):

```
Prompt: "Rate the educational value of this text on a scale of 0-5,
where 0 is completely non-educational and 5 is highly educational
like a textbook or tutorial. Respond with only the number."

Text: {document}
```

This is expensive ($O(n)$ LLM inference calls) but provides nuanced, controllable quality judgments. In practice, a small LLM (e.g., Llama-3-8B) is used to label a subset, which then trains a fastText classifier for the full dataset.

**FineWeb-Edu** used this approach:
1. Llama-3-70B-Instruct scored 500K samples on a 0--5 educational quality scale.
2. A regression model was trained on these labels to predict quality scores.
3. Documents with predicted scores >= 3 were kept.
4. The resulting dataset (1.3T tokens) trained models that matched or exceeded GPT-3.5 on educational benchmarks.

---

## 7. Toxicity Filtering and PII Removal

### 7.1 Toxicity Detection

Toxicity filtering aims to remove hate speech, explicit sexual content, violence, and other harmful content. Standard approaches:

**Classifier-based**: Train a text classifier on labeled toxicity datasets (Jigsaw, HateXplain):

```python
from transformers import pipeline

toxicity_classifier = pipeline(
    "text-classification",
    model="unitary/toxic-bert",
    top_k=None,
)

def toxicity_score(text: str) -> float:
    """Return maximum toxicity score across categories."""
    results = toxicity_classifier(text[:512])  # truncate for efficiency
    return max(r["score"] for r in results[0] if "toxic" in r["label"].lower())
```

**Blocklist-based**: Maintain lists of slurs, explicit terms, and known-toxic domains. Fast but brittle (easily circumvented by misspellings, euphemisms).

**Tradeoff**: Aggressive toxicity filtering disproportionately removes content about marginalized groups (discussions of racism, LGBTQ+ topics, disability). The Dolma team found that a strict toxicity filter removed 15% of documents mentioning "African American" but only 3% of documents mentioning "European." Calibration and post-hoc analysis are essential.

### 7.2 PII Removal

Personally identifiable information (PII) in training data creates privacy and legal risks. Common PII types and detection methods:

```python
import re

PII_PATTERNS = {
    "email": re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    "phone_us": re.compile(r'\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "ip_address": re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),
    "credit_card": re.compile(r'\b(?:\d{4}[-\s]?){3}\d{4}\b'),
}

def remove_pii(text: str) -> str:
    """Replace detected PII with placeholder tokens."""
    for pii_type, pattern in PII_PATTERNS.items():
        text = pattern.sub(f"[{pii_type.upper()}_REMOVED]", text)
    return text
```

**NER-based PII detection**: For names, addresses, and other context-dependent PII, named entity recognition models (spaCy, Presidio) are more effective than regex:

```python
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def anonymize_text(text: str) -> str:
    """Remove PII using Microsoft Presidio."""
    results = analyzer.analyze(text=text, language="en",
                               entities=["PERSON", "EMAIL_ADDRESS",
                                         "PHONE_NUMBER", "LOCATION"])
    anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
    return anonymized.text
```

### 7.3 Benchmark Contamination

Training data that overlaps with evaluation benchmarks inflates metrics. Detection approaches:

1. **N-gram overlap**: For each benchmark example, check if any 13-gram (or longer) substring appears in the training data.
2. **Embedding similarity**: Flag training documents that are semantically similar to benchmark examples.
3. **Canary strings**: Insert unique strings into benchmark data and check if they appear in model outputs (tests memorization end-to-end).

```python
def check_contamination(train_docs: list[str], benchmark_examples: list[str],
                        n: int = 13) -> dict[int, list[int]]:
    """Find training documents that contain n-gram overlaps with benchmark."""
    # Build n-gram index of benchmark examples
    benchmark_ngrams = {}
    for bench_idx, example in enumerate(benchmark_examples):
        words = example.split()
        for i in range(len(words) - n + 1):
            ngram = tuple(words[i:i+n])
            benchmark_ngrams.setdefault(ngram, set()).add(bench_idx)

    # Scan training documents
    contaminated = {}  # train_idx -> list of benchmark_idx
    for train_idx, doc in enumerate(train_docs):
        words = doc.split()
        for i in range(len(words) - n + 1):
            ngram = tuple(words[i:i+n])
            if ngram in benchmark_ngrams:
                contaminated.setdefault(train_idx, []).extend(benchmark_ngrams[ngram])

    return contaminated
```

---

## 8. Case Studies

### 8.1 Common Crawl Processing Pipeline

Common Crawl provides monthly web crawl snapshots in WARC format (~250 TB compressed per snapshot). The standard processing pipeline:

1. **WARC parsing**: Extract HTTP responses, discard non-HTML content.
2. **Text extraction**: Use `trafilatura` or `resiliparse` to extract main content, removing navigation, ads, and boilerplate. This is surprisingly hard --- boilerplate detection heuristics are a major source of variance across datasets.
3. **Language identification**: `fastText` LID model (176 languages, ~97% accuracy). Filter to target language(s).
4. **URL filtering**: Block adult content domains, spam farms, known low-quality sites.
5. **Heuristic filters**: Gopher-style rules.
6. **Deduplication**: URL-level (trivial), document-level hash, MinHash LSH.
7. **Quality filtering**: Perplexity and/or classifier-based.

The typical yield is 5--15% of the raw crawl by document count, 10--25% by token count (high-quality documents tend to be longer).

### 8.2 FineWeb: Pushing Data Quality

FineWeb (Penedo et al., 2024) is the most thoroughly documented open data curation pipeline. Key innovations:

- **Per-snapshot deduplication**: Deduplicated independently within each of 96 Common Crawl snapshots (2013--2024). Cross-snapshot deduplication was tested but found to degrade downstream quality.
- **Custom text extraction**: Replaced trafilatura with a custom extractor that better preserved document structure (lists, tables, headings).
- **Quality classifier tuning**: Trained multiple fastText classifiers with different positive sets (Wikipedia, curated educational content, high-quality web pages) and selected the one that maximized downstream benchmark performance via ablation.
- **Ablation-driven design**: Every pipeline decision was validated by training a 1.8B parameter model on the resulting data and measuring performance on a suite of benchmarks. This "data-centric ablation" methodology is the key contribution.

### 8.3 RedPajama v2

RedPajama v2 (Together AI, 2023) took a different approach: rather than applying fixed filters, they computed ~40 quality signals per document and released the raw signals, allowing users to filter with custom thresholds:

| Signal Category | Examples |
|----------------|----------|
| Content quality | Perplexity, quality classifier score, text length |
| Repetition | Character/word/line repetition rates |
| Natural language | Stop word fraction, symbol ratio, mean word length |
| Deduplication | MinHash cluster ID, exact hash |
| Safety | Toxicity score, adult content classifier, PII density |

This "signal, not filter" approach enables reproducible experimentation with different filtering strategies without re-processing the raw data.

### 8.4 Dolma: Principled Open Data

Dolma (Soldaini et al., 2024) from AI2 emphasized transparency and reproducibility:

- Open-source processing code (Apache 2.0).
- Documented every filtering decision with empirical justification.
- Provided both the processed data and the intermediate artifacts (before and after each filtering step).
- Used suffix arrays for exact substring deduplication (more thorough than MinHash but much more expensive).
- Explicitly documented the biases introduced by each filtering step.

---

## 9. Putting It Together: A Reference Pipeline

```python
class DataCurationPipeline:
    """Reference implementation of a web text curation pipeline."""

    def __init__(self, config: dict):
        self.lang_detector = fasttext.load_model("lid.176.bin")
        self.quality_model = fasttext.load_model("quality_classifier.bin")
        self.kenlm_model = kenlm.Model("wikipedia.arpa")
        self.toxicity_model = pipeline("text-classification",
                                       model="unitary/toxic-bert")
        self.config = config

    def process_document(self, url: str, html: str) -> dict | None:
        """Process a single document through all pipeline stages.

        Returns processed document dict or None if filtered.
        """
        # Stage 1: URL filtering
        if self._is_blocked_url(url):
            return None

        # Stage 2: Text extraction
        text = trafilatura.extract(html, include_comments=False,
                                   include_tables=True)
        if text is None or len(text) < 100:
            return None

        # Stage 3: Language detection
        lang, confidence = self._detect_language(text)
        if lang != self.config["target_language"] or confidence < 0.8:
            return None

        # Stage 4: Heuristic filtering
        if not passes_document_filters(text):
            return None

        # Stage 5: Quality scoring
        quality = self._compute_quality_score(text)
        if quality < self.config["quality_threshold"]:
            return None

        # Stage 6: PII removal
        text = remove_pii(text)

        # Stage 7: Toxicity filtering
        toxicity = self._compute_toxicity(text)
        if toxicity > self.config["toxicity_threshold"]:
            return None

        return {
            "url": url,
            "text": text,
            "language": lang,
            "quality_score": quality,
            "toxicity_score": toxicity,
            "word_count": len(text.split()),
        }

    # (deduplication is a separate batch process, not per-document)
```

---

## Key Takeaways

1. **Data quality dominates data quantity** for LLM pretraining. A 10x smaller, well-curated dataset can outperform a larger, unfiltered one.
2. **Deduplication is the single highest-impact curation step.** MinHash LSH is the workhorse: $O(n)$ time, catches most near-duplicates, and scales to billions of documents.
3. **Layer cheap filters first**: URL blocking and heuristic rules are nearly free and remove 50--70% of low-quality content before expensive model-based filters run.
4. **Quality filtering is inherently biased.** Perplexity-based and classifier-based filters favor Wikipedia-like prose. Document and report what your filters remove, especially across demographic dimensions.
5. **Ablation-driven curation** (train small models, measure downstream impact of each filtering decision) is the gold standard methodology. Every pipeline decision should be validated empirically.
6. **Transparency matters.** Release processing code, intermediate artifacts, and quality signals to enable reproducibility and community improvement.

---

## Further Reading

1. **Lee, K., Ippolito, D., Nystrom, A., Zhang, C., Eck, D., Callison-Burch, C., and Carlini, N.** (2022). "Deduplicating Training Data Makes Language Models Better." *ACL 2022.* --- Definitive study on the impact of deduplication, including the suffix array method.

2. **Penedo, G., Kydlicek, H., allal, L. B., et al.** (2024). "The FineWeb Datasets: Decanting the Web for the Finest Text Data at Scale." *arXiv:2406.17557.* --- The most comprehensive open data curation paper; essential reading for the ablation methodology.

3. **Soldaini, L., Kinney, R., Bhagia, A., et al.** (2024). "Dolma: An Open Corpus of Three Trillion Tokens for Language Model Pretraining Research." *ACL 2024.* --- Transparent documentation of curation decisions and their impacts.

4. **Rae, J. W., Borgeaud, S., Cai, T., et al.** (2022). "Scaling Language Models: Methods, Analysis & Insights from Training Gopher." *arXiv:2112.11446.* --- Section 5 details the Gopher heuristic filtering rules.

5. **Abbas, A., Tirumala, K., Simig, D., Ganguli, S., and Morcos, A.** (2023). "SemDeDup: Data-efficient Learning at Web-scale through Semantic Deduplication." *arXiv:2303.09540.* --- Semantic deduplication via embedding clustering.

6. **Li, R., Allal, L. B., Zi, Y., et al.** (2023). "StarCoder: May the Source Be with You!" *TMLR 2023.* --- Data curation for code; the decontamination and PII removal methodology is widely adopted.

7. **Broder, A.** (1997). "On the Resemblance and Containment of Documents." *SEQUENCES 1997.* --- The foundational paper on MinHash for document similarity.
