# Homework 0: Logic Bootcamp

> **Module 00 — Pre-Work**
> **Due:** First day of class
> **Estimated time:** 10-15 hours
> **Total points:** 200

---

## Instructions

- Show all work for theory problems. A correct answer without justification receives no credit.
- For proofs, state clearly what you are assuming and what you are proving.
- For natural deduction proofs, present either a proof tree or a Fitch-style derivation with every rule application labeled.
- You may consult Enderton's *A Mathematical Introduction to Logic* or van Dalen's *Logic and Structure* as references. Cite any other sources you use.
- Collaboration policy: you may discuss ideas with classmates, but write up all solutions independently.

---

## Part A: Propositional Logic (50 points)

### Problem A1: Truth Tables and Validity (10 pts)

For each formula, determine whether it is a tautology, satisfiable but not a tautology, or a contradiction. Justify your answer with a truth table or a semantic argument.

**(a)** (2 pts) $(p \to q) \to (\neg q \to \neg p)$

**(b)** (2 pts) $(p \to q) \to (q \to p)$

**(c)** (3 pts) $((p \to q) \to p) \to p$ (Peirce's law)

**(d)** (3 pts) $(p \to q) \lor (q \to r)$

*Hint for (d):* Consider what happens when $q$ is true vs. when $q$ is false.

### Problem A2: Logical Equivalence and Normal Forms (12 pts)

**(a)** (4 pts) Prove using logical equivalences (not truth tables) that:

$$\neg(p \to q) \equiv p \land \neg q$$

Show each step and name the equivalence used.

**(b)** (4 pts) Convert the formula $(\neg p \lor q) \to (p \land r)$ to conjunctive normal form (CNF). Show your work.

**(c)** (4 pts) How many clauses does the CNF of a formula with $n$ variables have in the worst case? How many clauses does the Tseitin transformation produce? Briefly explain the tradeoff.

### Problem A3: Natural Deduction Proofs — Propositional (18 pts)

Give natural deduction proofs of each of the following. Use only the intuitionistic rules (no LEM, DNE, or RAA) unless the problem specifies classical logic.

**(a)** (3 pts) $\vdash (\varphi \to \psi) \to (\psi \to \chi) \to (\varphi \to \chi)$ (hypothetical syllogism)

**(b)** (3 pts) $\vdash \varphi \land (\psi \lor \chi) \to (\varphi \land \psi) \lor (\varphi \land \chi)$ (distribution, intuitionistic)

**(c)** (4 pts) $\vdash \neg(\varphi \lor \psi) \leftrightarrow (\neg\varphi \land \neg\psi)$ (De Morgan, intuitionistic)

*Note:* One direction requires LEM in general, but this particular De Morgan law is fully intuitionistic. Be precise about which direction is which.

**(d)** (4 pts) $\vdash ((\varphi \to \psi) \to \varphi) \to \varphi$ (Peirce's law — requires classical logic)

*Hint:* Use RAA. Assume $\neg\varphi$, then construct a proof of $\varphi \to \psi$ from $\neg\varphi$, and apply the hypothesis.

**(e)** (4 pts) $\vdash \neg\neg(\varphi \lor \neg\varphi)$ (double negation of LEM — intuitionistic!)

*Hint:* Assume $\neg(\varphi \lor \neg\varphi)$. Show that both $\varphi$ and $\neg\varphi$ lead to $\varphi \lor \neg\varphi$, contradicting the assumption. Conclude $\bot$, then apply $\neg$I.

### Problem A4: Adequacy of Connectives (10 pts)

**(a)** (3 pts) Prove that $\{\neg, \to\}$ is an adequate set of connectives by expressing $\varphi \land \psi$ and $\varphi \lor \psi$ in terms of $\neg$ and $\to$.

**(b)** (3 pts) Prove that $\{\to, \bot\}$ is adequate by expressing $\neg\varphi$, $\varphi \land \psi$, and $\varphi \lor \psi$.

*Hint for $\land$:* $\varphi \land \psi \equiv \neg(\varphi \to \neg\psi)$.

**(c)** (4 pts) Prove that $\{\land, \lor\}$ is *not* adequate.

*Hint:* Show that every truth function expressible using only $\land$ and $\lor$ (with no negation or constants) is *monotone*: if you flip any input from 0 to 1, the output cannot change from 1 to 0. Then observe that $\neg$ is not monotone.

---

## Part B: Predicate Logic (50 points)

### Problem B1: First-Order Translations (12 pts)

Let $\mathcal{L}$ be a first-order language with binary relation symbols $<$ and $\in$, a unary function symbol $S$ (successor), and a constant $0$. Translate the following English statements into first-order sentences.

**(a)** (2 pts) "Every natural number is less than its successor."

**(b)** (2 pts) "There is no greatest natural number."

**(c)** (3 pts) "For any two distinct natural numbers, one is less than the other."

**(d)** (2 pts) "Zero is less than every natural number except itself."

**(e)** (3 pts) "Every nonempty set of natural numbers has a least element." (Well-ordering principle)

*Note:* Be careful with the quantification in (e). You will need to quantify over sets, but we are in first-order logic with $\in$, so you can quantify over "set variables" ranging over collections that contain natural numbers.

### Problem B2: Free and Bound Variables (8 pts)

For each formula, identify all free variables and all bound variables. For each bound variable, identify its binding quantifier.

**(a)** (2 pts) $\forall x.\, (P(x, y) \to \exists y.\, Q(x, y))$

**(b)** (2 pts) $\exists x.\, (R(x) \land \forall x.\, S(x, z))$

**(c)** (2 pts) $\forall x.\, \exists y.\, (x < y \land \forall z.\, (z < y \to z \le x))$

**(d)** (2 pts) Explain the issue with the formula in (b). Is the inner $\forall x$ binding the same $x$ as the outer $\exists x$? What is the standard convention for handling this?

### Problem B3: Structures and Satisfaction (15 pts)

Consider the language $\mathcal{L} = \{R\}$ where $R$ is a binary relation symbol, and the following sentences:

- $\sigma_1$: $\forall x.\, R(x, x)$ (reflexivity)
- $\sigma_2$: $\forall x.\, \forall y.\, (R(x, y) \to R(y, x))$ (symmetry)
- $\sigma_3$: $\forall x.\, \forall y.\, \forall z.\, (R(x, y) \land R(y, z) \to R(x, z))$ (transitivity)
- $\sigma_4$: $\exists x.\, \exists y.\, (x \ne y \land R(x, y))$ (non-trivial)

**(a)** (3 pts) Give a structure $\mathfrak{A}$ with $|A| = 3$ that satisfies $\{\sigma_1, \sigma_2, \sigma_3, \sigma_4\}$. Specify the domain and the relation $R^{\mathfrak{A}}$ explicitly (as a set of pairs).

**(b)** (3 pts) Give a structure $\mathfrak{B}$ with $|B| = 3$ that satisfies $\{\sigma_1, \sigma_3, \sigma_4\}$ but not $\sigma_2$. Prove that $\sigma_2$ fails.

**(c)** (4 pts) Prove that any structure satisfying $\{\sigma_1, \sigma_2, \sigma_3\}$ is a disjoint union of cliques (complete subgraphs). Formally: the relation $R$ is an equivalence relation, and within each equivalence class, every pair is related.

**(d)** (5 pts) Show that the sentence "there are exactly $n$ elements" is expressible in first-order logic for any fixed $n$, but "the domain is finite" is not expressible by any single sentence or even any set of sentences.

*Hint for "not expressible":* Use the Compactness Theorem. Consider the set $\Gamma$ of sentences $\{\sigma_1, \sigma_2, \sigma_3\} \cup \{\delta_n : n \ge 1\}$ where $\delta_n$ says "there exist at least $n$ distinct elements."

### Problem B4: Natural Deduction with Quantifiers (15 pts)

Give natural deduction proofs (Fitch-style or tree-style) for each of the following.

**(a)** (3 pts) $\forall x.\, (P(x) \to Q(x)), \; \forall x.\, P(x) \vdash \forall x.\, Q(x)$

**(b)** (4 pts) $\exists x.\, (P(x) \land Q(x)) \vdash (\exists x.\, P(x)) \land (\exists x.\, Q(x))$

**(c)** (4 pts) $\forall x.\, (P(x) \lor Q(x)), \; \neg\exists x.\, Q(x) \vdash \forall x.\, P(x)$

*Hint:* Use $\neg\exists x.\, Q(x)$ to derive $\forall x.\, \neg Q(x)$ (this itself requires a small proof), then use disjunction elimination.

**(d)** (4 pts) $\vdash \neg\forall x.\, P(x) \to \exists x.\, \neg P(x)$ (requires classical logic)

*Hint:* Use RAA. Assume $\neg\exists x.\, \neg P(x)$ and derive $\forall x.\, P(x)$.

---

## Part C: Metatheory and Proof Strategy (50 points)

### Problem C1: Soundness (15 pts)

**(a)** (5 pts) Prove that the $\to$I rule is sound: if every valuation satisfying all formulas in $\Gamma \cup \{\varphi\}$ also satisfies $\psi$, then every valuation satisfying all formulas in $\Gamma$ also satisfies $\varphi \to \psi$.

**(b)** (5 pts) Prove that the $\forall$I rule is sound: if $\mathfrak{A} \models \varphi(x)[s]$ for every assignment $s$ such that $\mathfrak{A} \models \gamma[s]$ for all $\gamma \in \Gamma$, and $x$ is not free in $\Gamma$, then $\mathfrak{A} \models \forall x.\, \varphi(x)[s]$ for every such $s$.

**(c)** (5 pts) Explain why the eigenvariable condition in $\forall$I is necessary for soundness. Give a specific example of a false "derivation" that would be possible without the condition.

### Problem C2: Compactness Applications (15 pts)

**(a)** (5 pts) Use the Compactness Theorem to prove that if a set of propositional formulas $\Gamma$ is such that every finite subset is satisfiable, then $\Gamma$ itself is satisfiable. (This is a direct statement of compactness for propositional logic; prove it from the first-order version, or prove it independently using Konig's lemma.)

**(b)** (5 pts) Use compactness to prove that the class of finite graphs is not axiomatizable by any set of first-order sentences. That is, there is no set $\Gamma$ of first-order sentences such that the models of $\Gamma$ are exactly the finite graphs.

**(c)** (5 pts) *Non-standard models.* Let $T$ be the complete first-order theory of the natural numbers: $T = \{\sigma : \mathfrak{N} \models \sigma\}$. Use compactness to show that $T$ has a model that is not isomorphic to $\mathfrak{N}$.

*Hint:* Add a new constant $c$ and the sentences $c > 0, c > S(0), c > S(S(0)), \ldots$

### Problem C3: Proof Strategy Identification (20 pts)

For each statement below, identify the proof technique(s) you would use (direct proof, contradiction, contrapositive, induction, case analysis, existential witness construction, etc.) and give a brief outline (3-5 sentences) of the proof strategy. You do not need to give complete proofs.

**(a)** (4 pts) "If $n^2$ is even, then $n$ is even." (for natural numbers)

**(b)** (4 pts) "There is no rational number whose square is 2."

**(c)** (4 pts) "For every $\epsilon > 0$, there exists $N$ such that for all $n > N$, $|a_n - L| < \epsilon$." (convergence of a specific sequence, e.g., $a_n = 1/n$, $L = 0$)

**(d)** (4 pts) "Every equivalence relation on a set $A$ induces a partition of $A$."

**(e)** (4 pts) "If $f : A \to B$ is a bijection, then $f^{-1} : B \to A$ is also a bijection."

---

## Part D: Warm-up Exercises for Isabelle (50 points)

These problems prepare you for using Isabelle in Module 01. You do not need access to Isabelle yet — they test understanding of the concepts.

### Problem D1: LCF Architecture Analysis (15 pts)

**(a)** (5 pts) Suppose a proof assistant uses the LCF architecture with the following kernel functions for propositional logic:

```
assume : form -> thm                    (* {P} |- P *)
imp_intro : form -> thm -> thm         (* G,P |- Q  ==>  G |- P -> Q *)
imp_elim : thm -> thm -> thm           (* G |- P->Q, D |- P  ==>  G,D |- Q *)
conj_intro : thm -> thm -> thm         (* G |- P, D |- Q  ==>  G,D |- P /\ Q *)
conj_elim1 : thm -> thm                (* G |- P /\ Q  ==>  G |- P *)
conj_elim2 : thm -> thm                (* G |- P /\ Q  ==>  G |- Q *)
```

Write a derived function `and_comm : thm -> thm` that, given a theorem of the form $\Gamma \vdash P \land Q$, produces $\Gamma \vdash Q \land P$. Express your answer in ML-like pseudocode.

**(b)** (5 pts) Write a derived function `imp_trans : thm -> thm -> thm` that, given $\Gamma \vdash P \to Q$ and $\Delta \vdash Q \to R$, produces $\Gamma \cup \Delta \vdash P \to R$.

**(c)** (5 pts) Explain why a bug in `and_comm` or `imp_trans` cannot cause the system to accept an invalid theorem. What would the bug manifest as instead?

### Problem D2: Metalogic vs Object Logic (15 pts)

**(a)** (5 pts) Consider Isabelle's representation of the conjunction introduction rule:

$$\llbracket P;\; Q \rrbracket \Longrightarrow P \land Q$$

Rewrite this without the bracket notation, using explicit $\Longrightarrow$ connectives. Then explain: if we replaced $\Longrightarrow$ with the object-level $\longrightarrow$, what would go wrong?

**(b)** (5 pts) Isabelle's $\forall$I rule is:

$$\left(\bigwedge x.\, P(x)\right) \Longrightarrow \forall x.\, P(x)$$

Explain the difference between $\bigwedge$ (meta-forall) and $\forall$ (object-forall). Why are two levels of universal quantification needed?

**(c)** (5 pts) Isabelle can support multiple object logics (FOL, HOL, ZF) simultaneously. Explain why the metalogic/object logic separation makes this possible. What would happen if the rules of FOL were hard-coded into the kernel?

### Problem D3: Reading Proof States (20 pts)

In Isabelle, when you are in the middle of a proof, the system displays the current *proof state*. Here is an example:

```
goal (3 subgoals):
 1. P /\ Q ==> Q /\ P
 2. !!x. P(x) ==> Q(x) ==> P(x) /\ Q(x)
 3. [| A --> B; A |] ==> B
```

**(a)** (6 pts) Translate each subgoal into standard mathematical notation. What does `!!x` mean? What does `[| ... ; ... |]` mean?

**(b)** (7 pts) For each subgoal, suggest which proof method(s) might solve it (choose from: `rule conjI`, `rule conjE`, `rule impE`, `rule mp`, `assumption`, `auto`, `blast`). Justify your choices.

**(c)** (7 pts) Subgoal 3 uses FOL's implication $\longrightarrow$ (written `-->` in ASCII). If we apply the rule `mp` (modus ponens: $\llbracket P \longrightarrow Q;\; P \rrbracket \Longrightarrow Q$), what new subgoals would be generated? Explain the resolution process.

---

## Submission Checklist

- [ ] Part A: Problems A1-A4, all proofs and derivations shown.
- [ ] Part B: Problems B1-B4, all translations, analyses, and proofs shown.
- [ ] Part C: Problems C1-C3, all proofs and strategy descriptions.
- [ ] Part D: Problems D1-D3, all pseudocode and explanations.

---

## Grading Rubric Summary

| Problem | Points | Topic |
|---------|--------|-------|
| A1 | 10 | Truth tables and validity |
| A2 | 12 | Equivalences and normal forms |
| A3 | 18 | Propositional natural deduction |
| A4 | 10 | Adequacy of connectives |
| B1 | 12 | First-order translations |
| B2 | 8 | Free and bound variables |
| B3 | 15 | Structures and satisfaction |
| B4 | 15 | Natural deduction with quantifiers |
| C1 | 15 | Soundness proofs |
| C2 | 15 | Compactness applications |
| C3 | 20 | Proof strategy identification |
| D1 | 15 | LCF architecture analysis |
| D2 | 15 | Metalogic vs object logic |
| D3 | 20 | Reading proof states |
| **Total** | **200** | |

---

## Hints for Selected Problems

**A3(c):** For the left-to-right direction ($\neg(\varphi \lor \psi) \to \neg\varphi \land \neg\psi$): assume $\neg(\varphi \lor \psi)$. To show $\neg\varphi$, assume $\varphi$, derive $\varphi \lor \psi$ by $\lor$I$_1$, and contradict $\neg(\varphi \lor \psi)$. For the right-to-left direction, use $\lor$E on an assumed $\varphi \lor \psi$ and derive $\bot$ from each case using $\neg\varphi$ and $\neg\psi$.

**B3(d):** For fixed $n$, "there are exactly $n$ elements" can be written as $\exists x_1 \cdots \exists x_n.\, (\bigwedge_{i \ne j} x_i \ne x_j \land \forall y.\, \bigvee_i y = x_i)$. For the impossibility result, suppose $\Gamma$ axiomatizes finiteness. Then $\Gamma \cup \{\delta_n : n \ge 1\}$ (where $\delta_n$ says "there are at least $n$ elements") is finitely satisfiable (any sufficiently large finite structure works), hence satisfiable by compactness — but any model is infinite, contradicting $\Gamma$.

**D1(a):** `fun and_comm th = conj_intro (conj_elim2 th) (conj_elim1 th)`

---

*Good luck! This homework ensures you have the logical foundations needed for the rest of the course.*
