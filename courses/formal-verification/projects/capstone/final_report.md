# Capstone Final Report

**Due:** Week 20
**Weight:** 15% of capstone grade (6% of final course grade)
**Format:** 8-page report + complete Isabelle development

---

## Overview

The final report is the culmination of your semester-long formalization project. It should be a polished, self-contained document that could serve as the basis for a submission to a formalization venue (ITP, CPP, or the AFP). This document specifies the requirements for the report, the oral presentation, and the code submission.

---

## Report Requirements

### Format

- **Template:** Use the LIPIcs or LNCS LaTeX template (available on the course website)
- **Length:** 8 pages of main content, excluding references and appendix
- **Appendix:** Up to 4 pages of supplementary material (additional proof details, code listings, performance data)
- **References:** No page limit on references. Use BibTeX. Cite comprehensively, including the Isabelle distribution, AFP entries, and textbook sources.

### Required Sections

Your report must include all of the following sections. The suggested page allocations are guidelines, not strict limits.

#### Abstract (0.25 pages)

A concise summary (150-200 words) covering:

- The formalization goal and why it matters
- The proof assistant and logical framework used
- Key results (include specific statistics: line count, number of lemmas)
- The main insight or lesson learned

The abstract should be self-contained. A reader should understand the contribution from the abstract alone.

#### 1. Introduction (1-1.5 pages)

- Motivate the formalization with mathematical context
- State the main result informally
- Summarize the formalization and its key statistics
- Highlight the most interesting proof engineering challenges and how they were resolved
- Outline the structure of the report

#### 2. Mathematical Background (1-1.5 pages)

- State the main theorem and all key definitions in standard mathematical notation
- Provide the informal proof or a sketch thereof
- This section should be self-contained: a reader familiar with basic set theory or program verification should be able to follow it without additional references
- Cite textbook sources

#### 3. Formalization (2-3 pages)

This is the core of the report and the section that distinguishes a formalization paper from a mathematics paper.

- **Definitional choices:** For each key definition, present both the informal version and the Isabelle formalization. Explain any divergence. Discuss alternatives considered and why they were rejected.
- **Theory structure:** Include a dependency diagram of your theory files. Explain the overall architecture.
- **Key proofs:** For the 2-3 most important or interesting proofs, describe the proof strategy in detail. Include short Isabelle code snippets where they illuminate the approach. Explain where the formal proof diverged from the informal argument and why.
- **Automation:** Discuss the role of automation in your development. Which proofs were found by Sledgehammer? Where was structured Isar reasoning essential? What simp rules did you add and why?
- **Infrastructure:** What did you build on from the Isabelle distribution or AFP? What infrastructure did you develop that could be reused?

A reader should be able to understand your formalization strategy without reading the full Isabelle code.

#### 4. Evaluation (0.5-1 page)

- **Statistics:** Total lines of Isabelle code, number of definitions, number of lemmas/theorems, number of theory files, approximate development time in person-hours
- **Proof style breakdown:** Approximate percentage of proofs using apply-scripts, structured Isar, and one-line automation
- **Comparison to informal proof:** How does the length of the formal proof compare to the informal proof? What accounts for the difference?
- **Reusability:** Which parts of your development are reusable? Could they be submitted to the AFP independently?

#### 5. Related Work (0.5-1 page)

- Survey related formalizations in Isabelle and other proof assistants
- Compare your approach to alternatives
- If similar results have been formalized in other systems, discuss the differences in proof style and effort

#### 6. Discussion (0.5-1 page)

- What was the hardest part of the formalization and why?
- What would you do differently if starting over?
- What limitations does your formalization have?
- How could the formalization be extended?
- Lessons learned about the gap between informal and formal mathematics

#### 7. Conclusion (0.25 pages)

- Restate the key contributions
- State whether the development is suitable for AFP submission
- Suggest 2-3 concrete extensions or follow-up formalization projects

#### 8. References

- Use consistent BibTeX formatting
- Cite all Isabelle theories you import, all AFP entries you reference, and all mathematical textbooks you follow
- Include the Isabelle distribution itself as a reference

### Quality Standards

| Aspect | Standard |
|---|---|
| **Code snippets** | Use lstlisting or minted with Isabelle syntax highlighting. Only include snippets that illustrate a point; do not dump entire theory files. |
| **Diagrams** | Theory dependency diagrams should be clean and readable. Use TikZ or a graph drawing tool. |
| **Mathematics** | Standard notation consistent with the textbook source. All symbols defined. |
| **Writing** | Clear, concise, and precise. First person is acceptable ("we define," "we prove"). Avoid unnecessary jargon. |
| **Length** | Use the full 8 pages. A 4-page report stretched with padding will be penalized. A dense 7-page report is better than a padded 8-page report. |

---

## Oral Presentation

### Format

- **Duration:** 15 minutes of presentation + 5 minutes of Q&A
- **Schedule:** Presentations will be held during the final two class sessions (Weeks 19-20). The exact schedule will be posted by Week 17.
- **Audience:** The entire class, instructor, and TAs.

### Presentation Content

Your presentation should cover:

1. **Mathematical context** (2-3 minutes): What result did you formalize and why does it matter?
2. **Key formalization decisions** (4-5 minutes): Show the most interesting definitional choice or proof strategy. Use live Isabelle/jEdit if possible.
3. **Main results** (3-4 minutes): State the main theorem and show the Isabelle output confirming it.
4. **Difficulties and lessons** (2-3 minutes): What was the hardest proof? What did you learn about formalization?
5. **Demo** (1-2 minutes, optional but encouraged): Walk through a proof in Isabelle/jEdit, showing the proof state at key steps.

### Presentation Guidelines

- Use clear, readable slides (large fonts, minimal text per slide)
- When showing Isabelle code on slides, use a large monospace font and highlight the important parts
- Practice your timing. 15 minutes goes fast.
- Anticipate questions about definitional choices and proof strategies
- For team projects, both members must present
- Have a backup plan if the live Isabelle demo fails (screenshots of proof states)

### Q&A Expectations

- You should be able to explain any definitional choice in your formalization
- You should know what alternative definitions you considered and why you rejected them
- You should be able to describe the proof state at key points in your most important proof
- "I do not know" is an acceptable answer, followed by how you would investigate

---

## Code Submission

### Requirements

Your Isabelle development must:

1. **Build cleanly** with `isabelle build -D .` on Isabelle2025
2. **Contain no sorry** in the final version (if a sorry remains, it must be documented and justified in the report)
3. **Be well-organized** with clear theory file structure and a ROOT file
4. **Include comments** explaining non-obvious proof steps and definitional choices

### Repository Structure

```
project/
    README.md              # Setup instructions, how to build
    ROOT                   # Isabelle session root file
    theories/
        Definitions.thy    # Core definitions
        Auxiliary.thy      # Supporting lemmas
        MainResult.thy     # Main theorem
        ...
    c_source/              # Track B/C only
        module.c
        module.h
    document/
        root.tex           # Report LaTeX source
    slides/
        presentation.pdf
```

### README Requirements

Your README must include:

1. **One-paragraph project description**
2. **Isabelle version:** Which version of Isabelle is required
3. **Build instructions:** Exact command to build all theory files
4. **Dependencies:** Any AFP entries or external libraries required
5. **File guide:** Brief description of each theory file and its role
6. **For Track B/C:** Instructions for setting up AutoCorres

### Code Quality Standards

- Consistent naming conventions (follow Isabelle community standards)
- Definitions and lemmas should have descriptive names
- Theory files should have a clear logical progression
- Avoid monolithic theory files; factor into coherent units of 200-500 lines each
- Simp rules should be documented (why was this rule added to the simpset?)

---

## Response to Reviews

Include a 1-page document (separate from the main report) addressing the peer reviews you received at Milestone 3. For each substantive point raised:

- Acknowledge the concern
- Explain what you changed in the code or report
- If you chose not to address a point, explain why

This document is not graded for itself but demonstrates professionalism and engagement with the review process.

---

## Grading Rubric

The final report is graded holistically but with attention to the following components:

| Component | Weight | Criteria |
|---|---|---|
| **Formalization Depth** | 25% | The formalization covers a non-trivial result. The main theorem is proved without sorry. The development demonstrates genuine engagement with formalization challenges. |
| **Proof Engineering** | 25% | Code is well-organized. Definitions are well-chosen. Proofs use appropriate techniques (automation where effective, structured reasoning where clarity demands it). Lemma factoring is thoughtful. The development could be understood by another Isabelle user. |
| **Report Quality** | 25% | The formalization strategy section is detailed and insightful. Definitional choices are explained and justified. Difficulties are discussed honestly. The report is well-written and well-organized. |
| **Presentation and Completeness** | 25% | The oral presentation is clear and engaging. Questions are answered thoughtfully. The code builds cleanly. All deliverables are submitted on time. The README is helpful. |

### Grade Descriptors

- **A+ (95-100%):** An outstanding formalization that could be submitted to the AFP or a formalization venue with minimal revision. Clean code, insightful report, excellent presentation. This grade is reserved for truly exceptional work.
- **A (90-94%):** A strong formalization with complete proofs, good proof engineering, and a clear report. Minor issues in code style or report detail.
- **A- (85-89%):** A good formalization with complete proofs. Some proof engineering decisions could be improved. Report is clear but may lack depth in the formalization strategy section.
- **B+ (80-84%):** A solid effort. Main theorem is proved. Code works but may have style issues. Report is adequate. Proof engineering is functional but not polished.
- **B (75-79%):** The formalization is complete but limited. Some proofs are unnecessarily long or opaque. Report needs improvement. The student demonstrates competence but not mastery.
- **C (70-74%):** Significant issues: sorry in non-trivial lemmas, poor code organization, superficial report. The formalization shows some effort but falls short of PhD-level expectations.
- **D/F (<70%):** The formalization is incomplete, has sorry in the main theorem, or demonstrates insufficient effort. Report is poor or missing.

---

## Submission

Submit via the course portal by **Week 20, Friday 11:59 PM**:

1. **Report:** PDF in LIPIcs or LNCS format (8 pages + references + optional appendix)
2. **Presentation slides:** PDF
3. **Isabelle development:** Repository link or zip archive (must build with `isabelle build`)
4. **Response to reviews:** 1-page PDF
5. **Contribution statement** (for teams): Updated final version

### Late Policy

- Reports submitted up to 24 hours late receive a 10% penalty.
- Reports submitted 24-48 hours late receive a 25% penalty.
- Reports submitted more than 48 hours late will not be accepted.
- Presentations cannot be rescheduled except for documented emergencies.

---

## After the Course

### AFP Submission

If your formalization is suitable for the Archive of Formal Proofs, the instructor is happy to:

- Advise on AFP submission guidelines (documentation requirements, style conventions)
- Review your submission draft
- Serve as a shepherd for the submission process

### Continuing the Formalization

Many capstone projects have natural extensions. If you want to continue:

- Keep your theory files maintained as Isabelle is updated
- Document the open questions identified in your conclusion
- The instructor can connect you with the Isabelle community and relevant research groups

### Publication

Strong formalizations can be submitted to venues such as:

- ITP (Interactive Theorem Proving)
- CPP (Certified Programs and Proofs)
- JAR (Journal of Automated Reasoning)
- IJCAR (International Joint Conference on Automated Reasoning)

The instructor is happy to advise on venue selection and paper preparation.
