# Recitation 10: End-to-End RAG Pipeline

## Overview

In this recitation, we build a complete Retrieval-Augmented Generation (RAG) pipeline from scratch. We cover every stage: document loading, chunking, embedding, indexing, retrieval, re-ranking, and generation. We then evaluate the system and explore advanced techniques (HyDE, query decomposition, re-ranking).

**Prerequisites**: PyTorch basics, familiarity with transformer models, Lecture 10a.

**Time**: ~3 hours hands-on.

---

## 1. Setup and Dependencies

```python
# Requirements:
# pip install torch transformers sentence-transformers faiss-cpu
# pip install rank-bm25 datasets nltk tqdm

import os
import json
import time
import numpy as np
import torch
import torch.nn.functional as F
from dataclasses import dataclass, field
from typing import Optional
from tqdm import tqdm

# Verify GPU availability
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")
```

---

## 2. Document Loading

We use a subset of Wikipedia articles as our corpus. In a production system, this could be any document source (PDFs, web pages, databases).

```python
from datasets import load_dataset

def load_corpus(num_documents: int = 200) -> list[dict]:
    """
    Load a corpus of Wikipedia articles.

    Each document is a dict with:
        - 'id': unique identifier
        - 'title': article title
        - 'text': full article text

    Returns:
        List of document dicts

    Alternatives if datasets library is unavailable:
        - Use the wikipedia library: wikipedia.page("Topic").content
        - Load from local JSON files
        - Use SQuAD passages: load_dataset("squad")
    """
    # Load Wikipedia subset from HuggingFace datasets
    # Using the 'wiki_qa' dataset as a lightweight alternative
    dataset = load_dataset("wiki_qa", split="train")

    # Group by document title to get full articles
    documents = {}
    for item in dataset:
        title = item["document_title"]
        if title not in documents:
            documents[title] = {
                "id": f"doc_{len(documents)}",
                "title": title,
                "text": "",
            }
        documents[title]["text"] += item["answer"] + "\n"

    # Take top N documents by text length
    doc_list = sorted(documents.values(), key=lambda d: len(d["text"]), reverse=True)
    doc_list = doc_list[:num_documents]

    print(f"Loaded {len(doc_list)} documents")
    print(f"Average length: {np.mean([len(d['text'].split()) for d in doc_list]):.0f} words")
    print(f"Total words: {sum(len(d['text'].split()) for d in doc_list):,}")

    return doc_list


# --- Alternative: Load from local files ---

def load_from_directory(directory: str) -> list[dict]:
    """Load documents from a directory of text files."""
    documents = []
    for filename in os.listdir(directory):
        if filename.endswith(('.txt', '.md')):
            filepath = os.path.join(directory, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
            documents.append({
                "id": filename,
                "title": filename.replace('.txt', '').replace('.md', ''),
                "text": text,
            })
    return documents
```

---

## 3. Chunking Strategies

Chunking is one of the most impactful decisions in a RAG pipeline. We implement three strategies and compare them.

```python
import re
import nltk
# Download punkt tokenizer for sentence splitting
# nltk.download('punkt_tab', quiet=True)

@dataclass
class Chunk:
    """A chunk of text from a document."""
    text: str
    doc_id: str
    doc_title: str
    chunk_id: int
    start_char: int
    end_char: int
    metadata: dict = field(default_factory=dict)


# ============================================================
# Strategy 1: Fixed-Size Chunking
# ============================================================

def chunk_fixed_size(
    text: str,
    doc_id: str,
    doc_title: str,
    chunk_size: int = 200,          # Number of words
    chunk_overlap: int = 50,        # Number of overlapping words
) -> list[Chunk]:
    """
    Split text into fixed-size chunks with overlap.

    This is the simplest strategy. Chunks may split mid-sentence.

    Complexity: O(|text| / (chunk_size - chunk_overlap))
    """
    words = text.split()
    chunks = []
    stride = chunk_size - chunk_overlap

    if stride <= 0:
        raise ValueError("chunk_overlap must be less than chunk_size")

    for i, start in enumerate(range(0, len(words), stride)):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_text = " ".join(chunk_words)

        # Approximate character offsets
        start_char = len(" ".join(words[:start])) + (1 if start > 0 else 0)

        chunks.append(Chunk(
            text=chunk_text,
            doc_id=doc_id,
            doc_title=doc_title,
            chunk_id=i,
            start_char=start_char,
            end_char=start_char + len(chunk_text),
            metadata={"strategy": "fixed_size", "word_count": len(chunk_words)},
        ))

        if end >= len(words):
            break

    return chunks


# ============================================================
# Strategy 2: Sentence-Boundary-Aware Chunking
# ============================================================

def chunk_sentence_aware(
    text: str,
    doc_id: str,
    doc_title: str,
    target_chunk_size: int = 200,   # Target number of words
    min_chunk_size: int = 50,       # Minimum words per chunk
) -> list[Chunk]:
    """
    Split text at sentence boundaries, respecting a target chunk size.

    Sentences are never split across chunks, ensuring semantic coherence.

    Algorithm:
        1. Split text into sentences.
        2. Greedily add sentences to the current chunk.
        3. When adding a sentence would exceed target_chunk_size,
           start a new chunk (unless current chunk is too small).
    """
    # Split into sentences
    try:
        sentences = nltk.sent_tokenize(text)
    except LookupError:
        # Fallback: split on period + space
        sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current_sentences = []
    current_word_count = 0

    for sentence in sentences:
        sentence_words = len(sentence.split())

        if (current_word_count + sentence_words > target_chunk_size
                and current_word_count >= min_chunk_size):
            # Flush current chunk
            chunk_text = " ".join(current_sentences)
            start_char = text.find(current_sentences[0]) if current_sentences else 0

            chunks.append(Chunk(
                text=chunk_text,
                doc_id=doc_id,
                doc_title=doc_title,
                chunk_id=len(chunks),
                start_char=start_char,
                end_char=start_char + len(chunk_text),
                metadata={"strategy": "sentence_aware", "word_count": current_word_count},
            ))

            current_sentences = []
            current_word_count = 0

        current_sentences.append(sentence)
        current_word_count += sentence_words

    # Flush remaining
    if current_sentences:
        chunk_text = " ".join(current_sentences)
        start_char = text.find(current_sentences[0]) if current_sentences else 0
        chunks.append(Chunk(
            text=chunk_text,
            doc_id=doc_id,
            doc_title=doc_title,
            chunk_id=len(chunks),
            start_char=start_char,
            end_char=start_char + len(chunk_text),
            metadata={"strategy": "sentence_aware", "word_count": current_word_count},
        ))

    return chunks


# ============================================================
# Strategy 3: Recursive Chunking with Semantic Boundaries
# ============================================================

def chunk_recursive(
    text: str,
    doc_id: str,
    doc_title: str,
    max_chunk_size: int = 300,      # Maximum words per chunk
    separators: list[str] = None,   # Hierarchy of separators
) -> list[Chunk]:
    """
    Recursively split text at progressively finer boundaries.

    Separator hierarchy (tried in order):
        1. Double newline (paragraph boundary)
        2. Single newline (line boundary)
        3. Period + space (sentence boundary)
        4. Space (word boundary)

    This preserves the largest semantic units possible.
    """
    if separators is None:
        separators = ["\n\n", "\n", ". ", " "]

    def _split_recursive(text: str, sep_idx: int) -> list[str]:
        """Recursively split text, trying larger separators first."""
        if len(text.split()) <= max_chunk_size:
            return [text]

        if sep_idx >= len(separators):
            # Force split at word boundary
            words = text.split()
            mid = len(words) // 2
            return (
                _split_recursive(" ".join(words[:mid]), sep_idx)
                + _split_recursive(" ".join(words[mid:]), sep_idx)
            )

        sep = separators[sep_idx]
        parts = text.split(sep)

        # Re-join parts that are too small, split parts that are too large
        result = []
        current = ""
        for part in parts:
            if not part.strip():
                continue
            candidate = (current + sep + part).strip() if current else part.strip()
            if len(candidate.split()) <= max_chunk_size:
                current = candidate
            else:
                if current:
                    result.append(current)
                # This part alone may be too large; recurse with finer separator
                if len(part.split()) > max_chunk_size:
                    result.extend(_split_recursive(part, sep_idx + 1))
                else:
                    current = part.strip()

        if current:
            result.append(current)

        return result

    texts = _split_recursive(text, 0)

    chunks = []
    for i, chunk_text in enumerate(texts):
        chunk_text = chunk_text.strip()
        if not chunk_text:
            continue

        start_idx = text.find(chunk_text)
        chunks.append(Chunk(
            text=chunk_text,
            doc_id=doc_id,
            doc_title=doc_title,
            chunk_id=i,
            start_char=max(0, start_idx),
            end_char=max(0, start_idx) + len(chunk_text),
            metadata={"strategy": "recursive", "word_count": len(chunk_text.split())},
        ))

    return chunks


# ============================================================
# Compare Chunking Strategies
# ============================================================

def compare_chunking_strategies(documents: list[dict]) -> dict:
    """
    Apply all three chunking strategies and compare statistics.
    """
    strategies = {
        "fixed_size": lambda text, did, dtitle: chunk_fixed_size(
            text, did, dtitle, chunk_size=200, chunk_overlap=50
        ),
        "sentence_aware": lambda text, did, dtitle: chunk_sentence_aware(
            text, did, dtitle, target_chunk_size=200
        ),
        "recursive": lambda text, did, dtitle: chunk_recursive(
            text, did, dtitle, max_chunk_size=300
        ),
    }

    results = {}
    for name, chunker in strategies.items():
        all_chunks = []
        for doc in documents:
            chunks = chunker(doc["text"], doc["id"], doc["title"])
            all_chunks.extend(chunks)

        word_counts = [c.metadata.get("word_count", len(c.text.split())) for c in all_chunks]

        results[name] = {
            "num_chunks": len(all_chunks),
            "avg_words": np.mean(word_counts),
            "std_words": np.std(word_counts),
            "min_words": np.min(word_counts),
            "max_words": np.max(word_counts),
        }

        print(f"\n{name}:")
        print(f"  Chunks: {len(all_chunks)}")
        print(f"  Words/chunk: {np.mean(word_counts):.1f} +/- {np.std(word_counts):.1f}")
        print(f"  Range: [{np.min(word_counts)}, {np.max(word_counts)}]")

    return results
```

---

## 4. Embedding Models

We use `sentence-transformers` for embedding. This section covers model selection, embedding computation, and understanding the embedding space.

```python
from sentence_transformers import SentenceTransformer


class EmbeddingModel:
    """
    Wrapper around sentence-transformers for document embedding.

    Supports:
        - Batch encoding with progress bars
        - Query vs. document encoding (some models use asymmetric prefixes)
        - Normalization for cosine similarity
    """
    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        device: Optional[str] = None,
        normalize: bool = True,
    ):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = SentenceTransformer(model_name, device=self.device)
        self.normalize = normalize
        self.dimension = self.model.get_sentence_embedding_dimension()

        print(f"Loaded embedding model: {model_name}")
        print(f"Embedding dimension: {self.dimension}")
        print(f"Device: {self.device}")

    def encode_documents(
        self,
        texts: list[str],
        batch_size: int = 64,
        show_progress: bool = True,
    ) -> np.ndarray:
        """
        Encode documents into embeddings.

        Args:
            texts: list of document/chunk texts
            batch_size: encoding batch size

        Returns:
            embeddings: numpy array of shape [N, dim]
        """
        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            normalize_embeddings=self.normalize,
            convert_to_numpy=True,
        )
        return embeddings    # [N, dim]

    def encode_queries(
        self,
        queries: list[str],
        batch_size: int = 64,
    ) -> np.ndarray:
        """
        Encode queries into embeddings.

        Some models (e.g., E5) use different prefixes for queries vs documents.
        This method handles that distinction.

        Returns:
            embeddings: numpy array of shape [Q, dim]
        """
        # For E5 models, prepend "query: " to queries
        model_name = self.model._model_card_text if hasattr(self.model, '_model_card_text') else ""
        if "e5" in str(self.model).lower():
            queries = [f"query: {q}" for q in queries]

        embeddings = self.model.encode(
            queries,
            batch_size=batch_size,
            normalize_embeddings=self.normalize,
            convert_to_numpy=True,
        )
        return embeddings    # [Q, dim]

    def similarity(
        self,
        query_embeddings: np.ndarray,    # [Q, dim]
        doc_embeddings: np.ndarray,      # [N, dim]
    ) -> np.ndarray:                      # [Q, N]
        """Compute cosine similarity between queries and documents."""
        # If normalized, dot product = cosine similarity
        return query_embeddings @ doc_embeddings.T
```

---

## 5. Indexing with FAISS

FAISS provides efficient approximate nearest neighbor search. We build and compare different index types.

```python
import faiss


class FAISSIndex:
    """
    FAISS-based vector index supporting multiple index types.

    Index types:
        - 'flat': Exact search (brute force). O(N*d) per query.
        - 'ivf': Inverted file index. O(nprobe * N/nlist * d) per query.
        - 'hnsw': Hierarchical Navigable Small World. O(log N * d) per query.
        - 'ivf_pq': IVF with product quantization (memory-efficient).
    """
    def __init__(
        self,
        dimension: int,
        index_type: str = "flat",
        nlist: int = 100,          # Number of IVF clusters
        nprobe: int = 10,          # Number of clusters to search
        m_pq: int = 8,            # PQ subquantizers
        hnsw_m: int = 32,         # HNSW connections per layer
        ef_search: int = 64,       # HNSW search beam width
    ):
        self.dimension = dimension
        self.index_type = index_type
        self.chunks: list[Chunk] = []

        if index_type == "flat":
            self.index = faiss.IndexFlatIP(dimension)  # Inner product (= cosine for normalized)

        elif index_type == "ivf":
            quantizer = faiss.IndexFlatIP(dimension)
            self.index = faiss.IndexIVFFlat(quantizer, dimension, nlist, faiss.METRIC_INNER_PRODUCT)
            self.index.nprobe = nprobe

        elif index_type == "hnsw":
            self.index = faiss.IndexHNSWFlat(dimension, hnsw_m, faiss.METRIC_INNER_PRODUCT)
            self.index.hnsw.efSearch = ef_search

        elif index_type == "ivf_pq":
            quantizer = faiss.IndexFlatIP(dimension)
            self.index = faiss.IndexIVFPQ(quantizer, dimension, nlist, m_pq, 8)  # 8 bits per code
            self.index.nprobe = nprobe

        else:
            raise ValueError(f"Unknown index type: {index_type}")

        self._trained = (index_type == "flat" or index_type == "hnsw")

    def train(self, embeddings: np.ndarray):
        """
        Train the index (required for IVF and PQ indices).

        Args:
            embeddings: [N, dim] training vectors
        """
        if not self._trained:
            print(f"Training {self.index_type} index on {len(embeddings)} vectors...")
            self.index.train(embeddings.astype(np.float32))
            self._trained = True
            print("Training complete.")

    def add(self, embeddings: np.ndarray, chunks: list[Chunk]):
        """
        Add vectors and their associated chunks to the index.

        Args:
            embeddings: [M, dim] vectors to add
            chunks: corresponding Chunk objects
        """
        if not self._trained:
            self.train(embeddings)

        self.index.add(embeddings.astype(np.float32))
        self.chunks.extend(chunks)

    def search(
        self,
        query_embeddings: np.ndarray,    # [Q, dim]
        k: int = 10,
    ) -> tuple[np.ndarray, list[list[Chunk]]]:
        """
        Search for the k most similar chunks.

        Returns:
            scores: [Q, k] similarity scores
            results: list of Q lists of k Chunk objects
        """
        if query_embeddings.ndim == 1:
            query_embeddings = query_embeddings.reshape(1, -1)

        scores, indices = self.index.search(
            query_embeddings.astype(np.float32), k
        )

        results = []
        for q_idx in range(len(query_embeddings)):
            q_chunks = []
            for idx in indices[q_idx]:
                if 0 <= idx < len(self.chunks):
                    q_chunks.append(self.chunks[idx])
                else:
                    q_chunks.append(None)
            results.append(q_chunks)

        return scores, results

    @property
    def size(self) -> int:
        """Number of vectors in the index."""
        return self.index.ntotal


def compare_index_types(
    embeddings: np.ndarray,
    chunks: list[Chunk],
    query_embeddings: np.ndarray,
    k: int = 10,
) -> dict:
    """
    Compare different FAISS index types in terms of speed and recall.

    Recall is measured against the flat (exact) index.
    """
    # Build flat index as ground truth
    flat_index = FAISSIndex(embeddings.shape[1], "flat")
    flat_index.add(embeddings, chunks)
    gt_scores, gt_results = flat_index.search(query_embeddings, k)

    # Ground truth IDs
    gt_ids = []
    for q_chunks in gt_results:
        gt_ids.append(set(id(c) for c in q_chunks if c is not None))

    results = {}

    for index_type in ["flat", "ivf", "hnsw"]:
        idx = FAISSIndex(embeddings.shape[1], index_type)
        idx.add(embeddings, chunks)

        start = time.time()
        scores, search_results = idx.search(query_embeddings, k)
        elapsed = time.time() - start

        # Compute recall@k
        recalls = []
        for q_idx, q_chunks in enumerate(search_results):
            retrieved_ids = set(id(c) for c in q_chunks if c is not None)
            if gt_ids[q_idx]:
                recall = len(retrieved_ids & gt_ids[q_idx]) / len(gt_ids[q_idx])
            else:
                recall = 1.0
            recalls.append(recall)

        results[index_type] = {
            "avg_recall": np.mean(recalls),
            "query_time_ms": elapsed * 1000 / len(query_embeddings),
            "index_size": idx.size,
        }

        print(f"{index_type:>10}: Recall@{k}={np.mean(recalls):.4f}, "
              f"Time/query={elapsed*1000/len(query_embeddings):.2f}ms")

    return results
```

---

## 6. BM25 Baseline

We implement BM25 as a sparse retrieval baseline for comparison with dense retrieval.

```python
from rank_bm25 import BM25Okapi
import string


class BM25Retriever:
    """
    BM25 sparse retriever baseline.

    BM25 scoring: score(q, d) = sum_{t in q} IDF(t) * (tf(t,d) * (k1+1)) / (tf(t,d) + k1 * (1 - b + b * |d|/avgdl))

    Parameters:
        k1: term frequency saturation (default 1.5)
        b: length normalization (default 0.75)
    """
    def __init__(self, chunks: list[Chunk]):
        self.chunks = chunks

        # Tokenize chunks
        tokenized = [self._tokenize(c.text) for c in chunks]

        # Build BM25 index
        self.bm25 = BM25Okapi(tokenized)

        print(f"Built BM25 index over {len(chunks)} chunks")

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        """Simple whitespace + lowercase tokenization."""
        # Remove punctuation, lowercase, split on whitespace
        text = text.lower()
        text = text.translate(str.maketrans("", "", string.punctuation))
        return text.split()

    def search(self, query: str, k: int = 10) -> list[tuple[Chunk, float]]:
        """
        Retrieve top-k chunks for a query.

        Returns list of (chunk, score) tuples, sorted by score descending.
        """
        tokenized_query = self._tokenize(query)
        scores = self.bm25.get_scores(tokenized_query)     # [N]

        # Get top-k indices
        top_indices = np.argsort(scores)[::-1][:k]

        results = [
            (self.chunks[idx], scores[idx])
            for idx in top_indices
        ]

        return results

    def batch_search(
        self,
        queries: list[str],
        k: int = 10,
    ) -> list[list[tuple[Chunk, float]]]:
        """Batch search for multiple queries."""
        return [self.search(q, k) for q in queries]
```

---

## 7. Hybrid Retrieval

Combine BM25 and dense retrieval for the best of both worlds.

```python
class HybridRetriever:
    """
    Hybrid retriever combining dense (FAISS) and sparse (BM25) signals.

    Final score = alpha * dense_score + (1 - alpha) * normalized_bm25_score

    The alpha parameter controls the balance:
        alpha = 1.0: pure dense retrieval
        alpha = 0.0: pure BM25
        alpha = 0.5: equal weight
    """
    def __init__(
        self,
        dense_index: FAISSIndex,
        bm25_retriever: BM25Retriever,
        embedding_model: EmbeddingModel,
        alpha: float = 0.7,       # Weight for dense scores
    ):
        self.dense_index = dense_index
        self.bm25 = bm25_retriever
        self.embedding_model = embedding_model
        self.alpha = alpha

    def search(
        self,
        query: str,
        k: int = 10,
        k_dense: int = 50,       # Retrieve more from each, then merge
        k_bm25: int = 50,
    ) -> list[tuple[Chunk, float]]:
        """
        Hybrid search combining dense and sparse retrieval.

        Strategy: retrieve top-k_dense from dense and top-k_bm25 from BM25,
        merge and re-score with the hybrid formula, return top-k.
        """
        # Dense retrieval
        query_emb = self.embedding_model.encode_queries([query])
        dense_scores, dense_results = self.dense_index.search(query_emb, k_dense)
        dense_scores = dense_scores[0]       # [k_dense]
        dense_chunks = dense_results[0]       # list of Chunk

        # BM25 retrieval
        bm25_results = self.bm25.search(query, k_bm25)

        # Merge: create a unified scoring
        chunk_scores = {}    # chunk_id -> {"dense": score, "bm25": score, "chunk": Chunk}

        # Normalize dense scores to [0, 1]
        if len(dense_scores) > 0:
            d_min, d_max = dense_scores.min(), dense_scores.max()
            d_range = d_max - d_min if d_max > d_min else 1.0

        for chunk, score in zip(dense_chunks, dense_scores):
            if chunk is not None:
                key = f"{chunk.doc_id}_{chunk.chunk_id}"
                norm_score = (score - d_min) / d_range if d_range > 0 else 0.5
                chunk_scores[key] = {
                    "dense": norm_score,
                    "bm25": 0.0,
                    "chunk": chunk,
                }

        # Normalize BM25 scores to [0, 1]
        bm25_raw = [s for _, s in bm25_results]
        if bm25_raw:
            b_min, b_max = min(bm25_raw), max(bm25_raw)
            b_range = b_max - b_min if b_max > b_min else 1.0

        for chunk, score in bm25_results:
            key = f"{chunk.doc_id}_{chunk.chunk_id}"
            norm_score = (score - b_min) / b_range if b_range > 0 else 0.5
            if key in chunk_scores:
                chunk_scores[key]["bm25"] = norm_score
            else:
                chunk_scores[key] = {
                    "dense": 0.0,
                    "bm25": norm_score,
                    "chunk": chunk,
                }

        # Compute hybrid scores
        scored_results = []
        for key, info in chunk_scores.items():
            hybrid_score = self.alpha * info["dense"] + (1 - self.alpha) * info["bm25"]
            scored_results.append((info["chunk"], hybrid_score))

        # Sort and return top-k
        scored_results.sort(key=lambda x: x[1], reverse=True)
        return scored_results[:k]
```

---

## 8. Re-ranking with Cross-Encoder

A cross-encoder processes the query and document jointly, enabling richer interaction modeling.

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification


class CrossEncoderReranker:
    """
    Cross-encoder re-ranker using a pretrained model.

    The cross-encoder processes (query, document) pairs jointly,
    allowing full cross-attention between query and document tokens.
    This is more accurate than bi-encoder similarity but much slower,
    hence used only for re-ranking a small set of candidates.

    Typical model: cross-encoder/ms-marco-MiniLM-L-6-v2
    """
    def __init__(
        self,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        device: Optional[str] = None,
    ):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)
        self.model = self.model.to(self.device)
        self.model.eval()

        print(f"Loaded cross-encoder: {model_name}")

    @torch.no_grad()
    def rerank(
        self,
        query: str,
        chunks: list[Chunk],
        top_k: Optional[int] = None,
    ) -> list[tuple[Chunk, float]]:
        """
        Re-rank chunks by cross-encoder score.

        Args:
            query: search query
            chunks: candidate chunks from first-stage retrieval
            top_k: number of chunks to return (default: all, re-ranked)

        Returns:
            List of (chunk, score) tuples, sorted by score descending.

        Complexity: O(|chunks| * (L_q + L_d)^2 * d_model)
        """
        if not chunks:
            return []

        # Prepare pairs
        pairs = [(query, chunk.text) for chunk in chunks]

        # Tokenize
        inputs = self.tokenizer(
            pairs,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        ).to(self.device)

        # Score
        outputs = self.model(**inputs)
        scores = outputs.logits.squeeze(-1).cpu().numpy()    # [num_chunks]

        # Sort by score
        scored_chunks = list(zip(chunks, scores.tolist()))
        scored_chunks.sort(key=lambda x: x[1], reverse=True)

        if top_k is not None:
            scored_chunks = scored_chunks[:top_k]

        return scored_chunks
```

---

## 9. Generation

The final stage: given retrieved context, generate an answer.

```python
class RAGGenerator:
    """
    Generator component of the RAG pipeline.

    Takes a query and retrieved chunks, formats them as context,
    and generates an answer using an LLM.
    """
    def __init__(
        self,
        llm: Callable,             # (prompt) -> str
        max_context_chunks: int = 5,
        context_template: str = None,
    ):
        self.llm = llm
        self.max_context_chunks = max_context_chunks
        self.context_template = context_template or (
            "Answer the following question using ONLY the provided context. "
            "If the context does not contain enough information, say "
            "'I don't have enough information to answer this question.'\n\n"
            "Context:\n{context}\n\n"
            "Question: {question}\n\n"
            "Answer:"
        )

    def generate(
        self,
        question: str,
        chunks: list[Chunk],
    ) -> dict:
        """
        Generate an answer using retrieved chunks as context.

        Returns:
            dict with:
                - 'answer': generated answer text
                - 'context_used': list of chunk texts used
                - 'sources': list of (doc_title, chunk_id) tuples
        """
        # Select top chunks
        selected = chunks[:self.max_context_chunks]

        # Format context
        context_parts = []
        for i, chunk in enumerate(selected):
            context_parts.append(
                f"[Source {i+1}: {chunk.doc_title}]\n{chunk.text}"
            )
        context = "\n\n".join(context_parts)

        # Build prompt
        prompt = self.context_template.format(
            context=context,
            question=question,
        )

        # Generate
        answer = self.llm(prompt)

        return {
            "answer": answer,
            "context_used": [c.text for c in selected],
            "sources": [(c.doc_title, c.chunk_id) for c in selected],
            "prompt_length": len(prompt.split()),
        }


class NoRetrievalBaseline:
    """Baseline: answer questions without any retrieval."""
    def __init__(self, llm: Callable):
        self.llm = llm

    def generate(self, question: str) -> dict:
        prompt = f"Answer the following question:\n\nQuestion: {question}\n\nAnswer:"
        answer = self.llm(prompt)
        return {"answer": answer, "context_used": [], "sources": []}
```

---

## 10. Complete Pipeline

Putting it all together.

```python
class RAGPipeline:
    """
    Complete end-to-end RAG pipeline.

    Stages:
        1. Document loading
        2. Chunking
        3. Embedding
        4. Indexing
        5. Retrieval (dense + BM25 hybrid)
        6. Re-ranking (optional cross-encoder)
        7. Generation
    """
    def __init__(
        self,
        embedding_model: EmbeddingModel,
        generator: RAGGenerator,
        chunking_strategy: str = "sentence_aware",
        index_type: str = "flat",
        use_bm25: bool = True,
        use_reranker: bool = False,
        reranker: Optional[CrossEncoderReranker] = None,
        hybrid_alpha: float = 0.7,
        top_k_retrieve: int = 20,
        top_k_rerank: int = 5,
    ):
        self.embedding_model = embedding_model
        self.generator = generator
        self.chunking_strategy = chunking_strategy
        self.index_type = index_type
        self.use_bm25 = use_bm25
        self.use_reranker = use_reranker
        self.reranker = reranker
        self.hybrid_alpha = hybrid_alpha
        self.top_k_retrieve = top_k_retrieve
        self.top_k_rerank = top_k_rerank

        # Will be initialized during indexing
        self.chunks: list[Chunk] = []
        self.dense_index: Optional[FAISSIndex] = None
        self.bm25_retriever: Optional[BM25Retriever] = None
        self.hybrid_retriever: Optional[HybridRetriever] = None

    def index_documents(self, documents: list[dict]):
        """
        Process and index all documents.

        Steps:
            1. Chunk documents using the chosen strategy
            2. Embed all chunks
            3. Build FAISS index
            4. Build BM25 index (if enabled)
            5. Create hybrid retriever (if BM25 enabled)
        """
        print("=" * 60)
        print("INDEXING PIPELINE")
        print("=" * 60)

        # Step 1: Chunk
        print(f"\n1. Chunking ({self.chunking_strategy})...")
        chunker = {
            "fixed_size": chunk_fixed_size,
            "sentence_aware": chunk_sentence_aware,
            "recursive": chunk_recursive,
        }[self.chunking_strategy]

        self.chunks = []
        for doc in tqdm(documents, desc="Chunking"):
            doc_chunks = chunker(doc["text"], doc["id"], doc["title"])
            self.chunks.extend(doc_chunks)

        print(f"   Created {len(self.chunks)} chunks")

        # Step 2: Embed
        print("\n2. Embedding chunks...")
        texts = [c.text for c in self.chunks]
        embeddings = self.embedding_model.encode_documents(texts)
        print(f"   Embeddings shape: {embeddings.shape}")

        # Step 3: Build FAISS index
        print(f"\n3. Building {self.index_type} index...")
        self.dense_index = FAISSIndex(embeddings.shape[1], self.index_type)
        self.dense_index.add(embeddings, self.chunks)
        print(f"   Index size: {self.dense_index.size}")

        # Step 4: Build BM25 index
        if self.use_bm25:
            print("\n4. Building BM25 index...")
            self.bm25_retriever = BM25Retriever(self.chunks)

            # Step 5: Create hybrid retriever
            self.hybrid_retriever = HybridRetriever(
                self.dense_index, self.bm25_retriever,
                self.embedding_model, self.hybrid_alpha,
            )

        print("\nIndexing complete!")

    def query(self, question: str) -> dict:
        """
        Answer a question using the full RAG pipeline.

        Returns:
            dict with answer, sources, retrieval scores, and metadata
        """
        # Retrieve
        if self.hybrid_retriever:
            results = self.hybrid_retriever.search(
                question, k=self.top_k_retrieve
            )
            chunks = [c for c, s in results]
            retrieval_scores = [s for c, s in results]
        else:
            query_emb = self.embedding_model.encode_queries([question])
            scores, chunk_results = self.dense_index.search(
                query_emb, self.top_k_retrieve
            )
            chunks = [c for c in chunk_results[0] if c is not None]
            retrieval_scores = scores[0].tolist()

        # Re-rank
        if self.use_reranker and self.reranker and chunks:
            reranked = self.reranker.rerank(
                question, chunks, top_k=self.top_k_rerank
            )
            chunks = [c for c, s in reranked]
            retrieval_scores = [s for c, s in reranked]
        else:
            chunks = chunks[:self.top_k_rerank]
            retrieval_scores = retrieval_scores[:self.top_k_rerank]

        # Generate
        result = self.generator.generate(question, chunks)
        result["retrieval_scores"] = retrieval_scores

        return result
```

---

## 11. Advanced RAG Techniques

### 11.1 HyDE: Hypothetical Document Embeddings

Instead of embedding the query directly, generate a hypothetical answer and embed that. The hypothesis is closer to the document embedding space.

```python
class HyDERetriever:
    """
    Hypothetical Document Embeddings (HyDE).

    Instead of embedding the query directly, we:
    1. Generate a hypothetical answer to the query using an LLM.
    2. Embed the hypothetical answer.
    3. Use this embedding to search for real documents.

    The intuition: the hypothetical answer is in the same "language"
    as the actual documents, making embedding similarity more effective.

    Reference: Gao et al., "Precise Zero-Shot Dense Retrieval without
    Relevance Labels" (2023).
    """
    def __init__(
        self,
        llm: Callable,                    # (prompt) -> str
        embedding_model: EmbeddingModel,
        dense_index: FAISSIndex,
        num_hypotheses: int = 1,          # Generate multiple hypotheses
    ):
        self.llm = llm
        self.embedding_model = embedding_model
        self.dense_index = dense_index
        self.num_hypotheses = num_hypotheses

    def search(self, query: str, k: int = 10) -> list[tuple[Chunk, float]]:
        """
        HyDE retrieval: generate hypothesis -> embed -> search.
        """
        # Step 1: Generate hypothetical document
        hypotheses = []
        for _ in range(self.num_hypotheses):
            prompt = (
                f"Write a short passage that answers the following question. "
                f"The passage should be factual and informative.\n\n"
                f"Question: {query}\n\n"
                f"Passage:"
            )
            hypothesis = self.llm(prompt)
            hypotheses.append(hypothesis)

        # Step 2: Embed hypotheses
        hyp_embeddings = self.embedding_model.encode_documents(hypotheses)  # [H, dim]

        # Average embeddings if multiple hypotheses
        query_embedding = hyp_embeddings.mean(axis=0, keepdims=True)       # [1, dim]

        # Normalize
        query_embedding = query_embedding / np.linalg.norm(query_embedding, axis=1, keepdims=True)

        # Step 3: Search
        scores, results = self.dense_index.search(query_embedding, k)

        return list(zip(results[0], scores[0].tolist()))
```

### 11.2 Query Decomposition

Break complex queries into simpler sub-queries, retrieve for each, and merge results.

```python
class QueryDecomposer:
    """
    Decompose complex queries into simpler sub-queries.

    For complex multi-hop questions, a single query may not retrieve
    all necessary information. Decomposition retrieves for each aspect
    separately, then merges results.

    Example:
        "What was the GDP of the country that won the 2022 World Cup?"
        -> Sub-query 1: "Which country won the 2022 World Cup?"
        -> Sub-query 2: "What is the GDP of Argentina?"
    """
    def __init__(
        self,
        llm: Callable,
        retrieval_fn: Callable,    # (query, k) -> list[(Chunk, score)]
    ):
        self.llm = llm
        self.retrieval_fn = retrieval_fn

    def decompose(self, query: str) -> list[str]:
        """Decompose a query into sub-queries using the LLM."""
        prompt = (
            f"Break the following question into simpler sub-questions "
            f"that can each be answered independently. "
            f"Return one sub-question per line.\n\n"
            f"Question: {query}\n\n"
            f"Sub-questions:"
        )

        response = self.llm(prompt)
        sub_queries = [
            line.strip().lstrip("0123456789.-) ")
            for line in response.strip().split("\n")
            if line.strip()
        ]

        # Always include the original query
        return [query] + sub_queries

    def search(self, query: str, k: int = 10) -> list[tuple[Chunk, float]]:
        """
        Decompose query, retrieve for each sub-query, merge results.

        Merging strategy: reciprocal rank fusion (RRF).
        """
        sub_queries = self.decompose(query)

        # Retrieve for each sub-query
        all_results = {}     # chunk_key -> (chunk, rrf_score)

        for sq in sub_queries:
            results = self.retrieval_fn(sq, k)
            for rank, (chunk, score) in enumerate(results):
                key = f"{chunk.doc_id}_{chunk.chunk_id}"
                rrf_score = 1.0 / (60 + rank)    # RRF constant = 60

                if key in all_results:
                    all_results[key] = (chunk, all_results[key][1] + rrf_score)
                else:
                    all_results[key] = (chunk, rrf_score)

        # Sort by RRF score
        merged = sorted(all_results.values(), key=lambda x: x[1], reverse=True)
        return merged[:k]
```

---

## 12. Evaluation

Measure retrieval quality and end-to-end answer quality.

```python
class RAGEvaluator:
    """
    Evaluate a RAG pipeline on retrieval and generation quality.

    Metrics:
        Retrieval:
            - Recall@k: fraction of relevant documents retrieved
            - MRR: Mean Reciprocal Rank
            - NDCG@k: Normalized Discounted Cumulative Gain

        Generation:
            - Exact Match (EM): exact string match
            - F1: token-level F1 score
            - Answer contains gold: whether the gold answer appears in the generated text
    """
    def __init__(
        self,
        pipeline: RAGPipeline,
        eval_data: list[dict],    # Each: {"question", "answer", "relevant_docs"}
    ):
        self.pipeline = pipeline
        self.eval_data = eval_data

    @staticmethod
    def compute_f1(prediction: str, gold: str) -> float:
        """Token-level F1 score."""
        pred_tokens = prediction.lower().split()
        gold_tokens = gold.lower().split()

        if not pred_tokens or not gold_tokens:
            return 0.0

        common = set(pred_tokens) & set(gold_tokens)
        if not common:
            return 0.0

        precision = len(common) / len(pred_tokens)
        recall = len(common) / len(gold_tokens)

        return 2 * precision * recall / (precision + recall)

    @staticmethod
    def compute_exact_match(prediction: str, gold: str) -> bool:
        """Exact string match (after normalization)."""
        def normalize(s):
            s = s.lower().strip()
            s = re.sub(r'\s+', ' ', s)
            s = re.sub(r'[^\w\s]', '', s)
            return s
        return normalize(prediction) == normalize(gold)

    def evaluate_retrieval(self, k_values: list[int] = [1, 5, 10, 20]) -> dict:
        """Evaluate retrieval quality."""
        results = {k: {"recalls": [], "mrrs": []} for k in k_values}

        for item in tqdm(self.eval_data, desc="Evaluating retrieval"):
            question = item["question"]
            relevant_ids = set(item.get("relevant_docs", []))

            # Retrieve
            query_emb = self.pipeline.embedding_model.encode_queries([question])
            max_k = max(k_values)
            scores, chunk_results = self.pipeline.dense_index.search(query_emb, max_k)
            retrieved_chunks = chunk_results[0]

            for k in k_values:
                top_k_chunks = retrieved_chunks[:k]
                retrieved_doc_ids = {c.doc_id for c in top_k_chunks if c is not None}

                # Recall
                if relevant_ids:
                    recall = len(retrieved_doc_ids & relevant_ids) / len(relevant_ids)
                else:
                    recall = 1.0
                results[k]["recalls"].append(recall)

                # MRR
                mrr = 0.0
                for rank, chunk in enumerate(top_k_chunks, 1):
                    if chunk is not None and chunk.doc_id in relevant_ids:
                        mrr = 1.0 / rank
                        break
                results[k]["mrrs"].append(mrr)

        metrics = {}
        for k in k_values:
            metrics[f"recall@{k}"] = np.mean(results[k]["recalls"])
            metrics[f"mrr@{k}"] = np.mean(results[k]["mrrs"])

        return metrics

    def evaluate_generation(self) -> dict:
        """Evaluate end-to-end generation quality."""
        exact_matches = []
        f1_scores = []
        contains_answer = []

        for item in tqdm(self.eval_data, desc="Evaluating generation"):
            result = self.pipeline.query(item["question"])
            prediction = result["answer"]
            gold = item["answer"]

            exact_matches.append(self.compute_exact_match(prediction, gold))
            f1_scores.append(self.compute_f1(prediction, gold))
            contains_answer.append(gold.lower() in prediction.lower())

        return {
            "exact_match": np.mean(exact_matches),
            "f1": np.mean(f1_scores),
            "contains_answer": np.mean(contains_answer),
            "num_evaluated": len(self.eval_data),
        }

    def full_evaluation(self) -> dict:
        """Run complete evaluation and print results."""
        print("\n" + "=" * 60)
        print("RAG PIPELINE EVALUATION")
        print("=" * 60)

        retrieval_metrics = self.evaluate_retrieval()
        print("\nRetrieval Metrics:")
        for metric, value in retrieval_metrics.items():
            print(f"  {metric}: {value:.4f}")

        generation_metrics = self.evaluate_generation()
        print("\nGeneration Metrics:")
        for metric, value in generation_metrics.items():
            if isinstance(value, float):
                print(f"  {metric}: {value:.4f}")
            else:
                print(f"  {metric}: {value}")

        return {
            "retrieval": retrieval_metrics,
            "generation": generation_metrics,
        }
```

---

## 13. Putting It All Together: Example Usage

```python
def main():
    """
    Complete example: build and evaluate a RAG pipeline.

    Steps:
        1. Load documents
        2. Initialize components
        3. Index documents
        4. Query the pipeline
        5. Evaluate
    """
    # ---- 1. Load documents ----
    print("Loading documents...")
    documents = load_corpus(num_documents=100)

    # ---- 2. Initialize components ----
    print("\nInitializing components...")
    embedding_model = EmbeddingModel(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )

    # For the generator, use any LLM API
    # Here we use a placeholder that you should replace
    def llm_generate(prompt: str) -> str:
        """Replace with your LLM API call."""
        # Example with OpenAI:
        # from openai import OpenAI
        # client = OpenAI()
        # response = client.chat.completions.create(
        #     model="gpt-4o-mini",
        #     messages=[{"role": "user", "content": prompt}],
        # )
        # return response.choices[0].message.content

        # Example with local model via transformers:
        # from transformers import pipeline
        # pipe = pipeline("text-generation", model="meta-llama/Llama-3-8B-Instruct")
        # return pipe(prompt, max_new_tokens=256)[0]["generated_text"]

        return "[LLM response placeholder - replace with actual API call]"

    generator = RAGGenerator(llm=llm_generate, max_context_chunks=5)

    # ---- 3. Build pipeline ----
    pipeline = RAGPipeline(
        embedding_model=embedding_model,
        generator=generator,
        chunking_strategy="sentence_aware",
        index_type="flat",
        use_bm25=True,
        use_reranker=False,          # Set True if you have cross-encoder
        hybrid_alpha=0.7,
        top_k_retrieve=20,
        top_k_rerank=5,
    )

    # ---- 4. Index documents ----
    pipeline.index_documents(documents)

    # ---- 5. Query ----
    print("\n" + "=" * 60)
    print("EXAMPLE QUERIES")
    print("=" * 60)

    example_queries = [
        "What is the capital of France?",
        "How does photosynthesis work?",
        "Who invented the telephone?",
    ]

    for query in example_queries:
        print(f"\nQ: {query}")
        result = pipeline.query(query)
        print(f"A: {result['answer']}")
        print(f"Sources: {result['sources'][:3]}")
        print(f"Context length: {result['prompt_length']} words")

    # ---- 6. Evaluate (requires labeled data) ----
    # eval_data = [
    #     {"question": "...", "answer": "...", "relevant_docs": ["doc_id"]},
    #     ...
    # ]
    # evaluator = RAGEvaluator(pipeline, eval_data)
    # results = evaluator.full_evaluation()


if __name__ == "__main__":
    main()
```

---

## 14. Exercises

### Exercise 1: Chunking Comparison (30 min)

Run `compare_chunking_strategies` on your corpus and answer:
1. Which strategy produces the most uniform chunk sizes?
2. Which strategy produces the most chunks? Why?
3. Pick 5 example chunks from each strategy and qualitatively assess which preserves semantic coherence best.

### Exercise 2: Retrieval Ablation (45 min)

1. Compare retrieval Recall@5 for: (a) BM25 only, (b) dense only, (c) hybrid with $\alpha \in \{0.3, 0.5, 0.7, 0.9\}$.
2. Find the optimal $\alpha$ on your evaluation set.
3. Add a cross-encoder re-ranker and measure the improvement in Recall@5 when re-ranking the top 50 candidates.

### Exercise 3: HyDE Evaluation (30 min)

1. Implement HyDE with 1 and 3 hypotheses.
2. Compare retrieval quality against standard dense retrieval.
3. On what types of queries does HyDE help most? Provide examples.

### Exercise 4: End-to-End Evaluation (45 min)

1. Create a test set of 20 questions with ground-truth answers from your corpus.
2. Evaluate the full pipeline (hybrid retrieval + generation).
3. Compare against a no-retrieval baseline.
4. Identify the top 3 failure modes and propose fixes for each.

### Exercise 5: Embedding Model Comparison (30 min)

1. Try at least 2 different embedding models (e.g., `all-MiniLM-L6-v2` vs. `all-mpnet-base-v2`).
2. Compare Recall@{1, 5, 10} on your evaluation set.
3. Measure embedding speed (documents per second) for each model.
4. Is the larger/slower model worth the quality improvement?
