---
title: "Capstone Project: Original Research in Type Theory"
tags:
  - type-theory
  - project
---
# Capstone Project: Original Research in Type Theory

**Course:** Type Theory (PhD Track)
**Timeline:** Weeks 1-20
**Weight:** 30% of final grade
**Format:** Individual or pairs

---

## Overview

The capstone project is the centerpiece of this course. Your goal is to produce a publishable-quality research contribution at the intersection of type theory, programming languages, and formal methods. This may take the form of a novel type system design, a mechanized formalization, an implementation of a type-theoretic idea in a practical language, a theoretical result about a type system's properties, or a comprehensive empirical study of type system features.

The project spans the entire course, with structured milestones to ensure steady progress. By the end of the course, you should have a 10-12 page report in conference style (POPL, ICFP, or OOPSLA format), a polished 15-minute research presentation, and a clean code repository or formalization artifact that others could use to reproduce or build upon your results.

Type theory is a field where implementation, formalization, and theory are deeply intertwined. The best projects will combine at least two of these elements: for example, designing a new type system and proving its soundness, or formalizing an existing result in a proof assistant and extracting insights from the formalization process.

---

## Objectives

1. Identify an open research question in type theory, programming language design, or formal verification.
2. Develop and execute a research plan to address it, drawing on the concepts and techniques covered in the course.
3. Produce rigorous results, whether theoretical (proofs), empirical (implementations and benchmarks), or formal (mechanized proofs in a proof assistant).
4. Communicate your findings in a clear, professional research paper suitable for submission to a PL workshop or conference.
5. Present your work to the class and defend your design decisions and results under questioning.

---

## Project Scope and Expectations

### What Constitutes Publishable Quality

Your project should aspire to the level of a workshop paper at a top PL venue (POPL, ICFP, OOPSLA, PLDI) or a solid contribution to a specialized workshop (TyDe, WITS, WGT, TYPES). Concretely, this means:

- **Novel type system or type-theoretic feature:** Design a new type system or extend an existing one with a well-motivated feature. Formalize the metatheory (at least on paper; mechanization is a bonus). Implement a prototype type checker. Demonstrate utility on representative examples.
- **Mechanized formalization:** Take a significant type-theoretic result from the literature and formalize it in a proof assistant (Lean, Coq, Agda). The formalization must go beyond textbook exercises: choose a result where the formalization itself reveals something (e.g., hidden assumptions, alternative proof strategies, generalization opportunities).
- **Implementation study:** Implement a non-trivial type system feature in a real or realistic language. Conduct a rigorous evaluation: does the feature catch real bugs? What is the annotation burden? How does it affect compilation time? Compare against alternatives.
- **Theoretical result:** Prove a new theorem about a type system's properties (soundness, completeness, decidability, expressiveness). The result should extend the state of the art, not merely reproduce a known proof.
- **Empirical study:** Conduct a rigorous empirical study of how type system features affect programmer productivity, code quality, or system reliability. This requires careful experimental design, appropriate statistical analysis, and a meaningful population of subjects or codebases.

### What Is NOT Sufficient

- Implementing a textbook type checker without novel analysis, comparison, or extension.
- A literature survey without a concrete artifact (implementation, formalization, or proof).
- Applying an existing type system to a new domain without identifying and addressing challenges specific to that domain.
- A project whose type-theoretic content is superficial, regardless of the engineering effort invested.
- Formalizing a result that has already been formalized in the same proof assistant without substantial extension or improvement.

---

## Suggested Project Topics

The following are concrete starting points organized by theme. You are strongly encouraged to develop your own idea, but these illustrate appropriate scope and ambition.

### Gradual and Dynamic Typing

1. **Gradual dependent types:** Design a gradual typing discipline for a dependently typed language, following the approach of Garcia et al. but extending to full dependent types. Define the dynamic semantics (runtime casts), prove the gradual guarantee, and implement a prototype.
2. **Blame tracking for polymorphism:** Extend the blame calculus of Wadler and Findler to handle parametric polymorphism. Prove that well-typed components cannot be blamed. Implement and test on realistic examples.
3. **Migratory typing cost analysis:** Instrument an existing gradually typed language (e.g., Typed Racket) to measure the runtime overhead of type boundary crossings. Propose and evaluate optimizations.

### Substructural and Resource Types

4. **Linear types for safe systems programming:** Design a linear type system for a language targeting memory management or file handle safety. Implement the type checker and demonstrate that it prevents real resource leaks on a benchmark suite.
5. **Affine types with borrowing:** Extend a simple language with affine types and a borrowing mechanism inspired by Rust. Formalize the type system and prove memory safety without garbage collection.
6. **Graded modal types for resource tracking:** Implement a type system based on graded modalities (Orchard, Liepelt, and Eades) that tracks resource usage quantitatively. Apply it to a domain such as differential privacy or sensitivity analysis.
7. **Session types for a real protocol:** Formalize a real-world communication protocol (e.g., OAuth 2.0, TLS handshake, or a database transaction protocol) using session types. Prove that well-typed programs respect the protocol. Implement a runtime that enforces session fidelity.

### Effect Systems and Handlers

8. **Algebraic effect handlers with type inference:** Design a type-and-effect system for a language with algebraic effects and handlers. Implement bidirectional type inference that infers effect annotations. Benchmark the annotation burden against explicit annotation.
9. **Effect handlers and linearity:** Investigate the interaction between algebraic effect handlers and linear types. When can a handler safely duplicate or discard a continuation? Design a type system that tracks this.
10. **Coeffect calculus implementation:** Implement a coeffect calculus (Petricek, Orchard, and Mycroft) that tracks contextual requirements. Apply it to a practical domain such as dataflow analysis or implicit parameter passing.

### Dependent Types and Verification

11. **Dependent types for safe array programming:** Design a dependently typed array language in the spirit of Futhark or Dex, where array dimensions are tracked at the type level. Prove that well-typed programs are free of out-of-bounds errors.
12. **Refinement types for security:** Extend a simple language with refinement types that enforce security policies (e.g., information flow control, capability safety). Formalize the type system and prove noninterference.
13. **Cubical type theory prototype:** Implement a core type checker for a fragment of cubical type theory, supporting at least paths, transport, and composition. Compare the computational behavior of cubical identity types against the Book HoTT approach.
14. **Observational type theory implementation:** Implement a core fragment of observational type theory (Altenkirch, McBride, and Swierstra), demonstrating definitional proof irrelevance and function extensionality.

### Type Inference and Elaboration

15. **Higher-rank type inference:** Implement and compare type inference algorithms for higher-rank polymorphism: Complete and Easy (Dunfield and Krishnaswami), Quick Look (Serrano et al.), and FreezeML (Emrich et al.). Evaluate on a shared benchmark suite.
16. **Implicit arguments via unification:** Implement a unification-based implicit argument mechanism for a dependently typed language. Study the decidability boundary: which implicit arguments can be inferred, and which require annotation? Characterize the failure modes.
17. **Type error diagnosis:** Design and implement a type error diagnosis system that uses techniques from constraint solving (e.g., minimal unsatisfiable subsets) to produce precise, actionable error messages. Evaluate on a corpus of student type errors.

### Mechanized Metatheory

18. **Formalize type safety for System F in Lean 4:** Produce a complete, clean formalization of type safety (progress and preservation) for System F in Lean 4, using well-scoped de Bruijn representations. Compare your formalization against POPLmark-style formalizations in Coq.
19. **Formalize strong normalization:** Formalize a proof of strong normalization for STLC or System T in a proof assistant. Compare logical relations vs. reducibility candidates approaches. Document which parts of the proof are hardest to formalize and why.
20. **Formalize the untyped lambda calculus confluence:** Formalize the Church-Rosser theorem for the untyped lambda calculus in Lean or Agda. Compare parallel reduction (Takahashi) vs. complete developments approaches.

### Practical Type System Features

21. **Typestate for protocol compliance:** Design a typestate-based type system that ensures objects follow a prescribed protocol (e.g., file handles must be opened before reading, sockets must be bound before listening). Implement and evaluate on a set of protocol benchmarks.
22. **Row polymorphism for extensible records:** Implement row-polymorphic records and variants for a functional language. Compare against structural subtyping and nominal typing approaches. Measure the expressiveness and inference capabilities.
23. **Intersection and union types:** Design a type system with intersection and union types. Address the decidability challenges. Implement type checking and compare the expressiveness against overloading-based approaches.

### Cross-Cutting Topics

24. **Type-preserving compilation:** Implement a type-preserving compiler from a source language with polymorphism to a typed intermediate language (e.g., System F to TAL-like target). Prove that compilation preserves typing.
25. **Normalization for a practical type theory:** Implement and benchmark different normalization strategies (NbE, abstract machines, graph reduction) for a dependently typed language. Measure performance on real proof assistant workloads extracted from Lean or Agda libraries.
26. **Type-directed program synthesis:** Implement a type-directed program synthesis tool for a functional language. Given a type, generate all programs (up to some size bound) that inhabit that type. Evaluate on a benchmark of synthesis problems.
27. **Sized types for termination checking:** Implement a sized type system for a dependently typed language to guarantee termination without syntactic guards. Compare against Agda's termination checker and measure the annotation overhead.
28. **Quotient types implementation:** Implement quotient types in a proof assistant or custom type theory implementation. Demonstrate their utility by formalizing a construction that is awkward without them (e.g., integers as quotients of pairs of naturals).

### Additional Ideas

The topics above are starting points. You may also consider:

- **Quantitative type theory (QTT):** Implement a core language based on quantitative type theory as in Atkey (2018), where each variable binding is annotated with a usage semiring element. Compare the expressiveness against linear and affine type systems.
- **Elaboration and macro systems:** Design a typed elaboration system that supports hygienic macros with type-aware expansion. Investigate the interaction between macro expansion and type inference.
- **Verified compilation for a typed language:** Prove (in a proof assistant) that a compiler for a simply typed language preserves types and semantics. The source and target languages should both have type systems.
- **Type-level computation and decidability:** Investigate the boundary between decidable and undecidable type checking for a language with type-level computation. Characterize precisely which type-level features cause undecidability.

### Choosing a Topic

When selecting a project, consider the following criteria:

- **Personal interest:** You will spend 15+ weeks on this project. Choose something you find genuinely interesting.
- **Background fit:** Projects involving mechanized formalization require proof assistant experience. Implementation projects require strong programming skills. Theoretical projects require mathematical maturity.
- **Novelty check:** Before committing to a topic, search the literature thoroughly. If your exact idea has been done, you need to find a new angle.
- **Scope calibration:** Discuss your idea with the instructor during office hours. A common failure mode is choosing a topic that is too ambitious for one semester.
- **Artifact clarity:** Before starting, you should be able to describe in one sentence what your artifact will be (e.g., "a type checker for a language with graded modalities, implemented in Haskell, with a test suite of 50 programs").

---

## Team Formation

- **Team size:** 1-2 students
- **Expectations scale with team size:**
  - Solo: Scope of a workshop paper (e.g., 1 type system + paper proofs + prototype)
  - Pair: Scope of a short conference paper (e.g., 1 type system + mechanized proofs + implementation + evaluation)
- **Team formation deadline:** Week 3
- **Contribution tracking:** Each milestone must include a contribution statement. Both team members must contribute meaningfully to both artifact development and writing.
- **Conflict resolution:** If team issues arise, contact the instructor immediately. Do not wait until the final report.
- **Cross-disciplinary pairs:** Pairs where one student has stronger implementation skills and the other has stronger theoretical or formalization skills often produce the best projects. Discuss complementary strengths in your team formation document.

---

## Timeline and Milestones

The capstone unfolds over the entire semester with four structured milestones. Each milestone builds on the previous one, and together they form the complete research arc from question formulation through final presentation.

| Week | Milestone | Weight | Deliverable |
|---|---|---|---|
| 5 | Problem Statement | 5% | 2-page proposal |
| 10 | Method + Preliminary Results | 10% | 4-page progress report |
| 15 | Full Draft | 10% | 8-page draft + peer review |
| 20 | Final Report + Presentation | 15% | 10-12 page report, 15-min talk, artifact |

See the individual milestone specification documents for detailed requirements:

- [Milestone 1: Problem Statement](milestone_1.md)
- [Milestone 2: Method + Preliminary Results](milestone_2.md)
- [Milestone 3: Full Draft](milestone_3.md)
- [Final Report](final_report.md)

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Novelty and Contribution** | 25% | The project addresses a genuine open question in type theory. The approach is not a trivial application of existing techniques. There is a clear intellectual contribution, whether theoretical, practical, or methodological. |
| **Technical Depth** | 25% | The type-theoretic content is rigorous. Typing rules are precisely stated. Metatheoretic claims are justified (by proof, formalization, or careful argument). Implementation is correct. The technical level is appropriate for a PhD course in type theory. |
| **Artifact Quality** | 25% | The artifact (implementation, formalization, or proof) is correct, well-structured, and usable. For implementations: the type checker works on non-trivial examples. For formalizations: the proofs are complete and well-organized. For theoretical work: proofs are detailed and verifiable. |
| **Writing and Presentation** | 25% | The paper is clear, well-organized, and follows PL community conventions (inference rules, operational semantics notation, etc.). Figures aid understanding. The presentation is engaging, clearly explains the contribution, and handles questions well. |

### Grade Descriptors

- **A (90-100%):** A genuinely novel contribution with rigorous technical content and a polished artifact. The paper could be submitted to a PL workshop with minimal revision. The presentation demonstrates deep understanding of both the specific topic and its place in the broader type theory landscape.
- **B (80-89%):** A solid project with a clear contribution. Technical content is mostly rigorous. The artifact works. Writing is good. Minor gaps in novelty, formalism, or evaluation.
- **C (70-79%):** The project has some merit but the contribution is limited. Technical content may have gaps. The artifact is incomplete or has issues. Writing is adequate. The work would benefit from significant revision.
- **D/F (<70%):** The project lacks a clear contribution. Technical content is superficial or incorrect. The artifact is missing or broken. Writing is poor. Milestones were missed.

---

## Code Repository and Artifact Requirements

### For Implementation Projects

Your repository must include:

```
project/
    README.md              # Setup, build, run, reproduce
    src/                   # Source code
        syntax/            # AST, surface syntax
        typing/            # Type checker, type inference
        evaluation/        # Interpreter, normalizer
        elaboration/       # Surface-to-core translation (if applicable)
    examples/              # Example programs demonstrating the type system
        well_typed/        # Programs that should type-check
        ill_typed/         # Programs that should be rejected
        benchmarks/        # Performance benchmarks (if applicable)
    tests/                 # Automated test suite
    paper/                 # LaTeX source for the report
```

### For Formalization Projects

Your repository must include:

```
project/
    README.md              # How to check the formalization
    src/                   # Lean/Coq/Agda source files
        Syntax.lean        # (or .v, .agda) Language definitions
        Typing.lean        # Typing rules
        Metatheory.lean    # Metatheoretic results
    paper/                 # LaTeX source for the report
```

### For Theoretical Projects

Your repository must include:

```
project/
    README.md              # Project description and paper compilation instructions
    paper/                 # LaTeX source for the report
        main.tex
        references.bib
        figures/
    proofs/                # Detailed proof documents (if separate from the paper)
    supplementary/         # Any supporting code, calculations, or counterexamples
```

### Repository Standards

- Include a `README.md` with one-paragraph project description, setup instructions, and instructions for reproducing key results.
- No hardcoded paths. Use relative paths and configuration.
- Include a dependency specification (e.g., `lake-manifest.json` for Lean, `_CoqProject` for Coq, stack/cabal file for Haskell, `dune-project` for OCaml).
- Automated tests that can be run with a single command.
- The artifact should build and run on a standard machine without extraordinary setup.
- Include a `.gitignore` file appropriate for your language and tools.
- Tag your final submission commit (e.g., `git tag v1.0-final`).

---

## Evaluation Criteria by Project Type

Different project types are evaluated with different emphases, though all projects must meet a minimum standard across all criteria.

### Type System Design Projects

The primary evaluation criteria are:

1. **Formal presentation:** Typing rules must be presented precisely using standard inference rule notation. The syntax, type structure, and operational semantics must be well-defined.
2. **Metatheory:** At minimum, state the key metatheoretic properties (type safety, decidability). Paper proofs of the main results are expected. Mechanized proofs are a bonus.
3. **Implementation:** A prototype type checker that demonstrates the type system on representative examples. The type checker must accept well-typed programs and reject ill-typed ones with informative error messages.
4. **Motivation and examples:** Concrete examples demonstrating why the type system feature is useful and what it prevents.

### Formalization Projects

The primary evaluation criteria are:

1. **Completeness:** The formalization should cover the stated results without `sorry`/`admit`. Partial formalizations are acceptable if the gaps are clearly documented and justified.
2. **Clarity:** The formalization should be readable. Good naming, comments, and modular structure are essential.
3. **Insights:** The report should discuss what was learned from the formalization process: hidden assumptions, proof strategies that did or did not work, and generalizations revealed by the formalization.
4. **Comparison:** Compare your formalization against paper proofs and/or other formalizations. Discuss the trade-offs of your approach.

### Implementation and Empirical Projects

The primary evaluation criteria are:

1. **Correctness:** The implementation must be correct on a comprehensive test suite.
2. **Evaluation rigor:** Benchmarks, comparisons, or user studies must follow sound experimental methodology.
3. **Analysis depth:** Do not merely report numbers. Explain why the results are what they are. Identify patterns and trade-offs.
4. **Reproducibility:** Another researcher should be able to reproduce your results from your artifact and report.

---

## Resources

### Compute

Most type theory projects are not compute-intensive. If your project involves large-scale benchmarking or proof search, discuss compute needs with the instructor.

### LaTeX Template

Use the ACM SIGPLAN two-column format (PACMPL style) or the LIPIcs format for your report. Download from the course website or use the Overleaf template linked on the syllabus.

### Office Hours

The instructor and TAs hold dedicated capstone office hours (check the course calendar). Use these for:

- Discussing project ideas and scope
- Working through metatheoretic proofs
- Debugging type checker implementations
- Getting feedback on formalizations
- Getting feedback on writing

### Literature

- Use Semantic Scholar, Google Scholar, DBLP, and the ACM Digital Library to find relevant papers.
- The course reading list covers foundational work; you are expected to go deeper for your specific topic.
- Read at least 15-20 papers relevant to your project.
- Pay particular attention to papers from POPL, ICFP, OOPSLA, PLDI, LICS, and TYPES.

### Suggested Reading by Topic Area

The following references provide entry points for each topic area. These are not exhaustive; you are expected to find additional papers relevant to your specific project.

**Gradual typing:**
- Siek and Taha, "Gradual Typing for Functional Languages" (Scheme Workshop, 2006)
- Wadler and Findler, "Well-Typed Programs Can't Be Blamed" (ESOP, 2009)
- New and Licata, "Call-by-Name Gradual Type Theory" (FSCD, 2018)
- Lennon-Bertrand, Maillard, Tabareau, and Tanter, "Gradualizing the Calculus of Inductive Constructions" (TOPLAS, 2022)

**Substructural types:**
- Walker, "Substructural Type Systems" (in Advanced Topics in Types and Programming Languages, 2005)
- Bernardy, Boespflug, Newton, Peyton Jones, and Spiwack, "Linear Haskell" (POPL, 2018)
- Orchard, Liepelt, and Eades, "Quantitative Program Reasoning with Graded Modal Types" (ICFP, 2019)
- Honda, Vasconcelos, and Kubo, "Language Primitives and Type Discipline for Structured Communication-Based Programming" (ESOP, 1998)

**Dependent types and verification:**
- Martin-Lof, "Intuitionistic Type Theory" (Bibliopolis, 1984)
- Norell, "Dependently Typed Programming in Agda" (AFP, 2008)
- Vazou, Seidel, Jhala, Vytiniotis, and Peyton Jones, "Refinement Types for Haskell" (ICFP, 2014)
- Cohen, Coquand, Huber, and Mortberg, "Cubical Type Theory" (2015)

**Effect systems:**
- Plotkin and Pretnar, "Handlers of Algebraic Effects" (ESOP, 2009)
- Bauer, "An Effect System for Algebraic Effects and Handlers" (LMCS, 2015)
- Petricek, Orchard, and Mycroft, "Coeffects: A Calculus of Context-Dependent Computation" (ICFP, 2014)

**Type inference:**
- Dunfield and Krishnaswami, "Complete and Easy Bidirectional Typechecking for Higher-Rank Polymorphism" (ICFP, 2013)
- Serrano, Hage, Vytiniotis, and Peyton Jones, "A Quick Look at Impredicativity" (ICFP, 2020)
- Vytiniotis, Peyton Jones, and Schrijvers, "OutsideIn(X): Modular Type Inference with Local Assumptions" (JFP, 2011)

**Mechanized metatheory:**
- Aydemir et al., "Mechanized Metatheory for the Masses: The POPLmark Challenge" (TPHOLs, 2005)
- Abel and others, "POPLMark Reloaded: Mechanizing Proofs by Logical Relations" (JFP, 2019)
- Chlipala, "Certified Programming with Dependent Types" (MIT Press, 2013)

### Proof Assistant Resources

If your project involves mechanized formalization:

- **Lean 4:** Mathematics in Lean tutorial, Lean 4 documentation, Mathlib4 source for examples of large-scale formalization
- **Coq:** Software Foundations series (Pierce et al.), Certified Programming with Dependent Types (Chlipala), the Coq reference manual
- **Agda:** Programming Language Foundations in Agda (Wadler and Kokke), the Agda standard library and documentation

### Writing Resources

Writing a technical PL paper requires specific skills:

- **Inference rule typesetting:** Use the `mathpartir` LaTeX package for inference rules. Consult any recent POPL or ICFP paper for style conventions.
- **Proof presentation:** Follow the conventions in Pierce's TAPL or Harper's PFPL for presenting proofs (theorem statement, proof sketch, key cases).
- **Example program formatting:** Use `lstlisting` or `minted` for code examples. Ensure syntax highlighting is consistent.
- **Figure quality:** Use TikZ or Ipe for diagrams. Avoid screenshots of handwritten diagrams.

The course website includes a writing guide with PL-specific advice on structuring a type theory paper.

---

## Academic Integrity

- All team members must contribute meaningfully.
- Code and formalizations may build on open-source implementations, but all novel contributions must be your own. Cite everything you use.
- Your report must be original writing. LLM-assisted editing is permitted; LLM-generated technical content is not.
- Collaboration between teams is limited to discussion. Do not share code, proofs, or formalizations across teams.
- If your project involves human subjects (e.g., a user study of type error messages), consult the instructor about IRB requirements.

---

## FAQ

**Q: Can I continue work I started before this course?**
A: Yes, but you must clearly delineate what was done before vs. during the course. Only work done during the course will be graded. Disclose prior work in your proposal.

**Q: Can I use my capstone for my thesis?**
A: Absolutely. Many students use the capstone as a starting point for thesis research. However, the graded deliverables must be self-contained.

**Q: Do I need to mechanize my proofs?**
A: Not necessarily. Paper proofs are acceptable if they are detailed and rigorous. Mechanized proofs are a significant bonus and will be rewarded in the grading.

**Q: What if my initial idea does not work?**
A: This is normal in research. The milestones are designed to catch this early. Pivoting is acceptable and expected. Document what you tried and why you changed direction. Negative results, if well-analyzed, are valuable.

**Q: What proof assistant should I use for formalization projects?**
A: Lean 4, Coq, and Agda are all excellent choices. Choose the one you are most comfortable with or most interested in learning. Discuss with the instructor if you are unsure.

**Q: Can I publish my capstone work?**
A: Yes, and you are encouraged to do so. The instructor is happy to advise on venue selection and revision.

**Q: How formal do my typing rules need to be?**
A: Typing rules should be presented in standard inference rule notation (horizontal line, premises above, conclusion below, rule name to the right). If you are unsure about the notation, consult TAPL or any recent POPL/ICFP paper. Your rules should be precise enough that another researcher could implement a type checker from them.

**Q: What if I want to work on something not on the suggested topics list?**
A: You are encouraged to propose your own topic. The suggested topics are starting points, not a closed list. Discuss your idea with the instructor during office hours before committing to it.

**Q: Is it better to prove fewer results rigorously or more results informally?**
A: Quality over quantity. One rigorously proved theorem (especially if mechanized) is worth more than five hand-wavy arguments. However, a project with only one trivial result is insufficient regardless of proof quality.

**Q: How do I know if my project has enough type-theoretic depth?**
A: Ask yourself: does my project require understanding concepts from this course (type safety, bidirectional checking, dependent types, normalization, substructural reasoning, etc.)? If your project could be completed without taking this course, it likely lacks depth. Discuss with the instructor if unsure.
