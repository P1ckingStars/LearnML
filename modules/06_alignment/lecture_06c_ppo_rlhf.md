# Lecture 06c: Proximal Policy Optimization and RLHF

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formulate** language generation as a Markov Decision Process (MDP) with state = context, action = next token, and reward = RM score.
2. **Derive** the policy gradient theorem and the REINFORCE estimator from first principles.
3. **Derive** the PPO clipped surrogate objective and explain why clipping stabilizes training relative to vanilla policy gradient methods.
4. **Describe** the complete RLHF pipeline: SFT, reward modeling, then PPO fine-tuning.
5. **Derive** the KL-regularized RL objective and explain why constraining to a reference policy prevents reward hacking and mode collapse.
6. **Implement** the key components: generalized advantage estimation (GAE), value function baseline, and reward normalization.

---

## 2. Motivation and Context

### 2.1 Why RL After SFT?

Supervised fine-tuning (Lecture 06a) trains the model to imitate human-written demonstrations. However, **imitation is not optimization** --- SFT maximizes the likelihood of human demonstrations, which are a sample from the space of good responses, not necessarily the best possible responses.

Reinforcement learning allows the model to **explore** the space of responses and **optimize** directly for a reward signal that captures human preferences. The key insight of RLHF (Christiano et al., 2017; Ouyang et al., 2022) is that the reward model (Lecture 06b) provides a differentiable proxy for human judgment, enabling gradient-based optimization of response quality.

### 2.2 The RLHF Pipeline

The full pipeline consists of three stages:

$$\underbrace{\pi_{\text{pretrain}}}_{\text{Stage 0}} \xrightarrow{\text{SFT}} \underbrace{\pi_{\text{SFT}}}_{\text{Stage 1}} \xrightarrow{\text{RM training}} \underbrace{r_\phi}_{\text{Stage 2}} \xrightarrow{\text{PPO}} \underbrace{\pi_{\text{RLHF}}}_{\text{Stage 3}}$$

In Stage 3, we optimize the policy $\pi_\theta$ to maximize the reward $r_\phi$ while staying close to the reference policy $\pi_{\text{ref}} = \pi_{\text{SFT}}$. This lecture focuses on Stage 3.

### 2.3 Historical Context

- **REINFORCE** (Williams, 1992): the foundational policy gradient algorithm.
- **PPO** (Schulman et al., 2017): a practical policy gradient method that stabilizes training via clipping.
- **RLHF for language** (Ziegler et al., 2019): first application of PPO to fine-tune language models with human feedback (text summarization).
- **InstructGPT** (Ouyang et al., 2022): scaled RLHF to a production system (ChatGPT precursor).

---

## 3. Core Theory

### 3.1 Language Generation as an MDP

We formulate autoregressive text generation as a finite-horizon Markov Decision Process:

- **State space $\mathcal{S}$**: $s_t = (\mathbf{x}, y_1, \ldots, y_{t-1})$ --- the prompt concatenated with tokens generated so far.
- **Action space $\mathcal{A}$**: $a_t = y_t \in \mathcal{V}$ --- the next token from the vocabulary.
- **Transition**: deterministic --- $s_{t+1} = (s_t, a_t)$ (appending the chosen token).
- **Policy**: $\pi_\theta(a_t \mid s_t) = P_\theta(y_t \mid \mathbf{x}, y_1, \ldots, y_{t-1})$ --- the language model's next-token distribution.
- **Reward**: $R(s_T) = r_\phi(\mathbf{x}, \mathbf{y})$ --- the reward model score of the complete response. All intermediate rewards are zero: $R(s_t) = 0$ for $t < T$.
- **Horizon**: $T$ = length of the generated response (variable, up to a maximum).

The return (total reward) for a trajectory $\tau = (s_0, a_0, s_1, a_1, \ldots, s_T)$ is simply:

$$G(\tau) = r_\phi(\mathbf{x}, \mathbf{y})$$

since all intermediate rewards are zero.

### 3.2 The RL Objective

We seek to maximize the expected reward under the policy:

$$J(\theta) = \mathbb{E}_{\mathbf{x} \sim \mathcal{D},\, \mathbf{y} \sim \pi_\theta(\cdot \mid \mathbf{x})} \left[r_\phi(\mathbf{x}, \mathbf{y})\right]$$

In practice, we add a KL penalty (Section 3.6), but we first derive the basic policy gradient without it.

### 3.3 The Policy Gradient Theorem

**Theorem 3.1 (Policy Gradient, Williams 1992; Sutton et al. 1999).** *The gradient of $J(\theta)$ is:*

$$\nabla_\theta J(\theta) = \mathbb{E}_{\mathbf{x} \sim \mathcal{D},\, \mathbf{y} \sim \pi_\theta} \left[G(\tau) \sum_{t=1}^{T} \nabla_\theta \log \pi_\theta(y_t \mid s_t)\right]$$

**Proof.** Write the objective as an expectation over complete trajectories:

$$J(\theta) = \sum_{\mathbf{y}} P_\theta(\mathbf{y} \mid \mathbf{x})\, r_\phi(\mathbf{x}, \mathbf{y})$$

where the sum is over all possible token sequences (in practice, we use Monte Carlo estimation). Take the gradient:

$$\nabla_\theta J(\theta) = \sum_{\mathbf{y}} \nabla_\theta P_\theta(\mathbf{y} \mid \mathbf{x})\, r_\phi(\mathbf{x}, \mathbf{y})$$

Apply the log-derivative trick: $\nabla_\theta P_\theta = P_\theta \nabla_\theta \log P_\theta$:

$$= \sum_{\mathbf{y}} P_\theta(\mathbf{y} \mid \mathbf{x}) \nabla_\theta \log P_\theta(\mathbf{y} \mid \mathbf{x})\, r_\phi(\mathbf{x}, \mathbf{y})$$

$$= \mathbb{E}_{\mathbf{y} \sim \pi_\theta} \left[r_\phi(\mathbf{x}, \mathbf{y}) \nabla_\theta \log P_\theta(\mathbf{y} \mid \mathbf{x})\right]$$

Now factor the log-probability using the autoregressive decomposition:

$$\log P_\theta(\mathbf{y} \mid \mathbf{x}) = \sum_{t=1}^{T} \log \pi_\theta(y_t \mid s_t)$$

Therefore:

$$\nabla_\theta J(\theta) = \mathbb{E}_{\mathbf{y} \sim \pi_\theta} \left[r_\phi(\mathbf{x}, \mathbf{y}) \sum_{t=1}^{T} \nabla_\theta \log \pi_\theta(y_t \mid s_t)\right] \quad \blacksquare$$

### 3.4 REINFORCE and Variance Reduction

The **REINFORCE estimator** approximates the policy gradient with a single sample $\mathbf{y} \sim \pi_\theta$:

$$\hat{g} = r_\phi(\mathbf{x}, \mathbf{y}) \sum_{t=1}^{T} \nabla_\theta \log \pi_\theta(y_t \mid s_t)$$

This is an **unbiased** estimator ($\mathbb{E}[\hat{g}] = \nabla_\theta J$) but has **high variance** because a single reward signal modulates all $T$ per-token gradients.

**Baseline subtraction.** For any function $b(\mathbf{x})$ that does not depend on $\mathbf{y}$:

$$\mathbb{E}_{\mathbf{y} \sim \pi_\theta}\left[b(\mathbf{x}) \sum_{t=1}^{T} \nabla_\theta \log \pi_\theta(y_t \mid s_t)\right] = b(\mathbf{x}) \nabla_\theta \sum_{\mathbf{y}} P_\theta(\mathbf{y} \mid \mathbf{x}) = b(\mathbf{x}) \nabla_\theta 1 = 0$$

Therefore, we can subtract any baseline without introducing bias:

$$\hat{g} = (r_\phi(\mathbf{x}, \mathbf{y}) - b(\mathbf{x})) \sum_{t=1}^{T} \nabla_\theta \log \pi_\theta(y_t \mid s_t)$$

The **optimal baseline** that minimizes variance is $b^*(\mathbf{x}) = \mathbb{E}_{\mathbf{y} \sim \pi_\theta}[r_\phi(\mathbf{x}, \mathbf{y})]$, which is the value function $V(s_0)$.

### 3.5 Advantage Function and GAE

**Definition 3.2.** The **value function** $V^\pi(s) = \mathbb{E}_\pi[G \mid s]$ is the expected return from state $s$ under policy $\pi$.

**Definition 3.3.** The **advantage function** $A^\pi(s, a) = Q^\pi(s, a) - V^\pi(s)$ measures how much better action $a$ is compared to the average action under $\pi$.

For language generation with terminal reward only:

$$V^\pi(s_t) = \mathbb{E}_{\mathbf{y}_{t:T} \sim \pi}\left[r_\phi(\mathbf{x}, \mathbf{y})\right]$$

$$A^\pi(s_t, y_t) = Q^\pi(s_t, y_t) - V^\pi(s_t)$$

**Generalized Advantage Estimation (GAE, Schulman et al. 2015).** In practice, we train a value function $V_\psi(s_t)$ and compute the GAE:

$$\hat{A}_t^{\text{GAE}(\gamma, \lambda)} = \sum_{l=0}^{T-t-1} (\gamma\lambda)^l \delta_{t+l}$$

where $\delta_t = R_t + \gamma V_\psi(s_{t+1}) - V_\psi(s_t)$ is the temporal difference (TD) error.

For language generation with $\gamma = 1$ (no discounting within an episode) and terminal reward:

$$\delta_t = \begin{cases} V_\psi(s_{t+1}) - V_\psi(s_t) & \text{if } t < T \\ r_\phi(\mathbf{x}, \mathbf{y}) - V_\psi(s_T) & \text{if } t = T \end{cases}$$

**Proposition 3.4.** *GAE interpolates between high-bias/low-variance ($\lambda = 0$: one-step TD) and low-bias/high-variance ($\lambda = 1$: Monte Carlo). At $\lambda = 0$, $\hat{A}_t = \delta_t$ (TD error). At $\lambda = 1$, $\hat{A}_t = G_t - V_\psi(s_t)$ (MC minus baseline).*

*Proof.* For $\lambda = 0$: $\hat{A}_t = \delta_t$. For $\lambda = 1$ with $\gamma = 1$:

$$\hat{A}_t = \sum_{l=0}^{T-t-1} \delta_{t+l} = \sum_{l=0}^{T-t-1} [R_{t+l} + V_\psi(s_{t+l+1}) - V_\psi(s_t)] = G_t - V_\psi(s_t)$$

where the telescoping cancellation leaves only $V_\psi(s_T) - V_\psi(s_t)$ plus the final reward. Since all intermediate rewards are zero and the episode ends at $T$, we get $G_t - V_\psi(s_t)$. $\blacksquare$

### 3.6 The KL-Regularized RLHF Objective

The central objective of RLHF adds a KL penalty to prevent the policy from deviating too far from the reference policy:

$$J_{\text{RLHF}}(\theta) = \mathbb{E}_{\mathbf{x} \sim \mathcal{D},\, \mathbf{y} \sim \pi_\theta} \left[r_\phi(\mathbf{x}, \mathbf{y}) - \beta\, D_{\text{KL}}\!\left(\pi_\theta(\cdot \mid \mathbf{x}) \,\|\, \pi_{\text{ref}}(\cdot \mid \mathbf{x})\right)\right]$$

where $\pi_{\text{ref}} = \pi_{\text{SFT}}$ is the SFT model and $\beta > 0$ controls the strength of the constraint.

**Derivation of per-token KL penalty.** The KL divergence between autoregressive policies factorizes:

$$D_{\text{KL}}(\pi_\theta \| \pi_{\text{ref}}) = \mathbb{E}_{\mathbf{y} \sim \pi_\theta} \left[\sum_{t=1}^{T} \log \frac{\pi_\theta(y_t \mid s_t)}{\pi_{\text{ref}}(y_t \mid s_t)}\right]$$

**Proof.** By definition:

$$D_{\text{KL}}(\pi_\theta \| \pi_{\text{ref}}) = \mathbb{E}_{\mathbf{y} \sim \pi_\theta} \left[\log \frac{P_\theta(\mathbf{y} \mid \mathbf{x})}{P_{\text{ref}}(\mathbf{y} \mid \mathbf{x})}\right]$$

Applying the autoregressive factorization to both numerator and denominator:

$$= \mathbb{E}_{\mathbf{y} \sim \pi_\theta} \left[\log \frac{\prod_{t=1}^T \pi_\theta(y_t \mid s_t)}{\prod_{t=1}^T \pi_{\text{ref}}(y_t \mid s_t)}\right] = \mathbb{E}_{\mathbf{y} \sim \pi_\theta} \left[\sum_{t=1}^{T} \log \frac{\pi_\theta(y_t \mid s_t)}{\pi_{\text{ref}}(y_t \mid s_t)}\right] \quad \blacksquare$$

This means we can implement the KL penalty as a **per-token reward modifier**:

$$\tilde{r}_t = \begin{cases} -\beta \log \frac{\pi_\theta(y_t \mid s_t)}{\pi_{\text{ref}}(y_t \mid s_t)} & \text{if } t < T \\ r_\phi(\mathbf{x}, \mathbf{y}) - \beta \log \frac{\pi_\theta(y_T \mid s_T)}{\pi_{\text{ref}}(y_T \mid s_T)} & \text{if } t = T \end{cases}$$

**Why KL regularization is necessary:**

1. **Prevents reward hacking:** Without the KL penalty, the policy could find degenerate high-reward sequences that exploit the RM's imperfections (Lecture 06b, Section 3.5).
2. **Preserves language quality:** The SFT model already produces fluent text. The KL penalty prevents the RL policy from degenerating into ungrammatical but high-reward text.
3. **Maintains diversity:** Without KL, the policy may collapse to a single high-reward response per prompt (mode collapse).

**Theorem 3.5 (Optimal KL-Regularized Policy).** *The optimal policy for the KL-regularized objective is:*

$$\pi^*(\mathbf{y} \mid \mathbf{x}) = \frac{1}{Z(\mathbf{x})} \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp\!\left(\frac{r_\phi(\mathbf{x}, \mathbf{y})}{\beta}\right)$$

*where $Z(\mathbf{x}) = \sum_{\mathbf{y}} \pi_{\text{ref}}(\mathbf{y} \mid \mathbf{x}) \exp(r_\phi(\mathbf{x}, \mathbf{y}) / \beta)$ is the partition function.*

**Proof.** Write the objective as:

$$J(\pi) = \mathbb{E}_{\mathbf{y} \sim \pi}\left[r_\phi(\mathbf{x}, \mathbf{y})\right] - \beta\,D_{\text{KL}}(\pi \| \pi_{\text{ref}})$$

$$= \sum_{\mathbf{y}} \pi(\mathbf{y}) r_\phi(\mathbf{x}, \mathbf{y}) - \beta \sum_{\mathbf{y}} \pi(\mathbf{y}) \log \frac{\pi(\mathbf{y})}{\pi_{\text{ref}}(\mathbf{y})}$$

$$= \sum_{\mathbf{y}} \pi(\mathbf{y}) \left[r_\phi(\mathbf{x}, \mathbf{y}) - \beta \log \frac{\pi(\mathbf{y})}{\pi_{\text{ref}}(\mathbf{y})}\right]$$

$$= -\beta \sum_{\mathbf{y}} \pi(\mathbf{y}) \log \frac{\pi(\mathbf{y})}{\pi_{\text{ref}}(\mathbf{y}) \exp(r_\phi / \beta)}$$

$$= -\beta\,D_{\text{KL}}\!\left(\pi \,\Big\|\, \frac{\pi_{\text{ref}} \exp(r_\phi / \beta)}{Z}\right) - \beta \log Z$$

Since KL divergence is non-negative and equals zero iff the two distributions match:

$$J(\pi) \le -\beta \log Z$$

with equality iff $\pi = \pi^* = \frac{1}{Z}\pi_{\text{ref}} \exp(r_\phi / \beta)$. $\blacksquare$

This result is central to DPO (Lecture 06d), which uses it to eliminate the need for explicit RL.

### 3.7 PPO: Clipped Surrogate Objective

**Motivation.** Vanilla policy gradient (REINFORCE) takes steps proportional to $\hat{A}_t \nabla_\theta \log \pi_\theta(y_t \mid s_t)$. Large advantage estimates can cause destructively large updates. Trust region methods (TRPO, Schulman et al. 2015) constrain the step size via a hard KL constraint, but this requires expensive second-order optimization.

PPO achieves similar stability with a **clipped surrogate objective**, which is a first-order method.

**Definition 3.6.** The **importance sampling ratio** between the new policy $\pi_\theta$ and the old policy $\pi_{\theta_{\text{old}}}$ is:

$$\rho_t(\theta) = \frac{\pi_\theta(y_t \mid s_t)}{\pi_{\theta_{\text{old}}}(y_t \mid s_t)}$$

The standard policy gradient objective can be rewritten using importance sampling:

$$L^{\text{PG}}(\theta) = \mathbb{E}_t\left[\rho_t(\theta) \hat{A}_t\right]$$

where the expectation is under the old policy $\pi_{\theta_{\text{old}}}$.

**PPO-Clip objective:**

$$L^{\text{CLIP}}(\theta) = \mathbb{E}_t\left[\min\!\left(\rho_t(\theta) \hat{A}_t,\; \text{clip}(\rho_t(\theta), 1-\varepsilon, 1+\varepsilon) \hat{A}_t\right)\right]$$

where $\varepsilon \in (0, 1)$ is the clipping parameter (typically $\varepsilon = 0.2$).

**Derivation and intuition.** The clipping prevents the ratio $\rho_t$ from moving too far from 1:

- If $\hat{A}_t > 0$ (action was better than average): we want to increase $\pi_\theta(y_t \mid s_t)$, so $\rho_t$ increases. But we clip at $1 + \varepsilon$ to prevent over-updating.
- If $\hat{A}_t < 0$ (action was worse than average): we want to decrease $\pi_\theta(y_t \mid s_t)$, so $\rho_t$ decreases. But we clip at $1 - \varepsilon$ to prevent over-decreasing.

Formally, the `min` selects the more pessimistic (conservative) estimate:

$$L^{\text{CLIP}}(\theta) = \begin{cases} \min(\rho_t, 1+\varepsilon) \hat{A}_t & \text{if } \hat{A}_t \ge 0 \\ \max(\rho_t, 1-\varepsilon) \hat{A}_t & \text{if } \hat{A}_t < 0 \end{cases}$$

**Proposition 3.7.** *The PPO-Clip objective is a lower bound on the true policy improvement. It prevents the new policy from moving more than $\varepsilon$ in probability ratio from the old policy in any direction that improves the surrogate.*

**Value function loss.** In addition to the policy loss, PPO trains a value function $V_\psi$ to predict the return from each state. This is used both for computing advantages and as a baseline. The value loss is:

$$L^V(\psi) = \frac{1}{2}\mathbb{E}_t\left[(V_\psi(s_t) - \hat{G}_t)^2\right]$$

where $\hat{G}_t = \hat{A}_t + V_{\psi_{\text{old}}}(s_t)$ is the target return.

**Total PPO loss:**

$$L^{\text{PPO}}(\theta, \psi) = -L^{\text{CLIP}}(\theta) + c_1 L^V(\psi) - c_2 H[\pi_\theta]$$

where $H[\pi_\theta] = -\mathbb{E}_t[\sum_a \pi_\theta(a \mid s_t) \log \pi_\theta(a \mid s_t)]$ is an entropy bonus encouraging exploration, and $c_1, c_2$ are hyperparameters.

---

## 4. Algorithmic Derivation

### 4.1 PPO-RLHF Training Algorithm

```
Algorithm: PPO_RLHF
─────────────────────────────────────────────────────────
Input:  SFT model π_ref (frozen), initial policy π_θ ← π_ref
        reward model r_φ (frozen), value model V_ψ (trainable)
        prompts D = {x^(i)}_{i=1}^{N}
        KL coefficient β, clip ε, GAE λ, epochs K
        batch_size B, mini_batch_size M
Output: aligned policy π_θ

1. for iteration = 1 to num_iterations:

   // ── Phase 1: Rollout (data collection) ──────────────
   2. Sample batch of B prompts from D
   3. for each prompt x:
      a. Generate response y ~ π_θ(· | x)    // autoregressive
         Store tokens y_1, ..., y_T
      b. For t = 1 to T:
         Compute log π_θ(y_t | s_t)           // policy log-probs
         Compute log π_ref(y_t | s_t)         // reference log-probs
         Compute V_ψ(s_t)                     // value estimates
      c. Compute reward:
         R = r_φ(x, y)                         // terminal reward

   // ── Phase 2: Compute advantages ────────────────────
   4. for each (x, y) pair:
      a. Compute KL-modified per-token rewards:
         For t = 1 to T:
           r̃_t = -β · (log π_θ(y_t|s_t) - log π_ref(y_t|s_t))
         r̃_T += R                              // add terminal RM reward

      b. Compute GAE advantages:
         Â_T = r̃_T - V_ψ(s_T)
         for t = T-1 down to 1:
           δ_t = r̃_t + V_ψ(s_{t+1}) - V_ψ(s_t)
           Â_t = δ_t + γλ Â_{t+1}             // γ = 1 typically

      c. Compute returns: Ĝ_t = Â_t + V_ψ(s_t)

   // ── Phase 3: PPO update ────────────────────────────
   5. Normalize advantages: Â ← (Â - mean(Â)) / (std(Â) + eps)

   6. for epoch = 1 to K:                     // K = 4 typically
      Shuffle rollout data into mini-batches of size M
      for each mini-batch:

        a. Compute current log-probs: log π_θ(y_t | s_t)  // new
        b. Ratio: ρ_t = exp(log π_θ_new - log π_θ_old)
        c. Clipped surrogate:
           L_clip = min(ρ_t · Â_t, clip(ρ_t, 1-ε, 1+ε) · Â_t)
           L_policy = -mean(L_clip)

        d. Value loss:
           L_value = 0.5 · mean((V_ψ(s_t) - Ĝ_t)^2)

        e. Entropy bonus:
           L_entropy = -mean(H[π_θ(· | s_t)])

        f. Total loss:
           L = L_policy + c_1 · L_value - c_2 · L_entropy

        g. Update:
           BACKWARD(L)
           CLIP_GRAD_NORM(θ, ψ, max_norm=1.0)
           UPDATE(θ, ψ)

7. Return π_θ
```

**Complexity per iteration:**

- **Rollout phase:** $O(B \cdot T)$ forward passes through $\pi_\theta$ (generation) + $O(B \cdot T)$ forward passes through $\pi_{\text{ref}}$ (KL computation) + $O(B)$ forward passes through $r_\phi$ (reward). Total: $O(B \cdot T \cdot C_{\text{fwd}})$ where $C_{\text{fwd}}$ is the cost of a single forward pass.
- **Advantage computation:** $O(B \cdot T)$ --- linear scan.
- **PPO update phase:** $K$ epochs of $\lceil B/M \rceil$ mini-batches, each requiring a forward and backward pass through $\pi_\theta$ and $V_\psi$. Total: $O(K \cdot B \cdot T \cdot C_{\text{fwd+bwd}})$.
- **Memory:** Must store rollout data (token ids, log-probs, values, advantages) for all $B \cdot T$ tokens. Typically $O(B \cdot T \cdot V)$ for logits is too large; we store only the log-probs at the sampled tokens.

### 4.2 GAE Computation (Detailed)

```
Algorithm: ComputeGAE
─────────────────────────────────────────────────────────
Input:  rewards r̃_1, ..., r̃_T (KL-modified)
        values V_1, ..., V_T (from value model)
        γ = 1.0, λ = 0.95
Output: advantages Â_1, ..., Â_T
        returns Ĝ_1, ..., Ĝ_T

1. Set Â_{T+1} = 0

2. For t = T down to 1:
   a. If t = T:
        δ_t = r̃_t - V_t           // no next-state value (terminal)
      Else:
        δ_t = r̃_t + γ V_{t+1} - V_t

   b. Â_t = δ_t + γλ · Â_{t+1}

3. For t = 1 to T:
   Ĝ_t = Â_t + V_t

4. Return Â, Ĝ
```

---

## 5. PyTorch Implementation

```python
"""
PPO-RLHF Training Loop.

Implements the full PPO algorithm for RLHF:
- Rollout (generation + scoring)
- GAE advantage computation
- Clipped policy gradient updates
- Value function training
- KL penalty computation

Requires: torch >= 2.0
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
import math


# ── Data structures ──────────────────────────────────────────────────

@dataclass
class RolloutBuffer:
    """
    Stores rollout data for PPO training.

    All tensors have shape (batch_size, max_seq_len) unless noted.
    """
    input_ids: torch.Tensor        # (B, L) generated token ids
    prompt_lengths: torch.Tensor   # (B,) length of each prompt
    response_lengths: torch.Tensor # (B,) length of each response
    old_log_probs: torch.Tensor    # (B, L) log π_θ_old(y_t | s_t)
    ref_log_probs: torch.Tensor    # (B, L) log π_ref(y_t | s_t)
    values: torch.Tensor           # (B, L) V_ψ(s_t)
    rewards: torch.Tensor          # (B,) r_φ(x, y) terminal rewards
    advantages: torch.Tensor       # (B, L) Â_t (computed post-rollout)
    returns: torch.Tensor          # (B, L) Ĝ_t (computed post-rollout)
    response_mask: torch.Tensor    # (B, L) 1 for response tokens, 0 otherwise


# ── KL Penalty Computation ───────────────────────────────────────────

def compute_kl_penalty(
    log_probs: torch.Tensor,
    ref_log_probs: torch.Tensor,
) -> torch.Tensor:
    """
    Compute per-token KL divergence: log(π_θ / π_ref).

    Args:
        log_probs:     (B, L) log π_θ(y_t | s_t)
        ref_log_probs: (B, L) log π_ref(y_t | s_t)

    Returns:
        kl: (B, L) per-token KL contribution
    """
    kl = log_probs - ref_log_probs       # (B, L)
    return kl


# ── GAE Computation ──────────────────────────────────────────────────

def compute_gae(
    rewards_per_token: torch.Tensor,
    values: torch.Tensor,
    response_mask: torch.Tensor,
    gamma: float = 1.0,
    lam: float = 0.95,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Compute Generalized Advantage Estimation.

    Args:
        rewards_per_token: (B, L) per-token rewards (KL penalty + terminal RM reward)
        values:            (B, L) value estimates V_ψ(s_t)
        response_mask:     (B, L) 1 for response tokens
        gamma:             discount factor (1.0 for language)    (float)
        lam:               GAE lambda (0.95 typical)             (float)

    Returns:
        advantages: (B, L) advantage estimates Â_t
        returns:    (B, L) return targets Ĝ_t = Â_t + V_t
    """
    B, L = values.shape
    advantages = torch.zeros_like(values)                   # (B, L)
    last_gae = torch.zeros(B, device=values.device)         # (B,)

    # Backward pass through time
    for t in reversed(range(L)):
        mask_t = response_mask[:, t]                        # (B,)

        if t == L - 1:
            next_value = torch.zeros(B, device=values.device)  # (B,)
        else:
            next_value = values[:, t + 1]                   # (B,)

        delta = rewards_per_token[:, t] + gamma * next_value - values[:, t]
        # delta shape: (B,)

        last_gae = delta + gamma * lam * last_gae           # (B,)
        last_gae = last_gae * mask_t                        # Zero out non-response

        advantages[:, t] = last_gae                         # (B,)

    returns = advantages + values                            # (B, L)

    return advantages, returns


# ── PPO Loss Functions ───────────────────────────────────────────────

def ppo_policy_loss(
    log_probs: torch.Tensor,
    old_log_probs: torch.Tensor,
    advantages: torch.Tensor,
    mask: torch.Tensor,
    clip_eps: float = 0.2,
) -> torch.Tensor:
    """
    PPO clipped surrogate objective.

    Args:
        log_probs:     (B, L) log π_θ(y_t | s_t) under current policy
        old_log_probs: (B, L) log π_θ_old(y_t | s_t) from rollout
        advantages:    (B, L) normalized advantage estimates
        mask:          (B, L) response mask
        clip_eps:      PPO clipping parameter                    (float)

    Returns:
        loss: scalar (to be minimized, so negated policy objective)
    """
    # Importance sampling ratio
    ratio = torch.exp(log_probs - old_log_probs)            # (B, L)

    # Clipped ratio
    clipped_ratio = torch.clamp(ratio, 1 - clip_eps, 1 + clip_eps)
    # clipped_ratio shape: (B, L)

    # Surrogate objectives
    surr1 = ratio * advantages                               # (B, L)
    surr2 = clipped_ratio * advantages                       # (B, L)

    # Take the minimum (pessimistic bound)
    policy_loss = -torch.min(surr1, surr2)                   # (B, L)

    # Mask and average over response tokens
    policy_loss = (policy_loss * mask).sum() / mask.sum()    # scalar

    return policy_loss


def value_function_loss(
    values: torch.Tensor,
    returns: torch.Tensor,
    old_values: torch.Tensor,
    mask: torch.Tensor,
    clip_eps: float = 0.2,
) -> torch.Tensor:
    """
    Clipped value function loss for PPO.

    Args:
        values:     (B, L) current value estimates V_ψ(s_t)
        returns:    (B, L) target returns Ĝ_t
        old_values: (B, L) old value estimates from rollout
        mask:       (B, L) response mask
        clip_eps:   value clipping parameter                  (float)

    Returns:
        loss: scalar
    """
    # Unclipped value loss
    vf_loss1 = (values - returns) ** 2                       # (B, L)

    # Clipped value loss
    clipped_values = old_values + torch.clamp(
        values - old_values, -clip_eps, clip_eps
    )                                                         # (B, L)
    vf_loss2 = (clipped_values - returns) ** 2               # (B, L)

    # Take the maximum (pessimistic)
    vf_loss = 0.5 * torch.max(vf_loss1, vf_loss2)           # (B, L)

    # Mask and average
    vf_loss = (vf_loss * mask).sum() / mask.sum()            # scalar

    return vf_loss


def entropy_bonus(
    logits: torch.Tensor,
    mask: torch.Tensor,
) -> torch.Tensor:
    """
    Compute entropy of the policy distribution.

    Args:
        logits: (B, L, V) raw logits from the policy
        mask:   (B, L) response mask

    Returns:
        entropy: scalar, mean entropy over response tokens
    """
    probs = F.softmax(logits, dim=-1)                        # (B, L, V)
    log_probs = F.log_softmax(logits, dim=-1)                # (B, L, V)
    ent = -(probs * log_probs).sum(dim=-1)                   # (B, L)
    ent = (ent * mask).sum() / mask.sum()                    # scalar
    return ent


# ── PPO Trainer ──────────────────────────────────────────────────────

class PPOTrainer:
    """
    PPO trainer for RLHF.

    Orchestrates:
    1. Rollout generation (sampling responses from the policy)
    2. Reward computation (scoring with the RM + KL penalty)
    3. Advantage estimation (GAE)
    4. Policy optimization (clipped surrogate)
    5. Value function training

    Args:
        policy_model:  the trainable LM (initially from SFT)
        ref_model:     frozen SFT model for KL computation
        reward_model:  frozen reward model
        value_model:   trainable value head (can share backbone with policy)
        lr:            learning rate                            (float)
        kl_coeff:      KL penalty coefficient β                 (float)
        clip_eps:      PPO clipping parameter ε                 (float)
        gae_lambda:    GAE λ                                    (float)
        vf_coeff:      value loss coefficient c_1               (float)
        ent_coeff:     entropy bonus coefficient c_2            (float)
        ppo_epochs:    number of PPO update epochs K            (int)
        max_grad_norm: gradient clipping threshold              (float)
    """
    def __init__(
        self,
        policy_model: nn.Module,
        ref_model: nn.Module,
        reward_model: nn.Module,
        value_model: nn.Module,
        lr: float = 1e-6,
        kl_coeff: float = 0.1,
        clip_eps: float = 0.2,
        gae_lambda: float = 0.95,
        vf_coeff: float = 0.5,
        ent_coeff: float = 0.01,
        ppo_epochs: int = 4,
        max_grad_norm: float = 1.0,
    ):
        self.policy = policy_model
        self.ref = ref_model
        self.reward_model = reward_model
        self.value_model = value_model

        self.kl_coeff = kl_coeff
        self.clip_eps = clip_eps
        self.gae_lambda = gae_lambda
        self.vf_coeff = vf_coeff
        self.ent_coeff = ent_coeff
        self.ppo_epochs = ppo_epochs
        self.max_grad_norm = max_grad_norm

        # Optimizer for policy and value model
        self.optimizer = torch.optim.AdamW(
            list(self.policy.parameters()) + list(self.value_model.parameters()),
            lr=lr,
        )

    @torch.no_grad()
    def generate_rollout(
        self,
        prompt_ids: torch.Tensor,
        max_new_tokens: int = 128,
        temperature: float = 1.0,
        device: str = 'cpu',
    ) -> RolloutBuffer:
        """
        Generate responses and collect rollout data.

        Args:
            prompt_ids: (B, L_p) prompt token ids
            max_new_tokens: maximum response length            (int)
            temperature: sampling temperature                  (float)
            device: compute device                             (str)

        Returns:
            RolloutBuffer with all rollout data
        """
        self.policy.eval()
        self.ref.eval()

        B, L_p = prompt_ids.shape
        L = L_p + max_new_tokens

        # Storage
        all_ids = prompt_ids.clone().to(device)               # (B, L_p)
        all_log_probs = []
        all_ref_log_probs = []
        all_values = []

        for t in range(max_new_tokens):
            # Policy forward pass
            logits = self.policy(all_ids)                     # (B, curr_len, V)
            next_logits = logits[:, -1, :] / temperature      # (B, V)
            dist = torch.distributions.Categorical(logits=next_logits)
            action = dist.sample()                            # (B,)
            log_prob = dist.log_prob(action)                  # (B,)

            # Reference forward pass
            ref_logits = self.ref(all_ids)                    # (B, curr_len, V)
            ref_next_logits = ref_logits[:, -1, :]            # (B, V)
            ref_dist = torch.distributions.Categorical(logits=ref_next_logits)
            ref_log_prob = ref_dist.log_prob(action)          # (B,)

            # Value estimate
            value = self.value_model(all_ids).squeeze(-1)     # (B,) or (B, L) -> take last
            if value.dim() > 1:
                value = value[:, -1]                          # (B,)

            all_log_probs.append(log_prob)
            all_ref_log_probs.append(ref_log_prob)
            all_values.append(value)

            # Append token
            all_ids = torch.cat([all_ids, action.unsqueeze(1)], dim=1)

        # Stack into tensors
        log_probs = torch.stack(all_log_probs, dim=1)         # (B, T)
        ref_log_probs = torch.stack(all_ref_log_probs, dim=1) # (B, T)
        values = torch.stack(all_values, dim=1)                # (B, T)

        # Create response mask (1 for all generated tokens)
        response_mask = torch.ones(B, max_new_tokens,
                                   device=device)              # (B, T)

        # Compute terminal rewards from RM
        with torch.no_grad():
            rewards = self.reward_model(all_ids)               # (B,)

        # Compute KL-modified per-token rewards
        kl_penalty = compute_kl_penalty(log_probs, ref_log_probs)  # (B, T)
        rewards_per_token = -self.kl_coeff * kl_penalty        # (B, T)
        rewards_per_token[:, -1] += rewards                    # add terminal reward

        # Compute advantages via GAE
        advantages, returns = compute_gae(
            rewards_per_token, values, response_mask,
            gamma=1.0, lam=self.gae_lambda,
        )

        return RolloutBuffer(
            input_ids=all_ids,                                 # (B, L_p + T)
            prompt_lengths=torch.full((B,), L_p),              # (B,)
            response_lengths=torch.full((B,), max_new_tokens), # (B,)
            old_log_probs=log_probs,                           # (B, T)
            ref_log_probs=ref_log_probs,                       # (B, T)
            values=values,                                     # (B, T)
            rewards=rewards,                                   # (B,)
            advantages=advantages,                             # (B, T)
            returns=returns,                                   # (B, T)
            response_mask=response_mask,                       # (B, T)
        )

    def ppo_step(self, rollout: RolloutBuffer) -> Dict[str, float]:
        """
        Perform PPO updates on collected rollout data.

        Args:
            rollout: RolloutBuffer from generate_rollout

        Returns:
            dict with training metrics
        """
        self.policy.train()
        self.value_model.train()

        # Normalize advantages
        adv = rollout.advantages                               # (B, T)
        mask = rollout.response_mask                           # (B, T)
        adv_mean = (adv * mask).sum() / mask.sum()
        adv_std = ((adv - adv_mean).pow(2) * mask).sum() / mask.sum()
        adv_std = adv_std.sqrt() + 1e-8
        adv_normalized = (adv - adv_mean) / adv_std            # (B, T)

        total_policy_loss = 0.0
        total_value_loss = 0.0
        total_entropy = 0.0
        num_updates = 0

        for epoch in range(self.ppo_epochs):
            # Forward pass through policy
            logits = self.policy(rollout.input_ids)            # (B, L, V)

            # Extract response logits
            B = rollout.input_ids.shape[0]
            T = rollout.old_log_probs.shape[1]
            L_p = rollout.prompt_lengths[0].item()

            resp_logits = logits[:, L_p:L_p+T, :]             # (B, T, V)

            # Get log probs for the sampled actions
            resp_ids = rollout.input_ids[:, L_p:L_p+T]        # (B, T)
            dist = torch.distributions.Categorical(logits=resp_logits)
            new_log_probs = dist.log_prob(resp_ids)            # (B, T)

            # Forward pass through value model
            val_out = self.value_model(rollout.input_ids)      # (B, L, 1) or similar
            if val_out.dim() == 3:
                val_out = val_out.squeeze(-1)                  # (B, L)
            new_values = val_out[:, L_p:L_p+T]                # (B, T)

            # Policy loss
            pl = ppo_policy_loss(
                new_log_probs, rollout.old_log_probs,
                adv_normalized, mask, self.clip_eps
            )

            # Value loss
            vl = value_function_loss(
                new_values, rollout.returns,
                rollout.values, mask, self.clip_eps
            )

            # Entropy
            ent = entropy_bonus(resp_logits, mask)

            # Total loss
            loss = pl + self.vf_coeff * vl - self.ent_coeff * ent

            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                list(self.policy.parameters()) +
                list(self.value_model.parameters()),
                self.max_grad_norm
            )
            self.optimizer.step()

            total_policy_loss += pl.item()
            total_value_loss += vl.item()
            total_entropy += ent.item()
            num_updates += 1

        # Compute mean KL divergence
        kl = compute_kl_penalty(
            rollout.old_log_probs, rollout.ref_log_probs
        )                                                      # (B, T)
        mean_kl = (kl * mask).sum() / mask.sum()

        return {
            'policy_loss': total_policy_loss / num_updates,
            'value_loss': total_value_loss / num_updates,
            'entropy': total_entropy / num_updates,
            'mean_kl': mean_kl.item(),
            'mean_reward': rollout.rewards.mean().item(),
        }


# ── Adaptive KL Controller ──────────────────────────────────────────

class AdaptiveKLController:
    """
    Adapts the KL coefficient β to maintain a target KL divergence.

    If the actual KL is too high, increase β (more penalty).
    If too low, decrease β (less penalty).

    Args:
        init_kl_coeff: initial β                    (float)
        target_kl:     target KL divergence          (float)
        horizon:       smoothing horizon              (int)
    """
    def __init__(
        self,
        init_kl_coeff: float = 0.1,
        target_kl: float = 6.0,
        horizon: int = 10000,
    ):
        self.kl_coeff = init_kl_coeff
        self.target_kl = target_kl
        self.horizon = horizon

    def update(self, current_kl: float) -> float:
        """
        Update KL coefficient based on current KL divergence.

        Args:
            current_kl: observed mean KL divergence   (float)

        Returns:
            new kl_coeff                              (float)
        """
        proportional_error = (current_kl - self.target_kl) / self.target_kl
        mult = 1 + proportional_error / self.horizon
        self.kl_coeff *= mult
        self.kl_coeff = max(self.kl_coeff, 1e-6)  # prevent going to zero
        return self.kl_coeff


# ── Demo ─────────────────────────────────────────────────────────────

def demo_ppo_rlhf():
    """
    Demonstrate the PPO-RLHF components on a toy model.
    """
    print("=== PPO-RLHF Demo ===\n")

    # Create toy models
    vocab_size = 100
    d_model = 64
    max_len = 32

    # Minimal model for demonstration
    class TinyLM(nn.Module):
        def __init__(self):
            super().__init__()
            self.emb = nn.Embedding(vocab_size, d_model)
            self.proj = nn.Linear(d_model, vocab_size)

        def forward(self, x):
            h = self.emb(x)            # (B, L, d)
            return self.proj(h)         # (B, L, V)

    class TinyValue(nn.Module):
        def __init__(self):
            super().__init__()
            self.emb = nn.Embedding(vocab_size, d_model)
            self.proj = nn.Linear(d_model, 1)

        def forward(self, x):
            h = self.emb(x)            # (B, L, d)
            return self.proj(h)         # (B, L, 1)

    class TinyRM(nn.Module):
        def __init__(self):
            super().__init__()
            self.emb = nn.Embedding(vocab_size, d_model)
            self.proj = nn.Linear(d_model, 1)

        def forward(self, x):
            h = self.emb(x).mean(dim=1) # (B, d)
            return self.proj(h).squeeze(-1) # (B,)

    import copy
    policy = TinyLM()
    ref = copy.deepcopy(policy)
    for p in ref.parameters():
        p.requires_grad = False
    reward_model = TinyRM()
    for p in reward_model.parameters():
        p.requires_grad = False
    value_model = TinyValue()

    trainer = PPOTrainer(
        policy_model=policy,
        ref_model=ref,
        reward_model=reward_model,
        value_model=value_model,
        lr=1e-4,
        kl_coeff=0.1,
        clip_eps=0.2,
        ppo_epochs=2,
    )

    # Run a few iterations
    for iteration in range(3):
        prompt = torch.randint(1, vocab_size, (4, 8))          # (4, 8)

        rollout = trainer.generate_rollout(
            prompt, max_new_tokens=16, temperature=1.0
        )

        metrics = trainer.ppo_step(rollout)

        print(f"Iteration {iteration+1}:")
        print(f"  Policy loss: {metrics['policy_loss']:.4f}")
        print(f"  Value loss:  {metrics['value_loss']:.4f}")
        print(f"  Mean reward: {metrics['mean_reward']:.4f}")
        print(f"  Mean KL:     {metrics['mean_kl']:.4f}")
        print()


if __name__ == '__main__':
    demo_ppo_rlhf()
```

---

## 6. Experimental Intuition

### 6.1 Key Ablation Results from the Literature

| Factor | Setting A | Setting B | Finding |
|--------|-----------|-----------|---------|
| KL coefficient β | β = 0 (no KL) | β = 0.1 | Without KL, model degenerates after ~100 steps; text becomes repetitive/nonsensical |
| Clip ε | ε = 0.05 (tight) | ε = 0.2 (standard) | Tight clipping slows learning; ε = 0.2 is robust default |
| PPO epochs K | K = 1 | K = 4 | K = 1 wastes rollout data; K > 4 risks stale advantage estimates |
| GAE λ | λ = 0 (TD only) | λ = 0.95 | λ = 0.95 balances bias-variance; λ = 0 has high bias |
| Value function | Separate model | Shared backbone | Shared backbone is more memory efficient; separate gives slight quality edge |
| Generation temperature | T = 0.7 | T = 1.0 | T = 1.0 gives more diverse rollouts; T = 0.7 focuses on likely responses |
| Reward normalization | None | Z-score normalize | Normalization stabilizes training significantly |

### 6.2 Typical Training Dynamics

**Phase 1 (steps 0--200):** Reward increases rapidly as the model learns obvious patterns (formatting, answering directly). KL increases steadily.

**Phase 2 (steps 200--1000):** Reward growth slows. KL reaches the target range. Policy becomes more refined.

**Phase 3 (steps 1000+):** Reward plateaus or oscillates. Risk of reward hacking increases. Monitor the KL and true reward (via human evaluation) closely.

### 6.3 Failure Modes

1. **Mode collapse.** The policy converges to a single response template for all prompts. Symptom: entropy drops to near zero. Fix: increase entropy bonus $c_2$.

2. **KL explosion.** KL diverges from the reference policy. Symptom: responses become incoherent. Fix: increase $\beta$ or use adaptive KL controller.

3. **Reward hacking.** The model exploits the RM's weaknesses (e.g., generating excessively long responses if the RM rewards length). Fix: reward normalization, RM ensembles, KL constraint.

4. **Value function instability.** The value function diverges, causing advantage estimates to be unreliable. Fix: value function clipping, lower learning rate for value head.

5. **Catastrophic forgetting.** The model loses pretrained capabilities. Fix: KL penalty, mix in pretraining data.

### 6.4 Hyperparameter Recommendations

| Parameter | Typical Range | Notes |
|-----------|--------------|-------|
| Learning rate | 1e-6 to 5e-6 | Much lower than SFT |
| KL coefficient β | 0.01 to 0.5 | Use adaptive controller |
| Clip ε | 0.1 to 0.3 | 0.2 is standard |
| GAE λ | 0.9 to 0.99 | 0.95 is standard |
| PPO epochs K | 2 to 6 | 4 is standard |
| Batch size | 32 to 512 prompts | Larger is more stable |
| Generation length | 128 to 1024 | Task-dependent |
| Value coeff c_1 | 0.5 to 1.0 | 0.5 is standard |
| Entropy coeff c_2 | 0.001 to 0.01 | Higher prevents mode collapse |

---

## 7. Connections

### 7.1 Within This Module

- **Lecture 06a (SFT):** SFT provides the initial policy and reference policy for PPO-RLHF. The SFT model's quality directly affects the starting point for RL.
- **Lecture 06b (Reward Modeling):** The reward model provides the training signal for PPO. RM quality is the bottleneck for RLHF quality.
- **Lecture 06d (DPO/SimPO/GRPO):** DPO provides an alternative to PPO that avoids the complexity of RL training. GRPO is a simplified RL approach used by DeepSeek.
- **Recitation 06 (LoRA):** PPO can be performed with LoRA adapters to reduce memory requirements (only the LoRA weights are updated).

### 7.2 To Other Modules

- **Module 00 (Optimization):** PPO is fundamentally an optimization algorithm. The clipping mechanism is related to trust region methods.
- **Module 04/05 (Transformers):** PPO optimizes transformer parameters via policy gradients, requiring careful handling of the autoregressive structure.

---

## 8. Paper Reading List

### Required Reading

1. **Schulman, J., Wolski, F., Dhariwal, P., Radford, A., & Klimov, O.** (2017). "Proximal Policy Optimization Algorithms." *arXiv:1707.06347*.
   - The PPO paper. Introduces the clipped surrogate objective. Clear derivation of why clipping works.

2. **Ouyang, L., Wu, J., Jiang, X., et al.** (2022). "Training language models to follow instructions with human feedback." *NeurIPS 2022*.
   - The InstructGPT paper. Section 3.3 describes the PPO-RLHF training procedure in detail.

3. **Ziegler, D. M., Stiennon, N., Wu, J., et al.** (2019). "Fine-Tuning Language Models from Human Preferences." *arXiv:1909.08593*.
   - The first application of PPO to fine-tune language models from human feedback. Focused on text summarization and stylistic continuation.

### Recommended Reading

4. **Schulman, J., Moritz, P., Levine, S., Jordan, M., & Abbeel, P.** (2015). "High-Dimensional Continuous Control Using Generalized Advantage Estimation." *ICLR 2016*.
   - Introduces GAE. Derives the bias-variance trade-off controlled by λ.

5. **Williams, R. J.** (1992). "Simple statistical gradient-following algorithms for connectionist reinforcement learning." *Machine Learning*, 8(3-4), 229--256.
   - The REINFORCE algorithm. Foundation for all policy gradient methods.

6. **Christiano, P. F., Leike, J., Brown, T., et al.** (2017). "Deep Reinforcement Learning from Human Preferences." *NeurIPS 2017*.
   - The original RLHF paper (applied to Atari and MuJoCo, not language). Establishes the framework of learning reward models from pairwise comparisons and optimizing with RL.

7. **Stiennon, N., Ouyang, L., Wu, J., et al.** (2020). "Learning to Summarize from Human Feedback." *NeurIPS 2020*.
   - Applies RLHF to text summarization with detailed ablations on reward model training and PPO hyperparameters.

---

## 9. Exercises

### Theory Exercises

**Exercise 6c.1.** (REINFORCE derivation) Prove the policy gradient theorem from scratch:

(a) Start from $J(\theta) = \mathbb{E}_{\mathbf{y} \sim \pi_\theta}[r(\mathbf{y})]$ and derive $\nabla_\theta J = \mathbb{E}[r(\mathbf{y}) \nabla_\theta \log \pi_\theta(\mathbf{y})]$.

(b) Show that the baseline $b$ does not introduce bias: $\mathbb{E}[b \nabla_\theta \log \pi_\theta(\mathbf{y})] = 0$.

(c) Derive the variance-minimizing baseline $b^* = \frac{\mathbb{E}[\|\nabla \log \pi\|^2 r]}{\mathbb{E}[\|\nabla \log \pi\|^2]}$.

**Exercise 6c.2.** (PPO clipping analysis) Consider a single state-action pair with advantage $A > 0$ and ratio $\rho$.

(a) Plot the PPO objective $\min(\rho A, \text{clip}(\rho, 1-\varepsilon, 1+\varepsilon) A)$ as a function of $\rho$ for $A = 1$ and $\varepsilon = 0.2$.

(b) Show that the gradient of the clipped objective is zero when $\rho > 1 + \varepsilon$ and $A > 0$. Explain why this prevents excessively large policy updates.

(c) Repeat for $A < 0$ and explain the asymmetry.

**Exercise 6c.3.** (KL-regularized optimal policy) Starting from the objective $J(\pi) = \mathbb{E}_\pi[r(\mathbf{y})] - \beta D_{\text{KL}}(\pi \| \pi_{\text{ref}})$:

(a) Derive the optimal policy $\pi^*(\mathbf{y}) \propto \pi_{\text{ref}}(\mathbf{y}) \exp(r(\mathbf{y}) / \beta)$.

(b) Compute the partition function $Z = \mathbb{E}_{\pi_{\text{ref}}}[\exp(r(\mathbf{y}) / \beta)]$ and show that $\log Z$ is the optimal value of the objective (up to sign and $\beta$).

(c) Derive the relationship $r(\mathbf{y}) = \beta \log \frac{\pi^*(\mathbf{y})}{\pi_{\text{ref}}(\mathbf{y})} + \beta \log Z$. This is the key equation used in DPO (Lecture 06d).

**Exercise 6c.4.** (GAE derivation) Prove the following:

(a) Show that GAE with $\lambda = 0$ gives $\hat{A}_t = \delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)$ (one-step TD).

(b) Show that GAE with $\lambda = 1$ and $\gamma = 1$ gives $\hat{A}_t = G_t - V(s_t)$ (Monte Carlo minus baseline).

(c) Compute $\text{Bias}[\hat{A}_t^{\text{GAE}}]$ and $\text{Var}[\hat{A}_t^{\text{GAE}}]$ as functions of $\lambda$, assuming the value function has approximation error $\epsilon_t = V_\psi(s_t) - V^\pi(s_t)$.

**Exercise 6c.5.** (Per-token KL decomposition) Show that for autoregressive policies:

$$D_{\text{KL}}(\pi_\theta \| \pi_{\text{ref}}) = \mathbb{E}_{\mathbf{y} \sim \pi_\theta}\left[\sum_{t=1}^T D_{\text{KL}}(\pi_\theta(\cdot \mid s_t) \| \pi_{\text{ref}}(\cdot \mid s_t))\right]$$

is **not** true in general. Specifically, show that the per-token KL sum is an upper bound, and give conditions under which it is exact (hint: when the token-level KL divergences are computed under the correct marginal policy).

### Implementation Exercises

**Exercise 6c.6.** Implement a complete PPO-RLHF training pipeline for a small GPT-2 model:

(a) Start with a GPT-2-small model fine-tuned via SFT on a subset of the Anthropic HH-RLHF dataset.

(b) Train a reward model on the comparison data (from Exercise 6b.5).

(c) Run PPO-RLHF for 500 steps. Log and plot: mean reward, KL divergence, policy loss, value loss, entropy.

(d) Compare the RLHF model's outputs to the SFT model's outputs on a set of test prompts. Use GPT-4 to judge which outputs are preferred.

**Exercise 6c.7.** (Ablation study) Using the setup from 6c.6:

(a) Ablate the KL coefficient: $\beta \in \{0, 0.01, 0.1, 0.5, 2.0\}$. For each, plot the reward and KL curves. Identify the optimal $\beta$.

(b) Ablate the clip parameter: $\varepsilon \in \{0.05, 0.1, 0.2, 0.4\}$. Which value gives the most stable training?

(c) Compare PPO with and without GAE (i.e., $\lambda = 0.95$ vs. $\lambda = 1.0$ vs. no advantage normalization).

**Exercise 6c.8.** (Reward hacking investigation)

(a) Train a reward model that has a known bias (e.g., rewards longer responses). Run PPO against this biased RM and measure how response length changes over training.

(b) Implement a reward model ensemble (train 5 RMs with different random seeds). Use the mean of the ensemble as the reward. Compare overoptimization behavior with single-RM vs. ensemble.

(c) Implement the adaptive KL controller and show that it maintains the target KL even as training progresses.

---

*Next: Lecture 06d --- DPO, SimPO, and GRPO*
