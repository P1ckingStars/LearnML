# Glossary of Deep Learning Terms

Over 150 key terms used in this course, organized alphabetically. Definitions aim for precision at a graduate level while remaining accessible.

---

## A

**Activation Function.**
A nonlinear function applied element-wise to the output of a linear transformation in a neural network. Without nonlinearities, a multi-layer network collapses to a single linear map. Common choices: ReLU, GELU, SiLU/Swish, sigmoid, tanh.

**Adam (Adaptive Moment Estimation).**
An optimizer that maintains per-parameter exponential moving averages of the first moment (mean) and second moment (uncentered variance) of gradients. Update rule uses bias-corrected moment estimates to adapt the learning rate for each parameter. Default hyperparameters: beta_1=0.9, beta_2=0.999, epsilon=1e-8.

**AdamW.**
A variant of Adam that decouples weight decay from the gradient-based update. In standard Adam, L2 regularization is applied to the gradient; in AdamW, weight decay is applied directly to the parameters after the Adam step. This distinction matters for adaptive optimizers.

**Adversarial Examples.**
Inputs crafted by adding small, often imperceptible perturbations to cause a model to make incorrect predictions with high confidence. Formally, for a classifier f and input x with true label y, an adversarial example x' satisfies f(x') != y and ||x' - x|| < epsilon for some norm and threshold epsilon.

**Alignment.**
The problem of ensuring that an AI system's behavior conforms to human intentions, values, and ethical norms. In the context of LLMs, alignment typically involves training models to be helpful, harmless, and honest through techniques such as RLHF and Constitutional AI.

**Attention Mechanism.**
A function that computes a weighted combination of value vectors, where the weights are derived from compatibility scores between a query and a set of keys. In scaled dot-product attention: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V. The mechanism allows models to dynamically focus on relevant parts of the input.

**Autoencoder.**
A neural network trained to reconstruct its input through a bottleneck. Consists of an encoder f: X -> Z (mapping input to a lower-dimensional latent representation) and a decoder g: Z -> X (mapping back to input space). Trained to minimize reconstruction error ||x - g(f(x))||.

**Autoregressive Model.**
A generative model that factorizes the joint distribution as a product of conditionals: p(x_1, ..., x_n) = product_{i=1}^{n} p(x_i | x_1, ..., x_{i-1}). Each token is generated conditioned on all previous tokens. GPT-style language models are autoregressive.

## B

**Backpropagation.**
An efficient algorithm for computing gradients of a scalar loss with respect to all parameters of a neural network. Applies the chain rule in reverse topological order through the computational graph, accumulating gradients from output to input. Computational cost is roughly twice that of a forward pass.

**Batch Normalization.**
A technique that normalizes activations within a mini-batch to have zero mean and unit variance, followed by a learnable affine transformation. During training, uses batch statistics; during inference, uses exponential moving averages. Stabilizes training and allows higher learning rates.

**Beam Search.**
A decoding strategy for autoregressive models that maintains the top-k highest-probability partial sequences at each step, expanding each by one token and keeping the best k overall. Wider beams (larger k) approximate the maximum-probability sequence more closely but are more expensive.

**BLEU Score.**
Bilingual Evaluation Understudy. A metric for evaluating generated text against reference translations, based on n-gram precision with a brevity penalty. Widely used in machine translation; scores range from 0 to 1 (often reported as 0-100).

**Byte Pair Encoding (BPE).**
A subword tokenization algorithm that iteratively merges the most frequent pair of adjacent tokens in a corpus. Starting from individual characters, BPE builds a vocabulary of subword units that balances vocabulary size with the ability to represent any string.

## C

**Causal Attention (Masked Self-Attention).**
Self-attention where each position can only attend to itself and preceding positions, enforced by masking future positions with negative infinity before the softmax. This ensures the autoregressive property: the output at position i depends only on positions 1 through i.

**Chain of Thought (CoT).**
A prompting technique where the model is encouraged to produce intermediate reasoning steps before giving a final answer. This has been shown to significantly improve performance on arithmetic, commonsense, and symbolic reasoning tasks, particularly for large language models.

**Classifier-Free Guidance.**
A technique for conditional generation in diffusion models that interpolates between conditional and unconditional score estimates: `score_guided = (1 + w) * score_conditional - w * score_unconditional`. Higher guidance weight w produces samples more aligned with the condition at the cost of diversity.

**Contrastive Learning.**
A self-supervised learning approach that trains representations by pulling together embeddings of similar (positive) pairs and pushing apart embeddings of dissimilar (negative) pairs. The InfoNCE loss is the most common objective: L = -log(exp(sim(z_i, z_j)/tau) / sum_k exp(sim(z_i, z_k)/tau)).

**Convolution (in neural networks).**
A linear operation that applies a learnable kernel (filter) to local patches of the input, sharing weights across spatial positions. For a 2D convolution with input I and kernel K: `(I * K)[i,j] = sum_{m,n} I[i+m, j+n] K[m, n]`. Provides translation equivariance and parameter efficiency.

**Cross-Entropy Loss.**
The standard loss for classification: L = -sum_k y_k log(p_k), where y is the one-hot target and p is the predicted probability distribution. Equivalent to the negative log-likelihood of the correct class. Minimizing cross-entropy is equivalent to minimizing KL divergence from the data distribution.

**Curriculum Learning.**
A training strategy that presents examples in a meaningful order, typically from easy to hard, rather than randomly. Motivated by the observation that structured training orders can lead to faster convergence and better generalization.

## D

**Data Augmentation.**
Techniques that artificially increase the effective size of a training set by applying label-preserving transformations to existing examples. In computer vision: random cropping, flipping, color jittering, Mixup, CutMix. In NLP: back-translation, synonym replacement, paraphrasing.

**Decoder (in seq2seq).**
The component of an encoder-decoder architecture that generates the output sequence. In transformers, the decoder uses causal self-attention on its own outputs and cross-attention to the encoder's representations.

**Diffusion Model.**
A generative model that learns to reverse a gradual noising process. The forward process adds Gaussian noise to data over T steps until it becomes pure noise. The reverse process (learned by the model) iteratively denoises to generate samples. Training objective: predict the noise added at each step.

**Discriminator.**
In a GAN, the network that classifies inputs as real (from the data distribution) or fake (from the generator). Trained to maximize classification accuracy while the generator is trained to minimize it, creating an adversarial game.

**Distillation (Knowledge Distillation).**
Training a smaller "student" model to mimic the outputs (soft predictions or internal representations) of a larger "teacher" model. The student is typically trained on a combination of the hard labels and the teacher's soft probability distributions (with temperature scaling).

**Distributed Training.**
Training a model across multiple devices (GPUs, TPUs, or machines). Data parallelism replicates the model and splits data across devices. Model parallelism (tensor or pipeline) splits the model itself. FSDP shards parameters, gradients, and optimizer states across devices.

**Dropout.**
A regularization technique that randomly sets activations to zero during training with probability p. At inference time, activations are scaled by (1-p) (or equivalently, training uses inverted dropout scaling by 1/(1-p)). Can be interpreted as training an ensemble of subnetworks.

## E

**Embedding.**
A dense, learned vector representation of a discrete input (token, word, entity). An embedding layer is a lookup table: a matrix E of shape (vocab_size, d_model) where row i is the embedding of token i. Embeddings map sparse one-hot vectors to dense continuous representations.

**Emergent Abilities.**
Capabilities that appear in large language models only at sufficient scale, apparently absent in smaller models. Examples include chain-of-thought reasoning, in-context learning, and certain forms of arithmetic. The existence and nature of emergence is an active area of debate.

**Encoder (in seq2seq).**
The component that processes the input sequence and produces a set of representations (one per input position). In transformers, the encoder uses bidirectional self-attention, allowing each position to attend to all others.

**Epoch.**
One complete pass through the entire training dataset. A model trained for n epochs has seen each training example exactly n times (in expectation, accounting for shuffling and dropout of incomplete batches).

**Evidence Lower Bound (ELBO).**
A lower bound on the log-likelihood of observed data in a latent variable model: log p(x) >= E_q[log p(x|z)] - KL(q(z|x) || p(z)). Maximized during training of variational autoencoders. The gap between the ELBO and the true log-likelihood equals KL(q(z|x) || p(z|x)).

## F

**Few-Shot Learning.**
The ability to learn from very few labeled examples per class. In the context of LLMs, few-shot learning refers to providing a small number of input-output examples in the prompt to guide the model's behavior, without any gradient updates.

**Fine-Tuning.**
Adapting a pretrained model to a specific downstream task by continuing training (usually with a smaller learning rate) on task-specific data. Variants include full fine-tuning (all parameters), head-only fine-tuning (only the classification head), and parameter-efficient fine-tuning (LoRA, adapters, prefix tuning).

**FlashAttention.**
A hardware-aware algorithm for computing exact attention that is both faster and more memory-efficient than standard implementations. Achieves this by tiling the computation to exploit GPU SRAM (fast on-chip memory) and avoiding materialization of the full N x N attention matrix in HBM.

**Forward Pass.**
Computing the output of a neural network given an input by propagating activations through the network layer by layer. In a computational graph, this corresponds to evaluating nodes in topological order.

**Fully Connected Layer (Dense Layer, Linear Layer).**
A layer where every input unit is connected to every output unit: y = Wx + b. The most basic neural network layer, parameterized by a weight matrix W and bias vector b.

## G

**GAN (Generative Adversarial Network).**
A framework for training generative models via an adversarial game between a generator G (maps noise to data) and discriminator D (distinguishes real from generated data). The minimax objective: min_G max_D E[log D(x)] + E[log(1 - D(G(z)))].

**Gating Mechanism.**
A learned function that controls information flow, typically outputting values in [0, 1] via a sigmoid. Used in LSTMs (input, forget, output gates), GRUs, mixture of experts (gating network), and gated linear units.

**GELU (Gaussian Error Linear Unit).**
An activation function defined as `GELU(x) = x * Phi(x)`, where Phi is the standard Gaussian CDF. Approximated as `x * sigma(1.702x)`. Smoother than ReLU; the default activation in transformers (BERT, GPT).

**Generalization.**
The ability of a model to perform well on unseen data from the same distribution as the training data. The generalization gap is the difference between training and test performance. Deep learning theory seeks to explain why overparameterized models generalize despite classical theory suggesting they should overfit.

**Gradient Accumulation.**
A technique to simulate larger batch sizes by accumulating gradients over multiple forward-backward passes before performing an optimizer step. The loss is divided by the number of accumulation steps to maintain correct gradient magnitude.

**Gradient Clipping.**
Constraining gradient magnitude to prevent exploding gradients. Norm clipping scales the gradient vector to have maximum norm c: g <- g * min(1, c/||g||). Value clipping truncates individual gradient components to [-c, c]. Norm clipping is more common.

**Gradient Descent.**
An optimization algorithm that iteratively updates parameters in the direction of the negative gradient: theta_{t+1} = theta_t - alpha * nabla L(theta_t). Stochastic gradient descent (SGD) approximates the full gradient with a mini-batch estimate.

**Ground Truth.**
The correct or reference label for a data point. In supervised learning, ground truth labels define the target that the model is trained to predict.

## H

**Hallucination.**
The generation of text that is fluent and plausible-sounding but factually incorrect or unsupported by the input context. A significant challenge for large language models, particularly in knowledge-intensive tasks.

**Hessian.**
The matrix of second-order partial derivatives of a scalar function: H_{ij} = d^2 f / (d x_i d x_j). In optimization, the Hessian characterizes local curvature: positive definite at a local minimum, negative definite at a local maximum, indefinite at a saddle point.

**Hyperparameter.**
A parameter that controls the training process but is not learned from data. Examples: learning rate, batch size, number of layers, hidden dimension, dropout rate, weight decay. Hyperparameters are typically set via grid search, random search, or Bayesian optimization.

## I

**In-Context Learning (ICL).**
The ability of large language models to learn tasks from examples provided in the prompt, without any gradient updates to the model's parameters. The model adapts its behavior based on the pattern established by the examples.

**Information Bottleneck.**
A framework for learning representations that retain information relevant to a target while compressing away irrelevant information. Formally: minimize I(X; Z) subject to I(Z; Y) >= threshold, where Z is the representation, X the input, and Y the target.

**Instruction Tuning.**
Fine-tuning a language model on a dataset of (instruction, response) pairs to improve the model's ability to follow natural language instructions. Distinct from RLHF, which uses human preference comparisons rather than demonstrations.

## J

**Jacobian.**
The matrix of first-order partial derivatives of a vector-valued function: J_{ij} = d f_i / d x_j. For f: R^n -> R^m, the Jacobian is an m x n matrix. In neural networks, the Jacobian relates input perturbations to output changes and is central to backpropagation.

## K

**Kernel (in convolution).**
The learnable weight matrix (filter) in a convolutional layer. A kernel of size k x k has k^2 learned weights that are applied to every spatial location of the input feature map (weight sharing).

**Kernel (in kernel methods).**
A function k(x, x') that computes an inner product in a (possibly infinite-dimensional) feature space without explicitly computing the feature map. The kernel trick allows algorithms that depend only on inner products to operate in high-dimensional spaces efficiently.

**KL Divergence (Kullback-Leibler Divergence).**
A measure of how one probability distribution p differs from a reference distribution q: KL(p || q) = E_p[log(p/q)]. Non-negative (equals zero iff p = q almost everywhere) and asymmetric. Used in VAE training, policy optimization, and information-theoretic analysis.

**Knowledge Distillation.**
See Distillation.

## L

**Latent Variable.**
An unobserved variable in a probabilistic model that captures hidden structure in the data. In VAEs, the latent variable z encodes the underlying factors of variation. The relationship p(x) = integral p(x|z)p(z)dz connects observed and latent spaces.

**Layer Normalization.**
Normalizes activations across the feature dimension for each individual example: y = (x - mu) / sigma * gamma + beta, where mu and sigma are computed per-example across features. Unlike batch normalization, independent of batch size; standard in transformers.

**Learning Rate.**
The step size in gradient descent: theta_{t+1} = theta_t - alpha * g_t. The most important hyperparameter in deep learning. Too large causes divergence; too small causes slow convergence. Typically scheduled (warmup, cosine decay, etc.) rather than kept constant.

**Learning Rate Schedule.**
A predetermined or adaptive rule for changing the learning rate during training. Common schedules: linear warmup + cosine decay (transformers), step decay (CNNs), one-cycle (super-convergence). Warmup prevents early instability with adaptive optimizers.

**Linear Probe.**
A simple linear classifier trained on frozen representations from a pretrained model. Used to evaluate representation quality: if a linear probe achieves high accuracy, the representations have linearly separable structure for the task.

**LoRA (Low-Rank Adaptation).**
A parameter-efficient fine-tuning method that freezes pretrained weights and injects trainable low-rank decomposition matrices (W = W_0 + AB where A and B are low-rank) into selected layers. Reduces trainable parameters by orders of magnitude while approaching full fine-tuning performance.

**Loss Function.**
A scalar function measuring the discrepancy between model predictions and targets. The training objective is to minimize the expected loss over the data distribution. Common losses: cross-entropy (classification), MSE (regression), contrastive losses (representation learning).

## M

**Masked Language Modeling (MLM).**
A pretraining objective where a fraction of input tokens are randomly replaced with a [MASK] token, and the model predicts the original tokens. Used by BERT. Unlike autoregressive modeling, MLM allows bidirectional context.

**Maximum Likelihood Estimation (MLE).**
Estimating parameters by maximizing the likelihood of the observed data: theta_MLE = argmax_theta product_i p(x_i | theta). Equivalently, minimizing the negative log-likelihood. For classification, cross-entropy loss is the negative log-likelihood.

**Mini-Batch.**
A subset of the training data used to compute an approximate gradient in SGD. Mini-batch size (commonly called "batch size") balances gradient estimate quality (larger is more accurate) with computational efficiency and memory constraints. Typical sizes: 16 to 4096.

**Mixed Precision Training.**
Training with a mix of float16 (or bfloat16) and float32 precision. Most operations use lower precision for speed and memory savings; numerically sensitive operations (loss computation, normalization) remain in float32. Loss scaling prevents underflow in float16 gradients.

**Mixture of Experts (MoE).**
An architecture where a gating network routes each input to a subset of "expert" subnetworks. This enables conditional computation: the model has many parameters but only activates a fraction for each input. Allows scaling model capacity without proportionally scaling compute.

**Momentum.**
An acceleration technique for gradient descent that accumulates a velocity vector from past gradients: `v_t = beta * v_{t-1} + g_t; theta_{t+1} = theta_t - alpha * v_t`. Smooths noisy gradients and accelerates convergence along consistent gradient directions.

**Multi-Head Attention.**
Running multiple attention operations in parallel with different learned projections, then concatenating and projecting the results. For h heads with d_model-dimensional inputs: each head uses d_k = d_model/h dimensional projections. Allows attending to information from different representation subspaces.

## N

**Neural Architecture Search (NAS).**
Automated methods for discovering neural network architectures. Approaches include reinforcement learning (controller generates architectures, validation accuracy is reward), evolutionary algorithms, and differentiable search (relaxing discrete choices to continuous).

**Norm (of a vector/matrix).**
A function that assigns a non-negative length or size. L1 norm: ||x||_1 = sum |x_i|. L2 norm: ||x||_2 = sqrt(sum x_i^2). L-infinity norm: ||x||_inf = max |x_i|. Frobenius norm (matrices): ||A||_F = sqrt(sum A_{ij}^2).

**Normalizing Flow.**
A generative model that transforms a simple base distribution (e.g., Gaussian) through a sequence of invertible, differentiable mappings. The exact likelihood is computed via the change-of-variables formula: log p(x) = log p(z) - sum log|det J_i|, where J_i are the Jacobians of each transformation.

## O

**One-Hot Encoding.**
A representation of a categorical variable as a binary vector with a single 1 and all other entries 0. For a vocabulary of size V, token k is represented as a V-dimensional vector with 1 at position k.

**Optimizer.**
An algorithm that updates model parameters to minimize the loss function. SGD, Adam, and AdamW are the most common. The optimizer state (momentum buffers, variance estimates) can consume significant memory, especially for adaptive methods.

**Overfitting.**
When a model performs well on training data but poorly on unseen data, indicating it has memorized training-specific patterns rather than learning generalizable features. Addressed through regularization (dropout, weight decay, data augmentation, early stopping).

## P

**Perplexity.**
A metric for evaluating language models: PPL = exp(-(1/N) sum log p(x_i | x_{<i})). Lower is better. Perplexity of k means the model is as uncertain as a uniform distribution over k choices. Standard metric for language model evaluation.

**Positional Encoding.**
A mechanism to inject sequence order information into transformer models, which have no inherent notion of position. Approaches: sinusoidal (fixed), learned embeddings, Rotary Position Embedding (RoPE), ALiBi (attention biases). Without positional information, transformers treat input as a set.

**Pretraining.**
The first phase of a two-phase training paradigm where a model learns general representations from a large unlabeled (or weakly labeled) corpus. Pretraining objectives: next-token prediction (GPT), masked language modeling (BERT), contrastive learning (CLIP). The pretrained model is then fine-tuned on downstream tasks.

**Prompt Engineering.**
The practice of designing input text (prompts) to elicit desired behavior from a language model. Techniques include few-shot examples, chain-of-thought instructions, system prompts, and structured output formats. The sensitivity of LLMs to prompt phrasing is a well-documented phenomenon.

## Q

**Quantization.**
Reducing the numerical precision of model weights and/or activations (e.g., from float32 to int8 or int4) to decrease model size and inference cost. Post-training quantization requires no retraining; quantization-aware training simulates reduced precision during training for higher accuracy.

## R

**Recall.**
The fraction of relevant instances that are retrieved: recall = true positives / (true positives + false negatives). In top-k recall, measures the fraction of relevant items in the top k predictions. Contrasts with precision (fraction of retrieved instances that are relevant).

**Recurrent Neural Network (RNN).**
A network that processes sequences by maintaining a hidden state that is updated at each time step: h_t = f(h_{t-1}, x_t). The same parameters are shared across time steps. Standard RNNs suffer from vanishing/exploding gradients for long sequences; LSTMs and GRUs mitigate this.

**Regularization.**
Techniques to prevent overfitting by constraining the model. Explicit: L2 weight decay (adds lambda ||theta||^2 to loss), L1 penalty, dropout. Implicit: data augmentation, early stopping, batch size, noise injection. The choice of regularization encodes prior assumptions about the solution.

**Reinforcement Learning from Human Feedback (RLHF).**
A method for aligning language models with human preferences. Process: (1) collect human comparisons of model outputs, (2) train a reward model on these comparisons, (3) optimize the language model against the reward model using PPO or similar RL algorithms.

**ReLU (Rectified Linear Unit).**
An activation function defined as ReLU(x) = max(0, x). Gradient is 1 for x > 0 and 0 for x < 0 (undefined at 0). Advantages: fast computation, mitigates vanishing gradients. Disadvantage: "dying ReLU" problem where neurons can become permanently inactive.

**Reparameterization Trick.**
A technique for backpropagating through stochastic sampling. Instead of sampling z ~ N(mu, sigma^2) directly, express z = mu + sigma * epsilon where epsilon ~ N(0, 1). This moves the stochasticity to a fixed distribution, allowing gradients to flow through mu and sigma.

**Residual Connection (Skip Connection).**
An additive shortcut that bypasses one or more layers: y = F(x) + x. Enables training of very deep networks by providing gradient highways. Central to ResNets, transformers, and virtually all modern deep architectures.

**RMSNorm (Root Mean Square Normalization).**
A simplification of layer normalization that normalizes by the RMS of activations without centering: y = x / RMS(x) * gamma. Slightly faster than LayerNorm; used in LLaMA, PaLM, and other modern LLMs.

**RoPE (Rotary Position Embedding).**
A positional encoding that applies rotation matrices to query and key vectors based on their positions. The dot product between rotated queries and keys depends only on the relative position, encoding relative positional information while being compatible with efficient attention implementations.

## S

**Scaled Dot-Product Attention.**
The attention mechanism used in transformers: Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V. The scaling factor 1/sqrt(d_k) prevents the dot products from growing large in magnitude, which would push the softmax into regions with extremely small gradients.

**Self-Attention.**
An attention mechanism where queries, keys, and values all come from the same sequence. Each position attends to all positions (including itself) in the same sequence, computing a weighted combination based on pairwise compatibility.

**Self-Supervised Learning.**
Learning representations from unlabeled data by defining a pretext task that provides supervision from the data itself. Examples: predicting masked tokens (BERT), predicting the next token (GPT), contrastive learning between augmented views (SimCLR), predicting rotations.

**Sigmoid Function.**
The logistic function: sigma(x) = 1/(1 + exp(-x)). Maps R to (0, 1). Used as a gating function and as the activation for binary classification output layers. Derivative: sigma'(x) = sigma(x)(1 - sigma(x)).

**Softmax.**
A function that maps a vector of real numbers to a probability distribution: softmax(x)_i = exp(x_i) / sum_j exp(x_j). Properties: output sums to 1, all entries are positive, monotone, differentiable. Temperature parameter T scales the input: softmax(x/T).

**State Space Model (SSM).**
A sequence model inspired by continuous-time dynamical systems: dx/dt = Ax + Bu, y = Cx + Du. When discretized, this becomes a linear recurrence. Mamba extends SSMs with input-dependent (selective) parameters. SSMs offer linear scaling in sequence length vs. quadratic for attention.

**Stochastic Gradient Descent (SGD).**
Gradient descent using gradient estimates from random mini-batches rather than the full dataset. The stochasticity provides implicit regularization and enables escape from sharp local minima. With appropriate learning rate schedule, SGD converges to a neighborhood of the optimum.

**Stride.**
In convolutions, the step size by which the kernel moves across the input. Stride 1 preserves spatial dimensions (with appropriate padding); stride 2 halves spatial dimensions, serving as a form of downsampling.

## T

**Temperature (in sampling).**
A scalar parameter that controls the randomness of sampling from a probability distribution. Applied by dividing logits by T before softmax: p_i = exp(z_i/T) / sum exp(z_j/T). T < 1 sharpens (more deterministic); T > 1 flattens (more random); T -> 0 gives argmax.

**Tensor.**
A multi-dimensional array, generalizing scalars (0D), vectors (1D), matrices (2D) to arbitrary dimensions. In deep learning frameworks, tensors are the fundamental data structure, carrying data and supporting automatic differentiation.

**Tokenization.**
The process of converting raw text into a sequence of discrete tokens from a fixed vocabulary. Methods: word-level, character-level, subword (BPE, WordPiece, SentencePiece). Subword tokenization balances vocabulary size with the ability to represent any text and handle rare words.

**Top-k Sampling.**
A text generation strategy that samples from the k most probable next tokens (zeroing out all others). Reduces the chance of sampling low-probability "tail" tokens. Typical k: 40-100.

**Top-p Sampling (Nucleus Sampling).**
A text generation strategy that samples from the smallest set of tokens whose cumulative probability exceeds p. Adapts the number of candidate tokens dynamically based on the model's confidence. Typical p: 0.9-0.95.

**Transfer Learning.**
The practice of applying knowledge learned from one task or domain to a different but related task or domain. In deep learning, typically implemented by pretraining on a large dataset and fine-tuning on a smaller target dataset. The pretrained features serve as a strong initialization.

**Transformer.**
An architecture based entirely on attention mechanisms, without recurrence or convolution. Consists of stacked layers of multi-head self-attention and position-wise feed-forward networks with residual connections and layer normalization. Introduced by Vaswani et al. (2017); the dominant architecture in NLP and increasingly in vision and other domains.

## U

**Underfitting.**
When a model is too simple to capture the underlying patterns in the data, resulting in poor performance on both training and test data. Addressed by increasing model capacity, training longer, reducing regularization, or using a more expressive architecture.

## V

**Vanishing Gradient Problem.**
The phenomenon where gradients become exponentially small as they are propagated through many layers during backpropagation, preventing early layers from learning. Caused by repeatedly multiplying by values less than 1 (e.g., sigmoid derivatives). Mitigated by ReLU activations, residual connections, careful initialization, and normalization layers.

**Variational Autoencoder (VAE).**
A generative model that learns a latent representation by jointly training an encoder q(z|x) (approximate posterior) and decoder p(x|z) (likelihood) to maximize the ELBO. Uses the reparameterization trick to enable gradient-based optimization through the stochastic latent variable.

**Variational Inference.**
A method for approximating intractable posterior distributions by casting inference as optimization: find the distribution q*(z) in some family Q that minimizes KL(q(z) || p(z|x)). Equivalently, maximize the ELBO. Amortized variational inference uses a neural network to predict q's parameters.

**Vector Quantization.**
Mapping continuous representations to a finite set of discrete codebook vectors. In VQ-VAE, the encoder output is replaced with the nearest codebook entry. Straight-through estimator is used for gradients. Enables discrete latent spaces for generation with autoregressive priors.

## W

**Warmup (Learning Rate Warmup).**
A training strategy where the learning rate starts from a small value and increases linearly (or otherwise) to the target value over the first few hundred to few thousand steps. Prevents early training instability, especially with adaptive optimizers like Adam, where moment estimates are poorly calibrated initially.

**Weight Decay.**
A regularization technique that shrinks weights toward zero at each update: `theta_{t+1} = (1 - lambda * alpha) * theta_t - alpha * g_t`. In L2 regularization, an equivalent penalty term `lambda ||theta||^2` is added to the loss. Weight decay and L2 regularization are equivalent for SGD but differ for Adam (see AdamW).

**Weight Initialization.**
The method for setting initial parameter values before training. Critical for stable training. Common methods: Xavier/Glorot (uniform or normal, scaled by fan-in and fan-out), Kaiming/He (scaled by fan-in, designed for ReLU), orthogonal initialization (preserves gradient norms).

**Weight Tying.**
Sharing parameters between the input embedding matrix and the output projection matrix in language models. Since both map between token indices and d_model-dimensional space, tying them reduces parameters and often improves performance.

## X

**Xavier Initialization (Glorot Initialization).**
A weight initialization scheme where weights are drawn from a distribution with variance 2/(fan_in + fan_out), where fan_in and fan_out are the input and output dimensions of the layer. Designed to maintain activation and gradient variances across layers with linear or tanh activations.

## Z

**Zero-Shot Learning.**
The ability to perform a task without any task-specific training examples. For LLMs, this means performing a task given only a natural language description (instruction) without any demonstrations. More broadly, classifying instances of classes not seen during training, often using auxiliary information like class descriptions.

---

## Symbols and Abbreviations

| Abbreviation | Expansion |
|---|---|
| AMP | Automatic Mixed Precision |
| BN | Batch Normalization |
| BPE | Byte Pair Encoding |
| CNN | Convolutional Neural Network |
| CoT | Chain of Thought |
| CTC | Connectionist Temporal Classification |
| DDP | Distributed Data Parallel |
| DDPM | Denoising Diffusion Probabilistic Model |
| DPO | Direct Preference Optimization |
| ELBO | Evidence Lower Bound |
| EMA | Exponential Moving Average |
| FFN | Feed-Forward Network |
| FSDP | Fully Sharded Data Parallel |
| GAN | Generative Adversarial Network |
| GELU | Gaussian Error Linear Unit |
| GPU | Graphics Processing Unit |
| GRU | Gated Recurrent Unit |
| HBM | High Bandwidth Memory |
| ICL | In-Context Learning |
| KL | Kullback-Leibler |
| LLM | Large Language Model |
| LN | Layer Normalization |
| LoRA | Low-Rank Adaptation |
| LSTM | Long Short-Term Memory |
| MAE | Mean Absolute Error / Masked Autoencoder |
| MHA | Multi-Head Attention |
| MLE | Maximum Likelihood Estimation |
| MLM | Masked Language Modeling |
| MLP | Multi-Layer Perceptron |
| MoE | Mixture of Experts |
| MSE | Mean Squared Error |
| NAS | Neural Architecture Search |
| NLP | Natural Language Processing |
| NTK | Neural Tangent Kernel |
| PPO | Proximal Policy Optimization |
| QKV | Query, Key, Value |
| RLHF | Reinforcement Learning from Human Feedback |
| RNN | Recurrent Neural Network |
| RoPE | Rotary Position Embedding |
| SGD | Stochastic Gradient Descent |
| SRAM | Static Random Access Memory |
| SSM | State Space Model |
| SwiGLU | Swish-Gated Linear Unit |
| TPU | Tensor Processing Unit |
| VAE | Variational Autoencoder |
| ViT | Vision Transformer |
| VQ | Vector Quantization |
