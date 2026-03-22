# Lecture 09d: Multimodal Models

## 1. Learning Objectives

By the end of this lecture, the student will be able to:

1. **Derive** the contrastive learning objective (InfoNCE) used in CLIP from first principles, connecting it to mutual information maximization and noise-contrastive estimation.
2. **Explain** image tokenization strategies: ViT patch embeddings, VQGAN discrete codes, and their trade-offs.
3. **Compare** multimodal fusion architectures: late fusion (CLIP), cross-attention fusion (Flamingo), and early fusion (LLaVA, GPT-4V), analyzing their capacity, efficiency, and training requirements.
4. **Describe** the Flamingo architecture, including its perceiver resampler and gated cross-attention mechanism.
5. **Implement** a simplified CLIP model and a multimodal LLM (LLaVA-style) in PyTorch.
6. **Connect** text-to-image generation to the diffusion framework (from Lecture 08) and explain how CLIP embeddings condition the generation process.

---

## 2. Motivation and Context

### 2.1 Why Multimodality?

Human cognition is inherently multimodal: we perceive the world through vision, language, audio, touch, and more. Our understanding of "dog" is not confined to the text string -- it encompasses visual appearance, the sound of barking, the concept of loyalty, and countless associations. Building AI systems that understand and generate across modalities is essential for:

1. **Richer understanding**: Grounding language in perception (what does "red" look like?).
2. **Broader capabilities**: Image captioning, visual question answering, text-to-image generation.
3. **Transfer learning**: Representations learned from one modality can benefit others.
4. **Real-world applications**: Robotics (vision + language), healthcare (imaging + clinical notes), autonomous driving (cameras + LiDAR + language).

### 2.2 The Alignment Problem

The central challenge in multimodal learning is **alignment**: learning a shared representation space where semantically related concepts from different modalities are close together. An image of a dog and the text "a photo of a dog" should map to nearby points, while an image of a cat and "a photo of a dog" should be distant.

### 2.3 Historical Progression

| Era | Approach | Example |
|-----|----------|---------|
| Pre-2020 | Task-specific models | Image captioning with CNN+LSTM |
| 2021 | Contrastive pre-training | CLIP (Radford et al.) |
| 2022 | Cross-modal attention | Flamingo (Alayrac et al.) |
| 2023--24 | Multimodal LLMs | LLaVA, GPT-4V |
| 2024+ | Native multimodal | Unified generation (Gemini, etc.) |

---

## 3. Core Theory

### 3.1 Contrastive Learning: From Mutual Information to InfoNCE

**Definition 3.1 (Mutual Information).** For random variables $X$ (images) and $Y$ (text captions), the mutual information is:

$$I(X; Y) = \mathbb{E}_{p(x,y)}\left[\log \frac{p(x, y)}{p(x)p(y)}\right] = \mathbb{E}_{p(x,y)}\left[\log \frac{p(y|x)}{p(y)}\right]$$

Maximizing $I(X; Y)$ encourages the model to learn representations that capture the shared information between modalities.

**The Problem.** Direct estimation of $I(X; Y)$ is intractable in high dimensions. We need a tractable lower bound.

**Theorem 3.1 (InfoNCE Lower Bound).** Let $f(x, y) = \phi(x)^T \psi(y)$ be a score function parameterized by encoders $\phi$ and $\psi$. Given a positive pair $(x, y) \sim p(x, y)$ and $N-1$ negative samples $\{y_j^-\}_{j=1}^{N-1}$ drawn from the marginal $p(y)$, the InfoNCE loss:

$$\mathcal{L}_{\text{InfoNCE}} = -\mathbb{E}\left[\log \frac{e^{f(x, y)}}{\sum_{j=0}^{N-1} e^{f(x, y_j)}}\right]$$

where $y_0 = y$ (the positive) and $y_1, \ldots, y_{N-1}$ are negatives, provides a lower bound on mutual information:

$$I(X; Y) \geq \log N - \mathcal{L}_{\text{InfoNCE}}$$

**Proof.** We use the connection to noise-contrastive estimation. Consider the classification task: given $(x, y_0, y_1, \ldots, y_{N-1})$ where exactly one $y_j$ is the true positive, predict which one. The optimal Bayes classifier assigns:

$$p(\text{positive} = j \mid x, \{y_i\}) = \frac{p(y_j | x)}{p(y_j | x) + (N-1)p(y_j)} \propto \frac{p(y_j | x)}{p(y_j)}$$

The InfoNCE loss approximates the log-likelihood of this classifier using the score function $f(x, y)$ as a proxy for $\log \frac{p(y|x)}{p(y)}$. The bound follows because:

$$\mathcal{L}_{\text{InfoNCE}} = \mathbb{E}\left[-\log \frac{e^{f(x, y)}}{\frac{1}{N}\sum_j e^{f(x, y_j)}}\right] + \log N$$

$$\geq -I(X; Y) + \log N$$

Rearranging: $I(X; Y) \geq \log N - \mathcal{L}_{\text{InfoNCE}}$. $\blacksquare$

**Remark.** As $N \to \infty$, the bound becomes tight. This means larger batch sizes (more negatives) give a better approximation of mutual information, explaining why CLIP uses very large batches (32,768).

### 3.2 CLIP: Contrastive Language-Image Pre-training

**Definition 3.2 (CLIP Objective).** Given a batch of $N$ image-text pairs $\{(I_i, T_i)\}_{i=1}^N$, CLIP learns image encoder $\phi$ and text encoder $\psi$ by minimizing the symmetric InfoNCE loss:

$$\mathcal{L}_{\text{CLIP}} = \frac{1}{2}\left(\mathcal{L}_{\text{I} \to \text{T}} + \mathcal{L}_{\text{T} \to \text{I}}\right)$$

where:

$$\mathcal{L}_{\text{I} \to \text{T}} = -\frac{1}{N}\sum_{i=1}^N \log \frac{\exp(\tau^{-1} \cdot \phi(I_i)^T \psi(T_i))}{\sum_{j=1}^N \exp(\tau^{-1} \cdot \phi(I_i)^T \psi(T_j))}$$

$$\mathcal{L}_{\text{T} \to \text{I}} = -\frac{1}{N}\sum_{i=1}^N \log \frac{\exp(\tau^{-1} \cdot \psi(T_i)^T \phi(I_i))}{\sum_{j=1}^N \exp(\tau^{-1} \cdot \psi(T_i)^T \phi(I_j))}$$

and $\tau > 0$ is a learnable temperature parameter.

**Properties of CLIP:**

1. **Zero-shot classification**: Given class names $\{c_1, \ldots, c_K\}$, classify image $I$ as:
$$\hat{c} = \arg\max_k \phi(I)^T \psi(\text{"a photo of a } c_k\text{"})$$

2. **Emergent alignment**: Without explicit supervision for spatial correspondence, CLIP learns that images and their natural language descriptions share a common semantic space.

3. **Scale of pre-training**: CLIP was trained on 400 million image-text pairs from the internet (WIT dataset), using ViT-L/14 as the image encoder and a Transformer as the text encoder.

### 3.3 Temperature Parameter Analysis

**Theorem 3.2 (Role of Temperature).** The temperature $\tau$ controls the sharpness of the similarity distribution. Define the softmax distribution over negatives:

$$q_j = \frac{\exp(\phi(I)^T \psi(T_j) / \tau)}{\sum_k \exp(\phi(I)^T \psi(T_k) / \tau)}$$

Then:

- As $\tau \to 0^+$: $q \to$ one-hot on the most similar text (hard matching).
- As $\tau \to \infty$: $q \to$ uniform distribution (no discrimination).

**Proof.** For $\tau \to 0^+$, let $j^* = \arg\max_j \phi(I)^T \psi(T_j)$. Then:

$$q_j = \frac{\exp(s_j / \tau)}{\sum_k \exp(s_k / \tau)} = \frac{1}{\sum_k \exp((s_k - s_j) / \tau)} \to \begin{cases} 1 & \text{if } j = j^* \\ 0 & \text{otherwise} \end{cases}$$

since $s_k - s_{j^*} \leq 0$ for all $k$, making $\exp((s_k - s_{j^*})/\tau) \to 0$ for $k \neq j^*$.

For $\tau \to \infty$: $\exp(s_j/\tau) \to 1$ for all $j$, so $q_j \to 1/N$. $\blacksquare$

CLIP learns $\tau$ via gradient descent. In practice, $\tau$ converges to values around 0.01--0.07, indicating the model prefers relatively sharp distributions.

### 3.4 Image Tokenization

To integrate images into language models, we need to convert continuous image features into a sequence of tokens.

**Method 1: ViT Patch Embeddings (Continuous Tokens)**

An image $I \in \mathbb{R}^{H \times W \times 3}$ is divided into patches of size $P \times P$:

$$\text{Number of tokens} = \frac{H \times W}{P^2}$$

Each patch is linearly projected to dimension $d$:

$$z_i = W_{\text{proj}} \cdot \text{flatten}(\text{patch}_i) + b_{\text{proj}}, \quad z_i \in \mathbb{R}^d$$

For a 224x224 image with $P = 14$: 256 visual tokens. For a 336x336 image: 576 tokens.

**Method 2: VQGAN Discrete Codes**

A Vector-Quantized GAN (Esser et al., 2021) encodes images into a grid of discrete codebook indices:

1. **Encoder**: $I \mapsto z_e \in \mathbb{R}^{h \times w \times d}$ (continuous feature map).
2. **Quantization**: Each spatial feature is mapped to its nearest codebook entry:
$$z_q[i, j] = \arg\min_{c_k \in \mathcal{C}} \|z_e[i, j] - c_k\|_2$$

3. **Result**: A grid of codebook indices $\in \{1, \ldots, |\mathcal{C}|\}^{h \times w}$.

This allows images to be treated as sequences of discrete tokens, enabling autoregressive generation (e.g., DALL-E).

**Trade-offs:**

| Method | Token Type | # Tokens (224px) | Reconstruction | Generative |
|--------|-----------|------------------|----------------|------------|
| ViT patches | Continuous | 256 | N/A (encoder only) | Needs decoder |
| VQGAN | Discrete | 256--1024 | Near-lossless | Autoregressive |

### 3.5 Multimodal Fusion Architectures

**Architecture A: Late Fusion (CLIP)**

Each modality has its own encoder. Interaction happens only at the output level via dot products or cosine similarity.

$$\text{similarity}(I, T) = \phi(I)^T \psi(T)$$

- **Advantages**: Simple, modular (swap encoders), efficient (encode once, compare many).
- **Limitations**: No fine-grained cross-modal reasoning. Cannot answer "what color is the car's door?" because image and text don't interact during encoding.

**Architecture B: Cross-Attention Fusion (Flamingo)**

The language model has access to visual features through cross-attention layers inserted between self-attention layers:

$$h_l^{\text{text}} = \text{SelfAttn}(h_{l-1}^{\text{text}})$$
$$h_l^{\text{fused}} = h_l^{\text{text}} + \tanh(\alpha_l) \cdot \text{CrossAttn}(h_l^{\text{text}},\ z^{\text{visual}})$$

where $z^{\text{visual}}$ are the visual tokens and $\alpha_l$ is a learnable gating parameter initialized to 0 (so the model starts as a pure language model).

- **Advantages**: Fine-grained cross-modal interaction while preserving pre-trained LLM capabilities.
- **Limitations**: Increased computational cost from cross-attention.

**Architecture C: Early Fusion (LLaVA)**

Visual tokens are projected into the language model's embedding space and concatenated with text tokens:

$$\text{input} = [\text{visual tokens}; \text{text tokens}]$$
$$z^{\text{visual}} = W_{\text{proj}} \cdot \phi(I) \in \mathbb{R}^{N_v \times d}$$

The language model processes this concatenated sequence with standard self-attention.

- **Advantages**: Simplest architecture. Visual and text tokens interact through the same attention mechanism.
- **Limitations**: Increases sequence length (and thus attention cost). Relies entirely on pre-trained LLM's ability to handle new token types.

### 3.6 The Flamingo Architecture

**Definition 3.3 (Perceiver Resampler).** Flamingo processes variable-length visual feature sequences through a Perceiver Resampler that compresses them to a fixed number of visual tokens:

Given visual features $z \in \mathbb{R}^{M \times d_v}$ (where $M$ may vary with image resolution or number of video frames), the Perceiver uses $N_q$ learned query vectors $Q \in \mathbb{R}^{N_q \times d}$:

$$Q' = Q + \text{CrossAttn}(Q, z, z)$$
$$Q'' = Q' + \text{FFN}(Q')$$

This is repeated for $L$ layers, producing $N_q$ fixed visual tokens regardless of input resolution.

**Properties:**

- $N_q$ is typically 64--256, much smaller than the raw visual token count.
- Compression preserves semantic content while discarding redundant spatial detail.
- Enables processing of multiple images or video frames without sequence length explosion.

**Definition 3.4 (Gated Cross-Attention).** The gating parameter $\alpha_l$ in Flamingo's cross-attention layers:

$$h_l^{\text{fused}} = h_l^{\text{text}} + \tanh(\alpha_l) \cdot \text{CrossAttn}(h_l^{\text{text}},\ z^{\text{visual}})$$

is initialized to $\alpha_l = 0$, so $\tanh(\alpha_l) = 0$ at initialization. This means:

- At the start of training, the model behaves exactly like the pre-trained LLM.
- The visual contribution is gradually introduced as $\alpha_l$ increases during training.
- This preserves the language model's pre-trained capabilities while learning to incorporate visual information.

### 3.7 Text-to-Image Generation via CLIP-Conditioned Diffusion

**Connection to Lecture 08 (Diffusion Models).** The CLIP text encoder provides the conditioning signal for text-to-image diffusion models like Stable Diffusion and DALL-E 2.

**Stable Diffusion pipeline:**

1. **Text encoding**: $c = \psi_{\text{CLIP}}(\text{prompt}) \in \mathbb{R}^{L \times d}$ (sequence of text features).
2. **Latent diffusion**: The denoising model $\epsilon_\theta(z_t, t, c)$ operates in the latent space of a VAE.
3. **Cross-attention conditioning**: At each denoising step, the noise prediction network uses cross-attention to attend to the text features:
$$\text{Attn}(Q = Wz_t,\ K = W'c,\ V = W''c)$$

4. **Decoding**: The denoised latent $z_0$ is decoded to an image via the VAE decoder.

**Classifier-free guidance** (Ho and Salimans, 2022): To strengthen text conditioning:

$$\hat{\epsilon}_\theta(z_t, t, c) = \epsilon_\theta(z_t, t, \emptyset) + w \cdot (\epsilon_\theta(z_t, t, c) - \epsilon_\theta(z_t, t, \emptyset))$$

where $w > 1$ amplifies the difference between conditional and unconditional predictions. The unconditional prediction $\epsilon_\theta(z_t, t, \emptyset)$ is obtained by dropping the text conditioning (replacing $c$ with a null embedding) during training with probability $p_{\text{uncond}} \approx 0.1$.

---

## 4. Algorithmic Derivation

### 4.1 CLIP Training

```
Algorithm: CLIP_TRAINING
Input: Dataset D of image-text pairs, batch size N
Parameters: Image encoder φ (ViT), text encoder ψ (Transformer), temperature τ
Output: Trained encoders φ, ψ

for each batch {(I_1, T_1), ..., (I_N, T_N)} from D:

    1. Encode images:
       v_i = normalize(φ(I_i))          // (N, d) -- L2 normalized

    2. Encode texts:
       t_i = normalize(ψ(T_i))          // (N, d) -- L2 normalized

    3. Compute similarity matrix:
       S = v @ t^T / τ                   // (N, N) -- scaled cosine similarity

    4. Labels (diagonal is positive):
       labels = arange(N)                // (N,) -- [0, 1, 2, ..., N-1]

    5. Symmetric cross-entropy loss:
       L_i2t = CrossEntropy(S, labels)   // Image-to-text
       L_t2i = CrossEntropy(S^T, labels) // Text-to-image
       L = (L_i2t + L_t2i) / 2

    6. Update φ, ψ, τ via gradient descent

Complexity per batch:
- Image encoding: O(N × C_image)
- Text encoding: O(N × C_text)
- Similarity matrix: O(N² × d)
- Total: O(N × (C_image + C_text) + N²d)
```

### 4.2 LLaVA-Style Multimodal LLM

```
Algorithm: LLAVA_FORWARD
Input: Image I ∈ R^(H, W, 3), text prompt T = [t_1, ..., t_L]
Parameters: Vision encoder φ (frozen CLIP ViT), projection W_proj,
            language model θ (frozen or fine-tuned)
Output: Response tokens

1. Extract visual features:
   v = φ(I)                              // (N_v, d_v), N_v = (H/P)²

2. Project to LLM dimension:
   z_v = v @ W_proj                      // (N_v, d_LLM)

3. Embed text tokens:
   z_t = Embed(T)                        // (L, d_LLM)

4. Concatenate (with special tokens):
   z = [<img>, z_v, </img>, z_t]         // (N_v + L + 2, d_LLM)

5. Forward through LLM:
   logits = LLM(z)                       // (N_v + L + 2, V)

6. Generate response autoregressively from position N_v + L + 2 onward

Training stages:
- Stage 1: Train W_proj only (alignment), φ and θ frozen
- Stage 2: Fine-tune W_proj and θ on instruction data, φ frozen
```

### 4.3 Flamingo Forward Pass

```
Algorithm: FLAMINGO_FORWARD
Input: Images [I_1, ..., I_M], text prompt T
Parameters: Vision encoder φ (frozen), Perceiver resampler P,
            gated cross-attention layers, LLM θ (frozen)
Output: Response tokens

1. Encode each image:
   v_m = φ(I_m)                          // (N_v, d_v) for each image

2. Perceiver resampling (per image):
   for m = 1, ..., M:
       z_m = PerceiverResampler(v_m)      // (N_q, d) -- fixed N_q tokens

3. Embed text:
   h_0 = Embed(T)                        // (L, d)

4. For each LLM layer l = 1, ..., n_layers:
   a. Self-attention (frozen):
      h_l = SelfAttn_l(h_{l-1})          // (L, d)

   b. If layer l has cross-attention (every K layers):
      // Determine which image each text token should attend to
      // (based on interleaved position in the prompt)
      h_l = h_l + tanh(α_l) × CrossAttn_l(h_l, z_relevant)

   c. FFN (frozen):
      h_l = FFN_l(h_l)                   // (L, d)

5. logits = LMHead(h_n_layers)           // (L, V)

Trainable parameters: Perceiver resampler, cross-attention layers, α gates
Frozen parameters: Vision encoder φ, LLM self-attention and FFN
```

---

## 5. PyTorch Implementation

### 5.1 CLIP Model

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class VisionEncoder(nn.Module):
    """
    Simplified Vision Transformer (ViT) for CLIP.

    Extracts patch embeddings and processes through Transformer layers.
    """
    def __init__(self, image_size: int = 224, patch_size: int = 16,
                 d_model: int = 512, n_layers: int = 6, n_heads: int = 8):
        super().__init__()
        self.patch_size = patch_size
        num_patches = (image_size // patch_size) ** 2  # e.g., 196 for 224/16

        # Patch embedding: Conv2d with kernel=stride=patch_size
        self.patch_embed = nn.Conv2d(
            3, d_model, kernel_size=patch_size, stride=patch_size
        )  # (B, 3, H, W) -> (B, d, H/P, W/P)

        # CLS token and positional embeddings
        self.cls_token = nn.Parameter(torch.zeros(1, 1, d_model))       # (1, 1, d)
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, d_model))  # (1, N+1, d)

        # Transformer layers
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=4*d_model,
            activation='gelu', batch_first=True, norm_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)

        # Final projection
        self.ln = nn.LayerNorm(d_model)
        self.proj = nn.Linear(d_model, d_model, bias=False)

        nn.init.normal_(self.cls_token, std=0.02)
        nn.init.normal_(self.pos_embed, std=0.02)

    def forward(self, images):
        """
        Args:
            images: (B, 3, H, W) float tensor, normalized
        Returns:
            features: (B, d) -- CLS token output, L2 normalized
        """
        B = images.shape[0]

        # Patch embedding
        x = self.patch_embed(images)                        # (B, d, H/P, W/P)
        x = x.flatten(2).transpose(1, 2)                   # (B, N_patches, d)

        # Prepend CLS token
        cls = self.cls_token.expand(B, -1, -1)              # (B, 1, d)
        x = torch.cat([cls, x], dim=1)                      # (B, N+1, d)

        # Add positional embedding
        x = x + self.pos_embed                               # (B, N+1, d)

        # Transformer
        x = self.transformer(x)                              # (B, N+1, d)

        # Extract CLS token
        x = self.ln(x[:, 0])                                 # (B, d)
        x = self.proj(x)                                     # (B, d)

        return x

class TextEncoder(nn.Module):
    """
    Transformer text encoder for CLIP.

    Uses causal attention and extracts the [EOS] token as the text representation.
    """
    def __init__(self, vocab_size: int = 49408, max_length: int = 77,
                 d_model: int = 512, n_layers: int = 6, n_heads: int = 8):
        super().__init__()
        self.max_length = max_length

        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed = nn.Parameter(torch.zeros(1, max_length, d_model))

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=4*d_model,
            activation='gelu', batch_first=True, norm_first=True
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=n_layers)

        self.ln = nn.LayerNorm(d_model)
        self.proj = nn.Linear(d_model, d_model, bias=False)

        nn.init.normal_(self.pos_embed, std=0.02)

    def forward(self, input_ids):
        """
        Args:
            input_ids: (B, L) long tensor of token IDs
        Returns:
            features: (B, d) -- EOS token output, L2 normalized
        """
        B, L = input_ids.shape

        x = self.token_embed(input_ids) + self.pos_embed[:, :L]  # (B, L, d)

        # Causal mask
        causal_mask = torch.triu(
            torch.ones(L, L, device=x.device, dtype=torch.bool), diagonal=1
        )

        x = self.transformer(x, mask=causal_mask)                 # (B, L, d)

        # Extract EOS token (last real token position)
        # In practice, find the position of the [EOS] token
        # Here we take the last position for simplicity
        x = self.ln(x[:, -1])                                     # (B, d)
        x = self.proj(x)                                          # (B, d)

        return x

class CLIP(nn.Module):
    """
    Contrastive Language-Image Pre-training (CLIP).

    Learns aligned image and text representations via contrastive learning.
    """
    def __init__(self, image_size: int = 224, patch_size: int = 16,
                 vocab_size: int = 49408, d_model: int = 512,
                 n_layers_vision: int = 6, n_layers_text: int = 6, n_heads: int = 8):
        super().__init__()

        self.vision_encoder = VisionEncoder(
            image_size, patch_size, d_model, n_layers_vision, n_heads
        )
        self.text_encoder = TextEncoder(
            vocab_size, 77, d_model, n_layers_text, n_heads
        )

        # Learnable temperature (log-parameterized)
        self.log_temperature = nn.Parameter(torch.tensor(math.log(1 / 0.07)))

    def encode_image(self, images):
        """Encode images to normalized feature vectors. (B, 3, H, W) -> (B, d)"""
        features = self.vision_encoder(images)                # (B, d)
        return F.normalize(features, dim=-1)                  # (B, d) L2 norm

    def encode_text(self, input_ids):
        """Encode text to normalized feature vectors. (B, L) -> (B, d)"""
        features = self.text_encoder(input_ids)               # (B, d)
        return F.normalize(features, dim=-1)                  # (B, d) L2 norm

    def forward(self, images, input_ids):
        """
        Compute CLIP loss.

        Args:
            images: (B, 3, H, W) -- batch of images
            input_ids: (B, L) -- batch of text token IDs
        Returns:
            loss: scalar -- symmetric contrastive loss
            logits_per_image: (B, B) -- similarity matrix
        """
        # Encode
        image_features = self.encode_image(images)            # (B, d)
        text_features = self.encode_text(input_ids)           # (B, d)

        # Compute similarity matrix
        temperature = self.log_temperature.exp()
        logits = image_features @ text_features.T * temperature  # (B, B)

        # Labels: diagonal entries are positives
        B = images.shape[0]
        labels = torch.arange(B, device=images.device)       # (B,)

        # Symmetric cross-entropy loss
        loss_i2t = F.cross_entropy(logits, labels)            # Image-to-text
        loss_t2i = F.cross_entropy(logits.T, labels)          # Text-to-image
        loss = (loss_i2t + loss_t2i) / 2

        return loss, logits

    @torch.no_grad()
    def zero_shot_classify(self, images, class_texts):
        """
        Zero-shot image classification.

        Args:
            images: (B, 3, H, W) -- images to classify
            class_texts: (K, L) -- tokenized class descriptions
        Returns:
            predictions: (B,) -- predicted class indices
        """
        image_features = self.encode_image(images)            # (B, d)
        text_features = self.encode_text(class_texts)         # (K, d)

        # Cosine similarity
        similarities = image_features @ text_features.T       # (B, K)
        predictions = similarities.argmax(dim=-1)             # (B,)

        return predictions
```

### 5.2 LLaVA-Style Multimodal LLM

```python
class VisualProjector(nn.Module):
    """
    Projects visual features from a vision encoder into the LLM's embedding space.

    This is the key trainable bridge between vision and language.
    """
    def __init__(self, d_vision: int, d_llm: int, n_visual_tokens: int = 256):
        """
        Args:
            d_vision: Vision encoder output dimension
            d_llm: Language model hidden dimension
            n_visual_tokens: Number of visual tokens (from ViT patches)
        """
        super().__init__()
        # Two-layer MLP projector (as in LLaVA-1.5)
        self.proj = nn.Sequential(
            nn.Linear(d_vision, d_llm),
            nn.GELU(),
            nn.Linear(d_llm, d_llm),
        )

    def forward(self, visual_features):
        """
        Args:
            visual_features: (B, N_v, d_vision) -- ViT patch features
        Returns:
            projected: (B, N_v, d_llm) -- visual tokens in LLM space
        """
        return self.proj(visual_features)                     # (B, N_v, d_llm)

class SimpleLLaVA(nn.Module):
    """
    Simplified LLaVA: Vision Encoder + Projector + Language Model.

    Architecture:
        Image -> CLIP ViT (frozen) -> Projector -> [visual tokens; text tokens] -> LLM

    Training stages:
        1. Pre-training: Train projector only on image-caption pairs
        2. Fine-tuning: Train projector + LLM on instruction-following data
    """
    def __init__(self, vision_encoder: VisionEncoder, d_vision: int,
                 vocab_size: int = 32000, d_model: int = 512,
                 n_layers: int = 6, n_heads: int = 8):
        super().__init__()

        # Vision encoder (frozen during fine-tuning)
        self.vision_encoder = vision_encoder
        for p in self.vision_encoder.parameters():
            p.requires_grad = False

        # Projector (trainable)
        self.projector = VisualProjector(d_vision, d_model)

        # Language model components
        self.token_embed = nn.Embedding(vocab_size, d_model)
        self.pos_embed = nn.Embedding(4096, d_model)

        decoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=n_heads, dim_feedforward=4*d_model,
            activation='gelu', batch_first=True, norm_first=True
        )
        self.decoder = nn.TransformerEncoder(decoder_layer, num_layers=n_layers)

        self.ln_f = nn.LayerNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)
        self.lm_head.weight = self.token_embed.weight         # Weight tying

    def forward(self, images, input_ids, labels=None):
        """
        Args:
            images: (B, 3, H, W) or None (text-only)
            input_ids: (B, L_text) token IDs for the text part
            labels: (B, L_total) target IDs for loss (optional)
        Returns:
            logits: (B, L_total, V)
            loss: scalar (if labels provided)
        """
        B = input_ids.shape[0]

        # Encode and project image
        if images is not None:
            with torch.no_grad():
                # Get patch features (not CLS token)
                patches = self.vision_encoder.patch_embed(images)  # (B, d, H/P, W/P)
                visual_features = patches.flatten(2).transpose(1, 2)  # (B, N_v, d_v)

            visual_tokens = self.projector(visual_features)   # (B, N_v, d_model)
            N_v = visual_tokens.shape[1]
        else:
            visual_tokens = None
            N_v = 0

        # Embed text tokens
        text_tokens = self.token_embed(input_ids)             # (B, L_text, d_model)

        # Concatenate visual and text tokens
        if visual_tokens is not None:
            tokens = torch.cat([visual_tokens, text_tokens], dim=1)  # (B, N_v + L_text, d)
        else:
            tokens = text_tokens                              # (B, L_text, d)

        L_total = tokens.shape[1]

        # Positional embeddings
        positions = torch.arange(L_total, device=tokens.device).unsqueeze(0)
        tokens = tokens + self.pos_embed(positions)           # (B, L_total, d)

        # Causal mask
        causal_mask = torch.triu(
            torch.ones(L_total, L_total, device=tokens.device, dtype=torch.bool),
            diagonal=1
        )

        # Forward through decoder
        hidden = self.decoder(tokens, mask=causal_mask)       # (B, L_total, d)
        hidden = self.ln_f(hidden)                            # (B, L_total, d)
        logits = self.lm_head(hidden)                         # (B, L_total, V)

        # Compute loss if labels provided
        loss = None
        if labels is not None:
            # Shift: predict next token
            shift_logits = logits[:, :-1].contiguous()        # (B, L_total-1, V)
            shift_labels = labels[:, 1:].contiguous()         # (B, L_total-1)
            loss = F.cross_entropy(
                shift_logits.view(-1, shift_logits.size(-1)),
                shift_labels.view(-1),
                ignore_index=-100,                            # Ignore padding/visual positions
            )

        return logits, loss

    @torch.no_grad()
    def generate(self, images, prompt_ids, max_new_tokens=50, temperature=0.7):
        """
        Generate text given an image and text prompt.

        Args:
            images: (1, 3, H, W) -- single image
            prompt_ids: (1, L) -- tokenized prompt
            max_new_tokens: Number of tokens to generate
            temperature: Sampling temperature
        Returns:
            generated_ids: (1, L + max_new_tokens) -- full sequence
        """
        current_ids = prompt_ids
        for _ in range(max_new_tokens):
            logits, _ = self.forward(images, current_ids)
            next_logits = logits[:, -1, :] / temperature
            probs = F.softmax(next_logits, dim=-1)
            next_token = torch.multinomial(probs, 1)
            current_ids = torch.cat([current_ids, next_token], dim=1)
        return current_ids
```

### 5.3 Perceiver Resampler (Flamingo-style)

```python
class PerceiverResampler(nn.Module):
    """
    Perceiver Resampler from Flamingo.

    Compresses variable-length visual features into a fixed number of tokens
    using learned queries and cross-attention.
    """
    def __init__(self, d_model: int, n_queries: int = 64, n_layers: int = 2,
                 n_heads: int = 8, d_visual: int = None):
        """
        Args:
            d_model: Output dimension (matches LLM dimension)
            n_queries: Number of output visual tokens (N_q)
            n_layers: Number of cross-attention layers
            n_heads: Number of attention heads
            d_visual: Input visual feature dimension (if different from d_model)
        """
        super().__init__()
        d_visual = d_visual or d_model

        # Learned query vectors
        self.queries = nn.Parameter(torch.randn(n_queries, d_model) * 0.02)  # (N_q, d)

        # Optional projection for visual features
        self.input_proj = nn.Linear(d_visual, d_model) if d_visual != d_model else nn.Identity()

        # Cross-attention + FFN layers
        self.layers = nn.ModuleList()
        for _ in range(n_layers):
            self.layers.append(nn.ModuleDict({
                'norm_q': nn.LayerNorm(d_model),
                'norm_kv': nn.LayerNorm(d_model),
                'cross_attn': nn.MultiheadAttention(
                    d_model, n_heads, batch_first=True
                ),
                'norm_ff': nn.LayerNorm(d_model),
                'ff': nn.Sequential(
                    nn.Linear(d_model, 4 * d_model),
                    nn.GELU(),
                    nn.Linear(4 * d_model, d_model),
                ),
            }))

    def forward(self, visual_features):
        """
        Args:
            visual_features: (B, M, d_visual) -- variable-length visual features
        Returns:
            resampled: (B, N_q, d_model) -- fixed-length visual tokens
        """
        B = visual_features.shape[0]

        # Project visual features
        kv = self.input_proj(visual_features)                  # (B, M, d)

        # Expand queries for batch
        q = self.queries.unsqueeze(0).expand(B, -1, -1)        # (B, N_q, d)

        # Process through cross-attention layers
        for layer in self.layers:
            # Cross-attention: queries attend to visual features
            q_norm = layer['norm_q'](q)
            kv_norm = layer['norm_kv'](kv)
            attn_out, _ = layer['cross_attn'](q_norm, kv_norm, kv_norm)
            q = q + attn_out                                   # (B, N_q, d)

            # FFN
            q = q + layer['ff'](layer['norm_ff'](q))          # (B, N_q, d)

        return q                                                # (B, N_q, d)
```

### 5.4 Verification Script

```python
def verify_clip():
    """Verify CLIP model shapes and loss computation."""
    torch.manual_seed(42)

    model = CLIP(image_size=32, patch_size=8, vocab_size=1000, d_model=128,
                 n_layers_vision=2, n_layers_text=2, n_heads=4)

    B = 8
    images = torch.randn(B, 3, 32, 32)
    input_ids = torch.randint(0, 1000, (B, 20))

    loss, logits = model(images, input_ids)

    print(f"Batch size: {B}")
    print(f"Logits shape: {logits.shape}")               # (8, 8)
    print(f"Loss: {loss.item():.4f}")
    print(f"Temperature: {model.log_temperature.exp().item():.4f}")

    # Verify zero-shot
    class_texts = torch.randint(0, 1000, (5, 20))        # 5 classes
    preds = model.zero_shot_classify(images, class_texts)
    print(f"Predictions shape: {preds.shape}")            # (8,)
    print(f"Predictions: {preds.tolist()}")

def verify_llava():
    """Verify LLaVA model shapes."""
    torch.manual_seed(42)

    vision_enc = VisionEncoder(image_size=32, patch_size=8, d_model=128,
                               n_layers=2, n_heads=4)
    model = SimpleLLaVA(vision_enc, d_vision=128, vocab_size=1000,
                        d_model=128, n_layers=2, n_heads=4)

    B = 2
    images = torch.randn(B, 3, 32, 32)
    input_ids = torch.randint(0, 1000, (B, 30))

    logits, _ = model(images, input_ids)
    N_v = (32 // 8) ** 2  # = 16 visual tokens
    print(f"Visual tokens: {N_v}")
    print(f"Text tokens: {input_ids.shape[1]}")
    print(f"Total sequence length: {logits.shape[1]}")    # N_v + L_text = 46
    print(f"Logits shape: {logits.shape}")                # (2, 46, 1000)

if __name__ == "__main__":
    print("=== CLIP Verification ===")
    verify_clip()
    print("\n=== LLaVA Verification ===")
    verify_llava()
```

---

## 6. Experimental Intuition

### 6.1 CLIP Zero-Shot Performance

CLIP achieves impressive zero-shot performance across diverse vision benchmarks:

| Benchmark | CLIP ViT-L/14 (zero-shot) | ResNet-50 (supervised) | Improvement |
|-----------|--------------------------|----------------------|-------------|
| ImageNet | 75.3% | 76.1% | -0.8% |
| CIFAR-100 | 77.5% | 75.3% | +2.2% |
| STL-10 | 99.3% | 96.1% | +3.2% |
| ObjectNet | 72.3% | 56.2% | +16.1% |

Key observations:

- CLIP matches or exceeds supervised baselines on many benchmarks without seeing any labeled examples.
- The advantage is largest on **distribution-shifted** benchmarks (ObjectNet), suggesting CLIP learns more robust representations.

### 6.2 Scaling Laws for Multimodal Models

| Model | Vision Params | LLM Params | VQA Accuracy | Captioning CIDEr |
|-------|-------------|-----------|-------------|------------------|
| Flamingo-3B | 435M (frozen) | 1.4B (frozen) | 49.2 | 73.0 |
| Flamingo-9B | 435M (frozen) | 7B (frozen) | 51.8 | 79.4 |
| Flamingo-80B | 435M (frozen) | 70B (frozen) | 56.3 | 84.3 |
| LLaVA-1.5-7B | 300M (frozen) | 7B (tuned) | 58.2 | -- |
| LLaVA-1.5-13B | 300M (frozen) | 13B (tuned) | 61.3 | -- |

Key insight: Scaling the LLM backbone has a larger impact than scaling the vision encoder, because the LLM's reasoning capabilities are the bottleneck for complex visual question answering.

### 6.3 Fusion Architecture Comparison

| Architecture | Training Cost | Few-shot | Fine-tuned | Inference Cost |
|-------------|--------------|---------|-----------|---------------|
| Late fusion (CLIP) | High (large batch) | Limited | Good (linear probe) | Low |
| Cross-attn (Flamingo) | Medium (freeze most) | Excellent | Good | Medium |
| Early fusion (LLaVA) | Low (2-stage) | Limited | Excellent | High (long seq) |

- **CLIP** excels at retrieval and zero-shot classification but lacks fine-grained reasoning.
- **Flamingo** excels at few-shot multimodal tasks due to its interleaved image-text processing.
- **LLaVA** excels at instruction following and complex reasoning after fine-tuning.

### 6.4 Prompt Engineering for CLIP

The text prompt significantly affects CLIP's zero-shot performance:

| Prompt Template | ImageNet Accuracy |
|----------------|------------------|
| `"{class}"` | 68.4% |
| `"a photo of a {class}"` | 72.1% |
| `"a photo of a {class}, a type of pet"` | 74.8% (for pet classes) |
| Ensemble of 80 prompts | 75.3% |

This sensitivity motivates learned prompt tuning (CoOp, CoCoOp) where the text prompt is optimized via gradient descent.

---

## 7. Connections

### 7.1 Connections to Prior Lectures

- **Lecture 02d (ViT)**: The vision encoder in CLIP and LLaVA is a Vision Transformer. The patch embedding mechanism and positional encoding carry over directly.
- **Lecture 04a (Attention)**: Cross-attention in Flamingo is the same mechanism as encoder-decoder attention in the original Transformer.
- **Lecture 08 (Diffusion Models)**: CLIP embeddings serve as the conditioning signal for text-to-image diffusion models (Stable Diffusion, DALL-E 2).
- **Lecture 06 (Contrastive Learning)**: CLIP's InfoNCE loss is a direct application of contrastive learning principles.

### 7.2 Connections to Information Theory

The InfoNCE bound $I(X; Y) \geq \log N - \mathcal{L}_{\text{InfoNCE}}$ connects contrastive learning to rate-distortion theory. The batch size $N$ determines the tightness of the mutual information estimate, explaining why CLIP requires very large batch sizes (32K) for effective training.

### 7.3 Connections to Neuroscience

Multimodal alignment in CLIP resembles the binding problem in cognitive science: how the brain associates features from different sensory modalities into a unified percept. The shared embedding space in CLIP can be viewed as a computational analog of multimodal association areas in the brain.

### 7.4 Forward Connections

- The multimodal paradigm extends to audio (AudioCLIP), video (VideoCLIP), 3D (Point-E), and other modalities.
- Unified models like Gemini and GPT-4o process multiple modalities natively, rather than connecting separate encoders.

---

## 8. Paper Reading List

### Required Reading

1. **Radford, A., Kim, J.W., Hallacy, C., et al.** (2021). "Learning Transferable Visual Models From Natural Language Supervision." *ICML 2021.*
   - The CLIP paper. Focus on Sections 2 (approach) and 3 (experiments).

2. **Liu, H., Li, C., Wu, Q., and Lee, Y.J.** (2024). "Visual Instruction Tuning." *NeurIPS 2023.*
   - LLaVA. Focus on Section 3 (architecture) and the two-stage training procedure.

### Recommended Reading

3. **Alayrac, J.B., Donahue, J., Luc, P., et al.** (2022). "Flamingo: a Visual Language Model for Few-Shot Learning." *NeurIPS 2022.*
   - Flamingo architecture. Focus on the Perceiver Resampler and gated cross-attention.

4. **Rombach, R., Blattmann, A., Lorenz, D., et al.** (2022). "High-Resolution Image Synthesis with Latent Diffusion Models." *CVPR 2022.*
   - Stable Diffusion (Latent Diffusion Model). Focus on Section 3 (conditioning mechanisms).

5. **Esser, P., Rombach, R., and Ommer, B.** (2021). "Taming Transformers for High-Resolution Image Synthesis." *CVPR 2021.*
   - VQGAN for image tokenization.

6. **Oord, A. van den, Li, Y., and Vinyals, O.** (2018). "Representation Learning with Contrastive Predictive Coding." *arXiv:1807.03748.*
   - The original InfoNCE paper that underpins CLIP's objective.

7. **Li, J., Li, D., Savarese, S., and Hoi, S.** (2023). "BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models." *ICML 2023.*
   - Efficient multimodal pre-training by bridging frozen vision and language models.

---

## 9. Exercises

### Conceptual Exercises

**Exercise 9d.1.** Derive the InfoNCE loss from the perspective of noise-contrastive estimation:

(a) Formulate the problem as a $(N+1)$-way classification: given query $x$ and candidates $\{y_0, y_1, \ldots, y_{N-1}\}$ (one positive, $N-1$ negatives), predict which is the positive.

(b) Show that the optimal classifier uses $\log \frac{p(y|x)}{p(y)}$ as the score function.

(c) Derive the InfoNCE loss as the cross-entropy for this classification task with score function $f(x, y)$.

(d) Prove the mutual information lower bound: $I(X; Y) \geq \log N - \mathcal{L}_{\text{InfoNCE}}$.

**Exercise 9d.2.** The CLIP temperature $\tau$ is learned. Starting from $\tau = 1/0.07 \approx 14.3$:

(a) What happens to the gradient magnitude of the contrastive loss as $\tau \to 0$?

(b) What happens as $\tau \to \infty$?

(c) Prove that the optimal $\tau$ depends on the effective dimensionality of the embedding space.

**Exercise 9d.3.** Compare the three fusion architectures (late, cross-attention, early) in terms of:

(a) Computational complexity as a function of visual tokens $N_v$ and text tokens $N_t$.

(b) Ability to perform fine-grained visual reasoning (e.g., "what color is the smallest object?").

(c) Ease of extending to multiple images or video.

**Exercise 9d.4.** In LLaVA, visual tokens are treated identically to text tokens by the self-attention mechanism. Analyze the implications:

(a) How many attention computations involve visual-to-visual, visual-to-text, text-to-visual, and text-to-text interactions?

(b) Why might this be inefficient compared to Flamingo's cross-attention approach?

(c) Propose a modification that reduces the computational cost while preserving text-to-visual attention.

### Implementation Exercises

**Exercise 9d.5.** Implement the CLIP model and train it on a small image-text dataset (e.g., CIFAR-10 with class name captions):

(a) Train for 50 epochs with batch size 256.

(b) Evaluate zero-shot classification accuracy on the test set.

(c) Visualize the similarity matrix $S = V \cdot T^T$ for a batch. What patterns emerge?

(d) Plot the learned temperature $\tau$ over training.

**Exercise 9d.6.** Implement the Perceiver Resampler and verify:

(a) That it compresses variable-length inputs to a fixed number of tokens.

(b) That the attention weights in the cross-attention layers are interpretable (do queries specialize to different spatial regions?).

(c) Compare performance with and without the Perceiver (i.e., using all visual tokens directly vs. resampled tokens) on a VQA task.

**Exercise 9d.7.** Build a simplified text-to-image pipeline:

(a) Train a small VQGAN on CIFAR-10 to learn discrete image codes.

(b) Train an autoregressive Transformer to generate image codes conditioned on CLIP text embeddings.

(c) Evaluate generated image quality using FID score.

### Proof Exercises

**Exercise 9d.8 (Challenge).** Prove that the InfoNCE lower bound becomes tight as $N \to \infty$. Specifically, show that:

$$\lim_{N \to \infty} \left(\log N - \mathcal{L}_{\text{InfoNCE}}^*\right) = I(X; Y)$$

where $\mathcal{L}_{\text{InfoNCE}}^*$ is the optimal InfoNCE loss (achieved by the true score function $f^*(x, y) = \log \frac{p(y|x)}{p(y)} + c$).

*Hint:* Show that the optimal critic satisfies $e^{f^*(x,y)} \propto \frac{p(y|x)}{p(y)}$ and compute the resulting loss.
