# Capstone Milestone 2: Method and Preliminary Results

**Due:** Week 10
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** 4-page document (ICML template, excluding references)

---

## Overview

This milestone ensures that your project is on track at the halfway point. By Week 10, you should have a working implementation of your core method and at least preliminary experimental results. The goal is not polished results but evidence of meaningful progress and a clear path to completion.

This is the most critical checkpoint. Projects that lack working code and initial results by Week 10 rarely succeed. If you are behind schedule, this milestone is your opportunity to seek help, adjust scope, or pivot direction.

---

## Deliverables

### 1. Progress Report (4 pages + references)

Your report must include the following sections:

#### Refined Problem Statement

Revisit your research question from Milestone 1. Has it changed based on early experiments or feedback? If so, explain what changed and why. If not, restate it briefly and confirm your direction.

This section should be concise (half a page max). The focus of this milestone is method and results, not re-motivating the problem.

#### Method Description

Provide a detailed technical description of your method. This should be substantially more detailed than the "Proposed Approach" from Milestone 1. Include:

- **Formal problem setup:** Define notation, inputs, outputs, and objectives mathematically.
- **Algorithm or architecture description:** Step-by-step description of your method. Include pseudocode or an algorithm block if appropriate.
- **Architecture diagrams:** At least one figure illustrating your model or method.
- **Key design decisions:** Explain the choices you made and why. What alternatives did you consider?
- **Relationship to baselines:** How does your method differ from the baselines you are comparing against?

This section should be detailed enough that a knowledgeable reader could reimplement your method.

#### Implementation Status

Provide an honest assessment of your implementation:

- **What is complete:** List components that are implemented and tested.
- **What is in progress:** List components that are partially implemented.
- **What remains:** List components that have not been started.
- **Known bugs or issues:** Describe any problems you are aware of.

Include a link to your code repository (private is fine; add the instructor and TAs as collaborators) or submit a zip file.

#### Preliminary Results

Present your initial experimental results. These do not need to be final or comprehensive, but they must demonstrate that your method runs and produces meaningful output. Include:

- **At least one quantitative result:** A number, table, or plot showing that your method produces outputs that can be evaluated against baselines. Even if your method underperforms baselines at this stage, show the comparison.
- **At least one qualitative result** (if applicable): Visualizations, generated samples, attention maps, or other outputs that illustrate what your method is doing.
- **Baseline results:** Show results for at least one baseline method (even if using reported numbers from a paper as a reference point).
- **Training curves:** Loss curves or other training diagnostics showing that your model is learning.

Label all preliminary results clearly as preliminary. It is acceptable (and expected) that results will improve by the final report.

#### Analysis of Preliminary Results

Briefly analyze what your preliminary results tell you:

- Is your method working as expected? If not, what do you think is going wrong?
- What is the most promising direction for improvement?
- Are there any surprises or unexpected findings?
- Do you need to adjust your approach?

#### Updated Timeline

Revise your Week 10-20 timeline based on current progress:

| Week | Planned Activity | Status |
|---|---|---|
| 10-11 | [Specific tasks] | |
| 12-13 | [Specific tasks] | |
| 14-15 | [Specific tasks] | |
| 16-17 | [Specific tasks] | |
| 18-19 | [Specific tasks] | |
| 20 | [Specific tasks] | |

Be realistic. If you are behind the original schedule, adjust accordingly. It is better to scope down than to submit an incomplete project.

#### Contribution Statement (for teams)

Each team member must describe their specific contributions since Milestone 1. Be concrete:

- "Alice implemented the attention mechanism and ran the baseline experiments."
- "Bob wrote the data loading pipeline and the evaluation scripts."

Not acceptable:

- "We both worked on everything together."

### 2. Working Code

Your code submission must demonstrate:

- **The model can be instantiated and performs a forward pass** without errors.
- **Training runs** for at least a few steps without crashing.
- **Evaluation code** exists and produces at least one metric.

The code does not need to be clean or well-documented at this stage (that is for the final submission), but it must work.

### 3. Feedback Incorporation

Include a brief section (half a page max, not counted toward the 4-page limit) describing how you incorporated feedback from Milestone 1. If you chose not to follow specific feedback, explain why.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Method Description** | 25% | Method is described clearly and in sufficient detail. Mathematical notation is used appropriately. Figures aid understanding. Design decisions are justified. |
| **Implementation Progress** | 30% | Code runs. Core method is implemented. The student demonstrates understanding of their own code. Progress is commensurate with the project timeline. |
| **Preliminary Results** | 25% | At least one quantitative and one qualitative result are presented. Baselines are included. Results are honestly reported and analyzed. The student has a clear understanding of where things stand. |
| **Planning and Writing** | 20% | Updated timeline is realistic. Writing is clear. Feedback from Milestone 1 has been addressed. The student has a credible plan for completion. |

### Grade Descriptors

- **A (90-100%):** Method is clearly described. Implementation is substantial and working. Preliminary results are promising or, if not, the student demonstrates a clear understanding of what needs to change. Timeline is realistic and well-planned.
- **B (80-89%):** Method description is adequate. Implementation works but may be incomplete. Preliminary results exist but may be limited. Planning is reasonable.
- **C (70-79%):** Method description has gaps. Implementation has issues. Preliminary results are very limited. The path to completion is unclear.
- **D/F (<70%):** No working code. No preliminary results. Method description is vague. The student has not made meaningful progress.

---

## Red Flags (and What to Do)

### "My code runs but the results are bad."

This is normal. Bring your training curves and results to office hours. Common causes: learning rate too high/low, bug in loss computation, data preprocessing error, insufficient training.

### "I had to change my research question."

This is acceptable, especially if motivated by what you learned from early experiments. Document the change and explain the reasoning. Pivoting is a normal part of research.

### "I am behind schedule."

Talk to the instructor immediately. Options include:

- Reducing scope (fewer baselines, simpler method, smaller dataset)
- Adjusting the timeline
- Getting targeted help on the blocking issue

Do not suffer in silence.

### "My teammate is not contributing."

Contact the instructor immediately. This will be addressed. Contribution statements are taken seriously.

### "I do not have enough compute."

Talk to the instructor about additional allocation. In the meantime, develop and debug on small-scale experiments (reduced dataset size, smaller model).

---

## Submission

Submit via the course portal by **Week 10, Friday 11:59 PM**:

1. Progress report as PDF (ICML format, 4 pages + references)
2. Code repository access or zip file
3. Feedback incorporation statement (can be appended to the PDF)
