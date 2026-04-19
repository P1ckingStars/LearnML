# Syllabus: Compilers & Programming Languages -- Theory, Implementation, and Frontiers

## Course Information

- **Duration**: 22 weeks (1 semester) + pre-work
- **Lectures**: 2 x 75 min per week
- **Recitation**: 1 x 50 min per week
- **Office Hours**: 2 x 60 min per week
- **Prerequisites**: See [PREREQUISITES.md](PREREQUISITES.md)

## Grading

| Component | Weight |
|-----------|--------|
| Homeworks (12) | 40% |
| Mini-Project 1 | 10% |
| Mini-Project 2 | 10% |
| Capstone Project | 30% |
| Paper Presentations | 10% |

**Late Policy**: 3 free late days total across all homeworks. After that, 20% penalty per day. No late submissions for projects.

---

## Pre-Work (Before Week 1)

### Module 00: Mathematical & CS Foundations

Complete before the semester begins. Self-paced, ~2 weeks.

| Day | Topic | Materials |
|-----|-------|-----------|
| -- | Formal Languages & Automata Theory | [Lecture 00a](modules/00_foundations/lecture_00a_formal_languages.md) |
| -- | Discrete Math for Compilers | [Lecture 00b](modules/00_foundations/lecture_00b_discrete_math_review.md) |
| -- | **HW0 Due: First day of class** | [HW0: Foundations Diagnostic](modules/00_foundations/hw00_foundations_diagnostic.md) |

---

## Weeks 1-2: Lexical Analysis

### Module 01: Regular Expressions, Automata, and Scanner Construction

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 1 | Mon | Regular Expressions & Automata | [Lecture 01a](modules/01_lexical_analysis/lecture_01a_regular_expressions_automata.md) |
| 1 | Wed | Scanner Construction | [Lecture 01b](modules/01_lexical_analysis/lecture_01b_scanner_construction.md) |
| 1 | Fri | *Recitation: Scanner Implementation* | [Recitation 01](modules/01_lexical_analysis/recitation_01_scanner_implementation.md) |
| 2 | Mon | Formal Language Theory in Depth | [Lecture 01c](modules/01_lexical_analysis/lecture_01c_formal_language_theory_depth.md) |
| 2 | Wed | Lexer Optimization & Engineering | [Lecture 01d](modules/01_lexical_analysis/lecture_01d_lexer_optimization.md) |
| 2 | Fri | **HW1 Due** | [HW1: Lexical Analysis](modules/01_lexical_analysis/hw01_lexical_analysis.md) |

**Readings**: Thompson (1968), Hopcroft (1971), Cox "Regular Expression Matching Can Be Simple And Fast"

---

## Weeks 3-4: Parsing

### Module 02: Context-Free Grammars, LL/LR Parsing, Error Recovery

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 3 | Mon | Context-Free Grammars & Parse Trees | [Lecture 02a](modules/02_parsing/lecture_02a_context_free_grammars.md) |
| 3 | Wed | Top-Down Parsing | [Lecture 02b](modules/02_parsing/lecture_02b_top_down_parsing.md) |
| 3 | Fri | *Recitation: Parser Construction* | [Recitation 02](modules/02_parsing/recitation_02_parser_construction.md) |
| 4 | Mon | Bottom-Up Parsing | [Lecture 02c](modules/02_parsing/lecture_02c_bottom_up_parsing.md) |
| 4 | Wed | Error Recovery & Practical Parsing | [Lecture 02d](modules/02_parsing/lecture_02d_error_recovery_practical.md) |
| 4 | Fri | **HW2 Due** | [HW2: Parsing](modules/02_parsing/hw02_parsing.md) |

**Readings**: Knuth (1965), DeRemer (1969), Ford (2004)

---

## Weeks 5-6: Semantic Analysis

### Module 03: Symbol Tables, Type Checking, Type Inference

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 5 | Mon | Symbol Tables & Scope | [Lecture 03a](modules/03_semantic_analysis/lecture_03a_symbol_tables_scope.md) |
| 5 | Wed | Type Checking | [Lecture 03b](modules/03_semantic_analysis/lecture_03b_type_checking.md) |
| 5 | Fri | *Recitation: Type Checker Implementation* | [Recitation 03](modules/03_semantic_analysis/recitation_03_type_checker.md) |
| 6 | Mon | Type Inference | [Lecture 03c](modules/03_semantic_analysis/lecture_03c_type_inference.md) |
| 6 | Wed | Advanced Type Systems | [Lecture 03d](modules/03_semantic_analysis/lecture_03d_advanced_type_systems.md) |
| 6 | Fri | **HW3 Due** | [HW3: Semantic Analysis](modules/03_semantic_analysis/hw03_semantic_analysis.md) |

**Capstone Milestone 1 Due: End of Week 5** -- [Problem Statement](projects/capstone/milestone_1.md)

**Readings**: Milner (1978), Damas & Milner (1982), Cardelli & Wegner (1985)

---

## Weeks 7-8: Type Theory & PL Foundations

### Module 04: Lambda Calculus, Curry-Howard, Semantics

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 7 | Mon | Lambda Calculus | [Lecture 04a](modules/04_type_theory_pl/lecture_04a_lambda_calculus.md) |
| 7 | Wed | Operational Semantics | [Lecture 04b](modules/04_type_theory_pl/lecture_04b_operational_semantics.md) |
| 7 | Fri | *Recitation: Lambda Calculus & Proofs* | [Recitation 04](modules/04_type_theory_pl/recitation_04_lambda_proofs.md) |
| 8 | Mon | The Curry-Howard Correspondence | [Lecture 04c](modules/04_type_theory_pl/lecture_04c_curry_howard.md) |
| 8 | Wed | Denotational & Axiomatic Semantics | [Lecture 04d](modules/04_type_theory_pl/lecture_04d_denotational_axiomatic.md) |
| 8 | Fri | **HW4 Due** | [HW4: Type Theory](modules/04_type_theory_pl/hw04_type_theory.md) |

**Mini-Project 1 Due: End of Week 8** -- [Spec](projects/mini_project_1/spec.md)

**Readings**: Church (1936), Plotkin (1981), Howard (1980), Hoare (1969)

---

## Weeks 9-10: Intermediate Representations & SSA

### Module 05: IRs, Control Flow Graphs, SSA Form

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 9 | Mon | Intermediate Representations | [Lecture 05a](modules/05_ir_ssa/lecture_05a_intermediate_representations.md) |
| 9 | Wed | Control Flow Graphs & Dominance | [Lecture 05b](modules/05_ir_ssa/lecture_05b_control_flow_graphs.md) |
| 9 | Fri | *Recitation: Working with LLVM IR* | [Recitation 05](modules/05_ir_ssa/recitation_05_llvm_ir.md) |
| 10 | Mon | Static Single Assignment Form | [Lecture 05c](modules/05_ir_ssa/lecture_05c_ssa_form.md) |
| 10 | Wed | SSA-Based Optimizations | [Lecture 05d](modules/05_ir_ssa/lecture_05d_ssa_optimizations.md) |
| 10 | Fri | **HW5 Due** | [HW5: IR & SSA](modules/05_ir_ssa/hw05_ir_ssa.md) |

**Capstone Milestone 2 Due: End of Week 10** -- [Method + Preliminary Results](projects/capstone/milestone_2.md)

**Readings**: Cytron et al. (1991), Lattner & Adve (2004), Click & Paleczny (1995)

---

## Weeks 11-12: Code Generation

### Module 06: Instruction Selection, Register Allocation, Target Architectures

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 11 | Mon | Instruction Selection | [Lecture 06a](modules/06_code_generation/lecture_06a_instruction_selection.md) |
| 11 | Wed | Register Allocation | [Lecture 06b](modules/06_code_generation/lecture_06b_register_allocation.md) |
| 11 | Fri | *Recitation: Code Generation Workshop* | [Recitation 06](modules/06_code_generation/recitation_06_codegen.md) |
| 12 | Mon | Calling Conventions & Runtime Organization | [Lecture 06c](modules/06_code_generation/lecture_06c_calling_conventions_runtime.md) |
| 12 | Wed | Target Architectures | [Lecture 06d](modules/06_code_generation/lecture_06d_target_architectures.md) |
| 12 | Fri | **HW6 Due** | [HW6: Code Generation](modules/06_code_generation/hw06_code_generation.md) |

**Readings**: Chaitin et al. (1981), Briggs et al. (1994), Poletto & Sarkar (1999)

---

## Weeks 13-14: Program Analysis & Optimization

### Module 07: Dataflow Analysis, Loop Optimizations, Alias Analysis

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 13 | Mon | Dataflow Analysis Framework | [Lecture 07a](modules/07_program_analysis/lecture_07a_dataflow_analysis.md) |
| 13 | Wed | Loop Optimizations | [Lecture 07b](modules/07_program_analysis/lecture_07b_loop_optimizations.md) |
| 13 | Fri | *Recitation: Implementing Optimizations* | [Recitation 07](modules/07_program_analysis/recitation_07_optimization.md) |
| 14 | Mon | Alias Analysis & Pointer Analysis | [Lecture 07c](modules/07_program_analysis/lecture_07c_alias_analysis.md) |
| 14 | Wed | Interprocedural Analysis | [Lecture 07d](modules/07_program_analysis/lecture_07d_interprocedural_analysis.md) |
| 14 | Fri | **HW7 Due** | [HW7: Program Analysis](modules/07_program_analysis/hw07_program_analysis.md) |

**Mini-Project 2 Due: End of Week 14** -- [Spec](projects/mini_project_2/spec.md)

**Readings**: Kildall (1973), Andersen (1994), Reps et al. (1995)

---

## Weeks 15-16: Memory Management & Runtime Systems

### Module 08: Garbage Collection, Memory Safety, Runtime Environments

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 15 | Mon | Garbage Collection Fundamentals | [Lecture 08a](modules/08_memory_management/lecture_08a_garbage_collection.md) |
| 15 | Wed | Advanced Garbage Collection | [Lecture 08b](modules/08_memory_management/lecture_08b_advanced_gc.md) |
| 15 | Fri | *Recitation: Implementing a GC* | [Recitation 08](modules/08_memory_management/recitation_08_gc_implementation.md) |
| 16 | Mon | Memory Safety Without GC | [Lecture 08c](modules/08_memory_management/lecture_08c_memory_safety.md) |
| 16 | Wed | Runtime Systems | [Lecture 08d](modules/08_memory_management/lecture_08d_runtime_systems.md) |
| 16 | Fri | **HW8 Due** | [HW8: Memory Management](modules/08_memory_management/hw08_memory_management.md) |

**Capstone Milestone 3 Due: End of Week 15** -- [Full Draft](projects/capstone/milestone_3.md)

**Readings**: McCarthy (1960), Cheney (1970), Jung et al. (2017)

---

## Weeks 17-18: Programming Language Paradigms

### Module 09: Functional, OOP, Concurrent, and Logic Programming

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 17 | Mon | Functional Programming Languages | [Lecture 09a](modules/09_pl_paradigms/lecture_09a_functional_programming.md) |
| 17 | Wed | Object-Oriented Languages & Advanced Type Systems | [Lecture 09b](modules/09_pl_paradigms/lecture_09b_oop_type_systems.md) |
| 17 | Fri | *Recitation: Multi-Paradigm Programming* | [Recitation 09](modules/09_pl_paradigms/recitation_09_paradigms.md) |
| 18 | Mon | Concurrency & Parallelism in PLs | [Lecture 09c](modules/09_pl_paradigms/lecture_09c_concurrency_models.md) |
| 18 | Wed | Logic Programming & Domain-Specific Languages | [Lecture 09d](modules/09_pl_paradigms/lecture_09d_logic_dsl.md) |
| 18 | Fri | **HW9 Due** | [HW9: PL Paradigms](modules/09_pl_paradigms/hw09_pl_paradigms.md) |

**Readings**: Wadler (1992), Hoare (1978), Milner (1999)

---

## Weeks 19-20: Frontier Topics

### Module 10: JIT Compilation, Verified Compilers, ML for Compilers

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 19 | Mon | Just-In-Time Compilation | [Lecture 10a](modules/10_frontiers/lecture_10a_jit_compilation.md) |
| 19 | Wed | Verified & Correct Compilers | [Lecture 10b](modules/10_frontiers/lecture_10b_verified_compilers.md) |
| 19 | Fri | *Recitation: Exploring Frontiers* | [Recitation 10](modules/10_frontiers/recitation_10_frontier.md) |
| 20 | Mon | Machine Learning for Compilers | [Lecture 10c](modules/10_frontiers/lecture_10c_ml_for_compilers.md) |
| 20 | Wed | Language Design Frontiers | [Lecture 10d](modules/10_frontiers/lecture_10d_language_design_frontiers.md) |
| 20 | Fri | **HW10 Due** | [HW10: Frontier Topics](modules/10_frontiers/hw10_frontiers.md) |

**Readings**: Leroy (2009), Lopes et al. (2021), Trofin et al. (2021)

---

## Weeks 21-22: Formal Verification & SMT

### Module 11: SAT/SMT Solving, Abstract Interpretation, Symbolic Execution

| Week | Day | Topic | Materials |
|------|-----|-------|-----------|
| 21 | Mon | SAT Solving: DPLL & CDCL | [Lecture 11a](modules/11_formal_verification_smt/lecture_11a_sat_solving.md) |
| 21 | Wed | SMT Solving: DPLL(T) & Decision Procedures | [Lecture 11b](modules/11_formal_verification_smt/lecture_11b_smt_solving.md) |
| 21 | Fri | *Recitation: SMT Solvers in Practice* | [Recitation 11](modules/11_formal_verification_smt/recitation_11_smt_practice.md) |
| 22 | Mon | Abstract Interpretation | [Lecture 11c](modules/11_formal_verification_smt/lecture_11c_abstract_interpretation.md) |
| 22 | Wed | Symbolic Execution & Software Verification | [Lecture 11d](modules/11_formal_verification_smt/lecture_11d_symbolic_execution.md) |
| 22 | Fri | **HW11 Due** | [HW11: Formal Verification & SMT](modules/11_formal_verification_smt/hw11_formal_verification.md) |

**Capstone Final Report Due: End of Week 22** -- [Final Report](projects/capstone/final_report.md)

**Readings**: Davis et al. (1962), de Moura & Bjorner (2008), Cousot & Cousot (1977), King (1976), Cadar et al. (2008)

---

## Paper Presentation Schedule

Each student presents one paper during the semester (15 min + 10 min Q&A).

- Weeks 3-4: Classic papers (pre-2000)
- Weeks 7-8: Type theory and PL foundations papers
- Weeks 11-14: Compiler optimization and analysis papers
- Weeks 17-20: Frontier and PL paradigm papers
- Weeks 21-22: Formal verification papers

See [resources/paper_reading_guide.md](resources/paper_reading_guide.md) for presentation guidelines.
