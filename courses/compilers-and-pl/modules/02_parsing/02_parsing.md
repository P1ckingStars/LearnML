# Module 02: Parsing

**Weeks 3--4** | Context-free grammars, LL/LR parsing, error recovery

---

## Overview

Parsing is the second phase of compilation: transforming a stream of tokens into a structured representation (parse tree or abstract syntax tree). This module covers the theoretical foundations of context-free grammars and the two major families of parsing algorithms -- top-down (LL) and bottom-up (LR) -- along with practical considerations for error recovery and modern parsing frameworks.

---

## Lectures

| # | Title | Topics |
|---|-------|--------|
| 02a | [Context-Free Grammars & Parse Trees](lecture_02a_context_free_grammars.md) | CFG definition, derivations, parse trees, ambiguity, grammar transformations, CNF/GNF, CYK, Earley |
| 02b | [Top-Down Parsing](lecture_02b_top_down_parsing.md) | Recursive descent, FIRST/FOLLOW, LL(1), LL(k), packrat parsing, PEGs |
| 02c | [Bottom-Up Parsing](lecture_02c_bottom_up_parsing.md) | Shift-reduce, LR(0), SLR(1), LR(1), LALR(1), GLR, parser generators |
| 02d | [Error Recovery & Practical Parsing](lecture_02d_error_recovery_practical.md) | Panic mode, phrase-level, Burke-Fisher, incremental parsing, tree-sitter |

## Recitation

| # | Title | Description |
|---|-------|-------------|
| R02 | [Building Parsers](recitation_02_parser_construction.md) | Recursive descent implementation, FIRST/FOLLOW by hand, LR table construction, debugging |

## Assignments

| # | Title | Description |
|---|-------|-------------|
| HW2 | [Parsing](hw02_parsing.md) | Part A: Theory (grammar transformations, FIRST/FOLLOW, LR tables, ambiguity proofs). Part B: Implementation (recursive descent + shift-reduce parser) |

---

## Learning Objectives

By the end of this module, students should be able to:

- Define and manipulate context-free grammars, including transformations to normal forms.
- Compute FIRST and FOLLOW sets and construct LL(1) parse tables.
- Construct LR(0), SLR(1), and LALR(1) parse tables.
- Prove properties of grammar classes (LL(1), LR(1), LALR(1)) and their relationships.
- Implement both recursive descent and shift-reduce parsers.
- Apply error recovery techniques in practical parsers.
- Understand the design of modern parsing frameworks (tree-sitter, PEG parsers).

---

## References

- Aho, A. V., Lam, M. S., Sethi, R., and Ullman, J. D. *Compilers: Principles, Techniques, and Tools*, 2nd ed. Pearson, 2006. Chapters 4--5.
- Grune, D. and Jacobs, C. J. H. *Parsing Techniques: A Practical Guide*, 2nd ed. Springer, 2008.
- Knuth, D. E. "On the translation of languages from left to right." *Information and Control*, 8(6):607--639, 1965.
- Earley, J. "An efficient context-free parsing algorithm." *Communications of the ACM*, 13(2):94--102, 1970.
- Ford, B. "Parsing expression grammars: a recognition-based syntactic foundation." *POPL*, 2004.
