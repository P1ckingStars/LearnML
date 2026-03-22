# How to Read Formalization Papers Effectively

A guide for PhD-track students on reading, evaluating, and presenting research papers about formal verification and mechanized mathematics. Formalization papers differ significantly from standard mathematics papers and systems papers; this guide covers what to look for and how to engage deeply with the material.

---

## Table of Contents

1. [What Makes Formalization Papers Different](#what-makes-formalization-papers-different)
2. [The Three-Pass Method for Formalization Papers](#the-three-pass-method-for-formalization-papers)
3. [Navigating Isabelle Theory Files Alongside Papers](#navigating-isabelle-theory-files-alongside-papers)
4. [Understanding Proof Engineering](#understanding-proof-engineering)
5. [Evaluating Formalization Contributions](#evaluating-formalization-contributions)
6. [Presenting Formalization Papers](#presenting-formalization-papers)
7. [Paper Summary Template](#paper-summary-template)
8. [Staying Current](#staying-current)
9. [Common Red Flags](#common-red-flags)

---

## What Makes Formalization Papers Different

Formalization papers sit at the intersection of three genres: mathematics papers, systems papers, and engineering reports. Understanding these differences is essential for reading them well.

### vs. Mathematics Papers

A mathematics paper presents a theorem and its proof. A formalization paper presents a theorem, its proof, *and* the process of translating that proof into machine-checked form. The formalization paper must discuss:

- **Definitional choices** that have no analogue in informal mathematics. Two mathematically equivalent definitions may be vastly different in their suitability for formalization. The paper should explain why one was chosen over another.
- **Proof infrastructure** that the informal proof takes for granted. An informal proof might say "by a routine cardinality argument"; the formalization must actually prove the supporting lemmas.
- **The gap** between the informal proof and the formal proof. Sometimes steps that are obvious on paper require hundreds of lines of formal proof; conversely, some steps that feel important informally are trivially handled by automation.

### vs. Systems Papers

A systems paper evaluates a system by its performance on benchmarks. A formalization paper "evaluates" its formalization by completeness (is the theorem fully proved?), size (how much proof effort was required?), and reusability (can the infrastructure be used for other formalizations?). There are no "experiments" in the usual sense; the proof either checks or it does not.

### vs. Engineering Reports

Formalization papers share with engineering reports a concern for practical matters: tool versions, library dependencies, build times, and maintenance costs. Good formalization papers discuss these honestly. Bad ones pretend the formalization sprang fully formed from pure mathematical insight.

### Key Question to Keep in Mind

When reading a formalization paper, the central question is: **What did the authors learn about the relationship between informal and formal mathematics (or verification) that they could not have learned without actually doing the formalization?** A paper that merely reports "we formalized X" without insight is of limited value.

---

## The Three-Pass Method for Formalization Papers

Adapted from Keshav's three-pass method for the specific challenges of formalization papers.

### Pass 1: Survey (10-15 minutes)

**Goal:** Determine what was formalized, in which system, and whether it is worth a deeper read.

Read:

- Title, abstract, and introduction
- Section headings
- Tables (especially statistics tables: line counts, lemma counts, development time)
- Figures (especially theory dependency diagrams)
- Conclusion

After Pass 1, answer:

- What was formalized? (A mathematical theorem? A verified program? A metatheoretic result?)
- Which proof assistant was used? (Isabelle, Coq, Lean, HOL, Mizar?)
- How large is the development? (Lines of proof, number of lemmas, person-months of effort)
- Is the formalized result already available in another proof assistant?
- Does the paper offer insight beyond "we formalized X"?

**Decision point:** Stop here if the formalized result is outside your interest or the paper does not claim to offer proof engineering insights.

### Pass 2: Comprehension (2-3 hours)

**Goal:** Understand the formalization strategy and key proof engineering decisions.

Read the full paper, focusing on:

- **Definitional choices.** This is the most important section. What definitions did the authors use? What alternatives did they consider? Why did they choose as they did? Definitional choices are where most of the intellectual content of a formalization paper resides.
- **Proof structure.** How did the formal proof differ from the textbook proof? Where was automation effective? Where was structured (Isar) reasoning necessary?
- **Infrastructure.** What existing libraries did the authors build on? What new infrastructure did they develop? Is the infrastructure reusable?
- **Statistics.** How large is the development? What is the ratio of proof to specification? How does this compare to similar formalizations?
- **Difficulties.** What was hard? What was surprisingly easy? What did the authors learn?

Do not try to verify proofs in the proof assistant on this pass. Focus on the paper's narrative.

### Pass 3: Reconstruction (5-10 hours, for important papers only)

**Goal:** Deeply internalize the formalization by engaging with the actual proof scripts.

This pass is reserved for papers directly relevant to your project. You should:

- **Download and build the formalization.** Clone the repository (or download from the AFP), build the theories in Isabelle, and verify that everything checks. Note the build time and any version issues.
- **Read key theory files.** Open the 2-3 most important theory files in Isabelle/jEdit. Step through the proofs, inspecting the proof state at key points. Identify which steps are handled by automation and which require structured reasoning.
- **Evaluate definitional choices.** Try to understand *why* the chosen definitions work. Could you improve them? What would break if you changed a definition?
- **Identify reusable infrastructure.** Which lemmas and definitions could you use in your own project? How easy would it be to import them?
- **Assess proof style.** Is the code well-organized? Are proofs readable? Would you structure things differently?

After Pass 3, you should be able to:

- Explain the formalization strategy to someone unfamiliar with the paper
- Identify the key proof engineering challenges and how they were resolved
- Propose concrete extensions or improvements
- Assess whether the infrastructure is suitable for your own work

---

## Navigating Isabelle Theory Files Alongside Papers

When a formalization paper comes with code (as it should), navigating the theory files is essential for deep understanding.

### Getting Started

1. **Build first, read second.** Before examining individual files, build the entire session with `isabelle build -D .` and verify it succeeds. Note the Isabelle version and any dependencies.

2. **Find the ROOT file.** The ROOT file lists all theory files and their build order. This gives you the logical structure of the development.

3. **Start at the main theorem.** Find the theory file containing the main result (usually mentioned in the paper). Read the theorem statement first, then work backward through its dependencies.

### Reading Order

For a typical formalization, read the theory files in this order:

1. **Main theorem file.** Read the theorem statement and the proof outline (if it is an Isar proof). Note which lemmas are invoked.
2. **Key definition files.** Find where the main concepts are defined. Understand the Isabelle types and how they relate to the mathematical objects.
3. **Supporting lemma files.** Read the lemmas used in the main proof. Identify which are routine (automation handles them) and which required substantial effort.
4. **Infrastructure files.** Read any general-purpose libraries developed for the project.

### What to Look For

- **`[simp]` declarations.** Which lemmas are declared as simp rules? This reveals what the author considers "routine" reasoning.
- **`sorry` (should be absent).** Check that there are no sorry commands. If you find any, the development is incomplete.
- **Long proofs.** Proofs longer than 50 lines often indicate a missing lemma or an awkward definition. Consider whether refactoring would help.
- **Structured vs. unstructured.** Note the mix of Isar proofs and apply-scripts. Main theorems should typically use Isar; auxiliary lemmas may use apply-scripts or automation.
- **Comments.** Good formalizations include comments explaining non-obvious steps. The absence of comments is a warning sign.

### Tools for Navigation

- **Control-click** in Isabelle/jEdit to jump to a definition or theorem.
- **`find_theorems`** to search for lemmas about specific concepts.
- **The Isabelle/jEdit sidekick panel** to see the theory file's structure.
- **`thm` command** to inspect theorem statements.

---

## Understanding Proof Engineering

Proof engineering is the discipline of building and maintaining large formal proof developments. It is the central concern of formalization papers and the primary skill this course develops.

### What Makes a Formalization Hard

A common misconception is that formalization is hard because proofs are hard. In fact, the difficulty is rarely in the mathematical argument itself. Formalization is hard because of:

1. **The definition gap.** Choosing the right definitions is the most critical decision in a formalization. Two mathematically equivalent definitions can differ by orders of magnitude in proof effort. For example, defining a group as a set with a binary operation vs. as a locale with carriers and operations leads to very different proof developments.

2. **Missing infrastructure.** Informal proofs implicitly rely on an enormous body of "obvious" facts. Each of these must be proved formally. A single step like "since A is countable and B is uncountable, A is a proper subset of B" might require 20 lines of formal proof if the connecting lemmas do not already exist.

3. **Type system friction.** In Isabelle/ZF, everything is a set (type `i`), but you must manually track which sets are ordinals, which are functions, etc. In Isabelle/HOL, the type system helps but can be rigid. Mismatches between mathematical convention and the type system create friction.

4. **Automation limitations.** Proof automation (simp, auto, sledgehammer) handles many routine steps, but when it fails, diagnosing *why* it fails can be challenging. The proof state after a failed automation attempt is often opaque.

5. **Maintenance and evolution.** Isabelle libraries change between versions. A formalization that worked in Isabelle2023 may need adjustments for Isabelle2024. Good formalization papers discuss version dependence.

### Evaluating Proof Engineering Quality

When reading a formalization paper, assess:

- **Definition quality.** Are the definitions well-motivated? Do the authors explain alternatives? Would you have chosen differently?
- **Lemma factoring.** Are lemmas appropriately scoped? Are there reusable utility lemmas, or is everything written for the specific application?
- **Proof readability.** Can you understand the main proofs without running Isabelle? Are structured proofs used where appropriate?
- **Automation effectiveness.** Is automation used well? Or do the authors fight the tools?
- **Library reuse.** Do the authors build on existing libraries, or reinvent the wheel?

---

## Evaluating Formalization Contributions

Not all formalizations are equal. Here is a framework for evaluating the significance of a formalization contribution.

### Dimensions of Contribution

| Dimension | Question | High Value | Low Value |
|---|---|---|---|
| **Mathematical depth** | Is the formalized result non-trivial? | Independence of CH, Odd Order Theorem | Definition of natural numbers |
| **Novelty** | Is this the first formalization of this result? | First in any system, or first in this system | Already formalized elsewhere with minor differences |
| **Proof engineering insight** | Did the formalization reveal something about the gap between informal and formal math? | Non-obvious definitional choices, new proof techniques | Straightforward translation with no surprises |
| **Infrastructure contribution** | Are the definitions and lemmas reusable? | Reusable library submitted to AFP | One-off proofs tied to a specific theorem |
| **Scale** | How large is the development? | Thousands of lines, months of effort | Hundreds of lines, days of effort |
| **Automation** | Did the authors develop new automation? | Custom Eisbach methods, new simp rule strategies | Used only standard methods |
| **Coverage** | What fraction of the mathematical content is formalized? | Complete proof of the main theorem | Partial formalization with sorry |

### What Counts as a Contribution

A formalization paper makes a genuine contribution if it satisfies at least one of:

1. **First formalization of an important result.** The result is mathematically significant and has not been formalized before (in any proof assistant).
2. **Significantly better formalization.** The result was formalized before but the new formalization is cleaner, shorter, more general, or more reusable.
3. **Proof engineering innovation.** The formalization develops new techniques, definitions, or automation that are applicable beyond the specific result.
4. **Bridging result.** The formalization connects two previously separate bodies of formal knowledge.

### What Does Not Count

- Formalizing a result that is already in the proof assistant's standard library.
- A trivially different version of an existing formalization (e.g., changing variable names).
- A partial formalization with many sorry statements and no plan for completion.
- A formalization that is correct but provides no insight or reusable infrastructure.

---

## Presenting Formalization Papers

### Structure for a 30-Minute Presentation

1. **Mathematical context (5 min).** What result was formalized? State the theorem informally. Explain why it matters mathematically. Give enough background that the audience can follow.

2. **Formalization landscape (3 min).** Has this been formalized before? In which systems? What was the gap that this paper fills? This is where you show you have done your homework.

3. **Key definitional choices (7 min).** This is the heart of the presentation. Show the most interesting definitions side-by-side: the textbook definition and the Isabelle definition. Explain why they differ. Discuss alternatives the authors considered.

4. **Proof structure and engineering (7 min).** Walk through the high-level proof structure. Show where automation was used and where structured reasoning was needed. Highlight any surprising proof steps -- places where the formal proof diverged from the informal argument.

5. **Statistics and evaluation (3 min).** Line counts, development time, comparison to similar formalizations. Give the audience a sense of the effort involved.

6. **Critical analysis (3 min).** What are the strengths and weaknesses? Could the definitions be improved? Is the proof engineering transferable? What extensions are natural?

7. **Discussion (2 min).** Open questions, connections to other formalizations, potential for reuse.

### Presentation Tips

- **Show real Isabelle code.** Do not just paraphrase the paper. Show key definitions and theorem statements as they appear in Isabelle. Use a large monospace font.
- **Show proof states.** If possible, show Isabelle/jEdit with the proof state at a key point in an interesting proof. This gives the audience a feel for what formalization looks like in practice.
- **Compare informal and formal.** Put the textbook definition and the Isabelle definition on the same slide. Highlight the differences.
- **Quantify the effort.** "This proof is 200 lines in Isabelle but 5 lines in the textbook" communicates the formalization gap concretely.
- **Be honest about what you do not understand.** If a proof step in the formalization is opaque to you, say so. This often leads to the best discussion.
- **Anticipate questions.** Common questions: "Why did they choose this definition instead of the obvious one?" "Could automation have handled this differently?" "How fragile is the development to Isabelle version changes?"

### Leading Discussion

Good discussion questions for formalization papers:

- "What would break if you changed definition X to Y?"
- "Could this formalization be ported to Lean/Coq? What would change?"
- "Is there a simpler proof that the authors missed, or does the complexity reflect genuine mathematical difficulty?"
- "How much of this development is reusable for a different but related result?"
- "What is the most surprising difference between the informal and formal proof?"
- "If the authors had started with a different proof assistant, would the formalization look different?"

---

## Paper Summary Template

Use this template for every formalization paper you read at Pass 2 depth or beyond.

```markdown
# [Paper Title]

**Authors:** [Names]
**Venue:** [Conference/Journal, Year]
**Proof Assistant:** [Isabelle/Coq/Lean/...]
**Link:** [URL]
**Code:** [URL to formalization]
**Date Read:** [YYYY-MM-DD]
**Pass Depth:** [1 / 2 / 3]

## What Was Formalized
[One paragraph: What mathematical result or verified program? State the main theorem.]

## Formalization Strategy
[One paragraph: What proof assistant? What logic? What definitions? Key proof techniques?]

## Key Definitional Choices
[List the 2-3 most important definitions with brief explanations of why they were chosen]

## Proof Engineering Insights
[What did the formalization reveal about the gap between informal and formal reasoning?]

## Statistics
- Lines of code: [N]
- Number of lemmas: [N]
- Development time: [person-months]
- Proof assistant version: [X]

## Strengths
- [Bullet points]

## Weaknesses
- [Bullet points]

## Questions / Confusion
- [Things you did not understand or want to discuss]

## Relevance to My Work
- [How does this relate to my project? Can I reuse any infrastructure?]

## Key Takeaways
- [2-3 bullet points: What will you remember in 6 months?]
```

---

## Staying Current

The formalization community is smaller than the ML community, which makes staying current more manageable.

### Key Venues

- **ITP (Interactive Theorem Proving):** The primary venue for formalization papers. Annual conference.
- **CPP (Certified Programs and Proofs):** Co-located with POPL. Strong on verified software and proof theory.
- **JAR (Journal of Automated Reasoning):** The main journal. Long, detailed papers.
- **IJCAR (International Joint Conference on Automated Reasoning):** Broader than ITP/CPP; includes automated reasoning.
- **AFP (Archive of Formal Proofs):** Not a publication venue but the primary repository of Isabelle formalizations. New entries are reviewed and represent the state of the art.

### Resources

- **Isabelle mailing list and Zulip:** Active community discussion about Isabelle usage.
- **Lean Zulip and Mathlib documentation:** Even if you work in Isabelle, tracking Lean's Mathlib shows which mathematical results are being formalized.
- **Proof assistants Stack Exchange:** Questions and answers about Isabelle, Coq, Lean, and other systems.
- **AFP recent entries:** Browse https://www.isa-afp.org/ regularly for new Isabelle formalizations.

### Prioritization

| Priority | Criteria | Pass Depth |
|---|---|---|
| **Must read** | Directly uses Isabelle/ZF or AutoCorres; formalizes results related to your project | Pass 3 |
| **Should read** | Uses Isabelle (any logic); demonstrates proof engineering techniques you might use | Pass 2 |
| **Good to know** | Formalizes related results in other proof assistants (Lean, Coq) | Pass 1 |
| **Skip** | Unrelated mathematical domain; proof assistant you will not use | -- |

---

## Common Red Flags

Be especially skeptical when you encounter:

- **No code availability.** A formalization paper without available theory files is like an experimental paper without available code. The claims cannot be verified.
- **Vague statistics.** "We formalized this in approximately 5000 lines" is less trustworthy than "5,247 lines of Isabelle in 47 theory files, building on 12 AFP entries."
- **No discussion of definitional choices.** If the paper does not explain *why* definitions were chosen, the insight content is low.
- **Sorry in the development.** Any formalization with remaining sorry is incomplete. This should be prominently disclosed.
- **No comparison to existing formalizations.** The paper should discuss related formalizations in other proof assistants and explain what is new.
- **Proof assistant version not specified.** Formalizations depend on specific versions. Without version information, the development may not build.
- **"Straightforward formalization."** This phrase usually means the author did not reflect on what they learned. The most valuable formalizations are the ones that were *not* straightforward.
- **Exaggerated claims of novelty.** Check the AFP and Mathlib. If the result is already formalized elsewhere, the paper should acknowledge this and explain what its contribution is beyond re-formalization.

---

## Recommended Meta-Resources

- S. Keshav, "How to Read a Paper," ACM SIGCOMM Computer Communication Review, 2007. The foundational paper on systematic paper reading.
- J. Wiedijk, "The Seventeen Provers of the World," Springer LNAI 3600, 2006. A comparison of proof assistants through the formalization of the square root of 2 being irrational, providing context for cross-system comparisons.
- G. Klein, "Operating System Verification -- An Overview," Sadhana, 2009. A survey of OS verification providing context for the seL4 work.
- F. Wiedijk, "Formalizing 100 Theorems," a list tracking which of 100 well-known theorems have been formalized in which proof assistants. Available online. Useful for understanding the state of mathematical formalization.
