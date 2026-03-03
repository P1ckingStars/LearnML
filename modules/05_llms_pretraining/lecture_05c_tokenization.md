# Lecture 05c: Tokenization — From Text to Tokens

> **Module 05 — LLMs & Pretraining**
> Estimated study time: 5–7 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Explain the vocabulary-size vs. sequence-length tradeoff and its effect on model capacity and compute cost.
2. Derive the Byte Pair Encoding (BPE) algorithm, analyze its complexity, and implement it from scratch.
3. Describe the WordPiece and Unigram (SentencePiece) algorithms and their probabilistic foundations.
4. Implement byte-level BPE as used in GPT-2.
5. Analyze tokenizer fertility across languages and its implications for multilingual models.
6. Evaluate tokenizer-free (byte-level) approaches and their tradeoffs.

---

## 1. Motivation and Context

Before a language model sees any text, a **tokenizer** converts raw strings into a sequence of integer indices. This is not a mere preprocessing step — the tokenizer fundamentally shapes what the model can learn.

**The core tradeoff:** Let $|\mathcal{V}|$ be the vocabulary size and $T$ be the average sequence length after tokenization.

- **Character-level** ($|\mathcal{V}| \sim 256$): Sequences are long ($T$ is large), requiring more compute for attention ($O(T^2)$). The model must learn spelling from scratch.
- **Word-level** ($|\mathcal{V}| \sim 10^5$–$10^6$): Sequences are short but the embedding matrix $W \in \mathbb{R}^{|\mathcal{V}| \times d}$ is enormous. Rare words have poorly trained embeddings. Out-of-vocabulary (OOV) words cannot be represented.
- **Subword-level** ($|\mathcal{V}| \sim 3 \times 10^4$–$10^5$): The sweet spot. Common words are single tokens; rare words are decomposed into meaningful subunits.

**Quantifying the tradeoff.** The total compute for a Transformer scales as:

$$C \propto L \cdot (T^2 \cdot d + T \cdot d^2) + |\mathcal{V}| \cdot d$$

The first term grows with $T^2$; the last term grows with $|\mathcal{V}|$. The optimal vocabulary size minimizes total compute for a given text corpus.

**Fertility.** The *fertility* of a tokenizer on a text is the average number of tokens per word (or per character):

$$\text{fertility} = \frac{\text{number of tokens}}{\text{number of words}}$$

Lower fertility means shorter sequences and lower compute cost. English text typically has fertility 1.2–1.5 with a good BPE tokenizer; other languages can have fertility 2–5x higher, creating a multilingual performance gap.

---

## 2. Core Theory

### 2.1 Byte Pair Encoding (BPE)

BPE (Sennrich et al., 2016) is a data-driven compression algorithm adapted for tokenization. It starts with a character-level vocabulary and iteratively merges the most frequent adjacent pair.

**Definition (BPE Vocabulary Construction).** Given a corpus $\mathcal{D}$ of words with frequencies, the BPE algorithm constructs a vocabulary $\mathcal{V}$ of size $|\mathcal{V}| = |\mathcal{V}_0| + K$ by performing $K$ merge operations:

1. **Initialize** the vocabulary $\mathcal{V}_0$ as the set of all characters in $\mathcal{D}$ (plus special tokens).
2. **Represent** each word as a sequence of characters: `"lower"` $\to$ `['l', 'o', 'w', 'e', 'r']`.
3. **For** $k = 1, 2, \ldots, K$:
   - Count frequencies of all adjacent pairs $(a, b)$ across all words (weighted by word frequency).
   - Let $(a^*, b^*) = \arg\max_{(a,b)} \text{freq}(a, b)$.
   - Create new token $c = a^* \cdot b^*$ (concatenation).
   - Replace all occurrences of $(a^*, b^*)$ with $c$ in every word.
   - Add $c$ to $\mathcal{V}$.
4. **Return** $\mathcal{V}$ and the ordered list of merge rules $\mathcal{R} = [(a^*_1, b^*_1), (a^*_2, b^*_2), \ldots]$.

**Formal Analysis of BPE.**

**Lemma (BPE Compression).** Each BPE merge operation reduces the total corpus length (in tokens) by at least the frequency of the merged pair minus the number of word boundaries it crosses.

*Proof.* Let the pair $(a, b)$ have frequency $f$ in the corpus. Each occurrence of $(a, b)$ is replaced by a single new token, reducing the total length by $f$. However, if $a$ and $b$ are at a word boundary, they are not merged (BPE operates within words). Thus the actual reduction is $f - f_{\text{boundary}} \geq 0$. Since we choose the most frequent pair, this is the maximum possible reduction per step. $\square$

**Theorem (BPE Optimality).** BPE is a greedy approximation to the problem of finding the vocabulary $\mathcal{V}$ of size $|\mathcal{V}_0| + K$ that minimizes the total encoded corpus length $\sum_w f(w) \cdot |w|_\mathcal{V}$, where $|w|_\mathcal{V}$ is the number of tokens in the BPE encoding of word $w$.

*Proof sketch.* The optimal vocabulary selection is NP-hard (it reduces to a weighted set cover problem). BPE's greedy approach — always merging the most frequent pair — is analogous to the greedy algorithm for set cover, which achieves an $O(\ln n)$ approximation ratio. However, BPE is not exactly set cover; the interaction between merges (a merge can create new pairs) makes the analysis more complex. Empirically, BPE produces near-optimal vocabularies.

**Complexity Analysis.**

Let $N$ be the total corpus length (in characters) and $K$ be the number of merges.

- **Naive implementation**: For each merge step, scan the corpus to count all pairs ($O(N)$), find the maximum ($O(|\text{pairs}|)$), and apply the merge ($O(N)$). Total: $O(KN)$.
- **With priority queue**: Maintain a max-heap of pair frequencies. Each merge invalidates $O(f)$ positions. Total: $O(N + K \cdot f_{\text{avg}} \cdot \log N)$, which is $O(N \log N)$ in practice.
- **Memory**: $O(N)$ for the corpus plus $O(|\mathcal{V}|^2)$ for pair counts (in the worst case, but typically much smaller since most pairs are infrequent).

### 2.2 BPE Tokenization (Inference)

Given a trained BPE vocabulary with merge rules $\mathcal{R}$, tokenizing a new string works as follows:

```
Algorithm: BPE Tokenization
────────────────────────────
Input: String s, merge rules R = [(a_1,b_1), ..., (a_K,b_K)]
Output: Token sequence

1. Split s into characters: tokens = list(s)
2. For each merge rule (a_i, b_i) in order:
   a. Scan tokens for adjacent pair (a_i, b_i)
   b. Replace all occurrences with merged token a_i+b_i
3. Return tokens
```

**Complexity:** $O(K \cdot |s|)$ in the worst case, $O(|s| \cdot \log|s|)$ on average with hash-based pair lookup.

### 2.3 WordPiece

WordPiece (Schuster & Nakajima, 2012; used in BERT) is similar to BPE but selects merges differently.

**Key Difference.** Instead of merging the most frequent pair, WordPiece merges the pair that maximizes the likelihood of the training data under a unigram language model:

$$\text{score}(a, b) = \frac{\text{freq}(ab)}{\text{freq}(a) \cdot \text{freq}(b)}$$

**Derivation.** Under a unigram model, the log-likelihood of the corpus is:

$$\ell = \sum_{w \in \mathcal{V}} f(w) \cdot \log p(w)$$

where $p(w) = f(w) / N$. Merging $(a, b)$ into $ab$ changes the log-likelihood by:

$$\Delta \ell = f(ab) \cdot \log \frac{f(ab)}{N'} - f(a) \cdot \log \frac{f(a)}{N} - f(b) \cdot \log \frac{f(b)}{N}$$

Simplifying (assuming $N' \approx N$ for large corpora):

$$\Delta \ell \approx f(ab) \cdot \log \frac{f(ab)}{f(a) \cdot f(b)} + \text{const}$$

This is proportional to the pointwise mutual information (PMI) of $a$ and $b$, weighted by their co-occurrence frequency. Maximizing $\Delta \ell$ is equivalent to choosing the pair with the highest weighted PMI, which is exactly the WordPiece scoring formula.

**WordPiece Tokenization (Inference).** Unlike BPE, WordPiece tokenization uses a greedy left-to-right longest-match algorithm:

```
Algorithm: WordPiece Tokenization
──────────────────────────────────
Input: Word w, vocabulary V
Output: Token sequence

1. tokens = []
2. start = 0
3. While start < len(w):
   a. end = len(w)
   b. While end > start:
      - substr = w[start:end]
      - If start > 0: substr = "##" + substr  (continuation marker)
      - If substr ∈ V: break
      - end -= 1
   c. If end == start: return [UNK]  (out of vocabulary)
   d. tokens.append(substr)
   e. start = end
4. Return tokens
```

### 2.4 Unigram Language Model (SentencePiece)

The Unigram model (Kudo, 2018; used in LLaMA via SentencePiece) takes a fundamentally different approach: instead of building up from characters, it starts with a large vocabulary and prunes it down.

**The Probabilistic Model.** A unigram language model assigns probability to a tokenization $\mathbf{t} = (t_1, \ldots, t_m)$ of a string $s$:

$$p(\mathbf{t} \mid s) = \prod_{i=1}^{m} p(t_i), \quad \sum_{t \in \mathcal{V}} p(t) = 1$$

The best tokenization of $s$ is:

$$\mathbf{t}^* = \arg\max_{\mathbf{t} \in \mathcal{S}(s)} p(\mathbf{t} \mid s) = \arg\max_{\mathbf{t} \in \mathcal{S}(s)} \sum_{i=1}^{m} \log p(t_i)$$

where $\mathcal{S}(s)$ is the set of all valid tokenizations of $s$ (all ways to segment $s$ into vocabulary tokens).

**Finding the Optimal Tokenization via the Viterbi Algorithm.**

This is a shortest-path problem on a DAG. Define a graph with $|s| + 1$ nodes (positions $0, 1, \ldots, |s|$). Add an edge from $i$ to $j$ with weight $-\log p(s[i:j])$ whenever $s[i:j] \in \mathcal{V}$.

```
Algorithm: Viterbi Tokenization
────────────────────────────────
Input: String s of length n, vocabulary V with probabilities {p(t)}
Output: Optimal tokenization t*

1. Initialize: cost[0] = 0, back[0] = -1
2. For j = 1 to n:
   cost[j] = ∞
   For each i < j such that s[i:j] ∈ V:
     c = cost[i] - log p(s[i:j])
     If c < cost[j]:
       cost[j] = c
       back[j] = i
3. Backtrack from position n to recover tokenization

Complexity: O(n · max_token_len) or O(n²) in the worst case
           O(n) with a trie-based vocabulary lookup
```

**Training the Unigram Model via EM.**

The parameters $\{p(t)\}_{t \in \mathcal{V}}$ are learned by maximizing the marginal likelihood:

$$\mathcal{L} = \sum_{s \in \mathcal{D}} \log p(s) = \sum_{s \in \mathcal{D}} \log \sum_{\mathbf{t} \in \mathcal{S}(s)} \prod_{i} p(t_i)$$

This is optimized via the EM algorithm:

**E-step:** For each string $s$, compute the expected counts of each token $t$ under the posterior $p(\mathbf{t} \mid s)$:

$$c(t) = \sum_{s \in \mathcal{D}} \sum_{\mathbf{t} \in \mathcal{S}(s)} p(\mathbf{t} \mid s) \cdot \#(t, \mathbf{t})$$

where $\#(t, \mathbf{t})$ is the count of $t$ in tokenization $\mathbf{t}$. This can be computed efficiently using the forward-backward algorithm on the tokenization lattice.

**M-step:** Update probabilities:

$$p(t) = \frac{c(t)}{\sum_{t' \in \mathcal{V}} c(t')}$$

**Vocabulary Pruning.** After EM convergence, compute the loss increase from removing each token $t$:

$$\Delta \mathcal{L}(t) = \mathcal{L}(\mathcal{V}) - \mathcal{L}(\mathcal{V} \setminus \{t\})$$

Remove the $p\%$ of tokens (e.g., $p = 20\%$) with the smallest $\Delta \mathcal{L}$, keeping all single characters (to avoid OOV). Repeat EM + pruning until $|\mathcal{V}|$ reaches the target size.

### 2.5 Byte-Level BPE (GPT-2 Style)

GPT-2 introduced a variant of BPE that operates on bytes rather than Unicode characters.

**Motivation.** Character-level BPE has issues with Unicode: there are >140,000 Unicode characters, making the base vocabulary large. Many characters are extremely rare.

**Solution.** Use the 256 byte values as the base vocabulary. Any text, in any language or encoding, can be represented without OOV tokens.

**The UTF-8 Mapping.** To make byte sequences human-readable in the vocabulary, GPT-2 maps each byte $b \in [0, 255]$ to a Unicode character:

$$\text{byte\_to\_char}(b) = \begin{cases} \text{chr}(b) & \text{if } b \text{ is a printable ASCII byte} \\ \text{chr}(b + 256) & \text{otherwise (shifted to avoid control characters)} \end{cases}$$

This creates a 1-to-1 mapping from bytes to visible characters, ensuring the vocabulary file is human-readable.

**Pre-tokenization.** GPT-2 applies a regex-based pre-tokenization before BPE to prevent merges across word boundaries:

$$\texttt{pat} = \texttt{r"'s|'t|'re|'ve|'m|'ll|'d| ?\p\{L\}+| ?\p\{N\}+| ?[^\s\p\{L\}\p\{N\}]+|\s+"}$$

This regex splits text into:

- Contractions (`'s`, `'t`, etc.)
- Words (with optional leading space)
- Numbers
- Punctuation/symbols
- Whitespace runs

Each matched segment is BPE-encoded independently. This prevents, e.g., merging the space before a word with the word itself across different words.

### 2.6 Tokenizer-Free Approaches

**Byte-Level Models.** Instead of subword tokenization, some models operate directly on raw bytes:

- **ByT5** (Xue et al., 2022): A T5 variant with $|\mathcal{V}| = 259$ (256 bytes + 3 special tokens). Sequences are ~3–4x longer, but the model uses a deeper encoder to compensate.
- **MegaByte** (Yu et al., 2023): Hierarchical architecture with a "global" model over patches of bytes and a "local" model within patches.

**Tradeoff Analysis.** For a text of $W$ words with average character length $\bar{c}$:

| Approach | Vocab | Seq Len | Attention Cost | Embedding Cost |
|----------|-------|---------|---------------|----------------|
| Word-level | $\sim 10^5$ | $W$ | $O(W^2 d)$ | $O(10^5 d)$ |
| BPE ($V = 32$K) | $3.2 \times 10^4$ | $\sim 1.3W$ | $O(1.7W^2 d)$ | $O(3.2 \times 10^4 d)$ |
| Byte-level | $256$ | $\sim \bar{c}W$ | $O(\bar{c}^2 W^2 d)$ | $O(256 d)$ |

With $\bar{c} \approx 5$ for English, byte-level attention is $\sim 25\times$ more expensive. This is why subword tokenization remains dominant.

### 2.7 Fertility and Multilingual Fairness

**Definition (Fertility).** The fertility $\phi_\ell$ of a tokenizer $\tau$ on language $\ell$ is:

$$\phi_\ell = \frac{\mathbb{E}_{s \sim \mathcal{D}_\ell}[|\tau(s)|]}{\mathbb{E}_{s \sim \mathcal{D}_\ell}[|s|_{\text{words}}]}$$

**Empirical Fertilities (GPT-2 Tokenizer):**

| Language | Fertility | Relative to English |
|----------|-----------|-------------------|
| English | 1.3 | 1.0x |
| Spanish | 1.7 | 1.3x |
| Chinese | 3.0 | 2.3x |
| Japanese | 3.5 | 2.7x |
| Hindi | 4.2 | 3.2x |
| Amharic | 6.1 | 4.7x |

**Implications:**

1. **Cost**: Users of high-fertility languages pay more per API call (billed per token).
2. **Context window**: The same text in Hindi uses 3.2x more of the context window than in English.
3. **Performance**: Fewer tokens of content means the model has less "reasoning space" per concept.
4. **Fairness**: Tokenizers trained primarily on English text systematically disadvantage other languages.

**Mitigation.** Train tokenizers on multilingual data (as in LLaMA-2) or use language-specific tokenizers. Increasing vocabulary size to 100K+ (as in LLaMA-3) helps but increases embedding parameters.

---

## 3. Algorithmic Derivation

### 3.1 BPE Training (Detailed)

```
Algorithm: BPE Vocabulary Training
───────────────────────────────────
Input: Word-frequency corpus {(w_j, f_j)}_{j=1}^M, target vocab size V
Output: Vocabulary V, merge rules R

1. Pre-tokenize each word into characters:
   For each w_j: tokens_j = list(characters(w_j)) + ['</w>']
   (</w> marks word boundary to enable detokenization)

2. Initialize:
   V = {all unique characters across all words}
   pair_counts = {}  (frequency of adjacent pairs)
   For each (w_j, f_j):
     For i = 0 to len(tokens_j) - 2:
       pair = (tokens_j[i], tokens_j[i+1])
       pair_counts[pair] += f_j

3. While |V| < target_size:
   a. best_pair = argmax_{pair} pair_counts[pair]
   b. new_token = concat(best_pair[0], best_pair[1])
   c. Add new_token to V
   d. Append best_pair to R

   e. Update corpus and pair counts:
      For each word w_j containing best_pair:
        Replace all occurrences of best_pair with new_token
        Update pair_counts:
          - Remove counts for old pairs involving the merge site
          - Add counts for new pairs created by the merge

4. Return V, R

Space complexity: O(M * max_word_len + |V|²) worst case
                  O(M * max_word_len) typical (sparse pair counts)
```

### 3.2 Forward-Backward for Unigram Model

```
Algorithm: Forward-Backward on Tokenization Lattice
─────────────────────────────────────────────────────
Input: String s of length n, vocabulary V, probabilities {p(t)}
Output: Expected token counts {E[count(t)]}

1. Build lattice: for each (i, j) where s[i:j] ∈ V, add edge with weight log p(s[i:j])

2. Forward pass (log-space, for numerical stability):
   α[0] = 0  (log-probability of reaching position 0)
   For j = 1 to n:
     α[j] = log Σ_{i: s[i:j]∈V} exp(α[i] + log p(s[i:j]))
           = logsumexp_{i: s[i:j]∈V} (α[i] + log p(s[i:j]))

3. Backward pass:
   β[n] = 0
   For i = n-1 down to 0:
     β[i] = logsumexp_{j: s[i:j]∈V} (log p(s[i:j]) + β[j])

4. Marginal probability of using token s[i:j]:
   For each (i, j) where s[i:j] ∈ V:
     E[count(s[i:j])] += exp(α[i] + log p(s[i:j]) + β[j] - α[n])

5. Z = α[n]  (log partition function = log marginal likelihood)

Complexity: O(n * max_token_len) per string
```

---

## 4. PyTorch Implementation

### 4.1 BPE Tokenizer from Scratch

```python
import re
import collections
from typing import Dict, List, Tuple, Optional

class BPETokenizer:
    """Byte Pair Encoding tokenizer, implemented from scratch.

    This implementation follows the GPT-2 byte-level BPE approach.
    """

    def __init__(self, vocab_size: int = 1000):
        self.target_vocab_size = vocab_size
        self.merges: List[Tuple[str, str]] = []           # ordered merge rules
        self.vocab: Dict[str, int] = {}                     # token -> index
        self.inverse_vocab: Dict[int, str] = {}             # index -> token

        # GPT-2-style pre-tokenization regex
        self.pat = re.compile(
            r"""'s|'t|'re|'ve|'m|'ll|'d| ?\w+| ?\d+| ?[^\s\w\d]+|\s+""",
            re.UNICODE,
        )

    def _get_pair_counts(
        self,
        word_freqs: Dict[Tuple[str, ...], int],
    ) -> Dict[Tuple[str, str], int]:
        """Count frequencies of all adjacent pairs across the corpus.

        Args:
            word_freqs: mapping from word (as tuple of tokens) to frequency

        Returns:
            pair_counts: mapping from (token_a, token_b) to total frequency
        """
        pair_counts: Dict[Tuple[str, str], int] = collections.defaultdict(int)
        for word, freq in word_freqs.items():
            # word is a tuple of tokens, e.g., ('l', 'o', 'w', 'e', 'r')
            for i in range(len(word) - 1):
                pair = (word[i], word[i + 1])
                pair_counts[pair] += freq
        return pair_counts

    def _merge_pair(
        self,
        word_freqs: Dict[Tuple[str, ...], int],
        pair: Tuple[str, str],
    ) -> Dict[Tuple[str, ...], int]:
        """Apply a merge operation to all words in the corpus.

        Args:
            word_freqs: current corpus representation
            pair: the (a, b) pair to merge into "ab"

        Returns:
            new_word_freqs with the pair merged
        """
        new_word_freqs: Dict[Tuple[str, ...], int] = {}
        a, b = pair
        for word, freq in word_freqs.items():
            new_word: List[str] = []
            i = 0
            while i < len(word):
                if i < len(word) - 1 and word[i] == a and word[i + 1] == b:
                    new_word.append(a + b)  # merge
                    i += 2
                else:
                    new_word.append(word[i])
                    i += 1
            new_word_freqs[tuple(new_word)] = freq
        return new_word_freqs

    def train(self, text: str) -> None:
        """Train BPE tokenizer on a text corpus.

        Args:
            text: the training corpus as a single string
        """
        # Step 1: Pre-tokenize into words using regex
        words = self.pat.findall(text)

        # Step 2: Count word frequencies
        word_counts: Dict[str, int] = collections.Counter(words)

        # Step 3: Represent each word as a tuple of characters
        word_freqs: Dict[Tuple[str, ...], int] = {}
        for word, count in word_counts.items():
            char_tuple = tuple(word)  # e.g., "hello" -> ('h','e','l','l','o')
            word_freqs[char_tuple] = count

        # Step 4: Collect initial character vocabulary
        chars = set()
        for word in word_freqs:
            for ch in word:
                chars.add(ch)
        base_vocab_size = len(chars)
        num_merges = self.target_vocab_size - base_vocab_size

        print(f"Base vocabulary size: {base_vocab_size}")
        print(f"Target vocabulary size: {self.target_vocab_size}")
        print(f"Number of merges to perform: {num_merges}")

        # Step 5: Iteratively merge the most frequent pair
        for step in range(num_merges):
            pair_counts = self._get_pair_counts(word_freqs)
            if not pair_counts:
                print(f"No more pairs to merge at step {step}")
                break

            # Find the most frequent pair
            best_pair = max(pair_counts, key=pair_counts.get)
            best_count = pair_counts[best_pair]

            # Apply the merge
            word_freqs = self._merge_pair(word_freqs, best_pair)
            self.merges.append(best_pair)

            if step % 100 == 0:
                print(f"  Merge {step}: {best_pair} -> '{best_pair[0]+best_pair[1]}' "
                      f"(freq={best_count})")

        # Step 6: Build vocabulary (sorted: base chars first, then merges)
        self.vocab = {}
        idx = 0
        for ch in sorted(chars):
            self.vocab[ch] = idx
            idx += 1
        for a, b in self.merges:
            self.vocab[a + b] = idx
            idx += 1

        # Special tokens
        self.vocab["<|unk|>"] = idx
        self.vocab["<|pad|>"] = idx + 1
        self.vocab["<|eos|>"] = idx + 2

        self.inverse_vocab = {v: k for k, v in self.vocab.items()}
        print(f"Final vocabulary size: {len(self.vocab)}")

    def _apply_merges(self, tokens: List[str]) -> List[str]:
        """Apply learned merge rules to a token sequence.

        Args:
            tokens: list of character tokens, e.g., ['h','e','l','l','o']

        Returns:
            merged token list, e.g., ['hel', 'lo'] depending on merges
        """
        for a, b in self.merges:
            new_tokens: List[str] = []
            i = 0
            while i < len(tokens):
                if i < len(tokens) - 1 and tokens[i] == a and tokens[i + 1] == b:
                    new_tokens.append(a + b)
                    i += 2
                else:
                    new_tokens.append(tokens[i])
                    i += 1
            tokens = new_tokens
        return tokens

    def encode(self, text: str) -> List[int]:
        """Encode a string into a list of token indices.

        Args:
            text: input string

        Returns:
            list of integer token indices
        """
        # Pre-tokenize
        words = self.pat.findall(text)

        token_ids: List[int] = []
        for word in words:
            # Split into characters
            chars = list(word)
            # Apply BPE merges
            tokens = self._apply_merges(chars)
            # Convert to indices
            for tok in tokens:
                if tok in self.vocab:
                    token_ids.append(self.vocab[tok])
                else:
                    token_ids.append(self.vocab.get("<|unk|>", 0))

        return token_ids

    def decode(self, token_ids: List[int]) -> str:
        """Decode a list of token indices back to a string.

        Args:
            token_ids: list of integer token indices

        Returns:
            decoded string
        """
        tokens = [self.inverse_vocab.get(idx, "<|unk|>") for idx in token_ids]
        return "".join(tokens)

    def get_fertility(self, text: str) -> float:
        """Compute the fertility (tokens per word) for a given text.

        Args:
            text: input text

        Returns:
            fertility ratio
        """
        words = text.split()
        tokens = self.encode(text)
        return len(tokens) / max(len(words), 1)

# ─── Demo ────────────────────────────────────────────────────────────────

def demo_bpe():
    """Demonstrate BPE training and encoding."""
    corpus = """
    The quick brown fox jumps over the lazy dog. The dog barked at the fox.
    The fox ran quickly through the forest. The forest was dark and quiet.
    The quick fox was quicker than the quick dog. The dog quickly chased the fox.
    Low lower lowest lowering lowered. New newer newest. Wide wider widest.
    The neural network learned to generate text. The text generation was impressive.
    The language model predicted the next token. The token prediction was accurate.
    Training the model required a lot of compute. The compute was expensive.
    """ * 50  # repeat for more data

    tokenizer = BPETokenizer(vocab_size=300)
    tokenizer.train(corpus)

    # Test encoding/decoding
    test_text = "The quick fox jumps over the lazy dog"
    encoded = tokenizer.encode(test_text)
    decoded = tokenizer.decode(encoded)

    print(f"\nOriginal:  '{test_text}'")
    print(f"Encoded:   {encoded}")
    print(f"Tokens:    {[tokenizer.inverse_vocab[i] for i in encoded]}")
    print(f"Decoded:   '{decoded}'")
    print(f"Fertility: {tokenizer.get_fertility(test_text):.2f}")

    # Verify roundtrip
    assert decoded == test_text, f"Roundtrip failed: '{decoded}' != '{test_text}'"
    print("Roundtrip encoding/decoding: PASSED")

if __name__ == "__main__":
    demo_bpe()
```

### 4.2 Unigram Tokenizer (Simplified)

```python
import math
import numpy as np
from typing import Dict, List, Tuple

class UnigramTokenizer:
    """Simplified Unigram (SentencePiece-style) tokenizer.

    Uses Viterbi decoding for tokenization and EM for training.
    """

    def __init__(self, vocab_size: int = 1000, max_token_len: int = 16):
        self.target_vocab_size = vocab_size
        self.max_token_len = max_token_len
        self.token_probs: Dict[str, float] = {}  # token -> log probability
        self.vocab: Dict[str, int] = {}

    def _viterbi_tokenize(
        self,
        text: str,
        token_probs: Dict[str, float],
    ) -> List[str]:
        """Find the optimal tokenization using Viterbi algorithm.

        Args:
            text: string to tokenize (length n)
            token_probs: mapping from token to log-probability

        Returns:
            list of tokens forming the optimal segmentation
        """
        n = len(text)
        # cost[j] = best log-probability of tokenizing text[:j]
        cost = [float("-inf")] * (n + 1)    # (n+1,)
        back = [-1] * (n + 1)               # (n+1,) — backpointer
        cost[0] = 0.0

        for j in range(1, n + 1):
            for i in range(max(0, j - self.max_token_len), j):
                substr = text[i:j]
                if substr in token_probs:
                    candidate = cost[i] + token_probs[substr]
                    if candidate > cost[j]:
                        cost[j] = candidate
                        back[j] = i

        # Backtrack to recover tokenization
        if cost[n] == float("-inf"):
            # Fallback: character-by-character
            return list(text)

        tokens: List[str] = []
        pos = n
        while pos > 0:
            start = back[pos]
            tokens.append(text[start:pos])
            pos = start
        tokens.reverse()
        return tokens

    def _forward_backward(
        self,
        text: str,
        token_probs: Dict[str, float],
    ) -> Dict[str, float]:
        """Compute expected token counts using forward-backward algorithm.

        Args:
            text: string of length n
            token_probs: current token log-probabilities

        Returns:
            expected_counts: expected count of each token in this string
        """
        n = len(text)

        # Forward pass: alpha[j] = log p(text[:j])
        alpha = [float("-inf")] * (n + 1)  # (n+1,)
        alpha[0] = 0.0

        for j in range(1, n + 1):
            values = []
            for i in range(max(0, j - self.max_token_len), j):
                substr = text[i:j]
                if substr in token_probs:
                    values.append(alpha[i] + token_probs[substr])
            if values:
                alpha[j] = _logsumexp(values)

        # Backward pass: beta[i] = log p(text[i:] | text[:i])
        beta = [float("-inf")] * (n + 1)
        beta[n] = 0.0

        for i in range(n - 1, -1, -1):
            values = []
            for j in range(i + 1, min(n + 1, i + self.max_token_len + 1)):
                substr = text[i:j]
                if substr in token_probs:
                    values.append(token_probs[substr] + beta[j])
            if values:
                beta[i] = _logsumexp(values)

        # Compute expected counts
        Z = alpha[n]  # log partition function
        expected_counts: Dict[str, float] = collections.defaultdict(float)

        for i in range(n):
            for j in range(i + 1, min(n + 1, i + self.max_token_len + 1)):
                substr = text[i:j]
                if substr in token_probs:
                    # Marginal probability of using this token at this position
                    log_marginal = alpha[i] + token_probs[substr] + beta[j] - Z
                    expected_counts[substr] += math.exp(log_marginal)

        return expected_counts

    def train(self, text: str, n_iterations: int = 10) -> None:
        """Train the Unigram tokenizer via EM with vocabulary pruning.

        Args:
            text: training corpus
            n_iterations: number of EM iterations per pruning round
        """
        # Step 1: Initialize with all substrings up to max_token_len
        substr_counts: Dict[str, int] = collections.defaultdict(int)
        for i in range(len(text)):
            for j in range(i + 1, min(i + self.max_token_len + 1, len(text) + 1)):
                substr_counts[text[i:j]] += 1

        # Keep top candidates by frequency
        initial_size = min(len(substr_counts), self.target_vocab_size * 4)
        candidates = sorted(substr_counts.items(), key=lambda x: -x[1])[:initial_size]

        # Ensure all single characters are included
        chars = set(text)
        char_set = {ch: substr_counts.get(ch, 1) for ch in chars}
        self.token_probs = {}
        for tok, count in candidates:
            self.token_probs[tok] = math.log(count)
        for ch, count in char_set.items():
            if ch not in self.token_probs:
                self.token_probs[ch] = math.log(count)

        # Normalize
        self._normalize_probs()
        print(f"Initial vocabulary size: {len(self.token_probs)}")

        # Step 2: EM + pruning loop
        while len(self.token_probs) > self.target_vocab_size:
            # EM iterations
            for it in range(n_iterations):
                total_counts: Dict[str, float] = collections.defaultdict(float)

                # Process text in chunks for efficiency
                chunk_size = 200
                for start in range(0, len(text), chunk_size):
                    chunk = text[start:start + chunk_size]
                    counts = self._forward_backward(chunk, self.token_probs)
                    for tok, c in counts.items():
                        total_counts[tok] += c

                # M-step: update probabilities
                total = sum(total_counts.values())
                for tok in self.token_probs:
                    if tok in total_counts and total_counts[tok] > 0:
                        self.token_probs[tok] = math.log(total_counts[tok] / total)
                    else:
                        self.token_probs[tok] = math.log(1e-10)

            # Prune: remove bottom 20% (keep all single chars)
            n_to_remove = max(1, int(0.2 * (len(self.token_probs) - len(chars))))
            scored = [
                (tok, self.token_probs[tok])
                for tok in self.token_probs
                if len(tok) > 1  # never remove single characters
            ]
            scored.sort(key=lambda x: x[1])
            for tok, _ in scored[:n_to_remove]:
                del self.token_probs[tok]

            self._normalize_probs()
            print(f"  Pruned to {len(self.token_probs)} tokens")

        # Build final vocab
        self.vocab = {tok: i for i, tok in enumerate(sorted(self.token_probs.keys()))}
        print(f"Final vocabulary size: {len(self.vocab)}")

    def _normalize_probs(self):
        """Normalize token probabilities to sum to 1 (in log-space)."""
        log_total = _logsumexp(list(self.token_probs.values()))
        self.token_probs = {tok: lp - log_total for tok, lp in self.token_probs.items()}

    def encode(self, text: str) -> List[str]:
        """Tokenize text using Viterbi decoding."""
        return self._viterbi_tokenize(text, self.token_probs)

def _logsumexp(values: List[float]) -> float:
    """Numerically stable log-sum-exp."""
    if not values:
        return float("-inf")
    max_val = max(values)
    if max_val == float("-inf"):
        return float("-inf")
    return max_val + math.log(sum(math.exp(v - max_val) for v in values))
```

### 4.3 Tokenizer Comparison and Fertility Analysis

```python
def compare_tokenizers():
    """Compare BPE and Unigram tokenizers on sample texts."""

    corpus = """
    The transformer architecture uses self-attention to process sequences.
    Neural networks learn representations through backpropagation.
    Language models predict the probability of the next token.
    Pre-training on large corpora enables transfer learning.
    """ * 100

    # Train both tokenizers
    print("=== Training BPE ===")
    bpe = BPETokenizer(vocab_size=200)
    bpe.train(corpus)

    test_sentences = [
        "The neural network learns representations.",
        "Transformers use self-attention mechanisms.",
        "An unseen word like supercalifragilistic.",
    ]

    print("\n=== Tokenization Comparison ===")
    for sent in test_sentences:
        bpe_tokens = bpe.encode(sent)
        bpe_strs = [bpe.inverse_vocab[i] for i in bpe_tokens]
        print(f"\nInput: '{sent}'")
        print(f"  BPE ({len(bpe_tokens)} tokens): {bpe_strs}")
        print(f"  Fertility: {len(bpe_tokens) / len(sent.split()):.2f}")

def fertility_analysis():
    """Analyze tokenizer fertility across different types of text."""
    import json

    # Simulated multilingual fertility data (typical for GPT-2 tokenizer)
    # In practice you would use tiktoken or the HuggingFace tokenizer
    fertility_data = {
        "English": {"text": "The quick brown fox jumps over the lazy dog", "fertility": 1.3},
        "Spanish": {"text": "El rapido zorro marron salta sobre el perro perezoso", "fertility": 1.7},
        "German": {"text": "Der schnelle braune Fuchs springt ueber den faulen Hund", "fertility": 1.8},
        "Chinese": {"text": "Quick brown fox in Chinese characters", "fertility": 3.0},
        "Japanese": {"text": "Quick brown fox in Japanese", "fertility": 3.5},
        "Hindi": {"text": "Quick brown fox in Hindi", "fertility": 4.2},
    }

    print("=== Fertility Analysis ===")
    print(f"{'Language':<12} {'Fertility':>10} {'Relative to EN':>16}")
    print("-" * 40)
    en_fert = fertility_data["English"]["fertility"]
    for lang, data in fertility_data.items():
        print(f"{lang:<12} {data['fertility']:>10.1f} {data['fertility']/en_fert:>16.1f}x")

    # Compute effective context window reduction
    context_window = 4096
    print(f"\n{'Language':<12} {'Effective Context (words)':>25}")
    print("-" * 40)
    for lang, data in fertility_data.items():
        effective = int(context_window / data["fertility"])
        print(f"{lang:<12} {effective:>25,}")

if __name__ == "__main__":
    demo_bpe()
    print("\n" + "=" * 60 + "\n")
    compare_tokenizers()
    print("\n" + "=" * 60 + "\n")
    fertility_analysis()
```

---

## 5. Experimental Intuition

### 5.1 Vocabulary Size Sweet Spot

Empirical studies (Gowda & May, 2020) show that:

- Too small ($|\mathcal{V}| < 8$K): sequences are too long, attention cost dominates.
- Too large ($|\mathcal{V}| > 128$K): embedding matrix is large, rare tokens have poor embeddings.
- Sweet spot: $|\mathcal{V}| \in [32\text{K}, 64\text{K}]$ for English-centric models; $|\mathcal{V}| \in [64\text{K}, 128\text{K}]$ for multilingual models.

### 5.2 BPE vs. Unigram in Practice

- **BPE** is deterministic: one tokenization per string. This is simple but may not capture the "best" segmentation.
- **Unigram** can output multiple tokenizations (by sampling from the posterior or using $n$-best Viterbi). This enables data augmentation: training with different segmentations of the same text regularizes the model.
- In practice, the difference is small for large models. The choice is often driven by implementation convenience.

### 5.3 The Whitespace Problem

Tokenizers must handle whitespace carefully. GPT-2 encodes the leading space as part of the token (e.g., `" the"` is a single token). This means `"the"` at the start of a sentence and `" the"` in the middle are different tokens. SentencePiece uses a special Unicode character (U+2581, `_`) to represent space, making tokenization independent of position.

---

## 6. Connections

- **Module 05b (GPT/BERT/LLaMA)**: Each architecture uses a different tokenizer. GPT-2 uses byte-level BPE (50257 tokens); BERT uses WordPiece (30522); LLaMA uses SentencePiece Unigram/BPE (32000).
- **Module 05a (Scaling Laws)**: Vocabulary size affects the constant in $L(N)$ scaling (larger vocabularies slightly reduce loss per FLOP by shortening sequences).
- **Information Theory (Module 00b)**: BPE approximately minimizes the entropy of the token distribution by creating frequent tokens. The Unigram model explicitly models token probabilities.
- **Module 05d (Data Curation)**: Tokenizer training data should match the pretraining data distribution. A mismatch degrades fertility and downstream performance.

---

## 7. Paper Reading List

### Required

1. **Sennrich et al. (2016)**. *Neural Machine Translation of Rare Words with Subword Units*. arXiv:1508.07909.
   - The original BPE-for-NLP paper. Short and clear.

2. **Kudo & Richardson (2018)**. *SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing*. arXiv:1808.06226.
   - The SentencePiece system paper. Read Sections 2–3.

3. **Kudo (2018)**. *Subword Regularization: Improving Neural Network Translation Models with Multiple Subword Candidates*. arXiv:1804.10959.
   - Introduces the Unigram language model for tokenization. Read Sections 2–3 for the EM algorithm.

### Recommended

4. **Radford et al. (2019)**. *Language Models are Unsupervised Multitask Learners* (GPT-2). Section 2.2.
   - Byte-level BPE description.

5. **Xue et al. (2022)**. *ByT5: Towards a Token-Free Future with Pre-trained Byte-to-Byte Models*. arXiv:2105.13626.
   - Byte-level model without tokenization.

6. **Gowda & May (2020)**. *Finding the Optimal Vocabulary Size for Neural Machine Translation*. arXiv:2004.02334.
   - Systematic study of vocabulary size effects.

### Advanced

7. **Schuster & Nakajima (2012)**. *Japanese and Korean voice search*. ICASSP.
   - Original WordPiece paper.

8. **Petrov et al. (2024)**. *Language Model Tokenizers Introduce Unfairness Between Languages*. arXiv:2305.15425.
   - Fertility-based analysis of multilingual tokenization bias.

---

## 8. Exercises

### Conceptual

**Exercise 5c.1.** Prove that BPE is a greedy approximation to minimizing the total encoded corpus length. Specifically, show that at each step, merging the most frequent pair achieves the maximum possible reduction in corpus length.

**Exercise 5c.2.** Derive the WordPiece scoring formula $\text{score}(a, b) = \text{freq}(ab) / (\text{freq}(a) \cdot \text{freq}(b))$ from the change in log-likelihood of a unigram model when merging $(a, b)$ into $ab$.

**Exercise 5c.3.** The Viterbi algorithm for Unigram tokenization runs in $O(n \cdot L)$ where $L$ is the maximum token length. Prove this and explain why a trie-based vocabulary lookup makes this $O(n)$ amortized.

**Exercise 5c.4.** Consider a language where every word is exactly 10 characters long and all characters are equally frequent. What is the optimal BPE vocabulary size (in terms of minimizing total tokens + vocabulary embedding parameters)?

### Computational

**Exercise 5c.5.** Implement the BPE tokenizer above. Train it on the first 1MB of the Tiny Shakespeare dataset. Plot: (a) vocabulary size vs. corpus token count, (b) fertility vs. number of merges, (c) the distribution of token lengths (in characters) in the final vocabulary.

**Exercise 5c.6.** Implement the Viterbi tokenization algorithm for the Unigram model. Compare the tokenization of 100 sentences using BPE vs. Unigram with the same vocabulary size. Report the average number of tokens per sentence for each.

**Exercise 5c.7.** Download the GPT-2 tokenizer (via `tiktoken`) and analyze its fertility on text from 5 different languages. Reproduce the fertility table from Section 2.7 with real data.

**Exercise 5c.8.** Implement byte-level BPE following the GPT-2 approach. Verify that your tokenizer can encode any arbitrary byte sequence (including binary data) without OOV errors.

**Exercise 5c.9 (Research-Level).** Train two small GPT-2 models (10M parameters each) on the same corpus, one with a 1K-token BPE vocabulary and one with a 32K-token BPE vocabulary. Compare: (a) training loss curves (in nats/byte, not nats/token, for a fair comparison), (b) generation quality, (c) training speed (tokens/second vs. bytes/second).
