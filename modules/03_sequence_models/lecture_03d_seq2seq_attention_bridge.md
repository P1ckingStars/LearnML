# Lecture 03d: Sequence-to-Sequence Models, Attention, and the Bridge to Transformers

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Define** the encoder-decoder (seq2seq) architecture formally and explain how it factorizes the conditional distribution $P(y_1, \ldots, y_{T'} \mid x_1, \ldots, x_T)$.
2. **Identify** the information bottleneck problem: compressing an arbitrarily long input into a single fixed-length vector.
3. **Derive** the Bahdanau (additive) attention mechanism as a principled solution to the bottleneck, showing how it computes a context-dependent weighted sum of encoder hidden states.
4. **Compare** attention score functions (additive, dot-product, general) and analyze their computational complexity.
5. **Interpret** attention as soft alignment and visualize attention matrices for translation tasks.
6. **Implement** beam search with length normalization.
7. **Explain** copy mechanisms and pointer networks as extensions of attention.
8. **Articulate** how attention leads naturally to the Transformer architecture (Module 04).

---

## 2. Motivation and Context

### 2.1 The Sequence-to-Sequence Problem

Many important tasks map a variable-length input sequence to a variable-length output sequence:

- **Machine translation**: "I love cats" -> "J'aime les chats"
- **Text summarization**: long document -> short summary
- **Speech recognition**: audio waveform -> text transcript
- **Conversational AI**: question -> answer

The challenge: input and output have **different lengths**, and the mapping is **not monotonic** (word order can change across languages).

### 2.2 Historical Context

- **2014**: Sutskever, Vinyals, and Le propose the encoder-decoder architecture using LSTMs. Achieve competitive results on English-French translation by reading the input in reverse order.
- **2014**: Cho et al. independently propose the encoder-decoder framework with GRUs.
- **2015**: Bahdanau, Cho, and Bengio introduce the attention mechanism, allowing the decoder to "look back" at all encoder states. This is the key innovation.
- **2015**: Luong et al. simplify attention and propose dot-product attention.
- **2015**: Vinyals et al. introduce pointer networks, extending attention to copy from the input.
- **2017**: Vaswani et al. propose the Transformer, which uses attention as the sole mechanism (no recurrence). This lecture builds the bridge to that work.

The attention mechanism is arguably the most important single idea in modern deep learning. Understanding its origin in the seq2seq context is essential for understanding Transformers.

---

## 3. Core Theory

### 3.1 The Encoder-Decoder Architecture

**Definition 3.12 (Sequence-to-Sequence Model).** Given a source sequence $\mathbf{x} = (x_1, \ldots, x_T)$ and target sequence $\mathbf{y} = (y_1, \ldots, y_{T'})$, a seq2seq model factorizes the conditional distribution as:

$$P(\mathbf{y} \mid \mathbf{x}) = \prod_{t=1}^{T'} P(y_t \mid y_{<t}, \mathbf{x})$$

The model has two components:

**Encoder:** Maps the source sequence to a sequence of hidden representations.

$$h_t^{\text{enc}} = f_{\text{enc}}(x_t, h_{t-1}^{\text{enc}}), \quad t = 1, \ldots, T$$

**Decoder:** Generates the target sequence one token at a time, conditioned on the encoder output.

$$h_t^{\text{dec}} = f_{\text{dec}}(y_{t-1}, h_{t-1}^{\text{dec}}, \text{context}_t)$$
$$P(y_t \mid y_{<t}, \mathbf{x}) = \text{softmax}(W_o h_t^{\text{dec}})$$

### 3.2 The Vanilla Encoder-Decoder (Sutskever et al., 2014)

In the original formulation, the **entire** source sequence is compressed into the final encoder hidden state:

$$\text{context} = h_T^{\text{enc}} \quad \text{(a single vector } \in \mathbb{R}^n\text{)}$$

The decoder is initialized with this context:

$$h_0^{\text{dec}} = h_T^{\text{enc}}$$

and then proceeds autoregressively:

$$h_t^{\text{dec}} = \text{LSTM}([\mathbf{e}_{y_{t-1}}; h_0^{\text{dec}}], h_{t-1}^{\text{dec}})$$

**Trick from Sutskever et al.:** Reverse the input sequence. Reading "cats love I" instead of "I love cats" places the first words of the source closer (in terms of time steps) to the first words of the target, reducing the effective distance the gradient must travel.

### 3.3 The Information Bottleneck Problem

**Theorem 3.10 (Bottleneck).** The vanilla encoder-decoder compresses the source sequence into a fixed-dimensional vector $h_T^{\text{enc}} \in \mathbb{R}^n$, regardless of the source length $T$. By the data processing inequality:

$$I(y_t; x_1, \ldots, x_T) \leq I(y_t; h_T^{\text{enc}}) \leq n \log_2(M)$$

where $M$ bounds the range of each component. For sufficiently long or information-rich sources, this bottleneck prevents the decoder from accessing all relevant information.

**Empirical evidence (Cho et al., 2014):** Translation quality degrades sharply for sentences longer than ~20 words. The BLEU score drops from ~30 for short sentences to ~10 for sentences of length 50+.

### 3.4 Attention Mechanism: The Solution

**Definition 3.13 (Bahdanau Attention, 2015).** Instead of using a single context vector, the decoder computes a **different** context vector $c_t$ at each decoding step $t$, as a weighted sum of all encoder hidden states:

$$c_t = \sum_{j=1}^{T} \alpha_{t,j} \cdot h_j^{\text{enc}}$$

where the attention weights $\alpha_{t,j}$ are computed as:

$$\alpha_{t,j} = \frac{\exp(e_{t,j})}{\sum_{k=1}^{T} \exp(e_{t,k})}$$

and the attention scores $e_{t,j}$ measure the relevance of source position $j$ to the current decoder state:

$$e_{t,j} = \text{score}(h_{t-1}^{\text{dec}}, h_j^{\text{enc}})$$

The decoder update becomes:

$$h_t^{\text{dec}} = f_{\text{dec}}(y_{t-1}, h_{t-1}^{\text{dec}}, c_t)$$

**Interpretation:** The attention mechanism allows the decoder to dynamically select which parts of the source to focus on at each generation step. For translation, this corresponds to a soft alignment: when generating the French word "chats", the model attends primarily to the English word "cats".

### 3.5 Attention Score Functions

Three common choices for $\text{score}(h^{\text{dec}}, h^{\text{enc}})$:

**Additive (Bahdanau) attention:**

$$\text{score}(s, h) = v_a^T \tanh(W_a s + U_a h)$$

where $W_a \in \mathbb{R}^{d_a \times n_{\text{dec}}}$, $U_a \in \mathbb{R}^{d_a \times n_{\text{enc}}}$, $v_a \in \mathbb{R}^{d_a}$, and $d_a$ is the attention hidden dimension.

**Dot-product (Luong) attention:**

$$\text{score}(s, h) = s^T h$$

Requires $n_{\text{dec}} = n_{\text{enc}}$. Very efficient: no learnable parameters in the score function.

**General (bilinear) attention:**

$$\text{score}(s, h) = s^T W_a h$$

where $W_a \in \mathbb{R}^{n_{\text{dec}} \times n_{\text{enc}}}$.

**Scaled dot-product attention (Vaswani et al., 2017):**

$$\text{score}(s, h) = \frac{s^T h}{\sqrt{d_k}}$$

where $d_k$ is the dimension of the vectors. The scaling prevents the dot products from becoming large in magnitude, which would push the softmax into saturated regions with very small gradients.

**Theorem 3.11 (Motivation for Scaling).** Assume the components of $s$ and $h$ are independent random variables with mean 0 and variance 1. Then $\mathbb{E}[s^T h] = 0$ and $\text{Var}(s^T h) = d_k$.

*Proof.* Let $s = (s_1, \ldots, s_{d_k})$ and $h = (h_1, \ldots, h_{d_k})$.

$$s^T h = \sum_{i=1}^{d_k} s_i h_i$$

Since $s_i, h_i$ are independent with mean 0:

$$\mathbb{E}[s_i h_i] = \mathbb{E}[s_i]\mathbb{E}[h_i] = 0$$

$$\text{Var}(s_i h_i) = \mathbb{E}[s_i^2 h_i^2] - (\mathbb{E}[s_i h_i])^2 = \mathbb{E}[s_i^2]\mathbb{E}[h_i^2] = 1 \cdot 1 = 1$$

By independence across dimensions: $\text{Var}(s^T h) = d_k$.

Dividing by $\sqrt{d_k}$ normalizes the variance to 1, keeping the softmax inputs in a well-conditioned range. $\blacksquare$

**Complexity comparison:**

| Score Function | Parameters | Time per (s, h) pair | Notes |
|---------------|------------|---------------------|-------|
| Additive | $O(d_a(n_s + n_h) + d_a)$ | $O(d_a(n_s + n_h))$ | Most flexible |
| Dot-product | 0 | $O(n)$ | Fastest, requires equal dims |
| General | $O(n_s \cdot n_h)$ | $O(n_s \cdot n_h)$ | Middle ground |
| Scaled dot-product | 0 | $O(n)$ | Standard in Transformers |

### 3.6 Attention as Soft Alignment

In traditional machine translation, **alignment** is a mapping from target positions to source positions. A hard alignment $a_t \in \{1, \ldots, T\}$ says "target word $t$ is translated from source word $a_t$."

Attention computes a **soft alignment**: instead of a single source position, it computes a distribution over all source positions. The attention weight $\alpha_{t,j}$ can be interpreted as the probability that target word $t$ is aligned to source word $j$.

**Formal connection:** Let $a_t$ be a latent alignment variable. The marginal probability of the target word is:

$$P(y_t \mid y_{<t}, \mathbf{x}) = \sum_{j=1}^{T} P(a_t = j \mid y_{<t}, \mathbf{x}) \cdot P(y_t \mid y_{<t}, x_j, \mathbf{x})$$

Attention approximates this by:
- $P(a_t = j) \approx \alpha_{t,j}$ (the attention weight),
- $P(y_t \mid \ldots) \approx$ decoder output conditioned on $c_t = \sum_j \alpha_{t,j} h_j$.

### 3.7 Beam Search

**Definition 3.14 (Beam Search).** Beam search is an approximate search algorithm for finding the highest-probability output sequence. It maintains a set of $B$ partial hypotheses (the "beam") and expands them one token at a time.

At each step, each of the $B$ hypotheses is extended by all $V$ possible next tokens, producing $BV$ candidates. The top $B$ candidates (by cumulative log-probability) are kept.

**Length normalization:** Without normalization, beam search favors shorter sequences (since each additional token multiplies the probability by a factor $< 1$, i.e., adds a negative log-probability). The length-normalized score is:

$$\text{score}(y_1, \ldots, y_T) = \frac{1}{T^\alpha} \sum_{t=1}^{T} \log P(y_t \mid y_{<t})$$

where $\alpha \in [0, 1]$ controls the strength of the normalization ($\alpha = 0$: no normalization, $\alpha = 1$: full normalization).

**Theorem 3.12 (Beam Search is Not Optimal).** Beam search with beam width $B < V^{T_{\max}}$ does not guarantee finding the globally optimal sequence. It can miss sequences that require "low-probability intermediate steps" to reach a high-probability ending.

*Proof.* Consider a vocabulary $\{a, b\}$ and beam width $B = 1$ (greedy). Suppose $P(a) = 0.6$ and $P(b) = 0.4$, but $P(b \mid a) = 0.1$ and $P(a \mid b) = 0.9$. Then the greedy sequence is "aa" with probability $0.6 \times 0.1 = 0.06$, while "ba" has probability $0.4 \times 0.9 = 0.36$. Beam search with $B = 1$ chooses "a" first and misses the better sequence "ba". $\blacksquare$

### 3.8 Copy Mechanisms and Pointer Networks

**Problem:** Standard seq2seq models generate tokens from a fixed vocabulary. They cannot handle out-of-vocabulary (OOV) words (names, numbers) that should simply be copied from the source.

**Pointer Network (Vinyals et al., 2015):** Instead of using attention to compute a context vector, use the attention weights directly as a distribution over source positions. The output at each step is a **pointer** to an input position:

$$P(y_t = x_j \mid y_{<t}, \mathbf{x}) = \alpha_{t,j}$$

**Copy mechanism (Gu et al., 2016; See et al., 2017):** Combine the pointer and generator distributions. At each step, a **generation probability** $p_{\text{gen}} \in [0, 1]$ determines whether to generate from the vocabulary or copy from the source:

$$P(w) = p_{\text{gen}} \cdot P_{\text{vocab}}(w) + (1 - p_{\text{gen}}) \cdot \sum_{j: x_j = w} \alpha_{t,j}$$

where $p_{\text{gen}} = \sigma(w_c^T [c_t; h_t^{\text{dec}}; \mathbf{e}_{y_{t-1}}] + b_c)$.

---

## 4. Algorithmic Derivation

### 4.1 Seq2Seq with Attention: Full Forward Pass

```
Algorithm: Seq2Seq with Bahdanau Attention - Forward Pass
----------------------------------------------------------
Input: source tokens (x_1, ..., x_T), target tokens (y_1, ..., y_{T'})
Output: predicted probability distributions at each decoder step

# === ENCODER ===
for t = 1 to T:
    e_t = Embed_src(x_t)                               # (D,)
    h_t^enc = LSTM_enc(e_t, h_{t-1}^enc)              # (n_enc,)

# For bidirectional encoder:
#   h_t^enc = [h_t^fwd; h_t^bwd]                      # (2*n_enc,)

H_enc = stack(h_1^enc, ..., h_T^enc)                   # (T, n_enc)

# === DECODER ===
h_0^dec = initial_state(h_T^enc)                        # (n_dec,)

for t = 1 to T':
    # Step 1: Compute attention scores
    for j = 1 to T:                                     # O(T * d_a)
        e_{t,j} = v_a^T tanh(W_a h_{t-1}^dec + U_a h_j^enc)   # scalar

    # Step 2: Normalize to get attention weights
    alpha_t = softmax(e_{t,1}, ..., e_{t,T})            # (T,)   O(T)

    # Step 3: Compute context vector
    c_t = sum_j alpha_{t,j} * h_j^enc                  # (n_enc,)  O(T * n_enc)

    # Step 4: Decoder step
    input_t = [Embed_tgt(y_{t-1}); c_t]                # (D + n_enc,)
    h_t^dec = LSTM_dec(input_t, h_{t-1}^dec)           # (n_dec,)

    # Step 5: Output distribution
    logits_t = W_out @ [h_t^dec; c_t] + b_out          # (V,)
    P(y_t | ...) = softmax(logits_t)                     # (V,)

Total complexity: O(T * n_enc) for encoder
                + O(T' * T * d_a + T' * n_dec^2) for decoder
```

### 4.2 Beam Search with Length Normalization

```
Algorithm: Beam Search with Length Normalization
--------------------------------------------------
Input: encoder outputs H_enc, beam width B, max length T_max,
       length penalty alpha, EOS token
Output: best decoded sequence

# Initialize
beams = [Beam(tokens=[BOS], log_prob=0.0, state=h_0^dec)]
completed = []

for step = 1 to T_max:
    all_candidates = []

    for beam in beams:
        if beam.tokens[-1] == EOS:
            completed.append(beam)
            continue

        # Compute attention and next-token distribution
        logits = decoder_step(beam)                      # (V,)
        log_probs = log_softmax(logits)                  # (V,)

        # Get top-B extensions (pruning within each beam)
        top_tokens, top_lps = top_k(log_probs, B)       # Each (B,)

        for token, lp in zip(top_tokens, top_lps):
            new_beam = Beam(
                tokens = beam.tokens + [token],
                log_prob = beam.log_prob + lp,
                state = new_decoder_state
            )
            all_candidates.append(new_beam)

    # Keep overall top-B candidates
    all_candidates.sort(key=lambda b: b.log_prob, reverse=True)
    beams = all_candidates[:B]

    # Early stopping: if all beams have ended
    if len(beams) == 0:
        break

# Add any remaining active beams
completed.extend(beams)

# Length-normalize scores
for beam in completed:
    T = len(beam.tokens)
    beam.normalized_score = beam.log_prob / (T ** alpha)

# Return best
return max(completed, key=lambda b: b.normalized_score)
```

---

## 5. PyTorch Implementation

### 5.1 Encoder

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple

class Encoder(nn.Module):
    """
    Bidirectional LSTM encoder.
    Produces a sequence of hidden states for the attention mechanism.
    """
    def __init__(
        self,
        vocab_size: int,      # V_src
        embed_dim: int,        # D
        hidden_size: int,      # n
        num_layers: int = 2,
        dropout: float = 0.3
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.embedding = nn.Embedding(vocab_size, embed_dim)   # (V_src, D)
        self.rnn = nn.LSTM(
            embed_dim, hidden_size,
            num_layers=num_layers,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        self.dropout = nn.Dropout(dropout)

        # Project bidirectional hidden states to decoder size
        self.fc_h = nn.Linear(hidden_size * 2, hidden_size)  # (n, 2n)
        self.fc_c = nn.Linear(hidden_size * 2, hidden_size)  # (n, 2n)

    def forward(
        self, src: torch.Tensor, src_lengths: torch.Tensor
    ) -> Tuple[torch.Tensor, Tuple[torch.Tensor, torch.Tensor]]:
        """
        Args:
            src:         (B, T_src) source token indices
            src_lengths: (B,) actual lengths (for packing)
        Returns:
            enc_outputs: (B, T_src, 2*n) all encoder hidden states
            (h_dec_0, c_dec_0): initial decoder state, each (1, B, n)
        """
        B, T = src.shape

        # Embed and pack
        embedded = self.dropout(self.embedding(src))     # (B, T, D)
        packed = nn.utils.rnn.pack_padded_sequence(
            embedded, src_lengths.cpu(),
            batch_first=True, enforce_sorted=False
        )

        # Bidirectional LSTM
        packed_out, (h_n, c_n) = self.rnn(packed)
        # h_n: (2*L, B, n), c_n: (2*L, B, n)

        enc_outputs, _ = nn.utils.rnn.pad_packed_sequence(
            packed_out, batch_first=True
        )  # (B, T, 2*n)

        # Combine bidirectional final states for decoder initialization
        # Take the last layer's forward and backward states
        h_fwd = h_n[-2]   # (B, n) forward last layer
        h_bwd = h_n[-1]   # (B, n) backward last layer
        c_fwd = c_n[-2]   # (B, n)
        c_bwd = c_n[-1]   # (B, n)

        h_dec_0 = torch.tanh(
            self.fc_h(torch.cat([h_fwd, h_bwd], dim=1))  # (B, n)
        ).unsqueeze(0)  # (1, B, n)

        c_dec_0 = torch.tanh(
            self.fc_c(torch.cat([c_fwd, c_bwd], dim=1))
        ).unsqueeze(0)  # (1, B, n)

        return enc_outputs, (h_dec_0, c_dec_0)
```

### 5.2 Attention Module

```python
class BahdanauAttention(nn.Module):
    """
    Additive (Bahdanau) attention mechanism.

    score(s, h) = v^T tanh(W_s @ s + W_h @ h)
    """
    def __init__(self, enc_dim: int, dec_dim: int, attn_dim: int):
        super().__init__()
        self.W_enc = nn.Linear(enc_dim, attn_dim, bias=False)   # (d_a, n_enc)
        self.W_dec = nn.Linear(dec_dim, attn_dim, bias=False)   # (d_a, n_dec)
        self.v = nn.Linear(attn_dim, 1, bias=False)             # (1, d_a)

    def forward(
        self,
        decoder_state: torch.Tensor,
        encoder_outputs: torch.Tensor,
        mask: torch.Tensor = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            decoder_state:  (B, n_dec) current decoder hidden state
            encoder_outputs: (B, T_src, n_enc) all encoder hidden states
            mask:           (B, T_src) boolean mask (True = ignore)
        Returns:
            context:        (B, n_enc) context vector
            attn_weights:   (B, T_src) attention distribution
        """
        T_src = encoder_outputs.size(1)

        # Project decoder state and broadcast
        # (B, n_dec) -> (B, d_a) -> (B, 1, d_a) -> (B, T_src, d_a)
        dec_proj = self.W_dec(decoder_state).unsqueeze(1)
        dec_proj = dec_proj.expand(-1, T_src, -1)

        # Project encoder outputs
        # (B, T_src, n_enc) -> (B, T_src, d_a)
        enc_proj = self.W_enc(encoder_outputs)

        # Compute scores
        # (B, T_src, d_a) -> (B, T_src, 1) -> (B, T_src)
        energy = self.v(torch.tanh(dec_proj + enc_proj)).squeeze(-1)

        # Apply mask (for padded positions)
        if mask is not None:
            energy = energy.masked_fill(mask, float('-inf'))

        # Normalize
        attn_weights = F.softmax(energy, dim=1)          # (B, T_src)

        # Compute context
        # (B, 1, T_src) @ (B, T_src, n_enc) -> (B, 1, n_enc) -> (B, n_enc)
        context = torch.bmm(
            attn_weights.unsqueeze(1),
            encoder_outputs
        ).squeeze(1)

        return context, attn_weights


class LuongDotAttention(nn.Module):
    """
    Dot-product (Luong) attention.
    Requires encoder and decoder to have the same hidden dimension.

    score(s, h) = s^T h
    """
    def __init__(self):
        super().__init__()

    def forward(
        self,
        decoder_state: torch.Tensor,
        encoder_outputs: torch.Tensor,
        mask: torch.Tensor = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            decoder_state:   (B, n)
            encoder_outputs: (B, T_src, n)
            mask:            (B, T_src)
        Returns:
            context:      (B, n)
            attn_weights: (B, T_src)
        """
        # (B, T_src, n) @ (B, n, 1) -> (B, T_src, 1) -> (B, T_src)
        scores = torch.bmm(
            encoder_outputs,
            decoder_state.unsqueeze(2)
        ).squeeze(2)

        # Scale by sqrt(d)
        scores = scores / (decoder_state.size(-1) ** 0.5)

        if mask is not None:
            scores = scores.masked_fill(mask, float('-inf'))

        attn_weights = F.softmax(scores, dim=1)              # (B, T_src)

        context = torch.bmm(
            attn_weights.unsqueeze(1),
            encoder_outputs
        ).squeeze(1)   # (B, n)

        return context, attn_weights
```

### 5.3 Decoder with Attention

```python
class AttentionDecoder(nn.Module):
    """
    LSTM decoder with Bahdanau attention.
    At each step: attend to encoder outputs, feed context + embedding to LSTM.
    """
    def __init__(
        self,
        vocab_size: int,       # V_tgt
        embed_dim: int,         # D
        hidden_size: int,       # n_dec
        enc_hidden_size: int,   # n_enc (2*n for bidirectional encoder)
        attn_dim: int = 128,    # d_a
        dropout: float = 0.3
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.vocab_size = vocab_size

        self.embedding = nn.Embedding(vocab_size, embed_dim)  # (V_tgt, D)
        self.attention = BahdanauAttention(enc_hidden_size, hidden_size, attn_dim)

        # LSTM input: embedding + context vector
        self.rnn = nn.LSTMCell(embed_dim + enc_hidden_size, hidden_size)

        # Output projection from concatenation of hidden state and context
        self.output_proj = nn.Linear(
            hidden_size + enc_hidden_size, vocab_size
        )  # (V, n_dec + n_enc)
        self.dropout = nn.Dropout(dropout)

    def forward_step(
        self,
        y_prev: torch.Tensor,
        h_prev: torch.Tensor,
        c_prev: torch.Tensor,
        enc_outputs: torch.Tensor,
        mask: torch.Tensor = None
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Single decoder step.

        Args:
            y_prev:      (B,) previous target token indices
            h_prev:      (B, n_dec) previous hidden state
            c_prev:      (B, n_dec) previous cell state
            enc_outputs: (B, T_src, n_enc)
            mask:        (B, T_src)
        Returns:
            logits:      (B, V_tgt)
            h_t:         (B, n_dec)
            c_t:         (B, n_dec)
            attn_weights: (B, T_src)
        """
        # Embed previous token
        emb = self.dropout(self.embedding(y_prev))   # (B, D)

        # Compute attention using previous decoder state
        context, attn_weights = self.attention(
            h_prev, enc_outputs, mask
        )  # (B, n_enc), (B, T_src)

        # LSTM step with concatenated input
        rnn_input = torch.cat([emb, context], dim=1)  # (B, D + n_enc)
        h_t, c_t = self.rnn(rnn_input, (h_prev, c_prev))  # Each (B, n_dec)

        # Output: concatenate hidden state and context
        output = torch.cat([h_t, context], dim=1)     # (B, n_dec + n_enc)
        output = self.dropout(output)
        logits = self.output_proj(output)              # (B, V_tgt)

        return logits, h_t, c_t, attn_weights

    def forward(
        self,
        targets: torch.Tensor,
        enc_outputs: torch.Tensor,
        init_state: Tuple[torch.Tensor, torch.Tensor],
        mask: torch.Tensor = None
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Full decoding with teacher forcing.

        Args:
            targets:     (B, T_tgt) target tokens (including BOS)
            enc_outputs: (B, T_src, n_enc)
            init_state:  (h_0, c_0) each (1, B, n_dec)
            mask:        (B, T_src)
        Returns:
            logits:       (B, T_tgt-1, V) predictions for positions 1..T_tgt-1
            attn_weights: (B, T_tgt-1, T_src)
        """
        B, T_tgt = targets.shape

        h_t = init_state[0].squeeze(0)  # (B, n_dec)
        c_t = init_state[1].squeeze(0)  # (B, n_dec)

        all_logits = []
        all_attn = []

        for t in range(T_tgt - 1):
            y_prev = targets[:, t]       # (B,) teacher forcing
            logits, h_t, c_t, attn = self.forward_step(
                y_prev, h_t, c_t, enc_outputs, mask
            )
            all_logits.append(logits)    # (B, V)
            all_attn.append(attn)        # (B, T_src)

        logits = torch.stack(all_logits, dim=1)   # (B, T_tgt-1, V)
        attn_weights = torch.stack(all_attn, dim=1)  # (B, T_tgt-1, T_src)
        return logits, attn_weights
```

### 5.4 Complete Seq2Seq Model

```python
class Seq2Seq(nn.Module):
    """
    Complete sequence-to-sequence model with attention.
    """
    def __init__(self, encoder: Encoder, decoder: AttentionDecoder):
        super().__init__()
        self.encoder = encoder
        self.decoder = decoder

    def forward(
        self,
        src: torch.Tensor,
        src_lengths: torch.Tensor,
        tgt: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            src:         (B, T_src) source token indices
            src_lengths: (B,) source lengths
            tgt:         (B, T_tgt) target tokens (with BOS prefix)
        Returns:
            logits:      (B, T_tgt-1, V_tgt)
            attn:        (B, T_tgt-1, T_src)
        """
        # Create mask for padded positions
        max_len = src.size(1)
        mask = torch.arange(max_len, device=src.device).unsqueeze(0) >= \
               src_lengths.unsqueeze(1)  # (B, T_src), True where padded

        # Encode
        enc_outputs, init_state = self.encoder(src, src_lengths)

        # Decode
        logits, attn = self.decoder(tgt, enc_outputs, init_state, mask)

        return logits, attn


# === Instantiation example ===
def build_model(
    src_vocab_size: int = 10000,
    tgt_vocab_size: int = 10000,
    embed_dim: int = 256,
    hidden_size: int = 512,
    num_layers: int = 2,
    dropout: float = 0.3
) -> Seq2Seq:
    encoder = Encoder(
        src_vocab_size, embed_dim, hidden_size, num_layers, dropout
    )
    decoder = AttentionDecoder(
        tgt_vocab_size, embed_dim, hidden_size,
        enc_hidden_size=hidden_size * 2,  # bidirectional
        attn_dim=128, dropout=dropout
    )
    model = Seq2Seq(encoder, decoder)

    # Parameter count
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters: {total_params:,}")
    # Typical: ~30-50M for these sizes

    return model
```

### 5.5 Attention Visualization

```python
import matplotlib.pyplot as plt
import numpy as np

def plot_attention(
    attention_weights: np.ndarray,
    source_tokens: list,
    target_tokens: list,
    save_path: str = None
):
    """
    Visualize attention weights as a heatmap.

    Args:
        attention_weights: (T_tgt, T_src) numpy array
        source_tokens: list of source token strings
        target_tokens: list of target token strings
    """
    fig, ax = plt.subplots(figsize=(10, 8))

    im = ax.imshow(attention_weights, cmap='viridis', aspect='auto')

    # Set tick labels
    ax.set_xticks(range(len(source_tokens)))
    ax.set_yticks(range(len(target_tokens)))
    ax.set_xticklabels(source_tokens, rotation=45, ha='right')
    ax.set_yticklabels(target_tokens)

    ax.set_xlabel('Source')
    ax.set_ylabel('Target')
    ax.set_title('Attention Weights')

    plt.colorbar(im, ax=ax)
    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
    plt.show()


# Usage example:
# attn = model_output['attn_weights'][0].cpu().numpy()  # First example in batch
# plot_attention(attn, src_tokens, tgt_tokens)
```

### 5.6 Beam Search Implementation

```python
from dataclasses import dataclass, field
from typing import List
import heapq

@dataclass
class BeamHypothesis:
    tokens: List[int]
    log_prob: float
    h: torch.Tensor      # (n_dec,)
    c: torch.Tensor      # (n_dec,)

    @property
    def length(self) -> int:
        return len(self.tokens)

    def normalized_score(self, alpha: float = 0.7) -> float:
        """Length-normalized log probability."""
        return self.log_prob / (self.length ** alpha)


@torch.no_grad()
def beam_search(
    model: Seq2Seq,
    src: torch.Tensor,
    src_lengths: torch.Tensor,
    beam_width: int = 5,
    max_length: int = 100,
    length_penalty_alpha: float = 0.7,
    bos_token_id: int = 1,
    eos_token_id: int = 2,
) -> List[int]:
    """
    Beam search decoding for seq2seq model.

    Args:
        model: trained Seq2Seq model
        src: (1, T_src) single source sequence
        src_lengths: (1,) source length
        beam_width: number of beams
        max_length: maximum decoding length
        length_penalty_alpha: length normalization exponent
    Returns:
        best_tokens: list of token ids (best hypothesis)
    """
    model.eval()
    device = src.device

    # Encode source
    mask = torch.arange(src.size(1), device=device).unsqueeze(0) >= \
           src_lengths.unsqueeze(1)
    enc_outputs, (h_0, c_0) = model.encoder(src, src_lengths)
    # enc_outputs: (1, T_src, n_enc)
    # h_0, c_0: (1, 1, n_dec)

    h_0 = h_0.squeeze(0).squeeze(0)  # (n_dec,)
    c_0 = c_0.squeeze(0).squeeze(0)  # (n_dec,)

    # Initialize beam
    initial = BeamHypothesis(
        tokens=[bos_token_id], log_prob=0.0, h=h_0, c=c_0
    )
    beams = [initial]
    completed = []

    for step in range(max_length):
        if not beams:
            break

        all_candidates = []

        for beam in beams:
            if beam.tokens[-1] == eos_token_id:
                completed.append(beam)
                continue

            # Run one decoder step
            y_prev = torch.tensor([beam.tokens[-1]], device=device)  # (1,)
            logits, h_new, c_new, _ = model.decoder.forward_step(
                y_prev,
                beam.h.unsqueeze(0),       # (1, n_dec)
                beam.c.unsqueeze(0),       # (1, n_dec)
                enc_outputs,               # (1, T_src, n_enc)
                mask                       # (1, T_src)
            )
            # logits: (1, V)
            log_probs = F.log_softmax(logits.squeeze(0), dim=-1)  # (V,)

            # Get top-k extensions
            topk_lps, topk_ids = log_probs.topk(beam_width)  # Each (B,)

            for lp, token_id in zip(topk_lps.tolist(), topk_ids.tolist()):
                new_beam = BeamHypothesis(
                    tokens=beam.tokens + [token_id],
                    log_prob=beam.log_prob + lp,
                    h=h_new.squeeze(0),
                    c=c_new.squeeze(0)
                )
                all_candidates.append(new_beam)

        # Keep top-B overall
        all_candidates.sort(
            key=lambda b: b.log_prob, reverse=True
        )
        beams = all_candidates[:beam_width]

    # Add remaining beams
    completed.extend(beams)

    if not completed:
        return [bos_token_id]

    # Return best by normalized score
    best = max(completed, key=lambda b: b.normalized_score(length_penalty_alpha))
    return best.tokens
```

---

## 6. Experimental Intuition

### 6.1 Attention Patterns

Well-trained attention models exhibit characteristic patterns:

- **Monotonic attention** (translation between similar-order languages, e.g., English-French): the attention matrix is roughly diagonal.
- **Reordering** (English-Japanese): the attention matrix shows clear off-diagonal patterns corresponding to syntactic restructuring.
- **Many-to-one** (summarization): multiple source positions attend to the same target position.
- **Diffuse attention** (at BOS/EOS tokens): the model often spreads attention uniformly, using these positions as "default" states.

### 6.2 Beam Width Tradeoffs

| Beam Width | BLEU (WMT En-De) | Tokens/sec | Notes |
|------------|-------------------|------------|-------|
| 1 (greedy) | 24.1 | 1000 | Fast but suboptimal |
| 4 | 26.8 | 280 | Good tradeoff |
| 10 | 27.2 | 120 | Diminishing returns |
| 50 | 27.0 | 25 | Slight degradation (length bias) |
| 100 | 26.5 | 12 | Worse (short, high-probability outputs) |

The non-monotonic relationship between beam width and quality is known as the **beam search curse**: very wide beams can find high-probability but degenerate sequences (empty sequences, repeated tokens).

### 6.3 Key Hyperparameters

| Parameter | Typical Value | Notes |
|-----------|---------------|-------|
| Encoder layers | 2-4 | Bidirectional |
| Decoder layers | 2-4 | Unidirectional |
| Hidden size | 256-1024 | |
| Attention dimension | 128-512 | |
| Embedding dim | 256-512 | |
| Dropout | 0.2-0.4 | On embeddings, RNN outputs, attention |
| Label smoothing | 0.1 | Helps generalization |
| Learning rate | 1e-3 (Adam) | With warmup |
| Gradient clip | 1.0-5.0 | |
| Beam width | 4-10 | For inference |
| Length penalty | 0.6-1.0 | |

### 6.4 Failure Modes

1. **Attention collapse**: The model attends to the same position(s) for every decoder step. Usually indicates insufficient training or a bug in masking.
2. **Repetitive generation**: Beam search produces repetitive text ("the the the"). Use repetition penalty or nucleus sampling.
3. **Hallucination**: The model generates fluent but factually incorrect content. A fundamental issue with autoregressive generation.
4. **Length mismatch**: Output is much shorter or longer than expected. Adjust length penalty.

---

## 7. Connections and Extensions

### 7.1 Links to Prior Material

- **Lecture 03b (LSTM/GRU)**: The encoder and decoder are LSTM (or GRU) networks. All training techniques from 03b apply.
- **Lecture 03c (Language Modeling)**: The decoder is an autoregressive language model, conditioned on the encoder output. Perplexity, teacher forcing, and sampling strategies all carry over.

### 7.2 The Bridge to Transformers (Module 04)

The attention mechanism introduced here contains the seeds of the Transformer:

1. **Attention as the primary mechanism**: In seq2seq, attention supplements the RNN. In Transformers, attention replaces the RNN entirely.
2. **Self-attention**: Here, the decoder attends to the encoder (cross-attention). The Transformer also applies attention within the encoder and decoder (self-attention), where each position attends to all other positions in the same sequence.
3. **Multi-head attention**: Instead of a single attention function, use $H$ parallel attention heads with different learned projections, then concatenate.
4. **Query-Key-Value formulation**: The Transformer formalizes attention as $\text{Attention}(Q, K, V) = \text{softmax}(QK^T / \sqrt{d_k}) V$, which generalizes the score-weight-context pipeline.

The progression: RNN -> RNN + Attention -> Attention Only (Transformer).

### 7.3 Extensions

- **Local attention** (Luong et al., 2015): Attend only to a window of source positions, reducing complexity from $O(T)$ to $O(w)$.
- **Monotonic attention** (Raffel et al., 2017): Enforce left-to-right alignment for streaming applications.
- **Multi-source attention**: Attend to multiple encoder sequences simultaneously (e.g., for multimodal inputs).
- **Transformer-based seq2seq**: Replace LSTM encoder/decoder with Transformer blocks (Module 04). This is the modern standard.

---

## 8. Seminal Paper Reading List

### Required

1. **Sutskever, I., Vinyals, O., & Le, Q. V. (2014).** "Sequence to Sequence Learning with Neural Networks." *NeurIPS 2014*.
   - *The original seq2seq paper. Read for the architecture and the input-reversal trick.*

2. **Bahdanau, D., Cho, K., & Bengio, Y. (2015).** "Neural Machine Translation by Jointly Learning to Align and Translate." *ICLR 2015*.
   - *Introduces attention. One of the most influential papers in deep learning. Read in full.*

3. **Luong, T., Pham, H., & Manning, C. D. (2015).** "Effective Approaches to Attention-based Neural Machine Translation." *EMNLP 2015*.
   - *Simplifies attention (dot-product), introduces local attention. Essential companion to Bahdanau.*

### Recommended

4. **Vinyals, O., Fortunato, M., & Jaitly, N. (2015).** "Pointer Networks." *NeurIPS 2015*.
   - *Extends attention to pointing/copying. Important for understanding copy mechanisms.*

5. **See, A., Liu, P. J., & Manning, C. D. (2017).** "Get To The Point: Summarization with Pointer-Generator Networks." *ACL 2017*.
   - *Combines copying and generation. Practical and well-written.*

6. **Wu, Y., et al. (2016).** "Google's Neural Machine Translation System: Bridging the Gap between Human and Machine Translation." *arXiv*.
   - *Engineering-focused paper describing the full Google NMT system. Good for practical details.*

7. **Vaswani, A., et al. (2017).** "Attention Is All You Need." *NeurIPS 2017*.
   - *The Transformer. Read the introduction to understand how it builds on the attention mechanisms from this lecture. Full coverage in Module 04.*

---

## 9. Exercises

### Theory

**Exercise 3d.1.** Prove that the vanilla encoder-decoder suffers from an information bottleneck. Specifically, show that for a source sequence of length $T$, the mutual information $I(X_1, \ldots, X_T; h_T^{\text{enc}})$ is bounded by a quantity that does not grow with $T$ (assuming bounded hidden state).

**Exercise 3d.2.** Show that attention with softmax weights can be interpreted as a kernel smoothing operation. Specifically, write $c_t = \sum_j \alpha_{t,j} h_j$ as $c_t = \sum_j K(q_t, k_j) h_j / \sum_j K(q_t, k_j)$ for an appropriate kernel $K$.

**Exercise 3d.3.** Prove Theorem 3.11 (motivation for scaling in dot-product attention). Extend the result: if the components of $s$ and $h$ have variance $\sigma^2$ instead of 1, what is the appropriate scaling factor?

**Exercise 3d.4.** Analyze the computational complexity of the attention mechanism. For a source sequence of length $T_s$ and target of length $T_t$:
(a) What is the time complexity of computing all attention weights?
(b) What is the space complexity of storing the attention matrix?
(c) How does this compare to the recurrent computation in the encoder/decoder?

**Exercise 3d.5.** In beam search, prove that greedy decoding (beam width 1) can produce a suboptimal sequence. Construct an explicit example with vocabulary size 2 and sequence length 2 where greedy decoding is suboptimal.

### Implementation

**Exercise 3d.6.** Implement the full seq2seq model with Bahdanau attention from Section 5. Train it on a small translation dataset (e.g., Multi30k English-German). Report BLEU scores and visualize attention weights for 5 example sentences.

**Exercise 3d.7.** Implement both Bahdanau (additive) and Luong (dot-product) attention. Train both on the same task and compare:
(a) BLEU scores.
(b) Training speed (time per epoch).
(c) Attention weight visualizations.
Explain any differences in terms of the score function properties.

**Exercise 3d.8.** Implement beam search with length normalization. Run experiments with beam widths $B \in \{1, 2, 4, 8, 16, 32\}$ and plot BLEU score vs. beam width. Verify the non-monotonic relationship described in Section 6.2.

**Exercise 3d.9.** Implement a simple copy mechanism (See et al., 2017). Train on a synthetic "copy task" where the model must copy a random input sequence to the output. Verify that the model learns to use the copy mechanism (check that $p_{\text{gen}} \approx 0$).
