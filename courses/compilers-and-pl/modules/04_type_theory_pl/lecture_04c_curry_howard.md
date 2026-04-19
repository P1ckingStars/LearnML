# Lecture 04c: The Curry-Howard Correspondence

## 1. Introduction

The **Curry-Howard correspondence** (also called the Curry-Howard isomorphism or propositions-as-types) is one of the most profound discoveries in the foundations of mathematics and computer science. It establishes a precise, structural correspondence between:

- **Propositions** in intuitionistic logic and **types** in typed lambda calculus,
- **Proofs** of propositions and **programs** (terms) of those types,
- **Proof simplification** (cut elimination) and **computation** (beta-reduction).

This correspondence is not merely an analogy---it is a formal isomorphism. Every theorem in logic corresponds to an inhabited type, and every well-typed program corresponds to a valid proof.

---

## 2. The Simply-Typed Lambda Calculus and Intuitionistic Propositional Logic

### 2.1 The Correspondence at a Glance

| Logic (IPL) | Type Theory (STLC) |
|-------------|---------------------|
| Proposition $A$ | Type $\tau$ |
| Proof of $A$ | Term $e : \tau$ |
| Implication $A \Rightarrow B$ | Function type $\tau_1 \to \tau_2$ |
| Conjunction $A \wedge B$ | Product type $\tau_1 \times \tau_2$ |
| Disjunction $A \vee B$ | Sum type $\tau_1 + \tau_2$ |
| Truth $\top$ | Unit type $\texttt{unit}$ |
| Falsehood $\bot$ | Empty type $\texttt{void}$ |
| Hypothesis $A$ in context | Variable $x : \tau$ in $\Gamma$ |
| Modus ponens | Function application |
| Proof assumption | Variable reference |
| $\Rightarrow$-introduction | Lambda abstraction |

### 2.2 Implication and Functions

**Logic:** The introduction and elimination rules for implication in natural deduction:

$$\frac{\Gamma, A \vdash B}{\Gamma \vdash A \Rightarrow B} \quad (\Rightarrow\text{-I}) \qquad \frac{\Gamma \vdash A \Rightarrow B \quad \Gamma \vdash A}{\Gamma \vdash B} \quad (\Rightarrow\text{-E})$$

**Type theory:** The typing rules for functions:

$$\frac{\Gamma, x:A \vdash e : B}{\Gamma \vdash \lambda x:A.\; e : A \to B} \quad (\text{T-Abs}) \qquad \frac{\Gamma \vdash e_1 : A \to B \quad \Gamma \vdash e_2 : A}{\Gamma \vdash e_1\; e_2 : B} \quad (\text{T-App})$$

These are structurally identical. The proof $\Rightarrow$-I corresponds to abstraction (constructing a function), and modus ponens ($\Rightarrow$-E) corresponds to application (calling a function).

**Example.** The identity proof and the identity function:

Logic: $A \vdash A$ (trivially). Proof: assume $A$, conclude $A$.

Type theory: $x : A \vdash x : A$. Term: $\lambda x:A.\; x : A \to A$.

### 2.3 Conjunction and Products

**Logic:**

$$\frac{\Gamma \vdash A \quad \Gamma \vdash B}{\Gamma \vdash A \wedge B} \quad (\wedge\text{-I}) \qquad \frac{\Gamma \vdash A \wedge B}{\Gamma \vdash A} \quad (\wedge\text{-E}_1) \qquad \frac{\Gamma \vdash A \wedge B}{\Gamma \vdash B} \quad (\wedge\text{-E}_2)$$

**Type theory:**

$$\frac{\Gamma \vdash e_1 : A \quad \Gamma \vdash e_2 : B}{\Gamma \vdash (e_1, e_2) : A \times B} \quad (\text{T-Pair}) \qquad \frac{\Gamma \vdash e : A \times B}{\Gamma \vdash \pi_1\; e : A} \quad (\text{T-Fst}) \qquad \frac{\Gamma \vdash e : A \times B}{\Gamma \vdash \pi_2\; e : B} \quad (\text{T-Snd})$$

**Example.** $A \wedge B \Rightarrow B \wedge A$ (commutativity of conjunction):

$$\lambda p : A \times B.\; (\pi_2\; p,\; \pi_1\; p) : (A \times B) \to (B \times A)$$

### 2.4 Disjunction and Sums

**Logic:**

$$\frac{\Gamma \vdash A}{\Gamma \vdash A \vee B} \quad (\vee\text{-I}_1) \qquad \frac{\Gamma \vdash B}{\Gamma \vdash A \vee B} \quad (\vee\text{-I}_2)$$

$$\frac{\Gamma \vdash A \vee B \quad \Gamma, A \vdash C \quad \Gamma, B \vdash C}{\Gamma \vdash C} \quad (\vee\text{-E})$$

**Type theory:**

$$\frac{\Gamma \vdash e : A}{\Gamma \vdash \texttt{inl}\; e : A + B} \quad (\text{T-Inl}) \qquad \frac{\Gamma \vdash e : B}{\Gamma \vdash \texttt{inr}\; e : A + B} \quad (\text{T-Inr})$$

$$\frac{\Gamma \vdash e : A + B \quad \Gamma, x:A \vdash e_1 : C \quad \Gamma, y:B \vdash e_2 : C}{\Gamma \vdash \texttt{case}\; e\; \texttt{of}\; \texttt{inl}\; x \Rightarrow e_1 \mid \texttt{inr}\; y \Rightarrow e_2 : C} \quad (\text{T-Case})$$

### 2.5 Truth and Unit

$\top$ is trivially provable; $\texttt{unit}$ is trivially constructible:

$$\frac{}{\Gamma \vdash \top} \quad (\top\text{-I}) \qquad \longleftrightarrow \qquad \frac{}{\Gamma \vdash () : \texttt{unit}} \quad (\text{T-Unit})$$

### 2.6 Falsehood and the Empty Type

$\bot$ has no introduction rule---there is no proof of falsehood. The elimination rule is **ex falso quodlibet** (from falsehood, anything follows):

$$\frac{\Gamma \vdash \bot}{\Gamma \vdash A} \quad (\bot\text{-E})$$

**Type theory:** The empty type $\texttt{void}$ has no constructors. Its elimination is:

$$\frac{\Gamma \vdash e : \texttt{void}}{\Gamma \vdash \texttt{absurd}\; e : A} \quad (\text{T-Absurd})$$

In Haskell: `absurd :: Void -> a`. This function is well-typed but can never be called (since no value of type `Void` exists).

---

## 3. Negation

In intuitionistic logic, negation is defined as:

$$\neg A \triangleq A \Rightarrow \bot$$

Under Curry-Howard:

$$\neg A \cong A \to \texttt{void}$$

A proof of $\neg A$ is a function that, given any hypothetical proof of $A$, produces a contradiction (a term of type $\texttt{void}$). Since $\texttt{void}$ is uninhabited, such a function can only exist if $A$ itself is uninhabited (no term of type $A$ exists in the empty context).

**Example.** Prove $A \Rightarrow \neg\neg A$ (double negation introduction):

$$\lambda a:A.\; \lambda f:(A \to \texttt{void}).\; f\; a \;:\; A \to (A \to \texttt{void}) \to \texttt{void}$$

Note: The converse $\neg\neg A \Rightarrow A$ (double negation elimination) is **not** provable in intuitionistic logic. It is equivalent to the law of excluded middle $A \vee \neg A$, which is not constructively valid.

---

## 4. Proof Normalization and Computation

### 4.1 The Computational Content of Proofs

**Proof normalization** (cut elimination in sequent calculus, detour elimination in natural deduction) corresponds to **beta-reduction**:

A proof that introduces a connective and immediately eliminates it has a "detour" that can be simplified:

$$\underbrace{(\lambda x:A.\; e)}_{\text{intro}}\; \underbrace{v}_{\text{elim}} \quad \to_\beta \quad [x \mapsto v]e$$

**Introduction followed by elimination = computation.**

For pairs:
$$\pi_1\;(e_1, e_2) \to_\beta e_1 \qquad \pi_2\;(e_1, e_2) \to_\beta e_2$$

For sums:
$$\texttt{case}\; (\texttt{inl}\; v)\; \texttt{of}\; \texttt{inl}\; x \Rightarrow e_1 \mid \texttt{inr}\; y \Rightarrow e_2 \to_\beta [x \mapsto v]e_1$$

### 4.2 The Normalization Theorem

**Theorem 4.1.** The simply-typed lambda calculus (with products and sums) is strongly normalizing.

Under Curry-Howard, this means: **every proof can be normalized** (simplified to a canonical, cut-free form).

### 4.3 Constructivism

The Curry-Howard correspondence is fundamentally about **constructive** (intuitionistic) logic:

- A proof of $A \vee B$ must provide either a proof of $A$ or a proof of $B$ (with a tag indicating which).
- A proof of $\exists x.\; P(x)$ must provide a witness $a$ and a proof of $P(a)$.
- A proof of $A \Rightarrow B$ must provide a function (algorithm) that transforms proofs of $A$ into proofs of $B$.

This is the **BHK interpretation** (Brouwer-Heyting-Kolmogorov).

**Classical logic** admits non-constructive principles:
- Excluded middle: $A \vee \neg A$ (no constructive proof in general).
- Double negation elimination: $\neg\neg A \Rightarrow A$.

Under Curry-Howard, these correspond to **control operators** (like `call/cc`). Griffin (1990) showed that Peirce's law $((A \to B) \to A) \to A$ corresponds to `call-with-current-continuation`.

---

## 5. Extended Correspondence: Quantifiers and Dependent Types

### 5.1 Universal Quantification and Dependent Functions

$$\frac{\Gamma \vdash A(x) \text{ for arbitrary } x}{\Gamma \vdash \forall x.\; A(x)} \quad (\forall\text{-I}) \qquad \longleftrightarrow \qquad \frac{\Gamma, x:X \vdash e : A(x)}{\Gamma \vdash \lambda x:X.\; e : \Pi x:X.\; A(x)} \quad (\text{T-Lam-Dep})$$

$$\frac{\Gamma \vdash \forall x.\; A(x) \quad \Gamma \vdash t : X}{\Gamma \vdash A(t)} \quad (\forall\text{-E}) \qquad \longleftrightarrow \qquad \frac{\Gamma \vdash f : \Pi x:X.\; A(x) \quad \Gamma \vdash t : X}{\Gamma \vdash f\; t : A(t)} \quad (\text{T-App-Dep})$$

### 5.2 Existential Quantification and Dependent Pairs

$$\exists x:X.\; A(x) \qquad \longleftrightarrow \qquad \Sigma x:X.\; A(x)$$

A proof of $\exists x.\; A(x)$ is a pair $(t, p)$ where $t : X$ is a witness and $p : A(t)$ is a proof.

### 5.3 The Full Table

| Logic | Type Theory |
|-------|-------------|
| Intuitionistic propositional logic | Simply-typed lambda calculus |
| Intuitionistic predicate logic | Dependently-typed lambda calculus |
| Second-order logic | System F (polymorphic lambda calculus) |
| Higher-order logic | Calculus of Constructions |
| Linear logic | Linear type theory |
| Modal logic | Monadic / staged computation |
| Temporal logic | Reactive / FRP types |

---

## 6. Practical Examples

### 6.1 Proving Logical Tautologies by Writing Programs

**Proposition:** $A \Rightarrow B \Rightarrow A$ (K combinator / weakening)

$$\texttt{K} = \lambda a:A.\; \lambda b:B.\; a \;:\; A \to B \to A$$

**Proposition:** $(A \Rightarrow B \Rightarrow C) \Rightarrow (A \Rightarrow B) \Rightarrow A \Rightarrow C$ (S combinator)

$$\texttt{S} = \lambda f:A \to B \to C.\; \lambda g:A \to B.\; \lambda a:A.\; f\; a\; (g\; a)$$

$$\texttt{S} : (A \to B \to C) \to (A \to B) \to A \to C$$

**Proposition:** $(A \Rightarrow B) \Rightarrow (B \Rightarrow C) \Rightarrow (A \Rightarrow C)$ (transitivity / composition)

$$\texttt{compose} = \lambda f:A \to B.\; \lambda g:B \to C.\; \lambda a:A.\; g\; (f\; a)$$

**Proposition:** $(A \wedge B) \Rightarrow (B \wedge A)$ (commutativity of conjunction)

$$\texttt{swap} = \lambda p:A \times B.\; (\pi_2\; p,\; \pi_1\; p) : (A \times B) \to (B \times A)$$

**Proposition:** $A \Rightarrow A \vee B$ (left disjunction introduction)

$$\texttt{left} = \lambda a:A.\; \texttt{inl}\; a : A \to A + B$$

### 6.2 The Tautology $(A \Rightarrow B) \Rightarrow (\neg B \Rightarrow \neg A)$ (Contrapositive)

Recall $\neg X = X \to \texttt{void}$.

$$\texttt{contra} = \lambda f:A \to B.\; \lambda nb:B \to \texttt{void}.\; \lambda a:A.\; nb\; (f\; a)$$

$$\texttt{contra} : (A \to B) \to (B \to \texttt{void}) \to (A \to \texttt{void})$$

### 6.3 An Unprovable Proposition

$A \vee \neg A$ (law of excluded middle) has no corresponding well-typed closed term in STLC:

There is no closed term of type $A + (A \to \texttt{void})$ for an arbitrary type variable $A$. This would require either constructing a value of type $A$ (impossible without assumptions) or a function $A \to \texttt{void}$ (impossible since $A$ might be inhabited).

---

## 7. Curry-Howard in Practice

### 7.1 Proof Assistants

Proof assistants exploit Curry-Howard directly:

| System | Logic | Type Theory |
|--------|-------|-------------|
| Coq | Calculus of Inductive Constructions | Dependent types + inductive types |
| Agda | Martin-Lof Type Theory | Dependent types |
| Lean | CIC variant | Dependent types + tactics |
| Isabelle | Higher-order logic (HOL) | Simple types + polymorphism |

In Coq, proving a theorem and writing a program are literally the same activity:

```coq
(* Proving commutativity of conjunction *)
Theorem and_comm : forall A B : Prop, A /\ B -> B /\ A.
Proof.
  intros A B [Ha Hb].    (* destruct the conjunction *)
  split.                   (* prove both components *)
  - exact Hb.
  - exact Ha.
Qed.

(* The proof term extracted: *)
(* fun (A B : Prop) (p : A /\ B) => match p with conj Ha Hb => conj Hb Ha end *)
```

### 7.2 Program Extraction

Coq can **extract** executable programs from proofs:

```coq
(* Prove that for every n, there exists an m such that m = n + 1 *)
Definition successor : forall n : nat, {m : nat | m = n + 1}.
  intro n. exists (n + 1). reflexivity.
Defined.

(* Extract to OCaml: *)
(* let successor n = n + 1 *)
```

### 7.3 Wadler's "Propositions as Types" (2015)

Wadler's influential essay traces the Curry-Howard correspondence from its origins to modern applications, arguing that it is a **discovery** rather than an invention---the connection between logic and computation is a deep structural feature of mathematics itself.

Key insight: The correspondence extends far beyond the original setting:

- **Sequent calculus** corresponds to **abstract machines** (the pi-calculus).
- **Classical logic** corresponds to **control operators** (continuations).
- **Linear logic** corresponds to **session types** (communication protocols).

---

## 8. Curry-Howard and PL Design

### 8.1 Type System Design Principles

The correspondence suggests design principles for type systems:

1. **Every type constructor should correspond to a logical connective.** This ensures coherent introduction and elimination forms.

2. **Uninhabited types correspond to unprovable propositions.** If a type cannot be inhabited, it represents an impossible condition---useful for ruling out errors.

3. **Parametric polymorphism corresponds to universally quantified statements.** A function $\forall \alpha.\; \alpha \to \alpha$ must work uniformly for all types, just as $\forall A.\; A \Rightarrow A$ holds for all propositions.

4. **Termination and logical consistency.** A language with general recursion corresponds to an inconsistent logic (every type is inhabited by a divergent term). This is why proof assistants require termination checking.

### 8.2 The Void Type in Practice

Haskell and Rust use uninhabited types:

```haskell
-- Haskell
data Void        -- no constructors
absurd :: Void -> a
absurd v = case v of {}   -- empty pattern match is total

-- Rust
enum Void {}     // or use std::convert::Infallible
fn absurd(v: Void) -> ! { match v {} }
```

The existence of `absurd : Void -> a` encodes ex falso quodlibet.

### 8.3 GADTs and Local Reasoning

GADTs exploit Curry-Howard for local type refinement. When you pattern-match on a GADT constructor, you gain local type equalities---effectively, you receive a proof that certain types are equal within that branch.

---

## 9. Summary

| Logic | Computation |
|-------|------------|
| Proposition | Type |
| Proof | Program |
| Implication | Function type |
| Conjunction | Product type |
| Disjunction | Sum type |
| True | Unit type |
| False | Empty type |
| Negation $\neg A$ | $A \to \texttt{void}$ |
| Universal $\forall$ | Dependent function $\Pi$ |
| Existential $\exists$ | Dependent pair $\Sigma$ |
| Proof normalization | Beta-reduction |
| Cut elimination | Computation |
| Constructive existence | Witness-carrying program |

---

## References

1. Howard, W.A. (1980). "The Formulae-as-Types Notion of Construction." In *To H.B. Curry: Essays on Combinatory Logic, Lambda Calculus, and Formalism*, Academic Press, 479--490. (Originally circulated as a manuscript in 1969.)
2. Wadler, P. (2015). "Propositions as Types." *Communications of the ACM*, 58(12), 75--84.
3. Curry, H.B. & Feys, R. (1958). *Combinatory Logic*, Vol. I. North-Holland.
4. Griffin, T.G. (1990). "A Formulae-as-Types Notion of Control." *POPL*, 47--58.
5. Girard, J.-Y., Lafont, Y., & Taylor, P. (1989). *Proofs and Types*. Cambridge University Press.
6. Sorensen, M.H. & Urzyczyn, P. (2006). *Lectures on the Curry-Howard Isomorphism*. Elsevier.
7. Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press, Chapter 9.
