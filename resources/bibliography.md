# Annotated Bibliography: Deep Learning

A curated reading list for a PhD-track deep learning course, organized by topic. Each entry includes a citation, one-line summary, and significance rating.

**Significance Ratings:**
- ★★★ Essential -- foundational or field-defining; must read
- ★★ Important -- significant contribution; strongly recommended
- ★ Recommended -- valuable for depth or perspective; read as needed

---

## Table of Contents

1. [Foundations of Deep Learning](#foundations-of-deep-learning)
2. [Convolutional Neural Networks](#convolutional-neural-networks)
3. [Recurrent Neural Networks and LSTMs](#recurrent-neural-networks-and-lstms)
4. [Attention Mechanisms and Transformers](#attention-mechanisms-and-transformers)
5. [Large Language Models](#large-language-models)
6. [Alignment and Safety](#alignment-and-safety)
7. [Generative Models (VAEs, GANs, Flows)](#generative-models-vaes-gans-flows)
8. [Diffusion Models](#diffusion-models)
9. [State Space Models](#state-space-models)
10. [Mixture of Experts](#mixture-of-experts)
11. [Agents and Tool Use](#agents-and-tool-use)

---

## Foundations of Deep Learning

**Rumelhart, Hinton, Williams. "Learning representations by back-propagating errors." Nature, 1986.**
Introduced backpropagation for training multi-layer neural networks, enabling gradient-based learning of internal representations. ★★★

**LeCun, Bottou, Bengio, Haffner. "Gradient-based learning applied to document recognition." Proceedings of the IEEE, 1998.**
Demonstrated end-to-end trainable convolutional networks (LeNet) for handwritten digit recognition; established the modern CNN paradigm. ★★★

**Hinton, Salakhutdinov. "Reducing the dimensionality of data with neural networks." Science, 2006.**
Showed that deep autoencoders pretrained with RBMs could learn compact representations, reigniting interest in deep learning. ★★

**Glorot, Bengio. "Understanding the difficulty of training deep feedforward neural networks." AISTATS, 2010.**
Analyzed how weight initialization and activation functions affect gradient flow, proposing Xavier initialization. ★★

**Kingma, Ba. "Adam: A Method for Stochastic Optimization." ICLR, 2015.**
Introduced the Adam optimizer combining momentum and adaptive learning rates; the default optimizer for most deep learning. ★★★

**Ioffe, Szegedy. "Batch Normalization: Accelerating Deep Network Training by Reducing Internal Covariate Shift." ICML, 2015.**
Proposed normalizing activations within mini-batches, dramatically stabilizing and accelerating training. ★★★

**Srivastava et al. "Dropout: A Simple Way to Prevent Neural Networks from Overfitting." JMLR, 2014.**
Introduced dropout regularization by randomly zeroing activations during training. ★★★

**He et al. "Deep Residual Learning for Image Recognition." CVPR, 2016.**
Introduced residual connections enabling training of networks with hundreds of layers; fundamental architectural innovation. ★★★

**Nair, Hinton. "Rectified Linear Units Improve Restricted Boltzmann Machines." ICML, 2010.**
Showed ReLU activations train faster and perform better than sigmoid/tanh, becoming the default activation. ★★

**Ba, Kiros, Hinton. "Layer Normalization." arXiv, 2016.**
Proposed normalizing across features rather than batches, essential for transformers and sequence models. ★★

**Loshchilov, Hutter. "Decoupled Weight Decay Regularization." ICLR, 2019.**
Showed that L2 regularization and weight decay are not equivalent for adaptive optimizers; proposed AdamW. ★★

**Zhang et al. "Understanding deep learning requires rethinking generalization." ICLR, 2017.**
Demonstrated that deep networks can memorize random labels, challenging classical generalization theory. ★★★

---

## Convolutional Neural Networks

**Krizhevsky, Sutskever, Hinton. "ImageNet Classification with Deep Convolutional Neural Networks." NeurIPS, 2012.**
AlexNet won ImageNet 2012 by a large margin, launching the modern deep learning era in computer vision. ★★★

**Simonyan, Zisserman. "Very Deep Convolutional Networks for Large-Scale Image Recognition." ICLR, 2015.**
VGGNet showed that depth with small (3x3) filters is more effective than large filters, establishing a key design principle. ★★

**Szegedy et al. "Going Deeper with Convolutions." CVPR, 2015.**
GoogLeNet/Inception introduced multi-scale processing with inception modules and 1x1 convolutions for dimensionality reduction. ★★

**He et al. "Deep Residual Learning for Image Recognition." CVPR, 2016.**
ResNet introduced skip connections enabling training of 152+ layer networks; won ImageNet 2015. ★★★

**Huang et al. "Densely Connected Convolutional Networks." CVPR, 2017.**
DenseNet connected each layer to every other layer, improving gradient flow and feature reuse. ★

**Howard et al. "MobileNets: Efficient Convolutional Neural Networks for Mobile Vision Applications." arXiv, 2017.**
Introduced depthwise separable convolutions for efficient mobile inference, trading minimal accuracy for major speedup. ★★

**Tan, Le. "EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks." ICML, 2019.**
Proposed compound scaling of depth, width, and resolution using neural architecture search. ★★

**Liu et al. "A ConvNet for the 2020s." CVPR, 2022.**
ConvNeXt modernized pure convolutional architectures to match Vision Transformer performance, showing convolutions remain competitive. ★★

**Ronneberger, Fischer, Brox. "U-Net: Convolutional Networks for Biomedical Image Segmentation." MICCAI, 2015.**
Introduced the encoder-decoder architecture with skip connections for dense prediction; foundational for segmentation and diffusion. ★★★

**Long, Shelhamer, Darrell. "Fully Convolutional Networks for Semantic Segmentation." CVPR, 2015.**
Adapted classification CNNs for pixel-wise prediction, establishing the fully convolutional paradigm. ★★

**Lin et al. "Feature Pyramid Networks for Object Detection." CVPR, 2017.**
Multi-scale feature fusion architecture that became standard for object detection and instance segmentation. ★★

---

## Recurrent Neural Networks and LSTMs

**Hochreiter, Schmidhuber. "Long Short-Term Memory." Neural Computation, 1997.**
Introduced LSTM cells with gating mechanisms to solve the vanishing gradient problem in sequence modeling. ★★★

**Cho et al. "Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation." EMNLP, 2014.**
Introduced the GRU (Gated Recurrent Unit), a simplified alternative to LSTM with comparable performance. ★★

**Sutskever, Vinyals, Le. "Sequence to Sequence Learning with Neural Networks." NeurIPS, 2014.**
Established the encoder-decoder paradigm for sequence-to-sequence tasks using LSTMs. ★★★

**Bahdanau, Cho, Bengio. "Neural Machine Translation by Jointly Learning to Align and Translate." ICLR, 2015.**
Introduced additive attention for seq2seq models, allowing the decoder to focus on relevant parts of the input. ★★★

**Graves. "Generating Sequences With Recurrent Neural Networks." arXiv, 2013.**
Demonstrated character-level text generation and handwriting synthesis with LSTMs, showing impressive generative capabilities. ★

**Zaremba, Sutskever, Vinyals. "Recurrent Neural Network Regularization." arXiv, 2014.**
Showed how to effectively apply dropout to RNNs without disrupting recurrent dynamics. ★

**Merity, Keskar, Socher. "Regularizing and Optimizing LSTM Language Models." ICLR, 2018.**
AWD-LSTM with weight tying, variational dropout, and averaged SGD; strong LSTM baseline for language modeling. ★

**Pascanu, Mikolov, Bengio. "On the difficulty of training recurrent neural networks." ICML, 2013.**
Formal analysis of the vanishing and exploding gradient problem in RNNs with practical mitigation strategies. ★★

**Graves, Wayne, Danihelka. "Neural Turing Machines." arXiv, 2014.**
Augmented neural networks with external differentiable memory, inspiring subsequent memory-augmented architectures. ★★

**Chung et al. "Empirical Evaluation of Gated Recurrent Neural Networks on Sequence Modeling." NeurIPS Workshop, 2014.**
Systematic comparison of LSTM and GRU architectures across multiple tasks, informing architectural choices. ★

---

## Attention Mechanisms and Transformers

**Vaswani et al. "Attention Is All You Need." NeurIPS, 2017.**
Introduced the Transformer architecture, replacing recurrence entirely with multi-head self-attention; the foundation of modern NLP and beyond. ★★★

**Devlin et al. "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding." NAACL, 2019.**
Proposed masked language modeling for bidirectional pretraining, achieving SOTA on 11 NLP benchmarks simultaneously. ★★★

**Radford et al. "Improving Language Understanding by Generative Pre-Training." OpenAI, 2018.**
GPT-1: showed that generative pretraining followed by discriminative fine-tuning produces strong NLP performance. ★★

**Radford et al. "Language Models are Unsupervised Multitask Learners." OpenAI, 2019.**
GPT-2: demonstrated that scaling language models enables zero-shot task transfer without fine-tuning. ★★★

**Dosovitskiy et al. "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale." ICLR, 2021.**
Vision Transformer (ViT) applied pure transformers to image classification, showing they match CNNs when pretrained at scale. ★★★

**Shaw, Uszkoreit, Vaswani. "Self-Attention with Relative Position Representations." NAACL, 2018.**
Introduced relative positional encodings for self-attention, improving generalization to longer sequences. ★★

**Su et al. "RoFormer: Enhanced Transformer with Rotary Position Embedding." arXiv, 2021.**
Proposed Rotary Position Embedding (RoPE), encoding relative positions through rotation matrices; adopted by most modern LLMs. ★★★

**Child et al. "Generating Long Sequences with Sparse Transformers." arXiv, 2019.**
Introduced sparse attention patterns to reduce the quadratic cost of self-attention, enabling longer contexts. ★★

**Dao et al. "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness." NeurIPS, 2022.**
Hardware-aware implementation of exact attention that is faster and uses less memory than approximate methods. ★★★

**Dao. "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning." ICLR, 2024.**
Improved FlashAttention with better GPU utilization, achieving near-theoretical peak throughput. ★★

**Xiong et al. "On Layer Normalization in the Transformer Architecture." ICML, 2020.**
Analyzed Pre-LN vs Post-LN placement; showed Pre-LN is more stable for training deep transformers. ★★

**Press, Smith, Lewis. "Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation." ICLR, 2022.**
ALiBi positional encoding that enables length extrapolation without explicit position embeddings. ★★

---

## Large Language Models

**Brown et al. "Language Models are Few-Shot Learners." NeurIPS, 2020.**
GPT-3 (175B params) demonstrated that scaling enables strong few-shot and zero-shot performance via in-context learning. ★★★

**Chowdhery et al. "PaLM: Scaling Language Modeling with Pathways." JMLR, 2023.**
540B parameter model showing continued scaling improvements and emergent abilities at scale. ★★

**Touvron et al. "LLaMA: Open and Efficient Foundation Language Models." arXiv, 2023.**
Showed that smaller models trained on more data can match much larger models; catalyzed the open-source LLM ecosystem. ★★★

**Hoffmann et al. "Training Compute-Optimal Large Language Models." NeurIPS, 2022.**
Chinchilla scaling laws: model size and data should be scaled equally, revising earlier scaling assumptions. ★★★

**Kaplan et al. "Scaling Laws for Neural Language Models." arXiv, 2020.**
Empirically characterized how loss scales as power laws with model size, dataset size, and compute. ★★★

**Wei et al. "Emergent Abilities of Large Language Models." TMLR, 2022.**
Documented abilities that appear suddenly at certain scales (e.g., chain-of-thought reasoning), sparking debate on emergence. ★★

**Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models." NeurIPS, 2022.**
Showed that prompting LLMs to generate intermediate reasoning steps dramatically improves performance on math and logic tasks. ★★★

**Raffel et al. "Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer." JMLR, 2020.**
T5 framed all NLP tasks as text-to-text; systematic study of pretraining objectives, architectures, and scale. ★★

**Anil et al. "Gemini: A Family of Highly Capable Multimodal Models." arXiv, 2023.**
Natively multimodal LLM trained on interleaved text, image, audio, and video from the ground up. ★★

**DeepSeek-AI. "DeepSeek-V3 Technical Report." arXiv, 2024.**
671B MoE model trained efficiently with FP8 and multi-token prediction; strong open-weight model. ★★

**Grattafiori et al. "The Llama 3 Herd of Models." arXiv, 2024.**
Detailed scaling and training methodology for the Llama 3 family (8B-405B), with extensive ablations. ★★

---

## Alignment and Safety

**Christiano et al. "Deep Reinforcement Learning from Human Preferences." NeurIPS, 2017.**
Introduced RLHF: training reward models from human comparisons and optimizing policies against them. ★★★

**Ouyang et al. "Training language models to follow instructions with human feedback." NeurIPS, 2022.**
InstructGPT: applied RLHF to GPT-3, producing models that follow instructions and are less harmful. ★★★

**Bai et al. "Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback." arXiv, 2022.**
Anthropic's study of RLHF for alignment, introducing the helpful-harmless-honest framework. ★★★

**Rafailov et al. "Direct Preference Optimization: Your Language Model is Secretly a Reward Model." NeurIPS, 2023.**
DPO eliminates the need for a separate reward model by directly optimizing the policy from preferences. ★★★

**Schulman et al. "Proximal Policy Optimization Algorithms." arXiv, 2017.**
PPO: the standard RL algorithm used for RLHF, balancing simplicity, stability, and performance. ★★★

**Ziegler et al. "Fine-Tuning Language Models from Human Preferences." arXiv, 2019.**
Early work applying reward learning from human feedback to improve text generation quality. ★★

**Perez et al. "Red Teaming Language Models with Language Models." EMNLP, 2022.**
Used LLMs to automatically discover failure modes and harmful behaviors in other LLMs. ★★

**Bai et al. "Constitutional AI: Harmlessness from AI Feedback." arXiv, 2022.**
Proposed using AI feedback guided by a set of principles (a "constitution") to reduce harmfulness without human labels. ★★

**Anthropic. "The Claude Model Card and System Prompt." 2024.**
Documents alignment methodology including RLHF, Constitutional AI, and character training. ★

**Ji et al. "AI Alignment: A Comprehensive Survey." arXiv, 2023.**
Broad survey of alignment approaches including RLHF, Constitutional AI, debate, scalable oversight, and interpretability. ★★

**Amodei et al. "Concrete Problems in AI Safety." arXiv, 2016.**
Taxonomy of safety problems: safe exploration, robustness to distributional shift, avoiding side effects, reward hacking, scalable oversight. ★★★

---

## Generative Models (VAEs, GANs, Flows)

**Kingma, Welling. "Auto-Encoding Variational Bayes." ICLR, 2014.**
Introduced the VAE framework: amortized variational inference with the reparameterization trick for differentiable sampling. ★★★

**Goodfellow et al. "Generative Adversarial Nets." NeurIPS, 2014.**
Introduced adversarial training of generators and discriminators, launching an enormous body of generative modeling work. ★★★

**Rezende, Mohamed. "Variational Inference with Normalizing Flows." ICML, 2015.**
Showed how to build flexible approximate posteriors by composing invertible transformations. ★★

**Dinh, Sohl-Dickstein, Bengio. "Density estimation using Real-NVP." ICLR, 2017.**
Practical normalizing flow architecture using affine coupling layers with efficient exact likelihood computation. ★★

**Karras et al. "A Style-Based Generator Architecture for Generative Adversarial Networks." CVPR, 2019.**
StyleGAN introduced style-based generation with progressive growing, producing unprecedented image quality. ★★★

**Higgins et al. "beta-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework." ICLR, 2017.**
Showed that increasing the KL weight in VAEs encourages disentangled latent representations. ★★

**Arjovsky, Chintala, Bottou. "Wasserstein Generative Adversarial Networks." ICML, 2017.**
WGAN replaced the JS divergence with Wasserstein distance, improving GAN training stability and providing a meaningful loss metric. ★★

**Brock, Donahue, Simonyan. "Large Scale GAN Training for High Fidelity Natural Image Synthesis." ICLR, 2019.**
BigGAN demonstrated class-conditional image generation at high resolution through careful scaling of GANs. ★★

**van den Oord et al. "Neural Discrete Representation Learning." NeurIPS, 2017.**
VQ-VAE introduced vector quantization in the latent space, enabling discrete latent representations for generation. ★★★

**Razavi et al. "Generating Diverse High-Fidelity Images with VQ-VAE-2." NeurIPS, 2019.**
Hierarchical VQ-VAE with autoregressive priors, generating high-quality diverse images competitive with GANs. ★

**Kingma, Dhariwal. "Glow: Generative Flow with Invertible 1x1 Convolutions." NeurIPS, 2018.**
Extended normalizing flows with invertible 1x1 convolutions, enabling exact likelihood and efficient synthesis. ★★

---

## Diffusion Models

**Sohl-Dickstein et al. "Deep Unsupervised Learning using Nonequilibrium Thermodynamics." ICML, 2015.**
Originated the diffusion framework: gradually destroy data with noise, then learn to reverse the process. ★★

**Ho, Jain, Abbeel. "Denoising Diffusion Probabilistic Models." NeurIPS, 2020.**
DDPM: made diffusion models practical with simplified training objective and high-quality image generation. ★★★

**Song et al. "Score-Based Generative Modeling through Stochastic Differential Equations." ICLR, 2021.**
Unified score matching and diffusion models under a continuous-time SDE framework, enabling flexible sampling. ★★★

**Dhariwal, Nichol. "Diffusion Models Beat GANs on Image Synthesis." NeurIPS, 2021.**
Demonstrated that diffusion models surpass GANs in sample quality with classifier guidance. ★★★

**Ho, Salimans. "Classifier-Free Diffusion Guidance." NeurIPS Workshop, 2022.**
Eliminated the need for a separate classifier in guided diffusion by combining conditional and unconditional models. ★★★

**Rombach et al. "High-Resolution Image Synthesis with Latent Diffusion Models." CVPR, 2022.**
Stable Diffusion: diffusion in a compressed latent space, making high-resolution generation computationally feasible. ★★★

**Song, Meng, Ermon. "Denoising Diffusion Implicit Models." ICLR, 2021.**
DDIM: deterministic sampling from diffusion models, enabling faster generation and meaningful latent interpolation. ★★

**Karras et al. "Elucidating the Design Space of Diffusion-Based Generative Models." NeurIPS, 2022.**
Systematic analysis of diffusion model design choices (noise schedules, network preconditioning, sampling); clean unified framework. ★★★

**Lipman et al. "Flow Matching for Generative Modeling." ICLR, 2023.**
Reformulated diffusion as optimal transport flow matching, simplifying training and improving sample quality. ★★

**Peebles, Xie. "Scalable Diffusion Models with Transformers." ICCV, 2023.**
DiT: replaced U-Net with a transformer backbone for diffusion, showing transformers scale better for generation. ★★

**Esser et al. "Scaling Rectified Flow Transformers for High-Resolution Image Synthesis." ICML, 2024.**
Stable Diffusion 3: combined rectified flow matching with transformer architecture (MMDiT) for state-of-the-art text-to-image. ★★

---

## State Space Models

**Gu et al. "Efficiently Modeling Long Sequences with Structured State Spaces." ICLR, 2022.**
S4: introduced structured state space models for long-range sequence modeling with near-linear complexity. ★★★

**Gu, Dao. "Mamba: Linear-Time Sequence Modeling with Selective State Spaces." arXiv, 2023.**
Introduced input-dependent selection mechanism for SSMs, achieving transformer-quality performance with linear scaling in sequence length. ★★★

**Gu et al. "HiPPO: Recurrent Memory with Optimal Polynomial Projections." NeurIPS, 2020.**
Theoretical foundation for SSMs: optimal online compression of continuous signals into recurrent state. ★★

**Dao, Gu. "Transformers are SSMs: Generalized Models and Efficient Algorithms Through Structured State Space Duality." ICML, 2024.**
Mamba-2: showed theoretical equivalence between structured SSMs and a restricted form of attention; unified framework. ★★★

**Gu et al. "On the Parameterization and Initialization of Diagonal State Space Models." NeurIPS, 2022.**
S4D: simplified S4 to diagonal state matrices while maintaining performance, making implementation much easier. ★★

**Smith, Warrington, Linderman. "Simplified State Space Layers for Sequence Modeling." ICLR, 2023.**
S5: parallel scan-based SSM implementation that is simple, fast, and competitive. ★

**Orvieto et al. "Resurrecting Recurrent Neural Networks for Long Sequences." ICML, 2023.**
LRU (Linear Recurrent Unit): showed that properly initialized linear recurrences match S4, challenging the need for complex parameterizations. ★★

**Poli et al. "Hyena Hierarchy: Towards Larger Convolutional Language Models." ICML, 2023.**
Replaced attention with long convolutions learned via implicit parameterization; sub-quadratic alternative. ★

**Lieber et al. "Jamba: A Hybrid Transformer-Mamba Language Model." arXiv, 2024.**
Hybrid architecture interleaving Mamba and transformer layers with MoE, showing complementary strengths. ★★

**De et al. "Griffin: Mixing Gated Linear Recurrences with Local Attention for Efficient Language Models." arXiv, 2024.**
Hybrid gated linear recurrence + local attention; matched transformer quality with better efficiency. ★★

---

## Mixture of Experts

**Jacobs et al. "Adaptive Mixtures of Local Experts." Neural Computation, 1991.**
Original MoE paper: gate network selects which expert subnetworks process each input. ★★

**Shazeer et al. "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer." ICLR, 2017.**
Scaled MoE to 137B parameters with a learned sparse gating mechanism; showed conditional computation works at scale. ★★★

**Fedus, Zoph, Shazeer. "Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity." JMLR, 2022.**
Simplified MoE routing to top-1 expert selection, scaling to trillion parameters with stable training. ★★★

**Lepikhin et al. "GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding." ICLR, 2021.**
Demonstrated MoE at scale for machine translation with automatic parallelism across thousands of TPU cores. ★★

**Lewis et al. "BASE Layers: Simplifying Training of Large, Sparse Models." ICML, 2021.**
Replaced learned routing with a balanced assignment algorithm, improving training stability and load balancing. ★

**Zhou et al. "Mixture-of-Experts with Expert Choice Routing." NeurIPS, 2022.**
Reversed the routing paradigm: experts choose tokens instead of tokens choosing experts, ensuring perfect load balance. ★★

**Jiang et al. "Mixtral of Experts." arXiv, 2024.**
Mixtral 8x7B: open-source MoE model that matches or exceeds Llama 2 70B with 6x less active computation. ★★★

**Dai et al. "DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models." arXiv, 2024.**
Fine-grained MoE with more experts activated per token and shared expert isolation for better specialization. ★★

**Clark et al. "Unified Scaling Laws for Routed Language Models." ICML, 2022.**
Established scaling laws for MoE models relating expert count, granularity, and compute to performance. ★★

**Muennighoff et al. "OLMoE: Open Mixture-of-Experts Language Models." arXiv, 2024.**
Fully open MoE model with released weights, data, code, and training logs for reproducible MoE research. ★

---

## Agents and Tool Use

**Schick et al. "Toolformer: Language Models Can Teach Themselves to Use Tools." NeurIPS, 2023.**
Trained LLMs to decide when and how to call external tools (calculator, search, etc.) through self-supervised learning. ★★★

**Yao et al. "ReAct: Synergizing Reasoning and Acting in Language Models." ICLR, 2023.**
Interleaved reasoning traces and actions in LLMs, enabling grounded problem-solving with external environments. ★★★

**Wei et al. "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models." NeurIPS, 2022.**
Demonstrated that step-by-step reasoning in prompts dramatically improves LLM performance on complex tasks. ★★★

**Shinn et al. "Reflexion: Language Agents with Verbal Reinforcement Learning." NeurIPS, 2023.**
Agents that reflect on failures in natural language and improve on subsequent attempts without weight updates. ★★

**Yao et al. "Tree of Thoughts: Deliberate Problem Solving with Large Language Models." NeurIPS, 2023.**
Extended chain-of-thought to tree search over reasoning paths, enabling exploration and backtracking. ★★

**Park et al. "Generative Agents: Interactive Simulacra of Human Behavior." UIST, 2023.**
Simulated a town of 25 LLM-powered agents with memory, reflection, and planning, producing emergent social behaviors. ★★

**Significant Gravitas. "AutoGPT." GitHub, 2023.**
Open-source autonomous agent framework chaining LLM calls with tools and memory for multi-step task execution. ★

**Nakano et al. "WebGPT: Browser-Assisted Question-Answering with Human Feedback." arXiv, 2021.**
Trained a GPT model to browse the web and cite sources, using human feedback to improve answer quality. ★★

**Qin et al. "ToolLLM: Facilitating Large Language Models to Master 16000+ Real-World APIs." ICLR, 2024.**
Systematic framework for training and evaluating LLMs on diverse real-world API usage at scale. ★

**Wang et al. "Voyager: An Open-Ended Embodied Agent with Large Language Models." NeurIPS, 2023.**
LLM-powered Minecraft agent that writes and stores reusable code skills, achieving open-ended exploration. ★★

**Xi et al. "The Rise and Potential of Large Language Model Based Agents: A Survey." arXiv, 2023.**
Comprehensive survey of LLM-based agents covering architecture, capabilities, and applications. ★

---

## How to Use This Bibliography

1. **Start with ★★★ papers** in the topics most relevant to your research.
2. **Read survey papers first** when entering a new subfield -- they provide context that makes individual papers easier to digest.
3. **Follow citation chains.** Each paper's related work section points to more reading. The most-cited references in a field are often the most important.
4. **Track the temporal arc.** Read foundational papers first (even if older), then follow the progression. Many modern ideas are refinements of earlier insights.
5. **Verify recency.** This bibliography was compiled for a course starting in 2025-2026. Check for newer papers that may supersede entries here, particularly in fast-moving areas (LLMs, diffusion, SSMs, agents).
