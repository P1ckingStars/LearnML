# Capstone Milestone 2: Method and Preliminary Results

**Due:** Week 10
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** 4-page document (USENIX template, excluding references)

---

## Overview

This milestone ensures that your project is on track at the halfway point. By Week 10, you should have a working implementation of your core system or optimization and at least preliminary benchmark results. The goal is not polished results but evidence of meaningful progress and a clear path to completion.

This is the most critical checkpoint. Projects that lack working code and initial benchmarks by Week 10 rarely succeed. If you are behind schedule, this milestone is your opportunity to seek help, adjust scope, or pivot direction.

---

## Deliverables

### 1. Progress Report (4 pages + references)

Your report must include the following sections:

#### Refined Problem Statement

Revisit your research question from Milestone 1. Has it changed based on early profiling, implementation experience, or feedback? If so, explain what changed and why. Common reasons for refinement in systems projects:

- Initial profiling revealed that the bottleneck is elsewhere
- The target hardware behaves differently than expected
- An existing system already addresses part of the problem

This section should be concise (half a page max). The focus of this milestone is implementation and results, not re-motivating the problem.

#### System Design and Implementation

Provide a detailed technical description of your system. This should be substantially more detailed than the "Proposed Approach" from Milestone 1. Include:

- **Architecture overview:** A figure showing the major components and their interactions. For kernel projects, show the memory access pattern or tiling strategy. For distributed systems, show the communication topology. For compiler projects, show the pass pipeline.
- **Key algorithms and data structures:** Step-by-step description of your approach. Include pseudocode for core algorithms.
- **Design decisions:** Explain the choices you made and why. What alternatives did you consider? What trade-offs did you accept?
- **Interface and API:** How does a user interact with your system? Show example usage code.
- **Relationship to baselines:** How does your design differ from the systems you are comparing against?

This section should be detailed enough that a knowledgeable reader could reimplement your system.

#### Implementation Status

Provide an honest assessment of your implementation:

- **What is complete:** List components that are implemented and tested. Include unit test coverage where applicable.
- **What is in progress:** List components that are partially implemented.
- **What remains:** List components that have not been started.
- **Known bugs or issues:** Describe any correctness or performance problems you are aware of.
- **Lines of code:** Report approximate LOC for each major component.

Include a link to your code repository (private is fine; add the instructor and TAs as collaborators) or submit a zip file.

#### Preliminary Benchmarks

Present your initial performance results. These do not need to be final or comprehensive, but they must demonstrate that your system runs and produces measurable output. Include:

- **At least one performance comparison:** A table or plot comparing your system against at least one baseline on a concrete workload. Even if your system underperforms baselines at this stage, show the comparison.
- **Profiling data:** Updated profiling showing where time is spent in your implementation. Identify the current bottleneck.
- **Correctness validation:** Evidence that your system produces correct results (e.g., matching numerical output against a reference implementation, training curves that converge, bit-exact or numerically close outputs).
- **Hardware utilization:** Report relevant utilization metrics (compute utilization, memory bandwidth utilization, communication bandwidth utilization) where applicable.

Label all preliminary results clearly as preliminary. It is acceptable (and expected) that results will improve by the final report.

#### Analysis of Preliminary Results

Briefly analyze what your preliminary results tell you:

- Is your system achieving the expected speedup or resource reduction? If not, what is the bottleneck?
- What is the most promising direction for optimization?
- Are there any surprises or unexpected findings in the profiling data?
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

- "Alice implemented the Triton kernel and ran the initial benchmarks on A100."
- "Bob wrote the autotuner and the correctness validation tests."

Not acceptable:

- "We both worked on everything together."

### 2. Working Code

Your code submission must demonstrate:

- **The system can be built and runs** without errors on the target hardware.
- **A benchmark script** that produces at least one performance number.
- **A correctness test** that validates output against a reference.

The code does not need to be clean or well-documented at this stage (that is for the final submission), but it must work.

### 3. Feedback Incorporation

Include a brief section (half a page max, not counted toward the 4-page limit) describing how you incorporated feedback from Milestone 1. If you chose not to follow specific feedback, explain why.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **System Design** | 25% | Design is described clearly and in sufficient detail. Architecture diagrams aid understanding. Design decisions are justified with systems reasoning (not just "it seemed simpler"). |
| **Implementation Progress** | 30% | Code runs. Core system or optimization is implemented. Correctness is validated. The student demonstrates understanding of their own code. Progress is commensurate with the project timeline. |
| **Preliminary Benchmarks** | 25% | At least one performance comparison is presented. Profiling data is included. Results are honestly reported and analyzed. The student has a clear understanding of where performance stands and what the bottleneck is. |
| **Planning and Writing** | 20% | Updated timeline is realistic. Writing is clear. Feedback from Milestone 1 has been addressed. The student has a credible plan for completion. |

### Grade Descriptors

- **A (90-100%):** System design is clearly described. Implementation is substantial and working. Preliminary benchmarks are promising or, if not, the student demonstrates a clear understanding of the bottleneck and how to address it. Timeline is realistic.
- **B (80-89%):** Design description is adequate. Implementation works but may be incomplete. Preliminary benchmarks exist but may be limited. Planning is reasonable.
- **C (70-79%):** Design description has gaps. Implementation has issues. Preliminary benchmarks are very limited. The path to completion is unclear.
- **D/F (<70%):** No working code. No preliminary benchmarks. Design description is vague. The student has not made meaningful progress.

---

## Red Flags (and What to Do)

### "My system runs but it is slower than the baseline."

This is common in early stages of systems work. Bring your profiling data to office hours. Common causes: memory allocation overhead, insufficient tiling, synchronization bottlenecks, incorrect use of shared memory, launch overhead dominating for small workloads.

### "I had to change my target bottleneck."

This is acceptable, especially if motivated by what you learned from profiling. Document the change and explain the reasoning. The best systems research often starts by discovering that the real bottleneck is not where you expected it.

### "I am behind schedule."

Talk to the instructor immediately. Options include:

- Reducing scope (fewer workloads, simpler optimization, single-GPU only)
- Adjusting the timeline
- Getting targeted help on the blocking issue

Do not suffer in silence.

### "My teammate is not contributing."

Contact the instructor immediately. This will be addressed. Contribution statements are taken seriously.

### "I cannot get access to the hardware I need."

Talk to the instructor about alternative allocations or hardware. In the meantime, develop and debug on smaller hardware and use profiling-based projections to estimate performance at scale.

---

## Submission

Submit via the course portal by **Week 10, Friday 11:59 PM**:

1. Progress report as PDF (USENIX format, 4 pages + references)
2. Code repository access or zip file
3. Feedback incorporation statement (can be appended to the PDF)
