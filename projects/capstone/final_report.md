# Capstone Final Report

**Due:** Week 20
**Weight:** 15% of capstone grade (6% of final course grade)
**Format:** 10-12 page ICML-style camera-ready report

---

## Overview

The final report is the culmination of your semester-long research project. It should be a polished, self-contained research paper that could be submitted to a workshop or conference. This document specifies the requirements for the report, the oral presentation, and the code submission.

---

## Report Requirements

### Format

- **Template:** ICML 2024 LaTeX template (available on the course website and Overleaf)
- **Length:** 10-12 pages of main content, excluding references and appendix
- **Appendix:** Up to 6 pages of supplementary material (additional experiments, proofs, implementation details)
- **References:** No page limit on references. Use BibTeX. Cite comprehensively.

### Required Sections

Your report must include all of the following sections. The suggested page allocations are guidelines, not strict limits.

#### Abstract (0.25 pages)

A concise summary (200-250 words) covering:

- The problem you address and why it matters
- Your approach at a high level
- Key results (include specific numbers)
- The main takeaway or conclusion

The abstract should be self-contained. A reader should understand the contribution from the abstract alone.

#### 1. Introduction (1-1.5 pages)

- Motivate the problem with context and examples
- Clearly state the gap in existing work that your project addresses
- Summarize your approach and contributions in a bulleted list
- Preview the key results
- Outline the structure of the paper

#### 2. Related Work (1-1.5 pages)

- Organize thematically, not chronologically
- Cover all major threads of relevant prior work
- Explicitly state how your work differs from each relevant prior method
- Cite at least 20 references (more is typical for a thorough survey)
- End with a paragraph positioning your work within the landscape

#### 3. Method (2-3 pages)

- Define the problem formally with mathematical notation
- Describe your method in complete detail
- Include at least one figure (architecture diagram, method overview, or conceptual illustration)
- Include pseudocode or an algorithm block for complex procedures
- Justify key design choices with reasoning or ablation references
- Discuss computational complexity if relevant
- A reader should be able to reimplement your method from this section alone

#### 4. Experimental Setup (1-1.5 pages)

- **Datasets:** Name, size, splits, preprocessing, any filtering or augmentation
- **Baselines:** List all baselines with brief descriptions. Explain why each is appropriate.
- **Metrics:** Define all evaluation metrics precisely. Justify your choice of metrics.
- **Implementation details:** Framework, optimizer, learning rate schedule, batch size, training epochs/steps, hardware, random seeds
- **Hyperparameter selection:** How were hyperparameters chosen? Grid search, random search, manual tuning? Report the search space.
- **Reproducibility:** Enough detail that someone could reproduce your results. Reference your code repository.

#### 5. Results (2-3 pages)

- **Main results table:** A single table comparing your method against all baselines on all metrics. This is the centerpiece of your paper.
- **Statistical significance:** Report standard deviations over multiple runs (at least 3) for key results. Use statistical tests if appropriate.
- **Training curves:** Show learning dynamics for your method and representative baselines.
- **Ablation studies:** Systematically vary key components of your method to understand their contribution. Present as a table.
- **Qualitative results** (if applicable): Visualizations, generated samples, attention maps, case studies.
- **Computational cost:** Training time, inference time, parameter count, memory usage. Compare across methods.
- **Failure cases:** Show where your method fails. Analyze why.

Every table and figure must have a descriptive caption that allows it to be understood without reading the surrounding text.

#### 6. Discussion (0.5-1 page)

- Interpret the results. What do they mean beyond the numbers?
- Discuss unexpected findings
- Acknowledge limitations honestly:
  - What assumptions does your method make?
  - On what data or tasks might it fail?
  - What are the computational limitations?
- Connect your findings back to the broader context established in the introduction

#### 7. Conclusion (0.5 pages)

- Summarize the key contributions (restate from the introduction, but now supported by evidence)
- State the main takeaway in 1-2 sentences
- Suggest 2-3 concrete directions for future work (be specific, not generic)

#### 8. References

- Use consistent BibTeX formatting
- Include all papers cited in the text
- Prefer published versions over arXiv preprints when available
- Double-check that all citations are correct (author names, year, venue)

### Quality Standards

The following table describes the quality standards for each aspect of the report:

| Aspect | Standard |
|---|---|
| **Figures** | High resolution (vector graphics preferred). Readable font sizes. Consistent color scheme. Every figure referenced in the text. |
| **Tables** | Properly formatted with clear headers. Best results bolded. Units specified. Standard deviations included where appropriate. |
| **Mathematics** | Consistent notation throughout. All symbols defined at first use. Equations numbered for reference. |
| **Writing** | Clear, concise, and precise. No grammatical errors. Passive voice is acceptable but active voice is preferred. Avoid jargon without definition. |
| **Length** | Use the full 10-12 pages. A 6-page paper stretched to 12 pages with padding will be penalized. A dense 10-page paper is better than a padded 12-page paper. |

---

## Oral Presentation

### Format

- **Duration:** 15 minutes of presentation + 5 minutes of Q&A
- **Schedule:** Presentations will be held during the final two class sessions (Weeks 19-20). The exact schedule will be posted by Week 17.
- **Audience:** The entire class, instructor, and TAs. External attendees may be invited.

### Presentation Content

Your presentation should cover:

1. **Problem and motivation** (2-3 minutes): Why should the audience care?
2. **Key insight of your method** (3-4 minutes): What is the core idea? Use diagrams.
3. **Main results** (4-5 minutes): Show the key table/figure. Explain what it means.
4. **Demo or visualization** (1-2 minutes, optional but encouraged): Show your model in action.
5. **Takeaways and future work** (1-2 minutes): What did you learn? What comes next?

### Presentation Guidelines

- Use clear, readable slides (large fonts, minimal text per slide)
- Practice your timing. 15 minutes goes fast.
- Anticipate questions. Prepare backup slides for common follow-ups.
- Every team member must present (for team projects)
- You may use live demos but have a backup plan (pre-recorded video or screenshots)

### Q&A Expectations

- The instructor and class will ask questions after your presentation
- You should be able to explain any design decision in your method
- You should know how your method compares to alternatives not in your paper
- "I don't know" is an acceptable answer, followed by how you would find out
- Defend your work but acknowledge valid criticisms

---

## Code Submission

### Requirements

Your code repository must be:

1. **Clean:** Remove dead code, debugging prints, and temporary files
2. **Documented:** Include docstrings for key functions and classes
3. **Reproducible:** A reviewer should be able to reproduce your main results

### Repository Structure

Your repository should follow this general structure:

```
project/
    README.md              # Setup instructions, how to reproduce results
    requirements.txt       # or environment.yml
    configs/               # Configuration files for all experiments
        baseline_1.yaml
        baseline_2.yaml
        our_method.yaml
        ablation_1.yaml
    src/                   # Source code
        models/            # Model definitions
        data/              # Data loading and preprocessing
        training/          # Training loops
        evaluation/        # Evaluation metrics
        utils/             # Utilities
    scripts/               # Entry point scripts
        train.py
        evaluate.py
        generate_figures.py
    results/               # Saved results (tables, figures)
    checkpoints/           # Model checkpoints (or download instructions)
    paper/                 # LaTeX source for the report
```

### README Requirements

Your README must include:

1. **One-paragraph project description**
2. **Setup instructions:** How to install dependencies and prepare data
3. **Reproduction instructions:** Exact commands to reproduce the main results table
4. **Pretrained models:** Download links or instructions for trained checkpoints
5. **Expected results:** What numbers should the reviewer see when running your code?
6. **Hardware requirements:** What GPU(s) are needed? How much memory? How long does training take?

### Code Quality Standards

- No hardcoded paths (use configuration files or command-line arguments)
- Deterministic training with random seed control
- Logging of all hyperparameters and metrics
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
| **Novelty and Contribution** | 25% | The project makes a genuine intellectual contribution. It goes beyond applying existing methods to existing problems. The contribution is clearly articulated. |
| **Technical Depth** | 25% | The method is sound and well-described. Implementation is correct. Experiments are properly designed with controls and ablations. Results are statistically meaningful. |
| **Experimental Rigor** | 25% | Baselines are appropriate and fairly compared. Metrics are well-chosen. Results are reproducible. Ablations isolate key factors. Failure cases are analyzed. Computational costs are reported. |
| **Writing and Presentation** | 25% | The paper is clear, well-organized, and polished. Figures and tables are publication-quality. The oral presentation is engaging and informative. Questions are answered thoughtfully. Code is clean and documented. |

### Grade Descriptors

- **A+ (95-100%):** An outstanding project that could be submitted to a top venue workshop with minimal revision. Novel contribution, rigorous experiments, polished writing, excellent presentation. This grade is reserved for truly exceptional work.
- **A (90-94%):** A strong project with a clear contribution, thorough experiments, and good writing. Minor gaps that would need addressing for publication but the work stands on its own.
- **A- (85-89%):** A good project with a reasonable contribution. Experiments are mostly thorough. Writing is clear. Some gaps in novelty, analysis, or presentation.
- **B+ (80-84%):** A solid effort but the contribution is incremental or the experiments have significant gaps. Writing is adequate. The presentation covers the material.
- **B (75-79%):** The project demonstrates competence but the contribution is limited. Experiments may miss key baselines or ablations. Writing needs improvement.
- **C (70-74%):** Significant issues in method, experiments, or writing. The project shows some effort but falls short of PhD-level expectations.
- **D/F (<70%):** The project is incomplete, technically flawed, or shows insufficient effort. Milestones were missed without justification.

---

## Submission

Submit via the course portal by **Week 20, Friday 11:59 PM**:

1. **Report:** PDF in ICML format (10-12 pages + references + optional appendix)
2. **Presentation slides:** PDF or PPTX
3. **Code:** Link to a repository (add instructor and TAs as collaborators) or zip file
4. **Model checkpoints:** Upload or provide download links
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

- Advise on venue selection (conference, workshop, journal)
- Provide feedback on revisions
- Discuss authorship if the instructor contributed substantively to the research direction

### Continuing the Research

Many capstone projects become thesis chapters or lead to further publications. If you want to continue:

- Keep your code repository maintained
- Document the open questions identified in your conclusion
- The instructor can connect you with relevant research groups or collaborators

### Portfolio

With appropriate permissions, outstanding capstone projects may be featured on the course website as examples for future students.
