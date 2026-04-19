# Recitation 04: Lambda Calculus & Proofs

## Overview

This recitation provides hands-on practice with lambda calculus reductions, Church encodings, type derivations, and proving type safety for a small language. Work through the exercises in order; solutions to selected problems are provided at the end.

---

## 1. Beta-Reduction Exercises

### Exercise 1.1: Simple Reductions

Reduce each expression to normal form (or state that no normal form exists). Show each beta-reduction step.

**(a)** $(\lambda x.\; x)\; (\lambda y.\; y)$

**(b)** $(\lambda x.\; \lambda y.\; x)\; a\; b$

**(c)** $(\lambda f.\; \lambda x.\; f\; (f\; x))\; (\lambda y.\; y + 1)\; 0$

**(d)** $(\lambda x.\; x\; x)\; (\lambda x.\; x\; x)$

**(e)** $(\lambda x.\; \lambda y.\; y)\; ((\lambda x.\; x\; x)\; (\lambda x.\; x\; x))$

Hint for (e): Consider which reduction strategy matters.

### Exercise 1.2: Reduction Order

For the expression:

$$(\lambda x.\; \lambda y.\; x)\; ((\lambda z.\; z)\; a)\; b$$

**(a)** Reduce using **normal order** (leftmost outermost first). Count the steps.

**(b)** Reduce using **applicative order** (leftmost innermost first). Count the steps.

**(c)** Which strategy took fewer steps? Is this always the case?

### Exercise 1.3: Capture-Avoiding Substitution

Compute the following substitutions carefully:

**(a)** $[x \mapsto y](\lambda y.\; x\; y)$

**(b)** $[x \mapsto (\lambda z.\; z\; y)](\lambda y.\; x\; y)$

**(c)** $[x \mapsto y\; z](\lambda y.\; \lambda z.\; x)$

---

## 2. Church Encodings

### Exercise 2.1: Boolean Operations

Using the Church encoding of booleans:

$$\texttt{true} = \lambda t.\; \lambda f.\; t \qquad \texttt{false} = \lambda t.\; \lambda f.\; f$$

**(a)** Verify by reduction: $\texttt{and}\; \texttt{true}\; \texttt{false} \to^* \texttt{false}$ where $\texttt{and} = \lambda a.\; \lambda b.\; a\; b\; \texttt{false}$.

**(b)** Define $\texttt{xor}$ using Church booleans. Verify it on $\texttt{xor}\; \texttt{true}\; \texttt{false}$.

**(c)** Define a boolean equality test $\texttt{beq}$ such that $\texttt{beq}\; \texttt{true}\; \texttt{true} \to^* \texttt{true}$ and $\texttt{beq}\; \texttt{true}\; \texttt{false} \to^* \texttt{false}$.

### Exercise 2.2: Church Numerals

With Church numerals $\overline{n} = \lambda f.\; \lambda x.\; f^n(x)$:

**(a)** Compute $\texttt{plus}\; \overline{2}\; \overline{3}$ step by step, where $\texttt{plus} = \lambda m.\; \lambda n.\; \lambda f.\; \lambda x.\; m\; f\; (n\; f\; x)$. Verify the result equals $\overline{5}$.

**(b)** Compute $\texttt{mult}\; \overline{2}\; \overline{3}$ where $\texttt{mult} = \lambda m.\; \lambda n.\; \lambda f.\; m\; (n\; f)$. Verify the result equals $\overline{6}$.

**(c)** Show that $\texttt{iszero}\; \overline{0} \to^* \texttt{true}$ and $\texttt{iszero}\; \overline{3} \to^* \texttt{false}$ where $\texttt{iszero} = \lambda n.\; n\; (\lambda x.\; \texttt{false})\; \texttt{true}$.

### Exercise 2.3: Pairs and Lists

**(a)** Using $\texttt{pair} = \lambda a.\; \lambda b.\; \lambda f.\; f\; a\; b$ and $\texttt{fst} = \lambda p.\; p\; \texttt{true}$, verify $\texttt{fst}\; (\texttt{pair}\; a\; b) \to^* a$.

**(b)** Encode the list $[1, 2, 3]$ using Church encoding and compute $\texttt{foldr}\; \texttt{plus}\; \overline{0}\; [1, 2, 3]$.

---

## 3. Type Derivations

### Exercise 3.1: Simply-Typed Derivations

Construct complete typing derivation trees for:

**(a)** $\vdash \lambda x:\texttt{int}.\; \lambda y:\texttt{bool}.\; x : ?$

**(b)** $f : \texttt{int} \to \texttt{int} \vdash \lambda x:\texttt{int}.\; f\; (f\; x) : ?$

**(c)** $\vdash \lambda f:(\texttt{int} \to \texttt{int}).\; \lambda g:(\texttt{int} \to \texttt{int}).\; \lambda x:\texttt{int}.\; f\; (g\; x) : ?$

### Exercise 3.2: Untypability

Show that the following terms are not typable in the simply-typed lambda calculus (explain which constraint leads to a contradiction):

**(a)** $\lambda x.\; x\; x$

Hint: If $x : \tau$, then from $x\; x$, we need $\tau = \tau_1 \to \tau_2$ and $x : \tau_1$, so $\tau_1 \to \tau_2 = \tau_1$, which requires an infinite type.

**(b)** The Y combinator: $\lambda f.\; (\lambda x.\; f\; (x\; x))\; (\lambda x.\; f\; (x\; x))$

### Exercise 3.3: HM Type Inference

Apply Algorithm W to infer the type of:

**(a)** $\texttt{let}\; \texttt{id} = \lambda x.\; x\; \texttt{in}\; (\texttt{id}\; \texttt{id})$

Show each step: fresh variables, unification, generalization, instantiation.

**(b)** $\texttt{let}\; \texttt{const} = \lambda x.\; \lambda y.\; x\; \texttt{in}\; \texttt{const}\; 42\; \texttt{true}$

---

## 4. Type Safety Proofs

### Exercise 4.1: Progress for a Toy Language

Consider a language with the following syntax and types:

**Types:** $\tau ::= \texttt{Nat} \mid \tau_1 \to \tau_2$

**Terms:** $e ::= n \mid \texttt{succ}\; e \mid \texttt{pred}\; e \mid \texttt{iszero}\; e \mid \texttt{if}\; e\; \texttt{then}\; e\; \texttt{else}\; e \mid \lambda x:\tau.\; e \mid e_1\; e_2$

**Values:** $v ::= n \mid \lambda x:\tau.\; e$

**Typing rules:** (Standard, as in Lecture 03b and 04b.)

**(a)** State the canonical forms lemma for this language.

**(b)** Prove the progress theorem: if $\vdash e : \tau$, then either $e$ is a value or $\exists e'.\; e \to e'$.

Handle at least the cases for $\texttt{succ}$, $\texttt{if}$, and application.

### Exercise 4.2: Preservation

**(a)** State and prove the substitution lemma for the language in Exercise 4.1.

**(b)** Prove preservation for the beta-reduction case:

If $\vdash (\lambda x:\tau_1.\; e)\; v : \tau_2$ and $(\lambda x:\tau_1.\; e)\; v \to [x \mapsto v]e$, then $\vdash [x \mapsto v]e : \tau_2$.

### Exercise 4.3: Adding a Feature

Extend the language with pairs: $(e_1, e_2)$, $\texttt{fst}\; e$, $\texttt{snd}\; e$.

**(a)** Give the typing rules.

**(b)** Give the small-step evaluation rules.

**(c)** Extend the progress proof to handle the new cases.

**(d)** Extend the preservation proof (including the substitution lemma).

---

## 5. Curry-Howard Exercises

### Exercise 5.1: Write Programs for Propositions

For each proposition, write a well-typed closed term (program) that inhabits the corresponding type. If no such term exists, explain why.

**(a)** $A \to A$ (identity / reflexivity)

**(b)** $A \to B \to A$ (weakening / K combinator)

**(c)** $(A \to B \to C) \to B \to A \to C$ (flip)

**(d)** $(A \to B) \to (B \to C) \to (A \to C)$ (composition / transitivity)

**(e)** $((A \to B) \to A) \to A$ (Peirce's law)

**(f)** $(A \times B) \to (B \times A)$ (commutativity of conjunction)

**(g)** $(A \to C) \to (B \to C) \to (A + B \to C)$ (case analysis)

**(h)** $A + \neg A$ (excluded middle, for arbitrary $A$)

### Exercise 5.2: Translate Proofs to Programs

Given the natural deduction proof of $(A \Rightarrow B) \Rightarrow (B \Rightarrow C) \Rightarrow (A \Rightarrow C)$:

1. Assume $A \Rightarrow B$ (call it $f$).
2. Assume $B \Rightarrow C$ (call it $g$).
3. Assume $A$ (call it $a$).
4. Apply $f$ to $a$ to get $B$ (call it $b$).
5. Apply $g$ to $b$ to get $C$.

Write the corresponding lambda term and verify its type.

---

## 6. Selected Solutions

### Solution 1.1(a)

$$(\lambda x.\; x)\; (\lambda y.\; y) \to_\beta [x \mapsto (\lambda y.\; y)]x = \lambda y.\; y$$

Normal form: $\lambda y.\; y$.

### Solution 1.1(e)

$$(\lambda x.\; \lambda y.\; y)\; ((\lambda x.\; x\; x)\; (\lambda x.\; x\; x))$$

Under **normal order**: reduce the outermost redex $(\lambda x.\; \lambda y.\; y)\; \Omega$:

$$\to_\beta [x \mapsto \Omega](\lambda y.\; y) = \lambda y.\; y$$

Since $x$ does not appear in $\lambda y.\; y$, the divergent argument is never evaluated. Normal form: $\lambda y.\; y$.

Under **applicative order**: attempt to evaluate $\Omega$ first, which diverges. No result.

### Solution 1.3(a)

$[x \mapsto y](\lambda y.\; x\; y)$

Since $y \in \text{FV}(y)$ and $y$ is bound by the lambda, we must alpha-rename first:

$$= [x \mapsto y](\lambda z.\; x\; z) = \lambda z.\; y\; z$$

### Solution 2.1(a)

$$\texttt{and}\; \texttt{true}\; \texttt{false}$$
$$= (\lambda a.\; \lambda b.\; a\; b\; \texttt{false})\; \texttt{true}\; \texttt{false}$$
$$\to_\beta (\lambda b.\; \texttt{true}\; b\; \texttt{false})\; \texttt{false}$$
$$\to_\beta \texttt{true}\; \texttt{false}\; \texttt{false}$$
$$= (\lambda t.\; \lambda f.\; t)\; \texttt{false}\; \texttt{false}$$
$$\to_\beta (\lambda f.\; \texttt{false})\; \texttt{false}$$
$$\to_\beta \texttt{false} \quad \checkmark$$

### Solution 3.2(a)

Suppose $\lambda x.\; x\; x$ is typable. Then there exist $\Gamma$, $\tau$ with $\Gamma \vdash \lambda x.\; x\; x : \tau$.

By T-Abs: $\tau = \sigma \to \rho$ and $\Gamma, x:\sigma \vdash x\; x : \rho$.

By T-App: there exists $\sigma'$ with $\Gamma, x:\sigma \vdash x : \sigma' \to \rho$ and $\Gamma, x:\sigma \vdash x : \sigma'$.

By T-Var: $\sigma = \sigma' \to \rho$ and $\sigma = \sigma'$.

Therefore $\sigma = \sigma' \to \rho = \sigma \to \rho$, so $\sigma$ occurs in $\sigma \to \rho$---an infinite type. Contradiction (in a finite type system). $\square$

### Solution 5.1(e)

$((A \to B) \to A) \to A$ is **Peirce's law**. It is a classical tautology but is **not provable** in intuitionistic logic. Therefore, no closed term of this type exists in the simply-typed lambda calculus (without control operators).

### Solution 5.1(h)

$A + (A \to \texttt{void})$ for arbitrary $A$ is the **law of excluded middle**. Not provable constructively. No corresponding closed term exists.

---

## References

1. Pierce, B.C. (2002). *Types and Programming Languages*. MIT Press, Chapters 5, 8, 9.
2. Barendregt, H.P. (1984). *The Lambda Calculus*, Chapter 2 (Conversion).
3. Sorensen, M.H. & Urzyczyn, P. (2006). *Lectures on the Curry-Howard Isomorphism*, Chapter 4.
