---
title: "Homework 00: Foundations Bootcamp"
tags:
  - type-theory
  - foundations
  - homework
---
# Homework 00: Foundations Bootcamp

**Estimated time:** 15 hours
**Due date:** First day of class
**Submission:** PDF of derivations
**Total points:** 200

---

## Overview

This homework covers the mathematical foundations needed for the course: propositional and predicate logic, natural deduction derivations, structural induction on inductively defined data, and rule induction over simple formal systems. The problems are designed to build fluency with inference rules and induction --- the two pillars of type-theoretic reasoning.

Every skill exercised here will be used repeatedly throughout the course. Natural deduction derivations are the template for typing derivations. Structural induction on syntax trees is how we prove properties of terms. Rule induction on derivation trees is how we prove type safety. If you find yourself struggling with any problem, revisit the corresponding lecture before proceeding.

You should complete this homework after studying Lectures 00a through 00d. Problems marked with a star (\*) are more challenging and may require techniques beyond the obvious.

**Academic integrity:** You may discuss ideas with classmates, but you must write up all solutions independently. Cite any sources you consult beyond the course lecture notes. Do not use automated theorem provers for the natural deduction problems --- the point is to build facility with derivation trees by hand.

---

## Part A: Logic and Proofs (100 points)

### Problem A1: Propositional Logic Warm-Up (15 points)

**(a)** (5 pts) Prove or disprove: $(\varphi \to \psi) \to (\psi \to \chi) \to (\varphi \to \chi)$ is a tautology.

If it is a tautology, provide a truth table verification (you may abbreviate the table to show only the relevant columns and the final result). If it is not a tautology, give an explicit counterexample: a valuation $v$ under which the formula evaluates to false.

**(b)** (5 pts) Prove that $\neg(\varphi \land \psi) \leftrightarrow (\neg \varphi \lor \neg \psi)$ is a tautology (De Morgan's law).

You may use either a truth table or a chain of logical equivalences. If using equivalences, justify each step.

**(c)** (5 pts) Peirce's law states $((\varphi \to \psi) \to \varphi) \to \varphi$.

(i) Show that Peirce's law is a classical tautology (true under all valuations) by constructing a truth table.

(ii) Give an informal but precise argument for why Peirce's law should *not* be provable in intuitionistic logic. In particular, explain: under the Curry--Howard correspondence, what type would a proof of Peirce's law correspond to? What would a program of this type need to do? Why is this problematic from a constructive standpoint?

### Problem A2: Natural Deduction Derivations (35 points)

Construct complete natural deduction derivation trees for each of the following. Use only the intuitionistic rules from Lecture 00b (no LEM, no DNE) unless otherwise stated. Label every rule application and indicate discharged assumptions clearly with brackets $[\cdot]^i$ and superscripts.

Your derivation trees should be complete: every leaf is either an axiom or a bracketed (discharged) assumption, every internal node is labeled with a rule name, and the root is the formula being proved.

**(a)** (5 pts) $\vdash (\varphi \land \psi) \to (\psi \land \varphi)$

(Commutativity of conjunction.)

**(b)** (5 pts) $\vdash \varphi \to \neg\neg\varphi$

(Double negation introduction. Recall $\neg\varphi \equiv \varphi \to \bot$. So you are proving $\varphi \to ((\varphi \to \bot) \to \bot)$.)

**(c)** (7 pts) $\vdash (\varphi \to \chi) \to (\psi \to \chi) \to (\varphi \lor \psi) \to \chi$

(Disjunction elimination in curried form. This requires three nested implication introductions and one use of $\lor$E.)

**(d)** (7 pts) $\vdash (\varphi \to \psi) \to (\neg\psi \to \neg\varphi)$

(Intuitionistic contrapositive. Recall $\neg\varphi \equiv \varphi \to \bot$.)

**(e)** (5 pts) $\vdash (\varphi \lor \psi) \to (\psi \lor \varphi)$

(Commutativity of disjunction.)

**(f)** (6 pts) Using classical natural deduction (you may use DNE: from $\neg\neg\varphi$ derive $\varphi$), derive the law of excluded middle:

$$\vdash \varphi \lor \neg\varphi$$

*Hint:* Begin by assuming $\neg(\varphi \lor \neg\varphi)$ for contradiction. Show that from this assumption, you can derive both $\neg\varphi$ and $\varphi \lor \neg\varphi$, reaching a contradiction. Then apply DNE.

*More detailed hint:* Under the assumption $\neg(\varphi \lor \neg\varphi)$, first assume $\varphi$ to derive a contradiction (since $\varphi$ implies $\varphi \lor \neg\varphi$ by $\lor$I$_1$, contradicting the outer assumption). This gives $\neg\varphi$. But then $\varphi \lor \neg\varphi$ by $\lor$I$_2$, again contradicting the outer assumption.

### Problem A3: Predicate Logic Formalization (20 points)

Let $\mathcal{L}$ be a first-order language with:
- A unary predicate $\mathsf{Even}(x)$ ("$x$ is even")
- A unary predicate $\mathsf{Prime}(x)$ ("$x$ is prime")
- A binary predicate $\mathsf{Div}(x, y)$ ("$x$ divides $y$")
- A binary function symbol $+(x, y)$ ("sum of $x$ and $y$")
- A binary function symbol $\times(x, y)$ ("product of $x$ and $y$")
- Constants $0, 1, 2$
- A binary relation $<$ ("less than")

**(a)** (10 pts) Formalize each of the following English statements as a first-order formula over $\mathcal{L}$. Use standard logical connectives and quantifiers. Be precise about the scope of quantifiers.

1. Every even number greater than 2 is not prime.
2. There exists a prime number that is even.
3. For every number $x$, if $x$ divides $y$ and $y$ divides $z$, then $x$ divides $z$.
4. Goldbach's conjecture: every even number greater than 2 is the sum of two primes.
5. There are infinitely many primes. (*Hint:* For every number, there exists a prime greater than it.)

**(b)** (6 pts) For each of the following formulas, identify all free and bound variables. Then compute the result of the given substitution, using capture-avoiding substitution. Show your work, and rename bound variables where necessary to avoid capture.

1. $\varphi_1 = \forall y.\, P(x, y) \land Q(y, z)$. Compute $\varphi_1[f(y)/x]$.
2. $\varphi_2 = \exists x.\, (R(x, y) \to \forall y.\, S(x, y))$. Compute $\varphi_2[g(x)/y]$.

For each, explain whether variable capture would occur without renaming, and if so, which variable would be captured.

**(c)** (4 pts) Consider the first-order formula:

$$\varphi = \forall x.\, \exists y.\, P(x, y) \to \exists y.\, \forall x.\, P(x, y)$$

Is $\varphi$ valid (true in every structure and under every variable assignment)? If so, prove it. If not, give a specific structure $\mathcal{M}$ with domain, an interpretation of $P$, and a variable assignment under which $\varphi$ is false.

*Hint:* Parse the formula carefully. Where does the scope of $\forall x$ end? Is the formula $(\forall x.\, \exists y.\, P(x, y)) \to (\exists y.\, \forall x.\, P(x, y))$ or $\forall x.\, ((\exists y.\, P(x, y)) \to (\exists y.\, \forall x.\, P(x, y)))$?

### Problem A4: Sequent Calculus and Structural Rules (15 points)

**(a)** (5 pts) Explain in your own words the computational meaning of each structural rule (weakening, contraction, exchange) in terms of variable usage in programs. For each rule, give a concrete example of a program (in any language you know: Haskell, Python, OCaml, Rust, etc.) that *relies on* the structural rule being available.

**(b)** (5 pts) Linear logic drops both weakening and contraction. Consider a hypothetical programming language where every variable must be used *exactly once*. For each of the following program fragments (in pseudocode), state whether it would be *allowed* or *rejected* in a linear type system, and explain which structural rule's absence causes the rejection (if applicable):

1. `let x = 5 in x + x`
2. `let x = 5 in 0`
3. `let x = 5 in x`
4. `let (x, y) = (1, 2) in x`
5. `let f = \x -> x in (f 1, f 2)`

**(c)** (5 pts) In a linear type system, the function type $A \multimap B$ ("linear arrow") guarantees that the argument is used exactly once in the body.

(i) Explain why $A \multimap A \multimap A$ is *not* a valid linear type for the function $\lambda x.\, \lambda y.\, x$ (the K combinator), even though $A \to A \to A$ is a valid type in the ordinary simply typed lambda calculus.

(ii) Is the S combinator $\lambda f.\, \lambda g.\, \lambda x.\, (f\;x)\;(g\;x)$ linearly typable? Explain why or why not, considering the uses of $x$.

(iii) What does this tell us about the relationship between structural rules and the set of typable programs?

### Problem A5: Inference Rules and Derivation Trees (15 points)

Consider the following inductively defined judgment $n \;\mathsf{even}$, read "$n$ is even," where natural numbers are represented as $\mathsf{zero}, \mathsf{succ}(\mathsf{zero}), \mathsf{succ}(\mathsf{succ}(\mathsf{zero})), \ldots$:

$$\frac{}{\mathsf{zero} \;\mathsf{even}} \; \text{E-Zero} \qquad \frac{n \;\mathsf{even}}{\mathsf{succ}(\mathsf{succ}(n)) \;\mathsf{even}} \; \text{E-Succ}$$

**(a)** (3 pts) Write out the complete derivation tree showing that $\mathsf{succ}(\mathsf{succ}(\mathsf{succ}(\mathsf{succ}(\mathsf{zero})))) \;\mathsf{even}$ (i.e., 4 is even). Label every rule application.

**(b)** (4 pts) Define a judgment $n \;\mathsf{odd}$ using inference rules such that a natural number $\mathsf{succ}^k(\mathsf{zero})$ satisfies $n \;\mathsf{odd}$ iff $k$ is odd. Your definition should have exactly two rules.

Then write the derivation tree showing $\mathsf{succ}(\mathsf{succ}(\mathsf{succ}(\mathsf{zero}))) \;\mathsf{odd}$ (i.e., 3 is odd).

**(c)** (8 pts) Prove by rule induction on the derivation of $n \;\mathsf{even}$: if $n \;\mathsf{even}$, then there exists a natural number $m$ such that $n = \mathsf{double}(m)$, where $\mathsf{double}$ is defined by:

$$\mathsf{double}(\mathsf{zero}) = \mathsf{zero} \qquad \mathsf{double}(\mathsf{succ}(k)) = \mathsf{succ}(\mathsf{succ}(\mathsf{double}(k)))$$

State the property $P(n)$ you are proving. For each rule (E-Zero and E-Succ), state the induction hypothesis explicitly and show the inductive step in full detail.

---

## Part B: Induction (100 points)

### Problem B1: Structural Induction on Trees (25 points)

Consider the following inductively defined set of *binary trees*:

$$\frac{}{\mathsf{leaf} \in \mathsf{Tree}} \; \text{T-Leaf} \qquad \frac{t_1 \in \mathsf{Tree} \quad t_2 \in \mathsf{Tree}}{\mathsf{node}(t_1, t_2) \in \mathsf{Tree}} \; \text{T-Node}$$

Define the following functions by structural recursion:

$$\mathsf{leaves}(\mathsf{leaf}) = 1 \qquad \mathsf{leaves}(\mathsf{node}(t_1, t_2)) = \mathsf{leaves}(t_1) + \mathsf{leaves}(t_2)$$

$$\mathsf{nodes}(\mathsf{leaf}) = 0 \qquad \mathsf{nodes}(\mathsf{node}(t_1, t_2)) = 1 + \mathsf{nodes}(t_1) + \mathsf{nodes}(t_2)$$

$$\mathsf{height}(\mathsf{leaf}) = 0 \qquad \mathsf{height}(\mathsf{node}(t_1, t_2)) = 1 + \max(\mathsf{height}(t_1), \mathsf{height}(t_2))$$

**(a)** (10 pts) Prove by structural induction on $t \in \mathsf{Tree}$: for all $t$,

$$\mathsf{leaves}(t) = \mathsf{nodes}(t) + 1$$

State the property $P(t)$. For the base case (T-Leaf), verify $P(\mathsf{leaf})$ directly. For the inductive case (T-Node), state the induction hypotheses $P(t_1)$ and $P(t_2)$ and derive $P(\mathsf{node}(t_1, t_2))$.

**(b)** (8 pts) Prove by structural induction on $t \in \mathsf{Tree}$: for all $t$,

$$\mathsf{leaves}(t) \le 2^{\mathsf{height}(t)}$$

*Hint:* In the inductive case, you will need the fact that $\max(a, b) \ge a$ and $\max(a, b) \ge b$, and the inequality $2^a + 2^b \le 2 \cdot 2^{\max(a,b)} = 2^{1 + \max(a,b)}$.

**(c)** (7 pts) Define a function $\mathsf{mirror} : \mathsf{Tree} \to \mathsf{Tree}$ by:

$$\mathsf{mirror}(\mathsf{leaf}) = \mathsf{leaf} \qquad \mathsf{mirror}(\mathsf{node}(t_1, t_2)) = \mathsf{node}(\mathsf{mirror}(t_2), \mathsf{mirror}(t_1))$$

Prove by structural induction that $\mathsf{mirror}(\mathsf{mirror}(t)) = t$ for all $t \in \mathsf{Tree}$.

### Problem B2: Structural Induction on Lambda Terms (25 points)

Recall the grammar of lambda terms: $e ::= x \mid e_1\;e_2 \mid \lambda x.\, e$

The *size* of a term is defined by:

$$|x| = 1 \qquad |e_1\;e_2| = 1 + |e_1| + |e_2| \qquad |\lambda x.\, e| = 1 + |e|$$

The set of *free variables* is defined by:

$$\mathrm{FV}(x) = \{x\} \qquad \mathrm{FV}(e_1\;e_2) = \mathrm{FV}(e_1) \cup \mathrm{FV}(e_2) \qquad \mathrm{FV}(\lambda x.\, e) = \mathrm{FV}(e) \setminus \{x\}$$

**(a)** (10 pts) Prove by structural induction on $e$: for all terms $e$,

$$|\mathrm{FV}(e)| \le |e|$$

where $|\mathrm{FV}(e)|$ denotes the cardinality of the set of free variables and $|e|$ denotes the size of the term.

*Hint:* In the application case, use $|A \cup B| \le |A| + |B|$. In the abstraction case, use $|A \setminus \{x\}| \le |A|$.

**(b)** (15 pts) Define capture-avoiding substitution $e[s/x]$ for lambda terms (following Lecture 00b, Section 2.4.3). Then prove by structural induction on $e$ that for all terms $e$, $s$, and variables $x$:

$$|e[s/x]| \le |e| + (|e| - 1) \cdot (|s| - 1)$$

For each case (variable, application, abstraction), show the detailed calculation.

*Hints:*
- Variable case: $|x[s/x]| = |s|$ and $|y[s/x]| = |y| = 1$ for $y \ne x$. Verify the bound holds in both subcases.
- Application case: Use the inductive hypotheses on $e_1$ and $e_2$ and verify that the sum of bounds gives the desired result for $|e_1\;e_2|$.
- Abstraction case: Distinguish whether $x$ is the bound variable or not.

### Problem B3: Rule Induction over a Derivation System (30 points)

Consider a small language of Boolean expressions:

$$e ::= \mathsf{true} \mid \mathsf{false} \mid \mathsf{if}\;e_1\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3$$

with the following small-step operational semantics:

$$\frac{}{\mathsf{if}\;\mathsf{true}\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3 \longrightarrow e_2} \; \text{E-IfTrue}$$

$$\frac{}{\mathsf{if}\;\mathsf{false}\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3 \longrightarrow e_3} \; \text{E-IfFalse}$$

$$\frac{e_1 \longrightarrow e_1'}{\mathsf{if}\;e_1\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3 \longrightarrow \mathsf{if}\;e_1'\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3} \; \text{E-If}$$

Values are $v ::= \mathsf{true} \mid \mathsf{false}$.

Define the multi-step relation $e \longrightarrow^* e'$ as the reflexive, transitive closure of $\longrightarrow$:

$$\frac{}{e \longrightarrow^* e} \; \text{M-Refl} \qquad \frac{e \longrightarrow e' \quad e' \longrightarrow^* e''}{e \longrightarrow^* e''} \; \text{M-Step}$$

**(a)** (10 pts) **Determinism.** Prove: if $e \longrightarrow e'$ and $e \longrightarrow e''$, then $e' = e''$.

Proceed by rule induction on the derivation of $e \longrightarrow e'$. For each case (E-IfTrue, E-IfFalse, E-If), state what $e$ looks like, what $e'$ is, and then examine which rules could derive $e \longrightarrow e''$. Show that in each case, $e' = e''$.

*Important:* When the last rule is E-If (with premise $e_1 \longrightarrow e_1'$) and we are considering $e \longrightarrow e''$, you need to argue that E-IfTrue and E-IfFalse cannot apply (because $e_1$ is not a value if $e_1 \longrightarrow e_1'$). State and use the following fact: values do not step (i.e., there is no $v'$ such that $v \longrightarrow v'$ for $v \in \{\mathsf{true}, \mathsf{false}\}$).

**(b)** (8 pts) **Size decrease.** Define a *size* function on expressions:

$$\mathsf{size}(\mathsf{true}) = 1 \qquad \mathsf{size}(\mathsf{false}) = 1 \qquad \mathsf{size}(\mathsf{if}\;e_1\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3) = 1 + \mathsf{size}(e_1) + \mathsf{size}(e_2) + \mathsf{size}(e_3)$$

Prove by rule induction on $e \longrightarrow e'$: if $e \longrightarrow e'$, then $\mathsf{size}(e') < \mathsf{size}(e)$.

Then explain in 2-3 sentences: why does this imply that every expression reaches a value (normal form) in finitely many steps? What well-founded order is being used?

**(c)** (12 pts) **Normalization.** Prove that for every expression $e$, there exists a value $v$ such that $e \longrightarrow^* v$.

Proceed by strong induction on $\mathsf{size}(e)$.

*Base cases:* $e = \mathsf{true}$ or $e = \mathsf{false}$ (these are already values; use M-Refl).

*Inductive case:* $e = \mathsf{if}\;e_1\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3$. By the (strong) inductive hypothesis applied to $e_1$ (which has smaller size), $e_1 \longrightarrow^* v_1$ for some value $v_1$. Show that $e \longrightarrow^* \mathsf{if}\;v_1\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3$. Then $v_1 \in \{\mathsf{true}, \mathsf{false}\}$, so one more step gives either $e_2$ or $e_3$. Apply the inductive hypothesis again (justifying that the size decreased) to conclude.

*Note:* You will need to prove (or state as a lemma) that if $e_1 \longrightarrow^* e_1'$, then $\mathsf{if}\;e_1\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3 \longrightarrow^* \mathsf{if}\;e_1'\;\mathsf{then}\;e_2\;\mathsf{else}\;e_3$. You may prove this auxiliary lemma by induction on the multi-step derivation.

### Problem B4: Strengthening the Induction Hypothesis\* (20 points)

Consider the Fibonacci sequence: $F_0 = 0$, $F_1 = 1$, $F_{n+2} = F_n + F_{n+1}$.

**(a)** (6 pts) Attempt to prove by *weak* induction that $F_n < 2^n$ for all $n \ge 0$.

Write out the proof attempt, clearly identifying where the inductive step breaks down. Explain precisely what goes wrong: what does the induction hypothesis give you, and what do you need that you do not have?

**(b)** (14 pts) Now prove the stronger statement: for all $n \ge 1$,

$$F_n \le \phi^{n-1}$$

where $\phi = \frac{1 + \sqrt{5}}{2} \approx 1.618$ is the golden ratio.

Use *strong induction* on $n$. Your proof should:

(i) Verify the base cases $n = 1$ and $n = 2$ directly.

(ii) For the inductive step ($n \ge 3$), state the strong induction hypothesis explicitly: "For all $k$ with $1 \le k < n$, $F_k \le \phi^{k-1}$."

(iii) Use the recurrence $F_n = F_{n-1} + F_{n-2}$ and the induction hypothesis to bound $F_n$.

(iv) Show that $\phi^{n-2} + \phi^{n-3} = \phi^{n-3}(\phi + 1) = \phi^{n-3} \cdot \phi^2 = \phi^{n-1}$, using the key identity $\phi^2 = \phi + 1$.

(v) Verify that $\phi^2 = \phi + 1$ holds for $\phi = \frac{1 + \sqrt{5}}{2}$.

(vi) Conclude with a 3-4 sentence explanation: Why does strong induction succeed where weak induction failed? What is the general lesson about choosing induction hypotheses in type theory proofs?

---

## Submission Checklist

Before submitting, verify that your solutions satisfy each of the following:

- [ ] **Derivation trees (Problem A2):** Every tree is complete --- every leaf is either an axiom (a zero-premise rule like $\top$I) or a bracketed assumption $[\varphi]^i$. Every internal node is labeled with a rule name. All discharged assumptions are indicated with matching superscripts.

- [ ] **Predicate logic (Problem A3):** All formulas are syntactically well-formed, with explicit quantifiers and correct scope. Free and bound variables are correctly identified. Capture-avoiding substitution is applied correctly, with renaming where needed.

- [ ] **Structural induction proofs (Problems B1, B2):** Each proof clearly states (1) the property $P$ being proved, (2) the induction principle being used (structural induction on which set), (3) the base case(s), (4) the induction hypothesis/hypotheses, and (5) the inductive step.

- [ ] **Rule induction proofs (Problems A5c, B3):** Each proof specifies (1) which judgment is being inducted on, (2) what the property $P$ is, and (3) for each possible last rule, the case analysis with explicit induction hypotheses.

- [ ] **All proofs:** Written in complete mathematical prose (not just equations), with English sentences connecting the steps.

- [ ] **Strong induction (Problem B4):** Base cases are verified separately. The induction hypothesis is stated in the strong form ("for all $k < n$..."). The inductive step correctly applies the hypothesis to strictly smaller values.
