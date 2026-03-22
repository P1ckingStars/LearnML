# Lecture 00b: Natural Deduction & Sequent Calculus

> **Module 00 — Foundations: Logic & Proof (Pre-Work)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. State the introduction and elimination rules for all connectives in Gentzen-style natural deduction.
2. Construct proof trees for propositional and first-order tautologies.
3. Explain hypothetical reasoning and the discharge of assumptions.
4. Distinguish classical from intuitionistic logic and identify which rules require the law of excluded middle.
5. Define the sequent calculus, state its structural and logical rules, and explain the significance of cut elimination.
6. Relate natural deduction to sequent calculus via the Curry-Howard correspondence (preview).

---

## 1. Motivation

In Lecture 00a we defined semantic notions: truth, validity, entailment. These are about *what is true*. Natural deduction and sequent calculus address the complementary question: *what can we prove*? They provide formal proof systems — precise rules for manipulating formulas — that we can implement in a computer.

Proof assistants like Isabelle are, at their core, implementations of proof systems. Isabelle's kernel is built on natural deduction rules. Understanding how these rules work, how assumptions are managed, and how proofs compose is essential for effective use of any proof assistant.

---

## 2. Natural Deduction (Gentzen Style)

Natural deduction was introduced by Gerhard Gentzen in 1935. The fundamental idea is that each logical connective is characterized by two kinds of rules:

- **Introduction rules** tell you how to *prove* a formula whose main connective is that symbol.
- **Elimination rules** tell you how to *use* a formula whose main connective is that symbol.

This introduction/elimination duality is one of the deepest organizing principles in logic.

### 2.1 Judgments and Proof Trees

A *judgment* in natural deduction has the form $\Gamma \vdash \varphi$, meaning "from assumptions $\Gamma$, we can derive $\varphi$." A proof is a tree whose leaves are assumptions and whose internal nodes are applications of inference rules. We write rules as:

$$\frac{\text{premise}_1 \quad \text{premise}_2 \quad \cdots}{\text{conclusion}} \; \text{(RuleName)}$$

### 2.2 Structural Rules

**Assumption (Hypothesis):**

$$\frac{}{\varphi \vdash \varphi} \; (\text{Hyp})$$

Any formula can be derived from itself.

**Weakening:**

$$\frac{\Gamma \vdash \varphi}{\Gamma, \psi \vdash \varphi} \; (\text{Weak})$$

Adding an unused assumption does not invalidate a derivation.

### 2.3 Rules for Implication

**Implication introduction ($\to$I):**

$$\frac{\Gamma, \varphi \vdash \psi}{\Gamma \vdash \varphi \to \psi} \; (\to\text{I})$$

To prove $\varphi \to \psi$, assume $\varphi$ and derive $\psi$. The assumption $\varphi$ is *discharged* — it is no longer available as a free assumption in the conclusion.

This is the rule of *hypothetical reasoning*. It captures the meaning of "if...then": to show that $\psi$ follows from $\varphi$, temporarily assume $\varphi$ and work toward $\psi$.

**Implication elimination ($\to$E), a.k.a. Modus Ponens:**

$$\frac{\Gamma \vdash \varphi \to \psi \quad \Gamma \vdash \varphi}{\Gamma \vdash \psi} \; (\to\text{E})$$

If we have derived $\varphi \to \psi$ and $\varphi$, we may conclude $\psi$.

**Example 2.1.** Proof that $\vdash (p \to q) \to (q \to r) \to (p \to r)$ (transitivity of implication):

$$\frac{\frac{\frac{}{p \to q \vdash p \to q}\;(\text{Hyp}) \quad \frac{}{p \vdash p}\;(\text{Hyp})}{p \to q, p \vdash q}\;(\to\text{E}) \quad \frac{}{q \to r \vdash q \to r}\;(\text{Hyp})}{\frac{p \to q, q \to r, p \vdash r}{p \to q, q \to r \vdash p \to r}\;(\to\text{I})} \; (\to\text{E})$$

Reading bottom-up: we discharge $p$ (via $\to$I), then discharge $q \to r$, then discharge $p \to q$.

### 2.4 Rules for Conjunction

**Conjunction introduction ($\land$I):**

$$\frac{\Gamma \vdash \varphi \quad \Gamma \vdash \psi}{\Gamma \vdash \varphi \land \psi} \; (\land\text{I})$$

To prove a conjunction, prove both conjuncts.

**Conjunction elimination ($\land$E):**

$$\frac{\Gamma \vdash \varphi \land \psi}{\Gamma \vdash \varphi} \; (\land\text{E}_1) \qquad \frac{\Gamma \vdash \varphi \land \psi}{\Gamma \vdash \psi} \; (\land\text{E}_2)$$

From a conjunction, extract either conjunct.

### 2.5 Rules for Disjunction

**Disjunction introduction ($\lor$I):**

$$\frac{\Gamma \vdash \varphi}{\Gamma \vdash \varphi \lor \psi} \; (\lor\text{I}_1) \qquad \frac{\Gamma \vdash \psi}{\Gamma \vdash \varphi \lor \psi} \; (\lor\text{I}_2)$$

**Disjunction elimination ($\lor$E), a.k.a. proof by cases:**

$$\frac{\Gamma \vdash \varphi \lor \psi \quad \Gamma, \varphi \vdash \chi \quad \Gamma, \psi \vdash \chi}{\Gamma \vdash \chi} \; (\lor\text{E})$$

If we know $\varphi \lor \psi$, and we can derive $\chi$ from $\varphi$ alone and also from $\psi$ alone, then we can conclude $\chi$. Both case assumptions are discharged.

### 2.6 Rules for Negation

We treat negation as $\neg\varphi \equiv \varphi \to \bot$, where $\bot$ is a constant denoting absurdity (falsehood).

**Negation introduction ($\neg$I):**

$$\frac{\Gamma, \varphi \vdash \bot}{\Gamma \vdash \neg\varphi} \; (\neg\text{I})$$

To prove $\neg\varphi$, assume $\varphi$ and derive a contradiction.

**Negation elimination ($\neg$E):**

$$\frac{\Gamma \vdash \varphi \quad \Gamma \vdash \neg\varphi}{\Gamma \vdash \bot} \; (\neg\text{E})$$

If both $\varphi$ and $\neg\varphi$ are derivable, we have a contradiction.

**Ex falso quodlibet ($\bot$E):**

$$\frac{\Gamma \vdash \bot}{\Gamma \vdash \varphi} \; (\bot\text{E})$$

From a contradiction, anything follows. This is also called the *principle of explosion*.

### 2.7 Rules for the Quantifiers

**Universal introduction ($\forall$I):**

$$\frac{\Gamma \vdash \varphi(x)}{\Gamma \vdash \forall x.\, \varphi(x)} \; (\forall\text{I})$$

where $x$ does not occur free in any formula in $\Gamma$. This *eigenvariable condition* ensures that $x$ is truly arbitrary — the proof works for any value of $x$, not just a particular one.

**Universal elimination ($\forall$E):**

$$\frac{\Gamma \vdash \forall x.\, \varphi(x)}{\Gamma \vdash \varphi(t)} \; (\forall\text{E})$$

where $t$ is any term free for $x$ in $\varphi$. We may instantiate a universal statement with any particular term.

**Existential introduction ($\exists$I):**

$$\frac{\Gamma \vdash \varphi(t)}{\Gamma \vdash \exists x.\, \varphi(x)} \; (\exists\text{I})$$

If $\varphi$ holds for a particular term $t$, then there exists an $x$ satisfying $\varphi$.

**Existential elimination ($\exists$E):**

$$\frac{\Gamma \vdash \exists x.\, \varphi(x) \quad \Gamma, \varphi(y) \vdash \chi}{\Gamma \vdash \chi} \; (\exists\text{E})$$

where $y$ is fresh (does not occur in $\Gamma$, $\chi$, or $\exists x.\, \varphi(x)$). This rule says: if we know some $x$ satisfies $\varphi$, and we can derive $\chi$ from $\varphi(y)$ for a fresh $y$, then $\chi$ follows. The freshness condition ensures we do not accidentally use properties of a specific witness.

**Example 2.2.** Proof that $\forall x.\, (P(x) \to Q(x)), \; \exists x.\, P(x) \vdash \exists x.\, Q(x)$:

1. $\exists x.\, P(x)$ (assumption)
2. $P(y)$ (assumption, fresh $y$, for $\exists$E)
3. $\forall x.\, (P(x) \to Q(x))$ (assumption)
4. $P(y) \to Q(y)$ (from 3, by $\forall$E with $t = y$)
5. $Q(y)$ (from 4 and 2, by $\to$E)
6. $\exists x.\, Q(x)$ (from 5, by $\exists$I)
7. $\exists x.\, Q(x)$ (from 1, 2-6, by $\exists$E, discharging $P(y)$)

### 2.8 Rules for Equality

**Reflexivity:**

$$\frac{}{\Gamma \vdash t = t} \; (\text{refl})$$

**Substitution (Leibniz):**

$$\frac{\Gamma \vdash t_1 = t_2 \quad \Gamma \vdash \varphi(t_1)}{\Gamma \vdash \varphi(t_2)} \; (\text{subst})$$

Symmetry and transitivity are derivable from reflexivity and substitution.

---

## 3. Classical vs Intuitionistic Logic

### 3.1 The Divide

The rules given above (without further additions) constitute *intuitionistic natural deduction*. In intuitionistic logic, a proof of $\varphi \lor \psi$ must provide a proof of $\varphi$ or a proof of $\psi$ — you cannot merely show that the negation of both leads to contradiction.

**Classical logic** adds one of the following equivalent principles:

**Law of excluded middle (LEM):**

$$\frac{}{\Gamma \vdash \varphi \lor \neg\varphi} \; (\text{LEM})$$

**Double negation elimination (DNE):**

$$\frac{\Gamma \vdash \neg\neg\varphi}{\Gamma \vdash \varphi} \; (\text{DNE})$$

**Classical contradiction (RAA — reductio ad absurdum):**

$$\frac{\Gamma, \neg\varphi \vdash \bot}{\Gamma \vdash \varphi} \; (\text{RAA})$$

**Proposition 3.1.** Over intuitionistic logic, LEM, DNE, and RAA are all interderivable. Any one of them, added to intuitionistic logic, yields classical logic.

*Proof that RAA implies LEM.* Assume $\neg(\varphi \lor \neg\varphi)$. Then assuming $\varphi$, we get $\varphi \lor \neg\varphi$ by $\lor$I$_1$, contradicting our assumption. So $\neg\varphi$ by $\neg$I. But then $\varphi \lor \neg\varphi$ by $\lor$I$_2$, again a contradiction. So $\bot$, and by RAA (discharging $\neg(\varphi \lor \neg\varphi)$), we get $\varphi \lor \neg\varphi$. $\square$

### 3.2 Constructive Content

In intuitionistic logic, proofs carry *computational content*:

- A proof of $\varphi \land \psi$ is a pair $(d_1, d_2)$ where $d_1$ proves $\varphi$ and $d_2$ proves $\psi$.
- A proof of $\varphi \to \psi$ is a function transforming proofs of $\varphi$ into proofs of $\psi$.
- A proof of $\exists x.\, \varphi(x)$ is a pair $(t, d)$ where $t$ is a witness and $d$ proves $\varphi(t)$.
- A proof of $\varphi \lor \psi$ is a tagged proof: either a proof of $\varphi$ or a proof of $\psi$, with a tag indicating which.

Classical logic breaks this by allowing proofs that show something exists without constructing a witness. For example, the classical proof that there exist irrational $a, b$ such that $a^b$ is rational (using $\sqrt{2}^{\sqrt{2}}$) does not tell you which case holds — it merely argues by cases using LEM.

### 3.3 What Cannot Be Proved Intuitionistically

The following are *not* derivable in intuitionistic logic:

- $\varphi \lor \neg\varphi$ (excluded middle)
- $\neg\neg\varphi \to \varphi$ (double negation elimination)
- $((\varphi \to \psi) \to \varphi) \to \varphi$ (Peirce's law)
- $(\neg\varphi \to \neg\psi) \to (\psi \to \varphi)$ (contrapositive direction)

However, the following *are* intuitionistically valid:

- $\varphi \to \neg\neg\varphi$ (one direction of double negation)
- $\neg\neg(\varphi \lor \neg\varphi)$ (double negation of LEM)
- $\neg\neg\neg\varphi \to \neg\varphi$ (triple negation reduces to single)

**Theorem 3.2 (Glivenko, 1929).** A propositional formula $\varphi$ is a classical tautology if and only if $\neg\neg\varphi$ is an intuitionistic tautology. This is the *double negation translation*.

### 3.4 Relevance to Proof Assistants

Different proof assistants make different choices:

| System | Logic | Classical reasoning |
|--------|-------|-------------------|
| Isabelle/HOL | Classical higher-order logic | Built in |
| Isabelle/FOL | Classical first-order logic | Built in (via axiom) |
| Isabelle/Pure | Intuitionistic fragment | Metalogic only |
| Coq | Intuitionistic CIC | Available as axiom |
| Lean 4 | Classical CIC | Built in (propositional extensionality + choice) |
| Agda | Intuitionistic MLTT | Postulated if needed |

Isabelle/HOL and Isabelle/FOL are fully classical. This means we can freely use proof by contradiction, excluded middle, and classical choice. The tradeoff is that proofs in these systems do not directly yield computational content (programs).

---

## 4. Sequent Calculus

### 4.1 Motivation

Natural deduction is intuitive but has a flaw for proof search: the elimination rules introduce nondeterminism. Given a goal, it is not always clear which elimination rule to apply. Gentzen's *sequent calculus* (1935) reformulates logic in a way better suited for proof search and metatheoretic analysis.

### 4.2 Sequents

**Definition 4.1 (Sequent).** A *sequent* is a judgment of the form:

$$\Gamma \Rightarrow \Delta$$

where $\Gamma$ and $\Delta$ are finite multisets of formulas. The intuitive reading is: "if all formulas in $\Gamma$ hold, then at least one formula in $\Delta$ holds."

In classical logic, $\Gamma \Rightarrow \Delta$ is valid iff $\bigwedge \Gamma \to \bigvee \Delta$ is valid. Having multiple formulas on the right ($\Delta$) captures disjunctive information and is the key difference from natural deduction.

**Remark.** Intuitionistic sequent calculus restricts $\Delta$ to have at most one formula (single-succedent sequents), reflecting the constructive requirement that we prove one specific thing.

### 4.3 Structural Rules

**Identity (Axiom):**

$$\frac{}{\varphi \Rightarrow \varphi} \; (\text{Id})$$

**Weakening:**

$$\frac{\Gamma \Rightarrow \Delta}{\Gamma, \varphi \Rightarrow \Delta} \; (\text{WL}) \qquad \frac{\Gamma \Rightarrow \Delta}{\Gamma \Rightarrow \Delta, \varphi} \; (\text{WR})$$

**Contraction:**

$$\frac{\Gamma, \varphi, \varphi \Rightarrow \Delta}{\Gamma, \varphi \Rightarrow \Delta} \; (\text{CL}) \qquad \frac{\Gamma \Rightarrow \Delta, \varphi, \varphi}{\Gamma \Rightarrow \Delta, \varphi} \; (\text{CR})$$

**Cut:**

$$\frac{\Gamma \Rightarrow \Delta, \varphi \quad \varphi, \Sigma \Rightarrow \Pi}{\Gamma, \Sigma \Rightarrow \Delta, \Pi} \; (\text{Cut})$$

The cut rule is the sequent calculus analogue of modus ponens: it lets us use lemmas (the cut formula $\varphi$ is "used up" and disappears).

### 4.4 Logical Rules

Each connective has a left rule (how to use it as an assumption) and a right rule (how to prove it as a goal).

**Conjunction:**

$$\frac{\Gamma, \varphi \Rightarrow \Delta}{\Gamma, \varphi \land \psi \Rightarrow \Delta} \; (\land\text{L}_1) \qquad \frac{\Gamma, \psi \Rightarrow \Delta}{\Gamma, \varphi \land \psi \Rightarrow \Delta} \; (\land\text{L}_2)$$

$$\frac{\Gamma \Rightarrow \Delta, \varphi \quad \Gamma \Rightarrow \Delta, \psi}{\Gamma \Rightarrow \Delta, \varphi \land \psi} \; (\land\text{R})$$

**Disjunction:**

$$\frac{\Gamma, \varphi \Rightarrow \Delta \quad \Gamma, \psi \Rightarrow \Delta}{\Gamma, \varphi \lor \psi \Rightarrow \Delta} \; (\lor\text{L})$$

$$\frac{\Gamma \Rightarrow \Delta, \varphi}{\Gamma \Rightarrow \Delta, \varphi \lor \psi} \; (\lor\text{R}_1) \qquad \frac{\Gamma \Rightarrow \Delta, \psi}{\Gamma \Rightarrow \Delta, \varphi \lor \psi} \; (\lor\text{R}_2)$$

**Implication:**

$$\frac{\Gamma \Rightarrow \Delta, \varphi \quad \Gamma, \psi \Rightarrow \Delta}{\Gamma, \varphi \to \psi \Rightarrow \Delta} \; (\to\text{L})$$

$$\frac{\Gamma, \varphi \Rightarrow \Delta, \psi}{\Gamma \Rightarrow \Delta, \varphi \to \psi} \; (\to\text{R})$$

**Negation:**

$$\frac{\Gamma \Rightarrow \Delta, \varphi}{\Gamma, \neg\varphi \Rightarrow \Delta} \; (\neg\text{L}) \qquad \frac{\Gamma, \varphi \Rightarrow \Delta}{\Gamma \Rightarrow \Delta, \neg\varphi} \; (\neg\text{R})$$

**Quantifiers:**

$$\frac{\Gamma, \varphi(t) \Rightarrow \Delta}{\Gamma, \forall x.\, \varphi(x) \Rightarrow \Delta} \; (\forall\text{L}) \qquad \frac{\Gamma \Rightarrow \Delta, \varphi(y)}{\Gamma \Rightarrow \Delta, \forall x.\, \varphi(x)} \; (\forall\text{R})$$

where $y$ is fresh in $(\forall\text{R})$ and $t$ is any term in $(\forall\text{L})$.

$$\frac{\Gamma, \varphi(y) \Rightarrow \Delta}{\Gamma, \exists x.\, \varphi(x) \Rightarrow \Delta} \; (\exists\text{L}) \qquad \frac{\Gamma \Rightarrow \Delta, \varphi(t)}{\Gamma \Rightarrow \Delta, \exists x.\, \varphi(x)} \; (\exists\text{R})$$

where $y$ is fresh in $(\exists\text{L})$.

### 4.5 Cut Elimination

**Theorem 4.2 (Gentzen's Hauptsatz, 1935).** Every proof in the sequent calculus that uses the cut rule can be transformed into a proof that does not use cut (a *cut-free proof*).

This is one of the most important results in proof theory. Its consequences include:

1. **Subformula property.** In a cut-free proof, every formula appearing in the proof is a subformula of the conclusion. This drastically limits the search space for proofs.

2. **Consistency.** The sequent $\Rightarrow$ (empty antecedent and succedent, representing $\bot$) is not derivable. In a cut-free proof, every rule introduces a connective, so we can never derive the empty sequent. Since cut elimination preserves derivability, $\bot$ is underivable in the full system too.

3. **Decidability of propositional logic.** The subformula property makes proof search for propositional sequents finite and hence decidable.

4. **Interpolation.** If $\vdash \varphi \to \psi$, there exists a formula $\chi$ (the *Craig interpolant*) containing only symbols common to $\varphi$ and $\psi$ such that $\vdash \varphi \to \chi$ and $\vdash \chi \to \psi$.

---

## 5. Relationship Between Natural Deduction and Sequent Calculus

### 5.1 Translation

There is a systematic translation between the two systems:

- Introduction rules in natural deduction correspond to right rules in sequent calculus.
- Elimination rules correspond to left rules (plus cut).
- The discharge of assumptions in $\to$I corresponds to moving a formula from left to right of the sequent arrow.

**Theorem 5.1.** $\Gamma \vdash_{\text{ND}} \varphi$ if and only if $\Gamma \Rightarrow \varphi$ is derivable in the sequent calculus.

### 5.2 The Curry-Howard Correspondence (Preview)

The *Curry-Howard correspondence* (also called propositions-as-types, proofs-as-programs) establishes a deep connection between logic and computation:

| Logic | Type Theory |
|-------|-------------|
| Proposition $\varphi$ | Type $A$ |
| Proof of $\varphi$ | Term of type $A$ |
| $\varphi \to \psi$ | Function type $A \to B$ |
| $\varphi \land \psi$ | Product type $A \times B$ |
| $\varphi \lor \psi$ | Sum type $A + B$ |
| $\forall x.\, \varphi(x)$ | Dependent product $\Pi_{x:A} B(x)$ |
| $\exists x.\, \varphi(x)$ | Dependent sum $\Sigma_{x:A} B(x)$ |
| $\bot$ | Empty type $\mathbf{0}$ |
| Hypothesis | Variable |
| $\to$I (discharge) | Lambda abstraction |
| $\to$E (modus ponens) | Function application |
| Proof normalization | Beta reduction |

Under this correspondence:

- A proof of $\varphi \to \psi$ is a function that transforms evidence for $\varphi$ into evidence for $\psi$.
- Proof normalization (eliminating introduction/elimination detours) corresponds to evaluating a program (beta reduction).

This correspondence is foundational for type-theoretic proof assistants (Coq, Lean, Agda). Isabelle takes a different approach (the LCF architecture, Lecture 00c), but the Curry-Howard perspective illuminates why proofs and programs are deeply connected.

---

## 6. Exercises

**Exercise 6.1.** Construct a natural deduction proof tree for $\vdash \neg(p \land \neg p)$.

**Exercise 6.2.** Prove $p \to \neg\neg p$ in intuitionistic natural deduction (no LEM, DNE, or RAA).

**Exercise 6.3.** Prove that $\neg\neg(p \lor \neg p)$ is intuitionistically derivable.

*Hint:* Assume $\neg(p \lor \neg p)$ and derive $\bot$, using the fact that both $p$ and $\neg p$ lead to $p \lor \neg p$, contradicting the assumption.

**Exercise 6.4.** Give a complete sequent calculus proof (cut-free) of $\Rightarrow (p \to q) \to (\neg q \to \neg p)$ (contrapositive).

**Exercise 6.5.** Show that if we restrict sequents to have at most one formula on the right ($|\Delta| \le 1$), the law of excluded middle $\Rightarrow \varphi \lor \neg\varphi$ is no longer derivable. Explain where the proof breaks down.

**Exercise 6.6.** Prove the following in intuitionistic natural deduction:

**(a)** $\varphi \to (\psi \to \varphi)$ (weakening / K combinator)

**(b)** $(\varphi \to \psi \to \chi) \to (\varphi \to \psi) \to (\varphi \to \chi)$ (S combinator)

**(c)** $(\varphi \to \psi) \to (\psi \to \chi) \to (\varphi \to \chi)$ (transitivity)

**Exercise 6.7.** Explain why the existential elimination rule requires a fresh variable. Give a concrete example where using a non-fresh variable leads to an unsound derivation.

**Exercise 6.8.** Using the Curry-Howard correspondence, what program corresponds to a proof of $\varphi \to \psi \to \varphi$? What program corresponds to a proof of $(\varphi \to \psi \to \chi) \to (\varphi \to \psi) \to \varphi \to \chi$?

---

## References

- Gentzen, G. "Untersuchungen uber das logische Schliessen." *Mathematische Zeitschrift*, 1935. (English translation: "Investigations into Logical Deduction.")
- Prawitz, D. *Natural Deduction: A Proof-Theoretical Study*. Almqvist & Wiksell, 1965. Reprinted by Dover, 2006.
- Troelstra, A.S. and Schwichtenberg, H. *Basic Proof Theory*. 2nd ed. Cambridge University Press, 2000.
- Sorensen, M.H. and Urzyczyn, P. *Lectures on the Curry-Howard Isomorphism*. Elsevier, 2006.
- Girard, J.-Y., Taylor, P., and Lafont, Y. *Proofs and Types*. Cambridge University Press, 1989.

---

*Previous: [Lecture 00a: Propositional & Predicate Logic](lecture_00a_propositional_predicate_logic.md)*
*Next: [Lecture 00c: Proof Assistants & the LCF Architecture](lecture_00c_proof_assistants_lcf_architecture.md)*
