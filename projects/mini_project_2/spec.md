# Mini-Project 2: Generative Model Comparison

**Course:** Deep Learning (PhD Track)
**Due:** Week 14
**Weight:** 10% of final grade
**Format:** Individual or pairs

---

## Overview

In this project, you will implement and rigorously compare three families of deep generative models on a shared image dataset: a Variational Autoencoder (VAE), a Normalizing Flow, and a Denoising Diffusion Probabilistic Model (DDPM). The goal is to develop both practical experience with each model family and a nuanced understanding of their respective strengths, weaknesses, and trade-offs.

This is not a tutorial exercise. You are expected to produce a thorough, quantitative, and qualitative comparison that would be informative to a researcher choosing among these approaches.

---

## Objectives

1. Implement three generative models: VAE, Normalizing Flow, and DDPM.
2. Train all three on the same dataset under a fair comparison protocol.
3. Evaluate using both quantitative metrics and qualitative assessment.
4. Write a conference-quality comparative analysis.

---

## Technical Requirements

### Dataset

Choose one of the following:

- **CIFAR-10** (32x32, 50K training images): Recommended for faster iteration.
- **CelebA** (64x64 center-cropped, ~160K training images): More challenging, richer structure.

You must use the same dataset, preprocessing, and train/test split for all three models.

### Model 1: Variational Autoencoder (VAE)

Implement a VAE with the following specifications:

- **Encoder:** Convolutional network mapping images to a latent distribution (mean and log-variance)
- **Decoder:** Transposed convolutional network mapping latent samples to image space
- **Latent dimension:** Experiment with at least two sizes (e.g., 64 and 256)
- **Loss:** ELBO = reconstruction loss + KL divergence
- **Reconstruction loss:** Bernoulli or Gaussian likelihood (justify your choice)

Recommended extensions (optional, for extra depth):

- Beta-VAE (vary beta from 0.1 to 10)
- VQ-VAE or hierarchical VAE
- Learned variance in the decoder

### Model 2: Normalizing Flow

Implement a normalizing flow model:

- **Architecture:** RealNVP, Glow, or Neural Spline Flow
- **Coupling layers:** At least 8 affine or spline coupling layers
- **Multi-scale architecture:** Recommended for image data
- **Exact log-likelihood:** The flow must provide tractable, exact log-likelihood computation

If using RealNVP or Glow, you must implement:

- Affine coupling layers
- Actnorm or batch normalization
- 1x1 invertible convolutions (for Glow)
- Checkerboard and channel-wise masking patterns

### Model 3: Denoising Diffusion Probabilistic Model (DDPM)

Implement a DDPM with the following:

- **Noise schedule:** Linear or cosine beta schedule (1000 timesteps recommended)
- **Denoising network:** U-Net with time embedding
  - Residual blocks with group normalization
  - Self-attention at one or more resolutions (e.g., 16x16)
  - Sinusoidal time embeddings
- **Training objective:** Simplified loss (predict noise epsilon)
- **Sampling:** Standard ancestral sampling; optionally implement DDIM for accelerated sampling

### Fair Comparison Protocol

To ensure a meaningful comparison:

- **Parameter budget:** Report parameter counts for all models. Aim for roughly comparable model sizes (within 2x). If sizes differ significantly, discuss the implications.
- **Compute budget:** Train each model for a comparable amount of wall-clock time or FLOPs, or train to convergence. Document your choice.
- **Optimizer:** Use the same optimizer family (AdamW recommended) for all models. Learning rates may differ if justified.
- **Data augmentation:** Apply the same augmentation (if any) to all models.
- **Random seeds:** Use the same seed for data loading; different seeds for model initialization are acceptable.

---

## Evaluation

### Quantitative Metrics

| Metric | VAE | Flow | DDPM | Notes |
|---|---|---|---|---|
| **FID** (Frechet Inception Distance) | Yes | Yes | Yes | Primary sample quality metric. Compute on 50K generated samples vs. training set. |
| **IS** (Inception Score) | Yes | Yes | Yes | Secondary quality/diversity metric. Report mean and std over 10 splits. |
| **ELBO** | Yes | No | No | Report for VAE. Decompose into reconstruction and KL terms. |
| **Log-likelihood** (bits/dim) | Approximate | Exact | Approximate | Exact for flows. For VAE, report ELBO bound. For DDPM, report variational bound if feasible. |
| **Sampling speed** | Yes | Yes | Yes | Wall-clock time to generate 1K samples. |
| **Training time** | Yes | Yes | Yes | Total training wall-clock time and GPU-hours. |

Use a pretrained Inception v3 network for FID and IS computation. You may use the `pytorch-fid` or `clean-fid` package for FID calculation.

### Qualitative Evaluation

Include the following figures in your report:

1. **Unconditional samples:** 8x8 grid of random samples from each model (use the same figure layout for visual comparison).
2. **Interpolation:** Latent space interpolation between pairs of images.
   - VAE: interpolate in latent space
   - Flow: interpolate in base distribution space
   - DDPM: use spherical interpolation in noise space or DDIM interpolation
3. **Reconstruction:** Show original images and reconstructions.
   - VAE: encode then decode
   - Flow: exact reconstruction (should be perfect up to numerical precision)
   - DDPM: approximate reconstruction via forward then reverse process (or DDIM inversion)
4. **Nearest neighbors:** For generated samples, show nearest neighbors in the training set (L2 in pixel space) to verify the model is not memorizing.
5. **Failure cases:** Show the worst samples from each model (e.g., lowest likelihood or highest FID contribution).

---

## Deliverables

### 1. Report (NeurIPS Format, 8 pages max)

Your report must follow the NeurIPS 2024 LaTeX template and include:

1. **Abstract** (200 words max): Summarize the comparison and key findings.
2. **Introduction**: Motivation for comparing generative model families. What questions does this comparison answer?
3. **Background**: Brief technical description of each model family. Focus on the key mathematical ideas and how they differ.
4. **Implementation Details**: Architecture choices, hyperparameters, training procedure for each model. Enough detail to reproduce your results.
5. **Experimental Setup**: Dataset, evaluation protocol, compute infrastructure.
6. **Quantitative Results**:
   - Main comparison table with all metrics
   - Training curves (loss vs. epoch/step for each model)
   - FID vs. training time plot
   - Parameter count vs. FID scatter plot
7. **Qualitative Results**:
   - Sample grids, interpolations, reconstructions as described above
   - Discussion of visual quality differences
8. **Analysis and Discussion**:
   - When would you recommend each model? Under what constraints?
   - Trade-offs: sample quality vs. likelihood vs. speed vs. training stability
   - What surprised you? What matched your expectations?
   - Limitations of your comparison
9. **Conclusion**: Key takeaways and future directions.
10. **References**

The 8-page limit excludes references and an optional appendix (up to 4 pages for additional figures, tables, or derivations).

### 2. Code Submission

- Separate, clean implementations for each model
- Shared data loading and evaluation code
- Training scripts with configuration files
- Evaluation script that computes all metrics
- `README.md` with reproduction instructions
- `requirements.txt` or `environment.yml`

### 3. Trained Model Checkpoints

- One checkpoint per model (best FID or final)
- Scripts to generate samples from each checkpoint

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Implementation** | 30% | All three models are correctly implemented and produce reasonable results. Code is clean and well-organized. Fair comparison protocol is followed. |
| **Experimental Methodology** | 25% | Evaluation metrics are correctly computed. Comparison is fair and well-controlled. Sufficient samples for reliable FID/IS. Training is adequate. |
| **Analysis** | 25% | Results are interpreted thoughtfully. Trade-offs are clearly articulated. Insights go beyond surface-level observations. Limitations are discussed honestly. |
| **Writing** | 20% | Report is clear, well-structured, and visually polished. Figures are informative and properly captioned. Mathematical notation is consistent. |

### Grade Descriptors

- **A (90-100%):** All three models produce good samples. Analysis reveals non-obvious trade-offs. Report is of workshop-paper quality. Comparison methodology is rigorous.
- **B (80-89%):** All three models work. Analysis is solid but may miss subtleties. Report is well-written. One model may underperform due to suboptimal tuning.
- **C (70-79%):** Two of three models work well. Analysis is present but shallow. Report is adequate. Comparison may not be fully fair.
- **D/F (<70%):** One or more models fail to produce reasonable samples. Analysis is missing or superficial. Report is incomplete.

---

## Helpful Guidance

### Getting Started

1. **Start with the VAE.** It is the simplest to implement and debug. Use it to validate your data pipeline and evaluation code.
2. **Implement evaluation early.** Write FID and IS computation scripts before training your second model.
3. **Budget compute carefully.** DDPM training is typically the most expensive. Start it early.
4. **Use a small-scale pilot.** Train all three models at reduced resolution (e.g., 16x16) or reduced capacity first to verify correctness.

### Common Pitfalls

- **Unfair FID comparison:** FID is sensitive to the number of generated samples, image preprocessing, and the Inception model version. Use the same settings for all models.
- **KL vanishing in VAE:** If the KL term collapses to zero, the VAE ignores the latent space. Monitor the KL term separately. Consider KL annealing or free bits.
- **Numerical instability in flows:** Log-determinant computation can overflow or underflow. Use numerically stable implementations (e.g., LU decomposition for 1x1 convolutions).
- **Slow DDPM sampling:** Standard DDPM sampling with 1000 steps is slow. Implement DDIM sampling for practical evaluation but report metrics for both.
- **Comparing apples to oranges:** A 100M-parameter DDPM vs. a 2M-parameter VAE is not a fair comparison. Match parameter budgets or explicitly discuss the difference.

### Suggested Reading

- Kingma and Welling, "Auto-Encoding Variational Bayes" (2014)
- Rezende and Mohamed, "Variational Inference with Normalizing Flows" (2015)
- Dinh et al., "Density Estimation Using Real-Valued Non-Volume Preserving Transformations" (RealNVP, 2017)
- Kingma and Dhariwal, "Glow: Generative Flow with Invertible 1x1 Convolutions" (2018)
- Ho et al., "Denoising Diffusion Probabilistic Models" (2020)
- Song et al., "Denoising Diffusion Implicit Models" (DDIM, 2021)
- Nichol and Dhariwal, "Improved Denoising Diffusion Probabilistic Models" (2021)
- Bond-Taylor et al., "Deep Generative Modelling: A Comparative Review" (2022)

### Compute Expectations

On a single modern GPU (A100 or equivalent):

- VAE on CIFAR-10: 2-4 hours to convergence
- Normalizing Flow on CIFAR-10: 6-12 hours to convergence
- DDPM on CIFAR-10: 12-24 hours to convergence
- FID evaluation (50K samples): 10-30 minutes per model

Plan for approximately 30-50 GPU-hours total. If using CelebA at 64x64, multiply by approximately 2-3x.

---

## Academic Integrity

- You must implement the core of each model yourself. Using a complete pre-built generative model (e.g., loading a pretrained diffusion model from a library) is not permitted.
- You may use utility libraries for specific components: FID computation, U-Net building blocks, data loading.
- You may reference open-source implementations for guidance but must write your own code. Cite any code you reference.
- If working in pairs, both students must contribute substantially to implementation and writing. Include a contribution statement in the report.

---

## Submission

Submit via the course portal by **Week 14, Friday 11:59 PM**:

1. Report as PDF (NeurIPS format)
2. Code as a zip archive or link to a private repository
3. Model checkpoints (upload or provide download links)
4. A `README.md` with reproduction instructions
5. If working in pairs: contribution statement
