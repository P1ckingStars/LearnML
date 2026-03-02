# Capstone Milestone 3: Full Draft

**Due:** Week 15
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** 8-page document (ICML template, excluding references and appendix)

---

## Overview

This milestone serves two purposes. First, it ensures that your main experiments are complete and that you have a near-final draft of your paper. Second, it initiates a peer review process in which you provide and receive feedback from other teams, simulating the conference review experience.

By Week 15, your paper should contain all main results, even if the analysis and writing are not yet polished. The final five weeks are for refinement, additional experiments, and improving the presentation -- not for running your core experiments for the first time.

---

## Deliverables

### 1. Full Draft (8 pages + references + optional appendix)

Your draft must include all major sections of the final report, even if some are not yet polished:

#### Abstract

A complete abstract (200-250 words) summarizing the problem, method, key results, and conclusion. This should be a working draft, not a placeholder.

#### Introduction

- Motivation and context for the research
- Clear statement of the problem and contribution
- Brief summary of the approach and key results
- Outline of the paper structure

#### Related Work

- Comprehensive survey organized thematically
- Clear articulation of how your work differs from and builds upon prior work
- At least 15 cited references (more is typical for the final version)

#### Method

- Complete, detailed description of your approach
- Mathematical formulation where appropriate
- Architecture diagrams and/or algorithm pseudocode
- Discussion of design choices

#### Experiments

This is the most critical section for this milestone. It must include:

- **Experimental setup:** Datasets, baselines, metrics, hyperparameters, compute details
- **Main results:** Your primary experiments comparing your method to baselines. Present as tables and/or figures with clear captions.
- **Ablation studies:** At least one ablation that isolates the effect of a key design choice in your method.
- **Analysis:** Interpretation of results. What works? What does not? Why?

It is acceptable if:
- Some additional experiments are planned but not yet run
- The analysis is not yet as deep as it will be in the final version
- Some figures are not yet publication-quality

It is not acceptable if:
- You have no main results at all
- You have results but no baselines to compare against
- Your experimental section is a placeholder

#### Discussion (may be brief)

- Summary of findings
- Limitations (be honest)
- Future work directions

#### Conclusion (may be brief)

- Key takeaways from the project

### 2. Supplementary Materials

- **Code repository:** Updated and functional. The instructor or reviewers may run your code.
- **Appendix (optional, up to 4 pages):** Additional figures, tables, derivations, or experimental details that do not fit in the main paper.

### 3. Contribution Statement (for teams)

Updated contribution statement covering the entire project to date. Each team member must describe their contributions since Milestone 2.

---

## Peer Review

### Overview

Each team will review **two other projects** and receive reviews from **two teams**. This simulates the conference review process and provides valuable external feedback before the final report.

### Review Assignments

Review assignments will be posted by Week 14. You will be assigned projects in related (but not identical) topic areas when possible.

### Review Format

For each assigned paper, write a structured review covering:

#### Summary (3-5 sentences)
Summarize the paper's contribution in your own words. This demonstrates that you understood the paper.

#### Strengths (3-5 bullet points)
What does the paper do well? Be specific. Examples:
- "The ablation study in Table 3 clearly isolates the contribution of the proposed attention modification."
- "The related work section thoroughly covers recent flow-based generative models."

#### Weaknesses (3-5 bullet points)
What could be improved? Be constructive and specific. Examples:
- "The comparison in Table 2 does not include [Method X], which is a strong baseline for this task."
- "The paper claims the method is efficient but does not report wall-clock training or inference times."

#### Questions for the Authors (2-3 questions)
Ask clarifying questions that would strengthen the paper if addressed.

#### Overall Assessment
Rate the paper on a scale of 1-5:
- 5: Strong accept. Near-publishable quality.
- 4: Weak accept. Good project with room for improvement.
- 3: Borderline. Significant issues but potential is visible.
- 2: Weak reject. Major issues in method or experiments.
- 1: Strong reject. Fundamental problems.

Provide a 2-3 sentence justification for your rating.

#### Suggestions for Improvement (2-3 specific, actionable suggestions)
What would most improve this paper for the final version?

### Review Guidelines

- **Be constructive.** The purpose is to help your peers improve their work.
- **Be specific.** "The writing could be better" is not helpful. "The transition between Sections 3.2 and 3.3 is abrupt; a sentence connecting the loss function to the training procedure would help" is helpful.
- **Be honest but respectful.** Point out genuine weaknesses, but frame them as opportunities for improvement.
- **Invest real effort.** Read the paper carefully. A superficial review helps no one and will be penalized.

### Review Deadline

Reviews are due **one week after the draft submission (Week 16, Friday 11:59 PM)**.

### Review Grading

Your reviews will be graded as part of the Milestone 3 score:

| Component | Weight |
|---|---|
| Draft quality | 70% |
| Review quality | 30% |

Reviews are graded on thoughtfulness, specificity, and constructiveness. A review that says only "good paper, no comments" will receive zero credit.

---

## Grading Rubric (Draft Only, 70% of Milestone 3)

| Component | Weight | Criteria |
|---|---|---|
| **Completeness** | 30% | All major sections are present with substantive content. Main experiments are included. The paper tells a complete story even if details are rough. |
| **Results** | 30% | Main results are presented with baselines. At least one ablation study is included. Figures and tables are informative. Results are honestly reported. |
| **Technical Quality** | 20% | Method description is clear and correct. Experimental setup is sound. Analysis demonstrates understanding of the results. |
| **Writing** | 20% | The draft is readable. Structure is logical. Figures have captions. The draft is a genuine working paper, not a collection of disconnected sections. |

### Minimum Requirements

To receive a passing grade on this milestone, your draft must:

1. Contain at least 6 pages of substantive content (not padding)
2. Include at least one table or figure of experimental results
3. Compare your method against at least one baseline
4. Have a coherent narrative from introduction through results

Failure to meet these minimum requirements will result in a grade cap of 60% on this milestone.

---

## Using Peer Review Feedback

After receiving reviews (Week 16), you should:

1. Read all reviews carefully.
2. Identify the most critical issues raised.
3. Create a plan for addressing feedback in the final report.
4. Optionally, write an author response to clarify misunderstandings (this is good practice for real conferences but is not required or graded).

You will be asked to include a "Response to Reviews" section in your final report submission, explaining how you addressed the feedback.

---

## Common Issues at This Stage

### "My results are negative."

Negative results are valuable if well-analyzed. Do not hide them. Explain why you think the method did not work and what you learned. A well-analyzed negative result is worth more than a poorly understood positive one.

### "I need more experiments."

Prioritize. What is the single most important experiment you need to run? Run that first. Additional experiments can be added in the final five weeks.

### "My writing is rough."

That is expected at this stage. Focus on completeness and correctness now. Polish the writing between Weeks 15-20.

### "I want to change my method."

Major methodological changes at Week 15 are risky. Discuss with the instructor before making large changes. Minor refinements and improvements are expected and encouraged.

---

## Submission

Submit via the course portal by **Week 15, Friday 11:59 PM**:

1. Full draft as PDF (ICML format, 8 pages + references + optional appendix)
2. Updated code repository access or zip file
3. Contribution statement (for teams)

Submit peer reviews by **Week 16, Friday 11:59 PM** via the course review portal.
