# Capstone Milestone 3: Full Draft

**Due:** Week 15
**Weight:** 10% of capstone grade (4% of final course grade)
**Format:** 6-page document (excluding references and appendix) + Isabelle code

---

## Overview

This milestone serves two purposes. First, it ensures that your main proofs are complete (or nearly so) and that you have a near-final draft of your report. Second, it initiates a peer review process in which you provide and receive feedback from other teams, simulating the formalization paper review experience.

By Week 15, your Isabelle development should contain all main results, even if some auxiliary lemmas need cleanup. The final five weeks are for polishing proofs, improving proof structure, completing the report, and preparing the presentation -- not for proving your main theorem for the first time.

---

## Deliverables

### 1. Full Draft (6 pages + references + optional appendix)

Your draft must include all major sections of the final report, even if some are not yet polished:

#### Abstract

A complete abstract (150-200 words) summarizing the formalization goal, approach, main results, and lessons learned. This should be a working draft, not a placeholder.

#### Introduction

- Motivation: why this result is worth formalizing
- The informal mathematical context
- Summary of the formalization and key statistics (line count, number of lemmas, etc.)
- Outline of the report structure

#### Mathematical Background

- Statement of the main theorem and key definitions in standard mathematical notation
- A sketch of the informal proof, highlighting the steps that are non-trivial to formalize
- References to the textbook sources

#### Formalization Strategy

This is the most important section for a formalization paper. It must include:

- **Definitional choices:** How you represented key mathematical objects in Isabelle. What alternatives you considered and why you chose as you did. This is where formalization papers differ most from standard math papers.
- **Theory file structure:** A diagram showing the dependency structure of your theory files.
- **Key proof techniques:** For each major proof, describe the Isabelle proof strategy. Which proofs use structured Isar reasoning? Which use automation? Why?
- **Interaction with existing infrastructure:** How you built on the Isabelle distribution and AFP. What infrastructure gaps you encountered.
- **Proof engineering decisions:** Decisions about lemma factoring, simp rule management, locale usage, and other engineering aspects.

#### Results

Present the main formalized results:

- **Main theorem(s):** Isabelle statement and informal gloss.
- **Key lemmas:** The most important supporting lemmas, with brief explanations.
- **Statistics:** Total line count, number of definitions, number of lemmas/theorems, approximate time spent.
- **Remaining sorry:** List any proofs that are still incomplete. For each, explain the difficulty and your plan for completing it.

It is acceptable if:

- A few auxiliary lemmas still use sorry, provided you have a clear plan
- The proof structure could be cleaner (refactoring is expected in the final five weeks)
- Some proofs are longer than they need to be

It is not acceptable if:

- The main theorem uses sorry
- The majority of lemmas are incomplete
- The theory files do not build in batch mode

#### Discussion (may be brief)

- What was harder than expected and what was easier?
- What did you learn about the gap between informal and formal mathematics?
- Limitations of the formalization

#### Conclusion (may be brief)

- Key contributions
- Potential for AFP submission

### 2. Isabelle Code

- **All theory files,** organized in a clean directory structure with a working ROOT file.
- The development should build successfully with `isabelle build -D .` (modulo sorry in explicitly marked incomplete proofs).
- Include comments in theory files for readability.

### 3. Contribution Statement (for teams)

Updated contribution statement covering the entire project to date. Each team member must describe their contributions since Milestone 2.

---

## Peer Review

### Overview

Each team will review **two other projects** and receive reviews from **two teams**. This simulates the review process for formalization papers (e.g., ITP, CPP, or AFP submissions) and provides valuable external feedback before the final report.

### Review Assignments

Review assignments will be posted by Week 14. You will be assigned projects using the same proof assistant and, when possible, a related topic area.

### Review Format

For each assigned project, write a structured review covering:

#### Summary (3-5 sentences)

Summarize the formalization goal and what has been achieved. This demonstrates that you understood the project.

#### Strengths (3-5 bullet points)

What does the formalization do well? Be specific. Examples:

- "The definition of ordinal exponentiation using transfinite recursion is clean and yields a strong induction principle."
- "The Isar proof of the main lemma in MainTheorem.thy is very readable and could serve as a model for similar formalizations."
- "The AutoCorres specification cleanly separates the abstract operation from the implementation details."

#### Weaknesses (3-5 bullet points)

What could be improved? Be constructive and specific. Examples:

- "The proof of Lemma 3.2 in Lemmas.thy is 150 lines of apply-script that could likely be shortened with better intermediate lemmas."
- "The theory file imports ZF.thy directly rather than using the more structured Ordinal.thy, which means several basic ordinal lemmas need to be reproved."
- "The functional specification for the hash table does not specify behavior on hash collisions."

#### Questions for the Authors (2-3 questions)

Ask clarifying questions about formalization choices that would strengthen the report if addressed.

#### Overall Assessment

Rate the project on a scale of 1-5:

- 5: Strong accept. Near-complete formalization with clean proofs and clear documentation.
- 4: Weak accept. Good progress with a clear path to completion.
- 3: Borderline. Significant incomplete proofs but the definitions and strategy are sound.
- 2: Weak reject. Major issues in definitions or proof strategy that may be difficult to resolve.
- 1: Strong reject. Fundamental problems that require a change of direction.

Provide a 2-3 sentence justification for your rating.

#### Suggestions for Improvement (2-3 specific, actionable suggestions)

What would most improve this project for the final version?

### Review Guidelines

- **Be constructive.** The purpose is to help your peers improve their formalization.
- **Be specific.** "The proofs could be better" is not helpful. "The proof of insert_correct in HashTable.thy could benefit from extracting the key invariant about bucket membership into a separate lemma" is helpful.
- **Read the Isabelle code.** Do not just read the report. Open the theory files in Isabelle/jEdit and check that they build. Comment on proof style, not just results.
- **Be honest but respectful.** Point out genuine weaknesses, but frame them as opportunities for improvement.

### Review Deadline

Reviews are due **one week after the draft submission (Week 16, Friday 11:59 PM)**.

### Review Grading

Your reviews will be graded as part of the Milestone 3 score:

| Component | Weight |
|---|---|
| Draft quality | 70% |
| Review quality | 30% |

Reviews are graded on thoughtfulness, specificity, and evidence that you engaged with the Isabelle code. A review that says only "good formalization, no comments" will receive zero credit.

---

## Grading Rubric (Draft Only, 70% of Milestone 3)

| Component | Weight | Criteria |
|---|---|---|
| **Completeness** | 30% | All major sections are present with substantive content. The main theorem is stated and (ideally) proved. The theory files build. |
| **Formalization Quality** | 30% | Definitions are well-chosen. Proofs are clean or at least functional. The formalization strategy section demonstrates understanding of proof engineering decisions. |
| **Technical Quality** | 20% | Mathematical content is correct. Isabelle code is well-structured. The report accurately describes what is in the code. |
| **Writing** | 20% | The draft is readable. Structure is logical. The draft tells a coherent story about the formalization effort. |

### Minimum Requirements

To receive a passing grade on this milestone, your draft must:

1. Contain at least 4 pages of substantive content (not padding)
2. Include at least the statement of the main theorem in Isabelle
3. Have at least 1000 lines of Isabelle code that builds successfully
4. Describe the formalization strategy with enough detail that a reader could understand the key proof engineering decisions

Failure to meet these minimum requirements will result in a grade cap of 60% on this milestone.

---

## Using Peer Review Feedback

After receiving reviews (Week 16), you should:

1. Read all reviews carefully.
2. Identify the most critical issues raised (especially about proof structure and definitions).
3. Create a plan for addressing feedback in the final report and code.
4. Optionally, write an author response to clarify misunderstandings.

You will be asked to include a "Response to Reviews" section in your final report submission, explaining how you addressed the feedback.

---

## Common Issues at This Stage

### "My main theorem is proved but the proof is ugly."

This is a good problem to have. Spend the final five weeks refactoring: extract reusable lemmas, replace apply-scripts with Isar proofs where clarity demands it, and improve comments. A clean proof development is a significant part of the grade.

### "I have one sorry remaining in a key lemma."

Focus all remaining effort on this. Bring the exact proof state to office hours. Common strategies: (1) weaken the lemma slightly, (2) add an assumption you can discharge separately, (3) try a completely different proof approach.

### "My writing is rough."

Expected at this stage. Focus on completeness and the formalization strategy section now. Polish the writing between Weeks 15-20.

### "I want to restructure my definitions."

Major definitional changes at Week 15 are extremely risky because they invalidate existing proofs. Discuss with the instructor before proceeding. Minor adjustments (adding a locale assumption, refining a type) are expected and manageable.

---

## Submission

Submit via the course portal by **Week 15, Friday 11:59 PM**:

1. Full draft as PDF (6 pages + references + optional appendix)
2. Isabelle theory files (zip archive or repository link)
3. Contribution statement (for teams)

Submit peer reviews by **Week 16, Friday 11:59 PM** via the course review portal.
