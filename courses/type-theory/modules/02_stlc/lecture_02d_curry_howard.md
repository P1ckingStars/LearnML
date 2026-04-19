---
title: "Lecture 02d: The Curry-Howard Correspondence"
tags:
  - type-theory
  - stlc
  - lecture
---
# Lecture 02d: The Curry-Howard Correspondence

> **Module 02 --- Simply Typed Lambda Calculus (Weeks 3-4)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. State the Curry-Howard correspondence and explain the slogan "propositions are types, proofs are programs."
2. Present the rules of intuitionistic propositional logic in natural deduction style.
3. Establish the precise correspondence between natural deduction rules and STLC typing rules.
4. Translate proofs into programs and programs into proofs across the correspondence.
5. Explain why proof normalization corresponds to beta-reduction (computation).
6. Articulate why the correspondence uses intuitionistic (not classical) logic and connect this to the BHK interpretation.
7. Extend the correspondence to include conjunction/products, disjunction/sums, truth/unit, and falsity/void.
8. Describe the historical development from Curry (1958) through Howard (1969/1980) and de Bruijn.

---

## 1. Motivation: A Deep Connection

### 1.1 Two Parallel Worlds

Consider two seemingly unrelated intellectual endeavors:

**Logic**: A mathematician wants to prove the proposition $A \implies (B \implies A)$. In a natural deduction proof, she assumes $A$, then assumes $B$, and concludes $A$ (by the first assumption). Discharging assumptions, she obtains a proof of $A \implies (B \implies A)$.

**Type theory**: A programmer wants to construct a term of type $A \to (B \to A)$. She writes $\lambda a : A.\, \lambda b : B.\, a$, which type-checks: given an $a$ of type $A$ and a $b$ of type $B$, return $a$ (of type $A$).

These are the **same thing**. The proof *is* the program. The proposition *is* the type.

### 1.2 The Correspondence in Slogan Form

The **Curry-Howard correspondence** (also called the **Curry-Howard isomorphism**, the **proofs-as-programs interpretation**, or the **propositions-as-types paradigm**) establishes a precise structural isomorphism:

| Logic | Type Theory |
|-------|------------|
| Proposition | Type |
| Proof | Term (program) |
| Provability | Type inhabitation |
| Proof normalization | Computation (beta-reduction) |
| Assumption | Free variable |
| Hypothesis discharge | Lambda abstraction (variable binding) |

This is not merely an analogy --- it is a rigorous, structure-preserving bijection between formal systems.

### 1.3 Why This Matters

The Curry-Howard correspondence is arguably the most important idea in the foundations of computer science and mathematics:

1. **It unifies two fundamental disciplines.** Logic and computation were developed independently for centuries. The Curry-Howard correspondence shows they are the same subject, studied from different perspectives. This is as surprising and deep as the connection between geometry and algebra revealed by Descartes' coordinate geometry.

2. **It provides a foundation for proof assistants.** Proof assistants like Coq, Agda, and Lean are based directly on the correspondence. Writing a proof in these systems is literally writing a program. The type checker verifies the proof by type-checking the program. Billions of lines of mathematical proof have been verified this way, including the proof of the four-color theorem (Coq), the Kepler conjecture (Lean), and large parts of algebraic topology (Agda/HoTT).

3. **It guides language design.** The correspondence suggests a principle for designing type systems: every type constructor should correspond to a logical connective, with clear introduction and elimination forms. This principle has guided the design of ML, Haskell, Rust, and many other languages.

4. **It reveals the computational content of proofs.** A classical existence proof ($\exists x.\, P(x)$) says "there exists an $x$ satisfying $P$" but does not tell us how to find it. A constructive proof (under Curry-Howard) *is* a program that computes the witness $x$. This is the basis of **program extraction**: automatically deriving correct programs from proofs of their specifications.

### 1.4 Scope of This Lecture

In this lecture, we establish the correspondence for the simply typed lambda calculus and intuitionistic propositional logic. In later modules, we will see how it extends:

| Logic | Type System | Module |
|-------|------------|--------|
| Intuitionistic propositional logic | STLC (this lecture) | 02 |
| Intuitionistic predicate logic | Dependent types ($\Pi$, $\Sigma$) | 08 |
| Second-order logic | System F ($\forall$, $\exists$) | 06 |
| Higher-order logic | System F-omega | 07 |
| Linear logic | Linear types | 09 |

---

## 2. Intuitionistic Propositional Logic

### 2.1 Why Intuitionistic?

Classical logic includes the **law of excluded middle** (LEM): for every proposition $P$, either $P$ or $\neg P$ holds. Intuitionistic logic rejects LEM, requiring that every assertion of existence be backed by a **construction** (a witness).

The type-theoretic reason is clear: to inhabit the type $A + \neg A$ for every type $A$, we would need a program that, given any type $A$, either produces a value of type $A$ or proves that $A$ is uninhabitable. No such program can exist in a terminating language (it would solve the halting problem, in a sense).

More precisely, under the Curry-Howard correspondence:
- LEM ($A \lor \neg A$) corresponds to the type $A + (A \to \text{Void})$.
- Inhabiting this type for all $A$ would require a decision procedure for type inhabitation, which, while decidable for STLC, cannot be realized as a uniform program term within the calculus itself.
- Adding LEM as an axiom (a constant of type $\forall A.\, A + (A \to \text{Void})$) breaks the computational interpretation: it corresponds to a control operator like call/cc (Peirce's law), which is non-constructive.

### 2.2 Propositions

The propositions of intuitionistic propositional logic are built from propositional variables and logical connectives:

$$\phi ::= P \mid \phi_1 \implies \phi_2 \mid \phi_1 \land \phi_2 \mid \phi_1 \lor \phi_2 \mid \top \mid \bot$$

where:
- $P, Q, R, \ldots$ are propositional variables (atomic propositions).
- $\phi_1 \implies \phi_2$ is implication.
- $\phi_1 \land \phi_2$ is conjunction.
- $\phi_1 \lor \phi_2$ is disjunction.
- $\top$ is truth (verum).
- $\bot$ is falsity (falsum).
- Negation is defined: $\neg \phi \equiv \phi \implies \bot$.

### 2.3 Intuitionistic Propositional Logic vs. Classical Logic

To make the distinction precise, here are some well-known classical tautologies and their status in intuitionistic logic:

| Principle | Classical? | Intuitionistic? | Corresponding Type |
|-----------|-----------|-----------------|-------------------|
| $A \lor \neg A$ (LEM) | Yes | No | $A + (A \to \text{Void})$ |
| $\neg\neg A \implies A$ (DNE) | Yes | No | $((A \to \text{Void}) \to \text{Void}) \to A$ |
| $((A \implies B) \implies A) \implies A$ (Peirce) | Yes | No | $((A \to B) \to A) \to A$ |
| $(A \implies B) \lor (B \implies A)$ | Yes | No | $(A \to B) + (B \to A)$ |
| $\neg(A \land B) \implies \neg A \lor \neg B$ (De Morgan) | Yes | No | $((A \times B) \to \text{Void}) \to (A \to \text{Void}) + (B \to \text{Void})$ |
| $A \implies A$ | Yes | Yes | $A \to A$ |
| $A \implies B \implies A$ | Yes | Yes | $A \to B \to A$ |
| $\neg\neg\neg A \implies \neg A$ | Yes | Yes | $(((A \to \text{Void}) \to \text{Void}) \to \text{Void}) \to (A \to \text{Void})$ |
| $(A \implies B) \implies \neg B \implies \neg A$ (Contraposition) | Yes | Yes | $(A \to B) \to (B \to \text{Void}) \to (A \to \text{Void})$ |

The non-intuitionistic principles all involve some form of "deciding" a proposition without having a constructive proof, which would require a computational mechanism (like continuations) that goes beyond pure lambda calculus.

### 2.4 Natural Deduction

Natural deduction, introduced by Gentzen (1935) and refined by Prawitz (1965), presents proofs as trees built from **introduction** and **elimination** rules for each connective.

A judgment has the form $\Delta \vdash \phi$, meaning "from hypotheses $\Delta$, we can derive $\phi$."

We present the rules for each connective.

#### 2.3.1 Implication

**Introduction** (assume $\phi_1$ and derive $\phi_2$; then conclude $\phi_1 \implies \phi_2$):

$$\frac{\Delta, \phi_1 \vdash \phi_2}{\Delta \vdash \phi_1 \implies \phi_2} \quad (\implies\text{-I})$$

**Elimination** (modus ponens: from $\phi_1 \implies \phi_2$ and $\phi_1$, conclude $\phi_2$):

$$\frac{\Delta \vdash \phi_1 \implies \phi_2 \quad \Delta \vdash \phi_1}{\Delta \vdash \phi_2} \quad (\implies\text{-E})$$

#### 2.3.2 Conjunction

**Introduction** (from $\phi_1$ and $\phi_2$, conclude $\phi_1 \land \phi_2$):

$$\frac{\Delta \vdash \phi_1 \quad \Delta \vdash \phi_2}{\Delta \vdash \phi_1 \land \phi_2} \quad (\land\text{-I})$$

**Elimination** (from $\phi_1 \land \phi_2$, conclude $\phi_1$ or $\phi_2$):

$$\frac{\Delta \vdash \phi_1 \land \phi_2}{\Delta \vdash \phi_1} \quad (\land\text{-E}_1)$$

$$\frac{\Delta \vdash \phi_1 \land \phi_2}{\Delta \vdash \phi_2} \quad (\land\text{-E}_2)$$

#### 2.3.3 Disjunction

**Introduction** (from $\phi_1$, conclude $\phi_1 \lor \phi_2$; or from $\phi_2$, conclude $\phi_1 \lor \phi_2$):

$$\frac{\Delta \vdash \phi_1}{\Delta \vdash \phi_1 \lor \phi_2} \quad (\lor\text{-I}_1)$$

$$\frac{\Delta \vdash \phi_2}{\Delta \vdash \phi_1 \lor \phi_2} \quad (\lor\text{-I}_2)$$

**Elimination** (proof by cases: from $\phi_1 \lor \phi_2$ and proofs of $\psi$ from each disjunct, conclude $\psi$):

$$\frac{\Delta \vdash \phi_1 \lor \phi_2 \quad \Delta, \phi_1 \vdash \psi \quad \Delta, \phi_2 \vdash \psi}{\Delta \vdash \psi} \quad (\lor\text{-E})$$

#### 2.3.4 Truth and Falsity

**Truth introduction** ($\top$ is always provable):

$$\frac{}{\Delta \vdash \top} \quad (\top\text{-I})$$

There is no truth elimination rule (knowing that $\top$ holds gives no useful information).

**Falsity elimination** (ex falso quodlibet: from $\bot$, anything follows):

$$\frac{\Delta \vdash \bot}{\Delta \vdash \phi} \quad (\bot\text{-E})$$

There is no falsity introduction rule (it should be impossible to prove $\bot$, and indeed it is in a consistent system).

#### 2.4.5 Hypothesis

$$\frac{\phi \in \Delta}{\Delta \vdash \phi} \quad (\text{Hyp})$$

### 2.5 Summary of Natural Deduction Rules

For reference, here is a compact summary:

| Connective | Introduction | Elimination |
|-----------|-------------|-------------|
| $\implies$ | Assume $\phi_1$, derive $\phi_2$, discharge | Modus ponens |
| $\land$ | Pair of proofs | Left/Right projection |
| $\lor$ | Left/Right injection | Case analysis |
| $\top$ | Trivial | (none) |
| $\bot$ | (none) | Ex falso quodlibet |

Each introduction rule tells you how to **prove** a proposition of the given form. Each elimination rule tells you how to **use** a proof of the given form. This symmetry between introduction and elimination is a key organizing principle of natural deduction and, under Curry-Howard, of type theory.

### 2.6 Normal Proofs and the Subformula Property

A proof in natural deduction is **normal** if it contains no detours: no point where an introduction rule is immediately followed by the corresponding elimination rule. Prawitz (1965) proved:

**Theorem 2.1 (Prawitz Normalization).** Every proof in intuitionistic natural deduction can be transformed into a normal proof.

Normal proofs enjoy the **subformula property**: every formula appearing in a normal proof is a subformula of the conclusion or of one of the undischarged hypotheses. This property has important consequences:

1. **Consistency**: $\bot$ has no normal proof (it has no introduction rule, and the subformula property prevents "creative" uses of formulas). Therefore, intuitionistic propositional logic is consistent.
2. **Decidability**: The subformula property bounds the search space for proofs, leading to decision procedures for provability.
3. **Disjunction property**: If $\vdash \phi_1 \lor \phi_2$ is provable (without hypotheses), then either $\vdash \phi_1$ or $\vdash \phi_2$ is provable. This constructive property fails for classical logic.

Under Curry-Howard, these properties correspond to:
1. $\text{Void}$ is uninhabited (no closed term of type $\text{Void}$).
2. Type inhabitation is decidable for STLC.
3. If $\vdash t : T_1 + T_2$ then either $\vdash t_1 : T_1$ or $\vdash t_2 : T_2$ (after normalization, the term must be headed by $\text{inl}$ or $\text{inr}$).

---

## 3. The Correspondence: Implication Fragment

### 3.1 Implication and Function Types

The core of the Curry-Howard correspondence is the identification of implication with the function type:

$$\phi_1 \implies \phi_2 \quad \longleftrightarrow \quad T_1 \to T_2$$

Under this identification, the natural deduction rules for implication correspond exactly to the typing rules for lambda abstraction and application.

### 3.2 Side-by-Side Comparison

| Natural Deduction | Typing Rule |
|-------------------|-------------|
| $\frac{\phi \in \Delta}{\Delta \vdash \phi}\; (\text{Hyp})$ | $\frac{x : T \in \Gamma}{\Gamma \vdash x : T}\; \text{(T-Var)}$ |
| $\frac{\Delta, \phi_1 \vdash \phi_2}{\Delta \vdash \phi_1 \implies \phi_2}\; (\implies\text{-I})$ | $\frac{\Gamma, x : T_1 \vdash t : T_2}{\Gamma \vdash \lambda x:T_1.\,t : T_1 \to T_2}\; \text{(T-Abs)}$ |
| $\frac{\Delta \vdash \phi_1 \implies \phi_2 \quad \Delta \vdash \phi_1}{\Delta \vdash \phi_2}\; (\implies\text{-E})$ | $\frac{\Gamma \vdash t_1 : T_1 \to T_2 \quad \Gamma \vdash t_2 : T_1}{\Gamma \vdash t_1\;t_2 : T_2}\; \text{(T-App)}$ |

The correspondence is exact:
- Hypotheses $\Delta$ correspond to typing contexts $\Gamma$.
- An assumption $\phi \in \Delta$ corresponds to a variable lookup $x : T \in \Gamma$.
- Discharging an assumption ($\implies$-I) corresponds to lambda abstraction (binding a variable).
- Modus ponens ($\implies$-E) corresponds to function application.

### 3.3 Example: $A \implies (B \implies A)$ as $A \to (B \to A)$

**Logical proof** of $A \implies (B \implies A)$:

$$\frac{\frac{A \in (A, B)}{A, B \vdash A} \text{(Hyp)}}{A \vdash B \implies A} (\implies\text{-I})$$

$$\frac{A \vdash B \implies A}{\vdash A \implies (B \implies A)} (\implies\text{-I})$$

**Corresponding program** of type $A \to (B \to A)$:

$$\frac{\frac{a : A \in (a : A,\, b : B)}{a : A,\, b : B \vdash a : A} \text{(T-Var)}}{a : A \vdash \lambda b : B.\, a : B \to A} \text{(T-Abs)}$$

$$\frac{a : A \vdash \lambda b : B.\, a : B \to A}{\vdash \lambda a : A.\, \lambda b : B.\, a : A \to (B \to A)} \text{(T-Abs)}$$

The proof and the program have **identical structure**. The proof *is* the term $\lambda a : A.\, \lambda b : B.\, a$ (the K combinator in combinatory logic).

**What this means operationally.** The proof of $A \implies (B \implies A)$ says: "Given evidence for $A$, I can prove $B \implies A$ by ignoring $B$ and using the evidence for $A$." The program $\lambda a.\, \lambda b.\, a$ says: "Given an input $a$ of type $A$, return a function that ignores its input and returns $a$." These are the same thing.

### 3.4 Example: $(A \implies B) \implies (B \implies C) \implies (A \implies C)$

This proposition states that implication is transitive (or equivalently, that function composition exists).

**Proof/program**: $\lambda f : A \to B.\, \lambda g : B \to C.\, \lambda a : A.\, g\; (f\; a)$

$$\vdash \lambda f.\, \lambda g.\, \lambda a.\, g\; (f\; a) : (A \to B) \to (B \to C) \to (A \to C)$$

**Verification**: In context $\Gamma = f : A \to B,\; g : B \to C,\; a : A$:

1. $\Gamma \vdash f : A \to B$ (T-Var)
2. $\Gamma \vdash a : A$ (T-Var)
3. $\Gamma \vdash f\; a : B$ (T-App from 1, 2)
4. $\Gamma \vdash g : B \to C$ (T-Var)
5. $\Gamma \vdash g\; (f\; a) : C$ (T-App from 4, 3)

Three applications of T-Abs give the final type.

### 3.5 Example: An Unprovable Proposition

Consider $A \implies B$ (implication without hypothesis). Under the correspondence, this is the type $A \to B$ for arbitrary, unrelated types $A$ and $B$. There is no closed term of this type (we cannot construct a $B$ from an $A$ with no relationship between them). Correspondingly, $A \implies B$ is not a theorem of propositional logic.

Consider $(A \implies B) \implies A$. This is **Peirce's law** (or more precisely, a weakened form). It is not provable in intuitionistic logic. Correspondingly, the type $(A \to B) \to A$ is not inhabited in STLC. (In classical logic, Peirce's law $(((A \implies B) \implies A) \implies A)$ is provable; its computational content is the call-with-current-continuation operator.)

---

## 4. Proof Normalization and Computation

### 4.1 Detours in Proofs

In natural deduction, a **detour** (or **redex**) occurs when an introduction rule is immediately followed by the corresponding elimination rule. For implication:

$$\frac{\frac{\mathcal{D}_1}{\Delta, \phi_1 \vdash \phi_2}}{\frac{\Delta \vdash \phi_1 \implies \phi_2}{} (\implies\text{-I})} \quad \frac{\mathcal{D}_2}{\Delta \vdash \phi_1}$$

$$\frac{}{\Delta \vdash \phi_2} (\implies\text{-E})$$

This introduces the implication $\phi_1 \implies \phi_2$ and immediately eliminates it with modus ponens. The detour can be **reduced**: replace it with $\mathcal{D}_1[\phi_1 := \mathcal{D}_2]$ (the proof $\mathcal{D}_1$ with the assumption $\phi_1$ replaced by the proof $\mathcal{D}_2$).

### 4.2 Detour Reduction is Beta-Reduction

Under the Curry-Howard correspondence, the detour corresponds to:

$$(\lambda x : T_1.\, t)\; s \to [x \mapsto s]\, t$$

This is precisely **beta-reduction**. The logical operation of eliminating a detour in a proof is the same as the computational operation of applying a function to its argument.

| Proof Theory | Computation |
|-------------|------------|
| Detour (intro followed by elim) | Beta-redex $(\lambda x.\, t)\; s$ |
| Detour reduction | Beta-reduction |
| Normal proof (no detours) | Normal form (no redexes) |
| Proof normalization | Evaluation / normalization |
| Cut elimination (sequent calculus) | Beta-reduction (natural deduction) |

### 4.3 The Normalization Theorem, Logically

**Theorem 4.1 (Proof Normalization / Cut Elimination).** Every proof in intuitionistic propositional logic can be transformed into a normal (detour-free) proof.

Under the Curry-Howard correspondence, this is exactly the **strong normalization theorem** for STLC (Theorem 8.1 in Lecture 02b): every well-typed term reduces to a normal form.

The equivalence is not merely a coincidence. The proof of normalization via logical relations (Tait's method) can be read either as a proof-theoretic argument about proofs or as a type-theoretic argument about terms.

### 4.4 Eta-Expansion and Proof Identity

**Eta-expansion** in the lambda calculus ($t \leadsto \lambda x.\, t\; x$ when $x \notin \text{FV}(t)$) corresponds to a **local expansion** in proof theory: if we have a proof of $\phi_1 \implies \phi_2$, we can always expand it into a proof that assumes $\phi_1$, applies modus ponens with the original proof to get $\phi_2$, and then discharges the assumption.

The combination of beta-reduction and eta-expansion gives a notion of **proof identity**: two proofs are the same (up to beta-eta equivalence) when they have the same "computational content," even if they look syntactically different.

---

## 5. The Full Correspondence Table

We now extend the correspondence beyond implication to include all the connectives.

### 5.1 The Complete Dictionary

| Logic | Type Theory | Introduction Rule | Elimination Rule |
|-------|------------|-------------------|------------------|
| $\phi_1 \implies \phi_2$ | $T_1 \to T_2$ | Lambda abstraction | Application |
| $\phi_1 \land \phi_2$ | $T_1 \times T_2$ | Pair construction | Projection |
| $\phi_1 \lor \phi_2$ | $T_1 + T_2$ | Injection | Case analysis |
| $\top$ | $\text{Unit}$ | Unit value | (none) |
| $\bot$ | $\text{Void}$ | (none) | Absurd elimination |
| $\neg \phi$ | $T \to \text{Void}$ | (derived) | (derived) |
| Assumption $\phi$ | Variable $x : T$ | Hypothesis | Variable use |
| Proof of $\phi$ | Term $t : T$ | Derivation tree | Typing derivation |
| Provability of $\phi$ | Inhabitation of $T$ | Proof exists | Closed term exists |

### 5.2 Conjunction and Products

The correspondence between conjunction ($\land$) and product types ($\times$):

| Natural Deduction | Typing Rule |
|-------------------|-------------|
| $\frac{\Delta \vdash \phi_1 \quad \Delta \vdash \phi_2}{\Delta \vdash \phi_1 \land \phi_2}\; (\land\text{-I})$ | $\frac{\Gamma \vdash t_1 : T_1 \quad \Gamma \vdash t_2 : T_2}{\Gamma \vdash (t_1, t_2) : T_1 \times T_2}\; \text{(T-Pair)}$ |
| $\frac{\Delta \vdash \phi_1 \land \phi_2}{\Delta \vdash \phi_1}\; (\land\text{-E}_1)$ | $\frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash \text{fst}\; t : T_1}\; \text{(T-Fst)}$ |
| $\frac{\Delta \vdash \phi_1 \land \phi_2}{\Delta \vdash \phi_2}\; (\land\text{-E}_2)$ | $\frac{\Gamma \vdash t : T_1 \times T_2}{\Gamma \vdash \text{snd}\; t : T_2}\; \text{(T-Snd)}$ |

To prove $A \land B$, you must provide proofs of both $A$ and $B$ (a pair). To use a proof of $A \land B$, you extract the proof of $A$ (first projection) or $B$ (second projection).

**Detour reduction**: $\text{fst}\; (t_1, t_2) \to t_1$ and $\text{snd}\; (t_1, t_2) \to t_2$. These are the beta-reduction rules for pairs.

**Example**: A proof of $A \land B \implies B \land A$ (commutativity of conjunction) is the program $\lambda p : A \times B.\, (\text{snd}\; p, \text{fst}\; p)$ of type $A \times B \to B \times A$.

### 5.3 Disjunction and Sums

The correspondence between disjunction ($\lor$) and sum types ($+$):

| Natural Deduction | Typing Rule |
|-------------------|-------------|
| $\frac{\Delta \vdash \phi_1}{\Delta \vdash \phi_1 \lor \phi_2}\; (\lor\text{-I}_1)$ | $\frac{\Gamma \vdash t : T_1}{\Gamma \vdash \text{inl}\;t : T_1 + T_2}\; \text{(T-Inl)}$ |
| $\frac{\Delta \vdash \phi_2}{\Delta \vdash \phi_1 \lor \phi_2}\; (\lor\text{-I}_2)$ | $\frac{\Gamma \vdash t : T_2}{\Gamma \vdash \text{inr}\;t : T_1 + T_2}\; \text{(T-Inr)}$ |
| $\frac{\Delta \vdash \phi_1 \lor \phi_2 \quad \Delta, \phi_1 \vdash \psi \quad \Delta, \phi_2 \vdash \psi}{\Delta \vdash \psi}\; (\lor\text{-E})$ | $\frac{\Gamma \vdash t : T_1 + T_2 \quad \Gamma, x:T_1 \vdash s_1 : S \quad \Gamma, y:T_2 \vdash s_2 : S}{\Gamma \vdash \text{case}\;t\;\text{of}\;\text{inl}\;x \Rightarrow s_1 \mid \text{inr}\;y \Rightarrow s_2 : S}\; \text{(T-Case)}$ |

To prove $A \lor B$, you must provide a proof of $A$ (left injection) or a proof of $B$ (right injection). To use a proof of $A \lor B$, you must handle both cases (case analysis).

**Detour reduction**:

$$\text{case}\; (\text{inl}\; v)\; \text{of}\; \text{inl}\; x \Rightarrow s_1 \mid \text{inr}\; y \Rightarrow s_2 \to [x \mapsto v]\, s_1$$

$$\text{case}\; (\text{inr}\; v)\; \text{of}\; \text{inl}\; x \Rightarrow s_1 \mid \text{inr}\; y \Rightarrow s_2 \to [y \mapsto v]\, s_2$$

**Example**: A proof of $A \lor B \implies B \lor A$ (commutativity of disjunction) is:

$$\lambda p : A + B.\, \text{case}\; p\; \text{of}\; \text{inl}\; a \Rightarrow \text{inr}\; a \mid \text{inr}\; b \Rightarrow \text{inl}\; b$$

of type $A + B \to B + A$.

### 5.4 Truth and Unit

The correspondence between truth ($\top$) and the Unit type:

| Natural Deduction | Typing Rule |
|-------------------|-------------|
| $\frac{}{\Delta \vdash \top}\; (\top\text{-I})$ | $\frac{}{\Gamma \vdash \text{unit} : \text{Unit}}\; \text{(T-Unit)}$ |

Truth is trivially provable; the Unit type has exactly one inhabitant. There is no elimination rule for $\top$ and no interesting eliminator for Unit.

### 5.5 Falsity and Void

The correspondence between falsity ($\bot$) and the Void type:

| Natural Deduction | Typing Rule |
|-------------------|-------------|
| $\frac{\Delta \vdash \bot}{\Delta \vdash \phi}\; (\bot\text{-E})$ | $\frac{\Gamma \vdash t : \text{Void}}{\Gamma \vdash \text{absurd}\;t : T}\; \text{(T-Absurd)}$ |

Falsity has no introduction rule; the Void type has no constructors (no values). From a proof of falsity, anything follows (ex falso quodlibet); from a term of type Void, we can produce a term of any type (vacuously, since no such term exists in normal form).

### 5.6 Negation

Negation is not a primitive connective but is defined:

$$\neg \phi \equiv \phi \implies \bot$$

Correspondingly, the "negation" of a type is:

$$\neg T \equiv T \to \text{Void}$$

A proof of $\neg A$ is a function that takes any proof of $A$ and produces a contradiction (an element of Void). Since Void has no inhabitants, such a function can only exist if $A$ is uninhabitable (unprovable).

**Example**: Modus tollens. A proof of $(A \implies B) \implies \neg B \implies \neg A$ is:

$$\lambda f : A \to B.\, \lambda nb : B \to \text{Void}.\, \lambda a : A.\, nb\; (f\; a)$$

of type $(A \to B) \to (B \to \text{Void}) \to (A \to \text{Void})$.

### 5.7 The Full Correspondence at a Glance

Putting together all the correspondences, we can construct the following detailed dictionary:

| Concept in Logic | Concept in Type Theory | Concept in Category Theory |
|-----------------|----------------------|---------------------------|
| Proposition $\phi$ | Type $T$ | Object $A$ |
| Proof of $\phi$ | Term $t : T$ | Morphism $1 \to A$ (global element) |
| Hypothesis $\phi \in \Delta$ | Variable $x : T \in \Gamma$ | Identity morphism / composition |
| Implication $\phi \implies \psi$ | Function type $T \to S$ | Exponential $S^T$ |
| Modus ponens | Function application | Evaluation morphism |
| Hypothesis discharge | Lambda abstraction | Currying |
| Conjunction $\phi \land \psi$ | Product type $T \times S$ | Categorical product $T \times S$ |
| Proof of $\phi \land \psi$ | Pair $(t, s)$ | Pairing morphism $\langle f, g \rangle$ |
| Left conjunct | First projection $\text{fst}$ | Projection $\pi_1$ |
| Right conjunct | Second projection $\text{snd}$ | Projection $\pi_2$ |
| Disjunction $\phi \lor \psi$ | Sum type $T + S$ | Coproduct $T + S$ |
| Left disjunct proof | Left injection $\text{inl}$ | Injection $\iota_1$ |
| Right disjunct proof | Right injection $\text{inr}$ | Injection $\iota_2$ |
| Proof by cases | Case analysis | Copairing $[f, g]$ |
| Truth $\top$ | Unit type | Terminal object $1$ |
| Falsity $\bot$ | Void type | Initial object $0$ |
| Ex falso quodlibet | $\text{absurd}$ | Unique morphism $0 \to A$ |
| Negation $\neg \phi$ | $T \to \text{Void}$ | Exponential $0^T$ |
| Proof normalization | Beta-reduction | Composition simplification |
| Normal proof | Normal form | Canonical morphism |
| Cut in sequent calculus | Beta-redex | Composition of morphisms |
| Cut elimination | Beta-reduction | Functorial composition |
| Consistency | Type Void uninhabited | No morphism $1 \to 0$ |
| Provability | Type inhabitation | Existence of global element |

### 5.8 Negation Under the Correspondence

Negation deserves special attention. Under the correspondence:

$$\neg A \equiv A \to \text{Void}$$

A proof of $\neg A$ is a function that takes any proof of $A$ and produces a proof of $\bot$ (contradiction). This function can exist only if $A$ is unprovable --- if $A$ had a proof $a$, then applying the negation proof to $a$ would produce an element of $\text{Void}$, contradicting the consistency of the logic.

Key properties of negation under the correspondence:

1. $\neg\neg A$ is not the same as $A$. Double negation introduction $A \implies \neg\neg A$ is provable: $\lambda a : A.\, \lambda f : (A \to \text{Void}).\, f\; a$. But double negation elimination $\neg\neg A \implies A$ is not.

2. $\neg(A \land B)$ does not imply $\neg A \lor \neg B$ (intuitionistically). De Morgan's law in this form requires deciding which of $A$ or $B$ fails, which is non-constructive.

3. $\neg A \lor \neg B$ does imply $\neg(A \land B)$ (intuitionistically). This direction is constructive: $\lambda s : (\neg A + \neg B).\, \lambda p : A \times B.\, \text{case}\; s\; \text{of}\; \text{inl}\; f \Rightarrow f\; (\text{fst}\; p) \mid \text{inr}\; g \Rightarrow g\; (\text{snd}\; p)$.

---

## 6. The BHK Interpretation

### 6.1 Brouwer-Heyting-Kolmogorov

The Curry-Howard correspondence can be understood through the **BHK interpretation** (Brouwer-Heyting-Kolmogorov), which gives a constructive meaning to logical connectives:

- A proof of $\phi_1 \implies \phi_2$ is a **method** (function, algorithm) that transforms any proof of $\phi_1$ into a proof of $\phi_2$.
- A proof of $\phi_1 \land \phi_2$ is a **pair** $(p_1, p_2)$ where $p_1$ is a proof of $\phi_1$ and $p_2$ is a proof of $\phi_2$.
- A proof of $\phi_1 \lor \phi_2$ is a **tagged value**: either a proof of $\phi_1$ (tagged "left") or a proof of $\phi_2$ (tagged "right").
- A proof of $\top$ is trivial (the empty construction).
- There is no proof of $\bot$.
- A proof of $\neg \phi$ is a method that converts any proof of $\phi$ into a proof of $\bot$ (i.e., shows that $\phi$ leads to contradiction).

The BHK interpretation is essentially a **semantic** version of the Curry-Howard correspondence: it describes what proofs *mean* in terms of constructions, which are precisely the terms of the lambda calculus.

### 6.2 Why Not Classical Logic?

Classical logic adds the law of excluded middle: $\phi \lor \neg \phi$ for all $\phi$. Under the BHK interpretation, this would require a method that, for every proposition $\phi$, either produces a proof of $\phi$ or a proof that $\phi$ is unprovable. No such universal method exists constructively.

If we add LEM to our type system, the computational interpretation breaks down. More precisely:

1. **Griffin's observation** (1990): The classical tautology $((\phi \implies \psi) \implies \phi) \implies \phi$ (Peirce's law) corresponds to the type of the **call-with-current-continuation** (call/cc) operator. Adding call/cc to a language breaks referential transparency and makes evaluation order-dependent.

2. **Double-negation translation**: Every classical proof can be translated into an intuitionistic proof by double-negation translation ($\phi$ becomes $\neg\neg\phi$). Under Curry-Howard, this corresponds to a **CPS transformation** (continuation-passing style). So classical proofs have computational content, but it is more complex and non-canonical.

   Formally, the Godel-Gentzen double-negation translation maps a classical formula $\phi$ to an intuitionistic formula $\phi^N$ defined inductively:
   - $P^N = \neg\neg P$ (for atomic propositions)
   - $(\phi \implies \psi)^N = \phi^N \implies \psi^N$
   - $(\phi \land \psi)^N = \phi^N \land \psi^N$
   - $(\phi \lor \psi)^N = \neg\neg(\phi^N \lor \psi^N)$
   - $\bot^N = \bot$

   Under Curry-Howard, this translation corresponds to a CPS transformation on programs. A program of type $A$ becomes a program of type $(A \to R) \to R$ (for some fixed result type $R$), which takes a continuation and feeds the result to it.

3. **Constructive content**: In intuitionistic logic, $\exists x.\, \phi(x)$ implies that we can compute a specific witness $x$ satisfying $\phi$. In classical logic, existence proofs can be non-constructive (proof by contradiction). The Curry-Howard correspondence values the constructive content.

4. **Kripke semantics**: Intuitionistic logic has a natural semantics using **Kripke models** (possible worlds semantics), where truth is relative to a state of knowledge (a "world"), and knowledge only grows over time. A proposition is true at a world if it is true at that world and all future worlds. Under this semantics, LEM fails because at any given world, we might not yet know whether $A$ is true or false.

### 6.3 Kripke Models and Constructive Validity

A **Kripke model** for intuitionistic propositional logic is a triple $(W, \leq, \Vdash)$ where:
- $W$ is a set of "worlds" (states of knowledge).
- $\leq$ is a partial order on $W$ (the "accessibility" relation, representing possible increases in knowledge).
- $\Vdash$ is a "forcing" relation: $w \Vdash P$ means "at world $w$, proposition $P$ is known to be true."

The forcing relation must be **monotone**: if $w \Vdash P$ and $w \leq w'$, then $w' \Vdash P$ (knowledge is never lost).

The connectives are interpreted as:
- $w \Vdash \phi \implies \psi$ iff for all $w' \geq w$, if $w' \Vdash \phi$ then $w' \Vdash \psi$.
- $w \Vdash \phi \land \psi$ iff $w \Vdash \phi$ and $w \Vdash \psi$.
- $w \Vdash \phi \lor \psi$ iff $w \Vdash \phi$ or $w \Vdash \psi$.
- $w \Vdash \top$ always.
- $w \Vdash \bot$ never.

**Why LEM fails.** Consider a two-world model: $w_0 \leq w_1$, where $w_0 \not\Vdash P$ and $w_1 \Vdash P$. At $w_0$:
- $w_0 \not\Vdash P$ (we don't know $P$ at $w_0$).
- $w_0 \not\Vdash \neg P$ (because there exists $w_1 \geq w_0$ with $w_1 \Vdash P$, so $P$ is not refutable).
- Therefore $w_0 \not\Vdash P \lor \neg P$ (LEM fails).

Under the Curry-Howard correspondence, this Kripke countermodel tells us that the type $P + (P \to \text{Void})$ is uninhabited: we cannot construct a term of this type without additional information about $P$.

**Completeness.** Kripke (1965) proved that intuitionistic propositional logic is **complete** with respect to Kripke models: a formula is intuitionistically provable if and only if it is valid in all Kripke models. Under Curry-Howard, this means that a type is inhabited (in STLC with sums) if and only if the corresponding formula is valid in all Kripke models.

---

## 7. Extended Examples

### 7.1 Currying: $(A \land B \implies C) \iff (A \implies B \implies C)$

**Forward direction**: A proof of $(A \land B \implies C) \implies (A \implies B \implies C)$.

Program: $\lambda f : A \times B \to C.\, \lambda a : A.\, \lambda b : B.\, f\; (a, b)$

Type: $(A \times B \to C) \to A \to B \to C$

This is the **currying** isomorphism, named after Haskell Curry.

**Reverse direction**: A proof of $(A \implies B \implies C) \implies (A \land B \implies C)$.

Program: $\lambda g : A \to B \to C.\, \lambda p : A \times B.\, g\; (\text{fst}\; p)\; (\text{snd}\; p)$

Type: $(A \to B \to C) \to A \times B \to C$

This is **uncurrying**.

### 7.2 Distributivity: $A \land (B \lor C) \implies (A \land B) \lor (A \land C)$

Program:

$$\lambda p : A \times (B + C).\, \text{case}\; (\text{snd}\; p)\; \text{of}$$

$$\quad \text{inl}\; b \Rightarrow \text{inl}\; (\text{fst}\; p,\; b)$$

$$\quad \mid\; \text{inr}\; c \Rightarrow \text{inr}\; (\text{fst}\; p,\; c)$$

Type: $A \times (B + C) \to (A \times B) + (A \times C)$

### 7.3 Ex Falso Quodlibet: $\bot \implies A$

Program: $\lambda x : \text{Void}.\, \text{absurd}\; x$

Type: $\text{Void} \to A$

This function can be defined for any $A$ because it will never be called (Void has no inhabitants). The promise is vacuously fulfilled.

### 7.4 Modus Ponens as Function Application

The logical rule of modus ponens, $(A \implies B) \land A \implies B$, corresponds to:

Program: $\lambda p : (A \to B) \times A.\, (\text{fst}\; p)\; (\text{snd}\; p)$

Type: $(A \to B) \times A \to B$

### 7.5 The S Combinator: $(A \implies B \implies C) \implies (A \implies B) \implies (A \implies C)$

This is one of the most important tautologies, corresponding to the S combinator of combinatory logic:

Program:

$$\lambda f : A \to B \to C.\, \lambda g : A \to B.\, \lambda a : A.\, f\; a\; (g\; a)$$

Type: $(A \to B \to C) \to (A \to B) \to A \to C$

Logically: "If from $A$ I can derive $B \implies C$, and from $A$ I can derive $B$, then from $A$ I can derive $C$ (by applying the first derivation to the result of the second)."

Together with the K combinator ($A \to B \to A$, i.e., $\lambda a.\, \lambda b.\, a$), the S combinator generates all terms of the simply typed lambda calculus (this is the basis of combinatory logic). Under Curry-Howard, S and K generate all proofs of intuitionistic implicational logic.

### 7.6 An Unprovable Classical Tautology

Consider the classical tautology $(A \implies B) \lor (B \implies A)$. This corresponds to the type $(A \to B) + (B \to A)$.

This type is **not inhabited** in STLC (for arbitrary types $A$ and $B$). To construct a value of this type, we would need either a function $A \to B$ or a function $B \to A$, but with no relationship between $A$ and $B$, neither can be constructed.

This demonstrates that the correspondence is with **intuitionistic** logic: classical tautologies that are not intuitionistic theorems correspond to uninhabited types.

### 7.7 Associativity of Conjunction: $(A \land B) \land C \iff A \land (B \land C)$

Forward:

$$\lambda p : (A \times B) \times C.\, (\text{fst}\; (\text{fst}\; p),\; (\text{snd}\; (\text{fst}\; p),\; \text{snd}\; p))$$

Type: $(A \times B) \times C \to A \times (B \times C)$

Backward:

$$\lambda p : A \times (B \times C).\, ((\text{fst}\; p,\; \text{fst}\; (\text{snd}\; p)),\; \text{snd}\; (\text{snd}\; p))$$

Type: $A \times (B \times C) \to (A \times B) \times C$

These witnesses demonstrate the associativity of products (conjunction). The terms are somewhat tedious but structurally straightforward: they simply repackage the components.

### 7.8 Contraposition: $(A \implies B) \implies (\neg B \implies \neg A)$

Program: $\lambda f : A \to B.\, \lambda nb : (B \to \text{Void}).\, \lambda a : A.\, nb\; (f\; a)$

Type: $(A \to B) \to (B \to \text{Void}) \to (A \to \text{Void})$

Note that the converse, $(\neg B \implies \neg A) \implies (A \implies B)$, is not intuitionistically provable (it is equivalent to double negation elimination for $B$, which is a classical principle). Correspondingly, the type $((B \to \text{Void}) \to (A \to \text{Void})) \to (A \to B)$ is not inhabited.

---

## 8. Deeper Aspects of the Correspondence

### 8.1 The Isomorphism is Structure-Preserving

It is important to emphasize that the Curry-Howard correspondence is not merely a superficial analogy. It is a **structure-preserving bijection** between formal systems:

1. **Proofs correspond to terms**: There is a bijection between proofs of $\phi$ in natural deduction and well-typed terms of the corresponding type $T$. Two proofs are identical if and only if the corresponding terms are identical (up to alpha-equivalence).

2. **Proof transformations correspond to term reductions**: The detour-reduction relation on proofs corresponds exactly to the beta-reduction relation on terms. Each detour-elimination step in a proof corresponds to one or more beta-reduction steps in the corresponding term.

3. **Proof identity corresponds to program identity**: Two proofs are considered identical (up to normalization) if and only if the corresponding programs are beta-eta equivalent. This gives a precise notion of "same proof" that matches the intuitive notion of "same algorithm."

4. **Sub-proofs correspond to sub-terms**: The tree structure of a natural deduction proof matches the tree structure of the corresponding term. Introduction rules correspond to constructors, elimination rules correspond to destructors, and the premises-conclusion relationship corresponds to the subterm relationship.

### 8.2 Category-Theoretic View

The Curry-Howard correspondence has a natural home in category theory:

| Logic | Type Theory | Category Theory |
|-------|------------|----------------|
| Proposition | Type/Object | Object |
| Proof/Term | Morphism | Morphism |
| $\implies$ / $\to$ | Exponential $B^A$ | Internal hom |
| $\land$ / $\times$ | Product $A \times B$ | Categorical product |
| $\lor$ / $+$ | Coproduct $A + B$ | Categorical coproduct |
| $\top$ / Unit | Terminal object $1$ | Terminal object |
| $\bot$ / Void | Initial object $0$ | Initial object |

The simply typed lambda calculus with products corresponds to a **cartesian closed category** (CCC). This three-way correspondence (logic / type theory / category theory) is sometimes called the **Curry-Howard-Lambek correspondence** (after Joachim Lambek, who established the categorical side in the 1970s and 1980s).

**Definition 8.1 (Cartesian Closed Category).** A category $\mathcal{C}$ is **cartesian closed** if it has:
1. A terminal object $1$ (corresponding to Unit / $\top$).
2. Binary products $A \times B$ for all objects $A, B$ (corresponding to products / $\land$).
3. Exponential objects $B^A$ for all objects $A, B$ (corresponding to function types / $\implies$).

If $\mathcal{C}$ additionally has:
4. An initial object $0$ (corresponding to Void / $\bot$).
5. Binary coproducts $A + B$ (corresponding to sums / $\lor$).

then $\mathcal{C}$ is a **bicartesian closed category**, corresponding to the full simply typed lambda calculus with products, sums, unit, and void.

The free CCC generated by a set of base types is equivalent (as a category) to the STLC with those base types, where objects are types and morphisms are equivalence classes of terms (under beta-eta equivalence). This is Lambek's theorem, providing the categorical semantics of STLC.

### 8.3 The Yoneda Perspective

From the category-theoretic perspective, the type isomorphisms in Section 5 (e.g., $A \times (B + C) \cong (A \times B) + (A \times C)$) are instances of general categorical identities. They hold in any bicartesian closed category, not just in the category of types and terms.

This universality explains why the same algebraic laws hold both for types (under the Curry-Howard correspondence) and for sets (under the standard interpretation of logical connectives as set operations). Types, propositions, and sets are all "the same thing" at the appropriate level of abstraction.

### 8.2 Proof Irrelevance vs. Proof Relevance

An important distinction:

- In **proof-irrelevant** systems, all proofs of the same proposition are considered equal. Only the existence of a proof matters, not its structure. Classical logic is typically proof-irrelevant.

- In **proof-relevant** systems (like STLC and its extensions), different proofs of the same proposition are different programs, and they may have different computational behavior. For example, there are two distinct terms of type $A \times B \to A \times B$: the identity $\lambda p.\, p$ and the swap-and-swap-back $\lambda p.\, (\text{fst}\; (\text{snd}\; p, \text{fst}\; p), \text{snd}\; (\text{snd}\; p, \text{fst}\; p))$. Both prove the same proposition, but they compute differently.

The Curry-Howard correspondence is most natural in the proof-relevant setting, where the structure of proofs matters.

### 8.3 The Curry-Howard Correspondence as a Research Program

The correspondence is not a single theorem but an ongoing research program. Every new type system or logic reveals a new instance:

- Girard's **System F** (1972) corresponds to **second-order intuitionistic logic** (Module 06).
- Martin-Lof's **dependent type theory** (1972/1984) corresponds to **intuitionistic predicate logic** (Module 08).
- Girard's **linear logic** (1987) corresponds to **linear type systems** (Module 09).
- **Homotopy type theory** (Voevodsky, Awodey, Warren, ~2006) reveals connections between type theory and homotopy theory/higher category theory (Module 10).
- **Cubical type theory** (Cohen et al., 2018) gives computational content to univalence (Module 10).

Each instance deepens our understanding of the relationship between logic and computation.

### 8.4 Limitations of the Curry-Howard Correspondence

While powerful, the Curry-Howard correspondence has limitations:

1. **Computational content of classical proofs.** Classical proofs via LEM or proof by contradiction do not have obvious computational content in the lambda calculus. Griffin's work (1990) showed they correspond to control operators (continuations), but these operators are non-deterministic (evaluation-order dependent), side-effecting, and break referential transparency. The computational interpretation of classical logic remains an active research area.

2. **Proof irrelevance.** In mathematical practice, we often do not care which proof of a proposition is used --- only that a proof exists. But under Curry-Howard, different proofs correspond to different programs with different behaviors. Reconciling proof irrelevance with computational relevance is a challenge addressed by propositions-as-some-types approaches (e.g., Coq's Prop vs. Type distinction, or homotopy type theory's truncation).

3. **Impredicativity.** Some logical systems (e.g., the calculus of constructions, which corresponds to a very expressive type system) are impredicative: types can quantify over all types, including themselves. This creates challenges for set-theoretic models and leads to paradoxes if not handled carefully. Girard's paradox (a type-theoretic version of the Burali-Forti paradox) shows that impredicativity in the wrong combination leads to inconsistency.

4. **Effects and non-termination.** Programming languages with side effects (mutation, IO, exceptions, non-termination) do not correspond cleanly to logic under the Curry-Howard correspondence. A program of type $A$ that loops forever is not a valid proof of $A$. This is why proof assistants based on the correspondence (Coq, Agda) require totality checking.

---

## 9. Historical Context

### 9.1 Curry (1934-1958)

Haskell Brooks Curry observed in the 1930s that the types of combinators in combinatory logic correspond to axiom schemas of propositional logic:

- The **K combinator** $K : A \to B \to A$ corresponds to the axiom $A \implies (B \implies A)$.
- The **S combinator** $S : (A \to B \to C) \to (A \to B) \to A \to C$ corresponds to the axiom $(A \implies B \implies C) \implies (A \implies B) \implies (A \implies C)$.

Together with modus ponens (function application), K and S generate all theorems of the implication fragment of intuitionistic logic. Curry published this observation in *Combinatory Logic* (1958, with Robert Feys).

### 9.2 Howard (1969/1980)

William Alvin Howard extended Curry's observation from combinatory logic to the **lambda calculus** and from the Hilbert-style axiom system to **natural deduction**. In a manuscript circulated in 1969 and published in 1980, Howard showed:

1. The correspondence extends to conjunction ($\land$ / $\times$) and disjunction ($\lor$ / $+$).
2. Proof normalization in natural deduction corresponds exactly to beta-reduction in the lambda calculus.
3. The correspondence works for predicates and quantifiers (foreshadowing dependent types).

Howard's key insight was that the correspondence is not just about provability (which propositions are provable / which types are inhabited) but about **proof structure** (how proofs are built / how programs are written).

### 9.3 De Bruijn (1968-1970s)

Nicolaas Govert de Bruijn independently developed a closely related system, **Automath**, starting in 1968. Automath was one of the first **proof checkers**: a formal language in which mathematical proofs could be written and verified by computer. De Bruijn's contribution was to recognize that type checking (verifying that a term has a given type) is the same as proof checking (verifying that a proof is valid).

### 9.4 Later Developments

- **Martin-Lof** (1972, 1984): Extended the correspondence to dependent types and intuitionistic type theory. This is the most consequential extension: propositions become types that can depend on terms, and proofs become programs that compute with data. Martin-Lof type theory is the foundation of proof assistants like Agda and (via the Calculus of Inductive Constructions) Coq.

- **Girard** (1972): System F (the polymorphic lambda calculus) and the correspondence with second-order intuitionistic logic. This gave a type-theoretic account of parametric polymorphism and provided the first proof of strong normalization for a polymorphic system.

- **Griffin** (1990): Showed that the classical tautology (Peirce's law) corresponds to the type of the call-with-current-continuation (call/cc) control operator. This established that classical logic has computational content, but it involves control effects rather than pure computation.

- **Wadler** (2003, 2015): Popularized the correspondence in the programming languages community with his article "Propositions as Types," which traced the historical development and argued for the correspondence as a deep structural fact about mathematics and computation.

- **Voevodsky** (2006-2013): Proposed the univalence axiom, connecting type theory to homotopy theory. Under the resulting "Homotopy Type Theory" (HoTT), types are interpreted as spaces, terms as points, and equality proofs as paths between points. This represents the most dramatic extension of the Curry-Howard correspondence to date.

---

## 10. Worked Exercises

### Exercise 10.1

Give a program (proof term) of type $(A \to B \to C) \to (A \times B) \to C$.

**Solution.** This is the "uncurry" function:

$$\lambda f : A \to B \to C.\, \lambda p : A \times B.\, f\; (\text{fst}\; p)\; (\text{snd}\; p)$$

Logically, this is a proof that $(A \implies B \implies C) \implies (A \land B \implies C)$: if we can prove $C$ from $A$ and $B$ separately, then we can prove $C$ from $A \land B$ by extracting each conjunct.

### Exercise 10.2

Show that the type $(A + B) \to C$ is isomorphic to $(A \to C) \times (B \to C)$.

**Solution.** We construct functions in both directions:

**Forward** ($\phi : ((A + B) \to C) \to (A \to C) \times (B \to C)$):

$$\phi = \lambda f : (A + B) \to C.\, (\lambda a : A.\, f\; (\text{inl}\; a),\; \lambda b : B.\, f\; (\text{inr}\; b))$$

**Backward** ($\psi : (A \to C) \times (B \to C) \to (A + B) \to C$):

$$\psi = \lambda p : (A \to C) \times (B \to C).\, \lambda s : A + B.\, \text{case}\; s\; \text{of}\; \text{inl}\; a \Rightarrow (\text{fst}\; p)\; a \mid \text{inr}\; b \Rightarrow (\text{snd}\; p)\; b$$

One can verify that $\psi \circ \phi$ and $\phi \circ \psi$ are beta-eta equal to the identity.

Logically, this is the equivalence $(A \lor B \implies C) \iff (A \implies C) \land (B \implies C)$: a proof by cases is the same as having a proof for each case.

### Exercise 10.3

Explain why the type $\text{Void} \to A$ is inhabited for every type $A$, and why $A \to \text{Void}$ is inhabited only when $A$ is itself uninhabited.

**Solution.**

$\text{Void} \to A$: The function $\lambda x : \text{Void}.\, \text{absurd}\; x$ inhabits this type. It never needs to produce an $A$ because it will never be called (there is no value of type $\text{Void}$ to pass as argument). Logically: $\bot \implies A$ is always true (ex falso quodlibet).

$A \to \text{Void}$: A function of this type takes an $a : A$ and must produce a value of type $\text{Void}$. Since $\text{Void}$ has no values, the function can only exist if $A$ also has no values (i.e., $A$ is uninhabited). The function body must be a term that "uses up" the argument in a contradictory way, which is only possible if $A$ itself is empty. Logically: $A \implies \bot$ (i.e., $\neg A$) is provable only when $A$ is refutable.

### Exercise 10.4

Show that double negation elimination $\neg\neg A \implies A$, i.e., $((A \to \text{Void}) \to \text{Void}) \to A$, is not inhabited in STLC.

**Solution (informal argument).** Suppose we had a closed term $t : ((A \to \text{Void}) \to \text{Void}) \to A$ for an arbitrary uninhabited type $A$ (e.g., take $A = \text{Void}$). Then $t$ applied to the identity function $\lambda f : \text{Void} \to \text{Void}.\, f$ (but wait, the argument type is $(\text{Void} \to \text{Void}) \to \text{Void}$, not $\text{Void} \to \text{Void}$).

More carefully: specialize to $A = \text{Void}$. Then we need a term of type $((\text{Void} \to \text{Void}) \to \text{Void}) \to \text{Void}$. The input is a function $g : (\text{Void} \to \text{Void}) \to \text{Void}$. We can construct $\text{id}_\text{Void} = \lambda x : \text{Void}.\, x : \text{Void} \to \text{Void}$. Then $g\; \text{id}_\text{Void} : \text{Void}$. So we can define $\lambda g.\, g\; (\lambda x.\, x) : ((\text{Void} \to \text{Void}) \to \text{Void}) \to \text{Void}$.

This specific instance *is* inhabited. The uninhabitability of double negation elimination manifests for types with nontrivial structure. The key formal argument is: $\neg\neg A \implies A$ is not a theorem of intuitionistic propositional logic (it fails in Kripke models with more than one world). By the completeness of the Curry-Howard correspondence (every intuitionistic theorem corresponds to an inhabited type and vice versa), the type $((A \to \text{Void}) \to \text{Void}) \to A$ is not inhabited for arbitrary $A$.

### Exercise 10.5

Give a proof term for the proposition $(A \implies B) \implies (B \implies C) \implies (A \implies C)$ (transitivity of implication, i.e., function composition).

**Solution.**

$$\lambda f : A \to B.\, \lambda g : B \to C.\, \lambda a : A.\, g\; (f\; a)$$

Type: $(A \to B) \to (B \to C) \to (A \to C)$

This is function composition: given $f : A \to B$ and $g : B \to C$, return $g \circ f : A \to C$. The proof reads: "If I can get from $A$ to $B$ and from $B$ to $C$, I can get from $A$ to $C$ by going through $B$."

### Exercise 10.6

Under the Curry-Howard correspondence, what does the Weakening Lemma (if $\Gamma \vdash t : T$ and $x \notin \text{dom}(\Gamma)$, then $\Gamma, x : S \vdash t : T$) correspond to logically?

**Solution.** Weakening corresponds to the logical principle of **monotonicity of entailment**: if $\Delta \vdash \phi$ (the proposition $\phi$ follows from hypotheses $\Delta$), then $\Delta, \psi \vdash \phi$ (adding a hypothesis $\psi$ does not invalidate the derivation). This is a structural rule of logic.

In programming terms: if a program works without using variable $x$, then it still works if $x$ is added to the environment. Unused variables do not cause errors.

Interestingly, this principle fails in **linear logic** (Module 09), where every hypothesis must be used exactly once. The linear version of the Curry-Howard correspondence (Wadler, 1990) leads to type systems that track resource usage, preventing the "waste" of unused variables.

### Exercise 10.7

Construct a term of type $(A \to C) \to (B \to C) \to (A + B \to C)$.

**Solution.**

$$\lambda f : A \to C.\, \lambda g : B \to C.\, \lambda s : A + B.\, \text{case}\; s\; \text{of}\; \text{inl}\; a \Rightarrow f\; a \mid \text{inr}\; b \Rightarrow g\; b$$

Logically: if I can prove $C$ from $A$ and I can prove $C$ from $B$, then I can prove $C$ from $A \lor B$ by case analysis.

This is the **universal property of the coproduct** in category theory: a morphism out of a coproduct $A + B$ is uniquely determined by a morphism from $A$ and a morphism from $B$.

### Exercise 10.8

Show that double negation introduction $A \implies \neg\neg A$ is intuitionistically provable by giving a proof term.

**Solution.**

$$\lambda a : A.\, \lambda f : (A \to \text{Void}).\, f\; a$$

Type: $A \to (A \to \text{Void}) \to \text{Void}$, which is $A \to \neg\neg A$ (recalling $\neg B = B \to \text{Void}$, so $\neg\neg A = (A \to \text{Void}) \to \text{Void}$).

Logically: "Given a proof $a$ of $A$ and a refutation $f$ of $A$ (a function converting proofs of $A$ into contradictions), we derive a contradiction by applying $f$ to $a$."

### Exercise 10.9

Show that $\neg(A \land B) \implies \neg A \lor \neg B$ is NOT intuitionistically provable by describing an informal Kripke countermodel.

**Solution.** Consider a Kripke model with three worlds: $w_0 \leq w_1$ and $w_0 \leq w_2$ (a branching structure). In $w_1$, $A$ is true but $B$ is false. In $w_2$, $B$ is true but $A$ is false. In $w_0$, neither $A$ nor $B$ is determined.

At $w_0$: $A \land B$ is false (it fails in both $w_1$ and $w_2$), so $\neg(A \land B)$ is true at $w_0$. However:
- $\neg A$ is false at $w_0$ (because $A$ is true at $w_1 \geq w_0$).
- $\neg B$ is false at $w_0$ (because $B$ is true at $w_2 \geq w_0$).
- Therefore $\neg A \lor \neg B$ is false at $w_0$.

So $\neg(A \land B)$ is true but $\neg A \lor \neg B$ is false at $w_0$, refuting the implication.

Under the Curry-Howard correspondence: the type $((A \times B) \to \text{Void}) \to (A \to \text{Void}) + (B \to \text{Void})$ is uninhabited. Intuitively, knowing that $A$ and $B$ cannot both hold does not tell us **which** one fails, and we cannot decide this without additional information.

### Exercise 10.10

Prove that the type $(A + B) \to \neg(\neg A \times \neg B)$ is inhabited.

**Solution.** We need a term of type $(A + B) \to ((A \to \text{Void}) \times (B \to \text{Void})) \to \text{Void}$.

$$\lambda s : A + B.\, \lambda p : (A \to \text{Void}) \times (B \to \text{Void}).\, \text{case}\; s\; \text{of}\; \text{inl}\; a \Rightarrow (\text{fst}\; p)\; a \mid \text{inr}\; b \Rightarrow (\text{snd}\; p)\; b$$

Logically: "If we know $A \lor B$, and we have refutations of both $A$ and $B$, we reach a contradiction --- case-analyze the disjunction and apply the appropriate refutation."

---

## Summary

The **Curry-Howard correspondence** reveals that logic and type theory are two views of the same mathematical structure:

- **Propositions are types**: The logical connective $\implies$ is the function type $\to$; $\land$ is the product $\times$; $\lor$ is the sum $+$; $\top$ is Unit; $\bot$ is Void.
- **Proofs are programs**: A proof of a proposition is a well-typed term inhabiting the corresponding type. The structure of the proof (introduction and elimination rules) matches the structure of the program (constructors and destructors).
- **Proof normalization is computation**: Eliminating detours in proofs (cut elimination) is the same as beta-reduction. Strong normalization of STLC corresponds to the normalization theorem for intuitionistic propositional logic.
- **Intuitionistic logic**: The correspondence naturally yields intuitionistic (constructive) logic, not classical logic. Classical principles like excluded middle correspond to non-constructive computational primitives (control operators).
- **Historical development**: The correspondence was discovered independently by Curry (1934/1958, combinatory logic), Howard (1969/1980, lambda calculus and natural deduction), and de Bruijn (1968, Automath).

The Curry-Howard correspondence is not merely a curiosity --- it is the foundational principle underlying modern proof assistants (Coq, Agda, Lean) and a guiding light for the design of type systems.

**Practical implications.** The Curry-Howard correspondence has shaped the design of real programming languages and tools:

1. **Proof assistants** (Coq, Agda, Lean, Isabelle): These tools are based directly on the correspondence. Writing a proof is literally writing a program. The type checker verifies the proof by type-checking the program.

2. **Dependently typed programming** (Idris, F-star): Languages where types can depend on values, enabling specifications to be expressed as types. A function's type can state precisely what the function does, and the type checker verifies the implementation.

3. **Certified compilation** (CompCert, CakeML): Compilers where the correctness proof (that the compiled code behaves the same as the source) is a program in a proof assistant, verified by the Curry-Howard correspondence.

4. **Property-based testing** (QuickCheck): While not directly based on Curry-Howard, the idea of using types to generate test cases is inspired by the correspondence between types and specifications.

5. **Language design**: The correspondence suggests that every type constructor should have a logical interpretation, and vice versa. This principle guides the design of new type system features: adding a type constructor should correspond to adding a logical connective with meaningful introduction and elimination rules.

---

## Further Reading

1. **Howard, W. A.** (1980). "The Formulae-as-Types Notion of Construction." In *To H. B. Curry: Essays on Combinatory Logic, Lambda Calculus, and Formalism*, 479-490. Academic Press. The foundational paper (originally a 1969 manuscript).

2. **Wadler, P.** (2015). "Propositions as Types." *Communications of the ACM*, 58(12), 75-84. An accessible and beautifully written exposition.

3. **Sorensen, M. H. and Urzyczyn, P.** (2006). *Lectures on the Curry-Howard Isomorphism*. Elsevier. A comprehensive textbook treatment.

4. **Girard, J.-Y., Lafont, Y., and Taylor, P.** (1989). *Proofs and Types*. Cambridge University Press. Covers the correspondence for System F.

5. **Prawitz, D.** (1965). *Natural Deduction: A Proof-Theoretical Study*. Almqvist & Wiksell. The foundational work on proof normalization in natural deduction.

6. **Griffin, T. G.** (1990). "A Formulae-as-Types Notion of Control." In *Proceedings of POPL*, 47-58. Classical logic and control operators.

7. **Curry, H. B. and Feys, R.** (1958). *Combinatory Logic*, Vol. I. North-Holland. The original observation about types of combinators and logical axioms.

8. **de Bruijn, N. G.** (1970). "The Mathematical Language AUTOMATH, Its Usage, and Some of Its Extensions." In *Symposium on Automatic Demonstration*, 29-61. Springer.

9. **Martin-Lof, P.** (1984). *Intuitionistic Type Theory*. Bibliopolis. The extension of Curry-Howard to dependent types and predicate logic.

10. **Lambek, J. and Scott, P. J.** (1986). *Introduction to Higher Order Categorical Logic*. Cambridge University Press. The categorical (Lambek) side of the Curry-Howard-Lambek correspondence.

11. **Gentzen, G.** (1935). "Untersuchungen uber das logische Schliessen." *Mathematische Zeitschrift*, 39, 176-210. The original natural deduction system.

12. **The Univalent Foundations Program.** (2013). *Homotopy Type Theory: Univalent Foundations of Mathematics*. Institute for Advanced Study. The most radical extension of the Curry-Howard correspondence to homotopy theory.
