---
title: "Mini-Project 1: Bidirectional Type Checker"
tags:
  - type-theory
  - project
---
# Mini-Project 1: Bidirectional Type Checker

**Course:** Type Theory (PhD Track)
**Due:** Week 8
**Weight:** 10% of final grade
**Format:** Individual

---

## Overview

In this project, you will design and implement a bidirectional type checker for a language that extends the simply typed lambda calculus (STLC) with subtyping, records, and let-bindings. Bidirectional type checking is the workhorse of modern type checker implementations, and building one from scratch is the most effective way to understand the subtle interplay between type synthesis (inferring a type from a term) and type checking (verifying that a term has a given type).

Your implementation must handle a non-trivial surface language that includes functions, pairs, records with width and depth subtyping, and let-bindings with local type inference. You will also implement meaningful error reporting, because a type checker that simply says "type error" is useless in practice.

Beyond the implementation, you will conduct an ablation study comparing your bidirectional type checker against a purely syntax-directed type checking algorithm to understand the practical advantages of bidirectional type checking in terms of annotation burden, error message quality, and implementation complexity.

---

## Objectives

1. Implement a bidirectional type checking algorithm with clearly separated synthesis and checking modes, following the judgmental methodology of Dunfield and Krishnaswami (2021).
2. Design and implement a subtyping relation for a language with function types, product types, record types, and a top type, ensuring the relation is decidable and algorithmically tractable.
3. Support records with width subtyping (a record with more fields is a subtype of one with fewer) and depth subtyping (a record is a subtype if its fields are subtypes at corresponding labels).
4. Implement let-bindings with local type inference, allowing the type of the bound expression to be synthesized and propagated into the body without explicit annotation.
5. Design a structured error reporting system that produces human-readable error messages indicating the source location, expected type, actual type, and context of each type error.
6. Conduct a controlled comparison between bidirectional and syntax-directed type checking on a suite of test programs, measuring annotation burden and error quality.
7. Write a clear technical report analyzing your design decisions, the trade-offs inherent in bidirectional type checking, and the results of your comparison.

---

## Technical Requirements

### Language Specification

Your language must support the following constructs:

#### Types

```
T ::= Int                     -- integer base type
    | Bool                    -- boolean base type
    | T -> T                  -- function types
    | T * T                   -- pair types
    | {l_1 : T_1, ..., l_n : T_n}  -- record types
    | Top                     -- top type (supertype of all types)
```

#### Terms

```
e ::= x                      -- variables
    | n                      -- integer literals
    | true | false           -- boolean literals
    | \x. e                  -- lambda abstraction (unannotated)
    | \(x : T). e            -- lambda abstraction (annotated)
    | e e                    -- application
    | (e, e)                 -- pair construction
    | fst e | snd e          -- pair projections
    | {l_1 = e_1, ..., l_n = e_n}  -- record construction
    | e.l                    -- record projection
    | let x = e in e         -- let-binding (unannotated)
    | let (x : T) = e in e   -- let-binding (annotated)
    | (e : T)                -- type annotation / ascription
    | if e then e else e     -- conditional
```

#### Subtyping Rules

Implement the following subtyping relation:

- **Reflexivity:** `T <: T` for all types `T`.
- **Top:** `T <: Top` for all types `T`.
- **Function contravariance/covariance:** `S1 -> S2 <: T1 -> T2` if `T1 <: S1` and `S2 <: T2`.
- **Pair covariance:** `S1 * S2 <: T1 * T2` if `S1 <: T1` and `S2 <: T2`.
- **Record width subtyping:** `{l_1 : T_1, ..., l_n : T_n, l_{n+1} : T_{n+1}, ...} <: {l_1 : T_1, ..., l_n : T_n}` (more fields is a subtype of fewer fields).
- **Record depth subtyping:** `{l_1 : S_1, ..., l_n : S_n} <: {l_1 : T_1, ..., l_n : T_n}` if `S_i <: T_i` for all `i`.
- **Transitivity:** If `S <: T` and `T <: U` then `S <: U`. You may implement this algorithmically (i.e., transitivity need not be a rule in your algorithm, but the algorithm must be sound and complete with respect to a declarative system that includes transitivity).

### Bidirectional Type Checking

Your type checker must implement two mutually recursive judgments:

- **Synthesis (inference):** `G |- e => T` -- given a context `G` and a term `e`, synthesize a type `T`.
- **Checking:** `G |- e <= T` -- given a context `G`, a term `e`, and a type `T`, verify that `e` has type `T`.

The following rules specify which mode applies to which construct:

| Construct | Mode | Rationale |
|---|---|---|
| Variables | Synthesize | Look up in context |
| Integer/Boolean literals | Synthesize | Type is known |
| Annotated lambda `\(x:T).e` | Synthesize | Annotation provides domain type |
| Unannotated lambda `\x.e` | Check | Needs a function type to check against |
| Application `e1 e2` | Synthesize | Synthesize `e1`, check `e2` against domain |
| Pair `(e1, e2)` | Check | Needs a product type to check against |
| Projections `fst e`, `snd e` | Synthesize | Synthesize `e`, extract component type |
| Record `{l=e, ...}` | Check | Needs a record type to check against |
| Record projection `e.l` | Synthesize | Synthesize `e`, look up label |
| Let-binding `let x=e1 in e2` | Both | Synthesize `e1`, then infer or check `e2` |
| Annotation `(e : T)` | Synthesize | The annotation itself provides the type |
| Conditional `if e1 then e2 else e3` | Both | Check `e1` against Bool, branches inherit mode |

The crucial switching rule is the **subsumption** rule: when checking a term `e` against type `T`, if `e` synthesizes type `S` and `S <: T`, then `e` checks against `T`. This is the only point where subtyping enters the checking algorithm.

### Error Reporting

Your type checker must produce structured error messages that include:

- **Location information:** At minimum, a description of the subexpression where the error occurred. If you implement a parser, include line and column numbers.
- **Expected vs. actual:** When a type mismatch occurs, report what type was expected and what type was found.
- **Context:** Report the relevant portion of the typing context (which variables are in scope and their types).
- **Error classification:** Distinguish between at least the following error kinds:
  - Unbound variable
  - Type mismatch (expected T1, got T2)
  - Not a function (attempt to apply a non-function)
  - Not a record / missing field
  - Cannot synthesize type (e.g., unannotated lambda in synthesis position)
  - Subtyping failure (S is not a subtype of T)

You must include a test suite of at least 15 programs that trigger different error conditions and demonstrate the quality of your error messages.

### Ablation: Bidirectional vs. Syntax-Directed

Implement a second type checking algorithm that is purely syntax-directed (requiring explicit type annotations on all lambda abstractions, let-bindings, and other constructs where bidirectional checking would normally propagate types). This syntax-directed checker should be a straightforward recursive descent over the annotated AST.

Using a shared test suite of at least 20 programs (ranging from simple to moderately complex), compare:

1. **Annotation burden:** Count the number of type annotations required by each algorithm. Compute the ratio of annotation tokens to total tokens.
2. **Error message quality:** For programs containing type errors, compare the error messages produced by each algorithm. Rate them on a scale of 1-5 for specificity, accuracy, and helpfulness.
3. **Implementation complexity:** Compare the two implementations in terms of lines of code, number of cases, and conceptual difficulty.
4. **Type inference power:** Identify programs that the bidirectional checker accepts with fewer annotations than the syntax-directed checker. Characterize the patterns where bidirectional checking is most beneficial.

### Implementation Language

You may implement your type checker in any language. Recommended choices include:

- **OCaml or Haskell:** Natural fit for this kind of work due to algebraic data types and pattern matching.
- **Rust:** If you want to explore ownership-based error handling alongside type theory.
- **Python or TypeScript:** Acceptable if you are more comfortable, but you must pay attention to code quality and structure.

You must implement the type checker from scratch. Using an existing type checking library or framework (e.g., a bidirectional type checking library from a PL course) is not permitted.

### Evaluation

Your type checker will be evaluated on:

- **Correctness:** A suite of instructor-provided test programs (released after submission) will be run through your checker. Your checker must correctly accept well-typed programs and reject ill-typed programs.
- **Error quality:** The error messages for ill-typed programs will be evaluated for informativeness.
- **Subtyping completeness:** Your subtyping algorithm must be sound and complete with respect to the declarative subtyping rules specified above.
- **Performance:** Your type checker should handle programs of up to 500 lines in under 5 seconds. This is not a demanding requirement and is primarily to ensure there are no pathological performance issues.

---

## Deliverables

### Report

- **Format:** LaTeX, 8 pages max (excluding references and appendix)
- **Template:** Use the ACM SIGPLAN two-column format or a comparable PL-community template
- **Required sections:**
  1. **Abstract** (150 words max): Summarize the language, the type checking algorithm, and the key findings of your comparison.
  2. **Introduction:** Motivate bidirectional type checking. Why is it preferable to fully explicit annotation or full Hindley-Milner inference for languages with subtyping?
  3. **Language definition:** Formal syntax and typing rules. Present the declarative typing rules and the bidirectional algorithmic rules. Discuss the relationship between them.
  4. **Subtyping:** Present the subtyping relation and its algorithmic formulation. Discuss decidability and termination of the subtyping algorithm.
  5. **Implementation:** Describe the key implementation decisions: representation of types, contexts, error handling strategy, AST representation. Discuss any difficulties encountered.
  6. **Comparison:** Present the results of your bidirectional vs. syntax-directed comparison. Include tables, code examples, and quantitative measurements of annotation burden.
  7. **Error reporting:** Discuss your error reporting strategy. Show examples of error messages for representative error conditions.
  8. **Related work:** Situate your work relative to Pierce's TAPL treatment, Dunfield and Krishnaswami's tutorial, and other relevant implementations.
  9. **Conclusion:** Summarize findings and discuss extensions (e.g., polymorphism, union types, refinement types).

### Code

- **Repository:** A clean repository with a README containing:
  - Build and run instructions
  - Description of the source file organization
  - Instructions for running the test suite
  - Instructions for running the comparison experiment
- **Source code:** Well-organized, with comments explaining non-obvious design decisions
- **Test suite:** At least 40 test programs:
  - 20 well-typed programs exercising all language features
  - 15 ill-typed programs exercising all error conditions
  - 5 programs used for the annotation burden comparison
- **Executable:** The type checker must be runnable from the command line, accepting a source file and producing either "well-typed: T" or a structured error message

---

## Milestones

### Week 6: Checkpoint (5% of project grade)

Submit a brief progress report (1 page) and evidence of a working prototype:

- Parser for the surface language (or a description of the AST representation if you are constructing ASTs directly)
- Type checker that handles at least STLC (functions and application) in bidirectional mode
- At least 5 passing test cases
- A brief description of your plan for adding subtyping, records, and error reporting

### Week 8: Final Submission (95% of project grade)

Submit the full report, code, and test suite as described above.

---

## Grading Rubric

| Component | Weight | Criteria |
|---|---|---|
| **Implementation Correctness** | 30% | The type checker correctly accepts well-typed programs and rejects ill-typed programs. Subtyping is sound and complete. The bidirectional algorithm is correctly structured with synthesis and checking modes. All language features are supported. |
| **Error Reporting** | 15% | Error messages are informative, specific, and correctly identify the source of the error. At least 5 distinct error categories are handled. Error messages include location, expected type, actual type, and context information. |
| **Comparison Study** | 20% | The bidirectional vs. syntax-directed comparison is well-designed and executed. Annotation burden is quantified. Error quality is compared. Conclusions are supported by evidence. |
| **Report Quality** | 25% | The report is clear, well-organized, and technically precise. Typing rules are presented using standard inference rule notation. The discussion of design decisions is thoughtful. Related work is appropriately cited. |
| **Code Quality** | 10% | Code is clean, well-organized, and documented. The test suite is comprehensive. Build and run instructions are clear. The repository is well-structured. |

### Grade Descriptors

- **A (90-100%):** Type checker is correct and handles all specified features. Error messages are genuinely helpful. The comparison study reveals non-obvious insights about bidirectional type checking. The report reads as a polished technical document with precise formal content.
- **B (80-89%):** Type checker works correctly for most features. Error messages are adequate. The comparison is present but may lack depth. The report is well-written with minor gaps.
- **C (70-79%):** Type checker handles basic features but may have issues with subtyping or records. Error messages are minimal. The comparison is superficial. The report is adequate but lacks precision.
- **D/F (<70%):** Type checker has significant correctness issues. Error messages are uninformative or missing. The comparison is absent or trivial. The report is incomplete or poorly written.

---

## Helpful Guidance

### Getting Started

1. Begin with STLC (just functions, application, and variables) in bidirectional mode. Get this working and tested before adding anything else.
2. Add type annotations and the subsumption rule. Verify that annotated lambdas synthesize and unannotated lambdas only check.
3. Add pairs and projections. This is straightforward once the bidirectional structure is in place.
4. Add records and subtyping together, as they interact closely. Start with width subtyping only, then add depth subtyping.
5. Add let-bindings and conditionals last, as they involve both modes.
6. Implement error reporting incrementally, not as an afterthought.

### Common Pitfalls

- **Forgetting the subsumption rule:** Without subsumption, your checker will reject programs where a subtype is provided where a supertype is expected. This manifests as mysterious "cannot check" errors.
- **Non-terminating subtyping:** If you implement transitivity as an explicit rule in your algorithmic subtyping, the algorithm may loop. Ensure transitivity is admissible (derivable from other rules) rather than an explicit algorithmic step.
- **Confusing synthesis and checking in let-bindings:** In `let x = e1 in e2`, the type of `e1` should be synthesized, then used to extend the context when processing `e2`. If the entire `let` is in checking mode, the checking type should be propagated to `e2`, not to `e1`.
- **Record label ordering:** Decide early whether your record types are ordered or unordered. If unordered, you need a canonical ordering or a set-based representation. This affects both subtyping and record construction checking.
- **Poor error recovery:** Do not let the first error crash the entire type checker. At minimum, report one error clearly. Ideally, attempt to continue and report multiple errors, though this is optional.

### Suggested Reading

- Dunfield and Krishnaswami, "Bidirectional Typing" (ACM Computing Surveys, 2021) -- the definitive tutorial
- Pierce, "Types and Programming Languages" (2002), Chapters 15-16 (subtyping), Chapter 9 (STLC)
- Pierce, "Types and Programming Languages" (2002), Chapter 11 (records)
- Cardelli, "Type Systems" (1996) -- foundational overview
- Chlipala, "Certified Programming with Dependent Types" (2013), Chapter 1 -- implementation patterns
- Dunfield and Pfenning, "Tridirectional Typechecking" (POPL, 2004)
- Peyton Jones, Vytiniotis, Weirich, and Shields, "Practical Type Inference for Arbitrary-Rank Types" (JFP, 2007) -- relevant context on type inference design
- Hazel project documentation (hazel.org) -- a modern bidirectional type checker in practice

### Example Programs

To give you a sense of the expected complexity, here are representative test programs:

**Simple function application (should type-check):**

```
let id = \(x : Int). x in
let apply = \(f : Int -> Int). \(x : Int). f x in
apply id 42
```

**Subtyping with records (should type-check):**

```
let point3d = {x = 1, y = 2, z = 3} in
let project : {x : Int, y : Int} -> Int = \(p : {x : Int, y : Int}). p.x in
project point3d
```

**Type error with good message (should fail with informative error):**

```
let f = \(x : Bool). x in
f 42
-- Expected error: Type mismatch in application of f.
--   Expected argument type: Bool
--   Actual argument type: Int
--   In expression: f 42
```

**Bidirectional advantage (should type-check without annotation on inner lambda):**

```
let apply : (Int -> Bool) -> Int -> Bool = \f. \x. f x in
apply (\x. if x then false else true) 42
-- Note: \f and \x do not need annotations because the
-- checking type (Int -> Bool) -> Int -> Bool propagates.
```

### Implementation Tips

- Represent types as algebraic data types (or sealed classes / tagged unions in your language of choice). Pattern matching on types is the bread and butter of a type checker.
- Represent the typing context as a list of (variable, type) pairs. Linear lookup is fine for this project's scale.
- Use a result/either type for error handling rather than exceptions. This makes error reporting composable and testable.
- Write property-based tests if your language supports them: generate random well-typed terms and verify the type checker accepts them; generate random ill-typed terms and verify rejection.
- Implement a pretty-printer for types early. You will need it constantly for debugging and for error messages.
- Consider implementing your subtyping relation as a separate function that returns either success or a structured explanation of why subtyping failed. This directly feeds into error reporting.

### Source File Organization

A recommended source file structure (adapt to your implementation language):

```
src/
    syntax.ml          # AST definitions for types and terms
    parser.ml          # Parser (optional; you may construct ASTs directly)
    context.ml         # Typing context operations
    subtyping.ml       # Subtyping relation
    bidir_checker.ml   # Bidirectional type checker (synthesis + checking)
    syntax_checker.ml  # Syntax-directed type checker (for comparison)
    errors.ml          # Error type definitions and pretty-printing
    pretty.ml          # Pretty-printer for types and terms
    main.ml            # Command-line entry point
tests/
    well_typed/        # .lam files that should type-check
    ill_typed/         # .lam files that should be rejected
    comparison/        # .lam files used for the annotation burden study
    run_tests.ml       # Test runner
```

### Extensions (Optional, for Extra Credit)

If you complete the core requirements and want to push further, consider:

- **Polymorphism:** Add universal types (System F style) and investigate how bidirectional checking interacts with type application and type abstraction.
- **Union types:** Add union types `T1 | T2` and investigate how they interact with subtyping and bidirectional checking. Union elimination is particularly interesting.
- **Recursive types:** Add equi-recursive or iso-recursive types. Equi-recursive types interact non-trivially with subtyping (the Amber rule).
- **Multiple error reporting:** Instead of stopping at the first error, attempt to continue type checking and report multiple errors. This is more useful in practice but significantly harder to implement correctly.

---

## Academic Integrity

- You must implement the type checker yourself. Using an existing bidirectional type checker implementation is not permitted.
- You may consult textbooks, tutorials, and papers for the theory. Cite anything you reference.
- You may use standard libraries for parsing, pretty-printing, and testing.
- Your report must be your own writing. LLM-assisted editing is permitted; LLM-generated technical content is not.

---

## Submission

Submit via the course portal by **Week 8, Friday 11:59 PM**:

1. Report as PDF (ACM SIGPLAN format or comparable)
2. Code as a zip archive or link to a private repository
3. Test suite included in the repository
4. A `README` with build, run, and testing instructions
