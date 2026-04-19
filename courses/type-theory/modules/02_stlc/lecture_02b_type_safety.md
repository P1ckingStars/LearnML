---
title: "Lecture 02b: Type Safety --- Progress and Preservation"
tags:
  - type-theory
  - stlc
  - lecture
---
# Lecture 02b: Type Safety --- Progress and Preservation

> **Module 02 --- Simply Typed Lambda Calculus (Weeks 3-4)**
> Estimated study time: 6-8 hours

---

## Learning Objectives

By the end of this lecture, you will be able to:

1. State the precise meaning of type safety and explain Milner's slogan "well-typed programs don't go wrong."
2. State and prove the Canonical Forms lemma for the simply typed lambda calculus.
3. State and prove the Progress theorem for STLC.
4. State and prove the Substitution Lemma, the key technical tool for preservation.
5. State and prove the Preservation theorem (subject reduction) for STLC.
6. Explain how type safety follows from progress and preservation by induction on evaluation.
7. State the strong normalization theorem for STLC and sketch the logical relations proof technique.
8. Identify which components of the type safety proof must be revised when the language is extended.

---

## 1. Motivation: What Does Type Safety Mean?

### 1.1 Milner's Slogan

Robin Milner, in his seminal 1978 paper on ML, articulated the guiding principle of type systems:

> *"Well-typed programs cannot go wrong."*

But what does "go wrong" mean precisely? In our setting, a program "goes wrong" if it reaches a **stuck state**: a term that is neither a value nor can take a step.

**Definition 1.1 (Safety / Soundness).** A type system is **safe** (or **sound**) if no well-typed closed term can reach a stuck state during evaluation.

Formally: if $\vdash t : T$ and $t \to^* t'$, then $t'$ is not stuck.

### 1.2 The Two-Theorem Approach

Wright and Felleisen (1994) popularized a clean two-part proof strategy for establishing type safety:

1. **Progress**: A well-typed closed term is either a value or can take a step.
2. **Preservation** (Subject Reduction): If a well-typed term takes a step, the resulting term is also well-typed (at the same type).

Together, these imply type safety: a well-typed term can never reach a stuck state, because at each step it either is a value (done) or can take another step (and the result remains well-typed).

**Theorem 1.2 (Type Safety).** If $\vdash t : T$, then $t$ does not get stuck. That is, if $\vdash t : T$ and $t \to^* t'$, then $t'$ is either a value or there exists $t''$ such that $t' \to t''$.

*Proof.* By induction on the length of the reduction sequence $t \to^* t'$.

- **Base case** ($t' = t$): By Progress (Theorem 3.1), since $\vdash t : T$, either $t$ is a value or there exists $t''$ with $t \to t''$.
- **Inductive case** ($t \to^* t_0 \to t'$): By the induction hypothesis, $t_0$ is not stuck. If $t_0$ is a value, then $t_0$ cannot step (contradiction with $t_0 \to t'$, unless we consider values as a special case). If $t_0 \to t'$, then by Preservation (Theorem 5.1), $\vdash t' : T$. By Progress, $t'$ is either a value or can step.

More precisely, we prove by induction on $n$ that if $\vdash t : T$ and $t \to^n t'$, then $t'$ is not stuck:
- $n = 0$: Apply Progress to $t$.
- $n = k+1$: We have $t \to t_1 \to^k t'$. By Progress, $t$ is not stuck, so $t \to t_1$ for some $t_1$. By Preservation, $\vdash t_1 : T$. By the induction hypothesis (applied to $t_1$ with $k$ steps), $t'$ is not stuck.

$\square$

### 1.3 Visualizing the Two Theorems

Consider a well-typed closed term $t$ with $\vdash t : T$. The evaluation of $t$ produces a sequence of terms:

$$t = t_0 \to t_1 \to t_2 \to \cdots$$

**Progress** says: at each point $t_i$ in this sequence, either $t_i$ is a value (the sequence ends) or $t_i$ can step to $t_{i+1}$ (the sequence continues). There is never a point where $t_i$ is stuck.

**Preservation** says: at each point $t_i$, if $\vdash t_i : T$, then $\vdash t_{i+1} : T$. The type is preserved throughout the sequence.

Together, they guarantee:
- The sequence never gets stuck (Progress at each step).
- The type never changes (Preservation at each step).
- If the sequence terminates at a value $v$, then $\vdash v : T$ (by Preservation applied transitively).

For STLC specifically, strong normalization guarantees that the sequence is finite (it always terminates at some value $v$).

### 1.4 A Formal Statement of Type Safety

To be completely precise, let us state type safety as a single theorem:

**Theorem 1.3 (Type Safety, Formal).** For all types $T$ and terms $t$, if $\vdash t : T$ and $t \to^* t'$, then either:
1. $t'$ is a value (and $\vdash t' : T$), or
2. there exists $t''$ such that $t' \to t''$ (and $\vdash t'' : T$).

In particular, $t'$ is not stuck.

*Proof.* As in Section 1.2: by induction on the number of steps in $t \to^* t'$, using Progress and Preservation at each step. $\square$

### 1.5 Examples of Type Safety in Action

Before proving the theorems, let us see type safety in action with some examples.

**Example 1.1 (Type safety prevents stuck terms).** Consider the well-typed term:

$$\vdash \text{if}\; (\text{iszero}\; 0)\; \text{then}\; (\text{succ}\; 0)\; \text{else}\; 0 : \text{Nat}$$

Evaluation: $\text{if}\; (\text{iszero}\; 0)\; \text{then}\; (\text{succ}\; 0)\; \text{else}\; 0 \to \text{if}\; \text{true}\; \text{then}\; (\text{succ}\; 0)\; \text{else}\; 0 \to \text{succ}\; 0$.

At each step, the term has type $\text{Nat}$ (preservation) and is either a value or can step further (progress). The final result $\text{succ}\; 0$ is a value of type $\text{Nat}$.

**Example 1.2 (Type system prevents errors).** The ill-typed term $\text{if}\; 0\; \text{then}\; \text{true}\; \text{else}\; \text{false}$ would get stuck: $0$ is a value but not a boolean, so neither E-IfTrue nor E-IfFalse applies. The type system rejects this term because T-If requires the guard to have type $\text{Bool}$, but $0 : \text{Nat}$.

**Example 1.3 (Application type safety).** Consider:

$$\vdash (\lambda x : \text{Bool}.\, x)\; \text{true} : \text{Bool}$$

Evaluation: $(\lambda x : \text{Bool}.\, x)\; \text{true} \to [x \mapsto \text{true}]\, x = \text{true}$.

The result $\text{true}$ has type $\text{Bool}$ (preservation). At each step, the term was not stuck (progress).

### 1.6 Why This Decomposition Matters

The progress-and-preservation approach has become the standard method for proving type safety in programming language theory. Its virtues include:

- **Modularity**: When we extend the language (e.g., adding pairs, sums, references), we extend each proof independently.
- **Clarity**: Each theorem isolates a different aspect of correctness. Progress says the type system is expressive enough to rule out stuck terms. Preservation says the type system is consistent with the operational semantics.
- **Generality**: The same approach works for virtually all type systems in the literature.
- **Composability**: Progress and preservation proofs compose well with each other and with other metatheoretic results (normalization, confluence, etc.).

### 1.7 Type Safety in Practice

Type safety is not merely a theoretical concern. It has profound practical implications:

1. **Memory safety**: In languages like C and C++, the absence of type safety leads to buffer overflows, use-after-free bugs, and other memory corruption vulnerabilities. Type-safe languages (Java, OCaml, Haskell, Rust) prevent these classes of bugs by construction.

2. **Security**: Many security vulnerabilities (SQL injection, XSS, format string attacks) can be viewed as type errors: data of one type (user input) is used where data of another type (trusted code/queries) is expected. Strong type systems can prevent these errors.

3. **Refactoring**: In a type-safe language, changing the type of a function propagates errors to all call sites that are now incompatible. This makes large-scale refactoring safer --- the type checker catches inconsistencies that tests might miss.

4. **Concurrency**: Type-safe languages prevent data races and other concurrency bugs that arise from shared mutable state. Session types (Module 09) extend type safety to communication protocols.

5. **Interoperability**: When code written in different languages or by different teams is combined, type safety at the interface ensures that values are used consistently. Foreign function interfaces (FFIs) that bypass the type system are a common source of bugs.

The STLC type safety theorem is the simplest instance of these practical benefits. The theorem guarantees that a well-typed program in our tiny language will never reach an undefined state. The same guarantee, suitably generalized, is the foundation of type safety in real programming languages.

---

## 2. Canonical Forms

Before proving progress, we need a lemma that characterizes what values can have each type. This is the **Canonical Forms** lemma.

**Lemma 2.1 (Canonical Forms).**

1. If $v$ is a value and $\vdash v : \text{Bool}$, then $v = \text{true}$ or $v = \text{false}$.
2. If $v$ is a value and $\vdash v : \text{Nat}$, then $v$ is a numeric value (i.e., $v = 0$ or $v = \text{succ}\; \text{nv}$ for some numeric value $\text{nv}$).
3. If $v$ is a value and $\vdash v : T_1 \to T_2$, then $v = \lambda x : T_1.\, t$ for some $x$ and $t$.

*Proof.* In each case, we enumerate the possible forms of values and check which ones can have the given type.

Recall that values are: $\text{true}$, $\text{false}$, numeric values ($0$, $\text{succ}\;\text{nv}$), and lambda abstractions ($\lambda x : T.\, t$).

**(1)** Suppose $v$ is a value and $\vdash v : \text{Bool}$.
- If $v = \text{true}$: $\vdash \text{true} : \text{Bool}$ by T-True. Consistent.
- If $v = \text{false}$: $\vdash \text{false} : \text{Bool}$ by T-False. Consistent.
- If $v = 0$: By T-Zero, $\vdash 0 : \text{Nat}$. By uniqueness of types, $\text{Nat} = \text{Bool}$, contradiction.
- If $v = \text{succ}\; \text{nv}$: By T-Succ, $\vdash \text{succ}\;\text{nv} : \text{Nat} \neq \text{Bool}$, contradiction.
- If $v = \lambda x : S.\, t$: By T-Abs, $\vdash \lambda x : S.\, t : S \to T_2$ for some $T_2$. But $S \to T_2 \neq \text{Bool}$ (arrow types are not base types), contradiction.

So $v = \text{true}$ or $v = \text{false}$.

**(2)** Suppose $v$ is a value and $\vdash v : \text{Nat}$.
- If $v = \text{true}$ or $v = \text{false}$: type is $\text{Bool} \neq \text{Nat}$, contradiction.
- If $v = 0$: consistent.
- If $v = \text{succ}\; \text{nv}$: by T-Succ, $\vdash \text{succ}\;\text{nv} : \text{Nat}$, consistent (and we need $\vdash \text{nv} : \text{Nat}$, which is ensured by the typing).
- If $v = \lambda x : S.\, t$: type is $S \to T_2 \neq \text{Nat}$, contradiction.

So $v$ is a numeric value.

**(3)** Suppose $v$ is a value and $\vdash v : T_1 \to T_2$.
- If $v = \text{true}$ or $v = \text{false}$: type is $\text{Bool}$, not an arrow type. Contradiction.
- If $v = 0$: type is $\text{Nat}$, not an arrow type. Contradiction.
- If $v = \text{succ}\; \text{nv}$: type is $\text{Nat}$, not an arrow type. Contradiction.
- If $v = \lambda x : S.\, t$: by T-Abs, $\vdash \lambda x : S.\, t : S \to T_2'$ for some $T_2'$. By uniqueness of types, $T_1 = S$ and $T_2 = T_2'$. Consistent.

So $v = \lambda x : T_1.\, t$ for some $t$.

$\square$

### 2.2 Understanding Canonical Forms

The Canonical Forms lemma is a bridge between the **static** world (typing) and the **dynamic** world (values). It answers the question: "If I know the type of a value, what can the value look like?"

Without Canonical Forms, the Progress proof would be stuck. Consider the T-If case: we determine that $t_1$ is a value of type $\text{Bool}$. To apply E-IfTrue or E-IfFalse, we need to know that $t_1$ is either $\text{true}$ or $\text{false}$. But how do we know this? A priori, $t_1$ could be any value --- a number, a lambda abstraction, etc. The Canonical Forms lemma rules out all possibilities except $\text{true}$ and $\text{false}$.

The proof of Canonical Forms depends on two properties of the type system:

1. **Uniqueness of types**: Each value has exactly one type. So a value of type $\text{Bool}$ cannot simultaneously have type $\text{Nat}$ or an arrow type.

2. **Exhaustiveness of value forms**: The grammar of values is fixed, and every value is one of: $\text{true}$, $\text{false}$, a numeric value, or a lambda abstraction. We can enumerate all possibilities and check which ones are compatible with the given type.

In systems with subtyping (Module 04), the Canonical Forms lemma becomes more subtle: a value of type $T$ might also have type $S$ where $T <: S$ or $S <: T$. The proof must account for the subtyping relationship.

### 2.3 Canonical Forms in Practice

In a compiler or interpreter, the Canonical Forms lemma corresponds to the **tag check** or **dynamic dispatch** that occurs at runtime. When evaluating $\text{if}\; v\; \text{then}\; t_2\; \text{else}\; t_3$, the runtime checks whether $v$ is $\text{true}$ or $\text{false}$. The type system guarantees that no other case can arise, so there is no need for an error branch.

In untyped languages, this tag check can fail at runtime (e.g., trying to use a number as a boolean), leading to a runtime type error. The static type system eliminates these errors in advance.

---

## 3. Progress

**Theorem 3.1 (Progress).** If $\vdash t : T$ (i.e., $t$ is a well-typed closed term), then either $t$ is a value or there exists $t'$ such that $t \to t'$.

*Proof.* By induction on the derivation of $\vdash t : T$.

**Case** T-True: $t = \text{true}$. This is a value. Done.

**Case** T-False: $t = \text{false}$. This is a value. Done.

**Case** T-Zero: $t = 0$. This is a value. Done.

**Case** T-Var: $t = x$ and $x : T \in \emptyset$. But the empty context contains no bindings, so this case is vacuously true. (This case cannot arise for closed terms, which is why Progress requires $\vdash t : T$ with the empty context.)

**Case** T-Abs: $t = \lambda x : T_1.\, t_1$. This is a value. Done.

**Case** T-If: $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$ with $\vdash t_1 : \text{Bool}$, $\vdash t_2 : T$, $\vdash t_3 : T$.

By the induction hypothesis on $t_1$: either $t_1$ is a value, or $t_1 \to t_1'$ for some $t_1'$.

- *Subcase: $t_1 \to t_1'$*. Then by E-If: $\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3 \to \text{if}\; t_1'\; \text{then}\; t_2\; \text{else}\; t_3$. Done.
- *Subcase: $t_1$ is a value*. By Canonical Forms (Lemma 2.1, part 1), since $\vdash t_1 : \text{Bool}$ and $t_1$ is a value, $t_1 = \text{true}$ or $t_1 = \text{false}$.
  - If $t_1 = \text{true}$: by E-IfTrue, $t \to t_2$. Done.
  - If $t_1 = \text{false}$: by E-IfFalse, $t \to t_3$. Done.

**Case** T-Succ: $t = \text{succ}\; t_1$ with $\vdash t_1 : \text{Nat}$.

By the induction hypothesis on $t_1$: either $t_1$ is a value, or $t_1 \to t_1'$.

- *Subcase: $t_1 \to t_1'$*. By E-Succ: $\text{succ}\; t_1 \to \text{succ}\; t_1'$. Done.
- *Subcase: $t_1$ is a value*. By Canonical Forms (part 2), $t_1$ is a numeric value. Then $\text{succ}\; t_1$ is also a numeric value (hence a value). Done.

**Case** T-Pred: $t = \text{pred}\; t_1$ with $\vdash t_1 : \text{Nat}$.

By the induction hypothesis on $t_1$: either $t_1$ is a value, or $t_1 \to t_1'$.

- *Subcase: $t_1 \to t_1'$*. By E-Pred: $\text{pred}\; t_1 \to \text{pred}\; t_1'$. Done.
- *Subcase: $t_1$ is a value*. By Canonical Forms (part 2), $t_1$ is a numeric value.
  - If $t_1 = 0$: by E-PredZero, $\text{pred}\; 0 \to 0$. Done.
  - If $t_1 = \text{succ}\; \text{nv}$: by E-PredSucc, $\text{pred}\; (\text{succ}\; \text{nv}) \to \text{nv}$. Done.

**Case** T-IsZero: $t = \text{iszero}\; t_1$ with $\vdash t_1 : \text{Nat}$.

By the induction hypothesis on $t_1$: either $t_1$ is a value, or $t_1 \to t_1'$.

- *Subcase: $t_1 \to t_1'$*. By E-IsZero: $\text{iszero}\; t_1 \to \text{iszero}\; t_1'$. Done.
- *Subcase: $t_1$ is a value*. By Canonical Forms (part 2), $t_1$ is a numeric value.
  - If $t_1 = 0$: by E-IsZeroZero, $\text{iszero}\; 0 \to \text{true}$. Done.
  - If $t_1 = \text{succ}\; \text{nv}$: by E-IsZeroSucc, $\text{iszero}\; (\text{succ}\; \text{nv}) \to \text{false}$. Done.

**Case** T-App: $t = t_1\; t_2$ with $\vdash t_1 : T_1 \to T_2$ and $\vdash t_2 : T_1$.

By the induction hypothesis on $t_1$: either $t_1$ is a value, or $t_1 \to t_1'$.
By the induction hypothesis on $t_2$: either $t_2$ is a value, or $t_2 \to t_2'$.

- *Subcase: $t_1 \to t_1'$*. By E-App1: $t_1\; t_2 \to t_1'\; t_2$. Done.
- *Subcase: $t_1$ is a value and $t_2 \to t_2'$*. By E-App2: $v_1\; t_2 \to v_1\; t_2'$ (where $v_1 = t_1$). Done.
- *Subcase: both $t_1$ and $t_2$ are values*. By Canonical Forms (part 3), since $\vdash t_1 : T_1 \to T_2$ and $t_1$ is a value, $t_1 = \lambda x : T_1.\, t_{12}$ for some $x, t_{12}$. By E-AppAbs: $(\lambda x : T_1.\, t_{12})\; v_2 \to [x \mapsto v_2]\, t_{12}$ (where $v_2 = t_2$). Done.

This completes all cases. $\square$

### 3.2 Structure of the Progress Proof

The progress proof has a uniform structure worth noting:

1. For **value cases** (T-True, T-False, T-Zero, T-Abs): the term is already a value. Done immediately.

2. For **compound cases with no computation rules** (T-Succ, T-Pair in Lecture 02c): the induction hypothesis determines whether the subterms are values. If all are values, the compound term is a value. If some subterm can step, a congruence rule applies.

3. For **compound cases with computation rules** (T-If, T-Pred, T-IsZero, T-App): the induction hypothesis determines whether the "active" subterm is a value. If it is not, a congruence rule applies. If it is, the Canonical Forms lemma determines the value's shape, and the appropriate computation rule applies.

4. The **T-Var case** is vacuously true because Progress requires the empty context. This is the critical point: for open terms, progress fails because free variables are stuck.

### 3.3 Why Progress Needs the Empty Context

Consider the open term $x$ with typing $x : \text{Bool} \vdash x : \text{Bool}$. This term is well-typed, but it is neither a value (variables are not values in call-by-value semantics) nor can it step (there is no evaluation rule for a bare variable). It is stuck.

This is not a failure of the type system --- it is expected. Free variables represent "holes" in a program (values that will be provided later). A complete program has no free variables, which is why Progress requires $\vdash t : T$ (typing in the empty context, hence $t$ is closed).

In a call-by-name calculus, one could consider variables as values (they represent unevaluated expressions). Under that convention, the T-Var case of Progress would be handled by saying "the variable is a value." This is a design choice in the operational semantics.

### 3.4 A Non-Example: What if We Had Stuck Evaluation Rules?

Imagine we had forgotten the E-PredZero rule (which says $\text{pred}\; 0 \to 0$). Then the term $\text{pred}\; 0$ would be stuck: it has type $\text{Nat}$ (by T-Pred and T-Zero), $0$ is a value of type $\text{Nat}$, but no evaluation rule would apply. The Progress proof would fail at the T-Pred case: after determining that the argument is the value $0$, we would need an evaluation rule for $\text{pred}\; 0$, but none would exist.

This illustrates an important principle: **progress is a property of the typing rules AND the evaluation rules together**. Both must be designed in coordination. The typing rules say which terms are well-typed; the evaluation rules say how they compute. Progress checks that every well-typed term has somewhere to go.

---

## 4. The Substitution Lemma

The proof of preservation requires understanding how types interact with substitution. This is captured by the Substitution Lemma, the most important technical lemma in the metatheory of STLC.

### 4.1 Why the Substitution Lemma is Needed

Consider the E-AppAbs evaluation rule:

$$(\lambda x : T_1.\, t_{12})\; v_2 \to [x \mapsto v_2]\, t_{12}$$

For the Preservation theorem, we need to show that if $\Gamma \vdash (\lambda x : T_1.\, t_{12})\; v_2 : T_2$, then $\Gamma \vdash [x \mapsto v_2]\, t_{12} : T_2$.

From the typing premises, we know:
- $\Gamma \vdash \lambda x : T_1.\, t_{12} : T_1 \to T_2$, which (by inversion) gives $\Gamma, x : T_1 \vdash t_{12} : T_2$.
- $\Gamma \vdash v_2 : T_1$.

We need to conclude $\Gamma \vdash [x \mapsto v_2]\, t_{12} : T_2$. This is exactly what the Substitution Lemma provides.

### 4.2 Statement

**Lemma 4.1 (Substitution).** If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash s : S$, then $\Gamma \vdash [x \mapsto s]\, t : T$.

In words: if term $t$ has type $T$ under a context that includes $x : S$, and $s$ is a term of type $S$ (in context $\Gamma$), then substituting $s$ for $x$ in $t$ gives a term of type $T$ (in context $\Gamma$, without the binding for $x$).

### 4.3 Proof

*Proof.* By induction on the derivation of $\Gamma, x : S \vdash t : T$.

**Case** T-Var: $t = y$ for some variable $y$, and $y : T \in (\Gamma, x : S)$.

There are two subcases:
- *Subcase $y = x$*: Then $T = S$ (since $x : S$ is the binding in the context), and $[x \mapsto s]\, x = s$. We need $\Gamma \vdash s : S$, which is given.
- *Subcase $y \neq x$*: Then $y : T \in \Gamma$, and $[x \mapsto s]\, y = y$. By T-Var, $\Gamma \vdash y : T$.

**Case** T-Abs: $t = \lambda y : T_1.\, t_1$ with $\Gamma, x : S, y : T_1 \vdash t_1 : T_2$ and $T = T_1 \to T_2$.

We may assume $y \neq x$ and $y \notin \text{FV}(s)$ (by alpha-renaming $y$ if necessary --- this is where capture-avoiding substitution is essential).

Then $[x \mapsto s]\, (\lambda y : T_1.\, t_1) = \lambda y : T_1.\, [x \mapsto s]\, t_1$.

By permutation, $\Gamma, y : T_1, x : S \vdash t_1 : T_2$. By the induction hypothesis (with context $\Gamma, y : T_1$), since $\Gamma, y : T_1 \vdash s : S$ (by weakening, since $y \notin \text{FV}(s)$ implies $s$ is well-typed with or without $y$ in the context; more precisely, by Weakening Lemma 8.2 from Lecture 02a), we get $\Gamma, y : T_1 \vdash [x \mapsto s]\, t_1 : T_2$.

By T-Abs, $\Gamma \vdash \lambda y : T_1.\, [x \mapsto s]\, t_1 : T_1 \to T_2$.

**Case** T-App: $t = t_1\; t_2$ with $\Gamma, x : S \vdash t_1 : T_1 \to T$ and $\Gamma, x : S \vdash t_2 : T_1$.

By the induction hypothesis on $t_1$: $\Gamma \vdash [x \mapsto s]\, t_1 : T_1 \to T$.
By the induction hypothesis on $t_2$: $\Gamma \vdash [x \mapsto s]\, t_2 : T_1$.

Since $[x \mapsto s]\, (t_1\; t_2) = ([x \mapsto s]\, t_1)\; ([x \mapsto s]\, t_2)$, by T-App:

$$\Gamma \vdash ([x \mapsto s]\, t_1)\; ([x \mapsto s]\, t_2) : T$$

**Case** T-True: $t = \text{true}$ and $T = \text{Bool}$. Then $[x \mapsto s]\, \text{true} = \text{true}$, and $\Gamma \vdash \text{true} : \text{Bool}$ by T-True.

**Case** T-False: Analogous to T-True.

**Case** T-If: $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$ with $\Gamma, x : S \vdash t_1 : \text{Bool}$, $\Gamma, x : S \vdash t_2 : T$, $\Gamma, x : S \vdash t_3 : T$.

By the induction hypothesis on each subterm:
- $\Gamma \vdash [x \mapsto s]\, t_1 : \text{Bool}$
- $\Gamma \vdash [x \mapsto s]\, t_2 : T$
- $\Gamma \vdash [x \mapsto s]\, t_3 : T$

Since $[x \mapsto s]\, (\text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3) = \text{if}\; [x \mapsto s]\,t_1\; \text{then}\; [x \mapsto s]\,t_2\; \text{else}\; [x \mapsto s]\,t_3$, by T-If:

$$\Gamma \vdash \text{if}\; [x \mapsto s]\,t_1\; \text{then}\; [x \mapsto s]\,t_2\; \text{else}\; [x \mapsto s]\,t_3 : T$$

**Case** T-Zero: $t = 0$ and $T = \text{Nat}$. Then $[x \mapsto s]\, 0 = 0$, and $\Gamma \vdash 0 : \text{Nat}$.

**Case** T-Succ: $t = \text{succ}\; t_1$ with $\Gamma, x : S \vdash t_1 : \text{Nat}$.

By IH, $\Gamma \vdash [x \mapsto s]\, t_1 : \text{Nat}$. By T-Succ, $\Gamma \vdash \text{succ}\; ([x \mapsto s]\, t_1) : \text{Nat}$.

**Case** T-Pred: $t = \text{pred}\; t_1$ with $\Gamma, x : S \vdash t_1 : \text{Nat}$.

By IH, $\Gamma \vdash [x \mapsto s]\, t_1 : \text{Nat}$. By T-Pred, $\Gamma \vdash \text{pred}\; ([x \mapsto s]\, t_1) : \text{Nat}$.

**Case** T-IsZero: $t = \text{iszero}\; t_1$ with $\Gamma, x : S \vdash t_1 : \text{Nat}$.

By IH, $\Gamma \vdash [x \mapsto s]\, t_1 : \text{Nat}$. By T-IsZero, $\Gamma \vdash \text{iszero}\; ([x \mapsto s]\, t_1) : \text{Bool}$.

$\square$

### 4.4 Discussion

The Substitution Lemma is the hardest part of the type safety proof. Several points deserve emphasis:

1. **The T-Abs case is the critical one.** It requires alpha-renaming to avoid variable capture, and it uses weakening to extend the typing of $s$ to the larger context.

2. **The lemma encapsulates the key interaction** between the static semantics (typing) and the dynamic semantics (substitution-based evaluation). Beta-reduction replaces a variable with a value; the substitution lemma guarantees that this replacement preserves types.

3. **In mechanized proofs** (e.g., in Coq, Agda, or Lean), the substitution lemma is often the most tedious part to formalize, especially with named variables. Using de Bruijn indices or locally nameless representations can simplify the proof at the cost of readability.

### 4.4 The Multi-Substitution Generalization

The Substitution Lemma as stated handles substitution of a single variable. A useful generalization is the **simultaneous substitution** lemma:

**Lemma 4.2 (Simultaneous Substitution).** If $\Gamma, x_1 : S_1, \ldots, x_n : S_n \vdash t : T$ and $\Gamma \vdash s_i : S_i$ for each $i$, then $\Gamma \vdash [x_1 \mapsto s_1, \ldots, x_n \mapsto s_n]\, t : T$.

*Proof.* By induction on $n$, applying the single-variable Substitution Lemma $n$ times. The order of substitution does not matter (assuming the $x_i$ are distinct and none of the $s_i$ contain the other $x_j$ as free variables, which is ensured by the context structure). $\square$

This generalization is needed when proving the Fundamental Lemma for logical relations (Section 8), where we substitute all free variables simultaneously.

### 4.5 A Variant: Substitution for Values Only

In call-by-value STLC, the E-AppAbs rule only substitutes **values** (not arbitrary terms). One might wonder whether we can prove a weaker substitution lemma that only applies to values:

**Lemma 4.3 (Value Substitution).** If $\Gamma, x : S \vdash t : T$ and $\Gamma \vdash v : S$ and $v$ is a value, then $\Gamma \vdash [x \mapsto v]\, t : T$.

This is a special case of the general Substitution Lemma (which works for all terms, not just values). For the preservation proof, the value restriction is sufficient: E-AppAbs only fires when the argument is a value. But the general lemma is more useful for other purposes (e.g., call-by-name evaluation, logical relations).

---

## 5. Preservation

**Theorem 5.1 (Preservation / Subject Reduction).** If $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$.

*Proof.* By induction on the derivation of $\Gamma \vdash t : T$.

**Case** T-True, T-False, T-Zero: $t$ is a value and cannot step. Vacuously true.

**Case** T-Var: $t = x$. Variables do not step. Vacuously true.

**Case** T-Abs: $t = \lambda x : T_1.\, t_1$. Lambda abstractions are values and do not step. Vacuously true.

**Case** T-If: $t = \text{if}\; t_1\; \text{then}\; t_2\; \text{else}\; t_3$ with $\Gamma \vdash t_1 : \text{Bool}$, $\Gamma \vdash t_2 : T$, $\Gamma \vdash t_3 : T$.

The possible evaluation rules are:

- *Subcase E-IfTrue*: $t_1 = \text{true}$ and $t' = t_2$. We need $\Gamma \vdash t_2 : T$, which is given.
- *Subcase E-IfFalse*: $t_1 = \text{false}$ and $t' = t_3$. We need $\Gamma \vdash t_3 : T$, which is given.
- *Subcase E-If*: $t_1 \to t_1'$ and $t' = \text{if}\; t_1'\; \text{then}\; t_2\; \text{else}\; t_3$. By the induction hypothesis on $t_1$, $\Gamma \vdash t_1' : \text{Bool}$. By T-If, $\Gamma \vdash \text{if}\; t_1'\; \text{then}\; t_2\; \text{else}\; t_3 : T$.

**Case** T-Succ: $t = \text{succ}\; t_1$ with $\Gamma \vdash t_1 : \text{Nat}$.

The only applicable rule is E-Succ: $t_1 \to t_1'$ and $t' = \text{succ}\; t_1'$. By IH, $\Gamma \vdash t_1' : \text{Nat}$. By T-Succ, $\Gamma \vdash \text{succ}\; t_1' : \text{Nat}$.

**Case** T-Pred: $t = \text{pred}\; t_1$ with $\Gamma \vdash t_1 : \text{Nat}$.

- *Subcase E-Pred*: $t_1 \to t_1'$ and $t' = \text{pred}\; t_1'$. By IH, $\Gamma \vdash t_1' : \text{Nat}$. By T-Pred, $\Gamma \vdash \text{pred}\; t_1' : \text{Nat}$.
- *Subcase E-PredZero*: $t_1 = 0$ and $t' = 0$. We need $\Gamma \vdash 0 : \text{Nat}$, which holds by T-Zero.
- *Subcase E-PredSucc*: $t_1 = \text{succ}\; \text{nv}$ and $t' = \text{nv}$. We need $\Gamma \vdash \text{nv} : \text{Nat}$. By inversion on $\Gamma \vdash \text{succ}\; \text{nv} : \text{Nat}$, we get $\Gamma \vdash \text{nv} : \text{Nat}$. Done.

**Case** T-IsZero: $t = \text{iszero}\; t_1$ with $\Gamma \vdash t_1 : \text{Nat}$ and $T = \text{Bool}$.

- *Subcase E-IsZero*: $t_1 \to t_1'$ and $t' = \text{iszero}\; t_1'$. By IH, $\Gamma \vdash t_1' : \text{Nat}$. By T-IsZero, $\Gamma \vdash \text{iszero}\; t_1' : \text{Bool}$.
- *Subcase E-IsZeroZero*: $t_1 = 0$ and $t' = \text{true}$. We need $\Gamma \vdash \text{true} : \text{Bool}$. By T-True.
- *Subcase E-IsZeroSucc*: $t_1 = \text{succ}\; \text{nv}$ and $t' = \text{false}$. We need $\Gamma \vdash \text{false} : \text{Bool}$. By T-False.

**Case** T-App: $t = t_1\; t_2$ with $\Gamma \vdash t_1 : T_1 \to T_2$ and $\Gamma \vdash t_2 : T_1$ and $T = T_2$.

- *Subcase E-App1*: $t_1 \to t_1'$ and $t' = t_1'\; t_2$. By the induction hypothesis on $t_1$, $\Gamma \vdash t_1' : T_1 \to T_2$. By T-App, $\Gamma \vdash t_1'\; t_2 : T_2$.

- *Subcase E-App2*: $t_1 = v_1$ (a value), $t_2 \to t_2'$, and $t' = v_1\; t_2'$. By the induction hypothesis on $t_2$, $\Gamma \vdash t_2' : T_1$. By T-App, $\Gamma \vdash v_1\; t_2' : T_2$.

- *Subcase E-AppAbs*: $t_1 = \lambda x : T_1.\, t_{12}$, $t_2 = v_2$ (a value), and $t' = [x \mapsto v_2]\, t_{12}$.

  By inversion on $\Gamma \vdash \lambda x : T_1.\, t_{12} : T_1 \to T_2$: $\Gamma, x : T_1 \vdash t_{12} : T_2$.

  We have $\Gamma \vdash v_2 : T_1$.

  By the Substitution Lemma (Lemma 4.1): $\Gamma \vdash [x \mapsto v_2]\, t_{12} : T_2$.

  Done.

$\square$

### 5.2 A Note on Induction Strategy

The preservation proof is by induction on the **typing derivation**, not on the evaluation derivation. This is a deliberate choice:

- Induction on the typing derivation gives us access to the premises of the typing rule (by inversion), which we need to reconstruct the typing of $t'$.
- We then perform case analysis on which evaluation rule was applied (which rule could have produced $t \to t'$ from the given form of $t$).

An alternative proof strategy is induction on the **evaluation derivation** $t \to t'$. This also works but requires more case analysis, because the evaluation rules are not syntax-directed (multiple congruence rules can apply to the same syntactic form, depending on which subterm steps).

### 5.3 Discussion of the Proof

The key case in the preservation proof is E-AppAbs (beta-reduction), which is the only case where the Substitution Lemma is invoked. All other cases are straightforward applications of the induction hypothesis and the typing rules.

The structure of the proof mirrors the evaluation rules:
- **Congruence rules** (E-App1, E-App2, E-If, E-Succ, E-Pred, E-IsZero): handled by the induction hypothesis.
- **Computation rules** (E-AppAbs, E-IfTrue, E-IfFalse, E-PredZero, E-PredSucc, E-IsZeroZero, E-IsZeroSucc): handled by direct appeal to the premises or by the Substitution Lemma.

---

## 6. Subject Expansion Fails

One might wonder whether the converse of preservation holds: if $t \to t'$ and $\Gamma \vdash t' : T$, does $\Gamma \vdash t : T$?

**Proposition 6.1.** Subject expansion does not hold for STLC.

*Counterexample.* Consider:

$$t = (\lambda x : \text{Nat}.\, 0)\; (\text{succ}\; \text{true})$$

This term is ill-typed because $\text{succ}\; \text{true}$ is not well-typed. However, under call-by-name evaluation (where we do not require the argument to be a value before beta-reduction), $t$ would reduce to $0$, which is well-typed at $\text{Nat}$.

Even under call-by-value, consider the term:

$$t = \text{if}\; \text{true}\; \text{then}\; 0\; \text{else}\; (\text{succ}\; \text{true})$$

This is ill-typed (the else branch is ill-typed), but it reduces to $0 : \text{Nat}$.

Wait --- actually, under STLC's typing rules, T-If requires both branches to have the same type. The term $\text{if}\; \text{true}\; \text{then}\; 0\; \text{else}\; (\text{succ}\; \text{true})$ fails type checking because $\text{succ}\; \text{true}$ is not typable at all, so T-If cannot be applied.

A cleaner counterexample: $(\lambda x : \text{Bool}.\, 0)\; \text{true}$ has type $\text{Nat}$, and it reduces to $0 : \text{Nat}$. Now consider the ill-typed term $(\lambda x : \text{Bool}.\, 0)\; ((\lambda y : \text{Nat}.\, y)\; \text{true})$. The argument $((\lambda y : \text{Nat}.\, y)\; \text{true})$ is ill-typed. Yet if we could somehow reduce the outer application (bypassing the argument's ill-typedness), we would get $0$, which is well-typed.

The essential point is: **subject expansion fails** because ill-typed terms can reduce to well-typed terms. A divergent or stuck subterm can be "thrown away" by evaluation (e.g., in an unused function argument), producing a well-typed result.

### 6.2 Why Subject Expansion Failure Matters

The failure of subject expansion has practical consequences:

1. **Optimization**: A compiler cannot replace a well-typed subterm with an equivalent but differently-typed subterm, even if the replacement is never evaluated. The type system constrains all branches, not just the taken ones.

2. **Debugging**: Finding the source of a type error by running the program backward (from a well-typed result) is not possible in general. The type error might have been in a branch that was never executed.

3. **Type inference**: Subject expansion failure means that type inference cannot simply "run the program" and observe the types of the results. It must analyze all possible execution paths, including those not taken.

### 6.3 Partial Subject Expansion

While full subject expansion fails, a restricted form holds: if $t \to t'$ and $\Gamma \vdash t : T$ and $\Gamma \vdash t' : T$, then trivially $\Gamma \vdash t : T$. That is, if we already know $t$ is well-typed, then so is $t'$ (by preservation). The issue is only when $t$ is ill-typed but $t'$ is well-typed.

---

## 7. Type Safety for Open Terms

Note that Progress requires $t$ to be a **closed** term ($\vdash t : T$ with the empty context). This is essential: an open term like $x$ with $x : \text{Bool} \vdash x : \text{Bool}$ is not a value and cannot step (since $x$ is a free variable, not a redex).

Preservation, on the other hand, holds for open terms: if $\Gamma \vdash t : T$ and $t \to t'$, then $\Gamma \vdash t' : T$. The context $\Gamma$ plays no role in the evaluation rules (evaluation only applies to closed terms in practice), but the theorem statement is more general and useful for the induction.

In the combined type safety result, we use Progress only for closed terms and Preservation to maintain well-typedness across reduction steps.

### 7.1 Closed Reduction Preserves Closedness

**Lemma 7.1.** If $t$ is closed and $t \to t'$, then $t'$ is closed.

*Proof.* By induction on $t \to t'$. The key case is E-AppAbs: $(\lambda x : T.\, t_{12})\; v \to [x \mapsto v]\, t_{12}$. Since $(\lambda x : T.\, t_{12})\; v$ is closed, $\text{FV}((\lambda x : T.\, t_{12})\; v) = (\text{FV}(t_{12}) \setminus \{x\}) \cup \text{FV}(v) = \emptyset$. Since $v$ is closed, $\text{FV}(v) = \emptyset$, so $\text{FV}(t_{12}) \subseteq \{x\}$. By properties of substitution, $\text{FV}([x \mapsto v]\, t_{12}) \subseteq (\text{FV}(t_{12}) \setminus \{x\}) \cup \text{FV}(v) = \emptyset$. So $t'$ is closed. The congruence cases follow by the induction hypothesis. $\square$

This lemma ensures that the progress theorem's precondition (the term is closed) is maintained throughout evaluation, without needing to appeal to preservation.

### 7.2 An Alternative Formulation: Closed Reduction

Some presentations define a separate "closed reduction" relation $t \to_c t'$ that only applies to closed terms. Under this formulation, type safety states: if $\vdash t : T$, then $t$ does not get stuck under $\to_c$. This is equivalent to our formulation because: (a) closed terms only reduce to closed terms (Lemma 7.1), and (b) the evaluation rules do not inspect the context.

---

## 8. Normalization

### 8.1 The Normalization Theorem

**Theorem 8.1 (Strong Normalization).** If $\vdash t : T$, then every reduction sequence starting from $t$ is finite.

Equivalently: there is no infinite reduction sequence $t \to t_1 \to t_2 \to \cdots$.

This is a remarkable property: **every well-typed STLC program terminates**. Combined with type safety, it means that every well-typed closed term eventually reduces to a value.

**Corollary 8.1.1.** If $\vdash t : T$, then there exists a value $v$ such that $t \to^* v$ and $\vdash v : T$.

*Proof.* By strong normalization, $t$ has a normal form $t'$ (i.e., $t \to^* t'$ and $t'$ cannot step). By Exercise 12.7 (which follows from Progress), $t'$ is a value. By Preservation (applied transitively), $\vdash t' : T$. $\square$

This corollary gives a complete picture of well-typed STLC computation: every well-typed closed term reduces to a unique value of the same type. (Uniqueness follows from the determinism of call-by-value evaluation and the Church-Rosser property.)

### 8.2 Weak vs. Strong Normalization

**Definition 8.2 (Weak Normalization).** A term $t$ is **weakly normalizing** if there exists a finite reduction sequence $t \to t_1 \to \cdots \to t_n$ where $t_n$ is a normal form (no further reduction is possible).

**Definition 8.3 (Strong Normalization).** A term $t$ is **strongly normalizing** (or **terminating**) if every reduction sequence starting from $t$ is finite. That is, there is no infinite chain $t \to t_1 \to t_2 \to \cdots$.

Strong normalization implies weak normalization (if every sequence is finite, then at least one sequence reaches a normal form). The converse does not hold in general: a term might have both terminating and non-terminating reduction sequences, making it weakly but not strongly normalizing.

In STLC with call-by-value evaluation, the distinction is less important because the evaluation strategy is deterministic (each term has at most one next step). But under unrestricted beta-reduction (where we can reduce any redex, not just the outermost one), the distinction matters. The STLC strong normalization theorem holds under unrestricted reduction, which is the strongest possible statement.

### 8.3 Why the Standard Proof Techniques Fail

One might try to prove strong normalization by induction on the typing derivation. But this does not work directly. Consider the beta-reduction step:

$$(\lambda x : T_1.\, t_{12})\; v_2 \to [x \mapsto v_2]\, t_{12}$$

The substitution $[x \mapsto v_2]\, t_{12}$ can be **larger** than $t_{12}$ (because $v_2$ may appear multiple times in $t_{12}$). So the term can grow during reduction, and a naive size-based argument fails.

**Example.** Let $t = (\lambda f : T \to T.\, \lambda x : T.\, f\; (f\; x))\; (\lambda y : T.\, y)$. After one beta-reduction step:

$$t \to \lambda x : T.\, (\lambda y : T.\, y)\; ((\lambda y : T.\, y)\; x)$$

The result is larger than the original application's body. Two more reduction steps:

$$\to \lambda x : T.\, (\lambda y : T.\, y)\; x \to \lambda x : T.\, x$$

So the term grows before it shrinks. An induction on term size would fail at the first step.

Moreover, the typing derivation of $[x \mapsto v_2]\, t_{12}$ (as constructed in the Substitution Lemma) is not a sub-derivation of the original derivation of $(\lambda x : T_1.\, t_{12})\; v_2$. So induction on the typing derivation does not work either.

Another failed attempt: induction on the **type**. One might try to argue that beta-reduction at type $T$ reduces to operations at "smaller" types. But beta-reduction at type $T_1 \to T_2$ produces terms of type $T_2$, and $T_2$ can be arbitrarily complex (e.g., $T_2 = T_1 \to T_2$... wait, that is a recursive type). In STLC, types are finite, so there is no strict descent in type size during reduction. We need a cleverer argument.

### 8.3 Logical Relations (Tait's Method)

The standard proof technique for strong normalization is **logical relations**, introduced by Tait (1967).

**Key Idea.** Instead of proving that every well-typed term is normalizing directly, we define a stronger property --- membership in a **reducibility set** $\mathcal{R}_T$ --- by induction on the type $T$, and then show:

1. Every term in $\mathcal{R}_T$ is strongly normalizing.
2. Every well-typed term of type $T$ belongs to $\mathcal{R}_T$.

**Definition 8.2 (Reducibility Sets).** For each type $T$, define $\mathcal{R}_T$ (a set of closed terms) as follows:

$$\mathcal{R}_{\text{Bool}} = \{ t \mid \vdash t : \text{Bool} \text{ and } t \text{ is strongly normalizing} \}$$

$$\mathcal{R}_{\text{Nat}} = \{ t \mid \vdash t : \text{Nat} \text{ and } t \text{ is strongly normalizing} \}$$

$$\mathcal{R}_{T_1 \to T_2} = \{ t \mid \vdash t : T_1 \to T_2 \text{ and for all } s \in \mathcal{R}_{T_1},\; t\; s \in \mathcal{R}_{T_2} \}$$

The crucial clause is the arrow type: a term $t$ of type $T_1 \to T_2$ is in $\mathcal{R}_{T_1 \to T_2}$ not just if $t$ normalizes, but if applying $t$ to **any** normalizing argument of type $T_1$ gives a normalizing result of type $T_2$. This quantification over all arguments is what makes the induction work.

**Lemma 8.3 (Reducibility implies SN).** For all types $T$, if $t \in \mathcal{R}_T$ then $t$ is strongly normalizing.

*Proof.* By induction on the structure of $T$.
- Base cases ($\text{Bool}$, $\text{Nat}$): Immediate from the definition.
- Arrow case ($T_1 \to T_2$): Since $t \in \mathcal{R}_{T_1 \to T_2}$, for any $s \in \mathcal{R}_{T_1}$, $t\;s \in \mathcal{R}_{T_2}$. By IH, $t\;s$ is SN. Now, any infinite reduction from $t$ would induce an infinite reduction from $t\;s$ (by applying E-App1 under the application context), contradicting the SN of $t\;s$. (This argument requires a bit more care; one needs $\mathcal{R}_{T_1}$ to be nonempty, which is established separately.) $\square$

**Lemma 8.4 (Fundamental Lemma / Adequacy).** If $\Gamma \vdash t : T$ and $\sigma$ is a closing substitution such that $\sigma(x) \in \mathcal{R}_{\Gamma(x)}$ for all $x \in \text{dom}(\Gamma)$, then $\sigma(t) \in \mathcal{R}_T$.

*Proof sketch.* By induction on the typing derivation. The key case is T-Abs, where one must show that $\sigma(\lambda x : T_1.\, t_1) \in \mathcal{R}_{T_1 \to T_2}$. Given any $s \in \mathcal{R}_{T_1}$, we need $(\sigma(\lambda x : T_1.\, t_1))\; s \in \mathcal{R}_{T_2}$. This reduces (after beta) to $\sigma[x \mapsto s](t_1)$, which is in $\mathcal{R}_{T_2}$ by the induction hypothesis (with the extended substitution $\sigma[x \mapsto s]$). The delicate part is showing that beta-expansion preserves reducibility (that if $t' \in \mathcal{R}_T$ and $t \to t'$, then $t \in \mathcal{R}_T$ under appropriate conditions). $\square$

**Proof of Theorem 8.1.** Given $\vdash t : T$, apply the Fundamental Lemma with the empty substitution $\sigma = \emptyset$. This gives $t \in \mathcal{R}_T$. By Lemma 8.3, $t$ is strongly normalizing. $\square$

### 8.4 Why Logical Relations Work

The key insight behind logical relations is the definition at arrow types. A naive attempt might define:

$$\mathcal{R}_{T_1 \to T_2}^{\text{naive}} = \{ t \mid \vdash t : T_1 \to T_2 \text{ and } t \text{ is strongly normalizing} \}$$

This does not work because we cannot prove the Fundamental Lemma for T-Abs. To show $\lambda x : T_1.\, t_1 \in \mathcal{R}_{T_1 \to T_2}^{\text{naive}}$, we would need to show that $\lambda x : T_1.\, t_1$ is strongly normalizing, which requires knowing that $[x \mapsto v]\, t_1$ is strongly normalizing for all values $v$ --- but this is what we are trying to prove.

The actual definition $\mathcal{R}_{T_1 \to T_2} = \{ t \mid \forall s \in \mathcal{R}_{T_1}.\, t\; s \in \mathcal{R}_{T_2} \}$ breaks this circularity by quantifying over all reducible arguments. The quantification is well-founded because $T_1$ is a strict subtype of $T_1 \to T_2$ (it has smaller depth), so $\mathcal{R}_{T_1}$ is defined before $\mathcal{R}_{T_1 \to T_2}$.

### 8.5 Hereditary Substitutions and Normalization by Evaluation

An alternative approach to proving normalization is **normalization by evaluation (NbE)**. Instead of logical relations on terms, NbE defines a semantic domain (often using the metalanguage) and interprets typed terms into this domain. The normalization proof then follows from the totality of the interpretation function.

NbE has several advantages:
1. It provides a normalization **algorithm**, not just a proof of existence.
2. It extends more naturally to richer type systems (e.g., dependent types).
3. The implementation is closely related to practical interpreters.

We do not develop NbE in this lecture but note its importance as a proof technique and as the basis of the normalization algorithms in proof assistants like Agda and Lean.

### 8.6 Consequences of Normalization

1. **STLC is not Turing-complete.** There exist computable functions that cannot be expressed in STLC (e.g., Ackermann's function is representable, but the function $f(n)$ that runs Turing machine $n$ on input $n$ for $n$ steps is not, because STLC cannot express general recursion).

2. **The Curry-Howard perspective.** Strong normalization of STLC corresponds to cut elimination in intuitionistic propositional logic: every proof can be normalized (see Lecture 02d).

3. **Practical significance.** In languages with a fixed-point operator (like OCaml, Haskell, or PCF), strong normalization fails. But the type safety property (progress + preservation) still holds, even for non-terminating programs. The type system guarantees that a program either terminates with a value of the correct type, or diverges --- it never gets stuck.

4. **Logical consistency.** By the Curry-Howard correspondence (Lecture 02d), strong normalization of STLC corresponds to the consistency of intuitionistic propositional logic. If the calculus were not normalizing, it would be possible to construct a "proof" of falsity ($\bot$), making the logic inconsistent. Normalization guarantees that every proof can be brought to a canonical form, and in particular, there is no canonical proof of $\bot$.

5. **Decidability of equivalence.** Strong normalization, combined with the Church-Rosser property (confluence), implies that beta-eta equivalence of STLC terms is decidable: to check whether $t_1 =_{\beta\eta} t_2$, normalize both terms and compare their normal forms. This decidability is exploited in type-checking algorithms for dependent type theories.

### 8.7 The Expressive Power of STLC

How powerful is STLC from a computational standpoint? The answer is subtle:

- The functions $\text{Nat} \to \text{Nat}$ representable in STLC are exactly the **extended polynomials**: functions built from 0, successor, predecessor, and conditionals on iszero. These include all constant functions, the identity, and bounded iterations, but not unbounded recursion.

- More precisely, Schwichtenberg (1976) showed that the numeric functions definable in STLC (with natural numbers as a base type, using Church-style representations) are exactly the **extended polynomials over $\mathbb{N}$**.

- Adding general recursion ($\text{fix}$) jumps immediately to Turing-completeness. There is no intermediate stopping point: either you have strong normalization (and limited expressiveness) or you have general recursion (and Turing-completeness but no termination guarantee).

- This sharp divide is a fundamental fact about type theory and is related to the impossibility of deciding the halting problem.

---

## 9. Strengthening Type Safety: Alternative Formulations

### 9.1 Big-Step Type Safety

An alternative formulation uses big-step semantics:

**Theorem 9.1 (Big-Step Type Safety).** If $\vdash t : T$ then either $t$ diverges or $t \Downarrow v$ where $\vdash v : T$.

This formulation combines progress, preservation, and the value restriction into a single statement. It is sometimes easier to prove directly (by induction on the big-step derivation), but it conflates non-termination with getting stuck, which is a disadvantage.

### 9.2 Type Safety via Logical Relations

Logical relations (Section 8.3) actually give a stronger result than progress + preservation. They show that every well-typed term reduces to a value (not just that it doesn't get stuck), which implies both type safety and normalization simultaneously.

### 9.3 Semantic Type Safety

A more modern approach, due to Appel and McAllester (2001) and developed further in the "step-indexed logical relations" literature, defines type safety semantically: a type $T$ is interpreted as a set of terms that are "safe for $k$ steps," and type safety means that well-typed terms are safe for all $k$.

This approach avoids the need for explicit progress and preservation theorems and scales well to complex languages with features like recursive types, mutable references, and concurrency.

### 9.4 Type Safety and Program Optimization

Type safety has practical implications for compiler optimizations:

1. **Dead code elimination**: If a branch of an `if` expression is unreachable (e.g., `if true then e1 else e2`), the compiler can eliminate it. Type safety guarantees that the remaining branch produces a value of the correct type.

2. **Unboxing**: If the type system guarantees that a value is an integer, the runtime can store it as a raw machine integer rather than a boxed (heap-allocated) object. This eliminates indirection and saves memory.

3. **Monomorphization**: In polymorphic languages, the compiler can specialize polymorphic functions to specific types, eliminating the overhead of dictionary passing or type dispatch.

4. **Inlining**: If a function's type guarantees it is pure (no side effects), it can be safely inlined or memoized. While STLC has no side effects, this principle extends to effect-typed languages (Module 09).

5. **Proof-carrying code**: The type derivation serves as a machine-checkable certificate that the program satisfies certain safety properties. This enables security-critical applications like proof-carrying code (Necula, 1997) and certified compilers (CompCert, CakeML).

---

## 10. Extending the Language: What Changes?

When we extend STLC with new features (as in Lecture 02c), the type safety proof must be updated. Here is what typically needs to change:

### 10.1 Adding Products ($T_1 \times T_2$)

- **Canonical Forms**: Add a case: if $v$ is a value and $\vdash v : T_1 \times T_2$, then $v = (v_1, v_2)$.
- **Progress**: Add cases for T-Pair, T-Fst, T-Snd.
- **Substitution Lemma**: Add cases for pairs and projections (straightforward).
- **Preservation**: Add cases for E-Fst, E-Snd, E-PairBeta1, E-PairBeta2.

### 10.2 Adding Sums ($T_1 + T_2$)

- **Canonical Forms**: Add: if $v : T_1 + T_2$, then $v = \text{inl}\;v_1$ or $v = \text{inr}\;v_2$.
- **Progress**: Add cases for T-Inl, T-Inr, T-Case.
- **Substitution Lemma**: Add cases for injections and case analysis.
- **Preservation**: Add cases for E-CaseInl, E-CaseInr.

### 10.3 Adding General Recursion ($\text{fix}$)

- **Progress**: Add case for T-Fix (the fixed-point operator always steps).
- **Substitution Lemma**: Add case for $\text{fix}$ (straightforward).
- **Preservation**: Add case for E-Fix.
- **Normalization**: Normalization is **lost**. The term $\text{fix}\; (\lambda x : T.\, x)$ diverges.

### 10.4 Adding References ($\text{ref}$, $!$, $:=$)

This is the most challenging extension. It requires:
- A **store** in the evaluation relation: $t \mid \mu \to t' \mid \mu'$.
- A **store typing** $\Sigma$ mapping store locations to types.
- Modified progress: $\vdash t : T$ and well-typed store $\mu$ implies progress.
- Modified preservation: must also show the store remains well-typed.
- The Substitution Lemma is unchanged, but a new **Store Update Lemma** is needed.

The key difficulty with references is that the store grows during evaluation (each $\text{ref}\; v$ allocates a new location). This means the store typing $\Sigma$ must also grow, and preservation must be stated as: if $\Gamma \mid \Sigma \vdash t : T$ and $t \mid \mu \to t' \mid \mu'$ and $\mu : \Sigma$, then there exists $\Sigma' \supseteq \Sigma$ such that $\Gamma \mid \Sigma' \vdash t' : T$ and $\mu' : \Sigma'$. The growth of $\Sigma$ requires a monotonicity lemma: if $\Gamma \mid \Sigma \vdash t : T$ and $\Sigma \subseteq \Sigma'$, then $\Gamma \mid \Sigma' \vdash t : T$.

### 10.5 Summary of Extension Requirements

| Extension | Canonical Forms | Progress | Substitution | Preservation | Normalization |
|-----------|---------------|----------|-------------|-------------|---------------|
| Products | New case for $T_1 \times T_2$ | New cases | New cases (easy) | New cases | Preserved |
| Sums | New case for $T_1 + T_2$ | New cases | New cases (binding!) | New cases (uses subst. lemma) | Preserved |
| Unit | New case for Unit | Trivial | Trivial | Trivial | Preserved |
| Void | Vacuous | Vacuous value case | New case | New case | Preserved |
| $\text{fix}$ | No change | New case | New case | New case | **Lost** |
| References | No change to term values | Needs store | No change | Needs store typing | **Lost** |

---

## 11. Historical Notes

The progress-and-preservation proof technique was popularized by **Wright and Felleisen** (1994), though the individual ideas go back further:

- **Subject reduction** (preservation) was studied for the lambda calculus by **Church and Rosser** (1936) and formalized by **Barendregt** (1984).
- **Progress** as a separate theorem was less common before Wright and Felleisen; earlier work often used denotational semantics or big-step formulations.
- **Milner** (1978) proved type soundness for ML using a different technique (a semantic argument based on ideal models).
- The logical relations proof of normalization is due to **Tait** (1967) for STLC and was extended to System F by **Girard** (1972).
- **Plotkin** (1977) studied PCF (STLC extended with general recursion and numbers), proving type safety but not normalization (since PCF is Turing-complete).
- The notion of "canonical forms" is implicit in many early works but was formalized as a named lemma in textbook treatments starting with Pierce (2002).

The evolution of type safety proofs reflects the evolution of programming language theory:

- **1960s-1970s**: Denotational semantics dominated. Type soundness was proved by showing that the denotation of a well-typed program belongs to the denotation of its type. This required sophisticated domain theory.
- **1980s**: Operational approaches gained ground. Milner and others proved type soundness using big-step semantics.
- **1990s**: Wright and Felleisen's syntactic approach (small-step progress + preservation) became standard due to its simplicity and modularity.
- **2000s-present**: Step-indexed logical relations and Iris-style semantic type safety handle increasingly complex languages (with concurrency, higher-order state, etc.).

### 11.1 Mechanized Proofs

The type safety proofs for STLC have been mechanized in numerous proof assistants:

- **Coq**: The Software Foundations textbook (Pierce et al.) includes a full mechanization of progress and preservation for STLC, using named variables.
- **Agda**: Plfa (Programming Language Foundations in Agda) provides an intrinsically typed formalization where ill-typed terms are unrepresentable.
- **Lean**: The Lean community has formalized STLC type safety as tutorial examples.
- **Isabelle/HOL**: Nipkow's formalization uses nominal logic for variable binding.

The "POPLMark Challenge" (Aydemir et al., 2005) proposed STLC type safety as a benchmark for proof assistants, focusing on the difficulties of variable binding. Different approaches (named variables, de Bruijn indices, locally nameless, nominal logic, HOAS) have different trade-offs in terms of proof complexity and readability.

### 11.2 Beyond Syntactic Type Safety

The Wright-Felleisen approach (syntactic type safety via progress and preservation) is not the only way to prove type safety:

1. **Denotational type safety**: Define a semantic interpretation of types as sets of values, and show that well-typed terms denote elements of the corresponding set. This approach avoids the need for explicit progress and preservation theorems.

2. **Logical relations** (as in Section 8): Define a "good behavior" predicate by induction on types, and show all well-typed terms satisfy it. This gives stronger results (e.g., normalization) but requires more sophisticated proof techniques.

3. **Step-indexed logical relations** (Appel-McAllester): Define "safe for $k$ steps" semantically, without reference to the typing rules. This scales to languages with recursive types and mutable state where syntactic proofs become unwieldy.

4. **Iris and higher-order separation logic**: Modern frameworks that support modular, compositional type safety proofs for concurrent languages.

---

## 12. Worked Exercises

### Exercise 12.1

Prove that if $\vdash v : \text{Bool}$ and $v$ is a value, then $v = \text{true}$ or $v = \text{false}$, without using the Uniqueness of Types theorem.

**Solution.** We enumerate all possible values: $\text{true}$, $\text{false}$, $0$, $\text{succ}\;\text{nv}$, $\lambda x : T.\, t$.

- $v = \text{true}$: $\vdash \text{true} : \text{Bool}$ by T-True. Compatible.
- $v = \text{false}$: $\vdash \text{false} : \text{Bool}$ by T-False. Compatible.
- $v = 0$: The only typing rule for $0$ is T-Zero, which gives $\vdash 0 : \text{Nat}$. Since $\text{Bool}$ is not the conclusion of T-Zero, we cannot derive $\vdash 0 : \text{Bool}$. Impossible.
- $v = \text{succ}\; \text{nv}$: The only rule is T-Succ, giving type $\text{Nat}$. Impossible.
- $v = \lambda x : T.\, t$: The only rule is T-Abs, giving an arrow type $T \to T'$. Since $\text{Bool}$ is not an arrow type, impossible.

$\square$

### Exercise 12.2

Where in the proof of Progress do we use the assumption that $t$ is closed (typed in the empty context)?

**Solution.** In the T-Var case. If $\Gamma \vdash x : T$ with a nonempty $\Gamma$, then $x$ is a free variable: it is not a value and it cannot step. So $x$ would be stuck. But in the empty context, the T-Var case requires $x : T \in \emptyset$, which is impossible. So the case is vacuously true, and we avoid the stuck state.

This is the **only** place where the closed-term assumption is used. All other cases work for both open and closed terms.

### Exercise 12.3

Give a complete proof of preservation for the case T-App, E-AppAbs, filling in all details.

**Solution.**

Suppose $\Gamma \vdash t_1\; t_2 : T$ where $t_1\; t_2 \to t'$ by E-AppAbs.

By E-AppAbs, $t_1 = \lambda x : T_1.\, t_{12}$ and $t_2 = v_2$ (a value) and $t' = [x \mapsto v_2]\, t_{12}$.

By the T-App rule, $\Gamma \vdash \lambda x : T_1.\, t_{12} : T_1 \to T$ and $\Gamma \vdash v_2 : T_1$.

By inversion on $\Gamma \vdash \lambda x : T_1.\, t_{12} : T_1 \to T$ (using T-Abs): $\Gamma, x : T_1 \vdash t_{12} : T$.

Now we have:
1. $\Gamma, x : T_1 \vdash t_{12} : T$
2. $\Gamma \vdash v_2 : T_1$

By the Substitution Lemma (Lemma 4.1), applied with $s = v_2$ and $S = T_1$:

$$\Gamma \vdash [x \mapsto v_2]\, t_{12} : T$$

That is, $\Gamma \vdash t' : T$. $\square$

### Exercise 12.4

Prove that if $\vdash t : \text{Nat}$ and $t$ is a value, then there exists $n \in \mathbb{N}$ such that $t = \overline{n}$ (where $\overline{n}$ denotes the numeral $\text{succ}^n\; 0$).

**Solution.** By the Canonical Forms Lemma (Lemma 2.1, part 2), if $v$ is a value and $\vdash v : \text{Nat}$, then $v$ is a numeric value. We proceed by induction on the structure of numeric values:

- If $v = 0$, then $v = \overline{0}$ with $n = 0$.
- If $v = \text{succ}\; \text{nv}$, then by inversion on $\vdash \text{succ}\; \text{nv} : \text{Nat}$ (via T-Succ), $\vdash \text{nv} : \text{Nat}$. Since $\text{nv}$ is a numeric value (hence a value), by the induction hypothesis, $\text{nv} = \overline{m}$ for some $m$. Then $v = \text{succ}\; \overline{m} = \overline{m+1}$ with $n = m + 1$.

$\square$

### Exercise 12.5

Explain why the following proof attempt of progress for T-App is incorrect:

"Case T-App: $t = t_1\; t_2$. By IH on $t_1$, either $t_1$ is a value or $t_1 \to t_1'$. If $t_1 \to t_1'$, then by E-App1, $t_1\; t_2 \to t_1'\; t_2$. If $t_1$ is a value, then by Canonical Forms, $t_1 = \lambda x : T_1.\, t_{12}$, so by E-AppAbs, $(\lambda x : T_1.\, t_{12})\; t_2 \to [x \mapsto t_2]\, t_{12}$."

**Solution.** The error is in the application of E-AppAbs. The E-AppAbs rule requires the argument $t_2$ to be a **value** (this is call-by-value semantics), but the proof assumes $t_2$ is arbitrary. We need an additional case analysis: when $t_1$ is a value but $t_2$ is not, E-App2 applies to reduce $t_2$ first. Only when both $t_1$ and $t_2$ are values do we use E-AppAbs.

The correct proof has three subcases:
1. $t_1 \to t_1'$: use E-App1.
2. $t_1$ is a value, $t_2 \to t_2'$: use E-App2.
3. Both are values: use Canonical Forms on $t_1$, then E-AppAbs.

### Exercise 12.6

Does preservation hold if we change the evaluation strategy from call-by-value to call-by-name (where E-AppAbs becomes $(\lambda x : T.\, t)\; t_2 \to [x \mapsto t_2]\, t$ without requiring $t_2$ to be a value)?

**Solution.** Yes, preservation still holds under call-by-name. The key case (E-AppAbs) in the preservation proof requires the Substitution Lemma: if $\Gamma, x : T_1 \vdash t_{12} : T_2$ and $\Gamma \vdash t_2 : T_1$, then $\Gamma \vdash [x \mapsto t_2]\, t_{12} : T_2$. The Substitution Lemma does not require $t_2$ to be a value --- it works for arbitrary well-typed terms. So the proof goes through unchanged.

What changes under call-by-name is progress: we no longer need E-App2 (we never reduce the argument before substituting), so the progress proof is actually simpler. However, the evaluation order affects which terms are values and which evaluation rules apply, so the details of the congruence cases change.

### Exercise 12.7

Prove or disprove: if $\vdash t : T$ and $t$ is in normal form (no $t'$ with $t \to t'$), then $t$ is a value.

**Solution.** This follows from Progress: if $\vdash t : T$ and $t$ is not a value, then by Progress, there exists $t'$ with $t \to t'$. Contrapositive: if $t$ is in normal form (no such $t'$ exists), then $t$ must be a value. $\square$

Note that the converse is not quite true: in call-by-value STLC, lambda abstractions are values even though their bodies may contain redexes. Under unrestricted beta-reduction, all values are in normal form, but under call-by-value, values are a proper subset of normal forms (actually, in CBV, the normal forms of well-typed terms coincide with values, but this requires a proof).

### Exercise 12.8

Suppose we add a new type $\text{String}$ with a constant $\text{hello} : \text{String}$ but forget to add the typing rule T-Hello. What goes wrong with type safety?

**Solution.** Without the typing rule, the term $\text{hello}$ is not well-typed: there is no rule whose conclusion is $\Gamma \vdash \text{hello} : T$ for any $T$. So type safety is trivially unaffected --- the term $\text{hello}$ is simply rejected by the type system.

However, if we add the evaluation rule $\text{if}\; \text{hello}\; \ldots$ (treating $\text{hello}$ as something that evaluation rules might encounter), we could construct a scenario where a well-typed term (through some other mechanism) reduces to a term involving $\text{hello}$, which would then be stuck. But in STLC, this cannot happen because preservation ensures that well-typed terms only reduce to well-typed terms, and no well-typed term can contain $\text{hello}$ if there is no typing rule for it.

The lesson: type safety requires that **every construct in the language has both typing rules and evaluation rules**, and these must be compatible.

---

## Summary

In this lecture, we proved the two fundamental theorems of type safety for the simply typed lambda calculus:

- **Progress**: Every well-typed closed term is either a value or can take a step. The proof is by induction on the typing derivation, using the Canonical Forms lemma to analyze values.
- **Preservation** (Subject Reduction): If a well-typed term takes a step, the result is well-typed at the same type. The proof is by induction on the typing derivation, with the critical case (beta-reduction) handled by the Substitution Lemma.
- **Type Safety** follows from progress and preservation by induction on the length of the reduction sequence: a well-typed closed term never reaches a stuck state.
- The **Substitution Lemma** is the key technical tool: it states that substituting a well-typed term for a variable preserves typing. Its proof requires weakening, permutation, and careful handling of variable capture (alpha-renaming to avoid capture in the T-Abs case).
- The **Canonical Forms Lemma** bridges static types and dynamic values: it determines the possible shapes of values at each type, enabling the case analysis in the Progress proof.
- **Strong Normalization**: Every well-typed STLC term terminates. The proof uses logical relations (Tait's method), which define a semantic notion of "well-behavedness" by induction on types. The key insight is the quantified definition at arrow types.
- **Subject expansion fails**: ill-typed terms can reduce to well-typed terms, because evaluation can discard ill-typed subterms.
- The proof technique is **modular**: when extending the language, each theorem is extended independently by adding cases for the new constructs.

**Proof technique summary.** The key proof patterns introduced in this lecture are:

| Technique | Where Used | Purpose |
|-----------|-----------|---------|
| Induction on typing derivation | Progress, Preservation, Substitution Lemma | Primary proof strategy for typing properties |
| Case analysis on evaluation rules | Preservation | Determining how a term steps |
| Canonical Forms | Progress | Determining the shape of values at each type |
| Inversion of typing rules | All proofs | Reading typing rules backward |
| Weakening | Substitution Lemma (T-Abs case) | Adding unused variables to context |
| Permutation | Substitution Lemma (T-Abs case) | Reordering context bindings |
| Logical relations (induction on types) | Normalization | Defining "good behavior" semantically |

These techniques reappear throughout the course. In particular:
- Canonical Forms must be extended for each new type constructor (products, sums, etc.).
- The Substitution Lemma must be extended for each new binding construct (let, case, etc.).
- Progress and Preservation must be extended for each new evaluation rule.
- Logical relations become more sophisticated for polymorphism (System F, Module 06) and dependent types (Module 08).

**Looking ahead.** In Lecture 02d, we will see that the type safety proof has a logical reading: Progress corresponds to the completeness of the proof system, and Preservation corresponds to the soundness of proof normalization. This is the Curry-Howard correspondence applied to the metatheory.

---

## Further Reading

1. **Pierce, B. C.** (2002). *Types and Programming Languages*. MIT Press. Chapters 8-9. Full proofs of progress and preservation for STLC.

2. **Wright, A. K. and Felleisen, M.** (1994). "A Syntactic Approach to Type Soundness." *Information and Computation*, 115(1), 38-94. Introduced the progress-and-preservation proof technique.

3. **Tait, W. W.** (1967). "Intensional Interpretations of Functionals of Finite Type I." *Journal of Symbolic Logic*, 32(2), 198-212. The logical relations proof of normalization for STLC.

4. **Milner, R.** (1978). "A Theory of Type Polymorphism in Programming." *Journal of Computer and System Sciences*, 17(3), 348-375. Type soundness for ML.

5. **Girard, J.-Y., Lafont, Y., and Taylor, P.** (1989). *Proofs and Types*. Cambridge University Press. Proof of strong normalization for System F via reducibility candidates.

6. **Harper, R.** (2016). *Practical Foundations for Programming Languages*. 2nd ed. Chapters 6-8 for an alternative presentation of type safety.

7. **Appel, A. W. and McAllester, D.** (2001). "An Indexed Model of Recursive Types for Foundational Proof-Carrying Code." *ACM Transactions on Programming Languages and Systems*, 23(5), 657-683. Step-indexed logical relations for semantic type safety.

8. **Plotkin, G. D.** (1977). "LCF Considered as a Programming Language." *Theoretical Computer Science*, 5(3), 223-255. Type safety for PCF (STLC + fix).

9. **Schwichtenberg, H.** (1976). "Definierbare Funktionen im Lambda-Kalkul mit Typen." *Archiv fur Mathematische Logik und Grundlagenforschung*, 17, 113-114. Characterization of the functions definable in STLC.

10. **Pierce, B. C. et al.** *Software Foundations* (online). Volume 2 (Programming Language Foundations). A mechanized development of type safety proofs in Coq.

11. **Aydemir, B. et al.** (2005). "Mechanized Metatheory for the Masses: The POPLMark Challenge." In *Theorem Proving in Higher Order Logics*. The benchmark that motivated improved formalization techniques for type safety proofs.

12. **Necula, G. C.** (1997). "Proof-Carrying Code." In *Proceedings of POPL*. Using type safety as a foundation for code certification.

13. **Jung, R. et al.** (2018). "Iris from the Ground Up: A Modular Foundation for Higher-Order Concurrent Separation Logic." *Journal of Functional Programming*, 28. Modern semantic type safety for concurrent languages.

14. **Abel, A.** (2008). "Normalization by Evaluation: Dependent Types and Impredicativity." Habilitation thesis. NbE as an alternative to logical relations for proving normalization.
