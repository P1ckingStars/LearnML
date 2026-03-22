# Glossary of Formal Verification Terms

Over 100 key terms used in this course, organized alphabetically. Definitions aim for precision at a graduate level while remaining accessible.

---

## A

**Abstraction Function.**
A function that maps the concrete state of an implementation to the abstract state of a specification. In C verification, the abstraction function maps the C heap and local variables to the abstract data type (e.g., mapping an array and index variable to a list). The correctness of the abstraction function is essential for refinement proofs.

**Apply-Script.**
A proof style in Isabelle consisting of a sequence of `apply` commands, each modifying the proof state. Apply-scripts are efficient to write but difficult to read and maintain. Compare with structured Isar proofs.

**Assumption (in Isabelle).**
A method that closes a goal by matching it exactly against a hypothesis in the current proof context. The `assumption` method is one of the most basic Isabelle tactics.

**Auto.**
An Isabelle proof method that combines the simplifier and the classical reasoner. `auto` applies rewriting rules and logical introduction/elimination rules repeatedly. More powerful than `simp` alone but less predictable. Often used for routine goals that require both rewriting and logical reasoning.

**AutoCorres.**
A tool that automatically lifts C code parsed by the C-to-Isabelle parser through multiple abstraction layers, producing a clean monadic representation suitable for verification. AutoCorres performs word abstraction (replacing machine words with natural numbers where safe), heap abstraction (providing typed access to memory), and type strengthening (replacing nondeterministic state monad with simpler types when possible).

**Axiom of Choice (AC).**
The set-theoretic axiom asserting that for any family of non-empty sets, there exists a function choosing one element from each. In Isabelle/ZF, AC is available as an axiom and is used in proofs involving well-ordering, Zorn's lemma, and cardinal arithmetic. Many results in Isabelle/ZF explicitly track dependence on AC.

**Axiom of Foundation (Regularity).**
The ZF axiom asserting that every non-empty set contains an element disjoint from itself. Equivalently, the membership relation is well-founded. Used in Isabelle/ZF for epsilon-induction (transfinite induction on the membership relation).

---

## B

**Backward Proof.**
A proof style that works from the goal backward, applying rules to reduce it to simpler subgoals. In Isabelle, `apply` commands and most tactics work backward. Compare with forward proof (using `have` and `from` in Isar).

**Blast.**
An Isabelle proof method that uses a tableau-based prover for classical first-order logic. `blast` is effective for goals involving logical connectives, quantifiers, and set-theoretic reasoning but does not perform rewriting. Use `blast` when `simp` cannot handle the logical structure and `auto` is too slow.

**Bounded Quantifier.**
In set theory, a quantifier restricted to elements of a specific set: `forall x in A. P(x)` means `forall x. x in A --> P(x)`. In Isabelle/ZF, bounded quantifiers have special syntax (`\<forall>x\<in>A. P(x)`) and dedicated simplification rules.

---

## C

**Cardinal (Number).**
An equivalence class of sets under bijection, or (in ZF with choice) the least ordinal equinumerous with a given set. In Isabelle/ZF, cardinals are defined using the latter approach. Key operations: cardinal sum, cardinal product, cardinal exponentiation.

**Cardinality.**
The "size" of a set, generalized beyond finite sets using bijections. Two sets have the same cardinality if there exists a bijection between them. Notation: |A| or card(A). In Isabelle/ZF, `|A|` denotes the cardinal number of A.

**Classical Reasoner.**
The Isabelle subsystem that handles classical logic reasoning: introduction and elimination rules, case splits, contradiction. Methods: `rule`, `erule`, `drule`, `blast`, `fast`, `best`. The classical reasoner maintains a set of safe and unsafe rules that it applies in a goal-directed manner.

**Cofinality.**
The cofinality of an ordinal alpha is the smallest ordinal beta such that there exists a strictly increasing function from beta to alpha whose range is cofinal (unbounded). A cardinal kappa is regular if cf(kappa) = kappa, and singular otherwise.

**Completeness (of a logic).**
A logic is complete if every semantically valid formula is provable. Goedel's completeness theorem establishes this for first-order logic. Not to be confused with completeness of a proof search procedure, which means it will find a proof if one exists.

**Constructible Universe (L).**
Goedel's constructible universe, the minimal inner model of ZF. L is built by transfinite iteration of the "definable powerset" operation. Isabelle/ZF includes a substantial formalization of L, used to prove the relative consistency of AC and GCH. Paulson's Isabelle/ZF development of L is one of the largest formalization projects in set theory.

**Corres (Correspondence).**
A refinement framework used in seL4 and AutoCorres-based verification. A `corres` lemma states that an implementation function refines an abstract specification under a state relation. The corres framework provides compositional proof rules for building refinement proofs from smaller pieces.

**Cumulative Hierarchy.**
The hierarchy of sets V_alpha defined by transfinite recursion: V_0 = {}, V_{alpha+1} = P(V_alpha), V_lambda = Union_{alpha < lambda} V_alpha for limit lambda. Every set in ZF belongs to some V_alpha. The rank of a set x is the least alpha such that x in V_{alpha+1}.

---

## D

**Data Refinement.**
A proof technique showing that an abstract specification is correctly implemented by a concrete representation. Involves an abstraction function (or relation) linking concrete and abstract states, and proofs that each operation preserves the abstraction.

**Datatype.**
In Isabelle/HOL, a freely generated algebraic type defined using the `datatype` command. Isabelle automatically generates induction principles, case distinctions, and distinctness/injectivity lemmas. In Isabelle/ZF, datatypes are constructed from sets and do not have the same automatic infrastructure.

**Definite Description.**
The operator `THE x. P(x)` in Isabelle/HOL, which returns the unique x satisfying P if exactly one exists, and an unspecified value otherwise. In Isabelle/ZF, the corresponding operator is `THE`, which constructs a set satisfying a given property.

**Dependent Choice.**
A weaker form of the axiom of choice: given a total relation R on a non-empty set, there exists an infinite sequence such that each element is related to the next by R. Sufficient for many results in analysis and combinatorics where full AC is not needed.

---

## E

**Eisbach.**
A domain-specific language embedded in Isabelle for writing custom proof methods (tactics). Eisbach methods can combine existing methods, match on goal structure, and provide named tactics for common proof patterns. Used extensively in the seL4 verification to manage proof scale.

**Elimination Rule.**
A logical rule that decomposes a hypothesis. Example: conjunction elimination derives P from P & Q. In Isabelle, elimination rules are applied with `erule` or declared with `[elim]`. The classical reasoner uses elimination rules during backward proof search.

**Epsilon-Induction.**
Induction on the membership relation, justified by the axiom of foundation. If P(x) holds whenever P(y) holds for all y in x, then P(x) holds for all sets x. The fundamental induction principle in ZF set theory, used in Isabelle/ZF via the `eps_induct` tactic.

---

## F

**Find_Theorems.**
An Isabelle command that searches the theorem database for lemmas matching a given pattern. Syntax: `find_theorems "_ Un _ = _ Un _"` finds theorems about union commutativity. One of the most useful Isabelle commands for discovering existing infrastructure.

**Force.**
An Isabelle proof method that combines the simplifier and classical reasoner more aggressively than `auto`. `force` tries harder to solve a single goal but does not split goals. Use when `auto` fails on a goal that seems like it should be provable by rewriting and logic.

**Forcing (in set theory).**
A technique for constructing models of set theory in which certain statements hold or fail. Invented by Cohen to prove the independence of the continuum hypothesis. Formalized in Isabelle/ZF by Gunther, Pagano, and Sanchez Terraf.

**Forward Proof.**
A proof style that derives new facts from known ones, building toward the goal. In Isar, forward steps use `have`, `hence`, `then`, `from`, and `with`. Forward proofs are more readable than backward proofs but can be more verbose.

**Functional Specification.**
A pure mathematical specification of the behavior of a program, written as Isabelle/HOL functions and predicates. The functional specification defines *what* the program should do, while the implementation defines *how*. Verification consists of proving that the implementation refines the specification.

---

## G

**Goal (Proof State).**
The statement that remains to be proved at a given point in an Isabelle proof. The initial goal is the theorem statement; proof methods transform goals into simpler subgoals until all are discharged. The current proof state can be inspected in Isabelle/jEdit's output panel.

---

## H

**Hoare Logic.**
A formal system for reasoning about imperative programs. A Hoare triple {P} c {Q} asserts that if precondition P holds before executing command c, and c terminates, then postcondition Q holds afterward (partial correctness). Total correctness additionally requires termination. The VCG in Isabelle/SIMPL generates Hoare-style verification conditions.

**Hoare Triple.**
A statement of the form {P} c {Q}, where P is the precondition, c is a program, and Q is the postcondition. In Isabelle/SIMPL and AutoCorres, Hoare triples are expressed using the `valid` and `validNF` predicates (for partial and total correctness, respectively).

---

## I

**Induction (in Isabelle).**
Proof by induction over a datatype, a natural number, a well-founded relation, or an inductively defined set. Isabelle provides the `induct` method, which automatically selects the appropriate induction principle based on the term being inducted over. Custom induction rules can be supplied with `induct rule: custom_induct`.

**Inductive Definition.**
A definition of a set (or predicate) as the smallest set closed under specified rules. In Isabelle/HOL, defined with the `inductive` command. In Isabelle/ZF, defined using `consts` with explicit closure and minimality proofs. Isabelle automatically generates introduction rules and an induction principle.

**Inner Model.**
A transitive class containing all ordinals that satisfies the ZF axioms. The constructible universe L is the canonical inner model. Inner models are used to prove relative consistency results (if ZF is consistent, then ZF + V=L is consistent).

**Introduction Rule.**
A logical rule that constructs a formula from its components. Example: conjunction introduction derives P & Q from P and Q. In Isabelle, introduction rules are applied with `rule` or declared with `[intro]`. The classical reasoner uses introduction rules during backward proof search.

**Isar (Intelligible Semi-Automated Reasoning).**
The structured proof language of Isabelle. Isar proofs are human-readable, consisting of `fix`, `assume`, `have`, `show`, `proof`, `qed`, and other keywords. Isar proofs document the mathematical argument, not just the sequence of tactic applications.

---

## K

**Knaster-Tarski Theorem.**
Every monotone function on a complete lattice has a least fixed point. Used in Isabelle/ZF for defining inductive sets and in Isabelle/HOL for the foundation of inductive definitions. The Isabelle/ZF formalization uses this theorem directly.

---

## L

**Lemma (in Isabelle).**
A proved statement that is stored in the theorem database and can be used in subsequent proofs. In Isabelle, `lemma`, `theorem`, and `proposition` are syntactically interchangeable; the choice is conventional (lemma for auxiliary results, theorem for main results).

**Locale.**
An Isabelle mechanism for parameterized theories. A locale declares parameters (types and terms) with associated assumptions. Definitions and theorems proved within a locale are implicitly parameterized. Locales are essential for organizing large formalizations and for stating properties that depend on a fixed algebraic structure.

**Loop Invariant.**
A property that holds before and after every iteration of a loop. In C verification, the loop invariant must capture: (1) the relationship between loop variables and the desired result, (2) validity of all pointers, (3) bounds on index variables. Discovering the right invariant is typically the hardest part of verifying imperative code.

---

## M

**Metalogic (Pure).**
Isabelle's foundation: a fragment of intuitionistic higher-order logic used to represent object logics. Pure provides implication (==>), universal quantification (!!), and equality (==). Object logics (HOL, ZF) are embedded into Pure.

**Method (in Isabelle).**
A proof procedure applied to transform the current proof state. Examples: `simp`, `auto`, `blast`, `rule`, `induct`, `cases`. Methods are invoked with `apply` in apply-scripts or `by` in Isar proofs. Custom methods can be defined using Eisbach.

**Modifies Clause.**
In C verification, a specification of which memory locations a function is permitted to modify. Functions must not modify memory outside their modifies clause. In Isabelle/SIMPL, modifies clauses help establish frame conditions for separation logic-style reasoning.

**Monotone Function (on a lattice).**
A function f such that x <= y implies f(x) <= f(y). Monotonicity is the key condition for the Knaster-Tarski fixed-point theorem. In Isabelle/ZF, monotonicity of the operator is required for well-behaved inductive definitions.

---

## N

**Normal Function (on ordinals).**
A function f on ordinals that is strictly increasing (alpha < beta implies f(alpha) < f(beta)) and continuous (f(lambda) = sup_{alpha < lambda} f(alpha) for limit ordinals lambda). Normal functions have arbitrarily large fixed points (the fixed-point lemma).

---

## O

**Oops.**
An Isabelle command that abandons the current proof attempt without recording the result. Unlike `sorry`, which records the statement as "proved" (with a warning), `oops` simply discards the attempt. Useful during proof development for exploring without polluting the theorem database.

**Ord (in Isabelle/ZF).**
The predicate characterizing ordinals in Isabelle/ZF: `Ord(alpha)` holds iff alpha is a transitive set well-ordered by the membership relation. Ordinals form a proper class and are used for transfinite induction and recursion.

**Ordinal.**
A transitive set well-ordered by the membership relation. Ordinals extend the natural numbers into the transfinite. Key ordinals: 0 (the empty set), successor ordinals (alpha union {alpha}), and limit ordinals (non-zero ordinals that are not successors). In Isabelle/ZF, ordinals are sets satisfying the `Ord` predicate.

---

## P

**Power Set.**
The set of all subsets of a given set: P(A) = {B : B subseteq A}. The power set axiom is one of the ZF axioms. Cantor's theorem states |A| < |P(A)| for all sets A.

**Proof State.**
The current configuration of an Isabelle proof, consisting of a list of subgoals (goals remaining to be proved) and the current context (fixed variables, local assumptions). The proof state is displayed in Isabelle/jEdit's output panel and is the primary interface for interactive proof development.

---

## Q

**Quickcheck.**
An Isabelle tool that tests conjectures by evaluating them on randomly generated inputs. If Quickcheck finds a counterexample, the conjecture is false. Useful for debugging lemma statements before investing effort in proofs. Does not work for all types (particularly not for Isabelle/ZF sets).

---

## R

**Rank (of a set).**
The rank of a set x is the least ordinal alpha such that x is a subset of V_alpha (equivalently, x in V_{alpha+1}). Rank measures "how many levels of set formation" are needed to construct x. Every set in ZF has a rank (by the axiom of foundation).

**Refinement.**
A relationship between an abstract specification and a concrete implementation: the implementation refines the specification if every behavior of the implementation is a permitted behavior of the specification. Refinement proofs are the core of C verification in Isabelle.

**Replacement (Axiom Schema).**
The ZF axiom schema asserting that the image of a set under a definable function is a set. In Isabelle/ZF, replacement is formalized as the axiom `Replace`: if A is a set and F is a function-like relation, then {F(x) : x in A} is a set.

**Rule (Isabelle Method).**
The method `rule` applies a single logical rule to the current goal. `rule conjI` applies conjunction introduction; `rule` without arguments tries all applicable introduction rules. The most basic backward reasoning step in Isabelle.

---

## S

**Schroeder-Bernstein Theorem.**
If there exist injections f: A -> B and g: B -> A, then there exists a bijection between A and B. Equivalently, |A| <= |B| and |B| <= |A| implies |A| = |B|. Formalized in Isabelle/ZF as part of the cardinal arithmetic library.

**Separation (Axiom Schema).**
The ZF axiom schema asserting that for any set A and any property P, the set {x in A : P(x)} exists. Also called the comprehension schema or Aussonderung. In Isabelle/ZF, this is formalized using the `Collect` constructor.

**SIMPL (Schirmer's Imperative Language).**
A generic imperative language formalized in Isabelle/HOL, used as the target for the C-to-Isabelle parser. SIMPL provides a deep embedding of C programs in Isabelle, including structured statements, exceptions, and function calls. AutoCorres abstracts from SIMPL to a more usable representation.

**Simplifier (simp).**
Isabelle's term rewriting engine. `simp` applies a set of rewriting rules (the simpset) to simplify goals. Rules declared with `[simp]` are automatically added to the simpset. The simplifier is the most frequently used proof method in Isabelle. Key concern: ensure the simpset is confluent and terminating (no looping rules).

**Simp Rule.**
A theorem declared with the `[simp]` attribute, making it available to the simplifier. Simp rules should be oriented equations (left side is the "complex" form, right side is the "simple" form). Adding too many simp rules can cause the simplifier to loop; adding too few makes it weak.

**Sledgehammer.**
An Isabelle tool that invokes external automated theorem provers (E, Vampire, Z3, CVC4, SPASS) to find proofs. Sledgehammer selects relevant premises from the theorem database, translates the goal to first-order logic, invokes the provers, and reconstructs successful proofs in Isabelle. The most powerful automation tool available in Isabelle.

**Soundness (of a logic).**
A logic is sound if every provable formula is semantically valid. Isabelle's logical kernel guarantees soundness: every theorem produced by the kernel is a valid consequence of the axioms. Proofs found by external tools (via Sledgehammer) are reconstructed in the kernel, maintaining soundness.

**Sorry.**
An Isabelle command that closes the current goal without proof. Used during development as a placeholder. A theory containing `sorry` is not fully proved and Isabelle marks it with a warning. Final submissions must contain no sorry.

**State Monad (Nondeterministic).**
The monadic framework used by AutoCorres to represent C programs. A program in the nondeterministic state monad takes a state and returns a set of (result, new-state) pairs, plus a flag indicating whether failure is possible. This framework naturally models C's potential for undefined behavior.

**StrictC.**
The subset of C supported by the C-to-Isabelle parser. StrictC excludes features that are difficult to formalize: computed gotos, signal handling, most forms of undefined behavior, floating point (in some configurations), and complex macro usage.

**Subgoal.**
One of the remaining proof obligations in a proof state. When a method is applied, it may close some subgoals and generate new ones. A proof is complete when all subgoals are discharged.

---

## T

**Tactic.**
A proof procedure that transforms the proof state. In Isabelle, tactics are invoked as methods. The term "tactic" comes from LCF-style proof assistants and refers to the programmatic interface; "method" is the Isar-level interface.

**Transfinite Induction.**
Induction on ordinals or well-founded relations, generalizing ordinary mathematical induction beyond the natural numbers. In Isabelle/ZF, transfinite induction is available via `trans_induct` and specialized forms for ordinal induction.

**Transfinite Recursion.**
Definition of a function on ordinals by specifying its value at zero, successor, and limit stages. In Isabelle/ZF, transfinite recursion is supported by the `transrec` operator. Care is needed to ensure the recursion is well-defined (the operator must be monotone or the recursion must be on a well-founded relation).

**Transitive Set.**
A set A such that every element of A is also a subset of A: if x in A and y in x, then y in A. Equivalently, Union(A) subseteq A. Ordinals are transitive sets, and the cumulative hierarchy V_alpha consists of transitive sets.

**Type Class (in Isabelle).**
A mechanism for ad-hoc polymorphism, allowing definitions and theorems to be stated generically for types satisfying certain properties. Example: the `order` type class provides a generic `<=` with associated axioms. In Isabelle/HOL, type classes are used extensively; in Isabelle/ZF, the corresponding mechanism is locales.

---

## V

**Verification Condition Generator (VCG).**
A tool that transforms a Hoare triple {P} c {Q} into a set of pure logical formulas (verification conditions) whose truth implies the correctness of the triple. In Isabelle/SIMPL, the VCG decomposes programs into subgoals at loop boundaries and function calls.

---

## W

**Weakest Precondition (wp).**
The weakest precondition wp(c, Q) is the weakest predicate P such that {P} c {Q} holds. In Isabelle, the `wp` tactic computes weakest preconditions for AutoCorres-lifted programs, reducing verification conditions to pure logical goals.

**Well-Founded Relation.**
A relation R on a set such that every non-empty subset has an R-minimal element. Equivalently, there are no infinite descending R-chains. The membership relation on sets is well-founded (by the axiom of foundation). Well-founded relations support induction and recursion in Isabelle via `wf_induct`.

**Well-Ordering.**
A total order that is also well-founded: every non-empty subset has a least element. The well-ordering theorem (equivalent to AC) states that every set can be well-ordered. Ordinals are the canonical well-ordered sets.

---

## Z

**ZF (Zermelo-Fraenkel Set Theory).**
The standard axiom system for set theory, consisting of: extensionality, empty set, pairing, union, power set, infinity, separation (schema), replacement (schema), and foundation. ZFC adds the axiom of choice. Isabelle/ZF formalizes ZF(C) as an object logic within Isabelle's metalogic.

**Zorn's Lemma.**
If every chain (totally ordered subset) of a partially ordered set has an upper bound, then the set has a maximal element. Equivalent to the axiom of choice. Used in Isabelle/ZF via the AFP entry or directly via the well-ordering theorem.

---

## Symbols and Abbreviations

| Abbreviation | Expansion |
|---|---|
| AC | Axiom of Choice |
| AFP | Archive of Formal Proofs |
| CH | Continuum Hypothesis |
| GCH | Generalized Continuum Hypothesis |
| HOL | Higher-Order Logic |
| ITP | Interactive Theorem Proving (conference) |
| CPP | Certified Programs and Proofs (conference) |
| JAR | Journal of Automated Reasoning |
| LCF | Logic for Computable Functions |
| SIMPL | Schirmer's Imperative Language |
| VCG | Verification Condition Generator |
| wp | Weakest Precondition |
| ZF | Zermelo-Fraenkel (set theory) |
| ZFC | Zermelo-Fraenkel with Choice |
