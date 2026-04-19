# Homework 06: Compress & Benchmark

**Estimated time:** 20 hours
**Due date:** Two weeks from assignment
**Submission:** Jupyter notebook (.ipynb) + PDF of derivations

---

## Overview

This homework has two parts of equal weight. Part A tests your mathematical understanding of pruning, quantization, and distillation. Part B requires you to compress a pretrained model using multiple techniques, rigorously benchmark the results, and analyze the Pareto frontier of accuracy vs. efficiency.

**Academic integrity:** You may discuss approaches with classmates, but all derivations and code must be your own. Cite any references you consult. You may use libraries (auto-gptq, autoawq, torch.nn.utils.prune, etc.) for Part B.

---

## Part A: Mathematical Derivations (50%)

### Problem A1: Optimal Brain Damage vs. Magnitude Pruning (15 points)

Consider a trained neural network with parameter vector $\theta^* \in \mathbb{R}^n$ at a local minimum of the loss $\mathcal{L}(\theta)$. We wish to prune a single parameter $\theta_i$ (set it to zero) and analyze the resulting increase in loss.

**(a)** [5 points] Write the second-order Taylor expansion of $\mathcal{L}(\theta^* - \theta_i^* e_i)$ around $\theta^*$, where $e_i$ is the $i$-th standard basis vector. Since $\theta^*$ is a local minimum, simplify the expression. Show that the saliency (increase in loss) for parameter $i$ is:

$$s_i = \frac{1}{2} H_{ii} (\theta_i^*)^2$$

where $H_{ii} = \frac{\partial^2 \mathcal{L}}{\partial \theta_i^2}\bigg|_{\theta^*}$ is the $i$-th diagonal Hessian entry.

**(b)** [5 points] Consider a simple linear regression model $f(x) = w_1 x_1 + w_2 x_2$ with squared loss on data $\{(x^{(n)}, y^{(n)})\}_{n=1}^N$. Compute the Hessian $H = X^\top X / N$ explicitly. Construct a concrete example (specific $X$ and $y$) where magnitude pruning (remove the smallest $|w_i^*|$) and OBD pruning (remove the smallest $s_i = \frac{1}{2} H_{ii} (w_i^*)^2$) disagree on which parameter to prune. Verify by computing the actual loss increase for both choices.

**(c)** [5 points] The **Optimal Brain Surgeon** (Hassibi & Stork, 1993) goes further: after removing weight $\theta_q$, it optimally adjusts the remaining weights. Show that the optimal adjustment is:

$$\delta \theta = -\frac{\theta_q^*}{[H^{-1}]_{qq}} H^{-1} e_q$$

and the resulting saliency is:

$$s_q^{\text{OBS}} = \frac{(\theta_q^*)^2}{2 [H^{-1}]_{qq}}$$

*Hint: minimize $\delta\theta^\top H \delta\theta / 2$ subject to $e_q^\top (\theta^* + \delta\theta) = 0$ using the method of Lagrange multipliers.*

---

### Problem A2: Quantization Error Analysis (15 points)

**(a)** [5 points] Consider a weight $w$ drawn from $\mathcal{N}(0, \sigma^2)$ that is quantized to $b$ bits using symmetric uniform quantization with range $[-\alpha, \alpha]$. The quantization step size is $\Delta = 2\alpha / (2^b - 1)$. The quantization error has two sources:

1. **Rounding error** for values within $[-\alpha, \alpha]$: error is uniform on $[-\Delta/2, \Delta/2]$.
2. **Clipping error** for values outside $[-\alpha, \alpha]$: error is $|w| - \alpha$ for $|w| > \alpha$.

Derive the total expected MSE as a function of $\alpha$, $\sigma$, and $b$:

$$\text{MSE}(\alpha) = \underbrace{\frac{\Delta^2}{12} \cdot P(|w| \le \alpha)}_{\text{rounding}} + \underbrace{\mathbb{E}\left[(|w| - \alpha)^2 \cdot \mathbf{1}_{|w| > \alpha}\right]}_{\text{clipping}}$$

Express each term using the Gaussian CDF $\Phi$ and PDF $\phi$.

**(b)** [5 points] Show that the optimal $\alpha^*$ satisfies:

$$\frac{d\text{MSE}}{d\alpha} = 0 \implies \text{(implicit equation in } \alpha/\sigma \text{)}$$

Derive this equation. For $b = 8$ (256 levels), numerically solve for $\alpha^*/\sigma$ and verify it is approximately 2.83. For $b = 4$ (16 levels), what is $\alpha^*/\sigma$?

**(c)** [5 points] **GPTQ error propagation.** Consider quantizing a weight matrix $W \in \mathbb{R}^{m \times n}$ column by column. After quantizing column $j$ with error $\epsilon_j = w_j - \hat{w}_j$, the GPTQ update to column $k > j$ is:

$$\delta w_k = -\frac{\epsilon_j}{[H^{-1}]_{jj}} [H^{-1}]_{kj}$$

Show that after processing all columns, the total output error $\|WX - \hat{W}X\|_F^2$ is bounded by:

$$\|WX - \hat{W}X\|_F^2 \le \sum_{j=1}^{n} \frac{\epsilon_j^2}{[H^{-1}]_{jj}}$$

where $H = XX^\top$. Why is this tighter than the naive bound $\|\epsilon\|^2 \|X\|^2$?

---

### Problem A3: Knowledge Distillation Theory (10 points)

**(a)** [5 points] Let the teacher output logits $z_T \in \mathbb{R}^K$ and the student output logits $z_S \in \mathbb{R}^K$. The distillation loss is:

$$\mathcal{L}_{\text{KD}} = \tau^2 \cdot \text{KL}(\text{softmax}(z_T/\tau) \| \text{softmax}(z_S/\tau))$$

Show that as $\tau \to \infty$:

$$\mathcal{L}_{\text{KD}} \to \frac{1}{2K} \|z_S - z_T - (\bar{z}_S - \bar{z}_T)\mathbf{1}\|^2 + O(1/\tau)$$

where $\bar{z}_S = \frac{1}{K}\sum_k z_{S,k}$ and similarly for $\bar{z}_T$. This shows that high-temperature distillation is equivalent to matching logits (up to a constant shift).

**(b)** [5 points] Consider a binary classification problem ($K = 2$) where the teacher outputs logit difference $\Delta_T = z_{T,1} - z_{T,2}$. Show that the KL divergence between teacher and student softened probabilities reduces to:

$$\text{KL}(p_T^\tau \| p_S^\tau) = \sigma(\Delta_T/\tau) \cdot \log\frac{\sigma(\Delta_T/\tau)}{\sigma(\Delta_S/\tau)} + \sigma(-\Delta_T/\tau) \cdot \log\frac{\sigma(-\Delta_T/\tau)}{\sigma(-\Delta_S/\tau)}$$

where $\sigma$ is the sigmoid function. Plot this as a function of $\Delta_S$ for fixed $\Delta_T = 3$ and $\tau \in \{1, 2, 5, 10\}$. How does the loss landscape change with temperature?

---

### Problem A4: Depthwise Separable Convolutions and NAS (10 points)

**(a)** [5 points] Derive the exact FLOPs and parameter count for the MobileNet V2 inverted residual block with:
- Input/output channels: $C$
- Expansion factor: $t$
- Kernel size: $k$
- Spatial dimensions: $H \times W$
- Stride: $s$ (assume $s = 1$ for residual connection)

Break down the cost into the three sub-operations (expansion, depthwise, projection) and express the total as a function of $C$, $t$, $k$, $H$, $W$. Compare with a standard residual block (two $k \times k$ convolutions with $C$ channels each).

**(b)** [5 points] In DARTS, the mixed operation at edge $(i, j)$ computes:

$$\bar{o}_{ij}(x) = \sum_{o \in \mathcal{O}} \frac{\exp(\alpha_{ij}^o)}{\sum_{o'} \exp(\alpha_{ij}^{o'})} o(x)$$

The architecture parameters $\alpha$ are updated on the validation set. Show that the DARTS bilevel optimization is biased: the first-order approximation

$$\nabla_\alpha \mathcal{L}_{\text{val}}(w^*(\alpha), \alpha) \approx \nabla_\alpha \mathcal{L}_{\text{val}}(w, \alpha)$$

ignores the implicit gradient $\frac{\partial w^*}{\partial \alpha}$. Write the exact expression for this implicit gradient using the implicit function theorem (assuming $w^*(\alpha)$ satisfies $\nabla_w \mathcal{L}_{\text{train}}(w^*(\alpha), \alpha) = 0$). Under what conditions is the first-order approximation accurate?

---

## Part B: Implementation (50%)

### Overview

You will compress a pretrained model using pruning, quantization, and distillation, then benchmark all compressed variants on the same hardware and task. The goal is to produce a **Pareto frontier** of accuracy vs. efficiency and analyze which compression methods dominate at different operating points.

**Model**: Choose one of:
- GPT-2 Medium (355M) for language modeling
- ResNet-50 for ImageNet classification (or CIFAR-100 if GPU-constrained)

**Evaluation metrics**: Perplexity or top-1 accuracy (task-dependent), latency (ms per sample), peak GPU memory (MB), model size on disk (MB).

---

### Problem B1: Pruning (12 points)

**(a)** [4 points] **Magnitude pruning sweep.** Apply global unstructured magnitude pruning at sparsity levels $s \in \{0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95\}$. For each sparsity level:
- Prune the model.
- Fine-tune for 1 epoch (for language models: 1000 steps on WikiText-2; for vision models: 1 epoch on the training set).
- Evaluate accuracy/perplexity.
- Measure inference latency and memory.

Plot accuracy vs. sparsity (with and without fine-tuning). At what sparsity does accuracy degrade by more than 1%?

**(b)** [4 points] **Structured pruning.** For the same model, apply structured pruning:
- For language models: prune entire attention heads using the gradient-based importance score from Michel et al. (2019). Remove $\{10\%, 20\%, 30\%, 50\%\}$ of heads.
- For vision models: prune channels using the $\ell_1$-norm criterion. Remove $\{10\%, 20\%, 30\%, 50\%\}$ of channels.

Compare the latency improvement of structured vs. unstructured pruning at the same effective parameter reduction.

**(c)** [4 points] **2:4 sparsity.** Implement 2:4 structured sparsity (keep top-2 of every 4 weights). Compare accuracy and latency with 50% unstructured sparsity. If you have access to an NVIDIA Ampere GPU, use `torch.sparse` to measure the tensor core speedup.

---

### Problem B2: Quantization (12 points)

**(a)** [4 points] **RTN bit-width sweep.** Implement per-group symmetric quantization (from scratch, as in the recitation) at bit-widths $b \in \{8, 6, 4, 3, 2\}$ with group size 128. For each bit-width, report:
- Accuracy/perplexity.
- Model size (accounting for scales and original parameter precision).
- Layer-by-layer quantization error (MSE per layer).

Identify the two layers with the highest quantization error. Keep these in FP16 and re-evaluate: how much does mixed-precision help?

**(b)** [4 points] **GPTQ vs. RTN.** Apply GPTQ at INT4 (use AutoGPTQ or your own implementation from the recitation). Compare with RTN at INT4:
- Perplexity difference.
- Per-layer output reconstruction error: $\|W_\ell X_\ell - \hat{W}_\ell X_\ell\|_F^2 / \|W_\ell X_\ell\|_F^2$ for each layer $\ell$.
- Wall-clock quantization time.

**(c)** [4 points] **Group size ablation.** Fix bit-width at 4 and vary group size $g \in \{32, 64, 128, 256, 512, 1024, \text{per-channel}\}$. For each:
- Report accuracy/perplexity.
- Compute the effective bits per parameter: $b_{\text{eff}} = b + 16/g$ (accounting for FP16 scales).
- Plot accuracy vs. $b_{\text{eff}}$.

Is there a "sweet spot" for group size that maximizes accuracy per effective bit?

---

### Problem B3: Knowledge Distillation (12 points)

**(a)** [4 points] **Basic distillation.** Train a smaller model using knowledge distillation from the original model:
- For GPT-2 Medium: distill into GPT-2 Small (124M) using word-level KD.
- For ResNet-50: distill into ResNet-18 using logit-based KD.

Sweep temperature $\tau \in \{1, 2, 4, 8, 16\}$ and mixing weight $\alpha \in \{0.1, 0.5, 0.9\}$. Report accuracy for each $(\tau, \alpha)$ pair and identify the optimal configuration. Compare with training the student from scratch (no distillation).

**(b)** [4 points] **Feature-based distillation.** Add an intermediate layer matching loss (FitNets-style):
- Match the student's final hidden representation to the teacher's (with a learned projection).
- Add this to the logit-based distillation loss with weight $\beta$.

Sweep $\beta \in \{0.01, 0.1, 1.0, 10.0\}$ and report accuracy. Does feature-based distillation improve upon logit-only distillation?

**(c)** [4 points] **Self-distillation.** Run 3 generations of self-distillation on the student model (train, use as teacher for next generation). Report accuracy at each generation. Does it improve beyond the distilled baseline? How does it compare with the teacher's accuracy?

---

### Problem B4: Pareto Analysis (14 points)

**(a)** [7 points] **Combined compression.** Apply compression techniques in combination:
1. Pruning + Quantization: Prune to 50% sparsity, then quantize to INT4.
2. Distillation + Quantization: Distill to a smaller model, then quantize to INT4.
3. Pruning + Distillation: Prune the teacher, then distill to a smaller model.
4. All three: Distill to a smaller model, prune to 50%, then quantize to INT4.

For each combination, report accuracy, latency, memory, and model size.

**(b)** [7 points] **Pareto frontier.** Plot the Pareto frontier of accuracy vs. each efficiency metric:
- Accuracy vs. latency (ms).
- Accuracy vs. peak memory (MB).
- Accuracy vs. model size (MB).

Each point on the plot should be labeled with its compression method (e.g., "GPTQ-INT4", "50%-prune + INT8", "Distill + INT4"). Identify the Pareto-optimal configurations.

**Analysis questions:**
- Which single compression technique provides the best accuracy-efficiency tradeoff?
- Do combinations of techniques compose well (i.e., do their improvements stack)?
- Is there a configuration that achieves 2x speedup with less than 1% accuracy degradation?
- At what point does further compression cause rapid accuracy collapse?

---

## Deliverables

1. **PDF** (Part A): Clearly written derivations with all intermediate steps. Use LaTeX or neatly handwritten.

2. **Jupyter notebook** (Part B): Well-organized code with:
   - Clear section headers matching the problem numbers.
   - All code runnable from top to bottom (restart kernel and run all before submitting).
   - All plots embedded in the notebook with proper labels, legends, and titles.
   - A brief text analysis cell after each experiment summarizing your findings.

3. **Pareto frontier plot** (Problem B4b): A clear, publication-quality figure showing all compressed models on accuracy-vs-efficiency axes, with the Pareto frontier highlighted.

4. **Summary table** at the end of the notebook:

| Method | Accuracy/PPL | Latency (ms) | Memory (MB) | Size (MB) | Notes |
|--------|-------------|--------------|-------------|-----------|-------|
| Baseline (FP16) | -- | -- | -- | -- | -- |
| Prune 50% | -- | -- | -- | -- | -- |
| RTN INT4 | -- | -- | -- | -- | -- |
| GPTQ INT4 | -- | -- | -- | -- | -- |
| Distill | -- | -- | -- | -- | -- |
| Prune + Quant | -- | -- | -- | -- | -- |
| Distill + Quant | -- | -- | -- | -- | -- |
| Best Pareto | -- | -- | -- | -- | -- |

---

## Grading Rubric

| Component | Points |
|---|---|
| **Part A** | **50** |
| A1: OBD vs. magnitude pruning | 15 |
| A2: Quantization error analysis | 15 |
| A3: Distillation theory | 10 |
| A4: Efficient architectures & NAS | 10 |
| **Part B** | **50** |
| B1: Pruning experiments | 12 |
| B2: Quantization experiments | 12 |
| B3: Distillation experiments | 12 |
| B4: Pareto analysis | 14 |

**Bonus points (up to 10 extra):**

- Implement SparseGPT or Wanda from scratch and compare with magnitude pruning at 50% sparsity on the same model (+5).
- Apply all compression techniques to a 7B model (e.g., LLaMA-2-7B) and report the Pareto frontier (+3).
- Implement QAT for 3 epochs and compare with PTQ (GPTQ/AWQ) at INT4. Does QAT close the remaining gap? (+2).

---

## Hints and Tips

1. **Start with the smallest model that is meaningful.** GPT-2 (124M) or ResNet-18 on CIFAR-100 are fine for debugging. Scale up to GPT-2-medium or ResNet-50 for final results.

2. **Calibration data matters.** Use at least 128 samples from the training distribution for GPTQ/AWQ calibration. Using out-of-distribution data will produce poor results.

3. **Benchmark carefully.** GPU benchmarking requires warmup runs and CUDA synchronization. Use the benchmarking functions from the recitation as a template.

4. **Memory measurement.** Use `torch.cuda.max_memory_allocated()` after `torch.cuda.reset_peak_memory_stats()` for accurate peak memory.

5. **Pruning + fine-tuning.** Even 1000 steps of fine-tuning after pruning recovers a significant amount of accuracy. Always report results both with and without fine-tuning.

6. **Distillation training.** Train for enough epochs to see convergence. For CIFAR-100, 200 epochs is standard. For language models, 3--5 epochs on a subset is sufficient.

7. **Pareto frontier.** A model is Pareto-optimal if no other model is better on all metrics simultaneously. Use `scipy.spatial.ConvexHull` or manual filtering to identify the frontier.

8. **Common pitfalls:**
   - Forgetting to call `model.eval()` during benchmarking (dropout and BN behave differently).
   - Not disabling gradient computation during inference (`torch.no_grad()`).
   - Comparing latencies measured on different hardware or under different load conditions.
   - Mixing up perplexity and loss (perplexity = exp(loss)).

---

*This homework accompanies Module 06 of the PhD ML Systems course.*
