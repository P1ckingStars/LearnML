---
title: "Prerequisites"
tags:
  - type-theory
  - course-info
---
# Prerequisites

This course assumes mathematical maturity and functional programming experience. Below is a detailed checklist -- if you can comfortably solve 80%+ of the self-assessment problems, you are ready.

## 1. Propositional & Predicate Logic

**Required level**: A logic course or the logic chapter of a discrete mathematics textbook (e.g., Rosen, Sipser Appendix, or van Dalen's *Logic and Structure*).

You should be fluent in:

- Propositional connectives: $\land, \lor, \neg, \to, \leftrightarrow$
- Truth tables and semantic entailment
- Predicate logic: universal ($\forall$) and existential ($\exists$) quantifiers
- Free and bound variables in logical formulas
- Natural deduction: introduction and elimination rules for each connective
- Proof strategies: direct proof, proof by contradiction, proof by contrapositive, proof by cases

**Self-assessment problems**:

1. Prove that $A \to (B \to A)$ is a tautology using natural deduction (not truth tables).
2. Formalize in predicate logic: "Every type that is a subtype of Top is also a subtype of itself." Write a proof assuming reflexivity and transitivity of subtyping.
3. Prove by contradiction that $\neg(A \land \neg A)$ (the law of non-contradiction).
4. Prove that $(\forall x.\; P(x) \to Q(x)) \to (\forall x.\; P(x)) \to (\forall x.\; Q(x))$.
5. Explain why the law of excluded middle ($A \lor \neg A$) is not provable in intuitionistic logic. Why does this matter for type theory?

## 2. Discrete Mathematics & Proof Techniques

**Required level**: A full undergraduate discrete mathematics course.

You should be fluent in:

- Sets: membership, union, intersection, complement, power set, Cartesian product
- Relations: reflexive, symmetric, transitive, equivalence relations, partial orders
- Functions: injective, surjective, bijective, composition, inverse
- Mathematical induction: weak, strong, and well-founded
- Structural induction on inductively defined structures (trees, lists)
- Recursive definitions and their properties

**Self-assessment problems**:

1. Prove by strong induction that every natural number $n \ge 2$ has a prime factorization.
2. Define a binary tree inductively. Prove by structural induction that the number of leaves is one more than the number of internal nodes.
3. Prove that a relation $R$ on a set $A$ is an equivalence relation if and only if $R$ is reflexive and Euclidean ($aRb \land aRc \implies bRc$).
4. Let $f : A \to B$ and $g : B \to C$. Prove that if $g \circ f$ is injective, then $f$ is injective.
5. Define the set of terms $T$ of a simple expression language inductively: (i) $n \in T$ for any natural number $n$, (ii) if $t_1, t_2 \in T$ then $t_1 + t_2 \in T$. Prove by structural induction that every term $t \in T$ evaluates to a natural number.

## 3. Functional Programming

**Required level**: One course using a statically-typed functional language (OCaml, Haskell, Standard ML, or similar), or substantial self-study.

You should be comfortable with:

- Recursive functions and pattern matching
- Algebraic data types (variants/sum types) and product types (tuples, records)
- Higher-order functions: map, fold, filter, compose
- Parametric polymorphism (generics)
- Type inference in practice (letting the compiler infer types)
- Immutable data structures
- Option/Maybe types for safe null handling

**Self-assessment**:

1. Implement a function `eval : expr -> int` in OCaml (or your preferred language) for the expression language: `type expr = Num of int | Add of expr * expr | Mul of expr * expr`.
2. Implement `map` and `fold_left` for a custom list type: `type 'a mylist = Nil | Cons of 'a * 'a mylist`.
3. Write a function that computes the depth of a binary tree using pattern matching.
4. Explain the difference between `'a -> 'b -> 'c` and `('a -> 'b) -> 'c` in OCaml.
5. What is the type of `fun f -> fun g -> fun x -> f (g x)`?

## 4. Basic Computability (Helpful but Not Required)

**Recommended level**: Exposure to Turing machines, decidability, and the halting problem.

Helpful concepts:

- Turing machines and computability
- The halting problem and undecidability
- Church-Turing thesis
- Diagonalization arguments
- Primitive recursive vs general recursive functions

These topics provide context for understanding why type inference is undecidable for System F, why some type systems are not Turing-complete (and why that is desirable), and the connections between lambda calculus and computation.

## 5. Category Theory (Not Required, Helpful for Modules 07-10)

Some advanced topics in the course connect to category theory. Prior exposure is helpful but not assumed -- we develop what we need.

Helpful concepts:

- Categories, objects, morphisms
- Functors and natural transformations
- Products and coproducts
- Cartesian closed categories
- Adjunctions

If you want to prepare, read the first 3 chapters of Awodey's *Category Theory* or watch the Bartosz Milewski lecture series.

## Recommended Textbooks

| Topic | Book |
|-------|------|
| Logic | van Dalen, *Logic and Structure* |
| Discrete Mathematics | Rosen, *Discrete Mathematics and Its Applications* |
| Functional Programming | Hickey, *Introduction to Objective Caml* (free) |
| Functional Programming | Minsky et al., *Real World OCaml* (free online) |
| Type Theory (our textbook) | Pierce, *Types and Programming Languages* |
| Type Theory (alternative) | Harper, *Practical Foundations for Programming Languages* |
| Category Theory | Awodey, *Category Theory* |

## If You Need to Catch Up

- **Logic gap**: Work through Chapters 1-3 of van Dalen's *Logic and Structure*, or the logic section of any discrete math textbook
- **Induction gap**: Work through Chapter 5 of Rosen, paying special attention to structural induction
- **Functional programming gap**: Complete the first 6 chapters of *Real World OCaml* (free online), or work through *Learn You a Haskell*
- **Programming gap**: If you know Python/Java but not FP, start with the OCaml exercises at ocaml.org/exercises

Complete [HW0: Foundations Bootcamp](modules/00_foundations/hw00_foundations_bootcamp.md) as a diagnostic -- it covers all prerequisite topics.
