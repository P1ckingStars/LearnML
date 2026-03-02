# Capstone: Original Research Project

**Course:** Deep Learning (PhD Track)
**Timeline:** Weeks 1-20
**Weight:** 30% of final grade
**Format:** Teams of 1-3 students

---

## Overview

The capstone project is the centerpiece of this course. Your goal is to produce a publishable-quality research contribution in deep learning. This may take the form of a novel method, a thorough empirical study, a theoretical result, or a comprehensive benchmark. The project spans the entire course, with structured milestones to ensure steady progress.

By the end of the course, you should have a 10-12 page ICML-style report, a polished 15-minute research presentation, and a clean code repository that others could use to reproduce your results.

---

## Objectives

1. Identify an open research question in deep learning.
2. Develop and execute a research plan to address it.
3. Produce rigorous experimental or theoretical results.
4. Communicate your findings in a clear, professional research paper.
5. Present your work to the class and respond to critical questions.

---

## Project Scope and Expectations

### What Constitutes a Publishable-Quality Contribution

Your project should aspire to the level of a workshop paper at a top venue (NeurIPS, ICML, ICLR) or a solid contribution to a specialized workshop. Concretely, this means:

- **Novel method:** A new architecture, training procedure, loss function, or algorithm that demonstrates clear improvement over baselines on a well-defined task.
- **Thorough empirical study:** A careful, controlled comparison of existing methods on a problem where such a comparison is missing or flawed in the literature. Must include insights beyond "method A beats method B."
- **Theoretical result:** A new theorem, bound, or analysis that improves our understanding of deep learning. Must include empirical validation or illustration.
- **Comprehensive benchmark:** A new dataset, evaluation protocol, or benchmark suite that addresses a gap in the field. Must include baseline results and analysis.
- **Reproduction and extension:** A rigorous reproduction of a recent paper with meaningful extensions (new datasets, ablations, or improvements). The extensions must be substantial.

### What Is Not Sufficient

- Applying an existing model to a new dataset without methodological contribution.
- A literature survey without experiments.
- A reimplementation of a known method without novel analysis or extension.
- A project where the technical contribution is trivial, regardless of engineering effort.

---

## Suggested Project Topics

The following are concrete starting points. You are strongly encouraged to develop your own idea, but these illustrate appropriate scope and ambition.

### Architectures and Representations

1. **Efficient attention mechanisms:** Design and evaluate a new attention variant (e.g., combining ideas from linear attention and local attention) and benchmark against standard multi-head attention on language modeling and long-range arena tasks.
2. **State-space models vs. transformers:** Conduct a controlled comparison of S4/Mamba-style models against transformers across modalities (text, audio, time series). Identify where each excels and why.
3. **Mixture of experts scaling:** Investigate the training dynamics of sparse MoE layers. How does expert specialization emerge? What determines load balancing failure modes?
4. **Positional encoding design space:** Systematically compare sinusoidal, learned, RoPE, ALiBi, and other positional encodings across sequence lengths and tasks. Propose an improved variant.
5. **Neural network symmetries:** Explore equivariant architectures for a specific domain (molecules, physics simulations, point clouds). Compare against augmentation-based approaches.

### Optimization and Training

6. **Optimizer design:** Propose or evaluate a new optimizer. Compare against Adam, AdamW, Lion, and Sophia on standard benchmarks. Include analysis of convergence properties.
7. **Learning rate schedule theory:** Investigate why cosine annealing, warmup, and cyclic schedules work. Develop a principled schedule selection method.
8. **Gradient noise and generalization:** Study the relationship between gradient noise (batch size, learning rate) and generalization. Reproduce and extend the findings of Smith et al. on the noise scale.
9. **Loss landscape geometry:** Visualize and analyze loss landscapes for different architectures. Relate landscape properties to generalization and training dynamics.
10. **Training instabilities at scale:** Reproduce and analyze known training instabilities (loss spikes, divergence) in transformer training. Propose and evaluate mitigation strategies.

### Generative Models

11. **Diffusion model efficiency:** Propose a method to reduce DDPM sampling steps without quality degradation. Compare against DDIM, DPM-Solver, and consistency models.
12. **Conditional generation control:** Develop or improve methods for controllable generation with diffusion models (e.g., classifier-free guidance alternatives, compositional generation).
13. **Flow matching vs. diffusion:** Conduct a thorough comparison of flow matching and score-based diffusion. When does each formulation have advantages?
14. **Latent diffusion analysis:** Investigate the role of the latent space in latent diffusion models. How does autoencoder quality affect generation? What is lost in compression?

### Robustness, Fairness, and Safety

15. **Adversarial robustness of vision transformers:** Compare the adversarial robustness of ViTs vs. CNNs. Investigate whether attention provides inherent robustness advantages.
16. **Calibration of large models:** Study the calibration properties of large language models. Do larger models become better or worse calibrated? Propose calibration improvements.
17. **Bias in generative models:** Measure and mitigate demographic biases in a generative model (image or text). Propose a quantitative evaluation framework.

### Theory

18. **Neural tangent kernel analysis:** Extend NTK analysis to a modern architecture (ViT, MLP-Mixer). Compare finite-width behavior to the NTK prediction.
19. **Implicit regularization:** Study what implicit regularization AdamW provides compared to SGD on transformer architectures. Design experiments to isolate the effect.
20. **Scaling laws:** Develop scaling laws for a domain where they do not yet exist (e.g., graph neural networks, reinforcement learning, multimodal models). Validate with extensive experiments.

### Applications

21. **Scientific ML:** Apply deep learning to a scientific problem (protein structure, weather prediction, molecular dynamics). The contribution should be methodological, not just application.
22. **Multimodal learning:** Propose or improve a method for aligning representations across modalities (e.g., vision-language, audio-text). Evaluate on downstream tasks.
23. **Continual learning:** Develop or evaluate methods for training on non-stationary data distributions. Compare against rehearsal, regularization, and architecture-based approaches.

---

## Team Formation

- **Team size:** 1-3 students
- **Expectations scale with team size:**
  - Solo: Scope of a workshop paper
  - Pair: Scope of a short conference paper
  - Trio: Scope of a full conference paper
- **Team formation deadline:** Week 3
- **Contribution tracking:** Each milestone must include a contribution statement. All team members must contribute meaningfully to both implementation and writing.
- **Conflict resolution:** If team issues arise, contact the instructor immediately. Do not wait until the final report.

---

## Timeline and Milestones

| Week | Milestone | Weight | Deliverable |
|---|---|---|---|
| 5 | Problem Statement | 5% | 2-page proposal |
| 10 | Method + Preliminary Results | 10% | 4-page progress report |
| 15 | Full Draft | 10% | 8-page draft + peer review |
| 20 | Final Report + Presentation | 15% | 10-12 page report, 15-min talk, code |

See the individual milestone specification documents for detailed requirements:

- [Milestone 1: Problem Statement](milestone_1.md)
- [Milestone 2: Method + Preliminary Results](milestone_2.md)
- [Milestone 3: Full Draft](milestone_3.md)
- [Final Report](final_report.md)

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Novelty** | 25% | The project addresses a genuine open question. The approach is not a trivial application of existing methods. There is a clear intellectual contribution. |
| **Technical Depth** | 25% | The method is sound. Implementation is correct. Mathematical formulations are rigorous. The technical level is appropriate for a PhD course. |
| **Experimental Rigor** | 25% | Experiments are well-designed with proper baselines and controls. Results are reproducible. Statistical significance is assessed where appropriate. Ablations isolate the effect of key design choices. |
| **Writing and Presentation** | 25% | The paper is clear, well-organized, and professionally formatted. Figures are informative. The presentation is engaging and clearly explains the contribution. Questions are handled thoughtfully. |

### Grade Descriptors

- **A (90-100%):** A genuinely novel contribution with rigorous experiments and clear writing. The paper could be submitted to a workshop at a top venue with minimal revision. The presentation demonstrates deep understanding.
- **B (80-89%):** A solid project with a clear contribution. Experiments are thorough. Writing is good. Minor gaps in novelty, analysis, or presentation.
- **C (70-79%):** The project has some merit but the contribution is limited. Experiments may have gaps. Writing is adequate. The work would benefit from significant revision.
- **D/F (<70%):** The project lacks a clear contribution. Experiments are incomplete or flawed. Writing is poor. Milestones were missed.

---

## Resources

### Compute

- Each team receives an allocation of 500 GPU-hours on the department cluster (A100 GPUs).
- Additional compute may be available upon request with justification.
- Cloud credits (GCP, AWS, or Azure) may be distributed; check the course website.
- Manage your compute budget carefully. Start with small-scale experiments.

### LaTeX Template

Use the ICML 2024 LaTeX template for your report. Download from the course website or use the Overleaf template linked on the syllabus.

### Office Hours

The instructor and TAs hold dedicated capstone office hours (check the course calendar). Use these for:

- Discussing project ideas and scope
- Debugging experimental setups
- Getting feedback on writing
- Troubleshooting compute issues

### Literature

- Use Semantic Scholar, Google Scholar, and arXiv to find relevant papers.
- The course reading list covers foundational work; you are expected to go deeper for your specific topic.
- Read at least 15-20 papers relevant to your project.

---

## Academic Integrity

- All team members must contribute meaningfully.
- Code may build on open-source implementations, but all novel contributions must be your own. Cite everything you use.
- Your report must be original writing. LLM-assisted editing is permitted; LLM-generated analysis is not.
- Collaboration between teams is limited to discussion. Do not share code or results across teams.
- If your project involves human subjects or sensitive data, consult the instructor about IRB requirements.

---

## FAQ

**Q: Can I continue work I started before this course?**
A: Yes, but you must clearly delineate what was done before vs. during the course. Only work done during the course will be graded. Disclose prior work in your proposal.

**Q: Can I use my capstone for my thesis?**
A: Absolutely. Many students use the capstone as a starting point for thesis research. However, the graded deliverables must be self-contained.

**Q: What if my initial idea does not work?**
A: This is normal in research. The milestones are designed to catch this early. Pivoting is acceptable and expected. Document what you tried and why you changed direction. Negative results, if well-analyzed, are valuable.

**Q: How much compute do I really need?**
A: This varies enormously by project. Some theoretical projects need almost no compute. Large-scale empirical studies may need the full allocation. Discuss with the instructor if you are unsure.

**Q: Can I publish my capstone work?**
A: Yes, and you are encouraged to do so. The instructor is happy to advise on venue selection and revision.
