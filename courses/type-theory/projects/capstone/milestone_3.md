---
title: "Capstone Milestone 3: Full Draft"
tags:
  - type-theory
  - project
---
# Capstone Milestone 3: Full Draft

**Due:** Week 15
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** PDF, 8 pages (ACM SIGPLAN or LIPIcs template, excluding references and appendix)

---

## Overview

This milestone serves two purposes. First, it ensures that your main technical development is complete and that you have a near-final draft of your paper. Second, it initiates a peer review process in which you provide and receive feedback from other students, simulating the conference review experience common in the PL community.

By Week 15, your paper should contain all main results -- typing rules, proofs, implementation results, or formalization status -- even if the analysis and writing are not yet polished. The final five weeks are for refinement, additional experiments or proofs, and improving the presentation. They are not for developing your core contribution for the first time.

---

## Deliverables

### 1. Full Draft (8 pages + references + optional appendix)

Your draft must include all major sections of the final report, even if some are not yet polished:

#### Abstract

A complete abstract (200-250 words) summarizing the problem, approach, key results, and conclusion. This should be a working draft, not a placeholder.

#### Introduction

- Motivation and context for the research
- Clear statement of the problem and contribution
- Brief summary of the approach and key results
- Outline of the paper structure

#### Related Work

- Comprehensive survey organized thematically
- Clear articulation of how your work differs from and builds upon prior work
- At least 15 cited references

#### Technical Development

- Complete formal presentation of your type system, proof, or tool
- Typing rules, operational semantics, or algorithm descriptions as appropriate
- Figures (type system overview, architecture diagram, proof structure)
- Discussion of key design choices

#### Results

This is the most critical section for this milestone. It must include:

- **For type system projects:** Complete typing rules, at least the statements of key metatheoretic properties (progress, preservation, decidability), and proofs or proof sketches for the main results. Example programs demonstrating the type system.
- **For formalization projects:** Summary of what is formalized, key statistics (lines of code, number of lemmas), challenges encountered, and insights gained from the formalization.
- **For implementation projects:** Evaluation results -- benchmarks, annotation burden measurements, error message quality assessment, or user study results as appropriate.
- **For theoretical projects:** Complete proofs of main theorems, with proof sketches acceptable for supporting lemmas.

It is acceptable if some secondary results are pending. It is not acceptable if you have no main results.

#### Discussion and Conclusion (may be brief)

- Summary of findings and limitations
- Future work directions

### 2. Supplementary Materials

- **Artifact:** Updated and functional. The instructor or reviewers may build and run your code or check your formalization.
- **Appendix (optional, up to 4 pages):** Additional proofs, typing rules, examples, or implementation details that do not fit in the main paper.

### 3. Contribution Statement (for pairs)

Updated contribution statement covering the entire project to date.

---

## Peer Review

### Overview

Each student or pair will review **two other projects** and receive reviews from **two students or pairs**. This simulates the conference review process and provides valuable external feedback before the final report.

### Review Assignments

Review assignments will be posted by Week 14. You will be assigned projects in related (but not identical) topic areas when possible.

### Review Format

For each assigned paper, write a structured review covering:

#### Summary (3-5 sentences)

Summarize the paper's contribution in your own words.

#### Strengths (3-5 bullet points)

What does the paper do well? Be specific. Examples:

- "The typing rules for the linear fragment are clearly presented and the subsumption rule handles the interaction with unrestricted types elegantly."
- "The formalization handles binding using well-scoped de Bruijn indices, which makes the substitution lemma straightforward."

#### Weaknesses (3-5 bullet points)

What could be improved? Be constructive and specific. Examples:

- "The paper claims type safety but only proves progress; preservation is stated without proof."
- "The implementation section does not discuss how type errors are reported to the user."

#### Questions for the Authors (2-3 questions)

Ask clarifying questions that would strengthen the paper if addressed.

#### Overall Assessment

Rate the paper on a scale of 1-5:

- 5: Strong accept. Near-publishable quality.
- 4: Weak accept. Good project with room for improvement.
- 3: Borderline. Significant issues but potential is visible.
- 2: Weak reject. Major issues in technical content or artifact.
- 1: Strong reject. Fundamental problems.

Provide a 2-3 sentence justification for your rating.

#### Suggestions for Improvement (2-3 specific, actionable suggestions)

What would most improve this paper for the final version?

### Review Guidelines

- **Be constructive.** The purpose is to help your peers improve their work.
- **Be specific.** "The typing rules could be better" is not helpful. "Rule T-App does not account for the case where the function type involves a type-level computation that must be normalized before checking the argument" is helpful.
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
| **Completeness** | 30% | All major sections are present with substantive content. Main technical contribution is fully presented. The paper tells a complete story even if details are rough. |
| **Results** | 30% | Main results are presented: typing rules are complete, key theorems are stated and proved or sketched, implementation results are shown, or formalization status is documented. |
| **Technical Quality** | 20% | Type-theoretic content is rigorous. Typing rules are well-formed. Proofs are correct (where included). Implementation is sound. |
| **Writing** | 20% | The draft is readable. Structure is logical. Inference rules are properly typeset. The draft is a genuine working paper, not disconnected fragments. |

### Minimum Requirements

To receive a passing grade on this milestone, your draft must:

1. Contain at least 6 pages of substantive content
2. Include a complete formal presentation of your core contribution (typing rules, proof, or tool description)
3. Present at least one main result (theorem, evaluation, or formalization outcome)
4. Have a coherent narrative from introduction through results

Failure to meet these minimum requirements will result in a grade cap of 60% on this milestone.

---

## Common Issues at This Stage

### "My main proof is incomplete."

Identify which lemmas are missing and whether they are technical (need more work) or fundamental (the theorem may be false). Present the proof structure with gaps clearly marked. A well-structured incomplete proof is better than no proof at all.

### "My formalization does not compile."

Fix compilation errors before submission, even if some lemmas use `sorry` or `admit`. A formalization that compiles with admitted lemmas is far better than one that does not compile at all.

### "My writing is rough."

That is expected at this stage. Focus on completeness and technical correctness now. Polish the writing between Weeks 15-20.

### "I want to change my type system design."

Major design changes at Week 15 are risky. Discuss with the instructor before making large changes. Minor refinements and additional typing rules are expected and encouraged.

---

## Submission

Submit via the course portal by **Week 15, Friday 11:59 PM**:

1. Full draft as PDF (ACM SIGPLAN or LIPIcs format, 8 pages + references + optional appendix)
2. Updated artifact (repository access or zip file)
3. Contribution statement (for pairs)

Submit peer reviews by **Week 16, Friday 11:59 PM** via the course review portal.
