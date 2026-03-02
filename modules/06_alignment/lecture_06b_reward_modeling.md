# Lecture 06b: Reward Modeling

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the Bradley-Terry model for pairwise human preferences and its maximum likelihood objective.
2. **Design** a reward model architecture: from a language model backbone to a scalar reward head.
3. **Identify** reward hacking and overoptimization, explaining why optimizing too aggressively against a learned reward model degrades true quality.
4. **Analyze** the effect of reward model scale on alignment quality.
5. **Distinguish** process reward models from outcome reward models and articulate when each is appropriate.
6. **Explain** Constitutional AI as a method for replacing human feedback with AI-generated feedback.

---

## 2. Motivation and Context

### 2.1 Why Reward Models?

After SFT (Lecture 06a), the model can follow instructions, but it may still produce outputs that vary widely in quality. Human evaluators can easily judge which of two responses is **better**, but it is impractical to have humans judge every model output during training. A **reward model** (RM) distills human preferences into a learned scalar function:

$$r_\phi(\mathbf{x}, \mathbf{y}) \in \mathbb{R}$$

where $\mathbf{x}$ is the prompt and $\mathbf{y}$ is the response. Higher scores indicate better responses according to human preferences.

### 2.2 The Challenge

Why not simply ask humans to score each response on an absolute scale? Several reasons:

1. **Calibration.** Different annotators have different internal scales. Pairwise comparisons ("Is A better than B?") are more reliable than absolute ratings ("Rate A from 1 to 10").
2. **Speed.** Comparing two responses side-by-side is faster than crafting a detailed score.
3. **Consistency.** Pairwise preferences have higher inter-annotator agreement than absolute ratings.

This motivates modeling preferences as **pairwise comparisons**, leading naturally to the Bradley-Terry model.

### 2.3 The Reward Modeling Pipeline

$$\text{SFT model} \xrightarrow{\text{generate pairs}} \text{Comparison data} \xrightarrow{\text{train RM}} r_\phi(\mathbf{x}, \mathbf{y})$$

1. Sample pairs of responses from the SFT model for each prompt.
2. Human annotators label which response is preferred.
3. Train a reward model on these pairwise comparisons.
4. Use the reward model to score responses during RL training (Lecture 06c) or implicitly in DPO (Lecture 06d).

---

## 3. Core Theory

### 3.1 The Bradley-Terry Model

**Definition 3.1 (Pairwise preference).** Given a prompt $\mathbf{x}$ and two responses $\mathbf{y}_w$ (preferred/winner) and $\mathbf{y}_l$ (dispreferred/loser), a human preference is the judgment $\mathbf{y}_w \succ \mathbf{y}_l$.

The **Bradley-Terry (BT) model** (Bradley & Terry, 1952) posits that the probability of preferring $\mathbf{y}_w$ over $\mathbf{y}_l$ depends on their latent "quality scores" through a logistic function:

$$P(\mathbf{y}_w \succ \mathbf{y}_l \mid \mathbf{x}) = \sigma\!\left(r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l)\right)$$

where $\sigma(z) = 1/(1 + e^{-z})$ is the logistic sigmoid and $r(\mathbf{x}, \mathbf{y})$ is a latent reward function.

**Derivation from Thurstone's model.** Assume that the perceived quality of response $\mathbf{y}$ is $r(\mathbf{x}, \mathbf{y}) + \epsilon$, where $\epsilon$ is random noise. If the noise follows a standard Gumbel distribution (or equivalently, if the difference of two noises follows a logistic distribution), then:

$$P(\mathbf{y}_w \succ \mathbf{y}_l) = P\!\left(r(\mathbf{x}, \mathbf{y}_w) + \epsilon_w > r(\mathbf{x}, \mathbf{y}_l) + \epsilon_l\right)$$

Let $\delta = \epsilon_l - \epsilon_w$. If $\delta \sim \text{Logistic}(0, 1)$, then:

$$P(\mathbf{y}_w \succ \mathbf{y}_l) = P\!\left(\delta < r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l)\right) = \sigma\!\left(r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l)\right)$$

which is exactly the Bradley-Terry model. $\blacksquare$

**Remark.** The BT model is invariant to adding a constant to the reward: if $r'(\mathbf{x}, \mathbf{y}) = r(\mathbf{x}, \mathbf{y}) + c(\mathbf{x})$ for any function $c$ that depends only on $\mathbf{x}$, then $P(\mathbf{y}_w \succ \mathbf{y}_l)$ is unchanged. This means the reward is identified only up to a prompt-dependent constant.

### 3.2 Maximum Likelihood Estimation for the Reward Model

Given a dataset of pairwise comparisons $\mathcal{D} = \{(\mathbf{x}^{(i)}, \mathbf{y}_w^{(i)}, \mathbf{y}_l^{(i)})\}_{i=1}^{N}$, we seek a parameterized reward model $r_\phi(\mathbf{x}, \mathbf{y})$ that maximizes the log-likelihood:

$$\mathcal{L}_{\text{RM}}(\phi) = \sum_{i=1}^{N} \log \sigma\!\left(r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_w^{(i)}) - r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_l^{(i)})\right)$$

Equivalently, we minimize the **pairwise ranking loss**:

$$\mathcal{L}_{\text{rank}}(\phi) = -\frac{1}{N}\sum_{i=1}^{N} \log \sigma\!\left(r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_w^{(i)}) - r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_l^{(i)})\right)$$

**Proposition 3.2.** *The pairwise ranking loss $\mathcal{L}_{\text{rank}}$ is a proper scoring rule: it is minimized when $r_\phi$ recovers the true log-odds of human preference.*

*Proof.* Define $\Delta r^{(i)} = r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_w^{(i)}) - r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_l^{(i)})$. The loss per comparison is:

$$\ell(\Delta r) = -\log \sigma(\Delta r)$$

This is the binary cross-entropy loss with label 1 (the winner is indeed preferred). The cross-entropy is minimized when $\sigma(\Delta r) = P^*(\mathbf{y}_w \succ \mathbf{y}_l)$, i.e., when $\Delta r = \log \frac{P^*(\mathbf{y}_w \succ \mathbf{y}_l)}{1 - P^*(\mathbf{y}_w \succ \mathbf{y}_l)}$, the true log-odds. $\blacksquare$

**Gradient computation.** The gradient with respect to $\phi$ is:

$$\nabla_\phi \mathcal{L}_{\text{rank}} = -\frac{1}{N}\sum_{i=1}^{N} \left[1 - \sigma(\Delta r^{(i)})\right] \left(\nabla_\phi r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_w^{(i)}) - \nabla_\phi r_\phi(\mathbf{x}^{(i)}, \mathbf{y}_l^{(i)})\right)$$

Intuition: when the model is confident and correct ($\sigma(\Delta r) \approx 1$), the gradient is small. When the model assigns equal probability ($\sigma(\Delta r) \approx 0.5$), the gradient pushes $r_\phi(\mathbf{y}_w)$ up and $r_\phi(\mathbf{y}_l)$ down. When the model is confidently **wrong** ($\sigma(\Delta r) \approx 0$), the gradient is maximal.

### 3.3 Reward Model Architecture

The standard reward model architecture uses a pretrained language model as a backbone with a scalar head replacing the language modeling head:

$$r_\phi(\mathbf{x}, \mathbf{y}) = W_r^\top \mathbf{h}_{\text{last}} + b_r$$

where:
- $\mathbf{h}_{\text{last}} \in \mathbb{R}^d$ is the hidden state at the last token of the response. Shape: $(d,)$.
- $W_r \in \mathbb{R}^d$ is a learned projection vector. Shape: $(d,)$.
- $b_r \in \mathbb{R}$ is a scalar bias.

**Why use the last token?** In an autoregressive model, the hidden state at position $t$ summarizes all preceding tokens $(\mathbf{x}, y_1, \ldots, y_t)$. The last position therefore has access to the full prompt and response.

**Alternative: pooling.** Some architectures use mean pooling over all response token hidden states:

$$r_\phi(\mathbf{x}, \mathbf{y}) = W_r^\top \left(\frac{1}{n}\sum_{t=1}^{n} \mathbf{h}_t\right) + b_r$$

Empirically, last-token and mean-pooling perform similarly, but last-token is more common for autoregressive models.

### 3.4 Reward Normalization

Since the BT model is invariant to constant shifts, the absolute scale of $r_\phi$ is arbitrary. In practice, we normalize rewards during training:

**Batch normalization of rewards.** Given a batch of comparisons, compute:

$$\hat{r}_\phi(\mathbf{x}, \mathbf{y}) = \frac{r_\phi(\mathbf{x}, \mathbf{y}) - \mu_B}{\sigma_B}$$

where $\mu_B$ and $\sigma_B$ are the mean and standard deviation of rewards in the batch.

**Reward centering.** Subtract the mean reward per prompt:

$$\hat{r}_\phi(\mathbf{x}, \mathbf{y}) = r_\phi(\mathbf{x}, \mathbf{y}) - \mathbb{E}_{\mathbf{y}' \sim \pi}[r_\phi(\mathbf{x}, \mathbf{y}')]$$

This helps stabilize RL training (Lecture 06c).

### 3.5 Reward Hacking and Overoptimization

**Definition 3.4 (Reward hacking).** Let $r^*(\mathbf{x}, \mathbf{y})$ be the true (gold-standard) reward and $r_\phi(\mathbf{x}, \mathbf{y})$ be the learned proxy. Reward hacking occurs when:

$$\arg\max_\mathbf{y} r_\phi(\mathbf{x}, \mathbf{y}) \ne \arg\max_\mathbf{y} r^*(\mathbf{x}, \mathbf{y})$$

and the policy $\pi$ finds and exploits this discrepancy.

**Theorem 3.5 (Goodhart's Law, formal version; Gao et al., 2023).** *Let $\pi_\beta$ be the policy obtained by optimizing the KL-regularized objective $\mathbb{E}[r_\phi(\mathbf{y})] - \beta\,D_{\text{KL}}(\pi \| \pi_{\text{ref}})$. As $\beta \to 0$ (more optimization against the proxy), the true reward $\mathbb{E}_{\pi_\beta}[r^*(\mathbf{y})]$ first increases then decreases. More precisely, define:*

$$d = D_{\text{KL}}(\pi_\beta \| \pi_{\text{ref}})$$

*Then the proxy reward follows $\hat{r}(d) \approx \alpha_1 \sqrt{d}$ and the true reward follows $r^*(d) \approx \alpha_2 \sqrt{d} - \alpha_3 d$, where $\alpha_1, \alpha_2, \alpha_3 > 0$.*

*The true reward is maximized at $d^* = (\alpha_2 / (2\alpha_3))^2$ and declines for $d > d^*$.*

**Proof sketch (Gao et al., 2023).** Decompose the proxy reward as $r_\phi = r^* + \epsilon$ where $\epsilon$ is the error. The optimized policy exploits both the true reward and the error. As the KL budget $d$ grows, the policy moves further from $\pi_{\text{ref}}$ and the error exploitation grows quadratically (since $\text{Var}[\epsilon]$ scales with the distributional shift), while the true reward gain grows sublinearly. The crossing point defines $d^*$. $\blacksquare$

**Practical consequence:** There is an optimal "KL budget" beyond which further optimization against the proxy reward actually *hurts* the true reward. This motivates the KL penalty in RLHF (Lecture 06c).

### 3.6 Reward Model Scaling

**Empirical finding (Ouyang et al., 2022; Gao et al., 2023):** Larger reward models produce better alignment outcomes. Specifically:

1. **RM accuracy scales with model size.** On held-out comparison data, larger RMs achieve higher pairwise accuracy.
2. **The overoptimization frontier shifts.** With a larger RM, the optimal KL budget $d^*$ is larger, allowing more optimization before reward hacking sets in.
3. **The peak true reward is higher.** At the optimal $d^*$, a larger RM achieves higher true reward.

Quantitatively, Gao et al. (2023) find that the overoptimization coefficient $\alpha_3$ (the rate of true reward decline) scales as:

$$\alpha_3 \propto \frac{1}{\sqrt{|\mathcal{D}_{\text{RM}}|}}$$

where $|\mathcal{D}_{\text{RM}}|$ is the number of comparisons. More data and larger models reduce $\alpha_3$, pushing $d^*$ further out.

### 3.7 Process vs. Outcome Reward Models

**Outcome Reward Model (ORM):** Assigns a single scalar reward to the complete response $\mathbf{y}$:

$$r_{\text{ORM}}(\mathbf{x}, \mathbf{y}) \in \mathbb{R}$$

This is the standard approach described above.

**Process Reward Model (PRM):** Assigns rewards to intermediate steps in a reasoning chain. For a response $\mathbf{y} = (s_1, s_2, \ldots, s_K)$ decomposed into $K$ steps:

$$r_{\text{PRM}}(\mathbf{x}, \mathbf{y}) = \sum_{k=1}^{K} r_\phi^{(k)}(\mathbf{x}, s_1, \ldots, s_k)$$

where $r_\phi^{(k)}$ evaluates whether step $k$ is correct given the preceding context.

**Advantages of PRMs:**
- Provide denser training signal (reward per step, not just per response).
- Enable **best-of-N search** at the step level: at each step, sample multiple continuations and select the one with the highest process reward.
- Lighthill et al. (2023) showed that PRMs significantly outperform ORMs on mathematical reasoning tasks.

**Disadvantages of PRMs:**
- Require step-level annotations, which are expensive.
- Step decomposition is task-dependent (works well for math, less clear for creative writing).

### 3.8 Constitutional AI: AI Feedback

**Constitutional AI (Bai et al., 2022)** replaces human feedback with AI-generated feedback. The idea:

1. Write a "constitution" --- a set of principles the model should follow (e.g., "be helpful," "be harmless," "be honest").
2. Use an AI model to generate critiques and revisions of the base model's outputs, guided by the constitution.
3. Train a reward model on the AI-generated preferences, or use the AI's preferences directly.

**Formalization.** Let $\mathcal{C} = \{c_1, c_2, \ldots, c_M\}$ be a set of constitutional principles. For each response $\mathbf{y}$ to prompt $\mathbf{x}$:

1. **Critique:** Generate $\text{critique} = \text{LLM}(\text{"Does this response violate principle } c_m \text{?"}, \mathbf{x}, \mathbf{y})$.
2. **Revision:** Generate $\mathbf{y}' = \text{LLM}(\text{"Revise the response to satisfy } c_m \text{"}, \mathbf{x}, \mathbf{y}, \text{critique})$.
3. **Preference data:** Create pairs $(\mathbf{y}', \mathbf{y})$ where the revision $\mathbf{y}'$ is preferred.

This enables a **self-improving** loop: the model generates its own training signal, reducing dependence on expensive human annotations.

---

## 4. Algorithmic Derivation

### 4.1 Reward Model Training Algorithm

```
Algorithm: TrainRewardModel
─────────────────────────────────────────────────────────
Input:  base_model (pretrained or SFT model)
        comparison_data D = {(x^(i), y_w^(i), y_l^(i))}_{i=1}^{N}
        learning_rate η, num_epochs E, batch_size B
Output: reward model parameters φ

1. Initialize reward model:
   a. φ ← copy weights from base_model (backbone)
   b. Remove language modeling head
   c. Add reward head: W_r ∈ R^d, b_r ∈ R (randomly initialized)

2. for epoch = 1 to E:
     SHUFFLE(D)
     for batch {(x^(i), y_w^(i), y_l^(i))}_{i=1}^{B} in D:

       a. Compute rewards for preferred responses:
          for i = 1 to B:
            h_w^(i) ← BACKBONE(CONCAT(x^(i), y_w^(i)))[-1]
            // h_w shape: (d,) — last token hidden state
            r_w^(i) ← W_r^T h_w^(i) + b_r
            // r_w: scalar

       b. Compute rewards for dispreferred responses:
          for i = 1 to B:
            h_l^(i) ← BACKBONE(CONCAT(x^(i), y_l^(i)))[-1]
            r_l^(i) ← W_r^T h_l^(i) + b_r

       c. Compute Bradley-Terry loss:
          loss ← -(1/B) Σ_{i=1}^{B} log σ(r_w^(i) - r_l^(i))

       d. Optional: add L2 regularization
          loss ← loss + λ ||φ - φ_0||^2

       e. Update:
          ZERO_GRAD(φ)
          BACKWARD(loss)
          CLIP_GRAD_NORM(φ, max_norm=1.0)
          UPDATE(φ, η)

3. Return φ
```

**Complexity per step:**

- Forward passes: 2 (one for $\mathbf{y}_w$, one for $\mathbf{y}_l$). Each costs $O(N_L \cdot (L^2 d + L d^2))$.
- Loss computation: $O(B)$ — trivial.
- Backward passes: 2 forward costs.
- Total per step: $O(B \cdot N_L \cdot (L^2 d + L d^2))$.

**Optimization note:** In practice, both $\mathbf{y}_w$ and $\mathbf{y}_l$ share the same prompt $\mathbf{x}$. The KV-cache for $\mathbf{x}$ can be computed once and reused, reducing cost to approximately $1.5\times$ a single forward pass.

### 4.2 Best-of-N Sampling with Reward Model

```
Algorithm: BestOfN
─────────────────────────────────────────────────────────
Input:  policy π (SFT model), reward model r_φ
        prompt x, N candidates
Output: best response y*

1. Generate N responses:
   for i = 1 to N:
     y^(i) ~ π(· | x)

2. Score each response:
   for i = 1 to N:
     s^(i) ← r_φ(x, y^(i))

3. Select best:
   y* ← y^(argmax_i s^(i))

4. Return y*
```

**Complexity:** $O(N)$ generations + $O(N)$ reward evaluations. No gradient computation needed.

**Effective KL budget (Stiennon et al., 2020):**

$$D_{\text{KL}}(\pi_{\text{BoN}} \| \pi) \approx \log N - \frac{N-1}{N}$$

For $N = 16$, this gives $D_{\text{KL}} \approx 2.1$ nats.

---

## 5. PyTorch Implementation

```python
"""
Reward Model training with Bradley-Terry pairwise loss.

Includes:
- Reward model architecture (LM backbone + scalar head)
- Bradley-Terry loss function
- Training loop with gradient accumulation
- Best-of-N sampling
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import List, Tuple, Dict, Optional
import math


# ── Reward Model Architecture ────────────────────────────────────────

class RewardModel(nn.Module):
    """
    Reward model: LM backbone → last-token hidden state → scalar reward.

    Architecture:
        input_ids → Embedding → Transformer layers → h_last → Linear → scalar

    Args:
        vocab_size:  vocabulary size                  (int)
        d_model:     model hidden dimension           (int)
        n_heads:     number of attention heads         (int)
        n_layers:    number of transformer layers      (int)
        max_seq_len: maximum sequence length           (int)
    """
    def __init__(
        self,
        vocab_size: int = 32000,
        d_model: int = 512,
        n_heads: int = 8,
        n_layers: int = 6,
        max_seq_len: int = 1024,
    ):
        super().__init__()
        self.d_model = d_model

        # Backbone (shared with SFT model in practice)
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
        # ln_f: normalizes (*, d_model) → (*, d_model)

        # Reward head: project last hidden state to scalar
        self.reward_head = nn.Linear(d_model, 1, bias=True)
        # reward_head.weight shape: (1, d_model)
        # reward_head.bias shape:   (1,)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """
        Compute scalar reward for each sequence in the batch.

        Args:
            input_ids:      (B, L)  token ids
            attention_mask: (B, L)  1 = real token, 0 = padding  (optional)

        Returns:
            rewards: (B,) scalar reward per sequence
        """
        B, L = input_ids.shape

        # Token + position embeddings
        positions = torch.arange(L, device=input_ids.device)     # (L,)
        x = self.tok_emb(input_ids) + self.pos_emb(positions)    # (B, L, d_model)

        # Causal attention mask
        causal_mask = torch.triu(
            torch.full((L, L), float('-inf'), device=input_ids.device),
            diagonal=1
        )                                                         # (L, L)

        x = self.transformer(x, mask=causal_mask)                # (B, L, d_model)
        x = self.ln_f(x)                                         # (B, L, d_model)

        # Extract last real token's hidden state for each sequence
        if attention_mask is not None:
            # Find index of last non-padding token per sequence
            seq_lengths = attention_mask.sum(dim=1) - 1           # (B,)
            last_hidden = x[
                torch.arange(B, device=x.device), seq_lengths
            ]                                                     # (B, d_model)
        else:
            last_hidden = x[:, -1, :]                             # (B, d_model)

        # Project to scalar reward
        rewards = self.reward_head(last_hidden).squeeze(-1)       # (B,)

        return rewards

    @classmethod
    def from_sft_model(cls, sft_model: nn.Module) -> 'RewardModel':
        """
        Initialize reward model from an SFT model's backbone.
        Copies all shared weights and adds a new reward head.
        """
        # In practice, copy the backbone weights and discard the LM head
        # This is a simplified version
        rm = cls(
            vocab_size=sft_model.tok_emb.num_embeddings,
            d_model=sft_model.tok_emb.embedding_dim,
        )
        # Copy shared parameters
        rm.tok_emb.load_state_dict(sft_model.tok_emb.state_dict())
        rm.pos_emb.load_state_dict(sft_model.pos_emb.state_dict())
        rm.transformer.load_state_dict(sft_model.transformer.state_dict())
        rm.ln_f.load_state_dict(sft_model.ln_f.state_dict())
        # reward_head is randomly initialized
        return rm


# ── Bradley-Terry Loss ───────────────────────────────────────────────

def bradley_terry_loss(
    rewards_chosen: torch.Tensor,
    rewards_rejected: torch.Tensor,
    margin: float = 0.0,
) -> torch.Tensor:
    """
    Compute the Bradley-Terry pairwise ranking loss.

    loss = -mean(log(σ(r_w - r_l - margin)))

    Args:
        rewards_chosen:   (B,) rewards for preferred responses
        rewards_rejected: (B,) rewards for dispreferred responses
        margin:           optional margin to enforce minimum gap  (float)

    Returns:
        loss: scalar
    """
    # r_w - r_l
    reward_diff = rewards_chosen - rewards_rejected - margin     # (B,)

    # -log(σ(r_w - r_l)) = log(1 + exp(-(r_w - r_l)))
    loss = -F.logsigmoid(reward_diff).mean()                    # scalar

    return loss


def compute_rm_metrics(
    rewards_chosen: torch.Tensor,
    rewards_rejected: torch.Tensor,
) -> Dict[str, float]:
    """
    Compute reward model evaluation metrics.

    Args:
        rewards_chosen:   (B,) rewards for preferred responses
        rewards_rejected: (B,) rewards for dispreferred responses

    Returns:
        dict with:
            'accuracy':    fraction where r_w > r_l
            'mean_diff':   mean(r_w - r_l)
            'reward_mean': mean of all rewards
            'reward_std':  std of all rewards
    """
    diff = rewards_chosen - rewards_rejected                     # (B,)
    accuracy = (diff > 0).float().mean().item()
    mean_diff = diff.mean().item()

    all_rewards = torch.cat([rewards_chosen, rewards_rejected])  # (2B,)
    reward_mean = all_rewards.mean().item()
    reward_std = all_rewards.std().item()

    return {
        'accuracy': accuracy,
        'mean_diff': mean_diff,
        'reward_mean': reward_mean,
        'reward_std': reward_std,
    }


# ── Comparison Dataset ───────────────────────────────────────────────

class ComparisonDataset(torch.utils.data.Dataset):
    """
    Dataset of pairwise comparisons for reward model training.

    Each item contains:
        - prompt_ids:   (L_p,) token ids for the prompt
        - chosen_ids:   (L_c,) token ids for the preferred response
        - rejected_ids: (L_r,) token ids for the dispreferred response

    Args:
        comparisons: list of dicts with 'prompt', 'chosen', 'rejected'
                     (each is a list of token ids)
        max_length:  maximum total sequence length
        pad_token_id: padding token id
    """
    def __init__(
        self,
        comparisons: List[Dict[str, List[int]]],
        max_length: int = 512,
        pad_token_id: int = 0,
    ):
        self.comparisons = comparisons
        self.max_length = max_length
        self.pad_token_id = pad_token_id

    def __len__(self) -> int:
        return len(self.comparisons)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        comp = self.comparisons[idx]
        prompt = comp['prompt']                # list of ints
        chosen = comp['chosen']                # list of ints
        rejected = comp['rejected']            # list of ints

        def pad_or_truncate(ids: List[int]) -> Tuple[torch.Tensor, torch.Tensor]:
            """Pad or truncate to max_length, return (ids, mask)."""
            ids = ids[:self.max_length]
            mask = [1] * len(ids) + [0] * (self.max_length - len(ids))
            ids = ids + [self.pad_token_id] * (self.max_length - len(ids))
            return (
                torch.tensor(ids, dtype=torch.long),        # (max_length,)
                torch.tensor(mask, dtype=torch.float32),     # (max_length,)
            )

        chosen_ids, chosen_mask = pad_or_truncate(prompt + chosen)
        rejected_ids, rejected_mask = pad_or_truncate(prompt + rejected)

        return {
            'chosen_ids': chosen_ids,           # (max_length,)
            'chosen_mask': chosen_mask,         # (max_length,)
            'rejected_ids': rejected_ids,       # (max_length,)
            'rejected_mask': rejected_mask,     # (max_length,)
        }


# ── Training Loop ────────────────────────────────────────────────────

def train_reward_model(
    model: RewardModel,
    train_data: ComparisonDataset,
    val_data: Optional[ComparisonDataset] = None,
    num_epochs: int = 1,
    batch_size: int = 8,
    lr: float = 1e-5,
    weight_decay: float = 0.01,
    max_grad_norm: float = 1.0,
    device: str = 'cuda',
) -> Dict[str, List[float]]:
    """
    Train a reward model on pairwise comparison data.

    Args:
        model:         RewardModel instance
        train_data:    ComparisonDataset
        val_data:      optional validation ComparisonDataset
        num_epochs:    training epochs                       (int)
        batch_size:    batch size                             (int)
        lr:            learning rate                          (float)
        weight_decay:  AdamW weight decay                    (float)
        max_grad_norm: gradient clipping threshold            (float)
        device:        'cuda' or 'cpu'                       (str)

    Returns:
        dict with 'train_loss', 'train_acc', 'val_loss', 'val_acc' lists
    """
    model = model.to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=lr, weight_decay=weight_decay
    )

    train_loader = torch.utils.data.DataLoader(
        train_data, batch_size=batch_size, shuffle=True
    )

    history = {
        'train_loss': [], 'train_acc': [],
        'val_loss': [], 'val_acc': [],
    }

    for epoch in range(num_epochs):
        model.train()
        epoch_loss, epoch_acc, n_batches = 0.0, 0.0, 0

        for batch in train_loader:
            chosen_ids = batch['chosen_ids'].to(device)       # (B, L)
            chosen_mask = batch['chosen_mask'].to(device)     # (B, L)
            rejected_ids = batch['rejected_ids'].to(device)   # (B, L)
            rejected_mask = batch['rejected_mask'].to(device) # (B, L)

            # Forward pass: compute rewards
            r_chosen = model(chosen_ids, chosen_mask)          # (B,)
            r_rejected = model(rejected_ids, rejected_mask)    # (B,)

            # Compute loss
            loss = bradley_terry_loss(r_chosen, r_rejected)    # scalar

            # Compute accuracy
            metrics = compute_rm_metrics(r_chosen, r_rejected)

            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                model.parameters(), max_grad_norm
            )
            optimizer.step()

            epoch_loss += loss.item()
            epoch_acc += metrics['accuracy']
            n_batches += 1

        avg_loss = epoch_loss / n_batches
        avg_acc = epoch_acc / n_batches
        history['train_loss'].append(avg_loss)
        history['train_acc'].append(avg_acc)

        print(f"Epoch {epoch+1}/{num_epochs} | "
              f"Loss: {avg_loss:.4f} | Acc: {avg_acc:.4f}")

        # Validation
        if val_data is not None:
            val_loss, val_acc = evaluate_reward_model(
                model, val_data, batch_size, device
            )
            history['val_loss'].append(val_loss)
            history['val_acc'].append(val_acc)
            print(f"  Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4f}")

    return history


@torch.no_grad()
def evaluate_reward_model(
    model: RewardModel,
    dataset: ComparisonDataset,
    batch_size: int = 8,
    device: str = 'cuda',
) -> Tuple[float, float]:
    """
    Evaluate reward model on a comparison dataset.

    Returns:
        (loss, accuracy) tuple
    """
    model.eval()
    loader = torch.utils.data.DataLoader(
        dataset, batch_size=batch_size, shuffle=False
    )
    total_loss, total_acc, n = 0.0, 0.0, 0

    for batch in loader:
        chosen_ids = batch['chosen_ids'].to(device)
        chosen_mask = batch['chosen_mask'].to(device)
        rejected_ids = batch['rejected_ids'].to(device)
        rejected_mask = batch['rejected_mask'].to(device)

        r_chosen = model(chosen_ids, chosen_mask)              # (B,)
        r_rejected = model(rejected_ids, rejected_mask)        # (B,)

        loss = bradley_terry_loss(r_chosen, r_rejected)
        metrics = compute_rm_metrics(r_chosen, r_rejected)

        total_loss += loss.item()
        total_acc += metrics['accuracy']
        n += 1

    return total_loss / n, total_acc / n


# ── Best-of-N Sampling ──────────────────────────────────────────────

@torch.no_grad()
def best_of_n_sampling(
    policy_model: nn.Module,
    reward_model: RewardModel,
    prompt_ids: torch.Tensor,
    n_candidates: int = 16,
    max_new_tokens: int = 128,
    temperature: float = 0.8,
    device: str = 'cuda',
) -> Tuple[torch.Tensor, float]:
    """
    Generate N candidates and select the one with highest reward.

    Args:
        policy_model:   generative language model
        reward_model:   trained reward model
        prompt_ids:     (L_p,) prompt token ids
        n_candidates:   number of candidates to generate     (int)
        max_new_tokens: maximum new tokens per candidate      (int)
        temperature:    sampling temperature                  (float)
        device:         device string                         (str)

    Returns:
        best_response: (L_p + L_r,) token ids of best response
        best_reward:   scalar reward of best response
    """
    policy_model.eval()
    reward_model.eval()

    prompt = prompt_ids.unsqueeze(0).to(device)               # (1, L_p)

    candidates = []
    rewards = []

    for _ in range(n_candidates):
        # Generate response (simplified autoregressive generation)
        generated = prompt.clone()                             # (1, L_p)

        for _ in range(max_new_tokens):
            logits = policy_model(generated)                   # (1, t, V)
            next_logits = logits[:, -1, :] / temperature       # (1, V)
            probs = F.softmax(next_logits, dim=-1)             # (1, V)
            next_token = torch.multinomial(probs, 1)           # (1, 1)
            generated = torch.cat([generated, next_token], dim=1)

        candidates.append(generated)

        # Score with reward model
        reward = reward_model(generated)                       # (1,)
        rewards.append(reward.item())

    # Select best
    best_idx = max(range(n_candidates), key=lambda i: rewards[i])

    return candidates[best_idx].squeeze(0), rewards[best_idx]


# ── Demo ─────────────────────────────────────────────────────────────

def demo_reward_model():
    """
    Demonstrate reward model training on synthetic comparison data.
    """
    print("=== Reward Model Training Demo ===\n")

    # Create synthetic comparison data
    # Simulate: chosen responses have token ids from a "good" range,
    # rejected from a "bad" range
    N = 200
    max_length = 64
    comparisons = []
    for _ in range(N):
        prompt = list(range(1, 11))               # 10 prompt tokens
        # "Good" response: token ids 100-200
        chosen = [torch.randint(100, 200, (1,)).item() for _ in range(20)]
        # "Bad" response: token ids 300-400
        rejected = [torch.randint(300, 400, (1,)).item() for _ in range(20)]
        comparisons.append({
            'prompt': prompt, 'chosen': chosen, 'rejected': rejected
        })

    # Split into train/val
    train_data = ComparisonDataset(comparisons[:160], max_length=max_length)
    val_data = ComparisonDataset(comparisons[160:], max_length=max_length)

    # Create and train reward model
    model = RewardModel(
        vocab_size=500, d_model=128, n_heads=4,
        n_layers=2, max_seq_len=max_length
    )
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Reward model parameters: {total_params:,}")
    print(f"Training examples: {len(train_data)}")
    print(f"Validation examples: {len(val_data)}\n")

    history = train_reward_model(
        model, train_data, val_data,
        num_epochs=5, batch_size=16, lr=1e-4, device='cpu'
    )

    print(f"\nFinal train accuracy: {history['train_acc'][-1]:.4f}")
    if history['val_acc']:
        print(f"Final val accuracy:   {history['val_acc'][-1]:.4f}")

    return history


if __name__ == '__main__':
    demo_reward_model()
```

---

## 6. Experimental Intuition

### 6.1 Key Ablation Results

| Factor | Setting A | Setting B | Finding |
|--------|-----------|-----------|---------|
| RM size (same data) | 1.3B RM | 6B RM | 6B achieves 5% higher pairwise accuracy |
| RM data size | 10K comparisons | 100K comparisons | Larger data reduces overoptimization by ~40% |
| Comparison source | Human labels | AI labels (CAI) | AI labels are noisier but scale better; combined is best |
| Loss function | BT loss | Margin-based loss | BT loss is more robust to label noise |
| Backbone init | Random | SFT model | SFT init converges 3x faster and 2% higher accuracy |
| Reward normalization | None | Batch norm | Normalization stabilizes downstream RL training |

### 6.2 Reward Model Accuracy Benchmarks

Typical pairwise accuracy on held-out comparisons:

| RM Size | # Comparisons | Accuracy |
|---------|---------------|----------|
| 125M | 20K | 62--65% |
| 1.3B | 20K | 68--72% |
| 6B | 20K | 72--75% |
| 6B | 100K | 75--78% |
| 13B | 100K | 77--80% |

Human inter-annotator agreement is typically 73--80%, so a well-trained 6B+ RM approaches the human ceiling.

### 6.3 Overoptimization Curves

The "Goodhart curve" (proxy reward vs. KL from reference) shows:

- **Low KL (0--2 nats):** Both proxy and true reward increase. Safe regime.
- **Medium KL (2--8 nats):** Proxy reward continues to increase, but true reward plateaus.
- **High KL (8+ nats):** True reward decreases while proxy reward increases. Reward hacking territory.

The inflection point shifts right with larger RMs and more comparison data.

### 6.4 Failure Modes

1. **Length bias.** RMs often assign higher rewards to longer responses, even when shorter answers are more appropriate. Mitigation: include length-controlled comparisons in training data.

2. **Sycophancy.** RMs can learn to reward responses that agree with the user's stated opinion, even when the user is wrong. This is a form of reward hacking against human preferences for validation.

3. **Formatting bias.** RMs may reward responses with bullet points, headers, and other formatting even when plain text is more appropriate.

4. **Distribution shift.** As the policy improves, it generates responses outside the RM's training distribution. The RM's predictions become unreliable.

---

## 7. Connections

### 7.1 Within This Module

- **Lecture 06a (SFT):** The SFT model provides the backbone for the reward model and generates the candidate responses for comparison labeling.
- **Lecture 06c (PPO/RLHF):** The reward model is the core component that provides the training signal for PPO.
- **Lecture 06d (DPO):** DPO eliminates the need for an explicit reward model by deriving a closed-form relationship between the optimal policy and the reward (but implicitly defines a reward through this relationship).
- **Recitation 06 (LoRA):** Reward models can also be trained with LoRA to reduce memory requirements.

### 7.2 To Other Modules

- **Module 00 (Foundations):** The Bradley-Terry model connects to maximum likelihood estimation and logistic regression from the foundations module.
- **Module 04/05 (Transformers):** The reward model uses the same transformer architecture, just with a different output head.

---

## 8. Paper Reading List

### Required Reading

1. **Ouyang, L., Wu, J., Jiang, X., et al.** (2022). "Training language models to follow instructions with human feedback." *NeurIPS 2022*.
   - Sections 3.2--3.3 describe reward model training in the InstructGPT pipeline. Pay attention to the comparison data collection process and RM architecture choices.

2. **Gao, L., Schulman, J., & Hilton, J.** (2023). "Scaling Laws for Reward Model Overoptimization." *ICML 2023*.
   - Derives the scaling laws for reward overoptimization. Provides the $\alpha\sqrt{d} - \beta d$ functional form for the Goodhart curve.

3. **Bai, Y., Kadavath, S., Kundu, S., et al.** (2022). "Constitutional AI: Harmlessness from AI Feedback." *arXiv:2212.08073*.
   - Introduces the RLAIF framework where an AI model provides preference labels based on a set of constitutional principles.

### Recommended Reading

4. **Bradley, R. A., & Terry, M. E.** (1952). "Rank Analysis of Incomplete Block Designs: I. The Method of Paired Comparisons." *Biometrika*, 39(3/4), 324--345.
   - The original Bradley-Terry model. Classical statistics paper that underpins all modern preference learning.

5. **Stiennon, N., Ouyang, L., Wu, J., et al.** (2020). "Learning to Summarize from Human Feedback." *NeurIPS 2020*.
   - Early application of RLHF to text summarization. Contains detailed reward model analysis and best-of-N experiments.

6. **Lightman, H., Kosaraju, V., Burda, Y., et al.** (2023). "Let's Verify Step by Step." *arXiv:2305.20050*.
   - Process reward models for mathematical reasoning. Shows that step-level rewards outperform outcome-level rewards on math problems.

7. **Coste, T., Anwar, U., Kirk, R., & Krueger, D.** (2023). "Reward Model Ensembles Help Mitigate Overoptimization." *ICLR 2024*.
   - Uses ensembles of reward models to detect and mitigate reward hacking.

---

## 9. Exercises

### Theory Exercises

**Exercise 6b.1.** (Bradley-Terry derivation) Starting from the assumption that perceived qualities $q_w = r(\mathbf{x}, \mathbf{y}_w) + \epsilon_w$ and $q_l = r(\mathbf{x}, \mathbf{y}_l) + \epsilon_l$ where $\epsilon_w, \epsilon_l$ are i.i.d. Gumbel(0, 1):

(a) Show that $\epsilon_l - \epsilon_w$ follows a Logistic(0, 1) distribution.

(b) Derive the Bradley-Terry preference probability $P(\mathbf{y}_w \succ \mathbf{y}_l) = \sigma(r_w - r_l)$.

(c) What happens if we instead assume Gaussian noise? Derive the corresponding preference model (Thurstone Case V).

**Exercise 6b.2.** (MLE for reward model) Given $N$ i.i.d. comparisons with the Bradley-Terry model:

(a) Write the log-likelihood function $\ell(\phi) = \sum_{i} \log \sigma(\Delta r_\phi^{(i)})$.

(b) Compute the Hessian $H = \nabla^2_\phi \ell$ and show it is negative semi-definite (the log-likelihood is concave in $\Delta r$).

(c) Derive the Fisher information matrix for a single comparison. What does this tell us about which comparisons are most informative?

**Exercise 6b.3.** (Overoptimization analysis) Let $r_\phi = r^* + \epsilon$ where $r^*$ is the true reward and $\epsilon \sim \mathcal{N}(0, \sigma^2)$ is independent noise. Consider a policy $\pi$ that maximizes $\mathbb{E}_\pi[r_\phi] - \beta D_{\text{KL}}(\pi \| \pi_{\text{ref}})$.

(a) Show that the optimal policy is $\pi^*(\mathbf{y} \mid \mathbf{x}) \propto \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp(r_\phi(\mathbf{x}, \mathbf{y}) / \beta)$.

(b) Compute $\mathbb{E}_{\pi^*}[r^*]$ and $\mathbb{E}_{\pi^*}[r_\phi]$ in terms of the partition function and show that $\mathbb{E}_{\pi^*}[r_\phi] \ge \mathbb{E}_{\pi^*}[r^*]$ with equality only when $\sigma = 0$.

(c) Relate this to the Goodhart curve: as $\beta \to 0$, the gap $\mathbb{E}_{\pi^*}[r_\phi] - \mathbb{E}_{\pi^*}[r^*]$ grows.

**Exercise 6b.4.** (Process vs. outcome rewards) Consider a reasoning chain $\mathbf{y} = (s_1, s_2, s_3)$ with three steps. Let $p_k$ be the probability that step $k$ is correct given all previous steps are correct. The final answer is correct iff all steps are correct.

(a) Show that the ORM reward (1 if final answer is correct, 0 otherwise) has expected value $\prod_{k} p_k$.

(b) The PRM gives reward $r_k = \log p_k$ at each step. Show that the total process reward $\sum_k r_k = \log \prod_k p_k$ is a monotonic transformation of the ORM.

(c) Despite this equivalence in expectation, explain why the PRM provides a better training signal for RL (hint: variance reduction).

### Implementation Exercises

**Exercise 6b.5.** Implement a reward model and train it on the Anthropic HH-RLHF dataset:

(a) Load the dataset from HuggingFace (`Anthropic/hh-rlhf`). Parse the chosen and rejected responses.

(b) Train a reward model using a GPT-2 backbone. Report training and validation accuracy.

(c) Analyze the trained RM: what features does it associate with high reward? Compute reward statistics by response length and check for length bias.

**Exercise 6b.6.** Implement Best-of-N sampling:

(a) Using a pretrained GPT-2 model as the policy and your trained RM from Exercise 6b.5, implement Best-of-N with $N \in \{1, 2, 4, 8, 16, 32, 64\}$.

(b) Plot the expected reward vs. $N$ and compare to the theoretical scaling $\mathbb{E}[\max_{i \le N} X_i]$ for i.i.d. Gaussian $X_i$.

(c) Compute the effective KL divergence for each $N$ and plot the Goodhart curve (reward vs. KL).

**Exercise 6b.7.** Implement a simple Constitutional AI pipeline:

(a) Define 5 constitutional principles (e.g., "be helpful," "avoid harmful content," "be factually accurate").

(b) Using a language model, generate critiques and revisions of model outputs based on each principle.

(c) Create a preference dataset from the original-vs-revised pairs and train a reward model on it.

(d) Compare the RM trained on AI feedback to one trained on human feedback (using HH-RLHF). How do they differ in what they reward?

---

*Next: Lecture 06c --- PPO and RLHF*
