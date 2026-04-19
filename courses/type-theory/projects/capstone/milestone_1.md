---
title: "Capstone Milestone 1: Problem Statement"
tags:
  - type-theory
  - project
---
# Capstone Milestone 1: Problem Statement

**Due:** Week 5
**Weight:** 5% of capstone grade (2% of final course grade)
**Format:** PDF, 2 pages (ACM SIGPLAN or LIPIcs template, excluding references)

---

## Overview

The purpose of this milestone is to ensure you have identified a well-defined research question in type theory, surveyed the relevant literature, and formulated a concrete plan of attack. A strong problem statement is the foundation of a successful research project. This milestone also serves as an early checkpoint: if your scope is too broad, too narrow, or insufficiently novel, the instructor can redirect you before significant effort is invested.

Type theory projects span a wide range of activities -- system design, formal proof, implementation, mechanized formalization, and empirical evaluation. Your proposal should make clear which of these activities your project involves and what the concrete deliverable will be.

---

## Deliverables

### 1. Problem Statement Document (2 pages + references)

Your document must contain the following sections:

#### Research Question

State your research question clearly and precisely in 1-3 sentences. A good research question is:

- **Specific:** Not "study linear types" but "design a linear type system for safe file handle management in a language with exceptions, and prove that well-typed programs never access a closed handle."
- **Measurable:** You should be able to determine, at the end of the project, whether you answered the question.
- **Novel:** The answer should not already exist in the literature. Explain why.
- **Feasible:** You should be able to make meaningful progress in 15 weeks with your available resources.

#### Motivation

In 1-2 paragraphs, explain why this question matters. Who would benefit from an answer? What practical or theoretical impact would a solution have? Connect your question to broader themes in type theory and programming languages.

#### Related Work Survey

Summarize at least **10 relevant papers** that contextualize your research question. For each paper, provide:

- A 2-3 sentence summary of the key contribution
- How it relates to your proposed work
- What gap or limitation it leaves that your project addresses

Organize the related work thematically, not as a flat list. Identify 2-3 threads in the literature (e.g., "substructural type systems," "gradual typing," "mechanized metatheory") and explain how your work fits into the landscape.

#### Proposed Approach

Describe your planned method in sufficient detail that a knowledgeable reader could assess feasibility. Include:

- **Type of contribution:** What are you delivering? A type system design? A formalization? An implementation? A theoretical result? A combination?
- **Key technical ideas:** What is the core type-theoretic idea? What makes your approach different from prior work?
- **Artifact plan:** What will your artifact be? A type checker? A proof in Lean? A formalized metatheory? Specify the language, tool, or framework.
- **Evaluation plan:** How will you know if your project succeeded? What will you measure or prove?
- **Expected challenges:** What are the main risks? What might go wrong? Which parts are you least sure about?

#### Expected Contributions

In a bulleted list, state 2-4 concrete contributions you expect to make. For example:

- "A type system for tracking file handle lifetimes in the presence of exceptions, with formal typing rules."
- "A proof of type safety (progress and preservation) for the system, formalized in Lean 4."
- "A prototype type checker demonstrating the system on 10 example programs."

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

Include buffer time for unexpected delays. Allocate at least 4 weeks for writing and revision.

### 2. Team Formation (if applicable)

If working in a pair, submit:

- Team member names and email addresses
- A brief statement of each member's relevant background (e.g., PL courses taken, proof assistant experience, implementation languages)
- Planned division of responsibilities

### 3. Preliminary Literature Collection

Provide a BibTeX file or reference list with at least 15 papers you plan to read (this is a superset of the 10 you summarize in the document). You do not need to have read all 15 yet, but you should have identified them.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Research Question** | 25% | Question is clear, specific, measurable, and novel. It is neither too broad nor too narrow. The type-theoretic content is evident. |
| **Related Work** | 25% | At least 10 papers are surveyed. Summaries are accurate and informative. The survey identifies a clear gap that the project addresses. Organization is thematic, not a flat list. |
| **Proposed Approach** | 25% | The plan is technically sound and feasible. The artifact is clearly specified. Evaluation criteria are defined. Risks are acknowledged. The type-theoretic depth is appropriate for a PhD course. |
| **Writing and Presentation** | 15% | Document is clear, well-organized, and professional. Follows the specified template. Technical notation is used correctly. |
| **Timeline and Planning** | 10% | Timeline is realistic and specific. Milestones are concrete. Buffer time is included. Writing time is allocated. |

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

- Bad: "Study dependent types."
- Better: "Implement a dependently typed array language where array dimensions are tracked at the type level, and evaluate the annotation burden on 5 benchmark programs."
- Fix: Add constraints (specific type-theoretic feature, specific language, specific evaluation).

### Problem Too Narrow

- Bad: "Add one typing rule to STLC."
- Better: "Extend STLC with intersection types, prove decidability of type checking, and compare annotation burden against System F on a benchmark suite."
- Fix: Ensure the contribution generalizes or has broader implications.

### Insufficient Type-Theoretic Depth

- Bad: "Implement a type checker for Python."
- Better: "Design a gradual type system for a Python-like language with structural subtyping, formalize the gradual guarantee, and implement a prototype."
- Fix: Identify the type-theoretic contribution explicitly.

### Missing Artifact Plan

- Bad: "We will prove things about our type system."
- Better: "We will prove progress and preservation on paper and implement a prototype type checker in OCaml with a test suite of 30 programs."
- Fix: Specify exactly what you will build, prove, or formalize.

### Unrealistic Timeline

- Bad: "Weeks 5-18: implement and prove things. Week 19: write paper."
- Better: See the template above with specific weekly tasks.
- Fix: Allocate at least 4 weeks for writing and revision. Writing always takes longer than you expect.

---

## Submission

Submit via the course portal by **Week 5, Friday 11:59 PM**:

1. Problem statement document as PDF (ACM SIGPLAN or LIPIcs format, 2 pages + references)
2. BibTeX file or reference list (15+ papers)
3. Team formation document (if applicable)
