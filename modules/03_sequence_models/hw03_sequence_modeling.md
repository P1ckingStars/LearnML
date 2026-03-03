# Homework 03: Sequence Modeling

**Estimated Time:** ~20 hours
**Due Date:** See course schedule
**Submission:** Submit a single ZIP file containing your code, a PDF write-up, and a `requirements.txt`.

---

## Overview

This homework covers the core concepts from Module 03: recurrent neural networks, gated architectures (LSTM/GRU), language modeling, and attention mechanisms. Part A (50%) tests your mathematical understanding through derivations and proofs. Part B (50%) requires you to implement these architectures from scratch and train them on real datasets.

**Academic Integrity:** All code must be your own. You may use PyTorch's basic tensor operations (`torch.matmul`, `torch.sigmoid`, etc.) but **not** high-level modules (`nn.RNN`, `nn.LSTM`, `nn.GRU`, `nn.MultiheadAttention`) unless explicitly stated.

**Notation:** Throughout, we use:

- $x_t \in \mathbb{R}^d$: input at time $t$
- $h_t \in \mathbb{R}^n$: hidden state at time $t$
- $W_{hh} \in \mathbb{R}^{n \times n}$: recurrent weight matrix
- $W_{xh} \in \mathbb{R}^{n \times d}$: input weight matrix
- $\sigma(\cdot)$: element-wise nonlinearity (tanh unless specified)
- $\odot$: Hadamard (element-wise) product
- $\rho(A)$: spectral radius of matrix $A$ (largest absolute eigenvalue)
- $\|A\|$: spectral norm of matrix $A$ (largest singular value)

---

## Part A: Mathematical Derivations (50%)

### Problem A1: Full BPTT Gradient for Vanilla RNN (12 points)

Consider the vanilla RNN:
$$h_t = \tanh(W_{hh} h_{t-1} + W_{xh} x_t + b)$$
$$\hat{y}_t = W_{hy} h_t + b_y$$
$$\mathcal{L} = \sum_{t=1}^{T} \ell(\hat{y}_t, y_t)$$

**(a)** (4 points) Derive $\frac{\partial \mathcal{L}}{\partial W_{hh}}$ via Backpropagation Through Time. Express your answer as a sum over time steps, with each term involving:

- The immediate partial derivative $\frac{\partial^+ h_k}{\partial W_{hh}}$ (treating $h_{k-1}$ as constant),
- The product of Jacobians $\prod_{s=k+1}^{t} \frac{\partial h_s}{\partial h_{s-1}}$.

Show every step of the chain rule application. State clearly what $\frac{\partial^+ h_k}{\partial W_{hh}}$ equals (it should be a rank-3 tensor or expressed as a matrix using appropriate vectorization).

**(b)** (4 points) Compute the Jacobian $\frac{\partial h_t}{\partial h_{t-1}}$ explicitly. Show that:
$$\frac{\partial h_t}{\partial h_{t-1}} = \text{diag}(1 - h_t^2) \cdot W_{hh}$$
where $h_t^2$ denotes the element-wise square of $h_t$ (using the property that $\tanh'(z) = 1 - \tanh^2(z)$).

**(c)** (4 points) For the full product of Jacobians:
$$\frac{\partial h_T}{\partial h_t} = \prod_{s=t+1}^{T} \text{diag}(1 - h_s^2) \cdot W_{hh}$$

Provide explicit expressions for the case $T - t = 1$, $T - t = 2$, and $T - t = 3$, and verify that the general formula is consistent.

---

### Problem A2: Spectral Radius Bound on Gradient Norm (10 points)

**(a)** (3 points) Prove that for the vanilla RNN with $\sigma = \tanh$:
$$\left\|\frac{\partial h_T}{\partial h_t}\right\|_2 \leq \|W_{hh}\|_2^{T-t}$$

*Hint:* Use $\|\text{diag}(1 - h_s^2)\|_2 \leq 1$ and the submultiplicativity of the spectral norm.

**(b)** (3 points) Now prove the tighter bound using the spectral radius. For a linear RNN ($\sigma = \text{id}$), show that:
$$\left\|\frac{\partial h_T}{\partial h_t}\right\|_2 = \|W_{hh}^{T-t}\|_2$$

and that $\lim_{k \to \infty} \|W_{hh}^k\|_2^{1/k} = \rho(W_{hh})$. Conclude that the gradient norm is asymptotically bounded by $\rho(W_{hh})^{T-t}$.

**(c)** (4 points) Consider the nonlinear case. Define the **effective spectral radius**:
$$\rho_{\text{eff}} = \lim_{k \to \infty} \left\|\prod_{s=t+1}^{t+k} \text{diag}(\sigma'(z_s)) W_{hh}\right\|^{1/k}$$

Argue (you may use results from dynamical systems without proof) that:

1. $\rho_{\text{eff}} \leq \|W_{hh}\|_2$ (the spectral norm bound).
2. In the typical case where the RNN operates in a region where $|\sigma'(z)| < 1$ for most components, $\rho_{\text{eff}} < \|W_{hh}\|_2$.
3. When $\rho_{\text{eff}} < 1$, the gradient vanishes; when $\rho_{\text{eff}} > 1$, it explodes.

---

### Problem A3: LSTM Backward Pass (10 points)

Consider a single LSTM cell:
$$f_t = \sigma(W_f [h_{t-1}, x_t] + b_f)$$
$$i_t = \sigma(W_i [h_{t-1}, x_t] + b_i)$$
$$\tilde{c}_t = \tanh(W_c [h_{t-1}, x_t] + b_c)$$
$$o_t = \sigma(W_o [h_{t-1}, x_t] + b_o)$$
$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$$
$$h_t = o_t \odot \tanh(c_t)$$

Let $\delta h_t = \frac{\partial \mathcal{L}}{\partial h_t}$ and $\delta c_t^{\text{next}} = \frac{\partial \mathcal{L}}{\partial c_t}$ (from future time steps through the cell state) be given.

**(a)** (3 points) Derive $\frac{\partial \mathcal{L}}{\partial c_t}$ (the total gradient to the cell state at time $t$). Express it in terms of $\delta h_t$, $o_t$, $c_t$, and $\delta c_t^{\text{next}}$.

**(b)** (3 points) Derive the gradients with respect to each gate's pre-activation:
$$\delta \bar{f}_t, \quad \delta \bar{i}_t, \quad \delta \bar{c}_t, \quad \delta \bar{o}_t$$

where $f_t = \sigma(\bar{f}_t)$, $i_t = \sigma(\bar{i}_t)$, $\tilde{c}_t = \tanh(\bar{c}_t)$, $o_t = \sigma(\bar{o}_t)$.

**(c)** (2 points) Derive the gradient passed backward in time: $\delta h_{t-1}$ and $\delta c_{t-1}^{\text{next}}$.

**(d)** (2 points) Show that $\delta c_{t-1}^{\text{next}} = \delta c_t \odot f_t$ and explain why this is the key to solving the vanishing gradient problem. What must $f_t$ be for perfect gradient flow?

---

### Problem A4: GRU as a Special Case of Gated RNNs (8 points)

**(a)** (4 points) Define a **general gated RNN** framework with the following components:

- A memory state $m_t$
- An output state $h_t$
- A set of gate functions $g_t^{(k)}$ for $k = 1, \ldots, K$
- A candidate state function
- An update rule for $m_t$
- An output rule for $h_t$

Show that the LSTM is an instance of this framework with $K = 3$ independent gates and a separate memory/output state.

**(b)** (4 points) Show that the GRU is an instance with $K = 2$ gates and the constraint that the forget and input gate are coupled: $\alpha_t = 1 - \beta_t$ (i.e., the hidden state update is a convex combination). Explicitly write out the GRU equations in terms of the general framework and identify each component.

---

### Problem A5: Perplexity from Cross-Entropy (10 points)

**(a)** (3 points) Define cross-entropy $H(P, Q) = -\sum_x P(x) \log Q(x)$ for distributions over a finite vocabulary $\mathcal{V}$. Show that $H(P, Q) = H(P) + D_{\text{KL}}(P \| Q)$, and conclude that $H(P, Q) \geq H(P)$ with equality iff $P = Q$.

**(b)** (3 points) For a language model $P_\theta$ evaluated on a corpus $(x_1, \ldots, x_N)$, define perplexity as:
$$\text{PPL} = \exp\left(-\frac{1}{N} \sum_{t=1}^{N} \log P_\theta(x_t \mid x_{<t})\right)$$

Prove that $\text{PPL} = \left(\prod_{t=1}^{N} \frac{1}{P_\theta(x_t \mid x_{<t})}\right)^{1/N}$, i.e., perplexity is the geometric mean of the inverse predicted probabilities.

**(c)** (2 points) Prove that for a uniform model ($P_\theta(x_t \mid x_{<t}) = 1/V$ for all $t$), the perplexity equals $V$ (the vocabulary size). Interpret this result.

**(d)** (2 points) Suppose a model achieves perplexity 100 on a word-level task with vocabulary $V = 50{,}000$. Compute:

- The average cross-entropy per token (in nats and bits).
- The compression ratio compared to a uniform model (i.e., $\log_2(V) / \log_2(\text{PPL})$).
- The percentage of "uncertainty eliminated" compared to the uniform model: $1 - \log_2(\text{PPL}) / \log_2(V)$.

---

## Part B: Implementation (50%)

### General Instructions

- All implementations must use **PyTorch**.
- You may use `torch.nn.Linear`, `torch.nn.Embedding`, `torch.nn.Dropout`, basic tensor operations, and loss functions. You may **not** use `nn.RNN`, `nn.LSTM`, `nn.GRU`, `nn.RNNCell`, `nn.LSTMCell`, `nn.GRUCell`, or `nn.MultiheadAttention`.
- Include **shape annotations** as comments in your code (e.g., `# (B, T, n)`).
- All experiments must be **reproducible**: set random seeds and report them.
- Report all results in a table and include relevant plots.

---

### Problem B1: Vanilla RNN from Scratch (8 points)

Implement a vanilla RNN cell and a full RNN model.

```python
class VanillaRNNCell(nn.Module):
    """
    h_t = tanh(W_hh @ h_{t-1} + W_xh @ x_t + b)

    Requirements:
    - Use orthogonal initialization for W_hh
    - Use Xavier initialization for W_xh
    """
    def __init__(self, input_size: int, hidden_size: int):
        ...

    def forward(self, x_t: torch.Tensor, h_prev: torch.Tensor) -> torch.Tensor:
        # x_t: (B, d), h_prev: (B, n) -> h_t: (B, n)
        ...

class VanillaRNN(nn.Module):
    """
    Full RNN that processes a sequence.
    """
    def __init__(self, input_size, hidden_size, output_size, num_layers=1):
        ...

    def forward(self, x, h_0=None):
        # x: (B, T, d) -> outputs: (B, T, m), h_T: (B, n)
        ...
```

**Deliverables:**

1. Your implementation (with shape annotations on every intermediate tensor).
2. Verification: compare forward pass outputs with `torch.nn.RNN` on the same random inputs. Report the maximum absolute difference (should be < 1e-5).
3. Verification: compare gradients (use `torch.autograd.gradcheck`).

---

### Problem B2: LSTM from Scratch (8 points)

Implement an LSTM cell and full LSTM model.

```python
class LSTMCellScratch(nn.Module):
    """
    LSTM cell with all four gates.
    Use a single matrix multiply for efficiency.

    Requirements:
    - Initialize forget gate bias to 1.0
    - Support returning gate activations for visualization
    """
    def __init__(self, input_size: int, hidden_size: int):
        ...

    def forward(self, x_t, state):
        # x_t: (B, d), state: (h_{t-1}: (B,n), c_{t-1}: (B,n))
        # Returns: h_t: (B,n), (h_t, c_t), gate_dict
        ...
```

**Deliverables:**

1. Implementation with shape annotations.
2. Numerical verification against `torch.nn.LSTMCell`.
3. Ablation: train on a sequence memorization task (memorize a bit at $t=0$, recall at $t=T$) for $T \in \{20, 50, 100, 200, 500\}$. Report accuracy. Include the forget gate bias experiment: compare bias $\in \{0, 1, 2\}$.

---

### Problem B3: Character-Level Language Model (10 points)

Train a character-level language model on a text corpus.

**Dataset:** Use one of the following (or equivalent):

- Shakespeare complete works (~5MB)
- War and Peace (~3MB)
- Wikipedia excerpt (~10MB)

**Requirements:**

1. Implement data processing: character vocabulary, train/val/test split (80/10/10), batched sequence creation.
2. Train both a vanilla RNN and an LSTM language model.
3. Use the following architecture: embedding dim = 128, hidden size = 256, 2 layers, dropout = 0.2.
4. Train for at least 20 epochs with gradient clipping.

**Deliverables:**

1. Training code with proper truncated BPTT (hidden state detaching between batches).
2. Table of validation perplexity for both models at the end of training.
3. Learning curves: train and validation loss per epoch for both models.
4. Generated text samples (500 characters each) from the trained LSTM using:
   - Greedy decoding
   - Temperature sampling ($\tau = 0.5, 1.0, 1.5$)
   - Top-k sampling ($k = 10, 50$)
   - Top-p sampling ($p = 0.9$)
5. Qualitative comparison of generated samples.

---

### Problem B4: Word-Level Language Model on Penn Treebank (8 points)

**Dataset:** Penn Treebank (PTB). Use the standard preprocessing from Mikolov et al. (2010):

- Vocabulary of ~10,000 words
- Standard train/val/test split

**Requirements:**

1. Implement a word-level LSTM language model with:
   - Embedding dim = 200, hidden size = 200, 2 layers
   - Weight tying (output projection shares weights with embedding)
   - Dropout = 0.5
2. Train with SGD, learning rate = 20, gradient clip = 0.25.
3. Implement learning rate annealing: divide LR by 4 when validation perplexity does not improve.

**Deliverables:**

1. Final test perplexity (target: below 90 for full credit, below 85 for bonus).
2. Learning curves.
3. Comparison with and without weight tying.
4. Comparison with and without gradient clipping (report what happens without clipping).

---

### Problem B5: Bahdanau Attention for Seq2Seq (10 points)

Implement a seq2seq model with Bahdanau attention for a simple translation task.

**Dataset:** Use a small parallel corpus. Options:

- Multi30k English-German (recommended, ~30k sentence pairs)
- Tatoeba sentence pairs
- Or a synthetic reversal task: reverse a sequence of random integers (for debugging)

**Requirements:**

1. Implement from scratch:
   - Bidirectional LSTM encoder
   - Bahdanau (additive) attention mechanism
   - LSTM decoder with attention
   - Beam search with length normalization
2. Architecture: embed dim = 256, hidden size = 512, 2 encoder layers, 1 decoder layer, attention dim = 128.

**Deliverables:**

1. Implementation with shape annotations on all tensors.
2. First, verify on the synthetic reversal task (should achieve >99% accuracy).
3. Train on the real translation task. Report BLEU score on the test set.
4. **Attention visualization**: for at least 5 test examples, plot the attention weight matrix as a heatmap with source and target tokens labeled.
5. Analysis: for each visualized example, describe what the attention pattern reveals about the alignment between source and target.

---

### Problem B6: Gradient Dynamics Comparison (6 points)

Compare the training dynamics of vanilla RNN vs LSTM by monitoring gradient norms.

**Task:** Train both architectures on the character-level language model from B3.

**Requirements:**

1. At every training step, compute and log:
   - $\|{\partial \mathcal{L}}/{\partial W_{hh}}\|_2$ (recurrent weight gradient norm)
   - The maximum absolute gradient across all parameters
   - The training loss
2. Record these for at least 1000 training steps.

**Deliverables:**

1. Plot: gradient norm vs. training step for both vanilla RNN and LSTM (same plot, different colors).
2. Plot: maximum absolute gradient vs. training step.
3. Histogram: distribution of gradient norms across all parameters for both models (at the end of training).
4. Written analysis (200-400 words):
   - Describe the observed differences in gradient behavior.
   - Relate your observations to the theoretical analysis from Part A.
   - Explain how gradient clipping affects the dynamics (show with and without clipping for the vanilla RNN).

---

## Grading Rubric

### Part A (50 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| A1 | 12 | Correct derivation, explicit Jacobian, intermediate steps |
| A2 | 10 | Rigorous bounds, correct spectral radius argument |
| A3 | 10 | Complete backward pass, correct gradient expressions |
| A4 | 8 | Clear general framework, correct specializations |
| A5 | 10 | Correct proofs, numerical examples |

### Part B (50 points total)

| Problem | Points | Criteria |
|---------|--------|----------|
| B1 | 8 | Correct implementation, numerical verification |
| B2 | 8 | Correct LSTM, forget gate ablation |
| B3 | 10 | Working LM, perplexity, generated samples |
| B4 | 8 | PTB perplexity, ablations |
| B5 | 10 | Working attention, beam search, visualizations |
| B6 | 6 | Gradient plots, analysis |

### Bonus (up to 5 points)

- B4: Test perplexity below 85 (+2 points)
- B5: Implement Luong attention and compare with Bahdanau (+2 points)
- B6: Implement and visualize gradient flow through the LSTM cell state vs. hidden state separately (+1 point)

---

## Tips and Common Mistakes

1. **Forget gate bias**: Initialize to 1.0. This is the single most important implementation detail for LSTMs.

2. **Gradient clipping**: Always clip after `.backward()` and before `.step()`. Use `torch.nn.utils.clip_grad_norm_` with a reasonable threshold (e.g., 1.0 for character LM, 0.25 for PTB).

3. **Hidden state detaching**: When using truncated BPTT, you **must** call `.detach()` on the hidden states between batches. Failing to do so will cause memory to grow without bound.

4. **Packed sequences**: When using variable-length sequences, use `pack_padded_sequence` and `pad_packed_sequence`. Make sure to sort by length (or set `enforce_sorted=False`).

5. **Teacher forcing**: During training, always feed the ground-truth previous token to the decoder (not the model's own prediction). This is standard for seq2seq training.

6. **Perplexity computation**: Use the **sum** of cross-entropy losses divided by the **total number of tokens**, then exponentiate. Do not average per-batch losses (this gives incorrect perplexity if batches have different lengths).

7. **Numerical stability**: Use `F.cross_entropy` (which combines `log_softmax` and `nll_loss`) rather than computing softmax and log separately. This avoids numerical issues.

8. **Beam search debugging**: First verify that greedy decoding (beam width = 1) produces reasonable outputs before trying larger beam widths.

---

## Submission Checklist

- [ ] `derivations.pdf`: Solutions to Part A (A1-A5), typeset or clearly handwritten.
- [ ] `rnn.py`: VanillaRNNCell and VanillaRNN implementations (B1).
- [ ] `lstm.py`: LSTMCellScratch implementation (B2).
- [ ] `char_lm.py`: Character-level language model training script (B3).
- [ ] `word_lm.py`: Word-level language model on PTB (B4).
- [ ] `seq2seq.py`: Seq2seq with attention implementation (B5).
- [ ] `gradient_analysis.py`: Gradient dynamics comparison (B6).
- [ ] `results/`: Directory containing all plots, generated text samples, and attention visualizations.
- [ ] `report.pdf`: Tables of results, plots, and written analysis.
- [ ] `requirements.txt`: Python dependencies.
- [ ] `README.md`: Instructions to reproduce your results.
