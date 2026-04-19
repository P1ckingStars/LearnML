# Module 01: Lexical Analysis

**Weeks 1--2** | Regular expressions, finite automata, scanner construction

---

## Overview

Lexical analysis (scanning) is the first phase of compilation: transforming a stream of characters into a stream of tokens. This module covers the theoretical foundations (regular expressions, finite automata, formal language theory) and the practical engineering of high-performance scanners.

---

## Lectures

| # | Title | Topics |
|---|-------|--------|
| 01a | [Regular Expressions & Automata](lecture_01a_regular_expressions_automata.md) | Thompson's construction, subset construction, DFA minimization, Brzozowski derivatives |
| 01b | [Scanner Construction](lecture_01b_scanner_construction.md) | Maximal munch, lex/flex, keywords, error recovery, Unicode, table-driven vs direct-coded |
| 01c | [Formal Language Theory in Depth](lecture_01c_formal_language_theory_depth.md) | Closure properties, decision problems, star-free languages, weighted automata, transducers |
| 01d | [Lexer Optimization & Engineering](lecture_01d_lexer_optimization.md) | State minimization in practice, table compression, JIT lexing, parallel lexing, benchmarking |

## Recitation

| # | Title | Description |
|---|-------|-------------|
| R01 | [Building a Scanner from Scratch](recitation_01_scanner_implementation.md) | Thompson's construction implementation, NFA simulation, complete scanner for a toy language |

## Assignments

| # | Title | Description |
|---|-------|-------------|
| HW1 | [Lexical Analysis](hw01_lexical_analysis.md) | Part A: Theory (RE/automata proofs). Part B: Implementation (build a scanner from scratch) |

---

## Learning Objectives

By the end of this module, students should be able to:

- Convert regular expressions to NFAs (Thompson's construction) and NFAs to minimal DFAs.
- Prove the correctness and analyze the complexity of automata constructions.
- Implement a complete scanner using both hand-coded and generated approaches.
- Understand and apply DFA minimization and table compression techniques.
- Reason about the formal language-theoretic properties of token languages.

---

## References

- Aho, A. V., Lam, M. S., Sethi, R., and Ullman, J. D. *Compilers: Principles, Techniques, and Tools*, 2nd ed. Pearson, 2006. Chapters 3--4.
- Cooper, K. D. and Torczon, L. *Engineering a Compiler*, 3rd ed. Morgan Kaufmann, 2022. Chapters 2--3.
- Thompson, K. "Programming Techniques: Regular expression search algorithm." *CACM*, 11(6):419--422, 1968.
- Hopcroft, J. E. "An $n \log n$ algorithm for minimizing states in a finite automaton." *Theory of Machines and Computations*, 1971.
