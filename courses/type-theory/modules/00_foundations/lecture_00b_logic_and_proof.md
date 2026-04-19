---
title: "Lecture 00b: Logic and Proof Techniques"
tags:
  - type-theory
  - foundations
  - lecture
---
# Lecture 00b: Logic and Proof Techniques

> **Module 00 --- Mathematical Foundations (Pre-Work)**
> Estimated study time: 6--8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define the syntax and semantics of propositional logic and evaluate formulas using truth tables and valuations.
2. Construct and verify proofs using direct proof, proof by contradiction, proof by contrapositive, and proof by cases.
3. Define the syntax of first-order predicate logic, distinguish free and bound variables, and apply capture-avoiding substitution.
4. Construct natural deduction proofs using introduction and elimination rules for all propositional connectives and quantifiers.
5. State the soundness and completeness of natural deduction with respect to classical semantics.
6. Describe the sequent calculus LK and explain how its structural rules relate to substructural type systems.
7. Recognize inference rules as the syntactic format shared by proof systems and typing judgments.
8. Translate informal mathematical arguments into formal derivation trees.

---

## 1. Motivation: Why Logic Is the Skeleton of Type Theory

Type theory is, at its core, a formal system of inference rules. When we write a typing judgment such as

$$\Gamma \vdash e : \tau$$

we are asserting that under assumptions $\Gamma$, the expression $e$ has type $\tau$. The turnstile $\vdash$, the horizontal bar separating premises from conclusions, the side conditions---all of this machinery comes directly from formal logic. The Curry--Howard correspondence makes the connection precise: propositions are types, proofs are programs, and the rules of natural deduction become the typing rules of the simply typed lambda calculus.

Before we can study type systems, we must therefore be fluent in the language of logic. This lecture covers propositional and predicate logic, standard proof techniques, natural deduction, and a brief introduction to sequent calculus. Every definition and proof method introduced here will reappear---often verbatim---when we define type systems, prove type safety, and reason about program behavior.

A note on perspective: we study logic here not as an end in itself, but as the raw material from which type systems are constructed. The reader who has taken a first course in mathematical logic can skim the early sections on syntax and semantics, but should pay close attention to the sections on natural deduction and the sequent calculus, where the connections to type theory are made explicit.

---

## 2. Core Theory

### 2.1 Propositional Logic: Syntax

**Definition (Propositional formulas).** Let $\mathcal{P} = \{p, q, r, \ldots\}$ be a countably infinite set of *propositional variables*. The set $\mathsf{Prop}$ of *propositional formulas* is defined inductively by the grammar:

$$\varphi, \psi ::= p \mid \top \mid \bot \mid \neg \varphi \mid \varphi \land \psi \mid \varphi \lor \psi \mid \varphi \to \psi \mid \varphi \leftrightarrow \psi$$

where $p \in \mathcal{P}$.

The connectives, in decreasing order of binding precedence, are: $\neg$ (strongest), $\land$, $\lor$, $\to$, $\leftrightarrow$ (weakest). Implication $\to$ is right-associative: $\varphi \to \psi \to \chi$ means $\varphi \to (\psi \to \chi)$.

**Remark.** This definition is itself an *inductive definition* of a set of syntactic objects---a pattern we will see constantly. Every inductive definition gives rise to a principle of structural induction (Lecture 00c), and every grammar like the one above can be read as defining the *abstract syntax trees* of a language. The very first thing we do in type theory is define the syntax of terms by such a grammar.

**Definition (Parse trees / Abstract syntax trees).** Each formula $\varphi \in \mathsf{Prop}$ has a unique *parse tree* (abstract syntax tree, or AST). The leaves are propositional variables or the constants $\top, \bot$. Each internal node is labeled by a connective and has one child (for $\neg$) or two children (for binary connectives). We define the *size* $|\varphi|$ of a formula as the number of nodes in its parse tree, and the *depth* $\mathrm{depth}(\varphi)$ as the height of the tree.

**Formal definition of size.** The size function is defined recursively on the AST:

$$|p| = 1, \quad |\top| = 1, \quad |\bot| = 1$$

$$|\neg \varphi| = 1 + |\varphi|$$

$$|\varphi \star \psi| = 1 + |\varphi| + |\psi| \quad \text{for } \star \in \{\land, \lor, \to, \leftrightarrow\}$$

**Example.** The formula $(p \to q) \land (\neg q \to \neg p)$ has size 9 (counting each variable occurrence and each connective as one node) and depth 3.

**Definition (Subformula).** The set $\mathrm{Sub}(\varphi)$ of *subformulas* of $\varphi$ is defined inductively:

$$\mathrm{Sub}(p) = \{p\}, \quad \mathrm{Sub}(\top) = \{\top\}, \quad \mathrm{Sub}(\bot) = \{\bot\}$$

$$\mathrm{Sub}(\neg \varphi) = \{\neg \varphi\} \cup \mathrm{Sub}(\varphi)$$

$$\mathrm{Sub}(\varphi \star \psi) = \{\varphi \star \psi\} \cup \mathrm{Sub}(\varphi) \cup \mathrm{Sub}(\psi)$$

A formula $\psi$ is a *proper subformula* of $\varphi$ if $\psi \in \mathrm{Sub}(\varphi)$ and $\psi \ne \varphi$. Note that $|\mathrm{Sub}(\varphi)| \le |\varphi|$, with equality when no subformula occurs more than once.

**Connection to type theory.** In type theory, we define the set of types analogously. For instance, the types of the simply typed lambda calculus are given by $\tau ::= \alpha \mid \tau_1 \to \tau_2$, which is syntactically isomorphic to a fragment of propositional logic (just implication and variables). The subformula/subtype relation plays a role in deciding type equivalence and in arguments about the size of types.

**Definition (Unique readability).** A fundamental property of inductively defined grammars is *unique readability*: every formula has exactly one parse tree. This means that for any formula $\varphi$, there is exactly one way to decompose it into its principal connective and its immediate subformulas. Unique readability is essential for two reasons:

1. It ensures that the recursive definition of semantics ($\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v$) is well-defined: the truth value of a formula is determined unambiguously by the truth values of its subformulas.
2. It ensures that structural induction on formulas is valid: every formula falls into exactly one case.

**Proposition (Unique readability for $\mathsf{Prop}$).** Every formula $\varphi \in \mathsf{Prop}$ is exactly one of: (a) a propositional variable $p$, (b) a constant $\top$ or $\bot$, (c) a negation $\neg \psi$, or (d) a binary connective $\psi_1 \star \psi_2$ for some $\star \in \{\land, \lor, \to, \leftrightarrow\}$. In cases (c) and (d), the subformula(s) are uniquely determined.

*Proof sketch.* The different constructors produce syntactically distinct forms. A variable $p$ is a single symbol. A negation $\neg \psi$ begins with $\neg$. A binary formula $\psi_1 \star \psi_2$ (in fully parenthesized form) begins with a left parenthesis. No two constructors can produce the same string. Uniqueness of the decomposition follows from unique parsing of balanced parentheses. $\square$

This property has an exact analogue in type theory: every well-formed term of the lambda calculus is uniquely either a variable, an application, or an abstraction, and the components are uniquely determined. This *unique decomposition property* is what makes definition by cases (pattern matching) on terms well-defined.

### 2.2 Propositional Logic: Semantics

**Definition (Valuation).** A *valuation* is a function $v : \mathcal{P} \to \{0, 1\}$ assigning a truth value to each propositional variable. We sometimes write $\mathbb{B} = \{0, 1\}$ for the set of Boolean truth values, with $0 =$ false and $1 =$ true.

Given a valuation $v$, the *truth value* $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v \in \{0, 1\}$ of a formula $\varphi$ is defined recursively on the structure of $\varphi$:

$$\lbrack\!\lbrack p \rbrack\!\rbrack_v = v(p)$$

$$\lbrack\!\lbrack \top \rbrack\!\rbrack_v = 1, \quad \lbrack\!\lbrack \bot \rbrack\!\rbrack_v = 0$$

$$\lbrack\!\lbrack \neg \varphi \rbrack\!\rbrack_v = 1 - \lbrack\!\lbrack \varphi \rbrack\!\rbrack_v$$

$$\lbrack\!\lbrack \varphi \land \psi \rbrack\!\rbrack_v = \min(\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v, \lbrack\!\lbrack \psi \rbrack\!\rbrack_v)$$

$$\lbrack\!\lbrack \varphi \lor \psi \rbrack\!\rbrack_v = \max(\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v, \lbrack\!\lbrack \psi \rbrack\!\rbrack_v)$$

$$\lbrack\!\lbrack \varphi \to \psi \rbrack\!\rbrack_v = \max(1 - \lbrack\!\lbrack \varphi \rbrack\!\rbrack_v, \lbrack\!\lbrack \psi \rbrack\!\rbrack_v)$$

$$\lbrack\!\lbrack \varphi \leftrightarrow \psi \rbrack\!\rbrack_v = \begin{cases} 1 & \text{if } \lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = \lbrack\!\lbrack \psi \rbrack\!\rbrack_v \\ 0 & \text{otherwise} \end{cases}

$$
This definition is *compositional*: the truth value of a compound formula is determined entirely by the truth values of its immediate subformulas. Compositionality is a pervasive design principle in semantics---both for logics and for programming languages.

**Remark (Material implication).** The truth table for $\to$ assigns $\lbrack\!\lbrack \varphi \to \psi \rbrack\!\rbrack_v = 1$ whenever $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 0$. This is *material implication*: a false hypothesis implies anything. While initially counterintuitive, this convention is essential for the equivalence between $\varphi \to \psi$ and $\neg \varphi \lor \psi$, and it corresponds precisely to the behavior of functions in type theory: a function of type $\mathsf{Void} \to B$ can be defined (vacuously) for any $B$.

**Definition (Satisfiability, tautology, contradiction).** A formula $\varphi$ is:
- *satisfiable* if $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 1$ for some valuation $v$;
- a *tautology* (written $\models \varphi$) if $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 1$ for every valuation $v$;
- *unsatisfiable* (a *contradiction*) if $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 0$ for every valuation $v$.

**Proposition.** $\varphi$ is a tautology iff $\neg \varphi$ is unsatisfiable.

*Proof.* $\models \varphi$ iff for all $v$, $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 1$ iff for all $v$, $\lbrack\!\lbrack \neg \varphi \rbrack\!\rbrack_v = 0$ iff $\neg \varphi$ is unsatisfiable. $\square$

**Definition (Semantic entailment).** A set of formulas $\Phi$ *semantically entails* $\psi$ (written $\Phi \models \psi$) if every valuation that makes all formulas in $\Phi$ true also makes $\psi$ true. When $\Phi = \{\varphi_1, \ldots, \varphi_n\}$, we write $\varphi_1, \ldots, \varphi_n \models \psi$.

**Definition (Logical equivalence).** Formulas $\varphi$ and $\psi$ are *logically equivalent* (written $\varphi \equiv \psi$) if $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = \lbrack\!\lbrack \psi \rbrack\!\rbrack_v$ for every valuation $v$. Equivalently, $\varphi \equiv \psi$ iff $\models \varphi \leftrightarrow \psi$.

**Theorem (Deduction theorem, semantic version).** $\Phi, \varphi \models \psi$ if and only if $\Phi \models \varphi \to \psi$.

*Proof.* ($\Rightarrow$) Let $v$ be any valuation satisfying all formulas in $\Phi$. If $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 0$, then $\lbrack\!\lbrack \varphi \to \psi \rbrack\!\rbrack_v = 1$ by definition of $\to$. If $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 1$, then $v$ satisfies all of $\Phi \cup \{\varphi\}$, so by hypothesis $\lbrack\!\lbrack \psi \rbrack\!\rbrack_v = 1$, whence $\lbrack\!\lbrack \varphi \to \psi \rbrack\!\rbrack_v = 1$.

($\Leftarrow$) Let $v$ satisfy all of $\Phi \cup \{\varphi\}$. By hypothesis, $\lbrack\!\lbrack \varphi \to \psi \rbrack\!\rbrack_v = 1$. Since $\lbrack\!\lbrack \varphi \rbrack\!\rbrack_v = 1$, we must have $\lbrack\!\lbrack \psi \rbrack\!\rbrack_v = 1$. $\square$

**Truth tables.** For a formula with $n$ distinct propositional variables, the truth table has $2^n$ rows. While truth tables are a decision procedure for propositional validity (check all $2^n$ rows), they scale exponentially and do not constitute a structured *proof method*. We need proof systems that construct derivations step by step.

**Key tautologies.** The following are tautologies that appear throughout type theory. Each can be verified by truth table.

| Name | Formula |
|------|---------|
| Modus ponens | $(p \to q) \land p \to q$ |
| Hypothetical syllogism | $(p \to q) \land (q \to r) \to (p \to r)$ |
| Contrapositive | $(p \to q) \leftrightarrow (\neg q \to \neg p)$ |
| De Morgan (1) | $\neg(p \land q) \leftrightarrow (\neg p \lor \neg q)$ |
| De Morgan (2) | $\neg(p \lor q) \leftrightarrow (\neg p \land \neg q)$ |
| Double negation | $p \leftrightarrow \neg\neg p$ |
| Excluded middle | $p \lor \neg p$ |
| Explosion | $\bot \to p$ |
| Currying | $(p \land q \to r) \leftrightarrow (p \to q \to r)$ |
| Distribution | $p \land (q \lor r) \leftrightarrow (p \land q) \lor (p \land r)$ |
| Absorption | $p \land (p \lor q) \leftrightarrow p$ |

The currying equivalence is the logical counterpart of the programming language operation of the same name. Under the Curry--Howard correspondence, the biconditional becomes an isomorphism between the types $A \times B \to C$ and $A \to B \to C$.

**Theorem (Functional completeness).** Every Boolean function $f : \{0,1\}^n \to \{0,1\}$ can be expressed as a propositional formula using only the connectives $\neg$ and $\land$ (or $\neg$ and $\lor$, or $\neg$ and $\to$).

*Proof sketch.* Given $f$, construct the disjunctive normal form (DNF): for each row of the truth table where $f$ outputs 1, form the conjunction of the corresponding literals, then take the disjunction of all such conjunctions. This uses $\neg$, $\land$, and $\lor$, but $\lor$ can be defined as $\varphi \lor \psi \equiv \neg(\neg \varphi \land \neg \psi)$ (De Morgan). $\square$

**Connection to type theory.** Functional completeness tells us that $\{\neg, \land\}$ suffices to express any truth function. In type-theoretic terms, $\{A \to \mathsf{Void}, A \times B\}$ (negation and products) are not enough to express all types, because we also need function types $A \to B$ (which do not reduce to $\neg$ and $\land$ in a constructive setting). The constructive reading of logic fundamentally changes which connectives are "primitive."

### 2.3 Proof Techniques

We now review the standard methods of mathematical proof. Each method has a corresponding logical principle and, via Curry--Howard, a corresponding programming pattern.

#### 2.3.1 Direct Proof

To prove $\varphi \to \psi$: assume $\varphi$ and derive $\psi$.

**Theorem.** For all integers $n$, if $n$ is even, then $n^2$ is even.

*Proof.* Assume $n$ is even, so $n = 2k$ for some integer $k$. Then $n^2 = (2k)^2 = 4k^2 = 2(2k^2)$. Since $2k^2$ is an integer, $n^2$ is even. $\square$

**Connection to type theory.** A direct proof of $A \to B$ corresponds to a lambda abstraction $\lambda x{:}A.\, e$ where $e : B$ is constructed using the assumption $x : A$. The assumption $x : A$ is "discharged" by the lambda, just as the assumption $\varphi$ is discharged by the implication introduction rule.

**Example (chained implication).** To prove $A \to B \to C$, assume $A$, then assume $B$, and derive $C$ using both assumptions. This corresponds to $\lambda x{:}A.\, \lambda y{:}B.\, e$ where $e : C$ may use both $x$ and $y$.

#### 2.3.2 Proof by Contradiction (Reductio ad Absurdum)

To prove $\varphi$: assume $\neg \varphi$ and derive $\bot$ (a contradiction).

**Theorem.** $\sqrt{2}$ is irrational.

*Proof.* Assume for contradiction that $\sqrt{2} = p/q$ where $p, q$ are integers with $\gcd(p, q) = 1$. Then $2 = p^2/q^2$, so $p^2 = 2q^2$. This means $p^2$ is even, hence $p$ is even (since if $p$ were odd, $p^2$ would be odd). Write $p = 2k$. Then $4k^2 = 2q^2$, so $q^2 = 2k^2$, meaning $q$ is also even. But then $\gcd(p, q) \ge 2$, contradicting $\gcd(p, q) = 1$. $\square$

**Connection to type theory.** Proof by contradiction uses the law of excluded middle ($\varphi \lor \neg \varphi$) or equivalently double-negation elimination ($\neg\neg \varphi \to \varphi$). In *constructive* type theories (such as those based on Martin-Lof type theory or the Calculus of Inductive Constructions used by Coq), proof by contradiction is *not* available in general. This is a fundamental difference between classical and constructive logic, and it has deep consequences for the computational interpretation of proofs.

Computationally, double-negation elimination corresponds to *call-with-current-continuation* (call/cc), a control operator that captures the current continuation. Griffin (1990) showed that adding call/cc to a typed language corresponds to adding classical reasoning to the logic. Thus classical logic is not "wrong," but it adds computational power (continuations) that may be undesirable in some settings.

#### 2.3.3 Proof by Contrapositive

To prove $\varphi \to \psi$: prove $\neg \psi \to \neg \varphi$ instead.

**Theorem.** For all integers $n$, if $n^2$ is odd, then $n$ is odd.

*Proof.* We prove the contrapositive: if $n$ is even, then $n^2$ is even. This was shown above. $\square$

**Remark.** The equivalence of $\varphi \to \psi$ and $\neg \psi \to \neg \varphi$ splits into two directions:
- *Forward* (modus tollens): $(\varphi \to \psi) \to (\neg \psi \to \neg \varphi)$. This is intuitionistically valid.
- *Reverse*: $(\neg \psi \to \neg \varphi) \to (\varphi \to \psi)$. This requires classical reasoning (specifically, double negation elimination).

In constructive type theory, we can always prove $(\varphi \to \psi) \to (\neg \psi \to \neg \varphi)$ (just compose the function $f : A \to B$ with $g : B \to \mathsf{Void}$ to get $g \circ f : A \to \mathsf{Void}$), but we cannot in general go the other way.

#### 2.3.4 Proof by Cases (Case Analysis)

To prove $\varphi$ when we know $\psi_1 \lor \psi_2$: prove $\psi_1 \to \varphi$ and $\psi_2 \to \varphi$ separately.

**Theorem.** For all integers $n$, $n^2 + n$ is even.

*Proof.* Either $n$ is even or $n$ is odd.

*Case 1:* $n = 2k$. Then $n^2 + n = 4k^2 + 2k = 2(2k^2 + k)$, which is even.

*Case 2:* $n = 2k + 1$. Then $n^2 + n = (2k+1)^2 + (2k+1) = 4k^2 + 4k + 1 + 2k + 1 = 4k^2 + 6k + 2 = 2(2k^2 + 3k + 1)$, which is even. $\square$

**Connection to type theory.** Case analysis on $A + B$ (a sum type / disjoint union) corresponds to pattern matching. The elimination rule for disjunction in natural deduction becomes the typing rule for case expressions:

$$\frac{\Gamma \vdash e : A + B \quad \Gamma, x{:}A \vdash e_1 : C \quad \Gamma, y{:}B \vdash e_2 : C}{\Gamma \vdash \mathsf{case}\;e\;\mathsf{of}\;\mathsf{inl}\;x \Rightarrow e_1 \mid \mathsf{inr}\;y \Rightarrow e_2 : C}$$

This is one of the most important typing rules in practice. Pattern matching in ML, Haskell, Rust, and similar languages is the computational manifestation of proof by cases.

#### 2.3.5 Proof by Construction (Existence Proofs)

To prove $\exists x.\, \varphi(x)$: exhibit a specific witness $a$ and verify $\varphi(a)$.

**Theorem.** There exists a prime $p$ such that $p \equiv 3 \pmod{4}$ and $p > 100$.

*Proof.* Take $p = 103$. Then $103$ is prime (check divisibility by primes up to $\lfloor\sqrt{103}\rfloor = 10$: it is not divisible by 2, 3, 5, or 7) and $103 = 25 \cdot 4 + 3 \equiv 3 \pmod{4}$. $\square$

**Connection to type theory.** An existence proof corresponds to constructing a dependent pair $\langle a, e \rangle : \Sigma x{:}A.\, B(x)$, where $a : A$ is the witness and $e : B(a)$ is the evidence. Constructive mathematics *requires* witnesses---a non-constructive existence proof (e.g., one that uses contradiction to show $\exists x.\, P(x)$ without exhibiting a specific $x$) does not correspond to a program that computes the witness.

#### 2.3.6 Proof by Unique Existence

To prove $\exists! x.\, \varphi(x)$ (there exists a unique $x$ satisfying $\varphi$): first prove existence ($\exists x.\, \varphi(x)$), then prove uniqueness (if $\varphi(a)$ and $\varphi(b)$, then $a = b$).

**Theorem.** For every positive real number $y$, there exists a unique positive real number $x$ such that $x^2 = y$.

*Proof sketch.* Existence: the intermediate value theorem guarantees an $x > 0$ with $f(x) = x^2 - y = 0$. Uniqueness: if $a^2 = b^2 = y$ and $a, b > 0$, then $a^2 - b^2 = (a - b)(a + b) = 0$, and since $a + b > 0$, we get $a = b$. $\square$

**Connection to type theory.** Unique existence in type theory corresponds to a *contractible* type: a type $A$ together with an element $a : A$ and a proof that every other element is equal to $a$. In homotopy type theory, this is captured by the notion of a type being a *proposition* (having at most one element up to paths).

### 2.4 Predicate Logic (First-Order Logic)

#### 2.4.1 Syntax

**Definition (First-order language).** A *first-order language* $\mathcal{L}$ consists of:
- A set of *function symbols* $f, g, h, \ldots$, each with a fixed arity. Constants are 0-ary function symbols. For instance, $0$ and $1$ might be constants (0-ary), $S$ (successor) might be unary, and $+$ might be binary.
- A set of *relation symbols* (predicates) $P, Q, R, \ldots$, each with a fixed arity. For instance, $=$ is a binary relation symbol, and $\mathsf{Even}$ might be a unary predicate.
- A countably infinite set of *variables* $x, y, z, \ldots$

**Definition (Terms).** The set of *terms* of $\mathcal{L}$ is defined inductively:

$$t ::= x \mid f(t_1, \ldots, t_n) \quad \text{where } f \text{ has arity } n$$

Variables are terms, and applying an $n$-ary function symbol to $n$ terms produces a new term. Constants $c$ are written as $c$ (equivalently, $c()$).

**Definition (Formulas).** The set of *first-order formulas* of $\mathcal{L}$ is defined inductively:

$$\varphi, \psi ::= P(t_1, \ldots, t_n) \mid t_1 = t_2 \mid \top \mid \bot \mid \neg \varphi \mid \varphi \land \psi \mid \varphi \lor \psi \mid \varphi \to \psi \mid \forall x.\, \varphi \mid \exists x.\, \varphi$$

where $P$ has arity $n$, $t_i$ are terms, and $x$ is a variable.

The formulas $P(t_1, \ldots, t_n)$ and $t_1 = t_2$ are *atomic formulas*. A formula with no quantifiers is *quantifier-free*.

**Remark (Scope and precedence).** Quantifiers bind more tightly than binary connectives but less tightly than $\neg$. Thus $\forall x.\, P(x) \to Q(x)$ is parsed as $\forall x.\, (P(x) \to Q(x))$, not as $(\forall x.\, P(x)) \to Q(x)$. When in doubt, add explicit parentheses. Getting scope right is essential---an incorrect parse can change the meaning of a formula entirely.

#### 2.4.2 Free and Bound Variables

**Definition.** An occurrence of variable $x$ in formula $\varphi$ is *bound* if it falls within the scope of a quantifier $\forall x$ or $\exists x$. Otherwise, it is *free*. The set of free variables $\mathrm{FV}(\varphi)$ is defined inductively:

$$\mathrm{FV}(P(t_1, \ldots, t_n)) = \mathrm{Vars}(t_1) \cup \cdots \cup \mathrm{Vars}(t_n)$$

$$\mathrm{FV}(t_1 = t_2) = \mathrm{Vars}(t_1) \cup \mathrm{Vars}(t_2)$$

$$\mathrm{FV}(\neg \varphi) = \mathrm{FV}(\varphi)$$

$$\mathrm{FV}(\varphi \land \psi) = \mathrm{FV}(\varphi) \cup \mathrm{FV}(\psi) \quad \text{(similarly for } \lor, \to, \leftrightarrow\text{)}$$

$$\mathrm{FV}(\forall x.\, \varphi) = \mathrm{FV}(\varphi) \setminus \{x\} \quad \text{(similarly for } \exists\text{)}$$

where $\mathrm{Vars}(t)$ is the set of variables occurring in term $t$, defined by $\mathrm{Vars}(x) = \{x\}$ and $\mathrm{Vars}(f(t_1, \ldots, t_n)) = \mathrm{Vars}(t_1) \cup \cdots \cup \mathrm{Vars}(t_n)$.

A formula with no free variables is called a *sentence* or *closed formula*.

**Example.** In the formula $\forall x.\, (P(x, y) \to \exists y.\, Q(x, y, z))$:
- $x$ is bound by $\forall x$.
- The first occurrence of $y$ (in $P(x, y)$) is free.
- The second occurrence of $y$ (in $Q(x, y, z)$) is bound by $\exists y$.
- $z$ is free.

So $\mathrm{FV}(\forall x.\, (P(x, y) \to \exists y.\, Q(x, y, z))) = \{y, z\}$.

Note that the same variable $y$ occurs both free and bound in this formula. While syntactically valid, this is poor style and a common source of confusion. We should rename the bound $y$ to get $\forall x.\, (P(x, y) \to \exists w.\, Q(x, w, z))$.

**Connection to type theory.** The distinction between free and bound variables is absolutely central to the lambda calculus and hence to type theory. In the lambda term $\lambda x.\, x\,y$, the variable $x$ is bound by the $\lambda$-binder and $y$ is free. The set $\mathrm{FV}(\lambda x.\, e) = \mathrm{FV}(e) \setminus \{x\}$ mirrors the quantifier case exactly. Getting variable binding right---particularly avoiding variable capture during substitution---is one of the most subtle aspects of formalizing type systems. Entire Ph.D. theses have been written on the representation of binding in mechanized metatheory (e.g., de Bruijn indices, locally nameless representation, higher-order abstract syntax).

#### 2.4.3 Substitution

**Definition (Substitution in terms).** The substitution $t[s/x]$, which replaces free occurrences of $x$ in term $t$ by term $s$, is defined:

$$x[s/x] = s$$

$$y[s/x] = y \quad \text{for } y \ne x$$

$$f(t_1, \ldots, t_n)[s/x] = f(t_1[s/x], \ldots, t_n[s/x])$$

**Definition (Capture-avoiding substitution in formulas).** The substitution $\varphi[t/x]$, read "substitute $t$ for free occurrences of $x$ in $\varphi$," is defined inductively:

$$P(t_1, \ldots, t_n)[t/x] = P(t_1[t/x], \ldots, t_n[t/x])$$

$$(t_1 = t_2)[t/x] = (t_1[t/x] = t_2[t/x])$$

$$(\neg \varphi)[t/x] = \neg(\varphi[t/x])$$

$$(\varphi \land \psi)[t/x] = \varphi[t/x] \land \psi[t/x] \quad \text{(similarly for other binary connectives)}$$

$$(\forall y.\, \varphi)[t/x] = \begin{cases} \forall y.\, \varphi & \text{if } x = y \\ \forall y.\, \varphi[t/x] & \text{if } x \ne y \text{ and } y \notin \mathrm{Vars}(t) \\ \forall z.\, (\varphi[z/y])[t/x] & \text{if } x \ne y \text{ and } y \in \mathrm{Vars}(t), \text{ where } z \text{ is fresh} \end{cases}

$$
The third case is *capture avoidance*: we rename the bound variable to prevent the substituted term $t$ from being "captured" by the quantifier. The fresh variable $z$ must not occur free in $\varphi$ or $t$.

**Example.** Consider $\varphi = \forall y.\, P(x, y)$ and let $t = f(y)$. A naive substitution $(\forall y.\, P(x, y))[f(y)/x]$ would give $\forall y.\, P(f(y), y)$, which incorrectly binds the $y$ in $f(y)$ under the $\forall y$. The capture-avoiding substitution first renames: we choose a fresh variable $z$ and compute $(\forall z.\, P(x, z))[f(y)/x] = \forall z.\, P(f(y), z)$, which correctly keeps $y$ free.

**Example.** Consider $\varphi = \exists y.\, (x + y = z)$ and let $t = y + 1$. Then $\varphi[t/x]$ should be $\exists w.\, ((y + 1) + w = z)$ (renaming the bound $y$ to $w$ to avoid capture), not $\exists y.\, ((y + 1) + y = z)$.

**Connection to type theory.** Substitution in the lambda calculus is defined by essentially the same clauses. The critical case is:

$$(\lambda y.\, e)[s/x] = \begin{cases} \lambda y.\, e & \text{if } x = y \\ \lambda y.\, (e[s/x]) & \text{if } x \ne y \text{ and } y \notin \mathrm{FV}(s) \\ \lambda z.\, (e[z/y])[s/x] & \text{if } x \ne y \text{ and } y \in \mathrm{FV}(s), \text{ where } z \text{ is fresh} \end{cases}

$$

The *substitution lemma*---"if $\Gamma, x{:}A \vdash e : B$ and $\Gamma \vdash e' : A$, then $\Gamma \vdash e[e'/x] : B$"---is one of the most important lemmas in type theory, and its proof goes by structural induction on the derivation (Lecture 00c). The lambda/quantifier case is always where the difficulty lies, precisely because of capture avoidance.

#### 2.4.4 Semantics

**Definition (First-order structure).** A *structure* (or *model*, or *interpretation*) $\mathcal{M}$ for a first-order language $\mathcal{L}$ consists of:
- A nonempty set $|\mathcal{M}|$ called the *domain* (or *universe*);
- For each $n$-ary function symbol $f$, a function $f^{\mathcal{M}} : |\mathcal{M}|^n \to |\mathcal{M}|$;
- For each $n$-ary relation symbol $R$, a relation $R^{\mathcal{M}} \subseteq |\mathcal{M}|^n$.

**Example.** Let $\mathcal{L}$ have a constant $0$, a unary function $S$, a binary function $+$, and a binary relation $<$. The *standard model* $\mathcal{N}$ of arithmetic has $|\mathcal{N}| = \mathbb{N}$, $0^{\mathcal{N}} = 0$, $S^{\mathcal{N}}(n) = n + 1$, $+^{\mathcal{N}}(m, n) = m + n$, and $<^{\mathcal{N}} = \{(m, n) \in \mathbb{N}^2 : m < n\}$.

**Definition (Variable assignment).** A *variable assignment* in $\mathcal{M}$ is a function $\rho : \mathrm{Var} \to |\mathcal{M}|$. For a variable assignment $\rho$, the notation $\rho[x \mapsto a]$ denotes the assignment that maps $x$ to $a$ and agrees with $\rho$ on all other variables:

$$\rho[x \mapsto a](y) = \begin{cases} a & \text{if } y = x \\ \rho(y) & \text{if } y \ne x \end{cases}

$$
**Definition (Interpretation of terms).** Given a structure $\mathcal{M}$ and assignment $\rho$, the interpretation $\lbrack\!\lbrack t \rbrack\!\rbrack_{\mathcal{M}, \rho} \in |\mathcal{M}|$ of a term $t$ is:

$$\lbrack\!\lbrack x \rbrack\!\rbrack_{\mathcal{M}, \rho} = \rho(x)$$

$$\lbrack\!\lbrack f(t_1, \ldots, t_n) \rbrack\!\rbrack_{\mathcal{M}, \rho} = f^{\mathcal{M}}(\lbrack\!\lbrack t_1 \rbrack\!\rbrack_{\mathcal{M}, \rho}, \ldots, \lbrack\!\lbrack t_n \rbrack\!\rbrack_{\mathcal{M}, \rho})$$

**Definition (Satisfaction).** The satisfaction relation $\mathcal{M}, \rho \models \varphi$ ("$\mathcal{M}$ satisfies $\varphi$ under $\rho$") is defined inductively on $\varphi$:

$$\mathcal{M}, \rho \models P(t_1, \ldots, t_n) \quad \iff \quad (\lbrack\!\lbrack t_1 \rbrack\!\rbrack_{\mathcal{M},\rho}, \ldots, \lbrack\!\lbrack t_n \rbrack\!\rbrack_{\mathcal{M},\rho}) \in P^{\mathcal{M}}$$

$$\mathcal{M}, \rho \models t_1 = t_2 \quad \iff \quad \lbrack\!\lbrack t_1 \rbrack\!\rbrack_{\mathcal{M},\rho} = \lbrack\!\lbrack t_2 \rbrack\!\rbrack_{\mathcal{M},\rho}$$

$$\mathcal{M}, \rho \models \neg \varphi \quad \iff \quad \mathcal{M}, \rho \not\models \varphi$$

$$\mathcal{M}, \rho \models \varphi \land \psi \quad \iff \quad \mathcal{M}, \rho \models \varphi \text{ and } \mathcal{M}, \rho \models \psi$$

$$\mathcal{M}, \rho \models \varphi \lor \psi \quad \iff \quad \mathcal{M}, \rho \models \varphi \text{ or } \mathcal{M}, \rho \models \psi$$

$$\mathcal{M}, \rho \models \varphi \to \psi \quad \iff \quad \mathcal{M}, \rho \not\models \varphi \text{ or } \mathcal{M}, \rho \models \psi$$

$$\mathcal{M}, \rho \models \forall x.\, \varphi \quad \iff \quad \text{for all } a \in |\mathcal{M}|, \; \mathcal{M}, \rho[x \mapsto a] \models \varphi$$

$$\mathcal{M}, \rho \models \exists x.\, \varphi \quad \iff \quad \text{there exists } a \in |\mathcal{M}| \text{ such that } \mathcal{M}, \rho[x \mapsto a] \models \varphi$$

**Lemma (Coincidence).** If $\rho$ and $\rho'$ agree on all free variables of $\varphi$, then $\mathcal{M}, \rho \models \varphi$ iff $\mathcal{M}, \rho' \models \varphi$.

*Proof.* By structural induction on $\varphi$. The key case is the quantifier: for $\forall x.\, \varphi$, the assignments $\rho[x \mapsto a]$ and $\rho'[x \mapsto a]$ agree on all free variables of $\varphi$ (since $\mathrm{FV}(\forall x.\, \varphi) = \mathrm{FV}(\varphi) \setminus \{x\}$), so the inductive hypothesis applies. $\square$

**Corollary.** The truth value of a sentence (closed formula) depends only on the structure $\mathcal{M}$, not on $\rho$.

**Lemma (Substitution lemma for first-order logic).** $\mathcal{M}, \rho \models \varphi[t/x]$ iff $\mathcal{M}, \rho[x \mapsto \lbrack\!\lbrack t \rbrack\!\rbrack_{\mathcal{M},\rho}] \models \varphi$.

*Proof.* By structural induction on $\varphi$, using the definition of capture-avoiding substitution and the coincidence lemma. $\square$

This is the semantic analogue of the substitution lemma in type theory.

### 2.5 Natural Deduction

Natural deduction, introduced by Gentzen (1935) and refined by Prawitz (1965), is a proof system that mirrors how mathematicians actually reason: by introducing and eliminating logical connectives. Its rules directly correspond to the typing rules of the simply typed lambda calculus.

A natural deduction proof is a *derivation tree*. Each leaf is either an axiom (assumption) or a nullary rule. Each internal node is the conclusion of a rule applied to its children (the premises). We write derivations using the following notation:

$$\frac{\text{premise}_1 \quad \text{premise}_2}{\text{conclusion}} \; \text{rule-name}$$

Assumptions may be *discharged* (canceled) by certain rules. We write $[\varphi]^i$ to indicate that assumption $\varphi$ is discharged at the rule application labeled $i$. An assumption that is never discharged remains as an *open assumption* --- a hypothesis on which the conclusion depends.

#### 2.5.1 Rules for Conjunction ($\land$)

**Introduction:**

$$\frac{\varphi \quad \psi}{\varphi \land \psi} \; \land\text{I}$$

To prove a conjunction, prove both conjuncts.

**Elimination:**

$$\frac{\varphi \land \psi}{\varphi} \; \land\text{E}_1 \qquad \frac{\varphi \land \psi}{\psi} \; \land\text{E}_2$$

From a conjunction, extract either conjunct.

**Curry--Howard.** $\land$I corresponds to pair construction: from $e_1 : A$ and $e_2 : B$, form $\langle e_1, e_2 \rangle : A \times B$. The elimination rules correspond to projections $\pi_1 : A \times B \to A$ and $\pi_2 : A \times B \to B$.

**Local soundness (reduction).** If we introduce a conjunction and then immediately eliminate it, we can "reduce" the derivation:

$$\frac{\frac{\mathcal{D}_1 : \varphi \quad \mathcal{D}_2 : \psi}{\varphi \land \psi}\;\land\text{I}}{\varphi}\;\land\text{E}_1 \quad \longrightarrow_\beta \quad \mathcal{D}_1 : \varphi$$

This is the proof-theoretic analogue of the $\beta$-reduction $\pi_1(\langle e_1, e_2 \rangle) \longrightarrow e_1$.

#### 2.5.2 Rules for Implication ($\to$)

**Introduction:**

$$\frac{\begin{matrix}[\varphi]^i \\ \vdots \\ \psi\end{matrix}}{\varphi \to \psi} \; {\to}\text{I}^i$$

The assumption $\varphi$ is *discharged* at this step. The superscript $i$ is a label linking the discharged assumption to the rule application. All open assumptions labeled $[\varphi]^i$ in the subderivation are discharged simultaneously.

**Elimination (Modus Ponens):**

$$\frac{\varphi \to \psi \quad \varphi}{\psi} \; {\to}\text{E}$$

**Curry--Howard.** $\to$I corresponds to lambda abstraction: from a derivation of $B$ using assumption $x : A$, form $\lambda x{:}A.\, e : A \to B$. The elimination rule $\to$E corresponds to function application $(e_1\;e_2)$ where $e_1 : A \to B$ and $e_2 : A$.

**Local soundness (reduction).** An introduction followed by an immediate elimination reduces:

$$\frac{\frac{[\varphi]^1 \;\cdots\; \psi}{\varphi \to \psi}\;{\to}\text{I}^1 \quad \mathcal{D}' : \varphi}{\psi}\;{\to}\text{E} \quad \longrightarrow_\beta \quad \mathcal{D}[\mathcal{D}'/[\varphi]^1] : \psi$$

where $\mathcal{D}[\mathcal{D}'/[\varphi]^1]$ means replacing every use of assumption $[\varphi]^1$ by the derivation $\mathcal{D}'$. This is the proof-theoretic analogue of $(\lambda x.\, e)\;e' \longrightarrow_\beta e[e'/x]$.

#### 2.5.3 Rules for Disjunction ($\lor$)

**Introduction:**

$$\frac{\varphi}{\varphi \lor \psi} \; \lor\text{I}_1 \qquad \frac{\psi}{\varphi \lor \psi} \; \lor\text{I}_2$$

To prove a disjunction, prove either disjunct. We must specify *which* disjunct we are proving.

**Elimination:**

$$\frac{\varphi \lor \psi \quad \begin{matrix}[\varphi]^i \\ \vdots \\ \chi\end{matrix} \quad \begin{matrix}[\psi]^i \\ \vdots \\ \chi\end{matrix}}{\chi} \; \lor\text{E}^i$$

From a disjunction, derive a conclusion by showing it follows from each disjunct separately.

**Curry--Howard.** $\lor$I$_1$ and $\lor$I$_2$ correspond to the injections $\mathsf{inl} : A \to A + B$ and $\mathsf{inr} : B \to A + B$ into a sum type $A + B$. The elimination rule corresponds to case analysis (pattern matching):

$$\mathsf{case}\;e\;\mathsf{of}\;\mathsf{inl}\;x \Rightarrow e_1 \mid \mathsf{inr}\;y \Rightarrow e_2$$

#### 2.5.4 Rules for Negation ($\neg$)

We define $\neg \varphi \equiv \varphi \to \bot$.

**Introduction:**

$$\frac{\begin{matrix}[\varphi]^i \\ \vdots \\ \bot\end{matrix}}{\neg \varphi} \; \neg\text{I}^i$$

To prove $\neg \varphi$, assume $\varphi$ and derive a contradiction.

**Elimination:**

$$\frac{\neg \varphi \quad \varphi}{\bot} \; \neg\text{E}$$

From $\neg \varphi$ and $\varphi$, derive absurdity.

**Ex falso quodlibet (Explosion):**

$$\frac{\bot}{\varphi} \; \bot\text{E}$$

From absurdity, derive anything.

**Connection to type theory.** The type $\bot$ (the empty type, or $\mathsf{Void}$) has no constructors. $\bot$E says that from a term of type $\mathsf{Void}$, we can produce a term of any type---the function $\mathsf{absurd} : \mathsf{Void} \to A$ for any $A$. This function exists (vacuously) but can never be applied (since there is no value of type $\mathsf{Void}$ to pass as an argument). The negation type $\neg A = A \to \mathsf{Void}$ is inhabited iff $A$ is uninhabited.

#### 2.5.5 Rules for Truth ($\top$)

**Introduction:**

$$\frac{}{\top} \; \top\text{I}$$

Truth is always provable, with no premises.

There is no elimination rule for $\top$ (it carries no information).

**Curry--Howard.** $\top$ corresponds to the unit type $\mathsf{Unit}$ with its unique inhabitant $\langle\rangle : \mathsf{Unit}$. The unit type carries no information, which is why there is no useful elimination form.

#### 2.5.6 Rules for Universal Quantification ($\forall$)

**Introduction:**

$$\frac{\varphi(a)}{\forall x.\, \varphi(x)} \; \forall\text{I}$$

where $a$ is a *fresh* variable (also called an *eigenvariable*) not occurring free in any undischarged assumption or in $\forall x.\, \varphi(x)$.

The freshness condition is essential. Without it, we could "prove" $\forall x.\, P(x)$ from the assumption $P(a)$, which is clearly unsound.

**Elimination:**

$$\frac{\forall x.\, \varphi(x)}{\varphi(t)} \; \forall\text{E}$$

for any term $t$ (provided the substitution $\varphi(t) = \varphi[t/x]$ is capture-avoiding).

**Curry--Howard.** In System F (polymorphism), $\forall$I corresponds to type abstraction $\Lambda \alpha.\, e : \forall \alpha.\, A(\alpha)$. $\forall$E corresponds to type application $e\,[\tau] : A(\tau)$. The freshness condition on $\alpha$ in $\forall$I ensures that the polymorphic function truly works for *all* types, not just a specific one.

#### 2.5.7 Rules for Existential Quantification ($\exists$)

**Introduction:**

$$\frac{\varphi(t)}{\exists x.\, \varphi(x)} \; \exists\text{I}$$

To prove $\exists x.\, \varphi(x)$, exhibit a specific witness $t$ and prove $\varphi(t)$.

**Elimination:**

$$\frac{\exists x.\, \varphi(x) \quad \begin{matrix}[\varphi(a)]^i \\ \vdots \\ \chi\end{matrix}}{\chi} \; \exists\text{E}^i$$

where $a$ is a fresh eigenvariable (not free in $\chi$, in $\exists x.\, \varphi(x)$, or in any undischarged assumption except $[\varphi(a)]^i$).

The freshness condition ensures that the conclusion $\chi$ does not "know" what the witness was---only that some witness exists.

**Curry--Howard.** $\exists$I corresponds to packing a witness into an existential type: $\mathsf{pack}\;\langle \tau, e \rangle\;\mathsf{as}\;\exists \alpha.\, A(\alpha)$. $\exists$E corresponds to unpacking (opening an existential): $\mathsf{unpack}\;\langle \alpha, x \rangle = e_1\;\mathsf{in}\;e_2$.

#### 2.5.8 Classical vs. Intuitionistic Natural Deduction

The rules above constitute *intuitionistic* (constructive) natural deduction, denoted NJ. To obtain *classical* natural deduction NK, we add one of the following (equivalent) rules:

**Law of Excluded Middle (LEM):**

$$\frac{}{\varphi \lor \neg \varphi} \; \text{LEM}$$

**Double Negation Elimination (DNE):**

$$\frac{\neg\neg\varphi}{\varphi} \; \text{DNE}$$

**Peirce's Law:**

$$\frac{}{((\varphi \to \psi) \to \varphi) \to \varphi} \; \text{Peirce}$$

**Proof by contradiction (classical $\neg$I):**

$$\frac{\begin{matrix}[\neg \varphi]^i \\ \vdots \\ \bot\end{matrix}}{\varphi} \; \text{RAA}^i$$

Any one of these, added to intuitionistic logic, gives full classical logic. They are all equivalent in the presence of the other intuitionistic rules.

**Why intuitionistic logic for type theory?** In constructive type theory, we work in the intuitionistic system. The key property is the *disjunction property*: if $\vdash \varphi \lor \psi$ is provable (with no assumptions), then either $\vdash \varphi$ or $\vdash \psi$ is provable. Classical logic does not have this property: $\vdash p \lor \neg p$ is provable, but in general neither $\vdash p$ nor $\vdash \neg p$ is provable.

The disjunction property ensures that a proof of $A + B$ (a sum type) *actually tells you which summand*. A proof of $\exists x.\, P(x)$ *actually provides a witness*. This computational content is essential for the programs-as-proofs interpretation.

### 2.6 Example Derivations in Natural Deduction

**Example 1.** Prove $\varphi \to \varphi$ (identity / I combinator).

$$\frac{[\varphi]^1}{\varphi \to \varphi} \; {\to}\text{I}^1$$

This is the simplest possible derivation. Under Curry--Howard, it is the identity function $\lambda x.\, x : A \to A$.

**Example 2.** Prove $\varphi \to \psi \to \varphi$ (constant function / K combinator).

$$\frac{\frac{[\varphi]^1}{\psi \to \varphi} \; {\to}\text{I}^2}{\varphi \to \psi \to \varphi} \; {\to}\text{I}^1$$

Note that the assumption $[\psi]^2$ is vacuously discharged (it was never used). Under Curry--Howard, this is $\lambda x.\, \lambda y.\, x : A \to B \to A$.

**Example 3.** Prove $(\varphi \to \psi \to \chi) \to (\varphi \to \psi) \to \varphi \to \chi$ (the S combinator).

The derivation has three discharged assumptions and two uses of modus ponens:

$$\frac{\frac{\frac{[\varphi \to \psi \to \chi]^1 \quad [\varphi]^3}{\psi \to \chi} \; {\to}\text{E} \quad \frac{[\varphi \to \psi]^2 \quad [\varphi]^3}{\psi} \; {\to}\text{E}}{\chi} \; {\to}\text{E}}{\frac{\frac{}{\varphi \to \chi} \; {\to}\text{I}^3}{(\varphi \to \psi) \to \varphi \to \chi} \; {\to}\text{I}^2}$$

Then apply ${\to}\text{I}^1$ to discharge $[\varphi \to \psi \to \chi]^1$ and get the full formula. Under Curry--Howard, this is $\lambda f.\, \lambda g.\, \lambda x.\, (f\;x)\;(g\;x) : (A \to B \to C) \to (A \to B) \to A \to C$.

**Example 4.** Prove $\varphi \land \psi \to \psi \land \varphi$ (commutativity of conjunction).

$$\frac{\frac{[\varphi \land \psi]^1}{\psi} \; \land\text{E}_2 \quad \frac{[\varphi \land \psi]^1}{\varphi} \; \land\text{E}_1}{\psi \land \varphi} \; \land\text{I}$$

Then apply ${\to}\text{I}^1$. Under Curry--Howard, this is $\lambda p.\, \langle \pi_2(p), \pi_1(p) \rangle : A \times B \to B \times A$.

**Example 5.** Prove $\varphi \to \neg\neg\varphi$ (double negation introduction).

Recall $\neg\neg\varphi = (\varphi \to \bot) \to \bot$. The derivation:

$$\frac{\frac{[\neg\varphi]^2 \quad [\varphi]^1}{\bot} \; {\to}\text{E}}{\neg\neg\varphi} \; {\to}\text{I}^2$$

Then apply ${\to}\text{I}^1$ to discharge $[\varphi]^1$. Under Curry--Howard: $\lambda x.\, \lambda f.\, f\;x : A \to (A \to \mathsf{Void}) \to \mathsf{Void}$.

**Example 6.** Prove $(\varphi \to \psi) \to (\neg\psi \to \neg\varphi)$ (contrapositive, intuitionistic direction).

$$\frac{\frac{\frac{[\varphi \to \psi]^1 \quad [\varphi]^3}{\psi} \; {\to}\text{E} \quad \frac{}{[\neg\psi]^2}}{\bot} \; \neg\text{E}}{\neg\varphi} \; \neg\text{I}^3$$

Then apply ${\to}\text{I}^2$ and ${\to}\text{I}^1$. Under Curry--Howard: $\lambda f.\, \lambda g.\, \lambda x.\, g\;(f\;x) : (A \to B) \to (B \to \mathsf{Void}) \to (A \to \mathsf{Void})$. This is just function composition with the negation function.

**Example 7 (classical).** Derive $\varphi \lor \neg\varphi$ (excluded middle) from DNE.

First, derive $\neg\neg(\varphi \lor \neg\varphi)$ intuitionistically. Assume $\neg(\varphi \lor \neg\varphi)$:

- Assume $\varphi$. Then $\varphi \lor \neg\varphi$ by $\lor$I$_1$. But we assumed $\neg(\varphi \lor \neg\varphi)$, giving $\bot$. So $\neg\varphi$ by $\neg$I.
- From $\neg\varphi$, we get $\varphi \lor \neg\varphi$ by $\lor$I$_2$. But again, $\neg(\varphi \lor \neg\varphi)$ gives $\bot$.

So from $\neg(\varphi \lor \neg\varphi)$ we derive $\bot$, giving $\neg\neg(\varphi \lor \neg\varphi)$. Now apply DNE to get $\varphi \lor \neg\varphi$.

### 2.7 Properties of Natural Deduction

**Theorem (Soundness of Natural Deduction).** If $\varphi_1, \ldots, \varphi_n \vdash_{\mathsf{NJ}} \psi$ (i.e., $\psi$ is derivable from undischarged assumptions $\varphi_1, \ldots, \varphi_n$ in intuitionistic natural deduction), then $\varphi_1, \ldots, \varphi_n \models \psi$ (semantic entailment, in either classical or Kripke semantics as appropriate).

*Proof sketch.* By induction on the derivation. For each rule, we verify that if the premises hold under every valuation satisfying the undischarged assumptions, then the conclusion does as well. For example:

- For $\to$I: if $\Phi, \varphi \models \psi$, then $\Phi \models \varphi \to \psi$ by the semantic deduction theorem.
- For $\land$I: if $\Phi \models \varphi$ and $\Phi \models \psi$, then $\Phi \models \varphi \land \psi$ by the semantics of conjunction.
- For $\lor$E: if $\Phi \models \varphi \lor \psi$ and $\Phi, \varphi \models \chi$ and $\Phi, \psi \models \chi$, then $\Phi \models \chi$ by case analysis on the disjunction.

Each case follows directly from the semantic definitions. $\square$

**Theorem (Completeness of Natural Deduction, Godel 1930 for first-order logic).** If $\Phi \models \psi$ (semantically), then $\Phi \vdash_{\mathsf{NK}} \psi$ (derivable in classical natural deduction).

Completeness tells us that semantic entailment and syntactic derivability coincide (for classical logic). For intuitionistic logic, completeness holds with respect to *Kripke semantics* rather than classical truth-table semantics. In Kripke semantics, valuations can vary across "possible worlds" connected by an accessibility relation, and a formula is true at a world iff it is "forced" at that world. The details are beyond our scope here, but the key point is that intuitionistic logic has a clean, well-understood semantics.

**Theorem (Normalization, Prawitz 1965).** Every natural deduction derivation in NJ can be transformed into a *normal form* derivation by eliminating *detours*---places where a connective is introduced and then immediately eliminated.

A *detour* consists of an introduction rule applied to produce some formula $\varphi$, immediately followed by an elimination rule that takes $\varphi$ apart. The normalization procedure eliminates all such detours by replacing them with direct derivations.

*Connection to type theory.* Normalization of proofs corresponds to evaluation of programs. A detour (an introduction immediately followed by an elimination) corresponds to a $\beta$-redex. For instance, the derivation detour:

$$\frac{\frac{\mathcal{D} : \psi}{\varphi \to \psi}\;{\to}\text{I} \quad \mathcal{D}' : \varphi}{\psi}\;{\to}\text{E}$$

corresponds to the $\beta$-redex $(\lambda x.\, e)\;e'$, which reduces to $e[e'/x]$. The normalization theorem for natural deduction is the proof-theoretic counterpart of the normalization (termination) theorem for the simply typed lambda calculus.

**Theorem (Subformula property).** In a normal derivation, every formula appearing in the derivation is a subformula of either the conclusion or one of the undischarged assumptions.

This is a deep structural property of normal proofs. It means that proofs do not need to "go through" formulas more complex than the goal. In type theory, the corresponding property is that well-typed terms in normal form do not contain types more complex than those in the context or the goal type.

### 2.8 Sequent Calculus (Brief Introduction)

The *sequent calculus* LK (classical) and LJ (intuitionistic), also introduced by Gentzen (1935), provides an alternative formulation of logic that has several technical advantages over natural deduction. In particular, it separates logical rules from structural rules, which is essential for understanding substructural type systems.

**Definition (Sequent).** A *sequent* is an expression of the form

$$\Gamma \vdash \Delta$$

where $\Gamma$ (the *antecedent*) and $\Delta$ (the *succedent*) are finite multisets of formulas. The intended reading is: "if all formulas in $\Gamma$ are true, then at least one formula in $\Delta$ is true." Equivalently: "the conjunction of $\Gamma$ entails the disjunction of $\Delta$."

In the intuitionistic sequent calculus LJ, the succedent $\Delta$ contains at most one formula: $\Gamma \vdash \varphi$. This restriction is what makes the logic intuitionistic: the absence of multiple formulas on the right prevents classical reasoning.

**Logical rules (examples).** Each connective has a *left rule* (how it behaves as an assumption) and a *right rule* (how it is proved):

**Implication (right / left):**

$$\frac{\Gamma, \varphi \vdash \psi}{\Gamma \vdash \varphi \to \psi} \; {\to}\text{R} \qquad \frac{\Gamma \vdash \varphi \quad \Gamma', \psi \vdash \Delta}{\Gamma, \Gamma', \varphi \to \psi \vdash \Delta} \; {\to}\text{L}$$

**Conjunction (right / left):**

$$\frac{\Gamma \vdash \varphi \quad \Gamma \vdash \psi}{\Gamma \vdash \varphi \land \psi} \; \land\text{R} \qquad \frac{\Gamma, \varphi, \psi \vdash \Delta}{\Gamma, \varphi \land \psi \vdash \Delta} \; \land\text{L}$$

**Structural rules.** The sequent calculus makes *structural rules* explicit:

**Weakening (left/right):**

$$\frac{\Gamma \vdash \Delta}{\Gamma, \varphi \vdash \Delta} \; \text{WL} \qquad \frac{\Gamma \vdash \Delta}{\Gamma \vdash \Delta, \varphi} \; \text{WR}$$

Weakening allows us to add unused hypotheses (left) or unused conclusions (right).

**Contraction (left/right):**

$$\frac{\Gamma, \varphi, \varphi \vdash \Delta}{\Gamma, \varphi \vdash \Delta} \; \text{CL} \qquad \frac{\Gamma \vdash \Delta, \varphi, \varphi}{\Gamma \vdash \Delta, \varphi} \; \text{CR}$$

Contraction allows us to merge duplicate hypotheses (or conclusions).

**Exchange (left/right):**

$$\frac{\Gamma, \varphi, \psi, \Gamma' \vdash \Delta}{\Gamma, \psi, \varphi, \Gamma' \vdash \Delta} \; \text{XL} \qquad \frac{\Gamma \vdash \Delta, \varphi, \psi, \Delta'}{\Gamma \vdash \Delta, \psi, \varphi, \Delta'} \; \text{XR}$$

Exchange allows us to reorder hypotheses (or conclusions).

**Identity and Cut:**

$$\frac{}{\varphi \vdash \varphi} \; \text{Id} \qquad \frac{\Gamma \vdash \Delta, \varphi \quad \Gamma', \varphi \vdash \Delta'}{\Gamma, \Gamma' \vdash \Delta, \Delta'} \; \text{Cut}$$

The identity rule says every formula entails itself. The Cut rule is a form of composition: if we can prove $\varphi$ (among other things) and can use $\varphi$ to prove something, we can combine these.

**Connection to type theory (critical).** The structural rules of the sequent calculus directly correspond to how typing contexts work:

| Structural Rule | Meaning | Type-Theoretic Interpretation |
|----------------|---------|-------------------------------|
| Weakening | Unused hypotheses are allowed | A variable may appear in the context without being used in the term |
| Contraction | Hypotheses may be used multiple times | A variable may be used more than once |
| Exchange | Order of hypotheses does not matter | Variables can be reordered in the context |

*Substructural type systems* arise precisely by *restricting* these structural rules:

- **Linear type systems** (Girard, 1987): drop weakening and contraction. Every variable must be used *exactly once*. This models resource-sensitive computation. Resources (file handles, memory, network connections) must be used exactly once: not duplicated, not dropped without being consumed.
- **Affine type systems**: drop contraction only. Every variable may be used *at most once*. Rust's ownership and borrowing system is based on affine types. You can give away ownership (use it) or let it be dropped, but you cannot duplicate it.
- **Ordered type systems**: drop all three structural rules. Variables must be used in order (like a stack). This models non-commutative resources.
- **Relevant type systems**: drop weakening only. Every variable must be used *at least once*. You may duplicate but not discard.

Understanding which structural rules are present is essential for understanding the design space of type systems. This is one of the main insights of Module 09.

**Theorem (Cut Elimination, Gentzen's Hauptsatz, 1935).** Every provable sequent in LK (or LJ) has a proof without the Cut rule.

Cut elimination is the sequent-calculus analogue of normalization. In type theory, it corresponds to the fact that every well-typed program can be evaluated to a value without "detours." The cut-elimination procedure is a rewriting process on proof trees, and it terminates---this is the content of Gentzen's theorem. Historically, Gentzen used cut elimination to prove the consistency of Peano arithmetic: if PA were inconsistent, then $\vdash \bot$ would be provable, hence (by cut elimination) provable without Cut, but a cut-free proof of $\vdash \bot$ is impossible by inspection of the rules (no rule has an empty sequent $\vdash$ as conclusion).

### 2.9 Inference Rules as a Unifying Format

We now step back and observe a pattern. Whether we are writing rules in natural deduction, sequent calculus, or a type system, the format is always the same:

$$\frac{J_1 \quad J_2 \quad \cdots \quad J_n}{J} \; \text{Rule-Name} \quad (\text{side conditions})$$

The $J_i$ are *judgments*---assertions about syntactic objects. In logic, the judgments might be "$\varphi$ is true" or "$\Gamma \vdash \varphi$". In type theory, the primary judgment form is $\Gamma \vdash e : \tau$, but there are others:

- $\Gamma \vdash \tau \;\mathsf{type}$ ("$\tau$ is a well-formed type under context $\Gamma$")
- $\Gamma \vdash \tau_1 \equiv \tau_2$ ("types $\tau_1$ and $\tau_2$ are equal")
- $\Gamma \vdash e_1 \equiv e_2 : \tau$ ("terms $e_1$ and $e_2$ are definitionally equal at type $\tau$")
- $\Gamma \vdash \tau_1 <: \tau_2$ ("$\tau_1$ is a subtype of $\tau_2$")
- $e \longrightarrow e'$ ("$e$ reduces to $e'$ in one step")
- $e \Downarrow v$ ("$e$ evaluates to value $v$")

A collection of inference rules defines a *relation* on judgments---namely, the least relation closed under those rules (see Lecture 00c on inductive definitions). A *derivation* (or *derivation tree*, or *proof tree*) is a finite tree whose nodes are rule applications, and whose root is the judgment being derived.

**Anatomy of a derivation.** Consider the typing rule for function application in the STLC:

$$\frac{\Gamma \vdash e_1 : \tau_1 \to \tau_2 \quad \Gamma \vdash e_2 : \tau_1}{\Gamma \vdash e_1\;e_2 : \tau_2} \; \text{T-App}$$

Reading this rule: "If, under context $\Gamma$, the term $e_1$ has a function type $\tau_1 \to \tau_2$, and the term $e_2$ has the argument type $\tau_1$, then the application $e_1\;e_2$ has the result type $\tau_2$." The premises are above the bar, the conclusion below. The side condition (implicit) is that the types match up.

Proving properties of a type system (type safety, for example) proceeds by *rule induction* over derivations (Lecture 00c). This means we consider each rule and show the property is preserved.

The ability to read, write, and reason about inference rules is the single most important skill for studying type theory.

---

## 3. The Curry--Howard Correspondence: A Preview

We have been noting the correspondences between logic and type theory throughout this lecture. Let us collect them in one place, as a preview of the deep connection we will explore throughout the course.

| Logic | Type Theory | Proof System Rule | Typing Rule |
|-------|------------|-------------------|-------------|
| Proposition $\varphi$ | Type $A$ | --- | --- |
| Proof of $\varphi$ | Term $e : A$ | --- | --- |
| Assumption $[\varphi]$ | Variable $x : A$ in context | --- | Var rule |
| Discharge of $[\varphi]$ | Binding of $x$ by $\lambda$ | --- | --- |
| $\varphi \to \psi$ | $A \to B$ | $\to$I / $\to$E | Lambda / Application |
| $\varphi \land \psi$ | $A \times B$ | $\land$I / $\land$E | Pair / Projection |
| $\varphi \lor \psi$ | $A + B$ | $\lor$I / $\lor$E | Injection / Case |
| $\top$ | $\mathsf{Unit}$ | $\top$I | Unit value $\langle\rangle$ |
| $\bot$ | $\mathsf{Void}$ | $\bot$E | Absurd |
| $\forall x.\, \varphi(x)$ | $\forall \alpha.\, A(\alpha)$ | $\forall$I / $\forall$E | Type abstraction / Type application |
| $\exists x.\, \varphi(x)$ | $\exists \alpha.\, A(\alpha)$ | $\exists$I / $\exists$E | Pack / Unpack |
| Normalization | Evaluation (reduction) | Cut elimination | $\beta$-reduction |
| Normal proof | Value | Cut-free proof | Normal form |
| Consistency (no proof of $\bot$) | Type safety ($\mathsf{Void}$ uninhabited) | --- | --- |

This table is not merely an analogy: it is a formal isomorphism. The simply typed lambda calculus is, literally, the same mathematical object as the natural deduction proof system for intuitionistic propositional logic. This will be made precise when we study the STLC in Module 02.

**Historical note.** The correspondence was discovered independently by Curry (1958, for combinatory logic and Hilbert-style axiom systems) and Howard (1969/1980, for natural deduction and lambda calculus). It was later extended by Griffin (1990) to classical logic (via control operators), by Girard (1987) to linear logic (via linear types), and by many others to dependent types, modal logic, and more.

---

## Summary

- **Propositional logic** provides the syntax ($\neg, \land, \lor, \to$) and semantics (truth valuations) for reasoning about composite propositions. Tautologies, satisfiability, and semantic entailment are the key semantic concepts. Functional completeness shows that $\{\neg, \land\}$ (or $\{\neg, \lor\}$, or $\{\neg, \to\}$) suffice to express all truth functions.

- **Proof techniques** --- direct proof, contradiction, contrapositive, case analysis, construction --- are the standard methods for establishing logical statements. Each has a constructive/computational interpretation under Curry--Howard. Proof by contradiction requires classical logic and corresponds computationally to continuations.

- **Predicate logic** extends propositional logic with quantifiers ($\forall, \exists$), terms, and structures. Free vs. bound variables and capture-avoiding substitution are critical concepts that carry over directly to the lambda calculus. The substitution lemma connects syntactic substitution to semantic interpretation.

- **Natural deduction** provides introduction and elimination rules for each connective. These rules are the template for typing rules in type theory. Local soundness (introduction + elimination = detour) corresponds to $\beta$-reduction. Soundness and completeness link the proof system to semantics; normalization links it to computation. The subformula property constrains the structure of normal proofs.

- **The sequent calculus** makes structural rules (weakening, contraction, exchange) explicit. Restricting these rules yields substructural logics and their corresponding type systems (linear, affine, ordered, relevant). Cut elimination is the sequent-calculus analogue of normalization.

- **Inference rules** are the universal format for defining logical systems, type systems, and operational semantics. Reading and writing derivation trees is the essential skill for type theory.

- **The Curry--Howard correspondence** identifies propositions with types, proofs with programs, and proof normalization with computation. It is the conceptual backbone of type theory and one of the deepest connections in the foundations of mathematics and computer science.

## Further Reading

1. Gentzen, G. (1935). "Investigations into logical deduction." *Mathematische Zeitschrift*, 39, 176--210. The foundational paper introducing both natural deduction and the sequent calculus. Translated in Szabo (1969), *The Collected Papers of Gerhard Gentzen*.

2. Prawitz, D. (1965). *Natural Deduction: A Proof-Theoretical Study*. Almqvist & Wiksell. The definitive treatment of normalization for natural deduction; establishes the subformula property.

3. Howard, W. A. (1980). "The formulae-as-types notion of construction." In *To H. B. Curry: Essays on Combinatory Logic, Lambda Calculus and Formalism*, Academic Press, 479--490. Originally circulated as an unpublished manuscript from 1969. The paper that established the Curry--Howard correspondence for natural deduction and lambda calculus.

4. van Dalen, D. (2013). *Logic and Structure*, 5th edition. Springer. An excellent graduate-level textbook covering propositional logic, predicate logic, and proof theory.

5. Troelstra, A. S. and Schwichtenberg, H. (2000). *Basic Proof Theory*, 2nd edition. Cambridge University Press. Comprehensive treatment of natural deduction and sequent calculus, with particular attention to the constructive case.

6. Sorensen, M. H. and Urzyczyn, P. (2006). *Lectures on the Curry-Howard Isomorphism*. Elsevier. A thorough development of the propositions-as-types correspondence, covering both propositional and quantified logic.

7. Girard, J.-Y., Lafont, Y., and Taylor, P. (1989). *Proofs and Types*. Cambridge University Press. An influential monograph connecting proof theory to type theory, including System F and the beginnings of linear logic.

8. Wadler, P. (2015). "Propositions as Types." *Communications of the ACM*, 58(12), 75--84. An accessible and beautifully written survey of the Curry--Howard correspondence and its history.
