---
title: "How to Read Programming Language and Type Theory Papers"
tags:
  - type-theory
  - reference
---
# How to Read Programming Language and Type Theory Papers

A guide for PhD-track students on systematically reading, evaluating, and presenting research papers in programming languages and type theory.

---

## Table of Contents

1. [The Three-Pass Method for PL Papers](#the-three-pass-method-for-pl-papers)
2. [Evaluating Formal Claims and Proofs](#evaluating-formal-claims-and-proofs)
3. [Presenting Papers at a PL Seminar](#presenting-papers-at-a-pl-seminar)
4. [Paper Summary Template](#paper-summary-template)
5. [Common PL Paper Structures](#common-pl-paper-structures)
6. [Staying Current](#staying-current)
7. [Common Red Flags](#common-red-flags)
8. [Building PL Research Taste](#building-pl-research-taste)

---

## The Three-Pass Method for PL Papers

Reading a PL/type theory paper differs from reading an ML/systems paper. PL papers tend to be notation-heavy, proof-intensive, and rely on chains of formal definitions. A structured reading strategy is essential. The following three-pass method, adapted from Keshav's general approach, is tuned for PL research.

### Pass 1: Orientation (10-15 minutes)

**Goal:** Determine the paper's contribution and whether it merits deeper study.

Read only:

- Title, abstract, and introduction
- Section headings and the structure of the formal development
- Figures, particularly syntax definitions and key inference rules
- The main theorem statements (not proofs)
- Conclusion and future work

After Pass 1, answer:

- What is the language or calculus being studied?
- What is the main metatheoretic result? (Type safety? Normalization? Decidability? Expressiveness comparison?)
- Is this a new type system, a new proof technique, a mechanized formalization, or a language design paper?
- What are the key judgments? How many are there?
- Does the paper include an implementation, or is it purely theoretical?
- What existing systems or calculi does it build on? (System F? ML? Martin-Lof type theory? Linear logic?)

**Decision point:** Stop here if the paper's calculus is too far from your interests, the contribution is incremental, or the formalism is not well-motivated. Mark it for potential future reference.

### Pass 2: Comprehension (2-4 hours)

**Goal:** Understand the formal system and its properties without verifying every proof.

Read the full paper, but on the first pass through proofs, focus on proof structure rather than every detail. Concentrate on:

- **Syntax.** Write down the full grammar of terms, types, values, and evaluation contexts. Make sure you understand every syntactic category.
- **Judgments.** List all judgment forms. For each judgment, understand what it asserts, what its inputs are, and what its outputs are. For bidirectional systems, distinguish synthesis from checking judgments.
- **Typing rules.** Read every typing rule. For each rule, ask: what does this rule introduce or eliminate? What side conditions does it have? Which premises involve context extension?
- **Key definitions.** Identify the central definitions (e.g., the subtyping relation, the notion of equivalence, the reduction strategy). Understand these before reading the theorems.
- **Theorem statements.** For each theorem, understand precisely what it states. What are the hypotheses? What is the conclusion? Is the proof by induction, and if so, on what?
- **Proof strategy.** For the main theorems, read the first paragraph of each proof to understand the overall strategy (induction on derivations, case analysis, logical relations, etc.) without following every case.
- **Examples.** Work through any examples in the paper. If the paper does not include examples, construct your own.

Annotate as you go:

- Underline definitions that later theorems depend on.
- Mark typing rules you find surprising or non-standard.
- Write down any rule that seems to break a property you expected (e.g., a rule that is not syntax-directed).
- Note where the paper departs from standard presentations (e.g., TAPL, PFPL).
- Flag lemmas whose statements you do not fully understand.

### Pass 3: Verification (4-8 hours, reserved for essential papers)

**Goal:** Deeply internalize the paper by reconstructing its formal development.

Reserve this pass for papers central to your research or course work. You should:

- **Reconstruct the syntax and typing rules from scratch.** Close the paper and write down the grammar, judgment forms, and typing rules from memory. Compare with the paper. Discrepancies reveal gaps in your understanding.
- **Verify the key proofs.** Work through the main proofs on paper. For inductive proofs, check every case, not just the interesting ones. Verify that the induction hypothesis is strong enough. Check that lemmas used in the proof have been stated and proved.
- **Check the metatheory.** Verify that the standard lemmas hold: weakening, exchange, substitution, canonical forms. If the paper does not prove them, verify for yourself that they hold.
- **Test the boundary.** Construct terms that should be well-typed and verify they are. Construct terms that should be ill-typed and verify they are rejected. Try to find a term that the type system gets "wrong" (accepts when it should reject, or vice versa).
- **Compare with related systems.** How does this type system compare to the closest well-known system? What rules are added, removed, or modified? What metatheoretic properties change?
- **Assess the proof technique.** Is the proof technique standard (structural induction, logical relations) or novel? Could the result have been proved with a simpler technique? Does the proof technique generalize?

After Pass 3, you should be able to:

- Present the paper's type system and main results from memory.
- Explain why each typing rule is needed and what goes wrong without it.
- State and sketch the proof of the main theorem.
- Identify the key technical innovation and its limitations.

---

## Evaluating Formal Claims and Proofs

PL papers make formal claims (theorems, lemmas, corollaries) that are either proved in the paper, proved in a technical report, or claimed without proof. Evaluating these claims is a core skill.

### Hierarchy of Confidence

From highest to lowest confidence:

1. **Mechanized proof (Coq, Lean, Agda).** Machine-checked; the statement is exactly what was proved. Still verify that the formalized statement matches the informal claim.
2. **Detailed paper proof.** All cases are presented; lemmas are stated and proved. Check each case.
3. **Sketch with key cases.** "Interesting" cases are shown; routine cases are omitted. Verify the interesting cases and check that the routine cases are truly routine.
4. **"By standard techniques" or "straightforward induction."** No proof given. This is often correct but occasionally hides a subtle issue. If the system has non-standard features, be skeptical.
5. **Conjectured or "we believe."** No proof. Treat as an open problem.

### Checking Inductive Proofs

Most PL proofs are by induction. Common pitfalls:

- **Wrong induction measure.** The proof inducts on term structure but should induct on derivation depth, or vice versa. Check that the measure actually decreases in all cases.
- **Missing cases.** A proof by cases on the typing derivation must cover all rules. Verify that no rule is omitted. This is especially easy to miss when the system has many rules.
- **Induction hypothesis too weak.** The property to be proved must be stated generally enough that the induction hypothesis applies in all cases. A common fix is to generalize from closed terms to open terms with arbitrary contexts.
- **Substitution lemma gap.** Many proofs rely on a substitution lemma that is stated but not proved. If the system has unusual binding or unusual context behavior, the substitution lemma may not hold.
- **Implicit alpha-equivalence assumptions.** Proofs that manipulate bound variables often assume the Barendregt variable convention (bound variables are always fresh) without checking that this is valid.

### Checking Soundness Claims

A soundness claim typically states that well-typed programs do not exhibit a certain class of bad behavior. To evaluate:

- Check that "bad behavior" is precisely defined. What does "stuck" mean? Are there explicit error terms?
- Verify that progress covers all possible well-typed closed terms, not just a subset.
- Verify that preservation is stated for the correct reduction relation (small-step vs. big-step, CBV vs. CBN).
- Check whether the system has a fixpoint operator (general recursion). If so, type safety does not imply termination, and the progress theorem must account for divergence.

### Checking Decidability Claims

If the paper claims that type checking or type inference is decidable:

- Is an algorithm presented? Or is the claim based on reduction to a known decidable problem?
- If an algorithm is presented, is termination proved?
- Is the algorithm shown to be sound and complete with respect to the declarative system?
- What is the complexity? Is it practical?

---

## Presenting Papers at a PL Seminar

### Before the Presentation

- Complete at least Pass 2 of the paper.
- Read 2-3 of the most closely related papers cited in the introduction. You need to explain what problem existed before this paper and how prior approaches fell short.
- Implement the type system if feasible (even a toy subset). Nothing exposes gaps in understanding like implementation.
- Prepare a handout or slide with the complete syntax, typing rules, and main theorem statement. Attendees need this as reference.

### Structure of a 45-60 Minute Presentation

1. **Motivation (5-10 min).** What is the problem? Why is it hard? Give a concrete example of a program that the existing type systems cannot handle well. Do not start with formal definitions.

2. **Background and related work (5-10 min).** Briefly describe the relevant prior systems. What are their limitations? Use a running example to illustrate.

3. **The calculus (15-20 min).** Present the syntax, then the typing rules. Introduce the rules incrementally, starting with the standard ones and building up to the novel rules. For each novel rule, explain the intuition before writing the formal version. Type-check the running example step by step.

4. **Main results (10-15 min).** State the main theorems. Explain the proof strategy. Show the key case of the main proof in detail, but do not try to present all cases. Highlight where the proof differs from standard proofs.

5. **Discussion (5-10 min).** What are the limitations? What does the system not handle? How does it compare to alternatives? What would you change? What are the open problems?

### Common Mistakes in PL Paper Presentations

- Starting with formal definitions before the audience understands the problem.
- Showing all typing rules on one slide without building up.
- Skipping the syntax (the audience cannot read the rules without knowing the syntax).
- Presenting the proof by listing cases instead of explaining the key insight.
- Not having a running example.

---

## Paper Summary Template

Use this template for reading notes and course assignments.

```
Paper: [Full citation]
Read date: [Date]
Pass level: [1 / 2 / 3]

## Problem
What problem does the paper address? (1-2 sentences)

## Context
What prior work does this build on? What are the limitations of prior approaches?

## Calculus / System
- Language name (if any):
- Base system (what it extends): e.g., STLC, System F, CIC
- Key syntactic categories:
  Terms: ...
  Types: ...
  Values: ...
- Key judgment forms:
  - Gamma |- e : T (typing)
  - [others]
- Number of typing rules:
- Novel typing rules (list and explain):

## Main Results
- Theorem 1: [Statement] -- Proof technique: [induction on X / logical relations / ...]
- Theorem 2: ...
- Mechanized? [Yes (in Coq/Lean/Agda) / No]

## Key Insight
What is the single most important idea? (1-2 sentences)

## Limitations
What does the system not handle? What assumptions are made?

## Connections
- Related to [Paper X] because ...
- Extends [Paper Y] by ...
- Superseded by [Paper Z] because ...

## Questions / Criticisms
- [Open questions or concerns about the paper]

## Implementation Notes
- Could this be implemented in OCaml? Difficulty estimate: [easy / moderate / hard]
- Key data structures needed: [AST, context, unifier, ...]
```

---

## Common PL Paper Structures

Understanding the typical structure of PL papers helps you navigate them efficiently.

### Type System Paper (most common)

1. Introduction and motivation
2. Informal overview with examples
3. Syntax of the calculus
4. Statics (typing rules)
5. Dynamics (operational semantics)
6. Type safety (progress and preservation)
7. Extensions or additional properties
8. Related work
9. Conclusion

### Type Inference Paper

1. Introduction
2. Declarative type system
3. Algorithmic type system / constraint generation
4. Constraint solving / unification
5. Soundness and completeness of the algorithm with respect to the declarative system
6. Principal types / most general solutions
7. Implementation and practical considerations
8. Related work

### Proof Technique Paper

1. Introduction and the property to be proved
2. Review of the standard approach and its limitations
3. The new proof technique (definitions, key lemma)
4. Application to the target system
5. Generalization to other systems
6. Related work

### Language Design Paper

1. Introduction and design goals
2. Tour of the language with examples
3. Formal core calculus (often a subset)
4. Type system and metatheory for the core
5. Elaboration from the surface language to the core
6. Implementation
7. Case studies or evaluation
8. Related work

### Mechanized Formalization Paper

1. Introduction
2. Informal overview of the formalized result
3. Key design decisions in the formalization (representation of binding, treatment of metatheory)
4. Highlights of the formalization (interesting lemmas, unexpected difficulties)
5. Statistics (lines of code, proof effort)
6. Lessons learned
7. Related work

---

## Staying Current

### Primary Venues for PL and Type Theory

**Conferences (in approximate order of relevance):**

- POPL (Principles of Programming Languages) -- the premier PL theory venue
- ICFP (International Conference on Functional Programming) -- functional programming and type systems
- PLDI (Programming Language Design and Implementation) -- more implementation-oriented
- OOPSLA (Object-Oriented Programming, Systems, Languages, and Applications) -- broader PL and software engineering
- LICS (Logic in Computer Science) -- logic and type theory foundations
- ESOP (European Symposium on Programming) -- PL theory, co-located with ETAPS
- CSL (Computer Science Logic) -- proof theory and type theory
- FSCD (Formal Structures for Computation and Deduction) -- rewriting, lambda calculus, type theory
- CPP (Certified Programs and Proofs) -- mechanized formalization

**Journals:**

- Journal of Functional Programming (JFP)
- ACM Transactions on Programming Languages and Systems (TOPLAS)
- Information and Computation
- Journal of the ACM (JACM)
- Logical Methods in Computer Science (LMCS)
- Mathematical Structures in Computer Science (MSCS)

**Workshops (for early-stage work):**

- TyDe (Type-Driven Development)
- HOPE (Higher-Order Programming with Effects)
- ML Workshop
- Haskell Symposium
- OCaml Workshop

### Staying Up to Date

- Subscribe to the TYPES mailing list (types-announce) for announcements in type theory.
- Follow the SIGPLAN newsletter for PL conference announcements.
- Monitor arXiv cs.PL and cs.LO for preprints.
- Read the proceedings of POPL and ICFP each year. At minimum, read the titles and abstracts of all accepted papers; read fully those in your area.
- Attend or watch recorded talks from the PL summer schools (OPLSS, PLMW, DeepSpec).
- Follow researchers in your area on their personal websites; many post preprints and talk slides.

### Building a Personal Reading Queue

- Maintain a bibliography file (BibTeX or Zotero) organized by topic.
- For each paper you read, record the pass level (1, 2, or 3) and a one-sentence summary.
- When you encounter a paper cited frequently by multiple authors, prioritize reading it.
- When starting a new topic, begin with the survey or tutorial paper, then read the foundational papers, then read the recent advances.

---

## Common Red Flags

### In the Formalism

- **Missing cases in proofs.** If the paper says "the other cases are similar" for more than half the cases, the omitted cases may not all be routine.
- **Type system is not syntax-directed.** If the typing rules include a subsumption rule or a rule with no term constructor in the conclusion, the system is not directly implementable as stated. Check whether the paper addresses algorithmic type checking.
- **No canonical forms lemma.** If progress is claimed without stating canonical forms, the proof may be incomplete.
- **Unusual binding structure.** If the calculus has non-standard binding (e.g., mutually recursive bindings, pattern-matching binders), check that the metatheory correctly handles all binding cases.
- **Unification used without occurs check.** If the paper uses unification and does not mention the occurs check, infinite types may sneak in.
- **Claims about decidability without a termination argument.** An algorithm is decidable only if it terminates. If the paper presents an inference algorithm but does not prove termination, the decidability claim is incomplete.

### In the Evaluation

- **No implementation.** A type system paper without an implementation is like a drug without clinical trials. The system may be sound but impractical.
- **Toy examples only.** If the paper only shows tiny examples (3-5 line programs), it is unclear whether the system scales.
- **Comparison with weak baselines.** If the paper compares only against simple types or basic Hindley-Milner, the comparison may be misleading. Check whether the paper compares against the state of the art.
- **No discussion of annotation burden.** If the type system requires annotations, how many? A system that is sound and complete but requires annotations on every subterm is not a practical advance.

### In the Writing

- **Notation introduced but not used consistently.** If the paper switches between notations for the same concept, the formalism may not be fully worked out.
- **Claim of novelty without adequate related work.** If the related work section is short and does not cite the standard references in the area, the authors may be unaware of prior work.
- **"We have proved this in Coq but do not include the proofs here."** This is acceptable if the Coq development is publicly available. If it is not available, this claim should be treated with skepticism.

---

## Building PL Research Taste

### What Makes a Good PL Paper

- **The right abstraction.** The best PL papers identify the right level of abstraction for a problem. A type system that is too weak is useless; one that is too strong is undecidable. The art is finding the sweet spot.
- **Clean metatheory.** A type system with simple, elegant metatheoretic properties (progress, preservation, decidable type checking, principal types) is more compelling than one with complex side conditions.
- **Practical relevance.** Does the type system help real programmers? Does it prevent real bugs? Does it enable real optimizations?
- **Generality.** Does the technique generalize beyond the specific system in the paper? The best papers introduce techniques that are reused across many subsequent papers.

### Developing Intuition

- Implement type systems. Start with the simply typed lambda calculus, then add features incrementally (let-polymorphism, subtyping, recursive types, dependent types). Each feature you implement deepens your understanding of the design space.
- For each type system you study, understand what it prevents (what ill-typed programs are rejected), what it permits (what well-typed programs are accepted), and what it cannot express (what valid programs are rejected by the type system).
- Study the design decisions of real languages (OCaml, Haskell, Rust, Lean). Why did the designers make the choices they did? What trade-offs were involved?
- Read the classic papers in the field (Church, Curry, Milner, Girard, Reynolds, Martin-Lof). These papers shaped the vocabulary and conceptual framework of the entire field. You will see their ideas echoed in every modern paper.
