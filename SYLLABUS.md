# Syllabus: Deep Neural Networks — Theory, Implementation, and Frontiers

## Course Information

- **Duration**: 20 weeks (1 semester) + pre-work
- **Lectures**: 2 × 75 min per week
- **Recitation**: 1 × 50 min per week
- **Office Hours**: 2 × 60 min per week
- **Prerequisites**: See [PREREQUISITES.md](PREREQUISITES.md)

## Grading

| Component | Weight |
|-----------|--------|
| Homeworks (11) | 40% |
| Mini-Project 1 | 10% |
| Mini-Project 2 | 10% |
| Capstone Project | 30% |
| Paper Presentations | 10% |

**Late Policy**: 3 free late days total across all homeworks. After that, 20% penalty per day. No late submissions for projects.

---

## Pre-Work (Before Week 1)

### Module 00: Mathematical Foundations
Complete before the semester begins. Self-paced, ~2 weeks.

| Day | Topic | Materials |
|-----|-------|-----------|
| — | Linear Algebra Review | [Lecture 00a](modules/00_foundations/lecture_00a_linear_algebra.md) |
| — | Probability & Information Theory | [Lecture 00b](modules/00_foundations/lecture_00b_probability_information_theory.md) |
| — | Optimization & Convexity | [Lecture 00c](modules/00_foundations/lecture_00c_optimization_convexity.md) |
| — | **HW0 Due: First day of class** | [HW0: Math Bootcamp](modules/00_foundations/hw00_math_bootcamp.md) |

---

## Weeks 1–2: Neural Networks & Backpropagation

### Module 01: MLPs, Backprop, and Optimization

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 1 | Mon | Universal Approximation Theorem | [Lecture 01a](modules/01_mlp_backprop/lecture_01a_universal_approximation.md) |
| 1 | Wed | Backpropagation & Automatic Differentiation | [Lecture 01b](modules/01_mlp_backprop/lecture_01b_backpropagation_autodiff.md) |
| 1 | Fri | *Recitation: PyTorch Fundamentals* | [Recitation 01](modules/01_mlp_backprop/recitation_01_pytorch_fundamentals.md) |
| 2 | Mon | Optimization Landscape of Neural Networks | [Lecture 01c](modules/01_mlp_backprop/lecture_01c_optimization_landscape.md) |
| 2 | Wed | Regularization & Generalization | [Lecture 01d](modules/01_mlp_backprop/lecture_01d_regularization_generalization.md) |
| 2 | Fri | **HW1 Due** | [HW1: MLP From Scratch](modules/01_mlp_backprop/hw01_mlp_from_scratch.md) |

**Readings**: Cybenko (1989), Rumelhart et al. (1986), Kingma & Ba (2015)

---

## Weeks 3–4: Convolutional Networks

### Module 02: CNNs

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 3 | Mon | Convolution as Equivariant Map | [Lecture 02a](modules/02_cnns/lecture_02a_convolution_equivariance.md) |
| 3 | Wed | Architectures: LeNet → ResNet | [Lecture 02b](modules/02_cnns/lecture_02b_architectures_resnet.md) |
| 3 | Fri | *Recitation: Convolution Arithmetic* | [Recitation 02](modules/02_cnns/recitation_02_conv_arithmetic.md) |
| 4 | Mon | Normalization & Training Deep CNNs | [Lecture 02c](modules/02_cnns/lecture_02c_normalization_training.md) |
| 4 | Wed | Detection, Segmentation & Vision Transformers | [Lecture 02d](modules/02_cnns/lecture_02d_detection_segmentation_vit.md) |
| 4 | Fri | **HW2 Due** | [HW2: CNN Image Classification](modules/02_cnns/hw02_cnn_image_classification.md) |

**Readings**: LeCun et al. (1998), He et al. (2016), Ioffe & Szegedy (2015)

---

## Weeks 5–6: Sequence Models

### Module 03: RNNs, LSTMs, and Seq2Seq

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 5 | Mon | RNNs & the Vanishing Gradient Problem | [Lecture 03a](modules/03_sequence_models/lecture_03a_rnns_vanishing_gradients.md) |
| 5 | Wed | LSTM & GRU | [Lecture 03b](modules/03_sequence_models/lecture_03b_lstm_gru.md) |
| 5 | Fri | *Recitation: BPTT* | [Recitation 03](modules/03_sequence_models/recitation_03_bptt.md) |
| 6 | Mon | Language Modeling & Perplexity | [Lecture 03c](modules/03_sequence_models/lecture_03c_language_modeling.md) |
| 6 | Wed | Seq2Seq & the Attention Bridge | [Lecture 03d](modules/03_sequence_models/lecture_03d_seq2seq_attention_bridge.md) |
| 6 | Fri | **HW3 Due** | [HW3: Sequence Modeling](modules/03_sequence_models/hw03_sequence_modeling.md) |

**Capstone Milestone 1 Due: End of Week 5** — [Problem Statement](projects/capstone/milestone_1.md)

**Readings**: Hochreiter & Schmidhuber (1997), Bahdanau et al. (2015), Sutskever et al. (2014)

---

## Weeks 7–8: Attention & Transformers

### Module 04: The Transformer

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 7 | Mon | Attention as Soft Dictionary Lookup | [Lecture 04a](modules/04_attention_transformers/lecture_04a_attention_mechanism.md) |
| 7 | Wed | The Transformer Architecture | [Lecture 04b](modules/04_attention_transformers/lecture_04b_transformer_architecture.md) |
| 7 | Fri | *Recitation: Attention Complexity* | [Recitation 04](modules/04_attention_transformers/recitation_04_attention_complexity.md) |
| 8 | Mon | Positional Encodings: Sinusoidal, Learned, RoPE, ALiBi | [Lecture 04c](modules/04_attention_transformers/lecture_04c_positional_encodings.md) |
| 8 | Wed | Efficient Attention: Sparse, Linear, Flash | [Lecture 04d](modules/04_attention_transformers/lecture_04d_efficient_attention.md) |
| 8 | Fri | **HW4 Due** | [HW4: Transformer From Scratch](modules/04_attention_transformers/hw04_transformer_from_scratch.md) |

**Mini-Project 1 Due: End of Week 8** — [Spec](projects/mini_project_1/spec.md)

**Readings**: Vaswani et al. (2017), Bahdanau et al. (2015), Dao et al. (2022)

---

## Weeks 9–10: Large Language Models & Pretraining

### Module 05: LLMs

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 9 | Mon | Scaling Laws & Compute-Optimal Training | [Lecture 05a](modules/05_llms_pretraining/lecture_05a_scaling_laws.md) |
| 9 | Wed | GPT, BERT, LLaMA: Architecture Choices | [Lecture 05b](modules/05_llms_pretraining/lecture_05b_gpt_bert_llama.md) |
| 9 | Fri | *Recitation: Distributed Training* | [Recitation 05](modules/05_llms_pretraining/recitation_05_distributed_training.md) |
| 10 | Mon | Tokenization: BPE, WordPiece, SentencePiece | [Lecture 05c](modules/05_llms_pretraining/lecture_05c_tokenization.md) |
| 10 | Wed | Data Curation & Pretraining Pipelines | [Lecture 05d](modules/05_llms_pretraining/lecture_05d_data_curation_pretraining.md) |
| 10 | Fri | **HW5 Due** | [HW5: MiniGPT](modules/05_llms_pretraining/hw05_miniGPT.md) |

**Capstone Milestone 2 Due: End of Week 10** — [Method + Preliminary Results](projects/capstone/milestone_2.md)

**Readings**: Kaplan et al. (2020), Hoffmann et al. (2022), Radford et al. (2019), Touvron et al. (2023)

---

## Weeks 11–12: Alignment & Post-Training

### Module 06: Aligning LLMs

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 11 | Mon | Supervised Fine-Tuning & Instruction Tuning | [Lecture 06a](modules/06_alignment/lecture_06a_sft_instruction_tuning.md) |
| 11 | Wed | Reward Modeling | [Lecture 06b](modules/06_alignment/lecture_06b_reward_modeling.md) |
| 11 | Fri | *Recitation: LoRA & QLoRA* | [Recitation 06](modules/06_alignment/recitation_06_lora_qlora.md) |
| 12 | Mon | PPO & RLHF | [Lecture 06c](modules/06_alignment/lecture_06c_ppo_rlhf.md) |
| 12 | Wed | DPO, SimPO, GRPO | [Lecture 06d](modules/06_alignment/lecture_06d_dpo_simpo_grpo.md) |
| 12 | Fri | **HW6 Due** | [HW6: Alignment](modules/06_alignment/hw06_alignment.md) |

**Readings**: Ouyang et al. (2022), Rafailov et al. (2023), Hu et al. (2022)

---

## Weeks 13–14: Generative Models

### Module 07: VAEs, Flows, and EBMs

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 13 | Mon | Latent Variable Models & the ELBO | [Lecture 07a](modules/07_generative_models/lecture_07a_latent_variables_elbo.md) |
| 13 | Wed | Variational Autoencoders | [Lecture 07b](modules/07_generative_models/lecture_07b_vaes.md) |
| 13 | Fri | *Recitation: ELBO Derivations* | [Recitation 07](modules/07_generative_models/recitation_07_elbo_derivations.md) |
| 14 | Mon | Normalizing Flows | [Lecture 07c](modules/07_generative_models/lecture_07c_normalizing_flows.md) |
| 14 | Wed | Energy-Based Models & Score Matching | [Lecture 07d](modules/07_generative_models/lecture_07d_ebm_score_matching.md) |
| 14 | Fri | **HW7 Due** | [HW7: VAE Implementation](modules/07_generative_models/hw07_vae_implementation.md) |

**Mini-Project 2 Due: End of Week 14** — [Spec](projects/mini_project_2/spec.md)

**Readings**: Kingma & Welling (2014), Rezende & Mohamed (2015), Song & Ermon (2019)

---

## Weeks 15–16: Diffusion Models

### Module 08: Diffusion & Score-Based Models

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 15 | Mon | DDPM: Forward & Reverse Process | [Lecture 08a](modules/08_diffusion/lecture_08a_ddpm.md) |
| 15 | Wed | Score SDEs & Continuous Diffusion | [Lecture 08b](modules/08_diffusion/lecture_08b_score_sde.md) |
| 15 | Fri | *Recitation: SDE Numerics* | [Recitation 08](modules/08_diffusion/recitation_08_sde_numerics.md) |
| 16 | Mon | DDIM & Flow Matching | [Lecture 08c](modules/08_diffusion/lecture_08c_ddim_flow_matching.md) |
| 16 | Wed | Guidance: Classifier, Classifier-Free, CFG++ | [Lecture 08d](modules/08_diffusion/lecture_08d_guidance_cfg.md) |
| 16 | Fri | **HW8 Due** | [HW8: Diffusion](modules/08_diffusion/hw08_diffusion.md) |

**Capstone Milestone 3 Due: End of Week 15** — [Full Draft](projects/capstone/milestone_3.md)

**Readings**: Ho et al. (2020), Song et al. (2021), Lipman et al. (2023)

---

## Weeks 17–18: Frontier Architectures

### Module 09: SSMs, MoE, and Multimodal

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 17 | Mon | State-Space Models & S4 | [Lecture 09a](modules/09_frontier/lecture_09a_ssm_s4.md) |
| 17 | Wed | Mamba: Selective State Spaces | [Lecture 09b](modules/09_frontier/lecture_09b_mamba.md) |
| 17 | Fri | *Recitation: Benchmarking & Evaluation* | [Recitation 09](modules/09_frontier/recitation_09_benchmarking.md) |
| 18 | Mon | Mixture of Experts | [Lecture 09c](modules/09_frontier/lecture_09c_mixture_of_experts.md) |
| 18 | Wed | Multimodal Models | [Lecture 09d](modules/09_frontier/lecture_09d_multimodal.md) |
| 18 | Fri | **HW9 Due** | [HW9: SSM/MoE](modules/09_frontier/hw09_ssm_moe.md) |

**Readings**: Gu et al. (2022), Gu & Dao (2023), Shazeer et al. (2017), Fedus et al. (2022)

---

## Weeks 19–20: Agents & Inference-Time Compute

### Module 10: AI Agents and Reasoning

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 19 | Mon | Agents, Tool Use & RAG | [Lecture 10a](modules/10_agents_inference/lecture_10a_agents_tool_use_rag.md) |
| 19 | Wed | Chain-of-Thought & Reasoning | [Lecture 10b](modules/10_agents_inference/lecture_10b_chain_of_thought.md) |
| 19 | Fri | *Recitation: RAG Pipeline* | [Recitation 10](modules/10_agents_inference/recitation_10_rag_pipeline.md) |
| 20 | Mon | Test-Time Compute & Scaling | [Lecture 10c](modules/10_agents_inference/lecture_10c_test_time_compute.md) |
| 20 | Wed | Multimodal Agents & Frontier | [Lecture 10d](modules/10_agents_inference/lecture_10d_multimodal_agents.md) |
| 20 | Fri | **HW10 Due** | [HW10: Agent Implementation](modules/10_agents_inference/hw10_agent_implementation.md) |

**Capstone Final Report Due: End of Week 20** — [Final Report](projects/capstone/final_report.md)

**Readings**: Yao et al. (2023), Wei et al. (2022), Snell et al. (2024)

---

## Paper Presentation Schedule

Each student presents one paper during the semester (15 min + 10 min Q&A).

- Weeks 3–4: Classic papers (pre-2017)
- Weeks 7–8: Transformer era papers (2017–2020)
- Weeks 11–14: LLM and generative model papers (2020–2023)
- Weeks 17–20: Frontier papers (2023–present)

See [resources/paper_reading_guide.md](resources/paper_reading_guide.md) for presentation guidelines.
