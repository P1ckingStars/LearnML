# Notation Reference

This document defines all notation used throughout the course. When in doubt, refer here.

## Scalars, Vectors, Matrices, Tensors

| Notation | Meaning |
|----------|---------|
| x, y, α, λ | Scalars (lowercase italic) |
| **x**, **y**, **h** | Vectors (lowercase bold) |
| X, W, A | Matrices (uppercase italic) |
| 𝒳, 𝒲 | Tensors of order ≥ 3 (calligraphic uppercase) |
| xᵢ | The i-th element of vector **x** |
| Xᵢⱼ | The (i,j)-th element of matrix X |
| X_{:,j} | The j-th column of X |
| X_{i,:} | The i-th row of X |

## Sets and Spaces

| Notation | Meaning |
|----------|---------|
| ℝ | Real numbers |
| ℝⁿ | n-dimensional real vector space |
| ℝⁿˣᵐ | Space of n × m real matrices |
| ℤ | Integers |
| {1, …, K} | Set of integers from 1 to K, written [K] |
| 𝒮ⁿ⁻¹ | Unit sphere in ℝⁿ |
| Δᴷ | Probability simplex in ℝᴷ: {**p** ∈ ℝᴷ : pᵢ ≥ 0, Σpᵢ = 1} |

## Linear Algebra

| Notation | Meaning |
|----------|---------|
| Xᵀ | Transpose of X |
| X⁻¹ | Inverse of X |
| X⁺ | Moore-Penrose pseudoinverse |
| det(X) | Determinant |
| tr(X) | Trace |
| rank(X) | Rank |
| ‖**x**‖₂ or ‖**x**‖ | Euclidean (ℓ₂) norm |
| ‖**x**‖₁ | ℓ₁ norm |
| ‖X‖_F | Frobenius norm |
| ‖X‖₂ | Spectral norm (largest singular value) |
| λᵢ(X) | i-th eigenvalue of X |
| σᵢ(X) | i-th singular value of X |
| X ≻ 0 | X is positive definite |
| X ⊗ Y | Kronecker product |
| **x** ⊙ **y** | Hadamard (element-wise) product |
| ⟨**x**, **y**⟩ | Inner product: **x**ᵀ**y** |

## Calculus and Optimization

| Notation | Meaning |
|----------|---------|
| ∇f(**x**) | Gradient of f at **x** (column vector) |
| ∇²f(**x**) | Hessian of f at **x** |
| ∂f/∂xᵢ | Partial derivative |
| Jf(**x**) | Jacobian matrix of f at **x** |
| df/dx | Total derivative |
| ∂L/∂W | Gradient of loss L with respect to W (same shape as W) |
| argmin, argmax | Argument that minimizes/maximizes |
| 𝒪(·) | Big-O notation |

## Probability and Statistics

| Notation | Meaning |
|----------|---------|
| p(**x**), q(**x**) | Probability density/mass functions |
| P(A) | Probability of event A |
| P(A\|B) | Conditional probability |
| **x** ~ p | **x** is drawn from distribution p |
| 𝔼[·] | Expectation |
| 𝔼_p[·] | Expectation under distribution p |
| Var(·) | Variance |
| Cov(·,·) | Covariance |
| 𝒩(μ, σ²) | Gaussian distribution |
| 𝒩(**μ**, Σ) | Multivariate Gaussian |
| Cat(**π**) | Categorical distribution with probabilities **π** |
| Ber(p) | Bernoulli distribution |
| U(a, b) | Uniform distribution on [a, b] |

## Information Theory

| Notation | Meaning |
|----------|---------|
| H(p) | Entropy: −𝔼_p[log p(**x**)] |
| H(p, q) | Cross-entropy: −𝔼_p[log q(**x**)] |
| KL(p‖q) | KL divergence: 𝔼_p[log(p(**x**)/q(**x**))] |
| I(X; Y) | Mutual information |

## Neural Networks

| Notation | Meaning |
|----------|---------|
| f_θ(**x**) or f(**x**; θ) | Neural network with parameters θ |
| θ | All learnable parameters |
| W⁽ˡ⁾ | Weight matrix of layer l |
| **b**⁽ˡ⁾ | Bias vector of layer l |
| **h**⁽ˡ⁾ | Hidden representation at layer l |
| **z**⁽ˡ⁾ | Pre-activation at layer l: W⁽ˡ⁾**h**⁽ˡ⁻¹⁾ + **b**⁽ˡ⁾ |
| σ(·) | Activation function (generic) |
| ReLU(x) | max(0, x) |
| softmax(**z**) | exp(**z**) / Σⱼ exp(zⱼ) |
| L(θ) or ℒ(θ) | Loss function |
| η | Learning rate |
| B | Mini-batch size |
| T | Number of time steps (sequences) or diffusion steps |
| N | Number of training examples |
| D | Input dimension |
| K | Number of classes |
| L | Number of layers |

## Convolutional Networks

| Notation | Meaning |
|----------|---------|
| * | Convolution operator |
| ⋆ | Cross-correlation (used interchangeably with * in deep learning) |
| Cᵢₙ, Cₒᵤₜ | Number of input/output channels |
| k | Kernel size |
| s | Stride |
| p | Padding |

## Sequence Models

| Notation | Meaning |
|----------|---------|
| **x**₁, …, **x**_T | Input sequence |
| **h**_t | Hidden state at time t |
| **c**_t | Cell state (LSTM) at time t |
| **o**_t | Output at time t |

## Transformers

| Notation | Meaning |
|----------|---------|
| Q, K, V | Query, key, value matrices |
| d_k, d_v | Key and value dimensions |
| d_model | Model dimension |
| n_heads | Number of attention heads |
| Attention(Q,K,V) | softmax(QKᵀ/√d_k)V |
| PE(pos, i) | Positional encoding |

## Generative Models

| Notation | Meaning |
|----------|---------|
| **z** | Latent variable |
| p_θ(**x**) | Model distribution (generative) |
| q_φ(**z**\|**x**) | Approximate posterior (encoder) |
| p_θ(**x**\|**z**) | Decoder / likelihood |
| p(**z**) | Prior distribution |
| ELBO | Evidence lower bound |
| **ε** | Noise variable (reparameterization trick) |

## Diffusion Models

| Notation | Meaning |
|----------|---------|
| **x**₀ | Clean data |
| **x**_t | Noisy data at diffusion step t |
| β_t | Noise schedule |
| ᾱ_t | Cumulative product: ∏ₛ₌₁ᵗ (1 − βₛ) |
| ε_θ(**x**_t, t) | Noise prediction network |
| s_θ(**x**, t) | Score function estimate: ∇_**x** log p_t(**x**) |

## Alignment

| Notation | Meaning |
|----------|---------|
| π_θ | Policy (language model being trained) |
| π_ref | Reference policy |
| r_φ | Reward model |
| y_w, y_l | Preferred and dispreferred responses |

## Common Abbreviations

| Abbreviation | Meaning |
|--------------|---------|
| MLP | Multi-layer perceptron |
| CNN | Convolutional neural network |
| RNN | Recurrent neural network |
| LSTM | Long short-term memory |
| GRU | Gated recurrent unit |
| SGD | Stochastic gradient descent |
| Adam | Adaptive moment estimation |
| LR | Learning rate |
| BN | Batch normalization |
| LN | Layer normalization |
| FFN | Feed-forward network |
| MHA | Multi-head attention |
| PE | Positional encoding |
| VAE | Variational autoencoder |
| GAN | Generative adversarial network |
| DDPM | Denoising diffusion probabilistic model |
| SDE | Stochastic differential equation |
| ODE | Ordinary differential equation |
| EBM | Energy-based model |
| NF | Normalizing flow |
| MoE | Mixture of experts |
| SSM | State-space model |
| SFT | Supervised fine-tuning |
| RLHF | Reinforcement learning from human feedback |
| DPO | Direct preference optimization |
| LoRA | Low-rank adaptation |
| RAG | Retrieval-augmented generation |
| BPE | Byte pair encoding |
| FID | Fréchet inception distance |
| ELBO | Evidence lower bound |
| KL | Kullback-Leibler |
| MLE | Maximum likelihood estimation |
| MAP | Maximum a posteriori |
| i.i.d. | Independent and identically distributed |
