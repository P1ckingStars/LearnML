---
title: "Capstone Final Report"
tags:
  - type-theory
  - project
---
# Capstone Final Report

**Due:** Week 20
**Weight:** 15% of capstone grade (6% of final course grade)
**Format:** PDF, 10-12 pages (ACM SIGPLAN or LIPIcs camera-ready format)

---

## Overview

The final report is the culmination of your semester-long research project. It should be a polished, self-contained research paper that could be submitted to a PL workshop or conference. This document specifies the requirements for the report, the oral presentation, and the artifact submission.

---

## Report Requirements

### Format

- **Template:** ACM SIGPLAN two-column (PACMPL style) or LIPIcs format (available on the course website and Overleaf)
- **Length:** 10-12 pages of main content, excluding references and appendix
- **Appendix:** Up to 6 pages of supplementary material (additional proofs, typing rules, formalization details, implementation notes)
- **References:** No page limit. Use BibTeX. Cite comprehensively.

### Required Sections

Your report must include all of the following sections. The suggested page allocations are guidelines, not strict limits.

#### Abstract (0.25 pages)

A concise summary (200-250 words) covering the problem, approach, key results (with specifics), and main conclusion. The abstract should be self-contained.

#### 1. Introduction (1-1.5 pages)

- Motivate the problem with context and a concrete example
- State the gap in existing work that your project addresses
- Summarize your contributions in a bulleted list
- Preview the key results
- Outline the paper structure

#### 2. Related Work (1-1.5 pages)

- Organize thematically, not chronologically
- Cover all major threads of relevant prior work
- Explicitly state how your work differs from each relevant prior approach
- Cite at least 20 references
- End with a paragraph positioning your work within the landscape

#### 3. Technical Development (2-3 pages)

- Define the formal syntax (types, terms, contexts)
- Present typing rules using standard inference rule notation
- Present operational semantics (reduction rules, evaluation rules) if applicable
- Include at least one figure (type system overview, proof structure, or architecture diagram)
- Justify key design choices with reasoning or references to ablation/comparison
- For theoretical projects: state main theorems precisely
- For formalization projects: describe the formalization methodology and key definitions
- A reader should be able to understand and evaluate your contribution from this section alone

#### 4. Metatheory / Evaluation (2-3 pages)

This section varies by project type:

**For type system projects:**
- State and prove (or sketch) key metatheoretic properties: type safety (progress and preservation), decidability of type checking, any additional guarantees your system provides
- If proofs are too long for the main body, include proof sketches and defer full proofs to the appendix

**For formalization projects:**
- Present the formalization structure and key statistics (lines of code, number of definitions, number of lemmas)
- Discuss formalization challenges and insights gained
- Compare against paper proofs or other formalizations of the same result

**For implementation projects:**
- Evaluate on appropriate benchmarks: annotation burden, type checking time, error message quality, expressiveness (programs accepted vs. rejected)
- Compare against alternative approaches or existing tools
- Include at least one table or figure of quantitative results

**For theoretical projects:**
- Present complete proofs of main results
- Discuss the proof techniques used and their generalizability

#### 5. Discussion (0.5-1 page)

- Interpret the results beyond the numbers or theorems
- Discuss unexpected findings
- Acknowledge limitations honestly
- Connect findings back to the broader context

#### 6. Conclusion (0.5 pages)

- Summarize key contributions (restate from the introduction, now supported by evidence)
- State the main takeaway in 1-2 sentences
- Suggest 2-3 concrete directions for future work (be specific)

#### 7. References

- Use consistent BibTeX formatting
- Prefer published versions over arXiv preprints when available
- Double-check correctness of all citations

### Quality Standards

| Aspect | Standard |
|---|---|
| **Inference Rules** | Properly typeset using mathpartir, frac, or equivalent. Consistent notation. All rules named. Premises and conclusions clearly separated. |
| **Figures** | High resolution (vector graphics preferred). Readable font sizes. Every figure referenced in the text. Captions are self-contained. |
| **Tables** | Properly formatted with clear headers. Best results indicated. Units specified. |
| **Proofs** | Clearly structured. Key steps justified. Induction hypotheses stated explicitly. Case analyses exhaustive. |
| **Writing** | Clear, concise, and precise. Technical terms defined at first use. Consistent notation throughout. No grammatical errors. |
| **Length** | Use the full 10-12 pages. Padding will be penalized. Dense, well-organized content is preferred. |

---

## Oral Presentation

### Format

- **Duration:** 15 minutes of presentation + 5 minutes of Q&A
- **Schedule:** Presentations will be held during the final two class sessions (Weeks 19-20). The exact schedule will be posted by Week 17.
- **Audience:** The entire class, instructor, and TAs. External attendees may be invited.

### Presentation Content

1. **Problem and motivation** (2-3 minutes): Why should the audience care? Use a concrete example.
2. **Key technical idea** (4-5 minutes): Present the core typing rules, proof idea, or system design. Use diagrams and examples, not walls of inference rules.
3. **Main results** (3-4 minutes): Show key theorems, evaluation results, or formalization outcomes.
4. **Demo** (1-2 minutes, optional but encouraged): Show your type checker in action, your formalization compiling, or your tool producing output.
5. **Takeaways and future work** (1-2 minutes): What did you learn? What comes next?

### Presentation Guidelines

- Use clear, readable slides with large fonts and minimal text
- Show typing rules one at a time with explanation, not all at once
- Practice your timing
- Every team member must present (for pair projects)
- Anticipate questions about design alternatives and limitations

---

## Artifact Submission

### Requirements

Your artifact must be:

1. **Buildable:** Clear build instructions. No missing dependencies.
2. **Functional:** Core functionality works as described in the paper.
3. **Documented:** README explains what the artifact does and how to use it.

### Artifact Evaluation Criteria

| Criterion | Description |
|---|---|
| **Consistency** | The artifact matches the claims in the paper. |
| **Completeness** | All features described in the paper are present in the artifact. |
| **Usability** | A reviewer can build and run the artifact following the README. |
| **Quality** | Code is organized, readable, and reasonably documented. |

---

## Response to Reviews

Include a 1-page document (separate from the main report) addressing the peer reviews you received at Milestone 3. For each substantive point raised:

- Acknowledge the concern
- Explain what you changed (with specific references to sections, rules, or theorems in the final report)
- If you chose not to address a point, explain why

This document is not graded for itself but demonstrates professionalism and thoroughness.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Novelty and Contribution** | 25% | The project makes a genuine intellectual contribution to type theory or programming languages. The contribution is clearly articulated and well-motivated. |
| **Technical Depth** | 25% | Type-theoretic content is rigorous. Typing rules are correct and well-motivated. Proofs are sound. Implementation is correct. The technical level is appropriate for a PhD course. |
| **Artifact Quality** | 25% | The artifact is correct, complete, and usable. For implementations: the type checker works on non-trivial examples and the test suite passes. For formalizations: the proofs compile and are well-structured. For theoretical work: proofs are detailed and verifiable. |
| **Writing and Presentation** | 25% | The paper is clear, well-organized, and follows PL community conventions. Inference rules are properly typeset. The presentation is engaging and handles questions well. Code is clean and documented. |

### Grade Descriptors

- **A+ (95-100%):** An outstanding project that could be submitted to a PL workshop with minimal revision. Novel contribution, rigorous metatheory or evaluation, polished writing, excellent presentation. Reserved for truly exceptional work.
- **A (90-94%):** A strong project with a clear contribution. Technical content is rigorous. The artifact works well. Writing is polished. Minor gaps that would need addressing for publication.
- **A- (85-89%):** A good project with a reasonable contribution. Technical content is mostly rigorous. Artifact works. Writing is clear. Some gaps in novelty, completeness, or presentation.
- **B+ (80-84%):** A solid effort but the contribution is incremental or the technical development has significant gaps. Writing is adequate. The artifact has limitations.
- **B (75-79%):** The project demonstrates competence but the contribution is limited. Proofs or evaluation may be incomplete. Writing needs improvement.
- **C (70-74%):** Significant issues in technical content, artifact, or writing. The project shows effort but falls short of PhD-level expectations.
- **D/F (<70%):** The project is incomplete, technically flawed, or shows insufficient effort. Milestones were missed without justification.

---

## Submission

Submit via the course portal by **Week 20, Friday 11:59 PM**:

1. **Report:** PDF in ACM SIGPLAN or LIPIcs format (10-12 pages + references + optional appendix)
2. **Presentation slides:** PDF
3. **Artifact:** Link to a repository (add instructor and TAs as collaborators) or zip file
4. **Response to reviews:** 1-page PDF
5. **Contribution statement** (for pairs): Updated final version

### Late Policy

- Reports submitted up to 24 hours late receive a 10% penalty.
- Reports submitted 24-48 hours late receive a 25% penalty.
- Reports submitted more than 48 hours late will not be accepted.
- Presentations cannot be rescheduled except for documented emergencies.

---

## After the Course

### Publishing Your Work

If your project has publication potential, the instructor is happy to:

- Advise on venue selection (POPL, ICFP, OOPSLA, PLDI workshops; TyDe, WITS, WGT, TYPES)
- Provide feedback on revisions
- Discuss authorship if the instructor contributed substantively to the research direction

### Continuing the Research

Many capstone projects become thesis chapters or lead to further publications. If you want to continue:

- Keep your repository and formalization maintained
- Document the open questions identified in your conclusion
- The instructor can connect you with relevant research groups or collaborators
