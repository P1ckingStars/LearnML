# Capstone: Formal Verification Research Project

**Course:** Formal Verification with Isabelle (PhD Track)
**Timeline:** Weeks 1-20
**Weight:** 30% of final grade
**Format:** Teams of 1-2 students

---

## Overview

The capstone project is the centerpiece of this course. Your goal is to produce a substantial, original formalization in Isabelle that demonstrates mastery of mechanized reasoning and contributes to the body of machine-checked mathematics or verified software. The project spans the entire course, with structured milestones to ensure steady progress.

By the end of the course, you should have an Isabelle development of at least 2000 lines, an 8-page report documenting your formalization strategy and results, a polished 15-minute research presentation, and a clean repository containing your theory files and any supporting code.

---

## Objectives

1. Identify a formalization goal that is non-trivial and well-scoped.
2. Develop and execute a formalization plan, navigating the gap between informal mathematics and machine-checked proofs.
3. Produce a clean, well-structured Isabelle development with complete proofs.
4. Communicate your formalization decisions, difficulties, and results in a clear written report.
5. Present your work to the class and respond to critical questions about proof engineering choices.

---

## Project Tracks

You must choose one of three tracks. Each track has distinct requirements, and your choice should reflect your interests and background.

### Track A: ZF Formalization

Formalize a substantial set-theoretic result in Isabelle/ZF. The formalization should go meaningfully beyond what is already in the Isabelle/ZF distribution.

**Suggested topics (illustrative, not exhaustive):**

1. **Mostowski collapse lemma and transitive models.** Formalize the Mostowski collapse and prove that every well-founded extensional structure is isomorphic to a transitive set. Develop the supporting theory of well-founded relations and extensional structures.
2. **Reflection theorem for a specific formula class.** Formalize the Levy reflection principle for Sigma_n formulas, including the construction of reflecting ordinals and the use of the cumulative hierarchy.
3. **Ordinal arithmetic theorems.** Formalize ordinal exponentiation, the Cantor Normal Form theorem, and Hessenberg's theorem on natural (commutative) addition and multiplication of ordinals.
4. **Combinatorial set theory.** Formalize the Erdos-Rado partition theorem, or the infinite Ramsey theorem with its applications to partition calculus.
5. **Cardinal arithmetic.** Formalize Easton's theorem on the behavior of the continuum function at regular cardinals, or develop the theory of singular cardinals (cofinality, Konig's theorem, cardinal exponentiation).
6. **Constructible universe.** Formalize the Condensation Lemma for L and prove that GCH holds in L, building on Paulson's existing Isabelle/ZF development.
7. **Determinacy.** Formalize open determinacy (the Gale-Stewart theorem) for infinite games on natural numbers.

**Scope guidance:** A Track A project should involve formalizing at least one theorem that requires a non-trivial proof chain (at least 3-4 intermediate lemmas of substance). Simply stating axioms and definitions without proving deep results is insufficient.

### Track B: C Verification

Verify a non-trivial C module end-to-end using AutoCorres and the Isabelle/SIMPL framework. The C code must be in the supported subset of StrictC, and the verification must include a functional specification, refinement proofs, and correctness theorems.

**Suggested programs (illustrative, not exhaustive):**

1. **Hash table.** Implement and verify a separate-chaining or linear-probing hash table supporting insert, lookup, and delete. Prove that operations maintain the hash table invariant and that lookup after insert returns the correct value.
2. **Priority queue.** Implement and verify a binary min-heap with insert, extract-min, and decrease-key. Prove the heap property is maintained and that extract-min returns the minimum element.
3. **AVL tree.** Implement and verify an AVL tree with insert, delete, and lookup. Prove balance invariant maintenance and correctness of all operations.
4. **Protocol parser.** Implement and verify a parser for a simple binary protocol (e.g., TLV encoding). Prove that parsing is total (no undefined behavior), preserves message integrity, and rejects malformed inputs.
5. **Memory allocator.** Implement and verify a simple bump allocator or free-list allocator. Prove that allocated regions do not overlap and that freed memory is reusable.
6. **Sorting algorithm.** Verify merge sort or quicksort on arrays. Prove the output is sorted and is a permutation of the input.

**Scope guidance:** The C source should be 200-500 lines of code. The verification effort (Isabelle proofs) will typically be 5-15x the size of the C code. You must provide a clear functional specification against which the C implementation is verified.

### Track C: Bridge Project

A project that connects set-theoretic formalization with program verification. This track is the most ambitious and is recommended only for students with strong backgrounds in both areas.

**Suggested topics:**

1. **Verified set-theoretic algorithm.** Formalize a set-theoretic algorithm (e.g., rank computation, transitive closure, ordinal comparison) in Isabelle/ZF, then implement it in C and verify the implementation against the formalized specification using AutoCorres.
2. **Interpreter verification.** Define the syntax and semantics of a simple language (e.g., a while-language or a stack machine) in Isabelle/ZF, prove metatheoretic properties (type safety, termination of well-typed programs), then implement an interpreter in C and verify it against the formalized semantics.
3. **Decision procedure.** Formalize the correctness of a decision procedure for a fragment of set theory or arithmetic in Isabelle/ZF, then implement and verify the procedure in C.

**Scope guidance:** Bridge projects require at least 1000 lines of Isabelle/ZF formalization and 150+ lines of verified C code. The connecting argument (showing the C implementation correctly realizes the formalized specification) is the most challenging and most valuable part.

---

## Team Formation

- **Team size:** 1-2 students
- **Expectations scale with team size:**
  - Solo: Scope of 2000+ lines of Isabelle, demonstrating one substantial result
  - Pair: Scope of 3000+ lines of Isabelle, demonstrating a more comprehensive development
- **Team formation deadline:** Week 3
- **Contribution tracking:** Each milestone must include a contribution statement. Both team members must contribute meaningfully to both formalization and writing.
- **Conflict resolution:** If team issues arise, contact the instructor immediately.

---

## Timeline and Milestones

| Week | Milestone | Weight | Deliverable |
|---|---|---|---|
| 5 | Problem Statement | 5% | 2-page proposal |
| 10 | Preliminary Definitions and Results | 10% | 4-page progress report + Isabelle code |
| 15 | Full Draft | 10% | 6-page draft + Isabelle code |
| 20 | Final Report + Presentation | 15% | 8-page report, 15-min talk, Isabelle development |

See the individual milestone specification documents for detailed requirements:

- [Milestone 1: Problem Statement](milestone_1.md)
- [Milestone 2: Preliminary Definitions and Results](milestone_2.md)
- [Milestone 3: Full Draft](milestone_3.md)
- [Final Report](final_report.md)

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Formalization Depth** | 25% | The project formalizes a non-trivial result. Definitions are well-chosen and proofs are complete. The development goes beyond trivial applications of automation. |
| **Proof Engineering** | 25% | The Isabelle code is well-structured: clear theory file organization, appropriate use of locales and type classes, good lemma factoring, effective use of automation (simp, auto, blast) where appropriate and structured Isar proofs where clarity demands it. |
| **Correctness and Completeness** | 25% | All proofs are complete (no sorry). Definitions faithfully represent the intended mathematical concepts. For Track B, the functional specification accurately captures the intended behavior. |
| **Writing and Presentation** | 25% | The report is clear, well-organized, and honestly discusses difficulties encountered. The presentation demonstrates understanding and responds to questions thoughtfully. |

### Grade Descriptors

- **A (90-100%):** A formalization of genuine depth that required significant proof engineering. The Isabelle development is clean and well-documented. The report clearly explains the formalization strategy, key difficulties, and how they were resolved. The work could serve as a basis for a formalization paper.
- **B (80-89%):** A solid formalization with complete proofs. The development is functional but may lack polish. The report is clear but may miss some proof engineering insights.
- **C (70-79%):** The formalization covers a non-trivial result but may have structural issues. Some proofs may rely excessively on sorry or brute-force automation. The report is adequate but superficial.
- **D/F (<70%):** The formalization is incomplete or trivial. Many proofs use sorry. The report does not demonstrate understanding of the formalization challenges.

---

## Resources

### Isabelle Infrastructure

- Isabelle2025 is the required version. Install from the official website.
- Isabelle/ZF theories are bundled with the distribution under `~~/src/ZF/`.
- AutoCorres is available as a separate download; installation instructions are on the course website.
- The seL4 verification bundle includes examples that serve as templates for Track B projects.

### Repository Structure

Your repository should follow this structure:

```
project/
    README.md              # Setup instructions, how to build proofs
    ROOT                   # Isabelle session root file
    theories/              # Isabelle theory files
        Definitions.thy
        Lemmas.thy
        MainTheorem.thy
    c_source/              # C source files (Track B/C only)
        module.c
        module.h
    document/              # LaTeX source for the report
        root.tex
    slides/                # Presentation slides
```

### Office Hours

The instructor and TAs hold dedicated capstone office hours (check the course calendar). Use these for:

- Discussing formalization strategy and scope
- Debugging stuck proofs
- Getting feedback on proof structure
- Reviewing AutoCorres setup issues

### Literature

- The Archive of Formal Proofs (AFP) is the primary repository of existing Isabelle formalizations. Check the AFP before starting to ensure your formalization is novel.
- Use Isabelle's `find_theorems` command extensively to discover what is already available.
- Read at least 5-10 formalization papers relevant to your project.

---

## Academic Integrity

- All formalization work must be your own. You may reference existing AFP entries and the Isabelle distribution, but novel proofs must be original.
- If your formalization extends existing work, clearly delineate what is new.
- Your report must be original writing.
- Collaboration between teams is limited to discussion. Do not share proof scripts across teams.
- Using AI tools (LLMs) for proof discovery is permitted but must be disclosed and documented. Proofs must be verified by Isabelle regardless of how they were discovered.

---

## FAQ

**Q: Can I formalize something already in the AFP?**
A: No. Your formalization must be novel. You may extend an existing AFP entry, but the extension must be substantial. Check with the instructor before committing to a topic.

**Q: How do I know if my project is the right scope?**
A: A good rule of thumb: if the informal proof fits on one page of a textbook, the project is probably too small. If it spans an entire chapter, it is probably too large. Aim for a result whose informal proof is 3-10 pages.

**Q: What if I get stuck on a proof?**
A: This is the norm in formalization work, not the exception. Come to office hours with a minimal example of the stuck proof state. Often the issue is a missing lemma, an overly strong goal, or a definition that needs adjustment.

**Q: Can I use Sledgehammer extensively?**
A: Sledgehammer is a valuable tool and you should use it. However, your report must demonstrate understanding of the proof structure. A development that consists entirely of `by (metis ...)` calls with no human-readable proof structure will be penalized under "Proof Engineering."

**Q: Can I submit my capstone to the AFP?**
A: Yes, and you are encouraged to do so. The instructor is happy to advise on AFP submission requirements. Several past student projects have been accepted.

**Q: What if my initial topic turns out to be infeasible?**
A: This happens frequently in formalization. Pivoting is acceptable and expected. Document what you tried and why you changed direction. The milestones are designed to catch scope issues early.
