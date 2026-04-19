# Module 00: Mathematical & CS Foundations

**Pre-work** | Formal languages, automata theory, discrete math review

---

## Overview

This module provides the mathematical and computer science prerequisites for a graduate-level compilers and programming languages course. Students are expected to have undergraduate-level exposure to these topics; the material here serves as a rigorous review and deepening of the foundations upon which all subsequent modules build.

The two main pillars are:

1. **Formal Languages & Automata Theory** -- the classification of languages by computational power, the machines that recognize them, and the fundamental closure and decidability results.
2. **Discrete Mathematics for Compilers** -- lattice theory, fixed-point theorems, graph algorithms, and proof techniques that underpin static analysis, type theory, and optimization.

---

## Lectures

| # | Title | Topics |
|---|-------|--------|
| 00a | [Formal Languages & Automata Theory](lecture_00a_formal_languages.md) | Alphabets, strings, regular languages, DFA/NFA equivalence, pumping lemma, Myhill-Nerode, CFLs, PDAs, Chomsky hierarchy |
| 00b | [Discrete Math for Compilers](lecture_00b_discrete_math_review.md) | Sets, relations, partial orders, lattices, fixed-point theorems, graph theory, structural and well-founded induction |

## Assignments

| # | Title | Description |
|---|-------|-------------|
| HW0 | [Foundations Diagnostic](hw00_foundations_diagnostic.md) | 8--10 problems covering DFA/NFA construction, grammar design, lattice proofs, structural induction |

---

## Learning Objectives

By the end of this module, students should be able to:

- Formally define and manipulate regular and context-free languages.
- Prove language membership or non-membership using pumping lemmas and closure properties.
- Construct and minimize finite automata.
- State and apply fixed-point theorems in lattice-theoretic settings.
- Use structural induction to prove properties of recursively defined objects.
- Analyze directed graphs using dominance, SCCs, and topological orderings.

---

## References

- Sipser, M. *Introduction to the Theory of Computation*, 3rd ed. Cengage, 2012.
- Hopcroft, J., Motwani, R., Ullman, J. *Introduction to Automata Theory, Languages, and Computation*, 3rd ed. Pearson, 2006.
- Davey, B. A. & Priestley, H. A. *Introduction to Lattices and Order*, 2nd ed. Cambridge University Press, 2002.
