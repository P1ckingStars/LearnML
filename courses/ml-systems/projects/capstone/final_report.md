# Capstone Final Report

**Due:** Week 20
**Weight:** 15% of capstone grade (6% of final course grade)
**Format:** 10-12 page USENIX/OSDI-style camera-ready report

---

## Overview

The final report is the culmination of your semester-long systems research project. It should be a polished, self-contained research paper that could be submitted to a systems workshop or conference. This document specifies the requirements for the report, the oral presentation, and the code submission.

---

## Report Requirements

### Format

- **Template:** USENIX or OSDI LaTeX template (available on the course website and Overleaf). ICML format is also acceptable.
- **Length:** 10-12 pages of main content, excluding references and appendix
- **Appendix:** Up to 6 pages of supplementary material (additional benchmarks, profiling traces, hardware specifications, implementation details)
- **References:** No page limit on references. Use BibTeX. Cite comprehensively.

### Required Sections

Your report must include all of the following sections. The suggested page allocations are guidelines, not strict limits.

#### Abstract (0.25 pages)

A concise summary (200-250 words) covering:

- The systems bottleneck or problem you address and why it matters
- Your approach at a high level
- Key results (include specific speedup numbers, memory savings, or throughput improvements)
- The main takeaway or conclusion

The abstract should be self-contained. A reader should understand the contribution from the abstract alone.

#### 1. Introduction (1-1.5 pages)

- Motivate the problem with concrete performance data
- Clearly state the gap in existing systems that your project addresses
- Summarize your approach and contributions in a bulleted list
- Preview the key results with specific numbers
- Outline the structure of the paper

#### 2. Background and Motivation (1-1.5 pages)

- Explain the relevant hardware architecture, software stack, or systems concepts
- Present profiling data or performance analysis that motivates your work
- Define key terminology for readers outside your specific subarea

#### 3. Related Work (1-1.5 pages)

- Organize thematically, not chronologically
- Cover all major threads of relevant prior work
- Explicitly state how your system differs from each relevant prior system
- Cite at least 20 references (more is typical for a thorough survey)
- End with a paragraph positioning your work within the landscape

#### 4. System Design (2-3 pages)

- Define the problem formally
- Describe your system architecture with diagrams
- Include pseudocode or algorithm blocks for core components
- Justify key design choices with systems reasoning (performance analysis, hardware constraints, workload characteristics)
- Discuss computational and memory complexity
- Describe the API and user interface
- A reader should be able to reimplement your system from this section alone

#### 5. Implementation (0.5-1 page)

- Programming languages, libraries, frameworks, and versions
- Hardware-specific optimizations (e.g., warp-level primitives, vectorized loads, pipeline stages)
- Key implementation challenges and solutions
- Lines of code and development effort

#### 6. Evaluation (2-3 pages)

- **Experimental setup:** Complete hardware and software configuration (GPU model, memory, interconnect bandwidth, CUDA version, driver version, PyTorch version). List all workloads (model architecture, parameter count, batch size, sequence length, precision).
- **Main results:** Your primary benchmarks comparing your system against all baselines on all metrics. This is the centerpiece of your paper. Present as tables and/or figures with clear captions.
- **Scaling analysis:** How does performance change with model size, batch size, number of GPUs, or sequence length?
- **Ablation studies:** Systematically vary key design choices to understand their contribution. Present as a table.
- **Profiling analysis:** Show where time and memory are spent. Include roofline analysis, kernel-level breakdown, or communication profiling where appropriate.
- **Correctness validation:** Evidence that your system produces correct results (numerical agreement with reference, training convergence, output validation).
- **Failure cases:** Show where your system underperforms baselines. Analyze why.

Every table and figure must have a descriptive caption that allows it to be understood without reading the surrounding text.

#### 7. Discussion (0.5-1 page)

- Interpret the results. What do they mean beyond the numbers?
- Discuss unexpected findings
- Acknowledge limitations honestly:
  - What hardware does your system target? What hardware might it not work on?
  - What workloads benefit? What workloads do not?
  - What are the scalability limits?
- Connect your findings back to the broader context established in the introduction

#### 8. Conclusion (0.5 pages)

- Summarize the key contributions (restate from the introduction, but now supported by evidence)
- State the main takeaway in 1-2 sentences
- Suggest 2-3 concrete directions for future work (be specific, not generic)

#### 9. References

- Use consistent BibTeX formatting
- Include all papers cited in the text
- Prefer published versions over arXiv preprints when available
- Double-check that all citations are correct (author names, year, venue)

### Quality Standards

The following table describes the quality standards for each aspect of the report:

| Aspect | Standard |
|---|---|
| **Figures** | High resolution (vector graphics preferred). Readable font sizes. Consistent color scheme. Error bars where applicable. Every figure referenced in the text. |
| **Tables** | Properly formatted with clear headers. Best results bolded. Units specified (ms, GB, tokens/sec). Standard deviations included where appropriate. |
| **Benchmarking** | Controlled conditions. Warmup runs excluded. Multiple iterations with variance reported. Hardware and software versions documented. |
| **Writing** | Clear, concise, and precise. No grammatical errors. Active voice preferred. Avoid jargon without definition. |
| **Length** | Use the full 10-12 pages. A 6-page paper stretched to 12 pages with padding will be penalized. A dense 10-page paper is better than a padded 12-page paper. |

---

## Oral Presentation

### Format

- **Duration:** 15 minutes of presentation + 5 minutes of Q&A
- **Schedule:** Presentations will be held during the final two class sessions (Weeks 19-20). The exact schedule will be posted by Week 17.
- **Audience:** The entire class, instructor, and TAs. External attendees may be invited.

### Presentation Content

Your presentation should cover:

1. **Problem and motivation** (2-3 minutes): What is the bottleneck? Show the profiling data.
2. **Key design insight** (3-4 minutes): What is the core idea? Use architecture diagrams.
3. **Main results** (4-5 minutes): Show the key table/figure. Explain the speedup and why it happens.
4. **Demo or live profiling** (1-2 minutes, optional but encouraged): Show your system in action. Live Nsight traces or benchmark runs are impressive.
5. **Takeaways and future work** (1-2 minutes): What did you learn? What comes next?

### Presentation Guidelines

- Use clear, readable slides (large fonts, minimal text per slide)
- Practice your timing. 15 minutes goes fast.
- Anticipate questions. Prepare backup slides with additional profiling data, ablation results, and hardware details.
- Every team member must present (for team projects)
- Live demos are encouraged but have a backup plan (pre-recorded or screenshots)

### Q&A Expectations

- The instructor and class will ask questions after your presentation
- You should be able to explain any design decision in your system
- You should know how your system compares to alternatives not in your paper
- You should understand the hardware-level behavior of your optimization
- "I don't know" is an acceptable answer, followed by how you would find out
- Defend your work but acknowledge valid criticisms

---

## Code Submission

### Requirements

Your code repository must be:

1. **Clean:** Remove dead code, debugging prints, and temporary files
2. **Documented:** Include docstrings for key functions. Comment non-obvious optimizations.
3. **Reproducible:** A reviewer should be able to reproduce your main results

### Repository Structure

Your repository should follow this general structure:

```
project/
    README.md              # Setup instructions, how to reproduce results
    requirements.txt       # or environment.yml
    configs/               # Configuration files for all benchmarks
        baseline_1.yaml
        baseline_2.yaml
        our_system.yaml
        ablation_1.yaml
    src/                   # Source code
        kernels/           # GPU kernels (CUDA, Triton)
        runtime/           # Runtime system
        compiler/          # Compiler passes (if applicable)
        utils/             # Utilities
    benchmarks/            # Benchmark scripts
        run_all.sh
        benchmark_throughput.py
        benchmark_latency.py
        benchmark_memory.py
    tests/                 # Correctness tests
        test_correctness.py
        test_numerical.py
    results/               # Saved results (tables, figures, profiling traces)
    paper/                 # LaTeX source for the report
```

### README Requirements

Your README must include:

1. **One-paragraph project description**
2. **Setup instructions:** How to install dependencies and prepare the environment
3. **Reproduction instructions:** Exact commands to reproduce the main results table
4. **Hardware requirements:** What GPU(s) are needed? What CUDA version? How much memory? Expected runtime for each benchmark.
5. **Expected results:** What numbers should the reviewer see when running your benchmarks?
6. **Known issues:** Any hardware-specific quirks or environmental requirements

### Code Quality Standards

- No hardcoded paths (use configuration files or command-line arguments)
- Deterministic benchmarks with proper warmup and cooldown
- Logging of all hardware and software versions
- Clean git history (not required but appreciated)

---

## Response to Reviews

Include a 1-page document (separate from the main report) addressing the peer reviews you received at Milestone 3. For each substantive point raised:

- Acknowledge the concern
- Explain what you changed (with specific references to sections, tables, or figures in the final report)
- If you chose not to address a point, explain why

This document is not graded for itself but demonstrates professionalism and thoroughness.

---

## Grading Rubric

The final report is graded holistically but with attention to the following components:

| Component | Weight | Criteria |
|---|---|---|
| **Novelty and Contribution** | 25% | The project makes a genuine systems contribution. It goes beyond running existing tools on new workloads. The contribution is clearly articulated. |
| **Technical Depth** | 25% | The system design is sound and well-described. Implementation is correct. Performance analysis demonstrates understanding of hardware behavior. The technical level is appropriate for a PhD course. |
| **Experimental Rigor** | 25% | Baselines are appropriate and fairly compared. Benchmarking methodology is sound (warmup, multiple runs, controlled conditions). Results are reproducible. Ablations isolate key factors. Failure cases are analyzed. Hardware and software configurations are fully documented. |
| **Writing and Presentation** | 25% | The paper is clear, well-organized, and polished. Figures and tables are publication-quality. The oral presentation is engaging and informative. Questions are answered thoughtfully. Code is clean and documented. |

### Grade Descriptors

- **A+ (95-100%):** An outstanding project that could be submitted to a top systems venue workshop with minimal revision. Novel contribution, rigorous benchmarks with proper methodology, polished writing, excellent presentation. This grade is reserved for truly exceptional work.
- **A (90-94%):** A strong project with a clear contribution, thorough benchmarks, and good writing. Minor gaps that would need addressing for publication but the work stands on its own.
- **A- (85-89%):** A good project with a reasonable contribution. Benchmarks are mostly thorough. Writing is clear. Some gaps in novelty, analysis, or presentation.
- **B+ (80-84%):** A solid effort but the contribution is incremental or the benchmarks have significant gaps. Writing is adequate. The presentation covers the material.
- **B (75-79%):** The project demonstrates competence but the contribution is limited. Benchmarks may miss key baselines or workloads. Writing needs improvement.
- **C (70-74%):** Significant issues in design, benchmarks, or writing. The project shows some effort but falls short of PhD-level expectations.
- **D/F (<70%):** The project is incomplete, technically flawed, or shows insufficient effort. Milestones were missed without justification.

---

## Submission

Submit via the course portal by **Week 20, Friday 11:59 PM**:

1. **Report:** PDF in USENIX format (10-12 pages + references + optional appendix)
2. **Presentation slides:** PDF or PPTX
3. **Code:** Link to a repository (add instructor and TAs as collaborators) or zip file
4. **Benchmark reproduction scripts:** One-click reproduction of main results
5. **Response to reviews:** 1-page PDF
6. **Contribution statement** (for teams): Updated final version

### Late Policy

- Reports submitted up to 24 hours late receive a 10% penalty.
- Reports submitted 24-48 hours late receive a 25% penalty.
- Reports submitted more than 48 hours late will not be accepted.
- Presentations cannot be rescheduled except for documented emergencies.

---

## After the Course

### Publishing Your Work

If your project has publication potential, the instructor is happy to:

- Advise on venue selection (MLSys, OSDI, SOSP, EuroSys, ASPLOS, ISCA, NeurIPS Systems Track)
- Provide feedback on revisions
- Discuss authorship if the instructor contributed substantively to the research direction

### Continuing the Research

Many capstone projects become thesis chapters or lead to further publications. If you want to continue:

- Keep your code repository maintained
- Document the open questions identified in your conclusion
- The instructor can connect you with relevant research groups or collaborators

### Portfolio

With appropriate permissions, outstanding capstone projects may be featured on the course website as examples for future students.
