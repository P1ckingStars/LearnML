# Capstone Milestone 2: Method, Preliminary Definitions, and Initial Results

**Due:** Week 10
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** 4-page document (excluding references) + Isabelle code

---

## Overview

This milestone ensures that your project is on track at the halfway point. By Week 10, you should have all key definitions in place, several supporting lemmas proved, and at least one non-trivial result completed. The goal is not a polished formalization but evidence of meaningful progress and a clear path to completion.

This is the most critical checkpoint. Formalization projects that lack working definitions and initial proofs by Week 10 rarely succeed. If you are behind schedule, this milestone is your opportunity to seek help, adjust scope, or pivot direction.

Formalization work is non-linear: you may spend three weeks on a single lemma and then prove ten lemmas in a day once the right approach clicks. This milestone is designed to ensure you have passed the hardest initial hurdle -- getting the definitions right.

---

## Deliverables

### 1. Progress Report (4 pages + references)

Your report must include the following sections:

#### Refined Formalization Goal

Revisit your formalization goal from Milestone 1. Has it changed based on early experience or feedback? If so, explain what changed and why. Common reasons for refinement:

- A definition that seemed natural turned out to be awkward in Isabelle
- A proof strategy that worked on paper required unexpected intermediate lemmas
- The scope was too large or too small
- Existing Isabelle infrastructure was richer (or sparser) than expected

This section should be concise (half a page max).

#### Definitions and Infrastructure

Provide a detailed description of the definitions you have formalized:

- **Key definitions:** State each major definition both informally and as it appears in your Isabelle code. Explain any choices that diverge from the standard textbook presentation and why.
- **Definition rationale:** For each non-obvious definitional choice, explain the alternatives you considered and why you chose as you did. For example: "We define the rank function inductively rather than via transfinite recursion because the inductive definition gives us a stronger induction principle for the main proof."
- **Isabelle infrastructure used:** List the theories from the Isabelle distribution or AFP that you import and build on. For each, briefly note what you use from it.
- **Definitions still needed:** List definitions that remain to be formalized.

Include a dependency diagram showing how your theory files relate to each other and to the Isabelle distribution.

#### Completed Proofs

Present the lemmas and theorems you have completed so far:

- **Statement:** Give the Isabelle statement of each completed result.
- **Proof sketch:** For each non-trivial result, provide a 2-3 sentence informal description of the proof strategy.
- **Automation vs. structured proof:** Note whether each proof uses automation (simp, auto, blast, sledgehammer) or structured Isar reasoning, and why.

You should have completed at least:

- **Track A:** All key definitions and at least 3 non-trivial lemmas supporting the main theorem.
- **Track B:** The functional specification, the C source parsed by AutoCorres, and at least one operation verified (e.g., insert but not yet delete).
- **Track C:** Key ZF definitions and at least one connecting lemma between the ZF and C components.

#### Difficulties Encountered

Describe specific formalization difficulties you have encountered. This section is graded on honesty and insight, not on whether you encountered difficulties (everyone does). Include:

- Proofs that required unexpected approaches
- Definitional dead ends (definitions you tried and abandoned)
- Isabelle infrastructure gaps you had to work around
- Interactions between automation and manual proof that were surprising

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

Be realistic. If you are behind the original schedule, adjust accordingly. It is better to scope down the main theorem than to submit an incomplete formalization riddled with sorry.

#### Contribution Statement (for teams)

Each team member must describe their specific contributions since Milestone 1. Be concrete:

- "Alice formalized the definition of ordinal exponentiation and proved the recursion lemma."
- "Bob set up the AutoCorres infrastructure and verified the insert operation."

Not acceptable:

- "We both worked on everything together."

### 2. Isabelle Code Submission

Your code submission must demonstrate:

- **All key definitions are formalized** and Isabelle accepts them without errors.
- **At least some proofs are complete** (no sorry in the completed lemmas; sorry is acceptable for results you have not yet proved, but these should be clearly marked).
- **The ROOT file builds successfully** in batch mode (`isabelle build`).

Submit your Isabelle theory files either as a zip archive or via a repository link. Ensure the instructor and TAs have access.

### 3. Feedback Incorporation

Include a brief section (half a page max, not counted toward the 4-page limit) describing how you incorporated feedback from Milestone 1. If you chose not to follow specific feedback, explain why.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Definitions** | 25% | Key definitions are formalized, well-chosen, and aligned with Isabelle infrastructure. Definitional choices are justified. The student demonstrates understanding of how definitions affect downstream proofs. |
| **Proof Progress** | 30% | At least the minimum number of completed proofs for the track. Proofs are correct (no sorry). The student demonstrates understanding of the proof strategies used. |
| **Difficulty Analysis** | 25% | Difficulties are described honestly and with technical specificity. The student shows insight into why formalization diverged from informal mathematics. Solutions or workarounds are explained. |
| **Planning and Writing** | 20% | Updated timeline is realistic. Writing is clear. Feedback from Milestone 1 has been addressed. The student has a credible plan for completion. |

### Grade Descriptors

- **A (90-100%):** All key definitions are in place and well-justified. Several non-trivial lemmas are proved. Difficulty analysis shows deep understanding of formalization challenges. The path to completion is clear and realistic.
- **B (80-89%):** Definitions are adequate. Some proofs are complete. Analysis of difficulties is present but may lack depth. Planning is reasonable.
- **C (70-79%):** Definitions have issues. Few proofs are complete. Difficulty analysis is superficial. The path to completion is unclear.
- **D/F (<70%):** Definitions are missing or broken. No substantive proofs. The student has not made meaningful progress.

---

## Red Flags (and What to Do)

### "I cannot get my definitions to work."

This is the single most common problem in formalization. Bring your definition to office hours along with the specific error or the specific downstream lemma that fails. Common causes: recursive definitions that Isabelle cannot prove terminating, definitions that do not respect the ZF type system, definitions that are correct but awkward for proof automation.

### "Sledgehammer cannot find the proof."

Sledgehammer is powerful but not omniscient. Common fixes: (1) simplify the goal first with `simp` or `auto` before invoking Sledgehammer, (2) provide intermediate lemmas as hints, (3) rewrite the goal into a form that is closer to existing library lemmas, (4) restructure as an Isar proof with explicit intermediate steps.

### "I had to change my formalization goal."

This is acceptable, especially if motivated by what you learned from trying the original approach. Document the change and explain the reasoning. A well-documented pivot is better than a forced march toward a goal that has become clearly infeasible.

### "I am behind schedule."

Talk to the instructor immediately. Options include:

- Reducing scope (prove a weaker theorem, verify fewer operations)
- Adjusting definitions to align better with existing infrastructure
- Getting targeted help on the blocking proof

### "My teammate is not contributing."

Contact the instructor immediately. Contribution statements are taken seriously.

---

## Submission

Submit via the course portal by **Week 10, Friday 11:59 PM**:

1. Progress report as PDF (4 pages + references)
2. Isabelle theory files (zip archive or repository link)
3. Feedback incorporation statement (can be appended to the PDF)
