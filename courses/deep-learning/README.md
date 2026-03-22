# Deep Neural Networks: Theory, Implementation, and Frontiers

**A PhD-track course in deep learning — 20 weeks, 11 modules, from mathematical foundations to frontier research.**

---

## Overview

This course provides a rigorous, self-contained treatment of deep learning at the level expected of PhD students at top research universities. Every topic is developed from first principles with full mathematical derivations, implemented from scratch in PyTorch, and connected to seminal research papers.

**What makes this course different:**

- Full proofs and derivations — not just "it can be shown that..."
- Every model is built from raw tensors before using library abstractions
- Coverage of frontier topics: LLMs, RLHF/DPO, diffusion models, state-space models, mixture of experts, and AI agents
- Research-oriented: students read papers, replicate results, and produce an original capstone

## Course Structure

| Module | Title | Weeks | Key Topics |
|--------|-------|-------|------------|
| 00 | [Mathematical Foundations](modules/00_foundations/00_foundations.md) | Pre-work | Linear algebra, probability, optimization |
| 01 | [Neural Nets & Backprop](modules/01_mlp_backprop/01_mlp_backprop.md) | 1–2 | Universal approximation, autodiff, regularization |
| 02 | [Convolutional Networks](modules/02_cnns/02_cnns.md) | 3–4 | Equivariance, ResNet, normalization, detection |
| 03 | [Sequence Models](modules/03_sequence_models/03_sequence_models.md) | 5–6 | RNNs, LSTMs, language modeling, seq2seq |
| 04 | [Attention & Transformers](modules/04_attention_transformers/04_attention_transformers.md) | 7–8 | Attention, transformer architecture, efficient variants |
| 05 | [LLMs & Pretraining](modules/05_llms_pretraining/05_llms_pretraining.md) | 9–10 | Scaling laws, GPT/BERT/LLaMA, tokenization |
| 06 | [Alignment & Post-Training](modules/06_alignment/06_alignment.md) | 11–12 | SFT, RLHF, DPO, LoRA |
| 07 | [Generative Models](modules/07_generative_models/07_generative_models.md) | 13–14 | VAEs, normalizing flows, EBMs, score matching |
| 08 | [Diffusion Models](modules/08_diffusion/08_diffusion.md) | 15–16 | DDPM, score SDEs, flow matching, guidance |
| 09 | [Frontier Architectures](modules/09_frontier/09_frontier.md) | 17–18 | SSMs, Mamba, MoE, multimodal models |
| 10 | [Agents & Inference-Time](modules/10_agents_inference/10_agents_inference.md) | 19–20 | Tool use, RAG, chain-of-thought, test-time compute |

## Deliverables

- **11 Homeworks** (~20 hours each): mathematical derivations + from-scratch implementations
- **2 Mini-Projects**: transformer language model (Week 8), generative model comparison (Week 14)
- **1 Capstone**: original research contribution with 4 milestones across the semester
- **Paper Reading**: 5–8 seminal papers per module

## Teaching Team

See [TEAM.md](TEAM.md) for the full teaching staff, office hours, grading pipeline, and how to get help.

---

## How to Use This Course

### As a Self-Learner

1. Read [PREREQUISITES.md](PREREQUISITES.md) and complete the self-assessment
2. Follow [SETUP.md](SETUP.md) to configure your environment
3. Work through modules sequentially — each builds on the previous
4. Do every homework from scratch before looking at solutions
5. Read at least the required papers for each module

### As a Course Instructor

- [SYLLABUS.md](SYLLABUS.md) contains a week-by-week schedule
- Lectures are designed for 75-minute sessions
- Recitations provide hands-on coding walkthroughs
- Homeworks and projects have detailed rubrics

### As a Researcher

- Jump to specific modules as needed
- Each lecture is self-contained with explicit prerequisites listed
- Use [resources/bibliography.md](resources/bibliography.md) as an annotated reading list

## Prerequisites

See [PREREQUISITES.md](PREREQUISITES.md) for details. In brief:

- **Mathematics**: Linear algebra (through SVD), multivariate calculus, probability theory, basic optimization
- **Programming**: Python fluency, NumPy, basic PyTorch
- **ML**: Supervised/unsupervised learning fundamentals (at the level of Andrew Ng's course or Bishop Ch. 1–4)

## Notation

See [NOTATION.md](NOTATION.md) for the global notation reference used throughout all materials.

## Resources

- [Paper Reading Guide](resources/paper_reading_guide.md) — how to read ML papers effectively
- [Math Reference](resources/math_reference.md) — quick-reference for key identities and theorems
- [PyTorch Patterns](resources/pytorch_patterns.md) — idiomatic PyTorch for research
- [Bibliography](resources/bibliography.md) — master annotated bibliography
- [Glossary](resources/glossary.md) — definitions of key terms

## Acknowledgments

This course draws inspiration from:

- Stanford CS231n, CS224n, CS236
- MIT 6.S898, 6.S965
- CMU 10-708, 11-785
- UC Berkeley CS182, CS285
- Goodfellow, Bengio, Courville — *Deep Learning* (MIT Press)
- Prince — *Understanding Deep Learning* (MIT Press)
- Zhang et al. — *Dive into Deep Learning*
