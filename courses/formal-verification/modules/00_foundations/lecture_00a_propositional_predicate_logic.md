# Lecture 00a: Propositional & Predicate Logic

> **Module 00 — Foundations: Logic & Proof (Pre-Work)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. Define the syntax of propositional logic precisely, including well-formed formulas and operator precedence.
2. Specify the semantics of propositional logic via truth valuations and truth tables.
3. Distinguish between satisfiability, validity, and tautology, and determine which category a given formula belongs to.
4. Formally distinguish semantic entailment ($\models$) from syntactic derivability ($\vdash$) and state the soundness and completeness theorems that connect them.
5. Define the syntax of first-order predicate logic, including terms, formulas, free and bound variables, and substitution.
6. Define structures (models) for first-order logic and the satisfaction relation.
7. State the Compactness Theorem and the Lowenheim-Skolem Theorem and explain their significance.

---

## 1. Motivation: Why Logic Matters for Formal Verification

Every formal verification effort rests on a logical foundation. When we prove that a program is correct, that a security protocol preserves confidentiality, or that a hardware design meets its specification, we are constructing a formal proof within some logical system. The strength and limitations of that logical system determine what we can and cannot verify.

This lecture establishes the two most fundamental logical systems:

- **Propositional logic** — the logic of truth-functional connectives, sufficient for reasoning about Boolean circuits, finite-state systems, and SAT-based verification.
- **First-order predicate logic** — the logic of quantifiers and predicates, the foundation for virtually all mathematics and the logic underlying proof assistants like Isabelle.

Understanding these systems at a precise, formal level is essential. Informal reasoning about "and," "or," and "for all" is insufficient when we need machine-checked guarantees.

---

## 2. Propositional Logic

### 2.1 Syntax

**Definition 2.1 (Propositional alphabet).** The alphabet of propositional logic consists of:

- A countably infinite set of *propositional variables*: $p, q, r, p_0, p_1, \ldots$
- *Logical connectives*: $\neg$ (negation), $\land$ (conjunction), $\lor$ (disjunction), $\to$ (implication), $\leftrightarrow$ (biconditional)
- *Punctuation*: $($ and $)$
- *Constants*: $\top$ (true) and $\bot$ (false)

**Definition 2.2 (Well-formed formula).** The set of well-formed formulas (wffs) is defined inductively:

1. Every propositional variable $p_i$ is a wff.
2. $\top$ and $\bot$ are wffs.
3. If $\varphi$ is a wff, then $(\neg \varphi)$ is a wff.
4. If $\varphi$ and $\psi$ are wffs, then $(\varphi \land \psi)$, $(\varphi \lor \psi)$, $(\varphi \to \psi)$, and $(\varphi \leftrightarrow \psi)$ are wffs.
5. Nothing else is a wff.

This is a context-free grammar generating a language over the propositional alphabet. We can represent it in BNF:

$$\varphi ::= p_i \mid \top \mid \bot \mid \neg \varphi \mid \varphi \land \varphi \mid \varphi \lor \varphi \mid \varphi \to \varphi \mid \varphi \leftrightarrow \varphi$$

**Convention (Operator precedence).** To reduce parentheses, we adopt the following binding precedence (tightest first):

1. $\neg$ (prefix, binds tightest)
2. $\land$
3. $\lor$
4. $\to$ (right-associative)
5. $\leftrightarrow$

So $\neg p \land q \to r$ parses as $((\neg p) \land q) \to r$.

**Theorem 2.3 (Unique readability).** Every well-formed formula has a unique parse tree. This is a consequence of the grammar being unambiguous.

*Proof sketch.* By structural induction on formulas. The key observation is that every wff has a unique *main connective* (the outermost connective), which determines the parse. For binary connectives, the left and right subformulas are uniquely determined because parentheses (or precedence conventions) resolve all ambiguity. $\square$

### 2.2 Semantics

**Definition 2.4 (Truth valuation).** A *truth valuation* (or *assignment*) is a function $v : \text{Var} \to \{0, 1\}$ from the set of propositional variables to truth values.

**Definition 2.5 (Evaluation).** Given a valuation $v$, the *truth value* $\llbracket \varphi \rrbracket_v$ of a formula $\varphi$ under $v$ is defined recursively:

$$\llbracket p_i \rrbracket_v = v(p_i)$$
$$\llbracket \top \rrbracket_v = 1, \quad \llbracket \bot \rrbracket_v = 0$$
$$\llbracket \neg \varphi \rrbracket_v = 1 - \llbracket \varphi \rrbracket_v$$
$$\llbracket \varphi \land \psi \rrbracket_v = \min(\llbracket \varphi \rrbracket_v, \llbracket \psi \rrbracket_v)$$
$$\llbracket \varphi \lor \psi \rrbracket_v = \max(\llbracket \varphi \rrbracket_v, \llbracket \psi \rrbracket_v)$$
$$\llbracket \varphi \to \psi \rrbracket_v = \max(1 - \llbracket \varphi \rrbracket_v, \llbracket \psi \rrbracket_v)$$
$$\llbracket \varphi \leftrightarrow \psi \rrbracket_v = \begin{cases} 1 & \text{if } \llbracket \varphi \rrbracket_v = \llbracket \psi \rrbracket_v \\ 0 & \text{otherwise} \end{cases}$$

The truth table for the binary connectives summarizes these definitions:

| $\varphi$ | $\psi$ | $\varphi \land \psi$ | $\varphi \lor \psi$ | $\varphi \to \psi$ | $\varphi \leftrightarrow \psi$ |
|-----------|--------|-----------------------|----------------------|---------------------|-------------------------------|
| 0 | 0 | 0 | 0 | 1 | 1 |
| 0 | 1 | 0 | 1 | 1 | 0 |
| 1 | 0 | 0 | 1 | 0 | 0 |
| 1 | 1 | 1 | 1 | 1 | 1 |

**Remark.** The material conditional $\varphi \to \psi$ is vacuously true when $\varphi$ is false. This is a deliberate design choice that makes the logic well-behaved, even though it diverges from everyday usage of "if...then."

### 2.3 Satisfiability, Validity, and Tautology

**Definition 2.6.** Let $\varphi$ be a propositional formula.

- $\varphi$ is *satisfiable* if there exists a valuation $v$ such that $\llbracket \varphi \rrbracket_v = 1$. We write $v \models \varphi$.
- $\varphi$ is a *tautology* (or is *valid*) if $\llbracket \varphi \rrbracket_v = 1$ for every valuation $v$. We write $\models \varphi$.
- $\varphi$ is a *contradiction* (or is *unsatisfiable*) if $\llbracket \varphi \rrbracket_v = 0$ for every valuation $v$.

**Proposition 2.7.** $\varphi$ is a tautology if and only if $\neg \varphi$ is a contradiction. $\varphi$ is satisfiable if and only if $\neg \varphi$ is not a tautology.

**Example 2.8.** The formula $p \lor \neg p$ (law of excluded middle) is a tautology: if $v(p) = 1$, the left disjunct is true; if $v(p) = 0$, $\neg p$ is true, so the right disjunct is true.

**Example 2.9.** The formula $p \to (q \to p)$ is a tautology. Truth table verification:

| $p$ | $q$ | $q \to p$ | $p \to (q \to p)$ |
|-----|-----|-----------|-------------------|
| 0 | 0 | 1 | 1 |
| 0 | 1 | 0 | 1 |
| 1 | 0 | 1 | 1 |
| 1 | 1 | 1 | 1 |

This tautology corresponds to the *weakening* principle: if you know $p$, then $p$ holds regardless of any additional hypothesis $q$.

### 2.4 Logical Equivalence and Normal Forms

**Definition 2.10.** Formulas $\varphi$ and $\psi$ are *logically equivalent*, written $\varphi \equiv \psi$, if $\llbracket \varphi \rrbracket_v = \llbracket \psi \rrbracket_v$ for every valuation $v$.

**Key equivalences:**

| Name | Equivalence |
|------|------------|
| Double negation | $\neg\neg \varphi \equiv \varphi$ |
| De Morgan's laws | $\neg(\varphi \land \psi) \equiv \neg\varphi \lor \neg\psi$ |
| | $\neg(\varphi \lor \psi) \equiv \neg\varphi \land \neg\psi$ |
| Material conditional | $\varphi \to \psi \equiv \neg\varphi \lor \psi$ |
| Contrapositive | $\varphi \to \psi \equiv \neg\psi \to \neg\varphi$ |
| Distributivity | $\varphi \land (\psi \lor \chi) \equiv (\varphi \land \psi) \lor (\varphi \land \chi)$ |
| | $\varphi \lor (\psi \land \chi) \equiv (\varphi \lor \psi) \land (\varphi \lor \chi)$ |
| Idempotence | $\varphi \land \varphi \equiv \varphi$, $\varphi \lor \varphi \equiv \varphi$ |
| Absorption | $\varphi \land (\varphi \lor \psi) \equiv \varphi$ |

**Definition 2.11 (Normal forms).**

- A *literal* is a variable $p$ or its negation $\neg p$.
- A *clause* is a disjunction of literals.
- A formula is in *conjunctive normal form* (CNF) if it is a conjunction of clauses.
- A formula is in *disjunctive normal form* (DNF) if it is a disjunction of conjunctions of literals.

**Theorem 2.12.** Every propositional formula is logically equivalent to a formula in CNF and to a formula in DNF.

*Proof (DNF construction).* Given a formula $\varphi$ with variables $p_1, \ldots, p_n$, compute its truth table. For each row where $\varphi$ evaluates to 1, form the conjunction $l_1 \land \cdots \land l_n$ where $l_i = p_i$ if $v(p_i) = 1$ and $l_i = \neg p_i$ if $v(p_i) = 0$. The disjunction of all such conjunctions is equivalent to $\varphi$.

The CNF is obtained by a dual construction: for each row where $\varphi$ evaluates to 0, form the clause $l_1 \lor \cdots \lor l_n$ where $l_i = \neg p_i$ if $v(p_i) = 1$ and $l_i = p_i$ if $v(p_i) = 0$. The conjunction of all such clauses is equivalent to $\varphi$. $\square$

**Remark (Complexity).** CNF conversion by truth table produces formulas of exponential size in the worst case. Tseitin's transformation (1968) produces an equisatisfiable CNF of polynomial size by introducing auxiliary variables, and is fundamental to modern SAT solvers.

### 2.5 Semantic Entailment vs Syntactic Derivability

**Definition 2.13 (Semantic entailment).** A set of formulas $\Gamma$ *semantically entails* $\varphi$, written $\Gamma \models \varphi$, if every valuation that makes all formulas in $\Gamma$ true also makes $\varphi$ true.

**Definition 2.14 (Syntactic derivability).** $\Gamma \vdash \varphi$ means there is a formal derivation (proof) of $\varphi$ from assumptions $\Gamma$ using the rules of a proof system.

These are conceptually distinct: $\models$ is a semantic notion about truth, while $\vdash$ is a syntactic notion about symbol manipulation. The fundamental theorems of logic connect them.

**Theorem 2.15 (Soundness).** If $\Gamma \vdash \varphi$, then $\Gamma \models \varphi$.

*Interpretation:* Everything provable is true. A proof system that fails soundness is useless — it would let us "prove" false statements.

**Theorem 2.16 (Completeness, Godel 1930 for first-order logic; Post 1921 for propositional logic).** If $\Gamma \models \varphi$, then $\Gamma \vdash \varphi$.

*Interpretation:* Everything true is provable. Together with soundness, this gives us $\Gamma \models \varphi \iff \Gamma \vdash \varphi$ — semantics and syntax agree perfectly.

**Theorem 2.17 (Compactness, propositional).** $\Gamma \models \varphi$ if and only if there is a finite subset $\Gamma_0 \subseteq \Gamma$ such that $\Gamma_0 \models \varphi$.

*Proof.* By completeness, $\Gamma \models \varphi$ iff $\Gamma \vdash \varphi$. Any formal derivation uses only finitely many premises, so $\Gamma_0 \vdash \varphi$ for some finite $\Gamma_0 \subseteq \Gamma$. By soundness, $\Gamma_0 \models \varphi$. $\square$

---

## 3. First-Order Predicate Logic

### 3.1 Syntax

Predicate logic extends propositional logic with the ability to quantify over individuals and to predicate properties of them.

**Definition 3.1 (First-order language).** A *first-order language* $\mathcal{L}$ is specified by a *signature* consisting of:

- A set of *constant symbols*: $c_0, c_1, \ldots$
- A set of *function symbols* with specified arities: $f_0^{(n_0)}, f_1^{(n_1)}, \ldots$
- A set of *relation (predicate) symbols* with specified arities: $R_0^{(m_0)}, R_1^{(m_1)}, \ldots$
- A distinguished binary relation symbol $=$ (equality), present in every first-order language with equality

In addition, every first-order language has:

- A countably infinite set of *variables*: $x, y, z, x_0, x_1, \ldots$
- *Logical connectives*: $\neg, \land, \lor, \to, \leftrightarrow$
- *Quantifiers*: $\forall$ (universal) and $\exists$ (existential)
- *Punctuation*: $(, ), ,$

**Example 3.2.** The language of *ordered rings* has constants $0, 1$; binary function symbols $+, \cdot$; and a binary relation symbol $<$. The language of *set theory* has a single binary relation symbol $\in$ (and equality).

**Definition 3.3 (Terms).** Terms are defined inductively:

1. Every variable $x$ is a term.
2. Every constant symbol $c$ is a term.
3. If $f$ is an $n$-ary function symbol and $t_1, \ldots, t_n$ are terms, then $f(t_1, \ldots, t_n)$ is a term.

Terms denote *objects* in the domain of discourse. In the language of rings, $x + (y \cdot z)$ is a term.

**Definition 3.4 (Formulas).** Formulas are defined inductively:

1. If $R$ is an $n$-ary relation symbol and $t_1, \ldots, t_n$ are terms, then $R(t_1, \ldots, t_n)$ is an *atomic formula*.
2. If $t_1, t_2$ are terms, then $t_1 = t_2$ is an atomic formula.
3. If $\varphi$ and $\psi$ are formulas, the propositional combinations $\neg\varphi$, $\varphi \land \psi$, $\varphi \lor \psi$, $\varphi \to \psi$, $\varphi \leftrightarrow \psi$ are formulas.
4. If $\varphi$ is a formula and $x$ is a variable, then $\forall x.\, \varphi$ and $\exists x.\, \varphi$ are formulas.

**Definition 3.5 (Free and bound variables).** An occurrence of variable $x$ in formula $\varphi$ is *bound* if it is within the scope of a quantifier $\forall x$ or $\exists x$. Otherwise it is *free*. The set of free variables of $\varphi$ is denoted $\text{FV}(\varphi)$, defined recursively:

$$\text{FV}(R(t_1, \ldots, t_n)) = \text{Var}(t_1) \cup \cdots \cup \text{Var}(t_n)$$
$$\text{FV}(\neg\varphi) = \text{FV}(\varphi)$$
$$\text{FV}(\varphi \land \psi) = \text{FV}(\varphi) \cup \text{FV}(\psi)$$
$$\text{FV}(\forall x.\, \varphi) = \text{FV}(\varphi) \setminus \{x\}$$

A formula with no free variables is called a *sentence*.

**Definition 3.6 (Substitution).** The substitution $\varphi[t/x]$ replaces every free occurrence of $x$ in $\varphi$ with term $t$, renaming bound variables as necessary to avoid capture. Formally:

- $(R(s_1, \ldots, s_n))[t/x] = R(s_1[t/x], \ldots, s_n[t/x])$
- $(\neg\varphi)[t/x] = \neg(\varphi[t/x])$
- $(\varphi \land \psi)[t/x] = \varphi[t/x] \land \psi[t/x]$
- $(\forall y.\, \varphi)[t/x] = \forall y.\, (\varphi[t/x])$ if $y \ne x$ and $y \notin \text{Var}(t)$

The side condition "$y \notin \text{Var}(t)$" prevents *variable capture*. If it fails, we rename $y$ to a fresh variable before substituting. A term $t$ is *free for* $x$ in $\varphi$ if no free occurrence of $x$ in $\varphi$ falls within the scope of a quantifier binding a variable in $t$.

**Example 3.7.** In $\varphi = \forall y.\, (x < y)$, the substitution $\varphi[y/x]$ would naively produce $\forall y.\, (y < y)$, which changes the meaning. The variable $y$ in the term being substituted gets captured. The correct procedure first renames: $\forall z.\, (x < z)$, then substitutes: $\forall z.\, (y < z)$.

### 3.2 Semantics

**Definition 3.8 (Structure / Model).** An $\mathcal{L}$-structure $\mathfrak{A}$ consists of:

- A nonempty set $A$ called the *domain* (or *universe*).
- For each constant symbol $c$, an element $c^{\mathfrak{A}} \in A$.
- For each $n$-ary function symbol $f$, a function $f^{\mathfrak{A}} : A^n \to A$.
- For each $n$-ary relation symbol $R$, a relation $R^{\mathfrak{A}} \subseteq A^n$.

**Example 3.9.** The standard model of arithmetic $\mathfrak{N} = (\mathbb{N}, 0, S, +, \cdot, <)$ interprets $0$ as the number zero, $S$ as the successor function, $+$ and $\cdot$ as addition and multiplication, and $<$ as the usual ordering.

**Definition 3.10 (Variable assignment).** A *variable assignment* in a structure $\mathfrak{A}$ is a function $s : \text{Var} \to A$. Given an assignment $s$, a variable $x$, and an element $a \in A$, the *modified assignment* $s[x \mapsto a]$ agrees with $s$ everywhere except that it maps $x$ to $a$.

**Definition 3.11 (Interpretation of terms).** The interpretation $t^{\mathfrak{A}}[s]$ of a term $t$ in structure $\mathfrak{A}$ under assignment $s$ is:

$$x^{\mathfrak{A}}[s] = s(x)$$
$$c^{\mathfrak{A}}[s] = c^{\mathfrak{A}}$$
$$f(t_1, \ldots, t_n)^{\mathfrak{A}}[s] = f^{\mathfrak{A}}(t_1^{\mathfrak{A}}[s], \ldots, t_n^{\mathfrak{A}}[s])$$

**Definition 3.12 (Satisfaction).** The satisfaction relation $\mathfrak{A} \models \varphi[s]$ ("$\mathfrak{A}$ satisfies $\varphi$ under assignment $s$") is defined recursively:

$$\mathfrak{A} \models R(t_1, \ldots, t_n)[s] \iff (t_1^{\mathfrak{A}}[s], \ldots, t_n^{\mathfrak{A}}[s]) \in R^{\mathfrak{A}}$$
$$\mathfrak{A} \models (t_1 = t_2)[s] \iff t_1^{\mathfrak{A}}[s] = t_2^{\mathfrak{A}}[s]$$
$$\mathfrak{A} \models (\neg\varphi)[s] \iff \mathfrak{A} \not\models \varphi[s]$$
$$\mathfrak{A} \models (\varphi \land \psi)[s] \iff \mathfrak{A} \models \varphi[s] \text{ and } \mathfrak{A} \models \psi[s]$$
$$\mathfrak{A} \models (\forall x.\, \varphi)[s] \iff \text{for every } a \in A, \; \mathfrak{A} \models \varphi[s[x \mapsto a]]$$
$$\mathfrak{A} \models (\exists x.\, \varphi)[s] \iff \text{there exists } a \in A \text{ such that } \mathfrak{A} \models \varphi[s[x \mapsto a]]$$

**Proposition 3.13 (Coincidence lemma).** If two assignments $s$ and $s'$ agree on the free variables of $\varphi$, then $\mathfrak{A} \models \varphi[s] \iff \mathfrak{A} \models \varphi[s']$.

This justifies writing $\mathfrak{A} \models \sigma$ for a sentence $\sigma$ (no free variables), without specifying an assignment.

### 3.3 Validity and Logical Consequence

**Definition 3.14.** A sentence $\sigma$ is *valid* (written $\models \sigma$) if $\mathfrak{A} \models \sigma$ for every structure $\mathfrak{A}$. A sentence is *satisfiable* if some structure satisfies it.

**Definition 3.15 (Logical consequence).** $\Gamma \models \varphi$ if every structure satisfying all sentences in $\Gamma$ also satisfies $\varphi$.

**Theorem 3.16 (Godel's Completeness Theorem, 1930).** For first-order logic with a sound and complete proof system (such as natural deduction or sequent calculus):

$$\Gamma \models \varphi \iff \Gamma \vdash \varphi$$

This is one of the most important theorems in mathematical logic. It tells us that first-order logic is "just right" — its proof theory exactly matches its semantics.

### 3.4 Compactness and Lowenheim-Skolem

**Theorem 3.17 (Compactness Theorem).** A set of first-order sentences $\Gamma$ has a model if and only if every finite subset of $\Gamma$ has a model.

*Significance.* Compactness has powerful non-constructive consequences. For example, it implies that if every finite subgraph of a graph $G$ is $k$-colorable, then $G$ itself is $k$-colorable — even if $G$ is infinite. It also shows that the natural numbers cannot be characterized up to isomorphism by any set of first-order sentences: one can always add nonstandard elements.

**Theorem 3.18 (Downward Lowenheim-Skolem).** If a countable set of first-order sentences has an infinite model, then it has a countable model.

**Theorem 3.19 (Upward Lowenheim-Skolem).** If a set of first-order sentences has an infinite model, then it has models of every infinite cardinality $\ge |\mathcal{L}|$.

*Significance.* The Lowenheim-Skolem theorems show that first-order logic cannot pin down the size of infinite structures. In particular, even the first-order theory of the real numbers has a countable model (Skolem's paradox). This is not a contradiction — the countable model simply lacks the "right" subsets to distinguish it from the reals, and the notion of uncountability becomes relative to the model.

**Remark (Limits of first-order logic).** Compactness and Lowenheim-Skolem have a flip side: first-order logic is too weak to express certain properties. For instance:

- "The domain is finite" is not expressible as a first-order sentence.
- "The domain has exactly $\aleph_0$ elements" is not expressible.
- Archimedean completeness of the reals is not first-order.

These limitations motivate extensions: second-order logic, higher-order logic (used in Isabelle/HOL), and infinitary logics.

---

## 4. Adequacy of Connectives

**Definition 4.1.** A set of connectives is *adequate* (or *functionally complete*) if every truth function $\{0,1\}^n \to \{0,1\}$ can be expressed using only connectives from that set.

**Theorem 4.2.** The set $\{\neg, \land\}$ is adequate. So is $\{\neg, \lor\}$, and $\{\neg, \to\}$.

*Proof (for $\{\neg, \land\}$).* By the DNF theorem (Theorem 2.12), every formula is equivalent to a DNF. We can eliminate disjunction using De Morgan: $\varphi \lor \psi \equiv \neg(\neg\varphi \land \neg\psi)$. $\square$

**Theorem 4.3.** The single connective NAND (Sheffer stroke, $\uparrow$) is adequate, where $p \uparrow q \equiv \neg(p \land q)$.

*Proof.* $\neg p \equiv p \uparrow p$, and $p \land q \equiv (p \uparrow q) \uparrow (p \uparrow q)$. Since $\{\neg, \land\}$ is adequate, so is $\{\uparrow\}$. $\square$

---

## 5. Decision Procedures and Complexity

**Theorem 5.1.** The satisfiability problem for propositional logic (SAT) is decidable. The truth-table method decides it in time $O(2^n)$ for a formula with $n$ variables.

**Theorem 5.2 (Cook-Levin, 1971).** SAT is NP-complete.

This is the foundational result of computational complexity theory. It means:

1. If a propositional formula is satisfiable, there is a short certificate (a satisfying assignment) that can be verified in polynomial time.
2. Every problem in NP can be reduced to SAT in polynomial time.
3. No polynomial-time algorithm for SAT is known, and finding one would imply P = NP.

**Theorem 5.3 (Church-Turing, 1936).** The validity problem for first-order logic is undecidable. There is no algorithm that, given a first-order sentence $\sigma$, decides whether $\models \sigma$.

However, the validity problem is *semi-decidable*: if $\models \sigma$, a proof search will eventually find a proof (by completeness), but if $\not\models \sigma$, the search may run forever.

**Remark (Decidable fragments).** Important decidable fragments of first-order logic include:

- Monadic predicate logic (all predicates are unary)
- The Bernays-Schonfinkel-Ramsey class ($\exists^* \forall^*$ prefix, no function symbols)
- The two-variable fragment $FO^2$

These fragments are relevant to automated verification tools.

---

## 6. Exercises

**Exercise 6.1.** Prove using truth tables that $((p \to q) \to p) \to p$ is a tautology (Peirce's law).

**Exercise 6.2.** Convert the formula $(p \to q) \land (q \to r) \to (p \to r)$ to CNF. Verify that each clause is a tautology.

**Exercise 6.3.** Let $\mathcal{L} = \{<\}$ be the language with a single binary relation. Write first-order sentences expressing:

**(a)** $<$ is a strict total order (irreflexive, transitive, total).

**(b)** Every element has a successor: for every $x$, there exists a $y$ such that $x < y$ and there is no $z$ with $x < z \land z < y$.

**(c)** The order is dense: between any two elements, there is another.

**Exercise 6.4.** Prove that $\{\to, \bot\}$ is an adequate set of connectives by expressing $\neg\varphi$, $\varphi \land \psi$, and $\varphi \lor \psi$ in terms of $\to$ and $\bot$.

**Exercise 6.5.** Let $\Gamma = \{\forall x.\, P(x) \to Q(x), \; \exists x.\, P(x)\}$ and $\varphi = \exists x.\, Q(x)$. Prove that $\Gamma \models \varphi$ directly from the definition of semantic entailment. Then give an informal proof using natural deduction rules (to be formalized in Lecture 00b).

**Exercise 6.6.** Use the Compactness Theorem to prove: if $\Gamma$ is a set of sentences such that for every $n \in \mathbb{N}$, $\Gamma$ has a model of size at least $n$, then $\Gamma$ has an infinite model.

*Hint:* Add sentences $c_i \ne c_j$ for fresh constants $c_1, c_2, \ldots$

**Exercise 6.7.** Explain why the Compactness Theorem implies that "the domain is finite" is not expressible by a single first-order sentence (or even a set of first-order sentences).

---

## References

- Enderton, H.B. *A Mathematical Introduction to Logic*. 2nd ed. Academic Press, 2001.
- Mendelson, E. *Introduction to Mathematical Logic*. 6th ed. CRC Press, 2015.
- van Dalen, D. *Logic and Structure*. 5th ed. Springer, 2013.
- Boolos, G., Burgess, J., Jeffrey, R. *Computability and Logic*. 5th ed. Cambridge University Press, 2007.

---

*Next: [Lecture 00b: Natural Deduction & Sequent Calculus](lecture_00b_natural_deduction_sequent_calculus.md)*
