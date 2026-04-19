# Capstone: Original Systems Research Project

**Course:** Machine Learning Systems (PhD Track)
**Timeline:** Weeks 1-20
**Weight:** 30% of final grade
**Format:** Teams of 1-3 students

---

## Overview

The capstone project is the centerpiece of this course. Your goal is to produce a publishable-quality research contribution in ML systems. This may take the form of a novel system optimization, a rigorous performance study, a new systems abstraction, or a comprehensive benchmark. The project spans the entire course, with structured milestones to ensure steady progress.

By the end of the course, you should have a 10-12 page OSDI/SOSP-style report, a polished 15-minute research presentation, and a clean code repository with reproducible benchmarks that others could use to validate your results.

---

## Objectives

1. Identify a performance bottleneck, scalability limitation, or systems design problem in the ML stack.
2. Develop and execute a research plan to address it.
3. Produce rigorous experimental results with proper benchmarking methodology.
4. Communicate your findings in a clear, professional systems research paper.
5. Present your work to the class and respond to critical questions.

---

## Project Scope and Expectations

### What Constitutes a Publishable-Quality Contribution

Your project should aspire to the level of a workshop paper at a top systems or ML venue (MLSys, OSDI, SOSP, NeurIPS Systems Track) or a solid contribution to a specialized workshop. Concretely, this means:

- **Novel optimization:** A new kernel, scheduling strategy, memory management technique, or parallelism scheme that demonstrates clear speedup over baselines on a well-defined workload.
- **Thorough performance study:** A careful, controlled comparison of existing systems or strategies on a workload where such a comparison is missing or flawed in the literature. Must include insights beyond "system A is faster than system B."
- **New systems abstraction:** A new API, intermediate representation, compiler pass, or runtime mechanism that simplifies or improves ML system development.
- **Comprehensive benchmark:** A new benchmark suite, profiling methodology, or evaluation framework that addresses a gap in the field. Must include baseline results and analysis.
- **Reproduction and extension:** A rigorous reproduction of a recent systems paper with meaningful extensions (new hardware, new workloads, or improvements). The extensions must be substantial.

### What Is Not Sufficient

- Running an existing tool on a new model without systems-level contribution.
- A tutorial-style walkthrough of an existing framework.
- A reimplementation of a known system without novel analysis, optimization, or extension.
- A project where the technical contribution is trivial, regardless of engineering effort.

---

## Suggested Project Topics

The following are concrete starting points. You are strongly encouraged to develop your own idea, but these illustrate appropriate scope and ambition.

### Kernel and Operator Optimization

1. **Custom attention kernels for non-standard patterns:** Implement and optimize attention variants (sliding window, dilated, block-sparse) in Triton, benchmarking against FlashAttention on real workloads.
2. **Fused operator pipelines:** Identify a multi-operator bottleneck in a production model (e.g., LayerNorm + dropout + residual add) and write a fused kernel. Measure end-to-end training speedup.
3. **Quantized GEMM on consumer GPUs:** Implement and optimize INT4/FP8 matrix multiplication kernels targeting consumer hardware (RTX 4090). Compare against cuBLAS and Marlin.

### Compiler and Graph Optimization

4. **Custom torch.compile backend:** Implement a custom Inductor optimization pass (e.g., attention pattern recognition, memory planning) and evaluate on a suite of models.
5. **Cross-framework operator fusion:** Compare fusion strategies across TorchInductor, XLA, and TVM on a set of representative models. Identify gaps and propose improvements.
6. **Dynamic shape specialization:** Investigate the performance impact of dynamic shapes in torch.compile. Propose and evaluate strategies for reducing recompilation overhead.

### Distributed Training and Scalability

7. **Hybrid parallelism optimizer:** Build a system that automatically selects the optimal combination of data, tensor, and pipeline parallelism for a given model and cluster. Validate on models from 1B to 70B parameters.
8. **Communication-computation overlap:** Instrument and optimize the overlap between gradient communication and backward computation in FSDP. Measure the gap between achieved and theoretical overlap.
9. **Fault-tolerant training:** Implement and evaluate checkpoint-free fault recovery for distributed training using redundant computation or coded computation.

### Inference and Serving

10. **Speculative decoding system:** Implement speculative decoding with a draft model and evaluate throughput-latency trade-offs across model families and hardware configurations.
11. **KV cache compression:** Implement and evaluate KV cache compression techniques (quantization, eviction policies, paged attention variants) for long-context serving.
12. **Continuous batching optimizer:** Build or extend a continuous batching system and evaluate scheduling policies for heterogeneous request distributions.

### Data Systems and Infrastructure

13. **Data loading at scale:** Profile and optimize the data loading pipeline for large-scale multimodal training. Identify and remove bottlenecks in preprocessing, shuffling, and host-to-device transfer.
14. **Feature store for online ML:** Design and benchmark a feature store optimized for low-latency online feature serving with consistency guarantees.

### Model Compression and Efficiency

15. **Post-training quantization toolkit:** Implement GPTQ, AWQ, and SqueezeLLM for a family of models. Conduct a rigorous accuracy-latency-memory Pareto analysis.
16. **Structured pruning for inference speedup:** Implement structured pruning (channel, head, layer) and measure actual inference speedup (not just parameter reduction) on real hardware.

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
| **Novelty** | 25% | The project addresses a genuine open problem. The approach is not a trivial application of existing tools. There is a clear systems contribution. |
| **Technical Depth** | 25% | The system design is sound. Implementation is correct. Performance analysis is rigorous. The technical level is appropriate for a PhD course. |
| **Experimental Rigor** | 25% | Benchmarks are well-designed with proper baselines and controlled conditions. Results are reproducible. Hardware and software configurations are fully documented. Ablations isolate the effect of key design choices. |
| **Writing and Presentation** | 25% | The paper is clear, well-organized, and professionally formatted. Figures are informative. The presentation is engaging and clearly explains the contribution. Questions are handled thoughtfully. |

### Grade Descriptors

- **A (90-100%):** A genuinely novel systems contribution with rigorous benchmarks and clear writing. The paper could be submitted to a workshop at a top venue with minimal revision. The presentation demonstrates deep understanding of both the system and the underlying hardware.
- **B (80-89%):** A solid project with a clear contribution. Benchmarks are thorough. Writing is good. Minor gaps in novelty, analysis, or presentation.
- **C (70-79%):** The project has some merit but the contribution is limited. Benchmarks may have gaps. Writing is adequate. The work would benefit from significant revision.
- **D/F (<70%):** The project lacks a clear contribution. Experiments are incomplete or flawed. Writing is poor. Milestones were missed.

---

## Resources

### Compute

- Each team receives an allocation of 500 GPU-hours on the department cluster (A100 or H100 GPUs).
- Multi-node allocations available upon request with justification for distributed training projects.
- Additional compute may be available through cloud credits (GCP, AWS, or Azure); check the course website.
- Manage your compute budget carefully. Start with small-scale experiments and profile before scaling.

### LaTeX Template

Use the USENIX or OSDI LaTeX template for your report. Download from the course website or use the Overleaf template linked on the syllabus. ICML format is also acceptable.

### Office Hours

The instructor and TAs hold dedicated capstone office hours (check the course calendar). Use these for:

- Discussing project ideas and scope
- Debugging performance bottlenecks
- Getting feedback on benchmarking methodology
- Troubleshooting cluster and hardware issues

### Literature

- Use Semantic Scholar, Google Scholar, and arXiv to find relevant papers.
- The course reading list covers foundational systems work; you are expected to go deeper for your specific topic.
- Read at least 15-20 papers relevant to your project.

---

## Academic Integrity

- All team members must contribute meaningfully.
- Code may build on open-source systems, but all novel contributions must be your own. Cite everything you use.
- Your report must be original writing. LLM-assisted editing is permitted; LLM-generated analysis is not.
- Collaboration between teams is limited to discussion. Do not share code or results across teams.
- If your project involves proprietary hardware or software, consult the instructor about disclosure requirements.

---

## FAQ

**Q: Can I continue work I started before this course?**
A: Yes, but you must clearly delineate what was done before vs. during the course. Only work done during the course will be graded. Disclose prior work in your proposal.

**Q: Can I use my capstone for my thesis?**
A: Absolutely. Many students use the capstone as a starting point for thesis research. However, the graded deliverables must be self-contained.

**Q: What if my initial optimization does not yield the expected speedup?**
A: This is normal in systems research. The milestones are designed to catch this early. Pivoting is acceptable and expected. Document what you tried, profile the bottleneck, and explain why the approach did not work. A well-analyzed negative result is valuable.

**Q: How much compute do I really need?**
A: This varies enormously by project. Kernel optimization projects may need only a single GPU. Distributed training projects may need 8-64 GPUs for meaningful experiments. Discuss with the instructor if you are unsure.

**Q: Can I publish my capstone work?**
A: Yes, and you are encouraged to do so. The instructor is happy to advise on venue selection and revision.
