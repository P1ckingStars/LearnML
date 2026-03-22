# Lecture 06d: DPO, SimPO, and GRPO

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Derive** the DPO loss from the KL-constrained RLHF objective by substituting the closed-form optimal policy into the Bradley-Terry model.
2. **Prove** that DPO implicitly optimizes the same objective as RLHF without explicitly training a reward model or running RL.
3. **Derive** the IPO loss as an alternative to the Bradley-Terry preference model.
4. **Explain** SimPO as a reference-free simplification of DPO and derive its objective.
5. **Derive** the GRPO (Group Relative Policy Optimization) update rule as used by DeepSeek.
6. **Compare** DPO, IPO, SimPO, and GRPO in terms of theoretical properties, practical trade-offs, and computational costs.

---

## 2. Motivation and Context

### 2.1 The Problem with PPO-RLHF

The PPO-RLHF pipeline (Lecture 06c) requires:

1. Training a separate reward model.
2. Running on-policy RL with PPO, which requires generating responses, scoring them, computing advantages, and performing clipped gradient updates.
3. Managing four models simultaneously in memory: the policy $\pi_\theta$, the reference $\pi_{\text{ref}}$, the reward model $r_\phi$, and the value function $V_\psi$.

This is complex, memory-intensive, and unstable. **Direct Preference Optimization (DPO)** (Rafailov et al., 2023) showed that the reward model and RL loop can be eliminated entirely, reducing alignment to a single supervised learning objective on preference data.

### 2.2 The Key Insight

Recall from Lecture 06c, Theorem 3.5: the optimal policy under KL-regularized reward maximization is:

$$\pi^*(\mathbf{y} \mid \mathbf{x}) = \frac{1}{Z(\mathbf{x})} \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp\!\left(\frac{r(\mathbf{x}, \mathbf{y})}{\beta}\right)$$

DPO's insight is to **rearrange** this equation to express the reward in terms of the optimal policy, and then substitute into the Bradley-Terry preference model. This yields a loss function that can be optimized directly on preference data without ever training a reward model.

### 2.3 Timeline

- **DPO** (Rafailov et al., 2023): the original direct preference optimization.
- **IPO** (Azar et al., 2023): addresses issues with the Bradley-Terry assumption.
- **SimPO** (Meng et al., 2024): removes the need for a reference model.
- **GRPO** (Shao et al., 2024): DeepSeek's group relative approach, using RL but with simplified advantages.

---

## 3. Core Theory

### 3.1 From RLHF to DPO: The Full Derivation

We begin with the KL-regularized RLHF objective from Lecture 06c:

$$\max_\pi \; \mathbb{E}_{\mathbf{x} \sim \mathcal{D},\, \mathbf{y} \sim \pi} \left[r(\mathbf{x}, \mathbf{y})\right] - \beta\, D_{\text{KL}}\!\left(\pi(\cdot \mid \mathbf{x}) \,\|\, \pi_{\text{ref}}(\cdot \mid \mathbf{x})\right)$$

**Step 1: Solve for the optimal policy.**

As derived in Lecture 06c (Theorem 3.5), the optimal policy is:

$$\pi^*(\mathbf{y} \mid \mathbf{x}) = \frac{1}{Z(\mathbf{x})} \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp\!\left(\frac{r(\mathbf{x}, \mathbf{y})}{\beta}\right) \qquad (1)$$

where $Z(\mathbf{x}) = \sum_{\mathbf{y}} \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp(r(\mathbf{x}, \mathbf{y}) / \beta)$.

**Step 2: Rearrange to express reward in terms of the policy.**

From (1), take the logarithm:

$$\log \pi^*(\mathbf{y} \mid \mathbf{x}) = \log \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) + \frac{r(\mathbf{x}, \mathbf{y})}{\beta} - \log Z(\mathbf{x})$$

Rearranging:

$$r(\mathbf{x}, \mathbf{y}) = \beta \log \frac{\pi^*(\mathbf{y} \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x})} + \beta \log Z(\mathbf{x}) \qquad (2)$$

This is the **reward-policy equivalence**: the reward is a linear function of the log-ratio between the optimal policy and the reference policy, plus a prompt-dependent normalizing constant.

**Step 3: Substitute into the Bradley-Terry model.**

The Bradley-Terry preference model (Lecture 06b) states:

$$P(\mathbf{y}_w \succ \mathbf{y}_l \mid \mathbf{x}) = \sigma\!\left(r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l)\right)$$

Substitute equation (2) for both $\mathbf{y}_w$ and $\mathbf{y}_l$:

$$r(\mathbf{x}, \mathbf{y}_w) - r(\mathbf{x}, \mathbf{y}_l) = \beta \log \frac{\pi^*(\mathbf{y}_w \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_w \mid \mathbf{x})} - \beta \log \frac{\pi^*(\mathbf{y}_l \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_l \mid \mathbf{x})}$$

Note that $\beta \log Z(\mathbf{x})$ cancels because it is the same for both responses (it depends only on $\mathbf{x}$).

Therefore:

$$P(\mathbf{y}_w \succ \mathbf{y}_l \mid \mathbf{x}) = \sigma\!\left(\beta \log \frac{\pi^*(\mathbf{y}_w \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_w \mid \mathbf{x})} - \beta \log \frac{\pi^*(\mathbf{y}_l \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_l \mid \mathbf{x})}\right)$$

**Step 4: Replace $\pi^*$ with a learnable policy $\pi_\theta$.**

Instead of first finding $\pi^*$ and then parameterizing it, DPO directly parameterizes the policy $\pi_\theta$ and optimizes it to satisfy the above relationship. The DPO loss is the negative log-likelihood of the preference data:

$$\boxed{\mathcal{L}_{\text{DPO}}(\theta) = -\mathbb{E}_{(\mathbf{x}, \mathbf{y}_w, \mathbf{y}_l) \sim \mathcal{D}} \left[\log \sigma\!\left(\beta \log \frac{\pi_\theta(\mathbf{y}_w \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_w \mid \mathbf{x})} - \beta \log \frac{\pi_\theta(\mathbf{y}_l \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_l \mid \mathbf{x})}\right)\right]}$$

This is a **classification loss** on preference pairs. No reward model, no RL, no value function. Just supervised learning on preferences.

### 3.2 DPO Gradient Analysis

**Theorem 3.1 (DPO gradient).** *The gradient of the DPO loss with respect to $\theta$ is:*

$$\nabla_\theta \mathcal{L}_{\text{DPO}} = -\beta\, \mathbb{E}_{(\mathbf{x}, \mathbf{y}_w, \mathbf{y}_l)}\left[\underbrace{\sigma(-\hat{u})}_{\text{weight}} \left(\nabla_\theta \log \pi_\theta(\mathbf{y}_w \mid \mathbf{x}) - \nabla_\theta \log \pi_\theta(\mathbf{y}_l \mid \mathbf{x})\right)\right]$$

*where $\hat{u} = \beta \log \frac{\pi_\theta(\mathbf{y}_w)}{\pi_{\text{ref}}(\mathbf{y}_w)} - \beta \log \frac{\pi_\theta(\mathbf{y}_l)}{\pi_{\text{ref}}(\mathbf{y}_l)}$ is the implicit reward difference.*

**Proof.** Let $\hat{u}$ be as defined above. Then $\mathcal{L}_{\text{DPO}} = -\mathbb{E}[\log \sigma(\hat{u})]$. By the chain rule:

$$\nabla_\theta \mathcal{L}_{\text{DPO}} = -\mathbb{E}\left[\frac{\sigma'(\hat{u})}{\sigma(\hat{u})} \nabla_\theta \hat{u}\right]$$

Since $\sigma'(z) = \sigma(z)(1 - \sigma(z)) = \sigma(z)\sigma(-z)$:

$$= -\mathbb{E}\left[\sigma(-\hat{u}) \nabla_\theta \hat{u}\right]$$

And $\nabla_\theta \hat{u} = \beta(\nabla_\theta \log \pi_\theta(\mathbf{y}_w) - \nabla_\theta \log \pi_\theta(\mathbf{y}_l))$ since $\pi_{\text{ref}}$ is frozen. $\blacksquare$

**Interpretation of the gradient:**

- The weight $\sigma(-\hat{u}) \in (0, 1)$ measures how "wrong" the current model is. When the model correctly assigns higher implicit reward to $\mathbf{y}_w$ (large $\hat{u}$), $\sigma(-\hat{u}) \approx 0$ and the gradient is small. When the model is wrong ($\hat{u} < 0$), the weight is large.
- The direction increases $\log \pi_\theta(\mathbf{y}_w)$ and decreases $\log \pi_\theta(\mathbf{y}_l)$: upweight the preferred response, downweight the dispreferred one.

### 3.3 DPO Implicitly Optimizes the RLHF Objective

**Theorem 3.2 (Equivalence of DPO and RLHF).** *Under the Bradley-Terry preference model, the global optimum of the DPO loss coincides with the optimal policy of the KL-regularized RLHF objective.*

**Proof.** Suppose the preference data is generated by a true reward $r^*$ via the BT model: $P(\mathbf{y}_w \succ \mathbf{y}_l) = \sigma(r^*(\mathbf{y}_w) - r^*(\mathbf{y}_l))$.

The RLHF-optimal policy is $\pi^*_{\text{RLHF}}(\mathbf{y}) \propto \pi_{\text{ref}}(\mathbf{y}) \exp(r^*(\mathbf{y}) / \beta)$.

The DPO loss is minimized when the implicit reward difference matches the true reward difference:

$$\beta \log \frac{\pi_\theta(\mathbf{y}_w)}{\pi_{\text{ref}}(\mathbf{y}_w)} - \beta \log \frac{\pi_\theta(\mathbf{y}_l)}{\pi_{\text{ref}}(\mathbf{y}_l)} = r^*(\mathbf{y}_w) - r^*(\mathbf{y}_l)$$

for all pairs. By the reward-policy equivalence (equation 2), the policy that satisfies this for all pairs is exactly $\pi^*_{\text{RLHF}}$. $\blacksquare$

### 3.4 The Implicit Reward Model

DPO does not train an explicit reward model, but it implicitly defines one. From equation (2):

$$r_{\text{implicit}}(\mathbf{x}, \mathbf{y}) = \beta \log \frac{\pi_\theta(\mathbf{y} \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x})}$$

(up to the $\beta \log Z$ constant, which is the same for all $\mathbf{y}$ given $\mathbf{x}$).

This allows us to extract a reward model from a DPO-trained policy, which can be used for best-of-N sampling or analysis.

### 3.5 IPO: Identity Preference Optimization

**Motivation.** DPO assumes the Bradley-Terry model for preferences. If this assumption is violated (e.g., intransitive preferences), the DPO loss may not recover the correct policy. IPO (Azar et al., 2023) provides an alternative that does not require the BT assumption.

**IPO objective.** Instead of maximizing the log-likelihood under BT, IPO directly optimizes a squared loss on the implicit reward difference:

$$\mathcal{L}_{\text{IPO}}(\theta) = \mathbb{E}_{(\mathbf{x}, \mathbf{y}_w, \mathbf{y}_l)} \left[\left(\log \frac{\pi_\theta(\mathbf{y}_w \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_w \mid \mathbf{x})} - \log \frac{\pi_\theta(\mathbf{y}_l \mid \mathbf{x})}{\pi_{\text{ref}}(\mathbf{y}_l \mid \mathbf{x})} - \frac{1}{2\beta}\right)^2\right]$$

**Derivation sketch.** IPO starts from a different preference model: instead of assuming $P(\mathbf{y}_w \succ \mathbf{y}_l) = \sigma(r_w - r_l)$, it assumes that preferences indicate a margin:

$$\mathbb{E}[r(\mathbf{y}_w) - r(\mathbf{y}_l) \mid \mathbf{y}_w \succ \mathbf{y}_l] = c$$

for some constant $c > 0$. The IPO loss enforces that the implicit reward difference equals this target margin $1/(2\beta)$.

**Advantages of IPO over DPO:**

- No assumption about the functional form of preferences.
- More robust to noisy or intransitive preferences.
- Simpler gradient dynamics (quadratic loss vs. logistic loss).

**Disadvantage:** The fixed target margin may not match the true reward difference distribution, potentially losing information about how **much** one response is preferred over another.

### 3.6 SimPO: Simple Preference Optimization (Reference-Free)

**Motivation.** DPO requires computing $\log \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x})$ for every training example, which means running a forward pass through the frozen reference model. This doubles memory requirements. SimPO (Meng et al., 2024) eliminates the reference model entirely.

**Key idea.** SimPO uses the **average log-likelihood** of the response as the implicit reward, normalized by response length:

$$r_{\text{SimPO}}(\mathbf{x}, \mathbf{y}) = \frac{\beta}{|\mathbf{y}|} \log \pi_\theta(\mathbf{y} \mid \mathbf{x}) = \frac{\beta}{|\mathbf{y}|} \sum_{t=1}^{|\mathbf{y}|} \log \pi_\theta(y_t \mid \mathbf{x}, y_{<t})$$

**SimPO loss:**

$$\mathcal{L}_{\text{SimPO}}(\theta) = -\mathbb{E}_{(\mathbf{x}, \mathbf{y}_w, \mathbf{y}_l)} \left[\log \sigma\!\left(\frac{\beta}{|\mathbf{y}_w|} \log \pi_\theta(\mathbf{y}_w) - \frac{\beta}{|\mathbf{y}_l|} \log \pi_\theta(\mathbf{y}_l) - \gamma\right)\right]$$

where $\gamma > 0$ is a target margin that encourages a gap between preferred and dispreferred rewards.

**Why length normalization?** Without normalization, longer sequences have lower log-probability (more tokens = more multiplicative factors < 1), creating a length bias. Normalizing by $|\mathbf{y}|$ converts the total log-probability into a per-token average, removing this bias.

**Why no reference model?** DPO's implicit reward is $r = \beta \log(\pi_\theta / \pi_{\text{ref}})$. SimPO replaces this with $r = (\beta / |\mathbf{y}|) \log \pi_\theta$. The reference model's role in DPO is to prevent the policy from collapsing; in SimPO, the length normalization and the margin $\gamma$ serve this purpose instead.

**Advantages:**

- Halves memory (no reference model needed).
- Simpler implementation.
- Empirically competitive with or better than DPO on several benchmarks.

### 3.7 GRPO: Group Relative Policy Optimization

**Motivation.** GRPO (Shao et al., 2024), used in DeepSeek-R1, takes a different approach: it is a **policy gradient method** (like PPO) but eliminates the value function by using **group-level relative advantages**.

**Setup.** For each prompt $\mathbf{x}$, sample a **group** of $G$ responses: $\{\mathbf{y}_1, \ldots, \mathbf{y}_G\} \sim \pi_{\theta_{\text{old}}}(\cdot \mid \mathbf{x})$. Score each with a reward model (or rule-based reward): $r_i = r(\mathbf{x}, \mathbf{y}_i)$.

**Group-relative advantage.** Instead of training a value function to estimate $V(s)$, GRPO computes the advantage by normalizing rewards within the group:

$$\hat{A}_i = \frac{r_i - \text{mean}(\{r_j\}_{j=1}^G)}{\text{std}(\{r_j\}_{j=1}^G) + \epsilon}$$

This is a simple z-score normalization of rewards within the group.

**GRPO objective.** GRPO then applies a PPO-style clipped objective:

$$\mathcal{L}_{\text{GRPO}}(\theta) = -\frac{1}{G}\sum_{i=1}^{G} \min\!\left(\rho_i \hat{A}_i,\; \text{clip}(\rho_i, 1-\varepsilon, 1+\varepsilon) \hat{A}_i\right) + \beta\, D_{\text{KL}}(\pi_\theta \| \pi_{\text{ref}})$$

where:

$$\rho_i = \frac{\pi_\theta(\mathbf{y}_i \mid \mathbf{x})}{\pi_{\theta_{\text{old}}}(\mathbf{y}_i \mid \mathbf{x})}$$

**Key differences from PPO:**

1. **No value function.** Advantages are computed from group statistics, not from a learned $V_\psi$.
2. **Per-sequence, not per-token.** The advantage $\hat{A}_i$ is a single scalar per response, not per-token.
3. **KL penalty** is computed as a token-level penalty (like PPO), or as an approximate sequence-level KL.

**Derivation of why group-relative advantages work.** The key insight is that the optimal baseline for REINFORCE is $b^*(\mathbf{x}) = \mathbb{E}_{\pi_{\theta_{\text{old}}}}[r(\mathbf{x}, \mathbf{y})]$. The group mean $\bar{r} = \frac{1}{G}\sum_{i=1}^G r_i$ is a Monte Carlo estimate of this baseline. As $G \to \infty$, $\bar{r} \to b^*$. The group std normalization further reduces variance.

**Proposition 3.3.** *The GRPO advantage estimator $\hat{A}_i = (r_i - \bar{r}) / s$ is an unbiased estimator of the advantage (up to a scale factor) with variance $O(1/G)$.*

*Proof sketch.* $\mathbb{E}[\bar{r}] = \mathbb{E}_\pi[r] = V(\mathbf{x})$. Therefore $\mathbb{E}[\hat{A}_i] \propto \mathbb{E}[r_i - V(\mathbf{x})] = Q(\mathbf{x}, \mathbf{y}_i) - V(\mathbf{x}) = A(\mathbf{x}, \mathbf{y}_i)$. The variance of $\bar{r}$ is $\text{Var}(r) / G$, so the estimation error in the baseline decreases as $G$ grows. $\blacksquare$

### 3.8 Comparison of Methods

| Property | DPO | IPO | SimPO | GRPO |
|----------|-----|-----|-------|------|
| **Training signal** | Preference pairs | Preference pairs | Preference pairs | Sampled responses + rewards |
| **Reference model** | Required | Required | Not required | Required |
| **Reward model** | Not required | Not required | Not required | Required |
| **Value function** | Not required | Not required | Not required | Not required |
| **On-policy generation** | No | No | No | Yes |
| **Preference model** | Bradley-Terry | None (squared loss) | Bradley-Terry + margin | Not applicable |
| **Memory (# models)** | 2 ($\pi_\theta$, $\pi_{\text{ref}}$) | 2 | 1 ($\pi_\theta$ only) | 3 ($\pi_\theta$, $\pi_{\text{ref}}$, $r_\phi$) |
| **Hyperparameters** | $\beta$ | $\beta$ | $\beta$, $\gamma$ | $\beta$, $\varepsilon$, $G$ |
| **Computational cost** | Low (offline) | Low (offline) | Lowest (offline, no ref) | High (online generation) |
| **Overoptimization risk** | Moderate | Low | Moderate | Low (controlled by sampling) |

**When to use which:**

- **DPO:** Default choice for offline preference optimization. Simple, well-understood, widely used.
- **IPO:** When preference data is noisy or intransitive. More robust but potentially less sample efficient.
- **SimPO:** When memory is constrained (cannot load reference model). Competitive with DPO.
- **GRPO:** When you have a reliable reward model (or rule-based rewards) and can afford online generation. Best for settings where the reward is well-defined (e.g., math, code).

---

## 4. Algorithmic Derivation

### 4.1 DPO Training Algorithm

```
Algorithm: DPO_Training
─────────────────────────────────────────────────────────
Input:  SFT model π_ref (frozen), initial policy π_θ ← π_ref
        preference data D = {(x^(i), y_w^(i), y_l^(i))}_{i=1}^{N}
        β (KL strength), learning_rate η, num_epochs E
Output: aligned policy π_θ

1. θ ← copy(π_ref parameters)

2. for epoch = 1 to E:
     SHUFFLE(D)
     for batch {(x, y_w, y_l)} in D:

       // Forward pass through both models
       a. log_π_θ(y_w | x) ← Σ_t log π_θ(y_w_t | x, y_w_{<t})
          log_π_θ(y_l | x) ← Σ_t log π_θ(y_l_t | x, y_l_{<t})

       b. log_π_ref(y_w | x) ← Σ_t log π_ref(y_w_t | x, y_w_{<t})  // no grad
          log_π_ref(y_l | x) ← Σ_t log π_ref(y_l_t | x, y_l_{<t})  // no grad

       // Compute implicit reward difference
       c. Δ_w = log_π_θ(y_w | x) - log_π_ref(y_w | x)
          Δ_l = log_π_θ(y_l | x) - log_π_ref(y_l | x)
          u = β (Δ_w - Δ_l)

       // DPO loss
       d. loss = -mean(log σ(u))

       // Update
       e. BACKWARD(loss)
          CLIP_GRAD_NORM(θ, 1.0)
          UPDATE(θ, η)

3. Return π_θ
```

**Complexity per step:**

- Forward passes: 2 through $\pi_\theta$ (chosen + rejected) + 2 through $\pi_{\text{ref}}$ (no grad). Total: $4 \times O(L \cdot C_{\text{fwd}})$.
- Backward passes: 2 through $\pi_\theta$ only. Total: $2 \times O(L \cdot C_{\text{bwd}})$.
- Compare to PPO: DPO is much cheaper per step (no generation, no GAE, no multi-epoch PPO updates).

### 4.2 GRPO Training Algorithm

```
Algorithm: GRPO_Training
─────────────────────────────────────────────────────────
Input:  SFT model π_ref (frozen), initial policy π_θ ← π_ref
        reward model r_φ (or rule-based reward)
        prompts D = {x^(i)}
        group_size G, clip ε, KL coeff β, PPO epochs K
Output: aligned policy π_θ

1. for iteration = 1 to num_iterations:

   // ── Phase 1: Sample groups and score ───────────────
   2. Sample batch of prompts {x^(1), ..., x^(B)}
   3. for each prompt x:
      a. Generate G responses: y_1, ..., y_G ~ π_θ_old(· | x)
      b. Score: r_j = r_φ(x, y_j) for j = 1..G
      c. Compute group advantage:
         r̄ = mean({r_j})
         s = std({r_j}) + eps
         Â_j = (r_j - r̄) / s  for j = 1..G
      d. Store: old log-probs log π_θ_old(y_j | x)

   // ── Phase 2: Policy update ─────────────────────────
   4. for epoch = 1 to K:
      for each (x, {y_j, Â_j}):
        for j = 1 to G:

          a. Compute new log-probs: log π_θ(y_j | x)
          b. Ratio: ρ_j = exp(log π_θ(y_j) - log π_θ_old(y_j))
          c. Clipped surrogate:
             L_j = min(ρ_j Â_j, clip(ρ_j, 1-ε, 1+ε) Â_j)

        d. KL penalty:
           D_KL ≈ mean over tokens of (log π_θ - log π_ref)

        e. Loss = -mean({L_j}) + β · D_KL
        f. Update θ

5. Return π_θ
```

---

## 5. PyTorch Implementation

```python
"""
DPO, SimPO, and GRPO training implementations.

All three methods optimize language model policies on preference data
without requiring a separate RL training loop (DPO, SimPO) or without
requiring a value function (GRPO).

Requires: torch >= 2.0
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import copy

# ── Helper: compute sequence log-probability ─────────────────────────

def sequence_log_prob(
    model: nn.Module,
    input_ids: torch.Tensor,
    labels: torch.Tensor,
    loss_mask: torch.Tensor,
) -> torch.Tensor:
    """
    Compute the total log-probability of target tokens under the model.

    Args:
        model:     language model
        input_ids: (B, L)  input token ids
        labels:    (B, L)  target token ids
        loss_mask: (B, L)  1 for tokens to include in log-prob

    Returns:
        log_probs: (B,) total log-probability per sequence
    """
    logits = model(input_ids)                                # (B, L, V)

    # Shift for autoregressive prediction
    shift_logits = logits[:, :-1, :]                         # (B, L-1, V)
    shift_labels = labels[:, 1:]                             # (B, L-1)
    shift_mask = loss_mask[:, 1:]                            # (B, L-1)

    # Per-token log-probs
    log_probs = F.log_softmax(shift_logits, dim=-1)          # (B, L-1, V)
    token_log_probs = log_probs.gather(
        2, shift_labels.unsqueeze(-1)
    ).squeeze(-1)                                            # (B, L-1)

    # Mask and sum
    seq_log_prob = (token_log_probs * shift_mask).sum(dim=1) # (B,)

    return seq_log_prob

def sequence_avg_log_prob(
    model: nn.Module,
    input_ids: torch.Tensor,
    labels: torch.Tensor,
    loss_mask: torch.Tensor,
) -> torch.Tensor:
    """
    Compute the average per-token log-probability (for SimPO).

    Args:
        model:     language model
        input_ids: (B, L)
        labels:    (B, L)
        loss_mask: (B, L)

    Returns:
        avg_log_probs: (B,) average log-probability per sequence
    """
    logits = model(input_ids)                                # (B, L, V)
    shift_logits = logits[:, :-1, :]                         # (B, L-1, V)
    shift_labels = labels[:, 1:]                             # (B, L-1)
    shift_mask = loss_mask[:, 1:]                            # (B, L-1)

    log_probs = F.log_softmax(shift_logits, dim=-1)          # (B, L-1, V)
    token_log_probs = log_probs.gather(
        2, shift_labels.unsqueeze(-1)
    ).squeeze(-1)                                            # (B, L-1)

    # Average over response tokens
    num_tokens = shift_mask.sum(dim=1).clamp(min=1)          # (B,)
    avg_lp = (token_log_probs * shift_mask).sum(dim=1) / num_tokens
    # avg_lp shape: (B,)

    return avg_lp

# ── DPO Loss ─────────────────────────────────────────────────────────

def dpo_loss(
    policy_chosen_logps: torch.Tensor,
    policy_rejected_logps: torch.Tensor,
    ref_chosen_logps: torch.Tensor,
    ref_rejected_logps: torch.Tensor,
    beta: float = 0.1,
) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
    """
    Compute the DPO loss.

    L_DPO = -E[log σ(β (log(π_θ(y_w)/π_ref(y_w)) - log(π_θ(y_l)/π_ref(y_l))))]

    Args:
        policy_chosen_logps:   (B,) log π_θ(y_w | x)
        policy_rejected_logps: (B,) log π_θ(y_l | x)
        ref_chosen_logps:      (B,) log π_ref(y_w | x)
        ref_rejected_logps:    (B,) log π_ref(y_l | x)
        beta:                  KL regularization strength      (float)

    Returns:
        loss: scalar
        metrics: dict with 'implicit_reward_chosen', 'implicit_reward_rejected',
                 'accuracy' (fraction where chosen reward > rejected reward)
    """
    # Log-ratios (implicit rewards up to constant)
    chosen_logratios = policy_chosen_logps - ref_chosen_logps   # (B,)
    rejected_logratios = policy_rejected_logps - ref_rejected_logps  # (B,)

    # Implicit reward difference
    logits = beta * (chosen_logratios - rejected_logratios)     # (B,)

    # DPO loss: -log σ(logits)
    loss = -F.logsigmoid(logits).mean()                         # scalar

    # Metrics
    with torch.no_grad():
        accuracy = (logits > 0).float().mean()                  # scalar
        implicit_r_chosen = beta * chosen_logratios              # (B,)
        implicit_r_rejected = beta * rejected_logratios          # (B,)

    metrics = {
        'implicit_reward_chosen': implicit_r_chosen.mean().item(),
        'implicit_reward_rejected': implicit_r_rejected.mean().item(),
        'accuracy': accuracy.item(),
        'reward_margin': (implicit_r_chosen - implicit_r_rejected).mean().item(),
    }

    return loss, metrics

# ── IPO Loss ─────────────────────────────────────────────────────────

def ipo_loss(
    policy_chosen_logps: torch.Tensor,
    policy_rejected_logps: torch.Tensor,
    ref_chosen_logps: torch.Tensor,
    ref_rejected_logps: torch.Tensor,
    beta: float = 0.1,
) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
    """
    Compute the IPO loss (Identity Preference Optimization).

    L_IPO = E[(log(π_θ(y_w)/π_ref(y_w)) - log(π_θ(y_l)/π_ref(y_l)) - 1/(2β))^2]

    Args:
        policy_chosen_logps:   (B,) log π_θ(y_w | x)
        policy_rejected_logps: (B,) log π_θ(y_l | x)
        ref_chosen_logps:      (B,) log π_ref(y_w | x)
        ref_rejected_logps:    (B,) log π_ref(y_l | x)
        beta:                  regularization strength         (float)

    Returns:
        loss: scalar
        metrics: dict
    """
    chosen_logratios = policy_chosen_logps - ref_chosen_logps
    rejected_logratios = policy_rejected_logps - ref_rejected_logps

    diff = chosen_logratios - rejected_logratios                # (B,)
    target = 1.0 / (2.0 * beta)

    loss = ((diff - target) ** 2).mean()                        # scalar

    with torch.no_grad():
        accuracy = (diff > 0).float().mean()

    metrics = {
        'log_ratio_diff': diff.mean().item(),
        'target_margin': target,
        'accuracy': accuracy.item(),
    }

    return loss, metrics

# ── SimPO Loss ───────────────────────────────────────────────────────

def simpo_loss(
    policy_chosen_avg_logps: torch.Tensor,
    policy_rejected_avg_logps: torch.Tensor,
    beta: float = 2.0,
    gamma: float = 0.5,
) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
    """
    Compute the SimPO loss (reference-free).

    L_SimPO = -E[log σ(β (avg_logp(y_w) - avg_logp(y_l)) - γ)]

    Note: no reference model needed!

    Args:
        policy_chosen_avg_logps:   (B,) (1/|y_w|) Σ log π_θ(y_w_t | ...)
        policy_rejected_avg_logps: (B,) (1/|y_l|) Σ log π_θ(y_l_t | ...)
        beta:                      reward scaling                (float)
        gamma:                     target margin                 (float)

    Returns:
        loss: scalar
        metrics: dict
    """
    # SimPO reward difference
    logits = beta * (policy_chosen_avg_logps - policy_rejected_avg_logps) - gamma
    # logits shape: (B,)

    loss = -F.logsigmoid(logits).mean()                         # scalar

    with torch.no_grad():
        accuracy = (logits > 0).float().mean()
        r_chosen = beta * policy_chosen_avg_logps
        r_rejected = beta * policy_rejected_avg_logps

    metrics = {
        'reward_chosen': r_chosen.mean().item(),
        'reward_rejected': r_rejected.mean().item(),
        'accuracy': accuracy.item(),
    }

    return loss, metrics

# ── GRPO Loss ────────────────────────────────────────────────────────

def grpo_loss(
    new_log_probs: torch.Tensor,
    old_log_probs: torch.Tensor,
    ref_log_probs: torch.Tensor,
    rewards: torch.Tensor,
    clip_eps: float = 0.2,
    beta: float = 0.1,
) -> Tuple[torch.Tensor, Dict[str, torch.Tensor]]:
    """
    Compute the GRPO loss for a group of responses to a single prompt.

    Args:
        new_log_probs: (G,) log π_θ(y_i | x) under current policy
        old_log_probs: (G,) log π_θ_old(y_i | x) from sampling
        ref_log_probs: (G,) log π_ref(y_i | x)
        rewards:       (G,) r(x, y_i) from reward model
        clip_eps:      PPO clipping parameter                  (float)
        beta:          KL penalty coefficient                  (float)

    Returns:
        loss: scalar
        metrics: dict
    """
    G = rewards.shape[0]

    # Compute group-relative advantages (z-score normalization)
    r_mean = rewards.mean()                                     # scalar
    r_std = rewards.std() + 1e-8                                # scalar
    advantages = (rewards - r_mean) / r_std                     # (G,)

    # Importance sampling ratio
    ratio = torch.exp(new_log_probs - old_log_probs)            # (G,)

    # Clipped surrogate
    surr1 = ratio * advantages                                  # (G,)
    surr2 = torch.clamp(ratio, 1 - clip_eps, 1 + clip_eps) * advantages
    policy_loss = -torch.min(surr1, surr2).mean()               # scalar

    # KL penalty (approximate)
    kl = (new_log_probs - ref_log_probs).mean()                 # scalar

    loss = policy_loss + beta * kl                               # scalar

    with torch.no_grad():
        metrics = {
            'policy_loss': policy_loss.item(),
            'kl': kl.item(),
            'mean_reward': rewards.mean().item(),
            'mean_advantage': advantages.mean().item(),
            'clip_fraction': ((ratio - 1).abs() > clip_eps).float().mean().item(),
        }

    return loss, metrics

# ── DPO Trainer (complete) ───────────────────────────────────────────

class DPOTrainer:
    """
    Complete DPO training loop.

    Args:
        model:      policy model (initialized from SFT)
        ref_model:  frozen reference model (copy of SFT)
        beta:       KL regularization strength                  (float)
        lr:         learning rate                               (float)
        loss_type:  'dpo', 'ipo', or 'simpo'                   (str)
    """
    def __init__(
        self,
        model: nn.Module,
        ref_model: nn.Module,
        beta: float = 0.1,
        lr: float = 5e-7,
        loss_type: str = 'dpo',
        simpo_gamma: float = 0.5,
    ):
        self.model = model
        self.ref_model = ref_model
        self.beta = beta
        self.loss_type = loss_type
        self.simpo_gamma = simpo_gamma

        self.optimizer = torch.optim.AdamW(
            model.parameters(), lr=lr, weight_decay=0.01
        )

        # Freeze reference model
        for p in self.ref_model.parameters():
            p.requires_grad = False

    def train_step(
        self,
        chosen_ids: torch.Tensor,
        rejected_ids: torch.Tensor,
        chosen_mask: torch.Tensor,
        rejected_mask: torch.Tensor,
    ) -> Dict[str, float]:
        """
        One DPO/IPO/SimPO training step.

        Args:
            chosen_ids:    (B, L) token ids for preferred responses
            rejected_ids:  (B, L) token ids for dispreferred responses
            chosen_mask:   (B, L) 1 for response tokens (chosen)
            rejected_mask: (B, L) 1 for response tokens (rejected)

        Returns:
            metrics dict
        """
        self.model.train()

        if self.loss_type == 'simpo':
            # SimPO: no reference model needed
            pi_chosen_avg = sequence_avg_log_prob(
                self.model, chosen_ids, chosen_ids, chosen_mask
            )                                                    # (B,)
            pi_rejected_avg = sequence_avg_log_prob(
                self.model, rejected_ids, rejected_ids, rejected_mask
            )                                                    # (B,)

            loss, metrics = simpo_loss(
                pi_chosen_avg, pi_rejected_avg,
                beta=self.beta, gamma=self.simpo_gamma
            )

        else:
            # DPO or IPO: need reference model
            pi_chosen = sequence_log_prob(
                self.model, chosen_ids, chosen_ids, chosen_mask
            )                                                    # (B,)
            pi_rejected = sequence_log_prob(
                self.model, rejected_ids, rejected_ids, rejected_mask
            )                                                    # (B,)

            with torch.no_grad():
                ref_chosen = sequence_log_prob(
                    self.ref_model, chosen_ids, chosen_ids, chosen_mask
                )                                                # (B,)
                ref_rejected = sequence_log_prob(
                    self.ref_model, rejected_ids, rejected_ids, rejected_mask
                )                                                # (B,)

            if self.loss_type == 'dpo':
                loss, metrics = dpo_loss(
                    pi_chosen, pi_rejected,
                    ref_chosen, ref_rejected,
                    beta=self.beta
                )
            elif self.loss_type == 'ipo':
                loss, metrics = ipo_loss(
                    pi_chosen, pi_rejected,
                    ref_chosen, ref_rejected,
                    beta=self.beta
                )
            else:
                raise ValueError(f"Unknown loss type: {self.loss_type}")

        # Optimization step
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
        self.optimizer.step()

        metrics['loss'] = loss.item()
        return metrics

# ── Demo ─────────────────────────────────────────────────────────────

def demo_dpo():
    """
    Demonstrate DPO, IPO, and SimPO on a toy model.
    """
    print("=== DPO / IPO / SimPO Demo ===\n")

    # Tiny model for demonstration
    class TinyLM(nn.Module):
        def __init__(self, vocab_size=100, d_model=64):
            super().__init__()
            self.emb = nn.Embedding(vocab_size, d_model)
            self.proj = nn.Linear(d_model, vocab_size)

        def forward(self, x):
            return self.proj(self.emb(x))  # (B, L, V)

    vocab_size = 100
    seq_len = 32
    batch_size = 8

    for loss_type in ['dpo', 'ipo', 'simpo']:
        print(f"--- {loss_type.upper()} ---")

        model = TinyLM(vocab_size)
        ref_model = copy.deepcopy(model)

        trainer = DPOTrainer(
            model=model,
            ref_model=ref_model,
            beta=0.1 if loss_type != 'simpo' else 2.0,
            lr=1e-4,
            loss_type=loss_type,
        )

        for step in range(5):
            # Synthetic preference data
            chosen = torch.randint(1, vocab_size, (batch_size, seq_len))
            rejected = torch.randint(1, vocab_size, (batch_size, seq_len))
            chosen_mask = torch.ones(batch_size, seq_len)
            chosen_mask[:, :8] = 0  # first 8 tokens are prompt
            rejected_mask = chosen_mask.clone()

            metrics = trainer.train_step(
                chosen, rejected, chosen_mask, rejected_mask
            )

            if step % 2 == 0:
                print(f"  Step {step}: loss={metrics['loss']:.4f}, "
                      f"acc={metrics['accuracy']:.3f}")
        print()

if __name__ == '__main__':
    demo_dpo()
```

---

## 6. Experimental Intuition

### 6.1 DPO vs. PPO-RLHF

| Metric | DPO | PPO-RLHF | Notes |
|--------|-----|-----------|-------|
| Training time | 1x | 5--10x | DPO is offline, PPO requires generation |
| Memory | 2 models | 4 models | DPO skips RM and value function |
| Stability | High | Medium | DPO is supervised learning; PPO has RL instability |
| Sample efficiency | Higher | Lower | DPO reuses fixed preference data |
| Performance (GPT-4 judge) | Comparable | Comparable | With well-tuned hyperparameters |
| Overoptimization | Can occur | Can occur | Both need $\beta$ tuning |

### 6.2 Key Ablation Results

| Factor | Setting A | Setting B | Finding |
|--------|-----------|-----------|---------|
| $\beta$ (DPO) | 0.01 | 0.1 | Lower $\beta$ = more deviation from ref; $\beta = 0.1$ is robust default |
| $\beta$ (DPO) | 0.1 | 0.5 | Higher $\beta$ = more conservative; may underfit preferences |
| DPO epochs | 1 | 3 | 1 epoch usually best; more epochs overfit on small datasets |
| SimPO $\gamma$ | 0 | 0.5 | $\gamma > 0$ improves win rate by enforcing reward gap |
| GRPO group size $G$ | 4 | 16 | Larger groups give better advantage estimates but cost more |
| DPO vs. IPO | BT assumption holds | Noisy labels | IPO is more robust to noise; DPO is better with clean data |

### 6.3 Failure Modes

1. **DPO chosen likelihood decreasing.** A known issue: DPO can decrease the probability of chosen responses while still increasing the reward margin. This happens when the loss is dominated by pushing $\pi_\theta(\mathbf{y}_l)$ down rather than pushing $\pi_\theta(\mathbf{y}_w)$ up. Fix: add an SFT loss term on chosen responses.

2. **Reference model drift.** If the reference model is too far from the current policy's initialization, DPO training becomes unstable. Fix: always initialize $\pi_\theta$ from $\pi_{\text{ref}}$.

3. **Length exploitation (SimPO).** Despite length normalization, SimPO can still exhibit length biases if the training data is imbalanced. Fix: filter training data for length diversity.

4. **GRPO reward noise.** If the reward model is noisy, group-relative advantages may be dominated by noise. Fix: increase group size $G$, use reward model ensembles.

### 6.4 Hyperparameter Recommendations

| Method | Parameter | Recommended Value |
|--------|-----------|-------------------|
| DPO | $\beta$ | 0.05--0.2 |
| DPO | Learning rate | 1e-7 to 5e-6 |
| DPO | Epochs | 1--3 |
| DPO | Batch size | 32--128 |
| IPO | $\beta$ | 0.05--0.2 |
| SimPO | $\beta$ | 1.0--5.0 |
| SimPO | $\gamma$ | 0.3--1.0 |
| GRPO | Group size $G$ | 8--64 |
| GRPO | Clip $\varepsilon$ | 0.1--0.3 |
| GRPO | $\beta$ | 0.01--0.1 |

---

## 7. Connections

### 7.1 Within This Module

- **Lecture 06a (SFT):** Provides $\pi_{\text{ref}}$ for DPO, IPO, and GRPO, and the starting point for $\pi_\theta$.
- **Lecture 06b (Reward Modeling):** DPO and SimPO eliminate the need for an explicit RM. GRPO still requires one. The implicit RM of DPO can be compared to explicit RMs.
- **Lecture 06c (PPO/RLHF):** DPO derives from the same objective as PPO-RLHF but finds a supervised learning shortcut. GRPO is a simplified variant of PPO.
- **Recitation 06 (LoRA):** All methods in this lecture are commonly combined with LoRA for parameter-efficient training.

### 7.2 To Other Modules

- **Module 00 (Optimization):** DPO is a logistic regression problem; IPO is a least-squares problem. Standard optimization theory applies.
- **Module 00 (Probability):** The Bradley-Terry model and KL divergence are fundamental to all methods here.

---

## 8. Paper Reading List

### Required Reading

1. **Rafailov, R., Sharma, A., Mitchell, E., et al.** (2023). "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." *NeurIPS 2023*.
   - The DPO paper. Derives the DPO loss from the RLHF objective. Clear proofs and strong empirical results.

2. **Azar, M. G., Rowland, M., Piot, B., et al.** (2023). "A General Theoretical Paradigm to Understand Learning from Human Feedback." *arXiv:2310.12036*.
   - Introduces IPO. Provides a theoretical framework for preference-based learning that subsumes DPO and others.

3. **Meng, Y., Xia, M., & Chen, D.** (2024). "SimPO: Simple Preference Optimization with a Reference-Free Reward." *NeurIPS 2024*.
   - SimPO paper. Shows that a reference-free approach with length normalization is competitive with DPO.

4. **Shao, Z., Wang, P., Zhu, Q., et al.** (2024). "DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models." *arXiv:2402.03300*.
   - Introduces GRPO. Applied to mathematical reasoning with verifiable rewards.

### Recommended Reading

5. **Xu, H., Sharaf, A., Chen, Y., et al.** (2024). "Is DPO Superior to PPO for LLM Alignment? A Comprehensive Study." *arXiv:2404.10719*.
   - Detailed comparison of DPO and PPO with carefully controlled experiments.

6. **Ethayarajh, K., Xu, W., Muennighoff, N., Jurafsky, D., & Kiela, D.** (2024). "KTO: Model Alignment as Prospect Theoretic Optimization." *arXiv:2402.01306*.
   - Alternative to DPO that works with non-paired preference data (just good/bad labels).

7. **Rafailov, R., Hejna, J., Park, R., & Finn, C.** (2024). "From r to Q*: Your Language Model is Secretly a Q-Function." *arXiv:2404.12358*.
   - Extends DPO theory to token-level optimization, connecting to Q-learning.

---

## 9. Exercises

### Theory Exercises

**Exercise 6d.1.** (Full DPO derivation) Starting from scratch:

(a) State the KL-regularized RLHF objective and derive the optimal policy $\pi^*(\mathbf{y} \mid \mathbf{x}) \propto \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp(r(\mathbf{x}, \mathbf{y}) / \beta)$.

(b) Invert this to express $r$ in terms of $\pi^*$ and $\pi_{\text{ref}}$.

(c) Substitute into the Bradley-Terry model $P(\mathbf{y}_w \succ \mathbf{y}_l) = \sigma(r(\mathbf{y}_w) - r(\mathbf{y}_l))$ and derive the DPO loss.

(d) Compute the gradient $\nabla_\theta \mathcal{L}_{\text{DPO}}$ and interpret each term.

**Exercise 6d.2.** (DPO-RLHF equivalence) Prove that the global minimizer of $\mathcal{L}_{\text{DPO}}$ is the optimal policy of the KL-regularized RLHF objective, assuming:

(a) The policy class is expressive enough to represent any distribution over responses.

(b) The preference data is generated by a true reward function $r^*$ via the Bradley-Terry model.

(c) There are infinitely many i.i.d. preference samples.

**Exercise 6d.3.** (GRPO advantage analysis)

(a) Show that the group-relative advantage $\hat{A}_i = (r_i - \bar{r}) / s$ is unbiased: $\mathbb{E}[\hat{A}_i] \propto A(\mathbf{x}, \mathbf{y}_i)$.

(b) Compute $\text{Var}[\hat{A}_i]$ as a function of group size $G$ and the variance of rewards.

(c) What is the optimal group size $G^*$ that balances computational cost and variance reduction?

**Exercise 6d.4.** (IPO vs. DPO) Consider a preference dataset where 70% of comparisons follow the Bradley-Terry model with true reward $r^*$, and 30% are random (uniform) noise.

(a) Compute the DPO loss at the true optimal policy $\pi^*_{\text{RLHF}}$. Is it minimized there?

(b) Compute the IPO loss at $\pi^*_{\text{RLHF}}$. How does noise affect it?

(c) Which method is more robust to this type of noise? Prove or give a counterexample.

**Exercise 6d.5.** (SimPO as approximate DPO) Show that SimPO's implicit reward $r_{\text{SimPO}} = (\beta / |\mathbf{y}|) \log \pi_\theta(\mathbf{y})$ is related to DPO's implicit reward $r_{\text{DPO}} = \beta \log(\pi_\theta(\mathbf{y}) / \pi_{\text{ref}}(\mathbf{y}))$ by:

$$r_{\text{SimPO}} \approx r_{\text{DPO}} + \frac{\beta}{|\mathbf{y}|} \log \pi_{\text{ref}}(\mathbf{y}) + \beta\left(\frac{1}{|\mathbf{y}|} - 1\right) \log \pi_\theta(\mathbf{y})$$

Discuss when the additional terms are small (i.e., when SimPO is a good approximation to DPO).

### Implementation Exercises

**Exercise 6d.6.** Implement DPO from scratch and train on the Anthropic HH-RLHF dataset:

(a) Load the dataset, tokenize chosen/rejected responses, create loss masks.

(b) Train a GPT-2 model with DPO for 1 epoch. Log: loss, accuracy, implicit reward margin, chosen/rejected log-probs.

(c) Compare the DPO-trained model to the SFT-only model on 100 test prompts using GPT-4 as a judge.

**Exercise 6d.7.** (Method comparison) Using the same dataset and base model:

(a) Train separate models with DPO, IPO, SimPO, and SFT-only.

(b) For each, evaluate: (i) win rate vs. SFT on test prompts, (ii) diversity (distinct n-grams in generations), (iii) average response length.

(c) Plot the training loss curves. Which method converges fastest? Which achieves the highest accuracy on held-out preference pairs?

**Exercise 6d.8.** Implement GRPO:

(a) For each prompt, generate $G = 16$ responses from the SFT model. Score with a reward model.

(b) Compute group-relative advantages and update the policy with the clipped surrogate.

(c) Run for 100 iterations. Compare the final model to DPO-trained model on the same test set.

(d) Ablate the group size: $G \in \{4, 8, 16, 32\}$. Plot reward vs. group size and compute vs. group size.

---

*Next: Homework 06 --- Alignment*
