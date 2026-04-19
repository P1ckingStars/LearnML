---
title: "Capstone Milestone 2: Method and Preliminary Results"
tags:
  - type-theory
  - project
---
# Capstone Milestone 2: Method and Preliminary Results

**Due:** Week 10
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** PDF, 4 pages (ACM SIGPLAN or LIPIcs template, excluding references)

---

## Overview

This milestone ensures that your project is on track at the halfway point. By Week 10, you should have a working core artifact -- whether that is a type checker prototype, a partial formalization, or a set of paper proofs -- and at least preliminary results demonstrating progress. The goal is not polished results but evidence of meaningful progress and a clear path to completion.

This is the most critical checkpoint. Projects that lack a working artifact and initial results by Week 10 rarely succeed. If you are behind schedule, this milestone is your opportunity to seek help, adjust scope, or pivot direction.

---

## Deliverables

### 1. Progress Report (4 pages + references)

Your report must include the following sections:

#### Refined Problem Statement

Revisit your research question from Milestone 1. Has it changed based on early work or feedback? If so, explain what changed and why. If not, restate it briefly and confirm your direction.

This section should be concise (half a page max). The focus of this milestone is the method and artifact, not re-motivating the problem.

#### Technical Development

Provide a detailed technical description of your type-theoretic contribution. This should be substantially more detailed than the "Proposed Approach" from Milestone 1. Depending on your project type, include:

**For type system design projects:**
- Formal syntax of types and terms
- Typing rules presented as inference rules
- Key metatheoretic properties you intend to prove (state them precisely, even if not yet proved)
- Discussion of design choices and alternatives you considered

**For formalization projects:**
- Overview of the formalization structure (which files, which modules, which dependencies)
- Key definitions and lemma statements
- Formalization challenges encountered (e.g., representation of binding, universe issues)
- What is proved and what remains

**For implementation projects:**
- Architecture of the type checker or tool
- Key algorithms (type inference, unification, normalization) with pseudocode
- Design decisions (representation of types, contexts, error handling)
- How the implementation relates to the formal typing rules

#### Artifact Status

Provide an honest assessment of your artifact:

- **What is complete:** List components that are implemented, proved, or formalized.
- **What is in progress:** List components that are partially done.
- **What remains:** List components that have not been started.
- **Known issues:** Describe any problems you are aware of.

Include a link to your code repository or formalization (private is fine; add the instructor and TAs as collaborators) or submit a zip file.

#### Preliminary Results

Present your initial results. These do not need to be final or comprehensive, but they must demonstrate that your artifact produces meaningful output. Include:

- **For type system projects:** At least 5 example programs that your type checker accepts or rejects correctly. Show the typing derivation for at least one non-trivial example.
- **For formalization projects:** At least 3 lemmas or theorems that are fully proved. Show the statement and a brief discussion of the proof.
- **For implementation projects:** Evidence that the tool runs on non-trivial inputs. Show output, error messages, or performance numbers.
- **For theoretical projects:** At least one complete proof of a lemma or intermediate result. Present it in detail.

Label all preliminary results clearly as preliminary. It is acceptable (and expected) that results will improve by the final report.

#### Analysis of Progress

Briefly analyze where things stand:

- Is your approach working as expected? If not, what do you think is going wrong?
- What is the most promising direction for the remaining weeks?
- Are there any surprises or unexpected difficulties?
- Do you need to adjust your approach or scope?

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

#### Contribution Statement (for pairs)

Each team member must describe their specific contributions since Milestone 1. Be concrete:

- "Alice formalized the syntax and typing rules in Lean and proved the substitution lemma."
- "Bob implemented the type checker core and wrote 15 test cases."

Not acceptable: "We both worked on everything together."

### 2. Working Artifact

Your artifact submission must demonstrate:

- **For type checkers:** The type checker can be built and run. It accepts at least 5 well-typed terms and rejects at least 5 ill-typed terms.
- **For formalizations:** The formalization compiles without errors. At least 3 non-trivial lemmas or definitions are complete.
- **For theoretical work:** A document containing at least one complete, detailed proof of a key lemma.

The artifact does not need to be polished at this stage, but it must represent genuine progress.

### 3. Feedback Incorporation

Include a brief section (half a page max, not counted toward the 4-page limit) describing how you incorporated feedback from Milestone 1. If you chose not to follow specific feedback, explain why.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Technical Development** | 25% | The type-theoretic content is described clearly and in sufficient detail. Typing rules are presented formally. Design decisions are justified. The technical development goes substantially beyond Milestone 1. |
| **Artifact Progress** | 30% | The artifact exists and works at a basic level. Progress is commensurate with the project timeline. The student demonstrates understanding of their own artifact. |
| **Preliminary Results** | 25% | Meaningful preliminary results are presented. Examples are non-trivial. Results are honestly reported and analyzed. The student has a clear understanding of where things stand. |
| **Planning and Writing** | 20% | Updated timeline is realistic. Writing is clear. Feedback from Milestone 1 has been addressed. The student has a credible plan for completion. |

### Grade Descriptors

- **A (90-100%):** Technical development is detailed and rigorous. Artifact is substantial and working. Preliminary results are promising or well-analyzed even if negative. Timeline is realistic and well-planned.
- **B (80-89%):** Technical development is adequate. Artifact works but may be incomplete. Preliminary results exist but may be limited. Planning is reasonable.
- **C (70-79%):** Technical development has gaps. Artifact has issues. Preliminary results are very limited. The path to completion is unclear.
- **D/F (<70%):** No working artifact. No preliminary results. Technical development is vague. Meaningful progress has not been made.

---

## Red Flags (and What to Do)

### "My type checker rejects things it should accept."

This is normal at this stage. Common causes: incorrect substitution, missing conversion rule, wrong variance in subtyping, environment vs. context confusion. Bring your typing rules and failing test case to office hours.

### "I had to change my research question."

This is acceptable, especially if motivated by what you learned from early work. Document the change and explain the reasoning. Pivoting is a normal part of research.

### "My formalization is stuck on a lemma."

Identify whether the issue is fundamental (the lemma is actually false, or the proof strategy is wrong) or technical (the proof assistant is being difficult). The former requires rethinking; the latter can often be resolved in office hours.

### "I am behind schedule."

Talk to the instructor immediately. Options include:

- Reducing scope (fewer features, simpler language, paper proofs instead of mechanization)
- Adjusting the timeline
- Getting targeted help on the blocking issue

Do not suffer in silence.

### "My teammate is not contributing."

Contact the instructor immediately. This will be addressed. Contribution statements are taken seriously.

---

## Submission

Submit via the course portal by **Week 10, Friday 11:59 PM**:

1. Progress report as PDF (ACM SIGPLAN or LIPIcs format, 4 pages + references)
2. Artifact access (repository link or zip file)
3. Feedback incorporation statement (can be appended to the PDF)
