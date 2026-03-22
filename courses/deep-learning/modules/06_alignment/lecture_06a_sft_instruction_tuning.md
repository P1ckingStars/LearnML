# Lecture 06a: Supervised Fine-Tuning and Instruction Tuning

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formalize** supervised fine-tuning (SFT) as conditional language modeling: maximizing $P(\text{response} \mid \text{instruction})$.
2. **Describe** data formats for instruction tuning including instruction-response pairs and chat templates.
3. **Implement** key training details: sequence packing, loss masking on prompt tokens, and learning rate schedules for SFT.
4. **Analyze** the data quality vs. quantity trade-off, citing the LIMA result that 1,000 carefully curated examples can match larger datasets.
5. **Identify** catastrophic forgetting as a core failure mode of fine-tuning and describe mitigation strategies.
6. **Explain** multi-task instruction tuning as exemplified by FLAN and T0.

---

## 2. Motivation and Context

### 2.1 The Alignment Gap

A pretrained language model (LM) has learned a distribution over text from a massive corpus. It can complete sentences, generate plausible continuations, and encode linguistic knowledge. However, it does not reliably **follow instructions**. When a user asks "Summarize this article," a raw pretrained model may instead continue the text as if it were part of an article, or ask a follow-up question, or produce any continuation consistent with its training distribution.

The core issue is that next-token prediction on internet text does not directly optimize for **helpfulness**, **safety**, or **instruction-following**. Supervised fine-tuning bridges this gap by adjusting the model's distribution to favor helpful responses conditioned on user instructions.

### 2.2 Historical Context

The modern SFT pipeline emerged from several threads:

- **Transfer learning** (Howard & Ruder, 2018): pretrain on large data, fine-tune on task-specific data.
- **GPT-2/GPT-3** (Radford et al., 2019; Brown et al., 2020): showed that scaling pretrained LMs yields strong few-shot performance, but zero-shot instruction following remained weak.
- **InstructGPT** (Ouyang et al., 2022): demonstrated that SFT on human-written demonstrations dramatically improves instruction following, even on a 1.3B parameter model.
- **FLAN** (Wei et al., 2022): showed that multi-task instruction tuning on diverse NLP tasks generalizes to unseen tasks.

### 2.3 Where SFT Fits in the Alignment Pipeline

The standard alignment pipeline is:

$$\text{Pretrained LM} \xrightarrow{\text{SFT}} \text{SFT Model} \xrightarrow{\text{RLHF/DPO}} \text{Aligned Model}$$

SFT is the first alignment stage. It is necessary but often insufficient --- the model learns the **format** of helpful responses but may not consistently produce the **best** responses. Reinforcement learning from human feedback (RLHF) or direct preference optimization (DPO) further refines the model based on comparative judgments (Lecture 06c, 06d).

---

## 3. Core Theory

### 3.1 SFT as Conditional Language Modeling

Let $\mathbf{x} = (x_1, x_2, \ldots, x_m)$ be an instruction (prompt) and $\mathbf{y} = (y_1, y_2, \ldots, y_n)$ be the corresponding response. An autoregressive language model with parameters $\theta$ defines:

$$P_\theta(\mathbf{y} \mid \mathbf{x}) = \prod_{t=1}^{n} P_\theta(y_t \mid \mathbf{x}, y_1, \ldots, y_{t-1})$$

Given a dataset of instruction-response pairs $\mathcal{D} = \{(\mathbf{x}^{(i)}, \mathbf{y}^{(i)})\}_{i=1}^{N}$, the SFT objective maximizes the conditional log-likelihood:

$$\mathcal{L}_{\text{SFT}}(\theta) = \sum_{i=1}^{N} \sum_{t=1}^{n_i} \log P_\theta\!\left(y_t^{(i)} \mid \mathbf{x}^{(i)}, y_1^{(i)}, \ldots, y_{t-1}^{(i)}\right)$$

Equivalently, we minimize the negative log-likelihood (NLL) loss:

$$\mathcal{L}_{\text{NLL}}(\theta) = -\frac{1}{\sum_{i} n_i} \sum_{i=1}^{N} \sum_{t=1}^{n_i} \log P_\theta\!\left(y_t^{(i)} \mid \mathbf{x}^{(i)}, y_1^{(i)}, \ldots, y_{t-1}^{(i)}\right)$$

**Key distinction from pretraining.** During pretraining, the loss is computed over **all** tokens in the sequence. During SFT, the loss is computed **only** over the response tokens $y_t$. The instruction tokens $x_j$ contribute to the context (they are processed by the model) but do not contribute to the gradient signal. This is called **loss masking**.

### 3.2 Why Loss Masking Matters

Consider the full sequence $\mathbf{s} = (\mathbf{x}, \mathbf{y}) = (x_1, \ldots, x_m, y_1, \ldots, y_n)$. The standard language modeling loss over the full sequence would be:

$$\mathcal{L}_{\text{full}}(\theta) = -\sum_{j=1}^{m} \log P_\theta(x_j \mid x_{<j}) - \sum_{t=1}^{n} \log P_\theta(y_t \mid \mathbf{x}, y_{<t})$$

The first sum encourages the model to predict the **instruction** tokens, which is unnecessary and potentially harmful --- it pushes the model toward generating instructions rather than responses. With loss masking, we define a binary mask $\mathbf{M}$:

$$M_k = \begin{cases} 0 & \text{if position } k \text{ corresponds to an instruction token} \\ 1 & \text{if position } k \text{ corresponds to a response token} \end{cases}$$

The masked loss becomes:

$$\mathcal{L}_{\text{masked}}(\theta) = -\sum_{k=1}^{m+n} M_k \log P_\theta(s_k \mid s_{<k})$$

**Proposition 3.1.** *Loss masking is equivalent to treating the instruction as a fixed conditioning context. The gradient $\nabla_\theta \mathcal{L}_{\text{masked}}$ updates the model only based on its ability to predict response tokens, not instruction tokens.*

*Proof.* By the chain rule of differentiation, $\nabla_\theta \mathcal{L}_{\text{masked}} = -\sum_{k} M_k \nabla_\theta \log P_\theta(s_k \mid s_{<k})$. Since $M_k = 0$ for instruction positions, no gradient flows from instruction token predictions. The instruction tokens still influence the hidden states through the forward pass (they determine the context for response prediction), but the parameters are not directly adjusted to predict them. $\blacksquare$

### 3.3 Data Formats and Chat Templates

Modern instruction tuning uses structured formats to delimit the roles of different parts of the input.

**Simple instruction-response format:**

```
### Instruction:
{instruction text}

### Response:
{response text}
```

**Chat template format (multi-turn):**

```
<|system|>
{system prompt}
<|user|>
{user message 1}
<|assistant|>
{assistant response 1}
<|user|>
{user message 2}
<|assistant|>
{assistant response 2}
```

Each model family uses its own special tokens. For example, Llama 2 uses `[INST]` and `[/INST]`, while ChatML uses `<|im_start|>` and `<|im_end|>`. The tokenizer must be aware of these special tokens so they are treated as single tokens rather than split into subwords.

**Multi-turn loss masking.** In a multi-turn conversation, the loss mask is set to 1 only for assistant response tokens:

$$M_k = \begin{cases} 1 & \text{if position } k \text{ is within an } \texttt{<|assistant|>} \text{ turn} \\ 0 & \text{otherwise} \end{cases}$$

### 3.4 Sequence Packing

Individual instruction-response pairs vary in length. Naive batching pads all sequences to the longest in the batch, wasting computation on padding tokens.

**Packing** concatenates multiple examples into a single sequence of the maximum context length $L$:

$$\text{Packed sequence} = [\mathbf{x}^{(1)}, \mathbf{y}^{(1)}, \texttt{<eos>}, \mathbf{x}^{(2)}, \mathbf{y}^{(2)}, \texttt{<eos>}, \ldots]$$

**Attention masking for packing.** To prevent cross-contamination between packed examples, we modify the causal attention mask. Let $A \in \{0,1\}^{L \times L}$ be the attention mask. For standard causal attention:

$$A_{ij} = \begin{cases} 1 & \text{if } j \le i \\ 0 & \text{otherwise} \end{cases}$$

For packed sequences, we additionally block attention across example boundaries:

$$A_{ij} = \begin{cases} 1 & \text{if } j \le i \text{ and } \text{example}(i) = \text{example}(j) \\ 0 & \text{otherwise} \end{cases}$$

This is sometimes called **document masking** or **sample-level causal masking**.

**Proposition 3.2 (Packing efficiency).** *If example lengths $\ell_i$ are drawn i.i.d. from a distribution with mean $\mu$ and the packing length is $L$, then the expected packing efficiency (fraction of non-padding tokens) approaches $1 - O(\mu / L)$ as the number of examples grows.*

*Sketch.* This is an instance of the bin-packing problem. A first-fit-decreasing heuristic achieves near-optimal packing. With $L \gg \mu$, each packed sequence contains $\approx L/\mu$ examples, and the wasted space in the last slot averages $\mu/2$, giving efficiency $\approx 1 - \mu/(2L)$. $\blacksquare$

### 3.5 Data Quality vs. Quantity: The LIMA Principle

**Theorem (Informal, Zhou et al., 2023).** *A pretrained LLM already encodes the vast majority of knowledge and capabilities needed for instruction following. SFT primarily teaches the model the **style and format** of desired outputs, not new knowledge. Consequently, a small number of high-quality, diverse examples can be as effective as orders of magnitude more low-quality data.*

The LIMA paper demonstrated this empirically: a 65B LLaMA model fine-tuned on just 1,000 carefully curated instruction-response pairs produced outputs comparable to GPT-4 in human evaluations on many tasks.

**Implications for data curation:**

1. **Diversity** matters more than volume: cover many distinct task types.
2. **Quality** of responses matters enormously: well-written, thorough, accurate.
3. **Consistency** of style and formatting reduces the model's uncertainty about desired outputs.

**Formal perspective.** Let $\mathcal{D}_{\text{high}}$ be a small dataset of high-quality pairs and $\mathcal{D}_{\text{low}}$ be a large dataset of mixed quality. Define the response quality as $Q(\mathbf{y} \mid \mathbf{x})$. If the model learns the conditional distribution of $\mathbf{y} \mid \mathbf{x}$ from the data, then:

$$\mathbb{E}_{\mathbf{y} \sim P_{\theta_{\text{high}}}}[Q(\mathbf{y} \mid \mathbf{x})] \ge \mathbb{E}_{\mathbf{y} \sim P_{\theta_{\text{low}}}}[Q(\mathbf{y} \mid \mathbf{x})]$$

because the expected quality of a sample from the learned distribution tracks the average quality in the training distribution, not its size.

### 3.6 Catastrophic Forgetting

**Definition 3.3 (Catastrophic forgetting).** Let $\theta_0$ be the pretrained parameters and $\theta_{\text{SFT}}$ the parameters after fine-tuning on $\mathcal{D}$. Catastrophic forgetting occurs when there exist tasks $\mathcal{T}$ not in $\mathcal{D}$ for which:

$$\text{Perf}(\theta_{\text{SFT}}, \mathcal{T}) \ll \text{Perf}(\theta_0, \mathcal{T})$$

That is, fine-tuning on $\mathcal{D}$ degrades performance on tasks outside of $\mathcal{D}$.

**Theoretical perspective.** Fine-tuning minimizes $\mathcal{L}_{\text{SFT}}(\theta)$ starting from $\theta_0$. The loss landscape has a basin around $\theta_0$ that encodes pretrained knowledge. If SFT moves $\theta$ too far from $\theta_0$, pretrained capabilities are lost:

$$\|\theta_{\text{SFT}} - \theta_0\|_2 > R_{\text{basin}} \implies \text{pretrained knowledge is degraded}$$

**Mitigation strategies:**

1. **Low learning rate.** Use $\eta_{\text{SFT}} \ll \eta_{\text{pretrain}}$. Typical: $\eta_{\text{SFT}} \approx 1\text{e-}5$ to $5\text{e-}5$ versus $\eta_{\text{pretrain}} \approx 1\text{e-}4$ to $3\text{e-}4$.

2. **Weight decay / L2 regularization toward $\theta_0$.** Add a penalty $\lambda \|\theta - \theta_0\|_2^2$ to the loss:
   $$\mathcal{L}_{\text{reg}}(\theta) = \mathcal{L}_{\text{SFT}}(\theta) + \frac{\lambda}{2}\|\theta - \theta_0\|_2^2$$
   This is equivalent to Elastic Weight Consolidation (Kirkpatrick et al., 2017) with uniform Fisher information.

3. **Parameter-efficient fine-tuning (PEFT).** Only update a small subset of parameters (LoRA, adapters), keeping most of $\theta_0$ frozen. See Recitation 06.

4. **Data mixing.** Include a fraction of pretraining data in the SFT dataset:
   $$\mathcal{L}_{\text{mixed}}(\theta) = (1 - \alpha)\,\mathcal{L}_{\text{SFT}}(\theta) + \alpha\,\mathcal{L}_{\text{pretrain}}(\theta)$$
   with $\alpha \approx 0.01$ to $0.1$.

### 3.7 Multi-Task Instruction Tuning

**FLAN (Fine-tuned LAnguage Net, Wei et al., 2022)** and **T0 (Sanh et al., 2022)** demonstrated that fine-tuning on a **diverse mixture of NLP tasks** phrased as instructions improves zero-shot generalization to held-out tasks.

**Formalization.** Let $\{\mathcal{T}_k\}_{k=1}^{K}$ be a collection of tasks, each with a set of instruction templates $\{\tau_k^{(j)}\}$ and datasets $\mathcal{D}_k$. Multi-task instruction tuning optimizes:

$$\mathcal{L}_{\text{multi}}(\theta) = \sum_{k=1}^{K} w_k \sum_{(\mathbf{x}, \mathbf{y}) \in \mathcal{D}_k} \sum_{t=1}^{|\mathbf{y}|} \log P_\theta(y_t \mid \mathbf{x}, y_{<t})$$

where $w_k$ are task weights (often chosen proportional to dataset size with temperature-based sampling to prevent large datasets from dominating).

**Key findings from FLAN:**

- Training on 62 NLP datasets across 12 task categories improved zero-shot performance on held-out tasks by an average of 25% (absolute) over the base model.
- The benefit of instruction tuning **scales with model size**: larger models benefit more from instruction tuning.
- **Task diversity** matters: ablating task categories shows that more diverse mixtures yield better generalization.

---

## 4. Algorithmic Derivation

### 4.1 SFT Training Algorithm

```
Algorithm: SupervisedFineTuning
─────────────────────────────────────────────────────────
Input:  pretrained_model with parameters θ_0
        dataset D = {(x^(i), y^(i))}_{i=1}^{N}
        learning_rate η, num_epochs E, batch_size B
        max_seq_length L
Output: fine-tuned parameters θ_SFT

1. θ ← θ_0                           // Initialize from pretrained

2. Pack dataset:
   packed_sequences ← []
   buffer ← []
   for (x, y) in D:
     example ← TOKENIZE(x) + TOKENIZE(y) + [EOS]
     if len(buffer) + len(example) > L:
       packed_sequences.append(buffer)
       buffer ← example
     else:
       buffer ← buffer + example
   packed_sequences.append(buffer)    // Flush remaining

3. for epoch = 1 to E:
     SHUFFLE(packed_sequences)
     for batch in BATCHES(packed_sequences, B):
       // batch: (B, L) token ids
       // mask:  (B, L) binary, 1 = response token
       // attn:  (B, L, L) block-causal attention mask

       a. Forward pass:
          logits ← MODEL(batch, attention_mask=attn)
          // logits shape: (B, L, V) where V = vocab size

       b. Compute masked loss:
          shift_logits ← logits[:, :-1, :]      // (B, L-1, V)
          shift_labels ← batch[:, 1:]            // (B, L-1)
          shift_mask ← mask[:, 1:]               // (B, L-1)

          per_token_loss ← CROSS_ENTROPY(shift_logits, shift_labels)
          // per_token_loss shape: (B, L-1)

          loss ← SUM(per_token_loss * shift_mask) / SUM(shift_mask)

       c. Backward pass:
          ZERO_GRAD(θ)
          BACKWARD(loss)
          CLIP_GRAD_NORM(θ, max_norm=1.0)
          UPDATE(θ, η)

4. Return θ
```

**Complexity Analysis:**

- Let $V$ = vocabulary size, $d$ = model dimension, $L$ = sequence length, $H$ = number of heads, $N_L$ = number of layers.
- **Forward pass:** $O(N_L \cdot (L^2 \cdot d + L \cdot d^2))$ for self-attention + FFN.
- **Loss computation:** $O(B \cdot L \cdot V)$ for the cross-entropy over vocabulary.
- **Backward pass:** Same asymptotic complexity as forward ($\approx 2\times$ in practice).
- **Per-epoch:** $O(N / (B \cdot L / \mu) \cdot N_L \cdot (L^2 d + L d^2))$ where $\mu$ is the mean example length.
- **Packing speedup:** $\approx L / (\mu + \text{pad})$ fewer forward passes compared to naive padding.

### 4.2 Data Mixing Algorithm for Forgetting Mitigation

```
Algorithm: MixedSFTTraining
─────────────────────────────────────────────────────────
Input:  SFT dataset D_sft, pretraining corpus D_pretrain
        mixing_ratio α ∈ (0, 1)    // fraction of pretrain data
Output: fine-tuned parameters θ

1. For each training step:
   a. With probability (1 - α):
      sample batch from D_sft
      compute L_sft with loss masking
   b. With probability α:
      sample batch from D_pretrain
      compute L_pretrain (standard LM loss, no masking)
   c. loss ← (whichever was computed)
   d. Update θ via optimizer
```

---

## 5. PyTorch Implementation

```python
"""
Supervised Fine-Tuning (SFT) with loss masking, packing, and
block-causal attention.

Requires: torch >= 2.0, transformers >= 4.30
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from typing import List, Tuple, Dict, Optional
import copy

# ── Data Format and Tokenization ─────────────────────────────────────

def format_instruction_response(
    instruction: str,
    response: str,
    system_prompt: str = "You are a helpful assistant."
) -> str:
    """
    Format an instruction-response pair using a simple chat template.

    Args:
        instruction: the user instruction           (str)
        response:    the desired assistant response  (str)
        system_prompt: system-level instruction      (str)

    Returns:
        formatted: the full formatted string         (str)
    """
    return (
        f"<|system|>\n{system_prompt}\n"
        f"<|user|>\n{instruction}\n"
        f"<|assistant|>\n{response}<|eos|>"
    )

def tokenize_with_mask(
    tokenizer,
    instruction: str,
    response: str,
    max_length: int = 512
) -> Dict[str, torch.Tensor]:
    """
    Tokenize an instruction-response pair and create a loss mask
    that is 1 only for response tokens.

    Args:
        tokenizer:  HuggingFace tokenizer
        instruction: user instruction                (str)
        response:    assistant response              (str)
        max_length:  maximum sequence length          (int)

    Returns:
        dict with keys:
            'input_ids':  (max_length,)  token ids
            'labels':     (max_length,)  same as input_ids but -100 for masked positions
            'loss_mask':  (max_length,)  binary mask, 1 for response tokens
    """
    # Tokenize instruction and response separately to find the boundary
    prompt = f"<|system|>\nYou are a helpful assistant.\n<|user|>\n{instruction}\n<|assistant|>\n"
    prompt_ids = tokenizer.encode(prompt, add_special_tokens=False)
    response_ids = tokenizer.encode(response, add_special_tokens=False)
    eos_id = tokenizer.eos_token_id

    # Concatenate: [prompt_ids, response_ids, eos]
    input_ids = prompt_ids + response_ids + [eos_id]   # (seq_len,)

    # Truncate if necessary
    if len(input_ids) > max_length:
        input_ids = input_ids[:max_length]

    # Create loss mask: 0 for prompt tokens, 1 for response + eos tokens
    prompt_len = len(prompt_ids)
    loss_mask = [0] * min(prompt_len, len(input_ids))
    loss_mask += [1] * (len(input_ids) - len(loss_mask))   # (seq_len,)

    # Pad to max_length
    pad_len = max_length - len(input_ids)
    input_ids = input_ids + [tokenizer.pad_token_id] * pad_len
    loss_mask = loss_mask + [0] * pad_len

    # Labels: same as input_ids but with -100 where loss_mask == 0
    labels = [
        tok if m == 1 else -100
        for tok, m in zip(input_ids, loss_mask)
    ]

    return {
        'input_ids': torch.tensor(input_ids, dtype=torch.long),    # (max_length,)
        'labels': torch.tensor(labels, dtype=torch.long),          # (max_length,)
        'loss_mask': torch.tensor(loss_mask, dtype=torch.float32), # (max_length,)
    }

# ── Sequence Packing ─────────────────────────────────────────────────

def pack_sequences(
    examples: List[Dict[str, torch.Tensor]],
    max_length: int = 2048
) -> List[Dict[str, torch.Tensor]]:
    """
    Pack multiple short examples into single sequences of max_length.
    Returns packed examples with document_ids for attention masking.

    Args:
        examples: list of dicts with 'input_ids', 'labels', 'loss_mask'
                  each tensor has shape (example_len,) (variable)
        max_length: packing target length                        (int)

    Returns:
        packed: list of dicts with:
            'input_ids':    (max_length,)
            'labels':       (max_length,)
            'loss_mask':    (max_length,)
            'document_ids': (max_length,)  int, which example each token belongs to
    """
    packed = []
    current_ids, current_labels, current_mask, current_doc_ids = [], [], [], []
    doc_id = 0

    for ex in examples:
        ids = ex['input_ids']
        labs = ex['labels']
        msk = ex['loss_mask']

        # Remove padding from individual examples
        non_pad = (ids != 0).sum().item()  # assuming pad_token_id = 0
        ids = ids[:non_pad]                # (non_pad,)
        labs = labs[:non_pad]              # (non_pad,)
        msk = msk[:non_pad]               # (non_pad,)

        if len(current_ids) + len(ids) > max_length:
            # Flush current buffer
            pad_len = max_length - len(current_ids)
            current_ids.extend([0] * pad_len)
            current_labels.extend([-100] * pad_len)
            current_mask.extend([0] * pad_len)
            current_doc_ids.extend([-1] * pad_len)  # -1 = padding

            packed.append({
                'input_ids': torch.tensor(current_ids, dtype=torch.long),
                'labels': torch.tensor(current_labels, dtype=torch.long),
                'loss_mask': torch.tensor(current_mask, dtype=torch.float32),
                'document_ids': torch.tensor(current_doc_ids, dtype=torch.long),
            })
            current_ids, current_labels, current_mask, current_doc_ids = [], [], [], []
            doc_id = 0

        current_ids.extend(ids.tolist())
        current_labels.extend(labs.tolist())
        current_mask.extend(msk.tolist())
        current_doc_ids.extend([doc_id] * len(ids))
        doc_id += 1

    # Flush remaining
    if current_ids:
        pad_len = max_length - len(current_ids)
        current_ids.extend([0] * pad_len)
        current_labels.extend([-100] * pad_len)
        current_mask.extend([0] * pad_len)
        current_doc_ids.extend([-1] * pad_len)
        packed.append({
            'input_ids': torch.tensor(current_ids, dtype=torch.long),
            'labels': torch.tensor(current_labels, dtype=torch.long),
            'loss_mask': torch.tensor(current_mask, dtype=torch.float32),
            'document_ids': torch.tensor(current_doc_ids, dtype=torch.long),
        })

    return packed

# ── Block-Causal Attention Mask ──────────────────────────────────────

def create_block_causal_mask(
    document_ids: torch.Tensor
) -> torch.Tensor:
    """
    Create a block-causal attention mask for packed sequences.
    Token i can attend to token j iff:
      (1) j <= i  (causal)
      (2) document_ids[i] == document_ids[j]  (same document)
      (3) document_ids[j] != -1  (not padding)

    Args:
        document_ids: (seq_len,) integer tensor

    Returns:
        mask: (seq_len, seq_len) boolean tensor, True = can attend
    """
    seq_len = document_ids.shape[0]

    # Causal mask: (seq_len, seq_len)
    causal = torch.tril(torch.ones(seq_len, seq_len, dtype=torch.bool))

    # Same-document mask: (seq_len, seq_len)
    same_doc = document_ids.unsqueeze(0) == document_ids.unsqueeze(1)
    # same_doc[i, j] = True if document_ids[i] == document_ids[j]

    # Not padding mask
    not_pad = (document_ids != -1).unsqueeze(0).expand(seq_len, -1)
    # not_pad[i, j] = True if document_ids[j] != -1

    mask = causal & same_doc & not_pad    # (seq_len, seq_len)
    return mask

# ── SFT Training Loop ────────────────────────────────────────────────

def sft_loss(
    logits: torch.Tensor,
    labels: torch.Tensor,
    loss_mask: torch.Tensor
) -> torch.Tensor:
    """
    Compute cross-entropy loss with masking (only on response tokens).

    Args:
        logits:    (B, L, V)  model output logits
        labels:    (B, L)     target token ids (-100 for masked)
        loss_mask: (B, L)     binary mask, 1 = compute loss

    Returns:
        loss: scalar, mean loss over unmasked tokens
    """
    B, L, V = logits.shape

    # Shift for autoregressive prediction
    shift_logits = logits[:, :-1, :].contiguous()   # (B, L-1, V)
    shift_labels = labels[:, 1:].contiguous()       # (B, L-1)
    shift_mask = loss_mask[:, 1:].contiguous()      # (B, L-1)

    # Flatten
    shift_logits = shift_logits.view(-1, V)         # (B*(L-1), V)
    shift_labels = shift_labels.view(-1)            # (B*(L-1),)
    shift_mask = shift_mask.view(-1)                # (B*(L-1),)

    # Cross-entropy per token (no reduction)
    per_token_loss = F.cross_entropy(
        shift_logits, shift_labels, reduction='none'
    )                                                # (B*(L-1),)

    # Mask out non-response tokens and average
    masked_loss = per_token_loss * shift_mask        # (B*(L-1),)
    num_tokens = shift_mask.sum()                    # scalar

    if num_tokens == 0:
        return torch.tensor(0.0, device=logits.device)

    loss = masked_loss.sum() / num_tokens            # scalar
    return loss

def train_sft(
    model: nn.Module,
    train_data: List[Dict[str, torch.Tensor]],
    num_epochs: int = 3,
    lr: float = 2e-5,
    max_grad_norm: float = 1.0,
    warmup_steps: int = 100,
    weight_decay: float = 0.01,
    device: str = 'cuda',
) -> List[float]:
    """
    Full SFT training loop with cosine learning rate schedule.

    Args:
        model:         nn.Module, the language model
        train_data:    list of packed example dicts
        num_epochs:    number of training epochs            (int)
        lr:            peak learning rate                   (float)
        max_grad_norm: gradient clipping threshold          (float)
        warmup_steps:  number of warmup steps               (int)
        weight_decay:  AdamW weight decay                   (float)
        device:        'cuda' or 'cpu'                      (str)

    Returns:
        losses: list of per-step loss values                (list[float])
    """
    import math

    model = model.to(device)
    model.train()

    # AdamW optimizer (standard for LLM fine-tuning)
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=lr, weight_decay=weight_decay,
        betas=(0.9, 0.95)
    )

    total_steps = num_epochs * len(train_data)
    losses = []

    for epoch in range(num_epochs):
        for step_in_epoch, batch in enumerate(train_data):
            global_step = epoch * len(train_data) + step_in_epoch

            # ── Learning rate schedule: linear warmup + cosine decay ──
            if global_step < warmup_steps:
                lr_scale = global_step / warmup_steps
            else:
                progress = (global_step - warmup_steps) / max(
                    1, total_steps - warmup_steps
                )
                lr_scale = 0.5 * (1 + math.cos(math.pi * progress))

            for pg in optimizer.param_groups:
                pg['lr'] = lr * lr_scale

            # ── Move batch to device ──
            input_ids = batch['input_ids'].unsqueeze(0).to(device)  # (1, L)
            labels = batch['labels'].unsqueeze(0).to(device)        # (1, L)
            loss_mask_t = batch['loss_mask'].unsqueeze(0).to(device) # (1, L)

            # ── Forward pass ──
            logits = model(input_ids)                                # (1, L, V)

            # ── Compute masked loss ──
            loss = sft_loss(logits, labels, loss_mask_t)             # scalar

            # ── Backward pass ──
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            optimizer.step()

            losses.append(loss.item())

    return losses

# ── Minimal GPT for demonstration ────────────────────────────────────

class MiniGPT(nn.Module):
    """
    Minimal GPT-style model for demonstrating SFT.
    NOT intended for real use --- just for illustrating the training pipeline.

    Args:
        vocab_size:  size of vocabulary                (int)
        d_model:     model dimension                   (int)
        n_heads:     number of attention heads          (int)
        n_layers:    number of transformer layers       (int)
        max_seq_len: maximum sequence length            (int)
    """
    def __init__(
        self,
        vocab_size: int = 32000,
        d_model: int = 256,
        n_heads: int = 4,
        n_layers: int = 4,
        max_seq_len: int = 512,
    ):
        super().__init__()
        self.tok_emb = nn.Embedding(vocab_size, d_model)
        # tok_emb.weight shape: (vocab_size, d_model)
        self.pos_emb = nn.Embedding(max_seq_len, d_model)
        # pos_emb.weight shape: (max_seq_len, d_model)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=4 * d_model,
            dropout=0.1,
            activation='gelu',
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer, num_layers=n_layers
        )
        self.ln_f = nn.LayerNorm(d_model)
        self.head = nn.Linear(d_model, vocab_size, bias=False)
        # head.weight shape: (vocab_size, d_model)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None
    ) -> torch.Tensor:
        """
        Args:
            input_ids:      (B, L) token ids
            attention_mask: (L, L) causal mask (optional)

        Returns:
            logits: (B, L, vocab_size)
        """
        B, L = input_ids.shape
        positions = torch.arange(L, device=input_ids.device)  # (L,)

        x = self.tok_emb(input_ids) + self.pos_emb(positions)  # (B, L, d_model)

        # Create causal mask if not provided
        if attention_mask is None:
            attention_mask = torch.triu(
                torch.full((L, L), float('-inf'), device=input_ids.device),
                diagonal=1
            )                                                   # (L, L)

        x = self.transformer(x, mask=attention_mask)            # (B, L, d_model)
        x = self.ln_f(x)                                       # (B, L, d_model)
        logits = self.head(x)                                   # (B, L, vocab_size)

        return logits

# ── Demo: end-to-end SFT on toy data ─────────────────────────────────

def demo_sft():
    """
    Demonstrate the SFT pipeline on synthetic instruction-response data.
    This is a toy example --- real SFT uses pretrained models and real data.
    """
    # Create synthetic dataset
    instructions = [
        "What is 2 + 2?",
        "Write a haiku about mountains.",
        "Explain gravity in one sentence.",
        "Translate 'hello' to French.",
        "What is the capital of Japan?",
    ]
    responses = [
        "2 + 2 = 4.",
        "Peaks touch the gray sky\nSilent snow crowns ancient stone\nWinds carry the mist",
        "Gravity is the force by which objects with mass attract one another.",
        "The French word for 'hello' is 'bonjour'.",
        "The capital of Japan is Tokyo.",
    ]

    print("=== SFT Training Demo ===")
    print(f"Number of training examples: {len(instructions)}")

    # Initialize model
    model = MiniGPT(vocab_size=1000, d_model=128, n_heads=4, n_layers=2,
                    max_seq_len=128)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Model parameters: {total_params:,}")

    # Create dummy tokenized data (in practice, use a real tokenizer)
    train_data = []
    for inst, resp in zip(instructions, responses):
        prompt_len = 20  # pretend the prompt is 20 tokens
        resp_len = 15    # pretend the response is 15 tokens
        total_len = prompt_len + resp_len

        input_ids = torch.randint(1, 1000, (128,))  # (128,)
        labels = input_ids.clone()                    # (128,)
        loss_mask = torch.zeros(128)                  # (128,)
        loss_mask[prompt_len:total_len] = 1.0         # mask only response

        labels[loss_mask == 0] = -100                 # ignore prompt in loss

        train_data.append({
            'input_ids': input_ids,
            'labels': labels,
            'loss_mask': loss_mask,
        })

    # Train
    losses = train_sft(
        model, train_data, num_epochs=5, lr=1e-3, device='cpu'
    )

    print(f"Initial loss: {losses[0]:.4f}")
    print(f"Final loss:   {losses[-1]:.4f}")
    print(f"Loss reduction: {(1 - losses[-1]/losses[0])*100:.1f}%")

    return losses

if __name__ == '__main__':
    demo_sft()
```

---

## 6. Experimental Intuition

### 6.1 Key Ablation Results

The following table summarizes typical findings from SFT ablation studies:

| Factor | Setting A | Setting B | Observation |
|--------|-----------|-----------|-------------|
| Loss masking | Mask prompt tokens | Loss on all tokens | Masking yields better instruction following; full loss degrades response quality |
| Data size | 1K high-quality | 52K mixed quality | 1K matches or exceeds 52K on open-ended tasks (LIMA) |
| Data size | 1K | 10K same distribution | 10K improves on narrow benchmarks but 1K suffices for diverse tasks |
| Packing | With packing | No packing (padding) | Packing gives 2--4x throughput with no quality difference |
| Learning rate | 2e-5 | 1e-4 | 1e-4 causes catastrophic forgetting; 2e-5 is safer |
| Epochs | 2--3 | 10+ | More than 3 epochs often overfits on small SFT data |
| Mixing pretrain data | 5% pretrain mix | 0% pretrain mix | Mixing preserves general knowledge, slight loss on SFT tasks |

### 6.2 Failure Modes

1. **Style overfitting.** With very small data, the model may memorize exact phrasing rather than learning the general style. Outputs become repetitive.

2. **Catastrophic forgetting.** Aggressive fine-tuning destroys coding ability, math reasoning, or multilingual capability. Detectable by evaluating on held-out benchmarks after each epoch.

3. **Distribution mismatch.** If the SFT data only contains short responses, the model struggles to produce long, detailed answers at inference time. Similarly, if all examples are in English, multilingual capability degrades.

4. **Reward hacking via SFT.** If the SFT data is generated by a model that was optimized for a reward model, the SFT model inherits the reward hacking behavior.

### 6.3 Hyperparameter Recommendations

| Hyperparameter | Recommended Range | Notes |
|---------------|-------------------|-------|
| Learning rate | 1e-5 to 5e-5 | Lower for larger models |
| Batch size | 32--128 sequences | Accumulate gradients if memory-limited |
| Epochs | 2--5 | Monitor validation loss for early stopping |
| Warmup | 3--10% of total steps | Linear warmup then cosine decay |
| Weight decay | 0.01--0.1 | Standard AdamW |
| Max grad norm | 1.0 | Prevents training instability |
| Sequence length | Model's max context | Use packing to fill it efficiently |

---

## 7. Connections

### 7.1 Within This Module

- **Lecture 06b (Reward Modeling):** SFT produces the initial policy model that will be further refined via RL or preference optimization.
- **Lecture 06c (PPO/RLHF):** The SFT model serves as both the starting policy and the reference policy $\pi_{\text{ref}}$ for the KL penalty.
- **Lecture 06d (DPO/SimPO/GRPO):** DPO directly uses the SFT model as $\pi_{\text{ref}}$ in its loss function.
- **Recitation 06 (LoRA/QLoRA):** Parameter-efficient fine-tuning is the practical method for performing SFT on large models with limited GPU memory.

### 7.2 To Other Modules

- **Module 04/05 (Transformers):** SFT fine-tunes the same transformer architecture covered there.
- **Module 07 (Scaling Laws):** The LIMA result suggests that SFT data efficiency follows different scaling laws than pretraining.

---

## 8. Paper Reading List

### Required Reading

1. **Ouyang, L., Wu, J., Jiang, X., et al.** (2022). "Training language models to follow instructions with human feedback." *NeurIPS 2022*.
   - The InstructGPT paper. Defines the SFT + RM + RLHF pipeline. Section 3.1 covers SFT specifics: data collection, formatting, and training details.

2. **Zhou, C., Liu, P., Xu, P., et al.** (2023). "LIMA: Less Is More for Alignment." *NeurIPS 2023*.
   - Demonstrates that 1,000 carefully curated SFT examples suffice for competitive alignment quality. Key evidence for the data quality > quantity hypothesis.

3. **Wei, J., Bosma, M., Zhao, V., et al.** (2022). "Finetuned Language Models Are Zero-Shot Learners." *ICLR 2022*.
   - The FLAN paper. Shows that multi-task instruction tuning improves zero-shot generalization across NLP tasks.

### Recommended Reading

4. **Sanh, V., Webson, A., Raffel, C., et al.** (2022). "Multitask Prompted Training Enables Zero-Shot Task Generalization." *ICLR 2022*.
   - T0: similar findings to FLAN but with explicit prompt templates and the T5 architecture.

5. **Longpre, S., Hou, L., Vu, T., et al.** (2023). "The Flan Collection: Designing Data and Methods for Effective Instruction Tuning." *ICML 2023*.
   - FLAN v2: detailed ablations on task mixture composition, input inversion, and chain-of-thought data.

6. **Taori, R., Gulrajani, I., Zhang, T., et al.** (2023). "Stanford Alpaca: An Instruction-following LLaMA Model."
   - Shows that SFT on 52K GPT-4-generated instruction-response pairs produces a competitive open-source model.

7. **Wang, Y., Kordi, Y., Mishra, S., et al.** (2023). "Self-Instruct: Aligning Language Models with Self-Generated Instructions." *ACL 2023*.
   - Method for generating synthetic instruction data from the model itself, reducing human annotation costs.

---

## 9. Exercises

### Theory Exercises

**Exercise 6a.1.** (Loss masking derivation) Let $\mathbf{s} = (\mathbf{x}, \mathbf{y})$ be a concatenated sequence. Show that minimizing $\mathcal{L}_{\text{masked}}(\theta) = -\sum_{t=1}^{|\mathbf{y}|} \log P_\theta(y_t \mid \mathbf{x}, y_{<t})$ is equivalent to maximizing $P_\theta(\mathbf{y} \mid \mathbf{x})$ under the autoregressive factorization. Why is this not the same as maximizing $P_\theta(\mathbf{x}, \mathbf{y})$?

**Exercise 6a.2.** (Information-theoretic analysis of SFT) Consider the SFT objective as minimizing the cross-entropy between the data distribution $p_{\text{data}}(\mathbf{y} \mid \mathbf{x})$ and the model $P_\theta(\mathbf{y} \mid \mathbf{x})$:

$$H(p_{\text{data}}, P_\theta) = -\mathbb{E}_{(\mathbf{x}, \mathbf{y}) \sim p_{\text{data}}} [\log P_\theta(\mathbf{y} \mid \mathbf{x})]$$

(a) Show that $H(p_{\text{data}}, P_\theta) = H(p_{\text{data}}) + D_{\text{KL}}(p_{\text{data}} \| P_\theta)$.

(b) Explain why minimizing cross-entropy is equivalent to minimizing KL divergence from data to model.

(c) If the data contains multiple valid responses $\mathbf{y}_1, \mathbf{y}_2$ for the same instruction $\mathbf{x}$, how does the SFT model handle this? Relate to the mode-covering vs. mode-seeking property of forward KL.

**Exercise 6a.3.** (Packing efficiency analysis) Suppose example lengths $\ell_i \sim \text{Uniform}(10, 200)$ and the packing length is $L = 2048$.

(a) Compute the expected number of examples per packed sequence.

(b) What is the expected fraction of wasted tokens (padding) with the first-fit packing strategy?

(c) Compare throughput (tokens per second) with and without packing, assuming fixed per-sequence compute cost.

**Exercise 6a.4.** (Catastrophic forgetting bound) Suppose the pretrained model satisfies $\mathcal{L}_{\text{pretrain}}(\theta_0) = L_0$ on a held-out pretraining set. After SFT with learning rate $\eta$ and $T$ steps, using the smoothness assumption $\|\nabla^2 \mathcal{L}_{\text{pretrain}}\| \le \beta$, derive an upper bound on $\mathcal{L}_{\text{pretrain}}(\theta_T) - L_0$ in terms of the SFT gradient norms and $\beta$.

### Implementation Exercises

**Exercise 6a.5.** Implement loss masking for multi-turn conversations. Given a conversation with $K$ turns alternating between user and assistant, create a function that:

(a) Tokenizes each turn separately and concatenates them.

(b) Creates a loss mask that is 1 only for assistant turns.

(c) Verifies that the masked loss is correct by comparing with manually computing the loss on assistant tokens only.

**Exercise 6a.6.** Implement sequence packing with the first-fit-decreasing bin-packing algorithm.

(a) Sort examples by length in decreasing order.

(b) For each example, try to fit it into the first bin (packed sequence) that has room.

(c) Measure the packing efficiency and compare to the naive sequential packing from the lecture code.

(d) Plot packing efficiency vs. $L / \mathbb{E}[\ell]$ for different sequence length distributions.

**Exercise 6a.7.** (SFT ablation study) Using a small pretrained GPT-2 model and a subset of the Alpaca dataset:

(a) Compare SFT with and without loss masking. Evaluate on a held-out set of instructions.

(b) Vary the SFT data size: 100, 500, 1000, 5000 examples. Plot instruction-following quality (measured by GPT-4 evaluation) vs. data size.

(c) Measure catastrophic forgetting by evaluating perplexity on a held-out pretraining set (e.g., WikiText) after each epoch of SFT.

---

*Next: Lecture 06b --- Reward Modeling*
