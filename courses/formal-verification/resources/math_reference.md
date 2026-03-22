# Mathematical Reference for Formal Verification

A concise reference for the logical rules, set-theoretic axioms, theorems, and program logic used throughout this course.

---

## Table of Contents

1. [Propositional Logic: Natural Deduction](#propositional-logic-natural-deduction)
2. [Predicate Logic: Natural Deduction](#predicate-logic-natural-deduction)
3. [Set Theory Axioms (ZFC)](#set-theory-axioms-zfc)
4. [Ordinal Arithmetic](#ordinal-arithmetic)
5. [Cardinal Arithmetic](#cardinal-arithmetic)
6. [Hoare Logic](#hoare-logic)
7. [Key Theorems](#key-theorems)

---

## Propositional Logic: Natural Deduction

These rules correspond directly to Isabelle's proof kernel. Each rule is an introduction or elimination rule for a logical connective.

### Conjunction

**Introduction (conjI):**

From P and Q, conclude P & Q.

**Elimination (conjE):**

From P & Q, conclude P (left projection) or Q (right projection).

In Isabelle: `conjunct1`, `conjunct2`, or pattern matching with `obtain`.

### Disjunction

**Introduction (disjI1, disjI2):**

From P, conclude P | Q (left introduction).
From Q, conclude P | Q (right introduction).

**Elimination (disjE):**

From P | Q, and P ==> R, and Q ==> R, conclude R (proof by cases).

### Implication

**Introduction (impI):**

Assuming P, if we can derive Q, then conclude P --> Q.

In Isabelle/Isar: `proof (rule impI)` / `assume "P"` / `show "Q"`.

**Elimination / Modus Ponens (mp):**

From P --> Q and P, conclude Q.

### Negation

**Introduction (notI):**

Assuming P, if we derive False, then conclude ~P (proof by contradiction of P).

**Elimination (notE):**

From ~P and P, conclude False.

### Classical Logic

**Excluded Middle (classical):**

P | ~P (for any P).

**Double Negation Elimination (notnotD):**

From ~~P, conclude P.

**Proof by Contradiction (ccontr):**

Assuming ~P, if we derive False, then conclude P.

In Isabelle: `proof (rule ccontr)`.

### Logical Equivalence

**Introduction (iffI):**

From P ==> Q and Q ==> P, conclude P <-> Q.

**Elimination (iffD1, iffD2):**

From P <-> Q and P, conclude Q (forward direction).
From P <-> Q and Q, conclude P (backward direction).

---

## Predicate Logic: Natural Deduction

### Universal Quantification

**Introduction (allI):**

If P(x) holds for an arbitrary x (not free in any assumption), conclude forall x. P(x).

In Isabelle/Isar: `fix x` / `show "P(x)"`.

**Elimination (spec):**

From forall x. P(x), conclude P(t) for any term t.

In Isabelle: `spec [of "t"]` or `simp`.

### Existential Quantification

**Introduction (exI):**

From P(t) for some specific term t, conclude exists x. P(x).

In Isabelle: `rule exI [of _ "t"]` or `rule_tac x="t" in exI`.

**Elimination (exE):**

From exists x. P(x), obtain a fresh constant c satisfying P(c) and continue the proof.

In Isabelle/Isar: `obtain c where "P(c)" by auto`.

### Equality

**Reflexivity:** x = x.

**Symmetry:** From x = y, conclude y = x.

**Transitivity:** From x = y and y = z, conclude x = z.

**Substitution (subst):** From x = y and P(x), conclude P(y).

**Leibniz's Law:** x = y if and only if for all predicates P, P(x) <-> P(y).

---

## Set Theory Axioms (ZFC)

The axioms of Zermelo-Fraenkel set theory with the axiom of choice. These are the foundational axioms formalized in Isabelle/ZF.

### Extensionality

Two sets are equal if and only if they have the same elements:

forall A B. (forall x. x in A <-> x in B) --> A = B

In Isabelle/ZF: `extension`.

### Empty Set

There exists a set with no elements:

exists A. forall x. x notin A

The empty set is denoted 0 in Isabelle/ZF.

### Pairing

For any sets a and b, there exists a set {a, b}:

forall a b. exists C. forall x. x in C <-> (x = a | x = b)

In Isabelle/ZF: `Upair_iff`.

### Union

For any set A, there exists the union of all members of A:

forall A. exists B. forall x. x in B <-> (exists Y. Y in A & x in Y)

In Isabelle/ZF: `Union_iff`.

### Power Set

For any set A, there exists the set of all subsets of A:

forall A. exists B. forall x. x in B <-> x subseteq A

In Isabelle/ZF: `Pow_iff`.

### Infinity

There exists an infinite set (an inductive set containing 0 and closed under successor):

exists A. 0 in A & (forall x. x in A --> succ(x) in A)

In Isabelle/ZF: the set `nat` (omega) is defined as the smallest such set.

### Separation (Comprehension) Schema

For any set A and formula phi(x), the set {x in A : phi(x)} exists:

forall A. exists B. forall x. x in B <-> (x in A & phi(x))

In Isabelle/ZF: `Collect_iff`, `separation`.

### Replacement Schema

For any set A and functional formula phi(x, y) (for each x in A there is a unique y), the image {y : exists x in A. phi(x, y)} is a set:

(forall x in A. exists! y. phi(x, y)) --> exists B. forall y. y in B <-> (exists x in A. phi(x, y))

In Isabelle/ZF: `Replace_iff`, `RepFun_iff`.

### Foundation (Regularity)

Every non-empty set A contains an element disjoint from A:

forall A. A != 0 --> (exists x in A. x inter A = 0)

Equivalently: the membership relation is well-founded. This enables epsilon-induction.

In Isabelle/ZF: `foundation`, `eps_induct`.

### Axiom of Choice

For any family F of non-empty sets, there exists a choice function:

forall x in F. x != 0 --> exists f. forall x in F. f(x) in x

In Isabelle/ZF: `AC`, `Zorn`, `well_ord_Memrel`.

---

## Ordinal Arithmetic

### Definitions

- **0** = {} (the empty set)
- **Successor:** succ(alpha) = alpha union {alpha}
- **Limit ordinal:** a non-zero ordinal that is not a successor
- **omega:** the first limit ordinal, equal to the set of finite ordinals {0, 1, 2, ...}

### Ordinal Addition

Defined by transfinite recursion on the second argument:

- alpha + 0 = alpha
- alpha + succ(beta) = succ(alpha + beta)
- alpha + lambda = sup_{beta < lambda} (alpha + beta) for limit lambda

### Ordinal Multiplication

Defined by transfinite recursion on the second argument:

- alpha * 0 = 0
- alpha * succ(beta) = alpha * beta + alpha
- alpha * lambda = sup_{beta < lambda} (alpha * beta) for limit lambda

### Ordinal Exponentiation

Defined by transfinite recursion on the exponent:

- alpha^0 = 1
- alpha^succ(beta) = alpha^beta * alpha
- alpha^lambda = sup_{beta < lambda} (alpha^beta) for limit lambda (and alpha > 0)

### Key Identities

**Addition:**

- Associativity: (alpha + beta) + gamma = alpha + (beta + gamma)
- Left cancellation: alpha + beta = alpha + gamma implies beta = gamma
- NOT commutative: 1 + omega = omega != omega + 1

**Multiplication:**

- Associativity: (alpha * beta) * gamma = alpha * (beta * gamma)
- Left distributivity: alpha * (beta + gamma) = alpha * beta + alpha * gamma
- NOT right distributive: (1 + 1) * omega = omega != omega + omega = 1 * omega + 1 * omega is wrong; rather (omega + 1) * 2 = omega + 1 + omega + 1 = omega * 2 + 1, not omega * 2 + 2
- NOT commutative: 2 * omega = omega != omega * 2

**Exponentiation:**

- alpha^(beta + gamma) = alpha^beta * alpha^gamma
- (alpha^beta)^gamma = alpha^(beta * gamma)

### Cantor Normal Form

Every ordinal alpha > 0 can be uniquely written as:

alpha = omega^{beta_1} * c_1 + omega^{beta_2} * c_2 + ... + omega^{beta_n} * c_n

where beta_1 > beta_2 > ... > beta_n >= 0 and each c_i is a positive finite ordinal.

---

## Cardinal Arithmetic

### Definitions

- **|A|** = the cardinality of set A = the least ordinal equinumerous with A (requires AC)
- **aleph_0** = |omega| = the smallest infinite cardinal
- **aleph_{alpha}** = the alpha-th infinite cardinal
- **A ~= B** means there exists a bijection f: A -> B (A and B are equinumerous)

### Cardinal Operations

**Cardinal sum:** |A| + |B| = |A disjoint-union B|

**Cardinal product:** |A| * |B| = |A x B|

**Cardinal exponentiation:** |A|^|B| = |A^B| (the set of functions from B to A)

### Key Identities

For infinite cardinals kappa and lambda:

- kappa + kappa = kappa (idempotent addition)
- kappa * kappa = kappa (idempotent multiplication)
- kappa + lambda = kappa * lambda = max(kappa, lambda)
- 2^kappa > kappa (Cantor's theorem)
- kappa^cf(kappa) > kappa (Konig's theorem)

### Konig's Theorem

If kappa_i < lambda_i for all i in I, then:

sum_{i in I} kappa_i < prod_{i in I} lambda_i

This is the most important theorem in cardinal arithmetic after Cantor's theorem.

### Cofinality

- cf(kappa) is always a regular cardinal
- cf(alpha) <= alpha for all ordinals alpha
- cf(omega) = omega
- cf(aleph_1) = aleph_1 (aleph_1 is regular)
- cf(aleph_omega) = omega (aleph_omega is singular)

---

## Hoare Logic

### Partial Correctness Rules

**Assignment:**

{P[e/x]} x := e {P}

The postcondition with x replaced by e must hold before the assignment.

**Sequence:**

From {P} c1 {Q} and {Q} c2 {R}, conclude {P} c1; c2 {R}.

**Conditional:**

From {P & B} c1 {Q} and {P & ~B} c2 {Q}, conclude {P} if B then c1 else c2 {Q}.

**While Loop (Partial Correctness):**

From {I & B} c {I}, conclude {I} while B do c {I & ~B}.

I is the loop invariant. This rule only gives partial correctness (does not prove termination).

**Consequence (Strengthening/Weakening):**

From P' ==> P and {P} c {Q} and Q ==> Q', conclude {P'} c {Q'}.

Preconditions can be strengthened; postconditions can be weakened.

### Total Correctness

**While Loop (Total Correctness):**

From {I & B & V = n} c {I & V < n} and "V >= 0 whenever I & B holds", conclude [I] while B do c [I & ~B].

V is a variant (measure) that decreases with each iteration and is bounded below. This additionally proves termination.

### Frame Rule (Separation Logic)

From {P} c {Q}, conclude {P * R} c {Q * R}, provided c does not modify the free variables of R.

The frame rule allows local reasoning: if c is correct with respect to the footprint P, then it is also correct in a larger heap P * R.

---

## Key Theorems

### Set Theory

**Cantor's Theorem.** For any set A, there is no surjection from A to P(A). Equivalently, |A| < |P(A)|. In particular, there is no set of all sets.

**Schroeder-Bernstein Theorem.** If there exist injections f: A -> B and g: B -> A, then there exists a bijection h: A -> B. Equivalently, |A| <= |B| and |B| <= |A| implies |A| = |B|. Does not require the axiom of choice.

**Well-Ordering Theorem.** Every set can be well-ordered. Equivalent to the axiom of choice.

**Zorn's Lemma.** If every chain in a partially ordered set has an upper bound, then the set has a maximal element. Equivalent to the axiom of choice.

**Knaster-Tarski Fixed-Point Theorem.** Every monotone function on a complete lattice has a least fixed point (and a greatest fixed point). The least fixed point is the intersection of all pre-fixed points. Used to define inductive sets in ZF.

**Hartogs' Theorem.** For every set A, there exists an ordinal alpha that cannot be injected into A. Hence there is no set of all ordinals.

**Fixed-Point Lemma for Normal Functions.** Every normal function on ordinals has a proper class of fixed points. The enumerating function of the fixed points is itself normal.

**Mostowski Collapse Lemma.** Every well-founded extensional structure is isomorphic to a unique transitive set. The isomorphism is called the Mostowski collapse.

**Reflection Principle.** For any finite collection of formulas, there exist arbitrarily large ordinals alpha such that V_alpha reflects those formulas (satisfies the same sentences as V).

**Easton's Theorem.** The continuum function on regular cardinals can be essentially arbitrary (subject to Konig's theorem): for any class function F on regular cardinals satisfying cf(F(kappa)) > kappa, there is a model of ZFC in which 2^kappa = F(kappa) for all regular kappa.

### Logic

**Goedel's Completeness Theorem.** A first-order sentence is provable if and only if it is true in all models. Equivalently, a consistent set of sentences has a model.

**Goedel's First Incompleteness Theorem.** Any consistent, recursively axiomatizable theory that can express basic arithmetic contains true statements that are unprovable.

**Goedel's Second Incompleteness Theorem.** Any consistent theory satisfying the conditions of the first theorem cannot prove its own consistency.

**Compactness Theorem.** A set of first-order sentences has a model if and only if every finite subset has a model.

**Lowenheim-Skolem Theorem.** If a countable first-order theory has an infinite model, then it has models of every infinite cardinality. (Downward: also has a countable model.)

### Verified Software

**Cook's Theorem (Relative Completeness of Hoare Logic).** Hoare's proof system is complete relative to the underlying assertion language: if a Hoare triple is valid, then it is provable, provided the assertion language can express all necessary loop invariants and the theory of the underlying data types is decidable.

**Soundness of Hoare Logic.** If a Hoare triple {P} c {Q} is derivable using the Hoare rules, then it is valid: for every state satisfying P, if c terminates, then the resulting state satisfies Q.
