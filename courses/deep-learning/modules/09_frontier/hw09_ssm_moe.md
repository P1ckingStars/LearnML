# Homework 09: State-Space Models and Mixture of Experts

**Estimated Time: ~20 hours**

**Prerequisites:** Lectures 09a (SSM/S4), 09b (Mamba), 09c (Mixture of Experts)

---

## Overview

This homework has two parts. Part A focuses on theoretical derivations and proofs related to state-space models and MoE. Part B focuses on implementation, training, and empirical analysis. You must complete both parts.

**Submission:** Submit a single PDF (Part A, typeset in LaTeX) and a code repository (Part B, with a README explaining how to run your experiments).

---

## Part A: Theory (50%)

### Problem A.1: Discretization of Continuous SSMs (10%)

Consider the continuous-time state-space model:

$$\dot{x}(t) = Ax(t) + Bu(t), \quad y(t) = Cx(t)$$

with $A \in \mathbb{R}^{N \times N}$, $B \in \mathbb{R}^{N \times 1}$, $C \in \mathbb{R}^{1 \times N}$.

**(a)** (3%) Derive the Zero-Order Hold (ZOH) discretization. Starting from the continuous solution $x(t) = e^{At}x(0) + \int_0^t e^{A(t-\tau)}Bu(\tau)\,d\tau$, assume $u(\tau) = u_k$ is constant for $\tau \in [k\Delta, (k+1)\Delta)$. Show that the discrete recurrence is:

$$x_{k+1} = \bar{A}x_k + \bar{B}u_k$$

where $\bar{A} = e^{A\Delta}$ and $\bar{B} = A^{-1}(e^{A\Delta} - I)B$. Clearly state all assumptions (e.g., invertibility of $A$).

**(b)** (3%) Derive the bilinear (Tustin) discretization. Starting from the trapezoidal approximation:

$$\frac{x_{k+1} - x_k}{\Delta} = A\frac{x_{k+1} + x_k}{2} + B\frac{u_{k+1} + u_k}{2}$$

show that:

$$\bar{A}_{\text{bilinear}} = \left(I - \frac{\Delta}{2}A\right)^{-1}\left(I + \frac{\Delta}{2}A\right)$$

$$\bar{B}_{\text{bilinear}} = \left(I - \frac{\Delta}{2}A\right)^{-1}\Delta B$$

**(c)** (2%) For $A = \text{diag}(-1, -2)$, $B = (1, 1)^T$, and $\Delta = 0.5$, compute $\bar{A}$ and $\bar{B}$ numerically using both ZOH and bilinear methods. Compare the eigenvalues of $\bar{A}$ in each case.

**(d)** (2%) Prove that the bilinear transform preserves stability: if all eigenvalues $\lambda$ of $A$ satisfy $\text{Re}(\lambda) < 0$, then all eigenvalues $\mu$ of $\bar{A}_{\text{bilinear}}$ satisfy $|\mu| < 1$.

*Hint:* Use the Mobius transformation $\mu = \frac{1 + \lambda\Delta/2}{1 - \lambda\Delta/2}$ and show $|\mu| < 1$ when $\text{Re}(\lambda) < 0$.

### Problem A.2: Convolution-Recurrence Duality (10%)

**(a)** (4%) Prove that the discrete SSM $x_k = \bar{A}x_{k-1} + \bar{B}u_k$, $y_k = Cx_k$ (with $x_{-1} = 0$, $D = 0$) computes a causal convolution $y = K * u$ where:

$$K_i = C\bar{A}^i\bar{B}, \quad i = 0, 1, \ldots, L-1$$

Write out the proof by explicitly unrolling the recurrence for the first 4 steps and then proving the general case by induction.

**(b)** (3%) Show that for a diagonal $\bar{A} = \text{diag}(\lambda_1, \ldots, \lambda_N)$, the kernel has the form:

$$K_i = \sum_{n=1}^{N} c_n b_n \lambda_n^i$$

where $c_n = C_{1,n}$ and $b_n = B_{n,1}$. This is a sum of $N$ geometric sequences.

**(c)** (3%) Prove that the output $y$ can be computed in $O(L \log L)$ time using the FFT. Specifically, show that $y = \text{IFFT}(\text{FFT}(K) \odot \text{FFT}(u))$ gives the correct linear (non-circular) convolution when both $K$ and $u$ are zero-padded to length $\geq 2L - 1$.

### Problem A.3: HiPPO Initialization (10%)

**(a)** (5%) The HiPPO-LegS matrix is defined as:

$$(A)_{nk} = -\begin{cases} (2n+1)^{1/2}(2k+1)^{1/2} & \text{if } n > k \\ n + 1 & \text{if } n = k \\ 0 & \text{if } n < k \end{cases}$$

Construct this matrix for $N = 4$. Compute its eigenvalues (analytically or numerically). Verify that all eigenvalues have negative real parts.

**(b)** (5%) The key property of HiPPO is that the state $x(t) \in \mathbb{R}^N$ approximates the Legendre polynomial coefficients of the input history. Specifically, define:

$$c_n(t) = (2n+1) \int_0^t u(\tau) P_n\left(\frac{2\tau}{t} - 1\right) \frac{d\tau}{t}$$

where $P_n$ is the $n$-th Legendre polynomial. Show that differentiating $c_n(t)$ with respect to $t$ yields:

$$\dot{c}_n(t) = \frac{1}{t}\left[A_{\text{HiPPO}} \cdot c(t) + B_{\text{HiPPO}} \cdot u(t)\right]$$

You may use the following properties of Legendre polynomials:

- $P_n(1) = 1$ for all $n$
- $(2n+1)P_n(x) = P'_{n+1}(x) - P'_{n-1}(x)$
- Orthogonality: $\int_{-1}^{1} P_n(x)P_m(x)\,dx = \frac{2}{2n+1}\delta_{nm}$

### Problem A.4: Computational Complexity Analysis (10%)

**(a)** (3%) Derive the computational complexity (in FLOPs) of a single forward pass through:

- (i) A Transformer self-attention layer with sequence length $T$, model dimension $d$, and $h$ heads.
- (ii) An S4 layer with sequence length $T$, model dimension $d$ (number of independent SSMs), and state dimension $N$.
- (iii) A Mamba layer with the same dimensions plus expansion factor $E = 2$.

For each, express the complexity in Big-O notation and compute the numerical value for $T = 8192$, $d = 1024$, $h = 16$, $N = 16$.

**(b)** (3%) Derive the memory complexity (peak memory during forward pass) for each of the three architectures in part (a). Include both parameter memory and activation memory.

**(c)** (4%) At what sequence length $T^*$ does the S4/Mamba layer become more efficient than the Transformer layer (in terms of FLOPs)? Express $T^*$ as a function of $d$, $N$, and $h$. Plot the FLOPs as a function of $T$ for all three architectures on a log-log scale.

### Problem A.5: Load Balancing Loss for MoE (10%)

**(a)** (3%) Consider an MoE layer with $N = 8$ experts, top-$K = 2$ routing, and a batch of $T = 512$ tokens. Define:

$$f_i = \frac{1}{T}\sum_{t=1}^{T} \mathbf{1}[i \in \text{TopK}(G(x_t))], \quad p_i = \frac{1}{T}\sum_{t=1}^{T} \text{softmax}(h(x_t))_i$$

Show that $\sum_i f_i = K$ and $\sum_i p_i = 1$. Under these constraints, find the values of $f_i$ and $p_i$ that minimize $\mathcal{L}_{\text{balance}} = N \sum_i f_i p_i$. What is the minimum value?

**(b)** (3%) Prove that the product form $f_i \cdot p_i$ is preferable to the squared form $f_i^2$ for the load balancing loss by showing that:

- The gradient $\frac{\partial}{\partial W_g} \sum_i f_i^2$ is zero almost everywhere (due to the indicator function in $f_i$).
- The gradient $\frac{\partial}{\partial W_g} \sum_i f_i \cdot p_i$ is nonzero and provides useful signal through the differentiable $p_i$.

**(c)** (4%) The router z-loss from ST-MoE is:

$$\mathcal{L}_z = \frac{1}{BT}\sum_{b,t}\log^2\left(\sum_{i=1}^N \exp(h_i(x_{b,t}))\right)$$

Show that this loss penalizes large logit magnitudes. Compute $\frac{\partial \mathcal{L}_z}{\partial h_j}$ and explain how it stabilizes training by preventing router logit explosion.

---

## Part B: Implementation (50%)

### Problem B.1: Basic SSM Layer (10%)

Implement a discrete SSM layer from scratch in PyTorch.

**(a)** (4%) Implement a `DiscreteSSM` class with:

- Diagonal state matrix parameterized as $A = -\exp(\text{log\_A\_real})$ for guaranteed stability.
- ZOH discretization.
- Both convolutional (FFT-based) and recurrent forward passes.

Your implementation must support the following interface:

```python
ssm = DiscreteSSM(d_model=64, d_state=32)
u = torch.randn(4, 256, 64)      # (B, L, H)
y_conv = ssm.forward_conv(u)      # (B, L, H)
y_rec, state = ssm.forward_rec(u) # (B, L, H), (B, H, N)
```

**(b)** (3%) Verify that the convolutional and recurrent modes produce the same output up to numerical precision. Report the maximum absolute difference for sequences of length $L \in \{64, 256, 1024, 4096\}$ with $d_{\text{model}} = 64$ and $d_{\text{state}} = 32$.

**(c)** (3%) Benchmark the wall-clock time of both modes for $L \in \{256, 1024, 4096, 16384, 65536\}$. Plot the results on a log-log scale and verify that:

- Convolutional mode scales as $O(L \log L)$.
- Recurrent mode scales as $O(L)$.

At what sequence length does the convolutional mode become faster than the recurrent mode?

### Problem B.2: S4 Layer with Parallel Scan (10%)

**(a)** (5%) Implement an S4 layer with:

- HiPPO initialization (construct the HiPPO-LegS matrix and use its eigenvalues).
- Complex diagonal parameterization.
- FFT-based convolutional kernel computation.

**(b)** (5%) Implement the parallel scan algorithm for computing the SSM recurrence:

- Define the associative operator $(a_2, b_2) \bullet (a_1, b_1) = (a_2 a_1, a_2 b_1 + b_2)$.
- Implement the Blelloch prefix scan.
- Verify correctness against the sequential recurrence for random inputs.
- Benchmark the parallel scan vs. sequential scan on GPU for $L \in \{1024, 4096, 16384\}$.

### Problem B.3: Sparse MoE Layer (10%)

**(a)** (4%) Implement a sparse MoE layer with top-2 routing:

- $N = 8$ experts, each a 2-layer FFN with SiLU activation.
- Top-2 softmax routing with renormalization.
- Load balancing auxiliary loss.
- Expert capacity with configurable capacity factor.

**(b)** (3%) Implement expert utilization tracking. After each forward pass, record:

- The number of tokens routed to each expert.
- The average gate value for each expert.
- The token drop rate.

Plot these statistics over training and verify that the load balancing loss prevents expert collapse.

**(c)** (3%) Ablation: Train the MoE layer with $\alpha \in \{0, 0.001, 0.01, 0.1, 1.0\}$ for the load balancing coefficient. For each, plot:

- Training loss.
- Expert utilization entropy.
- Token drop rate.

Identify the optimal $\alpha$ and explain your choice.

### Problem B.4: SSM Language Model (10%)

**(a)** (5%) Build a language model using your SSM layer. Architecture:

```
Embedding -> [LayerNorm -> SSM -> Residual -> LayerNorm -> FFN -> Residual] x N -> LM Head
```

Train on a character-level language modeling task using a subset of the enwik8 dataset (first 5M characters). Use the following hyperparameters:

- 4 layers, $d_{\text{model}} = 128$, $d_{\text{state}} = 64$
- Batch size 32, sequence length 512
- AdamW optimizer, learning rate $10^{-3}$ with cosine schedule
- Train for 50 epochs

Report bits-per-character (BPC) on the validation set.

**(b)** (5%) Train an LSTM baseline with the same architecture (replace SSM with single-layer LSTM, same hidden size). Compare:

- Final BPC.
- Training throughput (characters/second).
- BPC as a function of sequence position (does the SSM maintain quality on later positions better than the LSTM?).

### Problem B.5: Sequence Length Extrapolation (10%)

**(a)** (5%) Train both your SSM model and a Transformer baseline (2-layer, 4-head, $d = 128$) on sequences of length 256 from enwik8.

**(b)** (5%) Evaluate both models on sequences of length $L \in \{256, 512, 1024, 2048, 4096\}$ (without retraining). For each length, report:

- BPC averaged over the full sequence.
- BPC as a function of position within the sequence.
- Wall-clock inference time.

The SSM should extrapolate gracefully (BPC stays reasonable at longer lengths) while the Transformer should degrade. Document and explain your findings. If the results contradict expectations, analyze why.

---

## Grading Rubric

| Component | Points | Criteria |
|-----------|--------|----------|
| A.1 Discretization | 10 | Correct derivation, clear exposition |
| A.2 Duality proof | 10 | Complete induction proof, FFT analysis |
| A.3 HiPPO | 10 | Correct construction and differentiation |
| A.4 Complexity | 10 | Accurate FLOPs/memory analysis |
| A.5 Load balancing | 10 | Correct optimization analysis |
| B.1 Basic SSM | 10 | Correct implementation, benchmarks |
| B.2 S4 + scan | 10 | Working HiPPO init, parallel scan |
| B.3 Sparse MoE | 10 | Routing, balancing, ablation |
| B.4 SSM LM | 10 | Training pipeline, comparison |
| B.5 Extrapolation | 10 | Length generalization experiments |

**Total: 100 points**

---

## Submission Checklist

- [ ] Part A: LaTeX-typeset PDF with all derivations and proofs
- [ ] Part B: Code repository with:
  - [ ] `ssm.py`: DiscreteSSM and S4Layer implementations
  - [ ] `parallel_scan.py`: Parallel scan implementation
  - [ ] `moe.py`: SparseMoE implementation with routing and balancing
  - [ ] `train_lm.py`: Language model training script
  - [ ] `experiments.py`: Benchmarking and extrapolation experiments
  - [ ] `README.md`: Instructions for reproducing all results
- [ ] All plots referenced in the problems
- [ ] Trained model checkpoints (upload to shared drive if large)

---

## Hints

1. **Problem A.3**: Use the substitution $s = 2\tau/t - 1$ to transform the integral to the standard Legendre domain $[-1, 1]$. Apply the Leibniz rule carefully when differentiating the integral with a variable upper limit.

2. **Problem B.1**: When verifying conv/recurrent equivalence, the numerical difference grows with sequence length due to floating-point accumulation. Use `float64` for the verification.

3. **Problem B.2**: The Blelloch scan has two phases: up-sweep (reduce) and down-sweep. Debug by testing on sequences of length 4 and 8 first.

4. **Problem B.3**: Expert collapse can happen very quickly (within the first few hundred steps). Monitor expert utilization from the start of training.

5. **Problem B.5**: For Transformer extrapolation, consider using ALiBi or RoPE positional encodings and report whether they help with length generalization.
