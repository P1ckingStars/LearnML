# Lecture 10c: Test-Time Compute Scaling

## 1. Learning Objectives

By the end of this lecture, you will be able to:

1. **Formalize** the test-time compute scaling paradigm and contrast it with train-time scaling.
2. **Derive** the compute-optimal inference allocation problem: when to invest in more thinking vs. using a larger model.
3. **Analyze** best-of-N sampling with reward model scoring, including its sample complexity and failure modes.
4. **Design** process reward models (PRMs) for step-level verification and prove their advantage over outcome reward models (ORMs).
5. **Implement** Monte Carlo Tree Search (MCTS) for LLM reasoning.
6. **State** inference scaling laws and their implications for system design.

---

## 2. Motivation and Context

### 2.1 The Inference Scaling Hypothesis

Train-time scaling laws (Kaplan et al., 2020; Hoffmann et al., 2022) established that larger models trained on more data perform better. But what about **inference time**? Can we improve performance by spending more compute at test time, without changing the model?

The answer is yes, and the implications are profound:

- A smaller model with more test-time compute can match a larger model with less.
- This creates a **compute-performance tradeoff** at inference time, analogous to the train-time tradeoff.
- System designers can dynamically allocate compute based on problem difficulty.

### 2.2 Forms of Test-Time Compute

Test-time compute can be spent in several ways:

1. **Sampling**: Generate multiple candidate answers and select the best (best-of-N).
2. **Verification**: Use a reward model to score and filter candidates.
3. **Search**: Systematically explore reasoning paths (MCTS, beam search).
4. **Iterative refinement**: Generate, critique, and revise answers.
5. **Chain-of-thought**: Generate longer reasoning traces (covered in Lecture 10b).

### 2.3 Why This Matters Now

As models approach the frontier of train-time scaling (diminishing returns per FLOP), test-time compute becomes the primary lever for improvement. This shifts the economics of AI: instead of training ever-larger models, we can deploy moderately-sized models with adaptive inference budgets.

---

## 3. Core Theory

### 3.1 The Compute-Optimal Inference Problem

**Definition 3.1 (Test-Time Compute Budget).** Given a fixed inference FLOP budget $C_{\text{infer}}$, we seek to maximize task performance:

$$\max_{\theta, \mathcal{S}} \; \mathbb{E}_{q \sim \mathcal{Q}} \left[ \text{Quality}(\mathcal{S}(q; M_\theta), q) \right] \quad \text{s.t.} \quad \text{FLOPs}(\mathcal{S}(q; M_\theta)) \leq C_{\text{infer}}$$

where $M_\theta$ is a model with parameters $\theta$ (determining model size) and $\mathcal{S}$ is the inference strategy (how many samples, search depth, etc.).

**Proposition 3.2 (Compute Allocation Tradeoff).** Let $C_{\text{total}} = C_{\text{model}} + C_{\text{strategy}}$ where $C_{\text{model}}$ is the per-forward-pass cost (proportional to model size) and $C_{\text{strategy}}$ is the overhead of the inference strategy. For a fixed $C_{\text{total}}$:

- Larger model ($C_{\text{model}} \uparrow$, $C_{\text{strategy}} \downarrow$): fewer inference steps but each step is more powerful.
- Smaller model ($C_{\text{model}} \downarrow$, $C_{\text{strategy}} \uparrow$): more inference steps but each step is weaker.

The optimal allocation depends on the problem difficulty and the scaling behavior of each component.

**Theorem 3.3 (Compute-Optimal Inference, Snell et al. 2024, informal).** There exists a crossover point: for problems below a certain difficulty threshold, test-time compute scaling with a smaller model is more efficient than using a larger model. For problems above this threshold, the larger model is preferred.

*Argument.* Let $q(M, N)$ denote the quality of model $M$ with $N$ samples (best-of-N). Empirically:

$$q(M, N) \approx q_0(M) + \alpha(M) \cdot \log N$$

where $q_0(M)$ is the baseline quality and $\alpha(M)$ is the scaling rate. The total compute is $C = c(M) \cdot N$ where $c(M)$ is the per-sample cost.

For a fixed budget $C$: $N = C / c(M)$, so:

$$q(M, C) = q_0(M) + \alpha(M) \cdot \log(C / c(M))$$

A smaller model $M_s$ beats a larger model $M_l$ when:

$$q_0(M_s) + \alpha(M_s) \cdot \log(C / c(M_s)) > q_0(M_l) + \alpha(M_l) \cdot \log(C / c(M_l))$$

Since $q_0(M_l) > q_0(M_s)$ but $c(M_s) < c(M_l)$, this inequality holds for moderate $C$ when the quality gap $q_0(M_l) - q_0(M_s)$ is small relative to the compute advantage $\log(c(M_l)/c(M_s))$. $\square$

### 3.2 Best-of-N Sampling

**Definition 3.4 (Best-of-N).** Generate $N$ independent responses $\{y_1, \ldots, y_N\}$ from the model, score each with a reward model $R$, and select the best:

$$\hat{y} = \arg\max_{y_i} R(q, y_i)$$

**Theorem 3.5 (Expected Maximum of IID Samples).** Let $Y_1, \ldots, Y_N$ be IID random variables drawn from a distribution with CDF $F$ and PDF $f$. The expected value of $Y_{(N)} = \max_i Y_i$ is:

$$\mathbb{E}[Y_{(N)}] = \int_{-\infty}^{\infty} y \cdot N \cdot F(y)^{N-1} \cdot f(y) \, dy$$

*Proof.* The CDF of $Y_{(N)}$ is $P(Y_{(N)} \leq y) = F(y)^N$ (since all samples must be $\leq y$). Differentiating: $f_{Y_{(N)}}(y) = N F(y)^{N-1} f(y)$. The expectation follows by the standard formula $\mathbb{E}[X] = \int x f_X(x) dx$. $\square$

**Corollary 3.6 (Gaussian Reward Scaling).** If $R(q, y_i) \sim \mathcal{N}(\mu, \sigma^2)$, then:

$$\mathbb{E}[Y_{(N)}] \approx \mu + \sigma \cdot \Phi^{-1}\left(\frac{N}{N+1}\right) \approx \mu + \sigma \sqrt{2 \ln N}$$

for large $N$, where $\Phi^{-1}$ is the inverse standard normal CDF. This gives a **logarithmic** improvement in reward with $N$.

*Proof.* For the standard normal distribution, the expected maximum of $N$ samples satisfies $\mathbb{E}[Z_{(N)}] \sim \sqrt{2 \ln N}$ as $N \to \infty$ (a classical result from extreme value theory). Scaling by $\sigma$ and shifting by $\mu$ gives the result. $\square$

**Proposition 3.7 (Reward Hacking in Best-of-N).** Let $R$ be an imperfect reward model with error $\epsilon(y) = R(y) - R^*(y)$ where $R^*$ is the true reward. As $N$ increases, the selected sample maximizes $R^*(y) + \epsilon(y)$, and the contribution of $\epsilon$ grows:

$$\mathbb{E}[\epsilon(\hat{y}_N)] = \Theta(\sigma_\epsilon \sqrt{2 \ln N})$$

where $\sigma_\epsilon$ is the standard deviation of the reward model's error. This means best-of-N increasingly exploits reward model errors as $N$ grows.

*Proof.* The selected sample maximizes $R(y) = R^*(y) + \epsilon(y)$. If $R^*$ and $\epsilon$ are independent Gaussians (an approximation), the maximum of $R$ over $N$ samples grows as $\sqrt{2 \ln N}$ in both the true reward and error components by Corollary 3.6. $\square$

**Remark.** This is a form of Goodhart's Law: "When a measure becomes a target, it ceases to be a good measure." Reward hacking limits the practical value of very large $N$.

### 3.3 Process Reward Models

**Definition 3.8 (Outcome Reward Model, ORM).** An ORM scores the final answer only:

$$R_{\text{ORM}}(q, y) = P(\text{correct} | q, y)$$

**Definition 3.9 (Process Reward Model, PRM).** A PRM scores each intermediate step:

$$R_{\text{PRM}}(q, s_1, \ldots, s_m) = \prod_{i=1}^{m} P(\text{step } s_i \text{ correct} | q, s_1, \ldots, s_{i-1})$$

or equivalently:

$$\log R_{\text{PRM}} = \sum_{i=1}^{m} \log P(\text{step } s_i \text{ correct} | q, s_1, \ldots, s_{i-1})$$

**Theorem 3.10 (PRM Advantage, Lightman et al. 2023).** Under mild conditions, PRMs provide a tighter signal than ORMs:

1. **Earlier error detection**: PRM detects errors at the step where they occur, not just at the final answer.
2. **Credit assignment**: PRM identifies which step went wrong, enabling targeted correction.
3. **Search guidance**: PRM scores provide heuristics for tree search (evaluate partial solutions).

*Formal argument for (1).* Consider a reasoning chain $(s_1, \ldots, s_m)$ where step $s_j$ is the first error. The ORM evaluates $R_{\text{ORM}}(q, \text{final answer})$, which may still be high if subsequent steps happen to compensate. The PRM evaluates each step independently, so $P(\text{step } s_j \text{ correct} | \ldots) < \tau$ for threshold $\tau$, detecting the error at step $j$.

The probability that ORM misses the error (incorrect step but correct final answer) is:

$$P_{\text{miss}} = P(\text{final correct} | \text{step } j \text{ wrong}) > 0$$

while PRM's miss probability at step $j$ is 0 (assuming a perfect PRM). In practice, PRMs are imperfect, but the signal is strictly more informative. $\square$

### 3.4 Training Process Reward Models

**Data Collection.** Lightman et al. (2023) propose two approaches:

1. **Human labeling**: Annotators label each step as correct/incorrect/neutral. Expensive but high quality.

2. **Automated labeling via rollouts**: For each step $s_i$ in a chain:
   - Complete the chain multiple times from step $s_i$ (rollouts)
   - Estimate $P(\text{correct final answer} | s_1, \ldots, s_i) \approx \frac{\text{correct rollouts}}{\text{total rollouts}}$
   - If this probability drops significantly at step $i$ compared to step $i-1$, step $i$ is likely wrong

**Definition 3.11 (Rollout-Based PRM Label).** The step-level label for step $s_i$ is:

$$\ell_i = \begin{cases} 1 & \text{if } \hat{P}_i - \hat{P}_{i-1} \geq -\delta \\ 0 & \text{if } \hat{P}_i - \hat{P}_{i-1} < -\delta \end{cases}$$

where $\hat{P}_i = \frac{1}{K}\sum_{k=1}^K \mathbb{1}[\text{rollout } k \text{ from } s_i \text{ is correct}]$ and $\delta$ is a tolerance.

**PRM Training Objective.** Given labeled step data $\{(q, s_1, \ldots, s_m, \ell_1, \ldots, \ell_m)\}$:

$$\mathcal{L}_{\text{PRM}} = -\frac{1}{M} \sum_{j=1}^{M} \sum_{i=1}^{m_j} \left[ \ell_i \log \hat{p}_i + (1 - \ell_i) \log(1 - \hat{p}_i) \right]$$

where $\hat{p}_i = R_\theta(q, s_1, \ldots, s_i)$ is the PRM's predicted probability that step $i$ is correct.

### 3.5 MCTS for LLM Reasoning

Monte Carlo Tree Search adapts naturally to LLM reasoning by treating thought generation as a sequential decision process.

**Definition 3.12 (MCTS for Reasoning).** The MCTS tree is defined as:

- **State**: partial reasoning chain $(s_1, \ldots, s_i)$
- **Action**: generate the next reasoning step $s_{i+1}$
- **Reward**: PRM score or final answer correctness
- **Terminal**: chain reaches a final answer or max depth

The four MCTS phases:

**1. Selection.** Starting from root, traverse the tree using the UCB1 (Upper Confidence Bound) policy:

$$a^* = \arg\max_a \left[ Q(s, a) + c \sqrt{\frac{\ln N(s)}{N(s, a)}} \right]$$

where:

- $Q(s, a)$: average reward of simulations through $(s, a)$
- $N(s)$: visit count of state $s$
- $N(s, a)$: visit count of edge $(s, a)$
- $c$: exploration constant (typically $\sqrt{2}$)

**2. Expansion.** When reaching a leaf node, generate $k$ candidate next steps using the LLM.

**3. Simulation (Rollout).** From the expanded node, complete the reasoning chain (either with the LLM or a fast rollout policy) and evaluate the final answer.

**4. Backpropagation.** Update $Q$ and $N$ values along the path from the expanded node to the root.

**Theorem 3.13 (UCB1 Regret Bound).** The UCB1 policy achieves logarithmic regret. After $T$ total simulations:

$$\text{Regret}(T) \leq 8 \sum_{a: \mu_a < \mu^*} \frac{\ln T}{\Delta_a} + (1 + \frac{\pi^2}{3}) \sum_a \Delta_a$$

where $\mu_a$ is the true mean reward of action $a$, $\mu^*$ is the optimal mean reward, and $\Delta_a = \mu^* - \mu_a$.

*Proof (sketch, Auer et al. 2002).* The UCB1 bound ensures that suboptimal actions are selected at most $O(\ln T / \Delta_a^2)$ times. A suboptimal action $a$ is selected only when $Q(s,a) + c\sqrt{\ln N(s)/N(s,a)} \geq Q(s, a^*) + c\sqrt{\ln N(s)/N(s, a^*)}$. Since the confidence intervals shrink as $1/\sqrt{N}$, the number of times this can happen before the intervals separate is bounded by $O(\ln T / \Delta_a^2)$. Summing the per-step regret $\Delta_a$ over these selections gives the result. $\square$

### 3.6 Inference Scaling Laws

**Definition 3.14 (Inference Scaling Law).** An inference scaling law characterizes performance as a function of test-time compute $C_{\text{test}}$:

$$\text{Performance}(C_{\text{test}}) = a - b \cdot C_{\text{test}}^{-\alpha}$$

where $a$ is the asymptotic performance, $b$ is a constant, and $\alpha > 0$ is the scaling exponent.

**Empirical Findings (Snell et al., 2024; Brown et al., 2024):**

1. **Best-of-N scaling**: Performance improves as $\Theta(\log N)$ in the number of samples.

2. **Search scaling**: MCTS-based methods scale as $\Theta(C_{\text{test}}^{\alpha})$ with $\alpha \approx 0.3\text{--}0.5$ depending on the task and reward model quality.

3. **Difficulty-dependent scaling**: Easy problems saturate quickly; hard problems benefit more from additional compute but may never be solved.

**Theorem 3.15 (Diminishing Returns with Imperfect Verifier).** Let $R$ be a reward model with accuracy $p_v$ (probability of correctly ranking a better solution above a worse one). The probability that best-of-N with this verifier selects a correct answer converges to:

$$P_{\text{correct}}(N) \to p_v \quad \text{as } N \to \infty$$

if the model generates the correct answer with probability $p_g > 0$ for any $N$, but the verifier cannot distinguish it from incorrect answers with probability $1 - p_v$.

*Proof.* As $N \to \infty$, the sample set almost surely contains a correct answer (since $p_g > 0$). However, the verifier selects the correct one only with probability $\to p_v$ because the ranking is imperfect. More precisely, let the correct answer have reward $r^+$ and the best incorrect answer have reward $r^-$. As $N$ grows, $r^-$ increases (more diverse incorrect answers to choose from), so the verifier's job becomes harder. In the limit, the verifier's accuracy at distinguishing correct from best-incorrect converges to its inherent discrimination ability $p_v$. $\square$

**Corollary 3.16.** To improve beyond the verifier's accuracy ceiling, one must improve the verifier itself, not just sample more. This motivates iterative improvement: better verifier $\to$ better search $\to$ better training data $\to$ better verifier.

### 3.7 Compute-Optimal Allocation with PRM

**Proposition 3.17 (PRM-Guided Search vs. Best-of-N).** Consider two strategies with the same total compute budget $C$:

1. **Best-of-N**: Generate $N = C / c_{\text{gen}}$ complete solutions, score with ORM, select best.
2. **PRM-guided search**: Generate partial solutions, score steps with PRM, prune and branch.

Let $D$ be the problem difficulty (number of steps where errors can occur) and $p_s$ be the per-step success probability. Then:

- Best-of-N succeeds with probability $\approx 1 - (1 - p_s^D)^N$
- PRM-guided search (with perfect PRM) succeeds with probability $\approx 1 - (1 - p_s)^{N \cdot D}$

For $D > 1$ and $p_s < 1$, PRM-guided search is strictly more efficient because it can independently retry each step rather than restarting from scratch.

*Proof.* For best-of-N, each complete chain succeeds with probability $p_s^D$ (all steps correct), so $N$ trials give success probability $1 - (1 - p_s^D)^N$.

For PRM-guided search, at each step we can try $N_{\text{per-step}}$ candidates and proceed with any correct one. The probability of getting at least one correct candidate at any step is $1 - (1 - p_s)^{N_{\text{per-step}}}$. With total budget spread across $D$ steps, $N_{\text{per-step}} = N \cdot c_{\text{gen}} / (D \cdot c_{\text{step}})$. Even with equal per-step budget, the success probability at each step is $1 - (1 - p_s)^{N/D}$, and the overall success is $[1 - (1-p_s)^{N/D}]^D$.

For $p_s = 0.8$, $D = 5$, $N = 50$:

- Best-of-N: $1 - (1 - 0.8^5)^{50} = 1 - (1-0.328)^{50} = 1.0$ (already saturated)
- But with $p_s = 0.3$, $D = 10$, $N = 20$:
  - Best-of-N: $1 - (1 - 0.3^{10})^{20} = 1 - (1 - 5.9 \times 10^{-6})^{20} \approx 1.2 \times 10^{-4}$
  - PRM-guided: $[1 - (1-0.3)^{2}]^{10} = [0.51]^{10} \approx 0.0012$

The advantage grows exponentially with $D$. $\square$

---

## 4. Algorithmic Derivation

### 4.1 Best-of-N with Reward Model

```
Algorithm: Best-of-N Sampling
Input: question q, model M, reward model R, num_samples N, temperature T
Output: best response y*

candidates ← []

for i = 1 to N:                                          // O(N)
    y_i ← M.generate(q, temperature=T)                   // O(L * d_model)
    score_i ← R(q, y_i)                                  // O(L * d_model) for RM
    candidates.append((y_i, score_i))

y* ← argmax_{(y, s) in candidates} s                     // O(N)

return y*

// Total: O(N * L * d_model) for generation + O(N * L * d_model) for scoring
// Can be parallelized across N samples
```

### 4.2 MCTS for Reasoning

```
Algorithm: MCTS-Reasoning
Input: question q, LLM M, PRM R, num_simulations S
Hyperparameters: exploration constant c, branching factor b, max_depth D
Output: best reasoning chain

// Initialize tree
root ← Node(state = q, visits = 0, value = 0)

for sim = 1 to S:
    node ← root

    // Phase 1: Selection (traverse to leaf using UCB1)
    while node is not leaf and node.depth < D:
        node ← argmax_{child} UCB1(child, c)              // O(b)

    // Phase 2: Expansion
    if node.visits > 0 and node.depth < D:
        for j = 1 to b:
            step_j ← M.generate_step(node.state)          // O(L_step * d_model)
            prm_score ← R(node.state, step_j)             // O(L * d_model)
            child ← Node(
                state = node.state + step_j,
                visits = 0,
                value = prm_score,
                parent = node
            )
            node.children.append(child)
        node ← best child by prm_score

    // Phase 3: Simulation (rollout)
    rollout_state ← node.state
    for depth = node.depth to D:
        step ← M.generate_step(rollout_state, greedy=True) // O(L_step * d_model)
        rollout_state ← rollout_state + step
        if is_terminal(rollout_state):
            break
    reward ← evaluate_answer(rollout_state, q)             // 0 or 1

    // Phase 4: Backpropagation
    while node is not None:
        node.visits += 1
        node.value += (reward - node.value) / node.visits   // Running mean
        node ← node.parent

// Return best chain (most-visited child at root)
best_child ← argmax_{child of root} child.visits
return reconstruct_chain(best_child)

// Complexity per simulation: O(D * (b + 1) * L * d_model) for LLM calls
// Total: O(S * D * b * L * d_model)
```

### 4.3 Iterative Refinement

```
Algorithm: Iterative Refinement with Reward Model
Input: question q, model M, reward model R, max_iterations I
Output: refined answer y*

y_0 ← M.generate(q)                                      // Initial answer
score_0 ← R(q, y_0)

for iter = 1 to I:
    // Generate critique
    critique ← M.generate(                                // O(L * d_model)
        f"Question: {q}\nAnswer: {y_{iter-1}}\n"
        f"What are the errors or weaknesses in this answer?"
    )

    // Generate refined answer
    y_iter ← M.generate(                                  // O(L * d_model)
        f"Question: {q}\nPrevious answer: {y_{iter-1}}\n"
        f"Critique: {critique}\n"
        f"Provide an improved answer:"
    )

    score_iter ← R(q, y_iter)                             // O(L * d_model)

    // Only keep if improved
    if score_iter <= score_{iter-1}:
        break                                             // Convergence

return best y_i by score

// Total: O(I * L * d_model) per iteration, up to I iterations
```

---

## 5. PyTorch Implementation

### 5.1 Best-of-N with Reward Model

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from dataclasses import dataclass
from typing import Callable, Optional
import math

class RewardModel(nn.Module):
    """
    Reward model that scores (question, answer) pairs.

    Architecture: Transformer encoder with a scalar head.
    Input: [CLS] question [SEP] answer [SEP] -> scalar score

    This serves as both an ORM (when scoring complete answers)
    and the backbone for a PRM (when scoring partial chains).
    """
    def __init__(
        self,
        vocab_size: int = 30522,
        d_model: int = 768,
        n_heads: int = 12,
        n_layers: int = 12,
        max_len: int = 1024,
    ):
        super().__init__()
        self.d_model = d_model

        self.token_embed = nn.Embedding(vocab_size, d_model)     # [V, d]
        self.pos_embed = nn.Embedding(max_len, d_model)          # [L, d]

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=4 * d_model,
            batch_first=True,
            dropout=0.1,
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=n_layers
        )

        self.reward_head = nn.Sequential(
            nn.Linear(d_model, d_model),
            nn.GELU(),
            nn.Linear(d_model, 1),
        )

    def forward(
        self,
        input_ids: torch.Tensor,        # [B, L]
        attention_mask: torch.Tensor,    # [B, L]
    ) -> torch.Tensor:                   # [B]
        """Compute scalar reward for each input."""
        B, L = input_ids.shape
        positions = torch.arange(L, device=input_ids.device)

        x = self.token_embed(input_ids) + self.pos_embed(positions)  # [B, L, d]
        padding_mask = ~attention_mask.bool()                         # [B, L]
        x = self.encoder(x, src_key_padding_mask=padding_mask)       # [B, L, d]

        # CLS token representation
        cls_repr = x[:, 0, :]                                        # [B, d]
        reward = self.reward_head(cls_repr).squeeze(-1)               # [B]

        return reward

class ProcessRewardModel(nn.Module):
    """
    Process Reward Model: scores each reasoning step individually.

    For a chain (q, s_1, s_2, ..., s_m), produces scores
    (p_1, p_2, ..., p_m) where p_i = P(step s_i is correct | q, s_1, ..., s_i).

    Architecture: Transformer with per-step classification heads.
    We place a [STEP] token between reasoning steps and extract
    representations at these positions.
    """
    def __init__(
        self,
        vocab_size: int = 30522,
        d_model: int = 768,
        n_heads: int = 12,
        n_layers: int = 12,
        max_len: int = 2048,
        step_token_id: int = 30521,     # Reserved token for [STEP]
    ):
        super().__init__()
        self.step_token_id = step_token_id

        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed = nn.Embedding(max_len, d_model)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=n_heads,
            dim_feedforward=4 * d_model,
            batch_first=True,
        )
        self.encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=n_layers
        )

        # Binary classifier for each step: correct / incorrect
        self.step_classifier = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Linear(d_model // 2, 1),
        )

    def forward(
        self,
        input_ids: torch.Tensor,        # [B, L]
        attention_mask: torch.Tensor,    # [B, L]
    ) -> torch.Tensor:                   # [B, max_steps]
        """
        Score each reasoning step.

        Returns a tensor of shape [B, max_steps] with the probability
        that each step is correct. Steps beyond the actual number
        are masked with -inf.
        """
        B, L = input_ids.shape
        positions = torch.arange(L, device=input_ids.device)

        x = self.token_embed(input_ids) + self.pos_embed(positions)  # [B, L, d]
        padding_mask = ~attention_mask.bool()
        x = self.encoder(x, src_key_padding_mask=padding_mask)       # [B, L, d]

        # Find [STEP] token positions
        step_mask = (input_ids == self.step_token_id)                 # [B, L]

        # Extract representations at step positions
        # Gather step representations
        step_scores_list = []
        for b in range(B):
            step_positions = step_mask[b].nonzero(as_tuple=True)[0]   # [num_steps]
            if len(step_positions) > 0:
                step_reprs = x[b, step_positions, :]                  # [num_steps, d]
                scores = self.step_classifier(step_reprs).squeeze(-1) # [num_steps]
                step_scores_list.append(scores)
            else:
                step_scores_list.append(torch.tensor([], device=x.device))

        # Pad to same length
        max_steps = max(len(s) for s in step_scores_list) if step_scores_list else 0
        if max_steps == 0:
            return torch.zeros(B, 1, device=x.device)

        padded = torch.full((B, max_steps), float('-inf'), device=x.device)
        for b, scores in enumerate(step_scores_list):
            if len(scores) > 0:
                padded[b, :len(scores)] = scores

        return torch.sigmoid(padded)                                  # [B, max_steps]

    def compute_chain_score(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> torch.Tensor:                   # [B]
        """
        Compute aggregate chain score as product of step scores.
        log P(chain correct) = sum_i log P(step_i correct)
        """
        step_probs = self.forward(input_ids, attention_mask)         # [B, max_steps]

        # Mask out padding (where prob = sigmoid(-inf) ≈ 0)
        valid_mask = step_probs > 0.01                                # [B, max_steps]
        log_probs = torch.log(step_probs + 1e-10) * valid_mask       # [B, max_steps]
        chain_log_score = log_probs.sum(dim=-1)                       # [B]

        return chain_log_score

class BestOfN:
    """
    Best-of-N sampling with reward model scoring.

    Generates N candidate responses and selects the highest-scoring one.
    Supports both ORM and PRM scoring.
    """
    def __init__(
        self,
        generator: Callable,          # (prompt, temperature) -> str
        reward_model: nn.Module,       # RewardModel or ProcessRewardModel
        tokenizer: Callable,           # str -> (input_ids, attention_mask)
        n_samples: int = 16,
        temperature: float = 0.8,
        use_prm: bool = False,
    ):
        self.generator = generator
        self.reward_model = reward_model
        self.tokenizer = tokenizer
        self.n_samples = n_samples
        self.temperature = temperature
        self.use_prm = use_prm

    @torch.no_grad()
    def __call__(self, question: str) -> dict:
        """
        Generate N samples, score, and return the best.

        Returns dict with:
            - 'answer': best answer text
            - 'score': reward model score
            - 'all_scores': list of all scores
            - 'all_answers': list of all answers
        """
        answers = []
        scores = []

        for i in range(self.n_samples):
            # Generate candidate
            answer = self.generator(question, temperature=self.temperature)
            answers.append(answer)

            # Score
            text = f"[CLS] {question} [SEP] {answer} [SEP]"
            input_ids, attention_mask = self.tokenizer(text)

            if self.use_prm:
                score = self.reward_model.compute_chain_score(
                    input_ids.unsqueeze(0), attention_mask.unsqueeze(0)
                ).item()
            else:
                score = self.reward_model(
                    input_ids.unsqueeze(0), attention_mask.unsqueeze(0)
                ).item()

            scores.append(score)

        # Select best
        best_idx = max(range(len(scores)), key=lambda i: scores[i])

        return {
            "answer": answers[best_idx],
            "score": scores[best_idx],
            "all_scores": scores,
            "all_answers": answers,
        }
```

### 5.2 MCTS for Reasoning

```python
import math
import random
from dataclasses import dataclass, field
from typing import Callable, Optional

@dataclass
class MCTSNode:
    """Node in the MCTS reasoning tree."""
    state: str                                   # Partial reasoning chain
    parent: Optional['MCTSNode'] = None
    children: list['MCTSNode'] = field(default_factory=list)
    visits: int = 0
    total_reward: float = 0.0
    prior: float = 0.0                           # PRM score as prior
    depth: int = 0

    @property
    def q_value(self) -> float:
        """Average reward (exploitation term)."""
        if self.visits == 0:
            return 0.0
        return self.total_reward / self.visits

    def ucb1(self, c: float = 1.414) -> float:
        """
        UCB1 score: Q(s,a) + c * sqrt(ln N(parent) / N(s,a))

        Balances exploitation (high Q) with exploration (low visits).
        """
        if self.visits == 0:
            return float('inf')
        exploitation = self.q_value
        exploration = c * math.sqrt(math.log(self.parent.visits) / self.visits)
        return exploitation + exploration

    def puct(self, c: float = 1.0) -> float:
        """
        PUCT score (Polynomial Upper Confidence Trees, used in AlphaZero).
        Incorporates the prior (PRM score) into exploration.

        PUCT(s,a) = Q(s,a) + c * prior * sqrt(N(parent)) / (1 + N(s,a))
        """
        if self.parent is None:
            return 0.0
        exploitation = self.q_value
        exploration = c * self.prior * math.sqrt(self.parent.visits) / (1 + self.visits)
        return exploitation + exploration

class MCTSReasoner:
    """
    Monte Carlo Tree Search for LLM reasoning.

    Uses a PRM to guide search over reasoning steps.
    Each node represents a partial reasoning chain;
    actions are individual reasoning steps.
    """
    def __init__(
        self,
        step_generator: Callable,      # (state) -> list[str] (candidate steps)
        step_scorer: Callable,          # (state, step) -> float (PRM score)
        rollout_fn: Callable,           # (state) -> float (complete and evaluate)
        is_terminal: Callable,          # (state) -> bool
        num_simulations: int = 100,
        max_depth: int = 10,
        branching_factor: int = 5,
        exploration_constant: float = 1.414,
        use_puct: bool = True,
    ):
        self.step_generator = step_generator
        self.step_scorer = step_scorer
        self.rollout_fn = rollout_fn
        self.is_terminal = is_terminal
        self.num_simulations = num_simulations
        self.max_depth = max_depth
        self.branching_factor = branching_factor
        self.c = exploration_constant
        self.use_puct = use_puct

        # Statistics
        self.stats = {
            "total_simulations": 0,
            "total_expansions": 0,
            "max_depth_reached": 0,
        }

    def _select(self, node: MCTSNode) -> MCTSNode:
        """
        Phase 1: Selection.
        Traverse from root to a leaf using UCB1/PUCT.
        """
        while node.children and not self.is_terminal(node.state):
            if self.use_puct:
                node = max(node.children, key=lambda c: c.puct(self.c))
            else:
                node = max(node.children, key=lambda c: c.ucb1(self.c))
        return node

    def _expand(self, node: MCTSNode) -> MCTSNode:
        """
        Phase 2: Expansion.
        Generate candidate next steps and add as children.
        """
        if self.is_terminal(node.state) or node.depth >= self.max_depth:
            return node

        # Generate candidate steps
        candidates = self.step_generator(node.state)
        candidates = candidates[:self.branching_factor]
        self.stats["total_expansions"] += 1

        for step_text in candidates:
            new_state = f"{node.state}\n{step_text}"
            prior = self.step_scorer(node.state, step_text)

            child = MCTSNode(
                state=new_state,
                parent=node,
                prior=prior,
                depth=node.depth + 1,
            )
            node.children.append(child)

        # Return the most promising child for simulation
        if node.children:
            best_child = max(node.children, key=lambda c: c.prior)
            self.stats["max_depth_reached"] = max(
                self.stats["max_depth_reached"], best_child.depth
            )
            return best_child
        return node

    def _simulate(self, node: MCTSNode) -> float:
        """
        Phase 3: Simulation (rollout).
        Complete the reasoning chain and evaluate.
        """
        return self.rollout_fn(node.state)

    def _backpropagate(self, node: MCTSNode, reward: float):
        """
        Phase 4: Backpropagation.
        Update visit counts and values from leaf to root.
        """
        while node is not None:
            node.visits += 1
            node.total_reward += reward
            node = node.parent

    def search(self, question: str) -> dict:
        """
        Run MCTS from the question.

        Returns:
            dict with:
                - 'answer': best reasoning chain
                - 'visits': visit distribution over first-level actions
                - 'stats': search statistics
        """
        root = MCTSNode(state=question, depth=0)
        self.stats = {
            "total_simulations": 0,
            "total_expansions": 0,
            "max_depth_reached": 0,
        }

        for sim in range(self.num_simulations):
            # Selection
            leaf = self._select(root)

            # Expansion (only if not terminal and has been visited)
            if leaf.visits > 0 or leaf == root:
                leaf = self._expand(leaf)

            # Simulation
            reward = self._simulate(leaf)

            # Backpropagation
            self._backpropagate(leaf, reward)

            self.stats["total_simulations"] += 1

        # Select best action (most visited child of root)
        if not root.children:
            return {"answer": question, "stats": self.stats}

        best_child = max(root.children, key=lambda c: c.visits)

        # Reconstruct full chain by following most-visited path
        chain = self._get_best_chain(best_child)

        return {
            "answer": chain,
            "value": best_child.q_value,
            "visits_distribution": [
                (c.state.split('\n')[-1], c.visits, c.q_value)
                for c in root.children
            ],
            "stats": self.stats,
        }

    def _get_best_chain(self, node: MCTSNode) -> str:
        """Follow the most-visited path from a node to a terminal."""
        current = node
        while current.children:
            current = max(current.children, key=lambda c: c.visits)
        return current.state
```

### 5.3 Training the Process Reward Model

```python
def train_prm(
    model: ProcessRewardModel,
    train_data: list[dict],         # Each: {"input_ids", "attention_mask", "step_labels"}
    epochs: int = 5,
    lr: float = 1e-5,
    device: str = "cuda",
) -> dict:
    """
    Train a Process Reward Model on step-labeled data.

    Each training example contains:
        - input_ids: [L] tokenized (question + reasoning chain with [STEP] tokens)
        - attention_mask: [L]
        - step_labels: [num_steps] binary labels (1 = correct, 0 = incorrect)

    Loss: binary cross-entropy per step.
    """
    model = model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)

    metrics = {"train_loss": [], "step_accuracy": []}

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        correct_steps = 0
        total_steps = 0

        for batch in train_data:
            input_ids = batch["input_ids"].to(device).unsqueeze(0)        # [1, L]
            attention_mask = batch["attention_mask"].to(device).unsqueeze(0)  # [1, L]
            step_labels = batch["step_labels"].to(device)                  # [num_steps]

            # Forward pass
            step_probs = model(input_ids, attention_mask)                  # [1, max_steps]
            step_probs = step_probs.squeeze(0)                             # [max_steps]

            # Truncate to actual number of steps
            num_steps = len(step_labels)
            pred_probs = step_probs[:num_steps]                            # [num_steps]

            # Binary cross-entropy loss
            loss = F.binary_cross_entropy(
                pred_probs.clamp(1e-7, 1 - 1e-7),
                step_labels.float(),
            )

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            total_loss += loss.item()

            # Accuracy
            predictions = (pred_probs > 0.5).float()
            correct_steps += (predictions == step_labels).sum().item()
            total_steps += num_steps

        avg_loss = total_loss / max(len(train_data), 1)
        step_acc = correct_steps / max(total_steps, 1)
        metrics["train_loss"].append(avg_loss)
        metrics["step_accuracy"].append(step_acc)

        print(f"Epoch {epoch+1}/{epochs} | Loss: {avg_loss:.4f} | Step Acc: {step_acc:.4f}")

    return metrics

def generate_prm_labels_via_rollouts(
    question: str,
    chain: list[str],              # List of reasoning steps
    generator: Callable,            # (partial_state) -> final_answer
    evaluator: Callable,            # (question, answer) -> bool
    num_rollouts: int = 32,
) -> list[float]:
    """
    Generate PRM training labels using rollout-based estimation.

    For each step i, estimate P(correct final answer | q, s_1, ..., s_i)
    by completing the chain num_rollouts times from that point.

    A step is labeled incorrect if the completion probability drops
    significantly compared to the previous step.
    """
    step_scores = []

    for i in range(len(chain)):
        # Build partial state up to step i
        partial_state = question + "\n" + "\n".join(chain[:i + 1])

        # Complete the chain multiple times
        correct_count = 0
        for _ in range(num_rollouts):
            final_answer = generator(partial_state)
            if evaluator(question, final_answer):
                correct_count += 1

        score = correct_count / num_rollouts
        step_scores.append(score)

    # Convert to binary labels:
    # Step i is correct if score[i] >= score[i-1] - delta
    delta = 0.1
    labels = []
    prev_score = 1.0  # Start optimistic

    for i, score in enumerate(step_scores):
        if score >= prev_score - delta:
            labels.append(1.0)   # Correct step
        else:
            labels.append(0.0)   # Incorrect step
        prev_score = score

    return labels
```

---

## 6. Experimental Intuition

### 6.1 Best-of-N Scaling Curves

Performance of best-of-N on MATH benchmark with different reward models:

| N | ORM (Acc) | PRM (Acc) | No RM / Random (Acc) |
|---|-----------|-----------|---------------------|
| 1 | 50.0% | 50.0% | 50.0% |
| 4 | 57.2% | 59.8% | 52.1% |
| 16 | 62.1% | 67.3% | 53.8% |
| 64 | 65.4% | 72.1% | 55.0% |
| 256 | 67.0% | 74.8% | 55.9% |
| 1024 | 67.5% | 75.2% | 56.3% |

Key observations:

- PRM consistently outperforms ORM at all sample sizes.
- Random selection (no RM) shows only marginal improvement with $N$ (from sample diversity alone).
- Returns diminish after $N \approx 256$, consistent with the verifier accuracy ceiling (Theorem 3.15).
- The gap between PRM and ORM *widens* with $N$, confirming that step-level verification provides a tighter signal.

### 6.2 Compute-Optimal Inference

Comparing a 7B model with test-time compute vs. larger models (on MATH):

| Configuration | Effective FLOPs | Accuracy |
|---------------|----------------|----------|
| 7B, greedy | 1x | 34.1% |
| 7B, best-of-64 (PRM) | 64x | 54.3% |
| 7B, MCTS (100 sims) | ~200x | 58.7% |
| 34B, greedy | 5x | 49.2% |
| 70B, greedy | 10x | 54.2% |
| 70B, best-of-4 (PRM) | 40x | 62.8% |

The 7B model with MCTS (200x compute) nearly matches the 70B model with greedy decoding (10x compute), but at 20x higher inference cost. The 70B model with best-of-4 dominates both, suggesting that model quality and test-time compute are complementary.

### 6.3 PRM vs. ORM Error Detection

On a human-labeled set of reasoning chains (from Lightman et al., 2023):

| Metric | ORM | PRM |
|--------|-----|-----|
| Step-level error detection F1 | 0.42 | 0.78 |
| Chain-level correct/incorrect F1 | 0.71 | 0.83 |
| First error position (mean abs. offset) | 2.3 steps | 0.6 steps |

PRM is much better at localizing errors, which is crucial for search-based methods.

### 6.4 MCTS Ablations

Effect of MCTS components on MATH accuracy (7B model, 100 simulations):

| Configuration | Accuracy |
|---------------|----------|
| Greedy (no search) | 34.1% |
| Best-of-100 (random selection from MCTS) | 48.2% |
| MCTS with random rollout | 51.4% |
| MCTS with PRM (UCB1) | 56.9% |
| MCTS with PRM (PUCT) | 58.7% |
| MCTS with perfect verifier (oracle) | 71.3% |

The gap between MCTS+PRM and oracle shows substantial room for improvement via better reward models.

---

## 7. Connections

### 7.1 Connections to Prior Modules

- **Module 6 (Alignment)**: Reward models trained via RLHF are the same models used for best-of-N scoring. The ORM is essentially the reward model from RLHF, and PRMs extend this to step-level signals.
- **Module 1 (Optimization)**: MCTS is an optimization algorithm for discrete search spaces, connecting to gradient-free optimization methods.
- **Module 4 (Transformers)**: The bounded-depth analysis from Lecture 10b directly motivates why test-time compute (adding serial depth) helps.

### 7.2 Connections to Subsequent Topics

- **Lecture 10b (Chain-of-Thought)**: CoT is the simplest form of test-time compute. Self-consistency is best-of-N with the model itself as the reward function. ToT is a search-based approach.
- **Lecture 10d (Multimodal Agents)**: Agent systems use test-time compute via the observe-think-act loop, tool use, and iterative refinement.

### 7.3 Connections to Classical AI

- **MCTS in games**: The same MCTS algorithm powers AlphaGo/AlphaZero. The key adaptation for LLMs is replacing the game simulator with the LLM's generation and using PRMs instead of game outcomes for evaluation.
- **A* search**: Best-first search with PRM scores as heuristics is analogous to A* with an admissible heuristic.
- **Branch-and-bound**: PRM scores can be used to prune reasoning branches that are unlikely to lead to correct answers.

---

## 8. Paper Reading List

### Required Reading

1. **Snell, C., Lee, J., Xu, K., & Kumar, A. (2024).** Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters. *arXiv*. The foundational paper on compute-optimal inference allocation.

2. **Lightman, H., Kosaraju, V., Burda, Y., Edwards, H., Baker, B., Lee, T., ... & Cobbe, K. (2023).** Let's Verify Step by Step. *ICLR 2024*. Introduces process reward models and demonstrates their superiority for math reasoning.

3. **Brown, B., Juravsky, J., Ehrlich, R., Clark, R., Le, Q. V., Re, C., & Mirhoseini, A. (2024).** Large Language Monkeys: Scaling Inference Compute with Repeated Sampling. *arXiv*. Systematic study of best-of-N scaling laws.

### Recommended Reading

4. **Cobbe, K., Kosaraju, V., Bavarian, M., Chen, M., Jun, H., Kaiser, L., ... & Schulman, J. (2021).** Training Verifiers to Solve Math Word Problems. *arXiv*. Early work on outcome-based verification for math reasoning.

5. **Silver, D., Huang, A., Maddison, C. J., Guez, A., Sifre, L., Van Den Driessche, G., ... & Hassabis, D. (2016).** Mastering the Game of Go with Deep Neural Networks and Tree Search. *Nature*. The AlphaGo paper; MCTS + neural networks for search.

6. **Auer, P., Cesa-Bianchi, N., & Fischer, P. (2002).** Finite-time Analysis of the Multiarmed Bandit Problem. *Machine Learning*. The UCB1 algorithm used in MCTS.

### Optional / Frontier

7. **Zelikman, E., Harik, G., Shao, Y., Jayasiri, V., Haber, N., & Goodman, N. D. (2024).** Quiet-STaR: Language Models Can Teach Themselves to Think Before Speaking. *arXiv*. Training models to generate internal reasoning tokens.

8. **Wang, P., Li, L., Shao, Z., Xu, R. X., Dai, D., Li, Y., ... & Luo, Y. (2024).** Math-Shepherd: Verify and Reinforce LLMs Step-by-step without Human Annotations. *ACL 2024*. Automated PRM training via MCTS rollouts.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9.1 (Best-of-N Analysis).**

(a) Prove that for a Gaussian reward distribution $R \sim \mathcal{N}(\mu, \sigma^2)$, the expected best-of-N reward satisfies:

$$\mathbb{E}[\max(R_1, \ldots, R_N)] = \mu + \sigma \cdot a_N$$

where $a_N \sim \sqrt{2 \ln N} - \frac{\ln \ln N + \ln 4\pi}{2\sqrt{2 \ln N}}$ for large $N$.

(b) Derive the optimal $N$ given a budget constraint where each sample costs $c$ and each reward unit is worth $v$. That is, maximize $v \cdot \mathbb{E}[R_{(N)}] - c \cdot N$.

(c) Now suppose the reward model has noise $\epsilon \sim \mathcal{N}(0, \sigma_\epsilon^2)$ independent of the true reward. Show that the effective true reward of the selected sample grows slower than $\sqrt{2 \ln N}$. Compute the exact rate.

**Exercise 9.2 (PRM vs. ORM).**

(a) Consider a 5-step reasoning chain where each step is correct with probability $p = 0.8$ independently. Compute the probability that best-of-$N$ with an ORM selects a fully correct chain, for $N \in \{1, 10, 100, 1000\}$.

(b) Now consider PRM-guided search where at each step, we generate 3 candidates and select the one the PRM scores highest. Assume the PRM has accuracy 0.9 (probability of correctly identifying the best candidate). Compute the probability of producing a fully correct chain.

(c) At what per-step accuracy $p$ does PRM-guided search with 3 candidates per step achieve the same overall success probability as best-of-1000 with ORM?

**Exercise 9.3 (MCTS Regret).**

(a) State and prove the UCB1 regret bound for the multi-armed bandit problem. (Full proof, following Auer et al. 2002.)

(b) In the MCTS context, explain why the multi-armed bandit analogy breaks down (the reward distributions change as the tree grows). What property of the tree ensures UCB1 still performs well?

(c) Compare PUCT (with prior from PRM) to UCB1 (without prior). Under what conditions does PUCT have lower regret in the first $T$ simulations?

### Implementation Exercises

**Exercise 9.4 (Best-of-N Evaluation).** Implement best-of-N evaluation on GSM8K:

(a) Use a pretrained LLM to generate $N \in \{1, 4, 16, 64, 256\}$ solutions per problem.

(b) Implement three selection strategies: (i) random, (ii) majority vote on final answer, (iii) reward model scoring. Compare accuracy for each $N$.

(c) Plot accuracy vs. compute (measured in total generated tokens) for each strategy. Identify the Pareto-optimal strategy at each compute level.

**Exercise 9.5 (Process Reward Model).** Train a PRM for math reasoning:

(a) Generate training data by producing 100 reasoning chains per problem on a math dataset, evaluating final answers, and using rollout-based step labeling.

(b) Train a PRM (fine-tune a small transformer) on the step-labeled data. Report step-level classification accuracy.

(c) Use the trained PRM for best-of-N selection and compare against ORM (final-answer-only scoring). Report accuracy improvement.

**Exercise 9.6 (MCTS Implementation).** Implement MCTS for math problem solving:

(a) Implement the full MCTS loop (selection, expansion, simulation, backpropagation) using a PRM for evaluation.

(b) Compare UCB1 and PUCT selection strategies. Measure accuracy vs. number of simulations $\in \{10, 50, 100, 500\}$.

(c) Ablate the components: (i) remove PRM (use random rollout values), (ii) remove exploration (always exploit), (iii) remove backpropagation (use PRM scores directly). Report which component contributes most.
