# Homework 06: Alignment and Post-Training

> **Module 06 --- Alignment & Post-Training**
> **Due:** Two weeks after assignment
> **Estimated time:** ~20 hours
> **Total points:** 200

---

## Instructions

- Show all work for theory problems. A correct answer without justification receives no credit.
- For proofs, state clearly what you are assuming and what you are proving.
- For coding problems, submit clean, commented code and include all plots and evaluation outputs.
- You may use PyTorch and Hugging Face Transformers. For problems that say "from scratch," do **not** use `trl`, `trl.DPOTrainer`, or similar high-level libraries.
- Notation follows the course [NOTATION.md](../../NOTATION.md).
- Collaboration policy: you may discuss ideas with classmates, but write up all solutions independently. Cite any sources you consult beyond the lecture notes.

---

## Part A: Theory (100 points)

### Problem A1: DPO Derivation from First Principles (25 pts)

Derive the DPO loss starting from the KL-constrained RLHF objective. Show every step.

**(a)** (5 pts) *Optimal policy.* Starting from the objective:

$$\max_\pi \; \mathbb{E}_{\mathbf{y} \sim \pi(\cdot \mid \mathbf{x})} \left[r(\mathbf{x}, \mathbf{y})\right] - \beta\, D_{\text{KL}}\!\left(\pi(\cdot \mid \mathbf{x}) \,\|\, \pi_{\text{ref}}(\cdot \mid \mathbf{x})\right)$$

Derive the optimal policy $\pi^*(\mathbf{y} \mid \mathbf{x})$ using the method of Lagrange multipliers (or by recognizing the variational form). Show that:

$$\pi^*(\mathbf{y} \mid \mathbf{x}) = \frac{1}{Z(\mathbf{x})} \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp\!\left(\frac{r(\mathbf{x}, \mathbf{y})}{\beta}\right)$$

and compute $Z(\mathbf{x})$.

**(b)** (5 pts) *Reward inversion.* Rearrange the optimal policy equation to express the reward as:

$$r(\mathbf{x}, \mathbf{y}) = \beta \log \frac{\pi^*(\mathbf{y} \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x})} + \beta \log Z(\mathbf{x})$$

Explain why $\beta \log Z(\mathbf{x})$ cancels when we compute reward differences $r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l)$.

**(c)** (5 pts) *Bradley-Terry substitution.* Substitute the reward expression into the Bradley-Terry preference model:

$$P(\mathbf{y}_w \succ \mathbf{y}_l \mid \mathbf{x}) = \sigma(r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l))$$

Derive the DPO loss:

$$\mathcal{L}_{\text{DPO}}(\theta) = -\mathbb{E}\left[\log \sigma\!\left(\beta \log \frac{\pi_\theta(\mathbf{y}_w \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_w \mid \mathbf{x})} - \beta \log \frac{\pi_\theta(\mathbf{y}_l \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_l \mid \mathbf{x})}\right)\right]$$

**(d)** (5 pts) *Gradient analysis.* Compute $\nabla_\theta \mathcal{L}_{\text{DPO}}$ and show it equals:

$$\nabla_\theta \mathcal{L}_{\text{DPO}} = -\beta\, \mathbb{E}\left[\sigma(-\hat{u}) \left(\nabla_\theta \log \pi_\theta(\mathbf{y}_w) - \nabla_\theta \log \pi_\theta(\mathbf{y}_l)\right)\right]$$

where $\hat{u} = \beta(\log(\pi_\theta(\mathbf{y}_w) / \pi_{\text{ref}}(\mathbf{y}_w)) - \log(\pi_\theta(\mathbf{y}_l) / \pi_{\text{ref}}(\mathbf{y}_l)))$.

Interpret: what is the role of $\sigma(-\hat{u})$?

**(e)** (5 pts) *Equivalence.* Prove that the global minimum of $\mathcal{L}_{\text{DPO}}$ over all policies $\pi_\theta$ is achieved at the same $\pi^*$ that maximizes the KL-regularized RLHF objective. State any assumptions needed.

### Problem A2: Bradley-Terry Likelihood (15 pts)

**(a)** (5 pts) *Derivation from Gumbel noise.* Suppose the perceived quality of response $\mathbf{y}$ is $q = r(\mathbf{x}, \mathbf{y}) + \epsilon$ where $\epsilon \sim \text{Gumbel}(0, 1)$. Show that the probability of preferring $\mathbf{y}_1$ over $\mathbf{y}_2$ is:

$$P(\mathbf{y}_1 \succ \mathbf{y}_2) = \frac{\exp(r(\mathbf{y}_1))}{\exp(r(\mathbf{y}_1)) + \exp(r(\mathbf{y}_2))} = \sigma(r(\mathbf{y}_1) - r(\mathbf{y}_2))$$

*Hint:* The difference of two i.i.d. Gumbel random variables follows a Logistic distribution.

**(b)** (5 pts) *Log-likelihood.* For a dataset of $N$ comparisons $\{(\mathbf{x}^{(i)}, \mathbf{y}_w^{(i)}, \mathbf{y}_l^{(i)})\}$, write the log-likelihood of a parameterized reward model $r_\phi$. Show that the Hessian of the log-likelihood with respect to $\Delta r = r_\phi(\mathbf{y}_w) - r_\phi(\mathbf{y}_l)$ is negative definite (i.e., the problem is concave).

**(c)** (5 pts) *Fisher information.* Compute the Fisher information for a single comparison under the BT model. Show that the Fisher information is maximized when $P(\mathbf{y}_w \succ \mathbf{y}_l) = 0.5$ (i.e., when the comparison is most uncertain). What does this imply for active data collection?

### Problem A3: GRPO Update Rule (20 pts)

**(a)** (5 pts) *Group advantage.* For a group of $G$ responses $\{\mathbf{y}_1, \ldots, \mathbf{y}_G\}$ sampled from $\pi_{\theta_{\text{old}}}(\cdot \mid \mathbf{x})$ with rewards $\{r_1, \ldots, r_G\}$, define:

$$\hat{A}_i = \frac{r_i - \bar{r}}{s + \epsilon}, \quad \bar{r} = \frac{1}{G}\sum_{j=1}^G r_j, \quad s = \sqrt{\frac{1}{G-1}\sum_{j=1}^G (r_j - \bar{r})^2}$$

Show that $\hat{A}_i$ is an unbiased estimator of the advantage $A(\mathbf{x}, \mathbf{y}_i) = r(\mathbf{x}, \mathbf{y}_i) - V(\mathbf{x})$ up to a scale factor.

**(b)** (5 pts) *Variance analysis.* Compute $\text{Var}[\hat{A}_i]$ as a function of $G$ and $\text{Var}[r]$. How does increasing $G$ affect the quality of the advantage estimate?

**(c)** (5 pts) *GRPO objective.* Write the full GRPO objective including the clipped surrogate and KL penalty:

$$\mathcal{L}_{\text{GRPO}} = -\frac{1}{G}\sum_{i=1}^G \min\!\left(\rho_i \hat{A}_i, \text{clip}(\rho_i, 1-\varepsilon, 1+\varepsilon) \hat{A}_i\right) + \beta\, \hat{D}_{\text{KL}}$$

Compute $\nabla_\theta \mathcal{L}_{\text{GRPO}}$ for the unclipped case.

**(d)** (5 pts) *Comparison to PPO.* In PPO-RLHF, the advantage is estimated using a learned value function $V_\psi(s_t)$ with GAE. In GRPO, the advantage uses group statistics. Analyze the bias-variance trade-off:

- What is the bias of the GRPO advantage estimator?
- Under what conditions does GRPO have lower variance than PPO (with a poorly trained value function)?
- Why might GRPO be preferred when the reward function is verifiable (e.g., mathematical correctness)?

### Problem A4: Reward Overoptimization (20 pts)

**(a)** (5 pts) *Proxy reward decomposition.* Let $r_\phi = r^* + \epsilon$ where $r^*$ is the true reward and $\epsilon$ is the approximation error with $\mathbb{E}[\epsilon] = 0$ and $\text{Var}[\epsilon] = \sigma^2$. For the optimal KL-regularized policy $\pi_\beta^*(\mathbf{y}) \propto \pi_{\text{ref}}(\mathbf{y}) \exp(r_\phi(\mathbf{y}) / \beta)$, compute:

$$\mathbb{E}_{\pi_\beta^*}[r_\phi] \quad \text{and} \quad \mathbb{E}_{\pi_\beta^*}[r^*]$$

in terms of the partition functions $Z_\phi = \mathbb{E}_{\pi_{\text{ref}}}[\exp(r_\phi / \beta)]$ and $Z^* = \mathbb{E}_{\pi_{\text{ref}}}[\exp(r^* / \beta)]$.

**(b)** (5 pts) *The Goodhart gap.* Define the Goodhart gap as $\mathbb{E}_{\pi_\beta^*}[r_\phi] - \mathbb{E}_{\pi_\beta^*}[r^*]$. Show that this gap is non-negative and strictly positive when $\sigma^2 > 0$. Interpret: the policy always looks better under the proxy than it truly is.

**(c)** (5 pts) *Scaling law.* Following Gao et al. (2023), parameterize the KL budget as $d = D_{\text{KL}}(\pi_\beta^* \| \pi_{\text{ref}})$. Assume that:

$$\mathbb{E}_{\pi}[r_\phi] \approx \alpha_1 \sqrt{d}, \qquad \mathbb{E}_{\pi}[r^*] \approx \alpha_2 \sqrt{d} - \alpha_3 d$$

where $\alpha_1, \alpha_2, \alpha_3 > 0$. Find the KL budget $d^*$ that maximizes the true reward. Express $d^*$ in terms of $\alpha_2, \alpha_3$.

**(d)** (5 pts) *Mitigation.* Describe three methods for mitigating reward overoptimization:

1. KL penalty (explain the trade-off in choosing $\beta$).
2. Reward model ensembles (explain how ensembles detect overoptimization).
3. Iterative RM training (explain the "online" RLHF approach).

For each, give a mathematical formulation and discuss computational costs.

### Problem A5: DPO vs. RLHF Equivalence (20 pts)

**(a)** (5 pts) *Implicit reward extraction.* Given a DPO-trained policy $\pi_\theta$ and reference $\pi_{\text{ref}}$, the implicit reward is:

$$r_{\text{implicit}}(\mathbf{x}, \mathbf{y}) = \beta \log \frac{\pi_\theta(\mathbf{y} \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x})}$$

Show that if $\pi_\theta = \pi^*_{\text{RLHF}}$ (the true RLHF optimum), then $r_{\text{implicit}} = r^* + c(\mathbf{x})$ for some prompt-dependent constant $c$.

**(b)** (5 pts) *Off-policy issue.* DPO trains on a fixed dataset of preferences. Explain why this is an "off-policy" method. What problems can arise if the preference data was generated by a policy very different from the current $\pi_\theta$?

**(c)** (5 pts) *IPO alternative.* The IPO loss replaces the BT log-likelihood with a squared loss:

$$\mathcal{L}_{\text{IPO}} = \mathbb{E}\left[\left(\log \frac{\pi_\theta(\mathbf{y}_w)}{\pi_{\text{ref}}(\mathbf{y}_w)} - \log \frac{\pi_\theta(\mathbf{y}_l)}{\pi_{\text{ref}}(\mathbf{y}_l)} - \frac{1}{2\beta}\right)^2\right]$$

Derive the gradient of $\mathcal{L}_{\text{IPO}}$ and compare to the DPO gradient. When would IPO be preferable?

**(d)** (5 pts) *SimPO analysis.* SimPO uses $r(\mathbf{y}) = (\beta / |\mathbf{y}|) \log \pi_\theta(\mathbf{y})$ as the implicit reward.

Show that without length normalization (using $r = \beta \log \pi_\theta(\mathbf{y})$), the SimPO loss would trivially be minimized by a policy that assigns all probability mass to a single (short) sequence. Explain how length normalization prevents this.

---

## Part B: Implementation (100 points)

### Problem B1: LoRA from Scratch (20 pts)

Implement Low-Rank Adaptation (LoRA) without using the `peft` library.

```python
import torch
import torch.nn as nn

class LoRALinear(nn.Module):
    """
    LoRA-augmented linear layer.

    Computes: y = (W + (α/r) * B @ A) x

    Args:
        in_features:  input dimension              (int)
        out_features: output dimension             (int)
        rank:         LoRA rank                    (int)
        alpha:        LoRA scaling factor          (float)
    """
    def __init__(self, in_features: int, out_features: int,
                 rank: int = 8, alpha: float = 16.0):
        super().__init__()
        # YOUR CODE HERE
        pass

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: (*, in_features) input tensor
        Returns:
            y: (*, out_features) output tensor
        """
        # YOUR CODE HERE
        pass
```

**Requirements:**

- **(a)** (8 pts) Implement `LoRALinear` with:
  - Frozen base weight $W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$.
  - Trainable low-rank factors $A \in \mathbb{R}^{r \times d_{\text{in}}}$ and $B \in \mathbb{R}^{d_{\text{out}} \times r}$.
  - Initialize $A$ with Kaiming uniform and $B$ with zeros (so that LoRA starts as identity).
  - Include the scaling factor $\alpha / r$.

- **(b)** (4 pts) Implement a function `apply_lora(model, rank, alpha, target_modules)` that replaces specified `nn.Linear` layers with `LoRALinear` layers, copying the original weights and freezing them.

- **(c)** (4 pts) Verify that:
  - At initialization, `LoRALinear` computes the same output as the original `nn.Linear`.
  - Only the LoRA parameters ($A$, $B$) have `requires_grad=True`.
  - Compute and report the parameter savings: $\frac{r(d_{\text{in}} + d_{\text{out}})}{d_{\text{in}} \cdot d_{\text{out}}}$ for a concrete example.

- **(d)** (4 pts) Implement `merge_lora(model)` that merges the LoRA weights back into the base weights ($W' = W + (\alpha/r) BA$) and removes the LoRA components. Verify that the merged model produces the same outputs as the LoRA model.

### Problem B2: SFT with LoRA (20 pts)

Fine-tune a small language model on instruction data using your LoRA implementation.

**Requirements:**

- **(a)** (5 pts) Load a small pretrained LM (e.g., GPT-2 small, 124M parameters). Apply LoRA to all `q_proj`, `k_proj`, `v_proj`, and `o_proj` (or equivalent attention weight matrices) with rank 8.

- **(b)** (5 pts) Prepare the Alpaca dataset (or a subset of 2,000 examples). Implement proper tokenization with chat template formatting and loss masking (mask prompt tokens, compute loss only on response tokens).

- **(c)** (5 pts) Train for 3 epochs with:
  - Learning rate: 2e-4 with cosine decay
  - Batch size: 4 (with gradient accumulation to effective batch size 32)
  - AdamW with weight decay 0.01
  - Gradient clipping at 1.0

  Plot the training loss curve.

- **(d)** (5 pts) Evaluate:
  - Generate responses to 50 held-out instructions. Provide 5 example prompt-response pairs in your submission.
  - Compare to the base model (no fine-tuning) on the same prompts.
  - Report the total number of trainable parameters vs. total parameters.

### Problem B3: DPO Training from Scratch (30 pts)

Implement the DPO training loop from scratch and train on preference data.

**Requirements:**

- **(a)** (10 pts) Implement the DPO loss function:

```python
def dpo_loss(
    policy_chosen_logps: torch.Tensor,    # (B,)
    policy_rejected_logps: torch.Tensor,  # (B,)
    ref_chosen_logps: torch.Tensor,       # (B,)
    ref_rejected_logps: torch.Tensor,     # (B,)
    beta: float = 0.1,
) -> torch.Tensor:
    """
    Compute the DPO loss.
    Returns: scalar loss
    """
    # YOUR CODE HERE
    pass
```

  Include the following metrics: implicit reward margin, accuracy (fraction where chosen reward > rejected), chosen/rejected log-prob means.

- **(b)** (10 pts) Implement the full training loop:
  - Load preference data (e.g., Anthropic HH-RLHF, or UltraFeedback subset).
  - Tokenize chosen and rejected responses with proper loss masks.
  - Use the SFT model from B2 as both the initial policy and the frozen reference.
  - Train with LoRA (rank 8) for 1 epoch.
  - Log and plot: loss, accuracy, implicit reward margin, chosen log-prob, rejected log-prob (all per step).

- **(c)** (10 pts) Evaluation and comparison:
  - Generate responses from both the SFT-only model (B2) and the SFT+DPO model on 50 test prompts.
  - Use a strong LLM (e.g., GPT-4 via API) to judge which response is preferred. Report the win/tie/loss rate.
  - Measure diversity: compute the number of distinct unigrams, bigrams, and trigrams across all generated responses.
  - Measure the KL divergence between the DPO model and the reference model on the test prompts.

### Problem B4: GRPO Implementation and Comparison (30 pts)

Implement GRPO and compare with DPO.

**Requirements:**

- **(a)** (10 pts) Implement GRPO:

```python
def grpo_step(
    policy_model: nn.Module,
    ref_model: nn.Module,
    reward_fn,               # callable: (prompt, response) -> float
    prompt_ids: torch.Tensor, # (L_p,)
    group_size: int = 16,
    clip_eps: float = 0.2,
    beta: float = 0.1,
) -> Dict[str, float]:
    """
    One GRPO update step for a single prompt.

    1. Generate group_size responses from policy_model.
    2. Score each with reward_fn.
    3. Compute group-relative advantages.
    4. Update policy with clipped surrogate + KL penalty.

    Returns: metrics dict
    """
    # YOUR CODE HERE
    pass
```

  For the reward function, you may use one of:

  - A trained reward model (from Lecture 06b exercises).
  - A rule-based reward (e.g., for math: 1 if the answer is correct, 0 otherwise).
  - An LLM-as-judge reward.

- **(b)** (10 pts) Train the same base model with GRPO for a comparable number of effective training examples as DPO. Log and plot:

  - Mean reward per iteration
  - Mean KL divergence per iteration
  - Group advantage statistics (mean, std)

- **(c)** (10 pts) Head-to-head comparison:
  - Compare SFT-only, SFT+DPO, and SFT+GRPO on the same 50 test prompts.
  - Report pairwise win rates (DPO vs. GRPO, each vs. SFT) using an LLM judge.
  - Analyze when each method is preferred: construct examples where DPO wins and where GRPO wins. Explain the differences.
  - Report wall-clock training time and peak GPU memory for each method.

---

## Submission Checklist

- [ ] Part A: Problems A1--A5, all proofs typed in LaTeX or clear handwriting.
- [ ] Part B: Problems B1--B4, all code files and generated outputs.
- [ ] All code runs without errors on a machine with PyTorch >= 2.0 and a single GPU with >= 16GB VRAM (or CPU fallback).
- [ ] All plots are clearly labeled with axes, titles, and legends.
- [ ] Generated text examples are included in the submission.
- [ ] No use of `trl.DPOTrainer`, `trl.SFTTrainer`, or `peft.LoraModel` (implement these yourself).

---

## Grading Rubric Summary

| Problem | Points | Topic |
|---------|--------|-------|
| A1 | 25 | DPO derivation from first principles |
| A2 | 15 | Bradley-Terry likelihood |
| A3 | 20 | GRPO update rule |
| A4 | 20 | Reward overoptimization |
| A5 | 20 | DPO vs. RLHF equivalence |
| B1 | 20 | LoRA from scratch |
| B2 | 20 | SFT with LoRA |
| B3 | 30 | DPO training from scratch |
| B4 | 30 | GRPO implementation and comparison |
| **Total** | **200** | |

---

## Hints

**A1(a):** Rewrite the objective as $J(\pi) = -\beta D_{\text{KL}}(\pi \| \tilde{\pi})$ where $\tilde{\pi}(\mathbf{y}) \propto \pi_{\text{ref}}(\mathbf{y}) \exp(r(\mathbf{y}) / \beta)$. The KL is minimized (equaling zero) when $\pi = \tilde{\pi}$.

**A2(a):** The CDF of the standard Gumbel distribution is $F(x) = e^{-e^{-x}}$. If $X, Y \sim \text{Gumbel}(0,1)$ are independent, then $P(X + a > Y + b) = \sigma(a - b)$ where $\sigma$ is the logistic sigmoid.

**A3(a):** The key insight is that $\bar{r}$ is an unbiased estimate of $V(\mathbf{x}) = \mathbb{E}_\pi[r(\mathbf{x}, \mathbf{y})]$ by the law of large numbers. Therefore $r_i - \bar{r} \approx r_i - V(\mathbf{x}) = A(\mathbf{x}, \mathbf{y}_i)$.

**B1:** For initializing LoRA, $B$ should be zeros and $A$ should be Kaiming uniform. This ensures the LoRA contribution is zero at initialization (the model behaves exactly like the original). During training, only $A$ and $B$ are updated; the base weight $W$ remains frozen.

**B3:** The DPO loss should decrease during training and accuracy should increase toward ~0.7--0.8 (not 1.0, because some preference pairs are genuinely ambiguous). If accuracy reaches 1.0 too quickly, you may be overfitting --- try a lower learning rate or fewer epochs.

---

*Good luck! This homework covers the full alignment pipeline from theory to practice.*
