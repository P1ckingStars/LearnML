# Capstone Milestone 1: Problem Statement and Related Work

**Due:** Week 5
**Weight:** 5% of capstone grade (2% of final course grade)
**Format:** 2-page document (excluding references)

---

## Overview

The purpose of this milestone is to ensure you have identified a well-defined formalization goal, surveyed the existing landscape of related formalizations, and formulated a concrete plan for your Isabelle development. A strong problem statement is the foundation of a successful formalization project. This milestone also serves as an early checkpoint: if your scope is wrong, your definitions are ill-chosen, or the topic is already formalized elsewhere, the instructor can redirect you before significant effort is invested.

Formalization projects fail most often due to poor scoping: either the target theorem is too ambitious for the available time, or the definitions are set up in a way that makes downstream proofs unnecessarily difficult. This milestone is your opportunity to get feedback on both.

---

## Deliverables

### 1. Problem Statement Document (2 pages + references)

Your document must contain the following sections:

#### Formalization Goal

State what you intend to formalize in 1-3 sentences. A good formalization goal is:

- **Precise:** Not "formalize some set theory" but "formalize the Mostowski collapse lemma and prove that every well-founded extensional structure is isomorphic to a unique transitive set, in Isabelle/ZF."
- **Verifiable:** At the end of the project, there should be a clear `theorem` statement in Isabelle that either has a complete proof or does not.
- **Novel:** The result should not already be in the Isabelle distribution or the AFP. Explain how you verified this (e.g., "I searched the AFP index and ran `find_theorems` for key concepts").
- **Feasible:** You should be able to complete the formalization in 15 weeks. Estimate the proof complexity by examining similar formalizations in the AFP.

#### Mathematical Background

In 1-2 paragraphs, state the informal theorem you intend to formalize and give the key definitions needed to understand it. Include the standard textbook reference for the result. This section should be accessible to someone who has taken a graduate set theory or verification course but may not know the specific result.

#### Related Formalization Survey

Survey at least **8 relevant formalizations** that contextualize your project. For each, provide:

- The formalization system used (Isabelle, Coq, Lean, Mizar, etc.)
- A 2-3 sentence summary of what was formalized
- How it relates to your proposed work
- What gap or limitation it leaves that your project addresses

Sources to check:

- Isabelle AFP (https://www.isa-afp.org/)
- Lean's Mathlib
- Coq's Mathematical Components library and related projects
- Mizar Mathematical Library
- Metamath and set.mm
- The Formal Abstracts project

Organize the survey thematically (e.g., "formalizations of ordinal arithmetic," "verified data structures in Isabelle"), not as a flat list.

#### Formalization Plan

Describe your planned approach in sufficient detail that the instructor can assess feasibility:

- **Track:** Which track (A, B, or C) and why.
- **Definitions:** List the key definitions you will need. For Track A, what set-theoretic concepts must you formalize? For Track B, what is the functional specification of your C module? For Track C, what is the connection between the ZF and C components?
- **Proof strategy:** For the main theorem, outline the high-level proof structure. What are the key lemmas? Which steps do you expect to be hardest to formalize?
- **Existing infrastructure:** What theories from the Isabelle distribution or AFP will you build on? What do you need to develop from scratch?
- **Expected difficulties:** What are the main risks? Where might the formalization diverge from the textbook proof?

#### Expected Contributions

In a bulleted list, state 2-4 concrete contributions:

- "A complete Isabelle/ZF formalization of the Cantor Normal Form theorem for ordinals below epsilon_0."
- "A verified C implementation of a binary min-heap with insert, extract-min, and decrease-key, proven correct against a functional specification using AutoCorres."
- "A library of 15+ reusable lemmas about ordinal arithmetic that are not currently in the Isabelle distribution."

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

Include buffer time for stuck proofs. In formalization work, a single lemma can block progress for days. Allocate at least 20% of your time as contingency.

### 2. Team Formation (if applicable)

If working in a team, submit:

- Team member names and email addresses
- A brief statement of each member's relevant background (e.g., "experience with Isabelle/HOL from a prior course," "strong set theory background," "systems programming experience")
- Planned division of responsibilities

### 3. Preliminary Exploration

Provide evidence that you have begun exploring the Isabelle infrastructure for your project:

- A `.thy` file containing at least the key definitions you plan to use (they do not need to be final)
- Evidence that you can successfully load and build the relevant Isabelle theories (a screenshot of Isabelle/jEdit with your theory file is sufficient)
- For Track B: evidence that AutoCorres processes your C source file without errors

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Formalization Goal** | 25% | Goal is clear, precise, novel, and feasible. The student has verified novelty against the AFP and relevant libraries. |
| **Related Work Survey** | 25% | At least 8 formalizations are surveyed across multiple proof assistants. Summaries are accurate. The survey identifies a clear gap that the project addresses. |
| **Formalization Plan** | 25% | The plan identifies key definitions, proof strategies, and expected difficulties. The student has thought about which steps will be hard and why. Infrastructure dependencies are identified. |
| **Writing and Preliminary Exploration** | 15% | Document is clear and well-organized. Preliminary `.thy` file demonstrates initial engagement with Isabelle. |
| **Timeline and Planning** | 10% | Timeline is realistic with specific weekly tasks. Buffer time is included. The plan accounts for the unpredictability of formalization work. |

---

## Feedback Process

After submission, you will receive:

1. **Written feedback** from the instructor or a TA within one week, covering:
   - Assessment of scope and feasibility
   - Suggestions for existing Isabelle theories you may have missed
   - Concerns about definition choices or proof strategy
   - Recommendations for adjustments

2. **A brief meeting** (15 minutes) with the instructor or TA to discuss feedback and refine the plan. Sign up for a slot on the course calendar.

You are expected to incorporate this feedback into your subsequent milestones. Ignoring feedback without justification will be penalized in later milestones.

---

## Common Issues and How to Avoid Them

### Scope Too Ambitious

- Bad: "Formalize the independence of the continuum hypothesis."
- Better: "Formalize the constructible universe L up to the condensation lemma and prove GCH in L, building on Paulson's existing Isabelle/ZF development of L."
- Fix: Look at AFP entries of similar scope and estimate the line count. If your estimate exceeds 4000 lines for a solo project, scope down.

### Scope Too Narrow

- Bad: "Formalize the definition of an ordinal."
- Better: "Formalize ordinal exponentiation, prove its basic properties (associativity, monotonicity, continuity), and establish the Cantor Normal Form theorem."
- Fix: Ensure your target theorem requires a non-trivial proof chain, not just a single application of an existing lemma.

### Definitions Not Aligned with Isabelle Infrastructure

- Bad: Defining ordinals from scratch when `Isabelle/ZF` already has `Ord`.
- Better: Building on the existing `Ord` infrastructure and extending it.
- Fix: Spend time with `find_theorems` and the Isabelle/ZF source before committing to definitions. Misaligned definitions cause enormous downstream pain.

### Missing Novelty Check

- Bad: Spending 5 weeks formalizing something that turns out to be in the AFP.
- Better: Searching the AFP, Lean's Mathlib, and Coq libraries before proposing.
- Fix: Document your novelty search in the proposal. Include search terms used and results.

### Unrealistic Timeline

- Bad: "Weeks 5-18: formalize. Week 19: write report."
- Better: See the template above with specific weekly tasks and buffer.
- Fix: Allocate at least 4 weeks for writing and report preparation. Writing about formalizations is harder than it looks because you must explain proof engineering decisions that feel obvious when you are in the middle of them.

---

## Submission

Submit via the course portal by **Week 5, Friday 11:59 PM**:

1. Problem statement document as PDF (2 pages + references)
2. Preliminary `.thy` file(s)
3. Team formation document (if applicable)
