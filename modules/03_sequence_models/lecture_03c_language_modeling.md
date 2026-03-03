# Lecture 03c: Language Modeling

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Formalize** language modeling as the problem of estimating the joint probability distribution $P(x_1, x_2, \ldots, x_T)$ over sequences of tokens.
2. **Derive** the autoregressive factorization via the chain rule of probability and explain its implications for model architecture.
3. **Analyze** n-gram models, compute their parameter counts, and prove that they suffer from the curse of dimensionality.
4. **Explain** the neural language model of Bengio et al. (2003) and its innovations: distributed word representations and shared parameters.
5. **Derive** perplexity from cross-entropy, prove that perplexity equals the geometric mean of inverse predicted probabilities, and interpret perplexity as an effective vocabulary size.
6. **Compare** teacher forcing and scheduled sampling, analyzing the exposure bias problem.
7. **Implement** and compare sampling strategies: greedy, top-k, top-p (nucleus), and temperature scaling.
8. **Apply** evaluation metrics (perplexity, BLEU) and understand their limitations.

---

## 2. Motivation and Context

### 2.1 What is Language Modeling?

Language modeling is arguably the most fundamental task in natural language processing. A language model assigns a probability to every possible sequence of tokens (words, subwords, or characters) in a language. This seemingly simple objective has profound implications:

- **Generation**: Sample from the model to produce text.
- **Scoring**: Evaluate the fluency/likelihood of a given text.
- **Representation learning**: The internal representations learned by a language model capture syntactic and semantic structure.
- **Foundation for modern AI**: GPT, BERT, and all large language models are language models at their core (Module 05).

### 2.2 Historical Arc

The history of language modeling parallels the history of NLP:

- **1948**: Shannon applies information theory to English, estimating the entropy of language.
- **1980s-1990s**: N-gram models dominate, powered by smoothing techniques (Katz, Kneser-Ney).
- **2003**: Bengio et al. introduce the neural language model, combining word embeddings with a feedforward network.
- **2010**: Mikolov et al. apply RNNs to language modeling, achieving state-of-the-art perplexity.
- **2017-2018**: LSTM-based models with regularization tricks (AWD-LSTM, Merity et al.) push the boundary.
- **2018+**: Transformers (Module 04) take over, leading to GPT, BERT, and beyond.

This lecture covers the pre-Transformer era. Understanding it is essential because: (1) the mathematical foundations (cross-entropy, perplexity, autoregressive modeling) carry forward unchanged, and (2) many practical techniques (teacher forcing, sampling strategies) remain relevant.

---

## 3. Core Theory

### 3.1 The Language Modeling Problem

**Definition 3.5 (Language Model).** Let $\mathcal{V}$ be a finite vocabulary of size $V$. A language model is a probability distribution over sequences of tokens:

$$P: \mathcal{V}^* \to [0, 1]$$

such that $\sum_{T=0}^{\infty} \sum_{(x_1, \ldots, x_T) \in \mathcal{V}^T} P(x_1, \ldots, x_T) = 1$.

In practice, we model sequences of bounded length and use a special end-of-sequence token $\langle\text{eos}\rangle \in \mathcal{V}$ to handle variable-length sequences.

### 3.2 Autoregressive Decomposition

**Theorem 3.5 (Chain Rule Factorization).** By the chain rule of probability, any joint distribution over a sequence can be decomposed as:

$$P(x_1, x_2, \ldots, x_T) = \prod_{t=1}^{T} P(x_t \mid x_1, \ldots, x_{t-1})$$

*Proof.* By repeated application of the definition of conditional probability:

$$P(x_1, \ldots, x_T) = P(x_1) \cdot P(x_2 \mid x_1) \cdot P(x_3 \mid x_1, x_2) \cdots P(x_T \mid x_1, \ldots, x_{T-1})$$

This is exact and requires no assumptions. $\blacksquare$

**Implication for modeling:** To define a language model, it suffices to define the conditional distributions $P(x_t \mid x_{<t})$ for each position $t$, where $x_{<t} = (x_1, \ldots, x_{t-1})$. This is the **autoregressive** approach. Each conditional is a categorical distribution over $\mathcal{V}$:

$$P(x_t = w \mid x_{<t}) \in [0, 1] \quad \text{for each } w \in \mathcal{V}, \quad \sum_{w \in \mathcal{V}} P(x_t = w \mid x_{<t}) = 1$$

### 3.3 N-gram Models

**Definition 3.6 (N-gram Model).** An n-gram model approximates the conditional by truncating the context to the last $n-1$ tokens:

$$P(x_t \mid x_{<t}) \approx P(x_t \mid x_{t-n+1}, \ldots, x_{t-1})$$

This is equivalent to a $(n-1)$-th order Markov assumption.

**Parameter count:** An n-gram model must store probabilities for each possible context of length $n-1$. The number of parameters is:

$$|\theta| = V^{n-1} \times (V - 1) = O(V^n)$$

(The $V-1$ comes from the simplex constraint on the conditional distribution.)

| $n$ | Model | Parameters ($V = 50{,}000$) |
|-----|-------|---------------------------|
| 1 | Unigram | $5 \times 10^4$ |
| 2 | Bigram | $2.5 \times 10^9$ |
| 3 | Trigram | $1.25 \times 10^{14}$ |
| 4 | 4-gram | $6.25 \times 10^{18}$ |

**The curse of dimensionality:** The parameter count grows exponentially with $n$. For $n > 3$, most n-gram contexts are never observed in any training corpus, making maximum likelihood estimation unreliable. This necessitates **smoothing** (Laplace, Kneser-Ney), which amounts to interpolating with lower-order models.

**Theorem 3.6 (Limitation of N-gram Models).** N-gram models cannot capture dependencies beyond $n-1$ tokens. Formally, for any $k > n-1$:

$$P_{\text{n-gram}}(x_t \mid x_{<t}) = P_{\text{n-gram}}(x_t \mid x_{t-n+1:t-1})$$

regardless of $x_1, \ldots, x_{t-n}$. Long-range phenomena such as subject-verb agreement across clauses, coreference, and discourse coherence are fundamentally inaccessible.

### 3.4 Neural Language Models

**Bengio et al. (2003)** proposed to replace the n-gram lookup table with a neural network, introducing two key innovations:

1. **Distributed word representations**: Each word $w \in \mathcal{V}$ is represented by a learned vector $\mathbf{e}_w \in \mathbb{R}^D$ (a word embedding). Similar words get similar vectors, enabling generalization.

2. **Shared parameters**: The function mapping context to next-word distribution uses a neural network with shared parameters, dramatically reducing parameter count.

**Architecture (feedforward neural LM):**

$$P(x_t \mid x_{t-n+1:t-1}) = \text{softmax}(W_2 \cdot \tanh(W_1 \cdot [\mathbf{e}_{x_{t-n+1}}; \ldots; \mathbf{e}_{x_{t-1}}] + b_1) + b_2)$$

Parameter count: $O(VD + D \cdot n \cdot D_h + D_h \cdot V)$ where $D$ is embedding dimension and $D_h$ is hidden dimension. This is **linear** in $n$ (not exponential).

**Mikolov et al. (2010)** replaced the feedforward network with an RNN, removing the fixed context window entirely:

$$h_t = \sigma(W_{hh} h_{t-1} + W_{xh} \mathbf{e}_{x_t} + b_h)$$
$$P(x_t \mid x_{<t}) = \text{softmax}(W_{hy} h_t + b_y)$$

The RNN hidden state $h_t$ is a compressed representation of the **entire** history $x_1, \ldots, x_t$. In principle, this can capture arbitrarily long dependencies (though in practice, vanilla RNNs are limited by vanishing gradients, motivating the use of LSTMs).

### 3.5 Training: Maximum Likelihood and Cross-Entropy

Given a training corpus $\mathcal{D} = (x_1, \ldots, x_N)$, we maximize the log-likelihood:

$$\max_\theta \sum_{t=1}^{N} \log P_\theta(x_t \mid x_{<t})$$

Equivalently, we minimize the **cross-entropy**:

$$\mathcal{L}(\theta) = -\frac{1}{N} \sum_{t=1}^{N} \log P_\theta(x_t \mid x_{<t})$$

**Definition 3.7 (Cross-Entropy).** For a true distribution $P$ and model distribution $Q$ over $\mathcal{V}$:

$$H(P, Q) = -\sum_{w \in \mathcal{V}} P(w) \log Q(w) = H(P) + D_{\text{KL}}(P \| Q)$$

where $H(P)$ is the entropy and $D_{\text{KL}}$ is the KL divergence. Minimizing cross-entropy is equivalent to minimizing KL divergence since $H(P)$ is constant with respect to $Q$.

In practice, the "true distribution" at each step is a one-hot vector (the actual next token), so:

$$H(P_{\text{data}}, P_\theta) = -\mathbb{E}_{x \sim P_{\text{data}}} [\log P_\theta(x_t \mid x_{<t})]$$

### 3.6 Perplexity

**Definition 3.8 (Perplexity).** The perplexity of a language model $P_\theta$ on a test sequence $(x_1, \ldots, x_N)$ is:

$$\text{PPL}(x_1, \ldots, x_N) = \exp\left(-\frac{1}{N} \sum_{t=1}^{N} \log P_\theta(x_t \mid x_{<t})\right)$$

**Theorem 3.7 (Perplexity as Geometric Mean of Inverse Probabilities).**

$$\text{PPL} = \left(\prod_{t=1}^{N} \frac{1}{P_\theta(x_t \mid x_{<t})}\right)^{1/N}$$

*Proof.*

$$\text{PPL} = \exp\left(-\frac{1}{N} \sum_{t=1}^{N} \log P_\theta(x_t \mid x_{<t})\right) = \exp\left(\frac{1}{N} \sum_{t=1}^{N} \log \frac{1}{P_\theta(x_t \mid x_{<t})}\right)$$

$$= \exp\left(\frac{1}{N} \log \prod_{t=1}^{N} \frac{1}{P_\theta(x_t \mid x_{<t})}\right) = \left(\prod_{t=1}^{N} \frac{1}{P_\theta(x_t \mid x_{<t})}\right)^{1/N}$$

$\blacksquare$

**Theorem 3.8 (Perplexity and Cross-Entropy).** Perplexity is the exponentiation of cross-entropy:

$$\text{PPL} = 2^{H(P_{\text{data}}, P_\theta)} = e^{\mathcal{L}(\theta)}$$

(using natural log for the second expression, or base-2 log for the first).

*Proof.* By definition, $\mathcal{L}(\theta) = -\frac{1}{N} \sum_t \log P_\theta(x_t \mid x_{<t})$, so $\text{PPL} = \exp(\mathcal{L}(\theta))$. $\blacksquare$

**Interpretation of perplexity:**

1. **Effective vocabulary size**: A perplexity of $k$ means the model is "as confused as if it had to choose uniformly among $k$ options at each step." A uniform model over a vocabulary of size $V$ has perplexity $V$.

2. **Bits per token**: $\log_2(\text{PPL}) = H(P_{\text{data}}, P_\theta)$ (in bits). Shannon estimated the entropy of English at about 1.0-1.5 bits per character, giving a character-level perplexity lower bound of 2-2.8.

3. **Monotonic in cross-entropy**: Lower cross-entropy $\Leftrightarrow$ lower perplexity $\Leftrightarrow$ better model.

**Typical perplexity values (word-level, Penn Treebank):**

| Model | Perplexity |
|-------|-----------|
| Kneser-Ney 5-gram | ~141 |
| RNN (Mikolov 2010) | ~124 |
| LSTM (Zaremba 2014) | ~82 |
| AWD-LSTM (Merity 2018) | ~57 |
| Transformer-XL (Dai 2019) | ~54 |

### 3.7 Teacher Forcing

**Definition 3.9 (Teacher Forcing).** During training, the model receives the **ground-truth** previous token $x_{t-1}$ as input at each step $t$, rather than its own prediction $\hat{x}_{t-1}$.

Formally, during training:
$$h_t = f_\theta(h_{t-1}, \mathbf{e}_{x_t})$$

During generation (inference):
$$h_t = f_\theta(h_{t-1}, \mathbf{e}_{\hat{x}_t}), \quad \hat{x}_t \sim P_\theta(\cdot \mid x_{<t})$$

**Exposure bias:** Teacher forcing creates a train-test mismatch. During training, the model always sees correct prefixes. During generation, errors compound: if the model generates a bad token, it must condition on it, potentially leading to a cascade of errors. The model has never been "exposed" to its own mistakes during training.

### 3.8 Scheduled Sampling

**Definition 3.10 (Scheduled Sampling, Bengio et al., 2015).** A curriculum strategy that gradually transitions from teacher forcing to free-running generation during training. At each step $t$, with probability $\epsilon_i$ (which increases over training epoch $i$), use the model's own prediction; otherwise, use the ground truth.

**Algorithm:**

```
for epoch i = 1 to E:
    epsilon_i = schedule(i)         # e.g., epsilon_i = min(1, k / (k + exp(i/k)))
    for each training sequence:
        for t = 1 to T:
            if random() < epsilon_i:
                input_t = sample from P_theta(. | x_{<t})   # model's prediction
            else:
                input_t = x_t                                 # ground truth
            h_t = f(h_{t-1}, embed(input_t))
            compute loss at step t
```

**Tradeoffs:**

- Reduces exposure bias at the cost of slower convergence (ground truth provides a stronger learning signal).
- The schedule is a hyperparameter: too fast causes training instability, too slow does not help.

### 3.9 Sampling Strategies

At generation time, we need to draw tokens from $P_\theta(x_t \mid x_{<t})$. Several strategies exist:

**Greedy decoding:**
$$\hat{x}_t = \arg\max_{w \in \mathcal{V}} P_\theta(w \mid x_{<t})$$

Deterministic, fast, but tends to produce repetitive and generic text.

**Temperature scaling:**

Given logits $z_t \in \mathbb{R}^V$, define:

$$P_\tau(w \mid x_{<t}) = \frac{\exp(z_{t,w} / \tau)}{\sum_{w'} \exp(z_{t,w'} / \tau)}$$

where $\tau > 0$ is the temperature.

- $\tau \to 0$: approaches greedy (argmax).
- $\tau = 1$: original model distribution.
- $\tau \to \infty$: approaches uniform distribution.

**Theorem 3.9 (Temperature and Entropy).** The entropy of $P_\tau$ is monotonically increasing in $\tau$.

*Proof sketch.* As $\tau$ increases, the distribution becomes flatter (more uniform), and entropy is maximized by the uniform distribution. Formally, $\frac{d}{d\tau} H(P_\tau) > 0$ can be shown by computing the derivative and noting that the variance of the log-probabilities is positive. $\blacksquare$

**Top-k sampling (Fan et al., 2018):**

1. Sort the vocabulary by probability: $P_\theta(w_{(1)} \mid x_{<t}) \geq P_\theta(w_{(2)} \mid x_{<t}) \geq \cdots$
2. Keep only the top $k$ tokens: $\mathcal{V}_k = \{w_{(1)}, \ldots, w_{(k)}\}$
3. Renormalize: $P_k(w) = P_\theta(w) / \sum_{w' \in \mathcal{V}_k} P_\theta(w')$ for $w \in \mathcal{V}_k$
4. Sample $\hat{x}_t \sim P_k$.

**Problem with top-k:** The optimal $k$ varies by context. In some contexts, the distribution is peaked (few valid continuations), while in others it is flat (many valid continuations). A fixed $k$ is suboptimal.

**Top-p (nucleus) sampling (Holtzman et al., 2020):**

1. Sort the vocabulary by probability.
2. Find the smallest set $\mathcal{V}_p$ such that $\sum_{w \in \mathcal{V}_p} P_\theta(w \mid x_{<t}) \geq p$.
3. Renormalize and sample from $\mathcal{V}_p$.

This adaptively selects the vocabulary size based on the distribution's shape. When the model is confident, $|\mathcal{V}_p|$ is small; when uncertain, $|\mathcal{V}_p|$ is large.

### 3.10 Evaluation: BLEU Score

For conditional generation tasks (translation, summarization), perplexity alone is insufficient. The **BLEU score** (Papineni et al., 2002) measures n-gram overlap between generated and reference text.

**Definition 3.11 (BLEU).** Given a candidate translation $c$ and reference translations $\{r_1, \ldots, r_k\}$:

$$\text{BLEU} = \text{BP} \cdot \exp\left(\sum_{n=1}^{N} w_n \log p_n\right)$$

where:

- $p_n$ is the **modified n-gram precision**: the fraction of n-grams in $c$ that appear in some reference, with clipping to prevent gaming by repetition.
- $w_n = 1/N$ (typically $N=4$).
- $\text{BP} = \min(1, e^{1 - |r|/|c|})$ is the **brevity penalty**, penalizing candidates shorter than the reference.

**Limitations of BLEU:**

- Only measures n-gram overlap, not semantic similarity.
- Insensitive to word order beyond n-gram windows.
- Does not correlate well with human judgments for single sentences (better for corpus-level evaluation).

---

## 4. Algorithmic Derivation

### 4.1 RNN Language Model Training

```
Algorithm: Train RNN Language Model with Teacher Forcing
---------------------------------------------------------
Input: training corpus C = (w_1, ..., w_N), vocabulary V, hyperparameters
Output: trained model parameters theta

Initialize:
    E in R^{V x D}              # Embedding matrix
    RNN cell (LSTM or GRU)      # Hidden size n
    W_out in R^{V x n}          # Output projection

for epoch = 1 to num_epochs:
    h_0 = zeros(n)
    for each batch of consecutive tokens (x_1, ..., x_T):
        # Forward pass
        loss = 0
        for t = 1 to T:
            e_t = E[x_t]                           # (D,)   O(D)
            h_t = RNN_cell(e_t, h_{t-1})            # (n,)   O(n^2 + nD)
            logits_t = W_out @ h_t                  # (V,)   O(nV)
            probs_t = softmax(logits_t)             # (V,)   O(V)
            loss += -log(probs_t[x_{t+1}])          # scalar

        loss = loss / T

        # Backward pass (BPTT through T steps)
        compute gradients via BPTT                   # O(T * (n^2 + nV))
        clip_grad_norm(theta, max_norm)
        optimizer.step()

        # Detach hidden state for next batch (truncated BPTT)
        h_0 = h_T.detach()

Complexity per batch: O(T * (n^2 + nD + nV))
Bottleneck: softmax over V (can be very large)
```

### 4.2 Nucleus (Top-p) Sampling

```
Algorithm: Top-p (Nucleus) Sampling
-------------------------------------
Input: logits z in R^V, nucleus probability p in (0, 1], temperature tau
Output: sampled token index

# Apply temperature
z = z / tau

# Convert to probabilities
probs = softmax(z)                       # (V,)

# Sort in descending order
sorted_probs, sorted_indices = sort(probs, descending=True)

# Find nucleus (smallest set with cumulative prob >= p)
cumsum = cumulative_sum(sorted_probs)     # (V,)
cutoff_idx = first index where cumsum >= p
nucleus_probs = sorted_probs[0:cutoff_idx+1]
nucleus_indices = sorted_indices[0:cutoff_idx+1]

# Renormalize
nucleus_probs = nucleus_probs / sum(nucleus_probs)

# Sample
sampled_idx = categorical_sample(nucleus_probs)
return nucleus_indices[sampled_idx]

Complexity: O(V log V) due to sorting
```

### 4.3 Beam Search

```
Algorithm: Beam Search Decoding
---------------------------------
Input: encoder output (for seq2seq), beam width B, max length T_max
Output: best sequence

# Initialize beams
beams = [([], 0.0, h_0)]    # (tokens, log_prob, hidden_state)

for t = 1 to T_max:
    all_candidates = []
    for (tokens, score, h) in beams:
        if tokens[-1] == <eos>:
            all_candidates.append((tokens, score, h))
            continue

        # Compute next-token distribution
        logits = model.step(tokens[-1], h)    # (V,)
        log_probs = log_softmax(logits)        # (V,)

        # Expand top-B candidates for this beam
        top_B = top_k(log_probs, B)
        for (token, lp) in top_B:
            new_score = score + lp
            all_candidates.append((tokens + [token], new_score, new_h))

    # Keep top-B overall candidates
    beams = top_k(all_candidates, B, key=score)

    # Early stopping if all beams have ended
    if all beams end with <eos>:
        break

# Return highest-scoring complete sequence
# Optionally: length-normalize scores by dividing by len(tokens)^alpha
return best beam

Complexity: O(T_max * B * V) time, O(B * T_max) space
```

**Beam width tradeoffs:**

- $B = 1$: greedy decoding. Fast but suboptimal.
- $B = 5$-$10$: typical for machine translation. Good quality-speed tradeoff.
- $B \to \infty$: exact search (intractable).
- Larger $B$ can paradoxically hurt quality for open-ended generation (neural text degeneration).

---

## 5. PyTorch Implementation

### 5.1 Complete RNN Language Model

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Optional

class RNNLanguageModel(nn.Module):
    """
    LSTM-based language model with dropout regularization.
    """
    def __init__(
        self,
        vocab_size: int,     # V
        embed_dim: int,       # D
        hidden_size: int,     # n
        num_layers: int = 2,
        dropout: float = 0.5,
        tie_weights: bool = True  # Weight tying (Press & Wolf, 2017)
    ):
        super().__init__()
        self.vocab_size = vocab_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # Embedding layer: V -> D
        self.embedding = nn.Embedding(vocab_size, embed_dim)    # (V, D)
        self.embed_drop = nn.Dropout(dropout)

        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=embed_dim,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True
        )

        # Output projection: n -> V
        self.output_drop = nn.Dropout(dropout)
        self.output_proj = nn.Linear(hidden_size, vocab_size)   # (V, n)

        # Weight tying: share embedding and output weights
        if tie_weights and embed_dim == hidden_size:
            self.output_proj.weight = self.embedding.weight

        self._init_weights()

    def _init_weights(self):
        """Initialize weights following Merity et al. (2018)."""
        init_range = 0.1
        self.embedding.weight.data.uniform_(-init_range, init_range)
        self.output_proj.bias.data.zero_()
        if not hasattr(self.output_proj.weight, '_is_shared'):
            self.output_proj.weight.data.uniform_(-init_range, init_range)

    def forward(
        self,
        x: torch.Tensor,
        hidden: Optional[Tuple[torch.Tensor, torch.Tensor]] = None
    ) -> Tuple[torch.Tensor, Tuple[torch.Tensor, torch.Tensor]]:
        """
        Args:
            x:      (B, T) token indices
            hidden: (h_0, c_0) each of shape (num_layers, B, n)
        Returns:
            logits: (B, T, V) unnormalized log-probs
            hidden: (h_T, c_T) for next batch
        """
        B, T = x.shape

        if hidden is None:
            hidden = self._init_hidden(B, x.device)

        # Embed tokens
        emb = self.embedding(x)                  # (B, T, D)
        emb = self.embed_drop(emb)               # (B, T, D)

        # LSTM forward
        lstm_out, hidden = self.lstm(emb, hidden)  # (B, T, n), ((L, B, n), (L, B, n))

        # Project to vocabulary
        output = self.output_drop(lstm_out)       # (B, T, n)
        logits = self.output_proj(output)          # (B, T, V)

        return logits, hidden

    def _init_hidden(
        self, batch_size: int, device: torch.device
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """Initialize hidden state to zeros."""
        h0 = torch.zeros(self.num_layers, batch_size,
                         self.hidden_size, device=device)  # (L, B, n)
        c0 = torch.zeros(self.num_layers, batch_size,
                         self.hidden_size, device=device)  # (L, B, n)
        return (h0, c0)
```

### 5.2 Perplexity Computation

```python
@torch.no_grad()
def compute_perplexity(
    model: RNNLanguageModel,
    data_loader,
    device: str = "cpu"
) -> float:
    """
    Compute perplexity on a dataset.

    PPL = exp( -1/N * sum_t log P(x_t | x_{<t}) )

    where N is the total number of tokens.
    """
    model.eval()
    total_loss = 0.0
    total_tokens = 0
    hidden = None

    for x, y in data_loader:
        # x: (B, T) input tokens
        # y: (B, T) target tokens (x shifted by 1)
        x = x.to(device)
        y = y.to(device)

        logits, hidden = model(x, hidden)  # (B, T, V)

        # Detach hidden for next batch
        hidden = tuple(h.detach() for h in hidden)

        # Cross-entropy loss (summed, not averaged)
        loss = F.cross_entropy(
            logits.reshape(-1, logits.size(-1)),  # (B*T, V)
            y.reshape(-1),                         # (B*T,)
            reduction='sum'
        )
        total_loss += loss.item()
        total_tokens += y.numel()

    avg_loss = total_loss / total_tokens      # Cross-entropy per token
    perplexity = torch.exp(torch.tensor(avg_loss)).item()
    return perplexity
```

### 5.3 Sampling Strategies

```python
def sample_greedy(logits: torch.Tensor) -> torch.Tensor:
    """
    Greedy decoding: select the most probable token.
    Args:
        logits: (B, V) or (V,)
    Returns:
        token_ids: (B,) or scalar
    """
    return logits.argmax(dim=-1)

def sample_with_temperature(
    logits: torch.Tensor,
    temperature: float = 1.0
) -> torch.Tensor:
    """
    Sample from softmax(logits / temperature).
    Args:
        logits: (B, V)
        temperature: > 0. Lower = more peaked, higher = more uniform.
    Returns:
        token_ids: (B,)
    """
    if temperature == 0:
        return sample_greedy(logits)
    scaled_logits = logits / temperature             # (B, V)
    probs = F.softmax(scaled_logits, dim=-1)         # (B, V)
    return torch.multinomial(probs, num_samples=1).squeeze(-1)  # (B,)

def sample_top_k(
    logits: torch.Tensor,
    k: int = 50,
    temperature: float = 1.0
) -> torch.Tensor:
    """
    Top-k sampling: zero out all but the top k logits, then sample.
    Args:
        logits: (B, V)
        k: number of top tokens to keep
        temperature: temperature for sampling
    Returns:
        token_ids: (B,)
    """
    scaled = logits / temperature                    # (B, V)

    # Find the k-th largest value
    top_k_values, _ = torch.topk(scaled, k, dim=-1)  # (B, k)
    threshold = top_k_values[:, -1].unsqueeze(-1)    # (B, 1)

    # Zero out everything below threshold
    filtered = scaled.masked_fill(scaled < threshold, float('-inf'))  # (B, V)

    probs = F.softmax(filtered, dim=-1)              # (B, V)
    return torch.multinomial(probs, num_samples=1).squeeze(-1)  # (B,)

def sample_top_p(
    logits: torch.Tensor,
    p: float = 0.9,
    temperature: float = 1.0
) -> torch.Tensor:
    """
    Nucleus (top-p) sampling: keep the smallest set of tokens
    whose cumulative probability >= p.
    Args:
        logits: (B, V)
        p: nucleus probability threshold
        temperature: temperature for sampling
    Returns:
        token_ids: (B,)
    """
    scaled = logits / temperature                    # (B, V)

    # Sort in descending order
    sorted_logits, sorted_indices = torch.sort(scaled, descending=True, dim=-1)
    sorted_probs = F.softmax(sorted_logits, dim=-1)  # (B, V)

    # Cumulative sum
    cumsum = torch.cumsum(sorted_probs, dim=-1)      # (B, V)

    # Create mask: keep tokens where cumsum <= p (plus the first token exceeding p)
    mask = cumsum - sorted_probs > p                  # (B, V)
    sorted_logits[mask] = float('-inf')

    # Unsort
    # We need to scatter the filtered logits back to original positions
    filtered_logits = torch.zeros_like(logits)
    filtered_logits.scatter_(1, sorted_indices, sorted_logits)

    probs = F.softmax(filtered_logits, dim=-1)       # (B, V)
    return torch.multinomial(probs, num_samples=1).squeeze(-1)  # (B,)
```

### 5.4 Text Generation Loop

```python
@torch.no_grad()
def generate(
    model: RNNLanguageModel,
    prompt: torch.Tensor,
    max_length: int = 100,
    strategy: str = "top_p",
    temperature: float = 0.8,
    top_k: int = 50,
    top_p: float = 0.9,
    eos_token_id: int = None
) -> torch.Tensor:
    """
    Generate text autoregressively.

    Args:
        model: trained language model
        prompt: (1, T_prompt) initial token ids
        max_length: maximum tokens to generate
        strategy: "greedy", "temperature", "top_k", or "top_p"
        temperature: sampling temperature
        top_k: k for top-k sampling
        top_p: p for nucleus sampling
        eos_token_id: stop generation when this token is produced
    Returns:
        generated: (1, T_prompt + num_generated) full sequence
    """
    model.eval()
    device = prompt.device
    generated = prompt.clone()               # (1, T_prompt)
    hidden = None

    # Process prompt
    logits, hidden = model(prompt, hidden)   # (1, T_prompt, V)
    next_logits = logits[:, -1, :]           # (1, V) last position

    for _ in range(max_length):
        # Sample next token
        if strategy == "greedy":
            next_token = sample_greedy(next_logits)
        elif strategy == "temperature":
            next_token = sample_with_temperature(next_logits, temperature)
        elif strategy == "top_k":
            next_token = sample_top_k(next_logits, top_k, temperature)
        elif strategy == "top_p":
            next_token = sample_top_p(next_logits, top_p, temperature)

        next_token = next_token.unsqueeze(1)           # (1, 1)
        generated = torch.cat([generated, next_token], dim=1)  # (1, T+1)

        if eos_token_id is not None and next_token.item() == eos_token_id:
            break

        # Get logits for next step
        logits, hidden = model(next_token, hidden)     # (1, 1, V)
        next_logits = logits[:, -1, :]                 # (1, V)

    return generated
```

### 5.5 Full Training Script

```python
def train_language_model(
    model: RNNLanguageModel,
    train_loader,
    val_loader,
    epochs: int = 40,
    lr: float = 20.0,
    clip_norm: float = 0.25,
    device: str = "cpu"
):
    """
    Full training loop following Merity et al. (2018) practices.
    Uses SGD with learning rate annealing (ASGD variant omitted for clarity).
    """
    model = model.to(device)
    optimizer = torch.optim.SGD(model.parameters(), lr=lr)

    best_val_ppl = float('inf')

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0
        total_tokens = 0
        hidden = None

        for batch_idx, (x, y) in enumerate(train_loader):
            x = x.to(device)   # (B, T)
            y = y.to(device)   # (B, T)

            # Detach hidden state (truncated BPTT)
            if hidden is not None:
                hidden = tuple(h.detach() for h in hidden)

            logits, hidden = model(x, hidden)   # (B, T, V)

            loss = F.cross_entropy(
                logits.reshape(-1, model.vocab_size),   # (B*T, V)
                y.reshape(-1)                            # (B*T,)
            )

            optimizer.zero_grad()
            loss.backward()

            # Gradient clipping (essential!)
            torch.nn.utils.clip_grad_norm_(model.parameters(), clip_norm)

            optimizer.step()

            total_loss += loss.item() * y.numel()
            total_tokens += y.numel()

        train_ppl = torch.exp(torch.tensor(total_loss / total_tokens)).item()
        val_ppl = compute_perplexity(model, val_loader, device)

        print(f"Epoch {epoch}: train_ppl={train_ppl:.1f}, val_ppl={val_ppl:.1f}")

        # Learning rate annealing
        if val_ppl < best_val_ppl:
            best_val_ppl = val_ppl
        else:
            for param_group in optimizer.param_groups:
                param_group['lr'] /= 4.0

    return model
```

---

## 6. Experimental Intuition

### 6.1 Effect of Sampling Strategy on Text Quality

Given the prompt "The meaning of life is", typical outputs with different strategies:

| Strategy | Temperature | Example Output | Quality |
|----------|-------------|----------------|---------|
| Greedy | - | "the the the the..." | Repetitive |
| Temperature | 0.5 | "a question that has..." | Coherent but boring |
| Temperature | 1.0 | "found in the small moments..." | Diverse and coherent |
| Temperature | 1.5 | "zygote flying potato quantum..." | Incoherent |
| Top-k (k=50) | 1.0 | "something we each define for..." | Good balance |
| Top-p (p=0.9) | 1.0 | "not found in one answer but..." | Best overall |

### 6.2 Hyperparameter Guidance for Language Models

| Hyperparameter | Recommended | Notes |
|----------------|-------------|-------|
| Embedding dim | 256-400 | Tie with hidden size if using weight tying |
| Hidden size | 256-1150 | AWD-LSTM uses 1150 |
| Num layers | 2-3 | Diminishing returns beyond 3 |
| Dropout (embed) | 0.1-0.65 | Higher for larger models |
| Dropout (hidden) | 0.2-0.5 | |
| Learning rate (SGD) | 20-30 | With gradient clipping |
| Learning rate (Adam) | 1e-3 | |
| Gradient clip norm | 0.25 | Per Merity et al. |
| Batch size | 20-80 | |
| BPTT length | 35-70 | Longer helps but costs memory |
| Weight tying | Yes | Almost always helps |

### 6.3 Common Pitfalls

1. **Forgetting to detach hidden states between batches**: Memory grows without bound.
2. **Using perplexity across different tokenizations**: Character-level and word-level perplexities are not comparable. Always specify.
3. **Reporting perplexity on training data**: Always report on a held-out test set.
4. **Not using gradient clipping**: Training will diverge.
5. **Using Adam with high learning rate**: Adam with lr=20 (SGD setting) will diverge immediately. Use lr=1e-3 for Adam.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Material

- **Lecture 03a (RNNs)**: The RNN is the backbone of the language models discussed here. All gradient flow issues from 03a apply directly.
- **Lecture 03b (LSTM/GRU)**: LSTMs replaced vanilla RNNs for language modeling circa 2014 and remained dominant until Transformers.

### 7.2 Links to Future Material

- **Lecture 03d (Seq2Seq)**: Conditional language models (decoder) use the same autoregressive framework but condition on an encoded input.
- **Module 04 (Transformers)**: The Transformer replaces the LSTM but keeps the same training objective (next-token prediction with cross-entropy). Perplexity and sampling strategies remain unchanged.
- **Module 05 (LLMs)**: GPT-2/3/4 are language models scaled up by orders of magnitude. Everything in this lecture (perplexity, teacher forcing, sampling) applies directly.

### 7.3 Extensions

- **Adaptive softmax** (Grave et al., 2017): Hierarchical softmax that exploits Zipf's law for faster training when $V$ is large.
- **Mixture of Softmaxes** (Yang et al., 2018): Addresses the softmax bottleneck by using a mixture of softmax distributions.
- **Continuous cache** (Grave et al., 2017): Augments the LM with a cache of recent hidden states for improved handling of bursty topics.

---

## 8. Seminal Paper Reading List

### Required

1. **Bengio, Y., Ducharme, R., Vincent, P., & Jauvin, C. (2003).** "A Neural Probabilistic Language Model." *JMLR*, 3, 1137-1155.
   - *The paper that started neural language modeling. Read for the conceptual framework and the distributed representation argument.*

2. **Mikolov, T., Karafiat, M., Burget, L., Cernocky, J., & Khudanpur, S. (2010).** "Recurrent Neural Network Based Language Model." *Interspeech 2010*.
   - *First successful application of RNNs to language modeling. Short and clear.*

3. **Merity, S., Keskar, N. S., & Socher, R. (2018).** "Regularizing and Optimizing LSTM Language Models." *ICLR 2018*.
   - *AWD-LSTM: the pinnacle of LSTM-based language modeling. Essential for practical techniques.*

### Recommended

4. **Holtzman, A., Buys, J., Du, L., Forbes, M., & Choi, Y. (2020).** "The Curious Case of Neural Text Degeneration." *ICLR 2020*.
   - *Introduces nucleus sampling and analyzes why beam search and greedy decoding fail for open-ended generation.*

5. **Press, O. & Wolf, L. (2017).** "Using the Output Embedding to Improve Language Models." *EACL 2017*.
   - *Weight tying between embedding and output projection. Simple but effective.*

6. **Papineni, K., Roukos, S., Ward, T., & Zhu, W. J. (2002).** "BLEU: a Method for Automatic Evaluation of Machine Translation." *ACL 2002*.
   - *The standard (if imperfect) metric for generation tasks.*

---

## 9. Exercises

### Theory

**Exercise 3c.1.** Derive the gradient of the cross-entropy loss with respect to the logits $z_t$ for a single time step. That is, show that for $P = \text{softmax}(z)$ and loss $\ell = -\log P[y]$, we have $\frac{\partial \ell}{\partial z_i} = P[i] - \mathbb{1}[i = y]$.

**Exercise 3c.2.** Prove that perplexity equals the geometric mean of inverse probabilities (Theorem 3.7). Then show that for a uniform model over vocabulary $\mathcal{V}$, $\text{PPL} = |\mathcal{V}|$.

**Exercise 3c.3.** A bigram model estimates $P(w_t \mid w_{t-1}) = \frac{C(w_{t-1}, w_t)}{C(w_{t-1})}$ where $C$ denotes counts. Show that this is the maximum likelihood estimate. Then show that a trigram model has $O(V^3)$ parameters, and compute the number of parameters for $V = 10{,}000$.

**Exercise 3c.4.** Prove that temperature scaling with $\tau \to 0$ converges to the argmax distribution (a point mass on the highest-logit token). What happens when two tokens have equal highest logits?

**Exercise 3c.5.** Given a language model with perplexity 100 on a test corpus, compute:
(a) The cross-entropy (in nats and bits).
(b) The average number of bits needed per token (assuming optimal coding).
(c) If the vocabulary size is 10,000, what fraction of the "uncertainty" has the model eliminated compared to a uniform model?

### Implementation

**Exercise 3c.6.** Implement a character-level LSTM language model. Train it on a text corpus of your choice (e.g., Shakespeare, Wikipedia). Generate 1000 characters using each of the four sampling strategies and qualitatively compare the outputs.

**Exercise 3c.7.** Implement the full training pipeline from Section 5.5 and train on Penn Treebank. Report:
(a) Validation and test perplexity.
(b) Learning curves (train and validation loss per epoch).
(c) Effect of gradient clipping threshold on training stability (try $\tau \in \{0.1, 0.25, 1.0, 5.0, \infty\}$).

**Exercise 3c.8.** Implement scheduled sampling. Compare teacher forcing, scheduled sampling (linear schedule), and scheduled sampling (exponential schedule) on a character-level language model. Plot the exposure bias: measure the gap between teacher-forced perplexity and free-running perplexity over training.

**Exercise 3c.9.** Implement nucleus sampling from scratch (without using any library functions except basic tensor operations). Verify correctness: for $p = 1.0$, it should be equivalent to standard sampling; for very small $p$, it should approach greedy decoding.
