# Prerequisites

This course assumes mathematical maturity and comfort with rigorous proof-writing. Below is a detailed checklist — if you can comfortably solve 80%+ of the self-assessment problems, you are ready.

## 1. Propositional & Predicate Logic

**Required level**: A full undergraduate course in mathematical logic or discrete mathematics with proofs.

You should be fluent in:

- Propositional connectives: conjunction, disjunction, negation, implication, biconditional
- Truth tables and semantic entailment
- Natural deduction: introduction and elimination rules for all connectives
- Predicate logic: universal and existential quantifiers, free and bound variables
- Proof strategies: direct, contrapositive, contradiction, case analysis
- Soundness and completeness (conceptual understanding)

**Self-assessment problems**:

1. Prove using natural deduction: (P -> Q) -> (not Q -> not P).
2. Prove: for all x, (P(x) and Q(x)) iff (for all x, P(x)) and (for all x, Q(x)).
3. Give a counterexample showing that (exists x, P(x) -> Q(x)) does not imply (exists x, P(x)) -> (exists x, Q(x)) in general.
4. Prove by contradiction: sqrt(2) is irrational.
5. State the deduction theorem and explain why it matters for proof assistants.

## 2. Naive Set Theory

**Required level**: Exposure to basic set theory at the level of Halmos' *Naive Set Theory* or an introductory real analysis course.

You should be fluent in:

- Set operations: union, intersection, complement, power set, Cartesian product
- Relations: reflexive, symmetric, transitive, equivalence relations, partial orders
- Functions: injective, surjective, bijective, composition, inverse
- Cardinality: finite vs. infinite, countable vs. uncountable, Cantor's diagonal argument
- Orderings: well-orderings, least elements, induction on well-ordered sets
- The axiom of choice (informal statement and why it matters)

**Self-assessment problems**:

1. Prove that the power set of a finite set with n elements has 2^n elements.
2. Prove Cantor's theorem: there is no surjection from A to P(A).
3. Show that the rationals are countable.
4. Define an equivalence relation on Z x (Z \ {0}) that yields the rationals as equivalence classes.
5. State Zorn's Lemma and use it to prove that every vector space has a basis (sketch).

## 3. Mathematical Maturity

**Required level**: Comfort with reading and writing rigorous proofs, at the level of an undergraduate course in abstract algebra or real analysis.

You should be comfortable with:

- Reading and producing multi-step proofs
- Structural induction and well-founded induction
- Understanding formal definitions (groups, rings, topological spaces, etc.)
- Distinguishing between syntax and semantics
- Working with abstract structures defined axiomatically

**Self-assessment problems**:

1. Prove that every group of order p (prime) is cyclic.
2. Prove that the intersection of any collection of topologies on X is again a topology.
3. Define the natural numbers inductively and prove that addition is commutative by induction.

## 4. Programming

**Required level**: Comfortable programmer. Experience with functional programming is helpful but not required.

You should be comfortable with:

- At least one programming language (Python, C, Java, Haskell, OCaml, etc.)
- Recursive data structures: trees, lists
- Pattern matching (if you know a functional language)
- Basic C programming: pointers, structs, arrays, memory allocation (needed for modules 08–10)
- Using a text editor or IDE; basic command-line usage

**Self-assessment**:

1. Implement a binary search tree with insert, lookup, and delete in your preferred language.
2. Write a recursive function that computes the nth Fibonacci number, then convert it to tail-recursive form.
3. (For the C track) Write a C function that reverses a singly-linked list in place.

## 5. Optional but Helpful

These are not required but will make certain modules easier:

- **Type theory basics**: Lambda calculus, simple types, Curry-Howard correspondence (helps with modules 01, 07)
- **Axiomatic set theory**: ZFC axioms, ordinals, cardinals (helps with modules 03–06)
- **Formal methods exposure**: Model checking, temporal logic, Hoare logic (helps with modules 08–10)
- **Haskell or ML**: The Isar proof language has a functional flavor (helps with all modules)

## Recommended Textbooks

| Topic | Book |
|-------|------|
| Logic | Huth & Ryan, *Logic in Computer Science* |
| Logic | van Dalen, *Logic and Structure* |
| Set Theory | Halmos, *Naive Set Theory* |
| Set Theory | Kunen, *Set Theory: An Introduction to Independence Proofs* |
| Proof Writing | Velleman, *How to Prove It* |
| Functional Programming | Thompson, *Haskell: The Craft of Functional Programming* |
| C Programming | Kernighan & Ritchie, *The C Programming Language* |

## If You Need to Catch Up

- **Logic gap**: Work through Huth & Ryan Ch. 1–2 (propositional and predicate logic with natural deduction)
- **Set theory gap**: Read Halmos, *Naive Set Theory* — it is short (104 pages) and covers exactly what you need
- **Proof-writing gap**: Work through Velleman, *How to Prove It* Ch. 1–5
- **Programming gap**: Complete any introductory programming course; for C specifically, work through K&R Ch. 1–6
- **Functional programming gap**: Work through the first 8 chapters of *Learn You a Haskell*

Complete [HW0: Logic Bootcamp](modules/00_foundations/hw00_logic_bootcamp.md) as a diagnostic — it covers all prerequisite logic and set theory topics.
