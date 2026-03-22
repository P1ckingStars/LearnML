# Capstone Milestone 1: Problem Statement

**Due:** Week 5
**Weight:** 5% of capstone grade (2% of final course grade)
**Format:** 2-page document (ICML template, excluding references)

---

## Overview

The purpose of this milestone is to ensure you have identified a well-defined research question, surveyed the relevant literature, and formulated a concrete plan of attack. A strong problem statement is the foundation of a successful research project. This milestone also serves as an early checkpoint: if your scope is too broad, too narrow, or insufficiently novel, the instructor can redirect you before significant effort is invested.

---

## Deliverables

### 1. Problem Statement Document (2 pages + references)

Your document must contain the following sections:

#### Research Question

State your research question clearly and precisely in 1-3 sentences. A good research question is:

- **Specific:** Not "improve transformers" but "reduce the quadratic attention cost in transformers for long documents while preserving perplexity within 5% of full attention."
- **Measurable:** You should be able to determine, at the end of the project, whether you answered the question.
- **Novel:** The answer should not already exist in the literature. Explain why.
- **Feasible:** You should be able to make meaningful progress in 15 weeks with your available resources.

#### Motivation

In 1-2 paragraphs, explain why this question matters. Who would benefit from an answer? What practical or theoretical impact would a solution have? Connect your question to broader themes in deep learning.

#### Related Work Survey

Summarize at least **10 relevant papers** that contextualize your research question. For each paper, provide:

- A 2-3 sentence summary of the key contribution
- How it relates to your proposed work
- What gap or limitation it leaves that your project addresses

Organize the related work thematically, not as a flat list. Identify 2-3 themes or threads in the literature and explain how your work fits into the landscape.

#### Proposed Approach

Describe your planned method in sufficient detail that a knowledgeable reader could assess feasibility. Include:

- **High-level approach:** What type of contribution are you making (new method, empirical study, theoretical result, benchmark)?
- **Key technical ideas:** What is the core idea? What makes your approach different from prior work?
- **Baselines:** What will you compare against? Why are these appropriate baselines?
- **Datasets and evaluation:** What data will you use? What metrics will you report?
- **Expected challenges:** What are the main risks? What might go wrong?

#### Expected Contributions

In a bulleted list, state 2-4 concrete contributions you expect to make. For example:

- "A new attention mechanism that achieves linear complexity while matching transformer perplexity on WikiText-103."
- "A comprehensive comparison of 5 positional encoding methods across 3 modalities."
- "A theoretical bound on the approximation error of sparse attention."

#### Timeline

Provide a week-by-week plan from Week 5 to Week 20:

| Week | Planned Activity |
|---|---|
| 5-6 | [Specific tasks] |
| 7-8 | [Specific tasks] |
| 9-10 | [Specific tasks] |
| 11-12 | [Specific tasks] |
| 13-14 | [Specific tasks] |
| 15-16 | [Specific tasks] |
| 17-18 | [Specific tasks] |
| 19-20 | [Specific tasks] |

Include buffer time for unexpected delays.

### 2. Team Formation (if applicable)

If working in a team, submit:

- Team member names and email addresses
- A brief statement of each member's relevant background and skills
- Planned division of responsibilities

### 3. Preliminary Literature Collection

Provide a BibTeX file or reference list with at least 15 papers you plan to read (this is a superset of the 10 you summarize in the document). You do not need to have read all 15 yet, but you should have identified them.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Research Question** | 25% | Question is clear, specific, measurable, and novel. It is neither too broad nor too narrow. |
| **Related Work** | 25% | At least 10 papers are surveyed. Summaries are accurate and informative. The survey identifies a clear gap that the project addresses. Organization is thematic. |
| **Proposed Approach** | 25% | The plan is technically sound and feasible. Baselines are appropriate. Datasets and metrics are well-chosen. Risks are acknowledged. |
| **Writing and Presentation** | 15% | Document is clear, well-organized, and professional. Follows the ICML template. |
| **Timeline and Planning** | 10% | Timeline is realistic and specific. Milestones are concrete. Buffer time is included. |

---

## Feedback Process

After submission, you will receive:

1. **Written feedback** from the instructor or a TA within one week, covering:
   - Assessment of scope and feasibility
   - Suggestions for related work you may have missed
   - Concerns about the proposed approach
   - Recommendations for adjustments

2. **A brief meeting** (15 minutes) with the instructor or TA to discuss feedback and refine the plan. Sign up for a slot on the course calendar.

You are expected to incorporate this feedback into your subsequent milestones. Ignoring feedback without justification will be penalized in later milestones.

---

## Common Issues and How to Avoid Them

### Problem Too Broad

- Bad: "Improve generative models."
- Better: "Reduce FID of diffusion models on ImageNet-64 by 10% through improved noise schedules."
- Fix: Add constraints (specific dataset, specific metric, specific improvement target).

### Problem Too Narrow

- Bad: "Tune the learning rate for ResNet-50 on CIFAR-10."
- Better: "Develop a principled learning rate selection method for residual networks and validate across 5 datasets."
- Fix: Ensure the contribution generalizes beyond a single experiment.

### Insufficient Novelty

- Bad: "Reproduce the results of [Paper X]."
- Better: "Reproduce [Paper X], identify a failure mode on [Dataset Y], and propose a fix that improves performance by Z%."
- Fix: Identify what is new about your work compared to everything in your related work survey.

### Missing Baselines

- Bad: "We will show our method works."
- Better: "We will compare against methods A, B, and C on metrics X and Y."
- Fix: Always define what you are comparing against before you start.

### Unrealistic Timeline

- Bad: "Weeks 5-18: implement and experiment. Week 19: write paper."
- Better: See the template above with specific weekly tasks.
- Fix: Allocate at least 4 weeks for writing and revision. Writing always takes longer than you expect.

---

## Submission

Submit via the course portal by **Week 5, Friday 11:59 PM**:

1. Problem statement document as PDF (ICML format, 2 pages + references)
2. BibTeX file or reference list (15+ papers)
3. Team formation document (if applicable)
